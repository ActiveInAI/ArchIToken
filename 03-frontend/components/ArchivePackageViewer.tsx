// components/ArchivePackageViewer.tsx - Native ZIP package listing viewer
// License: Apache-2.0
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Download,
  FileArchive,
  Folder,
  Hash,
  Search,
} from "lucide-react";
import JSZip from "jszip";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import { DockableViewerToolbar } from "@/components/DockableViewerToolbar";
import { FloatingWindowFrame } from "@/components/FloatingWindowFrame";
import { OfficeDocumentViewer } from "@/components/OfficeDocumentViewer";
import { OpenEngineeringEditor } from "@/components/OpenEngineeringEditor";
import { extensionOf, fileTypeForFileName } from "@/lib/file-type-registry";
import {
  formatModuleFileSize,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import type { LocalFileMetadata } from "@/lib/local-file-runtime";

type ArchiveState =
  | { status: "loading"; message: string }
  | {
      status: "ready";
      value: ZipArchiveSummary;
      buffer: ArrayBuffer | null;
      indexLabel: string;
      entryPreviewMode: "browser-zip" | "external-worker";
    }
  | { status: "failed"; message: string };

type ArchiveEntryPreviewState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | {
      status: "ready";
      entry: ZipArchiveEntry;
      url: string;
      text?: string;
      localFile?: LocalFileMetadata;
    }
  | { status: "failed"; entry: ZipArchiveEntry; message: string };

export interface ZipArchiveEntry {
  name: string;
  directory: boolean;
  extension: string;
  kind:
    | "directory"
    | "archive"
    | "cad"
    | "bim"
    | "office"
    | "document"
    | "image"
    | "media"
    | "code"
    | "data"
    | "file";
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  methodLabel: string;
  localHeaderOffset: number;
  encrypted: boolean;
  unsafe: boolean;
  modifiedAt: string;
  depth: number;
}

export interface ZipArchiveSummary {
  entries: ZipArchiveEntry[];
  fileCount: number;
  directoryCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  encryptedCount: number;
  nestedArchiveCount: number;
  unsafePathCount: number;
  zip64: boolean;
  sha256?: string;
  warnings: string[];
}

interface ExternalArchiveManifest {
  schema: "architoken.archive_manifest.v1";
  engine: string;
  entries: ZipArchiveEntry[];
  fileCount: number;
  directoryCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  encryptedCount: number;
  nestedArchiveCount: number;
  unsafePathCount: number;
  warnings: string[];
}

interface ArchivePackageViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

export function ArchivePackageViewer({
  file,
  sourceUrl,
}: ArchivePackageViewerProps) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const browserZip = isBrowserZipArchivePackage(ext);
  const [state, setState] = useState<ArchiveState>({
    status: "loading",
    message: browserZip ? "正在读取 ZIP 中央目录..." : "正在读取归档索引...",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadArchive() {
      setState({
        status: "loading",
        message: browserZip
          ? "正在读取 ZIP 中央目录..."
          : "正在读取归档索引...",
      });
      try {
        if (browserZip) {
          const response = await fetch(sourceUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`读取归档包失败: HTTP ${response.status}`);
          }
          const archiveBytes = await response.arrayBuffer();
          const summary = parseZipCentralDirectory(archiveBytes);
          const digest = await sha256Hex(archiveBytes);
          if (digest) {
            summary.sha256 = digest;
          }
          if (!cancelled) {
            setState({
              status: "ready",
              value: summary,
              buffer: archiveBytes,
              indexLabel: "中央目录索引",
              entryPreviewMode: "browser-zip",
            });
          }
          return;
        }

        const manifestUrl = archiveManifestUrl(file, sourceUrl);
        if (!manifestUrl) {
          throw new Error(
            "该归档包没有绑定本地源文件 ID，无法调用后端归档索引器。",
          );
        }
        const response = await fetch(manifestUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await archiveManifestErrorMessage(response));
        }
        const manifest = (await response.json()) as ExternalArchiveManifest;
        const summary = zipSummaryFromExternalManifest(manifest);
        if (!cancelled) {
          setState({
            status: "ready",
            value: summary,
            buffer: null,
            indexLabel: `${manifest.engine || "7z"} 索引`,
            entryPreviewMode: "external-worker",
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

    void loadArchive();

    return () => {
      cancelled = true;
    };
  }, [browserZip, file, sourceUrl]);

  if (state.status === "loading") {
    return (
      <ArchiveShell file={file}>
        <ArchLoadingFlow label={state.message} size="panel" showLabel />
      </ArchiveShell>
    );
  }

  if (state.status === "failed") {
    return (
      <ArchiveShell file={file}>
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <p className="arch-muted text-sm leading-6">{state.message}</p>
        </div>
      </ArchiveShell>
    );
  }

  return (
    <ArchiveSummaryView
      file={file}
      sourceUrl={sourceUrl}
      summary={state.value}
      archiveBuffer={state.buffer}
      indexLabel={state.indexLabel}
      entryPreviewMode={state.entryPreviewMode}
    />
  );
}

function ArchiveSummaryView({
  file,
  sourceUrl,
  summary,
  archiveBuffer,
  indexLabel,
  entryPreviewMode,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  summary: ZipArchiveSummary;
  archiveBuffer: ArrayBuffer | null;
  indexLabel: string;
  entryPreviewMode: "browser-zip" | "external-worker";
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [selectedEntry, setSelectedEntry] = useState<ZipArchiveEntry | null>(
    null,
  );
  const [preview, setPreview] = useState<ArchiveEntryPreviewState>({
    status: "idle",
  });
  const [entryPreviewOpen, setEntryPreviewOpen] = useState(false);
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return summary.entries.filter((entry) => {
      if (filter === "files" && entry.directory) return false;
      if (filter === "directories" && !entry.directory) return false;
      if (filter === "encrypted" && !entry.encrypted) return false;
      if (filter === "nested" && entry.kind !== "archive") return false;
      if (filter === "unsafe" && !entry.unsafe) return false;
      if (!normalizedQuery) return true;
      return [entry.name, entry.extension, entry.kind, entry.methodLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, query, summary.entries]);
  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, 1000),
    [filteredEntries],
  );
  const filters: Array<{ id: ArchiveFilter; label: string; count: number }> = [
    { id: "all", label: "全部", count: summary.entries.length },
    { id: "files", label: "文件", count: summary.fileCount },
    { id: "directories", label: "目录", count: summary.directoryCount },
    { id: "nested", label: "嵌套包", count: summary.nestedArchiveCount },
    { id: "encrypted", label: "加密", count: summary.encryptedCount },
    { id: "unsafe", label: "风险路径", count: summary.unsafePathCount },
  ];

  useEffect(() => {
    let url: string | null = null;
    let objectUrl = false;
    let cancelled = false;

    async function loadEntryPreview(entry: ZipArchiveEntry) {
      if (entry.directory) {
        setPreview({ status: "idle" });
        return;
      }
      if (entry.encrypted) {
        setPreview({
          status: "failed",
          entry,
          message:
            "该条目已加密，前端只索引中央目录；解密必须交给受控归档 worker。",
        });
        return;
      }
      if (entry.unsafe) {
        setPreview({
          status: "failed",
          entry,
          message: "该条目路径存在越界风险，禁止在前端直接展开。",
        });
        return;
      }
      const maxInlineBytes = maxInlinePreviewBytesForEntry(entry);
      if (entry.uncompressedSize > maxInlineBytes) {
        setPreview({
          status: "failed",
          entry,
          message: `条目超过 ${formatModuleFileSize(maxInlineBytes)}，前端不直接展开；应由后端归档 worker 解包、杀毒、哈希并绑定对象存储。`,
        });
        return;
      }

      setPreview({ status: "loading", message: `正在打开 ${entry.name}...` });

      try {
        if (!archiveBuffer || entryPreviewMode === "external-worker") {
          const externalEntryUrl = archiveEntryPreviewUrl(
            file,
            sourceUrl,
            entry.name,
          );
          if (!externalEntryUrl) {
            throw new Error(
              "该归档包缺少本地源文件绑定，无法调用受控归档条目预览。",
            );
          }
          const needsLocalBinding =
            shouldBindArchiveEntryForNativeViewer(entry);
          const entryBytes =
            needsLocalBinding || canInlineTextEntry(entry)
              ? new Uint8Array(await fetchArchiveEntryBytes(externalEntryUrl))
              : null;
          const localFile =
            needsLocalBinding && entryBytes
              ? await bindArchiveEntryAsLocalFile(file, entry, entryBytes)
              : undefined;
          const previewUrl = localFile
            ? `/api/local-files/${encodeURIComponent(localFile.fileId)}`
            : externalEntryUrl;
          url = previewUrl;
          const text = canInlineTextEntry(entry)
            ? decodeInlinePreviewText(entryBytes ?? new Uint8Array())
            : undefined;
          if (!cancelled) {
            const readyPreview = {
              status: "ready" as const,
              entry,
              url: previewUrl,
              ...(localFile ? { localFile } : {}),
            };
            setPreview(
              text === undefined ? readyPreview : { ...readyPreview, text },
            );
          }
          return;
        }

        const bytes = await readZipEntryBytes(archiveBuffer, entry);
        const localFile = shouldBindArchiveEntryForNativeViewer(entry)
          ? await bindArchiveEntryAsLocalFile(file, entry, bytes)
          : undefined;
        if (localFile) {
          url = `/api/local-files/${encodeURIComponent(localFile.fileId)}`;
        } else {
          const blob = new Blob([toBlobPart(bytes)], {
            type: mimeTypeForArchiveEntry(entry),
          });
          url = URL.createObjectURL(blob);
          objectUrl = true;
        }
        const text = canInlineTextEntry(entry)
          ? decodeInlinePreviewText(bytes)
          : undefined;
        if (!cancelled) {
          const readyPreview = {
            status: "ready" as const,
            entry,
            url,
            ...(localFile ? { localFile } : {}),
          };
          setPreview(
            text === undefined ? readyPreview : { ...readyPreview, text },
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPreview({
            status: "failed",
            entry,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (selectedEntry) {
      void loadEntryPreview(selectedEntry);
    }

    return () => {
      cancelled = true;
      if (url && objectUrl) URL.revokeObjectURL(url);
    };
  }, [archiveBuffer, entryPreviewMode, file, selectedEntry, sourceUrl]);

  return (
    <ArchiveShell file={file}>
      <DockableViewerToolbar
        title="压缩包查看"
        subtitle={indexLabel}
        metrics={[
          { label: "文件", value: summary.fileCount.toLocaleString() },
          { label: "目录", value: summary.directoryCount.toLocaleString() },
          {
            label: "嵌套包",
            value: summary.nestedArchiveCount.toLocaleString(),
          },
          { label: "加密项", value: summary.encryptedCount.toLocaleString() },
          {
            label: "压缩后",
            value: formatModuleFileSize(summary.compressedBytes),
          },
          {
            label: "原始大小",
            value: formatModuleFileSize(summary.uncompressedBytes),
          },
        ]}
        actions={
          <a
            href={sourceUrl}
            download={file.name}
            className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
            title="下载源压缩包"
            aria-label="下载源压缩包"
          >
            <Download className="h-4 w-4" />
          </a>
        }
      >
        <label className="arch-input flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
          <Search className="arch-muted h-4 w-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索条目"
            className="arch-text min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-60"
          />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition ${
                filter === item.id
                  ? "arch-btn-primary"
                  : "arch-btn hover:border-[var(--arch-primary)]"
              }`}
            >
              {item.label} {item.count.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-2 text-[10px]">
          <span className="arch-primary-text inline-flex items-center gap-1 font-medium">
            <Hash className="h-3.5 w-3.5" />
            SHA-256
          </span>
          <p className="arch-text mt-1 break-all font-mono">
            {summary.sha256 ?? "正在等待浏览器哈希结果"}
          </p>
        </div>
      </DockableViewerToolbar>

      {summary.warnings.length ? (
        <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-6 text-amber-600">
          {summary.warnings.join(" / ")}
        </div>
      ) : null}

      <div className="mt-4 min-h-0">
        <div className="max-h-[calc(100vh-250px)] overflow-auto rounded-lg border border-[var(--arch-border)]">
          <table className="min-w-full border-collapse text-sm">
            <thead className="arch-surface-muted sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">路径</th>
                <th className="px-3 py-2 text-left font-medium">类型</th>
                <th className="px-3 py-2 text-left font-medium">方式</th>
                <th className="px-3 py-2 text-right font-medium">压缩后</th>
                <th className="px-3 py-2 text-right font-medium">原始大小</th>
                <th className="px-3 py-2 text-left font-medium">修改时间</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry) => (
                <tr
                  key={entry.name}
                  className={`border-t border-[var(--arch-border)] ${
                    selectedEntry?.name === entry.name
                      ? "bg-[var(--arch-primary-soft)]"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEntry(entry);
                        if (!entry.directory) setEntryPreviewOpen(true);
                      }}
                      className="flex min-w-[18rem] items-center gap-2 text-left"
                      style={{
                        paddingLeft: `${Math.min(entry.depth, 8) * 14}px`,
                      }}
                      disabled={entry.directory}
                      title={entry.directory ? "目录" : `打开 ${entry.name}`}
                    >
                      {entry.directory ? (
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <FileArchive className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                      <span className="arch-text break-all font-medium">
                        {entry.name}
                      </span>
                      {entry.encrypted ? (
                        <span className="arch-chip rounded-md px-2 py-0.5 text-[10px] font-medium">
                          加密
                        </span>
                      ) : null}
                      {entry.unsafe ? (
                        <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          风险路径
                        </span>
                      ) : null}
                    </button>
                  </td>
                  <td className="arch-muted px-3 py-2">
                    {archiveKindLabel(entry.kind)}
                  </td>
                  <td className="arch-muted px-3 py-2">{entry.methodLabel}</td>
                  <td className="arch-muted px-3 py-2 text-right">
                    {entry.directory
                      ? "-"
                      : formatModuleFileSize(entry.compressedSize)}
                  </td>
                  <td className="arch-muted px-3 py-2 text-right">
                    {entry.directory
                      ? "-"
                      : formatModuleFileSize(entry.uncompressedSize)}
                  </td>
                  <td className="arch-muted px-3 py-2">{entry.modifiedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {entryPreviewOpen && selectedEntry ? (
        <FloatingWindowFrame
          title={
            selectedEntry.name.split("/").filter(Boolean).at(-1) ??
            selectedEntry.name
          }
          eyebrow="压缩包条目预览"
          subtitle={`${archiveKindLabel(selectedEntry.kind)} · ${formatModuleFileSize(selectedEntry.uncompressedSize)}`}
          icon={<FileArchive className="h-4 w-4" />}
          onClose={() => setEntryPreviewOpen(false)}
          defaultSize={{ width: 880, height: 760 }}
          minSize={{ width: 420, height: 360 }}
          placement="center"
          zIndex={145}
          bodyClassName="p-0"
        >
          <ArchiveEntryPreviewPanel
            parentFile={file}
            selectedEntry={selectedEntry}
            preview={preview}
          />
        </FloatingWindowFrame>
      ) : null}

      {filteredEntries.length === 0 ? (
        <p className="arch-card-muted mt-3 rounded-lg p-4 text-sm leading-6">
          当前搜索和筛选条件下没有匹配条目。
        </p>
      ) : null}

      {filteredEntries.length > visibleEntries.length ? (
        <p className="arch-muted mt-3 text-xs">
          已显示前 {visibleEntries.length.toLocaleString()}{" "}
          项；完整索引仍保留在源 ZIP 中，后端归档 worker
          可继续解包、杀毒、哈希和长期留存。
        </p>
      ) : null}
    </ArchiveShell>
  );
}

function ArchiveShell({
  file,
  children,
}: {
  file: ModuleFileNode;
  children: ReactNode;
}) {
  return (
    <section
      className="relative min-h-[calc(100vh-170px)] overflow-hidden rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] p-3"
      data-file-name={file.name}
      data-mime-type={file.mimeType}
    >
      {children}
    </section>
  );
}

type ArchiveFilter =
  | "all"
  | "files"
  | "directories"
  | "encrypted"
  | "nested"
  | "unsafe";

function ArchiveEntryPreviewPanel({
  parentFile,
  selectedEntry,
  preview,
}: {
  parentFile: ModuleFileNode;
  selectedEntry: ZipArchiveEntry | null;
  preview: ArchiveEntryPreviewState;
}) {
  if (!selectedEntry) {
    return (
      <section className="arch-card-muted rounded-lg p-4 text-sm leading-6">
        选择一个文件条目后可在这里查看内容。目录、加密项和风险路径不会在前端直接展开。
      </section>
    );
  }

  if (preview.status === "loading") {
    return (
      <section className="arch-card-muted rounded-lg p-4 text-sm font-medium">
        <ArchLoadingFlow label={preview.message} size="compact" showLabel />
      </section>
    );
  }

  if (preview.status === "failed") {
    return (
      <section className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-700">
        {preview.message}
      </section>
    );
  }

  if (preview.status !== "ready") {
    return (
      <section className="arch-card-muted rounded-lg p-4 text-sm leading-6">
        {selectedEntry.directory ? "这是目录。" : "等待条目预览。"}
      </section>
    );
  }

  const nestedFile = archiveEntryFileNode(
    parentFile,
    preview.entry,
    preview.localFile,
  );
  const ext = extensionOf(preview.entry.name).toLowerCase();

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-[var(--arch-surface)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--arch-border)] p-3">
        <div className="min-w-0">
          <p className="arch-primary-text text-[11px] font-medium">条目预览</p>
          <h3 className="arch-text mt-1 truncate text-sm font-medium">
            {preview.entry.name}
          </h3>
          <p className="arch-muted mt-1 text-xs">
            {archiveKindLabel(preview.entry.kind)} ·{" "}
            {formatModuleFileSize(preview.entry.uncompressedSize)}
          </p>
        </div>
        <a
          href={preview.url}
          download={preview.entry.name.split("/").filter(Boolean).at(-1)}
          className="viewer-ghost-tool flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          title="下载该条目"
          aria-label="下载该条目"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {preview.text !== undefined ? (
          <pre className="whitespace-pre-wrap rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3 font-mono text-xs leading-5">
            {preview.text}
          </pre>
        ) : ext === ".pdf" ? (
          <iframe
            src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            title={preview.entry.name}
            className="h-[70vh] min-h-[520px] w-full rounded-md border bg-white"
          />
        ) : preview.entry.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.url}
            alt={preview.entry.name}
            className="mx-auto max-h-[70vh] rounded-md object-contain"
          />
        ) : preview.entry.kind === "office" ? (
          <OfficeDocumentViewer file={nestedFile} sourceUrl={preview.url} />
        ) : preview.entry.kind === "cad" || preview.entry.kind === "bim" ? (
          <OpenEngineeringEditor file={nestedFile} sourceUrl={preview.url} />
        ) : preview.entry.kind === "archive" && ext === ".zip" ? (
          <ArchivePackageViewer file={nestedFile} sourceUrl={preview.url} />
        ) : (
          <div className="arch-card-muted rounded-lg p-4 text-sm leading-6">
            该条目已解包并可下载；当前类型需要专用查看器或后端 worker
            生成可审计预览。
          </div>
        )}
      </div>
    </section>
  );
}

function archiveEntryFileNode(
  parentFile: ModuleFileNode,
  entry: ZipArchiveEntry,
  localFile?: LocalFileMetadata,
): ModuleFileNode {
  const name = entry.name.split("/").filter(Boolean).at(-1) ?? entry.name;
  const registered = fileTypeForFileName(name);
  return {
    id: localFile?.fileId ?? `${parentFile.id}:${entry.name}`,
    name: localFile?.originalName ?? name,
    type: "file",
    moduleId: parentFile.moduleId,
    parentId: localFile?.parentId ?? parentFile.id,
    size: localFile?.size ?? entry.uncompressedSize,
    mimeType: localFile?.mimeType ?? mimeTypeForArchiveEntry(entry),
    status: "active",
    version: localFile?.version ?? parentFile.version,
    owner: localFile?.owner ?? parentFile.owner,
    updatedAt: localFile?.createdAt ?? entry.modifiedAt,
    tags: localFile?.tags ?? ["archive-entry", entry.kind],
    permissions: parentFile.permissions,
    auditTrail: parentFile.auditTrail,
    source: "local_upload",
    ...(localFile
      ? {
          localFileId: localFile.fileId,
          localFile,
          checksum: localFile.checksum,
        }
      : {}),
    ...(registered?.viewerKind ? { viewerKind: registered.viewerKind } : {}),
  };
}

export async function readZipEntryBytes(
  buffer: ArrayBuffer,
  entry: ZipArchiveEntry,
): Promise<Uint8Array> {
  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;
  if (offset < 0 || offset + 30 > view.byteLength) {
    throw new Error("ZIP 本地文件头偏移超出范围。");
  }
  if (view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error("ZIP 本地文件头签名无效。");
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataOffset > view.byteLength || dataEnd > view.byteLength) {
    throw new Error("ZIP 条目数据超出文件范围。");
  }

  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);
  if (entry.method === 0) {
    return new Uint8Array(compressed);
  }
  if (entry.method === 8) {
    try {
      const Decompression = (
        globalThis as typeof globalThis & {
          DecompressionStream?: new (
            format: CompressionFormat,
          ) => DecompressionStream;
        }
      ).DecompressionStream;
      if (!Decompression) {
        return await readZipEntryBytesWithJsZip(buffer, entry);
      }
      const stream = new Blob([toBlobPart(compressed)])
        .stream()
        .pipeThrough(new Decompression("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      return await readZipEntryBytesWithJsZip(buffer, entry);
    }
  }

  throw new Error(
    `ZIP 压缩方式 ${entry.methodLabel} 需要后端归档 worker 解包。`,
  );
}

async function readZipEntryBytesWithJsZip(
  buffer: ArrayBuffer,
  entry: ZipArchiveEntry,
): Promise<Uint8Array> {
  const archive = await JSZip.loadAsync(buffer);
  const zipEntry = archive.file(entry.name);
  if (!zipEntry) {
    throw new Error(`ZIP 条目不存在或无法解压: ${entry.name}`);
  }
  return new Uint8Array(await zipEntry.async("arraybuffer"));
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function canInlineTextEntry(entry: ZipArchiveEntry): boolean {
  if (entry.uncompressedSize > 512 * 1024) return false;
  return (
    ["code", "data", "document", "file"].includes(entry.kind) &&
    ![".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"].includes(
      entry.extension,
    )
  );
}

export function maxInlinePreviewBytesForEntry(entry: ZipArchiveEntry): number {
  if (entry.kind === "office") return 128 * 1024 * 1024;
  if (entry.kind === "document" && entry.extension === ".pdf") {
    return 96 * 1024 * 1024;
  }
  if (entry.kind === "image") return 192 * 1024 * 1024;
  if (entry.kind === "media") return 256 * 1024 * 1024;
  if (entry.kind === "cad" || entry.kind === "bim") return 64 * 1024 * 1024;
  if (entry.kind === "code" || entry.kind === "data") return 8 * 1024 * 1024;
  return 24 * 1024 * 1024;
}

function decodeInlinePreviewText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(0, Math.min(bytes.length, 512 * 1024)),
  );
}

function mimeTypeForArchiveEntry(entry: ZipArchiveEntry): string {
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".dxf": "image/vnd.dxf",
    ".dwg": "image/vnd.dwg",
    ".ifc": "application/x-step",
    ".rvt": "application/vnd.autodesk.revit",
    ".rfa": "application/vnd.autodesk.revit",
    ".skp": "model/vnd.sketchup.skp",
    ".step": "model/step",
    ".stp": "model/step",
    ".iges": "model/iges",
    ".igs": "model/iges",
    ".stl": "model/stl",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".dae": "model/vnd.collada+xml",
    ".ply": "model/ply",
    ".3dm": "model/vnd.3dm",
    ".zip": "application/zip",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".json": "application/json",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".htm": "text/html",
  };
  return mimeTypes[entry.extension] ?? "application/octet-stream";
}

function isBrowserZipArchivePackage(ext: string): boolean {
  return ext === ".zip" || ext === ".ifczip" || ext === ".bcfzip";
}

function archiveManifestUrl(
  file: ModuleFileNode,
  sourceUrl: string,
): string | null {
  const localFileId = file.localFileId ?? file.localFile?.fileId;
  if (localFileId) {
    return `/api/local-files/${encodeURIComponent(localFileId)}/archive-manifest`;
  }
  const match = sourceUrl.match(/\/api\/local-files\/([^/?#]+)/);
  if (!match?.[1]) return null;
  return `/api/local-files/${encodeURIComponent(decodeURIComponent(match[1]))}/archive-manifest`;
}

function archiveEntryPreviewUrl(
  file: ModuleFileNode,
  sourceUrl: string,
  entryName: string,
): string | null {
  const localFileId = file.localFileId ?? file.localFile?.fileId;
  const encodedEntry = encodeURIComponent(entryName);
  if (localFileId) {
    return `/api/local-files/${encodeURIComponent(localFileId)}/archive-entry?path=${encodedEntry}`;
  }
  const match = sourceUrl.match(/\/api\/local-files\/([^/?#]+)/);
  if (!match?.[1]) return null;
  return `/api/local-files/${encodeURIComponent(decodeURIComponent(match[1]))}/archive-entry?path=${encodedEntry}`;
}

async function fetchArchiveEntryBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await archiveManifestErrorMessage(response));
  }
  return await response.arrayBuffer();
}

function shouldBindArchiveEntryForNativeViewer(
  entry: ZipArchiveEntry,
): boolean {
  return (
    entry.kind === "cad" ||
    entry.kind === "bim" ||
    entry.kind === "office" ||
    entry.kind === "archive"
  );
}

async function bindArchiveEntryAsLocalFile(
  parentFile: ModuleFileNode,
  entry: ZipArchiveEntry,
  bytes: Uint8Array,
): Promise<LocalFileMetadata> {
  const fileName = entry.name.split("/").filter(Boolean).at(-1) ?? entry.name;
  const form = new FormData();
  form.append(
    "file",
    new File([toBlobPart(bytes)], fileName, {
      type: mimeTypeForArchiveEntry(entry),
    }),
  );
  form.append("moduleId", parentFile.moduleId);
  form.append("parentId", parentFile.id);
  form.append("owner", parentFile.owner);
  form.append(
    "tags",
    ["archive-entry", entry.kind, entry.extension.replace(/^\./, "")]
      .filter(Boolean)
      .join(","),
  );

  const response = await fetch("/api/local-files/upload", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(await archiveManifestErrorMessage(response));
  }
  const parsed = (await response.json()) as { file?: LocalFileMetadata };
  if (!parsed.file?.fileId) {
    throw new Error("归档条目已解包，但本地文件绑定响应无效。");
  }
  return parsed.file;
}

function zipSummaryFromExternalManifest(
  manifest: ExternalArchiveManifest,
): ZipArchiveSummary {
  return {
    entries: manifest.entries,
    fileCount: manifest.fileCount,
    directoryCount: manifest.directoryCount,
    compressedBytes: manifest.compressedBytes,
    uncompressedBytes: manifest.uncompressedBytes,
    encryptedCount: manifest.encryptedCount,
    nestedArchiveCount: manifest.nestedArchiveCount,
    unsafePathCount: manifest.unsafePathCount,
    zip64: false,
    warnings: manifest.warnings ?? [],
  };
}

async function archiveManifestErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const parsed = (await response.json()) as {
      message?: unknown;
      error?: unknown;
    };
    return typeof parsed.message === "string"
      ? parsed.message
      : typeof parsed.error === "string"
        ? parsed.error
        : `读取归档索引失败: HTTP ${response.status}`;
  } catch {
    return `读取归档索引失败: HTTP ${response.status}`;
  }
}

export function parseZipCentralDirectory(
  buffer: ArrayBuffer,
): ZipArchiveSummary {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error(
      "未找到 ZIP End Of Central Directory，无法确认这是有效 ZIP。",
    );
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const zip64 =
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff;
  const warnings: string[] = [];

  if (zip64) {
    warnings.push("检测到 ZIP64 标记；当前前端只读取标准中央目录字段。");
  }

  if (centralDirectoryOffset >= view.byteLength) {
    throw new Error("ZIP 中央目录偏移超出文件范围。");
  }

  const entries: ZipArchiveEntry[] = [];
  let offset = centralDirectoryOffset;
  const centralDirectoryEnd = Math.min(
    view.byteLength,
    centralDirectoryOffset + centralDirectorySize,
  );

  while (
    offset + 46 <= view.byteLength &&
    offset < centralDirectoryEnd &&
    view.getUint32(offset, true) === 0x02014b50
  ) {
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const modifiedTime = view.getUint16(offset + 12, true);
    const modifiedDate = view.getUint16(offset + 14, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameOffset = offset + 46;
    const nameEnd = nameOffset + fileNameLength;

    if (nameEnd > view.byteLength) {
      warnings.push("发现一个文件名越界的中央目录项，已停止读取后续项。");
      break;
    }

    const nameBytes = new Uint8Array(buffer, nameOffset, fileNameLength);
    const name = decodeZipPath(nameBytes, Boolean(flags & 0x0800));
    const directory = name.endsWith("/");
    const extension = zipEntryExtension(name);
    const kind = classifyZipEntry(name, directory);
    const unsafe = isUnsafeZipPath(name);
    if (unsafe) {
      warnings.push(`发现可疑路径: ${name}`);
    }

    entries.push({
      name,
      directory,
      extension,
      kind,
      compressedSize,
      uncompressedSize,
      method,
      methodLabel: zipCompressionMethodLabel(method),
      localHeaderOffset,
      encrypted: Boolean(flags & 0x0001),
      unsafe,
      modifiedAt: formatDosDateTime(modifiedDate, modifiedTime),
      depth: name.split("/").filter(Boolean).length - 1,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  if (!entries.length && totalEntries > 0) {
    warnings.push("ZIP 中央目录存在，但前端未能读取到条目。");
  }

  return {
    entries,
    fileCount: entries.filter((entry) => !entry.directory).length,
    directoryCount: entries.filter((entry) => entry.directory).length,
    compressedBytes: sumEntryBytes(entries, "compressedSize"),
    uncompressedBytes: sumEntryBytes(entries, "uncompressedSize"),
    encryptedCount: entries.filter((entry) => entry.encrypted).length,
    nestedArchiveCount: entries.filter((entry) => entry.kind === "archive")
      .length,
    unsafePathCount: entries.filter((entry) => entry.unsafe).length,
    zip64,
    warnings: [...new Set(warnings)],
  };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function findEndOfCentralDirectory(view: DataView): number {
  const maxCommentLength = 0xffff;
  const minOffset = Math.max(0, view.byteLength - maxCommentLength - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

function decodeZipPath(bytes: Uint8Array, utf8Flag: boolean): string {
  const decoders = utf8Flag
    ? ["utf-8", "gb18030", "windows-1252"]
    : ["utf-8", "gb18030", "windows-1252"];

  for (const decoder of decoders) {
    try {
      return new TextDecoder(decoder, { fatal: decoder === "utf-8" }).decode(
        bytes,
      );
    } catch {
      // Try the next common ZIP filename encoding.
    }
  }

  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function zipCompressionMethodLabel(method: number): string {
  const labels: Record<number, string> = {
    0: "store",
    8: "deflate",
    9: "deflate64",
    12: "bzip2",
    14: "lzma",
    93: "zstd",
    98: "ppmd",
  };
  return labels[method] ?? `method ${method}`;
}

function zipEntryExtension(name: string): string {
  const leaf = name.split("/").filter(Boolean).at(-1) ?? "";
  const normalized = leaf.toLowerCase();
  if (normalized.endsWith(".tar.gz")) return ".tar.gz";
  if (normalized.endsWith(".tar.bz2")) return ".tar.bz2";
  if (normalized.endsWith(".tar.xz")) return ".tar.xz";
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index) : "";
}

function classifyZipEntry(
  name: string,
  directory: boolean,
): ZipArchiveEntry["kind"] {
  if (directory) return "directory";
  const extension = zipEntryExtension(name);
  if (
    [
      ".zip",
      ".zipx",
      ".7z",
      ".rar",
      ".tar",
      ".gz",
      ".bz2",
      ".xz",
      ".zst",
      ".tgz",
      ".tbz2",
      ".tar.gz",
      ".tar.bz2",
      ".tar.xz",
      ".ifczip",
      ".bcfzip",
      ".jar",
      ".war",
      ".ear",
      ".apk",
      ".ipa",
      ".asar",
    ].includes(extension)
  )
    return "archive";
  if (
    [".ifc", ".ifczip", ".ids", ".bcf", ".bcfzip", ".idm"].includes(extension)
  )
    return "bim";
  if (
    [
      ".dxf",
      ".dwg",
      ".step",
      ".stp",
      ".iges",
      ".igs",
      ".brep",
      ".stl",
      ".ply",
      ".3dm",
      ".skp",
      ".usd",
      ".usda",
      ".usdc",
      ".usdz",
      ".gltf",
      ".glb",
      ".b3dm",
      ".i3dm",
      ".pnts",
      ".cmpt",
    ].includes(extension)
  )
    return "cad";
  if (
    [
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".odt",
      ".ods",
      ".odp",
      ".rtf",
    ].includes(extension)
  )
    return "office";
  if ([".pdf", ".txt", ".md", ".html", ".htm"].includes(extension))
    return "document";
  if (
    [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".heic"].includes(
      extension,
    )
  )
    return "image";
  if (
    [".mp4", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".flac", ".ogg"].includes(
      extension,
    )
  )
    return "media";
  if (
    [
      ".json",
      ".xml",
      ".csv",
      ".tsv",
      ".yaml",
      ".yml",
      ".sql",
      ".geojson",
    ].includes(extension)
  )
    return "data";
  if (
    [
      ".js",
      ".ts",
      ".tsx",
      ".py",
      ".rs",
      ".go",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".cs",
    ].includes(extension)
  )
    return "code";
  return "file";
}

function archiveKindLabel(kind: ZipArchiveEntry["kind"]): string {
  const labels: Record<ZipArchiveEntry["kind"], string> = {
    directory: "目录",
    archive: "归档包",
    cad: "CAD",
    bim: "BIM",
    office: "Office",
    document: "文档",
    image: "图像",
    media: "媒体",
    code: "代码",
    data: "数据",
    file: "文件",
  };
  return labels[kind];
}

function formatDosDateTime(date: number, time: number): string {
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  const second = (time & 0x1f) * 2;
  const minute = (time >> 5) & 0x3f;
  const hour = (time >> 11) & 0x1f;

  if (!day || !month) return "-";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function isUnsafeZipPath(name: string): boolean {
  return (
    name.startsWith("/") ||
    /^[a-zA-Z]:/.test(name) ||
    name.split("/").some((part) => part === "..")
  );
}

function sumEntryBytes(
  entries: ZipArchiveEntry[],
  key: "compressedSize" | "uncompressedSize",
): number {
  return entries.reduce(
    (total, entry) => total + (entry.directory ? 0 : entry[key]),
    0,
  );
}
