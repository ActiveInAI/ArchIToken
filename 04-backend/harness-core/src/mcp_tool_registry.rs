//! MCP Tool Registry in-memory preview service.
//!
//! The registry stores MCP tool contracts, permission scopes, schema refs,
//! timeout/rate-limit policy, and audit policy. It never starts or calls a
//! real MCP server in this phase.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::{
    error::{HarnessError, Result},
    module_pagination::{ListPage, PageInfo, paginate},
    runtime_context::{PermissionGuard, RequestContext, RuntimePermission, assert_runtime_scope},
    skill_registry::RegistryActionRequest,
};

const MAX_TIMEOUT_MS: u64 = 300_000;
const MAX_RATE_LIMIT_PER_MINUTE: u32 = 10_000;

/// MCP tool lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpToolStatus {
    /// Draft tool, not eligible for production routes.
    Draft,
    /// Approved tool, eligible for production route selection.
    Approved,
    /// Disabled tool.
    Disabled,
}

/// MCP tool capability declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolCapability {
    /// Capability id, for example `cad_parser`.
    pub id: String,
    /// Capability description.
    pub description: String,
}

/// Permission scope required for an MCP tool.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpPermissionScope {
    /// Tenant scope expression.
    pub tenant_scope: String,
    /// Project scope expression.
    pub project_scope: String,
    /// Allowed operations.
    pub operations: Vec<String>,
}

/// Audit policy for MCP tool calls.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolAuditPolicy {
    /// Whether every tool call must append an audit event.
    pub audit_required: bool,
    /// Whether input payloads may be redacted before audit persistence.
    pub redact_inputs: bool,
    /// Whether output payloads may be redacted before audit persistence.
    pub redact_outputs: bool,
}

/// Registered MCP tool contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolSpec {
    /// Stable tool id.
    pub id: String,
    /// Human-readable tool name.
    pub name: String,
    /// Owner team or user id.
    pub owner: String,
    /// Tenant id used for registry isolation.
    pub tenant_id: String,
    /// Project id used for registry isolation.
    pub project_id: String,
    /// Actor that created the registry record.
    pub created_by: String,
    /// Actor that last updated the registry record.
    pub updated_by: String,
    /// Monotonic in-memory registry record version.
    pub record_version: u32,
    /// Request id that created or last updated the record.
    pub request_id: String,
    /// Correlation id for the registry workflow.
    pub correlation_id: String,
    /// Tool version.
    pub version: String,
    /// Declared capability.
    pub capability: McpToolCapability,
    /// Required permission scope.
    pub permission_scope: McpPermissionScope,
    /// Input JSON schema reference.
    pub input_schema_ref: String,
    /// Output JSON schema reference.
    pub output_schema_ref: String,
    /// Timeout in milliseconds.
    pub timeout_ms: u64,
    /// Rate limit per minute.
    pub rate_limit_per_minute: u32,
    /// Audit policy.
    pub audit_policy: McpToolAuditPolicy,
    /// Current status.
    pub status: McpToolStatus,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Create MCP tool request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMcpToolRequest {
    /// Optional caller-supplied stable tool id.
    pub id: Option<String>,
    /// Human-readable tool name.
    pub name: String,
    /// Owner team or user id.
    pub owner: String,
    /// Tool version.
    pub version: String,
    /// Declared capability.
    pub capability: McpToolCapability,
    /// Required permission scope.
    pub permission_scope: McpPermissionScope,
    /// Input JSON schema reference.
    pub input_schema_ref: String,
    /// Output JSON schema reference.
    pub output_schema_ref: String,
    /// Timeout in milliseconds.
    pub timeout_ms: u64,
    /// Rate limit per minute.
    pub rate_limit_per_minute: u32,
    /// Audit policy.
    pub audit_policy: McpToolAuditPolicy,
}

/// Patch MCP tool request.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMcpToolRequest {
    /// Optional human-readable tool name.
    pub name: Option<String>,
    /// Optional owner.
    pub owner: Option<String>,
    /// Optional version.
    pub version: Option<String>,
    /// Optional capability.
    pub capability: Option<McpToolCapability>,
    /// Optional permission scope.
    pub permission_scope: Option<McpPermissionScope>,
    /// Optional input JSON schema reference.
    pub input_schema_ref: Option<String>,
    /// Optional output JSON schema reference.
    pub output_schema_ref: Option<String>,
    /// Optional timeout in milliseconds.
    pub timeout_ms: Option<u64>,
    /// Optional rate limit per minute.
    pub rate_limit_per_minute: Option<u32>,
    /// Optional audit policy.
    pub audit_policy: Option<McpToolAuditPolicy>,
}

