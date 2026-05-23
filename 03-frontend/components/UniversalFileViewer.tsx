// components/UniversalFileViewer.tsx - Universal file viewer
// License: Apache-2.0
"use client";

import {
  Archive,
  AlertTriangle,
  Box,
  Code2,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileUp,
  FileText,
  ImageIcon,
  Music,
  PlayCircle,
  Table2,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  type FileStageStatus,
} from "@/lib/file-type-registry";
import { getLocalFileViewerKind } from "@/lib/local-file-runtime";
import type { LocalFileViewerKind } from "@/lib/local-file-runtime";
import { moduleFileApiClient } from "@/lib/module-file-api-client";
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
  const previewRoute = stageRouteForFileName(file.name, "preview");

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
                <Badge label={lifecycleStatusLabel(file.status)} />
                <Badge label={previewRouteStatusLabel(previewRoute?.status)} />
                <Badge label={sourceBindingLabel(file)} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sourceUrl ? (
        <FileBody kind={kind} sourceUrl={sourceUrl} file={file} />
      ) : file.source === "backend" && isBackendEditableDocument(file, kind) ? (
        <BackendEditableDocumentViewer file={file} kind={kind} />
      ) : (
        <MissingContentBinding kind={kind} file={file} />
      )}
    </div>
  );
}

function isBackendEditableDocument(
  file: ModuleFileNode,
  kind: LocalFileViewerKind,
): boolean {
  return (
    file.tags.includes("editable-document") &&
    (kind === "office" || kind === "pdf")
  );
}

function BackendEditableDocumentViewer({
  file,
  kind,
}: {
  file: ModuleFileNode;
  kind: LocalFileViewerKind;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [payloadScripts, setPayloadScripts] = useState("");
  const [status, setStatus] = useState("正在读取后端文档内容...");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const content = await moduleFileApiClient.getModuleFileContent(file.id);
        if (cancelled) return;
        const parsed = parseEditableDocumentHtml(content.content);
        setBodyHtml(parsed.bodyHtml);
        setPayloadScripts(parsed.payloadScripts);
        setStatus(`${backendEditableKindLabel(kind)} · 可在线编辑`);
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "读取文档失败");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [file.id, kind]);

  async function save() {
    const edited = editorRef.current?.innerHTML ?? bodyHtml;
    const content = wrapEditableDocumentHtml(file.name, edited, payloadScripts);
    setStatus("正在保存在线编辑内容...");
    try {
      await moduleFileApiClient.updateModuleFileContent(
        file.id,
        content,
        "text/html; charset=utf-8",
        "backend-office-editor",
      );
      setBodyHtml(edited);
      setStatus(`${backendEditableKindLabel(kind)} · 已保存`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    }
  }

  return (
    <section className="arch-card rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arch-border)] pb-3">
        <div className="min-w-0">
          <p className="arch-primary-text arch-type-caption font-medium">
            后端 Office / PDF 文档编辑器
          </p>
          <h3 className="arch-text mt-1 truncate arch-type-title font-medium">
            {file.name}
          </h3>
          <p className="arch-muted mt-1 arch-type-caption">{status}</p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          className="arch-btn-primary rounded-md px-3 py-2 arch-type-list font-medium"
        >
          保存在线编辑
        </button>
      </div>
      <div className="mt-3 max-h-[calc(100vh-220px)] overflow-auto rounded-lg bg-slate-100 p-4">
        <article
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="mx-auto min-h-[680px] max-w-[820px] bg-white px-12 py-10 text-[13px] leading-6 text-slate-950 shadow-sm outline-none focus:ring-2 focus:ring-[var(--arch-primary)]"
          dangerouslySetInnerHTML={{
            __html: bodyHtml || "<p>文档内容为空。</p>",
          }}
        />
      </div>
      <p className="arch-muted mt-2 arch-type-caption leading-5">
        当前为后端 CDE 文档内容的在线编辑视图。正式 DOCX/PDF 二进制导出由后续
        Office/PDF adapter 负责,本界面不会把业务文件暴露为 JSON。
      </p>
    </section>
  );
}

function parseEditableDocumentHtml(content: string): {
  bodyHtml: string;
  payloadScripts: string;
} {
  if (typeof window === "undefined") {
    return { bodyHtml: content, payloadScripts: "" };
  }
  const parser = new DOMParser();
  const parsed = parser.parseFromString(content, "text/html");
  const scripts = Array.from(
    parsed.querySelectorAll("script[data-architoken-payload]"),
  );
  const payloadScripts = scripts.map((script) => script.outerHTML).join("");
  scripts.forEach((script) => script.remove());
  return {
    bodyHtml: parsed.body.innerHTML || escapeViewerText(content),
    payloadScripts,
  };
}

