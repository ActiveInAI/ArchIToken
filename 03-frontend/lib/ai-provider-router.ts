// lib/ai-provider-router.ts - ArchIToken AI provider discovery behind Router boundary
// License: Apache-2.0

import {
  CHANNEL_PROVIDER_REGISTRY,
  hasChannelProviderConfig,
  type ChannelProviderId,
  type ChannelProviderRegistryEntry,
  type ChannelProviderRoute,
} from "./ai-channel-provider-registry";
import {
  MODEL_PROVIDER_REGISTRY,
  hasModelProviderSecret,
  resolveModelProviderBaseUrl,
  type ModelProviderId,
  type ModelProviderRegistryEntry,
  type ModelProviderRoute,
} from "./ai-model-provider-registry";

export type AiProviderId = ModelProviderId;

export interface AiProviderRoute {
  id: AiProviderId;
  label: string;
  route: ModelProviderRoute;
  apiProtocol: ModelProviderRegistryEntry["apiProtocol"];
  baseUrl: string;
  tokenEnv?: string;
  healthPath?: string;
  consoleUrl?: string;
  configured: boolean;
  status: "configured" | "reachable" | "unreachable" | "not_configured";
  capabilities: string[];
  controls: string[];
}

export interface AiChannelProviderRoute {
  id: ChannelProviderId;
  label: string;
  route: ChannelProviderRoute;
  baseUrl?: string;
  tokenEnv?: string;
  consoleUrl?: string;
  configured: boolean;
  status: "configured" | "not_configured";
  capabilities: string[];
  controls: string[];
}

export interface AiRevenueLane {
  id: string;
  label: string;
  billableUnit: string;
  moduleScope: string[];
  complianceBoundary: string;
}

export interface AiProviderRouterManifest {
  schema: "architoken.ai_provider_router.v1";
  generatedAt: string;
  routerRule: string;
  channelRouterRule: string;
  providers: AiProviderRoute[];
  modelProviders: AiProviderRoute[];
  channelProviders: AiChannelProviderRoute[];
  revenueLanes: AiRevenueLane[];
}

export const aiRevenueLanes: AiRevenueLane[] = [
  {
    id: "ai_api_metering",
    label: "AI 大模型 API 计量",
    billableUnit: "请求量 / Token / 工程任务",
    moduleScope: [
      "ai_center",
      "marketing_service",
      "concept_design",
      "quantity_costing",
    ],
    complianceBoundary:
      "只销售真实 AI 服务和工程任务额度,不得承诺投资收益或二级交易。",
  },
  {
    id: "private_model_hosting",
    label: "私有模型托管",
    billableUnit: "租户 / GPU 时长 / 模型版本",
    moduleScope: ["ai_center", "settings_center", "digital_archive"],
    complianceBoundary: "租户隔离、模型版本、数据分级和审计记录必须齐全。",
  },
  {
    id: "aec_agent_package",
    label: "AEC 行业 Agent 服务包",
    billableUnit: "模块包 / 项目包 / 审查任务",
    moduleScope: [
      "detailed_design",
      "quantity_costing",
      "production_manufacturing",
      "construction_management",
    ],
    complianceBoundary:
      "输出必须经过 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver。",
  },
  {
    id: "token_service_quota",
    label: "Token 服务额度",
    billableUnit: "不可转让 AI 服务额度",
    moduleScope: ["ai_center", "finance_management", "settings_center"],
    complianceBoundary:
      "不得现金退出、不得二级交易、不得脱离真实 AI 服务单独流通。",
  },
];

export async function discoverAiProviders(): Promise<AiProviderRouterManifest> {
  const modelProviders = await Promise.all(
    MODEL_PROVIDER_REGISTRY.map(discoverModelProvider),
  );
  const channelProviders = CHANNEL_PROVIDER_REGISTRY.map(
    discoverChannelProvider,
  );

  return {
    schema: "architoken.ai_provider_router.v1",
    generatedAt: new Date().toISOString(),
    routerRule:
      "ModelProviderRegistry 只登记 vLLM、Ollama、LM Studio、Hugging Face、Qwen、Gemini API、Zhipu、Kimi、MiniMax；业务模块只能通过 ArchIToken Router / ModelRouter / InferenceRouter / GenerationRouter 调用模型。",
    channelRouterRule:
      "ChannelProviderRegistry 只登记飞书/Lark、钉钉、企业微信、微信公众号、微信小程序、Telegram、Slack、OpenClaw；消息和外部 Agent 动作必须经过 ToolRouter / WorkflowRouter / AuditTrail / Approver。",
    providers: modelProviders,
    modelProviders,
    channelProviders,
    revenueLanes: aiRevenueLanes,
  };
}

async function discoverModelProvider(
  provider: ModelProviderRegistryEntry,
): Promise<AiProviderRoute> {
  const baseUrl = resolveModelProviderBaseUrl(provider);
  const configured = isModelProviderConfigured(provider, baseUrl);
  const reachable =
    configured && provider.healthPath
      ? await probeProvider(baseUrl, provider.healthPath)
      : false;

  const route: AiProviderRoute = {
    id: provider.id,
    label: provider.label,
    route: provider.route,
    apiProtocol: provider.apiProtocol,
    baseUrl,
    healthPath: provider.healthPath,
    configured,
    status: reachable
      ? "reachable"
      : configured
        ? "configured"
        : "not_configured",
    capabilities: [...provider.capabilities],
    controls: [...provider.controls],
  };
  const tokenEnv = provider.tokenEnvVars[0];
  if (tokenEnv) route.tokenEnv = tokenEnv;
  if (provider.consoleUrl) route.consoleUrl = provider.consoleUrl;
  return route;
}

function discoverChannelProvider(
  provider: ChannelProviderRegistryEntry,
): AiChannelProviderRoute {
  const configured = hasChannelProviderConfig(provider);
  const route: AiChannelProviderRoute = {
    id: provider.id,
    label: provider.label,
    route: provider.route,
    configured,
    status: configured ? "configured" : "not_configured",
    capabilities: [...provider.capabilities],
    controls: [...provider.controls],
  };
  if (provider.defaultBaseUrl) route.baseUrl = provider.defaultBaseUrl;
  const tokenEnv = provider.tokenEnvVars[0];
  if (tokenEnv) route.tokenEnv = tokenEnv;
  if (provider.consoleUrl) route.consoleUrl = provider.consoleUrl;
  return route;
}

function isModelProviderConfigured(
  provider: ModelProviderRegistryEntry,
  baseUrl: string,
): boolean {
  if (provider.id === "huggingface") {
    return Boolean(
      process.env.HF_HOME ||
      process.env.ARCHITOKEN_HF_MODEL_REPOSITORY_DIR ||
      hasModelProviderSecret(provider) ||
      baseUrl,
    );
  }
  if (provider.route !== "external_endpoint") return Boolean(baseUrl);
  return hasModelProviderSecret(provider);
}

async function probeProvider(
  baseUrl: string,
  healthPath: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 900);
  try {
    const relativeHealthPath = healthPath.replace(/^\/+/, "");
    const url = new URL(
      relativeHealthPath,
      baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    );
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
