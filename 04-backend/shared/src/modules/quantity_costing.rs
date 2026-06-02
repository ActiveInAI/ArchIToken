use super::Module;

pub struct QuantityCosting;

impl Module for QuantityCosting {
    fn id(&self) -> &'static str {
        "quantity_costing"
    }
    fn zh_name(&self) -> &'static str {
        "计量造价"
    }
    fn en_name(&self) -> &'static str {
        "Quantity & Costing"
    }
    fn order(&self) -> u32 {
        7
    }
    fn description(&self) -> &'static str {
        concat!(
            "从 BIM / 图纸抽取工程量清单 (BOQ),结合材料市场价、人工定额、机械台班产出详细造价。\n",
            "支持中式清单计价(GB 50500)与欧美 BOQ / CSI MasterFormat 双口径。\n",
            "对接标准族库的材料目录。"
        )
    }
}
