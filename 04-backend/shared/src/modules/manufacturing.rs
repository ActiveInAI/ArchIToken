use super::Module;

pub struct Manufacturing;

impl Module for Manufacturing {
    fn id(&self) -> &'static str {
        "manufacturing"
    }
    fn zh_name(&self) -> &'static str {
        "加工制造"
    }
    fn en_name(&self) -> &'static str {
        "Manufacturing"
    }
    fn order(&self) -> u32 {
        7
    }
    fn description(&self) -> &'static str {
        concat!(
            "面向装配式、轻钢、重钢、幕墙、门窗等需要工厂预制的构件。\n",
            "把 BIM 构件翻译成 CNC / 焊接文件 + 加工 BOM + 质检单。\n",
            "对接工厂 MES / ERP,回传加工进度与质检结果。"
        )
    }
}
