// components/ModuleFileExplorer.tsx - Business file/folder explorer
// License: Apache-2.0
'use client';

import {
  ArrowLeft,
  Box,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  Grid2X2,
  GripVertical,
  List,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { FileContextMenu, type FileContextAction } from '@/components/FileContextMenu';
import { FileOperationDialog, type FileDialogMode, type FileDialogPayload } from '@/components/FileOperationDialog';
import { FilePreviewDrawer } from '@/components/FilePreviewDrawer';
import { FloatingWindowFrame } from '@/components/FloatingWindowFrame';
import { LocalFileUploader } from '@/components/LocalFileUploader';
import { moduleBackendAdapter, type ModuleBackendSnapshot } from '@/lib/module-backend-adapter';
import { isBackendModuleFileId, moduleFileApiClient } from '@/lib/module-file-api-client';
import {
  architokenOpenFileEventName,
  architokenPendingOpenFileKey,
  type ArchitokenOpenFileRequest,
} from '@/lib/module-dialog-events';
import type { LocalFileMetadata } from '@/lib/local-file-runtime';
import type { ModuleAuditEvent, ModuleFileNode, ModuleShareLink } from '@/lib/module-file-system';
import { formatModuleFileSize, getModuleRootId } from '@/lib/module-file-system';
import type { ModuleTransactionEvent } from '@/lib/module-lifecycle';
import type { ModuleSpec } from '@/lib/module-registry';

interface ContextMenuState {
  x: number;
  y: number;
  node: ModuleFileNode | null;
}

type FileViewMode = 'list' | 'grid';

const statusLabels: Record<ModuleFileNode['status'], string> = {
  active: '可用',
  uploaded: '已上传',
  downloading: '下载任务',
  shared: '已分享',
  copied: '已复制',
  moved: '已移动',
  schema_validating: 'Schema 校验',
  pending_approval: '待审批',
  soft_deleted: '回收站',
  archived: '已归档',
};

function isBackendBackedNode(node: ModuleFileNode | null): boolean {
  return Boolean(
    node && (node.source === 'backend' || isBackendModuleFileId(node.id)),
  );
}

function backendErrorSummary(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '后端 CDE 请求失败';
}

export function ModuleFileExplorer({
  spec,
  onAudit,
  businessHome,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  businessHome?: ReactNode;
}) {
  const rootId = getModuleRootId(spec.id);
  const [snapshot, setSnapshot] = useState<ModuleBackendSnapshot>(() => moduleBackendAdapter.snapshot(spec.id));
  const [currentFolderId, setCurrentFolderId] = useState(rootId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewNode, setPreviewNode] = useState<ModuleFileNode | null>(null);
  const [fullView, setFullView] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dialogMode, setDialogMode] = useState<FileDialogMode | null>(null);
  const [dialogTarget, setDialogTarget] = useState<ModuleFileNode | null>(null);
  const [lastShareLink, setLastShareLink] = useState<ModuleShareLink | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<FileViewMode>('list');
  const [actionMessage, setActionMessage] = useState('文件、事务、审批和审计已接入运行适配器。');
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false);

  const currentFolder = snapshot.files.find((file) => file.id === currentFolderId) ?? null;
  const selectedNode = snapshot.files.find((file) => file.id === selectedNodeId) ?? previewNode;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleNodes = (
    normalizedSearch
      ? snapshot.files.filter((file) => matchGlobalFileSearch(file, normalizedSearch))
      : moduleBackendAdapter.listFiles(spec.id, currentFolderId)
  ).filter((file) => file.status !== 'soft_deleted');
  const folders = snapshot.files.filter(
    (file) => file.type === 'folder' && file.status !== 'soft_deleted',
  );
  const breadcrumbs = buildBreadcrumbs(snapshot.files, currentFolderId);
  const uploadedCount = snapshot.files.filter(
    (file) => file.source === 'local_upload' && file.status !== 'soft_deleted',
  ).length;

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
        { cache: 'no-store' },
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
          latest.files.some((node) => node.id === file.parentId && node.type === 'folder')
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

  const record = useCallback((event: ModuleAuditEvent) => {
    onAudit?.(event);
    refresh();
  }, [onAudit, refresh]);

  function openNode(node: ModuleFileNode) {
    setContextMenu(null);
    const result = moduleBackendAdapter.openFile(node.id);
    setSelectedNodeId(result.node.id);
    if (result.node.type === 'folder') {
      setCurrentFolderId(result.node.id);
      setPreviewNode(null);
      setActionMessage(`已进入目录: ${result.node.name}`);
    } else {
      setPreviewNode(result.node);
      setFullView(true);
      setActionMessage(`已打开文件: ${result.node.name}`);
    }
    record(result.auditEvent);
  }

  function viewNode(node: ModuleFileNode, asFullView = false) {
    setContextMenu(null);
    const result = moduleBackendAdapter.openFile(node.id);
    setSelectedNodeId(result.node.id);
    setPreviewNode(result.node);
    setFullView(asFullView);
    setActionMessage(`查看 ${result.node.name}`);
    record(result.auditEvent);
  }

  function selectNode(node: ModuleFileNode) {
    setContextMenu(null);
    setSelectedNodeId(node.id);
    setActionMessage(`已选择: ${node.name}`);
  }

  useEffect(() => {
    function openRequestedFile(request: ArchitokenOpenFileRequest) {
      if (request.moduleId !== spec.id) return;

      try {
        const result = moduleBackendAdapter.openFile(request.fileId);
        const node = result.node;
        setSelectedNodeId(node.id);
        if (node.type === 'folder') {
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
      openRequestedFile((event as CustomEvent<ArchitokenOpenFileRequest>).detail);
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
      const result = moduleBackendAdapter.transitionTransaction(latest.id, event);
      latest = result.transaction;
      onAudit?.(result.auditEvent);
    }
    setSelectedNodeId(node.id);
    setActionMessage(`${node.name}: ${label} -> ${latest.currentState}`);
    record(created.auditEvent);
  }

  async function uploadLocalFile(file: File, parentId: string) {
    setActionMessage(`正在上传 ${file.name}...`);
    const form = new FormData();
    form.set('file', file);
    form.set('moduleId', spec.id);
    form.set('parentId', parentId);
    form.set('owner', '当前用户');
    form.set('tags', 'local-upload');

    const response = await fetch('/api/local-files/upload', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    const payload = (await response.json()) as { file: LocalFileMetadata };
    const localResult = moduleBackendAdapter.uploadLocalFile(payload.file, parentId);
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
          kind: 'file',
          mimeType: payload.file.mimeType,
          sizeBytes: payload.file.size,
          owner: payload.file.owner,
          tags: Array.from(
            new Set([...payload.file.tags, 'backend-cde', 'local-upload']),
          ),
          checksum: payload.file.checksum,
        });
        const backendResult = moduleBackendAdapter.upsertModuleFileFromBackend(
          backendNode,
        );
        visibleNode = backendResult.node;
        backendSynced = true;
        onAudit?.(backendResult.auditEvent);
      } catch (error) {
        backendSyncError = backendErrorSummary(error);
      }
    }

    setSelectedNodeId(visibleNode.id);
    setPreviewNode(visibleNode);
    setFullView(true);
    setActionMessage(
      backendSynced
        ? `${payload.file.originalName} 已写入本地运行目录并同步后端 CDE。`
        : backendSyncError
          ? `上传已保留本地索引，后端 CDE 同步失败: ${backendSyncError}`
        : `${payload.file.originalName} 已进入文件系统、Schema 校验和审批事务。`,
    );
    setSnapshot(moduleBackendAdapter.snapshot(spec.id));
  }

  function handleUploaded(node: ModuleFileNode, metadata: LocalFileMetadata) {
    setSelectedNodeId(node.id);
    setPreviewNode(node);
    setFullView(true);
    setActionMessage(`${metadata.originalName} 已写入本地运行目录并绑定 ${spec.zhName}。`);
    refresh();
  }

  function handleContextAction(action: FileContextAction, node: ModuleFileNode | null) {
    setContextMenu(null);
    const target = node ?? currentFolder;

    if (action === 'open' && target) {
      openNode(target);
      return;
    }
    if (action === 'view' && target) {
      viewNode(target, true);
      return;
    }
    if (action === 'properties' && target) {
      const result = moduleBackendAdapter.getProperties(target.id);
      setSelectedNodeId(result.node.id);
      setPreviewNode(result.node);
      setFullView(true);
      setActionMessage(`属性面板已打开: ${result.node.name}`);
      record(result.auditEvent);
      return;
    }
    if (action === 'history' && target) {
      const result = moduleBackendAdapter.getProperties(target.id);
      setSelectedNodeId(result.node.id);
      setActionMessage(`版本 / 审计已定位: ${result.node.name} · ${result.node.auditTrail.length} 条记录`);
      record(result.auditEvent);
      return;
    }
    if (action === 'validate' && target) {
      runFileLifecycle(target, 'Schema 校验', [
        'submit',
        'generate',
        'evaluate',
        'rule_check',
        'validate_schema',
      ]);
      return;
    }
    if (action === 'submit_approval' && target) {
      runFileLifecycle(target, '提交审批', [
        'submit',
        'generate',
        'evaluate',
        'rule_check',
        'validate_schema',
        'request_approval',
      ]);
      return;
    }
    if (action === 'archive' && target) {
      runFileLifecycle(target, '归档', [
        'submit',
        'generate',
        'evaluate',
        'rule_check',
        'validate_schema',
        'request_approval',
        'approve',
        'archive',
      ]);
      return;
    }
    if (action === 'duplicate' && target) {
      const copyResult = moduleBackendAdapter.copyFile(target.id);
      const parentId = target.parentId ?? currentFolderId;
      const pasteResult = moduleBackendAdapter.pasteFile(spec.id, parentId);
      setSelectedNodeId(pasteResult.nodes[0]?.id ?? target.id);
      setActionMessage(pasteResult.nodes[0] ? `已创建副本: ${pasteResult.nodes[0].name}` : '复制副本失败: 剪贴板为空');
      onAudit?.(copyResult.auditEvent);
      record(pasteResult.auditEvent);
      return;
    }
    if (action === 'download' && target) {
      const result = moduleBackendAdapter.downloadFile(target.id);
      setActionMessage(`下载任务已创建: ${result.job.fileName}`);
      record(result.auditEvent);
      return;
    }
    if (action === 'copy' && target) {
      const result = moduleBackendAdapter.copyFile(target.id);
      setActionMessage(`已复制到剪贴板: ${result.clipboard.sourceName}`);
      record(result.auditEvent);
      return;
    }
    if (action === 'paste') {
      const parentId = target?.type === 'folder' ? target.id : currentFolderId;
      const result = moduleBackendAdapter.pasteFile(spec.id, parentId);
      setActionMessage(result.nodes.length > 0 ? '已粘贴副本。' : '剪贴板为空，粘贴未执行。');
      record(result.auditEvent);
      return;
    }

    if (
      action === 'new' ||
      action === 'upload' ||
      action === 'move' ||
      action === 'share' ||
      action === 'delete' ||
      action === 'rename'
    ) {
      setDialogTarget(target);
      setDialogMode(action);
    }
  }

  async function confirmDialog(payload: FileDialogPayload) {
    const parentId = dialogTarget?.type === 'folder' ? dialogTarget.id : currentFolderId;
    const name = payload.name?.trim();
    const parentIsBackendWritable =
      parentId === rootId || isBackendModuleFileId(parentId);

    if (dialogMode === 'new') {
      const nodeType = payload.nodeType ?? 'folder';
      const nodeName = name || (nodeType === 'file' ? '新建文件.md' : '新建文件夹');
      let handled = false;
      if (parentIsBackendWritable) {
        try {
          const backendNode = await moduleFileApiClient.createModuleFile({
            moduleId: spec.id,
            parentId,
            name: nodeName,
            kind: nodeType,
            owner: '当前用户',
            tags: [nodeType, 'frontend-cde'],
          });
          const result = moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setSelectedNodeId(result.node.id);
          setActionMessage(`已写入后端 CDE 并新建 ${result.node.type === 'folder' ? '文件夹' : '文件'}: ${result.node.name}`);
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
        setSelectedNodeId(result.node.id);
        setActionMessage(`已新建 ${result.node.type === 'folder' ? '文件夹' : '文件'}: ${result.node.name}`);
        record(result.auditEvent);
      }
    }
    if (dialogMode === 'upload') {
      if (payload.file) {
        await uploadLocalFile(payload.file, parentId);
      } else {
        setActionMessage('未选择真实本地文件，上传未执行。');
      }
    }
    if (dialogMode === 'move' && dialogTarget && payload.targetParentId) {
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
              actor: 'FileExplorer',
            },
          );
          const result = moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setSelectedNodeId(result.node.id);
          setActionMessage(`已移动并同步后端 CDE: ${result.node.name}`);
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          setActionMessage(`移动未写入后端 CDE: ${backendErrorSummary(error)}`);
          handled = true;
        }
      } else if (isBackendBackedNode(dialogTarget)) {
        setActionMessage('移动未执行: 目标目录不是后端 CDE 节点。');
        handled = true;
      }
      if (!handled) {
        const result = moduleBackendAdapter.moveFile(dialogTarget.id, payload.targetParentId);
        setSelectedNodeId(result.node.id);
        setActionMessage(`已移动: ${result.node.name}`);
        record(result.auditEvent);
      }
    }
    if (dialogMode === 'rename' && dialogTarget && name) {
      let handled = false;
      if (isBackendBackedNode(dialogTarget)) {
        try {
          const backendNode = await moduleFileApiClient.updateModuleFile(
            dialogTarget.id,
            { name },
          );
          const result = moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setSelectedNodeId(result.node.id);
          setActionMessage(`已重命名并同步后端 CDE: ${result.node.name}`);
          record(result.auditEvent);
          handled = true;
        } catch (error) {
          setActionMessage(`重命名未写入后端 CDE: ${backendErrorSummary(error)}`);
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
    if (dialogMode === 'share' && dialogTarget) {
      let handled = false;
      if (isBackendBackedNode(dialogTarget)) {
        try {
          const share = await moduleFileApiClient.shareModuleFile(
            dialogTarget.id,
            ['read', 'share'],
            'FileExplorer',
          );
          const backendNode = await moduleFileApiClient.getModuleFile(dialogTarget.id);
          const result = moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
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
    if (dialogMode === 'delete' && dialogTarget) {
      if (dialogTarget.localFileId) {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(dialogTarget.localFileId)}`,
          { method: 'DELETE' },
        );
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed: ${response.status}`);
        }
      }
      let handled = false;
      if (isBackendBackedNode(dialogTarget)) {
        try {
          const backendNode = await moduleFileApiClient.trashModuleFile(dialogTarget.id);
          const result = moduleBackendAdapter.upsertModuleFileFromBackend(backendNode);
          setSelectedNodeId((current) => (current === dialogTarget.id ? null : current));
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
        setSelectedNodeId((current) => (current === dialogTarget.id ? null : current));
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
    <section className="arch-surface flex h-full min-h-0 flex-col overflow-hidden border-0">
      <header className="arch-huly-workbench-header flex flex-col gap-2 border-b px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="arch-primary-text arch-type-caption font-black">ArchIToken CDE</p>
          <h2 className="arch-text mt-0.5 truncate arch-type-page font-black">
            {spec.zhName} · {currentFolder?.name ?? '模块根目录'}
          </h2>
          <p className="arch-muted mt-0.5 truncate arch-type-caption">
            {actionMessage}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolButton icon={<FolderOpen className="h-4 w-4" />} label="业务目录" onClick={() => setDirectoryPickerOpen(true)} variant="ghost" />
          <ToolButton icon={<FolderPlus className="h-4 w-4" />} label="新建" onClick={() => { setDialogTarget(currentFolder); setDialogMode('new'); }} />
          <LocalFileUploader
            moduleId={spec.id}
            parentId={currentFolderId}
            compact
            onUploaded={handleUploaded}
            onAudit={record}
          />
          <ToolButton icon={<RefreshCw className="h-4 w-4" />} label="刷新" onClick={refresh} variant="ghost" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <main className="flex h-full min-w-0 flex-col">
          <div className="arch-huly-commandbar flex flex-col gap-2 border-b px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 arch-type-body">
              <button
                type="button"
                onClick={() => setDirectoryPickerOpen(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 arch-type-caption font-black text-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)]"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                业务目录
              </button>
              <button
                type="button"
                onClick={goParent}
                className="arch-btn inline-flex items-center gap-1 rounded-md px-3 py-2 arch-type-caption font-black"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                上一级
              </button>
              {breadcrumbs.map((crumb, index) => (
                <button
                  key={crumb.id}
                  type="button"
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className="truncate rounded px-1.5 py-1 arch-type-caption font-bold text-[var(--arch-text)] hover:bg-[var(--arch-primary-soft)]"
                >
                  {index > 0 ? '/ ' : ''}
                  {crumb.name}
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="arch-input flex min-w-[220px] flex-1 items-center gap-2 rounded-md px-3 py-2 xl:min-w-72">
                <Search className="arch-muted h-4 w-4" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="全局搜索文件、模型、审批证据..."
                  className="arch-text w-full bg-transparent arch-type-body outline-none placeholder:opacity-60"
                />
              </label>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex h-10 w-10 items-center justify-center rounded-md border ${viewMode === 'list' ? 'arch-huly-row-selected' : 'arch-btn'}`}
                aria-label="列表视图"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex h-10 w-10 items-center justify-center rounded-md border ${viewMode === 'grid' ? 'arch-huly-row-selected' : 'arch-btn'}`}
                aria-label="卡片视图"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="arch-huly-main-stage min-h-0 flex-1 overflow-y-auto"
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, node: currentFolder });
            }}
            onClick={() => setContextMenu(null)}
          >
            {businessHome && !normalizedSearch && currentFolderId === rootId ? (
              <div className="min-h-full p-3">
                <div className="grid min-h-full w-full gap-3">
                  <div className="min-w-0">{businessHome}</div>
                  <section className="arch-huly-file-dock min-w-0 overflow-hidden rounded-md border">
                    <div className="flex items-center justify-between border-b border-[var(--arch-border)] px-3 py-2">
                      <div>
                        <p className="arch-primary-text arch-type-caption font-black">数据库文件</p>
                        <p className="arch-muted arch-type-caption">{uploadedCount} 本地文件 · {visibleNodes.length} 项</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDirectoryPickerOpen(true)}
                        className="arch-btn rounded-md px-2 py-1 arch-type-caption font-bold"
                      >
                        选择目录
                      </button>
                    </div>
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
                  </section>
                </div>
              </div>
            ) : viewMode === 'list' ? (
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

          <footer className="arch-huly-statusbar grid gap-1 border-t px-3 py-1 arch-type-caption md:grid-cols-3">
            <span>剪贴板: {snapshot.clipboard?.sourceName ?? '空'}</span>
            <span>下载任务: {snapshot.downloadJobs.length}</span>
            <span>选中: {selectedNode?.name ?? '未选择'}</span>
          </footer>
        </main>
      </div>

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
            const target = snapshot.files.find((file) => file.id === parentId) ?? currentFolder;
            setDialogTarget(target);
            setDialogMode('new');
            setDirectoryPickerOpen(false);
          }}
          onCreateChild={() => {
            setDialogTarget(currentFolder);
            setDialogMode('new');
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
        onClose={() => {
          setPreviewNode(null);
          setFullView(false);
        }}
        onFullView={() => setFullView(true)}
      />

      <FileOperationDialog
        key={`${dialogMode ?? 'closed'}-${dialogTarget?.id ?? currentFolderId}`}
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
  const root = folders.find((folder) => folder.id === rootId) ?? folders[0] ?? null;

  return (
    <FloatingWindowFrame
      title={`${spec.zhName}业务目录`}
      eyebrow="Business directory"
      subtitle="选择目录，或在当前目录新建同级 / 子目录"
      icon={<FolderOpen className="h-4 w-4" />}
      onClose={onClose}
      defaultSize={{ width: 420, height: 620 }}
      minSize={{ width: 320, height: 360 }}
      placement="center"
      zIndex={90}
      bodyClassName="p-0"
      footerClassName="border-t border-[var(--arch-border)] p-2"
      footer={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateSibling}
            className="arch-btn flex-1 rounded-md px-3 py-2 arch-type-caption font-black"
          >
            新建同级目录
          </button>
          <button
            type="button"
            onClick={onCreateChild}
            className="arch-btn-primary flex-1 rounded-md px-3 py-2 arch-type-caption font-black"
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
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpen(folder)}
        className={`arch-huly-folder-node flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-[var(--arch-primary-soft)] ${
          depth === 0 ? 'is-root' : 'is-child'
        } ${
          currentFolderId === folder.id ? 'bg-[var(--arch-primary-soft)] text-[var(--arch-primary)]' : 'arch-text'
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <ChevronRight className={`h-3.5 w-3.5 ${children.length ? 'opacity-80' : 'opacity-0'}`} />
        <Folder className="h-4 w-4 shrink-0" />
        <span className="arch-huly-folder-name min-w-0 truncate">{folder.name}</span>
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
    version: 96,
  },
  rowHeight: 58,
};

function readFileListLayout(storageKey: string): FileListLayout {
  if (typeof window === 'undefined') return defaultFileListLayout;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultFileListLayout;
    const parsed = JSON.parse(raw) as Partial<FileListLayout>;
    const columnWidths = (parsed.columnWidths ?? {}) as Partial<FileListColumnWidths>;
    return {
      columnWidths: {
        name: clampPaneWidth(Number(columnWidths.name) || defaultFileListLayout.columnWidths.name, 280, 1200),
        size: clampPaneWidth(Number(columnWidths.size) || defaultFileListLayout.columnWidths.size, 72, 260),
        status: clampPaneWidth(Number(columnWidths.status) || defaultFileListLayout.columnWidths.status, 72, 260),
        version: clampPaneWidth(Number(columnWidths.version) || defaultFileListLayout.columnWidths.version, 72, 260),
      },
      rowHeight: clampPaneWidth(Number(parsed.rowHeight) || defaultFileListLayout.rowHeight, 42, 120),
    };
  } catch {
    return defaultFileListLayout;
  }
}

function writeFileListLayout(storageKey: string, layout: FileListLayout) {
  if (typeof window === 'undefined') return;
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
  layoutKey = 'global',
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onSelect: (node: ModuleFileNode) => void;
  onOpen: (node: ModuleFileNode) => void;
  onView: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
  layoutKey?: string;
}) {
  const storageKey = `architoken.file-list-layout.v1:${layoutKey}`;
  const initialLayout = readFileListLayout(storageKey);
  const [columnWidths, setColumnWidths] = useState(initialLayout.columnWidths);
  const [rowHeight, setRowHeight] = useState(initialLayout.rowHeight);

  if (nodes.length === 0) {
    return <EmptyFolder />;
  }

  const gridTemplateColumns = `34px ${columnWidths.name}px ${columnWidths.size}px ${columnWidths.status}px ${columnWidths.version}px`;
  const minWidth =
    34 +
    columnWidths.name +
    columnWidths.size +
    columnWidths.status +
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
        key === 'name' ? 280 : 72,
        key === 'name' ? 1200 : 260,
      );
      setColumnWidths((current) => {
        const next = { ...current, [key]: nextWidth };
        writeFileListLayout(storageKey, { columnWidths: next, rowHeight });
        return next;
      });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener(
      'pointerup',
      () => window.removeEventListener('pointermove', handlePointerMove),
      { once: true },
    );
  }

  function startRowResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight = rowHeight;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextHeight = clampPaneWidth(startHeight + moveEvent.clientY - startY, 42, 120);
      setRowHeight(nextHeight);
      writeFileListLayout(storageKey, { columnWidths, rowHeight: nextHeight });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener(
      'pointerup',
      () => window.removeEventListener('pointermove', handlePointerMove),
      { once: true },
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="arch-surface-muted grid border-b px-3 py-2 arch-type-caption font-black"
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
        <ResizableHeaderCell label="名称" onResize={(event) => startColumnResize('name', event)} />
        <ResizableHeaderCell label="大小" onResize={(event) => startColumnResize('size', event)} />
        <ResizableHeaderCell label="状态" onResize={(event) => startColumnResize('status', event)} />
        <ResizableHeaderCell label="版本" onResize={(event) => startColumnResize('version', event)} />
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
            if (node.type === 'folder') {
              onOpen(node);
            } else {
              onView(node);
            }
          }}
          onContextMenu={(event) => onContext(event, node)}
          className={`arch-huly-file-row grid w-full items-center border-b border-[var(--arch-border)] px-3 py-1 text-left transition hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id ? 'bg-[var(--arch-primary-soft)]' : ''
          } ${node.status === 'soft_deleted' ? 'opacity-55' : ''}`}
          style={{ gridTemplateColumns, minWidth, minHeight: rowHeight }}
        >
          <span className="arch-primary-text">{node.type === 'folder' ? <Folder className="h-5 w-5" /> : fileIcon(node)}</span>
          <span className="min-w-0">
            <span className="arch-huly-file-name arch-text block truncate">{node.name}</span>
            <span className="arch-muted mt-1 block truncate arch-type-caption">
              {node.owner} · {node.updatedAt} · {node.mimeType}
            </span>
          </span>
          <span className="arch-muted font-mono arch-type-caption">{formatModuleFileSize(node.size)}</span>
          <span>
            <StatusPill status={node.status} />
          </span>
          <span className="arch-muted font-mono arch-type-caption">{node.version}</span>
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
            if (node.type === 'folder') {
              onOpen(node);
            } else {
              onView(node);
            }
          }}
          onContextMenu={(event) => onContext(event, node)}
          className={`rounded-lg border p-4 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id ? 'arch-huly-row-selected' : 'arch-huly-row'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="arch-primary-soft flex h-11 w-11 items-center justify-center rounded-lg">
              {node.type === 'folder' ? <Folder className="h-5 w-5" /> : fileIcon(node)}
            </span>
            <StatusPill status={node.status} />
          </div>
          <h3 className="arch-huly-file-grid-title arch-text mt-4 truncate">{node.name}</h3>
          <p className="arch-muted mt-2 truncate arch-type-caption">{node.mimeType}</p>
          <p className="arch-muted mt-3 arch-type-caption">{formatModuleFileSize(node.size)} · {node.version}</p>
        </button>
      ))}
    </div>
  );
}

