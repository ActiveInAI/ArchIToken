import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildImagePrompt,
  buildVideoPrompt,
  createOpenClawMessage,
  resolveOpenClawModelTaskType,
  resolveOpenClawNavigationAction,
  resolveOpenClawTaskType,
  type OpenClawChatArtifact,
  type OpenClawModelTaskType,
  type OpenClawTaskType,
  type OpenClawWorkbenchChatRequest,
  type OpenClawWorkbenchChatResponse,
} from "@/lib/openclaw-workbench-chat";
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

interface OpenClawCliResponse {
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
  let body: OpenClawWorkbenchChatRequest;

  try {
    body = parseStrictOpenClawRequest(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid OpenClaw chat request body." },
      { status: 400 },
    );
  }

  const diagnostics: string[] = [];
  const systemPrompt = buildSystemPrompt(body);
  const latestUserMessage = [...body.messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestInput = latestUserMessage?.content ?? "";
  const navigationAction = resolveOpenClawNavigationAction(
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
      message: createOpenClawMessage(
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
    } satisfies OpenClawWorkbenchChatResponse);
  }

  const taskType = resolveOpenClawTaskType(
    latestInput,
    body.activeCapabilityId,
  );
  const modelTaskType = resolveOpenClawModelTaskType(
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
      message: createOpenClawMessage(
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
    } satisfies OpenClawWorkbenchChatResponse);
  }

  if (taskType === "cad_model") {
    const generated = artifacts.find(
      (artifact) =>
        artifact.kind === "cad_worker_job" && artifact.status === "ready",
    );
    return NextResponse.json({
      message: createOpenClawMessage(
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
    } satisfies OpenClawWorkbenchChatResponse);
  }

  const openClawGateway = await invokeOpenClawGateway(
    body,
    systemPrompt,
    modelTaskType,
    diagnostics,
  );
  if (openClawGateway) {
    return NextResponse.json({
      message: createOpenClawMessage("assistant", openClawGateway.content, {
        route: "OpenClaw Gateway /v1/chat/completions",
        artifacts,
      }),
      routedBy: "openclaw_gateway",
      routeStatus: "routed",
      model: openClawGateway.model ?? "openclaw/default",
      diagnostics,
    } satisfies OpenClawWorkbenchChatResponse);
  }

  const huggingFaceLocal = await invokeHuggingFaceLocalChatAdapter(
    body,
    systemPrompt,
    modelTaskType,
    diagnostics,
  );
  if (huggingFaceLocal) {
    return NextResponse.json({
      message: createOpenClawMessage("assistant", huggingFaceLocal.content, {
        route:
          "OpenClawRouter -> ModelRouter -> InferenceRouter -> Hugging Face local/vLLM provider",
        artifacts,
      }),
      routedBy: "huggingface_local_adapter",
      routeStatus: "routed",
      model: huggingFaceLocal.model,
      diagnostics,
    } satisfies OpenClawWorkbenchChatResponse);
  }

  const localModel = await invokeLocalModelAdapter(
    body,
    systemPrompt,
    modelTaskType,
    diagnostics,
  );
  if (localModel) {
    return NextResponse.json({
      message: createOpenClawMessage("assistant", localModel.content, {
        route: "OpenClawRouter -> LocalModelAdapter -> Ollama real model",
        artifacts,
      }),
      routedBy: "local_model_adapter",
      routeStatus: "routed",
      model: localModel.model,
      diagnostics,
    } satisfies OpenClawWorkbenchChatResponse);
  }

  if (openClawCliFallbackEnabled()) {
    const openClawCli = await invokeOpenClawCliGateway(
      body,
      systemPrompt,
      modelTaskType,
      diagnostics,
    );
    if (openClawCli) {
      return NextResponse.json({
        message: createOpenClawMessage("assistant", openClawCli.content, {
          route: "OpenClaw CLI -> Gateway -> model.run",
          artifacts,
        }),
        routedBy: "openclaw_cli_gateway",
        routeStatus: "routed",
        model: openClawCli.model,
        diagnostics,
      } satisfies OpenClawWorkbenchChatResponse);
    }
  } else {
    diagnostics.push(
      "OpenClaw CLI fallback 未启用；避免把 OPENCLAW_MODEL_OK/HEARTBEAT_OK 这类哨兵值当作业务回复。",
    );
  }

  return NextResponse.json(
    {
      error: diagnostics.some((item) => item.includes("provider 返回错误"))
        ? "OpenClaw 已路由到真实 provider，但 provider 返回错误，已拒绝生成假回复。"
        : "OpenClaw Gateway 未真实接通，已拒绝生成假回复。",
      diagnostics,
    },
    { status: 503 },
  );
}

