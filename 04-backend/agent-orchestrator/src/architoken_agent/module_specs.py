"""Runtime module registry for the agent orchestrator.

The orchestrator treats module ids as registry data instead of a static enum.
This mirrors the Rust/SQL/frontend Module Registry contract while keeping the
Python runner registry lightweight.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ModuleSpec:
    """One active business-module registration entry."""

    id: str
    zh_name: str
    en_name: str
    order: int
    description: str
    prompt_dir: str | None = None
    enabled: bool = True

    def __post_init__(self) -> None:
        if self.prompt_dir is None:
            object.__setattr__(self, "prompt_dir", self.id)


MODULE_REGISTRY: dict[str, ModuleSpec] = {
    spec.id: spec
    for spec in [
        ModuleSpec(
            "personal_center",
            "个人中心",
            "Personal Center",
            1,
            "个人工作入口、通知、审批和偏好。",
        ),
        ModuleSpec(
            "marketing_service",
            "市场客服",
            "Marketing Service",
            2,
            "客户线索、需求收集和商机转项目。",
        ),
        ModuleSpec(
            "planning_management",
            "计划管理",
            "Planning Management",
            3,
            "项目计划、WBS、资源和审批总控。",
        ),
        ModuleSpec(
            "concept_design",
            "方案设计",
            "Concept Design",
            4,
            "多方案比选、初步模型和方案证据。",
        ),
        ModuleSpec(
            "standard_library",
            "标准族库",
            "Standard Library",
            5,
            "标准、族库、材料和规则来源。",
        ),
        ModuleSpec(
            "detailed_design",
            "深化设计",
            "Detailed Design",
            6,
            "BIM、施工图、节点和深化证据。",
        ),
        ModuleSpec(
            "quantity_costing",
            "计量造价",
            "Quantity & Costing",
            7,
            "工程量、清单、造价和审核。",
        ),
        ModuleSpec(
            "material_logistics",
            "材料物流",
            "Material Logistics",
            8,
            "采购、运输、到货和批次追踪。",
        ),
        ModuleSpec(
            "production_manufacturing",
            "生产制造",
            "Production Manufacturing",
            9,
            "工单、CNC、质检和发运。",
        ),
        ModuleSpec(
            "construction_management",
            "施工管理",
            "Construction Management",
            10,
            "施工、质量、安全和验收闭环。",
        ),
        ModuleSpec(
            "digital_twin",
            "数字孪生",
            "Digital Twin",
            11,
            "施工、质量、IoT 和孪生证据层。",
        ),
        ModuleSpec(
            "digital_archive",
            "数字档案",
            "Digital Archive",
            12,
            "长期档案、归档包和审计证据。",
        ),
        ModuleSpec(
            "finance_management",
            "财务管理",
            "Finance Management",
            13,
            "凭证、对账、结算和财务审计。",
        ),
        ModuleSpec(
            "human_resources",
            "人力资源",
            "Human Resources",
            14,
            "人员、岗位、资质、考勤和合规。",
        ),
        ModuleSpec(
            "ai_center",
            "AI中心",
            "AI Capability Center",
            15,
            "AI、API、RAG、MCP、Agent 和成本治理。",
        ),
        ModuleSpec(
            "settings_center",
            "设置中心",
            "Settings Center",
            16,
            "组织身份、权限、角色和平台设置。",
        ),
    ]
}

ACTIVE_MODULE_IDS: tuple[str, ...] = tuple(
    spec.id
    for spec in sorted(MODULE_REGISTRY.values(), key=lambda item: item.order)
    if spec.enabled
)


def normalize_module_id(module_id: str) -> str | None:
    """Normalize a user/API module id and return the registered id."""

    normalized = module_id.strip().lower().replace("-", "_")
    if normalized == "finance_hr":
        normalized = "finance_management"
    elif normalized in ("manufacturing", "fabrication"):
        # Module baseline rename (#3): retired ids alias to the canonical id.
        normalized = "production_manufacturing"
    if normalized in MODULE_REGISTRY and MODULE_REGISTRY[normalized].enabled:
        return normalized
    return None


def list_module_specs(enabled_only: bool = True) -> list[ModuleSpec]:
    """Return module specs in registry order."""

    specs = sorted(MODULE_REGISTRY.values(), key=lambda item: item.order)
    return [spec for spec in specs if spec.enabled] if enabled_only else specs
