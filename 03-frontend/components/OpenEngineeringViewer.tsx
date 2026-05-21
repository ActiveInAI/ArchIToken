// components/OpenEngineeringViewer.tsx - Browser-native open engineering viewers
// License: Apache-2.0
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import {
  AlertTriangle,
  Crosshair,
  Download,
  FileUp,
  Info,
  Loader2,
  MapPin,
  Maximize2,
  MousePointer2,
  Move3D,
  PanelBottom,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { Rhino3dmLoader } from "three/examples/jsm/loaders/3DMLoader.js";
import { BIMViewer } from "@/components/BIMViewer";
import { DockableViewerToolbar } from "@/components/DockableViewerToolbar";
import {
  extensionOf,
  fileTypeForFileName,
} from "@/lib/file-type-registry";
import {
  formatModuleFileSize,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import type { IDxf, IEntity, IPoint } from "dxf-parser";
import type * as WebIfc from "web-ifc";

interface OpenEngineeringViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

type LoadState<T> =
  | { status: "loading"; message: string }
  | { status: "ready"; value: T }
  | { status: "failed"; message: string };

interface LengthDisplayUnit {
  label: string;
  precision: number;
  metersPerUnit: number;
}

const millimeterLengthUnit: LengthDisplayUnit = {
  label: "mm",
  precision: 0,
  metersPerUnit: 0.001,
};
const meterLengthUnit: LengthDisplayUnit = {
  label: "m",
  precision: 2,
  metersPerUnit: 1,
};

interface IfcLiteNativePreview {
  mode: "webgpu" | "three";
  group: Group | null;
  elements: IfcElementProperties[];
  lengthUnit: LengthDisplayUnit;
  loadedMeshes: number;
  totalMeshes: number | null;
  totalVertices: number;
  totalTriangles: number;
  firstFrameMs: number | null;
  complete: boolean;
}

interface IfcLitePointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  button: number;
  mode: "orbit" | "pan";
}

interface IfcLiteVec3 {
  x: number;
  y: number;
  z: number;
}

interface IfcLiteCameraHandle {
  orbit(deltaX: number, deltaY: number, addVelocity?: boolean): void;
  pan(deltaX: number, deltaY: number, addVelocity?: boolean): void;
  moveFirstPerson?(
    forward: number,
    right: number,
    up: number,
    addVelocity?: boolean,
  ): void;
  zoom(
    delta: number,
    addVelocity?: boolean,
    mouseX?: number,
    mouseY?: number,
    canvasWidth?: number,
    canvasHeight?: number,
    fastZoom?: boolean,
  ): void;
  update(deltaTime: number): boolean;
  stopInertia?(): void;
  getPosition?(): IfcLiteVec3;
  getTarget?(): IfcLiteVec3;
  setPosition?(x: number, y: number, z: number): void;
  setTarget?(x: number, y: number, z: number): void;
}

interface IfcLiteRendererHandle {
  init(): Promise<void>;
  addMeshes(meshes: IfcLiteStreamingBatch[], isStreaming?: boolean): void;
  render(options?: IfcLiteRenderOptions): void;
  requestRender(): void;
  consumeRenderRequest(): boolean;
  resize(width: number, height: number): void;
  fitToView(): void;
  destroy(): void;
  getCamera(): IfcLiteCameraHandle;
  getModelBounds?(): Bounds3D | null;
  pick(
    x: number,
    y: number,
    options?: { isStreaming?: boolean },
  ): Promise<{ expressId: number } | null>;
}

interface IfcLiteStreamingBatch {
  expressId: number;
  ifcType?: string;
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
  color?: [number, number, number, number];
  entityIds?: Uint32Array;
}

type IfcLiteStreamingEvent =
  | { type: "start"; totalEstimate: number }
  | { type: "model-open"; modelID: number }
  | { type: "batch"; meshes: IfcLiteStreamingBatch[]; totalSoFar: number }
  | { type: "complete"; totalMeshes: number }
  | { type: "progress"; phase: string }
  | { type: "colorUpdate" | "rtcOffset" | "workerMemory" };

interface IfcLiteGeometryProcessorHandle {
  init(): Promise<void>;
  processAdaptive(
    buffer: Uint8Array,
    options?: {
      sizeThreshold?: number;
      batchSize?:
        | number
        | {
            initialBatchSize?: number;
            maxBatchSize?: number;
            fileSizeMB?: number;
          };
      wasmUrls?: { wasm?: string; wasmThreaded?: string };
    },
  ): AsyncGenerator<IfcLiteStreamingEvent>;
}

interface IfcLiteRendererModule {
  Renderer: new (canvas: HTMLCanvasElement) => IfcLiteRendererHandle;
}

interface IfcLiteGeometryModule {
  GeometryProcessor: new (options?: {
    quality?: unknown;
    preferNative?: boolean;
    mergeLayers?: boolean;
  }) => IfcLiteGeometryProcessorHandle;
}

interface IfcLiteRenderOptions {
  selectedId?: number | null;
  isStreaming?: boolean;
}

const ifcLiteInitialPreview: IfcLiteNativePreview = {
  mode: "webgpu",
  group: null,
  elements: [],
  lengthUnit: meterLengthUnit,
  loadedMeshes: 0,
  totalMeshes: null,
  totalVertices: 0,
  totalTriangles: 0,
  firstFrameMs: null,
  complete: false,
};

const ifcLiteWasmUrl = "/wasm/ifc-lite/ifc-lite_bg.wasm";
const prengineLabel = "Prengine";
const ifcLiteOrbitSensitivity = 0.38;
const ifcLitePanSensitivity = 0.55;
const ifcLiteWheelSensitivity = 0.1;

interface IfcDerivativeClientAdapter {
  id: string;
  label: string;
  priority: number;
  role: string;
  capability: string;
  status: string;
  installHint?: string;
}

interface MetricItem {
  label: string;
  value: string;
}

interface ViewerMetric {
  label: string;
  value: string;
}

export const DEPRECATED_ENGINEERING_ROLE_LABELS = new Set([
  "\u8bbe\u8ba1\u4eba\u5458",
  "\u603b\u8bbe\u8ba1\u5e08",
]);

interface IfcSummary {
  schema: string;
  totalLines: number;
  totalMeshes: number;
  renderedFragments: number;
  truncated: boolean;
  nativeBounds: Bounds3D;
  renderOffset: Bounds3DPoint;
  lengthUnit: LengthDisplayUnit;
  upAxis: ModelUpAxis;
  topTypes: MetricItem[];
  keyCounts: MetricItem[];
  elements: IfcElementProperties[];
  group: Group | null;
}

interface IfcElementProperties {
  expressID: number;
  sourceBound?: boolean;
  type: string;
  globalId: string;
  name: string;
  objectType: string;
  tag: string;
  predefinedType: string;
  properties: MetricItem[];
  geometryBounds?: Bounds3D;
  geometryDimensions?: Bounds3DPoint;
  geometryCenter?: Bounds3DPoint;
  sourcePlacement?: Bounds3DPoint;
  geometryUnit?: LengthDisplayUnit;
  geometrySource?: "ifc-representation" | "ifc-quantity" | "mesh-bounds" | "mixed";
  geometryDimensionSource?: Partial<
    Record<keyof Bounds3DPoint, "ifc-representation" | "ifc-quantity" | "mesh-bounds">
  >;
  sourceColor?: string;
  styleColor?: [number, number, number, number];
  geometryMeshCount?: number;
  geometryVertexCount?: number;
  geometryTriangleCount?: number;
}

interface IfcStepRecord {
  expressID: number;
  type: string;
  params: string[];
}

interface DxfPrimitiveBase {
  layer: string;
  color: string;
  lineWeight: number;
}

interface DxfPolylinePrimitive extends DxfPrimitiveBase {
  kind: "polyline";
  points: Array<{ x: number; y: number }>;
  closed: boolean;
}

interface DxfArcPrimitive extends DxfPrimitiveBase {
  kind: "arc";
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
}

interface DxfCirclePrimitive extends DxfPrimitiveBase {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
}

interface DxfPointPrimitive extends DxfPrimitiveBase {
  kind: "point";
  x: number;
  y: number;
}

interface DxfTextPrimitive extends DxfPrimitiveBase {
  kind: "text";
  x: number;
  y: number;
  value: string;
  size: number;
  rotation: number;
  align: "left" | "center" | "right";
}

interface DxfSolidPrimitive extends DxfPrimitiveBase {
  kind: "solid";
  points: Array<{ x: number; y: number }>;
}

interface DxfEllipsePrimitive extends DxfPrimitiveBase {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
  startAngle: number;
  endAngle: number;
}

type DxfPrimitive =
  | DxfPolylinePrimitive
  | DxfArcPrimitive
  | DxfCirclePrimitive
  | DxfPointPrimitive
  | DxfTextPrimitive
  | DxfSolidPrimitive
  | DxfEllipsePrimitive;

interface DxfPreview {
  primitiveCount: number;
  entityCount: number;
  renderedEntityCount: number;
  paperSpaceEntityCount: number;
  layers: string[];
  codePage: string;
  unsupportedEntityTypes: string[];
  bounds: Bounds2D;
  focusBounds: Bounds2D;
  primitives: DxfPrimitive[];
}

interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Bounds3DPoint {
  x: number;
  y: number;
  z: number;
}

interface Bounds3D {
  min: Bounds3DPoint;
  max: Bounds3DPoint;
}

type ModelUpAxis = "y" | "z";

interface OcctPreview {
  meshCount: number;
  vertexCount: number;
  faceCount: number;
  group: Group;
}

interface ExchangeMeshBuildOptions {
  sourceFormat: string;
  sourceName: string;
  mimeType?: string;
  routeLabel: string;
}

type OcctImporterModule = typeof import("occt-import-js");
type OcctMesh = import("occt-import-js").OcctMesh;
type OcctRuntime = Awaited<ReturnType<OcctImporterModule["default"]>>;

let occtRuntimePromise: Promise<OcctRuntime> | null = null;
const occtMeshCache = new Map<string, Promise<OcctMesh[]>>();

interface IfcGeometryPreview {
  group: Group | null;
  totalMeshes: number;
  renderedFragments: number;
  truncated: boolean;
  elements: IfcElementProperties[];
  nativeBounds: Box3;
  renderOffset: Vector3;
  upAxis: ModelUpAxis;
}

interface DxfSourceText {
  text: string;
  codePage: string;
  decoder: string;
}

interface CadDerivativeSheet {
  id: string;
  name: string;
  url: string;
}

interface CadDerivativeManifest {
  fileId: string;
  originalName: string;
  sourceFormat: string;
  viewer:
    | "cad_vector_entities"
    | "dxf_canvas"
    | "cad_vector_svg"
    | "cad_vector_pdf"
    | "dwg_vector_pdf";
  engine: string;
  sheets: CadDerivativeSheet[];
  notes: string[];
  permissions?: {
    canView: boolean;
    canEditSource: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
}

interface SkpDerivativeManifest {
  schema: "architoken.skp_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "skp";
  viewer: "prengine_skp_model" | "licensed_adapter_required";
  engine: string;
  derivativeArtifact?: {
    kind: "skp-glb";
    url: string;
    mediaType: "model/gltf-binary";
    engine: string;
    etag: string;
    cacheHit: boolean;
    size?: number;
  };
  permissions: {
    canView: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  notes: string[];
}

interface SourcePreview {
  byteLength: number;
  signature: string;
  mimeType: string;
  registryLabel: string;
  routeLabel: string;
  asciiPreview: string;
  hexPreview: string;
  isProbablyText: boolean;
  embeddedPreview?: EmbeddedRasterPreview;
}

interface EmbeddedRasterPreview {
  mimeType: string;
  bytes: Uint8Array;
  label: string;
}

interface DxfLayerStyle {
  color: string;
  visible: boolean;
}

type DxfAffine = [number, number, number, number, number, number];

interface DxfEntityLike extends IEntity {
  vertices?: DxfVertexLike[];
  points?: IPoint[];
  center?: IPoint;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  startPoint?: IPoint;
  endPoint?: IPoint;
  position?: IPoint;
  text?: string;
  height?: number;
  textHeight?: number;
  rotation?: number;
  halign?: number;
  valign?: number;
  majorAxisEndPoint?: IPoint;
  axisRatio?: number;
  fitPoints?: IPoint[];
  controlPoints?: IPoint[];
  name?: string;
  blockName?: string;
  xScale?: number;
  yScale?: number;
  columnCount?: number;
  rowCount?: number;
  columnSpacing?: number;
  rowSpacing?: number;
  block?: string;
  middleOfText?: IPoint;
  anchorPoint?: IPoint;
  angle?: number;
  linearOrAngularPoint1?: IPoint;
  linearOrAngularPoint2?: IPoint;
  actualMeasurement?: number;
}

interface DxfBlockLike {
  position?: IPoint;
  entities: IEntity[];
}

interface DxfVertexLike extends IPoint {
  bulge?: number;
}

const meshExtensions = new Set([
  ".glb",
  ".gltf",
  ".ply",
  ".dae",
  ".3dm",
]);
const openUsdExtensions = new Set([".usd", ".usda", ".usdc", ".usdz"]);
const tiles3dPayloadExtensions = new Set([".b3dm", ".i3dm", ".pnts", ".cmpt"]);
const occtExtensions = new Set([".step", ".stp", ".iges", ".igs", ".brep"]);
const unsupportedOcctKernelExtensions = new Set([".sat", ".x_t", ".x_b"]);
const ifcKeyTypes = [
  ["IFCPROJECT", "项目"],
  ["IFCSITE", "场地"],
  ["IFCBUILDING", "建筑"],
  ["IFCBUILDINGSTOREY", "楼层"],
  ["IFCBEAM", "梁"],
  ["IFCCOLUMN", "柱"],
  ["IFCMEMBER", "杆件"],
  ["IFCPLATE", "板件"],
  ["IFCWALL", "墙"],
  ["IFCSLAB", "楼板"],
  ["IFCDOOR", "门"],
  ["IFCWINDOW", "窗"],
] as const;

const maxIfcFragments = 5000;
const engineeringTextFontStack =
  '"Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "PingFang SC", "WenQuanYi Micro Hei", "Arial Unicode MS", system-ui, sans-serif';
const ifcPropertyChineseLabels: Record<string, string> = {
  ExpressID: "STEP编号",
  "IFC Type": "IFC类型",
  GlobalId: "全局ID",
  OwnerHistory: "所有者历史",
  Name: "名称",
  Description: "描述",
  ObjectType: "对象类型",
  ObjectPlacement: "对象定位",
  Representation: "几何表达",
  Tag: "构件标记",
  PredefinedType: "预定义类型",
  Material: "材质",
  材料: "材质",
  材质: "材质",
  Density: "密度",
  MassDensity: "密度",
  密度: "密度",
  Weight: "重量",
  Mass: "重量",
  重量: "重量",
  Unit: "单位",
  MeasureUnit: "单位",
  单位: "单位",
  UnitPrice: "单价",
  单价: "单价",
  TotalPrice: "总价",
  TotalCost: "总价",
  Amount: "总价",
  总价: "总价",
  ConceptDesigner: "方案设计师",
  方案设计师: "方案设计师",
  DetailDesigner: "深化设计师",
  深化设计师: "深化设计师",
  ProcessEngineer: "工艺工程师",
  工艺工程师: "工艺工程师",
};
const ifcTypeChineseLabels: Record<string, string> = {
  IFCBEAM: "梁",
  IFCCOLUMN: "柱",
  IFCMEMBER: "杆件",
  IFCPLATE: "板件",
  IFCWALL: "墙",
  IFCSLAB: "板",
  IFCDOOR: "门",
  IFCWINDOW: "窗",
  IFCELEMENTASSEMBLY: "构件装配",
  IFCBUILDINGELEMENTPROXY: "代理构件",
  IFCFASTENER: "紧固件",
  IFCMECHANICALFASTENER: "机械紧固件",
  IFCDISCRETEACCESSORY: "离散附件",
};

interface ViewTransform {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
}

type BomExportScope = "selected" | "model";

interface BomTemplateColumn {
  header: string;
  key: string;
}

interface IfcBomRow {
  componentId: string;
  expressID: number;
  globalId: string;
  type: string;
  typeZh: string;
  dimensions: string;
  name: string;
  objectType: string;
  tag: string;
  predefinedType: string;
  quantity: number;
  material: string;
  density: string;
  weight: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

interface IfcPropertyRow {
  key: string;
  label: string;
  value: string;
  editable?: boolean;
}

type ModelAxisAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "front"
  | "back"
  | "reset";

type CadAxisAction = "left" | "right" | "up" | "down" | "reset";

const defaultViewTransform: ViewTransform = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1,
};
const defaultBomTemplateColumns: BomTemplateColumn[] = [
  { header: "构件ID", key: "componentId" },
  { header: "STEP编号", key: "expressID" },
  { header: "全局ID", key: "globalId" },
  { header: "三维尺寸", key: "dimensions" },
  { header: "构件类型", key: "typeZh" },
  { header: "IFC类型", key: "type" },
  { header: "名称", key: "name" },
  { header: "对象类型", key: "objectType" },
  { header: "构件标记", key: "tag" },
  { header: "预定义类型", key: "predefinedType" },
  { header: "数量", key: "quantity" },
  { header: "材质", key: "material" },
  { header: "密度", key: "density" },
  { header: "重量", key: "weight" },
  { header: "单位", key: "unit" },
  { header: "单价", key: "unitPrice" },
  { header: "总价", key: "totalPrice" },
];

export function OpenEngineeringViewer({
  file,
  sourceUrl,
}: OpenEngineeringViewerProps) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();

  if (ext === ".stl") {
    return <StlNativeMeshViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (file.name.toLowerCase().endsWith("tileset.json")) {
    return (
      <BIMViewer
        sourceUrl={sourceUrl}
        fileName={file.name}
        mimeType={file.mimeType}
        className="relative min-h-[calc(100vh-180px)] overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      />
    );
  }

  if (tiles3dPayloadExtensions.has(ext)) {
    return (
      <LightweightEngineeringSourceViewer
        title="3D Tiles 内容包"
        file={file}
        sourceUrl={sourceUrl}
        reason="3D Tiles 必须通过 tileset.json 作为入口进行场景调度；单个 b3dm/i3dm/pnts/cmpt payload 只作为已审计 tileset 的子资源，不单独冒充完整模型。"
      />
    );
  }

  if (openUsdExtensions.has(ext)) {
    return (
      <LightweightEngineeringSourceViewer
        title="OpenUSD/USDZ 主路线"
        file={file}
        sourceUrl={sourceUrl}
        reason="OpenUSD/USDZ 是 Prengine 的优先工程场景路线；当前仅展示真实源文件绑定，后续必须接入 Prengine OpenUSD 运行时或 worker，不得自动降级为 OBJ/FBX。"
      />
    );
  }

  if (meshExtensions.has(ext)) {
    return <MeshEngineeringViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".ifc") {
    return <IfcNativeOpenViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".dxf") {
    return <CadDerivativeViewer file={file} />;
  }

  if (ext === ".dwg") {
    return <CadDerivativeViewer file={file} />;
  }

  if (ext === ".skp") {
    return <SketchUpPrenginePendingViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (occtExtensions.has(ext)) {
    return <OcctModelViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (unsupportedOcctKernelExtensions.has(ext)) {
    return (
      <LightweightEngineeringSourceViewer
        title="需要 Prengine 授权转换链路"
        file={file}
        sourceUrl={sourceUrl}
        reason="该格式需要 Prengine 后端几何服务生成可审计查看结果；当前浏览器不直接打开源文件。"
      />
    );
  }

  return (
    <LightweightEngineeringSourceViewer
      title="工程源文件轻量查看"
      file={file}
      sourceUrl={sourceUrl}
      reason="当前格式尚未启用 Prengine 几何查看服务。系统保留源文件记录，待后端转换服务生成可审计查看结果。"
    />
  );
}

function MeshEngineeringViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const ext = file.localFile?.ext || extensionOf(file.name) || "unknown";
  const route = `${prengineLabel} · Mesh 源文件`;
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: "loading",
    message: "正在打开 Prengine 模型...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadMeshSource() {
      setState({
        status: "loading",
        message: "正在打开 Prengine 模型...",
      });

      try {
        const preview = await loadThreeSourcePreview(sourceUrl, {
          sourceFormat: ext,
          sourceName: file.name,
          mimeType: file.mimeType,
          routeLabel: route,
        });
        activeGroup = preview.group;
        if (!cancelled) {
          setState({ status: "ready", value: preview });
        } else {
          disposeGroup(preview.group);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadMeshSource();

    return () => {
      cancelled = true;
      if (activeGroup) disposeGroup(activeGroup);
    };
  }, [ext, file.mimeType, file.name, route, sourceUrl]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="Prengine 模型打开失败"
        file={file}
        reason={state.message}
      />
    );
  }

  return (
    <ExchangeModelWorkbench
      file={file}
      sourceUrl={sourceUrl}
      preview={state.value}
      routeLabel={route}
      status={`${prengineLabel} · ${ext.toUpperCase()} 模型`}
      formatLabel={ext}
    />
  );
}

function ExchangeModelWorkbench({
  file,
  sourceUrl,
  preview,
  routeLabel,
  status,
  formatLabel,
  upAxis,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  preview: OcctPreview;
  routeLabel: string;
  status: string;
  formatLabel: string;
  upAxis?: ModelUpAxis;
}) {
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [selectedObjectUuid, setSelectedObjectUuid] = useState<string | null>(
    () => findFirstMesh(preview.group)?.uuid ?? null,
  );

  const effectiveSelectedObjectUuid =
    findMeshByUuid(preview.group, selectedObjectUuid)?.uuid ??
    findFirstMesh(preview.group)?.uuid ??
    null;

  const selectedObject =
    findMeshByUuid(preview.group, effectiveSelectedObjectUuid) ??
    findFirstMesh(preview.group);
  const selectedRows = selectedObject
    ? buildExchangeObjectPropertyRows(selectedObject, file, routeLabel)
    : undefined;
  const metrics: ViewerMetric[] = [
    { label: "Mesh", value: preview.meshCount.toLocaleString() },
    { label: "顶点", value: preview.vertexCount.toLocaleString() },
    { label: "三角面", value: preview.faceCount.toLocaleString() },
    { label: "格式", value: formatLabel },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={routeLabel}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={routeLabel}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={selectedRows}
          selectedTitle={selectedObject?.name || "构件 / 文件属性"}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
    >
      <ThreeGroupViewport
        group={preview.group}
        label={file.name}
        status={status}
        upAxis={upAxis ?? groupModelUpAxis(preview.group)}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showChrome={false}
        selectedObjectUuid={effectiveSelectedObjectUuid}
        onObjectSelect={(object) => setSelectedObjectUuid(object.uuid)}
      />
    </EngineeringViewportFrame>
  );
}

function StlNativeMeshViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [selectedObjectUuid, setSelectedObjectUuid] = useState<string | null>(
    null,
  );
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: "loading",
    message: "正在打开 STL 源文件...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadStl() {
      setState({
        status: "loading",
        message: "正在打开 STL 源文件...",
      });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`读取 STL 文件失败: HTTP ${response.status}`);
        }
        const loader = new STLLoader();
        const geometry = loader.parse(await response.arrayBuffer());
        const preview = buildStlGroup(geometry, {
          sourceFormat: ".stl",
          sourceName: file.name,
          mimeType: file.mimeType,
          routeLabel: `${prengineLabel} · STL 模型`,
        });
        activeGroup = preview.group;

        if (!cancelled) {
          setSelectedObjectUuid(findFirstMesh(preview.group)?.uuid ?? null);
          setState({ status: "ready", value: preview });
        } else {
          disposeGroup(preview.group);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadStl();

    return () => {
      cancelled = true;
      if (activeGroup) disposeGroup(activeGroup);
    };
  }, [file, sourceUrl]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="STL 解析失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const selectedObject =
    findMeshByUuid(state.value.group, selectedObjectUuid) ??
    findFirstMesh(state.value.group);
  const selectedRows = selectedObject
    ? buildExchangeObjectPropertyRows(
        selectedObject,
        file,
        `${prengineLabel} · STL 模型`,
      )
    : undefined;
  const metrics: ViewerMetric[] = [
    { label: "Mesh", value: state.value.meshCount.toLocaleString() },
    { label: "顶点", value: state.value.vertexCount.toLocaleString() },
    { label: "三角面", value: state.value.faceCount.toLocaleString() },
    { label: "格式", value: ".stl" },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={`${prengineLabel} · STL 模型`}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={`${prengineLabel} · STL 模型`}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={selectedRows}
          selectedTitle={selectedObject?.name || "构件 / 文件属性"}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
    >
      <ThreeGroupViewport
        group={state.value.group}
        label={file.name}
        status={`${prengineLabel} · STL 模型`}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showChrome={false}
        selectedObjectUuid={selectedObjectUuid}
        onObjectSelect={(object) => setSelectedObjectUuid(object.uuid)}
      />
    </EngineeringViewportFrame>
  );
}

