import type { Metadata } from "next";
import { ProjectManagementWorkbench } from "@/components/project/project-management-workbench";
import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { UnifiedNav } from "@/components/shared/unified-nav";

export const metadata: Metadata = {
  title: "项目管理",
  description: "ArchIToken 计划项目、在建项目和完成项目管理入口。",
};

export default function ProjectPage() {
  return (
    <>
      <PageThemeMount theme="light" />
      <UnifiedNav variant="home" />
      <ProjectManagementWorkbench />
    </>
  );
}
