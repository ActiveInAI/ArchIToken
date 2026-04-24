// lib/digital-twin.ts - Heavy steel digital twin fixtures and typed contracts
// License: Apache-2.0

export type SteelTwinLayerId =
  | 'semantic_ifc'
  | 'reality_splat'
  | 'iot_scada'
  | 'simulation'
  | 'process'
  | 'risk';

export type SteelTwinStatus = 'pass' | 'review' | 'blocked' | 'active';

export type SteelStageStatus = 'complete' | 'active' | 'watch' | 'blocked';

export type SteelMemberStatus =
  | 'fabricated'
  | 'in_transit'
  | 'erecting'
  | 'installed'
  | 'hold';

export type SteelMemberKind =
  | 'column'
  | 'beam'
  | 'brace'
  | 'truss'
  | 'corridor'
  | 'deck'
  | 'crane';

export type SteelSensorDiscipline =
  | 'stress'
  | 'strain'
  | 'vibration'
  | 'displacement'
  | 'torque'
  | 'weld'
  | 'corrosion'
  | 'energy'
  | 'safety';

export interface SteelTwinLayer {
  id: string;
  layerId: SteelTwinLayerId;
  name: string;
  source: string;
  standard: string;
  progress: number;
  status: SteelTwinStatus;
}

export interface SteelTwinStage {
  id: string;
  name: string;
  scope: string;
  standard: string;
  evidence: string;
  progress: number;
  status: SteelStageStatus;
}

export interface SteelMember {
  id: string;
  memberMark: string;
  assembly: string;
  kind: SteelMemberKind;
  section: string;
  materialGrade: string;
  tonnage: number;
  weldSpec: string;
  boltSpec: string;
  status: SteelMemberStatus;
  shopStatus: string;
  siteStatus: string;
  geometryStatus: 'complete' | 'review' | 'blocked';
  propertyStatus: 'complete' | 'review' | 'blocked';
  risk: 'low' | 'medium' | 'high';
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  properties: Record<string, string>;
}

export interface SteelSensorPoint {
  id: string;
  name: string;
  discipline: SteelSensorDiscipline;
  memberId: string;
  value: string;
  limit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'normal' | 'warning' | 'critical';
  position: [number, number, number];
}

export interface SteelQualityGate {
  id: string;
  name: string;
  group: 'geometry' | 'performance' | 'measurement' | 'process' | 'handover';
  score: number;
  status: 'pass' | 'review' | 'fail';
  standard: string;
  detail: string;
}

export interface SteelProcessMetric {
  id: string;
  name: string;
  value: string;
  unit: string;
  tone: 'cyan' | 'green' | 'amber' | 'red';
  detail: string;
}

export interface SteelSimulationThread {
  id: string;
  name: string;
  input: string;
  engine: string;
  output: string;
  confidence: number;
}

export interface SteelExportPackage {
  id: string;
  name: string;
  format: 'IFC4.3' | 'STEP' | '3D Tiles' | 'SPZ' | 'BOM' | 'Inspection' | 'BCF';
  ready: boolean;
  checks: string[];
}