function EngineeringViewportFrame({
  metrics,
  routeLabel,
  children,
  toolbarActions,
  aside,
  asideOpen,
  asideLabel = "属性",
  onToggleAside,
  drawer,
  drawerOpen,
  drawerLabel = "摘要",
  onToggleDrawer,
  onResetView,
  onZoomIn,
  onZoomOut,
}: {
  metrics: ViewerMetric[];
  routeLabel: string;
  children: ReactNode;
  toolbarActions?: ReactNode;
  aside?: ReactNode;
  asideOpen?: boolean;
  asideLabel?: string;
  onToggleAside?: () => void;
  drawer?: ReactNode;
  drawerOpen?: boolean;
  drawerLabel?: string;
  onToggleDrawer?: () => void;
  onResetView?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}) {
  return (
    <section className="relative h-[calc(100dvh-108px)] min-h-[560px] overflow-hidden rounded-md border border-slate-800 bg-slate-950">
      <div className="absolute inset-0 h-full w-full">{children}</div>

      <DockableViewerToolbar
        title="工程查看"
        subtitle={routeLabel}
        metrics={metrics}
        actions={
          <>
            <EngineeringCommandActions
              onToggleAside={onToggleAside}
              onResetView={onResetView}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
            />
            {toolbarActions}
            {onToggleDrawer && drawer ? (
              <button
                type="button"
                onClick={onToggleDrawer}
                className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
                aria-pressed={drawerOpen}
                aria-label={
                  drawerOpen ? `收起${drawerLabel}` : `展开${drawerLabel}`
                }
                title={drawerOpen ? `收起${drawerLabel}` : `展开${drawerLabel}`}
              >
                <PanelBottom className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onToggleAside && aside ? (
              <button
                type="button"
                onClick={onToggleAside}
                className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
                aria-label={
                  asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`
                }
                title={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
              >
                {asideOpen ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
          </>
        }
      />

      {aside && asideOpen ? (
        <aside className="viewer-floating-panel absolute bottom-3 right-3 top-14 z-20 w-[min(198px,calc(100%-24px))] overflow-hidden rounded-md">
          {aside}
        </aside>
      ) : null}

      {drawer && drawerOpen ? (
        <section className="viewer-floating-panel absolute bottom-3 left-3 right-3 z-20 max-h-[42%] overflow-auto rounded-md p-3">
          {drawer}
        </section>
      ) : null}
    </section>
  );
}

function EngineeringCommandActions({
  onToggleAside,
  onResetView,
  onZoomIn,
  onZoomOut,
}: {
  onToggleAside?: (() => void) | undefined;
  onResetView?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
}) {
  return (
    <>
      <EngineeringCommandButton label="选择构件" title="点击模型构件选择并查看属性">
        <MousePointer2 className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton
        label="放大"
        title="放大当前模型视图"
        onClick={onZoomIn}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton
        label="缩小"
        title="缩小当前模型视图"
        onClick={onZoomOut}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton
        label="重置视图"
        title="重置到模型完整视图"
        onClick={onResetView}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton
        label="属性"
        title="展开或收起构件属性"
        onClick={onToggleAside}
      >
        <Info className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="坐标 / 位置" title="坐标信息在属性面板显示">
        <MapPin className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="视点" title="R 键或重置视图按钮恢复模型视点">
        <Crosshair className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="移动" title="方向键平移，W/A/S/D 旋转，+/- 缩放">
        <Move3D className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="场景" title="重置到模型完整场景">
        <Maximize2 className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
    </>
  );
}

function EngineeringCommandButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  onClick?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md opacity-90"
      title={title ?? label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ModelSixAxisControlPanel({
  onAction,
}: {
  onAction: (action: ModelAxisAction) => void;
}) {
  const buttons: Array<{
    action: ModelAxisAction;
    label: string;
    title: string;
    className: string;
  }> = [
    { action: "up", label: "上", title: "沿上轴移动", className: "col-start-2" },
    { action: "front", label: "前", title: "沿前轴移动", className: "col-start-4" },
    { action: "left", label: "左", title: "沿左轴移动", className: "col-start-1 row-start-2" },
    { action: "reset", label: "中", title: "重置六轴位置", className: "col-start-2 row-start-2" },
    { action: "right", label: "右", title: "沿右轴移动", className: "col-start-3 row-start-2" },
    { action: "back", label: "后", title: "沿后轴移动", className: "col-start-4 row-start-2" },
    { action: "down", label: "下", title: "沿下轴移动", className: "col-start-2 row-start-3" },
  ];

  return (
    <div
      className="viewer-floating-panel absolute bottom-3 left-3 z-20 grid grid-cols-4 grid-rows-3 gap-1 rounded-md p-1.5"
      aria-label="六轴操控"
    >
      {buttons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => onAction(button.action)}
          className={`viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold ${button.className}`}
          title={button.title}
          aria-label={button.title}
        >
          {button.action === "reset" ? <Crosshair className="h-3.5 w-3.5" /> : button.label}
        </button>
      ))}
    </div>
  );
}

function ModelCoordinateAxisLegend() {
  return (
    <div
      className="viewer-floating-panel pointer-events-none absolute bottom-3 left-40 z-20 rounded-md px-2.5 py-2 text-[10px] font-semibold text-slate-100"
      aria-label="模型坐标轴"
    >
      <div className="relative h-12 w-16">
        <span className="absolute left-6 top-6 h-px w-9 origin-left -rotate-[28deg] bg-red-400" />
        <span className="absolute left-[1.55rem] top-2 h-9 w-px bg-emerald-400" />
        <span className="absolute left-6 top-6 h-px w-9 origin-left rotate-[34deg] bg-sky-400" />
        <span className="absolute left-[3.8rem] top-4 text-red-300">X</span>
        <span className="absolute left-7 top-0 text-emerald-300">Y</span>
        <span className="absolute left-[3.65rem] top-9 text-sky-300">Z</span>
      </div>
    </div>
  );
}

function CadFourAxisControlPanel({
  onAction,
}: {
  onAction: (action: CadAxisAction) => void;
}) {
  const buttons: Array<{
    action: CadAxisAction;
    label: string;
    title: string;
    className: string;
  }> = [
    { action: "up", label: "上", title: "向上平移图纸", className: "col-start-2" },
    { action: "left", label: "左", title: "向左平移图纸", className: "col-start-1 row-start-2" },
    { action: "reset", label: "中", title: "重置图纸位置", className: "col-start-2 row-start-2" },
    { action: "right", label: "右", title: "向右平移图纸", className: "col-start-3 row-start-2" },
    { action: "down", label: "下", title: "向下平移图纸", className: "col-start-2 row-start-3" },
  ];

  return (
    <div
      className="viewer-floating-panel absolute bottom-3 left-3 z-20 grid grid-cols-3 grid-rows-3 gap-1 rounded-md p-1.5"
      aria-label="四轴操控"
    >
      {buttons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => onAction(button.action)}
          className={`viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold ${button.className}`}
          title={button.title}
          aria-label={button.title}
        >
          {button.action === "reset" ? <Crosshair className="h-3.5 w-3.5" /> : button.label}
        </button>
      ))}
    </div>
  );
}

function applyModelAxisAction(
  action: ModelAxisAction,
  setViewTransform: Dispatch<SetStateAction<ViewTransform>>,
  step = 4,
) {
  setViewTransform((current) => {
    if (action === "reset") return defaultViewTransform;
    if (action === "left") return { ...current, offsetX: current.offsetX - step };
    if (action === "right") return { ...current, offsetX: current.offsetX + step };
    if (action === "up") return { ...current, offsetZ: current.offsetZ + step };
    if (action === "down") return { ...current, offsetZ: current.offsetZ - step };
    if (action === "front") return { ...current, offsetY: current.offsetY - step };
    return { ...current, offsetY: current.offsetY + step };
  });
}

function applyCadAxisAction(
  action: CadAxisAction,
  setViewport: Dispatch<
    SetStateAction<{ zoom: number; panX: number; panY: number }>
  >,
  step = 42,
) {
  setViewport((current) => {
    if (action === "reset") return { zoom: 1, panX: 0, panY: 0 };
    if (action === "left") return { ...current, panX: current.panX + step };
    if (action === "right") return { ...current, panX: current.panX - step };
    if (action === "up") return { ...current, panY: current.panY + step };
    return { ...current, panY: current.panY - step };
  });
}

function ExchangePropertyPanel({
  file,
  routeLabel,
  metrics,
  sourceUrl,
  selectedRows,
  selectedTitle,
  bomElements,
}: {
  file: ModuleFileNode;
  routeLabel: string;
  metrics: ViewerMetric[];
  sourceUrl: string;
  selectedRows?: IfcPropertyRow[] | undefined;
  selectedTitle?: string | undefined;
  bomElements?: IfcElementProperties[] | undefined;
}) {
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const rows: IfcPropertyRow[] = [
    { key: "fileName", label: "文件名", value: file.name },
    {
      key: "format",
      label: "原生格式",
      value: file.localFile?.ext || extensionOf(file.name) || "unknown",
    },
    { key: "mime", label: "MIME", value: file.mimeType || "unknown" },
    { key: "route", label: "查看链路", value: routeLabel },
    {
      key: "sourceId",
      label: "源文件ID",
      value: file.localFileId ?? file.localFile?.fileId ?? file.id,
    },
    { key: "version", label: "所属版本", value: file.version ?? "v1.0" },
    {
      key: "uploadedAt",
      label: "上传时间",
      value: file.updatedAt ?? file.localFile?.createdAt ?? "-",
    },
    { key: "placement", label: "对象定位", value: "源模型坐标保留" },
    {
      key: "geometry",
      label: "几何表达",
      value: "Prengine 模型 / 派生结果",
    },
    {
      key: "material",
      label: "材质信息",
      value: "源文件材质/颜色优先，缺失时使用可视化默认色",
    },
  ];
  const primaryRows = selectedRows?.length ? selectedRows : rows;

  return (
    <div className="h-full overflow-auto p-3 text-[11px] text-slate-100">
      <p className="text-[10px] font-medium uppercase text-emerald-300">
        Element properties
      </p>
      <h3 className="mt-1 text-sm font-medium">
        {selectedTitle || "构件 / 文件属性"}
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => templateInputRef.current?.click()}
          className="viewer-ghost-tool inline-flex h-7 items-center justify-center gap-1 rounded px-1 text-[10px] font-medium"
          title="上传本地 BOM / 属性导出模板"
        >
          <FileUp className="h-3.5 w-3.5" />
          上传模板
        </button>
        <button
          type="button"
          onClick={() =>
            bomElements?.length
              ? void exportIfcElementsBom(file.name, bomElements, templateFile)
              : void exportExchangePropertyRows(
                  file.name,
                  primaryRows,
                  templateFile,
                )
          }
          className="viewer-ghost-tool inline-flex h-7 items-center justify-center gap-1 rounded px-1 text-[10px] font-medium"
          title={bomElements?.length ? "导出整模构件清单" : "导出当前属性清单"}
        >
          <Download className="h-3.5 w-3.5" />
          导出清单
        </button>
        <input
          ref={templateInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(event) => {
            setTemplateFile(event.target.files?.[0] ?? null);
          }}
        />
      </div>
      {templateFile ? (
        <p className="mt-1 truncate text-[10px] text-emerald-300">
          模板：{templateFile.name}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <div
            key={`${metric.label}:${metric.value}`}
            className="rounded-md bg-slate-950/35 p-2"
          >
            <p className="text-[10px] text-slate-400">{metric.label}</p>
            <p className="mt-1 break-words font-medium text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {primaryRows.map((row) => (
          <label key={row.key} className="block rounded-md bg-slate-950/20 p-2">
            <span className="block text-[10px] text-slate-400">
              {row.label}
            </span>
            <span className="mt-1 block break-words font-medium text-slate-100">
              {row.value}
            </span>
          </label>
        ))}
      </div>
      <a
        href={sourceUrl}
        download={file.name}
        className="viewer-ghost-tool mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium text-slate-100"
      >
        <Download className="h-3.5 w-3.5" />
        下载源文件
      </a>
    </div>
  );
}

function IfcNativeOpenViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<IfcLiteRendererHandle | null>(null);
  const selectedRef = useRef<number | null>(null);
  const streamingRef = useRef(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [webGpuPrompt, setWebGpuPrompt] = useState<{
    open: boolean;
    reason: string;
  }>({ open: false, reason: "" });
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(
    null,
  );
  const [state, setState] = useState<LoadState<IfcLiteNativePreview>>({
    status: "loading",
    message: "正在启动 Prengine 原生查看器...",
  });

  useEffect(() => {
    let cancelled = false;
    let renderer: IfcLiteRendererHandle | null = null;
    let activeGroup: Group | null = null;
    let stopRenderLoop: (() => void) | null = null;
    let stopControls: (() => void) | null = null;

    async function loadNativeIfc() {
      await Promise.resolve();
      if (cancelled) return;
      setSelectedExpressID(null);
      setWebGpuPrompt({ open: false, reason: "" });
      setState({
        status: "loading",
        message: "正在启动 Prengine 原生查看器...",
      });
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error("Prengine 画布未挂载。");
        }
        const gpuNavigator = navigator as Navigator & { gpu?: unknown };
        if (!gpuNavigator.gpu) {
          if (!cancelled && shouldShowWebGpuEnableDialog()) {
            setWebGpuPrompt({
              open: true,
              reason:
                "当前浏览器没有暴露 navigator.gpu，Prengine GPU 查看器无法启动。",
            });
          }
          const fallback = await loadIfcLiteThreePreview({
            fileSize: file.size,
            sourceUrl,
            onProgress: (message) => {
              if (!cancelled) setState({ status: "loading", message });
            },
            onPreview: (preview) => {
              activeGroup = preview.group;
              if (!cancelled) setState({ status: "ready", value: preview });
            },
            isCancelled: () => cancelled,
          });
          activeGroup = fallback.group;
          if (!cancelled) setState({ status: "ready", value: fallback });
          return;
        }
        const result = await loadIfcLiteNativePreview({
          canvas,
          fileSize: file.size,
          sourceUrl,
          selectedRef,
          streamingRef,
          onReady: (nextRenderer) => {
            renderer = nextRenderer;
            rendererRef.current = nextRenderer;
            stopRenderLoop = startIfcLiteRenderLoop(
              nextRenderer,
              selectedRef,
              streamingRef,
            );
            stopControls = bindIfcLiteCanvasControls(
              canvas,
              nextRenderer,
              selectedRef,
              streamingRef,
              setSelectedExpressID,
            );
          },
          onProgress: (message) => {
            if (!cancelled) {
              setState({ status: "loading", message });
            }
          },
          onPreview: (preview) => {
            if (!cancelled) {
              setState({ status: "ready", value: preview });
            }
          },
          isCancelled: () => cancelled,
        }).catch(async (error) => {
            stopControls?.();
            stopRenderLoop?.();
            renderer?.destroy();
            renderer = null;
            rendererRef.current = null;
            const message =
              error instanceof Error ? error.message : String(error);
            if (
              !cancelled &&
              isWebGpuRuntimeError(message) &&
              shouldShowWebGpuEnableDialog()
            ) {
              setWebGpuPrompt({
                open: true,
                reason: message,
              });
            }
            return loadIfcLiteThreePreview({
              fileSize: file.size,
              sourceUrl,
              onProgress: (progress) => {
                if (!cancelled) {
                  setState({
                    status: "loading",
                    message: `${progress} WebGPU 回退原因：${message}`,
                  });
                }
              },
              onPreview: (preview) => {
                activeGroup = preview.group;
                if (!cancelled) setState({ status: "ready", value: preview });
              },
              isCancelled: () => cancelled,
            });
          });
        activeGroup = result.group;
        if (!cancelled) setState({ status: "ready", value: result });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadNativeIfc();

    return () => {
      cancelled = true;
      stopControls?.();
      stopRenderLoop?.();
      renderer?.destroy();
      if (activeGroup) disposeGroup(activeGroup);
      rendererRef.current = null;
    };
  }, [file.size, sourceUrl]);

  useEffect(() => {
    selectedRef.current = selectedExpressID;
    rendererRef.current?.render({
      selectedId: selectedExpressID,
      isStreaming: streamingRef.current,
    });
  }, [selectedExpressID]);

  function renderIfcCurrent() {
    rendererRef.current?.render({
      selectedId: selectedRef.current,
      isStreaming: streamingRef.current,
    });
  }

  function resetIfcView() {
    rendererRef.current?.fitToView();
    renderIfcCurrent();
  }

  function zoomIfcView(direction: "in" | "out") {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    renderer.getCamera().zoom(
      direction === "in" ? -8 : 8,
      true,
      rect.width / 2,
      rect.height / 2,
      rect.width,
      rect.height,
      true,
    );
    renderer.requestRender();
  }

  if (state.status === "failed") {
    return (
      <IfcNativeFallbackPanel
        title="IFC 原生查看不可用"
        file={file}
        reason={`${state.message} 当前原生 IFC 打开不自动触发 OpenUSD/USDZ、3D Tiles 或 glTF/GLB 兜底派生转换。`}
        adapters={ifcNativeAdapterOrder()}
      />
    );
  }

  const preview =
    state.status === "ready" ? state.value : ifcLiteInitialPreview;
  const selectedElement =
    preview.elements.find((element) => element.expressID === selectedExpressID) ??
    null;
  const route = `${prengineLabel} · IFC 原生源文件`;
  const metrics: ViewerMetric[] = [
    { label: "格式", value: ".ifc" },
    { label: "引擎", value: prengineLabel },
    { label: "网格", value: preview.loadedMeshes.toLocaleString() },
    {
      label: "总网格",
      value: preview.totalMeshes?.toLocaleString() ?? "流式加载中",
    },
    { label: "顶点", value: preview.totalVertices.toLocaleString() },
    { label: "三角面", value: preview.totalTriangles.toLocaleString() },
    { label: "大小", value: formatModuleFileSize(file.size) },
    {
      label: "选中",
      value: selectedExpressID ? `#${selectedExpressID}` : "未选中",
    },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={route}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={route}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={
            selectedElement
              ? buildIfcLiteElementPropertyRows(file, preview, selectedElement)
              : undefined
          }
          selectedTitle={
            selectedElement
              ? `${displayIfcElementName(selectedElement)} · #${selectedElement.expressID}`
              : "构件 / 文件属性"
          }
          bomElements={preview.elements}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
      onResetView={resetIfcView}
      onZoomIn={() => zoomIfcView("in")}
      onZoomOut={() => zoomIfcView("out")}
    >
      <section
        className="relative h-full min-h-0 w-full overflow-hidden bg-slate-950"
        tabIndex={0}
        onPointerDown={(event) => event.currentTarget.focus()}
        onKeyDown={(event) =>
          handleIfcLiteKeyDown(
            event,
            rendererRef.current,
            selectedRef,
            streamingRef,
          )
        }
      >
        {preview.mode === "three" && preview.group ? (
          <ThreeGroupViewport
            group={preview.group}
            label={file.name}
            status={`${prengineLabel} 兼容查看`}
            upAxis={groupModelUpAxis(preview.group)}
            selectedExpressID={selectedExpressID}
            onMeshSelect={setSelectedExpressID}
            className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
            showChrome={false}
          />
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="h-full w-full cursor-grab touch-none bg-slate-950 active:cursor-grabbing"
              aria-label={`${file.name} ${prengineLabel} viewer`}
              onContextMenu={(event) => event.preventDefault()}
            />
            <ModelCoordinateAxisLegend />
          </>
        )}
        {state.status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/35">
            <div className="viewer-floating-panel w-full max-w-xs rounded-md p-4 text-center text-slate-100">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-300" />
              <p className="mt-3 truncate text-sm font-medium">{file.name}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                {state.message}
              </p>
            </div>
          </div>
        ) : null}
        {webGpuPrompt.open ? (
          <WebGpuEnableDialog
            reason={webGpuPrompt.reason}
            onClose={() =>
              setWebGpuPrompt((current) => ({ ...current, open: false }))
            }
          />
        ) : null}
        {preview.mode === "three" ? null : (
          <ModelSixAxisControlPanel
            onAction={(action) =>
              applyIfcLiteAxisAction(
                action,
                rendererRef.current,
                selectedRef,
                streamingRef,
              )
            }
          />
        )}
      </section>
    </EngineeringViewportFrame>
  );
}

function shouldShowWebGpuEnableDialog(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  const isLocalhost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  return window.isSecureContext || isLocalhost;
}

function WebGpuEnableDialog({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/58 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="webgpu-enable-title"
        className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-950 p-5 text-slate-100 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="webgpu-enable-title" className="text-base font-semibold">
              当前浏览器未启用 WebGPU
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {reason}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/70 p-3 text-sm leading-6 text-slate-200">
          <p className="font-medium text-slate-100">Chrome / Edge 启用步骤</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              如果当前地址是{" "}
              <span className="font-mono text-emerald-300">
                http://192.168.x.x:3000
              </span>
              ，请在本机改用{" "}
              <span className="font-mono text-emerald-300">
                http://localhost:3000
              </span>{" "}
              或配置 HTTPS。WebGPU 通常只在安全来源上开放。
            </li>
            <li>
              打开 <span className="font-mono text-emerald-300">chrome://settings/system</span>，
              开启“使用图形加速”后重启浏览器。
            </li>
            <li>
              打开 <span className="font-mono text-emerald-300">chrome://gpu</span>，
              确认 WebGPU / Vulkan / OpenGL 不是禁用状态。
            </li>
            <li>
              仍不可用时，打开{" "}
              <span className="font-mono text-emerald-300">
                chrome://flags/#enable-unsafe-webgpu
              </span>{" "}
              设为 Enabled，然后重启浏览器。
            </li>
            <li>
              仅开发调试时，可在{" "}
              <span className="font-mono text-emerald-300">
                chrome://flags/#unsafely-treat-insecure-origin-as-secure
              </span>{" "}
              添加当前地址，再重启浏览器。
            </li>
          </ol>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Linux、远程桌面或虚拟机环境还需要可用显卡驱动。当前会继续使用
            Prengine 兼容模式，不自动触发 OpenUSD / 3D Tiles / GLB 兜底派生。
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="viewer-ghost-tool rounded-md px-3 py-2 text-sm font-medium text-white"
          >
            继续查看
          </button>
        </div>
      </section>
    </div>
  );
}

function isWebGpuRuntimeError(message: string): boolean {
  return /webgpu|gpuadapter|gpudevice|createbuffer|navigator\.gpu|adapter|vulkan/i.test(
    message,
  );
}

function IfcNativeFallbackPanel({
  title,
  file,
  reason,
  adapters,
}: {
  title: string;
  file: ModuleFileNode;
  reason: string;
  adapters: IfcDerivativeClientAdapter[];
}) {
  const ordered = adapters.length ? adapters : ifcNativeAdapterOrder();

  return (
    <section className="arch-card rounded-lg p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="arch-primary-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="arch-text text-lg font-medium">{title}</h3>
          <p className="arch-muted mt-2 max-w-4xl text-sm leading-6">
            {reason}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="格式"
              value={file.localFile?.ext || extensionOf(file.name) || "unknown"}
            />
            <MetricCard label="MIME" value={file.mimeType} />
            <MetricCard label="大小" value={formatModuleFileSize(file.size)} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-3">
            <p className="text-xs font-medium text-slate-700">IFC 后备顺序</p>
            <ol className="mt-2 grid gap-2">
              {ordered.map((adapter) => (
                <li
                  key={adapter.id}
                  className="rounded-md border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-xs font-semibold text-emerald-700">
                      {adapter.priority}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-900">
                        {adapter.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {adapterRoleLabel(adapter.role)} ·{" "}
                        {adapterCapabilityLabel(adapter.capability)} ·{" "}
                        {adapterStatusLabel(adapter.status)}
                      </p>
                      {adapter.installHint ? (
                        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                          {adapter.installHint}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

async function loadIfcLiteNativePreview({
  canvas,
  fileSize,
  sourceUrl,
  selectedRef,
  streamingRef,
  onReady,
  onProgress,
  onPreview,
  isCancelled,
}: {
  canvas: HTMLCanvasElement;
  fileSize: number;
  sourceUrl: string;
  selectedRef: { current: number | null };
  streamingRef: { current: boolean };
  onReady: (renderer: IfcLiteRendererHandle) => void;
  onProgress: (message: string) => void;
  onPreview: (preview: IfcLiteNativePreview) => void;
  isCancelled: () => boolean;
}): Promise<IfcLiteNativePreview> {
  onProgress("正在加载 Prengine 模型查看器...");
  const [{ Renderer }, { GeometryProcessor }] = (await Promise.all([
    import("@ifc-lite/renderer"),
    import("@ifc-lite/geometry"),
  ])) as [IfcLiteRendererModule, IfcLiteGeometryModule];
  const renderer = new Renderer(canvas);
  const processor = new GeometryProcessor({ mergeLayers: true });
  await Promise.all([renderer.init(), processor.init()]);
  if (isCancelled()) {
    renderer.destroy();
    return ifcLiteInitialPreview;
  }
  onReady(renderer);
  renderer.render({ selectedId: selectedRef.current, isStreaming: true });

  onProgress("正在读取 IFC 源文件...");
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    renderer.destroy();
    throw new Error(`读取 IFC 失败: HTTP ${response.status}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  const lengthUnit = inferIfcLengthDisplayUnit(buffer);
  const elementIndex = buildIfcLiteElementIndex(buffer, lengthUnit);
  const elementBounds = new Map<number, Bounds3D>();
  const startedAt = performance.now();
  const fileSizeMB = fileSize / (1024 * 1024);
  const preview: IfcLiteNativePreview = {
    ...ifcLiteInitialPreview,
    lengthUnit,
    elements: sortedIfcLiteElements(elementIndex),
  };
  let firstFrame = true;

  onProgress("正在流式解析 Prengine 几何...");
  for await (const event of processor.processAdaptive(buffer, {
    sizeThreshold: 512 * 1024,
    batchSize: {
      initialBatchSize: 25,
      maxBatchSize: fileSizeMB > 80 ? 240 : 420,
      fileSizeMB,
    },
    wasmUrls: { wasm: ifcLiteWasmUrl },
  })) {
    if (isCancelled()) break;
    if (isIfcLiteBatchEvent(event)) {
      if (!event.meshes.length) continue;
      const renderMeshes: IfcLiteStreamingBatch[] = [];
      preview.loadedMeshes = event.totalSoFar;
      for (const mesh of event.meshes) {
        const element = updateIfcLiteElementMetadata(elementIndex, mesh);
        includeIfcLiteElementMeshStats(element, mesh);
        includeIfcLiteMeshBounds(
          elementBounds,
          elementIndex,
          mesh,
          lengthUnit,
        );
        renderMeshes.push(ifcLiteMeshWithResolvedColor(mesh, element));
        preview.totalVertices += Math.floor(mesh.positions.length / 3);
        preview.totalTriangles += Math.floor(mesh.indices.length / 3);
      }
      renderer.addMeshes(renderMeshes, true);
      preview.elements = sortedIfcLiteElements(elementIndex);
      if (firstFrame) {
        firstFrame = false;
        preview.firstFrameMs = Math.round(performance.now() - startedAt);
        renderer.fitToView();
      }
      renderer.render({
        selectedId: selectedRef.current,
        isStreaming: streamingRef.current,
      });
      onPreview({ ...preview });
      continue;
    }

    if (isIfcLiteCompleteEvent(event)) {
      preview.totalMeshes = event.totalMeshes;
      preview.complete = true;
      preview.elements = sortedIfcLiteElements(elementIndex);
      streamingRef.current = false;
      renderer.fitToView();
      renderer.render({
        selectedId: selectedRef.current,
        isStreaming: false,
      });
      onPreview({ ...preview });
      continue;
    }

    if (event.type === "progress") {
      onProgress(`Prengine 正在处理 ${event.phase}...`);
    }
  }

  return preview;
}

async function loadIfcLiteThreePreview({
  fileSize,
  sourceUrl,
  onProgress,
  onPreview,
  isCancelled,
}: {
  fileSize: number;
  sourceUrl: string;
  onProgress: (message: string) => void;
  onPreview: (preview: IfcLiteNativePreview) => void;
  isCancelled: () => boolean;
}): Promise<IfcLiteNativePreview> {
  onProgress("正在加载 Prengine 几何解析器...");
  const { GeometryProcessor } = (await import("@ifc-lite/geometry")) as IfcLiteGeometryModule;
  const processor = new GeometryProcessor({ mergeLayers: true });
  await processor.init();

  onProgress("正在读取 IFC 源文件...");
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`读取 IFC 失败: HTTP ${response.status}`);
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  const lengthUnit = inferIfcLengthDisplayUnit(buffer);
  const elementIndex = buildIfcLiteElementIndex(buffer, lengthUnit);
  const elementBounds = new Map<number, Bounds3D>();
  const group = new Group();
  group.name = "Prengine native IFC";
  group.userData = {
    sourceFormat: ".ifc",
    routeLabel: `${prengineLabel} · IFC 原生源文件`,
  };

  const startedAt = performance.now();
  const fileSizeMB = fileSize / (1024 * 1024);
  const preview: IfcLiteNativePreview = {
    ...ifcLiteInitialPreview,
    mode: "three",
    group,
    lengthUnit,
    elements: sortedIfcLiteElements(elementIndex),
  };
  let firstFrame = true;

  onProgress("正在用 Prengine 流式解析几何...");
  for await (const event of processor.processAdaptive(buffer, {
    sizeThreshold: 512 * 1024,
    batchSize: {
      initialBatchSize: 20,
      maxBatchSize: fileSizeMB > 80 ? 160 : 260,
      fileSizeMB,
    },
    wasmUrls: { wasm: ifcLiteWasmUrl },
  })) {
    if (isCancelled()) break;
    if (isIfcLiteBatchEvent(event)) {
      for (const mesh of event.meshes) {
        const element = updateIfcLiteElementMetadata(elementIndex, mesh);
        includeIfcLiteElementMeshStats(element, mesh);
        includeIfcLiteMeshBounds(
          elementBounds,
          elementIndex,
          mesh,
          lengthUnit,
        );
        const object = buildIfcLiteThreeMesh(mesh, element, lengthUnit);
        if (!object) continue;
        group.add(object);
        preview.totalVertices += Math.floor(mesh.positions.length / 3);
        preview.totalTriangles += Math.floor(mesh.indices.length / 3);
      }
      preview.loadedMeshes = event.totalSoFar;
      preview.elements = sortedIfcLiteElements(elementIndex);
      if (group.children.length > 0) {
        normalizeThreeGroupReferencePlane(group, "z");
      }
      if (firstFrame && group.children.length > 0) {
        firstFrame = false;
        preview.firstFrameMs = Math.round(performance.now() - startedAt);
      }
      onPreview({ ...preview });
      continue;
    }

    if (isIfcLiteCompleteEvent(event)) {
      preview.totalMeshes = event.totalMeshes;
      preview.complete = true;
      preview.elements = sortedIfcLiteElements(elementIndex);
      if (group.children.length > 0) {
        normalizeThreeGroupReferencePlane(group, "z");
      }
      onPreview({ ...preview });
      continue;
    }

    if (event.type === "progress") {
      onProgress(`Prengine 正在处理 ${event.phase}...`);
    }
  }

  return preview;
}

function normalizeThreeGroupReferencePlane(
  group: Group,
  preferredUpAxis?: ModelUpAxis,
): ModelUpAxis {
  group.position.set(0, 0, 0);
  const nativeBounds = new Box3().setFromObject(group);
  const upAxis = preferredUpAxis ?? inferIfcUpAxis(nativeBounds);
  group.userData.upAxis = upAxis;

  if (nativeBounds.isEmpty()) {
    return upAxis;
  }

  const center = nativeBounds.getCenter(new Vector3());
  const renderOffset =
    upAxis === "y"
      ? new Vector3(center.x, nativeBounds.min.y, center.z)
      : new Vector3(center.x, center.y, nativeBounds.min.z);
  group.position.set(-renderOffset.x, -renderOffset.y, -renderOffset.z);
  group.userData.nativeBounds = nativeBounds.clone();
  group.userData.renderOffset = renderOffset.clone();
  return upAxis;
}

function groupModelUpAxis(group: Group | null): ModelUpAxis {
  return group?.userData.upAxis === "y" ? "y" : "z";
}

function buildIfcLiteThreeMesh(
  mesh: IfcLiteStreamingBatch,
  element?: IfcElementProperties,
  lengthUnit: LengthDisplayUnit = meterLengthUnit,
): Mesh | null {
  if (mesh.positions.length < 9 || mesh.indices.length < 3) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
  if (mesh.normals && mesh.normals.length === mesh.positions.length) {
    geometry.setAttribute("normal", new Float32BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  if (mesh.entityIds && mesh.entityIds.length === mesh.positions.length / 3) {
    geometry.setAttribute("expressID", new BufferAttribute(mesh.entityIds, 1));
  }
  geometry.computeBoundingBox();
  const localBounds = geometry.boundingBox
    ? boxToSerializableBounds(geometry.boundingBox)
    : undefined;
  const localProjectBounds = localBounds
    ? ifcLiteBoundsMetersToProjectUnit(localBounds, lengthUnit)
    : undefined;

  const color = normalizeIfcLiteColor(element?.styleColor ?? mesh.color);
  const material = new MeshBasicMaterial({
    color: new Color(color[0], color[1], color[2]),
    opacity: color[3],
    transparent: color[3] < 0.98,
    side: DoubleSide,
    toneMapped: false,
  });
  const object = new Mesh(geometry, material);
  const type = mesh.ifcType ?? "IFCENTITY";
  object.name = element
    ? `${displayIfcElementName(element)} #${mesh.expressId}`
    : `${type} #${mesh.expressId}`;
  const sourceDimensions = reliableIfcElementDimensions(element);
  const sourceDimensionCenter =
    element?.sourcePlacement ??
    element?.geometryCenter ??
    boundsCenter(localProjectBounds ?? null);
  object.userData = {
    expressID: mesh.expressId,
    ifcType: type,
    componentId: element?.globalId || `IFC-${mesh.expressId}`,
    objectType: element?.objectType || type,
    sourceName: object.name,
    sourceFormat: ".ifc",
    routeLabel: `${prengineLabel} · IFC 原生源文件`,
    materialSource: `${prengineLabel} 源材质/颜色`,
    baseColor: [color[0], color[1], color[2]],
    sourceProperties: element?.properties ?? [],
    ...(localProjectBounds
      ? {
          nativeBounds: localProjectBounds,
          ...(sourceDimensions
            ? { dimensionsMm: sourceDimensions }
            : { dimensionsMm: boundsDimensions(localProjectBounds) }),
          ...(sourceDimensionCenter ? { nativeCenterMm: sourceDimensionCenter } : {}),
        }
      : {}),
  };
  return object;
}

function ifcLiteMeshWithResolvedColor(
  mesh: IfcLiteStreamingBatch,
  element: IfcElementProperties | undefined,
): IfcLiteStreamingBatch {
  if (!element?.styleColor) return mesh;
  return {
    ...mesh,
    color: normalizeIfcLiteColor(element.styleColor),
  };
}

function normalizeIfcLiteColor(
  color: [number, number, number, number] | undefined,
): [number, number, number, number] {
  const fallback: [number, number, number, number] = [0.72, 0.78, 0.82, 1];
  if (!color) return fallback;
  const max = Math.max(...color.slice(0, 3));
  const factor = max > 1 ? 255 : 1;
  return [
    clampNumber(color[0] / factor, 0.02, 1),
    clampNumber(color[1] / factor, 0.02, 1),
    clampNumber(color[2] / factor, 0.02, 1),
    clampNumber(color[3] ?? 1, 0.08, 1),
  ];
}

function reliableIfcElementDimensions(
  element: IfcElementProperties | undefined,
): Bounds3DPoint | null {
  if (!element?.geometryDimensions) return null;
  const sources = Object.values(element.geometryDimensionSource ?? {});
  const hasIfcSource = sources.some(
    (source) =>
      source === "ifc-representation" || source === "ifc-quantity",
  );
  return hasIfcSource ? element.geometryDimensions : null;
}

function isIfcLiteBatchEvent(
  event: IfcLiteStreamingEvent,
): event is { type: "batch"; meshes: IfcLiteStreamingBatch[]; totalSoFar: number } {
  return event.type === "batch";
}

function isIfcLiteCompleteEvent(
  event: IfcLiteStreamingEvent,
): event is { type: "complete"; totalMeshes: number } {
  return event.type === "complete";
}

export function buildIfcLiteElementIndex(
  buffer: Uint8Array,
  lengthUnit: LengthDisplayUnit = inferIfcLengthDisplayUnit(buffer),
): Map<number, IfcElementProperties> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const elements = new Map<number, IfcElementProperties>();
  const records = new Map<number, IfcStepRecord>();
  const linePattern = /#(\d+)\s*=\s*([A-Z][A-Z0-9_]*)\s*\(([\s\S]*?)\);/g;
  let match: RegExpExecArray | null;

  while ((match = linePattern.exec(text)) !== null) {
    const expressID = Number.parseInt(match[1] ?? "", 10);
    const type = (match[2] ?? "IFCENTITY").toUpperCase();
    if (!Number.isFinite(expressID)) continue;
    const params = splitIfcStepParams(match[3] ?? "");
    records.set(expressID, { expressID, type, params });
    if (!isIfcRenderableProductRecord(type, params)) continue;
    const globalId = ifcStepParamText(params[0]);
    const name = ifcStepParamText(params[2]);
    const objectType = ifcStepParamText(params[4]);
    const tag = ifcStepParamText(params[7]);
    const predefinedType = ifcStepParamText(params[8]);
    const properties: MetricItem[] = [
      { label: "STEP编号", value: `#${expressID}` },
      { label: "IFC类型", value: `${chineseIfcType(type)} · ${type}` },
    ];

    const stepRows: Array<[string, string]> = [
      ["GlobalId", globalId],
      ["Name", name],
      ["ObjectType", objectType],
      ["Tag", tag],
      ["PredefinedType", predefinedType],
    ];
    stepRows.forEach(([label, value]) => {
      if (value) properties.push({ label, value });
    });

    const sourcePlacement = resolveIfcObjectPlacement(records, params[5]);
    elements.set(expressID, {
      expressID,
      sourceBound: true,
      type,
      globalId,
      name,
      objectType,
      tag,
      predefinedType,
      geometryUnit: lengthUnit,
      properties,
      ...(sourcePlacement ? { sourcePlacement } : {}),
    });
  }

  for (const [expressID, element] of elements) {
    if (element.sourcePlacement) continue;
    const record = records.get(expressID);
    if (!record) continue;
    const sourcePlacement = resolveIfcObjectPlacement(records, record.params[5]);
    if (sourcePlacement) element.sourcePlacement = sourcePlacement;
  }
  applyIfcStyledItemColors(records, elements);
  applyIfcRepresentationDimensions(records, elements, lengthUnit);
  applyIfcPropertyDefinitions(records, elements, lengthUnit);
  applyIfcTypeDefinitions(records, elements, lengthUnit);
  applyIfcMaterialAssociations(records, elements, lengthUnit);
  return elements;
}

function isIfcRenderableProductRecord(type: string, params: string[]): boolean {
  if (!type.startsWith("IFC") || type.endsWith("TYPE")) return false;
  if (
    type.startsWith("IFCREL") ||
    type.startsWith("IFCPROPERTY") ||
    type.startsWith("IFCQUANTITY") ||
    type.startsWith("IFCMATERIAL") ||
    type.startsWith("IFCSTYLE") ||
    type.startsWith("IFCSURFACE") ||
    type.startsWith("IFCCOLOUR") ||
    type.startsWith("IFCPRESENTATION") ||
    type.startsWith("IFCREPRESENTATION") ||
    type.startsWith("IFCSHAPE") ||
    type.startsWith("IFCPROFILE") ||
    type.startsWith("IFCCARTESIAN") ||
    type.startsWith("IFCAXIS") ||
    type.startsWith("IFCDIRECTION") ||
    type.startsWith("IFCLOCALPLACEMENT") ||
    type.startsWith("IFCUNIT") ||
    type.startsWith("IFCSIUNIT") ||
    type.startsWith("IFCMEASURE") ||
    type.startsWith("IFCDERIVED") ||
    type.startsWith("IFCOWNER") ||
    type.startsWith("IFCAPPLICATION") ||
    type.startsWith("IFCORGANIZATION") ||
    type.startsWith("IFCPERSON")
  ) {
    return false;
  }

  const globalId = params[0]?.trim() ?? "";
  const placement = params[5]?.trim() ?? "";
  const representation = params[6]?.trim() ?? "";
  const hasGlobalId = globalId.startsWith("'") && globalId.endsWith("'");
  const hasProductShapeSlots =
    (placement === "$" || /^#\d+$/.test(placement)) &&
    (representation === "$" || /^#\d+$/.test(representation));

  return hasGlobalId && hasProductShapeSlots;
}

type IfcGeometryDimensionSource =
  | "ifc-representation"
  | "ifc-quantity"
  | "mesh-bounds";

function applyIfcRepresentationDimensions(
  records: Map<number, IfcStepRecord>,
  elements: Map<number, IfcElementProperties>,
  lengthUnit: LengthDisplayUnit,
) {
  for (const [expressID, element] of elements) {
    const record = records.get(expressID);
    if (!record) continue;
    const dimensions = ifcDimensionsFromRepresentation(records, record.params[6]);
    if (dimensions) {
      mergeIfcElementDimensions(
        element,
        dimensions,
        lengthUnit,
        "ifc-representation",
      );
    }
  }
}

function applyIfcStyledItemColors(
  records: Map<number, IfcStepRecord>,
  elements: Map<number, IfcElementProperties>,
) {
  const styledItemColors = new Map<number, [number, number, number, number]>();
  for (const record of records.values()) {
    if (record.type !== "IFCSTYLEDITEM") continue;
    const styledItemId = ifcStepReferenceIds(record.params[0])[0];
    if (!styledItemId) continue;
    const color = ifcColorFromStyleAssignment(records, record.params[1]);
    if (color) styledItemColors.set(styledItemId, color);
  }

  if (!styledItemColors.size) return;

  for (const [expressID, element] of elements) {
    const record = records.get(expressID);
    if (!record) continue;
    const itemIds = collectIfcRepresentationItemIds(records, record.params[6]);
    const color = itemIds
      .map((itemId) => styledItemColors.get(itemId))
      .find((candidate): candidate is [number, number, number, number] =>
        Boolean(candidate),
      );
    if (!color) continue;
    element.styleColor = color;
    element.sourceColor = `${formatRgbColor([color[0], color[1], color[2]])} / alpha ${formatCoord(color[3])}`;
  }
}

function ifcColorFromStyleAssignment(
  records: Map<number, IfcStepRecord>,
  value: string | undefined,
  visited = new Set<number>(),
): [number, number, number, number] | null {
  const ids = ifcStepReferenceIds(value);
  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const record = records.get(id);
    if (!record) continue;

    if (record.type === "IFCCOLOURRGB") {
      const red = ifcStepNumericValue(record.params[1]);
      const green = ifcStepNumericValue(record.params[2]);
      const blue = ifcStepNumericValue(record.params[3]);
      if (red !== null && green !== null && blue !== null) {
        return [
          clampNumber(red, 0, 1),
          clampNumber(green, 0, 1),
          clampNumber(blue, 0, 1),
          1,
        ];
      }
    }

    if (
      record.type === "IFCSURFACESTYLERENDERING" ||
      record.type === "IFCSURFACESTYLESHADING"
    ) {
      const color = ifcColorFromStyleAssignment(records, record.params[0], visited);
      if (!color) continue;
      const alpha = ifcStepNumericValue(record.params[1]);
      return [
        color[0],
        color[1],
        color[2],
        alpha === null ? color[3] : clampNumber(1 - alpha, 0.08, 1),
      ];
    }

    const color = ifcColorFromStyleAssignment(
      records,
      record.params.join(","),
      visited,
    );
    if (color) return color;
  }

  return null;
}

function collectIfcRepresentationItemIds(
  records: Map<number, IfcStepRecord>,
  value: string | number | undefined,
  visited = new Set<number>(),
): number[] {
  const ids =
    typeof value === "number" ? [value] : ifcStepReferenceIds(value);
  const itemIds: number[] = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    itemIds.push(id);
    const record = records.get(id);
    if (!record) continue;
    record.params.forEach((param) => {
      itemIds.push(
        ...collectIfcRepresentationItemIds(records, param, visited),
      );
    });
  }

  return itemIds;
}

function ifcDimensionsFromRepresentation(
  records: Map<number, IfcStepRecord>,
  representationRef: string | undefined,
): Bounds3DPoint | null {
  const measures = collectIfcRepresentationMeasures(records, representationRef);
  return ifcMeasuresToSortedDimensions(measures);
}

function collectIfcRepresentationMeasures(
  records: Map<number, IfcStepRecord>,
  value: string | number | undefined,
  visited = new Set<number>(),
): number[] {
  const ids =
    typeof value === "number" ? [value] : ifcStepReferenceIds(value);
  const measures: number[] = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const record = records.get(id);
    if (!record) continue;

    switch (record.type) {
      case "IFCPRODUCTDEFINITIONSHAPE":
        measures.push(
          ...collectIfcRepresentationMeasures(records, record.params[2], visited),
        );
        break;
      case "IFCSHAPEREPRESENTATION":
        measures.push(
          ...collectIfcRepresentationMeasures(records, record.params[3], visited),
        );
        break;
      case "IFCREPRESENTATIONMAP":
        measures.push(
          ...collectIfcRepresentationMeasures(records, record.params[1], visited),
        );
        break;
      case "IFCMAPPEDITEM":
        measures.push(
          ...collectIfcRepresentationMeasures(records, record.params[0], visited),
        );
        break;
      case "IFCEXTRUDEDAREASOLID":
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[3]));
        measures.push(
          ...collectIfcRepresentationMeasures(records, record.params[0], visited),
        );
        break;
      case "IFCRECTANGLEPROFILEDEF":
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[3]));
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[4]));
        break;
      case "IFCCIRCLEPROFILEDEF": {
        const radius = ifcStepNumericValue(record.params[2]);
        if (radius !== null) pushIfcMeasure(measures, radius * 2);
        break;
      }
      case "IFCBLOCK":
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[1]));
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[2]));
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[3]));
        break;
      case "IFCRIGHTCIRCULARCYLINDER": {
        const radius = ifcStepNumericValue(record.params[1]);
        if (radius !== null) pushIfcMeasure(measures, radius * 2);
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[2]));
        break;
      }
      default:
        if (/^IFC[ICLTUZ]SHAPEPROFILEDEF$/.test(record.type)) {
          record.params.slice(3).forEach((param) => {
            pushIfcMeasure(measures, ifcStepNumericValue(param));
          });
        }
        break;
    }
  }

  return measures;
}

