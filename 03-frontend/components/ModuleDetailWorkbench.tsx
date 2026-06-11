// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
"use client";

import { AICenterWorkbench } from "@/components/AICenterWorkbench";
import { BomChainPanel } from "@/components/BomChainPanel";
import { ConceptDesignStudioWorkbench } from "@/components/ConceptDesignStudioWorkbench";
import { DetailedDesignBusinessHome } from "@/components/DetailedDesignBusinessHome";
import { DigitalTwinOperationsPanel } from "@/components/DigitalTwinOperationsPanel";
import { FeichuanPlanningWorkbench } from "@/components/FeichuanPlanningWorkbench";
import { FileManagerWorkbench } from "@/components/FileManagerWorkbench";
import { LeadRequirementWorkflowPanel } from "@/components/LeadRequirementWorkflowPanel";
import { ModuleOperationalPanel } from "@/components/ModuleOperationalPanel";
import { PaperclipProductionWorkbench } from "@/components/PaperclipProductionWorkbench";
import { PersonalCenterWorkbench } from "@/components/PersonalCenterWorkbench";
import { SettingsCenterIamPanel } from "@/components/SettingsCenterIamPanel";
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

  if (spec.id === "personal_center") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<PersonalCenterWorkbench onAudit={handleAudit} />}
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "ai_center") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        renderBusinessHome={({ currentFolder, rootId }) => (
          <AICenterWorkbench
            compact
            onAudit={handleAudit}
            {...(currentFolder && currentFolder.id !== rootId
              ? { activeFolderName: currentFolder.name }
              : {})}
          />
        )}
        businessHomeScope="all-folders"
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
        businessHome={<DetailedDesignBusinessHome onAudit={handleAudit} />}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "production_manufacturing") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <PaperclipProductionWorkbench spec={spec} onAudit={handleAudit} />
        }
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "material_logistics") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<BomChainPanel spec={spec} />}
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "construction_management") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <BomChainPanel
            spec={spec}
            title="施工安装 BOM 链"
            subtitle="消费已发运/已制造件 → 安装任务 → 验收归档；未签收不得安装、未验收不得归档"
            defaultOperation="installation"
          />
        }
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "digital_archive") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <BomChainPanel
            spec={spec}
            title="数字档案 · BOM 归档链"
            subtitle="仅已验收 (accepted) 的施工项可归档；归档包全程可追溯到构件 BOM 真源"
            defaultOperation="archive"
          />
        }
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "settings_center") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={<SettingsCenterIamPanel compact onAudit={handleAudit} />}
        showBusinessHomeFileDock={false}
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "quantity_costing") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <ModuleOperationalPanel spec={spec} onAudit={handleAudit} />
        }
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
  }

  if (spec.id === "finance_management") {
    return (
      <FileManagerWorkbench
        spec={spec}
        onAudit={handleAudit}
        businessHome={
          <ModuleOperationalPanel spec={spec} onAudit={handleAudit} />
        }
        showBusinessHomeFileDock={false}
        hideBusinessHomeStatusbar
        {...(onFeatureSelect ? { onFeatureSelect } : {})}
      />
    );
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
