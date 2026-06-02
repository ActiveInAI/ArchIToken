// components/CodeMonacoEditor.tsx - Monaco-backed local CDE code editor
// License: Apache-2.0
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Bug,
  Clipboard,
  Download,
  FileCode2,
  Folder,
  GitBranch,
  MoreHorizontal,
  PanelLeft,
  Redo2,
  Save,
  Search,
  Settings,
  Undo2,
} from "lucide-react";
import type {
  editor as MonacoEditorNamespace,
  IDisposable,
} from "monaco-editor";
import {
  codeEditorLineCount,
  cursorPositionForText,
  monacoLanguageIdForCodeEditorProfile,
  type CodeEditorCursorPosition,
  type CodeEditorProfile,
} from "@/lib/code-file-editor";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";

type MonacoModule = typeof import("monaco-editor");
type CodeActivityView =
  | "explorer"
  | "search"
  | "source-control"
  | "diagnostics"
  | "settings";
type CodeToolbarMenu = "file" | "edit" | "selection" | "view" | "more";
type CodeWorkbenchActions = {
  save: () => void | Promise<void>;
  download: () => void;
  copy: () => void | Promise<void>;
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  find: (query?: string) => void;
  replace: () => void;
  format: () => void | Promise<void>;
  foldAll: () => void;
  unfoldAll: () => void;
  focus: () => void;
};
type CodeToolbarCommand = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onRun: () => void | Promise<void>;
};
type MonacoEnvironmentWindow = Window & {
  MonacoEnvironment?: {
    getWorker?: (workerId: string, label: string) => Worker;
  };
};

const VSCODE_DEFAULT_DARK_MONACO_THEME = "architoken-vscode-default-dark";
const vscodeDefaultDarkVars = {
  "--vscode-accent": "#0078d4",
  "--vscode-border": "#2b2b2b",
  "--vscode-command-center-bg": "#242424",
  "--vscode-editor-bg": "#1f1f1f",
  "--vscode-foreground": "#cccccc",
  "--vscode-hover-bg": "#2a2d2e",
  "--vscode-input-bg": "#313131",
  "--vscode-menu-bg": "#1f1f1f",
  "--vscode-muted": "#858585",
  "--vscode-side-bg": "#181818",
  "--vscode-selection-bg": "#37373d",
  "--vscode-titlebar-bg": "#181818",
} as CSSProperties;

let monacoLoader: Promise<MonacoModule> | null = null;

