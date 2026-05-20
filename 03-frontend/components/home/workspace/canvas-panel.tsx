"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { CanvasChartView } from "./canvas-chart-view";
import { CanvasRenderView } from "./canvas-render-view";
import { GeneratingOverlay } from "./generating-overlay";
import { ShareDialog } from "../share-dialog";

export function CanvasPanel() {
  const t = useTranslations("home.workspace.canvas");
  const { canvasMode, setCanvasMode } = useFloorplanStore();

  return (
    <Tabs.Root
      value={canvasMode}
      onValueChange={(v) => setCanvasMode(v === "render" ? "render" : "chart")}
      className="relative flex h-full flex-col"
    >
      <Tabs.List className="flex shrink-0 items-center border-b border-fg-6 bg-fg-8">
        <TabTrigger value="chart">{t("tab.chart")}</TabTrigger>
        <TabTrigger value="render">{t("tab.render")}</TabTrigger>
        <div className="ml-auto px-3">
          <ShareDialog>
            <button
              type="button"
              className="border border-fg-6 bg-fg-9 px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-0 transition-colors hover:border-fg-0"
            >
              ↗ {t("shareCta")}
            </button>
          </ShareDialog>
        </div>
      </Tabs.List>

      {/* Shared relative container — both Tabs.Content overlay here with
          absolute positioning so they don't stack vertically. */}
      <div className="relative flex-1 overflow-hidden">
        <TabPane value="chart" active={canvasMode === "chart"}>
          <CanvasChartView />
        </TabPane>
        <TabPane value="render" active={canvasMode === "render"}>
          <CanvasRenderView />
        </TabPane>
        <GeneratingOverlay />
      </div>
    </Tabs.Root>
  );
}

function TabPane({
  value,
  active,
  children,
}: {
  readonly value: string;
  readonly active: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Tabs.Content
      value={value}
      forceMount
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
      className="relative h-10 px-4 font-mono text-small text-fg-3 transition-colors hover:text-fg-0 data-[state=active]:text-fg-0 data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-4 data-[state=active]:after:right-4 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-accent-signal"
    >
      {children}
    </Tabs.Trigger>
  );
}
