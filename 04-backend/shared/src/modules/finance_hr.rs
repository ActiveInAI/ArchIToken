use super::Module;

pub struct FinanceHr;

impl Module for FinanceHr {
    fn id(&self) -> &'static str {
        "finance_hr"
    }
    fn zh_name(&self) -> &'static str {
        "财务人力"
    }
    fn en_name(&self) -> &'static str {
        "Finance & HR"
    }
    fn order(&self) -> u32 {
        12
    }
    fn description(&self) -> &'static str {
        concat!(
            "合同、收付款、发票、成本、预算、人员、班组、绩效、考勤和组织能力模块。\n",
            "从计划管理、计量造价、材料物流、生产制造和施工管理同步经营数据。\n",
            "为项目利润、资金计划、组织资源和人员绩效提供统一治理。"
        )
    }
}
