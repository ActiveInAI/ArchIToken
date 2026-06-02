use super::Module;

pub struct DetailedDesign;

impl Module for DetailedDesign {
    fn id(&self) -> &'static str {
        "detailed_design"
    }
    fn zh_name(&self) -> &'static str {
        "深化设计"
    }
    fn en_name(&self) -> &'static str {
        "Detailed Design"
    }
    fn order(&self) -> u32 {
        6
    }
    fn description(&self) -> &'static str {
        concat!(
            "把选定的概念方案深化为可施工的 BIM + 施工图。\n",
            "包含结构计算、节点详图、机电综合、碰撞检查、规范合规复核。\n",
            "产出 IFC4 + 施工图 PDF + 结构计算书。"
        )
    }
}
