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
import { useMemo, useRef, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import {
  applyPlanningScheduleAdjustment,
  createDefaultProjectPlanningModel,
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
  type PlanningTask,
  type PlanningTaskStatus,
  type ProjectPlanningModel,
} from '@/lib/project-planning-studio';

type ScheduleView = 'gantt' | 'time-network' | 'adm' | 'pert' | 'flowchart' | 'mindmap';
type NetworkView = 'time-network' | 'adm' | 'pert';
type DiagramView = 'flowchart' | 'mindmap';
type ScheduleScale = 'day' | 'week' | 'month';
type ScheduleStatus = 'normal' | 'ahead' | 'warning' | 'delayed' | 'future';
type AddTaskMode = 'child' | 'after';
type GraphEditMode = 'progress' | 'task';
type GanttDragMode = 'move' | 'progress' | 'resize-start' | 'resize-end';
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

interface ScheduleTask {
  id: string;
  code: string;
  parentId: string | null;
  name: string;
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

  function openGraphEditor(taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode = 'task') {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTaskId(taskId);
    const offsetX = mode === 'progress' ? 18 : 12;
    const offsetY = mode === 'progress' ? 38 : 14;
    setGraphEdit({
      taskId,
      mode,
      x: clampNumber(event.clientX + offsetX, 12, window.innerWidth - 300),
      y: clampNumber(event.clientY + offsetY, 12, window.innerHeight - 330),
    });
  }

  function addTask(mode: AddTaskMode = 'after') {
    const selected = selectedTask ?? tasks[0];
    const nextIndex = planModel.tasks.length + 1;
    const nextId = `task-${nextIndex}`;
    const start = mode === 'child' ? selected?.start ?? planRange.start : shiftDate(selected?.end ?? planRange.start, 1);
    const end = shiftDate(start, mode === 'child' ? 14 : 21);
    const next: PlanningTask = {
      id: nextId,
      code: `T-${String(nextIndex).padStart(3, '0')}`,
      title: mode === 'child' ? `新增子任务 ${nextIndex}` : `新增后续任务 ${nextIndex}`,
      wbsId: planModel.tasks.find((task) => task.id === selected?.id)?.wbsId ?? planModel.wbs[0]?.id ?? 'wbs-1',
      owner: selected?.owner ?? '计划工程师',
      start,
      end,
      progress: 0,
      dependencies: mode === 'after' && selected ? [selected.id] : [],
      dependencyRules: mode === 'after' && selected ? [{ predecessorId: selected.id, type: 'FS', lagDays: 0 }] : [],
      parentTaskId: mode === 'child' ? selected?.id ?? 'task-1' : selected?.parentId ?? 'task-1',
      outlineLevel: mode === 'child' ? Math.min((selected?.level ?? 1) + 1, 4) : selected?.level ?? 2,
      isExpanded: false,
      baselineStart: start,
      baselineEnd: end,
      durationOptimistic: Math.max(1, calculateDuration(start, end) - 3),
      durationMostLikely: calculateDuration(start, end),
      durationPessimistic: calculateDuration(start, end) + 5,
      calendarId: selected ? planModel.tasks.find((task) => task.id === selected.id)?.calendarId ?? planModel.calendars[0]?.id ?? 'cal-johor-site' : planModel.calendars[0]?.id ?? 'cal-johor-site',
      resourceDemand: 1,
      budgetAmount: Math.max(0, calculateDuration(start, end) * 5200),
      actualCostAmount: 0,
      approvalRequired: false,
      status: 'todo',
      resourceId: planModel.resources[0]?.id ?? 'res-pm',
      riskId: planModel.risks[0]?.id ?? 'risk-interface',
    };
    setPlanModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (
        mode === 'child' && selected && task.id === selected.id ? { ...task, isExpanded: true } : task
      )).concat(next),
      auditTrail: [
        { id: `feichuan-task-add-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `新增任务 ${next.code}` },
        ...current.auditTrail,
      ],
    }));
    setSelectedTaskId(nextId);
    audit(`新增柔佛进度任务: ${next.title}`);
  }

  function deleteSelectedTask() {
    if (!selectedTask || selectedTask.parentId === null) return;
    const deletedIds = collectDescendantIds(tasks, selectedTask.id);
    const fallback = tasks.find((task) => !deletedIds.has(task.id) && task.id !== selectedTask.id)?.id ?? 'task-1';
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
        { id: `feichuan-task-delete-${Date.now()}`, at: new Date().toISOString(), actor: 'FeichuanPlanningWorkbench', summary: `删除任务 ${selectedTask.name}` },
        ...current.auditTrail,
      ],
    }));
    setSelectedTaskId(fallback);
    setGraphEdit(null);
    audit(`删除进度任务: ${selectedTask.name}`);
  }

  function savePlanningVersion() {
    setPlanModel((current) => createPlanningVersion(current, 'FeichuanPlanningWorkbench', '飞椽计划图表与网络参数在线保存'));
    audit('保存飞椽进度计划版本');
  }

  function exportPlanningPackage() {
    const pack = createPlanningExport(planModel, 'json');
    const blob = new Blob([pack.content], { type: pack.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = pack.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
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
          <Button type="primary" icon={<CloudDownloadOutlined />} onClick={exportPlanningPackage}>导出</Button>
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
        />
      )}
      <GraphInlineEditor
        state={graphEdit}
        task={graphEditTask}
        onClose={() => setGraphEdit(null)}
        onUpdateTask={updateTask}
      />
    </section>
  );
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
                className={`feichuan-task-row ${task.id === selectedTaskId ? 'is-selected' : ''}`}
                onClick={() => onSelectTask(task.id)}
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
                    className={`feichuan-task-bar is-${bar.task.status} ${bar.task.critical ? 'is-critical' : ''}`}
                    style={barStyle}
                    aria-label={`拖动调整任务条：${bar.task.name}`}
                    onClick={() => onSelectTask(bar.task.id)}
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
}: {
  view: NetworkView;
  tasks: ScheduleTask[];
  timeline: TimelineUnit[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
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
              className={`feichuan-task-row ${selectedTask?.id === task.id ? 'is-selected' : ''}`}
              onClick={() => onSelectTask(task.id)}
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
                <path key={edge.id} d={edge.d} fill="none" stroke="#858b92" strokeWidth={1.5} markerEnd="url(#feichuan-network-arrow)" />
              ))}
              {layout.nodes.map((node, index) => {
                const hitbox = networkNodeHitbox(node, view);
                return (
                  <g
                    key={node.task.id}
                    className={`feichuan-network-node ${selectedTask?.id === node.task.id ? 'is-active' : ''} ${node.task.critical ? 'is-critical' : ''}`}
                    onClick={() => onSelectTask(node.task.id)}
                    onContextMenu={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                    onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                    onPointerDown={(event) => {
                      if (view === 'time-network') return;
                      handleCanvasNodePointerDown({
                        event,
                        taskId: node.task.id,
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
                        onContextMenu={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
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

function DiagramPlanner({
  view,
  tasks,
  visibleTasks,
  selectedTask,
  onSelectTask,
  onAddTask,
  onOpenGraphEditor,
}: {
  view: DiagramView;
  tasks: ScheduleTask[];
  visibleTasks: VisibleTask[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onAddTask: (mode?: AddTaskMode) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
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
              className={`feichuan-task-row ${selectedTask?.id === task.id ? 'is-selected' : ''}`}
              onClick={() => onSelectTask(task.id)}
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
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                className={edge.kind === 'dependency' ? 'is-dependency' : ''}
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
                height={node.height}
                style={{ overflow: 'visible' }}
              >
                <button
                  type="button"
                  className={`feichuan-diagram-node is-${node.task.status} ${view === 'mindmap' ? 'is-mindmap' : ''} ${selectedTask?.id === node.task.id ? 'is-active' : ''}`}
                  onClick={() => onSelectTask(node.task.id)}
                  onContextMenu={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                  onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                  onPointerDown={(event) => handleCanvasNodePointerDown({
                    event,
                    taskId: node.task.id,
                    currentOffset: nodeOffsets[node.task.id] ?? { x: 0, y: 0 },
                    onSelectTask,
                    onOffsetChange: updateNodeOffset,
                  })}
                >
                  <strong>{node.task.name}</strong>
                  <small>{node.task.start} - {node.task.end}</small>
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

function TimeNetworkNode({
  node,
  timeline,
  onSelectTask,
  onUpdateTask,
  onOpenGraphEditor,
}: {
  node: NetworkNode;
  timeline: TimelineUnit[];
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
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
          className={`feichuan-task-bar feichuan-network-task-bar is-${node.task.status} ${node.task.critical ? 'is-critical' : ''}`}
          style={barStyle}
          aria-label={`拖动调整时标网络图任务条：${node.task.name}`}
          onClick={() => onSelectTask(node.task.id)}
          onContextMenu={(event) => onOpenGraphEditor(node.task.id, event, 'progress')}
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
        <div className={`feichuan-pert-node is-${node.task.status}`}>
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
  return {
    ...base,
    '--feichuan-progress': `${progress}%`,
    '--feichuan-hatch-left': `${hatchLeft}%`,
    '--feichuan-hatch-width': `${hatchWidth}%`,
  } as CSSProperties;
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
  if (event.button !== 0 || event.detail > 1) return;
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
  currentOffset,
  onSelectTask,
  onOffsetChange,
}: {
  event: ReactPointerEvent<Element>;
  taskId: string;
  currentOffset: NodeOffset;
  onSelectTask: (taskId: string) => void;
  onOffsetChange: (taskId: string, offset: NodeOffset) => void;
}) {
  if (event.button !== 0 || event.detail > 1) return;
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
      color: taskColor(task.status),
      fill: taskFill(task.status),
    };
  });
  const edges = createNetworkEdges(nodes, view);
  return { width, height, nodes, edges };
}

function createNetworkEdges(nodes: NetworkNode[], view: NetworkView) {
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  return nodes.flatMap((node) => node.task.dependencies.flatMap((dependencyId) => {
    const source = nodeById.get(dependencyId);
    if (!source) return [];
    const sx = view === 'time-network' ? source.x + source.width : source.x + 17;
    const sy = source.y;
    const tx = view === 'time-network' ? node.x : node.x - 17;
    const ty = node.y;
    const mid = Math.max(sx + 26, (sx + tx) / 2);
    return [{ id: `${dependencyId}-${node.task.id}`, d: `M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}` }];
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
  const width = view === 'mindmap' ? 1480 : 1280;
  const height = view === 'mindmap' ? Math.max(960, tasks.length * 78) : Math.max(760, tasks.length * 52 + 160);
  const childrenByParent = new Map<string | null, VisibleTask[]>();
  for (const task of tasks) {
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }

  const nodes = view === 'mindmap'
    ? createMindMapNodes(tasks, childrenByParent)
    : createFlowchartNodes(tasks);
  return { width, height, nodes, edges: createDiagramEdges(nodes, view) };
}

function createDiagramEdges(nodes: DiagramNode[], view: DiagramView): DiagramEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  const edges: DiagramEdge[] = [];

  for (const node of nodes) {
    if (node.task.parentId) {
      const parent = nodeById.get(node.task.parentId);
      if (parent) {
        edges.push({
          id: `${node.task.parentId}-${node.task.id}`,
          d: diagramEdgePath(parent, node, view),
          kind: 'tree',
        });
      }
    }
    for (const dependency of node.task.dependencies) {
      const source = nodeById.get(dependency);
      if (source && source.task.id !== node.task.parentId) {
        edges.push({
          id: `${dependency}-${node.task.id}-dependency`,
          d: diagramEdgePath(source, node, view),
          kind: 'dependency',
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
    return {
      task,
      x: 54 + (task.level - 1) * 270,
      y: 72 + index * 86,
      width: task.level === 1 ? 250 : 220,
      height: 58,
    };
  });
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
  const branchBlocks = branches.map((branch) => Math.max(140, ((childrenByParent.get(branch.id) ?? []).length || 1) * 82 + 36));
  const rootCenterY = 360;
  let cursorY = 100;

  const rootNode: DiagramNode = { task: root, x: 70, y: rootCenterY - 34, width: 250, height: 68 };
  nodes.push(rootNode);
  nodeById.set(root.id, rootNode);

  branches.forEach((branch, branchIndex) => {
    const blockHeight = branchBlocks[branchIndex] ?? 140;
    const branchY = cursorY + blockHeight / 2 - 31;
    const branchNode: DiagramNode = { task: branch, x: 390, y: branchY, width: 230, height: 62 };
    nodes.push(branchNode);
    nodeById.set(branch.id, branchNode);
    placeMindMapChildren(branch, childrenByParent, nodes, nodeById, 660, branchY + 8);
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
    const y = centerY + (index - (children.length - 1) / 2) * 74;
    const node: DiagramNode = { task: child, x, y, width: 230, height: 58 };
    nodes.push(node);
    nodeById.set(child.id, node);
    placeMindMapChildren(child, childrenByParent, nodes, nodeById, x + 270, y);
  });
}

function diagramEdgePath(source: DiagramNode, target: DiagramNode, view: DiagramView): string {
  const sx = source.x + source.width;
  const sy = source.y + source.height / 2;
  const tx = target.x;
  const ty = target.y + target.height / 2;
  if (view === 'mindmap') {
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
