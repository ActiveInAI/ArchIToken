"use client";

import { useTranslations } from "next-intl";
import type { Project } from "@/lib/insome/types";
import { ProjectCard } from "./project-card";
import { NewProjectButton } from "./new-project-button";
import { DashboardEmptyState } from "./empty-state";

export interface ProjectGridProps {
  readonly projects: ReadonlyArray<Project>;
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const t = useTranslations("home.dashboard");
  const hasProjects = projects.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-landing flex-col gap-8 px-10 py-16">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h1 className="mt-2 font-display text-[48px] font-extrabold tracking-tight">
            {t("title")}
          </h1>
        </div>
      </header>

      {hasProjects ? (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          <NewProjectButton />
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NewProjectButton />
          <DashboardEmptyState />
        </section>
      )}
    </main>
  );
}
