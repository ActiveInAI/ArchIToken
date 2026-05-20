"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ReactNode } from "react";
import { useWorkspaceLayoutStore } from "@/stores/workspace-layout.store";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export interface WorkspaceShellProps {
  readonly chat: ReactNode;
  readonly canvas: ReactNode;
  readonly infoBar?: ReactNode;
}

/**
 * Phase 4.0: Home workspace trimmed to 2 columns (Chat + Canvas). The
 * Properties column is archived (homeowner never tweaks parameters).
 * Optional `infoBar` renders across the bottom as read-only floorplan info.
 */
export function WorkspaceShell({ chat, canvas, infoBar }: WorkspaceShellProps) {
  const { chatPct, canvasPct, setPanelSizes } = useWorkspaceLayoutStore();

  const handleLayout = (sizes: number[]) => {
    if (sizes.length === 2) {
      setPanelSizes({
        chatPct: sizes[0] ?? chatPct,
        canvasPct: sizes[1] ?? canvasPct,
        propertiesPct: 0,
      });
    }
  };

  return (
    <ErrorBoundary scope="workspace">
      <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col">
        <PanelGroup
          direction="horizontal"
          autoSaveId="insome-home-workspace-v4"
          onLayout={handleLayout}
          className="flex-1"
        >
          <Panel defaultSize={chatPct} minSize={22} className="overflow-hidden border-r border-fg-6">
            {chat}
          </Panel>
          <PanelResizeHandle className="w-px bg-fg-6 transition-colors hover:bg-accent-signal data-[resize-handle-active]:bg-accent-signal" />
          <Panel defaultSize={canvasPct} minSize={30} className="overflow-hidden">
            {canvas}
          </Panel>
        </PanelGroup>
        {infoBar ? (
          <div className="shrink-0 border-t border-fg-6 bg-fg-8">{infoBar}</div>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
