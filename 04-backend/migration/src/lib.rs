//! SeaORM migrator for ArchIToken durable runtime storage.

pub use sea_orm_migration::prelude::*;

mod m20260501000001_phase7_durable_runtime;

/// ArchIToken migration registry.
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20260501000001_phase7_durable_runtime::Migration)]
    }
}
