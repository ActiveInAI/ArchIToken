// lib/project-planning-studio.ts - Project Planning Studio data model and derivations
// License: Apache-2.0

import type { ModuleId } from './module-registry';

export type PlanningTaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked';
export type PlanningRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PlanningApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'archived';
export type PlanningFeedbackStatus = 'submitted' | 'accepted' | 'needs_review';
export type PlanningAlertSeverity = 'info' | 'warning' | 'high' | 'critical';
export type PlanningAlertCategory = 'schedule' | 'resource' | 'risk' | 'approval' | 'task_status';
export type PlanningAdjustmentStatus = 'draft' | 'applied' | 'pending_approval';
export type PlanningDependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type PlanningCoverageStatus = 'covered' | 'partial' | 'gap';
export type PlanningCalendarExceptionReason = 'public_holiday' | 'weather' | 'permit' | 'logistics' | 'site_shutdown' | 'custom';
export type PlanningEarnedValueStatus = 'green' | 'amber' | 'red';
export type PlanningDiagramFamily =
  | 'schedule'
  | 'flow'
  | 'mind'
  | 'matrix'
  | 'network'
  | 'analytics'
  | 'uml'
  | 'lean'
  | 'quality'
  | 'strategy'
  | 'agile'
  | 'risk';
export type PlanningRenderEngine =
  | 'ant-design'
  | 'ant-design-charts'
  | 'd3-svg'
  | 'antv-g6'
  | 'mermaid'
  | 'bpmn-js'
  | 'simulation-worker';
export type PlanningDiagramNodeKind =
  | 'task'
  | 'milestone'
  | 'wbs'
  | 'resource'
  | 'risk'
  | 'decision'
  | 'approval'
  | 'note';
export type PlanningDiagramEdgeKind = 'dependency' | 'hierarchy' | 'flow' | 'approval' | 'reference';
export type PlanningDiagramExportKind = 'json' | 'svg' | 'drawio' | 'drawnix';

export interface PlanningWbsNode {
  id: string;
  code: string;
  title: string;
  owner: string;
  parentId: string | null;
  deliverable: string;
}

export interface PlanningTask {
  id: string;
  code: string;
  title: string;
  wbsId: string;
  owner: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string[];
  dependencyRules?: PlanningTaskDependency[];
  parentTaskId?: string | null;
  outlineLevel?: number;
  isExpanded?: boolean;
  baselineStart?: string;
  baselineEnd?: string;
  durationOptimistic?: number;
  durationMostLikely?: number;
  durationPessimistic?: number;
  calendarId?: string;
  resourceDemand?: number;
  budgetAmount?: number;
  actualCostAmount?: number;
  qualityGateId?: string;
  procurementPackageId?: string;
  approvalRequired?: boolean;
  status: PlanningTaskStatus;
  resourceId: string;
  riskId: string;
}

export interface PlanningTaskDependency {
  predecessorId: string;
  type: PlanningDependencyType;
  lagDays: number;
}

export interface PlanningMilestone {
  id: string;
  title: string;
  due: string;
  owner: string;
  linkedTaskIds: string[];
  status: 'pending' | 'ready' | 'slipped' | 'passed';
}

export interface PlanningResource {
  id: string;
  name: string;
  type: 'person' | 'team' | 'equipment' | 'cash' | 'material';
  capacity: number;
  unit: string;
}

export interface PlanningCalendarException {
  date: string;
  label: string;
  working: boolean;
  reason: PlanningCalendarExceptionReason;
}

export interface PlanningCalendar {
  id: string;
  name: string;
  timezone: string;
  workingWeekdays: number[];
  workingHoursPerDay: number;
  exceptions: PlanningCalendarException[];
}

export interface PlanningRisk {
  id: string;
  title: string;
  probability: number;
  impact: number;
  level: PlanningRiskLevel;
  owner: string;
  mitigation: string;
}

export interface PlanningRaciEntry {
  workPackageId: string;
  responsible: string;
  accountable: string;
  consulted: string[];
  informed: string[];
}

export interface PlanningProgressFeedback {
  id: string;
  taskId: string;
  reportedAt: string;
  reporter: string;
  progress: number;
  actualStart: string | null;
  actualFinish: string | null;
  note: string;
  evidenceRefs: string[];
  status: PlanningFeedbackStatus;
}

export interface PlanningScheduleAlert {
  id: string;
  category: PlanningAlertCategory;
  severity: PlanningAlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  taskIds: string[];
  evidenceRefs: string[];
}

export interface PlanningScheduleAdjustment {
  id: string;
  createdAt: string;
  actor: string;
  reason: string;
  taskIds: string[];
  shiftDays: number;
  includeSuccessors: boolean;
  status: PlanningAdjustmentStatus;
  summary: string;
}

export interface PlanningDiagramTemplate {
  id: string;
  name: string;
  aliases: string[];
  family: PlanningDiagramFamily;
  engine: PlanningRenderEngine;
  dataObjects: Array<'task' | 'wbs' | 'milestone' | 'resource' | 'risk' | 'raci' | 'approval'>;
  purpose: string;
  openSourceRoute: string;
  approvalGate: string;
}

export interface PlanningDiagram {
  id: string;
  templateId: string;
  title: string;
  family: PlanningDiagramFamily;
  engine: PlanningRenderEngine;
  status: PlanningApprovalStatus;
  objectRefs: string[];
  canvas: PlanningDiagramCanvas;
  revision: number;
  updatedAt: string;
}

export interface PlanningDiagramCanvasNode {
  id: string;
  kind: PlanningDiagramNodeKind;
  label: string;
  objectRef: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}

export interface PlanningDiagramCanvasEdge {
  id: string;
  kind: PlanningDiagramEdgeKind;
  sourceId: string;
  targetId: string;
  label: string;
}

export interface PlanningDiagramCanvas {
  schema: 'architoken.planning_diagram_canvas.v1';
  width: number;
  height: number;
  nodes: PlanningDiagramCanvasNode[];
  edges: PlanningDiagramCanvasEdge[];
}

export interface PlanningVersion {
  id: string;
  version: string;
  status: PlanningApprovalStatus;
  summary: string;
  createdAt: string;
  createdBy: string;
  cdeFileName: string;
}

export interface PlanningAuditEntry {
  id: string;
  at: string;
  actor: string;
  summary: string;
}

export interface ProjectPlanningModel {
  schema: 'architoken.project_planning_studio.v1';
  moduleId: Extract<ModuleId, 'planning_management'>;
  planId: string;
  projectName: string;
  baselineName: string;
  currentVersion: string;
  approvalStatus: PlanningApprovalStatus;
  dataDate: string;
  costBaselineCurrency: string;
  calendars: PlanningCalendar[];
  wbs: PlanningWbsNode[];
  tasks: PlanningTask[];
  milestones: PlanningMilestone[];
  resources: PlanningResource[];
  risks: PlanningRisk[];
  raci: PlanningRaciEntry[];
  progressFeedback: PlanningProgressFeedback[];
  adjustments: PlanningScheduleAdjustment[];
  diagrams: PlanningDiagram[];
  versions: PlanningVersion[];
  auditTrail: PlanningAuditEntry[];
}

export interface PlanningSummary {
  taskCount: number;
  wbsCount: number;
  milestoneCount: number;
  averageProgress: number;
  plannedProgress: number;
  schedulePerformanceIndex: number;
  criticalRiskCount: number;
  blockedTaskCount: number;
  delayedTaskCount: number;
  alertCount: number;
  adjustmentCount: number;
  plannedDurationDays: number;
  criticalPathTaskIds: string[];
}

export interface PlanningNetworkTaskAnalysis {
  taskId: string;
  code: string;
  title: string;
  durationDays: number;
  expectedDurationDays: number;
  standardDeviationDays: number;
  earlyStartOffset: number;
  earlyFinishOffset: number;
  lateStartOffset: number;
  lateFinishOffset: number;
  totalFloatDays: number;
  freeFloatDays: number;
  isCritical: boolean;
  earlyStartDate: string;
  earlyFinishDate: string;
  lateStartDate: string;
  lateFinishDate: string;
}

export interface PlanningNetworkSchedule {
  baseDate: string;
  projectDurationDays: number;
  criticalPathTaskIds: string[];
  taskAnalyses: PlanningNetworkTaskAnalysis[];
  dependencyWarnings: string[];
}

export interface PlanningStandardsCoverageItem {
  id: string;
  framework: 'MOHURD-PM' | 'PMI-PMP' | 'IPMA-IPMP';
  domain: string;
  requirement: string;
  status: PlanningCoverageStatus;
  evidenceRefs: string[];
  gap: string;
}

export interface PlanningAnalytics {
  dataDate: string;
  plannedProgress: number;
  actualProgress: number;
  schedulePerformanceIndex: number;
  delayedTaskCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  blockedTaskCount: number;
  feedbackCount: number;
  alertCount: number;
  adjustmentCount: number;
  forecastFinish: string;
  costPerformanceIndex: number;
  earnedValueStatus: PlanningEarnedValueStatus;
  resourceOverloadCount: number;
  workingDayCount: number;
}

export interface PlanningWorkingCalendarTaskMetric {
  taskId: string;
  workingDays: number;
  calendarDays: number;
  nonWorkingDays: number;
}

export interface PlanningWorkingCalendarMetrics {
  calendarId: string;
  calendarName: string;
  timezone: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  workingDayCount: number;
  nonWorkingDayCount: number;
  weatherRiskDayCount: number;
  taskMetrics: PlanningWorkingCalendarTaskMetric[];
}

export interface PlanningEarnedValueMetrics {
  currency: string;
  budgetAtCompletion: number;
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  scheduleVariance: number;
  costVariance: number;
  schedulePerformanceIndex: number;
  costPerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
  status: PlanningEarnedValueStatus;
}

export interface PlanningResourceLoadBucket {
  resourceId: string;
  resourceName: string;
  bucketStart: string;
  bucketEnd: string;
  plannedWorkDays: number;
  capacityWorkDays: number;
  utilizationPercent: number;
  overloaded: boolean;
  taskIds: string[];
}

export interface PlanningResourceLoadAnalysis {
  scale: 'month';
  overloadedBucketCount: number;
  peakUtilizationPercent: number;
  peakResourceName: string;
  buckets: PlanningResourceLoadBucket[];
}

export interface PlanningExportPackage {
  fileName: string;
  mimeType: string;
  content: string;
}

export interface PlanningDiagramSeedData {
  tasks: readonly PlanningTask[];
  wbs: readonly PlanningWbsNode[];
  milestones: readonly PlanningMilestone[];
  resources: readonly PlanningResource[];
  risks: readonly PlanningRisk[];
  raci: readonly PlanningRaciEntry[];
}

export interface PlanningAiAdvice {
  id: string;
  severity: PlanningRiskLevel;
  title: string;
  recommendation: string;
  evidenceRefs: string[];
}

export interface PlanningProgressFeedbackInput {
  taskId: string;
  reporter: string;
  progress: number;
  reportedAt?: string;
  actualStart?: string | null;
  actualFinish?: string | null;
  note?: string;
  evidenceRefs?: string[];
  status?: PlanningFeedbackStatus;
  taskStatus?: PlanningTaskStatus;
}

export interface PlanningScheduleAdjustmentInput {
  taskIds: string[];
  shiftDays: number;
  reason: string;
  actor: string;
  includeSuccessors?: boolean;
  status?: PlanningAdjustmentStatus;
}

