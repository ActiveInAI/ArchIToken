//! Skill Registry in-memory preview service.
//!
//! The registry is production-route aware but does not execute skills. It
//! records schema, sandbox, fixture, and license metadata so `WorkflowRouter`
//! can later select only approved commercial-safe skills.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::{
    error::{HarnessError, Result},
    module_pagination::{ListPage, PageInfo, paginate},
};

const FORBIDDEN_LICENSES: &[&str] = &[
    "GPL",
    "AGPL",
    "LGPL",
    "SSPL",
    "BUSL",
    "COMMONS CLAUSE",
    "PROPRIETARY",
    "EULA",
];

/// Skill lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillStatus {
    /// Draft skill, not eligible for production routing.
    Draft,
    /// Approved skill, eligible for production routing when license policy allows it.
    Approved,
    /// Disabled skill, not eligible for routing.
    Disabled,
    /// Blocked skill, usually due to license or sandbox policy.
    Blocked,
}

/// Skill version metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillVersion {
    /// Semantic version string.
    pub version: String,
    /// Change summary.
    pub changelog: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// One declared skill capability.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCapability {
    /// Capability id, for example `text_to_bim`.
    pub id: String,
    /// Capability description.
    pub description: String,
    /// Input artifact kinds or modes.
    pub input_kinds: Vec<String>,
    /// Output artifact kinds or modes.
    pub output_kinds: Vec<String>,
}

/// Commercial license policy attached to a skill.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillLicensePolicy {
    /// SPDX license expression or declared upstream license.
    pub license: String,
    /// Whether the declared license is allowed for commercial production use.
    pub commercial_use_allowed: bool,
    /// Review note explaining license posture.
    pub review_note: String,
}

/// Sandbox policy for skill execution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSandboxPolicy {
    /// Sandbox profile id.
    pub profile: String,
    /// Whether network access is allowed.
    pub network_access: bool,
    /// Timeout in milliseconds.
    pub timeout_ms: u64,
    /// Maximum memory in MiB.
    pub memory_mb: u64,
}

/// Fixture used to test or evaluate a skill.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFixture {
    /// Fixture id.
    pub id: String,
    /// Input fixture URI or inline reference.
    pub input_ref: String,
    /// Expected output schema reference.
    pub expected_output_schema_ref: String,
}

/// Registered skill contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSpec {
    /// Stable skill id.
    pub id: String,
    /// Human-readable skill name.
    pub name: String,
    /// Owner team or user id.
    pub owner: String,
    /// Active version.
    pub version: SkillVersion,
    /// Input JSON schema reference.
    pub input_schema_ref: String,
    /// Output JSON schema reference.
    pub output_schema_ref: String,
    /// Declared capabilities.
    pub capabilities: Vec<SkillCapability>,
    /// Commercial license policy.
    pub license_policy: SkillLicensePolicy,
    /// Execution sandbox policy.
    pub sandbox_policy: SkillSandboxPolicy,
    /// Test fixtures.
    pub fixtures: Vec<SkillFixture>,
    /// Current status.
    pub status: SkillStatus,
    /// Whether the skill may be selected by a production route.
    pub production_route_enabled: bool,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Create skill request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillRequest {
    /// Optional caller-supplied stable skill id.
    pub id: Option<String>,
    /// Human-readable skill name.
    pub name: String,
    /// Owner team or user id.
    pub owner: String,
    /// Version string.
    pub version: String,
    /// Input JSON schema reference.
    pub input_schema_ref: String,
    /// Output JSON schema reference.
    pub output_schema_ref: String,
    /// Declared capabilities.
    pub capabilities: Vec<SkillCapability>,
    /// Commercial license policy.
    pub license_policy: SkillLicensePolicy,
    /// Execution sandbox policy.
    pub sandbox_policy: SkillSandboxPolicy,
    /// Test fixtures.
    pub fixtures: Vec<SkillFixture>,
}

