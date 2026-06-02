// components/FeichuanPlanningWorkbench.tsx - Engineering schedule planning engine
// License: Apache-2.0
"use client";

import {
  AppstoreOutlined,
  BranchesOutlined,
  DownOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  PlayCircleFilled,
  PlusCircleOutlined,
  ProjectOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import type {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import {
  FileContextMenu,
  type FileContextAction,
} from "@/components/FileContextMenu";
import { createModuleAuditEvent } from "@/lib/module-actions";
import { moduleBackendAdapter } from "@/lib/module-backend-adapter";
import {
  architokenPendingPlanningProjectSelectionKey,
  architokenPlanningProjectSelectionEventName,
  type ArchitokenPlanningProjectSelectionRequest,
} from "@/lib/module-dialog-events";
import type { LocalFileMetadata } from "@/lib/local-file-runtime";
import {
  getModuleRootId,
  type ModuleAuditEvent,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import { defaultPlanningProjectId } from "@/lib/project-management-data";
import {
  applyPlanningScheduleAdjustment,
  createDefaultProjectPlanningModel,
  createPlanningBinaryExport,
  createPlanningExport,
  createPlanningVersion,
  deriveEarnedValueMetrics,
  deriveGovernanceEvidenceSummary,
  deriveNetworkSchedule,
  derivePlanningAnalytics,
  derivePlanningStandardsCoverage,
  derivePlanningSummary,
  deriveProfessionalSignoffSummary,
  deriveResourceLoadAnalysis,
  deriveScheduleAlerts,
  deriveTaskPlannedProgress,
  deriveWorkingCalendarMetrics,
  getPlanningProfessionalRoleLabel,
  type PlanningBinaryExportKind,
  type PlanningTask,
  type PlanningTaskStatus,
  type PlanningTextExportKind,
  type ProjectPlanningModel,
} from "@/lib/project-planning-studio";

type NetworkView = "time-network" | "adm" | "pert";
type ProjectChartView =
  | "flowchart"
  | "mindmap"
  | "wbs"
  | "matrix"
  | "analysis"
  | "fishbone"
  | "burndown"
  | "burnup"
  | "resource-histogram"
  | "risk-matrix"
  | "raci"
  | "value-stream"
  | "swot";
type ScheduleView = "gantt" | NetworkView | ProjectChartView;
type DiagramView = ProjectChartView;
type ScheduleScale = "day" | "week" | "month";
type ScheduleStatus = "normal" | "ahead" | "warning" | "delayed" | "future";
type PlanningRasterExportKind = "png" | "jpg";
type PlanningExportKind =
  | PlanningTextExportKind
  | PlanningBinaryExportKind
  | PlanningRasterExportKind;
type AddTaskMode = "child" | "after" | "parent";
type GraphEditMode = "progress" | "task";
type GanttDragMode = "move" | "progress" | "resize-start" | "resize-end";
type DiagramFrameStyle = "rect" | "round" | "pill";
type DiagramConnectorStyle = "elbow" | "straight" | "curve" | "dashed";
type PlanningControlKey =
  | "spi"
  | "cpi"
  | "planned"
  | "actual"
  | "earned-value"
  | "quality-score"
  | "logic-integrity"
  | "milestone-risk"
  | "format-adapter"
  | "warnings"
  | "risks"
  | "forecast"
  | "resources"
  | "calendar"
  | "contract"
  | "quality"
  | "change"
  | "signoff"
  | "standards"
  | "network"
  | "critical-path";
type PortfolioRiskLevel = "low" | "medium" | "high";
type PortfolioDispositionStatus = "none" | "pending" | "closed";

interface PlanningPortfolioRiskModel {
  progressWarningDelta: number;
  progressHighDelta: number;
  milestoneSlipWarningDays: number;
  resourceHighUtilizationPercent: number;
  notificationRoles: string[];
}

interface PlanningPortfolioProject {
  id: string;
  name: string;
  org: string;
  stage: string;
  owner: string;
  taskIds: string[];
  milestoneIds: string[];
  plannedProgress: number;
  actualProgress: number;
  progressGap: number;
  milestoneCompletionPercent: number;
  delayDays: number;
  riskLevel: PortfolioRiskLevel;
  totalPlanStatus: string;
  monthlyPlanStatus: string;
  approvalStatus: string;
  riskDisposition: PortfolioDispositionStatus;
  updatedAt: string;
}

interface PlanningPortfolioSummary {
  projectCount: number;
  highRiskCount: number;
  pendingDispositionCount: number;
  milestoneCompletionPercent: number;
  totalPlanReadyCount: number;
  monthlyPlanReadyCount: number;
  approvalPendingCount: number;
}

interface PlanningIntegrationCapability {
  id: string;
  label: string;
  status: "active" | "adapter" | "blocked";
  detail: string;
}

interface GraphEditState {
  taskId: string;
  mode: GraphEditMode;
  x: number;
  y: number;
}

interface TaskContextMenuState {
  taskId: string;
  x: number;
  y: number;
}

interface ChartContextMenuState {
  view: ScheduleView;
  x: number;
  y: number;
}

interface ProjectContextMenuState {
  x: number;
  y: number;
}

interface PlanningControlDetailState {
  key: PlanningControlKey;
  x: number;
  y: number;
}

interface PlanningSaveFolder {
  id: string;
  name: string;
  label: string;
  depth?: number;
  node?: ModuleFileNode | undefined;
}

interface PlanningProjectFileState {
  fileId: string;
  localFileId: string;
  fileName: string;
  folderId: string;
  folderName: string;
  savedAt: string;
  storagePath: string;
}

interface NewPlanningProjectDraft {
  name: string;
  view: ScheduleView;
  start: string;
  end: string;
  folderId: string;
}

interface PlanningFolderContextMenuState {
  x: number;
  y: number;
  folder: PlanningSaveFolder;
}

const portfolioCurrentProjectId = "portfolio-current";

const defaultPortfolioRiskModel: PlanningPortfolioRiskModel = {
  progressWarningDelta: 15,
  progressHighDelta: 30,
  milestoneSlipWarningDays: 3,
  resourceHighUtilizationPercent: 120,
  notificationRoles: ["公司级工程部部长", "计划经理", "项目负责人"],
};

const portfolioRiskLabels: Record<PortfolioRiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const dispositionLabels: Record<PortfolioDispositionStatus, string> = {
  none: "无处置",
  pending: "待处置",
  closed: "已处置",
};

const planningIntegrationCapabilities: PlanningIntegrationCapability[] = [
  {
    id: "archiplan-json",
    label: "ArchIToken JSON",
    status: "active",
    detail: "计划包读写、版本、签审和证据字段",
  },
  {
    id: "csv-excel",
    label: "CSV/Excel 表格",
    status: "active",
    detail: "任务、日期、进度、负责人、前置任务导入",
  },
  {
    id: "open-export",
    label: "XML/XLSX/Mermaid",
    status: "active",
    detail: "开放格式导出，不伪造专有字段",
  },
  {
    id: "mpp-p6-gzp",
    label: "MPP/P6/GZP",
    status: "adapter",
    detail: "需隔离适配器、授权和 worker 证据",
  },
  {
    id: "sdk-worker",
    label: "WASM/C++ SDK",
    status: "blocked",
    detail: "仅作为可审查适配目标，未进入运行时",
  },
];

const planningContextFileExtensionByAction: Partial<
  Record<FileContextAction, string>
> = {
  new_file_md: ".md",
  new_file_json: ".json",
  new_file_yaml: ".yaml",
  new_file_csv: ".csv",
  new_file_txt: ".txt",
};

interface BlankPlanningModelOptions {
  projectName?: string;
  start?: string;
  end?: string;
}

interface TaskDiagramStyle {
  frame?: DiagramFrameStyle | undefined;
  accent?: string | undefined;
  fill?: string | undefined;
  fontSize?: number | undefined;
  connector?: DiagramConnectorStyle | undefined;
}

interface ResolvedTaskDiagramStyle {
  frame: DiagramFrameStyle;
  accent: string;
  fill: string;
  fontSize: number;
  connector: DiagramConnectorStyle;
}

interface ScheduleTask {
  id: string;
  code: string;
  parentId: string | null;
  name: string;
  description?: string | undefined;
  owner: string;
  level: number;
  start: string;
  end: string;
  duration: number;
  progress: number;
  dependencies: string[];
  status: ScheduleStatus;
  expanded?: boolean;
  earlyStart?: number;
  earlyFinish?: number;
  lateStart?: number;
  lateFinish?: number;
  totalFloat?: number;
  freeFloat?: number;
  expectedDuration?: number;
  critical?: boolean;
  budgetAmount?: number;
  actualCostAmount?: number;
  locked?: boolean | undefined;
  diagramStyle?: TaskDiagramStyle | undefined;
}

interface VisibleTask extends ScheduleTask {
  rowIndex: number;
}

interface TimelineUnit {
  key: string;
  label: string;
  subLabel: string;
  start: Date;
  end: Date;
  x: number;
  width: number;
  muted: boolean;
}

interface NodeOffset {
  x: number;
  y: number;
}

interface ZpertQualityCheck {
  label: string;
  ok: boolean;
  detail: string;
}

interface ZpertPlanningQuality {
  score: number;
  grade: "A" | "B" | "C" | "D";
  logicIssueCount: number;
  danglingTaskCount: number;
  milestoneRiskCount: number;
  feedbackCoveragePercent: number;
  checks: ZpertQualityCheck[];
}

const timelineHeaderHeight = 42;
const taskRowHeight = 56;
const defaultScheduleStart = "2026-05-01";
const defaultScheduleEnd = "2026-12-31";
const todayDate = parseDate("2026-05-21");
const planningDraftStorageKey = "architoken.planning_management.current_plan";
const planningModuleId = "planning_management" as const;
const planningProjectMimeType = "application/json";
const planningProjectFileExtension = ".archiplan.json";
const defaultTaskPaneWidth = 330;
const minTaskPaneWidth = 260;
const maxTaskPaneWidth = 520;
const hiddenStageScrollStyle: CSSProperties = {
  overscrollBehavior: "contain",
  scrollBehavior: "smooth",
  scrollbarWidth: "none",
};

const scaleColumnWidth: Record<ScheduleScale, number> = {
  day: 37,
  week: 146,
  month: 262,
};

const viewLabels: Record<ScheduleView, string> = {
  gantt: "甘特图",
  "time-network": "时标网络图",
  adm: "双代号",
  pert: "PERT图",
  flowchart: "流程图",
  mindmap: "思维导图",
  wbs: "WBS图",
  matrix: "矩阵图",
  analysis: "分析图",
  fishbone: "鱼骨图",
  burndown: "燃尽图",
  burnup: "燃起图",
  "resource-histogram": "资源图",
  "risk-matrix": "风险矩阵",
  raci: "RACI矩阵",
  "value-stream": "价值流图",
  swot: "SWOT图",
};

const scaleLabels: Record<ScheduleScale, string> = {
  day: "日",
  week: "周",
  month: "月",
};

const statusLabels: Record<ScheduleStatus, string> = {
  normal: "正常",
  ahead: "提前",
  warning: "预警",
  delayed: "滞后",
  future: "未开始",
};

const exportOptions: Array<{
  kind: PlanningExportKind;
  label: string;
  description: string;
}> = [
  {
    kind: "json",
    label: "ArchIToken 计划包",
    description:
      ".archiplan.json，可再次导入并保留完整任务、签审、证据和样式数据",
  },
  {
    kind: "csv",
    label: "任务清单 CSV",
    description: ".csv，用于 Excel、WPS、成本/采购系统交换任务表",
  },
  {
    kind: "xlsx",
    label: "Excel XLSX",
    description: ".xlsx，开放 OOXML 工作簿，含任务清单和汇总页",
  },
  {
    kind: "markdown",
    label: "Markdown 报告",
    description: ".md，用于方案说明、周报和知识库归档",
  },
  {
    kind: "html",
    label: "HTML 报告",
    description: ".html，可直接浏览、打印或转 PDF",
  },
  {
    kind: "xml",
    label: "计划 XML",
    description: ".planning.xml，开放结构化交换，不伪造 MPP/P6",
  },
  {
    kind: "svg",
    label: "甘特 SVG",
    description: ".svg，矢量甘特图，可进入文档和设计稿",
  },
  {
    kind: "png",
    label: "甘特 PNG",
    description: ".png，由 SVG 渲染生成的位图快照",
  },
  {
    kind: "jpg",
    label: "甘特 JPG",
    description: ".jpg，白底位图快照，适合邮件和报告",
  },
  {
    kind: "pdf",
    label: "PDF 报告",
    description: ".pdf，轻量计划摘要和任务清单",
  },
  {
    kind: "mermaid",
    label: "Mermaid 甘特图",
    description: ".mmd，用于文档、Markdown、Mermaid 渲染链路",
  },
  {
    kind: "gan",
    label: "GanttProject GAN",
    description: ".gan，开放 XML 项目计划交换格式",
  },
  {
    kind: "freemind",
    label: "FreeMind MM",
    description: ".mm，开放思维导图 XML，可导入多种脑图工具",
  },
  {
    kind: "xmind",
    label: "XMind 工作簿",
    description: ".xmind，ZIP/JSON 脑图交换包，不含闭源专属字段",
  },
];

const frameLabels: Record<DiagramFrameStyle, string> = {
  rect: "矩形",
  round: "圆角",
  pill: "胶囊",
};

const connectorLabels: Record<DiagramConnectorStyle, string> = {
  elbow: "折线",
  straight: "直线",
  curve: "曲线",
  dashed: "虚线",
};

const colorOptions = [
  { label: "蓝", accent: "#2f7df6", fill: "#c8e2fb" },
  { label: "绿", accent: "#12c86b", fill: "#bdf6cb" },
  { label: "橙", accent: "#ff9f2e", fill: "#fdecc6" },
  { label: "红", accent: "#ef4444", fill: "#ffd9d1" },
  { label: "紫", accent: "#7c3aed", fill: "#ede9fe" },
  { label: "灰", accent: "#64748b", fill: "#e2e8f0" },
];

const initialPlanningModel = createDefaultProjectPlanningModel();

function clonePlanningModel(model: ProjectPlanningModel): ProjectPlanningModel {
  return JSON.parse(JSON.stringify(model)) as ProjectPlanningModel;
}

function getPlanningModelRange(model: ProjectPlanningModel) {
  const starts = model.tasks
    .map((task) => task.start)
    .filter(Boolean)
    .sort();
  const ends = model.tasks
    .map((task) => task.end)
    .filter(Boolean)
    .sort();
  return {
    start: starts[0] ?? defaultScheduleStart,
    end: ends.at(-1) ?? defaultScheduleEnd,
  };
}

function createBlankGanttPlanningModel(
  createdAt: string,
  chartView: ScheduleView = "gantt",
  options: BlankPlanningModelOptions = {},
): ProjectPlanningModel {
  const date = options.start ?? createdAt.slice(0, 10);
  const end = options.end ?? shiftDate(date, 21);
  const suffix = date.replaceAll("-", "");
  const chartLabel = viewLabels[chartView];
  const projectName =
    options.projectName?.trim() || `新建${chartLabel} ${date}`;
  const taskRootId = "task-new-root";
  const taskDraftId = "task-new-001";
  const resourceId = "res-planning-engineer";
  const riskId = "risk-new-plan";
  const calendarId = "cal-default-six-day";

  return {
    schema: "architoken.project_planning_studio.v1",
    moduleId: "planning_management",
    planId: `plan-${chartView.replaceAll("-", "-")}-${suffix}-${Date.now()}`,
    projectName,
    baselineName: `${projectName} 基线`,
    currentVersion: "v0.1",
    approvalStatus: "draft",
    dataDate: date,
    costBaselineCurrency: "CNY",
    calendars: [
      {
        id: calendarId,
        name: "默认六天制施工日历",
        timezone: "Asia/Shanghai",
        workingWeekdays: [1, 2, 3, 4, 5, 6],
        workingHoursPerDay: 8,
        exceptions: [],
      },
    ],
    wbs: [
      {
        id: "wbs-new-root",
        code: "1",
        title: projectName,
        owner: "计划工程师",
        parentId: null,
        deliverable: "待定义计划交付物",
      },
    ],
    tasks: [
      {
        id: taskRootId,
        code: "T-001",
        title: projectName,
        description: "可在当前编辑栏或图上右键继续拆分任务。",
        wbsId: "wbs-new-root",
        owner: "计划工程师",
        start: date,
        end,
        progress: 0,
        dependencies: [],
        dependencyRules: [],
        parentTaskId: null,
        outlineLevel: 1,
        isExpanded: true,
        baselineStart: date,
        baselineEnd: end,
        durationOptimistic: 15,
        durationMostLikely: 22,
        durationPessimistic: 30,
        calendarId,
        resourceDemand: 0,
        budgetAmount: 0,
        actualCostAmount: 0,
        approvalRequired: false,
        status: "todo",
        resourceId,
        riskId,
      },
      {
        id: taskDraftId,
        code: "T-002",
        title: "未命名任务",
        description: "从这里开始录入真实任务、工期、责任人和依赖。",
        wbsId: "wbs-new-root",
        owner: "计划工程师",
        start: date,
        end: shiftDate(date, 6),
        progress: 0,
        dependencies: [],
        dependencyRules: [],
        parentTaskId: taskRootId,
        outlineLevel: 2,
        isExpanded: true,
        baselineStart: date,
        baselineEnd: shiftDate(date, 6),
        durationOptimistic: 4,
        durationMostLikely: 7,
        durationPessimistic: 10,
        calendarId,
        resourceDemand: 1,
        budgetAmount: 0,
        actualCostAmount: 0,
        approvalRequired: false,
        status: "todo",
        resourceId,
        riskId,
      },
    ],
    milestones: [
      {
        id: "ms-new-finish",
        title: "计划完成里程碑",
        due: end,
        owner: "计划工程师",
        linkedTaskIds: [taskDraftId],
        status: "pending",
      },
    ],
    resources: [
      {
        id: resourceId,
        name: "计划工程师",
        type: "person",
        capacity: 1,
        unit: "人",
      },
    ],
    risks: [
      {
        id: riskId,
        title: "新计划待补充真实约束",
        probability: 0.1,
        impact: 0.2,
        level: "low",
        owner: "计划工程师",
        mitigation: "补齐合同节点、资源、质量安全门和审批证据后再提交基线。",
      },
    ],
    raci: [],
    contractNodes: [],
    qualityGates: [],
    safetyPermits: [],
    procurementPackages: [],
    changeRequests: [],
    professionalSignoffs: [],
    progressFeedback: [],
    adjustments: [],
    diagrams: [],
    versions: [],
    auditTrail: [
      {
        id: `feichuan-new-gantt-${Date.now()}`,
        at: createdAt,
        actor: "FeichuanPlanningWorkbench",
        summary: `从计划管理工作台新建空白${chartLabel}: ${projectName}。`,
      },
    ],
  };
}

function listPlanningSaveFolders(): PlanningSaveFolder[] {
  const rootId = getModuleRootId(planningModuleId);
  const files = moduleBackendAdapter.snapshot(planningModuleId).files;
  const rootNode = files.find((node) => node.id === rootId);
  const rootName = rootNode?.name ?? "计划管理";
  const rootFolder: PlanningSaveFolder = {
    id: rootId,
    name: rootName,
    label: `${rootName} / 根目录`,
    depth: 0,
    node: rootNode,
  };
  const preferred = [
    "进度计划",
    "Project Planning Studio",
    "版本归档",
    "审批记录",
  ];
  const folders = files.filter(
    (node): node is ModuleFileNode =>
      node.id !== rootId &&
      node.type === "folder" &&
      node.status !== "soft_deleted",
  );
  const childrenByParent = new Map<string, ModuleFileNode[]>();
  for (const folder of folders) {
    const parentId = folder.parentId ?? rootId;
    childrenByParent.set(parentId, [
      ...(childrenByParent.get(parentId) ?? []),
      folder,
    ]);
  }

  function sortFolders(left: ModuleFileNode, right: ModuleFileNode) {
    if (left.parentId === rootId && right.parentId === rootId) {
      const leftRank = preferred.indexOf(left.name);
      const rightRank = preferred.indexOf(right.name);
      if (leftRank !== rightRank) {
        if (leftRank < 0) return 1;
        if (rightRank < 0) return -1;
        return leftRank - rightRank;
      }
    }
    return left.name.localeCompare(right.name, "zh-CN");
  }

  function collectFolderOptions(
    parentId: string,
    parentLabel: string,
    depth: number,
    visited = new Set<string>([rootId]),
  ): PlanningSaveFolder[] {
    return (childrenByParent.get(parentId) ?? [])
      .sort(sortFolders)
      .flatMap((folder) => {
        if (visited.has(folder.id)) return [];
        const label = `${parentLabel} / ${folder.name}`;
        const nextVisited = new Set(visited);
        nextVisited.add(folder.id);
        return [
          {
            id: folder.id,
            name: folder.name,
            label,
            depth,
            node: folder,
          },
          ...collectFolderOptions(folder.id, label, depth + 1, nextVisited),
        ];
      });
  }

  const folderOptions = collectFolderOptions(rootId, rootName, 1);

  return [rootFolder, ...folderOptions];
}

function getDefaultPlanningSaveFolder(
  folders: PlanningSaveFolder[],
): PlanningSaveFolder {
  return (
    folders.find((folder) => folder.name === "进度计划") ??
    folders.find((folder) => folder.id !== getModuleRootId(planningModuleId)) ??
    folders[0] ?? {
      id: getModuleRootId(planningModuleId),
      name: "计划管理",
      label: "计划管理 / 根目录",
    }
  );
}

function getPlanningFolderTagValue(
  folder: PlanningSaveFolder,
  prefix: string,
): string | undefined {
  return folder.node?.tags
    .find((tag) => tag.startsWith(prefix))
    ?.slice(prefix.length);
}

function isPlanningProjectFolder(folder: PlanningSaveFolder): boolean {
  const node = folder.node;
  if (!node || node.moduleId !== planningModuleId) return false;
  return (
    node.parentId === getModuleRootId(planningModuleId) &&
    (node.tags.includes("planning-project") ||
      node.tags.includes("managed-project"))
  );
}

function getPlanningLauncherProjectFolders(
  folders: PlanningSaveFolder[],
): PlanningSaveFolder[] {
  const projectFolders = folders.filter(isPlanningProjectFolder);
  if (projectFolders.length > 0) return projectFolders.slice(0, 8);
  return folders
    .filter(
      (folder) =>
        folder.id !== getModuleRootId(planningModuleId) &&
        (folder.depth ?? 0) <= 1,
    )
    .slice(0, 8);
}

function buildPlanningProjectSelectionRequestFromFolder(
  folder: PlanningSaveFolder,
): ArchitokenPlanningProjectSelectionRequest {
  return {
    projectId:
      getPlanningFolderTagValue(folder, "project:") ??
      folder.node?.tags.find((tag) => tag.startsWith("project-")) ??
      folder.id,
    projectName: folder.name,
    folderId: folder.id,
    startDate: getPlanningFolderTagValue(folder, "start:"),
    endDate: getPlanningFolderTagValue(folder, "end:"),
    location: getPlanningFolderTagValue(folder, "location:"),
    stage: getPlanningFolderTagValue(folder, "stage:"),
    requestedAt: new Date().toISOString(),
  };
}

function createDefaultNewPlanningProjectDraft(
  view: ScheduleView,
  folders: PlanningSaveFolder[],
): NewPlanningProjectDraft {
  const start = formatDate(new Date());
  return {
    name: `新建计划 ${start}`,
    view,
    start,
    end: shiftDate(start, 21),
    folderId: getDefaultPlanningSaveFolder(folders).id,
  };
}

function getPlanningProjectFileName(projectName: string): string {
  const stem = sanitizePlanningFileStem(projectName);
  return stem.toLowerCase().endsWith(planningProjectFileExtension)
    ? stem
    : `${stem}${planningProjectFileExtension}`;
}

function getUniquePlanningNodeName(
  parentId: string,
  baseName: string,
  extension = "",
): string {
  const siblings = moduleBackendAdapter
    .snapshot(planningModuleId)
    .files.filter(
      (node) => node.parentId === parentId && node.status !== "soft_deleted",
    );
  const siblingNames = new Set(siblings.map((node) => node.name));
  const firstName = `${baseName}${extension}`;
  if (!siblingNames.has(firstName)) return firstName;

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName} ${index}${extension}`;
    if (!siblingNames.has(candidate)) return candidate;
  }
  return `${baseName} ${Date.now()}${extension}`;
}

function planningModelToFileContent(model: ProjectPlanningModel): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}

async function uploadPlanningProjectModelFile(
  model: ProjectPlanningModel,
  folder: PlanningSaveFolder,
  fileName: string,
): Promise<{
  fileState: PlanningProjectFileState;
  auditEvent: ModuleAuditEvent;
}> {
  const form = new FormData();
  const file = new File([planningModelToFileContent(model)], fileName, {
    type: planningProjectMimeType,
  });
  form.set("file", file);
  form.set("moduleId", planningModuleId);
  form.set("parentId", folder.id);
  form.set("owner", "当前用户");
  form.set("tags", "planning-project,project-planning-studio,archiplan");

  const response = await fetch("/api/local-files/upload", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(`计划项目保存失败: ${response.status}`);
  }

  const payload = (await response.json()) as { file: LocalFileMetadata };
  const result = moduleBackendAdapter.uploadLocalFile(payload.file, folder.id);
  return {
    auditEvent: result.auditEvent,
    fileState: {
      fileId: result.node.id,
      localFileId: payload.file.fileId,
      fileName: payload.file.originalName,
      folderId: folder.id,
      folderName: folder.label,
      savedAt: payload.file.createdAt,
      storagePath: payload.file.storagePath,
    },
  };
}

async function updatePlanningProjectModelFile(
  model: ProjectPlanningModel,
  fileState: PlanningProjectFileState,
): Promise<{
  fileState: PlanningProjectFileState;
  auditEvent: ModuleAuditEvent;
}> {
  const response = await fetch(
    `/api/local-files/${encodeURIComponent(fileState.localFileId)}`,
    {
      method: "PUT",
      headers: {
        "content-type": planningProjectMimeType,
      },
      body: planningModelToFileContent(model),
    },
  );
  if (!response.ok) {
    throw new Error(`计划项目写回失败: ${response.status}`);
  }

  const payload = (await response.json()) as { file: LocalFileMetadata };
  const result = moduleBackendAdapter.uploadLocalFile(
    payload.file,
    fileState.folderId,
  );
  return {
    auditEvent: result.auditEvent,
    fileState: {
      ...fileState,
      fileId: result.node.id,
      fileName: payload.file.originalName,
      localFileId: payload.file.fileId,
      savedAt: payload.file.createdAt,
      storagePath: payload.file.storagePath,
    },
  };
}

function isPlanningTableImport(file: File, content: string): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv")) return true;
  const firstLine = content.trimStart().split(/\r?\n/)[0] ?? "";
  return !content.trimStart().startsWith("{") && /,|\t|;/.test(firstLine);
}

function createPlanningModelFromTableImport(
  fileName: string,
  content: string,
  importedAt: string,
): ProjectPlanningModel {
  const rows = parsePlanningTableRows(content);
  if (rows.length === 0) {
    throw new Error("导入表格未识别到计划任务行。");
  }

  const date = importedAt.slice(0, 10);
  const base = createBlankGanttPlanningModel(importedAt);
  const cleanName = fileName.replace(/\.[^.]+$/u, "") || "表格计划";
  const rootId = "task-import-root";
  const resourceId = base.resources[0]?.id ?? "res-planning-engineer";
  const riskId = base.risks[0]?.id ?? "risk-new-plan";
  const calendarId = base.calendars[0]?.id ?? "cal-default-six-day";
  const codeToId = new Map<string, string>();
  const parentByTaskId = new Map<string, string>();
  const dependencyTokensByTaskId = new Map<string, string[]>();

  const importedTasks: PlanningTask[] = rows.slice(0, 300).map((row, index) => {
    const code = row.code || `I-${String(index + 1).padStart(3, "0")}`;
    const id = `import-task-${String(index + 1).padStart(3, "0")}`;
    const start = normalizePlanningImportDate(row.start) ?? date;
    const durationFromTable = parsePositiveInteger(row.duration);
    const end =
      normalizePlanningImportDate(row.end) ??
      shiftDate(start, Math.max(1, durationFromTable ?? 7) - 1);
    const duration = calculateDuration(start, end);
    const progress = parsePlanningImportProgress(row.progress);
    const parentCode = row.parent.trim();
    const dependencyTokens = splitPlanningImportTokens(row.dependencies);
    codeToId.set(code, id);
    if (parentCode) parentByTaskId.set(id, parentCode);
    dependencyTokensByTaskId.set(id, dependencyTokens);

    return {
      id,
      code,
      title: row.title || `导入任务 ${index + 1}`,
      description:
        "从 CSV/Excel 表格导入，可继续在甘特图、网络图和右键菜单中编辑。",
      wbsId: "wbs-import-root",
      owner: row.owner || "计划工程师",
      start,
      end,
      progress,
      dependencies: [],
      dependencyRules: [],
      parentTaskId: rootId,
      outlineLevel: 2,
      isExpanded: true,
      baselineStart: start,
      baselineEnd: end,
      durationOptimistic: Math.max(1, duration - 2),
      durationMostLikely: duration,
      durationPessimistic: duration + 4,
      calendarId,
      resourceDemand: 1,
      budgetAmount: Math.max(0, duration * 5200),
      actualCostAmount: 0,
      approvalRequired: false,
      status: progress >= 100 ? "done" : progress > 0 ? "doing" : "todo",
      resourceId,
      riskId,
    };
  });

  const importedTaskIds = new Set(importedTasks.map((task) => task.id));
  const linkedTasks = importedTasks.map((task) => {
    const parentCode = parentByTaskId.get(task.id);
    const resolvedParentId = parentCode ? codeToId.get(parentCode) : null;
    const dependencies = (dependencyTokensByTaskId.get(task.id) ?? [])
      .map(
        (token) =>
          codeToId.get(token) ?? (importedTaskIds.has(token) ? token : null),
      )
      .filter(
        (taskId): taskId is string => taskId !== null && taskId !== task.id,
      );
    return {
      ...task,
      parentTaskId: resolvedParentId ?? rootId,
      outlineLevel: resolvedParentId ? 3 : 2,
      dependencies,
      dependencyRules: dependencies.map((predecessorId) => ({
        predecessorId,
        type: "FS" as const,
        lagDays: 0,
      })),
    };
  });
  const starts = linkedTasks.map((task) => task.start).sort();
  const ends = linkedTasks.map((task) => task.end).sort();
  const rootStart = starts[0] ?? date;
  const rootEnd = ends.at(-1) ?? shiftDate(date, 21);
  const rootProgress = linkedTasks.length
    ? Math.round(
        linkedTasks.reduce((total, task) => total + task.progress, 0) /
          linkedTasks.length,
      )
    : 0;
  const rootTask: PlanningTask = {
    ...base.tasks[0],
    id: rootId,
    code: "IMP-ROOT",
    title: `导入计划 ${cleanName}`,
    description:
      "从外部计划表导入后的总控任务。可在此继续补齐 WBS、逻辑关系、签审和证据。",
    wbsId: "wbs-import-root",
    owner: "计划工程师",
    start: rootStart,
    end: rootEnd,
    progress: rootProgress,
    dependencies: [],
    dependencyRules: [],
    parentTaskId: null,
    outlineLevel: 1,
    baselineStart: rootStart,
    baselineEnd: rootEnd,
    durationMostLikely: calculateDuration(rootStart, rootEnd),
    status: rootProgress >= 100 ? "done" : rootProgress > 0 ? "doing" : "todo",
    resourceId,
    riskId,
  };

  return {
    ...base,
    planId: `plan-import-${Date.now()}`,
    projectName: `导入计划 ${cleanName}`,
    baselineName: `表格导入基线 ${date}`,
    dataDate: date,
    wbs: [
      {
        id: "wbs-import-root",
        code: "1",
        title: `导入计划 ${cleanName}`,
        owner: "计划工程师",
        parentId: null,
        deliverable: "外部计划表导入后的可编辑进度基线",
      },
    ],
    tasks: [rootTask, ...linkedTasks],
    milestones: [
      {
        id: "ms-import-finish",
        title: "导入计划完成里程碑",
        due: rootEnd,
        owner: "计划工程师",
        linkedTaskIds: linkedTasks.slice(-1).map((task) => task.id),
        status: "pending",
      },
    ],
    progressFeedback: [],
    adjustments: [],
    versions: [],
    auditTrail: [
      {
        id: `feichuan-table-import-${Date.now()}`,
        at: importedAt,
        actor: "FeichuanPlanningWorkbench",
        summary: `从 CSV/Excel 表格导入 ${linkedTasks.length} 个计划任务。`,
      },
      ...base.auditTrail,
    ],
  };
}

interface PlanningTableRow {
  code: string;
  title: string;
  start: string;
  end: string;
  duration: string;
  progress: string;
  owner: string;
  parent: string;
  dependencies: string;
}

function parsePlanningTableRows(content: string): PlanningTableRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = detectPlanningTableDelimiter(lines[0] ?? "");
  const headers = splitPlanningTableLine(lines[0] ?? "", delimiter).map(
    normalizePlanningImportHeader,
  );
  return lines.slice(1).flatMap((line) => {
    const cells = splitPlanningTableLine(line, delimiter);
    const row: PlanningTableRow = {
      code: "",
      title: "",
      start: "",
      end: "",
      duration: "",
      progress: "",
      owner: "",
      parent: "",
      dependencies: "",
    };
    cells.forEach((cell, index) => {
      const key = headers[index];
      if (key) row[key] = cell.trim();
    });
    return row.title || row.code ? [row] : [];
  });
}

function detectPlanningTableDelimiter(headerLine: string): string {
  const candidates = ["\t", ",", ";"];
  return (
    candidates
      .map((delimiter) => ({
        delimiter,
        count: headerLine.split(delimiter).length,
      }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
  );
}

function splitPlanningTableLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizePlanningImportHeader(
  header: string,
): keyof PlanningTableRow | null {
  const key = header.trim().toLowerCase().replace(/\s|_/gu, "");
  if (
    ["编号", "编码", "任务编号", "工作编号", "code", "id", "wbs"].includes(key)
  )
    return "code";
  if (
    [
      "任务名称",
      "工作名称",
      "名称",
      "工作内容",
      "title",
      "name",
      "task",
    ].includes(key)
  )
    return "title";
  if (
    [
      "计划开始",
      "计划开始日期",
      "开始",
      "开始日期",
      "start",
      "plannedstart",
    ].includes(key)
  )
    return "start";
  if (
    [
      "计划完成",
      "计划完成日期",
      "完成",
      "完成日期",
      "结束",
      "结束日期",
      "end",
      "finish",
      "plannedfinish",
    ].includes(key)
  )
    return "end";
  if (["工期", "持续时间", "duration", "days"].includes(key)) return "duration";
  if (
    ["进度", "完成率", "实际进度", "progress", "percentcomplete"].includes(key)
  )
    return "progress";
  if (["负责人", "责任人", "owner", "responsible"].includes(key))
    return "owner";
  if (["父级", "父任务", "parent", "parentid"].includes(key)) return "parent";
  if (
    [
      "前置任务",
      "紧前任务",
      "依赖",
      "逻辑关系",
      "dependencies",
      "predecessors",
    ].includes(key)
  )
    return "dependencies";
  return null;
}

function normalizePlanningImportDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed
    .replace(/[./]/gu, "-")
    .match(/(\d{4})-(\d{1,2})-(\d{1,2})/u);
  if (!match) return null;
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value.replace(/[^\d]/gu, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePlanningImportProgress(value: string): number {
  const parsed = Number.parseFloat(value.replace("%", "").trim());
  if (!Number.isFinite(parsed)) return 0;
  return clampNumber(Math.round(parsed), 0, 100);
}

function splitPlanningImportTokens(value: string): string[] {
  return value
    .split(/[;,，、|/\s]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function derivePortfolioProjects(
  model: ProjectPlanningModel,
  riskModel: PlanningPortfolioRiskModel,
  closedDispositionIds: ReadonlySet<string>,
): PlanningPortfolioProject[] {
  const rootWbsId =
    model.wbs.find((item) => item.parentId === null)?.id ??
    model.wbs[0]?.id ??
    "";
  const predefinedSpecs = [
    {
      id: "portfolio-a1",
      wbsId: "wbs-2",
      name: "A1 两层重钢结构别墅",
      org: "柔佛项目部",
      stage: "主体安装",
      owner: "施工经理",
    },
    {
      id: "portfolio-b2",
      wbsId: "wbs-3",
      name: "B2 轻型钢结构厂房",
      org: "厂房项目组",
      stage: "加工备货",
      owner: "厂房项目经理",
    },
    {
      id: "portfolio-c3",
      wbsId: "wbs-4",
      name: "C3 海滨亭阁与景观连廊",
      org: "景观项目组",
      stage: "深化准备",
      owner: "景观负责人",
    },
  ].filter((spec) => model.wbs.some((item) => item.id === spec.wbsId));
  const specs = [
    {
      id: portfolioCurrentProjectId,
      wbsId: rootWbsId,
      name: model.projectName,
      org: "企业工程部",
      stage: "总控基线",
      owner: "项目负责人",
    },
    ...predefinedSpecs,
  ];
  const allAlerts = deriveScheduleAlerts(model);
  const resourceBuckets = deriveResourceLoadAnalysis(model).buckets;
  const feedbackTaskIds = new Set(
    model.progressFeedback.map((item) => item.taskId),
  );
  const latestFeedbackByTask = new Map<string, string>();
  for (const feedback of model.progressFeedback) {
    const current = latestFeedbackByTask.get(feedback.taskId);
    if (!current || feedback.reportedAt > current) {
      latestFeedbackByTask.set(feedback.taskId, feedback.reportedAt);
    }
  }

  return specs.flatMap((spec) => {
    const wbsIds =
      spec.id === portfolioCurrentProjectId
        ? new Set(model.wbs.map((item) => item.id))
        : collectPortfolioWbsIds(model, spec.wbsId);
    const scopedTasks = model.tasks.filter((task) => wbsIds.has(task.wbsId));
    if (scopedTasks.length === 0) return [];
    const scopedTaskIds = new Set(scopedTasks.map((task) => task.id));
    const scopedAlerts = allAlerts.filter((alert) =>
      alert.taskIds.some((taskId) => scopedTaskIds.has(taskId)),
    );
    const scopedMilestones = model.milestones.filter((milestone) =>
      milestone.linkedTaskIds.some((taskId) => scopedTaskIds.has(taskId)),
    );
    const plannedProgress = Math.round(
      scopedTasks.reduce(
        (sum, task) => sum + deriveTaskPlannedProgress(task, model.dataDate),
        0,
      ) / scopedTasks.length,
    );
    const actualProgress = Math.round(
      scopedTasks.reduce((sum, task) => sum + task.progress, 0) /
        scopedTasks.length,
    );
    const progressGap = Math.max(0, plannedProgress - actualProgress);
    const milestoneCompletionPercent = scopedMilestones.length
      ? Math.round(
          (scopedMilestones.filter((milestone) => milestone.status === "passed")
            .length /
            scopedMilestones.length) *
            100,
        )
      : actualProgress;
    const latestEnd =
      scopedTasks
        .map((task) => task.end)
        .sort()
        .at(-1) ?? model.dataDate;
    const delayDays = Math.max(
      0,
      ...scopedTasks.map((task) => {
        const planned = deriveTaskPlannedProgress(task, model.dataDate);
        const gap = Math.max(0, planned - task.progress);
        return gap >= riskModel.progressWarningDelta ? Math.ceil(gap / 10) : 0;
      }),
      ...scopedMilestones.map((milestone) =>
        milestone.status === "slipped" ? riskModel.milestoneSlipWarningDays : 0,
      ),
    );
    const resourceHigh = resourceBuckets.some(
      (bucket) =>
        bucket.utilizationPercent >= riskModel.resourceHighUtilizationPercent &&
        bucket.taskIds.some((taskId) => scopedTaskIds.has(taskId)),
    );
    const hasHighAlert = scopedAlerts.some(
      (alert) => alert.severity === "high" || alert.severity === "critical",
    );
    const riskLevel: PortfolioRiskLevel =
      hasHighAlert ||
      resourceHigh ||
      progressGap >= riskModel.progressHighDelta ||
      delayDays > riskModel.milestoneSlipWarningDays
        ? "high"
        : scopedAlerts.length > 0 ||
            progressGap >= riskModel.progressWarningDelta ||
            delayDays > 0
          ? "medium"
          : "low";
    const hasFeedback = scopedTasks.some((task) =>
      feedbackTaskIds.has(task.id),
    );
    const signedCount = model.professionalSignoffs.filter(
      (signoff) =>
        signoff.status === "signed" &&
        signoff.linkedTaskIds.some((taskId) => scopedTaskIds.has(taskId)),
    ).length;
    const pendingSignoffCount = model.professionalSignoffs.filter(
      (signoff) =>
        signoff.status !== "signed" &&
        signoff.linkedTaskIds.some((taskId) => scopedTaskIds.has(taskId)),
    ).length;
    const riskDisposition: PortfolioDispositionStatus =
      riskLevel === "low"
        ? "none"
        : closedDispositionIds.has(spec.id)
          ? "closed"
          : "pending";
    const latestFeedback =
      scopedTasks
        .map((task) => latestFeedbackByTask.get(task.id))
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      model.versions[0]?.createdAt ??
      model.dataDate;

    return [
      {
        id: spec.id,
        name: spec.name,
        org: spec.org,
        stage: spec.stage,
        owner: spec.owner,
        taskIds: scopedTasks.map((task) => task.id),
        milestoneIds: scopedMilestones.map((milestone) => milestone.id),
        plannedProgress,
        actualProgress,
        progressGap,
        milestoneCompletionPercent,
        delayDays,
        riskLevel,
        totalPlanStatus:
          model.versions.length > 0 || scopedTasks.length > 0
            ? "已编制"
            : "待编制",
        monthlyPlanStatus: hasFeedback ? "已更新" : "待更新",
        approvalStatus:
          pendingSignoffCount > 0
            ? `待签 ${pendingSignoffCount}`
            : signedCount > 0
              ? "已签审"
              : model.approvalStatus === "pending_approval"
                ? "审批中"
                : "草稿",
        riskDisposition,
        updatedAt: latestFeedback.slice(0, 10) || latestEnd,
      },
    ];
  });
}

function collectPortfolioWbsIds(
  model: ProjectPlanningModel,
  rootId: string,
): Set<string> {
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of model.wbs) {
      if (item.parentId && result.has(item.parentId) && !result.has(item.id)) {
        result.add(item.id);
        changed = true;
      }
    }
  }
  return result;
}

function derivePortfolioSummary(
  projects: readonly PlanningPortfolioProject[],
): PlanningPortfolioSummary {
  const projectCount = projects.length;
  return {
    projectCount,
    highRiskCount: projects.filter((project) => project.riskLevel === "high")
      .length,
    pendingDispositionCount: projects.filter(
      (project) => project.riskDisposition === "pending",
    ).length,
    milestoneCompletionPercent: projectCount
      ? Math.round(
          projects.reduce(
            (sum, project) => sum + project.milestoneCompletionPercent,
            0,
          ) / projectCount,
        )
      : 0,
    totalPlanReadyCount: projects.filter(
      (project) => project.totalPlanStatus === "已编制",
    ).length,
    monthlyPlanReadyCount: projects.filter(
      (project) => project.monthlyPlanStatus === "已更新",
    ).length,
    approvalPendingCount: projects.filter((project) =>
      project.approvalStatus.startsWith("待签"),
    ).length,
  };
}

function planningPortfolioToCsv(
  projects: readonly PlanningPortfolioProject[],
  riskModel: PlanningPortfolioRiskModel,
): string {
  const rows: Array<Array<string | number>> = [
    [
      "项目",
      "组织",
      "施工阶段",
      "负责人",
      "风险等级",
      "计划进度",
      "实际进度",
      "偏差",
      "里程碑完成率",
      "预测延期天数",
      "总计划",
      "月计划",
      "审批签审",
      "风险处置",
      "最近更新",
    ],
    ...projects.map((project) => [
      project.name,
      project.org,
      project.stage,
      project.owner,
      portfolioRiskLabels[project.riskLevel],
      project.plannedProgress,
      project.actualProgress,
      project.progressGap,
      project.milestoneCompletionPercent,
      project.delayDays,
      project.totalPlanStatus,
      project.monthlyPlanStatus,
      project.approvalStatus,
      dispositionLabels[project.riskDisposition],
      project.updatedAt,
    ]),
    [],
    ["风险模型", "进度预警阈值", riskModel.progressWarningDelta],
    ["风险模型", "进度高风险阈值", riskModel.progressHighDelta],
    ["风险模型", "里程碑顺延阈值", riskModel.milestoneSlipWarningDays],
    ["风险模型", "资源高强度阈值", riskModel.resourceHighUtilizationPercent],
    ["通知角色", riskModel.notificationRoles.join(" / ")],
  ];
  return rows.map((row) => row.map(planningCsvCell).join(",")).join("\n");
}

function planningMilestoneLedgerToCsv(
  model: ProjectPlanningModel,
  projects: readonly PlanningPortfolioProject[],
): string {
  const projectByMilestone = new Map<string, PlanningPortfolioProject>();
  for (const project of projects) {
    for (const milestoneId of project.milestoneIds) {
      projectByMilestone.set(milestoneId, project);
    }
  }
  const rows: Array<Array<string | number>> = [
    ["项目", "组织", "里程碑", "计划日期", "负责人", "状态", "关联任务"],
    ...model.milestones.map((milestone) => {
      const project = projectByMilestone.get(milestone.id);
      return [
        project?.name ?? model.projectName,
        project?.org ?? "企业工程部",
        milestone.title,
        milestone.due,
        milestone.owner,
        milestone.status,
        milestone.linkedTaskIds.join("|"),
      ];
    }),
  ];
  return rows.map((row) => row.map(planningCsvCell).join(",")).join("\n");
}

function planningCsvCell(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parsePortfolioRiskThreshold(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clampNumber(Math.round(parsed), 1, 200);
}

export function FeichuanPlanningWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [planModel, setPlanModel] = useState<ProjectPlanningModel>(() =>
    clonePlanningModel(initialPlanningModel),
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<ScheduleView>("gantt");
  const [scale, setScale] = useState<ScheduleScale>("month");
  const [selectedTaskId, setSelectedTaskId] = useState("task-5");
  const [planRange, setPlanRange] = useState({
    start: defaultScheduleStart,
    end: defaultScheduleEnd,
  });
  const [graphEdit, setGraphEdit] = useState<GraphEditState | null>(null);
  const [contextMenu, setContextMenu] = useState<TaskContextMenuState | null>(
    null,
  );
  const [chartMenu, setChartMenu] = useState<ChartContextMenuState | null>(
    null,
  );
  const [chartSettings, setChartSettings] =
    useState<ChartContextMenuState | null>(null);
  const [copiedTask, setCopiedTask] = useState<PlanningTask | null>(null);
  const [copiedStyle, setCopiedStyle] = useState<TaskDiagramStyle | null>(null);
  const [planningSaveFolders, setPlanningSaveFolders] = useState(() =>
    listPlanningSaveFolders(),
  );
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectDraft, setNewProjectDraft] =
    useState<NewPlanningProjectDraft>(() =>
      createDefaultNewPlanningProjectDraft("gantt", planningSaveFolders),
    );
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [newProjectCreating, setNewProjectCreating] = useState(false);
  const [currentPlanFile, setCurrentPlanFile] =
    useState<PlanningProjectFileState | null>(null);
  const [projectMenu, setProjectMenu] =
    useState<ProjectContextMenuState | null>(null);
  const [projectPropertiesOpen, setProjectPropertiesOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [newChartMenuOpen, setNewChartMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [portfolioPanelOpen, setPortfolioPanelOpen] = useState(false);
  const [activeControlKey, setActiveControlKey] =
    useState<PlanningControlKey>("spi");
  const [controlDetail, setControlDetail] =
    useState<PlanningControlDetailState | null>(null);
  const [taskPaneWidth, setTaskPaneWidth] = useState(defaultTaskPaneWidth);
  const [frontlineVisible, setFrontlineVisible] = useState(true);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [portfolioRiskModel, setPortfolioRiskModel] =
    useState<PlanningPortfolioRiskModel>(() => defaultPortfolioRiskModel);
  const [portfolioClosedDispositionIds, setPortfolioClosedDispositionIds] =
    useState<Set<string>>(() => new Set());
  const [selectedPortfolioProjectId, setSelectedPortfolioProjectId] = useState(
    portfolioCurrentProjectId,
  );
  const networkSchedule = useMemo(
    () => deriveNetworkSchedule(planModel.tasks),
    [planModel.tasks],
  );
  const summary = useMemo(() => derivePlanningSummary(planModel), [planModel]);
  const analytics = useMemo(
    () => derivePlanningAnalytics(planModel),
    [planModel],
  );
  const alerts = useMemo(() => deriveScheduleAlerts(planModel), [planModel]);
  const coverage = useMemo(
    () => derivePlanningStandardsCoverage(planModel),
    [planModel],
  );
  const earnedValue = useMemo(
    () => deriveEarnedValueMetrics(planModel),
    [planModel],
  );
  const resourceLoad = useMemo(
    () => deriveResourceLoadAnalysis(planModel),
    [planModel],
  );
  const calendarMetrics = useMemo(
    () => deriveWorkingCalendarMetrics(planModel),
    [planModel],
  );
  const governance = useMemo(
    () => deriveGovernanceEvidenceSummary(planModel),
    [planModel],
  );
  const signoff = useMemo(
    () => deriveProfessionalSignoffSummary(planModel),
    [planModel],
  );
  const zpertQuality = useMemo(
    () => deriveZpertPlanningQuality(planModel, networkSchedule, alerts),
    [alerts, networkSchedule, planModel],
  );
  const portfolioProjects = useMemo(
    () =>
      derivePortfolioProjects(
        planModel,
        portfolioRiskModel,
        portfolioClosedDispositionIds,
      ),
    [planModel, portfolioClosedDispositionIds, portfolioRiskModel],
  );
  const portfolioSummary = useMemo(
    () => derivePortfolioSummary(portfolioProjects),
    [portfolioProjects],
  );
  const tasks = useMemo(
    () => planningModelToScheduleTasks(planModel, networkSchedule),
    [networkSchedule, planModel],
  );
  const controlDate = useMemo(
    () => parseDate(planModel.dataDate),
    [planModel.dataDate],
  );
  const visibleTasks = useMemo(() => deriveVisibleTasks(tasks), [tasks]);
  const timeline = useMemo(
    () => createTimeline(scale, planRange.start, planRange.end),
    [scale, planRange.end, planRange.start],
  );
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? null;
  const graphEditTask = graphEdit
    ? (tasks.find((task) => task.id === graphEdit.taskId) ?? null)
    : null;
  const criticalPathLabel = networkSchedule.criticalPathTaskIds
    .map((taskId) => tasks.find((task) => task.id === taskId)?.code ?? taskId)
    .slice(0, 8)
    .join(" -> ");
  const currentPlanLocation = currentPlanFile
    ? `${currentPlanFile.folderName} / ${currentPlanFile.fileName}`
    : "未保存到项目文件";

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setHasSavedDraft(
        Boolean(window.localStorage.getItem(planningDraftStorageKey)),
      );
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
      setChartMenu(null);
      setChartSettings(null);
      setProjectMenu(null);
      setControlDetail(null);
      setViewMenuOpen(false);
      setNewChartMenuOpen(false);
      setExportMenuOpen(false);
      setPortfolioPanelOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setChartMenu(null);
        setChartSettings(null);
        setProjectMenu(null);
        setGraphEdit(null);
        setControlDetail(null);
        setNewProjectDialogOpen(false);
        setNewProjectError(null);
        setProjectPropertiesOpen(false);
        setViewMenuOpen(false);
        setNewChartMenuOpen(false);
        setExportMenuOpen(false);
        setPortfolioPanelOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function audit(summary: string) {
    onAudit?.(
      createModuleAuditEvent(
        "planning-feichuan-engine",
        "FeichuanPlanningWorkbench",
        summary,
      ),
    );
  }

  const activatePlanningModel = useCallback(
    (
      next: ProjectPlanningModel,
      nextView: ScheduleView = "gantt",
      fileState: PlanningProjectFileState | null = null,
    ) => {
      setPlanModel(next);
      setView(nextView);
      setCurrentPlanFile(fileState);
      setSelectedTaskId(next.tasks[0]?.id ?? "");
      setPlanRange(getPlanningModelRange(next));
      setGraphEdit(null);
      setContextMenu(null);
      setChartMenu(null);
      setChartSettings(null);
      setProjectMenu(null);
      setControlDetail(null);
      setNewProjectDialogOpen(false);
      setNewProjectError(null);
      setProjectPropertiesOpen(false);
      setViewMenuOpen(false);
      setNewChartMenuOpen(false);
      setExportMenuOpen(false);
      setPortfolioPanelOpen(false);
      setSelectedPortfolioProjectId(portfolioCurrentProjectId);
    },
    [],
  );

  const activatePlanningProjectFromNav = useCallback(
    (request: ArchitokenPlanningProjectSelectionRequest) => {
      const blankOptions: BlankPlanningModelOptions = {
        projectName: request.projectName,
      };
      if (request.startDate) blankOptions.start = request.startDate;
      if (request.endDate) blankOptions.end = request.endDate;
      const defaultProject =
        request.projectId === defaultPlanningProjectId ||
        request.projectName === initialPlanningModel.projectName;
      const next = defaultProject
        ? clonePlanningModel(initialPlanningModel)
        : createBlankGanttPlanningModel(
            new Date().toISOString(),
            "gantt",
            blankOptions,
          );
      if (defaultProject && request.projectName !== next.projectName) {
        next.projectName = request.projectName;
        next.baselineName = `${request.projectName} 基线`;
        next.wbs = next.wbs.map((wbs, index) =>
          index === 0 ? { ...wbs, title: request.projectName } : wbs,
        );
        next.tasks = next.tasks.map((task, index) =>
          index === 0 ? { ...task, title: request.projectName } : task,
        );
      }
      activatePlanningModel(next, "gantt", null);
      setHasSavedDraft(false);
      window.sessionStorage.removeItem(
        architokenPendingPlanningProjectSelectionKey,
      );
      onAudit?.(
        createModuleAuditEvent(
          "planning-feichuan-engine",
          "FeichuanPlanningWorkbench",
          `切换计划项目: ${request.projectName}`,
        ),
      );
    },
    [activatePlanningModel, onAudit],
  );

  useEffect(() => {
    function handlePlanningProjectSelection(event: Event) {
      activatePlanningProjectFromNav(
        (event as CustomEvent<ArchitokenPlanningProjectSelectionRequest>)
          .detail,
      );
    }

    window.addEventListener(
      architokenPlanningProjectSelectionEventName,
      handlePlanningProjectSelection,
    );

    let pendingFrame: number | null = null;
    const pending = window.sessionStorage.getItem(
      architokenPendingPlanningProjectSelectionKey,
    );
    if (pending) {
      try {
        const request = JSON.parse(
          pending,
        ) as ArchitokenPlanningProjectSelectionRequest;
        pendingFrame = window.requestAnimationFrame(() => {
          window.dispatchEvent(
            new CustomEvent(architokenPlanningProjectSelectionEventName, {
              detail: request,
            }),
          );
        });
      } catch {
        window.sessionStorage.removeItem(
          architokenPendingPlanningProjectSelectionKey,
        );
      }
    }

    return () => {
      if (pendingFrame !== null) {
        window.cancelAnimationFrame(pendingFrame);
      }
      window.removeEventListener(
        architokenPlanningProjectSelectionEventName,
        handlePlanningProjectSelection,
      );
    };
  }, [activatePlanningProjectFromNav]);

  function openPlanningControlDetail(
    key: PlanningControlKey,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const panelWidth = 460;
    const panelHeight = 212;
    setActiveControlKey(key);
    setControlDetail({
      key,
      x: Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12)),
      y: Math.max(
        76,
        Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 12),
      ),
    });
  }

  function persistPlanningDraft(model: ProjectPlanningModel) {
    window.localStorage.setItem(planningDraftStorageKey, JSON.stringify(model));
    setHasSavedDraft(true);
  }

  function openDefaultPlanningModel() {
    activatePlanningModel(clonePlanningModel(initialPlanningModel), "gantt");
    audit("打开内置示例进度计划");
  }

  function openSavedPlanningDraft() {
    const content = window.localStorage.getItem(planningDraftStorageKey);
    if (!content) return;
    const parsed = JSON.parse(content) as ProjectPlanningModel;
    if (
      parsed.schema !== "architoken.project_planning_studio.v1" ||
      parsed.moduleId !== "planning_management"
    ) {
      return;
    }
    activatePlanningModel(parsed, "gantt");
    audit("打开最近保存的计划草稿");
  }

  function openPlanningProjectFolder(folder: PlanningSaveFolder) {
    setNewChartMenuOpen(false);
    setPlanningSaveFolders(listPlanningSaveFolders());
    activatePlanningProjectFromNav(
      buildPlanningProjectSelectionRequestFromFolder(folder),
    );
  }

  function toggleTask(taskId: string) {
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, isExpanded: !task.isExpanded } : task,
      ),
    }));
  }

  function updatePlanRange(field: "start" | "end", value: string) {
    if (!value) return;
    setPlanRange((current) => ({ ...current, [field]: value }));
  }

  function updateTask(taskId: string, patch: Partial<ScheduleTask>) {
    const target = tasks.find((task) => task.id === taskId);
    const unlockOnly =
      Object.keys(patch).length === 1 && patch.locked === false;
    if (target?.locked && !unlockOnly) return;
    const planningPatch = schedulePatchToPlanningPatch(patch);
    const progressOnly =
      Object.keys(patch).length === 1 && patch.progress !== undefined;
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, ...planningPatch } : task,
      ),
      auditTrail: progressOnly
        ? current.auditTrail
        : [
            {
              id: `feichuan-task-edit-${Date.now()}`,
              at: new Date().toISOString(),
              actor: "FeichuanPlanningWorkbench",
              summary: `图上/表单编辑任务 ${taskId}`,
            },
            ...current.auditTrail,
          ],
    }));
    if (!progressOnly) {
      audit(
        `更新进度任务: ${tasks.find((task) => task.id === taskId)?.name ?? taskId}`,
      );
    }
  }

  function openTaskContextMenu(
    taskId: string,
    event: ReactMouseEvent<Element>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTaskId(taskId);
    setGraphEdit(null);
    setContextMenu({
      taskId,
      x: clampNumber(event.clientX, 8, window.innerWidth - 300),
      y: clampNumber(event.clientY, 8, window.innerHeight - 560),
    });
  }

  function openSelectedTaskContextMenu(event: ReactMouseEvent<Element>) {
    const taskId =
      selectedTask?.id ?? visibleTasks[0]?.id ?? planModel.tasks[0]?.id;
    if (taskId) {
      openTaskContextMenu(taskId, event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function openChartContextMenu(
    targetView: ScheduleView,
    event: ReactMouseEvent<Element>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setView(targetView);
    setGraphEdit(null);
    setContextMenu(null);
    setChartMenu({
      view: targetView,
      x: clampNumber(event.clientX, 8, window.innerWidth - 310),
      y: clampNumber(event.clientY, 8, window.innerHeight - 330),
    });
  }

  function openProjectContextMenu(event: ReactMouseEvent<Element>) {
    event.preventDefault();
    event.stopPropagation();
    setGraphEdit(null);
    setContextMenu(null);
    setChartMenu(null);
    setChartSettings(null);
    setControlDetail(null);
    setViewMenuOpen(false);
    setNewChartMenuOpen(false);
    setExportMenuOpen(false);
    setPortfolioPanelOpen(false);
    setProjectMenu({
      x: clampNumber(event.clientX, 8, window.innerWidth - 330),
      y: clampNumber(event.clientY, 8, window.innerHeight - 430),
    });
  }

  function renamePlanningProject() {
    const nextName = window.prompt("项目名称", planModel.projectName)?.trim();
    if (!nextName || nextName === planModel.projectName) return;
    const nextFileName = getPlanningProjectFileName(nextName);
    setPlanModel((current) => ({
      ...current,
      projectName: nextName,
      baselineName: current.baselineName.includes(current.projectName)
        ? current.baselineName.replace(current.projectName, nextName)
        : current.baselineName,
      wbs: current.wbs.map((item) =>
        item.parentId === null ? { ...item, title: nextName } : item,
      ),
      tasks: current.tasks.map((task) =>
        task.parentTaskId === null ? { ...task, title: nextName } : task,
      ),
      auditTrail: [
        {
          id: `feichuan-project-rename-${Date.now()}`,
          at: new Date().toISOString(),
          actor: "FeichuanPlanningWorkbench",
          summary: `重命名计划项目: ${nextName}`,
        },
        ...current.auditTrail,
      ],
    }));
    if (currentPlanFile) {
      try {
        const result = moduleBackendAdapter.renameFile(
          currentPlanFile.fileId,
          nextFileName,
        );
        onAudit?.(result.auditEvent);
        setCurrentPlanFile((current) =>
          current
            ? {
                ...current,
                fileId: result.node.id,
                fileName: result.node.name,
                savedAt: result.node.updatedAt,
              }
            : current,
        );
      } catch (error) {
        audit(
          `计划项目文件重命名失败: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    setProjectMenu(null);
    audit(`重命名计划项目: ${nextName}`);
  }

  function deletePlanningProject() {
    const targetLabel = currentPlanFile
      ? `${currentPlanFile.folderName} / ${currentPlanFile.fileName}`
      : planModel.projectName;
    if (!window.confirm(`删除当前计划项目？\n${targetLabel}`)) {
      setProjectMenu(null);
      return;
    }
    if (currentPlanFile) {
      try {
        const result = moduleBackendAdapter.deleteFile(currentPlanFile.fileId);
        onAudit?.(result.auditEvent);
      } catch (error) {
        audit(
          `计划项目文件删除失败: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    const today = formatDate(new Date());
    const next = createBlankGanttPlanningModel(
      new Date().toISOString(),
      "gantt",
      {
        projectName: "未命名计划项目",
        start: today,
        end: shiftDate(today, 21),
      },
    );
    window.localStorage.removeItem(planningDraftStorageKey);
    setHasSavedDraft(false);
    activatePlanningModel(next, "gantt", null);
    audit("删除当前计划项目并切换到未命名计划项目");
  }

  function openProjectProperties() {
    setProjectMenu(null);
    setProjectPropertiesOpen(true);
    audit("查看计划项目属性");
  }

  function openGraphEditor(
    taskId: string,
    event: ReactMouseEvent<Element>,
    mode: GraphEditMode = "task",
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTaskId(taskId);
    setContextMenu(null);
    const offsetX = mode === "progress" ? 18 : 12;
    const offsetY = mode === "progress" ? 38 : 14;
    setGraphEdit({
      taskId,
      mode,
      x: clampNumber(event.clientX + offsetX, 12, window.innerWidth - 300),
      y: clampNumber(event.clientY + offsetY, 12, window.innerHeight - 330),
    });
  }

  function addTask(mode: AddTaskMode = "after", baseTaskId = selectedTaskId) {
    const selected =
      tasks.find((task) => task.id === baseTaskId) ?? selectedTask ?? tasks[0];
    if (!selected || selected.locked) return;
    const selectedPlanningTask = planModel.tasks.find(
      (task) => task.id === selected.id,
    );
    const identity = createNextPlanningTaskIdentity(planModel.tasks);
    const start =
      mode === "child" || mode === "parent"
        ? selected.start
        : shiftDate(selected.end, 1);
    const end =
      mode === "child" || mode === "parent"
        ? selected.end
        : shiftDate(start, 21);
    const duration = calculateDuration(start, end);
    const next: PlanningTask = {
      id: identity.id,
      code: identity.code,
      title:
        mode === "parent"
          ? `新增父任务 ${identity.index}`
          : mode === "child"
            ? `新增子任务 ${identity.index}`
            : `新增同级任务 ${identity.index}`,
      description: "",
      wbsId: selectedPlanningTask?.wbsId ?? planModel.wbs[0]?.id ?? "wbs-1",
      owner: selected.owner ?? "计划工程师",
      start,
      end,
      progress: 0,
      dependencies: mode === "after" ? [selected.id] : [],
      dependencyRules:
        mode === "after"
          ? [{ predecessorId: selected.id, type: "FS", lagDays: 0 }]
          : [],
      parentTaskId:
        mode === "child" ? selected.id : (selected.parentId ?? null),
      outlineLevel:
        mode === "child" ? Math.min(selected.level + 1, 6) : selected.level,
      isExpanded: true,
      baselineStart: start,
      baselineEnd: end,
      durationOptimistic: Math.max(1, duration - 3),
      durationMostLikely: duration,
      durationPessimistic: duration + 5,
      calendarId:
        selectedPlanningTask?.calendarId ??
        planModel.calendars[0]?.id ??
        "cal-johor-site",
      resourceDemand: selectedPlanningTask?.resourceDemand ?? 1,
      budgetAmount: Math.max(0, duration * 5200),
      actualCostAmount: 0,
      approvalRequired: false,
      status: "todo",
      resourceId:
        selectedPlanningTask?.resourceId ??
        planModel.resources[0]?.id ??
        "res-pm",
      riskId:
        selectedPlanningTask?.riskId ??
        planModel.risks[0]?.id ??
        "risk-interface",
      diagramStyle: selected.diagramStyle
        ? { ...selected.diagramStyle }
        : undefined,
    };
    setPlanModel((current) => {
      const insertIndex = Math.max(
        0,
        current.tasks.findIndex((task) => task.id === selected.id),
      );
      const nextTasks = current.tasks.map((task) =>
        mode === "child" && task.id === selected.id
          ? { ...task, isExpanded: true }
          : task,
      );

      if (mode === "parent") {
        const withParent = nextTasks.map((task) => {
          if (task.id === selected.id) {
            return {
              ...task,
              parentTaskId: next.id,
              outlineLevel: Math.min(
                (task.outlineLevel ?? selected.level) + 1,
                6,
              ),
            };
          }
          if (isPlanningTaskDescendant(nextTasks, selected.id, task.id)) {
            return {
              ...task,
              outlineLevel: Math.min(
                (task.outlineLevel ?? selected.level) + 1,
                6,
              ),
            };
          }
          return task;
        });
        return {
          ...current,
          tasks: [
            ...withParent.slice(0, insertIndex),
            next,
            ...withParent.slice(insertIndex),
          ],
          auditTrail: [
            {
              id: `feichuan-task-add-${Date.now()}`,
              at: new Date().toISOString(),
              actor: "FeichuanPlanningWorkbench",
              summary: `新增父任务 ${next.code}`,
            },
            ...current.auditTrail,
          ],
        };
      }

      return {
        ...current,
        tasks: [
          ...nextTasks.slice(0, insertIndex + 1),
          next,
          ...nextTasks.slice(insertIndex + 1),
        ],
        auditTrail: [
          {
            id: `feichuan-task-add-${Date.now()}`,
            at: new Date().toISOString(),
            actor: "FeichuanPlanningWorkbench",
            summary: `新增任务 ${next.code}`,
          },
          ...current.auditTrail,
        ],
      };
    });
    setSelectedTaskId(identity.id);
    setContextMenu(null);
    audit(`新增柔佛进度任务: ${next.title}`);
  }

  function deleteSelectedTask(taskId = selectedTaskId) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || target.parentId === null || target.locked) return;
    const deletedIds = collectDescendantIds(tasks, target.id);
    const fallback =
      tasks.find((task) => !deletedIds.has(task.id) && task.id !== target.id)
        ?.id ?? "task-1";
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks
        .filter((task) => !deletedIds.has(task.id))
        .map((task) => {
          const dependencyRules = task.dependencyRules?.filter(
            (dependency) => !deletedIds.has(dependency.predecessorId),
          );
          return {
            ...task,
            dependencies: task.dependencies.filter(
              (dependency) => !deletedIds.has(dependency),
            ),
            ...(dependencyRules ? { dependencyRules } : {}),
          };
        }),
      milestones: current.milestones.map((milestone) => ({
        ...milestone,
        linkedTaskIds: milestone.linkedTaskIds.filter(
          (taskId) => !deletedIds.has(taskId),
        ),
      })),
      auditTrail: [
        {
          id: `feichuan-task-delete-${Date.now()}`,
          at: new Date().toISOString(),
          actor: "FeichuanPlanningWorkbench",
          summary: `删除任务 ${target.name}`,
        },
        ...current.auditTrail,
      ],
    }));
    setSelectedTaskId(fallback);
    setGraphEdit(null);
    setContextMenu(null);
    audit(`删除进度任务: ${target.name}`);
  }

  function copyTask(taskId: string) {
    const source = planModel.tasks.find((task) => task.id === taskId);
    if (!source) return;
    setCopiedTask(clonePlanningTask(source));
    setContextMenu(null);
  }

  function pasteTask(targetTaskId = selectedTaskId) {
    if (!copiedTask) return;
    const target =
      tasks.find((task) => task.id === targetTaskId) ?? selectedTask;
    if (!target || target.locked) return;
    const identity = createNextPlanningTaskIdentity(planModel.tasks);
    const pasted: PlanningTask = {
      ...clonePlanningTask(copiedTask),
      id: identity.id,
      code: identity.code,
      title: `${copiedTask.title} 副本`,
      parentTaskId: target.parentId,
      outlineLevel: target.level,
      dependencies: [],
      dependencyRules: [],
      locked: false,
    };
    setPlanModel((current) => {
      const insertIndex = Math.max(
        0,
        current.tasks.findIndex((task) => task.id === target.id),
      );
      return {
        ...current,
        tasks: [
          ...current.tasks.slice(0, insertIndex + 1),
          pasted,
          ...current.tasks.slice(insertIndex + 1),
        ],
        auditTrail: [
          {
            id: `feichuan-task-paste-${Date.now()}`,
            at: new Date().toISOString(),
            actor: "FeichuanPlanningWorkbench",
            summary: `粘贴任务 ${pasted.code}`,
          },
          ...current.auditTrail,
        ],
      };
    });
    setSelectedTaskId(pasted.id);
    setContextMenu(null);
    audit(`粘贴进度任务: ${pasted.title}`);
  }

  function duplicateTask(taskId = selectedTaskId) {
    const source = planModel.tasks.find((task) => task.id === taskId);
    const target = tasks.find((task) => task.id === taskId);
    if (!source || target?.locked) return;
    const identity = createNextPlanningTaskIdentity(planModel.tasks);
    const duplicate: PlanningTask = {
      ...clonePlanningTask(source),
      id: identity.id,
      code: identity.code,
      title: `${source.title} 副本`,
      dependencies: [...source.dependencies],
      dependencyRules:
        source.dependencyRules?.map((dependency) => ({ ...dependency })) ?? [],
      locked: false,
    };
    setPlanModel((current) => {
      const insertIndex = Math.max(
        0,
        current.tasks.findIndex((task) => task.id === source.id),
      );
      return {
        ...current,
        tasks: [
          ...current.tasks.slice(0, insertIndex + 1),
          duplicate,
          ...current.tasks.slice(insertIndex + 1),
        ],
        auditTrail: [
          {
            id: `feichuan-task-duplicate-${Date.now()}`,
            at: new Date().toISOString(),
            actor: "FeichuanPlanningWorkbench",
            summary: `创建任务副本 ${duplicate.code}`,
          },
          ...current.auditTrail,
        ],
      };
    });
    setSelectedTaskId(duplicate.id);
    setContextMenu(null);
    audit(`创建任务副本: ${duplicate.title}`);
  }

  function copyTaskStyle(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setCopiedStyle({ ...resolveTaskDiagramStyle(task) });
    setContextMenu(null);
  }

  function pasteTaskStyle(taskId: string) {
    if (!copiedStyle) return;
    updateTaskStyle(taskId, copiedStyle);
  }

  function updateTaskStyle(taskId: string, patch: Partial<TaskDiagramStyle>) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || target.locked) return;
    const nextStyle = { ...resolveTaskDiagramStyle(target), ...patch };
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, diagramStyle: nextStyle } : task,
      ),
      auditTrail: [
        {
          id: `feichuan-task-style-${Date.now()}`,
          at: new Date().toISOString(),
          actor: "FeichuanPlanningWorkbench",
          summary: `更新任务图形样式 ${target.code}`,
        },
        ...current.auditTrail,
      ],
    }));
  }

  function toggleTaskLock(taskId: string) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, locked: !task.locked } : task,
      ),
      auditTrail: [
        {
          id: `feichuan-task-lock-${Date.now()}`,
          at: new Date().toISOString(),
          actor: "FeichuanPlanningWorkbench",
          summary: `${target.locked ? "解锁" : "锁定"}任务 ${target.code}`,
        },
        ...current.auditTrail,
      ],
    }));
    setContextMenu(null);
  }

  function changeTaskLevel(taskId: string, direction: "promote" | "demote") {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || target.locked) return;
    setPlanModel((current) => ({
      ...current,
      tasks: adjustPlanningTaskLevel(current.tasks, taskId, direction),
      auditTrail: [
        {
          id: `feichuan-task-level-${Date.now()}`,
          at: new Date().toISOString(),
          actor: "FeichuanPlanningWorkbench",
          summary: `调整任务层级 ${target.code}`,
        },
        ...current.auditTrail,
      ],
    }));
    setContextMenu(null);
  }

  async function savePlanningVersion() {
    const next = createPlanningVersion(
      planModel,
      "FeichuanPlanningWorkbench",
      "飞椽计划图表与网络参数在线保存",
    );
    setPlanModel(next);
    persistPlanningDraft(next);
    if (!currentPlanFile) {
      audit("保存飞椽进度计划版本到浏览器草稿");
      return;
    }

    try {
      const result = await updatePlanningProjectModelFile(
        next,
        currentPlanFile,
      );
      setCurrentPlanFile(result.fileState);
      onAudit?.(result.auditEvent);
      audit(
        `保存计划项目文件: ${result.fileState.folderName} / ${result.fileState.fileName}`,
      );
    } catch (error) {
      audit(
        `计划项目文件写回失败: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  function savePlanningAsCopy(targetView: ScheduleView) {
    const pack = createPlanningExport(planModel, "json");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const fileStem = sanitizePlanningFileStem(
      `${planModel.projectName}-${viewLabels[targetView]}-另存为-${stamp}`,
    );
    downloadPlanningExport(
      `${fileStem}.archiplan.json`,
      pack.mimeType,
      pack.content,
    );
    audit(`另存为${viewLabels[targetView]}计划包`);
  }

  function printPlanningChart(targetView: ScheduleView) {
    audit(`打印${viewLabels[targetView]}`);
    window.print();
  }

  function sharePlanningChart(targetView: ScheduleView) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#${targetView}`;
    void navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    audit(`分享${viewLabels[targetView]}链接: ${shareUrl}`);
  }

  function openChartSettingsPanel(targetView: ScheduleView) {
    setChartMenu(null);
    setChartSettings({
      view: targetView,
      x: clampNumber(
        chartMenu?.x ?? window.innerWidth - 330,
        8,
        window.innerWidth - 330,
      ),
      y: clampNumber(chartMenu?.y ?? 120, 8, window.innerHeight - 260),
    });
    audit(`打开${viewLabels[targetView]}设置`);
  }

  async function exportPlanningPackage(kind: PlanningExportKind) {
    if (kind === "xlsx" || kind === "xmind") {
      const pack = createPlanningBinaryExport(planModel, kind);
      downloadPlanningExport(pack.fileName, pack.mimeType, pack.content);
      audit(`导出计划包: ${pack.fileName}`);
      return;
    }

    if (kind === "png" || kind === "jpg") {
      const svgPack = createPlanningExport(planModel, "svg");
      const blob = await rasterizeSvgExport(svgPack.content, kind);
      const fileName = svgPack.fileName.replace(
        /\.svg$/i,
        kind === "png" ? ".png" : ".jpg",
      );
      downloadPlanningExport(
        fileName,
        kind === "png" ? "image/png" : "image/jpeg",
        blob,
      );
      audit(`导出计划图像: ${fileName}`);
      return;
    }

    const pack = createPlanningExport(planModel, kind);
    downloadPlanningExport(pack.fileName, pack.mimeType, pack.content);
    audit(`导出计划包: ${pack.fileName}`);
  }

  async function importPlanningPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const content = await file.text();
    if (isPlanningTableImport(file, content)) {
      const normalized = createPlanningModelFromTableImport(
        file.name,
        content,
        new Date().toISOString(),
      );
      activatePlanningModel(normalized, "gantt");
      audit(`导入 CSV/Excel 计划表: ${file.name}`);
      return;
    }
    const parsed = JSON.parse(content) as Partial<ProjectPlanningModel>;
    if (
      parsed.schema !== "architoken.project_planning_studio.v1" ||
      parsed.moduleId !== "planning_management"
    ) {
      throw new Error("导入文件不是 ArchIToken 计划管理模型。");
    }
    const normalized: ProjectPlanningModel = {
      ...initialPlanningModel,
      ...parsed,
      costBaselineCurrency:
        parsed.costBaselineCurrency ??
        initialPlanningModel.costBaselineCurrency,
      calendars: parsed.calendars?.length
        ? parsed.calendars
        : initialPlanningModel.calendars,
      wbs: parsed.wbs ?? initialPlanningModel.wbs,
      tasks: parsed.tasks ?? initialPlanningModel.tasks,
      milestones: parsed.milestones ?? initialPlanningModel.milestones,
      resources: parsed.resources ?? initialPlanningModel.resources,
      risks: parsed.risks ?? initialPlanningModel.risks,
      raci: parsed.raci ?? initialPlanningModel.raci,
      contractNodes: parsed.contractNodes ?? initialPlanningModel.contractNodes,
      qualityGates: parsed.qualityGates ?? initialPlanningModel.qualityGates,
      safetyPermits: parsed.safetyPermits ?? initialPlanningModel.safetyPermits,
      procurementPackages:
        parsed.procurementPackages ?? initialPlanningModel.procurementPackages,
      changeRequests:
        parsed.changeRequests ?? initialPlanningModel.changeRequests,
      professionalSignoffs:
        parsed.professionalSignoffs ??
        initialPlanningModel.professionalSignoffs,
      progressFeedback: parsed.progressFeedback ?? [],
      adjustments: parsed.adjustments ?? [],
      diagrams: parsed.diagrams ?? initialPlanningModel.diagrams,
      versions: parsed.versions ?? initialPlanningModel.versions,
      auditTrail: parsed.auditTrail ?? initialPlanningModel.auditTrail,
    };
    activatePlanningModel(normalized, "gantt");
    audit(`导入计划包: ${file.name}`);
  }

  function applySelectedTaskAdjustment(shiftDays: number) {
    if (!selectedTask) return;
    setPlanModel((current) =>
      applyPlanningScheduleAdjustment(current, {
        taskIds: [selectedTask.id],
        shiftDays,
        reason: shiftDays > 0 ? "图上计划顺延调整。" : "图上计划赶工调整。",
        actor: "计划工程师",
        includeSuccessors: true,
      }),
    );
    audit(
      `${selectedTask.name} ${shiftDays > 0 ? "顺延" : "赶工"} ${Math.abs(shiftDays)} 天并影响后续任务`,
    );
  }

  function updateProfessionalSignoff(
    signoffId: string,
    status: ProjectPlanningModel["professionalSignoffs"][number]["status"],
  ) {
    const at = new Date().toISOString();
    setPlanModel((current) => ({
      ...current,
      professionalSignoffs: current.professionalSignoffs.map((item) =>
        item.id === signoffId
          ? {
              ...item,
              status,
              signedAt: status === "signed" ? at : null,
              evidenceRefs:
                status === "signed"
                  ? Array.from(
                      new Set([
                        ...item.evidenceRefs,
                        `signoff:${signoffId}`,
                        `audit:signoff-${Date.now()}`,
                      ]),
                    )
                  : item.evidenceRefs,
            }
          : item,
      ),
      auditTrail: [
        {
          id: `feichuan-signoff-${Date.now()}`,
          at,
          actor: "FeichuanPlanningWorkbench",
          summary: `更新专业签审 ${signoffId}: ${status}`,
        },
        ...current.auditTrail,
      ],
    }));
    audit(`更新专业签审: ${signoffId}`);
  }

  function selectPortfolioProject(projectId: string) {
    const project = portfolioProjects.find((item) => item.id === projectId);
    if (!project) return;
    setSelectedPortfolioProjectId(projectId);
    const targetTaskId =
      project.taskIds.find((taskId) =>
        planModel.tasks.some((task) => task.id === taskId),
      ) ?? project.taskIds[0];
    if (targetTaskId) setSelectedTaskId(targetTaskId);
    audit(`切换企业进度看板项目: ${project.name}`);
  }

  function registerPortfolioDisposition(projectId: string) {
    const project = portfolioProjects.find((item) => item.id === projectId);
    if (!project || project.riskDisposition !== "pending") return;
    setPortfolioClosedDispositionIds((current) => {
      const next = new Set(current);
      next.add(projectId);
      return next;
    });
    audit(`登记企业进度风险处置: ${project.name}`);
  }

  function updatePortfolioRiskModel(
    patch: Partial<PlanningPortfolioRiskModel>,
  ) {
    setPortfolioRiskModel((current) => ({ ...current, ...patch }));
    audit("更新企业进度风险模型阈值");
  }

  function exportPortfolioBoard() {
    downloadPlanningExport(
      `${planModel.planId}-${planModel.currentVersion}-portfolio-board.csv`,
      "text/csv",
      planningPortfolioToCsv(portfolioProjects, portfolioRiskModel),
    );
    audit("导出企业进度看板台账");
  }

  function exportMilestoneLedger() {
    downloadPlanningExport(
      `${planModel.planId}-${planModel.currentVersion}-milestone-ledger.csv`,
      "text/csv",
      planningMilestoneLedgerToCsv(planModel, portfolioProjects),
    );
    audit("导出项目里程碑台账");
  }

  function changeView(next: ScheduleView) {
    setView(next);
    setViewMenuOpen(false);
    setNewChartMenuOpen(false);
    setExportMenuOpen(false);
    setPortfolioPanelOpen(false);
    audit(`切换工程进度视图: ${viewLabels[next]}`);
  }

  function openNewProjectDialog(targetView: ScheduleView = view) {
    const nextFolders = listPlanningSaveFolders();
    setPlanningSaveFolders(nextFolders);
    setNewProjectDraft(
      createDefaultNewPlanningProjectDraft(targetView, nextFolders),
    );
    setNewProjectError(null);
    setNewProjectDialogOpen(true);
    setProjectMenu(null);
    setViewMenuOpen(false);
    setNewChartMenuOpen(false);
    setExportMenuOpen(false);
    setPortfolioPanelOpen(false);
  }

  function createNewPlanningChart(targetView: ScheduleView = "gantt") {
    const next = createBlankGanttPlanningModel(
      new Date().toISOString(),
      targetView,
    );
    window.localStorage.removeItem(planningDraftStorageKey);
    setHasSavedDraft(false);
    activatePlanningModel(next, targetView, null);
    audit(`新建${viewLabels[targetView]}计划`);
  }

  function refreshPlanningFolderOptions(preferredFolderId?: string) {
    const nextFolders = listPlanningSaveFolders();
    setPlanningSaveFolders(nextFolders);
    setNewProjectDraft((current) => {
      const candidateId =
        preferredFolderId &&
        nextFolders.some((item) => item.id === preferredFolderId)
          ? preferredFolderId
          : current.folderId;
      const nextFolder = nextFolders.some((item) => item.id === candidateId)
        ? candidateId
        : getDefaultPlanningSaveFolder(nextFolders).id;
      return { ...current, folderId: nextFolder };
    });
  }

  function handleNewPlanningFolderContextAction(
    action: FileContextAction,
    folder: PlanningSaveFolder,
  ) {
    if (action === "open" || action === "properties") {
      setNewProjectDraft((current) => ({ ...current, folderId: folder.id }));
      setNewProjectError(null);
      return;
    }

    if (action === "new_folder") {
      const result = moduleBackendAdapter.createFile({
        moduleId: planningModuleId,
        parentId: folder.id,
        name: getUniquePlanningNodeName(folder.id, "新建目录"),
        type: "folder",
      });
      onAudit?.(result.auditEvent);
      refreshPlanningFolderOptions(result.node.id);
      setNewProjectError(null);
      return;
    }

    const extension = planningContextFileExtensionByAction[action];
    if (extension) {
      const result = moduleBackendAdapter.createFile({
        moduleId: planningModuleId,
        parentId: folder.id,
        name: getUniquePlanningNodeName(folder.id, "新建文件", extension),
        type: "file",
      });
      onAudit?.(result.auditEvent);
      refreshPlanningFolderOptions(folder.id);
      setNewProjectError(null);
    }
  }

  async function createPlanningProjectFromDraft() {
    const projectName = newProjectDraft.name.trim();
    if (!projectName) {
      setNewProjectError("项目名称不能为空。");
      return;
    }

    const folder =
      planningSaveFolders.find(
        (item) => item.id === newProjectDraft.folderId,
      ) ?? getDefaultPlanningSaveFolder(planningSaveFolders);
    const start = newProjectDraft.start || formatDate(new Date());
    const end =
      newProjectDraft.end && parseDate(newProjectDraft.end) >= parseDate(start)
        ? newProjectDraft.end
        : shiftDate(start, 21);
    const createdAt = new Date().toISOString();
    const next = createBlankGanttPlanningModel(
      createdAt,
      newProjectDraft.view,
      {
        projectName,
        start,
        end,
      },
    );
    const fileName = getPlanningProjectFileName(projectName);

    setNewProjectCreating(true);
    setNewProjectError(null);
    try {
      const result = await uploadPlanningProjectModelFile(
        next,
        folder,
        fileName,
      );
      onAudit?.(result.auditEvent);
      persistPlanningDraft(next);
      activatePlanningModel(next, newProjectDraft.view, result.fileState);
      audit(
        `新建计划项目并保存到 ${result.fileState.folderName} / ${result.fileState.fileName}`,
      );
    } catch (error) {
      setNewProjectError(
        error instanceof Error ? error.message : "计划项目保存失败。",
      );
    } finally {
      setNewProjectCreating(false);
    }
  }

  return (
    <section className="feichuan-engine">
      <header className="feichuan-engine-toolbar is-compact">
        <div className="feichuan-toolbar-stack">
          <div
            className="feichuan-unified-toolbar"
            onContextMenu={openProjectContextMenu}
          >
            <div className="feichuan-toolbar-left">
              <div
                className="feichuan-menu-picker is-new"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <Button
                  type="primary"
                  aria-label="新建"
                  icon={<PlusCircleOutlined />}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setPlanningSaveFolders(listPlanningSaveFolders());
                    setNewChartMenuOpen((open) => !open);
                    setProjectMenu(null);
                    setControlDetail(null);
                    setViewMenuOpen(false);
                    setExportMenuOpen(false);
                    setPortfolioPanelOpen(false);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setPlanningSaveFolders(listPlanningSaveFolders());
                    setNewChartMenuOpen((open) => !open);
                    setProjectMenu(null);
                    setControlDetail(null);
                    setViewMenuOpen(false);
                    setExportMenuOpen(false);
                    setPortfolioPanelOpen(false);
                  }}
                >
                  新建计划
                </Button>
                {newChartMenuOpen ? (
                  <PlanningLauncherPanel
                    folders={planningSaveFolders}
                    activeView={view}
                    hasSavedDraft={hasSavedDraft}
                    onNewProject={() => openNewProjectDialog(view)}
                    onOpenExample={() => {
                      setNewChartMenuOpen(false);
                      openDefaultPlanningModel();
                    }}
                    onOpenRecent={() => {
                      setNewChartMenuOpen(false);
                      openSavedPlanningDraft();
                    }}
                    onSelectProject={openPlanningProjectFolder}
                    onCreateChart={(targetView) => {
                      setNewChartMenuOpen(false);
                      createNewPlanningChart(targetView);
                    }}
                    onClose={() => setNewChartMenuOpen(false)}
                  />
                ) : null}
              </div>
              <Button size="small" onClick={openDefaultPlanningModel}>
                打开示例
              </Button>
              <PortfolioControlBoard
                projects={portfolioProjects}
                summary={portfolioSummary}
                riskModel={portfolioRiskModel}
                integrationCapabilities={planningIntegrationCapabilities}
                selectedProjectId={selectedPortfolioProjectId}
                panelOpen={portfolioPanelOpen}
                onTogglePanel={() => {
                  setPortfolioPanelOpen((open) => !open);
                  setProjectMenu(null);
                  setControlDetail(null);
                  setViewMenuOpen(false);
                  setNewChartMenuOpen(false);
                  setExportMenuOpen(false);
                }}
                onClosePanel={() => setPortfolioPanelOpen(false)}
                onSelectProject={selectPortfolioProject}
                onRegisterDisposition={registerPortfolioDisposition}
                onRiskModelChange={updatePortfolioRiskModel}
                onExportBoard={exportPortfolioBoard}
                onExportMilestones={exportMilestoneLedger}
              />
            </div>
            <button
              type="button"
              className="feichuan-project-title-button"
              aria-label="计划项目菜单"
              title={`${planModel.projectName}\n${currentPlanLocation}`}
              onDoubleClick={openProjectProperties}
              onContextMenu={openProjectContextMenu}
            >
              <strong>{planModel.projectName}</strong>
            </button>
            <div
              className="feichuan-engine-title feichuan-view-title"
              aria-hidden="true"
            >
              <strong>{viewLabels[view]}</strong>
            </div>
            <div className="feichuan-toolbar-right">
              <div
                className="feichuan-menu-picker is-view"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <Button
                  size="small"
                  aria-label={`当前图表 ${viewLabels[view]}`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setViewMenuOpen((open) => !open);
                    setProjectMenu(null);
                    setNewChartMenuOpen(false);
                    setExportMenuOpen(false);
                    setPortfolioPanelOpen(false);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setViewMenuOpen((open) => !open);
                    setProjectMenu(null);
                    setNewChartMenuOpen(false);
                    setExportMenuOpen(false);
                    setPortfolioPanelOpen(false);
                  }}
                  onContextMenu={(event) => openChartContextMenu(view, event)}
                >
                  {viewLabels[view]} <DownOutlined />
                </Button>
                {viewMenuOpen ? (
                  <ChartTypeMenu
                    ariaLabel="切换图表视图"
                    actionLabel="切换到"
                    align="right"
                    activeView={view}
                    onSelect={changeView}
                  />
                ) : null}
              </div>
              <ScaleButtons scale={scale} onChange={setScale} />
              <div className="feichuan-date-range" aria-label="计划时间范围">
                <input
                  aria-label="计划开始日期"
                  type="text"
                  value={planRange.start}
                  onChange={(event) =>
                    updatePlanRange("start", event.target.value)
                  }
                />
                <i />
                <input
                  aria-label="计划结束日期"
                  type="text"
                  value={planRange.end}
                  onChange={(event) =>
                    updatePlanRange("end", event.target.value)
                  }
                />
              </div>
              <Button
                size="small"
                aria-label="保存"
                onClick={() => {
                  void savePlanningVersion();
                  setExportMenuOpen(false);
                  setPortfolioPanelOpen(false);
                }}
              >
                保存
              </Button>
              <div
                className="feichuan-export-picker"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <Button
                  size="small"
                  aria-label="导出"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setExportMenuOpen((open) => !open);
                    setViewMenuOpen(false);
                    setNewChartMenuOpen(false);
                    setProjectMenu(null);
                    setPortfolioPanelOpen(false);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setExportMenuOpen((open) => !open);
                    setViewMenuOpen(false);
                    setNewChartMenuOpen(false);
                    setProjectMenu(null);
                    setPortfolioPanelOpen(false);
                  }}
                >
                  导出
                </Button>
                {exportMenuOpen ? (
                  <PlanningExportMenu
                    onSelect={(kind) => {
                      setExportMenuOpen(false);
                      void exportPlanningPackage(kind);
                    }}
                  />
                ) : null}
              </div>
              <Button
                type="primary"
                shape="circle"
                size="small"
                icon={<PlayCircleFilled />}
              />
              <Button
                size="small"
                type={frontlineVisible ? "primary" : "default"}
                icon={<BranchesOutlined />}
                onClick={() => {
                  setFrontlineVisible((visible) => !visible);
                  audit(`${frontlineVisible ? "隐藏" : "显示"}前锋线`);
                }}
              >
                前锋线
              </Button>
            </div>
          </div>
          <InlineTaskEditor
            task={selectedTask}
            onAddTask={addTask}
            onDeleteTask={deleteSelectedTask}
            onUpdateTask={updateTask}
            onAdjustTask={applySelectedTaskAdjustment}
          />
          <PlanningControlStrip
            summary={summary}
            analytics={analytics}
            earnedValue={earnedValue}
            resourceLoad={resourceLoad}
            calendarMetrics={calendarMetrics}
            governance={governance}
            signoff={signoff}
            zpertQuality={zpertQuality}
            alertCount={alerts.length}
            highAlertCount={
              alerts.filter(
                (alert) =>
                  alert.severity === "high" || alert.severity === "critical",
              ).length
            }
            criticalPathLabel={criticalPathLabel}
            coverageGapCount={
              coverage.filter((item) => item.status !== "covered").length
            }
            dependencyWarnings={networkSchedule.dependencyWarnings.length}
            activeKey={activeControlKey}
            onSelect={openPlanningControlDetail}
          />
          <TaskGovernanceLedger
            model={planModel}
            selectedTaskId={selectedTask?.id ?? null}
            onUpdateSignoff={updateProfessionalSignoff}
          />
        </div>
      </header>
      <ProjectContextMenu
        state={projectMenu}
        currentPlanFile={currentPlanFile}
        currentPlanLocation={currentPlanLocation}
        hasSavedDraft={hasSavedDraft}
        onClose={() => setProjectMenu(null)}
        onNew={() => openNewProjectDialog(view)}
        onImportLocal={() => importInputRef.current?.click()}
        onImportExample={openDefaultPlanningModel}
        onImportRecent={openSavedPlanningDraft}
        onSave={() => void savePlanningVersion()}
        onSaveAs={() => savePlanningAsCopy(view)}
        onExport={(kind) => void exportPlanningPackage(kind)}
        onShare={() => sharePlanningChart(view)}
        onRename={renamePlanningProject}
        onDelete={deletePlanningProject}
        onProperties={openProjectProperties}
      />
      {newProjectDialogOpen ? (
        <NewPlanningProjectDialog
          draft={newProjectDraft}
          folders={planningSaveFolders}
          error={newProjectError}
          creating={newProjectCreating}
          onChange={setNewProjectDraft}
          onFolderContextAction={handleNewPlanningFolderContextAction}
          onCancel={() => {
            setNewProjectDialogOpen(false);
            setNewProjectError(null);
          }}
          onCreate={() => void createPlanningProjectFromDraft()}
        />
      ) : null}
      {projectPropertiesOpen ? (
        <ProjectPropertiesDialog
          model={planModel}
          summary={summary}
          view={view}
          currentPlanFile={currentPlanFile}
          currentPlanLocation={currentPlanLocation}
          onClose={() => setProjectPropertiesOpen(false)}
        />
      ) : null}
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.archiplan,.csv,text/csv,application/json"
        className="feichuan-hidden-file"
        aria-label="导入计划包"
        onChange={(event) => void importPlanningPackage(event)}
      />

      <PlanningControlDetail
        state={controlDetail}
        summary={summary}
        analytics={analytics}
        alerts={alerts}
        earnedValue={earnedValue}
        resourceLoad={resourceLoad}
        calendarMetrics={calendarMetrics}
        governance={governance}
        signoff={signoff}
        zpertQuality={zpertQuality}
        coverage={coverage}
        criticalPathLabel={criticalPathLabel}
        dependencyWarnings={networkSchedule.dependencyWarnings.length}
        onClose={() => setControlDetail(null)}
      />

      {view === "gantt" ? (
        <GanttPlanner
          tasks={tasks}
          visibleTasks={visibleTasks}
          timeline={timeline}
          dataDate={controlDate}
          showFrontline={frontlineVisible}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onToggleTask={toggleTask}
          onUpdateTask={updateTask}
          onOpenGraphEditor={openGraphEditor}
          onOpenContextMenu={openTaskContextMenu}
          onOpenCanvasContextMenu={openSelectedTaskContextMenu}
          taskPaneWidth={taskPaneWidth}
          onTaskPaneWidthChange={setTaskPaneWidth}
        />
      ) : isNetworkView(view) ? (
        <NetworkPlanner
          view={view}
          tasks={tasks.filter((task) => task.level >= 3)}
          timeline={timeline}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTaskId}
          onUpdateTask={updateTask}
          onOpenGraphEditor={openGraphEditor}
          onOpenContextMenu={openTaskContextMenu}
          taskPaneWidth={taskPaneWidth}
          onTaskPaneWidthChange={setTaskPaneWidth}
        />
      ) : (
        <DiagramPlanner
          view={view}
          tasks={tasks}
          visibleTasks={visibleTasks}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTaskId}
          onAddTask={addTask}
          onOpenGraphEditor={openGraphEditor}
          onOpenContextMenu={openTaskContextMenu}
        />
      )}
      <TaskContextMenu
        state={contextMenu}
        task={
          contextMenu
            ? (tasks.find((task) => task.id === contextMenu.taskId) ?? null)
            : null
        }
        canPasteTask={copiedTask !== null}
        canPasteStyle={copiedStyle !== null}
        onAddTask={addTask}
        onCopyTask={copyTask}
        onPasteTask={pasteTask}
        onDuplicateTask={duplicateTask}
        onCopyStyle={copyTaskStyle}
        onPasteStyle={pasteTaskStyle}
        onUpdateTask={updateTask}
        onUpdateStyle={updateTaskStyle}
        onChangeLevel={changeTaskLevel}
        onToggleLock={toggleTaskLock}
        onDeleteTask={deleteSelectedTask}
      />
      <ChartContextMenu
        state={chartMenu}
        onClose={() => setChartMenu(null)}
        onNew={(targetView) => createNewPlanningChart(targetView)}
        onSave={() => void savePlanningVersion()}
        onImport={() => importInputRef.current?.click()}
        onExport={(targetView) => {
          audit(`从图表菜单导出${viewLabels[targetView]}计划包`);
          void exportPlanningPackage("json");
        }}
        onSaveAs={savePlanningAsCopy}
        onPrint={printPlanningChart}
        onShare={sharePlanningChart}
        onSettings={openChartSettingsPanel}
      />
      <ChartSettingsPanel
        state={chartSettings}
        scale={scale}
        frontlineVisible={frontlineVisible}
        onScaleChange={setScale}
        onToggleFrontline={() => setFrontlineVisible((visible) => !visible)}
        onClose={() => setChartSettings(null)}
      />
      <GraphInlineEditor
        state={graphEdit}
        task={graphEditTask}
        onClose={() => setGraphEdit(null)}
        onUpdateTask={updateTask}
      />
    </section>
  );
}