export const planningDiagramTemplates = [
  template('gantt', '甘特图', ['横道图', '甘特-里程碑复合图'], 'schedule', 'd3-svg', ['task', 'milestone', 'resource'], '在线编制任务起止、依赖、进度和里程碑。', 'D3 SVG + Ant Design form/table'),
  template('milestone', '里程碑图', ['节点计划图'], 'schedule', 'd3-svg', ['milestone', 'task'], '管理合同、设计、采购、生产、施工和交付关键节点。', 'D3 time scale'),
  template('wbs', 'WBS 工作分解结构图', ['工作分解结构图', '树状图'], 'mind', 'antv-g6', ['wbs', 'task', 'raci'], '把项目目标拆解为可执行、可验收、可追责的工作包。', 'AntV G6 tree/compactBox route'),
  template('raci', 'RACI 责任分配矩阵', ['责任矩阵图'], 'matrix', 'ant-design', ['wbs', 'raci', 'approval'], '明确 Responsible、Accountable、Consulted、Informed。', 'Ant Design Table'),
  template('kanban', '看板图', ['看板'], 'agile', 'ant-design', ['task'], '按 todo、doing、review、blocked、done 管理计划任务流。', 'Ant Design cards'),
  template('critical-path-network', '关键路径网络图', ['关键路径图', '关键路径网络图', '网络图'], 'network', 'antv-g6', ['task', 'milestone'], '识别影响工期的依赖链和浮时风险。', 'AntV G6 directed graph route'),
  template('pert', 'PERT 图', ['PERT图', '三点估算网络图'], 'network', 'antv-g6', ['task', 'risk'], '承载乐观/最可能/悲观工期和计划不确定性。', 'AntV G6 + simulation worker route'),
  template('resource-histogram', '资源直方图', ['资源负荷图', '资源负载图'], 'analytics', 'ant-design-charts', ['resource', 'task'], '按资源统计任务负载、冲突和峰值。', 'Ant Design Charts / G2 route'),
  template('risk-matrix', '风险矩阵图', ['优先矩阵图'], 'risk', 'd3-svg', ['risk', 'task'], '按概率和影响评估履约风险优先级。', 'D3 SVG scatter matrix'),
  template('burndown', '燃尽图', ['燃尽图'], 'agile', 'ant-design-charts', ['task'], '展示剩余任务量随时间下降趋势。', 'Ant Design Charts line route'),
  template('burnup', '燃起图', ['燃起图'], 'agile', 'ant-design-charts', ['task'], '展示已完成工作量和范围变化。', 'Ant Design Charts area route'),
  template('cumulative-flow', '累积流图', ['CFD'], 'agile', 'ant-design-charts', ['task'], '展示各状态任务堆积和瓶颈。', 'Ant Design Charts stacked area route'),
  template('velocity', '速度图', ['迭代速度图'], 'agile', 'ant-design-charts', ['task'], '展示周期交付能力和预测。', 'Ant Design Charts column route'),
  template('flowchart', '流程图', ['业务流程图'], 'flow', 'antv-g6', ['task', 'approval'], '编制项目审批、变更、交付和归档流程。', 'AntV G6 flow route'),
  template('swimlane-flow', '泳道流程图', ['泳道图'], 'flow', 'antv-g6', ['task', 'raci', 'approval'], '按部门/角色组织跨部门流程责任。', 'AntV G6 lane graph route'),
  template('bpmn', 'BPMN 业务流程建模标注图', ['BPMN'], 'flow', 'bpmn-js', ['task', 'approval'], '表达可执行或可审批的业务流程语义。', 'bpmn-js isolated adapter route'),
  template('mindmap', '思维导图', ['脑图'], 'mind', 'antv-g6', ['wbs', 'risk'], '围绕项目目标、交付物、约束和风险做结构化展开。', 'AntV G6 mindmap route'),
  template('fishbone', '鱼骨图', ['因果图', '石川图'], 'quality', 'antv-g6', ['risk', 'task'], '分析延误、质量、安全和成本问题根因。', 'AntV G6 custom graph route'),
  template('cause-effect-matrix', '因果矩阵图', ['因果矩阵'], 'quality', 'ant-design', ['risk', 'task'], '把原因、影响、证据和责任人矩阵化。', 'Ant Design Table'),
  template('pareto', '帕累托图', ['二八分析图'], 'quality', 'ant-design-charts', ['risk', 'task'], '找出造成主要延期/成本/质量问题的少数关键原因。', 'Ant Design Charts dual-axis route'),
  template('control-chart', '控制图', ['过程控制图'], 'quality', 'ant-design-charts', ['task', 'risk'], '监控进度、质量、成本指标是否失控。', 'Ant Design Charts line route'),
  template('trend', '趋势图', ['折线图', '趋势分析图'], 'analytics', 'ant-design-charts', ['task', 'risk'], '展示进度、成本、风险或资源指标趋势。', 'Ant Design Charts line route'),
  template('scatter', '散点图', ['相关分析图'], 'analytics', 'ant-design-charts', ['risk', 'resource'], '分析风险、资源、进度之间的相关性。', 'Ant Design Charts scatter route'),
  template('funnel', '漏斗图', ['转化漏斗'], 'analytics', 'ant-design-charts', ['approval', 'task'], '展示审批、问题闭环或交付物转化。', 'Ant Design Charts funnel route'),
  template('radar', '雷达图', ['蜘蛛网图'], 'analytics', 'ant-design-charts', ['risk', 'resource'], '比较项目管理能力、风险或资源维度。', 'Ant Design Charts radar route'),
  template('bubble', '气泡图', ['三变量散点图'], 'analytics', 'ant-design-charts', ['risk', 'resource'], '同时表达概率、影响和暴露规模。', 'Ant Design Charts bubble route'),
  template('histogram', '直方图', ['频率分布图'], 'analytics', 'ant-design-charts', ['task', 'resource'], '分析工期、成本或风险分布。', 'Ant Design Charts histogram route'),
  template('pie', '饼图', ['占比图'], 'analytics', 'ant-design-charts', ['task', 'resource'], '展示任务、成本或责任占比。', 'Ant Design Charts pie route'),
  template('column', '柱状图', ['柱形图'], 'analytics', 'ant-design-charts', ['task', 'resource'], '按阶段、资源、风险比较数量或工时。', 'Ant Design Charts column route'),
  template('bar', '条形图', ['横向柱状图'], 'analytics', 'ant-design-charts', ['task', 'resource'], '比较工作包、责任人、风险项。', 'Ant Design Charts bar route'),
  template('waterfall', '瀑布图', ['成本瀑布图'], 'analytics', 'ant-design-charts', ['task', 'resource'], '展示预算、变更、风险准备金和成本变动。', 'Ant Design Charts waterfall route'),
  template('s-curve', 'S 曲线图', ['S曲线图'], 'schedule', 'ant-design-charts', ['task', 'resource'], '展示计划、实际和预测累计进度/成本。', 'Ant Design Charts line route'),
  template('monte-carlo', '蒙特卡洛模拟分布图', ['工期概率分布'], 'risk', 'simulation-worker', ['task', 'risk'], '评估工期和成本的概率分布。', 'Rust/Python simulation worker route'),
  template('ccpm', '关键链项目管理图', ['CCPM'], 'network', 'antv-g6', ['task', 'resource'], '管理资源约束、缓冲和关键链。', 'AntV G6 + schedule worker route'),
  template('value-stream', '价值流图', ['VSM'], 'lean', 'antv-g6', ['task', 'resource'], '识别等待、返工、库存和非增值活动。', 'AntV G6 process route'),
  template('sipoc', 'SIPOC 模型图', ['SIPOC'], 'lean', 'ant-design', ['task', 'resource', 'approval'], '梳理供应方、输入、过程、输出和客户。', 'Ant Design Table + flow route'),
  template('story-map', '故事地图', ['用户故事地图'], 'agile', 'ant-design', ['task', 'wbs'], '按用户旅程和交付批次组织需求。', 'Ant Design cards'),
  template('affinity', '亲和图', ['KJ法'], 'quality', 'antv-g6', ['risk', 'task'], '把问题、需求和风险归类聚合。', 'AntV G6 clustering route'),
  template('interrelationship', '关联图', ['关系图'], 'quality', 'antv-g6', ['risk', 'task'], '识别问题之间的原因和影响关系。', 'AntV G6 graph route'),
  template('matrix-data-analysis', '矩阵数据分析图', ['矩阵图'], 'quality', 'ant-design', ['risk', 'resource'], '用矩阵比较多维指标和对象。', 'Ant Design Table + heatmap route'),
  template('arrow-diagram', '箭条图', ['箭线图'], 'quality', 'antv-g6', ['task'], '表达任务活动顺序和依赖。', 'AntV G6 directed graph route'),
  template('pdpc', '过程决策程序图', ['PDPC'], 'quality', 'antv-g6', ['risk', 'task'], '预演方案、风险、对策和替代路径。', 'AntV G6 tree route'),
  template('force-field', '力场分析图', ['推动阻碍分析'], 'strategy', 'ant-design', ['risk', 'resource'], '分析推动因素和阻碍因素。', 'Ant Design matrix'),
  template('boston-matrix', '波士顿矩阵图', ['BCG矩阵'], 'strategy', 'd3-svg', ['risk', 'resource'], '用于项目组合或资源投入优先级。', 'D3 quadrant'),
  template('swot', 'SWOT 分析矩阵图', ['SWOT'], 'strategy', 'ant-design', ['risk', 'resource'], '分析优势、劣势、机会和威胁。', 'Ant Design matrix'),
  template('logical-architecture', '逻辑架构图', ['架构图'], 'uml', 'antv-g6', ['task', 'approval'], '表达系统、模块和业务逻辑依赖。', 'AntV G6 topology route'),
  template('org-chart', '组织结构图', ['组织图'], 'uml', 'antv-g6', ['raci', 'resource'], '表达项目组织、岗位和授权链。', 'AntV G6 tree route'),
  template('deployment', '部署图', ['部署架构图'], 'uml', 'mermaid', ['approval', 'resource'], '表达系统或现场部署节点。', 'Mermaid deployment/UML route'),
  template('state-machine', '状态机图', ['状态图'], 'uml', 'mermaid', ['task', 'approval'], '表达计划、审批和交付物状态转换。', 'Mermaid state diagram route'),
  template('sequence', '时序图', ['序列图'], 'uml', 'mermaid', ['task', 'approval'], '表达跨模块、跨角色、AI 与系统交互时序。', 'Mermaid sequence route'),
  template('use-case', '用例图', ['用例图'], 'uml', 'mermaid', ['raci', 'approval'], '表达角色和系统能力边界。', 'Mermaid use case route'),
  template('activity', '活动图', ['活动图'], 'uml', 'mermaid', ['task', 'approval'], '表达活动流、判断、并行和汇合。', 'Mermaid activity route'),
  template('class', '类图', ['领域模型图'], 'uml', 'mermaid', ['wbs', 'task'], '表达计划对象、任务、风险、审批等领域关系。', 'Mermaid class diagram route'),
  template('data-flow', '数据流图', ['DFD'], 'flow', 'antv-g6', ['task', 'approval'], '表达模块间数据输入输出和转换。', 'AntV G6 data-flow route'),
] as const satisfies readonly PlanningDiagramTemplate[];

function template(
  id: string,
  name: string,
  aliases: string[],
  family: PlanningDiagramFamily,
  engine: PlanningRenderEngine,
  dataObjects: PlanningDiagramTemplate['dataObjects'],
  purpose: string,
  openSourceRoute: string,
): PlanningDiagramTemplate {
  return {
    id,
    name,
    aliases,
    family,
    engine,
    dataObjects,
    purpose,
    openSourceRoute,
    approvalGate: '保存版本 -> AI/规则校核 -> 审批 -> CDE归档',
  };
}

function task(
  id: string,
  code: string,
  title: string,
  wbsId: string,
  owner: string,
  start: string,
  end: string,
  progress: number,
  dependencies: string[],
  status: PlanningTaskStatus,
  resourceId: string,
  riskId: string,
  parentTaskId: string | null,
  outlineLevel: number,
  isExpanded: boolean,
  durationOptimistic: number,
  durationMostLikely: number,
  durationPessimistic: number,
): PlanningTask {
  const budgetAmount = outlineLevel >= 3 ? estimateTaskBudget(resourceId, durationMostLikely) : 0;
  return {
    id,
    code,
    title,
    wbsId,
    owner,
    start,
    end,
    progress,
    dependencies,
    dependencyRules: dependencies.map((predecessorId) => ({ predecessorId, type: 'FS', lagDays: 0 })),
    parentTaskId,
    outlineLevel,
    isExpanded,
    baselineStart: start,
    baselineEnd: end,
    durationOptimistic,
    durationMostLikely,
    durationPessimistic,
    calendarId: resourceId === 'res-factory' || resourceId === 'res-logistics' ? 'cal-cn-factory-logistics' : 'cal-johor-site',
    resourceDemand: outlineLevel >= 3 ? 1 : 0,
    budgetAmount,
    actualCostAmount: progress > 0 ? estimateActualCost(budgetAmount, progress, status) : 0,
    approvalRequired: outlineLevel <= 2 || progress >= 80,
    status,
    resourceId,
    riskId,
  };
}

function estimateTaskBudget(resourceId: string, durationMostLikely: number): number {
  const dayRateByResource: Record<string, number> = {
    'res-pm': 3600,
    'res-design': 5200,
    'res-factory': 9800,
    'res-logistics': 12500,
    'res-civil': 7200,
    'res-crane': 14500,
    'res-mep': 7600,
    'res-archive': 2800,
  };
  return Math.round((dayRateByResource[resourceId] ?? 5000) * durationMostLikely);
}

function estimateActualCost(budgetAmount: number, progress: number, status: PlanningTaskStatus): number {
  if (budgetAmount <= 0 || progress <= 0) return 0;
  const progressRatio = clampPercent(progress) / 100;
  const statusFactor = status === 'done' ? 1 : status === 'blocked' ? 1.16 : status === 'review' ? 1.08 : 1.04;
  return Math.round(budgetAmount * progressRatio * statusFactor);
}

