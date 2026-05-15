// components/OfficeDocumentViewer.tsx - Backend-native Office and text viewers
// License: Apache-2.0
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FileText, ServerCog, Table2 } from 'lucide-react';
import {
  extensionOf,
  fileTypeForFileName,
  stageRouteForFileName,
} from '@/lib/file-type-registry';
import { formatModuleFileSize, type ModuleFileNode } from '@/lib/module-file-system';

type PreviewState =
  | { status: 'loading'; message: string }
  | { status: 'text'; text: string }
  | { status: 'failed'; message: string };

interface OfficeDocumentViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

export function OfficeDocumentViewer({
  file,
  sourceUrl,
}: OfficeDocumentViewerProps) {
  const registryEntry = fileTypeForFileName(file.name);
  const previewRoute = stageRouteForFileName(file.name, 'preview');
  const extractRoute = stageRouteForFileName(file.name, 'extract');
  const parseRoute = stageRouteForFileName(file.name, 'parse');
  const runtimeRoute = stageRouteForFileName(file.name, 'runtime');

  return (
    <DocumentShell file={file}>
      <div className="rounded-2xl border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4">
        <div className="flex items-start gap-3">
          <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ServerCog className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 className="arch-text text-base font-black">
              后端原生 Office 查看链路
            </h4>
            <p className="arch-muted mt-1 text-sm leading-6">
              已绑定真实源文件，前端不会把 Office 二进制内容转成 PDF、HTML
              或图片来替代查看；查看、抽取、审计必须由后端 worker
              或授权文档服务返回原生 manifest。
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
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
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Metric
            label="抽取"
            value={extractRoute?.adapter ?? 'Office extractor'}
          />
          <Metric label="解析" value={parseRoute?.adapter ?? 'OOXML parser'} />
          <Metric label="状态" value="backend native required" />
        </div>
      </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted rounded-2xl px-3 py-2">
      <p className="arch-muted text-[11px] font-bold">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}