export function CodeMonacoEditor({
  value,
  profile,
  fileName = "source.txt",
  onChange,
  onCursorPositionChange,
  onSave,
}: {
  value: string;
  profile: CodeEditorProfile;
  fileName?: string;
  onChange: (value: string) => void;
  onCursorPositionChange: (position: CodeEditorCursorPosition) => void;
  onSave: () => void | Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(
    null,
  );
  const modelRef = useRef<MonacoEditorNamespace.ITextModel | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);
  const valueRef = useRef(value);
  const suppressChangeRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCursorPositionChangeRef = useRef(onCursorPositionChange);
  const onSaveRef = useRef(onSave);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const monacoLanguageId = useMemo(
    () => monacoLanguageIdForCodeEditorProfile(profile),
    [profile],
  );

  useEffect(() => {
    onChangeRef.current = onChange;
    onCursorPositionChangeRef.current = onCursorPositionChange;
    onSaveRef.current = onSave;
  }, [onChange, onCursorPositionChange, onSave]);

  useEffect(() => {
    let cancelled = false;

    async function mountMonaco() {
      if (!containerRef.current) return;
      setLoadState("loading");
      setLoadError(null);
      try {
        const monaco = await loadMonaco();
        if (cancelled || !containerRef.current) return;
        defineVSCodeDefaultDarkMonacoTheme(monaco);

        const model = monaco.editor.createModel(
          valueRef.current,
          monacoLanguageId,
        );
        const editor = monaco.editor.create(containerRef.current, {
          model,
          theme: VSCODE_DEFAULT_DARK_MONACO_THEME,
          automaticLayout: true,
          minimap: { enabled: false },
          fontFamily:
            "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
          fontSize: 12,
          lineHeight: 20,
          insertSpaces: true,
          tabSize: 2,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          renderWhitespace: "selection",
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        });

        modelRef.current = model;
        editorRef.current = editor;
        disposablesRef.current = [
          model.onDidChangeContent(() => {
            if (suppressChangeRef.current) return;
            const nextValue = model.getValue();
            valueRef.current = nextValue;
            onChangeRef.current(nextValue);
          }),
          editor.onDidChangeCursorPosition((event) => {
            onCursorPositionChangeRef.current({
              line: event.position.lineNumber,
              column: event.position.column,
            });
          }),
        ];
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          void onSaveRef.current();
        });
        editor.focus();
        setLoadState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadState("failed");
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void mountMonaco();

    return () => {
      cancelled = true;
      for (const disposable of disposablesRef.current) {
        disposable.dispose();
      }
      disposablesRef.current = [];
      editorRef.current?.dispose();
      editorRef.current = null;
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, [monacoLanguageId]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model || value === valueRef.current) return;
    suppressChangeRef.current = true;
    valueRef.current = value;
    model.setValue(value);
    suppressChangeRef.current = false;
  }, [value]);

  const workbenchActions = useMemo<CodeWorkbenchActions>(
    () => ({
      save: () => onSaveRef.current(),
      download: () => downloadCodeFile(fileName, valueRef.current),
      copy: () =>
        copyTextToClipboard(
          selectedMonacoText(editorRef.current) || valueRef.current,
        ),
      undo: () => runMonacoEditorCommand(editorRef.current, "undo"),
      redo: () => runMonacoEditorCommand(editorRef.current, "redo"),
      selectAll: () =>
        runMonacoEditorAction(editorRef.current, "editor.action.selectAll"),
      find: (query?: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        if (query) {
          selectMonacoQueryMatch(editor, query);
          return;
        }
        runMonacoEditorAction(editor, "actions.find");
      },
      replace: () =>
        runMonacoEditorAction(
          editorRef.current,
          "editor.action.startFindReplaceAction",
        ),
      format: () =>
        runMonacoEditorAction(
          editorRef.current,
          "editor.action.formatDocument",
        ),
      foldAll: () =>
        runMonacoEditorCommand(editorRef.current, "editor.foldAll"),
      unfoldAll: () =>
        runMonacoEditorCommand(editorRef.current, "editor.unfoldAll"),
      focus: () => editorRef.current?.focus(),
    }),
    [fileName],
  );

  if (loadState === "failed") {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-600">
          Monaco 编辑器加载失败，已切换到受控文本编辑器：{loadError}
        </div>
        <NativeCodeTextarea
          value={value}
          profile={profile}
          fileName={fileName}
          onChange={onChange}
          onCursorPositionChange={onCursorPositionChange}
          onSave={onSave}
        />
      </div>
    );
  }

  return (
    <CodeWorkbenchShell
      fileName={fileName}
      profile={profile}
      actions={workbenchActions}
    >
      <div className="relative min-w-0 bg-[var(--vscode-editor-bg)]">
        <div
          ref={containerRef}
          className="h-full w-full"
          role="application"
          aria-label={`${profile.label} Monaco 代码编辑器`}
          data-language={profile.languageId}
        />
        {loadState === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--vscode-editor-bg)] text-sm text-[var(--vscode-muted)]">
            <ArchLoadingFlow
              label="正在加载 Monaco 编辑器"
              size="panel"
              showLabel
            />
          </div>
        ) : null}
      </div>
    </CodeWorkbenchShell>
  );
}

