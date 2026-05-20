"use client";

import { useReactFlow } from "@xyflow/react";
import clsx from "clsx";
import type { CanvasLabels, CanvasTheme } from "../types";

export interface InsomeControlsProps {
  readonly theme: CanvasTheme;
  readonly labels?: CanvasLabels | undefined;
}

export function InsomeControls({ theme, labels }: InsomeControlsProps) {
  const { zoomIn, zoomOut, fitView, setViewport, getViewport } = useReactFlow();

  const handleResetZoom = () => {
    const v = getViewport();
    setViewport({ x: v.x, y: v.y, zoom: 1 }, { duration: 200 });
  };

  const surface =
    theme === "studio"
      ? "border-[color:var(--color-fg-2)] bg-[color:var(--color-fg-1)] text-[color:var(--color-fg-8)]"
      : "border-[color:var(--color-fg-2)] bg-[color:var(--color-fg-9)] text-[color:var(--color-fg-1)]";

  const hover =
    theme === "studio"
      ? "hover:bg-[color:var(--color-fg-2)]"
      : "hover:bg-[color:var(--color-fg-7)]";

  return (
    <div
      className={clsx(
        "absolute bottom-4 right-4 z-10 flex flex-col border",
        surface,
      )}
    >
      <ControlButton
        aria-label={labels?.zoomIn ?? "Zoom in"}
        onClick={() => zoomIn({ duration: 200 })}
        className={hover}
      >
        +
      </ControlButton>
      <ControlButton
        aria-label={labels?.zoomOut ?? "Zoom out"}
        onClick={() => zoomOut({ duration: 200 })}
        className={clsx("border-t", hover)}
      >
        −
      </ControlButton>
      <ControlButton
        aria-label={labels?.fitView ?? "Fit view"}
        onClick={() => fitView({ duration: 300, padding: 0.1 })}
        className={clsx("border-t", hover)}
      >
        ⛶
      </ControlButton>
      <ControlButton
        aria-label={labels?.resetZoom ?? "Reset zoom"}
        onClick={handleResetZoom}
        className={clsx("border-t font-mono text-[10px]", hover)}
      >
        1:1
      </ControlButton>
    </div>
  );
}

interface ControlButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: React.ReactNode;
}

function ControlButton({ className, children, ...rest }: ControlButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "flex h-8 w-8 items-center justify-center border-[color:var(--color-fg-2)] text-[14px] leading-none cursor-pointer transition-colors",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