export function createDefaultProjectPlanningModel(): ProjectPlanningModel {
  const calendars: PlanningCalendar[] = [
    {
      id: 'cal-johor-site',
      name: '柔佛现场六天制施工日历',
      timezone: 'Asia/Kuala_Lumpur',
      workingWeekdays: [1, 2, 3, 4, 5, 6],
      workingHoursPerDay: 8,
      exceptions: [
        { date: '2026-06-20', label: '柔佛现场雨季风险预留', working: false, reason: 'weather' },
        { date: '2026-07-12', label: '吊装窗口天气复核预留', working: false, reason: 'weather' },
        { date: '2026-08-31', label: '业主/地方协调预留日', working: false, reason: 'permit' },
      ],
    },
    {
      id: 'cal-cn-factory-logistics',
      name: '国内预制与海运备货日历',
      timezone: 'Asia/Shanghai',
      workingWeekdays: [1, 2, 3, 4, 5, 6],
      workingHoursPerDay: 8,
      exceptions: [
        { date: '2026-06-18', label: '发运资料复核预留', working: false, reason: 'logistics' },
      ],
    },
  ];
  const wbs: PlanningWbsNode[] = [
    { id: 'wbs-1', code: '1', title: '柔佛重钢结构项目集群总控', owner: '项目负责人', parentId: null, deliverable: 'Project Plan Token / 总控进度基线' },
    { id: 'wbs-1-1', code: '1.1', title: '柔佛场地、法务与合规启动', owner: '项目经理', parentId: 'wbs-1', deliverable: '合规启动包' },
    { id: 'wbs-2', code: '2', title: 'A1 两层重钢结构别墅', owner: '施工经理', parentId: 'wbs-1', deliverable: '两层别墅交付包' },
    { id: 'wbs-2-1', code: '2.1', title: '别墅基础与锚栓', owner: '土建负责人', parentId: 'wbs-2', deliverable: '基础验线与锚栓复核记录' },
    { id: 'wbs-2-2', code: '2.2', title: '别墅重钢深化、预制与安装', owner: '钢构负责人', parentId: 'wbs-2', deliverable: '钢构深化、加工与安装记录' },
    { id: 'wbs-2-3', code: '2.3', title: '别墅围护、屋面、机电内装', owner: '机电内装负责人', parentId: 'wbs-2', deliverable: '样板验收与移交资料' },
    { id: 'wbs-3', code: '3', title: 'B2 轻型钢结构厂房', owner: '厂房项目经理', parentId: 'wbs-1', deliverable: '厂房交付包' },
    { id: 'wbs-4', code: '4', title: 'C3 海滨亭阁与景观连廊', owner: '景观负责人', parentId: 'wbs-1', deliverable: '亭阁与连廊交付包' },
    { id: 'wbs-5', code: '5', title: '集群联调、竣工资料与业主移交', owner: '资料经理', parentId: 'wbs-1', deliverable: '竣工移交档案' },
  ];
  const resources: PlanningResource[] = [
    { id: 'res-pm', name: '项目管理与柔佛合规组', type: 'team', capacity: 6, unit: '人' },
    { id: 'res-design', name: '重钢深化与BIM组', type: 'team', capacity: 8, unit: '人' },
    { id: 'res-factory', name: '国内重钢预制产线', type: 'equipment', capacity: 3, unit: '条' },
    { id: 'res-logistics', name: '海运与清关物流', type: 'team', capacity: 2, unit: '批' },
    { id: 'res-civil', name: '柔佛土建班组', type: 'team', capacity: 4, unit: '班组' },
    { id: 'res-crane', name: '吊装设备与安装班组', type: 'equipment', capacity: 2, unit: '台班' },
    { id: 'res-mep', name: '围护机电内装组', type: 'team', capacity: 5, unit: '班组' },
    { id: 'res-archive', name: '竣工资料与移交组', type: 'team', capacity: 2, unit: '人' },
  ];
  const risks: PlanningRisk[] = [
    { id: 'risk-permit', title: '柔佛地方许可与场地边界不确定', probability: 0.42, impact: 0.78, level: 'high', owner: '项目经理', mitigation: '合规启动阶段冻结红线、临设、运输入口和业主审批口径。' },
    { id: 'risk-steel-supply', title: '重钢深化、预制和海运批次耦合', probability: 0.48, impact: 0.82, level: 'high', owner: '生产经理', mitigation: '按别墅、厂房、亭阁拆批,把加工放行和发运节点纳入关键路径。' },
    { id: 'risk-lifting-window', title: '吊装窗口与雨季天气冲突', probability: 0.38, impact: 0.86, level: 'high', owner: '施工经理', mitigation: '吊装任务设置前置验收、备用台班和天气复核触发点。' },
    { id: 'risk-coastal-corrosion', title: '海滨亭阁防腐与节点验收风险', probability: 0.31, impact: 0.7, level: 'medium', owner: '景观负责人', mitigation: '防腐涂装、节点密封和现场复验并入里程碑资料。' },
    { id: 'risk-interface', title: '多项目并行界面与资料移交延迟', probability: 0.34, impact: 0.74, level: 'medium', owner: '资料经理', mitigation: '每个项目包设置资料冻结日,联调前完成档案缺口清单。' },
  ];
  const tasks: PlanningTask[] = [
    task('task-1', 'T-001', '马来西亚柔佛重钢结构项目集群总进度计划', 'wbs-1', '项目负责人', '2026-05-01', '2026-12-15', 28, [], 'doing', 'res-pm', 'risk-interface', null, 1, true, 219, 229, 244),
    task('task-2', 'T-002', '柔佛场地踏勘与合规启动', 'wbs-1-1', '项目经理', '2026-05-01', '2026-05-07', 100, [], 'done', 'res-pm', 'risk-permit', 'task-1', 2, true, 5, 7, 10),
    task('task-3', 'T-003', 'A1 两层重钢结构别墅', 'wbs-2', '施工经理', '2026-05-08', '2026-08-25', 38, ['task-2'], 'doing', 'res-crane', 'risk-lifting-window', 'task-1', 2, true, 95, 110, 128),
    task('task-4', 'T-004', '别墅基础与锚栓定位', 'wbs-2-1', '土建负责人', '2026-05-08', '2026-05-22', 80, ['task-2'], 'doing', 'res-civil', 'risk-permit', 'task-3', 3, false, 12, 15, 18),
    task('task-5', 'T-005', '重钢柱梁深化与预制下料', 'wbs-2-2', '深化负责人', '2026-05-10', '2026-06-05', 73, ['task-2'], 'doing', 'res-design', 'risk-steel-supply', 'task-3', 3, false, 22, 27, 35),
    task('task-6', 'T-006', '一层钢架安装与楼承板', 'wbs-2-2', '钢构安装负责人', '2026-05-23', '2026-06-10', 5, ['task-4', 'task-5'], 'doing', 'res-crane', 'risk-lifting-window', 'task-3', 3, false, 16, 19, 24),
    task('task-7', 'T-007', '二层钢架、屋架与抗风连接', 'wbs-2-2', '钢构安装负责人', '2026-06-11', '2026-07-12', 0, ['task-6'], 'todo', 'res-crane', 'risk-lifting-window', 'task-3', 3, false, 26, 32, 40),
    task('task-8', 'T-008', '围护、屋面、门窗安装', 'wbs-2-3', '围护负责人', '2026-07-13', '2026-08-10', 0, ['task-7'], 'todo', 'res-mep', 'risk-lifting-window', 'task-3', 3, false, 24, 29, 36),
    task('task-9', 'T-009', '机电内装与业主样板验收', 'wbs-2-3', '机电内装负责人', '2026-08-11', '2026-08-25', 0, ['task-8'], 'todo', 'res-mep', 'risk-interface', 'task-3', 3, false, 12, 15, 20),
    task('task-10', 'T-010', 'B2 轻型钢结构厂房', 'wbs-3', '厂房项目经理', '2026-05-15', '2026-09-15', 22, ['task-2'], 'doing', 'res-factory', 'risk-steel-supply', 'task-1', 2, true, 108, 124, 142),
    task('task-11', 'T-011', '厂房桩基、承台与地坪预留', 'wbs-3', '土建负责人', '2026-05-15', '2026-06-12', 45, ['task-2'], 'doing', 'res-civil', 'risk-permit', 'task-10', 3, false, 24, 29, 36),
    task('task-12', 'T-012', '门式刚架加工与海运备货', 'wbs-3', '生产经理', '2026-05-20', '2026-07-05', 35, ['task-2'], 'doing', 'res-logistics', 'risk-steel-supply', 'task-10', 3, false, 39, 47, 58),
    task('task-13', 'T-013', '厂房钢架吊装与檩条安装', 'wbs-3', '吊装负责人', '2026-07-06', '2026-08-05', 0, ['task-11', 'task-12'], 'todo', 'res-crane', 'risk-lifting-window', 'task-10', 3, false, 26, 31, 40),
    task('task-14', 'T-014', '屋面板、消防管线与设备基础', 'wbs-3', '机电负责人', '2026-08-06', '2026-09-15', 0, ['task-13'], 'todo', 'res-mep', 'risk-interface', 'task-10', 3, false, 34, 41, 52),
    task('task-15', 'T-015', 'C3 海滨亭阁与景观连廊', 'wbs-4', '景观负责人', '2026-06-01', '2026-08-10', 18, ['task-2'], 'todo', 'res-factory', 'risk-coastal-corrosion', 'task-1', 2, true, 58, 71, 86),
    task('task-16', 'T-016', '亭阁基础与木纹钢构深化', 'wbs-4', '景观负责人', '2026-06-01', '2026-06-20', 35, ['task-2'], 'todo', 'res-design', 'risk-coastal-corrosion', 'task-15', 3, false, 16, 20, 26),
    task('task-17', 'T-017', '亭阁钢构安装与防腐涂装', 'wbs-4', '防腐负责人', '2026-06-21', '2026-07-20', 0, ['task-16'], 'todo', 'res-crane', 'risk-coastal-corrosion', 'task-15', 3, false, 24, 30, 38),
    task('task-18', 'T-018', '景观照明、排水与节点验收', 'wbs-4', '景观负责人', '2026-07-21', '2026-08-10', 0, ['task-17'], 'todo', 'res-mep', 'risk-coastal-corrosion', 'task-15', 3, false, 17, 21, 28),
    task('task-19', 'T-019', '集群联调、竣工资料与业主移交', 'wbs-5', '资料经理', '2026-09-16', '2026-12-15', 0, ['task-9', 'task-14', 'task-18'], 'todo', 'res-archive', 'risk-interface', 'task-1', 2, false, 78, 91, 110),
  ];
  const milestones: PlanningMilestone[] = [
    { id: 'ms-1', title: '柔佛场地与合规启动完成', due: '2026-05-07', owner: '项目经理', linkedTaskIds: ['task-2'], status: 'passed' },
    { id: 'ms-2', title: 'A1 别墅基础锚栓复核', due: '2026-05-22', owner: '土建负责人', linkedTaskIds: ['task-4'], status: 'pending' },
    { id: 'ms-3', title: 'A1 重钢加工放行', due: '2026-06-05', owner: '生产经理', linkedTaskIds: ['task-5'], status: 'pending' },
    { id: 'ms-4', title: 'A1 业主样板验收', due: '2026-08-25', owner: '施工经理', linkedTaskIds: ['task-9'], status: 'pending' },
    { id: 'ms-5', title: 'B2 厂房钢架吊装完成', due: '2026-08-05', owner: '厂房项目经理', linkedTaskIds: ['task-13'], status: 'pending' },
    { id: 'ms-6', title: '项目集群竣工移交', due: '2026-12-15', owner: '项目负责人', linkedTaskIds: ['task-19'], status: 'pending' },
  ];
  const raci: PlanningRaciEntry[] = [
    { workPackageId: 'wbs-1-1', responsible: '项目经理', accountable: '项目负责人', consulted: ['柔佛合规顾问', '法务', '业主代表'], informed: ['财务', '资料经理'] },
    { workPackageId: 'wbs-2', responsible: '施工经理', accountable: '项目负责人', consulted: ['深化负责人', '生产经理', '造价工程师'], informed: ['业主代表', '资料经理'] },
    { workPackageId: 'wbs-3', responsible: '厂房项目经理', accountable: '项目负责人', consulted: ['生产经理', '物流经理', '施工经理'], informed: ['财务', '资料经理'] },
    { workPackageId: 'wbs-4', responsible: '景观负责人', accountable: '项目负责人', consulted: ['防腐负责人', '机电负责人'], informed: ['业主代表'] },
    { workPackageId: 'wbs-5', responsible: '资料经理', accountable: '项目负责人', consulted: ['施工经理', '监理/业主代表'], informed: ['财务', '档案管理员'] },
  ];
  const seed = { tasks, wbs, milestones, resources, risks, raci } satisfies PlanningDiagramSeedData;
  const diagrams: PlanningDiagram[] = [
    'gantt',
    'flowchart',
    'mindmap',
    'wbs',
    'raci',
    'critical-path-network',
    'risk-matrix',
    'resource-histogram',
  ].map((templateId) => createDiagramFromTemplate(templateId, seed));
  const createdAt = '2026-05-21T00:00:00.000Z';
  const dataDate = '2026-05-21';
  return {
    schema: 'architoken.project_planning_studio.v1',
    moduleId: 'planning_management',
    planId: 'plan-johor-heavy-steel-cluster-2026',
    projectName: '马来西亚柔佛 1-2 层重钢结构项目集群',
    baselineName: '2026年5月柔佛重钢结构总控进度基线',
    currentVersion: 'v1.0',
    approvalStatus: 'draft',
    dataDate,
    costBaselineCurrency: 'MYR',
    calendars,
    wbs,
    tasks,
    milestones,
    resources,
    risks,
    raci,
    progressFeedback: [
      {
        id: 'feedback-task-2-seed',
        taskId: 'task-2',
        reportedAt: '2026-05-07T18:30:00.000Z',
        reporter: '项目经理',
        progress: 100,
        actualStart: '2026-05-01',
        actualFinish: '2026-05-07',
        note: '柔佛场地踏勘、运输入口和合规启动资料已形成初版清单。',
        evidenceRefs: ['site:johor-survey', 'meeting:2026-05-07'],
        status: 'accepted',
      },
      {
        id: 'feedback-task-4-seed',
        taskId: 'task-4',
        reportedAt: '2026-05-21T17:40:00.000Z',
        reporter: '土建负责人',
        progress: 80,
        actualStart: '2026-05-08',
        actualFinish: null,
        note: 'A1 别墅基础定位完成,锚栓复核待业主和施工经理确认。',
        evidenceRefs: ['task:task-4', 'photo:anchor-bolt-check'],
        status: 'needs_review',
      },
      {
        id: 'feedback-task-5-seed',
        taskId: 'task-5',
        reportedAt: '2026-05-21T18:10:00.000Z',
        reporter: '深化负责人',
        progress: 73,
        actualStart: '2026-05-10',
        actualFinish: null,
        note: '重钢柱梁深化与下料清单已完成主结构部分,连接板详图仍需复核。',
        evidenceRefs: ['task:task-5', 'bom:steel-cutting-a1'],
        status: 'accepted',
      },
    ],
    adjustments: [],
    diagrams,
    versions: [
      {
        id: 'plan-version-v1',
        version: 'v1.0',
        status: 'draft',
        summary: '初始计划基线: 柔佛 1-2 层重钢结构别墅、厂房、亭阁与移交闭环。',
        createdAt,
        createdBy: 'ProjectPlanningStudio',
        cdeFileName: 'johor-heavy-steel-cluster-v1.archiplan.json',
      },
    ],
    auditTrail: [
      {
        id: 'plan-audit-seed',
        at: createdAt,
        actor: 'ProjectPlanningStudio',
        summary: '初始化柔佛重钢结构项目集群计划对象和图表模板库。',
      },
    ],
  };
}