/// MCP tool list query.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct McpToolListQuery {
    /// Optional status filter.
    pub status: Option<McpToolStatus>,
    /// Optional owner filter.
    pub owner: Option<String>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// MCP tool list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolListResponse {
    /// Tools included in this page.
    pub tools: Vec<McpToolSpec>,
    /// Number of tools in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// In-memory MCP Tool Registry preview service.
#[derive(Debug, Clone, Default)]
pub struct McpToolRegistryService {
    tools: Arc<RwLock<HashMap<String, McpToolSpec>>>,
}

impl McpToolRegistryService {
    /// Create an empty registry.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a draft MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for missing fields or duplicate ids.
    pub fn create_tool(&self, req: CreateMcpToolRequest) -> Result<McpToolSpec> {
        self.create_tool_with_context(&RequestContext::development_admin(), req)
    }

    /// Create a draft MCP tool under a runtime context.
    ///
    /// # Errors
    /// Returns permission, validation, or duplicate-id errors.
    pub fn create_tool_with_context(
        &self,
        context: &RequestContext,
        req: CreateMcpToolRequest,
    ) -> Result<McpToolSpec> {
        PermissionGuard::ensure(context, RuntimePermission::RegistryWrite)?;
        validate_required("name", &req.name)?;
        validate_required("owner", &req.owner)?;
        validate_required("input_schema_ref", &req.input_schema_ref)?;
        validate_required("output_schema_ref", &req.output_schema_ref)?;
        validate_tool_limits(req.timeout_ms, req.rate_limit_per_minute)?;
        validate_permission_scope(&req.permission_scope)?;
        let id = req
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let tool = McpToolSpec {
            id: id.clone(),
            name: req.name,
            owner: req.owner,
            tenant_id: context.tenant_id.clone(),
            project_id: context.project_id.clone(),
            created_by: context.actor.clone(),
            updated_by: context.actor.clone(),
            record_version: 1,
            request_id: context.request_id.clone(),
            correlation_id: context.correlation_id.clone(),
            version: req.version,
            capability: req.capability,
            permission_scope: req.permission_scope,
            input_schema_ref: req.input_schema_ref,
            output_schema_ref: req.output_schema_ref,
            timeout_ms: req.timeout_ms,
            rate_limit_per_minute: req.rate_limit_per_minute,
            audit_policy: req.audit_policy,
            status: McpToolStatus::Draft,
            created_at: now,
            updated_at: now,
        };
        {
            let mut tools = self.tools.write();
            if tools.contains_key(&id) {
                return Err(HarnessError::InvalidInput(format!("tool_id={id} exists")));
            }
            tools.insert(id, tool.clone());
        }
        Ok(tool)
    }

    /// List MCP tools.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when pagination cursor is invalid.
    pub fn list_tools(&self, query: &McpToolListQuery) -> Result<ListPage<McpToolSpec>> {
        self.list_tools_with_context(&RequestContext::development_admin(), query)
    }

