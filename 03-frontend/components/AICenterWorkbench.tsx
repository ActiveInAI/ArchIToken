// components/AICenterWorkbench.tsx
// License: Apache-2.0
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Cpu,
  ExternalLink,
  Key,
  Network,
  Plug,
  Save,
  Server,
  Sparkles,
  CheckCircle2,
  Globe,
  Box,
  ShieldCheck,
  Wallet,
  Workflow,
} from "lucide-react";
import { useLLMConfig, type ProviderId } from "@/lib/llm-provider";
import {
  getOllamaModels,
  getHfModelCatalog,
  type LocalModelCatalogEntry,
} from "@/lib/local-models-action";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import { createModuleAuditEvent } from "@/lib/module-actions";
import {
  AICenterManagementPanels,
  type AICenterBillingPanelId,
  type AICenterGovernancePanelId,
} from "@/components/AICenterManagementPanels";

type AICenterBusinessView =
  | "overview"
  | "routing"
  | "membership"
  | "plans"
  | "topup"
  | "apiTokens"
  | "billing"
  | "interfaces"
  | "databases"
  | "visualization"
  | "rag"
  | "mcp"
  | "agent"
  | "openclaw"
  | "safety"
  | "cost";

const PROVIDERS: {
  id: ProviderId;
  name: string;
  icon: ReactNode;
  type: "local" | "cloud";
}[] = [
  {
    id: "openclaw",
    name: "OpenClaw",
    icon: <Network className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "ollama",
    name: "Ollama",
    icon: <Box className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "vllm",
    name: "vLLM",
    icon: <Server className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    icon: <Globe className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    icon: <Cpu className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "unsloth",
    name: "Unsloth Studio",
    icon: <Sparkles className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: <Network className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "google",
    name: "Google",
    icon: <Globe className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: <Cpu className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: <Network className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: <Sparkles className="h-5 w-5" />,
    type: "cloud",
  },
];

const AI_CENTER_FOLDER_VIEWS: Record<string, AICenterBusinessView> = {
  路由配置: "routing",
  模型路由: "routing",
  模型供应商: "routing",
  会员充值: "membership",
  "AI API网关": "apiTokens",
  购买套餐: "plans",
  额度充值: "topup",
  "API Token": "apiTokens",
  订单账单: "billing",
  接口管理: "interfaces",
  数据库管理: "databases",
  可视化面板: "visualization",
  RAG知识库: "rag",
  MCP工具注册: "mcp",
  Agent编排: "agent",
  OpenClaw自动化: "openclaw",
  安全审计: "safety",
  成本策略: "cost",
};

const AI_CENTER_CAPABILITY_PANELS: Partial<
  Record<
    AICenterBusinessView,
    {
      eyebrow: string;
      title: string;
      description: string;
      icon: ReactNode;
      metrics: { label: string; value: string; detail: string }[];
      checklist: string[];
    }
  >