export function createDiagramFromTemplate(templateId: string, seed?: PlanningDiagramSeedData): PlanningDiagram {
  const diagramTemplate = getPlanningDiagramTemplate(templateId);
  const updatedAt = new Date().toISOString();
  return {
    id: `diagram-${diagramTemplate.id}`,
    templateId: diagramTemplate.id,
    title: diagramTemplate.name,
    family: diagramTemplate.family,
    engine: diagramTemplate.engine,
    status: 'draft',
    objectRefs: diagramTemplate.dataObjects.map((object) => `${object}:*`),
    canvas: createPlanningDiagramCanvas(templateId, seed),
    revision: 1,
    updatedAt,
  };
}

export function getPlanningDiagramTemplate(templateId: string): PlanningDiagramTemplate {
  return planningDiagramTemplates.find((templateItem) => templateItem.id === templateId) ?? planningDiagramTemplates[0];
}

export function createPlanningDiagramCanvas(templateId: string, seed?: PlanningDiagramSeedData): PlanningDiagramCanvas {
  const templateItem = getPlanningDiagramTemplate(templateId);
  const tasks = seed?.tasks ?? [];
  const wbs = seed?.wbs ?? [];
  const milestones = seed?.milestones ?? [];
  const resources = seed?.resources ?? [];
  const risks = seed?.risks ?? [];
  const nodes: PlanningDiagramCanvasNode[] = [];
  const edges: PlanningDiagramCanvasEdge[] = [];

  if (templateItem.id === 'gantt') {
    const minStart = minIsoDate(tasks.map((taskItem) => taskItem.start)) ?? '2026-05-20';
    const dayWidth = 28;
    for (const [index, taskItem] of tasks.entries()) {
      const offsetDays = daysBetween(minStart, taskItem.start) - 1;
      const duration = durationDays(taskItem);
      nodes.push(canvasNode(
        `node-${taskItem.id}`,
        taskItem.title,
        'task',
        220 + Math.max(0, offsetDays) * dayWidth,
        84 + index * 58,
        `task:${taskItem.id}`,
        Math.max(72, duration * dayWidth),
        34,
      ));
      for (const dependencyId of taskItem.dependencies) {
        edges.push(canvasEdge(`edge-${dependencyId}-${taskItem.id}`, `node-${dependencyId}`, `node-${taskItem.id}`, 'dependency', 'FS'));
      }
    }
    for (const milestone of milestones) {
      const offsetDays = daysBetween(minStart, milestone.due) - 1;
      nodes.push(canvasNode(
        `node-${milestone.id}`,
        milestone.title,
        'milestone',
        220 + Math.max(0, offsetDays) * dayWidth,
        92 + tasks.length * 58,
        `milestone:${milestone.id}`,
        132,
        32,
      ));
      for (const taskId of milestone.linkedTaskIds) {
        edges.push(canvasEdge(`edge-${taskId}-${milestone.id}`, `node-${taskId}`, `node-${milestone.id}`, 'approval', '里程碑'));
      }
    }
    return fitCanvas(nodes, edges);
  }

  if (templateItem.id === 'resource-histogram') {
    const loads = resources.map((resource) => {
      const load = tasks
        .filter((taskItem) => taskItem.resourceId === resource.id)
        .reduce((sum, taskItem) => sum + durationDays(taskItem), 0);
      return { resource, load };
    });
    const maxLoad = Math.max(1, ...loads.map((item) => item.load));
    for (const [index, item] of loads.entries()) {
      const barHeight = Math.max(28, Math.round(item.load / maxLoad * 260));
      nodes.push(canvasNode(
        `node-${item.resource.id}`,
        `${item.resource.name} ${item.load}天`,
        'resource',
        120 + index * 150,
        380 - barHeight,
        `resource:${item.resource.id}`,
        96,
        barHeight,
      ));
    }
    return fitCanvas(nodes, edges);
  }

  if (templateItem.id === 'wbs' || templateItem.id === 'mindmap' || templateItem.family === 'mind') {
    for (const [index, item] of wbs.entries()) {
      const depth = item.parentId ? 1 : 0;
      nodes.push(canvasNode(`node-${item.id}`, item.title, 'wbs', 64 + depth * 230, 64 + index * 86, `wbs:${item.id}`));
      if (item.parentId) {
        edges.push(canvasEdge(`edge-${item.parentId}-${item.id}`, `node-${item.parentId}`, `node-${item.id}`, 'hierarchy', '分解'));
      }
    }
    return fitCanvas(nodes, edges);
  }

  if (templateItem.id === 'risk-matrix' || templateItem.family === 'risk' || templateItem.family === 'strategy') {
    for (const [index, risk] of risks.entries()) {
      nodes.push(canvasNode(`node-${risk.id}`, risk.title, 'risk', 90 + risk.probability * 620, 380 - risk.impact * 260 + index * 8, `risk:${risk.id}`, 170, 54));
    }
    if (nodes.length === 0) {
      nodes.push(canvasNode('node-risk-seed', '风险项', 'risk', 120, 140, 'risk:*'));
    }
    return fitCanvas(nodes, edges);
  }

  if (templateItem.id === 'resource-histogram' || templateItem.dataObjects.includes('resource')) {
    for (const [index, resource] of resources.entries()) {
      nodes.push(canvasNode(`node-${resource.id}`, resource.name, 'resource', 84 + index * 190, 96 + (index % 2) * 116, `resource:${resource.id}`));
    }
    for (const [index, taskItem] of tasks.entries()) {
      const source = `node-${taskItem.resourceId}`;
      const target = `node-${taskItem.id}`;
      if (!nodes.some((node) => node.id === target)) {
        nodes.push(canvasNode(target, taskItem.title, 'task', 120 + index * 170, 330 + (index % 2) * 92, `task:${taskItem.id}`, 158, 50));
      }
      if (nodes.some((node) => node.id === source)) {
        edges.push(canvasEdge(`edge-${taskItem.resourceId}-${taskItem.id}`, source, target, 'reference', '资源'));
      }
    }
    return fitCanvas(nodes, edges);
  }

  if (templateItem.id === 'raci') {
    for (const [index, entry] of (seed?.raci ?? []).entries()) {
      const wbsItem = wbs.find((item) => item.id === entry.workPackageId);
      nodes.push(canvasNode(`node-raci-${entry.workPackageId}`, `${wbsItem?.code ?? entry.workPackageId} ${entry.responsible}`, 'approval', 96, 72 + index * 96, `raci:${entry.workPackageId}`, 210, 58));
      nodes.push(canvasNode(`node-raci-a-${entry.workPackageId}`, entry.accountable, 'resource', 380, 72 + index * 96, `raci:${entry.workPackageId}:A`, 170, 58));
      edges.push(canvasEdge(`edge-raci-${entry.workPackageId}`, `node-raci-${entry.workPackageId}`, `node-raci-a-${entry.workPackageId}`, 'approval', 'A'));
    }
    return fitCanvas(nodes, edges);
  }

  for (const [index, taskItem] of tasks.entries()) {
    const x = 82 + (index % 3) * 235;
    const y = 76 + Math.floor(index / 3) * 126;
    nodes.push(canvasNode(`node-${taskItem.id}`, taskItem.title, 'task', x, y, `task:${taskItem.id}`));
    for (const dependencyId of taskItem.dependencies) {
      edges.push(canvasEdge(`edge-${dependencyId}-${taskItem.id}`, `node-${dependencyId}`, `node-${taskItem.id}`, templateItem.family === 'network' ? 'dependency' : 'flow', '依赖'));
    }
  }

  for (const [index, milestone] of milestones.entries()) {
    nodes.push(canvasNode(`node-${milestone.id}`, milestone.title, 'milestone', 130 + index * 245, 430, `milestone:${milestone.id}`, 160, 48));
    for (const taskId of milestone.linkedTaskIds) {
      edges.push(canvasEdge(`edge-${taskId}-${milestone.id}`, `node-${taskId}`, `node-${milestone.id}`, 'approval', '里程碑'));
    }
  }

  if (nodes.length === 0) {
    nodes.push(canvasNode('node-start', `${templateItem.name} 起点`, 'task', 120, 120, null));
    nodes.push(canvasNode('node-review', '校核 / 审批', 'approval', 420, 120, null));
    edges.push(canvasEdge('edge-start-review', 'node-start', 'node-review', 'approval', '提交'));
  }

  return fitCanvas(nodes, edges);
}

export function createPlanningDiagramExport(
  model: ProjectPlanningModel,
  diagram: PlanningDiagram,
  kind: PlanningDiagramExportKind,
): PlanningExportPackage {
  const baseName = `${model.planId}-${model.currentVersion}-${diagram.templateId}-r${diagram.revision}`;
  if (kind === 'svg') {
    return {
      fileName: `${baseName}.svg`,
      mimeType: 'image/svg+xml',
      content: planningDiagramToSvg(diagram),
    };
  }
  if (kind === 'drawio') {
    return {
      fileName: `${baseName}.drawio`,
      mimeType: 'application/xml',
      content: planningDiagramToDrawio(diagram),
    };
  }
  if (kind === 'drawnix') {
    return {
      fileName: `${baseName}.drawnix.json`,
      mimeType: 'application/json',
      content: JSON.stringify({
        schema: 'architoken.drawnix_adapter_payload.v1',
        adapter: 'https://github.com/plait-board/drawnix',
        diagram,
      }, null, 2),
    };
  }
  return {
    fileName: `${baseName}.diagram.json`,
    mimeType: 'application/json',
    content: JSON.stringify(diagram, null, 2),
  };
}

