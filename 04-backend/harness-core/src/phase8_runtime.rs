//! Phase 8 production-readiness contracts.
//!
//! This module deliberately keeps the first-day 100k-user gates testable
//! without introducing a real external database/object-store/event-bus client.

use std::{
    collections::HashMap,
    fmt::Write as _,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

use crate::{
    db::RuntimeDatabaseConfig,
    error::{HarnessError, Result},
    runtime_context::RuntimeProfile,
};

const ENV_MAX_REQUEST_BODY_BYTES: &str = "ARCHITOKEN_PHASE8_MAX_REQUEST_BODY_BYTES";
const ENV_MAX_UPLOAD_BYTES: &str = "ARCHITOKEN_PHASE8_MAX_UPLOAD_BYTES";
const ENV_API_RPS_LIMIT: &str = "ARCHITOKEN_PHASE8_API_RPS_LIMIT";
const ENV_TENANT_RPS_LIMIT: &str = "ARCHITOKEN_PHASE8_TENANT_RPS_LIMIT";
const ENV_ACTOR_RPS_LIMIT: &str = "ARCHITOKEN_PHASE8_ACTOR_RPS_LIMIT";
const ENV_MAX_CONCURRENT_UPLOADS_PER_TENANT: &str =
    "ARCHITOKEN_PHASE8_MAX_CONCURRENT_UPLOADS_PER_TENANT";
const ENV_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT: &str =
    "ARCHITOKEN_PHASE8_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT";
const ENV_DB_POOL_MAX_CONNECTIONS: &str = "ARCHITOKEN_PHASE8_DB_POOL_MAX_CONNECTIONS";
const ENV_PGBOUNCER_REQUIRED: &str = "ARCHITOKEN_PHASE8_PGBOUNCER_REQUIRED";
const ENV_OBJECT_STORE_REQUIRED: &str = "ARCHITOKEN_PHASE8_OBJECT_STORE_REQUIRED";
const ENV_OTEL_REQUIRED: &str = "ARCHITOKEN_PHASE8_OTEL_REQUIRED";

const DEFAULT_MAX_REQUEST_BODY_BYTES: u64 = 16 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_BYTES: u64 = 5 * 1024 * 1024 * 1024;
const DEFAULT_API_RPS_LIMIT: u64 = 10_000;
const DEFAULT_TENANT_RPS_LIMIT: u64 = 1_000;
const DEFAULT_ACTOR_RPS_LIMIT: u64 = 100;
const DEFAULT_MAX_CONCURRENT_UPLOADS_PER_TENANT: u32 = 32;
const DEFAULT_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT: u32 = 16;
const DEFAULT_DB_POOL_MAX_CONNECTIONS: u32 = 32;

/// Phase 8 production scale guardrail configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Phase8RuntimeConfig {
    /// Maximum accepted HTTP request body size.
    pub max_request_body_bytes: u64,
    /// Maximum object upload size accepted by the control-plane contract.
    pub max_upload_bytes: u64,
    /// Global API request-per-second guard.
    pub api_rps_limit: u64,
    /// Per-tenant request-per-second guard.
    pub tenant_rps_limit: u64,
    /// Per-actor request-per-second guard.
    pub actor_rps_limit: u64,
    /// Maximum concurrent uploads per tenant.
    pub max_concurrent_uploads_per_tenant: u32,
    /// Maximum concurrent conversion jobs per tenant.
    pub max_concurrent_conversion_jobs_per_tenant: u32,
    /// Maximum database pool connections configured for the gateway process.
    pub db_pool_max_connections: u32,
    /// Whether production requires a `PgBouncer` boundary.
    pub pgbouncer_required: bool,
    /// Whether production requires an object-store boundary.
    pub object_store_required: bool,
    /// Whether production requires telemetry export configuration.
    pub otel_required: bool,
}

impl Phase8RuntimeConfig {
    /// Build Phase 8 config from environment variables.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when production-like profiles are
    /// missing required scale or dependency configuration.
    pub fn from_env(
        profile: RuntimeProfile,
        database_config: &RuntimeDatabaseConfig,
    ) -> Result<Self> {
        Self::from_lookup(profile, database_config, |key| std::env::var(key).ok())
    }

