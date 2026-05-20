export type {
  SelectionRef,
  HitTarget,
  HitTestResult,
  EditMode,
  DragKind,
  CreationKind,
  CreationSession,
} from "./types";
export { selectionEquals, isCreationMode, editModeToCreationKind } from "./types";
export { hitTest } from "./hit-test";
