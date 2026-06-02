// lib/engineering-viewer-capabilities.ts - Unified CAD/BIM viewer capability contracts
// License: Apache-2.0

import { extensionOf } from "./file-type-registry";

export type EngineeringViewerCapabilityStatus =
  | "implemented"
  | "partial"
  | "adapter_required"
  | "licensed_adapter_required"
  | "not_applicable";

export type EngineeringViewerFamily =
  | "cad_drawing"
  | "pdf_drawing"
  | "semantic_bim"
  | "licensed_bim"
  | "boundary_rep_model"
  | "mesh_model"
  | "scene_graph"
  | "tiles_scene";

export type EngineeringViewerRuntime =
  | "mlightcad"
  | "pdfjs"
  | "web_ifc"
  | "occt"
  | "three_exchange"
  | "three_usd"
  | "three_tiles"
  | "licensed_adapter"
  | "worker_required";

export type EngineeringViewerCapabilityId =
  | "unified_frame"
  | "unified_toolbar"
  | "unified_property_panel"
  | "viewport_grid"
  | "source_axis_grid"
  | "spacing_measurement"
  | "unit_normalization"
  | "coordinate_direction"
  | "color_material"
  | "selection"
  | "layer_tree"
  | "measure_length"
  | "measure_area"
  | "measure_volume"
  | "section_cut"
  | "isolate_hide"
  | "annotation"
  | "quantity_takeoff"
  | "source_fidelity";

export interface EngineeringViewerCapabilityCell {
  id: EngineeringViewerCapabilityId;
  label: string;
  status: EngineeringViewerCapabilityStatus;
  note: string;
  adapter?: string;
}

export interface EngineeringViewerFormatContract {
  id: string;
  label: string;
  extensions: readonly string[];
  family: EngineeringViewerFamily;
  runtime: EngineeringViewerRuntime;
  sourceOfTruth: string;
  defaultLengthUnit: string;
  upAxis: "source" | "z" | "y" | "screen";
  gridPlane: "source" | "xy" | "xz" | "screen" | "none";
  commandAdapter: string;
  propertySchema: string;
  professionalReviewRequired: boolean;
  capabilities: readonly EngineeringViewerCapabilityCell[];
  notes: readonly string[];
}

export interface EngineeringViewerCapabilitySummary {
  implemented: number;
  partial: number;
  adapterRequired: number;
  licensedAdapterRequired: number;
  notApplicable: number;
  totalApplicable: number;
  allApplicableImplemented: boolean;
}

export interface EngineeringViewerPropertyRow {
  key: string;
  label: string;
  value: string;
}

const capabilityLabels: Record<EngineeringViewerCapabilityId, string> = {
  unified_frame: "统一视口框架",
  unified_toolbar: "统一工具栏",
  unified_property_panel: "统一属性栏",
  viewport_grid: "视口网格",
  source_axis_grid: "源轴网/网格",
  spacing_measurement: "间距/尺寸",
  unit_normalization: "单位",
  coordinate_direction: "方向/坐标系",
  color_material: "颜色/材质",
  selection: "选择",
  layer_tree: "图层/层级",
  measure_length: "长度测量",
  measure_area: "面积测量",
  measure_volume: "体积测量",
  section_cut: "剖切",
  isolate_hide: "隔离/隐藏",
  annotation: "批注",
  quantity_takeoff: "工程量解析",
  source_fidelity: "源文件保真",
};

export const requiredEngineeringViewerCapabilityIds = Object.keys(
  capabilityLabels,
) as EngineeringViewerCapabilityId[];

function capability(
  id: EngineeringViewerCapabilityId,
  status: EngineeringViewerCapabilityStatus,
  note: string,
  adapter?: string,
): EngineeringViewerCapabilityCell {
  const cell = {
    id,
    label: capabilityLabels[id],
    status,
    note,
  };
  return adapter ? { ...cell, adapter } : cell;
}