export function derivePlanningSummary(model: ProjectPlanningModel): PlanningSummary {
  const analytics = derivePlanningAnalytics(model);
  const averageProgress = model.tasks.length
    ? Math.round(model.tasks.reduce((sum, taskItem) => sum + taskItem.progress, 0) / model.tasks.length)
    : 0;
  const starts = model.tasks.map((taskItem) => Date.parse(taskItem.start));
  const ends = model.tasks.map((taskItem) => Date.parse(taskItem.end));
  const plannedDurationDays = starts.length && ends.length
    ? daysBetween(new Date(Math.min(...starts)).toISOString().slice(0, 10), new Date(Math.max(...ends)).toISOString().slice(0, 10))
    : 0;
  return {
    taskCount: model.tasks.length,
    wbsCount: model.wbs.length,
    milestoneCount: model.milestones.length,
    averageProgress,
    plannedProgress: analytics.plannedProgress,
    schedulePerformanceIndex: analytics.schedulePerformanceIndex,
    criticalRiskCount: model.risks.filter((riskItem) => riskItem.level === 'critical' || riskItem.level === 'high').length,
    blockedTaskCount: model.tasks.filter((taskItem) => taskItem.status === 'blocked').length,
    delayedTaskCount: analytics.delayedTaskCount,
    alertCount: analytics.alertCount,
    adjustmentCount: analytics.adjustmentCount,
    plannedDurationDays,
    criticalPathTaskIds: deriveCriticalPath(model.tasks),
  };
}

export function deriveCriticalPath(tasks: PlanningTask[]): string[] {
  return deriveNetworkSchedule(tasks).criticalPathTaskIds;
}

export function deriveNetworkSchedule(tasks: readonly PlanningTask[]): PlanningNetworkSchedule {
  const activityTasks = getSchedulableTasks(tasks);
  const baseDate = minIsoDate(activityTasks.map((taskItem) => taskItem.start)) ?? '2026-05-01';
  const warnings: string[] = [];
  const byId = new Map(activityTasks.map((taskItem) => [taskItem.id, taskItem]));
  const incoming = new Map<string, PlanningTaskDependency[]>();
  const successors = new Map<string, Array<{ taskId: string; rule: PlanningTaskDependency }>>();
  const indegree = new Map(activityTasks.map((taskItem) => [taskItem.id, 0]));

  for (const taskItem of activityTasks) {
    const rules = dependencyRulesForTask(taskItem).filter((rule) => {
      if (byId.has(rule.predecessorId)) return true;
      if (tasks.some((candidate) => candidate.id === rule.predecessorId)) {
        warnings.push(`${taskItem.code} 依赖的是汇总任务 ${rule.predecessorId},网络计算已忽略。`);
      } else {
        warnings.push(`${taskItem.code} 依赖不存在: ${rule.predecessorId}`);
      }
      return false;
    });
    incoming.set(taskItem.id, rules);
    indegree.set(taskItem.id, rules.length);
    for (const rule of rules) {
      const list = successors.get(rule.predecessorId) ?? [];
      list.push({ taskId: taskItem.id, rule });
      successors.set(rule.predecessorId, list);
    }
  }

  const queue = activityTasks.filter((taskItem) => (indegree.get(taskItem.id) ?? 0) === 0).map((taskItem) => taskItem.id);
  const orderedIds: string[] = [];
  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId) continue;
    orderedIds.push(taskId);
    for (const successor of successors.get(taskId) ?? []) {
      const nextIndegree = (indegree.get(successor.taskId) ?? 0) - 1;
      indegree.set(successor.taskId, nextIndegree);
      if (nextIndegree === 0) queue.push(successor.taskId);
    }
  }

  if (orderedIds.length !== activityTasks.length) {
    warnings.push('网络计划存在循环依赖或无法排序的任务,已按原任务顺序补齐计算。');
    for (const taskItem of activityTasks) {
      if (!orderedIds.includes(taskItem.id)) orderedIds.push(taskItem.id);
    }
  }

  const analyses = new Map<string, PlanningNetworkTaskAnalysis>();

  for (const taskId of orderedIds) {
    const taskItem = byId.get(taskId);
    if (!taskItem) continue;
    const duration = durationDays(taskItem);
    let earlyStartOffset = Math.max(0, daysBetween(baseDate, taskItem.start) - 1);
    for (const rule of incoming.get(taskId) ?? []) {
      const predecessor = analyses.get(rule.predecessorId);
      if (!predecessor) continue;
      earlyStartOffset = Math.max(earlyStartOffset, earlyStartOffsetFromDependency(predecessor, duration, rule));
    }
    const earlyFinishOffset = earlyStartOffset + duration;
    const expectedDuration = expectedDurationDays(taskItem, duration);
    analyses.set(taskId, {
      taskId,
      code: taskItem.code,
      title: taskItem.title,
      durationDays: duration,
      expectedDurationDays: expectedDuration,
      standardDeviationDays: pertStandardDeviationDays(taskItem),
      earlyStartOffset,
      earlyFinishOffset,
      lateStartOffset: 0,
      lateFinishOffset: 0,
      totalFloatDays: 0,
      freeFloatDays: 0,
      isCritical: false,
      earlyStartDate: shiftIsoDate(baseDate, earlyStartOffset),
      earlyFinishDate: shiftIsoDate(baseDate, earlyFinishOffset - 1),
      lateStartDate: shiftIsoDate(baseDate, earlyStartOffset),
      lateFinishDate: shiftIsoDate(baseDate, earlyFinishOffset - 1),
    });
  }

  const projectDurationDays = Math.max(0, ...[...analyses.values()].map((analysis) => analysis.earlyFinishOffset));

  for (const taskId of [...orderedIds].reverse()) {
    const taskItem = byId.get(taskId);
    const current = analyses.get(taskId);
    if (!taskItem || !current) continue;
    const successorRules = successors.get(taskId) ?? [];
    let lateFinishOffset = projectDurationDays;
    if (successorRules.length > 0) {
      lateFinishOffset = Math.min(
        ...successorRules.map((successor) => {
          const successorAnalysis = analyses.get(successor.taskId);
          if (!successorAnalysis) return projectDurationDays;
          return lateFinishFromDependency(current.durationDays, successorAnalysis, successor.rule);
        }),
      );
    }
    const lateStartOffset = lateFinishOffset - current.durationDays;
    const totalFloatDays = Math.max(0, lateStartOffset - current.earlyStartOffset);
    const freeFloatDays = Math.max(0, freeFloatForTask(current, successorRules, analyses));
    analyses.set(taskId, {
      ...current,
      lateStartOffset,
      lateFinishOffset,
      totalFloatDays,
      freeFloatDays,
      isCritical: totalFloatDays === 0,
      lateStartDate: shiftIsoDate(baseDate, lateStartOffset),
      lateFinishDate: shiftIsoDate(baseDate, lateFinishOffset - 1),
    });
  }

  const taskAnalyses = orderedIds
    .map((taskId) => analyses.get(taskId))
    .filter((analysis): analysis is PlanningNetworkTaskAnalysis => Boolean(analysis));

  return {
    baseDate,
    projectDurationDays,
    criticalPathTaskIds: taskAnalyses.filter((analysis) => analysis.isCritical).map((analysis) => analysis.taskId),
    taskAnalyses,
    dependencyWarnings: warnings,
  };
}

export function derivePlanningStandardsCoverage(model: ProjectPlanningModel): PlanningStandardsCoverageItem[] {
  const network = deriveNetworkSchedule(model.tasks);
  const alerts = deriveScheduleAlerts(model);
  const earnedValue = deriveEarnedValueMetrics(model);
  const calendar = deriveWorkingCalendarMetrics(model);
  const resourceLoad = deriveResourceLoadAnalysis(model);
  const hasWbs = model.wbs.length > 0 && model.tasks.every((taskItem) => Boolean(taskItem.wbsId));
  const hasFeedbackLoop = model.progressFeedback.length > 0 && model.adjustments.length > 0;
  const hasThreePoint = model.tasks.some((taskItem) => (
    Number.isFinite(taskItem.durationOptimistic) &&
    Number.isFinite(taskItem.durationMostLikely) &&
    Number.isFinite(taskItem.durationPessimistic)
  ));
  const hasRaci = model.raci.length > 0;
  const hasRisk = model.risks.length > 0 && alerts.some((alert) => alert.category === 'risk');
  const hasEarnedValue = earnedValue.budgetAtCompletion > 0 && earnedValue.actualCost >= 0;
  const hasCalendar = calendar.workingDayCount > 0 && model.calendars.length > 0;
  const hasResourceTimePhase = resourceLoad.buckets.length > 0;

  return [
    coverage('mohurd-schedule-system', 'MOHURD-PM', '施工进度管理', '项目进度计划系统、控制性计划和实施性计划应形成基线与反馈闭环。', model.tasks.length > 0 && model.milestones.length > 0 ? 'partial' : 'gap', ['tasks:*', 'milestones:*'], '仍需接入项目合同、施工组织设计和审批归档证据。'),
    coverage('mohurd-flow-network', 'MOHURD-PM', '流水施工与网络计划', '应支持流水施工参数、网络计划时间参数、关键线路和计划调整。', network.taskAnalyses.length > 0 ? 'partial' : 'gap', ['network:critical-path', ...network.criticalPathTaskIds], '流水段、施工过程、节拍、步距和专业流水参数尚未结构化。'),
    coverage('mohurd-progress-control', 'MOHURD-PM', '进度控制', '应支持实际进度反馈、偏差分析、预警、纠偏和审批调整。', hasFeedbackLoop ? 'covered' : model.progressFeedback.length > 0 || alerts.length > 0 ? 'partial' : 'gap', ['feedback:*', 'alerts:*', 'adjustments:*'], '调整记录需要形成审批、责任人、证据和归档链。'),
    coverage('mohurd-calendar-resource', 'MOHURD-PM', '资源与施工日历控制', '进度计划应结合资源、工作日历、施工窗口和现场制约进行检查。', hasCalendar && hasResourceTimePhase ? 'partial' : 'gap', ['calendar:*', 'resource-load:*'], '资源调平、流水节拍和现场约束仍需审批化。'),
    coverage('mohurd-contract-quality-safety', 'MOHURD-PM', '合同、质量、安全联动', '进度计划应与合同节点、质量验收、安全专项方案和绿色施工要求联动。', 'gap', ['contract:missing', 'quality:missing', 'safety:missing'], '当前计划模型尚未接入合同条款、质量检验批、安全专项方案和绿色施工证据。'),
    coverage('pmp-process', 'PMI-PMP', 'Process / 过程', '应覆盖范围、进度、成本、质量、资源、沟通、风险、采购、干系人和变更控制。', hasWbs && hasRisk && hasRaci ? 'partial' : 'gap', ['wbs:*', 'risk:*', 'raci:*'], '成本、采购、质量、沟通和干系人闭环尚未与本计划模型打通。'),
    coverage('pmp-earned-value', 'PMI-PMP', 'Process / 挣值与绩效', '应基于计划值、挣值、实际成本和偏差指标进行进度/成本绩效控制。', hasEarnedValue ? 'partial' : 'gap', ['ev:pv', 'ev:ev', 'ev:ac'], '仍需接入真实合同预算、采购发票、付款和变更签证。'),
    coverage('pmp-people', 'PMI-PMP', 'People / 人员', '应体现团队、冲突、授权、沟通、协作和领导力责任边界。', hasRaci ? 'partial' : 'gap', ['raci:*', 'resources:*'], '团队能力、沟通计划、冲突处理和绩效反馈仍需结构化。'),
    coverage('pmp-business', 'PMI-PMP', 'Business Environment / 商业环境', '应体现合规、价值交付、组织变更和项目收益。', model.risks.some((riskItem) => riskItem.id.includes('permit')) ? 'partial' : 'gap', ['risk:permit', 'baseline:project-plan'], '商业价值、收益管理、合同约束和组织过程资产仍需单独建模。'),
    coverage('ipma-practice', 'IPMA-IPMP', 'Practice / 实务能力', '应覆盖目标、范围、时间、组织、质量、资源、采购、计划控制、风险和变更。', network.taskAnalyses.length > 0 && hasThreePoint ? 'partial' : 'gap', ['network:time-parameters', 'pert:three-point'], '质量、采购、变更和合同约束需要接入模块间证据。'),
    coverage('ipma-people-perspective', 'IPMA-IPMP', 'People + Perspective / 人员与环境能力', '应体现责任、沟通、干系人、治理、合规、文化和组织战略。', hasRaci ? 'partial' : 'gap', ['raci:*', 'audit:*'], '治理、文化、战略一致性和干系人满意度尚未形成可量化数据。'),
  ];
}

