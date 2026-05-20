"use client";

import { useTranslations } from "next-intl";
import { useStudioEditorStore, type LeftRailTool } from "@/stores/studio-editor.store";
import { BuildPanel } from "./build-panel";
import { InfoPanel } from "./info-panel";
import { ObjectsPanel } from "./objects-panel";
import { AppearancePanel } from "./appearance-panel";
import { CustomizationPanel } from "./customization-panel";
import { HelpPanel } from "./help-panel";

const PANELS: Record<LeftRailTool, () => React.ReactElement> = {
  build: BuildPanel,
  info: InfoPanel,
  objects: ObjectsPanel,
  appearance: AppearancePanel,
  customization: CustomizationPanel,
  help: HelpPanel,
};

export function MiddlePanelRouter() {
  const t = useTranslations("studio.tools");
  const currentTool = useStudioEditorStore((s) => s.currentTool);
  const Panel = PANELS[currentTool];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-fg-2 px-4 py-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t(currentTool)}
      </div>
      <div className="flex-1 overflow-y-auto">
        <Panel />
      </div>
    </div>
  );
}