const unifiedShellCapabilities = [
  capability(
    "unified_frame",
    "implemented",
    "接入 OpenEngineeringEditor 外层框架。",
  ),
  capability(
    "unified_toolbar",
    "implemented",
    "统一顶部工具条、格式命令入口和在线编辑/AI生成/保存版本动作已接入；深层命令仍由各格式 runtime adapter 映射。",
  ),
  capability(
    "unified_property_panel",
    "partial",
    "文件级属性、构件属性和可编辑草案栏已统一；源文件写回仍必须按格式 schema 和审批链归一化。",
  ),
] as const;

const drawingMeasureNotes = [
  capability(
    "measure_length",
    "partial",
    "可基于图元/标注生成草稿，必须绑定比例、图层和人工复核。",
  ),
  capability(
    "measure_area",
    "partial",
    "闭合边界、填充和房间区域可生成草稿，不能无复核出最终量。",
  ),
  capability(
    "measure_volume",
    "not_applicable",
    "2D CAD/PDF 图纸没有可靠体积语义。",
  ),
  capability("section_cut", "not_applicable", "2D 图纸不执行三维剖切。"),
] as const;

export const engineeringViewerFormatContracts: readonly EngineeringViewerFormatContract[] =
  [
    {
      id: "cad-dwg-dxf-mlightcad",
      label: "DWG/DXF CAD 图纸",
      extensions: [".dwg", ".dxf"],
      family: "cad_drawing",
      runtime: "mlightcad",
      sourceOfTruth: "DWG/DXF source entities through MLightCAD runtime",
      defaultLengthUnit: "source drawing unit",
      upAxis: "screen",
      gridPlane: "screen",
      commandAdapter: "MLightCAD command bridge",
      propertySchema: "CAD file/layer/block/entity properties",
      professionalReviewRequired: true,
      capabilities: [
        ...unifiedShellCapabilities,
        capability(
          "viewport_grid",
          "partial",
          "视口背景和 CAD 内部网格由 MLightCAD 控制，未与 Three 网格合并。",
        ),
        capability(
          "source_axis_grid",
          "partial",
          "CAD 轴网、轴号、尺寸线按源图渲染；语义轴网抽取仍需 CAD 规则 worker。",
          "CAD axis/grid extractor",
        ),
        capability(
          "spacing_measurement",
          "partial",
          "尺寸文字和图元距离可作为草稿证据，必须做比例校准。",
        ),
        capability(
          "unit_normalization",
          "partial",
          "保留 INSUNITS/图纸单位，工程量前必须校准到项目单位。",
        ),
        capability(
          "coordinate_direction",
          "partial",
          "二维图纸坐标和 UCS 保留，未统一为 BIM 世界坐标。",
        ),
        capability(
          "color_material",
          "implemented",
          "图层/实体颜色由 MLightCAD 渲染；材质语义仅在图纸标注层面可用。",
        ),
        capability(
          "selection",
          "partial",
          "MLightCAD 内部选择可用，统一属性 schema 仍需 entity bridge。",
          "MLightCAD entity selection bridge",
        ),
        capability(
          "layer_tree",
          "partial",
          "源图层由 CAD runtime 读取，统一图层树 UI 仍需 adapter。",
          "CAD layer tree adapter",
        ),
        ...drawingMeasureNotes,
        capability(
          "isolate_hide",
          "partial",
          "可通过图层/对象命令桥接，尚未统一到跨格式命令 schema。",
        ),
        capability(
          "annotation",
          "partial",
          "批注应保存为 CDE overlay，不直接静默写回源 DWG/DXF。",
        ),
        capability(
          "quantity_takeoff",
          "partial",
          "可输出工程量草稿；最终量必须经过比例、闭合、规则和造价复核。",
        ),
        capability(
          "source_fidelity",
          "implemented",
          "源文件不降级为截图/PDF；DXF 按 CAD 编码进入 MLightCAD。",
        ),
      ],
      notes: [
        "CAD 字体、中文、颜色和图层以 CAD runtime 为准。",
        "不能把 2D 图纸预览直接当作最终工程量。",
      ],
    },
    {
      id: "pdf-cad-drawing",
      label: "PDF CAD 图纸",
      extensions: [".pdf"],
      family: "pdf_drawing",
      runtime: "pdfjs",
      sourceOfTruth: "PDF vector/text/raster page content",
      defaultLengthUnit: "page point + calibrated drawing scale",
      upAxis: "screen",
      gridPlane: "screen",
      commandAdapter: "PDF operation registry",
      propertySchema: "PDF page/document properties",
      professionalReviewRequired: true,
      capabilities: [
        ...unifiedShellCapabilities,
        capability(
          "viewport_grid",
          "partial",
          "页面视口统一，CAD 工程网格需比例校准。",
        ),
        capability(
          "source_axis_grid",
          "adapter_required",
          "PDF 轴网需要矢量路径/OCR/标题栏联合解析，不能只看页面像素。",
          "PDF vector/OCR drawing extractor",
        ),
        capability(
          "spacing_measurement",
          "partial",
          "只有在页面比例和视口标定后才能作为草稿测量。",
        ),
        capability("unit_normalization", "partial", "依赖图纸比例和页面单位。"),
        capability(
          "coordinate_direction",
          "partial",
          "页面坐标已知，工程坐标需标定。",
        ),
        capability(
          "color_material",
          "partial",
          "保留 PDF 绘制颜色，材质语义需 OCR/图例映射。",
        ),
        capability(
          "selection",
          "partial",
          "文本/页面选择可用，CAD 图元级选择需要矢量解析。",
        ),
        capability(
          "layer_tree",
          "adapter_required",
          "PDF 可选内容组需单独解析。",
          "PDF OCG parser",
        ),
        ...drawingMeasureNotes,
        capability(
          "isolate_hide",
          "adapter_required",
          "需要 PDF 图层或 overlay adapter。",
        ),
        capability("annotation", "partial", "批注保存为 CDE overlay。"),
        capability("quantity_takeoff", "partial", "只允许输出人工复核草稿。"),
        capability(
          "source_fidelity",
          "implemented",
          "保留 PDF 源文件，不伪装成 CAD 模型。",
        ),
      ],
      notes: ["PDF 是交付/打印格式，不具备稳定 BIM/CAD 语义。"],
    },
    {
      id: "ifc-semantic-bim",
      label: "IFC openBIM 模型",
      extensions: [".ifc", ".ifczip"],
      family: "semantic_bim",
      runtime: "web_ifc",
      sourceOfTruth: "IFC entities, placements, property sets and quantities",
      defaultLengthUnit: "IFC UnitAssignment",
      upAxis: "z",
      gridPlane: "xy",
      commandAdapter: "ThreeGroupViewport + IFC selection adapter",
      propertySchema: "IFC GlobalId / type / Pset / Qto rows",
      professionalReviewRequired: true,
      capabilities: [
        capability("unified_frame", "implemented", "接入统一工程视口框架。"),
        capability(
          "unified_toolbar",
          "implemented",
          "缩放、重置、选择和属性命令进入统一按钮。",
        ),
        capability(
          "unified_property_panel",
          "implemented",
          "文件和选中构件属性进入统一属性面板。",
        ),
        capability(
          "viewport_grid",
          "implemented",
          "Three 视口网格按 Z-up 显示。",
        ),
        capability(
          "source_axis_grid",
          "partial",
          "IFC 轴网实体需进一步索引为统一轴网面板。",
          "IfcGrid semantic adapter",
        ),
        capability(
          "spacing_measurement",
          "partial",
          "可从几何和 Qto 提供间距证据，仍需规则校验。",
        ),
        capability(
          "unit_normalization",
          "implemented",
          "按 IFC UnitAssignment 归一化显示。",
        ),
        capability(
          "coordinate_direction",
          "implemented",
          "读取 IFC placement 并统一到 Z-up 视口。",
        ),
        capability(
          "color_material",
          "partial",
          "材质/颜色读取并做可视化兜底，复杂材质仍需映射。",
        ),
        capability("selection", "implemented", "按 expressID/构件属性选择。"),
        capability(
          "layer_tree",
          "partial",
          "空间树/类型树可归一化，完整 IFC 分解树仍需专用 UI。",
        ),
        capability(
          "measure_length",
          "partial",
          "几何/Qto 可给草稿，专业量需规则链。",
        ),
        capability(
          "measure_area",
          "partial",
          "Qto/几何面积可给草稿，需规则链。",
        ),
        capability(
          "measure_volume",
          "partial",
          "Qto/几何体积可给草稿，需规则链。",
        ),
        capability(
          "section_cut",
          "adapter_required",
          "需要统一剖切平面命令接入。",
        ),
        capability(
          "isolate_hide",
          "partial",
          "选择高亮可用，完整隔离/隐藏需命令 adapter。",
        ),
        capability("annotation", "partial", "批注应保存为 CDE overlay。"),
        capability(
          "quantity_takeoff",
          "partial",
          "语义量可自动草算，但最终量必须审批。",
        ),
        capability(
          "source_fidelity",
          "implemented",
          "优先打开源 IFC，不自动降级为 GLB。",
        ),
      ],
      notes: ["IFC 是当前最接近统一属性和工程量语义的开放 BIM 路线。"],
    },
    {
      id: "rvt-rfa-licensed-bim",
      label: "RVT/RFA 授权 BIM 模型",
      extensions: [".rvt", ".rfa"],
      family: "licensed_bim",
      runtime: "licensed_adapter",
      sourceOfTruth: "Licensed Revit adapter or verified semantic derivative",
      defaultLengthUnit: "Revit internal feet -> project unit",
      upAxis: "z",
      gridPlane: "xy",
      commandAdapter: "licensed sidecar command adapter",
      propertySchema: "Revit element/category/parameter rows",
      professionalReviewRequired: true,
      capabilities: licensedBimCapabilities("Revit"),
      notes: ["RVT/RFA 不应通过 GLB 预览声称完整 BIM 属性或工程量。"],
    },
    {
      id: "skp-licensed-bim",
      label: "SKP 授权模型",
      extensions: [".skp"],
      family: "licensed_bim",
      runtime: "licensed_adapter",
      sourceOfTruth:
        "Licensed SketchUp adapter or verified semantic derivative",
      defaultLengthUnit: "SketchUp model unit",
      upAxis: "z",
      gridPlane: "xy",
      commandAdapter: "licensed sidecar command adapter",
      propertySchema: "SketchUp component/layer/material rows",
      professionalReviewRequired: true,
      capabilities: licensedBimCapabilities("SketchUp"),
      notes: ["SKP 组件、图层和材质需要授权 adapter 才能作为工程语义。"],
    },
    {
      id: "brep-cad-model",
      label: "3DM/STEP/IGES B-Rep 模型",
      extensions: [".3dm", ".step", ".stp", ".iges", ".igs", ".brep"],
      family: "boundary_rep_model",
      runtime: "occt",
      sourceOfTruth: "OpenNURBS/OCCT parsed boundary representation",
      defaultLengthUnit: "source model unit -> mm",
      upAxis: "z",
      gridPlane: "xy",
      commandAdapter: "ThreeGroupViewport + OCCT mesh adapter",
      propertySchema: "B-Rep part/body/material rows",
      professionalReviewRequired: true,
      capabilities: [
        capability("unified_frame", "implemented", "接入统一工程视口框架。"),
        capability(
          "unified_toolbar",
          "implemented",
          "缩放、重置、选择和属性命令进入统一按钮。",
        ),
        capability(
          "unified_property_panel",
          "implemented",
          "选中 body/mesh 属性进入统一属性面板。",
        ),
        capability(
          "viewport_grid",
          "implemented",
          "Three 视口网格按 Z-up 显示。",
        ),
        capability(
          "source_axis_grid",
          "not_applicable",
          "机械/几何 B-Rep 通常没有建筑轴网语义。",
        ),
        capability(
          "spacing_measurement",
          "partial",
          "包围盒/边界可测，设计间距语义需规则映射。",
        ),
        capability(
          "unit_normalization",
          "partial",
          "OCCT 读取单位并按 mm 显示，需保留源单位证据。",
        ),
        capability(
          "coordinate_direction",
          "implemented",
          "B-Rep 视口按 Z-up/源坐标保留。",
        ),
        capability(
          "color_material",
          "partial",
          "源颜色可显示，完整材质/分类需要映射。",
        ),
        capability("selection", "implemented", "可选 body/mesh 并显示属性。"),
        capability(
          "layer_tree",
          "partial",
          "3DM 层可保留；STEP/IGES 装配树需扩展。",
        ),
        capability("measure_length", "partial", "几何尺寸可给草稿。"),
        capability("measure_area", "partial", "面域/壳体面积需 kernel 证据。"),
        capability("measure_volume", "partial", "闭合实体体积需 kernel 证据。"),
        capability(
          "section_cut",
          "adapter_required",
          "需要统一剖切命令接入 Three/OCCT。",
        ),
        capability(
          "isolate_hide",
          "partial",
          "选中对象可高亮，隔离隐藏需命令 adapter。",
        ),
        capability("annotation", "partial", "批注保存为 CDE overlay。"),
        capability(
          "quantity_takeoff",
          "partial",
          "只能作为几何量草稿，缺少 BIM 分类时需人工绑定清单项。",
        ),
        capability(
          "source_fidelity",
          "implemented",
          "优先解析源 B-Rep，不用伪模型替代。",
        ),
      ],
      notes: ["B-Rep 适合几何量，不等于 BIM 语义量。"],
    },
    {
      id: "stl-mesh-model",
      label: "STL 网格模型",
      extensions: [".stl"],
      family: "mesh_model",
      runtime: "three_exchange",
      sourceOfTruth: "STL triangles and optional color/group metadata",
      defaultLengthUnit: "project-assumed mm unless sidecar proves otherwise",
      upAxis: "z",
      gridPlane: "xy",
      commandAdapter: "ThreeGroupViewport + STL mesh adapter",
      propertySchema: "mesh shell/group rows",
      professionalReviewRequired: true,
      capabilities: meshModelCapabilities("STL"),
      notes: ["STL 没有 BIM 语义；工程量只能是网格测量草稿。"],
    },
    {
      id: "openusd-scene",
      label: "OpenUSD/USDZ 场景",
      extensions: [".usd", ".usda", ".usdc", ".usdz"],
      family: "scene_graph",
      runtime: "three_usd",
      sourceOfTruth: "USD stage, prim hierarchy, transforms and materials",
      defaultLengthUnit: "USD metersPerUnit -> mm when available",
      upAxis: "source",
      gridPlane: "source",
      commandAdapter: "ThreeGroupViewport + USD prim adapter",
      propertySchema: "USD prim/material/mesh rows",
      professionalReviewRequired: true,
      capabilities: sceneGraphCapabilities("OpenUSD"),
      notes: ["OpenUSD 是场景组合路线，工程量仍需语义 sidecar 或规则映射。"],
    },
    {
      id: "gltf-derived-scene",
      label: "GLB/glTF/PLY/DAE 派生或交换模型",
      extensions: [".glb", ".gltf", ".ply", ".dae"],
      family: "scene_graph",
      runtime: "three_exchange",
      sourceOfTruth: "exchange scene graph and mesh data",
      defaultLengthUnit: "source declared unit or viewer sidecar",
      upAxis: "source",
      gridPlane: "source",
      commandAdapter: "ThreeGroupViewport exchange adapter",
      propertySchema: "scene node/material/mesh rows",
      professionalReviewRequired: true,
      capabilities: sceneGraphCapabilities("glTF/DAE/PLY"),
      notes: ["交换模型不能替代 RVT/SKP/IFC 源语义。"],
    },
    {
      id: "legacy-obj-fbx-mesh",
      label: "OBJ/FBX legacy mesh 源文件",
      extensions: [".obj", ".fbx"],
      family: "scene_graph",
      runtime: "three_exchange",
      sourceOfTruth: "legacy mesh scene graph and geometry bounds",
      defaultLengthUnit:
        "legacy geometry unit; mm display is a draft unless sidecar proves units",
      upAxis: "source",
      gridPlane: "source",
      commandAdapter: "ThreeGroupViewport legacy mesh adapter",
      propertySchema: "legacy mesh node/material rows",
      professionalReviewRequired: true,
      capabilities: sceneGraphCapabilities("OBJ/FBX legacy mesh"),
      notes: [
        "OBJ/FBX 只作为历史源文件查看路径，不是 openBIM 语义或工程量真源。",
      ],
    },
    {
      id: "3d-tiles-scene",
      label: "3D Tiles 场景",
      extensions: [".json", ".b3dm", ".i3dm", ".pnts", ".cmpt"],
      family: "tiles_scene",
      runtime: "three_tiles",
      sourceOfTruth: "tileset.json and referenced tile payloads",
      defaultLengthUnit: "tileset geospatial transform",
      upAxis: "source",
      gridPlane: "source",
      commandAdapter: "3D Tiles scene adapter",
      propertySchema: "tileset/tile/batch table rows",
      professionalReviewRequired: true,
      capabilities: sceneGraphCapabilities("3D Tiles"),
      notes: ["单个 tile payload 不能冒充完整 tileset。"],
    },
  ];