export const steelTwinLayers: SteelTwinLayer[] = [
  {
    id: 'ifc-steel-semantic',
    layerId: 'semantic_ifc',
    name: 'IFC4.3 重钢结构语义层',
    source: 'steel_detailing.ifc + IDS rules',
    standard: 'buildingSMART IFC4.3 / IDS / ISO 19650',
    progress: 94,
    status: 'review',
  },
  {
    id: 'splat-site-reality',
    layerId: 'reality_splat',
    name: '3DGS 影像重建现实捕捉层',
    source: 'drone video + 360 panorama + multi-view photos, aligned by LiDAR/E57 control points',
    standard: 'OpenUSD-ready / SPZ / PLY / E57 control points',
    progress: 87,
    status: 'active',
  },
  {
    id: 'iot-structure-live',
    layerId: 'iot_scada',
    name: 'IoT / SCADA 结构健康点位',
    source: 'MQTT edge gateway + OPC UA bridge',
    standard: 'ISO 23247 / OPC UA / MQTT Sparkplug B',
    progress: 91,
    status: 'active',
  },
  {
    id: 'shape-performance-sim',
    layerId: 'simulation',
    name: '形性一体仿真与降阶模型',
    source: 'FEA + ROM + measured residual correction',
    standard: 'AISC 360 / EN 1993 / AS 4100 / GB 50017',
    progress: 89,
    status: 'review',
  },
  {
    id: 'process-ddmrp',
    layerId: 'process',
    name: '制造-物流-吊装流程孪生',
    source: 'MES + WMS + 4D schedule + crane plan',
    standard: 'PMBOK / IPMA ICB / DDMRP / ISO 21502',
    progress: 84,
    status: 'review',
  },
  {
    id: 'risk-compliance',
    layerId: 'risk',
    name: '质量安全与法规门禁层',
    source: 'NCR + ITP + BCF + permit-to-lift',
    standard: 'AWS D1.1 / EN 1090 / AS/NZS 5131 / GB 55006',
    progress: 86,
    status: 'review',
  },
];

export const steelTwinStages: SteelTwinStage[] = [
  {
    id: 'scheme-design',
    name: '方案设计',
    scope: '跨度、柱网、吊装分区、临建和交通组织快速推演。',
    standard: 'PMBOK scope baseline / ISO 19650 information need',
    evidence: '方案比选、初步荷载、施工边界',
    progress: 100,
    status: 'complete',
  },
  {
    id: 'detail-design',
    name: '深化设计',
    scope: 'Tekla/IFC 构件编码、节点板、焊缝、螺栓、MBD 属性完整化。',
    standard: 'IFC4.3 / AISC 360 / EN 1993 / GB 50017',
    evidence: 'IDS 规则、节点详图、碰撞审查',
    progress: 92,
    status: 'active',
  },
  {
    id: 'material-ddmrp',
    name: '材料管理',
    scope: '钢板、型钢、高强螺栓、焊材按 DDMRP 缓冲区动态补货。',
    standard: 'DDMRP / ISO 9001 traceability',
    evidence: '炉批号、材质证明、入库复验',
    progress: 79,
    status: 'watch',
  },
  {
    id: 'quantity-cost',
    name: '计量造价',
    scope: '从模型导出 MTO/BOQ/BOM, 跟踪变更、损耗、签证和索赔证据。',
    standard: 'ISO 12006 / NRM / ASTM E2516 / 中国工程量清单',
    evidence: '模型清单、变更差异、费用曲线',
    progress: 88,
    status: 'active',
  },
  {
    id: 'fabrication',
    name: '生产制造',
    scope: '下料、组立、焊接、矫正、涂装、二维码追溯。',
    standard: 'AWS D1.1 / EN 1090 / AS/NZS 5131 / GB 50205',
    evidence: 'WPS/PQR、UT/RT、涂层 DFT',
    progress: 83,
    status: 'active',
  },
  {
    id: 'logistics',
    name: '物流运输',
    scope: '超长超重构件路径、装车顺序、到场验收和堆场占用。',
    standard: 'ISO 55000 asset traceability / PMBOK schedule control',
    evidence: 'GPS、签收单、构件照片',
    progress: 76,
    status: 'watch',
  },
  {
    id: 'erection',
    name: '施工管理',
    scope: '吊装、临撑、焊接、螺栓终拧、进度质量安全 AR 复核。',
    standard: 'OSHA / EN 1090 / GB 55006 / GB 50205',
    evidence: 'permit-to-lift、AR 复核、点云残差',
    progress: 68,
    status: 'blocked',
  },
  {
    id: 'archive',
    name: '数据档案',
    scope: '合同、标准族库、图纸模型、检测报告、企业文宣统一归档。',
    standard: 'ISO 19650 CDE / OAIS archive model',
    evidence: 'CDE 元数据、版本、签章',
    progress: 86,
    status: 'active',
  },
  {
    id: 'shape-performance',
    name: '数字孪生',
    scope: '几何形态、结构性能、施工过程和运维状态持续闭环。',
    standard: 'ISO 23247 / OpenUSD / IFC / PHM',
    evidence: '算测融合、预测维护、回放推演',
    progress: 82,
    status: 'active',
  },
];

