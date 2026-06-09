// components/FloatingWindowFrame.tsx - Movable, resizable workbench window frame
// License: Apache-2.0
"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";

type WindowPlacement = "center" | "right" | "bottom-right" | "anchor";
type ResizeEdge =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface WindowSize {
  width: number;
  height: number;
}

interface WindowBox extends WindowSize {
  x: number;
  y: number;
}

const centerWindowViewportRatio = 0.75;

export function FloatingWindowFrame({
  title,
  eyebrow,
  subtitle,
  icon,
  children,
  footer,
  onClose,
  onMinimize,
  defaultSize = { width: 520, height: 680 },
  minSize = { width: 340, height: 360 },
  placement = "center",
  zIndex = 70,
  modal = false,
  hidden = false,
  bodyClassName = "p-3",
  footerClassName = "p-3",
  defaultViewportRatio,
  anchorPosition,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  onMinimize?: () => void;
  defaultSize?: WindowSize;
  minSize?: WindowSize;
  placement?: WindowPlacement;
  zIndex?: number;
  modal?: boolean;
  hidden?: boolean;
  bodyClassName?: string;
  footerClassName?: string;
  defaultViewportRatio?: number | null;
  anchorPosition?: { x: number; y: number } | null;
}) {
  const viewportRatio = resolveViewportRatio(placement, defaultViewportRatio);
  const [box, setBox] = useState<WindowBox>(() =>
    makeInitialBox(
      defaultSize,
      minSize,
      placement,
      viewportRatio,
      anchorPosition,
    ),
  );
  const [previousBox, setPreviousBox] = useState<WindowBox | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [interactionCursor, setInteractionCursor] = useState<string | null>(
    null,
  );
  const anchorX = anchorPosition?.x;
  const anchorY = anchorPosition?.y;

  useEffect(() => {
    const currentDefaultSize = {
      width: defaultSize.width,
      height: defaultSize.height,
    };
    const currentMinSize = {
      width: minSize.width,
      height: minSize.height,
    };
    const currentAnchorPosition =
      anchorX !== undefined && anchorY !== undefined
        ? { x: anchorX, y: anchorY }
        : null;

    function syncBoxToViewport() {
      setBox(
        makeInitialBox(
          currentDefaultSize,
          currentMinSize,
          placement,
          viewportRatio,
          currentAnchorPosition,
        ),
      );
    }

    syncBoxToViewport();
    window.addEventListener("resize", syncBoxToViewport);
    return () => window.removeEventListener("resize", syncBoxToViewport);
  }, [
    defaultSize.height,
    defaultSize.width,
    minSize.height,
    minSize.width,
    placement,
    viewportRatio,
    anchorX,
    anchorY,
  ]);

  function restore() {
    setMinimized(false);
  }

  function toggleMaximize() {
    setMaximized((current) => {
      if (current) {
        if (previousBox) {
          setBox(previousBox);
        }
        return false;
      }
      setPreviousBox(box);
      return true;
    });
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (maximized) return;
    event.preventDefault();
    setInteractionCursor("cursor-move");
    const startX = event.clientX;
    const startY = event.clientY;
    const startBox = box;

    function handlePointerMove(moveEvent: PointerEvent) {
      const viewport = viewportSize();
      setBox({
        ...startBox,
        x: clampNumber(
          startBox.x + moveEvent.clientX - startX,
          8,
          Math.max(8, viewport.width - startBox.width - 8),
        ),
        y: clampNumber(
          startBox.y + moveEvent.clientY - startY,
          8,
          Math.max(8, viewport.height - startBox.height - 8),
        ),
      });
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      setInteractionCursor(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function startResize(
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) {
    if (maximized) return;
    event.preventDefault();
    event.stopPropagation();
    setInteractionCursor(resizeCursor(edge));
    const startX = event.clientX;
    const startY = event.clientY;
    const startBox = box;

    function handlePointerMove(moveEvent: PointerEvent) {
      const viewport = viewportSize();
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let width = startBox.width;
      let height = startBox.height;
      let x = startBox.x;
      let y = startBox.y;
      const maxWidth = Math.max(minSize.width, viewport.width - 16);
      const maxHeight = Math.max(minSize.height, viewport.height - 16);

      if (edge.includes("right")) {
        width = clampNumber(startBox.width + dx, minSize.width, maxWidth);
      }
      if (edge.includes("left")) {
        width = clampNumber(startBox.width - dx, minSize.width, maxWidth);
        x = startBox.x + (startBox.width - width);
      }
      if (edge.includes("bottom")) {
        height = clampNumber(startBox.height + dy, minSize.height, maxHeight);
      }
      if (edge.includes("top")) {
        height = clampNumber(startBox.height - dy, minSize.height, maxHeight);
        y = startBox.y + (startBox.height - height);
      }

      setBox({
        width,
        height,
        x: clampNumber(x, 8, Math.max(8, viewport.width - width - 8)),
        y: clampNumber(y, 8, Math.max(8, viewport.height - height - 8)),
      });
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      setInteractionCursor(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={restore}
        className="arch-btn-primary fixed bottom-5 right-5 flex h-12 min-w-12 items-center justify-center gap-2 rounded-md px-3 shadow-lg"
        style={{ zIndex }}
        aria-label={`还原 ${title}`}
        title={`还原 ${title}`}
      >
        {icon}
        <span className="hidden max-w-44 truncate arch-type-body font-medium sm:block">
          {title}
        </span>
      </button>
    );
  }

  const frameStyle: CSSProperties = maximized
    ? {
        zIndex,
        left: 8,
        top: 8,
        width: "calc(100vw - 16px)",
        height: "calc(100dvh - 16px)",
      }
    : {
        zIndex,
        left: box.x,
        top: box.y,
        width: `min(${box.width}px, calc(100vw - 16px))`,
        height: `min(${box.height}px, calc(100dvh - 16px))`,
        minWidth: `min(${minSize.width}px, calc(100vw - 16px))`,
        minHeight: `min(${minSize.height}px, calc(100dvh - 16px))`,
      };

  const frame = (
    <section
      className={`arch-surface arch-border fixed flex flex-col overflow-hidden rounded-md border shadow-2xl ${
        hidden ? "pointer-events-none invisible" : ""
      }`}
      style={frameStyle}
      aria-hidden={hidden || undefined}
    >
      {!maximized ? resizeHandles(startResize) : null}
      {interactionCursor ? (
        <div
          aria-hidden="true"
          className={`absolute inset-0 z-40 touch-none bg-transparent ${interactionCursor}`}
        />
      ) : null}
      <header
        className="arch-border flex h-10 shrink-0 cursor-move select-none items-center justify-between gap-2 border-b px-2.5 py-1"
        onPointerDown={startDrag}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {icon ? (
            <span className="arch-primary-soft flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              {icon}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap">
            {eyebrow ? (
              <span className="arch-primary-text shrink-0 truncate arch-type-caption font-medium">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="arch-text min-w-0 shrink truncate arch-type-body font-medium">
              {title}
            </h2>
            {subtitle ? (
              <span className="arch-muted hidden min-w-0 shrink truncate arch-type-caption sm:inline">
                · {subtitle}
              </span>
            ) : null}
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-1"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onMinimize ?? (() => setMinimized(true))}
            className="arch-btn flex h-8 w-8 items-center justify-center rounded-md"
            aria-label={`最小化 ${title}`}
            title="最小化"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleMaximize}
            className="arch-btn flex h-8 w-8 items-center justify-center rounded-md"
            aria-label={maximized ? `还原 ${title}` : `最大化 ${title}`}
            title={maximized ? "还原" : "最大化"}
          >
            {maximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="arch-btn flex h-8 w-8 items-center justify-center rounded-md"
            aria-label={`关闭 ${title}`}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
        {children}
      </div>
      {footer ? (
        <div className={`arch-border shrink-0 border-t ${footerClassName}`}>
          {footer}
        </div>
      ) : null}
    </section>
  );

  if (hidden || !modal) {
    return frame;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-[rgba(6,18,16,0.32)] backdrop-blur"
        style={{ zIndex: zIndex - 1 }}
      />
      {frame}
    </>
  );
}

function resizeHandles(
  startResize: (
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) => void,
) {
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="向左拖动调整窗口宽度"
        onPointerDown={(event) => startResize(event, "left")}
        className="absolute inset-y-3 left-[-5px] z-20 w-3 cursor-ew-resize touch-none"
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="向右拖动调整窗口宽度"
        onPointerDown={(event) => startResize(event, "right")}
        className="absolute inset-y-3 right-[-5px] z-20 w-3 cursor-ew-resize touch-none"
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="向上拖动调整窗口高度"
        onPointerDown={(event) => startResize(event, "top")}
        className="absolute inset-x-3 top-[-5px] z-20 h-3 cursor-ns-resize touch-none"
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="向下拖动调整窗口高度"
        onPointerDown={(event) => startResize(event, "bottom")}
        className="absolute inset-x-3 bottom-[-5px] z-20 h-3 cursor-ns-resize touch-none"
      />
      <CornerHandle
        edge="top-left"
        className="left-[-5px] top-[-5px] cursor-nwse-resize"
        onResize={startResize}
      />
      <CornerHandle
        edge="top-right"
        className="right-[-5px] top-[-5px] cursor-nesw-resize"
        onResize={startResize}
      />
      <CornerHandle
        edge="bottom-left"
        className="bottom-[-5px] left-[-5px] cursor-nesw-resize"
        onResize={startResize}
      />
      <CornerHandle
        edge="bottom-right"
        className="bottom-[-5px] right-[-5px] cursor-nwse-resize"
        onResize={startResize}
      />
    </>
  );
}

function CornerHandle({
  edge,
  className,
  onResize,
}: {
  edge: ResizeEdge;
  className: string;
  onResize: (
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) => void;
}) {
  return (
    <div
      aria-hidden="true"
      onPointerDown={(event) => onResize(event, edge)}
      className={`absolute z-30 h-5 w-5 touch-none rounded-md bg-transparent ${className}`}
    />
  );
}

function makeInitialBox(
  defaultSize: WindowSize,
  minSize: WindowSize,
  placement: WindowPlacement,
  defaultViewportRatio: number | null,
  anchorPosition?: { x: number; y: number } | null,
): WindowBox {
  const viewport = viewportSize();
  const size =
    defaultViewportRatio === null
      ? defaultSize
      : viewportRatioSize(viewport, defaultViewportRatio);
  const width = clampNumber(
    size.width,
    minSize.width,
    Math.max(minSize.width, viewport.width - 16),
  );
  const height = clampNumber(
    size.height,
    minSize.height,
    Math.max(minSize.height, viewport.height - 16),
  );
  let x = Math.max(8, Math.round((viewport.width - width) / 2));
  let y = Math.max(8, Math.round((viewport.height - height) / 2));

  if (placement === "right") {
    x = Math.max(8, viewport.width - width - 12);
    y = 8;
  }
  if (placement === "bottom-right") {
    x = Math.max(8, viewport.width - width - 20);
    y = Math.max(8, viewport.height - height - 20);
  }
  if (placement === "anchor" && anchorPosition) {
    x = clampNumber(
      anchorPosition.x,
      8,
      Math.max(8, viewport.width - width - 8),
    );
    y = clampNumber(
      anchorPosition.y,
      8,
      Math.max(8, viewport.height - height - 8),
    );
  }

  return { width, height, x, y };
}

function resolveViewportRatio(
  placement: WindowPlacement,
  defaultViewportRatio: number | null | undefined,
) {
  if (defaultViewportRatio !== undefined) {
    return defaultViewportRatio;
  }
  return placement === "center" ? centerWindowViewportRatio : null;
}

function viewportRatioSize(viewport: WindowSize, ratio: number): WindowSize {
  const normalizedRatio = clampNumber(ratio, 0.1, 1);
  return {
    width: Math.round(viewport.width * normalizedRatio),
    height: Math.round(viewport.height * normalizedRatio),
  };
}

function viewportSize() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resizeCursor(edge: ResizeEdge) {
  if (edge === "left" || edge === "right") return "cursor-ew-resize";
  if (edge === "top" || edge === "bottom") return "cursor-ns-resize";
  if (edge === "top-left" || edge === "bottom-right") {
    return "cursor-nwse-resize";
  }
  return "cursor-nesw-resize";
}
