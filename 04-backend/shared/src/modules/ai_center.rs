use super::Module;

pub struct AiCenter;

impl Module for AiCenter {
    fn id(&self) -> &'static str {
        "ai_center"
    }
    fn zh_name(&self) -> &'static str {
        "AI中心"
    }
    fn en_name(&self) -> &'static str {
        "AI Capability Center"
    }
    fn order(&self) -> u32 {
        15
    }
    fn description(&self) -> &'static str {
        concat!(
            "企业 AI、API、RAG、MCP、Agent、模型路由、工具权限、安全审计和成本策略模块。\n",
            "为所有业务模块提供统一 AI 能力编排、上下文治理、审计和成本控制。\n",
            "与设置中心共同构成平台级能力底座。"
        )
    }
}
