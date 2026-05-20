"use client";

import { useTranslations } from "next-intl";
import type { Project } from "@/lib/insome/types";
import { StudioProjectCard } from "./project-card";
import { StudioNewProjectCard } from "./new-project-card";

export interface StudioProjectGridProps {
  readonly projects: ReadonlyArray<Project>;
}

export function StudioProjectGrid({ projects }: StudioProjectGridProps) {
  const t = useTranslations("studio.projects");

  return (
    <main className="mx-auto flex w-full max-w-landing flex-col gap-8 px-10 py-16">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow text-fg-4">{t("eyebrow")}</div>
          <h1 className="mt-2 font-display text-[48px] font-extrabold tracking-tight text-fg-8">
            {t("title")}
          </h1>
        </div>
      </header>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        <StudioNewProjectCard />
        {projects.map((p) => (
          <StudioProjectCard key={p.id} project={p} />
        ))}
      </section>
    </main>
  );
}
