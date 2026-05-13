use super::Module;

pub struct DigitalArchive;

impl Module for DigitalArchive {
    fn id(&self) -> &'static str {
        "digital_archive"
    }
    fn zh_name(&self) -> &'static str {
        "数字档案"
    }
    fn en_name(&self) -> &'static str {
        "Digital Archive"
    }
    fn order(&self) -> u32 {
        11
    }
    fn description(&self) -> &'static str {
        concat!(
            "项目级 / 企业级的长期档案留存:合同、图纸、BOQ、验收、IoT 历史、审计日志。\n",
            "支持对接国家 / 地方城建档案馆数字交付规范(如 CJJ/T 117)。\n",
            "是\"项目闭环\"的最后一站,决定多年后能否复盘 / 法律举证。"
        )
    }
}
