// components/ApprovalWorkflowPanel.tsx - Approval workflow controls
// License: Apache-2.0
'use client';

import { Check, RotateCcw, X } from 'lucide-react';
import { moduleBackendAdapter } from '@/lib/module-backend-adapter';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import type { ModuleTransaction } from '@/lib/module-lifecycle';

export function ApprovalWorkflowPanel({
  transaction,
  onRefresh,
  onAudit,
}: {
  transaction: ModuleTransaction | null;
  onRefresh: () => void;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const approval = transaction?.approvals[0] ?? null;

  function approve() {
    if (!transaction) {
      return;
    }
    const result = moduleBackendAdapter.approveTransaction(transaction.id, approval?.approver ?? '业务负责人', '前端审批通过。');
    onAudit?.(result.auditEvent);
    onRefresh();
  }

  function reject() {
    if (!transaction) {
      return;
    }
    const result = moduleBackendAdapter.rejectTransaction(transaction.id, approval?.approver ?? '业务负责人', '前端驳回,需要补齐证据。');
    onAudit?.(result.auditEvent);
    onRefresh();
  }

  function returnToEdit() {
    if (!transaction) {
      return;
    }
    const result = moduleBackendAdapter.transitionTransaction(transaction.id, 'reopen');
    onAudit?.(result.auditEvent);
    onRefresh();
  }

  return (
    <section className="arch-huly-row rounded-lg p-4">
      <p className="arch-primary-text font-mono arch-type-eyebrow">
        Approval workflow
      </p>
      <h3 className="mt-1 arch-type-page font-black">审批</h3>
      {transaction && approval ? (
        <>
          <div className="mt-4 space-y-2">
            <ApprovalRow label="当前审批人" value={approval.approver} />
            <ApprovalRow label="审批状态" value={approval.status} />
            <ApprovalRow label="审批意见" value={approval.comment} />
            <ApprovalRow label="事务状态" value={transaction.currentState} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={approve}
              className="arch-btn-primary inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 arch-type-caption font-black"
            >
              <Check className="h-3.5 w-3.5" />
              通过
            </button>
            <button
              type="button"
              onClick={reject}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-red-500 px-2 py-2 arch-type-caption font-black text-white"
            >
              <X className="h-3.5 w-3.5" />
              驳回
            </button>
            <button
              type="button"
              onClick={returnToEdit}
              className="arch-btn inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 arch-type-caption font-black"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              退回
            </button>
          </div>
        </>
      ) : (
        <p className="arch-muted mt-3 arch-type-body leading-6">暂无审批事务。</p>
      )}
    </section>
  );
}

function ApprovalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-huly-row-muted flex items-start justify-between gap-3 rounded-md px-3 py-2 arch-type-caption">
      <span className="arch-muted">{label}</span>
      <span className="arch-text max-w-[68%] text-right font-bold">{value}</span>
    </div>
  );
}
