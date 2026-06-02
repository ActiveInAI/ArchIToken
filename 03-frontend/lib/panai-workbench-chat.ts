// lib/panai-workbench-chat.ts - PanAI-controlled module workbench chat contract
// License: Apache-2.0

import { getModuleOperationalProfile } from "./module-operations";
import { getModuleSpec, moduleSpecs, type ModuleId } from "./module-registry";

export type PanAIChatRole = "user" | "assistant";

export type PanAICapabilityKind =
  | "module"
  | "operation"
  | "workflow"
  | "image"
  | "video"
  | "cad"
  | "audit"
  | "navigation";

export type PanAITaskType =
  | "chat"
  | "text_to_image"
  | "image_to_video"
  | "cad_model";
export type PanAIModelTaskType =
  | PanAITaskType
  | "code"
  | "ocr"
  | "image_to_image"
  | "image_to_3d"
  | "object_to_3d_asset"
  | "world_3d_research";

export interface PanAIWorkbenchCapability {
  id: string;
  kind: PanAICapabilityKind;
  label: string;
  description: string;
  command: string;
  moduleId?: ModuleId;
  routeHref?: string;
}

export interface PanAIChatArtifact {
  id: string;
  kind:
    | "route_plan"
    | "image_prompt"
    | "video_prompt"
    | "generation_job"
    | "cad_worker_job"
    | "cad_geometry"
    | "cad_mesh"
    | "source_script"
    | "audit_note";
  title: string;
  content: string;
  status: "ready" | "pending_router" | "blocked" | "draft";
  href?: string;
  mediaKind?: "image" | "video" | "file";
  mimeType?: string;
}

export interface PanAIChatMessage {
  id: string;
  role: PanAIChatRole;
  content: string;
  createdAt: string;
  route?: string;
  artifacts?: PanAIChatArtifact[];
}

export type PanAIWorkbenchAction = {
  type: "navigate_module";
  moduleId: ModuleId;
  href: string;
  label: string;
  reason: string;
};

export interface PanAIAuditSummary {
  id: string;
  summary: string;
  at?: string;
  actor?: string;
}

export interface PanAIWorkbenchChatRequest {
  moduleId: ModuleId;
  moduleName: string;
  selectedFeatureTitle?: string;
  activeCapabilityId?: string;
  messages: PanAIChatMessage[];
  capabilities: PanAIWorkbenchCapability[];
  auditEvents: PanAIAuditSummary[];
}

export interface PanAIWorkbenchChatResponse {
  message: PanAIChatMessage;
  routedBy:
    | "panai_gateway"
    | "panai_cli_gateway"
    | "generation_router"
    | "tool_router"
    | "local_model_adapter"
    | "huggingface_local_adapter"
    | "workbench_action_router";
  routeStatus: "routed";
  model?: string;
  diagnostics: string[];
  actions?: PanAIWorkbenchAction[];
}

const imageIntentPattern =
  /配图|生图|生成(?:一张|图片|图像|照片|效果图|渲染图)|画(?:一张|一幅)?|绘制|出图|效果图|渲染|图片|图像|照片|封面|海报|插画|poster|image|render|text[-_ ]?to[-_ ]?image/i;
const creativeVisualIntentPattern =
  /(生产|生成|创建|制作|做|画|绘制)(?:一张|一幅|一个|一只|一些)?[^，。！？\n]*(小狗|小猫|动物|人物|角色|场景|图|图片|照片|图像|海报|插画|效果图|渲染图)/i;
const explicitVisualOutputPattern =
  /配图|生图|一张|一幅|图片|图像|照片|效果图|渲染图|出图|封面|海报|插画|poster|image|render|text[-_ ]?to[-_ ]?image/i;
const videoIntentPattern =
  /视频|动图|动画|镜头|运镜|image[-_ ]?to[-_ ]?video|text[-_ ]?to[-_ ]?video|video/i;
const codeIntentPattern =
  /代码|脚本|函数|接口|编译|测试|报错|异常|调试|重构|Rust|Python|TypeScript|JavaScript|SQL|schema|CI|worker|adapter|code|bug|test/i;
const ocrIntentPattern =
  /OCR|文字识别|识别文字|提取文字|扫描件|文档解析|表格识别|公式识别|印章识别|票据|合同识别|图纸文字/i;
