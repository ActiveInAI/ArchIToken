//! Error types for the Harness.
//!
//! All errors implement `thiserror::Error` and are `Send + Sync + 'static`.

use crate::inference::Engine;

/// Crate-wide `Result`.
pub type Result<T> = std::result::Result<T, HarnessError>;

/// Top-level error.
#[derive(Debug, thiserror::Error)]
pub enum HarnessError {
    /// The requested inference engine has no registered adapter.
    #[error("no adapter registered for engine {0:?}")]
    NoAdapter(Engine),

    /// The model id is malformed.
    #[error("invalid model id: {0:?}")]
    InvalidModelId(String),

    /// The model id is not on the Constitution §10 whitelist.
    #[error("model {0:?} is not on the approved whitelist (Constitution §10)")]
    ModelNotWhitelisted(String),

    /// SLA violated (Constitution §8).
    #[error("SLA violation: category={category:?} elapsed={elapsed_ms}ms limit={limit_ms}ms")]
    SlaViolation {
        /// Category whose SLA was breached.
        category: &'static str,
        /// Observed duration in milliseconds.
        elapsed_ms: u128,
        /// Configured limit in milliseconds.
        limit_ms: u128,
    },

    /// Authentication or authorization failed.
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    /// Input validation failed.
    #[error("invalid input: {0}")]
    InvalidInput(String),

    /// Requested resource was not found.
    #[error("not found: {0}")]
    NotFound(String),

    /// Tenant isolation violation (Constitution §16).
    #[error("tenant isolation violation: {0}")]
    TenantIsolation(String),

    /// Forbidden license detected at runtime (Constitution §3).
    #[error("license violation: crate {0:?} has a forbidden license")]
    LicenseViolation(String),

    /// Tool execution denied by sandbox.
    #[error("sandbox denied: {0}")]
    SandboxDenied(String),

    /// Upstream inference engine error.
    #[error("upstream inference error: {0}")]
    Upstream(String),

    /// HTTP client failure.
    #[error(transparent)]
    Http(#[from] reqwest::Error),

    /// JSON (de)serialization failure.
    #[error(transparent)]
    Json(#[from] serde_json::Error),

    /// Database failure.
    #[error(transparent)]
    Database(#[from] sea_orm::DbErr),

    /// IO failure.
    #[error(transparent)]
    Io(#[from] std::io::Error),

    /// Configuration failure.
    #[error(transparent)]
    Config(#[from] config::ConfigError),

    /// Unexpected internal failure.
    #[error("internal: {0}")]
    Internal(String),
}

impl HarnessError {
    /// Map a [`HarnessError`] to a numeric HTTP status for API responses.
    #[must_use]
    pub const fn http_status(&self) -> u16 {
        match self {
            Self::Unauthorized(_) => 401,
            Self::NotFound(_) => 404,
            Self::TenantIsolation(_) | Self::SandboxDenied(_) => 403,
            Self::NoAdapter(_) => 503,
            Self::InvalidInput(_) | Self::InvalidModelId(_) => 400,
            Self::ModelNotWhitelisted(_) => 422,
            Self::SlaViolation { .. } => 504,
            _ => 500,
        }
    }
}

impl axum::response::IntoResponse for HarnessError {
    fn into_response(self) -> axum::response::Response {
        let status = axum::http::StatusCode::from_u16(self.http_status())
            .unwrap_or(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        let body = serde_json::json!({
            "error": self.to_string(),
            "code": status.as_u16(),
        });
        (status, axum::Json(body)).into_response()
    }
}