function NativeCodeTextarea({
  value,
  profile,
  fileName = "source.txt",
  onChange,
  onCursorPositionChange,
  onSave,
}: {
  value: string;
  profile: CodeEditorProfile;
  fileName?: string;
  onChange: (value: string) => void;
  onCursorPositionChange: (position: CodeEditorCursorPosition) => void;
  onSave: () => void | Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const lineNumbers = useMemo(
    () =>
      Array.from(
        { length: codeEditorLineCount(value) },
        (_, index) => index + 1,
      ),
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

  const syncCursor = useCallback(
    (target: HTMLTextAreaElement) => {
      onCursorPositionChange(
        cursorPositionForText(target.value, target.selectionStart),
      );
    },
    [onCursorPositionChange],
  );

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

  const workbenchActions = useMemo<CodeWorkbenchActions>(
    () => ({
      save: onSave,
      download: () => downloadCodeFile(fileName, value),
      copy: async () => {
        const textarea = textareaRef.current;
        const selectedText = textarea
          ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
          : "";
        await copyTextToClipboard(selectedText || value);
      },
      undo: () => runNativeTextareaCommand(textareaRef.current, "undo"),
      redo: () => runNativeTextareaCommand(textareaRef.current, "redo"),
      selectAll: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.select();
        onCursorPositionChange(cursorPositionForText(textarea.value, 0));
      },
      find: (query?: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        if (!query) return;
        const index = textarea.value.toLowerCase().indexOf(query.toLowerCase());
        if (index < 0) return;
        textarea.selectionStart = index;
        textarea.selectionEnd = index + query.length;
        textarea.scrollTop = Math.max(
          0,
          (index / textarea.value.length) * textarea.scrollHeight,
        );
        syncCursor(textarea);
      },
      replace: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
      },
      format: () => undefined,
      foldAll: () => undefined,
      unfoldAll: () => undefined,
      focus: () => textareaRef.current?.focus(),
    }),
    [fileName, onCursorPositionChange, onSave, syncCursor, value],
  );

  return (
    <CodeWorkbenchShell
      fileName={fileName}
      profile={profile}
      actions={workbenchActions}
    >
      <div className="grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] overflow-hidden bg-[var(--vscode-editor-bg)] font-mono text-xs leading-5">
        <div className="relative overflow-hidden border-r border-[var(--vscode-border)] bg-[var(--vscode-editor-bg)] text-right text-[10px] text-[var(--vscode-muted)]">
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
          className="min-h-[calc(100vh-230px)] w-full resize-none overflow-auto border-0 bg-transparent p-3 text-[var(--vscode-foreground)] outline-none selection:bg-[#264f78]"
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
    </CodeWorkbenchShell>
  );
}

