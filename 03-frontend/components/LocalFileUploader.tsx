// components/LocalFileUploader.tsx - Local file upload control
// License: Apache-2.0
'use client';

import { CloudUpload, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { moduleBackendAdapter } from '@/lib/module-backend-adapter';
import type { LocalFileMetadata } from '@/lib/local-file-runtime';
import type { ModuleAuditEvent, ModuleFileNode } from '@/lib/module-file-system';
import type { ModuleId } from '@/lib/module-registry';

export function LocalFileUploader({
  moduleId,
  parentId,
  compact = false,
  onUploaded,
  onAudit,
}: {
  moduleId: ModuleId;
  parentId: string;
  compact?: boolean;
  onUploaded: (node: ModuleFileNode, metadata: LocalFileMetadata) => void;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function uploadFiles(files: FileList | File[]) {
    const [file] = Array.from(files);
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('moduleId', moduleId);
      form.set('parentId', parentId);
      form.set('owner', '当前用户');
      form.set('tags', 'local-upload');

      const response = await fetch('/api/local-files/upload', {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      const payload = (await response.json()) as { file: LocalFileMetadata };
      const result = moduleBackendAdapter.uploadLocalFile(payload.file, parentId);
      onAudit?.(result.auditEvent);
      onUploaded(result.node, payload.file);
    } finally {
      setUploading(false);
      setDragging(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    void uploadFiles(event.dataTransfer.files);
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="arch-btn-primary inline-flex items-center gap-2 rounded-md px-3 py-2 arch-type-body font-medium transition disabled:cursor-wait disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {uploading ? '上传中' : '上传'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void uploadFiles(event.target.files);
          }}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className={`flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition ${
          dragging
            ? 'arch-huly-row-selected'
            : 'arch-huly-row-muted hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)]'
        } disabled:cursor-wait disabled:opacity-60`}
      >
        <CloudUpload className="h-7 w-7" />
        <span className="mt-2 arch-type-body font-medium">{uploading ? '正在写入本地运行目录' : '拖拽文件到这里或点击上传'}</span>
        <span className="arch-muted mt-1 arch-type-caption">文件会进入模块文件系统、生命周期、审批与审计</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files);
        }}
      />
    </>
  );
}
