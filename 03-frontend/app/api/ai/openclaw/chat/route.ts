import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';

import {
  buildImagePrompt,
  buildVideoPrompt,
  createOpenClawMessage,
  resolveOpenClawTaskType,
  type OpenClawChatArtifact,
  type OpenClawTaskType,
  type OpenClawWorkbenchChatRequest,
  type OpenClawWorkbenchChatResponse,
} from '@/lib/openclaw-workbench-chat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  let body: OpenClawWorkbenchChatRequest;

  try {
    body = await request.json() as OpenClawWorkbenchChatRequest;
  } catch {
    return NextResponse.json(
      { error: 'Invalid OpenClaw chat request body.' },
      { status: 400 },
    );
  }

  const diagnostics: string[] = [];
  const systemPrompt = buildSystemPrompt(body);
  const latestUserMessage = [...body.messages].reverse().find((message) => message.role === 'user');
  const latestInput = latestUserMessage?.content ?? '';
  const taskType = resolveOpenClawTaskType(latestInput, body.activeCapabilityId);
  const artifacts = await buildArtifacts(body, latestInput, taskType, diagnostics);

  if (taskType === 'text_to_image' || taskType === 'image_to_video') {
    const generated = artifacts.find((artifact) => artifact.kind === 'generation_job' && artifact.status === 'ready');
    const modeLabel = taskType === 'text_to_image' ? 'TextToImage' : 'ImageToVideo';
    return NextResponse.json({
      message: createOpenClawMessage(
        'assistant',
        generated
          ? `已通过 GenerationRouter 调用真实 ${modeLabel} provider，并生成 artifact。`
          : `没有生成 artifact：当前真实 ${modeLabel} provider 未配置、缺少输入图片或执行失败，已拒绝生成假结果。请先配置 Hugging Face token/model，并为视频任务提供 imageUrl/imageBase64 或输入图片 artifact。`,
        {
          route: `GenerationRouter -> ${modeLabel} HTTP provider`,
          artifacts,
        },
      ),
      routedBy: 'generation_router',
      routeStatus: 'routed',
      model: generated ? `GenerationRouter/${modeLabel}` : `GenerationRouter/${modeLabel} blocked`,
      diagnostics,
    } satisfies OpenClawWorkbenchChatResponse);
  }

  const openClawGateway = await invokeOpenClawGateway(body, systemPrompt, diagnostics);
  if (openClawGateway) {
    return NextResponse.json({
      message: createOpenClawMessage('assistant', openClawGateway.content, {
        route: 'OpenClaw Gateway /v1/chat/completions',
        artifacts,
      }),
      routedBy: 'openclaw_gateway',
      routeStatus: 'routed',
      model: openClawGateway.model ?? 'openclaw/default',
      diagnostics,
    } satisfies OpenClawWorkbenchChatResponse);
  }

  const openClawCli = await invokeOpenClawCliGateway(body, systemPrompt, diagnostics);
  if (openClawCli) {
    return NextResponse.json({
      message: createOpenClawMessage('assistant', openClawCli.content, {
        route: 'OpenClaw CLI -> Gateway -> model.run',
        artifacts,
      }),
      routedBy: 'openclaw_cli_gateway',
      routeStatus: 'routed',
      model: openClawCli.model,
      diagnostics,
    } satisfies OpenClawWorkbenchChatResponse);
  }

  return NextResponse.json(
    {
      error: 'OpenClaw Gateway 未真实接通，已拒绝生成假回复。',
      diagnostics,
    },
    { status: 503 },
  );
}

function buildSystemPrompt(request: OpenClawWorkbenchChatRequest): string {
  const capabilitySummary = request.capabilities
    .slice(0, 28)
    .map((capability) => `- ${capability.label}: ${capability.description}`)
    .join('\n');
  const auditSummary = request.auditEvents
    .slice(0, 6)
    .map((event) => `- ${event.summary}`)
    .join('\n') || '- 暂无当前页审计事件';

  return [
    '你是 ArchIToken 平台内的 OpenClaw 接管层，不是孤立聊天机器人。',
    '你必须通过 WorkflowRouter、ToolRouter、ModelRouter、InferenceRouter、GenerationRouter、CDE、AuditTrail 和 Approver 表达执行路径。',
    '你可以协调市场客服、计划管理、方案设计、标准族库、深化设计、计量造价、材料物流、生产制造、施工管理、数字孪生、数字档案、财务人力、AI中心和设置中心。',
    '没有专业来源、规范、审批或运行证据时，只能输出启发草案，不得声称合规、送审、施工、验收或发布完成。',
    `当前模块: ${request.moduleName} (${request.moduleId})`,
    request.selectedFeatureTitle ? `当前业务对象: ${request.selectedFeatureTitle}` : '当前业务对象: 未锁定',
    '可用平台能力:',
    capabilitySummary,
    '最近审计:',
    auditSummary,
    '回答要求: 使用简体中文，先给可执行路由，再给下一步动作；涉及图像时生成可交给 Hugging Face 图像端点的英文提示词。',
  ].join('\n');
}

