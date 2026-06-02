// components/FeichuanPlanningWorkbench.tsx - Engineering schedule planning engine
// License: Apache-2.0
'use client';

import {
  ArrowLeftOutlined,
  BranchesOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DownOutlined,
  PlayCircleFilled,
  SaveOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import type {
  CSSProperties,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
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
} from '@/lib/project-planning-studio';

type NetworkView = 'time-network' | 'adm' | 'pert';
type ProjectChartView =
  | 'flowchart'
  | 'mindmap'
  | 'wbs'
  | 'matrix'
  | 'analysis'
  | 'fishbone'
  | 'burndown'
  | 'burnup'
  | 'resource-histogram'
  | 'risk-matrix'
  | 'raci'
  | 'value-stream'
  | 'swot';
type ScheduleView = 'gantt' | NetworkView | ProjectChartView;
type DiagramView = ProjectChartView;
type ScheduleScale = 'day' | 'week' | 'month';
type ScheduleStatus = 'normal' | 'ahead' | 'warning' | 'delayed' | 'future';
type PlanningRasterExportKind = 'png' | 'jpg';
type PlanningExportKind = PlanningTextExportKind | PlanningBinaryExportKind | PlanningRasterExportKind;
type AddTaskMode = 'child' | 'after' | 'parent';
type GraphEditMode = 'progress' | 'task';
type GanttDragMode = 'move' | 'progress' | 'resize-start' | 'resize-end';
type DiagramFrameStyle = 'rect' | 'round' | 'pill';
type DiagramConnectorStyle = 'elbow' | 'straight' | 'curve' | 'dashed';
type PlanningControlKey =
  | 'spi'
  | 'cpi'
  | 'planned'
  | 'actual'
  | 'earned-value'
  | 'warnings'
  | 'risks'
  | 'forecast'
  | 'resources'
  | 'calendar'
  | 'contract'
  | 'quality'
  | 'change'
  | 'signoff'
  | 'standards'
  | 'network'
  | 'critical-path';

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

const timelineHeaderHeight = 58;
const taskRowHeight = 56;
const defaultScheduleStart = '2026-05-01';
const defaultScheduleEnd = '2026-12-31';
const todayDate = parseDate('2026-05-21');

const scaleColumnWidth: Record<ScheduleScale, number> = {
  day: 37,
  week: 146,
  month: 262,
};

const viewLabels: Record<ScheduleView, string> = {
  gantt: '甘特图',
  'time-network': '时标网络图',
  adm: '双代号',
  pert: 'PERT图',
  flowchart: '流程图',
  mindmap: '思维导图',
  wbs: 'WBS图',
  matrix: '矩阵图',
  analysis: '分析图',
  fishbone: '鱼骨图',
  burndown: '燃尽图',
  burnup: '燃起图',
  'resource-histogram': '资源图',
  'risk-matrix': '风险矩阵',
  raci: 'RACI矩阵',
  'value-stream': '价值流图',
  swot: 'SWOT图',
};

const scaleLabels: Record<ScheduleScale, string> = {
  day: '日',
  week: '周',
  month: '月',
};

const statusLabels: Record<ScheduleStatus, string> = {
  normal: '正常',
  ahead: '提前',
  warning: '预警',
  delayed: '滞后',
  future: '未开始',
};

const exportOptions: Array<{
  kind: PlanningExportKind;
  label: string;
  description: string;
}> = [
  {
    kind: 'json',
    label: 'ArchIToken 计划包',
    description: '.archiplan.json，可再次导入并保留完整任务、签审、证据和样式数据',
  },
  {
    kind: 'csv',
    label: '任务清单 CSV',
    description: '.csv，用于 Excel、WPS、成本/采购系统交换任务表',
  },
  {
    kind: 'xlsx',
    label: 'Excel XLSX',
    description: '.xlsx，开放 OOXML 工作簿，含任务清单和汇总页',
  },
  {
    kind: 'markdown',
    label: 'Markdown 报告',
    description: '.md，用于方案说明、周报和知识库归档',
  },
  {
    kind: 'html',
    label: 'HTML 报告',
    description: '.html，可直接浏览、打印或转 PDF',
  },
  {
    kind: 'xml',
    label: '计划 XML',
    description: '.planning.xml，开放结构化交换，不伪造 MPP/P6',
  },
  {
    kind: 'svg',
    label: '甘特 SVG',
    description: '.svg，矢量甘特图，可进入文档和设计稿',
  },
  {
    kind: 'png',
    label: '甘特 PNG',
    description: '.png，由 SVG 渲染生成的位图快照',
  },
  {
    kind: 'jpg',
    label: '甘特 JPG',
    description: '.jpg，白底位图快照，适合邮件和报告',
  },
  {
    kind: 'pdf',
    label: 'PDF 报告',
    description: '.pdf，轻量计划摘要和任务清单',
  },
  {
    kind: 'mermaid',
    label: 'Mermaid 甘特图',
    description: '.mmd，用于文档、Markdown、Mermaid 渲染链路',
  },
  {
    kind: 'gan',
    label: 'GanttProject GAN',
    description: '.gan，开放 XML 项目计划交换格式',
  },
  {
    kind: 'freemind',
    label: 'FreeMind MM',
    description: '.mm，开放思维导图 XML，可导入多种脑图工具',
  },
  {
    kind: 'xmind',
    label: 'XMind 工作簿',
    description: '.xmind，ZIP/JSON 脑图交换包，不含闭源专属字段',
  },
];

const frameLabels: Record<DiagramFrameStyle, string> = {
  rect: '矩形',
  round: '圆角',
  pill: '胶囊',
};

const connectorLabels: Record<DiagramConnectorStyle, string> = {
  elbow: '折线',
  straight: '直线',
  curve: '曲线',
  dashed: '虚线',
};

const colorOptions = [
  { label: '蓝', accent: '#2f7df6', fill: '#c8e2fb' },
  { label: '绿', accent: '#12c86b', fill: '#bdf6cb' },
  { label: '橙', accent: '#ff9f2e', fill: '#fdecc6' },
  { label: '红', accent: '#ef4444', fill: '#ffd9d1' },
  { label: '紫', accent: '#7c3aed', fill: '#ede9fe' },
  { label: '灰', accent: '#64748b', fill: '#e2e8f0' },
];

const initialPlanningModel = createDefaultProjectPlanningModel();

export function FeichuanPlanningWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [planModel, setPlanModel] = useState<ProjectPlanningModel>(() => initialPlanningModel);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<ScheduleView>('gantt');
  const [scale, setScale] = useState<ScheduleScale>('month');
  const [selectedTaskId, setSelectedTaskId] = useState('task-5');
  const [planRange, setPlanRange] = useState({ start: defaultScheduleStart, end: defaultScheduleEnd });
  const [graphEdit, setGraphEdit] = useState<GraphEditState | null>(null);
  const [contextMenu, setContextMenu] = useState<TaskContextMenuState | null>(null);
  const [copiedTask, setCopiedTask] = useState<PlanningTask | null>(null);
  const [copiedStyle, setCopiedStyle] = useState<TaskDiagramStyle | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeControlKey, setActiveControlKey] = useState<PlanningControlKey>('warnings');
  const networkSchedule = useMemo(() => deriveNetworkSchedule(planModel.tasks), [planModel.tasks]);
  const summary = useMemo(() => derivePlanningSummary(planModel), [planModel]);
  const analytics = useMemo(() => derivePlanningAnalytics(planModel), [planModel]);
  const alerts = useMemo(() => deriveScheduleAlerts(planModel), [planModel]);
  const coverage = useMemo(() => derivePlanningStandardsCoverage(planModel), [planModel]);
  const earnedValue = useMemo(() => deriveEarnedValueMetrics(planModel), [planModel]);
  const resourceLoad = useMemo(() => deriveResourceLoadAnalysis(planModel), [planModel]);
  const calendarMetrics = useMemo(() => deriveWorkingCalendarMetrics(planModel), [planModel]);
  const governance = useMemo(() => deriveGovernanceEvidenceSummary(planModel), [planModel]);
  const signoff = useMemo(() => deriveProfessionalSignoffSummary(planModel), [planModel]);
  const tasks = useMemo(() => planningModelToScheduleTasks(planModel, networkSchedule), [networkSchedule, planModel]);
  const controlDate = useMemo(() => parseDate(planModel.dataDate), [planModel.dataDate]);
  const visibleTasks = useMemo(() => deriveVisibleTasks(tasks), [tasks]);
  const timeline = useMemo(() => createTimeline(scale, planRange.start, planRange.end), [scale, planRange.end, planRange.start]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? null;
  const graphEditTask = graphEdit ? tasks.find((task) => task.id === graphEdit.taskId) ?? null : null;
  const criticalPathLabel = networkSchedule.criticalPathTaskIds
    .map((taskId) => tasks.find((task) => task.id === taskId)?.code ?? taskId)
    .slice(0, 8)
    .join(' -> ');

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
      setExportMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setGraphEdit(null);
      }
    }

    window.addEventListener('pointerdown', closeContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', closeContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function audit(summary: string) {
    onAudit?.(createModuleAuditEvent('planning-feichuan-engine', 'FeichuanPlanningWorkbench', summary));
  }

  function toggleTask(taskId: string) {
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, isExpanded: !task.isExpanded } : task)),
    }));
  }

  function updatePlanRange(field: 'start' | 'end', value: string) {
    if (!value) return;
    setPlanRange((current) => ({ ...current, [field]: value }));
  }

  function updateTask(taskId: string, patch: Partial<ScheduleTask>) {
    const target = tasks.find((task) => task.id === taskId);
    const unlockOnly = Object.keys(patch).length === 1 && patch.locked === false;
    if (target?.locked && !unlockOnly) return;
    const planningPatch = schedulePatchToPlanningPatch(patch);
    const progressOnly = Object.keys(patch).length === 1 && patch.progress !== undefined;
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...planningPatch } : task)),
      auditTrail: progressOnly ? current.auditTrail : [
        {
          id: `feichuan-task-edit-${Date.now()}`,
          at: new Date().toISOString(),
          actor: 'FeichuanPlanningWorkbench',
          summary: `图上/表单编辑任务 ${taskId}`,
        },
        ...current.auditTrail,
      ],
    }));
    if (!progressOnly) {
      audit(`更新进度任务: ${tasks.find((task) => task.id === taskId)?.name ?? taskId}`);
    }
  }

  function openTaskContextMenu(taskId: string, event: ReactMouseEvent<Element>) {
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

  function openGraphEditor(taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode = 'task') {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTaskId(taskId);
    setContextMenu(null);
    const offsetX = mode === 'progress' ? 18 : 12;
    const offsetY = mode === 'progress' ? 38 : 14;
    setGraphEdit({
      taskId,
      mode,
      x: clampNumber(event.clientX + offsetX, 12, window.innerWidth - 300),
      y: clampNumber(event.clientY + offsetY, 12, window.innerHeight - 330),
    });
  }

  function addTask(mode: AddTaskMode = 'after', baseTaskId = selectedTaskId) {
    const selected = tasks.find((task) => task.id === baseTaskId) ?? selectedTask ?? tasks[0];
    if (!selected || selected.locked) return;
    const selectedPlanningTask = planModel.tasks.find((task) => task.id === selected.id);
    const identity = createNextPlanningTaskIdentity(planModel.tasks);
    const start = mode === 'child' || mode === 'parent'
      ? selected.start
      : shiftDate(selected.end, 1);
    const end = mode === 'child' || mode === 'parent'
      ? selected.end
      : shiftDate(start, 21);
    const duration = calculateDuration(start, end);
    const next: PlanningTask = {
      id: identity.id,
      code: identity.code,
      title: mode === 'parent'
        ? `新增父任务 ${identity.index}`
        : mode === 'child'
          ? `新增子任务 ${identity.index}`
          : `新增同级任务 ${identity.index}`,
      description: '',
      wbsId: selectedPlanningTask?.wbsId ?? planModel.wbs[0]?.id ?? 'wbs-1',
      owner: selected.owner ?? '计划工程师',
      start,
      end,
      progress: 0,
      dependencies: mode === 'after' ? [selected.id] : [],
      dependencyRules: mode === 'after' ? [{ predecessorId: selected.id, type: 'FS', lagDays: 0 }] : [],
      parentTaskId: mode === 'child' ? selected.id : selected.parentId ?? null,
      outlineLevel: mode === 'child' ? Math.min(selected.level + 1, 6) : selected.level,
      isExpanded: true,
      baselineStart: start,
      baselineEnd: end,
      durationOptimistic: Math.max(1, duration - 3),
      durationMostLikely: duration,
      durationPessimistic: duration + 5,
      calendarId: selectedPlanningTask?.calendarId ?? planModel.calendars[0]?.id ?? 'cal-johor-site',
      resourceDemand: selectedPlanningTask?.resourceDemand ?? 1,
      budgetAmount: Math.max(0, duration * 5200),
      actualCostAmount: 0,
      approvalRequired: false,
      status: 'todo',
      resourceId: selectedPlanningTask?.resourceId ?? planModel.resources[0]?.id ?? 'res-pm',
      riskId: selectedPlanningTask?.riskId ?? planModel.risks[0]?.id ?? 'risk-interface',
      diagramStyle: selected.diagramStyle ? { ...selected.diagramStyle } : undefined,
    };
    setPlanModel((current) => {
      const insertIndex = Math.max(0, current.tasks.findIndex((task) => task.id === selected.id));
      const nextTasks = current.tasks.map((task) => (
        mode === 'child' && task.id === selected.id ? { ...task, isExpanded: true } : task
      ));

      if (mode === 'parent') {
        const withParent = nextTasks.map((task) => {
          if (task.id === selected.id) {
            return {
              ...task,
              parentTaskId: next.id,
              outlineLevel: Math.min((task.outlineLevel ?? selected.level) + 1, 6),
            };
          }
          if (isPlanningTaskDescendant(nextTasks, selected.id, task.id)) {
            return { ...task, outlineLevel: Math.min((task.outlineLevel ?? selected.level) + 1, 6) };
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
            { id: `feichuan-task-add-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `新增父任务 ${next.code}` },
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
          { id: `feichuan-task-add-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `新增任务 ${next.code}` },
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
    const fallback = tasks.find((task) => !deletedIds.has(task.id) && task.id !== target.id)?.id ?? 'task-1';
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks
        .filter((task) => !deletedIds.has(task.id))
        .map((task) => {
          const dependencyRules = task.dependencyRules?.filter((dependency) => !deletedIds.has(dependency.predecessorId));
          return {
            ...task,
            dependencies: task.dependencies.filter((dependency) => !deletedIds.has(dependency)),
            ...(dependencyRules ? { dependencyRules } : {}),
          };
        }),
      milestones: current.milestones.map((milestone) => ({
        ...milestone,
        linkedTaskIds: milestone.linkedTaskIds.filter((taskId) => !deletedIds.has(taskId)),
      })),
      auditTrail: [
        { id: `feichuan-task-delete-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `删除任务 ${target.name}` },
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
    const target = tasks.find((task) => task.id === targetTaskId) ?? selectedTask;
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
      const insertIndex = Math.max(0, current.tasks.findIndex((task) => task.id === target.id));
      return {
        ...current,
        tasks: [
          ...current.tasks.slice(0, insertIndex + 1),
          pasted,
          ...current.tasks.slice(insertIndex + 1),
        ],
        auditTrail: [
          { id: `feichuan-task-paste-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `粘贴任务 ${pasted.code}` },
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
      dependencyRules: source.dependencyRules?.map((dependency) => ({ ...dependency })) ?? [],
      locked: false,
    };
    setPlanModel((current) => {
      const insertIndex = Math.max(0, current.tasks.findIndex((task) => task.id === source.id));
      return {
        ...current,
        tasks: [
          ...current.tasks.slice(0, insertIndex + 1),
          duplicate,
          ...current.tasks.slice(insertIndex + 1),
        ],
        auditTrail: [
          { id: `feichuan-task-duplicate-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `创建任务副本 ${duplicate.code}` },
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
      tasks: current.tasks.map((task) => (
        task.id === taskId ? { ...task, diagramStyle: nextStyle } : task
      )),
      auditTrail: [
        { id: `feichuan-task-style-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `更新任务图形样式 ${target.code}` },
        ...current.auditTrail,
      ],
    }));
  }

  function toggleTaskLock(taskId: string) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, locked: !task.locked } : task)),
      auditTrail: [
        { id: `feichuan-task-lock-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `${target.locked ? '解锁' : '锁定'}任务 ${target.code}` },
        ...current.auditTrail,
      ],
    }));
    setContextMenu(null);
  }

  function changeTaskLevel(taskId: string, direction: 'promote' | 'demote') {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || target.locked) return;
    setPlanModel((current) => ({
      ...current,
      tasks: adjustPlanningTaskLevel(current.tasks, taskId, direction),
      auditTrail: [
        { id: `feichuan-task-level-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `调整任务层级 ${target.code}` },
        ...current.auditTrail,
      ],
    }));
    setContextMenu(null);
  }

  function savePlanningVersion() {
    setPlanModel((current) => createPlanningVersion(current, 'FeichuanPlanningWorkbench', '飞椽计划图表与网络参数在线保存'));
    audit('保存飞椽进度计划版本');
  }

  async function exportPlanningPackage(kind: PlanningExportKind) {
    if (kind === 'xlsx' || kind === 'xmind') {
      const pack = createPlanningBinaryExport(planModel, kind);
      downloadPlanningExport(pack.fileName, pack.mimeType, pack.content);
      setExportMenuOpen(false);
      audit(`导出计划包: ${pack.fileName}`);
      return;
    }

    if (kind === 'png' || kind === 'jpg') {
      const svgPack = createPlanningExport(planModel, 'svg');
      const blob = await rasterizeSvgExport(svgPack.content, kind);
      const fileName = svgPack.fileName.replace(/\.svg$/i, kind === 'png' ? '.png' : '.jpg');
      downloadPlanningExport(fileName, kind === 'png' ? 'image/png' : 'image/jpeg', blob);
      setExportMenuOpen(false);
      audit(`导出计划图像: ${fileName}`);
      return;
    }

    const pack = createPlanningExport(planModel, kind);
    downloadPlanningExport(pack.fileName, pack.mimeType, pack.content);
    setExportMenuOpen(false);
    audit(`导出计划包: ${pack.fileName}`);
  }

  async function importPlanningPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const content = await file.text();
    const parsed = JSON.parse(content) as Partial<ProjectPlanningModel>;
    if (parsed.schema !== 'architoken.project_planning_studio.v1' || parsed.moduleId !== 'planning_management') {
      throw new Error('导入文件不是 ArchIToken 计划管理模型。');
    }
    const normalized: ProjectPlanningModel = {
      ...initialPlanningModel,
      ...parsed,
      costBaselineCurrency: parsed.costBaselineCurrency ?? initialPlanningModel.costBaselineCurrency,
      calendars: parsed.calendars?.length ? parsed.calendars : initialPlanningModel.calendars,
      wbs: parsed.wbs ?? initialPlanningModel.wbs,
      tasks: parsed.tasks ?? initialPlanningModel.tasks,
      milestones: parsed.milestones ?? initialPlanningModel.milestones,
      resources: parsed.resources ?? initialPlanningModel.resources,
      risks: parsed.risks ?? initialPlanningModel.risks,
      raci: parsed.raci ?? initialPlanningModel.raci,
      contractNodes: parsed.contractNodes ?? initialPlanningModel.contractNodes,
      qualityGates: parsed.qualityGates ?? initialPlanningModel.qualityGates,
      safetyPermits: parsed.safetyPermits ?? initialPlanningModel.safetyPermits,
      procurementPackages: parsed.procurementPackages ?? initialPlanningModel.procurementPackages,
      changeRequests: parsed.changeRequests ?? initialPlanningModel.changeRequests,
      professionalSignoffs: parsed.professionalSignoffs ?? initialPlanningModel.professionalSignoffs,
      progressFeedback: parsed.progressFeedback ?? [],
      adjustments: parsed.adjustments ?? [],
      diagrams: parsed.diagrams ?? initialPlanningModel.diagrams,
      versions: parsed.versions ?? initialPlanningModel.versions,
      auditTrail: parsed.auditTrail ?? initialPlanningModel.auditTrail,
    };
    setPlanModel(normalized);
    setSelectedTaskId(normalized.tasks[0]?.id ?? 'task-1');
    setPlanRange({
      start: normalized.tasks.map((task) => task.start).sort()[0] ?? defaultScheduleStart,
      end: normalized.tasks.map((task) => task.end).sort().at(-1) ?? defaultScheduleEnd,
    });
    audit(`导入计划包: ${file.name}`);
  }

  function applySelectedTaskAdjustment(shiftDays: number) {
    if (!selectedTask) return;
    setPlanModel((current) => applyPlanningScheduleAdjustment(current, {
      taskIds: [selectedTask.id],
      shiftDays,
      reason: shiftDays > 0 ? '图上计划顺延调整。' : '图上计划赶工调整。',
      actor: '计划工程师',
      includeSuccessors: true,
    }));
    audit(`${selectedTask.name} ${shiftDays > 0 ? '顺延' : '赶工'} ${Math.abs(shiftDays)} 天并影响后续任务`);
  }

  function updateProfessionalSignoff(
    signoffId: string,
    status: ProjectPlanningModel['professionalSignoffs'][number]['status'],
  ) {
    const at = new Date().toISOString();
    setPlanModel((current) => ({
      ...current,
      professionalSignoffs: current.professionalSignoffs.map((item) => (
        item.id === signoffId
          ? {
              ...item,
              status,
              signedAt: status === 'signed' ? at : null,
              evidenceRefs: status === 'signed'
                ? Array.from(new Set([...item.evidenceRefs, `signoff:${signoffId}`, `audit:signoff-${Date.now()}`]))
                : item.evidenceRefs,
            }
          : item
      )),
      auditTrail: [
        { id: `feichuan-signoff-${Date.now()}`, at, actor: 'FeichuanPlanningWorkbench', summary: `更新专业签审 ${signoffId}: ${status}` },
        ...current.auditTrail,
      ],
    }));
    audit(`更新专业签审: ${signoffId}`);
  }

  function changeView(next: ScheduleView) {
    setView(next);
    audit(`切换工程进度视图: ${viewLabels[next]}`);
  }

  return (
    <section className="feichuan-engine">
      <header className="feichuan-engine-toolbar">
        <div className="feichuan-engine-title">
          <Button type="text" icon={<ArrowLeftOutlined />} />
          <strong>{viewLabels[view]}</strong>
          <span>柔佛 1-2 层重钢结构项目集群</span>
          <span>总任务 {summary.taskCount}</span>
          <span>平均进度 {summary.averageProgress}%</span>
          <span>延期 {summary.delayedTaskCount} 项</span>
        </div>
        <div className="feichuan-engine-actions">
          <span>缩放</span>
          <ScaleButtons scale={scale} onChange={setScale} />
          <span>时间选择</span>
          <div className="feichuan-date-range" aria-label="计划时间范围">
            <input
              aria-label="计划开始日期"
              type="text"
              value={planRange.start}
              onChange={(event) => updatePlanRange('start', event.target.value)}
            />
            <i />
            <input
              aria-label="计划结束日期"
              type="text"
              value={planRange.end}
              onChange={(event) => updatePlanRange('end', event.target.value)}
            />
          </div>
          <Button type="primary" shape="circle" size="small" icon={<PlayCircleFilled />} />
          <Button size="small" icon={<BranchesOutlined />}>前锋线</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => importInputRef.current?.click()}>导入</Button>
          <div
            className="feichuan-export-picker"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={() => setExportMenuOpen((open) => !open)}
            >
              导出
            </Button>
            {exportMenuOpen ? (
              <div className="feichuan-export-menu" role="menu" aria-label="选择计划导出格式">
                <strong>选择导出格式</strong>
                {exportOptions.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => void exportPlanningPackage(option.kind)}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button icon={<SaveOutlined />} onClick={savePlanningVersion}>保存</Button>
        </div>
      </header>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.archiplan,application/json"
        className="feichuan-hidden-file"
        aria-label="导入计划包"
        onChange={(event) => void importPlanningPackage(event)}
      />

      <div className="feichuan-engine-switch">
        <div className="feichuan-mode-tabs" role="tablist" aria-label="计划图表视图">
          {(Object.keys(viewLabels) as ScheduleView[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={view === item}
              className={view === item ? 'is-active' : ''}
              key={item}
              onClick={() => changeView(item)}
            >
              {viewLabels[item]}
            </button>
          ))}
        </div>
        <ScaleButtons scale={scale} onChange={setScale} compact />
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
        alertCount={alerts.length}
        highAlertCount={alerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length}
        criticalPathLabel={criticalPathLabel}
        coverageGapCount={coverage.filter((item) => item.status !== 'covered').length}
        dependencyWarnings={networkSchedule.dependencyWarnings.length}
        activeKey={activeControlKey}
        onSelect={setActiveControlKey}
      />

      <PlanningControlDetail
        activeKey={activeControlKey}
        summary={summary}
        analytics={analytics}
        alerts={alerts}
        earnedValue={earnedValue}
        resourceLoad={resourceLoad}
        calendarMetrics={calendarMetrics}
        governance={governance}
        signoff={signoff}
        coverage={coverage}
        criticalPathLabel={criticalPathLabel}
        dependencyWarnings={networkSchedule.dependencyWarnings.length}
      />

      <TaskGovernanceLedger
        model={planModel}
        selectedTaskId={selectedTask?.id ?? null}
        onUpdateSignoff={updateProfessionalSignoff}
      />

      {view === 'gantt' ? (
        <GanttPlanner
          tasks={tasks}
          visibleTasks={visibleTasks}
          timeline={timeline}
          dataDate={controlDate}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onToggleTask={toggleTask}
          onUpdateTask={updateTask}
          onOpenGraphEditor={openGraphEditor}
          onOpenContextMenu={openTaskContextMenu}
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
        task={contextMenu ? tasks.find((task) => task.id === contextMenu.taskId) ?? null : null}
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
      <GraphInlineEditor
        state={graphEdit}
        task={graphEditTask}
        onClose={() => setGraphEdit(null)}
        onUpdateTask={updateTask}
      />
    </section>
  );
}


function downloadPlanningExport(fileName: string, mimeType: string, content: string | Uint8Array | Blob) {
  const blob = content instanceof Blob
    ? content
    : new Blob([content instanceof Uint8Array ? uint8ArrayToArrayBuffer(content) : content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
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

async function rasterizeSvgExport(svgContent: string, kind: PlanningRasterExportKind): Promise<Blob> {
  const width = Number(svgContent.match(/<svg[^>]*width="(\d+)"/)?.[1] ?? 1600);
  const height = Number(svgContent.match(/<svg[^>]*height="(\d+)"/)?.[1] ?? 900);
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadSvgImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.min(width, 4096));
    canvas.height = Math.max(1, Math.min(height, 4096));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建计划导出画布。');
    if (kind === 'jpg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('无法生成计划图像导出。'));
      }, kind === 'png' ? 'image/png' : 'image/jpeg', 0.92);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法加载计划 SVG。'));
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
    <div className={`feichuan-scale-group ${compact ? 'is-compact' : ''}`} aria-label="时间缩放">
      {(Object.keys(scaleLabels) as ScheduleScale[]).map((item) => (
        <button
          type="button"
          className={scale === item ? 'is-active' : ''}
          key={item}
          onClick={() => onChange(item)}
        >
          {scaleLabels[item]}
        </button>
      ))}
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
  alertCount: number;
  highAlertCount: number;
  criticalPathLabel: string;
  coverageGapCount: number;
  dependencyWarnings: number;
  activeKey: PlanningControlKey;
  onSelect: (key: PlanningControlKey) => void;
}) {
  const items: Array<{
    key: PlanningControlKey;
    label: string;
    value: string;
    tone?: 'warning' | 'danger' | undefined;
    wide?: boolean | undefined;
  }> = [
    { key: 'spi', label: 'SPI', value: String(analytics.schedulePerformanceIndex) },
    {
      key: 'cpi',
      label: 'CPI',
      value: String(earnedValue.costPerformanceIndex),
      tone: earnedValue.status === 'red' ? 'danger' : earnedValue.status === 'amber' ? 'warning' : undefined,
    },
    { key: 'planned', label: '计划应达', value: `${summary.plannedProgress}%` },
    { key: 'actual', label: '实际均值', value: `${summary.averageProgress}%` },
    { key: 'earned-value', label: 'PV/EV', value: `${formatCompactMoney(earnedValue.plannedValue)} / ${formatCompactMoney(earnedValue.earnedValue)}` },
    { key: 'warnings', label: '预警', value: `${alertCount} 条`, tone: alertCount > 0 ? 'warning' : undefined },
    { key: 'risks', label: '高风险', value: `${highAlertCount} 条`, tone: highAlertCount > 0 ? 'danger' : undefined },
    { key: 'forecast', label: '预测完成', value: analytics.forecastFinish },
    {
      key: 'resources',
      label: '资源峰值',
      value: `${resourceLoad.peakResourceName} ${resourceLoad.peakUtilizationPercent}%`,
      tone: resourceLoad.overloadedBucketCount > 0 ? 'warning' : undefined,
    },
    { key: 'calendar', label: '工作日历', value: `${calendarMetrics.workingDayCount} 工日` },
    { key: 'contract', label: '合同节点', value: `${governance.contractNodeCount} 个` },
    {
      key: 'quality',
      label: '质安证据',
      value: `${governance.evidenceCompletenessPercent}%`,
      tone: governance.blockedSafetyPermitCount > 0 ? 'danger' : undefined,
    },
    { key: 'change', label: '变更影响', value: `${governance.openChangeImpactDays} 天`, tone: governance.openChangeImpactDays > 0 ? 'warning' : undefined },
    { key: 'signoff', label: '签审闭合', value: `${signoff.signedCount}/${signoff.requiredCount}`, tone: signoff.pendingCount > 0 ? 'warning' : undefined },
    { key: 'standards', label: '标准待闭合', value: `${coverageGapCount} 项`, tone: coverageGapCount > 0 ? 'warning' : undefined },
    { key: 'network', label: '网络校核', value: `${dependencyWarnings} 条`, tone: dependencyWarnings > 0 ? 'warning' : undefined },
    { key: 'critical-path', label: '关键路径', value: criticalPathLabel || '未识别', wide: true },
  ];

  return (
    <div className="feichuan-control-strip" aria-label="计划控制指标">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`feichuan-control-chip ${activeKey === item.key ? 'is-active' : ''} ${item.tone === 'warning' ? 'is-warning' : ''} ${item.tone === 'danger' ? 'is-danger' : ''} ${item.wide ? 'is-wide' : ''}`}
          onClick={() => onSelect(item.key)}
        >
          <b>{item.label}</b>
          {item.value}
        </button>
      ))}
    </div>
  );
}