function licensedBimCapabilities(
  vendor: string,
): readonly EngineeringViewerCapabilityCell[] {
  return [
    ...unifiedShellCapabilities,
    capability(
      "viewport_grid",
      "partial",
      "统一视口可显示，源工程网格需授权 adapter。",
    ),
    capability(
      "source_axis_grid",
      "licensed_adapter_required",
      `${vendor} 轴网/标高/参照平面必须由授权 adapter 输出。`,
      `${vendor} licensed grid adapter`,
    ),
    capability(
      "spacing_measurement",
      "licensed_adapter_required",
      `${vendor} 尺寸和约束必须由授权 adapter 绑定源元素。`,
      `${vendor} licensed measurement adapter`,
    ),
    capability(
      "unit_normalization",
      "licensed_adapter_required",
      `${vendor} 项目单位必须由授权 adapter 读取。`,
    ),
    capability(
      "coordinate_direction",
      "licensed_adapter_required",
      `${vendor} 内部坐标/共享坐标必须由授权 adapter 读取。`,
    ),
    capability(
      "color_material",
      "licensed_adapter_required",
      `${vendor} 材质、族/组件材质和类别图形覆盖必须由授权 adapter 读取。`,
    ),
    capability(
      "selection",
      "partial",
      "派生场景可选网格，源构件选择需要授权 ID 映射。",
    ),
    capability(
      "layer_tree",
      "licensed_adapter_required",
      `${vendor} 层级/类别/视图树需要授权 adapter。`,
    ),
    capability(
      "measure_length",
      "licensed_adapter_required",
      "需要源构件和单位证据。",
    ),
    capability(
      "measure_area",
      "licensed_adapter_required",
      "需要源构件和房间/面域证据。",
    ),
    capability(
      "measure_volume",
      "licensed_adapter_required",
      "需要源构件和实体证据。",
    ),
    capability(
      "section_cut",
      "partial",
      "派生场景可剖切，源视图剖切需授权 adapter。",
    ),
    capability(
      "isolate_hide",
      "partial",
      "派生对象可隔离，源构件隔离需 ID 映射。",
    ),
    capability(
      "annotation",
      "partial",
      "批注保存为 CDE overlay，不静默写回源文件。",
    ),
    capability(
      "quantity_takeoff",
      "licensed_adapter_required",
      "最终量必须来自源语义或授权导出。",
    ),
    capability(
      "source_fidelity",
      "partial",
      "保留源文件；真实源语义依赖授权 adapter。",
    ),
  ];
}

