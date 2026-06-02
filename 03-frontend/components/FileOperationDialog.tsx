// components/FileOperationDialog.tsx - File operation modal/dialog
// License: Apache-2.0
"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
