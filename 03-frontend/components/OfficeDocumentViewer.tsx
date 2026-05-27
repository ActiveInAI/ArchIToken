// components/OfficeDocumentViewer.tsx - Backend-native Office and text viewers
// License: Apache-2.0
"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  AlignLeft,
  ArrowUpDown,
  Bold,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  FileUp,
  Info,
  ListOrdered,
  Loader2,
  Paintbrush,
  PencilLine,
  Save,
  Scissors,
  Search,
  ServerCog,
  Share2,
  Type,
  Users,
} from "lucide-react";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import {
  DockableViewerToolbar,
  type ViewerToolbarMetric,
} from "@/components/DockableViewerToolbar";
import {
  codeEditorLineCount,
  codeEditorProfileForFileName,
  cursorPositionForText,
  formatCodeEditorContent,
  mimeTypeForCodeEditorContent,
  validateCodeEditorContent,
  type CodeEditorCursorPosition,
  type CodeEditorDiagnostic,
  type CodeEditorProfile,
} from "@/lib/code-file-editor";
import { extensionOf, fileTypeForFileName } from "@/lib/file-type-registry";
import {
  formatModuleFileSize,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import {
  canPreviewOfficeInBrowser,
  officeNativePreviewRequiredMessage,
  officePreviewFamilyForExtension,
} from "@/lib/office-preview-policy";

const prengineLabel = "Prengine";
const onlyOfficeScriptPromises = new Map<string, Promise<void>>();

type PreviewState =
  | { status: "loading"; message: string }
  | { status: "text"; text: string }
  | { status: "failed"; message: string };

type LoadState<T> =
  | { status: "loading"; message: string }
  | { status: "ready"; value: T }
  | { status: "failed"; message: string };

type SpreadsheetCell = string | number | boolean | Date | null;

interface SpreadsheetCellPreview {
  address: string;
  value: SpreadsheetCell;
  colSpan: number;
  rowSpan: number;
  hidden: boolean;
  style?: CSSProperties;
}

type SpreadsheetRow = SpreadsheetCellPreview[];

interface SheetPreview {
  name: string;
  rows: SpreadsheetRow[];
  rowCount: number;
  columnCount: number;
  rangeAddress: string;
  columnWidths: number[];
  rowHeights: number[];
}

interface PresentationSlidePreview {
  id: string;
  title: string;
  texts: string[];
  boxes: PresentationTextBox[];
  note: string;
}

interface PresentationTextBox {
  id: string;
  text: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  fontSize: number;
}

type OfficePreviewState =
  | { status: "loading"; message: string }
  | { status: "pdf"; url: string; engine: string }
  | { status: "native-html"; html: string; engine: string }
  | { status: "docx"; html: string; messages: string[] }
  | { status: "sheet"; sheets: SheetPreview[]; activeSheet: string }
  | {
      status: "presentation";
      slides: PresentationSlidePreview[];
      activeSlide: string;
    }
  | { status: "unsupported"; message: string }
  | { status: "failed"; message: string };

type OfficePaperPreset = "auto" | "a4" | "a3" | "b5";
type OfficeViewMode = "editor" | "native" | "layout";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (
        containerId: string,
        config: OnlyOfficeEditorConfig,
      ) => { destroyEditor?: () => void };
    };
  }
}

interface OfficeDocumentViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

interface OfficeNativeSessionManifest {
  schema: "architoken.office_native_session.v1";
  fileId: string;
  originalName: string;
  sourceFormat: string;
  viewer:
    | "onlyoffice_editor"
    | "collabora_wopi_editor"
    | "office_runtime_required";
  engine: string;
  canEdit: boolean;
  canSaveBack: boolean;
  onlyoffice?: {
    apiScriptUrl: string;
    documentServerUrl: string;
    config: OnlyOfficeEditorConfig;
  };
  collabora?: {
    documentServerUrl: string;
    editorUrl: string;
    wopiSrc: string;
    accessToken: string;
    accessTokenTtl: number;
    mode: "edit";
  };
  adapters: Array<{
    id: string;
    label: string;
    status: string;
    installHint: string;
    endpoint?: string;
  }>;
  notes: string[];
}

interface OnlyOfficeEditorConfig {
  type: "desktop";
  documentType: "word" | "cell" | "slide" | "pdf";
  document: Record<string, unknown>;
  editorConfig: Record<string, unknown>;
  token?: string;
  width?: string;
  height?: string;
  events?: {
    onAppReady?: () => void;
    onError?: (event: { data?: unknown }) => void;
  };
}

