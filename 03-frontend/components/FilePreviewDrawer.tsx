// components/FilePreviewDrawer.tsx - File preview drawer
// License: Apache-2.0
'use client';

import { FileText } from 'lucide-react';
import { FloatingWindowFrame } from '@/components/FloatingWindowFrame';
import { UniversalFileViewer } from '@/components/UniversalFileViewer';
import type { ModuleFileNode } from '@/lib/module-file-system';

export function FilePreviewDrawer({
  file,
  fullView,
  onClose,
}: {
  file: ModuleFileNode | null;
  fullView: boolean;
  onClose: () => void;
  onFullView: () => void;
}) {
  if (!file) {
    return null;
  }

  return (
    <FloatingWindowFrame
      title={file.name}
      eyebrow="文件查看器"
      subtitle={file.mimeType}
      icon={<FileText className="h-4 w-4" />}
      onClose={onClose}
      defaultSize={fullView ? { width: 1680, height: 940 } : { width: 1320, height: 820 }}
      minSize={{ width: 720, height: 500 }}
      placement="center"
      zIndex={120}
      bodyClassName="p-0"
    >
      <div className="h-full min-h-0 bg-[var(--arch-surface)]">
        <UniversalFileViewer file={file} showSummary={false} />
      </div>
    </FloatingWindowFrame>
  );
}
