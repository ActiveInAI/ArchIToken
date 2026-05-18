// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
'use client';

import { AICenterWorkbench } from '@/components/AICenterWorkbench';
import { DigitalTwinOperationsPanel } from '@/components/DigitalTwinOperationsPanel';
import { FileManagerWorkbench } from '@/components/FileManagerWorkbench';
import type { ModuleActionResult } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import type { ModuleSpec } from '@/lib/module-registry';
import {
  aiServiceTokenRules,
  getAiCommercializationForModule,
  getSteelComponentStatesForModule,
  getSteelLifecycleStagesForModule,
  steelSourceDocuments,
} from '@/lib/steel-business-blueprint';

export function ModuleDetailWorkbench({
  spec,
  onAudit,
  onFeatureSelect,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleActionResult['auditEvent']) => void;
  onFeatureSelect?: (featureTitle: string) => void;
}) {
  function handleAudit(event: ModuleAuditEvent) {
    onAudit?.(event);
  }

  if (spec.id === 'ai_center') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        sidecar={
          <>
            <AICenterWorkbench compact onAudit={handleAudit} />
            <ModuleBlueprintSidecar spec={spec} />
          </>
        }
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === 'digital_twin') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        sidecar={
          <>
            <DigitalTwinOperationsPanel onAudit={handleAudit} />
            <ModuleBlueprintSidecar spec={spec} />
          </>
        }
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  return (
    <FileManagerWorkbench
      spec={spec}
      onAudit={handleAudit}
      sidecar={<ModuleBlueprintSidecar spec={spec} />}
      {...(onFeatureSelect ? { onFeatureSelect } : {})}
    />
  );
}

function ModuleBlueprintSidecar({ spec }: { spec: ModuleSpec }) {
  const gates = getSteelLifecycleStagesForModule(spec.id);
  const componentStates = getSteelComponentStatesForModule(spec.id);
  const aiCapability = getAiCommercializationForModule(spec.id);
  const fallbackGate = gates[0] ?? null;

  return (
    <section className="space-y-3 p-3">
      <div className="arch-card-muted rounded-lg p-3">
        <p className="arch-primary-text font-mono text-[10px] font-black">
          STEEL EXECUTION BLUEPRINT
        </p>
        <h3 className="arch-text mt-1 text-sm font-black">
          钢结构一体化执行锚点
        </h3>
        <p className="arch-muted mt-2 text-xs leading-5">
          当前模块按 {steelSourceDocuments.map((doc) => doc.id).join(' / ')} 绑定生产关口、构件状态、AI产品化和Token合规边界。
        </p>
      </div>

      <div className="grid gap-2">
        {(gates.length ? gates : steelSourceDocuments.slice(0, 1).map((doc) => ({
          gate: doc.id,
          name: doc.role,
          owner: '平台治理',
          evidence: doc.anchors.slice(0, 3),
          exitRule: doc.title,
        }))).map((gate) => (
          <div key={`${gate.gate}-${gate.name}`} className="arch-card rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="arch-primary-text text-xs font-black">{gate.gate}</p>
                <h4 className="arch-text mt-0.5 font-black">{gate.name}</h4>
              </div>
              <span className="arch-chip rounded-md border px-2 py-1 text-[11px] font-black">
                {gate.owner}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {gate.evidence.slice(0, 4).map((item) => (
                <span key={item} className="arch-card-muted rounded-md px-2 py-1 text-[11px] font-bold">
                  {item}
                </span>
              ))}
            </div>
            <p className="arch-muted mt-3 text-xs leading-5">{gate.exitRule}</p>
          </div>
        ))}
      </div>

      {componentStates.length > 0 ? (
        <div className="arch-card rounded-lg p-3">
          <p className="arch-primary-text text-xs font-black">构件状态码</p>
          <div className="mt-2 grid gap-2">
            {componentStates.map((state) => (
              <div key={state.code} className="arch-card-muted rounded-md px-3 py-2">
                <p className="arch-text text-sm font-black">
                  {state.code} · {state.label}
                </p>
                <p className="arch-muted mt-1 text-xs leading-5">{state.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {aiCapability ? (
        <div className="arch-card rounded-lg p-3">
          <p className="arch-primary-text text-xs font-black">AI商业化能力</p>
          <h4 className="arch-text mt-1 text-sm font-black">{aiCapability.product}</h4>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {aiCapability.aiJobs.map((job) => (
              <span key={job} className="arch-card-muted rounded-md px-2 py-1 text-[11px] font-bold">
                {job}
              </span>
            ))}
          </div>
          <p className="arch-muted mt-3 text-xs leading-5">{aiCapability.monetization}</p>
        </div>
      ) : null}

      <div className="arch-card-muted rounded-lg p-3">
        <p className="arch-primary-text text-xs font-black">Token合规边界</p>
        <div className="mt-2 grid gap-2">
          {aiServiceTokenRules.map((rule) => (
            <div key={rule.title} className="arch-card rounded-md px-3 py-2">
              <p className="arch-text text-xs font-black">{rule.title}</p>
              <p className="arch-muted mt-1 text-[11px] leading-5">
                {rule.items.join(' / ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {fallbackGate ? (
        <p className="arch-muted px-1 text-[11px] leading-5">
          当前模块至少绑定 {fallbackGate.gate} 生产关口，所有AI输出仅作为建议，正式报价、结构、税务、施工安全和人力决策必须进入人工审批链。
        </p>
      ) : null}
    </section>
  );
}
