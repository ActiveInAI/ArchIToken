// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  Boxes,
  BrainCircuit,
  Calculator,
  CalendarDays,
  ChevronRight,
  Command,
  CreditCard,
  Factory,
  HardHat,
  Headphones,
  Library,
  Lightbulb,
  PencilRuler,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserCircle,
  Users,
  Workflow,
} from "lucide-react";
import { FloatingWindowFrame } from "@/components/FloatingWindowFrame";
import { ModuleDetailWorkbench } from "@/components/ModuleDetailWorkbench";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { moduleBackendAdapter } from "@/lib/module-backend-adapter";
import type { ModuleActionResult } from "@/lib/module-actions";
import {
  architokenFolderSelectionEventName,
  architokenOpenFileEventName,
  architokenPendingPlanningProjectSelectionKey,
  architokenPlanningProjectSelectionEventName,
  type ArchitokenFolderSelectionRequest,
  type ArchitokenOpenFileRequest,
  type ArchitokenPlanningProjectSelectionRequest,
} from "@/lib/module-dialog-events";
import {
  compareModuleFileNodes,
  getModuleRootId,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import {
  getModuleSpec,
  moduleSpecs,
  moduleStatusLabels,
  MODULE_TREE_GROUPS,
  type ModuleId,
} from "@/lib/module-registry";
import { renameProjectManagementProject } from "@/lib/project-management-data";

const moduleAccentClasses = [
  "arch-module-accent-blue",
  "arch-module-accent-red",
  "arch-module-accent-yellow",
  "arch-module-accent-green",
  "arch-module-accent-purple",
  "arch-module-accent-cyan",
  "arch-module-accent-orange",
] as const;
const hiddenWorkbenchScrollbarStyle: CSSProperties = {
  overscrollBehavior: "contain",
  scrollbarWidth: "none",
};

export function ModuleWorkbenchShell({
  initialModuleId,
  initialSidebarCompact = false,
  initialOpenDirectoryModuleIds = [],
}: {
  initialModuleId?: ModuleId;
  initialSidebarCompact?: boolean;
  initialOpenDirectoryModuleIds?: ModuleId[];
}) {
  const fallbackModuleId = initialModuleId ?? "construction_management";
  const selectedSpec = getModuleSpec(fallbackModuleId);
  const selectedRootFolderId = getModuleRootId(selectedSpec.id);
  const [query, setQuery] = useState("");
  const [sidebarCompact, setSidebarCompact] = useState(initialSidebarCompact);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [openDirectoryModuleIds, setOpenDirectoryModuleIds] = useState<
    ModuleId[]
  >(() => mergeModuleIds(initialOpenDirectoryModuleIds, [selectedSpec.id]));
  const [directoryState, setDirectoryState] = useState<{
    moduleId: ModuleId;
    activeFolderId: string;
    files: ModuleFileNode[];
  }>(() => ({
    moduleId: selectedSpec.id,
    activeFolderId: selectedRootFolderId,
    files: moduleBackendAdapter.snapshot(selectedSpec.id).files,
  }));
  const [expandedDirectoryState, setExpandedDirectoryState] = useState<{
    moduleId: ModuleId;
    folderIds: string[];
  }>(() => ({
    moduleId: selectedSpec.id,
    folderIds: [selectedRootFolderId],
  }));
  const [directoryContextMenu, setDirectoryContextMenu] = useState<{
    folder: ModuleFileNode;
    x: number;
    y: number;
  } | null>(null);
  const [renamingDirectory, setRenamingDirectory] = useState<{
    folderId: string;
    draftName: string;
  } | null>(null);

  const [auditEvents, setAuditEvents] = useState<
    ModuleActionResult["auditEvent"][]
  >([]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = normalizedQuery
    ? moduleSpecs.filter((spec) =>
        [spec.id, spec.zhName, spec.enName, spec.summary, spec.track]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : moduleSpecs;
  const moduleById = new Map(
    moduleSpecs.map((spec) => [spec.id, spec] as const),
  );
  const visibleOpenDirectoryModuleIds = mergeModuleIds(
    openDirectoryModuleIds,
    [selectedSpec.id],
  );

  useEffect(() => {
    function handleFolderSelection(event: Event) {
      const detail = (event as CustomEvent<ArchitokenFolderSelectionRequest>)
        .detail;
      if (detail.moduleId !== selectedSpec.id) return;
      setDirectoryState({
        moduleId: detail.moduleId,
        activeFolderId: detail.folderId,
        files: moduleBackendAdapter.snapshot(detail.moduleId).files,
      });
      setOpenDirectoryModuleIds((current) =>
        persistOpenDirectoryModuleIds(
          mergeModuleIds(current, [detail.moduleId]),
        ),
      );
      const files = moduleBackendAdapter.snapshot(detail.moduleId).files;
      const pathFolderIds = getFolderAncestorIds(files, detail.folderId, false);
      setExpandedDirectoryState((current) => ({
        moduleId: detail.moduleId,
        folderIds:
          current.moduleId === detail.moduleId
            ? mergeFolderIds(current.folderIds, pathFolderIds)
            : pathFolderIds,
      }));
    }

    window.addEventListener(
      architokenFolderSelectionEventName,
      handleFolderSelection,
    );
    return () => {
      window.removeEventListener(
        architokenFolderSelectionEventName,
        handleFolderSelection,
      );
    };
  }, [selectedSpec.id]);

  useEffect(() => {
    if (!directoryContextMenu) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDirectoryContextMenu(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [directoryContextMenu]);

  function openFolderFromModuleNav(
    folder: ModuleFileNode,
    shouldExpand: boolean,
  ) {
    setDirectoryContextMenu(null);
    const files = moduleBackendAdapter.snapshot(folder.moduleId).files;
    setDirectoryState({
      moduleId: folder.moduleId,
      activeFolderId: folder.id,
      files,
    });
    setOpenDirectoryModuleIds((current) =>
      persistOpenDirectoryModuleIds(mergeModuleIds(current, [folder.moduleId])),
    );
    setExpandedDirectoryState((current) => {
      const ancestorIds = getFolderAncestorIds(files, folder.id);
      const baseIds =
        current.moduleId === folder.moduleId
          ? mergeFolderIds(current.folderIds, ancestorIds)
          : ancestorIds;
      return {
        moduleId: folder.moduleId,
        folderIds: shouldExpand
          ? mergeFolderIds(baseIds, [folder.id])
          : baseIds.filter((folderId) => folderId !== folder.id),
      };
    });
    if (isPlanningProjectNavFolder(folder)) {
      const planningRequest = buildPlanningProjectSelectionRequest(folder);
      window.sessionStorage.setItem(
        architokenPendingPlanningProjectSelectionKey,
        JSON.stringify(planningRequest),
      );
      const rootRequest: ArchitokenOpenFileRequest = {
        fileId: getModuleRootId(folder.moduleId),
        moduleId: folder.moduleId,
        query: planningRequest.projectName,
        requestedAt: planningRequest.requestedAt,
      };
      window.dispatchEvent(
        new CustomEvent(architokenOpenFileEventName, { detail: rootRequest }),
      );
      setDirectoryState({
        moduleId: folder.moduleId,
        activeFolderId: folder.id,
        files: moduleBackendAdapter.snapshot(folder.moduleId).files,
      });
      window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent(architokenPlanningProjectSelectionEventName, {
            detail: planningRequest,
          }),
        );
      });
      return;
    }
    const request: ArchitokenOpenFileRequest = {
      fileId: folder.id,
      moduleId: folder.moduleId,
      query: folder.name,
      requestedAt: new Date().toISOString(),
    };
    window.dispatchEvent(
      new CustomEvent(architokenOpenFileEventName, { detail: request }),
    );
  }

  function beginDirectoryRename(folder: ModuleFileNode) {
    setDirectoryContextMenu(null);
    setRenamingDirectory({
      folderId: folder.id,
      draftName: folder.name,
    });
  }

  function updateDirectoryRenameDraft(folderId: string, draftName: string) {
    setRenamingDirectory((current) =>
      current?.folderId === folderId ? { folderId, draftName } : current,
    );
  }

  function cancelDirectoryRename() {
    setRenamingDirectory(null);
  }

  function commitDirectoryRename(folder: ModuleFileNode, draftName: string) {
    const nextName = draftName.trim();
    setRenamingDirectory(null);
    if (!nextName || nextName === folder.name) {
      return;
    }

    const planningProject = isPlanningProjectNavFolder(folder);
    if (planningProject) {
      renameProjectManagementProject(
        buildPlanningProjectSelectionRequest(folder).projectId,
        nextName,
      );
    }

    try {
      const result = moduleBackendAdapter.renameFile(folder.id, nextName);
      setAuditEvents((current) => [result.auditEvent, ...current].slice(0, 12));
    } catch {
      // Project records can be regenerated from project management storage.
    }

    const files = moduleBackendAdapter.snapshot(folder.moduleId).files;
    const renamedFolder = files.find((file) => file.id === folder.id) ?? {
      ...folder,
      name: nextName,
    };
    setDirectoryState({
      moduleId: folder.moduleId,
      activeFolderId: folder.id,
      files,
    });

    if (planningProject) {
      const request = buildPlanningProjectSelectionRequest({
        ...renamedFolder,
        name: nextName,
      });
      window.sessionStorage.setItem(
        architokenPendingPlanningProjectSelectionKey,
        JSON.stringify(request),
      );
      window.dispatchEvent(
        new CustomEvent(architokenPlanningProjectSelectionEventName, {
          detail: request,
        }),
      );
    }
  }

  function openDirectoryContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    folder: ModuleFileNode,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDirectoryContextMenu({
      folder,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleAudit(event: ModuleActionResult["auditEvent"]) {
    setAuditEvents((current) => [event, ...current].slice(0, 12));
  }

  function toggleSidebarCompact() {
    setSidebarCompact((current) => {
      const next = !current;
      document.cookie = `architoken.moduleSidebarCompact=${String(next)}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  function markModuleDirectoryOpen(moduleId: ModuleId) {
    setOpenDirectoryModuleIds((current) =>
      persistOpenDirectoryModuleIds(mergeModuleIds(current, [moduleId])),
    );
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setSidebarWidth(
        clampNumber(startWidth + moveEvent.clientX - startX, 220, 420),
      );
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function getModuleDirectoryModel(spec: (typeof moduleSpecs)[number]) {
    const rootId = getModuleRootId(spec.id);
    const files =
      directoryState.moduleId === spec.id
        ? directoryState.files
        : moduleBackendAdapter.snapshot(spec.id).files;
    return {
      rootId,
      folders: files.filter(
        (file) =>
          file.type === "folder" &&
          file.status !== "soft_deleted" &&
          shouldShowModuleDirectoryFolder(spec.id, file, rootId),
      ),
      activeFolderId:
        directoryState.moduleId === spec.id
          ? directoryState.activeFolderId
          : rootId,
      expandedFolderIds:
        expandedDirectoryState.moduleId === spec.id
          ? expandedDirectoryState.folderIds
          : [rootId],
    };
  }

  function renderModuleDirectory(spec: (typeof moduleSpecs)[number]) {
    if (!visibleOpenDirectoryModuleIds.includes(spec.id)) {
      return null;
    }
    const model = getModuleDirectoryModel(spec);
    return (
      <ModuleContextDirectoryTree
        spec={spec}
        accentClass={moduleAccentClass(spec.order)}
        folders={model.folders}
        rootId={model.rootId}
        activeFolderId={model.activeFolderId}
        expandedFolderIds={model.expandedFolderIds}
        renamingDirectory={renamingDirectory}
        onOpenFolder={openFolderFromModuleNav}
        onContextFolder={openDirectoryContextMenu}
        onBeginRename={beginDirectoryRename}
        onRenameDraftChange={updateDirectoryRenameDraft}
        onCommitRename={commitDirectoryRename}
        onCancelRename={cancelDirectoryRename}
      />
    );
  }

  function hasDirectoryChildren(folder: ModuleFileNode) {
    const spec = moduleById.get(folder.moduleId);
    const folders = spec
      ? getModuleDirectoryModel(spec).folders
      : moduleBackendAdapter
          .snapshot(folder.moduleId)
          .files.filter(
            (file) => file.type === "folder" && file.status !== "soft_deleted",
          );
    return getFolderChildren(folders, folder.id).length > 0;
  }

  const shellGridStyle = {
    "--module-sidebar-template": sidebarCompact ? "44px" : `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <main className="arch-app h-[100dvh] w-screen overflow-hidden">
      <div
        className="grid h-full min-h-0 grid-cols-[var(--module-sidebar-template)_minmax(0,1fr)]"
        style={shellGridStyle}
      >
        <aside
          className={`arch-huly-context relative flex min-h-0 flex-col overflow-hidden border-r ${
            sidebarCompact ? "is-compact" : ""
          }`}
        >
          <div className="arch-huly-context-header">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebarCompact}
                className="arch-huly-workspace-mark"
                aria-pressed={sidebarCompact}
                aria-label={sidebarCompact ? "展开模块目录" : "仅显示模块图标"}
                title={sidebarCompact ? "展开模块目录" : "仅显示模块图标"}
              >
                A
              </button>
              {sidebarCompact ? null : (
                <div className="min-w-0">
                  <h1 className="arch-text truncate arch-type-body font-medium">
                    ArchIToken
                  </h1>
                </div>
              )}
            </div>
            {sidebarCompact ? null : (
              <div className="flex shrink-0 items-center gap-1">
                <Command className="arch-muted h-4 w-4 shrink-0" />
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  className="arch-huly-icon-button"
                  aria-label="打开审计抽屉"
                  title="审计"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {sidebarCompact ? null : (
            <div className="px-2 pb-2">
              <label className="arch-huly-search">
                <Search className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索模块、工作流、标准"
                  className="min-w-0 flex-1 bg-transparent arch-type-caption outline-none placeholder:opacity-60"
                />
              </label>
            </div>
          )}

          <nav
            className={`arch-huly-context-nav min-h-0 flex-1 overflow-y-auto pb-3 ${
              sidebarCompact ? "px-1" : "px-2"
            }`}
            style={hiddenWorkbenchScrollbarStyle}
          >
            {sidebarCompact ? (
              <div className="grid gap-1">
                {moduleSpecs.map((spec) => (
                  <ModuleNavItem
                    key={spec.id}
                    spec={spec}
                    selected={spec.id === selectedSpec.id}
                    compact={sidebarCompact}
                    accentClass={moduleAccentClass(spec.order)}
                    onModuleClick={markModuleDirectoryOpen}
                  />
                ))}
              </div>
            ) : normalizedQuery ? (
              <div className="grid gap-1">
                {filteredModules.map((spec) => (
                  <div key={spec.id} className="grid gap-1">
                    <ModuleNavItem
                      spec={spec}
                      selected={spec.id === selectedSpec.id}
                      compact={sidebarCompact}
                      accentClass={moduleAccentClass(spec.order)}
                      onModuleClick={markModuleDirectoryOpen}
                    />
                    {renderModuleDirectory(spec)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {MODULE_TREE_GROUPS.map((group) => (
                  <section key={group.id} className="space-y-1">
                    <p className="arch-huly-group-label">{group.title}</p>
                    <div className="grid gap-1">
                      {group.modules.map((moduleId) => {
                        const spec = moduleById.get(moduleId);
                        if (!spec) return null;
                        return (
                          <div key={spec.id} className="grid gap-1">
                            <ModuleNavItem
                              spec={spec}
                              selected={spec.id === selectedSpec.id}
                              compact={sidebarCompact}
                              accentClass={moduleAccentClass(spec.order)}
                              onModuleClick={markModuleDirectoryOpen}
                            />
                            {renderModuleDirectory(spec)}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </nav>

          {sidebarCompact ? null : (
            <div className="arch-huly-context-footer">
              <ThemeSwitcher />
            </div>
          )}
          {sidebarCompact ? null : (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整模块导航栏宽度"
              onPointerDown={startSidebarResize}
              className="absolute inset-y-0 right-[-4px] z-20 hidden w-2 cursor-ew-resize touch-none lg:block"
              title="拖动调整模块导航栏宽度"
            />
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="arch-app min-h-0 flex-1 overflow-hidden p-0">
            <ModuleDetailWorkbench
              key={selectedSpec.id}
              spec={selectedSpec}
              onAudit={handleAudit}
            />
          </div>
        </section>
      </div>

      {directoryContextMenu ? (
        <ModuleDirectoryContextMenu
          folder={directoryContextMenu.folder}
          x={directoryContextMenu.x}
          y={directoryContextMenu.y}
          onOpen={(folder) =>
            openFolderFromModuleNav(folder, hasDirectoryChildren(folder))
          }
          onRename={beginDirectoryRename}
          onCopyName={(folder) => {
            void navigator.clipboard?.writeText(folder.name);
            setDirectoryContextMenu(null);
          }}
          onClose={() => setDirectoryContextMenu(null)}
        />
      ) : null}

      {inspectorOpen ? (
        <InspectorDrawer
          selectedSpec={selectedSpec}
          auditEvents={auditEvents}
          onClose={() => setInspectorOpen(false)}
        />
      ) : null}
    </main>
  );
}

function ModuleContextDirectoryTree({
  spec,
  accentClass,
  folders,
  rootId,
  activeFolderId,
  expandedFolderIds,
  renamingDirectory,
  onOpenFolder,
  onContextFolder,
  onBeginRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
}: {
  spec: (typeof moduleSpecs)[number];
  accentClass: string;
  folders: ModuleFileNode[];
  rootId: string;
  activeFolderId: string;
  expandedFolderIds: string[];
  renamingDirectory: { folderId: string; draftName: string } | null;
  onOpenFolder: (folder: ModuleFileNode, shouldExpand: boolean) => void;
  onContextFolder: (
    event: ReactMouseEvent<HTMLButtonElement>,
    folder: ModuleFileNode,
  ) => void;
  onBeginRename: (folder: ModuleFileNode) => void;
  onRenameDraftChange: (folderId: string, draftName: string) => void;
  onCommitRename: (folder: ModuleFileNode, draftName: string) => void;
  onCancelRename: () => void;
}) {
  const root = folders.find((folder) => folder.id === rootId) ?? null;
  const rootChildren = root ? getFolderChildren(folders, root.id) : [];
  const expanded = new Set(expandedFolderIds);

  if (!root || rootChildren.length === 0) {
    return null;
  }

  return (
    <div
      className={`arch-huly-module-directory ${accentClass}`}
      style={hiddenWorkbenchScrollbarStyle}
      aria-label={`${spec.zhName}业务目录`}
    >
      <div className="grid gap-0.5">
        {rootChildren.map((folder) => (
          <ModuleContextFolderNode
            key={folder.id}
            folder={folder}
            folders={folders}
            activeFolderId={activeFolderId}
            expandedFolderIds={expanded}
            renamingDirectory={renamingDirectory}
            depth={0}
            onOpenFolder={onOpenFolder}
            onContextFolder={onContextFolder}
            onBeginRename={onBeginRename}
            onRenameDraftChange={onRenameDraftChange}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
          />
        ))}
      </div>
    </div>
  );
}

function ModuleContextFolderNode({
  folder,
  folders,
  activeFolderId,
  expandedFolderIds,
  renamingDirectory,
  depth,
  onOpenFolder,
  onContextFolder,
  onBeginRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
}: {
  folder: ModuleFileNode;
  folders: ModuleFileNode[];
  activeFolderId: string;
  expandedFolderIds: Set<string>;
  renamingDirectory: { folderId: string; draftName: string } | null;
  depth: number;
  onOpenFolder: (folder: ModuleFileNode, shouldExpand: boolean) => void;
  onContextFolder: (
    event: ReactMouseEvent<HTMLButtonElement>,
    folder: ModuleFileNode,
  ) => void;
  onBeginRename: (folder: ModuleFileNode) => void;
  onRenameDraftChange: (folderId: string, draftName: string) => void;
  onCommitRename: (folder: ModuleFileNode, draftName: string) => void;
  onCancelRename: () => void;
}) {
  const children = getFolderChildren(folders, folder.id);
  const hasChildren = children.length > 0;
  const expanded = expandedFolderIds.has(folder.id);
  const renaming = renamingDirectory?.folderId === folder.id;
  const nodeClassName = `arch-huly-module-directory-node ${
    activeFolderId === folder.id ? "is-active" : ""
  }`;
  const chevron = hasChildren ? (
    <ChevronRight
      className={`h-3.5 w-3.5 shrink-0 transition ${
        expanded ? "rotate-90 opacity-70" : "opacity-70"
      }`}
    />
  ) : (
    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0" aria-hidden />
  );

  return (
    <div>
      {renaming ? (
        <div className={nodeClassName} style={{ paddingLeft: depth * 14 }}>
          {chevron}
          <input
            value={renamingDirectory.draftName}
            autoFocus
            onChange={(event) =>
              onRenameDraftChange(folder.id, event.target.value)
            }
            onBlur={() => onCommitRename(folder, renamingDirectory.draftName)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename(folder, renamingDirectory.draftName);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            className="min-w-0 flex-1 rounded border border-[var(--arch-border-strong)] bg-white px-1 py-0.5 text-[12px] outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpenFolder(folder, hasChildren ? !expanded : false)}
          onContextMenu={(event) => onContextFolder(event, folder)}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onBeginRename(folder);
          }}
          className={nodeClassName}
          aria-expanded={hasChildren ? expanded : undefined}
          style={{ paddingLeft: depth * 14 }}
        >
          {chevron}
          <span className="min-w-0 truncate">{folder.name}</span>
        </button>
      )}
      {expanded
        ? children.map((child) => (
            <ModuleContextFolderNode
              key={child.id}
              folder={child}
              folders={folders}
              activeFolderId={activeFolderId}
              expandedFolderIds={expandedFolderIds}
              renamingDirectory={renamingDirectory}
              depth={depth + 1}
              onOpenFolder={onOpenFolder}
              onContextFolder={onContextFolder}
              onBeginRename={onBeginRename}
              onRenameDraftChange={onRenameDraftChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
            />
          ))
        : null}
    </div>
  );
}

function ModuleDirectoryContextMenu({
  folder,
  x,
  y,
  onOpen,
  onRename,
  onCopyName,
  onClose,
}: {
  folder: ModuleFileNode;
  x: number;
  y: number;
  onOpen: (folder: ModuleFileNode) => void;
  onRename: (folder: ModuleFileNode) => void;
  onCopyName: (folder: ModuleFileNode) => void;
  onClose: () => void;
}) {
  const left = Math.min(x, window.innerWidth - 188);
  const top = Math.min(y, window.innerHeight - 132);
  return (
    <div
      className="fixed inset-0 z-[80]"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={onClose}
    >
      <div
        className="fixed w-[180px] rounded-md border border-[var(--arch-border)] bg-white p-1 shadow-xl"
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="block w-full rounded px-3 py-2 text-left text-[12px] hover:bg-[var(--arch-bg-muted)]"
          onClick={() => onOpen(folder)}
        >
          打开 / 切换
        </button>
        <button
          type="button"
          className="block w-full rounded px-3 py-2 text-left text-[12px] hover:bg-[var(--arch-bg-muted)]"
          onClick={() => onRename(folder)}
        >
          重命名
        </button>
        <button
          type="button"
          className="block w-full rounded px-3 py-2 text-left text-[12px] hover:bg-[var(--arch-bg-muted)]"
          onClick={() => onCopyName(folder)}
        >
          复制名称
        </button>
      </div>
    </div>
  );
}

function getFolderChildren(folders: ModuleFileNode[], parentId: string) {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((left, right) => {
      const leftRank = getModuleDirectorySortRank(left);
      const rightRank = getModuleDirectorySortRank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return compareModuleFileNodes(left, right);
    });
}

function getModuleDirectorySortRank(folder: ModuleFileNode) {
  if (folder.tags.includes("planning-current-project")) return -10;
  return 0;
}

function isPlanningProjectNavFolder(folder: ModuleFileNode) {
  return (
    folder.moduleId === "planning_management" &&
    folder.parentId === getModuleRootId(folder.moduleId) &&
    (folder.tags.includes("planning-project") ||
      folder.tags.includes("managed-project") ||
      folder.source !== "seed")
  );
}

function buildPlanningProjectSelectionRequest(
  folder: ModuleFileNode,
): ArchitokenPlanningProjectSelectionRequest {
  const projectId =
    getPrefixedTagValue(folder, "project:") ??
    folder.tags.find((tag) => tag.startsWith("project-")) ??
    folder.id;
  return {
    projectId,
    projectName: folder.name,
    folderId: folder.id,
    startDate: getPrefixedTagValue(folder, "start:"),
    endDate: getPrefixedTagValue(folder, "end:"),
    location: getPrefixedTagValue(folder, "location:"),
    stage: getPrefixedTagValue(folder, "stage:"),
    requestedAt: new Date().toISOString(),
  };
}

function getPrefixedTagValue(folder: ModuleFileNode, prefix: string) {
  return folder.tags
    .find((tag) => tag.startsWith(prefix))
    ?.slice(prefix.length);
}

function shouldShowModuleDirectoryFolder(
  moduleId: ModuleId,
  folder: ModuleFileNode,
  rootId: string,
) {
  if (moduleId === "planning_management") {
    if (folder.id === rootId) return true;
    if (folder.parentId !== rootId) return false;
    return isPlanningProjectNavFolder(folder);
  }

  if (
    moduleId !== "digital_archive" ||
    folder.id === rootId ||
    folder.parentId !== rootId
  ) {
    return true;
  }
  return folder.tags.includes("project-archive");
}

function getFolderAncestorIds(
  folders: ModuleFileNode[],
  folderId: string,
  includeSelf = true,
) {
  const ids: string[] = [];
  let cursor = folders.find((folder) => folder.id === folderId) ?? null;

  while (cursor) {
    ids.unshift(cursor.id);
    cursor = cursor.parentId
      ? (folders.find((folder) => folder.id === cursor?.parentId) ?? null)
      : null;
  }

  if (!includeSelf && ids.length > 1) {
    ids.pop();
  }

  return ids;
}

function mergeFolderIds(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right]));
}

function mergeModuleIds(...groups: ModuleId[][]): ModuleId[] {
  const moduleIds = new Set(moduleSpecs.map((spec) => spec.id));
  const merged: ModuleId[] = [];
  for (const group of groups) {
    for (const moduleId of group) {
      if (!moduleIds.has(moduleId) || merged.includes(moduleId)) {
        continue;
      }
      merged.push(moduleId);
    }
  }
  return merged;
}

function persistOpenDirectoryModuleIds(moduleIds: ModuleId[]): ModuleId[] {
  const next = mergeModuleIds(moduleIds);
  document.cookie = `architoken.openModuleDirectoryIds=${encodeURIComponent(
    next.join(","),
  )}; path=/; max-age=31536000; samesite=lax`;
  return next;
}

function ModuleRailIcon({ moduleId }: { moduleId: ModuleId }) {
  const className = "h-4 w-4";
  const icons: Record<ModuleId, ReactNode> = {
    personal_center: <UserCircle className={className} />,
    marketing_service: <Headphones className={className} />,
    planning_management: <CalendarDays className={className} />,
    concept_design: <Lightbulb className={className} />,
    standard_library: <Library className={className} />,
    detailed_design: <PencilRuler className={className} />,
    quantity_costing: <Calculator className={className} />,
    material_logistics: <Truck className={className} />,
    production_manufacturing: <Factory className={className} />,
    construction_management: <HardHat className={className} />,
    digital_twin: <Boxes className={className} />,
    digital_archive: <Archive className={className} />,
    finance_management: <CreditCard className={className} />,
    human_resources: <Users className={className} />,
    ai_center: <BrainCircuit className={className} />,
    settings_center: <Settings className={className} />,
  };
  return icons[moduleId] ?? <Ruler className={className} />;
}

function ModuleNavItem({
  spec,
  selected,
  compact,
  accentClass,
  onModuleClick,
}: {
  spec: (typeof moduleSpecs)[number];
  selected: boolean;
  compact: boolean;
  accentClass: string;
  onModuleClick: (moduleId: ModuleId) => void;
}) {
  return (
    <Link
      href={spec.routeHref}
      prefetch={false}
      title={`${spec.zhName} · ${spec.id}`}
      aria-label={compact ? `${spec.zhName} · ${spec.id}` : undefined}
      onClick={(event) => {
        onModuleClick(spec.id);
        if (!selected) {
          return;
        }
        event.preventDefault();
      }}
      className={`arch-huly-nav-item ${accentClass} ${selected ? "is-active" : ""}`}
    >
      <span className="arch-huly-nav-icon" aria-hidden="true">
        <ModuleRailIcon moduleId={spec.id} />
      </span>
      {compact ? null : (
        <span className="arch-huly-nav-label min-w-0">
          <span className="arch-huly-nav-title block truncate">
            {spec.zhName}
          </span>
          <span className="arch-huly-nav-code arch-muted mt-0.5 block truncate font-mono">
            {spec.id}
          </span>
        </span>
      )}
    </Link>
  );
}

function moduleAccentClass(order: number): string {
  return (
    moduleAccentClasses[(order - 1) % moduleAccentClasses.length] ??
    moduleAccentClasses[0]
  );
}

function InspectorDrawer({
  selectedSpec,
  auditEvents,
  onClose,
}: {
  selectedSpec: ReturnType<typeof getModuleSpec>;
  auditEvents: ModuleActionResult["auditEvent"][];
  onClose: () => void;
}) {
  return (
    <FloatingWindowFrame
      title="审计 / 模块上下文"
      eyebrow="审计"
      subtitle={selectedSpec.zhName}
      icon={<ShieldCheck className="h-4 w-4" />}
      onClose={onClose}
      defaultSize={{ width: 460, height: 720 }}
      minSize={{ width: 340, height: 420 }}
      placement="right"
      zIndex={66}
      bodyClassName="p-3"
    >
      <section className="arch-huly-row-muted rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Workflow className="arch-primary-text h-4 w-4" />
          <h3 className="arch-text font-medium">{selectedSpec.zhName}</h3>
        </div>
        <div className="mt-3 space-y-2">
          <InfoRow
            label="状态"
            value={moduleStatusLabels[selectedSpec.status]}
          />
          <InfoRow label="Schema" value={selectedSpec.schemaRef} />
          <InfoRow label="Track" value={selectedSpec.track} />
        </div>
      </section>

      <section className="arch-huly-row mt-3 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="arch-primary-text arch-type-caption font-medium">
              审计面板
            </p>
            <h3 className="arch-text mt-1 font-medium">操作审计</h3>
          </div>
          <ShieldCheck className="arch-primary-text h-5 w-5" />
        </div>
        <div className="mt-4 space-y-2">
          {auditEvents.length === 0 ? (
            <p className="arch-huly-row-muted rounded-lg border border-dashed p-4 arch-type-body leading-6">
              文件、生命周期、审批、artifact 和 AI 操作都会写入这里。
            </p>
          ) : (
            auditEvents.map((event) => (
              <div
                key={event.id}
                className="arch-huly-row-muted rounded-lg p-3"
              >
                <p className="arch-text arch-type-body font-medium">
                  {event.summary}
                </p>
                <p className="arch-muted mt-2 arch-type-caption">
                  {event.actor} · {event.at}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </FloatingWindowFrame>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-huly-row flex items-start justify-between gap-3 rounded-md px-3 py-2 arch-type-caption">
      <span className="arch-muted">{label}</span>
      <span className="arch-text max-w-[70%] break-words text-right font-medium">
        {value}
      </span>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