export const steelMembers: SteelMember[] = [
  {
    id: 'col-a1',
    memberMark: 'C-A1',
    assembly: 'A 区首节钢柱',
    kind: 'column',
    section: 'BOX500x500x28',
    materialGrade: 'Q355B / ASTM A572 Gr.50 equivalent',
    tonnage: 8.6,
    weldSpec: 'CJP groove weld, UT 100%',
    boltSpec: 'M24 10.9S slip-critical',
    status: 'installed',
    shopStatus: '涂装完成',
    siteStatus: '终拧复核完成',
    geometryStatus: 'complete',
    propertyStatus: 'complete',
    risk: 'low',
    position: [-3.2, 1.6, -1.8],
    size: [0.28, 3.2, 0.28],
    properties: {
      lot: 'HEAT-Q355-240421',
      weldMap: 'W-C-A1-07',
      survey: 'axis +4mm / elevation -2mm',
    },
  },
  {
    id: 'col-a2',
    memberMark: 'C-A2',
    assembly: 'A 区首节钢柱',
    kind: 'column',
    section: 'BOX500x500x28',
    materialGrade: 'Q355B / EN S355 equivalent',
    tonnage: 8.4,
    weldSpec: 'CJP groove weld, UT 100%',
    boltSpec: 'M24 10.9S slip-critical',
    status: 'installed',
    shopStatus: '涂装完成',
    siteStatus: '轴线复核完成',
    geometryStatus: 'complete',
    propertyStatus: 'complete',
    risk: 'low',
    position: [3.2, 1.6, -1.8],
    size: [0.28, 3.2, 0.28],
    properties: {
      lot: 'HEAT-Q355-240421',
      weldMap: 'W-C-A2-03',
      survey: 'axis -3mm / elevation +1mm',
    },
  },
  {
    id: 'col-b1',
    memberMark: 'C-B1',
    assembly: 'B 区二节钢柱',
    kind: 'column',
    section: 'BOX600x600x32',
    materialGrade: 'Q390GJC',
    tonnage: 11.2,
    weldSpec: 'CJP groove weld, phased-array UT',
    boltSpec: 'M27 10.9S',
    status: 'erecting',
    shopStatus: '出厂验收完成',
    siteStatus: '临撑未闭合',
    geometryStatus: 'review',
    propertyStatus: 'complete',
    risk: 'high',
    position: [-3.2, 1.8, 2],
    size: [0.32, 3.6, 0.32],
    properties: {
      lot: 'HEAT-Q390-240418',
      weldMap: 'W-C-B1-12',
      survey: 'temporary brace pending',
    },
  },
  {
    id: 'col-b2',
    memberMark: 'C-B2',
    assembly: 'B 区二节钢柱',
    kind: 'column',
    section: 'BOX600x600x32',
    materialGrade: 'Q390GJC',
    tonnage: 11,
    weldSpec: 'CJP groove weld, phased-array UT',
    boltSpec: 'M27 10.9S',
    status: 'fabricated',
    shopStatus: '等待超声复检',
    siteStatus: '未到场',
    geometryStatus: 'complete',
    propertyStatus: 'review',
    risk: 'medium',
    position: [3.2, 1.8, 2],
    size: [0.32, 3.6, 0.32],
    properties: {
      lot: 'HEAT-Q390-240418',
      weldMap: 'W-C-B2-09',
      issue: 'DFT coating field missing',
    },
  },
  {
    id: 'beam-l2-east',
    memberMark: 'G-L2-E',
    assembly: '二层东向主梁',
    kind: 'beam',
    section: 'H900x300x16x28',
    materialGrade: 'Q355B',
    tonnage: 6.1,
    weldSpec: 'fillet weld 8mm, MT 20%',
    boltSpec: 'M22 10.9S',
    status: 'installed',
    shopStatus: '完成',
    siteStatus: '终拧完成',
    geometryStatus: 'complete',
    propertyStatus: 'complete',
    risk: 'low',
    position: [0, 3.2, -1.8],
    size: [6.8, 0.26, 0.32],
    properties: {
      camber: '18mm',
      deflection: 'L/780',
      connection: 'end-plate EP-22',
    },
  },
  {
    id: 'beam-l2-west',
    memberMark: 'G-L2-W',
    assembly: '二层西向主梁',
    kind: 'beam',
    section: 'H900x300x16x28',
    materialGrade: 'Q355B',
    tonnage: 6.2,
    weldSpec: 'fillet weld 8mm, MT 20%',
    boltSpec: 'M22 10.9S',
    status: 'erecting',
    shopStatus: '完成',
    siteStatus: '待终拧',
    geometryStatus: 'review',
    propertyStatus: 'complete',
    risk: 'medium',
    position: [0, 3.2, 2],
    size: [6.8, 0.26, 0.32],
    properties: {
      camber: '18mm',
      deflection: 'L/642',
      connection: 'end-plate EP-22',
    },
  },
  {
    id: 'roof-truss-01',
    memberMark: 'TR-RF-01',
    assembly: '屋面桁架一榀',
    kind: 'truss',
    section: 'H500 chord + L160 brace',
    materialGrade: 'Q355B',
    tonnage: 14.8,
    weldSpec: 'shop weld, UT/MT sample',
    boltSpec: 'M24 field splice',
    status: 'in_transit',
    shopStatus: '装车完成',
    siteStatus: 'ETA 2h14m',
    geometryStatus: 'complete',
    propertyStatus: 'complete',
    risk: 'medium',
    position: [0, 4.75, 0.1],
    size: [7.2, 0.22, 0.28],
    rotation: [0, 0, 0.08],
    properties: {
      package: 'PKG-RF-07',
      route: 'oversize permit approved',
      liftPlan: 'LIFT-46',
    },
  },
  {
    id: 'corridor-truss-03',
    memberMark: 'TR-COR-03',
    assembly: '高空连廊桁架',
    kind: 'corridor',
    section: 'box truss 24m',
    materialGrade: 'Q390GJC',
    tonnage: 31.5,
    weldSpec: 'CJP + UT 100% + RT spot',
    boltSpec: 'M30 10.9S',
    status: 'hold',
    shopStatus: '预拼装完成',
    siteStatus: '吊装净空冲突',
    geometryStatus: 'blocked',
    propertyStatus: 'complete',
    risk: 'high',
    position: [0, 4.1, 3.35],
    size: [5.4, 0.38, 0.38],
    properties: {
      liftWeight: '34.2t with rigging',
      clearance: 'east facade clash 180mm',
      permit: 'blocked before weather window',
    },
  },
  {
    id: 'wind-brace-02',
    memberMark: 'BR-W-02',
    assembly: '抗风支撑',
    kind: 'brace',
    section: 'CHS273x12',
    materialGrade: 'Q355B',
    tonnage: 2.8,
    weldSpec: 'full penetration at gusset',
    boltSpec: 'M20 10.9S',
    status: 'installed',
    shopStatus: '完成',
    siteStatus: '复测完成',
    geometryStatus: 'complete',
    propertyStatus: 'complete',
    risk: 'low',
    position: [-3.15, 2.85, 0.12],
    size: [0.16, 4.25, 0.16],
    rotation: [0, 0, 0.64],
    properties: {
      gusset: 'GP-W-02',
      stress: '0.61 fy',
      corrosion: 'baseline captured',
    },
  },
  {
    id: 'crane-zone-46',
    memberMark: 'LIFT-46',
    assembly: '400t 履带吊作业包',
    kind: 'crane',
    section: 'main boom 72m',
    materialGrade: 'operation asset',
    tonnage: 0,
    weldSpec: 'N/A',
    boltSpec: 'N/A',
    status: 'erecting',
    shopStatus: 'N/A',
    siteStatus: '风速 8.6m/s, 半径复核中',
    geometryStatus: 'review',
    propertyStatus: 'complete',
    risk: 'high',
    position: [5.2, 0.18, -3.4],
    size: [0.44, 0.32, 0.44],
    properties: {
      radius: '34m',
      utilization: '86%',
      nextLift: 'TR-COR-03',
    },
  },
];