export function deriveWorkingCalendarMetrics(model: ProjectPlanningModel): PlanningWorkingCalendarMetrics {
  const projectCalendar = model.calendars[0] ?? defaultPlanningCalendar();
  const taskRangeStart = minIsoDate(model.tasks.map((taskItem) => taskItem.start)) ?? model.dataDate;
  const taskRangeEnd = maxIsoDate(model.tasks.map((taskItem) => taskItem.end)) ?? model.dataDate;
  const workingDayCount = countWorkingDays(taskRangeStart, taskRangeEnd, projectCalendar);
  const calendarDayCount = daysBetween(taskRangeStart, taskRangeEnd);
  const taskMetrics = getSchedulableTasks(model.tasks).map((taskItem) => {
    const calendar = calendarForTask(model, taskItem);
    const calendarDays = daysBetween(taskItem.start, taskItem.end);
    const workingDays = countWorkingDays(taskItem.start, taskItem.end, calendar);
    return {
      taskId: taskItem.id,
      workingDays,
      calendarDays,
      nonWorkingDays: Math.max(0, calendarDays - workingDays),
    };
  });

  return {
    calendarId: projectCalendar.id,
    calendarName: projectCalendar.name,
    timezone: projectCalendar.timezone,
    dateRangeStart: taskRangeStart,
    dateRangeEnd: taskRangeEnd,
    workingDayCount,
    nonWorkingDayCount: Math.max(0, calendarDayCount - workingDayCount),
    weatherRiskDayCount: projectCalendar.exceptions.filter((exception) => !exception.working && exception.reason === 'weather').length,
    taskMetrics,
  };
}

export function deriveEarnedValueMetrics(model: ProjectPlanningModel): PlanningEarnedValueMetrics {
  const leafTasks = getSchedulableTasks(model.tasks);
  const budgetAtCompletion = money(leafTasks.reduce((sum, taskItem) => sum + (taskItem.budgetAmount ?? 0), 0));
  const plannedValue = money(leafTasks.reduce((sum, taskItem) => {
    const plannedProgress = deriveTaskPlannedProgressWithCalendar(taskItem, model.dataDate, calendarForTask(model, taskItem));
    return sum + (taskItem.budgetAmount ?? 0) * plannedProgress / 100;
  }, 0));
  const earnedValue = money(leafTasks.reduce((sum, taskItem) => sum + (taskItem.budgetAmount ?? 0) * taskItem.progress / 100, 0));
  const actualCost = money(leafTasks.reduce((sum, taskItem) => sum + (
    taskItem.actualCostAmount ?? estimateActualCost(taskItem.budgetAmount ?? 0, taskItem.progress, taskItem.status)
  ), 0));
  const schedulePerformanceIndex = plannedValue > 0 ? ratio(earnedValue, plannedValue) : 1;
  const costPerformanceIndex = actualCost > 0 ? ratio(earnedValue, actualCost) : 1;
  const estimateAtCompletion = costPerformanceIndex > 0 ? money(budgetAtCompletion / costPerformanceIndex) : budgetAtCompletion;
  const estimateToComplete = money(Math.max(0, estimateAtCompletion - actualCost));
  const status: PlanningEarnedValueStatus = schedulePerformanceIndex < 0.9 || costPerformanceIndex < 0.9
    ? 'red'
    : schedulePerformanceIndex < 1 || costPerformanceIndex < 1
      ? 'amber'
      : 'green';

  return {
    currency: model.costBaselineCurrency,
    budgetAtCompletion,
    plannedValue,
    earnedValue,
    actualCost,
    scheduleVariance: money(earnedValue - plannedValue),
    costVariance: money(earnedValue - actualCost),
    schedulePerformanceIndex,
    costPerformanceIndex,
    estimateAtCompletion,
    estimateToComplete,
    varianceAtCompletion: money(budgetAtCompletion - estimateAtCompletion),
    status,
  };
}

export function deriveResourceLoadAnalysis(model: ProjectPlanningModel): PlanningResourceLoadAnalysis {
  const leafTasks = getSchedulableTasks(model.tasks);
  const start = minIsoDate(leafTasks.map((taskItem) => taskItem.start)) ?? model.dataDate;
  const end = maxIsoDate(leafTasks.map((taskItem) => taskItem.end)) ?? model.dataDate;
  const monthBuckets = createMonthBuckets(start, end);
  const buckets: PlanningResourceLoadBucket[] = [];

  for (const resource of model.resources) {
    const resourceTasks = leafTasks.filter((taskItem) => taskItem.resourceId === resource.id);
    for (const bucket of monthBuckets) {
      const taskLoads = resourceTasks.map((taskItem) => {
        const overlap = overlapIsoRange(taskItem.start, taskItem.end, bucket.start, bucket.end);
        if (!overlap) return { taskId: taskItem.id, workDays: 0 };
        const calendar = calendarForTask(model, taskItem);
        return {
          taskId: taskItem.id,
          workDays: countWorkingDays(overlap.start, overlap.end, calendar) * (taskItem.resourceDemand ?? 1),
        };
      }).filter((item) => item.workDays > 0);
      const plannedWorkDays = roundOne(taskLoads.reduce((sum, item) => sum + item.workDays, 0));
      const calendar = model.calendars[0] ?? defaultPlanningCalendar();
      const capacityWorkDays = roundOne(countWorkingDays(bucket.start, bucket.end, calendar) * resource.capacity);
      const utilizationPercent = capacityWorkDays > 0 ? Math.round(plannedWorkDays / capacityWorkDays * 100) : 0;
      buckets.push({
        resourceId: resource.id,
        resourceName: resource.name,
        bucketStart: bucket.start,
        bucketEnd: bucket.end,
        plannedWorkDays,
        capacityWorkDays,
        utilizationPercent,
        overloaded: utilizationPercent > 100,
        taskIds: taskLoads.map((item) => item.taskId),
      });
    }
  }

  const peak = buckets.reduce<PlanningResourceLoadBucket | null>((current, bucket) => (
    !current || bucket.utilizationPercent > current.utilizationPercent ? bucket : current
  ), null);

  return {
    scale: 'month',
    overloadedBucketCount: buckets.filter((bucket) => bucket.overloaded).length,
    peakUtilizationPercent: peak?.utilizationPercent ?? 0,
    peakResourceName: peak?.resourceName ?? '未识别',
    buckets,
  };
}

export function deriveResourceHistogram(model: ProjectPlanningModel): Array<{ resourceId: string; name: string; load: number; capacity: number }> {
  return model.resources.map((resource) => {
    const load = model.tasks
      .filter((taskItem) => taskItem.resourceId === resource.id)
      .reduce((sum, taskItem) => sum + daysBetween(taskItem.start, taskItem.end), 0);
    return {
      resourceId: resource.id,
      name: resource.name,
      load,
      capacity: resource.capacity,
    };
  });
}

export function deriveKanbanColumns(model: ProjectPlanningModel): Record<PlanningTaskStatus, PlanningTask[]> {
  return {
    todo: model.tasks.filter((taskItem) => taskItem.status === 'todo'),
    doing: model.tasks.filter((taskItem) => taskItem.status === 'doing'),
    review: model.tasks.filter((taskItem) => taskItem.status === 'review'),
    done: model.tasks.filter((taskItem) => taskItem.status === 'done'),
    blocked: model.tasks.filter((taskItem) => taskItem.status === 'blocked'),
  };
}

export function deriveRiskMatrix(model: ProjectPlanningModel): Array<PlanningRisk & { exposure: number }> {
  return model.risks.map((riskItem) => ({
    ...riskItem,
    exposure: Number((riskItem.probability * riskItem.impact).toFixed(3)),
  }));
}

export function deriveTaskPlannedProgress(taskItem: PlanningTask, dataDate: string): number {
  const dataTime = Date.parse(`${dataDate}T00:00:00Z`);
  const startTime = Date.parse(`${taskItem.start}T00:00:00Z`);
  const endTime = Date.parse(`${taskItem.end}T00:00:00Z`);
  if (!Number.isFinite(dataTime) || !Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 0;
  }
  if (dataTime < startTime) return 0;
  if (dataTime >= endTime) return 100;
  const elapsedDays = Math.max(1, Math.round((dataTime - startTime) / 86_400_000) + 1);
  return clampPercent(Math.round(elapsedDays / durationDays(taskItem) * 100));
}

export function deriveScheduleAlerts(model: ProjectPlanningModel): PlanningScheduleAlert[] {
  const alerts: PlanningScheduleAlert[] = [];
  const dataTime = Date.parse(`${model.dataDate}T00:00:00Z`);

  for (const taskItem of model.tasks) {
    const plannedProgress = deriveTaskPlannedProgress(taskItem, model.dataDate);
    const progressDelta = plannedProgress - taskItem.progress;
    const endTime = Date.parse(`${taskItem.end}T00:00:00Z`);
    const daysToFinish = Number.isFinite(dataTime) && Number.isFinite(endTime)
      ? Math.round((endTime - dataTime) / 86_400_000)
      : 0;

    if (taskItem.status === 'blocked') {
      alerts.push({
        id: `alert-blocked-${taskItem.id}`,
        category: 'task_status',
        severity: 'critical',
        title: `${taskItem.code} 已阻断`,
        message: `${taskItem.title} 处于阻断状态,需要责任人提交解除措施。`,
        recommendation: '创建阻断解除事务,同步影响到里程碑、资源和下游模块。',
        taskIds: [taskItem.id],
        evidenceRefs: [`task:${taskItem.id}`, `risk:${taskItem.riskId}`],
      });
    }

    if (progressDelta >= 25) {
      alerts.push({
        id: `alert-progress-${taskItem.id}`,
        category: 'schedule',
        severity: progressDelta >= 45 ? 'high' : 'warning',
        title: `${taskItem.code} 进度落后 ${progressDelta}%`,
        message: `截至 ${model.dataDate},计划应完成 ${plannedProgress}%,实际反馈为 ${taskItem.progress}%。`,
        recommendation: '触发进度反馈复核,必要时调整后续任务窗口并提交审批。',
        taskIds: [taskItem.id],
        evidenceRefs: [`task:${taskItem.id}`, `feedback:${taskItem.id}`],
      });
    }

    if (Number.isFinite(dataTime) && Number.isFinite(endTime) && dataTime > endTime && taskItem.progress < 100) {
      alerts.push({
        id: `alert-overdue-${taskItem.id}`,
        category: 'schedule',
        severity: 'high',
        title: `${taskItem.code} 已逾期`,
        message: `${taskItem.title} 计划完成日为 ${taskItem.end},当前进度 ${taskItem.progress}%。`,
        recommendation: '生成赶工或顺延调整方案,并评估关键路径、资源和审批影响。',
        taskIds: [taskItem.id],
        evidenceRefs: [`task:${taskItem.id}`, 'baseline:schedule'],
      });
    }

    if (daysToFinish >= 0 && daysToFinish <= 3 && taskItem.progress < 80 && taskItem.status !== 'done') {
      alerts.push({
        id: `alert-due-soon-${taskItem.id}`,
        category: 'schedule',
        severity: 'warning',
        title: `${taskItem.code} 临近完成窗口`,
        message: `${taskItem.title} 距计划完成还有 ${daysToFinish} 天,实际进度低于 80%。`,
        recommendation: '要求负责人补交当日反馈和剩余工作量说明。',
        taskIds: [taskItem.id],
        evidenceRefs: [`task:${taskItem.id}`],
      });
    }
  }

  for (const milestone of model.milestones) {
    const dueTime = Date.parse(`${milestone.due}T00:00:00Z`);
    if (Number.isFinite(dataTime) && Number.isFinite(dueTime) && dataTime > dueTime && milestone.status !== 'passed') {
      alerts.push({
        id: `alert-milestone-${milestone.id}`,
        category: 'approval',
        severity: milestone.status === 'slipped' ? 'high' : 'warning',
        title: `${milestone.title} 里程碑未闭合`,
        message: `里程碑计划日期 ${milestone.due},当前状态 ${milestone.status}。`,
        recommendation: '核对关联任务完成度,补齐审批或生成里程碑顺延记录。',
        taskIds: milestone.linkedTaskIds,
        evidenceRefs: [`milestone:${milestone.id}`, ...milestone.linkedTaskIds.map((taskId) => `task:${taskId}`)],
      });
    }
  }

  for (const resource of deriveResourceLoadAnalysis(model).buckets.filter((bucket) => bucket.overloaded)) {
    if (resource.plannedWorkDays > 0) {
      alerts.push({
        id: `alert-resource-${resource.resourceId}-${resource.bucketStart}`,
        category: 'resource',
        severity: resource.utilizationPercent >= 130 ? 'high' : 'warning',
        title: `${resource.resourceName} 资源负荷超阈值`,
        message: `${resource.bucketStart} 至 ${resource.bucketEnd} 计划负荷 ${resource.plannedWorkDays} 工日,容量 ${resource.capacityWorkDays} 工日,利用率 ${resource.utilizationPercent}%。`,
        recommendation: '调平任务窗口、增补资源或拆分工作包。',
        taskIds: resource.taskIds,
        evidenceRefs: [`resource:${resource.resourceId}`, `calendar:${resource.bucketStart}`],
      });
    }
  }

  for (const riskItem of deriveRiskMatrix(model)) {
    if (riskItem.exposure >= 0.36) {
      alerts.push({
        id: `alert-risk-${riskItem.id}`,
        category: 'risk',
        severity: riskItem.level === 'critical' ? 'critical' : 'high',
        title: `${riskItem.title} 风险暴露偏高`,
        message: `概率 ${Math.round(riskItem.probability * 100)}%,影响 ${Math.round(riskItem.impact * 100)}%,暴露值 ${riskItem.exposure}。`,
        recommendation: riskItem.mitigation,
        taskIds: model.tasks.filter((taskItem) => taskItem.riskId === riskItem.id).map((taskItem) => taskItem.id),
        evidenceRefs: [`risk:${riskItem.id}`],
      });
    }
  }

  return alerts;
}

