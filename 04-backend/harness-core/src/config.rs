//! Configuration loading with `config` + `serde` + `dotenvy`.
//!
//! Precedence (high → low): env vars (prefix `ARCHITOKEN_`) → `config/local.toml`
//! → `config/{env}.toml` → `config/default.toml`.

use serde::{Deserialize, Serialize};

use crate::error::{HarnessError, Result};
use crate::inference::Engine;
use crate::runtime_context::RuntimeProfile;

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
    /// Generation engine configuration.
    pub generation: GenerationConfig,
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
    /// Full Postgres URL (e.g., `postgres://user:pass@host:5432/architoken`).
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

/// AIGC generation engine configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationConfig {
    /// Generation provider.
    pub provider: GenerationProvider,
    /// External `TextToBim` HTTP endpoint.
    pub text_to_bim_url: Option<String>,
    /// External `TextToImage` HTTP endpoint.
    pub text_to_image_url: Option<String>,
    /// External `ImageToVideo` HTTP endpoint.
    pub image_to_video_url: Option<String>,
    /// Optional API key environment variable name.
    pub api_key_env: Option<String>,
    /// Request timeout in seconds.
    pub timeout_secs: u64,
}

/// Generation provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GenerationProvider {
    /// Use in-process deterministic adapter for development.
    LocalDeterministic,
    /// Use external HTTP `TextToBim` engine.
    HttpTextToBim,
    /// Use configured external HTTP engines for supported multimodal generation routes.
    HttpMultimodal,
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
    /// Load configuration, honoring `ARCHITOKEN_PROFILE` (default: `development`).
    ///
    /// # Errors
    /// Returns a config error if files cannot be read or values are missing.
    pub fn load() -> Result<Self> {
        let _ = dotenvy::dotenv();

        let profile =
            std::env::var("ARCHITOKEN_PROFILE").unwrap_or_else(|_| "development".to_string());

        let cfg = config::Config::builder()
            .add_source(config::File::with_name("config/default").required(false))
            .add_source(config::File::with_name(&format!("config/{profile}")).required(false))
            .add_source(config::File::with_name("config/local").required(false))
            .add_source(
                config::Environment::with_prefix("ARCHITOKEN")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?;

        let app_cfg: Self = match cfg.try_deserialize() {
            Ok(app_cfg) => app_cfg,
            Err(err) if allows_development_fallback(&profile) && is_missing_config_shape(&err) => {
                Self::development_preview()
            }
            Err(err) if !allows_development_fallback(&profile) => {
                return Err(crate::error::HarnessError::Internal(format!(
                    "configuration for ARCHITOKEN_PROFILE={profile:?} is incomplete: {err}; \
                     provide config/default.toml, config/{profile}.toml, config/local.toml, \
                     or ARCHITOKEN_* environment variables"
                )));
            }
            Err(err) => return Err(err.into()),
        };
        Ok(app_cfg)
    }

    /// Return a safe local development configuration.
    ///
    /// This is intentionally limited to development-like profiles and keeps all
    /// external adapters pointed at localhost development endpoints.
    #[must_use]
    pub fn development_preview() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_owned(),
                port: 8080,
                request_timeout_secs: 30,
                max_body_mb: 16,
                cors_origins: vec!["http://localhost:3000".to_owned()],
            },
            database: DatabaseConfig {
                url: "postgres://architoken:architoken@127.0.0.1:5432/architoken_dev".to_owned(),
                max_connections: 5,
                min_connections: 0,
                connect_timeout_secs: 5,
            },
            cache: CacheConfig {
                url: "redis://127.0.0.1:6379/0".to_owned(),
                pool_size: 4,
            },
            inference: InferenceConfig {
                default_engine: Engine::Ollama,
                engines: vec![
                    EngineConfig {
                        engine: Engine::Ollama,
                        base_url: "http://127.0.0.1:11434/v1".to_owned(),
                        api_key_env: None,
                        timeout_secs: 30,
                    },
                    EngineConfig {
                        engine: Engine::LmStudio,
                        base_url: "http://127.0.0.1:1234/v1".to_owned(),
                        api_key_env: None,
                        timeout_secs: 30,
                    },
                    EngineConfig {
                        engine: Engine::HuggingFace,
                        base_url: "http://127.0.0.1:8080/v1".to_owned(),
                        api_key_env: Some("HF_TOKEN".to_owned()),
                        timeout_secs: 60,
                    },
                ],
                whitelisted_models: vec![
                    "architoken-planner".to_owned(),
                    "architoken-generator".to_owned(),
                    "architoken-evaluator".to_owned(),
                    "architoken-local-generation-adapter-v1".to_owned(),
                ],
            },
            generation: GenerationConfig {
                provider: GenerationProvider::LocalDeterministic,
                text_to_bim_url: Some("http://127.0.0.1:7071/v1/generate/text-to-bim".to_owned()),
                text_to_image_url: Some(
                    "http://127.0.0.1:7071/v1/generate/text-to-image".to_owned(),
                ),
                image_to_video_url: Some(
                    "http://127.0.0.1:7071/v1/generate/image-to-video".to_owned(),
                ),
                api_key_env: None,
                timeout_secs: 120,
            },
            observability: ObservabilityConfig {
                otlp_endpoint: "http://127.0.0.1:4317".to_owned(),
                service_name: "architoken-gateway-dev".to_owned(),
                log_level: "info".to_owned(),
                prometheus_port: 9090,
            },
            auth: AuthConfig {
                jwt_secret: "development-only-not-for-production".to_owned(),
                jwt_issuer: "architoken-local-dev".to_owned(),
                jwt_expiry_secs: 86_400,
            },
        }
    }

    /// Verify that all whitelisted models conform to Constitution §10.
    ///
    /// # Errors
    /// Returns if the list is empty or contains empty strings.
    pub fn validate(&self) -> Result<()> {
        let profile = RuntimeProfile::from_profile_name(
            &std::env::var("ARCHITOKEN_PROFILE").unwrap_or_else(|_| "development".to_owned()),
        );
        self.validate_for_profile(profile)
    }

    /// Verify configuration against an explicit runtime profile.
    ///
    /// # Errors
    /// Returns if required production providers or secrets are missing.
    pub fn validate_for_profile(&self, profile: RuntimeProfile) -> Result<()> {
        if self.inference.whitelisted_models.is_empty() {
            return Err(HarnessError::Internal(
                "whitelisted_models cannot be empty (Constitution §10)".into(),
            ));
        }
        for m in &self.inference.whitelisted_models {
            if m.trim().is_empty() {
                return Err(HarnessError::Internal(
                    "whitelisted_models contains empty entry".into(),
                ));
            }
        }
        if matches!(profile, RuntimeProfile::Production) {
            if self.generation.provider == GenerationProvider::LocalDeterministic {
                return Err(HarnessError::InvalidInput(
                    "production profile requires a real generation provider; set ARCHITOKEN_GENERATION__PROVIDER=http_text_to_bim or http_multimodal and configure the matching generation URLs".to_owned(),
                ));
            }
            match self.generation.provider {
                GenerationProvider::LocalDeterministic => {}
                GenerationProvider::HttpTextToBim => {
                    require_generation_url(
                        self.generation.text_to_bim_url.as_deref(),
                        "ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL",
                    )?;
                }
                GenerationProvider::HttpMultimodal => {
                    require_any_generation_url(&[
                        (
                            self.generation.text_to_bim_url.as_deref(),
                            "ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL",
                        ),
                        (
                            self.generation.text_to_image_url.as_deref(),
                            "ARCHITOKEN_GENERATION__TEXT_TO_IMAGE_URL",
                        ),
                        (
                            self.generation.image_to_video_url.as_deref(),
                            "ARCHITOKEN_GENERATION__IMAGE_TO_VIDEO_URL",
                        ),
                    ])?;
                }
            }
            if self.auth.jwt_secret == "development-only-not-for-production" {
                return Err(HarnessError::InvalidInput(
                    "production profile rejects the development JWT secret".to_owned(),
                ));
            }
        }
        Ok(())
    }
}

