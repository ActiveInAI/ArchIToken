// lib/module-operations.ts - Interactive module workbench fixtures
// License: Apache-2.0

import type { ModuleId } from './module-registry';

export interface ModuleFeatureCard {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: 'ready' | 'running' | 'review' | 'blocked';
  metrics: string[];
}

export interface ModuleOperationButton {
  id: string;
  label: string;
  result: string;
}

export interface ModuleOperationalProfile {
  moduleId: ModuleId;
  title: string;
  subtitle: string;
  summary?: string;
  description?: string;
  features: ModuleFeatureCard[];
  operations: ModuleOperationButton[];
  statusTracks: string[];
}

function feature(
  id: string,
  title: string,
  description: string,
  owner: string,
  status: ModuleFeatureCard['status'],
  metrics: string[],
): ModuleFeatureCard {
  return { id, title, description, owner, status, metrics };
}

function operation(id: string, label: string, result: string): ModuleOperationButton {
  return { id, label, result };
}

export const moduleOperationalProfiles: Partial<Record<ModuleId, ModuleOperationalProfile>> = {
  planning_management: {
    moduleId: 'planning_management',
    title: '项目计划与全周期履约工作台',
    subtitle: 'Project Planning Studio: 把立项、WBS、进度、资源、风险、RACI、图表模板、审批和交付里程碑连接到生产与施工节拍。',
    features: [
      feature('project-initiation', '立项资料', '项目范围、合同边界、法域、业主要求和交付标准。', '项目经理', 'running', ['完整 86%', '待补 9 项', '风险 4 条']),
      feature('wbs', 'WBS', '按设计、采购、生产、物流、施工、验收拆解到可执行任务包。', '计划工程师', 'ready', ['任务 186 个', '关键 23 个', '挂接率 92%']),
      feature('planning-studio', 'Project Planning Studio', '甘特、WBS、PERT、RACI、看板、风险矩阵、资源负荷和 Mermaid/BPMN 导出。', '计划工程师', 'running', ['模板 50+ 个', 'CDE 归档', 'AI顾问']),
      feature('baseline-schedule', '基线进度', '总控、专项、周计划和 4D 进度基线。', '计划经理', 'review', ['基线 1 版', '偏差 -2.5 天', '关键路径 4 条']),
      feature('resource-plan', '资源计划', '人机料、产线、车辆、吊装窗口和现金流约束。', '资源经理', 'running', ['资源 7 类', '冲突 3 个', '负载 84%']),
      feature('risk-register', '风险清单', '设计变更、供应、制造、运输、吊装、安全和合规风险。', '项目总工', 'running', ['风险 31 条', '高风险 5 条', '闭环 58%']),
      feature('approval-log', '审批记录', '立项、方案、清单、采购、工单、施工和结算审批链。', '文控经理', 'ready', ['审批 42 条', '待审 6 条', '逾期 1 条']),
    ],
    operations: [
      operation('generate-wbs', '生成 WBS', '已按 14 模块生成 WBS、责任人和关键路径。'),
      operation('open-planning-studio', '打开 Project Planning Studio', '已进入在线计划图表编制、保存版本、审批归档和导出闭环。'),
      operation('baseline-schedule', '生成基线计划', '已生成总控计划、周计划和里程碑看板。'),
      operation('evaluate-risk', '评估履约风险', '已输出供应、制造、施工和资金风险矩阵。'),
      operation('sync-downstream', '同步下游模块', '已把计划基线同步到设计、采购、生产和施工模块。'),
    ],
    statusTracks: ['立项', 'WBS', '基线计划', '资源平衡', '风险审批', '履约闭环'],
  },
  marketing_service: {
    moduleId: 'marketing_service',
    title: '客户入口与机会转化工作台',
    subtitle: '把客户线索、咨询对话和需求采集转成可报价、可立项、可追踪的 Lead Token。',
    features: [
      feature('lead-pool', '客户线索', '线索来源、项目区域、投资强度、联系人和授权状态。', '客户经理', 'running', ['23 条线索', '7 条高意向', 'SLA 92%']),
      feature('consultation-chat', '咨询对话', '保留语音、图文、文件和 AI 摘要,形成问答证据链。', 'AI 客服', 'ready', ['48 轮会话', '意图识别 91%', '缺口 5 项']),
      feature('requirement-intake', '需求采集', '采集跨度、面积、工期、预算、法域、交付物和审批路径。', '方案顾问', 'review', ['完整度 78%', '待确认 6 项', '预算区间 2 档']),
      feature('quote-draft', '报价草案', '从需求和历史项目生成报价范围、风险项和商务假设。', '商务经理', 'ready', ['草案 3 版', '风险 4 项', '置信 84%']),
      feature('follow-up-task', '跟进任务', '自动生成回访、资料补齐、方案会和报价审批任务。', '销售负责人', 'running', ['待办 9 个', '逾期 1 个', '下次回访 2h']),
      feature('customer-profile', '客户画像', '沉淀客户行业、偏好、预算敏感度和历史项目行为。', '增长分析师', 'ready', ['画像 12 标签', '相似项目 5 个', '转化率 36%']),
    ],
    operations: [
      operation('summarize-requirements', '生成需求摘要', '已生成需求摘要并标记 6 个待确认问题。'),
      operation('draft-quote', '生成报价草案', '已生成三档报价草案和商务假设。'),
      operation('create-follow-up', '创建跟进任务', '已创建客户回访、资料补齐和方案会任务。'),
    ],
    statusTracks: ['线索登记', '需求采集', '报价草案', '客户确认', '立项移交'],
  },
  concept_design: {
    moduleId: 'concept_design',
    title: '方案设计与概念生成工作台',
    subtitle: '从场地、需求和标准库生成多方案、指标分析、初步模型和展示包。',
    features: [
      feature('site-condition', '场地条件', '用地边界、道路、吊装入口、周边风险和地勘资料。', '方案设计师', 'running', ['红线 1 版', '出入口 3 个', '约束 12 条']),
      feature('scheme-sketch', '方案草图', '平面、体量、柱网、功能流线和重钢结构策略。', 'Generator Agent', 'ready', ['草图 6 张', '体量 3 套', '柱网 2 档']),
      feature('style-choice', '风格选型', '工业风、展示中心、厂房园区等风格和材料方向。', '视觉设计师', 'ready', ['风格 5 类', '参考图 24 张', '视频脚本 2 版']),
      feature('indicator-analysis', '指标分析', '面积、钢量、层高、造价、能耗和施工窗口快速评估。', '技术负责人', 'review', ['钢量估算 92%', '成本偏差 8%', '规范预警 3 项']),
      feature('initial-model', '初步模型', '生成可继续深化的 GLB/IFC 初步模型和构件编码草案。', 'BIM 工程师', 'running', ['GLB 1 个', 'IFC 草案', '构件 186 件']),
    ],
    operations: [
      operation('generate-scheme', '生成方案', '已生成三套概念方案和初步模型。'),
      operation('evaluate-code', '评估规范', '已按 GB/AISC/Eurocode/AS 做初筛预警。'),
      operation('create-presentation-pack', '生成展示包', '已生成客户展示 PDF、渲染图和短视频脚本。'),
    ],
    statusTracks: ['场地录入', '多方案生成', '指标校核', '客户评审', '深化移交'],
  },
  standard_library: {
    moduleId: 'standard_library',
    title: '标准规范与族库治理工作台',
    subtitle: '统一管理规范、族库、样板、材质、图纸、模型、做法、规则和版本。',
    features: [
      feature('standards', '标准规范', '中国、美国、欧洲、澳洲与企业标准条文、版本和法域映射。', '标准工程师', 'review', ['条文 1,284 条', '法域 4 类', '冲突 7 条']),
      feature('families', '族库构件', '重钢柱、梁、桁架、节点板、螺栓和机电支吊架族库。', 'BIM 经理', 'running', ['族 326 个', '属性完整 93%', '弃用 12 个']),
      feature('templates', '样板文件', '项目模板、图纸模板、报价模板、BIM 模板和交付模板。', '文控经理', 'ready', ['模板 42 个', '最新 38 个', '待发布 4 个']),
      feature('materials', '材质库', '钢材、防腐、防火、焊材、高强螺栓和饰面材料。', '材料工程师', 'ready', ['材料 218 项', '价格快照 3 版', '证书 96%']),
      feature('drawings', '图纸', '标准图集、节点详图、CAD/PDF 来源和适用条件。', '设计管理员', 'running', ['图纸 612 张', '节点 148 个', '差异 9 项']),
      feature('models', '模型', 'IFC、GLB、参数化构件和数字孪生基础模型。', 'BIM 经理', 'review', ['模型 84 个', 'IFC4.3 62%', 'GLB 91%']),
      feature('methods', '做法库', '防火、防腐、屋面、围护、装配和施工工艺做法。', '工艺工程师', 'ready', ['做法 73 项', '可制造 88%', '验收关联 64 项']),
      feature('rules', '规则库', '结构、造价、施工、验收、安全和交付规则。', '规则工程师', 'running', ['规则 392 条', '单测 86%', '阻断 5 条']),
      feature('versions', '版本库', '规范、构件、做法、规则和企业知识版本链。', '架构师', 'ready', ['版本 108 个', '回滚点 21 个', '发布候选 3 个']),
    ],
    operations: [
      operation('search-code', '检索规范', '已返回适用条文、法域和版本风险。'),
      operation('generate-family', '生成族库', '已生成 Q355B 重钢构件族和属性集。'),
      operation('check-component', '校核构件', '已完成几何、属性、做法和规则库校核。'),
      operation('publish-version', '发布版本', '已生成版本发布记录和回滚点。'),
    ],
    statusTracks: ['知识入库', '条文解析', '族库发布', '规则校核', '版本冻结'],
  },
  detailed_design: {
    moduleId: 'detailed_design',
    title: '深化设计与模型出图工作台',
    subtitle: '围绕 IFC、DWG、节点、连接、管线协调和碰撞检查形成可制造模型。',
    features: [
      feature('ifc-model', 'IFC 模型', 'IFC4.3 构件树、GUID、属性集和 IDS 门禁。', 'BIM 工程师', 'running', ['构件 2,418', '属性 91%', 'IDS 95%']),
      feature('dwg-drawing', 'DWG 图纸', '总图、节点详图、加工图和施工图联动。', '设计负责人', 'review', ['图纸 146 张', '待审 11 张', '差异 4 项']),
      feature('node-detail', '节点深化', '节点板、螺栓、焊缝、坡口、加劲肋和施工空间。', '结构工程师', 'running', ['节点 382 个', '高风险 8 个', '完成 76%']),
      feature('structure-connection', '结构连接', '高强螺栓、焊缝、端板和刚接/铰接逻辑。', '连接设计师', 'review', ['连接 928 个', '计算 88%', '复核 67%']),
      feature('mep-coordination', '管线协调', '设备洞口、支吊架、消防和机电碰撞协调。', '机电协调员', 'ready', ['碰撞 19 个', '已闭环 12 个', '待分配 7 个']),
      feature('clash-check', '碰撞检查', '生成 BCF、责任人、整改期限和复核状态。', 'BIM 经理', 'running', ['BCF 42 个', '开放 13 个', '阻断 3 个']),
    ],
    operations: [
      operation('generate-detail-model', '生成深化模型', '已生成带构件编码和属性集的深化模型版本。'),
      operation('generate-drawings', '生成图纸', '已生成施工图、节点详图和出图索引。'),
      operation('run-clash-check', '运行碰撞检查', '已生成 BCF 问题包和责任矩阵。'),
    ],
    statusTracks: ['模型同步', '节点深化', '出图校核', '碰撞闭环', '制造移交'],
  },
  quantity_costing: {
    moduleId: 'quantity_costing',
    title: '计量造价与变更影响工作台',
    subtitle: '从模型、图纸和价格库生成工程量、BOQ、清单、成本测算和变更估算。',
    features: [
      feature('mto', '工程量', '从 IFC/图纸抽取构件重量、面积、螺栓、焊缝和涂装面积。', '造价工程师', 'running', ['覆盖 93%', '差异 2.8%', '待复核 17 项']),
      feature('boq', 'BOQ', '映射清单编码、工程量规则、项目特征和计价口径。', '商务经理', 'review', ['清单 286 项', '规则 96%', '缺口 8 项']),
      feature('bill', '清单', '面向采购、生产和合同的清单版本与差异。', '商务专员', 'ready', ['版本 5 个', '变更 11 条', '冻结 1 版']),
      feature('cost-estimate', '成本测算', '材料、加工、物流、吊装、管理费和风险费测算。', '成本经理', 'running', ['目标成本 1.28 亿', '偏差 +3.4%', '风险储备 4.2%']),
      feature('price-library', '价格库', '供应商、区域、时间、材质和价格置信度。', '采购经理', 'ready', ['价格 1,906 条', '过期 42 条', '置信 87%']),
      feature('variation-estimate', '变更估算', '签证、索赔、设计变更和现金流影响分析。', '商务经理', 'review', ['变更 9 项', '影响 +186 万', '待签 3 项']),
    ],
    operations: [
      operation('generate-boq', '生成 BOQ', '已生成 BOQ 清单并绑定 element_id。'),
      operation('generate-cost', '生成造价', '已生成目标成本、风险储备和价格来源。'),
      operation('evaluate-variation', '评估变更影响', '已评估变更对成本、工期和合同的影响。'),
    ],
    statusTracks: ['模型计量', '清单映射', '价格套用', '变更测算', '成本审批'],
  },
  material_logistics: {
    moduleId: 'material_logistics',
    title: '材料物流与批次追踪工作台',
    subtitle: '从库存、供应商、询比价到采购、下料、包装、运输、签收和批次追踪。',
    features: [
      feature('inventory', '材料库存', '钢材、焊材、涂料、高强螺栓和余料库存。', '仓储经理', 'running', ['库存 82%', '红区 3 类', '锁定批次 12']),
      feature('supplier', '供应商', '供应商资质、履约、价格、交期和风险画像。', '采购经理', 'ready', ['供应商 46 家', '合格 39 家', '预警 4 家']),
      feature('price', '价格', '区域、时间、规格、报价来源和价格有效期。', '采购经理', 'review', ['报价 128 条', '过期 9 条', '波动 +4.1%']),
      feature('rfq', '询价/比价', 'RFQ、比价表、技术澄清和采购审批。', '采购专员', 'running', ['RFQ 7 单', '待回 2 单', '推荐 3 家']),
      feature('purchase-plan', '采购计划', '按 DDMRP 缓冲、生产节拍和施工窗口生成采购计划。', '计划工程师', 'running', ['计划 5 批', '缺口 18t', 'ETA 偏差 6h']),
      feature('cutting-list', '下料单', '把 BOQ/BOM 转成可加工下料单和余料策略。', '工艺工程师', 'ready', ['下料 312 条', '利用率 91%', '余料 4.8t']),
      feature('production-bom', '加工 BOM', '构件、材料、工序、检测和包装关联。', '工艺工程师', 'review', ['BOM 28 包', '缺字段 3 项', '冻结 11 包']),
      feature('packing', '包装', '按构件、吊装顺序、防护要求和二维码打包。', '物流经理', 'ready', ['包装 38 件', '破损 0', '待拍照 6']),
      feature('loading', '装车', '超长超重构件装车顺序、重心和路线限制。', '物流经理', 'running', ['车辆 6 台', '超限 2 台', '顺序 94%']),
      feature('delivery', '物流', 'GPS、ETA、道路许可、异常和现场到货计划。', '调度员', 'running', ['在途 9 车', '延误 1 车', 'ETA 92%']),
      feature('arrival', '到货', '到货验收、损伤照片、证书和现场堆放建议。', '现场材料员', 'review', ['到货 41 包', '待验 8 包', '异常 2 项']),
      feature('yard', '现场堆放', '堆场分区、吊装顺序、周转路线和占用率。', '施工总包', 'running', ['堆场 73%', '冲突 2 项', '空位 11 个']),
      feature('receipt', '签收', '签收人、时间、照片、批次和二维码证据。', '材料员', 'ready', ['签收 33 包', '待签 8 包', '证据 96%']),
      feature('batch-trace', '批次追踪', '炉批号、材质证明、二维码、RFID 和构件绑定。', '质保工程师', 'running', ['追踪率 94%', '证书缺口 5', 'RFID 88%']),
    ],
    operations: [
      operation('generate-purchase-plan', '生成采购计划', '已生成采购批次、RFQ 和 DDMRP 缓冲建议。'),
      operation('generate-cutting-list', '生成下料单', '已生成下料单、余料策略和加工 BOM。'),
      operation('arrange-logistics', '安排物流', '已生成装车顺序、车辆计划和到场 ETA。'),
      operation('receive-batch', '签收批次', '已更新批次签收状态和现场堆放位置。'),
    ],
    statusTracks: ['库存检查', '询比价', '采购下单', '包装装车', '到货签收'],
  },
  production_manufacturing: {
    moduleId: 'production_manufacturing',
    title: '生产制造与 MES 工单工作台',
    subtitle: '覆盖生产计划、工序路线、下料优化、CNC、焊接、涂装、质检、排产、发运和返工。',
    features: [
      feature('production-plan', '生产计划', '按构件、批次、设备产能和交付窗口组织计划。', '生产计划员', 'running', ['批次 12 个', '负载 86%', '延误 1 天']),
      feature('routing', '工序路线', '下料、组立、焊接、矫正、涂装、质检、包装路线。', '工艺工程师', 'ready', ['路线 8 条', '瓶颈 2 个', 'SOP 93%']),
      feature('cut-optimization', '下料优化', '板材、型钢、孔群和余料优化。', '下料工程师', 'running', ['利用率 91%', '余料 4.8t', '重排 2 次']),
      feature('cnc-files', 'CNC/数控文件', '生成 NC/DXF、切割路径、钻孔文件和版本绑定。', '数控工程师', 'review', ['NC 126 个', 'DXF 88 个', '待校核 9 个']),
      feature('welding', '焊接', 'WPS/PQR、焊工、焊缝、UT/RT/MT 和返修。', '焊接工程师', 'running', ['焊缝 1,928 条', 'UT 78%', '返修 4 条']),
      feature('coating', '喷涂/防腐/防火', '表面处理、膜厚、环境条件和防火涂层。', '涂装工程师', 'ready', ['DFT 238um', '合格 96%', '缺照 6 件']),
      feature('factory-qc', '质检', '尺寸、焊缝、螺栓、涂装和出厂验收。', '质检工程师', 'review', ['合格 91%', '待检 33 件', '阻断 3 件']),
      feature('schedule', '工厂排产', '产线负荷、班组、设备、瓶颈和换线策略。', '车间主任', 'running', ['产线 4 条', '瓶颈 焊接', '节拍 92%']),
      feature('mes-erp', 'MES/ERP 对接', '工单、库存、成本、报工和质量数据同步。', '系统集成工程师', 'ready', ['同步 97%', '失败 2 条', '延迟 14s']),
      feature('component-code', '构件编码', '二维码、RFID、IFC GUID、批次和工序证据绑定。', '质量管理员', 'running', ['编码 2,418', '追溯 95%', '异常 7 件']),
      feature('shipping', '包装发运', '包装、装车、出厂、签收和发运批次。', '物流经理', 'ready', ['发运 9 批', '在途 3 批', '签收 6 批']),
      feature('rework', '返工处理', '返工原因、责任、措施、复检和成本影响。', '质量经理', 'review', ['返工 5 件', '闭环 2 件', '影响 1.6 天']),
    ],
    operations: [
      operation('generate-work-order', '生成工单', '已生成生产工单、工序路线和班组排程。'),
      operation('generate-cnc', '生成 CNC 文件', '已生成 NC/DXF 文件并绑定模型版本。'),
      operation('run-factory-qc', '运行质检', '已更新焊接、尺寸和涂装质检状态。'),
      operation('schedule-shipment', '安排发运', '已生成包装发运批次和装车清单。'),
    ],
    statusTracks: ['排产', '下料', '焊接', '涂装', '质检', '发运'],
  },
  construction_management: {
    moduleId: 'construction_management',
    title: '施工管理与现场闭环工作台',
    subtitle: '施工方案、进度、质量、安全、日志、AR、360、扫描、无人机、机器人、IoT 和竣工资料。',
    features: [
      feature('method-statement', '施工方案', '专项施工方案、吊装方案、临撑方案和审批意见。', '技术负责人', 'review', ['方案 12 份', '待审 2 份', '高风险 3 项']),
      feature('schedule', '进度', '计划、实际、偏差、4D 关联和纠偏建议。', '计划工程师', 'running', ['完成 68%', '偏差 -2.5 天', '关键路径 4 项']),
      feature('quality', '质量', '检验批、NCR、RFI、复验和质量闭环。', '质量工程师', 'running', ['NCR 9 项', '闭环 5 项', '待复验 4 项']),
      feature('safety', '安全', '高处、吊装、临电、动火、人员和设备风险。', '安全工程师', 'blocked', ['隐患 6 项', '重大 1 项', '整改率 72%']),
      feature('daily-log', '日志', '施工日志、监理日志、旁站、天气和人机料。', '监理工程师', 'ready', ['今日 3 篇', '自动摘要 1 篇', '缺签 2 人']),
      feature('ar', 'AR', 'AR 安装定位、构件复核和现场指引。', '现场工程师', 'ready', ['AR 点 24 个', '偏差 3 个', '通过 88%']),
      feature('panorama', '360 全景', '全景巡检、进度影像和问题定位。', '资料员', 'running', ['全景 118 张', '覆盖 91%', '新增 12 张']),
      feature('scan3d', '三维扫描', 'LiDAR/E57、控制点、残差和偏差热图。', '测量工程师', 'review', ['扫描 9 批', '残差 26mm', '待复测 2 区']),
      feature('oblique', '倾斜摄影', '无人机航线、倾斜模型和土建/钢构对齐。', '无人机飞手', 'ready', ['航线 6 条', '点位 1,920', '精度 3cm']),
      feature('drone', '无人机', '巡检、拍摄、吊装路径和安全监测。', '无人机飞手', 'running', ['飞行 4 次', '异常 1 条', '电量 72%']),
      feature('robot', '建筑机器人', '巡检机器人、喷涂/测量设备和自动记录。', '智能建造工程师', 'ready', ['机器人 2 台', '任务 7 个', '在线 1 台']),
      feature('iot', 'IoT', '应力、风速、温湿度、设备和人员定位。', 'IoT 工程师', 'running', ['点位 86 个', '告警 4 条', '在线 94%']),
      feature('visual-compare', '影像对比', '模型、计划、全景、点云和现场图像对比。', 'BIM 工程师', 'review', ['对比 32 组', '偏差 7 项', '阻断 2 项']),
      feature('rectification', '整改闭环', '整改单、责任人、期限、复验和归档。', '总监理工程师', 'running', ['整改单 11 个', '逾期 1 个', '闭环率 81%']),
      feature('completion', '竣工资料', '验收、检测、签章、模型和归档清单。', '资料负责人', 'ready', ['资料 76%', '缺项 18 个', '签章 63%']),
    ],
    operations: [
      operation('generate-site-log', '生成施工日志', '已生成施工日志、监理摘要和证据引用。'),
      operation('create-rectification', '创建整改单', '已创建质量/安全整改单和复验任务。'),
      operation('run-safety-check', '运行安全检查', '已生成吊装、高处和临电安全检查结果。'),
      operation('archive-completion', '归档竣工资料', '已生成竣工资料缺项清单和归档包。'),
    ],
    statusTracks: ['方案审批', '现场执行', '质量安全', '整改闭环', '竣工归档'],
  },
  digital_twin: {
    moduleId: 'digital_twin',
    title: '重钢结构数字孪生运行台',
    subtitle: 'WebGPU 优先、Three.js fallback,融合 IFC/GLB、点云、3DGS、360、扫描、倾斜摄影和 IoT。',
    features: [
      feature('webgpu', 'WebGPU 优先渲染状态', '检测 GPU Adapter、渲染管线和帧率预算。', '图形工程师', 'running', ['WebGPU ready', 'FPS 58', 'GPU 72%']),
      feature('three-fallback', 'Three.js fallback 状态', '低能力设备自动切到 Three.js 兼容渲染。', '前端工程师', 'ready', ['fallback idle', '兼容 96%', '降级 0 次']),
      feature('assets', 'IFC/GLB/点云/360/三维扫描/倾斜摄影', '登记模型、实景、点云、全景、扫描和倾斜摄影数据源。', 'BIM 经理', 'running', ['源 6 类', '对齐 87%', '缺口 3 项']),
      feature('component-tree', '构件树', 'Site / Building / Level / Zone / Element 可点击选择和回写。', '孪生工程师', 'running', ['构件 2,418', '选中 1 件', '属性 91%']),
      feature('layer-manager', '图层管理', 'IFC、GLB、点云、360、三维扫描、倾斜摄影、进度、质量、安全、成本开关。', '项目经理', 'ready', ['图层 12 个', '活动 7 个', '叠加 4 类']),
      feature('progress-compare', '进度对比', '计划进度、实际安装、影像证据和 4D 回放。', '计划工程师', 'review', ['完成 68%', '偏差 -2.5 天', '回放 12 帧']),
      feature('overlays', '质量/安全/成本叠加图层', '缺陷、隐患、成本偏差和整改状态热力叠加。', '项目总工', 'running', ['质量 9 项', '安全 6 项', '成本 +3.4%']),
      feature('view-control', '视角切换', '总览、吊装、构件、点云残差和成本热区视角。', '现场工程师', 'ready', ['视角 5 个', '收藏 3 个', '路径 1 条']),
      feature('model-status', '模型状态', '模型版本、几何完整度、属性完整度和可编辑回写状态。', 'BIM 经理', 'review', ['版本 r42', '几何 94%', '属性 88%']),
      feature('iot-status', '传感器/IoT 状态', '应力、应变、风速、扭矩、温度和安全点位。', 'IoT 工程师', 'running', ['点位 86', '告警 4', '在线 94%']),
    ],
    operations: [
      operation('toggle-layer', '切换图层', '已切换图层并记录视口状态。'),
      operation('select-component', '选择构件', '已选择构件并显示几何、属性和风险。'),
      operation('play-progress', '播放进度', '已启动 4D 进度对比回放。'),
      operation('export-snapshot', '生成孪生快照', '已生成 Twin Snapshot 和证据包。'),
      operation('export-model-pack', '导出模型包', '已导出 IFC/GLB/SPZ/BCF 模型包清单。'),
    ],
    statusTracks: ['渲染检测', '多源对齐', '构件选择', '图层叠加', '快照导出'],
  },
  digital_archive: {
    moduleId: 'digital_archive',
    title: '数字档案与证据链工作台',
    subtitle: '项目档案、图纸模型、审批记录、日志、质量安全、竣工资料和版本链统一归档。',
    features: [
      feature('project-archive', '项目档案', '合同、组织、计划、证据、交付物和项目元数据。', '资料负责人', 'running', ['完整 82%', '缺项 18', '签章 63%']),
      feature('drawing-archive', '图纸档案', 'DWG/PDF/图集/节点详图版本链和签章。', '设计管理员', 'review', ['图纸 146 张', '签章 89%', '缺版本 4 张']),
      feature('model-archive', '模型档案', 'IFC、GLB、STEP、SPZ 和模型版本差异。', 'BIM 经理', 'running', ['模型 24 个', 'IFC 完整 95%', 'SPZ 待审']),
      feature('approval-record', '审批记录', '客户、设计、采购、生产、施工、竣工审批链。', '项目经理', 'ready', ['审批 62 条', '待审 5 条', '驳回 1 条']),
      feature('site-log', '施工日志', '施工日志、监理日志、旁站和天气人机料记录。', '监理工程师', 'ready', ['日志 128 篇', '缺签 7 篇', 'AI 摘要 81%']),
      feature('quality-safety', '质量安全记录', 'NCR、安全隐患、检测报告、整改闭环和复验。', '质量安全负责人', 'review', ['记录 286 条', '开放 12 条', '闭环 88%']),
      feature('completion-docs', '竣工资料', '验收、检测、签章、移交和长期保留策略。', '资料负责人', 'running', ['归档 76%', '缺项 18', '移交包 1 个']),
      feature('version-chain', '版本链', '文件哈希、签章、版本、回滚点和保留期限。', '文控经理', 'ready', ['版本 312 个', '哈希 100%', '回滚点 42']),
    ],
    operations: [
      operation('generate-archive-pack', '生成归档包', '已生成归档目录、文件哈希和移交清单。'),
      operation('validate-completeness', '校验完整性', '已校验签章、版本链和缺项清单。'),
      operation('export-archive', '导出档案', '已导出竣工档案包和长期保留索引。'),
    ],
    statusTracks: ['收集', '校验', '签章', '封存', '移交'],
  },
  finance_hr: {
    moduleId: 'finance_hr',
    title: '财务人力与项目经营工作台',
    subtitle: '合同台账、付款发票、成本台账、班组人员、考勤绩效、结算和经营分析统一联动。',
    features: [
      feature('contract-ledger', '合同台账', '业主合同、分包合同、采购合同、补充协议和签章状态。', '合同经理', 'running', ['合同 38 份', '待签 4 份', '风险 6 条']),
      feature('payment-invoice', '付款发票', '付款计划、发票、收款、应付、应收和现金流预测。', '财务经理', 'review', ['应收 4,280 万', '应付 2,960 万', '逾期 3 笔']),
      feature('cost-ledger', '成本台账', '材料、加工、物流、吊装、管理费、风险费和变更成本。', '成本经理', 'running', ['目标成本 1.28 亿', '偏差 +3.4%', '冻结 1 版']),
      feature('crew-labor', '人员班组', '设计、采购、工厂、施工、监理、分包和资质证书。', '人力经理', 'ready', ['人员 126 人', '证书 94%', '缺口 8 人']),
      feature('attendance', '考勤绩效', '工厂与现场考勤、产量、质量、安全和绩效。', '现场管理员', 'running', ['出勤 92%', '异常 7 条', '绩效 86%']),
      feature('settlement', '结算归档', '进度款、签证、索赔、结算审核、档案和审计追溯。', '商务经理', 'review', ['结算 63%', '签证 11 条', '待审 5 项']),
    ],
    operations: [
      operation('forecast-cashflow', '预测现金流', '已生成回款、付款和资金缺口预测。'),
      operation('reconcile-cost', '核对成本', '已核对 BOQ、采购、生产和施工成本差异。'),
      operation('generate-settlement', '生成结算包', '已生成结算清单、签证索赔和审计索引。'),
    ],
    statusTracks: ['合同', '付款', '成本', '人力', '绩效', '结算'],
  },
  ai_center: {
    moduleId: 'ai_center',
    title: '企业级 AI 中心与智能体编排工作台',
    subtitle: '统一管理模型供应商、API 网关、RAG 知识库、MCP 工具、Agent 编排、OpenClaw 自动化、安全审计与成本策略。',
    features: [
      feature('model-providers', '模型供应商', 'Hugging Face、LM Studio、OpenRouter、OpenAI、Anthropic、Google等统一接入。', 'AI 平台工程师', 'running', ['供应商 10 个', '健康 96%', 'fallback 2 条']),
      feature('api-gateway', 'AI API 网关', '统一鉴权、限流、路由、模型选择、流式输出、重试和降级策略。', '平台工程师', 'ready', ['路由 18 条', 'P95 420ms', '错误率 0.8%']),
      feature('rag-knowledge', 'RAG 知识库', '规范、合同、图纸、BIM 属性、审计记录和项目文档向量化检索。', '知识工程师', 'running', ['知识库 12 个', '文档 18k', '命中率 87%']),
      feature('mcp-tools', 'MCP 工具注册', '把文件系统、模型仓库、数据库、审批流、造价表和 CDE 工具注册给智能体调用。', '工具链工程师', 'review', ['工具 36 个', '启用 29 个', '待授权 4 个']),
      feature('agent-orchestration', 'Agent 编排', 'Planner、Generator、Evaluator、Approver、Auditor 多智能体协同执行工程任务。', 'Agent 架构师', 'running', ['Agent 14 个', '工作流 9 条', '成功率 91%']),
      feature('openclaw-automation', 'OpenClaw 自动化', '面向工程任务的自动执行、回放、失败恢复、人工接管和操作审计。', '自动化负责人', 'ready', ['任务 128 个', '自动化率 72%', '回滚点 31']),
      feature('safety-audit', '安全审计', '提示词注入防护、敏感数据脱敏、权限边界、模型输出审查和追踪留痕。', '安全管理员', 'review', ['策略 42 条', '阻断 7 次', '审计 100%']),
      feature('cost-policy', '成本策略', '按租户、项目、模块、模型和任务统计 token 成本，并支持预算、告警和模型降级。', 'FinOps 负责人', 'running', ['本月 -18%', '预算 65%', '告警 3 条']),
    ],
    operations: [
      operation('route-model', '生成模型路由建议', '已根据任务类型、成本预算和安全等级生成模型路由策略。'),
      operation('build-rag-index', '构建 RAG 索引', '已对规范、合同、图纸和审批记录构建检索索引。'),
      operation('register-mcp-tool', '注册 MCP 工具', '已生成工具 schema、权限边界和调用审计策略。'),
      operation('compose-agent-flow', '编排 Agent 流程', '已生成 Planner → Generator → Evaluator → Approver 工作流。'),
      operation('run-safety-check', '运行安全审计', '已完成提示词注入、数据脱敏和权限越界检查。'),
    ],
    statusTracks: ['模型接入', '网关路由', '知识索引', '工具注册', 'Agent 编排', '安全审计', '成本治理'],
  },
  settings_center: {
    moduleId: 'settings_center',
    title: '平台设置与治理控制台',
    subtitle: '租户、模块开关、用户角色、权限策略、模型路由、存储适配器和审计策略。',
    features: [
      feature('tenant', '租户设置', '组织、项目、空间、法域、默认标准和数据隔离。', '平台管理员', 'ready', ['租户 3 个', '项目 12 个', '法域 4 类']),
      feature('module-switch', '模块开关', '14 模块启停、灰度、权限和 SLA。', '产品管理员', 'running', ['启用 14 个', '灰度 2 个', '阻断 0 个']),
      feature('roles', '用户角色', '业主、设计、造价、采购、工厂、监理、管理员等角色。', 'IAM 管理员', 'ready', ['角色 18 个', '用户 126 个', '冲突 2 个']),
      feature('policy', '权限策略', 'RBAC/ABAC、审批流、数据域和最小权限策略。', '安全管理员', 'review', ['策略 42 条', '模拟 96%', '高危 1 条']),
      feature('model-router', '模型路由', 'OpenRouter、InferenceRouter、本地模型和成本策略。', 'AI 平台工程师', 'running', ['路由 8 条', 'fallback 2 条', '成本 -12%']),
      feature('storage-adapter', '存储适配器', '对象存储、CDE、模型仓库、档案库和缓存策略。', '平台工程师', 'ready', ['适配器 5 个', '健康 100%', '延迟 42ms']),
      feature('audit-policy', '审计策略', '操作审计、证据链、签章、保留期限和导出规则。', '合规负责人', 'running', ['事件 12k', '保留 7 年', '导出 4 次']),
    ],
    operations: [
      operation('update-config', '更新配置', '已生成配置变更草案和回滚点。'),
      operation('simulate-permission', '模拟权限', '已模拟角色权限、数据域和审批路径。'),
      operation('generate-settings-snapshot', '生成设置快照', '已生成平台设置快照和审计摘要。'),
    ],
    statusTracks: ['租户', '权限', '模型路由', '存储', '审计'],
  },
};

