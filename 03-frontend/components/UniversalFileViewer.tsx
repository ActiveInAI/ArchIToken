// components/UniversalFileViewer.tsx - Universal file viewer
// License: Apache-2.0
'use client';

import { Archive, Box, CheckCircle2, Database, FileText, ImageIcon, Music, PlayCircle, Table2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { getLocalFileViewerKind } from '@/lib/local-file-runtime';
import type { LocalFileViewerKind } from '@/lib/local-file-runtime';
import type { ModuleFileNode } from '@/lib/module-file-system';
import { formatModuleFileSize } from '@/lib/module-file-system';
import { generationClient, type GenerationJob } from '@/lib/generation-client';
import type { Artifact } from '@/lib/artifact-client';
import { BIMViewer } from '@/components/BIMViewer';

export function UniversalFileViewer({ file }: { file: ModuleFileNode }) {
  const localFile = file.localFile;
  const kind = localFile
    ? getLocalFileViewerKind(localFile)
    : file.viewerKind ?? getLocalFileViewerKind({ mimeType: file.mimeType, ext: extensionOf(file.name) });
  const sourceUrl = localFile ? `/api/local-files/${localFile.fileId}` : null;
  const [derivedViewerSource, setDerivedViewerSource] = useState<RenderableArtifactSource | null>(null);

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
              {file.source === 'local_upload' ? <Badge label="local runtime" /> : <Badge label="registry object" />}
            </div>
          </div>
        </div>
      </section>

      {kind === 'engineering' ? (
        <div className="space-y-4">
          <BIMViewer
            sourceUrl={derivedViewerSource?.url ?? sourceUrl}
            fileName={derivedViewerSource?.fileName ?? file.name}
            mimeType={derivedViewerSource?.mimeType ?? file.mimeType}
          />
          <EngineeringCard
            file={file}
            kind={kind}
            sourceUrl={sourceUrl}
            onRenderableArtifact={setDerivedViewerSource}
          />
        </div>
      ) : sourceUrl ? (
        <FileBody kind={kind} sourceUrl={sourceUrl} file={file} />
      ) : (
        <RegistryObjectBody kind={kind} file={file} />
      )}
    </div>
  );
}