function CodeWorkbenchShell({
  fileName,
  profile,
  actions,
  children,
}: {
  fileName: string;
  profile: CodeEditorProfile;
  actions: CodeWorkbenchActions;
  children: ReactNode;
}) {
  const [activeView, setActiveView] = useState<CodeActivityView>("explorer");
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(true);

  function showView(view: CodeActivityView) {
    setActiveView(view);
    setIsSidePanelVisible(true);
  }

  return (
    <div
      style={vscodeDefaultDarkVars}
      className="grid h-[calc(100vh-230px)] min-h-[420px] grid-rows-[2.125rem_minmax(0,1fr)] overflow-visible rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-editor-bg)] text-[var(--vscode-foreground)]"
    >
      <CodeTopBar
        fileName={fileName}
        activeView={activeView}
        isSidePanelVisible={isSidePanelVisible}
        actions={actions}
        onShowView={showView}
        onToggleSidePanel={() => setIsSidePanelVisible((current) => !current)}
      />
      <div
        className={`grid min-h-0 overflow-hidden ${
          isSidePanelVisible
            ? "grid-cols-[2.75rem_15rem_minmax(0,1fr)]"
            : "grid-cols-[2.75rem_minmax(0,1fr)]"
        }`}
      >
        <CodeActivityBar activeView={activeView} onChange={showView} />
        {isSidePanelVisible ? (
          <CodeSidePanel
            activeView={activeView}
            fileName={fileName}
            profile={profile}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}

function CodeTopBar({
  fileName,
  activeView,
  isSidePanelVisible,
  actions,
  onShowView,
  onToggleSidePanel,
}: {
  fileName: string;
  activeView: CodeActivityView;
  isSidePanelVisible: boolean;
  actions: CodeWorkbenchActions;
  onShowView: (view: CodeActivityView) => void;
  onToggleSidePanel: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<CodeToolbarMenu | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const menuGroups = useMemo(
    () =>
      buildCodeToolbarMenus({
        activeView,
        isSidePanelVisible,
        actions,
        onShowView,
        onToggleSidePanel,
      }),
    [activeView, actions, isSidePanelVisible, onShowView, onToggleSidePanel],
  );

  function runCommand(command: CodeToolbarCommand) {
    if (command.disabled) return;
    setOpenMenu(null);
    void command.onRun();
  }

  function runSearch() {
    actions.find(searchQuery.trim() || undefined);
  }

  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(12rem,26rem)_minmax(0,1fr)] items-center border-b border-[var(--vscode-border)] bg-[var(--vscode-titlebar-bg)] px-2 text-[12px] text-[var(--vscode-foreground)]">
      <div className="flex min-w-0 items-center gap-3">
        <FileCode2 className="h-4 w-4 shrink-0 text-[var(--vscode-accent)]" />
        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          {menuGroups.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === menu.id ? null : menu.id,
                  )
                }
                className={`rounded px-1.5 py-1 hover:bg-[var(--vscode-hover-bg)] hover:text-white ${
                  openMenu === menu.id
                    ? "bg-[var(--vscode-hover-bg)] text-white"
                    : ""
                }`}
                aria-haspopup="menu"
                aria-expanded={openMenu === menu.id}
                aria-label={
                  typeof menu.label === "string" ? menu.label : "更多菜单"
                }
              >
                {menu.label}
              </button>
              {openMenu === menu.id ? (
                <CodeCommandMenu commands={menu.commands} onRun={runCommand} />
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded border border-[#3c3c3c] bg-[var(--vscode-command-center-bg)] px-2 py-1 text-[var(--vscode-muted)] focus-within:border-[var(--vscode-accent)]">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => onShowView("search")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch();
            }
            if (event.key === "Escape") {
              setSearchQuery("");
              actions.focus();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[var(--vscode-foreground)] outline-none placeholder:text-[var(--vscode-muted)]"
          placeholder={fileName}
          aria-label="搜索当前文件"
        />
      </div>
      <div className="flex min-w-0 justify-end">
        <button
          type="button"
          onClick={() => void actions.save()}
          className="flex h-7 items-center gap-1 rounded px-2 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-hover-bg)] hover:text-white"
          title="保存版本"
          aria-label="保存版本"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">保存</span>
        </button>
      </div>
    </div>
  );
}

function CodeCommandMenu({
  commands,
  onRun,
}: {
  commands: CodeToolbarCommand[];
  onRun: (command: CodeToolbarCommand) => void;
}) {
  return (
    <div
      role="menu"
      className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md border border-[#3c3c3c] bg-[var(--vscode-menu-bg)] py-1 text-[12px] text-[var(--vscode-foreground)] shadow-xl"
    >
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          role="menuitem"
          disabled={command.disabled}
          onClick={() => onRun(command)}
          className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--vscode-hover-bg)] disabled:cursor-not-allowed disabled:text-[#5f5f5f]"
        >
          <span className="text-[var(--vscode-muted)]">{command.icon}</span>
          <span className="truncate">{command.label}</span>
          {command.shortcut ? (
            <span className="text-[11px] text-[var(--vscode-muted)]">
              {command.shortcut}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function buildCodeToolbarMenus({
  activeView,
  isSidePanelVisible,
  actions,
  onShowView,
  onToggleSidePanel,
}: {
  activeView: CodeActivityView;
  isSidePanelVisible: boolean;
  actions: CodeWorkbenchActions;
  onShowView: (view: CodeActivityView) => void;
  onToggleSidePanel: () => void;
}): Array<{
  id: CodeToolbarMenu;
  label: ReactNode;
  commands: CodeToolbarCommand[];
}> {
  return [
    {
      id: "file",
      label: "文件",
      commands: [
        {
          id: "save",
          label: "保存版本",
          shortcut: "Ctrl+S",
          icon: <Save className="h-3.5 w-3.5" />,
          onRun: actions.save,
        },
        {
          id: "download",
          label: "下载副本",
          icon: <Download className="h-3.5 w-3.5" />,
          onRun: actions.download,
        },
      ],
    },
    {
      id: "edit",
      label: "编辑",
      commands: [
        {
          id: "undo",
          label: "撤销",
          shortcut: "Ctrl+Z",
          icon: <Undo2 className="h-3.5 w-3.5" />,
          onRun: actions.undo,
        },
        {
          id: "redo",
          label: "重做",
          shortcut: "Ctrl+Y",
          icon: <Redo2 className="h-3.5 w-3.5" />,
          onRun: actions.redo,
        },
        {
          id: "copy",
          label: "复制",
          shortcut: "Ctrl+C",
          icon: <Clipboard className="h-3.5 w-3.5" />,
          onRun: actions.copy,
        },
        {
          id: "find",
          label: "查找",
          shortcut: "Ctrl+F",
          icon: <Search className="h-3.5 w-3.5" />,
          onRun: () => actions.find(),
        },
        {
          id: "replace",
          label: "替换",
          shortcut: "Ctrl+H",
          icon: <Search className="h-3.5 w-3.5" />,
          onRun: actions.replace,
        },
      ],
    },
    {
      id: "selection",
      label: "选择",
      commands: [
        {
          id: "select-all",
          label: "全选",
          shortcut: "Ctrl+A",
          icon: <FileCode2 className="h-3.5 w-3.5" />,
          onRun: actions.selectAll,
        },
      ],
    },
    {
      id: "view",
      label: "查看",
      commands: [
        {
          id: "side-panel",
          label: isSidePanelVisible ? "隐藏侧栏" : "显示侧栏",
          icon: <PanelLeft className="h-3.5 w-3.5" />,
          onRun: onToggleSidePanel,
        },
        {
          id: "explorer",
          label: activeView === "explorer" ? "资源管理器 ✓" : "资源管理器",
          icon: <Folder className="h-3.5 w-3.5" />,
          onRun: () => onShowView("explorer"),
        },
        {
          id: "search",
          label: activeView === "search" ? "搜索 ✓" : "搜索",
          icon: <Search className="h-3.5 w-3.5" />,
          onRun: () => onShowView("search"),
        },
        {
          id: "source-control",
          label:
            activeView === "source-control" ? "源代码管理 ✓" : "源代码管理",
          icon: <GitBranch className="h-3.5 w-3.5" />,
          onRun: () => onShowView("source-control"),
        },
        {
          id: "diagnostics",
          label: activeView === "diagnostics" ? "诊断 ✓" : "诊断",
          icon: <Bug className="h-3.5 w-3.5" />,
          onRun: () => onShowView("diagnostics"),
        },
        {
          id: "settings",
          label: activeView === "settings" ? "设置 ✓" : "设置",
          icon: <Settings className="h-3.5 w-3.5" />,
          onRun: () => onShowView("settings"),
        },
      ],
    },
    {
      id: "more",
      label: <MoreHorizontal className="h-4 w-4" />,
      commands: [
        {
          id: "format",
          label: "格式化文档",
          icon: <MoreHorizontal className="h-3.5 w-3.5" />,
          onRun: actions.format,
        },
        {
          id: "fold-all",
          label: "全部折叠",
          icon: <PanelLeft className="h-3.5 w-3.5" />,
          onRun: actions.foldAll,
        },
        {
          id: "unfold-all",
          label: "全部展开",
          icon: <PanelLeft className="h-3.5 w-3.5" />,
          onRun: actions.unfoldAll,
        },
      ],
    },
  ];
}

function CodeActivityBar({
  activeView,
  onChange,
}: {
  activeView: CodeActivityView;
  onChange: (view: CodeActivityView) => void;
}) {
  const tools = [
    { id: "explorer", label: "资源管理器", icon: Folder },
    { id: "search", label: "搜索", icon: Search },
    { id: "source-control", label: "源代码管理", icon: GitBranch },
    { id: "diagnostics", label: "诊断", icon: Bug },
    { id: "settings", label: "设置", icon: Settings },
  ];

  return (
    <div className="flex flex-col items-center justify-between border-r border-[var(--vscode-border)] bg-[var(--vscode-side-bg)] py-2">
      <div className="flex flex-col gap-1">
        {tools.slice(0, 4).map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onChange(tool.id as CodeActivityView)}
              className={`flex h-9 w-9 items-center justify-center border-l-2 ${
                activeView === tool.id
                  ? "border-[var(--vscode-accent)] text-white"
                  : "border-transparent text-[var(--vscode-muted)] hover:text-[var(--vscode-foreground)]"
              }`}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange("settings")}
        className={`flex h-9 w-9 items-center justify-center border-l-2 ${
          activeView === "settings"
            ? "border-[var(--vscode-accent)] text-white"
            : "border-transparent text-[var(--vscode-muted)] hover:text-[var(--vscode-foreground)]"
        }`}
        title={tools[4]?.label}
        aria-label={tools[4]?.label}
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}

function CodeSidePanel({
  activeView,
  fileName,
  profile,
}: {
  activeView: CodeActivityView;
  fileName: string;
  profile: CodeEditorProfile;
}) {
  const titleByView: Record<CodeActivityView, string> = {
    explorer: "Explorer",
    search: "Search",
    "source-control": "Source Control",
    diagnostics: "Diagnostics",
    settings: "Settings",
  };

  return (
    <aside className="min-w-0 border-r border-[var(--vscode-border)] bg-[var(--vscode-side-bg)] text-[12px] text-[var(--vscode-foreground)]">
      <div className="border-b border-[var(--vscode-border)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--vscode-muted)]">
        {titleByView[activeView]}
      </div>
      {activeView === "explorer" ? (
        <CodeExplorerPanel fileName={fileName} profile={profile} />
      ) : null}
      {activeView === "search" ? <CodeSearchPanel fileName={fileName} /> : null}
      {activeView === "source-control" ? (
        <CodeSourceControlPanel fileName={fileName} />
      ) : null}
      {activeView === "diagnostics" ? (
        <CodeDiagnosticsPanel profile={profile} />
      ) : null}
      {activeView === "settings" ? (
        <CodeSettingsPanel profile={profile} />
      ) : null}
    </aside>
  );
}

function CodeExplorerPanel({
  fileName,
  profile,
}: {
  fileName: string;
  profile: CodeEditorProfile;
}) {
  return (
    <div className="px-2 py-2">
      <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase text-[var(--vscode-foreground)]">
        <span className="text-[10px]">▾</span>
        <span className="truncate">CDE Workspace</span>
      </div>
      <div className="rounded bg-[var(--vscode-selection-bg)] px-2 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[var(--vscode-accent)]" />
          <span className="min-w-0 truncate">{fileName}</span>
        </div>
      </div>
      <div className="mt-2 space-y-0.5 pl-4 text-[var(--vscode-muted)]">
        <div className="flex min-w-0 items-center gap-2 px-2 py-1">
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">.architoken</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 px-2 py-1">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{profile.label}</span>
        </div>
      </div>
    </div>
  );
}

function CodeSearchPanel({ fileName }: { fileName: string }) {
  return (
    <div className="space-y-2 px-3 py-3">
      <label className="block text-[11px] uppercase text-[var(--vscode-muted)]">
        Search
      </label>
      <div className="flex items-center gap-2 rounded border border-[#3c3c3c] bg-[var(--vscode-input-bg)] px-2 py-1.5 text-[var(--vscode-muted)]">
        <Search className="h-3.5 w-3.5" />
        <span className="truncate">当前文件</span>
      </div>
      <div className="rounded bg-[var(--vscode-hover-bg)] px-2 py-2 text-[var(--vscode-muted)]">
        <div className="truncate text-[var(--vscode-foreground)]">
          {fileName}
        </div>
        <div className="mt-1 text-[11px] text-[var(--vscode-muted)]">
          使用 Ctrl+F 搜索
        </div>
      </div>
    </div>
  );
}

function CodeSourceControlPanel({ fileName }: { fileName: string }) {
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="flex items-center gap-2 rounded bg-[var(--vscode-hover-bg)] px-2 py-2">
        <GitBranch className="h-3.5 w-3.5 text-[var(--vscode-muted)]" />
        <span className="min-w-0 truncate">CDE version</span>
      </div>
      <div className="rounded border border-[#3c3c3c] px-2 py-2 text-[var(--vscode-muted)]">
        <div className="truncate text-[var(--vscode-foreground)]">
          {fileName}
        </div>
        <div className="mt-1 text-[11px] text-[var(--vscode-muted)]">
          保存后写入新版本
        </div>
      </div>
    </div>
  );
}

function CodeDiagnosticsPanel({ profile }: { profile: CodeEditorProfile }) {
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="rounded bg-[var(--vscode-hover-bg)] px-2 py-2">
        <div className="text-[var(--vscode-foreground)]">{profile.label}</div>
        <div className="mt-1 text-[11px] text-[var(--vscode-muted)]">
          Monaco inline diagnostics
        </div>
      </div>
      <div className="rounded border border-[#3c3c3c] px-2 py-2 text-[var(--vscode-muted)]">
        Tree-sitter / LSP worker
        <div className="mt-1 text-[11px] text-[var(--vscode-muted)]">
          待服务端证据接入
        </div>
      </div>
    </div>
  );
}

function CodeSettingsPanel({ profile }: { profile: CodeEditorProfile }) {
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="rounded bg-[var(--vscode-hover-bg)] px-2 py-2">
        <div className="text-[var(--vscode-foreground)]">Language</div>
        <div className="mt-1 text-[11px] text-[var(--vscode-muted)]">
          {profile.languageId}
        </div>
      </div>
      <div className="rounded border border-[#3c3c3c] px-2 py-2 text-[var(--vscode-muted)]">
        Tab size 2 · Spaces
      </div>
    </div>
  );
}

function runMonacoEditorCommand(
  editor: MonacoEditorNamespace.IStandaloneCodeEditor | null,
  commandId: string,
) {
  if (!editor) return;
  editor.focus();
  editor.trigger("architoken-code-toolbar", commandId, null);
}

function runMonacoEditorAction(
  editor: MonacoEditorNamespace.IStandaloneCodeEditor | null,
  actionId: string,
) {
  if (!editor) return;
  editor.focus();
  const action = editor.getAction(actionId);
  if (action) {
    void action.run();
    return;
  }
  runMonacoEditorCommand(editor, actionId);
}

function selectMonacoQueryMatch(
  editor: MonacoEditorNamespace.IStandaloneCodeEditor,
  query: string,
) {
  const model = editor.getModel();
  if (!model) return;
  const match = model.findMatches(
    query,
    false,
    false,
    false,
    null,
    false,
    1,
  )[0];
  if (!match) {
    runMonacoEditorAction(editor, "actions.find");
    return;
  }
  editor.setSelection(match.range);
  editor.revealRangeInCenter(match.range);
  editor.focus();
}

function selectedMonacoText(
  editor: MonacoEditorNamespace.IStandaloneCodeEditor | null,
): string {
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (!model || !selection || selection.isEmpty()) return "";
  return model.getValueInRange(selection);
}

function runNativeTextareaCommand(
  textarea: HTMLTextAreaElement | null,
  command: "undo" | "redo",
) {
  if (!textarea) return;
  textarea.focus();
  document.execCommand(command);
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "-1000px auto auto -1000px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function downloadCodeFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function defineVSCodeDefaultDarkMonacoTheme(monaco: MonacoModule) {
  monaco.editor.defineTheme(VSCODE_DEFAULT_DARK_MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "activityBar.background": "#181818",
      "breadcrumb.background": "#1f1f1f",
      "dropdown.background": "#313131",
      "editor.background": "#1f1f1f",
      "editor.foreground": "#cccccc",
      "editor.findMatchBackground": "#515c6a",
      "editor.findMatchHighlightBackground": "#ea5c0055",
      "editor.inactiveSelectionBackground": "#3a3d41",
      "editor.lineHighlightBackground": "#2a2d2e",
      "editor.selectionBackground": "#264f78",
      "editorCursor.foreground": "#aeafad",
      "editorGroupHeader.tabsBackground": "#181818",
      "editorIndentGuide.activeBackground1": "#707070",
      "editorIndentGuide.background1": "#404040",
      "editorLineNumber.activeForeground": "#cccccc",
      "editorLineNumber.foreground": "#858585",
      "editorWidget.background": "#252526",
      focusBorder: "#0078d4",
      "input.background": "#313131",
      "list.activeSelectionBackground": "#04395e",
      "list.focusBackground": "#04395e",
      "list.hoverBackground": "#2a2d2e",
      "list.inactiveSelectionBackground": "#37373d",
      "menu.background": "#1f1f1f",
      "menu.foreground": "#cccccc",
      "menu.selectionBackground": "#2a2d2e",
      "scrollbarSlider.activeBackground": "#bfbfbf66",
      "scrollbarSlider.background": "#79797966",
      "scrollbarSlider.hoverBackground": "#646464b3",
      "sideBar.background": "#181818",
      "sideBar.foreground": "#cccccc",
      "sideBarSectionHeader.background": "#181818",
      "sideBarTitle.foreground": "#cccccc",
      "titleBar.activeBackground": "#181818",
      "titleBar.activeForeground": "#cccccc",
    },
  });
}

async function loadMonaco(): Promise<MonacoModule> {
  if (!monacoLoader) {
    configureMonacoWorkers();
    monacoLoader = import("monaco-editor");
  }
  return monacoLoader;
}

function configureMonacoWorkers() {
  if (typeof window === "undefined") return;
  const monacoWindow = window as MonacoEnvironmentWindow;
  if (monacoWindow.MonacoEnvironment?.getWorker) return;
  monacoWindow.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === "json") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/css/css.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/html/html.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }
      if (label === "typescript" || label === "javascript") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/typescript/ts.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/editor/editor.worker.js",
          import.meta.url,
        ),
        { type: "module" },
      );
    },
  };
}