const imageToImageIntentPattern =
  /图生图|以图生图|参考图|改图|重绘|局部重绘|风格迁移|换风格|image[-_ ]?to[-_ ]?image/i;
const imageTo3dIntentPattern =
  /图生3D|图像转3D|图片转3D|单图三维|三维世界|3D世界|image[-_ ]?to[-_ ]?3d|3d world/i;
const objectTo3dAssetIntentPattern =
  /物体转3D|对象转3D|资产生成|仿真资产|3DGS资产|PLY|object[-_ ]?to[-_ ]?3d|asset/i;
const world3dResearchIntentPattern =
  /世界模型|可探索3D|3D研究|research 3d|world[-_ ]?3d|Lyra/i;
const cadModelIntentPattern =
  /钢管|圆管|管件|管道|管材|构件|零件|部件|几何|实体|模型|STEP|STL|CAD|BRep|cadquery|build123d|pipe|tube|solid|model/i;
const moduleNavigationVerbPattern =
  /进入|打开|切换|跳转|前往|去到|转到|查看|接管|go to|open|switch|navigate/i;
const moduleNavigationStopwordPattern =
  /不要|别|禁止|不(?:要|用|能|应该)|无法|为什么|怎么/i;

const moduleAliasEntries: Array<{ moduleId: ModuleId; aliases: string[] }> = [
  {
    moduleId: "personal_center",
    aliases: ["个人中心", "个人", "我的", "我的工作台", "账号", "通知", "待办"],
  },
  {
    moduleId: "marketing_service",
    aliases: ["市场客服", "市场", "客服", "营销", "商机", "线索"],
  },
  {
    moduleId: "planning_management",
    aliases: ["计划管理", "计划", "甘特", "WBS", "wbs", "进度"],
  },
  {
    moduleId: "concept_design",
    aliases: ["方案设计", "方案", "概念设计", "概念"],
  },
  {
    moduleId: "standard_library",
    aliases: ["标准族库", "标准库", "族库", "标准"],
  },
  {
    moduleId: "detailed_design",
    aliases: ["深化设计", "深化", "施工图", "深化图"],
  },
  {
    moduleId: "quantity_costing",
    aliases: ["计量造价", "造价", "计量", "成本", "预算"],
  },
  {
    moduleId: "material_logistics",
    aliases: ["材料物流", "材料", "物流", "采购"],
  },
  {
    moduleId: "production_manufacturing",
    aliases: ["生产制造", "生产", "制造", "工厂", "加工"],
  },
  {
    moduleId: "construction_management",
    aliases: ["施工管理", "施工", "现场", "建造"],
  },
  {
    moduleId: "digital_twin",
    aliases: ["数字孪生", "孪生", "模型孪生"],
  },
  {
    moduleId: "digital_archive",
    aliases: ["数字档案", "档案", "归档"],
  },
  {
    moduleId: "finance_management",
    aliases: [
      "财务管理",
      "财务",
      "智能会计",
      "系统参数",
      "分录类型",
      "凭证模板",
      "凭证生成",
      "财务核对",
      "差异分析",
    ],
  },
  {
    moduleId: "human_resources",
    aliases: ["人力资源", "人力", "人资", "HR", "hr", "人员", "班组", "考勤"],
  },
  {
    moduleId: "ai_center",
    aliases: ["AI中心", "AI 中心", "ai中心", "AI", "ai center", "模型中心"],
  },
  {
    moduleId: "settings_center",
    aliases: ["设置中心", "设置", "配置", "系统设置"],
  },
];

export function createPanAIMessage(
  role: PanAIChatRole,
  content: string,
  options: {
    route?: string;
    artifacts?: PanAIChatArtifact[];
    createdAt?: string;
  } = {},
): PanAIChatMessage {
  const message: PanAIChatMessage = {
    id: createMessageId(role),
    role,
    content,
    createdAt: options.createdAt ?? new Date().toISOString(),
  };

  if (options.route) {
    message.route = options.route;
  }

  if (options.artifacts?.length) {
    message.artifacts = options.artifacts;
  }

  return message;
}