> = {
  rag: {
    eyebrow: "RAG Knowledge Base",
    title: "RAG 知识库",
    description:
      "管理规范、合同、图纸、BIM、企业标准和历史项目语料，只提供检索与引用能力。",
    icon: <BookOpen className="h-5 w-5" />,
    metrics: [
      { label: "知识源", value: "12", detail: "标准、合同、项目资料" },
      { label: "索引状态", value: "已接入", detail: "Gateway 统一读取" },
      { label: "引用策略", value: "强制", detail: "输出必须带来源线索" },
    ],
    checklist: [
      "语料入库必须保留来源、版本、责任人和适用范围。",
      "专业判断只能作为建议输出，不能绕过规范、合同和审批。",
      "跨项目检索需要租户、项目和权限边界校验。",
    ],
  },
  mcp: {
    eyebrow: "MCP Tool Registry",
    title: "MCP 工具注册",
    description:
      "登记文件、数据库、BIM、造价、进度、文档和外部系统工具，统一交给 Router 调度。",
    icon: <Plug className="h-5 w-5" />,
    metrics: [
      { label: "工具域", value: "8", detail: "文件 / BIM / 数据库 / 文档" },
      { label: "授权方式", value: "租户绑定", detail: "不允许裸调用" },
      { label: "审批边界", value: "已启用", detail: "高风险工具需人工确认" },
    ],
    checklist: [
      "工具必须声明输入输出 schema、权限和审计字段。",
      "写入型工具默认需要审批或明确的业务上下文。",
      "MCP 工具调用结果要写入模块审计链。",
    ],
  },
  agent: {
    eyebrow: "Agent Orchestration",
    title: "Agent 编排",
    description:
      "配置各业务 Agent 的职责、工具边界、审批策略和 Planner -> Generator -> Evaluator 链路。",
    icon: <Bot className="h-5 w-5" />,
    metrics: [
      { label: "业务 Agent", value: "16", detail: "按模块注册" },
      {
        label: "执行链",
        value: "分离",
        detail: "Planner / Generator / Evaluator",
      },
      { label: "审批", value: "启用", detail: "高风险输出需 Approver" },
    ],
    checklist: [
      "Agent 不能直接调用供应商 API，必须走内部 Router。",
      "Generator 和 Evaluator 必须分离，不能合并为单一生成步骤。",
      "输出进入业务模块前需要规则校核和 Schema 校验。",
    ],
  },
  openclaw: {
    eyebrow: "OpenClaw Automation",
    title: "OpenClaw 自动化",
    description: "管理浏览器/桌面自动化任务、人工确认、沙箱执行和操作回放。",
    icon: <Workflow className="h-5 w-5" />,
    metrics: [
      { label: "运行模式", value: "受控", detail: "人工确认 + 回放" },
      { label: "任务队列", value: "隔离", detail: "禁止无边界自动化" },
      { label: "证据", value: "记录", detail: "截图、日志和动作轨迹" },
    ],
    checklist: [
      "自动化动作必须绑定用户意图、模块和目标对象。",
      "外部系统写操作需要人工确认或审批策略。",
      "执行结果应回写 CDE 文件、事务或审计事件。",
    ],
  },
  safety: {
    eyebrow: "AI Safety & Audit",
    title: "安全审计",
    description:
      "集中管理提示词审计、输出校验、敏感数据脱敏、工具越权拦截、人工审批和责任追踪。",
    icon: <ShieldCheck className="h-5 w-5" />,
    metrics: [
      { label: "审计事件", value: "实时", detail: "模型、工具、文件全链路" },
      { label: "敏感数据", value: "脱敏", detail: "账号、合同、隐私信息" },
      { label: "风险动作", value: "审批", detail: "删除、外发、写入类动作" },
    ],
    checklist: [
      "AI 输出不能直接标记为合规、施工就绪或可交付，必须经过规则和人工审批。",
      "提示词、工具输入、模型输出和人工确认都要进入审计链。",
      "越权调用、无来源引用和高风险外发需要阻断或复核。",
    ],
  },
  cost: {
    eyebrow: "Cost Governance",
    title: "成本策略",
    description:
      "管理套餐额度、部门预算、项目用量、API 限流、成本分摊和熔断策略。",
    icon: <Wallet className="h-5 w-5" />,
    metrics: [
      { label: "额度账户", value: "已启用", detail: "会员 + 充值包" },
      { label: "预算维度", value: "部门/项目", detail: "可按模块拆分" },
      { label: "熔断策略", value: "待接后端", detail: "超过限额需审批" },
    ],
    checklist: [
      "AI 服务额度只用于平台调用，不能提现、转让或交易。",
      "项目、部门、人员和 Token 用量应进入同一账本。",
      "超预算任务应降级、排队或进入负责人审批。",
    ],
  },
};

const ROLE_ALIAS_MODELS = [
  "architoken-planner",
  "architoken-generator",
  "architoken-evaluator",
];

const CLOUD_ALIAS_MODELS: Record<ProviderId, string[]> = {
  openclaw: [
    "openclaw/default",
    "architoken-openclaw-router",
    ...ROLE_ALIAS_MODELS,
  ],
  ollama: [],
  vllm: [],
  huggingface: ["baidu/ERNIE-Image"],
  lmstudio: [],
  unsloth: [],
  openrouter: ROLE_ALIAS_MODELS,
  google: ROLE_ALIAS_MODELS,
  openai: ROLE_ALIAS_MODELS,
  anthropic: ROLE_ALIAS_MODELS,
  deepseek: ROLE_ALIAS_MODELS,
};

