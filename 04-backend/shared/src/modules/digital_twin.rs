use super::Module;

pub struct DigitalTwin;

impl Module for DigitalTwin {
    fn id(&self) -> &'static str {
        "digital_twin"
    }
    fn zh_name(&self) -> &'static str {
        "数字孪生"
    }
    fn en_name(&self) -> &'static str {
        "Digital Twin"
    }
    fn order(&self) -> u32 {
        9
    }
    fn description(&self) -> &'static str {
        concat!(
            "竣工模型 + IoT 传感器实时数据流 + 能耗 / 结构健康 / 设备告警的三维运维模块。\n",
            "对接 IFC / glTF / three.js 渲染层与时序数据库。\n",
            "是 AEC 项目\"运维期\"的唯一接口。"
        )
    }
}