fn require_generation_url(url: Option<&str>, env_key: &str) -> Result<()> {
    if url.is_some_and(|value| !value.trim().is_empty()) {
        return Ok(());
    }
    Err(HarnessError::InvalidInput(format!(
        "production profile requires {env_key}"
    )))
}

fn require_any_generation_url(routes: &[(Option<&str>, &str)]) -> Result<()> {
    if routes
        .iter()
        .any(|(url, _env_key)| url.is_some_and(|value| !value.trim().is_empty()))
    {
        return Ok(());
    }
    let env_keys = routes
        .iter()
        .map(|(_url, env_key)| *env_key)
        .collect::<Vec<_>>()
        .join(", ");
    Err(HarnessError::InvalidInput(format!(
        "production profile requires at least one configured multimodal generation URL: {env_keys}"
    )))
}

fn allows_development_fallback(profile: &str) -> bool {
    matches!(
        profile.trim().to_ascii_lowercase().as_str(),
        "development" | "dev" | "local" | "test"
    )
}

fn is_missing_config_shape(err: &config::ConfigError) -> bool {
    err.to_string().contains("missing field")
}

#[cfg(test)]
mod tests {
    use super::{
        AppConfig, GenerationProvider, allows_development_fallback, is_missing_config_shape,
    };
    use crate::runtime_context::RuntimeProfile;

