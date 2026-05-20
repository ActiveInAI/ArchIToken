"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { mockTemplates, type TemplateMeta } from "@/content/templates.mock";
import { TemplateCard } from "./template-card";
import { GalleryFiltersBar, type GalleryFilters } from "./gallery-filters";
import { TemplateDetailDialog } from "./template-detail-dialog";

export interface TemplateGalleryProps {
  readonly onAskAiRemix: (templateId: string) => void;
}

export function TemplateGalleryMasonry({ onAskAiRemix }: TemplateGalleryProps) {
  const t = useTranslations("home.template.gallery");
  const [filters, setFilters] = useState<GalleryFilters>({ style: "all", houseType: "all" });
  const [openTemplate, setOpenTemplate] = useState<TemplateMeta | null>(null);

  const visible = useMemo(() => {
    return mockTemplates.filter((tpl) => {
      if (filters.style !== "all" && tpl.styleKey !== filters.style) return false;
      if (filters.houseType !== "all" && tpl.houseType !== filters.houseType) return false;
      return true;
    });
  }, [filters]);

  return (
    <div className="mx-auto flex w-full max-w-landing flex-col gap-8 px-10 py-12">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
          {t("eyebrow")}
        </div>
        <h1 className="font-display text-[52px] font-extrabold leading-[1.05] tracking-tight text-fg-0">
          {t("title")}
        </h1>
        <p className="max-w-[56ch] text-body text-fg-3">{t("subtitle")}</p>
      </header>

      <GalleryFiltersBar value={filters} onChange={setFilters} />

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-micro text-fg-3">
            {t("empty")}
          </div>
        ) : (
          visible.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} onOpen={(id) => {
              const match = mockTemplates.find((t) => t.id === id);
              if (match) setOpenTemplate(match);
            }} />
          ))
        )}
      </section>

      <TemplateDetailDialog
        template={openTemplate}
        open={openTemplate !== null}
        onOpenChange={(v) => { if (!v) setOpenTemplate(null); }}
        onAskAiRemix={onAskAiRemix}
      />
    </div>
  );
}
