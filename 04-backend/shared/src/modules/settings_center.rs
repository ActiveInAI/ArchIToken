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
        16
    }
    fn description(&self) -> &'static str {
        concat!(
            "全局组织身份设置模块:人员、账号、密码、头像、单位、岗位、角色和权限。\n",
            "并列但无上下游——不进入 AEC 工作流图,只为其它 15 个模块提供身份、账号安全和授权边界。\n",
            "任何模块运行时从 settings_center 拉配置。"
        )
    }
}