function meshModelCapabilities(
  format: string,
): readonly EngineeringViewerCapabilityCell[] {
  return [
    capability("unified_frame", "implemented", "接入统一工程视口框架。"),
    capability(
      "unified_toolbar",
      "implemented",
      "缩放、重置、选择和属性命令进入统一按钮。",
    ),
    capability(
      "unified_property_panel",
      "implemented",
      "mesh/shell 属性进入统一属性面板。",
    ),
    capability("viewport_grid", "implemented", "Three 视口网格按 Z-up 显示。"),
    capability(
      "source_axis_grid",
      "not_applicable",
      `${format} 不包含建筑轴网语义。`,
    ),
    capability("spacing_measurement", "partial", "只能按网格几何估算距离。"),
    capability(
      "unit_normalization",
      "partial",
      "依赖项目约定或 sidecar 单位。",
    ),
    capability(
      "coordinate_direction",
      "partial",
      "按工程默认 Z-up 显示，源方向元数据有限。",
    ),
    capability(
      "color_material",
      "partial",
      "显示 vertex color/材质兜底，材料语义有限。",
    ),
    capability("selection", "implemented", "可选 mesh/shell。"),
    capability(
      "layer_tree",
      "not_applicable",
      `${format} 通常没有 BIM 层级/图层树。`,
    ),
    capability("measure_length", "partial", "几何草稿。"),
    capability("measure_area", "partial", "需要封闭性/法线校验。"),
    capability("measure_volume", "partial", "需要 watertight 校验。"),
    capability("section_cut", "adapter_required", "需要统一剖切命令接入。"),
    capability(
      "isolate_hide",
      "partial",
      "选中对象可高亮，隔离隐藏需命令 adapter。",
    ),
    capability("annotation", "partial", "批注保存为 CDE overlay。"),
    capability(
      "quantity_takeoff",
      "partial",
      "仅 mesh 测量草稿，不能作为 BIM 清单语义。",
    ),
    capability("source_fidelity", "implemented", "保留源 mesh，不伪装成 BIM。"),
  ];
}

