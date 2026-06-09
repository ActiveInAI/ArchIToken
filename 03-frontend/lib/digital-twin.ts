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

export interface SteelMemberTwinGeometry {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
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

export type SteelTwinReferenceId =
  | 'cesium'
  | 'mapbox-gl'
  | 'maptalks'
  | 'd3'
  | 'three'
  | 'echarts'
  | 'highcharts'
  | 'kepler'
  | 'maptalks-three';

export type SteelTwinViewportModeId =
  | 'cde_model'
  | 'city_context'
  | 'reality_capture'
  | 'process_sim'
  | 'risk_heatmap'
  | 'handover_package';

export interface SteelTwinVisualizationReference {
  id: SteelTwinReferenceId;
  name: string;
  sourceUrl: string;
  role: string;
  runtimeDecision: string;
  bundledRuntime: boolean;
}

export interface SteelTwinViewportMode {
  id: SteelTwinViewportModeId;
  name: string;
  engine: string;
  focusLayerIds: SteelTwinLayerId[];
  references: SteelTwinReferenceId[];
  kpi: string;
}

export interface SteelTwinWebGpuAdapterManifest {
  rendererId: string;
  preferredRuntime: 'webgpu';
  fallbackRuntime: 'three';
  requiredBrowserApi: 'navigator.gpu';
  shaderLanguage: 'wgsl';
  nvidiaGpuStack: string[];
  auditSignals: string[];
}

export interface SteelTwinWebGpuPickTarget {
  memberId: string;
  memberMark: string;
  center: [number, number];
  size: [number, number];
  selected: boolean;
}

export interface SteelTwinWebGpuSceneOptions {
  activeLayerIds: readonly SteelTwinLayerId[];
  selectedMemberId: string;
  geometryOverrides?: Partial<Record<string, SteelMemberTwinGeometry>>;
  hiddenMemberIds?: readonly string[];
  progressPhase?: number;
}

export interface SteelTwinWebGpuScene {
  vertices: Float32Array;
  vertexCount: number;
  pickTargets: SteelTwinWebGpuPickTarget[];
  layerVertexCounts: Record<SteelTwinLayerId | 'grid', number>;
}

export interface SteelTwinRuntimeCapability {
  id: string;
  name: string;
  role: string;
  standard: string;
  status: 'implemented' | 'adapter_ready' | 'planned';
}

export const steelTwinWebGpuAdapterManifest: SteelTwinWebGpuAdapterManifest = {
  rendererId: 'architoken-steel-twin-webgpu.v1',
  preferredRuntime: 'webgpu',
  fallbackRuntime: 'three',
  requiredBrowserApi: 'navigator.gpu',
  shaderLanguage: 'wgsl',
  nvidiaGpuStack: [
    'NGC CUDA/CUDA-DL signed image',
    'NVIDIA Container Toolkit',
    'NVIDIA GPU Operator/device plugin',
    'DCGM',
    'CUDA/OptiX/TensorRT/Triton runtime smoke',
  ],
  auditSignals: [
    'adapter_info',
    'device_limits',
    'nvidia_smi',
    'cuda_kernel_smoke',
    'ngc_image_tag_or_digest',
    'active_layer_ids',
    'selected_member_id',
    'fallback_reason',
  ],
};

export const steelTwinRuntimeCapabilities: SteelTwinRuntimeCapability[] = [
  {
    id: 'webgpu-wgsl-viewport',
    name: 'WebGPU / WGSL 原生视口',
    role: '浏览器主渲染与后续 GPU picking / compute 管线',
    standard: 'W3C WebGPU / WGSL',
    status: 'implemented',
  },
  {
    id: 'ifc43-ids-bcf',
    name: 'openBIM 语义与问题闭环',
    role: '构件 GUID、属性、交付要求、BCF 问题和 CDE 审批真源',
    standard: 'buildingSMART IFC4.3 / IDS / BCF',
    status: 'adapter_ready',
  },
  {
    id: 'gltf-runtime-assets',
    name: 'glTF / GLB 运行时资产',
    role: 'Web 端轻量模型、PBR 材质和工程 derivative 传输',
    standard: 'Khronos glTF 2.0',
    status: 'adapter_ready',
  },
  {
    id: 'tiles-openusd-geospatial',
    name: '3D Tiles + OpenUSD 场景组合',
    role: '厂区/城市尺度流式加载和多来源工程场景装配',
    standard: 'OGC 3D Tiles / OpenUSD',
    status: 'planned',
  },
  {
    id: 'reality-3dgs-e57',
    name: '3DGS + E57/LAS 实景校核',
    role: '影像实景层、点云控制点、残差热图和遮挡/净空复核',
    standard: 'SPZ / PLY / E57 / LAS / LAZ',
    status: 'adapter_ready',
  },
  {
    id: 'iot-process-twin',
    name: 'IoT/SCADA + 流程孪生',
    role: '传感器时序、制造物流吊装过程、FEA/ROM 算测融合',
    standard: 'ISO 23247 / OPC UA / MQTT Sparkplug B / ISO 55000',
    status: 'adapter_ready',
  },
];

const steelMemberTwinGeometryOverrides: Record<string, SteelMemberTwinGeometry> = {
  'col-a1': {
    position: [-4.8, 1.6, -3],
    size: [0.24, 3.2, 0.24],
  },
  'col-a2': {
    position: [4.8, 1.6, -3],
    size: [0.24, 3.2, 0.24],
  },
  'col-b1': {
    position: [-4.8, 3.9, 3],
    size: [0.3, 2.5, 0.3],
  },
  'col-b2': {
    position: [4.8, 3.9, 3],
    size: [0.3, 2.5, 0.3],
  },
  'beam-l2-east': {
    position: [0, 2.65, -3],
    size: [9.8, 0.26, 0.3],
  },
  'beam-l2-west': {
    position: [0, 2.65, 3],
    size: [9.8, 0.26, 0.3],
  },
  'roof-truss-01': {
    position: [0, 5.15, 0],
    size: [9.8, 0.28, 0.34],
  },
  'corridor-truss-03': {
    position: [0, 4.48, 3.65],
    size: [7.4, 0.38, 0.38],
  },
  'wind-brace-02': {
    position: [-4.82, 2.65, 0],
    size: [0.15, 3.15, 0.15],
    rotation: [0, 0, 0.64],
  },
  'crane-zone-46': {
    position: [5.1, 0.18, -3.4],
    size: [0.44, 0.32, 0.44],
  },
};

const steelSensorTwinOffsets: Record<string, [number, number, number]> = {
  'stress-col-b1': [0, -1.05, 0],
  'strain-beam-w': [-1.1, 0.18, 0],
  'vibration-roof': [1.2, 0.22, 0],
  'bolt-corridor': [2.15, 0.18, 0],
  'weld-temp-b1': [0, 0.75, 0],
  'splat-residual-west': [-2.85, -0.08, 0.35],
  'corrosion-brace': [-0.22, 0.05, 0.2],
  'crane-wind': [0, 2.2, 0],
};

export const steelTwinVisualizationReferences: SteelTwinVisualizationReference[] = [
  {
    id: 'cesium',
    name: 'CesiumJS / 3D Tiles',
    sourceUrl: 'https://github.com/CesiumGS/cesium',
    role: '海量地理空间、3D Tiles、倾斜摄影和城市级坐标框架参考。',
    runtimeDecision: '当前阶段不引入 Cesium 运行时, 但数据出口必须保留 3D Tiles / CRS / tileset metadata。',
    bundledRuntime: false,
  },
  {
    id: 'mapbox-gl',
    name: 'Mapbox GL JS',
    sourceUrl: 'https://www.mapbox.com/mapbox-gljs',
    role: '动态地图、3D 建筑、地形、热力和大规模要素性能参考。',
    runtimeDecision: '当前阶段不绑定 Mapbox token, 但保留地图视角、图层表达和后续 self-hosted tiles 接口。',
    bundledRuntime: false,
  },
  {
    id: 'maptalks',
    name: 'Maptalks',
    sourceUrl: 'https://maptalks.org/',
    role: '2D/3D 一体地图、WebGL 扩展和插件生态参考。',
    runtimeDecision: '作为厂区/城市底图方案候选, 当前先在 Three.js 场景中保留地图模式和图层契约。',
    bundledRuntime: false,
  },
  {
    id: 'd3',
    name: 'D3.js',
    sourceUrl: 'https://d3js.org/',
    role: '数据映射、尺度、交互和自定义 SVG/Canvas 图形逻辑参考。',
    runtimeDecision: '仓库已引入 d3, 数字孪生数据保持可由 scale/layout/interaction 直接驱动。',
    bundledRuntime: true,
  },
  {
    id: 'three',
    name: 'Three.js',
    sourceUrl: 'https://threejs.org/',
    role: 'WebGPU 优先策略下的 Three.js 受审计失败恢复三维视口。',
    runtimeDecision: '当前运行面板使用 @react-three/fiber + three 渲染构件、传感器和风险层；生产 GPU 完成证据仍以 WebGPU/NVIDIA runtime smoke 为准。',
    bundledRuntime: true,
  },
  {
    id: 'echarts',
    name: 'Apache ECharts',
    sourceUrl: 'https://echarts.apache.org/zh/index.html',
    role: '大数据图表、Canvas/SVG 双引擎、增量渲染和无障碍描述参考。',
    runtimeDecision: '当前不新增运行时依赖, 但仪表盘数据结构预留 ECharts option 映射。',
    bundledRuntime: false,
  },
  {
    id: 'highcharts',
    name: 'Highcharts',
    sourceUrl: 'https://www.highcharts.com/',
    role: '企业级仪表盘、响应式布局、无障碍和多框架集成参考。',
    runtimeDecision: '因授权边界不默认打包, 仅作为企业 BI 视图和可访问性标准参考。',
    bundledRuntime: false,
  },
  {
    id: 'kepler',
    name: 'Kepler.gl',
    sourceUrl: 'https://kepler.gl/',
    role: '大规模地理空间分析、过滤、聚合、OD 关系和时序播放参考。',
    runtimeDecision: '风险热区和物流 OD 数据按 Kepler layer/filter/time playback 思路建模。',
    bundledRuntime: false,
  },
  {
    id: 'maptalks-three',
    name: 'maptalks.three',
    sourceUrl: 'https://maptalks.org/maptalks.three/docs/dist/',
    role: 'Maptalks 与 Three.js 融合、自定义三维图形组件和大规模 ExtrudePolygon 参考。',
    runtimeDecision: '当前用 Three.js 原生视口实现, 后续城市级地图联动按 maptalks.three 接口拆层。',
    bundledRuntime: false,
  },
];

export const steelTwinViewportModes: SteelTwinViewportMode[] = [
  {
    id: 'cde_model',
    name: 'CDE模型',
    engine: 'WebGPU primary + audited Three.js recovery + IFC/OpenUSD/3D Tiles derivative',
    focusLayerIds: ['semantic_ifc', 'reality_splat', 'iot_scada', 'simulation', 'process', 'risk'],
    references: ['three', 'd3'],
    kpi: '构件选择、属性门禁、IFC/IDS 回写',
  },
  {
    id: 'city_context',
    name: '城市/厂区',
    engine: '3D Tiles-ready geospatial mode',
    focusLayerIds: ['semantic_ifc', 'process', 'risk'],
    references: ['cesium', 'mapbox-gl', 'maptalks', 'maptalks-three'],
    kpi: 'CRS、倾斜摄影、厂区道路和吊装路径',
  },
  {
    id: 'reality_capture',
    name: '实景捕捉',
    engine: '3DGS / E57 / LiDAR residual mode',
    focusLayerIds: ['reality_splat', 'semantic_ifc', 'risk'],
    references: ['three', 'maptalks-three', 'echarts'],
    kpi: '360、点云、残差热图和遮挡复核',
  },
  {
    id: 'process_sim',
    name: '流程仿真',
    engine: 'MES/WMS/4D schedule process twin',
    focusLayerIds: ['process', 'simulation', 'iot_scada'],
    references: ['d3', 'highcharts'],
    kpi: '制造节拍、DDMRP、物流 ETA 和吊次',
  },
  {
    id: 'risk_heatmap',
    name: '风险热区',
    engine: 'Kepler-style spatial filter + safety gates',
    focusLayerIds: ['risk', 'iot_scada', 'simulation'],
    references: ['kepler', 'mapbox-gl', 'echarts'],
    kpi: '质量、安全、成本、净空和整改闭环',
  },
  {
    id: 'handover_package',
    name: '交付包',
    engine: 'IFC/STEP/SPZ/BCF package manifest',
    focusLayerIds: ['semantic_ifc', 'reality_splat', 'risk'],
    references: ['cesium', 'd3', 'three'],
    kpi: 'IFC4.3、STEP、3D Tiles、SPZ、BOM、检测档案',
  },
];

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
    id: 'production_manufacturing',
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

export function getSteelMemberTwinGeometry(
  member: SteelMember,
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>> = {},
): SteelMemberTwinGeometry {
  const override = geometryOverrides[member.id] ?? steelMemberTwinGeometryOverrides[member.id];
  if (override) return override;

  const fallback: SteelMemberTwinGeometry = {
    position: member.position,
    size: member.size,
  };
  if (member.rotation) {
    fallback.rotation = member.rotation;
  }
  return fallback;
}

export function getSteelSensorTwinPosition(
  sensor: SteelSensorPoint,
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>> = {},
): [number, number, number] {
  const member = steelMembers.find((item) => item.id === sensor.memberId);
  if (!member) return sensor.position;

  const geometry = getSteelMemberTwinGeometry(member, geometryOverrides);
  const offset = steelSensorTwinOffsets[sensor.id] ?? [0, 0, 0];
  return [
    geometry.position[0] + offset[0],
    geometry.position[1] + offset[1],
    geometry.position[2] + offset[2],
  ];
}

export function buildSteelTwinWebGpuScene({
  activeLayerIds,
  selectedMemberId,
  geometryOverrides = {},
  hiddenMemberIds = [],
  progressPhase = 0,
}: SteelTwinWebGpuSceneOptions): SteelTwinWebGpuScene {
  const activeLayers = new Set(activeLayerIds);
  const hiddenMembers = new Set(hiddenMemberIds);
  const visibleMembers = steelMembers.filter((member) => !hiddenMembers.has(member.id));
  const visibleSensors = steelSensors.filter((sensor) => !hiddenMembers.has(sensor.memberId));
  const vertices: number[] = [];
  const pickTargets: SteelTwinWebGpuPickTarget[] = [];
  const layerVertexCounts: Record<SteelTwinLayerId | 'grid', number> = {
    grid: 0,
    semantic_ifc: 0,
    reality_splat: 0,
    iot_scada: 0,
    simulation: 0,
    process: 0,
    risk: 0,
  };

  function addToLayer(layerId: SteelTwinLayerId | 'grid', before: number) {
    layerVertexCounts[layerId] += vertices.length / 6 - before;
  }

  const gridBefore = vertices.length / 6;
  for (let index = -6; index <= 6; index += 1) {
    const tone = index === 0 ? 0.62 : 0.32;
    pushQuad(vertices, index / 6, 0, 0.0035, 1.72, [0.24, 0.72, 0.48, tone * 0.2]);
    pushQuad(vertices, 0, index / 7, 1.82, 0.0035, [0.24, 0.72, 0.48, tone * 0.2]);
  }
  addToLayer('grid', gridBefore);

  if (activeLayers.has('process')) {
    const before = vertices.length / 6;
    const route = [
      [-4.6, 0.2, -3.2] as [number, number, number],
      [-1.8, 0.35, -2.5] as [number, number, number],
      [0.8, 0.5, -0.8] as [number, number, number],
      [3.8, 0.35, -2.6] as [number, number, number],
      [5.2, 0.25, -3.4] as [number, number, number],
    ];
    route.forEach((point, index) => {
      const [x, y] = projectSteelPoint(point);
      const pulse = 0.6 + Math.sin(progressPhase * 2.8 + index * 0.65) * 0.28;
      pushCircle(vertices, x, y, 0.018 + pulse * 0.006, [0.98, 0.53, 0.08, 0.78], 14);
    });
    addToLayer('process', before);
  }

  if (activeLayers.has('reality_splat')) {
    const before = vertices.length / 6;
    for (let index = 0; index < 84; index += 1) {
      const angle = index * 0.57;
      const radius = 1.2 + (index % 11) * 0.18;
      const point: [number, number, number] = [
        Math.cos(angle) * radius,
        1.18 + Math.sin(index * 0.91) * 0.36,
        Math.sin(angle) * radius,
      ];
      const [x, y] = projectSteelPoint(point);
      const scale = 0.007 + (index % 5) * 0.0025;
      const color =
        index % 4 === 0
          ? [0.04, 0.76, 0.38, 0.42]
          : index % 4 === 1
            ? [0.56, 0.91, 0.7, 0.38]
            : index % 4 === 2
              ? [0.98, 0.68, 0.08, 0.36]
              : [0.44, 0.55, 0.7, 0.32];
      pushCircle(vertices, x, y, scale, color, 10);
    }
    addToLayer('reality_splat', before);
  }

  if (activeLayers.has('risk')) {
    const before = vertices.length / 6;
    visibleMembers
      .filter((member) => member.risk !== 'low')
      .forEach((member) => {
        const { center, size } = projectMemberRect(member, geometryOverrides);
        const riskColor =
          member.risk === 'high'
            ? [1, 0.18, 0.2, 0.22]
            : [0.98, 0.66, 0.05, 0.18];
        pushQuad(vertices, center[0], center[1], size[0] + 0.07, size[1] + 0.055, riskColor);
      });
    addToLayer('risk', before);
  }

  if (activeLayers.has('simulation')) {
    const before = vertices.length / 6;
    visibleMembers
      .filter((member) => member.geometryStatus !== 'complete' || member.propertyStatus !== 'complete')
      .forEach((member, index) => {
        const { center, size } = projectMemberRect(member, geometryOverrides);
        const pulse = 0.6 + Math.sin(progressPhase * 2.2 + index) * 0.22;
        pushQuad(vertices, center[0], center[1], size[0] + 0.045, size[1] + 0.036, [0.36, 0.54, 1, 0.15 + pulse * 0.06]);
      });
    addToLayer('simulation', before);
  }

  if (activeLayers.has('semantic_ifc')) {
    const before = vertices.length / 6;
    pushSteelWebGpuStructuralFrame(vertices);
    visibleMembers.forEach((member) => {
      const { center, size } = projectMemberRect(member, geometryOverrides);
      const selected = member.id === selectedMemberId;
      if (selected) {
        pushQuad(vertices, center[0], center[1], size[0] + 0.052, size[1] + 0.045, [0.03, 0.76, 0.38, 0.42]);
      }
      pushQuad(vertices, center[0], center[1], size[0], size[1], memberWebGpuColor(member, selected));
      pickTargets.push({
        memberId: member.id,
        memberMark: member.memberMark,
        center,
        size: [Math.max(size[0], 0.06), Math.max(size[1], 0.06)],
        selected,
      });
    });
    addToLayer('semantic_ifc', before);
  }

  if (activeLayers.has('iot_scada')) {
    const before = vertices.length / 6;
    visibleSensors.forEach((sensor, index) => {
      const [x, y] = projectSteelPoint(getSteelSensorTwinPosition(sensor, geometryOverrides));
      const pulse = 0.7 + Math.sin(progressPhase * 3.4 + index * 0.8) * 0.24;
      pushCircle(vertices, x, y, sensor.status === 'critical' ? 0.028 : 0.021, sensorWebGpuColor(sensor.status, pulse), 18);
    });
    addToLayer('iot_scada', before);
  }

  return {
    vertices: new Float32Array(vertices),
    vertexCount: vertices.length / 6,
    pickTargets,
    layerVertexCounts,
  };
}

function pushQuad(
  vertices: number[],
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  color: readonly number[],
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const x1 = centerX - halfWidth;
  const x2 = centerX + halfWidth;
  const y1 = centerY - halfHeight;
  const y2 = centerY + halfHeight;

  pushVertex(vertices, x1, y1, color);
  pushVertex(vertices, x2, y1, color);
  pushVertex(vertices, x2, y2, color);
  pushVertex(vertices, x1, y1, color);
  pushVertex(vertices, x2, y2, color);
  pushVertex(vertices, x1, y2, color);
}

function pushCircle(
  vertices: number[],
  centerX: number,
  centerY: number,
  radius: number,
  color: readonly number[],
  segments: number,
) {
  for (let index = 0; index < segments; index += 1) {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    pushVertex(vertices, centerX, centerY, color);
    pushVertex(vertices, centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius, color);
    pushVertex(vertices, centerX + Math.cos(b) * radius, centerY + Math.sin(b) * radius, color);
  }
}

function pushVertex(vertices: number[], x: number, y: number, color: readonly number[]) {
  vertices.push(
    clamp(x, -0.98, 0.98),
    clamp(y, -0.95, 0.95),
    color[0] ?? 1,
    color[1] ?? 1,
    color[2] ?? 1,
    color[3] ?? 1,
  );
}

function projectMemberRect(
  member: SteelMember,
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>> = {},
): {
  center: [number, number];
  size: [number, number];
} {
  const geometry = getSteelMemberTwinGeometry(member, geometryOverrides);
  const center = projectSteelPoint(geometry.position);
  const size: [number, number] = [
    clamp(geometry.size[0] / 8.1 + geometry.size[2] / 15, 0.034, 0.9),
    clamp(geometry.size[1] / 16 + geometry.size[2] / 6.5, 0.034, 0.36),
  ];
  return { center, size };
}

function pushSteelWebGpuStructuralFrame(vertices: number[]) {
  const xs = [-4.8, -1.6, 1.6, 4.8];
  const zs = [-3, -1, 1, 3];
  const levels = [1.25, 2.65, 4.05, 5.15];
  xs.forEach((x) => {
    zs.forEach((z) => {
      pushProjectedSteelElement(vertices, [x, 2.62, z], [0.18, 5.24, 0.18], [0.26, 0.36, 0.42, 0.58]);
    });
  });
  levels.forEach((level) => {
    zs.forEach((z) => {
      pushProjectedSteelElement(vertices, [0, level, z], [9.8, 0.14, 0.2], [0.32, 0.44, 0.5, 0.5]);
    });
    xs.forEach((x) => {
      pushProjectedSteelElement(vertices, [x, level, 0], [0.18, 0.14, 6.2], [0.3, 0.42, 0.48, 0.44]);
    });
  });
}

function pushProjectedSteelElement(
  vertices: number[],
  position: [number, number, number],
  size: [number, number, number],
  color: readonly number[],
) {
  const center = projectSteelPoint(position);
  const projectedSize: [number, number] = [
    clamp(size[0] / 8.2 + size[2] / 18, 0.012, 0.9),
    clamp(size[1] / 16 + size[2] / 8, 0.012, 0.36),
  ];
  pushQuad(vertices, center[0], center[1], projectedSize[0], projectedSize[1], color);
}

function projectSteelPoint([x, y, z]: [number, number, number]): [number, number] {
  return [
    clamp((x - z * 0.38) / 7.2, -0.94, 0.94),
    clamp((z * 0.34 + y * 0.16) / 3.7 - 0.08, -0.86, 0.88),
  ];
}

function memberWebGpuColor(member: SteelMember, selected: boolean): readonly number[] {
  if (selected) return [0.04, 0.76, 0.38, 0.95];
  if (member.risk === 'high') return [0.93, 0.25, 0.24, 0.9];
  if (member.risk === 'medium') return [0.98, 0.63, 0.1, 0.88];
  if (member.status === 'installed') return [0.22, 0.62, 0.88, 0.86];
  if (member.status === 'in_transit') return [0.42, 0.54, 0.74, 0.82];
  return [0.56, 0.66, 0.76, 0.84];
}

function sensorWebGpuColor(status: SteelSensorPoint['status'], pulse: number): readonly number[] {
  if (status === 'critical') return [1, 0.18, 0.2, 0.74 + pulse * 0.14];
  if (status === 'warning') return [0.98, 0.66, 0.05, 0.7 + pulse * 0.12];
  return [0.04, 0.76, 0.38, 0.68 + pulse * 0.1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