    /// Development defaults for local preview.
    #[must_use]
    pub const fn development_defaults() -> Self {
        Self {
            max_request_body_bytes: DEFAULT_MAX_REQUEST_BODY_BYTES,
            max_upload_bytes: DEFAULT_MAX_UPLOAD_BYTES,
            api_rps_limit: DEFAULT_API_RPS_LIMIT,
            tenant_rps_limit: DEFAULT_TENANT_RPS_LIMIT,
            actor_rps_limit: DEFAULT_ACTOR_RPS_LIMIT,
            max_concurrent_uploads_per_tenant: DEFAULT_MAX_CONCURRENT_UPLOADS_PER_TENANT,
            max_concurrent_conversion_jobs_per_tenant:
                DEFAULT_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT,
            db_pool_max_connections: DEFAULT_DB_POOL_MAX_CONNECTIONS,
            pgbouncer_required: false,
            object_store_required: false,
            otel_required: false,
        }
    }

    /// Whether the runtime rate-limit guard is enabled.
    #[must_use]
    pub const fn rate_limit_enabled(&self) -> bool {
        self.api_rps_limit > 0 && self.tenant_rps_limit > 0 && self.actor_rps_limit > 0
    }

    /// Build Phase 8 config from key/value pairs. This is intended for tests.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] on missing or invalid production
    /// scale configuration.
    pub fn from_pairs(
        profile: RuntimeProfile,
        database_config: &RuntimeDatabaseConfig,
        pairs: &[(&str, &str)],
    ) -> Result<Self> {
        Self::from_lookup(profile, database_config, |key| {
            pairs
                .iter()
                .find_map(|(candidate, value)| (*candidate == key).then(|| (*value).to_owned()))
        })
    }

    fn from_lookup<F>(
        profile: RuntimeProfile,
        database_config: &RuntimeDatabaseConfig,
        lookup: F,
    ) -> Result<Self>
    where
        F: Fn(&str) -> Option<String>,
    {
        let production = matches!(profile, RuntimeProfile::Production);
        let defaults = Self::development_defaults();
        let config = Self {
            max_request_body_bytes: parse_u64(
                &lookup,
                ENV_MAX_REQUEST_BODY_BYTES,
                defaults.max_request_body_bytes,
                production,
            )?,
            max_upload_bytes: parse_u64(
                &lookup,
                ENV_MAX_UPLOAD_BYTES,
                defaults.max_upload_bytes,
                production,
            )?,
            api_rps_limit: parse_u64(
                &lookup,
                ENV_API_RPS_LIMIT,
                defaults.api_rps_limit,
                production,
            )?,
            tenant_rps_limit: parse_u64(
                &lookup,
                ENV_TENANT_RPS_LIMIT,
                defaults.tenant_rps_limit,
                production,
            )?,
            actor_rps_limit: parse_u64(
                &lookup,
                ENV_ACTOR_RPS_LIMIT,
                defaults.actor_rps_limit,
                production,
            )?,
            max_concurrent_uploads_per_tenant: parse_u32(
                &lookup,
                ENV_MAX_CONCURRENT_UPLOADS_PER_TENANT,
                defaults.max_concurrent_uploads_per_tenant,
                production,
            )?,
            max_concurrent_conversion_jobs_per_tenant: parse_u32(
                &lookup,
                ENV_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT,
                defaults.max_concurrent_conversion_jobs_per_tenant,
                production,
            )?,
            db_pool_max_connections: parse_u32(
                &lookup,
                ENV_DB_POOL_MAX_CONNECTIONS,
                defaults.db_pool_max_connections,
                production,
            )?,
            pgbouncer_required: parse_bool(
                &lookup,
                ENV_PGBOUNCER_REQUIRED,
                defaults.pgbouncer_required,
                production,
            )?,
            object_store_required: parse_bool(
                &lookup,
                ENV_OBJECT_STORE_REQUIRED,
                defaults.object_store_required,
                production,
            )?,
            otel_required: parse_bool(
                &lookup,
                ENV_OTEL_REQUIRED,
                defaults.otel_required,
                production,
            )?,
        };
        config.validate(profile, database_config, &lookup)?;
        Ok(config)
    }

