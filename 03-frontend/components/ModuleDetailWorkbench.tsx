// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
'use client';

import { AICenterWorkbench } from '@/components/AICenterWorkbench';
import { FileManagerWorkbench } from '@/components/FileManagerWorkbench';
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
        sidecar={<AICenterWorkbench compact onAudit={handleAudit} />}
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