function EmptyFolder() {
  return (
    <div className="arch-muted flex min-h-80 flex-col items-center justify-center p-6 text-center">
      <Folder className="h-14 w-14" />
      <h3 className="arch-huly-empty-title arch-text mt-4 font-black">此文件夹为空</h3>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  variant = 'primary',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 arch-type-body font-black transition ${
        variant === 'primary'
          ? 'arch-btn-primary'
          : 'arch-btn'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: ModuleFileNode['status'] }) {
  return (
    <span className={`w-fit rounded-md px-2 py-1 arch-type-caption font-black ${statusClass(status)}`}>
      {statusLabels[status]}
    </span>
  );
}

function statusClass(status: ModuleFileNode['status']) {
  if (status === 'pending_approval' || status === 'schema_validating') {
    return 'bg-amber-100 text-amber-700';
  }
  if (status === 'soft_deleted') {
    return 'bg-red-100 text-red-700';
  }
  if (status === 'archived') {
    return 'arch-huly-row-muted';
  }
  return 'arch-chip';
}

function fileIcon(node: ModuleFileNode) {
  if (node.viewerKind === 'engineering' || node.mimeType.startsWith('model') || node.name.endsWith('.ifc') || node.name.endsWith('.glb')) {
    return <Box className="h-5 w-5" />;
  }
  if (node.status === 'downloading') {
    return <Download className="h-5 w-5" />;
  }
  return <FileText className="h-5 w-5" />;
}

function buildBreadcrumbs(files: ModuleFileNode[], folderId: string): ModuleFileNode[] {
  const result: ModuleFileNode[] = [];
  let cursor = files.find((file) => file.id === folderId) ?? null;
  while (cursor) {
    result.unshift(cursor);
    cursor = cursor.parentId ? files.find((file) => file.id === cursor?.parentId) ?? null : null;
  }
  return result;
}

function matchGlobalFileSearch(node: ModuleFileNode, normalizedSearch: string): boolean {
  return [
    node.name,
    node.owner,
    node.mimeType,
    node.status,
    node.version,
    node.id,
    node.parentId ?? '',
    node.localFile?.checksum ?? '',
    node.localFile?.tags.join(' ') ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch);
}

function clampPaneWidth(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function localFileNodeDedupeKey(node: ModuleFileNode): string | null {
  if (!node.localFile) {
    return null;
  }
  return localFileDedupeKey(node.localFile, node.parentId ?? '');
}

function localFileDedupeKey(file: LocalFileMetadata, parentId: string): string {
  return [
    file.moduleId,
    parentId,
    file.originalName,
    String(file.size),
    file.checksum,
  ].join('\u001f');
}

function inferLocalFileParentId(
  file: LocalFileMetadata,
  nodes: ModuleFileNode[],
  rootId: string,
): string {
  const ext = file.ext.toLowerCase();
  const folders = nodes.filter((node) => node.type === 'folder');
  const byName = (patterns: string[]) =>
    folders.find((folder) =>
      patterns.some((pattern) => folder.name.toLowerCase().includes(pattern)),
    )?.id;

  if (ext === '.ifc' || ext === '.ifczip' || ext === '.ids' || ext === '.bcfzip') {
    return byName(['ifc', 'bim', '模型']) ?? rootId;
  }
  if (ext === '.dwg' || ext === '.dxf' || ext === '.dgn') {
    return byName(['dwg', 'dxf', '图纸', 'cad']) ?? rootId;
  }
  if (['.step', '.stp', '.iges', '.igs', '.brep', '.stl'].includes(ext)) {
    return byName(['节点', '深化', '模型']) ?? rootId;
  }
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.tsv') {
    return byName(['工程量', 'boq', '清单', '成本']) ?? rootId;
  }
  if (ext === '.pdf' || ext === '.docx' || ext === '.doc' || ext === '.pptx') {
    return byName(['资料', '文档', '审批', '归档']) ?? rootId;
  }

  return rootId;
}