    #[test]
    fn development_preview_config_is_valid() {
        let cfg = AppConfig::development_preview();
        assert_eq!(cfg.server.host, "127.0.0.1");
        assert_eq!(cfg.server.port, 8080);
        cfg.validate_for_profile(RuntimeProfile::Development)
            .expect("fallback whitelist must be valid");
    }

    #[test]
    fn development_fallback_is_not_allowed_for_production() {
        assert!(allows_development_fallback("development"));
        assert!(allows_development_fallback("local"));
        assert!(!allows_development_fallback("production"));
        assert!(!allows_development_fallback("staging"));
    }

    #[test]
    fn missing_field_error_is_recognized_for_dev_fallback() {
        let err = config::Config::builder()
            .build()
            .expect("empty config should build")
            .try_deserialize::<AppConfig>()
            .expect_err("empty config should miss required fields");
        assert!(is_missing_config_shape(&err));
    }

    #[test]
    fn production_rejects_local_generation_adapter() {
        let mut cfg = AppConfig::development_preview();
        cfg.auth.jwt_secret = "production-secret-with-enough-entropy".to_owned();
        let err = cfg
            .validate_for_profile(RuntimeProfile::Production)
            .expect_err("production must reject local generation adapter");
        assert!(err.to_string().contains("real generation provider"));
    }

    #[test]
    fn production_accepts_http_generation_provider() {
        let mut cfg = AppConfig::development_preview();
        cfg.generation.provider = GenerationProvider::HttpTextToBim;
        cfg.auth.jwt_secret = "production-secret-with-enough-entropy".to_owned();
        cfg.validate_for_profile(RuntimeProfile::Production)
            .expect("http provider is production-capable");
    }

    #[test]
    fn production_accepts_http_multimodal_generation_provider() {
        let mut cfg = AppConfig::development_preview();
        cfg.generation.provider = GenerationProvider::HttpMultimodal;
        cfg.auth.jwt_secret = "production-secret-with-enough-entropy".to_owned();
        cfg.validate_for_profile(RuntimeProfile::Production)
            .expect("http multimodal provider is production-capable");
    }

    #[test]
    fn production_rejects_http_multimodal_without_any_generation_url() {
        let mut cfg = AppConfig::development_preview();
        cfg.generation.provider = GenerationProvider::HttpMultimodal;
        cfg.generation.text_to_bim_url = None;
        cfg.generation.text_to_image_url = None;
        cfg.generation.image_to_video_url = None;
        cfg.auth.jwt_secret = "production-secret-with-enough-entropy".to_owned();
        let err = cfg
            .validate_for_profile(RuntimeProfile::Production)
            .expect_err("http multimodal provider must configure at least one route");
        assert!(err.to_string().contains("at least one"));
    }
}
