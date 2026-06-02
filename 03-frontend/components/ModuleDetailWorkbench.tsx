// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
"use client";

import { AICenterWorkbench } from "@/components/AICenterWorkbench";
import { ConceptDesignStudioWorkbench } from "@/components/ConceptDesignStudioWorkbench";
import { DetailedDesignPlanFinderWorkbench } from "@/components/DetailedDesignPlanFinderWorkbench";
import { DigitalTwinOperationsPanel } from "@/components/DigitalTwinOperationsPanel";
import { FeichuanPlanningWorkbench } from "@/components/FeichuanPlanningWorkbench";
import { FileManagerWorkbench } from "@/components/FileManagerWorkbench";
import { LeadRequirementWorkflowPanel } from "@/components/LeadRequirementWorkflowPanel";
import { PaperclipProductionWorkbench } from "@/components/PaperclipProductionWorkbench";
import { StandardLibrarySemanticDictionaryPanel } from "@/components/StandardLibrarySemanticDictionaryPanel";
import type { ModuleActionResult } from "@/lib/module-actions";
import {
  isStandardLibrarySemanticDictionaryNode,
  type ModuleAuditEvent,
} from "@/lib/module-file-system";
import type { ModuleSpec } from "@/lib/module-registry";

export function ModuleDetailWorkbench({
  spec,
  onAudit,
  onFeatureSelect,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleActionResult["auditEvent"]) => void;
  onFeatureSelect?: (featureTitle: string) => void;
}) {
  function handleAudit(event: ModuleAuditEvent) {
    onAudit?.(event);
  }

  if (spec.id === "ai_center") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<AICenterWorkbench compact onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "digital_twin") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <DigitalTwinOperationsPanel variant="main" onAudit={handleAudit} />
        }
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "planning_management") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<FeichuanPlanningWorkbench onAudit={handleAudit} />}
        showBusinessHomeFileDock={false}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "marketing_service") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <LeadRequirementWorkflowPanel
            moduleId={spec.id}
            onAudit={handleAudit}
          />
        }
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "concept_design") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<ConceptDesignStudioWorkbench onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "detailed_design") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <DetailedDesignPlanFinderWorkbench onAudit={handleAudit} />
        }
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "production_manufacturing") {
    return <PaperclipProductionWorkbench spec={spec} onAudit={handleAudit} />;
  }

  if (spec.id === "standard_library") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        renderFilePreview={(file) =>
          isStandardLibrarySemanticDictionaryNode(file) ? (
            <StandardLibrarySemanticDictionaryPanel onAudit={handleAudit} />
          ) : null
        }
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
