"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { groupByCategory } from "@/content/keyboard-shortcuts";

export interface ShortcutsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const t = useTranslations();
  const groups = groupByCategory();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-9/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-fg-2 bg-fg-0 p-6 shadow-xl">
          <Dialog.Title className="mb-4 font-display text-h3 font-bold tracking-tight text-fg-8">
            {t("studio.shortcuts.dialogTitle")}
          </Dialog.Title>
          <Dialog.Description className="mb-6 font-mono text-micro text-fg-4">
            {t("studio.shortcuts.dialogSubtitle")}
          </Dialog.Description>
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.category}>
                <h3 className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
                  {t(`studio.shortcuts.category.${g.category}`)}
                </h3>
                <ul className="space-y-2">
                  {g.entries.map((s, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-small text-fg-8">{t(s.labelKey)}</span>
                      <span className="flex items-center gap-1">
                        {s.keys.map((k, kI) => (
                          <kbd
                            key={kI}
                            className="min-w-[1.75rem] border border-fg-2 bg-fg-1 px-2 py-0.5 text-center font-mono text-micro text-fg-8"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