    fn validate<F>(
        &self,
        profile: RuntimeProfile,
        database_config: &RuntimeDatabaseConfig,
        lookup: &F,
    ) -> Result<()>
    where
        F: Fn(&str) -> Option<String>,
    {
        for (field, value) in [
            ("max_request_body_bytes", self.max_request_body_bytes),
            ("max_upload_bytes", self.max_upload_bytes),
            ("api_rps_limit", self.api_rps_limit),
            ("tenant_rps_limit", self.tenant_rps_limit),
            ("actor_rps_limit", self.actor_rps_limit),
        ] {
            if value == 0 {
                return Err(HarnessError::InvalidInput(format!(
                    "Phase 8 scale config {field} must be greater than zero"
                )));
            }
        }
        for (field, value) in [
            (
                "max_concurrent_uploads_per_tenant",
                self.max_concurrent_uploads_per_tenant,
            ),
            (
                "max_concurrent_conversion_jobs_per_tenant",
                self.max_concurrent_conversion_jobs_per_tenant,
            ),
            ("db_pool_max_connections", self.db_pool_max_connections),
        ] {
            if value == 0 {
                return Err(HarnessError::InvalidInput(format!(
                    "Phase 8 scale config {field} must be greater than zero"
                )));
            }
        }
        if self.max_request_body_bytes > self.max_upload_bytes {
            return Err(HarnessError::InvalidInput(
                "Phase 8 max_request_body_bytes must not exceed max_upload_bytes".to_owned(),
            ));
        }

        if !matches!(profile, RuntimeProfile::Production) {
            return Ok(());
        }
        if database_config.uses_in_memory_fallback() {
            return Err(HarnessError::InvalidInput(
                "Phase 8 production readiness rejects in-memory database fallback".to_owned(),
            ));
        }
        if !self.pgbouncer_required {
            return Err(HarnessError::InvalidInput(
                "ARCHITOKEN_PHASE8_PGBOUNCER_REQUIRED=true is required for production".to_owned(),
            ));
        }
        if !self.object_store_required {
            return Err(HarnessError::InvalidInput(
                "ARCHITOKEN_PHASE8_OBJECT_STORE_REQUIRED=true is required for production"
                    .to_owned(),
            ));
        }
        if !self.otel_required {
            return Err(HarnessError::InvalidInput(
                "ARCHITOKEN_PHASE8_OTEL_REQUIRED=true is required for production".to_owned(),
            ));
        }
        let readiness = Phase8DependencyReadiness::from_lookup(database_config, lookup);
        if !readiness.object_store_configured {
            return Err(HarnessError::InvalidInput(
                "Phase 8 production readiness requires S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET".to_owned(),
            ));
        }
        if !readiness.queue_configured {
            return Err(HarnessError::InvalidInput(
                "Phase 8 production readiness requires NATS_URL and TEMPORAL_ADDRESS".to_owned(),
            ));
        }
        if !readiness.telemetry_configured {
            return Err(HarnessError::InvalidInput(
                "Phase 8 production readiness requires OTEL_EXPORTER_OTLP_ENDPOINT or ARCHITOKEN_OBSERVABILITY__OTLP_ENDPOINT".to_owned(),
            ));
        }
        Ok(())
    }
}

/// External dependency readiness reported by `/readyz`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct Phase8DependencyReadiness {
    /// Whether a durable database URL is configured.
    pub database_configured: bool,
    /// Whether S3-compatible object-store configuration is present.
    pub object_store_configured: bool,
    /// Whether queue/workflow endpoints are configured.
    pub queue_configured: bool,
    /// Whether telemetry export configuration is present.
    pub telemetry_configured: bool,
}

impl Phase8DependencyReadiness {
    /// Build dependency readiness from process environment.
    #[must_use]
    pub fn from_env(database_config: &RuntimeDatabaseConfig) -> Self {
        Self::from_lookup(database_config, |key| std::env::var(key).ok())
    }

    /// Build dependency readiness from a lookup callback.
    #[must_use]
    pub fn from_lookup<F>(database_config: &RuntimeDatabaseConfig, lookup: F) -> Self
    where
        F: Fn(&str) -> Option<String>,
    {
        Self {
            database_configured: !database_config.uses_in_memory_fallback(),
            object_store_configured: all_present(
                &lookup,
                &["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"],
            ),
            queue_configured: all_present(&lookup, &["NATS_URL", "TEMPORAL_ADDRESS"]),
            telemetry_configured: any_present(
                &lookup,
                &[
                    "OTEL_EXPORTER_OTLP_ENDPOINT",
                    "ARCHITOKEN_OBSERVABILITY__OTLP_ENDPOINT",
                ],
            ),
        }
    }
}

/// JSON readiness contract returned by `/readyz`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct Phase8ReadinessResponse {
    /// Overall readiness status.
    pub status: String,
    /// Active runtime profile.
    pub runtime_profile: String,
    /// Active persistence mode.
    pub persistence_mode: String,
    /// Database mode shortcut for certification tooling.
    pub database_mode: String,
    /// Object-store mode.
    pub object_store_mode: String,
    /// Whether the API rate-limit guard is enabled.
    pub rate_limit_enabled: bool,
    /// Configured maximum request body size.
    pub max_request_body_bytes: u64,
    /// Tenant context policy.
    pub tenant_context_policy: String,
    /// Build or git SHA when provided by release environment.
    pub build_git_sha: String,
    /// Whether the durable database boundary is configured.
    pub database_configured: bool,
    /// Whether the object-store boundary is configured.
    pub object_store_configured: bool,
    /// Whether queue/workflow endpoints are configured.
    pub queue_configured: bool,
    /// Whether telemetry export is configured.
    pub telemetry_configured: bool,
    /// Whether `PgBouncer` is required by config.
    pub pgbouncer_required: bool,
    /// Whether object storage is required by config.
    pub object_store_required: bool,
    /// Whether telemetry is required by config.
    pub otel_required: bool,
}

