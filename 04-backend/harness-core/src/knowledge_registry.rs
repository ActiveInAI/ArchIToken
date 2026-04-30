//! Knowledge Source Registry in-memory preview service.
//!
//! The registry stores source metadata, index bindings, citation policy, and
//! mock ingestion jobs. It does not crawl GitHub Trending or external sources;
//! real refresh jobs must run as explicit scheduled network tasks.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::{
    error::{HarnessError, Result},
    module_pagination::{ListPage, PageInfo, paginate},
    skill_registry::RegistryActionRequest,
};

/// Knowledge source category.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeSourceKind {
    /// 标准规范库.
    StandardSpecification,
    /// 族库构件库.
    FamilyComponent,
    /// 材质库.
    MaterialLibrary,
    /// 图纸库.
    DrawingLibrary,
    /// 模型库.
    ModelLibrary,
    /// 企业制度库.
    EnterprisePolicy,
    /// 项目案例库.
    ProjectCase,
    /// 造价价格库.
    CostPrice,
    /// 供应商/材料库.
    SupplierMaterial,
    /// 施工工法库.
    ConstructionMethod,
    /// 监理验收库.
    SupervisionAcceptance,
    /// 安全质量隐患库.
    SafetyQualityRisk,
    /// 设备/IoT/运维知识库.
    EquipmentIotOperations,
    /// 外接 AI 模型与开源工具候选库.
    ExternalAiModelOpenSourceCandidate,
}

/// Knowledge source status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeSourceStatus {
    /// Draft source.
    Draft,
    /// Approved source.
    Approved,
    /// Ingesting source.
    Ingesting,
    /// Last ingest completed.
    Indexed,
    /// Disabled source.
    Disabled,
    /// Candidate-only source that cannot be selected by production routes.
    CandidateOnly,
}

/// Index bindings for a knowledge source.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeIndexBinding {
    /// Vector index id.
    pub vector_index: Option<String>,
    /// Full-text index id.
    pub full_text_index: Option<String>,
    /// Graph index id.
    pub graph_index: Option<String>,
    /// Object store prefix.
    pub object_prefix: String,
}

/// Citation policy attached to retrieved chunks.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeCitationPolicy {
    /// Whether citations are required.
    pub citation_required: bool,
    /// Whether source URL must be exposed to callers.
    pub expose_source_url: bool,
    /// Minimum citation fields.
    pub required_fields: Vec<String>,
}

/// Knowledge source contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSource {
    /// Stable source id.
    pub id: String,
    /// Source kind.
    pub kind: KnowledgeSourceKind,
    /// Human-readable name.
    pub name: String,
    /// Source URL.
    pub source_url: String,
    /// Declared license or license policy.
    pub license: String,
    /// Source version.
    pub version: String,
    /// Optional external vendor id.
    pub vendor_id: Option<String>,
    /// Whether production routes may select this source.
    pub production_enabled: bool,
    /// Default route policy.
    pub default_route: String,
    /// Commercial policy description.
    pub commercial_policy: Option<String>,
    /// Capabilities declared by this source or vendor.
    pub capabilities: Vec<String>,
    /// Requirements that must pass before production use.
    pub requirements_before_use: Vec<String>,
    /// Owner team or user id.
    pub owner: String,
    /// Refresh policy description.
    pub refresh_policy: String,
    /// Permission policy description.
    pub permission_policy: String,
    /// Audit policy description.
    pub audit_policy: String,
    /// Index bindings.
    pub index_binding: KnowledgeIndexBinding,
    /// Citation policy.
    pub citation_policy: KnowledgeCitationPolicy,
    /// Current status.
    pub status: KnowledgeSourceStatus,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Mock ingestion job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeIngestionJob {
    /// Ingestion job id.
    pub id: uuid::Uuid,
    /// Source id.
    pub source_id: String,
    /// Job status.
    pub status: String,
    /// Summary of mock ingest work.
    pub summary: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Create knowledge source request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeSourceRequest {
    /// Optional caller-supplied stable source id.
    pub id: Option<String>,
    /// Source kind.
    pub kind: KnowledgeSourceKind,
    /// Human-readable name.
    pub name: String,
    /// Source URL.
    pub source_url: String,
    /// Declared license or license policy.
    pub license: String,
    /// Source version.
    pub version: String,
    /// Optional external vendor id.
    pub vendor_id: Option<String>,
    /// Optional production route flag.
    pub production_enabled: Option<bool>,
    /// Optional default route policy.
    pub default_route: Option<String>,
    /// Optional commercial policy description.
    pub commercial_policy: Option<String>,
    /// Optional declared capabilities.
    pub capabilities: Option<Vec<String>>,
    /// Optional requirements before production use.
    pub requirements_before_use: Option<Vec<String>>,
    /// Owner team or user id.
    pub owner: String,
    /// Refresh policy description.
    pub refresh_policy: String,
    /// Permission policy description.
    pub permission_policy: String,
    /// Audit policy description.
    pub audit_policy: String,
    /// Index bindings.
    pub index_binding: KnowledgeIndexBinding,
    /// Citation policy.
    pub citation_policy: KnowledgeCitationPolicy,
}

/// Patch knowledge source request.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKnowledgeSourceRequest {
    /// Optional human-readable name.
    pub name: Option<String>,
    /// Optional source URL.
    pub source_url: Option<String>,
    /// Optional declared license.
    pub license: Option<String>,
    /// Optional source version.
    pub version: Option<String>,
    /// Optional external vendor id.
    pub vendor_id: Option<String>,
    /// Optional production route flag.
    pub production_enabled: Option<bool>,
    /// Optional default route policy.
    pub default_route: Option<String>,
    /// Optional commercial policy description.
    pub commercial_policy: Option<String>,
    /// Optional declared capabilities.
    pub capabilities: Option<Vec<String>>,
    /// Optional requirements before production use.
    pub requirements_before_use: Option<Vec<String>>,
    /// Optional owner.
    pub owner: Option<String>,
    /// Optional refresh policy.
    pub refresh_policy: Option<String>,
    /// Optional permission policy.
    pub permission_policy: Option<String>,
    /// Optional audit policy.
    pub audit_policy: Option<String>,
    /// Optional index bindings.
    pub index_binding: Option<KnowledgeIndexBinding>,
    /// Optional citation policy.
    pub citation_policy: Option<KnowledgeCitationPolicy>,
}

