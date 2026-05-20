// lib/steel-business-blueprint.ts - Heavy steel workflow, AI commercialization, and Token governance blueprint
// License: Apache-2.0

import type { ModuleId } from './module-registry';

export interface SteelSourceDocument {
  id: string;
  title: string;
  role: string;
  sourceFile: string;
  anchors: string[];
}

export interface SteelLifecycleStage {
  gate: string;
  name: string;
  owner: string;
  modules: ModuleId[];
  evidence: string[];
  exitRule: string;
}

export interface SteelComponentState {
  code: string;
  label: string;
  moduleId: ModuleId;
  meaning: string;
}

export interface AiCommercializationCapability {
  moduleId: ModuleId;
  domain: string;
  aiJobs: string[];
  product: string;
  monetization: string;
}

export interface AiGatewayRoute {
  route: string;
  scope: string;
  workloads: string[];
  controls: string[];
}

export interface SteelWorkflowChain {
  id: string;
  sourceDocumentId: string;
  title: string;
  modules: ModuleId[];
  dataObjects: string[];
  aiOutputs: string[];
  revenueMode: string;
  auditGates: string[];
}

export const steelSourceDocuments: SteelSourceDocument[] = [
  {
    id: 'BIM-WF-STEEL-001',
    title: '钢结构方案设计生产一体化协同工作流',
    role: '企业生产环境可执行版',
    sourceFile: '钢结构方案深化生产一体化协同工作流(1).html',
    anchors: ['BIM主模型', 'G0-G6关口', 'S01-S10构件状态', 'WEB协同职责', '模型冻结后生产下发'],
  },
  {
    id: 'HS-AI-FULLCHAIN-001',
    title: '重钢全链条AI业务商业化体系',
    role: '内部提效、业务协同、数据资产、AI中台、产品封装、商业盈利',
    sourceFile: '重钢全链条AI业务商业化体系.html',
    anchors: ['AI应用层', 'AI中台', 'Token计量', '客户产品包', 'CRM/BIM/ERP/MES/WMS/QMS/Finance接入'],
  },
  {
    id: 'HS-AI-GLOBAL-CN-001',
    title: '全球业务AI部署、API接入与Token商业化合规方案',
    role: '外部API + 中国大陆本地模型 + AI网关 + 数据分级 + 服务额度',
    sourceFile: '重钢全球AI与Token合规商业化方案建议.html',
    anchors: ['AI服务额度', '禁止现金退出与交易', '模型路由', '数据分级', '人工审批责任'],
  },
  {
    id: 'HS-HOTEL-DRAWING-CATALOG-198',
    title: '100间精品酒店 Q235B全栓接重钢装配式深化设计图纸完整目录',
    role: '198份图纸明细、8大深化专项、33个分组、P1/P2/P3交付节拍',
    sourceFile: '/home/insome/下载/重钢装配式酒店深化图纸目录.docx',
    anchors: ['Q235B全栓接', '198份图纸', 'P1先行55份', '孔位锁定', '无现场焊接', '65-75天交付'],
  },
  {
    id: 'ZFW-MKT-60D-PARTNER-001',
    title: '造房网市场推广策略具体执行步骤',
    role: '60天合伙人信任流转推广SOP',
    sourceFile: '/home/insome/下载/造房网｜市场推广策略 具体执行步骤(1).docx',
    anchors: ['线上冷启动', '0号合伙人', '10-15个合伙人网络', '样板房10步转化', '5%佣金', '7个工作日结算'],
  },
];

