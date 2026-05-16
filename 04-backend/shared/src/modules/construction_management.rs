use super::Module;

pub struct ConstructionManagement;

impl Module for ConstructionManagement {
    fn id(&self) -> &'static str {
        "construction_management"
    }
    fn zh_name(&self) -> &'static str {
        "施工管理"
    }
    fn en_name(&self) -> &'static str {
        "Construction Management"
    }
    fn order(&self) -> u32 {
        9
    }
    fn description(&self) -> &'static str {
        concat!(
            "现场施工管理 + 验收闭环一体化的模块(合并原 v2.0 的\"施工\"+\"验收\")。\n",
            "4D 施工模拟、进度计划、班组调度、安全检查、工序报验、分部分项验收、隐蔽工程影像留痕。\n",
            "产出进度报表、施工日志、验收报告与整改清单。"
        )
    }
}
