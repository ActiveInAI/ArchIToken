"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import type { TemplateMeta } from "@/content/templates.mock";
import { ClaimDialog } from "@/components/shared/claim-dialog";

export interface TemplateDetailDialogProps {
  readonly template: TemplateMeta | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAskAiRemix: (templateId: string) => void;
}

export function TemplateDetailDialog({ template, open, onOpenChange, onAskAiRemix }: TemplateDetailDialogProps) {
  const t = useTranslations();
  const tDetail = useTranslations("home.template.detail");
  const [claimOpen, setClaimOpen] = useState(false);
  if (!template) return null;
  const priceLow = Math.round(template.priceMin / 10_000);
  const priceHigh = Math.round(template.priceMax / 10_000);
  const priceText = priceLow === priceHigh ? `约 ${priceLow} 万` : `${priceLow} – ${priceHigh} 万`;

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-9/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[75dvh] max-h-[calc(100dvh-24px)] w-[75vw] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-fg-6 bg-fg-9 shadow-xl">
            <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[#E8E5DE] to-[#B5B1AB] lg:aspect-auto">
                <div className="w-full max-w-md p-6">
                  <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
                    <rect x="15" y="18" width="170" height="114" fill="none" stroke="#0A0A0A" strokeWidth="1.5" />
                    {Array.from({ length: template.bedrooms + 2 }).map((_, i) => (
                      <rect
                        key={i}
                        x={22 + (i % 3) * 56}
                        y={26 + Math.floor(i / 3) * 48}
                        width="48"
                        height="40"
                        fill="none"
                        stroke="#0A0A0A"
                        strokeWidth="1"
                        opacity={0.3 + i * 0.1}
                      />
                    ))}
                  </svg>
                </div>
              </div>
              <div className="flex flex-col overflow-y-auto p-8">
                <Dialog.Title className="font-display text-h2 font-extrabold tracking-tight text-fg-0">
                  {t(template.nameKey)}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-body text-fg-3">
                  {t(template.descriptionKey)}
                </Dialog.Description>
                <div className="mt-5 grid grid-cols-3 gap-3 border-y border-fg-6 py-4">
                  <Stat label={tDetail("stat.area")} value={`${template.totalAreaSqm}㎡`} />
                  <Stat label={tDetail("stat.stories")} value={String(template.stories)} />
                  <Stat label={tDetail("stat.bedrooms")} value={String(template.bedrooms)} />
                </div>
                <div className="mt-5 flex flex-col gap-1">
                  <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
                    {tDetail("priceLabel")}
                  </span>
                  <span className="font-display text-h1 font-extrabold tracking-tight text-accent-signal">
                    {priceText}
                  </span>
                  <span className="font-mono text-micro text-fg-3">{tDetail("priceDisclaimer")}</span>
                </div>
                <div className="mt-auto flex flex-col gap-3 pt-8">
                  <button
                    type="button"
                    onClick={() => setClaimOpen(true)}
                    className="border border-accent-signal bg-accent-signal px-4 py-3 font-mono text-small tracking-eyebrow uppercase text-fg-9 transition-opacity hover:opacity-90"
                  >
                    ✨ {tDetail("cta.contact")}
                  </button>
                  {template.floorplan ? (
                    <button
                      type="button"
                      onClick={() => { onOpenChange(false); onAskAiRemix(template.id); }}
                      className="border border-fg-2 bg-fg-9 px-4 py-3 font-mono text-small tracking-eyebrow uppercase text-fg-0 transition-colors hover:border-accent-signal hover:text-accent-signal"
                    >
                      ✦ {tDetail("cta.aiRemix")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        source="home-template"
        {...(template.floorplan ? { floorplan: template.floorplan } : {})}
        projectId={template.id}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">{label}</span>
      <span className="font-display text-h3 font-bold tracking-tight text-fg-0">{value}</span>
    </div>
  );
}
