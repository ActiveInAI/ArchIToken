// components/FileOperationDialog.tsx - File operation modal/dialog
// License: Apache-2.0
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ChevronRight,
  FileText,
  FolderInput,
  FolderPlus,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { FloatingWindowFrame } from "@/components/FloatingWindowFrame";
import type { ModuleFileNode, ModuleShareLink } from "@/lib/module-file-system";

export type FileDialogMode =
  | "new"
  | "upload"
  | "move"
  | "share"
  | "delete"
  | "rename";

export interface FileDialogPayload {
  name?: string;
  nodeType?: "folder" | "file";
  targetParentId?: string;
  fileFormat?: string;
  file?: File;
}

const dialogTitles: Record<FileDialogMode, string> = {
  new: "新建",
  upload: "上传",
  move: "移动",
  share: "分享",
  delete: "删除",
  rename: "重命名",
};

const newFileFormats = [
  {
    key: "md",
    label: "Markdown",
    extension: ".md",
    description: "说明、交底、会议纪要",
  },
  {
    key: "json",
    label: "JSON",
    extension: ".json",
    description: "结构化数据、接口草案",
  },
  {
    key: "yaml",
    label: "YAML",
    extension: ".yaml",
    description: "配置、规则、清单",
  },
  {
    key: "csv",
    label: "CSV",
    extension: ".csv",
    description: "表格、清单、台账",
  },
  {
    key: "txt",
    label: "TXT",
    extension: ".txt",
    description: "纯文本记录",
  },
  {
    key: "custom",
    label: "自定义",
    extension: "",
    description: "手动填写文件名和扩展名",
  },
] as const;

