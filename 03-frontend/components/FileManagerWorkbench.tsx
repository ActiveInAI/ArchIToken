// components/FileManagerWorkbench.tsx - File-first business module workbench
// License: Apache-2.0
'use client';

import type { ReactNode } from 'react';
import { ModuleFileExplorer } from '@/components/ModuleFileExplorer';
import type { ModuleAuditEvent, ModuleFileNode } from '@/lib/module-file-system';
import type { ModuleSpec } from '@/lib/module-registry';

export function FileManagerWorkbench({
  spec,
  onAudit,
  businessHome,
  renderFilePreview,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  onFeatureSelect?: (featureTitle: string) => void;
  sidecar?: ReactNode;
  businessHome?: ReactNode;
  renderFilePreview?: (file: ModuleFileNode) => ReactNode | null;
}) {
  function handleAudit(event: ModuleAuditEvent) {
    onAudit?.(event);
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <ModuleFileExplorer
        spec={spec}
        onAudit={handleAudit}
        businessHome={businessHome}
        {...(renderFilePreview ? { renderFilePreview } : {})}
      />
    </section>
  );
}
