// lib/digital-twin.ts - Digital Twin module fixtures and typed contracts
// License: Apache-2.0

export type TwinLayerId = 'bim' | 'splat' | 'iot' | 'safety' | 'schedule';

export type TwinNodeStatus = 'editable' | 'review' | 'locked' | 'issue';

export interface TwinSceneNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: 'site' | 'building' | 'level' | 'zone' | 'element';
  source: 'IFC' | '3DGS' | 'IoT' | 'Manual';
  status: TwinNodeStatus;
  geometryComplete: boolean;
  propertyComplete: boolean;
  position: [number, number, number];
  size: [number, number, number];
  properties: Record<string, string>;
}

export interface TwinEvidenceLayer {
  id: string;
  layerId: TwinLayerId;
  name: string;
  source: string;
  format: 'IFC' | 'SPZ' | 'PLY' | '3D Tiles' | 'MQTT' | 'BCF';
  progress: number;
  status: 'ready' | 'training' | 'review' | 'blocked';
}

export interface TwinSensorPoint {
  id: string;
  name: string;
  discipline: 'energy' | 'structure' | 'safety' | 'environment';
  elementId: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  status: 'normal' | 'warning' | 'critical';
  position: [number, number, number];
}

export interface TwinIntegrityGate {
  id: string;
  name: string;
  score: number;
  status: 'pass' | 'review' | 'fail';
  detail: string;
}

export interface TwinExportPackage {
  id: string;
  name: string;
  format: 'IFC' | 'glTF' | 'USD' | '3D Tiles' | 'BOQ' | 'BCF';
  ready: boolean;
  checks: string[];
}

export const twinLayers: TwinEvidenceLayer[] = [
  {
    id: 'ifc-as-built',
    layerId: 'bim',
    name: '竣工 IFC 语义模型',
    source: 'construction_supervision.bim_handover',
    format: 'IFC',
    progress: 98,
    status: 'ready',
  },
  {
    id: 'gaussian-site',
    layerId: 'splat',
    name: '现场高斯泼溅现实层',
    source: 'drone_video + 360 panorama + phone scan',
    format: 'SPZ',
    progress: 86,
    status: 'training',
  },
  {
    id: 'iot-live',
    layerId: 'iot',
    name: 'IoT / SCADA 实时点位',
    source: 'mqtt.gateway.architoken.local',
    format: 'MQTT',
    progress: 92,
    status: 'review',
  },
  {
    id: 'safety-bcf',
    layerId: 'safety',
    name: '安全与质量 BCF 问题层',
    source: 'csr.evidence_token',
    format: 'BCF',
    progress: 74,
    status: 'review',
  },
  {
    id: 'schedule-4d',
    layerId: 'schedule',
    name: '4D 进度回放层',
    source: 'csr.progress_events',
    format: '3D Tiles',
    progress: 81,
    status: 'ready',
  },
];

export const twinSceneNodes: TwinSceneNode[] = [
  {
    id: 'site-jinping',
    parentId: null,
    name: '锦屏重钢别墅场地',
    kind: 'site',
    source: 'Manual',
    status: 'editable',
    geometryComplete: true,
    propertyComplete: true,
    position: [0, -0.08, 0],
    size: [11.5, 0.12, 7],
    properties: {
      crs: 'CGCS2000 / local grid',
      phase: 'handover',
      owner: 'AIA Demo Tenant',
    },
  },
  {
    id: 'building-a',
    parentId: 'site-jinping',
    name: 'A 栋主体',
    kind: 'building',
    source: 'IFC',
    status: 'editable',
    geometryComplete: true,
    propertyComplete: true,
    position: [-1.4, 1.1, 0],
    size: [4.8, 2.1, 3.4],
    properties: {
      ifcClass: 'IfcBuilding',
      storeys: '2',
      grossArea: '612 sqm',
    },
  },
  {
    id: 'level-01',
    parentId: 'building-a',
    name: '一层空间与结构',
    kind: 'level',
    source: 'IFC',
    status: 'review',
    geometryComplete: true,
    propertyComplete: true,
    position: [-1.4, 0.55, 0],
    size: [5.2, 0.22, 3.8],
    properties: {
      elevation: '0.000m',
      idsRule: 'ARCHI-ID-LEVEL-001',
      handover: 'pending final signoff',
    },
  },
  {
    id: 'level-02',
    parentId: 'building-a',
    name: '二层空间与结构',
    kind: 'level',
    source: 'IFC',
    status: 'editable',
    geometryComplete: true,
    propertyComplete: true,
    position: [-1.4, 1.75, 0],
    size: [4.7, 0.22, 3.2],
    properties: {
      elevation: '3.300m',
      idsRule: 'ARCHI-ID-LEVEL-002',
      handover: 'ready',
    },
  },
  {
    id: 'plant-room',
    parentId: 'level-01',
    name: '设备间温湿度区域',
    kind: 'zone',
    source: 'IoT',
    status: 'issue',
    geometryComplete: true,
    propertyComplete: false,
    position: [2.1, 0.75, -1.2],
    size: [1.25, 0.82, 1.05],
    properties: {
      ifcClass: 'IfcSpace',
      sensorBinding: 'iot-ahu-01',
      missing: 'maintenance_owner',
    },
  },
  {
    id: 'facade-west',
    parentId: 'building-a',
    name: '西立面 3DGS 对齐层',
    kind: 'element',
    source: '3DGS',
    status: 'review',
    geometryComplete: false,
    propertyComplete: true,
    position: [-3.95, 1.45, 0],
    size: [0.12, 2.4, 3.6],
    properties: {
      sourceVideo: 'drone-orbit-2026-04-24.mp4',
      splatFormat: 'SPZ',
      alignmentError: '22mm',
    },
  },
];

