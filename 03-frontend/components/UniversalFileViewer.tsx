// components/UniversalFileViewer.tsx - Universal local/mock file viewer
// License: Apache-2.0
'use client';

import { Archive, Box, CheckCircle2, Database, FileText, ImageIcon, Music, PlayCircle, Table2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { getLocalFileViewerKind } from '@/lib/local-file-runtime';
import type { LocalFileViewerKind } from '@/lib/local-file-runtime';
import type { ModuleFileNode } from '@/lib/module-file-system';
import { formatModuleFileSize } from '@/lib/module-file-system';

export function UniversalFileViewer({ file }: { file: ModuleFileNode }) {
  const localFile = file.localFile;
  const kind = localFile
    ? getLocalFileViewerKind(localFile)
    : file.viewerKind ?? getLocalFileViewerKind({ mimeType: file.mimeType, ext: extensionOf(file.name) });
  const sourceUrl = localFile ? `/api/local-files/${localFile.fileId}` : null;

  return (
    <div className="space-y-4">
      <section className="arch-card rounded-2xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="arch-primary-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            {viewerIcon(kind)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="arch-text truncate text-lg font-black">{file.name}</h3>
            <p className="arch-muted mt-1 text-sm">
              {file.mimeType} · {formatModuleFileSize(file.size)} · {file.version}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge label={kind} />
              <Badge label={file.status} />
              {file.source === 'local_upload' ? <Badge label="local runtime" /> : <Badge label="mock object" />}
            </div>
          </div>
        </div>
      </section>

      {sourceUrl ? (
        <FileBody kind={kind} sourceUrl={sourceUrl} file={file} />
      ) : (
        <EngineeringCard file={file} kind={kind} />
      )}
    </div>
  );
}

function FileBody({
  kind,
  sourceUrl,
  file,
}: {
  kind: LocalFileViewerKind;
  sourceUrl: string;
  file: ModuleFileNode;
}) {
  if (kind === 'image') {
    return (
      <section className="arch-card-muted relative min-h-[420px] rounded-2xl p-4">
        <Image src={sourceUrl} alt={file.name} fill unoptimized sizes="(max-width: 768px) 100vw, 520px" className="rounded-xl object-contain p-4" />
      </section>
    );
  }
  if (kind === 'video') {
    return (
      <section className="rounded-2xl border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-bg)] p-3">
        <video src={sourceUrl} controls className="max-h-[62vh] w-full rounded-xl" />
      </section>
    );
  }
  if (kind === 'audio') {
    return (
      <section className="arch-card rounded-2xl p-5">
        <audio src={sourceUrl} controls className="w-full" />
      </section>
    );
  }
  if (kind === 'pdf') {
    return (
      <section className="arch-card h-[68vh] overflow-hidden rounded-2xl">
        <iframe src={sourceUrl} title={file.name} className="h-full w-full" />
      </section>
    );
  }
  if (kind === 'text' || kind === 'json' || kind === 'csv') {
    return (
      <section className="arch-card overflow-hidden rounded-2xl">
        <div className="arch-surface-muted border-b px-4 py-3">
          <p className="arch-text text-sm font-bold">
            {kind === 'csv' ? 'CSV 表格/文本预览' : kind === 'json' ? 'JSON 文本预览' : '文本预览'}
          </p>
          <p className="arch-muted mt-1 text-xs">当前通过本地文件 API 读取正文;后续可替换为 Rust 解析器。</p>
        </div>
        <iframe src={sourceUrl} title={file.name} className="h-[58vh] w-full bg-[var(--arch-surface)]" />
      </section>
    );
  }
  if (kind === 'office') {
    return (
      <InfoCard
        title="Office 文档已进入系统"
        description="本地预览暂不解析正文,但文件已经绑定模块、生命周期、审批和审计;可下载、分享、归档或交给后续文档解析服务。"
        file={file}
        kind={kind}
      />
    );
  }
  if (kind === 'engineering') {
    return <EngineeringCard file={file} kind={kind} />;
  }
  if (kind === 'archive') {
    return (
      <InfoCard
        title="压缩包 / 归档包对象"
        description="该文件已进入系统对象层,可作为归档包、模型包或交付包进入审批与长期留存流程。"
        file={file}
        kind={kind}
      />
    );
  }
  return (
    <InfoCard
      title="通用文件对象"
      description="该文件格式未启用专用解析器,但可继续执行下载、分享、提交审批、归档和审计。"
      file={file}
      kind={kind}
    />
  );
}

function EngineeringCard({ file, kind }: { file: ModuleFileNode; kind: LocalFileViewerKind }) {
  const [log, setLog] = useState<string[]>([]);

  function addLog(message: string) {
    setLog((current) => [`${new Date().toLocaleTimeString()} · ${message}`, ...current].slice(0, 5));
  }

  return (
    <section className="arch-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="arch-primary-text text-xs font-black uppercase tracking-[0.2em]">Engineering object</p>
          <h3 className="arch-text mt-2 text-2xl font-black">工程文件查看卡</h3>
          <p className="arch-muted mt-2 max-w-3xl text-sm leading-6">
            {file.name} 已作为 BIM/CAD/点云/3DGS/数控文件进入系统。当前不强制 3D 解析,
            但会保留元数据、版本、导入状态和后续解析入口。
          </p>
        </div>
        <Box className="arch-primary-text h-8 w-8" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="文件类型" value={file.localFile?.ext || extensionOf(file.name) || kind} />
        <Metric label="大小" value={formatModuleFileSize(file.size)} />
        <Metric label="模块" value={file.moduleId} />
        <Metric label="导入状态" value={file.status} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {['加入模型库', '生成解析任务', '提交校核', '归档'].map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => addLog(`${action} 已写入前端操作状态`)}
            className="arch-btn-primary rounded-xl px-3 py-2 text-sm font-bold transition"
          >
            {action}
          </button>
        ))}
      </div>

      <div className="arch-card mt-4 rounded-2xl p-4">
        <p className="arch-text text-sm font-black">操作状态</p>
        {log.length === 0 ? (
          <p className="arch-muted mt-2 text-sm">等待加入模型库、解析、校核或归档。</p>
        ) : (
          <div className="mt-2 space-y-2">
            {log.map((item) => (
              <p key={item} className="arch-chip rounded-xl px-3 py-2 text-sm">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                {item}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InfoCard({
  title,
  description,
  file,
  kind,
}: {
  title: string;
  description: string;
  file: ModuleFileNode;
  kind: LocalFileViewerKind;
}) {
  return (
    <section className="arch-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="arch-primary-soft flex h-12 w-12 items-center justify-center rounded-2xl">
          {viewerIcon(kind)}
        </span>
        <div>
          <h3 className="arch-text text-xl font-black">{title}</h3>
          <p className="arch-muted mt-2 max-w-3xl text-sm leading-6">{description}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="大小" value={formatModuleFileSize(file.size)} />
            <Metric label="MIME" value={file.mimeType} />
            <Metric label="状态" value={file.status} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted rounded-2xl px-3 py-2">
      <p className="arch-muted text-[11px] font-bold">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="arch-chip rounded-full px-2.5 py-1 text-xs font-bold">
      {label}
    </span>
  );
}

function viewerIcon(kind: LocalFileViewerKind) {
  if (kind === 'image') return <ImageIcon className="h-6 w-6" />;
  if (kind === 'video') return <PlayCircle className="h-6 w-6" />;
  if (kind === 'audio') return <Music className="h-6 w-6" />;
  if (kind === 'csv') return <Table2 className="h-6 w-6" />;
  if (kind === 'engineering') return <Box className="h-6 w-6" />;
  if (kind === 'archive') return <Archive className="h-6 w-6" />;
  if (kind === 'json') return <Database className="h-6 w-6" />;
  return <FileText className="h-6 w-6" />;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}