export function buildPanAIWorkbenchCapabilities(
  moduleId: ModuleId,
): PanAIWorkbenchCapability[] {
  const currentSpec = getModuleSpec(moduleId);
  const operationalProfile = getModuleOperationalProfile(moduleId);
  const currentOperations = operationalProfile.operations.map((operation) => ({
    id: `${moduleId}:operation:${operation.id}`,
    kind: "operation" as const,
    label: operation.label,
    description: operation.result,
    command: `${currentSpec.zhName} / ${operation.label}`,
    moduleId,
    routeHref: currentSpec.routeHref,
  }));
  const moduleRoutes = moduleSpecs.map((spec) => ({
    id: `${spec.id}:module`,
    kind: "module" as const,
    label: spec.zhName,
    description: spec.summary,
    command: `打开 ${spec.zhName} 并接管 ${spec.enName}`,
    moduleId: spec.id,
    routeHref: spec.routeHref,
  }));

  return [
    {
      id: "panai:platform-orchestrator",
      kind: "workflow",
      label: "全平台接管",
      description:
        "通过 PanAI 调度 16 个模块、CDE 文件、审批、审计、工具和模型路由。",
      command: "PanAI 接管全部业务系统能力",
      moduleId,
    },
    {
      id: "panai:hf-image",
      kind: "image",
      label: "大模型配图",
      description:
        "把配图意图交给 GenerationRouter，并优先使用本地 Hugging Face media adapter。",
      command: "根据当前业务上下文生成配图提示词和图像任务",
      moduleId,
    },
    {
      id: "panai:hf-video",
      kind: "video",
      label: "大模型视频",
      description:
        "把视频意图交给 GenerationRouter，并优先使用本地 Hugging Face ImageToVideo adapter。",
      command: "根据当前图片或业务上下文生成视频任务",
      moduleId,
    },
    {
      id: "panai:cad-worker",
      kind: "cad",
      label: "工程几何生成",
      description:
        "把参数化构件意图交给 ToolRouter，并调用本地 CadQuery/build123d worker 生成真实 STEP/STL artifact。",
      command: "通过 ToolRouter 调用 CAD worker 生成工程几何",
      moduleId,
    },
    {
      id: "panai:audit-evidence",
      kind: "audit",
      label: "审计证据链",
      description: "把聊天、工具、文件、审批和生成任务写入可追踪审计链。",
      command: "生成当前会话审计摘要",
      moduleId,
    },
    ...currentOperations,
    ...moduleRoutes,
  ];
}

export function isPanAIImageIntent(
  input: string,
  activeCapabilityId?: string,
): boolean {
  return (
    activeCapabilityId === "panai:hf-image" ||
    imageIntentPattern.test(input) ||
    creativeVisualIntentPattern.test(input)
  );
}

export function isPanAIVideoIntent(
  input: string,
  activeCapabilityId?: string,
): boolean {
  return (
    activeCapabilityId === "panai:hf-video" || videoIntentPattern.test(input)
  );
}

export function isPanAICadModelIntent(
  input: string,
  activeCapabilityId?: string,
): boolean {
  return (
    activeCapabilityId === "panai:cad-worker" ||
    cadModelIntentPattern.test(input)
  );
}

export function isExplicitVisualOutputIntent(input: string): boolean {
  return (
    explicitVisualOutputPattern.test(input) ||
    imageToImageIntentPattern.test(input)
  );
}

export function resolvePanAITaskType(
  input: string,
  activeCapabilityId?: string,
): PanAITaskType {
  if (isPanAIVideoIntent(input, activeCapabilityId)) return "image_to_video";
  if (
    isPanAICadModelIntent(input, activeCapabilityId) &&
    !isExplicitVisualOutputIntent(input)
  )
    return "cad_model";
  if (isPanAIImageIntent(input, activeCapabilityId)) return "text_to_image";
  if (isPanAICadModelIntent(input, activeCapabilityId)) return "cad_model";
  return "chat";
}

