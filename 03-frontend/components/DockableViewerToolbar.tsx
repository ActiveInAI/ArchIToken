// components/DockableViewerToolbar.tsx - draggable docked tool surface
// License: Apache-2.0
"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import {
  GripVertical,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
} from "lucide-react";

export type ViewerToolbarDock = "left" | "right" | "top" | "bottom";

export interface ViewerToolbarMetric {
  label: string;
  value: string;
}

interface DockableViewerToolbarProps {
  title: string;
  subtitle?: string;
  metrics?: ViewerToolbarMetric[];
  actions?: ReactNode;
  children?: ReactNode;
  defaultDock?: ViewerToolbarDock;
}

export function DockableViewerToolbar({
  title,
  subtitle,
  metrics = [],
  actions,
  children,
  defaultDock = "left",
}: DockableViewerToolbarProps) {
  const [dock, setDock] = useState<ViewerToolbarDock>(defaultDock);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragPoint({ x: event.clientX, y: event.clientY });
  }

  function drag(event: PointerEvent<HTMLButtonElement>) {
    if (!dragPoint) return;
    setDragPoint({ x: event.clientX, y: event.clientY });
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!dragPoint) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDock(nearestDock(event.clientX, event.clientY));
    setDragPoint(null);
  }

  return (
    <aside
      className={`pointer-events-auto z-30 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)]/96 p-2 text-[var(--arch-foreground)] shadow-xl backdrop-blur ${dragPoint ? "fixed w-60" : `absolute ${dockClass(dock)}`}`}
      style={
        dragPoint
          ? {
              left: dragPoint.x,
              top: dragPoint.y,
              transform: "translate(-16px, -16px)",
            }
          : undefined
      }
      data-viewer-toolbar-dock={dock}
    >
      <div
        className={`flex gap-2 ${dock === "top" || dock === "bottom" ? "items-center" : "items-start"}`}
      >
        <button
          type="button"
          onPointerDown={beginDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={() => setDragPoint(null)}
          className="arch-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          title="拖拽工具栏并自动靠边停靠"
          aria-label="拖拽工具栏并自动靠边停靠"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="arch-primary-text truncate text-[11px] font-black">
                {title}
              </p>
              {subtitle ? (
                <p className="arch-muted mt-0.5 truncate text-[10px] font-bold">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <DockButtons dock={dock} onDock={setDock} />
          </div>

          {metrics.length ? (
            <dl
              className={`mt-2 grid gap-1.5 ${dock === "top" || dock === "bottom" ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-1"}`}
            >
              {metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-2 py-1.5"
                >
                  <dt className="arch-muted truncate text-[10px] font-bold">
                    {metric.label}
                  </dt>
                  <dd className="arch-text mt-0.5 truncate font-mono text-[11px] font-black">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {actions ? <div className="mt-2 flex flex-wrap gap-1.5">{actions}</div> : null}
          {children ? <div className="mt-2 min-w-0">{children}</div> : null}
        </div>
      </div>
    </aside>
  );
}

function DockButtons({
  dock,
  onDock,
}: {
  dock: ViewerToolbarDock;
  onDock: (dock: ViewerToolbarDock) => void;
}) {
  const buttons: Array<{
    dock: ViewerToolbarDock;
    label: string;
    icon: ReactNode;
  }> = [
    { dock: "left", label: "停靠左侧", icon: <PanelLeft className="h-3.5 w-3.5" /> },
    { dock: "top", label: "停靠顶部", icon: <PanelTop className="h-3.5 w-3.5" /> },
    { dock: "bottom", label: "停靠底部", icon: <PanelBottom className="h-3.5 w-3.5" /> },
    { dock: "right", label: "停靠右侧", icon: <PanelRight className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex shrink-0 items-center gap-1">
      {buttons.map((button) => (
        <button
          key={button.dock}
          type="button"
          onClick={() => onDock(button.dock)}
          className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] transition ${
            dock === button.dock
              ? "border-[var(--arch-primary)] bg-[var(--arch-primary-soft)] text-[var(--arch-primary)]"
              : "border-[var(--arch-border)] bg-[var(--arch-surface-muted)] text-[var(--arch-muted)] hover:border-[var(--arch-primary)]"
          }`}
          title={button.label}
          aria-label={button.label}
        >
          {button.icon}
        </button>
      ))}
    </div>
  );
}

function dockClass(dock: ViewerToolbarDock): string {
  if (dock === "right") {
    return "right-3 top-1/2 max-h-[calc(100%-24px)] w-60 -translate-y-1/2 overflow-auto";
  }
  if (dock === "top") {
    return "left-1/2 top-3 max-h-[42%] w-[min(900px,calc(100%-24px))] -translate-x-1/2 overflow-auto";
  }
  if (dock === "bottom") {
    return "bottom-3 left-1/2 max-h-[42%] w-[min(900px,calc(100%-24px))] -translate-x-1/2 overflow-auto";
  }
  return "left-3 top-1/2 max-h-[calc(100%-24px)] w-60 -translate-y-1/2 overflow-auto";
}

function nearestDock(x: number, y: number): ViewerToolbarDock {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  const distances: Array<[ViewerToolbarDock, number]> = [
    ["left", x],
    ["right", width - x],
    ["top", y],
    ["bottom", height - y],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0]?.[0] ?? "left";
}
