// lib/module-registry.ts - ArchIToken frontend Module Schema fixtures
// License: Apache-2.0

export type ModuleId =
  | 'marketing_service'
  | 'planning_management'
  | 'concept_design'
  | 'standard_library'
  | 'detailed_design'
  | 'quantity_costing'
  | 'material_logistics'
  | 'production_manufacturing'
  | 'construction_management'
  | 'digital_twin'
  | 'finance_hr'
  | 'digital_archive'
  | 'ai_center'
  | 'settings_center';

export type ModuleStatus = 'active' | 'pilot' | 'planned' | 'foundation';
export type ModuleTrack =
  | 'customer'
  | 'design'
  | 'governance'
  | 'cost'
  | 'supply'
  | 'factory'
  | 'site'
  | 'twin'
  | 'archive'
  | 'platform';

export type ArtifactStatus =
  | 'draft'
  | 'generated'
  | 'evaluated'
  | 'rule_checked'
  | 'schema_validated'
  | 'approved'
  | 'archived';

export type WorkflowStateStatus = 'queued' | 'running' | 'blocked' | 'passed' | 'approved';
export type AgentGateStatus = 'pending' | 'running' | 'passed' | 'blocked';
export type ApprovalStatus = 'not_started' | 'waiting' | 'approved' | 'rejected';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ModuleAction =
  | 'generate'
  | 'evaluate'
  | 'rule_check'
  | 'schema_validate'
  | 'approve'
  | 'archive';

export interface SubdomainSpec {
  id: string;
  name: string;
  purpose: string;
  ownerRole: string;
  capabilityLevel: 'foundation' | 'workflow' | 'automation' | 'simulation';
}

export interface ArtifactSpec {
  id: string;
  name: string;
  type: string;
  status: ArtifactStatus;
  owner: string;
  updatedAt: string;
  evidence: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStateStatus;
  description: string;
}

export interface AgentGate {
  id: string;
  name: 'Planner' | 'Generator' | 'Evaluator' | 'RuleChecker' | 'SchemaValidator' | 'Approver';
  status: AgentGateStatus;
  responsibility: string;
}

export interface ModuleTask {
  id: string;
  title: string;
  assignee: string;
  state: 'todo' | 'doing' | 'review' | 'done';
  due: string;
}

export interface ApprovalRecord {
  id: string;
  title: string;
  status: ApprovalStatus;
  approver: string;
}

export interface RiskBlocker {
  id: string;
  title: string;
  level: RiskLevel;
  mitigation: string;
}

export interface VisualizationSpec {
  mode: 'form' | 'board' | 'timeline' | 'model' | 'map' | 'hmi' | 'archive' | 'settings';
  title: string;
  layers: string[];
  telemetry: string[];
}

export interface ModuleSpec {
  id: ModuleId;
  order: number;
  zhName: string;
  enName: string;
  track: ModuleTrack;
  status: ModuleStatus;
  summary: string;
  objective: string;
  subdomains: SubdomainSpec[];
  inputs: ModuleId[];
  outputs: ModuleId[];
  artifacts: ArtifactSpec[];
  workflowStates: WorkflowStep[];
  agentGates: AgentGate[];
  tasks: ModuleTask[];
  approvals: ApprovalRecord[];
  risks: RiskBlocker[];
  fileTypes: string[];
  visualization: VisualizationSpec;
  standards: string[];
  dataObjects: string[];
  routeHref: string;
  schemaRef: string;
}

export const activeModuleIds = [
  'marketing_service',
  'planning_management',
  'concept_design',
  'standard_library',
  'detailed_design',
  'quantity_costing',
  'material_logistics',
  'production_manufacturing',
  'construction_management',
  'digital_twin',
  'digital_archive',
  'finance_hr',
  'ai_center',
  'settings_center',
] as const satisfies readonly ModuleId[];

export const MODULE_TREE_GROUPS = [
  {
    id: 'business_growth',
    title: '业务增长',
    modules: ['marketing_service', 'planning_management'],
  },
  {
    id: 'design_standard',
    title: '设计与标准',
    modules: ['concept_design', 'standard_library', 'detailed_design'],
  },
  {
    id: 'cost_supply_production',
    title: '成本供应链',
    modules: ['quantity_costing', 'material_logistics', 'production_manufacturing'],
  },
  {
    id: 'site_delivery',
    title: '现场交付',
    modules: ['construction_management', 'digital_twin', 'digital_archive'],
  },
  {
    id: 'enterprise_intelligence',
    title: '经营智能',
    modules: ['finance_hr', 'ai_center', 'settings_center'],
  },
] satisfies Array<{
  id: string;
  title: string;
  modules: ModuleId[];
}>;

export const moduleStatusLabels: Record<ModuleStatus, string> = {
  active: '运行中',
  pilot: '试点',
  planned: '编排中',
  foundation: '底座',
};

export const artifactStatusLabels: Record<ArtifactStatus, string> = {
  draft: '草稿',
  generated: '已生成',
  evaluated: '已评估',
  rule_checked: '已校核',
  schema_validated: 'Schema 已验证',
  approved: '已审批',
  archived: '已归档',
};

export const moduleActionLabels: Record<ModuleAction, string> = {
  generate: '生成',
  evaluate: '评估',
  rule_check: '校核',
  schema_validate: 'Schema',
  approve: '审批',
  archive: '归档',
};

const baseAgentGates: AgentGate[] = [
  {
    id: 'planner',
    name: 'Planner',
    status: 'passed',
    responsibility: '拆解任务、选择输入、建立执行路径。',
  },
  {
    id: 'generator',
    name: 'Generator',
    status: 'running',
    responsibility: '生成方案、模型、清单、报告或业务单据。',
  },
  {
    id: 'evaluator',
    name: 'Evaluator',
    status: 'pending',
    responsibility: '独立评估输出质量,不得自评。',
  },
  {
    id: 'rule-checker',
    name: 'RuleChecker',
    status: 'pending',
    responsibility: '按规范、企业规则、工程约束做确定性校核。',
  },
  {
    id: 'schema-validator',
    name: 'SchemaValidator',
    status: 'pending',
    responsibility: '校验 JSON Schema、IFC Schema 和 Module Schema。',
  },
  {
    id: 'approver',
    name: 'Approver',
    status: 'pending',
    responsibility: '执行人工或自动最终门禁。',
  },
];

function gates(): AgentGate[] {
  return baseAgentGates.map((gate) => ({ ...gate }));
}

function artifact(
  id: string,
  name: string,
  type: string,
  owner: string,
  evidence: string[],
): ArtifactSpec {
  return {
    id,
    name,
    type,
    status: 'draft',
    owner,
    updatedAt: '2026-04-27 09:30',
    evidence,
  };
}

function workflow(moduleId: ModuleId): WorkflowStep[] {
  return [
    {
      id: `${moduleId}-intake`,
      name: 'Intake',
      status: 'passed',
      description: '输入资料、权限、项目上下文和模块目标已登记。',
    },
    {
      id: `${moduleId}-authoring`,
      name: 'Authoring',
      status: 'running',
      description: 'Agent 和人工协作生成模块交付物。',
    },
    {
      id: `${moduleId}-gate`,
      name: 'Gate Review',
      status: 'queued',
      description: '进入评估、规则校核、Schema 校验和审批。',
    },
    {
      id: `${moduleId}-handover`,
      name: 'Handover',
      status: 'queued',
      description: '输出给下游模块或归档为可追溯证据。',
    },
  ];
}

function task(id: string, title: string, assignee: string, state: ModuleTask['state']): ModuleTask {
  return { id, title, assignee, state, due: '2026-05-06' };
}

function approval(id: string, title: string, approver: string): ApprovalRecord {
  return { id, title, approver, status: 'waiting' };
}

