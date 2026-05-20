// components/FileOperationDialog.tsx - File operation modal/dialog
// License: Apache-2.0
'use client';

import { useState } from 'react';
import { FolderInput, Link2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { FloatingWindowFrame } from '@/components/FloatingWindowFrame';
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

  const confirmDisabled =
    (mode === 'upload' && !file) ||
    (mode === 'rename' && !name.trim());

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

  const footer = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="arch-btn rounded-md px-4 py-2 arch-type-body font-black"
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
        disabled={confirmDisabled}
        className="arch-btn-primary rounded-md px-4 py-2 arch-type-body font-black disabled:cursor-not-allowed disabled:opacity-45"
      >
        确认
      </button>
    </div>
  );

  return (
    <FloatingWindowFrame
      title={dialogTitles[mode]}
      eyebrow="文件操作"
      subtitle={target?.name ?? '当前目录'}
      icon={icon}
      onClose={onCancel}
      defaultSize={{ width: 560, height: mode === 'delete' ? 420 : 540 }}
      minSize={{ width: 360, height: 360 }}
      placement="center"
      zIndex={75}
      modal
      bodyClassName="space-y-4 p-5"
      footer={footer}
    >
          {mode === 'new' ? (
            <>
              <label className="block">
                <span className="arch-primary-text arch-type-caption font-black">类型</span>
                <select
                  value={nodeType}
                  onChange={(event) => setNodeType(event.target.value as 'folder' | 'file')}
                  className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
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
              <span className="arch-primary-text arch-type-caption font-black">选择本地文件</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
              />
              <span className="arch-muted mt-2 block arch-type-caption">
                {file ? `${file.name} · ${Math.round(file.size / 1024)} KB` : '未选择文件'}
              </span>
            </label>
          ) : null}

          {mode === 'rename' ? (
            <NameInput value={name} onChange={setName} placeholder="新名称" />
          ) : null}

          {mode === 'move' ? (
            <label className="block">
              <span className="arch-primary-text arch-type-caption font-black">目标文件夹</span>
              <select
                value={targetParentId}
                onChange={(event) => setTargetParentId(event.target.value)}
                className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
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
            <div className="arch-huly-row-muted rounded-lg p-4">
              <p className="arch-muted arch-type-body leading-6">
                确认后生成分享链接,并写入文件属性和审计事件。
              </p>
              {shareLink ? (
                <p className="arch-chip mt-3 break-all rounded-md px-3 py-2 arch-type-caption">
                  {shareLink.url}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === 'delete' ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="arch-type-body leading-6 text-red-700">
                确认后从当前目录移除。已上传的本地文件会同步删除运行索引；系统种子文件会进入回收站状态。
              </p>
            </div>
          ) : null}
    </FloatingWindowFrame>
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
      <span className="arch-primary-text arch-type-caption font-black">名称</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
      />
    </label>
  );
}
