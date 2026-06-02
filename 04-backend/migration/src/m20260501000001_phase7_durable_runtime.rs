//! Phase 7 durable runtime storage schema.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(include_str!(
                "../../migrations/20260501000001_phase7_durable_runtime.sql"
            ))
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r"
                DROP TABLE IF EXISTS audit_events;
                DROP TABLE IF EXISTS runtime_executions;
                DROP TABLE IF EXISTS module_transaction_approvals;
                DROP TABLE IF EXISTS module_transactions;
                DROP TABLE IF EXISTS module_files;
                DROP TABLE IF EXISTS conversion_jobs;
                DROP TABLE IF EXISTS object_store_bindings;
                DROP TABLE IF EXISTS asset_files;
                DROP TABLE IF EXISTS asset_versions;
                DROP TABLE IF EXISTS assets;
                ",
            )
            .await?;
        Ok(())
    }
}
