//! Database boundary selection for Phase 7 durable runtime storage.

use sea_orm::{Database, DatabaseConnection};

use crate::{
    error::{HarnessError, Result},
    runtime_context::RuntimeProfile,
};

/// Runtime persistence mode selected at startup.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimePersistenceMode {
    /// Development-only in-memory fallback.
    InMemoryFallback,
    /// PostgreSQL/SeaORM durable store boundary is configured.
    DurablePostgres,
}

impl RuntimePersistenceMode {
    /// Stable API value for capability responses.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InMemoryFallback => "in_memory_preview",
            Self::DurablePostgres => "durable_postgres",
        }
    }
}

/// Database runtime configuration derived from environment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeDatabaseConfig {
    /// Selected persistence mode.
    pub mode: RuntimePersistenceMode,
    /// `PostgreSQL` connection URL when durable mode is configured.
    pub database_url: Option<String>,
}

impl RuntimeDatabaseConfig {
    /// Build database config from `DATABASE_URL` and the active runtime profile.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when production would fall back to memory.
    pub fn from_env(profile: RuntimeProfile) -> Result<Self> {
        Self::from_database_url(profile, std::env::var("DATABASE_URL").ok())
    }

    /// Build database config from an explicit optional URL.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when production would fall back to memory.
    pub fn from_database_url(
        profile: RuntimeProfile,
        database_url: Option<String>,
    ) -> Result<Self> {
        let database_url = database_url.and_then(|url| {
            let trimmed = url.trim().to_owned();
            (!trimmed.is_empty()).then_some(trimmed)
        });

        match (profile, database_url) {
            (_, Some(url)) => Ok(Self {
                mode: RuntimePersistenceMode::DurablePostgres,
                database_url: Some(url),
            }),
            (RuntimeProfile::Development, None) => Ok(Self {
                mode: RuntimePersistenceMode::InMemoryFallback,
                database_url: None,
            }),
            (RuntimeProfile::Production, None) => Err(HarnessError::InvalidInput(
                "DATABASE_URL is required when ARCHITOKEN_PROFILE is production-like".to_owned(),
            )),
        }
    }

    /// Whether handlers are running against the development memory fallback.
    #[must_use]
    pub const fn uses_in_memory_fallback(&self) -> bool {
        matches!(self.mode, RuntimePersistenceMode::InMemoryFallback)
    }
}

/// Connect to `PostgreSQL` through `SeaORM`.
///
/// # Errors
/// Returns [`HarnessError::Database`] when `SeaORM` cannot connect.
pub async fn connect_database(database_url: &str) -> Result<DatabaseConnection> {
    Ok(Database::connect(database_url).await?)
}

#[cfg(test)]
mod tests {
    use super::{RuntimeDatabaseConfig, RuntimePersistenceMode};
    use crate::runtime_context::RuntimeProfile;

    #[test]
    fn development_allows_memory_fallback_without_database_url() {
        let config = RuntimeDatabaseConfig::from_database_url(RuntimeProfile::Development, None)
            .expect("development may use memory");
        assert_eq!(config.mode, RuntimePersistenceMode::InMemoryFallback);
        assert!(config.uses_in_memory_fallback());
    }

    #[test]
    fn production_rejects_memory_fallback_without_database_url() {
        let err = RuntimeDatabaseConfig::from_database_url(RuntimeProfile::Production, None)
            .expect_err("production must require database");
        assert_eq!(err.http_status(), 400);
    }

    #[test]
    fn production_accepts_database_url() {
        let config = RuntimeDatabaseConfig::from_database_url(
            RuntimeProfile::Production,
            Some("postgres://architoken:architoken@localhost/architoken".to_owned()),
        )
        .expect("database url selects durable mode");
        assert_eq!(config.mode, RuntimePersistenceMode::DurablePostgres);
        assert!(!config.uses_in_memory_fallback());
    }
}