const PROVIDER_ENDPOINTS: Record<
  ProviderId,
  { apiBaseUrl: string; consoleUrl?: string }
> = {
  openclaw: {
    apiBaseUrl: "http://127.0.0.1:7561",
    consoleUrl: "https://github.com/openclaw/openclaw",
  },
  ollama: { apiBaseUrl: "http://192.168.1.100:11434" },
  vllm: { apiBaseUrl: "http://192.168.1.100:8000" },
  huggingface: {
    apiBaseUrl: "http://127.0.0.1:7071/v1",
    consoleUrl: "https://huggingface.co/models",
  },
  lmstudio: { apiBaseUrl: "http://192.168.1.100:1234" },
  unsloth: {
    apiBaseUrl: "http://192.168.1.100:8080",
    consoleUrl: "https://unsloth.ai/",
  },
  openrouter: {
    apiBaseUrl: "https://openrouter.ai/api/v1",
    consoleUrl: "https://openrouter.ai/",
  },
  google: {
    apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    consoleUrl: "https://aistudio.google.com/",
  },
  deepseek: {
    apiBaseUrl: "https://api.deepseek.com/v1",
    consoleUrl: "https://platform.deepseek.com/",
  },
  openai: {
    apiBaseUrl: "https://api.openai.com/v1",
    consoleUrl: "https://platform.openai.com/",
  },
  anthropic: {
    apiBaseUrl: "https://api.anthropic.com/v1",
    consoleUrl: "https://console.anthropic.com/",
  },
};

const HF_TASK_LABELS: Record<string, string> = {
  chat: "聊天",
  code: "代码",
  ocr: "OCR",
  text_to_image: "文生图",
  image_to_image: "图生图",
  text_to_video: "文生视频",
  image_to_video: "图生视频",
  image_to_3d: "图生 3D",
  object_to_3d_asset: "物体转 3D",
  world_3d_research: "3D 世界",
  vision_embedding: "视觉向量",
};

const HF_TASK_ORDER = [
  "chat",
  "code",
  "text_to_image",
  "image_to_image",
  "ocr",
  "text_to_video",
  "image_to_video",
  "image_to_3d",
  "object_to_3d_asset",
  "world_3d_research",
  "vision_embedding",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (isRecord(entry) && typeof entry.id === "string") return entry.id;
      return null;
    })
    .filter((id): id is string => Boolean(id));
}

function apiBaseUrlFor(provider: ProviderId, baseUrl?: string): string {
  return (baseUrl || PROVIDER_ENDPOINTS[provider].apiBaseUrl).replace(
    /\/+$/,
    "",
  );
}

function modelCatalogUrl(
  provider: ProviderId,
  baseUrl?: string,
): string | null {
  const apiBaseUrl = apiBaseUrlFor(provider, baseUrl);

  if (provider === "openrouter") {
    return `${apiBaseUrl}/models?output_modalities=all`;
  }

  if (["openclaw", "vllm", "lmstudio", "unsloth"].includes(provider)) {
    return apiBaseUrl.endsWith("/v1")
      ? `${apiBaseUrl}/models`
      : `${apiBaseUrl}/v1/models`;
  }

  return null;
}

function defaultModelFor(provider: ProviderId): string {
  return (
    CLOUD_ALIAS_MODELS[provider][1] || CLOUD_ALIAS_MODELS[provider][0] || ""
  );
}

function hfTaskLabel(taskType?: string) {
  if (!taskType) return "其他";
  return HF_TASK_LABELS[taskType] || taskType;
}

function hfModelStatusLabel(model: LocalModelCatalogEntry) {
  if (model.runtimeConfigured === true || model.configured === true) {
    return "可用";
  }
  if (model.runtimeConfigured === false || model.configured === false) {
    return "需配置运行时";
  }
  return model.repositoryAvailable || model.cached ? "已缓存" : "已登记";
}

function hfModelOptionLabel(model: LocalModelCatalogEntry) {
  const task = hfTaskLabel(model.taskType);
  return `${model.id} · ${task} · ${hfModelStatusLabel(model)}`;
}