export const steelSensors: SteelSensorPoint[] = [
  {
    id: 'stress-col-b1',
    name: '柱脚应力',
    discipline: 'stress',
    memberId: 'col-b1',
    value: '0.72 fy',
    limit: '< 0.85 fy',
    trend: 'up',
    status: 'warning',
    position: [-3.2, 0.52, 2],
  },
  {
    id: 'strain-beam-w',
    name: '主梁应变',
    discipline: 'strain',
    memberId: 'beam-l2-west',
    value: '486 ue',
    limit: '< 650 ue',
    trend: 'stable',
    status: 'normal',
    position: [-0.8, 3.42, 2],
  },
  {
    id: 'vibration-roof',
    name: '屋面桁架振动',
    discipline: 'vibration',
    memberId: 'roof-truss-01',
    value: '3.1 mm/s',
    limit: '< 5 mm/s',
    trend: 'down',
    status: 'normal',
    position: [1.4, 4.98, 0.15],
  },
  {
    id: 'bolt-corridor',
    name: 'M30 终拧扭矩',
    discipline: 'torque',
    memberId: 'corridor-truss-03',
    value: '82%',
    limit: '>= 95%',
    trend: 'stable',
    status: 'critical',
    position: [2.15, 4.35, 3.35],
  },
  {
    id: 'weld-temp-b1',
    name: '焊后温度',
    discipline: 'weld',
    memberId: 'col-b1',
    value: '142 C',
    limit: 'WPS window',
    trend: 'down',
    status: 'normal',
    position: [-3.2, 2.78, 2],
  },
  {
    id: 'splat-residual-west',
    name: '点云残差',
    discipline: 'displacement',
    memberId: 'beam-l2-west',
    value: '26 mm',
    limit: '< 20 mm',
    trend: 'up',
    status: 'warning',
    position: [-2.9, 3.15, 2.35],
  },
  {
    id: 'corrosion-brace',
    name: '防腐涂层',
    discipline: 'corrosion',
    memberId: 'wind-brace-02',
    value: 'DFT 238 um',
    limit: '>= 220 um',
    trend: 'stable',
    status: 'normal',
    position: [-3.4, 2.6, 0.3],
  },
  {
    id: 'crane-wind',
    name: '吊装风速',
    discipline: 'safety',
    memberId: 'crane-zone-46',
    value: '8.6 m/s',
    limit: '< 10.8 m/s',
    trend: 'up',
    status: 'warning',
    position: [5.2, 2.4, -3.4],
  },
];