function sceneGraphCapabilities(
  format: string,
): readonly EngineeringViewerCapabilityCell[] {
  return [
    ...unifiedShellCapabilities,
    capability("viewport_grid", "implemented", "统一 Three 视口网格可用。"),
    capability(
      "source_axis_grid",
      "partial",
      `${format} 可能有层级/节点，轴网语义需 sidecar。`,
    ),
    capability(
      "spacing_measurement",
      "partial",
      "按场景几何草稿测量，语义间距需规则映射。",
    ),
    capability(
      "unit_normalization",
      "partial",
      "读取格式声明或 sidecar，缺失时不可声称准确。",
    ),
    capability(
      "coordinate_direction",
      "partial",
      "按格式 up-axis/transform 显示，复杂坐标需 sidecar。",
    ),
    capability(
      "color_material",
      "partial",
      "材质/颜色可显示，工程材料分类需映射。",
    ),
    capability(
      "selection",
      "partial",
      "可选 mesh/node，源语义 ID 依赖格式和 sidecar。",
    ),
    capability("layer_tree", "partial", "节点树可归一化，工程系统树需映射。"),
    capability("measure_length", "partial", "几何草稿。"),
    capability("measure_area", "partial", "几何草稿。"),
    capability("measure_volume", "partial", "闭合实体/mesh 需校验。"),
    capability("section_cut", "adapter_required", "需要统一剖切命令接入。"),
    capability(
      "isolate_hide",
      "partial",
      "可按 node/mesh 处理，统一命令需 adapter。",
    ),
    capability("annotation", "partial", "批注保存为 CDE overlay。"),
    capability(
      "quantity_takeoff",
      "partial",
      "不能替代源 BIM/CAD 工程量语义。",
    ),
    capability("source_fidelity", "implemented", "保留源场景/交换文件。"),
  ];
}

