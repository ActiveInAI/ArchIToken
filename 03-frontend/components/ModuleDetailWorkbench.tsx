// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
"use client";

import dynamic from "next/dynamic";
import { FileManagerWorkbench } from "@/components/FileManagerWorkbench";
import type { ModuleActionResult } from "@/lib/module-actions";
import {
  isStandardLibrarySemanticDictionaryNode,
  isStandardLibraryNamingRulesNode,
  type ModuleAuditEvent,
} from "@/lib/module-file-system";
import type { ModuleSpec } from "@/lib/module-registry";

// 各模块业务工作台按需加载：避免把全部模块打进同一个客户端 chunk，
// 否则任何一个工作台源码变更都会让所有目录导航重新编译/下载整个集合。
function WorkbenchLoading() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm opacity-70">
      模块工作台加载中…
    </div>
  );
}


const AICenterWorkbench = dynamic(
  () => import("@/components/AICenterWorkbench").then((m) => m.AICenterWorkbench),
  { ssr: false, loading: WorkbenchLoading },
);
const BomChainPanel = dynamic(
  () => import("@/components/BomChainPanel").then((m) => m.BomChainPanel),
  { ssr: false, loading: WorkbenchLoading },
);
const ConceptDesignStudioWorkbench = dynamic(
  () =>
    import("@/components/ConceptDesignStudioWorkbench").then(
      (m) => m.ConceptDesignStudioWorkbench,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const DetailedDesignBusinessHome = dynamic(
  () =>
    import("@/components/DetailedDesignBusinessHome").then(
      (m) => m.DetailedDesignBusinessHome,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const DigitalTwinOperationsPanel = dynamic(
  () =>
    import("@/components/DigitalTwinOperationsPanel").then(
      (m) => m.DigitalTwinOperationsPanel,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const FeichuanPlanningWorkbench = dynamic(
  () =>
    import("@/components/FeichuanPlanningWorkbench").then(
      (m) => m.FeichuanPlanningWorkbench,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const LeadRequirementWorkflowPanel = dynamic(
  () =>
    import("@/components/LeadRequirementWorkflowPanel").then(
      (m) => m.LeadRequirementWorkflowPanel,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const ModuleOperationalPanel = dynamic(
  () =>
    import("@/components/ModuleOperationalPanel").then(
      (m) => m.ModuleOperationalPanel,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const PaperclipProductionWorkbench = dynamic(
  () =>
    import("@/components/PaperclipProductionWorkbench").then(
      (m) => m.PaperclipProductionWorkbench,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const PersonalCenterWorkbench = dynamic(
  () =>
    import("@/components/PersonalCenterWorkbench").then(
      (m) => m.PersonalCenterWorkbench,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const SettingsCenterIamPanel = dynamic(
  () =>
    import("@/components/SettingsCenterIamPanel").then(
      (m) => m.SettingsCenterIamPanel,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const StandardLibrarySemanticDictionaryPanel = dynamic(
  () =>
    import("@/components/StandardLibrarySemanticDictionaryPanel").then(
      (m) => m.StandardLibrarySemanticDictionaryPanel,
    ),
  { ssr: false, loading: WorkbenchLoading },
);
const StandardLibraryNamingRulesPanel = dynamic(
  () =>
    import("@/components/StandardLibraryNamingRulesPanel").then(
      (m) => m.StandardLibraryNamingRulesPanel,
    ),
  { ssr: false, loading: WorkbenchLoading },
);

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
          ) : isStandardLibraryNamingRulesNode(file) ? (
            <StandardLibraryNamingRulesPanel onAudit={handleAudit} />
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
