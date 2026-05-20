// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
'use client';

import { AICenterWorkbench } from '@/components/AICenterWorkbench';
import { DigitalTwinOperationsPanel } from '@/components/DigitalTwinOperationsPanel';
import { FileManagerWorkbench } from '@/components/FileManagerWorkbench';
import { InsomeModuleWorkbench } from '@/components/InsomeModuleWorkbench';
import { ProjectPlanningStudio } from '@/components/ProjectPlanningStudio';
import type { ModuleActionResult } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import type { ModuleSpec } from '@/lib/module-registry';
import {
  aiServiceTokenRules,
  getAiCommercializationForModule,
  getSteelComponentStatesForModule,
  getSteelLifecycleStagesForModule,
  getSteelWorkflowChainsForModule,
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
        businessHome={<DigitalTwinOperationsPanel variant="main" onAudit={handleAudit} />}
        sidecar={<ModuleBlueprintSidecar spec={spec} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === 'marketing_service' || spec.id === 'concept_design') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<InsomeModuleWorkbench moduleId={spec.id} onAudit={handleAudit} />}
        sidecar={<ModuleBlueprintSidecar spec={spec} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === 'planning_management') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<ProjectPlanningStudio onAudit={handleAudit} />}
        sidecar={<ModuleBlueprintSidecar spec={spec} />}
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
  const workflowChains = getSteelWorkflowChainsForModule(spec.id);
  const fallbackGate = gates[0] ?? null;

  return (
    <section className="space-y-3 p-3">
      <div className="arch-huly-row-muted rounded-lg p-3">
        <p className="arch-primary-text font-mono arch-type-eyebrow font-medium">
          STEEL EXECUTION BLUEPRINT
        </p>
        <h3 className="arch-text mt-1 arch-type-body font-medium">
          钢结构一体化执行锚点
        </h3>
        <p className="arch-muted mt-2 arch-type-caption leading-5">
          当前模块按 {steelSourceDocuments.map((doc) => doc.id).join(' / ')} 绑定生产关口、构件状态、AI产品化和Token合规边界。
        </p>
      </div>

      {workflowChains.length > 0 ? (
        <div className="grid gap-2">
          {workflowChains.slice(0, 2).map((chain) => (
            <div key={chain.id} className="arch-huly-row rounded-lg p-3">
              <p className="arch-primary-text arch-type-caption font-medium">
                {chain.sourceDocumentId}
              </p>
              <h4 className="arch-text mt-1 arch-type-body font-medium">
                {chain.title}
              </h4>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chain.dataObjects.slice(0, 4).map((item) => (
                  <span key={item} className="arch-huly-row-muted rounded-md px-2 py-1 arch-type-caption font-medium">
                    {item}
                  </span>
                ))}
              </div>
              <p className="arch-muted mt-3 arch-type-caption leading-5">{chain.revenueMode}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2">
        {(gates.length ? gates : steelSourceDocuments.slice(0, 1).map((doc) => ({
          gate: doc.id,
          name: doc.role,
          owner: '平台治理',
          evidence: doc.anchors.slice(0, 3),
          exitRule: doc.title,
        }))).map((gate) => (
          <div key={`${gate.gate}-${gate.name}`} className="arch-huly-row rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="arch-primary-text arch-type-caption font-medium">{gate.gate}</p>
                <h4 className="arch-text mt-0.5 font-medium">{gate.name}</h4>
              </div>
              <span className="arch-chip rounded-md border px-2 py-1 arch-type-caption font-medium">
                {gate.owner}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {gate.evidence.slice(0, 4).map((item) => (
                <span key={item} className="arch-huly-row-muted rounded-md px-2 py-1 arch-type-caption font-medium">
                  {item}
                </span>
              ))}
            </div>
            <p className="arch-muted mt-3 arch-type-caption leading-5">{gate.exitRule}</p>
          </div>
        ))}
      </div>

      {componentStates.length > 0 ? (
        <div className="arch-huly-row rounded-lg p-3">
          <p className="arch-primary-text arch-type-caption font-medium">构件状态码</p>
          <div className="mt-2 grid gap-2">
            {componentStates.map((state) => (
              <div key={state.code} className="arch-huly-row-muted rounded-md px-3 py-2">
                <p className="arch-text arch-type-body font-medium">
                  {state.code} · {state.label}
                </p>
                <p className="arch-muted mt-1 arch-type-caption leading-5">{state.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {aiCapability ? (
        <div className="arch-huly-row rounded-lg p-3">
          <p className="arch-primary-text arch-type-caption font-medium">AI商业化能力</p>
          <h4 className="arch-text mt-1 arch-type-body font-medium">{aiCapability.product}</h4>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {aiCapability.aiJobs.map((job) => (
              <span key={job} className="arch-huly-row-muted rounded-md px-2 py-1 arch-type-caption font-medium">
                {job}
              </span>
            ))}
          </div>
          <p className="arch-muted mt-3 arch-type-caption leading-5">{aiCapability.monetization}</p>
        </div>
      ) : null}

      <div className="arch-huly-row-muted rounded-lg p-3">
        <p className="arch-primary-text arch-type-caption font-medium">Token合规边界</p>
        <div className="mt-2 grid gap-2">
          {aiServiceTokenRules.map((rule) => (
            <div key={rule.title} className="arch-huly-row rounded-md px-3 py-2">
              <p className="arch-text arch-type-caption font-medium">{rule.title}</p>
              <p className="arch-muted mt-1 arch-type-caption leading-5">
                {rule.items.join(' / ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {fallbackGate ? (
        <p className="arch-muted px-1 arch-type-caption leading-5">
          当前模块至少绑定 {fallbackGate.gate} 生产关口，所有AI输出仅作为建议，正式报价、结构、税务、施工安全和人力决策必须进入人工审批链。
        </p>
      ) : null}
    </section>
  );
}
