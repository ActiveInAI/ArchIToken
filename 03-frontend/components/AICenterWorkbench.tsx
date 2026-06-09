// components/AICenterWorkbench.tsx
// License: Apache-2.0
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
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
  getProviderModelCatalog,
  getProviderSecretStatus,
  type LocalModelCatalogEntry,
  type ProviderModelCatalogId,
  type ProviderSecretStatus,
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
  | "modelService"
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
  | "panai"
  | "safety"
  | "cost";

const PROVIDERS: {
  id: ProviderId;
  name: string;
  icon: ReactNode;
  type: "local" | "cloud";
}[] = [
  {
    id: "vllm",
    name: "vLLM",
    icon: <Server className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "ollama",
    name: "Ollama",
    icon: <Box className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    icon: <Cpu className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    icon: <Globe className="h-5 w-5" />,
    type: "local",
  },
  {
    id: "qwen",
    name: "Qwen / 通义千问",
    icon: <Bot className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "gemini",
    name: "Gemini API",
    icon: <Globe className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "zhipu",
    name: "智谱 GLM / Z.ai",
    icon: <Cpu className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "kimi",
    name: "Kimi / 月之暗面",
    icon: <BookOpen className="h-5 w-5" />,
    type: "cloud",
  },
  {
    id: "minimax",
    name: "MiniMax",
    icon: <Sparkles className="h-5 w-5" />,
    type: "cloud",
  },
];

