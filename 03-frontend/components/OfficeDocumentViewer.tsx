// components/OfficeDocumentViewer.tsx - Backend-native Office and text viewers
// License: Apache-2.0
'use client';

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AlertCircle, Download, Loader2, ServerCog } from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import {
  DockableViewerToolbar,
  type ViewerToolbarMetric,
} from '@/components/DockableViewerToolbar';
import {
  extensionOf,
  fileTypeForFileName,
  stageRouteForFileName,
} from '@/lib/file-type-registry';
import {
  formatModuleFileSize,
  type ModuleFileNode,
} from '@/lib/module-file-system';

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

type OfficePaperPreset = 'auto' | 'a4' | 'a3' | 'b5';

interface OfficeDocumentViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

export function OfficeDocumentViewer({
  file,
  sourceUrl,
}: OfficeDocumentViewerProps) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const [paperPreset, setPaperPreset] = useState<OfficePaperPreset>('a4');
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
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="读取中"
          />
        }
      >
        <div className="arch-card-muted flex items-center gap-3 rounded-lg p-4 text-sm font-bold">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (state.status === 'failed') {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="预览失败"
          />
        }
      >
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-500">
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (state.status === 'unsupported') {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="需要后端原生查看"
          />
        }
      >
        <OfficeRuntimeNotice
          message={state.message}
        />
      </DocumentShell>
    );
  }

  if (state.status === 'docx') {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel={`${paperPreset.toUpperCase()} 页面预览`}
          >
            <PaperPresetButtons
              value={paperPreset}
              onChange={setPaperPreset}
            />
          </OfficeToolbar>
        }
      >
        <div className="max-h-[calc(100vh-185px)] overflow-auto rounded-lg bg-slate-100 p-4">
          <article
            className="mx-auto max-w-full bg-white text-[12pt] leading-[1.55] text-slate-950 shadow-sm"
            style={paperPresetStyle(paperPreset)}
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        </div>
        {state.messages.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-5 text-amber-700">
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
    <DocumentShell
      file={file}
      toolbar={
        <OfficeToolbar
          file={file}
          sourceUrl={sourceUrl}
          statusLabel="表格预览"
          metrics={[
            { label: '工作表', value: state.sheets.length.toLocaleString() },
            {
              label: '行列',
              value: activeSheet
                ? `${activeSheet.rowCount.toLocaleString()} x ${activeSheet.columnCount.toLocaleString()}`
                : '-',
            },
          ]}
        >
          <div className="grid gap-1">
            {state.sheets.slice(0, 10).map((sheet) => (
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
                className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-black ${
                  activeSheet?.name === sheet.name
                    ? 'arch-card-selected'
                    : 'arch-btn'
                }`}
                title={sheet.name}
              >
                <span className="block truncate">{sheet.name}</span>
              </button>
            ))}
          </div>
        </OfficeToolbar>
      }
    >
      {activeSheet ? (
        <div className="max-h-[calc(100vh-185px)] overflow-auto rounded-lg border">
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
  message,
}: {
  message: string;
}) {
  return (
    <>
      <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4">
        <div className="flex items-start gap-3">
          <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <ServerCog className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 className="arch-text text-base font-black">
              后端原生 Office 查看链路
            </h4>
            <p className="arch-muted mt-1 text-sm leading-6">{message}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          已绑定真实源文件；DOC、PPT、PPTX 等格式必须由后端 worker 或授权文档服务返回可审计预览结果。
        </span>
      </div>
    </>
  );
}

function OfficeToolbar({
  file,
  sourceUrl,
  statusLabel,
  metrics = [],
  children,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  statusLabel: string;
  metrics?: ViewerToolbarMetric[];
  children?: ReactNode;
}) {
  return (
    <DockableViewerToolbar
      title="Office 查看"
      subtitle={statusLabel}
      metrics={[...officeRuntimeMetrics(file, sourceUrl), ...metrics]}
      actions={
        <a
          href={sourceUrl}
          download={file.name}
          className="arch-btn flex h-8 w-8 items-center justify-center rounded-md"
          title="下载源文件"
          aria-label="下载源文件"
        >
          <Download className="h-4 w-4" />
        </a>
      }
    >
      {children}
    </DockableViewerToolbar>
  );
}

function officeRuntimeMetrics(
  file: ModuleFileNode,
  sourceUrl: string,
): ViewerToolbarMetric[] {
  const registryEntry = fileTypeForFileName(file.name);
  const previewRoute = stageRouteForFileName(file.name, 'preview');
  const runtimeRoute = stageRouteForFileName(file.name, 'runtime');
  const parseRoute = stageRouteForFileName(file.name, 'parse');

  return [
    {
      label: '源文件',
      value: sourceUrl.startsWith('/api/local-files/') ? '本地对象' : '对象存储',
    },
    { label: '类型', value: registryEntry?.logicalType ?? 'office.document' },
    { label: '预览', value: previewRoute?.adapter ?? 'Office worker' },
    { label: '运行时', value: runtimeRoute?.adapter ?? 'Office service' },
    { label: '解析', value: parseRoute?.adapter ?? 'OOXML parser' },
  ];
}

function PaperPresetButtons({
  value,
  onChange,
}: {
  value: OfficePaperPreset;
  onChange: (value: OfficePaperPreset) => void;
}) {
  const presets: Array<{ value: OfficePaperPreset; label: string }> = [
    { value: 'auto', label: '自适应' },
    { value: 'a4', label: 'A4' },
    { value: 'a3', label: 'A3' },
    { value: 'b5', label: 'B5' },
  ];

  return (
    <div className="grid grid-cols-2 gap-1">
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => onChange(preset.value)}
          className={`rounded-md border px-2 py-1.5 text-xs font-black ${
            value === preset.value ? 'arch-card-selected' : 'arch-btn'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function paperPresetStyle(preset: OfficePaperPreset): CSSProperties {
  if (preset === 'a3') {
    return {
      width: '297mm',
      minHeight: '420mm',
      padding: '18mm 20mm',
    };
  }
  if (preset === 'b5') {
    return {
      width: '176mm',
      minHeight: '250mm',
      padding: '14mm 15mm',
    };
  }
  if (preset === 'auto') {
    return {
      minHeight: '60vh',
      width: 'min(100%, 1280px)',
      padding: '24px',
    };
  }
  return {
    width: '210mm',
    minHeight: '297mm',
    padding: '16mm 18mm',
  };
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
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith('on') ||
        ((name === 'src' || name === 'href') && value.startsWith('javascript:'))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return document.body.innerHTML;
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
    return (
      <DocumentShell
        file={file}
        toolbar={
          <TextDataToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="读取中"
          />
        }
      >
        {state.message}
      </DocumentShell>
    );
  }

  if (state.status === 'failed') {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <TextDataToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="预览失败"
          />
        }
      >
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-500">
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (tableRows) {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <TextDataToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel={ext === '.tsv' ? 'TSV 表格' : 'CSV 表格'}
            metrics={[
              { label: '行', value: tableRows.length.toLocaleString() },
              {
                label: '列',
                value: Math.max(...tableRows.map((row) => row.length), 0).toLocaleString(),
              },
            ]}
          />
        }
      >
        <div className="max-h-[calc(100vh-190px)] overflow-auto rounded-lg border">
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
    <DocumentShell
      file={file}
      toolbar={
        <TextDataToolbar
          file={file}
          sourceUrl={sourceUrl}
          statusLabel="文本预览"
          metrics={[
            {
              label: '字符',
              value: state.status === 'text' ? state.text.length.toLocaleString() : '-',
            },
          ]}
        />
      }
    >
      <pre className="max-h-[calc(100vh-190px)] overflow-auto whitespace-pre-wrap rounded-lg border bg-[var(--arch-surface)] p-5 font-mono text-xs leading-6">
        {state.status === 'text' ? state.text : ''}
      </pre>
    </DocumentShell>
  );
}

function TextDataToolbar({
  file,
  sourceUrl,
  statusLabel,
  metrics = [],
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  statusLabel: string;
  metrics?: ViewerToolbarMetric[];
}) {
  return (
    <DockableViewerToolbar
      title="文本/数据查看"
      subtitle={statusLabel}
      metrics={[
        { label: '格式', value: extensionOf(file.name) || 'text' },
        { label: '大小', value: formatModuleFileSize(file.size) },
        ...metrics,
      ]}
      actions={
        <a
          href={sourceUrl}
          download={file.name}
          className="arch-btn flex h-8 w-8 items-center justify-center rounded-md"
          title="下载源文件"
          aria-label="下载源文件"
        >
          <Download className="h-4 w-4" />
        </a>
      }
    />
  );
}

function DocumentShell({
  file,
  toolbar,
  children,
}: {
  file: ModuleFileNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="relative min-h-[calc(100vh-170px)] overflow-hidden rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3 md:pl-[16.5rem]"
      data-file-name={file.name}
    >
      {toolbar}
      <div className="min-h-0">{children}</div>
    </section>
  );
}
