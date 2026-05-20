"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/* TODO(phase-4): produce a real short link via POST /api/share and stream progress. */
const DEMO_SHARE_LINK = "insome.app/p/k2f9x7h4m";

export interface ShareDialogProps {
  readonly children: ReactNode;
}

export function ShareDialog({ children }: ShareDialogProps) {
  const t = useTranslations("home.share");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`https://${DEMO_SHARE_LINK}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignored; clipboard may be blocked in iframe */
    }
  };

  /* TODO(phase-4): wire real PNG / PDF / DWG export pipeline */
  const handleExport = (format: string) => {
    if (typeof window !== "undefined") window.alert(`${t("exportComingSoon")} · ${format}`);
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-0/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[min(480px,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 border border-fg-6 bg-fg-9 p-6 shadow-lift">
          <div>
            <Dialog.Title className="font-display text-h3 font-bold tracking-tight text-fg-0">
              {t("title")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-small text-fg-3">
              {t("description")}
            </Dialog.Description>
          </div>

          <div>
            <div className="mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-3">
              {t("linkLabel")}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate border border-fg-6 bg-fg-8 px-3 py-2 font-mono text-small text-fg-0">
                https://{DEMO_SHARE_LINK}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="border border-fg-0 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-9 transition-colors hover:bg-fg-2"
              >
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <ExportButton onClick={() => handleExport("PNG")}>{t("exportPng")}</ExportButton>
            <ExportButton onClick={() => handleExport("PDF")}>{t("exportPdf")}</ExportButton>
            <ExportButton onClick={() => handleExport("DWG")}>{t("exportDwg")}</ExportButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExportButton({
  onClick,
  children,
}: {
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 border border-fg-6 bg-fg-9 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-0 transition-colors hover:border-fg-0"
    >
      {children}
    </button>
  );
}
