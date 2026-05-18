//! Phase 7 durable runtime storage schema.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Tenants::Table)
                    .if_not_exists()
                    .col(uuid_pk(Tenants::Id))
                    .col(text(Tenants::Name))
                    .col(jsonb(Tenants::Metadata))
                    .col(timestamp(Tenants::CreatedAt))
                    .col(timestamp(Tenants::UpdatedAt))
                    .col(nullable_text(Tenants::CreatedBy))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .if_not_exists()
                    .col(uuid_pk(Projects::Id))
                    .col(uuid_col(Projects::TenantId))
                    .col(text(Projects::Name))
                    .col(jsonb(Projects::Metadata))
                    .col(timestamp(Projects::CreatedAt))
                    .col(timestamp(Projects::UpdatedAt))
                    .col(nullable_text(Projects::CreatedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Projects::Table, Projects::TenantId)
                            .to(Tenants::Table, Tenants::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Assets::Table)
                    .if_not_exists()
                    .col(uuid_pk(Assets::Id))
                    .col(uuid_col(Assets::TenantId))
                    .col(uuid_col(Assets::ProjectId))
                    .col(uuid_col(Assets::AssetId))
                    .col(text(Assets::Kind))
                    .col(text(Assets::Name))
                    .col(text(Assets::Status))
                    .col(nullable_text(Assets::SourceFormat))
                    .col(nullable_text(Assets::CanonicalFormat))
                    .col(jsonb(Assets::Metadata))
                    .col(timestamp(Assets::CreatedAt))
                    .col(timestamp(Assets::UpdatedAt))
                    .col(nullable_text(Assets::CreatedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Assets::Table, Assets::TenantId)
                            .to(Tenants::Table, Tenants::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Assets::Table, Assets::ProjectId)
                            .to(Projects::Table, Projects::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AssetVersions::Table)
                    .if_not_exists()
                    .col(uuid_pk(AssetVersions::Id))
                    .col(uuid_col(AssetVersions::TenantId))
                    .col(uuid_col(AssetVersions::ProjectId))
                    .col(uuid_col(AssetVersions::AssetId))
                    .col(integer_col(AssetVersions::Version))
                    .col(text(AssetVersions::Status))
                    .col(jsonb(AssetVersions::Metadata))
                    .col(timestamp(AssetVersions::CreatedAt))
                    .col(timestamp(AssetVersions::UpdatedAt))
                    .col(nullable_text(AssetVersions::CreatedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetVersions::Table, AssetVersions::AssetId)
                            .to(Assets::Table, Assets::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AssetFiles::Table)
                    .if_not_exists()
                    .col(uuid_pk(AssetFiles::Id))
                    .col(uuid_col(AssetFiles::TenantId))
                    .col(uuid_col(AssetFiles::ProjectId))
                    .col(uuid_col(AssetFiles::AssetId))
                    .col(uuid_col(AssetFiles::AssetVersionId))
                    .col(text(AssetFiles::Role))
                    .col(text(AssetFiles::Format))
                    .col(jsonb(AssetFiles::Metadata))
                    .col(timestamp(AssetFiles::CreatedAt))
                    .col(timestamp(AssetFiles::UpdatedAt))
                    .col(nullable_text(AssetFiles::CreatedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetFiles::Table, AssetFiles::AssetId)
                            .to(Assets::Table, Assets::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(AssetFiles::Table, AssetFiles::AssetVersionId)
                            .to(AssetVersions::Table, AssetVersions::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ObjectStoreBindings::Table)
                    .if_not_exists()
                    .col(uuid_pk(ObjectStoreBindings::Id))
                    .col(uuid_col(ObjectStoreBindings::TenantId))
                    .col(uuid_col(ObjectStoreBindings::ProjectId))
                    .col(uuid_col(ObjectStoreBindings::AssetId))
                    .col(uuid_col(ObjectStoreBindings::AssetFileId))
                    .col(text(ObjectStoreBindings::Bucket))
                    .col(text(ObjectStoreBindings::Key))
                    .col(big_integer_col(ObjectStoreBindings::SizeBytes))
                    .col(text(ObjectStoreBindings::ContentType))
                    .col(nullable_text(ObjectStoreBindings::ChecksumSha256))
                    .col(text(ObjectStoreBindings::StorageClass))
                    .col(timestamp(ObjectStoreBindings::CreatedAt))
                    .col(timestamp(ObjectStoreBindings::UpdatedAt))
                    .col(nullable_text(ObjectStoreBindings::CreatedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(ObjectStoreBindings::Table, ObjectStoreBindings::AssetId)
                            .to(Assets::Table, Assets::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ObjectStoreBindings::Table, ObjectStoreBindings::AssetFileId)
                            .to(AssetFiles::Table, AssetFiles::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ConversionJobs::Table)
                    .if_not_exists()
                    .col(uuid_pk(ConversionJobs::Id))
                    .col(uuid_col(ConversionJobs::TenantId))
                    .col(uuid_col(ConversionJobs::ProjectId))
                    .col(uuid_col(ConversionJobs::JobId))
                    .col(text(ConversionJobs::Operation))
                    .col(uuid_col(ConversionJobs::SourceAssetId))
                    .col(uuid_col(ConversionJobs::SourceFileId))
                    .col(text(ConversionJobs::Status))
                    .col(jsonb(ConversionJobs::Input))
                    .col(jsonb(ConversionJobs::Output))
                    .col(jsonb(ConversionJobs::Error))
                    .col(nullable_timestamp(ConversionJobs::StartedAt))
                    .col(nullable_timestamp(ConversionJobs::FinishedAt))
                    .col(timestamp(ConversionJobs::CreatedAt))
                    .col(timestamp(ConversionJobs::UpdatedAt))
                    .col(nullable_text(ConversionJobs::CreatedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(ConversionJobs::Table, ConversionJobs::SourceAssetId)
                            .to(Assets::Table, Assets::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ConversionJobs::Table, ConversionJobs::SourceFileId)
                            .to(AssetFiles::Table, AssetFiles::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RuntimeExecutions::Table)
                    .if_not_exists()
                    .col(uuid_pk(RuntimeExecutions::Id))
                    .col(uuid_col(RuntimeExecutions::TenantId))
                    .col(uuid_col(RuntimeExecutions::ProjectId))
                    .col(uuid_col(RuntimeExecutions::ExecutionId))
                    .col(text(RuntimeExecutions::Kind))
                    .col(text(RuntimeExecutions::Provider))
                    .col(text(RuntimeExecutions::Status))
                    .col(jsonb(RuntimeExecutions::Input))
                    .col(jsonb(RuntimeExecutions::Output))
                    .col(jsonb(RuntimeExecutions::Trace))
                    .col(timestamp(RuntimeExecutions::CreatedAt))
                    .col(timestamp(RuntimeExecutions::UpdatedAt))
                    .col(nullable_text(RuntimeExecutions::CreatedBy))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ModuleFiles::Table)
                    .if_not_exists()
                    .col(uuid_pk(ModuleFiles::Id))
                    .col(uuid_col(ModuleFiles::TenantId))
                    .col(uuid_col(ModuleFiles::ProjectId))
                    .col(uuid_col(ModuleFiles::FileId))
                    .col(text(ModuleFiles::ModuleId))
                    .col(nullable_uuid_col(ModuleFiles::ParentId))
                    .col(text(ModuleFiles::Name))
                    .col(text(ModuleFiles::Kind))
                    .col(text(ModuleFiles::Status))
                    .col(big_integer_col(ModuleFiles::SizeBytes))
                    .col(nullable_text(ModuleFiles::MimeType))
                    .col(nullable_text(ModuleFiles::Checksum))
                    .col(integer_col(ModuleFiles::Version))
                    .col(text(ModuleFiles::Owner))
                    .col(jsonb(ModuleFiles::Tags))
                    .col(text(ModuleFiles::Content))
                    .col(timestamp(ModuleFiles::CreatedAt))
                    .col(timestamp(ModuleFiles::UpdatedAt))
                    .col(nullable_text(ModuleFiles::CreatedBy))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ModuleTransactions::Table)
                    .if_not_exists()
                    .col(uuid_pk(ModuleTransactions::Id))
                    .col(uuid_col(ModuleTransactions::TenantId))
                    .col(uuid_col(ModuleTransactions::ProjectId))
                    .col(uuid_col(ModuleTransactions::TransactionId))
                    .col(text(ModuleTransactions::ModuleId))
                    .col(text(ModuleTransactions::TransactionType))
                    .col(text(ModuleTransactions::Status))
                    .col(text(ModuleTransactions::Actor))
                    .col(jsonb(ModuleTransactions::RelatedFileIds))
                    .col(jsonb(ModuleTransactions::RelatedArtifactIds))
                    .col(timestamp(ModuleTransactions::CreatedAt))
                    .col(timestamp(ModuleTransactions::UpdatedAt))
                    .col(nullable_text(ModuleTransactions::CreatedBy))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ModuleTransactionApprovals::Table)
                    .if_not_exists()
                    .col(uuid_pk(ModuleTransactionApprovals::Id))
                    .col(uuid_col(ModuleTransactionApprovals::TenantId))
                    .col(uuid_col(ModuleTransactionApprovals::ProjectId))
                    .col(uuid_col(ModuleTransactionApprovals::ApprovalId))
                    .col(uuid_col(ModuleTransactionApprovals::TransactionId))
                    .col(text(ModuleTransactionApprovals::Approver))
                    .col(text(ModuleTransactionApprovals::Decision))
                    .col(nullable_text(ModuleTransactionApprovals::DecisionComment))
                    .col(timestamp(ModuleTransactionApprovals::DecidedAt))
                    .col(nullable_text(ModuleTransactionApprovals::CreatedBy))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AuditEvents::Table)
                    .if_not_exists()
                    .col(uuid_pk(AuditEvents::Id))
                    .col(uuid_col(AuditEvents::TenantId))
                    .col(uuid_col(AuditEvents::ProjectId))
                    .col(text(AuditEvents::EventType))
                    .col(text(AuditEvents::Actor))
                    .col(text(AuditEvents::TargetType))
                    .col(nullable_text(AuditEvents::TargetId))
                    .col(jsonb(AuditEvents::Payload))
                    .col(timestamp(AuditEvents::CreatedAt))
                    .col(timestamp(AuditEvents::UpdatedAt))
                    .col(nullable_text(AuditEvents::CreatedBy))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(AuditEvents::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(RuntimeExecutions::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(ModuleTransactionApprovals::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(ModuleTransactions::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(ModuleFiles::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(ConversionJobs::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(ObjectStoreBindings::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(AssetFiles::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(AssetVersions::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().table(Assets::Table).if_exists().to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Projects::Table).if_exists().to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Tenants::Table).if_exists().to_owned())
            .await?;
        Ok(())
    }
}

fn uuid_pk<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name)
        .uuid()
        .not_null()
        .primary_key()
        .to_owned()
}

fn uuid_col<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).uuid().not_null().to_owned()
}

fn nullable_uuid_col<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).uuid().null().to_owned()
}

fn text<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).string().not_null().to_owned()
}

fn nullable_text<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).string().null().to_owned()
}

