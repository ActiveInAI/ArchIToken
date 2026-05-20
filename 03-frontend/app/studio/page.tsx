"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Floorplan } from "@/lib/insome/floorplan";
import { ProposalGeneratorScope, ScriptedProposalGenerator } from "@/lib/proposal";
import { stepSlide, viewSwitch } from "@/lib/motion-presets";
import { useStudioCreateStore } from "@/stores/studio-create.store";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { useStudioViewStore } from "@/stores/studio-view.store";
import { StudioTopNav } from "@/components/studio/shared/studio-top-nav";
import { ToastProvider } from "@/components/studio/shared/toast-provider";
import { StudioWorkspaceHome } from "@/components/studio/workspace-page/workspace-home";
import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { UnifiedNav } from "@/components/shared/unified-nav";
import { CreateStep1Entry } from "@/components/studio/create/step-1-entry";
import { CreateStep2Form } from "@/components/studio/create/step-2-form";
import { CreateGeneratingView } from "@/components/studio/create/generating-view";
import { ProposalsView } from "@/components/studio/create/proposals-view";
import { StudioEditorShell } from "@/components/studio/editor/editor-shell";
import { MiddlePanelRouter } from "@/components/studio/editor/middle/panel-router";
import { CanvasTabs } from "@/components/studio/editor/canvas/canvas-tabs";
import { StudioPropertiesPanel } from "@/components/studio/editor/properties/properties-panel";
import { ExportDialog } from "@/components/studio/editor/export-dialog";
import { ConstraintWarningBadge } from "@/components/studio/editor/constraint-warning";
import { ClaimButton } from "@/components/studio/editor/claim-button";
// LEGACY(phase-4.0.3): AskAiButton (top-bar dialog) replaced by docked AiChatSection in left pane.
// Kept on disk for archival; no longer imported here.
// import { AskAiButton } from "@/components/studio/editor/ask-ai-button";

export default function StudioPage() {
  const t = useTranslations();
  const tExport = useTranslations("studio.export");
  const { view, activeProjectId, activeProposalId } = useStudioViewStore();
  const resetEditor = useStudioEditorStore((s) => s.resetEditor);
  const setProposals = useStudioCreateStore((s) => s.setProposals);
  const [_stash, setStash] = useState<ReadonlyArray<Floorplan>>([]);

  const provider = useMemo(
    () =>
      new ScriptedProposalGenerator({
        sleepMs: 2400,
        onFloorplansGenerated: (plans) => {
          setStash(plans);
          if (typeof window !== "undefined") {
            window.__insomeStudioFloorplans = plans;
          }
        },
      }),
    [],
  );

  // TODO(phase-4): switch to project-level state; for now editor resets on each entry
  useEffect(() => {
    if (view === "editor") resetEditor();
  }, [view, activeProjectId, activeProposalId, resetEditor]);

  // Housekeeping: when leaving proposals/editor, drop stashed generator output.
  useEffect(() => {
    if (view === "projects") {
      setProposals([]);
      if (typeof window !== "undefined") {
        window.__insomeStudioFloorplans = [];
      }
    }
  }, [view, setProposals]);

  const projectName =
    view === "editor"
      ? t("studio.nav.fallbackName") +
        (activeProposalId ? ` · Proposal ${activeProposalId.slice(-1).toUpperCase()}` : "")
      : undefined;

  const rightSlot =
    view === "editor" ? (
      <div className="flex items-center gap-2">
        <ConstraintWarningBadge />
        <ExportDialog>
          <button
            type="button"
            className="border border-fg-2 bg-fg-0 px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-fg-8"
          >
            ↗ {tExport("label")}
          </button>
        </ExportDialog>
        <ClaimButton source="studio-editor" />
      </div>
    ) : null;

  return (
    <ProposalGeneratorScope value={provider}>
      <PageThemeMount theme="dark" />
      <div className="flex h-screen flex-col overflow-hidden bg-fg-0 text-fg-8">
        {view === "projects" ? (
          <UnifiedNav variant="studio" />
        ) : (
          <StudioTopNav projectName={projectName} rightSlot={rightSlot} />
        )}
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              {...(view.startsWith("create") ? stepSlide : viewSwitch)}
              className="h-full overflow-y-auto"
            >
              {renderView(view)}
            </motion.div>
          </AnimatePresence>
        </div>
        <ToastProvider />
      </div>
    </ProposalGeneratorScope>
  );
}

function renderView(view: ReturnType<typeof useStudioViewStore.getState>["view"]) {
  if (view === "projects") return <StudioWorkspaceHome />;
  if (view === "create-step-1") return <CreateStep1Entry />;
  if (view === "create-step-2") return <CreateStep2Form />;
  if (view === "create-generating") return <CreateGeneratingView />;
  if (view === "create-proposals") return <ProposalsView />;
  return (
    <StudioEditorShell
      middle={<MiddlePanelRouter />}
      canvas={<CanvasTabs />}
      properties={<StudioPropertiesPanel />}
    />
  );
}
