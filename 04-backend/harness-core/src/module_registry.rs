//! `ArchIToken` module registry contract.
//!
//! The active registry is string-based rather than enum-based so new modules
//! can be added without rewriting callers.

use serde::Serialize;
use utoipa::ToSchema;

/// Active `ArchIToken` module ids in lifecycle order.
pub const ACTIVE_MODULE_IDS: [&str; 14] = [
    "marketing_service",
    "planning_management",
    "concept_design",
    "standard_library",
    "detailed_design",
    "quantity_costing",
    "material_logistics",
    "production_manufacturing",
    "construction_management",
    "digital_twin",
    "digital_archive",
    "finance_hr",
    "ai_center",
    "settings_center",
];

/// Active module identifier.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[schema(value_type = String, example = "production_manufacturing")]
pub struct ModuleId(String);

impl ModuleId {
    /// Return the normalized string id.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for ModuleId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Module rollout status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ModuleStatus {
    /// Fully active module.
    Active,
    /// Pilot module available for limited workflows.
    Pilot,
    /// Planned module with contract-first implementation.
    Planned,
    /// Foundation module used by other modules.
    Foundation,
}

/// Business track for grouping modules in navigation and governance views.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ModuleTrack {
    /// Customer intake and service track.
    Customer,
    /// Design authoring and review track.
    Design,
    /// Standards, rule, and governance track.
    Governance,
    /// Quantity and costing track.
    Cost,
    /// Supply chain and logistics track.
    Supply,
    /// Factory production track.
    Factory,
    /// Site management track.
    Site,
    /// Digital twin track.
    Twin,
    /// Digital archive track.
    Archive,
    /// Platform settings track.
    Platform,
}

/// Module registry response used by `GET /v1/modules/{module_id}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ModuleSpec {
    /// Active module id.
    pub id: ModuleId,
    /// Lifecycle order used by platform navigation.
    pub order: u8,
    /// Chinese display name.
    pub zh_name: String,
    /// English display name.
    pub en_name: String,
    /// Module grouping track.
    pub track: ModuleTrack,
    /// Current rollout status.
    pub status: ModuleStatus,
    /// Short purpose statement.
    pub summary: String,
    /// Frontend route aligned with the module workbench.
    pub route_href: String,
    /// Module schema reference reserved for `OpenAPI` / `JSON Schema` integration.
    pub schema_ref: String,
}

#[derive(Debug, Clone, Copy)]
struct ModuleSeed {
    id: &'static str,
    order: u8,
    zh_name: &'static str,
    en_name: &'static str,
    track: ModuleTrack,
    status: ModuleStatus,
    summary: &'static str,
}