export const steelLifecycleStages: SteelLifecycleStage[] = [
  {
    gate: 'G0',
    name: '启动',
    owner: '项目经理',
    modules: ['marketing_service', 'planning_management', 'settings_center'],
    evidence: ['项目编码', '合同边界', '责任矩阵', '客户授权'],
    exitRule: '立项资料、WBS/CBS、审批路径和数据权限完成后进入方案。',
  },
  {
    gate: 'G1',
    name: '方案确认',
    owner: '方案设计师',
    modules: ['concept_design', 'standard_library', 'quantity_costing'],
    evidence: ['多方案比选', '场地约束', '钢量估算', '客户确认记录'],
    exitRule: '方案、投资边界、法域标准和可建造性初筛确认后移交深化。',
  },
  {
    gate: 'G2',
    name: '深化冻结',
    owner: 'BIM经理',
    modules: ['detailed_design', 'standard_library', 'ai_center'],
    evidence: ['IFC4.3模型', 'IDS报告', 'BCF闭环', '节点详图', '构件编码'],
    exitRule: '未冻结模型不得进入计量、生产或采购；所有问题必须闭环或带审批豁免。',
  },
  {
    gate: 'G3',
    name: '造价确认',
    owner: '商务经理',
    modules: ['quantity_costing', 'finance_hr'],
    evidence: ['MTO', 'BOQ', '价格来源', '变更测算', '目标成本基线'],
    exitRule: '模型工程量、清单编码、合同口径和价格快照一致后进入生产准备。',
  },
  {
    gate: 'G4',
    name: '生产下发',
    owner: '生产负责人',
    modules: ['production_manufacturing', 'material_logistics'],
    evidence: ['BOM', 'CNC/NC/DXF包', '工序路线', '质检计划', '采购计划'],
    exitRule: '生产工单、物料批次、CNC文件和模型版本绑定后放行。',
  },
  {
    gate: 'G5',
    name: '物流发运',
    owner: '物流经理',
    modules: ['material_logistics', 'construction_management', 'digital_twin'],
    evidence: ['包装单', '装车顺序', '运输许可', 'ETA', '签收证据'],
    exitRule: '发运批次、堆场位置、吊装顺序和现场接收计划一致后进入施工。',
  },
  {
    gate: 'G6',
    name: '施工验收',
    owner: '项目总工',
    modules: ['construction_management', 'digital_twin', 'digital_archive', 'finance_hr'],
    evidence: ['安装验收', '质量安全闭环', '现场影像', '竣工模型', '归档清单'],
    exitRule: '未关闭现场调整不得进入竣工；验收、签章、档案和经营结算必须同链闭环。',
  },
];

export const steelComponentStates: SteelComponentState[] = [
  { code: 'S01', label: '方案建模', moduleId: 'concept_design', meaning: '方案体块和初始构件关系已建立。' },
  { code: 'S02', label: '深化建模', moduleId: 'detailed_design', meaning: '构件几何、节点、属性和GUID进入深化。' },
  { code: 'S03', label: '深化冻结', moduleId: 'detailed_design', meaning: 'IFC/IDS/BCF和出图审签完成，允许下发。' },
  { code: 'S04', label: '造价确认', moduleId: 'quantity_costing', meaning: 'MTO、BOQ、价格来源和变更口径确认。' },
  { code: 'S05', label: '生产排产', moduleId: 'production_manufacturing', meaning: '生产批次、工序路线和CNC包已排入计划。' },
  { code: 'S06', label: '加工完成', moduleId: 'production_manufacturing', meaning: '加工、焊接、涂装、质检和包装完成。' },
  { code: 'S07', label: '已发运', moduleId: 'material_logistics', meaning: '包装、装车、运输和ETA记录已生成。' },
  { code: 'S08', label: '已到场', moduleId: 'material_logistics', meaning: '现场到货、损伤照片、证书和堆场位置已登记。' },
  { code: 'S09', label: '已安装', moduleId: 'construction_management', meaning: '吊装安装、定位复核和现场影像证据已绑定。' },
  { code: 'S10', label: '已验收', moduleId: 'digital_archive', meaning: '验收、签章、竣工模型和归档清单完成。' },
];

