// components/UniversalFileViewer.tsx - Universal file viewer
// License: Apache-2.0
'use client';

import {
  Archive,
  AlertTriangle,
  Box,
  Database,
  FileText,
  ImageIcon,
  Music,
  PlayCircle,
  Table2,
} from 'lucide-react';
import Image from 'next/image';
import { ArchivePackageViewer } from '@/components/ArchivePackageViewer';
import { OpenEngineeringViewer } from '@/components/OpenEngineeringViewer';
import {
  OfficeDocumentViewer,
  TextDataViewer,
} from '@/components/OfficeDocumentViewer';
import { requiredAdaptersForFileName } from '@/lib/adapter-source-registry';
import {
  extensionOf,
  fileTypeForFileName,
  stageRouteForFileName,
} from '@/lib/file-type-registry';
import { getLocalFileViewerKind } from '@/lib/local-file-runtime';
import type { LocalFileViewerKind } from '@/lib/local-file-runtime';
import type { ModuleFileNode } from '@/lib/module-file-system';
import { formatModuleFileSize } from '@/lib/module-file-system';

export function UniversalFileViewer({
  file,
  showSummary = true,
}: {
  file: ModuleFileNode;
  showSummary?: boolean;
}) {
  const localFile = file.localFile;
  const kind = localFile
    ? getLocalFileViewerKind(localFile)
    : (file.viewerKind ??
      getLocalFileViewerKind({
        mimeType: file.mimeType,
        ext: extensionOf(file.name),
      }));
  const sourceUrl = localFile ? `/api/local-files/${localFile.fileId}` : null;

  return (
    <div className="space-y-3">
      {showSummary ? (
        <section className="arch-card rounded-xl p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              {viewerIcon(kind)}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="arch-text truncate text-lg font-black">
                {file.name}
              </h3>
              <p className="arch-muted mt-1 text-sm">
                {file.mimeType} · {formatModuleFileSize(file.size)} ·{' '}
                {file.version}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label={kind} />
                <Badge label={file.status} />
                {file.source === 'local_upload' ? (
                  <Badge label="local runtime" />
                ) : (
                  <Badge label="metadata only" />
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sourceUrl ? (
        <FileBody kind={kind} sourceUrl={sourceUrl} file={file} />
      ) : (
        <MissingContentBinding kind={kind} file={file} />
      )}
    </div>
  );
}

function MissingContentBinding({
  kind,
  file,
}: {
  kind: LocalFileViewerKind;
  file: ModuleFileNode;
}) {
  if (kind === 'engineering') {
    return <EngineeringSourceBindingPanel file={file} />;
  }

  return (
    <InfoCard
      title="缺少真实文件内容绑定"
      description="该行目前只有模块文件元数据，没有本地上传文件流或对象存储绑定。前端不会生成伪 PDF、伪图像或伪 3D 模型；请上传真实文件或等待后端返回真实 worker derivative URL。"
      file={file}
      kind={kind}
    />
  );
}

function EngineeringSourceBindingPanel({ file }: { file: ModuleFileNode }) {
  const ext = file.localFile?.ext || extensionOf(file.name) || 'unknown';
  const adapter = requiredAdapterFor(file);

  return (
    <section className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.5fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="arch-text text-base font-black">
                需要绑定真实 {ext.toUpperCase()} 文件流
              </h3>
              <p className="arch-muted mt-2 max-w-4xl text-sm leading-6">
                当前行是模块种子元数据，不包含可解析的本地上传对象或后端
                derivative URL。DXF/IFC/STEP 预览必须读取真实字节；系统不会生成伪图纸或伪模型。
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <Metric label="格式" value={ext} />
            <Metric label="MIME" value={file.mimeType} />
            <Metric label="来源" value={file.source ?? 'metadata'} />
            <Metric label="大小" value={formatModuleFileSize(file.size)} />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3">
          <p className="arch-primary-text font-mono text-[10px] font-black uppercase tracking-[0.16em]">
            Production route
          </p>
          <p className="arch-text mt-2 break-words text-sm font-black">
            {adapter}
          </p>
          <ol className="arch-muted mt-3 space-y-2 text-xs leading-5">
            <li>1. 用当前目录的“上传”绑定真实源文件。</li>
            <li>2. 或由后端 CAD/BIM worker 回填 derivative URL。</li>
            <li>3. 回填后浏览器端 DXF/IFC/STEP viewer 才会执行真实解析。</li>
          </ol>
        </div>
      </div>
    </section>
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
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const mimeType = file.mimeType.toLowerCase();

  if (kind === 'image') {
    return (
      <section className="arch-card-muted relative min-h-[calc(100vh-170px)] rounded-xl p-4">
        <Image
          src={sourceUrl}
          alt={file.name}
          fill
          unoptimized
          sizes="100vw"
          className="rounded-xl object-contain p-4"
        />
      </section>
    );
  }

  if (kind === 'video') {
    return (
      <section className="rounded-xl border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-bg)] p-3">
        <video
          src={sourceUrl}
          controls
          className="max-h-[calc(100vh-180px)] w-full rounded-xl"
        />
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
      <section className="arch-card h-[calc(100vh-170px)] overflow-hidden rounded-xl">
        <iframe src={sourceUrl} title={file.name} className="h-full w-full" />
      </section>
    );
  }

  if (ext === '.html' || ext === '.htm' || mimeType === 'text/html') {
    return (
      <section className="arch-card h-[calc(100vh-170px)] overflow-hidden rounded-xl">
        <iframe
          src={sourceUrl}
          title={file.name}
          sandbox="allow-same-origin allow-scripts"
          className="h-full w-full bg-white"
        />
      </section>
    );
  }

  if (kind === 'text' || kind === 'json' || kind === 'csv') {
    return <TextDataViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (kind === 'office') {
    return <OfficeDocumentViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (kind === 'engineering') {
    if (ext === '.dwg') {
      return <OpenEngineeringViewer file={file} sourceUrl={sourceUrl} />;
    }

    return requiresWorkerDerivative(file) ? (
      <UnsupportedNativeViewer file={file} />
    ) : (
      <OpenEngineeringViewer file={file} sourceUrl={sourceUrl} />
    );
  }

  if (kind === 'archive') {
    if (ext === '.zip' || ext === '.ifczip' || ext === '.bcfzip') {
      return <ArchivePackageViewer file={file} sourceUrl={sourceUrl} />;
    }

    return (
      <InfoCard
        title="压缩包 / 归档包对象"
        description="该文件已进入系统对象层，可作为归档包、模型包或交付包进入审批与长期留存流程。RAR、7z、tar 等解包、病毒扫描和哈希留存需要后端归档 worker。"
        file={file}
        kind={kind}
      />
    );
  }

  return (
    <InfoCard
      title="通用文件对象"
      description="该文件格式未启用专用解析器，但可继续执行下载、分享、提交审批、归档和审计。"
      file={file}
      kind={kind}
    />
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
          <p className="arch-muted mt-2 max-w-3xl text-sm leading-6">
            {description}
          </p>
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

function UnsupportedNativeViewer({ file }: { file: ModuleFileNode }) {
  return (
    <section className="arch-card rounded-2xl p-5 shadow-sm">
      <h3 className="arch-text text-xl font-black">需要真实转换 adapter</h3>
      <p className="arch-muted mt-2 text-sm leading-6">
        {file.name} 不能由浏览器直接解析。必须接入真实 CAD/BIM worker
        或授权服务后生成 GLB、glTF、3D Tiles、PDF 或 SVG derivative。
        当前不会用占位内容冒充解析成功。
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="格式"
          value={file.localFile?.ext || extensionOf(file.name) || 'unknown'}
        />
        <Metric label="MIME" value={file.mimeType} />
        <Metric label="要求" value={requiredAdapterFor(file)} />
      </div>
    </section>
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

const browserRenderableEngineeringExtensions = new Set([
  '.ifc',
  '.dxf',
  '.glb',
  '.gltf',
  '.stl',
  '.obj',
  '.ply',
  '.step',
  '.stp',
  '.iges',
  '.igs',
  '.brep',
]);

function requiresWorkerDerivative(file: ModuleFileNode): boolean {
  const ext = file.localFile?.ext || extensionOf(file.name);
  const registryEntry = fileTypeForFileName(file.name);

  if (!ext) return true;
  if (browserRenderableEngineeringExtensions.has(ext)) return false;
  return registryEntry?.viewerKind === 'engineering';
}

function requiredAdapterFor(file: ModuleFileNode): string {
  const stageRoute = stageRouteForFileName(file.name, 'preview');
  const registered = fileTypeForFileName(file.name);
  const adapters = requiredAdaptersForFileName(file.name, file.mimeType).join(
    ' / ',
  );

  if (!registered || !stageRoute) return adapters;

  return `${registered.productionRoute}: ${stageRoute.adapter} / ${adapters}`;
}
