// components/FileManagerWorkbench.tsx - File-first business module workbench
// License: Apache-2.0
"use client";

import type { ReactNode } from "react";
import { ModuleFileExplorer } from "@/components/ModuleFileExplorer";
import type {
  ModuleAuditEvent,
  ModuleFileNode,
} from "@/lib/module-file-system";
import type { ModuleSpec } from "@/lib/module-registry";

export interface BusinessHomeRenderContext {
  currentFolder: ModuleFileNode | null;
  currentFolderId: string;
  rootId: string;
}

export function FileManagerWorkbench({
  spec,
  onAudit,
  businessHome,
  renderBusinessHome,
  businessHomeScope = "root",
  renderFilePreview,
  showBusinessHomeFileDock = false,
  hideBusinessHomeRibbon = true,
  hideBusinessHomeStatusbar = false,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  onFeatureSelect?: (featureTitle: string) => void;
  sidecar?: ReactNode;
  businessHome?: ReactNode;
  renderBusinessHome?: (context: BusinessHomeRenderContext) => ReactNode;
  businessHomeScope?: "root" | "all-folders";
  renderFilePreview?: (file: ModuleFileNode) => ReactNode | null;
  showBusinessHomeFileDock?: boolean;
  hideBusinessHomeRibbon?: boolean;
  hideBusinessHomeStatusbar?: boolean;
}) {
  function handleAudit(event: ModuleAuditEvent) {
    onAudit?.(event);
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <ModuleFileExplorer
        spec={spec}
        onAudit={handleAudit}
        businessHomeScope={businessHomeScope}
        showBusinessHomeFileDock={showBusinessHomeFileDock}
        hideBusinessHomeRibbon={hideBusinessHomeRibbon}
        hideBusinessHomeStatusbar={hideBusinessHomeStatusbar}
        {...(businessHome !== undefined ? { businessHome } : {})}
        {...(renderBusinessHome ? { renderBusinessHome } : {})}
        {...(renderFilePreview ? { renderFilePreview } : {})}
      />
    </section>
  );
}
