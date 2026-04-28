// components/BusinessModuleWorkbench.tsx - Backward-compatible workbench entry
// License: Apache-2.0
'use client';

import { ModuleWorkbenchShell } from '@/components/ModuleWorkbenchShell';
import type { ModuleId } from '@/lib/module-registry';

export function BusinessModuleWorkbench({ initialModuleId }: { initialModuleId?: ModuleId }) {
  if (!initialModuleId) {
    return <ModuleWorkbenchShell />;
  }

  return <ModuleWorkbenchShell initialModuleId={initialModuleId} />;
}