export const steelQualityGates: SteelQualityGate[] = [
  {
    id: 'geometry-axis',
    name: '轴线/标高几何门禁',
    group: 'geometry',
    score: 96,
    status: 'pass',
    standard: 'GB 50205 / EN 1090 / AS/NZS 5131',
    detail: '钢柱轴线、标高、垂直度已完成点云和全站仪双检。',
  },
  {
    id: 'splat-alignment',
    name: '3DGS/点云残差',
    group: 'measurement',
    score: 88,
    status: 'review',
    standard: 'E57 / PLY / SPZ / ISO 19650 CDE',
    detail: '西侧二层梁与实景层存在 26mm 残差, 需回写调整。',
  },
  {
    id: 'weld-inspection',
    name: '焊缝 UT/RT 检测',
    group: 'measurement',
    score: 91,
    status: 'review',
    standard: 'AWS D1.1 / ISO 17635 / GB 50661',
    detail: 'C-B2 等待补充相控阵 UT 复检和 RT 抽检报告。',
  },
  {
    id: 'bolt-torque',
    name: '高强螺栓终拧',
    group: 'performance',
    score: 84,
    status: 'review',
    standard: 'RCSC / EN 14399 / GB/T 1231',
    detail: '高空连廊 M30 节点终拧样本只有 82%, 阈值未达 95%。',
  },
  {
    id: 'lift-clearance',
    name: '吊装半径与净空',
    group: 'process',
    score: 76,
    status: 'fail',
    standard: 'OSHA lift planning / GB 55006 / PMBOK risk register',
    detail: 'LIFT-46 与东立面脚手架存在 180mm 净空冲突。',
  },
  {
    id: 'shape-performance',
    name: '形性一体算测融合',
    group: 'performance',
    score: 89,
    status: 'review',
    standard: 'FEA + ROM + PHM / AISC 360 / AS 4100',
    detail: '应力、挠度、振动和点云形态已绑定, 仍需校正吊装工况。',
  },
  {
    id: 'ifc-ids',
    name: 'IFC/IDS 属性门禁',
    group: 'handover',
    score: 95,
    status: 'pass',
    standard: 'buildingSMART IFC4.3 / IDS / BCF',
    detail: '构件编码、炉批号、焊缝、螺栓、检测和责任方字段完整。',
  },
  {
    id: 'editable-roundtrip',
    name: '可编辑回写闭环',
    group: 'handover',
    score: 90,
    status: 'pass',
    standard: 'OpenUSD / IFC round-trip / Git-like model versioning',
    detail: '构件位姿、节点属性、检测证据可回写模型版本并导出差异。',
  },
];

