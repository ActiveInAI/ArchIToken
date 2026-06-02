// components/ModuleFileExplorer.tsx - Business file/folder explorer
// License: Apache-2.0
"use client";

import {
  ArrowLeft,
  Archive,
  Box,
  CheckCircle2,
  ClipboardCheck,
  ChevronRight,
  Database,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderTree,
  Grid2X2,
  GripVertical,
  HardDrive,
  History,
  Home,
  Info,
  Layers3,
  List,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Route,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  FileContextMenu,
  type FileContextAction,
} from "@/components/FileContextMenu";
import {
  FileOperationDialog,
  type FileDialogMode,
  type FileDialogPayload,
} from "@/components/FileOperationDialog";
import { FilePreviewDrawer } from "@/components/FilePreviewDrawer";
import { FloatingWindowFrame } from "@/components/FloatingWindowFrame";
import { LocalFileUploader } from "@/components/LocalFileUploader";
import {
  moduleBackendAdapter,
  type ModuleBackendSnapshot,
} from "@/lib/module-backend-adapter";
import { shouldAttemptBackendSync } from "@/lib/backend-api";
import {
  isBackendModuleFileId,
  moduleFileApiClient,
} from "@/lib/module-file-api-client";
import { moduleTransactionApiClient } from "@/lib/module-transaction-api-client";
import {
  architokenLocalFileChangedEventName,
  architokenFolderSelectionEventName,
  architokenOpenFileEventName,
  architokenPendingOpenFileKey,
  type ArchitokenLocalFileChangedRequest,
  type ArchitokenFolderSelectionRequest,
  type ArchitokenOpenFileRequest,
} from "@/lib/module-dialog-events";
import type { LocalFileMetadata } from "@/lib/local-file-runtime";
import type {
  ModuleAuditEvent,
  ModuleFileNode,
  ModuleFileValidationStatus,
  ModuleShareLink,
} from "@/lib/module-file-system";
import {
  formatModuleFileSize,
  getModuleMimeTypeForName,
  getModuleFileValidation,
  getModuleRootId,
} from "@/lib/module-file-system";
import type { ModuleTransactionEvent } from "@/lib/module-lifecycle";
import type { ModuleSpec } from "@/lib/module-registry";
import { getDigitalArchiveProjectFolderId } from "@/lib/project-management-data";

interface ContextMenuState {
  x: number;
  y: number;
  node: ModuleFileNode | null;
}

type FileViewMode = "list" | "grid";

const moduleAccentClasses = [
  "arch-module-accent-blue",
  "arch-module-accent-red",
  "arch-module-accent-yellow",
  "arch-module-accent-green",
  "arch-module-accent-purple",
  "arch-module-accent-cyan",
  "arch-module-accent-orange",
] as const;

const fileStatusLabels: Record<ModuleFileNode["status"], string> = {
  active: "后端可用",
  uploaded: "已上传",
  downloading: "已上传",
  shared: "已分享",
  copied: "后端可用",
  moved: "后端可用",
  schema_validating: "已上传",
  pending_approval: "已上传",
  soft_deleted: "回收站",
  archived: "已归档",
};

const validationStatusLabels: Record<ModuleFileValidationStatus, string> = {
  validator_not_configured: "未配置校验器",
  pending_validation: "等待校验",
  validating: "校验中",
  passed: "通过",
  failed: "失败",
  professional_review_required: "需专业工程师复核",
};

const blankFileExtensions: Record<string, string> = {
  md: ".md",
  json: ".json",
  yaml: ".yaml",
  csv: ".csv",
  txt: ".txt",
};

function isBackendBackedNode(node: ModuleFileNode | null): boolean {
  return Boolean(
    node && (node.source === "backend" || isBackendModuleFileId(node.id)),
  );
}

function resolveNewModuleNodeName(
  name: string | undefined,
  nodeType: "folder" | "file",
  fileFormat: string | undefined,
): string {
  const trimmed = name?.trim();
  if (nodeType === "folder") {
    return trimmed || "新建目录";
  }

  const extension = blankFileExtensions[fileFormat ?? "md"] ?? "";
  if (!trimmed) {
    return `新建文件${extension || ".md"}`;
  }
  if (!extension || trimmed.toLowerCase().endsWith(extension)) {
    return trimmed;
  }
  return `${trimmed}${extension}`;
}

function createBlankModuleFileContent(
  fileName: string,
  fileFormat: string | undefined,
): string {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  if (fileFormat === "json") return "{}\n";
  if (fileFormat === "yaml") return `# ${baseName}\n`;
  if (fileFormat === "csv") return "\n";
  if (fileFormat === "txt" || fileFormat === "custom") return "";
  return `# ${baseName}\n\n`;
}

const contextNewFileFormatByAction: Partial<Record<FileContextAction, string>> =
  {
    new_file_md: "md",
    new_file_json: "json",
    new_file_yaml: "yaml",
    new_file_csv: "csv",
    new_file_txt: "txt",
  };

function backendErrorSummary(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "后端 CDE 请求失败";
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

function isBusinessWorkbenchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("[data-business-workbench], [data-business-context-root]"),
  );
}

function isInlineRenameNameTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("[data-file-name-rename-trigger='true']"));
}

function shouldShowFileNodeInFolder(
  moduleId: ModuleSpec["id"],
  node: ModuleFileNode,
  currentFolderId: string,
  rootId: string,
  normalizedSearch: string,
): boolean {
  if (
    moduleId !== "digital_archive" ||
    normalizedSearch ||
    currentFolderId !== rootId
  ) {
    return true;
  }

  return node.type === "folder" && node.tags.includes("project-archive");
}

