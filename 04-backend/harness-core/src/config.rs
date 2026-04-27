//! Configuration loading with `config` + `serde` + `dotenvy`.
//!
//! Precedence (high → low): env vars (prefix `INSOMEOS_`) → `config/local.toml`
//! → `config/{env}.toml` → `config/default.toml`.

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::inference::Engine;

/// Root configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// HTTP server settings.
    pub server: ServerConfig,
    /// Database (Supabase `PostgreSQL`) settings.
    pub database: DatabaseConfig,
    /// Valkey 9.0.3 cache settings.
    pub cache: CacheConfig,
    /// Inference engine registry and default.
    pub inference: InferenceConfig,
    /// Observability (OpenTelemetry).
    pub observability: ObservabilityConfig,
    /// Permissions / authentication.
    pub auth: AuthConfig,
}

/// HTTP server configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// Bind host or interface.
    pub host: String,
    /// TCP port for the API server.
    pub port: u16,
    /// Request timeout in seconds.
    pub request_timeout_secs: u64,
    /// Maximum request body size in MiB.
    pub max_body_mb: u64,
    /// Allowed `CORS` origins.
    pub cors_origins: Vec<String>,
}

/// Database pool and connection configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// Full Postgres URL (e.g., `postgres://user:pass@host:5432/insomeos`).
    pub url: String,
    /// Maximum open database connections.
    pub max_connections: u32,
    /// Minimum idle database connections.
    pub min_connections: u32,
    /// Connection timeout in seconds.
    pub connect_timeout_secs: u64,
}

/// Cache connection pool configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Cache service URL.
    pub url: String,
    /// Maximum cache pool size.
    pub pool_size: u32,
}

/// Inference engine registry configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    /// Default engine for model calls without an explicit route.
    pub default_engine: Engine,
    /// Registered inference engine endpoints.
    pub engines: Vec<EngineConfig>,
    /// Constitution §10 — only models on this list may be used.
    pub whitelisted_models: Vec<String>,
}

/// One inference engine endpoint configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    /// Engine identifier.
    pub engine: Engine,
    /// OpenAI-compatible base URL.
    pub base_url: String,
    /// Environment variable containing the engine API key.
    pub api_key_env: Option<String>,
    /// Engine request timeout in seconds.
    pub timeout_secs: u64,
}

/// Observability export and logging configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservabilityConfig {
    /// `OTLP` collector endpoint.
    pub otlp_endpoint: String,
    /// Service name attached to traces and metrics.
    pub service_name: String,
    /// Log level filter.
    pub log_level: String,
    /// Prometheus scrape port.
    pub prometheus_port: u16,
}

/// Authentication and token validation configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Shared secret used to validate `JWT` signatures.
    pub jwt_secret: String,
    /// Expected token issuer.
    pub jwt_issuer: String,
    /// Token lifetime in seconds.
    pub jwt_expiry_secs: u64,
}

impl AppConfig {
    /// Load configuration, honoring `INSOMEOS_PROFILE` (default: `development`).
    ///
    /// # Errors
    /// Returns a config error if files cannot be read or values are missing.
    pub fn load() -> Result<Self> {
        let _ = dotenvy::dotenv();

        let profile =
            std::env::var("INSOMEOS_PROFILE").unwrap_or_else(|_| "development".to_string());

        let cfg = config::Config::builder()
            .add_source(config::File::with_name("config/default").required(false))
            .add_source(config::File::with_name(&format!("config/{profile}")).required(false))
            .add_source(config::File::with_name("config/local").required(false))
            .add_source(
                config::Environment::with_prefix("INSOMEOS")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?;

        let app_cfg: Self = cfg.try_deserialize()?;
        Ok(app_cfg)
    }

    /// Verify that all whitelisted models conform to Constitution §10.
    ///
    /// # Errors
    /// Returns if the list is empty or contains empty strings.
    pub fn validate(&self) -> Result<()> {
        if self.inference.whitelisted_models.is_empty() {
            return Err(crate::error::HarnessError::Internal(
                "whitelisted_models cannot be empty (Constitution §10)".into(),
            ));
        }
        for m in &self.inference.whitelisted_models {
            if m.trim().is_empty() {
                return Err(crate::error::HarnessError::Internal(
                    "whitelisted_models contains empty entry".into(),
                ));
            }
        }
        Ok(())
    }
}
