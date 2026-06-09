"""Module compliance profiles used by agent gates.

The profiles are registry data for professional roles, standards, rules and
signoff policy. They are intentionally conservative: a profile gives the agent
the boundary it must respect, not authority to claim compliance.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ModuleComplianceProfile:
    """Professional and standards boundary for one module."""

    module_id: str
    professional_roles: tuple[str, ...]
    regulatory_profile: tuple[str, ...]
    standards_profile: tuple[str, ...]
    rule_set: tuple[str, ...]
    signoff_policy: str = "professional_review_required"
    schema_ref: str = ""

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        return {
            **payload,
            "professional_roles": list(self.professional_roles),
            "regulatory_profile": list(self.regulatory_profile),
            "standards_profile": list(self.standards_profile),
            "rule_set": list(self.rule_set),
            "schema_ref": self.schema_ref
            or f"module.schema/{self.module_id}.v1",
        }


COMMON_REGULATORY = (
    "项目所在地监管要求",
    "项目合同与组织授权矩阵",
    "企业内控、审计与数据分级策略",
)

COMMON_RULES = (
    "AI 输出只能作为 draft_assist 或 professional_review_required",
    "缺少来源、版本、证据或责任主体时只能输出 heuristic 建议",
    "写入、外发、删除、审批、付款和发布动作必须经过权限与审计边界",
)


def _profile(
    module_id: str,
    roles: tuple[str, ...],
    standards: tuple[str, ...],
    rules: tuple[str, ...] = (),
    regulatory: tuple[str, ...] = COMMON_REGULATORY,
) -> ModuleComplianceProfile:
    return ModuleComplianceProfile(
        module_id=module_id,
        professional_roles=roles,
        regulatory_profile=regulatory,
        standards_profile=standards,
        rule_set=COMMON_RULES + rules,
    )


MODULE_COMPLIANCE_PROFILES: dict[str, ModuleComplianceProfile] = {
    "personal_center": _profile(
        "personal_center",
        ("个人数据保护负责人", "组织治理负责人", "IT/IAM 管理员"),
        ("个人信息保护与数据安全要求", "组织授权矩阵", "企业信息安全制度"),
    ),
    "marketing_service": _profile(
        "marketing_service",
        ("IPMP/IPMA 项目管理", "合同/法务负责人", "注册建筑师", "注册造价工程师"),
        ("项目合同", "设计任务书", "电子合同/电子签章规则", "企业客户管理制度"),
    ),
    "planning_management": _profile(
        "planning_management",
        ("IPMP/IPMA 项目管理", "项目负责人", "计划控制负责人"),
        ("ISO 21502", "IPMA ICB", "GB/T 50326", "项目合同与 WBS 基线"),
    ),
    "concept_design": _profile(
        "concept_design",
        ("一级注册建筑师", "一级注册结构工程师", "注册造价工程师"),
        ("现行国家/行业/地方设计标准", "ISO 19650", "项目设计任务书"),
    ),
    "standard_library": _profile(
        "standard_library",
        ("标准库管理员", "专业负责人", "AI 治理负责人"),
        ("国家/行业/地方/团体/企业标准", "bSDD/IDS/IFC 语义基线", "标准版本管理制度"),
        ("标准状态、版本、来源不明时必须阻断合规结论",),
    ),
    "detailed_design": _profile(
        "detailed_design",
        ("一级注册建筑师", "一级注册结构工程师", "专项工程师", "深化设计负责人"),
        ("现行建筑/结构/机电/消防规范", "IFC/IDS/bSDD", "项目标准与合同"),
        ("施工图、节点、BOM、模型和计算书均需责任人复核",),
    ),
    "quantity_costing": _profile(
        "quantity_costing",
        ("注册造价工程师", "成本负责人", "财务审计负责人"),
        ("GB 50500", "项目清单计价规则", "合同计量支付条款", "税务与会计规则"),
    ),
    "material_logistics": _profile(
        "material_logistics",
        ("采购负责人", "物流运输负责人", "海关/贸易合规负责人", "质量负责人"),
        ("采购合同", "运输与仓储规则", "海关/贸易合规规则", "材料认证规则"),
    ),
    "production_manufacturing": _profile(
        "production_manufacturing",
        ("生产制造负责人", "质量负责人", "焊接/涂装专项负责人", "一级注册结构工程师"),
        ("ISO 9001", "ISO 14001", "ISO 45001", "GB 50205", "GB 50661", "AWS/AISC/EN 1090"),
    ),
    "construction_management": _profile(
        "construction_management",
        ("一级注册建造师", "注册监理工程师", "安全负责人", "质量负责人"),
        ("GB 50300", "GB 50205", "JGJ 安全技术规程", "施工组织设计", "监理规划"),
        ("检验批、隐蔽验收、安全许可和竣工验收不得由 AI 直接通过",),
    ),
    "digital_twin": _profile(
        "digital_twin",
        ("运维负责人", "注册监理工程师", "数据安全负责人", "设施管理负责人"),
        ("ISO 19650", "ISO 55000", "IoT/网络安全规则", "项目运维手册"),
    ),
    "digital_archive": _profile(
        "digital_archive",
        ("档案负责人", "审计负责人", "项目负责人", "法务/合规负责人"),
        ("档案管理制度", "电子签章/电子文件规则", "合同归档要求", "审计留痕规则"),
    ),
    "finance_management": _profile(
        "finance_management",
        ("财务会计负责人", "税务负责人", "审计负责人", "金融/风控负责人"),
        ("会计准则", "税务规则", "发票与结算制度", "内控与反舞弊规则"),
        ("付款、开票、结算、报税和入账状态必须由真实业务凭证支撑",),
    ),
    "human_resources": _profile(
        "human_resources",
        ("人力资源负责人", "劳动合规负责人", "组织治理负责人"),
        ("劳动合同与用工规则", "社保/薪酬/工时规则", "ISO 30414", "岗位授权矩阵"),
    ),
    "ai_center": _profile(
        "ai_center",
        ("AI 治理负责人", "数据保护负责人", "DevSecOps 负责人", "成本治理负责人"),
        (
            "ISO/IEC 42001",
            "ISO/IEC 23894",
            "ISO/IEC 27001",
            "NIST AI RMF",
            "模型供应链与许可证规则",
        ),
        ("业务模块不得直连模型供应商；必须通过 Router/ModelRouter/InferenceRouter",),
    ),
    "settings_center": _profile(
        "settings_center",
        ("组织治理负责人", "IAM 管理员", "数据安全负责人", "审计负责人"),
        ("RBAC/ABAC 授权矩阵", "ISO/IEC 27001", "数据分级制度", "企业内控制度"),
    ),
}


def compliance_profile_for(module_id: str) -> ModuleComplianceProfile | None:
    """Return the compliance profile registered for a module."""

    return MODULE_COMPLIANCE_PROFILES.get(module_id)


def validate_module_compliance(module_id: str) -> list[str]:
    """Validate that a module has the minimum production compliance profile."""

    profile = compliance_profile_for(module_id)
    if profile is None:
        return [f"missing compliance profile for module_id={module_id}"]

    errors: list[str] = []
    if not profile.professional_roles:
        errors.append("professional_roles is required")
    if not profile.regulatory_profile:
        errors.append("regulatory_profile is required")
    if not profile.standards_profile:
        errors.append("standards_profile is required")
    if not profile.rule_set:
        errors.append("rule_set is required")
    if profile.signoff_policy != "professional_review_required":
        errors.append("signoff_policy must keep AI outputs under professional review")
    return errors
