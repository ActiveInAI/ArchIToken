"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import type { Project } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { cardHover } from "@/lib/motion-presets";
import { useHomeViewStore } from "@/stores/home-view.store";

export interface ProjectCardProps {
  readonly project: Project;
}

const statusTone: Record<Project["status"], string> = {
  draft: "text-fg-3",
  generating: "text-accent-signal",
  ready: "text-fg-0",
  archived: "text-fg-4",
};

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations("home.dashboard.projectCard");
  const tStatus = useTranslations("project.status");
  const format = useFormatter();
  const openProject = useHomeViewStore((s) => s.openProject);
  const relative = format.relativeTime(project.updatedAt);
  const areaSuffix = project.unit === "ft" ? "ft²" : "㎡";

  return (
    <motion.button
      type="button"
      {...cardHover}
      onClick={() => openProject(project.id)}
      className="group relative flex flex-col overflow-hidden border border-fg-6 bg-fg-9 text-left transition-colors hover:border-fg-0"
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-fg-7">
        <Image
          src={project.thumbnail}
          alt=""
          width={240}
          height={160}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        <div className="truncate font-semibold text-fg-0">{project.name}</div>
        <div className="font-mono text-micro text-fg-3">
          {project.area ? `${project.area} ${areaSuffix}` : ""}
          {project.bedrooms !== undefined ? ` · ${t("bedrooms", { count: project.bedrooms })}` : ""}
          {` · ${t("updated", { relative })}`}
        </div>
        <div className={cn("font-mono text-micro", statusTone[project.status])}>
          ● {tStatus(project.status)}
        </div>
      </div>
    </motion.button>
  );
}