/// Knowledge source list query.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct KnowledgeSourceListQuery {
    /// Optional kind filter.
    pub kind: Option<KnowledgeSourceKind>,
    /// Optional status filter.
    pub status: Option<KnowledgeSourceStatus>,
    /// Optional owner filter.
    pub owner: Option<String>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Knowledge source list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSourceListResponse {
    /// Sources included in this page.
    pub sources: Vec<KnowledgeSource>,
    /// Number of sources in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// In-memory Knowledge Source Registry preview service.
#[derive(Debug, Clone, Default)]
pub struct KnowledgeSourceRegistryService {
    sources: Arc<RwLock<HashMap<String, KnowledgeSource>>>,
    ingestion_jobs: Arc<RwLock<HashMap<uuid::Uuid, KnowledgeIngestionJob>>>,
}

impl KnowledgeSourceRegistryService {
    /// Create an empty registry.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a draft knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for missing fields or duplicate ids.
    pub fn create_source(&self, req: CreateKnowledgeSourceRequest) -> Result<KnowledgeSource> {
        validate_required("name", &req.name)?;
        validate_required("source_url", &req.source_url)?;
        validate_required("license", &req.license)?;
        validate_required("owner", &req.owner)?;
        validate_github_trending_policy(&req.source_url, &req.refresh_policy)?;
        let id = req
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let candidate_only = is_candidate_only(&req.license, req.vendor_id.as_deref());
        let source = KnowledgeSource {
            id: id.clone(),
            kind: req.kind,
            name: req.name,
            source_url: req.source_url,
            license: req.license,
            version: req.version,
            vendor_id: req.vendor_id,
            production_enabled: req.production_enabled.unwrap_or(false) && !candidate_only,
            default_route: if candidate_only {
                "disabled".to_owned()
            } else {
                req.default_route.unwrap_or_else(|| "disabled".to_owned())
            },
            commercial_policy: req.commercial_policy,
            capabilities: req.capabilities.unwrap_or_default(),
            requirements_before_use: req.requirements_before_use.unwrap_or_default(),
            owner: req.owner,
            refresh_policy: req.refresh_policy,
            permission_policy: req.permission_policy,
            audit_policy: req.audit_policy,
            index_binding: req.index_binding,
            citation_policy: req.citation_policy,
            status: if candidate_only {
                KnowledgeSourceStatus::CandidateOnly
            } else {
                KnowledgeSourceStatus::Draft
            },
            created_at: now,
            updated_at: now,
        };
        {
            let mut sources = self.sources.write();
            if sources.contains_key(&id) {
                return Err(HarnessError::InvalidInput(format!("source_id={id} exists")));
            }
            sources.insert(id, source.clone());
        }
        Ok(source)
    }

    /// List knowledge sources.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when pagination cursor is invalid.
    pub fn list_sources(
        &self,
        query: &KnowledgeSourceListQuery,
    ) -> Result<ListPage<KnowledgeSource>> {
        let mut items: Vec<KnowledgeSource> = self
            .sources
            .read()
            .values()
            .filter(|source| query.kind.is_none_or(|kind| source.kind == kind))
            .filter(|source| query.status.is_none_or(|status| source.status == status))
            .filter(|source| {
                query
                    .owner
                    .as_ref()
                    .is_none_or(|owner| source.owner == *owner)
            })
            .cloned()
            .collect();
        items.sort_by(|left, right| left.id.cmp(&right.id));
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the source id is unknown.
    pub fn get_source(&self, source_id: &str) -> Result<KnowledgeSource> {
        self.sources
            .read()
            .get(source_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("source_id={source_id}")))
    }

    /// Patch one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the source id is unknown.
    pub fn update_source(
        &self,
        source_id: &str,
        req: UpdateKnowledgeSourceRequest,
    ) -> Result<KnowledgeSource> {
        let mut source = self.get_source(source_id)?;
        if let Some(name) = req.name {
            validate_required("name", &name)?;
            source.name = name;
        }
        if let Some(source_url) = req.source_url {
            validate_required("source_url", &source_url)?;
            source.source_url = source_url;
        }
        if let Some(license) = req.license {
            validate_required("license", &license)?;
            source.license = license;
        }
        if let Some(version) = req.version {
            source.version = version;
        }
        if let Some(vendor_id) = req.vendor_id {
            source.vendor_id = Some(vendor_id);
            source.production_enabled = false;
            "disabled".clone_into(&mut source.default_route);
            source.status = KnowledgeSourceStatus::CandidateOnly;
        }
        if let Some(production_enabled) = req.production_enabled {
            source.production_enabled = production_enabled
                && !is_candidate_only(&source.license, source.vendor_id.as_deref());
        }
        if let Some(default_route) = req.default_route {
            source.default_route = default_route;
        }
        if let Some(commercial_policy) = req.commercial_policy {
            source.commercial_policy = Some(commercial_policy);
        }
        if let Some(capabilities) = req.capabilities {
            source.capabilities = capabilities;
        }
        if let Some(requirements_before_use) = req.requirements_before_use {
            source.requirements_before_use = requirements_before_use;
        }
        if let Some(owner) = req.owner {
            validate_required("owner", &owner)?;
            source.owner = owner;
        }
        if let Some(refresh_policy) = req.refresh_policy {
            source.refresh_policy = refresh_policy;
        }
        if let Some(permission_policy) = req.permission_policy {
            source.permission_policy = permission_policy;
        }
        if let Some(audit_policy) = req.audit_policy {
            source.audit_policy = audit_policy;
        }
        if let Some(index_binding) = req.index_binding {
            source.index_binding = index_binding;
        }
        if let Some(citation_policy) = req.citation_policy {
            source.citation_policy = citation_policy;
        }
        validate_github_trending_policy(&source.source_url, &source.refresh_policy)?;
        if is_candidate_only(&source.license, source.vendor_id.as_deref()) {
            source.status = KnowledgeSourceStatus::CandidateOnly;
            source.production_enabled = false;
            "disabled".clone_into(&mut source.default_route);
        } else {
            source.status = KnowledgeSourceStatus::Draft;
        }
        source.updated_at = Utc::now();
        self.sources
            .write()
            .insert(source_id.to_owned(), source.clone());
        Ok(source)
    }

    /// Mock ingest one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the source id is unknown.
    pub fn ingest_source(
        &self,
        source_id: &str,
        _req: RegistryActionRequest,
    ) -> Result<KnowledgeIngestionJob> {
        let mut source = self.get_source(source_id)?;
        match source.status {
            KnowledgeSourceStatus::Disabled => {
                return Err(HarnessError::InvalidInput(format!(
                    "cannot ingest disabled knowledge source {source_id}"
                )));
            }
            KnowledgeSourceStatus::CandidateOnly => {
                source.production_enabled = false;
                "disabled".clone_into(&mut source.default_route);
            }
            _ => {
                source.status = KnowledgeSourceStatus::Indexed;
            }
        }
        source.updated_at = Utc::now();
        self.sources.write().insert(source_id.to_owned(), source);
        let now = Utc::now();
        let job = KnowledgeIngestionJob {
            id: uuid::Uuid::new_v4(),
            source_id: source_id.to_owned(),
            status: "completed".to_owned(),
            summary: "mock ingest recorded registry metadata only; no external crawl executed"
                .to_owned(),
            created_at: now,
            updated_at: now,
        };
        self.ingestion_jobs.write().insert(job.id, job.clone());
        Ok(job)
    }

    /// Approve one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the source id is unknown.
    pub fn approve_source(
        &self,
        source_id: &str,
        _req: RegistryActionRequest,
    ) -> Result<KnowledgeSource> {
        let mut source = self.get_source(source_id)?;
        if is_candidate_only(&source.license, source.vendor_id.as_deref()) {
            source.status = KnowledgeSourceStatus::CandidateOnly;
            source.production_enabled = false;
            "disabled".clone_into(&mut source.default_route);
        } else {
            source.status = KnowledgeSourceStatus::Approved;
        }
        source.updated_at = Utc::now();
        self.sources
            .write()
            .insert(source_id.to_owned(), source.clone());
        Ok(source)
    }

    /// Disable one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the source id is unknown.
    pub fn disable_source(
        &self,
        source_id: &str,
        _req: RegistryActionRequest,
    ) -> Result<KnowledgeSource> {
        let mut source = self.get_source(source_id)?;
        source.status = KnowledgeSourceStatus::Disabled;
        source.production_enabled = false;
        "disabled".clone_into(&mut source.default_route);
        source.updated_at = Utc::now();
        self.sources
            .write()
            .insert(source_id.to_owned(), source.clone());
        Ok(source)
    }
}

fn validate_required(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn is_candidate_only(license: &str, vendor_id: Option<&str>) -> bool {
    let normalized = license.to_ascii_lowercase();
    vendor_id.is_some()
        || normalized.contains("proprietary")
        || normalized.contains("eula")
        || normalized.contains("commercial")
}

fn validate_github_trending_policy(source_url: &str, refresh_policy: &str) -> Result<()> {
    let normalized_url = source_url.to_ascii_lowercase();
    if !normalized_url.contains("github.com/trending") {
        return Ok(());
    }
    let normalized_policy = refresh_policy.to_ascii_lowercase();
    if normalized_policy.contains("scheduled")
        && normalized_policy.contains("network")
        && !normalized_policy.contains("fake ranking")
    {
        return Ok(());
    }
    Err(HarnessError::InvalidInput(
        "GitHub Trending sources require an explicit scheduled network job policy and must not fake ranking"
            .to_owned(),
    ))
}

#[cfg(test)]
mod tests {
    use crate::skill_registry::RegistryActionRequest;

    use super::{
        CreateKnowledgeSourceRequest, KnowledgeCitationPolicy, KnowledgeIndexBinding,
        KnowledgeSourceKind, KnowledgeSourceListQuery, KnowledgeSourceRegistryService,
        KnowledgeSourceStatus,
    };

    fn create_request(id: &str) -> CreateKnowledgeSourceRequest {
        CreateKnowledgeSourceRequest {
            id: Some(id.to_owned()),
            kind: KnowledgeSourceKind::StandardSpecification,
            name: "GB specification library".to_owned(),
            source_url: "https://example.invalid/specs".to_owned(),
            license: "enterprise-internal".to_owned(),
            version: "2026.04".to_owned(),
            vendor_id: None,
            production_enabled: Some(false),
            default_route: Some("disabled".to_owned()),
            commercial_policy: None,
            capabilities: None,
            requirements_before_use: None,
            owner: "knowledge".to_owned(),
            refresh_policy: "weekly scheduled task with explicit network access".to_owned(),
            permission_policy: "tenant_project_scoped".to_owned(),
            audit_policy: "audit every ingest and retrieval".to_owned(),
            index_binding: KnowledgeIndexBinding {
                vector_index: Some("vector:specs".to_owned()),
                full_text_index: Some("fts:specs".to_owned()),
                graph_index: Some("graph:specs".to_owned()),
                object_prefix: "knowledge/specs/".to_owned(),
            },
            citation_policy: KnowledgeCitationPolicy {
                citation_required: true,
                expose_source_url: true,
                required_fields: vec!["sourceUrl".to_owned(), "version".to_owned()],
            },
        }
    }

    #[test]
    fn knowledge_source_registry_create_ingest_approve_disable() {
        let registry = KnowledgeSourceRegistryService::new();
        let source = registry
            .create_source(create_request("standards"))
            .expect("source should create");
        assert_eq!(source.status, KnowledgeSourceStatus::Draft);

        let ingest = registry
            .ingest_source("standards", RegistryActionRequest::default())
            .expect("mock ingest should complete");
        assert_eq!(ingest.status, "completed");
        assert_eq!(
            registry
                .get_source("standards")
                .expect("source exists")
                .status,
            KnowledgeSourceStatus::Indexed
        );

        let approved = registry
            .approve_source("standards", RegistryActionRequest::default())
            .expect("source should approve");
        assert_eq!(approved.status, KnowledgeSourceStatus::Approved);

        let page = registry
            .list_sources(&KnowledgeSourceListQuery {
                kind: Some(KnowledgeSourceKind::StandardSpecification),
                status: Some(KnowledgeSourceStatus::Approved),
                owner: Some("knowledge".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("list should work");
        assert_eq!(page.items.len(), 1);

        let disabled = registry
            .disable_source("standards", RegistryActionRequest::default())
            .expect("source should disable");
        assert_eq!(disabled.status, KnowledgeSourceStatus::Disabled);

        assert!(
            registry
                .ingest_source("standards", RegistryActionRequest::default())
                .is_err(),
            "disabled source ingest must be rejected"
        );
        assert_eq!(
            registry
                .get_source("standards")
                .expect("source still exists")
                .status,
            KnowledgeSourceStatus::Disabled
        );
    }

    #[test]
    fn proprietary_vendor_source_remains_candidate_only() {
        let registry = KnowledgeSourceRegistryService::new();
        let mut req = create_request("vendor-glendale-optrapid3d");
        req.kind = KnowledgeSourceKind::ExternalAiModelOpenSourceCandidate;
        req.vendor_id = Some("vendor.glendale.optrapid3d".to_owned());
        req.license = "proprietary_eula".to_owned();
        req.commercial_policy = Some("converter_paid_by_model_volume".to_owned());
        req.capabilities = Some(vec![
            "BIM lightweighting".to_owned(),
            ".opt geometry generation".to_owned(),
            ".db property index generation".to_owned(),
        ]);
        req.requirements_before_use = Some(vec![
            "legal review".to_owned(),
            "commercial review".to_owned(),
            "SBOM review".to_owned(),
            "security scan".to_owned(),
            "benchmark".to_owned(),
            "sandbox smoke test".to_owned(),
            "explicit user approval".to_owned(),
        ]);
        req.production_enabled = Some(true);
        req.default_route = Some("enabled".to_owned());

        let source = registry
            .create_source(req)
            .expect("candidate should create");
        assert_eq!(source.status, KnowledgeSourceStatus::CandidateOnly);
        assert!(!source.production_enabled);
        assert_eq!(source.default_route, "disabled");

        let ingest = registry
            .ingest_source(
                "vendor-glendale-optrapid3d",
                RegistryActionRequest::default(),
            )
            .expect("candidate-only source may record a mock ingest job");
        assert_eq!(ingest.status, "completed");
        let source = registry
            .get_source("vendor-glendale-optrapid3d")
            .expect("candidate source should still exist");
        assert_eq!(source.status, KnowledgeSourceStatus::CandidateOnly);
        assert!(!source.production_enabled);
        assert_eq!(source.default_route, "disabled");

        let approved = registry
            .approve_source(
                "vendor-glendale-optrapid3d",
                RegistryActionRequest::default(),
            )
            .expect("candidate approval should not enable production route");
        assert_eq!(approved.status, KnowledgeSourceStatus::CandidateOnly);
        assert!(!approved.production_enabled);
    }

    #[test]
    fn github_trending_source_requires_scheduled_network_job_policy() {
        let registry = KnowledgeSourceRegistryService::new();
        let mut req = create_request("github-trending");
        req.kind = KnowledgeSourceKind::ExternalAiModelOpenSourceCandidate;
        req.source_url = "https://github.com/trending".to_owned();
        req.refresh_policy = "manual copy-paste ranking".to_owned();
        assert!(registry.create_source(req).is_err());

        let mut req = create_request("github-trending");
        req.kind = KnowledgeSourceKind::ExternalAiModelOpenSourceCandidate;
        req.source_url = "https://github.com/trending".to_owned();
        req.refresh_policy =
            "scheduled network job required; no ranking is synthesized locally".to_owned();
        let source = registry
            .create_source(req)
            .expect("explicit scheduled network policy should create");
        assert!(
            source
                .refresh_policy
                .contains("scheduled network job required")
        );
        assert_eq!(source.default_route, "disabled");
    }

    #[test]
    fn github_trending_source_url_and_policy_can_be_updated_atomically() {
        let registry = KnowledgeSourceRegistryService::new();
        registry
            .create_source(create_request("standards-to-trending"))
            .expect("source should create");

        let source = registry
            .update_source(
                "standards-to-trending",
                super::UpdateKnowledgeSourceRequest {
                    source_url: Some("https://github.com/trending".to_owned()),
                    refresh_policy: Some(
                        "scheduled network job required; no ranking is synthesized locally"
                            .to_owned(),
                    ),
                    ..Default::default()
                },
            )
            .expect("source_url and refresh policy should validate together");

        assert_eq!(source.source_url, "https://github.com/trending");
        assert!(
            source
                .refresh_policy
                .contains("scheduled network job required")
        );

        let invalid = registry.update_source(
            "standards-to-trending",
            super::UpdateKnowledgeSourceRequest {
                source_url: Some("https://github.com/trending/rust".to_owned()),
                refresh_policy: Some("manual scrape".to_owned()),
                ..Default::default()
            },
        );
        assert!(
            invalid.is_err(),
            "invalid GitHub Trending policy should reject before persistence"
        );
        let unchanged = registry
            .get_source("standards-to-trending")
            .expect("source should still exist");
        assert_eq!(unchanged.source_url, "https://github.com/trending");
        assert!(
            unchanged
                .refresh_policy
                .contains("scheduled network job required")
        );
    }

    #[test]
    fn knowledge_source_registry_filters_and_paginates_stably() {
        let registry = KnowledgeSourceRegistryService::new();
        for id in ["source-c", "source-a", "source-b"] {
            registry
                .create_source(create_request(id))
                .expect("source should create");
        }
        registry
            .approve_source("source-b", RegistryActionRequest::default())
            .expect("source-b should approve");

        let first_page = registry
            .list_sources(&KnowledgeSourceListQuery {
                kind: Some(KnowledgeSourceKind::StandardSpecification),
                status: None,
                owner: Some("knowledge".to_owned()),
                limit: Some(2),
                cursor: None,
            })
            .expect("first page should work");
        assert_eq!(
            first_page
                .items
                .iter()
                .map(|source| source.id.as_str())
                .collect::<Vec<_>>(),
            vec!["source-a", "source-b"]
        );

        let second_page = registry
            .list_sources(&KnowledgeSourceListQuery {
                kind: Some(KnowledgeSourceKind::StandardSpecification),
                status: None,
                owner: Some("knowledge".to_owned()),
                limit: Some(2),
                cursor: first_page.page_info.next_cursor,
            })
            .expect("second page should work");
        assert_eq!(
            second_page
                .items
                .iter()
                .map(|source| source.id.as_str())
                .collect::<Vec<_>>(),
            vec!["source-c"]
        );

        let approved = registry
            .list_sources(&KnowledgeSourceListQuery {
                kind: Some(KnowledgeSourceKind::StandardSpecification),
                status: Some(KnowledgeSourceStatus::Approved),
                owner: Some("knowledge".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("approved filter should work");
        assert_eq!(approved.items.len(), 1);
        assert_eq!(approved.items[0].id, "source-b");
    }

    #[test]
    fn disabled_source_ingest_cannot_restore_production_route() {
        let registry = KnowledgeSourceRegistryService::new();
        let mut req = create_request("disable-production");
        req.production_enabled = Some(true);
        req.default_route = Some("enabled".to_owned());
        registry
            .create_source(req)
            .expect("source should create with production flag");
        let disabled = registry
            .disable_source("disable-production", RegistryActionRequest::default())
            .expect("source should disable");
        assert_eq!(disabled.status, KnowledgeSourceStatus::Disabled);
        assert!(!disabled.production_enabled);
        assert_eq!(disabled.default_route, "disabled");

        assert!(
            registry
                .ingest_source("disable-production", RegistryActionRequest::default())
                .is_err(),
            "disabled source ingest must remain rejected"
        );
        let source = registry
            .get_source("disable-production")
            .expect("source should remain persisted");
        assert_eq!(source.status, KnowledgeSourceStatus::Disabled);
        assert!(!source.production_enabled);
        assert_eq!(source.default_route, "disabled");
    }
}