export const twinSensors: TwinSensorPoint[] = [
  {
    id: 'iot-ahu-01',
    name: '设备间温度',
    discipline: 'environment',
    elementId: 'plant-room',
    value: '29.2 C',
    trend: 'up',
    status: 'warning',
    position: [2.1, 1.35, -1.2],
  },
  {
    id: 'iot-beam-17',
    name: '钢梁挠度',
    discipline: 'structure',
    elementId: 'level-02',
    value: 'L/682',
    trend: 'stable',
    status: 'normal',
    position: [-1.5, 2.3, 0.8],
  },
  {
    id: 'iot-energy-main',
    name: '主回路功率',
    discipline: 'energy',
    elementId: 'building-a',
    value: '42.6 kW',
    trend: 'down',
    status: 'normal',
    position: [0.6, 2.2, -1.8],
  },
  {
    id: 'iot-edge-guard',
    name: '临边防护告警',
    discipline: 'safety',
    elementId: 'facade-west',
    value: '1 open',
    trend: 'up',
    status: 'critical',
    position: [-4.2, 2.55, 1.2],
  },
];

export const twinIntegrityGates: TwinIntegrityGate[] = [
  {
    id: 'geometry',
    name: '几何完整',
    score: 94,
    status: 'review',
    detail: '西立面 3DGS 与 IFC 外墙仍有 22mm 对齐误差。',
  },
  {
    id: 'properties',
    name: '属性完整',
    score: 88,
    status: 'review',
    detail: '设备间缺少 maintenance_owner 和维保 SLA 字段。',
  },
  {
    id: 'evidence',
    name: '证据完整',
    score: 96,
    status: 'pass',
    detail: 'IFC、视频、360 全景、IoT trace 和 BCF 问题均已绑定。',
  },
  {
    id: 'editable',
    name: '可编辑调整',
    score: 91,
    status: 'pass',
    detail: '场地、楼层、空间、构件节点可继续移动、替换、拆分和合并。',
  },
];

export const twinExportPackages: TwinExportPackage[] = [
  {
    id: 'handover-ifc',
    name: '竣工 IFC4.3',
    format: 'IFC',
    ready: true,
    checks: ['IDS pass', 'property set mapped', 'BCF resolved'],
  },
  {
    id: 'viewer-gltf',
    name: 'Web 查看 glTF',
    format: 'glTF',
    ready: true,
    checks: ['mesh optimized', 'materials baked', 'element ids preserved'],
  },
  {
    id: 'city-tiles',
    name: '园区 3D Tiles',
    format: '3D Tiles',
    ready: false,
    checks: ['CRS pending', '3DGS alignment pending'],
  },
  {
    id: 'ops-bcf',
    name: '运维 BCF 问题包',
    format: 'BCF',
    ready: true,
    checks: ['viewpoints saved', 'assignees mapped', 'SLA attached'],
  },
  {
    id: 'boq-delta',
    name: '模型导出清单',
    format: 'BOQ',
    ready: false,
    checks: ['facade delta review', 'quantity cross-check pending'],
  },
];

export function getTwinReadinessScore(): number {
  const gateScore =
    twinIntegrityGates.reduce((total, gate) => total + gate.score, 0) /
    twinIntegrityGates.length;
  const layerScore =
    twinLayers.reduce((total, layer) => total + layer.progress, 0) /
    twinLayers.length;

  return Math.round((gateScore * 0.62 + layerScore * 0.38) * 10) / 10;
}

export function getTwinBlockingIssues(): string[] {
  return [
    ...twinIntegrityGates
      .filter((gate) => gate.status !== 'pass')
      .map((gate) => `${gate.name}: ${gate.detail}`),
    ...twinExportPackages
      .filter((pkg) => !pkg.ready)
      .map((pkg) => `${pkg.name}: ${pkg.checks.join(', ')}`),
  ];
}

