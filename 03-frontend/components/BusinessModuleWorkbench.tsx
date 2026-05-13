// components/BusinessModuleWorkbench.tsx - Backward-compatible workbench entry
// License: Apache-2.0
'use client';

import { ModuleWorkbenchShell } from '@/components/ModuleWorkbenchShell';
import type { ModuleId } from '@/lib/module-registry';

interface BusinessModuleWorkbenchProps {
  initialModuleId?: ModuleId;
  initialRailExpanded?: boolean;
}

export function BusinessModuleWorkbench({
  initialModuleId,
  initialRailExpanded = false,
}: BusinessModuleWorkbenchProps) {
  if (!initialModuleId) {
    return <ModuleWorkbenchShell initialRailExpanded={initialRailExpanded} />;
  }

  return (
    <ModuleWorkbenchShell
      initialModuleId={initialModuleId}
      initialRailExpanded={initialRailExpanded}
    />
  );
}
