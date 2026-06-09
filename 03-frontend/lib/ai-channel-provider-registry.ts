// lib/ai-channel-provider-registry.ts - ChannelProviderRegistry whitelist
// License: Apache-2.0

export type ChannelProviderId =
  | "lark"
  | "dingtalk"
  | "wecom"
  | "wechat_official_account"
  | "wechat_miniprogram"
  | "telegram"
  | "slack"
  | "openclaw";

export type ChannelProviderRoute =
  | "official_openapi"
  | "webhook"
  | "bot_api"
  | "sidecar";

export interface ChannelProviderRegistryEntry {
  id: ChannelProviderId;
  label: string;
  route: ChannelProviderRoute;
  endpointEnvVars: string[];
  tokenEnvVars: string[];
  defaultBaseUrl?: string;
  consoleUrl?: string;
  capabilities: string[];
  controls: string[];
}

export const CHANNEL_PROVIDER_REGISTRY: readonly ChannelProviderRegistryEntry[] =
  [
    {
      id: "lark",
      label: "飞书 / Lark",
      route: "official_openapi",
      endpointEnvVars: ["LARK_BASE_URL", "FEISHU_BASE_URL"],
      tokenEnvVars: [
        "LARK_APP_ID",
        "LARK_APP_SECRET",
        "FEISHU_APP_ID",
        "FEISHU_APP_SECRET",
      ],
      defaultBaseUrl: "https://open.feishu.cn/open-apis",
      consoleUrl: "https://open.feishu.cn/",
      capabilities: ["消息", "文档", "日历", "审批", "机器人/MCP"],
      controls: [
        "ToolRouter",
        "ChannelProviderRegistry 白名单",
        "服务端密钥",
        "审计记录",
      ],
    },
    {
      id: "dingtalk",
      label: "钉钉",
      route: "official_openapi",
      endpointEnvVars: ["DINGTALK_BASE_URL"],
      tokenEnvVars: [
        "DINGTALK_APP_KEY",
        "DINGTALK_APP_SECRET",
        "DINGTALK_ROBOT_SECRET",
      ],
      defaultBaseUrl: "https://api.dingtalk.com",
      consoleUrl: "https://open.dingtalk.com/",
      capabilities: ["消息", "审批", "组织通讯录", "机器人", "企业流程"],
      controls: ["ToolRouter", "WorkflowRouter", "服务端密钥", "审批审计"],
    },
    {
      id: "wecom",
      label: "企业微信",
      route: "official_openapi",
      endpointEnvVars: ["WECOM_BASE_URL", "WECHAT_WORK_BASE_URL"],
      tokenEnvVars: [
        "WECOM_CORP_ID",
        "WECOM_CORP_SECRET",
        "WECHAT_WORK_CORP_ID",
        "WECHAT_WORK_CORP_SECRET",
      ],
      defaultBaseUrl: "https://qyapi.weixin.qq.com/cgi-bin",
      consoleUrl: "https://developer.work.weixin.qq.com/",
      capabilities: ["企业消息", "客户联系", "群机器人", "组织通讯录"],
      controls: ["官方 API only", "服务端密钥", "客户数据分级", "审计记录"],
    },
    {
      id: "wechat_official_account",
      label: "微信公众号",
      route: "official_openapi",
      endpointEnvVars: ["WECHAT_MP_BASE_URL"],
      tokenEnvVars: [
        "WECHAT_MP_APP_ID",
        "WECHAT_MP_APP_SECRET",
        "WECHAT_MP_TOKEN",
      ],
      defaultBaseUrl: "https://api.weixin.qq.com/cgi-bin",
      consoleUrl: "https://mp.weixin.qq.com/",
      capabilities: ["公众号消息", "菜单", "模板消息", "内容触达"],
      controls: ["官方 API only", "服务端密钥", "内容合规", "审计记录"],
    },
    {
      id: "wechat_miniprogram",
      label: "微信小程序",
      route: "official_openapi",
      endpointEnvVars: ["WECHAT_MINIPROGRAM_BASE_URL"],
      tokenEnvVars: [
        "WECHAT_MINIPROGRAM_APP_ID",
        "WECHAT_MINIPROGRAM_APP_SECRET",
      ],
      defaultBaseUrl: "https://api.weixin.qq.com",
      consoleUrl: "https://mp.weixin.qq.com/",
      capabilities: ["小程序登录", "订阅消息", "客户触达", "项目入口"],
      controls: ["官方 API only", "服务端密钥", "用户授权", "审计记录"],
    },
    {
      id: "telegram",
      label: "Telegram",
      route: "bot_api",
      endpointEnvVars: ["TELEGRAM_BASE_URL"],
      tokenEnvVars: ["TELEGRAM_BOT_TOKEN"],
      defaultBaseUrl: "https://api.telegram.org",
      consoleUrl: "https://core.telegram.org/bots/api",
      capabilities: ["Bot 消息", "文件收发", "告警通知", "群组协作"],
      controls: ["ToolRouter", "服务端密钥", "租户隔离", "审计记录"],
    },
    {
      id: "slack",
      label: "Slack",
      route: "official_openapi",
      endpointEnvVars: ["SLACK_BASE_URL"],
      tokenEnvVars: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
      defaultBaseUrl: "https://slack.com/api",
      consoleUrl: "https://api.slack.com/",
      capabilities: ["Bot 消息", "Workflow", "文件/线程", "企业通知"],
      controls: ["ToolRouter", "服务端密钥", "签名校验", "审计记录"],
    },
    {
      id: "openclaw",
      label: "OpenClaw",
      route: "sidecar",
      endpointEnvVars: ["OPENCLAW_BASE_URL"],
      tokenEnvVars: ["OPENCLAW_API_TOKEN"],
      defaultBaseUrl: "http://127.0.0.1:17888",
      consoleUrl: "https://github.com/openclaw/openclaw",
      capabilities: ["外部 Agent sidecar", "多通道桥接", "自动化执行"],
      controls: ["sidecar 隔离", "ToolRouter", "权限沙箱", "Approver 审批"],
    },
  ] as const;

export const CHANNEL_PROVIDER_IDS = CHANNEL_PROVIDER_REGISTRY.map(
  (provider) => provider.id,
);

export function hasChannelProviderConfig(
  provider: ChannelProviderRegistryEntry,
  env: Record<string, string | undefined> = runtimeEnv(),
): boolean {
  return [...provider.endpointEnvVars, ...provider.tokenEnvVars].some((key) =>
    Boolean(env[key]?.trim()),
  );
}

function runtimeEnv(): Record<string, string | undefined> {
  if (typeof process === "undefined") return {};
  return process.env;
}
