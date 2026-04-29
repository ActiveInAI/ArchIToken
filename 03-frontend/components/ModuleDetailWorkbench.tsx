// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
'use client';

import { Box, Database, FileText, FolderOpen, Layers3, UploadCloud } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { DigitalTwinWorkbench } from '@/components/DigitalTwinWorkbench';
import { FilePreviewDrawer } from '@/components/FilePreviewDrawer';
import { FileManagerWorkbench } from '@/components/FileManagerWorkbench';
import { LocalFileUploader } from '@/components/LocalFileUploader';
import type { ModuleActionResult } from '@/lib/module-actions';
import { moduleBackendAdapter, type ModuleBackendSnapshot } from '@/lib/module-backend-adapter';
import type { ModuleAuditEvent, ModuleFileNode } from '@/lib/module-file-system';
import { formatModuleFileSize, getModuleRootId } from '@/lib/module-file-system';
import type { ModuleSpec } from '@/lib/module-registry';

export function ModuleDetailWorkbench({
  spec,
  onAudit,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleActionResult['auditEvent']) => void;
}) {
  function handleAudit(event: ModuleAuditEvent) {
    onAudit?.(event);
  }

  if (spec.id === 'digital_twin') {
    return (
      <div className="space-y-3">
        <DigitalTwinWorkbench embedded />
        <DigitalTwinDataSourceDock onAudit={handleAudit} />
      </div>
    );
  }

  return <FileManagerWorkbench spec={spec} onAudit={handleAudit} />;
}

function DigitalTwinDataSourceDock({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const rootId = getModuleRootId('digital_twin');
  const [snapshot, setSnapshot] = useState<ModuleBackendSnapshot>(() => moduleBackendAdapter.snapshot('digital_twin'));
  const [previewNode, setPreviewNode] = useState<ModuleFileNode | null>(null);
  const [fullView, setFullView] = useState(false);

  const files = snapshot.files
    .filter((file) => file.moduleId === 'digital_twin' && file.type === 'file')
    .sort((left, right) => Number(right.source === 'local_upload') - Number(left.source === 'local_upload'));
  const localUploads = files.filter((file) => file.source === 'local_upload');
  const engineeringFiles = files.filter((file) => file.viewerKind === 'engineering' || file.mimeType.startsWith('model/'));

  function refresh() {
    setSnapshot(moduleBackendAdapter.snapshot('digital_twin'));
  }

  function record(event: ModuleAuditEvent) {
    onAudit?.(event);
    refresh();
  }

  function openFile(file: ModuleFileNode) {
    const result = moduleBackendAdapter.openFile(file.id);
    setPreviewNode(result.node);
    setFullView(false);
    record(result.auditEvent);
  }

  function handleUploaded(node: ModuleFileNode) {
    setPreviewNode(node);
    setFullView(false);
    refresh();
  }

  return (
    <section className="arch-surface overflow-hidden rounded-[1.5rem] border">
      <header className="arch-surface-muted flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.28em]">
            digital twin data source dock
          </p>
          <h2 className="arch-text mt-1 text-xl font-black">孪生数据源 / 交付物</h2>
          <p className="arch-muted mt-1 text-sm">
            本地上传会进入 IFC/GLB/点云/360/三维扫描/倾斜摄影数据源，并自动生成导入事务。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TwinMetric icon={<Database className="h-4 w-4" />} label="数据源" value={String(files.length)} />
          <TwinMetric icon={<Box className="h-4 w-4" />} label="工程文件" value={String(engineeringFiles.length)} />
          <TwinMetric icon={<UploadCloud className="h-4 w-4" />} label="本地上传" value={String(localUploads.length)} />
          <LocalFileUploader
            moduleId="digital_twin"
            parentId={rootId}
            compact
            onUploaded={handleUploaded}
            onAudit={record}
          />
        </div>
      </header>

      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
        {files.slice(0, 12).map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => openFile(file)}
            className="arch-card-muted rounded-2xl p-3 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="arch-primary-soft flex h-10 w-10 items-center justify-center rounded-xl">
                {file.viewerKind === 'engineering' ? <Layers3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </span>
              <span className="arch-chip rounded-full px-2 py-1 text-[10px] font-black">
                {file.source === 'local_upload' ? 'local' : file.status}
              </span>
            </div>
            <h3 className="arch-text mt-3 truncate text-sm font-black">{file.name}</h3>
            <p className="arch-muted mt-1 truncate text-xs">{file.mimeType}</p>
            <p className="arch-muted mt-2 text-xs">
              {formatModuleFileSize(file.size)} · {file.version}
            </p>
          </button>
        ))}
        {files.length === 0 ? (
          <div className="arch-card-muted col-span-full flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed text-center">
            <FolderOpen className="h-9 w-9" />
            <p className="mt-2 text-sm">暂无孪生数据源，请上传 IFC/GLB/点云/360/扫描文件。</p>
          </div>
        ) : null}
      </div>

      <FilePreviewDrawer
        file={previewNode}
        fullView={fullView}
        onClose={() => {
          setPreviewNode(null);
          setFullView(false);
        }}
        onFullView={() => setFullView(true)}
      />
    </section>
  );
}

function TwinMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="arch-card-muted flex items-center gap-2 rounded-xl px-3 py-2">
      <span className="arch-primary-text">{icon}</span>
      <span>
        <span className="arch-muted block text-[10px]">{label}</span>
        <span className="arch-text block text-sm font-black">{value}</span>
      </span>
    </div>
  );
}