function groupHfModelCatalog(models: LocalModelCatalogEntry[]) {
  const groups = new Map<string, LocalModelCatalogEntry[]>();
  for (const model of models) {
    const key = model.taskType || "other";
    const existing = groups.get(key) || [];
    existing.push(model);
    groups.set(key, existing);
  }

  const orderedKeys = [
    ...HF_TASK_ORDER.filter((task) => groups.has(task)),
    ...Array.from(groups.keys()).filter(
      (task) => !HF_TASK_ORDER.includes(task),
    ),
  ];

  return orderedKeys.map((taskType) => ({
    taskType,
    label: hfTaskLabel(taskType),
    models: groups.get(taskType) || [],
  }));
}

function resolveAICenterBusinessView(
  activeFolderName?: string,
): AICenterBusinessView {
  if (!activeFolderName) return "overview";
  return AI_CENTER_FOLDER_VIEWS[activeFolderName] ?? "overview";
}

function billingPanelForView(
  view: AICenterBusinessView,
): AICenterBillingPanelId | null {
  if (view === "plans") return "plans";
  if (view === "topup") return "topup";
  if (view === "apiTokens") return "apiTokens";
  if (view === "billing") return "billing";
  if (["interfaces", "databases", "visualization"].includes(view)) {
    return "governance";
  }
  return null;
}

function governancePanelForView(
  view: AICenterBusinessView,
): AICenterGovernancePanelId | undefined {
  if (view === "interfaces") return "interfaces";
  if (view === "databases") return "databases";
  if (view === "visualization") return "visualization";
  return undefined;
}