const AI_CENTER_FOLDER_VIEWS: Record<string, AICenterBusinessView> = {
  路由配置: "modelService",
  模型路由: "modelService",
  模型供应商: "modelService",
  推理服务: "modelService",
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
  PanAI自动化: "panai",
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
  panai: {
    eyebrow: "PanAI Automation",
    title: "PanAI 自动化",
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

const AI_CENTER_HOME_CARDS: {
  view: Extract<AICenterBusinessView, "modelService" | "membership">;
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  metrics: string[];
}[] = [
  {
    view: "modelService",
    eyebrow: "AI Model Gateway & Inference",
    title: "模型服务",
    description:
      "把路由配置和推理服务放在同一页，统一维护服务商、模型目录、API Base URL 和鉴权。",
    icon: <Network className="h-5 w-5" />,
    metrics: ["路由配置", "推理服务", "统一保存"],
  },
  {
    view: "membership",
    eyebrow: "AI Billing & Access",
    title: "会员充值",
    description: "管理套餐、额度充值、API Token、订单账单和用量治理。",
    icon: <Wallet className="h-5 w-5" />,
    metrics: ["套餐额度", "Token", "账单"],
  },
];

const ROLE_ALIAS_MODELS = [
  "architoken-planner",
  "architoken-generator",
  "architoken-evaluator",
];

const CLOUD_ALIAS_MODELS: Record<ProviderId, string[]> = {
  vllm: [],
  ollama: [],
  lmstudio: [],
  huggingface: ["baidu/ERNIE-Image"],
  qwen: ROLE_ALIAS_MODELS,
  gemini: ROLE_ALIAS_MODELS,
  zhipu: ROLE_ALIAS_MODELS,
  kimi: ROLE_ALIAS_MODELS,
  minimax: ROLE_ALIAS_MODELS,
};

const PROVIDER_ENDPOINTS: Record<
  ProviderId,
  { apiBaseUrl: string; consoleUrl?: string }
> = {
  vllm: { apiBaseUrl: "http://127.0.0.1:8000/v1" },
  ollama: { apiBaseUrl: "http://127.0.0.1:11434" },
  lmstudio: { apiBaseUrl: "http://127.0.0.1:1234/v1" },
  huggingface: {
    apiBaseUrl: "http://127.0.0.1:7071/v1",
    consoleUrl: "https://huggingface.co/models",
  },
  qwen: {
    apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    consoleUrl: "https://bailian.console.aliyun.com/",
  },
  gemini: {
    apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    consoleUrl: "https://aistudio.google.com/",
  },
  zhipu: {
    apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    consoleUrl: "https://open.bigmodel.cn/",
  },
  kimi: {
    apiBaseUrl: "https://api.moonshot.cn/v1",
    consoleUrl: "https://platform.moonshot.cn/",
  },
  minimax: {
    apiBaseUrl: "https://api.minimax.io/v1",
    consoleUrl: "https://platform.minimaxi.com/",
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

function defaultModelFor(provider: ProviderId): string {
  return (
    CLOUD_ALIAS_MODELS[provider][1] || CLOUD_ALIAS_MODELS[provider][0] || ""
  );
}

function isProviderModelCatalogId(
  provider: ProviderId,
): provider is ProviderModelCatalogId {
  return [
    "vllm",
    "lmstudio",
    "qwen",
    "gemini",
    "zhipu",
    "kimi",
    "minimax",
  ].includes(provider);
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
  const [providerSecretStatus, setProviderSecretStatus] =
    useState<ProviderSecretStatus | null>(null);
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
  const [selectedBusinessView, setSelectedBusinessView] = useState<{
    folderName: string | null;
    view: AICenterBusinessView;
  } | null>(null);
  const activeBusinessFolderName = activeFolderName ?? null;
  const folderBusinessView = resolveAICenterBusinessView(activeFolderName);
  const selectedViewForFolder =
    selectedBusinessView?.folderName === activeBusinessFolderName
      ? selectedBusinessView
      : null;
  const businessView =
    selectedViewForFolder?.view ?? folderBusinessView;
  const showModelServicePanel = businessView === "modelService";
  const activeBillingPanel = billingPanelForView(businessView);
  const activeGovernancePanel = governancePanelForView(businessView);
  const capabilityPanel = AI_CENTER_CAPABILITY_PANELS[businessView] ?? null;

  useEffect(() => {
    let cancelled = false;
    const provider = localConfig.provider;
    const baseUrl = localConfig.baseUrl;

    const fetchModels = async () => {
      setIsLoading(true);
      try {
        let models: string[] = [];
        const secretStatus = await getProviderSecretStatus(provider);
        if (!cancelled) {
          setProviderSecretStatus(secretStatus);
        }
        if (provider === "ollama") {
          setSyncedHfCatalog([]);
          models = await getOllamaModels();
        } else if (provider === "huggingface") {
          const catalog = await getHfModelCatalog();
          if (!cancelled) {
            setSyncedHfCatalog(catalog);
          }
          models = catalog.map((model) => model.id);
        } else if (isProviderModelCatalogId(provider)) {
          setSyncedHfCatalog([]);
          models = await getProviderModelCatalog({
            provider,
            ...(baseUrl ? { baseUrl } : {}),
          });
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
  }, [localConfig.baseUrl, localConfig.provider]);

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
      baseUrl: PROVIDER_ENDPOINTS[nextProvider.id].apiBaseUrl,
    });
  };

  const openBusinessPage = (
    view: Extract<AICenterBusinessView, "modelService" | "membership">,
  ) => {
    setSelectedBusinessView({ folderName: activeBusinessFolderName, view });
    onAudit?.(
      createModuleAuditEvent(
        "ai-center-page-open",
        "AICenterWorkbench",
        `进入 AI 中心功能页: ${view}`,
      ),
    );
  };

  const returnToOverview = () => {
    setSelectedBusinessView({
      folderName: activeBusinessFolderName,
      view: "overview",
    });
  };

  return (
    <section
      className={
        compact ? "p-3" : "arch-surface mb-3 overflow-hidden rounded-lg border"
      }
    >
      {businessView === "overview" ? (
        <AICenterOverviewCards
          compact={compact}
          currentProviderName={currentProvider?.name || localConfig.provider}
          currentModel={localConfig.model || "未选择模型"}
          onOpen={openBusinessPage}
        />
      ) : null}

      {showModelServicePanel ? (
        <>
          <AICenterPageHeader
            compact={compact}
            eyebrow="AI Model Gateway & Inference"
            title="模型服务"
            description="路由配置和推理服务放在同一页，统一维护默认服务商、网关路由、模型目录、API Base URL 和鉴权。"
            onBack={returnToOverview}
            action={
              <button
                onClick={handleSave}
                className="arch-btn-primary inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition"
              >
                <Save className="h-4 w-4" />
                保存模型服务配置
              </button>
            }
          />

          <div
            className={`${compact ? "grid gap-3" : "grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_360px]"}`}
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Network className="h-4 w-4 text-[var(--module-accent)]" />
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
                        "arch-card-muted rounded-md border px-3 py-2 text-sm font-medium transition hover:border-[var(--module-accent)]",
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

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-slate-100 bg-white px-3 py-3">
                  <p className="arch-muted text-xs">当前服务商</p>
                  <p className="mt-1 text-base font-medium text-slate-950">
                    {currentProvider?.name || localConfig.provider}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-white px-3 py-3">
                  <p className="arch-muted text-xs">模型来源</p>
                  <p className="mt-1 text-base font-medium text-slate-950">
                    {modelSourceLabel}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-white px-3 py-3">
                  <p className="arch-muted text-xs">同步状态</p>
                  <p className="mt-1 text-base font-medium text-slate-950">
                    {isLoading ? "同步中" : "就绪"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 arch-card-muted rounded-md border p-3 self-start">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 text-[var(--module-accent)]" />
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
                        saveConfig({
                          ...localConfig,
                          baseUrl: e.target.value,
                        })
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
                        className="arch-muted inline-flex items-center gap-1 text-xs font-medium hover:text-[var(--module-accent)]"
                      >
                        Provider Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <div className="rounded-md border border-[var(--module-accent)] bg-[var(--module-accent-soft)] px-3 py-2">
                      <span className="arch-muted block text-xs font-medium">
                        Server Secret
                      </span>
                      <p className="mt-1 text-sm font-medium text-slate-950">
                        {providerSecretStatus?.mode === "server_secret"
                          ? providerSecretStatus.configured
                            ? "服务端密钥已配置"
                            : "服务端密钥未配置"
                          : "无需额外密钥"}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {providerSecretStatus?.tokenEnv
                          ? `由服务端环境变量 ${providerSecretStatus.tokenEnv} 管理。`
                          : "鉴权由内部 Router 或本地运行时管理。"}
                        浏览器不保存、不显示供应商 API Key。
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {businessView === "membership" ? (
        <>
          <AICenterPageHeader
            compact={compact}
            eyebrow="AI Billing & API Access"
            title="会员充值"
            description="管理套餐、额度充值、API Token、订单账单和用量治理。"
            onBack={returnToOverview}
          />
          <AICenterManagementPanels
            compact={compact}
            showHeader={false}
            {...(onAudit ? { onAudit } : {})}
          />
        </>
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

function AICenterOverviewCards({
  compact,
  currentProviderName,
  currentModel,
  onOpen,
}: {
  compact: boolean;
  currentProviderName: string;
  currentModel: string;
  onOpen: (
    view: Extract<AICenterBusinessView, "modelService" | "membership">,
  ) => void;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4 p-4"}>
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] text-[var(--module-accent)]">
          AI Model Gateway & Operations
        </p>
        <h2 className="arch-text text-lg font-medium">AI中心</h2>
        <p className="arch-muted max-w-4xl text-xs leading-5">
          路由与推理集中在模型服务页维护，会员账本独立管理；所有模型调用仍通过内部
          Router、审计和审批链路进入业务模块。
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {AI_CENTER_HOME_CARDS.map((card) => (
          <button
            key={card.view}
            type="button"
            onClick={() => onOpen(card.view)}
            className="group flex min-h-[180px] flex-col justify-between rounded-md border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-[var(--module-accent)] hover:bg-[var(--module-accent-soft)]"
            data-testid={`ai-center-card-${card.view}`}
          >
            <span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--module-accent-soft)] text-[var(--module-accent)]">
                {card.icon}
              </span>
              <span className="mt-4 block font-mono text-[10px] text-[var(--module-accent)]">
                {card.eyebrow}
              </span>
              <span className="arch-text mt-1 block text-base font-semibold">
                {card.title}
              </span>
              <span className="arch-muted mt-2 block text-xs leading-5">
                {card.description}
              </span>
            </span>
            <span className="mt-4 flex items-end justify-between gap-3">
              <span className="flex flex-wrap gap-1.5">
                {card.metrics.map((metric) => (
                  <span
                    key={metric}
                    className="rounded-full border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 group-hover:border-[var(--module-accent)] group-hover:bg-[var(--arch-surface)]"
                  >
                    {metric}
                  </span>
                ))}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--module-accent)]" />
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="arch-muted text-xs">当前服务商</p>
          <p className="mt-1 text-sm font-medium text-slate-950">
            {currentProviderName}
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="arch-muted text-xs">当前模型</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-950">
            {currentModel}
          </p>
        </div>
      </div>
    </div>
  );
}

function AICenterPageHeader({
  compact,
  eyebrow,
  title,
  description,
  onBack,
  action,
}: {
  compact: boolean;
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <header
      className={`${compact ? "pb-3" : "arch-surface-muted border-b px-4 py-3"} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-[var(--module-accent)]">
            {eyebrow}
          </p>
          <h2 className="arch-text mt-1 text-lg font-medium">{title}</h2>
          <p className="arch-muted mt-1 text-xs leading-5">{description}</p>
        </div>
      </div>
      {action}
    </header>
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
            <p className="font-mono text-[10px] text-[var(--module-accent)]">
              {panel.eyebrow}
            </p>
            <h3 className="arch-text mt-1 flex items-center gap-2 text-base font-medium">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--module-accent-soft)] text-[var(--module-accent)]">
                {panel.icon}
              </span>
              {panel.title}
            </h3>
            <p className="arch-muted mt-2 max-w-4xl text-xs leading-5">
              {panel.description}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--module-accent)] bg-[var(--module-accent-soft)] px-2 py-1 text-xs font-medium text-[var(--module-accent)]">
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
