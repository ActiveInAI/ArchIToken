// lib/module-registry.ts - ArchIToken frontend Module Schema fixtures
// License: Apache-2.0

export type ModuleId =
  | 'marketing_service'
  | 'concept_design'
  | 'standard_library'
  | 'detailed_design'
  | 'quantity_costing'
  | 'material_logistics'
  | 'production_manufacturing'
  | 'construction_supervision'
  | 'digital_twin'
  | 'digital_archive'
  | 'settings_center';

export type LegacyModuleAlias = 'manufacturing' | 'fabrication';
export type AnyModuleId = ModuleId | LegacyModuleAlias;

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
  legacyAliases?: LegacyModuleAlias[];
}

export const activeModuleIds = [
  'marketing_service',
  'concept_design',
  'standard_library',
  'detailed_design',
  'quantity_costing',
  'material_logistics',
  'production_manufacturing',
  'construction_supervision',
  'digital_twin',
  'digital_archive',
  'settings_center',
] as const satisfies readonly ModuleId[];

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
    outputs: ['concept_design'],
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
    id: 'concept_design',
    order: 2,
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
    order: 3,
    zhName: '标准族库',
    enName: 'Standard Library',
    track: 'governance',
    status: 'foundation',
    summary: '工程知识底座,管理规范、族库、模板、材质、图纸、模型、做法、规则和版本。',
    objective: '让所有模块通过统一规则库和版本库获取工程语义和法域约束。',
    subdomains: [
      { id: 'standards', name: '标准规范', purpose: '管理中国、美国、欧洲、澳洲和企业标准。', ownerRole: '标准工程师', capabilityLevel: 'automation' },
      { id: 'families', name: '族库构件', purpose: '管理重钢构件、节点、连接件和机电族。', ownerRole: 'BIM 经理', capabilityLevel: 'workflow' },
      { id: 'templates', name: '样板文件', purpose: '管理项目、图纸、报价、BIM 和交付模板。', ownerRole: '技术管理员', capabilityLevel: 'foundation' },
      { id: 'materials', name: '材质库', purpose: '管理钢材、防火、防腐、保温和装饰材料。', ownerRole: '材料工程师', capabilityLevel: 'workflow' },
      { id: 'drawings', name: '图纸', purpose: '管理标准图集、节点详图和 CAD/PDF 来源。', ownerRole: '设计管理员', capabilityLevel: 'workflow' },
      { id: 'models', name: '模型', purpose: '管理 IFC、GLB、参数化构件和孪生模型。', ownerRole: 'BIM 经理', capabilityLevel: 'workflow' },
      { id: 'methods', name: '做法库', purpose: '管理墙体、楼板、屋面、防水、防火和装配做法。', ownerRole: '工艺工程师', capabilityLevel: 'automation' },
      { id: 'rules', name: '规则库', purpose: '管理结构、造价、施工、验收和安全规则。', ownerRole: '规则工程师', capabilityLevel: 'automation' },
      { id: 'versions', name: '版本库', purpose: '管理规范、构件、做法和企业知识版本。', ownerRole: '文控经理', capabilityLevel: 'foundation' },
    ],
    inputs: [],
    outputs: ['concept_design', 'detailed_design', 'quantity_costing', 'construction_supervision'],
    artifacts: [
      artifact('code-clause-token', 'Code Clause Token', 'JSON', '标准工程师', ['条文来源', '法域映射']),
      artifact('family-pack', '族库构件包', 'IFC + GLB', 'BIM 经理', ['属性集', '版本记录']),
      artifact('rule-pack', '规则库发布包', 'JSON Schema', '规则工程师', ['规则单元测试', '适用范围']),
    ],
    workflowStates: workflow('standard_library'),
    agentGates: gates(),
    tasks: [
      task('sl-t1', '补齐 GB/AISC/Eurocode/AS 关键条文映射', '标准工程师', 'doing'),
      task('sl-t2', '发布 Q355B 重钢构件族版本', 'BIM 经理', 'review'),
    ],
    approvals: [approval('sl-a1', '企业标准族库版本发布', '技术总监')],
    risks: [risk('sl-r1', '条文版本和项目法域错配', 'critical', '所有规则必须带 jurisdiction、version 和 effective_date。')],
    fileTypes: ['.ifc', '.glb', '.rfa', '.dwg', '.dxf', '.pdf', '.json', '.xlsx'],
    visualization: {
      mode: 'board',
      title: '知识资产和规则版本图谱',
      layers: ['规范条文', '族库构件', '样板文件', '材质', '规则版本'],
      telemetry: ['coverage_rate', 'deprecated_items', 'rule_pass_rate'],
    },
    standards: ['buildingSMART IFC', 'ISO 19650 CDE', 'AISC 360', 'EN 1993', 'AS/NZS 5131', 'GB 50017'],
    dataObjects: ['standards', 'family_components', 'templates', 'materials', 'drawings', 'models', 'method_library', 'rule_library', 'version_registry'],
    routeHref: '/app/modules/standard_library',
    schemaRef: 'module.schema/standard_library.v1',
  },
  {
    id: 'detailed_design',
    order: 4,
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
    outputs: ['quantity_costing', 'production_manufacturing', 'construction_supervision', 'digital_twin'],
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
    order: 5,
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
    order: 6,
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
    outputs: ['construction_supervision', 'digital_twin'],
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
    order: 7,
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
    outputs: ['material_logistics', 'construction_supervision', 'digital_twin'],
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
    legacyAliases: ['manufacturing', 'fabrication'],
  },
  {
    id: 'construction_supervision',
    order: 8,
    zhName: '施工监理',
    enName: 'Construction Supervision',
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
    workflowStates: workflow('construction_supervision'),
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
    routeHref: '/app/modules/construction_supervision',
    schemaRef: 'module.schema/construction_supervision.v1',
  },
  {
    id: 'digital_twin',
    order: 9,
    zhName: '数字孪生',
    enName: 'Digital Twin',
    track: 'twin',
    status: 'active',
    summary: 'WebGPU 优先、Three.js fallback 的重钢结构数字孪生,融合 IFC、GLB、点云、360、三维扫描、倾斜摄影和多图层叠加。',
    objective: '将 BIM 语义、现场实景、IoT、进度、质量、安全和成本叠加为可编辑 Twin Token。',
    subdomains: [
      { id: 'webgpu-render', name: 'WebGPU 优先渲染状态', purpose: '检测 GPU 能力并优先走 WebGPU 渲染。', ownerRole: '前端图形工程师', capabilityLevel: 'simulation' },
      { id: 'three-fallback', name: 'Three.js fallback 状态', purpose: 'WebGPU 不可用时保留稳定兼容层。', ownerRole: '前端工程师', capabilityLevel: 'foundation' },
      { id: 'source-placeholders', name: 'IFC/GLB/点云/360/三维扫描/倾斜摄影占位数据', purpose: '登记所有实景和模型来源。', ownerRole: 'BIM 经理', capabilityLevel: 'workflow' },
      { id: 'component-tree', name: '构件树', purpose: '提供 Site / Building / Level / Zone / Element 可编辑层级。', ownerRole: 'BIM 工程师', capabilityLevel: 'automation' },
      { id: 'progress-compare', name: '进度对比', purpose: '对齐计划进度、现场影像和模型状态。', ownerRole: '计划工程师', capabilityLevel: 'simulation' },
      { id: 'overlays', name: '质量/安全/成本叠加图层', purpose: '叠加缺陷、风险、成本和整改状态。', ownerRole: '项目经理', capabilityLevel: 'simulation' },
    ],
    inputs: ['construction_supervision', 'detailed_design', 'material_logistics', 'production_manufacturing'],
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
      task('dt-t2', '绑定 IFC/GLB/点云/360 占位数据', 'BIM 经理', 'review'),
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
    order: 10,
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
    inputs: ['construction_supervision', 'digital_twin', 'standard_library'],
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
    id: 'settings_center',
    order: 11,
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
  if (moduleId === 'manufacturing' || moduleId === 'fabrication') {
    return 'production_manufacturing';
  }
  if ((activeModuleIds as readonly string[]).includes(moduleId)) {
    return moduleId as ModuleId;
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
