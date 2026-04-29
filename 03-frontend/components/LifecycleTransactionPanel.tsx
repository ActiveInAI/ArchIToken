// components/LifecycleTransactionPanel.tsx - Lifecycle transaction controls
// License: Apache-2.0
'use client';

import { GitBranch, Plus } from 'lucide-react';
import { moduleBackendAdapter } from '@/lib/module-backend-adapter';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import {
  getAllowedLifecycleEvents,
  lifecycleEventLabels,
  lifecycleStateLabels,
  type ModuleTransaction,
} from '@/lib/module-lifecycle';
import type { ModuleId } from '@/lib/module-registry';

export function LifecycleTransactionPanel({
  moduleId,
  transactions,
  selectedTransactionId,
  onSelect,
  onRefresh,
  onAudit,
}: {
  moduleId: ModuleId;
  transactions: ModuleTransaction[];
  selectedTransactionId: string | null;
  onSelect: (transactionId: string) => void;
  onRefresh: () => void;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const selectedTransaction = transactions.find((transaction) => transaction.id === selectedTransactionId) ?? transactions[0] ?? null;
  const allowedEvents = selectedTransaction ? getAllowedLifecycleEvents(selectedTransaction.currentState) : [];

  function createTransaction() {
    const result = moduleBackendAdapter.createTransaction({
      moduleId,
      type: '前端新建生命周期事务',
    });
    onAudit?.(result.auditEvent);
    onSelect(result.transaction.id);
    onRefresh();
  }

  function transition(event: (typeof allowedEvents)[number]) {
    if (!selectedTransaction) {
      return;
    }
    const result = moduleBackendAdapter.transitionTransaction(selectedTransaction.id, event);
    onAudit?.(result.auditEvent);
    onSelect(result.transaction.id);
    onRefresh();
  }

  return (
    <section className="arch-card rounded-[1.4rem] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.24em]">
            Lifecycle transactions
          </p>
          <h3 className="mt-1 text-xl font-black">事务</h3>
        </div>
        <button
          type="button"
          onClick={createTransaction}
          className="arch-btn-primary flex h-9 w-9 items-center justify-center rounded-xl"
          aria-label="创建事务"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {transactions.map((transaction) => (
          <button
            key={transaction.id}
            type="button"
            onClick={() => onSelect(transaction.id)}
            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
              transaction.id === selectedTransaction?.id
                ? 'arch-card-selected'
                : 'arch-card-muted hover:border-[var(--arch-primary)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-black">{transaction.type}</span>
              <GitBranch className="arch-primary-text h-4 w-4" />
            </div>
            <p className="arch-muted mt-1 text-xs">
              {lifecycleStateLabels[transaction.currentState]} · {transaction.status}
            </p>
          </button>
        ))}
      </div>

      {selectedTransaction ? (
        <div className="arch-card-muted mt-4 rounded-2xl p-3">
          <p className="arch-muted text-xs">可触发事件</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedEvents.map((event) => (
              <button
                key={event}
                type="button"
                onClick={() => transition(event)}
                className="arch-btn rounded-xl px-3 py-2 text-xs font-black transition"
              >
                {lifecycleEventLabels[event]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
