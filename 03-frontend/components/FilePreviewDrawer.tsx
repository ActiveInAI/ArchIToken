// components/FilePreviewDrawer.tsx - File preview drawer
// License: Apache-2.0
'use client';

import { Maximize2, X } from 'lucide-react';
import { UniversalFileViewer } from '@/components/UniversalFileViewer';
import type { ModuleFileNode } from '@/lib/module-file-system';

export function FilePreviewDrawer({
  file,
  fullView,
  onClose,
  onFullView,
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
      className={`arch-drawer fixed z-[65] border ${
        fullView
          ? 'inset-0 rounded-none'
          : 'bottom-3 right-3 top-14 w-[min(920px,calc(100vw-1.5rem))] rounded-[1.25rem]'
      }`}
    >
      <div className="arch-border flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.26em]">
            Universal viewer
          </p>
          <h3 className="mt-1 truncate text-xl font-black">{file.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFullView}
            className="arch-btn flex h-9 w-9 items-center justify-center rounded-xl"
            aria-label="完整查看"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="arch-btn flex h-9 w-9 items-center justify-center rounded-xl"
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-73px)] overflow-y-auto p-4">
        <UniversalFileViewer file={file} />

        <div className="arch-card mt-4 rounded-2xl p-4">
          <h4 className="font-black">文件审计</h4>
          <div className="mt-3 space-y-2">
            {file.auditTrail.slice(0, 6).map((event) => (
              <div key={event.id} className="arch-card-muted rounded-xl px-3 py-2 text-xs leading-5">
                {event.summary} · {event.actor}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
