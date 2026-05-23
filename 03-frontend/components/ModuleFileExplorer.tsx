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
  FileArchive,
  FileCheck2,
  FileClock,
  FileCog,
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
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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
import {
  isBackendModuleFileId,
  moduleFileApiClient,
} from "@/lib/module-file-api-client";
import {
  architokenOpenFileEventName,
  architokenPendingOpenFileKey,
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
  getModuleFileValidation,
  getModuleRootId,
} from "@/lib/module-file-system";
import type { ModuleTransactionEvent } from "@/lib/module-lifecycle";
import type { ModuleSpec } from "@/lib/module-registry";

interface ContextMenuState {
  x: number;
  y: number;
  node: ModuleFileNode | null;
}

type FileViewMode = "list" | "grid";

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

function isBackendBackedNode(node: ModuleFileNode | null): boolean {
  return Boolean(
    node && (node.source === "backend" || isBackendModuleFileId(node.id)),
  );
}

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

export function ModuleFileExplorer({
  spec,
  onAudit,
  businessHome,
  showBusinessHomeFileDock = false,
  renderFilePreview,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  businessHome?: ReactNode;
  showBusinessHomeFileDock?: boolean;
  renderFilePreview?: (file: ModuleFileNode) => ReactNode | null;
}) {
  const rootId = getModuleRootId(spec.id);
  const explorerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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
  const [lastShareLink, setLastShareLink] = useState<ModuleShareLink | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const [actionMessage, setActionMessage] = useState(
    "文件、事务、审批和审计已接入运行适配器。",
  );
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false);
  const [leftPaneOpen] = useState(false);
  const [addressMenuOpen, setAddressMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      file.status !== "soft_deleted" && !isInternalBusinessJson(spec.id, file),
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

  const refresh = useCallback(() => {
    setSnapshot(moduleBackendAdapter.snapshot(spec.id));
  }, [spec.id]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateBackendFiles() {
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

  function selectNode(node: ModuleFileNode) {
    setContextMenu(null);
    setSelectedNodeId(node.id);
    setActionMessage(`已选中: ${node.name}`);
  }

  function openNode(node: ModuleFileNode) {
    setContextMenu(null);
    const result = moduleBackendAdapter.openFile(node.id);
    setSelectedNodeId(result.node.id);
    if (result.node.type === "folder") {
      setCurrentFolderId(result.node.id);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(`已进入目录: ${result.node.name}`);
    } else {
      setPreviewNode(result.node);
      setFullView(false);
      setActionMessage(`已预览文件: ${result.node.name}`);
    }
    record(result.auditEvent);
  }

  function viewNode(node: ModuleFileNode, asFullView = false) {
    setContextMenu(null);
    const result = moduleBackendAdapter.openFile(node.id);
    setSelectedNodeId(result.node.id);
    if (result.node.type === "folder") {
      setDetailsOpen(true);
      setPreviewNode(null);
      setFullView(false);
      setActionMessage(`查看目录属性: ${result.node.name}`);
      record(result.auditEvent);
      return;
    }
    setPreviewNode(result.node);
    setFullView(asFullView);
    setActionMessage(`查看 ${result.node.name}`);
    record(result.auditEvent);
  }

  function activateSelectedNode() {
    if (!selectedNode) {
      return;
    }
    if (selectedNode.type === "folder") {
      openNode(selectedNode);
    } else {
      viewNode(selectedNode, true);
    }
  }

  function closeTransientExplorerState() {
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
    if (!selectedNode) {
      setActionMessage("删除未执行: 当前没有选中的文件或目录。");
      return;
    }
    setDialogTarget(selectedNode);
    setDialogMode("delete");
  }

  function queueRenameSelectedNode() {
    if (!selectedNode) {
      setActionMessage("重命名未执行: 当前没有选中的文件或目录。");
      return;
    }
    setDialogTarget(selectedNode);
    setDialogMode("rename");
  }

  function handleExplorerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (
      isEditableShortcutTarget(event.target) ||
      isBusinessWorkbenchTarget(event.target)
    ) {
      return;
    }

    const shortcutKey = event.key.toLowerCase();
    const hasCommandModifier = event.ctrlKey || event.metaKey;

    if (hasCommandModifier) {
      if (event.shiftKey && shortcutKey === "n") {
        event.preventDefault();
        setDialogTarget(currentFolder);
        setDialogMode("new");
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

  function runFileLifecycle(
    node: ModuleFileNode,
    label: string,
    events: ModuleTransactionEvent[],
  ) {
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
    runFileLifecycle(target, label, events);
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

  async function handleContextAction(
    action: FileContextAction,
    node: ModuleFileNode | null,
  ) {
    setContextMenu(null);
    const target = node ?? currentFolder;
    const targetFolderId =
      target?.type === "folder"
        ? target.id
        : (target?.parentId ?? currentFolderId);

    if (action === "open" && target) {
      openNode(target);
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
      runFileLifecycle(target, "Schema 校验", [
        "submit",
        "generate",
        "evaluate",
        "rule_check",
        "validate_schema",
      ]);
      return;
    }
    if (action === "submit_approval" && target) {
      runFileLifecycle(target, "提交审批", [
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
      runFileLifecycle(target, "归档", [
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

    if (
      action === "new" ||
      action === "upload" ||
      action === "move" ||
      action === "share" ||
      action === "delete" ||
      action === "rename"
    ) {
      setDialogTarget(target);
      setDialogMode(action);
    }
  }

  async function confirmDialog(payload: FileDialogPayload) {
    const parentId =
      dialogTarget?.type === "folder"
        ? dialogTarget.id
        : (dialogTarget?.parentId ?? currentFolderId);
    const name = payload.name?.trim();
    const parentIsBackendWritable =
      parentId === rootId || isBackendModuleFileId(parentId);

    if (dialogMode === "new") {
      const nodeType = payload.nodeType ?? "folder";
      const nodeName =
        name || (nodeType === "file" ? "新建文件.md" : "新建文件夹");
      let handled = false;
      if (parentIsBackendWritable) {
        try {
          const backendNode = await moduleFileApiClient.createModuleFile({
            moduleId: spec.id,
            parentId,
            name: nodeName,
            kind: nodeType,
            owner: "当前用户",
            tags: [nodeType, "frontend-cde"],
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
      let handled = false;
      if (isBackendBackedNode(dialogTarget)) {
        try {
          const backendNode = await moduleFileApiClient.updateModuleFile(
            dialogTarget.id,
            { name },
          );
          const result =
            moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setSelectedNodeId(result.node.id);
          setActionMessage(`已重命名并同步后端 CDE: ${result.node.name}`);
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          setActionMessage(
            `重命名未写入后端 CDE: ${backendErrorSummary(error)}`,
          );
          handled = true;
        }
      }
      if (!handled) {
        const result = moduleBackendAdapter.renameFile(dialogTarget.id, name);
        setSelectedNodeId(result.node.id);
        setActionMessage(`已重命名为: ${result.node.name}`);
        record(result.auditEvent);
      }
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
  }

  function goParent() {
    if (!currentFolder?.parentId) {
      return;
    }
    setCurrentFolderId(currentFolder.parentId);
  }

  return (
    <section
      ref={explorerRef}
      tabIndex={0}
      onKeyDown={handleExplorerKeyDown}
      className="arch-surface open-cde-explorer flex h-full min-h-0 flex-col overflow-hidden border-0 focus:outline-none"
    >
      <div className="open-cde-ribbon flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ExplorerCommandButton
            icon={<FolderPlus className="h-4 w-4" />}
            label="新建"
            detail="目录/文件"
            onClick={() => {
              setDialogTarget(currentFolder);
              setDialogMode("new");
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
            icon={<FileCog className="h-4 w-4" />}
            label="转换"
            detail="Router"
            onClick={() =>
              runExplorerLifecycle("格式转换请求", [
                "submit",
                "generate",
                "evaluate",
                "rule_check",
                "validate_schema",
              ])
            }
          />
          <ExplorerCommandButton
            icon={<FileArchive className="h-4 w-4" />}
            label="压缩"
            detail="打包"
            onClick={() =>
              runExplorerLifecycle("压缩归档", [
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
            icon={<FolderOpen className="h-4 w-4" />}
            label="解压"
            detail="登记"
            onClick={() =>
              runExplorerLifecycle("解压导入登记", [
                "submit",
                "generate",
                "evaluate",
                "rule_check",
                "validate_schema",
              ])
            }
          />
          <ExplorerCommandButton
            icon={<ShieldCheck className="h-4 w-4" />}
            label="测试"
            detail="完整性"
            onClick={() =>
              runExplorerLifecycle("完整性测试", [
                "submit",
                "evaluate",
                "rule_check",
              ])
            }
          />
          <ExplorerCommandButton
            icon={<Trash2 className="h-4 w-4" />}
            label="安全删除"
            detail="审计"
            onClick={() => {
              if (!commandTarget) {
                setActionMessage("安全删除未执行: 当前没有可用文件或目录。");
                return;
              }
              setDialogTarget(commandTarget);
              setDialogMode("delete");
            }}
          />
          <span className="open-cde-toolbar-separator" aria-hidden="true" />
          <div className="open-cde-inline-path relative flex min-w-0 flex-1 items-center gap-1.5">
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
            <button
              type="button"
              onClick={goParent}
              disabled={!currentFolder?.parentId}
              className="open-cde-square-button disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="上一级"
              title="上一级"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDirectoryPickerOpen(true);
                setAddressMenuOpen(false);
              }}
              className="open-cde-addressbar"
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
            {addressMenuOpen ? (
              <AddressDirectoryDropdown
                spec={spec}
                folders={folders}
                rootId={rootId}
                currentFolderId={currentFolderId}
                uploadedCount={uploadedCount}
                onClose={() => setAddressMenuOpen(false)}
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
                  setAddressMenuOpen(false);
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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

      <div
        className="open-cde-explorer-grid min-h-0 flex-1"
        data-left={leftPaneOpen ? "open" : "closed"}
        data-right={detailsOpen ? "open" : "closed"}
      >
        {leftPaneOpen ? (
          <ExplorerSidebar
            spec={spec}
            folders={folders}
            rootId={rootId}
            currentFolderId={currentFolderId}
            uploadedCount={uploadedCount}
            onOpen={openNode}
            onOpenDirectoryPicker={() => setDirectoryPickerOpen(true)}
            onCreateFolder={() => {
              setDialogTarget(currentFolder);
              setDialogMode("new");
            }}
          />
        ) : null}

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
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                node: currentFolder,
              });
            }}
            onClick={() => {
              setContextMenu(null);
              setAddressMenuOpen(false);
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
            {businessHome && !normalizedSearch && currentFolderId === rootId ? (
              <div className="min-h-full">
                {showBusinessHomeFileDock && visibleNodes.length > 0 ? (
                  <section className="min-w-0 overflow-hidden border-b border-[var(--arch-border)]">
                    {viewMode === "list" ? (
                      <FileList
                        key={`${spec.id}:${currentFolderId}:home`}
                        nodes={visibleNodes}
                        selectedNodeId={selectedNodeId}
                        onSelect={selectNode}
                        onOpen={openNode}
                        onView={(node) => viewNode(node, true)}
                        onContext={(event, node) => {
                          event.preventDefault();
                          event.stopPropagation();
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
                        onSelect={selectNode}
                        onOpen={openNode}
                        onView={(node) => viewNode(node, true)}
                        onContext={(event, node) => {
                          event.preventDefault();
                          event.stopPropagation();
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
                  className="open-cde-business-panel min-w-0"
                  data-business-workbench="true"
                >
                  <div className="arch-module-home min-w-0 p-3">
                    {businessHome}
                  </div>
                </section>
              </div>
            ) : viewMode === "list" ? (
              <FileList
                key={`${spec.id}:${currentFolderId}`}
                nodes={visibleNodes}
                selectedNodeId={selectedNodeId}
                onSelect={selectNode}
                onOpen={openNode}
                onView={(node) => viewNode(node, true)}
                onContext={(event, node) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ x: event.clientX, y: event.clientY, node });
                }}
                layoutKey={`${spec.id}:${currentFolderId}`}
              />
            ) : (
              <FileGrid
                nodes={visibleNodes}
                selectedNodeId={selectedNodeId}
                onSelect={selectNode}
                onOpen={openNode}
                onView={(node) => viewNode(node, true)}
                onContext={(event, node) => {
                  event.preventDefault();
                  event.stopPropagation();
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

      {directoryPickerOpen ? (
        <DirectoryPickerWindow
          spec={spec}
          folders={folders}
          rootId={rootId}
          currentFolderId={currentFolderId}
          onClose={() => setDirectoryPickerOpen(false)}
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
            setDirectoryPickerOpen(false);
          }}
          onCreateChild={() => {
            setDialogTarget(currentFolder);
            setDialogMode("new");
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
        onCancel={() => {
          setDialogMode(null);
          setDialogTarget(null);
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
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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

function ExplorerSidebar({
  spec,
  folders,
  rootId,
  currentFolderId,
  uploadedCount,
  onOpen,
  onOpenDirectoryPicker,
  onCreateFolder,
}: {
  spec: ModuleSpec;
  folders: ModuleFileNode[];
  rootId: string;
  currentFolderId: string;
  uploadedCount: number;
  onOpen: (folder: ModuleFileNode) => void;
  onOpenDirectoryPicker: () => void;
  onCreateFolder: () => void;
}) {
  const root =
    folders.find((folder) => folder.id === rootId) ?? folders[0] ?? null;

  return (
    <aside className="open-cde-sidebar hidden min-h-0 flex-col border-r lg:flex">
      <div className="open-cde-section-title px-3 py-2">
        <FolderTree className="h-4 w-4" />
        <span>业务目录</span>
      </div>
      <div className="space-y-1 border-b border-[var(--arch-border)] px-2 pb-2">
        <ExplorerSidebarItem
          icon={<Home className="h-4 w-4" />}
          label={spec.zhName}
          meta={spec.enName}
          active={currentFolderId === rootId}
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
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {root ? (
          <FolderTreeNode
            folder={root}
            folders={folders}
            depth={0}
            currentFolderId={currentFolderId}
            onOpen={onOpen}
          />
        ) : (
          <EmptyFolder />
        )}
      </div>
      <div className="border-t border-[var(--arch-border)] p-3">
        <p className="arch-muted mb-2 arch-type-caption font-medium">
          模块文件类型
        </p>
        <div className="flex flex-wrap gap-1">
          {spec.fileTypes.slice(0, 6).map((fileType) => (
            <span
              key={fileType}
              className="arch-huly-row-muted rounded px-2 py-1 font-mono arch-type-caption"
            >
              {fileType}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

function AddressDirectoryDropdown({
  spec,
  folders,
  rootId,
  currentFolderId,
  uploadedCount,
  onClose,
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
  onClick,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  onOpen,
  onCreateSibling,
  onCreateChild,
}: {
  spec: ModuleSpec;
  folders: ModuleFileNode[];
  rootId: string;
  currentFolderId: string;
  onClose: () => void;
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
  onOpen,
}: {
  folder: ModuleFileNode;
  folders: ModuleFileNode[];
  depth: number;
  currentFolderId: string;
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

function FileList({
  nodes,
  selectedNodeId,
  onSelect,
  onOpen,
  onView,
  onContext,
  layoutKey = "global",
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onSelect: (node: ModuleFileNode) => void;
  onOpen: (node: ModuleFileNode) => void;
  onView: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
  layoutKey?: string;
}) {
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
        style={{ gridTemplateColumns, minWidth }}
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
        <button
          key={node.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (node.type === "folder") {
              onOpen(node);
            } else {
              onView(node);
            }
          }}
          onContextMenu={(event) => onContext(event, node)}
          className={`arch-huly-file-row grid w-full items-center border-b border-[var(--arch-border)] px-3 py-1 text-left transition hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id ? "bg-[var(--arch-primary-soft)]" : ""
          } ${node.status === "soft_deleted" ? "opacity-55" : ""}`}
          style={{ gridTemplateColumns, minWidth, minHeight: rowHeight }}
        >
          <span className="arch-primary-text">
            {node.type === "folder" ? (
              <Folder className="h-5 w-5" />
            ) : (
              fileIcon(node)
            )}
          </span>
          <span className="min-w-0">
            <span className="arch-huly-file-name arch-text block truncate">
              {node.name}
            </span>
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
        </button>
      ))}
    </div>
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
  onSelect,
  onOpen,
  onView,
  onContext,
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onSelect: (node: ModuleFileNode) => void;
  onOpen: (node: ModuleFileNode) => void;
  onView: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
}) {
  if (nodes.length === 0) {
    return <EmptyFolder />;
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (node.type === "folder") {
              onOpen(node);
            } else {
              onView(node);
            }
          }}
          onContextMenu={(event) => onContext(event, node)}
          className={`rounded-lg border p-4 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id
              ? "arch-huly-row-selected"
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
            {node.name}
          </h3>
          <p className="arch-muted mt-2 truncate arch-type-caption">
            {fileKindLabel(node)}
          </p>
          <p className="arch-muted mt-3 arch-type-caption">
            {fileMetricLabel(node)}
          </p>
        </button>
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
