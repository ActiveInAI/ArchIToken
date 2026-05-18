//! `RollbackGuard` — enforces SLA and auto-rollback within 30 seconds.
//!
//! Implements Constitution §8 (SLA) and §15 (`RollbackGuard` < 30s).
//!
//! The guard tracks per-engine health and selects the "preferred" engine
//! for routing. If the current preferred engine hits 3 consecutive SLA
//! violations or errors, it's quarantined for 5 minutes and the next-best
//! healthy engine takes over within 30 seconds.

use dashmap::DashMap;
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{info, warn};

use crate::inference::Engine;

const ENGINE_ROLLBACK_PRIORITY: &[Engine] = &[
    Engine::TensorRtLlm,
    Engine::VLlm,
    Engine::SgLang,
    Engine::LmDeploy,
    Engine::Ollama,
    Engine::LmStudio,
    Engine::HuggingFace,
    Engine::LlamaCpp,
];

/// SLA categories per Constitution §8.
#[derive(Debug, Clone, Copy)]
pub enum SlaCategory {
    /// 文生图 60 秒
    TextToImage,
    /// 图生 3D 90 秒
    ImageTo3D,
    /// 文生 3D 180 秒
    TextTo3D,
    /// 合规审查 180 秒
    ComplianceReview,
}

impl SlaCategory {
    /// Maximum allowed duration before it's an SLA violation.
    #[must_use]
    pub const fn max_duration(self) -> Duration {
        match self {
            Self::TextToImage => Duration::from_mins(1),
            Self::ImageTo3D => Duration::from_secs(90),
            Self::TextTo3D | Self::ComplianceReview => Duration::from_mins(3),
        }
    }
}

#[derive(Debug, Default)]
struct EngineHealth {
    consecutive_failures: u32,
    last_failure: Option<Instant>,
    quarantined_until: Option<Instant>,
    total_requests: u64,
    total_successes: u64,
    total_latency_ms: u128,
}

impl EngineHealth {
    fn is_quarantined(&self, now: Instant) -> bool {
        self.quarantined_until.is_some_and(|until| until > now)
    }
}

/// The guard itself.
pub struct RollbackGuard {
    health: Arc<DashMap<Engine, EngineHealth>>,
    preferred: Arc<RwLock<Option<Engine>>>,
    quarantine_duration: Duration,
    failure_threshold: u32,
}

impl RollbackGuard {
    /// Create a new guard with sensible defaults.
    ///
    /// Defaults: quarantine = 5 minutes, `failure_threshold` = 3 consecutive
    /// failures to trigger rollback (per §15, within 30 seconds).
    #[must_use]
    pub fn new() -> Self {
        Self {
            health: Arc::new(DashMap::new()),
            preferred: Arc::new(RwLock::new(None)),
            quarantine_duration: Duration::from_mins(5),
            failure_threshold: 3,
        }
    }

    /// Return the currently preferred engine, if any has been selected.
    #[must_use]
    pub fn preferred_engine(&self) -> Option<Engine> {
        *self.preferred.read()
    }

    /// Record a successful inference call.
    pub async fn record_success(&self, engine: Engine, latency: Duration) {
        {
            let mut entry = self.health.entry(engine).or_default();
            entry.consecutive_failures = 0;
            entry.total_requests += 1;
            entry.total_successes += 1;
            entry.total_latency_ms += latency.as_millis();
        }

        // If no preferred engine yet, set it.
        {
            let mut preferred = self.preferred.write();
            if preferred.is_none() {
                *preferred = Some(engine);
            }
        }

        tokio::task::yield_now().await;
    }

    /// Record a failure, potentially triggering rollback.
    pub async fn record_failure(&self, engine: Engine, latency: Duration) {
        let (should_rollback, failures) = {
            let mut entry = self.health.entry(engine).or_default();
            entry.consecutive_failures += 1;
            entry.total_requests += 1;
            entry.total_latency_ms += latency.as_millis();
            entry.last_failure = Some(Instant::now());

            let should_rollback = entry.consecutive_failures >= self.failure_threshold;
            if should_rollback {
                entry.quarantined_until = Some(Instant::now() + self.quarantine_duration);
                warn!(
                    ?engine,
                    failures = entry.consecutive_failures,
                    "Engine quarantined"
                );
            }
            (should_rollback, entry.consecutive_failures)
        };

        if should_rollback {
            self.rollback_from(engine);
        } else {
            info!(
                ?engine,
                failures, "Failure recorded but threshold not reached"
            );
        }

        tokio::task::yield_now().await;
    }

    /// Roll back from a failing engine to the next-best healthy one.
    ///
    /// Per §15, this MUST complete within 30 seconds of the 3rd failure.
    fn rollback_from(&self, failing: Engine) {
        let rollback_start = Instant::now();

        let now = Instant::now();
        let new_preferred = ENGINE_ROLLBACK_PRIORITY
            .iter()
            .copied()
            .filter(|&e| e != failing)
            .find(|&e| {
                self.health
                    .get(&e)
                    .is_none_or(|entry| !entry.is_quarantined(now))
            });

        if let Some(engine) = new_preferred {
            *self.preferred.write() = Some(engine);
            let elapsed = rollback_start.elapsed();
            info!(
                from = ?failing,
                to = ?engine,
                elapsed_ms = elapsed.as_millis(),
                "RollbackGuard: engine rolled over"
            );
            assert!(
                elapsed < Duration::from_secs(30),
                "Constitution §15 violation: rollback took {elapsed:?}"
            );
        } else {
            warn!(?failing, "RollbackGuard: no healthy engine available!");
        }
    }
}

impl Default for RollbackGuard {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sla_durations() {
        assert_eq!(SlaCategory::TextToImage.max_duration().as_secs(), 60);
        assert_eq!(SlaCategory::ImageTo3D.max_duration().as_secs(), 90);
        assert_eq!(SlaCategory::TextTo3D.max_duration().as_secs(), 180);
        assert_eq!(SlaCategory::ComplianceReview.max_duration().as_secs(), 180);
    }

    #[tokio::test]
    async fn rollback_triggers_after_threshold() {
        let guard = RollbackGuard::new();

        guard
            .record_success(Engine::VLlm, Duration::from_millis(100))
            .await;
        assert_eq!(guard.preferred_engine(), Some(Engine::VLlm));

        guard
            .record_failure(Engine::VLlm, Duration::from_secs(70))
            .await;
        guard
            .record_failure(Engine::VLlm, Duration::from_secs(70))
            .await;
        assert_eq!(guard.preferred_engine(), Some(Engine::VLlm)); // not yet

        guard
            .record_failure(Engine::VLlm, Duration::from_secs(70))
            .await;
        // After 3 consecutive failures, preferred should change
        assert_ne!(guard.preferred_engine(), Some(Engine::VLlm));
    }
}