export function OfficeDocumentViewer({
  file,
  sourceUrl,
}: OfficeDocumentViewerProps) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const family = officePreviewFamilyForExtension(ext);
  const [paperPreset, setPaperPreset] = useState<OfficePaperPreset>("a4");
  const [viewMode, setViewMode] = useState<OfficeViewMode>("editor");
  const [state, setState] = useState<OfficePreviewState>({
    status: "loading",
    message: "正在读取 Office 文件...",
  });

  const [prevExt, setPrevExt] = useState(ext);
  const [prevSourceUrl, setPrevSourceUrl] = useState(sourceUrl);

  if (ext !== prevExt || sourceUrl !== prevSourceUrl) {
    setPrevExt(ext);
    setPrevSourceUrl(sourceUrl);
    setViewMode("editor");
  }

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const abortController = new AbortController();

    async function loadOfficePreview() {
      if (viewMode === "editor") {
        return;
      }

      setState({
        status: "loading",
        message:
          viewMode === "layout"
            ? "正在生成 Prengine 文档版式派生..."
            : "正在以 Office 原生结构读取文件...",
      });

      if (viewMode === "layout") {
        const nativePreview = await loadNativeOfficePdfPreview(
          sourceUrl,
          abortController.signal,
        );
        if (cancelled) {
          if (nativePreview) {
            URL.revokeObjectURL(nativePreview.url);
          }
          return;
        }
        if (nativePreview) {
          objectUrl = nativePreview.url;
          setState({
            status: "pdf",
            url: nativePreview.url,
            engine: nativePreview.engine,
          });
          return;
        }
        setState({
          status: "unsupported",
          message: `${officeNativePreviewRequiredMessage(ext)} 当前未生成可用 PDF 版式派生。`,
        });
        return;
      }

      const nativeHtmlPreview = await loadNativeOfficeHtmlPreview(
        sourceUrl,
        abortController.signal,
      );
      if (cancelled) return;
      if (nativeHtmlPreview) {
        setState({
          status: "native-html",
          html: sanitizeOfficeHtml(nativeHtmlPreview.html),
          engine: nativeHtmlPreview.engine,
        });
        return;
      }

      if (!canPreviewOfficeInBrowser(ext)) {
        setState({
          status: "unsupported",
          message: officeNativePreviewRequiredMessage(ext),
        });
        return;
      }

      try {
        const response = await fetch(sourceUrl, {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`读取 Office 文件失败: HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        if (ext === ".docx") {
          const result = await mammoth.convertToHtml(
            { arrayBuffer },
            { convertImage: mammoth.images.dataUri },
          );
          if (!cancelled) {
            setState({
              status: "docx",
              html: sanitizeOfficeHtml(result.value),
              messages: result.messages.map((message) => message.message),
            });
          }
          return;
        }

        if ([".pptx", ".pptm", ".ppsx"].includes(ext)) {
          const slides = await parsePptxPreview(arrayBuffer);
          if (!cancelled) {
            if (slides.length === 0) {
              setState({
                status: "unsupported",
                message: "PPTX 未找到可显示的幻灯片内容。",
              });
            } else {
              setState({
                status: "presentation",
                slides,
                activeSlide: slides[0]?.id ?? "",
              });
            }
          }
          return;
        }

        const workbook = XLSX.read(arrayBuffer, {
          type: "array",
          cellDates: true,
        });
        const sheets = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          return worksheet ? buildSheetPreview(sheetName, worksheet) : null;
        }).filter((sheet): sheet is SheetPreview => Boolean(sheet));

        if (!cancelled) {
          if (sheets.length === 0) {
            setState({
              status: "unsupported",
              message: "工作簿没有可显示的工作表。",
            });
          } else {
            setState({
              status: "sheet",
              sheets,
              activeSheet: sheets[0]?.name ?? "",
            });
          }
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

    void loadOfficePreview();

    return () => {
      cancelled = true;
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [ext, sourceUrl, viewMode]);

  const officeToolbarEditProps = {
    editActive: viewMode === "editor",
    onEdit: () => setViewMode("editor"),
  };

  if (viewMode === "editor") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="原生 Office 在线编辑"
            {...officeToolbarEditProps}
            metrics={[
              { label: "显示", value: "OnlyOffice/Collabora 原生服务" },
              { label: "保存", value: "回写源对象版本" },
            ]}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
          </OfficeToolbar>
        }
      >
        <NativeOfficeEditor file={file} sourceUrl={sourceUrl} />
      </DocumentShell>
    );
  }

  if (state.status === "loading") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="读取中"
            {...officeToolbarEditProps}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
          </OfficeToolbar>
        }
      >
        <div className="arch-card-muted flex items-center gap-3 rounded-lg p-4 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (state.status === "failed") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="预览失败"
            {...officeToolbarEditProps}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
          </OfficeToolbar>
        }
      >
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-500">
          {state.message}
        </div>
      </DocumentShell>
    );
  }

  if (state.status === "unsupported") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="需要后端原生查看"
            {...officeToolbarEditProps}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
          </OfficeToolbar>
        }
      >
        <OfficeRuntimeNotice message={state.message} />
      </DocumentShell>
    );
  }

  if (state.status === "pdf") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel={`${state.engine} 原版式 PDF`}
            {...officeToolbarEditProps}
            metrics={[
              { label: "版式", value: "源文件导出" },
              { label: "渲染", value: "PDF" },
            ]}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
          </OfficeToolbar>
        }
      >
        <div className="h-[calc(100vh-185px)] min-h-[640px] overflow-hidden rounded-lg border border-[var(--arch-border)] bg-slate-100">
          <object
            data={state.url}
            type="application/pdf"
            className="h-full w-full"
            aria-label={`${file.name} PDF 原版预览`}
          >
            <iframe
              src={state.url}
              className="h-full w-full"
              title={`${file.name} PDF 原版预览`}
            />
          </object>
        </div>
      </DocumentShell>
    );
  }

  if (state.status === "native-html") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel={`${state.engine} 原生 HTML`}
            {...officeToolbarEditProps}
            metrics={[
              { label: "显示", value: "OfficeCLI HTML" },
              { label: "源绑定", value: "本地对象" },
            ]}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
          </OfficeToolbar>
        }
      >
        <div className="max-h-[calc(100vh-185px)] overflow-auto rounded-lg bg-slate-100 p-4">
          <article
            className="mx-auto min-h-[60vh] max-w-6xl bg-white p-6 text-slate-950 shadow-sm"
            style={{ overflowWrap: "anywhere" }}
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        </div>
      </DocumentShell>
    );
  }

  if (state.status === "docx") {
    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="DOCX 文档结构"
            {...officeToolbarEditProps}
            metrics={[
              { label: "显示", value: "Office 原生结构" },
              { label: "纸张", value: paperPreset.toUpperCase() },
            ]}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
            <div className="mt-2">
              <PaperPresetButtons
                value={paperPreset}
                onChange={setPaperPreset}
              />
            </div>
          </OfficeToolbar>
        }
      >
        <div className="max-h-[calc(100vh-185px)] overflow-auto rounded-lg bg-slate-100 p-4">
          <article
            className="mx-auto max-w-full bg-white text-[12pt] leading-[1.55] text-slate-950 shadow-sm"
            style={{
              ...paperPresetStyle(paperPreset),
              overflowWrap: "anywhere",
            }}
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        </div>
        {state.messages.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-5 text-amber-700">
            {state.messages.slice(0, 3).join(" / ")}
          </div>
        ) : null}
      </DocumentShell>
    );
  }

  if (state.status === "presentation") {
    const activeSlide =
      state.slides.find((slide) => slide.id === state.activeSlide) ??
      state.slides[0];

    return (
      <DocumentShell
        file={file}
        toolbar={
          <OfficeToolbar
            file={file}
            sourceUrl={sourceUrl}
            statusLabel="PPTX 幻灯片结构"
            {...officeToolbarEditProps}
            metrics={[
              { label: "幻灯片", value: state.slides.length.toLocaleString() },
              { label: "显示", value: "Office 原生结构" },
            ]}
          >
            <OfficeViewModeButtons
              value={viewMode}
              onChange={setViewMode}
              family={family}
            />
            <div className="mt-2 grid gap-1">
              {state.slides.slice(0, 20).map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() =>
                    setState((current) =>
                      current.status === "presentation"
                        ? { ...current, activeSlide: slide.id }
                        : current,
                    )
                  }
                  className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-medium ${
                    activeSlide?.id === slide.id
                      ? "arch-card-selected"
                      : "arch-btn"
                  }`}
                  title={slide.title}
                >
                  <span className="block truncate">
                    {index + 1}. {slide.title}
                  </span>
                </button>
              ))}
            </div>
          </OfficeToolbar>
        }
      >
        {activeSlide ? (
          <div className="max-h-[calc(100vh-185px)] overflow-auto rounded-lg bg-slate-100 p-4">
            <article className="relative mx-auto aspect-[16/9] min-h-[420px] max-w-5xl overflow-hidden rounded-md bg-white text-slate-950 shadow-sm">
              {activeSlide.boxes.length > 0 ? (
                activeSlide.boxes.map((box) => (
                  <div
                    key={box.id}
                    className="absolute overflow-hidden whitespace-pre-wrap break-words leading-tight"
                    style={{
                      left: `${box.leftPct}%`,
                      top: `${box.topPct}%`,
                      width: `${box.widthPct}%`,
                      height: `${box.heightPct}%`,
                      fontSize: box.fontSize,
                    }}
                  >
                    {box.text}
                  </div>
                ))
              ) : (
                <div className="p-10">
                  <p className="text-xs font-medium text-blue-600">
                    {activeSlide.id}
                  </p>
                  <h2 className="mt-4 text-3xl font-semibold">
                    {activeSlide.title}
                  </h2>
                  <div className="mt-8 space-y-4 text-xl leading-8">
                    {activeSlide.texts.slice(0, 14).map((text, index) => (
                      <p key={`${activeSlide.id}-${index}`}>{text}</p>
                    ))}
                  </div>
                  <p className="mt-10 text-xs text-slate-500">
                    {activeSlide.note}
                  </p>
                </div>
              )}
            </article>
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
          statusLabel="Office 工作簿结构"
          {...officeToolbarEditProps}
          metrics={[
            { label: "工作表", value: state.sheets.length.toLocaleString() },
            {
              label: "行列",
              value: activeSheet
                ? `${activeSheet.rowCount.toLocaleString()} x ${activeSheet.columnCount.toLocaleString()}`
                : "-",
            },
            { label: "范围", value: activeSheet?.rangeAddress ?? "-" },
            { label: "显示", value: "Office 原生结构" },
          ]}
        >
          <OfficeViewModeButtons
            value={viewMode}
            onChange={setViewMode}
            family={family}
          />
          <div className="mt-2 grid gap-1">
            {state.sheets.slice(0, 10).map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() =>
                  setState((current) =>
                    current.status === "sheet"
                      ? { ...current, activeSheet: sheet.name }
                      : current,
                  )
                }
                className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-medium ${
                  activeSheet?.name === sheet.name
                    ? "arch-card-selected"
                    : "arch-btn"
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
        <div className="max-h-[calc(100vh-185px)] overflow-auto rounded-lg border bg-slate-100 p-4">
          <div
            className="inline-block min-w-max bg-white shadow-sm"
            style={{
              width: activeSheet.columnWidths.reduce(
                (sum, width) => sum + width,
                0,
              ),
            }}
          >
            <table className="border-collapse table-fixed bg-white text-xs text-slate-900">
              <colgroup>
                {activeSheet.columnWidths.map((width, columnIndex) => (
                  <col
                    key={`${activeSheet.name}-col-${columnIndex}`}
                    style={{ width }}
                  />
                ))}
              </colgroup>
              <tbody>
                {activeSheet.rows.map((row, rowIndex) => (
                  <tr
                    key={`${activeSheet.name}-row-${rowIndex}`}
                    style={{ height: activeSheet.rowHeights[rowIndex] ?? 30 }}
                  >
                    {row
                      .filter((cell) => !cell.hidden)
                      .map((cell) => (
                        <td
                          key={`${activeSheet.name}-${cell.address}`}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className="border border-slate-200 px-2 py-1 align-top"
                          style={cell.style}
                        >
                          {formatSpreadsheetCell(cell.value)}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </DocumentShell>
  );
}

function OfficeRuntimeNotice({ message }: { message: string }) {
  return (
    <>
      <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4">
        <div className="flex items-start gap-3">
          <span className="arch-primary-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <ServerCog className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 className="arch-text text-base font-medium">
              后端原生 Office 查看链路
            </h4>
            <p className="arch-muted mt-1 text-sm leading-6">{message}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          已绑定真实源文件；DOC/DOCX、XLS/XLSX、PPT/PPTX 等格式必须由 Prengine
          文档服务返回可审计原版式结果，浏览器端抽取内容不得替代源文件幅面。
        </span>
      </div>
    </>
  );
}

export function NativeOfficeEditor({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const sessionUrl = officeSessionUrl(sourceUrl);
  const isPdfSource =
    (file.localFile?.ext || extensionOf(file.name)).toLowerCase() === ".pdf";
  const [state, setState] = useState<LoadState<OfficeNativeSessionManifest>>({
    status: "loading",
    message: "正在准备 Office 原生编辑会话...",
  });
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const editorId = useId();
  const containerId = useMemo(
    () => `office-native-${editorId.replace(/:/g, "")}`,
    [editorId],
  );
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);

  useEffect(() => {
    if (!sessionUrl) return;
    let cancelled = false;
    const currentSessionUrl = sessionUrl;

    async function loadSession() {
      setState({
        status: "loading",
        message: "正在准备 Office 原生编辑会话...",
      });
      try {
        const response = await fetch(currentSessionUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "Office 原生会话创建失败"),
          );
        }
        const manifest = (await response.json()) as OfficeNativeSessionManifest;
        if (!cancelled) {
          setState({ status: "ready", value: manifest });
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

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionUrl]);

  const onlyoffice =
    state.status === "ready" ? state.value.onlyoffice : undefined;
  const collabora =
    state.status === "ready" ? state.value.collabora : undefined;

  useEffect(() => {
    if (!onlyoffice) return;
    let cancelled = false;
    const currentOnlyOffice = onlyoffice;

    async function mountEditor() {
      setLaunchMessage("正在加载 OnlyOffice DocumentServer...");
      try {
        await loadOnlyOfficeApiScript(currentOnlyOffice.apiScriptUrl);
        if (cancelled) return;
        if (!window.DocsAPI?.DocEditor) {
          throw new Error("OnlyOffice DocsAPI 未挂载到 window。");
        }
        editorRef.current?.destroyEditor?.();
        const config: OnlyOfficeEditorConfig = {
          ...currentOnlyOffice.config,
          width: "100%",
          height: "100%",
          events: {
            onAppReady: () => setLaunchMessage(null),
            onError: (event) =>
              setLaunchMessage(`OnlyOffice 编辑器错误：${String(event.data)}`),
          },
        };
        editorRef.current = new window.DocsAPI.DocEditor(containerId, config);
      } catch (error) {
        if (!cancelled) {
          setLaunchMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }

    void mountEditor();

    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
    };
  }, [containerId, onlyoffice]);

  useEffect(() => {
    if (!collabora) return;
    const showTimer = window.setTimeout(
      () => setLaunchMessage("正在连接 Collabora Online WOPI 编辑器..."),
      0,
    );
    const hideTimer = window.setTimeout(() => setLaunchMessage(null), 1200);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [collabora]);

  if (!sessionUrl) {
    return (
      <OfficeRuntimeNotice message="当前源文件不是本地受控对象，无法创建可回写的 Office 原生编辑会话。" />
    );
  }

  if (state.status === "loading") {
    return (
      <div className="arch-card-muted flex items-center gap-3 rounded-lg p-4 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" />
        {state.message}
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-500">
        {state.message}
      </div>
    );
  }

  if (
    !state.value.canEdit ||
    (!state.value.onlyoffice && !state.value.collabora)
  ) {
    return (
      <OfficeRuntimeNotice
        message={
          state.value.notes.filter(Boolean).join(" ") ||
          "当前未配置 OnlyOffice/Collabora 原生 Office 编辑服务。"
        }
      />
    );
  }

  return (
    <div className="relative h-[calc(100vh-185px)] min-h-[680px] overflow-hidden rounded-lg border border-[var(--arch-border)] bg-white">
      {collabora ? (
        <iframe
          title={`${file.name} Collabora Online editor`}
          src={collabora.editorUrl}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      ) : (
        <div id={containerId} className="h-full w-full" />
      )}
      {launchMessage ? (
        <div className="absolute inset-x-4 top-4 rounded-md border border-[var(--arch-border)] bg-white/95 px-3 py-2 text-xs text-[var(--arch-text-muted)] shadow-sm">
          {launchMessage}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[var(--arch-border)] bg-white/90 px-3 py-2 text-[11px] text-[var(--arch-text-muted)] shadow-sm">
        {file.name} · {state.value.engine} ·{" "}
        {collabora && isPdfSource
          ? "Collabora PDF 查看/批注"
          : collabora
            ? "Collabora WOPI 保存回写"
            : "保存回写本地对象"}
      </div>
    </div>
  );
}

function OfficeToolbar({
  file,
  sourceUrl,
  statusLabel,
  metrics = [],
  editActive = false,
  onEdit,
  children,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  statusLabel: string;
  metrics?: ViewerToolbarMetric[];
  editActive?: boolean;
  onEdit?: () => void;
  children?: ReactNode;
}) {
  return (
    <DockableViewerToolbar
      title="Office 查看"
      subtitle={statusLabel}
      metrics={[...officeRuntimeMetrics(file, sourceUrl), ...metrics]}
      actions={
        <OfficeCommandActions
          sourceUrl={sourceUrl}
          fileName={file.name}
          editActive={editActive}
          onEdit={onEdit}
        />
      }
    >
      <OfficeDetailedCommandGrid />
      {children ? (
        <div className="mt-2 border-t border-[var(--arch-border)] pt-2">
          {children}
        </div>
      ) : null}
    </DockableViewerToolbar>
  );
}

function OfficeCommandActions({
  sourceUrl,
  fileName,
  editActive,
  onEdit,
}: {
  sourceUrl: string;
  fileName: string;
  editActive: boolean;
  onEdit: (() => void) | undefined;
}) {
  const previewUrl = officePdfPreviewUrl(sourceUrl);

  return (
    <>
      <ViewerActionLink href={sourceUrl} label="下载源文件" download={fileName}>
        <FileDown className="h-3.5 w-3.5" />
      </ViewerActionLink>
      <ViewerActionLink href={sourceUrl} label="在新标签打开源文件" newTab>
        <ExternalLink className="h-3.5 w-3.5" />
      </ViewerActionLink>
      <ViewerActionLink href={previewUrl} label="Prengine PDF预览" newTab>
        <FileText className="h-3.5 w-3.5" />
      </ViewerActionLink>
      <ViewerActionButton
        label={editActive ? "正在编辑" : "在线编辑"}
        disabled={!onEdit}
        onClick={onEdit}
      >
        <PencilLine className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton label="保存版本" disabled>
        <Save className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton label="分享" disabled>
        <Share2 className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton label="属性" disabled>
        <Info className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton label="搜索" disabled>
        <Search className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton label="协作" disabled>
        <Users className="h-3.5 w-3.5" />
      </ViewerActionButton>
    </>
  );
}

function OfficeDetailedCommandGrid() {
  const commands: Array<{ label: string; icon: ReactNode }> = [
    { label: "导入", icon: <FileUp className="h-3.5 w-3.5" /> },
    { label: "导出", icon: <Download className="h-3.5 w-3.5" /> },
    { label: "字号", icon: <Type className="h-3.5 w-3.5" /> },
    { label: "加粗", icon: <Bold className="h-3.5 w-3.5" /> },
    { label: "序号", icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { label: "复制", icon: <Copy className="h-3.5 w-3.5" /> },
    { label: "剪切", icon: <Scissors className="h-3.5 w-3.5" /> },
    { label: "粘贴", icon: <Clipboard className="h-3.5 w-3.5" /> },
    { label: "对齐", icon: <AlignLeft className="h-3.5 w-3.5" /> },
    { label: "排序", icon: <ArrowUpDown className="h-3.5 w-3.5" /> },
    { label: "格式刷", icon: <Paintbrush className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="grid grid-cols-4 gap-1">
      {commands.map((command) => (
        <ViewerActionButton key={command.label} label={command.label} disabled>
          {command.icon}
        </ViewerActionButton>
      ))}
    </div>
  );
}

function officeRuntimeMetrics(
  file: ModuleFileNode,
  sourceUrl: string,
): ViewerToolbarMetric[] {
  const registryEntry = fileTypeForFileName(file.name);

  return [
    {
      label: "源文件",
      value: sourceUrl.startsWith("/api/local-files/")
        ? "本地对象"
        : "对象存储",
    },
    { label: "类型", value: registryEntry?.logicalType ?? "office.document" },
    { label: "预览", value: prengineLabel },
    { label: "运行时", value: prengineLabel },
    { label: "解析", value: prengineLabel },
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
    { value: "auto", label: "自适应" },
    { value: "a4", label: "A4" },
    { value: "a3", label: "A3" },
    { value: "b5", label: "B5" },
  ];

  return (
    <div className="grid grid-cols-2 gap-1">
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => onChange(preset.value)}
          className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
            value === preset.value ? "arch-card-selected" : "arch-btn"
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function OfficeViewModeButtons({
  value,
  onChange,
  family,
}: {
  value: OfficeViewMode;
  onChange: (value: OfficeViewMode) => void;
  family: ReturnType<typeof officePreviewFamilyForExtension>;
}) {
  const nativeLabel =
    family === "spreadsheet"
      ? "表格"
      : family === "presentation"
        ? "幻灯片"
        : "文档";
  const modes: Array<{ value: OfficeViewMode; label: string }> = [
    { value: "editor", label: "编辑" },
    { value: "native", label: nativeLabel },
    { value: "layout", label: "版式" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onChange(mode.value)}
          className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
            value === mode.value ? "arch-card-selected" : "arch-btn"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function paperPresetStyle(preset: OfficePaperPreset): CSSProperties {
  if (preset === "a3") {
    return {
      width: "297mm",
      minHeight: "420mm",
      padding: "18mm 20mm",
    };
  }
  if (preset === "b5") {
    return {
      width: "176mm",
      minHeight: "250mm",
      padding: "14mm 15mm",
    };
  }
  if (preset === "auto") {
    return {
      minHeight: "60vh",
      width: "min(100%, 1280px)",
      padding: "24px",
    };
  }
  return {
    width: "210mm",
    minHeight: "297mm",
    padding: "16mm 18mm",
  };
}

async function parsePptxPreview(
  arrayBuffer: ArrayBuffer,
): Promise<PresentationSlidePreview[]> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideEntries = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((left, right) => slideNumber(left) - slideNumber(right));

  const slides: PresentationSlidePreview[] = [];
  const parser = new DOMParser();
  const slideSize = await parsePptxSlideSize(zip, parser);

  for (const path of slideEntries.slice(0, 80)) {
    const entry = zip.files[path];
    if (!entry) continue;
    const xml = await entry.async("text");
    const document = parser.parseFromString(xml, "application/xml");
    const boxes = parsePptxTextBoxes(document, slideSize);
    const texts = boxes.length
      ? boxes.map((box) => box.text)
      : Array.from(document.getElementsByTagName("a:t"))
          .map((node) => node.textContent?.trim() ?? "")
          .filter(Boolean);
    const uniqueTexts = [...new Set(texts)];
    slides.push({
      id: `Slide ${slideNumber(path)}`,
      title: uniqueTexts[0] || `幻灯片 ${slideNumber(path)}`,
      texts: uniqueTexts.length ? uniqueTexts : ["该页没有可提取文本。"],
      boxes,
      note: "当前按 OOXML 幻灯片结构显示文本框；母版、动画和复杂 SmartArt 由 OfficeCLI/Prengine 原生服务接管。",
    });
  }

  return slides;
}

interface PptxSlideSize {
  widthEmu: number;
  heightEmu: number;
}

async function parsePptxSlideSize(
  zip: JSZip,
  parser: DOMParser,
): Promise<PptxSlideSize> {
  const entry = zip.files["ppt/presentation.xml"];
  if (!entry) {
    return defaultPptxSlideSize();
  }
  const xml = await entry.async("text");
  const document = parser.parseFromString(xml, "application/xml");
  const size =
    document.getElementsByTagName("p:sldSz")[0] ??
    document.getElementsByTagName("sldSz")[0];
  const widthEmu = positiveNumberAttribute(size, "cx");
  const heightEmu = positiveNumberAttribute(size, "cy");
  if (!widthEmu || !heightEmu) {
    return defaultPptxSlideSize();
  }
  return { widthEmu, heightEmu };
}

function defaultPptxSlideSize(): PptxSlideSize {
  return { widthEmu: 12_192_000, heightEmu: 6_858_000 };
}

function parsePptxTextBoxes(
  document: Document,
  slideSize: PptxSlideSize,
): PresentationTextBox[] {
  return Array.from(document.getElementsByTagName("p:sp"))
    .map((shape, index) => pptxShapeToTextBox(shape, index, slideSize))
    .filter((box): box is PresentationTextBox => Boolean(box));
}

function pptxShapeToTextBox(
  shape: Element,
  index: number,
  slideSize: PptxSlideSize,
): PresentationTextBox | null {
  const text = pptxShapeText(shape);
  if (!text) return null;

  const transform = shape.getElementsByTagName("a:xfrm")[0];
  const offset = transform?.getElementsByTagName("a:off")[0];
  const extent = transform?.getElementsByTagName("a:ext")[0];
  const x = positiveNumberAttribute(offset, "x");
  const y = positiveNumberAttribute(offset, "y");
  const cx = positiveNumberAttribute(extent, "cx");
  const cy = positiveNumberAttribute(extent, "cy");
  if (x === null || y === null || cx === null || cy === null) {
    return null;
  }

  const leftPct = clampPct((x / slideSize.widthEmu) * 100);
  const topPct = clampPct((y / slideSize.heightEmu) * 100);
  const widthPct = clampPct((cx / slideSize.widthEmu) * 100, 6, 100 - leftPct);
  const heightPct = clampPct((cy / slideSize.heightEmu) * 100, 4, 100 - topPct);

  return {
    id: `pptx-text-${index}`,
    text,
    leftPct,
    topPct,
    widthPct,
    heightPct,
    fontSize: pptxShapeFontSize(shape),
  };
}

function pptxShapeText(shape: Element): string {
  const paragraphs = Array.from(shape.getElementsByTagName("a:p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("a:t"))
        .map((node) => node.textContent ?? "")
        .join("")
        .trim(),
    )
    .filter(Boolean);
  if (paragraphs.length > 0) {
    return paragraphs.join("\n");
  }
  return Array.from(shape.getElementsByTagName("a:t"))
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();
}

function pptxShapeFontSize(shape: Element): number {
  const runProperties = Array.from(shape.getElementsByTagName("a:rPr"));
  for (const properties of runProperties) {
    const size = positiveNumberAttribute(properties, "sz");
    if (size) {
      return Math.min(48, Math.max(10, size / 100));
    }
  }
  return 18;
}

function positiveNumberAttribute(
  element: Element | undefined,
  name: string,
): number | null {
  if (!element) return null;
  const value = Number.parseFloat(element.getAttribute(name) ?? "");
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function clampPct(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function slideNumber(path: string): number {
  const match = /slide(\d+)\.xml$/i.exec(path);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}

async function loadNativeOfficePdfPreview(
  sourceUrl: string,
  signal: AbortSignal,
): Promise<{ url: string; engine: string } | null> {
  try {
    const response = await fetch(officePdfPreviewUrl(sourceUrl), {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("pdf")) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    return {
      url: URL.createObjectURL(blob),
      engine:
        response.headers.get("x-architoken-preview-engine") ??
        response.headers.get("x-architoken-office-engine") ??
        prengineLabel,
    };
  } catch {
    return null;
  }
}

async function loadNativeOfficeHtmlPreview(
  sourceUrl: string,
  signal: AbortSignal,
): Promise<{ html: string; engine: string } | null> {
  if (!/\/api\/local-files\/[^/?#]+$/i.test(sourceUrl)) {
    return null;
  }
  try {
    const response = await fetch(`${sourceUrl}/preview?format=html`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) return null;
    const html = await response.text();
    if (!html.trim()) return null;
    return {
      html,
      engine:
        response.headers.get("x-architoken-preview-engine") ??
        response.headers.get("x-architoken-office-engine") ??
        "OfficeCLI",
    };
  } catch {
    return null;
  }
}

function officePdfPreviewUrl(sourceUrl: string): string {
  if (/\/api\/local-files\/[^/?#]+$/i.test(sourceUrl)) {
    return `${sourceUrl}/preview?format=pdf`;
  }
  return `${sourceUrl}${sourceUrl.includes("?") ? "&" : "?"}format=pdf`;
}

function officeSessionUrl(sourceUrl: string): string | null {
  if (/\/api\/local-files\/[^/?#]+$/i.test(sourceUrl)) {
    return `${sourceUrl}/office-session`;
  }
  return null;
}

function loadOnlyOfficeApiScript(src: string): Promise<void> {
  if (typeof window !== "undefined" && window.DocsAPI?.DocEditor) {
    return Promise.resolve();
  }
  const existing = onlyOfficeScriptPromises.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-architoken-onlyoffice-api="${cssEscapeAttribute(src)}"]`,
    );
    if (current) {
      current.addEventListener("load", () => resolve(), { once: true });
      current.addEventListener(
        "error",
        () => reject(new Error(`OnlyOffice API 加载失败：${src}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.architokenOnlyofficeApi = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`OnlyOffice API 加载失败：${src}`));
    document.head.appendChild(script);
  });
  onlyOfficeScriptPromises.set(src, promise);
  return promise;
}

function cssEscapeAttribute(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

async function responseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return (
      payload.message || payload.error || `${fallback}: HTTP ${response.status}`
    );
  } catch {
    return `${fallback}: HTTP ${response.status}`;
  }
}

function sanitizeOfficeHtml(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  document
    .querySelectorAll("script, style, iframe, object, embed, link, meta")
    .forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "src" || name === "href") && value.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return document.body.innerHTML;
}

function buildSheetPreview(
  sheetName: string,
  worksheet: XLSX.WorkSheet,
): SheetPreview {
  const sourceRef =
    typeof worksheet["!ref"] === "string" && worksheet["!ref"].trim()
      ? worksheet["!ref"]
      : "A1:A1";
  const range = XLSX.utils.decode_range(sourceRef);
  const lastPreviewRow = Math.min(range.e.r, range.s.r + 239);
  const lastPreviewColumn = Math.min(range.e.c, range.s.c + 59);
  const mergeMaps = spreadsheetMergeMaps(
    worksheet,
    range.s.r,
    lastPreviewRow,
    range.s.c,
    lastPreviewColumn,
  );
  const rows: SpreadsheetRow[] = [];

  for (let rowIndex = range.s.r; rowIndex <= lastPreviewRow; rowIndex += 1) {
    const row: SpreadsheetRow = [];
    for (
      let columnIndex = range.s.c;
      columnIndex <= lastPreviewColumn;
      columnIndex += 1
    ) {
      const address = XLSX.utils.encode_cell({
        r: rowIndex,
        c: columnIndex,
      });
      const span = mergeMaps.topLeft.get(address);
      row.push({
        address,
        value: spreadsheetCellValue(worksheet[address]),
        colSpan: span?.colSpan ?? 1,
        rowSpan: span?.rowSpan ?? 1,
        hidden: mergeMaps.covered.has(address),
        style: spreadsheetCellStyle(worksheet[address]),
      });
    }
    rows.push(row);
  }

  const columnWidths = [];
  for (
    let columnIndex = range.s.c;
    columnIndex <= lastPreviewColumn;
    columnIndex += 1
  ) {
    const configuredWidth = spreadsheetColumnWidth(worksheet, columnIndex);
    columnWidths.push(
      configuredWidth === 0
        ? 0
        : Math.max(
            configuredWidth,
            spreadsheetContentColumnWidth(rows, columnIndex - range.s.c),
          ),
    );
  }
  const rowHeights = [];
  for (let rowIndex = range.s.r; rowIndex <= lastPreviewRow; rowIndex += 1) {
    const previewRowIndex = rowIndex - range.s.r;
    const configuredHeight = spreadsheetRowHeight(worksheet, rowIndex);
    rowHeights.push(
      configuredHeight === 0
        ? 0
        : Math.max(
            configuredHeight,
            spreadsheetContentRowHeight(
              rows[previewRowIndex] ?? [],
              columnWidths,
            ),
          ),
    );
  }

  return {
    name: sheetName,
    rows,
    rowCount: range.e.r - range.s.r + 1,
    columnCount: range.e.c - range.s.c + 1,
    rangeAddress: sourceRef,
    columnWidths,
    rowHeights,
  };
}

function spreadsheetMergeMaps(
  worksheet: XLSX.WorkSheet,
  firstRow: number,
  lastRow: number,
  firstColumn: number,
  lastColumn: number,
): {
  covered: Set<string>;
  topLeft: Map<string, { colSpan: number; rowSpan: number }>;
} {
  const covered = new Set<string>();
  const topLeft = new Map<string, { colSpan: number; rowSpan: number }>();
  const merges = (worksheet["!merges"] ?? []) as XLSX.Range[];

  for (const merge of merges) {
    const startRow = Math.max(merge.s.r, firstRow);
    const endRow = Math.min(merge.e.r, lastRow);
    const startColumn = Math.max(merge.s.c, firstColumn);
    const endColumn = Math.min(merge.e.c, lastColumn);
    if (startRow > endRow || startColumn > endColumn) continue;
    const topLeftAddress = XLSX.utils.encode_cell({
      r: startRow,
      c: startColumn,
    });
    topLeft.set(topLeftAddress, {
      colSpan: endColumn - startColumn + 1,
      rowSpan: endRow - startRow + 1,
    });
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        if (address !== topLeftAddress) {
          covered.add(address);
        }
      }
    }
  }

  return { covered, topLeft };
}

function spreadsheetCellValue(
  cell: XLSX.CellObject | undefined,
): SpreadsheetCell {
  if (!cell) return "";
  if (typeof cell.w === "string") return cell.w;
  return normalizeSpreadsheetCell(cell.v as SpreadsheetCell);
}

function spreadsheetCellStyle(
  cell: XLSX.CellObject | undefined,
): CSSProperties {
  if (!cell) {
    return spreadsheetDefaultCellStyle();
  }
  const style: CSSProperties = spreadsheetDefaultCellStyle();
  if (cell.t === "n") {
    style.textAlign = "right";
  } else if (cell.t === "b") {
    style.textAlign = "center";
  }
  return style;
}

function spreadsheetDefaultCellStyle(): CSSProperties {
  return {
    minWidth: 36,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

function spreadsheetColumnWidth(
  worksheet: XLSX.WorkSheet,
  columnIndex: number,
): number {
  const columns = worksheet["!cols"] as
    | Array<{
        hidden?: boolean;
        width?: number;
        wch?: number;
        wpx?: number;
      }>
    | undefined;
  const column = columns?.[columnIndex];
  if (column?.hidden) return 0;
  const pixelWidth = numericSpreadsheetDimension(column?.wpx);
  if (pixelWidth) {
    return clampSpreadsheetDimension(pixelWidth, 48, 420, 120);
  }
  const characterWidth =
    numericSpreadsheetDimension(column?.wch) ??
    numericSpreadsheetDimension(column?.width);
  return clampSpreadsheetDimension(
    characterWidth ? characterWidth * 7 + 12 : null,
    48,
    420,
    120,
  );
}

function spreadsheetContentColumnWidth(
  rows: SpreadsheetRow[],
  previewColumnIndex: number,
): number {
  let score = 0;
  for (const row of rows) {
    const cell = row[previewColumnIndex];
    if (!cell || cell.hidden || cell.colSpan > 1) continue;
    score = Math.max(
      score,
      spreadsheetDisplayWidth(formatSpreadsheetCell(cell.value)),
    );
  }
  if (score <= 0) return 64;
  return clampSpreadsheetDimension(score * 7 + 28, 56, 640, 96);
}

function spreadsheetContentRowHeight(
  row: SpreadsheetRow,
  columnWidths: number[],
): number {
  let lineCount = 1;
  row
    .filter((cell) => !cell.hidden)
    .forEach((cell) => {
      const text = formatSpreadsheetCell(cell.value);
      if (!text) return;
      const startIndex = row.findIndex((candidate) => candidate === cell);
      const width = columnWidths
        .slice(startIndex, startIndex + cell.colSpan)
        .reduce((sum, value) => sum + value, 0);
      const capacity = Math.max(8, Math.floor(Math.max(width - 16, 40) / 7));
      const wrappedLines = text
        .split(/\r?\n/)
        .reduce(
          (sum, line) =>
            sum +
            Math.max(1, Math.ceil(spreadsheetDisplayWidth(line) / capacity)),
          0,
        );
      lineCount = Math.max(lineCount, wrappedLines);
    });
  return clampSpreadsheetDimension(lineCount * 18 + 12, 24, 360, 30);
}

function spreadsheetDisplayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += /[\u3000-\u9fff\uff00-\uffef]/u.test(char) ? 2 : 1;
  }
  return width;
}

function spreadsheetRowHeight(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
): number {
  const rows = worksheet["!rows"] as
    | Array<{ hidden?: boolean; hpx?: number; hpt?: number }>
    | undefined;
  const row = rows?.[rowIndex];
  if (row?.hidden) return 0;
  const height =
    numericSpreadsheetDimension(row?.hpx) ??
    numericSpreadsheetDimension(row?.hpt) ??
    null;
  return clampSpreadsheetDimension(height, 20, 180, 30);
}

function numericSpreadsheetDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function clampSpreadsheetDimension(
  value: number | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.min(max, Math.max(min, value ?? fallback));
}

function normalizeSpreadsheetCell(cell: SpreadsheetCell): SpreadsheetCell {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (cell === undefined) {
    return "";
  }
  return cell;
}

function formatSpreadsheetCell(cell: SpreadsheetCell): string {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (cell === null) {
    return "";
  }
  return String(cell);
}

export function TextDataViewer({ file, sourceUrl }: OfficeDocumentViewerProps) {
  const [state, setState] = useState<PreviewState>({
    status: "loading",
    message: "正在读取文本...",
  });
  const [draftText, setDraftText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] =
    useState<CodeEditorCursorPosition>({ line: 1, column: 1 });

  useEffect(() => {
    let cancelled = false;

    async function loadText() {
      setState({ status: "loading", message: "正在读取文本..." });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`读取文本失败: HTTP ${response.status}`);
        }
        const text = await response.text();
        if (!cancelled) {
          setState({ status: "text", text });
          setDraftText(text);
          setEditMode(false);
          setSaveState("idle");
          setCommandMessage(null);
          setCursorPosition({ line: 1, column: 1 });
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

    void loadText();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const visibleText =
    state.status === "text" ? (editMode ? draftText : state.text) : "";
  const editorProfile = useMemo(
    () =>
      codeEditorProfileForFileName(
        file.name,
        file.localFile?.mimeType ?? file.mimeType,
      ),
    [file.localFile?.mimeType, file.mimeType, file.name],
  );
  const editorDiagnostic = useMemo(
    () => validateCodeEditorContent(file.name, visibleText),
    [file.name, visibleText],
  );
  const visibleLineCount = useMemo(
    () => codeEditorLineCount(visibleText),
    [visibleText],
  );
  const canSaveText = canPersistLocalText(sourceUrl);
  const isSaving = saveState === "saving";
  const statusLabel = editMode
    ? "文本编辑"
    : saveState === "saved"
      ? "已保存本地版本"
      : "文本预览";
  const tableRows = useMemo(() => {
    if (state.status !== "text" || editMode || ![".csv", ".tsv"].includes(ext))
      return null;
    const delimiter = ext === ".tsv" ? "\t" : ",";
    return state.text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 160)
      .map((line) => line.split(delimiter).slice(0, 40));
  }, [editMode, ext, state]);

  function toggleEditMode() {
    setEditMode((value) => !value);
    setCommandMessage(null);
  }

  async function saveDraftText() {
    if (!canSaveText || state.status !== "text") {
      setCommandMessage("当前源不是本地受控对象，不能直接覆盖保存。");
      return;
    }
    setSaveState("saving");
    setCommandMessage(null);
    try {
      const response = await fetch(sourceUrl, {
        method: "PUT",
        headers: { "content-type": mimeTypeForTextEdit(file) },
        body: new TextEncoder().encode(draftText),
      });
      if (!response.ok) {
        throw new Error(`保存失败: HTTP ${response.status}`);
      }
      setState({ status: "text", text: draftText });
      setEditMode(false);
      setSaveState("saved");
      setCommandMessage("已保存为新的本地文件版本。");
    } catch (error) {
      setSaveState("failed");
      setCommandMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function formatDraftText() {
    try {
      const formatted = formatCodeEditorContent(file.name, draftText);
      if (!formatted) {
        setCommandMessage("当前格式未启用浏览器内格式化。");
        return;
      }
      setDraftText(formatted);
      setCursorPosition({ line: 1, column: 1 });
      setCommandMessage("已完成基础格式化，保存后写入本地 CDE 版本。");
    } catch (error) {
      setCommandMessage(
        error instanceof Error ? `格式化失败: ${error.message}` : String(error),
      );
    }
  }

  async function copyVisibleText() {
    if (!visibleText) return;
    try {
      await navigator.clipboard.writeText(visibleText);
      setCommandMessage("已复制当前文本。");
    } catch {
      setCommandMessage("浏览器未授予剪贴板写入权限。");
    }
  }

  function searchVisibleText() {
    if (!visibleText) return;
    const query = window.prompt("搜索文本");
    if (!query?.trim()) return;
    const found = (
      window as Window & { find?: (query: string) => boolean }
    ).find?.(query.trim());
    setCommandMessage(found === false ? "未找到匹配文本。" : null);
  }

  if (state.status === "loading") {
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

  if (state.status === "failed") {
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
            statusLabel={ext === ".tsv" ? "TSV 表格" : "CSV 表格"}
            text={visibleText}
            editMode={editMode}
            canSave={canSaveText}
            isSaving={isSaving}
            profile={editorProfile}
            diagnostic={editorDiagnostic}
            cursorPosition={cursorPosition}
            lineCount={visibleLineCount}
            canFormat={editorProfile.supportsFormatting}
            onEdit={toggleEditMode}
            onFormat={formatDraftText}
            onSave={saveDraftText}
            onCopy={copyVisibleText}
            onSearch={searchVisibleText}
            metrics={[
              { label: "行", value: tableRows.length.toLocaleString() },
              {
                label: "列",
                value: Math.max(
                  ...tableRows.map((row) => row.length),
                  0,
                ).toLocaleString(),
              },
            ]}
          />
        }
      >
        <div className="max-h-[calc(100vh-190px)] overflow-auto rounded-lg border">
          <table className="arch-resizable-table min-w-full border-collapse text-sm">
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr
                  key={`csv-row-${rowIndex}`}
                  className={
                    rowIndex === 0 ? "arch-surface-muted font-medium" : ""
                  }
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
        {commandMessage ? (
          <div className="mt-2 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] px-3 py-2 text-sm text-[var(--arch-text-muted)]">
            {commandMessage}
          </div>
        ) : null}
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
          statusLabel={statusLabel}
          text={visibleText}
          editMode={editMode}
          canSave={canSaveText}
          isSaving={isSaving}
          profile={editorProfile}
          diagnostic={editorDiagnostic}
          cursorPosition={cursorPosition}
          lineCount={visibleLineCount}
          canFormat={editorProfile.supportsFormatting}
          onEdit={toggleEditMode}
          onFormat={formatDraftText}
          onSave={saveDraftText}
          onCopy={copyVisibleText}
          onSearch={searchVisibleText}
          metrics={[
            {
              label: "字符",
              value: visibleText.length.toLocaleString(),
            },
            { label: "保存", value: canSaveText ? "本地对象" : "只读源" },
          ]}
        />
      }
    >
      {editMode ? (
        <TextDataEditor
          value={draftText}
          profile={editorProfile}
          onChange={setDraftText}
          onCursorPositionChange={setCursorPosition}
          onSave={saveDraftText}
        />
      ) : (
        <CodeTextPreview text={visibleText} />
      )}
      {commandMessage ? (
        <div
          className={
            saveState === "failed"
              ? "mt-2 rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-500"
              : "mt-2 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] px-3 py-2 text-sm text-[var(--arch-text-muted)]"
          }
        >
          {commandMessage}
        </div>
      ) : null}
    </DocumentShell>
  );
}

function TextDataToolbar({
  file,
  sourceUrl,
  statusLabel,
  text = "",
  editMode = false,
  canSave = false,
  isSaving = false,
  profile,
  diagnostic,
  cursorPosition,
  lineCount,
  canFormat = false,
  onEdit,
  onFormat,
  onSave,
  onCopy,
  onSearch,
  metrics = [],
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  statusLabel: string;
  text?: string;
  editMode?: boolean;
  canSave?: boolean;
  isSaving?: boolean;
  profile?: CodeEditorProfile;
  diagnostic?: CodeEditorDiagnostic;
  cursorPosition?: CodeEditorCursorPosition;
  lineCount?: number;
  canFormat?: boolean;
  onEdit?: (() => void) | undefined;
  onFormat?: (() => void) | undefined;
  onSave?: (() => void | Promise<void>) | undefined;
  onCopy?: (() => void | Promise<void>) | undefined;
  onSearch?: (() => void) | undefined;
  metrics?: ViewerToolbarMetric[];
}) {
  return (
    <DockableViewerToolbar
      title="代码/文本查看"
      subtitle={statusLabel}
      metrics={[
        { label: "格式", value: extensionOf(file.name) || "text" },
        { label: "大小", value: formatModuleFileSize(file.size) },
        ...(profile ? [{ label: "语言", value: profile.label }] : []),
        ...(lineCount ? [{ label: "行", value: lineCount.toLocaleString() }] : []),
        ...(cursorPosition && editMode
          ? [
              {
                label: "光标",
                value: `${cursorPosition.line}:${cursorPosition.column}`,
              },
            ]
          : []),
        ...(diagnostic
          ? [{ label: "检查", value: diagnostic.label }]
          : []),
        ...metrics,
      ]}
      actions={
        <TextDataCommandActions
          sourceUrl={sourceUrl}
          fileName={file.name}
          text={text}
          editMode={editMode}
          canSave={canSave}
          isSaving={isSaving}
          canFormat={canFormat}
          {...(diagnostic ? { diagnostic } : {})}
          onEdit={onEdit}
          onFormat={onFormat}
          onSave={onSave}
          onCopy={onCopy}
          onSearch={onSearch}
        />
      }
    />
  );
}

function TextDataCommandActions({
  sourceUrl,
  fileName,
  text,
  editMode,
  canSave,
  isSaving,
  diagnostic,
  canFormat,
  onEdit,
  onFormat,
  onSave,
  onCopy,
  onSearch,
}: {
  sourceUrl: string;
  fileName: string;
  text: string;
  editMode: boolean;
  canSave: boolean;
  isSaving: boolean;
  diagnostic?: CodeEditorDiagnostic;
  canFormat: boolean;
  onEdit?: (() => void) | undefined;
  onFormat?: (() => void) | undefined;
  onSave?: (() => void | Promise<void>) | undefined;
  onCopy?: (() => void | Promise<void>) | undefined;
  onSearch?: (() => void) | undefined;
}) {
  return (
    <>
      <ViewerActionLink href={sourceUrl} label="下载源文件" download={fileName}>
        <FileDown className="h-3.5 w-3.5" />
      </ViewerActionLink>
      <ViewerActionLink href={sourceUrl} label="在新标签打开源文件" newTab>
        <ExternalLink className="h-3.5 w-3.5" />
      </ViewerActionLink>
      <ViewerActionButton
        label="搜索"
        disabled={!text || !onSearch}
        onClick={onSearch}
      >
        <Search className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton
        label={editMode ? "退出编辑" : "编辑"}
        disabled={!canSave || !onEdit}
        onClick={onEdit}
        title={canSave ? undefined : "只支持本地受控文本对象直接编辑"}
      >
        <PencilLine className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton
        label="格式化"
        disabled={!editMode || !canFormat || !onFormat}
        onClick={onFormat}
        title={canFormat ? "基础格式化" : "当前格式未启用浏览器内格式化"}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ViewerActionButton>
      <ViewerActionButton
        label="保存版本"
        disabled={!editMode || !canSave || isSaving || !onSave}
        onClick={onSave}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
      </ViewerActionButton>
      <ViewerActionButton
        label="复制"
        disabled={!text || !onCopy}
        onClick={onCopy}
      >
        <Copy className="h-3.5 w-3.5" />
      </ViewerActionButton>
      {diagnostic ? (
        <span
          className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
          title={diagnostic.message}
          aria-label={diagnostic.label}
          role="status"
        >
          <AlertCircle
            className={`h-3.5 w-3.5 ${
              diagnostic.status === "failed"
                ? "text-red-500"
                : diagnostic.status === "warning"
                  ? "text-amber-500"
                  : diagnostic.status === "passed"
                    ? "text-[var(--arch-primary)]"
                    : ""
            }`}
          />
        </span>
      ) : null}
    </>
  );
}

function TextDataEditor({
  value,
  profile,
  onChange,
  onCursorPositionChange,
  onSave,
}: {
  value: string;
  profile: CodeEditorProfile;
  onChange: (value: string) => void;
  onCursorPositionChange: (position: CodeEditorCursorPosition) => void;
  onSave: () => void | Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const lineNumbers = useMemo(
    () =>
      Array.from({ length: codeEditorLineCount(value) }, (_, index) => index + 1),
    [value],
  );

  function setSelection(start: number, end = start) {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.selectionStart = start;
      textarea.selectionEnd = end;
      onCursorPositionChange(cursorPositionForText(textarea.value, start));
    });
  }

  function syncCursor(target: HTMLTextAreaElement) {
    onCursorPositionChange(
      cursorPositionForText(target.value, target.selectionStart),
    );
  }

  function replaceSelection(
    target: HTMLTextAreaElement,
    nextValue: string,
    start: number,
    end = start,
  ) {
    onChange(nextValue);
    setSelection(start, end);
    setScrollTop(target.scrollTop);
  }

  function handleTab(target: HTMLTextAreaElement, shiftKey: boolean) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd =
      end > start
        ? end
        : value.indexOf("\n", start) === -1
          ? value.length
          : value.indexOf("\n", start);

    if (shiftKey) {
      const block = value.slice(lineStart, lineEnd);
      const unindented = block.replace(/^( {1,2}|\t)/gm, "");
      replaceSelection(
        target,
        `${value.slice(0, lineStart)}${unindented}${value.slice(lineEnd)}`,
        lineStart,
        lineStart + unindented.length,
      );
      return;
    }

    if (start === end) {
      replaceSelection(
        target,
        `${value.slice(0, start)}  ${value.slice(end)}`,
        start + 2,
      );
      return;
    }

    const block = value.slice(lineStart, lineEnd);
    const indented = block.replace(/^/gm, "  ");
    replaceSelection(
      target,
      `${value.slice(0, lineStart)}${indented}${value.slice(lineEnd)}`,
      start + 2,
      lineStart + indented.length,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void onSave();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      handleTab(event.currentTarget, event.shiftKey);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-230px)] grid-cols-[3.75rem_minmax(0,1fr)] overflow-hidden rounded-md border border-[var(--arch-border)] bg-[#0d1117] font-mono text-xs leading-5">
      <div className="relative overflow-hidden border-r border-slate-800 bg-slate-950/72 text-right text-[10px] text-slate-500">
        <div
          className="px-3 py-3"
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {lineNumbers.map((line) => (
            <div key={line} className="h-5 select-none">
              {line}
            </div>
          ))}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="min-h-[calc(100vh-230px)] w-full resize-none overflow-auto border-0 bg-transparent p-3 text-slate-100 outline-none selection:bg-emerald-400/25"
        aria-label={`${profile.label} 代码编辑器`}
        data-language={profile.languageId}
        spellCheck={false}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          syncCursor(event.target);
        }}
        onClick={(event) => syncCursor(event.currentTarget)}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => syncCursor(event.currentTarget)}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onSelect={(event) => syncCursor(event.currentTarget)}
      />
    </div>
  );
}

function canPersistLocalText(sourceUrl: string): boolean {
  return /^\/api\/local-files\/[^/]+$/.test(sourceUrl);
}

function mimeTypeForTextEdit(file: ModuleFileNode): string {
  return mimeTypeForCodeEditorContent({
    name: file.name,
    mimeType: file.mimeType,
    ...(file.localFile?.mimeType
      ? { localMimeType: file.localFile.mimeType }
      : {}),
  });
}

function CodeTextPreview({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="max-h-[calc(100vh-190px)] overflow-auto rounded-md border-0 bg-[#0d1117] font-mono text-xs leading-5 text-slate-200 shadow-none">
      <div className="grid min-w-full grid-cols-[3.5rem_minmax(0,1fr)]">
        {lines.map((line, index) => (
          <div key={`line-${index}`} className="contents">
            <span className="select-none border-r border-slate-800 bg-slate-950/72 px-3 py-0.5 text-right text-[10px] text-slate-500">
              {index + 1}
            </span>
            <pre className="min-h-5 whitespace-pre-wrap break-words px-3 py-0.5">
              {line || " "}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewerActionButton({
  label,
  disabled = false,
  title,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  title?: string | undefined;
  onClick?: (() => void | Promise<void>) | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void onClick?.();
      }}
      className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60"
      title={title ?? (disabled ? `${label}需要后端受控运行时` : label)}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ViewerActionLink({
  href,
  label,
  download,
  newTab = false,
  children,
}: {
  href: string;
  label: string;
  download?: string;
  newTab?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      download={download}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
      title={label}
      aria-label={label}
    >
      {children}
    </a>
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
      className="relative min-h-[calc(100vh-170px)] overflow-hidden rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3"
      data-file-name={file.name}
    >
      {toolbar}
      <div className="min-h-0">{children}</div>
    </section>
  );
}
