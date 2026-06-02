// app/app/projects/page.tsx — Projects listing
// License: Apache-2.0
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import { api, type Project } from "@/lib/api";
import { getModuleSpec } from "@/lib/module-registry";

export default function ProjectsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list({ pageSize: 50 }),
  });

  return (
    <main className="container mx-auto px-6 py-12">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-5xl font-medium">项目</h1>
          <p className="mt-2 text-ink/70">
            所有项目 · 共 {data?.total ?? 0} 个
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/modules"
            className="border border-ink px-5 py-2 font-mono text-sm hover:bg-paper"
          >
            业务模块工作台
          </Link>
          <Link
            href="/app/modules/digital_twin"
            className="border border-ink px-5 py-2 font-mono text-sm hover:bg-paper"
          >
            数字孪生工作台
          </Link>
          <Link
            href="/app/projects/new"
            className="bg-ink text-paper px-5 py-2 font-mono text-sm hover:bg-accent"
          >
            + 新建项目
          </Link>
        </div>
      </div>

      {isLoading && (
        <ArchLoadingFlow
          label="正在加载项目"
          size="panel"
          showLabel
          className="text-ink/60"
        />
      )}
      {error && (
        <p className="text-accent">
          加载失败:{(error as { error?: string }).error ?? "未知错误"}
        </p>
      )}

      {data && data.items.length === 0 && (
        <div className="border-2 border-dashed border-ink/20 p-16 text-center">
          <p className="text-ink/60 mb-4">还没有项目</p>
          <Link
            href="/app/projects/new"
            className="text-accent underline font-mono text-sm"
          >
            创建第一个项目 →
          </Link>
        </div>
      )}

      <ul className="divide-y divide-ink/10 border border-ink/10">
        {data?.items.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </ul>
    </main>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/app/projects/${project.id}`}
        className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_120px] gap-4 px-6 py-5 hover:bg-paper/70 items-center"
      >
        <div>
          <div className="font-serif font-medium text-lg">{project.name}</div>
          {project.description && (
            <div className="text-sm text-ink/60 mt-1 line-clamp-1">
              {project.description}
            </div>
          )}
        </div>
        <div className="font-mono text-xs text-accent">
          {getModuleSpec(project.currentModuleId).zhName}
        </div>
        <div className="text-sm text-ink/70">{project.location ?? "—"}</div>
        <div className="text-sm text-right font-mono">
          {project.areaSqm ? `${project.areaSqm.toLocaleString()} ㎡` : "—"}
        </div>
      </Link>
    </li>
  );
}