function wrapEditableDocumentHtml(
  fileName: string,
  bodyHtml: string,
  payloadScripts: string,
): string {
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeViewerText(fileName)}</title>`,
    "<style>",
    'body{font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;color:#111827;line-height:1.55;margin:0;padding:32px;background:#fff;}',
    "h1{font-size:22px;margin:0 0 6px}.subtitle{color:#64748b;font-size:12px;margin:0 0 24px}.doc-section{margin-top:20px}h2{font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:0 0 10px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top}th{width:180px;background:#f8fafc;color:#475569;font-weight:600}p{font-size:13px;margin:8px 0}",
    "</style>",
    "</head>",
    "<body>",
    bodyHtml,
    payloadScripts,
    "</body>",
    "</html>",
  ].join("");
}

function backendEditableKindLabel(kind: LocalFileViewerKind): string {
  if (kind === "pdf") return "PDF 版式文档";
  if (kind === "office") return "Office 文档";
  return "业务文档";
}

function escapeViewerText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  if (isBrowserZipArchivePackage(ext)) {
    return <ArchivePackageViewer file={file} sourceUrl={sourceUrl} />;
  }

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
    if (abandonedEngineeringExtensions.has(ext)) {
      return (
        <InfoCard
          title="OBJ / FBX 已退出默认工程链路"
          description="Prengine 不再把 OBJ/FBX 作为默认查看、转换或导出目标。新工程模型必须优先进入 OpenUSD/USDZ/3D Tiles；仅在这些路线不可用且有审计理由时，才允许降级到 glTF/GLB。"
          file={file}
          kind={kind}
        />
      );
    }

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
    return <ArchivePackageViewer file={file} sourceUrl={sourceUrl} />;
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
          <GenericFilePropertyActions file={file} sourceUrl={sourceUrl} />
        </>
      }
    />
  );
}

function GenericFilePropertyActions({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  function exportProperties() {
    const payload = {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      version: file.version,
      sourceUrl,
      localFileId: file.localFileId ?? file.localFile?.fileId ?? null,
      extension: file.localFile?.ext || extensionOf(file.name),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${file.name.replace(/\.[^.]+$/, "") || "file"}-properties.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => templateInputRef.current?.click()}
        className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
        title="上传属性/BOM模板"
        aria-label="上传属性/BOM模板"
      >
        <FileUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={exportProperties}
        className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
        title="导出文件属性"
        aria-label="导出文件属性"
      >
        <FileText className="h-4 w-4" />
      </button>
      <input
        ref={templateInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        className="hidden"
      />
    </>
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
            <GenericFilePropertyActions file={file} sourceUrl={sourceUrl} />
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

function lifecycleStatusLabel(status: ModuleFileNode["status"]): string {
  const labels: Record<ModuleFileNode["status"], string> = {
    active: "已登记",
    uploaded: "已上传",
    downloading: "下载任务",
    shared: "已分享",
    copied: "已复制",
    moved: "已移动",
    schema_validating: "Schema 校验中",
    pending_approval: "待审批",
    soft_deleted: "回收站",
    archived: "已归档",
  };
  return labels[status];
}

function previewRouteStatusLabel(status: FileStageStatus | undefined): string {
  if (status === "ready") return "预览可用";
  if (status === "adapter_required") return "需 Worker";
  if (status === "external_process_required") return "需外部进程";
  if (status === "licensed_adapter_required") return "需授权适配器";
  return "未注册预览";
}

function sourceBindingLabel(file: ModuleFileNode): string {
  if (file.localFile) return "源文件已绑定";
  if (file.tags.includes("editable-document")) return "后端内容文档";
  if (file.source === "backend") return "仅后端元数据";
  if (file.source === "local_upload") return "本地索引缺源";
  return "仅元数据";
}

function isBrowserZipArchivePackage(ext: string): boolean {
  return ext === ".zip" || ext === ".ifczip" || ext === ".bcfzip";
}

const browserRenderableEngineeringExtensions = new Set([
  ".ifc",
  ".dxf",
  ".glb",
  ".gltf",
  ".stl",
  ".ply",
  ".dae",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".b3dm",
  ".i3dm",
  ".pnts",
  ".cmpt",
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

const abandonedEngineeringExtensions = new Set([".obj", ".fbx"]);

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
