// components/UniversalFileViewer.tsx - Universal file viewer
// License: Apache-2.0
"use client";

import {
  Archive,
  AlertTriangle,
  Bot,
  Box,
  Code2,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileText,
  ImageIcon,
  Music,
  PencilLine,
  PlayCircle,
  Table2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { DockableViewerToolbar } from "@/components/DockableViewerToolbar";
import { ArchivePackageViewer } from "@/components/ArchivePackageViewer";
import { OpenEngineeringViewer } from "@/components/OpenEngineeringViewer";
import {
  OfficeDocumentViewer,
  TextDataViewer,
} from "@/components/OfficeDocumentViewer";
import { requiredAdaptersForFileName } from "@/lib/adapter-source-registry";
import {
  extensionOf,
  fileTypeForFileName,
  stageRouteForFileName,
} from "@/lib/file-type-registry";
import { getLocalFileViewerKind } from "@/lib/local-file-runtime";
import type { LocalFileViewerKind } from "@/lib/local-file-runtime";
import type { ModuleFileNode } from "@/lib/module-file-system";
import { formatModuleFileSize } from "@/lib/module-file-system";

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
        <section className="arch-card rounded-lg p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              {viewerIcon(kind)}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="arch-text truncate text-lg font-medium">
                {file.name}
              </h3>
              <p className="arch-muted mt-1 text-sm">
                {file.mimeType} · {formatModuleFileSize(file.size)} ·{" "}
                {file.version}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label={viewerKindLabel(kind)} />
                <Badge label={file.status} />
                {file.source === "local_upload" ? (
                  <Badge label="本地运行时" />
                ) : (
                  <Badge label="仅元数据" />
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sourceUrl ? (
        <>
          <FileAiEditCapabilityStrip file={file} kind={kind} />
          <FileBody kind={kind} sourceUrl={sourceUrl} file={file} />
        </>
      ) : (
        <MissingContentBinding kind={kind} file={file} />
      )}
    </div>
  );
}

