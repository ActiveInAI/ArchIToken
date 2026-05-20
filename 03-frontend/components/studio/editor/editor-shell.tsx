"use client";

import { useState, type ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { LeftRail } from "./left-rail";
import { AiChatSection } from "./left-pane/ai-chat-section";
import { useEditorKeyboard } from "@/hooks/studio/use-editor-keyboard";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog";
import { SelectionStatus } from "./selection-status";
import { CommandHistoryOverlay } from "./command-history-overlay";

export interface StudioEditorShellProps {
  readonly middle: ReactNode;
  readonly canvas: ReactNode;
  readonly properties: ReactNode;
}

export function StudioEditorShell({ middle, canvas, properties }: StudioEditorShellProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEditorKeyboard({ onOpenShortcutsDialog: () => setShortcutsOpen(true) });
  return (
    <ErrorBoundary scope="editor">
    <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    <SelectionStatus />
    <div className="relative flex h-[calc(100vh-3.5rem)] w-full bg-fg-0 text-fg-8">
      <CommandHistoryOverlay />
      <LeftRail />
      <PanelGroup
        direction="horizontal"
        autoSaveId="insome-studio-editor"
        className="flex-1"
      >
        <Panel defaultSize={26} minSize={18} maxSize={40} className="overflow-hidden bg-fg-1">
          <PanelGroup direction="vertical" autoSaveId="insome-studio-editor-left">
            <Panel
              defaultSize={45}
              minSize={35}
              maxSize={70}
              className="overflow-hidden"
              data-testid="left-pane-tools"
            >
              {middle}
            </Panel>
            <PanelResizeHandle
              data-testid="left-pane-resize-handle"
              className="h-px bg-fg-2 transition-colors hover:bg-accent-lime data-[resize-handle-active]:bg-accent-lime"
            />
            <Panel defaultSize={55} minSize={30} maxSize={65} className="overflow-hidden">
              <AiChatSection />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="w-px bg-fg-2 transition-colors hover:bg-accent-lime data-[resize-handle-active]:bg-accent-lime" />
        <Panel defaultSize={55} minSize={30} className="overflow-hidden">
          {canvas}
        </Panel>
        <PanelResizeHandle className="w-px bg-fg-2 transition-colors hover:bg-accent-lime data-[resize-handle-active]:bg-accent-lime" />
        <Panel defaultSize={23} minSize={16} maxSize={36} className="overflow-hidden bg-fg-1">
          {properties}
        </Panel>
      </PanelGroup>
    </div>
    </ErrorBoundary>
  );
}
