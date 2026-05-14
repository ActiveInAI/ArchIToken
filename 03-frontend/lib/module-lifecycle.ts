// lib/module-lifecycle.ts - Module transaction state machine contracts
// License: Apache-2.0

import { activeModuleIds, getModuleSpec, type ModuleId } from './module-registry';
import type { ModuleAuditEvent } from './module-file-system';

export type ModuleTransactionState =
  | 'draft'
  | 'submitted'
  | 'generating'
  | 'evaluating'
  | 'rule_checking'
  | 'schema_validating'
  | 'pending_approval'
  | 'approved'
  | 'archived'
  | 'rejected'
  | 'blocked';

export type ModuleTransactionEvent =
  | 'create'
  | 'submit'
  | 'generate'
  | 'evaluate'
  | 'rule_check'
  | 'validate_schema'
  | 'request_approval'
  | 'approve'
  | 'reject'
  | 'archive'
  | 'reopen'
  | 'block'
  | 'resolve_blocker';

export type ModuleTransactionStatus = 'open' | 'waiting' | 'approved' | 'archived' | 'blocked';

export interface ModuleTransactionApproval {
  id: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  comment: string;
  updatedAt: string;
}

export interface ModuleTransaction {
  id: string;
  moduleId: ModuleId;
  type: string;
  status: ModuleTransactionStatus;
  currentState: ModuleTransactionState;
  actor: string;
  createdAt: string;
  updatedAt: string;
  relatedFileIds: string[];
  relatedArtifactIds: string[];
  approvals: ModuleTransactionApproval[];
  auditTrail: ModuleAuditEvent[];
}

export const lifecycleStates: ModuleTransactionState[] = [
  'draft',
  'submitted',
  'generating',
  'evaluating',
  'rule_checking',
  'schema_validating',
  'pending_approval',
  'approved',
  'archived',
  'rejected',
  'blocked',
];

export const lifecycleEvents: ModuleTransactionEvent[] = [
  'create',
  'submit',
  'generate',
  'evaluate',
  'rule_check',
  'validate_schema',
  'request_approval',
  'approve',
  'reject',
  'archive',
  'reopen',
  'block',
  'resolve_blocker',
];

export const lifecycleStateLabels: Record<ModuleTransactionState, string> = {
  draft: '草稿',
  submitted: '已提交',
  generating: '生成中',
  evaluating: '评估中',
  rule_checking: '规则校核',
  schema_validating: 'Schema 校验',
  pending_approval: '待审批',
  approved: '已通过',
  archived: '已归档',
  rejected: '已驳回',
  blocked: '已阻断',
};

export const lifecycleEventLabels: Record<ModuleTransactionEvent, string> = {
  create: '创建',
  submit: '提交',
  generate: '生成',
  evaluate: '评估',
  rule_check: '规则校核',
  validate_schema: 'Schema 校验',
  request_approval: '发起审批',
  approve: '通过',
  reject: '驳回',
  archive: '归档',
  reopen: '退回修改',
  block: '阻断',
  resolve_blocker: '解除阻断',
};

const transitions: Record<ModuleTransactionState, Partial<Record<ModuleTransactionEvent, ModuleTransactionState>>> = {
  draft: { create: 'draft', submit: 'submitted', generate: 'generating', block: 'blocked' },
  submitted: { generate: 'generating', evaluate: 'evaluating', request_approval: 'pending_approval', reject: 'rejected', block: 'blocked' },
  generating: { evaluate: 'evaluating', rule_check: 'rule_checking', block: 'blocked' },
  evaluating: { rule_check: 'rule_checking', validate_schema: 'schema_validating', request_approval: 'pending_approval', block: 'blocked' },
  rule_checking: { validate_schema: 'schema_validating', request_approval: 'pending_approval', block: 'blocked' },
  schema_validating: { request_approval: 'pending_approval', approve: 'approved', reject: 'rejected', block: 'blocked' },
  pending_approval: { approve: 'approved', reject: 'rejected', reopen: 'draft', block: 'blocked' },
  approved: { archive: 'archived', reopen: 'draft', block: 'blocked' },
  archived: { reopen: 'draft' },
  rejected: { reopen: 'draft', submit: 'submitted' },
  blocked: { resolve_blocker: 'submitted', reopen: 'draft' },
};

