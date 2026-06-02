// components/BusinessModuleWorkbench.tsx - Backward-compatible workbench entry
// License: Apache-2.0
'use client';

import { ModuleWorkbenchShell } from '@/components/ModuleWorkbenchShell';
import type { ModuleId } from '@/lib/module-registry';

interface BusinessModuleWorkbenchProps {
  initialModuleId?: ModuleId;
}

export function BusinessModuleWorkbench({
  initialModuleId,
}: BusinessModuleWorkbenchProps) {
  if (!initialModuleId) {
    return <ModuleWorkbenchShell />;
  }

  return <ModuleWorkbenchShell initialModuleId={initialModuleId} />;
}
