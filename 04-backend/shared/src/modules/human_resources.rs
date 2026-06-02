use super::Module;

pub struct HumanResources;

impl Module for HumanResources {
    fn id(&self) -> &'static str {
        "human_resources"
    }
    fn zh_name(&self) -> &'static str {
        "人力资源"
    }
    fn en_name(&self) -> &'static str {
        "Human Resources"
    }
    fn order(&self) -> u32 {
        14
    }
    fn description(&self) -> &'static str {
        concat!(
            "组织岗位、人员班组、资质证书、考勤工时、培训记录、绩效评估和劳动合规模块。\n",
            "从计划、生产、施工和财务管理同步项目组织与人员结算依据。\n",
            "为项目用工、资质、安全准入、工效和绩效提供统一治理。"
        )
    }
}