export function derivePlanningAnalytics(model: ProjectPlanningModel): PlanningAnalytics {
  const alerts = deriveScheduleAlerts(model);
  const earnedValue = deriveEarnedValueMetrics(model);
  const resourceLoad = deriveResourceLoadAnalysis(model);
  const calendar = deriveWorkingCalendarMetrics(model);
  const plannedProgress = model.tasks.length
    ? Math.round(model.tasks.reduce((sum, taskItem) => sum + deriveTaskPlannedProgressWithCalendar(taskItem, model.dataDate, calendarForTask(model, taskItem)), 0) / model.tasks.length)
    : 0;
  const actualProgress = model.tasks.length
    ? Math.round(model.tasks.reduce((sum, taskItem) => sum + taskItem.progress, 0) / model.tasks.length)
    : 0;
  const dataTime = Date.parse(`${model.dataDate}T00:00:00Z`);
  const delayedTaskCount = model.tasks.filter((taskItem) => deriveTaskPlannedProgress(taskItem, model.dataDate) - taskItem.progress >= 25).length;
  const overdueTaskCount = model.tasks.filter((taskItem) => {
    const endTime = Date.parse(`${taskItem.end}T00:00:00Z`);
    return Number.isFinite(dataTime) && Number.isFinite(endTime) && dataTime > endTime && taskItem.progress < 100;
  }).length;
  const dueSoonTaskCount = model.tasks.filter((taskItem) => {
    const endTime = Date.parse(`${taskItem.end}T00:00:00Z`);
    if (!Number.isFinite(dataTime) || !Number.isFinite(endTime)) return false;
    const daysToFinish = Math.round((endTime - dataTime) / 86_400_000);
    return daysToFinish >= 0 && daysToFinish <= 3 && taskItem.status !== 'done';
  }).length;
  const latestFinish = maxIsoDate(model.tasks.map((taskItem) => taskItem.end)) ?? model.dataDate;
  const forecastSlipDays = Math.max(0, overdueTaskCount + delayedTaskCount - model.adjustments.length);

  return {
    dataDate: model.dataDate,
    plannedProgress,
    actualProgress,
    schedulePerformanceIndex: plannedProgress > 0 ? Number((actualProgress / plannedProgress).toFixed(2)) : 1,
    delayedTaskCount,
    overdueTaskCount,
    dueSoonTaskCount,
    blockedTaskCount: model.tasks.filter((taskItem) => taskItem.status === 'blocked').length,
    feedbackCount: model.progressFeedback.length,
    alertCount: alerts.length,
    adjustmentCount: model.adjustments.length,
    forecastFinish: shiftIsoDate(latestFinish, forecastSlipDays),
    costPerformanceIndex: earnedValue.costPerformanceIndex,
    earnedValueStatus: earnedValue.status,
    resourceOverloadCount: resourceLoad.overloadedBucketCount,
    workingDayCount: calendar.workingDayCount,
  };
}

export function recordPlanningProgressFeedback(
  model: ProjectPlanningModel,
  input: PlanningProgressFeedbackInput,
): ProjectPlanningModel {
  const taskItem = model.tasks.find((task) => task.id === input.taskId);
  if (!taskItem) return model;
  const reportedAt = input.reportedAt ?? new Date().toISOString();
  const progress = clampPercent(input.progress);
  const nextTaskStatus = input.taskStatus ?? (
    progress >= 100 ? 'done' : taskItem.status === 'todo' ? 'doing' : taskItem.status
  );
  const feedback: PlanningProgressFeedback = {
    id: `feedback-${input.taskId}-${Date.now()}`,
    taskId: input.taskId,
    reportedAt,
    reporter: input.reporter,
    progress,
    actualStart: input.actualStart ?? (taskItem.progress > 0 || progress > 0 ? taskItem.start : null),
    actualFinish: input.actualFinish ?? (progress >= 100 ? reportedAt.slice(0, 10) : null),
    note: input.note ?? '会话内进度反馈。',
    evidenceRefs: input.evidenceRefs ?? [`task:${input.taskId}`],
    status: input.status ?? (progress >= deriveTaskPlannedProgress(taskItem, model.dataDate) ? 'accepted' : 'needs_review'),
  };

  return {
    ...model,
    tasks: model.tasks.map((task) => (task.id === input.taskId
      ? { ...task, progress, status: nextTaskStatus }
      : task)),
    progressFeedback: [feedback, ...model.progressFeedback],
    auditTrail: [
      {
        id: `plan-feedback-${Date.now()}`,
        at: reportedAt,
        actor: input.reporter,
        summary: `登记 ${taskItem.code} 进度反馈: ${progress}% · ${feedback.status}`,
      },
      ...model.auditTrail,
    ],
  };
}

export function applyPlanningScheduleAdjustment(
  model: ProjectPlanningModel,
  input: PlanningScheduleAdjustmentInput,
): ProjectPlanningModel {
  const includeSuccessors = input.includeSuccessors ?? true;
  const affectedTaskIds = includeSuccessors
    ? collectSuccessorTaskIds(model.tasks, input.taskIds)
    : [...new Set(input.taskIds)];
  if (affectedTaskIds.length === 0 || input.shiftDays === 0) {
    return model;
  }
  const createdAt = new Date().toISOString();
  const adjustment: PlanningScheduleAdjustment = {
    id: `adjustment-${Date.now()}`,
    createdAt,
    actor: input.actor,
    reason: input.reason,
    taskIds: affectedTaskIds,
    shiftDays: input.shiftDays,
    includeSuccessors,
    status: input.status ?? 'applied',
    summary: `${input.shiftDays > 0 ? '顺延' : '提前'} ${Math.abs(input.shiftDays)} 天,影响 ${affectedTaskIds.length} 个任务。`,
  };

  return {
    ...model,
    tasks: model.tasks.map((taskItem) => (affectedTaskIds.includes(taskItem.id)
      ? {
          ...taskItem,
          start: shiftIsoDate(taskItem.start, input.shiftDays),
          end: shiftIsoDate(taskItem.end, input.shiftDays),
          status: taskItem.status === 'done' ? taskItem.status : 'review',
        }
      : taskItem)),
    milestones: model.milestones.map((milestone) => (
      milestone.linkedTaskIds.some((taskId) => affectedTaskIds.includes(taskId))
        ? { ...milestone, due: shiftIsoDate(milestone.due, input.shiftDays), status: 'slipped' }
        : milestone
    )),
    adjustments: [adjustment, ...model.adjustments],
    auditTrail: [
      {
        id: `plan-adjustment-${Date.now()}`,
        at: createdAt,
        actor: input.actor,
        summary: `计划调整: ${adjustment.summary} 原因: ${input.reason}`,
      },
      ...model.auditTrail,
    ],
  };
}

export function createPlanningVersion(
  model: ProjectPlanningModel,
  actor: string,
  summary: string,
): ProjectPlanningModel {
  const nextVersion = `v1.${model.versions.length}`;
  const createdAt = new Date().toISOString();
  const version: PlanningVersion = {
    id: `plan-version-${nextVersion.replace('.', '-')}`,
    version: nextVersion,
    status: 'draft',
    summary,
    createdAt,
    createdBy: actor,
    cdeFileName: `project-planning-studio-${nextVersion}.archiplan.json`,
  };
  return {
    ...model,
    currentVersion: nextVersion,
    approvalStatus: 'draft',
    versions: [version, ...model.versions],
    auditTrail: [
      {
        id: `plan-audit-${Date.now()}`,
        at: createdAt,
        actor,
        summary: `保存计划版本 ${nextVersion}: ${summary}`,
      },
      ...model.auditTrail,
    ],
  };
}

export function requestPlanningApproval(model: ProjectPlanningModel, actor: string): ProjectPlanningModel {
  const at = new Date().toISOString();
  return {
    ...model,
    approvalStatus: 'pending_approval',
    versions: model.versions.map((version, index) => (index === 0 ? { ...version, status: 'pending_approval' } : version)),
    auditTrail: [
      { id: `plan-approval-${Date.now()}`, at, actor, summary: `提交 ${model.currentVersion} 进入审批。` },
      ...model.auditTrail,
    ],
  };
}

export function approveAndArchivePlanningVersion(model: ProjectPlanningModel, actor: string): ProjectPlanningModel {
  const at = new Date().toISOString();
  return {
    ...model,
    approvalStatus: 'archived',
    versions: model.versions.map((version, index) => (index === 0 ? { ...version, status: 'archived' } : version)),
    diagrams: model.diagrams.map((diagram) => ({ ...diagram, status: 'archived', updatedAt: at })),
    auditTrail: [
      { id: `plan-archive-${Date.now()}`, at, actor, summary: `审批通过并归档 ${model.currentVersion}。` },
      ...model.auditTrail,
    ],
  };
}

export function runPlanningAiAdvisor(model: ProjectPlanningModel): PlanningAiAdvice[] {
  const criticalPath = deriveCriticalPath(model.tasks);
  const overloaded = deriveResourceLoadAnalysis(model).buckets.filter((resource) => resource.overloaded);
  const highRisks = deriveRiskMatrix(model).filter((riskItem) => riskItem.exposure >= 0.28);

  const advice: PlanningAiAdvice[] = [
    {
      id: 'ai-critical-path',
      severity: criticalPath.length > 3 ? 'high' : 'medium',
      title: '关键路径需要审批前锁定',
      recommendation: `当前关键路径包含 ${criticalPath.length} 个任务,建议在审批前冻结依赖和里程碑。`,
      evidenceRefs: criticalPath,
    },
    ...overloaded.map((resource) => ({
      id: `ai-resource-${resource.resourceId}`,
      severity: 'medium' as const,
      title: `${resource.resourceName} 资源负荷偏高`,
      recommendation: `${resource.bucketStart} 至 ${resource.bucketEnd} 利用率 ${resource.utilizationPercent}%,建议调平资源或调整任务窗口。`,
      evidenceRefs: [resource.resourceId, ...resource.taskIds],
    })),
    ...highRisks.map((riskItem) => ({
      id: `ai-risk-${riskItem.id}`,
      severity: riskItem.level,
      title: `${riskItem.title} 暴露值偏高`,
      recommendation: riskItem.mitigation,
      evidenceRefs: [riskItem.id],
    })),
  ];

  return advice.slice(0, 6);
}

export function createPlanningExport(model: ProjectPlanningModel, kind: 'json' | 'csv' | 'mermaid'): PlanningExportPackage {
  if (kind === 'json') {
    return {
      fileName: `${model.planId}-${model.currentVersion}.archiplan.json`,
      mimeType: 'application/json',
      content: JSON.stringify(model, null, 2),
    };
  }
  if (kind === 'mermaid') {
    return {
      fileName: `${model.planId}-${model.currentVersion}.mmd`,
      mimeType: 'text/plain',
      content: toMermaidGantt(model),
    };
  }
  return {
    fileName: `${model.planId}-${model.currentVersion}-tasks.csv`,
    mimeType: 'text/csv',
    content: [
      'code,title,wbs,owner,start,end,progress,status,budget,actual_cost,calendar,dependencies',
      ...model.tasks.map((taskItem) => [
        taskItem.code,
        taskItem.title,
        model.wbs.find((wbsItem) => wbsItem.id === taskItem.wbsId)?.code ?? taskItem.wbsId,
        taskItem.owner,
        taskItem.start,
        taskItem.end,
        taskItem.progress,
        taskItem.status,
        taskItem.budgetAmount ?? 0,
        taskItem.actualCostAmount ?? 0,
        taskItem.calendarId ?? '',
        taskItem.dependencies.join('|'),
      ].map(csvCell).join(',')),
    ].join('\n'),
  };
}

export function toMermaidGantt(model: ProjectPlanningModel): string {
  const rows = model.tasks.map((taskItem) => {
    const dependency = taskItem.dependencies[0] ? ` after ${taskItem.dependencies[0]}` : '';
    const status = taskItem.status === 'done' ? 'done' : taskItem.status === 'blocked' ? 'crit' : 'active';
    return `    ${taskItem.title} :${status}, ${taskItem.id}, ${taskItem.start}, ${durationDays(taskItem)}d${dependency}`;
  });
  return ['gantt', `    title ${model.projectName} · ${model.currentVersion}`, '    dateFormat YYYY-MM-DD', ...rows].join('\n');
}

function canvasNode(
  id: string,
  label: string,
  kind: PlanningDiagramNodeKind,
  x: number,
  y: number,
  objectRef: string | null,
  width = 180,
  height = 56,
): PlanningDiagramCanvasNode {
  const palette = nodePalette(kind);
  return {
    id,
    kind,
    label,
    objectRef,
    x,
    y,
    width,
    height,
    fill: palette.fill,
    stroke: palette.stroke,
  };
}