function risk(id: string, title: string, level: RiskLevel, mitigation: string): RiskBlocker {
  return { id, title, level, mitigation };
}

export const moduleSpecs: ModuleSpec[] = [
  {
    id: 'marketing_service',
    order: 1,
    zhName: '市场客服',
    enName: 'Marketing Service',
    track: 'customer',
    status: 'planned',
    summary: '从线索到立项的客户入口,统一收集需求、约束、预算、工期和证据。',
    objective: '把客户沟通转成可被方案设计、造价和合同体系消费的 Lead Token。',
    subdomains: [
      { id: 'lead-capture', name: '线索捕获', purpose: '登记客户、地点、预算和项目类型。', ownerRole: '销售顾问', capabilityLevel: 'workflow' },
      { id: 'requirement-interview', name: '需求访谈', purpose: '形成可追溯需求边界。', ownerRole: '方案顾问', capabilityLevel: 'automation' },
      { id: 'proposal-intake', name: '立项资料', purpose: '沉淀项目启动资料和授权。', ownerRole: '客户经理', capabilityLevel: 'workflow' },
    ],
    inputs: [],
    outputs: ['planning_management', 'concept_design'],
    artifacts: [
      artifact('lead-token', 'Lead Token', 'JSON + PDF', '客户经理', ['客户授权', '需求摘要']),
      artifact('requirement-brief', '需求访谈纪要', 'Markdown', '方案顾问', ['访谈录音', '现场照片']),
    ],
    workflowStates: workflow('marketing_service'),
    agentGates: gates(),
    tasks: [
      task('ms-t1', '补齐客户预算、位置和交付窗口', '客户经理', 'doing'),
      task('ms-t2', '生成首版需求边界和机会评分', 'Planner Agent', 'todo'),
    ],
    approvals: [approval('ms-a1', '客户资料使用授权', '客户代表')],
    risks: [risk('ms-r1', '需求边界未锁定', 'medium', '强制生成问题清单并进入客户确认。')],
    fileTypes: ['.pdf', '.docx', '.jpg', '.mp3', '.json'],
    visualization: {
      mode: 'form',
      title: '客户旅程和线索漏斗',
      layers: ['客户画像', '预算区间', '需求完整度', '授权状态'],
      telemetry: ['lead_score', 'requirement_completeness', 'response_sla'],
    },
    standards: ['PIPL consent record', 'ISO 9001 customer requirement', 'PMBOK stakeholder register'],
    dataObjects: ['leads', 'contacts', 'requirements', 'quote_drafts'],
    routeHref: '/app/modules/marketing_service',
    schemaRef: 'module.schema/marketing_service.v1',
  },
  {
    id: 'planning_management',
    order: 2,
    zhName: '计划管理',
    enName: 'Planning Management',
    track: 'governance',
    status: 'planned',
    summary: '把市场线索、合同边界、设计任务和施工目标转成项目立项、WBS、里程碑、资源计划和审批计划。',
    objective: '形成可被方案设计、造价、生产、施工和财务共同消费的 Project Plan Token。',
    subdomains: [
      { id: 'project-initiation', name: '项目立项', purpose: '管理机会转项目、项目编码、合同边界和责任矩阵。', ownerRole: '项目经理', capabilityLevel: 'workflow' },
      { id: 'wbs-cbs', name: 'WBS / CBS', purpose: '建立工作分解、成本分解、责任分解和交付物分解。', ownerRole: '计划工程师', capabilityLevel: 'automation' },
      { id: 'milestone-plan', name: '里程碑计划', purpose: '管理设计、采购、制造、物流、施工和竣工关键节点。', ownerRole: '项目控制经理', capabilityLevel: 'workflow' },
      { id: 'resource-plan', name: '资源计划', purpose: '统筹人、机、料、资金、设备和外协资源。', ownerRole: '资源经理', capabilityLevel: 'simulation' },
      { id: 'approval-plan', name: '审批计划', purpose: '配置方案、模型、清单、采购、生产、施工、付款和归档审批路径。', ownerRole: '流程管理员', capabilityLevel: 'workflow' },
    ],
    inputs: ['marketing_service', 'standard_library'],
    outputs: ['concept_design', 'quantity_costing', 'production_manufacturing', 'construction_management', 'finance_hr'],
    artifacts: [
      artifact('project-plan-token', 'Project Plan Token', 'JSON', '项目经理', ['立项资料', '责任矩阵']),
      artifact('wbs-baseline', 'WBS/CBS 基线', 'XLSX + JSON', '计划工程师', ['里程碑', '资源约束']),
      artifact('approval-plan', '审批计划', 'YAML', '流程管理员', ['审批矩阵', '权限边界']),
    ],
    workflowStates: workflow('planning_management'),
    agentGates: gates(),
    tasks: [
      task('pl-t1', '建立项目 WBS、里程碑和责任矩阵', '项目经理', 'doing'),
      task('pl-t2', '同步设计、采购、制造、施工关键窗口', '计划工程师', 'todo'),
    ],
    approvals: [approval('pl-a1', '项目计划基线审批', '项目负责人')],
    risks: [risk('pl-r1', '计划与资源、成本、现场窗口不一致', 'high', '计划基线必须绑定 WBS、CBS、资源和审批路径。')],
    fileTypes: ['.mpp', '.xer', '.xlsx', '.csv', '.pdf', '.json', '.yaml'],
    visualization: {
      mode: 'timeline',
      title: '项目计划、WBS 和里程碑总控',
      layers: ['立项', 'WBS', 'CBS', '里程碑', '资源', '审批', '风险'],
      telemetry: ['milestone_readiness', 'resource_conflict_count', 'approval_delay'],
    },
    standards: ['PMBOK schedule baseline', 'ISO 21502', 'ISO 19650 MIDP/TIDP', 'GB/T 50326'],
    dataObjects: ['projects', 'wbs_items', 'cbs_items', 'milestones', 'resource_plans', 'approval_routes', 'plan_baselines'],
    routeHref: '/app/modules/planning_management',
    schemaRef: 'module.schema/planning_management.v1',
  },
  {
    id: 'concept_design',
    order: 3,
    zhName: '方案设计',
    enName: 'Concept Design',
    track: 'design',
    status: 'pilot',
    summary: '把需求转成多方案、概念模型、风格图、投资边界和可建造性判断。',
    objective: '生成可比选、可审查、可深化的 Concept Token。',
    subdomains: [
      { id: 'scheme-generation', name: '多方案生成', purpose: '生成平面、体量、风格和功能组合。', ownerRole: '建筑设计师', capabilityLevel: 'automation' },
      { id: 'visual-option', name: '效果表达', purpose: '文本生成图片、图片生成视频和概念模型。', ownerRole: '视觉设计师', capabilityLevel: 'automation' },
      { id: 'feasibility', name: '可建造性初筛', purpose: '初筛结构、造价和规范风险。', ownerRole: '技术负责人', capabilityLevel: 'workflow' },
    ],
    inputs: ['marketing_service', 'standard_library'],
    outputs: ['detailed_design', 'quantity_costing'],
    artifacts: [
      artifact('concept-token', 'Concept Token', 'JSON', '方案设计师', ['需求边界', '方案评分']),
      artifact('scheme-pack', '三方案比选包', 'PDF + GLB', 'Generator Agent', ['概念图', '体块模型']),
    ],
    workflowStates: workflow('concept_design'),
    agentGates: gates(),
    tasks: [
      task('cd-t1', '生成三套可比选空间方案', 'Generator Agent', 'doing'),
      task('cd-t2', '校核预算、工期、场地限制', 'Evaluator Agent', 'todo'),
    ],
    approvals: [approval('cd-a1', '概念方案客户确认', '业主代表')],
    risks: [risk('cd-r1', '概念表现与可建造性脱节', 'high', '方案输出必须附结构和成本初筛。')],
    fileTypes: ['.png', '.mp4', '.ifc', '.glb', '.pdf', '.json'],
    visualization: {
      mode: 'model',
      title: '多方案体块对比',
      layers: ['体块', '日照', '交通', '投资热力', '风险标注'],
      telemetry: ['scheme_score', 'cost_delta', 'constructability_score'],
    },
    standards: ['PMBOK scope baseline', 'ISO 19650 OIR/PIR', 'GB/T 50326'],
    dataObjects: ['concepts', 'concept_variants', 'scheme_scores', 'style_tags'],
    routeHref: '/app/modules/concept_design',
    schemaRef: 'module.schema/concept_design.v1',
  },
  {
    id: 'standard_library',
    order: 4,
    zhName: '标准族库',
    enName: 'Standard Library',
    track: 'governance',
    status: 'foundation',
    summary: '工程全生命周期标准规范中心,统一管理项目管理、设计、BIM/CDE、造价合同、材料供应链、生产制造、施工质量安全、档案记录、审计内控、信息安全与AI治理标准。',
    objective: '把国内外标准、地方规范、企业工法、构件族库、编码体系和审查规则转成可搜索、可引用、可校验、可审计的 Standard Token。',
    subdomains: [
      { id: 'standard-packs', name: '标准总库', purpose: '管理国内外项目管理、设计、造价、生产、施工、档案、审计、信息安全、AI治理与BIM标准包。', ownerRole: '标准工程师', capabilityLevel: 'automation' },
      { id: 'design-codes', name: '设计规范', purpose: '管理建筑、结构、消防、抗震、钢结构、强制性条文和地方设计要求。', ownerRole: '设计总工', capabilityLevel: 'workflow' },
      { id: 'bim-cde', name: 'BIM与CDE标准', purpose: '管理 ISO 19650、IFC、IDS、BCF、IDM、信息交付计划和CDE状态规则。', ownerRole: 'BIM 经理', capabilityLevel: 'automation' },
      { id: 'cost-contract', name: '造价合同标准', purpose: '管理清单计价、工程量、合同体系、变更、签证、索赔、付款和结算规则。', ownerRole: '成本经理', capabilityLevel: 'workflow' },
      { id: 'material-supply', name: '材料供应链标准', purpose: '管理材料证书、供应商资质、采购、批次、物流、到场验收和追溯要求。', ownerRole: '供应链经理', capabilityLevel: 'workflow' },
      { id: 'production-quality', name: '生产制造标准', purpose: '管理BOM、加工单、焊接、涂装、防火、防腐、质检、包装和发运标准。', ownerRole: '制造负责人', capabilityLevel: 'automation' },
      { id: 'construction-acceptance', name: '施工验收标准', purpose: '管理施工方案、技术交底、检验批、隐蔽验收、质量安全和整改闭环。', ownerRole: '项目总工', capabilityLevel: 'workflow' },
      { id: 'archive-audit', name: '档案审计标准', purpose: '管理工程档案、电子签章、版本链、长期保存、审计证据和数据留存策略。', ownerRole: '文控经理', capabilityLevel: 'foundation' },
      { id: 'ai-governance', name: '信息安全与AI治理', purpose: '管理权限、隐私、等保、AI风险、模型调用审计、RAG知识库和Agent边界。', ownerRole: '安全管理员', capabilityLevel: 'automation' },
    ],
    inputs: [],
    outputs: ['concept_design', 'detailed_design', 'quantity_costing', 'material_logistics', 'production_manufacturing', 'construction_management', 'digital_twin', 'digital_archive', 'finance_hr', 'ai_center', 'settings_center'],
    artifacts: [
      artifact('standard-token', 'Standard Token', 'JSON', '标准工程师', ['标准来源', '法域映射', '版本状态']),
      artifact('clause-control-pack', '条文控制点包', 'JSON Schema', '规则工程师', ['条文编号', '控制点', '证据要求']),
      artifact('family-pack', '族库构件包', 'IFC + GLB', 'BIM 经理', ['属性集', '版本记录']),
      artifact('rule-pack', '规则库发布包', 'JSON Schema', '规则工程师', ['规则单元测试', '适用范围']),
    ],
    workflowStates: workflow('standard_library'),
    agentGates: gates(),
    tasks: [
      task('sl-t1', '建立项目管理、设计、BIM、造价、生产、施工、档案和审计标准包', '标准工程师', 'doing'),
      task('sl-t2', '发布IFC/IDS/BCF与构件族库规则映射', 'BIM 经理', 'review'),
      task('sl-t3', '补齐造价合同、生产制造、施工验收和数字档案控制点', '规则工程师', 'todo'),
    ],
    approvals: [approval('sl-a1', '企业标准族库版本发布', '技术总监')],
    risks: [risk('sl-r1', '条文版本、项目法域和业务模块错配', 'critical', '所有标准规则必须带 jurisdiction、version、effective_date、module_scope 和 evidence_required。')],
    fileTypes: ['.pdf', '.docx', '.xlsx', '.json', '.yaml', '.ifc', '.ids', '.bcf', '.csv', '.md'],
    visualization: {
      mode: 'board',
      title: '工程标准知识图谱与规则版本库',
      layers: ['标准包', '条文控制点', '设计规范', 'BIM/CDE', '造价合同', '材料供应链', '生产制造', '施工验收', '档案审计', 'AI治理'],
      telemetry: ['coverage_rate', 'deprecated_items', 'rule_pass_rate', 'jurisdiction_conflicts'],
    },
    standards: [
      'PMBOK / PMP 项目管理',
      'IPMP / IPMA ICB 能力基线',
      'ISO 21502 项目管理',
      'ISO 10006 项目质量管理指南',
      'GB/T 50326 建设工程项目管理规范',
      'GB 50016 建筑设计防火规范',
      'GB 50011 建筑抗震设计规范',
      'GB 50017 钢结构设计标准',
      'GB 550xx 工程建设强制性规范',
      'ISO 19650 BIM 信息管理',
      'ISO 29481 信息交付手册 IDM',
      'ISO 16739 IFC 数据交换',
      'ISO 12911 BIM 实施框架',
      'ISO 12006 建设信息分类',
      'GB/T 51212 建筑信息模型应用统一标准',
      'DB11/T 1069-2024 北京民用建筑信息模型交付标准',
      'SJG 114-2022 深圳建筑信息模型数据存储标准',
      'DG/TJ08-2201-2023 上海建筑信息模型技术应用统一标准',
      'GB 50500 建设工程工程量清单计价规范',
      'FIDIC / NEC / JCT 合同体系',
      'RICS NRM / ICMS / AACE 成本工程体系',
      'ISO 9001 质量管理',
      'ISO 14001 环境管理',
      'ISO 45001 职业健康安全',
      'ISO 3834 焊接质量要求',
      'EN 1090 钢结构执行',
      'AWS D1.1 焊接规范',
      'GB 50205 钢结构工程施工质量验收标准',
      'GB 50661 钢结构焊接规范',
      'GB 50300 建筑工程施工质量验收统一标准',
      'GB/T 50328 建设工程文件归档规范',
      'ISO 15489 记录管理',
      'ISO 30301 记录管理体系',
      'ISO 14721 OAIS 长期保存',
      'ISO 19011 管理体系审核',
      'ISO 31000 风险管理',
      'COSO 内控框架',
      'ISO 27001 信息安全',
      'ISO 27701 隐私信息管理',
      'ISO/IEC 42001 AI 管理体系',
      'NIST AI RMF',
      '等保 2.0 / PIPL / DSL / CSL / GDPR / EU AI Act',
    ],
    dataObjects: [
      'standard_packs',
      'standard_clauses',
      'control_points',
      'design_rules',
      'bim_cde_requirements',
      'ifc_ids_mappings',
      'cost_contract_rules',
      'material_certification_rules',
      'production_quality_rules',
      'construction_acceptance_rules',
      'archive_retention_rules',
      'audit_controls',
      'risk_controls',
      'security_privacy_controls',
      'ai_governance_controls',
      'enterprise_methods',
      'project_templates',
    ],
    routeHref: '/app/modules/standard_library',
    schemaRef: 'module.schema/standard_library.v1',
  },
  {
    id: 'detailed_design',
    order: 5,
    zhName: '深化设计',
    enName: 'Detailed Design',
    track: 'design',
    status: 'pilot',
    summary: '把方案深化为 IFC/MBD、施工图、结构计算、节点详图、碰撞审查和可制造属性。',
    objective: '输出可被计量、制造、施工和孪生消费的 Design Token。',
    subdomains: [
      { id: 'ifc-authoring', name: 'IFC/MBD 建模', purpose: '维护几何、属性和构件身份。', ownerRole: 'BIM 工程师', capabilityLevel: 'automation' },
      { id: 'drawing-review', name: '图纸审查', purpose: '校核 PDF/CAD/施工图与模型一致性。', ownerRole: '设计负责人', capabilityLevel: 'workflow' },
      { id: 'clash-bcf', name: '碰撞与 BCF', purpose: '生成问题包、责任人和闭环状态。', ownerRole: 'BIM 经理', capabilityLevel: 'automation' },
    ],
    inputs: ['concept_design', 'standard_library'],
    outputs: ['quantity_costing', 'production_manufacturing', 'construction_management', 'digital_twin'],
    artifacts: [
      artifact('design-token', 'Design Token', 'JSON', 'BIM 经理', ['IFC GUID', 'IDS 报告']),
      artifact('ifc-model', 'IFC4.3 语义模型', 'IFC', 'BIM 工程师', ['属性集', '构件编码']),
      artifact('bcf-pack', 'BCF 问题包', 'BCF', '审查工程师', ['碰撞截图', '责任矩阵']),
    ],
    workflowStates: workflow('detailed_design'),
    agentGates: gates(),
    tasks: [
      task('dd-t1', '生成构件树和属性完整性报告', 'SchemaValidator', 'doing'),
      task('dd-t2', '补齐节点详图与焊缝属性', 'BIM 工程师', 'todo'),
    ],
    approvals: [approval('dd-a1', '深化模型出图审批', '设计总工')],
    risks: [risk('dd-r1', '几何完整但属性缺失', 'high', 'IDS 和 Module Schema 必须同步校验。')],
    fileTypes: ['.ifc', '.ids', '.bcf', '.dwg', '.dxf', '.pdf', '.step', '.glb'],
    visualization: {
      mode: 'model',
      title: 'IFC/MBD 构件树和碰撞视口',
      layers: ['构件树', '属性完整度', '碰撞点', 'BCF 状态', '清单映射'],
      telemetry: ['geometry_score', 'property_score', 'clash_open_count'],
    },
    standards: ['IFC4.3', 'IDS', 'BCF', 'AISC 360', 'EN 1993', 'GB 50017'],
    dataObjects: ['bim_models', 'drawings', 'structure_calculations', 'clash_reports'],
    routeHref: '/app/modules/detailed_design',
    schemaRef: 'module.schema/detailed_design.v1',
  },
  {
    id: 'quantity_costing',
    order: 6,
    zhName: '计量造价',
    enName: 'Quantity & Costing',
    track: 'cost',
    status: 'planned',
    summary: '从模型、图纸和变更中生成 MTO、BOQ、BOM、成本基线和变更影响。',
    objective: '确保工程量、价格来源、变更差异和成本风险可追溯。',
    subdomains: [
      { id: 'mto-extraction', name: '模型计量', purpose: '从 IFC/GLB/图纸抽取工程量。', ownerRole: '造价工程师', capabilityLevel: 'automation' },
      { id: 'price-snapshot', name: '价格快照', purpose: '绑定供应商、区域和时间价格。', ownerRole: '采购/造价', capabilityLevel: 'workflow' },
      { id: 'variation-impact', name: '变更影响', purpose: '分析签证、索赔和现金流变化。', ownerRole: '商务经理', capabilityLevel: 'simulation' },
    ],
    inputs: ['concept_design', 'detailed_design', 'standard_library'],
    outputs: ['material_logistics', 'production_manufacturing'],
    artifacts: [
      artifact('boq-token', 'BOQ Token', 'JSON + XLSX', '造价工程师', ['模型清单', '价格来源']),
      artifact('cost-baseline', '成本基线', 'XLSX', '商务经理', ['预算版本', '变更记录']),
    ],
    workflowStates: workflow('quantity_costing'),
    agentGates: gates(),
    tasks: [
      task('qc-t1', '抽取 Q355B 构件 MTO 并比对图纸', 'Generator Agent', 'doing'),
      task('qc-t2', '核对钢材价格和损耗率', '造价工程师', 'todo'),
    ],
    approvals: [approval('qc-a1', '目标成本基线审批', '商务负责人')],
    risks: [risk('qc-r1', '模型清单与报价口径不一致', 'high', 'BOQ 项必须保留 element_id 和 rule_id。')],
    fileTypes: ['.ifc', '.xlsx', '.csv', '.pdf', '.json'],
    visualization: {
      mode: 'board',
      title: '成本分解和变更影响看板',
      layers: ['MTO', 'BOQ', '价格快照', '变更差异', '现金流'],
      telemetry: ['boq_coverage', 'price_confidence', 'variation_delta'],
    },
    standards: ['GB 50500', 'CSI MasterFormat', 'NRM', 'ASTM E2516'],
    dataObjects: ['mto_items', 'boq_items', 'price_snapshots', 'cost_breakdowns'],
    routeHref: '/app/modules/quantity_costing',
    schemaRef: 'module.schema/quantity_costing.v1',
  },
  {
    id: 'material_logistics',
    order: 7,
    zhName: '材料物流',
    enName: 'Material Logistics',
    track: 'supply',
    status: 'pilot',
    summary: '覆盖材料库存、供应商、价格、询比价、采购、下料、包装、运输、到货和批次追踪。',
    objective: '把成本清单和生产需求转成可追踪的供应链闭环。',
    subdomains: [
      { id: 'inventory', name: '材料库存', purpose: '维护钢材、焊材、涂料和连接件库存。', ownerRole: '仓储经理', capabilityLevel: 'workflow' },
      { id: 'supplier-price', name: '供应商与价格', purpose: '管理供应商、价格、询价和比价。', ownerRole: '采购经理', capabilityLevel: 'automation' },
      { id: 'purchase-plan', name: '采购计划', purpose: '生成采购、补料和 DDMRP 缓冲计划。', ownerRole: '计划工程师', capabilityLevel: 'simulation' },
      { id: 'cutting-bom', name: '下料单 / 加工 BOM', purpose: '将清单转成可生产和可发运的构件包。', ownerRole: '工艺工程师', capabilityLevel: 'automation' },
      { id: 'packing-loading', name: '包装与装车', purpose: '按吊装顺序组织包装、装车和批次。', ownerRole: '物流经理', capabilityLevel: 'workflow' },
      { id: 'delivery-receiving', name: '物流 / 到货 / 签收', purpose: '跟踪运输、现场堆放、到货验收和签收。', ownerRole: '现场材料员', capabilityLevel: 'workflow' },
      { id: 'batch-trace', name: '批次追踪', purpose: '通过炉批号、二维码和 RFID 追踪材料证据。', ownerRole: '质保工程师', capabilityLevel: 'automation' },
    ],
    inputs: ['quantity_costing', 'production_manufacturing'],
    outputs: ['construction_management', 'digital_twin'],
    artifacts: [
      artifact('material-token', 'Material Token', 'JSON', '采购经理', ['炉批号', '供应商']),
      artifact('purchase-plan', '采购计划', 'XLSX', '采购经理', ['询价记录', '比价表']),
      artifact('logistics-pack', '包装装车物流包', 'PDF + CSV', '物流经理', ['装车顺序', '签收单']),
    ],
    workflowStates: workflow('material_logistics'),
    agentGates: gates(),
    tasks: [
      task('ml-t1', '生成 Q355B 钢材采购计划和询价包', '采购经理', 'doing'),
      task('ml-t2', '绑定构件批次、装车和现场堆放区域', '物流经理', 'todo'),
    ],
    approvals: [approval('ml-a1', '供应商比价与采购审批', '采购负责人')],
    risks: [risk('ml-r1', '构件到场顺序与吊装计划冲突', 'high', '装车计划必须读取施工吊装窗口。')],
    fileTypes: ['.xlsx', '.csv', '.pdf', '.jpg', '.json', '.qr'],
    visualization: {
      mode: 'map',
      title: '供应链和堆场追踪地图',
      layers: ['库存', '供应商', '价格', '采购计划', '物流 ETA', '堆场', '批次'],
      telemetry: ['buffer_status', 'eta_variance', 'batch_trace_rate'],
    },
    standards: ['DDMRP', 'ISO 9001 traceability', 'ISO 55000', 'PMBOK procurement'],
    dataObjects: ['inventory_items', 'suppliers', 'price_quotes', 'purchase_plans', 'cutting_lists', 'production_boms', 'packing_lists', 'shipments', 'receipts', 'batch_traces'],
    routeHref: '/app/modules/material_logistics',
    schemaRef: 'module.schema/material_logistics.v1',
  },
  {
    id: 'production_manufacturing',
    order: 8,
    zhName: '生产制造',
    enName: 'Production Manufacturing',
    track: 'factory',
    status: 'pilot',
    summary: '生产计划、工序路线、下料优化、CNC、焊接、涂装、质检、排产、MES/ERP 和返工闭环。',
    objective: '把深化模型和 BOM 转成可制造、可追溯、可质检、可发运的构件生产系统。',
    subdomains: [
      { id: 'production-plan', name: '生产计划', purpose: '按交付窗口拆分构件批次和工期。', ownerRole: '生产计划员', capabilityLevel: 'simulation' },
      { id: 'routing', name: '工序路线', purpose: '定义下料、组立、焊接、矫正、涂装、包装路线。', ownerRole: '工艺工程师', capabilityLevel: 'workflow' },
      { id: 'cut-optimization', name: '下料优化', purpose: '优化钢板、型钢和余料利用率。', ownerRole: '下料工程师', capabilityLevel: 'automation' },
      { id: 'cnc', name: 'CNC/数控文件', purpose: '生成并校核数控切割和钻孔文件。', ownerRole: '数控工程师', capabilityLevel: 'automation' },
      { id: 'welding', name: '焊接', purpose: '管理 WPS/PQR、焊工、焊缝和检测。', ownerRole: '焊接工程师', capabilityLevel: 'workflow' },
      { id: 'coating', name: '喷涂/防腐/防火', purpose: '管理表面处理、膜厚和防火涂层。', ownerRole: '涂装工程师', capabilityLevel: 'workflow' },
      { id: 'factory-qc', name: '质检', purpose: '记录 UT/RT/MT、尺寸和外观检查。', ownerRole: '质检工程师', capabilityLevel: 'automation' },
      { id: 'mes-erp', name: 'MES/ERP 对接', purpose: '同步工单、排产、库存和成本。', ownerRole: '系统集成工程师', capabilityLevel: 'workflow' },
      { id: 'coding-shipping', name: '构件编码 / 包装发运 / 返工', purpose: '绑定二维码、包装单、发运和返工处理。', ownerRole: '车间主任', capabilityLevel: 'workflow' },
    ],
    inputs: ['detailed_design', 'quantity_costing', 'standard_library'],
    outputs: ['material_logistics', 'construction_management', 'digital_twin'],
    artifacts: [
      artifact('production-token', 'Production Token', 'JSON', '生产计划员', ['工单', '排产']),
      artifact('cnc-package', 'CNC/数控文件包', 'NC + DXF', '数控工程师', ['切割路径', '钻孔文件']),
      artifact('factory-qc-pack', '工厂质检报告', 'PDF + JSON', '质检工程师', ['UT 记录', '膜厚记录']),
    ],
    workflowStates: workflow('production_manufacturing'),
    agentGates: gates(),
    tasks: [
      task('pm-t1', '生成构件排产和下料优化清单', '工艺工程师', 'doing'),
      task('pm-t2', '校核 CNC 文件与构件编码', 'RuleChecker', 'todo'),
    ],
    approvals: [approval('pm-a1', '工厂生产放行审批', '生产负责人')],
    risks: [risk('pm-r1', 'CNC 文件与模型版本不一致', 'critical', '每个 NC 文件必须绑定 model_revision 和 element_guid。')],
    fileTypes: ['.ifc', '.nc', '.dxf', '.step', '.xlsx', '.pdf', '.json'],
    visualization: {
      mode: 'timeline',
      title: '工厂排产和生产线 HMI',
      layers: ['工序路线', '下料利用率', '焊接状态', '涂装膜厚', '质检结果', '返工'],
      telemetry: ['line_load', 'cut_yield', 'qc_pass_rate', 'rework_count'],
    },
    standards: ['AWS D1.1', 'EN 1090', 'AS/NZS 5131', 'GB 50205', 'GB 50661'],
    dataObjects: ['production_plans', 'process_routes', 'cutting_optimizations', 'cnc_files', 'weld_records', 'coating_records', 'factory_qc', 'mes_sync_jobs', 'component_codes', 'rework_orders'],
    routeHref: '/app/modules/production_manufacturing',
    schemaRef: 'module.schema/production_manufacturing.v1',
  },
  {
    id: 'construction_management',
    order: 9,
    zhName: '施工管理',
    enName: 'Construction Management',
    track: 'site',
    status: 'active',
    summary: '覆盖施工方案、进度、质量、安全、日志、AR、360、扫描、无人机、机器人、IoT、整改和竣工资料。',
    objective: '把现场执行转为可审计、可追溯、可闭环的 Evidence Token。',
    subdomains: [
      { id: 'method-statement', name: '施工方案', purpose: '生成和审查专项施工方案。', ownerRole: '施工技术负责人', capabilityLevel: 'automation' },
      { id: 'progress', name: '进度', purpose: '跟踪计划、实际、偏差和纠偏。', ownerRole: '计划工程师', capabilityLevel: 'simulation' },
      { id: 'quality', name: '质量', purpose: '检查、缺陷、整改和验收闭环。', ownerRole: '质量工程师', capabilityLevel: 'workflow' },
      { id: 'safety', name: '安全', purpose: '风险识别、作业许可和安全整改。', ownerRole: '安全工程师', capabilityLevel: 'automation' },
      { id: 'daily-log', name: '日志', purpose: '施工日志、监理日志和旁站记录。', ownerRole: '监理工程师', capabilityLevel: 'workflow' },
      { id: 'ar-field', name: 'AR', purpose: 'AR 辅助安装、复核和定位。', ownerRole: '现场工程师', capabilityLevel: 'simulation' },
      { id: 'panorama-360', name: '360 全景', purpose: '现场全景巡检和进度影像。', ownerRole: '资料员', capabilityLevel: 'workflow' },
      { id: 'scan-3d', name: '三维扫描', purpose: 'LiDAR/E57 控制点和残差校核。', ownerRole: '测量工程师', capabilityLevel: 'automation' },
      { id: 'oblique-drone', name: '倾斜摄影 / 无人机', purpose: '无人机影像和倾斜摄影测量。', ownerRole: '无人机飞手', capabilityLevel: 'simulation' },
      { id: 'robot-iot', name: '建筑机器人 / IoT', purpose: '机器人、传感器和设备状态接入。', ownerRole: '智能建造工程师', capabilityLevel: 'workflow' },
      { id: 'visual-compare', name: '影像对比', purpose: '影像、模型、计划进度对齐。', ownerRole: 'BIM 工程师', capabilityLevel: 'automation' },
      { id: 'rectification', name: '整改闭环', purpose: 'NCR、RFI、整改通知和复验。', ownerRole: '监理工程师', capabilityLevel: 'workflow' },
      { id: 'completion-docs', name: '竣工资料', purpose: '汇总验收、检测、签章和归档资料。', ownerRole: '资料负责人', capabilityLevel: 'workflow' },
    ],
    inputs: ['detailed_design', 'production_manufacturing', 'material_logistics', 'standard_library'],
    outputs: ['digital_twin', 'digital_archive'],
    artifacts: [
      artifact('evidence-token', 'Evidence Token', 'JSON', '监理工程师', ['照片', '视频', '记录']),
      artifact('site-daily-log', '施工/监理日志', 'PDF', '现场工程师', ['天气', '人机料', '事件']),
      artifact('rectification-loop', '整改闭环包', 'PDF + BCF', '质量工程师', ['NCR', '复验记录']),
    ],
    workflowStates: workflow('construction_management'),
    agentGates: gates(),
    tasks: [
      task('cs-t1', '生成吊装专项方案审查意见', 'Evaluator Agent', 'doing'),
      task('cs-t2', '对齐 360 影像、点云和 4D 进度', 'BIM 工程师', 'todo'),
    ],
    approvals: [approval('cs-a1', '隐蔽工程和关键工序验收', '总监理工程师')],
    risks: [risk('cs-r1', '现场证据缺少时间/位置/构件绑定', 'critical', '影像和记录必须绑定 element_id、geo、time 和责任人。')],
    fileTypes: ['.pdf', '.jpg', '.mp4', '.e57', '.las', '.ply', '.bcf', '.ifc', '.json'],
    visualization: {
      mode: 'hmi',
      title: '现场执行 HMI 和证据地图',
      layers: ['进度', '质量', '安全', 'AR', '360', '三维扫描', '倾斜摄影', '无人机', 'IoT', '整改'],
      telemetry: ['schedule_variance', 'open_ncr', 'safety_risk', 'evidence_completeness'],
    },
    standards: ['GB 55006', 'GB 50205', 'OSHA', 'ISO 45001', 'ISO 19650 CDE'],
    dataObjects: ['method_statements', 'schedules', 'quality_defects', 'safety_hazards', 'daily_logs', 'panorama_captures', 'scan_batches', 'drone_flights', 'robot_events', 'iot_readings', 'rectification_orders', 'completion_documents'],
    routeHref: '/app/modules/construction_management',
    schemaRef: 'module.schema/construction_management.v1',
  },
  {
    id: 'digital_twin',
    order: 10,
    zhName: '数字孪生',
    enName: 'Digital Twin',
    track: 'twin',
    status: 'active',
    summary: 'WebGPU 优先、Three.js fallback 的重钢结构数字孪生,融合 IFC、GLB、点云、360、三维扫描、倾斜摄影和多图层叠加。',
    objective: '将 BIM 语义、现场实景、IoT、进度、质量、安全和成本叠加为可编辑 Twin Token。',
    subdomains: [
      { id: 'webgpu-render', name: 'WebGPU 优先渲染状态', purpose: '检测 GPU 能力并优先走 WebGPU 渲染。', ownerRole: '前端图形工程师', capabilityLevel: 'simulation' },
      { id: 'three-fallback', name: 'Three.js fallback 状态', purpose: 'WebGPU 不可用时保留稳定兼容层。', ownerRole: '前端工程师', capabilityLevel: 'foundation' },
      { id: 'source-assets', name: 'IFC/GLB/点云/360/三维扫描/倾斜摄影数据源', purpose: '登记所有实景和模型来源。', ownerRole: 'BIM 经理', capabilityLevel: 'workflow' },
      { id: 'component-tree', name: '构件树', purpose: '提供 Site / Building / Level / Zone / Element 可编辑层级。', ownerRole: 'BIM 工程师', capabilityLevel: 'automation' },
      { id: 'progress-compare', name: '进度对比', purpose: '对齐计划进度、现场影像和模型状态。', ownerRole: '计划工程师', capabilityLevel: 'simulation' },
      { id: 'overlays', name: '质量/安全/成本叠加图层', purpose: '叠加缺陷、风险、成本和整改状态。', ownerRole: '项目经理', capabilityLevel: 'simulation' },
    ],
    inputs: ['construction_management', 'detailed_design', 'material_logistics', 'production_manufacturing'],
    outputs: ['digital_archive', 'settings_center'],
    artifacts: [
      artifact('twin-token', 'Twin Token', 'JSON + GLB', '孪生工程师', ['构件树', '图层状态']),
      artifact('reality-layer', '3DGS/点云现实捕捉层', 'SPZ + PLY + E57', '测量工程师', ['360 影像', 'LiDAR 控制点']),
      artifact('overlay-pack', '质量/安全/成本叠加图层', 'JSON', '项目经理', ['风险热区', '进度偏差']),
    ],
    workflowStates: workflow('digital_twin'),
    agentGates: gates(),
    tasks: [
      task('dt-t1', '连接 WebGPU 检测、Three.js fallback 和构件树', '前端图形工程师', 'doing'),
      task('dt-t2', '绑定 IFC/GLB/点云/360 数据源', 'BIM 经理', 'review'),
    ],
    approvals: [approval('dt-a1', 'Twin Token 发布审批', '项目总工')],
    risks: [risk('dt-r1', '3DGS 与 LiDAR 点云语义混淆', 'high', '3DGS 作为影像实景层,点云作为测量控制和残差校核。')],
    fileTypes: ['.ifc', '.glb', '.gltf', '.spz', '.ply', '.e57', '.las', '.mp4', '.jpg', '.json'],
    visualization: {
      mode: 'hmi',
      title: 'WebGPU 数字孪生主视口',
      layers: ['WebGPU-ready', 'Three.js fallback', 'IFC', 'GLB', '点云', '360', '三维扫描', '倾斜摄影', '进度', '质量', '安全', '成本'],
      telemetry: ['webgpu_status', 'fallback_status', 'component_count', 'overlay_count'],
    },
    standards: ['IFC4.3', 'ISO 23247', 'OpenUSD', 'ISO 19650', 'AISC/EN/GB/AS mapping'],
    dataObjects: ['twin_models', 'component_tree', 'reality_captures', 'scan_batches', 'panorama_assets', 'oblique_photo_sets', 'iot_streams', 'progress_overlays', 'quality_overlays', 'safety_overlays', 'cost_overlays'],
    routeHref: '/app/modules/digital_twin',
    schemaRef: 'module.schema/digital_twin.v1',
  },
  {
    id: 'digital_archive',
    order: 11,
    zhName: '数字档案',
    enName: 'Digital Archive',
    track: 'archive',
    status: 'planned',
    summary: '合同、标准族库、图纸模型、检测、签章、IoT 历史、竣工资料和企业文宣的长期留存。',
    objective: '把项目全过程交付物归档为可检索、可审计、可长期保存的 Archive Token。',
    subdomains: [
      { id: 'contracts', name: '合同管理', purpose: '合同、补充协议、签章和履约证据。', ownerRole: '商务经理', capabilityLevel: 'workflow' },
      { id: 'drawings-models', name: '图纸模型', purpose: '归档施工图、IFC、GLB、BCF 和模型版本。', ownerRole: '资料负责人', capabilityLevel: 'workflow' },
      { id: 'quality-docs', name: '检测与验收', purpose: '归档检测报告、验收记录和整改闭环。', ownerRole: '质量负责人', capabilityLevel: 'workflow' },
      { id: 'enterprise-media', name: '企业文宣', purpose: '沉淀案例、宣传图文和视频素材。', ownerRole: '品牌负责人', capabilityLevel: 'automation' },
    ],
    inputs: ['construction_management', 'digital_twin', 'standard_library'],
    outputs: [],
    artifacts: [
      artifact('archive-token', 'Archive Token', 'JSON', '资料负责人', ['归档清单', '签章记录']),
      artifact('handover-package', '竣工移交包', 'ZIP + PDF/A', '项目经理', ['验收报告', '模型版本']),
    ],
    workflowStates: workflow('digital_archive'),
    agentGates: gates(),
    tasks: [
      task('da-t1', '生成竣工资料目录和缺失项清单', 'Archive Agent', 'doing'),
      task('da-t2', '归档合同、模型和检测报告版本', '资料负责人', 'todo'),
    ],
    approvals: [approval('da-a1', '竣工档案移交审批', '业主代表')],
    risks: [risk('da-r1', '签章和版本链不完整', 'high', '归档前执行不可篡改哈希和签章完整性检查。')],
    fileTypes: ['.pdf', '.pdfa', '.ifc', '.glb', '.zip', '.xlsx', '.mp4', '.json'],
    visualization: {
      mode: 'archive',
      title: '证据链和长期留存目录',
      layers: ['合同', '图纸', '模型', '检测', '签章', '文宣', '保留期限'],
      telemetry: ['archive_completeness', 'signature_rate', 'retention_risk'],
    },
    standards: ['ISO 19650 CDE', 'OAIS', 'CJJ/T 117', 'e-signature audit'],
    dataObjects: ['contracts', 'archive_items', 'retention_policies', 'signature_events', 'media_assets'],
    routeHref: '/app/modules/digital_archive',
    schemaRef: 'module.schema/digital_archive.v1',
  },
  {
    id: 'finance_hr',
    order: 12,
    zhName: '财务人力',
    enName: 'Finance & HR',
    track: 'cost',
    status: 'planned',
    summary: '覆盖合同、收付款、发票、成本、预算、人员、班组、绩效、考勤和组织能力。',
    objective: '把项目生产过程转成可核算、可付款、可审计、可绩效评价的 Enterprise Token。',
    subdomains: [
      { id: 'contract-ledger', name: '合同台账', purpose: '管理主合同、分包合同、补充协议、履约节点和合同风险。', ownerRole: '商务经理', capabilityLevel: 'workflow' },
      { id: 'payment-invoice', name: '付款与发票', purpose: '管理应收、应付、发票、付款申请和审批状态。', ownerRole: '财务经理', capabilityLevel: 'workflow' },
      { id: 'cost-control', name: '成本控制', purpose: '对接 BOQ、采购、生产、施工和变更形成动态成本。', ownerRole: '成本经理', capabilityLevel: 'automation' },
      { id: 'hr-crew', name: '人员与班组', purpose: '管理项目人员、班组、资质、考勤、工效和安全培训。', ownerRole: '人力资源经理', capabilityLevel: 'workflow' },
      { id: 'performance', name: '绩效与结算', purpose: '按进度、质量、安全、成本和交付物完成度形成绩效与结算依据。', ownerRole: '项目负责人', capabilityLevel: 'simulation' },
    ],
    inputs: ['planning_management', 'quantity_costing', 'material_logistics', 'production_manufacturing', 'construction_management'],
    outputs: ['digital_archive', 'settings_center'],
    artifacts: [
      artifact('enterprise-token', 'Enterprise Token', 'JSON', '财务经理', ['合同台账', '付款记录']),
      artifact('cashflow-report', '现金流报告', 'XLSX + PDF', '商务经理', ['成本基线', '收付款计划']),
      artifact('crew-performance-pack', '班组绩效包', 'PDF + JSON', '项目经理', ['考勤', '质量安全记录']),
    ],
    workflowStates: workflow('finance_hr'),
    agentGates: gates(),
    tasks: [
      task('fh-t1', '生成项目现金流和付款审批清单', '财务经理', 'doing'),
      task('fh-t2', '同步班组考勤、质量安全和绩效记录', '人力资源经理', 'todo'),
    ],
    approvals: [approval('fh-a1', '付款申请与成本偏差审批', '财务负责人')],
    risks: [risk('fh-r1', '付款、合同、进度和质量证据脱节', 'critical', '付款节点必须绑定合同条款、完成量、验收和发票。')],
    fileTypes: ['.xlsx', '.csv', '.pdf', '.docx', '.json'],
    visualization: {
      mode: 'board',
      title: '合同、现金流、成本和人员绩效看板',
      layers: ['合同', '付款', '发票', '成本', '人员', '班组', '绩效'],
      telemetry: ['cashflow_variance', 'invoice_pending', 'crew_productivity', 'cost_overrun_risk'],
    },
    standards: ['PMBOK cost management', 'ISO 9001 records', 'SOC 2 audit trail', 'local tax invoice rules'],
    dataObjects: ['contracts', 'payment_requests', 'invoices', 'cashflow_items', 'cost_ledgers', 'employees', 'crews', 'attendance_records', 'performance_scores'],
    routeHref: '/app/modules/finance_hr',
    schemaRef: 'module.schema/finance_hr.v1',
  },
  {
    id: 'ai_center',
    order: 13,
    zhName: 'AI中心',
    enName: 'AI Capability Center',
    track: 'platform',
    status: 'foundation',
    summary: '统一配置企业 AI、API、RAG、MCP、Agent、OpenClaw、模型路由、提示词、安全审计和成本策略。',
    objective: 'AI中心只负责能力配置、工具注册、模型路由、知识库、Agent 编排、OpenClaw 自动化和安全治理；AI任务、图纸解析、模型生成、清单生成、审查助手下沉到各业务模块执行。',
    subdomains: [
      { id: 'model-provider-registry', name: '模型供应商配置', purpose: '配置 OpenAI、国产大模型、本地模型、视觉模型、多模态模型和私有部署端点。', ownerRole: 'AI平台管理员', capabilityLevel: 'foundation' },
      { id: 'api-gateway', name: 'AI API 网关', purpose: '统一管理 API Key、调用限额、租户隔离、成本统计、熔断和审计日志。', ownerRole: '平台管理员', capabilityLevel: 'workflow' },
      { id: 'rag-knowledge-base', name: 'RAG 知识库', purpose: '管理规范、合同、图纸、BIM 资料、企业标准、施工方案和历史项目语料。', ownerRole: '知识库管理员', capabilityLevel: 'automation' },
      { id: 'mcp-tool-registry', name: 'MCP 工具注册', purpose: '注册文件、数据库、BIM、造价、进度、文档、ERP 和外部系统工具。', ownerRole: '集成工程师', capabilityLevel: 'workflow' },
      { id: 'agent-orchestration', name: 'Agent 编排', purpose: '配置市场、计划、设计、造价、材料、施工、档案等业务 Agent 的职责、工具、权限和审批边界。', ownerRole: 'AI应用负责人', capabilityLevel: 'automation' },
      { id: 'openclaw-runtime', name: 'OpenClaw 自动化', purpose: '配置浏览器自动化、桌面自动化、任务执行沙箱、人工确认和操作回放。', ownerRole: '自动化管理员', capabilityLevel: 'automation' },
      { id: 'ai-safety-audit', name: 'AI 安全与审计', purpose: '管理提示词审计、输出校验、权限控制、敏感数据脱敏、人工审批和责任追踪。', ownerRole: '安全审计员', capabilityLevel: 'workflow' },
    ],
    inputs: ['standard_library', 'settings_center'],
    outputs: ['marketing_service', 'planning_management', 'concept_design', 'standard_library', 'detailed_design', 'quantity_costing', 'material_logistics', 'production_manufacturing', 'construction_management', 'digital_twin', 'digital_archive', 'finance_hr'],
    artifacts: [
      artifact('ai-capability-token', 'AI Capability Token', 'JSON', 'AI平台管理员', ['模型配置', '工具权限']),
      artifact('rag-collection-pack', 'RAG 知识库配置包', 'JSON + Index', '知识库管理员', ['语料版本', '向量索引']),
      artifact('agent-policy-pack', 'Agent 策略包', 'YAML', 'AI应用负责人', ['工具边界', '审批策略']),
    ],
    workflowStates: workflow('ai_center'),
    agentGates: gates(),
    tasks: [
      task('ai-t1', '配置模型供应商、RAG 知识库和 MCP 工具注册表', 'AI平台管理员', 'doing'),
      task('ai-t2', '发布业务 Agent 权限、审批和成本策略', 'AI应用负责人', 'todo'),
    ],
    approvals: [approval('ai-a1', 'AI 能力与工具权限发布审批', '平台负责人')],
    risks: [risk('ai-r1', 'AI 工具越权调用或输出不可追溯', 'critical', '所有 Agent 工具调用必须绑定租户、模块、审批边界和审计事件。')],
    fileTypes: ['.json', '.yaml', '.md', '.csv', '.sqlite', '.parquet'],
    visualization: {
      mode: 'settings',
      title: 'AI 能力、RAG、MCP、Agent 与 OpenClaw 控制台',
      layers: ['模型供应商', 'API网关', 'RAG', 'MCP', 'Agent', 'OpenClaw', '安全审计', '成本'],
      telemetry: ['token_cost', 'rag_hit_rate', 'tool_call_count', 'guardrail_block_count'],
    },
    standards: ['NIST AI RMF', 'ISO 27001', 'SOC 2', 'PIPL/GDPR privacy controls', 'MCP tool governance'],
    dataObjects: ['model_providers', 'api_keys', 'rag_collections', 'mcp_servers', 'agent_profiles', 'tool_permissions', 'openclaw_jobs', 'prompt_templates', 'guardrails', 'ai_audit_logs', 'cost_policies'],
    routeHref: '/app/modules/ai_center',
    schemaRef: 'module.schema/ai_center.v1',
  },
  {
    id: 'settings_center',
    order: 14,
    zhName: '设置中心',
    enName: 'Settings Center',
    track: 'platform',
    status: 'foundation',
    summary: '租户、RBAC、模型路由、SLA、规范库版本、存储策略、审计和 UI 偏好的平台控制中心。',
    objective: '让模块、Agent、Router、Schema、规则和权限都可配置、可审计、可回滚。',
    subdomains: [
      { id: 'tenant-rbac', name: '租户与 RBAC', purpose: '管理组织、角色、权限和隔离策略。', ownerRole: '平台管理员', capabilityLevel: 'foundation' },
      { id: 'model-routing', name: '模型路由', purpose: '配置 ModelRouter、InferenceRouter 和成本策略。', ownerRole: 'AI 平台工程师', capabilityLevel: 'workflow' },
      { id: 'sla-policy', name: 'SLA 与回滚', purpose: '管理模块 SLA、超时、重试和 RollbackGuard。', ownerRole: 'SRE', capabilityLevel: 'workflow' },
      { id: 'schema-rules', name: 'Schema / 规则版本', purpose: '管理 Module Schema、JSON Schema 和规则版本。', ownerRole: '架构师', capabilityLevel: 'foundation' },
    ],
    inputs: ['standard_library'],
    outputs: activeModuleIds.filter((id) => id !== 'settings_center'),
    artifacts: [
      artifact('governance-token', 'Governance Token', 'JSON', '平台管理员', ['策略版本', '审计日志']),
      artifact('route-table', '模型与工具路由表', 'YAML', 'AI 平台工程师', ['成本预算', 'fallback']),
    ],
    workflowStates: workflow('settings_center'),
    agentGates: gates(),
    tasks: [
      task('sc-t1', '生成模块 SLA 和审批权限矩阵', '平台管理员', 'doing'),
      task('sc-t2', '配置 Module Schema 版本兼容策略', '架构师', 'todo'),
    ],
    approvals: [approval('sc-a1', '全局治理策略发布', '平台负责人')],
    risks: [risk('sc-r1', '模块策略漂移导致权限或 SLA 不一致', 'critical', '所有策略发布必须产生审计事件和版本回滚点。')],
    fileTypes: ['.yaml', '.json', '.md', '.csv'],
    visualization: {
      mode: 'settings',
      title: '平台治理和 Router 控制台',
      layers: ['租户', 'RBAC', '模型路由', 'SLA', 'Schema', '规则', '审计'],
      telemetry: ['policy_version', 'sla_breach_count', 'audit_event_count'],
    },
    standards: ['SOC 2', 'ISO 27001', 'NIST AI RMF', 'PIPL/GDPR privacy controls'],
    dataObjects: ['tenants', 'users', 'roles', 'model_routes', 'sla_budgets', 'schema_versions', 'rule_versions', 'audit_events'],
    routeHref: '/app/modules/settings_center',
    schemaRef: 'module.schema/settings_center.v1',
  },
];