function downloadPlanningExport(
  fileName: string,
  mimeType: string,
  content: string | Uint8Array | Blob,
) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob(
          [
            content instanceof Uint8Array
              ? uint8ArrayToArrayBuffer(content)
              : content,
          ],
          { type: mimeType },
        );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function uint8ArrayToArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

function sanitizePlanningFileStem(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return cleaned || "architoken-planning";
}

async function rasterizeSvgExport(
  svgContent: string,
  kind: PlanningRasterExportKind,
): Promise<Blob> {
  const width = Number(svgContent.match(/<svg[^>]*width="(\d+)"/)?.[1] ?? 1600);
  const height = Number(
    svgContent.match(/<svg[^>]*height="(\d+)"/)?.[1] ?? 900,
  );
  const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadSvgImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.min(width, 4096));
    canvas.height = Math.max(1, Math.min(height, 4096));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建计划导出画布。");
    if (kind === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("无法生成计划图像导出。"));
        },
        kind === "png" ? "image/png" : "image/jpeg",
        0.92,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法加载计划 SVG。"));
    image.src = url;
  });
}

function ScaleButtons({
  scale,
  onChange,
  compact = false,
}: {
  scale: ScheduleScale;
  onChange: (scale: ScheduleScale) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`feichuan-scale-group ${compact ? "is-compact" : ""}`}
      aria-label="时间缩放"
    >
      {(Object.keys(scaleLabels) as ScheduleScale[]).map((item) => (
        <button
          type="button"
          className={scale === item ? "is-active" : ""}
          key={item}
          onClick={() => onChange(item)}
        >
          {scaleLabels[item]}
        </button>
      ))}
    </div>
  );
}

