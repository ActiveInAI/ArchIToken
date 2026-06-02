use super::Module;

pub struct MarketingService;

impl Module for MarketingService {
    fn id(&self) -> &'static str {
        "marketing_service"
    }
    fn zh_name(&self) -> &'static str {
        "市场客服"
    }
    fn en_name(&self) -> &'static str {
        "Marketing Service"
    }
    fn order(&self) -> u32 {
        2
    }
    fn description(&self) -> &'static str {
        concat!(
            "项目初期客户接洽、线索获取、需求收集、初步方案沟通的入口模块。\n",
            "承接从\"客户敲门\"到\"签意向书\"之间的全部对话与资料留痕。\n",
            "是 ArchIToken 里唯一面向潜客的模块,也是商机→项目的转化点。"
        )
    }
}
