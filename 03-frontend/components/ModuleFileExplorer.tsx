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
  Grid2X2,
  List,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { FileContextMenu, type FileContextAction } from '@/components/FileContextMenu';
import { FileOperationDialog, type FileDialogMode, type FileDialogPayload } from '@/components/FileOperationDialog';
import { FilePreviewDrawer } from '@/components/FilePreviewDrawer';
import { LocalFileUploader } from '@/components/LocalFileUploader';
import { moduleBackendAdapter, type ModuleBackendSnapshot } from '@/lib/module-backend-adapter';
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

type FileViewMode = 'list' | 'cards';

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

export function ModuleFileExplorer({
  spec,
  onAudit,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
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
  const [folderPaneWidth, setFolderPaneWidth] = useState(216);

  const currentFolder = snapshot.files.find((file) => file.id === currentFolderId) ?? null;
  const selectedNode = snapshot.files.find((file) => file.id === selectedNodeId) ?? previewNode;
  const childNodes = moduleBackendAdapter
    .listFiles(spec.id, currentFolderId)
    .filter((file) => file.name.toLowerCase().includes(search.trim().toLowerCase()));
  const folders = snapshot.files.filter((file) => file.type === 'folder');
  const breadcrumbs = buildBreadcrumbs(snapshot.files, currentFolderId);
  const uploadedCount = snapshot.files.filter((file) => file.source === 'local_upload').length;

  function refresh() {
    setSnapshot(moduleBackendAdapter.snapshot(spec.id));
  }

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
        moduleBackendAdapter.uploadLocalFile(file, parentId);
        existing.add(file.fileId);
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

  function record(event: ModuleAuditEvent) {
    onAudit?.(event);
    refresh();
  }

  function openNode(node: ModuleFileNode) {
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
    const result = moduleBackendAdapter.openFile(node.id);
    setSelectedNodeId(result.node.id);
    setPreviewNode(result.node);
    setFullView(asFullView);
    setActionMessage(`查看 ${result.node.name}`);
    record(result.auditEvent);
  }

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
    const result = moduleBackendAdapter.uploadLocalFile(payload.file, parentId);
    setSelectedNodeId(result.node.id);
    setPreviewNode(result.node);
    setFullView(true);
    setActionMessage(`${payload.file.originalName} 已进入文件系统、Schema 校验和审批事务。`);
    record(result.auditEvent);
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

    if (dialogMode === 'new') {
      const result = moduleBackendAdapter.createFile({
        moduleId: spec.id,
        parentId,
        name: name || (payload.nodeType === 'file' ? '新建文件.md' : '新建文件夹'),
        type: payload.nodeType ?? 'folder',
      });
      setSelectedNodeId(result.node.id);
      setActionMessage(`已新建 ${result.node.type === 'folder' ? '文件夹' : '文件'}: ${result.node.name}`);
      record(result.auditEvent);
    }
    if (dialogMode === 'upload') {
      if (payload.file) {
        await uploadLocalFile(payload.file, parentId);
      } else {
        const result = moduleBackendAdapter.uploadFile({
          moduleId: spec.id,
          parentId,
          name: name || 'uploaded-file.pdf',
        });
        setSelectedNodeId(result.node.id);
        setActionMessage(`已创建上传对象: ${result.node.name}`);
        record(result.auditEvent);
      }
    }
    if (dialogMode === 'move' && dialogTarget && payload.targetParentId) {
      const result = moduleBackendAdapter.moveFile(dialogTarget.id, payload.targetParentId);
      setSelectedNodeId(result.node.id);
      setActionMessage(`已移动: ${result.node.name}`);
      record(result.auditEvent);
    }
    if (dialogMode === 'rename' && dialogTarget && name) {
      const result = moduleBackendAdapter.renameFile(dialogTarget.id, name);
      setSelectedNodeId(result.node.id);
      setActionMessage(`已重命名为: ${result.node.name}`);
      record(result.auditEvent);
    }
    if (dialogMode === 'share' && dialogTarget) {
      const result = moduleBackendAdapter.shareFile(dialogTarget.id);
      setLastShareLink(result.link);
      setActionMessage(`分享链接已生成: ${result.link.fileName}`);
      record(result.auditEvent);
    }
    if (dialogMode === 'delete' && dialogTarget) {
      const result = moduleBackendAdapter.deleteFile(dialogTarget.id);
      setSelectedNodeId(result.node.id);
      setActionMessage(`${result.node.name} 已进入 soft_deleted 状态。`);
      record(result.auditEvent);
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

  function startFolderPaneResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = folderPaneWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setFolderPaneWidth(clampPaneWidth(startWidth + moveEvent.clientX - startX, 168, 380));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  const explorerGridStyle = {
    '--folder-pane-template': `${folderPaneWidth}px minmax(0,1fr)`,
  } as CSSProperties;

  return (
    <section className="arch-surface flex h-full min-h-0 flex-col overflow-hidden rounded-lg border">
      <header className="arch-surface-muted flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">ArchIToken CDE</p>
          <h2 className="arch-text mt-1 truncate text-xl font-black tracking-[-0.02em]">
            {spec.zhName} · {currentFolder?.name ?? '模块根目录'}
          </h2>
          <p className="arch-muted mt-1 truncate text-xs">
            {actionMessage}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[var(--folder-pane-template)]"
        style={explorerGridStyle}
      >
        <aside className="arch-surface-muted relative min-h-0 border-b p-2 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="arch-primary-text text-xs font-black">业务目录</p>
            <span className="arch-card rounded-md px-2 py-1 text-[11px] font-black">
              {uploadedCount} 本地文件
            </span>
          </div>
          <div className="space-y-1.5">
            {folders
              .filter((folder) => folder.parentId === rootId || folder.id === rootId)
              .map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => openNode(folder)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, node: folder });
                  }}
                  className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-md border px-2.5 py-2 text-left transition ${
                    currentFolderId === folder.id
                      ? 'arch-card-selected'
                      : 'border-transparent arch-card hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] hover:text-[var(--arch-primary)]'
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  <span className="truncate text-sm font-black">{folder.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-45" />
                </button>
              ))}
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整业务目录宽度"
            onPointerDown={startFolderPaneResize}
            className="absolute inset-y-0 right-[-4px] z-20 hidden w-2 cursor-ew-resize touch-none lg:block"
            title="拖动调整业务目录宽度"
          />
        </aside>

        <main className="flex min-w-0 flex-col">
          <div className="arch-border flex flex-col gap-3 border-b px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={goParent}
                className="arch-btn inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-black"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                上一级
              </button>
              {breadcrumbs.map((crumb, index) => (
                <button
                  key={crumb.id}
                  type="button"
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className="arch-chip truncate rounded-md px-2 py-1 text-xs font-bold"
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
                  placeholder="搜索文件、模型、审批证据..."
                  className="arch-text w-full bg-transparent text-sm outline-none placeholder:opacity-60"
                />
              </label>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex h-10 w-10 items-center justify-center rounded-md border ${viewMode === 'list' ? 'arch-card-selected' : 'arch-btn'}`}
                aria-label="列表视图"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex h-10 w-10 items-center justify-center rounded-md border ${viewMode === 'cards' ? 'arch-card-selected' : 'arch-btn'}`}
                aria-label="卡片视图"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto bg-[var(--arch-surface)]"
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, node: currentFolder });
            }}
            onClick={() => setContextMenu(null)}
          >
            {viewMode === 'list' ? (
              <FileList
                nodes={childNodes}
                selectedNodeId={selectedNodeId}
                onOpen={openNode}
                onView={(node) => viewNode(node, true)}
                onContext={(event, node) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ x: event.clientX, y: event.clientY, node });
                }}
              />
            ) : (
              <FileCardGrid
                nodes={childNodes}
                selectedNodeId={selectedNodeId}
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

          <footer className="arch-surface-muted grid gap-2 border-t px-4 py-2 text-xs md:grid-cols-3">
            <span>剪贴板: {snapshot.clipboard?.sourceName ?? '空'}</span>
            <span>下载任务: {snapshot.downloadJobs.length}</span>
            <span>选中: {selectedNode?.name ?? '未选择'}</span>
          </footer>
        </main>
      </div>

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

function FileList({
  nodes,
  selectedNodeId,
  onOpen,
  onView,
  onContext,
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onOpen: (node: ModuleFileNode) => void;
  onView: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
}) {
  if (nodes.length === 0) {
    return <EmptyFolder />;
  }

  return (
    <div>
      <div className="arch-surface-muted grid grid-cols-[38px_minmax(0,1fr)_120px_120px_96px] border-b px-4 py-2 text-xs font-black">
        <span />
        <span>名称</span>
        <span className="hidden sm:block">大小</span>
        <span className="hidden md:block">状态</span>
        <span className="hidden lg:block">版本</span>
      </div>
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(node);
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
          className={`grid w-full grid-cols-[38px_minmax(0,1fr)_120px_120px_96px] items-center border-b border-[var(--arch-border)] px-4 py-3 text-left text-sm transition hover:bg-[var(--arch-primary-soft)] ${
            selectedNodeId === node.id ? 'bg-[var(--arch-primary-soft)]' : ''
          } ${node.status === 'soft_deleted' ? 'opacity-55' : ''}`}
        >
          <span className="arch-primary-text">{node.type === 'folder' ? <Folder className="h-5 w-5" /> : fileIcon(node)}</span>
          <span className="min-w-0">
            <span className="arch-text block truncate font-black">{node.name}</span>
            <span className="arch-muted mt-1 block truncate text-xs">
              {node.owner} · {node.updatedAt} · {node.mimeType}
            </span>
          </span>
          <span className="arch-muted hidden font-mono text-xs sm:block">{formatModuleFileSize(node.size)}</span>
          <span className="hidden md:block">
            <StatusPill status={node.status} />
          </span>
          <span className="arch-muted hidden font-mono text-xs lg:block">{node.version}</span>
        </button>
      ))}
    </div>
  );
}