impl Phase8ReadinessResponse {
    /// Build a readiness response from the active runtime state.
    #[must_use]
    pub fn new(
        profile: RuntimeProfile,
        database_config: &RuntimeDatabaseConfig,
        scale_config: &Phase8RuntimeConfig,
        dependencies: &Phase8DependencyReadiness,
    ) -> Self {
        Self::new_with_build_git_sha(
            profile,
            database_config,
            scale_config,
            dependencies,
            build_git_sha_from_env(),
        )
    }

    /// Build a readiness response with an explicit build SHA.
    #[must_use]
    pub fn new_with_build_git_sha(
        profile: RuntimeProfile,
        database_config: &RuntimeDatabaseConfig,
        scale_config: &Phase8RuntimeConfig,
        dependencies: &Phase8DependencyReadiness,
        build_git_sha: String,
    ) -> Self {
        let dependency_ready = dependencies.database_configured
            && (!scale_config.object_store_required || dependencies.object_store_configured)
            && (!scale_config.otel_required || dependencies.telemetry_configured)
            && dependencies.queue_configured;
        let ready = dependency_ready
            || matches!(profile, RuntimeProfile::Development)
                && database_config.uses_in_memory_fallback();
        let persistence_mode = database_config.mode.as_str().to_owned();
        Self {
            status: if ready { "ready" } else { "degraded" }.to_owned(),
            runtime_profile: profile.as_str().to_owned(),
            persistence_mode: persistence_mode.clone(),
            database_mode: persistence_mode,
            object_store_mode: if dependencies.object_store_configured {
                "s3_configured".to_owned()
            } else {
                "unconfigured".to_owned()
            },
            rate_limit_enabled: scale_config.rate_limit_enabled(),
            max_request_body_bytes: scale_config.max_request_body_bytes,
            tenant_context_policy: if profile.allows_weak_fallback() {
                "development_fallback_allowed".to_owned()
            } else {
                "explicit_tenant_project_actor_required".to_owned()
            },
            build_git_sha,
            database_configured: dependencies.database_configured,
            object_store_configured: dependencies.object_store_configured,
            queue_configured: dependencies.queue_configured,
            telemetry_configured: dependencies.telemetry_configured,
            pgbouncer_required: scale_config.pgbouncer_required,
            object_store_required: scale_config.object_store_required,
            otel_required: scale_config.otel_required,
        }
    }
}

fn build_git_sha_from_env() -> String {
    for key in ["ARCHITOKEN_GIT_SHA", "GIT_SHA", "VERGEN_GIT_SHA"] {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return trimmed.to_owned();
            }
        }
    }
    option_env!("GIT_HASH")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("unknown")
        .to_owned()
}

/// Rate-limit subject derived from request context headers/query.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RateLimitSubject {
    /// Tenant identifier or a stable anonymous fallback.
    pub tenant_id: String,
    /// Actor identifier or a stable anonymous fallback.
    pub actor: String,
}

impl RateLimitSubject {
    /// Build a rate-limit subject from optional request fields.
    #[must_use]
    pub fn new(tenant_id: Option<&str>, actor: Option<&str>) -> Self {
        Self {
            tenant_id: non_empty_or(tenant_id, "anonymous-tenant"),
            actor: non_empty_or(actor, "anonymous-actor"),
        }
    }
}

/// In-memory rate-limit skeleton for the gateway control plane.
#[derive(Debug, Default)]
pub struct InMemoryRateLimiter {
    windows: Mutex<HashMap<String, RateWindow>>,
}