function parseStrictOpenClawRequest(
  raw: unknown,
): OpenClawWorkbenchChatRequest {
  if (!raw || typeof raw !== "object") {
    throw new Error("request body must be an object");
  }

  const value = raw as Partial<OpenClawWorkbenchChatRequest>;
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

function buildSystemPrompt(request: OpenClawWorkbenchChatRequest): string {
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
    "你是 ArchIToken 平台内的 OpenClaw 接管层，不是孤立聊天机器人。",
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

async function invokeOpenClawGateway(
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model?: string } | null> {
  const baseUrl = process.env.OPENCLAW_GATEWAY_URL;
  if (!baseUrl) {
    diagnostics.push(
      "OPENCLAW_GATEWAY_URL 未配置，已切换到 HuggingFaceLocalAdapter；OpenClaw CLI fallback 默认禁用。",
    );
    return null;
  }

  const model = resolveOpenClawTextModel(modelTaskType);
  const routedSystemPrompt = withModelRoutingContext(
    systemPrompt,
    modelTaskType,
    model,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    headers.Authorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`;
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
      diagnostics.push(`OpenClaw Gateway 返回 HTTP ${response.status}。`);
      return null;
    }

    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = extractOpenAiCompatibleContent(payload);
    if (!content) {
      diagnostics.push("OpenClaw Gateway 响应没有可用文本。");
      return null;
    }
    if (looksLikeProviderError(content)) {
      diagnostics.push(
        `OpenClaw Gateway provider 返回错误: ${trimForDiagnostic(content)}`,
      );
      return null;
    }

    return {
      content,
      model: payload.model ?? model,
    };
  } catch (error) {
    diagnostics.push(`OpenClaw Gateway 调用失败: ${formatError(error)}。`);
    return null;
  }
}

async function invokeHuggingFaceLocalChatAdapter(
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  const endpoint = resolveHuggingFaceChatCompletionsUrl();
  const model = resolveOpenClawTextModel(modelTaskType);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    numberEnv("ARCHITOKEN_OPENCLAW_CHAT_TIMEOUT_MS", 300_000),
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        max_tokens: numberEnv("ARCHITOKEN_OPENCLAW_CHAT_MAX_TOKENS", 768),
        messages: buildHuggingFaceChatMessages(
          request,
          systemPrompt,
          modelTaskType,
          model,
        ),
        taskType: modelTaskType,
        moduleId: request.moduleId,
        timeoutSeconds: numberEnv(
          "ARCHITOKEN_OPENCLAW_CHAT_TIMEOUT_SECONDS",
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
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
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
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
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
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
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
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
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

async function invokeOpenClawCliGateway(
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  const cli = process.env.OPENCLAW_CLI_PATH ?? "/usr/bin/openclaw";
  const model = resolveOpenClawTextModel(modelTaskType);
  const prompt = buildOpenClawPrompt(
    withModelRoutingContext(systemPrompt, modelTaskType, model),
    request,
  );

  try {
    const result = await runOpenClawCli(cli, [
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
        `OpenClaw CLI Gateway 退出码 ${result.code}: ${trimForDiagnostic(result.stderr || result.stdout)}`,
      );
      return null;
    }

    const payload = extractJsonPayload(
      result.stdout,
    ) as OpenClawCliResponse | null;
    const text = payload?.outputs?.map((output) => output.text).find(Boolean);
    if (!payload?.ok || !text) {
      diagnostics.push(
        `OpenClaw CLI Gateway 没有返回有效文本: ${trimForDiagnostic(result.stdout)}`,
      );
      return null;
    }
    if (looksLikeProviderError(text)) {
      diagnostics.push(
        `OpenClaw CLI Gateway provider 返回错误: ${trimForDiagnostic(text)}`,
      );
      return null;
    }

    return {
      content: text,
      model: `${payload.provider ?? "openclaw"}/${payload.model ?? model}`,
    };
  } catch (error) {
    diagnostics.push(`OpenClaw CLI Gateway 调用失败: ${formatError(error)}。`);
    return null;
  }
}

function buildOpenClawPrompt(
  systemPrompt: string,
  request: OpenClawWorkbenchChatRequest,
): string {
  const conversation = request.messages
    .slice(-10)
    .map(
      (message) =>
        `${message.role === "user" ? "用户" : "OpenClaw"}: ${message.content}`,
    )
    .join("\n\n");

  return [
    systemPrompt,
    "下面是当前工作台真实会话。你必须作为 OpenClaw Gateway 的模型执行结果回复，不要声称本地草案或模拟执行。",
    conversation,
  ].join("\n\n");
}

function withModelRoutingContext(
  systemPrompt: string,
  modelTaskType: OpenClawModelTaskType,
  model: string,
): string {
  return [
    systemPrompt,
    `ModelRouter taskType: ${modelTaskType}`,
    `ModelRouter selectedModel: ${model}`,
    "ModelRouter providerPreference: huggingface 本地/私有模型优先；Ollama 仅作为显式备用适配器。",
  ].join("\n");
}

function runOpenClawCli(
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
      reject(new Error("OpenClaw CLI Gateway 调用超时"));
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
  request: OpenClawWorkbenchChatRequest,
  latestInput: string,
  taskType: OpenClawTaskType,
  diagnostics: string[],
): Promise<OpenClawChatArtifact[]> {
  const artifacts: OpenClawChatArtifact[] = [];
  if (taskType === "chat") {
    return artifacts;
  }

  if (taskType === "cad_model") {
    return runCadWorkerJob(request, latestInput, diagnostics);
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
  request: OpenClawWorkbenchChatRequest,
  latestInput: string,
  prompt: string,
  taskType: "text_to_image" | "image_to_video",
  diagnostics: string[],
): Promise<OpenClawChatArtifact | null> {
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
        actor: "openclaw",
        constraints: {
          router: "GenerationRouter",
          providerHint: "hugging_face",
          ...(Object.keys(parameters).length ? { parameters } : {}),
          ...(taskType === "image_to_video" && imageUrl ? { imageUrl } : {}),
          provenance: {
            source: "openclaw_workbench_chat",
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

async function runCadWorkerJob(
  request: OpenClawWorkbenchChatRequest,
  latestInput: string,
  diagnostics: string[],
): Promise<OpenClawChatArtifact[]> {
  const spec = buildPipeCadSpec(latestInput);
  if (!spec) {
    return [
      blockedCadWorkerArtifact(
        "cad-spec",
        "ToolRouter 已识别为 CAD 任务，但当前只能从提示词解析 pipe/tube 参数。请提供长度、外径/直径和可选壁厚。",
      ),
    ];
  }

  const jobId = `openclaw-cad-${randomUUID()}`;
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
    actor: "openclaw",
    operation: "cad_convert",
    source_asset_id: "openclaw-generated-cad",
    source_file_id: "openclaw-generated-cad-spec",
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
): OpenClawChatArtifact {
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

function workerRoleToArtifactKind(role: string): OpenClawChatArtifact["kind"] {
  if (role === "cad_geometry") return "cad_geometry";
  if (role === "cad_mesh") return "cad_mesh";
  if (role === "source_script") return "source_script";
  return "cad_worker_job";
}

function blockedCadWorkerArtifact(
  jobId: string,
  content: string,
): OpenClawChatArtifact {
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

const DEFAULT_HF_MODEL_ROUTES: Record<OpenClawModelTaskType, string> = {
  chat: "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4",
  code: "Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8",
  ocr: "PaddlePaddle/PaddleOCR-VL-1.5",
  text_to_image: "baidu/ERNIE-Image",
  cad_model: "cadquery/local-parametric-worker",
  image_to_image: "black-forest-labs/FLUX.2-dev-NVFP4",
  image_to_video: "Lightricks/LTX-2.3-nvfp4",
  image_to_3d: "tencent/HY-World-2.0",
  object_to_3d_asset: "nvidia/asset-harvester",
  world_3d_research: "nvidia/Lyra-2.0",
};

const HF_MODEL_ENV_KEYS: Record<OpenClawModelTaskType, string[]> = {
  chat: ["ARCHITOKEN_HF_CHAT_MODEL", "HUGGINGFACE_CHAT_MODEL"],
  code: ["ARCHITOKEN_HF_CODE_MODEL", "HUGGINGFACE_CODE_MODEL"],
  ocr: ["ARCHITOKEN_HF_OCR_MODEL", "HUGGINGFACE_OCR_MODEL"],
  text_to_image: [
    "ARCHITOKEN_HF_TEXT_TO_IMAGE_MODEL",
    "HUGGINGFACE_TEXT_TO_IMAGE_MODEL",
  ],
  cad_model: ["ARCHITOKEN_CAD_MODEL", "ARCHITOKEN_PARAMETRIC_MODEL"],
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
  Record<OpenClawModelTaskType, string>
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
  modelTaskType: OpenClawModelTaskType,
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
    return `我是 ArchIToken，通过 OpenClawRouter 调用了本地真实大模型 adapter 生成此回复。\n\n${trimmed}`;
  }
  return trimmed;
}

function openClawCliFallbackEnabled(): boolean {
  const value =
    process.env.ARCHITOKEN_ENABLE_OPENCLAW_CLI_FALLBACK ??
    process.env.OPENCLAW_ENABLE_CLI_FALLBACK;
  return value ? /^(1|true|yes|on)$/i.test(value.trim()) : false;
}

function ollamaFallbackEnabled(): boolean {
  const value =
    process.env.ARCHITOKEN_ALLOW_OLLAMA_FALLBACK ??
    process.env.ARCHITOKEN_ENABLE_OLLAMA_FALLBACK ??
    process.env.OPENCLAW_ALLOW_OLLAMA_FALLBACK;
  return value ? /^(1|true|yes|on)$/i.test(value.trim()) : false;
}

function resolveOpenClawTextModel(
  modelTaskType: OpenClawModelTaskType,
): string {
  return (
    firstConfiguredEnv(HF_MODEL_ENV_KEYS[modelTaskType]) ??
    routeOverrideModel(modelTaskType) ??
    DEFAULT_HF_MODEL_ROUTES[modelTaskType] ??
    process.env.ARCHITOKEN_OPENCLAW_MODEL ??
    "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4"
  );
}

function routeOverrideModel(
  modelTaskType: OpenClawModelTaskType,
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
    width: numberEnv("ARCHITOKEN_OPENCLAW_IMAGE_WIDTH", 256),
    height: numberEnv("ARCHITOKEN_OPENCLAW_IMAGE_HEIGHT", 256),
    num_inference_steps: numberEnv("ARCHITOKEN_OPENCLAW_IMAGE_STEPS", 1),
    guidance_scale: numberEnv("ARCHITOKEN_OPENCLAW_IMAGE_GUIDANCE", 1),
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
        actor: "openclaw",
        metadata: {
          source: "openclaw_workbench_chat",
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
  request: OpenClawWorkbenchChatRequest,
): Record<string, string> {
  const requestId = `openclaw-chat-${Date.now()}`;
  return {
    "Content-Type": "application/json",
    "X-Tenant-Id":
      process.env.ARCHITOKEN_TENANT_ID ??
      "11111111-1111-4111-8111-111111111111",
    "X-Project-Id":
      process.env.ARCHITOKEN_PROJECT_ID ??
      "22222222-2222-4222-8222-222222222222",
    "X-Actor": "openclaw",
    "X-Roles": "admin",
    "X-Request-Id": requestId,
    "X-Correlation-Id": `${requestId}-${request.moduleId}`,
  };
}

function blockedGenerationArtifact(
  jobId: string,
  content: string,
): OpenClawChatArtifact {
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
    /^(?:OPENCLAW_MODEL_OK|OPENCLAW_[A-Z_]*_OK|HEARTBEAT_OK|MODEL_OK)$/i.test(
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