function PlanningExportMenu({
  onSelect,
}: {
  onSelect: (kind: PlanningExportKind) => void;
}) {
  return (
    <div
      className="feichuan-export-menu"
      role="menu"
      aria-label="选择计划导出格式"
    >
      <strong>导出计划</strong>
      {exportOptions.map((option) => (
        <button
          key={option.kind}
          type="button"
          role="menuitem"
          onClick={() => onSelect(option.kind)}
        >
          <span>{option.label}</span>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  );
}

function ProjectContextMenu({
  state,
  currentPlanFile,
  currentPlanLocation,
  hasSavedDraft,
  onClose,
  onNew,
  onImportLocal,
  onImportExample,
  onImportRecent,
  onSave,
  onSaveAs,
  onExport,
  onShare,
  onRename,
  onDelete,
  onProperties,
}: {
  state: ProjectContextMenuState | null;
  currentPlanFile: PlanningProjectFileState | null;
  currentPlanLocation: string;
  hasSavedDraft: boolean;
  onClose: () => void;
  onNew: () => void;
  onImportLocal: () => void;
  onImportExample: () => void;
  onImportRecent: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: (kind: PlanningExportKind) => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  onProperties: () => void;
}) {
  if (!state) return null;
  const run = (action: () => void, close = true) => {
    action();
    if (close) onClose();
  };
  const quickExportOptions = exportOptions.slice(0, 3);

  return (
    <div
      className="feichuan-context-menu feichuan-project-menu"
      style={{ left: state.x, top: state.y }}
      role="menu"
      aria-label="计划项目右键菜单"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <strong>计划项目</strong>
      <small title={currentPlanLocation}>
        {currentPlanFile ? currentPlanLocation : "未保存到项目文件"}
      </small>
      <button type="button" role="menuitem" onClick={() => run(onNew)}>
        <span>新建计划</span>
        <kbd>Ctrl + N</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => run(onImportLocal)}>
        <span>导入本地计划</span>
        <kbd>Ctrl + O</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(onImportExample)}
      >
        <span>导入示例计划</span>
        <kbd>示例</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!hasSavedDraft}
        onClick={() => run(onImportRecent)}
      >
        <span>打开最近计划</span>
        <kbd>最近</kbd>
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run(onSave)}>
        <span>保存</span>
        <kbd>Ctrl + S</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => run(onSaveAs)}>
        <span>另存为</span>
        <kbd>Ctrl + Shift + S</kbd>
      </button>
      {quickExportOptions.map((option) => (
        <button
          key={option.kind}
          type="button"
          role="menuitem"
          onClick={() => run(() => onExport(option.kind))}
        >
          <span>导出 {option.label}</span>
          <kbd>导出</kbd>
        </button>
      ))}
      <button type="button" role="menuitem" onClick={() => run(onShare)}>
        <span>分享</span>
        <kbd>链接</kbd>
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run(onRename)}>
        <span>重命名</span>
        <kbd>F2</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(onProperties, false)}
      >
        <span>属性</span>
        <kbd>Alt + Enter</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="is-danger"
        onClick={() => run(onDelete)}
      >
        <span>删除</span>
        <kbd>Del</kbd>
      </button>
    </div>
  );
}

