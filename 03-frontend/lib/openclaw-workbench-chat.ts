// lib/openclaw-workbench-chat.ts - OpenClaw-controlled module workbench chat contract
// License: Apache-2.0

import { getModuleOperationalProfile } from './module-operations';
import {
  getModuleSpec,
  moduleSpecs,
  type ModuleId,
} from './module-registry';

export type OpenClawChatRole = 'user' | 'assistant';

export type OpenClawCapabilityKind =
  | 'module'
  | 'operation'
  | 'workflow'
  | 'image'
  | 'audit'
  | 'navigation';

export interface OpenClawWorkbenchCapability {
  id: string;
  kind: OpenClawCapabilityKind;
  label: string;
  description: string;
  command: string;
  moduleId?: ModuleId;
  routeHref?: string;
}

export interface OpenClawChatArtifact {
  id: string;
  kind: 'route_plan' | 'image_prompt' | 'generation_job' | 'audit_note';
  title: string;
  content: string;
  status: 'ready' | 'pending_router' | 'blocked' | 'draft';
  href?: string;
}

export interface OpenClawChatMessage {
  id: string;
  role: OpenClawChatRole;
  content: string;
  createdAt: string;
  route?: string;
  artifacts?: OpenClawChatArtifact[];
}

export interface OpenClawAuditSummary {
  id: string;
  summary: string;
  at?: string;
  actor?: string;
}

export interface OpenClawWorkbenchChatRequest {
  moduleId: ModuleId;
  moduleName: string;
  selectedFeatureTitle?: string;
  activeCapabilityId?: string;
  messages: OpenClawChatMessage[];
  capabilities: OpenClawWorkbenchCapability[];
  auditEvents: OpenClawAuditSummary[];
}

export interface OpenClawWorkbenchChatResponse {
  message: OpenClawChatMessage;
  routedBy: 'openclaw_gateway' | 'openclaw_cli_gateway';
  routeStatus: 'routed';
  model?: string;
  diagnostics: string[];
}

const imageIntentPattern = /配图|生成图|效果图|渲染|图片|封面|poster|image|render/i;

export function createOpenClawMessage(
  role: OpenClawChatRole,
  content: string,
  options: {
    route?: string;
    artifacts?: OpenClawChatArtifact[];
    createdAt?: string;
  } = {},
): OpenClawChatMessage {
  const message: OpenClawChatMessage = {
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

export function buildOpenClawWorkbenchCapabilities(
  moduleId: ModuleId,
): OpenClawWorkbenchCapability[] {
  const currentSpec = getModuleSpec(moduleId);
  const operationalProfile = getModuleOperationalProfile(moduleId);
  const currentOperations = operationalProfile.operations.map((operation) => ({
    id: `${moduleId}:operation:${operation.id}`,
    kind: 'operation' as const,
    label: operation.label,
    description: operation.result,
    command: `${currentSpec.zhName} / ${operation.label}`,
    moduleId,
    routeHref: currentSpec.routeHref,
  }));
  const moduleRoutes = moduleSpecs.map((spec) => ({
    id: `${spec.id}:module`,
    kind: 'module' as const,
    label: spec.zhName,
    description: spec.summary,
    command: `打开 ${spec.zhName} 并接管 ${spec.enName}`,
    moduleId: spec.id,
    routeHref: spec.routeHref,
  }));

  return [
    {
      id: 'openclaw:platform-orchestrator',
      kind: 'workflow',
      label: '全平台接管',
      description: '通过 OpenClaw 调度 14 个模块、CDE 文件、审批、审计、工具和模型路由。',
      command: 'OpenClaw 接管全部业务系统能力',
      moduleId,
    },
    {
      id: 'openclaw:hf-image',
      kind: 'image',
      label: '大模型配图',
      description: '把配图意图交给 GenerationRouter，并优先使用 Hugging Face 图像端点或本地缓存适配器。',
      command: '根据当前业务上下文生成配图提示词和图像任务',
      moduleId,
    },
    {
      id: 'openclaw:audit-evidence',
      kind: 'audit',
      label: '审计证据链',
      description: '把聊天、工具、文件、审批和生成任务写入可追踪审计链。',
      command: '生成当前会话审计摘要',
      moduleId,
    },
    ...currentOperations,
    ...moduleRoutes,
  ];
}

export function isOpenClawImageIntent(input: string, activeCapabilityId?: string): boolean {
  return activeCapabilityId === 'openclaw:hf-image' || imageIntentPattern.test(input);
}

export async function invokeOpenClawWorkbenchChat(
  request: OpenClawWorkbenchChatRequest,
): Promise<OpenClawWorkbenchChatResponse> {
  const response = await fetch('/api/ai/openclaw/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; diagnostics?: string[] } | null;
    const message = payload?.error ?? `OpenClaw chat route failed: HTTP ${response.status}`;
    throw new Error([message, ...(payload?.diagnostics ?? [])].join('\n'));
  }

  return response.json() as Promise<OpenClawWorkbenchChatResponse>;
}

export function buildImagePrompt(
  request: OpenClawWorkbenchChatRequest,
  userInput: string,
): string {
  const moduleSpec = getModuleSpec(request.moduleId);
  const selectedFeature = request.selectedFeatureTitle
    ? `业务对象: ${request.selectedFeatureTitle}. `
    : '';

  return [
    'Architectural concept visualization for ArchIToken.',
    `${selectedFeature}Module: ${moduleSpec.zhName} / ${moduleSpec.enName}.`,
    `User intent: ${userInput}.`,
    'Style: professional AEC presentation image, realistic material lighting, clear building or interior subject, no text overlay.',
    'Constraints: produce only visual reference material; final engineering documents still require RuleChecker, SchemaValidator and Approver.',
  ].join(' ');
}

function createMessageId(role: OpenClawChatRole): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${role}-${crypto.randomUUID()}`;
  }

  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
