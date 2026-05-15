// components/OfficeDocumentViewer.tsx - Browser-native Office/text previews
// License: Apache-2.0
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, FileText, Table2 } from 'lucide-react';
import { extensionOf } from '@/lib/file-type-registry';
import { formatModuleFileSize, type ModuleFileNode } from '@/lib/module-file-system';

type PreviewState =
  | { status: 'loading'; message: string }
  | { status: 'word'; text: string; warnings: string[] }
  | { status: 'table'; sheetName: string; rows: string[][]; sheetNames: string[] }
  | { status: 'text'; text: string }
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
  const [state, setState] = useState<PreviewState>({
    status: 'loading',
    message: '正在读取 Office 文件...',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadOffice() {
      const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
      setState({ status: 'loading', message: '正在读取 Office 文件...' });

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`读取文件失败: HTTP ${response.status}`);
        }

        if (ext === '.docx') {
          const buffer = await response.arrayBuffer();
          const mammoth = await import('mammoth/mammoth.browser');
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          if (!cancelled) {
            setState({
              status: 'word',
              text: result.value.trim() || 'DOCX 文件没有可提取文本。',
              warnings: result.messages.map((message) => message.message),
            });
          }
          return;
        }

        if (['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods', '.csv', '.tsv'].includes(ext)) {
          const buffer = await response.arrayBuffer();
          const xlsx = await import('xlsx');
          const workbook = xlsx.read(buffer, {
            type: 'array',
            raw: false,
          });
          const sheetName = workbook.SheetNames[0] ?? 'Sheet1';
          const sheet = workbook.Sheets[sheetName];
          const rows = sheet
            ? xlsx.utils.sheet_to_json<string[]>(sheet, {
                header: 1,
                blankrows: false,
                raw: false,
              })
            : [];
          if (!cancelled) {
            setState({
              status: 'table',
              sheetName,
              sheetNames: workbook.SheetNames,
              rows: rows.slice(0, 160).map((row) =>
                row.slice(0, 40).map((cell) => String(cell ?? '')),
              ),
            });
          }
          return;
        }

        if (['.doc', '.ppt', '.pptx', '.odp', '.rtf'].includes(ext)) {
          if (!cancelled) {
            setState({
              status: 'unsupported',
              message:
                '该 Office 格式需要 LibreOffice/Univer worker 转换为可编辑文档或 PDF；浏览器端不会把二进制内容当文本显示。',
            });
          }
          return;
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

    void loadOffice();

    return () => {
      cancelled = true;
    };
  }, [file, sourceUrl]);

  if (state.status === 'loading') {
    return <DocumentShell file={file}>{state.message}</DocumentShell>;
  }

  if (state.status === 'failed' || state.status === 'unsupported') {
    return (
      <DocumentShell file={file}>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <p className="arch-muted text-sm leading-6">{state.message}</p>
        </div>
      </DocumentShell>
    );
  }

  if (state.status === 'table') {
    return (
      <DocumentShell file={file}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="arch-chip rounded-full px-3 py-1 text-xs font-bold">
            {state.sheetName}
          </span>
          <span className="arch-muted text-xs">
            {state.sheetNames.length} sheet · 显示前 {state.rows.length} 行
          </span>
        </div>
        <div className="max-h-[calc(100vh-190px)] overflow-auto rounded-xl border">
          <table className="min-w-full border-collapse text-sm">
            <tbody>
              {state.rows.map((row, rowIndex) => (
                <tr
                  key={`row-${rowIndex}`}
                  className={rowIndex === 0 ? 'arch-surface-muted font-black' : ''}
                >
                  {row.map((cell, columnIndex) => (
                    <td
                      key={`cell-${rowIndex}-${columnIndex}`}
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

  if (state.status === 'word') {
    return (
      <DocumentShell file={file}>
        <pre className="max-h-[calc(100vh-190px)] overflow-auto whitespace-pre-wrap rounded-xl border bg-[var(--arch-surface)] p-5 text-sm leading-7">
          {state.text}
        </pre>
        {state.warnings.length > 0 ? (
          <div className="arch-muted mt-3 text-xs">
            {state.warnings.slice(0, 3).join(' / ')}
          </div>
        ) : null}
      </DocumentShell>
    );
  }

  return (
    <DocumentShell file={file}>
      <pre className="max-h-[calc(100vh-190px)] overflow-auto whitespace-pre-wrap rounded-xl border bg-[var(--arch-surface)] p-5 font-mono text-xs leading-6">
        {state.text}
      </pre>
    </DocumentShell>
  );
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
  const isTable = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv', '.tsv'].includes(
    (file.localFile?.ext || extensionOf(file.name)).toLowerCase(),
  );

  return (
    <section className="arch-card rounded-2xl p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="arch-primary-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          {isTable ? <Table2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h3 className="arch-text truncate text-lg font-black">{file.name}</h3>
          <p className="arch-muted mt-1 text-xs">
            {file.mimeType} · {formatModuleFileSize(file.size)}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