    /// List MCP tools visible to a runtime context.
    ///
    /// # Errors
    /// Returns permission or pagination errors.
    pub fn list_tools_with_context(
        &self,
        context: &RequestContext,
        query: &McpToolListQuery,
    ) -> Result<ListPage<McpToolSpec>> {
        PermissionGuard::ensure(context, RuntimePermission::RegistryRead)?;
        let mut items: Vec<McpToolSpec> = self
            .tools
            .read()
            .values()
            .filter(|tool| {
                tool.tenant_id == context.tenant_id && tool.project_id == context.project_id
            })
            .filter(|tool| query.status.is_none_or(|status| tool.status == status))
            .filter(|tool| {
                query
                    .owner
                    .as_ref()
                    .is_none_or(|owner| tool.owner == *owner)
            })
            .cloned()
            .collect();
        items.sort_by(|left, right| left.id.cmp(&right.id));
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown.
    pub fn get_tool(&self, tool_id: &str) -> Result<McpToolSpec> {
        self.get_tool_with_context(&RequestContext::development_admin(), tool_id)
    }

    /// Get one MCP tool visible to a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing record, or scope errors.
    pub fn get_tool_with_context(
        &self,
        context: &RequestContext,
        tool_id: &str,
    ) -> Result<McpToolSpec> {
        PermissionGuard::ensure(context, RuntimePermission::RegistryRead)?;
        let tool = self.get_tool_unscoped(tool_id)?;
        assert_tool_scope(context, &tool)?;
        Ok(tool)
    }

    /// Patch one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown and
    /// [`HarnessError::InvalidInput`] for invalid limits.
    pub fn update_tool(&self, tool_id: &str, req: UpdateMcpToolRequest) -> Result<McpToolSpec> {
        self.update_tool_with_context(&RequestContext::development_admin(), tool_id, req)
    }

    /// Patch one MCP tool under a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing record, scope, or validation errors.
    pub fn update_tool_with_context(
        &self,
        context: &RequestContext,
        tool_id: &str,
        req: UpdateMcpToolRequest,
    ) -> Result<McpToolSpec> {
        PermissionGuard::ensure(context, RuntimePermission::RegistryWrite)?;
        if let (Some(timeout_ms), Some(rate_limit)) = (req.timeout_ms, req.rate_limit_per_minute) {
            validate_tool_limits(timeout_ms, rate_limit)?;
        }
        let mut tool = self.get_tool_unscoped(tool_id)?;
        assert_tool_scope(context, &tool)?;
        if let Some(name) = req.name {
            validate_required("name", &name)?;
            tool.name = name;
        }
        if let Some(owner) = req.owner {
            validate_required("owner", &owner)?;
            tool.owner = owner;
        }
        if let Some(version) = req.version {
            tool.version = version;
        }
        if let Some(capability) = req.capability {
            tool.capability = capability;
        }
        if let Some(permission_scope) = req.permission_scope {
            validate_permission_scope(&permission_scope)?;
            tool.permission_scope = permission_scope;
        }
        if let Some(input_schema_ref) = req.input_schema_ref {
            validate_required("input_schema_ref", &input_schema_ref)?;
            tool.input_schema_ref = input_schema_ref;
        }
        if let Some(output_schema_ref) = req.output_schema_ref {
            validate_required("output_schema_ref", &output_schema_ref)?;
            tool.output_schema_ref = output_schema_ref;
        }
        if let Some(timeout_ms) = req.timeout_ms {
            validate_tool_limits(timeout_ms, tool.rate_limit_per_minute)?;
            tool.timeout_ms = timeout_ms;
        }
        if let Some(rate_limit) = req.rate_limit_per_minute {
            validate_tool_limits(tool.timeout_ms, rate_limit)?;
            tool.rate_limit_per_minute = rate_limit;
        }
        if let Some(audit_policy) = req.audit_policy {
            tool.audit_policy = audit_policy;
        }
        tool.status = McpToolStatus::Draft;
        tool.updated_by.clone_from(&context.actor);
        tool.record_version = tool.record_version.saturating_add(1);
        tool.request_id.clone_from(&context.request_id);
        tool.correlation_id.clone_from(&context.correlation_id);
        tool.updated_at = Utc::now();
        self.tools.write().insert(tool_id.to_owned(), tool.clone());
        Ok(tool)
    }

    /// Approve one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown.
    pub fn approve_tool(&self, tool_id: &str, req: RegistryActionRequest) -> Result<McpToolSpec> {
        self.approve_tool_with_context(&RequestContext::development_admin(), tool_id, req)
    }

    /// Approve one MCP tool under a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing record, scope, or validation errors.
    pub fn approve_tool_with_context(
        &self,
        context: &RequestContext,
        tool_id: &str,
        _req: RegistryActionRequest,
    ) -> Result<McpToolSpec> {
        PermissionGuard::ensure(context, RuntimePermission::RegistryApprove)?;
        let mut tool = self.get_tool_unscoped(tool_id)?;
        assert_tool_scope(context, &tool)?;
        validate_permission_scope(&tool.permission_scope)?;
        validate_tool_limits(tool.timeout_ms, tool.rate_limit_per_minute)?;
        if !tool.audit_policy.audit_required {
            return Err(HarnessError::InvalidInput(
                "approved MCP tools require audit_policy.audit_required=true".to_owned(),
            ));
        }
        tool.status = McpToolStatus::Approved;
        tool.updated_by.clone_from(&context.actor);
        tool.record_version = tool.record_version.saturating_add(1);
        tool.request_id.clone_from(&context.request_id);
        tool.correlation_id.clone_from(&context.correlation_id);
        tool.updated_at = Utc::now();
        self.tools.write().insert(tool_id.to_owned(), tool.clone());
        Ok(tool)
    }

    /// Disable one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown.
    pub fn disable_tool(&self, tool_id: &str, req: RegistryActionRequest) -> Result<McpToolSpec> {
        self.disable_tool_with_context(&RequestContext::development_admin(), tool_id, req)
    }

    /// Disable one MCP tool under a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing record, or scope errors.
    pub fn disable_tool_with_context(
        &self,
        context: &RequestContext,
        tool_id: &str,
        _req: RegistryActionRequest,
    ) -> Result<McpToolSpec> {
        PermissionGuard::ensure(context, RuntimePermission::RegistryWrite)?;
        let mut tool = self.get_tool_unscoped(tool_id)?;
        assert_tool_scope(context, &tool)?;
        tool.status = McpToolStatus::Disabled;
        tool.updated_by.clone_from(&context.actor);
        tool.record_version = tool.record_version.saturating_add(1);
        tool.request_id.clone_from(&context.request_id);
        tool.correlation_id.clone_from(&context.correlation_id);
        tool.updated_at = Utc::now();
        self.tools.write().insert(tool_id.to_owned(), tool.clone());
        Ok(tool)
    }
}

impl McpToolRegistryService {
    fn get_tool_unscoped(&self, tool_id: &str) -> Result<McpToolSpec> {
        self.tools
            .read()
            .get(tool_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("tool_id={tool_id}")))
    }
}

