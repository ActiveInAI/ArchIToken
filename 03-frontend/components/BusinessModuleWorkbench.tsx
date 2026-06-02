// components/BusinessModuleWorkbench.tsx - Backward-compatible workbench entry
// License: Apache-2.0
"use client";

import { ModuleWorkbenchShell } from "@/components/ModuleWorkbenchShell";
import type { ModuleId } from "@/lib/module-registry";

interface BusinessModuleWorkbenchProps {
  initialModuleId?: ModuleId;
  initialSidebarCompact?: boolean;
  initialOpenDirectoryModuleIds?: ModuleId[] | null;
}

export function BusinessModuleWorkbench({
  initialModuleId,
  initialSidebarCompact = false,
  initialOpenDirectoryModuleIds = null,
}: BusinessModuleWorkbenchProps) {
  if (!initialModuleId) {
    return (
      <ModuleWorkbenchShell
        initialSidebarCompact={initialSidebarCompact}
        initialOpenDirectoryModuleIds={initialOpenDirectoryModuleIds}
      />
    );
  }

  return (
    <ModuleWorkbenchShell
      initialModuleId={initialModuleId}
      initialSidebarCompact={initialSidebarCompact}
      initialOpenDirectoryModuleIds={initialOpenDirectoryModuleIds}
    />
  );
}