function pushIfcMeasure(measures: number[], value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return;
  measures.push(value);
}

function ifcMeasuresToSortedDimensions(values: number[]): Bounds3DPoint | null {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left);
  if (sorted.length < 3) return null;
  return { x: sorted[0] ?? 0, y: sorted[1] ?? 0, z: sorted[2] ?? 0 };
}

function applyIfcPropertyDefinitions(
  records: Map<number, IfcStepRecord>,
  elements: Map<number, IfcElementProperties>,
  lengthUnit: LengthDisplayUnit,
) {
  for (const relationship of records.values()) {
    if (relationship.type !== "IFCRELDEFINESBYPROPERTIES") continue;
    const relatedObjectIds = ifcStepReferenceIds(relationship.params[4]);
    const definitionId = ifcStepReferenceIds(relationship.params[5])[0];
    if (!definitionId) continue;
    const definition = records.get(definitionId);
    if (!definition) continue;
    const propertySetName = ifcStepParamText(definition.params[2]);
    const propertyIds =
      definition.type === "IFCELEMENTQUANTITY"
        ? ifcStepReferenceIds(definition.params[5])
        : ifcStepReferenceIds(definition.params[4]);
    if (!propertyIds.length) continue;

    for (const objectId of relatedObjectIds) {
      const element = elements.get(objectId);
      if (!element) continue;
      for (const propertyId of propertyIds) {
        const property = records.get(propertyId);
        if (!property) continue;
        applyIfcPropertyRecord(
          property,
          element,
          propertySetName,
          lengthUnit,
        );
      }
    }
  }
}

function applyIfcPropertyRecord(
  record: IfcStepRecord,
  element: IfcElementProperties,
  propertySetName: string,
  lengthUnit: LengthDisplayUnit,
) {
  const label = ifcStepParamText(record.params[0]);
  if (!label) return;
  const scopedLabel = propertySetName ? `${propertySetName}.${label}` : label;
  const rawValue =
    record.type === "IFCPROPERTYSINGLEVALUE"
      ? record.params[2]
      : record.params[3];
  const numericValue = ifcStepNumericValue(rawValue);
  const value = ifcStepValueText(rawValue, lengthUnit, isIfcLengthRecord(record));
  if (value) pushUniqueIfcProperty(element, scopedLabel, value);

  if (numericValue === null || !isIfcLengthRecord(record)) return;
  const axis = classifyIfcDimensionLabel(`${propertySetName}.${label}`);
  if (!axis) return;

  if (axis === "thickness") {
    const currentZ = element.geometryDimensions?.z ?? 0;
    if (currentZ > 0 && element.geometryDimensionSource?.z !== "mesh-bounds") {
      return;
    }
    mergeIfcElementDimensions(
      element,
      { x: 0, y: 0, z: numericValue },
      lengthUnit,
      "ifc-quantity",
    );
    return;
  }

  mergeIfcElementDimensions(
    element,
    {
      x: axis === "x" ? numericValue : 0,
      y: axis === "y" ? numericValue : 0,
      z: axis === "z" ? numericValue : 0,
    },
    lengthUnit,
    "ifc-quantity",
  );
}

function applyIfcTypeDefinitions(
  records: Map<number, IfcStepRecord>,
  elements: Map<number, IfcElementProperties>,
  lengthUnit: LengthDisplayUnit,
) {
  const occurrencesByType = buildIfcTypeOccurrenceMap(records);
  for (const [typeId, occurrenceIds] of occurrencesByType) {
    const typeRecord = records.get(typeId);
    if (!typeRecord) continue;
    const typeName = ifcStepParamText(typeRecord.params[2]);
    const typeTag = ifcStepParamText(typeRecord.params[7]);
    const typePredefined = typeRecord.params
      .slice()
      .reverse()
      .map((param) => ifcStepParamText(param))
      .find((value) => value && value !== "$" && !value.startsWith("#"));
    const typeDimensions = ifcDimensionsFromRepresentation(
      records,
      typeRecord.params[6],
    );
    const propertySetIds = ifcStepReferenceIds(typeRecord.params[5]);

    occurrenceIds.forEach((occurrenceId) => {
      const element = elements.get(occurrenceId);
      if (!element) return;
      pushUniqueIfcProperty(element, "Type.STEP编号", `#${typeId}`);
      if (typeName) pushUniqueIfcProperty(element, "Type.Name", typeName);
      if (typeTag) pushUniqueIfcProperty(element, "Type.Tag", typeTag);
      if (typePredefined) {
        pushUniqueIfcProperty(element, "Type.PredefinedType", typePredefined);
      }
      if (typeDimensions) {
        mergeIfcElementDimensions(
          element,
          typeDimensions,
          lengthUnit,
          "ifc-representation",
        );
      }

      propertySetIds.forEach((propertySetId) => {
        const definition = records.get(propertySetId);
        if (!definition) return;
        const propertySetName = ifcStepParamText(definition.params[2]);
        const propertyIds =
          definition.type === "IFCELEMENTQUANTITY"
            ? ifcStepReferenceIds(definition.params[5])
            : ifcStepReferenceIds(definition.params[4]);
        propertyIds.forEach((propertyId) => {
          const property = records.get(propertyId);
          if (!property) return;
          applyIfcPropertyRecord(property, element, propertySetName, lengthUnit);
        });
      });
    });
  }
}

function buildIfcTypeOccurrenceMap(
  records: Map<number, IfcStepRecord>,
): Map<number, number[]> {
  const occurrencesByType = new Map<number, number[]>();
  for (const relationship of records.values()) {
    if (relationship.type !== "IFCRELDEFINESBYTYPE") continue;
    const occurrenceIds = ifcStepReferenceIds(relationship.params[4]);
    const typeId = ifcStepReferenceIds(relationship.params[5])[0];
    if (!typeId || !occurrenceIds.length) continue;
    const existing = occurrencesByType.get(typeId) ?? [];
    existing.push(...occurrenceIds);
    occurrencesByType.set(typeId, existing);
  }
  return occurrencesByType;
}

function applyIfcMaterialAssociations(
  records: Map<number, IfcStepRecord>,
  elements: Map<number, IfcElementProperties>,
  lengthUnit: LengthDisplayUnit,
) {
  const occurrencesByType = buildIfcTypeOccurrenceMap(records);
  for (const relationship of records.values()) {
    if (relationship.type !== "IFCRELASSOCIATESMATERIAL") continue;
    const relatedObjectIds = ifcStepReferenceIds(relationship.params[4]);
    const materialId = ifcStepReferenceIds(relationship.params[5])[0];
    if (!materialId || !relatedObjectIds.length) continue;
    const material = resolveIfcMaterial(records, materialId, lengthUnit);
    if (!material) continue;

    relatedObjectIds.forEach((relatedObjectId) => {
      const occurrenceIds = elements.has(relatedObjectId)
        ? [relatedObjectId]
        : occurrencesByType.get(relatedObjectId) ?? [];
      occurrenceIds.forEach((occurrenceId) => {
        const element = elements.get(occurrenceId);
        if (!element) return;
        pushUniqueIfcProperty(element, "Material", material.name);
        material.details.forEach((detail, index) => {
          pushUniqueIfcProperty(element, `Material.${index + 1}`, detail);
        });
      });
    });
  }
}

interface IfcMaterialResolution {
  name: string;
  details: string[];
}

function resolveIfcMaterial(
  records: Map<number, IfcStepRecord>,
  materialRef: string | number | undefined,
  lengthUnit: LengthDisplayUnit,
  visited = new Set<number>(),
): IfcMaterialResolution | null {
  const materialId =
    typeof materialRef === "number"
      ? materialRef
      : ifcStepReferenceIds(materialRef)[0];
  if (!materialId || visited.has(materialId)) return null;
  visited.add(materialId);
  const record = records.get(materialId);
  if (!record) return null;

  switch (record.type) {
    case "IFCMATERIAL":
      return materialResolutionFromName(ifcStepParamText(record.params[0]));
    case "IFCMATERIALLAYER": {
      const material = resolveIfcMaterial(records, record.params[0], lengthUnit, visited);
      const layerName = meaningfulIfcLabel(record.params[3]);
      const thickness = ifcStepNumericValue(record.params[1]);
      const details = [...(material?.details ?? [])];
      if (thickness !== null) {
        details.push(`LayerThickness ${formatLength(thickness, lengthUnit)}`);
      }
      const name = material?.name || layerName;
      return name ? { name, details } : null;
    }
    case "IFCMATERIALLAYERSET": {
      const setName = meaningfulIfcLabel(record.params[1]);
      const layers = ifcStepReferenceIds(record.params[0])
        .map((layerId) => resolveIfcMaterial(records, layerId, lengthUnit, visited))
        .filter((layer): layer is IfcMaterialResolution => Boolean(layer));
      const details = layers.flatMap((layer) => [
        layer.name,
        ...layer.details,
      ]);
      const name =
        setName ||
        layers
          .map((layer) => layer.name)
          .filter(Boolean)
          .join(" / ");
      return name ? { name, details } : null;
    }
    case "IFCMATERIALLAYERSETUSAGE":
      return resolveIfcMaterial(records, record.params[0], lengthUnit, visited);
    case "IFCMATERIALLIST": {
      const materials = ifcStepReferenceIds(record.params[0])
        .map((id) => resolveIfcMaterial(records, id, lengthUnit, visited))
        .filter((material): material is IfcMaterialResolution => Boolean(material));
      const name = materials.map((material) => material.name).join(" / ");
      return name
        ? { name, details: materials.flatMap((material) => material.details) }
        : null;
    }
    case "IFCMATERIALPROFILE":
    case "IFCMATERIALCONSTITUENT": {
      const ownName = meaningfulIfcLabel(record.params[0]);
      const nested = record.params
        .map((param) => resolveIfcMaterial(records, param, lengthUnit, visited))
        .find((material): material is IfcMaterialResolution => Boolean(material));
      const name = ownName || nested?.name;
      return name ? { name, details: nested?.details ?? [] } : null;
    }
    case "IFCMATERIALPROFILESET":
    case "IFCMATERIALCONSTITUENTSET": {
      const setName = meaningfulIfcLabel(record.params[0]);
      const nestedMaterials = record.params
        .flatMap((param) => ifcStepReferenceIds(param))
        .map((id) => resolveIfcMaterial(records, id, lengthUnit, visited))
        .filter((material): material is IfcMaterialResolution => Boolean(material));
      const name =
        setName ||
        nestedMaterials
          .map((material) => material.name)
          .filter(Boolean)
          .join(" / ");
      return name
        ? {
            name,
            details: nestedMaterials.flatMap((material) => [
              material.name,
              ...material.details,
            ]),
          }
        : null;
    }
    default: {
      const label = record.params
        .map((param) => meaningfulIfcLabel(param))
        .find(Boolean);
      return label ? { name: label, details: [] } : null;
    }
  }
}

function materialResolutionFromName(name: string): IfcMaterialResolution | null {
  const label = meaningfulIfcText(name);
  return label ? { name: label, details: [] } : null;
}

function meaningfulIfcLabel(value: string | undefined): string {
  return meaningfulIfcText(ifcStepParamText(value));
}

function meaningfulIfcText(value: string | undefined): string {
  const text = decodeEngineeringText(value ?? "").trim();
  if (!text) return "";
  if (/^<?\s*unnamed\s*>?$/i.test(text)) return "";
  if (/^<?\s*unknown\s*>?$/i.test(text)) return "";
  if (/^[$*]$/.test(text)) return "";
  return text;
}

function resolveIfcObjectPlacement(
  records: Map<number, IfcStepRecord>,
  placementRef: string | undefined,
  visited = new Set<number>(),
): Bounds3DPoint | null {
  const placementId = ifcStepReferenceIds(placementRef)[0];
  if (!placementId || visited.has(placementId)) return null;
  visited.add(placementId);
  const placement = records.get(placementId);
  if (!placement) return null;

  if (placement.type !== "IFCLOCALPLACEMENT") {
    return resolveIfcAxisPlacementLocation(records, `#${placementId}`);
  }

  const parent = resolveIfcObjectPlacement(records, placement.params[0], visited);
  const relative = resolveIfcAxisPlacementLocation(records, placement.params[1]);
  if (parent && relative) return addBounds3DPoint(parent, relative);
  return relative ?? parent;
}

function resolveIfcAxisPlacementLocation(
  records: Map<number, IfcStepRecord>,
  axisPlacementRef: string | undefined,
): Bounds3DPoint | null {
  const axisPlacementId = ifcStepReferenceIds(axisPlacementRef)[0];
  if (!axisPlacementId) return null;
  const axisPlacement = records.get(axisPlacementId);
  if (!axisPlacement) return null;
  if (
    axisPlacement.type !== "IFCAXIS2PLACEMENT3D" &&
    axisPlacement.type !== "IFCAXIS2PLACEMENT2D"
  ) {
    return null;
  }
  return resolveIfcCartesianPoint(records, axisPlacement.params[0]);
}

function resolveIfcCartesianPoint(
  records: Map<number, IfcStepRecord>,
  pointRef: string | undefined,
): Bounds3DPoint | null {
  const pointId = ifcStepReferenceIds(pointRef)[0];
  if (!pointId) return null;
  const point = records.get(pointId);
  if (point?.type !== "IFCCARTESIANPOINT") return null;
  const coordinates = ifcStepNumericList(point.params[0]);
  if (coordinates.length < 2) return null;
  return {
    x: coordinates[0] ?? 0,
    y: coordinates[1] ?? 0,
    z: coordinates[2] ?? 0,
  };
}

function ifcStepNumericList(value: string | undefined): number[] {
  if (!value) return [];
  return Array.from(value.matchAll(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/g))
    .map((match) => Number.parseFloat(match[0]))
    .filter((number) => Number.isFinite(number));
}

