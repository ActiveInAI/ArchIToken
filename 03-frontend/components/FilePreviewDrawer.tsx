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
      className="arch-drawer fixed inset-0 z-[90] flex !w-screen flex-col overflow-hidden rounded-none border"
    >
      <div className="arch-border flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.26em]">
            Universal viewer
          </p>
          <h3 className="mt-1 truncate text-xl font-black">{file.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="arch-btn flex h-9 w-9 items-center justify-center rounded-md"
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <UniversalFileViewer file={file} />
      </div>
    </aside>
  );
}
