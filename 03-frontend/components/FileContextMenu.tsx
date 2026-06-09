// components/FileContextMenu.tsx - File/folder context menu
// License: Apache-2.0
"use client";

import {
  Archive,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  History,
  Home,
  Info,
  Move,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ModuleFileNode } from "@/lib/module-file-system";

export type FileContextAction =
  | "open"
  | "navigate_parent"
  | "navigate_root"
  | "new"
  | "new_folder"
  | "new_file_md"
  | "new_file_json"
  | "new_file_yaml"
  | "new_file_csv"
  | "new_file_txt"
  | "view"
  | "upload"
  | "validate"
  | "submit_approval"
  | "archive"
  | "duplicate"
  | "history"
  | "download"
  | "move"
  | "copy"
  | "paste"
  | "refresh"
  | "share"
  | "delete"
  | "properties"
  | "rename";

const contextMenuSeparator = "separator";
const contextMenuReturn = "return_submenu";
type ContextMenuEntry =
  | FileContextAction
  | typeof contextMenuSeparator
  | typeof contextMenuReturn;
type ContextSubmenu = "return" | "new" | "file" | null;

const actionMeta: Record<
  FileContextAction,
  { label: string; icon: ReactNode; danger?: boolean; shortcut?: string }
> = {
  open: {
    label: "打开",
    icon: <FolderOpen className="h-4 w-4" />,
    shortcut: "Enter",
  },
  navigate_parent: {
    label: "返回上一级",
    icon: <ArrowLeft className="h-4 w-4" />,
  },
  navigate_root: {
    label: "返回主目录",
    icon: <Home className="h-4 w-4" />,
  },
  new: {
    label: "新建",
    icon: <FilePlus2 className="h-4 w-4" />,
    shortcut: "Ctrl+N",
  },
  new_folder: {
    label: "目录",
    icon: <FolderPlus className="h-4 w-4" />,
  },
  new_file_md: {
    label: "Markdown 文件",
    icon: <FileText className="h-4 w-4" />,
  },
  new_file_json: {
    label: "JSON 文件",
    icon: <FileText className="h-4 w-4" />,
  },
  new_file_yaml: {
    label: "YAML 文件",
    icon: <FileText className="h-4 w-4" />,
  },
  new_file_csv: {
    label: "CSV 文件",
    icon: <FileText className="h-4 w-4" />,
  },
  new_file_txt: {
    label: "TXT 文件",
    icon: <FileText className="h-4 w-4" />,
  },
  view: { label: "查看", icon: <Eye className="h-4 w-4" /> },
  upload: {
    label: "上传",
    icon: <Upload className="h-4 w-4" />,
    shortcut: "Ctrl+U",
  },
  validate: {
    label: "Schema 校验",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  submit_approval: {
    label: "提交审批",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  archive: { label: "归档", icon: <Archive className="h-4 w-4" /> },
  duplicate: { label: "复制副本", icon: <Copy className="h-4 w-4" /> },
  history: { label: "版本 / 审计", icon: <History className="h-4 w-4" /> },
  download: { label: "下载", icon: <Download className="h-4 w-4" /> },
  move: { label: "移动", icon: <Move className="h-4 w-4" /> },
  copy: {
    label: "复制",
    icon: <Copy className="h-4 w-4" />,
    shortcut: "Ctrl+C",
  },
  paste: {
    label: "粘贴",
    icon: <ClipboardPaste className="h-4 w-4" />,
    shortcut: "Ctrl+V",
  },
  refresh: {
    label: "刷新",
    icon: <RefreshCw className="h-4 w-4" />,
    shortcut: "F5",
  },
  share: { label: "分享", icon: <Share2 className="h-4 w-4" /> },
  delete: {
    label: "删除",
    icon: <Trash2 className="h-4 w-4" />,
    danger: true,
    shortcut: "Del",
  },
  properties: { label: "属性", icon: <Info className="h-4 w-4" /> },
  rename: {
    label: "重命名",
    icon: <Pencil className="h-4 w-4" />,
    shortcut: "F2",
  },
};

const backgroundActions: ContextMenuEntry[] = [
  contextMenuReturn,
  "new",
  "upload",
  "paste",
  "refresh",
  contextMenuSeparator,
  "properties",
];

const folderActions: ContextMenuEntry[] = [
  "open",
  contextMenuSeparator,
  contextMenuReturn,
  "new",
  "upload",
  "paste",
  contextMenuSeparator,
  "copy",
  "duplicate",
  "download",
  "move",
  "rename",
  "share",
  contextMenuSeparator,
  "history",
  "properties",
  contextMenuSeparator,
  "delete",
];

const fileActions: ContextMenuEntry[] = [
  "open",
  "view",
  contextMenuSeparator,
  "download",
  "copy",
  "duplicate",
  "rename",
  "move",
  "share",
  contextMenuSeparator,
  "validate",
  "submit_approval",
  "archive",
  contextMenuSeparator,
  "history",
  "properties",
  contextMenuSeparator,
  "delete",
];

const fileCreateActions: FileContextAction[] = [
  "new_file_md",
  "new_file_json",
  "new_file_yaml",
  "new_file_csv",
  "new_file_txt",
];

function clampSubmenuPosition(
  anchor: DOMRect,
  estimatedWidth: number,
  estimatedHeight: number,
) {
  const margin = 8;
  const rightX = anchor.right - 2;
  const leftX = anchor.left - estimatedWidth + 2;
  const x =
    rightX + estimatedWidth > window.innerWidth - margin
      ? Math.max(margin, leftX)
      : Math.max(margin, rightX);
  const y = Math.min(
    Math.max(margin, anchor.top),
    Math.max(margin, window.innerHeight - estimatedHeight - margin),
  );
  return { x, y };
}

export function FileContextMenu({
  node,
  x,
  y,
  actions: actionList,
  onAction,
  onClose,
}: {
  node: ModuleFileNode | null;
  x: number;
  y: number;
  actions?: FileContextAction[];
  onAction: (action: FileContextAction, node: ModuleFileNode | null) => void;
  onClose: () => void;
}) {
  const actions: ContextMenuEntry[] =
    actionList ??
    (node
      ? node.type === "file"
        ? fileActions
        : folderActions
      : backgroundActions);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const returnSubmenuRef = useRef<HTMLDivElement | null>(null);
  const newSubmenuRef = useRef<HTMLDivElement | null>(null);
  const fileSubmenuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x, y });
  const [activeSubmenu, setActiveSubmenu] = useState<ContextSubmenu>(null);
  const [returnSubmenuPosition, setReturnSubmenuPosition] = useState({ x, y });
  const [newSubmenuPosition, setNewSubmenuPosition] = useState({ x, y });
  const [fileSubmenuPosition, setFileSubmenuPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const margin = 8;
    const rect = menuRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 224;
    const height = rect?.height ?? 420;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    const nextPosition = {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
    setPosition((current) =>
      current.x === nextPosition.x && current.y === nextPosition.y
        ? current
        : nextPosition,
    );
  }, [x, y, actions.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const isInsideContextTree = [
        menuRef.current,
        returnSubmenuRef.current,
        newSubmenuRef.current,
        fileSubmenuRef.current,
      ].some((element) => element?.contains(target));
      if (!isInsideContextTree) {
        onClose();
      }
    }
    function handleViewportChange() {
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  function openReturnSubmenu(anchor: HTMLElement) {
    setActiveSubmenu("return");
    setReturnSubmenuPosition(
      clampSubmenuPosition(anchor.getBoundingClientRect(), 228, 92),
    );
  }

  function openNewSubmenu(anchor: HTMLElement) {
    setActiveSubmenu((current) => (current === "file" ? "file" : "new"));
    setNewSubmenuPosition(
      clampSubmenuPosition(anchor.getBoundingClientRect(), 228, 116),
    );
  }

  function openFileSubmenu(anchor: HTMLElement) {
    setActiveSubmenu("file");
    setFileSubmenuPosition(
      clampSubmenuPosition(anchor.getBoundingClientRect(), 224, 188),
    );
  }

  function closeSubmenus() {
    setActiveSubmenu(null);
  }

  function runAction(action: FileContextAction) {
    onAction(action, node);
  }

  return (
    <>
      <div
        ref={menuRef}
        className="open-cde-context-menu arch-surface fixed z-[100] max-h-[min(72vh,600px)] min-w-56 overflow-y-auto rounded-md border py-1 arch-type-body shadow-xl"
        style={{ left: position.x, top: position.y }}
        role="menu"
        aria-label={node ? `${node.name}操作菜单` : "文件空白区域操作菜单"}
      >
        <div className="py-1">
          {actions.map((action, index) => {
            if (action === contextMenuSeparator) {
              return (
                <div
                  key={`${action}-${index}`}
                  className="open-cde-context-separator"
                  role="separator"
                />
              );
            }
            if (action === contextMenuReturn) {
              return (
                <button
                  key={action}
                  type="button"
                  onClick={(event) => openReturnSubmenu(event.currentTarget)}
                  onMouseEnter={(event) =>
                    openReturnSubmenu(event.currentTarget)
                  }
                  onFocus={(event) => openReturnSubmenu(event.currentTarget)}
                  onContextMenu={(event) => event.preventDefault()}
                  className="open-cde-context-item has-submenu flex w-full items-center gap-3 px-3 py-2 text-left transition"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={activeSubmenu === "return"}
                >
                  <span className="open-cde-context-icon arch-primary-text">
                    <ArrowLeft className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    返回
                  </span>
                  <ChevronRight className="open-cde-context-caret h-4 w-4" />
                </button>
              );
            }
            const meta = actionMeta[action];
            if (action === "new") {
              return (
                <button
                  key={action}
                  type="button"
                  onClick={(event) => openNewSubmenu(event.currentTarget)}
                  onMouseEnter={(event) => openNewSubmenu(event.currentTarget)}
                  onFocus={(event) => openNewSubmenu(event.currentTarget)}
                  onContextMenu={(event) => event.preventDefault()}
                  className="open-cde-context-item has-submenu flex w-full items-center gap-3 px-3 py-2 text-left transition"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={
                    activeSubmenu === "new" || activeSubmenu === "file"
                  }
                >
                  <span className="open-cde-context-icon arch-primary-text">
                    {meta.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {meta.label}
                  </span>
                  {meta.shortcut ? <kbd>{meta.shortcut}</kbd> : null}
                  <ChevronRight className="open-cde-context-caret h-4 w-4" />
                </button>
              );
            }
            return (
              <button
                key={action}
                type="button"
                onClick={() => runAction(action)}
                onMouseEnter={closeSubmenus}
                onFocus={closeSubmenus}
                onContextMenu={(event) => event.preventDefault()}
                className={`open-cde-context-item flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[var(--arch-primary-soft)] ${
                  meta.danger ? "text-red-600 hover:bg-red-50" : "arch-text"
                }`}
                role="menuitem"
              >
                <span
                  className={`open-cde-context-icon ${meta.danger ? "text-red-500" : "arch-primary-text"}`}
                >
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {meta.label}
                </span>
                {meta.shortcut ? <kbd>{meta.shortcut}</kbd> : null}
              </button>
            );
          })}
        </div>
      </div>
      {activeSubmenu === "return" ? (
        <div
          ref={returnSubmenuRef}
          className="open-cde-context-submenu arch-surface fixed z-[101] min-w-56 rounded-md border py-1 arch-type-body shadow-xl"
          style={{
            left: returnSubmenuPosition.x,
            top: returnSubmenuPosition.y,
          }}
          role="menu"
          aria-label="返回"
        >
          {(["navigate_parent", "navigate_root"] as const).map((action) => {
            const meta = actionMeta[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => runAction(action)}
                className="open-cde-context-item flex w-full items-center gap-3 px-3 py-2 text-left transition"
                role="menuitem"
              >
                <span className="open-cde-context-icon arch-primary-text">
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {activeSubmenu === "new" || activeSubmenu === "file" ? (
        <div
          ref={newSubmenuRef}
          className="open-cde-context-submenu arch-surface fixed z-[101] min-w-56 rounded-md border py-1 arch-type-body shadow-xl"
          style={{ left: newSubmenuPosition.x, top: newSubmenuPosition.y }}
          role="menu"
          aria-label="新建"
        >
          <button
            type="button"
            onClick={() => runAction("new_folder")}
            onMouseEnter={() => setActiveSubmenu("new")}
            className="open-cde-context-item flex w-full items-center gap-3 px-3 py-2 text-left transition"
            role="menuitem"
          >
            <span className="open-cde-context-icon arch-primary-text">
              {actionMeta.new_folder.icon}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">目录</span>
          </button>
          <button
            type="button"
            onClick={(event) => openFileSubmenu(event.currentTarget)}
            onMouseEnter={(event) => openFileSubmenu(event.currentTarget)}
            onFocus={(event) => openFileSubmenu(event.currentTarget)}
            className="open-cde-context-item has-submenu flex w-full items-center gap-3 px-3 py-2 text-left transition"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={activeSubmenu === "file"}
          >
            <span className="open-cde-context-icon arch-primary-text">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">文件</span>
            <ChevronRight className="open-cde-context-caret h-4 w-4" />
          </button>
        </div>
      ) : null}
      {activeSubmenu === "file" ? (
        <div
          ref={fileSubmenuRef}
          className="open-cde-context-submenu arch-surface fixed z-[102] min-w-56 rounded-md border py-1 arch-type-body shadow-xl"
          style={{ left: fileSubmenuPosition.x, top: fileSubmenuPosition.y }}
          role="menu"
          aria-label="新建文件类型"
        >
          {fileCreateActions.map((action) => {
            const meta = actionMeta[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => runAction(action)}
                className="open-cde-context-item flex w-full items-center gap-3 px-3 py-2 text-left transition"
                role="menuitem"
              >
                <span className="open-cde-context-icon arch-primary-text">
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
