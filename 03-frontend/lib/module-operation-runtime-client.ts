// lib/module-operation-runtime-client.ts - Frontend client for global module operation runtime
// License: Apache-2.0

import type { ModuleId } from "./module-registry";

export type ModuleOperationRuntimeStatus =
  | "requested"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "professional_review_required";

export interface RecordModuleOperationRuntimeInput {
  moduleId: ModuleId;
  operationId?: string;
  operationKey?: string;
  operationLabel: string;
  actor?: string;
  operationKind?: string;
  status?: ModuleOperationRuntimeStatus;
  sourceSurface?: string;
  targetType?: string;
  targetId?: string;
  idempotencyKey?: string;
  requestPayload?: Record<string, unknown>;
  resultPayload?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

export interface ModuleOperationRuntimeRun {
  operationRunId: string;
  tenantId: string;
  projectId: string;
  moduleId: ModuleId;
  operationSurface: string;
  operationKey: string;
  operationLabel: string;
  operationKind: string;
  status: ModuleOperationRuntimeStatus;
  actor: string;
  sourceSurface: string;
  targetType: string;
  targetId: string;
  idempotencyKey: string;
  requestPayload: Record<string, unknown>;
  resultPayload: Record<string, unknown>;
  evidence: Record<string, unknown>;
  professionalState: string;
  approvalState: string;
  eventId: string | null;
  auditEventId: string | null;
  graphEdgeId: string | null;
  createdAt: string;
  updatedAt: string;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function normalizeModuleOperationKey(
  moduleId: ModuleId,
  operationId: string,
): string {
  const normalizedOperation = operationId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_:. -]+|[_:. -]+$/g, "");
  const key = `${moduleId}.${normalizedOperation || "ui_operation"}`;
  return key.slice(0, 128);
}

export function makeModuleOperationIdempotencyKey(
  moduleId: ModuleId,
  operationId: string,
  suffix = uniqueRuntimeSuffix(),
): string {
  return `frontend:${moduleId}:${operationId}:${suffix}`.slice(0, 200);
}

export async function recordModuleOperationRuntime(
  input: RecordModuleOperationRuntimeInput,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<ModuleOperationRuntimeRun> {
  const operationId = input.operationId ?? input.operationKey ?? "ui_operation";
  const operationKey =
    input.operationKey ??
    normalizeModuleOperationKey(input.moduleId, operationId);
  const payload = {
    moduleId: input.moduleId,
    operationKey,
    operationLabel: input.operationLabel.slice(0, 200),
    operationKind: input.operationKind ?? "module_business_operation",
    status: input.status ?? "completed",
    actor: input.actor ?? "ModuleOperationalPanel",
    sourceSurface: input.sourceSurface ?? "module_operational_panel",
    targetType: input.targetType ?? "module",
    targetId: input.targetId ?? input.moduleId,
    idempotencyKey:
      input.idempotencyKey ??
      makeModuleOperationIdempotencyKey(input.moduleId, operationId),
    requestPayload: input.requestPayload ?? {},
    resultPayload: input.resultPayload ?? {},
    evidence: input.evidence ?? {},
  };

  const response = await fetchImpl("/api/database-manager/module-operations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `module operation runtime write failed: ${response.status} ${detail}`,
    );
  }

  return (await response.json()) as ModuleOperationRuntimeRun;
}

function uniqueRuntimeSuffix(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