export const aiCommercializationCapabilities: AiCommercializationCapability[] = [
  {
    moduleId: 'marketing_service',
    domain: '市场客服',
    aiJobs: ['客户画像', '询盘识别', '多语种对话', '线索评分'],
    product: 'AI钢构报价助手 / 海外询盘分析',
    monetization: '按AI服务包、客户席位、API调用和转化服务计费。',
  },
  {
    moduleId: 'planning_management',
    domain: '计划管理',
    aiJobs: ['WBS生成', '资源冲突识别', '里程碑风险预测', '审批路径推荐'],
    product: '项目履约控制台',
    monetization: '按项目计划包、风险评估任务和企业版席位计费。',
  },
  {
    moduleId: 'concept_design',
    domain: '方案设计',
    aiJobs: ['方案比选', '钢量估算', '布局建议', '可建造性初筛'],
    product: 'AI方案报告 / 概念设计包',
    monetization: '按方案包、展示包和客户协同空间计费。',
  },
  {
    moduleId: 'standard_library',
    domain: '标准族库',
    aiJobs: ['标准条文解析', '构件族库生成', '规则单测', '法域映射'],
    product: '企业规则库 / 标准族库订阅',
    monetization: '按标准包、规则包、企业知识库和更新服务计费。',
  },
  {
    moduleId: 'detailed_design',
    domain: '深化设计',
    aiJobs: ['构件识别', '节点检查', '编码审查', '出图缺陷扫描'],
    product: 'AI深化审查平台',
    monetization: '按模型审查、图纸审查、IDS/BCF任务和项目包计费。',
  },
  {
    moduleId: 'quantity_costing',
    domain: '计量造价',
    aiJobs: ['模型算量', 'BOQ匹配', '变更测算', '成本预测'],
    product: 'AI计量造价平台',
    monetization: '按清单行、算量任务、报价API和项目服务包计费。',
  },
  {
    moduleId: 'production_manufacturing',
    domain: '生产制造',
    aiJobs: ['排产建议', '下料优化', '工时预测', '质检预警'],
    product: '工厂AI排产 / 生产协同SaaS',
    monetization: '按产线、工单、CNC包和生产看板订阅计费。',
  },
  {
    moduleId: 'material_logistics',
    domain: '材料物流',
    aiJobs: ['采购预测', '库存预警', '发运优化', '堆场管理'],
    product: '构件物流追踪API',
    monetization: '按批次、车辆、API调用和客户查询额度计费。',
  },
  {
    moduleId: 'construction_management',
    domain: '施工管理',
    aiJobs: ['进度识别', '问题分类', '整改闭环', '质检图片识别'],
    product: '施工AI助手 / 移动交底助手',
    monetization: '按现场用户、证据处理量和整改任务计费。',
  },
  {
    moduleId: 'digital_twin',
    domain: '数字孪生',
    aiJobs: ['BIM/IoT/物流/施工状态融合', '实景层对齐', '运维热点生成'],
    product: '数字孪生交付平台',
    monetization: '按项目空间、三维资产容量、运维周期和业主交付包计费。',
  },
  {
    moduleId: 'digital_archive',
    domain: '数字档案',
    aiJobs: ['OCR归档', '资料索引', '缺项检查', '竣工资料生成'],
    product: 'AI数字档案系统',
    monetization: '按档案容量、OCR页数、归档包和长期保留服务计费。',
  },
  {
    moduleId: 'finance_hr',
    domain: '财务人力',
    aiJobs: ['发票识别', '现金流预测', '出口退税辅助', '班组绩效分析'],
    product: '财税补贴AI助手 / 项目经营看板',
    monetization: '按经营报表、预测任务、财税辅助包和企业席位计费。',
  },
  {
    moduleId: 'ai_center',
    domain: 'AI中心',
    aiJobs: ['模型路由', 'RAG治理', 'Agent编排', 'Token计量'],
    product: '企业AI中台 / AI网关',
    monetization: '按内部部门、客户账号、API账号和Token服务额度计费。',
  },
  {
    moduleId: 'settings_center',
    domain: '设置中心',
    aiJobs: ['权限模拟', '合规策略', '审计配置', '服务包配置'],
    product: '治理控制台',
    monetization: '按租户、法域模板、审计保留和安全策略包计费。',
  },
];