export const moduleRegistry = Object.fromEntries(
  moduleSpecs.map((spec) => [spec.id, spec]),
) as Record<ModuleId, ModuleSpec>;

export function normalizeModuleId(moduleId: string): ModuleId | null {
  const canonical = moduleId.trim().toLowerCase().replaceAll('-', '_');
  const legacyConstructionModuleId = `construction_${'supervision'}`;
  const normalized = canonical === legacyConstructionModuleId ? 'construction_management' : canonical;
  if ((activeModuleIds as readonly string[]).includes(normalized)) {
    return normalized as ModuleId;
  }
  return null;
}

export function getModuleSpec(moduleId: string): ModuleSpec {
  const normalized = normalizeModuleId(moduleId);
  if (!normalized) {
    throw new Error(`Unknown module: ${moduleId}`);
  }
  return moduleRegistry[normalized];
}

export function getModuleDependencyIssues(): string[] {
  const ids = new Set<ModuleId>(activeModuleIds);
  return moduleSpecs.flatMap((spec) =>
    [...spec.inputs, ...spec.outputs]
      .filter((moduleId) => !ids.has(moduleId))
      .map((moduleId) => `${spec.id} references missing module ${moduleId}`),
  );
}

export function getModuleReadinessScore(): number {
  const weights: Record<ModuleStatus, number> = {
    active: 1,
    pilot: 0.74,
    foundation: 0.68,
    planned: 0.42,
  };
  const total = moduleSpecs.reduce((sum, spec) => sum + weights[spec.status], 0);
  return Math.round((total / moduleSpecs.length) * 1000) / 10;
}

export function getPlatformStats() {
  return {
    modules: moduleSpecs.length,
    artifacts: moduleSpecs.reduce((sum, spec) => sum + spec.artifacts.length, 0),
    subdomains: moduleSpecs.reduce((sum, spec) => sum + spec.subdomains.length, 0),
    risks: moduleSpecs.reduce((sum, spec) => sum + spec.risks.length, 0),
    readiness: getModuleReadinessScore(),
  };
}