function addBounds3DPoint(
  left: Bounds3DPoint,
  right: Bounds3DPoint,
): Bounds3DPoint {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function isIfcLengthRecord(record: IfcStepRecord): boolean {
  if (record.type === "IFCQUANTITYLENGTH") return true;
  if (record.type !== "IFCPROPERTYSINGLEVALUE") return false;
  return /LENGTHMEASURE|COUNTMEASURE|RATIOMEASURE|INTEGER|REAL/i.test(
    record.params[2] ?? "",
  );
}

function pushUniqueIfcProperty(
  element: IfcElementProperties,
  label: string,
  value: string,
) {
  const fingerprint = `${label}:${value}`.toLowerCase();
  const exists = element.properties.some(
    (property) =>
      `${property.label}:${property.value}`.toLowerCase() === fingerprint,
  );
  if (!exists) element.properties.push({ label, value });
}

function mergeIfcElementDimensions(
  element: IfcElementProperties,
  dimensions: Partial<Bounds3DPoint>,
  lengthUnit: LengthDisplayUnit,
  source: IfcGeometryDimensionSource,
) {
  const next = {
    x: element.geometryDimensions?.x ?? 0,
    y: element.geometryDimensions?.y ?? 0,
    z: element.geometryDimensions?.z ?? 0,
  };
  const sourceMap = { ...(element.geometryDimensionSource ?? {}) };
  let changed = false;

  (["x", "y", "z"] as Array<keyof Bounds3DPoint>).forEach((axis) => {
    const value = dimensions[axis];
    if (!Number.isFinite(value) || (value ?? 0) <= 0) return;
    const existing = next[axis];
    const currentSource = sourceMap[axis];
    const shouldReplace =
      !Number.isFinite(existing) ||
      existing <= 0 ||
      currentSource === "mesh-bounds" ||
      (source !== "mesh-bounds" && (value ?? 0) > existing * 1.05) ||
      (source === "mesh-bounds" && !currentSource);
    if (!shouldReplace) return;
    next[axis] = value ?? 0;
    sourceMap[axis] = source;
    changed = true;
  });

  if (!changed) return;
  element.geometryDimensions = next;
  element.geometryUnit = lengthUnit;
  element.geometryDimensionSource = sourceMap;
  const sources = new Set(Object.values(sourceMap).filter(Boolean));
  const [firstSource] = Array.from(sources) as IfcGeometryDimensionSource[];
  if (sources.size > 1) {
    element.geometrySource = "mixed";
  } else if (firstSource) {
    element.geometrySource = firstSource;
  }
}

function ifcStepReferenceIds(value: string | undefined): number[] {
  if (!value) return [];
  return Array.from(value.matchAll(/#(\d+)/g))
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((id) => Number.isFinite(id));
}

function ifcStepNumericValue(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "$" || trimmed === "*") return null;
  const typed = trimmed.match(/^[A-Z0-9_]+\(([\s\S]*)\)$/i);
  const candidate = typed ? typed[1] : trimmed;
  const numeric = candidate?.match(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/);
  if (!numeric) return null;
  const parsed = Number.parseFloat(numeric[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function ifcStepValueText(
  value: string | undefined,
  unit: LengthDisplayUnit,
  isLength = false,
): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "$" || trimmed === "*") return "";
  const typed = trimmed.match(/^[A-Z0-9_]+\(([\s\S]*)\)$/i);
  const inner = typed?.[1];
  if (inner) {
    const text = ifcStepParamText(inner);
    if (text && text !== inner) return text;
  }
  const numeric = ifcStepNumericValue(trimmed);
  if (numeric !== null) return isLength ? formatLength(numeric, unit) : `${numeric}`;
  return ifcStepParamText(trimmed);
}

function classifyIfcDimensionLabel(
  value: string,
): keyof Bounds3DPoint | "thickness" | null {
  const normalized = value.toLowerCase().replace(/[\s_().:-]+/g, "");
  if (/overalllength|nominallength|grosslength|length|xdim|xsize|x尺寸|长度|长/.test(normalized)) {
    return "x";
  }
  if (/overallwidth|nominalwidth|grosswidth|width|ydim|ysize|y尺寸|宽度|宽/.test(normalized)) {
    return "y";
  }
  if (/overallheight|nominalheight|grossheight|height|zdim|zsize|z尺寸|高度|高/.test(normalized)) {
    return "z";
  }
  if (/thickness|depth|厚度|厚/.test(normalized)) {
    return "thickness";
  }
  return null;
}

function splitIfcStepParams(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    const next = value[index + 1] ?? "";
    if (char === "'") {
      current += char;
      if (inString && next === "'") {
        current += next;
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "(") depth += 1;
      if (char === ")") depth = Math.max(0, depth - 1);
      if (char === "," && depth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }

  if (current.trim() || value.endsWith(",")) result.push(current.trim());
  return result;
}

function ifcStepParamText(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "$" || trimmed === "*") return "";
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return decodeEngineeringText(trimmed.slice(1, -1).replace(/''/g, "'"));
  }
  if (/^\.[A-Z0-9_]+\.$/i.test(trimmed)) return trimmed.slice(1, -1);
  if (/^#\d+$/.test(trimmed)) return trimmed;
  return decodeEngineeringText(trimmed);
}

function ensureIfcLiteElement(
  elements: Map<number, IfcElementProperties>,
  expressID: number,
  type = "IFCENTITY",
): IfcElementProperties {
  const existing = elements.get(expressID);
  if (existing) {
    if ((!existing.type || existing.type === "IFCENTITY") && type) {
      existing.type = type;
    }
    return existing;
  }

  const element: IfcElementProperties = {
    expressID,
    sourceBound: false,
    type,
    globalId: "",
    name: "",
    objectType: "",
    tag: "",
    predefinedType: "",
    properties: [
      { label: "STEP编号", value: `#${expressID}` },
      { label: "IFC类型", value: `${chineseIfcType(type)} · ${type}` },
    ],
  };
  elements.set(expressID, element);
  return element;
}

function sortedIfcLiteElements(
  elements: Map<number, IfcElementProperties>,
): IfcElementProperties[] {
  return Array.from(elements.values()).sort(
    (left, right) => left.expressID - right.expressID,
  );
}

function updateIfcLiteElementMetadata(
  elements: Map<number, IfcElementProperties>,
  mesh: IfcLiteStreamingBatch,
): IfcElementProperties {
  const type = mesh.ifcType ?? "IFCENTITY";
  const element = ensureIfcLiteElement(elements, mesh.expressId, type);
  if (!element.styleColor) {
    const color = normalizeIfcLiteColor(mesh.color);
    element.sourceColor = `${formatRgbColor([color[0], color[1], color[2]])} / alpha ${formatCoord(color[3])}`;
  }
  return element;
}

function includeIfcLiteElementMeshStats(
  element: IfcElementProperties | undefined,
  mesh: IfcLiteStreamingBatch,
) {
  if (!element) return;
  element.geometryMeshCount = (element.geometryMeshCount ?? 0) + 1;
  element.geometryVertexCount =
    (element.geometryVertexCount ?? 0) + Math.floor(mesh.positions.length / 3);
  element.geometryTriangleCount =
    (element.geometryTriangleCount ?? 0) + Math.floor(mesh.indices.length / 3);
}

function includeIfcLiteMeshBounds(
  elementBounds: Map<number, Bounds3D>,
  elements: Map<number, IfcElementProperties>,
  mesh: IfcLiteStreamingBatch,
  lengthUnit: LengthDisplayUnit,
) {
  const positions = mesh.positions;
  const vertexCount = Math.floor(positions.length / 3);
  const ids =
    mesh.entityIds && mesh.entityIds.length === vertexCount
      ? mesh.entityIds
      : null;
  const touchedIds = new Set<number>();

  for (let index = 0; index < vertexCount; index += 1) {
    const expressID = ids?.[index] ?? mesh.expressId;
    if (!expressID) continue;
    touchedIds.add(expressID);
    const x = ifcLiteMetersToProjectUnit(positions[index * 3] ?? 0, lengthUnit);
    const y = ifcLiteMetersToProjectUnit(
      positions[index * 3 + 1] ?? 0,
      lengthUnit,
    );
    const z = ifcLiteMetersToProjectUnit(
      positions[index * 3 + 2] ?? 0,
      lengthUnit,
    );
    const bounds = elementBounds.get(expressID) ?? emptyBounds3D();
    expandBounds3D(bounds, x, y, z);
    elementBounds.set(expressID, bounds);
  }

  for (const expressID of touchedIds) {
    const bounds = elementBounds.get(expressID);
    if (!bounds) continue;
    const element = ensureIfcLiteElement(elements, expressID);
    const safeBounds = normalizeBounds3D(bounds);
    element.geometryBounds = safeBounds;
    if (element.sourceBound) {
      element.geometryUnit = lengthUnit;
      const center = boundsCenter(safeBounds);
      if (center) element.geometryCenter = center;
    }
  }
}

function emptyBounds3D(): Bounds3D {
  return {
    min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
    max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
  };
}

function expandBounds3D(bounds: Bounds3D, x: number, y: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  bounds.min.x = Math.min(bounds.min.x, x);
  bounds.min.y = Math.min(bounds.min.y, y);
  bounds.min.z = Math.min(bounds.min.z, z);
  bounds.max.x = Math.max(bounds.max.x, x);
  bounds.max.y = Math.max(bounds.max.y, y);
  bounds.max.z = Math.max(bounds.max.z, z);
}

function normalizeBounds3D(bounds: Bounds3D): Bounds3D {
  const finite =
    Number.isFinite(bounds.min.x) &&
    Number.isFinite(bounds.min.y) &&
    Number.isFinite(bounds.min.z) &&
    Number.isFinite(bounds.max.x) &&
    Number.isFinite(bounds.max.y) &&
    Number.isFinite(bounds.max.z);
  if (finite) return bounds;
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
  };
}

function displayIfcElementName(element: IfcElementProperties): string {
  return decodeEngineeringText(
    element.name ||
      element.tag ||
      element.objectType ||
      chineseIfcType(element.type) ||
      `#${element.expressID}`,
  );
}

function ifcGeometrySourceLabel(element: IfcElementProperties): string {
  if (!element.sourceBound) {
    return "Prengine 渲染构件，未绑定源 IFC STEP 几何属性";
  }
  switch (element.geometrySource) {
    case "ifc-representation":
      return "IFC 几何表达";
    case "ifc-quantity":
      return "IFC 属性/数量集";
    case "mesh-bounds":
      return "仅有可视化边界，未作为清单尺寸";
    case "mixed":
      return "IFC 属性/几何表达";
    default:
      return "待解析";
  }
}

function formatIfcElementGeometryStats(
  element: IfcElementProperties,
  preview: Pick<IfcLiteNativePreview, "loadedMeshes" | "totalTriangles">,
): string {
  const meshCount = element.geometryMeshCount ?? 0;
  const triangleCount = element.geometryTriangleCount ?? 0;
  if (meshCount > 0 || triangleCount > 0) {
    return `${meshCount.toLocaleString()} meshes / ${triangleCount.toLocaleString()} faces`;
  }
  return `${preview.loadedMeshes.toLocaleString()} meshes / ${preview.totalTriangles.toLocaleString()} faces（模型总计）`;
}

function buildIfcLiteElementPropertyRows(
  file: ModuleFileNode,
  preview: IfcLiteNativePreview,
  selected: IfcElementProperties,
): IfcPropertyRow[] {
  const defaultPending = "待绑定属性索引";
  const geometryUnit = selected.geometryUnit ?? preview.lengthUnit;
  const geometryDimensions = reliableIfcElementDimensions(selected);
  const sourcePosition = selected.sourceBound
    ? selected.sourcePlacement ?? selected.geometryCenter ?? null
    : null;
  const rows: IfcPropertyRow[] = [
    { key: "uploadTemplate", label: "上传模板", value: "BOM/属性模板可上传" },
    { key: "exportList", label: "导出清单", value: "选中构件 / 整模 BOM" },
    { key: "version", label: "所属版本", value: file.version || "v1.0" },
    { key: "uploadedAt", label: "上传时间", value: formatDisplayTime(file.updatedAt) },
    {
      key: "componentId",
      label: "构件ID",
      value: selected.globalId || `#${selected.expressID}`,
    },
    { key: "name", label: "名称", value: displayIfcElementName(selected), editable: true },
    {
      key: "objectType",
      label: "对象类型",
      value: decodeEngineeringText(selected.objectType || selected.type),
      editable: true,
    },
    {
      key: "ifcType",
      label: "IFC类型",
      value: `${chineseIfcType(selected.type)} · ${selected.type}`,
    },
    { key: "tag", label: "构件标记", value: decodeEngineeringText(selected.tag || defaultPending), editable: true },
    {
      key: "predefinedType",
      label: "预定义类型",
      value: decodeEngineeringText(selected.predefinedType || defaultPending),
      editable: true,
    },
    {
      key: "dimensions",
      label: `三维尺寸（${geometryUnit.label}）`,
      value: selected.sourceBound
        ? formatDimensionVector(geometryDimensions, geometryUnit)
        : "待绑定源 IFC 构件属性",
    },
    {
      key: "dimensionSource",
      label: "尺寸来源",
      value: ifcGeometrySourceLabel(selected),
    },
    {
      key: "sizeX",
      label: `长度（${geometryUnit.label}）`,
      value: geometryDimensions
        ? formatLength(geometryDimensions.x, geometryUnit)
        : "待解析",
    },
    {
      key: "sizeY",
      label: `宽度（${geometryUnit.label}）`,
      value: geometryDimensions
        ? formatLength(geometryDimensions.y, geometryUnit)
        : "待解析",
    },
    {
      key: "sizeZ",
      label: `高度（${geometryUnit.label}）`,
      value: geometryDimensions
        ? formatLength(geometryDimensions.z, geometryUnit)
        : "待解析",
    },
    {
      key: "coordinates",
      label: `对象定位（${geometryUnit.label}）`,
      value: selected.sourceBound
        ? formatPointVector(sourcePosition, geometryUnit)
        : "待绑定源 IFC 构件坐标",
    },
    {
      key: "geometry",
      label: "几何表达",
      value: formatIfcElementGeometryStats(selected, preview),
    },
    {
      key: "material",
      label: "材质",
      value: propertyValueFromElement(selected, ["Material", "材料", "材质"], defaultPending),
      editable: true,
    },
    {
      key: "sourceColor",
      label: "源文件颜色",
      value: selected.sourceColor ?? defaultPending,
    },
    {
      key: "route",
      label: "查看链路",
      value: `${prengineLabel} · IFC 原生源文件`,
    },
  ];
  const fingerprints = new Set(
    rows.map((row) => `${row.label}:${row.value}`.toLowerCase()),
  );
  selected.properties.forEach((property, index) => {
    if (DEPRECATED_ENGINEERING_ROLE_LABELS.has(property.label)) return;
    const label = decodeEngineeringText(property.label);
    const value = decodeEngineeringText(property.value);
    if (!label || !value) return;
    const fingerprint = `${label}:${value}`.toLowerCase();
    if (fingerprints.has(fingerprint)) return;
    fingerprints.add(fingerprint);
    rows.push({
      key: `source:${index}:${label}`,
      label,
      value,
      editable: true,
    });
  });
  return rows;
}

function startIfcLiteRenderLoop(
  renderer: IfcLiteRendererHandle,
  selectedRef: { current: number | null },
  streamingRef: { current: boolean },
): () => void {
  let frameId = 0;
  let previous = performance.now();

  function tick(now: number) {
    const deltaSeconds = Math.min((now - previous) / 1000, 0.08);
    previous = now;
    const moving = renderer.getCamera().update(deltaSeconds);
    if (moving || renderer.consumeRenderRequest()) {
      renderer.render({
        selectedId: selectedRef.current,
        isStreaming: streamingRef.current,
      });
    }
    frameId = requestAnimationFrame(tick);
  }

  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}

function bindIfcLiteCanvasControls(
  canvas: HTMLCanvasElement,
  renderer: IfcLiteRendererHandle,
  selectedRef: { current: number | null },
  streamingRef: { current: boolean },
  onSelect: (expressID: number | null) => void,
): () => void {
  let pointer: IfcLitePointerState | null = null;

  function renderCurrent() {
    renderer.render({
      selectedId: selectedRef.current,
      isStreaming: streamingRef.current,
    });
  }

  function handlePointerDown(event: PointerEvent) {
    const mode = event.button === 1 || event.button === 2 || event.shiftKey
      ? "pan"
      : "orbit";
    pointer = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      button: event.button,
      mode,
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointer) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const camera = renderer.getCamera();
    if (pointer.mode === "pan") {
      camera.pan(deltaX * ifcLitePanSensitivity, deltaY * ifcLitePanSensitivity, true);
    } else {
      camera.orbit(
        deltaX * ifcLiteOrbitSensitivity,
        deltaY * ifcLiteOrbitSensitivity,
        true,
      );
    }
    renderer.requestRender();
  }

  function handlePointerUp(event: PointerEvent) {
    if (!pointer) return;
    const activePointer = pointer;
    pointer = null;
    canvas.releasePointerCapture(event.pointerId);
    const moved =
      Math.hypot(
        event.clientX - activePointer.startX,
        event.clientY - activePointer.startY,
      ) > 4;
    if (moved || activePointer.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    void renderer
      .pick(event.clientX - rect.left, event.clientY - rect.top, {
        isStreaming: streamingRef.current,
      })
      .then((hit) => {
        const expressID = hit?.expressId ?? null;
        selectedRef.current = expressID;
        onSelect(expressID);
        renderCurrent();
      });
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    renderer.getCamera().zoom(
      event.deltaY * ifcLiteWheelSensitivity,
      true,
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      event.ctrlKey,
    );
    renderer.requestRender();
  }

  function handleResize() {
    const rect = canvas.getBoundingClientRect();
    renderer.resize(
      Math.max(64, Math.floor(rect.width)),
      Math.max(1, Math.floor(rect.height)),
    );
    renderCurrent();
  }

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(canvas);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  handleResize();

  return () => {
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerup", handlePointerUp);
    canvas.removeEventListener("pointercancel", handlePointerUp);
    canvas.removeEventListener("wheel", handleWheel);
  };
}

function handleIfcLiteKeyDown(
  event: KeyboardEvent<HTMLElement>,
  renderer: IfcLiteRendererHandle | null,
  selectedRef: { current: number | null },
  streamingRef: { current: boolean },
) {
  if (!renderer) return;
  const movementStep = event.shiftKey ? 320 : 120;
  const zoomStep = event.shiftKey ? 128 : 48;
  let handled = true;
  const key = event.key.toLowerCase();

  switch (key) {
    case "arrowup":
      applyIfcLiteAxisAction(
        "up",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    case "arrowdown":
      applyIfcLiteAxisAction(
        "down",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    case "arrowleft":
    case "a":
      applyIfcLiteAxisAction(
        "left",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    case "arrowright":
    case "d":
      applyIfcLiteAxisAction(
        "right",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    case "+":
    case "=":
      zoomIfcLiteCamera(renderer, selectedRef, streamingRef, "in", zoomStep);
      break;
    case "-":
    case "_":
      zoomIfcLiteCamera(renderer, selectedRef, streamingRef, "out", zoomStep);
      break;
    case "w":
    case "pageup":
      applyIfcLiteAxisAction(
        "front",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    case "s":
    case "pagedown":
      applyIfcLiteAxisAction(
        "back",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    case "r":
      applyIfcLiteAxisAction(
        "reset",
        renderer,
        selectedRef,
        streamingRef,
        movementStep,
      );
      break;
    default:
      handled = false;
  }

  if (!handled) return;
  event.preventDefault();
  event.stopPropagation();
}

function zoomIfcLiteCamera(
  renderer: IfcLiteRendererHandle,
  selectedRef: { current: number | null },
  streamingRef: { current: boolean },
  direction: "in" | "out",
  step = 18,
) {
  const camera = renderer.getCamera();
  camera.zoom(
    direction === "in" ? -step : step,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    true,
  );
  renderer.render({
    selectedId: selectedRef.current,
    isStreaming: streamingRef.current,
  });
}

function ifcLiteCameraStep(
  renderer: IfcLiteRendererHandle,
  requestedStep: number,
): number {
  const dimensions = boundsDimensions(renderer.getModelBounds?.() ?? null);
  const maxDimension = dimensions
    ? Math.max(dimensions.x, dimensions.y, dimensions.z)
    : 0;
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    return Math.max(12, requestedStep / 2);
  }
  const requestedScale = Math.max(0.25, requestedStep / 60);
  return Math.max(maxDimension * 0.22 * requestedScale, 12);
}

function translateIfcLiteCamera(
  renderer: IfcLiteRendererHandle,
  selectedRef: { current: number | null },
  streamingRef: { current: boolean },
  delta: Bounds3DPoint,
) {
  const camera = renderer.getCamera();
  const position = camera.getPosition?.();
  const target = camera.getTarget?.();
  if (!position || !target || !camera.setPosition || !camera.setTarget) {
    camera.pan(-delta.x, delta.y, true);
    renderer.render({
      selectedId: selectedRef.current,
      isStreaming: streamingRef.current,
    });
    return;
  }
  camera.stopInertia?.();
  camera.setPosition(
    position.x + delta.x,
    position.y + delta.y,
    position.z + delta.z,
  );
  camera.setTarget(target.x + delta.x, target.y + delta.y, target.z + delta.z);
  renderer.render({
    selectedId: selectedRef.current,
    isStreaming: streamingRef.current,
  });
}

function applyIfcLiteAxisAction(
  action: ModelAxisAction,
  renderer: IfcLiteRendererHandle | null,
  selectedRef: { current: number | null },
  streamingRef: { current: boolean },
  step = 120,
) {
  if (!renderer) return;
  const moveStep = ifcLiteCameraStep(renderer, step);
  if (action === "reset") {
    renderer.fitToView();
    renderer.render({
      selectedId: selectedRef.current,
      isStreaming: streamingRef.current,
    });
    return;
  }

  const movementByAction: Record<Exclude<ModelAxisAction, "reset">, Bounds3DPoint> = {
    left: { x: -moveStep, y: 0, z: 0 },
    right: { x: moveStep, y: 0, z: 0 },
    up: { x: 0, y: 0, z: moveStep },
    down: { x: 0, y: 0, z: -moveStep },
    front: { x: 0, y: -moveStep, z: 0 },
    back: { x: 0, y: moveStep, z: 0 },
  };
  translateIfcLiteCamera(
    renderer,
    selectedRef,
    streamingRef,
    movementByAction[action],
  );
}

function ifcNativeAdapterOrder(): IfcDerivativeClientAdapter[] {
  return [
    {
      id: "ifc-lite-webgpu",
      label: `${prengineLabel} IFC 查看器`,
      priority: 10,
      role: "primary",
      capability: "ifc_lite_viewer",
      status: "available",
      installHint:
        "IFC 源文件通过 Prengine 原生路径流式解析并显示，不经过自动 OpenUSD/3D Tiles/GLB 派生。",
    },
    {
      id: "ifc-lite-three-fallback",
      label: `${prengineLabel} IFC 兼容查看`,
      priority: 15,
      role: "fallback",
      capability: "ifc_lite_viewer",
      status: "available",
      installHint:
        "浏览器未启用 WebGPU 时仍使用 Prengine 源 IFC 解析显示；不触发 OpenUSD/3D Tiles/GLB 兜底派生。",
    },
    {
      id: "thatopen-fragments-service",
      label: `${prengineLabel} IFC 缓存服务`,
      priority: 20,
      role: "fallback",
      capability: "fragments_derivative",
      status: "unknown",
      installHint:
        "可作为后续预转换缓存，但不替代原生 IFC 源文件打开入口。",
    },
    {
      id: "ifcopenshell-ifcconvert",
      label: `${prengineLabel} IFC 后台校验`,
      priority: 30,
      role: "worker_fallback",
      capability: "openusd_derivative",
      status: "unknown",
      installHint:
        "保留为 OpenUSD/USDZ 派生链路，不在原生 IFC 打开时自动触发。",
    },
  ];
}

function adapterRoleLabel(role: string): string {
  if (role === "primary") return "主链路";
  if (role === "diagnostic") return "诊断后备";
  if (role === "worker_fallback") return "后台后备";
  return "后备";
}

function adapterCapabilityLabel(capability: string): string {
  if (capability === "native_ifc_viewer") return "Prengine 查看";
  if (capability === "ifc_lite_viewer") return "Prengine 查看";
  if (capability === "openusd_derivative") return "OpenUSD 派生";
  if (capability === "tiles3d_derivative") return "Prengine 后台派生";
  if (capability === "glb_derivative") return "Prengine 后台派生";
  if (capability === "properties_worker") return "属性索引";
  if (capability === "fragments_derivative") return "Prengine 缓存";
  return "隔离查看";
}

function adapterStatusLabel(status: string): string {
  if (status === "available") return "已构建";
  if (status === "configured_service") return "已配置";
  if (status === "missing") return "未配置";
  return "待确认";
}

/** @deprecated IFC source viewing is disabled; use IfcOpenShell derivatives instead. */
export function IfcWasmViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [state, setState] = useState<LoadState<IfcSummary>>({
    status: "loading",
    message: "正在加载 Prengine IFC 模型...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadIfc() {
      setState({
        status: "loading",
        message: "正在加载 Prengine IFC 模型...",
      });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`读取 IFC 失败: HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const lengthUnit = inferIfcLengthDisplayUnit(bytes);
        const ifc = await import("web-ifc");
        const api = new ifc.IfcAPI();
        await api.Init((path) => `/wasm/web-ifc/${path}`, true);
        const modelID = api.OpenModel(bytes, {
          COORDINATE_TO_ORIGIN: false,
          CIRCLE_SEGMENTS: 16,
        });

        if (modelID < 0) {
          api.Dispose();
          throw new Error("Prengine 无法打开该 IFC 文件。");
        }

        const group = buildIfcGroup(api, modelID, lengthUnit);
        activeGroup = group.group;
        const summary: IfcSummary = {
          schema: api.GetModelSchema(modelID),
          totalLines: api.GetAllLines(modelID).size(),
          totalMeshes: group.totalMeshes,
          renderedFragments: group.renderedFragments,
          truncated: group.truncated,
          nativeBounds: boxToSerializableBounds(group.nativeBounds),
          renderOffset: vectorToSerializablePoint(group.renderOffset),
          lengthUnit,
          upAxis: group.upAxis,
          topTypes: buildIfcTopTypes(api, modelID),
          keyCounts: buildIfcKeyCounts(ifc, api, modelID),
          elements: group.elements,
          group: group.group,
        };

        api.CloseModel(modelID);
        api.Dispose();

        if (!cancelled) {
          setState({ status: "ready", value: summary });
        } else if (group.group) {
          disposeGroup(group.group);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadIfc();

    return () => {
      cancelled = true;
      if (activeGroup) disposeGroup(activeGroup);
    };
  }, [sourceUrl]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="IFC 解析失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const summary = state.value;

  return (
    <>
      {summary.group ? (
        <IfcInspectionWorkbench file={file} summary={summary} />
      ) : (
        <AdapterRequiredPanel
          title="IFC 已解析，但未生成几何"
          file={file}
          reason="Prengine 能读取该文件的实体数据，但该模型没有可流式输出的几何，或几何被源文件省略。"
        />
      )}
    </>
  );
}

function IfcInspectionWorkbench({
  file,
  summary,
}: {
  file: ModuleFileNode;
  summary: IfcSummary;
}) {
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(
    summary.elements[0]?.expressID ?? null,
  );
  const selected =
    summary.elements.find(
      (element) => element.expressID === selectedExpressID,
    ) ?? null;

  const metrics: ViewerMetric[] = [
    { label: "Schema", value: summary.schema },
    { label: "IFC 行", value: summary.totalLines.toLocaleString() },
    { label: "构件", value: summary.elements.length.toLocaleString() },
    {
      label: "片段",
      value: summary.truncated
        ? `${summary.renderedFragments.toLocaleString()}+`
        : summary.renderedFragments.toLocaleString(),
    },
    { label: "Up", value: `${summary.upAxis.toUpperCase()}-up` },
    {
      label: "偏移",
      value: `${formatCoord(summary.renderOffset.x)}, ${formatCoord(summary.renderOffset.y)}, ${formatCoord(summary.renderOffset.z)}`,
    },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={`${prengineLabel} · IFC 模型`}
      asideOpen={propertiesOpen}
      asideLabel="构件属性"
      onToggleAside={() => setPropertiesOpen((current) => !current)}
      aside={
        <IfcPropertyPanel
          file={file}
          summary={summary}
          selected={selected}
          onSelectFirst={() =>
            setSelectedExpressID(summary.elements[0]?.expressID ?? null)
          }
          onSelectByExpressID={setSelectedExpressID}
        />
      }
      drawerOpen={summaryOpen}
      drawerLabel="IFC 摘要"
      onToggleDrawer={() => setSummaryOpen((current) => !current)}
      drawer={
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <SummaryGrid title="关键对象" items={summary.keyCounts} compact />
          <SummaryGrid
            title="IFC 实体 Top 24"
            items={summary.topTypes}
            compact
          />
        </div>
      }
    >
      <ThreeGroupViewport
        group={summary.group}
        label={file.name}
        status={`${prengineLabel} · BIM ${summary.upAxis.toUpperCase()}-up 坐标`}
        upAxis={summary.upAxis}
        selectedExpressID={selectedExpressID}
        onMeshSelect={setSelectedExpressID}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showChrome={false}
      />
    </EngineeringViewportFrame>
  );
}

function IfcPropertyPanel({
  file,
  summary,
  selected,
  onSelectFirst,
  onSelectByExpressID,
}: {
  file: ModuleFileNode;
  summary: IfcSummary;
  selected: IfcElementProperties | null;
  onSelectFirst: () => void;
  onSelectByExpressID: (expressID: number) => void;
}) {
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [idQuery, setIdQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const propertyRows = useMemo(
    () => buildIfcPropertyRows(file, summary, selected, draftValues),
    [draftValues, file, selected, summary],
  );

  function selectByQuery() {
    const match = findIfcElementByQuery(summary.elements, idQuery);
    if (match) {
      onSelectByExpressID(match.expressID);
      setSearchStatus(`已定位 #${match.expressID}`);
      return;
    }
    setSearchStatus("未找到匹配构件");
  }

  return (
    <aside className="flex h-full min-h-0 flex-col p-2 text-[11px] text-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium text-emerald-600">
            Element properties
          </p>
          <h3 className="mt-0.5 text-sm font-medium text-slate-50">构件属性</h3>
        </div>
      </div>

      <label className="viewer-floating-field mt-2 flex items-center gap-1 rounded-md px-2 py-1">
        <Search className="h-3.5 w-3.5 text-slate-200" />
        <input
          value={idQuery}
          onChange={(event) => setIdQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") selectByQuery();
          }}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-slate-50 outline-none placeholder:text-slate-300"
          placeholder="ID / GUID / 名称查找"
        />
      </label>

      {searchStatus ? (
        <p className="mt-1 text-[10px] font-medium text-slate-300">
          {searchStatus}
        </p>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => templateInputRef.current?.click()}
          className="viewer-ghost-tool inline-flex h-7 items-center justify-center gap-1 rounded px-1 text-[10px] font-medium"
          title="上传本地 BOM 导出模板"
        >
          <FileUp className="h-3.5 w-3.5" />
          上传模板
        </button>
        <button
          type="button"
          onClick={() =>
            void exportIfcBom(
              file.name,
              summary,
              selected ? "selected" : "model",
              selected,
              templateFile,
            )
          }
          className="viewer-ghost-tool inline-flex h-7 items-center justify-center gap-1 rounded px-1 text-[10px] font-medium"
          title="导出当前选中构件清单；未选中时导出整模清单"
        >
          <Download className="h-3.5 w-3.5" />
          导出清单
        </button>
        <input
          ref={templateInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(event) => {
            setTemplateFile(event.target.files?.[0] ?? null);
          }}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1">
        <div className="viewer-floating-field rounded px-2 py-1">
          <p className="text-[9px] font-medium text-slate-300">可选构件</p>
          <p className="font-mono text-[11px] font-medium text-slate-50">
            {summary.elements.length.toLocaleString()}
          </p>
        </div>
        <div className="viewer-floating-field rounded px-2 py-1">
          <p className="text-[9px] font-medium text-slate-300">几何网格</p>
          <p className="font-mono text-[11px] font-medium text-slate-50">
            {summary.totalMeshes.toLocaleString()}
          </p>
        </div>
      </div>

      {selected ? (
        <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
          <div className="viewer-floating-field rounded-md px-2 py-1.5">
            <p className="text-[10px] text-slate-300">#{selected.expressID}</p>
            <h4 className="mt-0.5 break-words text-xs font-medium text-slate-50">
              {decodeEngineeringText(
                selected.name || chineseIfcType(selected.type),
              )}
            </h4>
            <p className="mt-0.5 text-[10px] font-medium text-emerald-700">
              {chineseIfcType(selected.type)} · {selected.type}
            </p>
          </div>

          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => setEditing((current) => !current)}
              className="viewer-ghost-tool inline-flex h-7 flex-1 items-center justify-center gap-1 rounded text-[10px] font-medium"
            >
              <PencilLine className="h-3.5 w-3.5" />
              {editing ? "结束编辑" : "属性编辑"}
            </button>
            <button
              type="button"
              onClick={selectByQuery}
              className="viewer-ghost-tool inline-flex h-7 flex-1 items-center justify-center gap-1 rounded text-[10px] font-medium"
            >
              <Search className="h-3.5 w-3.5" />
              ID查找
            </button>
          </div>

          <div className="mt-2 space-y-1.5">
            {propertyRows.map((item) => (
              <div
                key={item.key}
                className="viewer-floating-field rounded-md px-2 py-1.5"
              >
                <p className="text-[9px] font-medium text-slate-300">
                  {item.label}
                </p>
                {editing && item.editable ? (
                  <input
                    value={item.value}
                    onChange={(event) =>
                      setDraftValues((current) => ({
                        ...current,
                        [item.key]: event.target.value,
                      }))
                    }
                    className="mt-0.5 w-full text-[11px] font-medium text-slate-50 outline-none"
                  />
                ) : (
                  <p className="mt-0.5 break-words text-[11px] font-medium leading-4 text-slate-50">
                    {item.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-1 items-center justify-center rounded-md border border-dashed border-white/20 p-4 text-center">
          <div>
            <MousePointer2 className="mx-auto h-7 w-7 text-emerald-600" />
            <p className="mt-2 text-xs font-medium text-slate-50">
              点击 IFC 构件后显示属性
            </p>
            <button
              type="button"
              onClick={onSelectFirst}
              className="viewer-ghost-tool mt-2 rounded px-2 py-1 text-[11px] font-medium"
            >
              选择第一个构件
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

async function exportIfcBom(
  fileName: string,
  summary: IfcSummary,
  scope: BomExportScope,
  selected: IfcElementProperties | null,
  templateFile: File | null,
) {
  const xlsx = await import("xlsx");
  const sourceElements =
    scope === "selected" && selected ? [selected] : summary.elements;
  const detailRows = sourceElements.map(bomRowFromElement);
  const displayRows = toTemplateRows(detailRows, defaultBomTemplateColumns);
  const typeRows = Array.from(
    sourceElements.reduce((acc, element) => {
      const label = `${chineseIfcType(element.type)} / ${element.type}`;
      acc.set(label, (acc.get(label) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  ).map(([type, quantity]) => ({ 构件类型: type, 数量: quantity }));

  if (templateFile) {
    await exportIfcBomWithTemplate(
      xlsx,
      fileName,
      scope,
      templateFile,
      detailRows,
      typeRows,
    );
    return;
  }

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(displayRows),
    scope === "selected" ? "选中构件BOM" : "模型BOM",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(typeRows),
    "类型汇总",
  );
  xlsx.writeFile(
    workbook,
    `${safeExportName(fileName)}-${scope === "selected" ? "selected" : "model"}-BOM.xlsx`,
  );
}

async function exportIfcBomWithTemplate(
  xlsx: typeof import("xlsx"),
  fileName: string,
  scope: BomExportScope,
  templateFile: File,
  rows: IfcBomRow[],
  typeRows: Array<Record<string, string | number>>,
) {
  if (templateFile.name.toLowerCase().endsWith(".json")) {
    const columns = await readJsonTemplateColumns(templateFile);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(toTemplateRows(rows, columns)),
      "BOM",
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(typeRows),
      "类型汇总",
    );
    xlsx.writeFile(
      workbook,
      `${safeExportName(fileName)}-${scope}-template-BOM.xlsx`,
    );
    return;
  }

  const workbook = xlsx.read(await templateFile.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0] ?? "BOM";
  const sheet = workbook.Sheets[sheetName] ?? xlsx.utils.aoa_to_sheet([]);
  workbook.Sheets[sheetName] = sheet;
  if (!workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames.unshift(sheetName);
  }
  xlsx.utils.sheet_add_json(
    sheet,
    toTemplateRows(rows, defaultBomTemplateColumns),
    {
      origin: -1,
      skipHeader: false,
    },
  );
  workbook.Sheets["类型汇总"] = xlsx.utils.json_to_sheet(typeRows);
  if (!workbook.SheetNames.includes("类型汇总")) {
    workbook.SheetNames.push("类型汇总");
  }
  xlsx.writeFile(
    workbook,
    `${safeExportName(fileName)}-${scope}-template-BOM.xlsx`,
  );
}

async function exportExchangePropertyRows(
  fileName: string,
  rows: IfcPropertyRow[],
  templateFile: File | null,
) {
  const xlsx = await import("xlsx");
  const bomRows = [modelBomRowFromPropertyRows(rows)];
  const exportRows = rows.map((row) => ({
    字段: row.label,
    值: row.value,
    可编辑: row.editable ? "是" : "否",
  }));

  if (templateFile && !templateFile.name.toLowerCase().endsWith(".json")) {
    const workbook = xlsx.read(await templateFile.arrayBuffer(), {
      type: "array",
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0] ?? "属性清单";
    const sheet = workbook.Sheets[sheetName] ?? xlsx.utils.aoa_to_sheet([]);
    workbook.Sheets[sheetName] = sheet;
    if (!workbook.SheetNames.includes(sheetName)) {
      workbook.SheetNames.unshift(sheetName);
    }
    xlsx.utils.sheet_add_json(sheet, exportRows, {
      origin: -1,
      skipHeader: false,
    });
    workbook.Sheets.BOM = xlsx.utils.json_to_sheet(bomRows);
    if (!workbook.SheetNames.includes("BOM")) {
      workbook.SheetNames.push("BOM");
    }
    xlsx.writeFile(
      workbook,
      `${safeExportName(fileName)}-selected-properties-template.xlsx`,
    );
    return;
  }

  if (templateFile?.name.toLowerCase().endsWith(".json")) {
    const columns = await readJsonPropertyTemplateColumns(templateFile);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(
        rows.map((row) =>
          Object.fromEntries(
            columns.map((column) => [
              column.header,
              column.key === "label"
                ? row.label
                : column.key === "value"
                  ? row.value
                  : column.key === "editable"
                    ? row.editable
                      ? "是"
                      : "否"
                    : "",
            ]),
          ),
        ),
      ),
      "属性清单",
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(bomRows),
      "BOM",
    );
    xlsx.writeFile(
      workbook,
      `${safeExportName(fileName)}-selected-properties-template.xlsx`,
    );
    return;
  }

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(exportRows),
    "属性清单",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(bomRows),
    "BOM",
  );
  xlsx.writeFile(
    workbook,
    `${safeExportName(fileName)}-selected-properties.xlsx`,
  );
}

async function exportIfcElementsBom(
  fileName: string,
  elements: IfcElementProperties[],
  templateFile: File | null,
) {
  const xlsx = await import("xlsx");
  const detailRows = elements.map(bomRowFromElement);
  const displayRows = toTemplateRows(detailRows, defaultBomTemplateColumns);
  const typeRows = Array.from(
    elements.reduce((acc, element) => {
      const label = `${chineseIfcType(element.type)} / ${element.type}`;
      acc.set(label, (acc.get(label) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  ).map(([type, quantity]) => ({ 构件类型: type, 数量: quantity }));

  if (templateFile) {
    await exportIfcBomWithTemplate(
      xlsx,
      fileName,
      "model",
      templateFile,
      detailRows,
      typeRows,
    );
    return;
  }

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(displayRows),
    "模型构件清单",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(typeRows),
    "类型汇总",
  );
  xlsx.writeFile(workbook, `${safeExportName(fileName)}-Prengine-BOM.xlsx`);
}

function modelBomRowFromPropertyRows(
  rows: IfcPropertyRow[],
): Record<string, string> {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const byLabel = new Map(rows.map((row) => [row.label, row.value]));
  const componentId = byKey.get("componentId") ?? byLabel.get("构件ID") ?? "";
  const name =
    byKey.get("name") ??
    byLabel.get("name") ??
    byLabel.get("名称") ??
    byLabel.get("源 Mesh 名称") ??
    componentId;
  const objectType =
    byKey.get("objectType") ??
    byLabel.get("ObjectType") ??
    byLabel.get("对象类型") ??
    "";
  const byLabelPrefix = (prefix: string) =>
    rows.find((row) => row.label.startsWith(prefix))?.value;
  return {
    构件ID: componentId,
    三维尺寸: byKey.get("dimensions") ?? byLabelPrefix("三维尺寸") ?? "",
    name,
    ObjectType: objectType,
    X尺寸:
      byKey.get("sizeX") ??
      byLabel.get("X尺寸（mm）") ??
      byLabelPrefix("长度") ??
      "",
    Y尺寸:
      byKey.get("sizeY") ??
      byLabel.get("Y尺寸（mm）") ??
      byLabelPrefix("宽度") ??
      "",
    Z尺寸:
      byKey.get("sizeZ") ??
      byLabel.get("Z尺寸（mm）") ??
      byLabelPrefix("高度") ??
      "",
    坐标位置:
      byKey.get("coordinates") ??
      byLabel.get("坐标位置（mm）") ??
      byLabelPrefix("中心位置") ??
      "",
    原生格式: byKey.get("sourceFormat") ?? byLabel.get("原生格式") ?? "",
    查看链路: byKey.get("route") ?? byLabel.get("查看链路") ?? "",
  };
}

async function readJsonPropertyTemplateColumns(
  file: File,
): Promise<Array<{ header: string; key: string }>> {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const source =
      typeof parsed === "object" && parsed && "columns" in parsed
        ? (parsed as { columns?: unknown }).columns
        : parsed;
    if (!Array.isArray(source)) throw new Error("invalid template");
    const columns = source
      .map((entry): { header: string; key: string } | null => {
        if (typeof entry === "string") return { header: entry, key: entry };
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const header =
          typeof record.header === "string"
            ? record.header
            : typeof record.label === "string"
              ? record.label
              : "";
        const key =
          typeof record.key === "string"
            ? record.key
            : typeof record.field === "string"
              ? record.field
              : "";
        return header && key ? { header, key } : null;
      })
      .filter((entry): entry is { header: string; key: string } =>
        Boolean(entry),
      );
    return columns.length
      ? columns
      : [
          { header: "字段", key: "label" },
          { header: "值", key: "value" },
          { header: "可编辑", key: "editable" },
        ];
  } catch {
    return [
      { header: "字段", key: "label" },
      { header: "值", key: "value" },
      { header: "可编辑", key: "editable" },
    ];
  }
}

async function readJsonTemplateColumns(
  file: File,
): Promise<BomTemplateColumn[]> {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const columns = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed && "columns" in parsed
        ? (parsed as { columns?: unknown }).columns
        : null;
    if (!Array.isArray(columns)) return defaultBomTemplateColumns;
    return columns
      .map((entry): BomTemplateColumn | null => {
        if (typeof entry === "string") {
          const found = defaultBomTemplateColumns.find(
            (column) => column.header === entry || column.key === entry,
          );
          return found ?? { header: entry, key: entry };
        }
        if (typeof entry !== "object" || !entry) return null;
        const candidate = entry as { header?: unknown; key?: unknown };
        if (
          typeof candidate.header !== "string" ||
          typeof candidate.key !== "string"
        )
          return null;
        return { header: candidate.header, key: candidate.key };
      })
      .filter((entry): entry is BomTemplateColumn => Boolean(entry));
  } catch {
    return defaultBomTemplateColumns;
  }
}

function bomRowFromElement(element: IfcElementProperties): IfcBomRow {
  return {
    componentId: element.globalId
      ? decodeEngineeringText(element.globalId)
      : `#${element.expressID}`,
    expressID: element.expressID,
    globalId: decodeEngineeringText(element.globalId),
    type: element.type,
    typeZh: chineseIfcType(element.type),
    dimensions: formatDimensionVector(
      element.geometryDimensions ?? null,
      element.geometryUnit ?? meterLengthUnit,
    ),
    name: decodeEngineeringText(element.name),
    objectType: decodeEngineeringText(element.objectType),
    tag: decodeEngineeringText(element.tag),
    predefinedType: decodeEngineeringText(element.predefinedType),
    quantity: 1,
    material: propertyValueFromElement(element, ["Material", "材料", "材质"]),
    density: propertyValueFromElement(element, [
      "Density",
      "MassDensity",
      "密度",
    ]),
    weight: propertyValueFromElement(element, ["Weight", "Mass", "重量"]),
    unit: propertyValueFromElement(element, ["Unit", "MeasureUnit", "单位"]),
    unitPrice: propertyValueFromElement(element, ["UnitPrice", "单价"]),
    totalPrice: propertyValueFromElement(element, [
      "TotalPrice",
      "TotalCost",
      "Amount",
      "总价",
    ]),
  };
}

function propertyValueFromElement(
  element: IfcElementProperties,
  patterns: string[],
  fallback = "",
): string {
  return decodeEngineeringText(
    findIfcPropertyValue(element, patterns) ?? fallback,
  );
}

export function buildIfcPropertyRows(
  file: ModuleFileNode,
  summary: IfcSummary,
  selected: IfcElementProperties | null,
  draftValues: Record<string, string>,
): IfcPropertyRow[] {
  if (!selected) return [];
  const lengthUnit = selected.geometryUnit ?? summary.lengthUnit ?? meterLengthUnit;
  const prop = (patterns: string[], fallback: string) =>
    decodeEngineeringText(findIfcPropertyValue(selected, patterns) ?? fallback);
  const defaultPending = "待绑定属性索引";
  const rows: IfcPropertyRow[] = [
    {
      key: "uploadTemplate",
      label: "上传模板",
      value: "BOM/属性模板可上传",
    },
    {
      key: "exportList",
      label: "导出清单",
      value: "选中构件 / 整模 BOM",
    },
    { key: "version", label: "所属版本", value: file.version || "v1.0" },
    {
      key: "uploadedAt",
      label: "上传时间",
      value: formatDisplayTime(file.updatedAt),
    },
    {
      key: "componentId",
      label: "构件ID",
      value: selected.globalId || `#${selected.expressID}`,
    },
    {
      key: "revitId",
      label: "Revit ID",
      value: prop(
        ["Revit", "ElementId", "Tag", "Id"],
        "待绑定 Revit ElementId",
      ),
      editable: true,
    },
    {
      key: "rhinoId",
      label: "Rhino ID",
      value: prop(["Rhino", "RhinoId"], "待绑定 Rhino GUID"),
      editable: true,
    },
    {
      key: "solidWorksId",
      label: "SolidWorks ID",
      value: prop(["SolidWorks", "SWId"], "待绑定 SolidWorks 属性"),
      editable: true,
    },
    {
      key: "teklaId",
      label: "Tekla ID",
      value: prop(["Tekla", "TeklaId"], "待绑定 Tekla GUID"),
      editable: true,
    },
    {
      key: "objectType",
      label: "对象类型",
      value: decodeEngineeringText(selected.objectType || selected.type),
      editable: true,
    },
    {
      key: "placement",
      label: "对象定位",
      value: prop(["ObjectPlacement", "Placement"], "IFC ObjectPlacement"),
      editable: true,
    },
    {
      key: "geometry",
      label: "几何表达",
      value: prop(
        ["Representation", "Body", "Geometry"],
        `${summary.renderedFragments.toLocaleString()} fragments / ${summary.totalMeshes.toLocaleString()} meshes`,
      ),
    },
    {
      key: "dimensions",
      label: `三维尺寸（${lengthUnit.label}）`,
      value: formatDimensionVector(
        selected.geometryDimensions ?? null,
        lengthUnit,
      ),
    },
    {
      key: "dimensionSource",
      label: "尺寸来源",
      value: ifcGeometrySourceLabel(selected),
    },
    {
      key: "nativeCenter",
      label: `对象定位（${lengthUnit.label}）`,
      value: formatPointVector(
        selected.sourcePlacement ?? selected.geometryCenter ?? null,
        lengthUnit,
      ),
    },
    {
      key: "material",
      label: "材质",
      value: prop(["Material", "材料", "材质"], defaultPending),
      editable: true,
    },
    {
      key: "sourceColor",
      label: "源文件颜色",
      value: selected.sourceColor ?? defaultPending,
    },
    {
      key: "density",
      label: "密度",
      value: prop(["Density", "MassDensity", "密度"], defaultPending),
      editable: true,
    },
    {
      key: "weight",
      label: "重量",
      value: prop(["Weight", "Mass", "重量"], defaultPending),
      editable: true,
    },
    {
      key: "unit",
      label: "单位",
      value: prop(["Unit", "MeasureUnit", "单位"], defaultPending),
      editable: true,
    },
    {
      key: "unitPrice",
      label: "单价",
      value: prop(["UnitPrice", "单价"], defaultPending),
      editable: true,
    },
    {
      key: "totalPrice",
      label: "总价",
      value: prop(
        ["TotalPrice", "TotalCost", "Amount", "总价"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "size",
      label: "规格尺寸",
      value: prop(
        ["Size", "规格", "Dimensions", "Length", "Width", "Height"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "supplier",
      label: "供应厂商",
      value: prop(
        ["Supplier", "Manufacturer", "厂商", "供应商"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "grade",
      label: "等级信息",
      value: prop(
        ["Grade", "等级", "FireRating", "LoadBearing"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "conceptDesigner",
      label: "方案设计师",
      value: prop(
        ["ConceptDesigner", "方案设计师", "方案设计", "Designer", "设计"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "detailDesigner",
      label: "深化设计师",
      value: prop(
        ["DetailDesigner", "深化设计师", "深化设计", "Detailer", "BIMDesigner"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "processEngineer",
      label: "工艺工程师",
      value: prop(
        [
          "ProcessEngineer",
          "工艺工程师",
          "工艺",
          "工法",
          "ManufacturingEngineer",
        ],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "reviewer",
      label: "审核人员",
      value: prop(["Reviewer", "审核"], defaultPending),
      editable: true,
    },
    {
      key: "coordinates",
      label: "坐标位置",
      value: `模型原点偏移 ${formatCoord(summary.renderOffset.x)}, ${formatCoord(summary.renderOffset.y)}, ${formatCoord(summary.renderOffset.z)}`,
    },
    {
      key: "constructionZone",
      label: "施工区域",
      value: prop(
        ["Zone", "Storey", "BuildingStorey", "施工区域"],
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "process",
      label: "工艺工法",
      value: prop(["Process", "Method", "工艺", "工法"], defaultPending),
      editable: true,
    },
  ];

  const rowFingerprints = new Set(
    rows.map((row) => `${row.label}:${row.value}`.toLowerCase()),
  );
  const sourceRows = selected.properties
    .map((item, index) => ({
      key: `source:${index}:${item.label}`,
      label: decodeEngineeringText(item.label),
      value: decodeEngineeringText(item.value),
      editable: true,
    }))
    .filter((row) => row.label && row.value)
    .filter((row) => !DEPRECATED_ENGINEERING_ROLE_LABELS.has(row.label))
    .filter((row) => {
      const fingerprint = `${row.label}:${row.value}`.toLowerCase();
      if (rowFingerprints.has(fingerprint)) return false;
      rowFingerprints.add(fingerprint);
      return true;
    });

  return [...rows, ...sourceRows].map((row) => ({
    ...row,
    value: draftValues[row.key] ?? row.value,
  }));
}

function findIfcPropertyValue(
  selected: IfcElementProperties,
  patterns: string[],
): string | null {
  const lowered = patterns.map((pattern) => pattern.toLowerCase());
  const match = selected.properties.find((item) => {
    const label = item.label.toLowerCase();
    return lowered.some((pattern) => label.includes(pattern));
  });
  return match?.value ?? null;
}

export function findIfcElementByQuery(
  elements: IfcElementProperties[],
  query: string,
): IfcElementProperties | null {
  const normalized = normalizeIfcSearchValue(query);
  if (!normalized) return null;
  return (
    elements.find((element) => {
      return [
        String(element.expressID),
        `#${element.expressID}`,
        element.globalId,
        element.name,
        element.objectType,
        element.tag,
        element.type,
        ...element.properties.flatMap((item) => [item.label, item.value]),
      ]
        .filter(Boolean)
        .some((value) => normalizeIfcSearchValue(value).includes(normalized));
    }) ?? null
  );
}

function normalizeIfcSearchValue(value: string | number | undefined): string {
  return decodeEngineeringText(String(value ?? ""))
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[\s_-]+/g, "");
}

function formatDisplayTime(value: string | undefined): string {
  if (!value) return "待绑定";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().replace("T", " ").slice(0, 16);
}

function toTemplateRows(
  rows: IfcBomRow[],
  columns: BomTemplateColumn[],
): Array<Record<string, string | number>> {
  return rows.map(
    (row) =>
      Object.fromEntries(
        columns.map((column) => [
          column.header,
          row[column.key as keyof IfcBomRow] ?? "",
        ]),
      ) as Record<string, string | number>,
  );
}

function safeExportName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "ifc";
}

function CadNativeDrawingViewer({
  file,
  sourceUrl,
  runtimeLabel = `${prengineLabel} · CAD 图纸`,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  runtimeLabel?: string;
}) {
  const [state, setState] = useState<LoadState<DxfPreview>>({
    status: "loading",
    message: "正在打开 Prengine 图纸...",
  });
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewport, setViewport] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDxf() {
      setState({
        status: "loading",
        message: "正在打开 Prengine 图纸...",
      });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "读取 DXF 失败"),
          );
        }
        const source = decodeDxfBuffer(await response.arrayBuffer());
        const { default: DxfParser } = await import("dxf-parser");
        const parser = new DxfParser();
        const parsed = parseDxfWithSuppressedParserNoise(parser, source.text);

        if (!parsed) {
          throw new Error("DXF parser 未返回实体数据。");
        }

        const preview = buildDxfPreview(parsed, source.codePage);
        if (!cancelled) {
          setState({ status: "ready", value: preview });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadDxf();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="Prengine 图纸打开失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const preview = state.value;
  if (preview.primitiveCount === 0) {
    return (
      <AdapterRequiredPanel
        title="Prengine 未解析到可见图纸实体"
        file={file}
        reason={`已读取源文件，但当前 Prengine 图纸结果没有生成可见矢量实体。实体数 ${preview.entityCount.toLocaleString()}，待补充实体：${
          preview.unsupportedEntityTypes.length
            ? preview.unsupportedEntityTypes.join("、")
            : "未声明"
        }。该文件应继续生成可审计 Prengine 图纸清单。`}
      />
    );
  }
  const metrics: ViewerMetric[] = [
    {
      label: "实体",
      value: `${preview.renderedEntityCount.toLocaleString()} / ${preview.entityCount.toLocaleString()}`,
    },
    { label: "图元", value: preview.primitiveCount.toLocaleString() },
    { label: "图层", value: preview.layers.length.toLocaleString() },
    { label: "代码页", value: preview.codePage },
  ];
  const viewBox = dxfSvgViewBox(preview, viewport);
  const viewBoxValue = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  return (
    <section
      className="h-full"
      tabIndex={0}
      onKeyDown={(event) => handleDxfKeyDown(event, setViewport)}
    >
      <EngineeringViewportFrame
        metrics={metrics}
        routeLabel={runtimeLabel}
        toolbarActions={
          <>
            <button
              type="button"
              onClick={() =>
                setViewport((current) => ({
                  ...current,
                  zoom: Math.min(30, current.zoom * 1.18),
                }))
              }
              className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
              title="放大图纸"
              aria-label="放大图纸"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setViewport((current) => ({
                  ...current,
                  zoom: Math.max(0.08, current.zoom / 1.18),
                }))
              }
              className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
              title="缩小图纸"
              aria-label="缩小图纸"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport({ zoom: 1, panX: 0, panY: 0 })}
              className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
              title="重置图纸视图"
              aria-label="重置图纸视图"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </>
        }
        asideOpen={detailsOpen}
        asideLabel="图纸属性"
        onToggleAside={() => setDetailsOpen((current) => !current)}
        aside={<DxfDetailsPanel file={file} preview={preview} />}
      >
        <>
          <svg
            role="img"
            aria-label={`${file.name} DXF 实体矢量解析查看器`}
            className="h-full w-full cursor-grab bg-slate-950 active:cursor-grabbing"
            viewBox={viewBoxValue}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="geometricPrecision"
            onWheel={(event) => {
              event.preventDefault();
              const factor = event.deltaY > 0 ? 0.9 : 1.1;
              setViewport((current) => ({
                ...current,
                zoom: Math.max(0.08, Math.min(30, current.zoom * factor)),
              }));
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                x: event.clientX,
                y: event.clientY,
                panX: viewport.panX,
                panY: viewport.panY,
              };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const currentViewBox = dxfSvgViewBox(preview, {
                zoom: viewport.zoom,
                panX: drag.panX,
                panY: drag.panY,
              });
              const worldXPerPixel =
                currentViewBox.width / Math.max(rect.width, 1);
              const worldYPerPixel =
                currentViewBox.height / Math.max(rect.height, 1);
              setViewport((current) => ({
                ...current,
                panX: drag.panX - (event.clientX - drag.x) * worldXPerPixel,
                panY: drag.panY - (event.clientY - drag.y) * worldYPerPixel,
              }));
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            <defs>
              <pattern
                id="dxf-grid"
                width={viewBox.width / 32}
                height={viewBox.height / 32}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${viewBox.width / 32} 0 L 0 0 0 ${viewBox.height / 32}`}
                  fill="none"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth={Math.max(viewBox.width, viewBox.height) / 9000}
                />
              </pattern>
            </defs>
            <rect
              x={viewBox.minX}
              y={viewBox.minY}
              width={viewBox.width}
              height={viewBox.height}
              fill="#020817"
            />
            <rect
              x={viewBox.minX}
              y={viewBox.minY}
              width={viewBox.width}
              height={viewBox.height}
              fill="url(#dxf-grid)"
            />
            {preview.primitives.map((primitive, index) => (
              <DxfSvgPrimitive
                key={`${primitive.kind}:${primitive.layer}:${index}`}
                primitive={primitive}
                bounds={preview.focusBounds}
                strokeWidth={dxfPrimitiveStrokeWidth(primitive)}
              />
            ))}
          </svg>
          <CadFourAxisControlPanel
            onAction={(action) => applyCadAxisAction(action, setViewport)}
          />
        </>
      </EngineeringViewportFrame>
    </section>
  );
}

function DxfDetailsPanel({
  file,
  preview,
}: {
  file: ModuleFileNode;
  preview: DxfPreview;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="shrink-0">
        <p className="arch-primary-text text-xs font-medium">Prengine 图纸</p>
        <h3 className="arch-text mt-1 text-lg font-medium">图层 / 解析状态</h3>
        {preview.paperSpaceEntityCount > 0 ? (
          <p className="arch-muted mt-2 text-xs leading-5">
            当前优先显示 model space；已跳过{" "}
            {preview.paperSpaceEntityCount.toLocaleString()} 个 paper space
            实体。
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void exportDxfPrimitiveList(file.name, preview)}
          className="viewer-ghost-tool mt-2 inline-flex h-7 items-center justify-center gap-1 rounded px-2 text-[10px] font-medium"
          title="导出图纸图元清单"
        >
          <Download className="h-3.5 w-3.5" />
          导出清单
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
        {preview.layers.length ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.layers.map((layer) => (
              <span
                key={layer}
                className="arch-chip rounded-md px-2 py-1 text-[11px] font-medium"
              >
                {layer}
              </span>
            ))}
          </div>
        ) : (
          <p className="arch-muted text-sm">该 DXF 未声明可见图层。</p>
        )}

        {preview.unsupportedEntityTypes.length ? (
          <div className="mt-4 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3">
            <p className="arch-text text-sm font-medium">待补充实体解释器</p>
            <p className="arch-muted mt-2 text-xs leading-5">
              已保留源文件，不用图片替代：
              {preview.unsupportedEntityTypes.join("、")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function exportDxfPrimitiveList(fileName: string, preview: DxfPreview) {
  const xlsx = await import("xlsx");
  const rows = preview.primitives.map((primitive, index) => {
    const bounds = dxfPrimitiveBounds(primitive);
    const width = Math.abs(bounds.maxX - bounds.minX);
    const height = Math.abs(bounds.maxY - bounds.minY);
    return {
      序号: index + 1,
      名称:
        primitive.kind === "text"
          ? primitive.value
          : `${dxfPrimitiveKindLabel(primitive.kind)}-${index + 1}`,
      类型: dxfPrimitiveKindLabel(primitive.kind),
      图层: primitive.layer,
      X尺寸: formatMm(width),
      Y尺寸: formatMm(height),
      位置: `X ${formatMm((bounds.minX + bounds.maxX) / 2)} / Y ${formatMm(
        (bounds.minY + bounds.maxY) / 2,
      )}`,
      颜色: primitive.color,
      线宽: formatMm(primitive.lineWeight),
    };
  });
  const summaryRows = preview.layers.map((layer) => ({
    图层: layer,
    图元数: preview.primitives.filter((primitive) => primitive.layer === layer)
      .length,
  }));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(rows),
    "图纸图元清单",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(summaryRows),
    "图层汇总",
  );
  xlsx.writeFile(workbook, `${safeExportName(fileName)}-Prengine-CAD-BOM.xlsx`);
}

function dxfPrimitiveKindLabel(kind: DxfPrimitive["kind"]): string {
  const labels: Record<DxfPrimitive["kind"], string> = {
    polyline: "线",
    arc: "圆弧",
    circle: "圆",
    point: "点",
    text: "文字",
    solid: "面",
    ellipse: "椭圆",
  };
  return labels[kind];
}

function dxfPrimitiveBounds(primitive: DxfPrimitive): Bounds2D {
  const bounds = createEmptyBounds();
  includePrimitiveBounds(bounds, primitive);
  return normalizeBounds(bounds);
}

function CadDerivativeViewer({ file }: { file: ModuleFileNode }) {
  const [state, setState] = useState<LoadState<CadDerivativeManifest>>({
    status: "loading",
    message: "正在打开 Prengine 图纸...",
  });
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      if (!localFileId) {
        setState({
          status: "failed",
          message:
            "该文件只有模块元数据，没有绑定真实本地文件流，无法启动 Prengine 图纸服务。",
        });
        return;
      }

      setState({
        status: "loading",
        message: "正在打开 Prengine 图纸...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(localFileId)}/cad-derivative?format=manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "Prengine 图纸打开失败"),
          );
        }
        const manifest = (await response.json()) as CadDerivativeManifest;
        if (!manifest.sheets.length) {
          throw new Error("Prengine 已处理源文件但没有返回可浏览图纸页。");
        }
        if (!cancelled) {
          setSelectedSheetId(manifest.sheets[0]?.id ?? null);
          setState({ status: "ready", value: manifest });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, [localFileId]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="Prengine CAD 图纸打开失败"
        file={file}
        reason={`${state.message}。系统不会用不准确的前端复刻图代替原图；请先生成 Prengine 图纸派生后再查看。`}
      />
    );
  }

  const manifest = state.value;
  const selectedSheet =
    manifest.sheets.find((sheet) => sheet.id === selectedSheetId) ??
    manifest.sheets[0];

  if (manifest.permissions && !manifest.permissions.canView) {
    return (
      <AdapterRequiredPanel
        title="Prengine CAD 图纸查看结果未生成"
        file={file}
        reason={
          manifest.notes[0] ??
          "当前缺少可信 CAD 图纸派生服务。系统不会用不准确的前端 DXF 复刻图代替源图。"
        }
      />
    );
  }

  if (manifest.viewer === "cad_vector_svg" && selectedSheet) {
    return (
      <CadVectorSheetViewer
        file={file}
        manifest={manifest}
        selectedSheet={selectedSheet}
      />
    );
  }

  if (
    (manifest.viewer === "cad_vector_entities" ||
      manifest.viewer === "dxf_canvas") &&
    selectedSheet
  ) {
    return (
      <CadNativeDrawingViewer
        file={file}
        sourceUrl={selectedSheet.url}
        runtimeLabel={`${prengineLabel} · CAD 图纸`}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="引擎" value={prengineLabel} />
        <MetricCard
          label="源格式"
          value={manifest.sourceFormat.toUpperCase()}
        />
        <MetricCard
          label="图纸页"
          value={manifest.sheets.length.toLocaleString()}
        />
        <MetricCard label="查看模式" value="Prengine 图纸" />
      </div>

      <section className="arch-card rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {manifest.sheets.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setSelectedSheetId(sheet.id)}
              className={
                sheet.id === selectedSheet?.id
                  ? "arch-btn-primary rounded-lg px-3 py-2 text-sm font-medium"
                  : "arch-btn rounded-lg px-3 py-2 text-sm font-medium"
              }
              title={`打开图纸页 ${sheet.name}`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
        <p className="arch-muted mt-3 text-xs leading-5">
          这是 Prengine 生成的源文件绑定图纸页；源文件仍保留为记录真源。
        </p>
      </section>

      {selectedSheet ? (
        <section className="arch-card relative h-[calc(100vh-220px)] min-h-[680px] overflow-hidden rounded-xl border">
          <iframe
            title={`${file.name} ${selectedSheet.name}`}
            src={`${selectedSheet.url}#toolbar=0&navpanes=0&scrollbar=1`}
            className="h-full w-full border-0 bg-white"
          />
        </section>
      ) : null}
    </section>
  );
}

function CadVectorSheetViewer({
  file,
  manifest,
  selectedSheet,
}: {
  file: ModuleFileNode;
  manifest: CadDerivativeManifest;
  selectedSheet: CadDerivativeSheet;
}) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const metrics: ViewerMetric[] = [
    { label: "引擎", value: prengineLabel },
    { label: "源格式", value: manifest.sourceFormat.toUpperCase() },
    { label: "图纸页", value: manifest.sheets.length.toLocaleString() },
    { label: "查看模式", value: "Prengine 图纸" },
  ];
  const reset = () => setViewport({ zoom: 1, panX: 0, panY: 0 });
  const zoom = (direction: "in" | "out") =>
    setViewport((current) => ({
      ...current,
      zoom:
        direction === "in"
          ? Math.min(8, current.zoom * 1.15)
          : Math.max(0.2, current.zoom / 1.15),
    }));

  return (
    <section
      className="h-full"
      tabIndex={0}
      onPointerDown={(event) => event.currentTarget.focus()}
      onKeyDown={(event) => handleDxfKeyDown(event, setViewport)}
    >
      <EngineeringViewportFrame
        metrics={metrics}
        routeLabel={`${prengineLabel} · CAD 图纸`}
        asideOpen={detailsOpen}
        asideLabel="图纸属性"
        onToggleAside={() => setDetailsOpen((current) => !current)}
        onResetView={reset}
        onZoomIn={() => zoom("in")}
        onZoomOut={() => zoom("out")}
        aside={
          <div className="space-y-3 text-sm">
            <ViewerAsideProperty label="文件名" value={file.name} />
            <ViewerAsideProperty
              label="源格式"
              value={manifest.sourceFormat.toUpperCase()}
            />
            <ViewerAsideProperty label="图纸页" value={selectedSheet.name} />
            <ViewerAsideProperty label="引擎" value={prengineLabel} />
            <ViewerAsideProperty
              label="查看模式"
              value={`${prengineLabel} 源文件绑定图纸`}
            />
          </div>
        }
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden bg-slate-950">
          <div className="absolute inset-4 flex items-center justify-center overflow-hidden rounded-sm bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedSheet.url}
              alt={`${file.name} ${selectedSheet.name}`}
              className="pointer-events-none block h-full w-full select-none object-contain"
              draggable={false}
              style={{
                transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
                transformOrigin: "center center",
              }}
            />
          </div>
          <CadFourAxisControlPanel
            onAction={(action) => applyCadAxisAction(action, setViewport)}
          />
        </div>
      </EngineeringViewportFrame>
    </section>
  );
}

function ViewerAsideProperty({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-100">
        {value}
      </p>
    </div>
  );
}

function dxfSvgViewBox(
  preview: DxfPreview,
  viewport: { zoom: number; panX: number; panY: number },
): { minX: number; minY: number; width: number; height: number } {
  const bounds = preview.focusBounds;
  const sourceWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const sourceHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const zoom = Math.max(viewport.zoom, 0.08);
  const width = sourceWidth / zoom;
  const height = sourceHeight / zoom;
  const centerX = (bounds.minX + bounds.maxX) / 2 + viewport.panX;
  const centerY = (bounds.minY + bounds.maxY) / 2 + viewport.panY;
  return {
    minX: centerX - width / 2,
    minY: centerY - height / 2,
    width,
    height,
  };
}

function DxfSvgPrimitive({
  primitive,
  bounds,
  strokeWidth,
}: {
  primitive: DxfPrimitive;
  bounds: Bounds2D;
  strokeWidth: number;
}) {
  const color = dxfSvgColor(primitive.color);
  const lineCap =
    primitive.kind === "polyline" ? ("butt" as const) : ("round" as const);
  const common = {
    stroke: color,
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinecap: lineCap,
    strokeLinejoin: "miter" as const,
    strokeMiterlimit: 2,
  };

  if (primitive.kind === "polyline") {
    const points = primitive.points.map((point) => dxfSvgPoint(bounds, point));
    const d = dxfPathFromPoints(points, primitive.closed);
    return d ? <path d={d} fill="none" {...common} /> : null;
  }

  if (primitive.kind === "solid") {
    const points = primitive.points.map((point) => dxfSvgPoint(bounds, point));
    const d = dxfPathFromPoints(points, true);
    return d ? (
      <path d={d} fill="none" strokeOpacity={0.72} {...common} />
    ) : null;
  }

  if (primitive.kind === "circle") {
    const center = dxfSvgPoint(bounds, { x: primitive.cx, y: primitive.cy });
    return (
      <circle
        cx={center.x}
        cy={center.y}
        r={primitive.r}
        fill="none"
        {...common}
      />
    );
  }

  if (primitive.kind === "point") {
    const center = dxfSvgPoint(bounds, { x: primitive.x, y: primitive.y });
    const markerRadius = dxfPointMarkerRadius(bounds);
    return (
      <g
        stroke={color}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      >
        <circle
          cx={center.x}
          cy={center.y}
          r={markerRadius}
          fill="none"
          opacity={0.86}
        />
        <path
          d={`M ${formatSvgNumber(center.x - markerRadius)} ${formatSvgNumber(
            center.y,
          )} L ${formatSvgNumber(center.x + markerRadius)} ${formatSvgNumber(
            center.y,
          )} M ${formatSvgNumber(center.x)} ${formatSvgNumber(
            center.y - markerRadius,
          )} L ${formatSvgNumber(center.x)} ${formatSvgNumber(
            center.y + markerRadius,
          )}`}
          fill="none"
          strokeLinecap="butt"
        />
      </g>
    );
  }

  if (primitive.kind === "arc") {
    const points = sampleDxfArcPoints(primitive).map((point) =>
      dxfSvgPoint(bounds, point),
    );
    const d = dxfPathFromPoints(points, false);
    return d ? <path d={d} fill="none" {...common} /> : null;
  }

  if (primitive.kind === "ellipse") {
    const points = sampleDxfEllipsePoints(primitive).map((point) =>
      dxfSvgPoint(bounds, point),
    );
    const d = dxfPathFromPoints(points, false);
    return d ? <path d={d} fill="none" {...common} /> : null;
  }

  const origin = dxfSvgPoint(bounds, { x: primitive.x, y: primitive.y });
  const lines = primitive.value.split(/\r?\n/).filter(Boolean);
  const fontSize = dxfTextSize(bounds, primitive.size);
  const anchor =
    primitive.align === "center"
      ? "middle"
      : primitive.align === "right"
        ? "end"
        : "start";
  return (
    <text
      x={origin.x}
      y={origin.y}
      fill={color}
      fontFamily={engineeringTextFontStack}
      fontSize={fontSize}
      textAnchor={anchor}
      transform={`rotate(${-primitive.rotation} ${origin.x} ${origin.y})`}
    >
      {lines.map((line, index) => (
        <tspan
          key={`${line}:${index}`}
          x={origin.x}
          dy={index === 0 ? 0 : fontSize * 1.25}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function dxfSvgPoint(
  bounds: Bounds2D,
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: point.x,
    y: bounds.minY + bounds.maxY - point.y,
  };
}

function dxfPathFromPoints(
  points: Array<{ x: number; y: number }>,
  closed: boolean,
): string {
  const [firstPoint, ...restPoints] = points;
  if (!firstPoint) return "";
  const segments = [
    `M ${formatSvgNumber(firstPoint.x)} ${formatSvgNumber(firstPoint.y)}`,
    ...restPoints.map(
      (point) => `L ${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`,
    ),
  ];
  if (closed) segments.push("Z");
  return segments.join(" ");
}

function sampleDxfArcPoints(
  primitive: DxfArcPrimitive,
): Array<{ x: number; y: number }> {
  const start = primitive.startAngle;
  let end = primitive.endAngle;
  while (end < start) end += 360;
  const span = Math.max(end - start, 0.5);
  const steps = Math.max(8, Math.min(96, Math.ceil(span / 5)));
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = degreesToRadians(start + (span * index) / steps);
    points.push({
      x: primitive.cx + primitive.r * Math.cos(angle),
      y: primitive.cy + primitive.r * Math.sin(angle),
    });
  }
  return points;
}

function sampleDxfEllipsePoints(
  primitive: DxfEllipsePrimitive,
): Array<{ x: number; y: number }> {
  const start = primitive.startAngle;
  let end = primitive.endAngle;
  while (end < start) end += Math.PI * 2;
  const span = Math.max(end - start, 0.01);
  const steps = Math.max(16, Math.min(128, Math.ceil(span / (Math.PI / 36))));
  const rotation = degreesToRadians(primitive.rotation);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points: Array<{ x: number; y: number }> = [];

  for (let index = 0; index <= steps; index += 1) {
    const angle = start + (span * index) / steps;
    const x = primitive.rx * Math.cos(angle);
    const y = primitive.ry * Math.sin(angle);
    points.push({
      x: primitive.cx + x * cos - y * sin,
      y: primitive.cy + x * sin + y * cos,
    });
  }

  return points;
}

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function dxfPrimitiveStrokeWidth(primitive: DxfPrimitive): number {
  if (primitive.kind === "text") return 0.6;
  if (primitive.kind === "solid") return 0.55;
  return clampNumber(primitive.lineWeight, 0.35, 1.45);
}

function dxfBoundsExtent(bounds: Bounds2D): number {
  return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
}

function dxfPointMarkerRadius(bounds: Bounds2D): number {
  return clampNumber(dxfBoundsExtent(bounds) / 2400, 0.8, 12);
}

function dxfTextSize(bounds: Bounds2D, sourceSize: number): number {
  const extent = dxfBoundsExtent(bounds);
  return clampNumber(sourceSize, extent / 9000, extent / 70);
}

function dxfSvgColor(color: string): string {
  const normalized = color.toLowerCase();
  if (
    normalized === "#000000" ||
    normalized === "#111827" ||
    normalized === "#1f2937"
  ) {
    return "#e5e7eb";
  }
  return color;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

async function responseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const parsed = (await response.json()) as {
      message?: unknown;
      error?: unknown;
    };
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : null;
    return message
      ? `${fallback}: ${message}`
      : `${fallback}: HTTP ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text
        ? `${fallback}: ${text.slice(0, 500)}`
        : `${fallback}: HTTP ${response.status}`;
    } catch {
      return `${fallback}: HTTP ${response.status}`;
    }
  }
}

function formatCoord(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000000 || (abs > 0 && abs < 0.001)) {
    return value.toExponential(3);
  }
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
}

function boxToSerializableBounds(box: Box3): Bounds3D {
  return {
    min: vectorToSerializablePoint(box.min),
    max: vectorToSerializablePoint(box.max),
  };
}

function vectorToSerializablePoint(vector: Vector3): Bounds3DPoint {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function vectorUserData(value: unknown): Bounds3DPoint | null {
  if (value instanceof Vector3) return vectorToSerializablePoint(value);
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.z === "number"
  ) {
    return { x: candidate.x, y: candidate.y, z: candidate.z };
  }
  return null;
}

function handleDxfKeyDown(
  event: KeyboardEvent<HTMLElement>,
  setViewport: Dispatch<
    SetStateAction<{ zoom: number; panX: number; panY: number }>
  >,
) {
  const step = event.shiftKey ? 80 : 28;
  const zoomStep = event.shiftKey ? 1.25 : 1.1;
  const key = event.key.toLowerCase();
  const handlers: Record<string, () => void> = {
    arrowup: () => applyCadAxisAction("up", setViewport, step),
    arrowdown: () => applyCadAxisAction("down", setViewport, step),
    arrowleft: () => applyCadAxisAction("left", setViewport, step),
    arrowright: () => applyCadAxisAction("right", setViewport, step),
    w: () =>
      applyCadAxisAction("up", setViewport, step),
    s: () => applyCadAxisAction("down", setViewport, step),
    a: () => applyCadAxisAction("left", setViewport, step),
    d: () => applyCadAxisAction("right", setViewport, step),
    "+": () =>
      setViewport((current) => ({
        ...current,
        zoom: Math.min(30, current.zoom * zoomStep),
      })),
    "=": () =>
      setViewport((current) => ({
        ...current,
        zoom: Math.min(30, current.zoom * zoomStep),
      })),
    "-": () =>
      setViewport((current) => ({
        ...current,
        zoom: Math.max(0.08, current.zoom / zoomStep),
      })),
    r: () => applyCadAxisAction("reset", setViewport, step),
  };
  const handler = handlers[key];
  if (!handler) return;
  event.preventDefault();
  handler();
}

function OcctModelViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [selectedObjectUuid, setSelectedObjectUuid] = useState<string | null>(
    null,
  );
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: "loading",
    message: "正在打开 Prengine 模型...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadOcct() {
      setState({
        status: "loading",
        message: "正在打开 Prengine 模型...",
      });

      try {
        const ext = (
          file.localFile?.ext || extensionOf(file.name)
        ).toLowerCase();
        const fileVersion =
          file.localFile?.checksum ??
          file.checksum ??
          file.updatedAt ??
          file.size;
        const cacheKey = occtMeshCacheKey(fileVersion, sourceUrl, ext);
        const meshes = await readOcctMeshes(cacheKey, sourceUrl, ext);

        const preview = buildOcctGroup(meshes, {
          sourceFormat: ext,
          sourceName: file.name,
          mimeType: file.mimeType,
          routeLabel: `${prengineLabel} · CAD 模型`,
        });
        activeGroup = preview.group;

        if (!cancelled) {
          setSelectedObjectUuid(findFirstMesh(preview.group)?.uuid ?? null);
          setState({ status: "ready", value: preview });
        } else {
          disposeGroup(preview.group);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadOcct();

    return () => {
      cancelled = true;
      if (activeGroup) disposeGroup(activeGroup);
    };
  }, [
    file.checksum,
    file.localFile?.checksum,
    file.localFile?.ext,
    file.mimeType,
    file.name,
    file.size,
    file.updatedAt,
    sourceUrl,
  ]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="Prengine 模型打开失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const ext = file.localFile?.ext || extensionOf(file.name);
  const routeLabel = `${prengineLabel} · CAD 模型`;
  const selectedObject =
    findMeshByUuid(state.value.group, selectedObjectUuid) ??
    findFirstMesh(state.value.group);
  const selectedRows = selectedObject
    ? buildExchangeObjectPropertyRows(selectedObject, file, routeLabel)
    : undefined;
  const metrics: ViewerMetric[] = [
    { label: "Mesh", value: state.value.meshCount.toLocaleString() },
    { label: "顶点", value: state.value.vertexCount.toLocaleString() },
    { label: "三角面", value: state.value.faceCount.toLocaleString() },
    { label: "格式", value: ext },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={routeLabel}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={routeLabel}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={selectedRows}
          selectedTitle={selectedObject?.name || "构件 / 文件属性"}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
    >
      <ThreeGroupViewport
        group={state.value.group}
        label={file.name}
        status={`${prengineLabel} · CAD 模型`}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showChrome={false}
        selectedObjectUuid={selectedObjectUuid}
        onObjectSelect={(object) => setSelectedObjectUuid(object.uuid)}
      />
    </EngineeringViewportFrame>
  );
}

function findFirstMesh(group: Group | null): Mesh | null {
  if (!group) return null;
  let result: Mesh | null = null;
  group.traverse((object) => {
    if (result || !(object instanceof Mesh)) return;
    result = object;
  });
  return result;
}

function findMeshByUuid(group: Group | null, uuid: string | null): Mesh | null {
  if (!group || !uuid) return null;
  let result: Mesh | null = null;
  group.traverse((object) => {
    if (result || !(object instanceof Mesh) || object.uuid !== uuid) return;
    result = object;
  });
  return result;
}

function findNearestMesh(object: Object3D): Mesh | null {
  if (object instanceof Mesh) return object;
  let current: Object3D | null = object.parent;
  while (current) {
    if (current instanceof Mesh) return current;
    current = current.parent;
  }
  return null;
}

function ThreeGroupViewport({
  group,
  label,
  status,
  upAxis = "z",
  selectedExpressID = null,
  selectedObjectUuid = null,
  onMeshSelect,
  onObjectSelect,
  className,
  showChrome = true,
}: {
  group: Group | null;
  label: string;
  status: string;
  upAxis?: ModelUpAxis;
  selectedExpressID?: number | null;
  selectedObjectUuid?: string | null;
  onMeshSelect?: (expressID: number) => void;
  onObjectSelect?: (object: Mesh) => void;
  className?: string;
  showChrome?: boolean;
}) {
  const [viewTransform, setViewTransform] =
    useState<ViewTransform>(defaultViewTransform);

  useEffect(() => {
    if (!group) return;
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = meshMaterialList(object);
      const baseColor = colorTupleFromUserData(object.userData.baseColor);
      const isSelected =
        object.userData.expressID === selectedExpressID ||
        object.uuid === selectedObjectUuid;
      materials.forEach((material) => {
        applyMeshSelectionMaterialState(material, isSelected, baseColor);
      });
    });
  }, [group, selectedExpressID, selectedObjectUuid]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    const nearestMesh = findNearestMesh(event.object);
    const expressID =
      findExpressID(event.object) ??
      findFaceExpressID(event.object, event.faceIndex ?? null);
    if (!expressID && !nearestMesh) return;
    event.stopPropagation();
    if (expressID) onMeshSelect?.(expressID);
    if (nearestMesh) onObjectSelect?.(nearestMesh);
  }

  const renderOffset = vectorUserData(group?.userData.renderOffset);
  const baseRotationX = upAxis === "z" ? -Math.PI / 2 : 0;
  const modelMoveStep = useMemo(() => modelAxisMoveStep(group), [group]);

  return (
    <section
      className={
        className ??
        "relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      }
      tabIndex={0}
      onKeyDown={(event) =>
        handleModelKeyDown(event, setViewTransform, modelMoveStep)
      }
    >
      {showChrome ? (
        <>
          <div className="viewer-floating-panel absolute left-4 top-4 z-10 rounded-md px-4 py-2 text-sm text-white">
            <p className="font-medium">{status}</p>
            <p className="mt-1 max-w-[32rem] truncate text-xs text-slate-300">
              {label}
            </p>
            {renderOffset ? (
              <p className="mt-1 max-w-[32rem] truncate text-[11px] text-emerald-300">
                原生坐标保留，视图偏移 {formatCoord(renderOffset.x)},{" "}
                {formatCoord(renderOffset.y)}, {formatCoord(renderOffset.z)}
              </p>
            ) : null}
          </div>
          <div className="absolute right-4 top-4 z-10 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewTransform(defaultViewTransform)}
              className="viewer-ghost-tool rounded-md px-3 py-2 text-sm font-medium text-white"
              title="重置模型坐标、旋转和比例"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}
      <ModelSixAxisControlPanel
        onAction={(action) =>
          applyModelAxisAction(action, setViewTransform, modelMoveStep)
        }
      />
      <Canvas
        shadows="percentage"
        camera={{ position: [12, 10, 12], fov: 45 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#020817"]} />
        <ambientLight intensity={0.58} />
        <directionalLight position={[10, 14, 10]} intensity={1.15} castShadow />
        <Environment preset="city" />
        <Grid
          infiniteGrid
          position={[0, 0, 0]}
          fadeDistance={80}
          sectionColor="#1f9f7a"
          cellColor="#1e293b"
        />
        <axesHelper args={[8]} />
        {group ? (
          <>
            <FitModelCamera group={group} />
            <group
              position={[
                viewTransform.offsetX,
                viewTransform.offsetY,
                viewTransform.offsetZ,
              ]}
              rotation={[
                baseRotationX + viewTransform.rotateX,
                viewTransform.rotateY,
                viewTransform.rotateZ,
              ]}
              scale={viewTransform.scale}
            >
              <primitive object={group} onClick={handleClick} />
            </group>
          </>
        ) : null}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          panSpeed={1.45}
          zoomSpeed={0.85}
          target={[0, 0, 0]}
        />
      </Canvas>
    </section>
  );
}

function modelAxisMoveStep(group: Group | null): number {
  if (!group) return 80;
  const box = new Box3().setFromObject(group);
  if (box.isEmpty()) return 80;
  const size = box.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) return 80;
  return clampNumber(maxDimension * 0.06, 80, 5000);
}

function FitModelCamera({ group }: { group: Group }) {
  const { camera } = useThree();

  useEffect(() => {
    const box = new Box3().setFromObject(group);
    if (box.isEmpty()) return;

    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const finiteValues = [size.x, size.y, size.z, center.x, center.y, center.z];
    if (!finiteValues.every(Number.isFinite)) {
      camera.position.set(80, 55, 80);
      camera.lookAt(0, 0, 0);
      applyCameraClipping(camera, 0.1, 10000);
      return;
    }
    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const fov =
      "fov" in camera && typeof camera.fov === "number" ? camera.fov : 45;
    const distance =
      (maxDimension / (2 * Math.tan(degreesToRadians(fov) / 2))) * 1.45;
    const target = new Vector3(0, 0, 0);

    camera.position.set(
      target.x + distance * 0.72,
      target.y + distance * 0.58,
      target.z + distance * 0.72,
    );
    camera.lookAt(target);
    applyCameraClipping(
      camera,
      Math.max(distance / 1000, 0.01),
      Math.max(distance * 20, maxDimension * 20),
    );
  }, [camera, group]);

  return null;
}

type ClippableCamera = {
  near: number;
  far: number;
  updateProjectionMatrix: () => void;
};

function isClippableCamera(camera: unknown): camera is ClippableCamera {
  return (
    typeof camera === "object" &&
    camera !== null &&
    "near" in camera &&
    "far" in camera &&
    "updateProjectionMatrix" in camera &&
    typeof (camera as { updateProjectionMatrix?: unknown })
      .updateProjectionMatrix === "function"
  );
}

function applyCameraClipping(camera: unknown, near: number, far: number) {
  if (!isClippableCamera(camera)) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

function handleModelKeyDown(
  event: KeyboardEvent<HTMLElement>,
  setViewTransform: Dispatch<SetStateAction<ViewTransform>>,
  baseMoveStep = 80,
) {
  const moveStep = event.shiftKey ? baseMoveStep * 4 : baseMoveStep;
  const rotateStep = event.shiftKey ? 0.18 : 0.08;
  const key = event.key.toLowerCase();
  const handlers: Record<string, () => void> = {
    arrowup: () => applyModelAxisAction("up", setViewTransform, moveStep),
    arrowdown: () => applyModelAxisAction("down", setViewTransform, moveStep),
    arrowleft: () => applyModelAxisAction("left", setViewTransform, moveStep),
    arrowright: () => applyModelAxisAction("right", setViewTransform, moveStep),
    pageup: () => applyModelAxisAction("front", setViewTransform, moveStep),
    pagedown: () => applyModelAxisAction("back", setViewTransform, moveStep),
    w: () => applyModelAxisAction("front", setViewTransform, moveStep),
    s: () => applyModelAxisAction("back", setViewTransform, moveStep),
    a: () => applyModelAxisAction("left", setViewTransform, moveStep),
    d: () => applyModelAxisAction("right", setViewTransform, moveStep),
    q: () =>
      setViewTransform((current) => ({
        ...current,
        rotateZ: current.rotateZ - rotateStep,
      })),
    e: () =>
      setViewTransform((current) => ({
        ...current,
        rotateZ: current.rotateZ + rotateStep,
      })),
    z: () =>
      setViewTransform((current) => ({
        ...current,
        scale: Math.max(0.1, current.scale * 0.92),
      })),
    x: () =>
      setViewTransform((current) => ({
        ...current,
        scale: Math.min(10, current.scale * 1.08),
      })),
    r: () => setViewTransform(defaultViewTransform),
  };
  const handler = handlers[key];
  if (!handler) return;
  event.preventDefault();
  handler();
}

async function getOcctRuntime(): Promise<OcctRuntime> {
  if (!occtRuntimePromise) {
    occtRuntimePromise = import("occt-import-js").then(
      ({ default: occtimportjs }) =>
        occtimportjs({
          locateFile: (path) => `/wasm/occt-import-js/${path}`,
        }),
    );
  }
  return occtRuntimePromise;
}

function occtMeshCacheKey(
  fileVersion: string | number | undefined,
  sourceUrl: string,
  ext: string,
): string {
  return [sourceUrl, ext, fileVersion ?? "unknown"].join(":");
}

function readOcctMeshes(
  cacheKey: string,
  sourceUrl: string,
  ext: string,
): Promise<OcctMesh[]> {
  const cached = occtMeshCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const runtimePromise = getOcctRuntime();
    const response = await fetch(sourceUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`读取 CAD 文件失败: HTTP ${response.status}`);
    }
    const content = new Uint8Array(await response.arrayBuffer());
    const occt = await runtimePromise;
    const params = {
      linearUnit: "millimeter" as const,
      linearDeflectionType: "bounding_box_ratio" as const,
      linearDeflection: 0.02,
      angularDeflection: 1.2,
    };
    const result =
      ext === ".brep"
        ? occt.ReadBrepFile(content, params)
        : ext === ".iges" || ext === ".igs"
          ? occt.ReadIgesFile(content, params)
          : occt.ReadStepFile(content, params);

    if (!result.success || !result.meshes?.length) {
      throw new Error(result.error ?? "Prengine 未生成可渲染模型。");
    }

    return result.meshes;
  })().catch((error) => {
    occtMeshCache.delete(cacheKey);
    throw error;
  });

  occtMeshCache.set(cacheKey, promise);
  return promise;
}

async function loadThreeSourcePreview(
  sourceUrl: string,
  options: ExchangeMeshBuildOptions,
): Promise<OcctPreview> {
  const sourceObject = await loadThreeSourceObject(
    sourceUrl,
    options.sourceFormat.toLowerCase(),
  );
  return buildThreeExchangeGroup(sourceObject, options);
}

async function loadThreeSourceObject(
  sourceUrl: string,
  ext: string,
): Promise<Object3D> {
  if (ext === ".glb" || ext === ".gltf") {
    const gltf = await new GLTFLoader().loadAsync(sourceUrl);
    return gltf.scene;
  }

  if (ext === ".ply") {
    const geometry = await new PLYLoader().loadAsync(sourceUrl);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const material = new MeshStandardMaterial({
      color: neutralEngineeringMeshColor.clone(),
      metalness: 0.12,
      roughness: 0.42,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = sourceUrl.split("/").pop() || "PLY mesh";
    return mesh;
  }

  if (ext === ".dae") {
    const collada = await new ColladaLoader().loadAsync(sourceUrl);
    if (!collada) {
      throw new Error("Collada 模型加载失败：未返回可渲染场景。");
    }
    return collada.scene;
  }

  if (ext === ".3dm") {
    const loader = new Rhino3dmLoader();
    loader.setLibraryPath("/wasm/rhino3dm/");
    try {
      return await loader.loadAsync(sourceUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `3DM 真实查看需要 rhino3dm/OpenNURBS WASM 运行库（/wasm/rhino3dm/rhino3dm.js 与 rhino3dm.wasm）。当前不会用伪模型替代源文件。${message}`,
      );
    }
  }

  throw new Error(`当前格式 ${ext || "unknown"} 尚未接入 Prengine Three 模型查看器。`);
}

function buildThreeExchangeGroup(
  sourceObject: Object3D,
  options: ExchangeMeshBuildOptions,
): OcctPreview {
  const group = new Group();
  group.name = options.sourceName;
  group.userData = {
    sourceFormat: options.sourceFormat,
    routeLabel: options.routeLabel,
    originalName: options.sourceName,
  };
  group.add(sourceObject);
  annotateThreeExchangeMeshes(group, options);
  normalizeThreeGroupReferencePlane(group, "y");
  return buildThreeGroupPreview(group);
}

function annotateThreeExchangeMeshes(
  group: Group,
  options: ExchangeMeshBuildOptions,
) {
  let ordinal = 0;
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    ordinal += 1;
    object.castShadow = true;
    object.receiveShadow = true;
    object.geometry.computeBoundingBox();
    const nativeBounds = new Box3().setFromObject(object);
    const serializedBounds = nativeBounds.isEmpty()
      ? null
      : boxToSerializableBounds(nativeBounds);
    const dimensions = serializedBounds
      ? boundsDimensions(serializedBounds)
      : null;
    const center = serializedBounds ? boundsCenter(serializedBounds) : null;
    const stats = meshGeometryStats(object.geometry);
    const baseColor = firstMeshMaterialColor(object) ?? [
      neutralEngineeringMeshColor.r,
      neutralEngineeringMeshColor.g,
      neutralEngineeringMeshColor.b,
    ];
    const displayName = readableThreeObjectName(object, options, ordinal);
    const componentId = readableEngineeringText(
      stringUserData(object.userData.componentId) ||
        stringUserData(threeObjectAttributes(object).id),
      `${options.sourceName}:${ordinal}`,
    );
    const materialSource = describeMeshMaterials(object, baseColor);

    meshMaterialList(object).forEach((material) => {
      prepareSelectableMaterial(material);
    });

    object.name = displayName;
    object.userData = {
      ...object.userData,
      baseColor,
      componentId,
      objectType:
        readableEngineeringText(stringUserData(object.userData.objectType), "") ||
        `${options.sourceFormat.toUpperCase()} mesh`,
      sourceFormat: options.sourceFormat,
      sourceName: displayName,
      routeLabel: options.routeLabel,
      geometryExpression: `${stats.vertexCount.toLocaleString()} vertices / ${stats.faceCount.toLocaleString()} faces`,
      materialSource,
      sourceProperties: [
        { label: "源格式", value: options.sourceFormat },
        { label: "源 Mesh 序号", value: String(ordinal) },
        { label: "源 Mesh 名称", value: displayName },
        { label: "顶点", value: stats.vertexCount.toLocaleString() },
        { label: "三角面", value: stats.faceCount.toLocaleString() },
      ],
      ...(serializedBounds
        ? {
            nativeBounds: serializedBounds,
            nativeCenterMm: center,
            dimensionsMm: dimensions,
          }
        : {}),
    };
  });
}

function buildThreeGroupPreview(group: Group): OcctPreview {
  let meshCount = 0;
  let vertexCount = 0;
  let faceCount = 0;
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount += 1;
    const stats = meshGeometryStats(object.geometry);
    vertexCount += stats.vertexCount;
    faceCount += stats.faceCount;
  });
  return {
    meshCount,
    vertexCount,
    faceCount,
    group,
  };
}

function readableThreeObjectName(
  object: Mesh,
  options: ExchangeMeshBuildOptions,
  ordinal: number,
): string {
  const attributes = threeObjectAttributes(object);
  const fallback = `${stripFileExtension(options.sourceName)} 构件 ${ordinal}`;
  return readableEngineeringText(
    stringUserData(object.userData.sourceName) ||
      stringUserData(attributes.name) ||
      object.name,
    fallback,
  );
}

function threeObjectAttributes(object: Mesh): Record<string, unknown> {
  const attributes = object.userData.attributes;
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? (attributes as Record<string, unknown>)
    : {};
}

function stripFileExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "") || name;
}

function findExpressID(object: object): number | null {
  const maybeObject = object as {
    userData?: Record<string, unknown>;
    parent?: unknown;
  };
  const expressID = maybeObject.userData?.expressID;
  if (typeof expressID === "number") return expressID;
  if (maybeObject.parent && typeof maybeObject.parent === "object") {
    return findExpressID(maybeObject.parent);
  }
  return null;
}

function findFaceExpressID(
  object: Object3D,
  faceIndex: number | null,
): number | null {
  if (faceIndex === null) return null;
  const mesh = findNearestMesh(object);
  if (!mesh) return null;
  const index = mesh.geometry.getIndex();
  const expressID = mesh.geometry.getAttribute("expressID");
  if (!index || !expressID) return null;
  const vertexIndex = index.getX(faceIndex * 3);
  const value = expressID.getX(vertexIndex);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function LoadingPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="relative flex min-h-[calc(100vh-220px)] items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950/95 p-4 text-center shadow-xl">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
        <p className="mt-3 truncate text-sm font-medium">{title}</p>
        <p className="mt-2 text-xs leading-5 text-slate-300">{message}</p>
      </div>
    </section>
  );
}

function AdapterRequiredPanel({
  title,
  file,
  reason,
}: {
  title: string;
  file: ModuleFileNode;
  reason: string;
}) {
  return (
    <section className="arch-card rounded-lg p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="arch-primary-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="arch-text text-lg font-medium">{title}</h3>
          <p className="arch-muted mt-2 max-w-4xl text-sm leading-6">
            {reason}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="格式"
              value={file.localFile?.ext || extensionOf(file.name) || "unknown"}
            />
            <MetricCard label="MIME" value={file.mimeType} />
            <MetricCard label="大小" value={formatModuleFileSize(file.size)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SketchUpPrenginePendingViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const [state, setState] = useState<LoadState<SkpDerivativeManifest>>({
    status: "loading",
    message: "正在请求 Prengine SKP 真实解析...",
  });

  useEffect(() => {
    if (!localFileId) return;
    const fileId = localFileId;
    let cancelled = false;

    async function loadManifest() {
      setState({
        status: "loading",
        message: "正在请求 Prengine SKP 真实解析...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/skp-derivative?format=manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "Prengine SKP 解析失败"),
          );
        }
        const manifest = (await response.json()) as SkpDerivativeManifest;
        if (!cancelled) {
          setState({ status: "ready", value: manifest });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, [localFileId]);

  if (!localFileId) {
    return (
      <LightweightEngineeringSourceViewer
        title="SKP 源文件查看"
        file={file}
        sourceUrl={sourceUrl}
        reason="当前文件没有绑定本地源文件 ID，无法启动 Prengine SKP 真实解析。"
      />
    );
  }

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="SKP Prengine 解析失败"
        file={file}
        reason={`${state.message}。SKP 是私有模型格式，前端不会用字节预览或伪模型替代真实构件模型。`}
      />
    );
  }

  const manifest = state.value;
  if (!manifest.permissions.canView || !manifest.derivativeArtifact) {
    return (
      <AdapterRequiredPanel
        title="SKP 真实模型未生成"
        file={file}
        reason={
          manifest.notes[0] ??
          "需要配置 Prengine SKP 授权适配器生成真实模型、材质和属性清单。"
        }
      />
    );
  }

  return (
    <SketchUpDerivativeModelViewer
      file={file}
      sourceUrl={sourceUrl}
      manifest={manifest}
    />
  );
}

function SketchUpDerivativeModelViewer({
  file,
  sourceUrl,
  manifest,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  manifest: SkpDerivativeManifest;
}) {
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: "loading",
    message: "正在加载 Prengine SKP 模型...",
  });
  const glbUrl = manifest.derivativeArtifact?.url;

  useEffect(() => {
    if (!glbUrl) return;
    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      glbUrl,
      (gltf) => {
        if (cancelled) return;
        setState({
          status: "ready",
          value: buildThreeGroupPreview(
            buildSketchUpThreeGroup(gltf.scene, file, manifest),
          ),
        });
      },
      undefined,
      (error) => {
        if (cancelled) return;
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [file, glbUrl, manifest]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="SKP 模型加载失败"
        file={file}
        reason={`${state.message}。请检查 Prengine SKP 派生结果是否为有效 GLB 模型。`}
      />
    );
  }

  return (
    <ExchangeModelWorkbench
      file={file}
      sourceUrl={sourceUrl}
      preview={state.value}
      routeLabel={`${prengineLabel} · SKP 真实解析`}
      status="Prengine SKP 真实模型"
      formatLabel=".skp"
      upAxis={groupModelUpAxis(state.value.group)}
    />
  );
}

function buildSketchUpThreeGroup(
  scene: Object3D,
  file: ModuleFileNode,
  manifest: SkpDerivativeManifest,
): Group {
  const group = new Group();
  group.name = file.name;
  group.userData = {
    sourceFormat: ".skp",
    routeLabel: `${prengineLabel} · SKP 真实解析`,
    originalName: manifest.originalName,
  };
  group.add(scene);

  let ordinal = 0;
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    ordinal += 1;
    const nativeBounds = new Box3().setFromObject(object);
    const serializedBounds = nativeBounds.isEmpty()
      ? undefined
      : boxToSerializableBounds(nativeBounds);
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const baseMaterial = materials.find(
      (material) =>
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial,
    );
    const baseColor: [number, number, number] =
      baseMaterial instanceof MeshStandardMaterial ||
      baseMaterial instanceof MeshBasicMaterial
        ? [
            baseMaterial.color.r,
            baseMaterial.color.g,
            baseMaterial.color.b,
          ]
        : [0.72, 0.72, 0.72];

    materials.forEach((material) => {
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial
      ) {
        material.toneMapped = false;
        material.needsUpdate = true;
      }
    });

    object.userData = {
      ...object.userData,
      componentId: object.uuid,
      sourceName: object.name || `${file.name} 构件 ${ordinal}`,
      sourceFormat: ".skp",
      objectType: object.userData.objectType ?? "SketchUp Component",
      routeLabel: `${prengineLabel} · SKP 真实解析`,
      materialSource: `${prengineLabel} 源材质/颜色`,
      baseColor,
      ...(serializedBounds
        ? {
            nativeBounds: serializedBounds,
            dimensionsMm: boundsDimensions(serializedBounds),
            nativeCenterMm: boundsCenter(serializedBounds),
          }
        : {}),
    };
  });
  normalizeThreeGroupReferencePlane(group, "y");
  return group;
}

function LightweightEngineeringSourceViewer({
  title,
  file,
  sourceUrl,
  reason,
}: {
  title: string;
  file: ModuleFileNode;
  sourceUrl: string;
  reason: string;
}) {
  const [state, setState] = useState<LoadState<SourcePreview>>({
    status: "loading",
    message: "正在读取 Prengine 文件状态...",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSourcePreview() {
      setState({
        status: "loading",
        message: "正在读取 Prengine 文件状态...",
      });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "读取源文件失败"),
          );
        }
        const preview = buildSourcePreview(file, await response.arrayBuffer());
        if (!cancelled) {
          setState({ status: "ready", value: preview });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void loadSourcePreview();

    return () => {
      cancelled = true;
    };
  }, [file, sourceUrl]);

  const embeddedPreviewUrl = useEmbeddedPreviewUrl(
    state.status === "ready" ? state.value.embeddedPreview : undefined,
  );

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title={title}
        file={file}
        reason={`${reason} 文件状态读取失败：${state.message}`}
      />
    );
  }

  const preview = state.value;
  const metrics: ViewerMetric[] = [
    {
      label: "格式",
      value: file.localFile?.ext || extensionOf(file.name) || "unknown",
    },
    { label: "大小", value: formatModuleFileSize(preview.byteLength) },
    { label: "MIME", value: preview.mimeType },
    { label: "引擎", value: prengineLabel },
    { label: "状态", value: preview.embeddedPreview ? "有预览图" : "待生成" },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={`${prengineLabel} · 源文件状态`}
      toolbarActions={
        <a
          href={sourceUrl}
          download={file.name}
          className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
          title="下载源文件"
          aria-label="下载源文件"
        >
          <Download className="h-4 w-4" />
        </a>
      }
    >
      <div className="absolute inset-0 overflow-auto bg-slate-950 p-4 text-slate-100">
        <div className="grid min-h-full place-items-center">
          <section className="w-full max-w-4xl rounded-md border border-slate-800 bg-slate-900/72 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-300">{title}</p>
                <h3 className="mt-1 break-words text-lg font-medium text-white">
                  {file.name}
                </h3>
              </div>
              <a
                href={sourceUrl}
                download={file.name}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
              >
                <Download className="h-4 w-4" />
                源文件
              </a>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{reason}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetricCard label="文件类型" value={preview.registryLabel} />
              <MetricCard
                label="源文件绑定"
                value={file.localFileId ?? file.localFile?.fileId ?? file.id}
              />
              <MetricCard label="查看结果" value="待 Prengine 生成" />
            </div>
            {embeddedPreviewUrl && preview.embeddedPreview ? (
              <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3">
                <p className="text-xs font-medium text-emerald-200">
                  源文件内嵌预览图
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  该图来自源文件内嵌缩略图，不作为几何解析结果；正式查看结果仍由
                  Prengine 生成。
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={embeddedPreviewUrl}
                  alt={`${file.name} ${preview.embeddedPreview.label}`}
                  className="mt-3 max-h-[52vh] max-w-full rounded-md border border-slate-700 bg-white object-contain"
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </EngineeringViewportFrame>
  );
}

function buildSourcePreview(
  file: ModuleFileNode,
  buffer: ArrayBuffer,
): SourcePreview {
  const bytes = new Uint8Array(buffer);
  const head = bytes.subarray(0, Math.min(bytes.length, 4096));
  const signatureBytes = bytes.subarray(0, Math.min(bytes.length, 16));
  const isProbablyText = looksLikeText(head);
  const asciiPreview = sanitizePreviewText(
    isProbablyText ? new TextDecoder("utf-8").decode(head) : bytesToAscii(head),
  );
  const registryEntry = fileTypeForFileName(file.name);
  const embeddedPreview = extractEmbeddedRasterPreview(bytes);

  return {
    byteLength: buffer.byteLength,
    signature: bytesToHex(signatureBytes, false),
    mimeType:
      file.mimeType || registryEntry?.mimeType || "application/octet-stream",
    registryLabel: registryEntry?.label ?? "Unregistered engineering source",
    routeLabel: `${prengineLabel} · 源文件状态`,
    asciiPreview,
    hexPreview: bytesToHexDump(head),
    isProbablyText,
    ...(embeddedPreview ? { embeddedPreview } : {}),
  };
}

function useEmbeddedPreviewUrl(
  preview: EmbeddedRasterPreview | undefined,
): string | null {
  const url = useMemo(() => {
    if (!preview) return null;
    return URL.createObjectURL(
      new Blob([uint8ToArrayBuffer(preview.bytes)], {
        type: preview.mimeType,
      }),
    );
  }, [preview]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (!bytes.length) return true;
  let printable = 0;
  for (const byte of bytes) {
    if (
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126) ||
      byte >= 128
    ) {
      printable += 1;
    }
  }
  return printable / bytes.length > 0.86;
}

function sanitizePreviewText(value: string): string {
  return value.replace(/\0/g, ".").replace(/\r\n/g, "\n").slice(0, 6000);
}

function extractEmbeddedRasterPreview(
  bytes: Uint8Array,
): EmbeddedRasterPreview | undefined {
  const scan = bytes.subarray(0, Math.min(bytes.length, 64 * 1024 * 1024));
  const pngStart = indexOfBytes(
    scan,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  if (pngStart >= 0) {
    const iend = indexOfAscii(scan, "IEND", pngStart + 8);
    if (iend >= 0 && iend + 8 <= scan.length) {
      return {
        mimeType: "image/png",
        bytes: scan.slice(pngStart, iend + 8),
        label: "PNG preview",
      };
    }
  }

  const jpgStart = indexOfBytes(scan, [0xff, 0xd8, 0xff]);
  if (jpgStart >= 0) {
    const jpgEnd = indexOfBytes(scan, [0xff, 0xd9], jpgStart + 3);
    if (jpgEnd >= 0) {
      return {
        mimeType: "image/jpeg",
        bytes: scan.slice(jpgStart, jpgEnd + 2),
        label: "JPEG preview",
      };
    }
  }

  const bmpStart = indexOfBytes(scan, [0x42, 0x4d]);
  if (bmpStart >= 0 && bmpStart + 6 <= scan.length) {
    const size =
      (scan[bmpStart + 2] ?? 0) |
      ((scan[bmpStart + 3] ?? 0) << 8) |
      ((scan[bmpStart + 4] ?? 0) << 16) |
      ((scan[bmpStart + 5] ?? 0) << 24);
    if (
      size > 54 &&
      size <= 16 * 1024 * 1024 &&
      bmpStart + size <= scan.length
    ) {
      return {
        mimeType: "image/bmp",
        bytes: scan.slice(bmpStart, bmpStart + size),
        label: "BMP preview",
      };
    }
  }

  return undefined;
}

function indexOfAscii(bytes: Uint8Array, value: string, from = 0): number {
  return indexOfBytes(
    bytes,
    Array.from(value, (char) => char.charCodeAt(0)),
    from,
  );
}

function indexOfBytes(bytes: Uint8Array, needle: number[], from = 0): number {
  if (!needle.length || bytes.length < needle.length) return -1;
  const max = bytes.length - needle.length;
  for (let index = Math.max(0, from); index <= max; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function bytesToAscii(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, Math.min(bytes.length, 2048)))
    .map((byte) =>
      byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".",
    )
    .join("");
}

function bytesToHex(bytes: Uint8Array, grouped = true): string {
  const values = Array.from(bytes).map((byte) =>
    byte.toString(16).padStart(2, "0"),
  );
  return grouped ? values.join(" ") : values.join("");
}

function bytesToHexDump(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16);
    const hex = bytesToHex(chunk).padEnd(47, " ");
    const ascii = bytesToAscii(chunk);
    lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted rounded-lg border px-3 py-3">
      <p className="arch-muted text-[11px] font-medium">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function SummaryGrid({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: MetricItem[];
  compact?: boolean;
}) {
  return (
    <section
      className={
        compact
          ? "rounded-md border border-[var(--arch-border)] p-3"
          : "arch-card rounded-lg p-4"
      }
    >
      <h3 className="arch-text text-base font-medium">{title}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="arch-card-muted rounded-lg border px-3 py-2"
          >
            <p className="arch-text truncate text-sm font-medium">
              {item.label}
            </p>
            <p className="arch-primary-text mt-1 text-xs font-medium">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildIfcTopTypes(api: WebIfc.IfcAPI, modelID: number): MetricItem[] {
  return api
    .GetAllTypesOfModel(modelID)
    .map((type) => ({
      label: type.typeName,
      value: api
        .GetLineIDsWithType(modelID, type.typeID, false)
        .size()
        .toLocaleString(),
      rawCount: api.GetLineIDsWithType(modelID, type.typeID, false).size(),
    }))
    .sort((left, right) => right.rawCount - left.rawCount)
    .slice(0, 24)
    .map(({ label, value }) => ({ label, value }));
}

function buildIfcKeyCounts(
  ifc: typeof import("web-ifc"),
  api: WebIfc.IfcAPI,
  modelID: number,
): MetricItem[] {
  const items: MetricItem[] = [];

  for (const [constantName, label] of ifcKeyTypes) {
    const typeID = ifc[constantName];
    if (typeof typeID !== "number") continue;
    const value = api
      .GetLineIDsWithType(modelID, typeID, true)
      .size()
      .toLocaleString();
    items.push({ label, value });
  }

  return items;
}

function buildIfcGroup(
  api: WebIfc.IfcAPI,
  modelID: number,
  lengthUnit: LengthDisplayUnit = meterLengthUnit,
): IfcGeometryPreview {
  const group = new Group();
  const elementMap = new Map<number, IfcElementProperties>();
  const elementBounds = new Map<number, Box3>();
  let totalMeshes = 0;
  let renderedFragments = 0;
  let truncated = false;

  api.StreamAllMeshes(modelID, (flatMesh) => {
    totalMeshes += 1;
    const element = readIfcElementProperties(api, modelID, flatMesh.expressID);
    if (element) {
      elementMap.set(element.expressID, element);
    }

    for (let index = 0; index < flatMesh.geometries.size(); index += 1) {
      if (renderedFragments >= maxIfcFragments) {
        truncated = true;
        break;
      }

      const placedGeometry = flatMesh.geometries.get(index);
      const geometry = api.GetGeometry(
        modelID,
        placedGeometry.geometryExpressID,
      );
      const vertexData = api.GetVertexArray(
        geometry.GetVertexData(),
        geometry.GetVertexDataSize(),
      );
      const indexData = api.GetIndexArray(
        geometry.GetIndexData(),
        geometry.GetIndexDataSize(),
      );
      const meshGeometry = geometryFromIfcArrays(vertexData, indexData);
      const matrix = new Matrix4().fromArray(placedGeometry.flatTransformation);
      meshGeometry.applyMatrix4(matrix);
      meshGeometry.computeBoundingBox();
      const meshBounds = meshGeometry.boundingBox?.clone() ?? null;
      if (meshBounds && !meshBounds.isEmpty()) {
        const existingBounds = elementBounds.get(flatMesh.expressID);
        if (existingBounds) {
          existingBounds.union(meshBounds);
        } else {
          elementBounds.set(flatMesh.expressID, meshBounds.clone());
        }
      }

      const color = placedGeometry.color;
      const displayColor = ifcDisplayColor([color.x, color.y, color.z]);
      if (element) {
        element.sourceColor = `${formatRgbColor(displayColor)} / alpha ${formatCoord(color.w)}`;
      }
      const material = new MeshStandardMaterial({
        color: new Color(displayColor[0], displayColor[1], displayColor[2]),
        opacity: Math.max(0.18, Math.min(color.w, 1)),
        transparent: color.w < 0.98,
        roughness: 0.55,
        metalness: 0.08,
        side: DoubleSide,
      });
      const mesh = new Mesh(meshGeometry, material);
      mesh.userData = {
        expressID: flatMesh.expressID,
        ifcType: element?.type ?? "IFCENTITY",
        ifcName: element?.name ?? "",
        baseColor: displayColor,
        materialSource: `IFC source color ${formatRgbColor(displayColor)} / alpha ${formatCoord(color.w)}`,
        sourceFormat: ".ifc",
        routeLabel: `${prengineLabel} · IFC 模型`,
        ...(meshBounds
          ? {
              nativeBounds: boxToSerializableBounds(meshBounds),
              dimensionsMm: vectorToSerializablePoint(
                meshBounds.getSize(new Vector3()),
              ),
              nativeCenterMm: vectorToSerializablePoint(
                meshBounds.getCenter(new Vector3()),
              ),
            }
          : {}),
      };
      group.add(mesh);
      renderedFragments += 1;
      disposeWebIfcHandle(geometry);
    }

    disposeWebIfcHandle(flatMesh.geometries);
    disposeWebIfcHandle(flatMesh);
  });

  for (const [expressID, bounds] of elementBounds) {
    const element = elementMap.get(expressID);
    if (!element) continue;
    element.geometryBounds = boxToSerializableBounds(bounds);
    element.geometryUnit = lengthUnit;
    mergeIfcElementDimensions(
      element,
      vectorToSerializablePoint(bounds.getSize(new Vector3())),
      lengthUnit,
      "mesh-bounds",
    );
    element.geometryCenter = vectorToSerializablePoint(
      bounds.getCenter(new Vector3()),
    );
  }

  const nativeBounds =
    renderedFragments > 0
      ? new Box3().setFromObject(group)
      : new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
  const renderOffset = new Vector3();
  const upAxis = inferIfcUpAxis(nativeBounds);

  if (renderedFragments > 0 && !nativeBounds.isEmpty()) {
    const center = nativeBounds.getCenter(new Vector3());
    if (upAxis === "y") {
      renderOffset.set(center.x, nativeBounds.min.y, center.z);
    } else {
      renderOffset.set(center.x, center.y, nativeBounds.min.z);
    }
    group.position.set(-renderOffset.x, -renderOffset.y, -renderOffset.z);
    group.userData.nativeBounds = nativeBounds.clone();
    group.userData.renderOffset = renderOffset.clone();
    group.userData.upAxis = upAxis;
  }

  return {
    group: renderedFragments > 0 ? group : null,
    totalMeshes,
    renderedFragments,
    truncated,
    nativeBounds,
    renderOffset,
    elements: Array.from(elementMap.values()).sort(
      (left, right) => left.expressID - right.expressID,
    ),
    upAxis,
  };
}

function ifcDisplayColor(
  sourceColor: [number, number, number],
): [number, number, number] {
  return sourceColor.map((channel) =>
    Number.isFinite(channel) ? Math.max(0, Math.min(1, channel)) : 1,
  ) as [number, number, number];
}

function formatRgbColor(color: [number, number, number]): string {
  return `rgb(${color
    .map((channel) => Math.round(clampNumber(channel, 0, 1) * 255))
    .join(", ")})`;
}

function inferIfcUpAxis(bounds: Box3): ModelUpAxis {
  if (bounds.isEmpty()) return "z";
  const size = bounds.getSize(new Vector3());

  if (!Number.isFinite(size.y) || !Number.isFinite(size.z)) return "z";
  if (size.y <= 0 || size.z <= 0) return "z";

  return size.y < size.z ? "y" : "z";
}

function readIfcElementProperties(
  api: WebIfc.IfcAPI,
  modelID: number,
  expressID: number,
): IfcElementProperties | null {
  try {
    const line = api.GetLine(modelID, expressID, false) as Record<
      string,
      unknown
    >;
    const type =
      typeof line.type === "number"
        ? api.GetNameFromTypeCode(line.type)
        : String(line.type ?? "IFCENTITY");
    const globalId = decodeEngineeringText(formatIfcValue(line.GlobalId));
    const name = decodeEngineeringText(formatIfcValue(line.Name));
    const objectType = decodeEngineeringText(formatIfcValue(line.ObjectType));
    const tag = decodeEngineeringText(formatIfcValue(line.Tag));
    const predefinedType = decodeEngineeringText(
      formatIfcValue(line.PredefinedType),
    );
    const properties = Object.entries(line)
      .filter(([key]) => key !== "type" && key !== "expressID")
      .map(([key, value]) => ({
        label: key,
        value: decodeEngineeringText(formatIfcValue(value)),
      }))
      .filter((item) => item.value.length > 0);

    return {
      expressID,
      type,
      globalId,
      name,
      objectType,
      tag,
      predefinedType,
      properties: [
        {
          label: ifcPropertyChineseLabels.ExpressID ?? "STEP编号",
          value: `#${expressID}`,
        },
        {
          label: ifcPropertyChineseLabels["IFC Type"] ?? "IFC类型",
          value: `${chineseIfcType(type)} · ${type}`,
        },
        ...properties,
      ],
    };
  } catch {
    return null;
  }
}

function formatIfcValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatIfcValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const typed = value as Record<string, unknown>;
    if ("value" in typed) return formatIfcValue(typed.value);
    if ("expressID" in typed && typeof typed.expressID === "number") {
      return `#${typed.expressID}`;
    }
  }
  return "";
}

function chineseIfcType(type: string): string {
  return ifcTypeChineseLabels[type] ?? type.replace(/^IFC/, "");
}

function disposeWebIfcHandle(handle: unknown) {
  const releasable = handle as { delete?: () => void };
  if (typeof releasable.delete === "function") {
    releasable.delete();
  }
}

function geometryFromIfcArrays(
  vertexData: Float32Array,
  indexData: Uint32Array,
): BufferGeometry {
  const vertexCount = Math.floor(vertexData.length / 6);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  for (let sourceIndex = 0; sourceIndex < vertexCount; sourceIndex += 1) {
    const sourceOffset = sourceIndex * 6;
    const targetOffset = sourceIndex * 3;
    positions[targetOffset] = vertexData[sourceOffset] ?? 0;
    positions[targetOffset + 1] = vertexData[sourceOffset + 1] ?? 0;
    positions[targetOffset + 2] = vertexData[sourceOffset + 2] ?? 0;
    normals[targetOffset] = vertexData[sourceOffset + 3] ?? 0;
    normals[targetOffset + 1] = vertexData[sourceOffset + 4] ?? 1;
    normals[targetOffset + 2] = vertexData[sourceOffset + 5] ?? 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indexData), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function decodeDxfBuffer(buffer: ArrayBuffer): DxfSourceText {
  const bytes = new Uint8Array(buffer);
  const asciiHeader = new TextDecoder("windows-1252").decode(
    bytes.subarray(0, Math.min(bytes.length, 16384)),
  );
  const codePage = detectDxfCodePage(asciiHeader);
  const preferredDecoder = decoderForDxfCodePage(codePage);
  const decoderCandidates = [
    preferredDecoder,
    "utf-8",
    "gb18030",
    "big5",
    "windows-1252",
  ].filter((value, index, values) => values.indexOf(value) === index);
  const decodedCandidates: DxfSourceText[] = [];

  for (const decoder of decoderCandidates) {
    try {
      decodedCandidates.push({
        text: new TextDecoder(decoder).decode(bytes),
        codePage,
        decoder,
      });
    } catch {
      // Try the next declared CAD code page.
    }
  }

  return (
    decodedCandidates.sort(
      (left, right) =>
        scoreDxfDecodedText(left, preferredDecoder) -
        scoreDxfDecodedText(right, preferredDecoder),
    )[0] ?? {
      text: new TextDecoder().decode(bytes),
      codePage,
      decoder: "utf-8",
    }
  );
}

function scoreDxfDecodedText(
  source: DxfSourceText,
  preferredDecoder: string,
): number {
  const text = source.text;
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  const mojibakeCount = (text.match(/[ÃÂ�]/g) ?? []).length;
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const declaredBonus = source.decoder === preferredDecoder ? -30 : 0;
  const chineseBonus = source.decoder === "gb18030" && cjkCount > 0 ? -20 : 0;
  return (
    replacementCount * 1000 +
    mojibakeCount * 120 -
    cjkCount +
    declaredBonus +
    chineseBonus
  );
}

function parseDxfWithSuppressedParserNoise(
  parser: { parseSync(source: string): IDxf | null },
  source: string,
): IDxf | null {
  const originalError = console.error;
  const originalWarn = console.warn;
  const shouldSuppress = (args: unknown[]) =>
    args
      .map((entry) => String(entry))
      .join(" ")
      .toLowerCase()
      .includes("is missing a name");

  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };

  try {
    return parser.parseSync(source);
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

function detectDxfCodePage(header: string): string {
  const match =
    /\$DWGCODEPAGE\s*(?:\r?\n|\r)\s*\d+\s*(?:\r?\n|\r)\s*([^\r\n]+)/i.exec(
      header,
    );
  return match?.[1]?.trim().toUpperCase() || "UTF-8";
}

function decoderForDxfCodePage(codePage: string): string {
  const map: Record<string, string> = {
    ANSI_932: "shift_jis",
    ANSI_936: "gb18030",
    ANSI_949: "euc-kr",
    ANSI_950: "big5",
    ANSI_1250: "windows-1250",
    ANSI_1251: "windows-1251",
    ANSI_1252: "windows-1252",
    ANSI_1253: "windows-1253",
    ANSI_1254: "windows-1254",
    ANSI_1255: "windows-1255",
    ANSI_1256: "windows-1256",
    ANSI_1257: "windows-1257",
    ANSI_1258: "windows-1258",
    UTF_8: "utf-8",
    "UTF-8": "utf-8",
  };

  return map[codePage.toUpperCase()] ?? "utf-8";
}

export function buildDxfPreview(dxf: IDxf, codePage: string): DxfPreview {
  const primitives: DxfPrimitive[] = [];
  const bounds = createEmptyBounds();
  const unsupportedEntityTypes = new Set<string>();
  const layerStyles = buildDxfLayerStyles(dxf);
  const modelSpaceEntities = dxf.entities.filter(
    (entity) => entity.inPaperSpace !== true,
  );
  const entitiesForPreview = modelSpaceEntities.length
    ? modelSpaceEntities
    : dxf.entities;

  for (const entity of entitiesForPreview) {
    const entityPrimitives = primitiveFromDxfEntity(
      entity,
      dxf,
      layerStyles,
      identityDxfAffine(),
      0,
    );

    if (entityPrimitives.length === 0) {
      unsupportedEntityTypes.add(entity.type);
    }

    for (const primitive of entityPrimitives) {
      includePrimitiveBounds(bounds, primitive);
      primitives.push(primitive);
    }
  }

  const safeBounds = normalizeBounds(bounds);
  const focusBounds = padBounds(safeBounds, 0.04);
  const layers = [...new Set(primitives.map((primitive) => primitive.layer))]
    .filter(Boolean)
    .sort();

  return {
    primitiveCount: primitives.length,
    entityCount: dxf.entities.length,
    renderedEntityCount: entitiesForPreview.length,
    paperSpaceEntityCount: dxf.entities.length - modelSpaceEntities.length,
    layers,
    codePage,
    unsupportedEntityTypes: [...unsupportedEntityTypes].sort(),
    bounds: safeBounds,
    focusBounds,
    primitives,
  };
}

function padBounds(bounds: Bounds2D, ratio: number): Bounds2D {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const padX = width * ratio;
  const padY = height * ratio;
  return {
    minX: bounds.minX - padX,
    minY: bounds.minY - padY,
    maxX: bounds.maxX + padX,
    maxY: bounds.maxY + padY,
  };
}

function primitiveFromDxfEntity(
  entity: IEntity,
  dxf: IDxf,
  layerStyles: Map<string, DxfLayerStyle>,
  transform: DxfAffine,
  depth: number,
  inheritedLayer?: string,
  inheritedStyle?: Pick<DxfPrimitiveBase, "color" | "lineWeight">,
): DxfPrimitive[] {
  if (depth > 8) return [];
  const entityLayer = entity.layer || "0";
  const layer =
    entityLayer === "0" && inheritedLayer ? inheritedLayer : entityLayer;
  const layerStyle = layerStyles.get(layer);
  if (layerStyle?.visible === false || entity.visible === false) return [];
  const style = primitiveStyleFromEntity(entity, layerStyle, inheritedStyle);
  const typed = entity as DxfEntityLike;

  if (entity.type === "LINE" && typed.vertices?.length) {
    const [start, end] = typed.vertices;
    if (!start || !end) return [];
    return [
      {
        kind: "polyline",
        layer,
        ...style,
        points: [
          transformDxfPoint(transform, start),
          transformDxfPoint(transform, end),
        ],
        closed: false,
      },
    ];
  }

  if (
    (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") &&
    typed.vertices?.length
  ) {
    const closed = Boolean(
      (typed as { shape?: boolean; closed?: boolean }).shape ||
      (typed as { closed?: boolean }).closed,
    );
    return [
      {
        kind: "polyline",
        layer,
        ...style,
        points: expandPolylineVertices(typed.vertices, closed).map((point) =>
          transformDxfPoint(transform, point),
        ),
        closed,
      },
    ];
  }

  if (entity.type === "CIRCLE" && typed.center && typed.radius) {
    const center = transformDxfPoint(transform, typed.center);
    return [
      {
        kind: "circle",
        layer,
        ...style,
        cx: center.x,
        cy: center.y,
        r: Math.abs(typed.radius * averageDxfScale(transform)),
      },
    ];
  }

  if (
    entity.type === "ARC" &&
    typed.center &&
    typed.radius &&
    typeof typed.startAngle === "number" &&
    typeof typed.endAngle === "number"
  ) {
    const center = transformDxfPoint(transform, typed.center);
    return [
      {
        kind: "arc",
        layer,
        ...style,
        cx: center.x,
        cy: center.y,
        r: Math.abs(typed.radius * averageDxfScale(transform)),
        startAngle: typed.startAngle + dxfRotationFromAffine(transform),
        endAngle: typed.endAngle + dxfRotationFromAffine(transform),
      },
    ];
  }

  if (entity.type === "ELLIPSE" && typed.center && typed.majorAxisEndPoint) {
    const center = transformDxfPoint(transform, typed.center);
    const major = transformDxfVector(transform, typed.majorAxisEndPoint);
    const rx = Math.hypot(major.x, major.y);
    return [
      {
        kind: "ellipse",
        layer,
        ...style,
        cx: center.x,
        cy: center.y,
        rx,
        ry: rx * Math.max(typed.axisRatio ?? 1, 0.0001),
        rotation: radiansToDegrees(Math.atan2(major.y, major.x)),
        startAngle: typed.startAngle ?? 0,
        endAngle: typed.endAngle ?? Math.PI * 2,
      },
    ];
  }

  if (entity.type === "SPLINE") {
    const sourcePoints = typed.fitPoints?.length
      ? typed.fitPoints
      : (typed.controlPoints ?? []);
    if (sourcePoints.length < 2) return [];
    return [
      {
        kind: "polyline",
        layer,
        ...style,
        points: sourcePoints.map((point) =>
          transformDxfPoint(transform, point),
        ),
        closed: Boolean((typed as { closed?: boolean }).closed),
      },
    ];
  }

  const facePoints = typed.points?.length ? typed.points : typed.vertices;
  if (
    (entity.type === "SOLID" || entity.type === "3DFACE") &&
    facePoints?.length
  ) {
    return [
      {
        kind: "solid",
        layer,
        ...style,
        points: facePoints
          .filter(isFiniteDxfPoint)
          .map((point) => transformDxfPoint(transform, point)),
      },
    ];
  }

  if ((entity.type === "TEXT" || entity.type === "MTEXT") && typed.text) {
    const point = typed.startPoint ?? typed.position;
    if (!point) return [];
    const textPoint = transformDxfPoint(transform, point);
    return [
      {
        kind: "text",
        layer,
        ...style,
        x: textPoint.x,
        y: textPoint.y,
        value: cleanDxfText(typed.text),
        size: Math.max(
          (typed.textHeight ?? typed.height ?? 12) * averageDxfScale(transform),
          1,
        ),
        rotation: (typed.rotation ?? 0) + dxfRotationFromAffine(transform),
        align:
          typed.halign === 1 ? "center" : typed.halign === 2 ? "right" : "left",
      },
    ];
  }

  if (entity.type === "POINT" && typed.position) {
    const point = transformDxfPoint(transform, typed.position);
    return [
      {
        kind: "point",
        layer,
        ...style,
        x: point.x,
        y: point.y,
      },
    ];
  }

  if (entity.type === "DIMENSION") {
    return primitiveFromDxfDimension(
      typed,
      layer,
      style,
      transform,
      dxf,
      layerStyles,
      depth,
    );
  }

  const insertBlockName = typed.name ?? typed.block ?? typed.blockName;
  if (entity.type === "INSERT" && insertBlockName) {
    return primitiveFromDxfInsert(
      { ...typed, name: insertBlockName },
      layer,
      style,
      dxf,
      layerStyles,
      transform,
      depth,
    );
  }

  return [];
}

function primitiveFromDxfDimension(
  entity: DxfEntityLike,
  layer: string,
  style: Pick<DxfPrimitiveBase, "color" | "lineWeight">,
  transform: DxfAffine,
  dxf: IDxf,
  layerStyles: Map<string, DxfLayerStyle>,
  depth: number,
): DxfPrimitive[] {
  const dimensionBlock = entity.block
    ? findDxfBlock(dxf, entity.block)
    : undefined;
  if (dimensionBlock) {
    return dimensionBlock.entities.flatMap((blockEntity) =>
      primitiveFromDxfEntity(
        blockEntity,
        dxf,
        layerStyles,
        transform,
        depth + 1,
        layer,
        style,
      ),
    );
  }

  const points = [
    entity.linearOrAngularPoint1,
    entity.linearOrAngularPoint2,
  ].filter(isFiniteDxfPoint);
  const primitives: DxfPrimitive[] = [];

  if (points.length === 2) {
    primitives.push({
      kind: "polyline",
      layer,
      ...style,
      points: points.map((point) => transformDxfPoint(transform, point)),
      closed: false,
    });
  }

  const textPoint = entity.middleOfText ?? entity.anchorPoint;
  const text =
    entity.text && entity.text !== "<>"
      ? entity.text
      : typeof entity.actualMeasurement === "number"
        ? formatCoord(entity.actualMeasurement)
        : "";
  if (textPoint && text) {
    const point = transformDxfPoint(transform, textPoint);
    primitives.push({
      kind: "text",
      layer,
      ...style,
      x: point.x,
      y: point.y,
      value: cleanDxfText(text),
      size: 2.5 * averageDxfScale(transform),
      rotation: (entity.angle ?? 0) + dxfRotationFromAffine(transform),
      align: "center",
    });
  }

  return primitives;
}

function findDxfBlock(dxf: IDxf, name: string): DxfBlockLike | undefined {
  const blocks = (dxf.blocks ?? {}) as Record<string, DxfBlockLike>;
  return (
    blocks[name] ??
    blocks[name.toUpperCase()] ??
    blocks[name.toLowerCase()] ??
    Object.entries(blocks).find(
      ([blockName]) => blockName.toLowerCase() === name.toLowerCase(),
    )?.[1]
  );
}

function primitiveFromDxfInsert(
  entity: DxfEntityLike,
  layer: string,
  style: Pick<DxfPrimitiveBase, "color" | "lineWeight">,
  dxf: IDxf,
  layerStyles: Map<string, DxfLayerStyle>,
  transform: DxfAffine,
  depth: number,
): DxfPrimitive[] {
  const block = findDxfBlock(dxf, entity.name ?? "");
  if (!block || !Array.isArray(block.entities)) return [];

  const position = entity.position ?? { x: 0, y: 0, z: 0 };
  const xScale = entity.xScale ?? 1;
  const yScale = entity.yScale ?? xScale;
  const rotation = entity.rotation ?? 0;
  const columnCount = Math.max(1, entity.columnCount ?? 1);
  const rowCount = Math.max(1, entity.rowCount ?? 1);
  const columnSpacing = entity.columnSpacing ?? 0;
  const rowSpacing = entity.rowSpacing ?? 0;
  const base = block.position ?? { x: 0, y: 0, z: 0 };
  const primitives: DxfPrimitive[] = [];

  for (let column = 0; column < columnCount; column += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      const insertTransform = multiplyDxfAffine(
        transform,
        multiplyDxfAffine(
          translateDxfAffine(
            position.x + column * columnSpacing,
            position.y + row * rowSpacing,
          ),
          multiplyDxfAffine(
            rotateDxfAffine(rotation),
            multiplyDxfAffine(
              scaleDxfAffine(xScale, yScale),
              translateDxfAffine(-base.x, -base.y),
            ),
          ),
        ),
      );
      primitives.push(
        ...block.entities.flatMap((blockEntity) =>
          primitiveFromDxfEntity(
            blockEntity,
            dxf,
            layerStyles,
            insertTransform,
            depth + 1,
            layer,
            style,
          ),
        ),
      );
    }
  }

  return primitives;
}

function buildDxfLayerStyles(dxf: IDxf): Map<string, DxfLayerStyle> {
  const styles = new Map<string, DxfLayerStyle>();
  const layers = dxf.tables?.layer?.layers ?? {};

  for (const [name, layer] of Object.entries(layers)) {
    const colorIndex =
      typeof layer.colorIndex === "number"
        ? layer.colorIndex
        : typeof layer.color === "number"
          ? layer.color
          : 0;
    styles.set(name, {
      color: colorFromDxfValue(layer.color, layer.colorIndex),
      // Some DWG-derived DXF files parsed by dxf-parser expose every layer as
      // `visible: false` even when AutoCAD displays the layer. DXF layer-off is
      // represented by a negative ACI color; trust that signal and frozen state
      // instead of hiding valid geometry.
      visible: layer.frozen !== true && colorIndex >= 0,
    });
  }

  return styles;
}

function primitiveStyleFromEntity(
  entity: IEntity,
  layerStyle?: DxfLayerStyle,
  inheritedStyle?: Pick<DxfPrimitiveBase, "color" | "lineWeight">,
): Pick<DxfPrimitiveBase, "color" | "lineWeight"> {
  const colorIndex =
    typeof entity.colorIndex === "number" ? entity.colorIndex : undefined;
  const trueColor =
    colorIndex === undefined && typeof entity.color === "number"
      ? entity.color
      : undefined;
  const lineWeight =
    typeof entity.lineweight === "number" && entity.lineweight > 0
      ? normalizeDxfLineWeight(entity.lineweight)
      : (inheritedStyle?.lineWeight ?? 0.55);

  return {
    color: colorFromDxfValue(
      trueColor,
      colorIndex,
      inheritedStyle?.color ?? layerStyle?.color,
    ),
    lineWeight: clampNumber(lineWeight, 0.35, 1.45),
  };
}

function normalizeDxfLineWeight(value: number): number {
  // DXF lineweight is stored in hundredths of a millimeter. Keep it as a
  // screen stroke hint, never as model-space geometry.
  return clampNumber(value / 100, 0.35, 1.45);
}

function colorFromDxfValue(
  trueColor?: number,
  colorIndex?: number,
  fallback = "#1f7aff",
): string {
  if (typeof trueColor === "number" && trueColor > 0) {
    return intToHexColor(trueColor);
  }

  const aci =
    typeof colorIndex === "number" && colorIndex !== 0 && colorIndex !== 256
      ? Math.abs(colorIndex)
      : undefined;
  const aciColor = aci === undefined ? null : colorFromAci(aci);
  return aciColor ?? fallback;
}

function colorFromAci(index: number): string | null {
  const common: Record<number, string> = {
    1: "#ff2a2a",
    2: "#ffd60a",
    3: "#20c933",
    4: "#17c9ff",
    5: "#2f6bff",
    6: "#f333ff",
    7: "#f8fafc",
    8: "#8b949e",
    9: "#c7ced8",
  };

  if (common[index]) return common[index];
  if (index <= 0 || index >= 256) return null;

  const hue = ((index * 47) % 360) / 360;
  const { r, g, b } = hslToRgb(hue, 0.82, 0.46);
  return rgbToHex(r, g, b);
}

function intToHexColor(value: number): string {
  const normalized = value & 0xffffff;
  return `#${normalized.toString(16).padStart(6, "0")}`;
}

function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number,
): { r: number; g: number; b: number } {
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset: number) => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: Math.round(channel(1 / 3) * 255),
    g: Math.round(channel(0) * 255),
    b: Math.round(channel(-1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function identityDxfAffine(): DxfAffine {
  return [1, 0, 0, 1, 0, 0];
}

function translateDxfAffine(x: number, y: number): DxfAffine {
  return [1, 0, 0, 1, x, y];
}

function scaleDxfAffine(x: number, y: number): DxfAffine {
  return [x, 0, 0, y, 0, 0];
}

function rotateDxfAffine(degrees: number): DxfAffine {
  const radians = degreesToRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
}

function multiplyDxfAffine(left: DxfAffine, right: DxfAffine): DxfAffine {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function transformDxfPoint(
  transform: DxfAffine,
  point: Pick<IPoint, "x" | "y">,
): { x: number; y: number } {
  return {
    x: transform[0] * point.x + transform[2] * point.y + transform[4],
    y: transform[1] * point.x + transform[3] * point.y + transform[5],
  };
}

function transformDxfVector(
  transform: DxfAffine,
  point: Pick<IPoint, "x" | "y">,
): { x: number; y: number } {
  return {
    x: transform[0] * point.x + transform[2] * point.y,
    y: transform[1] * point.x + transform[3] * point.y,
  };
}

function averageDxfScale(transform: DxfAffine): number {
  const xScale = Math.hypot(transform[0], transform[1]);
  const yScale = Math.hypot(transform[2], transform[3]);
  return Math.max((xScale + yScale) / 2, 0.0001);
}

function dxfRotationFromAffine(transform: DxfAffine): number {
  return radiansToDegrees(Math.atan2(transform[1], transform[0]));
}

function expandPolylineVertices(
  vertices: DxfVertexLike[],
  closed: boolean,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const finiteVertices = vertices.filter(isFiniteDxfPoint);

  for (let index = 0; index < finiteVertices.length; index += 1) {
    const current = finiteVertices[index];
    const next =
      index + 1 < finiteVertices.length
        ? finiteVertices[index + 1]
        : closed
          ? finiteVertices[0]
          : undefined;
    if (!current) continue;
    points.push({ x: current.x, y: current.y });

    if (!next || !current.bulge) continue;
    points.push(...bulgeSegmentPoints(current, next, current.bulge));
  }

  return points;
}

function bulgeSegmentPoints(
  start: DxfVertexLike,
  end: DxfVertexLike,
  bulge: number,
): Array<{ x: number; y: number }> {
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (chord <= 0.000001) return [];

  const theta = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(theta) / 2));
  if (!Number.isFinite(radius)) return [];

  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const chordAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const distanceToCenter = radius * Math.cos(Math.abs(theta) / 2);
  const side = bulge >= 0 ? 1 : -1;
  const center = {
    x: midpoint.x - side * Math.sin(chordAngle) * distanceToCenter,
    y: midpoint.y + side * Math.cos(chordAngle) * distanceToCenter,
  };
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const steps = Math.max(
    6,
    Math.min(48, Math.ceil(Math.abs(theta) / (Math.PI / 18))),
  );
  const points: Array<{ x: number; y: number }> = [];

  for (let step = 1; step < steps; step += 1) {
    const angle = startAngle + (theta * step) / steps;
    points.push({
      x: center.x + Math.abs(radius) * Math.cos(angle),
      y: center.y + Math.abs(radius) * Math.sin(angle),
    });
  }

  return points;
}

function includePrimitiveBounds(bounds: Bounds2D, primitive: DxfPrimitive) {
  if (primitive.kind === "polyline" || primitive.kind === "solid") {
    primitive.points.forEach((point) =>
      includePoint(bounds, { ...point, z: 0 }),
    );
    return;
  }

  if (primitive.kind === "circle" || primitive.kind === "arc") {
    includeCircle(
      bounds,
      { x: primitive.cx, y: primitive.cy, z: 0 },
      primitive.r,
    );
    return;
  }

  if (primitive.kind === "ellipse") {
    includeCircle(
      bounds,
      { x: primitive.cx, y: primitive.cy, z: 0 },
      Math.max(primitive.rx, primitive.ry),
    );
    return;
  }

  if (primitive.kind === "point") {
    includePoint(bounds, { x: primitive.x, y: primitive.y, z: 0 });
    return;
  }

  const textWidth = Math.max(
    primitive.value.length * primitive.size * 0.58,
    primitive.size,
  );
  includePoint(bounds, { x: primitive.x, y: primitive.y, z: 0 });
  includePoint(bounds, {
    x: primitive.x + textWidth,
    y: primitive.y + primitive.size,
    z: 0,
  });
}

function isFiniteDxfPoint<T extends Pick<IPoint, "x" | "y">>(
  point: T | null | undefined,
): point is T {
  return (
    Boolean(point) && Number.isFinite(point?.x) && Number.isFinite(point?.y)
  );
}

const neutralEngineeringMeshColor = new Color("#cbd5e1");
const selectedEngineeringMeshColor = new Color("#f59e0b");

type ColorBearingMaterial = {
  color: Color;
  userData: Record<string, unknown>;
  needsUpdate: boolean;
  toneMapped?: boolean;
  vertexColors?: boolean;
};

type EmissiveMaterial = ColorBearingMaterial & {
  emissive: Color;
  emissiveIntensity: number;
};

function meshMaterialList(object: Mesh): unknown[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

function isColorBearingMaterial(
  material: unknown,
): material is ColorBearingMaterial {
  return (
    material !== null &&
    material !== undefined &&
    typeof material === "object" &&
    "color" in material &&
    (material as { color?: unknown }).color instanceof Color &&
    "userData" in material &&
    typeof (material as { userData?: unknown }).userData === "object"
  );
}

function isEmissiveMaterial(material: unknown): material is EmissiveMaterial {
  return (
    isColorBearingMaterial(material) &&
    "emissive" in material &&
    (material as { emissive?: unknown }).emissive instanceof Color
  );
}

function colorTupleFromUserData(
  value: unknown,
): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const tuple = value.slice(0, 3).map(Number);
  if (!tuple.every(Number.isFinite)) return null;
  return [
    clampNumber(tuple[0] ?? 0, 0, 1),
    clampNumber(tuple[1] ?? 0, 0, 1),
    clampNumber(tuple[2] ?? 0, 0, 1),
  ];
}

function firstMeshMaterialColor(
  object: Mesh,
): [number, number, number] | null {
  const material = meshMaterialList(object).find(isColorBearingMaterial);
  if (!material) return null;
  return [material.color.r, material.color.g, material.color.b];
}

function prepareSelectableMaterial(
  material: unknown,
  baseColor?: [number, number, number] | null,
) {
  if (!isColorBearingMaterial(material)) return;
  const stored = colorTupleFromUserData(material.userData.architokenBaseColor);
  if (!stored) {
    material.userData.architokenBaseColor = baseColor ?? [
      material.color.r,
      material.color.g,
      material.color.b,
    ];
  }
  if ("toneMapped" in material) material.toneMapped = false;
  material.needsUpdate = true;
}

function applyMeshSelectionMaterialState(
  material: unknown,
  isSelected: boolean,
  objectBaseColor?: [number, number, number] | null,
) {
  if (!isColorBearingMaterial(material)) return;
  prepareSelectableMaterial(material);
  const materialBaseColor =
    colorTupleFromUserData(material.userData.architokenBaseColor) ??
    objectBaseColor ??
    [material.color.r, material.color.g, material.color.b];

  if (isSelected) {
    material.color.copy(selectedEngineeringMeshColor);
  } else {
    material.color.setRGB(
      materialBaseColor[0],
      materialBaseColor[1],
      materialBaseColor[2],
    );
  }

  if (isEmissiveMaterial(material)) {
    material.emissive.set(isSelected ? "#f59e0b" : "#000000");
    material.emissiveIntensity = isSelected ? 0.55 : 0;
  }

  material.needsUpdate = true;
}

function describeMeshMaterials(
  object: Mesh,
  fallbackColor: [number, number, number],
): string {
  const materials = meshMaterialList(object).filter(isColorBearingMaterial);
  const materialNames = materials
    .map((material) =>
      typeof (material as { name?: unknown }).name === "string"
        ? readableEngineeringText(
            (material as unknown as { name: string }).name,
            "",
          )
        : "",
    )
    .filter(Boolean);
  const firstColor = materials[0]
    ? [materials[0].color.r, materials[0].color.g, materials[0].color.b]
    : fallbackColor;
  const label = materialNames.length
    ? materialNames.slice(0, 3).join(" / ")
    : "源文件材质/颜色";
  return `${label} · ${formatRgbColor(firstColor as [number, number, number])}`;
}

function boxToBounds(box: Box3): Bounds3D {
  return {
    min: vectorToSerializablePoint(box.min),
    max: vectorToSerializablePoint(box.max),
  };
}

function formatMm(value: number): string {
  if (!Number.isFinite(value)) return "0 mm";
  return `${Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)} mm`;
}

function formatLength(
  value: number,
  unit: LengthDisplayUnit = millimeterLengthUnit,
): string {
  if (!Number.isFinite(value)) return `0 ${unit.label}`;
  const rounded =
    unit.precision === 0
      ? Math.round(value).toLocaleString()
      : value.toLocaleString(undefined, {
          minimumFractionDigits: unit.precision,
          maximumFractionDigits: unit.precision,
        });
  return `${rounded} ${unit.label}`;
}

function formatDimensionVector(
  value: Bounds3DPoint | null,
  unit: LengthDisplayUnit = millimeterLengthUnit,
): string {
  if (!value) return "待解析";
  return `长 ${formatLength(value.x, unit)} / 宽 ${formatLength(
    value.y,
    unit,
  )} / 高 ${formatLength(value.z, unit)}`;
}

function formatPointVector(
  value: Bounds3DPoint | null,
  unit: LengthDisplayUnit = millimeterLengthUnit,
): string {
  if (!value) return "待解析";
  return `X ${formatLength(value.x, unit)} / Y ${formatLength(
    value.y,
    unit,
  )} / Z ${formatLength(value.z, unit)}`;
}

function inferIfcLengthDisplayUnit(bytes: Uint8Array): LengthDisplayUnit {
  const head = new TextDecoder("latin1").decode(
    bytes.subarray(0, Math.min(bytes.length, 2_000_000)),
  );
  const normalized = head.replace(/\s+/g, "");
  const siUnit = normalized.match(
    /IFCSIUNIT\([^)]*,\.LENGTHUNIT\.,(\$|\.[A-Z]+\.),\.([A-Z]+)\.\)/i,
  );
  if (!siUnit) return meterLengthUnit;
  const prefix = siUnit[1]?.replace(/\./g, "").toUpperCase() ?? "$";
  const unitName = siUnit[2]?.toUpperCase() ?? "METRE";
  if (unitName !== "METRE") {
    return { label: unitName.toLowerCase(), precision: 2, metersPerUnit: 1 };
  }
  if (prefix === "MILLI") return millimeterLengthUnit;
  if (prefix === "CENTI") return { label: "cm", precision: 1, metersPerUnit: 0.01 };
  if (prefix === "DECI") return { label: "dm", precision: 2, metersPerUnit: 0.1 };
  return meterLengthUnit;
}

function ifcLiteMetersToProjectUnit(
  value: number,
  unit: LengthDisplayUnit,
): number {
  const metersPerUnit =
    Number.isFinite(unit.metersPerUnit) && unit.metersPerUnit > 0
      ? unit.metersPerUnit
      : 1;
  return value / metersPerUnit;
}

function ifcLitePointMetersToProjectUnit(
  point: Bounds3DPoint,
  unit: LengthDisplayUnit,
): Bounds3DPoint {
  return {
    x: ifcLiteMetersToProjectUnit(point.x, unit),
    y: ifcLiteMetersToProjectUnit(point.y, unit),
    z: ifcLiteMetersToProjectUnit(point.z, unit),
  };
}

function ifcLiteBoundsMetersToProjectUnit(
  bounds: Bounds3D,
  unit: LengthDisplayUnit,
): Bounds3D {
  return {
    min: ifcLitePointMetersToProjectUnit(bounds.min, unit),
    max: ifcLitePointMetersToProjectUnit(bounds.max, unit),
  };
}

function boundsDimensions(bounds: Bounds3D | null): Bounds3DPoint | null {
  if (!bounds) return null;
  return {
    x: Math.abs(bounds.max.x - bounds.min.x),
    y: Math.abs(bounds.max.y - bounds.min.y),
    z: Math.abs(bounds.max.z - bounds.min.z),
  };
}

function boundsCenter(bounds: Bounds3D | null): Bounds3DPoint | null {
  if (!bounds) return null;
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}

function boundsUserData(value: unknown): Bounds3D | null {
  if (value instanceof Box3) return boxToBounds(value);
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const min = vectorUserData(candidate.min);
  const max = vectorUserData(candidate.max);
  return min && max ? { min, max } : null;
}

function stringUserData(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function metricUserData(value: unknown): MetricItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = stringUserData(record.label);
      const rawValue = record.value;
      const value =
        typeof rawValue === "string" || typeof rawValue === "number"
          ? String(rawValue)
          : "";
      return label && value ? { label, value } : null;
    })
    .filter((item): item is MetricItem => Boolean(item));
}

function meshGeometryStats(geometry: BufferGeometry): {
  vertexCount: number;
  faceCount: number;
} {
  const position = geometry.getAttribute("position");
  const vertexCount = position?.count ?? 0;
  const index = geometry.getIndex();
  const faceCount = index
    ? Math.floor(index.count / 3)
    : Math.floor(vertexCount / 3);
  return { vertexCount, faceCount };
}

function safeMeshColor(
  color: import("occt-import-js").OcctMesh["color"] | undefined,
): { color: Color; source: string } {
  if (
    Array.isArray(color) &&
    color.length >= 3 &&
    color.slice(0, 3).every((value) => Number.isFinite(value))
  ) {
    return {
      color: new Color(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0),
      source: "源文件颜色",
    };
  }
  return {
    color: neutralEngineeringMeshColor.clone(),
    source: "源文件未声明颜色，使用可视化默认色",
  };
}

function collectOcctMeshProperties(
  mesh: import("occt-import-js").OcctMesh,
  index: number,
): MetricItem[] {
  const rows: MetricItem[] = [
    { label: "源 Mesh 序号", value: String(index + 1) },
    { label: "源 Mesh 名称", value: mesh.name ?? `occt-mesh-${index}` },
  ];
  if (mesh.color) {
    rows.push({ label: "源颜色", value: mesh.color.join(", ") });
  }
  return rows;
}

export function buildExchangeObjectPropertyRows(
  object: Mesh,
  file: ModuleFileNode,
  routeLabel: string,
): IfcPropertyRow[] {
  const localBounds =
    boundsUserData(object.userData.nativeBounds) ??
    (() => {
      object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      return box ? boxToBounds(box) : null;
    })();
  const dimensions =
    vectorUserData(object.userData.dimensionsMm) ??
    boundsDimensions(localBounds);
  const center =
    vectorUserData(object.userData.nativeCenterMm) ?? boundsCenter(localBounds);
  const stats = meshGeometryStats(object.geometry);
  const sourceProperties = metricUserData(object.userData.sourceProperties);
  const rows: IfcPropertyRow[] = [
    {
      key: "uploadTemplate",
      label: "上传模板",
      value: "BOM/属性模板可上传",
    },
    {
      key: "exportList",
      label: "导出清单",
      value: "选中构件 / 整模 BOM",
    },
    { key: "version", label: "所属版本", value: file.version || "v1.0" },
    {
      key: "uploadedAt",
      label: "上传时间",
      value: formatDisplayTime(file.updatedAt),
    },
    {
      key: "componentId",
      label: "构件ID",
      value: stringUserData(
        object.userData.componentId,
        object.name || object.uuid,
      ),
    },
    {
      key: "name",
      label: "name",
      value:
        object.name || stringUserData(object.userData.sourceName, object.uuid),
      editable: true,
    },
    {
      key: "objectType",
      label: "ObjectType",
      value: stringUserData(object.userData.objectType, "CAD/BIM mesh"),
      editable: true,
    },
    {
      key: "dimensions",
      label: "三维尺寸（mm）",
      value: formatDimensionVector(dimensions),
    },
    {
      key: "sizeX",
      label: "长度（mm）",
      value: formatLength(dimensions?.x ?? 0),
    },
    {
      key: "sizeY",
      label: "宽度（mm）",
      value: formatLength(dimensions?.y ?? 0),
    },
    {
      key: "sizeZ",
      label: "高度（mm）",
      value: formatLength(dimensions?.z ?? 0),
    },
    {
      key: "coordinates",
      label: "中心位置（mm）",
      value: formatPointVector(center),
    },
    {
      key: "geometry",
      label: "几何表达",
      value: stringUserData(
        object.userData.geometryExpression,
        `${stats.vertexCount.toLocaleString()} vertices / ${stats.faceCount.toLocaleString()} faces`,
      ),
    },
    {
      key: "material",
      label: "材质信息",
      value: stringUserData(object.userData.materialSource, "源文件材质"),
      editable: true,
    },
    {
      key: "sourceFormat",
      label: "原生格式",
      value: stringUserData(
        object.userData.sourceFormat,
        extensionOf(file.name),
      ),
    },
    {
      key: "route",
      label: "查看链路",
      value: stringUserData(object.userData.routeLabel, routeLabel),
    },
  ];
  const fingerprints = new Set(
    rows.map((row) => `${row.label}:${row.value}`.toLowerCase()),
  );

  sourceProperties.forEach((item, index) => {
    if (DEPRECATED_ENGINEERING_ROLE_LABELS.has(item.label)) return;
    const fingerprint = `${item.label}:${item.value}`.toLowerCase();
    if (fingerprints.has(fingerprint)) return;
    fingerprints.add(fingerprint);
    rows.push({
      key: `source:${index}:${item.label}`,
      label: item.label,
      value: item.value,
      editable: true,
    });
  });

  return rows;
}

export function buildOcctGroup(
  meshes: import("occt-import-js").OcctMesh[],
  options?: ExchangeMeshBuildOptions,
): OcctPreview {
  const group = new Group();
  let vertexCount = 0;
  let faceCount = 0;

  meshes.forEach((mesh, index) => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(mesh.attributes.position.array);
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

    if (mesh.attributes.normal?.array.length) {
      geometry.setAttribute(
        "normal",
        new Float32BufferAttribute(
          new Float32Array(mesh.attributes.normal.array),
          3,
        ),
      );
    } else {
      geometry.computeVertexNormals();
    }

    if (mesh.index?.array.length) {
      geometry.setIndex(
        new BufferAttribute(new Uint32Array(mesh.index.array), 1),
      );
      faceCount += Math.floor(mesh.index.array.length / 3);
    } else {
      faceCount += Math.floor(positions.length / 9);
    }

    vertexCount += Math.floor(positions.length / 3);

    geometry.computeBoundingBox();
    const localBounds = geometry.boundingBox?.clone() ?? new Box3();
    const dimensions = localBounds.getSize(new Vector3());
    const center = localBounds.getCenter(new Vector3());
    const { color, source } = safeMeshColor(mesh.color);
    const material = new MeshStandardMaterial({
      color,
      metalness: 0.12,
      roughness: 0.42,
      side: DoubleSide,
    });

    const object = new Mesh(geometry, material);
    object.name = mesh.name ?? `occt-mesh-${index}`;
    object.userData = {
      ...object.userData,
      baseColor: [color.r, color.g, color.b],
      componentId: mesh.name ?? `occt:${index + 1}`,
      objectType: "CAD model mesh",
      sourceFormat: options?.sourceFormat ?? "CAD model",
      sourceName: options?.sourceName ?? mesh.name ?? `occt-mesh-${index}`,
      routeLabel: options?.routeLabel ?? `${prengineLabel} · CAD 模型`,
      geometryExpression: `${Math.floor(positions.length / 3).toLocaleString()} vertices / ${
        mesh.index?.array.length
          ? Math.floor(mesh.index.array.length / 3).toLocaleString()
          : Math.floor(positions.length / 9).toLocaleString()
      } faces`,
      materialSource: source,
      sourceProperties: collectOcctMeshProperties(mesh, index),
      nativeBounds: boxToBounds(localBounds),
      nativeCenterMm: vectorToSerializablePoint(center),
      dimensionsMm: vectorToSerializablePoint(dimensions),
    };
    group.add(object);
  });

  if (meshes.length > 0) {
    const nativeBounds = new Box3().setFromObject(group);
    if (!nativeBounds.isEmpty()) {
      const center = nativeBounds.getCenter(new Vector3());
      const renderOffset = new Vector3(center.x, center.y, nativeBounds.min.z);
      group.position.set(-renderOffset.x, -renderOffset.y, -renderOffset.z);
      group.userData.nativeBounds = nativeBounds.clone();
      group.userData.renderOffset = renderOffset.clone();
    }
  }

  return {
    meshCount: meshes.length,
    vertexCount,
    faceCount,
    group,
  };
}

function buildStlGroup(
  geometry: BufferGeometry,
  options: ExchangeMeshBuildOptions,
): OcctPreview {
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const group = new Group();
  const stlGroups = stlGeometryDisplayGroups(geometry);
  let vertexCount = 0;
  let faceCount = 0;

  stlGroups.forEach((stlGroup, index) => {
    const partGeometry =
      stlGroups.length === 1
        ? geometry
        : stlGroup.triangleIndices
          ? cloneStlGeometryTriangles(geometry, stlGroup.triangleIndices)
          : cloneStlGeometryRange(geometry, stlGroup.start, stlGroup.count);
    partGeometry.computeVertexNormals();
    partGeometry.computeBoundingBox();
    const localBounds = partGeometry.boundingBox?.clone() ?? new Box3();
    const dimensions = localBounds.getSize(new Vector3());
    const center = localBounds.getCenter(new Vector3());
    const stats = meshGeometryStats(partGeometry);
    vertexCount += stats.vertexCount;
    faceCount += stats.faceCount;

    const hasVertexColors = Boolean(partGeometry.getAttribute("color"));
    const alpha = stlGeometryAlpha(partGeometry);
    const color = hasVertexColors
      ? new Color("#ffffff")
      : neutralEngineeringMeshColor.clone();
    const material = new MeshBasicMaterial({
      color,
      vertexColors: hasVertexColors,
      side: DoubleSide,
      transparent: alpha < 0.999,
      opacity: alpha,
    });
    const partName =
      stlGroup.name ||
      (stlGroups.length === 1
        ? options.sourceName
        : `${options.sourceName} #${index + 1}`);
    const object = new Mesh(partGeometry, material);
    object.name = partName;
    object.userData = {
      baseColor: [color.r, color.g, color.b],
      componentId: `${options.sourceName}:${index + 1}`,
      objectType: "STL mesh",
      sourceFormat: options.sourceFormat,
      sourceName: options.sourceName,
      routeLabel: options.routeLabel,
      geometryExpression: `${stats.vertexCount.toLocaleString()} vertices / ${stats.faceCount.toLocaleString()} faces`,
      materialSource: hasVertexColors
        ? `STL 源文件 vertex color${alpha < 0.999 ? ` / alpha ${alpha.toFixed(2)}` : ""}`
        : "STL 源文件未声明材质颜色，使用可视化默认色",
      sourceProperties: [
        { label: "源格式", value: "STL" },
        { label: "源 solid/group", value: partName },
        { label: "分离壳体", value: stlGroup.shell ? "是" : "否" },
        {
          label: "源顶点范围",
          value: `${stlGroup.start} - ${stlGroup.start + stlGroup.count}`,
        },
        { label: "顶点", value: stats.vertexCount.toLocaleString() },
        { label: "三角面", value: stats.faceCount.toLocaleString() },
        {
          label: "颜色",
          value: hasVertexColors ? "源文件 vertex color" : "源文件未声明",
        },
        { label: "透明度", value: alpha < 0.999 ? alpha.toFixed(2) : "1.00" },
        { label: "单位", value: "mm" },
      ],
      nativeBounds: boxToBounds(localBounds),
      nativeCenterMm: vectorToSerializablePoint(center),
      dimensionsMm: vectorToSerializablePoint(dimensions),
    };
    group.add(object);
  });

  if (stlGroups.length > 1) {
    geometry.dispose();
  }

  const nativeBounds = new Box3().setFromObject(group);
  if (!nativeBounds.isEmpty()) {
    const renderCenter = nativeBounds.getCenter(new Vector3());
    const renderOffset = new Vector3(
      renderCenter.x,
      renderCenter.y,
      nativeBounds.min.z,
    );
    group.position.set(-renderOffset.x, -renderOffset.y, -renderOffset.z);
    group.userData.nativeBounds = nativeBounds.clone();
    group.userData.renderOffset = renderOffset.clone();
  }

  return {
    meshCount: group.children.length,
    vertexCount,
    faceCount,
    group,
  };
}

interface StlGeometryGroup {
  start: number;
  count: number;
  name: string;
  shell?: boolean;
  triangleIndices?: number[];
}

function stlGeometryDisplayGroups(
  geometry: BufferGeometry,
): StlGeometryGroup[] {
  const declaredGroups = normalizedStlGeometryGroups(geometry);
  if (declaredGroups.length > 1) return declaredGroups;

  const connectedGroups = connectedStlTriangleGroups(geometry);
  return connectedGroups.length > 1 ? connectedGroups : declaredGroups;
}

function normalizedStlGeometryGroups(
  geometry: BufferGeometry,
): StlGeometryGroup[] {
  const position = geometry.getAttribute("position");
  const groupNames = Array.isArray(geometry.userData.groupNames)
    ? (geometry.userData.groupNames as unknown[]).map((name) =>
        typeof name === "string" ? name.trim() : "",
      )
    : [];
  const groups = geometry.groups
    .filter((group) => group.count > 0)
    .map((group, index) => ({
      start: group.start,
      count: group.count,
      name: groupNames[index] || "",
    }));

  if (groups.length > 1) return groups;
  return [
    {
      start: 0,
      count: position?.count ?? 0,
      name: groupNames[0] || "",
    },
  ];
}

function connectedStlTriangleGroups(
  geometry: BufferGeometry,
): StlGeometryGroup[] {
  const position = geometry.getAttribute("position");
  const triangleCount = position ? Math.floor(position.count / 3) : 0;
  if (!position || triangleCount < 2) return [];

  const parent = new Int32Array(triangleCount);
  for (let index = 0; index < triangleCount; index += 1) {
    parent[index] = index;
  }

  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root] ?? root;
    while (parent[index] !== index) {
      const next = parent[index] ?? root;
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const vertexOwner = new Map<string, number>();

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = triangle * 3 + corner;
      const key = quantizedStlVertexKey(
        position.getComponent(vertex, 0),
        position.getComponent(vertex, 1),
        position.getComponent(vertex, 2),
      );
      const owner = vertexOwner.get(key);
      if (owner === undefined) {
        vertexOwner.set(key, triangle);
      } else {
        union(triangle, owner);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle);
    const bucket = groups.get(root);
    if (bucket) {
      bucket.push(triangle);
    } else {
      groups.set(root, [triangle]);
    }
  }

  return Array.from(groups.values())
    .filter((triangles) => triangles.length > 0)
    .sort((left, right) => right.length - left.length)
    .slice(0, 500)
    .map((triangles, index) => {
      const firstTriangle = triangles.reduce(
        (min, triangle) => Math.min(min, triangle),
        Number.POSITIVE_INFINITY,
      );
      return {
        start: firstTriangle * 3,
        count: triangles.length * 3,
        name: `STL shell ${index + 1}`,
        shell: true,
        triangleIndices: triangles,
      };
    });
}

function quantizedStlVertexKey(x: number, y: number, z: number): string {
  const precision = 1000;
  return `${Math.round(x * precision)}:${Math.round(y * precision)}:${Math.round(z * precision)}`;
}

function cloneStlGeometryRange(
  geometry: BufferGeometry,
  start: number,
  count: number,
): BufferGeometry {
  const cloned = new BufferGeometry();
  const sourceMeta = geometry as BufferGeometry & {
    hasColors?: boolean;
    alpha?: number;
  };
  const clonedMeta = cloned as BufferGeometry & {
    hasColors?: boolean;
    alpha?: number;
  };
  if (typeof sourceMeta.hasColors === "boolean") {
    clonedMeta.hasColors = sourceMeta.hasColors;
  }
  if (typeof sourceMeta.alpha === "number") {
    clonedMeta.alpha = sourceMeta.alpha;
  }
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const color = geometry.getAttribute("color");
  cloned.setAttribute(
    "position",
    new Float32BufferAttribute(copyAttributeRange(position, start, count), 3),
  );
  if (normal) {
    cloned.setAttribute(
      "normal",
      new Float32BufferAttribute(copyAttributeRange(normal, start, count), 3),
    );
  }
  if (color) {
    cloned.setAttribute(
      "color",
      new Float32BufferAttribute(copyAttributeRange(color, start, count), 3),
    );
  }
  return cloned;
}

function cloneStlGeometryTriangles(
  geometry: BufferGeometry,
  triangleIndices: number[],
): BufferGeometry {
  const cloned = new BufferGeometry();
  copyStlGeometryMetadata(geometry, cloned);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const color = geometry.getAttribute("color");
  cloned.setAttribute(
    "position",
    new Float32BufferAttribute(
      copyAttributeTriangles(position, triangleIndices),
      3,
    ),
  );
  if (normal) {
    cloned.setAttribute(
      "normal",
      new Float32BufferAttribute(
        copyAttributeTriangles(normal, triangleIndices),
        3,
      ),
    );
  }
  if (color) {
    cloned.setAttribute(
      "color",
      new Float32BufferAttribute(
        copyAttributeTriangles(color, triangleIndices),
        3,
      ),
    );
  }
  return cloned;
}

function copyStlGeometryMetadata(
  source: BufferGeometry,
  target: BufferGeometry,
) {
  const sourceMeta = source as BufferGeometry & {
    hasColors?: boolean;
    alpha?: number;
  };
  const targetMeta = target as BufferGeometry & {
    hasColors?: boolean;
    alpha?: number;
  };
  if (typeof sourceMeta.hasColors === "boolean") {
    targetMeta.hasColors = sourceMeta.hasColors;
  }
  if (typeof sourceMeta.alpha === "number") {
    targetMeta.alpha = sourceMeta.alpha;
  }
}

function stlGeometryAlpha(geometry: BufferGeometry): number {
  const alpha = (geometry as BufferGeometry & { alpha?: unknown }).alpha;
  return typeof alpha === "number" && Number.isFinite(alpha)
    ? Math.max(0, Math.min(1, alpha))
    : 1;
}

function copyAttributeRange(
  attribute: Pick<BufferAttribute, "itemSize" | "getComponent">,
  start: number,
  count: number,
): Float32Array {
  const itemSize = attribute.itemSize;
  const output = new Float32Array(Math.max(count, 0) * itemSize);
  for (let index = 0; index < count; index += 1) {
    for (let item = 0; item < itemSize; item += 1) {
      output[index * itemSize + item] = attribute.getComponent(
        start + index,
        item,
      );
    }
  }
  return output;
}

function copyAttributeTriangles(
  attribute: Pick<BufferAttribute, "itemSize" | "getComponent">,
  triangleIndices: number[],
): Float32Array {
  const itemSize = attribute.itemSize;
  const output = new Float32Array(triangleIndices.length * 3 * itemSize);
  triangleIndices.forEach((triangle, triangleIndex) => {
    for (let corner = 0; corner < 3; corner += 1) {
      const sourceIndex = triangle * 3 + corner;
      const targetVertex = triangleIndex * 3 + corner;
      for (let item = 0; item < itemSize; item += 1) {
        output[targetVertex * itemSize + item] = attribute.getComponent(
          sourceIndex,
          item,
        );
      }
    }
  });
  return output;
}

function disposeGroup(group: Group) {
  group.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }
  });
}

function createEmptyBounds(): Bounds2D {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function normalizeBounds(bounds: Bounds2D): Bounds2D {
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  }
  return bounds;
}

function includePoint(bounds: Bounds2D, point: IPoint) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function includeCircle(bounds: Bounds2D, center: IPoint, radius: number) {
  includePoint(bounds, { x: center.x - radius, y: center.y - radius, z: 0 });
  includePoint(bounds, { x: center.x + radius, y: center.y + radius, z: 0 });
}

export function cleanDxfText(value: string): string {
  return decodeEngineeringText(
    value
      .replace(/\\[Pp]/g, "\n")
      .replace(/\^J/g, "\n")
      .replace(/\\~/g, " ")
      .replace(/%%u/gi, "")
      .replace(/%%o/gi, "")
      .replace(/\\[LlOoKk]/g, "")
      .replace(/\\S([^;]+);/g, (_, stacked: string) =>
        stacked.replace(/[\\^#]/g, "/"),
      )
      .replace(/%%([0-9]{3})/g, (_, code: string) => {
        const point = Number.parseInt(code, 10);
        return point >= 32 ? String.fromCharCode(point) : "";
      })
      .replace(/\\A\d+;/g, "")
      .replace(/%%c/gi, "Φ")
      .replace(/%%d/gi, "°")
      .replace(/%%p/gi, "±")
      .replace(/\\[Mm][^;]*;/g, "")
      .replace(/\\[CcFfHhQqTtWw][^;]*;/g, "")
      .replace(/[{}]/g, ""),
  ).trim();
}

function readableEngineeringText(value: unknown, fallback = ""): string {
  const decoded = decodeEngineeringText(String(value ?? ""))
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded || isUnreadableEngineeringText(decoded)) return fallback;
  return decoded;
}

function isUnreadableEngineeringText(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return true;
  const badCount = (compact.match(/[\uFFFD\u25A0-\u25A3\u25A8-\u25A9]/g) ?? [])
    .length;
  const readableCount = (
    compact.match(/[\p{L}\p{N}\u4e00-\u9fff]/gu) ?? []
  ).length;
  if (badCount > 0 && compact.length <= 6) return true;
  if (badCount / compact.length > 0.2) return true;
  if (readableCount === 0) return true;
  return false;
}

function decodeEngineeringText(value: string): string {
  return value
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\X2\\([0-9a-fA-F]+)\\X0\\/g, (_, hex: string) =>
      decodeHexUtf16(hex),
    )
    .replace(/\\X\\([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/''/g, "'");
}

function decodeHexUtf16(hex: string): string {
  const chars: string[] = [];
  for (let index = 0; index + 3 < hex.length; index += 4) {
    chars.push(
      String.fromCharCode(Number.parseInt(hex.slice(index, index + 4), 16)),
    );
  }
  return chars.join("");
}
