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
  PencilLine,
  PlayCircle,
  Table2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import { DockableViewerToolbar } from "@/components/DockableViewerToolbar";
import { ArchivePackageViewer } from "@/components/ArchivePackageViewer";
import { OpenEngineeringEditor } from "@/components/OpenEngineeringEditor";
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
import {
  pdfOperationById,
  pdfOperationRegistry,
  type PdfOperationSpec,
} from "@/lib/pdf-operation-registry";

type OfdNativeState =
  | { status: "loading"; message: string }
  | {
      status: "collabora";
      editorUrl: string;
      manifest: OfficeNativeSessionPreview;
    }
  | { status: "package"; manifest: OfdNativeManifest }
  | { status: "failed"; message: string };

interface OfficeNativeSessionPreview {
  viewer?: string;
  collabora?: {
    editorUrl?: string;
  };
  notes?: string[];
}

interface OfdNativeManifest {
  schema: "architoken.ofd_native_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "ofd";
  sourceChecksum: string;
  standard: "GB/T 33190-2016";
  engine: "PanAEC Engine OFD Native";
  viewer: "ofd_native_package_viewer" | "ofd_native_adapter_required";
  sourceOfRecord: {
    url: string;
    checksum: string;
    substitutePreview: false;
  };
  nativeRoute: "panaec-ofd-package-reader";
  derivativeRoles: [];
  canRenderFixedLayout: boolean;
  nativeAdapterRequired: boolean;
  renderedPages: OfdRenderedPage[];
  entries: OfdNativeEntry[];
  documents: string[];
  pages: string[];
  resources: string[];
  signatures: string[];
  annotations: string[];
  attachments: string[];
  textSnippets: Array<{ path: string; text: string }>;
  notes: string[];
}

interface OfdNativeEntry {
  path: string;
  kind: string;
  directory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  modifiedAt: string | null;
}

interface OfdRenderedPage {
  id: string;
  sourcePath: string;
  width: number;
  height: number;
  objects: OfdRenderedText[];
}

interface OfdRenderedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontId: string | null;
  fontFamily: string;
  fontSize: number;
  fill: string;
}

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
        <FileBody
          key={`${file.id}:${file.localFile?.checksum ?? file.checksum ?? file.version}`}
          kind={kind}
          sourceUrl={sourceUrl}
          file={file}
        />
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

function OfdNativeViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const fileId = file.localFile?.fileId;
  const [state, setState] = useState<OfdNativeState>({
    status: "loading",
    message: "正在请求 Collabora OFD 原生 WOPI 能力...",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fileId) {
        setState({ status: "failed", message: "OFD 文件缺少本地源文件绑定。" });
        return;
      }

      try {
        const officeResponse = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/office-session`,
          { cache: "no-store" },
        );
        if (officeResponse.ok) {
          const officeManifest =
            (await officeResponse.json()) as OfficeNativeSessionPreview;
          const editorUrl = officeManifest.collabora?.editorUrl;
          if (
            officeManifest.viewer === "collabora_wopi_editor" &&
            typeof editorUrl === "string" &&
            editorUrl
          ) {
            if (!cancelled) {
              setState({
                status: "collabora",
                editorUrl,
                manifest: officeManifest,
              });
            }
            return;
          }
        }
      } catch {
        // Collabora is a preferred native route, not the only native OFD route.
      }

      try {
        if (!cancelled) {
          setState({
            status: "loading",
            message: "Collabora 未声明 OFD，正在打开 PanAEC OFD 原生包...",
          });
        }
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/ofd-native`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "OFD 原生包读取失败。");
        }
        if (!cancelled) {
          setState({
            status: "package",
            manifest: payload as OfdNativeManifest,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (state.status === "collabora") {
    return (
      <section className="relative min-h-[calc(100vh-170px)] overflow-hidden rounded-lg border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-bg)]">
        <BasicFileToolbar
          file={file}
          sourceUrl={sourceUrl}
          title="OFD 原生查看"
          subtitle="Collabora WOPI discovery 已声明 OFD"
          metrics={[
            { label: "标准", value: "GB/T 33190-2016" },
            { label: "源文件", value: "CDE source of record" },
          ]}
        />
        <iframe
          title={`${file.name} OFD Collabora native viewer`}
          src={state.editorUrl}
          className="h-[calc(100vh-230px)] min-h-[640px] w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className="arch-card rounded-lg p-5">
        <ArchLoadingFlow label={state.message} />
      </section>
    );
  }

  if (state.status === "failed") {
    return (
      <InfoCard
        title="OFD 原生打开失败"
        description={state.message}
        file={file}
        kind="ofd"
      />
    );
  }

  const manifest = state.manifest;
  const firstRenderedPage = manifest.renderedPages[0] ?? null;
  const counts = [
    { label: "文档", value: String(manifest.documents.length) },
    { label: "页面", value: String(manifest.pages.length) },
    { label: "资源", value: String(manifest.resources.length) },
    { label: "签章", value: String(manifest.signatures.length) },
    { label: "附件", value: String(manifest.attachments.length) },
  ];

  return (
    <section className="relative min-h-[calc(100vh-170px)] overflow-hidden rounded-lg border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-bg)] p-3">
      <BasicFileToolbar
        file={file}
        sourceUrl={sourceUrl}
        title="OFD 原生查看"
        subtitle="PanAEC OFD native package reader"
        metrics={[
          { label: "标准", value: manifest.standard },
          { label: "源记录", value: "未替换" },
          { label: "派生", value: "0" },
        ]}
      />
      {firstRenderedPage ? (
        <OfdRenderedPageCanvas page={firstRenderedPage} />
      ) : (
        <div className="mb-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
          当前 OFD 包未解析到可直接绘制的页面对象，下面显示源包结构。
        </div>
      )}
      <div className="grid max-h-[calc(100vh-250px)] gap-3 overflow-auto lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-md border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-panel)]">
          <div className="border-b border-[var(--arch-canvas-border)] px-3 py-2">
            <p className="text-xs font-medium text-cyan-200">OFD 源包目录</p>
            <p className="mt-1 text-xs text-slate-300">
              直接读取 .ofd 源包；未生成 PDF、图片、OCR 或文本派生。
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-medium">路径</th>
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 text-right font-medium">大小</th>
                </tr>
              </thead>
              <tbody>
                {manifest.entries.slice(0, 260).map((entry) => (
                  <tr
                    key={entry.path}
                    className="border-t border-[var(--arch-canvas-border)]"
                  >
                    <td className="max-w-[520px] truncate px-3 py-2 text-slate-100">
                      {entry.path}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {ofdKindLabel(entry.kind)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {formatModuleFileSize(entry.uncompressedSize)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="space-y-3">
          <div className="rounded-md border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-panel)] p-3">
            <p className="text-xs font-medium text-cyan-200">原生能力状态</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {counts.map((metric) => (
                <Metric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              完整固定版式渲染、电子签章校验和发票语义校验仍需 GB/T 33190-2016
              OFD runtime adapter；当前界面是源包级原生打开。
            </p>
          </div>
          <div className="rounded-md border border-[var(--arch-canvas-border)] bg-[var(--arch-canvas-panel)] p-3">
            <p className="text-xs font-medium text-cyan-200">源 XML 摘要</p>
            <div className="mt-2 space-y-2">
              {manifest.textSnippets.slice(0, 4).map((snippet) => (
                <div
                  key={snippet.path}
                  className="rounded-md border border-[var(--arch-canvas-border)] p-2"
                >
                  <p className="truncate text-[11px] text-slate-400">
                    {snippet.path}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-100">
                    {snippet.text}
                  </p>
                </div>
              ))}
              {manifest.textSnippets.length === 0 ? (
                <p className="text-xs text-slate-300">
                  未在源 XML 中提取到可显示文字。
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function OfdRenderedPageCanvas({ page }: { page: OfdRenderedPage }) {
  return (
    <div className="mb-3 rounded-md border border-slate-700 bg-slate-950 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-cyan-200">OFD 页面渲染</p>
          <p className="mt-1 text-xs text-slate-300">
            {page.sourcePath} · {page.width} × {page.height} mm ·{" "}
            {page.objects.length} objects
          </p>
        </div>
        <span className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
          source XML render
        </span>
      </div>
      <div className="max-h-[calc(100vh-360px)] min-h-[520px] overflow-auto rounded bg-slate-900 p-4">
        <svg
          viewBox={`0 0 ${page.width} ${page.height}`}
          role="img"
          aria-label={`OFD page ${page.id}`}
          className="mx-auto block h-[760px] max-h-[calc(100vh-410px)] min-h-[520px] w-auto rounded bg-white shadow-2xl"
        >
          <rect
            x="0"
            y="0"
            width={page.width}
            height={page.height}
            fill="#fff"
          />
          {page.objects.map((object, index) => (
            <text
              key={`${object.id}:${index}`}
              x={object.x}
              y={object.y}
              fill={object.fill}
              fontFamily={`${object.fontFamily}, "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`}
              fontSize={object.fontSize}
            >
              {object.text}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function ofdKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    "ofd-root": "OFD 根",
    document: "文档",
    page: "页面",
    resource: "资源",
    signature: "签章",
    annotation: "批注",
    attachment: "附件",
    xml: "XML",
    data: "数据",
  };
  return labels[kind] ?? kind;
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

  if (kind === "ofd" || ext === ".ofd") {
    return <OfdNativeViewer file={file} sourceUrl={sourceUrl} />;
  }

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
          description="PanAEC Engine 不再把 OBJ/FBX 作为默认查看、转换或导出目标。新工程模型必须优先进入 OpenUSD/USDZ/3D Tiles；仅在这些路线不可用且有审计理由时，才允许降级到 glTF/GLB。"
          file={file}
          kind={kind}
        />
      );
    }

    if (ext === ".dwg") {
      return <OpenEngineeringEditor file={file} sourceUrl={sourceUrl} />;
    }

    return requiresWorkerDerivative(file) ? (
      <UnsupportedNativeViewer file={file} />
    ) : (
      <OpenEngineeringEditor file={file} sourceUrl={sourceUrl} />
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const nativePdfUrl = `${sourceUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=1`;

  return (
    <div className="space-y-3">
      <section className="relative h-[calc(100vh-170px)] min-h-[560px] overflow-hidden rounded-md border border-[var(--arch-border)] bg-slate-100">
        <DockableViewerToolbar
          title="PDF 查看"
          subtitle="浏览器原生查看；编辑/处理经 Stirling-PDF sidecar"
          metrics={[
            { label: "格式", value: "PDF" },
            { label: "大小", value: formatModuleFileSize(file.size) },
            { label: "渲染", value: "浏览器原生" },
            { label: "工具", value: "Stirling-PDF" },
            { label: "OCR", value: "PaddleOCR" },
            { label: "源文件", value: "Range/ETag 流" },
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={() => setToolsOpen(true)}
                className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
                title="PDF 工具"
                aria-label="PDF 工具"
              >
                <FileUp className="h-4 w-4" />
              </button>
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
      {toolsOpen ? (
        <PdfOperationDialog file={file} onClose={() => setToolsOpen(false)} />
      ) : null}
    </div>
  );
}

function PdfOperationDialog({
  file,
  onClose,
}: {
  file: ModuleFileNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-end bg-black/20 p-4">
      <div className="max-h-[calc(100vh-48px)] w-[min(760px,calc(100vw-32px))] overflow-auto rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--arch-border)] px-3 py-2">
          <h3 className="text-sm font-medium text-[var(--arch-text)]">
            PDF 工具
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <PdfOperationPanel file={file} />
      </div>
    </div>
  );
}

type PdfOperationSaveMode = "new_file" | "overwrite" | "artifact_only";
type PdfOperationRunState =
  | { status: "idle"; message: string }
  | { status: "running"; message: string }
  | {
      status: "completed";
      message: string;
      savedName?: string;
      artifactCount: number;
    }
  | { status: "failed"; message: string };

interface PdfEditTemplate {
  id: string;
  operationId: string;
  label: string;
  fields: Record<string, unknown>;
  saveMode?: PdfOperationSaveMode;
}

const pdfEditTemplates: PdfEditTemplate[] = [
  {
    id: "rotate",
    operationId: "rotate-pdf",
    label: "旋转",
    fields: { angle: 90 },
  },
  {
    id: "remove-pages",
    operationId: "remove-pages",
    label: "删页",
    fields: { pageNumbers: "1" },
  },
  {
    id: "page-numbers",
    operationId: "add-page-numbers",
    label: "页码",
    fields: {
      pageNumbers: "all",
      pagesToNumber: "all",
      fontSize: 12,
      fontType: "Helvetica",
      fontColor: "#000000",
      position: 8,
      startingNumber: 1,
      customText: "{n}",
      customMargin: "medium",
      zeroPad: 0,
    },
  },
  {
    id: "watermark",
    operationId: "add-watermark",
    label: "水印",
    fields: {
      watermarkType: "text",
      watermarkText: "DRAFT",
      fontSize: 30,
      rotation: 45,
      opacity: 0.25,
      widthSpacer: 50,
      heightSpacer: 50,
      customColor: "#d3d3d3",
      convertPDFToImage: false,
    },
  },
  {
    id: "metadata",
    operationId: "update-metadata",
    label: "元数据",
    fields: { deleteAll: false, title: "", author: "", subject: "" },
  },
  {
    id: "fill-form",
    operationId: "fill",
    label: "填表",
    fields: { data: "{}" },
  },
  {
    id: "flatten",
    operationId: "flatten",
    label: "展平",
    fields: { flattenOnlyForms: true },
  },
  {
    id: "sanitize",
    operationId: "sanitize-pdf",
    label: "清理",
    fields: {
      removeJavaScript: true,
      removeEmbeddedFiles: true,
      removeXMPMetadata: false,
      removeMetadata: false,
      removeLinks: false,
      removeFonts: false,
    },
  },
  {
    id: "ocr",
    operationId: "ocr-pdf",
    label: "OCR",
    fields: {
      languages: ["eng"],
      ocrType: "skip-text",
      ocrRenderType: "hocr",
      deskew: true,
      clean: false,
      cleanFinal: false,
      sidecar: false,
      removeImagesAfter: false,
    },
  },
  {
    id: "paddle-layout",
    operationId: "paddleocr-layout",
    label: "版面",
    fields: {},
    saveMode: "artifact_only",
  },
];

function PdfOperationPanel({ file }: { file: ModuleFileNode }) {
  const fileId = file.localFile?.fileId;
  const [operationId, setOperationId] = useState("basic-info");
  const [fieldsJson, setFieldsJson] = useState("{}");
  const [additionalFileIdsText, setAdditionalFileIdsText] = useState("");
  const [saveMode, setSaveMode] = useState<PdfOperationSaveMode>("new_file");
  const [lang, setLang] = useState("ch");
  const [stirlingOperationPath, setStirlingOperationPath] = useState("");
  const [state, setState] = useState<PdfOperationRunState>({
    status: "idle",
    message: "等待执行 PDF 操作",
  });
  const selectedOperation = pdfOperationById(operationId);

  function applyTemplate(template: PdfEditTemplate) {
    setOperationId(template.operationId);
    const fields =
      template.operationId === "update-metadata"
        ? { ...template.fields, title: file.name.replace(/\.[^.]+$/, "") }
        : template.fields;
    setFieldsJson(JSON.stringify(fields, null, 2));
    if (template.saveMode) {
      setSaveMode(template.saveMode);
    }
    setState({
      status: "idle",
      message: `${template.label} 参数已载入，可检查后执行。`,
    });
  }

  async function runOperation(requestedOperationId = operationId) {
    const operation = pdfOperationById(requestedOperationId);
    if (!fileId) {
      setState({
        status: "failed",
        message: "当前 PDF 未绑定本地源文件，不能执行源文件操作。",
      });
      return;
    }
    if (!operation) {
      setState({ status: "failed", message: "未识别的 PDF 操作。" });
      return;
    }
    let fields: Record<string, unknown>;
    try {
      fields = JSON.parse(fieldsJson) as Record<string, unknown>;
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        throw new Error("fields 必须是 JSON object。");
      }
    } catch (error) {
      setState({
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    setOperationId(requestedOperationId);
    setState({
      status: "running",
      message: `${operation.label} 正在执行...`,
    });
    try {
      const response = await fetch(
        `/api/local-files/${encodeURIComponent(fileId)}/pdf-operation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfOperation: requestedOperationId,
            fields,
            saveMode:
              operation.engine === "paddleocr" ? "artifact_only" : saveMode,
            lang,
            additionalFileIds: parseAdditionalPdfFileIds(additionalFileIdsText),
            ...(stirlingOperationPath.trim()
              ? { stirlingOperationPath: stirlingOperationPath.trim() }
              : {}),
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        savedFile?: { originalName?: string; fileId?: string } | null;
        workerResult?: {
          status?: string;
          artifacts?: unknown[];
          error?: { message?: string };
        };
      };
      if (!response.ok || payload.workerResult?.status !== "completed") {
        throw new Error(
          payload.workerResult?.error?.message ||
            payload.error ||
            `PDF operation failed with HTTP ${response.status}`,
        );
      }
      const savedName = payload.savedFile?.originalName;
      setState({
        status: "completed",
        message: `${operation.label} 已完成`,
        ...(savedName ? { savedName } : {}),
        artifactCount: payload.workerResult?.artifacts?.length ?? 0,
      });
    } catch (error) {
      setState({
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <section className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="arch-primary-text text-xs font-medium">PDF 操作</p>
          <p className="arch-muted mt-1 text-xs">
            Stirling-PDF / PaddleOCR · 真实 artifact 或明确失败
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {pdfEditTemplates.map((template) => {
            const operation = pdfOperationById(template.operationId);
            if (!operation) return null;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="viewer-ghost-tool flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium"
                title={`${operation.label} 参数模板`}
                aria-label={`${operation.label} 参数模板`}
                disabled={state.status === "running"}
              >
                {quickOperationIcon(operation)}
                <span>{template.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(220px,1.1fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)_minmax(160px,0.7fr)]">
        <label className="grid gap-1 text-xs font-medium text-[var(--arch-text-muted)]">
          操作
          <select
            value={operationId}
            onChange={(event) => setOperationId(event.target.value)}
            className="rounded-md border border-[var(--arch-border)] bg-white px-2 py-2 text-sm text-[var(--arch-text)]"
          >
            {pdfOperationRegistry.map((operation) => (
              <option key={operation.id} value={operation.id}>
                {operation.category} · {operation.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-[var(--arch-text-muted)]">
          保存
          <select
            value={
              selectedOperation?.engine === "paddleocr"
                ? "artifact_only"
                : saveMode
            }
            onChange={(event) =>
              setSaveMode(event.target.value as PdfOperationSaveMode)
            }
            disabled={selectedOperation?.engine === "paddleocr"}
            className="rounded-md border border-[var(--arch-border)] bg-white px-2 py-2 text-sm text-[var(--arch-text)] disabled:opacity-60"
          >
            <option value="new_file">新文件</option>
            <option value="overwrite">覆盖源文件</option>
            <option value="artifact_only">仅证据</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-[var(--arch-text-muted)]">
          OCR 语言
          <input
            value={lang}
            onChange={(event) => setLang(event.target.value)}
            className="rounded-md border border-[var(--arch-border)] bg-white px-2 py-2 text-sm text-[var(--arch-text)]"
          />
        </label>
        <button
          type="button"
          onClick={() => void runOperation()}
          disabled={state.status === "running"}
          className="mt-5 flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--arch-primary)] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {state.status === "running" ? (
            <ArchLoadingFlow label="执行中" size="inline" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          执行
        </button>
      </div>
      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-[var(--arch-text-muted)]">
          fields JSON
          <textarea
            value={fieldsJson}
            onChange={(event) => setFieldsJson(event.target.value)}
            rows={3}
            spellCheck={false}
            className="resize-y rounded-md border border-[var(--arch-border)] bg-white px-2 py-2 font-mono text-xs text-[var(--arch-text)]"
          />
        </label>
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs font-medium text-[var(--arch-text-muted)]">
            附加 PDF fileId
            <input
              value={additionalFileIdsText}
              onChange={(event) => setAdditionalFileIdsText(event.target.value)}
              className="rounded-md border border-[var(--arch-border)] bg-white px-2 py-2 text-sm text-[var(--arch-text)]"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--arch-text-muted)]">
            自定义 Stirling API Path
            <input
              value={stirlingOperationPath}
              onChange={(event) => setStirlingOperationPath(event.target.value)}
              className="rounded-md border border-[var(--arch-border)] bg-white px-2 py-2 text-sm text-[var(--arch-text)]"
            />
          </label>
        </div>
      </div>
      <PdfOperationStatus state={state} />
    </section>
  );
}

function quickOperationIcon(operation: PdfOperationSpec) {
  if (operation.engine === "paddleocr") {
    return <PencilLine className="h-4 w-4" />;
  }
  if (operation.id.includes("info")) {
    return <FileText className="h-4 w-4" />;
  }
  if (operation.id.includes("pdfa")) {
    return <Archive className="h-4 w-4" />;
  }
  return <FileUp className="h-4 w-4" />;
}

function PdfOperationStatus({ state }: { state: PdfOperationRunState }) {
  const tone =
    state.status === "failed"
      ? "border-red-400/40 bg-red-400/10 text-red-600"
      : state.status === "completed"
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-700"
        : "border-[var(--arch-border)] bg-[var(--arch-surface-muted)] text-[var(--arch-text-muted)]";
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <span>{state.message}</span>
      {state.status === "completed" ? (
        <span className="ml-2">
          artifact {state.artifactCount}
          {state.savedName ? ` · ${state.savedName}` : ""}
        </span>
      ) : null}
    </div>
  );
}

function parseAdditionalPdfFileIds(value: string): string[] {
  return value
    .split(/[\s,，]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
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
  if (kind === "ofd") return <FileText className="h-6 w-6" />;
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
    ofd: "OFD",
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
