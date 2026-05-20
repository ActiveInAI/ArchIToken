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
import type { ModuleSpec } from '@/lib/module-registry';

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
        businessHome={<LeadRequirementWorkflowPanel moduleId={spec.id} onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  return (
    <FileManagerWorkbench
      spec={spec}
      onAudit={handleAudit}
      {...(onFeatureSelect ? { onFeatureSelect } : {})}
    />
  );
}