export function createLifecycleAudit(actor: string, summary: string): ModuleAuditEvent {
  const at = new Date().toISOString();
  return {
    id: `lifecycle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at,
    actor,
    summary,
  };
}

export function getAllowedLifecycleEvents(state: ModuleTransactionState): ModuleTransactionEvent[] {
  return Object.keys(transitions[state]) as ModuleTransactionEvent[];
}

export function transitionModuleTransaction(
  transaction: ModuleTransaction,
  event: ModuleTransactionEvent,
  actor = 'SessionModuleBackendAdapter',
): ModuleTransaction {
  const nextState = transitions[transaction.currentState][event];
  if (!nextState) {
    return {
      ...transaction,
      auditTrail: [
        createLifecycleAudit(actor, `ignored invalid transition ${event} from ${transaction.currentState}`),
        ...transaction.auditTrail,
      ],
    };
  }

  const status: ModuleTransactionStatus =
    nextState === 'approved'
      ? 'approved'
      : nextState === 'archived'
        ? 'archived'
        : nextState === 'blocked'
          ? 'blocked'
          : nextState === 'pending_approval'
            ? 'waiting'
            : 'open';
  const auditEvent = createLifecycleAudit(actor, `${event} -> ${nextState}`);

  return {
    ...transaction,
    status,
    currentState: nextState,
    actor,
    updatedAt: auditEvent.at,
    auditTrail: [auditEvent, ...transaction.auditTrail].slice(0, 16),
  };
}

export function approveModuleTransaction(
  transaction: ModuleTransaction,
  approver: string,
  comment: string,
): ModuleTransaction {
  const transitioned = transitionModuleTransaction(transaction, 'approve', approver);
  return {
    ...transitioned,
    approvals: transitioned.approvals.map((approval, index) =>
      index === 0
        ? {
            ...approval,
            approver,
            status: 'approved',
            comment,
            updatedAt: transitioned.updatedAt,
          }
        : approval,
    ),
  };
}

export function rejectModuleTransaction(
  transaction: ModuleTransaction,
  approver: string,
  comment: string,
): ModuleTransaction {
  const transitioned = transitionModuleTransaction(transaction, 'reject', approver);
  return {
    ...transitioned,
    approvals: transitioned.approvals.map((approval, index) =>
      index === 0
        ? {
            ...approval,
            approver,
            status: 'rejected',
            comment,
            updatedAt: transitioned.updatedAt,
          }
        : approval,
    ),
  };
}

export function createDefaultModuleTransactions(): ModuleTransaction[] {
  return activeModuleIds.map((moduleId) => {
    const spec = getModuleSpec(moduleId);
    const createdAt = '2026-04-28 09:00';
    return {
      id: `${moduleId}-txn-001`,
      moduleId,
      type: `${spec.zhName} 生命周期事务`,
      status: spec.status === 'active' ? 'waiting' : 'open',
      currentState: spec.status === 'active' ? 'pending_approval' : 'submitted',
      actor: `${spec.zhName} Owner`,
      createdAt,
      updatedAt: createdAt,
      relatedFileIds: [`${moduleId}-root`],
      relatedArtifactIds: spec.artifacts.map((artifact) => artifact.id).slice(0, 2),
      approvals: [
        {
          id: `${moduleId}-approval-001`,
          approver: spec.approvals[0]?.approver ?? '模块负责人',
          status: 'pending',
          comment: '等待业务负责人审阅。',
          updatedAt: createdAt,
        },
      ],
      auditTrail: [createLifecycleAudit('System', `${spec.zhName} default transaction created`)],
    };
  });
}
