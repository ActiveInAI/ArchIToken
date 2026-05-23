"use client";

import type { ChangeEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coins,
  Eye,
  EyeOff,
  ImagePlus,
  MoreHorizontal,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/insome/ui";

type ProjectStage = "planned" | "active" | "completed";

interface ManagedProject {
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

interface StageMeta {
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly accentClass: string;
}

const PROJECT_STORAGE_KEY = "architoken.project-management.projects.v1";
const MODULES_HREF = "/app/modules";

const stageOrder: ReadonlyArray<ProjectStage> = ["planned", "active", "completed"];

const stageMeta: Record<ProjectStage, StageMeta> = {
  planned: {
    label: "计划项目",
    description: "处于立项、策划、方案确认和资源准备阶段。",
    icon: ClipboardList,
    accentClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  active: {
    label: "在建项目",
    description: "进入深化、采购、生产、施工或现场协同阶段。",
    icon: Clock3,
    accentClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  completed: {
    label: "完成项目",
    description: "已完成交付、归档或进入运维跟踪阶段。",
    icon: CheckCircle2,
    accentClass: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

const seedProjects: ReadonlyArray<ManagedProject> = [
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
    summary: "面向文旅营地的接待中心和客房组合，当前处于方案计划和建设资金校核阶段。",
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
    summary: "游客中心、轻型客房和景观平台同步推进，重点跟踪生产、物流和现场安装。",
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

export function ProjectManagementWorkbench() {
  const router = useRouter();
  const [projects, setProjects] = useState<ReadonlyArray<ManagedProject>>(loadInitialProjects);
  const [selectedStage, setSelectedStage] = useState<ProjectStage>("planned");

  useEffect(() => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.deletedAt),
    [projects],
  );
  const stageCounts = useMemo(
    () =>
      stageOrder.reduce<Record<ProjectStage, number>>(
        (counts, stage) => ({
          ...counts,
          [stage]: visibleProjects.filter((project) => project.stage === stage).length,
        }),
        { planned: 0, active: 0, completed: 0 },
      ),
    [visibleProjects],
  );
  const selectedStageMeta = stageMeta[selectedStage];
  const selectedProjects = useMemo(
    () => visibleProjects.filter((project) => project.stage === selectedStage),
    [visibleProjects, selectedStage],
  );

  const updateProject = (projectId: string, patch: Partial<Omit<ManagedProject, "id">>) => {
    setProjects((current) =>
      current.map((project) => (project.id === projectId ? { ...project, ...patch } : project)),
    );
  };

  const openModuleWorkbench = () => {
    router.push(MODULES_HREF);
  };

  const createProject = () => {
    const now = new Date();
    const startDate = toDateInputValue(now);
    const endDate = toDateInputValue(new Date(now.getTime() + 90 * 86_400_000));
    const nextProject: ManagedProject = {
      id: `project-custom-${now.getTime()}`,
      name: "新建项目",
      location: "待填写地点",
      stage: selectedStage,
      summary: "在这里直接编辑项目说明、建设范围和当前阶段目标。",
      startDate,
      endDate,
      manager: "待填写",
      funding: "待填写",
      images: [getDefaultCoverImage(selectedStage)],
      isPrivate: true,
    };

    setProjects((current) => [nextProject, ...current]);
  };

  const deleteProject = (projectId: string) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, deletedAt: new Date().toISOString() } : project,
      ),
    );
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="flex w-full max-w-none flex-col gap-5 px-6 py-5 lg:px-8 2xl:px-10">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              Project Management System
            </div>
            <h1 className="text-[28px] font-semibold leading-tight text-slate-950 md:text-[36px]">
              项目管理系统
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-600">
              统一管理计划项目、在建项目和完成项目。点击任意项目卡片进入业务系统模块，
              项目名称、地点、阶段和项目资料可直接编辑。
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="grid flex-1 gap-3 md:grid-cols-3">
              {stageOrder.map((stage) => {
                const meta = stageMeta[stage];
                const Icon = meta.icon;
                const selected = selectedStage === stage;
                return (
                  <button
                    type="button"
                    key={stage}
                    onClick={() => setSelectedStage(stage)}
                    className={cn(
                      "rounded-[8px] border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm",
                      meta.accentClass,
                      selected ? "ring-2 ring-[#07c160]/35" : "opacity-80 hover:opacity-100",
                    )}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="h-4 w-4" aria-hidden />
                        {meta.label}
                      </div>
                      <span className="text-xl font-semibold">{stageCounts[stage]}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 opacity-80">{meta.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 flex-wrap gap-3 xl:justify-end">
              <button
                type="button"
                onClick={createProject}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#07c160]/40 bg-emerald-50 px-4 text-sm font-semibold text-[#078f49] transition-colors hover:bg-emerald-100"
              >
                <Plus className="h-4 w-4" aria-hidden />
                新建项目
              </button>
              <button
                type="button"
                onClick={openModuleWorkbench}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-[#07c160] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#06ad56]"
              >
                业务系统
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-full max-w-none flex-col gap-10 px-6 py-5 lg:px-8 2xl:px-10">
        <section aria-label={selectedStageMeta.label}>
          <div className="grid gap-5 lg:grid-cols-3">
            {selectedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={openModuleWorkbench}
                onUpdate={updateProject}
                onDelete={deleteProject}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

interface ProjectCardProps {
  readonly project: ManagedProject;
  readonly onOpen: () => void;
  readonly onUpdate: (projectId: string, patch: Partial<Omit<ManagedProject, "id">>) => void;
  readonly onDelete: (projectId: string) => void;
}

function ProjectCard({
  project,
  onOpen,
  onUpdate,
  onDelete,
}: ProjectCardProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const imageCount = project.images.length;
  const activeImageIndex = Math.min(selectedImageIndex, Math.max(imageCount - 1, 0));
  const coverImage = project.images[activeImageIndex] ?? "/assets/projects/thumb-family.svg";

  const showPreviousImage = () => {
    if (imageCount <= 1) return;
    setSelectedImageIndex((index) => (Math.min(index, imageCount - 1) - 1 + imageCount) % imageCount);
  };

  const showNextImage = () => {
    if (imageCount <= 1) return;
    setSelectedImageIndex((index) => (Math.min(index, imageCount - 1) + 1) % imageCount);
  };

  const handleImageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (imageCount <= 1) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    if (clickX < bounds.width / 2) {
      showPreviousImage();
      return;
    }
    showNextImage();
  };

  const handleImageFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).slice(0, 5);
    if (!files.length) return;
    const images = await Promise.all(files.map(readImageFileAsDataUrl));
    onUpdate(project.id, { images });
    setSelectedImageIndex(0);
    event.currentTarget.value = "";
  };

  const handleDelete = () => {
    if (window.confirm(`确认删除项目「${project.name}」？`)) {
      onDelete(project.id);
    }
  };

  return (
    <article
      className="group overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#07c160]/60 hover:shadow-md"
      aria-label={project.name}
    >
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden bg-cover bg-center",
          imageCount > 1 ? "cursor-ew-resize" : "cursor-default",
        )}
        style={{ backgroundImage: `url(${coverImage})` }}
        onClick={handleImageClick}
      >
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-medium text-slate-700">
            {Math.min(activeImageIndex + 1, Math.max(imageCount, 1))}/{Math.max(imageCount, 1)}
          </span>
          <label
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <ImagePlus className="h-3.5 w-3.5 text-[#07c160]" aria-hidden />
            编辑图片
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFiles}
              className="sr-only"
            />
          </label>
        </div>
        {imageCount > 1 ? (
          <>
            <button
              type="button"
              aria-label="上一张项目图片"
              onClick={(event) => {
                event.stopPropagation();
                showPreviousImage();
              }}
              className="absolute bottom-0 left-0 top-0 inline-flex w-20 items-center justify-start gap-1 bg-gradient-to-r from-black/35 to-transparent px-4 text-[12px] font-semibold text-white opacity-90 transition-opacity hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
              上一张
            </button>
            <button
              type="button"
              aria-label="下一张项目图片"
              onClick={(event) => {
                event.stopPropagation();
                showNextImage();
              }}
              className="absolute bottom-0 right-0 top-0 inline-flex w-20 items-center justify-end gap-1 bg-gradient-to-l from-black/35 to-transparent px-4 text-[12px] font-semibold text-white opacity-90 transition-opacity hover:opacity-100"
            >
              下一张
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      <div className="space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <div className="rounded-[8px] border border-slate-200 bg-white px-3 py-3">
          <label className="block">
            <span className="sr-only">项目名称</span>
            <input
              value={project.name}
              onChange={(event) => onUpdate(project.id, { name: event.currentTarget.value })}
              className="h-8 w-full min-w-0 rounded-[4px] border-0 bg-transparent text-[18px] font-semibold leading-tight text-slate-950 outline-none focus:bg-slate-50"
              placeholder="项目名称"
            />
          </label>
          <label className="mt-1 block">
            <span className="sr-only">项目说明</span>
            <textarea
              value={project.summary}
              onChange={(event) => onUpdate(project.id, { summary: event.currentTarget.value })}
              rows={2}
              className="w-full resize-none rounded-[4px] border-0 bg-transparent text-sm leading-6 text-slate-600 outline-none focus:bg-slate-50"
              placeholder="项目说明"
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <StageSelectField
            label="项目状态"
            value={project.stage}
            icon={ClipboardList}
            onChange={(stage) => onUpdate(project.id, { stage })}
          />
          <EditableField
            label="起始日期"
            type="date"
            value={project.startDate}
            icon={CalendarDays}
            onChange={(value) => onUpdate(project.id, { startDate: value })}
          />
          <EditableField
            label="结束日期"
            type="date"
            value={project.endDate}
            icon={CalendarDays}
            onChange={(value) => onUpdate(project.id, { endDate: value })}
          />
          <EditableField
            label="项目经理"
            type="text"
            value={project.manager}
            icon={UserRound}
            onChange={(value) => onUpdate(project.id, { manager: value })}
          />
          <EditableField
            label="建设资金"
            type="text"
            value={project.funding}
            icon={Coins}
            onChange={(value) => onUpdate(project.id, { funding: value })}
          />
          <EditableField
            label="项目地点"
            type="text"
            value={project.location}
            icon={Building2}
            onChange={(value) => onUpdate(project.id, { location: value })}
          />
        </div>
        <ProjectActionBar
          isPrivate={Boolean(project.isPrivate)}
          onOpen={onOpen}
          onTogglePrivate={() => onUpdate(project.id, { isPrivate: !project.isPrivate })}
          onDelete={handleDelete}
        />
      </div>
    </article>
  );
}

interface ProjectActionBarProps {
  readonly isPrivate: boolean;
  readonly onOpen: () => void;
  readonly onTogglePrivate: () => void;
  readonly onDelete: () => void;
}

function ProjectActionBar({ isPrivate, onOpen, onTogglePrivate, onDelete }: ProjectActionBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
      <button
        type="button"
        aria-pressed={isPrivate}
        onClick={onTogglePrivate}
        className={cn(
          "inline-flex h-9 min-w-0 items-center gap-2 rounded-[6px] border bg-white px-3 text-[12px] font-semibold transition-colors",
          isPrivate
            ? "border-slate-300 text-slate-700 hover:bg-slate-100"
            : "border-[#07c160]/35 text-[#078f49] hover:bg-emerald-50",
        )}
      >
        {isPrivate ? (
          <EyeOff className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <Eye className="h-4 w-4 shrink-0 text-[#07c160]" aria-hidden />
        )}
        <span className="truncate">{isPrivate ? "私密项目" : "公开项目"}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] bg-[#07c160] px-4 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#06ad56]"
        >
          业务系统
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="更多项目操作"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
          {isMenuOpen ? (
            <div className="absolute bottom-11 right-0 z-20 w-32 rounded-[8px] border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete();
                }}
                className="flex h-9 w-full items-center gap-2 rounded-[6px] px-3 text-left text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                删除项目
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface StageSelectFieldProps {
  readonly label: string;
  readonly value: ProjectStage;
  readonly icon: LucideIcon;
  readonly onChange: (value: ProjectStage) => void;
}

function StageSelectField({ label, value, icon: Icon, onChange }: StageSelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 rounded-[8px] border border-slate-200 bg-white px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5 text-[#07c160]" aria-hidden />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as ProjectStage)}
        className="h-8 min-w-0 rounded-[4px] border-0 bg-transparent text-sm font-semibold text-slate-950 outline-none focus:bg-slate-50"
      >
        {stageOrder.map((stage) => (
          <option key={stage} value={stage}>
            {stageMeta[stage].label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface EditableFieldProps {
  readonly label: string;
  readonly type: "date" | "text";
  readonly value: string;
  readonly icon: LucideIcon;
  readonly onChange: (value: string) => void;
}

function EditableField({ label, type, value, icon: Icon, onChange }: EditableFieldProps) {
  return (
    <label className="flex flex-col gap-1 rounded-[8px] border border-slate-200 bg-white px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5 text-[#07c160]" aria-hidden />
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-8 min-w-0 rounded-[4px] border-0 bg-transparent text-sm font-semibold text-slate-950 outline-none focus:bg-slate-50"
      />
    </label>
  );
}

function loadInitialProjects(): ReadonlyArray<ManagedProject> {
  if (typeof window === "undefined") return seedProjects;

  const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!stored) return seedProjects;

  try {
    const parsed = JSON.parse(stored) as unknown;
    return isManagedProjectArray(parsed) ? reconcileSeedProjects(parsed) : seedProjects;
  } catch {
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    return seedProjects;
  }
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDefaultCoverImage(stage: ProjectStage): string {
  if (stage === "active") return "/assets/projects-photo/resort.svg";
  if (stage === "completed") return "/assets/projects-photo/interior.svg";
  return "/assets/projects-photo/camp.svg";
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("图片读取失败"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function reconcileSeedProjects(storedProjects: ReadonlyArray<ManagedProject>): ReadonlyArray<ManagedProject> {
  const storedById = new Map(storedProjects.map((project) => [project.id, project]));
  const seedIds = new Set(seedProjects.map((project) => project.id));
  const updatedSeedProjects = seedProjects.map((project) => storedById.get(project.id) ?? project);
  const customProjects = storedProjects.filter((project) => !seedIds.has(project.id));
  return [...updatedSeedProjects, ...customProjects];
}

function isManagedProjectArray(value: unknown): value is ReadonlyArray<ManagedProject> {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const project = item as Partial<ManagedProject>;
    return (
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      typeof project.location === "string" &&
      (project.stage === "planned" || project.stage === "active" || project.stage === "completed") &&
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