export const aiGatewayRoutes: AiGatewayRoute[] = [
  {
    route: '外部大模型 API',
    scope: '公开或已脱敏的客户沟通、销售、市场和通用报告任务。',
    workloads: ['多语种客服', '销售文案', '公开市场分析', '合同摘要初稿'],
    controls: ['AI网关鉴权', '脱敏', '内容安全', 'Token计量', '审计留痕'],
  },
  {
    route: '中国大陆本地模型',
    scope: 'BIM、图纸、底价、生产工艺、财务、人力和客户敏感数据。',
    workloads: ['IFC/图纸审查', '合同底价分析', '生产工艺建议', '财务税务辅助'],
    controls: ['私有云/本地GPU', '数据分级', 'RAG权限', '人工审批', '日志保留'],
  },
  {
    route: 'OCR / 视觉模型',
    scope: '图纸、表格、扫描件、现场照片、质检图片和档案影像。',
    workloads: ['图框表格抽取', '构件表识别', '现场进度识别', '档案OCR'],
    controls: ['原件绑定', '置信度阈值', '复核任务', '证据回写'],
  },
  {
    route: '预测与规则模型',
    scope: '成本、工期、质量、现金流、中标概率和法域规则。',
    workloads: ['成本预测', '工期风险', '回款预测', '规则阻断'],
    controls: ['版本化规则', '可解释指标', '审批门禁', '回滚点'],
  },
];

export const steelWorkflowChains: SteelWorkflowChain[] = [
  {
    id: 'steel-detailing-production-loop',
    sourceDocumentId: 'BIM-WF-STEEL-001',
    title: '方案深化生产施工交付闭环',
    modules: [
      'concept_design',
      'detailed_design',
      'quantity_costing',
      'production_manufacturing',
      'material_logistics',
      'construction_management',
      'digital_twin',
      'digital_archive',
    ],
    dataObjects: [
      'IFC4.3 主模型',
      'IDS/BCF 审查记录',
      '构件编码索引',
      'MTO/BOQ/BOM',
      'CNC/NC/DXF 下料包',
      '物流批次与到场签收',
      '竣工模型与数字档案',
    ],
    aiOutputs: [
      '方案比选和钢量估算',
      '深化节点缺陷扫描',
      '出图/编码/碰撞审查',
      '生产排产建议',
      '施工验收证据归档',
    ],
    revenueMode: '按项目空间、模型审查、出图审查、CNC包、竣工档案包和业主交付包计费。',
    auditGates: ['G1 方案确认', 'G2 深化冻结', 'G3 造价确认', 'G4 生产下发', 'G6 施工验收'],
  },
  {
    id: 'heavy-steel-commercial-ai-loop',
    sourceDocumentId: 'HS-AI-FULLCHAIN-001',
    title: '重钢全链条 AI 商业化闭环',
    modules: [
      'marketing_service',
      'planning_management',
      'concept_design',
      'quantity_costing',
      'finance_hr',
      'ai_center',
      'settings_center',
    ],
    dataObjects: [
      '客户线索与需求表单',
      '预付定金与电子合同',
      '报价方案与客户确认',
      'AI 服务包与 Token 额度',
      'API 调用账单和审计记录',
    ],
    aiOutputs: [
      '客户画像和线索评分',
      '多语种询盘识别',
      '方案草图和三维概念模型任务',
      '报价/成本/回款预测',
      'AI 服务利润看板',
    ],
    revenueMode: '按客户席位、AI 服务包、API 调用、Token 服务额度、私有模型托管和项目转化服务计费。',
    auditGates: ['G0 启动', 'G1 方案确认', '合同电子签章', '预付款确认', 'AI 服务额度开通'],
  },
  {
    id: 'global-ai-token-compliance-loop',
    sourceDocumentId: 'HS-AI-GLOBAL-CN-001',
    title: '全球 AI / Token 合规商业化闭环',
    modules: ['ai_center', 'settings_center', 'digital_archive', 'finance_hr', 'marketing_service'],
    dataObjects: [
      '模型路由策略',
      '数据分级策略',
      '服务额度账户',
      '人工审批记录',
      '合规审计档案',
    ],
    aiOutputs: [
      '外部 API 路由建议',
      '本地模型适配建议',
      'Token 服务额度核算',
      '高风险输出阻断报告',
      '合规归档包',
    ],
    revenueMode: '仅销售真实 AI 服务额度、API 调用、私有部署和工程 Agent 服务包; 禁止现金退出、二级交易和升值承诺。',
    auditGates: ['数据分级', '模型白名单', 'Token 合规红线', '人工审批责任', '审计归档'],
  },
  {
    id: 'q235b-hotel-detailing-catalog-loop',
    sourceDocumentId: 'HS-HOTEL-DRAWING-CATALOG-198',
    title: '100间精品酒店198份深化图纸执行闭环',
    modules: [
      'detailed_design',
      'standard_library',
      'quantity_costing',
      'production_manufacturing',
      'material_logistics',
      'construction_management',
      'digital_twin',
      'digital_archive',
    ],
    dataObjects: [
      '8大深化专项',
      '33个图纸分组',
      '198份图纸明细',
      'P1/P2/P3阶段节拍',
      '螺栓孔位与穿梁圆孔锁定',
      'Q235B构件BOM和包装编码',
      '现场装配工艺与竣工资料',
    ],
    aiOutputs: [
      '图纸目录结构化索引',
      'P1先行冻结缺项扫描',
      'MEP穿梁孔位一致性校核',
      '生产放行与CNC包检查',
      '现场装配工艺证据清单',
    ],
    revenueMode: '按深化目录结构化、图纸审查、生产放行、施工证据和竣工档案包计费。',
    auditGates: ['P1先行冻结', '孔位双签', '生产下单放行', '样板间试装放行', '竣工资料归档'],
  },
  {
    id: 'zaofang-60d-partner-growth-loop',
    sourceDocumentId: 'ZFW-MKT-60D-PARTNER-001',
    title: '造房网60天合伙人推广与样板房成交闭环',
    modules: ['marketing_service', 'planning_management', 'finance_hr', 'construction_management', 'digital_twin', 'digital_archive', 'ai_center', 'settings_center'],
    dataObjects: [
      '官网/落地页8项内容',
      '企微承接SOP和客户标签',
      '0号合伙人筛选表',
      '10-15个合伙人网络档案',
      '样板房10步接待记录',
      '5%佣金和7个工作日结算台账',
      '标杆案例传播素材',
    ],
    aiOutputs: [
      '0号合伙人线索评分',
      '企微欢迎语和自动回复SOP',
      '合伙人工具包生成',
      '标杆案例传播文案',
      '每日复盘和转化漏斗分析',
    ],
    revenueMode: '按客户席位、合伙人网络运营、样板房转化服务、案例素材和项目转化服务计费。',
    auditGates: ['客户授权', '合伙人协议', '佣金结算', '样板房接待', '合同签约', '施工进度同步'],
  },
];

