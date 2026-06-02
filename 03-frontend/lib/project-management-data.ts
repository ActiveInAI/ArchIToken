// lib/project-management-data.ts - Shared project management seed data
// License: Apache-2.0

export type ProjectStage = "planned" | "active" | "completed";

export interface ManagedProject {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly stage: ProjectStage;
  readonly summary: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly manager: string;
  readonly funding: string;
  readonly images: ReadonlyArray<string>;
  readonly isPrivate?: boolean;
  readonly deletedAt?: string;
}

export const projectManagementStorageKey =
  "architoken.project-management.projects.v1";

export const defaultPlanningProjectId =
  "project-active-malaysia-johor-heavy-steel";

export const projectStageOrder: ReadonlyArray<ProjectStage> = [
  "planned",
  "active",
  "completed",
];

export const projectManagementSeedProjects: ReadonlyArray<ManagedProject> = [
  {
    id: defaultPlanningProjectId,
    name: "马来西亚柔佛 1-2 层重钢结构项目集群",
    location: "马来西亚柔佛",
    stage: "active",
    summary: "柔佛 1-2 层重钢结构别墅、厂房、亭阁与移交闭环的总控计划项目。",
    startDate: "2026-05-01",
    endDate: "2026-12-31",
    manager: "项目经理",
    funding: "MYR 总控",
    images: ["/assets/projects-photo/villa-pool.svg"],
  },
  {
    id: "project-planned-coastal-villa",
    name: "三亚海景装配式别墅",
    location: "海南三亚",
    stage: "planned",
    summary: "海景低密住宅方案，当前用于方案比较、资金测算和项目计划编排。",
    startDate: "2026-06-10",
    endDate: "2026-11-28",
    manager: "林青",
    funding: "2200 万",
    images: ["/assets/projects-photo/villa-pool.svg"],
  },
  {
    id: "project-planned-urban-renewal",
    name: "城市更新样板社区",
    location: "广东深圳",
    stage: "planned",
    summary: "面向旧改片区的模块化住宅样板，准备进入 CDE 文件和审批资料整理。",
    startDate: "2026-07-01",
    endDate: "2027-01-20",
    manager: "周启明",
    funding: "4800 万",
    images: ["/assets/projects/thumb-urban.svg"],
  },
  {
    id: "project-planned-camp",
    name: "轻钢营地接待中心",
    location: "云南大理",
    stage: "planned",
    summary:
      "面向文旅营地的接待中心和客房组合，当前处于方案计划和建设资金校核阶段。",
    startDate: "2026-08-15",
    endDate: "2027-02-10",
    manager: "赵雨",
    funding: "2600 万",
    images: ["/assets/projects-photo/camp.svg"],
  },
  {
    id: "project-active-resort",
    name: "海岸度假营地一期",
    location: "广西北海",
    stage: "active",
    summary:
      "游客中心、轻型客房和景观平台同步推进，重点跟踪生产、物流和现场安装。",
    startDate: "2026-03-18",
    endDate: "2026-09-30",
    manager: "陈韦",
    funding: "3600 万",
    images: ["/assets/projects-photo/resort.svg"],
  },
  {
    id: "project-active-alpine-hotel",
    name: "山地精品酒店样板段",
    location: "四川阿坝",
    stage: "active",
    summary: "重钢客房样板段在建，当前关注深化模型、构件编码和现场吊装节奏。",
    startDate: "2026-02-12",
    endDate: "2026-08-25",
    manager: "何文",
    funding: "5200 万",
    images: ["/assets/projects-photo/alpine.svg"],
  },
  {
    id: "project-completed-ryokan",
    name: "温泉旅居样板院",
    location: "浙江湖州",
    stage: "completed",
    summary: "已完成交付和数字档案整理，可作为项目复盘和后续同类型方案参考。",
    startDate: "2025-08-05",
    endDate: "2026-01-16",
    manager: "许岚",
    funding: "3100 万",
    images: ["/assets/projects-photo/ryokan.svg"],
  },
  {
    id: "project-completed-interior",
    name: "模块化精装公寓试点",
    location: "上海浦东",
    stage: "completed",
    summary: "完成样板套交付、材料清单复盘和运维问题闭环，进入案例资料维护。",
    startDate: "2025-05-20",
    endDate: "2025-12-18",
    manager: "王亦辰",
    funding: "1800 万",
    images: ["/assets/projects-photo/interior.svg"],
  },
];

export function loadProjectManagementProjects(): ReadonlyArray<ManagedProject> {
  if (typeof window === "undefined") {
    return projectManagementSeedProjects;
  }

  const stored = window.localStorage.getItem(projectManagementStorageKey);
  if (!stored) {
    return projectManagementSeedProjects;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return isManagedProjectArray(parsed)
      ? reconcileProjectManagementProjects(parsed)
      : projectManagementSeedProjects;
  } catch {
    window.localStorage.removeItem(projectManagementStorageKey);
    return projectManagementSeedProjects;
  }
}

export function saveProjectManagementProjects(
  projects: ReadonlyArray<ManagedProject>,
): ReadonlyArray<ManagedProject> {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      projectManagementStorageKey,
      JSON.stringify(projects),
    );
  }
  return projects;
}

export function renameProjectManagementProject(
  projectId: string,
  projectName: string,
): ReadonlyArray<ManagedProject> {
  const nextName = projectName.trim();
  if (!nextName) {
    return loadProjectManagementProjects();
  }
  const projects = loadProjectManagementProjects();
  return saveProjectManagementProjects(
    projects.map((project) =>
      project.id === projectId ? { ...project, name: nextName } : project,
    ),
  );
}

export function getVisibleProjectManagementProjects(
  projects: ReadonlyArray<ManagedProject> = loadProjectManagementProjects(),
): ReadonlyArray<ManagedProject> {
  return projects.filter((project) => !project.deletedAt);
}

export function getDigitalArchiveProjectFolderId(projectId: string): string {
  return `digital_archive-project-${projectId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function getPlanningProjectFolderId(projectId: string): string {
  return `planning_management-project-${projectId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function reconcileProjectManagementProjects(
  storedProjects: ReadonlyArray<ManagedProject>,
): ReadonlyArray<ManagedProject> {
  const storedById = new Map(
    storedProjects.map((project) => [project.id, project]),
  );
  const seedIds = new Set(
    projectManagementSeedProjects.map((project) => project.id),
  );
  const updatedSeedProjects = projectManagementSeedProjects.map(
    (project) => storedById.get(project.id) ?? project,
  );
  const customProjects = storedProjects.filter(
    (project) => !seedIds.has(project.id),
  );
  return [...updatedSeedProjects, ...customProjects];
}

export function isManagedProjectArray(
  value: unknown,
): value is ReadonlyArray<ManagedProject> {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const project = item as Partial<ManagedProject>;
    return (
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      typeof project.location === "string" &&
      (project.stage === "planned" ||
        project.stage === "active" ||
        project.stage === "completed") &&
      typeof project.summary === "string" &&
      typeof project.startDate === "string" &&
      typeof project.endDate === "string" &&
      typeof project.manager === "string" &&
      typeof project.funding === "string" &&
      Array.isArray(project.images) &&
      project.images.every((image) => typeof image === "string")
    );
  });
}
