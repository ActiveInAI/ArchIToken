//! Shared domain types across ArchIToken Rust crates.
//!
//! These are `#[derive(ToSchema)]` so they surface in the OpenAPI spec.
//!
//! Projects use `current_module_id: String`; business modules are provided by
//! `modules::registry()` at runtime.
//! 完整规范见 `02-architecture/MODULES.md` 与 `MODULE-REGISTRY.md`.

pub mod modules;

pub use modules::{Module, ModuleRegistry, registry};

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// A project entity.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Project {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// 该项目当前所在模块 (对应 `modules::registry().get(id)`). 空串表示未归属任何模块.
    pub current_module_id: String,
    pub area_sqm: Option<f32>,
    pub location: Option<String>,
    pub budget_cny: Option<i64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Bill of Quantities (BOQ) line item.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BoqItem {
    pub id: Uuid,
    pub project_id: Uuid,
    pub code: String,
    pub description: String,
    pub unit: String,
    pub quantity: f64,
    pub unit_price_cny: f64,
    pub total_cny: f64,
    pub category: String,
}

/// Compliance check result.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ComplianceFinding {
    pub id: Uuid,
    pub project_id: Uuid,
    pub severity: Severity,
    pub regulation_code: String,
    pub regulation_clause: String,
    pub finding: String,
    pub recommendation: String,
    pub element_id: Option<String>,
    pub resolved: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

/// Wraps a successful API response.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiOk<T> {
    pub ok: bool,
    pub data: T,
}

impl<T> ApiOk<T> {
    #[must_use]
    pub const fn new(data: T) -> Self {
        Self { ok: true, data }
    }
}