export function ModuleFileExplorer({
  spec,
  onAudit,
  businessHome,
  renderBusinessHome,
  businessHomeScope = "root",
  showBusinessHomeFileDock = false,
  hideBusinessHomeRibbon = true,
  hideBusinessHomeStatusbar = false,
  renderFilePreview,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  businessHome?: ReactNode;
  renderBusinessHome?: (context: {
    currentFolder: ModuleFileNode | null;
    currentFolderId: string;
    rootId: string;
  }) => ReactNode;
  businessHomeScope?: "root" | "all-folders";
  showBusinessHomeFileDock?: boolean;
  hideBusinessHomeRibbon?: boolean;
  hideBusinessHomeStatusbar?: boolean;
  renderFilePreview?: (file: ModuleFileNode) => ReactNode | null;
}) {
  const searchParams = useSearchParams();
  const rootId = getModuleRootId(spec.id);
  const explorerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const snapshotRef = useRef<ModuleBackendSnapshot | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const previewNodeRef = useRef<ModuleFileNode | null>(null);
  const [snapshot, setSnapshot] = useState<ModuleBackendSnapshot>(() =>
    moduleBackendAdapter.snapshot(spec.id),
  );
  const [currentFolderId, setCurrentFolderId] = useState(rootId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewNode, setPreviewNode] = useState<ModuleFileNode | null>(null);
  const [fullView, setFullView] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dialogMode, setDialogMode] = useState<FileDialogMode | null>(null);
  const [dialogTarget, setDialogTarget] = useState<ModuleFileNode | null>(null);
  const [dialogAnchor, setDialogAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [lastShareLink, setLastShareLink] = useState<ModuleShareLink | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const [actionMessage, setActionMessage] = useState(
    "文件、事务、审批和审计已接入运行适配器。",
  );
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false);
  const [addressMenuOpen, setAddressMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const currentFolder =
    snapshot.files.find((file) => file.id === currentFolderId) ?? null;
  const selectedNode =
    snapshot.files.find((file) => file.id === selectedNodeId) ?? previewNode;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleNodes = (
    normalizedSearch
      ? snapshot.files.filter((file) =>
          matchGlobalFileSearch(file, normalizedSearch),
        )
      : moduleBackendAdapter.listFiles(spec.id, currentFolderId)
  ).filter(
    (file) =>
      file.status !== "soft_deleted" &&
      !isInternalBusinessJson(spec.id, file) &&
      shouldShowFileNodeInFolder(
        spec.id,
        file,
        currentFolderId,
        rootId,
        normalizedSearch,
      ),
  );
  const folders = snapshot.files.filter(
    (file) => file.type === "folder" && file.status !== "soft_deleted",
  );
  const breadcrumbs = buildBreadcrumbs(snapshot.files, currentFolderId);
  const uploadedCount = snapshot.files.filter(
    (file) => file.source === "local_upload" && file.status !== "soft_deleted",
  ).length;
  const liveNodes = snapshot.files.filter(
    (file) => file.status !== "soft_deleted",
  );
  const fileCount = liveNodes.filter((file) => file.type === "file").length;
  const folderCount = liveNodes.filter((file) => file.type === "folder").length;
  const pendingValidationCount = liveNodes.filter(
    (file) => getModuleFileValidation(file).status === "pending_validation",
  ).length;
  const validatingCount = liveNodes.filter(
    (file) => getModuleFileValidation(file).status === "validating",
  ).length;
  const professionalReviewCount = liveNodes.filter(
    (file) =>
      getModuleFileValidation(file).status === "professional_review_required",
  ).length;
  const commandTarget = selectedNode ?? currentFolder;
  const isModuleRootSurface = !normalizedSearch && currentFolderId === rootId;
  const hasBusinessHome = Boolean(businessHome || renderBusinessHome);
  const businessHomeContent = renderBusinessHome
    ? renderBusinessHome({ currentFolder, currentFolderId, rootId })
    : businessHome;
  const isBusinessHomeRoot = Boolean(hasBusinessHome && isModuleRootSurface);
  const isBusinessHomeSurface = Boolean(
    hasBusinessHome &&
    !normalizedSearch &&
    (currentFolderId === rootId || businessHomeScope === "all-folders"),
  );
  const showExplorerRibbon = !(
    hideBusinessHomeRibbon &&
    (isBusinessHomeSurface || isModuleRootSurface)
  );
  const showExplorerStatusbar = !(
    hideBusinessHomeStatusbar && isBusinessHomeSurface
  );
  const businessHomePaddingClass =
    hasBusinessHome &&
    (spec.id === "quantity_costing" || spec.id === "finance_management")
      ? "p-0"
      : "p-3";
  const explorerAccentStyle = {
    "--arch-primary": "var(--module-accent)",
    "--arch-primary-soft": "var(--module-accent-soft)",
  } as CSSProperties;

  const refresh = useCallback(() => {
    setSnapshot(moduleBackendAdapter.snapshot(spec.id));
  }, [spec.id]);

  useEffect(() => {
    snapshotRef.current = snapshot;
    selectedNodeIdRef.current = selectedNodeId;
    previewNodeRef.current = previewNode;
  });

  useEffect(() => {
    if (spec.id !== "digital_archive") {
      return;
    }
    const projectId = searchParams.get("projectId");
    const requestedFolderId =
      searchParams.get("folderId") ??
      (projectId ? getDigitalArchiveProjectFolderId(projectId) : null);
    if (!requestedFolderId || requestedFolderId === currentFolderId) {
      return;
    }

    const folder = snapshot.files.find(
      (file) => file.id === requestedFolderId && file.type === "folder",
    );
    if (!folder) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      selectedNodeIdRef.current = folder.id;
      previewNodeRef.current = null;
      setCurrentFolderId(folder.id);
      setSelectedNodeId(folder.id);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(`已进入项目数字档案: ${folder.name}`);
      window.dispatchEvent(
        new CustomEvent(architokenFolderSelectionEventName, {
          detail: {
            folderId: folder.id,
            moduleId: spec.id,
            requestedAt: new Date().toISOString(),
          } satisfies ArchitokenFolderSelectionRequest,
        }),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentFolderId, searchParams, snapshot.files, spec.id]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateBackendFiles() {
      if (!shouldAttemptBackendSync()) {
        return;
      }
      try {
        const payload = await moduleFileApiClient.listModuleFiles(spec.id, {
          limit: 500,
        });
        if (cancelled || payload.files.length === 0) {
          return;
        }

        const result = moduleBackendAdapter.replaceModuleFilesFromBackend(
          spec.id,
          payload.files,
        );
        if (cancelled || result.count === 0) {
          return;
        }

        onAudit?.(result.auditEvent);
        setActionMessage(`已同步后端 CDE 文件 ${result.count} 项。`);
        setSnapshot(moduleBackendAdapter.snapshot(spec.id));
      } catch {
        // Backend CDE sync is authoritative in production, but local dev and
        // isolated UI tests still use the session adapter as a fallback.
      }
    }

    void hydrateBackendFiles();

    return () => {
      cancelled = true;
    };
  }, [onAudit, spec.id]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateBackendTransactionsAndAudit() {
      if (!shouldAttemptBackendSync()) {
        return;
      }
      try {
        const [transactions, auditEvents] = await Promise.all([
          moduleTransactionApiClient.listModuleTransactions(spec.id),
          moduleTransactionApiClient.listModuleAuditEvents(spec.id),
        ]);
        if (cancelled) {
          return;
        }

        const transactionResult =
          moduleBackendAdapter.replaceModuleTransactionsFromBackend(
            spec.id,
            transactions,
          );
        const auditResult =
          moduleBackendAdapter.mergeModuleAuditEventsFromBackend(auditEvents);
        if (cancelled) {
          return;
        }

        if (transactionResult.count > 0) {
          onAudit?.(transactionResult.auditEvent);
        }
        if (auditResult.count > 0) {
          onAudit?.(auditResult.auditEvent);
        }
        if (transactionResult.count > 0 || auditResult.count > 0) {
          setSnapshot(moduleBackendAdapter.snapshot(spec.id));
        }
      } catch {
        // Keep session lifecycle state available when the gateway is offline.
      }
    }

    void hydrateBackendTransactionsAndAudit();

    return () => {
      cancelled = true;
    };
  }, [onAudit, spec.id]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLocalFiles() {
      const response = await fetch(
        `/api/local-files?moduleId=${encodeURIComponent(spec.id)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { files: LocalFileMetadata[] };
      if (cancelled || payload.files.length === 0) {
        return;
      }

      const existing = new Set(
        moduleBackendAdapter
          .snapshot(spec.id)
          .uploadedFiles.map((file) => file.fileId),
      );
      const existingContent = new Set(
        moduleBackendAdapter
          .snapshot(spec.id)
          .files.map(localFileNodeDedupeKey)
          .filter((key): key is string => Boolean(key)),
      );
      let hydrated = 0;

      for (const file of payload.files) {
        if (existing.has(file.fileId)) {
          continue;
        }

        const latest = moduleBackendAdapter.snapshot(spec.id);
        const parentId =
          file.parentId &&
          latest.files.some(
            (node) => node.id === file.parentId && node.type === "folder",
          )
            ? file.parentId
            : inferLocalFileParentId(file, latest.files, rootId);
        const contentKey = localFileDedupeKey(file, parentId);
        if (existingContent.has(contentKey)) {
          continue;
        }
        moduleBackendAdapter.uploadLocalFile(file, parentId);
        existing.add(file.fileId);
        existingContent.add(contentKey);
        hydrated += 1;
      }

      if (!cancelled && hydrated > 0) {
        setActionMessage(`${hydrated} 个本地文件已从持久化索引回灌。`);
        setSnapshot(moduleBackendAdapter.snapshot(spec.id));
      }
    }

    void hydrateLocalFiles();

    return () => {
      cancelled = true;
    };
  }, [rootId, spec.id]);

  const record = useCallback(
    (event: ModuleAuditEvent) => {
      onAudit?.(event);
      refresh();
    },
    [onAudit, refresh],
  );

  function announceFolderSelection(folderId: string) {
    const detail: ArchitokenFolderSelectionRequest = {
      folderId,
      moduleId: spec.id,
      requestedAt: new Date().toISOString(),
    };
    window.dispatchEvent(
      new CustomEvent(architokenFolderSelectionEventName, { detail }),
    );
  }

  function getCurrentSelectedNode() {
    const latestSnapshot = snapshotRef.current ?? snapshot;
    const latestSelectedNodeId = selectedNodeIdRef.current ?? selectedNodeId;
    return (
      latestSnapshot.files.find((file) => file.id === latestSelectedNodeId) ??
      previewNodeRef.current ??
      previewNode
    );
  }

  function selectNode(node: ModuleFileNode) {
    setContextMenu(null);
    explorerRef.current?.focus({ preventScroll: true });
    selectedNodeIdRef.current = node.id;
    setSelectedNodeId(node.id);
    setActionMessage(`已选中: ${node.name}`);
  }

  function beginInlineRename(node: ModuleFileNode) {
    setContextMenu(null);
    selectedNodeIdRef.current = node.id;
    previewNodeRef.current = null;
    setSelectedNodeId(node.id);
    setPreviewNode(null);
    setFullView(false);
    setRenamingNodeId(node.id);
    setRenameDraft(node.name);
    setActionMessage(`正在重命名: ${node.name}`);
  }

  function cancelInlineRename() {
    setRenamingNodeId(null);
    setRenameDraft("");
  }

  async function renameNode(node: ModuleFileNode, nextName: string) {
    const name = nextName.trim();
    if (!name || name === node.name) {
      cancelInlineRename();
      return;
    }

    let handled = false;
    if (isBackendBackedNode(node)) {
      try {
        const backendNode = await moduleFileApiClient.updateModuleFile(
          node.id,
          { name },
        );
        const result =
          moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
        setSelectedNodeId(result.node.id);
        setPreviewNode((current) =>
          current?.id === node.id ? result.node : current,
        );
        setActionMessage(`已重命名并同步后端 CDE: ${result.node.name}`);
        record(result.auditEvent);
        handled = true;
      } catch (error) {
        setActionMessage(`重命名未写入后端 CDE: ${backendErrorSummary(error)}`);
        handled = true;
      }
    }
    if (!handled) {
      const result = moduleBackendAdapter.renameFile(node.id, name);
      setSelectedNodeId(result.node.id);
      setPreviewNode((current) =>
        current?.id === node.id ? result.node : current,
      );
      setActionMessage(`已重命名为: ${result.node.name}`);
      record(result.auditEvent);
    }
    cancelInlineRename();
  }

  function openNode(node: ModuleFileNode) {
    setContextMenu(null);
    const result = moduleBackendAdapter.openFile(node.id);
    selectedNodeIdRef.current = result.node.id;
    setSelectedNodeId(result.node.id);
    if (result.node.type === "folder") {
      previewNodeRef.current = null;
      setCurrentFolderId(result.node.id);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(`已进入目录: ${result.node.name}`);
      announceFolderSelection(result.node.id);
    } else {
      previewNodeRef.current = result.node;
      setPreviewNode(result.node);
      setFullView(false);
      setActionMessage(`已预览文件: ${result.node.name}`);
    }
    record(result.auditEvent);
  }

  function viewNode(node: ModuleFileNode, asFullView = false) {
    setContextMenu(null);
    const result = moduleBackendAdapter.openFile(node.id);
    selectedNodeIdRef.current = result.node.id;
    setSelectedNodeId(result.node.id);
    if (result.node.type === "folder") {
      previewNodeRef.current = null;
      setDetailsOpen(true);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(`查看目录属性: ${result.node.name}`);
      record(result.auditEvent);
      return;
    }
    setPreviewNode(result.node);
    previewNodeRef.current = result.node;
    setFullView(asFullView);
    setActionMessage(`查看 ${result.node.name}`);
    record(result.auditEvent);
  }

  function activateSelectedNode() {
    const target = getCurrentSelectedNode();
    if (!target) {
      return;
    }
    activateNode(target);
  }

  function activateNode(target: ModuleFileNode) {
    if (target.type === "folder") {
      openNode(target);
    } else {
      viewNode(target, true);
    }
  }

  function closeTransientExplorerState() {
    if (renamingNodeId) {
      cancelInlineRename();
      return true;
    }
    if (contextMenu) {
      setContextMenu(null);
      return true;
    }
    if (addressMenuOpen) {
      setAddressMenuOpen(false);
      return true;
    }
    if (directoryPickerOpen) {
      setDirectoryPickerOpen(false);
      return true;
    }
    if (previewNode) {
      setPreviewNode(null);
      setFullView(false);
      return true;
    }
    if (dialogMode) {
      setDialogMode(null);
      setDialogTarget(null);
      setDialogAnchor(null);
      return true;
    }
    if (selectedNodeId) {
      setSelectedNodeId(null);
      setActionMessage("已取消选择。");
      return true;
    }
    return false;
  }

  function queueDeleteSelectedNode() {
    const target = getCurrentSelectedNode();
    if (!target) {
      setActionMessage("删除未执行: 当前没有选中的文件或目录。");
      return;
    }
    setDialogTarget(target);
    setDialogMode("delete");
  }

  function queueRenameSelectedNode() {
    const target = getCurrentSelectedNode();
    if (!target) {
      setActionMessage("重命名未执行: 当前没有选中的文件或目录。");
      return;
    }
    beginInlineRename(target);
  }

  function selectVisibleNodeByOffset(offset: number) {
    if (visibleNodes.length === 0) {
      return;
    }
    const currentIndex = selectedNodeId
      ? visibleNodes.findIndex((node) => node.id === selectedNodeId)
      : -1;
    const nextIndex = clampPaneWidth(
      currentIndex < 0
        ? offset > 0
          ? 0
          : visibleNodes.length - 1
        : currentIndex + offset,
      0,
      visibleNodes.length - 1,
    );
    const nextNode = visibleNodes[nextIndex];
    if (!nextNode) return;
    selectedNodeIdRef.current = nextNode.id;
    previewNodeRef.current = null;
    setSelectedNodeId(nextNode.id);
    setPreviewNode(null);
    setFullView(false);
    setActionMessage(`已选中: ${nextNode.name}`);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-file-node-id="${CSS.escape(nextNode.id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  function selectVisibleNodeAt(edge: "first" | "last") {
    if (visibleNodes.length === 0) {
      return;
    }
    const nextNode =
      edge === "first"
        ? visibleNodes[0]
        : visibleNodes[visibleNodes.length - 1];
    if (!nextNode) return;
    selectedNodeIdRef.current = nextNode.id;
    previewNodeRef.current = null;
    setSelectedNodeId(nextNode.id);
    setPreviewNode(null);
    setFullView(false);
    setActionMessage(`已选中: ${nextNode.name}`);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-file-node-id="${CSS.escape(nextNode.id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  function handleExplorerKeyDown(event: KeyboardEvent) {
    if (
      isEditableShortcutTarget(event.target) ||
      isBusinessWorkbenchTarget(event.target)
    ) {
      return;
    }

    const shortcutKey = event.key.toLowerCase();
    const hasCommandModifier = event.ctrlKey || event.metaKey;

    if (hasCommandModifier) {
      if (shortcutKey === "n") {
        event.preventDefault();
        setDialogTarget(currentFolder);
        setDialogMode("new");
        setDialogAnchor(null);
        return;
      }
      if (event.shiftKey && shortcutKey === "n") {
        event.preventDefault();
        setDialogTarget(currentFolder);
        setDialogMode("new");
        setDialogAnchor(null);
        return;
      }
      if (shortcutKey === "c" && selectedNode) {
        event.preventDefault();
        void handleContextAction("copy", selectedNode);
        return;
      }
      if (shortcutKey === "v") {
        event.preventDefault();
        void handleContextAction("paste", currentFolder);
        return;
      }
      if (shortcutKey === "o" && selectedNode) {
        event.preventDefault();
        activateSelectedNode();
        return;
      }
      if (shortcutKey === "u") {
        event.preventDefault();
        setDialogTarget(currentFolder);
        setDialogMode("upload");
        return;
      }
      if (shortcutKey === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (shortcutKey === "r") {
        event.preventDefault();
        refresh();
        setActionMessage("已刷新当前目录。");
        return;
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectVisibleNodeByOffset(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectVisibleNodeByOffset(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectVisibleNodeAt("first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectVisibleNodeAt("last");
      return;
    }

    if (event.key === "Escape") {
      if (closeTransientExplorerState()) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      queueDeleteSelectedNode();
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      queueRenameSelectedNode();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      activateSelectedNode();
      return;
    }

    if (
      event.key === "Backspace" ||
      (event.altKey && event.key === "ArrowLeft")
    ) {
      event.preventDefault();
      goParent();
      return;
    }

    if (event.key === "F5") {
      event.preventDefault();
      refresh();
      setActionMessage("已刷新当前目录。");
    }
  }

  useEffect(() => {
    const explorer = explorerRef.current;
    if (!explorer) {
      return;
    }

    function handleNativeKeyDown(event: KeyboardEvent) {
      handleExplorerKeyDown(event);
    }

    explorer.addEventListener("keydown", handleNativeKeyDown);
    return () => {
      explorer.removeEventListener("keydown", handleNativeKeyDown);
    };
  });

  useEffect(() => {
    function openRequestedFile(request: ArchitokenOpenFileRequest) {
      if (request.moduleId !== spec.id) return;

      try {
        const result = moduleBackendAdapter.openFile(request.fileId);
        const node = result.node;
        setSelectedNodeId(node.id);
        if (node.type === "folder") {
          setCurrentFolderId(node.id);
          setPreviewNode(null);
          setFullView(false);
          setActionMessage(`已通过全局对话进入目录: ${node.name}`);
          const detail: ArchitokenFolderSelectionRequest = {
            folderId: node.id,
            moduleId: spec.id,
            requestedAt: new Date().toISOString(),
          };
          window.dispatchEvent(
            new CustomEvent(architokenFolderSelectionEventName, { detail }),
          );
        } else {
          setCurrentFolderId(node.parentId ?? rootId);
          setPreviewNode(node);
          setFullView(true);
          setActionMessage(`已通过全局对话打开文件: ${node.name}`);
        }
        record(result.auditEvent);
      } catch {
        setActionMessage(`全局对话未找到文件: ${request.query}`);
      }
    }

    function handleOpenFile(event: Event) {
      openRequestedFile(
        (event as CustomEvent<ArchitokenOpenFileRequest>).detail,
      );
    }

    window.addEventListener(architokenOpenFileEventName, handleOpenFile);

    const pending = window.sessionStorage.getItem(architokenPendingOpenFileKey);
    if (pending) {
      try {
        const request = JSON.parse(pending) as ArchitokenOpenFileRequest;
        if (request.moduleId === spec.id) {
          window.sessionStorage.removeItem(architokenPendingOpenFileKey);
          openRequestedFile(request);
        }
      } catch {
        window.sessionStorage.removeItem(architokenPendingOpenFileKey);
      }
    }

    return () => {
      window.removeEventListener(architokenOpenFileEventName, handleOpenFile);
    };
  }, [record, rootId, spec.id]);

  useEffect(() => {
    function handleLocalFileChanged(event: Event) {
      const detail = (event as CustomEvent<ArchitokenLocalFileChangedRequest>)
        .detail;
      if (detail.file.moduleId !== spec.id) return;

      const latest = moduleBackendAdapter.snapshot(spec.id);
      const parentId =
        detail.file.parentId &&
        latest.files.some(
          (node) => node.id === detail.file.parentId && node.type === "folder",
        )
          ? detail.file.parentId
          : inferLocalFileParentId(detail.file, latest.files, rootId);
      const result = moduleBackendAdapter.uploadLocalFile(
        detail.file,
        parentId,
      );
      setCurrentFolderId(result.node.parentId ?? rootId);
      setSelectedNodeId(result.node.id);
      setPreviewNode(result.node);
      setFullView(true);
      setActionMessage(
        `${detail.file.originalName} 已导入 ${detail.file.version}，校验和 ${detail.file.checksum.slice(
          0,
          12,
        )}...`,
      );
      onAudit?.(result.auditEvent);
      setSnapshot(moduleBackendAdapter.snapshot(spec.id));
    }

    window.addEventListener(
      architokenLocalFileChangedEventName,
      handleLocalFileChanged,
    );
    return () => {
      window.removeEventListener(
        architokenLocalFileChangedEventName,
        handleLocalFileChanged,
      );
    };
  }, [onAudit, rootId, spec.id]);

  async function runFileLifecycle(
    node: ModuleFileNode,
    label: string,
    events: ModuleTransactionEvent[],
  ) {
    if (isBackendBackedNode(node)) {
      setActionMessage(`正在写入后端事务: ${label}...`);
      try {
        let latest = await moduleTransactionApiClient.createModuleTransaction({
          moduleId: spec.id,
          transactionType: `${label}: ${node.name}`,
          actor: "FileExplorer",
          relatedFileIds: [node.id],
        });
        onAudit?.(
          latest.auditTrail[0] ?? {
            id: `backend-transaction-created-${latest.id}`,
            at: latest.updatedAt,
            actor: latest.actor,
            summary: `后端事务已创建: ${latest.type}`,
          },
        );

        for (const event of events) {
          if (event === "approve") {
            latest = await moduleTransactionApiClient.approveModuleTransaction({
              transactionId: latest.id,
              actor: "业务负责人",
              comment: "文件工作台发起后端审批通过。",
            });
          } else if (event === "reject") {
            latest = await moduleTransactionApiClient.rejectModuleTransaction({
              transactionId: latest.id,
              actor: "业务负责人",
              comment: "文件工作台发起后端审批驳回。",
            });
          } else {
            latest =
              await moduleTransactionApiClient.transitionModuleTransaction({
                transactionId: latest.id,
                event,
                actor: "FileExplorer",
              });
          }
          if (latest.auditTrail[0]) {
            onAudit?.(latest.auditTrail[0]);
          }
        }

        setSelectedNodeId(node.id);
        setActionMessage(`${node.name}: ${label} -> ${latest.currentState}`);
        setSnapshot(moduleBackendAdapter.snapshot(spec.id));
        return;
      } catch (error) {
        setActionMessage(
          `后端事务写入失败,已回退会话事务: ${backendErrorSummary(error)}`,
        );
      }
    }

    const created = moduleBackendAdapter.createTransaction({
      moduleId: spec.id,
      type: `${label}: ${node.name}`,
      relatedFileIds: [node.id],
    });
    let latest = created.transaction;
    for (const event of events) {
      const result = moduleBackendAdapter.transitionTransaction(
        latest.id,
        event,
      );
      latest = result.transaction;
      onAudit?.(result.auditEvent);
    }
    setSelectedNodeId(node.id);
    setActionMessage(`${node.name}: ${label} -> ${latest.currentState}`);
    record(created.auditEvent);
  }

  function runExplorerLifecycle(
    label: string,
    events: ModuleTransactionEvent[],
    target: ModuleFileNode | null = commandTarget,
  ) {
    if (!target) {
      setActionMessage(`${label} 未执行: 当前没有可用文件或目录。`);
      return;
    }
    void runFileLifecycle(target, label, events);
  }

  async function uploadLocalFile(file: File, parentId: string) {
    setActionMessage(`正在上传 ${file.name}...`);
    const form = new FormData();
    form.set("file", file);
    form.set("moduleId", spec.id);
    form.set("parentId", parentId);
    form.set("owner", "当前用户");
    form.set("tags", "local-upload");

    const response = await fetch("/api/local-files/upload", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    const payload = (await response.json()) as { file: LocalFileMetadata };
    const localResult = moduleBackendAdapter.uploadLocalFile(
      payload.file,
      parentId,
    );
    let visibleNode = localResult.node;
    let backendSynced = false;
    let backendSyncError: string | null = null;
    onAudit?.(localResult.auditEvent);

    if (parentId === rootId || isBackendModuleFileId(parentId)) {
      try {
        const backendNode = await moduleFileApiClient.createModuleFile({
          moduleId: spec.id,
          parentId,
          name: payload.file.originalName,
          kind: "file",
          mimeType: payload.file.mimeType,
          sizeBytes: payload.file.size,
          owner: payload.file.owner,
          tags: Array.from(
            new Set([...payload.file.tags, "backend-cde", "local-upload"]),
          ),
          checksum: payload.file.checksum,
        });
        const backendResult =
          moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
        visibleNode = backendResult.node;
        backendSynced = true;
        onAudit?.(backendResult.auditEvent);
      } catch (error) {
        backendSyncError = backendErrorSummary(error);
      }
    }

    revealUploadedNode(
      visibleNode,
      backendSynced
        ? `${payload.file.originalName} 已写入本地运行目录并同步后端 CDE，点击文件可打开查看。`
        : backendSyncError
          ? `上传已保留本地索引，后端 CDE 同步失败: ${backendSyncError}`
          : `${payload.file.originalName} 已进入文件系统并创建导入审批事务，点击文件可打开查看。`,
    );
  }

  function revealUploadedNode(node: ModuleFileNode, message: string) {
    setCurrentFolderId(node.parentId ?? currentFolderId);
    setSelectedNodeId(node.id);
    setPreviewNode(null);
    setFullView(false);
    setActionMessage(message);
    setSnapshot(moduleBackendAdapter.snapshot(spec.id));
  }

  function handleUploaded(node: ModuleFileNode, metadata: LocalFileMetadata) {
    revealUploadedNode(
      node,
      `${metadata.originalName} 已上传到当前目录并绑定 ${spec.zhName}，点击文件可打开查看。`,
    );
  }

  async function createNewNodeAtTarget(
    target: ModuleFileNode | null,
    nodeType: "folder" | "file",
    fileFormat?: string,
  ) {
    const parentId =
      target?.type === "folder"
        ? target.id
        : (target?.parentId ?? currentFolderId);
    const nodeName = resolveNewModuleNodeName(undefined, nodeType, fileFormat);
    const parentIsBackendWritable =
      parentId === rootId || isBackendModuleFileId(parentId);
    let handled = false;

    if (parentIsBackendWritable) {
      try {
        const backendNode = await moduleFileApiClient.createModuleFile({
          moduleId: spec.id,
          parentId,
          name: nodeName,
          kind: nodeType,
          mimeType: getModuleMimeTypeForName(nodeName, nodeType),
          owner: "当前用户",
          tags: [
            nodeType,
            nodeType === "file" ? `format:${fileFormat ?? "md"}` : "directory",
            "frontend-cde",
          ],
          ...(nodeType === "file"
            ? {
                content: createBlankModuleFileContent(nodeName, fileFormat),
              }
            : {}),
        });
        const result =
          moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
        setCurrentFolderId(parentId);
        setSelectedNodeId(result.node.id);
        setPreviewNode(null);
        setFullView(false);
        setActionMessage(
          `已写入后端 CDE 并新建 ${result.node.type === "folder" ? "文件夹" : "文件"}: ${result.node.name}`,
        );
        record(result.auditEvent);
        handled = true;
      } catch (error) {
        if (isBackendModuleFileId(parentId)) {
          setActionMessage(`新建未写入后端 CDE: ${backendErrorSummary(error)}`);
          handled = true;
        }
      }
    }

    if (!handled) {
      const result = moduleBackendAdapter.createFile({
        moduleId: spec.id,
        parentId,
        name: nodeName,
        type: nodeType,
      });
      setCurrentFolderId(parentId);
      setSelectedNodeId(result.node.id);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(
        `已新建 ${result.node.type === "folder" ? "文件夹" : "文件"}: ${result.node.name}`,
      );
      record(result.auditEvent);
    }
  }

  async function handleContextAction(
    action: FileContextAction,
    node: ModuleFileNode | null,
  ) {
    const actionAnchor = contextMenu
      ? { x: contextMenu.x + 188, y: contextMenu.y - 8 }
      : null;
    setContextMenu(null);
    setAddressMenuOpen(false);
    setDirectoryPickerOpen(false);
    const target = node ?? currentFolder;
    const targetFolderId =
      target?.type === "folder"
        ? target.id
        : (target?.parentId ?? currentFolderId);
    const fileFormat = contextNewFileFormatByAction[action];

    if (action === "open" && target) {
      openNode(target);
      return;
    }
    if (action === "new_folder") {
      await createNewNodeAtTarget(target, "folder");
      return;
    }
    if (fileFormat) {
      await createNewNodeAtTarget(target, "file", fileFormat);
      return;
    }
    if (action === "view" && target) {
      viewNode(target, true);
      return;
    }
    if (action === "properties" && target) {
      const result = moduleBackendAdapter.getProperties(target.id);
      setDetailsOpen(true);
      setSelectedNodeId(result.node.id);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(`属性面板已打开: ${result.node.name}`);
      record(result.auditEvent);
      return;
    }
    if (action === "history" && target) {
      const result = moduleBackendAdapter.getProperties(target.id);
      setDetailsOpen(true);
      setSelectedNodeId(result.node.id);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(
        `版本 / 审计已定位: ${result.node.name} · ${result.node.auditTrail.length} 条记录`,
      );
      record(result.auditEvent);
      return;
    }
    if (action === "validate" && target) {
      await runFileLifecycle(target, "Schema 校验", [
        "submit",
        "generate",
        "evaluate",
        "rule_check",
        "validate_schema",
      ]);
      return;
    }
    if (action === "submit_approval" && target) {
      await runFileLifecycle(target, "提交审批", [
        "submit",
        "generate",
        "evaluate",
        "rule_check",
        "validate_schema",
        "request_approval",
      ]);
      return;
    }
    if (action === "archive" && target) {
      await runFileLifecycle(target, "归档", [
        "submit",
        "generate",
        "evaluate",
        "rule_check",
        "validate_schema",
        "request_approval",
        "approve",
        "archive",
      ]);
      return;
    }
    if (action === "duplicate" && target) {
      const parentId = target.parentId ?? currentFolderId;
      if (isBackendBackedNode(target)) {
        try {
          const backendNode = await moduleFileApiClient.copyModuleFile(
            target.id,
            {
              targetModuleId: spec.id,
              targetParentId: parentId,
              name: `${target.name} 副本`,
              actor: "FileExplorer",
            },
          );
          const result =
            moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setCurrentFolderId(result.node.parentId ?? parentId);
          setSelectedNodeId(result.node.id);
          setPreviewNode(null);
          setFullView(false);
          setActionMessage(`已创建后端 CDE 副本: ${result.node.name}`);
          record(result.auditEvent);
          return;
        } catch (error) {
          setActionMessage(
            `复制副本未写入后端 CDE: ${backendErrorSummary(error)}`,
          );
          return;
        }
      }

      const copyResult = moduleBackendAdapter.copyFile(target.id);
      const pasteResult = moduleBackendAdapter.pasteFile(spec.id, parentId);
      if (pasteResult.nodes[0]) {
        setCurrentFolderId(parentId);
        setSelectedNodeId(pasteResult.nodes[0].id);
        setPreviewNode(null);
        setFullView(false);
      } else {
        setSelectedNodeId(target.id);
      }
      setActionMessage(
        pasteResult.nodes[0]
          ? `已创建副本: ${pasteResult.nodes[0].name}`
          : "复制副本失败: 剪贴板为空",
      );
      onAudit?.(copyResult.auditEvent);
      record(pasteResult.auditEvent);
      return;
    }
    if (action === "download" && target) {
      const result = moduleBackendAdapter.downloadFile(target.id);
      setActionMessage(`下载任务已创建: ${result.job.fileName}`);
      record(result.auditEvent);
      return;
    }
    if (action === "copy" && target) {
      const result = moduleBackendAdapter.copyFile(target.id);
      setActionMessage(`已复制到剪贴板: ${result.clipboard.sourceName}`);
      record(result.auditEvent);
      return;
    }
    if (action === "paste") {
      const result = moduleBackendAdapter.pasteFile(spec.id, targetFolderId);
      if (result.nodes[0]) {
        setCurrentFolderId(targetFolderId);
        setSelectedNodeId(result.nodes[0].id);
        setPreviewNode(null);
        setFullView(false);
      }
      setActionMessage(
        result.nodes.length > 0 ? "已粘贴副本。" : "剪贴板为空，粘贴未执行。",
      );
      record(result.auditEvent);
      return;
    }
    if (action === "refresh") {
      refresh();
      setSelectedNodeId(null);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage("已刷新当前目录。");
      return;
    }
    if (action === "rename" && target) {
      beginInlineRename(target);
      return;
    }

    if (
      action === "new" ||
      action === "upload" ||
      action === "move" ||
      action === "share" ||
      action === "delete"
    ) {
      setDialogTarget(target);
      setDialogMode(action);
      setDialogAnchor(action === "new" ? actionAnchor : null);
    }
  }

  async function confirmDialog(payload: FileDialogPayload) {
    const parentId =
      payload.targetParentId ??
      (dialogTarget?.type === "folder"
        ? dialogTarget.id
        : (dialogTarget?.parentId ?? currentFolderId));
    const name = payload.name?.trim();
    const parentIsBackendWritable =
      parentId === rootId || isBackendModuleFileId(parentId);

    if (dialogMode === "new") {
      const nodeType = payload.nodeType ?? "folder";
      const nodeName = resolveNewModuleNodeName(
        name,
        nodeType,
        payload.fileFormat,
      );
      let handled = false;
      if (parentIsBackendWritable) {
        try {
          const backendNode = await moduleFileApiClient.createModuleFile({
            moduleId: spec.id,
            parentId,
            name: nodeName,
            kind: nodeType,
            mimeType: getModuleMimeTypeForName(nodeName, nodeType),
            owner: "当前用户",
            tags: [
              nodeType,
              nodeType === "file"
                ? `format:${payload.fileFormat ?? "md"}`
                : "directory",
              "frontend-cde",
            ],
            ...(nodeType === "file"
              ? {
                  content: createBlankModuleFileContent(
                    nodeName,
                    payload.fileFormat,
                  ),
                }
              : {}),
          });
          const result =
            moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setCurrentFolderId(parentId);
          setSelectedNodeId(result.node.id);
          setPreviewNode(null);
          setFullView(false);
          setActionMessage(
            `已写入后端 CDE 并新建 ${result.node.type === "folder" ? "文件夹" : "文件"}: ${result.node.name}`,
          );
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          if (isBackendModuleFileId(parentId)) {
            setActionMessage(
              `新建未写入后端 CDE: ${backendErrorSummary(error)}`,
            );
            handled = true;
          }
        }
      }
      if (!handled) {
        const result = moduleBackendAdapter.createFile({
          moduleId: spec.id,
          parentId,
          name: nodeName,
          type: nodeType,
        });
        setCurrentFolderId(parentId);
        setSelectedNodeId(result.node.id);
        setPreviewNode(null);
        setFullView(false);
        setActionMessage(
          `已新建 ${result.node.type === "folder" ? "文件夹" : "文件"}: ${result.node.name}`,
        );
        record(result.auditEvent);
      }
    }
    if (dialogMode === "upload") {
      if (payload.file) {
        await uploadLocalFile(payload.file, parentId);
      } else {
        setActionMessage("未选择真实本地文件，上传未执行。");
      }
    }
    if (dialogMode === "move" && dialogTarget && payload.targetParentId) {
      const targetIsBackendWritable =
        payload.targetParentId === rootId ||
        isBackendModuleFileId(payload.targetParentId);
      let handled = false;
      if (isBackendBackedNode(dialogTarget) && targetIsBackendWritable) {
        try {
          const backendNode = await moduleFileApiClient.moveModuleFile(
            dialogTarget.id,
            {
              moduleId: spec.id,
              targetParentId: payload.targetParentId,
              actor: "FileExplorer",
            },
          );
          const result =
            moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setCurrentFolderId(payload.targetParentId);
          setSelectedNodeId(result.node.id);
          setPreviewNode(null);
          setFullView(false);
          setActionMessage(`已移动并同步后端 CDE: ${result.node.name}`);
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          setActionMessage(`移动未写入后端 CDE: ${backendErrorSummary(error)}`);
          handled = true;
        }
      } else if (isBackendBackedNode(dialogTarget)) {
        setActionMessage("移动未执行: 目标目录不是后端 CDE 节点。");
        handled = true;
      }
      if (!handled) {
        const result = moduleBackendAdapter.moveFile(
          dialogTarget.id,
          payload.targetParentId,
        );
        setCurrentFolderId(payload.targetParentId);
        setSelectedNodeId(result.node.id);
        setPreviewNode(null);
        setFullView(false);
        setActionMessage(`已移动: ${result.node.name}`);
        record(result.auditEvent);
      }
    }
    if (dialogMode === "rename" && dialogTarget && name) {
      await renameNode(dialogTarget, name);
    }
    if (dialogMode === "share" && dialogTarget) {
      let handled = false;
      if (isBackendBackedNode(dialogTarget)) {
        try {
          const share = await moduleFileApiClient.shareModuleFile(
            dialogTarget.id,
            ["read", "share"],
            "FileExplorer",
          );
          const backendNode = await moduleFileApiClient.getModuleFile(
            dialogTarget.id,
          );
          const result =
            moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setLastShareLink({
            id: `backend-share-${share.fileId}`,
            fileId: share.fileId,
            fileName: result.node.name,
            url: share.shareUrl,
            createdAt: new Date().toISOString(),
          });
          setActionMessage(`后端 CDE 分享链接已生成: ${result.node.name}`);
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          setActionMessage(`分享未写入后端 CDE: ${backendErrorSummary(error)}`);
          handled = true;
        }
      }
      if (!handled) {
        const result = moduleBackendAdapter.shareFile(dialogTarget.id);
        setLastShareLink(result.link);
        setActionMessage(`分享链接已生成: ${result.link.fileName}`);
        record(result.auditEvent);
      }
    }
    if (dialogMode === "delete" && dialogTarget) {
      const localFileIdsToDelete = collectNodeAndDescendantLocalFileIds(
        snapshot.files,
        dialogTarget.id,
      );
      for (const localFileId of localFileIdsToDelete) {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(localFileId)}`,
          { method: "DELETE" },
        );
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed: ${response.status}`);
        }
      }
      let handled = false;
      if (isBackendBackedNode(dialogTarget)) {
        try {
          const backendNode = await moduleFileApiClient.trashModuleFile(
            dialogTarget.id,
          );
          const result =
            moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setSelectedNodeId((current) =>
            current === dialogTarget.id ? null : current,
          );
          if (previewNode?.id === dialogTarget.id) {
            setPreviewNode(null);
            setFullView(false);
          }
          setActionMessage(`${result.node.name} 已移入后端 CDE 回收站。`);
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          setActionMessage(`删除未写入后端 CDE: ${backendErrorSummary(error)}`);
          handled = true;
        }
      }
      if (!handled) {
        const result = moduleBackendAdapter.deleteFile(dialogTarget.id);
        setSelectedNodeId((current) =>
          current === dialogTarget.id ? null : current,
        );
        if (previewNode?.id === dialogTarget.id) {
          setPreviewNode(null);
          setFullView(false);
        }
        setActionMessage(
          dialogTarget.localFileId
            ? `${result.node.name} 已从本地运行索引和当前目录删除。`
            : `${result.node.name} 已移入回收站。`,
        );
        record(result.auditEvent);
      }
    }

    setDialogMode(null);
    setDialogTarget(null);
    setDialogAnchor(null);
  }

  function goParent() {
    if (!currentFolder?.parentId) {
      return;
    }
    setCurrentFolderId(currentFolder.parentId);
    announceFolderSelection(currentFolder.parentId);
  }

  const renameInteraction = {
    renamingNodeId,
    renameDraft,
    onRenameDraftChange: setRenameDraft,
    onBeginRename: beginInlineRename,
    onCommitRename: renameNode,
    onCancelRename: cancelInlineRename,
  };

  return (
    <section
      ref={explorerRef}
      tabIndex={0}
      className={`arch-surface open-cde-explorer ${moduleAccentClass(spec.order)} flex h-full min-h-0 flex-col overflow-hidden border-0 focus:outline-none`}
      style={explorerAccentStyle}
    >
      {showExplorerRibbon ? (
        <div className="open-cde-ribbon open-cde-ribbon-grid shrink-0 border-b px-3 py-1">
          <div className="open-cde-ribbon-actions flex min-w-0 items-center gap-1.5">
            <ExplorerCommandButton
              icon={<FolderPlus className="h-4 w-4" />}
              label="新建"
              detail="目录/文件"
              onClick={() => {
                setDialogTarget(currentFolder);
                setDialogMode("new");
                setDialogAnchor(null);
              }}
            />
            <div className="open-cde-upload-command">
              <LocalFileUploader
                moduleId={spec.id}
                parentId={currentFolderId}
                compact
                onFileUpload={uploadLocalFile}
                onUploaded={handleUploaded}
                onAudit={record}
              />
            </div>
            <ExplorerCommandButton
              icon={<Trash2 className="h-4 w-4" />}
              label="删除"
              detail="移入回收站"
              onClick={() => {
                if (!selectedNode) {
                  setActionMessage("删除未执行: 当前没有选中的文件或目录。");
                  return;
                }
                setDialogTarget(selectedNode);
                setDialogMode("delete");
              }}
            />
          </div>
          <div className="open-cde-inline-path relative flex min-w-0 items-center gap-1.5">
            <ExplorerCommandButton
              icon={<ArrowLeft className="h-4 w-4" />}
              label="上一级"
              detail="父目录"
              compact
              disabled={!currentFolder?.parentId}
              onClick={goParent}
            />
            <button
              type="button"
              onClick={() => {
                setAddressMenuOpen((open) => !open);
                setDirectoryPickerOpen(false);
              }}
              className={`open-cde-addressbar ${addressMenuOpen ? "is-active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={addressMenuOpen}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">
                {breadcrumbs
                  .map((crumb, crumbIndex) =>
                    crumbIndex === 0 ? crumb.name : `/ ${crumb.name}`,
                  )
                  .join(" ")}
              </span>
              <ChevronRight
                className={
                  addressMenuOpen
                    ? "h-3.5 w-3.5 shrink-0 rotate-90 transition"
                    : "h-3.5 w-3.5 shrink-0 transition"
                }
              />
            </button>
            <button
              type="button"
              onClick={() => {
                setDirectoryPickerOpen(true);
                setAddressMenuOpen(false);
              }}
              className="open-cde-square-button"
              aria-label="打开业务目录窗口"
              title="打开业务目录窗口"
            >
              <FolderTree className="h-4 w-4" />
            </button>
            {addressMenuOpen ? (
              <AddressDirectoryDropdown
                spec={spec}
                folders={folders}
                rootId={rootId}
                currentFolderId={currentFolderId}
                uploadedCount={uploadedCount}
                onClose={() => setAddressMenuOpen(false)}
                onContext={(event, folder) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedNodeId(folder.id);
                  setPreviewNode(null);
                  setFullView(false);
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    node: folder,
                  });
                }}
                onOpen={(folder) => {
                  openNode(folder);
                  setAddressMenuOpen(false);
                }}
                onOpenDirectoryPicker={() => {
                  setDirectoryPickerOpen(true);
                  setAddressMenuOpen(false);
                }}
                onCreateFolder={() => {
                  setDialogTarget(currentFolder);
                  setDialogMode("new");
                  setDialogAnchor(null);
                  setAddressMenuOpen(false);
                }}
              />
            ) : null}
          </div>
          <div className="open-cde-ribbon-tools flex min-w-0 items-center gap-1.5">
            <label className="arch-input open-cde-search-field flex items-center gap-2 rounded-md px-3 py-1.5">
              <Search className="arch-muted h-4 w-4" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索文件、模型、审批证据..."
                className="arch-text w-full bg-transparent arch-type-body outline-none placeholder:opacity-60"
              />
            </label>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`open-cde-square-button ${viewMode === "list" ? "is-active" : ""}`}
              aria-label="详细信息视图"
              title="详细信息视图"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`open-cde-square-button ${viewMode === "grid" ? "is-active" : ""}`}
              aria-label="图标视图"
              title="图标视图"
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="open-cde-square-button"
              aria-label={detailsOpen ? "隐藏属性面板" : "显示属性面板"}
              title={detailsOpen ? "隐藏属性面板" : "显示属性面板"}
            >
              {detailsOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
            <ExplorerCommandButton
              icon={<FileCheck2 className="h-4 w-4" />}
              label="Schema"
              detail="校验"
              compact
              onClick={() =>
                runExplorerLifecycle("Schema 校验", [
                  "submit",
                  "generate",
                  "evaluate",
                  "rule_check",
                  "validate_schema",
                ])
              }
            />
            <ExplorerCommandButton
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="审批"
              detail="提交"
              compact
              onClick={() =>
                runExplorerLifecycle("提交审批", [
                  "submit",
                  "generate",
                  "evaluate",
                  "rule_check",
                  "validate_schema",
                  "request_approval",
                ])
              }
            />
            <ExplorerCommandButton
              icon={<Archive className="h-4 w-4" />}
              label="归档"
              detail="封存"
              compact
              onClick={() =>
                runExplorerLifecycle("归档", [
                  "submit",
                  "generate",
                  "evaluate",
                  "rule_check",
                  "validate_schema",
                  "request_approval",
                  "approve",
                  "archive",
                ])
              }
            />
            <ExplorerCommandButton
              icon={<RefreshCw className="h-4 w-4" />}
              label="刷新"
              detail="同步"
              compact
              onClick={refresh}
            />
          </div>
        </div>
      ) : null}

      <div
        className="open-cde-explorer-grid min-h-0 flex-1"
        data-left="closed"
        data-right={detailsOpen ? "open" : "closed"}
      >
        <main className="open-cde-main flex min-h-0 min-w-0 flex-col">
          <div
            className="open-cde-stage min-h-0 flex-1 overflow-y-auto"
            onContextMenu={(event) => {
              if (isBusinessWorkbenchTarget(event.target)) {
                event.preventDefault();
                setContextMenu(null);
                return;
              }
              event.preventDefault();
              setSelectedNodeId(null);
              setPreviewNode(null);
              setFullView(false);
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                node: null,
              });
            }}
            onClick={(event) => {
              setContextMenu(null);
              setAddressMenuOpen(false);
              if (!isBusinessWorkbenchTarget(event.target)) {
                setSelectedNodeId(null);
                setPreviewNode(null);
                setFullView(false);
              }
            }}
            onMouseDown={(event) => {
              if (
                !isEditableShortcutTarget(event.target) &&
                !isBusinessWorkbenchTarget(event.target)
              ) {
                explorerRef.current?.focus({ preventScroll: true });
              }
            }}
          >
            {isBusinessHomeSurface ? (
              <div className="open-cde-business-home-root h-full min-h-full">
                {isBusinessHomeRoot &&
                showBusinessHomeFileDock &&
                visibleNodes.length > 0 ? (
                  <section className="min-w-0 overflow-hidden border-b border-[var(--arch-border)]">
                    {viewMode === "list" ? (
                      <FileList
                        key={`${spec.id}:${currentFolderId}:home`}
                        nodes={visibleNodes}
                        selectedNodeId={selectedNodeId}
                        {...renameInteraction}
                        onSelect={selectNode}
                        onActivate={activateNode}
                        onContext={(event, node) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedNodeId(node.id);
                          setPreviewNode(null);
                          setFullView(false);
                          setContextMenu({
                            x: event.clientX,
                            y: event.clientY,
                            node,
                          });
                        }}
                        layoutKey={`${spec.id}:${currentFolderId}`}
                      />
                    ) : (
                      <FileGrid
                        nodes={visibleNodes}
                        selectedNodeId={selectedNodeId}
                        {...renameInteraction}
                        onSelect={selectNode}
                        onActivate={activateNode}
                        onContext={(event, node) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedNodeId(node.id);
                          setPreviewNode(null);
                          setFullView(false);
                          setContextMenu({
                            x: event.clientX,
                            y: event.clientY,
                            node,
                          });
                        }}
                      />
                    )}
                  </section>
                ) : null}
                <section
                  className="open-cde-business-panel h-full min-w-0"
                  data-business-workbench="true"
                >
                  <div
                    className={`arch-module-home h-full min-w-0 ${businessHomePaddingClass}`}
                  >
                    {businessHomeContent}
                  </div>
                </section>
              </div>
            ) : viewMode === "list" ? (
              <FileList
                key={`${spec.id}:${currentFolderId}`}
                nodes={visibleNodes}
                selectedNodeId={selectedNodeId}
                {...renameInteraction}
                onSelect={selectNode}
                onActivate={activateNode}
                onContext={(event, node) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedNodeId(node.id);
                  setPreviewNode(null);
                  setFullView(false);
                  setContextMenu({ x: event.clientX, y: event.clientY, node });
                }}
                layoutKey={`${spec.id}:${currentFolderId}`}
              />
            ) : (
              <FileGrid
                nodes={visibleNodes}
                selectedNodeId={selectedNodeId}
                {...renameInteraction}
                onSelect={selectNode}
                onActivate={activateNode}
                onContext={(event, node) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedNodeId(node.id);
                  setPreviewNode(null);
                  setFullView(false);
                  setContextMenu({ x: event.clientX, y: event.clientY, node });
                }}
              />
            )}
          </div>
        </main>

        {detailsOpen ? (
          <ExplorerDetailsPanel
            spec={spec}
            target={commandTarget}
            snapshot={snapshot}
            visibleCount={visibleNodes.length}
            onAction={handleContextAction}
            onLifecycle={runExplorerLifecycle}
          />
        ) : null}
      </div>

      {showExplorerStatusbar ? (
        <footer className="open-cde-statusbar grid shrink-0 gap-1 border-t px-3 py-1 arch-type-caption md:grid-cols-5">
          <span title={actionMessage}>状态: {actionMessage}</span>
          <span>
            对象: 文件 {fileCount} · 目录 {folderCount}
          </span>
          <span>
            待校验: {pendingValidationCount} · 校验中: {validatingCount} · 复核:{" "}
            {professionalReviewCount}
          </span>
          <span>
            下载任务: {snapshot.downloadJobs.length} · 剪贴板:{" "}
            {snapshot.clipboard?.sourceName ?? "空"}
          </span>
          <span>
            选中: {selectedNode?.name ?? currentFolder?.name ?? "未选择"}
          </span>
        </footer>
      ) : null}

      {directoryPickerOpen ? (
        <DirectoryPickerWindow
          spec={spec}
          folders={folders}
          rootId={rootId}
          currentFolderId={currentFolderId}
          onClose={() => setDirectoryPickerOpen(false)}
          onContext={(event, folder) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedNodeId(folder.id);
            setPreviewNode(null);
            setFullView(false);
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              node: folder,
            });
          }}
          onOpen={(folder) => {
            openNode(folder);
            setDirectoryPickerOpen(false);
          }}
          onCreateSibling={() => {
            const parentId = currentFolder?.parentId ?? rootId;
            const target =
              snapshot.files.find((file) => file.id === parentId) ??
              currentFolder;
            setDialogTarget(target);
            setDialogMode("new");
            setDialogAnchor(null);
            setDirectoryPickerOpen(false);
          }}
          onCreateChild={() => {
            setDialogTarget(currentFolder);
            setDialogMode("new");
            setDialogAnchor(null);
            setDirectoryPickerOpen(false);
          }}
        />
      ) : null}

      {contextMenu ? (
        <FileContextMenu
          node={contextMenu.node}
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <FilePreviewDrawer
        file={previewNode}
        fullView={fullView}
        {...(renderFilePreview ? { renderFilePreview } : {})}
        onClose={() => {
          setPreviewNode(null);
          setFullView(false);
        }}
        onFullView={() => setFullView(true)}
      />

      <FileOperationDialog
        key={`${dialogMode ?? "closed"}-${dialogTarget?.id ?? currentFolderId}`}
        mode={dialogMode}
        target={dialogTarget}
        folders={folders}
        shareLink={lastShareLink}
        anchor={dialogAnchor}
        onCancel={() => {
          setDialogMode(null);
          setDialogTarget(null);
          setDialogAnchor(null);
        }}
        onConfirm={confirmDialog}
      />
    </section>
  );
}