const MODULE_SEEDS: [ModuleSeed; 14] = [
    ModuleSeed {
        id: "marketing_service",
        order: 1,
        zh_name: "市场客服",
        en_name: "Marketing Service",
        track: ModuleTrack::Customer,
        status: ModuleStatus::Planned,
        summary: "客户线索、咨询对话、需求采集、报价草案与移交方案设计。",
    },
    ModuleSeed {
        id: "planning_management",
        order: 2,
        zh_name: "计划管理",
        en_name: "Planning Management",
        track: ModuleTrack::Governance,
        status: ModuleStatus::Planned,
        summary: "项目立项、WBS、里程碑、资源计划、审批计划与跨模块交付总控。",
    },
    ModuleSeed {
        id: "concept_design",
        order: 3,
        zh_name: "方案设计",
        en_name: "Concept Design",
        track: ModuleTrack::Design,
        status: ModuleStatus::Pilot,
        summary: "场地条件、方案草图、风格选型、指标分析与初步模型生成。",
    },
    ModuleSeed {
        id: "standard_library",
        order: 4,
        zh_name: "标准族库",
        en_name: "Standard Library",
        track: ModuleTrack::Governance,
        status: ModuleStatus::Foundation,
        summary: "标准规范、族库构件、样板文件、材质库、做法库、规则库与版本库。",
    },
    ModuleSeed {
        id: "detailed_design",
        order: 5,
        zh_name: "深化设计",
        en_name: "Detailed Design",
        track: ModuleTrack::Design,
        status: ModuleStatus::Pilot,
        summary: "IFC 模型、DWG 图纸、节点深化、结构连接、管线协调与碰撞检查。",
    },
    ModuleSeed {
        id: "quantity_costing",
        order: 6,
        zh_name: "计量造价",
        en_name: "Quantity Costing",
        track: ModuleTrack::Cost,
        status: ModuleStatus::Planned,
        summary: "工程量、BOQ、清单、成本测算、价格库与变更估算。",
    },
    ModuleSeed {
        id: "material_logistics",
        order: 7,
        zh_name: "材料物流",
        en_name: "Material Logistics",
        track: ModuleTrack::Supply,
        status: ModuleStatus::Pilot,
        summary: "库存、供应商、询价比价、采购计划、下料单、包装、装车、物流和签收。",
    },
    ModuleSeed {
        id: "production_manufacturing",
        order: 8,
        zh_name: "生产制造",
        en_name: "Production Manufacturing",
        track: ModuleTrack::Factory,
        status: ModuleStatus::Pilot,
        summary: "生产计划、工序路线、CNC、焊接、涂装、质检、MES/ERP、发运和 Paperclip v2026.517.0 模块内 Agent 编排。",
    },
    ModuleSeed {
        id: "construction_management",
        order: 9,
        zh_name: "施工管理",
        en_name: "Construction Management",
        track: ModuleTrack::Site,
        status: ModuleStatus::Active,
        summary: "施工方案、进度、质量、安全、日志、AR、360、扫描、无人机、机器人、IoT、整改和竣工资料。",
    },
    ModuleSeed {
        id: "digital_twin",
        order: 10,
        zh_name: "数字孪生",
        en_name: "Digital Twin",
        track: ModuleTrack::Twin,
        status: ModuleStatus::Active,
        summary: "WebGPU 优先、Three.js fallback、IFC/GLB/点云/360/扫描/倾斜摄影与叠加图层。",
    },
    ModuleSeed {
        id: "digital_archive",
        order: 11,
        zh_name: "数字档案",
        en_name: "Digital Archive",
        track: ModuleTrack::Archive,
        status: ModuleStatus::Planned,
        summary: "合同、图纸、模型、审批记录、施工日志、质量安全记录、竣工资料与版本链。",
    },
    ModuleSeed {
        id: "finance_hr",
        order: 12,
        zh_name: "财务人力",
        en_name: "Finance & HR",
        track: ModuleTrack::Cost,
        status: ModuleStatus::Planned,
        summary: "合同、收付款、发票、成本、预算、人员、班组、绩效、考勤和组织能力。",
    },
    ModuleSeed {
        id: "ai_center",
        order: 13,
        zh_name: "AI中心",
        en_name: "AI Capability Center",
        track: ModuleTrack::Platform,
        status: ModuleStatus::Foundation,
        summary: "企业 AI、API、RAG、MCP、Agent、模型路由、工具权限、安全审计和成本策略。",
    },
    ModuleSeed {
        id: "settings_center",
        order: 14,
        zh_name: "设置中心",
        en_name: "Settings Center",
        track: ModuleTrack::Platform,
        status: ModuleStatus::Foundation,
        summary: "租户设置、模块开关、用户角色、权限策略、模型路由、存储适配器与审计策略。",
    },
];

/// Return all active modules in lifecycle order.
#[must_use]
pub fn list_modules() -> Vec<ModuleSpec> {
    MODULE_SEEDS.iter().map(module_from_seed).collect()
}

/// Return a module by active id.
#[must_use]
pub fn get_module(module_id: &str) -> Option<ModuleSpec> {
    let normalized = normalize_module_id(module_id)?;
    MODULE_SEEDS
        .iter()
        .find(|seed| seed.id == normalized.as_str())
        .map(module_from_seed)
}

/// Normalize an input module id into an active module id.
#[must_use]
pub fn normalize_module_id(module_id: &str) -> Option<ModuleId> {
    let canonical = canonicalize(module_id);
    if is_active_module_key(&canonical) {
        return Some(ModuleId(canonical));
    }
    None
}

/// Return `true` only for active module ids.
#[must_use]
pub fn is_active_module_id(module_id: &str) -> bool {
    is_active_module_key(&canonicalize(module_id))
}

fn canonicalize(module_id: &str) -> String {
    module_id.trim().to_ascii_lowercase().replace('-', "_")
}

fn is_active_module_key(module_id: &str) -> bool {
    ACTIVE_MODULE_IDS.contains(&module_id)
}

fn module_from_seed(seed: &ModuleSeed) -> ModuleSpec {
    ModuleSpec {
        id: ModuleId(seed.id.to_owned()),
        order: seed.order,
        zh_name: seed.zh_name.to_owned(),
        en_name: seed.en_name.to_owned(),
        track: seed.track,
        status: seed.status,
        summary: seed.summary.to_owned(),
        route_href: format!("/app/modules/{}", seed.id),
        schema_ref: format!("module.schema/{}.v1", seed.id),
    }
}

#[cfg(test)]
mod tests {
    use super::{get_module, is_active_module_id, list_modules, normalize_module_id};

    #[test]
    fn active_registry_has_14_modules() {
        assert_eq!(list_modules().len(), 14);
    }

    #[test]
    fn production_manufacturing_exists() {
        assert!(is_active_module_id("production_manufacturing"));
        assert!(get_module("production_manufacturing").is_some());
    }

    #[test]
    fn unknown_module_returns_none() {
        assert!(normalize_module_id("unknown_module").is_none());
        assert!(get_module("unknown_module").is_none());
    }
}
