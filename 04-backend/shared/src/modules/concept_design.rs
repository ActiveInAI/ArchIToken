use super::Module;

pub struct ConceptDesign;

impl Module for ConceptDesign {
    fn id(&self) -> &'static str {
        "concept_design"
    }
    fn zh_name(&self) -> &'static str {
        "方案设计"
    }
    fn en_name(&self) -> &'static str {
        "Concept Design"
    }
    fn order(&self) -> u32 {
        4
    }
    fn description(&self) -> &'static str {
        concat!(
            "面向已确认需求的客户输出多方案比选:户型、立面、风格、体量、造价估。\n",
            "产出 3 个候选方案(SVG + 3D + 造价估)供客户选型。\n",
            "覆盖传统 AEC 里的\"方案 / 概念设计\"阶段,但不做施工图深化。"
        )
    }
}
