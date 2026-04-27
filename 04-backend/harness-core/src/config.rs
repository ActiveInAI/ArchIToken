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
    /// Database (Supabase PostgreSQL) settings.
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub request_timeout_secs: u64,
    pub max_body_mb: u64,
    pub cors_origins: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// Full Postgres URL (e.g., `postgres://user:pass@host:5432/insomeos`).
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub url: String,
    pub pool_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    pub default_engine: Engine,
    pub engines: Vec<EngineConfig>,
    /// Constitution §10 — only models on this list may be used.
    pub whitelisted_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub engine: Engine,
    pub base_url: String,
    pub api_key_env: Option<String>,
    pub timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservabilityConfig {
    pub otlp_endpoint: String,
    pub service_name: String,
    pub log_level: String,
    pub prometheus_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_issuer: String,
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
