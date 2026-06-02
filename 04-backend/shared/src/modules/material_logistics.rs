use super::Module;

pub struct MaterialLogistics;

impl Module for MaterialLogistics {
    fn id(&self) -> &'static str {
        "material_logistics"
    }
    fn zh_name(&self) -> &'static str {
        "材料物流"
    }
    fn en_name(&self) -> &'static str {
        "Material Logistics"
    }
    fn order(&self) -> u32 {
        8
    }
    fn description(&self) -> &'static str {
        concat!(
            "从 BOQ 与加工 BOM 反推采购、运输、到场、进场验收全流程。\n",
            "产出运输路径、吊装顺序、进场时间窗、场地堆料计划。"
        )
    }
}