export function AICenterWorkbench({
  onAudit,
  compact = false,
  activeFolderName,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
  compact?: boolean;
  activeFolderName?: string;
}) {
  const { config, saveConfig, mounted } = useLLMConfig();
  const localConfig = config;
  const [syncedModels, setSyncedModels] = useState<string[]>([]);
  const [syncedHfCatalog, setSyncedHfCatalog] = useState<
    LocalModelCatalogEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentProvider = PROVIDERS.find((p) => p.id === localConfig.provider);
  const providerEndpoint = PROVIDER_ENDPOINTS[localConfig.provider];
  const isLocal = currentProvider?.type === "local";
  const dynamicModels = useMemo(() => {
    const baseModels =
      syncedModels.length > 0
        ? syncedModels
        : CLOUD_ALIAS_MODELS[localConfig.provider];

    if (localConfig.model && !baseModels.includes(localConfig.model)) {
      return [localConfig.model, ...baseModels];
    }

    return baseModels;
  }, [localConfig.model, localConfig.provider, syncedModels]);
  const modelSourceLabel =
    syncedHfCatalog.length > 0
      ? `${currentProvider?.name || localConfig.provider} 任务目录`
      : syncedModels.length > 0
        ? `${currentProvider?.name || localConfig.provider} 模型目录`
        : isLocal
          ? "本地运行时"
          : "ArchIToken 路由别名";
  const hfModelGroups = useMemo(
    () => groupHfModelCatalog(syncedHfCatalog),
    [syncedHfCatalog],
  );
  const businessView = resolveAICenterBusinessView(activeFolderName);
  const showRoutingPanel =
    businessView === "overview" || businessView === "routing";
  const activeBillingPanel = billingPanelForView(businessView);
  const activeGovernancePanel = governancePanelForView(businessView);
  const capabilityPanel = AI_CENTER_CAPABILITY_PANELS[businessView] ?? null;

  useEffect(() => {
    let cancelled = false;
    const provider = localConfig.provider;
    const baseUrl = localConfig.baseUrl;
    const apiKey = localConfig.apiKey;

    const fetchModels = async () => {
      setIsLoading(true);
      try {
        let models: string[] = [];
        if (provider === "ollama") {
          setSyncedHfCatalog([]);
          models = await getOllamaModels();
        } else if (provider === "huggingface") {
          const catalog = await getHfModelCatalog();
          if (!cancelled) {
            setSyncedHfCatalog(catalog);
          }
          models = catalog.map((model) => model.id);
        } else if (
          ["openclaw", "vllm", "lmstudio", "unsloth"].includes(provider)
        ) {
          setSyncedHfCatalog([]);
          const url = modelCatalogUrl(provider, baseUrl);
          if (url) {
            const res = await fetch(url).catch(() => null);
            if (res && res.ok) {
              const data: unknown = await res.json();
              models = extractModelIds(data);
            }
          }
        } else if (provider === "openrouter") {
          setSyncedHfCatalog([]);
          const url = modelCatalogUrl(provider, baseUrl);
          if (url) {
            const headers: HeadersInit = apiKey
              ? { Authorization: `Bearer ${apiKey}` }
              : {};
            const res = await fetch(url, { headers }).catch(() => null);
            if (res && res.ok) {
              const data: unknown = await res.json();
              models = extractModelIds(data);
            }
          }
        }

        if (cancelled) {
          return;
        }

        setSyncedModels(models);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchModels();

    return () => {
      cancelled = true;
    };
  }, [localConfig.apiKey, localConfig.baseUrl, localConfig.provider]);

  if (!mounted) return null;

  const handleSave = () => {
    saveConfig(localConfig);
    onAudit?.(
      createModuleAuditEvent(
        "ai-config-update",
        "AICenterWorkbench",
        `已切换大模型网关路由: ${localConfig.provider} -> ${localConfig.model}`,
      ),
    );
  };

  const handleProviderChange = (providerId: ProviderId) => {
    const nextProvider = PROVIDERS.find((p) => p.id === providerId);
    if (!nextProvider) return;

    setSyncedModels([]);
    setSyncedHfCatalog([]);
    saveConfig({
      provider: nextProvider.id,
      model: defaultModelFor(nextProvider.id),
      apiKey: nextProvider.type === "cloud" ? localConfig.apiKey : "",
      baseUrl: PROVIDER_ENDPOINTS[nextProvider.id].apiBaseUrl,
    });
  };

  return (
    <section
      className={
        compact ? "p-3" : "arch-surface mb-3 overflow-hidden rounded-lg border"
      }
    >
      {showRoutingPanel ? (
        <>
          <header
            className={`${compact ? "pb-3" : "arch-surface-muted border-b px-4 py-3"} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}
          >
            <div>
              <p className="arch-primary-text font-mono text-[10px]">
                AI Model Gateway & Routing
              </p>
              <h2 className="arch-text mt-1 text-lg font-medium">
                大模型路由配置
              </h2>
              <p className="arch-muted mt-1 text-xs leading-5">
                统一管理本地推理引擎与云端大模型 API，支持动态同步与网关路由。
              </p>
            </div>
            <button
              onClick={handleSave}
              className="arch-btn-primary inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition"
            >
              <Save className="h-4 w-4" />
              保存路由配置
            </button>
          </header>

          <div
            className={`${compact ? "grid gap-3" : "grid gap-6 p-4 lg:grid-cols-[1fr_360px]"}`}
          >
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Network className="h-4 w-4 arch-primary-text" />
                选择服务商 (Provider)
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    aria-label={provider.name}
                    onClick={() => handleProviderChange(provider.id)}
                    className={[
                      "arch-card-muted rounded-md border px-3 py-2 text-sm font-medium transition hover:border-[var(--arch-primary)]",
                      localConfig.provider === provider.id
                        ? "arch-card-selected"
                        : "",
                    ].join(" ")}
                  >
                    {provider.name}
                  </button>
                ))}
              </div>
              <div>
                <select
                  value={localConfig.provider}
                  onChange={(event) =>
                    handleProviderChange(event.target.value as ProviderId)
                  }
                  className="arch-input w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
                >
                  {PROVIDERS.map((provider) => (
                    <option
                      key={provider.id}
                      value={provider.id}
                      className="bg-[var(--arch-surface)] text-[var(--arch-text)]"
                    >
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 arch-card-muted rounded-md border p-3 self-start">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 arch-primary-text" />
                {isLocal ? "本地推理服务配置" : "云端 API 鉴权配置"}
              </h3>

              <div className="space-y-3">
                <label className="block">
                  <span className="arch-muted mb-1 block text-xs font-medium">
                    选择模型 (Model)
                  </span>
                  <select
                    value={localConfig.model}
                    onChange={(e) =>
                      saveConfig({ ...localConfig, model: e.target.value })
                    }
                    disabled={isLoading}
                    className="arch-input w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
                  >
                    {isLoading ? (
                      <option>同步环境中...</option>
                    ) : localConfig.provider === "huggingface" &&
                      hfModelGroups.length > 0 ? (
                      hfModelGroups.map((group) => (
                        <optgroup
                          key={group.taskType}
                          label={`Hugging Face · ${group.label}`}
                        >
                          {group.models.map((model) => (
                            <option
                              key={model.id}
                              value={model.id}
                              title={model.requiresRuntime || model.capability}
                              className="bg-[var(--arch-surface)] text-[var(--arch-text)]"
                            >
                              {hfModelOptionLabel(model)}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    ) : dynamicModels.length > 0 ? (
                      dynamicModels.map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-[var(--arch-surface)] text-[var(--arch-text)]"
                        >
                          {m}
                        </option>
                      ))
                    ) : (
                      <option value="">未检测到模型 (可手动输入)</option>
                    )}
                  </select>
                  <span className="arch-muted mt-1 block text-[11px] font-medium">
                    Source: {modelSourceLabel}
                  </span>
                </label>

                {isLocal ? (
                  <label className="block">
                    <span className="arch-muted mb-1 block text-xs font-medium">
                      API Base URL
                    </span>
                    <input
                      type="text"
                      value={localConfig.baseUrl || ""}
                      onChange={(e) =>
                        saveConfig({ ...localConfig, baseUrl: e.target.value })
                      }
                      placeholder="http://192.168.1.100:8080"
                      className="arch-input w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="arch-muted mb-1 block text-xs font-medium">
                        API Base URL
                      </span>
                      <input
                        type="text"
                        value={
                          localConfig.baseUrl || providerEndpoint.apiBaseUrl
                        }
                        onChange={(e) =>
                          saveConfig({
                            ...localConfig,
                            baseUrl: e.target.value,
                          })
                        }
                        className="arch-input w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
                      />
                    </label>
                    {providerEndpoint.consoleUrl && (
                      <a
                        href={providerEndpoint.consoleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="arch-muted inline-flex items-center gap-1 text-xs font-medium hover:text-[var(--arch-primary)]"
                      >
                        Provider Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <label className="block">
                      <span className="arch-muted mb-1 block text-xs font-medium">
                        API Key (Bearer Token)
                      </span>
                      <input
                        type="password"
                        value={localConfig.apiKey}
                        onChange={(e) =>
                          saveConfig({ ...localConfig, apiKey: e.target.value })
                        }
                        placeholder={`输入 ${currentProvider?.name} API Key`}
                        className="arch-input w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {businessView === "overview" || businessView === "membership" ? (
        <AICenterManagementPanels
          compact={compact}
          {...(onAudit ? { onAudit } : {})}
        />
      ) : null}

      {activeBillingPanel ? (
        <AICenterManagementPanels
          compact={compact}
          activePanel={activeBillingPanel}
          showPanelTabs={false}
          showCommercialStats={activeBillingPanel !== "governance"}
          showGovernanceTabs={!activeGovernancePanel}
          {...(activeGovernancePanel ? { activeGovernancePanel } : {})}
          {...(onAudit ? { onAudit } : {})}
        />
      ) : null}

      {capabilityPanel ? (
        <AICenterCapabilityPanel panel={capabilityPanel} compact={compact} />
      ) : null}
    </section>
  );
}

function AICenterCapabilityPanel({
  panel,
  compact,
}: {
  panel: NonNullable<
    (typeof AI_CENTER_CAPABILITY_PANELS)[AICenterBusinessView]
  >;
  compact: boolean;
}) {
  return (
    <div
      className={[
        "ai-center-capability-panel",
        compact ? "space-y-3" : "border-t px-4 pb-4 pt-4",
      ].join(" ")}
    >
      <div className="rounded-md border border-slate-100 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="arch-primary-text font-mono text-[10px]">
              {panel.eyebrow}
            </p>
            <h3 className="arch-text mt-1 flex items-center gap-2 text-base font-medium">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                {panel.icon}
              </span>
              {panel.title}
            </h3>
            <p className="arch-muted mt-2 max-w-4xl text-xs leading-5">
              {panel.description}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            <Activity className="h-3.5 w-3.5" />
            已接入工作台导航
          </span>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {panel.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <p className="arch-muted text-xs">{metric.label}</p>
              <p className="mt-1 text-base font-semibold text-slate-950">
                {metric.value}
              </p>
              <p className="arch-muted mt-1 text-[11px]">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-950">执行规则</p>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 lg:grid-cols-3">
            {panel.checklist.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
