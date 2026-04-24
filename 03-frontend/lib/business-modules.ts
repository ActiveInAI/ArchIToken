// lib/business-modules.ts - ArchIToken 11-module workbench fixtures
// License: Apache-2.0

import type { ModuleId } from './api';

export type BusinessModuleStatus = 'active' | 'pilot' | 'planned' | 'foundation';

export type BusinessModuleTrack =
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

export interface BusinessModuleSpec {
  id: ModuleId;
  order: number;
  zhName: string;
  enName: string;
  track: BusinessModuleTrack;
  status: BusinessModuleStatus;
  summary: string;
  inputs: ModuleId[];
  outputs: ModuleId[];
  primaryArtifacts: string[];
  aiCapabilities: string[];
  standards: string[];
  qualityGates: string[];
  dataObjects: string[];
  routeHref: string;
  contractHref?: string;
}

export const moduleStatusLabels: Record<BusinessModuleStatus, string> = {
  active: '开发中',
  pilot: '试点',
  planned: '规划',
  foundation: '底座',
};

export const businessModules: BusinessModuleSpec[] = [
  {
    id: 'marketing_service',
    order: 1,
    zhName: '市场客服',
    enName: 'Marketing Service',
    track: 'customer',
    status: 'planned',
    summary: '商机入口、客户咨询、需求捕获、初步预算边界和项目立项资料沉淀。',
    inputs: [],
    outputs: ['concept_design'],
    primaryArtifacts: ['Lead Token', '需求访谈纪要', '项目立项草案', '客户画像'],
    aiCapabilities: ['多轮需求澄清', '客户意图分类', '竞品/案例检索', '报价草案生成'],
    standards: ['CRM audit trail', 'PIPL consent record', 'ISO 9001 customer requirement'],
    qualityGates: ['客户授权留痕', '需求边界完整', '预算/地点/工期三要素齐备'],
    dataObjects: ['leads', 'inquiries', 'contacts', 'quotes_draft'],
    routeHref: '/app/modules?module=marketing_service',
  },
  {
    id: 'concept_design',
    order: 2,
    zhName: '方案设计',
    enName: 'Concept Design',
    track: 'design',
    status: 'pilot',
    summary: '从客户需求生成多方案比选,覆盖空间、体量、风格、投资、施工边界和可建造性。',
    inputs: ['marketing_service'],
    outputs: ['detailed_design', 'quantity_costing'],
    primaryArtifacts: ['Concept Token', '方案比选矩阵', '体块模型', '投资估算'],
    aiCapabilities: ['文本生成图片', '文本生成模型', '图片生成模型', '方案评分'],
    standards: ['PMBOK scope baseline', 'ISO 19650 OIR/PIR', 'GB/T 50326'],
    qualityGates: ['需求覆盖率', '可建造性检查', '投资约束检查', '合规风险初筛'],
    dataObjects: ['concepts', 'concept_variants', 'style_tags'],
    routeHref: '/app/modules?module=concept_design',
  },
  {
    id: 'standard_library',
    order: 3,
    zhName: '标准族库',
    enName: 'Standard Library',
    track: 'governance',
    status: 'foundation',
    summary: '全局构件族、节点族、材料族、做法、工法和多法域规范条款库。',
    inputs: [],
    outputs: [],
    primaryArtifacts: ['Family Token', 'Code Clause Token', '材料目录', '节点标准图'],
    aiCapabilities: ['规范条文检索', '族库版本比对', '节点做法推荐', '合规解释'],
    standards: ['buildingSMART IFC', 'GB/IBC/Eurocode/AS mapping', 'ISO 19650 CDE'],
    qualityGates: ['版本唯一', '条文来源可追溯', '适用法域明确', '禁用过期族'],
    dataObjects: ['family_types', 'family_versions', 'material_catalog', 'code_clauses'],
    routeHref: '/app/modules?module=standard_library',
  },
  {
    id: 'detailed_design',
    order: 4,
    zhName: '深化设计',
    enName: 'Detailed Design',
    track: 'design',
    status: 'pilot',
    summary: '把方案深化为可施工 IFC/MBD、施工图、结构计算、节点详图和碰撞审查结果。',
    inputs: ['concept_design', 'standard_library'],
    outputs: ['quantity_costing', 'manufacturing', 'construction_supervision'],
    primaryArtifacts: ['Design Token', 'IFC4.3 模型', 'IDS 校验报告', 'BCF 问题包'],
    aiCapabilities: ['图纸生成模型', 'PDF/图纸解析', '碰撞解释', '节点详图审查'],
    standards: ['IFC4.3', 'IDS', 'BCF', 'AISC 360', 'EN 1993', 'GB 50017'],
    qualityGates: ['几何完整', '属性完整', 'IDS 通过', '碰撞闭环', '审签状态完整'],
    dataObjects: ['bim_models', 'drawings', 'structure_calcs', 'clash_reports'],
    routeHref: '/app/modules?module=detailed_design',
  },
  {
    id: 'quantity_costing',
    order: 5,
    zhName: '计量造价',
    enName: 'Quantity & Costing',
    track: 'cost',
    status: 'planned',
    summary: '从模型、图纸和变更提取 MTO/BOQ/BOM,形成成本基线、签证、索赔和预测现金流。',
    inputs: ['concept_design', 'detailed_design', 'standard_library'],
    outputs: ['material_logistics', 'manufacturing'],
    primaryArtifacts: ['BOQ Token', 'MTO 清单', '价格快照', '变更估算'],
    aiCapabilities: ['模型导出清单', 'PDF 清单抽取', '价格异常识别', '变更影响分析'],
    standards: ['GB 50500', 'CSI MasterFormat', 'NRM', 'ASTM E2516'],
    qualityGates: ['工程量复核', '清单编码完整', '价格来源可追溯', '变更差异可解释'],
    dataObjects: ['boq_items', 'cost_breakdowns', 'price_snapshots'],
    routeHref: '/app/modules?module=quantity_costing',
  },
  {
    id: 'material_logistics',
    order: 6,
    zhName: '材料物流',
    enName: 'Material Logistics',
    track: 'supply',
    status: 'pilot',
    summary: '把 BOQ/BOM 转换为采购、DDMRP 缓冲、运输、到场验收、堆场和构件追溯。',
    inputs: ['quantity_costing', 'manufacturing'],
    outputs: ['construction_supervision'],
    primaryArtifacts: ['Material Token', '采购单', '运输计划', '到场验收单'],
    aiCapabilities: ['DDMRP 缓冲预警', '运输路径优化', '到场照片识别', '证书缺失检查'],
    standards: ['DDMRP', 'ISO 9001 traceability', 'ISO 55000', 'PMBOK procurement'],
    qualityGates: ['炉批号完整', '材质证明齐备', '运输 ETA 可追踪', '堆场占用可视'],
    dataObjects: ['purchase_orders', 'shipments', 'site_receiving'],
    routeHref: '/app/modules?module=material_logistics',
  },
  {
    id: 'manufacturing',
    order: 7,
    zhName: '加工制造',
    enName: 'Manufacturing',
    track: 'factory',
    status: 'pilot',
    summary: '将深化模型转为构件加工、CNC、焊接、涂装、防火、MES 排产和质检档案。',
    inputs: ['detailed_design', 'quantity_costing', 'standard_library'],
    outputs: ['material_logistics', 'construction_supervision'],
    primaryArtifacts: ['Manufacturing Token', '加工 BOM', 'CNC 文件', '质检报告'],
    aiCapabilities: ['构件排产优化', '焊缝检测解释', 'CNC 文件校核', '质检异常归因'],
    standards: ['AWS D1.1', 'EN 1090', 'AS/NZS 5131', 'GB 50205', 'GB 50661'],
    qualityGates: ['WPS/PQR 齐备', 'UT/RT/MT 记录完整', '涂层 DFT 合格', '构件二维码绑定'],
    dataObjects: ['work_orders', 'cnc_files', 'qc_records'],
    routeHref: '/app/modules?module=manufacturing',
  },
  {
    id: 'construction_supervision',
    order: 8,
    zhName: '施工监理',
    enName: 'Construction Supervision',
    track: 'site',
    status: 'active',
    summary: '现场进度、质量、安全、AR、点云、360 全景、倾斜摄影和监理验收一体化。',
    inputs: ['detailed_design', 'manufacturing', 'material_logistics', 'standard_library'],
    outputs: ['digital_twin', 'digital_archive'],
    primaryArtifacts: ['Evidence Token', '监理日志', '验收报告', '整改闭环'],
    aiCapabilities: ['施工方案审查', '安全隐患识别', '点云残差解释', 'NCR/RFI 生成'],
    standards: ['GB 55006', 'OSHA', 'ISO 45001', 'ISO 19650 CDE'],
    qualityGates: ['进度偏差可解释', '质量证据完整', '安全整改闭环', '隐蔽工程影像留痕'],
    dataObjects: ['schedules', 'crews', 'daily_logs', 'qa_inspections', 'acceptance_reports'],
    routeHref: '/app/modules?module=construction_supervision',
  },
  {
    id: 'digital_twin',
    order: 9,
    zhName: '数字孪生',
    enName: 'Digital Twin',
    track: 'twin',
    status: 'active',
    summary: '重钢结构 HMI/SCADA/CIM 大屏,融合 IFC4.3、3DGS 影像实景、点云校核、IoT 和形性一体仿真。',
    inputs: ['construction_supervision', 'detailed_design'],
    outputs: ['digital_archive'],
    primaryArtifacts: ['Twin Token', 'HMI 大屏', '3DGS 实景层', '形性一体门禁'],
    aiCapabilities: ['风险解释', '工况预测', '传感异常归因', '整改建议生成'],
    standards: ['DIGITAL_TWIN.md', 'IFC4.3', 'ISO 23247', 'OpenUSD', 'AISC/EN/GB/AS mapping'],
    qualityGates: ['3DGS/点云分层', 'IFC/IDS 完整', '传感绑定', '算测融合', '导出清单完整'],
    dataObjects: ['twin_models', 'iot_streams', 'alerts', 'maintenance_plans'],
    routeHref: '/app/digital-twin',
    contractHref: '/02-architecture/DIGITAL_TWIN.md',
  },
  {
    id: 'digital_archive',
    order: 10,
    zhName: '数字档案',
    enName: 'Digital Archive',
    track: 'archive',
    status: 'planned',
    summary: '合同、图纸、模型、检测报告、IoT 历史、审计日志和企业文宣的长期留存。',
    inputs: ['construction_supervision', 'digital_twin'],
    outputs: [],
    primaryArtifacts: ['Archive Token', '竣工档案', '合同台账', '审计证据包'],
    aiCapabilities: ['自动归档', '版本差异摘要', '证据链检索', '宣传素材生成'],
    standards: ['ISO 19650 CDE', 'OAIS', 'CJJ/T 117', 'e-signature audit'],
    qualityGates: ['签章完整', '版本不可篡改', '保留期限明确', '检索权限正确'],
    dataObjects: ['archives', 'archive_items', 'retention_policies'],
    routeHref: '/app/modules?module=digital_archive',
  },
  {
    id: 'settings_center',
    order: 11,
    zhName: '设置中心',
    enName: 'Settings Center',
    track: 'platform',
    status: 'foundation',
    summary: '租户、用户、RBAC、模型路由、SLA 预算、规范库版本和 UI 偏好的全局配置中心。',
    inputs: [],
    outputs: [],
    primaryArtifacts: ['Governance Token', '权限矩阵', '模型路由表', 'SLA 策略'],
    aiCapabilities: ['模型路由推荐', '权限冲突检查', '合规策略解释', '审计摘要'],
    standards: ['SOC 2', 'ISO 27001', 'NIST AI RMF', 'PIPL/GDPR privacy controls'],
    qualityGates: ['RLS 强制', '最小权限', '模型白名单', '审计日志完整'],
    dataObjects: ['tenants', 'users', 'roles', 'role_bindings', 'model_routes', 'sla_budgets'],
    routeHref: '/app/modules?module=settings_center',
  },
];

export function getBusinessModule(moduleId: ModuleId): BusinessModuleSpec {
  const spec = businessModules.find((item) => item.id === moduleId);
  if (!spec) {
    throw new Error(`Unknown module: ${moduleId}`);
  }
  return spec;
}

export function getModuleReadinessScore(): number {
  const weights: Record<BusinessModuleStatus, number> = {
    active: 1,
    pilot: 0.72,
    foundation: 0.64,
    planned: 0.36,
  };
  const total = businessModules.reduce((sum, spec) => sum + weights[spec.status], 0);
  return Math.round((total / businessModules.length) * 1000) / 10;
}

export function getModuleDependencyIssues(): string[] {
  const ids = new Set(businessModules.map((spec) => spec.id));
  return businessModules.flatMap((spec) =>
    [...spec.inputs, ...spec.outputs]
      .filter((moduleId) => !ids.has(moduleId))
      .map((moduleId) => `${spec.id} references missing module ${moduleId}`),
  );
}