export function resolvePanAIModelTaskType(
  input: string,
  activeCapabilityId?: string,
): PanAIModelTaskType {
  if (isPanAIVideoIntent(input, activeCapabilityId)) return "image_to_video";
  if (imageToImageIntentPattern.test(input)) return "image_to_image";
  if (world3dResearchIntentPattern.test(input)) return "world_3d_research";
  if (objectTo3dAssetIntentPattern.test(input)) return "object_to_3d_asset";
  if (imageTo3dIntentPattern.test(input)) return "image_to_3d";
  if (ocrIntentPattern.test(input)) return "ocr";
  if (codeIntentPattern.test(input)) return "code";
  if (
    isPanAICadModelIntent(input, activeCapabilityId) &&
    !isExplicitVisualOutputIntent(input)
  )
    return "cad_model";
  if (isPanAIImageIntent(input, activeCapabilityId)) return "text_to_image";
  if (isPanAICadModelIntent(input, activeCapabilityId)) return "cad_model";
  return "chat";
}

export function resolvePanAINavigationAction(
  input: string,
  currentModuleId?: ModuleId,
): PanAIWorkbenchAction | null {
  const normalizedInput = normalizeNavigationText(input);
  if (
    !normalizedInput ||
    !moduleNavigationVerbPattern.test(input) ||
    moduleNavigationStopwordPattern.test(input)
  ) {
    return null;
  }

  const matchedSpec = moduleSpecs.find((spec) =>
    buildModuleNavigationAliases(spec).some((alias) =>
      normalizedInput.includes(normalizeNavigationText(alias)),
    ),
  );
  if (!matchedSpec) return null;

  return {
    type: "navigate_module",
    moduleId: matchedSpec.id,
    href: matchedSpec.routeHref,
    label: matchedSpec.zhName,
    reason:
      matchedSpec.id === currentModuleId
        ? "当前已经在 " + matchedSpec.zhName + " 模块。"
        : "用户要求切换到 " + matchedSpec.zhName + " 模块。",
  };
}

export async function invokePanAIWorkbenchChat(
  request: PanAIWorkbenchChatRequest,
): Promise<PanAIWorkbenchChatResponse> {
  const response = await fetch("/api/ai/panai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      diagnostics?: string[];
    } | null;
    const message =
      payload?.error ?? `PanAI chat route failed: HTTP ${response.status}`;
    throw new Error([message, ...(payload?.diagnostics ?? [])].join("\n"));
  }

  return response.json() as Promise<PanAIWorkbenchChatResponse>;
}

export function buildImagePrompt(
  request: PanAIWorkbenchChatRequest,
  userInput: string,
): string {
  const moduleSpec = getModuleSpec(request.moduleId);
  const selectedFeature = request.selectedFeatureTitle
    ? `业务对象: ${request.selectedFeatureTitle}. `
    : "";

  return [
    "Create a high-quality visual reference image for ArchIToken.",
    `User request is the primary subject: ${userInput}.`,
    `${selectedFeature}Module context: ${moduleSpec.zhName} / ${moduleSpec.enName}.`,
    "Style: clean professional visual, realistic lighting, coherent subject, no text overlay.",
    "Use AEC or architectural context only when the user request explicitly asks for it.",
    "Constraints: produce visual reference material only; engineering documents still require RuleChecker, SchemaValidator and Approver.",
  ].join(" ");
}

export function buildVideoPrompt(
  request: PanAIWorkbenchChatRequest,
  userInput: string,
): string {
  const moduleSpec = getModuleSpec(request.moduleId);
  const selectedFeature = request.selectedFeatureTitle
    ? `Business object: ${request.selectedFeatureTitle}. `
    : "";

  return [
    "Create a short professional motion sequence for ArchIToken.",
    `User request is the primary motion brief: ${userInput}.`,
    `${selectedFeature}Module context: ${moduleSpec.zhName} / ${moduleSpec.enName}.`,
    "Camera: stable, readable, slow movement, no text overlay.",
    "Use architectural or engineering context only when explicitly requested.",
    "Constraints: produce video reference material only; engineering documents still require RuleChecker, SchemaValidator and Approver.",
  ].join(" ");
}

function createMessageId(role: PanAIChatRole): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${role}-${crypto.randomUUID()}`;
  }

  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildModuleNavigationAliases(spec: (typeof moduleSpecs)[number]) {
  const staticAliases =
    moduleAliasEntries.find((entry) => entry.moduleId === spec.id)?.aliases ??
    [];
  return [
    spec.id,
    spec.id.replaceAll("_", " "),
    spec.id.replaceAll("_", ""),
    spec.zhName,
    spec.enName,
    spec.enName.replaceAll(" ", ""),
    ...staticAliases,
  ];
}

function normalizeNavigationText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "");
}
