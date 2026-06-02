// lib/ai-provider-router.ts - ArchIToken AI provider discovery behind Router boundary
// License: Apache-2.0

export type AiProviderId =
  | "openclaw"
  | "comfyui"
  | "hugging_face"
  | "ollama"
  | "lm_studio"
  | "openrouter"
  | "openai_compatible";

export interface AiProviderRoute {
  id: AiProviderId;
  label: string;
  route:
    | "agent_gateway"
    | "local_runtime"
    | "local_cache"
    | "external_endpoint";
  baseUrl?: string;
  tokenEnv?: string;
  healthPath?: string;
  configured: boolean;
  status: "configured" | "reachable" | "unreachable" | "not_configured";
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
  providers: AiProviderRoute[];
  revenueLanes: AiRevenueLane[];
}

const HUGGING_FACE_PROVIDER_BASE_URL = huggingFaceProviderBaseUrl();
const HUGGING_FACE_EXTERNAL_ENDPOINT = huggingFaceExternalEndpoint();

const DEFAULT_PROVIDERS: Array<Omit<AiProviderRoute, "configured" | "status">> =
  [
    {
      id: "openclaw",
      label: "OpenClaw Gateway / Agent Runtime",
      route: "agent_gateway",
      healthPath: "/v1/models",
      tokenEnv: "OPENCLAW_GATEWAY_TOKEN",
      capabilities: [
        "全局聊天接管",
        "Agent 编排",
        "工具路由",
        "人工接管",
        "任务回放",
      ],
      controls: [
        "WorkflowRouter",
        "ToolRouter",
        "ModelRouter",
        "审计链",
        "人工审批",
      ],
      ...(process.env.OPENCLAW_GATEWAY_URL
        ? { baseUrl: process.env.OPENCLAW_GATEWAY_URL }
        : {}),
    },
    {
      id: "comfyui",
      label: "ComfyUI 本地多模态工作流",
      route: "local_runtime",
      baseUrl: process.env.COMFYUI_URL ?? "http://127.0.0.1:8188",
      healthPath: "/system_stats",
      capabilities: [
        "Hugging Face 本地模型工作流",
        "图像 / 视频 / 3D 编排",
        "供应商 API 节点编排",
      ],
      controls: [
        "WorkflowRouter",
        "GenerationRouter",
        "模型资产与执行状态分离",
        "不把缓存模型伪装为已运行",
      ],
    },
    {
      id: "ollama",
      label: "Ollama 本地模型",
      route: "local_runtime",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
      healthPath: "/api/tags",
      capabilities: ["本地私有推理", "低成本开发验证", "离线/弱网场景"],
      controls: [
        "ModelRouter 白名单",
        "本地审计",
        "不得绕过 Generator/Evaluator 分离",
      ],
    },
    {
      id: "lm_studio",
      label: "LM Studio 本地 OpenAI-Compatible Runtime",
      route: "local_runtime",
      baseUrl: process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1",
      healthPath: "/models",
      capabilities: [
        "本地桌面模型",
        "OpenAI-compatible API",
        "方案/文本/代码辅助",
      ],
      controls: ["InferenceRouter", "模型白名单", "Token 计量", "本地数据边界"],
    },
    {
      id: "hugging_face",
      label: "Hugging Face Hub / Local Cache / Endpoint",
      route: HUGGING_FACE_EXTERNAL_ENDPOINT
        ? "external_endpoint"
        : "local_cache",
      tokenEnv: "HF_TOKEN",
      capabilities: [
        "本地模型缓存",
        "私有模型下载",
        "推理端点适配",
        "行业微调模型资产",
      ],
      controls: [
        "hf CLI/缓存审计",
        "端点密钥隔离",
        "数据分级",
        "不可由业务模块直连",
      ],
      ...(HUGGING_FACE_PROVIDER_BASE_URL
        ? { baseUrl: HUGGING_FACE_PROVIDER_BASE_URL, healthPath: "/models" }
        : {}),
    },
    {
      id: "openrouter",
      label: "OpenRouter 外部模型网关",
      route: "external_endpoint",
      baseUrl:
        process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      healthPath: "/models",
      tokenEnv: "OPENROUTER_API_KEY",
      capabilities: [
        "多供应商统一入口",
        "远端聊天 / 代码 / 多模态模型",
        "成本和配额路由",
      ],
      controls: ["ModelRouter 白名单", "密钥隔离", "成本计量", "审计记录"],
    },
    {
      id: "openai_compatible",
      label: "通用 OpenAI-Compatible 服务商",
      route: "external_endpoint",
      ...(process.env.OPENAI_COMPATIBLE_BASE_URL
        ? {
            baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
            healthPath: "/models",
          }
        : {}),
      tokenEnv: "OPENAI_COMPATIBLE_API_KEY",
      capabilities: ["自定义 /v1 服务商", "私有推理网关", "企业模型托管"],
      controls: ["InferenceRouter", "供应商白名单", "Token 计量", "数据边界"],
    },
  ];

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
  const providers = await Promise.all(
    DEFAULT_PROVIDERS.map(async (provider) => {
      const configured =
        provider.id === "hugging_face"
          ? Boolean(
              process.env.HF_HOME ||
              process.env.HF_TOKEN ||
              process.env.HUGGINGFACE_API_TOKEN ||
              process.env.ARCHITOKEN_HF_MODEL_REPOSITORY_DIR ||
              HUGGING_FACE_PROVIDER_BASE_URL,
            )
          : provider.id === "openrouter"
            ? Boolean(
                process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_TOKEN,
              )
            : provider.id === "openai_compatible"
              ? Boolean(provider.baseUrl)
              : provider.id === "openclaw"
                ? Boolean(provider.baseUrl)
                : Boolean(provider.baseUrl);
      const reachable =
        configured && provider.baseUrl && provider.healthPath
          ? await probeProvider(provider.baseUrl, provider.healthPath)
          : false;

      return {
        ...provider,
        configured,
        status: reachable
          ? "reachable"
          : configured
            ? "configured"
            : "not_configured",
      } satisfies AiProviderRoute;
    }),
  );

  return {
    schema: "architoken.ai_provider_router.v1",
    generatedAt: new Date().toISOString(),
    routerRule:
      "业务模块只能通过 ArchIToken Router / ModelRouter / InferenceRouter / GenerationRouter 调用模型; 不允许直连 HuggingFace、Ollama、LM Studio、OpenRouter、ComfyUI 或外部供应商 API。",
    providers,
    revenueLanes: aiRevenueLanes,
  };
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

function huggingFaceProviderBaseUrl(): string | undefined {
  const raw =
    process.env.ARCHITOKEN_HF_LOCAL_CHAT_URL ??
    process.env.HUGGINGFACE_LOCAL_CHAT_URL ??
    process.env.ARCHITOKEN_HF_CHAT_URL ??
    process.env.HUGGINGFACE_CHAT_URL ??
    process.env.HF_INFERENCE_ENDPOINT;
  if (!raw?.trim()) return undefined;

  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, "");
    if (
      path.endsWith("/v1/chat/completions") ||
      path.endsWith("/chat/completions")
    ) {
      const basePath = path.replace(/\/chat\/completions$/, "");
      return new URL(basePath || "/", url).toString().replace(/\/+$/, "");
    }
    if (path.endsWith("/v1")) return raw.replace(/\/+$/, "");
    return new URL("/v1", raw.endsWith("/") ? raw : `${raw}/`)
      .toString()
      .replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function huggingFaceExternalEndpoint(): string | undefined {
  return (
    process.env.ARCHITOKEN_HF_CHAT_URL ??
    process.env.HUGGINGFACE_CHAT_URL ??
    process.env.HF_INFERENCE_ENDPOINT
  );
}
