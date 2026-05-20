"use client";

import { useTranslations } from "next-intl";
import { HELP_FAQ } from "@/content/help-faq";
import { groupByCategory } from "@/content/keyboard-shortcuts";

export function HelpPanel() {
  const t = useTranslations();
  const groups = groupByCategory();
  return (
    <div className="flex flex-col gap-5 p-4">
      <section>
        <h3 className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {t("studio.help.shortcutsHeader")}
        </h3>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="mb-1.5 font-mono text-[10px] tracking-eyebrow uppercase text-fg-4">
                {t(`studio.shortcuts.category.${g.category}`)}
              </div>
              <ul className="space-y-1">
                {g.entries.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-small text-fg-8">
                    <span>{t(s.labelKey)}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, kI) => (
                        <kbd
                          key={kI}
                          className="min-w-[1.5rem] border border-fg-2 bg-fg-1 px-1.5 py-0.5 text-center font-mono text-[10px] text-fg-8"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {t("studio.help.faqHeader")}
        </h3>
        <div className="flex flex-col gap-3">
          {HELP_FAQ.map((item) => (
            <div key={item.id} className="flex flex-col gap-1 border-b border-fg-2 pb-3">
              <span className="font-mono text-micro tracking-eyebrow uppercase text-accent-lime">
                {t(item.questionKey)}
              </span>
              <p className="text-small text-fg-8">{t(item.answerKey)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
