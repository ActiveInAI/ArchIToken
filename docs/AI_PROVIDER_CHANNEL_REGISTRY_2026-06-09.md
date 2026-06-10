# ArchIToken AI Provider / Channel Registry · 2026-06-09

本文记录当前 PanAI / AI Center 允许接入的模型供应商与协作通道白名单。

## 1. ModelProviderRegistry

只登记以下模型供应商:

| id            | 名称            | 接入边界                               |
| ------------- | --------------- | -------------------------------------- |
| `vllm`        | vLLM            | 本地/私有 OpenAI-compatible 推理运行时 |
| `ollama`      | Ollama          | 本地开发、边缘与离线推理运行时         |
| `lmstudio`    | LM Studio       | 桌面本地 OpenAI-compatible 运行时      |
| `huggingface` | Hugging Face    | 模型资产、缓存、Endpoint 和数据集治理  |
| `qwen`        | Qwen / 通义千问 | DashScope / Model Studio 兼容接口适配  |
| `gemini`      | Gemini API      | Gemini API provider adapter            |
| `zhipu`       | 智谱 GLM / Z.ai | GLM / Z.ai 兼容接口适配                |
| `kimi`        | Kimi / 月之暗面 | Moonshot / Kimi 兼容接口适配           |
| `minimax`     | MiniMax         | 文本与多媒体生成 provider adapter      |

所有模型调用必须经过:

```text
WorkflowRouter -> ToolRouter -> ModelRouter -> InferenceRouter / GenerationRouter -> AuditTrail -> Approver
```

不在此列表中的 OpenRouter、OpenAI、Anthropic、DeepSeek、Unsloth、ComfyUI 等不作为当前 ModelProviderRegistry 成员。

## 2. ChannelProviderRegistry

只登记以下通道供应商:

| id                        | 名称        | 接入边界                    |
| ------------------------- | ----------- | --------------------------- |
| `lark`                    | 飞书 / Lark | 官方 OpenAPI / MCP / Bot    |
| `dingtalk`                | 钉钉        | 官方 OpenAPI / Robot / 审批 |
| `wecom`                   | 企业微信    | 官方企业微信 API            |
| `wechat_official_account` | 微信公众号  | 官方公众号 API              |
| `wechat_miniprogram`      | 微信小程序  | 官方小程序 API              |
| `telegram`                | Telegram    | Bot API                     |
| `slack`                   | Slack       | 官方 Slack API              |
| `openclaw`                | OpenClaw    | 外部 Agent sidecar          |

个人微信逆向协议、非官方 Hook、未审计桌面自动化和未登记 Agent 产品不得进入 ChannelProviderRegistry。

## 3. 实现位置

- `03-frontend/lib/ai-model-provider-registry.ts`
- `03-frontend/lib/ai-channel-provider-registry.ts`
- `03-frontend/lib/ai-provider-router.ts`
- `03-frontend/app/api/ai/providers/route.ts`
