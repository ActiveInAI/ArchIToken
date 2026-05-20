"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import type { Project } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { cardHover } from "@/lib/motion-presets";
import { useStudioViewStore } from "@/stores/studio-view.store";

export interface StudioProjectCardProps {
  readonly project: Project;
}

const statusTone: Record<Project["status"], string> = {
  draft: "text-fg-4",
  generating: "text-accent-lime",
  ready: "text-fg-8",
  archived: "text-fg-3",
};

export function StudioProjectCard({ project }: StudioProjectCardProps) {
  const tStatus = useTranslations("project.status");
  const format = useFormatter();
  const openExistingProject = useStudioViewStore((s) => s.openExistingProject);
  const relative = format.relativeTime(project.updatedAt);

  return (
    <motion.button
      type="button"
      {...cardHover}
      onClick={() => openExistingProject(project.id)}
      className="group relative flex flex-col overflow-hidden border border-fg-2 bg-fg-1 text-left transition-colors hover:border-accent-lime"
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-fg-0">
        <Image
          src={project.thumbnail}
          alt=""
          width={240}
          height={160}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        <div className="truncate font-semibold text-fg-8">{project.name}</div>
        <div className="font-mono text-micro text-fg-4">
          {project.area ? `${project.area} ft²` : ""}
          {project.bedrooms !== undefined && project.bedrooms > 0
            ? ` · ${project.bedrooms} BR`
            : ""}
          {` · ${relative}`}
        </div>
        <div className={cn("font-mono text-micro", statusTone[project.status])}>
          ● {tStatus(project.status)}
        </div>
      </div>
    </motion.button>
  );
}