export function getModuleOperationalProfile(moduleId: ModuleId): ModuleOperationalProfile {
  const profile = moduleOperationalProfiles[moduleId];

  if (profile) {
    return profile;
  }

  const fallbackTitleMap: Partial<Record<ModuleId, string>> = {
    planning_management: '计划管理',
    finance_hr: '财务人力',
    ai_center: 'AI中心',
  };

  const title = fallbackTitleMap[moduleId] ?? moduleId;

  return {
    moduleId,
    title,
    subtitle: `${title} · 企业级生产文件与业务对象工作台`,
    statusTracks: ['业务对象', '输入资料', '过程文件', '交付物', '审批记录', '审计归档'],
    features: [
      {
        id: 'workspace',
        title: '工作区根',
        description: '模块默认工作区，用于承载业务对象、输入资料、过程文件、交付物、审批记录和审计归档。',
        status: 'ready',
        owner: title,
        metrics: ['工作区已初始化', '文件系统已挂载', '审计链已启用'],
      },
      {
        id: 'business-objects',
        title: '业务对象',
        description: '模块核心业务对象与 OpenConstructionERP 生产数据映射。',
        status: 'running',
        owner: '业务负责人',
        metrics: ['对象状态可追踪', '支持审批流转', '支持证据绑定'],
      },
      {
        id: 'deliverables',
        title: '交付物',
        description: '模块输出的 Token、报告、模型、清单、审批记录和归档资料。',
        status: 'review',
        owner: '交付负责人',
        metrics: ['交付物可归档', '版本可追溯', '支持下游模块消费'],
      },
    ],
    operations: [
      {
        id: 'generate',
        label: '生成业务凭证',
        result: '已生成模块业务 Token',
      },
      {
        id: 'approval',
        label: '提交审批',
        result: '已进入审批流程',
      },
      {
        id: 'archive',
        label: '归档交付物',
        result: '已写入数字档案',
      },
    ],
  };
}