export const steelProcessMetrics: SteelProcessMetric[] = [
  {
    id: 'tonnage',
    name: '总钢量',
    value: '1,280',
    unit: 't',
    tone: 'cyan',
    detail: '含主体、连廊、临撑和屋面桁架。',
  },
  {
    id: 'members',
    name: '构件编码',
    value: '2,418',
    unit: 'pcs',
    tone: 'green',
    detail: 'IFC GUID 与二维码追溯已绑定。',
  },
  {
    id: 'ddmrp-buffer',
    name: 'DDMRP 红区',
    value: '18',
    unit: '%',
    tone: 'red',
    detail: 'M30 螺栓和防火涂料进入红区补货。',
  },
  {
    id: 'lift-plan',
    name: '当前吊装',
    value: 'LIFT-46',
    unit: '',
    tone: 'amber',
    detail: '400t 履带吊, 半径 34m, 利用率 86%。',
  },
  {
    id: 'shop-throughput',
    name: '制造节拍',
    value: '92',
    unit: '%',
    tone: 'green',
    detail: '组立焊接线瓶颈由 AI 调度前移 1.5 天。',
  },
  {
    id: 'ai-optimization',
    name: '优化收益',
    value: '-6.8',
    unit: '% cost',
    tone: 'cyan',
    detail: '组合吊次、堆场和物流路径后的预测节约。',
  },
];

