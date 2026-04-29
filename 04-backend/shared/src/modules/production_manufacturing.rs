use super::Module;

pub struct ProductionManufacturing;

impl Module for ProductionManufacturing {
    fn id(&self) -> &'static str {
        "production_manufacturing"
    }
    fn zh_name(&self) -> &'static str {
        "生产制造"
    }
    fn en_name(&self) -> &'static str {
        "Production Manufacturing"
    }
    fn order(&self) -> u32 {
        7
    }
    fn description(&self) -> &'static str {
        concat!(
            "面向重钢结构、装配式构件和工厂预制全流程。\n",
            "把 BIM 构件翻译成 CNC / 焊接文件 + 加工 BOM + 质检单。\n",
            "对接工厂 MES / ERP,回传加工进度、发运批次与质检结果。"
        )
    }
}