function RegistryObjectBody({
  kind,
  file,
}: {
  kind: LocalFileViewerKind;
  file: ModuleFileNode;
}) {
  if (kind === 'archive') {
    return (
      <InfoCard
        title="压缩包 / 归档包对象"
        description="该文件已进入系统对象层，可作为归档包、模型包或交付包进入审批与长期留存流程。"
        file={file}
        kind={kind}
      />
    );
  }

  if (kind === 'pdf') {
    return (
      <InfoCard
        title="PDF / PDF-A 档案对象"
        description="该文件已作为档案文档进入系统，可执行签章、归档、审批、审计和长期留存。"
        file={file}
        kind={kind}
      />
    );
  }

  if (kind === 'json' || kind === 'csv' || kind === 'text') {
    return (
      <InfoCard
        title="文本 / 结构化数据对象"
        description="该文件节点没有本地正文流，但已绑定模块、版本链、审计和生命周期。"
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

function FileBody({
  kind,
  sourceUrl,
  file,
}: {
  kind: LocalFileViewerKind;
  sourceUrl: string;
  file: ModuleFileNode;
}) {
  const [derivedViewerSource, setDerivedViewerSource] = useState<RenderableArtifactSource | null>(null);

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
    return (
      <div className="space-y-4">
        <BIMViewer
          sourceUrl={derivedViewerSource?.url ?? sourceUrl}
          fileName={derivedViewerSource?.fileName ?? file.name}
          mimeType={derivedViewerSource?.mimeType ?? file.mimeType}
        />
        <EngineeringCard
          file={file}
          kind={kind}
          sourceUrl={sourceUrl}
          onRenderableArtifact={setDerivedViewerSource}
        />
      </div>
    );
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

type EngineeringJobPhase = 'idle' | 'creating' | 'planning' | 'running' | 'completed' | 'failed';

interface RenderableArtifactSource {
  url: string;
  fileName: string;
  mimeType: string;
}

function isRenderableEngineeringArtifact(artifact: Artifact): boolean {
  const geometryFormat = artifact.artifactMetadata.geometryFormat?.toLowerCase();
  const viewerAdapterHint = artifact.artifactMetadata.viewerAdapterHint?.toLowerCase();
  const mimeType = artifact.artifactMetadata.mimeType?.toLowerCase() ?? '';
  const kind = artifact.kind.toLowerCase();
  const name = artifact.reference.name.toLowerCase();

  return geometryFormat === 'ifc'
    || geometryFormat === 'glb'
    || geometryFormat === 'gltf'
    || viewerAdapterHint === 'ifc'
    || viewerAdapterHint === 'threejs'
    || kind === 'bim'
    || kind === 'model'
    || kind === 'glb'
    || mimeType === 'model/gltf-binary'
    || mimeType === 'model/gltf+json'
    || mimeType.includes('ifc')
    || mimeType.includes('step')
    || name.endsWith('.ifc')
    || name.endsWith('.glb')
    || name.endsWith('.gltf');
}

function renderableSourceFromArtifact(artifact: Artifact): RenderableArtifactSource | null {
  if (!isRenderableEngineeringArtifact(artifact)) return null;

  return {
    url: generationClient.artifactContentUrl(artifact.id),
    fileName: artifact.reference.name || `artifact-${artifact.id}`,
    mimeType: artifact.artifactMetadata.mimeType || 'application/octet-stream',
  };
}

function selectEngineeringGenerationMode(file: ModuleFileNode): string {
  const ext = file.localFile?.ext || extensionOf(file.name);

  if (ext === '.ifc') return 'ifc_to_glb';
  if (ext === '.glb' || ext === '.gltf') return 'glb_optimize';
  if (ext === '.dwg' || ext === '.dxf') return 'cad_to_scene_tiles';
  if (ext === '.step' || ext === '.stp') return 'model_to_lightweight_scene';
  if (ext === '.e57' || ext === '.las' || ext === '.ply' || ext === '.spz') {
    return 'model_to_lightweight_scene';
  }

  return 'model_to_lightweight_scene';
}

function describeGenerationError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null) {
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
    return JSON.stringify(error);
  }

  return String(error);
}

function buildEngineeringPrompt({
  file,
  kind,
  sourceUrl,
  mode,
}: {
  file: ModuleFileNode;
  kind: LocalFileViewerKind;
  sourceUrl?: string | null | undefined;
  mode: string;
}): string {
  const ext = file.localFile?.ext || extensionOf(file.name) || kind;

  return [
    `Create an engineering conversion job for uploaded file "${file.name}".`,
    `Requested mode: ${mode}.`,
    `File id: ${file.id}.`,
    `Module id: ${file.moduleId}.`,
    `MIME type: ${file.mimeType}.`,
    `Extension: ${ext}.`,
    `Size bytes: ${file.size}.`,
    sourceUrl ? `Local runtime source URL: ${sourceUrl}.` : 'No direct local runtime source URL is available.',
    'Return auditable lightweight viewer artifacts when the backend conversion pipeline supports this source format.',
  ].join('\n');
}

function EngineeringCard({
  file,
  kind,
  sourceUrl,
  onRenderableArtifact,
}: {
  file: ModuleFileNode;
  kind: LocalFileViewerKind;
  sourceUrl?: string | null;
  onRenderableArtifact?: (source: RenderableArtifactSource) => void;
}) {
  const [log, setLog] = useState<string[]>([]);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [phase, setPhase] = useState<EngineeringJobPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generationMode = selectEngineeringGenerationMode(file);
  const artifactCount = artifacts.length || job?.artifacts?.length || 0;
  const isSubmitting = phase === 'creating' || phase === 'planning' || phase === 'running';

  function addLog(message: string) {
    setLog((current) => [`${new Date().toLocaleTimeString()} · ${message}`, ...current].slice(0, 8));
  }

  async function createParseJob() {
    setErrorMessage(null);
    setArtifacts([]);

    try {
      setPhase('creating');
      addLog(`正在创建后端解析任务: ${generationMode}`);

      const created = await generationClient.create({
        moduleId: file.moduleId,
        mode: generationMode,
        prompt: buildEngineeringPrompt({ file, kind, sourceUrl, mode: generationMode }),
        actor: 'frontend-engineering-card',
      });
      setJob(created);
      addLog(`解析任务已创建: ${created.id}`);

      setPhase('planning');
      const planned = await generationClient.plan(created.id, {
        actor: 'frontend-engineering-card',
        comment: `Plan engineering conversion for ${file.name}`,
      });
      setJob(planned);
      addLog(`解析任务已规划: ${planned.status}`);

      setPhase('running');
      const run = await generationClient.run(planned.id, {
        actor: 'frontend-engineering-card',
        comment: `Run engineering conversion mode ${generationMode}`,
      });
      const artifactPage = await generationClient.artifacts(run.id);
      setArtifacts(artifactPage.artifacts);

      const renderable = artifactPage.artifacts
        .map(renderableSourceFromArtifact)
        .find((source): source is RenderableArtifactSource => Boolean(source));

      if (renderable) {
        onRenderableArtifact?.(renderable);
        addLog(`发现可渲染工程模型 artifact，已挂载到 BIMViewer: ${renderable.fileName}`);
      }

      setJob({ ...run, artifacts: artifactPage.artifacts });
      setPhase('completed');
      addLog(`解析任务已运行: ${run.status}; artifacts=${artifactPage.artifacts.length}`);
    } catch (error) {
      const message = describeGenerationError(error);
      setErrorMessage(message);
      setPhase('failed');
      addLog(`解析任务失败: ${message}`);
    }
  }

  return (
    <section className="arch-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="arch-primary-text text-xs font-black uppercase tracking-[0.2em]">Engineering object</p>
          <h3 className="arch-text mt-2 text-2xl font-black">工程文件查看卡</h3>
          <p className="arch-muted mt-2 max-w-3xl text-sm leading-6">
            {file.name} 已作为 BIM/CAD/点云/3DGS/数控文件进入系统。当前按钮会创建后端 Generation Job，
            并按后端能力执行规划与运行；真实 GLB/3D Tiles 转换取决于 Worker 管线是否已实现对应模式。
          </p>
        </div>
        <Box className="arch-primary-text h-8 w-8" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="文件类型" value={file.localFile?.ext || extensionOf(file.name) || kind} />
        <Metric label="大小" value={formatModuleFileSize(file.size)} />
        <Metric label="模块" value={file.moduleId} />
        <Metric label="解析模式" value={generationMode} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {['加入模型库', '生成解析任务', '提交校核', '归档'].map((action) => {
          const isParseAction = action === '生成解析任务';

          return (
            <button
              key={action}
              type="button"
              disabled={isParseAction && isSubmitting}
              onClick={() => {
                if (isParseAction) {
                  void createParseJob();
                  return;
                }
                addLog(`${action} 已写入前端操作状态`);
              }}
              className="arch-btn-primary rounded-xl px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isParseAction && isSubmitting ? '解析任务执行中...' : action}
            </button>
          );
        })}
      </div>

      {job || errorMessage ? (
        <div className="arch-card-muted mt-4 rounded-2xl border p-4">
          <p className="arch-text text-sm font-black">后端解析任务</p>
          {job ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Job ID" value={job.id} />
              <Metric label="状态" value={String(job.status)} />
              <Metric label="模式" value={String(job.mode ?? generationMode)} />
              <Metric label="产物数量" value={String(artifactCount)} />
            </div>
          ) : null}
          {artifacts.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="arch-text text-xs font-black uppercase tracking-[0.2em]">Artifacts</p>
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-xl border border-[var(--arch-canvas-border)] p-3 text-xs">
                  <p className="arch-text font-black">{artifact.reference.name}</p>
                  <p className="arch-muted mt-1">
                    kind={artifact.kind} · status={artifact.status} · geometry={artifact.artifactMetadata.geometryFormat ?? 'n/a'} · mime={artifact.artifactMetadata.mimeType}
                  </p>
                  <p className="arch-muted mt-1 break-all">
                    objectUri={artifact.objectUri ?? artifact.storageBinding.objectUri}
                  </p>
                  <p className="arch-muted mt-1 break-all">
                    fileReference={artifact.fileReference}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}

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
