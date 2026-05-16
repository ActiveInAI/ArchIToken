// components/ArchivePackageViewer.tsx - Native ZIP package listing viewer
// License: Apache-2.0
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  FileArchive,
  Folder,
  Hash,
  Search,
} from 'lucide-react';
import { formatModuleFileSize, type ModuleFileNode } from '@/lib/module-file-system';

type ArchiveState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; value: ZipArchiveSummary }
  | { status: 'failed'; message: string };

export interface ZipArchiveEntry {
  name: string;
  directory: boolean;
  extension: string;
  kind: 'directory' | 'archive' | 'cad' | 'bim' | 'office' | 'document' | 'image' | 'media' | 'code' | 'data' | 'file';
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  methodLabel: string;
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

interface ArchivePackageViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

export function ArchivePackageViewer({
  file,
  sourceUrl,
}: ArchivePackageViewerProps) {
  const [state, setState] = useState<ArchiveState>({
    status: 'loading',
    message: '正在读取 ZIP 中央目录...',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadArchive() {
      setState({ status: 'loading', message: '正在读取 ZIP 中央目录...' });
      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
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
          setState({ status: 'ready', value: summary });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadArchive();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  if (state.status === 'loading') {
    return (
      <ArchiveShell file={file}>
        <p className="arch-muted text-sm">{state.message}</p>
      </ArchiveShell>
    );
  }

  if (state.status === 'failed') {
    return (
      <ArchiveShell file={file}>
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <p className="arch-muted text-sm leading-6">{state.message}</p>
        </div>
      </ArchiveShell>
    );
  }

  return <ArchiveSummaryView file={file} summary={state.value} />;
}

function ArchiveSummaryView({
  file,
  summary,
}: {
  file: ModuleFileNode;
  summary: ZipArchiveSummary;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return summary.entries.filter((entry) => {
      if (filter === 'files' && entry.directory) return false;
      if (filter === 'directories' && !entry.directory) return false;
      if (filter === 'encrypted' && !entry.encrypted) return false;
      if (filter === 'nested' && entry.kind !== 'archive') return false;
      if (filter === 'unsafe' && !entry.unsafe) return false;
      if (!normalizedQuery) return true;
      return [
        entry.name,
        entry.extension,
        entry.kind,
        entry.methodLabel,
      ].join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [filter, query, summary.entries]);
  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, 1000),
    [filteredEntries],
  );
  const filters: Array<{ id: ArchiveFilter; label: string; count: number }> = [
    { id: 'all', label: '全部', count: summary.entries.length },
    { id: 'files', label: '文件', count: summary.fileCount },
    { id: 'directories', label: '目录', count: summary.directoryCount },
    { id: 'nested', label: '嵌套包', count: summary.nestedArchiveCount },
    { id: 'encrypted', label: '加密', count: summary.encryptedCount },
    { id: 'unsafe', label: '风险路径', count: summary.unsafePathCount },
  ];

  return (
    <ArchiveShell file={file}>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="文件" value={summary.fileCount.toLocaleString()} />
        <Metric label="目录" value={summary.directoryCount.toLocaleString()} />
        <Metric label="嵌套包" value={summary.nestedArchiveCount.toLocaleString()} />
        <Metric label="加密项" value={summary.encryptedCount.toLocaleString()} />
        <Metric
          label="压缩后"
          value={formatModuleFileSize(summary.compressedBytes)}
        />
        <Metric
          label="原始大小"
          value={formatModuleFileSize(summary.uncompressedBytes)}
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <label className="arch-input flex min-w-0 items-center gap-2 rounded-md px-3 py-2">
          <Search className="arch-muted h-4 w-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索路径、扩展名、类型或压缩方式"
            className="arch-text min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-60"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                filter === item.id
                  ? 'arch-btn-primary'
                  : 'arch-btn hover:border-[var(--arch-primary)]'
              }`}
            >
              {item.label} {item.count.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div className="arch-card-muted mt-3 grid gap-2 rounded-xl p-3 text-xs md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <span className="arch-primary-text inline-flex items-center gap-2 font-black">
          <Hash className="h-4 w-4" />
          SHA-256
        </span>
        <span className="arch-text break-all font-mono">
          {summary.sha256 ?? '正在等待浏览器哈希结果'}
        </span>
      </div>

      {summary.warnings.length ? (
        <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-6 text-amber-600">
          {summary.warnings.join(' / ')}
        </div>
      ) : null}

      <div className="mt-4 max-h-[calc(100vh-320px)] overflow-auto rounded-xl border border-[var(--arch-border)]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="arch-surface-muted sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-black">路径</th>
              <th className="px-3 py-2 text-left font-black">类型</th>
              <th className="px-3 py-2 text-left font-black">方式</th>
              <th className="px-3 py-2 text-right font-black">压缩后</th>
              <th className="px-3 py-2 text-right font-black">原始大小</th>
              <th className="px-3 py-2 text-left font-black">修改时间</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.name} className="border-t border-[var(--arch-border)]">
                <td className="px-3 py-2">
                  <div
                    className="flex min-w-[18rem] items-center gap-2"
                    style={{ paddingLeft: `${Math.min(entry.depth, 8) * 14}px` }}
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
                      <span className="arch-chip rounded-full px-2 py-0.5 text-[10px] font-black">
                        encrypted
                      </span>
                    ) : null}
                    {entry.unsafe ? (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-600">
                        unsafe
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="arch-muted px-3 py-2">
                  {archiveKindLabel(entry.kind)}
                </td>
                <td className="arch-muted px-3 py-2">{entry.methodLabel}</td>
                <td className="arch-muted px-3 py-2 text-right">
                  {entry.directory
                    ? '-'
                    : formatModuleFileSize(entry.compressedSize)}
                </td>
                <td className="arch-muted px-3 py-2 text-right">
                  {entry.directory
                    ? '-'
                    : formatModuleFileSize(entry.uncompressedSize)}
                </td>
                <td className="arch-muted px-3 py-2">{entry.modifiedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="arch-card-muted mt-3 rounded-xl p-4 text-sm leading-6">
          当前搜索和筛选条件下没有匹配条目。
        </p>
      ) : null}

      {filteredEntries.length > visibleEntries.length ? (
        <p className="arch-muted mt-3 text-xs">
          已显示前 {visibleEntries.length.toLocaleString()} 项；完整索引仍保留在源
          ZIP 中，后端归档 worker 可继续解包、杀毒、哈希和长期留存。
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
      className="min-h-0"
      data-file-name={file.name}
      data-mime-type={file.mimeType}
    >
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted rounded-xl px-3 py-2">
      <p className="arch-muted text-[11px] font-bold">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

type ArchiveFilter = 'all' | 'files' | 'directories' | 'encrypted' | 'nested' | 'unsafe';

export function parseZipCentralDirectory(buffer: ArrayBuffer): ZipArchiveSummary {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error('未找到 ZIP End Of Central Directory，无法确认这是有效 ZIP。');
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
    warnings.push('检测到 ZIP64 标记；当前前端只读取标准中央目录字段。');
  }

  if (centralDirectoryOffset >= view.byteLength) {
    throw new Error('ZIP 中央目录偏移超出文件范围。');
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
    const nameOffset = offset + 46;
    const nameEnd = nameOffset + fileNameLength;

    if (nameEnd > view.byteLength) {
      warnings.push('发现一个文件名越界的中央目录项，已停止读取后续项。');
      break;
    }

    const nameBytes = new Uint8Array(buffer, nameOffset, fileNameLength);
    const name = decodeZipPath(nameBytes, Boolean(flags & 0x0800));
    const directory = name.endsWith('/');
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
      encrypted: Boolean(flags & 0x0001),
      unsafe,
      modifiedAt: formatDosDateTime(modifiedDate, modifiedTime),
      depth: name.split('/').filter(Boolean).length - 1,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  if (!entries.length && totalEntries > 0) {
    warnings.push('ZIP 中央目录存在，但前端未能读取到条目。');
  }

  return {
    entries,
    fileCount: entries.filter((entry) => !entry.directory).length,
    directoryCount: entries.filter((entry) => entry.directory).length,
    compressedBytes: sumEntryBytes(entries, 'compressedSize'),
    uncompressedBytes: sumEntryBytes(entries, 'uncompressedSize'),
    encryptedCount: entries.filter((entry) => entry.encrypted).length,
    nestedArchiveCount: entries.filter((entry) => entry.kind === 'archive').length,
    unsafePathCount: entries.filter((entry) => entry.unsafe).length,
    zip64,
    warnings: [...new Set(warnings)],
  };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
    ? ['utf-8', 'gb18030', 'windows-1252']
    : ['utf-8', 'gb18030', 'windows-1252'];

  for (const decoder of decoders) {
    try {
      return new TextDecoder(decoder, { fatal: decoder === 'utf-8' }).decode(
        bytes,
      );
    } catch {
      // Try the next common ZIP filename encoding.
    }
  }

  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');
}

function zipCompressionMethodLabel(method: number): string {
  const labels: Record<number, string> = {
    0: 'store',
    8: 'deflate',
    9: 'deflate64',
    12: 'bzip2',
    14: 'lzma',
    93: 'zstd',
    98: 'ppmd',
  };
  return labels[method] ?? `method ${method}`;
}

function zipEntryExtension(name: string): string {
  const leaf = name.split('/').filter(Boolean).at(-1) ?? '';
  const normalized = leaf.toLowerCase();
  if (normalized.endsWith('.tar.gz')) return '.tar.gz';
  if (normalized.endsWith('.tar.bz2')) return '.tar.bz2';
  if (normalized.endsWith('.tar.xz')) return '.tar.xz';
  const index = normalized.lastIndexOf('.');
  return index >= 0 ? normalized.slice(index) : '';
}

function classifyZipEntry(name: string, directory: boolean): ZipArchiveEntry['kind'] {
  if (directory) return 'directory';
  const extension = zipEntryExtension(name);
  if (['.zip', '.zipx', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.zst', '.tgz', '.tbz2', '.tar.gz', '.tar.bz2', '.tar.xz', '.ifczip', '.bcfzip', '.jar', '.war', '.ear', '.apk', '.ipa', '.asar'].includes(extension)) return 'archive';
  if (['.ifc', '.ifczip', '.ids', '.bcf', '.bcfzip', '.idm'].includes(extension)) return 'bim';
  if (['.dxf', '.dwg', '.step', '.stp', '.iges', '.igs', '.brep', '.stl', '.obj', '.ply', '.3dm', '.skp'].includes(extension)) return 'cad';
  if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf'].includes(extension)) return 'office';
  if (['.pdf', '.txt', '.md', '.html', '.htm'].includes(extension)) return 'document';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.heic'].includes(extension)) return 'image';
  if (['.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.ogg'].includes(extension)) return 'media';
  if (['.json', '.xml', '.csv', '.tsv', '.yaml', '.yml', '.sql', '.geojson'].includes(extension)) return 'data';
  if (['.js', '.ts', '.tsx', '.py', '.rs', '.go', '.java', '.cpp', '.c', '.h', '.cs'].includes(extension)) return 'code';
  return 'file';
}

function archiveKindLabel(kind: ZipArchiveEntry['kind']): string {
  const labels: Record<ZipArchiveEntry['kind'], string> = {
    directory: '目录',
    archive: '归档包',
    cad: 'CAD',
    bim: 'BIM',
    office: 'Office',
    document: '文档',
    image: '图像',
    media: '媒体',
    code: '代码',
    data: '数据',
    file: '文件',
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

  if (!day || !month) return '-';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function isUnsafeZipPath(name: string): boolean {
  return (
    name.startsWith('/') ||
    /^[a-zA-Z]:/.test(name) ||
    name.split('/').some((part) => part === '..')
  );
}

function sumEntryBytes(
  entries: ZipArchiveEntry[],
  key: 'compressedSize' | 'uncompressedSize',
): number {
  return entries.reduce(
    (total, entry) => total + (entry.directory ? 0 : entry[key]),
    0,
  );
}
