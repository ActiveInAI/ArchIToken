// Backend transaction and audit API client for module workbench runtime.
// License: Apache-2.0

import {
  backendRequest,
  buildQuery,
  shouldAttemptBackendSync,
} from "./backend-api";
import type { ModuleAuditEvent } from "./module-file-system";
import {
  type ModuleTransaction,
  type ModuleTransactionApproval,
  type ModuleTransactionEvent,
  type ModuleTransactionState,
  type ModuleTransactionStatus,
} from "./module-lifecycle";
import type { ModuleId } from "./module-registry";

type BackendTransactionStatus = ModuleTransactionState;

interface BackendModuleApproval {
  id: string;
  transactionId: string;
  approver: string;
  decision: "approved" | "rejected";
  comment?: string | null;
  decidedAt: string;
}

interface BackendModuleTransaction {
  id: string;
  moduleId: string;
  transactionType: string;
  status: BackendTransactionStatus;
  actor: string;
  createdAt: string;
  updatedAt: string;
  relatedFileIds: string[];
  relatedArtifactIds: string[];
  approvals: BackendModuleApproval[];
}

interface BackendTransactionListResponse {
  transactions: BackendModuleTransaction[];
  total: number;
}

interface BackendAuditEvent {
  id: string;
  moduleId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

interface BackendAuditListResponse {
  events: BackendAuditEvent[];
  total: number;
}

const persistedOperationAuditIds = new Set<string>();

function toWorkbenchStatus(
  status: BackendTransactionStatus,
): ModuleTransactionStatus {
  if (status === "pending_approval") {
    return "waiting";
  }
  if (status === "approved") {
    return "approved";
  }
  if (status === "archived") {
    return "archived";
  }
  if (status === "blocked" || status === "rejected") {
    return "blocked";
  }
  return "open";
}

function mapBackendApproval(
  approval: BackendModuleApproval,
): ModuleTransactionApproval {
  return {
    id: approval.id,
    approver: approval.approver,
    status: approval.decision,
    comment: approval.comment ?? "",
    updatedAt: approval.decidedAt,
  };
}

function transactionAuditEvent(
  transaction: BackendModuleTransaction,
): ModuleAuditEvent {
  return {
    id: `backend-transaction-${transaction.id}-${transaction.updatedAt}`,
    at: transaction.updatedAt,
    actor: transaction.actor,
    summary: `后端事务 ${transaction.transactionType} -> ${transaction.status}`,
  };
}

export function mapBackendModuleTransaction(
  transaction: BackendModuleTransaction,
): ModuleTransaction {
  const auditEvent = transactionAuditEvent(transaction);
  return {
    id: transaction.id,
    moduleId: transaction.moduleId as ModuleId,
    type: transaction.transactionType,
    status: toWorkbenchStatus(transaction.status),
    currentState: transaction.status,
    actor: transaction.actor,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    relatedFileIds: transaction.relatedFileIds,
    relatedArtifactIds: transaction.relatedArtifactIds,
    approvals:
      transaction.approvals.length > 0
        ? transaction.approvals.map(mapBackendApproval)
        : [
            {
              id: `backend-approval-pending-${transaction.id}`,
              approver: "业务负责人",
              status: "pending",
              comment: "等待审批。",
              updatedAt: transaction.updatedAt,
            },
          ],
    auditTrail: [auditEvent],
  };
}

function mapBackendAuditEvent(event: BackendAuditEvent): ModuleAuditEvent {
  return {
    id: event.id,
    at: event.createdAt,
    actor: event.actor,
    summary: event.summary,
  };
}

export async function listModuleTransactions(
  moduleId: ModuleId,
): Promise<ModuleTransaction[]> {
  const query = buildQuery({ module_id: moduleId, limit: 200 });
  const response = await backendRequest<BackendTransactionListResponse>(
    `/v1/transactions${query}`,
    { cache: "no-store" },
  );
  return response.transactions.map(mapBackendModuleTransaction);
}

export async function createModuleTransaction(input: {
  moduleId: ModuleId;
  transactionType: string;
  actor?: string;
  relatedFileIds?: string[];
  relatedArtifactIds?: string[];
}): Promise<ModuleTransaction> {
  const transaction = await backendRequest<BackendModuleTransaction>(
    "/v1/transactions",
    {
      method: "POST",
      body: JSON.stringify({
        moduleId: input.moduleId,
        transactionType: input.transactionType,
        actor: input.actor,
        relatedFileIds: input.relatedFileIds,
        relatedArtifactIds: input.relatedArtifactIds,
      }),
    },
  );
  return mapBackendModuleTransaction(transaction);
}

export async function transitionModuleTransaction(input: {
  transactionId: string;
  event: ModuleTransactionEvent;
  actor?: string;
  comment?: string;
}): Promise<ModuleTransaction> {
  const transaction = await backendRequest<BackendModuleTransaction>(
    `/v1/transactions/${encodeURIComponent(input.transactionId)}/transition`,
    {
      method: "POST",
      body: JSON.stringify({
        event: input.event,
        actor: input.actor,
        comment: input.comment,
      }),
    },
  );
  return mapBackendModuleTransaction(transaction);
}

export async function approveModuleTransaction(input: {
  transactionId: string;
  actor: string;
  comment?: string;
}): Promise<ModuleTransaction> {
  const transaction = await backendRequest<BackendModuleTransaction>(
    `/v1/transactions/${encodeURIComponent(input.transactionId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        actor: input.actor,
        comment: input.comment,
      }),
    },
  );
  return mapBackendModuleTransaction(transaction);
}

export async function rejectModuleTransaction(input: {
  transactionId: string;
  actor: string;
  comment?: string;
}): Promise<ModuleTransaction> {
  const transaction = await backendRequest<BackendModuleTransaction>(
    `/v1/transactions/${encodeURIComponent(input.transactionId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        actor: input.actor,
        comment: input.comment,
      }),
    },
  );
  return mapBackendModuleTransaction(transaction);
}

export async function listModuleAuditEvents(
  moduleId: ModuleId,
): Promise<ModuleAuditEvent[]> {
  const query = buildQuery({ module_id: moduleId, limit: 200 });
  const response = await backendRequest<BackendAuditListResponse>(
    `/v1/audit-events${query}`,
    { cache: "no-store" },
  );
  return response.events.map(mapBackendAuditEvent);
}

export async function persistModuleOperationAudit(input: {
  moduleId: ModuleId;
  event: ModuleAuditEvent;
  source?: string;
}): Promise<ModuleTransaction | null> {
  if (!shouldAttemptBackendSync() || input.event.id.startsWith("backend-")) {
    return null;
  }

  const summary = input.event.summary.trim();
  if (!summary || persistedOperationAuditIds.has(input.event.id)) {
    return null;
  }

  persistedOperationAuditIds.add(input.event.id);
  try {
    return await createModuleTransaction({
      moduleId: input.moduleId,
      transactionType: summary.slice(0, 240),
      actor: input.event.actor || "ModuleWorkbench",
      relatedArtifactIds: [
        `audit:${input.event.id}`,
        `source:${input.source ?? "module-workbench"}`,
      ],
    });
  } catch {
    persistedOperationAuditIds.delete(input.event.id);
    return null;
  }
}

export const moduleTransactionApiClient = {
  listModuleTransactions,
  createModuleTransaction,
  transitionModuleTransaction,
  approveModuleTransaction,
  rejectModuleTransaction,
  listModuleAuditEvents,
  persistModuleOperationAudit,
};
