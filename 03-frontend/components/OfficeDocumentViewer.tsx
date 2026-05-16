// components/OfficeDocumentViewer.tsx - Backend-native Office and text viewers
// License: Apache-2.0
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Loader2, ServerCog } from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import {
  extensionOf,
  fileTypeForFileName,
  stageRouteForFileName,
} from '@/lib/file-type-registry';
import type { ModuleFileNode } from '@/lib/module-file-system';

type PreviewState =
  | { status: 'loading'; message: string }
  | { status: 'text'; text: string }
  | { status: 'failed'; message: string };

type SpreadsheetCell = string | number | boolean | Date | null;
type SpreadsheetRow = SpreadsheetCell[];

interface SheetPreview {
  name: string;
  rows: SpreadsheetRow[];
  rowCount: number;
  columnCount: number;
}

type OfficePreviewState =
  | { status: 'loading'; message: string }
  | { status: 'docx'; html: string; messages: string[] }
  | { status: 'sheet'; sheets: SheetPreview[]; activeSheet: string }
  | { status: 'unsupported'; message: string }
  | { status: 'failed'; message: string };

interface OfficeDocumentViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

export function OfficeDocumentViewer({
  file,
  sourceUrl,
}: OfficeDocumentViewerProps) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const [state, setState] = useState<OfficePreviewState>({
    status: 'loading',
    message: '正在读取 Office 文件...',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadOfficePreview() {
      setState({ status: 'loading', message: '正在读取 Office 文件...' });

      if (!canPreviewOfficeInBrowser(ext)) {
        setState({
          status: 'unsupported',
          message: `${ext || '该 Office 格式'} 需要后端 Office worker 或授权文档服务返回原生 viewer manifest。`,
        });
        return;
      }

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`读取 Office 文件失败: HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        if (ext === '.docx') {
          const result = await mammoth.convertToHtml(
            { arrayBuffer },
            { convertImage: mammoth.images.dataUri },
          );
          if (!cancelled) {
            setState({
              status: 'docx',
              html: sanitizeOfficeHtml(result.value),
              messages: result.messages.map((message) => message.message),
            });
          }
          return;
        }

        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: true,
        });
        const sheets = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            return null;
          }
          const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, {
            header: 1,
            raw: false,
            defval: '',
            blankrows: false,
          });
          const previewRows = rows
            .slice(0, 240)
            .map((row) => row.slice(0, 60).map(normalizeSpreadsheetCell));
          return {
            name: sheetName,
            rows: previewRows,
            rowCount: rows.length,
            columnCount: previewRows.reduce(
              (max, row) => Math.max(max, row.length),
              0,
            ),
          };
        }).filter((sheet): sheet is SheetPreview => Boolean(sheet));

        if (!cancelled) {
          if (sheets.length === 0) {
            setState({ status: 'unsupported', message: '工作簿没有可显示的工作表。' });
          } else {
            setState({
              status: 'sheet',
              sheets,
              activeSheet: sheets[0]?.name ?? '',
            });
          }
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

    void loadOfficePreview();

    return () => {
      cancelled = true;
    };
  }, [ext, sourceUrl]);

  if (state.status === 'loading') {
    return (
      <DocumentShell file={file}>
        <div className="arch-card-muted flex items-center gap-3 rounded-xl p-4 text-sm font-bold">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (state.status === 'failed') {
    return (
      <DocumentShell file={file}>
        <OfficeRuntimeMetrics file={file} sourceUrl={sourceUrl} statusLabel="preview failed" />
        <div className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-500">
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (state.status === 'unsupported') {
    return (
      <DocumentShell file={file}>
        <OfficeRuntimeNotice
          file={file}
          sourceUrl={sourceUrl}
          message={state.message}
        />
      </DocumentShell>
    );
  }

  if (state.status === 'docx') {
    return (
      <DocumentShell file={file}>
        <OfficeRuntimeMetrics file={file} sourceUrl={sourceUrl} statusLabel="A4 docx preview" />
        <div className="mt-3 max-h-[calc(100vh-120px)] overflow-auto rounded-lg bg-slate-100 p-4">
          <article
            className="office-a4-page mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[18mm] py-[16mm] text-[12pt] leading-[1.55] text-slate-950 shadow-sm"
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        </div>
        {state.messages.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-5 text-amber-700">
            {state.messages.slice(0, 3).join(' / ')}
          </div>
        ) : null}
      </DocumentShell>
    );
  }

  const activeSheet =
    state.sheets.find((sheet) => sheet.name === state.activeSheet) ??
    state.sheets[0];

  return (
    <DocumentShell file={file}>
      <OfficeRuntimeMetrics file={file} sourceUrl={sourceUrl} statusLabel="browser spreadsheet preview" />
      <div className="mt-3 flex flex-wrap gap-2">
        {state.sheets.map((sheet) => (
          <button
            key={sheet.name}
            type="button"
            onClick={() =>
              setState((current) =>
                current.status === 'sheet'
                  ? { ...current, activeSheet: sheet.name }
                  : current,
              )
            }
            className={`rounded-md border px-3 py-1.5 text-xs font-black ${
              activeSheet?.name === sheet.name ? 'arch-card-selected' : 'arch-btn'
            }`}
          >
            {sheet.name}
          </button>
        ))}
      </div>
      {activeSheet ? (
        <div className="mt-3 max-h-[calc(100vh-270px)] overflow-auto rounded-xl border">
          <table className="min-w-full border-collapse bg-white text-xs text-slate-900">
            <tbody>
              {activeSheet.rows.map((row, rowIndex) => (
                <tr key={`${activeSheet.name}-row-${rowIndex}`}>
                  {Array.from({ length: activeSheet.columnCount }).map((_, columnIndex) => (
                    <td
                      key={`${activeSheet.name}-${rowIndex}-${columnIndex}`}
                      className={`min-w-28 border border-slate-200 px-2 py-1.5 align-top ${
                        rowIndex === 0 ? 'bg-slate-100 font-black' : ''
                      }`}
                    >
                      {formatSpreadsheetCell(row[columnIndex] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </DocumentShell>
  );
}

function OfficeRuntimeNotice({
  file,
  sourceUrl,
  message,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  message: string;
}) {
  return (
    <>
      <div className="rounded-2xl border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4">
        <div className="flex items-start gap-3">
          <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ServerCog className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 className="arch-text text-base font-black">
              后端原生 Office 查看链路
            </h4>
            <p className="arch-muted mt-1 text-sm leading-6">{message}</p>
          </div>
        </div>
        <OfficeRuntimeMetrics
          file={file}
          sourceUrl={sourceUrl}
          statusLabel="backend native required"
        />
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          已绑定真实源文件；DOC、PPT、PPTX 等格式必须由后端 worker 或授权文档服务返回可审计预览结果。
        </span>
      </div>
    </>
  );
}

function OfficeRuntimeMetrics({
  file,
  sourceUrl,
  statusLabel,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  statusLabel: string;
}) {
  const registryEntry = fileTypeForFileName(file.name);
  const previewRoute = stageRouteForFileName(file.name, 'preview');
  const extractRoute = stageRouteForFileName(file.name, 'extract');
  const parseRoute = stageRouteForFileName(file.name, 'parse');
  const runtimeRoute = stageRouteForFileName(file.name, 'runtime');

  return (
    <details className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-2">
      <summary className="cursor-pointer list-none text-xs font-black">
        <span className="arch-primary-text mr-2 font-mono uppercase tracking-[0.18em]">
          Office runtime
        </span>
        <span className="arch-text">{statusLabel}</span>
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <Metric
          label="源文件"
          value={sourceUrl.startsWith('/api/local-files/') ? 'local object' : 'object'}
        />
        <Metric
          label="逻辑类型"
          value={registryEntry?.logicalType ?? 'office.document'}
        />
        <Metric
          label="预览"
          value={previewRoute?.adapter ?? 'Office native worker'}
        />
        <Metric
          label="运行时"
          value={runtimeRoute?.adapter ?? 'Office runtime service'}
        />
        <Metric
          label="抽取"
          value={extractRoute?.adapter ?? 'Office extractor'}
        />
        <Metric label="解析" value={parseRoute?.adapter ?? 'OOXML parser'} />
      </div>
    </details>
  );
}

function canPreviewOfficeInBrowser(ext: string): boolean {
  return ['.docx', '.xlsx', '.xls', '.xlsm', '.xlsb'].includes(ext);
}

function sanitizeOfficeHtml(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  document
    .querySelectorAll('script, style, iframe, object, embed, link, meta')
    .forEach((element) => element.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcset') {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (isOfficeUriAttribute(name) && !isSafeOfficeUri(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return document.body.innerHTML;
}

function isOfficeUriAttribute(name: string): boolean {
  return ['src', 'href', 'xlink:href', 'formaction', 'poster'].includes(name);
}

function isSafeOfficeUri(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/[\u0000-\u001F\u007F\s]+/g, '')
    .toLowerCase();
  if (!normalized) {
    return true;
  }
  if (
    normalized.startsWith('#') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../')
  ) {
    return true;
  }
  return (
    normalized.startsWith('http:') ||
    normalized.startsWith('https:') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('tel:') ||
    normalized.startsWith('data:image/')
  );
}

function normalizeSpreadsheetCell(cell: SpreadsheetCell): SpreadsheetCell {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (cell === undefined) {
    return '';
  }
  return cell;
}

function formatSpreadsheetCell(cell: SpreadsheetCell): string {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (cell === null) {
    return '';
  }
  return String(cell);
}

export function TextDataViewer({
  file,
  sourceUrl,
}: OfficeDocumentViewerProps) {
  const [state, setState] = useState<PreviewState>({
    status: 'loading',
    message: '正在读取文本...',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadText() {
      setState({ status: 'loading', message: '正在读取文本...' });

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`读取文本失败: HTTP ${response.status}`);
        }
        const text = await response.text();
        if (!cancelled) {
          setState({ status: 'text', text });
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

    void loadText();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const tableRows = useMemo(() => {
    if (state.status !== 'text' || !['.csv', '.tsv'].includes(ext)) return null;
    const delimiter = ext === '.tsv' ? '\t' : ',';
    return state.text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 160)
      .map((line) => line.split(delimiter).slice(0, 40));
  }, [ext, state]);

  if (state.status === 'loading') {
    return <DocumentShell file={file}>{state.message}</DocumentShell>;
  }

  if (state.status === 'failed') {
    return (
      <DocumentShell file={file}>
        <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-500">
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (tableRows) {
    return (
      <DocumentShell file={file}>
        <div className="max-h-[calc(100vh-190px)] overflow-auto rounded-xl border">
          <table className="min-w-full border-collapse text-sm">
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr
                  key={`csv-row-${rowIndex}`}
                  className={rowIndex === 0 ? 'arch-surface-muted font-black' : ''}
                >
                  {row.map((cell, columnIndex) => (
                    <td
                      key={`csv-cell-${rowIndex}-${columnIndex}`}
                      className="border border-[var(--arch-border)] px-3 py-2"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocumentShell>
    );
  }

  return (
    <DocumentShell file={file}>
      <pre className="max-h-[calc(100vh-190px)] overflow-auto whitespace-pre-wrap rounded-xl border bg-[var(--arch-surface)] p-5 font-mono text-xs leading-6">
        {state.status === 'text' ? state.text : ''}
      </pre>
    </DocumentShell>
  );
}

function DocumentShell({
  file,
  children,
}: {
  file: ModuleFileNode;
  children: ReactNode;
}) {
  return (
    <section className="min-h-0" data-file-name={file.name}>
      {children}
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