function PlanningControlDetail({
  activeKey,
  summary,
  analytics,
  alerts,
  earnedValue,
  resourceLoad,
  calendarMetrics,
  governance,
  signoff,
  coverage,
  criticalPathLabel,
  dependencyWarnings,
}: {
  activeKey: PlanningControlKey;
  summary: ReturnType<typeof derivePlanningSummary>;
  analytics: ReturnType<typeof derivePlanningAnalytics>;
  alerts: ReturnType<typeof deriveScheduleAlerts>;
  earnedValue: ReturnType<typeof deriveEarnedValueMetrics>;
  resourceLoad: ReturnType<typeof deriveResourceLoadAnalysis>;
  calendarMetrics: ReturnType<typeof deriveWorkingCalendarMetrics>;
  governance: ReturnType<typeof deriveGovernanceEvidenceSummary>;
  signoff: ReturnType<typeof deriveProfessionalSignoffSummary>;
  coverage: ReturnType<typeof derivePlanningStandardsCoverage>;
  criticalPathLabel: string;
  dependencyWarnings: number;
}) {
  const coverageGapCount = coverage.filter((item) => item.status !== 'covered').length;
  const highAlerts = alerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length;
  const detail: Record<PlanningControlKey, { title: string; body: string; meta: string }> = {
    spi: {
      title: 'SPI 进度绩效',
      body: `当前 SPI ${analytics.schedulePerformanceIndex}，用于判断项目是否按计划节奏推进。`,
      meta: `计划应达 ${summary.plannedProgress}% · 实际均值 ${summary.averageProgress}%`,
    },
    cpi: {
      title: 'CPI 成本绩效',
      body: `当前 CPI ${earnedValue.costPerformanceIndex}，PV ${formatCompactMoney(earnedValue.plannedValue)} / EV ${formatCompactMoney(earnedValue.earnedValue)}。`,
      meta: `状态 ${earnedValue.status} · 成本偏差 ${formatCompactMoney(earnedValue.costVariance)}`,
    },
    planned: {
      title: '计划进度基线',
      body: `数据日期下计划应达 ${summary.plannedProgress}%，用于对比实际反馈和前锋线。`,
      meta: `任务 ${summary.taskCount} 项 · 延期 ${summary.delayedTaskCount} 项`,
    },
    actual: {
      title: '实际进度反馈',
      body: `现场反馈均值 ${summary.averageProgress}%，双击任务条或拖动手柄可在线回填。`,
      meta: `任务 ${summary.taskCount} 项 · 阻塞 ${summary.blockedTaskCount} 项 · 延期 ${summary.delayedTaskCount} 项`,
    },
    'earned-value': {
      title: '挣值分析',
      body: `PV/EV/AC 用于同步判断进度、成本和完工预测，不作为合规结论。`,
      meta: `PV ${formatCompactMoney(earnedValue.plannedValue)} · EV ${formatCompactMoney(earnedValue.earnedValue)} · AC ${formatCompactMoney(earnedValue.actualCost)}`,
    },
    warnings: {
      title: '进度预警',
      body: `当前识别 ${alerts.length} 条预警，点击高风险、资源或标准指标可切换到对应来源。`,
      meta: alerts[0]?.message ?? '暂无需要立即处理的预警。',
    },
    risks: {
      title: '高风险任务',
      body: `高风险/严重预警 ${highAlerts} 条，优先检查关键路径、资源超载和签审阻塞。`,
      meta: alerts.find((alert) => alert.severity === 'high' || alert.severity === 'critical')?.message ?? '暂无高风险预警。',
    },
    forecast: {
      title: '预测完成',
      body: `当前预测完成日期 ${analytics.forecastFinish}，用于计划调整和合同节点复核。`,
      meta: `数据日期 ${analytics.dataDate} · 调整记录 ${analytics.adjustmentCount} 条`,
    },
    resources: {
      title: '资源负荷',
      body: `峰值资源 ${resourceLoad.peakResourceName}，峰值利用率 ${resourceLoad.peakUtilizationPercent}%。`,
      meta: `超载桶 ${resourceLoad.overloadedBucketCount} 个 · 建议联动材料物流/生产制造排程。`,
    },
    calendar: {
      title: '工作日历',
      body: `当前计划窗口内工作日 ${calendarMetrics.workingDayCount} 天。`,
      meta: `非工作日 ${calendarMetrics.nonWorkingDayCount} 天 · 日历 ${calendarMetrics.calendarName}`,
    },
    contract: {
      title: '合同节点',
      body: `合同节点 ${governance.contractNodeCount} 个，用于和付款、验收、交付节点对齐。`,
      meta: `未闭合节点 ${governance.openContractNodeCount} 个`,
    },
    quality: {
      title: '质量安全证据',
      body: `质安证据完整度 ${governance.evidenceCompletenessPercent}%，不得直接替代专业签审。`,
      meta: `阻塞安全许可 ${governance.blockedSafetyPermitCount} 个`,
    },
    change: {
      title: '变更影响',
      body: `当前打开变更影响 ${governance.openChangeImpactDays} 天，需联动进度调整和审计记录。`,
      meta: `变更 ${governance.changeRequestCount} 项 · 已批 ${governance.approvedChangeRequestCount} 项`,
    },
    signoff: {
      title: '签审闭合',
      body: `专业签审 ${signoff.signedCount}/${signoff.requiredCount}，缺少签审时只能输出经验建议。`,
      meta: `待签 ${signoff.pendingCount} 项 · 退回 ${signoff.rejectedCount} 项`,
    },
    standards: {
      title: '标准待闭合',
      body: `标准覆盖缺口 ${coverageGapCount} 项，需要绑定考试/PMBOK/IPMA/住建部课程知识点和企业制度。`,
      meta: coverage.find((item) => item.status !== 'covered')?.requirement ?? '标准覆盖已闭合。',
    },
    network: {
      title: '网络校核',
      body: `当前网络逻辑校核提示 ${dependencyWarnings} 条，用于排查断链、循环和不合理时距。`,
      meta: dependencyWarnings > 0 ? '建议检查前后置任务与关键路径。' : '网络逻辑当前未发现提示。',
    },
    'critical-path': {
      title: '关键路径',
      body: criticalPathLabel || '当前网络未识别关键路径。',
      meta: '关键路径任务变更会影响总工期和前锋线判断。',
    },
  };
  const selected = detail[activeKey];

  return (
    <div className="feichuan-control-detail" aria-live="polite">
      <strong>{selected.title}</strong>
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
    status: ProjectPlanningModel['professionalSignoffs'][number]['status'],
  ) => void;
}) {
  if (!selectedTaskId) return null;

  const signoffs = model.professionalSignoffs.filter((item) => item.linkedTaskIds.includes(selectedTaskId));
  const qualityGates = model.qualityGates.filter((item) => item.linkedTaskIds.includes(selectedTaskId));
  const safetyPermits = model.safetyPermits.filter((item) => item.linkedTaskIds.includes(selectedTaskId));
  const procurementPackages = model.procurementPackages.filter((item) => item.linkedTaskIds.includes(selectedTaskId));
  const changeRequests = model.changeRequests.filter((item) => item.linkedTaskIds.includes(selectedTaskId));
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
      <span>质量门 {qualityGates.filter((item) => item.status === 'approved' || item.status === 'closed').length}/{qualityGates.length}</span>
      <span>安全许可 {safetyPermits.filter((item) => item.status === 'approved' || item.status === 'closed').length}/{safetyPermits.length}</span>
      <span>采购包 {procurementPackages.length}</span>
      <span className={changeRequests.some((item) => !['approved', 'rejected', 'implemented'].includes(item.status)) ? 'is-warning' : ''}>
        变更 {changeRequests.length}
      </span>
      <span>证据 {totalEvidence}</span>
      <div className="feichuan-signoff-list">
        {signoffs.slice(0, 4).map((item) => (
          <span key={item.id} className={`feichuan-signoff-pill is-${item.status}`}>
            <b>{getPlanningProfessionalRoleLabel(item.role)}</b>
            {item.status === 'signed' ? '已签' : item.status === 'rejected' ? '退回' : '待签'}
            {item.status !== 'signed' ? (
              <button type="button" onClick={() => onUpdateSignoff(item.id, 'signed')}>登记内部签审</button>
            ) : (
              <button type="button" onClick={() => onUpdateSignoff(item.id, 'pending')}>重新复核</button>
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
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onUpdateTask,
  onOpenGraphEditor,
  onOpenContextMenu,
}: {
  tasks: ScheduleTask[];
  visibleTasks: VisibleTask[];
  timeline: TimelineUnit[];
  dataDate: Date;
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
}) {
  const layout = createGanttLayout(visibleTasks, timeline);
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0];

  return (
    <div className="feichuan-gantt">
      <aside className="feichuan-task-pane">
        <div className="feichuan-task-header">
          <span>任务名称</span>
          <span>计划工期</span>
          <span>实际进度</span>
        </div>
        <div className="feichuan-task-list">
          {visibleTasks.map((task) => {
            const hasChildren = tasks.some((item) => item.parentId === task.id);
            return (
              <button
                type="button"
                key={task.id}
                className={`feichuan-task-row ${task.id === selectedTaskId ? 'is-selected' : ''} ${task.locked ? 'is-locked' : ''}`}
                onClick={() => onSelectTask(task.id)}
                onContextMenu={(event) => onOpenContextMenu(task.id, event)}
              >
                <span style={{ paddingLeft: 18 + (task.level - 1) * 16 }}>
                  {hasChildren ? (
                    <DownOutlined
                      className={task.expanded === false ? 'is-collapsed' : ''}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleTask(task.id);
                      }}
                    />
                  ) : (
                    <i />
                  )}
                  {task.name}
                </span>
                <span>{task.duration}</span>
                <span className={task.progress >= 100 ? 'is-complete' : ''}>{task.progress}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="feichuan-stage">
        <TimelineHeader timeline={timeline} />
        <div className="feichuan-stage-scroll">
          <div className="feichuan-stage-inner" style={{ width: layout.width, height: layout.height }}>
            <TimelineGrid timeline={timeline} height={layout.height} />
            <svg className="feichuan-link-layer" width={layout.width} height={layout.height}>
              <defs>
                <marker id="feichuan-gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#8a8f99" />
                </marker>
              </defs>
              {layout.links.map((link) => (
                <path key={link.id} d={link.d} fill="none" stroke="#8b8f96" strokeWidth={1.4} markerEnd="url(#feichuan-gantt-arrow)" />
              ))}
            </svg>
            <LineMarker date={dataDate} timeline={timeline} className="is-data" label={formatDate(dataDate)} />
            <LineMarker date={todayDate} timeline={timeline} className="is-today" label="今天" />
            {layout.bars.map((bar) => {
              const barStyle = createTaskBarStyle(bar.task, {
                left: bar.x,
                width: bar.width,
              });

              return (
                <div
                  key={bar.task.id}
                  className={`feichuan-bar-row ${bar.task.id === activeTask?.id ? 'is-active' : ''}`}
                  style={{ top: bar.y }}
                >
                  <button
                    type="button"
                    className={`feichuan-task-bar is-${bar.task.status} ${bar.task.critical ? 'is-critical' : ''} ${bar.task.locked ? 'is-locked' : ''}`}
                    style={barStyle}
                    aria-label={`拖动调整任务条：${bar.task.name}`}
                    onClick={() => onSelectTask(bar.task.id)}
                    onContextMenu={(event) => onOpenContextMenu(bar.task.id, event)}
                    onPointerDown={(event) => handleTimelineBarPointerDown({
                      event,
                      task: bar.task,
                      x: bar.x,
                      width: bar.width,
                      timeline,
                      mode: 'move',
                      onSelectTask,
                      onUpdateTask,
                    })}
                    onDoubleClick={(event) => onOpenGraphEditor(bar.task.id, event, 'progress')}
                  >
                    <span
                      className="feichuan-bar-edge is-start"
                      aria-hidden="true"
                      onPointerDown={(event) => handleTimelineBarPointerDown({
                        event,
                        task: bar.task,
                        x: bar.x,
                        width: bar.width,
                        timeline,
                        mode: 'resize-start',
                        onSelectTask,
                        onUpdateTask,
                      })}
                    />
                    <span className="feichuan-bar-progress" />
                    <span
                      className="feichuan-bar-handle"
                      onPointerDown={(event) => handleTimelineBarPointerDown({
                        event,
                        task: bar.task,
                        x: bar.x,
                        width: bar.width,
                        timeline,
                        mode: 'progress',
                        onSelectTask,
                        onUpdateTask,
                      })}
                    />
                    <span className="feichuan-bar-hatch" />
                    <strong>{bar.task.progress}%</strong>
                    <em>预计任务工期{bar.task.status === 'ahead' ? '提前' : '延后'}七天</em>
                    <span
                      className="feichuan-bar-edge is-end"
                      aria-hidden="true"
                      onPointerDown={(event) => handleTimelineBarPointerDown({
                        event,
                        task: bar.task,
                        x: bar.x,
                        width: bar.width,
                        timeline,
                        mode: 'resize-end',
                        onSelectTask,
                        onUpdateTask,
                      })}
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
}: {
  view: NetworkView;
  tasks: ScheduleTask[];
  timeline: TimelineUnit[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
}) {
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodeOffset>>({});
  const baseLayout = createNetworkLayout(tasks, timeline, view);
  const layout = applyNetworkNodeOffsets(baseLayout, nodeOffsets, view);

  function updateNodeOffset(taskId: string, offset: NodeOffset) {
    setNodeOffsets((current) => ({ ...current, [taskId]: offset }));
  }

  return (
    <div className="feichuan-network">
      <aside className="feichuan-task-pane">
        <div className="feichuan-task-header">
          <span>任务名称</span>
          <span>计划工期</span>
          <span>实际进度</span>
        </div>
        <div className="feichuan-task-list">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className={`feichuan-task-row ${selectedTask?.id === task.id ? 'is-selected' : ''} ${task.locked ? 'is-locked' : ''}`}
              title={`${task.name} | ${task.start} - ${task.end} | ${task.progress}%`}
              onClick={() => onSelectTask(task.id)}
              onContextMenu={(event) => onOpenContextMenu(task.id, event)}
            >
              <span>{task.name}</span>
              <span>{task.duration}</span>
              <span>{task.progress}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="feichuan-network-stage">
        <TimelineHeader timeline={timeline} />
        <div className="feichuan-stage-scroll">
          <div className="feichuan-stage-inner" style={{ width: layout.width, height: layout.height }}>
            <TimelineGrid timeline={timeline} height={layout.height} />
            <svg width={layout.width} height={layout.height} className="feichuan-network-svg">
              <defs>
                <pattern id="feichuan-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                  <rect width="7" height="14" fill="rgba(226,232,240,0.8)" />
                </pattern>
                <marker id="feichuan-network-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
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
                    className={`feichuan-network-node ${selectedTask?.id === node.task.id ? 'is-active' : ''} ${node.task.critical ? 'is-critical' : ''}`}
                    onClick={() => onSelectTask(node.task.id)}
                    onContextMenu={(event) => onOpenContextMenu(node.task.id, event)}
                    onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                    onPointerDown={(event) => {
                      if (view === 'time-network') return;
                      handleCanvasNodePointerDown({
                        event,
                        taskId: node.task.id,
                        locked: node.task.locked,
                        currentOffset: nodeOffsets[node.task.id] ?? { x: 0, y: 0 },
                        onSelectTask,
                        onOffsetChange: updateNodeOffset,
                      });
                    }}
                  >
                    {view === 'time-network' ? (
                      <TimeNetworkNode
                        node={node}
                        timeline={timeline}
                        onSelectTask={onSelectTask}
                        onUpdateTask={onUpdateTask}
                        onOpenGraphEditor={onOpenGraphEditor}
                        onOpenContextMenu={onOpenContextMenu}
                      />
                    ) : view === 'adm' ? (
                      <AdmNode node={node} index={index} />
                    ) : (
                      <PertNode node={node} index={index} />
                    )}
                    {view !== 'time-network' ? (
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
                        onContextMenu={(event) => onOpenContextMenu(node.task.id, event)}
                        onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {view === 'pert' ? (
              <div className="feichuan-pert-legend">
                <div><span>最早开始时间<br />(ES)</span><span>工期 (DU)</span><span>最早完成时间<br />(EF)</span></div>
                <strong>活动名称</strong>
                <div><span>最迟开始时间<br />(LS)</span><span>总浮动时间<br />(TF)</span><span>最迟完成时间<br />(LF)</span></div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
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
      <strong>当前编辑</strong>
      <input
        aria-label="编辑任务名称"
        value={task.name}
        onChange={(event) => onUpdateTask(task.id, { name: event.target.value })}
      />
      <input
        aria-label="编辑开始日期"
        value={task.start}
        onChange={(event) => onUpdateTask(task.id, { start: event.target.value })}
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
            const nextValue = event.target.value.replace(/[^\d]/g, '');
            onUpdateTask(task.id, { progress: clampNumber(Math.round(Number(nextValue || 0)), 0, 100) });
          }}
        />
        <em>%</em>
      </label>
      <select
        aria-label="编辑任务状态"
        value={task.status}
        onChange={(event) => onUpdateTask(task.id, { status: event.target.value as ScheduleStatus })}
      >
        {(Object.keys(statusLabels) as ScheduleStatus[]).map((status) => (
          <option key={status} value={status}>{statusLabels[status]}</option>
        ))}
      </select>
      <button type="button" onClick={() => onAddTask('child')}>子任务</button>
      <button type="button" onClick={() => onAddTask('after')}>后续</button>
      <button type="button" onClick={() => onAdjustTask(-1)}>赶工1天</button>
      <button type="button" onClick={() => onAdjustTask(1)}>顺延1天</button>
      <button type="button" disabled={task.parentId === null} onClick={onDeleteTask}>删除</button>
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

  const title = state.mode === 'progress' ? '图上编辑进度' : '图上编辑任务';

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
        <button type="button" aria-label="关闭图上编辑" onClick={onClose}>×</button>
      </div>
      <label>
        <span>任务名称</span>
        <input
          aria-label="图上编辑任务名称"
          value={task.name}
          autoFocus={state.mode === 'task'}
          onChange={(event) => onUpdateTask(task.id, { name: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
          }}
        />
      </label>
      <label>
        <span>描述</span>
        <textarea
          aria-label="图上编辑任务描述"
          value={task.description ?? ''}
          rows={3}
          onChange={(event) => onUpdateTask(task.id, { description: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
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
            onChange={(event) => onUpdateTask(task.id, { start: event.target.value })}
          />
        </label>
        <label>
          <span>完成</span>
          <input
            type="date"
            aria-label="图上编辑完成日期"
            value={task.end}
            onChange={(event) => onUpdateTask(task.id, { end: event.target.value })}
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
            autoFocus={state.mode === 'progress'}
            onChange={(event) => onUpdateTask(task.id, { progress: clampNumber(Math.round(Number(event.target.value)), 0, 100) })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') onClose();
            }}
          />
        </label>
        <label>
          <span>状态</span>
          <select
            aria-label="图上编辑状态"
            value={task.status}
            onChange={(event) => onUpdateTask(task.id, { status: event.target.value as ScheduleStatus })}
          >
            {(Object.keys(statusLabels) as ScheduleStatus[]).map((status) => (
              <option key={status} value={status}>{statusLabels[status]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="feichuan-graph-editor-actions">
        <button type="button" onClick={onClose}>完成</button>
      </div>
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
  onChangeLevel: (taskId: string, direction: 'promote' | 'demote') => void;
  onToggleLock: (taskId: string) => void;
  onDeleteTask: (taskId?: string) => void;
}) {
  if (!state || !task) return null;
  const style = resolveTaskDiagramStyle(task);
  const disabled = task.locked;
  const run = (action: () => void) => {
    action();
  };

  return (
    <div
      className="feichuan-context-menu"
      style={{ left: state.x, top: state.y }}
      role="menu"
      aria-label="计划节点右键菜单"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button type="button" disabled={disabled} onClick={() => run(() => onAddTask('after', task.id))}>
        <span>添加同级节点</span><kbd>Enter</kbd>
      </button>
      <button type="button" disabled={disabled} onClick={() => run(() => onAddTask('child', task.id))}>
        <span>添加子节点</span><kbd>Tab</kbd>
      </button>
      <button type="button" disabled={disabled || task.parentId === null} onClick={() => run(() => onAddTask('parent', task.id))}>
        <span>添加父节点</span><kbd>Shift + Tab</kbd>
      </button>
      <hr />
      <button type="button" onClick={() => run(() => onCopyTask(task.id))}>
        <span>复制</span><kbd>Ctrl + C</kbd>
      </button>
      <button type="button" disabled={!canPasteTask || disabled} onClick={() => run(() => onPasteTask(task.id))}>
        <span>粘贴</span><kbd>Ctrl + V</kbd>
      </button>
      <button type="button" disabled={disabled} onClick={() => run(() => onDuplicateTask(task.id))}>
        <span>创建副本</span><kbd>Ctrl + D</kbd>
      </button>
      <hr />
      <div className="feichuan-context-level">
        <span>层级</span>
        <button type="button" disabled={disabled || task.parentId === null} onClick={() => onChangeLevel(task.id, 'promote')}>提升</button>
        <button type="button" disabled={disabled} onClick={() => onChangeLevel(task.id, 'demote')}>降低</button>
      </div>
      <button type="button" disabled={disabled} onClick={() => run(() => onCopyStyle(task.id))}>
        <span>复制样式</span><kbd>Ctrl + Alt + C</kbd>
      </button>
      <button type="button" disabled={!canPasteStyle || disabled} onClick={() => run(() => onPasteStyle(task.id))}>
        <span>粘贴样式</span><kbd>Ctrl + Alt + V</kbd>
      </button>
      <div className="feichuan-context-style">
        <label>
          图框
          <select
            value={style.frame}
            disabled={disabled}
            onChange={(event) => onUpdateStyle(task.id, { frame: event.target.value as DiagramFrameStyle })}
          >
            {(Object.keys(frameLabels) as DiagramFrameStyle[]).map((frame) => (
              <option key={frame} value={frame}>{frameLabels[frame]}</option>
            ))}
          </select>
        </label>
        <label>
          字号
          <select
            value={style.fontSize}
            disabled={disabled}
            onChange={(event) => onUpdateStyle(task.id, { fontSize: Number(event.target.value) })}
          >
            {[10, 12, 14, 16, 18].map((size) => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </label>
        <label>
          连线
          <select
            value={style.connector}
            disabled={disabled}
            onChange={(event) => onUpdateStyle(task.id, { connector: event.target.value as DiagramConnectorStyle })}
          >
            {(Object.keys(connectorLabels) as DiagramConnectorStyle[]).map((connector) => (
              <option key={connector} value={connector}>{connectorLabels[connector]}</option>
            ))}
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
              className={style.accent === color.accent ? 'is-active' : ''}
              style={{ background: color.accent }}
              onClick={() => onUpdateStyle(task.id, { accent: color.accent, fill: color.fill })}
            />
          ))}
        </div>
        <label className="is-description">
          描述
          <textarea
            value={task.description ?? ''}
            disabled={disabled}
            rows={3}
            onChange={(event) => onUpdateTask(task.id, { description: event.target.value })}
          />
        </label>
      </div>
      <hr />
      <button type="button" onClick={() => run(() => onToggleLock(task.id))}>
        <span>{task.locked ? '解锁' : '锁定'}</span><kbd>Ctrl + Alt + L</kbd>
      </button>
      <button type="button" disabled={disabled || task.parentId === null} className="is-danger" onClick={() => run(() => onDeleteTask(task.id))}>
        <span>删除</span><kbd>⌫</kbd>
      </button>
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
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
  onOpenContextMenu: (taskId: string, event: ReactMouseEvent<Element>) => void;
}) {
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodeOffset>>({});
  const baseLayout = createDiagramLayout(visibleTasks, view);
  const layout = applyDiagramNodeOffsets(baseLayout, nodeOffsets, view);

  function updateNodeOffset(taskId: string, offset: NodeOffset) {
    setNodeOffsets((current) => ({ ...current, [taskId]: offset }));
  }

  return (
    <div className="feichuan-network feichuan-diagram">
      <aside className="feichuan-task-pane">
        <div className="feichuan-task-header">
          <span>任务名称</span>
          <span>计划工期</span>
          <span>实际进度</span>
        </div>
        <div className="feichuan-task-list">
          {visibleTasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className={`feichuan-task-row ${selectedTask?.id === task.id ? 'is-selected' : ''} ${task.locked ? 'is-locked' : ''}`}
              onClick={() => onSelectTask(task.id)}
              onContextMenu={(event) => onOpenContextMenu(task.id, event)}
            >
              <span style={{ paddingLeft: 18 + (task.level - 1) * 16 }}>
                <i />
                {task.name}
              </span>
              <span>{task.duration}</span>
              <span>{task.progress}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="feichuan-diagram-stage">
        <div className="feichuan-diagram-toolbar">
          <strong>{viewLabels[view]}在线编制画布</strong>
          <span>节点 {tasks.length}</span>
          <button type="button" onClick={() => onAddTask('child')}>新增节点</button>
          <button type="button" onClick={() => onAddTask('after')}>新增同级</button>
        </div>
        <div className="feichuan-stage-scroll">
          <svg className="feichuan-diagram-svg" width={layout.width} height={layout.height}>
            <defs>
              <marker id={`feichuan-diagram-arrow-${view}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#8a8f99" />
              </marker>
            </defs>
            <DiagramChartScaffold view={view} layout={layout} />
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                className={`${edge.kind === 'dependency' ? 'is-dependency' : ''} is-${edge.connector}`}
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
                style={{ overflow: 'visible' }}
              >
                <button
                  type="button"
                  className={`feichuan-diagram-node is-${node.task.status} is-frame-${resolveTaskDiagramStyle(node.task).frame} ${view === 'mindmap' || view === 'wbs' ? 'is-mindmap' : ''} is-chart-${view} ${selectedTask?.id === node.task.id ? 'is-active' : ''} ${node.task.locked ? 'is-locked' : ''}`}
                  style={createDiagramNodeStyle(node.task)}
                  title={`${node.task.name} | ${node.task.start} - ${node.task.end} | ${statusLabels[node.task.status]} ${node.task.progress}%`}
                  onClick={() => onSelectTask(node.task.id)}
                  onContextMenu={(event) => onOpenContextMenu(node.task.id, event)}
                  onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                  onPointerDown={(event) => handleCanvasNodePointerDown({
                    event,
                    taskId: node.task.id,
                    locked: node.task.locked,
                    currentOffset: nodeOffsets[node.task.id] ?? { x: 0, y: 0 },
                    onSelectTask,
                    onOffsetChange: updateNodeOffset,
                  })}
                >
                  <strong>{node.task.name}</strong>
                  <small>{node.task.start} - {node.task.end}</small>
                  {node.task.description ? <small>{node.task.description}</small> : null}
                  <span>{statusLabels[node.task.status]} · {node.task.progress}%</span>
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
  if (view === 'fishbone') {
    const issue = layout.nodes[0];
    return (
      <g className="feichuan-chart-scaffold is-fishbone" aria-hidden="true">
        <path d="M 120 444 L 1108 444" />
        <path d="M 1108 444 L 1068 418 M 1108 444 L 1068 470" />
        {layout.nodes.slice(1).map((node, index) => {
          const upper = index % 2 === 0;
          const branchEndX = node.x + (upper ? node.width * 0.72 : node.width * 0.62);
          const branchEndY = upper ? node.y + node.height : node.y;
          return <path key={`fish-${node.task.id}`} d={`M ${branchEndX} ${branchEndY} L ${branchEndX + 70} 444`} />;
        })}
        {issue ? <text x="1124" y="430">问题/目标</text> : null}
      </g>
    );
  }

  if (view === 'matrix' || view === 'risk-matrix' || view === 'raci' || view === 'swot') {
    const labels = view === 'raci'
      ? ['R 负责', 'A 批准', 'C 咨询', 'I 知会']
      : view === 'swot'
        ? ['优势', '劣势', '机会', '威胁']
        : view === 'risk-matrix'
          ? ['低进度/高风险', '中风险', '低风险/高完成']
          : ['成本', '进度', '资源'];
    const columns = view === 'raci' ? 4 : view === 'swot' ? 2 : 3;
    const rows = view === 'swot' ? 2 : 3;
    const cellWidth = view === 'raci' ? 290 : view === 'swot' ? 390 : 290;
    const cellHeight = view === 'swot' ? 190 : 138;
    return (
      <g className={`feichuan-chart-scaffold is-${view}`} aria-hidden="true">
        {Array.from({ length: columns }).map((_, column) => (
          <g key={`col-${column}`}>
            <text x={110 + column * cellWidth + 12} y={106}>{labels[column] ?? `维度 ${column + 1}`}</text>
            <line x1={110 + column * cellWidth} y1="118" x2={110 + column * cellWidth} y2={118 + rows * cellHeight} />
          </g>
        ))}
        {Array.from({ length: rows + 1 }).map((_, row) => (
          <line key={`row-${row}`} x1="110" y1={118 + row * cellHeight} x2={110 + columns * cellWidth} y2={118 + row * cellHeight} />
        ))}
        <rect x="110" y="118" width={columns * cellWidth} height={rows * cellHeight} />
      </g>
    );
  }

  if (view === 'analysis' || view === 'burndown' || view === 'burnup' || view === 'resource-histogram' || view === 'value-stream') {
    const points = layout.nodes.map((node) => [node.x + node.width / 2, node.y + node.height / 2]);
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`).join(' ');
    return (
      <g className={`feichuan-chart-scaffold is-${view}`} aria-hidden="true">
        <line x1="88" y1="700" x2="1280" y2="700" />
        <line x1="88" y1="132" x2="88" y2="700" />
        <text x="92" y="118">{viewLabels[view]}</text>
        {view === 'resource-histogram' ? null : <path d={line} className="is-trend" />}
        {view === 'value-stream' ? <path d="M 120 438 L 1320 438" className="is-trend" /> : null}
        {Array.from({ length: 6 }).map((_, index) => (
          <line key={`grid-${index}`} x1="88" y1={220 + index * 80} x2="1280" y2={220 + index * 80} className="is-grid" />
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
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
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
      style={{ overflow: 'visible' }}
    >
      <div className="feichuan-network-bar-cell">
        <button
          type="button"
          className={`feichuan-task-bar feichuan-network-task-bar is-${node.task.status} ${node.task.critical ? 'is-critical' : ''} ${node.task.locked ? 'is-locked' : ''}`}
          style={barStyle}
          aria-label={`拖动调整时标网络图任务条：${node.task.name}`}
          onClick={() => onSelectTask(node.task.id)}
          onContextMenu={(event) => onOpenContextMenu(node.task.id, event)}
          onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'progress')}
          onPointerDown={(event) => handleTimelineBarPointerDown({
            event,
            task: node.task,
            x: node.x,
            width: node.width,
            timeline,
            mode: 'move',
            onSelectTask,
            onUpdateTask,
          })}
        >
          <span
            className="feichuan-bar-edge is-start"
            aria-hidden="true"
            onPointerDown={(event) => handleTimelineBarPointerDown({
              event,
              task: node.task,
              x: node.x,
              width: node.width,
              timeline,
              mode: 'resize-start',
              onSelectTask,
              onUpdateTask,
            })}
          />
          <span className="feichuan-bar-progress" />
          <span
            className="feichuan-bar-handle"
            onPointerDown={(event) => handleTimelineBarPointerDown({
              event,
              task: node.task,
              x: node.x,
              width: node.width,
              timeline,
              mode: 'progress',
              onSelectTask,
              onUpdateTask,
            })}
          />
          <span className="feichuan-bar-hatch" />
          <strong>{node.task.progress}%</strong>
          <em>{node.task.name} {node.task.progress}%</em>
          <span
            className="feichuan-bar-edge is-end"
            aria-hidden="true"
            onPointerDown={(event) => handleTimelineBarPointerDown({
              event,
              task: node.task,
              x: node.x,
              width: node.width,
              timeline,
              mode: 'resize-end',
              onSelectTask,
              onUpdateTask,
            })}
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
      <circle cx={node.x} cy={node.y} r={18} fill={node.fill} stroke={node.color} strokeWidth={2} />
      <text x={node.x} y={node.y + 4} textAnchor="middle" className="feichuan-svg-index">{index + 1}</text>
      <rect x={node.x + 25} y={node.y - 22} width={Math.min(190, Math.max(96, node.task.name.length * 12))} height={40} rx={6} fill={node.fill} opacity={0.92} />
      <text x={node.x + 34} y={node.y - 6} className="feichuan-svg-label is-strong">{node.task.name}</text>
      <text x={node.x + 34} y={node.y + 12} className="feichuan-svg-label">{node.task.duration}天 · {node.task.progress}%</text>
    </>
  );
}

function PertNode({ node, index }: { node: NetworkNode; index: number }) {
  return (
    <>
      <circle cx={node.x} cy={node.y} r={18} fill={node.fill} stroke={node.color} strokeWidth={2} />
      <text x={node.x} y={node.y + 4} textAnchor="middle" className="feichuan-svg-index">{index + 1}</text>
      <foreignObject x={node.x + 28} y={node.y - 42} width={150} height={84}>
        <div
          className={`feichuan-pert-node is-${node.task.status} is-frame-${resolveTaskDiagramStyle(node.task).frame}`}
          style={createDiagramNodeStyle(node.task)}
        >
          <div><span>{node.task.earlyStart ?? 0}</span><span>{node.task.expectedDuration ?? node.task.duration}</span><span>{node.task.earlyFinish ?? node.task.duration}</span></div>
          <strong>{node.task.name}</strong>
          <div><span>{node.task.lateStart ?? 0}</span><span>{node.task.totalFloat ?? 0}</span><span>{node.task.lateFinish ?? node.task.duration}</span></div>
        </div>
      </foreignObject>
    </>
  );
}

function networkNodeHitbox(node: NetworkNode, view: NetworkView) {
  if (view === 'time-network') {
    return {
      x: node.x,
      y: node.y - 18,
      width: Math.max(node.width + 230, 260),
      height: 36,
    };
  }

  if (view === 'pert') {
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
  return (
    <div className="feichuan-timeline-header" style={{ width: timeline.at(-1) ? timeline.at(-1)!.x + timeline.at(-1)!.width : 1200 }}>
      <div>
        {groupTimelineByMonth(timeline).map((group) => (
          <span key={group.label} style={{ left: group.x, width: group.width }}>{group.label}</span>
        ))}
      </div>
      <div>
        {timeline.map((unit) => (
          <span key={unit.key} style={{ left: unit.x, width: unit.width }}>{unit.label}<small>{unit.subLabel}</small></span>
        ))}
      </div>
    </div>
  );
}

function TimelineGrid({ timeline, height }: { timeline: TimelineUnit[]; height: number }) {
  return (
    <>
      {timeline.map((unit) => (
        <div
          key={unit.key}
          className={`feichuan-grid-column ${unit.muted ? 'is-muted' : ''}`}
          style={{ left: unit.x, width: unit.width, height }}
        />
      ))}
    </>
  );
}

function LineMarker({ date, timeline, label, className }: { date: Date; timeline: TimelineUnit[]; label: string; className: string }) {
  const x = dateToX(date, timeline);
  return (
    <div className={`feichuan-date-marker ${className}`} style={{ left: x }}>
      <span>{label}</span>
    </div>
  );
}

function createTaskBarStyle(
  task: ScheduleTask,
  base: Pick<CSSProperties, 'left' | 'width'>,
): CSSProperties {
  const progress = clampNumber(task.progress, 0, 100);
  const hatchLeft = clampNumber(progress, 0, 98);
  const hatchWidth = Math.max(0, Math.min(42, 100 - hatchLeft));
  const diagramStyle = resolveTaskDiagramStyle(task);
  return {
    ...base,
    background: 'var(--feichuan-fill)',
    '--feichuan-accent': diagramStyle.accent,
    '--feichuan-fill': diagramStyle.fill,
    '--feichuan-node-font-size': `${diagramStyle.fontSize}px`,
    '--feichuan-progress': `${progress}%`,
    '--feichuan-hatch-left': `${hatchLeft}%`,
    '--feichuan-hatch-width': `${hatchWidth}%`,
  } as CSSProperties;
}

function createDiagramNodeStyle(task: ScheduleTask): CSSProperties {
  const diagramStyle = resolveTaskDiagramStyle(task);
  return {
    '--feichuan-accent': diagramStyle.accent,
    '--feichuan-fill': diagramStyle.fill,
    '--feichuan-node-font-size': `${diagramStyle.fontSize}px`,
  } as CSSProperties;
}

function resolveTaskDiagramStyle(task: ScheduleTask): ResolvedTaskDiagramStyle {
  return {
    frame: task.diagramStyle?.frame ?? 'round',
    accent: task.diagramStyle?.accent ?? taskColor(task.status),
    fill: task.diagramStyle?.fill ?? taskFill(task.status),
    fontSize: task.diagramStyle?.fontSize ?? 12,
    connector: task.diagramStyle?.connector ?? 'elbow',
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

  const element = (event.currentTarget.closest('.feichuan-task-bar') ?? event.currentTarget) as HTMLElement;
  const startClientX = event.clientX;
  const startX = x;
  const endX = x + width;
  const duration = calculateDuration(task.start, task.end);
  const minTaskWidthDays = 1;
  element.setPointerCapture(event.pointerId);

  const updateProgressFromPointer = (clientX: number) => {
    const rect = element.getBoundingClientRect();
    const progress = clampNumber(Math.round(((clientX - rect.left) / Math.max(1, rect.width)) * 100), 0, 100);
    onUpdateTask(task.id, { progress });
  };

  const updateFromPointer = (clientX: number) => {
    const deltaX = clientX - startClientX;
    if (mode === 'progress') {
      updateProgressFromPointer(clientX);
      return;
    }

    if (mode === 'move') {
      const nextStart = dateFromTimelineX(startX + deltaX, timeline);
      const nextEnd = shiftDate(nextStart, duration - 1);
      onUpdateTask(task.id, { start: nextStart, end: nextEnd });
      return;
    }

    if (mode === 'resize-start') {
      const candidateStart = dateFromTimelineX(startX + deltaX, timeline);
      const latestStart = shiftDate(task.end, -(minTaskWidthDays - 1));
      const nextStart = parseDate(candidateStart) > parseDate(latestStart) ? latestStart : candidateStart;
      onUpdateTask(task.id, { start: nextStart });
      return;
    }

    const candidateEnd = dateFromTimelineX(endX + deltaX, timeline);
    const earliestEnd = shiftDate(task.start, minTaskWidthDays - 1);
    const nextEnd = parseDate(candidateEnd) < parseDate(earliestEnd) ? earliestEnd : candidateEnd;
    onUpdateTask(task.id, { end: nextEnd });
  };

  updateFromPointer(event.clientX);

  const handlePointerMove = (moveEvent: PointerEvent) => {
    updateFromPointer(moveEvent.clientX);
  };
  const handlePointerDone = (doneEvent: PointerEvent) => {
    updateFromPointer(doneEvent.clientX);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerDone);
    window.removeEventListener('pointercancel', handlePointerDone);
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerDone, { once: true });
  window.addEventListener('pointercancel', handlePointerDone, { once: true });
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
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerDone);
    window.removeEventListener('pointercancel', handlePointerDone);
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerDone, { once: true });
  window.addEventListener('pointercancel', handlePointerDone, { once: true });
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
  kind: 'tree' | 'dependency';
  connector: DiagramConnectorStyle;
  color: string;
}

interface GanttBar {
  task: VisibleTask;
  x: number;
  y: number;
  width: number;
}

function createGanttLayout(visibleTasks: VisibleTask[], timeline: TimelineUnit[]) {
  const width = timeline.at(-1) ? timeline.at(-1)!.x + timeline.at(-1)!.width : 1200;
  const height = timelineHeaderHeight + visibleTasks.length * taskRowHeight + 40;
  const bars: GanttBar[] = visibleTasks.map((task) => ({
    task,
    x: dateToX(parseDate(task.start), timeline),
    y: timelineHeaderHeight + task.rowIndex * taskRowHeight + 13,
    width: Math.max(24, dateToX(parseDate(task.end), timeline) - dateToX(parseDate(task.start), timeline)),
  }));
  const barByTaskId = new Map(bars.map((bar) => [bar.task.id, bar]));
  const links = bars.flatMap((bar) => bar.task.dependencies.flatMap((dependencyId) => {
    const from = barByTaskId.get(dependencyId);
    if (!from) return [];
    const sx = from.x + from.width;
    const sy = from.y + 13;
    const tx = bar.x;
    const ty = bar.y + 13;
    const mid = Math.max(sx + 20, (sx + tx) / 2);
    return [{ id: `${dependencyId}-${bar.task.id}`, d: `M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}` }];
  }));
  return { width, height, bars, links };
}

function createNetworkLayout(tasks: ScheduleTask[], timeline: TimelineUnit[], view: NetworkView) {
  const width = Math.max(timeline.at(-1) ? timeline.at(-1)!.x + timeline.at(-1)!.width : 1320, 1320);
  const rowGap = view === 'time-network' ? 54 : view === 'adm' ? 64 : 82;
  const height = Math.max(760, timelineHeaderHeight + tasks.length * rowGap + 180);
  const nodes: NetworkNode[] = tasks.map((task, index) => {
    const durationWidth = Math.max(44, dateToX(parseDate(task.end), timeline) - dateToX(parseDate(task.start), timeline));
    const x = view === 'time-network'
      ? dateToX(parseDate(task.start), timeline)
      : 80 + Math.max(0, index % 8) * 180 + Math.floor(index / 8) * 80;
    const y = timelineHeaderHeight + 96 + (view === 'time-network' ? index * rowGap : Math.floor(index / 8) * 170 + (index % 2) * 56);
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

function createNetworkEdges(nodes: NetworkNode[], view: NetworkView): NetworkEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  return nodes.flatMap((node) => node.task.dependencies.flatMap((dependencyId) => {
    const source = nodeById.get(dependencyId);
    if (!source) return [];
    const sx = view === 'time-network' ? source.x + source.width : source.x + 17;
    const sy = source.y;
    const tx = view === 'time-network' ? node.x : node.x - 17;
    const ty = node.y;
    const connector = resolveTaskDiagramStyle(node.task).connector;
    return [{
      id: `${dependencyId}-${node.task.id}`,
      d: connectorPath(sx, sy, tx, ty, connector),
      connector,
      color: taskAccentColor(node.task),
    }];
  }));
}

function applyNetworkNodeOffsets(
  layout: ReturnType<typeof createNetworkLayout>,
  offsets: Record<string, NodeOffset>,
  view: NetworkView,
) {
  if (view === 'time-network') return layout;
  const nodes = layout.nodes.map((node) => {
    const offset = offsets[node.task.id];
    return offset ? { ...node, x: node.x + offset.x, y: node.y + offset.y } : node;
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
    'resource-histogram': 1380,
    'risk-matrix': 1320,
    raci: 1320,
    'value-stream': 1480,
    swot: 1320,
  };
  const heightByView = view === 'mindmap' || view === 'wbs'
    ? Math.max(960, tasks.length * 78)
    : view === 'fishbone'
      ? Math.max(940, tasks.length * 52 + 220)
      : view === 'burndown' || view === 'burnup' || view === 'analysis' || view === 'resource-histogram'
        ? 880
        : Math.max(780, tasks.length * 54 + 180);
  const childrenByParent = new Map<string | null, VisibleTask[]>();
  for (const task of tasks) {
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }

  const nodes = view === 'mindmap' || view === 'wbs'
    ? createMindMapNodes(tasks, childrenByParent)
    : view === 'fishbone'
      ? createFishboneNodes(tasks)
      : view === 'matrix' || view === 'risk-matrix' || view === 'raci' || view === 'swot'
        ? createMatrixDiagramNodes(tasks, view)
        : view === 'burndown' || view === 'burnup' || view === 'analysis' || view === 'resource-histogram' || view === 'value-stream'
          ? createAnalysisDiagramNodes(tasks, view)
          : createFlowchartNodes(tasks);
  return { width: widthByView[view], height: heightByView, nodes, edges: createDiagramEdges(nodes, view) };
}

function createDiagramEdges(nodes: DiagramNode[], view: DiagramView): DiagramEdge[] {
  if (isMatrixDiagramView(view) || isAnalysisDiagramView(view)) return [];
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  const edges: DiagramEdge[] = [];

  for (const node of nodes) {
    if (node.task.parentId) {
      const parent = nodeById.get(node.task.parentId);
      if (parent) {
        edges.push({
          id: `${node.task.parentId}-${node.task.id}`,
          d: diagramEdgePath(parent, node, view, resolveTaskDiagramStyle(node.task).connector),
          kind: 'tree',
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
          d: diagramEdgePath(source, node, view, resolveTaskDiagramStyle(node.task).connector),
          kind: 'dependency',
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
    return offset ? { ...node, x: node.x + offset.x, y: node.y + offset.y } : node;
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
      height: diagramNodeHeight(task, 'flowchart', width),
    };
  });
}

function createMatrixDiagramNodes(tasks: VisibleTask[], view: DiagramView): DiagramNode[] {
  const candidates = tasks.filter((task) => task.level >= 2).slice(0, 18);
  const cellWidth = view === 'raci' ? 292 : 310;
  const cellHeight = 164;
  return candidates.map((task, index) => {
    const riskColumn = task.status === 'delayed' || task.status === 'warning' || task.progress < 20 ? 0 : task.progress >= 70 ? 2 : 1;
    const durationBand = task.duration >= 45 ? 0 : task.duration >= 24 ? 1 : 2;
    const column = view === 'raci' ? index % 4 : view === 'swot' ? index % 2 : riskColumn;
    const row = view === 'raci' ? Math.floor(index / 4) : view === 'swot' ? Math.floor(index / 2) % 2 : durationBand;
    return {
      task,
      x: 110 + column * cellWidth + (index % 2) * 18,
      y: 130 + row * cellHeight + Math.floor(index / (view === 'raci' ? 4 : 6)) * 24,
      width: view === 'raci' ? 250 : 268,
      height: diagramNodeHeight(task, view, view === 'raci' ? 250 : 268),
    };
  });
}

function createAnalysisDiagramNodes(tasks: VisibleTask[], view: DiagramView): DiagramNode[] {
  const leafTasks = tasks.filter((task) => task.level >= 3).slice(0, 14);
  const maxDuration = Math.max(1, ...leafTasks.map((task) => task.duration));
  const maxCost = Math.max(1, ...leafTasks.map((task) => task.budgetAmount ?? task.duration));
  return leafTasks.map((task, index) => {
    const x = 112 + index * 86;
    const progressY = 680 - task.progress * 4.7;
    const durationY = 680 - task.duration / maxDuration * 430;
    const costY = 680 - (task.budgetAmount ?? task.duration) / maxCost * 430;
    const y = view === 'burndown'
      ? 220 + index * 28
      : view === 'resource-histogram'
        ? durationY
        : view === 'value-stream'
          ? 170 + (index % 4) * 118
          : view === 'analysis'
            ? costY
            : progressY;
    const width = view === 'resource-histogram' ? 112 : view === 'value-stream' ? 230 : 174;
    const height = view === 'resource-histogram'
      ? Math.max(74, 690 - y)
      : diagramNodeHeight(task, view, width);
    return {
      task,
      x: view === 'value-stream' ? 120 + index * 132 : x,
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
    nodes.push({ task: issueTask, x: 1120, y: 402, width: 290, height: diagramNodeHeight(issueTask, 'fishbone', 290) });
  }
  causes.forEach((task, index) => {
    const upper = index % 2 === 0;
    const column = Math.floor(index / 2);
    nodes.push({
      task,
      x: 850 - column * 170,
      y: upper ? 120 + (column % 3) * 34 : 600 - (column % 3) * 34,
      width: 250,
      height: diagramNodeHeight(task, 'fishbone', 250),
    });
  });
  return nodes;
}

function isMatrixDiagramView(view: DiagramView): boolean {
  return view === 'matrix' || view === 'risk-matrix' || view === 'raci' || view === 'swot';
}

function isAnalysisDiagramView(view: DiagramView): boolean {
  return view === 'analysis' || view === 'burndown' || view === 'burnup' || view === 'resource-histogram' || view === 'value-stream';
}

function diagramNodeHeight(task: VisibleTask, view: DiagramView, width: number): number {
  const fontSize = resolveTaskDiagramStyle(task).fontSize;
  const usableWidth = Math.max(80, width - 32);
  const charsPerLine = Math.max(7, Math.floor(usableWidth / Math.max(8, fontSize * 0.92)));
  const titleLines = Math.max(1, Math.min(4, Math.ceil(task.name.length / charsPerLine)));
  const detailLines = task.description ? 3 : 2;
  const minimum = view === 'mindmap' || view === 'wbs'
    ? 76
    : view === 'fishbone'
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
  const branchBlocks = branches.map((branch) => Math.max(168, ((childrenByParent.get(branch.id) ?? []).length || 1) * 94 + 44));
  const rootCenterY = 360;
  let cursorY = 100;

  const rootNode: DiagramNode = { task: root, x: 70, y: rootCenterY - 40, width: 286, height: diagramNodeHeight(root, 'mindmap', 286) };
  nodes.push(rootNode);
  nodeById.set(root.id, rootNode);

  branches.forEach((branch, branchIndex) => {
    const blockHeight = branchBlocks[branchIndex] ?? 140;
    const branchY = cursorY + blockHeight / 2 - 31;
    const branchNode: DiagramNode = { task: branch, x: 410, y: branchY, width: 258, height: diagramNodeHeight(branch, 'mindmap', 258) };
    nodes.push(branchNode);
    nodeById.set(branch.id, branchNode);
    placeMindMapChildren(branch, childrenByParent, nodes, nodeById, 710, branchY + 10);
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
    const node: DiagramNode = { task: child, x, y, width: 258, height: diagramNodeHeight(child, 'mindmap', 258) };
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
  return connectorPath(sx, sy, tx, ty, (view === 'mindmap' || view === 'wbs') && connector === 'elbow' ? 'curve' : connector);
}

function connectorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  connector: DiagramConnectorStyle,
): string {
  if (connector === 'straight') return `M ${sx} ${sy} L ${tx} ${ty}`;
  if (connector === 'curve') {
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
  const analysisByTaskId = new Map(networkSchedule.taskAnalyses.map((analysis) => [analysis.taskId, analysis]));
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
      earlyFinish: analysis?.earlyFinishOffset ?? calculateDuration(taskItem.start, taskItem.end),
      lateStart: analysis?.lateStartOffset ?? 0,
      lateFinish: analysis?.lateFinishOffset ?? calculateDuration(taskItem.start, taskItem.end),
      totalFloat: analysis?.totalFloatDays ?? 0,
      freeFloat: analysis?.freeFloatDays ?? 0,
      expectedDuration: analysis?.expectedDurationDays ?? calculateDuration(taskItem.start, taskItem.end),
      critical: analysis?.isCritical ?? false,
      budgetAmount: taskItem.budgetAmount ?? 0,
      actualCostAmount: taskItem.actualCostAmount ?? 0,
      locked: taskItem.locked ?? false,
      diagramStyle: taskItem.diagramStyle,
    };
  });
}

function mapPlanningStatusToScheduleStatus(taskItem: PlanningTask, dataDate: string): ScheduleStatus {
  if (taskItem.status === 'done' || taskItem.progress >= 100) return 'ahead';
  if (taskItem.status === 'blocked') return 'delayed';
  const plannedProgress = deriveTaskPlannedProgress(taskItem, dataDate);
  if (plannedProgress === 0 && taskItem.progress === 0) return 'future';
  const delta = plannedProgress - taskItem.progress;
  if (delta >= 25) return 'delayed';
  if (delta >= 10) return 'warning';
  return 'normal';
}

function mapScheduleStatusToPlanningStatus(status: ScheduleStatus, progress?: number): PlanningTaskStatus {
  if (progress !== undefined && progress >= 100) return 'done';
  if (status === 'delayed') return 'blocked';
  if (status === 'future') return 'todo';
  return 'doing';
}

function schedulePatchToPlanningPatch(patch: Partial<ScheduleTask>): Partial<PlanningTask> {
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
  if (patch.progress !== undefined) next.progress = clampNumber(Math.round(patch.progress), 0, 100);
  if (patch.budgetAmount !== undefined) next.budgetAmount = Math.max(0, Math.round(patch.budgetAmount));
  if (patch.actualCostAmount !== undefined) next.actualCostAmount = Math.max(0, Math.round(patch.actualCostAmount));
  if (patch.locked !== undefined) next.locked = patch.locked;
  if (patch.diagramStyle !== undefined) next.diagramStyle = patch.diagramStyle;
  if (patch.dependencies !== undefined) {
    next.dependencies = patch.dependencies;
    next.dependencyRules = patch.dependencies.map((predecessorId) => ({ predecessorId, type: 'FS', lagDays: 0 }));
  }
  if (patch.parentId !== undefined) next.parentTaskId = patch.parentId;
  if (patch.level !== undefined) next.outlineLevel = patch.level;
  if (patch.expanded !== undefined) next.isExpanded = patch.expanded;
  if (patch.status !== undefined) {
    next.status = mapScheduleStatusToPlanningStatus(patch.status, patch.progress);
  } else if (patch.progress !== undefined) {
    next.status = mapScheduleStatusToPlanningStatus('normal', patch.progress);
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

function createTimeline(scale: ScheduleScale, startValue: string, endValue: string): TimelineUnit[] {
  const width = scaleColumnWidth[scale];
  const units: TimelineUnit[] = [];
  let cursor = parseDate(startValue);
  const endDate = parseDate(endValue);
  let index = 0;
  while (cursor <= endDate) {
    const next = scale === 'month'
      ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      : addDays(cursor, scale === 'week' ? 7 : 1);
    units.push({
      key: `${scale}-${cursor.toISOString()}`,
      label: scale === 'month' ? `${cursor.getFullYear()}年${cursor.getMonth() + 1}月` : String(scale === 'week' ? getWeekNumber(cursor) : cursor.getDate()),
      subLabel: scale === 'day' ? dayName(cursor) : '',
      start: new Date(cursor),
      end: next,
      x: index * width,
      width,
      muted: scale === 'day' ? [0, 6].includes(cursor.getDay()) : index % 2 === 0,
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
  const unit = timeline.find((item) => date >= item.start && date < item.end) ?? last;
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
  const unit = timeline.find((item) => clampedX >= item.x && clampedX < item.x + item.width) ?? last;
  const unitPercent = clampNumber((clampedX - unit.x) / Math.max(1, unit.width), 0, 1);
  const nextTime = unit.start.getTime() + (unit.end.getTime() - unit.start.getTime()) * unitPercent;
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCompactMoney(value: number): string {
  if (!Number.isFinite(value)) return '0';
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

function createNextPlanningTaskIdentity(tasks: PlanningTask[]) {
  const maxIndex = tasks.reduce((max, task) => {
    const numericId = Number(task.id.replace(/^\D+/g, ''));
    const numericCode = Number(task.code.replace(/^\D+/g, ''));
    return Math.max(max, Number.isFinite(numericId) ? numericId : 0, Number.isFinite(numericCode) ? numericCode : 0);
  }, 0);
  const index = maxIndex + 1;
  return {
    id: `task-${index}`,
    code: `T-${String(index).padStart(3, '0')}`,
    index,
  };
}

function clonePlanningTask(task: PlanningTask): PlanningTask {
  const cloned: PlanningTask = {
    ...task,
    dependencies: [...task.dependencies],
  };
  if (task.dependencyRules) {
    cloned.dependencyRules = task.dependencyRules.map((dependency) => ({ ...dependency }));
  }
  if (task.diagramStyle) {
    cloned.diagramStyle = { ...task.diagramStyle };
  }
  return cloned;
}

function isPlanningTaskDescendant(tasks: PlanningTask[], parentTaskId: string, taskId: string): boolean {
  let cursor = tasks.find((task) => task.id === taskId);
  while (cursor?.parentTaskId) {
    if (cursor.parentTaskId === parentTaskId) return true;
    cursor = tasks.find((task) => task.id === cursor?.parentTaskId);
  }
  return false;
}

function adjustPlanningTaskLevel(tasks: PlanningTask[], taskId: string, direction: 'promote' | 'demote'): PlanningTask[] {
  const targetIndex = tasks.findIndex((task) => task.id === taskId);
  const target = tasks[targetIndex];
  if (!target) return tasks;

  if (direction === 'promote') {
    const parent = tasks.find((task) => task.id === target.parentTaskId);
    if (!parent) return tasks;
    return tasks.map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          parentTaskId: parent.parentTaskId ?? null,
          outlineLevel: Math.max(1, (parent.outlineLevel ?? 2)),
        };
      }
      if (isPlanningTaskDescendant(tasks, taskId, task.id)) {
        return { ...task, outlineLevel: Math.max(1, (task.outlineLevel ?? 2) - 1) };
      }
      return task;
    });
  }

  const previous = tasks.slice(0, targetIndex).reverse().find((task) => (task.outlineLevel ?? 2) <= (target.outlineLevel ?? 2));
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
      return { ...task, outlineLevel: Math.min((task.outlineLevel ?? 2) + 1, 6) };
    }
    return task;
  });
}

function collectDescendantIds(tasks: ScheduleTask[], taskId: string): Set<string> {
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
  return view === 'time-network' || view === 'adm' || view === 'pert';
}

function getWeekNumber(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return `第${Math.ceil((diff + start.getDay() + 1) / 7)}周`;
}

function dayName(date: Date): string {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()] ?? '';
}

function taskColor(status: ScheduleStatus): string {
  const colors: Record<ScheduleStatus, string> = {
    normal: '#2f7df6',
    ahead: '#12c86b',
    warning: '#ff9f2e',
    delayed: '#ef4444',
    future: '#9cccf5',
  };
  return colors[status];
}

function taskFill(status: ScheduleStatus): string {
  const colors: Record<ScheduleStatus, string> = {
    normal: '#c8e2fb',
    ahead: '#bdf6cb',
    warning: '#fdecc6',
    delayed: '#ffd9d1',
    future: '#d6ecff',
  };
  return colors[status];
}
