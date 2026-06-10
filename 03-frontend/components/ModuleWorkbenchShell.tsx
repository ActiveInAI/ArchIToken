// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
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
import { PanAIHostWindow } from "@/components/PanAIHostWindow";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { moduleBackendAdapter } from "@/lib/module-backend-adapter";
import type { ModuleActionResult } from "@/lib/module-actions";
import {
  architokenFolderSelectionEventName,
  architokenModuleFileTreeChangedEventName,
  architokenOpenFileEventName,
  architokenPanAIHostFileCreatedEventName,
  architokenPendingFolderSelectionKey,
  architokenPendingOpenFileKey,
  architokenPendingPlanningProjectSelectionKey,
  architokenPlanningProjectSelectionEventName,
  type ArchitokenFolderSelectionRequest,
  type ArchitokenModuleFileTreeChangedRequest,
  type ArchitokenOpenFileRequest,
  type ArchitokenPanAIHostFileCreatedRequest,
  type ArchitokenPlanningProjectSelectionRequest,
} from "@/lib/module-dialog-events";
import {
  compareModuleFileNodes,
  getModuleRootId,
  type ModuleAuditEvent,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import {
  getModuleSpec,
  moduleSpecs,
  moduleStatusLabels,
  MODULE_TREE_GROUPS,
  type ModuleId,
} from "@/lib/module-registry";
import { persistModuleOperationAudit } from "@/lib/module-transaction-api-client";
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
const panAILauncherSize = 52;
const panAILauncherMargin = 16;
const panAILauncherBottomReserve = 44;
const panAILauncherNarrowBottomReserve = 76;
const panAILauncherRightPanelReserve = 460;
const panAIHostOpenStorageKey = "architoken.panaiHostOpen";
const panAIHostMinimizedStorageKey = "architoken.panaiHostMinimized";
const openDirectoryModuleIdsStorageKey = "architoken.openModuleDirectoryIds";
const moduleSidebarScrollTopStorageKey = "architoken.moduleSidebarScrollTop";
const moduleSidebarDefaultWidth = 256;
const moduleSidebarMinWidth = 136;
const moduleSidebarMaxWidth = 420;
const moduleSidebarNarrowLabelWidth = 168;
type FolderExpansionIntent = "preserve" | "expand" | "collapse";

function subscribeClientReady() {
  return () => {};
}

function useClientReady() {
  return useSyncExternalStore(
    subscribeClientReady,
    () => true,
    () => false,
  );
}

function getInitialNarrowViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function ModuleWorkbenchShell({
  initialModuleId,
  initialSidebarCompact = false,
  initialOpenDirectoryModuleIds = null,
}: {
  initialModuleId?: ModuleId;
  initialSidebarCompact?: boolean;
  initialOpenDirectoryModuleIds?: ModuleId[] | null;
}) {
  const router = useRouter();
  const fallbackModuleId = initialModuleId ?? "construction_management";
  const selectedSpec = getModuleSpec(fallbackModuleId);
  const selectedRootFolderId = getModuleRootId(selectedSpec.id);
  const [query, setQuery] = useState("");
  const [sidebarCompact, setSidebarCompact] = useState(initialSidebarCompact);
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    getInitialNarrowViewport,
  );
  const [sidebarWidth, setSidebarWidth] = useState(moduleSidebarDefaultWidth);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [panAIHostOpen, setPanAIHostOpen] = useState(
    () => readStoredPanAIHostOpen() ?? false,
  );
  const [panAIHostMinimized, setPanAIHostMinimized] = useState(
    () => readStoredPanAIHostMinimized() ?? false,
  );
  const panAILauncherReady = useClientReady();
  const [panAILauncherPosition, setPanAILauncherPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const panAILauncherDragSuppressedRef = useRef(false);
  const panAIHostEventCursorRef = useRef(0);
  const contextNavRef = useRef<HTMLElement | null>(null);
  const sidebarScrollStateRef = useRef({
    current: 0,
    previous: 0,
    source: "programmatic" as "programmatic" | "user",
    updatedAt: 0,
  });
  const lastSidebarScrollInputAtRef = useRef(0);
  const [openDirectoryModuleIds, setOpenDirectoryModuleIds] = useState<
    ModuleId[]
  >(() => {
    const stored = readStoredOpenDirectoryModuleIds();
    if (stored) return stored;
    return initialOpenDirectoryModuleIds
      ? mergeModuleIds(initialOpenDirectoryModuleIds)
      : mergeModuleIds([selectedSpec.id]);
  });
  const [initialDirectorySelection] = useState(() =>
    readInitialDirectorySelection(selectedSpec.id, selectedRootFolderId),
  );
  const [directoryState, setDirectoryState] = useState<{
    moduleId: ModuleId;
    activeFolderId: string;
    files: ModuleFileNode[];
  }>(() => ({
    moduleId: initialDirectorySelection.moduleId,
    activeFolderId: initialDirectorySelection.activeFolderId,
    files: initialDirectorySelection.files,
  }));
  const [expandedDirectoryState, setExpandedDirectoryState] = useState<{
    moduleId: ModuleId;
    folderIds: string[];
  }>(() => ({
    moduleId: initialDirectorySelection.moduleId,
    folderIds: mergeFolderIds(
      [selectedRootFolderId],
      getFolderAncestorIds(
        initialDirectorySelection.files,
        initialDirectorySelection.activeFolderId,
        false,
      ),
    ),
  }));
  const [, setDirectoryRefreshTick] = useState(0);
  const [directoryContextMenu, setDirectoryContextMenu] = useState<{
    folder: ModuleFileNode;
    x: number;
    y: number;
  } | null>(null);
  const [moduleContextMenu, setModuleContextMenu] = useState<{
    moduleId: ModuleId;
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
  const effectiveSidebarCompact = sidebarCompact || isNarrowViewport;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncNarrowViewport = () => setIsNarrowViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncNarrowViewport);
    return () => mediaQuery.removeEventListener("change", syncNarrowViewport);
  }, []);

  useEffect(() => {
    void syncPanAIHostContext(selectedSpec.id, selectedRootFolderId);
  }, [selectedRootFolderId, selectedSpec.id]);

  useLayoutEffect(() => {
    const nav = contextNavRef.current;
    if (!nav) return;
    const storedScrollTop = readStoredModuleSidebarScrollTop();
    if (storedScrollTop === null) return;
    nav.scrollTop = storedScrollTop;
    sidebarScrollStateRef.current = {
      current: storedScrollTop,
      previous: storedScrollTop,
      source: "programmatic",
      updatedAt: window.performance.now(),
    };
  }, [effectiveSidebarCompact, selectedSpec.id]);

  useEffect(() => {
    persistOpenDirectoryModuleIds(openDirectoryModuleIds);
  }, [openDirectoryModuleIds]);

  useEffect(() => {
    function clampLauncherToViewport() {
      setPanAILauncherPosition((current) => {
        if (!current) return current;
        return clampPanAILauncherPosition(current.x, current.y);
      });
    }

    window.addEventListener("resize", clampLauncherToViewport);
    return () => window.removeEventListener("resize", clampLauncherToViewport);
  }, []);

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
      void syncPanAIHostContext(detail.moduleId, detail.folderId);
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
    if (initialDirectorySelection.clearPendingFolderSelection) {
      window.sessionStorage.removeItem(architokenPendingFolderSelectionKey);
      void syncPanAIHostContext(
        initialDirectorySelection.moduleId,
        initialDirectorySelection.activeFolderId,
      );
    }
  }, [initialDirectorySelection]);

  useEffect(() => {
    function handleModuleFileTreeChanged(event: Event) {
      const detail = (
        event as CustomEvent<ArchitokenModuleFileTreeChangedRequest>
      ).detail;
      setDirectoryRefreshTick((current) => current + 1);
      setDirectoryState((current) =>
        current.moduleId === detail.moduleId
          ? {
              moduleId: detail.moduleId,
              activeFolderId: current.activeFolderId,
              files: moduleBackendAdapter.snapshot(detail.moduleId).files,
            }
          : current,
      );
    }

    window.addEventListener(
      architokenModuleFileTreeChangedEventName,
      handleModuleFileTreeChanged,
    );
    return () => {
      window.removeEventListener(
        architokenModuleFileTreeChangedEventName,
        handleModuleFileTreeChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (!panAIHostOpen) return;
    let cancelled = false;

    async function pollPanAIHostEvents() {
      try {
        const response = await fetch("/api/panai/host", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "poll_events",
            since: panAIHostEventCursorRef.current,
          }),
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as {
          eventCursor?: number;
          events?: Array<{
            seq: number;
            type?: string;
            moduleId: ModuleId;
            parentId: string;
            node: ModuleFileNode;
            auditEvent: ModuleAuditEvent;
            message?: string;
            createdAt?: string;
          }>;
        };
        for (const event of payload.events ?? []) {
          if (event.type !== "file_created") continue;
          const detail: ArchitokenPanAIHostFileCreatedRequest = {
            seq: event.seq,
            moduleId: event.moduleId,
            parentId: event.parentId,
            node: event.node,
            auditEvent: event.auditEvent,
            message: event.message ?? `PanAI 已新建文件夹: ${event.node.name}`,
            requestedAt: event.createdAt ?? new Date().toISOString(),
          };
          window.dispatchEvent(
            new CustomEvent(architokenPanAIHostFileCreatedEventName, {
              detail,
            }),
          );
        }
        if (typeof payload.eventCursor === "number") {
          panAIHostEventCursorRef.current = Math.max(
            panAIHostEventCursorRef.current,
            payload.eventCursor,
          );
        }
      } catch {
        // Host Bridge may be unavailable during local dev reloads.
      }
    }

    void pollPanAIHostEvents();
    const timer = window.setInterval(pollPanAIHostEvents, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [panAIHostOpen]);

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

  useEffect(() => {
    if (!moduleContextMenu) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModuleContextMenu(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moduleContextMenu]);

  function openFolderFromModuleNav(
    folder: ModuleFileNode,
    expansionIntent: FolderExpansionIntent,
  ) {
    setDirectoryContextMenu(null);
    setModuleContextMenu(null);
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
      const ancestorIds = getFolderAncestorIds(files, folder.id, false);
      const baseIds =
        current.moduleId === folder.moduleId
          ? mergeFolderIds(current.folderIds, ancestorIds)
          : ancestorIds;
      return {
        moduleId: folder.moduleId,
        folderIds:
          expansionIntent === "expand"
            ? mergeFolderIds(baseIds, [folder.id])
            : expansionIntent === "collapse"
              ? baseIds.filter((folderId) => folderId !== folder.id)
              : baseIds,
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
      persistPendingOpenFileRequest(rootRequest);
      if (folder.moduleId !== selectedSpec.id) {
        window.sessionStorage.setItem(
          architokenPendingFolderSelectionKey,
          JSON.stringify({
            folderId: folder.id,
            moduleId: folder.moduleId,
            requestedAt: planningRequest.requestedAt,
          } satisfies ArchitokenFolderSelectionRequest),
        );
        router.push(
          moduleById.get(folder.moduleId)?.routeHref ?? "/app/modules",
        );
        return;
      }
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
    persistPendingOpenFileRequest(request);
    if (folder.moduleId !== selectedSpec.id) {
      window.sessionStorage.setItem(
        architokenPendingFolderSelectionKey,
        JSON.stringify({
          folderId: folder.id,
          moduleId: folder.moduleId,
          requestedAt: request.requestedAt,
        } satisfies ArchitokenFolderSelectionRequest),
      );
      router.push(moduleById.get(folder.moduleId)?.routeHref ?? "/app/modules");
      return;
    }
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
      recordAudit(result.auditEvent, folder.moduleId, "module-directory");
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
    setModuleContextMenu(null);
    setDirectoryContextMenu({
      folder,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function openModuleContextMenu(
    event: ReactMouseEvent<HTMLAnchorElement>,
    moduleId: ModuleId,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDirectoryContextMenu(null);
    setModuleContextMenu({
      moduleId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function recordAudit(
    event: ModuleActionResult["auditEvent"],
    moduleId: ModuleId,
    source: string,
  ) {
    setAuditEvents((current) => [event, ...current].slice(0, 12));
    void persistModuleOperationAudit({ moduleId, event, source });
  }

  function handleAudit(event: ModuleActionResult["auditEvent"]) {
    recordAudit(event, selectedSpec.id, "module-workbench-shell");
  }

  function toggleSidebarCompact() {
    setSidebarCompact((current) => {
      const next = !current;
      document.cookie = `architoken.moduleSidebarCompact=${String(next)}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  function toggleModuleDirectory(moduleId: ModuleId) {
    setOpenDirectoryModuleIds((current) => {
      const next = current.includes(moduleId)
        ? current.filter((currentModuleId) => currentModuleId !== moduleId)
        : mergeModuleIds(current, [moduleId]);
      return persistOpenDirectoryModuleIds(next);
    });
  }

  function handleModuleClick(
    moduleId: ModuleId,
    compact: boolean,
    clickCount: number,
  ) {
    setModuleContextMenu(null);
    if (!compact && clickCount === 1 && moduleId !== selectedSpec.id) {
      restoreSidebarScrollBeforeProgrammaticNavigation();
    }
    if (compact || clickCount !== 2) {
      return;
    }
    toggleModuleDirectory(moduleId);
  }

  function handleSidebarScroll(scrollTop: number) {
    const now = window.performance.now();
    const normalizedScrollTop = Math.max(0, Math.round(scrollTop));
    const state = sidebarScrollStateRef.current;
    if (normalizedScrollTop !== state.current) {
      sidebarScrollStateRef.current = {
        current: normalizedScrollTop,
        previous: state.current,
        source:
          now - lastSidebarScrollInputAtRef.current < 80
            ? "user"
            : "programmatic",
        updatedAt: now,
      };
    }
    persistModuleSidebarScrollTop(normalizedScrollTop);
  }

  function markSidebarScrollInput() {
    lastSidebarScrollInputAtRef.current = window.performance.now();
  }

  function restoreSidebarScrollBeforeProgrammaticNavigation() {
    const state = sidebarScrollStateRef.current;
    const changedImmediatelyBeforeClick =
      state.source === "programmatic" &&
      window.performance.now() - state.updatedAt < 120 &&
      state.previous !== state.current;
    if (!changedImmediatelyBeforeClick) return;
    sidebarScrollStateRef.current = {
      current: state.previous,
      previous: state.previous,
      source: "programmatic",
      updatedAt: window.performance.now(),
    };
    persistModuleSidebarScrollTop(state.previous);
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function updateSidebarWidth(clientX: number) {
      setSidebarWidth(
        clampNumber(
          startWidth + clientX - startX,
          moduleSidebarMinWidth,
          moduleSidebarMaxWidth,
        ),
      );
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      updateSidebarWidth(moveEvent.clientX);
    }

    function handleMouseMove(moveEvent: MouseEvent) {
      updateSidebarWidth(moveEvent.clientX);
    }

    function stopSidebarResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handleMouseMove);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerup", stopSidebarResize, { once: true });
    window.addEventListener("mouseup", stopSidebarResize, { once: true });
  }

  function startPanAILauncherDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition =
      panAILauncherPosition ??
      getDefaultPanAILauncherPosition(isNarrowViewport);
    let moved = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        panAILauncherDragSuppressedRef.current = true;
      }
      setPanAILauncherPosition(
        clampPanAILauncherPosition(startPosition.x + dx, startPosition.y + dy),
      );
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      if (!moved) {
        panAILauncherDragSuppressedRef.current = false;
        return;
      }
      window.setTimeout(() => {
        panAILauncherDragSuppressedRef.current = false;
      }, 0);
    }

    setPanAILauncherPosition(startPosition);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function openPanAIHostFromLauncher() {
    if (panAILauncherDragSuppressedRef.current) {
      return;
    }
    showPanAIHost();
  }

  function showPanAIHost() {
    setPanAIHostOpen(true);
    setPanAIHostMinimized(false);
    persistPanAIHostOpen(true);
    persistPanAIHostMinimized(false);
  }

  function minimizePanAIHost() {
    setPanAIHostOpen(true);
    setPanAIHostMinimized(true);
    persistPanAIHostOpen(true);
    persistPanAIHostMinimized(true);
  }

  function closePanAIHost() {
    setPanAIHostOpen(false);
    setPanAIHostMinimized(false);
    persistPanAIHostOpen(false);
    persistPanAIHostMinimized(false);
  }

  function getModuleDirectoryModel(spec: (typeof moduleSpecs)[number]) {
    const rootId = getModuleRootId(spec.id);
    const files = moduleBackendAdapter.snapshot(spec.id).files;
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
    if (!openDirectoryModuleIds.includes(spec.id)) {
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
    "--module-sidebar-template": effectiveSidebarCompact
      ? "44px"
      : `${sidebarWidth}px`,
  } as CSSProperties;
  const sidebarNarrowLabels =
    !effectiveSidebarCompact && sidebarWidth < moduleSidebarNarrowLabelWidth;
  const sidebarClassName = [
    "arch-huly-context relative flex min-h-0 flex-col overflow-hidden border-r",
    effectiveSidebarCompact ? "is-compact" : "",
    sidebarNarrowLabels ? "is-narrow-labels" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const defaultPanAILauncherPosition =
    getDefaultPanAILauncherPosition(isNarrowViewport);
  const panAILauncherStyle = {
    left: panAILauncherPosition?.x ?? defaultPanAILauncherPosition.x,
    top: panAILauncherPosition?.y ?? defaultPanAILauncherPosition.y,
  } as CSSProperties;
  const inspectorButtonLabel = inspectorOpen ? "关闭审计面板" : "打开审计面板";
  const moduleContextSpec = moduleContextMenu
    ? moduleById.get(moduleContextMenu.moduleId)
    : null;

  return (
    <main className="arch-app h-[100dvh] w-screen overflow-hidden">
      <div
        className="grid h-full min-h-0 grid-cols-[var(--module-sidebar-template)_minmax(0,1fr)]"
        style={shellGridStyle}
      >
        <aside className={sidebarClassName}>
          <div className="arch-huly-context-header">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebarCompact}
                className="arch-huly-workspace-mark"
                aria-pressed={effectiveSidebarCompact}
                aria-label={
                  effectiveSidebarCompact ? "展开模块目录" : "仅显示模块图标"
                }
                title={
                  effectiveSidebarCompact ? "展开模块目录" : "仅显示模块图标"
                }
              >
                A
              </button>
              {effectiveSidebarCompact ? null : (
                <div className="min-w-0">
                  <h1 className="arch-text truncate arch-type-body font-medium">
                    ArchIToken
                  </h1>
                </div>
              )}
            </div>
            {effectiveSidebarCompact ? null : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInspectorOpen((current) => !current)}
                  className="arch-huly-icon-button"
                  aria-pressed={inspectorOpen}
                  aria-label={inspectorButtonLabel}
                  title={inspectorButtonLabel}
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {effectiveSidebarCompact ? null : (
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
            ref={contextNavRef}
            onScroll={(event) =>
              handleSidebarScroll(event.currentTarget.scrollTop)
            }
            onWheel={markSidebarScrollInput}
            onPointerDown={markSidebarScrollInput}
            onKeyDown={markSidebarScrollInput}
            className={`arch-huly-context-nav min-h-0 flex-1 overflow-y-auto pb-3 ${
              effectiveSidebarCompact ? "px-1" : "px-2"
            }`}
            style={hiddenWorkbenchScrollbarStyle}
          >
            {effectiveSidebarCompact ? (
              <div className="grid gap-1">
                {moduleSpecs.map((spec) => (
                  <ModuleNavItem
                    key={spec.id}
                    spec={spec}
                    selected={spec.id === selectedSpec.id}
                    compact={effectiveSidebarCompact}
                    accentClass={moduleAccentClass(spec.order)}
                    onModuleClick={handleModuleClick}
                    onModuleContextMenu={openModuleContextMenu}
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
                      compact={effectiveSidebarCompact}
                      accentClass={moduleAccentClass(spec.order)}
                      onModuleClick={handleModuleClick}
                      onModuleContextMenu={openModuleContextMenu}
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
                              compact={effectiveSidebarCompact}
                              accentClass={moduleAccentClass(spec.order)}
                              onModuleClick={handleModuleClick}
                              onModuleContextMenu={openModuleContextMenu}
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

          {effectiveSidebarCompact ? null : (
            <div className="arch-huly-context-footer">
              <ThemeSwitcher />
            </div>
          )}
          {effectiveSidebarCompact ? null : (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整模块导航栏宽度"
              onPointerDown={startSidebarResize}
              className="absolute inset-y-0 right-0 z-20 hidden w-2.5 cursor-ew-resize touch-none lg:block"
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
            openFolderFromModuleNav(
              folder,
              hasDirectoryChildren(folder) ? "expand" : "preserve",
            )
          }
          onRename={beginDirectoryRename}
          onCopyName={(folder) => {
            void navigator.clipboard?.writeText(folder.name);
            setDirectoryContextMenu(null);
          }}
          onClose={() => setDirectoryContextMenu(null)}
        />
      ) : null}

      {moduleContextMenu && moduleContextSpec ? (
        <ModuleNavContextMenu
          spec={moduleContextSpec}
          x={moduleContextMenu.x}
          y={moduleContextMenu.y}
          expanded={openDirectoryModuleIds.includes(moduleContextSpec.id)}
          onOpen={(spec) => {
            setModuleContextMenu(null);
            router.push(spec.routeHref);
          }}
          onToggleDirectory={(spec) => {
            toggleModuleDirectory(spec.id);
            setModuleContextMenu(null);
          }}
          onCopyPath={(spec) => {
            void navigator.clipboard?.writeText(spec.routeHref);
            setModuleContextMenu(null);
          }}
          onClose={() => setModuleContextMenu(null)}
        />
      ) : null}

      {inspectorOpen ? (
        <InspectorDrawer
          selectedSpec={selectedSpec}
          auditEvents={auditEvents}
          onClose={() => setInspectorOpen(false)}
        />
      ) : null}

      {panAIHostOpen ? (
        <PanAIHostWindow
          module={selectedSpec}
          minimized={panAIHostMinimized}
          onMinimize={minimizePanAIHost}
          onClose={closePanAIHost}
        />
      ) : null}

      {panAILauncherReady && (!panAIHostOpen || panAIHostMinimized) ? (
        <button
          type="button"
          onClick={openPanAIHostFromLauncher}
          onPointerDown={startPanAILauncherDrag}
          className="fixed z-[130] flex h-11 w-11 touch-none cursor-grab items-center justify-center rounded-full border border-[var(--arch-border)] bg-[var(--arch-surface)] p-0 shadow-lg transition hover:scale-105 hover:border-[var(--arch-primary)] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arch-primary)] sm:h-[52px] sm:w-[52px]"
          style={panAILauncherStyle}
          aria-label="打开 PanAI"
          title="打开 PanAI"
        >
          <span
            aria-hidden="true"
            className="block h-7 w-7 bg-contain bg-center bg-no-repeat sm:h-9 sm:w-9"
            style={{ backgroundImage: 'url("/assets/logo-mark.svg")' }}
          />
        </button>
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
  onOpenFolder: (
    folder: ModuleFileNode,
    expansionIntent: FolderExpansionIntent,
  ) => void;
  onContextFolder: (
    event: ReactMouseEvent<HTMLButtonElement>,
    folder: ModuleFileNode,
  ) => void;
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
  onOpenFolder: (
    folder: ModuleFileNode,
    expansionIntent: FolderExpansionIntent,
  ) => void;
  onContextFolder: (
    event: ReactMouseEvent<HTMLButtonElement>,
    folder: ModuleFileNode,
  ) => void;
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
    <ChevronRight
      className="h-3.5 w-3.5 shrink-0 opacity-0"
      aria-hidden="true"
    />
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
          onClick={() => onOpenFolder(folder, "preserve")}
          onContextMenu={(event) => onContextFolder(event, folder)}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenFolder(
              folder,
              hasChildren ? (expanded ? "collapse" : "expand") : "preserve",
            );
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

function persistPendingOpenFileRequest(request: ArchitokenOpenFileRequest) {
  try {
    window.sessionStorage.setItem(
      architokenPendingOpenFileKey,
      JSON.stringify(request),
    );
  } catch {
    // Pending navigation is best-effort; the live event still handles mounted workbenches.
  }
}

async function syncPanAIHostContext(
  moduleId: ModuleId,
  parentId: string,
): Promise<void> {
  try {
    await fetch("/api/panai/host", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "set_context",
        moduleId,
        parentId,
      }),
    });
  } catch {
    // Host Bridge may be unavailable during local dev reloads.
  }
}

function persistPanAIHostOpen(open: boolean) {
  try {
    window.sessionStorage.setItem(panAIHostOpenStorageKey, open ? "1" : "0");
  } catch {
    // Session storage can be unavailable in constrained browser contexts.
  }
}

function persistPanAIHostMinimized(minimized: boolean) {
  try {
    window.sessionStorage.setItem(
      panAIHostMinimizedStorageKey,
      minimized ? "1" : "0",
    );
  } catch {
    // Session storage can be unavailable in constrained browser contexts.
  }
}

function readStoredPanAIHostOpen(): boolean | null {
  try {
    const stored = window.sessionStorage.getItem(panAIHostOpenStorageKey);
    if (stored === null) {
      return null;
    }
    return stored === "1";
  } catch {
    return null;
  }
}

function readStoredPanAIHostMinimized(): boolean | null {
  try {
    const stored = window.sessionStorage.getItem(panAIHostMinimizedStorageKey);
    if (stored === null) {
      return null;
    }
    return stored === "1";
  } catch {
    return null;
  }
}

function persistOpenDirectoryModuleIds(moduleIds: ModuleId[]): ModuleId[] {
  const next = mergeModuleIds(moduleIds);
  const serialized = next.join(",");
  window.localStorage.setItem(openDirectoryModuleIdsStorageKey, serialized);
  document.cookie = `${openDirectoryModuleIdsStorageKey}=${encodeURIComponent(
    serialized,
  )}; path=/; max-age=31536000; samesite=lax`;
  return next;
}

function persistModuleSidebarScrollTop(scrollTop: number) {
  try {
    window.sessionStorage.setItem(
      moduleSidebarScrollTopStorageKey,
      String(Math.max(0, Math.round(scrollTop))),
    );
  } catch {
    // Session storage can be unavailable in constrained browser contexts.
  }
}

function readStoredModuleSidebarScrollTop(): number | null {
  try {
    const stored = window.sessionStorage.getItem(
      moduleSidebarScrollTopStorageKey,
    );
    if (stored === null) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredOpenDirectoryModuleIds(): ModuleId[] | null {
  try {
    const stored = window.localStorage.getItem(
      openDirectoryModuleIdsStorageKey,
    );
    if (stored === null) {
      return null;
    }
    return mergeModuleIds(
      stored
        .split(",")
        .map((moduleId) => moduleId.trim())
        .filter((moduleId): moduleId is ModuleId =>
          moduleSpecs.some((spec) => spec.id === moduleId),
        ),
    );
  } catch {
    return null;
  }
}

function readInitialDirectorySelection(
  moduleId: ModuleId,
  fallbackFolderId: string,
): {
  moduleId: ModuleId;
  activeFolderId: string;
  files: ModuleFileNode[];
  clearPendingFolderSelection: boolean;
} {
  const files = moduleBackendAdapter.snapshot(moduleId).files;
  if (typeof window === "undefined") {
    return {
      moduleId,
      activeFolderId: fallbackFolderId,
      files,
      clearPendingFolderSelection: false,
    };
  }

  try {
    const pending = window.sessionStorage.getItem(
      architokenPendingFolderSelectionKey,
    );
    if (!pending) {
      return {
        moduleId,
        activeFolderId: fallbackFolderId,
        files,
        clearPendingFolderSelection: false,
      };
    }

    const detail = JSON.parse(pending) as ArchitokenFolderSelectionRequest;
    if (detail.moduleId !== moduleId) {
      return {
        moduleId,
        activeFolderId: fallbackFolderId,
        files,
        clearPendingFolderSelection: false,
      };
    }

    const folder = files.find(
      (file) => file.id === detail.folderId && file.type === "folder",
    );
    return {
      moduleId,
      activeFolderId: folder?.id ?? fallbackFolderId,
      files,
      clearPendingFolderSelection: true,
    };
  } catch {
    return {
      moduleId,
      activeFolderId: fallbackFolderId,
      files,
      clearPendingFolderSelection: true,
    };
  }
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
  onModuleContextMenu,
}: {
  spec: (typeof moduleSpecs)[number];
  selected: boolean;
  compact: boolean;
  accentClass: string;
  onModuleClick: (
    moduleId: ModuleId,
    compact: boolean,
    clickCount: number,
  ) => void;
  onModuleContextMenu: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    moduleId: ModuleId,
  ) => void;
}) {
  return (
    <Link
      href={spec.routeHref}
      prefetch={false}
      title={`${spec.zhName} · ${spec.id}`}
      aria-label={compact ? `${spec.zhName} · ${spec.id}` : undefined}
      data-module-id={spec.id}
      data-testid={`module-nav-${spec.id}`}
      onContextMenu={(event) => onModuleContextMenu(event, spec.id)}
      onClick={(event) => {
        onModuleClick(spec.id, compact, event.detail);
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

function ModuleNavContextMenu({
  spec,
  x,
  y,
  expanded,
  onOpen,
  onToggleDirectory,
  onCopyPath,
  onClose,
}: {
  spec: (typeof moduleSpecs)[number];
  x: number;
  y: number;
  expanded: boolean;
  onOpen: (spec: (typeof moduleSpecs)[number]) => void;
  onToggleDirectory: (spec: (typeof moduleSpecs)[number]) => void;
  onCopyPath: (spec: (typeof moduleSpecs)[number]) => void;
  onClose: () => void;
}) {
  const left = Math.min(x, window.innerWidth - 212);
  const top = Math.min(y, window.innerHeight - 184);
  return (
    <div
      className="fixed inset-0 z-[90]"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={onClose}
    >
      <div
        role="menu"
        aria-label={`${spec.zhName}模块操作菜单`}
        data-testid="module-context-menu"
        className="fixed w-[204px] rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] p-1 shadow-xl"
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--arch-border)] px-3 py-2">
          <p className="truncate text-sm font-semibold text-[var(--arch-text)]">
            {spec.zhName}
          </p>
          <p className="arch-muted mt-0.5 truncate font-mono text-[11px]">
            {spec.id}
          </p>
        </div>
        <button
          type="button"
          role="menuitem"
          className="mt-1 block w-full rounded px-3 py-2 text-left text-[12px] text-[var(--arch-text)] hover:bg-[var(--arch-bg-muted)]"
          onClick={() => onOpen(spec)}
        >
          打开模块
        </button>
        <button
          type="button"
          role="menuitem"
          className="block w-full rounded px-3 py-2 text-left text-[12px] text-[var(--arch-text)] hover:bg-[var(--arch-bg-muted)]"
          onClick={() => onToggleDirectory(spec)}
        >
          {expanded ? "收起子目录" : "展开子目录"}
        </button>
        <button
          type="button"
          role="menuitem"
          className="block w-full rounded px-3 py-2 text-left text-[12px] text-[var(--arch-text)] hover:bg-[var(--arch-bg-muted)]"
          onClick={() => onCopyPath(spec)}
        >
          复制模块路径
        </button>
      </div>
    </div>
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

function getDefaultPanAILauncherPosition(isNarrowViewport = false) {
  if (typeof window === "undefined") {
    return { x: 0, y: 760 };
  }
  const bottomReserve = isNarrowViewport
    ? panAILauncherNarrowBottomReserve
    : panAILauncherBottomReserve;
  const y = clampNumber(
    window.innerHeight - panAILauncherSize - bottomReserve,
    panAILauncherMargin,
    Math.max(
      panAILauncherMargin,
      window.innerHeight - panAILauncherSize - bottomReserve,
    ),
  );
  if (isNarrowViewport) {
    return { x: 0, y };
  }
  const rightReserve =
    window.innerWidth >= 1024
      ? panAILauncherRightPanelReserve
      : panAILauncherMargin;
  return clampPanAILauncherPosition(
    window.innerWidth - panAILauncherSize - rightReserve,
    y,
  );
}

function clampPanAILauncherPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }
  return {
    x: clampNumber(
      x,
      panAILauncherMargin,
      Math.max(panAILauncherMargin, window.innerWidth - panAILauncherSize),
    ),
    y: clampNumber(
      y,
      panAILauncherMargin,
      Math.max(
        panAILauncherMargin,
        window.innerHeight - panAILauncherSize - panAILauncherBottomReserve,
      ),
    ),
  };
}