const contractsByExtension = new Map<string, EngineeringViewerFormatContract>();
for (const contract of engineeringViewerFormatContracts) {
  for (const extension of contract.extensions) {
    contractsByExtension.set(extension, contract);
  }
}

export const requestedEngineeringViewerExtensions = [
  ".dwg",
  ".dxf",
  ".pdf",
  ".ifc",
  ".rvt",
  ".rfa",
  ".3dm",
  ".step",
  ".stp",
  ".stl",
  ".igs",
  ".iges",
  ".skp",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".obj",
  ".fbx",
] as const;

export function engineeringViewerContractForExtension(
  extension: string,
): EngineeringViewerFormatContract | null {
  const normalized = extension.startsWith(".")
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;
  return contractsByExtension.get(normalized) ?? null;
}

export function engineeringViewerContractForFileName(
  fileName: string,
  mimeType?: string | null,
): EngineeringViewerFormatContract | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith("tileset.json")) {
    return engineeringViewerContractForExtension(".json");
  }

  const byExtension = engineeringViewerContractForExtension(
    extensionOf(fileName),
  );
  if (byExtension) return byExtension;

  const normalizedMime = mimeType?.toLowerCase();
  if (normalizedMime === "application/pdf")
    return engineeringViewerContractForExtension(".pdf");
  if (normalizedMime === "model/vnd.usdz+zip")
    return engineeringViewerContractForExtension(".usdz");
  return null;
}