function ExplorerCommandButton({
  icon,
  label,
  detail,
  compact = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`open-cde-command-button ${compact ? "is-compact" : ""}`}
      title={detail ? `${label} · ${detail}` : label}
    >
      <span className="open-cde-command-icon">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{label}</span>
        {detail ? (
          <span className="arch-muted block truncate arch-type-caption">
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function AddressDirectoryDropdown({
  spec,
  folders,
  rootId,
  currentFolderId,
  uploadedCount,
  onClose,
  onContext,
  onOpen,
  onOpenDirectoryPicker,
  onCreateFolder,
}: {
  spec: ModuleSpec;
  folders: ModuleFileNode[];
  rootId: string;
  currentFolderId: string;
  uploadedCount: number;
  onClose: () => void;
  onContext: (event: MouseEvent, folder: ModuleFileNode) => void;
  onOpen: (folder: ModuleFileNode) => void;
  onOpenDirectoryPicker: () => void;
  onCreateFolder: () => void;
}) {
  const root =
    folders.find((folder) => folder.id === rootId) ?? folders[0] ?? null;

  return (
    <div className="open-cde-address-menu" role="dialog" aria-label="业务目录">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--arch-border)] px-3 py-2">
        <div className="min-w-0">
          <p className="arch-text truncate arch-type-body font-semibold">
            {spec.zhName} 业务目录
          </p>
          <p className="arch-muted truncate arch-type-caption">
            {folders.length} 个目录 · 本地上传 {uploadedCount} 个文件
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="arch-btn rounded-md px-2 py-1 arch-type-caption font-medium"
        >
          收起
        </button>
      </div>
      <div className="grid min-h-0 gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-b border-[var(--arch-border)] p-2 md:border-b-0 md:border-r">
          <ExplorerSidebarItem
            icon={<Home className="h-4 w-4" />}
            label={spec.zhName}
            meta={spec.enName}
            active={currentFolderId === rootId}
            onContext={root ? (event) => onContext(event, root) : undefined}
            onClick={() => {
              if (root) onOpen(root);
            }}
          />
          <ExplorerSidebarItem
            icon={<FolderOpen className="h-4 w-4" />}
            label="业务目录窗口"
            meta={`${folders.length} 个目录`}
            onClick={onOpenDirectoryPicker}
          />
          <ExplorerSidebarItem
            icon={<FolderPlus className="h-4 w-4" />}
            label="新建当前目录"
            meta="写入 Registry 模块"
            onClick={onCreateFolder}
          />
          <ExplorerSidebarItem
            icon={<HardDrive className="h-4 w-4" />}
            label="本地上传"
            meta={`${uploadedCount} 个文件`}
            onClick={onOpenDirectoryPicker}
          />
          <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--arch-border)] pt-3">
            {spec.fileTypes.slice(0, 8).map((fileType) => (
              <span
                key={fileType}
                className="arch-huly-row-muted rounded px-2 py-1 font-mono arch-type-caption"
              >
                {fileType}
              </span>
            ))}
          </div>
        </div>
        <div className="max-h-[42vh] min-h-0 overflow-auto p-2">
          {root ? (
            <FolderTreeNode
              folder={root}
              folders={folders}
              depth={0}
              currentFolderId={currentFolderId}
              onContext={onContext}
              onOpen={onOpen}
            />
          ) : (
            <EmptyFolder />
          )}
        </div>
      </div>
    </div>
  );
}