/// Patch skill request.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSkillRequest {
    /// Optional human-readable skill name.
    pub name: Option<String>,
    /// Optional owner team or user id.
    pub owner: Option<String>,
    /// Optional input JSON schema reference.
    pub input_schema_ref: Option<String>,
    /// Optional output JSON schema reference.
    pub output_schema_ref: Option<String>,
    /// Optional declared capabilities.
    pub capabilities: Option<Vec<SkillCapability>>,
    /// Optional commercial license policy.
    pub license_policy: Option<SkillLicensePolicy>,
    /// Optional execution sandbox policy.
    pub sandbox_policy: Option<SkillSandboxPolicy>,
    /// Optional test fixtures.
    pub fixtures: Option<Vec<SkillFixture>>,
}

/// Skill list query.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct SkillListQuery {
    /// Optional status filter.
    pub status: Option<SkillStatus>,
    /// Optional owner filter.
    pub owner: Option<String>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Skill list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillListResponse {
    /// Skills included in this page.
    pub skills: Vec<SkillSpec>,
    /// Number of skills in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Generic registry action request.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryActionRequest {
    /// Actor performing the action.
    pub actor: Option<String>,
    /// Optional action comment.
    pub comment: Option<String>,
}

/// In-memory Skill Registry preview service.
#[derive(Debug, Clone, Default)]
pub struct SkillRegistryService {
    skills: Arc<RwLock<HashMap<String, SkillSpec>>>,
}

impl SkillRegistryService {
    /// Create an empty registry.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a draft skill.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for missing required fields or
    /// forbidden commercial licenses, and [`HarnessError::InvalidInput`] when
    /// the id already exists.
    pub fn create_skill(&self, req: CreateSkillRequest) -> Result<SkillSpec> {
        validate_required("name", &req.name)?;
        validate_required("owner", &req.owner)?;
        validate_required("input_schema_ref", &req.input_schema_ref)?;
        validate_required("output_schema_ref", &req.output_schema_ref)?;
        validate_license_policy(&req.license_policy)?;

        let id = req
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let skill = SkillSpec {
            id: id.clone(),
            name: req.name,
            owner: req.owner,
            version: SkillVersion {
                version: req.version,
                changelog: "initial registry preview".to_owned(),
                created_at: now,
            },
            input_schema_ref: req.input_schema_ref,
            output_schema_ref: req.output_schema_ref,
            capabilities: req.capabilities,
            license_policy: req.license_policy,
            sandbox_policy: req.sandbox_policy,
            fixtures: req.fixtures,
            status: SkillStatus::Draft,
            production_route_enabled: false,
            created_at: now,
            updated_at: now,
        };
        {
            let mut skills = self.skills.write();
            if skills.contains_key(&id) {
                return Err(HarnessError::InvalidInput(format!("skill_id={id} exists")));
            }
            skills.insert(id, skill.clone());
        }
        Ok(skill)
    }

    /// List skills.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when pagination cursor is invalid.
    pub fn list_skills(&self, query: &SkillListQuery) -> Result<ListPage<SkillSpec>> {
        let mut items: Vec<SkillSpec> = self
            .skills
            .read()
            .values()
            .filter(|skill| query.status.is_none_or(|status| skill.status == status))
            .filter(|skill| {
                query
                    .owner
                    .as_ref()
                    .is_none_or(|owner| skill.owner == *owner)
            })
            .cloned()
            .collect();
        items.sort_by(|left, right| left.id.cmp(&right.id));
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one skill.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the skill id is unknown.
    pub fn get_skill(&self, skill_id: &str) -> Result<SkillSpec> {
        self.skills
            .read()
            .get(skill_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("skill_id={skill_id}")))
    }

    /// Patch a skill.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the skill id is unknown and
    /// [`HarnessError::InvalidInput`] for forbidden license policies.
    pub fn update_skill(&self, skill_id: &str, req: UpdateSkillRequest) -> Result<SkillSpec> {
        if let Some(policy) = &req.license_policy {
            validate_license_policy(policy)?;
        }
        let mut skill = self.get_skill(skill_id)?;
        if let Some(name) = req.name {
            validate_required("name", &name)?;
            skill.name = name;
        }
        if let Some(owner) = req.owner {
            validate_required("owner", &owner)?;
            skill.owner = owner;
        }
        if let Some(input_schema_ref) = req.input_schema_ref {
            validate_required("input_schema_ref", &input_schema_ref)?;
            skill.input_schema_ref = input_schema_ref;
        }
        if let Some(output_schema_ref) = req.output_schema_ref {
            validate_required("output_schema_ref", &output_schema_ref)?;
            skill.output_schema_ref = output_schema_ref;
        }
        if let Some(capabilities) = req.capabilities {
            skill.capabilities = capabilities;
        }
        if let Some(policy) = req.license_policy {
            skill.license_policy = policy;
            skill.production_route_enabled = false;
            skill.status = SkillStatus::Draft;
        }
        if let Some(sandbox_policy) = req.sandbox_policy {
            skill.sandbox_policy = sandbox_policy;
        }
        if let Some(fixtures) = req.fixtures {
            skill.fixtures = fixtures;
        }
        skill.updated_at = Utc::now();
        self.skills
            .write()
            .insert(skill_id.to_owned(), skill.clone());
        Ok(skill)
    }

