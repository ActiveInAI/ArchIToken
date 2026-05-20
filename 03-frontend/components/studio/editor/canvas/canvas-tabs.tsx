"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { useStudioEditorStore, type StudioCanvasTab } from "@/stores/studio-editor.store";
import { Canvas2DView } from "./canvas-2d-view";
import { Canvas3DView } from "./canvas-3d-view";

export function CanvasTabs() {
  const t = useTranslations("studio.canvas");
  const { canvasTab, setCanvasTab } = useStudioEditorStore();

  return (
    <Tabs.Root
      value={canvasTab}
      onValueChange={(v) => setCanvasTab(v as StudioCanvasTab)}
      className="relative flex h-full flex-col"
    >
      <Tabs.List className="flex shrink-0 items-center border-b border-fg-2 bg-fg-0">
        <TabTrigger value="2d">{t("tab.twoD")}</TabTrigger>
        <TabTrigger value="3d">{t("tab.threeD")}</TabTrigger>
      </Tabs.List>

      <div className="relative flex-1 overflow-hidden">
        <TabPane value="2d" active={canvasTab === "2d"} forceMount>
          <Canvas2DView />
        </TabPane>
        {canvasTab === "3d" ? (
          <TabPane value="3d" active>
            <Canvas3DView />
          </TabPane>
        ) : null}
      </div>
    </Tabs.Root>
  );
}

function TabPane({
  value,
  active,
  forceMount,
  children,
}: {
  readonly value: string;
  readonly active: boolean;
  readonly forceMount?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Tabs.Content
      value={value}
      {...(forceMount ? { forceMount: true } : {})}
      className={cn(
        "absolute inset-0 transition-opacity duration-300 ease-out",
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {children}
    </Tabs.Content>
  );
}

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="relative h-10 px-4 font-mono text-small text-fg-4 transition-colors hover:text-fg-8 data-[state=active]:text-accent-lime data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-4 data-[state=active]:after:right-4 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-accent-lime"
    >
      {children}
    </Tabs.Trigger>
  );
}
