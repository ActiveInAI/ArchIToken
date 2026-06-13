import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildImagePrompt,
  buildVideoPrompt,
  createPanAIMessage,
  isPanAIFloorplanSuiteIntent,
  resolvePanAIModelTaskType,
  resolvePanAINavigationAction,
  resolvePanAITaskType,
  type PanAIChatArtifact,
  type PanAIModelTaskType,
  type PanAITaskType,
  type PanAIWorkbenchChatRequest,
  type PanAIWorkbenchChatResponse,
} from "@/lib/panai-workbench-chat";
import {
  buildFurniture,
  createPlanCandidates,
  initialIntent,
  parsePromptToIntent,
  type PlanCandidate,
} from "@/lib/architoken/floorplan-layout";
import {
  floorplanToDrawingSpec,
  renderFloorplanColorSvg,
} from "@/lib/architoken/floorplan-drawing";
import {
  buildFloorplanRenderPrompt,
  rasterizeFloorplanLineartPng,
} from "@/lib/architoken/floorplan-control-image";
import {
  floorplanToBimSpec,
  validateTextToBimSpec,
  type TextToBimSpec,
} from "@/lib/architoken/text-to-bim-spec";
import { checkFloorplanCompliance } from "@/lib/architoken/floorplan-compliance";
import {
  parseCadDrawingSpec,
  renderCadDrawingDxf,
  validateCadDrawingEntities,
  type CadDrawingSpec,
} from "@/lib/panai-cad-drawing";
import {
  analyzeBimModel,
  createBimCollabIssue,
  extractIssueTitle,
  findBimModelFiles,
  getBimCollabIssueStorePath,
  listBimCollabIssues,
  pickBimModelFile,
  resolveBimCollabAction,
} from "@/lib/panai-bim-collab";
import { saveLocalUpload } from "@/lib/local-file-runtime-server";
import { getModuleSpec, normalizeModuleId } from "@/lib/module-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OpenAiCompatibleChoice {
  message?: {
    content?: string;
  };
  text?: string;
}

interface OpenAiCompatibleResponse {
  choices?: OpenAiCompatibleChoice[];
  output_text?: string;
  content?: string;
  model?: string;
}

interface PanAICliResponse {
  ok?: boolean;
  provider?: string;
  model?: string;
  transport?: string;
  outputs?: Array<{
    text?: string;
    mediaUrl?: string | null;
  }>;
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    content?: string;
    thinking?: string;
  };
  response?: string;
  error?: string;
}

interface GenerationJobEnvelope {
  id?: string;
  jobId?: string;
  job_id?: string;
  status?: string;
}

interface GenerationArtifactEnvelope {
  artifacts?: Array<{
    id?: string;
    kind?: string;
    artifactMetadata?: {
      mimeType?: string;
    };
    reference?: {
      name?: string;
    };
  }>;
}