function ExplorerSidebarItem({
  icon,
  label,
  meta,
  active = false,
  onContext,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  active?: boolean;
  onContext?: ((event: MouseEvent) => void) | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContext}
      className={`open-cde-sidebar-item ${active ? "is-active" : ""}`}
    >
      <span className="open-cde-sidebar-icon">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{label}</span>
        {meta ? (
          <span className="arch-muted block truncate arch-type-caption">
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ExplorerDetailsPanel({
  spec,
  target,
  snapshot,
  visibleCount,
  onAction,
  onLifecycle,
}: {
  spec: ModuleSpec;
  target: ModuleFileNode | null;
  snapshot: ModuleBackendSnapshot;
  visibleCount: number;
  onAction: (action: FileContextAction, node: ModuleFileNode | null) => void;
  onLifecycle: (
    label: string,
    events: ModuleTransactionEvent[],
    target?: ModuleFileNode | null,
  ) => void;
}) {
  const transactions = snapshot.transactions.slice(0, 5);
  const auditTrail =
    target?.auditTrail.slice(0, 6) ?? snapshot.auditEvents.slice(0, 6);

  return (
    <aside className="open-cde-details hidden min-h-0 flex-col border-l lg:flex">
      <div className="open-cde-section-title border-b px-3 py-2">
        <Info className="h-4 w-4" />
        <span>属性与事务</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <section className="open-cde-detail-block">
          <div className="flex items-start gap-3">
            <span className="open-cde-detail-icon">
              {target?.type === "folder" ? (
                <Folder className="h-5 w-5" />
              ) : target ? (
                fileIcon(target)
              ) : (
                <HardDrive className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <h3 className="arch-text truncate arch-type-body font-semibold">
                {target?.name ?? spec.zhName}
              </h3>
              <p className="arch-muted mt-1 truncate arch-type-caption">
                {target
                  ? fileKindLabel(target)
                  : `${visibleCount} 个当前可见对象`}
              </p>
            </div>
          </div>
          {target ? (
            <dl className="mt-3 grid gap-2 arch-type-caption">
              <DetailRow
                label="文件状态"
                value={fileStatusLabels[target.status]}
              />
              <DetailRow
                label="校验状态"
                value={
                  validationStatusLabels[getModuleFileValidation(target).status]
                }
              />
              <DetailRow
                label="大小"
                value={formatModuleFileSize(target.size)}
              />
              <DetailRow label="版本" value={target.version} />
              <DetailRow label="所有者" value={target.owner} />
              <DetailRow
                label="更新时间"
                value={formatCompactDate(target.updatedAt)}
              />
            </dl>
          ) : null}
        </section>

        <section className="open-cde-detail-block">
          <div className="open-cde-section-title mb-2">
            <Route className="h-4 w-4" />
            <span>Router 接入</span>
          </div>
          <div className="grid gap-1.5">
            {[
              "Module Registry",
              "File Lifecycle",
              "Approval",
              "Audit",
              "Backend Router",
            ].map((item) => (
              <div key={item} className="open-cde-router-row">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--arch-success)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="open-cde-detail-block">
          <div className="open-cde-section-title mb-2">
            <FileClock className="h-4 w-4" />
            <span>文件动作</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <PanelActionButton
              label="属性"
              disabled={!target}
              onClick={() => onAction("properties", target)}
            />
            <PanelActionButton
              label="历史"
              disabled={!target}
              onClick={() => onAction("history", target)}
            />
            <PanelActionButton
              label="下载"
              disabled={!target}
              onClick={() => onAction("download", target)}
            />
            <PanelActionButton
              label="分享"
              disabled={!target}
              onClick={() => onAction("share", target)}
            />
            <PanelActionButton
              label="校验"
              disabled={!target}
              onClick={() =>
                onLifecycle(
                  "Schema 校验",
                  [
                    "submit",
                    "generate",
                    "evaluate",
                    "rule_check",
                    "validate_schema",
                  ],
                  target,
                )
              }
            />
            <PanelActionButton
              label="审批"
              disabled={!target}
              onClick={() =>
                onLifecycle(
                  "提交审批",
                  [
                    "submit",
                    "generate",
                    "evaluate",
                    "rule_check",
                    "validate_schema",
                    "request_approval",
                  ],
                  target,
                )
              }
            />
          </div>
        </section>

        {target?.tags.length ? (
          <section className="open-cde-detail-block">
            <div className="open-cde-section-title mb-2">
              <Layers3 className="h-4 w-4" />
              <span>标签</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {target.tags.map((tag) => (
                <span
                  key={tag}
                  className="arch-chip rounded px-2 py-1 arch-type-caption"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="open-cde-detail-block">
          <div className="open-cde-section-title mb-2">
            <ClipboardCheck className="h-4 w-4" />
            <span>审批事务</span>
          </div>
          <div className="space-y-1.5">
            {transactions.length ? (
              transactions.map((transaction) => (
                <div key={transaction.id} className="open-cde-timeline-row">
                  <span className="font-medium">{transaction.type}</span>
                  <span className="arch-muted font-mono">
                    {transaction.currentState}
                  </span>
                </div>
              ))
            ) : (
              <p className="arch-muted arch-type-caption">暂无事务。</p>
            )}
          </div>
        </section>

        <section className="open-cde-detail-block">
          <div className="open-cde-section-title mb-2">
            <History className="h-4 w-4" />
            <span>审计记录</span>
          </div>
          <div className="space-y-1.5">
            {auditTrail.length ? (
              auditTrail.map((event) => (
                <div key={event.id} className="open-cde-timeline-row">
                  <span className="font-medium">{event.summary}</span>
                  <span className="arch-muted" suppressHydrationWarning>
                    {formatCompactDate(event.at)}
                  </span>
                </div>
              ))
            ) : (
              <p className="arch-muted arch-type-caption">暂无审计记录。</p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
      <dt className="arch-muted">{label}</dt>
      <dd className="arch-text min-w-0 truncate">{value}</dd>
    </div>
  );
}

function PanelActionButton({
  label,
  disabled = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="arch-btn rounded-md px-2 py-1.5 arch-type-caption font-medium disabled:cursor-not-allowed disabled:opacity-45"
    >
      {label}
    </button>
  );
}

function DirectoryPickerWindow({
  spec,
  folders,
  rootId,
  currentFolderId,
  onClose,
  onContext,
  onOpen,
  onCreateSibling,
  onCreateChild,
}: {
  spec: ModuleSpec;
  folders: ModuleFileNode[];
  rootId: string;
  currentFolderId: string;
  onClose: () => void;
  onContext: (event: MouseEvent, folder: ModuleFileNode) => void;
  onOpen: (folder: ModuleFileNode) => void;
  onCreateSibling: () => void;
  onCreateChild: () => void;
}) {
  const root =
    folders.find((folder) => folder.id === rootId) ?? folders[0] ?? null;

  return (
    <FloatingWindowFrame
      title={`${spec.zhName}业务目录`}
      eyebrow="Business directory"
      subtitle="选择目录，或在当前目录新建同级 / 子目录"
      icon={<FolderOpen className="h-4 w-4" />}
      onClose={onClose}
      defaultSize={{ width: 420, height: 620 }}
      minSize={{ width: 720, height: 520 }}
      placement="center"
      zIndex={90}
      bodyClassName="p-0"
      footerClassName="border-t border-[var(--arch-border)] p-2"
      footer={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateSibling}
            className="arch-btn flex-1 rounded-md px-3 py-2 arch-type-caption font-medium"
          >
            新建同级目录
          </button>
          <button
            type="button"
            onClick={onCreateChild}
            className="arch-btn-primary flex-1 rounded-md px-3 py-2 arch-type-caption font-medium"
          >
            新建子目录
          </button>
        </div>
      }
    >
      <div className="h-full overflow-auto p-2">
        {root ? (
          <FolderTreeNode
            folder={root}
            folders={folders}
            depth={0}
            currentFolderId={currentFolderId}
            onContext={onContext}
            onOpen={onOpen}
          />
        ) : (
          <EmptyFolder />
        )}
      </div>
    </FloatingWindowFrame>
  );
}

function FolderTreeNode({
  folder,
  folders,
  depth,
  currentFolderId,
  onContext,
  onOpen,
}: {
  folder: ModuleFileNode;
  folders: ModuleFileNode[];
  depth: number;
  currentFolderId: string;
  onContext?: ((event: MouseEvent, folder: ModuleFileNode) => void) | undefined;
  onOpen: (folder: ModuleFileNode) => void;
}) {
  const children = folders
    .filter((candidate) => candidate.parentId === folder.id)
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"));

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpen(folder)}
        onContextMenu={(event) => {
          onContext?.(event, folder);
        }}
        className={`arch-huly-folder-node flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-[var(--arch-primary-soft)] ${
          depth === 0 ? "is-root" : "is-child"
        } ${
          currentFolderId === folder.id
            ? "bg-[var(--arch-primary-soft)] text-[var(--arch-primary)]"
            : "arch-text"
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 ${children.length ? "opacity-80" : "opacity-0"}`}
        />
        <Folder className="h-4 w-4 shrink-0" />
        <span className="arch-huly-folder-name min-w-0 truncate">
          {folder.name}
        </span>
      </button>
      {children.map((child) => (
        <FolderTreeNode
          key={child.id}
          folder={child}
          folders={folders}
          depth={depth + 1}
          currentFolderId={currentFolderId}
          onContext={onContext}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

interface FileListColumnWidths {
  name: number;
  size: number;
  status: number;
  validation: number;
  version: number;
}

interface FileListLayout {
  columnWidths: FileListColumnWidths;
  rowHeight: number;
}

const defaultFileListLayout: FileListLayout = {
  columnWidths: {
    name: 720,
    size: 132,
    status: 132,
    validation: 172,
    version: 96,
  },
  rowHeight: 58,
};

function readFileListLayout(storageKey: string): FileListLayout {
  if (typeof window === "undefined") return defaultFileListLayout;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultFileListLayout;
    const parsed = JSON.parse(raw) as Partial<FileListLayout>;
    const columnWidths = (parsed.columnWidths ??
      {}) as Partial<FileListColumnWidths>;
    return {
      columnWidths: {
        name: clampPaneWidth(
          Number(columnWidths.name) || defaultFileListLayout.columnWidths.name,
          280,
          1200,
        ),
        size: clampPaneWidth(
          Number(columnWidths.size) || defaultFileListLayout.columnWidths.size,
          72,
          260,
        ),
        status: clampPaneWidth(
          Number(columnWidths.status) ||
            defaultFileListLayout.columnWidths.status,
          72,
          260,
        ),
        validation: clampPaneWidth(
          Number(columnWidths.validation) ||
            defaultFileListLayout.columnWidths.validation,
          96,
          320,
        ),
        version: clampPaneWidth(
          Number(columnWidths.version) ||
            defaultFileListLayout.columnWidths.version,
          72,
          260,
        ),
      },
      rowHeight: clampPaneWidth(
        Number(parsed.rowHeight) || defaultFileListLayout.rowHeight,
        42,
        120,
      ),
    };
  } catch {
    return defaultFileListLayout;
  }
}

function writeFileListLayout(storageKey: string, layout: FileListLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch {
    // Layout persistence is non-critical; keep the live resize responsive.
  }
}

interface FileItemRenameProps {
  renamingNodeId: string | null;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onBeginRename: (node: ModuleFileNode) => void;
  onCommitRename: (node: ModuleFileNode, name: string) => Promise<void>;
  onCancelRename: () => void;
}

function FileList({
  nodes,
  selectedNodeId,
  renamingNodeId,
  renameDraft,
  onRenameDraftChange,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onSelect,
  onActivate,
  onContext,
  layoutKey = "global",
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onSelect: (node: ModuleFileNode) => void;
  onActivate: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
  layoutKey?: string;
} & FileItemRenameProps) {
  const storageKey = `architoken.file-list-layout.v2:${layoutKey}`;
  const initialLayout = readFileListLayout(storageKey);
  const [columnWidths, setColumnWidths] = useState(initialLayout.columnWidths);
  const [rowHeight, setRowHeight] = useState(initialLayout.rowHeight);

  if (nodes.length === 0) {
    return <EmptyFolder />;
  }

  const gridTemplateColumns = `34px ${columnWidths.name}px ${columnWidths.size}px ${columnWidths.status}px ${columnWidths.validation}px ${columnWidths.version}px`;
  const minWidth =
    34 +
    columnWidths.name +
    columnWidths.size +
    columnWidths.status +
    columnWidths.validation +
    columnWidths.version;

  function startColumnResize(
    key: keyof typeof columnWidths,
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[key];

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clampPaneWidth(
        startWidth + moveEvent.clientX - startX,
        key === "name" ? 280 : 72,
        key === "name" ? 1200 : 260,
      );
      setColumnWidths((current) => {
        const next = { ...current, [key]: nextWidth };
        writeFileListLayout(storageKey, { columnWidths: next, rowHeight });
        return next;
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener(
      "pointerup",
      () => window.removeEventListener("pointermove", handlePointerMove),
      { once: true },
    );
  }

  function startRowResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight = rowHeight;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextHeight = clampPaneWidth(
        startHeight + moveEvent.clientY - startY,
        42,
        120,
      );
      setRowHeight(nextHeight);
      writeFileListLayout(storageKey, { columnWidths, rowHeight: nextHeight });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener(
      "pointerup",
      () => window.removeEventListener("pointermove", handlePointerMove),
      { once: true },
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="arch-surface-muted grid border-b px-3 py-2 arch-type-caption font-medium"
        style={{ gridTemplateColumns, width: minWidth, minWidth }}
      >
        <span className="flex items-center justify-center">
          <button
            type="button"
            onPointerDown={startRowResize}
            className="arch-toolbar-control flex h-5 w-5 cursor-ns-resize items-center justify-center rounded"
            title="拖动调整行高"
            aria-label="拖动调整行高"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </span>
        <ResizableHeaderCell
          label="名称"
          onResize={(event) => startColumnResize("name", event)}
        />
        <ResizableHeaderCell
          label="大小"
          onResize={(event) => startColumnResize("size", event)}
        />
        <ResizableHeaderCell
          label="文件状态"
          onResize={(event) => startColumnResize("status", event)}
        />
        <ResizableHeaderCell
          label="校验状态"
          onResize={(event) => startColumnResize("validation", event)}
        />
        <ResizableHeaderCell
          label="版本"
          onResize={(event) => startColumnResize("version", event)}
        />
      </div>
      {nodes.map((node) => (
        <div
          key={node.id}
          role="button"
          tabIndex={-1}
          data-file-node-id={node.id}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isInlineRenameNameTarget(event.target)) {
              onBeginRename(node);
              return;
            }
            onActivate(node);
          }}
          onContextMenu={(event) => onContext(event, node)}
          className={`open-cde-file-row arch-huly-file-row grid items-center border-b border-[var(--arch-border)] px-3 py-1 text-left transition hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id
              ? "is-selected bg-[var(--arch-primary-soft)] shadow-[inset_2px_0_0_var(--arch-primary)]"
              : ""
          } ${node.status === "soft_deleted" ? "opacity-55" : ""}`}
          style={{
            gridTemplateColumns,
            width: minWidth,
            minWidth,
            minHeight: rowHeight,
          }}
        >
          <span className="open-cde-file-icon arch-primary-text">
            {node.type === "folder" ? (
              <Folder className="h-5 w-5" />
            ) : (
              fileIcon(node)
            )}
          </span>
          <span className="min-w-0">
            {renamingNodeId === node.id ? (
              <InlineRenameInput
                node={node}
                value={renameDraft}
                onChange={onRenameDraftChange}
                onCommit={onCommitRename}
                onCancel={onCancelRename}
              />
            ) : (
              <span
                data-file-name-rename-trigger="true"
                className="arch-huly-file-name arch-text inline-block max-w-full cursor-text truncate rounded px-1 py-0.5"
                title="双击重命名"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onBeginRename(node);
                }}
              >
                {node.name}
              </span>
            )}
            <span className="arch-muted mt-1 block truncate arch-type-caption">
              {node.owner} · {node.updatedAt} · {fileKindLabel(node)}
            </span>
          </span>
          <span className="arch-muted font-mono arch-type-caption">
            {formatModuleFileSize(node.size)}
          </span>
          <span>
            <FileStatusPill status={node.status} />
          </span>
          <span>
            <ValidationStatusPill
              status={getModuleFileValidation(node).status}
            />
          </span>
          <span className="arch-muted font-mono arch-type-caption">
            {node.version}
          </span>
        </div>
      ))}
    </div>
  );
}

function InlineRenameInput({
  node,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  node: ModuleFileNode;
  value: string;
  onChange: (value: string) => void;
  onCommit: (node: ModuleFileNode, name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const finishedRef = useRef(false);
  const inputWidth = `${clampPaneWidth(value.length + 2, 10, 42)}ch`;

  function commit(name: string) {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    void onCommit(node, name);
  }

  function cancel() {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onCancel();
  }

  return (
    <input
      value={value}
      autoFocus
      className="open-cde-inline-rename arch-text min-w-0 max-w-full rounded border px-2 py-1 font-medium outline-none"
      style={{ width: inputWidth }}
      onChange={(event) => onChange(event.target.value)}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        commit(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          commit(event.currentTarget.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
    />
  );
}

function ResizableHeaderCell({
  label,
  onResize,
}: {
  label: string;
  onResize: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span className="relative flex min-w-0 items-center pr-3">
      <span className="truncate">{label}</span>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`调整${label}列宽`}
        onPointerDown={onResize}
        className="absolute inset-y-[-4px] right-0 w-2 cursor-ew-resize touch-none"
        title={`拖动调整${label}列宽`}
      />
    </span>
  );
}

function FileGrid({
  nodes,
  selectedNodeId,
  renamingNodeId,
  renameDraft,
  onRenameDraftChange,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onSelect,
  onActivate,
  onContext,
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onSelect: (node: ModuleFileNode) => void;
  onActivate: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
} & FileItemRenameProps) {
  if (nodes.length === 0) {
    return <EmptyFolder />;
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => (
        <div
          key={node.id}
          role="button"
          tabIndex={-1}
          data-file-node-id={node.id}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isInlineRenameNameTarget(event.target)) {
              onBeginRename(node);
              return;
            }
            onActivate(node);
          }}
          onContextMenu={(event) => onContext(event, node)}
          className={`open-cde-file-card rounded-lg border p-4 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id
              ? "arch-huly-row-selected is-selected"
              : "arch-huly-row"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="arch-primary-soft flex h-11 w-11 items-center justify-center rounded-lg">
              {node.type === "folder" ? (
                <Folder className="h-5 w-5" />
              ) : (
                fileIcon(node)
              )}
            </span>
            <span className="flex flex-col items-end gap-1">
              <FileStatusPill status={node.status} />
              <ValidationStatusPill
                status={getModuleFileValidation(node).status}
              />
            </span>
          </div>
          <h3 className="arch-huly-file-grid-title arch-text mt-4 truncate">
            {renamingNodeId === node.id ? (
              <InlineRenameInput
                node={node}
                value={renameDraft}
                onChange={onRenameDraftChange}
                onCommit={onCommitRename}
                onCancel={onCancelRename}
              />
            ) : (
              <span
                data-file-name-rename-trigger="true"
                className="inline-block max-w-full cursor-text truncate rounded px-1 py-0.5"
                title="双击重命名"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onBeginRename(node);
                }}
              >
                {node.name}
              </span>
            )}
          </h3>
          <p className="arch-muted mt-2 truncate arch-type-caption">
            {fileKindLabel(node)}
          </p>
          <p className="arch-muted mt-3 arch-type-caption">
            {fileMetricLabel(node)}
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyFolder() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="open-cde-empty-icon">
        <FolderOpen className="h-7 w-7" />
      </span>
      <h3 className="arch-huly-empty-title arch-text mt-3 font-semibold">
        当前目录为空
      </h3>
      <p className="arch-muted mt-1 max-w-sm arch-type-body">
        可以通过新建、上传或后端同步把文件纳入生命周期、审批和审计。
      </p>
    </div>
  );
}

function FileStatusPill({ status }: { status: ModuleFileNode["status"] }) {
  return (
    <span
      className={`w-fit rounded-md px-2 py-1 arch-type-caption font-medium ${fileStatusClass(status)}`}
    >
      {fileStatusLabels[status]}
    </span>
  );
}

function ValidationStatusPill({
  status,
}: {
  status: ModuleFileValidationStatus;
}) {
  return (
    <span
      className={`w-fit rounded-md px-2 py-1 arch-type-caption font-medium ${validationStatusClass(status)}`}
    >
      {validationStatusLabels[status]}
    </span>
  );
}

function fileStatusClass(status: ModuleFileNode["status"]) {
  if (status === "soft_deleted") {
    return "bg-red-100 text-red-700";
  }
  if (status === "archived") {
    return "arch-huly-row-muted";
  }
  if (status === "uploaded" || status === "pending_approval") {
    return "bg-blue-100 text-blue-700";
  }
  if (status === "shared") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "arch-chip";
}

function validationStatusClass(status: ModuleFileValidationStatus) {
  if (status === "passed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "failed") {
    return "bg-red-100 text-red-700";
  }
  if (status === "validating" || status === "pending_validation") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "professional_review_required") {
    return "bg-purple-100 text-purple-700";
  }
  return "arch-chip";
}

function fileIcon(node: ModuleFileNode) {
  if (node.tags.includes("semantic-dictionary")) {
    return <Database className="h-5 w-5" />;
  }
  if (
    node.viewerKind === "engineering" ||
    node.mimeType.startsWith("model") ||
    node.name.endsWith(".ifc") ||
    node.name.endsWith(".glb")
  ) {
    return <Box className="h-5 w-5" />;
  }
  if (node.status === "downloading") {
    return <Download className="h-5 w-5" />;
  }
  return <FileText className="h-5 w-5" />;
}

function fileKindLabel(node: ModuleFileNode): string {
  if (node.tags.includes("semantic-dictionary")) {
    return "SJG 157 语义字典 / PostgreSQL";
  }
  return node.mimeType;
}

function fileMetricLabel(node: ModuleFileNode): string {
  if (node.tags.includes("semantic-dictionary")) {
    return formatModuleFileSize(node.size) + " · " + node.version;
  }
  return `${formatModuleFileSize(node.size)} · ${node.version}`;
}

function formatCompactDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildBreadcrumbs(
  files: ModuleFileNode[],
  folderId: string,
): ModuleFileNode[] {
  const result: ModuleFileNode[] = [];
  let cursor = files.find((file) => file.id === folderId) ?? null;
  while (cursor) {
    result.unshift(cursor);
    cursor = cursor.parentId
      ? (files.find((file) => file.id === cursor?.parentId) ?? null)
      : null;
  }
  return result;
}

function collectNodeAndDescendantLocalFileIds(
  files: ModuleFileNode[],
  nodeId: string,
): string[] {
  const result = new Set<string>();
  const visit = (id: string) => {
    const node = files.find((file) => file.id === id);
    if (node?.localFileId) {
      result.add(node.localFileId);
    }
    files
      .filter((file) => file.parentId === id)
      .forEach((child) => visit(child.id));
  };

  visit(nodeId);
  return Array.from(result);
}

function matchGlobalFileSearch(
  node: ModuleFileNode,
  normalizedSearch: string,
): boolean {
  const validation = getModuleFileValidation(node);
  return [
    node.name,
    node.owner,
    node.mimeType,
    node.status,
    validation.status,
    validation.summary ?? "",
    validation.validatorRef ?? "",
    node.version,
    node.id,
    node.parentId ?? "",
    node.localFile?.checksum ?? "",
    node.localFile?.tags.join(" ") ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

function isInternalBusinessJson(
  moduleId: ModuleSpec["id"],
  node: ModuleFileNode,
): boolean {
  if (moduleId !== "marketing_service" && moduleId !== "concept_design") {
    return false;
  }
  const isArchitokenJson =
    node.name.toLowerCase().endsWith(".json") &&
    (node.mimeType.startsWith("application/vnd.architoken.") ||
      node.tags.some((tag) =>
        [
          "marketing-requirement",
          "design-confirmation",
          "contract-draft",
          "prepayment-intent",
          "concept-design-options",
          "concept-design-import",
        ].includes(tag),
      ));
  return isArchitokenJson;
}

function clampPaneWidth(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function moduleAccentClass(order: number): string {
  return (
    moduleAccentClasses[(order - 1) % moduleAccentClasses.length] ??
    moduleAccentClasses[0]
  );
}

function localFileNodeDedupeKey(node: ModuleFileNode): string | null {
  if (!node.localFile) {
    return null;
  }
  return localFileDedupeKey(node.localFile, node.parentId ?? "");
}

function localFileDedupeKey(file: LocalFileMetadata, parentId: string): string {
  return [
    file.moduleId,
    parentId,
    file.originalName,
    String(file.size),
    file.checksum,
  ].join("\u001f");
}

function inferLocalFileParentId(
  file: LocalFileMetadata,
  nodes: ModuleFileNode[],
  rootId: string,
): string {
  const ext = file.ext.toLowerCase();
  const folders = nodes.filter((node) => node.type === "folder");
  const byName = (patterns: string[]) =>
    folders.find((folder) =>
      patterns.some((pattern) => folder.name.toLowerCase().includes(pattern)),
    )?.id;

  if (
    ext === ".ifc" ||
    ext === ".ifczip" ||
    ext === ".ids" ||
    ext === ".bcfzip"
  ) {
    return byName(["ifc", "bim", "模型"]) ?? rootId;
  }
  if (ext === ".dwg" || ext === ".dxf" || ext === ".dgn") {
    return byName(["dwg", "dxf", "图纸", "cad"]) ?? rootId;
  }
  if ([".step", ".stp", ".iges", ".igs", ".brep", ".stl"].includes(ext)) {
    return byName(["节点", "深化", "模型"]) ?? rootId;
  }
  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv" || ext === ".tsv") {
    return byName(["工程量", "boq", "清单", "成本"]) ?? rootId;
  }
  if (ext === ".pdf" || ext === ".docx" || ext === ".doc" || ext === ".pptx") {
    return byName(["资料", "文档", "审批", "归档"]) ?? rootId;
  }

  return rootId;
}
