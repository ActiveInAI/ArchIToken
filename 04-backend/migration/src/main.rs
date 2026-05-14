use sea_orm_migration::prelude::*;

#[tokio::main]
async fn main() {
    cli::run_cli(architoken_migration::Migrator).await;
}