async function invokeOpenClawGateway(
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  diagnostics: string[],
): Promise<{ content: string; model?: string } | null> {
  const baseUrl = process.env.OPENCLAW_GATEWAY_URL;
  if (!baseUrl) {
    diagnostics.push('OPENCLAW_GATEWAY_URL 未配置，使用 OpenClaw CLI Gateway adapter。');
    return null;
  }

  const model = resolveOpenClawTextModel();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    headers.Authorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`;
  }

  try {
    const response = await fetch(new URL('/v1/chat/completions', normalizedBaseUrl(baseUrl)), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          ...request.messages.slice(-10).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      diagnostics.push(`OpenClaw Gateway 返回 HTTP ${response.status}。`);
      return null;
    }

    const payload = await response.json() as OpenAiCompatibleResponse;
    const content = extractOpenAiCompatibleContent(payload);
    if (!content) {
      diagnostics.push('OpenClaw Gateway 响应没有可用文本。');
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

async function invokeOpenClawCliGateway(
  request: OpenClawWorkbenchChatRequest,
  systemPrompt: string,
  diagnostics: string[],
): Promise<{ content: string; model: string } | null> {
  const cli = process.env.OPENCLAW_CLI_PATH ?? '/usr/bin/openclaw';
  const model = resolveOpenClawTextModel();
  const prompt = buildOpenClawPrompt(systemPrompt, request);

  try {
    const result = await runOpenClawCli(cli, [
      'infer',
      'model',
      'run',
      '--gateway',
      '--model',
      model,
      '--prompt',
      prompt,
      '--json',
    ]);

    if (result.code !== 0) {
      diagnostics.push(`OpenClaw CLI Gateway 退出码 ${result.code}: ${trimForDiagnostic(result.stderr || result.stdout)}`);
      return null;
    }

    const payload = extractJsonPayload(result.stdout) as OpenClawCliResponse | null;
    const text = payload?.outputs?.map((output) => output.text).find(Boolean);
    if (!payload?.ok || !text) {
      diagnostics.push(`OpenClaw CLI Gateway 没有返回有效文本: ${trimForDiagnostic(result.stdout)}`);
      return null;
    }

    return {
      content: text,
      model: `${payload.provider ?? 'openclaw'}/${payload.model ?? model}`,
    };
  } catch (error) {
    diagnostics.push(`OpenClaw CLI Gateway 调用失败: ${formatError(error)}。`);
    return null;
  }
}

function buildOpenClawPrompt(systemPrompt: string, request: OpenClawWorkbenchChatRequest): string {
  const conversation = request.messages
    .slice(-10)
    .map((message) => `${message.role === 'user' ? '用户' : 'OpenClaw'}: ${message.content}`)
    .join('\n\n');

  return [
    systemPrompt,
    '下面是当前工作台真实会话。你必须作为 OpenClaw Gateway 的模型执行结果回复，不要声称本地草案或模拟执行。',
    conversation,
  ].join('\n\n');
}

function runOpenClawCli(
  cli: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('OpenClaw CLI Gateway 调用超时'));
    }, 120_000);
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
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
  if (taskType === 'chat') {
    return artifacts;
  }

  const prompt = taskType === 'image_to_video'
    ? buildVideoPrompt(request, latestInput)
    : buildImagePrompt(request, latestInput);
  artifacts.push({
    id: taskType === 'image_to_video' ? 'hf-video-prompt' : 'hf-image-prompt',
    kind: taskType === 'image_to_video' ? 'video_prompt' : 'image_prompt',
    title: taskType === 'image_to_video' ? 'Hugging Face 视频提示词' : 'Hugging Face 配图提示词',
    content: prompt,
    status: 'pending_router',
  });

  const job = await runGenerationJob(request, latestInput, prompt, taskType, diagnostics);
  if (job) {
    artifacts.push(job);
  }

  return artifacts;
}

async function runGenerationJob(
  request: OpenClawWorkbenchChatRequest,
  latestInput: string,
  prompt: string,
  taskType: Exclude<OpenClawTaskType, 'chat'>,
  diagnostics: string[],
): Promise<OpenClawChatArtifact | null> {
  const baseUrl = process.env.ARCHITOKEN_GATEWAY_BASE_URL
    ?? process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL
    ?? 'http://127.0.0.1:8080';
  const base = normalizedBaseUrl(baseUrl);
  const headers = generationHeaders(request);
  const imageUrl = extractImageUrl(latestInput);

  try {
    const response = await fetch(new URL('/v1/generation/jobs', base), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: taskType,
        moduleId: request.moduleId,
        prompt,
        actor: 'openclaw',
        constraints: {
          router: 'GenerationRouter',
          providerHint: 'hugging_face',
          ...(taskType === 'image_to_video' && imageUrl ? { imageUrl } : {}),
          provenance: {
            source: 'openclaw_workbench_chat',
            selectedFeatureTitle: request.selectedFeatureTitle ?? null,
          },
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      diagnostics.push(`GenerationRouter 配图任务创建返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`);
      return null;
    }

    const payload = await response.json() as GenerationJobEnvelope;
    const jobId = payload.id ?? payload.jobId ?? payload.job_id;
    if (!jobId) {
      diagnostics.push('GenerationRouter 配图任务创建成功，但响应缺少 job id。');
      return null;
    }

    const planned = await generationAction(base, jobId, 'plan', headers, diagnostics);
    if (!planned) {
      return blockedGenerationArtifact(jobId, 'GenerationRouter 图像任务 plan 失败');
    }

    const completed = await generationAction(base, jobId, 'run', headers, diagnostics);
    if (!completed) {
      return blockedGenerationArtifact(jobId, 'GenerationRouter 图像任务 run 失败');
    }

    const artifactsResponse = await fetch(new URL(`/v1/generation/jobs/${jobId}/artifacts`, base), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!artifactsResponse.ok) {
      diagnostics.push(`GenerationRouter artifact 查询返回 HTTP ${artifactsResponse.status}: ${await responseDiagnostic(artifactsResponse)}。`);
      return blockedGenerationArtifact(jobId, 'GenerationRouter 图像任务已运行，但未取回 artifact');
    }

    const artifactPayload = await artifactsResponse.json() as GenerationArtifactEnvelope;
    const mediaArtifact = artifactPayload.artifacts?.find((artifact) => {
      const mimeType = artifact.artifactMetadata?.mimeType ?? '';
      return taskType === 'text_to_image'
        ? artifact.kind === 'image' || mimeType.startsWith('image/')
        : artifact.kind === 'video' || mimeType.startsWith('video/');
    });
    if (!mediaArtifact?.id) {
      diagnostics.push(`GenerationRouter ${taskType} 任务完成，但没有返回匹配的 media artifact。`);
      return blockedGenerationArtifact(jobId, `GenerationRouter ${taskType} 任务没有 media artifact`);
    }

    const href = new URL(`/v1/artifacts/${mediaArtifact.id}/content`, base).toString();
    return {
      id: `generation-job-${jobId}`,
      kind: 'generation_job',
      title: taskType === 'text_to_image' ? 'GenerationRouter 图像任务' : 'GenerationRouter 视频任务',
      content: `已生成 ${taskType} artifact: ${mediaArtifact.reference?.name ?? mediaArtifact.id}`,
      status: 'ready',
      href,
    };
  } catch (error) {
    diagnostics.push(`GenerationRouter 配图任务执行失败: ${formatError(error)}。`);
    return null;
  }
}

function resolveOpenClawTextModel(): string {
  return process.env.ARCHITOKEN_OPENCLAW_MODEL
    ?? process.env.ARCHITOKEN_HF_CHAT_MODEL
    ?? process.env.HUGGINGFACE_CHAT_MODEL
    ?? 'huggingface/deepseek-ai/DeepSeek-R1-0528';
}

function extractImageUrl(input: string): string | null {
  const match = input.match(/https?:\/\/\S+/i);
  if (!match) return null;
  return match[0].replace(/[),.;，。；）]+$/, '');
}

async function generationAction(
  baseUrl: string,
  jobId: string,
  action: 'plan' | 'run',
  headers: Record<string, string>,
  diagnostics: string[],
): Promise<GenerationJobEnvelope | null> {
  const response = await fetch(new URL(`/v1/generation/jobs/${jobId}/${action}`, baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      actor: 'openclaw',
      metadata: {
        source: 'openclaw_workbench_chat',
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    diagnostics.push(`GenerationRouter ${action} 返回 HTTP ${response.status}: ${await responseDiagnostic(response)}。`);
    return null;
  }

  return response.json() as Promise<GenerationJobEnvelope>;
}

function generationHeaders(request: OpenClawWorkbenchChatRequest): Record<string, string> {
  const requestId = `openclaw-chat-${Date.now()}`;
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': process.env.ARCHITOKEN_TENANT_ID ?? '11111111-1111-4111-8111-111111111111',
    'X-Project-Id': process.env.ARCHITOKEN_PROJECT_ID ?? '22222222-2222-4222-8222-222222222222',
    'X-Actor': 'openclaw',
    'X-Roles': 'admin',
    'X-Request-Id': requestId,
    'X-Correlation-Id': `${requestId}-${request.moduleId}`,
  };
}

function blockedGenerationArtifact(jobId: string, content: string): OpenClawChatArtifact {
  return {
    id: `generation-job-${jobId}`,
    kind: 'generation_job',
    title: 'GenerationRouter 图像任务',
    content,
    status: 'blocked',
  };
}

async function responseDiagnostic(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return trimForDiagnostic(text || response.statusText);
}

function extractOpenAiCompatibleContent(payload: OpenAiCompatibleResponse): string {
  const choice = payload.choices?.[0];
  return choice?.message?.content ?? choice?.text ?? payload.output_text ?? payload.content ?? '';
}

function extractJsonPayload(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
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

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function trimForDiagnostic(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