function ProjectPropertiesDialog({
  model,
  summary,
  view,
  currentPlanFile,
  currentPlanLocation,
  onClose,
}: {
  model: ProjectPlanningModel;
  summary: ReturnType<typeof derivePlanningSummary>;
  view: ScheduleView;
  currentPlanFile: PlanningProjectFileState | null;
  currentPlanLocation: string;
  onClose: () => void;
}) {
  const savedAt = currentPlanFile?.savedAt
    ? new Date(currentPlanFile.savedAt).toLocaleString("zh-CN", {
        hour12: false,
      })
    : "未保存";
  const fields = [
    ["项目名称", model.projectName],
    ["图表类型", viewLabels[view]],
    ["保存位置", currentPlanLocation],
    ["项目文件", currentPlanFile?.fileName ?? "未保存到项目文件"],
    ["最近保存", savedAt],
    ["任务数量", `${summary.taskCount} 项`],
    ["平均进度", `${summary.averageProgress}%`],
    ["延期任务", `${summary.delayedTaskCount} 项`],
    ["数据日期", model.dataDate],
    ["基线名称", model.baselineName],
  ];

  return (
    <div
      className="feichuan-project-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="feichuan-project-dialog feichuan-project-properties"
        role="dialog"
        aria-modal="true"
        aria-label="计划项目属性"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <strong>项目属性</strong>
            <span>{model.projectName}</span>
          </div>
          <Button size="small" onClick={onClose}>
            关闭
          </Button>
        </header>
        <dl>
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        <footer>
          <Button type="primary" onClick={onClose}>
            完成
          </Button>
        </footer>
      </section>
    </div>
  );
}

function NewPlanningProjectDialog({
  draft,
  folders,
  error,
  creating,
  onChange,
  onFolderContextAction,
  onCancel,
  onCreate,
}: {
  draft: NewPlanningProjectDraft;
  folders: PlanningSaveFolder[];
  error: string | null;
  creating: boolean;
  onChange: (draft: NewPlanningProjectDraft) => void;
  onFolderContextAction: (
    action: FileContextAction,
    folder: PlanningSaveFolder,
  ) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const [folderContextMenu, setFolderContextMenu] =
    useState<PlanningFolderContextMenuState | null>(null);
  const selectedFolder =
    folders.find((folder) => folder.id === draft.folderId) ??
    getDefaultPlanningSaveFolder(folders);
  const fileName = getPlanningProjectFileName(
    draft.name || "architoken-planning",
  );

  function patchDraft(patch: Partial<NewPlanningProjectDraft>) {
    onChange({ ...draft, ...patch });
  }

  function openFolderContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    folder: PlanningSaveFolder,
  ) {
    event.preventDefault();
    event.stopPropagation();
    patchDraft({ folderId: folder.id });
    setFolderContextMenu({
      x: event.clientX,
      y: event.clientY,
      folder,
    });
  }

  return (
    <div
      className="feichuan-project-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setFolderContextMenu(null);
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="feichuan-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="新建计划"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
      >
        <header>
          <div>
            <strong>新建计划</strong>
            <span>从数字档案选择项目文件夹，并指定要创建的计划图表。</span>
          </div>
          <Button size="small" onClick={onCancel}>
            关闭
          </Button>
        </header>
        <div className="feichuan-plan-create-layout">
          <section className="feichuan-plan-folder-picker">
            <strong>数字档案项目文件夹</strong>
            <div role="listbox" aria-label="数字档案项目文件夹">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  role="option"
                  aria-selected={folder.id === draft.folderId}
                  className={folder.id === draft.folderId ? "is-active" : ""}
                  onClick={() => patchDraft({ folderId: folder.id })}
                  onContextMenu={(event) =>
                    openFolderContextMenu(event, folder)
                  }
                  style={{ paddingLeft: 10 + (folder.depth ?? 0) * 14 }}
                >
                  <span>{folder.name}</span>
                  <small>{folder.label}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="feichuan-plan-create-main">
            <div className="feichuan-plan-create-target">
              <span>创建目录</span>
              <strong title={selectedFolder.label}>
                {selectedFolder.label}
              </strong>
            </div>
            <label className="feichuan-project-dialog-field">
              <span>计划名称</span>
              <input
                autoFocus
                value={draft.name}
                onChange={(event) => patchDraft({ name: event.target.value })}
              />
            </label>
            <div className="feichuan-project-dialog-grid">
              <label className="feichuan-project-dialog-field">
                <span>开始日期</span>
                <input
                  type="date"
                  value={draft.start}
                  onChange={(event) =>
                    patchDraft({ start: event.target.value })
                  }
                />
              </label>
              <label className="feichuan-project-dialog-field">
                <span>结束日期</span>
                <input
                  type="date"
                  value={draft.end}
                  onChange={(event) => patchDraft({ end: event.target.value })}
                />
              </label>
            </div>
            <div className="feichuan-plan-chart-picker">
              <strong>创建图表类型</strong>
              <div>
                {(Object.keys(viewLabels) as ScheduleView[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={draft.view === item ? "is-active" : ""}
                    aria-pressed={draft.view === item}
                    onClick={() => patchDraft({ view: item })}
                  >
                    {viewLabels[item]}
                  </button>
                ))}
              </div>
            </div>
            <div className="feichuan-project-save-preview">
              <span>将创建</span>
              <strong title={`${selectedFolder.label} / ${fileName}`}>
                {selectedFolder.label} / {fileName}
              </strong>
            </div>
          </section>
        </div>
        {error ? (
          <p className="feichuan-project-dialog-error">{error}</p>
        ) : null}
        <footer>
          <Button onClick={onCancel} disabled={creating}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" disabled={creating}>
            {creating ? <ArchLoadingFlow label="创建中" size="inline" /> : null}
            创建并保存
          </Button>
        </footer>
      </form>
      {folderContextMenu ? (
        <FileContextMenu
          node={folderContextMenu.folder.node ?? null}
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          actions={["open", "new", "properties"]}
          onAction={(action) => {
            const targetFolder = folderContextMenu.folder;
            setFolderContextMenu(null);
            onFolderContextAction(action, targetFolder);
          }}
          onClose={() => setFolderContextMenu(null)}
        />
      ) : null}
    </div>
  );
}