impl InMemoryRateLimiter {
    /// Check and record one request against global, tenant, and actor limits.
    ///
    /// # Errors
    /// Returns [`HarnessError::RateLimited`] when any configured limit is exceeded.
    pub fn check(
        &self,
        config: &Phase8RuntimeConfig,
        subject: &RateLimitSubject,
        now_epoch_second: u64,
    ) -> Result<()> {
        let mut windows = self
            .windows
            .lock()
            .map_err(|_| HarnessError::Internal("rate limiter lock poisoned".to_owned()))?;
        check_window(
            &mut windows,
            "api:*",
            config.api_rps_limit,
            now_epoch_second,
        )?;
        check_window(
            &mut windows,
            &format!("tenant:{}", subject.tenant_id),
            config.tenant_rps_limit,
            now_epoch_second,
        )?;
        check_window(
            &mut windows,
            &format!("actor:{}:{}", subject.tenant_id, subject.actor),
            config.actor_rps_limit,
            now_epoch_second,
        )?;
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
struct RateWindow {
    second: u64,
    count: u64,
}

fn check_window(
    windows: &mut HashMap<String, RateWindow>,
    key: &str,
    limit: u64,
    second: u64,
) -> Result<()> {
    let window = windows
        .entry(key.to_owned())
        .or_insert(RateWindow { second, count: 0 });
    if window.second != second {
        *window = RateWindow { second, count: 0 };
    }
    if window.count >= limit {
        return Err(HarnessError::RateLimited(format!(
            "Phase 8 rate limit exceeded for {key}"
        )));
    }
    window.count += 1;
    Ok(())
}

/// Lightweight gateway metrics contract.
#[derive(Debug)]
pub struct Phase8Metrics {
    request_count: AtomicU64,
    error_count: AtomicU64,
    active_requests: AtomicU64,
    asset_upload_count: AtomicU64,
    conversion_job_count: AtomicU64,
    runtime_execution_count: AtomicU64,
    latency_le_100ms: AtomicU64,
    latency_le_300ms: AtomicU64,
    latency_le_800ms: AtomicU64,
    latency_le_1500ms: AtomicU64,
    latency_le_5000ms: AtomicU64,
    latency_inf: AtomicU64,
}

impl Default for Phase8Metrics {
    fn default() -> Self {
        Self::new()
    }
}

impl Phase8Metrics {
    /// Create an empty metrics registry.
    #[must_use]
    pub const fn new() -> Self {
        Self {
            request_count: AtomicU64::new(0),
            error_count: AtomicU64::new(0),
            active_requests: AtomicU64::new(0),
            asset_upload_count: AtomicU64::new(0),
            conversion_job_count: AtomicU64::new(0),
            runtime_execution_count: AtomicU64::new(0),
            latency_le_100ms: AtomicU64::new(0),
            latency_le_300ms: AtomicU64::new(0),
            latency_le_800ms: AtomicU64::new(0),
            latency_le_1500ms: AtomicU64::new(0),
            latency_le_5000ms: AtomicU64::new(0),
            latency_inf: AtomicU64::new(0),
        }
    }

    /// Mark the beginning of a request.
    pub fn begin_request(&self) {
        self.active_requests.fetch_add(1, Ordering::Relaxed);
    }

    /// Mark the end of a request and record its status/latency.
    pub fn finish_request(&self, status_code: u16, elapsed: Duration) {
        self.active_requests.fetch_sub(1, Ordering::Relaxed);
        self.request_count.fetch_add(1, Ordering::Relaxed);
        if status_code >= 400 {
            self.error_count.fetch_add(1, Ordering::Relaxed);
        }
        let elapsed_ms = u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX);
        if elapsed_ms <= 100 {
            self.latency_le_100ms.fetch_add(1, Ordering::Relaxed);
        }
        if elapsed_ms <= 300 {
            self.latency_le_300ms.fetch_add(1, Ordering::Relaxed);
        }
        if elapsed_ms <= 800 {
            self.latency_le_800ms.fetch_add(1, Ordering::Relaxed);
        }
        if elapsed_ms <= 1_500 {
            self.latency_le_1500ms.fetch_add(1, Ordering::Relaxed);
        }
        if elapsed_ms <= 5_000 {
            self.latency_le_5000ms.fetch_add(1, Ordering::Relaxed);
        }
        self.latency_inf.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a completed asset upload binding.
    pub fn record_asset_upload(&self) {
        self.asset_upload_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a created conversion job.
    pub fn record_conversion_job(&self) {
        self.conversion_job_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a created runtime execution.
    pub fn record_runtime_execution(&self) {
        self.runtime_execution_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Return a point-in-time metrics snapshot.
    #[must_use]
    pub fn snapshot(&self) -> Phase8MetricsSnapshot {
        Phase8MetricsSnapshot {
            request_count: self.request_count.load(Ordering::Relaxed),
            error_count: self.error_count.load(Ordering::Relaxed),
            active_requests: self.active_requests.load(Ordering::Relaxed),
            asset_upload_count: self.asset_upload_count.load(Ordering::Relaxed),
            conversion_job_count: self.conversion_job_count.load(Ordering::Relaxed),
            runtime_execution_count: self.runtime_execution_count.load(Ordering::Relaxed),
            latency_buckets: vec![
                Phase8MetricBucket {
                    le: "0.1".to_owned(),
                    count: self.latency_le_100ms.load(Ordering::Relaxed),
                },
                Phase8MetricBucket {
                    le: "0.3".to_owned(),
                    count: self.latency_le_300ms.load(Ordering::Relaxed),
                },
                Phase8MetricBucket {
                    le: "0.8".to_owned(),
                    count: self.latency_le_800ms.load(Ordering::Relaxed),
                },
                Phase8MetricBucket {
                    le: "1.5".to_owned(),
                    count: self.latency_le_1500ms.load(Ordering::Relaxed),
                },
                Phase8MetricBucket {
                    le: "5".to_owned(),
                    count: self.latency_le_5000ms.load(Ordering::Relaxed),
                },
                Phase8MetricBucket {
                    le: "+Inf".to_owned(),
                    count: self.latency_inf.load(Ordering::Relaxed),
                },
            ],
        }
    }

    /// Render a minimal Prometheus text exposition.
    #[must_use]
    pub fn to_prometheus_text(&self) -> String {
        let snapshot = self.snapshot();
        let mut out = String::new();
        out.push_str("# HELP architoken_phase8_request_count Total HTTP requests observed by the Phase 8 gateway contract.\n");
        out.push_str("# TYPE architoken_phase8_request_count counter\n");
        let _ = writeln!(
            out,
            "architoken_phase8_request_count {}",
            snapshot.request_count
        );
        out.push_str(
            "# HELP architoken_phase8_error_count Total HTTP responses with status >= 400.\n",
        );
        out.push_str("# TYPE architoken_phase8_error_count counter\n");
        let _ = writeln!(
            out,
            "architoken_phase8_error_count {}",
            snapshot.error_count
        );
        out.push_str("# HELP architoken_phase8_active_requests Active in-flight HTTP requests.\n");
        out.push_str("# TYPE architoken_phase8_active_requests gauge\n");
        let _ = writeln!(
            out,
            "architoken_phase8_active_requests {}",
            snapshot.active_requests
        );
        for bucket in &snapshot.latency_buckets {
            let _ = writeln!(
                out,
                "architoken_phase8_request_latency_seconds_bucket{{le=\"{}\"}} {}",
                bucket.le, bucket.count
            );
        }
        let _ = writeln!(
            out,
            "architoken_phase8_asset_upload_count {}",
            snapshot.asset_upload_count
        );
        let _ = writeln!(
            out,
            "architoken_phase8_conversion_job_count {}\n",
            snapshot.conversion_job_count
        );
        let _ = writeln!(
            out,
            "architoken_phase8_runtime_execution_count {}\n",
            snapshot.runtime_execution_count
        );
        out
    }
}

/// Point-in-time metrics snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Phase8MetricsSnapshot {
    /// Total HTTP requests.
    pub request_count: u64,
    /// Total HTTP responses with status >= 400.
    pub error_count: u64,
    /// Active in-flight requests.
    pub active_requests: u64,
    /// Completed upload bindings.
    pub asset_upload_count: u64,
    /// Created conversion jobs.
    pub conversion_job_count: u64,
    /// Created runtime executions.
    pub runtime_execution_count: u64,
    /// Request latency cumulative buckets.
    pub latency_buckets: Vec<Phase8MetricBucket>,
}

/// Cumulative latency bucket.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Phase8MetricBucket {
    /// Prometheus-compatible upper bound label.
    pub le: String,
    /// Cumulative count.
    pub count: u64,
}

/// Return the current Unix epoch second.
#[must_use]
pub fn current_epoch_second() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

fn parse_u64<F>(lookup: &F, key: &str, default: u64, required: bool) -> Result<u64>
where
    F: Fn(&str) -> Option<String>,
{
    parse_number(lookup, key, default, required)
}

fn parse_u32<F>(lookup: &F, key: &str, default: u32, required: bool) -> Result<u32>
where
    F: Fn(&str) -> Option<String>,
{
    parse_number(lookup, key, default, required)
}

fn parse_number<T, F>(lookup: &F, key: &str, default: T, required: bool) -> Result<T>
where
    T: std::str::FromStr,
    F: Fn(&str) -> Option<String>,
{
    match lookup(key).map(|value| value.trim().to_owned()) {
        Some(value) if !value.is_empty() => value.parse().map_err(|_| {
            HarnessError::InvalidInput(format!("Phase 8 config {key} must be a positive number"))
        }),
        _ if required => Err(HarnessError::InvalidInput(format!(
            "Phase 8 production config {key} is required"
        ))),
        _ => Ok(default),
    }
}

fn parse_bool<F>(lookup: &F, key: &str, default: bool, required: bool) -> Result<bool>
where
    F: Fn(&str) -> Option<String>,
{
    match lookup(key).map(|value| value.trim().to_ascii_lowercase()) {
        Some(value) if matches!(value.as_str(), "true" | "1" | "yes" | "on") => Ok(true),
        Some(value) if matches!(value.as_str(), "false" | "0" | "no" | "off") => Ok(false),
        Some(_) => Err(HarnessError::InvalidInput(format!(
            "Phase 8 config {key} must be boolean"
        ))),
        None if required => Err(HarnessError::InvalidInput(format!(
            "Phase 8 production config {key} is required"
        ))),
        None => Ok(default),
    }
}

fn all_present<F>(lookup: &F, keys: &[&str]) -> bool
where
    F: Fn(&str) -> Option<String>,
{
    keys.iter().all(|key| has_non_empty(lookup, key))
}

fn any_present<F>(lookup: &F, keys: &[&str]) -> bool
where
    F: Fn(&str) -> Option<String>,
{
    keys.iter().any(|key| has_non_empty(lookup, key))
}

fn has_non_empty<F>(lookup: &F, key: &str) -> bool
where
    F: Fn(&str) -> Option<String>,
{
    lookup(key).is_some_and(|value| !value.trim().is_empty())
}

fn non_empty_or(value: Option<&str>, fallback: &str) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_owned()
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use crate::{
        db::RuntimeDatabaseConfig,
        error::HarnessError,
        phase8_runtime::{
            ENV_ACTOR_RPS_LIMIT, ENV_API_RPS_LIMIT, ENV_DB_POOL_MAX_CONNECTIONS,
            ENV_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT, ENV_MAX_CONCURRENT_UPLOADS_PER_TENANT,
            ENV_MAX_REQUEST_BODY_BYTES, ENV_MAX_UPLOAD_BYTES, ENV_OBJECT_STORE_REQUIRED,
            ENV_OTEL_REQUIRED, ENV_PGBOUNCER_REQUIRED, ENV_TENANT_RPS_LIMIT, InMemoryRateLimiter,
            Phase8DependencyReadiness, Phase8Metrics, Phase8ReadinessResponse, Phase8RuntimeConfig,
            RateLimitSubject,
        },
        runtime_context::RuntimeProfile,
    };

    fn durable_db() -> RuntimeDatabaseConfig {
        RuntimeDatabaseConfig::from_database_url(
            RuntimeProfile::Production,
            Some("postgres://architoken:architoken@pgbouncer/architoken".to_owned()),
        )
        .expect("durable db config")
    }

    fn production_pairs() -> Vec<(&'static str, &'static str)> {
        vec![
            (ENV_MAX_REQUEST_BODY_BYTES, "16777216"),
            (ENV_MAX_UPLOAD_BYTES, "5368709120"),
            (ENV_API_RPS_LIMIT, "10000"),
            (ENV_TENANT_RPS_LIMIT, "1000"),
            (ENV_ACTOR_RPS_LIMIT, "100"),
            (ENV_MAX_CONCURRENT_UPLOADS_PER_TENANT, "32"),
            (ENV_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT, "16"),
            (ENV_DB_POOL_MAX_CONNECTIONS, "64"),
            (ENV_PGBOUNCER_REQUIRED, "true"),
            (ENV_OBJECT_STORE_REQUIRED, "true"),
            (ENV_OTEL_REQUIRED, "true"),
            ("S3_ENDPOINT", "http://seaweed-s3:8333"),
            ("S3_ACCESS_KEY", "key"),
            ("S3_SECRET_KEY", "secret"),
            ("S3_BUCKET", "architoken-assets"),
            ("NATS_URL", "nats://nats:4222"),
            ("TEMPORAL_ADDRESS", "temporal:7233"),
            ("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317"),
        ]
    }

    #[test]
    fn development_phase8_config_allows_defaults() {
        let db = RuntimeDatabaseConfig::from_database_url(RuntimeProfile::Development, None)
            .expect("development memory fallback");
        let config = Phase8RuntimeConfig::from_pairs(RuntimeProfile::Development, &db, &[])
            .expect("development defaults");
        assert_eq!(config.max_request_body_bytes, 16 * 1024 * 1024);
        assert!(!config.object_store_required);
    }

    #[test]
    fn production_rejects_missing_scale_config() {
        let err = Phase8RuntimeConfig::from_pairs(RuntimeProfile::Production, &durable_db(), &[])
            .expect_err("production config must be explicit");
        assert_eq!(err.http_status(), 400);
    }

    #[test]
    fn production_rejects_in_memory_database_fallback() {
        let db = RuntimeDatabaseConfig::from_database_url(RuntimeProfile::Development, None)
            .expect("development memory fallback");
        let err =
            Phase8RuntimeConfig::from_pairs(RuntimeProfile::Production, &db, &production_pairs())
                .expect_err("production must reject memory fallback");
        assert!(err.to_string().contains("in-memory database fallback"));
    }

    #[test]
    fn production_rejects_missing_object_store() {
        let mut pairs = production_pairs();
        pairs.retain(|(key, _)| *key != "S3_ENDPOINT");
        let err =
            Phase8RuntimeConfig::from_pairs(RuntimeProfile::Production, &durable_db(), &pairs)
                .expect_err("production requires object store");
        assert!(err.to_string().contains("S3_ENDPOINT"));
    }

    #[test]
    fn production_accepts_complete_scale_config() {
        let config = Phase8RuntimeConfig::from_pairs(
            RuntimeProfile::Production,
            &durable_db(),
            &production_pairs(),
        )
        .expect("complete production config");
        assert!(config.pgbouncer_required);
        assert!(config.object_store_required);
        assert!(config.otel_required);
    }

    #[test]
    fn readiness_reports_dependency_state() {
        let config = Phase8RuntimeConfig::from_pairs(
            RuntimeProfile::Production,
            &durable_db(),
            &production_pairs(),
        )
        .expect("complete production config");
        let readiness = Phase8DependencyReadiness::from_lookup(&durable_db(), |key| {
            production_pairs()
                .iter()
                .find_map(|(candidate, value)| (*candidate == key).then(|| (*value).to_owned()))
        });
        let response = Phase8ReadinessResponse::new_with_build_git_sha(
            RuntimeProfile::Production,
            &durable_db(),
            &config,
            &readiness,
            "af7c9d0".to_owned(),
        );
        assert_eq!(response.status, "ready");
        assert_eq!(response.runtime_profile, "production");
        assert_eq!(response.persistence_mode, "durable_postgres");
        assert_eq!(response.database_mode, "durable_postgres");
        assert_eq!(response.object_store_mode, "s3_configured");
        assert!(response.rate_limit_enabled);
        assert_eq!(response.max_request_body_bytes, 16_777_216);
        assert_eq!(
            response.tenant_context_policy,
            "explicit_tenant_project_actor_required"
        );
        assert_eq!(response.build_git_sha, "af7c9d0");
        assert!(response.database_configured);
        assert!(response.object_store_configured);
        assert!(response.queue_configured);
        assert!(response.telemetry_configured);
    }

    #[test]
    fn production_readiness_degrades_when_required_dependency_is_missing() {
        let config = Phase8RuntimeConfig::from_pairs(
            RuntimeProfile::Production,
            &durable_db(),
            &production_pairs(),
        )
        .expect("complete production config");
        let readiness = Phase8DependencyReadiness {
            database_configured: true,
            object_store_configured: false,
            queue_configured: true,
            telemetry_configured: true,
        };
        let response = Phase8ReadinessResponse::new_with_build_git_sha(
            RuntimeProfile::Production,
            &durable_db(),
            &config,
            &readiness,
            "af7c9d0".to_owned(),
        );

        assert_eq!(response.status, "degraded");
        assert_eq!(response.object_store_mode, "unconfigured");
        assert!(response.object_store_required);
    }

    #[test]
    fn rate_limiter_returns_429_when_actor_limit_is_exceeded() {
        let config = Phase8RuntimeConfig {
            actor_rps_limit: 1,
            ..Phase8RuntimeConfig::development_defaults()
        };
        let limiter = InMemoryRateLimiter::default();
        let subject = RateLimitSubject::new(Some("tenant-a"), Some("actor-a"));
        limiter
            .check(&config, &subject, 42)
            .expect("first request allowed");
        let err = limiter
            .check(&config, &subject, 42)
            .expect_err("second request exceeds actor limit");
        assert!(matches!(err, HarnessError::RateLimited(_)));
        assert_eq!(err.http_status(), 429);
    }

    #[test]
    fn metrics_track_required_counters_and_buckets() {
        let metrics = Phase8Metrics::new();
        metrics.begin_request();
        metrics.finish_request(500, Duration::from_millis(250));
        metrics.record_asset_upload();
        metrics.record_conversion_job();
        metrics.record_runtime_execution();
        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.request_count, 1);
        assert_eq!(snapshot.error_count, 1);
        assert_eq!(snapshot.active_requests, 0);
        assert_eq!(snapshot.asset_upload_count, 1);
        assert_eq!(snapshot.conversion_job_count, 1);
        assert_eq!(snapshot.runtime_execution_count, 1);
        assert!(
            metrics
                .to_prometheus_text()
                .contains("architoken_phase8_request_latency_seconds_bucket")
        );
    }
}