export function engineeringViewerCapabilityForContract(
  contract: EngineeringViewerFormatContract,
  capabilityId: EngineeringViewerCapabilityId,
): EngineeringViewerCapabilityCell {
  const capabilityCell = contract.capabilities.find(
    (item) => item.id === capabilityId,
  );
  if (capabilityCell) return capabilityCell;
  return capability(
    capabilityId,
    "adapter_required",
    "该格式尚未声明此能力，必须补 adapter 或 blocked evidence。",
  );
}

export function summarizeEngineeringViewerCapabilities(
  contract: EngineeringViewerFormatContract,
): EngineeringViewerCapabilitySummary {
  const values = contract.capabilities;
  const implemented = values.filter(
    (item) => item.status === "implemented",
  ).length;
  const partial = values.filter((item) => item.status === "partial").length;
  const adapterRequired = values.filter(
    (item) => item.status === "adapter_required",
  ).length;
  const licensedAdapterRequired = values.filter(
    (item) => item.status === "licensed_adapter_required",
  ).length;
  const notApplicable = values.filter(
    (item) => item.status === "not_applicable",
  ).length;
  const totalApplicable = values.length - notApplicable;

  return {
    implemented,
    partial,
    adapterRequired,
    licensedAdapterRequired,
    notApplicable,
    totalApplicable,
    allApplicableImplemented:
      implemented === totalApplicable && totalApplicable > 0,
  };
}

