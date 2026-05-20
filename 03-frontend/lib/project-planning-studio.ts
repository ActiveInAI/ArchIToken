// lib/project-planning-studio.ts - Project Planning Studio data model and derivations
// License: Apache-2.0

import type { ModuleId } from './module-registry';

export type PlanningTaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked';
export type PlanningRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PlanningApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'archived';
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
  status: PlanningTaskStatus;
  resourceId: string;
  riskId: string;
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
  wbs: PlanningWbsNode[];
  tasks: PlanningTask[];
  milestones: PlanningMilestone[];
  resources: PlanningResource[];
  risks: PlanningRisk[];
  raci: PlanningRaciEntry[];
  diagrams: PlanningDiagram[];
  versions: PlanningVersion[];
  auditTrail: PlanningAuditEntry[];
}

export interface PlanningSummary {
  taskCount: number;
  wbsCount: number;
  milestoneCount: number;
  averageProgress: number;
  criticalRiskCount: number;
  blockedTaskCount: number;
  plannedDurationDays: number;
  criticalPathTaskIds: string[];
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

export function createDefaultProjectPlanningModel(): ProjectPlanningModel {
  const wbs: PlanningWbsNode[] = [
    { id: 'wbs-1', code: '1', title: '项目启动与计划基线', owner: '项目经理', parentId: null, deliverable: 'Project Plan Token' },
    { id: 'wbs-1-1', code: '1.1', title: '立项资料与合同边界', owner: '项目经理', parentId: 'wbs-1', deliverable: '立项包' },
    { id: 'wbs-1-2', code: '1.2', title: 'WBS/CBS/RACI 编制', owner: '计划工程师', parentId: 'wbs-1', deliverable: 'WBS 基线' },
    { id: 'wbs-2', code: '2', title: '设计与标准输入', owner: '总工', parentId: null, deliverable: '设计任务书' },
    { id: 'wbs-3', code: '3', title: '采购生产施工联动', owner: '履约经理', parentId: null, deliverable: '总控进度计划' },
  ];
  const resources: PlanningResource[] = [
    { id: 'res-pm', name: '项目管理组', type: 'team', capacity: 5, unit: '人' },
    { id: 'res-design', name: '设计深化组', type: 'team', capacity: 6, unit: '人' },
    { id: 'res-factory', name: '工厂产线', type: 'equipment', capacity: 2, unit: '条' },
    { id: 'res-crane', name: '吊装设备', type: 'equipment', capacity: 1, unit: '台' },
  ];
  const risks: PlanningRisk[] = [
    { id: 'risk-design', title: '设计输入延迟', probability: 0.52, impact: 0.72, level: 'high', owner: '总工', mitigation: '设计任务书和标准清单必须在基线审批前冻结。' },
    { id: 'risk-supply', title: '材料交期波动', probability: 0.44, impact: 0.67, level: 'medium', owner: '采购经理', mitigation: '关键材料双供应商和提前锁价。' },
    { id: 'risk-site', title: '吊装窗口冲突', probability: 0.35, impact: 0.82, level: 'high', owner: '施工经理', mitigation: '把吊装窗口纳入关键路径和资源负荷。' },
  ];
  const tasks: PlanningTask[] = [
    { id: 'task-1', code: 'T-001', title: '锁定客户需求和项目边界', wbsId: 'wbs-1-1', owner: '项目经理', start: '2026-05-20', end: '2026-05-23', progress: 72, dependencies: [], status: 'doing', resourceId: 'res-pm', riskId: 'risk-design' },
    { id: 'task-2', code: 'T-002', title: '编制 WBS/CBS/RACI 基线', wbsId: 'wbs-1-2', owner: '计划工程师', start: '2026-05-24', end: '2026-05-28', progress: 38, dependencies: ['task-1'], status: 'doing', resourceId: 'res-pm', riskId: 'risk-design' },
    { id: 'task-3', code: 'T-003', title: '同步设计任务书和标准清单', wbsId: 'wbs-2', owner: '总工', start: '2026-05-26', end: '2026-06-02', progress: 25, dependencies: ['task-2'], status: 'todo', resourceId: 'res-design', riskId: 'risk-design' },
    { id: 'task-4', code: 'T-004', title: '确认材料采购与产线窗口', wbsId: 'wbs-3', owner: '履约经理', start: '2026-06-01', end: '2026-06-08', progress: 18, dependencies: ['task-2'], status: 'todo', resourceId: 'res-factory', riskId: 'risk-supply' },
    { id: 'task-5', code: 'T-005', title: '固化吊装和现场交付窗口', wbsId: 'wbs-3', owner: '施工经理', start: '2026-06-09', end: '2026-06-13', progress: 0, dependencies: ['task-3', 'task-4'], status: 'todo', resourceId: 'res-crane', riskId: 'risk-site' },
  ];
  const milestones: PlanningMilestone[] = [
    { id: 'ms-1', title: '立项资料齐套', due: '2026-05-23', owner: '项目经理', linkedTaskIds: ['task-1'], status: 'ready' },
    { id: 'ms-2', title: '计划基线审批', due: '2026-05-29', owner: '项目负责人', linkedTaskIds: ['task-2'], status: 'pending' },
    { id: 'ms-3', title: '设计/采购/施工窗口锁定', due: '2026-06-13', owner: '履约经理', linkedTaskIds: ['task-3', 'task-4', 'task-5'], status: 'pending' },
  ];
  const raci: PlanningRaciEntry[] = [
    { workPackageId: 'wbs-1-1', responsible: '项目经理', accountable: '项目负责人', consulted: ['客户经理', '法务'], informed: ['财务', '设计负责人'] },
    { workPackageId: 'wbs-1-2', responsible: '计划工程师', accountable: '项目经理', consulted: ['造价工程师', '施工经理'], informed: ['生产经理'] },
    { workPackageId: 'wbs-3', responsible: '履约经理', accountable: '项目负责人', consulted: ['采购经理', '工厂负责人', '施工经理'], informed: ['财务', '档案管理员'] },
  ];
  const seed = { tasks, wbs, milestones, resources, risks, raci } satisfies PlanningDiagramSeedData;
  const diagrams: PlanningDiagram[] = ['gantt', 'wbs', 'raci', 'critical-path-network', 'risk-matrix', 'resource-histogram'].map((templateId) => createDiagramFromTemplate(templateId, seed));
  const createdAt = '2026-05-19T00:00:00.000Z';
  return {
    schema: 'architoken.project_planning_studio.v1',
    moduleId: 'planning_management',
    planId: 'plan-heavy-steel-demo',
    projectName: '应舍美居·锦屏重钢结构项目',
    baselineName: 'Project Planning Studio v1 基线',
    currentVersion: 'v1.0',
    approvalStatus: 'draft',
    wbs,
    tasks,
    milestones,
    resources,
    risks,
    raci,
    diagrams,
    versions: [
      {
        id: 'plan-version-v1',
        version: 'v1.0',
        status: 'draft',
        summary: '初始计划基线: WBS、里程碑、资源、风险、RACI 和图表模板库。',
        createdAt,
        createdBy: 'ProjectPlanningStudio',
        cdeFileName: 'project-planning-studio-v1.archiplan.json',
      },
    ],
    auditTrail: [
      {
        id: 'plan-audit-seed',
        at: createdAt,
        actor: 'ProjectPlanningStudio',
        summary: '初始化项目计划对象和图表模板库。',
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
    criticalRiskCount: model.risks.filter((riskItem) => riskItem.level === 'critical' || riskItem.level === 'high').length,
    blockedTaskCount: model.tasks.filter((taskItem) => taskItem.status === 'blocked').length,
    plannedDurationDays,
    criticalPathTaskIds: deriveCriticalPath(model.tasks),
  };
}

export function deriveCriticalPath(tasks: PlanningTask[]): string[] {
  const byId = new Map(tasks.map((taskItem) => [taskItem.id, taskItem]));
  const memo = new Map<string, { score: number; path: string[] }>();

  function longestPath(taskId: string, seen: Set<string>): { score: number; path: string[] } {
    const cached = memo.get(taskId);
    if (cached) {
      return cached;
    }
    const taskItem = byId.get(taskId);
    if (!taskItem || seen.has(taskId)) {
      return { score: 0, path: [] };
    }
    const duration = Math.max(1, daysBetween(taskItem.start, taskItem.end));
    const nextSeen = new Set(seen).add(taskId);
    const dependencyPaths = taskItem.dependencies.map((dependencyId) => longestPath(dependencyId, nextSeen));
    const bestDependency = dependencyPaths.reduce(
      (best, candidate) => (candidate.score > best.score ? candidate : best),
      { score: 0, path: [] },
    );
    const result = {
      score: bestDependency.score + duration,
      path: [...bestDependency.path, taskId],
    };
    memo.set(taskId, result);
    return result;
  }

  return tasks.reduce(
    (best, taskItem) => {
      const candidate = longestPath(taskItem.id, new Set<string>());
      return candidate.score > best.score ? candidate : best;
    },
    { score: 0, path: [] as string[] },
  ).path;
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
  const resourceLoads = deriveResourceHistogram(model);
  const overloaded = resourceLoads.filter((resource) => resource.load > resource.capacity * 3);
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
      title: `${resource.name} 资源负荷偏高`,
      recommendation: `计划负荷 ${resource.load} 天,超过容量阈值,建议调平资源或调整任务窗口。`,
      evidenceRefs: [resource.resourceId],
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
      'code,title,wbs,owner,start,end,progress,status,dependencies',
      ...model.tasks.map((taskItem) => [
        taskItem.code,
        taskItem.title,
        model.wbs.find((wbsItem) => wbsItem.id === taskItem.wbsId)?.code ?? taskItem.wbsId,
        taskItem.owner,
        taskItem.start,
        taskItem.end,
        taskItem.progress,
        taskItem.status,
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

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 1;
  }
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
