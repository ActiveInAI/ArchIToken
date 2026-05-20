import type { ReactNode } from "react";

export type CanvasTheme = "home" | "studio";

export interface CanvasViewState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const DEFAULT_VIEW_STATE: CanvasViewState = { x: 0, y: 0, zoom: 1 };

export interface InfiniteCanvasProps {
  /** Typically a single <StaticSvgNode> (or a short list of them). */
  readonly children: ReactNode;
  readonly theme?: CanvasTheme;
  readonly showMiniMap?: boolean;
  readonly showControls?: boolean;
  readonly showGrid?: boolean;
  readonly initialViewState?: CanvasViewState;
  readonly onViewStateChange?: (v: CanvasViewState) => void;
  readonly fitViewOnInit?: boolean;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly className?: string;
  /** i18n-injected strings for controls/minimap (avoid canvas package depending on next-intl). */
  readonly labels?: CanvasLabels;
}

export interface CanvasLabels {
  readonly zoomIn?: string;
  readonly zoomOut?: string;
  readonly fitView?: string;
  readonly resetZoom?: string;
  readonly miniMap?: string;
}

export interface StaticSvgNodeData extends Record<string, unknown> {
  /** Optional display label used by MiniMap / debugging. */
  readonly label?: string;
  /** Content is supplied via React portal; kept here to satisfy xyflow's NodeProps typing. */
  readonly contentId?: string;
}
