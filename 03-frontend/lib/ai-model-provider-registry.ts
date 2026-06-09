// lib/ai-model-provider-registry.ts - ModelProviderRegistry whitelist
// License: Apache-2.0

export type ModelProviderId =
  | "vllm"
  | "ollama"
  | "lmstudio"
  | "huggingface"
  | "qwen"
  | "gemini"
  | "zhipu"
  | "kimi"
  | "minimax";

export type ModelProviderRoute =
  | "local_runtime"
  | "local_cache"
  | "external_endpoint";

export interface ModelProviderRegistryEntry {
  id: ModelProviderId;
  label: string;
  route: ModelProviderRoute;
  apiProtocol:
    | "openai_compatible"
    | "native_plus_openai_compatible"
    | "provider_adapter";
  defaultBaseUrl: string;
  baseUrlEnvVars: string[];
  tokenEnvVars: string[];
  healthPath: string;
  consoleUrl?: string;
  capabilities: string[];
  controls: string[];
}

export const MODEL_PROVIDER_REGISTRY: readonly ModelProviderRegistryEntry[] = [
  {
    id: "vllm",
    label: "vLLM",
    route: "local_runtime",
    apiProtocol: "openai_compatible",
    defaultBaseUrl: "http://127.0.0.1:8000/v1",
    baseUrlEnvVars: ["VLLM_BASE_URL", "ARCHITOKEN_VLLM_BASE_URL"],
    tokenEnvVars: [],
    healthPath: "/models",
    consoleUrl: "https://docs.vllm.ai/",
    capabilities: ["生产级自托管推理", "批量吞吐", "OpenAI-compatible API"],
    controls: [
      "ModelRouter 白名单",
      "InferenceRouter",
      "GPU evidence",
      "审计记录",
    ],
  },
  {
    id: "ollama",
    label: "Ollama",
    route: "local_runtime",
    apiProtocol: "native_plus_openai_compatible",
    defaultBaseUrl: "http://127.0.0.1:11434",
    baseUrlEnvVars: ["OLLAMA_BASE_URL", "ARCHITOKEN_OLLAMA_BASE_URL"],
    tokenEnvVars: [],
    healthPath: "/api/tags",
    consoleUrl: "https://ollama.com/",
    capabilities: ["本地私有推理", "开发验证", "离线/弱网场景"],
    controls: [
      "ModelRouter 白名单",
      "本地审计",
      "不得绕过 Generator/Evaluator 分离",
    ],
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    route: "local_runtime",
    apiProtocol: "openai_compatible",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    baseUrlEnvVars: ["LM_STUDIO_BASE_URL", "ARCHITOKEN_LM_STUDIO_BASE_URL"],
    tokenEnvVars: [],
    healthPath: "/models",
    consoleUrl: "https://lmstudio.ai/",
    capabilities: ["桌面本地模型", "OpenAI-compatible API", "人工工作站调试"],
    controls: ["InferenceRouter", "模型白名单", "Token 计量", "本地数据边界"],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    route: "local_cache",
    apiProtocol: "provider_adapter",
    defaultBaseUrl: "http://127.0.0.1:7071/v1",
    baseUrlEnvVars: [
      "ARCHITOKEN_HF_LOCAL_CHAT_URL",
      "HUGGINGFACE_LOCAL_CHAT_URL",
      "ARCHITOKEN_HF_CHAT_URL",
      "HUGGINGFACE_CHAT_URL",
      "HF_INFERENCE_ENDPOINT",
    ],
    tokenEnvVars: ["HF_TOKEN", "HUGGINGFACE_API_TOKEN"],
    healthPath: "/models",
    consoleUrl: "https://huggingface.co/models",
    capabilities: [
      "模型资产注册",
      "本地缓存",
      "Inference Endpoint",
      "数据集/Space 治理",
    ],
    controls: [
      "hf CLI/缓存审计",
      "端点密钥隔离",
      "数据分级",
      "不可由业务模块直连",
    ],
  },
  {
    id: "qwen",
    label: "Qwen / 通义千问",
    route: "external_endpoint",
    apiProtocol: "openai_compatible",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    baseUrlEnvVars: ["QWEN_BASE_URL", "DASHSCOPE_BASE_URL"],
    tokenEnvVars: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
    healthPath: "/models",
    consoleUrl: "https://bailian.console.aliyun.com/",
    capabilities: ["中文推理", "代码辅助", "多模态模型", "国内云端接入"],
    controls: [
      "ModelRouter 白名单",
      "服务端密钥",
      "成本计量",
      "跨境/数据分级审计",
    ],
  },
  {
    id: "gemini",
    label: "Gemini API",
    route: "external_endpoint",
    apiProtocol: "provider_adapter",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    baseUrlEnvVars: ["GEMINI_BASE_URL", "GOOGLE_GENAI_BASE_URL"],
    tokenEnvVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    healthPath: "/models",
    consoleUrl: "https://aistudio.google.com/",
    capabilities: ["长上下文", "多模态", "代码/文档辅助"],
    controls: ["ModelRouter 白名单", "服务端密钥", "供应商适配器", "审计记录"],
  },
  {
    id: "zhipu",
    label: "智谱 GLM / Z.ai",
    route: "external_endpoint",
    apiProtocol: "openai_compatible",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    baseUrlEnvVars: ["ZHIPU_BASE_URL", "ZAI_BASE_URL", "GLM_BASE_URL"],
    tokenEnvVars: [
      "ZHIPUAI_API_KEY",
      "ZHIPU_API_KEY",
      "ZAI_API_KEY",
      "GLM_API_KEY",
    ],
    healthPath: "/models",
    consoleUrl: "https://open.bigmodel.cn/",
    capabilities: ["中文推理", "Agent 工具调用", "代码辅助"],
    controls: ["ModelRouter 白名单", "服务端密钥", "成本计量", "审计记录"],
  },
  {
    id: "kimi",
    label: "Kimi / 月之暗面",
    route: "external_endpoint",
    apiProtocol: "openai_compatible",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    baseUrlEnvVars: ["KIMI_BASE_URL", "MOONSHOT_BASE_URL"],
    tokenEnvVars: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
    healthPath: "/models",
    consoleUrl: "https://platform.moonshot.cn/",
    capabilities: ["长上下文", "中文文档", "合同/报告草稿"],
    controls: ["ModelRouter 白名单", "服务端密钥", "文档数据分级", "审计记录"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    route: "external_endpoint",
    apiProtocol: "provider_adapter",
    defaultBaseUrl: "https://api.minimax.io/v1",
    baseUrlEnvVars: ["MINIMAX_BASE_URL"],
    tokenEnvVars: ["MINIMAX_API_KEY"],
    healthPath: "/models",
    consoleUrl: "https://platform.minimaxi.com/",
    capabilities: ["文本", "语音", "图像/视频生成适配", "多媒体 Agent"],
    controls: [
      "ModelRouter 白名单",
      "GenerationRouter",
      "服务端密钥",
      "多媒体输出审计",
    ],
  },
] as const;

export const MODEL_PROVIDER_IDS = MODEL_PROVIDER_REGISTRY.map(
  (provider) => provider.id,
);

export function getModelProvider(
  providerId: string,
): ModelProviderRegistryEntry | undefined {
  return MODEL_PROVIDER_REGISTRY.find((provider) => provider.id === providerId);
}

export function isModelProviderId(value: string): value is ModelProviderId {
  return MODEL_PROVIDER_REGISTRY.some((provider) => provider.id === value);
}

export function resolveModelProviderBaseUrl(
  provider: ModelProviderRegistryEntry,
  env: Record<string, string | undefined> = runtimeEnv(),
): string {
  for (const key of provider.baseUrlEnvVars) {
    const value = env[key]?.trim();
    if (value) return normalizeProviderBaseUrl(provider.id, value);
  }
  return provider.defaultBaseUrl;
}

export function hasModelProviderSecret(
  provider: ModelProviderRegistryEntry,
  env: Record<string, string | undefined> = runtimeEnv(),
): boolean {
  return provider.tokenEnvVars.some((key) => Boolean(env[key]?.trim()));
}

function normalizeProviderBaseUrl(
  providerId: ModelProviderId,
  raw: string,
): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (providerId !== "huggingface") return trimmed;

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
    if (path.endsWith("/v1")) return trimmed;
    return new URL("/v1", raw.endsWith("/") ? raw : `${raw}/`)
      .toString()
      .replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

function runtimeEnv(): Record<string, string | undefined> {
  if (typeof process === "undefined") return {};
  return process.env;
}