export function engineeringViewerCanClaimCompleteImplementation(
  contract: EngineeringViewerFormatContract,
): boolean {
  return summarizeEngineeringViewerCapabilities(contract)
    .allApplicableImplemented;
}

export function formatEngineeringViewerCapabilityStatus(
  status: EngineeringViewerCapabilityStatus,
): string {
  if (status === "implemented") return "已统一";
  if (status === "partial") return "部分统一";
  if (status === "adapter_required") return "需适配器";
  if (status === "licensed_adapter_required") return "需授权适配器";
  return "不适用";
}

export function engineeringViewerCapabilityRowsForFileName(
  fileName: string,
  mimeType?: string | null,
): EngineeringViewerPropertyRow[] {
  const contract = engineeringViewerContractForFileName(fileName, mimeType);
  if (!contract) {
    return [
      {
        key: "viewerContract",
        label: "统一能力契约",
        value: "未登记格式：必须进入 AdapterSourceRegistry 或 blocked evidence",
      },
    ];
  }

  const summary = summarizeEngineeringViewerCapabilities(contract);
  const sourceAxisGrid = engineeringViewerCapabilityForContract(
    contract,
    "source_axis_grid",
  );
  const quantityTakeoff = engineeringViewerCapabilityForContract(
    contract,
    "quantity_takeoff",
  );

  return [
    {
      key: "viewerContract",
      label: "统一能力契约",
      value: `${contract.label} / ${contract.runtime}`,
    },
    {
      key: "viewerImplementation",
      label: "统一完成度",
      value: `${summary.implemented}/${summary.totalApplicable} 已统一；${summary.partial} 部分；${summary.adapterRequired + summary.licensedAdapterRequired} 需适配器`,
    },
    {
      key: "viewerUnits",
      label: "单位",
      value: contract.defaultLengthUnit,
    },
    {
      key: "viewerDirection",
      label: "方向/网格",
      value: `up=${contract.upAxis}, grid=${contract.gridPlane}`,
    },
    {
      key: "viewerSourceGrid",
      label: "轴网/网格",
      value: `${formatEngineeringViewerCapabilityStatus(sourceAxisGrid.status)}：${sourceAxisGrid.note}`,
    },
    {
      key: "viewerPropertySchema",
      label: "属性 Schema",
      value: contract.propertySchema,
    },
    {
      key: "viewerCommandAdapter",
      label: "工具栏命令",
      value: contract.commandAdapter,
    },
    {
      key: "viewerQuantity",
      label: "工程量解析",
      value: `${formatEngineeringViewerCapabilityStatus(quantityTakeoff.status)}：${quantityTakeoff.note}`,
    },
  ];
}
