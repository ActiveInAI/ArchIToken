import { create } from "zustand";
import type { CanvasViewState } from "@/lib/insome/canvas";
import { DEFAULT_VIEW_STATE } from "@/lib/insome/canvas";
import type {
  Floorplan,
  FloorplanScheme,
  Point,
  RoomGrade,
} from "@/lib/insome/floorplan";
import type {
  CreationKind,
  CreationSession,
  DragKind,
  EditMode,
  SelectionRef,
} from "@/lib/insome/floorplan/edit";
import type { SnapResult } from "@/lib/insome/geom";
import {
  canRedo as stackCanRedo,
  canUndo as stackCanUndo,
  EMPTY_STACK,
  pushCommand,
  redoCommand,
  undoCommand,
  type Command,
  type CommandStackState,
} from "@/lib/command";

export type LeftRailTool =
  | "build"
  | "info"
  | "objects"
  | "appearance"
  | "customization"
  | "help";

export type BuildSubTool =
  | "select"
  | "move-wall"
  | "move-room"
  | "draw-wall"
  | "draw-room-rect"
  | "place-door"
  | "place-window"
  | "place-opening";

export type StudioCanvasTab = "2d" | "3d";

export interface StudioRoomOverride {
  readonly material?: string;
  readonly grade?: RoomGrade;
  readonly color?: string;
  readonly widthFt?: number;
  readonly lengthFt?: number;
  readonly ceilingFt?: number;
  readonly floorFinish?: string;
  readonly wallFinish?: string;
  readonly lightFixture?: string;
}

export interface DragSession {
  readonly kind: DragKind;
  readonly startWorldPoint: Point;
  readonly currentWorldPoint: Point;
  readonly snapResult: SnapResult | null;
  readonly wallId?: string;
  readonly end?: "a" | "b";
  readonly roomId?: string;
}

interface StudioEditorState {
  readonly currentTool: LeftRailTool;
  readonly buildSubTool: BuildSubTool | null;
  readonly wallThickness: number;
  readonly canvasTab: StudioCanvasTab;
  readonly canvas2dView: CanvasViewState;
  readonly scheme: FloorplanScheme;
  readonly showMeasurements: boolean;
  readonly showLabels: boolean;
  readonly showGrid: boolean;
  readonly selection: SelectionRef;
  readonly activeFloorplan: Floorplan | null;
  readonly commandStack: CommandStackState;
  readonly dragSession: DragSession | null;
  readonly creationSession: CreationSession | null;
  readonly roomOverrides: Record<string, StudioRoomOverride>;
  setTool: (t: LeftRailTool) => void;
  setBuildSubTool: (t: BuildSubTool | null) => void;
  setWallThickness: (n: number) => void;
  setCanvasTab: (t: StudioCanvasTab) => void;
  setCanvas2dView: (v: CanvasViewState) => void;
  setScheme: (s: FloorplanScheme) => void;
  toggleDisplay: (key: "showMeasurements" | "showLabels" | "showGrid") => void;
  setSelection: (s: SelectionRef) => void;
  selectRoom: (id: string, labelKey: string) => void;
  clearSelection: () => void;
  setActiveFloorplan: (fp: Floorplan | null) => void;
  pushCommand: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  startDrag: (s: DragSession) => void;
  updateDrag: (patch: Partial<DragSession>) => void;
  endDrag: (commit: boolean) => void;
  startCreation: (kind: CreationKind) => void;
  updateCreation: (patch: Partial<CreationSession>) => void;
  commitCreation: () => void;
  cancelCreation: () => void;
  setRoomOverride: (roomId: string, patch: Partial<StudioRoomOverride>) => void;
  clearOverrides: () => void;
  resetEditor: () => void;
  getEditMode: () => EditMode;
}

const DEFAULTS = {
  currentTool: "build" as LeftRailTool,
  buildSubTool: null,
  wallThickness: 6,
  canvasTab: "2d" as StudioCanvasTab,
  canvas2dView: DEFAULT_VIEW_STATE,
  scheme: "standard" as FloorplanScheme,
  showMeasurements: true,
  showLabels: true,
  showGrid: true,
  selection: null,
  activeFloorplan: null as Floorplan | null,
  commandStack: EMPTY_STACK,
  dragSession: null as DragSession | null,
  creationSession: null as CreationSession | null,
  roomOverrides: {} as Record<string, StudioRoomOverride>,
};

