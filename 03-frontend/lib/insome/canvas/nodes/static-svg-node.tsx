"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { NodeProps } from "@xyflow/react";

export interface StaticSvgNodeProps {
  /** Unique id within the containing <InfiniteCanvas>. */
  readonly id: string;
  /** xyflow canvas-space position; for a single-node canvas, use (0,0). */
  readonly position: { readonly x: number; readonly y: number };
  /** Fixed pixel dimensions so xyflow can measure/fit the node. */
  readonly width?: number;
  readonly height?: number;
  /** The content to render; typically an SVG or wrapped floorplan. */
  readonly children: ReactNode;
}

/**
 * Marker component. InfiniteCanvas inspects its React children and extracts
 * each <StaticSvgNode>'s (id, position, children) to build the xyflow nodes
 * array + a content registry. The component itself renders null — actual DOM
 * output happens inside the nodeType renderer below.
 */
export function StaticSvgNode(props: StaticSvgNodeProps): null {
  void props;
  return null;
}

/** Context the consumer-side <InfiniteCanvas> uses to pass child JSX down to
 * the xyflow node renderer without serialising React nodes through `data`. */
export const StaticSvgContentContext = createContext<Map<string, ReactNode>>(
  new Map(),
);

export function StaticSvgNodeRenderer({ id }: NodeProps) {
  const map = useContext(StaticSvgContentContext);
  const content = map.get(id) ?? null;
  return (
    <div
      className="nodrag nowheel"
      style={{ pointerEvents: "auto", userSelect: "none" }}
    >
      {content}
    </div>
  );
}
