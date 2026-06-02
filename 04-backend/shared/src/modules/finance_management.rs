use super::Module;

pub struct FinanceManagement;

impl Module for FinanceManagement {
    fn id(&self) -> &'static str {
        "finance_management"
    }
    fn zh_name(&self) -> &'static str {
        "财务管理"
    }
    fn en_name(&self) -> &'static str {
        "Finance Management"
    }
    fn order(&self) -> u32 {
        13
    }
    fn description(&self) -> &'static str {
        concat!(
            "按 K2617 智能会计平台手册运行的财务管理模块:系统参数、分录类型、凭证模板、凭证生成和财务核对。\n",
            "从计划管理、计量造价、材料物流、生产制造和施工管理同步可生成凭证和可对账的业务单据。\n",
            "为总账凭证生成、业务报表核对、差异分析和财务审计提供统一治理。"
        )
    }
}