function FileCardGrid({
  nodes,
  selectedNodeId,
  onOpen,
  onView,
  onContext,
}: {
  nodes: ModuleFileNode[];
  selectedNodeId: string | null;
  onOpen: (node: ModuleFileNode) => void;
  onView: (node: ModuleFileNode) => void;
  onContext: (event: MouseEvent, node: ModuleFileNode) => void;
}) {
  if (nodes.length === 0) {
    return <EmptyFolder />;
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(node);
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
            selectedNodeId === node.id ? 'arch-card-selected' : 'arch-card'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="arch-primary-soft flex h-11 w-11 items-center justify-center rounded-lg">
              {node.type === 'folder' ? <Folder className="h-5 w-5" /> : fileIcon(node)}
            </span>
            <StatusPill status={node.status} />
          </div>
          <h3 className="arch-text mt-4 truncate text-base font-black">{node.name}</h3>
          <p className="arch-muted mt-2 truncate text-xs">{node.mimeType}</p>
          <p className="arch-muted mt-3 text-xs">{formatModuleFileSize(node.size)} · {node.version}</p>
        </button>
      ))}
    </div>
  );
}

function EmptyFolder() {
  return (
    <div className="arch-muted flex min-h-80 flex-col items-center justify-center p-6 text-center">
      <Folder className="h-14 w-14" />
      <h3 className="arch-text mt-4 text-xl font-black">此文件夹为空</h3>
      <p className="mt-2 text-sm">请新建文件夹或上传本地文件，上传后会进入生命周期和审批事务。</p>
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
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black transition ${
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
    <span className={`w-fit rounded-md px-2 py-1 text-[11px] font-black ${statusClass(status)}`}>
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
    return 'arch-card-muted';
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

function clampPaneWidth(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
