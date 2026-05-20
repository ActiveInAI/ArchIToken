// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
'use client';

import { AICenterWorkbench } from '@/components/AICenterWorkbench';
import { DigitalTwinOperationsPanel } from '@/components/DigitalTwinOperationsPanel';
import { FileManagerWorkbench } from '@/components/FileManagerWorkbench';
import { LeadRequirementWorkflowPanel } from '@/components/LeadRequirementWorkflowPanel';
import { ProjectPlanningStudio } from '@/components/ProjectPlanningStudio';
import type { ModuleActionResult } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import { moduleRegistry, type ModuleId, type ModuleSpec } from '@/lib/module-registry';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

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
  const businessFlow = <ModuleBusinessFlowRibbon spec={spec} />;

  if (spec.id === 'ai_center') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessFlow={businessFlow}
        businessHome={<AICenterWorkbench compact onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === 'digital_twin') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessFlow={businessFlow}
        businessHome={<DigitalTwinOperationsPanel variant="main" onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === 'planning_management') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessFlow={businessFlow}
        businessHome={<ProjectPlanningStudio onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === 'marketing_service' || spec.id === 'concept_design') {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessFlow={businessFlow}
        businessHome={<LeadRequirementWorkflowPanel moduleId={spec.id} onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  return (
    <FileManagerWorkbench
      spec={spec}
      onAudit={handleAudit}
      businessFlow={businessFlow}
      {...(onFeatureSelect ? { onFeatureSelect } : {})}
    />
  );
}

function ModuleBusinessFlowRibbon({ spec }: { spec: ModuleSpec }) {
  const upstream = resolveModules(spec.inputs);
  const downstream = resolveModules(spec.outputs);
  const currentData = spec.dataObjects.slice(0, 3);

  return (
    <section className="arch-huly-row flex min-w-0 items-center gap-3 rounded-md border px-3 py-2">
      <div className="shrink-0">
        <p className="arch-primary-text font-mono arch-type-eyebrow font-medium">业务流</p>
        <p className="arch-text arch-type-caption">{spec.zhName}</p>
      </div>
      <FlowModuleGroup label="上游" modules={upstream} fallback="业务起点" />
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--arch-text-muted)]" />
      <div className="min-w-0 flex-1 rounded-md border arch-border bg-[var(--arch-surface-muted)] px-3 py-2">
        <p className="arch-primary-text arch-type-caption">当前处理对象</p>
        <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
          {(currentData.length > 0 ? currentData : [spec.visualization.title]).map((item) => (
            <span key={item} className="arch-chip rounded-md border px-2 py-1 arch-type-caption font-medium">
              {item}
            </span>
          ))}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--arch-text-muted)]" />
      <FlowModuleGroup label="下游" modules={downstream} fallback="归档/治理" />
    </section>
  );
}

function FlowModuleGroup({
  label,
  modules,
  fallback,
}: {
  label: string;
  modules: ModuleSpec[];
  fallback: string;
}) {
  return (
    <div className="min-w-[180px] max-w-[280px] rounded-md border arch-border bg-[var(--arch-surface)] px-3 py-2">
      <p className="arch-primary-text arch-type-caption">{label}</p>
      <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
        {modules.length > 0 ? (
          modules.slice(0, 3).map((module) => (
            <Link
              key={module.id}
              href={module.routeHref}
              className="arch-chip rounded-md border px-2 py-1 arch-type-caption font-medium hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
            >
              {module.zhName}
            </Link>
          ))
        ) : (
          <span className="arch-muted arch-type-caption">{fallback}</span>
        )}
      </div>
    </div>
  );
}

function resolveModules(ids: ModuleId[]): ModuleSpec[] {
  return ids.map((id) => moduleRegistry[id]).filter((module): module is ModuleSpec => Boolean(module));
}
