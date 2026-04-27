//! Tool registry — the "Tools" module of the 5-module Harness (§2).
//!
//! Each tool is atomic, composable, and describable. All tool executions
//! go through a sandbox that enforces permission checks before dispatch.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::instrument;

use crate::error::{HarnessError, Result};
use crate::permissions::{Claims, Permission};

/// Description of a tool exposed to agents (JSON-schema compatible).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
    pub parameters_schema: serde_json::Value,
    /// Permissions required to invoke this tool.
    pub required_permissions: Vec<Permission>,
    /// Whether this tool mutates state (for audit).
    pub mutating: bool,
}

/// A tool implementation.
#[async_trait]
pub trait Tool: Send + Sync {
    fn spec(&self) -> &ToolSpec;

    /// Execute the tool with the supplied JSON arguments.
    async fn execute(&self, args: serde_json::Value) -> Result<serde_json::Value>;
}

/// The tool registry with permission-aware dispatch.
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        self.tools.insert(tool.spec().name.clone(), tool);
    }

    /// List tools visible to the given caller (RBAC filtered).
    #[must_use]
    pub fn list_for(&self, claims: &Claims) -> Vec<ToolSpec> {
        self.tools
            .values()
            .filter(|t| t.spec().required_permissions.iter().all(|p| claims.has(*p)))
            .map(|t| t.spec().clone())
            .collect()
    }

    /// Dispatch a tool call if the caller is authorized.
    ///
    /// # Errors
    /// Returns `SandboxDenied` on permission failure,
    /// `InvalidInput` on unknown tool.
    #[instrument(skip(self, claims, args), fields(tool = %name))]
    pub async fn dispatch(
        &self,
        name: &str,
        args: serde_json::Value,
        claims: &Claims,
    ) -> Result<serde_json::Value> {
        let tool = self
            .tools
            .get(name)
            .ok_or_else(|| HarnessError::InvalidInput(format!("unknown tool: {name}")))?;

        for p in &tool.spec().required_permissions {
            if !claims.has(*p) {
                return Err(HarnessError::SandboxDenied(format!(
                    "permission {p:?} required for {name}"
                )));
            }
        }

        tool.execute(args).await
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}