interface WorkerArtifactEnvelope {
  name?: string;
  media_type?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

interface WorkerResultEnvelope {
  job_id?: string;
  status?: string;
  artifacts?: WorkerArtifactEnvelope[];
  output?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
}

interface CadPipeSpec {
  shape: "pipe";
  units: "mm";
  dimensions: {
    length: number;
    outerDiameter: number;
    wallThickness: number;
  };
  metadata: {
    sourcePrompt: string;
    wallThicknessSource: "prompt" | "heuristic_default";
    complianceNotice: string;
  };
}

export async function POST(request: NextRequest) {
  let body: PanAIWorkbenchChatRequest;

  try {
    body = parseStrictPanAIRequest(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid PanAI chat request body." },
      { status: 400 },
    );
  }

  const diagnostics: string[] = [];
  const systemPrompt = buildSystemPrompt(body);
  const latestUserMessage = [...body.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestInput = latestUserMessage?.content ?? "";
  const navigationAction = resolvePanAINavigationAction(
    latestInput,
    body.moduleId,
  );
  if (navigationAction) {
    const sameModule = navigationAction.moduleId === body.moduleId;
    const fromSpec = getModuleSpec(body.moduleId);
    const targetSpec = getModuleSpec(navigationAction.moduleId);
    diagnostics.push(
      sameModule
        ? `WorkbenchActionRouter 识别到当前模块 ${targetSpec.id}，无需跳转。`
        : `WorkbenchActionRouter 识别到模块跳转 ${fromSpec.id} -> ${targetSpec.id}。`,
    );

    return NextResponse.json({
      message: createPanAIMessage(
        "assistant",
        sameModule
          ? `当前已在 ${targetSpec.zhName} 模块。`
          : `正在进入 ${targetSpec.zhName} 模块。`,
        {},
      ),
      routedBy: "workbench_action_router",
      routeStatus: "routed",
      model: "WorkbenchActionRouter/navigation",
      diagnostics,
      actions: sameModule ? [] : [navigationAction],
    } satisfies PanAIWorkbenchChatResponse);
  }

  const taskType = resolvePanAITaskType(
    latestInput,
    body.activeCapabilityId,
  );
  const modelTaskType = resolvePanAIModelTaskType(
    latestInput,
    body.activeCapabilityId,
  );
  const artifacts = await buildArtifacts(
    body,
    latestInput,
    taskType,
    diagnostics,
  );

  if (taskType === "text_to_image" || taskType === "image_to_video") {
    const generated = artifacts.find(
      (artifact) =>
        artifact.kind === "generation_job" && artifact.status === "ready",
    );
    const modeLabel =
      taskType === "text_to_image" ? "TextToImage" : "ImageToVideo";
    return NextResponse.json({
      message: createPanAIMessage(
        "assistant",
        generated
          ? `已通过 GenerationRouter 调用真实 ${modeLabel} provider，并生成 artifact。`
          : `没有生成 artifact：当前真实 ${modeLabel} provider 未配置、缺少输入图片或执行失败，已拒绝生成假结果。请配置本地 Hugging Face media endpoint/command，或显式允许远端 HF；视频任务还必须提供 imageUrl/imageBase64 或输入图片 artifact。`,
        {
          route: `GenerationRouter -> ${modeLabel} HTTP provider`,
          artifacts,
        },
      ),
      routedBy: "generation_router",
      routeStatus: "routed",
      model: generated
        ? `GenerationRouter/${modeLabel}`
        : `GenerationRouter/${modeLabel} blocked`,
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  if (taskType === "cad_model") {
    const generated = artifacts.find(
      (artifact) =>
        artifact.kind === "cad_worker_job" && artifact.status === "ready",
    );
    return NextResponse.json({
      message: createPanAIMessage(
        "assistant",
        generated
          ? "已通过 ToolRouter 调用本地 CAD worker 生成真实 CAD artifact。环境支持 BRep 内核时输出 STEP/STL；当前无 CadQuery/OCP 时至少输出真实 STL 网格。未提供壁厚时只使用启发默认值，仍需 RuleChecker、SchemaValidator 和 Approver 才能用于加工或施工。"
          : "没有生成 CAD artifact：当前本地 CadQuery worker 未安装、规格解析失败或执行失败，已拒绝生成假结果。",
        {
          route: "ToolRouter -> CAD worker -> CAD artifact",
          artifacts,
        },
      ),
      routedBy: "tool_router",
      routeStatus: "routed",
      model: generated ? "ToolRouter/cadquery" : "ToolRouter/cadquery blocked",
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  if (taskType === "cad_drawing") {
    const drawingFile = artifacts.find(
      (artifact) =>
        artifact.kind === "cad_drawing" &&
        artifact.status === "ready" &&
        artifact.href,
    );
    return NextResponse.json({
      message: createPanAIMessage(
        "assistant",
        drawingFile
          ? `CAD绘图助手已把绘图指令解析为真实 DXF 实体并生成图纸文件「${drawingFile.title}」。文件已注册到本地文件运行时，可在模块文件区用内置 CAD 查看器打开，也可点击 artifact 链接下载。该图纸是参数化草图，缺少规范、标注审查和审批证据时不能直接作为施工图。`
          : "CAD绘图助手没有生成图纸：当前指令无法解析为可靠的绘图实体（支持：房间/矩形 宽x高、圆 半径/直径、轴网 跨数x跨数+跨距、直线 长度），且本地大模型未能给出有效实体 JSON，已拒绝生成假图纸。",
        {
          route: "PanAIRouter -> CadDrawingAssistant -> DXF -> LocalFileRuntime",
          artifacts,
        },
      ),
      routedBy: "tool_router",
      routeStatus: "routed",
      model: drawingFile
        ? "CadDrawingAssistant/dxf"
        : "CadDrawingAssistant/dxf blocked",
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  if (taskType === "bim_collab") {
    const ready = artifacts.find(
      (artifact) =>
        (artifact.kind === "bim_collab" || artifact.kind === "bim_issue") &&
        artifact.status === "ready",
    );
    return NextResponse.json({
      message: createPanAIMessage(
        "assistant",
        ready
          ? "BIM协同助手已基于真实数据完成本次操作（IFC 模型解析结果或持久化协同议题见 artifact）。模型统计来自对已上传 IFC 文件的逐实体解析；议题已落盘，可随时列出跟踪。"
          : "BIM协同助手没有可操作的数据：当前本地文件运行时里没有已上传的 IFC 模型，或指令无法解析。请先在模块文件区上传 .ifc 模型，再让我做构件统计、楼层分析或创建协同议题。",
        {
          route: "PanAIRouter -> BimCollabAssistant -> IFC/IssueStore",
          artifacts,
        },
      ),
      routedBy: "tool_router",
      routeStatus: "routed",
      model: ready
        ? "BimCollabAssistant/local"
        : "BimCollabAssistant/local blocked",
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  const panAIGateway = await invokePanAIGateway(
    body,
    systemPrompt,
    modelTaskType,
    diagnostics,
  );
  if (panAIGateway) {
    return NextResponse.json({
      message: createPanAIMessage("assistant", panAIGateway.content, {
        route: "PanAI Gateway /v1/chat/completions",
        artifacts,
      }),
      routedBy: "panai_gateway",
      routeStatus: "routed",
      model: panAIGateway.model ?? "panai/default",
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  const huggingFaceLocal = await invokeHuggingFaceLocalChatAdapter(
    body,
    systemPrompt,
    modelTaskType,
    diagnostics,
  );
  if (huggingFaceLocal) {
    return NextResponse.json({
      message: createPanAIMessage("assistant", huggingFaceLocal.content, {
        route:
          "PanAIRouter -> ModelRouter -> InferenceRouter -> Hugging Face local/vLLM provider",
        artifacts,
      }),
      routedBy: "huggingface_local_adapter",
      routeStatus: "routed",
      model: huggingFaceLocal.model,
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  const localModel = await invokeLocalModelAdapter(
    body,
    systemPrompt,
    modelTaskType,
    diagnostics,
  );
  if (localModel) {
    return NextResponse.json({
      message: createPanAIMessage("assistant", localModel.content, {
        route: "PanAIRouter -> LocalModelAdapter -> Ollama real model",
        artifacts,
      }),
      routedBy: "local_model_adapter",
      routeStatus: "routed",
      model: localModel.model,
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  if (panAICliFallbackEnabled()) {
    const panAICli = await invokePanAICliGateway(
      body,
      systemPrompt,
      modelTaskType,
      diagnostics,
    );
    if (panAICli) {
      return NextResponse.json({
        message: createPanAIMessage("assistant", panAICli.content, {
          route: "PanAI CLI -> Gateway -> model.run",
          artifacts,
        }),
        routedBy: "panai_cli_gateway",
        routeStatus: "routed",
        model: panAICli.model,
        diagnostics,
      } satisfies PanAIWorkbenchChatResponse);
    }
  } else {
    diagnostics.push(
      "PanAI CLI fallback 未启用；避免把 PANAI_MODEL_OK/HEARTBEAT_OK 这类哨兵值当作业务回复。",
    );
  }

  // No chat provider is reachable. If this turn nonetheless produced real
  // artifacts (e.g. a floorplan suite or text-to-BIM model — generated locally,
  // independent of any chat model), those files are the actual deliverable and
  // must be returned. Discarding them behind a 503 just because the supplementary
  // AI narration is unavailable is wrong (and is what broke the suite in CI, where
  // no local chat model is running).
  if (artifacts.length > 0) {
    const ready = artifacts.some((artifact) => artifact.status === "ready");
    return NextResponse.json({
      message: createPanAIMessage(
        "assistant",
        ready
          ? "已生成并注册真实产物（见 artifact，可在文件区查看并进入 BOM/算量链路）。在线大模型未接通，本次省略 AI 文字解读，不影响已生成的产物。"
          : "未能生成有效产物，且在线大模型未接通，已拒绝生成假结果。",
        {
          route: "PanAIRouter -> GenerationRouter（模型文字解读暂不可用）",
          artifacts,
        },
      ),
      routedBy: "generation_router",
      routeStatus: "routed",
      model: "GenerationRouter/artifacts-only",
      diagnostics,
    } satisfies PanAIWorkbenchChatResponse);
  }

  return NextResponse.json(
    {
      error: diagnostics.some((item) => item.includes("provider 返回错误"))
        ? "PanAI 已路由到真实 provider，但 provider 返回错误，已拒绝生成假回复。"
        : "PanAI Gateway 未真实接通，已拒绝生成假回复。",
      diagnostics,
    },
    { status: 503 },
  );
}

function parseStrictPanAIRequest(
  raw: unknown,
): PanAIWorkbenchChatRequest {
  if (!raw || typeof raw !== "object") {
    throw new Error("request body must be an object");
  }

  const value = raw as Partial<PanAIWorkbenchChatRequest>;
  if (typeof value.moduleId !== "string" || !value.moduleId.trim()) {
    throw new Error("moduleId is required");
  }

  const moduleId = normalizeModuleId(value.moduleId);
  if (!moduleId) {
    throw new Error("unknown moduleId: " + value.moduleId);
  }

  if (
    !Array.isArray(value.messages) ||
    !value.messages.some(
      (message) => message?.role === "user" && message.content.trim(),
    )
  ) {
    throw new Error("messages must include at least one user message");
  }

  if (!Array.isArray(value.capabilities) || value.capabilities.length === 0) {
    throw new Error(
      "capabilities are required; legacy message-only chat requests are not accepted",
    );
  }

  if (!Array.isArray(value.auditEvents)) {
    throw new Error("auditEvents must be provided, even when empty");
  }

  const moduleSpec = getModuleSpec(moduleId);
  const selectedFeatureTitle =
    typeof value.selectedFeatureTitle === "string" &&
    value.selectedFeatureTitle.trim()
      ? value.selectedFeatureTitle.trim()
      : null;
  const activeCapabilityId =
    typeof value.activeCapabilityId === "string" &&
    value.activeCapabilityId.trim()
      ? value.activeCapabilityId.trim()
      : null;

  return {
    moduleId,
    moduleName:
      typeof value.moduleName === "string" && value.moduleName.trim()
        ? value.moduleName.trim()
        : moduleSpec.zhName,
    ...(selectedFeatureTitle ? { selectedFeatureTitle } : {}),
    ...(activeCapabilityId ? { activeCapabilityId } : {}),
    messages: value.messages,
    capabilities: value.capabilities,
    auditEvents: value.auditEvents,
  };
}

function buildSystemPrompt(request: PanAIWorkbenchChatRequest): string {
  const capabilitySummary = request.capabilities
    .slice(0, 28)
    .map((capability) => `- ${capability.label}: ${capability.description}`)
    .join("\n");
  const auditSummary =
    request.auditEvents
      .slice(0, 6)
      .map((event) => `- ${event.summary}`)
      .join("\n") || "- 暂无当前页审计事件";

  return [
    "你是 ArchIToken 平台内的 PanAI 接管层，不是孤立聊天机器人。",
    "你必须通过 WorkflowRouter、ToolRouter、ModelRouter、InferenceRouter、GenerationRouter、CDE、AuditTrail 和 Approver 表达执行路径。",
    "你可以协调个人中心、市场客服、计划管理、方案设计、标准族库、深化设计、计量造价、材料物流、生产制造、施工管理、数字孪生、数字档案、财务管理、人力资源、AI中心和设置中心。",
    "没有专业来源、规范、审批或运行证据时，只能输出启发草案，不得声称合规、送审、施工、验收或发布完成。",
    `当前模块: ${request.moduleName} (${request.moduleId})`,
    request.selectedFeatureTitle
      ? `当前业务对象: ${request.selectedFeatureTitle}`
      : "当前业务对象: 未锁定",
    "可用平台能力:",
    capabilitySummary,
    "最近审计:",
    auditSummary,
    "回答要求: 使用简体中文，先给可执行路由，再给下一步动作；涉及图像时生成可交给 Hugging Face 图像端点的英文提示词。",
  ].join("\n");
}

async function invokePanAIGateway(
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model?: string } | null> {
  const baseUrl = process.env.PANAI_GATEWAY_URL;
  if (!baseUrl) {
    diagnostics.push(
      "PANAI_GATEWAY_URL 未配置，已切换到 HuggingFaceLocalAdapter；PanAI CLI fallback 默认禁用。",
    );
    return null;
  }

  const model = resolvePanAITextModel(modelTaskType);
  const routedSystemPrompt = withModelRoutingContext(
    systemPrompt,
    modelTaskType,
    model,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.PANAI_GATEWAY_TOKEN) {
    headers.Authorization = `Bearer ${process.env.PANAI_GATEWAY_TOKEN}`;
  }

  try {
    const response = await fetch(
      new URL("/v1/chat/completions", normalizedBaseUrl(baseUrl)),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.2,
          messages: [
            { role: "system", content: routedSystemPrompt },
            ...request.messages.slice(-10).map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      diagnostics.push(`PanAI Gateway 返回 HTTP ${response.status}。`);
      return null;
    }

    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = extractOpenAiCompatibleContent(payload);
    if (!content) {
      diagnostics.push("PanAI Gateway 响应没有可用文本。");
      return null;
    }
    if (looksLikeProviderError(content)) {
      diagnostics.push(
        `PanAI Gateway provider 返回错误: ${trimForDiagnostic(content)}`,
      );
      return null;
    }

    return {
      content,
      model: payload.model ?? model,
    };
  } catch (error) {
    diagnostics.push(`PanAI Gateway 调用失败: ${formatError(error)}。`);
    return null;
  }
}

async function invokeHuggingFaceLocalChatAdapter(
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  const endpoint = resolveHuggingFaceChatCompletionsUrl();
  const model = resolvePanAITextModel(modelTaskType);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    numberEnv("ARCHITOKEN_PANAI_CHAT_TIMEOUT_MS", 300_000),
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        max_tokens: numberEnv("ARCHITOKEN_PANAI_CHAT_MAX_TOKENS", 768),
        messages: buildHuggingFaceChatMessages(
          request,
          systemPrompt,
          modelTaskType,
          model,
        ),
        taskType: modelTaskType,
        moduleId: request.moduleId,
        timeoutSeconds: numberEnv(
          "ARCHITOKEN_PANAI_CHAT_TIMEOUT_SECONDS",
          900,
        ),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      diagnostics.push(
        `HuggingFaceLocalAdapter 返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`,
      );
      return null;
    }

    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = extractOpenAiCompatibleContent(payload);
    if (!content.trim()) {
      diagnostics.push("HuggingFaceLocalAdapter 没有返回有效文本。");
      return null;
    }
    if (looksLikeProviderError(content)) {
      diagnostics.push(
        `HuggingFaceLocalAdapter 返回无效哨兵/错误内容: ${trimForDiagnostic(content)}`,
      );
      return null;
    }

    return {
      content: normalizeLocalModelContent(content),
      model: `huggingface/${payload.model ?? model}`,
    };
  } catch (error) {
    diagnostics.push(
      `HuggingFaceLocalAdapter 调用失败: ${formatError(error)}。`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildHuggingFaceChatMessages(
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  model: string,
) {
  const messages = request.messages.slice(-10).map((message) => ({
    role: message.role,
    content: normalizeUserMessageForLocalModel(message.content),
  }));
  return [
    {
      role: "system",
      content: [
        withModelRoutingContext(systemPrompt, modelTaskType, model),
        "你必须直接输出给用户看的简体中文回复。",
        "不要只输出心跳、模型状态、工具状态或思考过程。",
      ].join("\n"),
    },
    ...messages,
  ];
}

function resolveHuggingFaceChatCompletionsUrl(): URL {
  const raw =
    process.env.ARCHITOKEN_HF_LOCAL_CHAT_URL ??
    process.env.HUGGINGFACE_LOCAL_CHAT_URL ??
    process.env.ARCHITOKEN_HF_CHAT_URL ??
    process.env.HUGGINGFACE_CHAT_URL ??
    process.env.ARCHITOKEN_GENERATION_PROVIDER_BASE_URL ??
    process.env.ARCHITOKEN_WORKER_BASE_URL ??
    "http://127.0.0.1:7071";
  const url = new URL(raw);
  const path = url.pathname.replace(/\/+$/, "");
  if (
    path.endsWith("/v1/chat/completions") ||
    path.endsWith("/chat/completions")
  ) {
    return url;
  }
  return new URL("/v1/chat/completions", normalizedBaseUrl(raw));
}

async function invokeLocalModelAdapter(
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  if (!ollamaFallbackEnabled()) {
    diagnostics.push(
      "Ollama fallback 未启用；默认只走 Hugging Face 本地/私有模型，避免误用旧的本地聊天模型。",
    );
    return null;
  }

  const baseUrl =
    process.env.ARCHITOKEN_LOCAL_MODEL_BASE_URL ??
    process.env.OLLAMA_BASE_URL ??
    "http://127.0.0.1:11434";
  const models = resolveLocalOllamaModelChain(modelTaskType);
  if (models.length === 0) {
    diagnostics.push(
      `LocalModelAdapter 没有 ${modelTaskType} 的本地可执行模型映射。`,
    );
    return null;
  }

  for (const model of models) {
    const result = await invokeOneOllamaModel(
      baseUrl,
      model,
      request,
      systemPrompt,
      modelTaskType,
      diagnostics,
    );
    if (result) return result;
  }

  return null;
}

async function invokeOneOllamaModel(
  baseUrl: string,
  model: string,
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(
      new URL("/api/chat", normalizedBaseUrl(baseUrl)),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: buildLocalModelMessages(
            request,
            systemPrompt,
            modelTaskType,
            model,
          ),
          options: {
            temperature: 0.2,
            num_predict: 768,
          },
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      diagnostics.push(
        `LocalModelAdapter/${model} 返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`,
      );
      return null;
    }

    const payload = (await response.json()) as OllamaChatResponse;
    if (payload.error) {
      diagnostics.push(
        `LocalModelAdapter/${model} provider 返回错误: ${trimForDiagnostic(payload.error)}`,
      );
      return null;
    }

    const content = stripThinkTags(
      payload.message?.content ?? payload.response ?? "",
    );
    if (!content.trim()) {
      diagnostics.push(`LocalModelAdapter/${model} 没有返回有效文本。`);
      return null;
    }
    if (looksLikeProviderError(content)) {
      diagnostics.push(
        `LocalModelAdapter/${model} 返回无效哨兵/错误内容: ${trimForDiagnostic(content)}`,
      );
      return null;
    }

    return {
      content: normalizeLocalModelContent(content),
      model: `ollama/${payload.model ?? model}`,
    };
  } catch (error) {
    diagnostics.push(
      `LocalModelAdapter/${model} 调用失败: ${formatError(error)}。`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildLocalModelMessages(
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  model: string,
) {
  const messages = request.messages.slice(-10).map((message) => ({
    role: message.role,
    content: normalizeUserMessageForLocalModel(message.content),
  }));
  return [
    {
      role: "system",
      content: [
        withModelRoutingContext(systemPrompt, modelTaskType, `ollama/${model}`),
        "你必须直接输出给用户看的简体中文回复。",
        "不要只输出心跳、模型状态、工具状态或思考过程。",
      ].join("\n"),
    },
    ...messages,
  ];
}

function normalizeUserMessageForLocalModel(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "请用简体中文说明你可以帮助我做什么。";
  if (/^[?？!！.。…\s]+$/.test(trimmed))
    return "请用简体中文简要说明你是谁，以及你现在能接管哪些 ArchIToken 平台能力。";
  return trimmed;
}

function stripThinkTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function invokePanAICliGateway(
  request: PanAIWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  const cli = process.env.PANAI_CLI_PATH ?? "/usr/bin/panai";
  const model = resolvePanAITextModel(modelTaskType);
  const prompt = buildPanAIPrompt(
    withModelRoutingContext(systemPrompt, modelTaskType, model),
    request,
  );

  try {
    const result = await runPanAICli(cli, [
      "infer",
      "model",
      "run",
      "--gateway",
      "--model",
      model,
      "--prompt",
      prompt,
      "--json",
    ]);

    if (result.code !== 0) {
      diagnostics.push(
        `PanAI CLI Gateway 退出码 ${result.code}: ${trimForDiagnostic(result.stderr || result.stdout)}`,
      );
      return null;
    }

    const payload = extractJsonPayload(
      result.stdout,
    ) as PanAICliResponse | null;
    const text = payload?.outputs?.map((output) => output.text).find(Boolean);
    if (!payload?.ok || !text) {
      diagnostics.push(
        `PanAI CLI Gateway 没有返回有效文本: ${trimForDiagnostic(result.stdout)}`,
      );
      return null;
    }
    if (looksLikeProviderError(text)) {
      diagnostics.push(
        `PanAI CLI Gateway provider 返回错误: ${trimForDiagnostic(text)}`,
      );
      return null;
    }

    return {
      content: text,
      model: `${payload.provider ?? "panai"}/${payload.model ?? model}`,
    };
  } catch (error) {
    diagnostics.push(`PanAI CLI Gateway 调用失败: ${formatError(error)}。`);
    return null;
  }
}

function buildPanAIPrompt(
  systemPrompt: string,
  request: PanAIWorkbenchChatRequest,
): string {
  const conversation = request.messages
    .slice(-10)
    .map(
      (message) =>
        `${message.role === "user" ? "用户" : "PanAI"}: ${message.content}`,
    )
    .join("\n\n");

  return [
    systemPrompt,
    "下面是当前工作台真实会话。你必须作为 PanAI Gateway 的模型执行结果回复，不要声称本地草案或模拟执行。",
    conversation,
  ].join("\n\n");
}

function withModelRoutingContext(
  systemPrompt: string,
  modelTaskType: PanAIModelTaskType,
  model: string,
): string {
  return [
    systemPrompt,
    `ModelRouter taskType: ${modelTaskType}`,
    `ModelRouter selectedModel: ${model}`,
    "ModelRouter providerPreference: huggingface 本地/私有模型优先；Ollama 仅作为显式备用适配器。",
  ].join("\n");
}

function runPanAICli(
  cli: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("PanAI CLI Gateway 调用超时"));
    }, 120_000);
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function buildArtifacts(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  taskType: PanAITaskType,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  const artifacts: PanAIChatArtifact[] = [];
  if (taskType === "chat") {
    return artifacts;
  }

  if (taskType === "cad_model") {
    return runCadWorkerJob(request, latestInput, diagnostics);
  }

  if (taskType === "cad_drawing") {
    return runCadDrawingJob(request, latestInput, diagnostics);
  }

  if (taskType === "floorplan_suite") {
    return runFloorplanSuiteJob(request, latestInput, diagnostics);
  }

  if (taskType === "floorplan_render") {
    return runFloorplanRenderJob(request, latestInput, diagnostics);
  }

  if (taskType === "text_to_bim") {
    return runTextToBimJob(request, latestInput, diagnostics);
  }

  if (taskType === "bim_collab") {
    return runBimCollabJob(request, latestInput, diagnostics);
  }

  const prompt =
    taskType === "image_to_video"
      ? buildVideoPrompt(request, latestInput)
      : buildImagePrompt(request, latestInput);
  artifacts.push({
    id: taskType === "image_to_video" ? "hf-video-prompt" : "hf-image-prompt",
    kind: taskType === "image_to_video" ? "video_prompt" : "image_prompt",
    title:
      taskType === "image_to_video"
        ? "Hugging Face 视频提示词"
        : "Hugging Face 配图提示词",
    content: prompt,
    status: "pending_router",
  });

  const job = await runGenerationJob(
    request,
    latestInput,
    prompt,
    taskType,
    diagnostics,
  );
  if (job) {
    artifacts.push(job);
  }

  return artifacts;
}

async function runGenerationJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  prompt: string,
  taskType: "text_to_image" | "image_to_video",
  diagnostics: string[],
): Promise<PanAIChatArtifact | null> {
  const baseUrl =
    process.env.ARCHITOKEN_GATEWAY_BASE_URL ??
    process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL ??
    "http://127.0.0.1:8080";
  const base = normalizedBaseUrl(baseUrl);
  const headers = generationHeaders(request);
  const imageUrl = extractImageUrl(latestInput);
  const parameters = defaultMediaGenerationParameters(taskType);

  try {
    const response = await fetch(new URL("/v1/generation/jobs", base), {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: taskType,
        moduleId: request.moduleId,
        prompt,
        actor: "panai",
        constraints: {
          router: "GenerationRouter",
          providerHint: "hugging_face",
          ...(Object.keys(parameters).length ? { parameters } : {}),
          ...(taskType === "image_to_video" && imageUrl ? { imageUrl } : {}),
          provenance: {
            source: "panai_workbench_chat",
            selectedFeatureTitle: request.selectedFeatureTitle ?? null,
          },
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      diagnostics.push(
        `GenerationRouter 配图任务创建返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`,
      );
      return null;
    }

    const payload = (await response.json()) as GenerationJobEnvelope;
    const jobId = payload.id ?? payload.jobId ?? payload.job_id;
    if (!jobId) {
      diagnostics.push(
        "GenerationRouter 配图任务创建成功，但响应缺少 job id。",
      );
      return null;
    }

    const planned = await generationAction(
      base,
      jobId,
      "plan",
      headers,
      diagnostics,
    );
    if (!planned) {
      return blockedGenerationArtifact(
        jobId,
        "GenerationRouter 图像任务 plan 失败",
      );
    }

    const completed = await generationAction(
      base,
      jobId,
      "run",
      headers,
      diagnostics,
    );
    if (!completed) {
      return blockedGenerationArtifact(
        jobId,
        "GenerationRouter 图像任务 run 失败",
      );
    }

    const artifactsResponse = await fetch(
      new URL(`/v1/generation/jobs/${jobId}/artifacts`, base),
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );
    if (!artifactsResponse.ok) {
      diagnostics.push(
        `GenerationRouter artifact 查询返回 HTTP ${artifactsResponse.status}: ${await responseDiagnostic(artifactsResponse)}。`,
      );
      return blockedGenerationArtifact(
        jobId,
        "GenerationRouter 图像任务已运行，但未取回 artifact",
      );
    }

    const artifactPayload =
      (await artifactsResponse.json()) as GenerationArtifactEnvelope;
    const mediaArtifact = artifactPayload.artifacts?.find((artifact) => {
      const mimeType = artifact.artifactMetadata?.mimeType ?? "";
      return taskType === "text_to_image"
        ? artifact.kind === "image" || mimeType.startsWith("image/")
        : artifact.kind === "video" || mimeType.startsWith("video/");
    });
    if (!mediaArtifact?.id) {
      diagnostics.push(
        `GenerationRouter ${taskType} 任务完成，但没有返回匹配的 media artifact。`,
      );
      return blockedGenerationArtifact(
        jobId,
        `GenerationRouter ${taskType} 任务没有 media artifact`,
      );
    }

    const href = new URL(
      `/v1/artifacts/${mediaArtifact.id}/content`,
      base,
    ).toString();
    const mimeType = mediaArtifact.artifactMetadata?.mimeType ?? "";
    const mediaKind = mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("image/")
        ? "image"
        : taskType === "image_to_video"
          ? "video"
          : "image";
    return {
      id: `generation-job-${jobId}`,
      kind: "generation_job",
      title:
        taskType === "text_to_image"
          ? "GenerationRouter 图像任务"
          : "GenerationRouter 视频任务",
      content: `已生成 ${taskType} artifact: ${mediaArtifact.reference?.name ?? mediaArtifact.id}`,
      status: "ready",
      href,
      mediaKind,
      mimeType,
    };
  } catch (error) {
    diagnostics.push(
      `GenerationRouter 配图任务执行失败: ${formatError(error)}。`,
    );
    return null;
  }
}

async function runCadDrawingJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  let spec = parseCadDrawingSpec(latestInput);
  if (spec) {
    diagnostics.push(
      `CadDrawingAssistant 启发解析成功，实体数 ${spec.entities.length}。`,
    );
  } else {
    spec = await generateCadDrawingSpecWithLlm(latestInput, diagnostics);
  }
  if (!spec) {
    return [
      {
        id: "cad-drawing-blocked",
        kind: "cad_drawing",
        title: "CAD绘图助手",
        content:
          "无法把当前指令解析为可靠的绘图实体，已拒绝生成假图纸。支持示例：画一个10米x6米的房间平面；画一个半径500mm的圆；画一个4x3跨轴网，跨距8米；画一条长度3米的直线。",
        status: "blocked",
      },
    ];
  }

  try {
    const dxf = renderCadDrawingDxf(spec);
    const fileName = `panai_${spec.name}_${Date.now()}.dxf`;
    const metadata = await saveLocalUpload({
      file: new File([dxf], fileName, { type: "image/vnd.dxf" }),
      moduleId: request.moduleId,
      owner: "panai",
      tags: ["panai", "cad-drawing", "dxf", spec.metadata.parser],
    });
    return [
      {
        id: `cad-drawing-spec-${metadata.fileId}`,
        kind: "cad_drawing",
        title: "CAD绘图助手解析结果",
        content: JSON.stringify(
          {
            name: spec.name,
            parser: spec.metadata.parser,
            units: spec.units,
            entityCount: spec.entities.length,
            entityTypes: countByType(spec),
            notes: spec.metadata.notes,
          },
          null,
          2,
        ),
        status: "ready",
      },
      {
        id: `cad-drawing-file-${metadata.fileId}`,
        kind: "cad_drawing",
        title: metadata.originalName,
        content: `真实 DXF 图纸文件已生成并注册：fileId=${metadata.fileId}，大小 ${metadata.size} 字节，模块 ${request.moduleName}。`,
        status: "ready",
        href: `/api/local-files/${metadata.fileId}`,
        mediaKind: "file",
        mimeType: "image/vnd.dxf",
      },
    ];
  } catch (error) {
    diagnostics.push(`CadDrawingAssistant 生成 DXF 失败: ${formatError(error)}。`);
    return [
      {
        id: "cad-drawing-failed",
        kind: "cad_drawing",
        title: "CAD绘图助手",
        content: "DXF 生成或文件注册失败，没有产出图纸。",
        status: "blocked",
      },
    ];
  }
}

async function generateCadDrawingSpecWithLlm(
  latestInput: string,
  diagnostics: string[],
): Promise<CadDrawingSpec | null> {
  const url = resolveHuggingFaceChatCompletionsUrl();
  const model = resolvePanAITextModel("cad_drawing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              '你是CAD绘图实体生成器。把用户绘图需求转成严格JSON：{"name":"...","entities":[...]}。entities 元素类型: {"type":"line","start":[x,y],"end":[x,y]} | {"type":"circle","center":[x,y],"radius":r} | {"type":"arc","center":[x,y],"radius":r,"startAngle":a,"endAngle":b} | {"type":"polyline","points":[[x,y],...],"closed":true} | {"type":"text","position":[x,y],"height":h,"value":"..."}。单位毫米，只输出JSON，不要解释。',
          },
          { role: "user", content: latestInput },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      diagnostics.push(
        `CadDrawingAssistant LLM 实体生成返回 HTTP ${response.status}。`,
      );
      return null;
    }
    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = extractOpenAiCompatibleContent(payload);
    const parsed = extractJsonPayload(content) as {
      name?: unknown;
      entities?: unknown;
    } | null;
    const entities = validateCadDrawingEntities(parsed?.entities);
    if (!entities) {
      diagnostics.push(
        "CadDrawingAssistant LLM 输出未通过实体校验，已丢弃。",
      );
      return null;
    }
    diagnostics.push(
      `CadDrawingAssistant 使用 ${payload.model ?? model} 生成 ${entities.length} 个实体并通过校验。`,
    );
    return {
      name:
        typeof parsed?.name === "string" && parsed.name.trim()
          ? parsed.name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 48)
          : "llm_drawing",
      units: "mm",
      entities,
      metadata: {
        sourcePrompt: latestInput,
        parser: "llm",
        notes: [`实体由本地大模型 ${payload.model ?? model} 生成并经数值校验。`],
      },
    };
  } catch (error) {
    diagnostics.push(
      `CadDrawingAssistant LLM 实体生成失败: ${formatError(error)}。`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const candidateSelectionPatterns: Array<[RegExp, string]> = [
  [/候选\s*A|方案\s*A|平衡方案/i, "generate-a"],
  [/候选\s*B|方案\s*B|镜像/i, "generate-b"],
  [/候选\s*C|方案\s*C|模板适配|Fit/i, "fit-c"],
  [/候选\s*D|方案\s*D|家具友好|Furnish/i, "furnish-d"],
];

function pickBestFloorplanCandidate(input: string): {
  candidate: PlanCandidate;
  candidates: PlanCandidate[];
  intentSummary: string;
} {
  const intent = parsePromptToIntent(input, initialIntent);
  const candidates = createPlanCandidates(intent);
  // 候选联动：指令点名候选时按名选择，否则取评分最高的候选。
  const requestedId = candidateSelectionPatterns.find(([pattern]) =>
    pattern.test(input),
  )?.[1];
  const candidate =
    candidates.find((item) => item.id === requestedId) ??
    candidates.reduce((best, item) => (item.score > best.score ? item : best));
  const bedCount = intent.rooms.主卧.count + intent.rooms.次卧.count;
  const bathCount = intent.rooms.主卫.count + intent.rooms.卫生间.count;
  return {
    candidate,
    candidates,
    intentSummary: `${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫 ${intent.floors}层`,
  };
}

async function runFloorplanSuiteJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  try {
    const { candidate, candidates, intentSummary } =
      pickBestFloorplanCandidate(latestInput);
    const compliance = checkFloorplanCompliance(candidate.plan);
    const furniture = buildFurniture(candidate.plan);
    const drawingSpec = floorplanToDrawingSpec(candidate.plan);
    const dxf = renderCadDrawingDxf(drawingSpec);
    const svg = renderFloorplanColorSvg(candidate.plan, furniture);
    const stamp = Date.now();
    const dxfMetadata = await saveLocalUpload({
      file: new File([dxf], `panai_${drawingSpec.name}_${stamp}.dxf`, {
        type: "image/vnd.dxf",
      }),
      moduleId: request.moduleId,
      owner: "panai",
      tags: ["panai", "floorplan", "dxf"],
    });
    const svgMetadata = await saveLocalUpload({
      file: new File([svg], `panai_${drawingSpec.name}_${stamp}_彩平图.svg`, {
        type: "image/svg+xml",
      }),
      moduleId: request.moduleId,
      owner: "panai",
      tags: ["panai", "floorplan", "color-plan", "svg"],
    });
    diagnostics.push(
      `FloorplanSuite 选中候选 ${candidate.id}（${candidate.score} 分），DXF 实体 ${drawingSpec.entities.length} 个。`,
    );
    const artifacts: PanAIChatArtifact[] = [
      {
        id: `floorplan-suite-${dxfMetadata.fileId}`,
        kind: "floorplan_suite",
        title: "户型图纸套件解析结果",
        content: JSON.stringify(
          {
            intent: intentSummary,
            prompt: latestInput,
            candidate: candidate.title,
            candidateId: candidate.id,
            score: candidate.score,
            candidates: candidates.map((item) => ({
              id: item.id,
              title: item.title,
              score: item.score,
            })),
            blockCount: candidate.plan.summary.blockCount,
            warnings: candidate.plan.warnings.length,
            compliance: {
              passed: compliance.passed,
              ...compliance.issueCounts,
            },
            reviewState: "professional_review_required",
          },
          null,
          2,
        ),
        status: "ready",
      },
      {
        id: `floorplan-compliance-${candidate.id}`,
        kind: "floorplan_suite",
        title: `规范预检报告（${compliance.passed ? "通过" : "存在问题"}：${compliance.issueCounts.error} 错误 / ${compliance.issueCounts.warning} 警告）`,
        content: JSON.stringify(compliance, null, 2),
        status: compliance.passed ? "ready" : "draft",
      },
      {
        id: `floorplan-dxf-${dxfMetadata.fileId}`,
        kind: "cad_drawing",
        title: dxfMetadata.originalName,
        content: `真实 DXF 户型图纸已生成并注册：fileId=${dxfMetadata.fileId}，含轴网/双线墙/门窗洞口/尺寸标注/图框图签，需专业复核。`,
        status: "ready",
        href: `/api/local-files/${dxfMetadata.fileId}`,
        mediaKind: "file",
        mimeType: "image/vnd.dxf",
      },
      {
        id: `floorplan-svg-${svgMetadata.fileId}`,
        kind: "floorplan_suite",
        title: svgMetadata.originalName,
        content: `彩平图 SVG 已生成并注册：fileId=${svgMetadata.fileId}，与 DXF 图纸共享同一布局真源。`,
        status: "ready",
        href: `/api/local-files/${svgMetadata.fileId}`,
        mediaKind: "image",
        mimeType: "image/svg+xml",
      },
    ];

    if (fullSuitePattern.test(latestInput)) {
      diagnostics.push("FloorplanSuite 全套模式：追加 IFC 模型与效果图生成。");
      const [ifcArtifacts, renderArtifacts] = await Promise.all([
        generateIfcArtifacts(
          request,
          floorplanToBimSpec(candidate.plan),
          `floorplan_kernel:${candidate.id}`,
          diagnostics,
        ),
        generateRenderArtifacts(request, candidate, latestInput, diagnostics),
      ]);
      artifacts.push(...ifcArtifacts, ...renderArtifacts);
    }
    return artifacts;
  } catch (error) {
    diagnostics.push(`FloorplanSuite 生成失败: ${formatError(error)}。`);
    return [
      {
        id: "floorplan-suite-failed",
        kind: "floorplan_suite",
        title: "户型图纸套件",
        content: "户型布局生成或文件注册失败，没有产出图纸。",
        status: "blocked",
      },
    ];
  }
}

const fullSuitePattern = /全套|四件套|全部产物|一条龙|套餐/;

async function runFloorplanRenderJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  const { candidate, intentSummary } = pickBestFloorplanCandidate(latestInput);
  diagnostics.push(`FloorplanRender 意图 ${intentSummary}。`);
  return generateRenderArtifacts(request, candidate, latestInput, diagnostics);
}

async function generateRenderArtifacts(
  request: PanAIWorkbenchChatRequest,
  candidate: PlanCandidate,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  const floors: Array<1 | 2> = candidate.plan.floors === 2 ? [1, 2] : [1];
  const artifacts: PanAIChatArtifact[] = [];
  // 每层独立线稿 + 渲染；GPU 串行执行，逐层 await 避免 ComfyUI 排队叠压。
  for (const floor of floors) {
    artifacts.push(
      ...(await generateFloorRenderArtifacts(
        request,
        candidate,
        latestInput,
        floor,
        floors.length > 1,
        diagnostics,
      )),
    );
  }
  return artifacts;
}

async function generateFloorRenderArtifacts(
  request: PanAIWorkbenchChatRequest,
  candidate: PlanCandidate,
  latestInput: string,
  floor: 1 | 2,
  multiFloor: boolean,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  const floorLabel = multiFloor ? `${floor}层` : "";
  try {
    const lineart = rasterizeFloorplanLineartPng(candidate.plan, { floor });
    const prompt = `${buildFloorplanRenderPrompt(candidate.plan, latestInput)}${multiFloor ? `\n当前渲染第 ${floor} 层平面。` : ""}`;
    diagnostics.push(
      `FloorplanRender 布局真源 ${candidate.id} 第${floor}层，线稿 ${lineart.length} 字节。`,
    );

    const stamp = Date.now();
    const safeName = candidate.plan.projectId
      .replace(/[^\p{L}\p{N}_-]+/gu, "_")
      .slice(0, 48);
    const lineartMetadata = await saveLocalUpload({
      file: new File(
        [new Uint8Array(lineart)],
        `panai_${safeName}_${stamp}_${floorLabel}线稿.png`,
        { type: "image/png" },
      ),
      moduleId: request.moduleId,
      owner: "panai",
      tags: ["panai", "floorplan", "controlnet-lineart"],
    });

    const base = resolveGenerationProviderBaseUrl();
    const response = await fetch(new URL("/v1/generate/image-to-image", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        constraints: { imageBase64: lineart.toString("base64") },
        parameters: {
          denoise: 0.55,
          ...renderDimensionsForPlan(candidate.plan),
        },
        actor: "panai",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      diagnostics.push(
        `FloorplanRender 第${floor}层图生图返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`,
      );
      return [
        lineartArtifact(lineartMetadata.fileId, lineartMetadata.originalName),
        {
          id: `floorplan-render-blocked-f${floor}`,
          kind: "generation_job",
          title: `户型效果图${floorLabel}`,
          content:
            response.status === 503
              ? "图生图运行时未配置（需要 ComfyUI image_to_image workflow，环境变量 ARCHITOKEN_COMFYUI_WORKFLOW_IMAGE_TO_IMAGE 指向 ControlNet 工作流 JSON）。线稿控制图已生成，可配置后重试。"
              : "图生图执行失败，没有产出效果图；线稿控制图已生成。",
          status: "blocked",
        },
      ];
    }
    const payload = (await response.json()) as {
      artifacts?: Array<{ base64?: string; mimeType?: string }>;
    };
    const media = payload.artifacts?.find((artifact) => artifact.base64);
    if (!media?.base64) {
      diagnostics.push(
        `FloorplanRender 第${floor}层图生图完成但响应缺少图像内容。`,
      );
      return [
        lineartArtifact(lineartMetadata.fileId, lineartMetadata.originalName),
        {
          id: `floorplan-render-empty-f${floor}`,
          kind: "generation_job",
          title: `户型效果图${floorLabel}`,
          content: "图生图完成但未返回图像内容，没有产出效果图。",
          status: "blocked",
        },
      ];
    }
    const imageBytes = Buffer.from(media.base64, "base64");
    const suffix = media.mimeType === "image/jpeg" ? "jpg" : "png";
    const renderMetadata = await saveLocalUpload({
      file: new File(
        [new Uint8Array(imageBytes)],
        `panai_${safeName}_${stamp}_${floorLabel}效果图.${suffix}`,
        { type: media.mimeType ?? "image/png" },
      ),
      moduleId: request.moduleId,
      owner: "panai",
      tags: ["panai", "floorplan", "render", "controlnet"],
    });
    return [
      {
        id: `floorplan-render-${renderMetadata.fileId}`,
        kind: "generation_job",
        title: renderMetadata.originalName,
        content: `布局受控效果图（${floorLabel || "单层"}）已生成并注册：fileId=${renderMetadata.fileId}，墙体布局来自同一户型真源（${candidate.title}）。AI 生成图像，仅作方案意向。`,
        status: "ready",
        href: `/api/local-files/${renderMetadata.fileId}`,
        mediaKind: "image",
        mimeType: media.mimeType ?? "image/png",
      },
      lineartArtifact(lineartMetadata.fileId, lineartMetadata.originalName),
    ];
  } catch (error) {
    diagnostics.push(
      `FloorplanRender 第${floor}层执行失败: ${formatError(error)}。`,
    );
    return [
      {
        id: `floorplan-render-failed-f${floor}`,
        kind: "generation_job",
        title: `户型效果图${floorLabel}`,
        content: "户型效果图生成失败，没有产出图像。",
        status: "blocked",
      },
    ];
  }
}

function renderDimensionsForPlan(plan: {
  summary: { envelope: [number, number] };
}): { width: number; height: number } {
  // 按户型外包络比例出图，避免布局被拉伸；对齐 64 像素步进，约 1MP。
  const [envW, envH] = plan.summary.envelope;
  const ratio = envH / envW;
  const width = ratio <= 1 ? 1024 : Math.round(1024 / ratio / 64) * 64;
  const height = ratio <= 1 ? Math.round((1024 * ratio) / 64) * 64 : 1024;
  return {
    width: Math.max(512, Math.min(1536, width)),
    height: Math.max(512, Math.min(1536, height)),
  };
}

function lineartArtifact(fileId: string, name: string): PanAIChatArtifact {
  return {
    id: `floorplan-lineart-${fileId}`,
    kind: "floorplan_suite",
    title: name,
    content: `ControlNet 线稿控制图已注册：fileId=${fileId}，黑墙白底，记录效果图所依据的布局真源。`,
    status: "ready",
    href: `/api/local-files/${fileId}`,
    mediaKind: "image",
    mimeType: "image/png",
  };
}

async function runTextToBimJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  let spec: TextToBimSpec | null = null;
  let specSource = "llm";
  if (isPanAIFloorplanSuiteIntent(latestInput)) {
    const { candidate, intentSummary } = pickBestFloorplanCandidate(latestInput);
    spec = floorplanToBimSpec(candidate.plan);
    specSource = `floorplan_kernel:${candidate.id}`;
    diagnostics.push(
      `TextToBim 走户型布局真源（${intentSummary}），墙体/楼板共 ${spec.elements.length} 个构件。`,
    );
  } else {
    spec = await generateTextToBimSpecWithLlm(latestInput, diagnostics);
  }
  if (!spec) {
    return [
      {
        id: "text-to-bim-blocked",
        kind: "bim_model",
        title: "文字生成模型",
        content:
          "无法把当前指令解析为可靠的 bimSpec 构件清单，已拒绝生成假模型。支持示例：生成120平三室两厅的户型模型；生成一面长9米高2.8米厚0.12米的墙的IFC模型。",
        status: "blocked",
      },
    ];
  }
  return generateIfcArtifacts(request, spec, specSource, diagnostics);
}

async function generateIfcArtifacts(
  request: PanAIWorkbenchChatRequest,
  spec: TextToBimSpec,
  specSource: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  try {
    const base = resolveGenerationProviderBaseUrl();
    const response = await fetch(new URL("/v1/generate/text-to-bim", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bimSpec: spec,
        actor: "panai",
        projectId: request.moduleId,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      diagnostics.push(
        `TextToBim 引擎返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`,
      );
      return [
        {
          id: "text-to-bim-engine-failed",
          kind: "bim_model",
          title: "文字生成模型",
          content:
            response.status === 503
              ? "IfcOpenShell Text-to-BIM 引擎不可用（worker 镜像缺少 ifcopenshell），没有产出模型。"
              : "Text-to-BIM 引擎执行失败，没有产出模型。",
          status: "blocked",
        },
      ];
    }
    const payload = (await response.json()) as {
      contentBase64?: string;
      output?: Record<string, unknown>;
    };
    if (!payload.contentBase64) {
      diagnostics.push("TextToBim 引擎响应缺少 contentBase64。");
      return [
        {
          id: "text-to-bim-empty",
          kind: "bim_model",
          title: "文字生成模型",
          content: "Text-to-BIM 引擎完成但未返回 IFC 内容，没有产出模型。",
          status: "blocked",
        },
      ];
    }
    const bytes = Buffer.from(payload.contentBase64, "base64");
    const safeName = spec.name.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 48);
    const metadata = await saveLocalUpload({
      file: new File([bytes], `panai_${safeName}_${Date.now()}.ifc`, {
        type: "model/ifc",
      }),
      moduleId: request.moduleId,
      owner: "panai",
      tags: ["panai", "text-to-bim", "ifc", specSource],
    });
    return [
      {
        id: `text-to-bim-spec-${metadata.fileId}`,
        kind: "bim_model",
        title: "文字生成模型解析结果",
        content: JSON.stringify(
          {
            name: spec.name,
            specSource,
            elementCount: spec.elements.length,
            geometricElementCount: payload.output?.geometricElementCount ?? 0,
            engine: "ifcopenshell",
            reviewState: "professional_review_required",
          },
          null,
          2,
        ),
        status: "ready",
      },
      {
        id: `text-to-bim-file-${metadata.fileId}`,
        kind: "bim_model",
        title: metadata.originalName,
        content: `真实 IFC 模型已生成并注册：fileId=${metadata.fileId}，大小 ${metadata.size} 字节，可在查看器原生打开并进入 BOM/算量链路。`,
        status: "ready",
        href: `/api/local-files/${metadata.fileId}`,
        mediaKind: "file",
        mimeType: "model/ifc",
      },
    ];
  } catch (error) {
    diagnostics.push(`TextToBim 执行失败: ${formatError(error)}。`);
    return [
      {
        id: "text-to-bim-failed",
        kind: "bim_model",
        title: "文字生成模型",
        content: "Text-to-BIM 引擎调用或文件注册失败，没有产出模型。",
        status: "blocked",
      },
    ];
  }
}

async function generateTextToBimSpecWithLlm(
  latestInput: string,
  diagnostics: string[],
): Promise<TextToBimSpec | null> {
  const url = resolveHuggingFaceChatCompletionsUrl();
  const model = resolvePanAITextModel("text_to_bim");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              '你是建筑BIM构件生成器。把用户的建模需求转成严格JSON：{"name":"...","elements":[{"type":"Wall|Slab|Column|Beam|Space|GenericElement","name":"...","position":[x,y,z],"size":[dx,dy,dz]}]}。坐标系：z 轴竖直向上，position 是盒体最小角点，size=[x向尺寸,y向尺寸,z向尺寸] 均为正数，单位米。墙的高度放在 dz：长9米高2.8米厚0.12米的墙 → {"type":"Wall","position":[0,0,0],"size":[9,0.12,2.8]}；楼板厚度放在 dz：9米x6米厚0.12米楼板 → {"type":"Slab","position":[0,0,0],"size":[9,6,0.12]}。只输出JSON，不要解释。',
          },
          { role: "user", content: latestInput },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      diagnostics.push(`TextToBim LLM 规格生成返回 HTTP ${response.status}。`);
      return null;
    }
    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = extractOpenAiCompatibleContent(payload);
    const spec = validateTextToBimSpec(extractJsonPayload(content));
    if (!spec) {
      diagnostics.push("TextToBim LLM 输出未通过 bimSpec 校验，已丢弃。");
      return null;
    }
    diagnostics.push(
      `TextToBim 使用 ${payload.model ?? model} 生成 ${spec.elements.length} 个构件并通过校验。`,
    );
    return spec;
  } catch (error) {
    diagnostics.push(`TextToBim LLM 规格生成失败: ${formatError(error)}。`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveGenerationProviderBaseUrl(): string {
  return (
    process.env.ARCHITOKEN_GENERATION_PROVIDER_BASE_URL ??
    process.env.ARCHITOKEN_WORKER_BASE_URL ??
    "http://127.0.0.1:7071"
  );
}

function countByType(spec: CadDrawingSpec): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entity of spec.entities) {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  }
  return counts;
}

async function runBimCollabJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  const action = resolveBimCollabAction(latestInput);

  try {
    if (action === "list_issues") {
      const issues = await listBimCollabIssues();
      return [
        {
          id: "bim-collab-issues",
          kind: "bim_issue",
          title: `BIM 协同议题（${issues.length} 条）`,
          content: issues.length
            ? JSON.stringify(issues.slice(0, 20), null, 2)
            : "议题库为空。可以用「创建议题：标题」登记第一条协同议题。",
          status: "ready",
        },
      ];
    }

    const models = await findBimModelFiles();

    if (action === "create_issue") {
      const target = pickBimModelFile(models, latestInput);
      const issue = await createBimCollabIssue({
        title: extractIssueTitle(latestInput),
        description: latestInput,
        moduleId: request.moduleId,
        fileId: target?.fileId ?? null,
        fileName: target?.originalName ?? null,
      });
      diagnostics.push(
        `BimCollabAssistant 议题已写入 ${getBimCollabIssueStorePath()}。`,
      );
      return [
        {
          id: `bim-issue-${issue.id}`,
          kind: "bim_issue",
          title: `协同议题已创建: ${issue.title}`,
          content: JSON.stringify(issue, null, 2),
          status: "ready",
        },
        {
          id: `bim-issue-audit-${issue.id}`,
          kind: "audit_note",
          title: "议题审计记录",
          content: `actor=panai action=create_bim_issue issueId=${issue.id} module=${request.moduleId} file=${issue.fileName ?? "未关联"} at=${issue.createdAt}`,
          status: "ready",
        },
      ];
    }

    if (models.length === 0) {
      return [
        {
          id: "bim-collab-no-model",
          kind: "bim_collab",
          title: "BIM协同助手",
          content:
            "本地文件运行时中没有已上传的 .ifc 模型，无法做真实构件统计。请先上传 IFC 文件。",
          status: "blocked",
        },
      ];
    }

    const target = pickBimModelFile(models, latestInput)!;
    const summary = await analyzeBimModel(target);
    diagnostics.push(
      `BimCollabAssistant 解析 ${summary.fileName}: ${summary.totalEntities} 个 IFC 实体。`,
    );
    return [
      {
        id: `bim-collab-summary-${summary.fileId}`,
        kind: "bim_collab",
        title: `IFC 模型解析: ${summary.fileName}`,
        content: JSON.stringify(summary, null, 2),
        status: "ready",
        href: `/api/local-files/${summary.fileId}`,
        mediaKind: "file",
        mimeType: "application/x-step",
      },
    ];
  } catch (error) {
    diagnostics.push(`BimCollabAssistant 执行失败: ${formatError(error)}。`);
    return [
      {
        id: "bim-collab-failed",
        kind: "bim_collab",
        title: "BIM协同助手",
        content: `操作失败，没有产出协同数据: ${formatError(error)}`,
        status: "blocked",
      },
    ];
  }
}

async function runCadWorkerJob(
  request: PanAIWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<PanAIChatArtifact[]> {
  const spec = buildPipeCadSpec(latestInput);
  if (!spec) {
    return [
      blockedCadWorkerArtifact(
        "cad-spec",
        "ToolRouter 已识别为 CAD 任务，但当前只能从提示词解析 pipe/tube 参数。请提供长度、外径/直径和可选壁厚。",
      ),
    ];
  }

  const jobId = `panai-cad-${randomUUID()}`;
  const workDir = await mkdtemp(join(tmpdir(), `${jobId}-`));
  const outputDir = join(workDir, "out");
  const jobPath = join(workDir, "job.json");
  const repoRoot = resolveRepoRoot();
  const stem = `steel_pipe_${Math.round(spec.dimensions.length)}x${formatNumberForName(spec.dimensions.outerDiameter)}`;
  const workerJob = {
    job_id: jobId,
    tenant_id:
      process.env.ARCHITOKEN_TENANT_ID ??
      "11111111-1111-4111-8111-111111111111",
    project_id:
      process.env.ARCHITOKEN_PROJECT_ID ??
      "22222222-2222-4222-8222-222222222222",
    actor: "panai",
    operation: "cad_convert",
    source_asset_id: "panai-generated-cad",
    source_file_id: "panai-generated-cad-spec",
    input: {
      adapter: "cadquery",
      name: stem,
      outputDir,
      outputFormats: ["step", "stl"],
      moduleId: request.moduleId,
      moduleName: request.moduleName,
      selectedFeatureTitle: request.selectedFeatureTitle ?? null,
      cadquerySpec: spec,
    },
  };

  await writeFile(jobPath, JSON.stringify(workerJob, null, 2), "utf-8");
  const python =
    process.env.ARCHITOKEN_WORKER_PYTHON ?? process.env.PYTHON ?? "python3";
  const pythonPath = [join(repoRoot, "06-workers"), process.env.PYTHONPATH]
    .filter(Boolean)
    .join(":");

  try {
    const result = await runCommand(
      python,
      [
        "-m",
        "architoken_workers.worker_cli",
        "--adapter",
        "cadquery",
        "--job",
        jobPath,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PYTHONPATH: pythonPath,
        },
        timeoutMs: 180_000,
      },
    );

    if (result.code !== 0) {
      diagnostics.push(
        `CAD worker 退出码 ${result.code}: ${trimForDiagnostic(result.stderr || result.stdout)}`,
      );
      return [
        blockedCadWorkerArtifact(
          jobId,
          "CAD worker 执行失败，没有生成 CAD artifact。",
        ),
      ];
    }

    const payload = extractJsonPayload(
      result.stdout,
    ) as WorkerResultEnvelope | null;
    if (!payload) {
      diagnostics.push(
        `CAD worker 没有返回 JSON: ${trimForDiagnostic(result.stdout)}`,
      );
      return [
        blockedCadWorkerArtifact(
          jobId,
          "CAD worker 返回格式不可解析，没有生成 CAD artifact。",
        ),
      ];
    }

    if (payload.status !== "completed") {
      const reason =
        payload.error?.message ??
        payload.error?.code ??
        payload.status ??
        "unknown";
      diagnostics.push(`CAD worker 未完成: ${trimForDiagnostic(reason)}`);
      return [
        blockedCadWorkerArtifact(jobId, `cadquery worker 未完成: ${reason}`),
      ];
    }

    const artifacts = payload.artifacts ?? [];
    const mappedArtifacts = artifacts.map((artifact, index) =>
      mapWorkerArtifact(jobId, artifact, index),
    );
    return [
      {
        id: `cad-worker-job-${jobId}`,
        kind: "cad_worker_job",
        title: "ToolRouter CAD worker 任务",
        content: JSON.stringify(
          {
            jobId,
            adapter: "cadquery",
            spec,
            output: payload.output ?? {},
            artifactCount: mappedArtifacts.length,
          },
          null,
          2,
        ),
        status: "ready",
      },
      ...mappedArtifacts,
    ];
  } catch (error) {
    diagnostics.push(`CAD worker 调用失败: ${formatError(error)}。`);
    return [
      blockedCadWorkerArtifact(
        jobId,
        "CAD worker 调用失败，没有生成 CAD artifact。",
      ),
    ];
  }
}

function buildPipeCadSpec(input: string): CadPipeSpec | null {
  if (!/(钢管|圆管|管件|管道|管材|pipe|tube)/i.test(input)) return null;
  const length =
    readDimensionMm(
      input,
      /(?:长|长度|length)\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/i,
    ) ??
    readDimensionMm(
      input,
      /(\d+(?:\.\d+)?)\s*(米|m)(?=[^，。；;\n]*(?:钢管|圆管|管|pipe|tube))/i,
    ) ??
    1000;
  const outerDiameter =
    readDimensionMm(
      input,
      /(?:直径|外径|diameter|od)\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/i,
    ) ??
    readDimensionMm(
      input,
      /(\d+(?:\.\d+)?)\s*(毫米|mm)(?=[^，。；;\n]*(?:钢管|圆管|管|pipe|tube))/i,
    ) ??
    6;
  const wallThicknessFromPrompt = readDimensionMm(
    input,
    /(?:壁厚|厚度|wall\s*thickness)\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/i,
  );
  const wallThickness =
    wallThicknessFromPrompt ?? Math.min(0.5, outerDiameter / 6);

  if (outerDiameter <= wallThickness * 2) {
    return null;
  }

  return {
    shape: "pipe",
    units: "mm",
    dimensions: {
      length,
      outerDiameter,
      wallThickness,
    },
    metadata: {
      sourcePrompt: input,
      wallThicknessSource:
        wallThicknessFromPrompt === undefined ? "heuristic_default" : "prompt",
      complianceNotice:
        "参数化几何已生成；缺少材料牌号、壁厚标准、公差、连接方式和审批证据时，不能作为加工、采购或施工依据。",
    },
  };
}

function readDimensionMm(input: string, pattern: RegExp): number | undefined {
  const match = input.match(pattern);
  if (!match) return undefined;
  const rawValue = Number(match[1]);
  if (!Number.isFinite(rawValue) || rawValue <= 0) return undefined;
  const unit = (match[2] ?? "mm").toLowerCase();
  if (unit === "米" || unit === "m") return rawValue * 1000;
  if (unit === "厘米" || unit === "cm") return rawValue * 10;
  return rawValue;
}

function mapWorkerArtifact(
  jobId: string,
  artifact: WorkerArtifactEnvelope,
  index: number,
): PanAIChatArtifact {
  const role = artifact.role ?? "worker_artifact";
  const metadata = artifact.metadata ?? {};
  const localPath = typeof metadata.path === "string" ? metadata.path : "";
  const sizeBytes =
    typeof metadata.sizeBytes === "number" ? metadata.sizeBytes : null;
  return {
    id: `cad-artifact-${jobId}-${index}`,
    kind: workerRoleToArtifactKind(role),
    title: artifact.name ?? role,
    content: [
      `role=${role}`,
      artifact.media_type ? `mediaType=${artifact.media_type}` : null,
      sizeBytes !== null ? `sizeBytes=${sizeBytes}` : null,
      localPath ? `path=${localPath}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    status: "ready",
  };
}

function workerRoleToArtifactKind(role: string): PanAIChatArtifact["kind"] {
  if (role === "cad_geometry") return "cad_geometry";
  if (role === "cad_mesh") return "cad_mesh";
  if (role === "source_script") return "source_script";
  return "cad_worker_job";
}

function blockedCadWorkerArtifact(
  jobId: string,
  content: string,
): PanAIChatArtifact {
  return {
    id: `cad-worker-job-${jobId}`,
    kind: "cad_worker_job",
    title: "ToolRouter CAD worker 任务",
    content,
    status: "blocked",
  };
}

function resolveRepoRoot(): string {
  const configured = process.env.ARCHITOKEN_REPO_ROOT;
  if (configured?.trim()) return configured.trim();
  return process.cwd().endsWith("03-frontend")
    ? resolve(process.cwd(), "..")
    : process.cwd();
}

function formatNumberForName(value: number): string {
  return String(value).replace(/[^0-9a-z]+/gi, "_");
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} 调用超时`));
    }, options.timeoutMs ?? 120_000);
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

const DEFAULT_HF_MODEL_ROUTES: Record<PanAIModelTaskType, string> = {
  chat: "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
  code: "Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8",
  ocr: "PaddlePaddle/PaddleOCR-VL-1.5",
  text_to_image: "baidu/ERNIE-Image",
  cad_model: "cadquery/local-parametric-worker",
  cad_drawing: "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
  floorplan_suite: "panai/floorplan-layout-kernel",
  floorplan_render: "comfyui/controlnet-image-to-image",
  text_to_bim: "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
  bim_collab: "panai/bim-collab-local",
  image_to_image: "black-forest-labs/FLUX.2-dev-NVFP4",
  image_to_video: "Lightricks/LTX-2.3-nvfp4",
  image_to_3d: "tencent/HY-World-2.0",
  object_to_3d_asset: "nvidia/asset-harvester",
  world_3d_research: "nvidia/Lyra-2.0",
};

const HF_MODEL_ENV_KEYS: Record<PanAIModelTaskType, string[]> = {
  chat: ["ARCHITOKEN_HF_CHAT_MODEL", "HUGGINGFACE_CHAT_MODEL"],
  code: ["ARCHITOKEN_HF_CODE_MODEL", "HUGGINGFACE_CODE_MODEL"],
  ocr: ["ARCHITOKEN_HF_OCR_MODEL", "HUGGINGFACE_OCR_MODEL"],
  text_to_image: [
    "ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL",
    "HUGGINGFACE_TEXT_TO_IMAGE_MODEL",
  ],
  cad_model: ["ARCHITOKEN_CAD_MODEL", "ARCHITOKEN_PARAMETRIC_MODEL"],
  cad_drawing: ["ARCHITOKEN_CAD_DRAWING_MODEL", "ARCHITOKEN_HF_CHAT_MODEL"],
  floorplan_suite: ["ARCHITOKEN_FLOORPLAN_SUITE_MODEL"],
  floorplan_render: [
    "ARCHITOKEN_FLOORPLAN_RENDER_MODEL",
    "ARCHITOKEN_HF_IMAGE_TO_IMAGE_MODEL",
  ],
  text_to_bim: ["ARCHITOKEN_TEXT_TO_BIM_MODEL", "ARCHITOKEN_HF_CHAT_MODEL"],
  bim_collab: ["ARCHITOKEN_BIM_COLLAB_MODEL"],
  image_to_image: [
    "ARCHITOKEN_HF_IMAGE_TO_IMAGE_MODEL",
    "HUGGINGFACE_IMAGE_TO_IMAGE_MODEL",
  ],
  image_to_video: [
    "ARCHITOKEN_HF_IMAGE_TO_VIDEO_MODEL",
    "HUGGINGFACE_IMAGE_TO_VIDEO_MODEL",
  ],
  image_to_3d: [
    "ARCHITOKEN_HF_IMAGE_TO_3D_MODEL",
    "HUGGINGFACE_IMAGE_TO_3D_MODEL",
  ],
  object_to_3d_asset: [
    "ARCHITOKEN_HF_OBJECT_TO_3D_ASSET_MODEL",
    "HUGGINGFACE_OBJECT_TO_3D_ASSET_MODEL",
  ],
  world_3d_research: [
    "ARCHITOKEN_HF_WORLD_3D_RESEARCH_MODEL",
    "HUGGINGFACE_WORLD_3D_RESEARCH_MODEL",
  ],
};

const LOCAL_OLLAMA_MODEL_ROUTES: Partial<
  Record<PanAIModelTaskType, string>
> = {
  chat: "nemotron-3-nano:30b",
  code: "qwen3.6:35b-a3b",
  ocr: "glm-ocr:bf16",
  cad_model: "Insome:12B",
  image_to_image: "gemma4:31b-it-q8_0",
  image_to_3d: "gemma4:31b-it-q8_0",
  object_to_3d_asset: "gemma4:31b-it-q8_0",
  world_3d_research: "granite4.1:30b-q8_0",
};

function resolveLocalOllamaModelChain(
  modelTaskType: PanAIModelTaskType,
): string[] {
  const specific = firstConfiguredEnv([
    `ARCHITOKEN_OLLAMA_${modelTaskType.toUpperCase()}_MODEL`,
    `OLLAMA_${modelTaskType.toUpperCase()}_MODEL`,
  ]);
  const candidates = [
    specific,
    LOCAL_OLLAMA_MODEL_ROUTES[modelTaskType],
    process.env.ARCHITOKEN_OLLAMA_CHAT_MODEL,
    LOCAL_OLLAMA_MODEL_ROUTES.chat,
    "Insome:12B",
  ];
  return Array.from(
    new Set(
      candidates.filter((value): value is string => Boolean(value?.trim())),
    ),
  );
}

function normalizeLocalModelContent(content: string): string {
  const trimmed = content.trim();
  if (/我是(?:通义千问|Qwen|Gemma|Granite|Nemotron)/i.test(trimmed)) {
    return `我是 ArchIToken，通过 PanAIRouter 调用了本地真实大模型 adapter 生成此回复。\n\n${trimmed}`;
  }
  return trimmed;
}

function panAICliFallbackEnabled(): boolean {
  const value =
    process.env.ARCHITOKEN_ENABLE_PANAI_CLI_FALLBACK ??
    process.env.PANAI_ENABLE_CLI_FALLBACK;
  return value ? /^(1|true|yes|on)$/i.test(value.trim()) : false;
}

function ollamaFallbackEnabled(): boolean {
  const value =
    process.env.ARCHITOKEN_ALLOW_OLLAMA_FALLBACK ??
    process.env.ARCHITOKEN_ENABLE_OLLAMA_FALLBACK ??
    process.env.PANAI_ALLOW_OLLAMA_FALLBACK;
  return value ? /^(1|true|yes|on)$/i.test(value.trim()) : false;
}

function resolvePanAITextModel(
  modelTaskType: PanAIModelTaskType,
): string {
  return (
    firstConfiguredEnv(HF_MODEL_ENV_KEYS[modelTaskType]) ??
    routeOverrideModel(modelTaskType) ??
    DEFAULT_HF_MODEL_ROUTES[modelTaskType] ??
    process.env.ARCHITOKEN_PANAI_MODEL ??
    "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"
  );
}

function routeOverrideModel(
  modelTaskType: PanAIModelTaskType,
): string | null {
  const raw = process.env.ARCHITOKEN_HF_MODEL_ROUTES;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[modelTaskType];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const model = (value as { model?: unknown }).model;
      if (typeof model === "string" && model.trim()) return model.trim();
    }
  } catch {
    return null;
  }

  return null;
}

function firstConfiguredEnv(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return null;
}

function defaultMediaGenerationParameters(
  taskType: "text_to_image" | "image_to_video",
): Record<string, number> {
  if (taskType !== "text_to_image") {
    return {};
  }

  return {
    width: numberEnv("ARCHITOKEN_PANAI_IMAGE_WIDTH", 256),
    height: numberEnv("ARCHITOKEN_PANAI_IMAGE_HEIGHT", 256),
    num_inference_steps: numberEnv("ARCHITOKEN_PANAI_IMAGE_STEPS", 1),
    guidance_scale: numberEnv("ARCHITOKEN_PANAI_IMAGE_GUIDANCE", 1),
  };
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractImageUrl(input: string): string | null {
  const match = input.match(/https?:\/\/\S+/i);
  if (!match) return null;
  return match[0].replace(/[),.;，。；）]+$/, "");
}

async function generationAction(
  baseUrl: string,
  jobId: string,
  action: "plan" | "run",
  headers: Record<string, string>,
  diagnostics: string[],
): Promise<GenerationJobEnvelope | null> {
  const response = await fetch(
    new URL(`/v1/generation/jobs/${jobId}/${action}`, baseUrl),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        actor: "panai",
        metadata: {
          source: "panai_workbench_chat",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    diagnostics.push(
      `GenerationRouter ${action} 返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`,
    );
    return null;
  }

  return response.json() as Promise<GenerationJobEnvelope>;
}

function generationHeaders(
  request: PanAIWorkbenchChatRequest,
): Record<string, string> {
  const requestId = `panai-chat-${Date.now()}`;
  return {
    "Content-Type": "application/json",
    "X-Tenant-Id":
      process.env.ARCHITOKEN_TENANT_ID ??
      "11111111-1111-4111-8111-111111111111",
    "X-Project-Id":
      process.env.ARCHITOKEN_PROJECT_ID ??
      "22222222-2222-4222-8222-222222222222",
    "X-Actor": "panai",
    "X-Roles": "admin",
    "X-Request-Id": requestId,
    "X-Correlation-Id": `${requestId}-${request.moduleId}`,
  };
}

function blockedGenerationArtifact(
  jobId: string,
  content: string,
): PanAIChatArtifact {
  return {
    id: `generation-job-${jobId}`,
    kind: "generation_job",
    title: "GenerationRouter 图像任务",
    content,
    status: "blocked",
  };
}

async function responseDiagnostic(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return trimForDiagnostic(text || response.statusText);
}

function extractOpenAiCompatibleContent(
  payload: OpenAiCompatibleResponse,
): string {
  const choice = payload.choices?.[0];
  return (
    choice?.message?.content ??
    choice?.text ??
    payload.output_text ??
    payload.content ??
    ""
  );
}

function extractJsonPayload(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function looksLikeProviderError(content: string): boolean {
  const normalized = content.trim();
  return (
    /^(?:4\d\d|5\d\d)\b/.test(normalized) ||
    /^(?:PANAI_MODEL_OK|PANAI_[A-Z_]*_OK|HEARTBEAT_OK|MODEL_OK)$/i.test(
      normalized,
    ) ||
    /session file locked/i.test(normalized) ||
    /FallbackSummaryError/i.test(normalized) ||
    /depleted .*credits/i.test(normalized) ||
    /purchase pre-paid credits/i.test(normalized) ||
    /unauthorized|invalid api key|authentication failed/i.test(normalized)
  );
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function trimForDiagnostic(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
