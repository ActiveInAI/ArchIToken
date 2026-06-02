use super::Module;

pub struct PersonalCenter;

impl Module for PersonalCenter {
    fn id(&self) -> &'static str {
        "personal_center"
    }
    fn zh_name(&self) -> &'static str {
        "个人中心"
    }
    fn en_name(&self) -> &'static str {
        "Personal Center"
    }
    fn order(&self) -> u32 {
        1
    }
    fn description(&self) -> &'static str {
        concat!(
            "每个用户进入业务模块前的个人工作入口。\n",
            "统一承载个人资料、账号安全、通知、最近工作、个人审批、收藏和偏好设置。\n",
            "个人中心是平台模块,不是营销页或独立应用。"
        )
    }
}
