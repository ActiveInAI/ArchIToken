"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import clsx from "clsx";
import "@xyflow/react/dist/style.css";
import "./style.css";

import type { InfiniteCanvasProps } from "./types";
import { DEFAULT_VIEW_STATE } from "./types";
import { InsomeBackground } from "./skin/background";
import { InsomeControls } from "./skin/controls";
import { InsomeMiniMap } from "./skin/mini-map";
import {
  StaticSvgContentContext,
  StaticSvgNode,
  StaticSvgNodeRenderer,
  type StaticSvgNodeProps,
} from "./nodes/static-svg-node";

const NODE_TYPES: NodeTypes = {
  "insome-static-svg": StaticSvgNodeRenderer,
};

export function InfiniteCanvas({
  children,
  theme = "home",
  showMiniMap = true,
  showControls = true,
  showGrid = true,
  initialViewState = DEFAULT_VIEW_STATE,
  onViewStateChange,
  fitViewOnInit = false,
  minZoom = 0.2,
  maxZoom = 4,
  className,
  labels,
}: InfiniteCanvasProps) {
  const { nodes, contentMap } = useMemo(() => buildNodes(children), [children]);

  const handleViewportChange = useCallback(
    (v: Viewport) => {
      onViewStateChange?.({ x: v.x, y: v.y, zoom: v.zoom });
    },
    [onViewStateChange],
  );

  return (
    <div
      className={clsx(
        "insome-canvas relative h-full w-full",
        `insome-canvas--${theme}`,
        className,
      )}
      data-theme={theme}
    >
      <StaticSvgContentContext.Provider value={contentMap}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={NODE_TYPES}
            panOnDrag
            panOnScroll
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectionOnDrag={false}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            minZoom={minZoom}
            maxZoom={maxZoom}
            fitView={fitViewOnInit}
            fitViewOptions={{ padding: 0.1 }}
            {...(fitViewOnInit
              ? {}
              : {
                  defaultViewport: {
                    x: initialViewState.x,
                    y: initialViewState.y,
                    zoom: initialViewState.zoom,
                  },
                })}
            onViewportChange={handleViewportChange}
            proOptions={{ hideAttribution: true }}
          >
            {showGrid ? <InsomeBackground theme={theme} /> : null}
            {showControls ? <InsomeControls theme={theme} labels={labels} /> : null}
            {showMiniMap ? (
              <InsomeMiniMap theme={theme} ariaLabel={labels?.miniMap} />
            ) : null}
          </ReactFlow>
        </ReactFlowProvider>
      </StaticSvgContentContext.Provider>
    </div>
  );
}

interface BuildResult {
  readonly nodes: Node[];
  readonly contentMap: Map<string, ReactNode>;
}

function buildNodes(children: ReactNode): BuildResult {
  const nodes: Node[] = [];
  const contentMap = new Map<string, ReactNode>();

  Children.forEach(children, (child) => {
    if (!isValidElement<StaticSvgNodeProps>(child)) return;
    if (child.type !== StaticSvgNode) return;
    const { id, position, width, height, children: body } = child.props;
    nodes.push({
      id,
      type: "insome-static-svg",
      position,
      data: {},
      draggable: false,
      selectable: false,
      focusable: false,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    });
    contentMap.set(id, body);
  });

  return { nodes, contentMap };
}
