"use client";

import { useEffect } from "react";
import type { BuildSubTool } from "@/stores/studio-editor.store";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { useCanvasViewStore } from "@/stores/canvas-view.store";
import type { CameraPreset } from "@/lib/insome/scene";

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export interface EditorKeyboardOptions {
  readonly onOpenShortcutsDialog?: () => void;
}

/**
 * Phase 2.75 shortcut map:
 *   edit:       Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y
 *   tools:      V / W / R / D / E / O / M
 *   view:       1 / 2 / 3 (camera presets), F (fit view — handled by component)
 *   selection:  Esc (layered), Ctrl/Cmd+D (clear)
 *   help:       Ctrl/Cmd+/ (open dialog)
 */
const TOOL_KEY_MAP: Record<string, BuildSubTool> = {
  v: "select",
  w: "draw-wall",
  r: "draw-room-rect",
  d: "place-door",
  e: "place-window",
  o: "place-opening",
};

export function useEditorKeyboard(options: EditorKeyboardOptions = {}) {
  const undo = useStudioEditorStore((s) => s.undo);
  const redo = useStudioEditorStore((s) => s.redo);
  const canUndo = useStudioEditorStore((s) => s.canUndo);
  const canRedo = useStudioEditorStore((s) => s.canRedo);
  const dragSession = useStudioEditorStore((s) => s.dragSession);
  const endDrag = useStudioEditorStore((s) => s.endDrag);
  const buildSubTool = useStudioEditorStore((s) => s.buildSubTool);
  const setBuildSubTool = useStudioEditorStore((s) => s.setBuildSubTool);
  const selection = useStudioEditorStore((s) => s.selection);
  const clearSelection = useStudioEditorStore((s) => s.clearSelection);
  const creationSession = useStudioEditorStore((s) => s.creationSession);
  const cancelCreation = useStudioEditorStore((s) => s.cancelCreation);
  const canvasTab = useStudioEditorStore((s) => s.canvasTab);
  const studio3dCamera = useCanvasViewStore((s) => s.studio3dCamera);
  const setStudio3dCamera = useCanvasViewStore((s) => s.setStudio3dCamera);

  const onOpenShortcutsDialog = options.onOpenShortcutsDialog;

  useEffect(() => {
    function setCameraPreset(preset: CameraPreset) {
      if (canvasTab !== "3d") return;
      if (studio3dCamera.preset === preset) return;
      setStudio3dCamera({ ...studio3dCamera, preset });
    }

    function onKey(e: KeyboardEvent) {
      if (isEditable(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && !e.shiftKey && key === "z") {
        if (canUndo()) { e.preventDefault(); undo(); }
        return;
      }
      if ((mod && e.shiftKey && key === "z") || (mod && key === "y")) {
        if (canRedo()) { e.preventDefault(); redo(); }
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        clearSelection();
        return;
      }
      if (mod && key === "/") {
        e.preventDefault();
        onOpenShortcutsDialog?.();
        return;
      }

      if (e.key === "Escape") {
        if (dragSession) { e.preventDefault(); endDrag(false); return; }
        if (creationSession && creationSession.startPoint !== null) { e.preventDefault(); cancelCreation(); return; }
        if (creationSession && creationSession.startPoint === null) { e.preventDefault(); setBuildSubTool("select"); return; }
        if (buildSubTool !== null && buildSubTool !== "select") { e.preventDefault(); setBuildSubTool("select"); return; }
        if (selection !== null) { e.preventDefault(); clearSelection(); }
        return;
      }

      // Tool shortcuts — only when no modifier held
      if (!mod && !e.shiftKey && !e.altKey) {
        const mapped = TOOL_KEY_MAP[key];
        if (mapped) { e.preventDefault(); setBuildSubTool(mapped); return; }
        if (key === "m") {
          e.preventDefault();
          setBuildSubTool(buildSubTool === "move-wall" ? "move-room" : "move-wall");
          return;
        }
        if (key === "1") { e.preventDefault(); setCameraPreset("iso"); return; }
        if (key === "2") { e.preventDefault(); setCameraPreset("top"); return; }
        if (key === "3") { e.preventDefault(); setCameraPreset("perspective"); return; }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo, redo, canUndo, canRedo,
    dragSession, endDrag,
    creationSession, cancelCreation,
    buildSubTool, setBuildSubTool,
    selection, clearSelection,
    canvasTab, studio3dCamera, setStudio3dCamera,
    onOpenShortcutsDialog,
  ]);
}
