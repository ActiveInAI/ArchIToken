"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { sceneFromFloorplan } from "@/lib/insome/scene";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { downloadSvgAsPng } from "@/lib/export/svg-to-png";
import { downloadObjFromScene } from "@/lib/export/scene-to-obj";

interface FormatDef {
  readonly id: string;
  readonly labelKey: string;
  readonly disabled?: boolean;
}

const TWO_D_FORMATS: ReadonlyArray<FormatDef> = [
  { id: "png", labelKey: "studio.export.png" },
  { id: "pdf", labelKey: "studio.export.pdf", disabled: true },
  { id: "dxf", labelKey: "studio.export.dxf", disabled: true },
];

const THREE_D_FORMATS: ReadonlyArray<FormatDef> = [
  { id: "obj", labelKey: "studio.export.obj" },
  { id: "glb", labelKey: "studio.export.glb", disabled: true },
  { id: "gltf", labelKey: "studio.export.gltf", disabled: true },
];

export interface ExportDialogProps {
  readonly children: ReactNode;
}

export function ExportDialog({ children }: ExportDialogProps) {
  const t = useTranslations("studio.export");
  const [includeMeasurements, setIncludeMeasurements] = useState(true);
  const floorplan = useStudioEditorStore((s) => s.activeFloorplan);

  const handleExport = async (fmt: string) => {
    if (fmt === "png") {
      const svg = document.querySelector<SVGSVGElement>(".insome-floorplan");
      if (!svg) {
        toast(t("pngFailed"));
        return;
      }
      try {
        await downloadSvgAsPng(svg, {
          filename: `floorplan-${Date.now()}.png`,
          scale: 2,
          background: "#FFFFFF",
        });
        toast(t("pngSuccess"));
      } catch (e) {
        console.error(e);
        toast(t("pngFailed"));
      }
      void includeMeasurements;
      return;
    }
    if (fmt === "obj") {
      if (!floorplan) {
        toast(t("objFailed"));
        return;
      }
      try {
        const scene = sceneFromFloorplan(floorplan);
        downloadObjFromScene(scene, `floorplan-${Date.now()}.obj`);
        toast(t("objSuccess"));
      } catch (e) {
        console.error(e);
        toast(t("objFailed"));
      }
      return;
    }
    toast(t("comingSoon", { format: fmt.toUpperCase() }));
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-0/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 border border-fg-2 bg-fg-1 p-6 shadow-lift">
          <div>
            <Dialog.Title className="font-display text-h3 font-bold tracking-tight text-fg-8">
              {t("title")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-small text-fg-4">
              {t("description")}
            </Dialog.Description>
          </div>

          <Section titleKey="studio.export.section2d" formats={TWO_D_FORMATS} onExport={handleExport} />
          <Section titleKey="studio.export.section3d" formats={THREE_D_FORMATS} onExport={handleExport} />

          <label className="flex items-center gap-2 text-small text-fg-8">
            <input
              type="checkbox"
              checked={includeMeasurements}
              onChange={(e) => setIncludeMeasurements(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent-lime"
            />
            {t("includeMeasurements")}
          </label>

          <div className="flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-fg-8"
              >
                {t("close")}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({
  titleKey,
  formats,
  onExport,
}: {
  readonly titleKey: string;
  readonly formats: ReadonlyArray<FormatDef>;
  readonly onExport: (fmt: string) => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <div className="mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t(titleKey)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {formats.map((fmt) => (
          <button
            key={fmt.id}
            type="button"
            disabled={fmt.disabled}
            onClick={() => onExport(fmt.id)}
            className={cn(
              "flex flex-col items-center gap-1 border bg-fg-0 py-3 font-mono text-micro tracking-eyebrow uppercase transition-colors",
              fmt.disabled
                ? "border-fg-2 text-fg-3 cursor-not-allowed"
                : "border-fg-2 text-fg-8 hover:border-accent-lime hover:text-accent-lime",
            )}
          >
            <span className="font-display text-h4 font-bold tracking-tight">
              {t(fmt.labelKey)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
