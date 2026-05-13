use super::Module;

pub struct ConstructionSupervision;

impl Module for ConstructionSupervision {
    fn id(&self) -> &'static str {
        "construction_supervision"
    }
    fn zh_name(&self) -> &'static str {
        "施工监理"
    }
    fn en_name(&self) -> &'static str {
        "Construction Supervision"
    }
    fn order(&self) -> u32 {
        9
    }
    fn description(&self) -> &'static str {
        concat!(
            "现场施工 + 监理验收一体化的模块(合并原 v2.0 的\"施工\"+\"验收\")。\n",
            "4D 施工模拟、进度计划、班组调度、安全检查、工序报验、分部分项验收、隐蔽工程影像留痕。\n",
            "产出进度报表、监理日志、验收报告与整改清单。"
        )
    }
}