export const useStudioEditorStore = create<StudioEditorState>((set, get) => {
  const getFloorplan = () => {
    const fp = get().activeFloorplan;
    if (!fp) throw new Error("activeFloorplan is null — command cannot run");
    return fp;
  };
  const setFloorplan = (fp: Floorplan) => set({ activeFloorplan: fp });

  return {
    ...DEFAULTS,
    setTool: (currentTool) => {
      if (currentTool !== "build") {
        set({
          currentTool,
          buildSubTool: null,
          dragSession: null,
          creationSession: null,
        });
      } else {
        set({ currentTool });
      }
    },
    setBuildSubTool: (buildSubTool) => {
      const kind = subToolToCreationKind(buildSubTool);
      if (kind) {
        if (get().dragSession) set({ dragSession: null });
        set({
          buildSubTool,
          creationSession: {
            kind,
            startPoint: null,
            currentPoint: null,
            snapResult: null,
          },
        });
      } else {
        if (get().creationSession) set({ creationSession: null });
        set({ buildSubTool });
      }
    },
    setWallThickness: (wallThickness) => set({ wallThickness }),
    setCanvasTab: (canvasTab) => set({ canvasTab }),
    setCanvas2dView: (canvas2dView) => set({ canvas2dView }),
    setScheme: (scheme) => set({ scheme }),
    toggleDisplay: (key) => set((s) => ({ [key]: !s[key] })),
    setSelection: (selection) => set({ selection }),
    selectRoom: (id, labelKey) => {
      void labelKey;
      set({ selection: { kind: "room", id } });
    },
    clearSelection: () => set({ selection: null }),
    setActiveFloorplan: (activeFloorplan) => set({ activeFloorplan }),
    pushCommand: (cmd) => {
      if (!get().activeFloorplan) return;
      cmd.apply({ getFloorplan, setFloorplan });
      set((s) => ({ commandStack: pushCommand(s.commandStack, cmd) }));
    },
    undo: () => {
      if (!get().activeFloorplan) return;
      set((s) => ({
        commandStack: undoCommand(s.commandStack, {
          getFloorplan,
          setFloorplan,
        }),
      }));
      reconcileSelection(set, get);
    },
    redo: () => {
      if (!get().activeFloorplan) return;
      set((s) => ({
        commandStack: redoCommand(s.commandStack, {
          getFloorplan,
          setFloorplan,
        }),
      }));
      reconcileSelection(set, get);
    },
    canUndo: () => stackCanUndo(get().commandStack),
    canRedo: () => stackCanRedo(get().commandStack),
    startDrag: (s) => {
      if (get().creationSession) set({ creationSession: null });
      set({ dragSession: s });
    },
    updateDrag: (patch) =>
      set((s) =>
        s.dragSession ? { dragSession: { ...s.dragSession, ...patch } } : {},
      ),
    endDrag: (commit) => {
      void commit;
      set({ dragSession: null });
    },
    startCreation: (kind) => {
      if (get().dragSession) set({ dragSession: null });
      set({
        creationSession: {
          kind,
          startPoint: null,
          currentPoint: null,
          snapResult: null,
        },
      });
    },
    updateCreation: (patch) =>
      set((s) =>
        s.creationSession
          ? { creationSession: { ...s.creationSession, ...patch } }
          : {},
      ),
    commitCreation: () =>
      set((s) =>
        s.creationSession
          ? {
              creationSession: {
                ...s.creationSession,
                startPoint: null,
                currentPoint: null,
                snapResult: null,
              },
            }
          : {},
      ),
    cancelCreation: () =>
      set((s) =>
        s.creationSession
          ? {
              creationSession: {
                ...s.creationSession,
                startPoint: null,
                currentPoint: null,
                snapResult: null,
              },
            }
          : {},
      ),
    setRoomOverride: (roomId, patch) =>
      set((s) => ({
        roomOverrides: {
          ...s.roomOverrides,
          [roomId]: { ...(s.roomOverrides[roomId] ?? {}), ...patch },
        },
      })),
    clearOverrides: () => set({ roomOverrides: {} }),
    resetEditor: () => set({ ...DEFAULTS }),
    getEditMode: () => {
      const { buildSubTool, currentTool } = get();
      if (currentTool !== "build") return "none";
      return buildSubToolToEditMode(buildSubTool);
    },
  };
});

function buildSubToolToEditMode(t: BuildSubTool | null): EditMode {
  switch (t) {
    case "move-wall":
      return "wall";
    case "move-room":
      return "room";
    case "draw-wall":
      return "create-wall";
    case "draw-room-rect":
      return "create-room-rect";
    case "place-door":
      return "create-opening-door";
    case "place-window":
      return "create-opening-window";
    case "place-opening":
      return "create-opening-plain";
    default:
      return "none";
  }
}

function subToolToCreationKind(t: BuildSubTool | null): CreationKind | null {
  switch (t) {
    case "draw-wall":
      return "wall";
    case "draw-room-rect":
      return "room-rectangle";
    case "place-door":
      return "opening-door";
    case "place-window":
      return "opening-window";
    case "place-opening":
      return "opening-plain";
    default:
      return null;
  }
}

function reconcileSelection(
  set: (patch: Partial<StudioEditorState>) => void,
  get: () => StudioEditorState,
): void {
  const { selection, activeFloorplan } = get();
  if (!selection || !activeFloorplan) return;
  if (
    selection.kind === "room" &&
    !activeFloorplan.rooms.find((r) => r.id === selection.id)
  ) {
    set({ selection: null });
  }
  if (
    selection.kind === "wall" &&
    !activeFloorplan.walls.find((w) => w.id === selection.id)
  ) {
    set({ selection: null });
  }
  if (
    selection.kind === "opening" &&
    !activeFloorplan.openings.find((o) => o.id === selection.id)
  ) {
    set({ selection: null });
  }
}
