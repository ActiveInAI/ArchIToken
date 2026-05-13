use super::Module;

pub struct PlanningManagement;

impl Module for PlanningManagement {
    fn id(&self) -> &'static str {
        "planning_management"
    }
    fn zh_name(&self) -> &'static str {
        "计划管理"
    }
    fn en_name(&self) -> &'static str {
        "Planning Management"
    }
    fn order(&self) -> u32 {
        2
    }
    fn description(&self) -> &'static str {
        concat!(
            "项目立项、WBS、里程碑、资源计划、审批计划与跨模块交付总控模块。\n",
            "承接市场客服形成的商机和需求, 将其转化为可执行的项目计划、责任矩阵和交付节奏。\n",
            "为方案设计、计量造价、生产制造、施工管理和财务人力提供统一计划基线。"
        )
    }
}