fn integer_col<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).integer().not_null().to_owned()
}

fn big_integer_col<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).big_integer().not_null().to_owned()
}

fn jsonb<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name).json_binary().not_null().to_owned()
}

fn timestamp<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name)
        .timestamp_with_time_zone()
        .not_null()
        .to_owned()
}

fn nullable_timestamp<T>(name: T) -> ColumnDef
where
    T: IntoIden,
{
    ColumnDef::new(name)
        .timestamp_with_time_zone()
        .null()
        .to_owned()
}

#[derive(DeriveIden)]
enum Tenants {
    Table,
    Id,
    Name,
    Metadata,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum Projects {
    Table,
    Id,
    TenantId,
    Name,
    Metadata,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum Assets {
    Table,
    Id,
    TenantId,
    ProjectId,
    AssetId,
    Kind,
    Name,
    Status,
    SourceFormat,
    CanonicalFormat,
    Metadata,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum AssetVersions {
    Table,
    Id,
    TenantId,
    ProjectId,
    AssetId,
    Version,
    Status,
    Metadata,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum AssetFiles {
    Table,
    Id,
    TenantId,
    ProjectId,
    AssetId,
    AssetVersionId,
    Role,
    Format,
    Metadata,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum ObjectStoreBindings {
    Table,
    Id,
    TenantId,
    ProjectId,
    AssetId,
    AssetFileId,
    Bucket,
    Key,
    SizeBytes,
    ContentType,
    ChecksumSha256,
    StorageClass,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum ConversionJobs {
    Table,
    Id,
    TenantId,
    ProjectId,
    JobId,
    Operation,
    SourceAssetId,
    SourceFileId,
    Status,
    Input,
    Output,
    Error,
    StartedAt,
    FinishedAt,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum RuntimeExecutions {
    Table,
    Id,
    TenantId,
    ProjectId,
    ExecutionId,
    Kind,
    Provider,
    Status,
    Input,
    Output,
    Trace,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum ModuleFiles {
    Table,
    Id,
    TenantId,
    ProjectId,
    FileId,
    ModuleId,
    ParentId,
    Name,
    Kind,
    Status,
    SizeBytes,
    MimeType,
    Checksum,
    Version,
    Owner,
    Tags,
    Content,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum ModuleTransactions {
    Table,
    Id,
    TenantId,
    ProjectId,
    TransactionId,
    ModuleId,
    TransactionType,
    Status,
    Actor,
    RelatedFileIds,
    RelatedArtifactIds,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum ModuleTransactionApprovals {
    Table,
    Id,
    TenantId,
    ProjectId,
    ApprovalId,
    TransactionId,
    Approver,
    Decision,
    DecisionComment,
    DecidedAt,
    CreatedBy,
}

#[derive(DeriveIden)]
enum AuditEvents {
    Table,
    Id,
    TenantId,
    ProjectId,
    EventType,
    Actor,
    TargetType,
    TargetId,
    Payload,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
}
