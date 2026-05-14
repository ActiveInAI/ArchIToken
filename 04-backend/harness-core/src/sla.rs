//! SLA enforcement helpers.
//!
//! Wraps an async operation with the Constitution §8 timeout, emits
//! metrics, and returns [`HarnessError::SlaViolation`] on breach.

use std::future::Future;
use std::time::Instant;
use tracing::warn;

use crate::error::{HarnessError, Result};
use crate::rollback_guard::SlaCategory;

/// Run `op` under the SLA budget for `category`.
///
/// # Errors
/// Returns [`HarnessError::SlaViolation`] if the operation exceeds the
/// category's maximum duration. Inner errors are propagated.
pub async fn enforce<F, T>(category: SlaCategory, label: &'static str, op: F) -> Result<T>
where
    F: Future<Output = Result<T>>,
{
    let start = Instant::now();
    let limit = category.max_duration();

    let result = tokio::time::timeout(limit.saturating_mul(2), op)
        .await
        .map_err(|_| HarnessError::SlaViolation {
            category: label,
            elapsed_ms: start.elapsed().as_millis(),
            limit_ms: limit.as_millis(),
        })??;

    let elapsed = start.elapsed();
    if elapsed > limit {
        warn!(
            category = label,
            elapsed_ms = elapsed.as_millis(),
            limit_ms = limit.as_millis(),
            "SLA breached (soft)"
        );
        return Err(HarnessError::SlaViolation {
            category: label,
            elapsed_ms: elapsed.as_millis(),
            limit_ms: limit.as_millis(),
        });
    }

    metrics::histogram!("architoken_sla_latency_seconds", "category" => label)
        .record(elapsed.as_secs_f64());

    Ok(result)
}