export const steelSimulationThreads: SteelSimulationThread[] = [
  {
    id: 'semantic-thread',
    name: 'MBD / IFC 几何语义',
    input: '深化模型、节点详图、图纸/PDF、构件编码',
    engine: 'IFC4.3 + IDS + OCCT/STEP kernel',
    output: '可编辑构件树、属性门禁、清单导出',
    confidence: 95,
  },
  {
    id: 'performance-thread',
    name: 'FEA / ROM 性能孪生',
    input: '荷载、边界条件、应力/应变/振动传感器',
    engine: 'FEA + reduced-order model + PHM',
    output: '挠度、疲劳、连接应力、风险热区',
    confidence: 89,
  },
  {
    id: 'reality-thread',
    name: '3DGS 现实捕捉',
    input: '无人机视频、360 全景、多视角照片、LiDAR/E57 控制点',
    engine: 'Gaussian Splatting + scan residual alignment',
    output: '连续实景层、残差热图、遮挡/净空复核',
    confidence: 87,
  },
  {
    id: 'process-thread',
    name: '流程孪生与 DDMRP',
    input: 'MES、WMS、GPS、吊装计划、进度计划',
    engine: 'Simio-style process twin + AI optimizer',
    output: '瓶颈、缓冲区、吊次、物流 ETA 和成本推演',
    confidence: 84,
  },
  {
    id: 'agent-thread',
    name: 'AI Agent 闭环治理',
    input: 'NCR、RFI、规范条文、BCF、合同责任矩阵',
    engine: 'LangGraph/Hermes Agent + Langfuse trace',
    output: '风险解释、整改建议、证据链和审批节点',
    confidence: 86,
  },
];

export const steelExportPackages: SteelExportPackage[] = [
  {
    id: 'ifc43-handover',
    name: 'IFC4.3 钢构竣工模型',
    format: 'IFC4.3',
    ready: true,
    checks: ['IDS pass', 'member GUID preserved', 'weld/bolt properties mapped'],
  },
  {
    id: 'step-occt',
    name: 'STEP / OCCT 构件制造包',
    format: 'STEP',
    ready: true,
    checks: ['plate geometry exact', 'hole groups retained', 'assembly marks exported'],
  },
  {
    id: 'splat-tiles',
    name: '3D Tiles + SPZ 实景包',
    format: 'SPZ',
    ready: false,
    checks: ['west beam residual review', 'CRS lock pending', 'occlusion mask pending'],
  },
  {
    id: 'bom-boq',
    name: 'BOM / BOQ / MTO 清单',
    format: 'BOM',
    ready: true,
    checks: ['tonnage checked', 'paint area checked', 'change delta attached'],
  },
  {
    id: 'inspection-record',
    name: '焊缝螺栓检测档案',
    format: 'Inspection',
    ready: false,
    checks: ['C-B2 UT pending', 'M30 torque sample pending', 'DFT photo attached'],
  },
  {
    id: 'bcf-risk',
    name: 'BCF 风险闭环包',
    format: 'BCF',
    ready: false,
    checks: ['LIFT-46 clearance clash open', 'responsible party assigned', 'deadline set'],
  },
];

export function getSteelTwinReadinessScore(): number {
  const gateScore =
    steelQualityGates.reduce((total, gate) => total + gate.score, 0) /
    steelQualityGates.length;
  const layerScore =
    steelTwinLayers.reduce((total, layer) => total + layer.progress, 0) /
    steelTwinLayers.length;
  const stageScore =
    steelTwinStages.reduce((total, stage) => total + stage.progress, 0) /
    steelTwinStages.length;

  return Math.round((gateScore * 0.54 + layerScore * 0.2 + stageScore * 0.26) * 10) / 10;
}

export function getSteelTwinBlockingIssues(): string[] {
  return [
    ...steelTwinStages
      .filter((stage) => stage.status === 'blocked')
      .map((stage) => `${stage.name}: ${stage.scope}`),
    ...steelQualityGates
      .filter((gate) => gate.status !== 'pass')
      .map((gate) => `${gate.name}: ${gate.detail}`),
    ...steelExportPackages
      .filter((pkg) => !pkg.ready)
      .map((pkg) => `${pkg.name}: ${pkg.checks.join(', ')}`),
  ];
}
