// components/FileContextMenu.tsx - File/folder context menu
// License: Apache-2.0
'use client';

import {
  Copy,
  Download,
  Eye,
  FilePlus2,
  FolderOpen,
  Info,
  Move,
  Pencil,
  Scissors,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ModuleFileNode } from '@/lib/module-file-system';

export type FileContextAction =
  | 'open'
  | 'new'
  | 'view'
  | 'upload'
  | 'download'
  | 'move'
  | 'copy'
  | 'paste'
  | 'share'
  | 'delete'
  | 'properties'
  | 'rename';

const actionMeta: Record<FileContextAction, { label: string; icon: ReactNode; danger?: boolean }> = {
  open: { label: '打开', icon: <FolderOpen className="h-4 w-4" /> },
  new: { label: '新建', icon: <FilePlus2 className="h-4 w-4" /> },
  view: { label: '查看', icon: <Eye className="h-4 w-4" /> },
  upload: { label: '上传', icon: <Upload className="h-4 w-4" /> },
  download: { label: '下载', icon: <Download className="h-4 w-4" /> },
  move: { label: '移动', icon: <Move className="h-4 w-4" /> },
  copy: { label: '复制', icon: <Copy className="h-4 w-4" /> },
  paste: { label: '粘贴', icon: <Scissors className="h-4 w-4" /> },
  share: { label: '分享', icon: <Share2 className="h-4 w-4" /> },
  delete: { label: '删除', icon: <Trash2 className="h-4 w-4" />, danger: true },
  properties: { label: '属性', icon: <Info className="h-4 w-4" /> },
  rename: { label: '重命名', icon: <Pencil className="h-4 w-4" /> },
};

const folderActions: FileContextAction[] = [
  'new',
  'upload',
  'open',
  'view',
  'paste',
  'download',
  'move',
  'copy',
  'rename',
  'share',
  'properties',
  'delete',
];

const fileActions: FileContextAction[] = [
  'open',
  'view',
  'download',
  'copy',
  'move',
  'rename',
  'share',
  'properties',
  'delete',
];

export function FileContextMenu({
  node,
  x,
  y,
  onAction,
  onClose,
}: {
  node: ModuleFileNode | null;
  x: number;
  y: number;
  onAction: (action: FileContextAction, node: ModuleFileNode | null) => void;
  onClose: () => void;
}) {
  const actions = node?.type === 'file' ? fileActions : folderActions;

  return (
    <div
      className="arch-surface fixed z-[70] min-w-52 overflow-hidden rounded-2xl border py-2 text-sm"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <div className="arch-border border-b px-3 pb-2 pt-1">
        <p className="arch-text max-w-48 truncate text-xs font-black">
          {node?.name ?? '当前目录'}
        </p>
        <p className="arch-primary-text mt-1 text-[10px] uppercase tracking-[0.18em]">
          {node?.type ?? 'folder context'}
        </p>
      </div>
      <div className="py-1">
        {actions.map((action) => {
          const meta = actionMeta[action];
          return (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action, node)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--arch-primary-soft)] ${
                meta.danger ? 'text-red-600 hover:bg-red-50' : 'arch-text'
              }`}
            >
              <span className={meta.danger ? 'text-red-500' : 'arch-primary-text'}>{meta.icon}</span>
              <span className="font-bold">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