function FileAiEditCapabilityStrip({
  file,
  kind,
}: {
  file: ModuleFileNode;
  kind: LocalFileViewerKind;
}) {
  const fileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const ext = (file.localFile?.ext || extensionOf(file.name) || "").toLowerCase();
  const [status, setStatus] = useState("Router 待命");
  const disabled = !fileId;

  async function run(action: "ai_generate" | "online_edit") {
    if (!fileId) {
      setStatus("缺少真实源文件绑定");
      return;
    }

    setStatus(action === "ai_generate" ? "AI 生成任务编排中" : "在线编辑器编排中");
    try {
      const response = await fetch(
        `/api/local-files/${encodeURIComponent(fileId)}/ai-actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json()) as {
        status?: string;
        adapter?: string;
        operationId?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setStatus(
        `${payload.status ?? "queued"} · ${payload.adapter ?? "Router"} · ${
          payload.operationId ?? "operation"
        }`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "操作创建失败");
    }
  }

  return (
    <section className="arch-card-muted flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="min-w-0">
        <p className="arch-text text-xs font-medium">
          AI 生成 / 在线编辑能力
        </p>
        <p className="arch-muted mt-0.5 truncate text-[11px]">
          {fileCapabilityLabel(kind, ext)} · {status}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void run("ai_generate")}
          className="viewer-ghost-tool inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium disabled:opacity-45"
          title="通过 InferenceRouter 创建 AI 生成任务"
        >
          <Bot className="h-3.5 w-3.5" />
          AI生成
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void run("online_edit")}
          className="viewer-ghost-tool inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium disabled:opacity-45"
          title="通过 ToolRouter 打开在线编辑适配器"
        >
          <PencilLine className="h-3.5 w-3.5" />
          在线编辑
        </button>
      </div>
    </section>
  );
}

function fileCapabilityLabel(kind: LocalFileViewerKind, ext: string): string {
  if (ext === ".dwg" || ext === ".dxf") return "CAD 图纸原生矢量 / DWG-DXF adapter";
  if ([".step", ".stp", ".iges", ".igs"].includes(ext)) return "OCCT B-Rep / CAD exchange";
  if (ext === ".stl") return "STL mesh / material color";
  if (ext === ".skp") return "SketchUp / Speckle / Blender adapter";
  if ([".3dm", ".gh", ".ghx"].includes(ext)) return "Rhino3dm / OpenNURBS adapter";
  if (ext === ".blend") return "Blender external service";
  if (ext === ".ifc" || ext === ".ifczip") return "IFC / openBIM";
  if (kind === "office") return "Office WOPI / Collabora / OnlyOffice / Univer";
  if (kind === "pdf") return "PDF 源流 / MuPDF / Stirling";
  if (kind === "image") return "Image AI / OpenCV / ImageMagick";
  if (kind === "video") return "Video AI / FFmpeg";
  return `${viewerKindLabel(kind)} Router`;
}

function MissingContentBinding({
  kind,
  file,
}: {
  kind: LocalFileViewerKind;
  file: ModuleFileNode;
}) {
  if (kind === "engineering") {
    return <EngineeringSourceBindingPanel file={file} />;
  }

  return (
    <InfoCard
      title="缺少真实文件内容绑定"
      description="该行目前只有模块文件元数据，没有本地上传文件流或对象存储绑定。前端不会生成伪 PDF、伪图像或伪 3D 模型。"
      file={file}
      kind={kind}
    />
  );
}

function EngineeringSourceBindingPanel({ file }: { file: ModuleFileNode }) {
  const ext = file.localFile?.ext || extensionOf(file.name) || "unknown";
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
              <h3 className="arch-text text-base font-medium">
                需要绑定真实 {ext.toUpperCase()} 文件流
              </h3>
              <p className="arch-muted mt-2 max-w-4xl text-sm leading-6">
                当前行是模块种子元数据，不包含可解析的本地上传对象或后端
                derivative URL。DXF/IFC/STEP
                预览必须读取真实字节；系统不会生成伪图纸或伪模型。
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <Metric label="格式" value={ext} />
            <Metric label="MIME" value={file.mimeType} />
            <Metric label="来源" value={file.source ?? "metadata"} />
            <Metric label="大小" value={formatModuleFileSize(file.size)} />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3">
          <p className="arch-primary-text font-mono text-[10px] font-medium">
            生产路由
          </p>
          <p className="arch-text mt-2 break-words text-sm font-medium">
            {adapter}
          </p>
          <div className="mt-3 grid gap-2">
            <Metric
              label="源文件流"
              value={file.localFile ? "已绑定" : "未绑定"}
            />
            <Metric label="派生结果" value="等待 worker manifest" />
          </div>
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

  if (kind === "image") {
    return (
      <section className="arch-card-muted relative min-h-[calc(100vh-170px)] overflow-hidden rounded-lg p-4">
        <BasicFileToolbar
          file={file}
          sourceUrl={sourceUrl}
          title="图像查看"
          subtitle="浏览器原生图像"
          metrics={[{ label: "适配", value: "contain" }]}
        />
        <div className="relative min-h-[calc(100vh-202px)]">
          <Image
            src={sourceUrl}
            alt={file.name}
            fill
            unoptimized
            sizes="100vw"
            className="rounded-lg object-contain p-4"
          />
        </div>
      </section>
    );
  }

  if (kind === "video") {
    return (
      <section className="relative min-h-[calc(100vh-170px)] overflow-hidden rounded-lg border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-bg)] p-3">
        <BasicFileToolbar
          file={file}
          sourceUrl={sourceUrl}
          title="视频查看"
          subtitle="浏览器原生媒体"
          metrics={[{ label: "控制", value: "播放/暂停/音量" }]}
        />
        <video
          src={sourceUrl}
          controls
          className="max-h-[calc(100vh-180px)] w-full rounded-lg"
        />
      </section>
    );
  }

  if (kind === "audio") {
    return (
      <section className="arch-card relative min-h-[220px] overflow-hidden rounded-lg p-5">
        <BasicFileToolbar
          file={file}
          sourceUrl={sourceUrl}
          title="音频查看"
          subtitle="浏览器原生媒体"
          metrics={[{ label: "控制", value: "播放/暂停/音量" }]}
        />
        <audio src={sourceUrl} controls className="w-full" />
      </section>
    );
  }

  if (kind === "pdf") {
    return <PdfFileViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (kind === "text" || kind === "json" || kind === "csv") {
    if (ext === ".html" || ext === ".htm") {
      return <HtmlFileViewer file={file} sourceUrl={sourceUrl} />;
    }
    return <TextDataViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (kind === "office") {
    return <OfficeDocumentViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (kind === "engineering") {
    if (ext === ".dwg") {
      return <OpenEngineeringViewer file={file} sourceUrl={sourceUrl} />;
    }

    return requiresWorkerDerivative(file) ? (
      <UnsupportedNativeViewer file={file} />
    ) : (
      <OpenEngineeringViewer file={file} sourceUrl={sourceUrl} />
    );
  }

  if (kind === "archive") {
    if (ext === ".zip" || ext === ".ifczip" || ext === ".bcfzip") {
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

function BasicFileToolbar({
  file,
  sourceUrl,
  title,
  subtitle,
  metrics = [],
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  title: string;
  subtitle: string;
  metrics?: Array<{ label: string; value: string }>;
}) {
  return (
    <DockableViewerToolbar
      title={title}
      subtitle={subtitle}
      metrics={[
        { label: "格式", value: extensionOf(file.name) || "source" },
        { label: "大小", value: formatModuleFileSize(file.size) },
        { label: "MIME", value: file.mimeType },
        ...metrics,
      ]}
      actions={
        <>
          <a
            href={sourceUrl}
            download={file.name}
            className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
            title="下载源文件"
            aria-label="下载源文件"
          >
            <Download className="h-4 w-4" />
          </a>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
            title="在新标签打开源文件"
            aria-label="在新标签打开源文件"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </>
      }
    />
  );
}

function HtmlFileViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [mode, setMode] = useState<"code" | "visual">("visual");

  return (
    <section className="relative h-[calc(100vh-170px)] min-h-[560px] overflow-hidden rounded-md bg-[var(--arch-surface-muted)]">
      <DockableViewerToolbar
        title="HTML 查看"
        subtitle={mode === "code" ? "代码模式" : "可视化模式"}
        metrics={[
          { label: "格式", value: "HTML" },
          { label: "大小", value: formatModuleFileSize(file.size) },
          { label: "模式", value: mode === "code" ? "代码" : "可视化" },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => setMode("code")}
              className={`viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md ${
                mode === "code" ? "text-[var(--arch-primary)]" : ""
              }`}
              title="代码模式"
              aria-label="代码模式"
            >
              <Code2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMode("visual")}
              className={`viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md ${
                mode === "visual" ? "text-[var(--arch-primary)]" : ""
              }`}
              title="可视化模式"
              aria-label="可视化模式"
            >
              <Eye className="h-4 w-4" />
            </button>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
              title="在新标签打开"
              aria-label="在新标签打开"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </>
        }
      />
      {mode === "code" ? (
        <TextDataViewer file={file} sourceUrl={sourceUrl} />
      ) : (
        <iframe
          src={sourceUrl}
          className="h-full w-full border-0 bg-white"
          title={`${file.name} 可视化预览`}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      )}
    </section>
  );
}

function PdfFileViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const nativePdfUrl = `${sourceUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=1`;

  return (
    <section className="relative h-[calc(100vh-170px)] min-h-[560px] overflow-hidden rounded-md border border-[var(--arch-border)] bg-slate-100">
      <DockableViewerToolbar
        title="PDF 查看"
        subtitle="浏览器原生多页矢量 PDF"
        metrics={[
          { label: "格式", value: "PDF" },
          { label: "大小", value: formatModuleFileSize(file.size) },
          { label: "页码", value: "多页连续" },
          { label: "渲染", value: "原生矢量" },
          { label: "源文件", value: "Range/ETag 流" },
        ]}
        actions={
          <>
            <a
              href={sourceUrl}
              download={file.name}
              className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
              title="下载源 PDF"
              aria-label="下载源 PDF"
            >
              <Download className="h-4 w-4" />
            </a>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
              title="在新标签打开源 PDF"
              aria-label="在新标签打开源 PDF"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </>
        }
      />
      <object
        data={nativePdfUrl}
        type="application/pdf"
        className="h-full w-full bg-white"
        aria-label={`${file.name} 多页 PDF 矢量查看器`}
      >
        <iframe
          src={nativePdfUrl}
          className="h-full w-full border-0 bg-white"
          title={`${file.name} 多页 PDF 矢量查看器`}
        />
      </object>
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
    <section className="arch-card rounded-lg p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="arch-primary-soft flex h-12 w-12 items-center justify-center rounded-lg">
          {viewerIcon(kind)}
        </span>
        <div>
          <h3 className="arch-text text-xl font-medium">{title}</h3>
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
    <div className="arch-card-muted rounded-lg px-3 py-2">
      <p className="arch-muted text-[11px] font-medium">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="arch-chip rounded-md px-2.5 py-1 text-xs font-medium">
      {label}
    </span>
  );
}

function UnsupportedNativeViewer({ file }: { file: ModuleFileNode }) {
  return (
    <section className="arch-card rounded-lg p-5 shadow-sm">
      <h3 className="arch-text text-xl font-medium">需要真实转换 adapter</h3>
      <p className="arch-muted mt-2 text-sm leading-6">
        {file.name} 不能由浏览器直接解析。必须接入真实 CAD/BIM worker
        或授权服务后生成 GLB、glTF、3D Tiles、PDF 或 SVG derivative。
        当前不会用占位内容冒充解析成功。
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="格式"
          value={file.localFile?.ext || extensionOf(file.name) || "unknown"}
        />
        <Metric label="MIME" value={file.mimeType} />
        <Metric label="要求" value={requiredAdapterFor(file)} />
      </div>
    </section>
  );
}

function viewerIcon(kind: LocalFileViewerKind) {
  if (kind === "image") return <ImageIcon className="h-6 w-6" />;
  if (kind === "video") return <PlayCircle className="h-6 w-6" />;
  if (kind === "audio") return <Music className="h-6 w-6" />;
  if (kind === "csv") return <Table2 className="h-6 w-6" />;
  if (kind === "engineering") return <Box className="h-6 w-6" />;
  if (kind === "archive") return <Archive className="h-6 w-6" />;
  if (kind === "json") return <Database className="h-6 w-6" />;
  return <FileText className="h-6 w-6" />;
}

function viewerKindLabel(kind: LocalFileViewerKind): string {
  const labels: Record<LocalFileViewerKind, string> = {
    archive: "归档包",
    audio: "音频",
    csv: "表格数据",
    engineering: "工程模型",
    image: "图片",
    json: "JSON",
    office: "Office",
    pdf: "PDF",
    text: "文本",
    unknown: "通用文件",
    video: "视频",
  };
  return labels[kind];
}

const browserRenderableEngineeringExtensions = new Set([
  ".ifc",
  ".dxf",
  ".glb",
  ".gltf",
  ".stl",
  ".obj",
  ".ply",
  ".fbx",
  ".dae",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".step",
  ".stp",
  ".iges",
  ".igs",
  ".brep",
  ".rvt",
  ".rfa",
  ".skp",
  ".3dm",
]);

function requiresWorkerDerivative(file: ModuleFileNode): boolean {
  const ext = file.localFile?.ext || extensionOf(file.name);
  const registryEntry = fileTypeForFileName(file.name);

  if (!ext) return true;
  if (browserRenderableEngineeringExtensions.has(ext)) return false;
  return registryEntry?.viewerKind === "engineering";
}

function requiredAdapterFor(file: ModuleFileNode): string {
  const stageRoute = stageRouteForFileName(file.name, "preview");
  const registered = fileTypeForFileName(file.name);
  const adapters = requiredAdaptersForFileName(file.name, file.mimeType).join(
    " / ",
  );

  if (!registered || !stageRoute) return adapters;

  return `${registered.productionRoute}: ${stageRoute.adapter} / ${adapters}`;
}