fn assert_tool_scope(context: &RequestContext, tool: &McpToolSpec) -> Result<()> {
    assert_runtime_scope(context, &tool.tenant_id, &tool.project_id)
}

fn validate_required(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn validate_tool_limits(timeout_ms: u64, rate_limit_per_minute: u32) -> Result<()> {
    if timeout_ms == 0 {
        return Err(HarnessError::InvalidInput(
            "timeout_ms must be greater than zero".to_owned(),
        ));
    }
    if timeout_ms > MAX_TIMEOUT_MS {
        return Err(HarnessError::InvalidInput(format!(
            "timeout_ms must be <= {MAX_TIMEOUT_MS}"
        )));
    }
    if rate_limit_per_minute == 0 {
        return Err(HarnessError::InvalidInput(
            "rate_limit_per_minute must be greater than zero".to_owned(),
        ));
    }
    if rate_limit_per_minute > MAX_RATE_LIMIT_PER_MINUTE {
        return Err(HarnessError::InvalidInput(format!(
            "rate_limit_per_minute must be <= {MAX_RATE_LIMIT_PER_MINUTE}"
        )));
    }
    Ok(())
}

fn validate_permission_scope(scope: &McpPermissionScope) -> Result<()> {
    validate_required("permission_scope.tenant_scope", &scope.tenant_scope)?;
    validate_required("permission_scope.project_scope", &scope.project_scope)?;
    if scope.operations.is_empty() {
        return Err(HarnessError::InvalidInput(
            "permission_scope.operations is required".to_owned(),
        ));
    }
    if scope
        .operations
        .iter()
        .any(|operation| operation.trim().is_empty())
    {
        return Err(HarnessError::InvalidInput(
            "permission_scope.operations cannot contain empty entries".to_owned(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::skill_registry::RegistryActionRequest;

    use super::{
        CreateMcpToolRequest, McpPermissionScope, McpToolAuditPolicy, McpToolCapability,
        McpToolListQuery, McpToolRegistryService, McpToolStatus,
    };

    fn create_request() -> CreateMcpToolRequest {
        CreateMcpToolRequest {
            id: Some("cad_parser".to_owned()),
            name: "CAD Parser".to_owned(),
            owner: "platform".to_owned(),
            version: "0.1.0".to_owned(),
            capability: McpToolCapability {
                id: "cad_parse".to_owned(),
                description: "parse CAD preview metadata".to_owned(),
            },
            permission_scope: McpPermissionScope {
                tenant_scope: "current_tenant".to_owned(),
                project_scope: "current_project".to_owned(),
                operations: vec!["file:read".to_owned(), "artifact:write".to_owned()],
            },
            input_schema_ref: "mcp.cad_parser.input.schema.v1".to_owned(),
            output_schema_ref: "mcp.cad_parser.output.schema.v1".to_owned(),
            timeout_ms: 30_000,
            rate_limit_per_minute: 60,
            audit_policy: McpToolAuditPolicy {
                audit_required: true,
                redact_inputs: true,
                redact_outputs: false,
            },
        }
    }

    #[test]
    fn mcp_tool_registry_create_get_approve_disable() {
        let registry = McpToolRegistryService::new();
        let tool = registry
            .create_tool(create_request())
            .expect("tool should create");
        assert_eq!(tool.status, McpToolStatus::Draft);
        assert_eq!(
            registry
                .get_tool("cad_parser")
                .expect("tool exists")
                .permission_scope
                .tenant_scope,
            "current_tenant"
        );

        let approved = registry
            .approve_tool("cad_parser", RegistryActionRequest::default())
            .expect("tool should approve");
        assert_eq!(approved.status, McpToolStatus::Approved);

        let page = registry
            .list_tools(&McpToolListQuery {
                status: Some(McpToolStatus::Approved),
                owner: Some("platform".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("list should work");
        assert_eq!(page.items.len(), 1);

        let disabled = registry
            .disable_tool("cad_parser", RegistryActionRequest::default())
            .expect("tool should disable");
        assert_eq!(disabled.status, McpToolStatus::Disabled);
    }

    #[test]
    fn mcp_tool_requires_limits_and_scope() {
        let registry = McpToolRegistryService::new();
        let mut req = create_request();
        req.rate_limit_per_minute = 0;
        assert!(registry.create_tool(req).is_err());
    }

    #[test]
    fn mcp_tool_permission_scope_requires_tenant_project_and_operations() {
        let registry = McpToolRegistryService::new();
        let mut req = create_request();
        req.permission_scope.tenant_scope.clear();
        assert!(registry.create_tool(req).is_err());

        let mut req = create_request();
        req.permission_scope.project_scope.clear();
        assert!(registry.create_tool(req).is_err());

        let mut req = create_request();
        req.permission_scope.operations = vec![String::new()];
        assert!(registry.create_tool(req).is_err());
    }

    #[test]
    fn mcp_tool_timeout_and_rate_limit_boundaries_are_enforced() {
        let registry = McpToolRegistryService::new();
        let mut req = create_request();
        req.timeout_ms = 300_001;
        assert!(registry.create_tool(req).is_err());

        let mut req = create_request();
        req.rate_limit_per_minute = 10_001;
        assert!(registry.create_tool(req).is_err());

        let mut req = create_request();
        req.id = Some("boundary_tool".to_owned());
        req.timeout_ms = 300_000;
        req.rate_limit_per_minute = 10_000;
        assert!(registry.create_tool(req).is_ok());
    }

    #[test]
    fn approved_mcp_tools_require_audit_policy() {
        let registry = McpToolRegistryService::new();
        let mut req = create_request();
        req.audit_policy.audit_required = false;
        registry
            .create_tool(req)
            .expect("draft tool may be created before audit review");

        assert!(
            registry
                .approve_tool("cad_parser", RegistryActionRequest::default())
                .is_err()
        );
    }

    #[test]
    fn mcp_tool_registry_filters_and_paginates_stably() {
        let registry = McpToolRegistryService::new();
        for id in ["tool-c", "tool-a", "tool-b"] {
            let mut req = create_request();
            req.id = Some(id.to_owned());
            req.owner = "platform".to_owned();
            registry.create_tool(req).expect("tool should create");
        }
        registry
            .approve_tool("tool-b", RegistryActionRequest::default())
            .expect("tool-b should approve");

        let first_page = registry
            .list_tools(&McpToolListQuery {
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
                .map(|tool| tool.id.as_str())
                .collect::<Vec<_>>(),
            vec!["tool-a", "tool-b"]
        );

        let second_page = registry
            .list_tools(&McpToolListQuery {
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
                .map(|tool| tool.id.as_str())
                .collect::<Vec<_>>(),
            vec!["tool-c"]
        );

        let approved = registry
            .list_tools(&McpToolListQuery {
                status: Some(McpToolStatus::Approved),
                owner: Some("platform".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("approved filter should work");
        assert_eq!(approved.items.len(), 1);
        assert_eq!(approved.items[0].id, "tool-b");
    }
}
