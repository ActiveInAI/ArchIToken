// components/FileOperationDialog.tsx - File operation modal/dialog
// License: Apache-2.0
'use client';

import { useState } from 'react';
import { FolderInput, Link2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import type { ModuleFileNode, ModuleShareLink } from '@/lib/module-file-system';

export type FileDialogMode = 'new' | 'upload' | 'move' | 'share' | 'delete' | 'rename';

export interface FileDialogPayload {
  name?: string;
  nodeType?: 'folder' | 'file';
  targetParentId?: string;
  file?: File;
}

const dialogTitles: Record<FileDialogMode, string> = {
  new: '新建',
  upload: '上传',
  move: '移动',
  share: '分享',
  delete: '删除',
  rename: '重命名',
};

export function FileOperationDialog({
  mode,
  target,
  folders,
  shareLink,
  onCancel,
  onConfirm,
}: {
  mode: FileDialogMode | null;
  target: ModuleFileNode | null;
  folders: ModuleFileNode[];
  shareLink: ModuleShareLink | null;
  onCancel: () => void;
  onConfirm: (payload: FileDialogPayload) => void;
}) {
  const [name, setName] = useState(target?.name ?? '');
  const [nodeType, setNodeType] = useState<'folder' | 'file'>('folder');
  const [targetParentId, setTargetParentId] = useState(folders[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);

  if (!mode) {
    return null;
  }

  const icon = mode === 'new'
    ? <Plus className="h-4 w-4" />
    : mode === 'upload'
      ? <Upload className="h-4 w-4" />
      : mode === 'move'
        ? <FolderInput className="h-4 w-4" />
        : mode === 'rename'
          ? <Pencil className="h-4 w-4" />
          : mode === 'delete'
            ? <Trash2 className="h-4 w-4" />
            : <Link2 className="h-4 w-4" />;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(6,18,16,0.38)] p-4 backdrop-blur">
      <section className="arch-surface w-full max-w-lg overflow-hidden rounded-lg border">
        <div className="arch-border flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="arch-primary-soft flex h-9 w-9 items-center justify-center rounded-md">
              {icon}
            </span>
            <div>
              <p className="text-lg font-black">{dialogTitles[mode]}</p>
              <p className="arch-muted text-xs">{target?.name ?? '当前目录'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="arch-btn flex h-9 w-9 items-center justify-center rounded-md"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {mode === 'new' ? (
            <>
              <label className="block">
                <span className="arch-primary-text text-xs font-black">类型</span>
                <select
                  value={nodeType}
                  onChange={(event) => setNodeType(event.target.value as 'folder' | 'file')}
                  className="arch-input mt-2 w-full rounded-md px-3 py-3 text-sm outline-none"
                >
                  <option value="folder">文件夹</option>
                  <option value="file">文件</option>
                </select>
              </label>
              <NameInput value={name} onChange={setName} placeholder="请输入名称,如 新建资料夹" />
            </>
          ) : null}

          {mode === 'upload' ? (
            <label className="block">
              <span className="arch-primary-text text-xs font-black">选择本地文件</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="arch-input mt-2 w-full rounded-md px-3 py-3 text-sm outline-none"
              />
              <span className="arch-muted mt-2 block text-xs">
                {file ? `${file.name} · ${Math.round(file.size / 1024)} KB` : '上传会走 Next.js local file runtime。'}
              </span>
            </label>
          ) : null}

          {mode === 'rename' ? (
            <NameInput value={name} onChange={setName} placeholder="新名称" />
          ) : null}

          {mode === 'move' ? (
            <label className="block">
              <span className="arch-primary-text text-xs font-black">目标文件夹</span>
              <select
                value={targetParentId}
                onChange={(event) => setTargetParentId(event.target.value)}
                className="arch-input mt-2 w-full rounded-md px-3 py-3 text-sm outline-none"
              >
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === 'share' ? (
            <div className="arch-card-muted rounded-lg p-4">
              <p className="arch-muted text-sm leading-6">
                确认后生成分享链接,并写入文件属性和审计事件。
              </p>
              {shareLink ? (
                <p className="arch-chip mt-3 break-all rounded-md px-3 py-2 text-xs">
                  {shareLink.url}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === 'delete' ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm leading-6 text-red-700">
                删除会进入 `soft_deleted` 状态,不会直接从 UI 消失。可在后续回收站流程中确认清理。
              </p>
            </div>
          ) : null}
        </div>

        <div className="arch-border flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="arch-btn rounded-md px-4 py-2 text-sm font-black"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              const payload: FileDialogPayload = { name, nodeType, targetParentId };
              if (file) {
                payload.file = file;
              }
              onConfirm(payload);
            }}
            className="arch-btn-primary rounded-md px-4 py-2 text-sm font-black"
          >
            确认
          </button>
        </div>
      </section>
    </div>
  );
}

function NameInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="arch-primary-text text-xs font-black">名称</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="arch-input mt-2 w-full rounded-md px-3 py-3 text-sm outline-none"
      />
    </label>
  );
}