export function FileOperationDialog({
  mode,
  target,
  folders,
  shareLink,
  anchor,
  onCancel,
  onConfirm,
}: {
  mode: FileDialogMode | null;
  target: ModuleFileNode | null;
  folders: ModuleFileNode[];
  shareLink: ModuleShareLink | null;
  anchor?: { x: number; y: number } | null;
  onCancel: () => void;
  onConfirm: (payload: FileDialogPayload) => void;
}) {
  const defaultTargetParentId =
    target?.type === "folder"
      ? target.id
      : (target?.parentId ?? folders[0]?.id ?? "");

  if (!mode) {
    return null;
  }

  const resetKey = [
    mode,
    target?.id ?? "no-target",
    target?.name ?? "",
    defaultTargetParentId,
    folders.map((folder) => `${folder.id}:${folder.parentId ?? ""}`).join("|"),
  ].join(":");

  if (mode === "new") {
    return (
      <FileCreateMenu
        key={resetKey}
        folders={folders}
        anchor={anchor ?? null}
        defaultTargetParentId={defaultTargetParentId}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <FileOperationDialogContent
      key={resetKey}
      mode={mode}
      target={target}
      folders={folders}
      shareLink={shareLink}
      anchor={anchor ?? null}
      defaultTargetParentId={defaultTargetParentId}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function FileOperationDialogContent({
  mode,
  target,
  folders,
  shareLink,
  anchor,
  defaultTargetParentId,
  onCancel,
  onConfirm,
}: {
  mode: FileDialogMode;
  target: ModuleFileNode | null;
  folders: ModuleFileNode[];
  shareLink: ModuleShareLink | null;
  anchor: { x: number; y: number } | null;
  defaultTargetParentId: string;
  onCancel: () => void;
  onConfirm: (payload: FileDialogPayload) => void;
}) {
  const [name, setName] = useState(
    mode === "rename" ? (target?.name ?? "") : "",
  );
  const [nodeType, setNodeType] = useState<"folder" | "file">("folder");
  const [targetParentId, setTargetParentId] = useState(defaultTargetParentId);
  const [fileFormat, setFileFormat] =
    useState<(typeof newFileFormats)[number]["key"]>("md");
  const [file, setFile] = useState<File | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(folderAncestorIds(defaultTargetParentId, folders)),
  );

  const selectedTargetFolder =
    folders.find((folder) => folder.id === targetParentId) ??
    folders[0] ??
    null;
  const selectedFolderPath = selectedTargetFolder
    ? folderPath(selectedTargetFolder, folders)
    : "未选择目录";
  const selectedFormat = useMemo(
    () =>
      newFileFormats.find((item) => item.key === fileFormat) ??
      newFileFormats[0],
    [fileFormat],
  );

  const confirmDisabled =
    (mode === "new" && !targetParentId) ||
    (mode === "upload" && !file) ||
    (mode === "rename" && !name.trim());

  const icon =
    mode === "new" ? (
      <Plus className="h-4 w-4" />
    ) : mode === "upload" ? (
      <Upload className="h-4 w-4" />
    ) : mode === "move" ? (
      <FolderInput className="h-4 w-4" />
    ) : mode === "rename" ? (
      <Pencil className="h-4 w-4" />
    ) : mode === "delete" ? (
      <Trash2 className="h-4 w-4" />
    ) : (
      <Link2 className="h-4 w-4" />
    );

  const footer = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="arch-btn rounded-md px-4 py-2 arch-type-body font-medium"
      >
        取消
      </button>
      <button
        type="button"
        onClick={() => {
          const payload: FileDialogPayload = {
            name,
            nodeType,
            targetParentId,
            fileFormat,
          };
          if (file) {
            payload.file = file;
          }
          onConfirm(payload);
        }}
        disabled={confirmDisabled}
        className="arch-btn-primary rounded-md px-4 py-2 arch-type-body font-medium disabled:cursor-not-allowed disabled:opacity-45"
      >
        确认
      </button>
    </div>
  );

  return (
    <FloatingWindowFrame
      title={dialogTitles[mode]}
      eyebrow="文件操作"
      subtitle={
        mode === "new" ? selectedFolderPath : (target?.name ?? "当前目录")
      }
      icon={icon}
      onClose={onCancel}
      defaultSize={
        mode === "new"
          ? { width: 640, height: 500 }
          : { width: 560, height: mode === "delete" ? 420 : 540 }
      }
      minSize={
        mode === "new"
          ? { width: 560, height: 420 }
          : { width: 360, height: 360 }
      }
      placement={mode === "new" && anchor ? "anchor" : "center"}
      anchorPosition={mode === "new" ? (anchor ?? null) : null}
      zIndex={75}
      modal={mode !== "new"}
      defaultViewportRatio={null}
      bodyClassName={mode === "new" ? "p-0" : "space-y-4 p-5"}
      footer={footer}
    >
      {mode === "new" ? (
        <div className="open-cde-create-panel">
          <section className="open-cde-create-column">
            <strong>创建对象</strong>
            <button
              type="button"
              className={nodeType === "folder" ? "is-active" : ""}
              onClick={() => setNodeType("folder")}
            >
              <FolderPlus className="h-4 w-4" />
              <span>
                <b>目录</b>
                <small>用于继续组织文件、模型、审批证据。</small>
              </span>
            </button>
            <button
              type="button"
              className={nodeType === "file" ? "is-active" : ""}
              onClick={() => setNodeType("file")}
            >
              <FileText className="h-4 w-4" />
              <span>
                <b>文件</b>
                <small>创建带格式的空白文件记录。</small>
              </span>
            </button>
          </section>
          <section className="open-cde-create-column is-directory">
            <strong>创建位置</strong>
            <div
              className="open-cde-folder-tree"
              role="tree"
              aria-label="选择创建位置"
            >
              {rootFolders(folders).map((folder) => (
                <FolderTreeOption
                  key={folder.id}
                  folder={folder}
                  folders={folders}
                  selectedId={targetParentId}
                  expandedIds={expandedFolderIds}
                  depth={0}
                  onToggle={(folderId) =>
                    setExpandedFolderIds((current) => {
                      const next = new Set(current);
                      if (next.has(folderId)) next.delete(folderId);
                      else next.add(folderId);
                      return next;
                    })
                  }
                  onSelect={(folderId) => {
                    setTargetParentId(folderId);
                    setExpandedFolderIds((current) => {
                      const next = new Set(current);
                      for (const ancestorId of folderAncestorIds(
                        folderId,
                        folders,
                      )) {
                        next.add(ancestorId);
                      }
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </section>
          <section className="open-cde-create-column is-detail">
            <strong>{nodeType === "folder" ? "目录信息" : "文件信息"}</strong>
            <NameInput
              value={name}
              onChange={setName}
              placeholder={
                nodeType === "folder"
                  ? "请输入目录名称"
                  : `请输入文件名${selectedFormat.extension}`
              }
            />
            {nodeType === "file" ? (
              <div className="open-cde-create-format-grid">
                {newFileFormats.map((format) => (
                  <button
                    key={format.key}
                    type="button"
                    className={fileFormat === format.key ? "is-active" : ""}
                    onClick={() => setFileFormat(format.key)}
                  >
                    <b>{format.label}</b>
                    <span>{format.extension || "手动"}</span>
                    <small>{format.description}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="open-cde-create-hint">
                目录会创建在所选数字档案路径下，后续文件、模型、审批证据可继续归入该目录。
              </p>
            )}
            <div className="open-cde-create-preview">
              <span>将创建到</span>
              <strong title={selectedFolderPath}>{selectedFolderPath}</strong>
              <small>
                {nodeType === "folder"
                  ? name.trim() || "新建目录"
                  : previewFileName(name, fileFormat)}
              </small>
            </div>
          </section>
        </div>
      ) : null}

      {mode === "upload" ? (
        <label className="block">
          <span className="arch-primary-text arch-type-caption font-medium">
            选择本地文件
          </span>
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
          />
          <span className="arch-muted mt-2 block arch-type-caption">
            {file
              ? `${file.name} · ${Math.round(file.size / 1024)} KB`
              : "未选择文件"}
          </span>
        </label>
      ) : null}

      {mode === "rename" ? (
        <NameInput value={name} onChange={setName} placeholder="新名称" />
      ) : null}

      {mode === "move" ? (
        <label className="block">
          <span className="arch-primary-text arch-type-caption font-medium">
            目标文件夹
          </span>
          <select
            value={targetParentId}
            onChange={(event) => setTargetParentId(event.target.value)}
            className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === "share" ? (
        <div className="arch-huly-row-muted rounded-lg p-4">
          <p className="arch-muted arch-type-body leading-6">
            确认后生成分享链接,并写入文件属性和审计事件。
          </p>
          {shareLink ? (
            <p className="arch-chip mt-3 break-all rounded-md px-3 py-2 arch-type-caption">
              {shareLink.url}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "delete" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="arch-type-body leading-6 text-red-700">
            确认后从当前目录移除。已上传的本地文件会同步删除运行索引；系统种子文件会进入回收站状态。
          </p>
        </div>
      ) : null}
    </FloatingWindowFrame>
  );
}

type CreateSubmenu = "file" | "location" | null;

function FileCreateMenu({
  folders,
  anchor,
  defaultTargetParentId,
  onCancel,
  onConfirm,
}: {
  folders: ModuleFileNode[];
  anchor: { x: number; y: number } | null;
  defaultTargetParentId: string;
  onCancel: () => void;
  onConfirm: (payload: FileDialogPayload) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileSubmenuRef = useRef<HTMLDivElement | null>(null);
  const locationSubmenuRef = useRef<HTMLDivElement | null>(null);
  const [targetParentId, setTargetParentId] = useState(defaultTargetParentId);
  const [activeSubmenu, setActiveSubmenu] = useState<CreateSubmenu>(null);
  const menuPosition = initialCreateMenuPosition(anchor);
  const [fileSubmenuPosition, setFileSubmenuPosition] = useState({
    x: menuPosition.x + 256,
    y: menuPosition.y + 36,
  });
  const [locationSubmenuPosition, setLocationSubmenuPosition] = useState({
    x: menuPosition.x + 256,
    y: menuPosition.y + 72,
  });
  const selectedTargetFolder =
    folders.find((folder) => folder.id === targetParentId) ??
    folders[0] ??
    null;
  const folderOptions = flattenFolderOptions(folders);
  const selectedFolderPath = selectedTargetFolder
    ? folderPath(selectedTargetFolder, folders)
    : "当前目录";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }
      if (
        menuRef.current?.contains(targetNode) ||
        fileSubmenuRef.current?.contains(targetNode) ||
        locationSubmenuRef.current?.contains(targetNode)
      ) {
        return;
      }
      onCancel();
    }

    function handleViewportChange() {
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [onCancel]);

  function openFileSubmenu(anchorElement: HTMLElement) {
    setActiveSubmenu("file");
    setFileSubmenuPosition(
      clampSubmenuPosition(anchorElement.getBoundingClientRect(), 240, 232),
    );
  }

  function openLocationSubmenu(anchorElement: HTMLElement) {
    setActiveSubmenu("location");
    setLocationSubmenuPosition(
      clampSubmenuPosition(anchorElement.getBoundingClientRect(), 300, 420),
    );
  }

  function createFolder() {
    onConfirm({
      nodeType: "folder",
      targetParentId,
    });
  }

  function createFile(fileFormat: (typeof newFileFormats)[number]["key"]) {
    onConfirm({
      nodeType: "file",
      targetParentId,
      fileFormat,
    });
  }

  return (
    <>
      <div
        ref={menuRef}
        className="open-cde-context-menu arch-surface fixed z-[100] w-64 rounded-md border py-1 arch-type-body shadow-xl"
        style={{ left: menuPosition.x, top: menuPosition.y }}
        role="menu"
        aria-label="新建"
      >
        <div className="px-3 py-2">
          <p className="arch-primary-text truncate arch-type-caption font-semibold">
            新建
          </p>
          <p
            className="arch-muted mt-0.5 truncate arch-type-caption"
            title={selectedFolderPath}
          >
            位置: {selectedFolderPath}
          </p>
        </div>
        <div className="open-cde-context-separator" role="separator" />
        <button
          type="button"
          onClick={createFolder}
          onMouseEnter={() => setActiveSubmenu(null)}
          onFocus={() => setActiveSubmenu(null)}
          className="open-cde-context-item flex w-full items-center gap-3 px-3 py-2 text-left transition"
          role="menuitem"
        >
          <span className="open-cde-context-icon arch-primary-text">
            <FolderPlus className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">新建目录</span>
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
          <span className="min-w-0 flex-1 truncate font-medium">新建文件</span>
          <ChevronRight className="open-cde-context-caret h-4 w-4" />
        </button>
        <div className="open-cde-context-separator" role="separator" />
        <button
          type="button"
          onClick={(event) => openLocationSubmenu(event.currentTarget)}
          onMouseEnter={(event) => openLocationSubmenu(event.currentTarget)}
          onFocus={(event) => openLocationSubmenu(event.currentTarget)}
          className="open-cde-context-item has-submenu flex w-full items-center gap-3 px-3 py-2 text-left transition"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={activeSubmenu === "location"}
        >
          <span className="open-cde-context-icon arch-primary-text">
            <FolderInput className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">创建位置</span>
          <ChevronRight className="open-cde-context-caret h-4 w-4" />
        </button>
      </div>

      {activeSubmenu === "file" ? (
        <div
          ref={fileSubmenuRef}
          className="open-cde-context-submenu arch-surface fixed z-[101] w-60 rounded-md border py-1 arch-type-body shadow-xl"
          style={{ left: fileSubmenuPosition.x, top: fileSubmenuPosition.y }}
          role="menu"
          aria-label="新建文件类型"
        >
          {newFileFormats
            .filter((format) => format.key !== "custom")
            .map((format) => (
              <button
                key={format.key}
                type="button"
                onClick={() => createFile(format.key)}
                className="open-cde-context-item flex w-full items-center gap-3 px-3 py-2 text-left transition"
                role="menuitem"
              >
                <span className="open-cde-context-icon arch-primary-text">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {format.label}
                  </span>
                  <span className="arch-muted block truncate arch-type-caption">
                    {format.extension || "手动扩展名"} · {format.description}
                  </span>
                </span>
              </button>
            ))}
        </div>
      ) : null}

      {activeSubmenu === "location" ? (
        <div
          ref={locationSubmenuRef}
          className="open-cde-context-submenu arch-surface fixed z-[101] max-h-[min(70vh,460px)] w-[300px] overflow-y-auto overscroll-contain rounded-md border py-1 arch-type-body shadow-xl"
          style={{
            left: locationSubmenuPosition.x,
            top: locationSubmenuPosition.y,
          }}
          onWheel={(event) => event.stopPropagation()}
          role="menu"
          aria-label="选择创建位置"
        >
          {folderOptions.map(({ folder, depth }) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setTargetParentId(folder.id)}
              className={`open-cde-context-item flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                targetParentId === folder.id
                  ? "bg-[var(--module-accent-soft)]"
                  : ""
              }`}
              style={{ paddingLeft: 12 + depth * 14 }}
              role="menuitemradio"
              aria-checked={targetParentId === folder.id}
            >
              <span className="open-cde-context-icon arch-primary-text">
                <FolderInput className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {folder.name}
                </span>
                <span className="arch-muted block truncate arch-type-caption">
                  {folderPath(folder, folders)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function NameInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="arch-primary-text arch-type-caption font-medium">
        名称
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="arch-input mt-2 w-full rounded-md px-3 py-3 arch-type-body outline-none"
      />
    </label>
  );
}

function FolderTreeOption({
  folder,
  folders,
  selectedId,
  expandedIds,
  depth,
  onToggle,
  onSelect,
}: {
  folder: ModuleFileNode;
  folders: ModuleFileNode[];
  selectedId: string;
  expandedIds: Set<string>;
  depth: number;
  onToggle: (folderId: string) => void;
  onSelect: (folderId: string) => void;
}) {
  const children = childFolders(folder.id, folders);
  const expanded = expandedIds.has(folder.id);
  return (
    <>
      <div
        className={`open-cde-folder-tree-row ${selectedId === folder.id ? "is-active" : ""}`}
        role="treeitem"
        aria-selected={selectedId === folder.id}
        aria-expanded={children.length > 0 ? expanded : undefined}
        style={{ "--folder-depth": depth } as CSSProperties}
      >
        <button
          type="button"
          className="open-cde-folder-tree-toggle"
          aria-label={expanded ? "折叠目录" : "展开目录"}
          disabled={children.length === 0}
          onClick={() => onToggle(folder.id)}
        >
          <ChevronRight className={expanded ? "is-expanded" : ""} />
        </button>
        <button type="button" onClick={() => onSelect(folder.id)}>
          <span>
            <b>{folder.name}</b>
            <small>{folderPath(folder, folders)}</small>
          </span>
        </button>
      </div>
      {expanded
        ? children.map((child) => (
            <FolderTreeOption
              key={child.id}
              folder={child}
              folders={folders}
              selectedId={selectedId}
              expandedIds={expandedIds}
              depth={depth + 1}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

function folderPath(folder: ModuleFileNode, folders: ModuleFileNode[]): string {
  const path: string[] = [];
  let cursor: ModuleFileNode | undefined = folder;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    path.unshift(cursor.name);
    const parentId: string | null = cursor.parentId;
    cursor = parentId
      ? folders.find((item) => item.id === parentId)
      : undefined;
  }
  return path.join(" / ");
}

function rootFolders(folders: ModuleFileNode[]): ModuleFileNode[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  return folders
    .filter((folder) => !folder.parentId || !folderIds.has(folder.parentId))
    .sort(compareFolderNames);
}

function flattenFolderOptions(
  folders: ModuleFileNode[],
): Array<{ folder: ModuleFileNode; depth: number }> {
  const result: Array<{ folder: ModuleFileNode; depth: number }> = [];
  const visited = new Set<string>();

  function visit(folder: ModuleFileNode, depth: number) {
    if (visited.has(folder.id)) {
      return;
    }
    visited.add(folder.id);
    result.push({ folder, depth });
    for (const child of childFolders(folder.id, folders)) {
      visit(child, depth + 1);
    }
  }

  for (const folder of rootFolders(folders)) {
    visit(folder, 0);
  }

  return result;
}

function childFolders(
  parentId: string,
  folders: ModuleFileNode[],
): ModuleFileNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort(compareFolderNames);
}

function compareFolderNames(
  left: ModuleFileNode,
  right: ModuleFileNode,
): number {
  return left.name.localeCompare(right.name, "zh-CN");
}

function folderAncestorIds(
  folderId: string,
  folders: ModuleFileNode[],
): string[] {
  const result: string[] = [];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let cursor = byId.get(folderId);
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    result.push(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return result;
}

function previewFileName(name: string, fileFormat: string): string {
  const trimmed = name.trim();
  const format = newFileFormats.find((item) => item.key === fileFormat);
  if (!format || format.key === "custom") {
    return trimmed || "新建文件";
  }
  if (!trimmed) {
    return `新建文件${format.extension}`;
  }
  return trimmed.toLowerCase().endsWith(format.extension)
    ? trimmed
    : `${trimmed}${format.extension}`;
}

function initialCreateMenuPosition(anchor: { x: number; y: number } | null) {
  if (typeof window === "undefined") {
    return { x: 72, y: 72 };
  }
  if (!anchor) {
    return clampFloatingMenuPosition(72, 72, 256, 220);
  }
  return clampFloatingMenuPosition(anchor.x, anchor.y + 4, 256, 220);
}

function clampSubmenuPosition(anchor: DOMRect, width: number, height: number) {
  if (typeof window === "undefined") {
    return { x: anchor.right + 4, y: anchor.top };
  }
  const rightX = anchor.right + 4;
  const leftX = anchor.left - width - 4;
  const x =
    rightX + width <= window.innerWidth - 8 ? rightX : Math.max(8, leftX);
  return clampFloatingMenuPosition(x, anchor.top, width, height);
}

function clampFloatingMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (typeof window === "undefined") {
    return { x, y };
  }
  return {
    x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - height - 8)),
  };
}
