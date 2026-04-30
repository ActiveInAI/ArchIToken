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
    skill_registry::RegistryActionRequest,
};

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
        validate_required("name", &req.name)?;
        validate_required("owner", &req.owner)?;
        validate_required("input_schema_ref", &req.input_schema_ref)?;
        validate_required("output_schema_ref", &req.output_schema_ref)?;
        validate_tool_limits(req.timeout_ms, req.rate_limit_per_minute)?;
        if req.permission_scope.operations.is_empty() {
            return Err(HarnessError::InvalidInput(
                "permission_scope.operations is required".to_owned(),
            ));
        }
        let id = req
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let tool = McpToolSpec {
            id: id.clone(),
            name: req.name,
            owner: req.owner,
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
        let items: Vec<McpToolSpec> = self
            .tools
            .read()
            .values()
            .filter(|tool| query.status.is_none_or(|status| tool.status == status))
            .filter(|tool| {
                query
                    .owner
                    .as_ref()
                    .is_none_or(|owner| tool.owner == *owner)
            })
            .cloned()
            .collect();
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown.
    pub fn get_tool(&self, tool_id: &str) -> Result<McpToolSpec> {
        self.tools
            .read()
            .get(tool_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("tool_id={tool_id}")))
    }

    /// Patch one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown and
    /// [`HarnessError::InvalidInput`] for invalid limits.
    pub fn update_tool(&self, tool_id: &str, req: UpdateMcpToolRequest) -> Result<McpToolSpec> {
        if let (Some(timeout_ms), Some(rate_limit)) = (req.timeout_ms, req.rate_limit_per_minute) {
            validate_tool_limits(timeout_ms, rate_limit)?;
        }
        let mut tool = self.get_tool(tool_id)?;
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
            if permission_scope.operations.is_empty() {
                return Err(HarnessError::InvalidInput(
                    "permission_scope.operations is required".to_owned(),
                ));
            }
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
        tool.updated_at = Utc::now();
        self.tools.write().insert(tool_id.to_owned(), tool.clone());
        Ok(tool)
    }

    /// Approve one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown.
    pub fn approve_tool(&self, tool_id: &str, _req: RegistryActionRequest) -> Result<McpToolSpec> {
        let mut tool = self.get_tool(tool_id)?;
        tool.status = McpToolStatus::Approved;
        tool.updated_at = Utc::now();
        self.tools.write().insert(tool_id.to_owned(), tool.clone());
        Ok(tool)
    }

    /// Disable one MCP tool.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the tool id is unknown.
    pub fn disable_tool(&self, tool_id: &str, _req: RegistryActionRequest) -> Result<McpToolSpec> {
        let mut tool = self.get_tool(tool_id)?;
        tool.status = McpToolStatus::Disabled;
        tool.updated_at = Utc::now();
        self.tools.write().insert(tool_id.to_owned(), tool.clone());
        Ok(tool)
    }
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
    if rate_limit_per_minute == 0 {
        return Err(HarnessError::InvalidInput(
            "rate_limit_per_minute must be greater than zero".to_owned(),
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
}