function PlanningLauncherPanel({
  folders,
  activeView,
  hasSavedDraft,
  onNewProject,
  onOpenExample,
  onOpenRecent,
  onSelectProject,
  onCreateChart,
  onClose,
}: {
  folders: PlanningSaveFolder[];
  activeView: ScheduleView;
  hasSavedDraft: boolean;
  onNewProject: () => void;
  onOpenExample: () => void;
  onOpenRecent: () => void;
  onSelectProject: (folder: PlanningSaveFolder) => void;
  onCreateChart: (view: ScheduleView) => void;
  onClose: () => void;
}) {
  const projectFolders = getPlanningLauncherProjectFolders(folders);
  const firstProjectFolder = projectFolders[0] ?? null;
  const chartViews = Object.keys(viewLabels) as ScheduleView[];

  return (
    <div
      className="feichuan-planning-launcher"
      role="dialog"
      aria-label="项目与图表启动器"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="feichuan-launcher-head">
        <div>
          <strong>项目与图表</strong>
          <span>打开项目上下文，或直接创建计划图表。</span>
        </div>
        <button
          type="button"
          aria-label="关闭项目与图表启动器"
          onClick={onClose}
        >
          关闭
        </button>
      </header>
      <section className="feichuan-launcher-section">
        <div className="feichuan-launcher-section-title">
          <strong>打开项目</strong>
          <span>新建、选择项目目录或打开已有计划。</span>
        </div>
        <div className="feichuan-launcher-action-grid">
          <button type="button" aria-label="新建项目" onClick={onNewProject}>
            <span className="feichuan-launcher-icon">
              <FileAddOutlined />
            </span>
            <strong>新建项目</strong>
            <small>创建并保存计划包</small>
          </button>
          <button
            type="button"
            aria-label="选择项目"
            disabled={!firstProjectFolder}
            onClick={() => {
              if (firstProjectFolder) onSelectProject(firstProjectFolder);
            }}
          >
            <span className="feichuan-launcher-icon">
              <FolderOpenOutlined />
            </span>
            <strong>选择项目</strong>
            <small>
              {firstProjectFolder ? firstProjectFolder.name : "暂无项目目录"}
            </small>
          </button>
          <button
            type="button"
            aria-label="打开最近草稿"
            disabled={!hasSavedDraft}
            onClick={onOpenRecent}
          >
            <span className="feichuan-launcher-icon">
              <ProjectOutlined />
            </span>
            <strong>打开最近</strong>
            <small>{hasSavedDraft ? "浏览器草稿" : "暂无本地草稿"}</small>
          </button>
          <button
            type="button"
            aria-label="打开示例计划"
            onClick={onOpenExample}
          >
            <span className="feichuan-launcher-icon">
              <AppstoreOutlined />
            </span>
            <strong>打开示例</strong>
            <small>内置柔佛项目集群</small>
          </button>
        </div>
        {projectFolders.length > 0 ? (
          <div className="feichuan-launcher-projects">
            {projectFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                aria-label={`选择项目 ${folder.name}`}
                onClick={() => onSelectProject(folder)}
              >
                <strong>{folder.name}</strong>
                <span>{folder.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
      <section className="feichuan-launcher-section">
        <div className="feichuan-launcher-section-title">
          <strong>创建图表</strong>
          <span>甘特图、流程图、思维导图和项目分析图。</span>
        </div>
        <div
          className="feichuan-launcher-chart-grid"
          role="menu"
          aria-label="新建图表类型"
        >
          {chartViews.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              className={activeView === item ? "is-active" : ""}
              onClick={() => onCreateChart(item)}
            >
              <span className="feichuan-launcher-icon">
                <BranchesOutlined />
              </span>
              <strong>新建{viewLabels[item]}</strong>
              <small>{getScheduleViewLauncherHint(item)}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function getScheduleViewLauncherHint(view: ScheduleView): string {
  if (view === "gantt") return "工期、进度与前锋线";
  if (isNetworkView(view)) return "逻辑关系与关键路径";
  if (view === "mindmap") return "层级拆解与头脑风暴";
  if (view === "flowchart") return "流程步骤与审批链";
  if (view === "resource-histogram") return "资源负荷与班组节拍";
  if (view === "risk-matrix") return "风险等级与处置";
  if (view === "raci") return "职责矩阵与责任人";
  return "项目图表编制";
}

function ChartTypeMenu({
  ariaLabel,
  actionLabel,
  align = "left",
  activeView,
  onSelect,
}: {
  ariaLabel: string;
  actionLabel: string;
  align?: "left" | "right";
  activeView?: ScheduleView | undefined;
  onSelect: (view: ScheduleView) => void;
}) {
  return (
    <div
      className={`feichuan-chart-type-menu is-${align}`}
      role="menu"
      aria-label={ariaLabel}
    >
      {(Object.keys(viewLabels) as ScheduleView[]).map((item) => (
        <button
          key={item}
          type="button"
          role="menuitem"
          className={activeView === item ? "is-active" : ""}
          onClick={() => onSelect(item)}
        >
          <span>
            {actionLabel}
            {viewLabels[item]}
          </span>
        </button>
      ))}
    </div>
  );
}

function PortfolioControlBoard({
  projects,
  summary,
  riskModel,
  integrationCapabilities,
  selectedProjectId,
  panelOpen,
  onTogglePanel,
  onClosePanel,
  onSelectProject,
  onRegisterDisposition,
  onRiskModelChange,
  onExportBoard,
  onExportMilestones,
}: {
  projects: readonly PlanningPortfolioProject[];
  summary: PlanningPortfolioSummary;
  riskModel: PlanningPortfolioRiskModel;
  integrationCapabilities: readonly PlanningIntegrationCapability[];
  selectedProjectId: string;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  onSelectProject: (projectId: string) => void;
  onRegisterDisposition: (projectId: string) => void;
  onRiskModelChange: (patch: Partial<PlanningPortfolioRiskModel>) => void;
  onExportBoard: () => void;
  onExportMilestones: () => void;
}) {
  return (
    <div
      className="feichuan-portfolio-board"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="feichuan-portfolio-summary">
        <Button
          size="small"
          aria-label="企业多项目进度看板"
          aria-expanded={panelOpen}
          aria-controls="feichuan-portfolio-panel"
          onClick={onTogglePanel}
        >
          企业看板
        </Button>
      </div>
      {panelOpen ? (
        <div
          id="feichuan-portfolio-panel"
          className="feichuan-portfolio-panel"
          role="dialog"
          aria-label="企业多项目进度看板明细"
        >
          <div className="feichuan-portfolio-panel-head">
            <strong>企业进度看板</strong>
            <span>项目 {summary.projectCount}</span>
            <span className={summary.highRiskCount > 0 ? "is-danger" : ""}>
              高风险 {summary.highRiskCount}
            </span>
            <span
              className={
                summary.pendingDispositionCount > 0 ? "is-warning" : ""
              }
            >
              待处置 {summary.pendingDispositionCount}
            </span>
            <span>里程碑 {summary.milestoneCompletionPercent}%</span>
            <span>
              总/月计划 {summary.totalPlanReadyCount}/
              {summary.monthlyPlanReadyCount}
            </span>
            <div>
              <Button size="small" onClick={onExportBoard}>
                进度看板导出
              </Button>
              <Button size="small" onClick={onExportMilestones}>
                项目里程碑导出
              </Button>
              <Button
                size="small"
                aria-label="关闭企业看板"
                onClick={onClosePanel}
              >
                关闭
              </Button>
            </div>
          </div>
          <div className="feichuan-portfolio-main">
            <div className="feichuan-portfolio-projects" role="list">
              {projects.map((project) => (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  className={`feichuan-portfolio-project is-${project.riskLevel} ${
                    selectedProjectId === project.id ? "is-active" : ""
                  }`}
                  aria-label={`项目总控 ${project.name}`}
                  onClick={() => onSelectProject(project.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectProject(project.id);
                    }
                  }}
                >
                  <div>
                    <strong>{project.name}</strong>
                    <small>
                      {project.org} · {project.stage} · {project.owner}
                    </small>
                  </div>
                  <span>{portfolioRiskLabels[project.riskLevel]}</span>
                  <span>
                    进度 {project.actualProgress}/{project.plannedProgress}%
                  </span>
                  <span>里程碑 {project.milestoneCompletionPercent}%</span>
                  <span>总计划 {project.totalPlanStatus}</span>
                  <span>月计划 {project.monthlyPlanStatus}</span>
                  <span>{project.approvalStatus}</span>
                  <span
                    className={
                      project.riskDisposition === "pending" ? "is-warning" : ""
                    }
                  >
                    {dispositionLabels[project.riskDisposition]}
                  </span>
                  {project.riskDisposition === "pending" ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRegisterDisposition(project.id);
                      }}
                    >
                      登记处置
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="feichuan-risk-model" aria-label="风险模型设置">
              <strong>风险模型</strong>
              <label>
                <span>进度预警</span>
                <input
                  aria-label="进度预警阈值"
                  type="number"
                  min={1}
                  max={100}
                  value={riskModel.progressWarningDelta}
                  onChange={(event) =>
                    onRiskModelChange({
                      progressWarningDelta: parsePortfolioRiskThreshold(
                        event.currentTarget.value,
                        riskModel.progressWarningDelta,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>进度高风险</span>
                <input
                  aria-label="进度高风险阈值"
                  type="number"
                  min={1}
                  max={100}
                  value={riskModel.progressHighDelta}
                  onChange={(event) =>
                    onRiskModelChange({
                      progressHighDelta: parsePortfolioRiskThreshold(
                        event.currentTarget.value,
                        riskModel.progressHighDelta,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>里程碑顺延</span>
                <input
                  aria-label="里程碑顺延阈值"
                  type="number"
                  min={1}
                  max={60}
                  value={riskModel.milestoneSlipWarningDays}
                  onChange={(event) =>
                    onRiskModelChange({
                      milestoneSlipWarningDays: parsePortfolioRiskThreshold(
                        event.currentTarget.value,
                        riskModel.milestoneSlipWarningDays,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>资源强度</span>
                <input
                  aria-label="资源高强度阈值"
                  type="number"
                  min={1}
                  max={200}
                  value={riskModel.resourceHighUtilizationPercent}
                  onChange={(event) =>
                    onRiskModelChange({
                      resourceHighUtilizationPercent:
                        parsePortfolioRiskThreshold(
                          event.currentTarget.value,
                          riskModel.resourceHighUtilizationPercent,
                        ),
                    })
                  }
                />
              </label>
              <small>{riskModel.notificationRoles.join(" / ")}</small>
            </div>
            <div
              className="feichuan-adapter-ledger"
              aria-label="计划资料接口适配台账"
            >
              <strong>计划资料接口</strong>
              {integrationCapabilities.map((item) => (
                <span key={item.id} className={`is-${item.status}`}>
                  <b>{item.label}</b>
                  {item.detail}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanningControlStrip({
  summary,
  analytics,
  earnedValue,
  resourceLoad,
  calendarMetrics,
  governance,
  signoff,
  zpertQuality,
  alertCount,
  highAlertCount,
  criticalPathLabel,
  coverageGapCount,
  dependencyWarnings,
  activeKey,
  onSelect,
}: {
  summary: ReturnType<typeof derivePlanningSummary>;
  analytics: ReturnType<typeof derivePlanningAnalytics>;
  earnedValue: ReturnType<typeof deriveEarnedValueMetrics>;
  resourceLoad: ReturnType<typeof deriveResourceLoadAnalysis>;
  calendarMetrics: ReturnType<typeof deriveWorkingCalendarMetrics>;
  governance: ReturnType<typeof deriveGovernanceEvidenceSummary>;
  signoff: ReturnType<typeof deriveProfessionalSignoffSummary>;
  zpertQuality: ZpertPlanningQuality;
  alertCount: number;
  highAlertCount: number;
  criticalPathLabel: string;
  coverageGapCount: number;
  dependencyWarnings: number;
  activeKey: PlanningControlKey;
  onSelect: (
    key: PlanningControlKey,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  const items: Array<{
    key: PlanningControlKey;
    label: string;
    value: string;
    tone: "success" | "warning" | "danger";
    wide?: boolean | undefined;
  }> = [
    {
      key: "spi",
      label: "进度绩效指数 SPI",
      value: String(analytics.schedulePerformanceIndex),
      tone:
        analytics.schedulePerformanceIndex < 0.9
          ? "danger"
          : analytics.schedulePerformanceIndex < 1
            ? "warning"
            : "success",
    },
    {
      key: "cpi",
      label: "费用绩效指数 CPI",
      value: String(earnedValue.costPerformanceIndex),
      tone:
        earnedValue.status === "red"
          ? "danger"
          : earnedValue.status === "amber"
            ? "warning"
            : "success",
    },
    {
      key: "planned",
      label: "计划完成百分比",
      value: `${summary.plannedProgress}%`,
      tone: "success",
    },
    {
      key: "actual",
      label: "实际完成百分比",
      value: `${summary.averageProgress}%`,
      tone:
        summary.averageProgress + 10 < summary.plannedProgress
          ? "danger"
          : summary.averageProgress < summary.plannedProgress
            ? "warning"
            : "success",
    },
    {
      key: "earned-value",
      label: "挣值分析 PV/EV",
      value: `${formatCompactMoney(earnedValue.plannedValue)} / ${formatCompactMoney(earnedValue.earnedValue)}`,
      tone:
        earnedValue.status === "red"
          ? "danger"
          : earnedValue.status === "amber"
            ? "warning"
            : "success",
    },
    {
      key: "quality-score",
      label: "进度计划质量",
      value: `${zpertQuality.score} ${zpertQuality.grade}`,
      tone:
        zpertQuality.score < 70
          ? "danger"
          : zpertQuality.score < 85
            ? "warning"
            : "success",
    },
    {
      key: "logic-integrity",
      label: "工作逻辑关系",
      value: `断链 ${zpertQuality.logicIssueCount}`,
      tone: zpertQuality.logicIssueCount > 0 ? "warning" : "success",
    },
    {
      key: "milestone-risk",
      label: "里程碑节点",
      value: `${zpertQuality.milestoneRiskCount} 项`,
      tone: zpertQuality.milestoneRiskCount > 0 ? "danger" : "success",
    },
    {
      key: "format-adapter",
      label: "计划资料接口",
      value: "JSON/CSV +3",
      tone: "success",
    },
    {
      key: "warnings",
      label: "进度预警",
      value: `${alertCount} 条`,
      tone: alertCount > 0 ? "warning" : "success",
    },
    {
      key: "risks",
      label: "重大风险源",
      value: `${highAlertCount} 条`,
      tone: highAlertCount > 0 ? "danger" : "success",
    },
    {
      key: "forecast",
      label: "预测工期",
      value: analytics.forecastFinish,
      tone: analytics.delayedTaskCount > 0 ? "warning" : "success",
    },
    {
      key: "resources",
      label: "资源强度",
      value: `${resourceLoad.peakResourceName} ${resourceLoad.peakUtilizationPercent}%`,
      tone: resourceLoad.overloadedBucketCount > 0 ? "warning" : "success",
    },
    {
      key: "calendar",
      label: "施工日历",
      value: `${calendarMetrics.workingDayCount} 工日`,
      tone: "success",
    },
    {
      key: "contract",
      label: "合同工期节点",
      value: `${governance.contractNodeCount} 个`,
      tone: governance.contractNodeCount > 0 ? "success" : "warning",
    },
    {
      key: "quality",
      label: "质量安全控制",
      value: `${governance.evidenceCompletenessPercent}%`,
      tone:
        governance.blockedSafetyPermitCount > 0
          ? "danger"
          : governance.evidenceCompletenessPercent < 80
            ? "warning"
            : "success",
    },
    {
      key: "change",
      label: "工程变更影响",
      value: `${governance.openChangeImpactDays} 天`,
      tone: governance.openChangeImpactDays > 0 ? "warning" : "success",
    },
    {
      key: "signoff",
      label: "审批签认闭合",
      value: `${signoff.signedCount}/${signoff.requiredCount}`,
      tone: signoff.pendingCount > 0 ? "warning" : "success",
    },
    {
      key: "standards",
      label: "规范符合性",
      value: `${coverageGapCount} 项`,
      tone: coverageGapCount > 0 ? "warning" : "success",
    },
    {
      key: "network",
      label: "网络计划校核",
      value: `${dependencyWarnings} 条`,
      tone: dependencyWarnings > 0 ? "warning" : "success",
    },
    {
      key: "critical-path",
      label: "关键线路",
      value: criticalPathLabel || "未识别",
      tone: criticalPathLabel ? "success" : "danger",
      wide: true,
    },
  ];
  const stripRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<
    Partial<Record<PlanningControlKey, HTMLButtonElement | null>>
  >({});

  useEffect(() => {
    const strip = stripRef.current;
    const chip = chipRefs.current[activeKey];
    if (!strip || !chip) return;

    const targetLeft =
      chip.offsetLeft + chip.offsetWidth / 2 - strip.clientWidth / 2;
    strip.scrollTo({
      left: clampNumber(
        targetLeft,
        0,
        Math.max(0, strip.scrollWidth - strip.clientWidth),
      ),
      behavior: "smooth",
    });
  }, [activeKey]);

  return (
    <div className="feichuan-control-row" aria-label="计划控制指标">
      <strong>项目控制</strong>
      <div ref={stripRef} className="feichuan-control-strip">
        {items.map((item) => (
          <button
            key={item.key}
            ref={(node) => {
              chipRefs.current[item.key] = node;
            }}
            type="button"
            className={`feichuan-control-chip ${activeKey === item.key ? "is-active" : ""} is-${item.tone} ${item.wide ? "is-wide" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={activeKey === item.key}
            onClick={(event) => onSelect(item.key, event)}
          >
            <b>{item.label}</b>
            {item.value}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanningControlDetail({
  state,
  summary,
  analytics,
  alerts,
  earnedValue,
  resourceLoad,
  calendarMetrics,
  governance,
  signoff,
  zpertQuality,
  coverage,
  criticalPathLabel,
  dependencyWarnings,
  onClose,
}: {
  state: PlanningControlDetailState | null;
  summary: ReturnType<typeof derivePlanningSummary>;
  analytics: ReturnType<typeof derivePlanningAnalytics>;
  alerts: ReturnType<typeof deriveScheduleAlerts>;
  earnedValue: ReturnType<typeof deriveEarnedValueMetrics>;
  resourceLoad: ReturnType<typeof deriveResourceLoadAnalysis>;
  calendarMetrics: ReturnType<typeof deriveWorkingCalendarMetrics>;
  governance: ReturnType<typeof deriveGovernanceEvidenceSummary>;
  signoff: ReturnType<typeof deriveProfessionalSignoffSummary>;
  zpertQuality: ZpertPlanningQuality;
  coverage: ReturnType<typeof derivePlanningStandardsCoverage>;
  criticalPathLabel: string;
  dependencyWarnings: number;
  onClose: () => void;
}) {
  const coverageGapCount = coverage.filter(
    (item) => item.status !== "covered",
  ).length;
  const highAlerts = alerts.filter(
    (alert) => alert.severity === "high" || alert.severity === "critical",
  ).length;
  const detail: Record<
    PlanningControlKey,
    { title: string; body: string; meta: string }
  > = {
    spi: {
      title: "进度绩效指数 SPI",
      body: `当前 SPI ${analytics.schedulePerformanceIndex}，用于判断实际进度相对计划进度的偏差。`,
      meta: `计划完成百分比 ${summary.plannedProgress}% · 实际完成百分比 ${summary.averageProgress}%`,
    },
    cpi: {
      title: "费用绩效指数 CPI",
      body: `当前 CPI ${earnedValue.costPerformanceIndex}，PV ${formatCompactMoney(earnedValue.plannedValue)} / EV ${formatCompactMoney(earnedValue.earnedValue)}。`,
      meta: `费用偏差 ${formatCompactMoney(earnedValue.costVariance)} · 成本绩效状态 ${earnedValue.status}`,
    },
    planned: {
      title: "计划完成百分比",
      body: `数据日期下计划完成百分比 ${summary.plannedProgress}%，用于对比实际进度和前锋线。`,
      meta: `任务 ${summary.taskCount} 项 · 延期 ${summary.delayedTaskCount} 项`,
    },
    actual: {
      title: "实际完成百分比",
      body: `现场反馈均值 ${summary.averageProgress}%，双击任务条或拖动手柄可在线回填。`,
      meta: `任务 ${summary.taskCount} 项 · 阻塞 ${summary.blockedTaskCount} 项 · 延期 ${summary.delayedTaskCount} 项`,
    },
    "earned-value": {
      title: "挣值分析",
      body: `PV/EV/AC 用于同步判断进度、成本和完工预测，不作为合规结论。`,
      meta: `PV ${formatCompactMoney(earnedValue.plannedValue)} · EV ${formatCompactMoney(earnedValue.earnedValue)} · AC ${formatCompactMoney(earnedValue.actualCost)}`,
    },
    "quality-score": {
      title: "进度计划质量",
      body: `当前内部评分 ${zpertQuality.score} 分，参考一表双图、工作逻辑关系、前锋线反馈和审批签认完整性计算。`,
      meta: zpertQuality.checks
        .map((check) => `${check.label}${check.ok ? "已满足" : "待补齐"}`)
        .join(" · "),
    },
    "logic-integrity": {
      title: "工作逻辑关系校核",
      body: `当前断链/异常逻辑 ${zpertQuality.logicIssueCount} 条，孤立工作 ${zpertQuality.danglingTaskCount} 项。`,
      meta:
        dependencyWarnings > 0
          ? "建议在双代号网络图或时标网络图中补齐紧前、紧后工作关系。"
          : "网络逻辑当前未发现断链提示。",
    },
    "milestone-risk": {
      title: "里程碑节点控制",
      body: `当前里程碑节点风险 ${zpertQuality.milestoneRiskCount} 项，结合关键线路、进度反馈和前锋线偏差预警。`,
      meta: `反馈覆盖 ${zpertQuality.feedbackCoveragePercent}% · 预测完成 ${analytics.forecastFinish}`,
    },
    "format-adapter": {
      title: "计划资料接口",
      body: "当前可直接导入 ArchIToken JSON 与 CSV/Excel 表格文本；MPP、P6、GZP 按适配器目标展示，未伪装为已解析专有格式。",
      meta: "导出支持 ArchIToken、CSV、XLSX、XML、Mermaid、GanttProject、FreeMind、XMind 等开放交换包。",
    },
    warnings: {
      title: "进度预警",
      body: `当前识别 ${alerts.length} 条预警，点击高风险、资源或标准指标可切换到对应来源。`,
      meta: alerts[0]?.message ?? "暂无需要立即处理的预警。",
    },
    risks: {
      title: "重大风险源",
      body: `重大风险源/严重预警 ${highAlerts} 条，优先检查关键线路、资源超载和审批签认阻塞。`,
      meta:
        alerts.find(
          (alert) => alert.severity === "high" || alert.severity === "critical",
        )?.message ?? "暂无高风险预警。",
    },
    forecast: {
      title: "预测工期",
      body: `当前预测完成日期 ${analytics.forecastFinish}，用于计划调整和合同工期节点复核。`,
      meta: `数据日期 ${analytics.dataDate} · 调整记录 ${analytics.adjustmentCount} 条`,
    },
    resources: {
      title: "资源强度与资源均衡",
      body: `峰值资源 ${resourceLoad.peakResourceName}，资源强度 ${resourceLoad.peakUtilizationPercent}%。`,
      meta: `超载桶 ${resourceLoad.overloadedBucketCount} 个 · 建议联动材料物流/生产制造排程。`,
    },
    calendar: {
      title: "施工日历",
      body: `当前计划窗口内工作日 ${calendarMetrics.workingDayCount} 天。`,
      meta: `非工作日 ${calendarMetrics.nonWorkingDayCount} 天 · 日历 ${calendarMetrics.calendarName}`,
    },
    contract: {
      title: "合同工期节点",
      body: `合同工期节点 ${governance.contractNodeCount} 个，用于和付款、验收、交付节点对齐。`,
      meta: `未闭合节点 ${governance.openContractNodeCount} 个`,
    },
    quality: {
      title: "质量安全控制",
      body: `质量安全控制证据完整度 ${governance.evidenceCompletenessPercent}%，不得直接替代专业签审。`,
      meta: `阻塞安全许可 ${governance.blockedSafetyPermitCount} 个`,
    },
    change: {
      title: "工程变更影响",
      body: `当前打开变更影响 ${governance.openChangeImpactDays} 天，需联动进度调整和审计记录。`,
      meta: `变更 ${governance.changeRequestCount} 项 · 已批 ${governance.approvedChangeRequestCount} 项`,
    },
    signoff: {
      title: "审批签认闭合",
      body: `专业签审 ${signoff.signedCount}/${signoff.requiredCount}，缺少签审时只能输出经验建议。`,
      meta: `待签 ${signoff.pendingCount} 项 · 退回 ${signoff.rejectedCount} 项`,
    },
    standards: {
      title: "规范符合性",
      body: `标准覆盖缺口 ${coverageGapCount} 项，需要绑定考试/PMBOK/IPMA/住建部课程知识点和企业制度。`,
      meta:
        coverage.find((item) => item.status !== "covered")?.requirement ??
        "标准覆盖已闭合。",
    },
    network: {
      title: "网络计划校核",
      body: `当前网络计划校核提示 ${dependencyWarnings} 条，用于排查断链、循环、不合理时距和自由时差异常。`,
      meta:
        dependencyWarnings > 0
          ? "建议检查紧前工作、紧后工作与关键线路。"
          : "网络逻辑当前未发现提示。",
    },
    "critical-path": {
      title: "关键线路",
      body: criticalPathLabel || "当前网络未识别关键线路。",
      meta: "关键线路工作变更会影响计算工期、总工期和前锋线判断。",
    },
  };
  if (!state) return null;

  const selected = detail[state.key];

  return (
    <div
      className="feichuan-control-detail-popup"
      style={{ left: state.x, top: state.y }}
      role="dialog"
      aria-label={`${selected.title}指标详情`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="feichuan-control-detail-head">
        <strong>{selected.title}</strong>
        <button type="button" aria-label="关闭指标详情" onClick={onClose}>
          ×
        </button>
      </div>
      <span>{selected.body}</span>
      <em>{selected.meta}</em>
    </div>
  );
}

function TaskGovernanceLedger({
  model,
  selectedTaskId,
  onUpdateSignoff,
}: {
  model: ProjectPlanningModel;
  selectedTaskId: string | null;
  onUpdateSignoff: (
    signoffId: string,
    status: ProjectPlanningModel["professionalSignoffs"][number]["status"],
  ) => void;
}) {
  if (!selectedTaskId) return null;

  const signoffs = model.professionalSignoffs.filter((item) =>
    item.linkedTaskIds.includes(selectedTaskId),
  );
  const qualityGates = model.qualityGates.filter((item) =>
    item.linkedTaskIds.includes(selectedTaskId),
  );
  const safetyPermits = model.safetyPermits.filter((item) =>
    item.linkedTaskIds.includes(selectedTaskId),
  );
  const procurementPackages = model.procurementPackages.filter((item) =>
    item.linkedTaskIds.includes(selectedTaskId),
  );
  const changeRequests = model.changeRequests.filter((item) =>
    item.linkedTaskIds.includes(selectedTaskId),
  );
  const selectedTask = model.tasks.find((task) => task.id === selectedTaskId);
  const totalEvidence = [
    ...signoffs.flatMap((item) => item.evidenceRefs),
    ...qualityGates.flatMap((item) => item.evidenceRefs),
    ...safetyPermits.flatMap((item) => item.evidenceRefs),
    ...procurementPackages.flatMap((item) => item.evidenceRefs),
    ...changeRequests.flatMap((item) => item.evidenceRefs),
  ].length;

  if (
    signoffs.length === 0 &&
    qualityGates.length === 0 &&
    safetyPermits.length === 0 &&
    procurementPackages.length === 0 &&
    changeRequests.length === 0
  ) {
    return null;
  }

  return (
    <div className="feichuan-evidence-ledger" aria-label="任务签审与证据闭合">
      <strong>签审/证据</strong>
      <span className="is-task">{selectedTask?.code ?? selectedTaskId}</span>
      <span>
        质量门{" "}
        {
          qualityGates.filter(
            (item) => item.status === "approved" || item.status === "closed",
          ).length
        }
        /{qualityGates.length}
      </span>
      <span>
        安全许可{" "}
        {
          safetyPermits.filter(
            (item) => item.status === "approved" || item.status === "closed",
          ).length
        }
        /{safetyPermits.length}
      </span>
      <span>采购包 {procurementPackages.length}</span>
      <span
        className={
          changeRequests.some(
            (item) =>
              !["approved", "rejected", "implemented"].includes(item.status),
          )
            ? "is-warning"
            : ""
        }
      >
        变更 {changeRequests.length}
      </span>
      <span>证据 {totalEvidence}</span>
      <div className="feichuan-signoff-list">
        {signoffs.slice(0, 4).map((item) => (
          <span
            key={item.id}
            className={`feichuan-signoff-pill is-${item.status}`}
          >
            <b>{getPlanningProfessionalRoleLabel(item.role)}</b>
            {item.status === "signed"
              ? "已签"
              : item.status === "rejected"
                ? "退回"
                : "待签"}
            {item.status !== "signed" ? (
              <button
                type="button"
                onClick={() => onUpdateSignoff(item.id, "signed")}
              >
                登记内部签审
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUpdateSignoff(item.id, "pending")}
              >
                重新复核
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function GanttPlanner({
  tasks,
  visibleTasks,
  timeline,
  dataDate,
  showFrontline,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onUpdateTask,
  onOpenGraphEditor,
  onOpenContextMenu,
  onOpenCanvasContextMenu,
  taskPaneWidth,
  onTaskPaneWidthChange,
}: {
  tasks: ScheduleTask[];
  visibleTasks: VisibleTask[];
  timeline: TimelineUnit[];
  dataDate: Date;
  showFrontline: boolean;
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (
    taskId: string,
    event: ReactMouseEvent<Element>,
    mode: GraphEditMode,
  ) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
  onOpenCanvasContextMenu: (event: ReactMouseEvent<Element>) => void;
  taskPaneWidth: number;
  onTaskPaneWidthChange: (width: number) => void;
}) {
  const layout = createGanttLayout(visibleTasks, timeline);
  const activeTask =
    visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0];
  const activeBar = layout.bars.find((bar) => bar.task.id === activeTask?.id);
  const activeTaskId = activeTask?.id;
  const activeBarTaskId = activeBar?.task.id;
  const activeBarX = activeBar?.x;
  const activeBarY = activeBar?.y;
  const activeBarWidth = activeBar?.width;
  const taskListRef = useRef<HTMLDivElement | null>(null);
  const taskRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const stageScrollRef = useRef<HTMLDivElement | null>(null);
  const handleStageContextMenu = (event: ReactMouseEvent<Element>) => {
    if ((event.target as HTMLElement).closest(".feichuan-task-bar")) return;
    onOpenCanvasContextMenu(event);
  };

  useEffect(() => {
    const row = activeTaskId ? taskRowRefs.current[activeTaskId] : null;
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeTaskId]);

  useEffect(() => {
    const scroller = stageScrollRef.current;
    if (
      !scroller ||
      !activeBarTaskId ||
      activeBarX === undefined ||
      activeBarY === undefined ||
      activeBarWidth === undefined
    ) {
      return;
    }

    const targetLeft =
      activeBarX + activeBarWidth / 2 - scroller.clientWidth / 2;
    const targetTop =
      activeBarY + taskRowHeight / 2 - scroller.clientHeight / 2;
    scroller.scrollTo({
      left: clampNumber(
        targetLeft,
        0,
        Math.max(0, scroller.scrollWidth - scroller.clientWidth),
      ),
      top: clampNumber(
        targetTop,
        0,
        Math.max(0, scroller.scrollHeight - scroller.clientHeight),
      ),
      behavior: "smooth",
    });
  }, [activeBarTaskId, activeBarX, activeBarWidth, activeBarY]);

  return (
    <div
      className="feichuan-gantt"
      style={{ gridTemplateColumns: `${taskPaneWidth}px 7px minmax(0, 1fr)` }}
    >
      <aside className="feichuan-task-pane">
        <div className="feichuan-task-header">
          <span>任务名称</span>
          <span>工期</span>
          <span>进度</span>
        </div>
        <div
          ref={taskListRef}
          className="feichuan-task-list"
          style={hiddenStageScrollStyle}
        >
          {visibleTasks.map((task) => {
            const hasChildren = tasks.some((item) => item.parentId === task.id);
            return (
              <button
                type="button"
                key={task.id}
                ref={(node) => {
                  taskRowRefs.current[task.id] = node;
                }}
                title={`${task.name} | ${task.start} - ${task.end} | ${statusLabels[task.status]} ${task.progress}%`}
                className={`feichuan-task-row is-${task.status} ${task.id === selectedTaskId ? "is-selected" : ""} ${task.locked ? "is-locked" : ""}`}
                onClick={() => onSelectTask(task.id)}
                onContextMenu={(event) => onOpenContextMenu(task.id, event)}
                onDoubleClick={(event) =>
                  onOpenGraphEditor(task.id, event, "task")
                }
              >
                <span
                  className="feichuan-task-name-cell"
                  style={{ paddingLeft: 18 + (task.level - 1) * 16 }}
                >
                  {hasChildren ? (
                    <DownOutlined
                      className={task.expanded === false ? "is-collapsed" : ""}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleTask(task.id);
                      }}
                    />
                  ) : (
                    <i />
                  )}
                  <span className="feichuan-task-name">{task.name}</span>
                </span>
                <span>{task.duration}</span>
                <span className={task.progress >= 100 ? "is-complete" : ""}>
                  {task.progress}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <TaskPaneResizeHandle
        width={taskPaneWidth}
        onChange={onTaskPaneWidthChange}
      />

      <section
        className="feichuan-stage"
        onContextMenu={handleStageContextMenu}
      >
        <TimelineHeader timeline={timeline} />
        <div
          ref={stageScrollRef}
          className="feichuan-stage-scroll"
          style={hiddenStageScrollStyle}
          onWheel={handleFeichuanStageWheel}
          onContextMenu={handleStageContextMenu}
        >
          <div
            className="feichuan-stage-inner"
            style={{ width: layout.width, height: layout.height }}
            onContextMenu={handleStageContextMenu}
          >
            <TimelineGrid timeline={timeline} height={layout.height} />
            <svg
              className="feichuan-link-layer"
              width={layout.width}
              height={layout.height}
            >
              <defs>
                <marker
                  id="feichuan-gantt-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="#8a8f99" />
                </marker>
              </defs>
              {layout.links.map((link) => (
                <path
                  key={link.id}
                  d={link.d}
                  fill="none"
                  stroke="#8b8f96"
                  strokeWidth={1.4}
                  markerEnd="url(#feichuan-gantt-arrow)"
                />
              ))}
            </svg>
            {showFrontline ? (
              <>
                <LineMarker
                  date={dataDate}
                  timeline={timeline}
                  className="is-data"
                  label={`前锋线 ${formatDate(dataDate)}`}
                />
                <ForelineDeviationLayer
                  bars={layout.bars}
                  dataDate={dataDate}
                  timeline={timeline}
                />
              </>
            ) : null}
            <LineMarker
              date={todayDate}
              timeline={timeline}
              className="is-today"
              label="今天"
            />
            {layout.bars.map((bar) => {
              const barStyle = createTaskBarStyle(bar.task, {
                left: bar.x,
                width: bar.width,
              });

              return (
                <div
                  key={bar.task.id}
                  className={`feichuan-bar-row ${bar.task.id === activeTask?.id ? "is-active" : ""}`}
                  style={{ top: bar.y }}
                >
                  <button
                    type="button"
                    className={`feichuan-task-bar is-${bar.task.status} ${bar.task.critical ? "is-critical" : ""} ${bar.task.locked ? "is-locked" : ""}`}
                    style={barStyle}
                    aria-label={`拖动调整任务条：${bar.task.name}`}
                    onClick={() => onSelectTask(bar.task.id)}
                    onContextMenu={(event) =>
                      onOpenContextMenu(bar.task.id, event)
                    }
                    onPointerDown={(event) =>
                      handleTimelineBarPointerDown({
                        event,
                        task: bar.task,
                        x: bar.x,
                        width: bar.width,
                        timeline,
                        mode: "move",
                        onSelectTask,
                        onUpdateTask,
                      })
                    }
                    onDoubleClick={(event) =>
                      onOpenGraphEditor(bar.task.id, event, "task")
                    }
                  >
                    <span
                      className="feichuan-bar-edge is-start"
                      aria-hidden="true"
                      onPointerDown={(event) =>
                        handleTimelineBarPointerDown({
                          event,
                          task: bar.task,
                          x: bar.x,
                          width: bar.width,
                          timeline,
                          mode: "resize-start",
                          onSelectTask,
                          onUpdateTask,
                        })
                      }
                    />
                    <span className="feichuan-bar-progress" />
                    <span
                      className="feichuan-bar-handle"
                      onPointerDown={(event) =>
                        handleTimelineBarPointerDown({
                          event,
                          task: bar.task,
                          x: bar.x,
                          width: bar.width,
                          timeline,
                          mode: "progress",
                          onSelectTask,
                          onUpdateTask,
                        })
                      }
                    />
                    <span className="feichuan-bar-hatch" />
                    <strong>{bar.task.progress}%</strong>
                    <em>
                      预计任务工期
                      {bar.task.status === "ahead" ? "提前" : "延后"}七天
                    </em>
                    <span
                      className="feichuan-bar-edge is-end"
                      aria-hidden="true"
                      onPointerDown={(event) =>
                        handleTimelineBarPointerDown({
                          event,
                          task: bar.task,
                          x: bar.x,
                          width: bar.width,
                          timeline,
                          mode: "resize-end",
                          onSelectTask,
                          onUpdateTask,
                        })
                      }
                    />
                    <span className="feichuan-tooltip">
                      <b>{bar.task.name}</b>
                      <small>开始日期: {bar.task.start}</small>
                      <small>预计完成: {bar.task.end}</small>
                      <small>任务时长: {bar.task.duration}天</small>
                      <small>进度: {bar.task.progress}%</small>
                      <small>总浮时: {bar.task.totalFloat ?? 0}天</small>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function NetworkPlanner({
  view,
  tasks,
  timeline,
  selectedTask,
  onSelectTask,
  onUpdateTask,
  onOpenGraphEditor,
  onOpenContextMenu,
  taskPaneWidth,
  onTaskPaneWidthChange,
}: {
  view: NetworkView;
  tasks: ScheduleTask[];
  timeline: TimelineUnit[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (
    taskId: string,
    event: ReactMouseEvent<Element>,
    mode: GraphEditMode,
  ) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
  taskPaneWidth: number;
  onTaskPaneWidthChange: (width: number) => void;
}) {
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodeOffset>>(
    {},
  );
  const baseLayout = createNetworkLayout(tasks, timeline, view);
  const layout = applyNetworkNodeOffsets(baseLayout, nodeOffsets, view);

  function updateNodeOffset(taskId: string, offset: NodeOffset) {
    setNodeOffsets((current) => ({ ...current, [taskId]: offset }));
  }

  return (
    <div
      className="feichuan-network"
      style={{ gridTemplateColumns: `${taskPaneWidth}px 7px minmax(0, 1fr)` }}
    >
      <aside className="feichuan-task-pane">
        <div className="feichuan-task-header">
          <span>任务名称</span>
          <span>工期</span>
          <span>进度</span>
        </div>
        <div className="feichuan-task-list" style={hiddenStageScrollStyle}>
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className={`feichuan-task-row is-${task.status} ${selectedTask?.id === task.id ? "is-selected" : ""} ${task.locked ? "is-locked" : ""}`}
              title={`${task.name} | ${task.start} - ${task.end} | ${task.progress}%`}
              onClick={() => onSelectTask(task.id)}
              onContextMenu={(event) => onOpenContextMenu(task.id, event)}
              onDoubleClick={(event) =>
                onOpenGraphEditor(task.id, event, "task")
              }
            >
              <span className="feichuan-task-name-cell">
                <span className="feichuan-task-name">{task.name}</span>
              </span>
              <span>{task.duration}</span>
              <span>{task.progress}</span>
            </button>
          ))}
        </div>
      </aside>
      <TaskPaneResizeHandle
        width={taskPaneWidth}
        onChange={onTaskPaneWidthChange}
      />
      <section className="feichuan-network-stage">
        <TimelineHeader timeline={timeline} />
        <div
          className="feichuan-stage-scroll"
          style={hiddenStageScrollStyle}
          onWheel={handleFeichuanStageWheel}
        >
          <div
            className="feichuan-stage-inner"
            style={{ width: layout.width, height: layout.height }}
          >
            <TimelineGrid timeline={timeline} height={layout.height} />
            <svg
              width={layout.width}
              height={layout.height}
              className="feichuan-network-svg"
            >
              <defs>
                <pattern
                  id="feichuan-hatch"
                  width="14"
                  height="14"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(35)"
                >
                  <rect width="7" height="14" fill="rgba(226,232,240,0.8)" />
                </pattern>
                <marker
                  id="feichuan-network-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="#858b92" />
                </marker>
              </defs>
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.d}
                  className={`is-${edge.connector}`}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={1.5}
                  markerEnd="url(#feichuan-network-arrow)"
                />
              ))}
              {layout.nodes.map((node, index) => {
                const hitbox = networkNodeHitbox(node, view);
                return (
                  <g
                    key={node.task.id}
                    className={`feichuan-network-node ${selectedTask?.id === node.task.id ? "is-active" : ""} ${node.task.critical ? "is-critical" : ""}`}
                    onClick={() => onSelectTask(node.task.id)}
                    onContextMenu={(event) =>
                      onOpenContextMenu(node.task.id, event)
                    }
                    onDoubleClick={(event) =>
                      onOpenGraphEditor(node.task.id, event, "task")
                    }
                    onPointerDown={(event) => {
                      if (view === "time-network") return;
                      handleCanvasNodePointerDown({
                        event,
                        taskId: node.task.id,
                        locked: node.task.locked,
                        currentOffset: nodeOffsets[node.task.id] ?? {
                          x: 0,
                          y: 0,
                        },
                        onSelectTask,
                        onOffsetChange: updateNodeOffset,
                      });
                    }}
                  >
                    {view === "time-network" ? (
                      <TimeNetworkNode
                        node={node}
                        timeline={timeline}
                        onSelectTask={onSelectTask}
                        onUpdateTask={onUpdateTask}
                        onOpenGraphEditor={onOpenGraphEditor}
                        onOpenContextMenu={onOpenContextMenu}
                      />
                    ) : view === "adm" ? (
                      <AdmNode node={node} index={index} />
                    ) : (
                      <PertNode node={node} index={index} />
                    )}
                    {view !== "time-network" ? (
                      <rect
                        className="feichuan-network-hitbox"
                        x={hitbox.x}
                        y={hitbox.y}
                        width={hitbox.width}
                        height={hitbox.height}
                        rx={6}
                        fill="transparent"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectTask(node.task.id);
                        }}
                        onContextMenu={(event) =>
                          onOpenContextMenu(node.task.id, event)
                        }
                        onDoubleClick={(event) =>
                          onOpenGraphEditor(node.task.id, event, "task")
                        }
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {view === "pert" ? (
              <div className="feichuan-pert-legend">
                <div>
                  <span>
                    最早开始时间
                    <br />
                    (ES)
                  </span>
                  <span>工期 (DU)</span>
                  <span>
                    最早完成时间
                    <br />
                    (EF)
                  </span>
                </div>
                <strong>活动名称</strong>
                <div>
                  <span>
                    最迟开始时间
                    <br />
                    (LS)
                  </span>
                  <span>
                    总浮动时间
                    <br />
                    (TF)
                  </span>
                  <span>
                    最迟完成时间
                    <br />
                    (LF)
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function TaskPaneResizeHandle({
  width,
  onChange,
}: {
  width: number;
  onChange: (width: number) => void;
}) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function applyWidth(nextWidth: number) {
    onChange(
      clampNumber(Math.round(nextWidth), minTaskPaneWidth, maxTaskPaneWidth),
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    dragRef.current = { startX: event.clientX, startWidth: width };
    element.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      applyWidth(drag.startWidth + moveEvent.clientX - drag.startX);
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyWidth(width - (event.shiftKey ? 40 : 16));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      applyWidth(width + (event.shiftKey ? 40 : 16));
    }
    if (event.key === "Home") {
      event.preventDefault();
      applyWidth(minTaskPaneWidth);
    }
    if (event.key === "End") {
      event.preventDefault();
      applyWidth(maxTaskPaneWidth);
    }
  }

  return (
    <div
      className="feichuan-task-pane-resizer"
      role="separator"
      aria-label="调整任务表列宽"
      aria-orientation="vertical"
      aria-valuemin={minTaskPaneWidth}
      aria-valuemax={maxTaskPaneWidth}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
}

function InlineTaskEditor({
  task,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onAdjustTask,
}: {
  task: ScheduleTask | null;
  onAddTask: (mode?: AddTaskMode) => void;
  onDeleteTask: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onAdjustTask: (shiftDays: number) => void;
}) {
  if (!task) return null;

  return (
    <div className="feichuan-inline-editor">
      <strong>当前任务</strong>
      <span className="feichuan-inline-task-code">{task.code}</span>
      <input
        aria-label="编辑任务名称"
        value={task.name}
        onChange={(event) =>
          onUpdateTask(task.id, { name: event.target.value })
        }
      />
      <input
        aria-label="编辑开始日期"
        value={task.start}
        onChange={(event) =>
          onUpdateTask(task.id, { start: event.target.value })
        }
      />
      <input
        aria-label="编辑完成日期"
        value={task.end}
        onChange={(event) => onUpdateTask(task.id, { end: event.target.value })}
      />
      <label>
        <span>进度</span>
        <input
          aria-label="编辑进度百分比"
          type="text"
          inputMode="numeric"
          value={task.progress}
          onChange={(event) => {
            const nextValue = event.target.value.replace(/[^\d]/g, "");
            onUpdateTask(task.id, {
              progress: clampNumber(Math.round(Number(nextValue || 0)), 0, 100),
            });
          }}
        />
        <em>%</em>
      </label>
      <select
        aria-label="编辑任务状态"
        value={task.status}
        onChange={(event) =>
          onUpdateTask(task.id, {
            status: event.target.value as ScheduleStatus,
          })
        }
      >
        {(Object.keys(statusLabels) as ScheduleStatus[]).map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onAddTask("child")}>
        子任务
      </button>
      <button type="button" onClick={() => onAddTask("after")}>
        后续
      </button>
      <button type="button" onClick={() => onAdjustTask(-1)}>
        赶工1天
      </button>
      <button type="button" onClick={() => onAdjustTask(1)}>
        顺延1天
      </button>
      <button
        type="button"
        disabled={task.parentId === null}
        onClick={onDeleteTask}
      >
        删除
      </button>
    </div>
  );
}

function GraphInlineEditor({
  state,
  task,
  onClose,
  onUpdateTask,
}: {
  state: GraphEditState | null;
  task: ScheduleTask | null;
  onClose: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
}) {
  if (!state || !task) return null;

  const title = state.mode === "progress" ? "图上编辑进度" : "图上编辑任务";

  return (
    <div
      className={`feichuan-graph-editor is-${state.mode}`}
      style={{ left: state.x, top: state.y }}
      role="dialog"
      aria-label={`${title}浮层`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="feichuan-graph-editor-head">
        <strong>{title}</strong>
        <button type="button" aria-label="关闭图上编辑" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        <span>任务名称</span>
        <input
          aria-label="图上编辑任务名称"
          value={task.name}
          autoFocus={state.mode === "task"}
          onChange={(event) =>
            onUpdateTask(task.id, { name: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
      </label>
      <label>
        <span>描述</span>
        <textarea
          aria-label="图上编辑任务描述"
          value={task.description ?? ""}
          rows={3}
          onChange={(event) =>
            onUpdateTask(task.id, { description: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
      </label>
      <div className="feichuan-graph-editor-grid">
        <label>
          <span>开始</span>
          <input
            type="date"
            aria-label="图上编辑开始日期"
            value={task.start}
            onChange={(event) =>
              onUpdateTask(task.id, { start: event.target.value })
            }
          />
        </label>
        <label>
          <span>完成</span>
          <input
            type="date"
            aria-label="图上编辑完成日期"
            value={task.end}
            onChange={(event) =>
              onUpdateTask(task.id, { end: event.target.value })
            }
          />
        </label>
      </div>
      <div className="feichuan-graph-editor-grid">
        <label className="is-primary">
          <span>进度百分比</span>
          <input
            type="number"
            min={0}
            max={100}
            aria-label="图上编辑进度"
            value={task.progress}
            autoFocus={state.mode === "progress"}
            onChange={(event) =>
              onUpdateTask(task.id, {
                progress: clampNumber(
                  Math.round(Number(event.target.value)),
                  0,
                  100,
                ),
              })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") onClose();
            }}
          />
        </label>
        <label>
          <span>状态</span>
          <select
            aria-label="图上编辑状态"
            value={task.status}
            onChange={(event) =>
              onUpdateTask(task.id, {
                status: event.target.value as ScheduleStatus,
              })
            }
          >
            {(Object.keys(statusLabels) as ScheduleStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="feichuan-graph-editor-actions">
        <button type="button" onClick={onClose}>
          完成
        </button>
      </div>
    </div>
  );
}

function ChartContextMenu({
  state,
  onClose,
  onNew,
  onSave,
  onImport,
  onExport,
  onSaveAs,
  onPrint,
  onShare,
  onSettings,
}: {
  state: ChartContextMenuState | null;
  onClose: () => void;
  onNew: (view: ScheduleView) => void;
  onSave: () => void;
  onImport: () => void;
  onExport: (view: ScheduleView) => void;
  onSaveAs: (view: ScheduleView) => void;
  onPrint: (view: ScheduleView) => void;
  onShare: (view: ScheduleView) => void;
  onSettings: (view: ScheduleView) => void;
}) {
  if (!state) return null;
  const label = viewLabels[state.view];
  const run = (action: () => void, close = true) => {
    action();
    if (close) onClose();
  };

  return (
    <div
      className="feichuan-context-menu feichuan-chart-menu"
      style={{ left: state.x, top: state.y }}
      role="menu"
      aria-label="图表右键菜单"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <strong>{label} · 图表操作</strong>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => onNew(state.view))}
      >
        <span>新建{label}</span>
        <kbd>Ctrl + N</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => run(onSave)}>
        <span>保存</span>
        <kbd>Ctrl + S</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => run(onImport)}>
        <span>导入</span>
        <kbd>Ctrl + O</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => onExport(state.view))}
      >
        <span>导出</span>
        <kbd>Ctrl + E</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => onSaveAs(state.view))}
      >
        <span>另存为</span>
        <kbd>Ctrl + Shift + S</kbd>
      </button>
      <hr />
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => onPrint(state.view))}
      >
        <span>打印</span>
        <kbd>Ctrl + P</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => onShare(state.view))}
      >
        <span>分享</span>
        <kbd>链接</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => onSettings(state.view), false)}
      >
        <span>设置</span>
        <kbd>视图</kbd>
      </button>
    </div>
  );
}

function ChartSettingsPanel({
  state,
  scale,
  frontlineVisible,
  onScaleChange,
  onToggleFrontline,
  onClose,
}: {
  state: ChartContextMenuState | null;
  scale: ScheduleScale;
  frontlineVisible: boolean;
  onScaleChange: (scale: ScheduleScale) => void;
  onToggleFrontline: () => void;
  onClose: () => void;
}) {
  if (!state) return null;

  return (
    <div
      className="feichuan-chart-settings"
      style={{ left: state.x, top: state.y }}
      role="dialog"
      aria-label="图表设置"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="feichuan-chart-settings-head">
        <strong>{viewLabels[state.view]}设置</strong>
        <button type="button" aria-label="关闭图表设置" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        <span>时间尺度</span>
        <ScaleButtons scale={scale} onChange={onScaleChange} compact />
      </label>
      <label>
        <span>前锋线</span>
        <button
          type="button"
          className={frontlineVisible ? "is-active" : ""}
          onClick={onToggleFrontline}
        >
          {frontlineVisible ? "显示" : "隐藏"}
        </button>
      </label>
      <p>设置作用于当前计划工作台，不改变全局模块目录。</p>
    </div>
  );
}

function TaskContextMenu({
  state,
  task,
  canPasteTask,
  canPasteStyle,
  onAddTask,
  onCopyTask,
  onPasteTask,
  onDuplicateTask,
  onCopyStyle,
  onPasteStyle,
  onUpdateTask,
  onUpdateStyle,
  onChangeLevel,
  onToggleLock,
  onDeleteTask,
}: {
  state: TaskContextMenuState | null;
  task: ScheduleTask | null;
  canPasteTask: boolean;
  canPasteStyle: boolean;
  onAddTask: (mode?: AddTaskMode, baseTaskId?: string) => void;
  onCopyTask: (taskId: string) => void;
  onPasteTask: (targetTaskId?: string) => void;
  onDuplicateTask: (taskId?: string) => void;
  onCopyStyle: (taskId: string) => void;
  onPasteStyle: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onUpdateStyle: (taskId: string, patch: Partial<TaskDiagramStyle>) => void;
  onChangeLevel: (taskId: string, direction: "promote" | "demote") => void;
  onToggleLock: (taskId: string) => void;
  onDeleteTask: (taskId?: string) => void;
}) {
  if (!state || !task) return null;
  const style = resolveTaskDiagramStyle(task);
  const disabled = task.locked;
  const menuTop =
    typeof window === "undefined"
      ? state.y
      : clampNumber(state.y, 8, Math.max(8, window.innerHeight - 628));
  const menuMaxHeight =
    typeof window === "undefined"
      ? undefined
      : Math.max(320, window.innerHeight - menuTop - 8);
  const run = (action: () => void) => {
    action();
  };

  return (
    <div
      className="feichuan-context-menu"
      style={{ left: state.x, top: menuTop, maxHeight: menuMaxHeight }}
      role="menu"
      aria-label="计划节点右键菜单"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => run(() => onAddTask("after", task.id))}
      >
        <span>添加同级节点</span>
        <kbd>Enter</kbd>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => run(() => onAddTask("child", task.id))}
      >
        <span>添加子节点</span>
        <kbd>Tab</kbd>
      </button>
      <button
        type="button"
        disabled={disabled || task.parentId === null}
        onClick={() => run(() => onAddTask("parent", task.id))}
      >
        <span>添加父节点</span>
        <kbd>Shift + Tab</kbd>
      </button>
      <hr />
      <button type="button" onClick={() => run(() => onCopyTask(task.id))}>
        <span>复制</span>
        <kbd>Ctrl + C</kbd>
      </button>
      <button
        type="button"
        disabled={!canPasteTask || disabled}
        onClick={() => run(() => onPasteTask(task.id))}
      >
        <span>粘贴</span>
        <kbd>Ctrl + V</kbd>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => run(() => onDuplicateTask(task.id))}
      >
        <span>创建副本</span>
        <kbd>Ctrl + D</kbd>
      </button>
      <hr />
      <div className="feichuan-context-level">
        <span>层级</span>
        <button
          type="button"
          disabled={disabled || task.parentId === null}
          onClick={() => onChangeLevel(task.id, "promote")}
        >
          提升
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChangeLevel(task.id, "demote")}
        >
          降低
        </button>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => run(() => onCopyStyle(task.id))}
      >
        <span>复制样式</span>
        <kbd>Ctrl + Alt + C</kbd>
      </button>
      <button
        type="button"
        disabled={!canPasteStyle || disabled}
        onClick={() => run(() => onPasteStyle(task.id))}
      >
        <span>粘贴样式</span>
        <kbd>Ctrl + Alt + V</kbd>
      </button>
      <div className="feichuan-context-actions">
        <button type="button" onClick={() => run(() => onToggleLock(task.id))}>
          <span>{task.locked ? "解锁" : "锁定"}</span>
          <kbd>Ctrl + Alt + L</kbd>
        </button>
        <button
          type="button"
          disabled={disabled || task.parentId === null}
          className="is-danger"
          onClick={() => run(() => onDeleteTask(task.id))}
        >
          <span>删除</span>
          <kbd>⌫</kbd>
        </button>
      </div>
      <div className="feichuan-context-style">
        <label>
          图框
          <select
            value={style.frame}
            disabled={disabled}
            onChange={(event) =>
              onUpdateStyle(task.id, {
                frame: event.target.value as DiagramFrameStyle,
              })
            }
          >
            {(Object.keys(frameLabels) as DiagramFrameStyle[]).map((frame) => (
              <option key={frame} value={frame}>
                {frameLabels[frame]}
              </option>
            ))}
          </select>
        </label>
        <label>
          字号
          <select
            value={style.fontSize}
            disabled={disabled}
            onChange={(event) =>
              onUpdateStyle(task.id, { fontSize: Number(event.target.value) })
            }
          >
            {[10, 12, 14, 16, 18].map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>
        <label>
          连线
          <select
            value={style.connector}
            disabled={disabled}
            onChange={(event) =>
              onUpdateStyle(task.id, {
                connector: event.target.value as DiagramConnectorStyle,
              })
            }
          >
            {(Object.keys(connectorLabels) as DiagramConnectorStyle[]).map(
              (connector) => (
                <option key={connector} value={connector}>
                  {connectorLabels[connector]}
                </option>
              ),
            )}
          </select>
        </label>
        <span>颜色</span>
        <div className="feichuan-context-swatches">
          {colorOptions.map((color) => (
            <button
              key={color.accent}
              type="button"
              aria-label={`设置颜色为${color.label}`}
              disabled={disabled}
              className={style.accent === color.accent ? "is-active" : ""}
              style={{ background: color.accent }}
              onClick={() =>
                onUpdateStyle(task.id, {
                  accent: color.accent,
                  fill: color.fill,
                })
              }
            />
          ))}
        </div>
        <label className="is-description">
          描述
          <textarea
            value={task.description ?? ""}
            disabled={disabled}
            rows={3}
            onChange={(event) =>
              onUpdateTask(task.id, { description: event.target.value })
            }
          />
        </label>
      </div>
    </div>
  );
}

function DiagramPlanner({
  view,
  tasks,
  visibleTasks,
  selectedTask,
  onSelectTask,
  onAddTask,
  onOpenGraphEditor,
  onOpenContextMenu,
}: {
  view: DiagramView;
  tasks: ScheduleTask[];
  visibleTasks: VisibleTask[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onAddTask: (mode?: AddTaskMode) => void;
  onOpenGraphEditor: (
    taskId: string,
    event: ReactMouseEvent<Element>,
    mode: GraphEditMode,
  ) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
}) {
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodeOffset>>(
    {},
  );
  const baseLayout = createDiagramLayout(visibleTasks, view);
  const layout = applyDiagramNodeOffsets(baseLayout, nodeOffsets, view);

  function updateNodeOffset(taskId: string, offset: NodeOffset) {
    setNodeOffsets((current) => ({ ...current, [taskId]: offset }));
  }

  return (
    <div className="feichuan-diagram-workspace feichuan-diagram">
      <section className="feichuan-diagram-stage">
        <div className="feichuan-diagram-toolbar">
          <strong>{viewLabels[view]}在线编制画布</strong>
          <span>节点 {tasks.length}</span>
          <button type="button" onClick={() => onAddTask("child")}>
            新增节点
          </button>
          <button type="button" onClick={() => onAddTask("after")}>
            新增同级
          </button>
        </div>
        <div
          className="feichuan-stage-scroll"
          style={hiddenStageScrollStyle}
          onWheel={handleFeichuanStageWheel}
        >
          <svg
            className="feichuan-diagram-svg"
            width={layout.width}
            height={layout.height}
          >
            <defs>
              <marker
                id={`feichuan-diagram-arrow-${view}`}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#8a8f99" />
              </marker>
            </defs>
            <DiagramChartScaffold view={view} layout={layout} />
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                className={`${edge.kind === "dependency" ? "is-dependency" : ""} is-${edge.connector}`}
                style={{ stroke: edge.color }}
                fill="none"
                markerEnd={`url(#feichuan-diagram-arrow-${view})`}
              />
            ))}
            {layout.nodes.map((node) => (
              <foreignObject
                key={node.task.id}
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height + 8}
                style={{ overflow: "visible" }}
              >
                <button
                  type="button"
                  className={`feichuan-diagram-node is-${node.task.status} is-frame-${resolveTaskDiagramStyle(node.task).frame} ${view === "mindmap" || view === "wbs" ? "is-mindmap" : ""} is-chart-${view} ${selectedTask?.id === node.task.id ? "is-active" : ""} ${node.task.locked ? "is-locked" : ""}`}
                  style={createDiagramNodeStyle(node.task)}
                  title={`${node.task.name} | ${node.task.start} - ${node.task.end} | ${statusLabels[node.task.status]} ${node.task.progress}%`}
                  onClick={() => onSelectTask(node.task.id)}
                  onContextMenu={(event) =>
                    onOpenContextMenu(node.task.id, event)
                  }
                  onDoubleClick={(event) =>
                    onOpenGraphEditor(node.task.id, event, "task")
                  }
                  onPointerDown={(event) =>
                    handleCanvasNodePointerDown({
                      event,
                      taskId: node.task.id,
                      locked: node.task.locked,
                      currentOffset: nodeOffsets[node.task.id] ?? {
                        x: 0,
                        y: 0,
                      },
                      onSelectTask,
                      onOffsetChange: updateNodeOffset,
                    })
                  }
                >
                  <strong>{node.task.name}</strong>
                  <small>
                    {node.task.start} - {node.task.end}
                  </small>
                  {node.task.description ? (
                    <small>{node.task.description}</small>
                  ) : null}
                  <span>
                    {statusLabels[node.task.status]} · {node.task.progress}%
                  </span>
                </button>
              </foreignObject>
            ))}
          </svg>
        </div>
      </section>
    </div>
  );
}

function DiagramChartScaffold({
  view,
  layout,
}: {
  view: DiagramView;
  layout: ReturnType<typeof createDiagramLayout>;
}) {
  if (view === "fishbone") {
    const issue = layout.nodes[0];
    return (
      <g className="feichuan-chart-scaffold is-fishbone" aria-hidden="true">
        <path d="M 120 444 L 1108 444" />
        <path d="M 1108 444 L 1068 418 M 1108 444 L 1068 470" />
        {layout.nodes.slice(1).map((node, index) => {
          const upper = index % 2 === 0;
          const branchEndX =
            node.x + (upper ? node.width * 0.72 : node.width * 0.62);
          const branchEndY = upper ? node.y + node.height : node.y;
          return (
            <path
              key={`fish-${node.task.id}`}
              d={`M ${branchEndX} ${branchEndY} L ${branchEndX + 70} 444`}
            />
          );
        })}
        {issue ? (
          <text x="1124" y="430">
            问题/目标
          </text>
        ) : null}
      </g>
    );
  }

  if (
    view === "matrix" ||
    view === "risk-matrix" ||
    view === "raci" ||
    view === "swot"
  ) {
    const labels =
      view === "raci"
        ? ["R 负责", "A 批准", "C 咨询", "I 知会"]
        : view === "swot"
          ? ["优势", "劣势", "机会", "威胁"]
          : view === "risk-matrix"
            ? ["低进度/高风险", "中风险", "低风险/高完成"]
            : ["成本", "进度", "资源"];
    const columns = view === "raci" ? 4 : view === "swot" ? 2 : 3;
    const rows = view === "swot" ? 2 : 3;
    const cellWidth = view === "raci" ? 290 : view === "swot" ? 390 : 290;
    const cellHeight = view === "swot" ? 190 : 138;
    return (
      <g className={`feichuan-chart-scaffold is-${view}`} aria-hidden="true">
        {Array.from({ length: columns }).map((_, column) => (
          <g key={`col-${column}`}>
            <text x={110 + column * cellWidth + 12} y={106}>
              {labels[column] ?? `维度 ${column + 1}`}
            </text>
            <line
              x1={110 + column * cellWidth}
              y1="118"
              x2={110 + column * cellWidth}
              y2={118 + rows * cellHeight}
            />
          </g>
        ))}
        {Array.from({ length: rows + 1 }).map((_, row) => (
          <line
            key={`row-${row}`}
            x1="110"
            y1={118 + row * cellHeight}
            x2={110 + columns * cellWidth}
            y2={118 + row * cellHeight}
          />
        ))}
        <rect
          x="110"
          y="118"
          width={columns * cellWidth}
          height={rows * cellHeight}
        />
      </g>
    );
  }

  if (
    view === "analysis" ||
    view === "burndown" ||
    view === "burnup" ||
    view === "resource-histogram" ||
    view === "value-stream"
  ) {
    const points = layout.nodes.map((node) => [
      node.x + node.width / 2,
      node.y + node.height / 2,
    ]);
    const line = points
      .map(
        (point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`,
      )
      .join(" ");
    return (
      <g className={`feichuan-chart-scaffold is-${view}`} aria-hidden="true">
        <line x1="88" y1="700" x2="1280" y2="700" />
        <line x1="88" y1="132" x2="88" y2="700" />
        <text x="92" y="118">
          {viewLabels[view]}
        </text>
        {view === "resource-histogram" ? null : (
          <path d={line} className="is-trend" />
        )}
        {view === "value-stream" ? (
          <path d="M 120 438 L 1320 438" className="is-trend" />
        ) : null}
        {Array.from({ length: 6 }).map((_, index) => (
          <line
            key={`grid-${index}`}
            x1="88"
            y1={220 + index * 80}
            x2="1280"
            y2={220 + index * 80}
            className="is-grid"
          />
        ))}
      </g>
    );
  }

  return null;
}

function TimeNetworkNode({
  node,
  timeline,
  onSelectTask,
  onUpdateTask,
  onOpenGraphEditor,
  onOpenContextMenu,
}: {
  node: NetworkNode;
  timeline: TimelineUnit[];
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (
    taskId: string,
    event: ReactMouseEvent<Element>,
    mode: GraphEditMode,
  ) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
}) {
  const barStyle = createTaskBarStyle(node.task, {
    left: 0,
    width: node.width,
  });

  return (
    <foreignObject
      x={node.x}
      y={node.y - 17}
      width={Math.max(node.width + 260, 340)}
      height={42}
      style={{ overflow: "visible" }}
    >
      <div className="feichuan-network-bar-cell">
        <button
          type="button"
          className={`feichuan-task-bar feichuan-network-task-bar is-${node.task.status} ${node.task.critical ? "is-critical" : ""} ${node.task.locked ? "is-locked" : ""}`}
          style={barStyle}
          aria-label={`拖动调整时标网络图任务条：${node.task.name}`}
          onClick={() => onSelectTask(node.task.id)}
          onContextMenu={(event) => onOpenContextMenu(node.task.id, event)}
          onDoubleClick={(event) =>
            onOpenGraphEditor(node.task.id, event, "progress")
          }
          onPointerDown={(event) =>
            handleTimelineBarPointerDown({
              event,
              task: node.task,
              x: node.x,
              width: node.width,
              timeline,
              mode: "move",
              onSelectTask,
              onUpdateTask,
            })
          }
        >
          <span
            className="feichuan-bar-edge is-start"
            aria-hidden="true"
            onPointerDown={(event) =>
              handleTimelineBarPointerDown({
                event,
                task: node.task,
                x: node.x,
                width: node.width,
                timeline,
                mode: "resize-start",
                onSelectTask,
                onUpdateTask,
              })
            }
          />
          <span className="feichuan-bar-progress" />
          <span
            className="feichuan-bar-handle"
            onPointerDown={(event) =>
              handleTimelineBarPointerDown({
                event,
                task: node.task,
                x: node.x,
                width: node.width,
                timeline,
                mode: "progress",
                onSelectTask,
                onUpdateTask,
              })
            }
          />
          <span className="feichuan-bar-hatch" />
          <strong>{node.task.progress}%</strong>
          <em>
            {node.task.name} {node.task.progress}%
          </em>
          <span
            className="feichuan-bar-edge is-end"
            aria-hidden="true"
            onPointerDown={(event) =>
              handleTimelineBarPointerDown({
                event,
                task: node.task,
                x: node.x,
                width: node.width,
                timeline,
                mode: "resize-end",
                onSelectTask,
                onUpdateTask,
              })
            }
          />
          <span className="feichuan-tooltip">
            <b>{node.task.name}</b>
            <small>开始日期: {node.task.start}</small>
            <small>预计完成: {node.task.end}</small>
            <small>任务时长: {node.task.duration}天</small>
            <small>进度: {node.task.progress}%</small>
            <small>总浮时: {node.task.totalFloat ?? 0}天</small>
          </span>
        </button>
      </div>
    </foreignObject>
  );
}

function AdmNode({ node, index }: { node: NetworkNode; index: number }) {
  return (
    <>
      <circle
        cx={node.x}
        cy={node.y}
        r={18}
        fill={node.fill}
        stroke={node.color}
        strokeWidth={2}
      />
      <text
        x={node.x}
        y={node.y + 4}
        textAnchor="middle"
        className="feichuan-svg-index"
      >
        {index + 1}
      </text>
      <rect
        x={node.x + 25}
        y={node.y - 22}
        width={Math.min(190, Math.max(96, node.task.name.length * 12))}
        height={40}
        rx={6}
        fill={node.fill}
        opacity={0.92}
      />
      <text
        x={node.x + 34}
        y={node.y - 6}
        className="feichuan-svg-label is-strong"
      >
        {node.task.name}
      </text>
      <text x={node.x + 34} y={node.y + 12} className="feichuan-svg-label">
        {node.task.duration}天 · {node.task.progress}%
      </text>
    </>
  );
}

function PertNode({ node, index }: { node: NetworkNode; index: number }) {
  return (
    <>
      <circle
        cx={node.x}
        cy={node.y}
        r={18}
        fill={node.fill}
        stroke={node.color}
        strokeWidth={2}
      />
      <text
        x={node.x}
        y={node.y + 4}
        textAnchor="middle"
        className="feichuan-svg-index"
      >
        {index + 1}
      </text>
      <foreignObject x={node.x + 28} y={node.y - 42} width={150} height={84}>
        <div
          className={`feichuan-pert-node is-${node.task.status} is-frame-${resolveTaskDiagramStyle(node.task).frame}`}
          style={createDiagramNodeStyle(node.task)}
        >
          <div>
            <span>{node.task.earlyStart ?? 0}</span>
            <span>{node.task.expectedDuration ?? node.task.duration}</span>
            <span>{node.task.earlyFinish ?? node.task.duration}</span>
          </div>
          <strong>{node.task.name}</strong>
          <div>
            <span>{node.task.lateStart ?? 0}</span>
            <span>{node.task.totalFloat ?? 0}</span>
            <span>{node.task.lateFinish ?? node.task.duration}</span>
          </div>
        </div>
      </foreignObject>
    </>
  );
}

function networkNodeHitbox(node: NetworkNode, view: NetworkView) {
  if (view === "time-network") {
    return {
      x: node.x,
      y: node.y - 18,
      width: Math.max(node.width + 230, 260),
      height: 36,
    };
  }

  if (view === "pert") {
    return {
      x: node.x - 22,
      y: node.y - 48,
      width: 210,
      height: 96,
    };
  }

  return {
    x: node.x - 22,
    y: node.y - 28,
    width: 220,
    height: 56,
  };
}

function TimelineHeader({ timeline }: { timeline: TimelineUnit[] }) {
  const singleRow =
    timeline.length > 0 &&
    timeline.every((unit) => unit.width === scaleColumnWidth.month);

  return (
    <div
      className={`feichuan-timeline-header ${singleRow ? "is-single" : ""}`}
      style={{
        width: timeline.at(-1)
          ? timeline.at(-1)!.x + timeline.at(-1)!.width
          : 1200,
      }}
    >
      {singleRow ? null : (
        <div>
          {groupTimelineByMonth(timeline).map((group) => (
            <span
              key={group.label}
              style={{ left: group.x, width: group.width }}
            >
              {group.label}
            </span>
          ))}
        </div>
      )}
      <div className={singleRow ? "is-single-row" : ""}>
        {timeline.map((unit) => (
          <span key={unit.key} style={{ left: unit.x, width: unit.width }}>
            {unit.label}
            {unit.subLabel ? <small>{unit.subLabel}</small> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineGrid({
  timeline,
  height,
}: {
  timeline: TimelineUnit[];
  height: number;
}) {
  return (
    <>
      {timeline.map((unit) => (
        <div
          key={unit.key}
          className={`feichuan-grid-column ${unit.muted ? "is-muted" : ""}`}
          style={{ left: unit.x, width: unit.width, height }}
        />
      ))}
    </>
  );
}

function ForelineDeviationLayer({
  bars,
  dataDate,
  timeline,
}: {
  bars: GanttBar[];
  dataDate: Date;
  timeline: TimelineUnit[];
}) {
  const dataX = dateToX(dataDate, timeline);
  const markers = bars.flatMap((bar) => {
    const plannedProgress = deriveScheduleTaskPlannedProgress(
      bar.task,
      dataDate,
    );
    const deviation = bar.task.progress - plannedProgress;
    if (Math.abs(deviation) < 10 || bar.task.progress >= 100) return [];
    const progressX =
      bar.x + bar.width * clampNumber(bar.task.progress / 100, 0, 1);
    const left = Math.min(progressX, dataX);
    const width = Math.max(16, Math.abs(progressX - dataX));
    return [
      {
        id: bar.task.id,
        left,
        top: bar.y + 31,
        width,
        ahead: deviation > 0,
        label: `${deviation > 0 ? "提前" : "滞后"} ${Math.abs(deviation)}%`,
      },
    ];
  });

  if (markers.length === 0) return null;

  return (
    <div className="feichuan-foreline-layer" aria-label="前锋线偏差">
      {markers.map((marker) => (
        <span
          key={marker.id}
          className={`feichuan-foreline-delta ${marker.ahead ? "is-ahead" : "is-delay"}`}
          style={{ left: marker.left, top: marker.top, width: marker.width }}
        >
          <small>{marker.label}</small>
        </span>
      ))}
    </div>
  );
}

function LineMarker({
  date,
  timeline,
  label,
  className,
}: {
  date: Date;
  timeline: TimelineUnit[];
  label: string;
  className: string;
}) {
  const x = dateToX(date, timeline);
  return (
    <div className={`feichuan-date-marker ${className}`} style={{ left: x }}>
      <span>{label}</span>
    </div>
  );
}

function createTaskBarStyle(
  task: ScheduleTask,
  base: Pick<CSSProperties, "left" | "width">,
): CSSProperties {
  const progress = clampNumber(task.progress, 0, 100);
  const hatchLeft = clampNumber(progress, 0, 98);
  const hatchWidth = Math.max(0, Math.min(42, 100 - hatchLeft));
  const diagramStyle = resolveTaskDiagramStyle(task);
  return {
    ...base,
    background: "var(--feichuan-fill)",
    "--feichuan-accent": diagramStyle.accent,
    "--feichuan-fill": diagramStyle.fill,
    "--feichuan-node-font-size": `${diagramStyle.fontSize}px`,
    "--feichuan-progress": `${progress}%`,
    "--feichuan-hatch-left": `${hatchLeft}%`,
    "--feichuan-hatch-width": `${hatchWidth}%`,
  } as CSSProperties;
}

function createDiagramNodeStyle(task: ScheduleTask): CSSProperties {
  const diagramStyle = resolveTaskDiagramStyle(task);
  return {
    "--feichuan-accent": diagramStyle.accent,
    "--feichuan-fill": diagramStyle.fill,
    "--feichuan-node-font-size": `${diagramStyle.fontSize}px`,
  } as CSSProperties;
}

function resolveTaskDiagramStyle(task: ScheduleTask): ResolvedTaskDiagramStyle {
  return {
    frame: task.diagramStyle?.frame ?? "round",
    accent: task.diagramStyle?.accent ?? taskColor(task.status),
    fill: task.diagramStyle?.fill ?? taskFill(task.status),
    fontSize: task.diagramStyle?.fontSize ?? 12,
    connector: task.diagramStyle?.connector ?? "elbow",
  };
}

function taskAccentColor(task: ScheduleTask): string {
  return resolveTaskDiagramStyle(task).accent;
}

function taskFillColor(task: ScheduleTask): string {
  return resolveTaskDiagramStyle(task).fill;
}

function handleTimelineBarPointerDown({
  event,
  task,
  x,
  width,
  timeline,
  mode,
  onSelectTask,
  onUpdateTask,
}: {
  event: ReactPointerEvent<HTMLElement>;
  task: ScheduleTask;
  x: number;
  width: number;
  timeline: TimelineUnit[];
  mode: GanttDragMode;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
}) {
  if (event.button !== 0 || event.detail > 1 || task.locked) return;
  event.preventDefault();
  event.stopPropagation();
  onSelectTask(task.id);

  const element = (event.currentTarget.closest(".feichuan-task-bar") ??
    event.currentTarget) as HTMLElement;
  const startClientX = event.clientX;
  const startX = x;
  const endX = x + width;
  const duration = calculateDuration(task.start, task.end);
  const minTaskWidthDays = 1;
  element.setPointerCapture(event.pointerId);

  const updateProgressFromPointer = (clientX: number) => {
    const rect = element.getBoundingClientRect();
    const progress = clampNumber(
      Math.round(((clientX - rect.left) / Math.max(1, rect.width)) * 100),
      0,
      100,
    );
    onUpdateTask(task.id, { progress });
  };

  const updateFromPointer = (clientX: number) => {
    const deltaX = clientX - startClientX;
    if (mode === "progress") {
      updateProgressFromPointer(clientX);
      return;
    }

    if (mode === "move") {
      const nextStart = dateFromTimelineX(startX + deltaX, timeline);
      const nextEnd = shiftDate(nextStart, duration - 1);
      onUpdateTask(task.id, { start: nextStart, end: nextEnd });
      return;
    }

    if (mode === "resize-start") {
      const candidateStart = dateFromTimelineX(startX + deltaX, timeline);
      const latestStart = shiftDate(task.end, -(minTaskWidthDays - 1));
      const nextStart =
        parseDate(candidateStart) > parseDate(latestStart)
          ? latestStart
          : candidateStart;
      onUpdateTask(task.id, { start: nextStart });
      return;
    }

    const candidateEnd = dateFromTimelineX(endX + deltaX, timeline);
    const earliestEnd = shiftDate(task.start, minTaskWidthDays - 1);
    const nextEnd =
      parseDate(candidateEnd) < parseDate(earliestEnd)
        ? earliestEnd
        : candidateEnd;
    onUpdateTask(task.id, { end: nextEnd });
  };

  updateFromPointer(event.clientX);

  const handlePointerMove = (moveEvent: PointerEvent) => {
    updateFromPointer(moveEvent.clientX);
  };
  const handlePointerDone = (doneEvent: PointerEvent) => {
    updateFromPointer(doneEvent.clientX);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerDone);
    window.removeEventListener("pointercancel", handlePointerDone);
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerDone, { once: true });
  window.addEventListener("pointercancel", handlePointerDone, { once: true });
}

function handleCanvasNodePointerDown({
  event,
  taskId,
  locked,
  currentOffset,
  onSelectTask,
  onOffsetChange,
}: {
  event: ReactPointerEvent<Element>;
  taskId: string;
  locked?: boolean | undefined;
  currentOffset: NodeOffset;
  onSelectTask: (taskId: string) => void;
  onOffsetChange: (taskId: string, offset: NodeOffset) => void;
}) {
  if (event.button !== 0 || event.detail > 1 || locked) return;
  event.preventDefault();
  event.stopPropagation();
  onSelectTask(taskId);

  const element = event.currentTarget;
  const startClientX = event.clientX;
  const startClientY = event.clientY;
  element.setPointerCapture(event.pointerId);

  const updateOffset = (clientX: number, clientY: number) => {
    onOffsetChange(taskId, {
      x: currentOffset.x + clientX - startClientX,
      y: currentOffset.y + clientY - startClientY,
    });
  };

  const handlePointerMove = (moveEvent: PointerEvent) => {
    updateOffset(moveEvent.clientX, moveEvent.clientY);
  };
  const handlePointerDone = (doneEvent: PointerEvent) => {
    updateOffset(doneEvent.clientX, doneEvent.clientY);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerDone);
    window.removeEventListener("pointercancel", handlePointerDone);
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerDone, { once: true });
  window.addEventListener("pointercancel", handlePointerDone, { once: true });
}

interface NetworkNode {
  task: ScheduleTask;
  x: number;
  y: number;
  width: number;
  color: string;
  fill: string;
}

interface NetworkEdge {
  id: string;
  d: string;
  connector: DiagramConnectorStyle;
  color: string;
}

interface DiagramNode {
  task: ScheduleTask;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DiagramEdge {
  id: string;
  d: string;
  kind: "tree" | "dependency";
  connector: DiagramConnectorStyle;
  color: string;
}

interface GanttBar {
  task: VisibleTask;
  x: number;
  y: number;
  width: number;
}

function createGanttLayout(
  visibleTasks: VisibleTask[],
  timeline: TimelineUnit[],
) {
  const width = timeline.at(-1)
    ? timeline.at(-1)!.x + timeline.at(-1)!.width
    : 1200;
  const height = timelineHeaderHeight + visibleTasks.length * taskRowHeight + 8;
  const bars: GanttBar[] = visibleTasks.map((task) => ({
    task,
    x: dateToX(parseDate(task.start), timeline),
    y: timelineHeaderHeight + task.rowIndex * taskRowHeight + 13,
    width: Math.max(
      24,
      dateToX(parseDate(task.end), timeline) -
        dateToX(parseDate(task.start), timeline),
    ),
  }));
  const barByTaskId = new Map(bars.map((bar) => [bar.task.id, bar]));
  const links = bars.flatMap((bar) =>
    bar.task.dependencies.flatMap((dependencyId) => {
      const from = barByTaskId.get(dependencyId);
      if (!from) return [];
      const sx = from.x + from.width;
      const sy = from.y + 13;
      const tx = bar.x;
      const ty = bar.y + 13;
      const mid = Math.max(sx + 20, (sx + tx) / 2);
      return [
        {
          id: `${dependencyId}-${bar.task.id}`,
          d: `M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}`,
        },
      ];
    }),
  );
  return { width, height, bars, links };
}

function createNetworkLayout(
  tasks: ScheduleTask[],
  timeline: TimelineUnit[],
  view: NetworkView,
) {
  const width = Math.max(
    timeline.at(-1) ? timeline.at(-1)!.x + timeline.at(-1)!.width : 1320,
    1320,
  );
  const rowGap = view === "time-network" ? 54 : view === "adm" ? 64 : 82;
  const height = Math.max(
    760,
    timelineHeaderHeight + tasks.length * rowGap + 180,
  );
  const nodes: NetworkNode[] = tasks.map((task, index) => {
    const durationWidth = Math.max(
      44,
      dateToX(parseDate(task.end), timeline) -
        dateToX(parseDate(task.start), timeline),
    );
    const x =
      view === "time-network"
        ? dateToX(parseDate(task.start), timeline)
        : 80 + Math.max(0, index % 8) * 180 + Math.floor(index / 8) * 80;
    const y =
      timelineHeaderHeight +
      96 +
      (view === "time-network"
        ? index * rowGap
        : Math.floor(index / 8) * 170 + (index % 2) * 56);
    return {
      task,
      x,
      y,
      width: durationWidth,
      color: taskAccentColor(task),
      fill: taskFillColor(task),
    };
  });
  const edges = createNetworkEdges(nodes, view);
  return { width, height, nodes, edges };
}

function createNetworkEdges(
  nodes: NetworkNode[],
  view: NetworkView,
): NetworkEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  return nodes.flatMap((node) =>
    node.task.dependencies.flatMap((dependencyId) => {
      const source = nodeById.get(dependencyId);
      if (!source) return [];
      const sx =
        view === "time-network" ? source.x + source.width : source.x + 17;
      const sy = source.y;
      const tx = view === "time-network" ? node.x : node.x - 17;
      const ty = node.y;
      const connector = resolveTaskDiagramStyle(node.task).connector;
      return [
        {
          id: `${dependencyId}-${node.task.id}`,
          d: connectorPath(sx, sy, tx, ty, connector),
          connector,
          color: taskAccentColor(node.task),
        },
      ];
    }),
  );
}

function applyNetworkNodeOffsets(
  layout: ReturnType<typeof createNetworkLayout>,
  offsets: Record<string, NodeOffset>,
  view: NetworkView,
) {
  if (view === "time-network") return layout;
  const nodes = layout.nodes.map((node) => {
    const offset = offsets[node.task.id];
    return offset
      ? { ...node, x: node.x + offset.x, y: node.y + offset.y }
      : node;
  });
  return {
    ...layout,
    nodes,
    edges: createNetworkEdges(nodes, view),
  };
}

function createDiagramLayout(tasks: VisibleTask[], view: DiagramView) {
  const widthByView: Record<DiagramView, number> = {
    flowchart: 1280,
    mindmap: 1480,
    wbs: 1480,
    matrix: 1320,
    analysis: 1380,
    fishbone: 1480,
    burndown: 1380,
    burnup: 1380,
    "resource-histogram": 1380,
    "risk-matrix": 1320,
    raci: 1320,
    "value-stream": 1480,
    swot: 1320,
  };
  const heightByView =
    view === "mindmap" || view === "wbs"
      ? Math.max(960, tasks.length * 78)
      : view === "fishbone"
        ? Math.max(940, tasks.length * 52 + 220)
        : view === "burndown" ||
            view === "burnup" ||
            view === "analysis" ||
            view === "resource-histogram"
          ? 880
          : Math.max(780, tasks.length * 54 + 180);
  const childrenByParent = new Map<string | null, VisibleTask[]>();
  for (const task of tasks) {
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }

  const nodes =
    view === "mindmap" || view === "wbs"
      ? createMindMapNodes(tasks, childrenByParent)
      : view === "fishbone"
        ? createFishboneNodes(tasks)
        : view === "matrix" ||
            view === "risk-matrix" ||
            view === "raci" ||
            view === "swot"
          ? createMatrixDiagramNodes(tasks, view)
          : view === "burndown" ||
              view === "burnup" ||
              view === "analysis" ||
              view === "resource-histogram" ||
              view === "value-stream"
            ? createAnalysisDiagramNodes(tasks, view)
            : createFlowchartNodes(tasks);
  return {
    width: widthByView[view],
    height: heightByView,
    nodes,
    edges: createDiagramEdges(nodes, view),
  };
}

function createDiagramEdges(
  nodes: DiagramNode[],
  view: DiagramView,
): DiagramEdge[] {
  if (isMatrixDiagramView(view) || isAnalysisDiagramView(view)) return [];
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  const edges: DiagramEdge[] = [];

  for (const node of nodes) {
    if (node.task.parentId) {
      const parent = nodeById.get(node.task.parentId);
      if (parent) {
        edges.push({
          id: `${node.task.parentId}-${node.task.id}`,
          d: diagramEdgePath(
            parent,
            node,
            view,
            resolveTaskDiagramStyle(node.task).connector,
          ),
          kind: "tree",
          connector: resolveTaskDiagramStyle(node.task).connector,
          color: taskAccentColor(node.task),
        });
      }
    }
    for (const dependency of node.task.dependencies) {
      const source = nodeById.get(dependency);
      if (source && source.task.id !== node.task.parentId) {
        edges.push({
          id: `${dependency}-${node.task.id}-dependency`,
          d: diagramEdgePath(
            source,
            node,
            view,
            resolveTaskDiagramStyle(node.task).connector,
          ),
          kind: "dependency",
          connector: resolveTaskDiagramStyle(node.task).connector,
          color: taskAccentColor(node.task),
        });
      }
    }
  }

  return edges;
}

function applyDiagramNodeOffsets(
  layout: ReturnType<typeof createDiagramLayout>,
  offsets: Record<string, NodeOffset>,
  view: DiagramView,
) {
  const nodes = layout.nodes.map((node) => {
    const offset = offsets[node.task.id];
    return offset
      ? { ...node, x: node.x + offset.x, y: node.y + offset.y }
      : node;
  });
  return {
    ...layout,
    nodes,
    edges: createDiagramEdges(nodes, view),
  };
}

function createFlowchartNodes(tasks: VisibleTask[]): DiagramNode[] {
  const levelCount = new Map<number, number>();
  return tasks.map((task) => {
    const index = levelCount.get(task.level) ?? 0;
    levelCount.set(task.level, index + 1);
    const width = task.level === 1 ? 280 : 250;
    return {
      task,
      x: 54 + (task.level - 1) * 290,
      y: 72 + index * 104,
      width,
      height: diagramNodeHeight(task, "flowchart", width),
    };
  });
}

function createMatrixDiagramNodes(
  tasks: VisibleTask[],
  view: DiagramView,
): DiagramNode[] {
  const candidates = tasks.filter((task) => task.level >= 2).slice(0, 18);
  const cellWidth = view === "raci" ? 292 : 310;
  const cellHeight = 164;
  return candidates.map((task, index) => {
    const riskColumn =
      task.status === "delayed" ||
      task.status === "warning" ||
      task.progress < 20
        ? 0
        : task.progress >= 70
          ? 2
          : 1;
    const durationBand = task.duration >= 45 ? 0 : task.duration >= 24 ? 1 : 2;
    const column =
      view === "raci" ? index % 4 : view === "swot" ? index % 2 : riskColumn;
    const row =
      view === "raci"
        ? Math.floor(index / 4)
        : view === "swot"
          ? Math.floor(index / 2) % 2
          : durationBand;
    return {
      task,
      x: 110 + column * cellWidth + (index % 2) * 18,
      y:
        130 +
        row * cellHeight +
        Math.floor(index / (view === "raci" ? 4 : 6)) * 24,
      width: view === "raci" ? 250 : 268,
      height: diagramNodeHeight(task, view, view === "raci" ? 250 : 268),
    };
  });
}

function createAnalysisDiagramNodes(
  tasks: VisibleTask[],
  view: DiagramView,
): DiagramNode[] {
  const leafTasks = tasks.filter((task) => task.level >= 3).slice(0, 14);
  const maxDuration = Math.max(1, ...leafTasks.map((task) => task.duration));
  const maxCost = Math.max(
    1,
    ...leafTasks.map((task) => task.budgetAmount ?? task.duration),
  );
  return leafTasks.map((task, index) => {
    const x = 112 + index * 86;
    const progressY = 680 - task.progress * 4.7;
    const durationY = 680 - (task.duration / maxDuration) * 430;
    const costY = 680 - ((task.budgetAmount ?? task.duration) / maxCost) * 430;
    const y =
      view === "burndown"
        ? 220 + index * 28
        : view === "resource-histogram"
          ? durationY
          : view === "value-stream"
            ? 170 + (index % 4) * 118
            : view === "analysis"
              ? costY
              : progressY;
    const width =
      view === "resource-histogram" ? 112 : view === "value-stream" ? 230 : 174;
    const height =
      view === "resource-histogram"
        ? Math.max(74, 690 - y)
        : diagramNodeHeight(task, view, width);
    return {
      task,
      x: view === "value-stream" ? 120 + index * 132 : x,
      y,
      width,
      height,
    };
  });
}

function createFishboneNodes(tasks: VisibleTask[]): DiagramNode[] {
  const root = tasks[0];
  const issueTask = root ?? tasks.find(Boolean);
  const causes = tasks.filter((task) => task.id !== issueTask?.id).slice(0, 16);
  const nodes: DiagramNode[] = [];
  if (issueTask) {
    nodes.push({
      task: issueTask,
      x: 1120,
      y: 402,
      width: 290,
      height: diagramNodeHeight(issueTask, "fishbone", 290),
    });
  }
  causes.forEach((task, index) => {
    const upper = index % 2 === 0;
    const column = Math.floor(index / 2);
    nodes.push({
      task,
      x: 850 - column * 170,
      y: upper ? 120 + (column % 3) * 34 : 600 - (column % 3) * 34,
      width: 250,
      height: diagramNodeHeight(task, "fishbone", 250),
    });
  });
  return nodes;
}

function isMatrixDiagramView(view: DiagramView): boolean {
  return (
    view === "matrix" ||
    view === "risk-matrix" ||
    view === "raci" ||
    view === "swot"
  );
}

function isAnalysisDiagramView(view: DiagramView): boolean {
  return (
    view === "analysis" ||
    view === "burndown" ||
    view === "burnup" ||
    view === "resource-histogram" ||
    view === "value-stream"
  );
}

function diagramNodeHeight(
  task: VisibleTask,
  view: DiagramView,
  width: number,
): number {
  const fontSize = resolveTaskDiagramStyle(task).fontSize;
  const usableWidth = Math.max(80, width - 32);
  const charsPerLine = Math.max(
    7,
    Math.floor(usableWidth / Math.max(8, fontSize * 0.92)),
  );
  const titleLines = Math.max(
    1,
    Math.min(4, Math.ceil(task.name.length / charsPerLine)),
  );
  const detailLines = task.description ? 3 : 2;
  const minimum =
    view === "mindmap" || view === "wbs"
      ? 76
      : view === "fishbone"
        ? 78
        : isMatrixDiagramView(view)
          ? 82
          : 76;
  return Math.max(minimum, 18 + titleLines * (fontSize + 4) + detailLines * 14);
}

function createMindMapNodes(
  tasks: VisibleTask[],
  childrenByParent: Map<string | null, VisibleTask[]>,
): DiagramNode[] {
  const nodes: DiagramNode[] = [];
  const nodeById = new Map<string, DiagramNode>();
  const root = tasks.find((task) => task.parentId === null) ?? tasks[0];
  if (!root) return nodes;

  const branches = childrenByParent.get(root.id) ?? [];
  const branchBlocks = branches.map((branch) =>
    Math.max(
      168,
      ((childrenByParent.get(branch.id) ?? []).length || 1) * 94 + 44,
    ),
  );
  const rootCenterY = 360;
  let cursorY = 100;

  const rootNode: DiagramNode = {
    task: root,
    x: 70,
    y: rootCenterY - 40,
    width: 286,
    height: diagramNodeHeight(root, "mindmap", 286),
  };
  nodes.push(rootNode);
  nodeById.set(root.id, rootNode);

  branches.forEach((branch, branchIndex) => {
    const blockHeight = branchBlocks[branchIndex] ?? 140;
    const branchY = cursorY + blockHeight / 2 - 31;
    const branchNode: DiagramNode = {
      task: branch,
      x: 410,
      y: branchY,
      width: 258,
      height: diagramNodeHeight(branch, "mindmap", 258),
    };
    nodes.push(branchNode);
    nodeById.set(branch.id, branchNode);
    placeMindMapChildren(
      branch,
      childrenByParent,
      nodes,
      nodeById,
      710,
      branchY + 10,
    );
    cursorY += blockHeight + 36;
  });

  return nodes;
}

function placeMindMapChildren(
  parent: VisibleTask,
  childrenByParent: Map<string | null, VisibleTask[]>,
  nodes: DiagramNode[],
  nodeById: Map<string, DiagramNode>,
  x: number,
  centerY: number,
) {
  const children = childrenByParent.get(parent.id) ?? [];
  children.forEach((child, index) => {
    const y = centerY + (index - (children.length - 1) / 2) * 88;
    const node: DiagramNode = {
      task: child,
      x,
      y,
      width: 258,
      height: diagramNodeHeight(child, "mindmap", 258),
    };
    nodes.push(node);
    nodeById.set(child.id, node);
    placeMindMapChildren(child, childrenByParent, nodes, nodeById, x + 304, y);
  });
}

function diagramEdgePath(
  source: DiagramNode,
  target: DiagramNode,
  view: DiagramView,
  connector: DiagramConnectorStyle,
): string {
  const sx = source.x + source.width;
  const sy = source.y + source.height / 2;
  const tx = target.x;
  const ty = target.y + target.height / 2;
  return connectorPath(
    sx,
    sy,
    tx,
    ty,
    (view === "mindmap" || view === "wbs") && connector === "elbow"
      ? "curve"
      : connector,
  );
}

function connectorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  connector: DiagramConnectorStyle,
): string {
  if (connector === "straight") return `M ${sx} ${sy} L ${tx} ${ty}`;
  if (connector === "curve") {
    const c1 = sx + Math.max(60, (tx - sx) / 2);
    const c2 = tx - Math.max(60, (tx - sx) / 2);
    return `M ${sx} ${sy} C ${c1} ${sy}, ${c2} ${ty}, ${tx} ${ty}`;
  }
  const mid = Math.max(sx + 34, (sx + tx) / 2);
  return `M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}`;
}

function planningModelToScheduleTasks(
  model: ProjectPlanningModel,
  networkSchedule: ReturnType<typeof deriveNetworkSchedule>,
): ScheduleTask[] {
  const analysisByTaskId = new Map(
    networkSchedule.taskAnalyses.map((analysis) => [analysis.taskId, analysis]),
  );
  return model.tasks.map((taskItem) => {
    const analysis = analysisByTaskId.get(taskItem.id);
    return {
      id: taskItem.id,
      code: taskItem.code,
      parentId: taskItem.parentTaskId ?? null,
      name: taskItem.title,
      description: taskItem.description,
      owner: taskItem.owner,
      level: taskItem.outlineLevel ?? 2,
      start: taskItem.start,
      end: taskItem.end,
      duration: calculateDuration(taskItem.start, taskItem.end),
      progress: taskItem.progress,
      dependencies: taskItem.dependencies,
      status: mapPlanningStatusToScheduleStatus(taskItem, model.dataDate),
      expanded: taskItem.isExpanded ?? true,
      earlyStart: analysis?.earlyStartOffset ?? 0,
      earlyFinish:
        analysis?.earlyFinishOffset ??
        calculateDuration(taskItem.start, taskItem.end),
      lateStart: analysis?.lateStartOffset ?? 0,
      lateFinish:
        analysis?.lateFinishOffset ??
        calculateDuration(taskItem.start, taskItem.end),
      totalFloat: analysis?.totalFloatDays ?? 0,
      freeFloat: analysis?.freeFloatDays ?? 0,
      expectedDuration:
        analysis?.expectedDurationDays ??
        calculateDuration(taskItem.start, taskItem.end),
      critical: analysis?.isCritical ?? false,
      budgetAmount: taskItem.budgetAmount ?? 0,
      actualCostAmount: taskItem.actualCostAmount ?? 0,
      locked: taskItem.locked ?? false,
      diagramStyle: taskItem.diagramStyle,
    };
  });
}

function deriveZpertPlanningQuality(
  model: ProjectPlanningModel,
  networkSchedule: ReturnType<typeof deriveNetworkSchedule>,
  alerts: ReturnType<typeof deriveScheduleAlerts>,
): ZpertPlanningQuality {
  const childrenByParent = new Map<string | null, PlanningTask[]>();
  for (const task of model.tasks) {
    const children = childrenByParent.get(task.parentTaskId ?? null) ?? [];
    children.push(task);
    childrenByParent.set(task.parentTaskId ?? null, children);
  }
  const leafTasks = model.tasks.filter(
    (task) => (childrenByParent.get(task.id) ?? []).length === 0,
  );
  const successorIds = new Set(
    model.tasks.flatMap((task) => task.dependencies),
  );
  const danglingTaskCount = leafTasks.filter(
    (task) => task.dependencies.length === 0 && !successorIds.has(task.id),
  ).length;
  const highAlerts = alerts.filter(
    (alert) => alert.severity === "high" || alert.severity === "critical",
  ).length;
  const milestoneRiskCount = model.milestones.filter((milestone) => {
    if (milestone.status === "slipped") return true;
    const linkedTasks = milestone.linkedTaskIds.flatMap(
      (taskId) => model.tasks.find((task) => task.id === taskId) ?? [],
    );
    return (
      parseDate(milestone.due) < parseDate(model.dataDate) &&
      linkedTasks.some((task) => task.progress < 100)
    );
  }).length;
  const feedbackTaskIds = new Set(
    model.progressFeedback.map((feedback) => feedback.taskId),
  );
  const feedbackCoveragePercent =
    leafTasks.length > 0
      ? Math.round((feedbackTaskIds.size / leafTasks.length) * 100)
      : 0;
  const unsignedSignoffs = model.professionalSignoffs.filter(
    (signoff) => signoff.status !== "signed",
  ).length;
  const logicIssueCount = networkSchedule.dependencyWarnings.length;
  const checks: ZpertQualityCheck[] = [
    {
      label: "一表双图",
      ok: model.wbs.length > 0 && model.tasks.length > 1,
      detail: `${model.wbs.length} 个 WBS · ${model.tasks.length} 个任务`,
    },
    {
      label: "逻辑关系",
      ok:
        logicIssueCount === 0 &&
        danglingTaskCount <= Math.max(1, Math.ceil(leafTasks.length * 0.2)),
      detail: `断链 ${logicIssueCount} · 孤立 ${danglingTaskCount}`,
    },
    {
      label: "关键路径",
      ok: networkSchedule.criticalPathTaskIds.length > 0,
      detail: `${networkSchedule.criticalPathTaskIds.length} 个关键任务`,
    },
    {
      label: "前锋线反馈",
      ok: feedbackCoveragePercent >= 50 || model.progressFeedback.length > 0,
      detail: `反馈覆盖 ${feedbackCoveragePercent}%`,
    },
    {
      label: "签审证据",
      ok: unsignedSignoffs === 0,
      detail: `待签 ${unsignedSignoffs} 项`,
    },
  ];
  const score = clampNumber(
    100 -
      logicIssueCount * 8 -
      Math.max(0, danglingTaskCount - 1) * 3 -
      milestoneRiskCount * 10 -
      highAlerts * 5 -
      unsignedSignoffs * 2 -
      (feedbackCoveragePercent === 0
        ? 12
        : feedbackCoveragePercent < 50
          ? 6
          : 0) -
      (networkSchedule.criticalPathTaskIds.length === 0 ? 10 : 0),
    0,
    100,
  );
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "D";

  return {
    score,
    grade,
    logicIssueCount,
    danglingTaskCount,
    milestoneRiskCount,
    feedbackCoveragePercent,
    checks,
  };
}

function mapPlanningStatusToScheduleStatus(
  taskItem: PlanningTask,
  dataDate: string,
): ScheduleStatus {
  if (taskItem.status === "done" || taskItem.progress >= 100) return "ahead";
  if (taskItem.status === "blocked") return "delayed";
  const plannedProgress = deriveTaskPlannedProgress(taskItem, dataDate);
  if (plannedProgress === 0 && taskItem.progress === 0) return "future";
  const delta = plannedProgress - taskItem.progress;
  if (delta >= 25) return "delayed";
  if (delta >= 10) return "warning";
  return "normal";
}

function deriveScheduleTaskPlannedProgress(
  task: ScheduleTask,
  dataDate: Date,
): number {
  const start = parseDate(task.start);
  const end = parseDate(task.end);
  if (dataDate <= start) return 0;
  if (dataDate >= end) return 100;
  const duration = Math.max(1, end.getTime() - start.getTime());
  return clampNumber(
    Math.round(((dataDate.getTime() - start.getTime()) / duration) * 100),
    0,
    100,
  );
}

function mapScheduleStatusToPlanningStatus(
  status: ScheduleStatus,
  progress?: number,
): PlanningTaskStatus {
  if (progress !== undefined && progress >= 100) return "done";
  if (status === "delayed") return "blocked";
  if (status === "future") return "todo";
  return "doing";
}

function schedulePatchToPlanningPatch(
  patch: Partial<ScheduleTask>,
): Partial<PlanningTask> {
  const next: Partial<PlanningTask> = {};
  if (patch.name !== undefined) next.title = patch.name;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.owner !== undefined) next.owner = patch.owner;
  if (patch.start !== undefined) {
    next.start = patch.start;
    next.baselineStart = patch.start;
  }
  if (patch.end !== undefined) {
    next.end = patch.end;
    next.baselineEnd = patch.end;
  }
  if (patch.progress !== undefined)
    next.progress = clampNumber(Math.round(patch.progress), 0, 100);
  if (patch.budgetAmount !== undefined)
    next.budgetAmount = Math.max(0, Math.round(patch.budgetAmount));
  if (patch.actualCostAmount !== undefined)
    next.actualCostAmount = Math.max(0, Math.round(patch.actualCostAmount));
  if (patch.locked !== undefined) next.locked = patch.locked;
  if (patch.diagramStyle !== undefined) next.diagramStyle = patch.diagramStyle;
  if (patch.dependencies !== undefined) {
    next.dependencies = patch.dependencies;
    next.dependencyRules = patch.dependencies.map((predecessorId) => ({
      predecessorId,
      type: "FS",
      lagDays: 0,
    }));
  }
  if (patch.parentId !== undefined) next.parentTaskId = patch.parentId;
  if (patch.level !== undefined) next.outlineLevel = patch.level;
  if (patch.expanded !== undefined) next.isExpanded = patch.expanded;
  if (patch.status !== undefined) {
    next.status = mapScheduleStatusToPlanningStatus(
      patch.status,
      patch.progress,
    );
  } else if (patch.progress !== undefined) {
    next.status = mapScheduleStatusToPlanningStatus("normal", patch.progress);
  }
  return next;
}

function deriveVisibleTasks(tasks: ScheduleTask[]): VisibleTask[] {
  const result: VisibleTask[] = [];
  const childrenByParent = new Map<string | null, ScheduleTask[]>();
  for (const task of tasks) {
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }
  const visit = (task: ScheduleTask) => {
    result.push({ ...task, rowIndex: result.length });
    if (task.expanded === false) return;
    for (const child of childrenByParent.get(task.id) ?? []) {
      visit(child);
    }
  };
  for (const root of childrenByParent.get(null) ?? []) {
    visit(root);
  }
  return result;
}

function createTimeline(
  scale: ScheduleScale,
  startValue: string,
  endValue: string,
): TimelineUnit[] {
  const width = scaleColumnWidth[scale];
  const units: TimelineUnit[] = [];
  let cursor = parseDate(startValue);
  const endDate = parseDate(endValue);
  let index = 0;
  while (cursor <= endDate) {
    const next =
      scale === "month"
        ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
        : addDays(cursor, scale === "week" ? 7 : 1);
    units.push({
      key: `${scale}-${cursor.toISOString()}`,
      label:
        scale === "month"
          ? `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`
          : String(scale === "week" ? getWeekNumber(cursor) : cursor.getDate()),
      subLabel: scale === "day" ? dayName(cursor) : "",
      start: new Date(cursor),
      end: next,
      x: index * width,
      width,
      muted:
        scale === "day" ? [0, 6].includes(cursor.getDay()) : index % 2 === 0,
    });
    cursor = next;
    index += 1;
  }
  return units;
}

function groupTimelineByMonth(timeline: TimelineUnit[]) {
  const groups: Array<{ label: string; x: number; width: number }> = [];
  for (const unit of timeline) {
    const label = `${unit.start.getFullYear()}年${unit.start.getMonth() + 1}月`;
    const current = groups.at(-1);
    if (current?.label === label) {
      current.width += unit.width;
    } else {
      groups.push({ label, x: unit.x, width: unit.width });
    }
  }
  return groups;
}

function dateToX(date: Date, timeline: TimelineUnit[]): number {
  const first = timeline[0];
  const last = timeline.at(-1);
  if (!first || !last) return 0;
  if (date < first.start) return 0;
  if (date >= last.end) return last.x + last.width;
  const unit =
    timeline.find((item) => date >= item.start && date < item.end) ?? last;
  const span = unit.end.getTime() - unit.start.getTime();
  const percent = span > 0 ? (date.getTime() - unit.start.getTime()) / span : 0;
  return unit.x + Math.max(0, Math.min(1, percent)) * unit.width;
}

function dateFromTimelineX(x: number, timeline: TimelineUnit[]): string {
  const first = timeline[0];
  const last = timeline.at(-1);
  if (!first || !last) return defaultScheduleStart;

  const timelineEndX = last.x + last.width;
  const clampedX = clampNumber(x, 0, timelineEndX);
  const unit =
    timeline.find(
      (item) => clampedX >= item.x && clampedX < item.x + item.width,
    ) ?? last;
  const unitPercent = clampNumber(
    (clampedX - unit.x) / Math.max(1, unit.width),
    0,
    1,
  );
  const nextTime =
    unit.start.getTime() +
    (unit.end.getTime() - unit.start.getTime()) * unitPercent;
  return formatDate(new Date(nextTime));
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftDate(value: string, days: number): string {
  return formatDate(addDays(parseDate(value), days));
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompactMoney(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

function calculateDuration(start: string, end: string): number {
  const diff = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.max(1, Math.round(diff / 86_400_000) + 1);
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function handleFeichuanStageWheel(event: ReactWheelEvent<HTMLDivElement>) {
  const scroller = event.currentTarget;
  const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  if (!maxLeft) return;

  const isHorizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY);
  const shouldUseShiftWheel = event.shiftKey && Math.abs(event.deltaY) > 0;
  if (!isHorizontalGesture && !shouldUseShiftWheel) return;

  const delta = isHorizontalGesture ? event.deltaX : event.deltaY;
  const nextLeft = clampNumber(scroller.scrollLeft + delta, 0, maxLeft);
  if (nextLeft === scroller.scrollLeft) return;

  event.preventDefault();
  scroller.scrollLeft = nextLeft;
}

function createNextPlanningTaskIdentity(tasks: PlanningTask[]) {
  const maxIndex = tasks.reduce((max, task) => {
    const numericId = Number(task.id.replace(/^\D+/g, ""));
    const numericCode = Number(task.code.replace(/^\D+/g, ""));
    return Math.max(
      max,
      Number.isFinite(numericId) ? numericId : 0,
      Number.isFinite(numericCode) ? numericCode : 0,
    );
  }, 0);
  const index = maxIndex + 1;
  return {
    id: `task-${index}`,
    code: `T-${String(index).padStart(3, "0")}`,
    index,
  };
}

function clonePlanningTask(task: PlanningTask): PlanningTask {
  const cloned: PlanningTask = {
    ...task,
    dependencies: [...task.dependencies],
  };
  if (task.dependencyRules) {
    cloned.dependencyRules = task.dependencyRules.map((dependency) => ({
      ...dependency,
    }));
  }
  if (task.diagramStyle) {
    cloned.diagramStyle = { ...task.diagramStyle };
  }
  return cloned;
}

function isPlanningTaskDescendant(
  tasks: PlanningTask[],
  parentTaskId: string,
  taskId: string,
): boolean {
  let cursor = tasks.find((task) => task.id === taskId);
  while (cursor?.parentTaskId) {
    if (cursor.parentTaskId === parentTaskId) return true;
    cursor = tasks.find((task) => task.id === cursor?.parentTaskId);
  }
  return false;
}

function adjustPlanningTaskLevel(
  tasks: PlanningTask[],
  taskId: string,
  direction: "promote" | "demote",
): PlanningTask[] {
  const targetIndex = tasks.findIndex((task) => task.id === taskId);
  const target = tasks[targetIndex];
  if (!target) return tasks;

  if (direction === "promote") {
    const parent = tasks.find((task) => task.id === target.parentTaskId);
    if (!parent) return tasks;
    return tasks.map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          parentTaskId: parent.parentTaskId ?? null,
          outlineLevel: Math.max(1, parent.outlineLevel ?? 2),
        };
      }
      if (isPlanningTaskDescendant(tasks, taskId, task.id)) {
        return {
          ...task,
          outlineLevel: Math.max(1, (task.outlineLevel ?? 2) - 1),
        };
      }
      return task;
    });
  }

  const previous = tasks
    .slice(0, targetIndex)
    .reverse()
    .find((task) => (task.outlineLevel ?? 2) <= (target.outlineLevel ?? 2));
  if (!previous || previous.id === target.id) return tasks;
  return tasks.map((task) => {
    if (task.id === previous.id) return { ...task, isExpanded: true };
    if (task.id === taskId) {
      return {
        ...task,
        parentTaskId: previous.id,
        outlineLevel: Math.min((previous.outlineLevel ?? 1) + 1, 6),
      };
    }
    if (isPlanningTaskDescendant(tasks, taskId, task.id)) {
      return {
        ...task,
        outlineLevel: Math.min((task.outlineLevel ?? 2) + 1, 6),
      };
    }
    return task;
  });
}

function collectDescendantIds(
  tasks: ScheduleTask[],
  taskId: string,
): Set<string> {
  const ids = new Set([taskId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (task.parentId && ids.has(task.parentId) && !ids.has(task.id)) {
        ids.add(task.id);
        changed = true;
      }
    }
  }
  return ids;
}

function isNetworkView(view: ScheduleView): view is NetworkView {
  return view === "time-network" || view === "adm" || view === "pert";
}

function getWeekNumber(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return `第${Math.ceil((diff + start.getDay() + 1) / 7)}周`;
}

function dayName(date: Date): string {
  return (
    ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][
      date.getDay()
    ] ?? ""
  );
}

function taskColor(status: ScheduleStatus): string {
  const colors: Record<ScheduleStatus, string> = {
    normal: "#22c55e",
    ahead: "#16a34a",
    warning: "#f59e0b",
    delayed: "#ef4444",
    future: "#94a3b8",
  };
  return colors[status];
}

function taskFill(status: ScheduleStatus): string {
  const colors: Record<ScheduleStatus, string> = {
    normal: "#bbf7d0",
    ahead: "#86efac",
    warning: "#fde68a",
    delayed: "#fca5a5",
    future: "#e2e8f0",
  };
  return colors[status];
}
