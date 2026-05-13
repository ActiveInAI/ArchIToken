use super::Module;

pub struct SettingsCenter;

impl Module for SettingsCenter {
    fn id(&self) -> &'static str {
        "settings_center"
    }
    fn zh_name(&self) -> &'static str {
        "设置中心"
    }
    fn en_name(&self) -> &'static str {
        "Settings Center"
    }
    fn order(&self) -> u32 {
        14
    }
    fn description(&self) -> &'static str {
        concat!(
            "全局设置 side-car 模块:租户、用户、RBAC、模型路由、SLA 预算、规范库版本、UI 主题。\n",
            "并列但无上下游——不进入 AEC 工作流图,只为其它 13 个模块提供全局配置。\n",
            "任何模块运行时从 settings_center 拉配置。"
        )
    }
}
