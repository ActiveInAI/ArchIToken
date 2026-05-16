// components/FilePreviewDrawer.tsx - File preview drawer
// License: Apache-2.0
'use client';

import { X } from 'lucide-react';
import { UniversalFileViewer } from '@/components/UniversalFileViewer';
import type { ModuleFileNode } from '@/lib/module-file-system';

export function FilePreviewDrawer({
  file,
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
    <aside
      className="arch-drawer fixed inset-0 z-[120] flex !w-screen flex-col overflow-hidden rounded-none border"
    >
      <div className="arch-border flex min-h-12 shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3">
          <p className="arch-primary-text font-mono text-[10px] font-black">
            文件查看器
          </p>
          <h3 className="truncate text-base font-black">{file.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="arch-btn flex h-8 w-8 items-center justify-center rounded-md"
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--arch-surface)] p-3">
        <UniversalFileViewer file={file} showSummary={false} />
      </div>
    </aside>
  );
}