    /// Approve a skill for production routing.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the skill id is unknown and
    /// [`HarnessError::InvalidInput`] for forbidden license policies.
    pub fn approve_skill(&self, skill_id: &str, _req: RegistryActionRequest) -> Result<SkillSpec> {
        let mut skill = self.get_skill(skill_id)?;
        validate_license_policy(&skill.license_policy)?;
        skill.status = SkillStatus::Approved;
        skill.production_route_enabled = true;
        skill.updated_at = Utc::now();
        self.skills
            .write()
            .insert(skill_id.to_owned(), skill.clone());
        Ok(skill)
    }

    /// Disable a skill.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the skill id is unknown.
    pub fn disable_skill(&self, skill_id: &str, _req: RegistryActionRequest) -> Result<SkillSpec> {
        let mut skill = self.get_skill(skill_id)?;
        skill.status = SkillStatus::Disabled;
        skill.production_route_enabled = false;
        skill.updated_at = Utc::now();
        self.skills
            .write()
            .insert(skill_id.to_owned(), skill.clone());
        Ok(skill)
    }
}

fn validate_required(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn validate_license_policy(policy: &SkillLicensePolicy) -> Result<()> {
    let normalized = policy.license.to_ascii_uppercase();
    if FORBIDDEN_LICENSES
        .iter()
        .any(|forbidden| normalized.contains(forbidden))
    {
        return Err(HarnessError::LicenseViolation(policy.license.clone()));
    }
    if !policy.commercial_use_allowed {
        return Err(HarnessError::LicenseViolation(policy.license.clone()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::error::HarnessError;

    use super::{
        CreateSkillRequest, RegistryActionRequest, SkillCapability, SkillFixture,
        SkillLicensePolicy, SkillListQuery, SkillRegistryService, SkillSandboxPolicy, SkillStatus,
    };

    fn create_request(id: &str, license: &str) -> CreateSkillRequest {
        CreateSkillRequest {
            id: Some(id.to_owned()),
            name: "Text to BIM".to_owned(),
            owner: "platform".to_owned(),
            version: "0.1.0".to_owned(),
            input_schema_ref: "generation.input.schema.v1".to_owned(),
            output_schema_ref: "artifact.ifc.schema.v1".to_owned(),
            capabilities: vec![SkillCapability {
                id: "text_to_bim".to_owned(),
                description: "mock conversion".to_owned(),
                input_kinds: vec!["text".to_owned()],
                output_kinds: vec!["bim".to_owned()],
            }],
            license_policy: SkillLicensePolicy {
                license: license.to_owned(),
                commercial_use_allowed: true,
                review_note: "free commercial license preferred".to_owned(),
            },
            sandbox_policy: SkillSandboxPolicy {
                profile: "mock_tool_sandbox_no_network".to_owned(),
                network_access: false,
                timeout_ms: 30_000,
                memory_mb: 512,
            },
            fixtures: vec![SkillFixture {
                id: "fixture-1".to_owned(),
                input_ref: "memory://fixtures/text".to_owned(),
                expected_output_schema_ref: "artifact.ifc.schema.v1".to_owned(),
            }],
        }
    }

    #[test]
    fn skill_registry_create_get_approve_disable() {
        let registry = SkillRegistryService::new();
        let skill = registry
            .create_skill(create_request("text_to_bim", "Apache-2.0"))
            .expect("skill should create");
        assert_eq!(skill.status, SkillStatus::Draft);
        assert!(!skill.production_route_enabled);

        let approved = registry
            .approve_skill(
                "text_to_bim",
                RegistryActionRequest {
                    actor: Some("reviewer".to_owned()),
                    comment: None,
                },
            )
            .expect("skill should approve");
        assert_eq!(approved.status, SkillStatus::Approved);
        assert!(approved.production_route_enabled);

        let page = registry
            .list_skills(&SkillListQuery {
                status: Some(SkillStatus::Approved),
                owner: Some("platform".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("list should work");
        assert_eq!(page.items.len(), 1);

        let disabled = registry
            .disable_skill("text_to_bim", RegistryActionRequest::default())
            .expect("skill should disable");
        assert_eq!(disabled.status, SkillStatus::Disabled);
        assert!(!disabled.production_route_enabled);
    }

    #[test]
    fn forbidden_license_policy_is_rejected() {
        let registry = SkillRegistryService::new();
        let err = registry
            .create_skill(create_request("bad", "AGPL-3.0-only"))
            .expect_err("forbidden license should fail");
        assert!(matches!(&err, HarnessError::LicenseViolation(_)));
        assert_eq!(err.http_status(), 400);
        assert!(
            registry
                .create_skill(create_request("vendor", "proprietary_eula"))
                .is_err()
        );
    }

    #[test]
    fn permissive_commercial_licenses_can_be_approved() {
        for license in ["MIT", "Apache-2.0", "BSD-3-Clause"] {
            let registry = SkillRegistryService::new();
            let id = format!("skill-{}", license.to_ascii_lowercase());
            registry
                .create_skill(create_request(&id, license))
                .expect("permissive commercial license should create");
            let approved = registry
                .approve_skill(&id, RegistryActionRequest::default())
                .expect("permissive commercial license should approve");
            assert_eq!(approved.status, SkillStatus::Approved);
            assert!(approved.production_route_enabled);
            assert!(approved.license_policy.commercial_use_allowed);
        }
    }

    #[test]
    fn forbidden_licenses_are_blocked_from_production_route() {
        for license in [
            "GPL-3.0-only",
            "AGPL-3.0-only",
            "LGPL-3.0-only",
            "SSPL-1.0",
            "BUSL-1.1",
            "Commons Clause",
            "proprietary_eula",
        ] {
            let registry = SkillRegistryService::new();
            assert!(
                registry
                    .create_skill(create_request("forbidden", license))
                    .is_err(),
                "{license} must be blocked"
            );
        }
    }

    #[test]
    fn commercial_use_must_be_allowed_before_approval() {
        let registry = SkillRegistryService::new();
        let mut req = create_request("noncommercial", "MIT");
        req.license_policy.commercial_use_allowed = false;
        assert!(
            registry.create_skill(req).is_err(),
            "noncommercial policy must never reach approved status"
        );
    }

    #[test]
    fn skill_registry_filters_and_paginates_stably() {
        let registry = SkillRegistryService::new();
        for id in ["skill-c", "skill-a", "skill-b"] {
            registry
                .create_skill(create_request(id, "MIT"))
                .expect("skill should create");
        }
        registry
            .approve_skill("skill-b", RegistryActionRequest::default())
            .expect("skill-b should approve");

        let first_page = registry
            .list_skills(&SkillListQuery {
                status: None,
                owner: Some("platform".to_owned()),
                limit: Some(2),
                cursor: None,
            })
            .expect("first page should work");
        assert_eq!(
            first_page
                .items
                .iter()
                .map(|skill| skill.id.as_str())
                .collect::<Vec<_>>(),
            vec!["skill-a", "skill-b"]
        );
        assert_eq!(first_page.page_info.next_cursor.as_deref(), Some("2"));

        let second_page = registry
            .list_skills(&SkillListQuery {
                status: None,
                owner: Some("platform".to_owned()),
                limit: Some(2),
                cursor: first_page.page_info.next_cursor,
            })
            .expect("second page should work");
        assert_eq!(
            second_page
                .items
                .iter()
                .map(|skill| skill.id.as_str())
                .collect::<Vec<_>>(),
            vec!["skill-c"]
        );

        let approved = registry
            .list_skills(&SkillListQuery {
                status: Some(SkillStatus::Approved),
                owner: Some("platform".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("approved filter should work");
        assert_eq!(approved.items.len(), 1);
        assert_eq!(approved.items[0].id, "skill-b");
    }
}