function canvasEdge(
  id: string,
  sourceId: string,
  targetId: string,
  kind: PlanningDiagramEdgeKind,
  label: string,
): PlanningDiagramCanvasEdge {
  return { id, sourceId, targetId, kind, label };
}

function fitCanvas(
  nodes: PlanningDiagramCanvasNode[],
  edges: PlanningDiagramCanvasEdge[],
): PlanningDiagramCanvas {
  const width = Math.max(980, ...nodes.map((node) => node.x + node.width + 96));
  const height = Math.max(620, ...nodes.map((node) => node.y + node.height + 96));
  return {
    schema: 'architoken.planning_diagram_canvas.v1',
    width,
    height,
    nodes,
    edges: edges.filter((edge) => (
      nodes.some((node) => node.id === edge.sourceId) &&
      nodes.some((node) => node.id === edge.targetId)
    )),
  };
}

function nodePalette(kind: PlanningDiagramNodeKind): { fill: string; stroke: string } {
  const colors: Record<PlanningDiagramNodeKind, { fill: string; stroke: string }> = {
    task: { fill: '#dbeafe', stroke: '#4285f4' },
    milestone: { fill: '#fef3c7', stroke: '#f4b400' },
    wbs: { fill: '#dcfce7', stroke: '#0f9d58' },
    resource: { fill: '#cffafe', stroke: '#00acc1' },
    risk: { fill: '#fee2e2', stroke: '#db4437' },
    decision: { fill: '#f3e8ff', stroke: '#a142f4' },
    approval: { fill: '#ffedd5', stroke: '#f4511e' },
    note: { fill: '#f3f4f6', stroke: '#6b7280' },
  };
  return colors[kind];
}

function planningDiagramToSvg(diagram: PlanningDiagram): string {
  const edgeMarkup = diagram.canvas.edges.map((edge) => {
    const source = diagram.canvas.nodes.find((node) => node.id === edge.sourceId);
    const target = diagram.canvas.nodes.find((node) => node.id === edge.targetId);
    if (!source || !target) return '';
    const sx = source.x + source.width;
    const sy = source.y + source.height / 2;
    const tx = target.x;
    const ty = target.y + target.height / 2;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    return `<path d="M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}" fill="none" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)" /><text x="${mx}" y="${my - 6}" font-size="11" fill="#64748b">${escapeXml(edge.label)}</text>`;
  }).join('\n');
  const nodeMarkup = diagram.canvas.nodes.map((node) => (
    `<g data-node-id="${escapeXml(node.id)}"><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="${node.fill}" stroke="${node.stroke}" stroke-width="1.5" /><text x="${node.x + 12}" y="${node.y + 23}" font-size="12" font-family="sans-serif" fill="#111827">${escapeXml(node.label)}</text><text x="${node.x + 12}" y="${node.y + 42}" font-size="10" font-family="monospace" fill="#64748b">${escapeXml(node.objectRef ?? node.kind)}</text></g>`
  )).join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diagram.canvas.width}" height="${diagram.canvas.height}" viewBox="0 0 ${diagram.canvas.width} ${diagram.canvas.height}">`,
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#64748b" /></marker></defs>',
    `<rect width="100%" height="100%" fill="#f8fafc" />`,
    edgeMarkup,
    nodeMarkup,
    '</svg>',
  ].join('\n');
}

function planningDiagramToDrawio(diagram: PlanningDiagram): string {
  const cells = [
    '<mxCell id="0" />',
    '<mxCell id="1" parent="0" />',
    ...diagram.canvas.nodes.map((node) => (
      `<mxCell id="${escapeXml(node.id)}" value="${escapeXml(node.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${escapeXml(node.fill)};strokeColor=${escapeXml(node.stroke)};" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry" /></mxCell>`
    )),
    ...diagram.canvas.edges.map((edge) => (
      `<mxCell id="${escapeXml(edge.id)}" value="${escapeXml(edge.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;" edge="1" parent="1" source="${escapeXml(edge.sourceId)}" target="${escapeXml(edge.targetId)}"><mxGeometry relative="1" as="geometry" /></mxCell>`
    )),
  ].join('');
  return [
    '<mxfile host="ArchIToken" agent="ProjectPlanningStudio">',
    `<diagram id="${escapeXml(diagram.id)}" name="${escapeXml(diagram.title)}">`,
    `<mxGraphModel dx="${diagram.canvas.width}" dy="${diagram.canvas.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${diagram.canvas.width}" pageHeight="${diagram.canvas.height}" math="0" shadow="0"><root>${cells}</root></mxGraphModel>`,
    '</diagram>',
    '</mxfile>',
  ].join('');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function coverage(
  id: string,
  framework: PlanningStandardsCoverageItem['framework'],
  domain: string,
  requirement: string,
  status: PlanningCoverageStatus,
  evidenceRefs: string[],
  gap: string,
): PlanningStandardsCoverageItem {
  return { id, framework, domain, requirement, status, evidenceRefs, gap };
}

function getSchedulableTasks(tasks: readonly PlanningTask[]): PlanningTask[] {
  const summaryTaskIds = new Set(tasks.map((taskItem) => taskItem.parentTaskId).filter((id): id is string => Boolean(id)));
  const leafTasks = tasks.filter((taskItem) => !summaryTaskIds.has(taskItem.id));
  return leafTasks.length > 0 ? leafTasks : [...tasks];
}

function dependencyRulesForTask(taskItem: PlanningTask): PlanningTaskDependency[] {
  const rules = taskItem.dependencyRules?.length
    ? taskItem.dependencyRules
    : taskItem.dependencies.map((predecessorId) => ({ predecessorId, type: 'FS' as const, lagDays: 0 }));
  return rules.map((rule) => ({
    predecessorId: rule.predecessorId,
    type: rule.type ?? 'FS',
    lagDays: Number.isFinite(rule.lagDays) ? rule.lagDays : 0,
  }));
}

function earlyStartOffsetFromDependency(
  predecessor: PlanningNetworkTaskAnalysis,
  duration: number,
  rule: PlanningTaskDependency,
): number {
  const lag = rule.lagDays;
  if (rule.type === 'SS') return predecessor.earlyStartOffset + lag;
  if (rule.type === 'FF') return predecessor.earlyFinishOffset + lag - duration;
  if (rule.type === 'SF') return predecessor.earlyStartOffset + lag - duration;
  return predecessor.earlyFinishOffset + lag;
}

function lateFinishFromDependency(
  predecessorDuration: number,
  successor: PlanningNetworkTaskAnalysis,
  rule: PlanningTaskDependency,
): number {
  const lag = rule.lagDays;
  if (rule.type === 'SS') return successor.lateStartOffset - lag + predecessorDuration;
  if (rule.type === 'FF') return successor.lateFinishOffset - lag;
  if (rule.type === 'SF') return successor.lateFinishOffset - lag + predecessorDuration;
  return successor.lateStartOffset - lag;
}

function freeFloatForTask(
  taskItem: PlanningNetworkTaskAnalysis,
  successorRules: Array<{ taskId: string; rule: PlanningTaskDependency }>,
  analyses: Map<string, PlanningNetworkTaskAnalysis>,
): number {
  if (successorRules.length === 0) return 0;
  const candidates = successorRules.map((successor) => {
    const successorAnalysis = analyses.get(successor.taskId);
    if (!successorAnalysis) return 0;
    const lag = successor.rule.lagDays;
    if (successor.rule.type === 'SS') {
      return successorAnalysis.earlyStartOffset - lag - taskItem.earlyStartOffset;
    }
    if (successor.rule.type === 'FF') {
      return successorAnalysis.earlyFinishOffset - lag - taskItem.earlyFinishOffset;
    }
    if (successor.rule.type === 'SF') {
      return successorAnalysis.earlyFinishOffset - lag - taskItem.earlyStartOffset;
    }
    return successorAnalysis.earlyStartOffset - lag - taskItem.earlyFinishOffset;
  });
  return Math.min(...candidates);
}

function expectedDurationDays(taskItem: PlanningTask, fallbackDuration: number): number {
  const optimistic = taskItem.durationOptimistic;
  const mostLikely = taskItem.durationMostLikely;
  const pessimistic = taskItem.durationPessimistic;
  if (![optimistic, mostLikely, pessimistic].every((value) => Number.isFinite(value))) {
    return fallbackDuration;
  }
  return Number(((optimistic! + 4 * mostLikely! + pessimistic!) / 6).toFixed(1));
}

function pertStandardDeviationDays(taskItem: PlanningTask): number {
  const optimistic = taskItem.durationOptimistic;
  const pessimistic = taskItem.durationPessimistic;
  if (!Number.isFinite(optimistic) || !Number.isFinite(pessimistic)) return 0;
  return Number(((pessimistic! - optimistic!) / 6).toFixed(2));
}

function deriveTaskPlannedProgressWithCalendar(taskItem: PlanningTask, dataDate: string, calendar: PlanningCalendar): number {
  if (compareIsoDate(dataDate, taskItem.start) < 0) return 0;
  if (compareIsoDate(dataDate, taskItem.end) >= 0) return 100;
  const elapsedWorkingDays = countWorkingDays(taskItem.start, dataDate, calendar);
  const taskWorkingDays = Math.max(1, countWorkingDays(taskItem.start, taskItem.end, calendar));
  return clampPercent(Math.round(elapsedWorkingDays / taskWorkingDays * 100));
}

function defaultPlanningCalendar(): PlanningCalendar {
  return {
    id: 'cal-default-six-day',
    name: '默认六天制施工日历',
    timezone: 'Asia/Kuala_Lumpur',
    workingWeekdays: [1, 2, 3, 4, 5, 6],
    workingHoursPerDay: 8,
    exceptions: [],
  };
}

function calendarForTask(model: ProjectPlanningModel, taskItem: PlanningTask): PlanningCalendar {
  return model.calendars.find((calendar) => calendar.id === taskItem.calendarId)
    ?? model.calendars[0]
    ?? defaultPlanningCalendar();
}

function countWorkingDays(start: string, end: string, calendar: PlanningCalendar): number {
  if (compareIsoDate(end, start) < 0) return 0;
  let count = 0;
  for (const date of eachIsoDate(start, end)) {
    if (isWorkingDate(date, calendar)) count += 1;
  }
  return count;
}

function isWorkingDate(date: string, calendar: PlanningCalendar): boolean {
  const exception = calendar.exceptions.find((item) => item.date === date);
  if (exception) return exception.working;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return calendar.workingWeekdays.includes(weekday);
}

function eachIsoDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  const limit = Math.max(0, daysBetween(start, end));
  for (let index = 0; index < limit; index += 1) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return dates;
}

function createMonthBuckets(start: string, end: string): Array<{ start: string; end: string }> {
  const buckets: Array<{ start: string; end: string }> = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return buckets;
  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  while (cursor <= endDate) {
    const monthStart = cursor.toISOString().slice(0, 10);
    const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const monthEnd = shiftIsoDate(nextMonth.toISOString().slice(0, 10), -1);
    const overlap = overlapIsoRange(monthStart, monthEnd, start, end);
    if (overlap) buckets.push(overlap);
    cursor = nextMonth;
  }
  return buckets;
}

function overlapIsoRange(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): { start: string; end: string } | null {
  const start = compareIsoDate(startA, startB) >= 0 ? startA : startB;
  const end = compareIsoDate(endA, endB) <= 0 ? endA : endB;
  return compareIsoDate(start, end) <= 0 ? { start, end } : null;
}

function compareIsoDate(left: string, right: string): number {
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
  return leftTime === rightTime ? 0 : leftTime > rightTime ? 1 : -1;
}

function money(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 1;
  return Number((numerator / denominator).toFixed(2));
}

function roundOne(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(1));
}

function durationDays(taskItem: PlanningTask): number {
  return Math.max(1, daysBetween(taskItem.start, taskItem.end));
}

function minIsoDate(values: readonly string[]): string | null {
  const timestamps = values
    .map((value) => Date.parse(`${value}T00:00:00Z`))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps)).toISOString().slice(0, 10);
}

function maxIsoDate(values: readonly string[]): string | null {
  const timestamps = values
    .map((value) => Date.parse(`${value}T00:00:00Z`))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 1;
  }
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1);
}

function shiftIsoDate(value: string, days: number): string {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function collectSuccessorTaskIds(tasks: PlanningTask[], seedTaskIds: readonly string[]): string[] {
  const affected = new Set(seedTaskIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const taskItem of tasks) {
      if (affected.has(taskItem.id)) continue;
      if (taskItem.dependencies.some((dependencyId) => affected.has(dependencyId))) {
        affected.add(taskItem.id);
        changed = true;
      }
    }
  }
  return [...affected].filter((taskId) => tasks.some((taskItem) => taskItem.id === taskId));
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
