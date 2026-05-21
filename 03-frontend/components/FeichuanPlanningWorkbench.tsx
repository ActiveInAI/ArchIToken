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
  PlusOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useMemo, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import {
  applyPlanningScheduleAdjustment,
  createDefaultProjectPlanningModel,
  createPlanningVersion,
  deriveEarnedValueMetrics,
  deriveNetworkSchedule,
  derivePlanningAnalytics,
  derivePlanningStandardsCoverage,
  derivePlanningSummary,
  deriveResourceLoadAnalysis,
  deriveScheduleAlerts,
  deriveTaskPlannedProgress,
  deriveWorkingCalendarMetrics,
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
  const [view, setView] = useState<ScheduleView>('gantt');
  const [scale, setScale] = useState<ScheduleScale>('month');
  const [selectedTaskId, setSelectedTaskId] = useState('task-5');
  const [planRange, setPlanRange] = useState({ start: defaultScheduleStart, end: defaultScheduleEnd });
  const [graphEdit, setGraphEdit] = useState<GraphEditState | null>(null);
  const networkSchedule = useMemo(() => deriveNetworkSchedule(planModel.tasks), [planModel.tasks]);
  const summary = useMemo(() => derivePlanningSummary(planModel), [planModel]);
  const analytics = useMemo(() => derivePlanningAnalytics(planModel), [planModel]);
  const alerts = useMemo(() => deriveScheduleAlerts(planModel), [planModel]);
  const coverage = useMemo(() => derivePlanningStandardsCoverage(planModel), [planModel]);
  const earnedValue = useMemo(() => deriveEarnedValueMetrics(planModel), [planModel]);
  const resourceLoad = useMemo(() => deriveResourceLoadAnalysis(planModel), [planModel]);
  const calendarMetrics = useMemo(() => deriveWorkingCalendarMetrics(planModel), [planModel]);
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
    setGraphEdit({
      taskId,
      mode,
      x: clampNumber(event.clientX + 10, 12, window.innerWidth - 300),
      y: clampNumber(event.clientY + 10, 12, window.innerHeight - 330),
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
          <Button type="primary" icon={<CloudUploadOutlined />}>导入</Button>
          <Button type="primary" icon={<CloudDownloadOutlined />}>导出</Button>
          <Button icon={<SaveOutlined />} onClick={savePlanningVersion}>保存</Button>
        </div>
      </header>

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
        alertCount={alerts.length}
        highAlertCount={alerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length}
        criticalPathLabel={criticalPathLabel}
        coverageGapCount={coverage.filter((item) => item.status === 'gap').length}
        dependencyWarnings={networkSchedule.dependencyWarnings.length}
      />

      {view === 'gantt' ? (
        <GanttPlanner
          tasks={tasks}
          visibleTasks={visibleTasks}
          timeline={timeline}
          dataDate={controlDate}
          selectedTaskId={selectedTaskId}
          selectedTask={selectedTask}
          onAddTask={addTask}
          onSelectTask={setSelectedTaskId}
          onToggleTask={toggleTask}
          onUpdateTask={updateTask}
          onOpenGraphEditor={openGraphEditor}
          onDeleteTask={deleteSelectedTask}
        />
      ) : isNetworkView(view) ? (
        <NetworkPlanner
          view={view}
          tasks={tasks.filter((task) => task.level >= 3)}
          timeline={timeline}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTaskId}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onOpenGraphEditor={openGraphEditor}
          onDeleteTask={deleteSelectedTask}
        />
      ) : (
        <DiagramPlanner
          view={view}
          tasks={tasks}
          visibleTasks={visibleTasks}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTaskId}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onOpenGraphEditor={openGraphEditor}
          onDeleteTask={deleteSelectedTask}
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
  alertCount,
  highAlertCount,
  criticalPathLabel,
  coverageGapCount,
  dependencyWarnings,
}: {
  summary: ReturnType<typeof derivePlanningSummary>;
  analytics: ReturnType<typeof derivePlanningAnalytics>;
  earnedValue: ReturnType<typeof deriveEarnedValueMetrics>;
  resourceLoad: ReturnType<typeof deriveResourceLoadAnalysis>;
  calendarMetrics: ReturnType<typeof deriveWorkingCalendarMetrics>;
  alertCount: number;
  highAlertCount: number;
  criticalPathLabel: string;
  coverageGapCount: number;
  dependencyWarnings: number;
}) {
  return (
    <div className="feichuan-control-strip" aria-label="计划控制指标">
      <span><b>SPI</b>{analytics.schedulePerformanceIndex}</span>
      <span className={earnedValue.status === 'red' ? 'is-danger' : earnedValue.status === 'amber' ? 'is-warning' : ''}><b>CPI</b>{earnedValue.costPerformanceIndex}</span>
      <span><b>计划应达</b>{summary.plannedProgress}%</span>
      <span><b>实际均值</b>{summary.averageProgress}%</span>
      <span><b>PV/EV</b>{formatCompactMoney(earnedValue.plannedValue)} / {formatCompactMoney(earnedValue.earnedValue)}</span>
      <span className={alertCount > 0 ? 'is-warning' : ''}><b>预警</b>{alertCount} 条</span>
      <span className={highAlertCount > 0 ? 'is-danger' : ''}><b>高风险</b>{highAlertCount} 条</span>
      <span><b>预测完成</b>{analytics.forecastFinish}</span>
      <span className={resourceLoad.overloadedBucketCount > 0 ? 'is-warning' : ''}><b>资源峰值</b>{resourceLoad.peakResourceName} {resourceLoad.peakUtilizationPercent}%</span>
      <span><b>工作日历</b>{calendarMetrics.workingDayCount} 工日</span>
      <span className={coverageGapCount > 0 ? 'is-warning' : ''}><b>标准缺口</b>{coverageGapCount} 项</span>
      <span className={dependencyWarnings > 0 ? 'is-warning' : ''}><b>网络校核</b>{dependencyWarnings} 条</span>
      <span className="is-wide"><b>关键路径</b>{criticalPathLabel || '未识别'}</span>
    </div>
  );
}

function GanttPlanner({
  tasks,
  visibleTasks,
  timeline,
  dataDate,
  selectedTaskId,
  selectedTask,
  onAddTask,
  onSelectTask,
  onToggleTask,
  onUpdateTask,
  onOpenGraphEditor,
  onDeleteTask,
}: {
  tasks: ScheduleTask[];
  visibleTasks: VisibleTask[];
  timeline: TimelineUnit[];
  dataDate: Date;
  selectedTaskId: string;
  selectedTask: ScheduleTask | null;
  onAddTask: (mode?: AddTaskMode) => void;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
  onDeleteTask: () => void;
}) {
  const layout = createGanttLayout(visibleTasks, timeline);
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0];

  function updateProgressFromPointer(element: HTMLElement, clientX: number, taskId: string) {
    const rect = element.getBoundingClientRect();
    const progress = clampNumber(Math.round(((clientX - rect.left) / Math.max(1, rect.width)) * 100), 0, 100);
    onUpdateTask(taskId, { progress });
  }

  function handleBarPointerDown(event: ReactPointerEvent<HTMLButtonElement>, task: ScheduleTask) {
    if (event.button !== 0 || event.detail > 1) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectTask(task.id);

    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateProgressFromPointer(element, moveEvent.clientX, task.id);
    };
    const handlePointerDone = () => {
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
        <TaskEditor
          task={selectedTask}
          onAddTask={onAddTask}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
        />
        <div className="feichuan-task-footer">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddTask('after')}>新增后续任务</Button>
          <Button icon={<SettingOutlined />}>设置</Button>
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
            {layout.bars.map((bar) => (
              <div
                key={bar.task.id}
                className={`feichuan-bar-row ${bar.task.id === activeTask?.id ? 'is-active' : ''}`}
                style={{ top: bar.y }}
              >
                <button
                  type="button"
                  className={`feichuan-task-bar is-${bar.task.status} ${bar.task.critical ? 'is-critical' : ''}`}
                  style={{ left: bar.x, width: bar.width }}
                  aria-label={`拖动更新进度：${bar.task.name}`}
                  onClick={() => onSelectTask(bar.task.id)}
                  onPointerDown={(event) => handleBarPointerDown(event, bar.task)}
                  onDoubleClick={(event) => onOpenGraphEditor(bar.task.id, event, 'progress')}
                >
                  <span className="feichuan-bar-progress" style={{ width: `${Math.max(3, bar.task.progress)}%` }} />
                  <span className="feichuan-bar-handle" style={{ left: `${bar.task.progress}%` }} />
                  <span className="feichuan-bar-hatch" />
                  <strong>{bar.task.progress}%</strong>
                  <em>预计任务工期{bar.task.status === 'ahead' ? '提前' : '延后'}七天</em>
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
            ))}
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
  onAddTask,
  onUpdateTask,
  onOpenGraphEditor,
  onDeleteTask,
}: {
  view: NetworkView;
  tasks: ScheduleTask[];
  timeline: TimelineUnit[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onAddTask: (mode?: AddTaskMode) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
  onDeleteTask: () => void;
}) {
  const layout = createNetworkLayout(tasks, timeline, view);

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
        <TaskEditor
          task={selectedTask}
          onAddTask={onAddTask}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
        />
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
                    onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                  >
                    {view === 'time-network' ? (
                      <TimeNetworkNode node={node} />
                    ) : view === 'adm' ? (
                      <AdmNode node={node} index={index} />
                    ) : (
                      <PertNode node={node} index={index} />
                    )}
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
                      onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
                    />
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
        <span>进度 {task.progress}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={task.progress}
          onChange={(event) => onUpdateTask(task.id, { progress: clampNumber(Number(event.target.value), 0, 100) })}
        />
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

function TaskEditor({
  task,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
}: {
  task: ScheduleTask | null;
  onAddTask: (mode?: AddTaskMode) => void;
  onDeleteTask: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
}) {
  if (!task) {
    return <div className="feichuan-task-editor is-empty">未选择任务</div>;
  }

  return (
    <div className="feichuan-task-editor">
      <div className="feichuan-editor-title">
        <strong>任务在线编制</strong>
        <span>{task.id}</span>
      </div>
      <label>
        <span>任务名称</span>
        <input
          value={task.name}
          onChange={(event) => onUpdateTask(task.id, { name: event.target.value })}
        />
      </label>
      <div className="feichuan-editor-grid">
        <label>
          <span>开始</span>
          <input
            type="date"
            value={task.start}
            onChange={(event) => onUpdateTask(task.id, { start: event.target.value })}
          />
        </label>
        <label>
          <span>完成</span>
          <input
            type="date"
            value={task.end}
            onChange={(event) => onUpdateTask(task.id, { end: event.target.value })}
          />
        </label>
      </div>
      <div className="feichuan-editor-grid">
        <label>
          <span>进度 {task.progress}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={task.progress}
            onChange={(event) => onUpdateTask(task.id, { progress: clampNumber(Number(event.target.value), 0, 100) })}
          />
        </label>
        <label>
          <span>状态</span>
          <select
            value={task.status}
            onChange={(event) => onUpdateTask(task.id, { status: event.target.value as ScheduleStatus })}
          >
            {(Object.keys(statusLabels) as ScheduleStatus[]).map((status) => (
              <option key={status} value={status}>{statusLabels[status]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="feichuan-editor-grid">
        <label>
          <span>计划成本</span>
          <input
            type="number"
            min={0}
            value={task.budgetAmount ?? 0}
            onChange={(event) => onUpdateTask(task.id, { budgetAmount: Math.max(0, Number(event.target.value)) })}
          />
        </label>
        <label>
          <span>实际成本</span>
          <input
            type="number"
            min={0}
            value={task.actualCostAmount ?? 0}
            onChange={(event) => onUpdateTask(task.id, { actualCostAmount: Math.max(0, Number(event.target.value)) })}
          />
        </label>
      </div>
      <div className="feichuan-editor-actions">
        <button type="button" onClick={() => onAddTask('child')}>新增子任务</button>
        <button type="button" onClick={() => onAddTask('after')}>新增后续</button>
        <button type="button" disabled={task.parentId === null} onClick={onDeleteTask}>删除</button>
      </div>
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
  onUpdateTask,
  onOpenGraphEditor,
  onDeleteTask,
}: {
  view: DiagramView;
  tasks: ScheduleTask[];
  visibleTasks: VisibleTask[];
  selectedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
  onAddTask: (mode?: AddTaskMode) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onOpenGraphEditor: (taskId: string, event: ReactMouseEvent<Element>, mode: GraphEditMode) => void;
  onDeleteTask: () => void;
}) {
  const layout = createDiagramLayout(visibleTasks, view);

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
        <TaskEditor
          task={selectedTask}
          onAddTask={onAddTask}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
        />
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
              >
                <button
                  type="button"
                  className={`feichuan-diagram-node is-${node.task.status} ${view === 'mindmap' ? 'is-mindmap' : ''} ${selectedTask?.id === node.task.id ? 'is-active' : ''}`}
                  onClick={() => onSelectTask(node.task.id)}
                  onDoubleClick={(event) => onOpenGraphEditor(node.task.id, event, 'task')}
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

function TimeNetworkNode({ node }: { node: NetworkNode }) {
  return (
    <>
      <rect x={node.x} y={node.y - 13} width={node.width} height={26} fill={node.fill} opacity={0.75} />
      <rect x={node.x} y={node.y - 9} width={Math.max(18, node.width * node.task.progress / 100)} height={18} fill={node.color} />
      <rect x={node.x + Math.max(18, node.width * node.task.progress / 100)} y={node.y - 9} width={Math.min(150, node.width * 0.35)} height={18} fill="url(#feichuan-hatch)" opacity={0.8} />
      <text x={node.x + node.width + 12} y={node.y + 4} className="feichuan-svg-label">{node.task.name} {node.task.progress}%</text>
    </>
  );
}

function AdmNode({ node, index }: { node: NetworkNode; index: number }) {
  return (
    <>
      <circle cx={node.x} cy={node.y} r={17} fill="#fff" stroke="#c9ced6" />
      <text x={node.x} y={node.y + 4} textAnchor="middle" className="feichuan-svg-index">{index + 1}</text>
      <text x={node.x + 26} y={node.y - 8} className="feichuan-svg-label">{node.task.name}</text>
      <text x={node.x + 26} y={node.y + 13} className="feichuan-svg-label">{node.task.duration}天</text>
    </>
  );
}

function PertNode({ node, index }: { node: NetworkNode; index: number }) {
  return (
    <>
      <circle cx={node.x} cy={node.y} r={17} fill="#fff" stroke="#c9ced6" />
      <text x={node.x} y={node.y + 4} textAnchor="middle" className="feichuan-svg-index">{index + 1}</text>
      <foreignObject x={node.x + 28} y={node.y - 42} width={150} height={84}>
        <div className="feichuan-pert-node">
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

function createGanttLayout(visibleTasks: VisibleTask[], timeline: TimelineUnit[]) {
  const width = timeline.at(-1) ? timeline.at(-1)!.x + timeline.at(-1)!.width : 1200;
  const height = timelineHeaderHeight + visibleTasks.length * taskRowHeight + 40;
  const bars = visibleTasks.map((task) => ({
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
  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  const edges = nodes.flatMap((node) => node.task.dependencies.flatMap((dependencyId) => {
    const source = nodeById.get(dependencyId);
    if (!source) return [];
    const sx = view === 'time-network' ? source.x + source.width : source.x + 17;
    const sy = source.y;
    const tx = view === 'time-network' ? node.x : node.x - 17;
    const ty = node.y;
    const mid = Math.max(sx + 26, (sx + tx) / 2);
    return [{ id: `${dependencyId}-${node.task.id}`, d: `M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}` }];
  }));
  return { width, height, nodes, edges };
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

  return { width, height, nodes, edges };
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
