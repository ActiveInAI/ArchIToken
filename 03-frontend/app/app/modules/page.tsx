// app/app/modules/page.tsx - ArchIToken business module workbench entry
// License: Apache-2.0

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BusinessModuleWorkbench } from "@/components/BusinessModuleWorkbench";
import { normalizeModuleId, type ModuleId } from "@/lib/module-registry";

export const metadata: Metadata = {
  title: "业务模块工作台",
  description:
    "ArchIToken 16-module operational workbench for personal center, marketing service, planning, concept design, standard library, detailed design, costing, logistics, production manufacturing, construction management, digital twin, archive, finance management, human resources, AI center, and settings.",
};

export default async function ModulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialModuleId =
    normalizeModuleId(resolvedSearchParams.module ?? "") ?? "personal_center";
  const cookieStore = await cookies();
  const initialSidebarCompact =
    cookieStore.get("architoken.moduleSidebarCompact")?.value === "true";
  const initialOpenDirectoryModuleIds = parseOpenModuleDirectoryIds(
    cookieStore.get("architoken.openModuleDirectoryIds")?.value,
  );

  return (
    <BusinessModuleWorkbench
      initialModuleId={initialModuleId}
      initialSidebarCompact={initialSidebarCompact}
      initialOpenDirectoryModuleIds={initialOpenDirectoryModuleIds}
    />
  );
}

function parseOpenModuleDirectoryIds(value: string | undefined): ModuleId[] {
  if (!value) return [];
  return Array.from(
    new Set(
      decodeURIComponent(value)
        .split(",")
        .map((moduleId) => normalizeModuleId(moduleId))
        .filter((moduleId): moduleId is ModuleId => Boolean(moduleId)),
    ),
  );
}
