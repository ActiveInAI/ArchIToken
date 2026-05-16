// components/StateMachinePanel.tsx - Transaction state machine visualization
// License: Apache-2.0
'use client';

import { lifecycleStateLabels, lifecycleStates, type ModuleTransaction } from '@/lib/module-lifecycle';

export function StateMachinePanel({ transaction }: { transaction: ModuleTransaction | null }) {
  return (
    <section className="arch-card rounded-lg p-4">
      <p className="arch-primary-text font-mono text-[10px]">
        State machine
      </p>
      <h3 className="mt-1 text-xl font-black">状态机</h3>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {lifecycleStates.map((state) => {
          const active = transaction?.currentState === state;
          return (
            <div
              key={state}
              className={`rounded-md border px-3 py-2 ${
                active
                  ? 'arch-btn-primary'
                  : 'arch-card-muted'
              }`}
            >
              <p className="text-xs font-black">{lifecycleStateLabels[state]}</p>
              <p className="mt-1 font-mono text-[10px] opacity-70">
                {state}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