export const aiServiceTokenRules = [
  {
    title: '允许定义',
    items: ['AI服务额度', 'AI调用点数', 'AI算力点数', '不可转让服务额度', 'AI服务包', 'AI大模型API计量', '私有模型托管'],
  },
  {
    title: '红线',
    items: ['不得现金退出', '不得二级交易', '不得承诺升值', '不得脱离真实AI服务单独流通'],
  },
  {
    title: '人审责任',
    items: ['报价', '结构建议', '合同条款', '税务', '施工安全', 'HR决策'],
  },
];

export const steelSystemConnections = [
  'CRM',
  'BIM/Tekla/Revit',
  '计量造价',
  'ERP',
  'MES',
  'WMS/物流',
  'QMS',
  '施工管理',
  '数字孪生',
  '数字档案',
  '财务人力/OA',
  'IoT',
];

export const steelQualityMetricGroups = [
  ['模型质量', '模型完整率、编码完整率、属性完整率'],
  ['设计协同', '碰撞问题关闭率、评审问题关闭率'],
  ['成本控制', '模型工程量偏差率、变更测算响应时间'],
  ['生产执行', '加工数据准确率、生产返工率'],
  ['物流履约', '错发漏发率、到场准时率、签收闭环率'],
  ['施工交付', '一次安装合格率、现场问题闭环率、竣工模型一致性'],
] as const;

export function getSteelLifecycleStagesForModule(moduleId: ModuleId) {
  return steelLifecycleStages.filter((stage) => stage.modules.includes(moduleId));
}

export function getSteelComponentStatesForModule(moduleId: ModuleId) {
  return steelComponentStates.filter((state) => state.moduleId === moduleId);
}

export function getAiCommercializationForModule(moduleId: ModuleId) {
  return aiCommercializationCapabilities.find((capability) => capability.moduleId === moduleId);
}

export function getSteelWorkflowChainsForModule(moduleId: ModuleId) {
  return steelWorkflowChains.filter((chain) => chain.modules.includes(moduleId));
}
