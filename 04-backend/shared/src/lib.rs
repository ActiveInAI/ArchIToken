//! Shared domain types across InsomeOS Rust crates.
//!
//! These are `#[derive(ToSchema)]` so they surface in the OpenAPI spec.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// The nine business-phase enum for AEC projects.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum BusinessPhase {
    /// 售前
    PreSales,
    /// 方案
    Concept,
    /// 深化
    Develop,
    /// 造价
    Costing,
    /// 制造
    Fabrication,
    /// 物流
    Logistics,
    /// 施工
    Construction,
    /// 验收
    Acceptance,
    /// 运维
    Operations,
}

/// A project entity.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Project {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub phase: BusinessPhase,
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
