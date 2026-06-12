// components/OpenEngineeringEditor.tsx - Browser-native open engineering editor
// License: Apache-2.0
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type GLProps,
  type ThreeEvent,
} from "@react-three/fiber";
import { Environment, Grid, Html, OrbitControls } from "@react-three/drei";
import {
  AlertTriangle,
  Box as BoxIcon,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cloud,
  Crosshair,
  DraftingCompass,
  Download,
  FileCog,
  FileUp,
  FolderTree,
  Footprints,
  Grid3X3,
  LocateFixed,
  Layers3,
  MessageSquareText,
  MousePointer2,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  RotateCcw,
  Ruler,
  Save,
  Search,
  Scissors,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import {
  Box3,
  Box3Helper,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Matrix4,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  type Scene,
  Vector3,
  WebGLRenderer,
  type WebGLRendererParameters,
} from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { Rhino3dmLoader } from "three/examples/jsm/loaders/3DMLoader.js";
import { USDLoader } from "three/examples/jsm/loaders/USDLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { BIMViewer } from "@/components/BIMViewer";
import {
  adapterRequirementForExtension,
  adapterSourcesForFileName,
} from "@/lib/adapter-source-registry";
import {
  engineeringViewerCapabilityForContract,
  engineeringViewerCapabilityRowsForFileName,
  engineeringViewerContractForFileName,
  formatEngineeringViewerCapabilityStatus,
  summarizeEngineeringViewerCapabilities,
  type EngineeringViewerCapabilityId,
  type EngineeringViewerFormatContract,
} from "@/lib/engineering-viewer-capabilities";
import { extensionOf, fileTypeForFileName } from "@/lib/file-type-registry";
import {
  formatModuleFileSize,
  type ModuleFileNode,
} from "@/lib/module-file-system";
import type { LocalFileMetadata } from "@/lib/local-file-runtime";
import { architokenLocalFileChangedEventName } from "@/lib/module-dialog-events";
import {
  buildPanAIWorkbenchCapabilities,
  type PanAIWorkbenchCapability,
} from "@/lib/panai-workbench-chat";
import type * as WebIfc from "web-ifc";

export interface OpenEngineeringEditorProps {
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
const revitInternalFootToMillimeters = 304.8;
const mlightCadCanvasBackground = 0x000000;
const mlightCadOpenSysVars: Record<string, boolean | number | string> = {
  COLORTHEME: 0,
  LWDISPLAY: true,
  WHITEBKCOLOR: false,
};
const mlightCadResourceBaseUrl = "/api/mlightcad/cad-fonts-20260527/";
const mlightCadKnownChineseFontAliases = [
  "宋体",
  "中易宋体",
  "微软宋体",
  "仿宋",
  "仿宋_gb2312",
  "仿宋_gb18030",
  "黑体",
  "楷体",
  "楷体_gb2312",
  "HZFS",
  "HZHT",
  "HZDX",
  "HZTXT",
  "GBHZFS",
  "GBCBIG",
  "CHINESET",
  "TSSDCHN",
  "TSSDCHN1",
  "TSSDCHN2",
  "TSSDCHN3",
  "TSSDCHN4",
  "HZ",
  "FSDB",
  "FSDB_E",
  "FSDB_S",
];
const mlightCadKnownWesternFontAliases = [
  "TSSDENG",
  "TSSDENG1",
  "TSSDENG2",
  "TSSDENG3",
  "ROMANS",
  "ROMAND",
  "ROMANC",
  "SIMPLEX",
  "TXT",
  "MONOTXT",
  "ISOCP",
  "ISO",
  "GENISO",
  "ARIAL",
];

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
const panaecLabel = "PanAEC Engine";
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

export interface ViewerMetric {
  label: string;
  value: string;
}

type EngineeringWorkbenchTool =
  | "select"
  | "edit"
  | "measure"
  | "coordinate"
  | "cloud"
  | "section"
  | "walk"
  | "annotate";

export type EngineeringWorkbenchCommandFeedback = string | null | undefined;

type EngineeringWorkbenchTreeKind =
  | "adapter"
  | "annotation"
  | "block"
  | "collection"
  | "element"
  | "file"
  | "folder"
  | "grid"
  | "layer"
  | "layout"
  | "material"
  | "mesh"
  | "metric"
  | "property"
  | "scene"
  | "source"
  | "type";

export interface EngineeringWorkbenchTreeNode {
  id: string;
  label: string;
  kind: EngineeringWorkbenchTreeKind;
  meta?: string | undefined;
  badge?: string | undefined;
  status?: string | undefined;
  children?: EngineeringWorkbenchTreeNode[] | undefined;
}

type EngineeringEditorCommand = "edit" | "ai-generate" | "save-version";
type EngineeringEditorFileAction = "online_edit" | "ai_generate";

interface EngineeringEditorCapabilityMap {
  family: string;
  status: string;
  route: string;
  adapters: string[];
  sourceLabels: string[];
  boundary: string;
  completeUseMandate: string;
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
  geometrySource?:
    | "ifc-representation"
    | "ifc-quantity"
    | "mesh-bounds"
    | "mixed";
  geometryDimensionSource?: Partial<
    Record<
      keyof Bounds3DPoint,
      "ifc-representation" | "ifc-quantity" | "mesh-bounds"
    >
  >;
  sourceColor?: string;
  styleColor?: [number, number, number, number];
  styleColorSource?: string;
  displayColor?: [number, number, number, number];
  displayColorSource?: string;
  geometryMeshCount?: number;
  geometryVertexCount?: number;
  geometryTriangleCount?: number;
}

interface IfcStepRecord {
  expressID: number;
  type: string;
  params: string[];
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

interface Bounds2DPoint {
  x: number;
  y: number;
  z?: number;
}

interface Bounds3D {
  min: Bounds3DPoint;
  max: Bounds3DPoint;
}

interface IfcPlacementTransform {
  origin: Bounds3DPoint;
  xAxis: Bounds3DPoint;
  yAxis: Bounds3DPoint;
  zAxis: Bounds3DPoint;
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
  rvtScheduleIndex?: RvtScheduleIndex | undefined;
}

interface RvtScheduleRecord {
  elementId: string;
  typeName: string;
  category: string;
  family: string;
  level: string;
  name: string;
  uniqueId: string;
  versionGuid: string;
  boundsMm: Bounds3D | null;
  dimensionsMm: Bounds3DPoint | null;
  properties: MetricItem[];
}

type RvtScheduleIndex = Map<string, RvtScheduleRecord>;

type OcctImporterModule = typeof import("occt-import-js");
type OcctMesh = import("occt-import-js").OcctMesh;
type OcctRuntime = Awaited<ReturnType<OcctImporterModule["default"]>>;

let occtRuntimePromise: Promise<OcctRuntime> | null = null;
const occtMeshCache = new Map<string, Promise<OcctMesh[]>>();

type ModelGraphicsRuntimeStatus =
  | "checking"
  | "webgpu"
  | "webgl"
  | "unavailable";

interface ModelGraphicsRuntime {
  status: ModelGraphicsRuntimeStatus;
  reason: string;
}

type EngineeringGlProps = Omit<WebGLRendererParameters, "canvas"> & {
  canvas?: unknown;
};

interface EngineeringThreeRenderer {
  domElement?: HTMLCanvasElement;
  isWebGPURenderer?: boolean;
  isWebGLRenderer?: boolean;
  init?: () => Promise<void>;
  render(scene: Scene, camera: Camera): unknown;
  setClearColor?(color: string, alpha?: number): void;
}

interface ModelSvgProjectionSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

interface ModelSvgProjection {
  segments: ModelSvgProjectionSegment[];
  viewBox: Bounds2D;
  meshCount: number;
  triangleCount: number;
  sampledTriangleCount: number;
}

interface VertexAttributeLike {
  count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
}

interface IndexAttributeLike {
  count: number;
  getX(index: number): number;
}

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

interface MlightCadDrawingPreview {
  sourceFormat: string;
  sourceBytes: number;
  textDisplayFixCount: number;
  outline?: EngineeringWorkbenchTreeNode[];
}

export interface MlightCadFontInfo {
  name?: string[];
  file?: string;
  type?: string;
  encoding?: string;
}

interface MlightCadDocManager {
  openDocument(
    fileName: string,
    content: ArrayBuffer,
    options: {
      minimumChunkSize: number;
      mode?: unknown;
      sysVars?: Record<string, boolean | number | string>;
    },
  ): Promise<boolean>;
  destroy(): Promise<void>;
  loadDefaultFonts?(fonts?: string[]): Promise<void>;
  regen?(): void;
  sendStringToExecute(command: string): void;
  curDocument?: MlightCadDocument;
  curView?: {
    backgroundColor?: number;
    isDirty?: boolean;
    renderer?: {
      showLineWeight?: boolean;
      missedFonts?: Record<string, number>;
      setFontMapping?: (mapping: Record<string, string>) => void;
    };
    missedData?: {
      fonts?: Record<string, number>;
    };
    highlight?: (ids: string[]) => void;
    unhighlight?: (ids: string[]) => void;
    zoomToFitDrawing?: (timeout?: number) => void;
    zoomToFitLayer?: (layerName: string) => boolean;
  };
}

interface MlightCadDocument {
  database?: MlightCadDatabase;
}

interface MlightCadDatabase {
  tables?: {
    blockTable?: MlightCadBlockTable;
  };
}

interface MlightCadBlockTable {
  newIterator?(): Iterable<MlightCadBlockRecord>;
}

interface MlightCadBlockRecord {
  name?: string;
  blockName?: string;
  layer?: string;
  newIterator?(): Iterable<MlightCadEntity>;
}

interface MlightCadEmbeddedMText {
  contents?: string;
  triggerModifiedEvent?(): void;
}

interface MlightCadEntity {
  contents?: string;
  textString?: string;
  dimensionText?: string;
  type?: string;
  entityType?: string;
  dxfName?: string;
  dxfname?: string;
  objectId?: string;
  layer?: string | { name?: string };
  layerName?: string;
  mtext?: MlightCadEmbeddedMText;
  triggerModifiedEvent?(): void;
}

interface SkpDerivativeManifest {
  schema: "architoken.skp_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "skp";
  viewer:
    | "panaec_skp_model"
    | "panaec_skp_ifc_model"
    | "licensed_adapter_required";
  engine: string;
  derivativeArtifact?: {
    kind: "skp-glb";
    url: string;
    mediaType: "model/gltf-binary";
    engine: string;
    etag: string;
    cacheHit: boolean;
    size?: number;
    source?: "cache" | "command" | "adapter" | "glb-fallback";
  };
  ifcArtifact?: {
    kind: "skp-ifc";
    url: string;
    mediaType: "application/p21";
    engine: string;
    etag: string;
    cacheHit: boolean;
    size?: number;
    source?: "cache" | "command" | "adapter" | "glb-fallback";
  };
  permissions: {
    canView: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  notes: string[];
}

interface OpenBimAppearancePolicy {
  schema: "architoken.openbim_appearance_policy.v1";
  version: string;
  ifcSchema: "IFC4";
  presentationStyleSources: string[];
  unstyledGeometry: string;
  syntheticMaterialColors: false;
}

interface ThreeDmDerivativeManifest {
  schema: "architoken.3dm_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "3dm";
  cacheKey?: string;
  appearancePolicy?: OpenBimAppearancePolicy;
  viewer: "panaec_3dm_ifc_model" | "licensed_adapter_required";
  engine: string;
  ifcArtifact?: {
    kind: "3dm-ifc";
    url: string;
    mediaType: "application/p21";
    engine: string;
    etag: string;
    cacheHit: boolean;
    cacheKey?: string;
    appearancePolicy?: OpenBimAppearancePolicy;
    size?: number;
  };
  permissions: {
    canView: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  notes: string[];
}

interface SkpSourcePackageEntry {
  name: string;
  directory: boolean;
  extension: string;
  kind:
    | "directory"
    | "archive"
    | "cad"
    | "bim"
    | "office"
    | "document"
    | "image"
    | "media"
    | "code"
    | "data"
    | "file";
  compressedSize: number;
  uncompressedSize: number;
  methodLabel: string;
  encrypted: boolean;
  unsafe: boolean;
  modifiedAt: string;
  depth: number;
}

interface SkpSourcePackageManifest {
  schema: "architoken.archive_manifest.v1";
  engine: string;
  entries: SkpSourcePackageEntry[];
  fileCount: number;
  directoryCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  encryptedCount: number;
  unsafePathCount: number;
  warnings: string[];
}

interface RvtDerivativeManifest {
  schema: "architoken.rvt_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "rvt" | "rfa";
  viewer: "panaec_rvt_model" | "adapter_required";
  engine: string;
  derivativeArtifact?: {
    kind: "rvt-collada";
    url: string;
    mediaType: "model/vnd.collada+xml";
    engine: string;
    etag: string;
    cacheHit: boolean;
    cacheKey?: string;
    size?: number;
  };
  scheduleArtifact?: {
    kind: "rvt-schedule";
    url: string;
    mediaType: string;
    engine: string;
    etag: string;
    cacheHit: boolean;
    cacheKey?: string;
    size?: number;
  };
  ifcArtifact?: {
    kind: "rvt-ifc";
    url: string;
    mediaType: string;
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

const meshExtensions = new Set([
  ".glb",
  ".gltf",
  ".ply",
  ".dae",
  ".3dm",
  ".obj",
  ".fbx",
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
const modelSvgProjectionMaxSegments = 18_000;
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

type ModelViewportCommand =
  | "reset"
  | "fit"
  | "zoomIn"
  | "zoomOut"
  | "tool:select"
  | "tool:measure"
  | "tool:coordinate"
  | "tool:cloud"
  | "tool:section"
  | "tool:walk"
  | "clear:overlays";
type ModelSelectionHighlightMode = "material" | "face";
type ModelViewportTool =
  | "select"
  | "measure"
  | "coordinate"
  | "cloud"
  | "section"
  | "walk";

interface ModelViewportPick {
  point: Vector3;
  objectName: string;
  expressID: number | null;
  faceIndex: number | null;
  snapKind: "surface" | "vertex";
}

interface ModelViewportMeasurement {
  id: string;
  start: Vector3;
  end: Vector3;
  startLabel: string;
  endLabel: string;
  distance: number;
  source: "points";
}

interface ModelViewportCoordinateProbe {
  id: string;
  point: Vector3;
  label: string;
}

interface ModelViewportCloudAnnotation {
  id: string;
  center: Vector3;
  normal: Vector3;
  radius: number;
  shape: ModelViewportCloudShape;
  points: Vector3[];
  label: string;
}

interface ModelViewportCloudShape {
  aspectRatio: number;
  scallopCount: number;
  scallopAmplitude: number;
  rotation: number;
}

const defaultViewTransform: ViewTransform = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scale: 1,
};
const modelViewportCommandEvent = "architoken:model-viewport-command";
const modelViewportCommandByWorkbenchTool: Partial<
  Record<EngineeringWorkbenchTool, ModelViewportCommand>
> = {
  select: "tool:select",
  measure: "tool:measure",
  coordinate: "tool:coordinate",
  cloud: "tool:cloud",
  section: "tool:section",
  walk: "tool:walk",
};
const commonThreeViewportWorkbenchTools: EngineeringWorkbenchTool[] = [
  "select",
  "measure",
  "coordinate",
  "cloud",
  "section",
  "walk",
];

function modelViewportCommandForWorkbenchTool(
  tool: EngineeringWorkbenchTool,
): ModelViewportCommand | null {
  return modelViewportCommandByWorkbenchTool[tool] ?? null;
}

function engineeringViewportToolFeedback(
  tool: EngineeringWorkbenchTool,
): string {
  if (tool === "measure") return "测量工具已连接当前三维视口。";
  if (tool === "coordinate") return "坐标探针已连接当前三维视口。";
  if (tool === "cloud") return "云线 overlay 已连接当前三维视口。";
  if (tool === "section") return "剖切平面已连接当前三维视口。";
  if (tool === "walk") return "漫游控制已连接当前三维视口。";
  return "选择工具已连接当前三维视口。";
}
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

export function OpenEngineeringEditor({
  file,
  sourceUrl,
}: OpenEngineeringEditorProps) {
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
      <MeshEngineeringViewer
        file={file}
        sourceUrl={sourceUrl}
        routeLabel={`${panaecLabel} · OpenUSD/USDZ 场景`}
      />
    );
  }

  if (ext === ".3dm") {
    return (
      <Rhino3dmPanAecDerivativeViewer file={file} sourceUrl={sourceUrl} />
    );
  }

  if (meshExtensions.has(ext)) {
    return <MeshEngineeringViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".ifc") {
    return <IfcNativeOpenViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".dxf") {
    return <MlightCadDrawingViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".dwg") {
    return <MlightCadDrawingViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".rvt" || ext === ".rfa") {
    return <RvtPanAecDerivativeViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".skp") {
    return <SketchUpPanAecPendingViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (occtExtensions.has(ext)) {
    return <OcctModelViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (unsupportedOcctKernelExtensions.has(ext)) {
    return (
      <LightweightEngineeringSourceViewer
        title="需要 PanAEC Engine 授权转换链路"
        file={file}
        sourceUrl={sourceUrl}
        reason="该格式需要 PanAEC Engine 后端几何服务生成可审计查看结果；当前浏览器不直接打开源文件。"
      />
    );
  }

  return (
    <LightweightEngineeringSourceViewer
      title="工程源文件轻量查看"
      file={file}
      sourceUrl={sourceUrl}
      reason="当前格式尚未启用 PanAEC Engine 几何查看服务。系统保留源文件记录，待后端转换服务生成可审计查看结果。"
    />
  );
}

export const OpenEngineeringViewer = OpenEngineeringEditor;

function MeshEngineeringViewer({
  file,
  sourceUrl,
  routeLabel,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  routeLabel?: string;
}) {
  const ext = file.localFile?.ext || extensionOf(file.name) || "unknown";
  const route = routeLabel ?? `${panaecLabel} · Mesh 源文件`;
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: "loading",
    message: "正在打开 PanAEC Engine 模型...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadMeshSource() {
      setState({
        status: "loading",
        message: "正在打开 PanAEC Engine 模型...",
      });

      try {
        let preview = await loadThreeSourcePreview(sourceUrl, {
          sourceFormat: ext,
          sourceName: file.name,
          mimeType: file.mimeType,
          routeLabel: route,
        });

        if (
          openUsdExtensions.has(ext.toLowerCase()) &&
          hasOpenUsdReferenceCompositionWarnings(preview.group)
        ) {
          const fallback = await findOpenUsdVisualFallback(file);
          if (fallback) {
            try {
              const fallbackPreview = await loadThreeSourcePreview(
                fallback.url,
                {
                  sourceFormat: fallback.ext,
                  sourceName: fallback.originalName,
                  mimeType: fallback.mimeType,
                  routeLabel: `${route} · GLB 视觉备援`,
                },
              );
              markOpenUsdVisualFallbackPreview(fallbackPreview, file, fallback);
              disposeGroup(preview.group);
              preview = fallbackPreview;
            } catch {
              // Keep the parsed USDZ view if the audited visual fallback is unavailable.
            }
          }
        }

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
  }, [ext, file, route, sourceUrl]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="PanAEC Engine 模型打开失败"
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
      status={`${panaecLabel} · ${ext.toUpperCase()} 模型`}
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
  toolbarActions,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  preview: OcctPreview;
  routeLabel: string;
  status: string;
  formatLabel: string;
  upAxis?: ModelUpAxis;
  toolbarActions?: ReactNode;
}) {
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [selectedObjectUuid, setSelectedObjectUuid] = useState<string | null>(
    null,
  );

  const effectiveSelectedObjectUuid =
    findMeshByUuid(preview.group, selectedObjectUuid)?.uuid ?? null;

  const selectedObject = findMeshByUuid(
    preview.group,
    effectiveSelectedObjectUuid,
  );
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
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={routeLabel}
      outlineNodes={buildThreeGroupWorkbenchOutline(
        file,
        preview.group,
        routeLabel,
        metrics,
      )}
      onSelectOutlineNode={(node) => {
        const objectUuid = engineeringMeshUuidFromTreeNode(node.id);
        if (objectUuid) setSelectedObjectUuid(objectUuid);
      }}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={routeLabel}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={selectedRows}
          selectedTitle={selectedObject?.name || "模型属性"}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
      enabledTools={commonThreeViewportWorkbenchTools}
      toolbarActions={toolbarActions}
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
        onClearSelection={() => setSelectedObjectUuid(null)}
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
  const [selectedFaceRef, setSelectedFaceRef] = useState<{
    objectUuid: string;
    faceIndex: number | null;
  } | null>(null);
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
          routeLabel: `${panaecLabel} · STL 模型`,
        });
        activeGroup = preview.group;

        if (!cancelled) {
          setSelectedObjectUuid(null);
          setSelectedFaceRef(null);
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

  const selectedObject = findMeshByUuid(state.value.group, selectedObjectUuid);
  const selectedFaceIndex =
    selectedFaceRef?.objectUuid === selectedObjectUuid
      ? selectedFaceRef.faceIndex
      : null;
  const selectedRows = selectedObject
    ? buildExchangeObjectPropertyRows(
        selectedObject,
        file,
        `${panaecLabel} · STL 模型`,
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
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={`${panaecLabel} · STL 模型`}
      outlineNodes={buildThreeGroupWorkbenchOutline(
        file,
        state.value.group,
        `${panaecLabel} · STL 模型`,
        metrics,
      )}
      onSelectOutlineNode={(node) => {
        const objectUuid = engineeringMeshUuidFromTreeNode(node.id);
        if (objectUuid) setSelectedObjectUuid(objectUuid);
      }}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={`${panaecLabel} · STL 模型`}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={selectedRows}
          selectedTitle={selectedObject?.name || "模型属性"}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
      enabledTools={commonThreeViewportWorkbenchTools}
    >
      <ThreeGroupViewport
        group={state.value.group}
        label={file.name}
        status={`${panaecLabel} · STL 模型`}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showChrome={false}
        selectionHighlightMode="face"
        selectedObjectUuid={selectedObjectUuid}
        onObjectSelect={(object) => setSelectedObjectUuid(object.uuid)}
        selectedFaceIndex={selectedFaceIndex}
        onFaceSelect={(object, faceIndex) =>
          setSelectedFaceRef({ objectUuid: object.uuid, faceIndex })
        }
        onClearSelection={() => {
          setSelectedObjectUuid(null);
          setSelectedFaceRef(null);
        }}
      />
    </EngineeringViewportFrame>
  );
}

function EngineeringViewportFrame({
  file,
  sourceUrl,
  metrics,
  routeLabel,
  children,
  outlineNodes,
  onSelectOutlineNode,
  toolbarActions,
  aside,
  asideOpen,
  asideLabel = "属性",
  onToggleAside,
  drawer,
  drawerOpen,
  drawerLabel = "摘要",
  onToggleDrawer,
  onZoomIn,
  onZoomOut,
  onWorkbenchToolCommand,
  enabledTools = ["select"],
}: {
  file?: ModuleFileNode;
  sourceUrl?: string;
  metrics: ViewerMetric[];
  routeLabel: string;
  children: ReactNode;
  outlineNodes?: EngineeringWorkbenchTreeNode[];
  onSelectOutlineNode?: (node: EngineeringWorkbenchTreeNode) => void;
  toolbarActions?: ReactNode;
  aside?: ReactNode;
  asideOpen?: boolean;
  asideLabel?: string;
  onToggleAside?: () => void;
  drawer?: ReactNode;
  drawerOpen?: boolean;
  drawerLabel?: string;
  onToggleDrawer?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onWorkbenchToolCommand?: (
    tool: EngineeringWorkbenchTool,
  ) => EngineeringWorkbenchCommandFeedback;
  enabledTools?: EngineeringWorkbenchTool[];
}) {
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [activeTool, setActiveTool] =
    useState<EngineeringWorkbenchTool>("select");
  const [toolFeedback, setToolFeedback] = useState<string | null>(null);
  const [embeddedNativeSession, setEmbeddedNativeSession] =
    useState<NativeExternalAppSession | null>(null);
  const [selectedOutlineNodeId, setSelectedOutlineNodeId] = useState<
    string | null
  >(null);
  const [outlinePanelWidth, setOutlinePanelWidth] = useState(
    defaultEngineeringOutlineWidth,
  );
  const [asidePanelWidth, setAsidePanelWidth] = useState(
    defaultEngineeringAsideWidth,
  );
  const nativeWorkbenchActive = Boolean(embeddedNativeSession);
  const viewerContract = file
    ? engineeringViewerContractForFileName(file.name, file.mimeType)
    : null;
  const viewerSummary = viewerContract
    ? summarizeEngineeringViewerCapabilities(viewerContract)
    : null;
  const toolbarMetrics =
    viewerContract && viewerSummary
      ? [
          ...metrics,
          {
            label: "统一",
            value: `${viewerSummary.implemented}/${viewerSummary.totalApplicable}`,
          },
        ]
      : metrics;
  const effectiveOutlineNodes = useMemo(
    () =>
      outlineNodes?.length
        ? outlineNodes
        : buildEngineeringWorkbenchOutline(
            file,
            routeLabel,
            metrics,
            viewerContract,
          ),
    [file, metrics, outlineNodes, routeLabel, viewerContract],
  );
  const effectiveSelectedOutlineNodeId =
    selectedOutlineNodeId &&
    findEngineeringTreeNode(effectiveOutlineNodes, selectedOutlineNodeId)
      ? selectedOutlineNodeId
      : (effectiveOutlineNodes[0]?.id ?? null);

  const selectWorkbenchTool = useCallback(
    (tool: EngineeringWorkbenchTool) => {
      if (!enabledTools.includes(tool)) {
        setToolFeedback(
          `${engineeringWorkbenchToolLabels[tool]}尚未接入当前格式的真实命令。`,
        );
        return;
      }
      setActiveTool(tool);
      const commandFeedback = onWorkbenchToolCommand?.(tool);
      if (commandFeedback !== undefined) {
        setToolFeedback(commandFeedback);
        focusEngineeringInteractiveViewport();
        return;
      }
      const viewportCommand = modelViewportCommandForWorkbenchTool(tool);
      if (viewportCommand) {
        dispatchModelViewportCommand(viewportCommand);
        setToolFeedback(engineeringViewportToolFeedback(tool));
        focusEngineeringInteractiveViewport();
        return;
      }
      if (tool === "select") {
        setToolFeedback(
          "选择模式：点击图元、构件或场景对象后在右侧属性栏查看详情。",
        );
        focusEngineeringInteractiveViewport();
        return;
      }
      if (tool === "edit") {
        setToolFeedback(
          "当前格式未接入真实在线编辑 adapter，工具栏不会创建伪编辑任务。",
        );
        return;
      }
      if (tool === "measure") {
        setToolFeedback("当前格式未接入交互测量命令。");
      } else if (tool === "coordinate") {
        setToolFeedback("当前格式未接入坐标探针命令。");
      } else if (tool === "cloud") {
        setToolFeedback("当前格式未接入云线 overlay 命令。");
      } else if (tool === "section") {
        setToolFeedback("当前格式未接入剖切/窗口命令。");
      } else if (tool === "walk") {
        setToolFeedback("当前格式未接入三维漫游命令。");
      } else if (tool === "annotate") {
        setToolFeedback("当前格式未接入真实批注工具。");
      }
      focusEngineeringInteractiveViewport();
    },
    [enabledTools, onWorkbenchToolCommand],
  );

  const selectOutlineNode = useCallback(
    (node: EngineeringWorkbenchTreeNode) => {
      setSelectedOutlineNodeId(node.id);
      onSelectOutlineNode?.(node);
    },
    [onSelectOutlineNode],
  );

  const toggleOutlinePanel = useCallback(() => {
    setOutlineOpen((open) => {
      if (open) return false;
      setOutlinePanelWidth((width) =>
        clampNumber(
          Math.max(width, defaultEngineeringOutlineWidth),
          minEngineeringOutlineWidth,
          maxEngineeringOutlineWidth,
        ),
      );
      return true;
    });
  }, []);

  return (
    <section className="relative flex h-[calc(100dvh-108px)] min-h-[560px] flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-slate-100">
      <EngineeringWorkbenchTopBar
        file={file}
        sourceUrl={sourceUrl}
        routeLabel={routeLabel}
        metrics={toolbarMetrics}
        activeTool={activeTool}
        outlineOpen={outlineOpen}
        asideOpen={Boolean(aside && asideOpen)}
        asideLabel={asideLabel}
        drawerOpen={Boolean(drawer && drawerOpen)}
        drawerLabel={drawerLabel}
        onSelectTool={selectWorkbenchTool}
        enabledTools={enabledTools}
        onNativeOpenFeedback={setToolFeedback}
        activeNativeApp={embeddedNativeSession?.app ?? null}
        onDirectOpen={() => {
          setEmbeddedNativeSession(null);
          setToolFeedback(null);
        }}
        onEmbeddedNativeSession={(session) => {
          setEmbeddedNativeSession(session);
          if (session) setToolFeedback(null);
        }}
        onToggleOutline={toggleOutlinePanel}
        onToggleAside={aside && onToggleAside ? onToggleAside : undefined}
        onToggleDrawer={drawer && onToggleDrawer ? onToggleDrawer : undefined}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        extraActions={toolbarActions}
      />

      <div className="flex min-h-0 flex-1">
        {outlineOpen && !nativeWorkbenchActive ? (
          <EngineeringOutlinePanel
            nodes={effectiveOutlineNodes}
            selectedNodeId={effectiveSelectedOutlineNodeId}
            contract={viewerContract}
            width={outlinePanelWidth}
            onSelectNode={selectOutlineNode}
          />
        ) : null}

        {outlineOpen && !nativeWorkbenchActive ? (
          <EngineeringPanelResizeHandle
            label="调整工程目录树列宽"
            width={outlinePanelWidth}
            minWidth={minEngineeringOutlineWidth}
            maxWidth={maxEngineeringOutlineWidth}
            resizeSide="after"
            onChange={setOutlinePanelWidth}
          />
        ) : null}

        <main className="relative min-w-0 flex-1 overflow-hidden bg-slate-950">
          {embeddedNativeSession ? (
            <EngineeringNativeWorkbenchPanel session={embeddedNativeSession} />
          ) : (
            <>
              <div className="absolute inset-0 h-full w-full">{children}</div>

              {toolFeedback ? (
                <EngineeringToolFeedbackPanel
                  activeTool={activeTool}
                  message={toolFeedback}
                  onClose={() => setToolFeedback(null)}
                />
              ) : null}

              {drawer && drawerOpen ? (
                <section className="viewer-floating-panel absolute bottom-3 left-3 right-3 z-20 max-h-[42%] overflow-auto rounded-md p-3">
                  {drawer}
                </section>
              ) : null}
            </>
          )}
        </main>

        {aside && asideOpen && !nativeWorkbenchActive ? (
          <EngineeringPanelResizeHandle
            label={`调整${asideLabel}列宽`}
            width={asidePanelWidth}
            minWidth={minEngineeringAsideWidth}
            maxWidth={maxEngineeringAsideWidth}
            resizeSide="before"
            onChange={setAsidePanelWidth}
          />
        ) : null}

        {aside && asideOpen && !nativeWorkbenchActive ? (
          <aside
            className="relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-l border-slate-700 bg-slate-900 text-slate-100 shadow-[-12px_0_28px_rgba(15,23,42,0.35)]"
            style={{ width: asidePanelWidth }}
          >
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-800 px-3 text-[11px] font-medium text-slate-200">
              <span className="truncate">{asideLabel}</span>
              {onToggleAside ? (
                <button
                  type="button"
                  onClick={onToggleAside}
                  className="viewer-ghost-tool flex h-6 w-6 items-center justify-center rounded"
                  aria-label={`收起${asideLabel}`}
                  title={`收起${asideLabel}`}
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div
              className="engineering-hide-scrollbar min-h-0 flex-1 overflow-auto"
              style={engineeringHiddenScrollStyle}
            >
              {aside}
            </div>
          </aside>
        ) : null}
      </div>

      {!nativeWorkbenchActive ? (
        <EngineeringWorkbenchStatusBar
          routeLabel={routeLabel}
          activeTool={activeTool}
          selectedNodeId={effectiveSelectedOutlineNodeId}
          metrics={toolbarMetrics}
          file={file}
        />
      ) : null}
    </section>
  );
}

function EngineeringWorkbenchTopBar({
  file,
  sourceUrl,
  routeLabel,
  metrics,
  activeTool,
  outlineOpen,
  asideOpen,
  asideLabel,
  drawerOpen,
  drawerLabel,
  onSelectTool,
  enabledTools,
  onNativeOpenFeedback,
  activeNativeApp,
  onDirectOpen,
  onEmbeddedNativeSession,
  onToggleOutline,
  onToggleAside,
  onToggleDrawer,
  onZoomIn,
  onZoomOut,
  extraActions,
}: {
  file: ModuleFileNode | undefined;
  sourceUrl: string | undefined;
  routeLabel: string;
  metrics: ViewerMetric[];
  activeTool: EngineeringWorkbenchTool;
  outlineOpen: boolean;
  asideOpen: boolean;
  asideLabel: string;
  drawerOpen: boolean;
  drawerLabel: string;
  onSelectTool: (tool: EngineeringWorkbenchTool) => void;
  enabledTools: EngineeringWorkbenchTool[];
  onNativeOpenFeedback: (message: string) => void;
  activeNativeApp: "freecad" | "blender" | null;
  onDirectOpen: () => void;
  onEmbeddedNativeSession: (session: NativeExternalAppSession | null) => void;
  onToggleOutline: () => void;
  onToggleAside?: (() => void) | undefined;
  onToggleDrawer?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
  extraActions?: ReactNode;
}) {
  const extension = file ? file.localFile?.ext || extensionOf(file.name) : "";

  return (
    <header className="z-20 shrink-0 border-b border-slate-800 bg-slate-900/95">
      <div className="flex min-h-9 items-center gap-2 overflow-x-auto px-2 py-1">
        {activeNativeApp === null ? (
          <div className="flex shrink-0 items-center gap-1 border-r border-slate-700/80 pr-2">
            <EngineeringWorkbenchIconButton
              label={outlineOpen ? "收起目录树" : "展开目录树"}
              pressed={outlineOpen}
              onClick={onToggleOutline}
            >
              {outlineOpen ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              )}
            </EngineeringWorkbenchIconButton>
            {file && sourceUrl ? (
              <a
                href={sourceUrl}
                download={file.name}
                className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md opacity-90"
                title="下载源文件"
                aria-label="下载源文件"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}

        {activeNativeApp === null ? (
          <EngineeringToolPalette
            activeTool={activeTool}
            enabledTools={enabledTools}
            onSelectTool={onSelectTool}
          />
        ) : null}

        <NativeExternalAppActions
          file={file}
          sourceUrl={sourceUrl}
          activeNativeApp={activeNativeApp}
          onDirectOpen={onDirectOpen}
          onFeedback={onNativeOpenFeedback}
          onEmbeddedNativeSession={onEmbeddedNativeSession}
        />

        {activeNativeApp === null ? (
          <div className="flex shrink-0 items-center gap-1 border-l border-slate-700/80 pl-2">
            <EngineeringCommandActions
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
            />
            {onToggleDrawer ? (
              <EngineeringWorkbenchIconButton
                label={drawerOpen ? `收起${drawerLabel}` : `展开${drawerLabel}`}
                pressed={drawerOpen}
                onClick={onToggleDrawer}
              >
                <PanelBottom className="h-3.5 w-3.5" />
              </EngineeringWorkbenchIconButton>
            ) : null}
            {onToggleAside ? (
              <EngineeringWorkbenchIconButton
                label={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
                pressed={asideOpen}
                onClick={onToggleAside}
              >
                {asideOpen ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
              </EngineeringWorkbenchIconButton>
            ) : null}
            {extraActions}
          </div>
        ) : null}

        <div className="ml-auto flex min-w-[220px] shrink items-center justify-end gap-2 overflow-hidden pl-2">
          <div className="min-w-0 text-right">
            <p className="truncate text-[10px] font-medium text-slate-100">
              {file?.name ?? "工程文件"}
            </p>
            <p className="truncate text-[9px] text-slate-400">
              {routeLabel}
              {extension ? ` · ${extension}` : ""}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-1 xl:flex">
            {metrics.slice(0, 3).map((metric) => (
              <span
                key={`${metric.label}:${metric.value}`}
                className="max-w-24 truncate rounded border border-slate-700 bg-slate-950/40 px-1.5 py-0.5 text-[9px] text-slate-300"
                title={`${metric.label}: ${metric.value}`}
              >
                {metric.label}:{metric.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function EngineeringToolFeedbackPanel({
  activeTool,
  message,
  onClose,
}: {
  activeTool: EngineeringWorkbenchTool;
  message: string;
  onClose: () => void;
}) {
  return (
    <section className="viewer-floating-panel absolute left-3 top-3 z-20 max-w-sm rounded-md border border-emerald-400/20 p-3 text-xs text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-emerald-300">
            {engineeringWorkbenchToolLabels[activeTool]}
          </p>
          <p className="mt-1 leading-5 text-slate-200">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="viewer-ghost-tool shrink-0 rounded px-2 py-1 text-[10px]"
        >
          关闭
        </button>
      </div>
    </section>
  );
}

function EngineeringNativeWorkbenchPanel({
  session,
}: {
  session: NativeExternalAppSession;
}) {
  const appLabel = session.app === "freecad" ? "FreeCAD" : "Blender";
  return (
    <section className="absolute inset-0 z-10 flex flex-col bg-black">
      {session.launchUrl ? (
        <iframe
          title={`${appLabel} engineering native workbench`}
          src={session.launchUrl}
          className="h-full min-h-0 w-full flex-1 border-0 bg-black"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-950 p-6 text-center text-xs text-slate-300">
          工程原生工作台 sidecar 未返回嵌入地址。请启动 native-workbench
          服务后重试。
        </div>
      )}
    </section>
  );
}

function EngineeringToolPalette({
  activeTool,
  enabledTools,
  onSelectTool,
}: {
  activeTool: EngineeringWorkbenchTool;
  enabledTools: EngineeringWorkbenchTool[];
  onSelectTool: (tool: EngineeringWorkbenchTool) => void;
}) {
  const tools: Array<{
    tool: EngineeringWorkbenchTool;
    label: string;
    title: string;
    icon: ReactNode;
  }> = [
    {
      tool: "select",
      label: "选择",
      title: "选择构件、图元或场景对象",
      icon: <MousePointer2 className="h-3.5 w-3.5" />,
    },
    {
      tool: "edit",
      label: "编辑",
      title: "创建受控在线编辑草案",
      icon: <PencilLine className="h-3.5 w-3.5" />,
    },
    {
      tool: "measure",
      label: "测量",
      title: "测量长度、面积或模型距离",
      icon: <Ruler className="h-3.5 w-3.5" />,
    },
    {
      tool: "coordinate",
      label: "坐标",
      title: "读取模型表面世界坐标",
      icon: <LocateFixed className="h-3.5 w-3.5" />,
    },
    {
      tool: "cloud",
      label: "云线",
      title: "在模型表面创建修订云线 overlay",
      icon: <Cloud className="h-3.5 w-3.5" />,
    },
    {
      tool: "section",
      label: "剖切",
      title: "创建剖切/裁剪查看任务",
      icon: <Scissors className="h-3.5 w-3.5" />,
    },
    {
      tool: "walk",
      label: "漫游",
      title: "第一人称漫游当前模型视图",
      icon: <Footprints className="h-3.5 w-3.5" />,
    },
    {
      tool: "annotate",
      label: "批注",
      title: "创建 CDE 批注 overlay",
      icon: <MessageSquareText className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="flex shrink-0 items-center gap-1">
      {tools
        .filter((item) => enabledTools.includes(item.tool))
        .map((item) => (
          <EngineeringWorkbenchIconButton
            key={item.tool}
            label={item.label}
            title={item.title}
            pressed={activeTool === item.tool}
            onClick={() => onSelectTool(item.tool)}
          >
            {item.icon}
          </EngineeringWorkbenchIconButton>
        ))}
    </div>
  );
}

function NativeExternalAppActions({
  file,
  sourceUrl,
  activeNativeApp,
  onDirectOpen,
  onFeedback,
  onEmbeddedNativeSession,
}: {
  file: ModuleFileNode | undefined;
  sourceUrl: string | undefined;
  activeNativeApp: "freecad" | "blender" | null;
  onDirectOpen: () => void;
  onFeedback: (message: string) => void;
  onEmbeddedNativeSession: (session: NativeExternalAppSession | null) => void;
}) {
  const [launchingApp, setLaunchingApp] = useState<
    "freecad" | "blender" | null
  >(null);
  const [committingSession, setCommittingSession] = useState(false);
  const [activeSession, setActiveSession] =
    useState<NativeExternalAppSession | null>(null);
  if (!file) return null;

  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const freecadAvailable = nativeFreeCadExtensions.has(ext);
  const blenderAvailable = nativeBlenderExtensions.has(ext);
  const freeCadCadImportIsLossy = nativeFreeCadLossyCadExtensions.has(ext);

  async function launchNativeApp(app: "freecad" | "blender") {
    const fileId = resolveOpenEngineeringEditorLocalFileId(file, sourceUrl);
    if (!fileId) {
      onFeedback("缺少 CDE 本地文件 ID，无法启动原生应用。");
      return;
    }

    setLaunchingApp(app);
    if (app === "freecad" && freeCadCadImportIsLossy) {
      onFeedback(
        "正在请求嵌入 FreeCAD。注意：FreeCAD 对 DXF/DWG 只导入标准几何，天正/TCH/代理实体可能不完整；完整图纸优先使用“直接”。",
      );
    } else {
      onFeedback(
        `正在请求嵌入 ${app === "freecad" ? "FreeCAD" : "Blender"} 原生工作台...`,
      );
    }
    try {
      const response = await fetch(
        `/api/local-files/${encodeURIComponent(fileId)}/native-open`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ app, mode: "embedded" }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        status?: string;
        pid?: number;
        binary?: string;
        embedded?: {
          launchUrl?: string;
          publicUrl?: string;
          status?: string;
          note?: string;
        };
        session?: {
          sessionId?: string;
          commitUrl?: string;
          workspaceFilePath?: string;
        };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const sessionId = payload.session?.sessionId;
      const commitUrl = payload.session?.commitUrl;
      if (sessionId && commitUrl) {
        const session = {
          app,
          sessionId,
          commitUrl,
          launchUrl: payload.embedded?.launchUrl ?? "",
          workspaceFilePath: payload.session?.workspaceFilePath ?? "",
        };
        setActiveSession(session);
        onEmbeddedNativeSession(session);
      }
      const lossyCadNotice =
        app === "freecad" && freeCadCadImportIsLossy
          ? " 当前 DXF/DWG 含有 FreeCAD 可能不支持的 CAD 专有实体；若画面缺失，请切回“直接”查看完整图纸。"
          : "";
      onFeedback(
        `${app === "freecad" ? "FreeCAD" : "Blender"} 已嵌入项目工作台。工作副本: ${
          payload.session?.workspaceFilePath ?? "已创建"
        }。原生程序保存后点击“导入原生保存”生成 CDE 新版本。${lossyCadNotice}`,
      );
    } catch (error) {
      onFeedback(
        `${app === "freecad" ? "FreeCAD" : "Blender"} 启动失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setLaunchingApp(null);
    }
  }

  async function commitNativeSession() {
    if (!activeSession) return;
    setCommittingSession(true);
    onFeedback("正在导入原生应用保存的工作副本...");
    try {
      const response = await fetch(activeSession.commitUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          app: activeSession.app,
          sessionId: activeSession.sessionId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        updated?: boolean;
        version?: string;
        checksum?: string;
        file?: LocalFileMetadata;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      if (payload.file) {
        window.dispatchEvent(
          new CustomEvent(architokenLocalFileChangedEventName, {
            detail: {
              file: payload.file,
              reason: "native-session-commit",
              requestedAt: new Date().toISOString(),
            },
          }),
        );
      }
      setActiveSession(null);
      onEmbeddedNativeSession(null);
      onFeedback(
        payload.message ||
          (payload.updated
            ? `已导入原生保存并生成 ${payload.version ?? "新版本"}。`
            : "原生工作副本没有变化，无需生成新版本。"),
      );
    } catch (error) {
      onFeedback(
        `导入原生保存失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setCommittingSession(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1 border-l border-slate-700/80 pl-2">
      <div
        className="flex h-7 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-950/70"
        aria-label="工程文件打开方式"
      >
        <button
          type="button"
          onClick={onDirectOpen}
          className={`flex items-center gap-1 px-2 text-[10px] font-medium ${
            activeNativeApp === null
              ? "bg-emerald-500/20 text-emerald-100"
              : "text-slate-300 hover:bg-slate-800"
          }`}
          title="使用 ArchIToken 直接预览/编辑"
          aria-pressed={activeNativeApp === null}
        >
          <MousePointer2 className="h-3 w-3" />
          直接
        </button>
        <button
          type="button"
          onClick={() => void launchNativeApp("freecad")}
          disabled={!freecadAvailable || launchingApp !== null}
          className={`flex items-center gap-1 border-l border-slate-700 px-2 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            activeNativeApp === "freecad"
              ? "bg-emerald-500/20 text-emerald-100"
              : "text-slate-300 hover:bg-slate-800"
          }`}
          title={
            freecadAvailable
              ? freeCadCadImportIsLossy
                ? "FreeCAD 可尝试导入 DXF/DWG 标准几何；天正/TCH/代理实体可能不完整，完整显示请用“直接”"
                : "在 ArchIToken 内嵌 FreeCAD 工作台编辑当前 CDE 文件的会话工作副本"
              : "当前格式未登记为 FreeCAD 原生打开格式"
          }
          aria-pressed={activeNativeApp === "freecad"}
        >
          {launchingApp === "freecad" ? (
            <ArchLoadingFlow label="启动 FreeCAD" size="inline" />
          ) : freeCadCadImportIsLossy ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <DraftingCompass className="h-3 w-3" />
          )}
          FreeCAD
        </button>
        <button
          type="button"
          onClick={() => void launchNativeApp("blender")}
          disabled={!blenderAvailable || launchingApp !== null}
          className={`flex items-center gap-1 border-l border-slate-700 px-2 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            activeNativeApp === "blender"
              ? "bg-emerald-500/20 text-emerald-100"
              : "text-slate-300 hover:bg-slate-800"
          }`}
          title={
            blenderAvailable
              ? "在 ArchIToken 内嵌 Blender 工作台编辑当前 CDE 文件的会话工作副本"
              : "当前格式未登记为 Blender 原生打开格式"
          }
          aria-pressed={activeNativeApp === "blender"}
        >
          {launchingApp === "blender" ? (
            <ArchLoadingFlow label="启动 Blender" size="inline" />
          ) : (
            <BoxIcon className="h-3 w-3" />
          )}
          Blender
        </button>
      </div>
      <EngineeringWorkbenchIconButton
        label="导入原生保存"
        title={
          activeSession
            ? `从 ${activeSession.app === "freecad" ? "FreeCAD" : "Blender"} 工作副本导入 CDE 新版本`
            : "启动 FreeCAD 或 Blender 会话后可导入原生保存"
        }
        disabled={!activeSession || committingSession || launchingApp !== null}
        onClick={() => void commitNativeSession()}
      >
        {committingSession ? (
          <ArchLoadingFlow label="导入中" size="inline" />
        ) : (
          <FileUp className="h-3.5 w-3.5" />
        )}
      </EngineeringWorkbenchIconButton>
      {activeSession ? (
        <EngineeringWorkbenchIconButton
          label="原生会话状态"
          title={`${
            activeSession.app === "freecad" ? "FreeCAD" : "Blender"
          } 会话: ${activeSession.sessionId}\n工作副本: ${
            activeSession.workspaceFilePath || "-"
          }`}
          disabled
        >
          <FileCog className="h-3.5 w-3.5 text-emerald-300" />
        </EngineeringWorkbenchIconButton>
      ) : null}
    </div>
  );
}

interface NativeExternalAppSession {
  app: "freecad" | "blender";
  sessionId: string;
  commitUrl: string;
  launchUrl: string;
  workspaceFilePath: string;
}

const nativeFreeCadExtensions = new Set([
  ".step",
  ".stp",
  ".iges",
  ".igs",
  ".brep",
  ".stl",
  ".obj",
  ".fcstd",
  ".ifc",
  ".ifczip",
  ".dxf",
]);

const nativeFreeCadLossyCadExtensions = new Set([".dxf"]);

const nativeBlenderExtensions = new Set([
  ".blend",
  ".glb",
  ".gltf",
  ".stl",
  ".obj",
  ".fbx",
  ".dae",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".ply",
]);

function EngineeringWorkbenchIconButton({
  label,
  title,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
      className={`viewer-ghost-tool flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
        pressed ? "text-emerald-300 ring-1 ring-emerald-400/50" : ""
      }`}
    >
      {children}
    </button>
  );
}

function EngineeringOutlinePanel({
  nodes,
  selectedNodeId,
  contract,
  width,
  onSelectNode,
}: {
  nodes: EngineeringWorkbenchTreeNode[];
  selectedNodeId: string | null;
  contract: EngineeringViewerFormatContract | null;
  width: number;
  onSelectNode: (node: EngineeringWorkbenchTreeNode) => void;
}) {
  return (
    <aside
      data-engineering-outline-panel="true"
      className="flex min-w-0 shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-900/95"
      style={{ width }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-slate-800 px-2 text-[11px] font-medium text-slate-200">
        <FolderTree className="h-3.5 w-3.5 text-emerald-300" />
        <span className="truncate">工程目录树</span>
      </div>
      <div
        className="engineering-hide-scrollbar min-h-0 flex-1 overflow-auto px-1.5 py-2"
        style={engineeringHiddenScrollStyle}
      >
        <div className="space-y-0.5">
          {nodes.map((node) => (
            <EngineeringTreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      </div>
      {contract ? (
        <div
          className="engineering-hide-scrollbar max-h-56 shrink-0 overflow-auto border-t border-slate-800 p-2"
          style={engineeringHiddenScrollStyle}
        >
          <EngineeringViewerContractSummaryPanel contract={contract} />
        </div>
      ) : null}
    </aside>
  );
}

function EngineeringPanelResizeHandle({
  label,
  width,
  minWidth,
  maxWidth,
  resizeSide,
  onChange,
}: {
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  resizeSide: "before" | "after";
  onChange: (width: number) => void;
}) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const applyWidth = useCallback(
    (nextWidth: number) => {
      onChange(clampNumber(Math.round(nextWidth), minWidth, maxWidth));
    },
    [maxWidth, minWidth, onChange],
  );

  function widthFromDelta(startWidth: number, deltaX: number) {
    return resizeSide === "after" ? startWidth + deltaX : startWidth - deltaX;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    dragRef.current = { startX: event.clientX, startWidth: width };
    element.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      applyWidth(
        widthFromDelta(drag.startWidth, moveEvent.clientX - drag.startX),
      );
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const direction = resizeSide === "after" ? 1 : -1;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyWidth(width - direction * (event.shiftKey ? 40 : 16));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      applyWidth(width + direction * (event.shiftKey ? 40 : 16));
    }
    if (event.key === "Home") {
      event.preventDefault();
      applyWidth(minWidth);
    }
    if (event.key === "End") {
      event.preventDefault();
      applyWidth(maxWidth);
    }
  }

  return (
    <div
      className="engineering-pane-resizer hidden md:block"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
}

function EngineeringTreeNodeRow({
  node,
  depth,
  selectedNodeId,
  onSelectNode,
}: {
  node: EngineeringWorkbenchTreeNode;
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (node: EngineeringWorkbenchTreeNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const [open, setOpen] = useState(depth < 2);
  const selected = selectedNodeId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelectNode(node);
          if (hasChildren) setOpen((value) => !value);
        }}
        className={`flex min-h-7 w-full min-w-0 items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] ${
          selected
            ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/25"
            : "text-slate-200 hover:bg-slate-800/80"
        }`}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
        title={node.meta ? `${node.label} · ${node.meta}` : node.label}
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center text-slate-400">
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </span>
        <span className="grid h-4 w-4 shrink-0 place-items-center text-slate-300">
          {engineeringTreeNodeIcon(node.kind)}
        </span>
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        {node.badge ? (
          <span className="max-w-14 shrink-0 truncate rounded bg-slate-950/60 px-1 py-0.5 font-mono text-[9px] text-slate-300">
            {node.badge}
          </span>
        ) : null}
      </button>
      {node.meta ? (
        <p
          className="truncate pb-1 pr-2 text-[9px] text-slate-500"
          style={{ paddingLeft: `${36 + depth * 12}px` }}
        >
          {node.meta}
        </p>
      ) : null}
      {hasChildren && open ? (
        <div>
          {node.children!.map((child) => (
            <EngineeringTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function engineeringTreeNodeIcon(kind: EngineeringWorkbenchTreeKind) {
  if (kind === "layer") return <Layers3 className="h-3.5 w-3.5" />;
  if (kind === "layout" || kind === "grid") {
    return <Grid3X3 className="h-3.5 w-3.5" />;
  }
  if (kind === "block") return <DraftingCompass className="h-3.5 w-3.5" />;
  if (kind === "mesh") return <BoxIcon className="h-3.5 w-3.5" />;
  if (kind === "scene" || kind === "collection") {
    return <FolderTree className="h-3.5 w-3.5" />;
  }
  if (kind === "element" || kind === "type") {
    return <Building2 className="h-3.5 w-3.5" />;
  }
  if (kind === "property" || kind === "metric") {
    return <ClipboardList className="h-3.5 w-3.5" />;
  }
  if (kind === "annotation") {
    return <MessageSquareText className="h-3.5 w-3.5" />;
  }
  if (kind === "adapter") return <Workflow className="h-3.5 w-3.5" />;
  if (kind === "source" || kind === "file") {
    return <FileCog className="h-3.5 w-3.5" />;
  }
  if (kind === "material") return <BoxIcon className="h-3.5 w-3.5" />;
  return <FolderTree className="h-3.5 w-3.5" />;
}

function EngineeringWorkbenchStatusBar({
  routeLabel,
  activeTool,
  selectedNodeId,
  metrics,
  file,
}: {
  routeLabel: string;
  activeTool: EngineeringWorkbenchTool;
  selectedNodeId: string | null;
  metrics: ViewerMetric[];
  file: ModuleFileNode | undefined;
}) {
  return (
    <footer className="flex min-h-7 shrink-0 items-center gap-2 overflow-hidden border-t border-slate-800 bg-slate-900/95 px-2 text-[10px] text-slate-400">
      <span className="shrink-0 text-emerald-300">Open CDE</span>
      <span className="hidden shrink-0 sm:inline">源文件为真源</span>
      <span className="hidden shrink-0 md:inline">
        工具:{engineeringWorkbenchToolLabels[activeTool]}
      </span>
      <span className="hidden min-w-0 truncate lg:inline">{routeLabel}</span>
      <span className="min-w-0 truncate">
        选择:{selectedNodeId ?? file?.name ?? "未选中"}
      </span>
      <span className="ml-auto hidden shrink-0 text-slate-500 xl:inline">
        {metrics
          .slice(0, 4)
          .map((metric) => `${metric.label}:${metric.value}`)
          .join(" · ")}
      </span>
    </footer>
  );
}

const engineeringWorkbenchToolLabels: Record<EngineeringWorkbenchTool, string> =
  {
    select: "选择",
    edit: "编辑",
    measure: "测量",
    coordinate: "坐标",
    cloud: "云线",
    section: "剖切",
    walk: "漫游",
    annotate: "批注",
  };

const defaultEngineeringOutlineWidth = 246;
const minEngineeringOutlineWidth = 188;
const maxEngineeringOutlineWidth = 430;
const defaultEngineeringAsideWidth = 318;
const minEngineeringAsideWidth = 250;
const maxEngineeringAsideWidth = 520;
const engineeringHiddenScrollStyle: CSSProperties = {
  overscrollBehavior: "contain",
  scrollbarWidth: "none",
};

export function buildEngineeringWorkbenchOutline(
  file: ModuleFileNode | undefined,
  routeLabel: string,
  metrics: readonly ViewerMetric[] = [],
  contract: EngineeringViewerFormatContract | null = file
    ? engineeringViewerContractForFileName(file.name, file.mimeType)
    : null,
): EngineeringWorkbenchTreeNode[] {
  if (!file) {
    return [
      {
        id: "engineering:file",
        label: "工程文件",
        kind: "file",
        meta: routeLabel,
      },
    ];
  }

  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const fileType = fileTypeForFileName(file.name);
  const nodes: EngineeringWorkbenchTreeNode[] = [
    {
      id: "engineering:file",
      label: file.name,
      kind: "file",
      meta: `${file.mimeType || fileType?.label || "source"} · ${formatModuleFileSize(file.size)}`,
      badge: file.version ?? ext,
      children: [
        {
          id: "engineering:source-record",
          label: "CDE 源文件记录",
          kind: "source",
          meta: file.localFileId ?? file.localFile?.fileId ?? file.id,
        },
        {
          id: "engineering:adapter-route",
          label: contract?.commandAdapter ?? "格式适配器",
          kind: "adapter",
          meta: routeLabel,
          badge: contract?.runtime,
        },
      ],
    },
  ];

  if (ext === ".dwg" || ext === ".dxf") {
    nodes.push(...cadDrawingOutlineNodes(ext));
  } else if (ext === ".ifc" || ext === ".ifczip") {
    nodes.push(...ifcBaselineOutlineNodes());
  } else if (occtExtensions.has(ext)) {
    nodes.push(...brepBaselineOutlineNodes(ext));
  } else if (meshExtensions.has(ext) || openUsdExtensions.has(ext)) {
    nodes.push(...meshBaselineOutlineNodes(ext));
  } else if (ext === ".blend") {
    nodes.push(...blendBaselineOutlineNodes());
  } else {
    nodes.push({
      id: "engineering:adapter-required",
      label: "待接入格式目录",
      kind: "adapter",
      meta: "需要 worker / sidecar / licensed adapter 暴露对象树",
      badge: "pending",
    });
  }

  if (metrics.length) {
    nodes.push({
      id: "engineering:diagnostics",
      label: "查看器诊断",
      kind: "metric",
      children: metrics.map((metric, index) => ({
        id: `engineering:metric:${index}:${metric.label}`,
        label: metric.label,
        kind: "metric",
        meta: metric.value,
      })),
    });
  }

  return nodes;
}

function cadDrawingOutlineNodes(ext: string): EngineeringWorkbenchTreeNode[] {
  return [
    {
      id: "cad:layouts",
      label: "布局 / 空间",
      kind: "layout",
      meta: `${ext.toUpperCase()} 图纸布局`,
      children: [
        { id: "cad:layout:model", label: "模型空间", kind: "layout" },
        { id: "cad:layout:paper", label: "图纸空间", kind: "layout" },
      ],
    },
    {
      id: "cad:layers",
      label: "图层",
      kind: "layer",
      meta: "图纸图层表",
      children: [
        { id: "cad:layer:0", label: "0", kind: "layer" },
        { id: "cad:layer:axis", label: "轴网 / Grid", kind: "layer" },
        { id: "cad:layer:wall", label: "墙体 / Wall", kind: "layer" },
        { id: "cad:layer:door-window", label: "门窗 / Opening", kind: "layer" },
        { id: "cad:layer:dimension", label: "尺寸 / Dimension", kind: "layer" },
        { id: "cad:layer:text", label: "文字 / Text", kind: "layer" },
      ],
    },
    {
      id: "cad:blocks",
      label: "块参照",
      kind: "block",
      meta: "门窗、设备、详图符号等块对象",
    },
    {
      id: "cad:annotations",
      label: "标注与批注",
      kind: "annotation",
      meta: "尺寸、引线、文字、CDE overlay",
    },
  ];
}

function ifcBaselineOutlineNodes(): EngineeringWorkbenchTreeNode[] {
  return [
    {
      id: "ifc:spatial",
      label: "空间结构",
      kind: "collection",
      children: [
        { id: "ifc:project", label: "IfcProject", kind: "element" },
        { id: "ifc:site", label: "IfcSite", kind: "element" },
        { id: "ifc:building", label: "IfcBuilding", kind: "element" },
        { id: "ifc:storey", label: "IfcBuildingStorey", kind: "element" },
      ],
    },
    {
      id: "ifc:types",
      label: "构件类型",
      kind: "type",
      children: [
        { id: "ifc:type:wall", label: "墙 / Wall", kind: "type" },
        { id: "ifc:type:slab", label: "板 / Slab", kind: "type" },
        { id: "ifc:type:beam", label: "梁 / Beam", kind: "type" },
        { id: "ifc:type:column", label: "柱 / Column", kind: "type" },
        {
          id: "ifc:type:door-window",
          label: "门窗 / Door Window",
          kind: "type",
        },
      ],
    },
    {
      id: "ifc:properties",
      label: "属性集 / 数量",
      kind: "property",
      children: [
        { id: "ifc:pset", label: "Pset_*", kind: "property" },
        { id: "ifc:qto", label: "Qto_*", kind: "property" },
        { id: "ifc:material", label: "Material", kind: "material" },
        { id: "ifc:classification", label: "Classification", kind: "property" },
      ],
    },
  ];
}

function brepBaselineOutlineNodes(ext: string): EngineeringWorkbenchTreeNode[] {
  return [
    {
      id: "brep:topology",
      label: "B-Rep 拓扑",
      kind: "collection",
      meta: `${ext.toUpperCase()} / OCCT`,
      children: [
        { id: "brep:solids", label: "Solids", kind: "mesh" },
        { id: "brep:shells", label: "Shells", kind: "mesh" },
        { id: "brep:faces", label: "Faces", kind: "mesh" },
        { id: "brep:edges", label: "Edges / Curves", kind: "grid" },
      ],
    },
    {
      id: "brep:properties",
      label: "材料与属性",
      kind: "property",
      meta: "源属性优先，网格只是显示缓存",
    },
  ];
}

function meshBaselineOutlineNodes(ext: string): EngineeringWorkbenchTreeNode[] {
  return [
    {
      id: "mesh:scene",
      label: "Scene Collection",
      kind: "scene",
      meta: ext.toUpperCase(),
      children: [
        { id: "mesh:geometry", label: "Geometry", kind: "mesh" },
        { id: "mesh:materials", label: "Materials", kind: "material" },
        { id: "mesh:uv", label: "UV / Attributes", kind: "property" },
        { id: "mesh:animations", label: "Animations", kind: "collection" },
      ],
    },
  ];
}

function blendBaselineOutlineNodes(): EngineeringWorkbenchTreeNode[] {
  return [
    {
      id: "blend:scene",
      label: "Blender Scene",
      kind: "scene",
      children: [
        { id: "blend:collections", label: "Collections", kind: "collection" },
        { id: "blend:objects", label: "Objects", kind: "mesh" },
        { id: "blend:materials", label: "Materials", kind: "material" },
        { id: "blend:modifiers", label: "Modifiers", kind: "property" },
      ],
    },
  ];
}

function findEngineeringTreeNode(
  nodes: readonly EngineeringWorkbenchTreeNode[],
  id: string,
): EngineeringWorkbenchTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children
      ? findEngineeringTreeNode(node.children, id)
      : null;
    if (child) return child;
  }
  return null;
}

function EngineeringViewerContractSummaryPanel({
  contract,
}: {
  contract: EngineeringViewerFormatContract;
}) {
  const summary = summarizeEngineeringViewerCapabilities(contract);
  const trackedCapabilities: EngineeringViewerCapabilityId[] = [
    "source_axis_grid",
    "unit_normalization",
    "coordinate_direction",
    "color_material",
    "unified_toolbar",
    "unified_property_panel",
    "quantity_takeoff",
  ];

  return (
    <div className="space-y-2 text-[10px] leading-4">
      <div className="viewer-floating-field rounded-md p-2">
        <p className="font-medium text-[var(--arch-primary)]">
          {contract.label}
        </p>
        <p className="mt-1 text-[var(--arch-text-muted)]">
          {summary.implemented}/{summary.totalApplicable} 已统一 ·{" "}
          {summary.partial} 部分 ·{" "}
          {summary.adapterRequired + summary.licensedAdapterRequired} 需适配器
        </p>
      </div>
      <dl className="grid gap-1">
        {trackedCapabilities.map((capabilityId) => {
          const item = engineeringViewerCapabilityForContract(
            contract,
            capabilityId,
          );
          return (
            <div
              key={item.id}
              className="viewer-floating-field rounded-md px-2 py-1.5"
            >
              <dt className="font-medium text-[var(--arch-text)]">
                {item.label} ·{" "}
                {formatEngineeringViewerCapabilityStatus(item.status)}
              </dt>
              <dd className="mt-0.5 text-[var(--arch-text-muted)]">
                {item.note}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function engineeringEditorCommandToFileAction(
  command: EngineeringEditorCommand,
): EngineeringEditorFileAction | null {
  if (command === "edit") return "online_edit";
  if (command === "ai-generate") return "ai_generate";
  return null;
}

export function buildEngineeringEditorCapabilityMap(
  file?: Pick<ModuleFileNode, "name" | "moduleId" | "mimeType">,
): EngineeringEditorCapabilityMap {
  const fileName = file?.name ?? "";
  const ext = extensionOf(fileName);
  const requirement = ext ? adapterRequirementForExtension(ext) : undefined;
  const sources = fileName ? adapterSourcesForFileName(fileName) : [];

  if (!requirement) {
    return {
      family: "unregistered",
      status: "adapter_required",
      route: "PanAI -> ToolRouter -> AdapterSourceRegistry",
      adapters: ["registered parser/viewer worker"],
      sourceLabels: [],
      boundary: "worker_or_sidecar_required",
      completeUseMandate:
        "未登记格式仍必须进入 AdapterSourceRegistry、worker/sidecar/licensed adapter 或 blocked evidence。",
    };
  }

  return {
    family: requirement.family,
    status: requirement.status,
    route: [
      `import:${requirement.importRoute}`,
      `edit:${requirement.onlineEditRoute}`,
      `ai:${requirement.aiGenerationRoute}`,
      `export:${requirement.exportRoute}`,
    ].join(" · "),
    adapters: [...requirement.adapters],
    sourceLabels: sources.map((source) => source.label),
    boundary:
      requirement.status === "licensed_adapter_required"
        ? "licensed_adapter_required"
        : requirement.status === "adapter_required"
          ? "worker_sidecar_or_service_required"
          : "runtime_available_with_audit",
    completeUseMandate:
      "OpenEngineeringEditor 必须完整覆盖该格式的在线编辑、AI 生成、导入、导出、审计和 blocked/failed 证据；许可证只决定隔离边界。",
  };
}

export function buildOpenEngineeringEditorPanAICapabilities(
  file?: Pick<ModuleFileNode, "name" | "moduleId" | "mimeType">,
): PanAIWorkbenchCapability[] {
  const moduleId = file?.moduleId ?? "digital_twin";
  const capabilityMap = buildEngineeringEditorCapabilityMap(file);
  const baseCapabilities = buildPanAIWorkbenchCapabilities(moduleId);

  return [
    {
      id: "panai:open-engineering-editor",
      kind: "cad",
      label: "工程编辑器接管",
      description:
        "PanAI 接管 OpenEngineeringEditor 的源文件、格式 adapter、在线编辑、AI 生成、worker、审计和审批链。",
      command: `PanAI 接管 ${file?.name ?? "当前工程文件"} 的完整工程编辑能力`,
      moduleId,
    },
    {
      id: "panai:online-edit",
      kind: "operation",
      label: "在线编辑",
      description: `通过 ${capabilityMap.boundary} 执行源文件绑定在线编辑，不因许可证或授权形态跳过能力。`,
      command: `在线编辑 ${file?.name ?? "当前工程文件"}，保留源文件、版本、规则和审批证据`,
      moduleId,
    },
    {
      id: "panai:ai-generate-engineering",
      kind: "cad",
      label: "AI 工程生成",
      description:
        "通过 Planner、Generator、Evaluator、RuleChecker、SchemaValidator、Approver 和真实 worker 生成工程草案或 artifact。",
      command: `基于 ${file?.name ?? "当前工程文件"} 发起 AI 工程生成`,
      moduleId,
    },
    ...baseCapabilities,
  ];
}

export function resolveOpenEngineeringEditorLocalFileId(
  file: ModuleFileNode | undefined,
  sourceUrl: string | undefined,
): string | null {
  if (file?.localFileId) return file.localFileId;
  if (file?.localFile?.fileId) return file.localFile.fileId;

  if (sourceUrl) {
    const match = sourceUrl.match(/\/api\/local-files\/([^/?#]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  return file?.id ?? null;
}

function isThreeDmIfcDerivativeUrl(sourceUrl: string): boolean {
  return /\/3dm-derivative(?:\?|$)/.test(sourceUrl);
}

function EngineeringCommandActions({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
}) {
  return (
    <>
      <EngineeringCommandButton
        label="放大"
        title="放大当前模型视图"
        onClick={onZoomIn ?? (() => dispatchModelViewportCommand("zoomIn"))}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton
        label="缩小"
        title="缩小当前模型视图"
        onClick={onZoomOut ?? (() => dispatchModelViewportCommand("zoomOut"))}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
    </>
  );
}

function dispatchModelViewportCommand(command: ModelViewportCommand) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(modelViewportCommandEvent, { detail: { command } }),
  );
}

function focusEngineeringInteractiveViewport() {
  if (typeof document === "undefined") return;
  const viewport = document.querySelector<HTMLElement>(
    "[data-engineering-interactive-viewport]",
  );
  viewport?.focus();
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
    {
      action: "up",
      label: "上",
      title: "沿上轴移动",
      className: "col-start-2",
    },
    {
      action: "front",
      label: "前",
      title: "沿前轴移动",
      className: "col-start-4",
    },
    {
      action: "left",
      label: "左",
      title: "沿左轴移动",
      className: "col-start-1 row-start-2",
    },
    {
      action: "reset",
      label: "中",
      title: "重置六轴位置",
      className: "col-start-2 row-start-2",
    },
    {
      action: "right",
      label: "右",
      title: "沿右轴移动",
      className: "col-start-3 row-start-2",
    },
    {
      action: "back",
      label: "后",
      title: "沿后轴移动",
      className: "col-start-4 row-start-2",
    },
    {
      action: "down",
      label: "下",
      title: "沿下轴移动",
      className: "col-start-2 row-start-3",
    },
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
          {button.action === "reset" ? (
            <Crosshair className="h-3.5 w-3.5" />
          ) : (
            button.label
          )}
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

function applyModelAxisAction(
  action: ModelAxisAction,
  setViewTransform: Dispatch<SetStateAction<ViewTransform>>,
  step = 4,
) {
  setViewTransform((current) => {
    if (action === "reset") return defaultViewTransform;
    if (action === "left")
      return { ...current, offsetX: current.offsetX - step };
    if (action === "right")
      return { ...current, offsetX: current.offsetX + step };
    if (action === "up") return { ...current, offsetZ: current.offsetZ + step };
    if (action === "down")
      return { ...current, offsetZ: current.offsetZ - step };
    if (action === "front")
      return { ...current, offsetY: current.offsetY - step };
    return { ...current, offsetY: current.offsetY + step };
  });
}

const promotedEngineeringPropertyKeys = [
  "componentId",
  "dimensions",
  "name",
  "objectType",
];
const actionPropertyKeys = new Set(["uploadTemplate", "exportList"]);

function splitEngineeringPropertyRows(rows: IfcPropertyRow[]): {
  promoted: IfcPropertyRow[];
  details: IfcPropertyRow[];
} {
  const uniqueRows = uniquePropertyRows(rows).filter(
    (row) => !actionPropertyKeys.has(row.key),
  );
  const promoted = promotedEngineeringPropertyKeys
    .map((key) => uniqueRows.find((row) => row.key === key))
    .filter((row): row is IfcPropertyRow => Boolean(row));
  const promotedKeys = new Set(promoted.map((row) => row.key));
  const details = uniqueRows.filter((row) => !promotedKeys.has(row.key));
  return { promoted, details };
}

function uniquePropertyRows(rows: IfcPropertyRow[]): IfcPropertyRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const fingerprint = `${row.key}:${row.label}`.toLowerCase();
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function EngineeringPropertySummaryGrid({ rows }: { rows: IfcPropertyRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {rows.map((row) => (
        <div
          key={row.key}
          className="viewer-floating-field rounded px-2 py-1.5"
        >
          <p className="text-[9px] font-medium text-slate-300">{row.label}</p>
          <p className="mt-0.5 break-words text-[11px] font-medium leading-4 text-slate-50">
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ViewerMetricDiagnostics({ metrics }: { metrics: ViewerMetric[] }) {
  if (!metrics.length) return null;
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-[9px] font-medium uppercase tracking-normal text-slate-400">
        查看器诊断
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
    </div>
  );
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
  const [draftState, setDraftState] = useState<{
    context: string;
    values: Record<string, string>;
    savedAt: string | null;
  }>({ context: "", values: {}, savedAt: null });
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
      value: "PanAEC Engine 模型 / 派生结果",
    },
    {
      key: "material",
      label: "材质信息",
      value: "源文件材质/颜色优先，缺失时使用可视化默认色",
    },
    ...engineeringViewerCapabilityRowsForFileName(file.name, file.mimeType),
  ];
  const primaryRows = selectedRows?.length ? selectedRows : rows;
  const propertySections = splitEngineeringPropertyRows(primaryRows);
  const editableRowsCount = primaryRows.filter((row) => row.editable).length;
  const draftContext = `${file.id}:${selectedTitle ?? "file"}`;
  const draftValues =
    draftState.context === draftContext ? draftState.values : {};
  const draftSavedAt =
    draftState.context === draftContext ? draftState.savedAt : null;

  return (
    <div className="h-full overflow-auto p-3 text-[11px] text-slate-100">
      <p className="text-[10px] font-medium uppercase text-emerald-300">
        Element properties
      </p>
      <h3 className="mt-1 text-sm font-medium">
        {selectedTitle || "构件 / 文件属性"}
      </h3>
      <div className="mt-2 grid grid-cols-3 gap-1">
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
        <button
          type="button"
          onClick={() =>
            setDraftState({
              context: draftContext,
              values: draftValues,
              savedAt: new Date().toLocaleTimeString("zh-CN", {
                hour12: false,
              }),
            })
          }
          disabled={editableRowsCount === 0}
          className="viewer-ghost-tool inline-flex h-7 items-center justify-center gap-1 rounded px-1 text-[10px] font-medium"
          title="记录当前属性编辑草案，源文件写回需走保存版本和审批"
        >
          <Save className="h-3.5 w-3.5" />
          草案
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
      {draftSavedAt ? (
        <p className="mt-1 truncate text-[10px] text-emerald-300">
          编辑草案已记录：{draftSavedAt} · 写回源文件需保存版本并审批
        </p>
      ) : null}
      <EngineeringPropertySummaryGrid rows={propertySections.promoted} />
      <div className="mt-3 space-y-2">
        {propertySections.details.map((row) => (
          <label key={row.key} className="block rounded-md bg-slate-950/20 p-2">
            <span className="block text-[10px] text-slate-400">
              {row.label}
            </span>
            {row.editable ? (
              <input
                type="text"
                value={draftValues[row.key] ?? row.value}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraftState((current) => {
                    const currentValues =
                      current.context === draftContext ? current.values : {};
                    return {
                      context: draftContext,
                      values: { ...currentValues, [row.key]: nextValue },
                      savedAt: null,
                    };
                  });
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-100 outline-none focus:border-emerald-400"
              />
            ) : (
              <span className="mt-1 block break-words font-medium text-slate-100">
                {row.value}
              </span>
            )}
          </label>
        ))}
      </div>
      <ViewerMetricDiagnostics metrics={metrics} />
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
  const [editOpen, setEditOpen] = useState(false);
  const [webGpuPrompt, setWebGpuPrompt] = useState<{
    open: boolean;
    reason: string;
  }>({ open: false, reason: "" });
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(
    null,
  );
  const [state, setState] = useState<LoadState<IfcLiteNativePreview>>({
    status: "loading",
    message: "正在启动 PanAEC Engine 原生查看器...",
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
        message: "正在启动 PanAEC Engine 原生查看器...",
      });
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error("PanAEC Engine 画布未挂载。");
        }
        const gpuNavigator = navigator as Navigator & { gpu?: unknown };
        if (!gpuNavigator.gpu) {
          if (!cancelled && shouldShowWebGpuEnableDialog()) {
            setWebGpuPrompt({
              open: true,
              reason:
                "当前浏览器没有暴露 navigator.gpu，PanAEC Engine GPU 查看器无法启动。",
            });
          }
          const fallback = await loadIfcLiteThreePreview({
            fileSize: file.size,
            sourceUrl,
            generatedThreeDmDerivative: isThreeDmIfcDerivativeUrl(sourceUrl),
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
          generatedThreeDmDerivative: isThreeDmIfcDerivativeUrl(sourceUrl),
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
            generatedThreeDmDerivative: isThreeDmIfcDerivativeUrl(sourceUrl),
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

  function zoomIfcView(direction: "in" | "out") {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) {
      dispatchModelViewportCommand(direction === "in" ? "zoomIn" : "zoomOut");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    renderer
      .getCamera()
      .zoom(
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
    preview.elements.find(
      (element) => element.expressID === selectedExpressID,
    ) ?? null;
  const ifcLocalFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const route = `${panaecLabel} · IFC 原生源文件`;
  const metrics: ViewerMetric[] = [
    { label: "格式", value: ".ifc" },
    { label: "引擎", value: panaecLabel },
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
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={route}
      toolbarActions={
        ifcLocalFileId ? (
          <>
            {selectedElement?.globalId ? (
              <EngineeringWorkbenchIconButton
                label="编辑构件属性"
                title="真实写回:ifcopenshell 原子编辑(版本递增 + 审计)"
                onClick={() => setEditOpen((value) => !value)}
              >
                <PencilLine className="h-3.5 w-3.5" />
              </EngineeringWorkbenchIconButton>
            ) : null}
            <IfcBomExportToolbarActions localFileId={ifcLocalFileId} />
          </>
        ) : undefined
      }
      outlineNodes={buildIfcWorkbenchOutline(file, preview, metrics)}
      onSelectOutlineNode={(node) => {
        const expressID = ifcExpressIdFromTreeNode(node.id);
        if (expressID !== null) setSelectedExpressID(expressID);
      }}
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
      onZoomIn={() => zoomIfcView("in")}
      onZoomOut={() => zoomIfcView("out")}
      enabledTools={
        preview.mode === "three" && preview.group
          ? commonThreeViewportWorkbenchTools
          : ["select"]
      }
    >
      <section
        data-engineering-interactive-viewport
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
            status={`${panaecLabel} 兼容查看`}
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
              aria-label={`${file.name} ${panaecLabel} viewer`}
              onContextMenu={(event) => event.preventDefault()}
            />
            <ModelCoordinateAxisLegend />
          </>
        )}
        {editOpen && selectedElement?.globalId && ifcLocalFileId ? (
          <IfcElementEditOverlay
            key={`${selectedElement.expressID}`}
            localFileId={ifcLocalFileId}
            element={selectedElement}
            onClose={() => setEditOpen(false)}
          />
        ) : null}
        {state.status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/35">
            <div className="viewer-floating-panel w-full max-w-xs rounded-md p-4 text-center text-slate-100">
              <ArchLoadingFlow label={state.message} size="panel" />
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
            <p className="mt-2 text-sm leading-6 text-slate-300">{reason}</p>
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
              打开{" "}
              <span className="font-mono text-emerald-300">
                chrome://settings/system
              </span>
              ， 开启“使用图形加速”后重启浏览器。
            </li>
            <li>
              打开{" "}
              <span className="font-mono text-emerald-300">chrome://gpu</span>，
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
            PanAEC Engine 兼容模式，不自动触发 OpenUSD / 3D Tiles / GLB 兜底派生。
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
  generatedThreeDmDerivative,
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
  generatedThreeDmDerivative?: boolean;
  selectedRef: { current: number | null };
  streamingRef: { current: boolean };
  onReady: (renderer: IfcLiteRendererHandle) => void;
  onProgress: (message: string) => void;
  onPreview: (preview: IfcLiteNativePreview) => void;
  isCancelled: () => boolean;
}): Promise<IfcLiteNativePreview> {
  onProgress("正在加载 PanAEC Engine 模型查看器...");
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

  onProgress("正在流式解析 PanAEC Engine 几何...");
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
        const element = updateIfcLiteElementMetadata(elementIndex, mesh, {
          generatedThreeDmDerivative: generatedThreeDmDerivative === true,
        });
        includeIfcLiteElementMeshStats(element, mesh);
        includeIfcLiteMeshBounds(elementBounds, elementIndex, mesh, lengthUnit);
        renderMeshes.push(
          ifcLiteMeshForProjectDisplay(
            ifcLiteMeshWithResolvedColor(mesh, element, {
              generatedThreeDmDerivative: generatedThreeDmDerivative === true,
            }),
            lengthUnit,
          ),
        );
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
      onProgress(`PanAEC Engine 正在处理 ${event.phase}...`);
    }
  }

  return preview;
}

async function loadIfcLiteThreePreview({
  fileSize,
  sourceUrl,
  generatedThreeDmDerivative,
  onProgress,
  onPreview,
  isCancelled,
}: {
  fileSize: number;
  sourceUrl: string;
  generatedThreeDmDerivative?: boolean;
  onProgress: (message: string) => void;
  onPreview: (preview: IfcLiteNativePreview) => void;
  isCancelled: () => boolean;
}): Promise<IfcLiteNativePreview> {
  onProgress("正在加载 PanAEC Engine 几何解析器...");
  const { GeometryProcessor } =
    (await import("@ifc-lite/geometry")) as IfcLiteGeometryModule;
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
  group.name = "PanAEC Engine native IFC";
  group.userData = {
    sourceFormat: ".ifc",
    routeLabel: `${panaecLabel} · IFC 原生源文件`,
    worldUnitsToMillimeters: lengthDisplayUnitToMillimeters(lengthUnit),
    loaderNormalizedUpAxis: "y",
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

  onProgress("正在用 PanAEC Engine 流式解析几何...");
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
        const element = updateIfcLiteElementMetadata(elementIndex, mesh, {
          generatedThreeDmDerivative: generatedThreeDmDerivative === true,
        });
        includeIfcLiteElementMeshStats(element, mesh);
        includeIfcLiteMeshBounds(elementBounds, elementIndex, mesh, lengthUnit);
        const object = buildIfcLiteThreeMesh(mesh, element, lengthUnit, {
          generatedThreeDmDerivative: generatedThreeDmDerivative === true,
        });
        if (!object) continue;
        group.add(object);
        preview.totalVertices += Math.floor(mesh.positions.length / 3);
        preview.totalTriangles += Math.floor(mesh.indices.length / 3);
      }
      preview.loadedMeshes = event.totalSoFar;
      preview.elements = sortedIfcLiteElements(elementIndex);
      if (group.children.length > 0) {
        normalizeThreeGroupReferencePlane(group, "y");
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
        normalizeThreeGroupReferencePlane(group, "y");
      }
      onPreview({ ...preview });
      continue;
    }

    if (event.type === "progress") {
      onProgress(`PanAEC Engine 正在处理 ${event.phase}...`);
    }
  }

  return preview;
}

function normalizeThreeGroupReferencePlane(
  group: Group,
  preferredUpAxis?: ModelUpAxis,
): ModelUpAxis {
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  const nativeBounds = new Box3().setFromObject(group);
  const upAxis = preferredUpAxis ?? inferIfcUpAxis(nativeBounds);
  group.userData.upAxis = upAxis;

  if (nativeBounds.isEmpty()) {
    return upAxis;
  }

  const center = nativeBounds.getCenter(new Vector3());
  const viewTarget =
    upAxis === "y"
      ? new Vector3(center.x, nativeBounds.min.y, center.z)
      : new Vector3(center.x, center.y, nativeBounds.min.z);
  group.userData.nativeBounds = nativeBounds.clone();
  group.userData.viewTarget = viewTarget.clone();
  group.userData.sourceOriginPreserved = true;
  group.userData.renderOffset = new Vector3(0, 0, 0);
  return upAxis;
}

function groupModelUpAxis(group: Group | null): ModelUpAxis {
  return group?.userData.upAxis === "y" ? "y" : "z";
}

function buildIfcLiteThreeMesh(
  mesh: IfcLiteStreamingBatch,
  element?: IfcElementProperties,
  lengthUnit: LengthDisplayUnit = meterLengthUnit,
  options: { generatedThreeDmDerivative?: boolean } = {},
): Mesh | null {
  if (mesh.positions.length < 9 || mesh.indices.length < 3) return null;
  const displayMesh = ifcLiteMeshForProjectDisplay(mesh, lengthUnit);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(displayMesh.positions, 3),
  );
  if (
    displayMesh.normals &&
    displayMesh.normals.length === displayMesh.positions.length
  ) {
    geometry.setAttribute(
      "normal",
      new Float32BufferAttribute(displayMesh.normals, 3),
    );
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(new BufferAttribute(displayMesh.indices, 1));
  if (
    displayMesh.entityIds &&
    displayMesh.entityIds.length === displayMesh.positions.length / 3
  ) {
    geometry.setAttribute(
      "expressID",
      new BufferAttribute(displayMesh.entityIds, 1),
    );
  }
  geometry.computeBoundingBox();
  const localProjectBounds = geometry.boundingBox
    ? boxToSerializableBounds(geometry.boundingBox)
    : undefined;
  const sourceNativeBounds = element?.geometryBounds ?? localProjectBounds;

  const color = resolveIfcElementDisplayColor(element, mesh.color, {
    generatedThreeDmDerivative: options.generatedThreeDmDerivative === true,
    expressID: mesh.expressId,
  }).color;
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
    boundsCenter(sourceNativeBounds ?? null);
  object.userData = {
    expressID: mesh.expressId,
    ifcType: type,
    componentId: element?.globalId || `IFC-${mesh.expressId}`,
    objectType: element?.objectType || type,
    sourceName: object.name,
    sourceFormat: ".ifc",
    routeLabel: `${panaecLabel} · IFC 原生源文件`,
    materialSource:
      element?.displayColorSource ??
      "openBIM 未声明 IfcStyledItem / IfcSurfaceStyle 表现样式",
    baseColor: [color[0], color[1], color[2]],
    sourceProperties: element?.properties ?? [],
    ...(sourceNativeBounds
      ? {
          nativeBounds: sourceNativeBounds,
          ...(sourceDimensions
            ? { dimensionsMm: sourceDimensions }
            : { dimensionsMm: boundsDimensions(sourceNativeBounds) }),
          ...(sourceDimensionCenter
            ? { nativeCenterMm: sourceDimensionCenter }
            : {}),
        }
      : {}),
  };
  return object;
}

function ifcLiteMeshWithResolvedColor(
  mesh: IfcLiteStreamingBatch,
  element: IfcElementProperties | undefined,
  options: { generatedThreeDmDerivative?: boolean } = {},
): IfcLiteStreamingBatch {
  const display = resolveIfcElementDisplayColor(element, mesh.color, {
    generatedThreeDmDerivative: options.generatedThreeDmDerivative === true,
    expressID: mesh.expressId,
  });
  return {
    ...mesh,
    color: [
      display.color[0],
      display.color[1],
      display.color[2],
      display.color[3],
    ],
  };
}

export function ifcLiteMeshForProjectDisplay(
  mesh: IfcLiteStreamingBatch,
  lengthUnit: LengthDisplayUnit,
): IfcLiteStreamingBatch {
  const scale = ifcLiteProjectDisplayScale(lengthUnit);
  const positions = new Float32Array(mesh.positions.length);
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const x = (mesh.positions[index] ?? 0) * scale;
    const y = (mesh.positions[index + 1] ?? 0) * scale;
    const z = (mesh.positions[index + 2] ?? 0) * scale;
    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
  }

  const normals =
    mesh.normals && mesh.normals.length === mesh.positions.length
      ? new Float32Array(mesh.normals.length)
      : undefined;
  if (normals && mesh.normals) {
    for (let index = 0; index < mesh.normals.length; index += 3) {
      const x = mesh.normals[index] ?? 0;
      const y = mesh.normals[index + 1] ?? 0;
      const z = mesh.normals[index + 2] ?? 0;
      normals[index] = x;
      normals[index + 1] = y;
      normals[index + 2] = z;
    }
  }

  return {
    ...mesh,
    positions,
    ...(normals ? { normals } : {}),
  };
}

function ifcLiteProjectDisplayScale(unit: LengthDisplayUnit): number {
  const metersPerUnit =
    Number.isFinite(unit.metersPerUnit) && unit.metersPerUnit > 0
      ? unit.metersPerUnit
      : 1;
  return 1 / metersPerUnit;
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

const unassignedOpenBimAppearanceDisplayColor: [
  number,
  number,
  number,
  number,
] = [0.78, 0.8, 0.82, 1];

export function resolveIfcElementDisplayColor(
  element: IfcElementProperties | undefined,
  _sourceColor: [number, number, number, number] | undefined,
  options: {
    generatedThreeDmDerivative?: boolean;
    expressID?: number;
  } = {},
): {
  color: [number, number, number, number];
  source: "ifc-style" | "openbim-unassigned-appearance";
} {
  void options;
  if (element?.styleColor) {
    const color = normalizeIfcLiteColor(element.styleColor);
    element.displayColor = color;
    element.displayColorSource =
      element.styleColorSource ??
      "openBIM IFC IfcStyledItem / IfcSurfaceStyle 源表现样式";
    return { color, source: "ifc-style" };
  }

  const fallback = unassignedOpenBimAppearanceDisplayColor;
  if (element) {
    element.displayColor = fallback;
    element.displayColorSource =
      "openBIM 未声明 IfcStyledItem / IfcSurfaceStyle 表现样式；占位显示，不代表材料颜色";
    element.sourceColor =
      "未分配 openBIM 表现样式（IFC 未声明 IfcStyledItem / IfcSurfaceStyle）";
  }
  return { color: fallback, source: "openbim-unassigned-appearance" };
}

function reliableIfcElementDimensions(
  element: IfcElementProperties | undefined,
): Bounds3DPoint | null {
  if (!element?.geometryDimensions) return null;
  const sources = Object.values(element.geometryDimensionSource ?? {});
  const hasIfcSource = sources.some(
    (source) => source === "ifc-representation" || source === "ifc-quantity",
  );
  return hasIfcSource ? element.geometryDimensions : null;
}

function displayIfcElementDimensions(
  element: IfcElementProperties | undefined,
): Bounds3DPoint | null {
  return (
    reliableIfcElementDimensions(element) ??
    element?.geometryDimensions ??
    boundsDimensions(element?.geometryBounds ?? null)
  );
}

function displayIfcElementCenter(
  element: IfcElementProperties | undefined,
): Bounds3DPoint | null {
  return (
    element?.sourcePlacement ??
    element?.geometryCenter ??
    boundsCenter(element?.geometryBounds ?? null)
  );
}

function isIfcLiteBatchEvent(event: IfcLiteStreamingEvent): event is {
  type: "batch";
  meshes: IfcLiteStreamingBatch[];
  totalSoFar: number;
} {
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
    const name = readableEngineeringText(ifcStepParamText(params[2]));
    const objectType = readableEngineeringText(ifcStepParamText(params[4]));
    const tag = readableEngineeringText(ifcStepParamText(params[7]));
    const predefinedType = readableEngineeringText(ifcStepParamText(params[8]));
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
    const sourcePlacement = resolveIfcObjectPlacement(
      records,
      record.params[5],
    );
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
    const dimensions = ifcDimensionsFromRepresentation(
      records,
      record.params[6],
    );
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
    element.styleColorSource =
      "openBIM IFC IfcStyledItem / IfcSurfaceStyle 几何表现样式";
    element.sourceColor = `IfcStyledItem / IfcSurfaceStyle: ${formatRgbColor([color[0], color[1], color[2]])} / alpha ${formatCoord(color[3])}`;
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
      const color = ifcColorFromStyleAssignment(
        records,
        record.params[0],
        visited,
      );
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
  const ids = typeof value === "number" ? [value] : ifcStepReferenceIds(value);
  const itemIds: number[] = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    itemIds.push(id);
    const record = records.get(id);
    if (!record) continue;
    record.params.forEach((param) => {
      itemIds.push(...collectIfcRepresentationItemIds(records, param, visited));
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
  const ids = typeof value === "number" ? [value] : ifcStepReferenceIds(value);
  const measures: number[] = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const record = records.get(id);
    if (!record) continue;

    switch (record.type) {
      case "IFCPRODUCTDEFINITIONSHAPE":
        measures.push(
          ...collectIfcRepresentationMeasures(
            records,
            record.params[2],
            visited,
          ),
        );
        break;
      case "IFCSHAPEREPRESENTATION":
        measures.push(
          ...collectIfcRepresentationMeasures(
            records,
            record.params[3],
            visited,
          ),
        );
        break;
      case "IFCREPRESENTATIONMAP":
        measures.push(
          ...collectIfcRepresentationMeasures(
            records,
            record.params[1],
            visited,
          ),
        );
        break;
      case "IFCMAPPEDITEM":
        measures.push(
          ...collectIfcRepresentationMeasures(
            records,
            record.params[0],
            visited,
          ),
        );
        break;
      case "IFCEXTRUDEDAREASOLID":
        pushIfcMeasure(measures, ifcStepNumericValue(record.params[3]));
        measures.push(
          ...collectIfcRepresentationMeasures(
            records,
            record.params[0],
            visited,
          ),
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
        applyIfcPropertyRecord(property, element, propertySetName, lengthUnit);
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
  const value = ifcStepValueText(
    rawValue,
    lengthUnit,
    isIfcLengthRecord(record),
  );
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
          applyIfcPropertyRecord(
            property,
            element,
            propertySetName,
            lengthUnit,
          );
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
  const materialStyleColors = collectIfcMaterialDefinitionStyleColors(records);
  for (const relationship of records.values()) {
    if (relationship.type !== "IFCRELASSOCIATESMATERIAL") continue;
    const relatedObjectIds = ifcStepReferenceIds(relationship.params[4]);
    const materialId = ifcStepReferenceIds(relationship.params[5])[0];
    if (!materialId || !relatedObjectIds.length) continue;
    const material = resolveIfcMaterial(records, materialId, lengthUnit);
    if (!material) continue;
    const materialStyleColor = resolveIfcMaterialStyleColor(
      records,
      materialId,
      materialStyleColors,
    );

    relatedObjectIds.forEach((relatedObjectId) => {
      const occurrenceIds = elements.has(relatedObjectId)
        ? [relatedObjectId]
        : (occurrencesByType.get(relatedObjectId) ?? []);
      occurrenceIds.forEach((occurrenceId) => {
        const element = elements.get(occurrenceId);
        if (!element) return;
        pushUniqueIfcProperty(element, "Material", material.name);
        material.details.forEach((detail, index) => {
          pushUniqueIfcProperty(element, `Material.${index + 1}`, detail);
        });
        if (materialStyleColor && !element.styleColor) {
          element.styleColor = materialStyleColor;
          element.styleColorSource =
            "openBIM IFC IfcMaterialDefinitionRepresentation / IfcSurfaceStyle 材质表现样式";
          element.sourceColor = `IfcMaterialDefinitionRepresentation / IfcSurfaceStyle: ${formatRgbColor([materialStyleColor[0], materialStyleColor[1], materialStyleColor[2]])} / alpha ${formatCoord(materialStyleColor[3])}`;
        }
      });
    });
  }
}

function collectIfcMaterialDefinitionStyleColors(
  records: Map<number, IfcStepRecord>,
): Map<number, [number, number, number, number]> {
  const colors = new Map<number, [number, number, number, number]>();
  for (const record of records.values()) {
    if (record.type !== "IFCMATERIALDEFINITIONREPRESENTATION") continue;
    const materialIds = ifcStepReferenceIds(record.params[3]);
    if (!materialIds.length) continue;
    const color = ifcColorFromStyleAssignment(records, record.params[2]);
    if (!color) continue;
    materialIds.forEach((materialId) => {
      colors.set(materialId, color);
    });
  }
  return colors;
}

function resolveIfcMaterialStyleColor(
  records: Map<number, IfcStepRecord>,
  materialRef: string | number | undefined,
  colors: Map<number, [number, number, number, number]>,
  visited = new Set<number>(),
): [number, number, number, number] | null {
  const materialId =
    typeof materialRef === "number"
      ? materialRef
      : ifcStepReferenceIds(materialRef)[0];
  if (!materialId || visited.has(materialId)) return null;
  const direct = colors.get(materialId);
  if (direct) return direct;
  visited.add(materialId);
  const record = records.get(materialId);
  if (!record) return null;

  for (const param of record.params) {
    for (const nestedId of ifcStepReferenceIds(param)) {
      const nested = resolveIfcMaterialStyleColor(
        records,
        nestedId,
        colors,
        visited,
      );
      if (nested) return nested;
    }
  }
  return null;
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
      const material = resolveIfcMaterial(
        records,
        record.params[0],
        lengthUnit,
        visited,
      );
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
        .map((layerId) =>
          resolveIfcMaterial(records, layerId, lengthUnit, visited),
        )
        .filter((layer): layer is IfcMaterialResolution => Boolean(layer));
      const details = layers.flatMap((layer) => [layer.name, ...layer.details]);
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
        .filter((material): material is IfcMaterialResolution =>
          Boolean(material),
        );
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
        .find((material): material is IfcMaterialResolution =>
          Boolean(material),
        );
      const name = ownName || nested?.name;
      return name ? { name, details: nested?.details ?? [] } : null;
    }
    case "IFCMATERIALPROFILESET":
    case "IFCMATERIALCONSTITUENTSET": {
      const setName = meaningfulIfcLabel(record.params[0]);
      const nestedMaterials = record.params
        .flatMap((param) => ifcStepReferenceIds(param))
        .map((id) => resolveIfcMaterial(records, id, lengthUnit, visited))
        .filter((material): material is IfcMaterialResolution =>
          Boolean(material),
        );
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

function materialResolutionFromName(
  name: string,
): IfcMaterialResolution | null {
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
  return (
    resolveIfcObjectPlacementTransform(records, placementRef, visited)
      ?.origin ?? null
  );
}

function resolveIfcObjectPlacementTransform(
  records: Map<number, IfcStepRecord>,
  placementRef: string | undefined,
  visited = new Set<number>(),
): IfcPlacementTransform | null {
  const placementId = ifcStepReferenceIds(placementRef)[0];
  if (!placementId || visited.has(placementId)) return null;
  visited.add(placementId);
  const placement = records.get(placementId);
  if (!placement) return null;

  if (placement.type !== "IFCLOCALPLACEMENT") {
    return resolveIfcAxisPlacementTransform(records, `#${placementId}`);
  }

  const parent = resolveIfcObjectPlacementTransform(
    records,
    placement.params[0],
    visited,
  );
  const relative = resolveIfcAxisPlacementTransform(
    records,
    placement.params[1],
  );

  if (parent && relative) return composeIfcPlacementTransform(parent, relative);
  return relative ?? parent;
}

function resolveIfcAxisPlacementTransform(
  records: Map<number, IfcStepRecord>,
  axisPlacementRef: string | undefined,
): IfcPlacementTransform | null {
  const axisPlacementId = ifcStepReferenceIds(axisPlacementRef)[0];
  if (!axisPlacementId) return null;
  const axisPlacement = records.get(axisPlacementId);
  if (!axisPlacement) return null;

  if (axisPlacement.type === "IFCAXIS2PLACEMENT3D") {
    const origin = resolveIfcCartesianPoint(records, axisPlacement.params[0]);
    if (!origin) return null;
    const zAxis = resolveIfcDirection(records, axisPlacement.params[1], {
      x: 0,
      y: 0,
      z: 1,
    });
    const rawXAxis = resolveIfcDirection(records, axisPlacement.params[2], {
      x: 1,
      y: 0,
      z: 0,
    });
    const xAxis = orthogonalIfcXAxis(rawXAxis, zAxis);
    const yAxis = normalizeIfcVector(crossIfcVector(zAxis, xAxis), {
      x: 0,
      y: 1,
      z: 0,
    });
    return { origin, xAxis, yAxis, zAxis };
  }

  if (axisPlacement.type === "IFCAXIS2PLACEMENT2D") {
    const origin = resolveIfcCartesianPoint(records, axisPlacement.params[0]);
    if (!origin) return null;
    const xAxis = resolveIfcDirection(records, axisPlacement.params[1], {
      x: 1,
      y: 0,
      z: 0,
    });
    const yAxis = normalizeIfcVector(
      { x: -xAxis.y, y: xAxis.x, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    return {
      origin,
      xAxis: normalizeIfcVector(
        { x: xAxis.x, y: xAxis.y, z: 0 },
        { x: 1, y: 0, z: 0 },
      ),
      yAxis,
      zAxis: { x: 0, y: 0, z: 1 },
    };
  }

  return null;
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

function resolveIfcDirection(
  records: Map<number, IfcStepRecord>,
  directionRef: string | undefined,
  fallback: Bounds3DPoint,
): Bounds3DPoint {
  const directionId = ifcStepReferenceIds(directionRef)[0];
  if (!directionId) return fallback;
  const direction = records.get(directionId);
  if (direction?.type !== "IFCDIRECTION") return fallback;
  const ratios = ifcStepNumericList(direction.params[0]);
  return normalizeIfcVector(
    {
      x: ratios[0] ?? fallback.x,
      y: ratios[1] ?? fallback.y,
      z: ratios[2] ?? fallback.z,
    },
    fallback,
  );
}

function orthogonalIfcXAxis(
  rawXAxis: Bounds3DPoint,
  zAxis: Bounds3DPoint,
): Bounds3DPoint {
  const projected = subtractIfcVector(
    rawXAxis,
    scaleIfcVector(zAxis, dotIfcVector(rawXAxis, zAxis)),
  );
  if (ifcVectorLength(projected) > 1e-9) {
    return normalizeIfcVector(projected, { x: 1, y: 0, z: 0 });
  }
  const fallback =
    Math.abs(zAxis.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  return normalizeIfcVector(crossIfcVector(fallback, zAxis), {
    x: 1,
    y: 0,
    z: 0,
  });
}

function composeIfcPlacementTransform(
  parent: IfcPlacementTransform,
  relative: IfcPlacementTransform,
): IfcPlacementTransform {
  return {
    origin: applyIfcPlacementPoint(parent, relative.origin),
    xAxis: applyIfcPlacementDirection(parent, relative.xAxis),
    yAxis: applyIfcPlacementDirection(parent, relative.yAxis),
    zAxis: applyIfcPlacementDirection(parent, relative.zAxis),
  };
}

function applyIfcPlacementPoint(
  transform: IfcPlacementTransform,
  point: Bounds3DPoint,
): Bounds3DPoint {
  const local = applyIfcPlacementDirection(transform, point, false);
  return {
    x: transform.origin.x + local.x,
    y: transform.origin.y + local.y,
    z: transform.origin.z + local.z,
  };
}

function applyIfcPlacementDirection(
  transform: IfcPlacementTransform,
  direction: Bounds3DPoint,
  normalize = true,
): Bounds3DPoint {
  const value = {
    x:
      transform.xAxis.x * direction.x +
      transform.yAxis.x * direction.y +
      transform.zAxis.x * direction.z,
    y:
      transform.xAxis.y * direction.x +
      transform.yAxis.y * direction.y +
      transform.zAxis.y * direction.z,
    z:
      transform.xAxis.z * direction.x +
      transform.yAxis.z * direction.y +
      transform.zAxis.z * direction.z,
  };
  return normalize ? normalizeIfcVector(value, direction) : value;
}

function normalizeIfcVector(
  vector: Bounds3DPoint,
  fallback: Bounds3DPoint,
): Bounds3DPoint {
  const length = ifcVectorLength(vector);
  if (!Number.isFinite(length) || length < 1e-9) return fallback;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function ifcVectorLength(vector: Bounds3DPoint): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function dotIfcVector(left: Bounds3DPoint, right: Bounds3DPoint): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function crossIfcVector(
  left: Bounds3DPoint,
  right: Bounds3DPoint,
): Bounds3DPoint {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function subtractIfcVector(
  left: Bounds3DPoint,
  right: Bounds3DPoint,
): Bounds3DPoint {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

function scaleIfcVector(vector: Bounds3DPoint, scale: number): Bounds3DPoint {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}

function ifcStepNumericList(value: string | undefined): number[] {
  if (!value) return [];
  return Array.from(value.matchAll(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/g))
    .map((match) => Number.parseFloat(match[0]))
    .filter((number) => Number.isFinite(number));
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
  if (numeric !== null)
    return isLength ? formatLength(numeric, unit) : `${numeric}`;
  return ifcStepParamText(trimmed);
}

function classifyIfcDimensionLabel(
  value: string,
): keyof Bounds3DPoint | "thickness" | null {
  const normalized = value.toLowerCase().replace(/[\s_().:-]+/g, "");
  if (
    /overalllength|nominallength|grosslength|length|xdim|xsize|x尺寸|长度|长/.test(
      normalized,
    )
  ) {
    return "x";
  }
  if (
    /overallwidth|nominalwidth|grosswidth|width|ydim|ysize|y尺寸|宽度|宽/.test(
      normalized,
    )
  ) {
    return "y";
  }
  if (
    /overallheight|nominalheight|grossheight|height|zdim|zsize|z尺寸|高度|高/.test(
      normalized,
    )
  ) {
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
  options: { generatedThreeDmDerivative?: boolean } = {},
): IfcElementProperties {
  const type = mesh.ifcType ?? "IFCENTITY";
  const element = ensureIfcLiteElement(elements, mesh.expressId, type);
  if (!element.styleColor) {
    const display = resolveIfcElementDisplayColor(element, mesh.color, {
      generatedThreeDmDerivative: options.generatedThreeDmDerivative === true,
      expressID: mesh.expressId,
    });
    if (display.source !== "openbim-unassigned-appearance") {
      const color = display.color;
      element.sourceColor = `${formatRgbColor([color[0], color[1], color[2]])} / alpha ${formatCoord(color[3])}`;
    }
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
    element.geometryUnit = lengthUnit;
    const center = boundsCenter(safeBounds);
    if (center) element.geometryCenter = center;
    mergeIfcElementDimensions(
      element,
      boundsDimensions(safeBounds) ?? {},
      lengthUnit,
      "mesh-bounds",
    );
  }
}

function emptyBounds3D(): Bounds3D {
  return {
    min: {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      z: Number.POSITIVE_INFINITY,
    },
    max: {
      x: Number.NEGATIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
      z: Number.NEGATIVE_INFINITY,
    },
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
  return readableEngineeringText(
    element.name ||
      element.tag ||
      element.objectType ||
      chineseIfcType(element.type) ||
      `#${element.expressID}`,
    `#${element.expressID}`,
  );
}

function ifcGeometrySourceLabel(element: IfcElementProperties): string {
  switch (element.geometrySource) {
    case "ifc-representation":
      return "IFC 几何表达";
    case "ifc-quantity":
      return "IFC 属性/数量集";
    case "mesh-bounds":
      return "可视化 Mesh 包围盒（源文件未提供可解析语义尺寸）";
    case "mixed":
      return "IFC 属性/几何表达";
    default:
      return element.geometryBounds
        ? "可视化 Mesh 包围盒（源文件未提供可解析语义尺寸）"
        : "待解析";
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
  const geometryDimensions = displayIfcElementDimensions(selected);
  const sourcePosition = displayIfcElementCenter(selected);
  const rows: IfcPropertyRow[] = [
    { key: "uploadTemplate", label: "上传模板", value: "BOM/属性模板可上传" },
    { key: "exportList", label: "导出清单", value: "选中构件 / 整模 BOM" },
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
      key: "name",
      label: "名称",
      value: displayIfcElementName(selected),
      editable: true,
    },
    {
      key: "objectType",
      label: "对象类型",
      value: readableEngineeringText(
        selected.objectType || selected.type,
        selected.type,
      ),
      editable: true,
    },
    {
      key: "ifcType",
      label: "IFC类型",
      value: `${chineseIfcType(selected.type)} · ${selected.type}`,
    },
    {
      key: "tag",
      label: "构件标记",
      value: readableEngineeringText(
        selected.tag || defaultPending,
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "predefinedType",
      label: "预定义类型",
      value: readableEngineeringText(
        selected.predefinedType || defaultPending,
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "dimensions",
      label: `三维尺寸（${geometryUnit.label}）`,
      value: formatDimensionVector(geometryDimensions, geometryUnit),
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
      value: formatPointVector(sourcePosition, geometryUnit),
    },
    {
      key: "geometry",
      label: "几何表达",
      value: formatIfcElementGeometryStats(selected, preview),
    },
    {
      key: "material",
      label: "材质",
      value: readableEngineeringText(
        propertyValueFromElement(
          selected,
          ["Material", "材料", "材质"],
          defaultPending,
        ),
        defaultPending,
      ),
      editable: true,
    },
    {
      key: "sourceColor",
      label: "openBIM 表现样式",
      value: selected.sourceColor ?? defaultPending,
    },
    {
      key: "route",
      label: "查看链路",
      value: `${panaecLabel} · IFC 原生源文件`,
    },
  ];
  const fingerprints = new Set(
    rows.map((row) => `${row.label}:${row.value}`.toLowerCase()),
  );
  selected.properties.forEach((property, index) => {
    if (DEPRECATED_ENGINEERING_ROLE_LABELS.has(property.label)) return;
    const label = readableEngineeringText(property.label);
    const value = readableEngineeringText(property.value);
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
    const mode =
      event.button === 1 || event.button === 2 || event.shiftKey
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
      camera.pan(
        deltaX * ifcLitePanSensitivity,
        deltaY * ifcLitePanSensitivity,
        true,
      );
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
    renderer
      .getCamera()
      .zoom(
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

  const movementByAction: Record<
    Exclude<ModelAxisAction, "reset">,
    Bounds3DPoint
  > = {
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
      label: `${panaecLabel} IFC 查看器`,
      priority: 10,
      role: "primary",
      capability: "ifc_lite_viewer",
      status: "available",
      installHint:
        "IFC 源文件通过 PanAEC Engine 原生路径流式解析并显示，不经过自动 OpenUSD/3D Tiles/GLB 派生。",
    },
    {
      id: "ifc-lite-three-fallback",
      label: `${panaecLabel} IFC 兼容查看`,
      priority: 15,
      role: "fallback",
      capability: "ifc_lite_viewer",
      status: "available",
      installHint:
        "浏览器未启用 WebGPU 时仍使用 PanAEC Engine 源 IFC 解析显示；不触发 OpenUSD/3D Tiles/GLB 兜底派生。",
    },
    {
      id: "thatopen-fragments-service",
      label: `${panaecLabel} IFC 缓存服务`,
      priority: 20,
      role: "fallback",
      capability: "fragments_derivative",
      status: "unknown",
      installHint: "可作为后续预转换缓存，但不替代原生 IFC 源文件打开入口。",
    },
    {
      id: "ifcopenshell-ifcconvert",
      label: `${panaecLabel} IFC 后台校验`,
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
  if (capability === "native_ifc_viewer") return "PanAEC Engine 查看";
  if (capability === "ifc_lite_viewer") return "PanAEC Engine 查看";
  if (capability === "openusd_derivative") return "OpenUSD 派生";
  if (capability === "tiles3d_derivative") return "PanAEC Engine 后台派生";
  if (capability === "glb_derivative") return "PanAEC Engine 后台派生";
  if (capability === "properties_worker") return "属性索引";
  if (capability === "fragments_derivative") return "PanAEC Engine 缓存";
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
    message: "正在加载 PanAEC Engine IFC 模型...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadIfc() {
      setState({
        status: "loading",
        message: "正在加载 PanAEC Engine IFC 模型...",
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
          throw new Error("PanAEC Engine 无法打开该 IFC 文件。");
        }

        const group = buildIfcGroup(api, modelID, lengthUnit, {
          generatedThreeDmDerivative: isThreeDmIfcDerivativeUrl(sourceUrl),
        });
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
        <IfcInspectionWorkbench
          file={file}
          sourceUrl={sourceUrl}
          summary={summary}
        />
      ) : (
        <AdapterRequiredPanel
          title="IFC 已解析，但未生成几何"
          file={file}
          reason="PanAEC Engine 能读取该文件的实体数据，但该模型没有可流式输出的几何，或几何被源文件省略。"
        />
      )}
    </>
  );
}

function IfcInspectionWorkbench({
  file,
  sourceUrl,
  summary,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
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
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={`${panaecLabel} · IFC 模型`}
      outlineNodes={buildIfcWorkbenchOutline(file, summary, metrics)}
      onSelectOutlineNode={(node) => {
        const expressID = ifcExpressIdFromTreeNode(node.id);
        if (expressID !== null) setSelectedExpressID(expressID);
      }}
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
      enabledTools={commonThreeViewportWorkbenchTools}
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
        status={`${panaecLabel} · BIM ${summary.upAxis.toUpperCase()}-up 坐标`}
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
  const propertySections = useMemo(
    () => splitEngineeringPropertyRows(propertyRows),
    [propertyRows],
  );
  const summaryMetrics: ViewerMetric[] = [
    { label: "可选构件", value: summary.elements.length.toLocaleString() },
    { label: "几何网格", value: summary.totalMeshes.toLocaleString() },
    { label: "IFC 行", value: summary.totalLines.toLocaleString() },
    {
      label: "片段",
      value: summary.truncated
        ? `${summary.renderedFragments.toLocaleString()}+`
        : summary.renderedFragments.toLocaleString(),
    },
  ];

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

          <EngineeringPropertySummaryGrid rows={propertySections.promoted} />

          <div className="mt-2 space-y-1.5">
            {propertySections.details.map((item) => (
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
          <ViewerMetricDiagnostics metrics={summaryMetrics} />
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
      {!selected ? <ViewerMetricDiagnostics metrics={summaryMetrics} /> : null}
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
  xlsx.writeFile(workbook, `${safeExportName(fileName)}-PanAEC Engine-BOM.xlsx`);
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
      displayIfcElementDimensions(element),
      element.geometryUnit ?? meterLengthUnit,
    ),
    name: readableEngineeringText(element.name, `#${element.expressID}`),
    objectType: readableEngineeringText(element.objectType, element.type),
    tag: readableEngineeringText(element.tag),
    predefinedType: readableEngineeringText(element.predefinedType),
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
  return readableEngineeringText(
    findIfcPropertyValue(element, patterns),
    fallback,
  );
}

export function buildIfcPropertyRows(
  file: ModuleFileNode,
  summary: IfcSummary,
  selected: IfcElementProperties | null,
  draftValues: Record<string, string>,
): IfcPropertyRow[] {
  if (!selected) return [];
  const lengthUnit =
    selected.geometryUnit ?? summary.lengthUnit ?? meterLengthUnit;
  const displayDimensions = displayIfcElementDimensions(selected);
  const displayCenter = displayIfcElementCenter(selected);
  const prop = (patterns: string[], fallback: string) =>
    readableEngineeringText(findIfcPropertyValue(selected, patterns), fallback);
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
      value: readableEngineeringText(
        selected.objectType || selected.type,
        selected.type,
      ),
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
      value: formatDimensionVector(displayDimensions, lengthUnit),
    },
    {
      key: "dimensionSource",
      label: "尺寸来源",
      value: ifcGeometrySourceLabel(selected),
    },
    {
      key: "nativeCenter",
      label: `对象定位（${lengthUnit.label}）`,
      value: formatPointVector(displayCenter, lengthUnit),
    },
    {
      key: "material",
      label: "材质",
      value: prop(["Material", "材料", "材质"], defaultPending),
      editable: true,
    },
    {
      key: "sourceColor",
      label: "openBIM 表现样式",
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
      label: readableEngineeringText(item.label),
      value: readableEngineeringText(item.value),
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

const mlightCadWorkerFileUrls = {
  dxfParser: "/api/mlightcad/assets/dxf-parser-worker.js",
  dwgParser: "/api/mlightcad/assets/libredwg-parser-worker.js",
  mtextRender: "/api/mlightcad/assets/mtext-renderer-worker.js",
} as const;

interface MlightCadToolbarCommand {
  script?: string;
  action?: "fit" | "regen";
  feedback: string;
}

export function mlightCadToolbarCommandForWorkbenchTool(
  tool: EngineeringWorkbenchTool,
): MlightCadToolbarCommand {
  if (tool === "select") {
    return {
      script: "select",
      feedback: "已进入图纸选择模式：点击图元后查看对象信息。",
    };
  }
  if (tool === "edit") {
    return {
      script: "sketch",
      feedback:
        "已进入草图批注模式：当前修改留在审阅层，写回源文件需保存版本和审批。",
    };
  }
  if (tool === "measure") {
    return {
      script: "measuredistance",
      feedback: "已启动距离测量：在图纸上依次点选测量点。",
    };
  }
  if (tool === "section") {
    return {
      script: "zoom\nWindow",
      feedback: "已启动窗口视图：框选图纸范围进行局部查看。",
    };
  }
  return {
    script: "revcloud",
    feedback: "已进入审阅云线批注：批注属于受控审阅层，不静默覆盖源 DWG/DXF。",
  };
}

function runMlightCadToolbarCommand(
  manager: MlightCadDocManager | null,
  command: MlightCadToolbarCommand | null,
): EngineeringWorkbenchCommandFeedback {
  if (!command) return null;
  if (!manager) return "图纸工具尚未就绪。";

  try {
    if (command.action === "fit") {
      manager.curView?.zoomToFitDrawing?.(300);
      manager.regen?.();
    } else if (command.action === "regen") {
      manager.regen?.();
    } else if (command.script) {
      manager.sendStringToExecute(command.script);
    }
    return command.feedback;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `图纸命令执行失败：${message}`;
  }
}

function MlightCadRuntimeToolbarActions({
  managerRef,
}: {
  managerRef: { current: MlightCadDocManager | null };
}) {
  const actions: Array<{
    label: string;
    title: string;
    command: MlightCadToolbarCommand;
    icon: ReactNode;
  }> = [
    {
      label: "导出 SVG",
      title: "导出当前 DWG/DXF 为 SVG",
      command: {
        script: "csvg",
        feedback: "已开始导出 SVG。",
      },
      icon: <Download className="h-3.5 w-3.5" />,
    },
    {
      label: "导出 PNG",
      title: "导出当前视图为 PNG",
      command: {
        script: "pngout",
        feedback: "已开始导出 PNG。",
      },
      icon: <FileUp className="h-3.5 w-3.5" />,
    },
    {
      label: "导出 DXF",
      title: "导出 DXF",
      command: {
        script: "cdxf",
        feedback: "已开始导出 DXF。",
      },
      icon: <FileCog className="h-3.5 w-3.5" />,
    },
    {
      label: "清除测量",
      title: "清除图纸上的测量结果",
      command: {
        script: "clearmeasurements",
        feedback: "已清除测量结果。",
      },
      icon: <Ruler className="h-3.5 w-3.5" />,
    },
    {
      label: "图层",
      title: "打开图层命令",
      command: {
        script: "-layer",
        feedback: "已启动图层命令。",
      },
      icon: <Layers3 className="h-3.5 w-3.5" />,
    },
    {
      label: "切换背景",
      title: "切换图纸背景",
      command: {
        script: "switchbg",
        feedback: "已切换图纸背景。",
      },
      icon: <Grid3X3 className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <>
      {actions.map((action) => (
        <EngineeringWorkbenchIconButton
          key={action.label}
          label={action.label}
          title={action.title}
          onClick={() =>
            runMlightCadToolbarCommand(managerRef.current, action.command)
          }
        >
          {action.icon}
        </EngineeringWorkbenchIconButton>
      ))}
    </>
  );
}

function MlightCadDrawingViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<MlightCadDocManager | null>(null);
  const highlightedCadObjectIdsRef = useRef<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [state, setState] = useState<LoadState<MlightCadDrawingPreview>>({
    status: "loading",
    message: "正在打开图纸...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeManager: MlightCadDocManager | null = null;

    async function loadDrawing() {
      const container = containerRef.current;
      if (!container) return;

      setState({
        status: "loading",
        message: "正在打开图纸...",
      });
      container.replaceChildren();

      try {
        const [
          { AcApDocManager, AcApSettingManager, AcEdOpenMode, applyUiTheme },
          response,
        ] = await Promise.all([
          import("@mlightcad/cad-simple-viewer"),
          fetch(sourceUrl, { cache: "no-store" }),
        ]);
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "读取 CAD 源文件失败"),
          );
        }

        if (managerRef.current) {
          await managerRef.current.destroy().catch(() => undefined);
          managerRef.current = null;
        } else {
          await tryDestroyMlightCadSingleton(AcApDocManager);
        }

        resetMlightCadFontMapping(AcApSettingManager);
        AcApDocManager.createInstance({
          container,
          autoResize: true,
          baseUrl: mlightCadResourceBaseUrl,
          notLoadDefaultFonts: true,
          useMainThreadDraw: false,
          webworkerFileUrls: mlightCadWorkerFileUrls,
        });
        applyUiTheme("dark", container);
        activeManager = AcApDocManager.instance as MlightCadDocManager;
        managerRef.current = activeManager;
        applyMlightCadCadFontMapping(AcApSettingManager, activeManager);
        applyMlightCadDrawingTheme(activeManager);
        await loadMlightCadCadFonts(
          activeManager,
          () => !cancelled && managerRef.current === activeManager,
        );

        const sourceBytes = await response.arrayBuffer();
        const dxfSource =
          ext === ".dxf" ? prepareMlightCadDxfSourceForOpen(sourceBytes) : null;
        const sourceContent = dxfSource?.content ?? sourceBytes;
        const opened = await activeManager.openDocument(
          file.name,
          sourceContent,
          {
            minimumChunkSize: 1000,
            mode: AcEdOpenMode.Review,
            sysVars: mlightCadOpenSysVars,
          },
        );
        if (!opened) {
          throw new Error("图纸查看器未返回成功打开状态。");
        }
        const normalizedCadTextCount = normalizeMlightCadCadText(activeManager);
        await loadMlightCadCadFonts(
          activeManager,
          () => !cancelled && managerRef.current === activeManager,
        );
        applyMlightCadCadFontMapping(AcApSettingManager, activeManager);
        applyMlightCadDrawingTheme(activeManager);
        activeManager.regen?.();
        activeManager.curView?.zoomToFitDrawing?.(1200);
        await waitForMlightCadViewportTick();
        if (cancelled || managerRef.current !== activeManager) return;
        applyMlightCadCadFontMapping(AcApSettingManager, activeManager);
        applyMlightCadDrawingTheme(activeManager);
        activeManager.curView?.zoomToFitDrawing?.(1200);

        if (!cancelled) {
          const previewValue: MlightCadDrawingPreview = {
            sourceFormat: ext.replace(".", "").toUpperCase(),
            sourceBytes: sourceBytes.byteLength,
            textDisplayFixCount: normalizedCadTextCount,
          };
          previewValue.outline = buildMlightCadDrawingOutline(
            file,
            previewValue,
            activeManager,
          );
          setState({
            status: "ready",
            value: previewValue,
          });
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

    void loadDrawing();

    return () => {
      cancelled = true;
      const manager = activeManager ?? managerRef.current;
      if (manager) {
        void manager.destroy().catch(() => undefined);
        if (managerRef.current === manager) {
          managerRef.current = null;
        }
      }
    };
  }, [ext, file, sourceUrl]);

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="图纸打开失败"
        file={file}
        reason={`${state.message}。系统保留源文件真源，不会用伪预览替代真实图纸。`}
      />
    );
  }

  const preview =
    state.status === "ready"
      ? state.value
      : {
          sourceFormat: ext.replace(".", "").toUpperCase(),
          sourceBytes: file.size,
          textDisplayFixCount: 0,
        };
  const metrics: ViewerMetric[] = [
    { label: "格式", value: preview.sourceFormat || "CAD" },
    { label: "大小", value: formatModuleFileSize(preview.sourceBytes) },
    { label: "状态", value: state.status === "ready" ? "已打开" : "加载中" },
    { label: "操作", value: "选择 / 测量 / 批注 / 导出" },
  ];

  return (
    <EngineeringViewportFrame
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel="DWG/DXF 图纸"
      outlineNodes={
        preview.outline ??
        buildEngineeringWorkbenchOutline(file, "DWG/DXF 图纸", metrics)
      }
      onSelectOutlineNode={(node) => {
        const objectId = mlightCadObjectIdFromTreeNode(node.id);
        const view = managerRef.current?.curView;
        if (objectId) {
          if (highlightedCadObjectIdsRef.current.length) {
            view?.unhighlight?.(highlightedCadObjectIdsRef.current);
          }
          view?.highlight?.([objectId]);
          highlightedCadObjectIdsRef.current = [objectId];
          managerRef.current?.regen?.();
          return;
        }
        const layerName = mlightCadLayerNameFromTreeNode(node.id);
        if (!layerName) return;
        if (highlightedCadObjectIdsRef.current.length) {
          view?.unhighlight?.(highlightedCadObjectIdsRef.current);
          highlightedCadObjectIdsRef.current = [];
        }
        const focused = view?.zoomToFitLayer?.(layerName);
        if (focused) managerRef.current?.regen?.();
      }}
      asideOpen={detailsOpen}
      asideLabel="图纸属性"
      onToggleAside={() => setDetailsOpen((current) => !current)}
      onZoomIn={() => zoomMlightCadDrawing(managerRef.current, 1.2)}
      onZoomOut={() => zoomMlightCadDrawing(managerRef.current, 0.833333)}
      onWorkbenchToolCommand={(tool) =>
        runMlightCadToolbarCommand(
          managerRef.current,
          mlightCadToolbarCommandForWorkbenchTool(tool),
        )
      }
      enabledTools={["select", "edit", "measure", "section", "annotate"]}
      toolbarActions={
        <MlightCadRuntimeToolbarActions managerRef={managerRef} />
      }
      aside={
        <div className="space-y-3 text-sm">
          <ViewerAsideProperty label="文件名" value={file.name} />
          <ViewerAsideProperty label="图纸格式" value={preview.sourceFormat} />
          <ViewerAsideProperty
            label="文件大小"
            value={formatModuleFileSize(preview.sourceBytes)}
          />
          <ViewerAsideProperty
            label="查看状态"
            value={state.status === "ready" ? "已打开" : "加载中"}
          />
          <ViewerAsideProperty
            label="可用操作"
            value="选择、测量、视图、导出、审阅批注"
          />
          {preview.textDisplayFixCount > 0 ? (
            <ViewerAsideProperty
              label="文字显示"
              value={`已校正 ${preview.textDisplayFixCount} 处图纸文字`}
            />
          ) : null}
        </div>
      }
    >
      <div
        data-engineering-interactive-viewport
        tabIndex={0}
        className="arch-mlightcad-viewport relative h-full min-h-0 w-full overflow-hidden bg-black font-sans outline-none"
      >
        <div ref={containerRef} className="absolute inset-0" />
        {state.status === "loading" ? (
          <div className="viewer-floating-panel absolute left-3 top-3 z-20 rounded-md px-3 py-2 text-xs text-slate-100">
            {state.message}
          </div>
        ) : null}
      </div>
    </EngineeringViewportFrame>
  );
}

function zoomMlightCadDrawing(
  manager: MlightCadDocManager | null,
  factor: number,
) {
  if (!manager) return;
  manager.sendStringToExecute(`zoom\nScale\n${factor}\n`);
  manager.regen?.();
}

function buildMlightCadDrawingOutline(
  file: ModuleFileNode,
  preview: MlightCadDrawingPreview,
  manager: MlightCadDocManager | null,
): EngineeringWorkbenchTreeNode[] {
  const metrics: ViewerMetric[] = [
    { label: "格式", value: preview.sourceFormat || "CAD" },
    { label: "大小", value: formatModuleFileSize(preview.sourceBytes) },
    { label: "状态", value: "已打开" },
  ];
  const base = buildEngineeringWorkbenchOutline(file, "DWG/DXF 图纸", metrics);
  const blockTable = manager?.curDocument?.database?.tables?.blockTable;
  const blockRecords = blockTable?.newIterator?.();
  if (!blockRecords) return base;

  const layerCounts = new Map<string, number>();
  const entityTypeCounts = new Map<string, number>();
  const blockNodes: EngineeringWorkbenchTreeNode[] = [];
  let totalEntities = 0;

  for (const [blockIndex, blockRecord] of Array.from(blockRecords).entries()) {
    const entities = Array.from(blockRecord.newIterator?.() ?? []);
    totalEntities += entities.length;
    const entityNodes: EngineeringWorkbenchTreeNode[] = [];
    for (const entity of entities) {
      const layerName = mlightCadEntityLayerName(entity);
      layerCounts.set(layerName, (layerCounts.get(layerName) ?? 0) + 1);
      const entityType = mlightCadEntityTypeName(entity);
      entityTypeCounts.set(
        entityType,
        (entityTypeCounts.get(entityType) ?? 0) + 1,
      );
      const objectId = mlightCadEntityObjectId(entity);
      if (objectId && entityNodes.length < 80) {
        entityNodes.push({
          id: `cad-runtime:entity-object:${encodeURIComponent(objectId)}`,
          label: entityType,
          kind: "element",
          meta: `图层 ${layerName} · ${objectId}`,
          badge: layerName,
        });
      }
    }
    if (entities.length > entityNodes.length && entityNodes.length >= 80) {
      entityNodes.push({
        id: `cad-runtime:block:${blockIndex}:more`,
        label: "更多图元",
        kind: "element",
        meta: `该块还有 ${(entities.length - 80).toLocaleString()} 个图元，源文件仍完整保留`,
        badge: "more",
      });
    }
    blockNodes.push({
      id: `cad-runtime:block:${blockIndex}`,
      label:
        readableEngineeringText(
          blockRecord.name || blockRecord.blockName,
          "",
        ) || `块记录 ${blockIndex + 1}`,
      kind: "block",
      badge: entities.length.toLocaleString(),
      meta: blockRecord.layer ? `图层 ${blockRecord.layer}` : undefined,
      children: entityNodes,
    });
  }

  return [
    base[0]!,
    {
      id: "cad-runtime:drawing",
      label: "图纸结构",
      kind: "collection",
      meta: `${totalEntities.toLocaleString()} 个图元`,
      children: [
        {
          id: "cad-runtime:layers",
          label: "源图层",
          kind: "layer",
          badge: layerCounts.size.toLocaleString(),
          children: Array.from(layerCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 80)
            .map(([layerName, count]) => ({
              id: `cad-runtime:layer:${layerName}`,
              label: layerName,
              kind: "layer" as const,
              badge: count.toLocaleString(),
            })),
        },
        {
          id: "cad-runtime:entities",
          label: "图元类型",
          kind: "type",
          badge: entityTypeCounts.size.toLocaleString(),
          children: Array.from(entityTypeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 40)
            .map(([entityType, count]) => ({
              id: `cad-runtime:entity:${entityType}`,
              label: entityType,
              kind: "type" as const,
              badge: count.toLocaleString(),
            })),
        },
        {
          id: "cad-runtime:blocks",
          label: "块表与布局",
          kind: "block",
          badge: blockNodes.length.toLocaleString(),
          children: blockNodes.slice(0, 80),
        },
      ],
    },
    ...base.slice(1),
  ];
}

function mlightCadLayerNameFromTreeNode(id: string): string | null {
  const prefix = "cad-runtime:layer:";
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

function mlightCadObjectIdFromTreeNode(id: string): string | null {
  const prefix = "cad-runtime:entity-object:";
  if (!id.startsWith(prefix)) return null;
  const raw = id.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function mlightCadEntityObjectId(entity: MlightCadEntity): string | null {
  return typeof entity.objectId === "string" && entity.objectId.trim()
    ? entity.objectId.trim()
    : null;
}

function mlightCadEntityLayerName(entity: MlightCadEntity): string {
  if (typeof entity.layer === "string" && entity.layer.trim()) {
    return entity.layer.trim();
  }
  if (entity.layer && typeof entity.layer === "object" && entity.layer.name) {
    return entity.layer.name;
  }
  if (entity.layerName?.trim()) return entity.layerName.trim();
  return "0";
}

function mlightCadEntityTypeName(entity: MlightCadEntity): string {
  return (
    readableEngineeringText(
      entity.dxfName || entity.dxfname || entity.entityType || entity.type,
      "",
    ) ||
    entity.constructor?.name ||
    "CADEntity"
  );
}

function applyMlightCadDrawingTheme(manager: MlightCadDocManager) {
  const view = manager.curView;
  if (!view) return;
  view.backgroundColor = mlightCadCanvasBackground;
  if (view.renderer) {
    view.renderer.showLineWeight = true;
  }
  view.isDirty = true;
}

function resetMlightCadFontMapping(
  settingManagerClass: typeof import("@mlightcad/cad-simple-viewer").AcApSettingManager,
) {
  settingManagerClass.instance.fontMapping = buildMlightCadCadFontMapping();
}

function applyMlightCadCadFontMapping(
  settingManagerClass: typeof import("@mlightcad/cad-simple-viewer").AcApSettingManager,
  manager?: MlightCadDocManager | null,
) {
  const mapping = buildMlightCadCadFontMapping(
    mlightCadMissedFontNames(manager),
  );
  settingManagerClass.instance.fontMapping = mapping;
  manager?.curView?.renderer?.setFontMapping?.(mapping);
  manager?.regen?.();
}

function mlightCadMissedFontNames(
  manager: MlightCadDocManager | null | undefined,
): string[] {
  const missedFonts =
    manager?.curView?.missedData?.fonts ??
    manager?.curView?.renderer?.missedFonts;
  if (!missedFonts) return [];
  return Object.keys(missedFonts).filter(Boolean);
}

export function buildMlightCadCadFontMapping(
  missedFonts: string[] = [],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const addMapping = (source: string, target: string) => {
    const cleanSource = source.trim();
    if (!cleanSource) return;
    for (const alias of mlightCadFontAliasVariants(cleanSource)) {
      mapping[alias] = target;
    }
  };

  for (const alias of mlightCadKnownChineseFontAliases) {
    addMapping(alias, mlightCadFallbackTargetForFontName(alias));
  }
  for (const alias of mlightCadKnownWesternFontAliases) {
    addMapping(alias, mlightCadFallbackTargetForFontName(alias));
  }
  for (const fontName of missedFonts) {
    addMapping(fontName, mlightCadFallbackTargetForFontName(fontName));
  }

  return mapping;
}

function mlightCadFontAliasVariants(fontName: string): string[] {
  const normalized = mlightCadNormalizeFontName(fontName);
  const variants = new Set<string>();
  const add = (value: string) => {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    variants.add(cleanValue);
    variants.add(cleanValue.toLowerCase());
    variants.add(cleanValue.toUpperCase());
  };

  add(fontName);
  add(normalized);
  for (const ext of [".shx", ".ttf", ".woff"]) {
    add(`${normalized}${ext}`);
  }
  return Array.from(variants);
}

function mlightCadNormalizeFontName(fontName: string): string {
  return fontName
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\.(shx|ttf|woff)$/i, "");
}

export function mlightCadFallbackTargetForFontName(fontName: string): string {
  const normalized = mlightCadNormalizeFontName(fontName).toLowerCase();
  if (/黑体|黑/u.test(fontName)) return "simhei";
  if (/楷体|楷/u.test(fontName)) return "simkai";
  if (/仿宋|宋体|宋/u.test(fontName)) return "simsun";
  if (
    /[\u3400-\u9fff]/u.test(fontName) ||
    normalized.includes("chn") ||
    normalized.includes("china") ||
    normalized.includes("chinese") ||
    normalized.includes("hz") ||
    normalized.includes("gb") ||
    normalized.includes("fs") ||
    normalized.includes("song") ||
    normalized.includes("hei") ||
    normalized.includes("kai")
  ) {
    if (normalized.includes("hei")) return "simhei";
    if (normalized.includes("kai")) return "simkai";
    if (
      normalized.includes("chn") ||
      normalized.includes("hz") ||
      normalized.includes("gb") ||
      normalized.includes("fs")
    ) {
      return "hztxt";
    }
    return "simsun";
  }
  if (normalized.includes("rom")) return "romans";
  if (normalized.includes("simplex")) return "simplex";
  if (normalized.includes("arial")) return "arial";
  return "txt";
}

function normalizeMlightCadCadText(manager: MlightCadDocManager): number {
  const blockTable = manager.curDocument?.database?.tables?.blockTable;
  const blockRecords = blockTable?.newIterator?.();
  if (!blockRecords) return 0;

  let normalizedTextCount = 0;
  for (const blockRecord of blockRecords) {
    const entities = blockRecord.newIterator?.();
    if (!entities) continue;
    for (const entity of entities) {
      if (normalizeMlightCadCadTextEntity(entity)) {
        normalizedTextCount += 1;
        entity.triggerModifiedEvent?.();
      }
    }
  }
  return normalizedTextCount;
}

function normalizeMlightCadCadTextEntity(entity: MlightCadEntity): boolean {
  let changed = false;
  for (const property of mlightCadTextProperties) {
    const current = entity[property];
    if (typeof current !== "string") continue;
    const normalized = decodeMlightCadCadTextEscapes(current);
    if (normalized === current) continue;
    entity[property] = normalized;
    changed = true;
  }

  const embeddedMText = entity.mtext;
  if (typeof embeddedMText?.contents === "string") {
    const normalized = decodeMlightCadCadTextEscapes(embeddedMText.contents);
    if (normalized !== embeddedMText.contents) {
      embeddedMText.contents = normalized;
      embeddedMText.triggerModifiedEvent?.();
      changed = true;
    }
  }

  return changed;
}

const mlightCadTextProperties = [
  "contents",
  "textString",
  "dimensionText",
] as const;

export function decodeMlightCadCadTextEscapes(value: string): string {
  return value
    .replace(/\\[Uu]\+([0-9A-Fa-f]{4})/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/%%([cdp])/gi, (_match, code: string) => {
      switch (code.toLowerCase()) {
        case "c":
          return "∅";
        case "d":
          return "°";
        case "p":
          return "±";
        default:
          return _match;
      }
    });
}

export function decodeMlightCadDxfSource(sourceBytes: ArrayBuffer): string {
  const preview = new TextDecoder().decode(
    sourceBytes.slice(0, Math.min(sourceBytes.byteLength, 65_536)),
  );
  const codePage = extractMlightCadDxfCodePage(preview);
  const encoding = mlightCadDxfEncodingForCodePage(codePage);
  try {
    return new TextDecoder(encoding).decode(sourceBytes);
  } catch {
    return new TextDecoder().decode(sourceBytes);
  }
}

export function prepareMlightCadDxfSourceForOpen(sourceBytes: ArrayBuffer): {
  content: ArrayBuffer;
  codePage: string | null;
  encoding: string;
  transcodedToUtf8: boolean;
} {
  const preview = new TextDecoder().decode(
    sourceBytes.slice(0, Math.min(sourceBytes.byteLength, 65_536)),
  );
  const codePage = extractMlightCadDxfCodePage(preview);
  const encoding = mlightCadDxfEncodingForCodePage(codePage);
  if (encoding === "utf-8") {
    return {
      content: sourceBytes,
      codePage,
      encoding,
      transcodedToUtf8: false,
    };
  }

  const decoded = decodeMlightCadDxfSource(sourceBytes);
  const utf8Bytes = new TextEncoder().encode(
    replaceMlightCadDxfCodePage(decoded, "UTF-8"),
  );
  return {
    content: typedArrayToArrayBuffer(utf8Bytes),
    codePage,
    encoding,
    transcodedToUtf8: true,
  };
}

export function extractMlightCadDxfCodePage(dxfText: string): string | null {
  const normalizedText = dxfText.replace(/\r\n?/g, "\n");
  const match = normalizedText.match(
    /^\s*\$DWGCODEPAGE\s*\n\s*3\s*\n\s*([^\n]+)/im,
  );
  return match?.[1]?.trim() || null;
}

export function mlightCadDxfEncodingForCodePage(
  codePage: string | null | undefined,
): string {
  const normalizedCodePage = codePage
    ?.trim()
    .toUpperCase()
    .replace(/[-\s]/g, "_");
  switch (normalizedCodePage) {
    case "ANSI_936":
    case "CP936":
    case "GB2312":
    case "GBK":
    case "GB18030":
      return "gb18030";
    case "ANSI_950":
    case "CP950":
    case "BIG5":
      return "big5";
    case "ANSI_932":
    case "CP932":
    case "SHIFT_JIS":
    case "SHIFTJIS":
      return "shift_jis";
    case "ANSI_949":
    case "CP949":
      return "euc-kr";
    case "ANSI_874":
    case "CP874":
      return "windows-874";
    case "UTF_8":
    case "UTF8":
      return "utf-8";
    default:
      break;
  }
  const ansiCodePage = normalizedCodePage?.match(/^ANSI_(125[0-8])$/);
  if (ansiCodePage) {
    return `windows-${ansiCodePage[1]}`;
  }
  const windowsCodePage = normalizedCodePage?.match(
    /^(?:CP|WINDOWS_)(125[0-8])$/,
  );
  if (windowsCodePage) {
    return `windows-${windowsCodePage[1]}`;
  }
  return "utf-8";
}

function replaceMlightCadDxfCodePage(
  dxfText: string,
  codePage: string,
): string {
  return dxfText.replace(
    /(\$DWGCODEPAGE\s*(?:\r\n|\n|\r)\s*3\s*(?:\r\n|\n|\r)\s*)[^\r\n]+/i,
    `$1${codePage}`,
  );
}

function typedArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

async function loadMlightCadCadFonts(
  manager: MlightCadDocManager,
  isCurrent: () => boolean,
) {
  const fontNames = await fetchMlightCadCadFontNames();
  if (!isCurrent()) return;
  if (!fontNames.length) return;
  await manager.loadDefaultFonts?.(fontNames);
}

function waitForMlightCadViewportTick(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

async function fetchMlightCadCadFontNames(): Promise<string[]> {
  const response = await fetch(`${mlightCadResourceBaseUrl}fonts/fonts.json`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `CAD 字体清单不可用: ${response.status} ${response.statusText}`,
    );
  }
  const fonts = (await response.json()) as MlightCadFontInfo[];
  return extractMlightCadCadFontNames(fonts);
}

export function extractMlightCadCadFontNames(
  fonts: MlightCadFontInfo[],
): string[] {
  const fontNames = fonts
    .map((font) => font.name?.[0] ?? fileStem(font.file))
    .filter((fontName): fontName is string => Boolean(fontName));
  return Array.from(new Set(fontNames));
}

function fileStem(fileName: string | undefined): string | null {
  if (!fileName) return null;
  return fileName.replace(/\.[^.]+$/, "").trim() || null;
}

async function tryDestroyMlightCadSingleton(
  docManagerClass: typeof import("@mlightcad/cad-simple-viewer").AcApDocManager,
) {
  try {
    await (docManagerClass.instance as MlightCadDocManager).destroy();
  } catch {
    // The singleton may not exist yet.
  }
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

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(degrees: number): number {
  return (degrees / 180) * Math.PI;
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

function finiteNumberUserData(value: unknown, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function scalePoint(point: Bounds3DPoint, factor: number): Bounds3DPoint {
  return {
    x: point.x * factor,
    y: point.y * factor,
    z: point.z * factor,
  };
}

function scaleBounds(bounds: Bounds3D, factor: number): Bounds3D {
  return {
    min: scalePoint(bounds.min, factor),
    max: scalePoint(bounds.max, factor),
  };
}

function boxToScaledSerializableBounds(box: Box3, factor: number): Bounds3D {
  return scaleBounds(boxToSerializableBounds(box), factor);
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
    message: "正在打开 PanAEC Engine 模型...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadOcct() {
      setState({
        status: "loading",
        message: "正在打开 PanAEC Engine 模型...",
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
          routeLabel: `${panaecLabel} · CAD 模型`,
        });
        activeGroup = preview.group;

        if (!cancelled) {
          setSelectedObjectUuid(null);
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
        title="PanAEC Engine 模型打开失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const ext = file.localFile?.ext || extensionOf(file.name);
  const routeLabel = `${panaecLabel} · CAD 模型`;
  const selectedObject = findMeshByUuid(state.value.group, selectedObjectUuid);
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
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={routeLabel}
      outlineNodes={buildThreeGroupWorkbenchOutline(
        file,
        state.value.group,
        routeLabel,
        metrics,
      )}
      onSelectOutlineNode={(node) => {
        const objectUuid = engineeringMeshUuidFromTreeNode(node.id);
        if (objectUuid) setSelectedObjectUuid(objectUuid);
      }}
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel={routeLabel}
          metrics={metrics}
          sourceUrl={sourceUrl}
          selectedRows={selectedRows}
          selectedTitle={selectedObject?.name || "模型属性"}
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
      enabledTools={commonThreeViewportWorkbenchTools}
    >
      <ThreeGroupViewport
        group={state.value.group}
        label={file.name}
        status={`${panaecLabel} · CAD 模型`}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showChrome={false}
        selectedObjectUuid={selectedObjectUuid}
        onObjectSelect={(object) => setSelectedObjectUuid(object.uuid)}
        onClearSelection={() => setSelectedObjectUuid(null)}
      />
    </EngineeringViewportFrame>
  );
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

function engineeringMeshUuidFromTreeNode(id: string): string | null {
  return id.startsWith("mesh:") ? id.slice("mesh:".length) : null;
}

function buildThreeGroupWorkbenchOutline(
  file: ModuleFileNode,
  group: Group | null,
  routeLabel: string,
  metrics: readonly ViewerMetric[],
): EngineeringWorkbenchTreeNode[] {
  const contract = engineeringViewerContractForFileName(
    file.name,
    file.mimeType,
  );
  const base = buildEngineeringWorkbenchOutline(
    file,
    routeLabel,
    metrics,
    contract,
  );
  if (!group) return base;

  const sceneChildren = group.children
    .slice(0, 80)
    .map((child, index) => object3dToEngineeringTreeNode(child, index, 0))
    .filter((node): node is EngineeringWorkbenchTreeNode => Boolean(node));

  return [
    base[0]!,
    {
      id: `scene:${group.uuid}`,
      label: group.name || "Scene Collection",
      kind: "scene",
      meta: `${routeLabel} · ${countGroupMeshes(group).toLocaleString()} mesh`,
      children: sceneChildren.length
        ? sceneChildren
        : [
            {
              id: `scene:${group.uuid}:empty`,
              label: "空场景",
              kind: "scene",
              meta: "未发现可选择 mesh 对象",
            },
          ],
    },
    ...base.slice(1),
  ];
}

function object3dToEngineeringTreeNode(
  object: Object3D,
  index: number,
  depth: number,
): EngineeringWorkbenchTreeNode | null {
  if (depth > 4) {
    return {
      id: `object:${object.uuid}:truncated`,
      label: "更多子对象",
      kind: "collection",
      meta: "目录树显示深度已截断，源场景仍保留完整层级",
    };
  }

  const isMesh = object instanceof Mesh;
  const children = object.children
    .slice(0, 36)
    .map((child, childIndex) =>
      object3dToEngineeringTreeNode(child, childIndex, depth + 1),
    )
    .filter((node): node is EngineeringWorkbenchTreeNode => Boolean(node));
  const label =
    readableEngineeringText(object.name, "") ||
    (isMesh ? `Mesh ${index + 1}` : `Object ${index + 1}`);
  const vertexCount =
    isMesh && object.geometry?.attributes?.position
      ? object.geometry.attributes.position.count
      : null;
  const userDataType = stringUserData(
    object.userData.objectType ||
      object.userData.type ||
      object.userData.sourceFormat,
    "",
  );

  return {
    id: isMesh ? `mesh:${object.uuid}` : `object:${object.uuid}`,
    label,
    kind: isMesh ? "mesh" : "collection",
    meta: [
      userDataType,
      vertexCount ? `${vertexCount.toLocaleString()} vertices` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    badge: isMesh ? "mesh" : undefined,
    children,
  };
}

function countGroupMeshes(group: Group): number {
  let count = 0;
  group.traverse((object) => {
    if (object instanceof Mesh) count += 1;
  });
  return count;
}

function ifcExpressIdFromTreeNode(id: string): number | null {
  if (!id.startsWith("ifc-element:")) return null;
  const value = Number.parseInt(id.slice("ifc-element:".length), 10);
  return Number.isFinite(value) ? value : null;
}

function buildIfcWorkbenchOutline(
  file: ModuleFileNode,
  preview: {
    elements: IfcElementProperties[];
    loadedMeshes?: number;
    renderedFragments?: number;
    totalMeshes?: number | null;
    totalVertices?: number;
    totalTriangles?: number;
  },
  metrics: readonly ViewerMetric[],
): EngineeringWorkbenchTreeNode[] {
  const contract = engineeringViewerContractForFileName(
    file.name,
    file.mimeType,
  );
  const base = buildEngineeringWorkbenchOutline(
    file,
    `${panaecLabel} · IFC 原生源文件`,
    metrics,
    contract,
  );
  const byType = new Map<string, IfcElementProperties[]>();
  for (const element of preview.elements) {
    const type = element.type || "IFCObject";
    byType.set(type, [...(byType.get(type) ?? []), element]);
  }
  const typeNodes = Array.from(byType.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 18)
    .map(([type, elements]) => ({
      id: `ifc-type:${type}`,
      label: `${chineseIfcType(type)} · ${type}`,
      kind: "type" as const,
      badge: elements.length.toLocaleString(),
      children: [
        ...elements.slice(0, 32).map((element) => ({
          id: `ifc-element:${element.expressID}`,
          label: displayIfcElementName(element),
          kind: "element" as const,
          meta: `#${element.expressID} · ${element.globalId || element.tag || element.objectType}`,
          badge: element.predefinedType || undefined,
        })),
        ...(elements.length > 32
          ? [
              {
                id: `ifc-type:${type}:more`,
                label: `还有 ${elements.length - 32} 个构件`,
                kind: "element" as const,
                meta: "目录树仅显示前 32 个，模型数据未截断",
              },
            ]
          : []),
      ],
    }));

  return [
    base[0]!,
    {
      id: "ifc:runtime-spatial",
      label: "IFC 构件索引",
      kind: "collection",
      meta: `${preview.elements.length.toLocaleString()} elements · ${(preview.loadedMeshes ?? preview.renderedFragments ?? 0).toLocaleString()}/${preview.totalMeshes?.toLocaleString() ?? "stream"} mesh`,
      children: typeNodes,
    },
    {
      id: "ifc:runtime-geometry",
      label: "几何缓存",
      kind: "mesh",
      meta: `${(preview.totalVertices ?? 0).toLocaleString()} vertices · ${(preview.totalTriangles ?? 0).toLocaleString()} triangles`,
    },
    ...base.slice(1),
  ];
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

function isFinitePoint(point: Bounds3DPoint | null): point is Bounds3DPoint {
  return Boolean(
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z),
  );
}

function hasVisibleOffset(point: Bounds3DPoint | null): boolean {
  return (
    isFinitePoint(point) &&
    Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) > 1e-9
  );
}

function modelViewTarget(group: Group | null): Vector3 {
  if (!group) return new Vector3();
  const explicitTarget = vectorUserData(group.userData.viewTarget);
  if (isFinitePoint(explicitTarget)) {
    return new Vector3(explicitTarget.x, explicitTarget.y, explicitTarget.z);
  }

  const storedBounds = boundsUserData(group.userData.nativeBounds);
  const storedCenter = boundsCenter(storedBounds);
  if (isFinitePoint(storedCenter)) {
    return new Vector3(storedCenter.x, storedCenter.y, storedCenter.z);
  }

  const box = new Box3().setFromObject(group);
  if (box.isEmpty()) return new Vector3();
  const center = box.getCenter(new Vector3());
  return [center.x, center.y, center.z].every(Number.isFinite)
    ? center
    : new Vector3();
}

function rotateModelPointForUpAxis(
  point: Vector3,
  upAxis: ModelUpAxis,
): Vector3 {
  if (upAxis === "y") return point.clone();
  return new Vector3(point.x, point.z, -point.y);
}

function modelDisplayBox(group: Group | null): Box3 {
  const box = new Box3();
  if (!group) return box;
  box.setFromObject(group);
  return box;
}

function modelDisplayTarget(group: Group | null): Vector3 {
  const box = modelDisplayBox(group);
  if (!box.isEmpty()) {
    const center = box.getCenter(new Vector3());
    if ([center.x, center.y, center.z].every(Number.isFinite)) {
      return center;
    }
  }
  return modelViewTarget(group);
}

function ThreeGroupViewport({
  group,
  label,
  status,
  upAxis = "z",
  selectedExpressID = null,
  selectedObjectUuid = null,
  selectedFaceIndex = null,
  selectionHighlightMode = "material",
  onMeshSelect,
  onObjectSelect,
  onFaceSelect,
  onClearSelection,
  className,
  showChrome = true,
}: {
  group: Group | null;
  label: string;
  status: string;
  upAxis?: ModelUpAxis;
  selectedExpressID?: number | null;
  selectedObjectUuid?: string | null;
  selectedFaceIndex?: number | null;
  selectionHighlightMode?: ModelSelectionHighlightMode;
  onMeshSelect?: (expressID: number) => void;
  onObjectSelect?: (object: Mesh) => void;
  onFaceSelect?: (object: Mesh, faceIndex: number | null) => void;
  onClearSelection?: () => void;
  className?: string;
  showChrome?: boolean;
}) {
  const [viewTransform, setViewTransform] =
    useState<ViewTransform>(defaultViewTransform);
  const [fitNonce, setFitNonce] = useState(0);
  const [viewportTool, setViewportTool] = useState<ModelViewportTool>("select");
  const [measureStart, setMeasureStart] = useState<ModelViewportPick | null>(
    null,
  );
  const [measurements, setMeasurements] = useState<ModelViewportMeasurement[]>(
    [],
  );
  const [coordinateProbe, setCoordinateProbe] =
    useState<ModelViewportCoordinateProbe | null>(null);
  const [cloudAnnotations, setCloudAnnotations] = useState<
    ModelViewportCloudAnnotation[]
  >([]);
  const [sectionActive, setSectionActive] = useState(false);
  const modelTransformRef = useRef<Group | null>(null);
  const graphicsRuntime = useModelGraphicsRuntime();

  const resetModelView = useCallback(() => {
    setViewTransform(defaultViewTransform);
    setFitNonce((value) => value + 1);
  }, []);

  const zoomModelView = useCallback((factor: number) => {
    setViewTransform((current) => ({
      ...current,
      scale: clampNumber(current.scale * factor, 0.05, 50),
    }));
  }, []);

  useEffect(() => {
    if (!group) return;
    const selectedObject = findMeshByUuid(group, selectedObjectUuid);
    const selectedComponentKey = selectedObject
      ? meshSelectionAggregationKey(selectedObject)
      : "";
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = meshMaterialList(object);
      const baseColor = colorTupleFromUserData(object.userData.baseColor);
      const isSelected =
        selectionHighlightMode === "material" &&
        (object.userData.expressID === selectedExpressID ||
          object.uuid === selectedObjectUuid ||
          (selectedComponentKey.length > 0 &&
            meshSelectionAggregationKey(object) === selectedComponentKey));
      materials.forEach((material) => {
        applyMeshSelectionMaterialState(material, isSelected, baseColor);
      });
    });
  }, [group, selectedExpressID, selectedObjectUuid, selectionHighlightMode]);

  useEffect(() => {
    function handleViewportCommand(event: Event) {
      const command = (event as CustomEvent<{ command?: unknown }>).detail
        ?.command;
      if (command === "zoomIn") {
        zoomModelView(1.16);
        return;
      }
      if (command === "zoomOut") {
        zoomModelView(1 / 1.16);
        return;
      }
      if (command === "reset" || command === "fit") {
        resetModelView();
        return;
      }
      if (command === "tool:select") {
        setViewportTool("select");
        setMeasureStart(null);
        return;
      }
      if (command === "tool:measure") {
        setViewportTool("measure");
        setMeasureStart(null);
        return;
      }
      if (command === "tool:coordinate") {
        setViewportTool("coordinate");
        setMeasureStart(null);
        return;
      }
      if (command === "tool:cloud") {
        setViewportTool("cloud");
        setMeasureStart(null);
        return;
      }
      if (command === "tool:section") {
        setViewportTool("section");
        setSectionActive((active) => !active);
        setMeasureStart(null);
        return;
      }
      if (command === "tool:walk") {
        setViewportTool("walk");
        setMeasureStart(null);
        return;
      }
      if (command === "clear:overlays") {
        setMeasureStart(null);
        setMeasurements([]);
        setCoordinateProbe(null);
        setCloudAnnotations([]);
        setSectionActive(false);
      }
    }

    window.addEventListener(modelViewportCommandEvent, handleViewportCommand);
    return () => {
      window.removeEventListener(
        modelViewportCommandEvent,
        handleViewportCommand,
      );
    };
  }, [resetModelView, zoomModelView]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    const nearestMesh = findNearestMesh(event.object);
    const expressID =
      findExpressID(event.object) ??
      findFaceExpressID(event.object, event.faceIndex ?? null);
    if (!expressID && !nearestMesh) return;
    event.stopPropagation();
    if (handleViewportToolPick(event, nearestMesh, expressID ?? null)) {
      return;
    }
    if (expressID) onMeshSelect?.(expressID);
    if (nearestMesh) {
      onObjectSelect?.(nearestMesh);
      onFaceSelect?.(nearestMesh, event.faceIndex ?? null);
    }
  }

  function handleViewportToolPick(
    event: ThreeEvent<MouseEvent>,
    nearestMesh: Mesh | null,
    expressID: number | null,
  ): boolean {
    if (viewportTool === "select") return false;
    if (viewportTool === "walk" || viewportTool === "section") return true;
    const pick = modelViewportPickFromEvent(
      event,
      nearestMesh,
      expressID,
      modelTransformRef.current,
      snapTolerance,
    );

    if (viewportTool === "measure") {
      if (!measureStart) {
        setMeasureStart(pick);
        return true;
      }
      const measurement = modelViewportMeasurementFromPicks(measureStart, pick);
      setMeasurements((current) => [...current.slice(-4), measurement]);
      setMeasureStart(null);
      return true;
    }

    if (viewportTool === "coordinate") {
      setCoordinateProbe(modelViewportCoordinateProbeFromPick(pick));
      return true;
    }

    if (viewportTool === "cloud") {
      const normal = modelViewportNormalFromEvent(
        event,
        nearestMesh,
        modelTransformRef.current,
      );
      const radius = modelRevisionCloudRadius(group);
      setCloudAnnotations((current) => [
        ...current.slice(-7),
        modelViewportCloudAnnotationFromPick(pick, normal, radius),
      ]);
      return true;
    }

    return false;
  }

  const updateLatestCloudAnnotation = useCallback(
    (
      updater: (
        annotation: ModelViewportCloudAnnotation,
      ) => ModelViewportCloudAnnotation,
    ) => {
      setCloudAnnotations((current) => {
        if (!current.length) return current;
        const next = [...current];
        const latest = next[next.length - 1];
        if (!latest) return current;
        next[next.length - 1] = updater(latest);
        return next;
      });
    },
    [],
  );

  const nudgeLatestCloudAnnotation = useCallback(
    (delta: Vector3) => {
      updateLatestCloudAnnotation((annotation) =>
        modelViewportCloudAnnotationWithCenter(
          annotation,
          annotation.center.clone().add(delta),
        ),
      );
    },
    [updateLatestCloudAnnotation],
  );

  const resizeLatestCloudAnnotation = useCallback(
    (factor: number) => {
      updateLatestCloudAnnotation((annotation) =>
        modelViewportCloudAnnotationWithRadius(
          annotation,
          annotation.radius * factor,
          group,
        ),
      );
    },
    [group, updateLatestCloudAnnotation],
  );

  const adjustLatestCloudShape = useCallback(
    (patch: Partial<ModelViewportCloudShape>) => {
      updateLatestCloudAnnotation((annotation) =>
        modelViewportCloudAnnotationWithShape(annotation, patch),
      );
    },
    [updateLatestCloudAnnotation],
  );

  const deleteLatestCloudAnnotation = useCallback(() => {
    setCloudAnnotations((current) => current.slice(0, -1));
  }, []);

  function handleViewportKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (viewportTool === "walk") return;
    if (
      viewportTool === "cloud" &&
      handleCloudAnnotationKeyDown(
        event,
        cloudAnnotations.length > 0,
        modelMoveStep,
        nudgeLatestCloudAnnotation,
        resizeLatestCloudAnnotation,
        deleteLatestCloudAnnotation,
      )
    ) {
      return;
    }
    handleModelKeyDown(event, setViewTransform, modelMoveStep);
  }

  const renderOffset = vectorUserData(group?.userData.renderOffset);
  const showRenderOffset = hasVisibleOffset(renderOffset);
  const gridRotation: [number, number, number] =
    upAxis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const modelMoveStep = modelAxisMoveStep(group);
  const worldUnitsToMillimeters = modelViewportWorldUnitsToMillimeters(group);
  const snapTolerance = modelViewportSnapTolerance(
    group,
    worldUnitsToMillimeters,
  );
  const sceneTarget = modelDisplayTarget(group);
  const orbitTarget = useMemo(
    () =>
      [sceneTarget.x, sceneTarget.y, sceneTarget.z] as [number, number, number],
    [sceneTarget],
  );
  const engineeringRendererFactory = useMemo(
    () => createEngineeringRendererFactory(graphicsRuntime.status),
    [graphicsRuntime.status],
  );
  const runtimeLabel = modelGraphicsRuntimeLabel(graphicsRuntime);

  return (
    <section
      data-engineering-interactive-viewport
      className={
        className ??
        "relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      }
      tabIndex={0}
      onPointerDown={(event) => event.currentTarget.focus()}
      onKeyDown={handleViewportKeyDown}
    >
      {showChrome ? (
        <>
          <div className="viewer-floating-panel absolute left-4 top-4 z-10 rounded-md px-4 py-2 text-sm text-white">
            <p className="font-medium">{status}</p>
            <p className="mt-1 max-w-[32rem] truncate text-xs text-slate-300">
              {label}
            </p>
            {showRenderOffset && renderOffset ? (
              <p className="mt-1 max-w-[32rem] truncate text-[11px] text-emerald-300">
                原生坐标保留，视图偏移 {formatCoord(renderOffset.x)},{" "}
                {formatCoord(renderOffset.y)}, {formatCoord(renderOffset.z)}
              </p>
            ) : null}
            <p className="mt-1 max-w-[32rem] truncate text-[11px] text-sky-200">
              {runtimeLabel}
            </p>
          </div>
          <div className="absolute right-4 top-4 z-10 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetModelView}
              className="viewer-ghost-tool rounded-md px-3 py-2 text-sm font-medium text-white"
              title="重置模型坐标、旋转和比例"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}
      <ModelSixAxisControlPanel
        onAction={(action) => {
          if (action === "reset") {
            resetModelView();
            return;
          }
          applyModelAxisAction(action, setViewTransform, modelMoveStep);
        }}
      />
      {graphicsRuntime.status === "checking" ? (
        <ModelRuntimeStatusPanel
          title="正在检测图形运行时"
          message="正在按 WebGPU -> WebGL -> 受审计 SVG 失败恢复的顺序检测浏览器 GPU 能力。"
        />
      ) : graphicsRuntime.status === "unavailable" ? (
        <ModelSvgProjectionFallback
          group={group}
          label={label}
          status={status}
          upAxis={upAxis}
          viewTransform={viewTransform}
          reason={graphicsRuntime.reason}
        />
      ) : (
        <Canvas
          shadows="percentage"
          camera={{ position: [12, 10, 12], fov: 45 }}
          gl={engineeringRendererFactory}
          onPointerMissed={() => {
            if (viewportTool === "select") onClearSelection?.();
          }}
        >
          <color attach="background" args={["#020817"]} />
          <ambientLight intensity={0.58} />
          <directionalLight
            position={[10, 14, 10]}
            intensity={1.15}
            castShadow
          />
          {/* 本地 HDR:preset 会在运行时拉外网 CDN,离线/内网环境抓取失败会
              炸掉整个查看器(error boundary),必须用本地静态资源 */}
          <Environment files="/hdr/potsdamer_platz_1k.hdr" />
          <Grid
            infiniteGrid
            position={[0, 0, 0]}
            rotation={gridRotation}
            fadeDistance={80}
            sectionColor="#1f9f7a"
            cellColor="#1e293b"
          />
          <axesHelper args={[8]} />
          {group ? (
            <>
              <FitModelCamera group={group} upAxis={upAxis} nonce={fitNonce} />
              <group
                ref={modelTransformRef}
                position={[
                  viewTransform.offsetX,
                  viewTransform.offsetY,
                  viewTransform.offsetZ,
                ]}
                rotation={[
                  viewTransform.rotateX,
                  viewTransform.rotateY,
                  viewTransform.rotateZ,
                ]}
                scale={viewTransform.scale}
              >
                <primitive object={group} onClick={handleClick} />
                {selectionHighlightMode === "face" ? (
                  <SelectedMeshFacePatch
                    group={group}
                    selectedObjectUuid={selectedObjectUuid}
                    selectedFaceIndex={selectedFaceIndex}
                  />
                ) : null}
                {selectionHighlightMode === "material" ? (
                  <SelectedMeshBoundsOverlay
                    group={group}
                    selectedObjectUuid={selectedObjectUuid}
                  />
                ) : null}
                <ModelViewportMeasurementLayer
                  measurements={measurements}
                  measureStart={measureStart}
                  pendingGuideLength={modelMoveStep * 0.45}
                  worldUnitsToMillimeters={worldUnitsToMillimeters}
                />
                <ModelViewportCoordinateProbeLayer
                  probe={coordinateProbe}
                  worldUnitsToMillimeters={worldUnitsToMillimeters}
                />
                <ModelViewportCloudAnnotationLayer
                  annotations={cloudAnnotations}
                  editableId={cloudAnnotations.at(-1)?.id ?? null}
                  onMoveLatest={nudgeLatestCloudAnnotation}
                  onResizeLatest={resizeLatestCloudAnnotation}
                  onShapeLatest={adjustLatestCloudShape}
                />
                <ModelViewportSectionClipper
                  group={group}
                  active={sectionActive}
                  upAxis={upAxis}
                />
              </group>
            </>
          ) : null}
          <ModelViewportWalkControls
            active={viewportTool === "walk"}
            moveStep={modelMoveStep}
          />
          <OrbitControls
            makeDefault
            enabled={viewportTool !== "walk"}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.55}
            panSpeed={1.45}
            zoomSpeed={0.85}
            target={orbitTarget}
          />
        </Canvas>
      )}
      <ModelViewportToolStatusPanel
        tool={viewportTool}
        measurements={measurements}
        measureStart={measureStart}
        coordinateProbe={coordinateProbe}
        worldUnitsToMillimeters={worldUnitsToMillimeters}
        latestCloud={cloudAnnotations.at(-1) ?? null}
        cloudCount={cloudAnnotations.length}
        sectionActive={sectionActive}
        onClear={() => dispatchModelViewportCommand("clear:overlays")}
        onNudgeCloud={nudgeLatestCloudAnnotation}
        onResizeCloud={resizeLatestCloudAnnotation}
        onAdjustCloudShape={adjustLatestCloudShape}
        onDeleteCloud={deleteLatestCloudAnnotation}
      />
    </section>
  );
}

let modelViewportOverlaySequence = 0;

function nextModelViewportOverlayId(prefix: string): string {
  modelViewportOverlaySequence += 1;
  return `${prefix}-${modelViewportOverlaySequence}`;
}

function modelViewportPickFromEvent(
  event: ThreeEvent<MouseEvent>,
  mesh: Mesh | null,
  expressID: number | null,
  viewportRoot: Object3D | null,
  snapTolerance: number,
): ModelViewportPick {
  const localPoint = modelViewportLocalPoint(event.point, viewportRoot);
  const snapPoint = modelViewportSnappedPointFromEvent(
    event,
    mesh,
    viewportRoot,
    localPoint,
    snapTolerance,
  );
  return {
    point: snapPoint.point,
    objectName: readableEngineeringText(
      mesh?.name || event.object.name || "",
      expressID ? `#${expressID}` : "模型图元",
    ),
    expressID,
    faceIndex: event.faceIndex ?? null,
    snapKind: snapPoint.snapKind,
  };
}

function modelViewportLocalPoint(
  point: Vector3,
  viewportRoot: Object3D | null,
) {
  if (!viewportRoot) return point.clone();
  viewportRoot.updateWorldMatrix(true, false);
  return viewportRoot.worldToLocal(point.clone());
}

function modelViewportSnappedPointFromEvent(
  event: ThreeEvent<MouseEvent>,
  mesh: Mesh | null,
  viewportRoot: Object3D | null,
  localPoint: Vector3,
  snapTolerance: number,
): {
  point: Vector3;
  snapKind: ModelViewportPick["snapKind"];
} {
  if (!mesh || event.faceIndex === undefined || event.faceIndex === null) {
    return { point: localPoint, snapKind: "surface" };
  }
  const candidates = modelViewportFaceVertexWorldPoints(mesh, event.faceIndex);
  if (!candidates.length) {
    return { point: localPoint, snapKind: "surface" };
  }

  let bestPoint: Vector3 | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate) => {
    const distance = candidate.distanceTo(event.point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
    }
  });

  if (!bestPoint || bestDistance > snapTolerance) {
    return { point: localPoint, snapKind: "surface" };
  }

  return {
    point: modelViewportLocalPoint(bestPoint, viewportRoot),
    snapKind: "vertex",
  };
}

function modelViewportFaceVertexWorldPoints(
  mesh: Mesh,
  faceIndex: number,
): Vector3[] {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  if (!position) return [];
  const index = geometry.index;
  const triangleStart = faceIndex * 3;
  const vertexIndices = index
    ? [
        index.getX(triangleStart),
        index.getX(triangleStart + 1),
        index.getX(triangleStart + 2),
      ]
    : [triangleStart, triangleStart + 1, triangleStart + 2];
  return vertexIndices
    .filter((vertexIndex) => vertexIndex >= 0 && vertexIndex < position.count)
    .map((vertexIndex) =>
      new Vector3()
        .fromBufferAttribute(position, vertexIndex)
        .applyMatrix4(mesh.matrixWorld),
    );
}

function modelViewportSnapTolerance(
  group: Group | null,
  worldUnitsToMillimeters: number | null,
): number {
  const box = modelDisplayBox(group);
  const size = box.isEmpty()
    ? new Vector3(1, 1, 1)
    : box.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const maxTolerance = maxDimension * 0.03;
  if (
    worldUnitsToMillimeters !== null &&
    Number.isFinite(worldUnitsToMillimeters) &&
    worldUnitsToMillimeters > 0
  ) {
    return clampNumber(80 / worldUnitsToMillimeters, 0.001, maxTolerance);
  }
  return clampNumber(maxDimension * 0.01, 0.01, maxTolerance);
}

function modelViewportMeasurementFromPicks(
  start: ModelViewportPick,
  end: ModelViewportPick,
): ModelViewportMeasurement {
  const distance = start.point.distanceTo(end.point);
  return {
    id: nextModelViewportOverlayId("measure"),
    start: start.point.clone(),
    end: end.point.clone(),
    startLabel: modelViewportPickLabel(start),
    endLabel: modelViewportPickLabel(end),
    distance,
    source: "points",
  };
}

function modelViewportCoordinateProbeFromPick(
  pick: ModelViewportPick,
): ModelViewportCoordinateProbe {
  return {
    id: nextModelViewportOverlayId("coord"),
    point: pick.point.clone(),
    label: modelViewportPickLabel(pick),
  };
}

function modelViewportCloudAnnotationFromPick(
  pick: ModelViewportPick,
  normal: Vector3,
  radius: number,
): ModelViewportCloudAnnotation {
  const safeNormal = normal.clone().normalize();
  if (safeNormal.lengthSq() <= 1e-8) safeNormal.set(0, 0, 1);
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const shape = defaultModelViewportCloudShape();
  return {
    id: nextModelViewportOverlayId("cloud"),
    center: pick.point.clone(),
    normal: safeNormal,
    radius: safeRadius,
    shape,
    points: buildRevisionCloudPoints(
      pick.point,
      safeNormal,
      safeRadius,
      72,
      shape,
    ),
    label: `云线 ${modelViewportPickLabel(pick)}`,
  };
}

function modelViewportCloudAnnotationWithCenter(
  annotation: ModelViewportCloudAnnotation,
  center: Vector3,
): ModelViewportCloudAnnotation {
  return {
    ...annotation,
    center,
    points: buildRevisionCloudPoints(
      center,
      annotation.normal,
      annotation.radius,
      72,
      annotation.shape,
    ),
  };
}

function modelViewportCloudAnnotationWithRadius(
  annotation: ModelViewportCloudAnnotation,
  radius: number,
  group: Group | null,
): ModelViewportCloudAnnotation {
  const safeRadius = modelViewportSafeCloudRadius(radius, group);
  return {
    ...annotation,
    radius: safeRadius,
    points: buildRevisionCloudPoints(
      annotation.center,
      annotation.normal,
      safeRadius,
      72,
      annotation.shape,
    ),
  };
}

function modelViewportCloudAnnotationWithShape(
  annotation: ModelViewportCloudAnnotation,
  patch: Partial<ModelViewportCloudShape>,
): ModelViewportCloudAnnotation {
  const shape = normalizeModelViewportCloudShape({
    ...annotation.shape,
    ...patch,
  });
  return {
    ...annotation,
    shape,
    points: buildRevisionCloudPoints(
      annotation.center,
      annotation.normal,
      annotation.radius,
      72,
      shape,
    ),
  };
}

function modelViewportSafeCloudRadius(
  radius: number,
  group: Group | null,
): number {
  const box = modelDisplayBox(group);
  const size = box.isEmpty()
    ? new Vector3(1, 1, 1)
    : box.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  return clampNumber(radius, maxDimension * 0.003, maxDimension * 0.5);
}

function modelViewportPickLabel(pick: ModelViewportPick): string {
  if (pick.expressID) return `${pick.objectName} #${pick.expressID}`;
  if (pick.faceIndex !== null)
    return `${pick.objectName} face ${pick.faceIndex}`;
  return pick.objectName;
}

function modelViewportNormalFromEvent(
  event: ThreeEvent<MouseEvent>,
  mesh: Mesh | null,
  viewportRoot: Object3D | null,
): Vector3 {
  const faceNormal = event.face?.normal;
  if (faceNormal && mesh) {
    return modelViewportLocalDirection(
      faceNormal.clone().transformDirection(mesh.matrixWorld).normalize(),
      event.point,
      viewportRoot,
    );
  }
  const camera = event.camera as Camera | undefined;
  if (camera) {
    return modelViewportLocalDirection(
      camera.getWorldDirection(new Vector3()).multiplyScalar(-1).normalize(),
      event.point,
      viewportRoot,
    );
  }
  return new Vector3(0, 0, 1);
}

function modelViewportLocalDirection(
  worldDirection: Vector3,
  worldOrigin: Vector3,
  viewportRoot: Object3D | null,
): Vector3 {
  if (!viewportRoot) return worldDirection.clone().normalize();
  const localOrigin = modelViewportLocalPoint(worldOrigin, viewportRoot);
  const localEndpoint = modelViewportLocalPoint(
    worldOrigin.clone().add(worldDirection),
    viewportRoot,
  );
  return localEndpoint.sub(localOrigin).normalize();
}

function modelRevisionCloudRadius(group: Group | null): number {
  const box = modelDisplayBox(group);
  if (box.isEmpty()) return 1;
  const size = box.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) return 1;
  return clampNumber(
    maxDimension * 0.035,
    maxDimension * 0.006,
    maxDimension * 0.12,
  );
}

export function buildRevisionCloudPoints(
  center: Vector3,
  normal: Vector3,
  radius: number,
  segments = 72,
  shape: Partial<ModelViewportCloudShape> = defaultModelViewportCloudShape(),
): Vector3[] {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const safeSegments = Math.max(16, Math.floor(segments));
  const safeShape = normalizeModelViewportCloudShape(shape);
  const { tangent, bitangent } = modelViewportCloudPlaneAxes(
    normal,
    safeShape.rotation,
  );
  const points: Vector3[] = [];
  for (let index = 0; index <= safeSegments; index += 1) {
    const angle = (Math.PI * 2 * index) / safeSegments;
    const scallop =
      1 +
      Math.sin(angle * safeShape.scallopCount + Math.PI / 3) *
        safeShape.scallopAmplitude;
    points.push(
      center
        .clone()
        .addScaledVector(
          tangent,
          Math.cos(angle) * safeRadius * safeShape.aspectRatio * scallop,
        )
        .addScaledVector(bitangent, Math.sin(angle) * safeRadius * scallop),
    );
  }
  return points;
}

function modelViewportCloudPlaneAxes(
  normal: Vector3,
  rotation: number,
): { normal: Vector3; tangent: Vector3; bitangent: Vector3 } {
  const planeNormal = normal.clone().normalize();
  if (planeNormal.lengthSq() <= 1e-8) planeNormal.set(0, 0, 1);
  const reference =
    Math.abs(planeNormal.z) > 0.86
      ? new Vector3(0, 1, 0)
      : new Vector3(0, 0, 1);
  const tangent = new Vector3()
    .crossVectors(reference, planeNormal)
    .normalize();
  const bitangent = new Vector3()
    .crossVectors(planeNormal, tangent)
    .normalize();
  const safeRotation = normalizeRadians(rotation);
  const rotatedTangent = tangent
    .clone()
    .multiplyScalar(Math.cos(safeRotation))
    .add(bitangent.clone().multiplyScalar(Math.sin(safeRotation)))
    .normalize();
  const rotatedBitangent = new Vector3()
    .crossVectors(planeNormal, rotatedTangent)
    .normalize();
  return {
    normal: planeNormal,
    tangent: rotatedTangent,
    bitangent: rotatedBitangent,
  };
}

function defaultModelViewportCloudShape(): ModelViewportCloudShape {
  return {
    aspectRatio: 1,
    scallopCount: 12,
    scallopAmplitude: 0.16,
    rotation: 0,
  };
}

function normalizeModelViewportCloudShape(
  shape: Partial<ModelViewportCloudShape>,
): ModelViewportCloudShape {
  const defaults = defaultModelViewportCloudShape();
  return {
    aspectRatio: clampNumber(
      shape.aspectRatio ?? defaults.aspectRatio,
      0.35,
      2.5,
    ),
    scallopCount: Math.round(
      clampNumber(shape.scallopCount ?? defaults.scallopCount, 6, 28),
    ),
    scallopAmplitude: clampNumber(
      shape.scallopAmplitude ?? defaults.scallopAmplitude,
      0.02,
      0.35,
    ),
    rotation: normalizeRadians(shape.rotation ?? defaults.rotation),
  };
}

function normalizeRadians(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const full = Math.PI * 2;
  return ((value % full) + full) % full;
}

function ModelViewportMeasurementLayer({
  measurements,
  measureStart,
  pendingGuideLength,
  worldUnitsToMillimeters,
}: {
  measurements: ModelViewportMeasurement[];
  measureStart: ModelViewportPick | null;
  pendingGuideLength: number;
  worldUnitsToMillimeters: number | null;
}) {
  return (
    <>
      {measureStart ? (
        <ModelViewportPendingMeasureGuide
          point={measureStart.point}
          length={pendingGuideLength}
        />
      ) : null}
      {measurements.map((measurement) => {
        return (
          <ModelViewportDimensionMeasurement
            key={measurement.id}
            measurement={measurement}
            worldUnitsToMillimeters={worldUnitsToMillimeters}
          />
        );
      })}
    </>
  );
}

function ModelViewportPendingMeasureGuide({
  point,
  length,
}: {
  point: Vector3;
  length: number;
}) {
  const guide = buildViewportPendingMeasureGuidePoints(point, length);

  return (
    <group>
      <ModelViewportPolyline
        points={[guide.start, guide.end]}
        color="#facc15"
        opacity={1}
      />
      <ModelViewportPolyline
        points={[point, guide.tick]}
        color="#facc15"
        opacity={1}
      />
      <ModelViewportAnnotationLabel
        position={guide.end}
        tone="measure"
        offsetY={-10}
      >
        起点
      </ModelViewportAnnotationLabel>
    </group>
  );
}

export function buildViewportPendingMeasureGuidePoints(
  point: Vector3,
  length: number,
): { start: Vector3; end: Vector3; tick: Vector3 } {
  const safeLength = Number.isFinite(length) && length > 0 ? length : 1;
  const half = safeLength * 0.5;
  return {
    start: point.clone().add(new Vector3(0, 0, -half)),
    end: point.clone().add(new Vector3(0, 0, half)),
    tick: point.clone().add(new Vector3(safeLength * 0.28, 0, 0)),
  };
}

function ModelViewportDimensionMeasurement({
  measurement,
  worldUnitsToMillimeters,
}: {
  measurement: ModelViewportMeasurement;
  worldUnitsToMillimeters: number | null;
}) {
  const guide = buildViewportDimensionGuidePoints(
    measurement.start,
    measurement.end,
  );
  if (!guide) return null;

  return (
    <group>
      <ModelViewportPolyline
        points={[measurement.start, measurement.end]}
        color="#38bdf8"
        opacity={0.28}
      />
      <ModelViewportPolyline
        points={[measurement.start, guide.start]}
        color="#facc15"
        opacity={0.98}
      />
      <ModelViewportPolyline
        points={[measurement.end, guide.end]}
        color="#facc15"
        opacity={0.98}
      />
      <ModelViewportPolyline
        points={[guide.start, guide.end]}
        color="#facc15"
        opacity={1}
      />
      <ModelViewportAnnotationLabel position={guide.label} tone="measure">
        {formatViewportDistance(measurement.distance, worldUnitsToMillimeters)}
      </ModelViewportAnnotationLabel>
    </group>
  );
}

export function buildViewportDimensionGuidePoints(
  start: Vector3,
  end: Vector3,
): { start: Vector3; end: Vector3; label: Vector3; offset: Vector3 } | null {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (!Number.isFinite(length) || length <= 1e-9) return null;
  direction.normalize();
  const upReference =
    Math.abs(direction.dot(new Vector3(0, 0, 1))) > 0.86
      ? new Vector3(0, 1, 0)
      : new Vector3(0, 0, 1);
  const offsetDirection = new Vector3()
    .crossVectors(direction, upReference)
    .normalize();
  if (offsetDirection.lengthSq() <= 1e-8) offsetDirection.set(1, 0, 0);
  const offset = offsetDirection.multiplyScalar(
    clampNumber(length * 0.08, length * 0.035, length * 0.18),
  );
  const dimensionStart = start.clone().add(offset);
  const dimensionEnd = end.clone().add(offset);
  const label = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);
  return {
    start: dimensionStart,
    end: dimensionEnd,
    label,
    offset,
  };
}

function ModelViewportCoordinateProbeLayer({
  probe,
  worldUnitsToMillimeters,
}: {
  probe: ModelViewportCoordinateProbe | null;
  worldUnitsToMillimeters: number | null;
}) {
  if (!probe) return null;
  return (
    <group>
      <ModelViewportPointMarker point={probe.point} color="#f59e0b" />
      <ModelViewportAnnotationLabel
        position={probe.point}
        tone="coordinate"
        offsetX={12}
        offsetY={-12}
      >
        {formatViewportPoint(probe.point, worldUnitsToMillimeters)}
      </ModelViewportAnnotationLabel>
    </group>
  );
}

function ModelViewportCloudAnnotationLayer({
  annotations,
  editableId,
  onMoveLatest,
  onResizeLatest,
  onShapeLatest,
}: {
  annotations: ModelViewportCloudAnnotation[];
  editableId: string | null;
  onMoveLatest: (delta: Vector3) => void;
  onResizeLatest: (factor: number) => void;
  onShapeLatest: (patch: Partial<ModelViewportCloudShape>) => void;
}) {
  return (
    <>
      {annotations.map((annotation) => {
        const editable = annotation.id === editableId;
        return (
          <group key={annotation.id}>
            <ModelViewportPolyline
              points={annotation.points}
              color={editable ? "#fb7185" : "#fda4af"}
              opacity={editable ? 1 : 0.72}
            />
            {editable ? (
              <ModelViewportCloudEditHandles
                annotation={annotation}
                onMove={onMoveLatest}
                onResize={onResizeLatest}
                onShape={onShapeLatest}
              />
            ) : null}
          </group>
        );
      })}
    </>
  );
}

type ModelViewportCloudDragMode = "move" | "resize" | "stretch-x" | "stretch-y";

interface ModelViewportCloudDragState {
  mode: ModelViewportCloudDragMode;
  directionX: number;
  directionY: number;
}

function ModelViewportCloudEditHandles({
  annotation,
  onMove,
  onResize,
  onShape,
}: {
  annotation: ModelViewportCloudAnnotation;
  onMove: (delta: Vector3) => void;
  onResize: (factor: number) => void;
  onShape: (patch: Partial<ModelViewportCloudShape>) => void;
}) {
  const dragStateRef = useRef<ModelViewportCloudDragState | null>(null);
  const shape = normalizeModelViewportCloudShape(annotation.shape);
  const axes = modelViewportCloudPlaneAxes(annotation.normal, shape.rotation);
  const xRadius = annotation.radius * shape.aspectRatio;
  const yRadius = annotation.radius;
  const handles: Array<{
    id: string;
    mode: ModelViewportCloudDragMode;
    position: Vector3;
    label: string;
    className: string;
    directionX?: number;
    directionY?: number;
  }> = [
    {
      id: "move",
      mode: "move",
      position: annotation.center,
      label: "拖动移动云线",
      className: "h-3.5 w-3.5 rounded-full bg-rose-400",
    },
    {
      id: "east",
      mode: "stretch-x",
      position: annotation.center
        .clone()
        .addScaledVector(axes.tangent, xRadius),
      label: "拖动水平拉伸云线",
      className: "h-3 w-4 rounded-sm bg-rose-950",
      directionX: 1,
    },
    {
      id: "west",
      mode: "stretch-x",
      position: annotation.center
        .clone()
        .addScaledVector(axes.tangent, -xRadius),
      label: "拖动水平拉伸云线",
      className: "h-3 w-4 rounded-sm bg-rose-950",
      directionX: -1,
    },
    {
      id: "north",
      mode: "stretch-y",
      position: annotation.center
        .clone()
        .addScaledVector(axes.bitangent, yRadius),
      label: "拖动垂直拉伸云线",
      className: "h-4 w-3 rounded-sm bg-rose-950",
      directionY: 1,
    },
    {
      id: "south",
      mode: "stretch-y",
      position: annotation.center
        .clone()
        .addScaledVector(axes.bitangent, -yRadius),
      label: "拖动垂直拉伸云线",
      className: "h-4 w-3 rounded-sm bg-rose-950",
      directionY: -1,
    },
    {
      id: "ne",
      mode: "resize",
      position: annotation.center
        .clone()
        .addScaledVector(axes.tangent, xRadius)
        .addScaledVector(axes.bitangent, yRadius),
      label: "拖动缩放云线",
      className: "h-3.5 w-3.5 rounded-sm bg-rose-500",
      directionX: 1,
      directionY: 1,
    },
    {
      id: "nw",
      mode: "resize",
      position: annotation.center
        .clone()
        .addScaledVector(axes.tangent, -xRadius)
        .addScaledVector(axes.bitangent, yRadius),
      label: "拖动缩放云线",
      className: "h-3.5 w-3.5 rounded-sm bg-rose-500",
      directionX: -1,
      directionY: 1,
    },
    {
      id: "se",
      mode: "resize",
      position: annotation.center
        .clone()
        .addScaledVector(axes.tangent, xRadius)
        .addScaledVector(axes.bitangent, -yRadius),
      label: "拖动缩放云线",
      className: "h-3.5 w-3.5 rounded-sm bg-rose-500",
      directionX: 1,
      directionY: -1,
    },
    {
      id: "sw",
      mode: "resize",
      position: annotation.center
        .clone()
        .addScaledVector(axes.tangent, -xRadius)
        .addScaledVector(axes.bitangent, -yRadius),
      label: "拖动缩放云线",
      className: "h-3.5 w-3.5 rounded-sm bg-rose-500",
      directionX: -1,
      directionY: -1,
    },
  ];

  const handleDragStart = (
    handle: (typeof handles)[number],
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    dragStateRef.current = {
      mode: handle.mode,
      directionX: handle.directionX ?? 1,
      directionY: handle.directionY ?? 1,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    event.preventDefault();
    event.stopPropagation();
    if (dragState.mode === "move") {
      const step = Math.max(annotation.radius / 120, 0.002);
      onMove(
        axes.tangent
          .clone()
          .multiplyScalar(event.movementX * step)
          .addScaledVector(axes.bitangent, -event.movementY * step),
      );
      return;
    }
    if (dragState.mode === "stretch-x") {
      const factor = clampNumber(
        1 + event.movementX * dragState.directionX * 0.01,
        0.82,
        1.22,
      );
      onShape({ aspectRatio: shape.aspectRatio * factor });
      return;
    }
    if (dragState.mode === "stretch-y") {
      const factor = clampNumber(
        1 - event.movementY * dragState.directionY * 0.01,
        0.82,
        1.22,
      );
      onResize(factor);
      onShape({ aspectRatio: shape.aspectRatio / factor });
      return;
    }
    const factor = clampNumber(
      1 +
        (event.movementX * dragState.directionX -
          event.movementY * dragState.directionY) *
          0.006,
      0.82,
      1.22,
    );
    onResize(factor);
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      {handles.map((handle) => (
        <Html
          key={handle.id}
          position={handle.position}
          center
          style={{ pointerEvents: "auto" }}
        >
          <button
            type="button"
            aria-label={handle.label}
            title={handle.label}
            className={`${handle.className} border border-white shadow-[0_0_0_2px_rgba(15,23,42,0.75),0_0_10px_rgba(244,63,94,0.55)]`}
            onPointerDown={(event) => handleDragStart(handle, event)}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          />
        </Html>
      ))}
    </>
  );
}

function ModelViewportAnnotationLabel({
  position,
  tone,
  offsetX = 0,
  offsetY = -16,
  children,
}: {
  position: Vector3;
  tone: "measure" | "coordinate" | "cloud";
  offsetX?: number;
  offsetY?: number;
  children: ReactNode;
}) {
  const toneClass =
    tone === "measure"
      ? "border-sky-300/55 bg-slate-950/78 text-sky-100"
      : tone === "coordinate"
        ? "border-amber-300/55 bg-slate-950/76 text-amber-100"
        : "border-rose-300/55 bg-slate-950/74 text-rose-100";
  const lineClass =
    tone === "measure"
      ? "bg-sky-300/50"
      : tone === "coordinate"
        ? "bg-amber-300/50"
        : "bg-rose-300/50";
  const transform = `translate(calc(-50% + ${offsetX}px), calc(-100% + ${offsetY}px))`;

  return (
    <Html position={position} style={{ pointerEvents: "none" }}>
      <span
        className={`relative inline-flex max-w-[360px] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] leading-4 shadow-md backdrop-blur-[1px] ${toneClass}`}
        style={{ transform }}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {children}
        </span>
        <span
          aria-hidden
          className={`absolute left-1/2 top-full h-3 w-px -translate-x-1/2 ${lineClass}`}
        />
      </span>
    </Html>
  );
}

function ModelViewportPointMarker({
  point,
  color,
}: {
  point: Vector3;
  color: string;
}) {
  return (
    <Html position={point} center style={{ pointerEvents: "none" }}>
      <span
        aria-hidden
        className="block h-2 w-2 rounded-full border border-white/80 shadow-[0_0_0_2px_rgba(15,23,42,0.75),0_0_10px_rgba(56,189,248,0.85)]"
        style={{ backgroundColor: color }}
      />
    </Html>
  );
}

function ModelViewportPolyline({
  points,
  color,
  opacity,
}: {
  points: Vector3[];
  color: string;
  opacity: number;
}) {
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints(points);
    const material = new LineBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity,
      toneMapped: false,
    });
    const object = new Line(geometry, material);
    object.renderOrder = 88;
    object.raycast = () => null;
    return object;
  }, [color, opacity, points]);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      const material = line.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    };
  }, [line]);

  return <primitive object={line} />;
}

function ModelViewportSectionClipper({
  group,
  active,
  upAxis,
}: {
  group: Group | null;
  active: boolean;
  upAxis: ModelUpAxis;
}) {
  const section = useMemo(() => {
    if (!group) return null;
    const box = modelDisplayBox(group);
    if (box.isEmpty()) return null;
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const dimension = Math.max(size.x, size.y, size.z, 1) * 1.35;
    const normal =
      upAxis === "z" ? new Vector3(0, 0, -1) : new Vector3(0, -1, 0);
    return {
      center,
      dimension,
      normal,
      rotation: upAxis === "z" ? [0, 0, 0] : [Math.PI / 2, 0, 0],
      plane: new Plane().setFromNormalAndCoplanarPoint(normal, center),
    };
  }, [group, upAxis]);

  useEffect(() => {
    if (!active || !group || !section) return;
    type ClippableMaterial = Material & {
      clippingPlanes: Plane[] | null | undefined;
      clipIntersection: boolean | undefined;
      clipShadows: boolean | undefined;
    };
    const touched: Array<{
      material: ClippableMaterial;
      clippingPlanes: Plane[] | null | undefined;
      clipIntersection: boolean | undefined;
      clipShadows: boolean | undefined;
    }> = [];

    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshMaterialList(object).forEach((material) => {
        const clipMaterial = material as ClippableMaterial;
        touched.push({
          material: clipMaterial,
          clippingPlanes: clipMaterial.clippingPlanes ?? null,
          clipIntersection: clipMaterial.clipIntersection,
          clipShadows: clipMaterial.clipShadows,
        });
        clipMaterial.clippingPlanes = [section.plane];
        clipMaterial.clipIntersection = false;
        clipMaterial.clipShadows = true;
        clipMaterial.needsUpdate = true;
      });
    });

    return () => {
      touched.forEach((entry) => {
        if (entry.clippingPlanes === undefined) {
          delete (entry.material as { clippingPlanes?: Plane[] | null })
            .clippingPlanes;
        } else {
          entry.material.clippingPlanes = entry.clippingPlanes;
        }
        if (entry.clipIntersection === undefined) {
          delete (entry.material as { clipIntersection?: boolean })
            .clipIntersection;
        } else {
          entry.material.clipIntersection = entry.clipIntersection;
        }
        if (entry.clipShadows === undefined) {
          delete (entry.material as { clipShadows?: boolean }).clipShadows;
        } else {
          entry.material.clipShadows = entry.clipShadows;
        }
        entry.material.needsUpdate = true;
      });
    };
  }, [active, group, section]);

  if (!active || !section) return null;
  return (
    <mesh
      position={[section.center.x, section.center.y, section.center.z]}
      rotation={section.rotation as [number, number, number]}
      renderOrder={70}
    >
      <planeGeometry args={[section.dimension, section.dimension]} />
      <meshBasicMaterial
        color="#0ea5e9"
        transparent
        opacity={0.16}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function ModelViewportWalkControls({
  active,
  moveStep,
}: {
  active: boolean;
  moveStep: number;
}) {
  const { camera, gl } = useThree();
  const keysRef = useRef(new Set<string>());
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      keysRef.current.clear();
      draggingRef.current = false;
      return;
    }
    setWalkCameraRotationOrder(camera);
    const keys = keysRef.current;
    const canvas = gl.domElement;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (modelWalkControlKeys.has(key)) {
        event.preventDefault();
        keys.add(key);
      }
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      draggingRef.current = true;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.style.cursor = "crosshair";
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      rotateWalkCamera(camera, event.movementX, event.movementY);
    };
    const handlePointerUp = (event: PointerEvent) => {
      draggingRef.current = false;
      canvas.releasePointerCapture?.(event.pointerId);
      canvas.style.cursor = "";
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    return () => {
      keys.clear();
      draggingRef.current = false;
      canvas.style.cursor = "";
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
    };
  }, [active, camera, gl]);

  useFrame((_, delta) => {
    if (!active) return;
    advanceWalkCamera(camera, keysRef.current, moveStep, delta);
  });

  return null;
}

function setWalkCameraRotationOrder(camera: Camera) {
  camera.rotation.order = "YXZ";
}

function rotateWalkCamera(
  camera: Camera,
  movementX: number,
  movementY: number,
) {
  setWalkCameraRotationOrder(camera);
  camera.rotation.y -= movementX * 0.0022;
  camera.rotation.x = clampNumber(
    camera.rotation.x - movementY * 0.0022,
    -Math.PI / 2 + 0.04,
    Math.PI / 2 - 0.04,
  );
}

function advanceWalkCamera(
  camera: Camera,
  keys: ReadonlySet<string>,
  moveStep: number,
  delta: number,
) {
  const speed = Math.max(moveStep, 1) * (keys.has("shift") ? 2.2 : 0.8);
  const step = speed * Math.min(delta, 0.08);
  const forward = camera.getWorldDirection(new Vector3()).normalize();
  const right = new Vector3().crossVectors(forward, camera.up).normalize();
  const up = camera.up.clone().normalize();
  if (keys.has("w") || keys.has("arrowup")) {
    camera.position.addScaledVector(forward, step);
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    camera.position.addScaledVector(forward, -step);
  }
  if (keys.has("d") || keys.has("arrowright")) {
    camera.position.addScaledVector(right, step);
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    camera.position.addScaledVector(right, -step);
  }
  if (keys.has("q")) camera.position.addScaledVector(up, -step);
  if (keys.has("e")) camera.position.addScaledVector(up, step);
  camera.updateMatrixWorld();
}

const modelWalkControlKeys = new Set([
  "w",
  "a",
  "s",
  "d",
  "q",
  "e",
  "shift",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

function handleCloudAnnotationKeyDown(
  event: KeyboardEvent<HTMLElement>,
  hasCloud: boolean,
  modelMoveStep: number,
  onNudgeCloud: (delta: Vector3) => void,
  onResizeCloud: (factor: number) => void,
  onDeleteCloud: () => void,
): boolean {
  if (!hasCloud) return false;
  const step = modelViewportCloudNudgeStep(modelMoveStep);
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    onNudgeCloud(new Vector3(-step, 0, 0));
    return true;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    onNudgeCloud(new Vector3(step, 0, 0));
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    onNudgeCloud(new Vector3(0, step, 0));
    return true;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    onNudgeCloud(new Vector3(0, -step, 0));
    return true;
  }
  if (event.key === "PageUp") {
    event.preventDefault();
    onNudgeCloud(new Vector3(0, 0, step));
    return true;
  }
  if (event.key === "PageDown") {
    event.preventDefault();
    onNudgeCloud(new Vector3(0, 0, -step));
    return true;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    onResizeCloud(1.12);
    return true;
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    onResizeCloud(1 / 1.12);
    return true;
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    onDeleteCloud();
    return true;
  }
  return false;
}

function modelViewportCloudNudgeStep(modelMoveStep: number): number {
  return Math.max(modelMoveStep * 0.18, 0.01);
}

function ModelViewportToolStatusPanel({
  tool,
  measurements,
  measureStart,
  coordinateProbe,
  worldUnitsToMillimeters,
  latestCloud,
  cloudCount,
  sectionActive,
  onClear,
  onNudgeCloud,
  onResizeCloud,
  onAdjustCloudShape,
  onDeleteCloud,
}: {
  tool: ModelViewportTool;
  measurements: ModelViewportMeasurement[];
  measureStart: ModelViewportPick | null;
  coordinateProbe: ModelViewportCoordinateProbe | null;
  worldUnitsToMillimeters: number | null;
  latestCloud: ModelViewportCloudAnnotation | null;
  cloudCount: number;
  sectionActive: boolean;
  onClear: () => void;
  onNudgeCloud: (delta: Vector3) => void;
  onResizeCloud: (factor: number) => void;
  onAdjustCloudShape: (patch: Partial<ModelViewportCloudShape>) => void;
  onDeleteCloud: () => void;
}) {
  const latestMeasure = measurements[measurements.length - 1] ?? null;
  const showPanel =
    tool !== "select" ||
    latestMeasure ||
    coordinateProbe ||
    cloudCount > 0 ||
    sectionActive;
  if (!showPanel) return null;
  const cloudStep = latestCloud ? Math.max(latestCloud.radius * 0.12, 0.01) : 0;

  return (
    <div className="viewer-floating-panel absolute bottom-3 left-3 z-20 flex max-w-xl flex-wrap items-center gap-2 rounded-md px-3 py-2 text-[11px] text-slate-100">
      <span className="whitespace-nowrap font-medium text-emerald-300">
        {engineeringWorkbenchToolLabels[tool]}
      </span>
      {measureStart ? (
        <span className="whitespace-nowrap font-mono text-sky-100">
          起点{" "}
          {formatViewportPoint(measureStart.point, worldUnitsToMillimeters)}
        </span>
      ) : null}
      {latestMeasure ? (
        <span className="whitespace-nowrap font-mono text-sky-100">
          测距{" "}
          {formatViewportDistance(
            latestMeasure.distance,
            worldUnitsToMillimeters,
          )}
        </span>
      ) : null}
      {coordinateProbe ? (
        <span className="whitespace-nowrap font-mono text-amber-100">
          {formatViewportPoint(coordinateProbe.point, worldUnitsToMillimeters)}
        </span>
      ) : null}
      {cloudCount > 0 ? (
        <span className="whitespace-nowrap text-rose-100">
          云线 {cloudCount}
          {latestCloud
            ? ` · 直径 ${formatViewportDistance(
                latestCloud.radius * 2,
                worldUnitsToMillimeters,
              )}`
            : ""}
        </span>
      ) : null}
      {latestCloud ? (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onNudgeCloud(new Vector3(-cloudStep, 0, 0))}
            title="云线向 X- 移动"
          >
            X-
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onNudgeCloud(new Vector3(cloudStep, 0, 0))}
            title="云线向 X+ 移动"
          >
            X+
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onNudgeCloud(new Vector3(0, -cloudStep, 0))}
            title="云线向 Y- 移动"
          >
            Y-
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onNudgeCloud(new Vector3(0, cloudStep, 0))}
            title="云线向 Y+ 移动"
          >
            Y+
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onNudgeCloud(new Vector3(0, 0, -cloudStep))}
            title="云线向 Z- 移动"
          >
            Z-
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onNudgeCloud(new Vector3(0, 0, cloudStep))}
            title="云线向 Z+ 移动"
          >
            Z+
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onResizeCloud(1 / 1.12)}
            title="缩小当前云线"
          >
            缩小
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() => onResizeCloud(1.12)}
            title="放大当前云线"
          >
            放大
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() =>
              onAdjustCloudShape({
                aspectRatio: latestCloud.shape.aspectRatio * 0.88,
              })
            }
            title="压窄当前云线"
          >
            窄
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() =>
              onAdjustCloudShape({
                aspectRatio: latestCloud.shape.aspectRatio * 1.12,
              })
            }
            title="拉宽当前云线"
          >
            宽
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() =>
              onAdjustCloudShape({
                scallopCount: latestCloud.shape.scallopCount - 2,
              })
            }
            title="减少云线波峰"
          >
            波-
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() =>
              onAdjustCloudShape({
                scallopCount: latestCloud.shape.scallopCount + 2,
              })
            }
            title="增加云线波峰"
          >
            波+
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={() =>
              onAdjustCloudShape({
                rotation: latestCloud.shape.rotation + Math.PI / 12,
              })
            }
            title="旋转当前云线"
          >
            旋转
          </button>
          <button
            type="button"
            className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
            onClick={onDeleteCloud}
            title="删除当前云线"
          >
            删除云线
          </button>
        </div>
      ) : null}
      {sectionActive ? (
        <span className="whitespace-nowrap text-cyan-100">剖切已启用</span>
      ) : null}
      <button
        type="button"
        className="viewer-ghost-tool rounded px-2 py-1 text-[10px]"
        onClick={onClear}
      >
        清除
      </button>
    </div>
  );
}

export function formatViewportDistance(distance: number): string;
export function formatViewportDistance(
  distance: number,
  worldUnitsToMillimeters: number | null,
): string;
export function formatViewportDistance(
  distance: number,
  worldUnitsToMillimeters: number | null = null,
): string {
  if (
    worldUnitsToMillimeters !== null &&
    Number.isFinite(worldUnitsToMillimeters) &&
    worldUnitsToMillimeters > 0
  ) {
    return formatLength(
      distance * worldUnitsToMillimeters,
      millimeterLengthUnit,
    );
  }
  return `${formatCoord(distance)} world`;
}

function formatViewportPoint(
  point: Vector3,
  worldUnitsToMillimeters: number | null,
): string {
  if (
    worldUnitsToMillimeters !== null &&
    Number.isFinite(worldUnitsToMillimeters) &&
    worldUnitsToMillimeters > 0
  ) {
    return `X ${formatLength(point.x * worldUnitsToMillimeters, millimeterLengthUnit)} / Y ${formatLength(
      point.y * worldUnitsToMillimeters,
      millimeterLengthUnit,
    )} / Z ${formatLength(
      point.z * worldUnitsToMillimeters,
      millimeterLengthUnit,
    )}`;
  }
  return `X ${formatCoord(point.x)} / Y ${formatCoord(point.y)} / Z ${formatCoord(point.z)} world`;
}

function modelViewportWorldUnitsToMillimeters(
  group: Group | null,
): number | null {
  if (!group) return null;
  const value = finiteNumberUserData(
    group.userData.worldUnitsToMillimeters,
    NaN,
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

function SelectedMeshBoundsOverlay({
  group,
  selectedObjectUuid,
}: {
  group: Group;
  selectedObjectUuid: string | null;
}) {
  const selectedObject = useMemo(
    () => findMeshByUuid(group, selectedObjectUuid),
    [group, selectedObjectUuid],
  );

  useEffect(() => {
    if (!selectedObject) return;

    selectedObject.geometry.computeBoundingBox();
    const localBounds = selectedObject.geometry.boundingBox?.clone();
    if (!localBounds || localBounds.isEmpty()) return;

    expandDegenerateSelectionBox(localBounds);
    const helper = new Box3Helper(
      localBounds,
      selectedEngineeringMeshColor.clone(),
    );
    helper.name = `${selectedObject.name || selectedObject.uuid} selection bounds`;
    helper.renderOrder = 60;
    helper.raycast = () => null;

    if (helper.material instanceof LineBasicMaterial) {
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = 0.96;
      helper.material.toneMapped = false;
      helper.material.needsUpdate = true;
    }

    selectedObject.add(helper);
    return () => {
      selectedObject.remove(helper);
      helper.geometry.dispose();
      if (Array.isArray(helper.material)) {
        helper.material.forEach((material) => material.dispose());
      } else {
        helper.material.dispose();
      }
    };
  }, [selectedObject]);

  return null;
}

function expandDegenerateSelectionBox(box: Box3): Box3 {
  const size = box.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const visiblePadding = Math.max(maxDimension * 0.006, 0.01);
  const outlinePadding = Math.max(maxDimension * 0.001, 0.002);
  box.expandByScalar(outlinePadding);
  if (Math.abs(size.x) <= 1e-6) {
    box.min.x -= visiblePadding;
    box.max.x += visiblePadding;
  }
  if (Math.abs(size.y) <= 1e-6) {
    box.min.y -= visiblePadding;
    box.max.y += visiblePadding;
  }
  if (Math.abs(size.z) <= 1e-6) {
    box.min.z -= visiblePadding;
    box.max.z += visiblePadding;
  }
  return box;
}

function SelectedMeshFacePatch({
  group,
  selectedObjectUuid,
  selectedFaceIndex,
}: {
  group: Group;
  selectedObjectUuid: string | null;
  selectedFaceIndex: number | null;
}) {
  const patch = useMemo(() => {
    const source = findMeshByUuid(group, selectedObjectUuid);
    if (!source || selectedFaceIndex === null || selectedFaceIndex < 0) {
      return null;
    }

    const triangleIndices = stlCoplanarFacePatchTriangleIndices(
      source.geometry,
      selectedFaceIndex,
    );
    if (!triangleIndices.length) return null;

    const geometry = cloneStlGeometryTriangles(
      source.geometry,
      triangleIndices,
    );
    geometry.computeVertexNormals();
    const material = new MeshBasicMaterial({
      color: selectedEngineeringMeshColor.clone(),
      side: DoubleSide,
      transparent: true,
      opacity: 0.96,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      toneMapped: false,
    });
    const object = new Mesh(geometry, material);
    object.name = `${source.name} selected patch`;
    object.matrix.copy(source.matrix);
    object.matrixAutoUpdate = false;
    object.renderOrder = 20;
    object.raycast = () => null;
    return object;
  }, [group, selectedFaceIndex, selectedObjectUuid]);

  useEffect(() => {
    return () => {
      if (!patch) return;
      patch.geometry.dispose();
      const material = patch.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    };
  }, [patch]);

  return patch ? <primitive object={patch} /> : null;
}

function useModelGraphicsRuntime(): ModelGraphicsRuntime {
  const [runtime, setRuntime] = useState<ModelGraphicsRuntime>({
    status: "checking",
    reason: "正在检测浏览器 GPU 能力。",
  });

  useEffect(() => {
    let cancelled = false;

    async function detectRuntime() {
      const webGpuFailure = await detectWebGpuFailureReason();
      if (!cancelled && !webGpuFailure) {
        setRuntime({
          status: "webgpu",
          reason:
            "WebGPU adapter 可用，工程模型视口使用 Three.js WebGPURenderer。",
        });
        return;
      }

      const webGlFailure = detectWebGlFailureReason();
      if (!cancelled && !webGlFailure) {
        setRuntime({
          status: "webgl",
          reason: webGpuFailure
            ? `${webGpuFailure} 已降级到 WebGL 硬件加速视口。`
            : "WebGL 硬件加速可用。",
        });
        return;
      }

      if (!cancelled) {
        setRuntime({
          status: "unavailable",
          reason: [webGpuFailure, webGlFailure].filter(Boolean).join(" "),
        });
      }
    }

    void detectRuntime();

    return () => {
      cancelled = true;
    };
  }, []);

  return runtime;
}

async function detectWebGpuFailureReason(): Promise<string | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "当前运行环境没有浏览器 window/navigator。";
  }
  if (!window.isSecureContext) {
    return "当前地址不是浏览器认可的安全来源；WebGPU 需要 localhost、HTTPS 或安全来源白名单。";
  }
  const gpu = (
    navigator as Navigator & {
      gpu?: {
        requestAdapter: () => Promise<GPUAdapter | null>;
      };
    }
  ).gpu;
  if (!gpu) {
    return "当前浏览器未暴露 navigator.gpu。";
  }
  try {
    const adapter = await gpu.requestAdapter();
    return adapter
      ? null
      : "navigator.gpu.requestAdapter() 没有返回可用 GPU adapter。";
  } catch (error) {
    return `WebGPU adapter 检测失败：${error instanceof Error ? error.message : String(error)}。`;
  }
}

function detectWebGlFailureReason(): string | null {
  if (typeof document === "undefined") {
    return "当前运行环境没有 document，无法创建 WebGL canvas。";
  }
  const canvas = document.createElement("canvas");
  try {
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return context ? null : "浏览器没有创建 WebGL/WebGL2 上下文。";
  } catch (error) {
    return `WebGL 上下文创建失败：${error instanceof Error ? error.message : String(error)}。`;
  }
}

function createEngineeringRendererFactory(
  runtime: ModelGraphicsRuntimeStatus,
): GLProps {
  return async function createEngineeringRenderer(
    defaultProps: unknown,
  ): Promise<EngineeringThreeRenderer> {
    const props = defaultProps as EngineeringGlProps;
    const canvas = engineeringCanvasParameter(props.canvas);

    if (runtime === "webgpu") {
      try {
        const { WebGPURenderer } = await import("three/webgpu");
        const Renderer = WebGPURenderer as unknown as new (
          parameters: Omit<EngineeringGlProps, "preserveDrawingBuffer">,
        ) => EngineeringThreeRenderer;
        const renderer = new Renderer({
          ...props,
          canvas,
          antialias: true,
        });
        enableRendererLocalClipping(renderer);
        await renderer.init?.();
        renderer.setClearColor?.("#020817", 1);
        annotateEngineeringCanvas(canvas, "three-webgpu");
        return renderer;
      } catch (error) {
        console.warn(
          "ArchIToken WebGPU renderer failed, falling back to WebGL renderer.",
          error,
        );
      }
    }

    const renderer = new WebGLRenderer({
      ...props,
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    }) as unknown as EngineeringThreeRenderer;
    enableRendererLocalClipping(renderer);
    renderer.setClearColor?.("#020817", 1);
    annotateEngineeringCanvas(
      canvas,
      runtime === "webgpu" ? "three-webgpu-failed-webgl" : "three-webgl",
    );
    return renderer;
  } as GLProps;
}

function enableRendererLocalClipping(renderer: EngineeringThreeRenderer) {
  (renderer as EngineeringThreeRenderer & { localClippingEnabled?: boolean })
    .localClippingEnabled = true;
}

function engineeringCanvasParameter(
  canvas: unknown,
): WebGLRendererParameters["canvas"] | undefined {
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    canvas instanceof HTMLCanvasElement
  ) {
    return canvas;
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    canvas instanceof OffscreenCanvas
  ) {
    return canvas as WebGLRendererParameters["canvas"];
  }
  return undefined;
}

function annotateEngineeringCanvas(
  canvas: WebGLRendererParameters["canvas"] | undefined,
  renderer: string,
) {
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    canvas instanceof HTMLCanvasElement
  ) {
    canvas.setAttribute("data-architoken-renderer", renderer);
  }
}

function modelGraphicsRuntimeLabel(runtime: ModelGraphicsRuntime): string {
  if (runtime.status === "webgpu") return "运行时 WebGPU 原生模型视口";
  if (runtime.status === "webgl") return "运行时 WebGL 硬件加速模型视口";
  if (runtime.status === "checking") return "运行时检测中";
  return "运行时 GPU 不可用，已进入受审计失败恢复";
}

function ModelRuntimeStatusPanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-950 p-4 text-slate-100">
      <section className="w-full max-w-xl rounded-md border border-slate-800 bg-slate-900/80 p-5">
        <p className="text-xs font-medium text-emerald-300">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{message}</p>
      </section>
    </div>
  );
}

function ModelSvgProjectionFallback({
  group,
  label,
  status,
  upAxis,
  viewTransform,
  reason,
}: {
  group: Group | null;
  label: string;
  status: string;
  upAxis: ModelUpAxis;
  viewTransform: ViewTransform;
  reason: string;
}) {
  const projection = useMemo(
    () => buildModelSvgProjection(group, upAxis),
    [group, upAxis],
  );

  if (!projection || projection.segments.length === 0) {
    return (
      <ModelRuntimeStatusPanel
        title="浏览器 GPU 视口不可用"
        message={`${reason} 模型没有可投影的 mesh 顶点，无法进入原生交互式模型视口。`}
      />
    );
  }

  const viewBox = projectionViewBoxForTransform(
    projection.viewBox,
    viewTransform,
  );
  const viewBoxValue = `${viewBox.minX} ${viewBox.minY} ${viewBox.maxX - viewBox.minX} ${viewBox.maxY - viewBox.minY}`;
  const sampled =
    projection.sampledTriangleCount < projection.triangleCount
      ? `${projection.sampledTriangleCount.toLocaleString()} / ${projection.triangleCount.toLocaleString()}`
      : projection.triangleCount.toLocaleString();

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950 text-slate-100">
      <svg
        className="h-full w-full"
        viewBox={viewBoxValue}
        role="img"
        aria-label={`${label} WebGL fallback projection`}
      >
        <rect
          x={viewBox.minX}
          y={viewBox.minY}
          width={viewBox.maxX - viewBox.minX}
          height={viewBox.maxY - viewBox.minY}
          fill="#020817"
        />
        <g opacity="0.9">
          {projection.segments.map((segment, index) => (
            <line
              key={`${index}-${segment.x1}-${segment.y1}`}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={segment.color}
              strokeWidth="1.15"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
      <section className="viewer-floating-panel absolute bottom-3 left-3 max-w-xl rounded-md px-4 py-3 text-xs text-slate-100">
        <p className="font-medium text-emerald-300">
          {status} · GPU 视口不可用，已启用源 mesh SVG 投影
        </p>
        <p className="mt-1 leading-5 text-slate-300">
          {reason} 这里不是原生模型交互视口，而是从真实源 mesh
          顶点生成的审计失败恢复视图。启用 WebGPU/WebGL
          后可恢复旋转、光照和构件点选。
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span>Mesh {projection.meshCount.toLocaleString()}</span>
          <span>三角面 {sampled}</span>
          <span>线段 {projection.segments.length.toLocaleString()}</span>
        </div>
      </section>
    </div>
  );
}

function projectionViewBoxForTransform(
  viewBox: Bounds2D,
  transform: ViewTransform,
): Bounds2D {
  const baseWidth = Math.max(viewBox.maxX - viewBox.minX, 1);
  const baseHeight = Math.max(viewBox.maxY - viewBox.minY, 1);
  const scale = clampNumber(transform.scale, 0.05, 50);
  const width = baseWidth / scale;
  const height = baseHeight / scale;
  const centerX = viewBox.minX + baseWidth / 2 - transform.offsetX;
  const centerY = viewBox.minY + baseHeight / 2 + transform.offsetY;
  return {
    minX: centerX - width / 2,
    minY: centerY - height / 2,
    maxX: centerX + width / 2,
    maxY: centerY + height / 2,
  };
}

function buildModelSvgProjection(
  group: Group | null,
  upAxis: ModelUpAxis,
): ModelSvgProjection | null {
  if (!group) return null;

  const meshes: Mesh[] = [];
  group.updateWorldMatrix(true, true);
  group.traverse((object) => {
    if (object instanceof Mesh && object.geometry) {
      meshes.push(object);
    }
  });
  if (meshes.length === 0) return null;

  const triangleCounts = meshes.map((mesh) => meshTriangleCount(mesh));
  const triangleCount = triangleCounts.reduce((sum, count) => sum + count, 0);
  if (triangleCount <= 0) return null;

  const maxTriangles = Math.max(
    1,
    Math.floor(modelSvgProjectionMaxSegments / 3),
  );
  const sampleEvery = Math.max(1, Math.ceil(triangleCount / maxTriangles));
  const bounds = createEmptyBounds();
  const segments: ModelSvgProjectionSegment[] = [];
  let sampledTriangleCount = 0;
  let globalTriangleIndex = 0;

  meshes.forEach((mesh) => {
    const color = projectionColorForMesh(mesh);
    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position");
    if (!position || position.count < 2) return;
    const index = geometry.getIndex();
    const localTriangleCount = meshTriangleCount(mesh);

    for (
      let triangleIndex = 0;
      triangleIndex < localTriangleCount &&
      segments.length < modelSvgProjectionMaxSegments;
      triangleIndex += 1
    ) {
      if (globalTriangleIndex % sampleEvery !== 0) {
        globalTriangleIndex += 1;
        continue;
      }
      globalTriangleIndex += 1;
      const vertexIndexes = triangleVertexIndexes(index, triangleIndex);
      if (!vertexIndexes) continue;
      const projected = vertexIndexes
        .map((vertexIndex) =>
          projectModelVertex(mesh, position, vertexIndex, upAxis),
        )
        .filter((point): point is { x: number; y: number } => Boolean(point));
      if (projected.length < 3) continue;
      sampledTriangleCount += 1;
      const [first, second, third] = projected;
      if (!first || !second || !third) continue;
      pushProjectionSegment(segments, bounds, first, second, color);
      pushProjectionSegment(segments, bounds, second, third, color);
      pushProjectionSegment(segments, bounds, third, first, color);
    }
  });

  if (segments.length === 0 || !isUsableBounds2D(bounds)) return null;
  return {
    segments,
    viewBox: padBounds2D(bounds, 0.08),
    meshCount: meshes.length,
    triangleCount,
    sampledTriangleCount,
  };
}

function meshTriangleCount(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute("position");
  if (!position) return 0;
  const index = mesh.geometry.getIndex();
  return index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
}

function triangleVertexIndexes(
  index: IndexAttributeLike | null,
  triangleIndex: number,
): [number, number, number] | null {
  const offset = triangleIndex * 3;
  if (!index) return [offset, offset + 1, offset + 2];
  return [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
}

function projectModelVertex(
  mesh: Mesh,
  position: VertexAttributeLike,
  vertexIndex: number,
  upAxis: ModelUpAxis,
): { x: number; y: number } | null {
  const point = new Vector3(
    position.getX(vertexIndex),
    position.getY(vertexIndex),
    position.getZ(vertexIndex),
  ).applyMatrix4(mesh.matrixWorld);
  const displayPoint = rotateModelPointForUpAxis(point, upAxis);
  if (![displayPoint.x, displayPoint.y, displayPoint.z].every(Number.isFinite))
    return null;
  return {
    x: displayPoint.x + displayPoint.z * 0.22,
    y: -displayPoint.y + displayPoint.z * 0.14,
  };
}

function pushProjectionSegment(
  segments: ModelSvgProjectionSegment[],
  bounds: Bounds2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
) {
  includePoint(bounds, { x: start.x, y: start.y, z: 0 });
  includePoint(bounds, { x: end.x, y: end.y, z: 0 });
  segments.push({
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    color,
  });
}

function projectionColorForMesh(mesh: Mesh): string {
  const color = firstMeshMaterialColor(mesh) ?? [0.13, 0.74, 0.48];
  const luminance = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  if (luminance < 0.12) return "#22c55e";
  return formatRgbColor(color);
}

function isUsableBounds2D(bounds: Bounds2D): boolean {
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY) &&
    bounds.maxX > bounds.minX &&
    bounds.maxY > bounds.minY
  );
}

function padBounds2D(bounds: Bounds2D, ratio: number): Bounds2D {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const pad = Math.max(width, height) * ratio;
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  };
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

function FitModelCamera({
  group,
  upAxis,
  nonce,
}: {
  group: Group;
  upAxis: ModelUpAxis;
  nonce: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (upAxis === "z") {
      camera.up.set(0, 0, 1);
    } else {
      camera.up.set(0, 1, 0);
    }
    camera.updateMatrixWorld(true);

    const box = modelDisplayBox(group);
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
      (maxDimension / (2 * Math.tan(degreesToRadians(fov) / 2))) * 1.38;
    const target = center;
    const direction = modelCameraDirection(size, upAxis);

    camera.position.set(
      target.x + distance * direction.x,
      target.y + distance * direction.y,
      target.z + distance * direction.z,
    );
    camera.lookAt(target);
    applyCameraClipping(
      camera,
      Math.max(distance / 1000, 0.01),
      Math.max(distance * 20, maxDimension * 20),
    );
  }, [camera, group, nonce, upAxis]);

  return null;
}

function modelCameraDirection(size: Vector3, upAxis: ModelUpAxis): Vector3 {
  if (upAxis === "z") {
    const sideBias = size.x > size.y * 1.8 ? 0.28 : 0.18;
    return new Vector3(sideBias, -1, 0.34).normalize();
  }

  const sideBias = size.x > size.z * 1.8 ? 0.28 : 0.18;
  return new Vector3(sideBias, 0.34, 1).normalize();
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
      throw new Error(result.error ?? "PanAEC Engine 未生成可渲染模型。");
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
    normalizeGltfSourceObjectForInspection(gltf.scene, ext);
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
    const response = await fetch(sourceUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`读取 Collada 模型失败: HTTP ${response.status}`);
    }
    const text = await response.text();
    const viewerText = normalizeColladaSourceTextForViewer(text);
    const sourceAsset = parseColladaSourceAsset(viewerText);
    const collada = new ColladaLoader().parse(
      viewerText,
      sourceDirectoryUrl(sourceUrl),
    );
    if (!collada) {
      throw new Error("Collada 模型加载失败：未返回可渲染场景。");
    }
    restoreColladaSourceTransform(collada.scene, sourceAsset);
    collada.scene.userData = {
      ...collada.scene.userData,
      loaderNormalizedUpAxis: sourceAsset.upAxis,
      worldUnitsToMillimeters: sourceAsset.unitMeters * 1000,
      sourceUnitLabel: `Collada source unit ${formatCoord(
        sourceAsset.unitMeters,
      )} m`,
    };
    return collada.scene;
  }

  if (ext === ".3dm") {
    const loader = new Rhino3dmLoader();
    loader.setLibraryPath("/wasm/rhino3dm/");
    try {
      const object = await loader.loadAsync(sourceUrl);
      normalizeRhino3dmSourceObjectForInspection(object);
      return object;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `3DM 真实查看需要 rhino3dm/OpenNURBS WASM 运行库（/wasm/rhino3dm/rhino3dm.js 与 rhino3dm.wasm）。当前不会用伪模型替代源文件。${message}`,
      );
    }
  }

  if (ext === ".obj") {
    const object = await new OBJLoader().loadAsync(sourceUrl);
    normalizeLegacyMeshSourceObjectForInspection(object, ext);
    return object;
  }

  if (ext === ".fbx") {
    const object = await new FBXLoader().loadAsync(sourceUrl);
    normalizeLegacyMeshSourceObjectForInspection(object, ext);
    return object;
  }

  if (openUsdExtensions.has(ext)) {
    try {
      const { value: object, warnings } = await captureConsoleWarnings(() =>
        new USDLoader().loadAsync(sourceUrl),
      );
      normalizeOpenUsdSourceObjectForInspection(object, ext, warnings);
      return object;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `OpenUSD/USDZ 真实查看需要 Three USDLoader 成功解析源 stage。当前不会降级为 OBJ/FBX 或截图。${message}`,
      );
    }
  }

  throw new Error(
    `当前格式 ${ext || "unknown"} 尚未接入 PanAEC Engine Three 模型查看器。`,
  );
}

const gltfWorldUnitsToMillimeters = 1000;

export function normalizeGltfSourceObjectForInspection(
  object: Object3D,
  ext: string,
) {
  let meshCount = 0;
  object.traverse((child) => {
    child.visible = true;
    if (!(child instanceof Mesh)) return;
    meshCount += 1;
    meshMaterialList(child).forEach((material) => {
      normalizeSourceMaterialForDisplay(material);
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial
      ) {
        material.side = DoubleSide;
        material.needsUpdate = true;
      }
    });
    child.userData = {
      ...child.userData,
      sourceFormat: ext,
      objectType:
        readableEngineeringText(
          stringUserData(child.userData.objectType),
          "",
        ) || `${ext.toUpperCase()} mesh`,
      sourceProperties: [
        ...metricUserData(child.userData.sourceProperties),
        {
          label: "单位换算",
          value: "glTF/GLB 世界单位按 meter 处理，属性面板换算为 mm",
        },
      ],
    };
  });
  object.userData = {
    ...object.userData,
    sourceFormat: ext,
    loaderNormalizedUpAxis: "y",
    worldUnitsToMillimeters: gltfWorldUnitsToMillimeters,
    sourceUnitLabel: "glTF/GLB world unit = meter",
    architokenGltfInspection: {
      meshCount,
      unitPolicy:
        "glTF/GLB scene units are treated as meters; property rows report millimeters.",
    },
  };
}

function normalizeOpenUsdSourceObjectForInspection(
  object: Object3D,
  ext: string,
  warnings: string[] = [],
) {
  let meshCount = 0;
  const compatibilityWarnings = openUsdCompatibilityWarnings(warnings);
  object.traverse((child) => {
    child.visible = true;
    if (!(child instanceof Mesh)) return;
    meshCount += 1;
    meshMaterialList(child).forEach((material) => {
      normalizeSourceMaterialForDisplay(material);
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial
      ) {
        material.side = DoubleSide;
        material.needsUpdate = true;
      }
    });
    child.userData = {
      ...child.userData,
      sourceFormat: ext,
      objectType: "OpenUSD prim mesh",
      ...(compatibilityWarnings.length > 0
        ? {
            sourceProperties: [
              ...metricUserData(child.userData.sourceProperties),
              {
                label: "USD 组合兼容性",
                value: `${compatibilityWarnings.length} 条浏览器 USDLoader 兼容性警告，优先使用同目录 GLB 视觉备援。`,
              },
            ],
          }
        : {}),
    };
  });
  object.userData = {
    ...object.userData,
    sourceFormat: ext,
    loaderNormalizedUpAxis: "y",
    worldUnitsToMillimeters: 1000,
    openUsdCompatibilityWarnings: compatibilityWarnings,
    architokenOpenUsdInspection: {
      meshCount,
      unitPolicy:
        "Three USDLoader composes USD metersPerUnit into scene scale; viewer property rows report millimeters.",
    },
  };
}

function normalizeLegacyMeshSourceObjectForInspection(
  object: Object3D,
  ext: string,
) {
  let meshCount = 0;
  object.traverse((child) => {
    child.visible = true;
    if (!(child instanceof Mesh)) return;
    meshCount += 1;
    meshMaterialList(child).forEach((material) => {
      normalizeSourceMaterialForDisplay(material);
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial
      ) {
        material.side = DoubleSide;
        material.needsUpdate = true;
      }
    });
    child.userData = {
      ...child.userData,
      sourceFormat: ext,
      objectType: `${ext.toUpperCase()} legacy mesh`,
      sourceProperties: [
        ...metricUserData(child.userData.sourceProperties),
        {
          label: "单位策略",
          value:
            "legacy OBJ/FBX 未提供可靠 BIM 单位；按源几何单位显示为 mm 草稿",
        },
      ],
    };
  });
  object.userData = {
    ...object.userData,
    sourceFormat: ext,
    loaderNormalizedUpAxis: ext === ".fbx" ? "y" : "z",
    worldUnitsToMillimeters: 1,
    architokenLegacyMeshInspection: {
      meshCount,
      unitPolicy:
        "OBJ/FBX is a legacy source-bound mesh viewer route; dimensions are geometry bounds until a project unit sidecar proves otherwise.",
    },
  };
}

function normalizeRhino3dmSourceObjectForInspection(object: Object3D) {
  let hiddenLayerObjectsRevealed = 0;
  let meshCount = 0;
  let curveOrPointCount = 0;
  const warnings = Array.isArray(object.userData.warnings)
    ? object.userData.warnings
    : [];
  object.traverse((child) => {
    const layerVisible = rhino3dmObjectLayerVisible(child, object);
    if (layerVisible === false) {
      hiddenLayerObjectsRevealed += 1;
      child.userData = {
        ...child.userData,
        sourceLayerVisible: false,
        architokenVisibilityOverride: "shown_for_complete_source_inspection",
      };
    }
    child.visible = true;
    const materials = objectMaterialList(child);
    materials.forEach((material) => {
      normalizeSourceMaterialForDisplay(material);
      if (material instanceof LineBasicMaterial) {
        material.depthTest = true;
        material.toneMapped = false;
        material.needsUpdate = true;
      }
    });
    if (child instanceof Mesh) {
      meshCount += 1;
      meshMaterialList(child).forEach((material) => {
        if (
          material instanceof MeshStandardMaterial ||
          material instanceof MeshBasicMaterial
        ) {
          material.side = DoubleSide;
          material.needsUpdate = true;
        }
      });
      child.userData = {
        ...child.userData,
        sourceProperties: [
          ...metricUserData(child.userData.sourceProperties),
          ...(warnings.length > 0
            ? [
                {
                  label: "3DM 解析提示",
                  value: `${warnings.length} 条 Rhino3dmLoader 提示；未网格化对象需 Rhino/compute worker 派生。`,
                },
              ]
            : []),
        ],
      };
    } else if (child.type === "Line" || child.type === "Points") {
      curveOrPointCount += 1;
    }
  });
  object.userData = {
    ...object.userData,
    sourceFormat: ".3dm",
    loaderNormalizedUpAxis: "z",
    architokenRhino3dmInspection: {
      allSourceLayersVisible: true,
      hiddenLayerObjectsRevealed,
      meshCount,
      curveOrPointCount,
      warningCount: warnings.length,
    },
  };
}

function rhino3dmObjectLayerVisible(
  child: Object3D,
  root: Object3D,
): boolean | null {
  const attributes = child.userData.attributes;
  if (!attributes || typeof attributes !== "object") return null;
  const layerIndex = (attributes as { layerIndex?: unknown }).layerIndex;
  if (typeof layerIndex !== "number" || layerIndex < 0) return null;
  const layers = root.userData.layers;
  if (!Array.isArray(layers)) return null;
  const layer = layers[layerIndex];
  if (!layer || typeof layer !== "object") return null;
  const visible = (layer as { visible?: unknown }).visible;
  return typeof visible === "boolean" ? visible : null;
}

function normalizeColladaSourceTextForViewer(source: string): string {
  if (!source.includes("<COLLADA") || !source.includes("<diffuse")) {
    return source;
  }
  return source.replace(
    /<(phong|lambert|blinn|constant)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (technique) => normalizeColladaDisplayMaterialTechnique(technique),
  );
}

const colladaVisibleFallbackColor: [number, number, number, number] = [
  0.74, 0.78, 0.82, 1,
];

function normalizeColladaDisplayMaterialTechnique(technique: string): string {
  const diffuseMatch =
    /<diffuse>\s*<color\b([^>]*)>([\s\S]*?)<\/color>\s*<\/diffuse>/i.exec(
      technique,
    );
  const specularMatch =
    /<specular>\s*<color\b[^>]*>([\s\S]*?)<\/color>\s*<\/specular>/i.exec(
      technique,
    );
  const ambientColor = colladaTechniqueColor(technique, "ambient");
  const emissionColor = colladaTechniqueColor(technique, "emission");
  const diffuseColor = parseColladaColorTuple(diffuseMatch?.[2]);
  const specularColor = parseColladaColorTuple(specularMatch?.[1]);
  if (!diffuseMatch || !diffuseColor || !colladaColorIsBlack(diffuseColor)) {
    return technique;
  }

  const displaySource =
    [ambientColor, emissionColor, specularColor].find(
      (color): color is [number, number, number, number] =>
        color !== null && !colladaColorIsBlack(color),
    ) ?? colladaVisibleFallbackColor;
  const displayColor: [number, number, number, number] = [
    displaySource[0],
    displaySource[1],
    displaySource[2],
    displaySource[3] ?? diffuseColor[3] ?? 1,
  ];
  const diffuseTag = diffuseMatch[0];
  return technique.replace(
    diffuseTag,
    diffuseTag.replace(diffuseMatch[2] ?? "", formatColladaColor(displayColor)),
  );
}

function colladaTechniqueColor(
  technique: string,
  tagName: "ambient" | "emission" | "specular",
): [number, number, number, number] | null {
  const match = new RegExp(
    `<${tagName}>\\s*<color\\b[^>]*>([\\s\\S]*?)<\\/color>\\s*<\\/${tagName}>`,
    "i",
  ).exec(technique);
  return parseColladaColorTuple(match?.[1]);
}

function parseColladaColorTuple(
  source: string | undefined,
): [number, number, number, number] | null {
  if (!source) return null;
  const values = source
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);
  if (values.length < 3) return null;
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
}

function colladaColorIsBlack(color: [number, number, number, number]): boolean {
  return (
    Math.max(Math.abs(color[0]), Math.abs(color[1]), Math.abs(color[2])) <=
    0.035
  );
}

function formatColladaColor(color: number[]): string {
  return color.map(formatColladaColorChannel).join(" ");
}

function formatColladaColorChannel(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const clamped = clampNumber(value, 0, 1);
  return Number.isInteger(clamped)
    ? String(clamped)
    : clamped.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function parseColladaSourceAsset(source: string): {
  unitMeters: number;
  upAxis: ModelUpAxis;
} {
  const unitMatch = source.match(/<unit\b[^>]*\bmeter=["']([^"']+)["']/i);
  const parsedUnit = unitMatch?.[1] ? Number.parseFloat(unitMatch[1]) : 1;
  const unitMeters =
    Number.isFinite(parsedUnit) && parsedUnit > 0 ? parsedUnit : 1;
  const upAxisMatch = source.match(/<up_axis>\s*([^<]+)\s*<\/up_axis>/i);
  const upAxis = upAxisMatch?.[1]?.trim().toUpperCase() === "Z_UP" ? "z" : "y";
  return { unitMeters, upAxis };
}

function restoreColladaSourceTransform(
  object: Object3D,
  asset: { unitMeters: number; upAxis: ModelUpAxis },
) {
  if (asset.upAxis === "z" && looksLikeColladaLoaderZUpRotation(object)) {
    object.rotation.set(0, 0, 0);
  }
  if (asset.unitMeters !== 1 && Number.isFinite(asset.unitMeters)) {
    object.scale.multiplyScalar(1 / asset.unitMeters);
  }
  object.updateMatrixWorld(true);
}

function looksLikeColladaLoaderZUpRotation(object: Object3D): boolean {
  const epsilon = 1e-5;
  return (
    Math.abs(object.rotation.x + Math.PI / 2) <= epsilon &&
    Math.abs(object.rotation.y) <= epsilon &&
    Math.abs(object.rotation.z) <= epsilon
  );
}

function sourceDirectoryUrl(sourceUrl: string): string {
  try {
    const base =
      typeof window === "undefined"
        ? "http://localhost/"
        : window.location.href;
    return new URL(".", new URL(sourceUrl, base)).toString();
  } catch {
    const index = sourceUrl.lastIndexOf("/");
    return index >= 0 ? sourceUrl.slice(0, index + 1) : "";
  }
}

async function captureConsoleWarnings<T>(
  loader: () => Promise<T>,
): Promise<{ value: T; warnings: string[] }> {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
    originalWarn(...args);
  };
  try {
    return { value: await loader(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function openUsdCompatibilityWarnings(warnings: string[]): string[] {
  return Array.from(
    new Set(warnings.filter((warning) => warning.includes("USDCParser:"))),
  );
}

function hasOpenUsdReferenceCompositionWarnings(group: Group): boolean {
  let hasWarning = false;
  group.traverse((object) => {
    const warnings = object.userData.openUsdCompatibilityWarnings;
    if (
      Array.isArray(warnings) &&
      warnings.some(
        (warning) =>
          typeof warning === "string" &&
          warning.includes("Unsupported scalar type 35"),
      )
    ) {
      hasWarning = true;
    }
  });
  return hasWarning;
}

interface OpenUsdVisualFallback {
  fileId: string;
  originalName: string;
  ext: string;
  mimeType: string;
  url: string;
}

export function findOpenUsdVisualFallbackCandidate(
  source: Pick<ModuleFileNode, "name" | "moduleId"> & {
    localFile?: {
      fileId: string;
      originalName: string;
      moduleId: string;
      parentId?: string;
    };
  },
  files: Array<{
    fileId: string;
    originalName: string;
    moduleId: string;
    parentId?: string;
    ext?: string;
    mimeType?: string;
  }>,
): OpenUsdVisualFallback | null {
  const localFile = source.localFile;
  if (!localFile) return null;
  const sourceParentId = localFile.parentId ?? "";
  const sourceComparableStem = comparableVisualFallbackStem(
    localFile.originalName || source.name,
  );
  const candidates = files
    .filter((candidate) => candidate.fileId !== localFile.fileId)
    .filter((candidate) => candidate.moduleId === localFile.moduleId)
    .filter((candidate) => (candidate.parentId ?? "") === sourceParentId)
    .filter((candidate) =>
      new Set([".glb", ".gltf"]).has(
        (candidate.ext || extensionOf(candidate.originalName)).toLowerCase(),
      ),
    );

  const exact = candidates.find(
    (candidate) =>
      comparableVisualFallbackStem(candidate.originalName) ===
      sourceComparableStem,
  );
  const selected = exact ?? (candidates.length === 1 ? candidates[0] : null);
  if (!selected) return null;

  const ext = (
    selected.ext || extensionOf(selected.originalName)
  ).toLowerCase();
  return {
    fileId: selected.fileId,
    originalName: selected.originalName,
    ext,
    mimeType:
      selected.mimeType ??
      (ext === ".glb" ? "model/gltf-binary" : "model/gltf+json"),
    url: `/api/local-files/${encodeURIComponent(selected.fileId)}`,
  };
}

async function findOpenUsdVisualFallback(
  file: ModuleFileNode,
): Promise<OpenUsdVisualFallback | null> {
  const moduleId = file.localFile?.moduleId ?? file.moduleId;
  const response = await fetch(
    `/api/local-files?moduleId=${encodeURIComponent(moduleId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const parsed = (await response.json()) as {
    files?: Array<{
      fileId: string;
      originalName: string;
      moduleId: string;
      parentId?: string;
      ext?: string;
      mimeType?: string;
    }>;
  };
  return findOpenUsdVisualFallbackCandidate(file, parsed.files ?? []);
}

function comparableVisualFallbackStem(fileName: string): string {
  return stripFileExtension(fileName)
    .toLowerCase()
    .replace(/(?:[_ -]?(?:openusd|usdz|usd|glb|gltf))$/u, "")
    .trim();
}

function markOpenUsdVisualFallbackPreview(
  preview: OcctPreview,
  originalFile: ModuleFileNode,
  fallback: OpenUsdVisualFallback,
) {
  const originalFormat = (
    originalFile.localFile?.ext || extensionOf(originalFile.name)
  ).toLowerCase();
  preview.group.userData = {
    ...preview.group.userData,
    sourceFormat: originalFormat,
    visualFallback: {
      sourceFormat: originalFormat,
      fallbackFormat: fallback.ext,
      fallbackFileId: fallback.fileId,
      fallbackName: fallback.originalName,
    },
  };
  preview.group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.userData = {
      ...object.userData,
      sourceFormat: originalFormat,
      objectType: stringUserData(
        object.userData.objectType,
        "OpenUSD visual fallback mesh",
      ),
      routeLabel: `${panaecLabel} · OpenUSD/USDZ 场景（GLB 视觉备援）`,
      sourceProperties: [
        ...metricUserData(object.userData.sourceProperties),
        {
          label: "视觉备援",
          value: `${fallback.originalName}（${fallback.ext}）`,
        },
        {
          label: "源文件",
          value: `${originalFile.name}（${originalFormat}）`,
        },
      ],
    };
  });
}

function buildThreeExchangeGroup(
  sourceObject: Object3D,
  options: ExchangeMeshBuildOptions,
): OcctPreview {
  const group = new Group();
  const worldUnitsToMillimeters = exchangeWorldUnitsToMillimeters(
    sourceObject,
    options,
  );
  group.name = options.sourceName;
  group.userData = {
    sourceFormat: options.sourceFormat,
    routeLabel: options.routeLabel,
    originalName: options.sourceName,
    worldUnitsToMillimeters,
  };
  group.add(sourceObject);
  annotateThreeExchangeMeshes(group, options);
  applyComponentAggregateBoundsToMeshes(group);
  normalizeThreeGroupReferencePlane(
    group,
    sourceObjectLoaderUpAxis(sourceObject) ??
      preferredThreeExchangeUpAxis(options.sourceFormat),
  );
  const nativeBounds = new Box3().setFromObject(group);
  applyAggregateModelBoundsToMeshes(
    group,
    nativeBounds,
    prefersModelBoundsForDegenerateExchangeFormat(options.sourceFormat),
    worldUnitsToMillimeters,
  );
  return buildThreeGroupPreview(group);
}

function exchangeWorldUnitsToMillimeters(
  sourceObject: Object3D,
  options: ExchangeMeshBuildOptions,
): number {
  const ext = options.sourceFormat.toLowerCase();
  if (ext === ".rvt" || ext === ".rfa") {
    return revitInternalFootToMillimeters;
  }
  return finiteNumberUserData(sourceObject.userData.worldUnitsToMillimeters, 1);
}

function sourceObjectLoaderUpAxis(sourceObject: Object3D): ModelUpAxis | null {
  return sourceObject.userData.loaderNormalizedUpAxis === "y" ||
    sourceObject.userData.loaderNormalizedUpAxis === "z"
    ? sourceObject.userData.loaderNormalizedUpAxis
    : null;
}

function preferredThreeExchangeUpAxis(sourceFormat: string): ModelUpAxis {
  const ext = sourceFormat.toLowerCase();
  if (ext === ".glb" || ext === ".gltf") return "y";
  return "z";
}

function prefersModelBoundsForDegenerateExchangeFormat(
  sourceFormat: string,
): boolean {
  const ext = sourceFormat.toLowerCase();
  return ext === ".rvt" || ext === ".rfa";
}

const neutralMeshColorTuple = (): [number, number, number] =>
  neutralMeshColorTupleImpl();
const normalizeSourceMaterialForDisplay = (material: unknown): void =>
  normalizeSourceMaterialForDisplayImpl(material);

function annotateThreeExchangeMeshes(
  group: Group,
  options: ExchangeMeshBuildOptions,
) {
  let ordinal = 0;
  const worldUnitsToMillimeters = finiteNumberUserData(
    group.userData.worldUnitsToMillimeters,
    1,
  );
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    ordinal += 1;
    object.castShadow = true;
    object.receiveShadow = true;
    cloneMeshMaterialsForSelection(object);
    object.geometry.computeBoundingBox();
    const nativeBounds = new Box3().setFromObject(object);
    const fallbackBounds = nativeBounds.isEmpty()
      ? null
      : boxToScaledSerializableBounds(nativeBounds, worldUnitsToMillimeters);
    const sourceAttributes = threeObjectAttributes(object);
    const rvtElementId = rvtElementIdForObject(object);
    const schedule = rvtElementId
      ? options.rvtScheduleIndex?.get(rvtElementId)
      : undefined;
    const serializedBounds = schedule?.boundsMm ?? fallbackBounds;
    const dimensions = serializedBounds
      ? boundsDimensions(serializedBounds)
      : null;
    const center = serializedBounds ? boundsCenter(serializedBounds) : null;
    const stats = meshGeometryStats(object.geometry);
    meshMaterialList(object).forEach(normalizeSourceMaterialForDisplay);
    const baseColor = firstMeshMaterialColor(object) ?? neutralMeshColorTuple();
    const displayName =
      rvtScheduleDisplayName(schedule) ??
      readableThreeObjectName(object, options, ordinal);
    const sourceComponentId =
      rvtElementId ||
      stringUserData(object.userData.componentId) ||
      stringUserData(sourceAttributes.id);
    const componentId = readableEngineeringText(
      schedule?.uniqueId || sourceComponentId,
      `${options.sourceName}:${ordinal}`,
    );
    const componentGroupKey = rvtElementId
      ? `rvt:${rvtElementId}`
      : threeExchangeComponentGroupKey(object, group);
    const materialSource = describeMeshMaterials(object, baseColor);
    const scheduleProperties = schedule ? rvtScheduleRowsForMesh(schedule) : [];
    const existingSourceProperties = metricUserData(
      object.userData.sourceProperties,
    );

    meshMaterialList(object).forEach((material) => {
      prepareSelectableMaterial(
        material,
        colorTupleFromUserData(
          isColorBearingMaterial(material)
            ? material.userData.architokenDisplayColor
            : null,
        ) ?? baseColor,
      );
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial
      ) {
        material.side = DoubleSide;
        material.needsUpdate = true;
      }
    });

    object.name = displayName;
    object.userData = {
      ...object.userData,
      baseColor,
      componentId,
      ...(rvtElementId ? { revitElementId: rvtElementId } : {}),
      ...(rvtElementId ? { selectionGroupKey: `rvt:${rvtElementId}` } : {}),
      ...(schedule ? { dimensionSourceLabel: "RVT 属性清单 BoundingBox" } : {}),
      ...(componentGroupKey
        ? { componentGroupKey: `three:${componentGroupKey}` }
        : {}),
      objectType:
        readableEngineeringText(
          stringUserData(object.userData.objectType),
          "",
        ) || `${options.sourceFormat.toUpperCase()} mesh`,
      sourceFormat: options.sourceFormat,
      sourceName: displayName,
      routeLabel: options.routeLabel,
      geometryExpression: `${stats.vertexCount.toLocaleString()} vertices / ${stats.faceCount.toLocaleString()} faces`,
      materialSource,
      sourceProperties: [
        ...scheduleProperties,
        ...existingSourceProperties,
        { label: "源格式", value: options.sourceFormat },
        { label: "源 Mesh 序号", value: String(ordinal) },
        { label: "源 Mesh 名称", value: displayName },
        { label: "顶点", value: stats.vertexCount.toLocaleString() },
        { label: "三角面", value: stats.faceCount.toLocaleString() },
        ...(worldUnitsToMillimeters !== 1
          ? [
              {
                label: "单位换算",
                value: `视口世界单位 × ${formatCoord(worldUnitsToMillimeters)} = mm`,
              },
            ]
          : []),
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

function cloneMeshMaterialsForSelection(object: Mesh) {
  const material = object.material;
  object.material = Array.isArray(material)
    ? (material.map((entry) => entry.clone()) as Material[])
    : material.clone();
}

function rvtElementIdForObject(object: Object3D | null): string {
  let current: Object3D | null = object;
  while (current) {
    const candidate =
      baseRvtElementId(stringUserData(current.userData.revitElementId)) ||
      baseRvtElementId(stringUserData(current.userData.componentId)) ||
      baseRvtElementId(
        stringUserData(threeObjectUserDataAttribute(current, "id")),
      ) ||
      baseRvtElementId(current.name);
    if (candidate) return candidate;
    current = current.parent;
  }
  return "";
}

function threeObjectUserDataAttribute(object: Object3D, key: string): unknown {
  const attributes = object.userData.attributes;
  return attributes &&
    typeof attributes === "object" &&
    !Array.isArray(attributes)
    ? (attributes as Record<string, unknown>)[key]
    : undefined;
}

function baseRvtElementId(value: string): string {
  const match = value.trim().match(/^(\d+)(?:__\d+)?$/);
  return match?.[1] ?? "";
}

function rvtScheduleDisplayName(
  schedule: RvtScheduleRecord | undefined,
): string | null {
  if (!schedule) return null;
  const name = readableEngineeringText(schedule.name || schedule.typeName, "");
  const family = readableEngineeringText(schedule.family, "");
  if (name && family) return `${family}:${name}`;
  return name || family || `Revit ${schedule.elementId}`;
}

function rvtScheduleRowsForMesh(schedule: RvtScheduleRecord): MetricItem[] {
  const coreRows: MetricItem[] = [
    { label: "Revit ElementId", value: schedule.elementId },
    ...(schedule.uniqueId
      ? [{ label: "Revit UniqueId", value: schedule.uniqueId }]
      : []),
    ...(schedule.versionGuid
      ? [{ label: "Revit VersionGuid", value: schedule.versionGuid }]
      : []),
  ];
  const seen = new Set(coreRows.map((row) => row.label.toLowerCase()));
  return [
    ...coreRows,
    ...schedule.properties.filter((row) => {
      const key = row.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function threeExchangeComponentGroupKey(object: Mesh, root: Group): string {
  const ancestor = nearestMultiMeshAncestor(object, root);
  const nameGroupKey = sketchUpLikeComponentNameGroupKey(object);
  if (!ancestor || ancestor.parent === root) {
    return nameGroupKey || `mesh:${object.uuid}`;
  }
  if (nameGroupKey) return nameGroupKey;
  return `node:${objectPathWithinRoot(ancestor, root)}`;
}

function sketchUpLikeComponentNameGroupKey(object: Object3D): string {
  const name = readableEngineeringText(object.name, "");
  const match = name.match(
    /^(.+?(?:组件|component)[#_\-\s]*\d+)(?:[_\-\s]\d+)?$/i,
  );
  return match?.[1] ? `name:${match[1]}` : "";
}

function nearestMultiMeshAncestor(object: Mesh, root: Group): Object3D | null {
  let current: Object3D | null = object.parent;
  let fallback: Object3D | null = null;

  while (current && current !== root) {
    if (!(current instanceof Mesh)) {
      fallback ??= current;
      if (descendantMeshCount(current) > 1) return current;
    }
    current = current.parent;
  }

  return fallback;
}

function descendantMeshCount(object: Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if (child instanceof Mesh) count += 1;
  });
  return count;
}

function objectPathWithinRoot(object: Object3D, root: Group): string {
  const parts: string[] = [];
  let current: Object3D | null = object;

  while (current && current !== root) {
    parts.push(readableEngineeringText(current.name, current.uuid));
    current = current.parent;
  }

  return parts.reverse().join("/") || object.uuid;
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
  return attributes &&
    typeof attributes === "object" &&
    !Array.isArray(attributes)
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
        <ArchLoadingFlow label={message} size="panel" />
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

function RvtPanAecDerivativeViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const [state, setState] = useState<LoadState<RvtDerivativeManifest>>({
    status: "loading",
    message: "正在请求 PanAEC Engine RVT 真实解析...",
  });

  useEffect(() => {
    if (!localFileId) return;
    const fileId = localFileId;
    let cancelled = false;

    async function loadManifest() {
      setState({
        status: "loading",
        message: "正在请求 PanAEC Engine RVT 真实解析...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/rvt-derivative?format=manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "PanAEC Engine RVT 解析失败"),
          );
        }
        const manifest = (await response.json()) as RvtDerivativeManifest;
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
        title="RVT 源文件查看"
        file={file}
        sourceUrl={sourceUrl}
        reason="当前文件没有绑定本地源文件 ID，无法启动 PanAEC Engine RVT 真实解析。"
      />
    );
  }

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="RVT PanAEC Engine 解析失败"
        file={file}
        reason={`${state.message}。系统不会用截图、字节预览或伪模型替代真实 RVT 构件模型。`}
      />
    );
  }

  const manifest = state.value;
  if (!manifest.permissions.canView || !manifest.derivativeArtifact) {
    return (
      <AdapterRequiredPanel
        title="RVT 真实模型未生成"
        file={file}
        reason={
          manifest.notes[0] ??
          "需要 PanAEC Engine RVT 转换器生成真实模型、材质和属性清单。"
        }
      />
    );
  }

  return (
    <RvtDerivativeModelViewer
      file={file}
      sourceUrl={sourceUrl}
      manifest={manifest}
    />
  );
}

function RvtDerivativeModelViewer({
  file,
  sourceUrl,
  manifest,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  manifest: RvtDerivativeManifest;
}) {
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: "loading",
    message: "正在加载 PanAEC Engine RVT 模型...",
  });
  const daeUrl = rvtDerivativeArtifactUrl(manifest.derivativeArtifact);
  const scheduleUrl = rvtDerivativeArtifactUrl(manifest.scheduleArtifact);

  useEffect(() => {
    if (!daeUrl) return;
    const derivativeUrl = daeUrl;
    let cancelled = false;

    async function loadDerivativeModel() {
      setState({
        status: "loading",
        message: "正在加载 PanAEC Engine RVT 模型...",
      });

      try {
        const [sourceObject, rvtScheduleIndex] = await Promise.all([
          loadThreeSourceObject(derivativeUrl, ".dae"),
          loadRvtScheduleIndex(scheduleUrl),
        ]);
        const preview = buildThreeExchangeGroup(sourceObject, {
          sourceFormat: `.${manifest.sourceFormat}`,
          sourceName: manifest.originalName || file.name,
          mimeType: file.mimeType,
          routeLabel: `${panaecLabel} · RVT 真实解析`,
          rvtScheduleIndex,
        });
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

    void loadDerivativeModel();

    return () => {
      cancelled = true;
    };
  }, [
    daeUrl,
    file.mimeType,
    file.name,
    manifest.originalName,
    manifest.sourceFormat,
    scheduleUrl,
  ]);

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="RVT 模型加载失败"
        file={file}
        reason={`${state.message}。请检查 PanAEC Engine RVT 派生结果是否为有效 Collada 模型。`}
      />
    );
  }

  return (
    <ExchangeModelWorkbench
      file={file}
      sourceUrl={sourceUrl}
      preview={state.value}
      routeLabel={`${panaecLabel} · RVT 真实解析`}
      status="PanAEC Engine RVT 真实模型"
      formatLabel={`.${manifest.sourceFormat}`}
      upAxis={groupModelUpAxis(state.value.group)}
    />
  );
}

function rvtDerivativeArtifactUrl(
  artifact:
    | RvtDerivativeManifest["derivativeArtifact"]
    | RvtDerivativeManifest["scheduleArtifact"]
    | undefined,
): string | undefined {
  if (!artifact?.url) return undefined;
  const version = artifact.cacheKey || artifact.etag || "";
  if (!version) return artifact.url;
  try {
    const base =
      typeof window === "undefined"
        ? "http://localhost/"
        : window.location.href;
    const url = new URL(artifact.url, base);
    url.searchParams.set("v", version);
    return url.pathname + url.search;
  } catch {
    const separator = artifact.url.includes("?") ? "&" : "?";
    return `${artifact.url}${separator}v=${encodeURIComponent(version)}`;
  }
}

async function loadRvtScheduleIndex(
  scheduleUrl: string | undefined,
): Promise<RvtScheduleIndex | undefined> {
  if (!scheduleUrl) return undefined;
  try {
    const response = await fetch(scheduleUrl, { cache: "no-store" });
    if (!response.ok) return undefined;
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(await response.arrayBuffer(), {
      type: "array",
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return undefined;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return undefined;
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];
    return buildRvtScheduleIndex(rows);
  } catch {
    return undefined;
  }
}

function buildRvtScheduleIndex(rows: unknown[][]): RvtScheduleIndex {
  const [rawHeader, ...rawRows] = rows;
  const headers = Array.isArray(rawHeader)
    ? rawHeader.map((value) => String(value ?? "").trim())
    : [];
  const headerIndex = new Map(
    headers.map((header, index) => [rvtScheduleHeaderKey(header), index]),
  );
  const result: RvtScheduleIndex = new Map();

  rawRows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const elementId = rvtScheduleString(row, headerIndex, "id");
    if (!elementId) return;
    const boundsMm = rvtScheduleBoundsMm(row, headerIndex);
    const record: RvtScheduleRecord = {
      elementId,
      typeName: rvtScheduleString(row, headerIndex, "type name"),
      category: rvtScheduleString(row, headerIndex, "category"),
      family: rvtScheduleString(row, headerIndex, "family"),
      level: rvtScheduleString(row, headerIndex, "level"),
      name: rvtScheduleString(row, headerIndex, "name"),
      uniqueId: rvtScheduleString(row, headerIndex, "uniqueid"),
      versionGuid: rvtScheduleString(row, headerIndex, "versionguid"),
      boundsMm,
      dimensionsMm: boundsDimensions(boundsMm),
      properties: rvtScheduleProperties(row, headers),
    };
    result.set(elementId, record);
  });

  return result;
}

function rvtScheduleHeaderKey(header: string): string {
  return header
    .replace(/\s*:\s*[^:]+$/g, "")
    .trim()
    .toLowerCase();
}

function rvtScheduleString(
  row: unknown[],
  headerIndex: Map<string, number>,
  key: string,
): string {
  const index = headerIndex.get(key);
  if (index === undefined) return "";
  const value = row[index];
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function rvtScheduleNumber(
  row: unknown[],
  headerIndex: Map<string, number>,
  key: string,
): number | null {
  const value = rvtScheduleString(row, headerIndex, key);
  if (!value) return null;
  const numeric = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function rvtScheduleBoundsMm(
  row: unknown[],
  headerIndex: Map<string, number>,
): Bounds3D | null {
  const minX = rvtScheduleNumber(row, headerIndex, "boundingboxmin_x");
  const minY = rvtScheduleNumber(row, headerIndex, "boundingboxmin_y");
  const minZ = rvtScheduleNumber(row, headerIndex, "boundingboxmin_z");
  const maxX = rvtScheduleNumber(row, headerIndex, "boundingboxmax_x");
  const maxY = rvtScheduleNumber(row, headerIndex, "boundingboxmax_y");
  const maxZ = rvtScheduleNumber(row, headerIndex, "boundingboxmax_z");
  if (
    minX === null ||
    minY === null ||
    minZ === null ||
    maxX === null ||
    maxY === null ||
    maxZ === null
  ) {
    return null;
  }
  return scaleBounds(
    {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
    revitInternalFootToMillimeters,
  );
}

function rvtScheduleProperties(
  row: unknown[],
  headers: string[],
): MetricItem[] {
  return headers
    .map((header, index) => {
      const rawValue = row[index];
      const value =
        typeof rawValue === "string" || typeof rawValue === "number"
          ? String(rawValue).trim()
          : "";
      if (!header || !value) return null;
      const label = rvtScheduleDisplayLabel(header);
      return label ? { label, value } : null;
    })
    .filter((item): item is MetricItem => Boolean(item));
}

function rvtScheduleDisplayLabel(header: string): string {
  const label = header.replace(/\s*:\s*[^:]+$/g, "").trim();
  const mapped: Record<string, string> = {
    ID: "Revit ElementId",
    "Type Name": "类型名称",
    Category: "类别",
    Family: "族",
    Level: "标高",
    Name: "名称",
    "Family Name": "族名称",
    UniqueId: "Revit UniqueId",
    VersionGuid: "Revit VersionGuid",
  };
  return mapped[label] ?? label;
}

function Rhino3dmPanAecDerivativeViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const [state, setState] = useState<LoadState<ThreeDmDerivativeManifest>>({
    status: "loading",
    message: "正在请求 PanAEC Engine 3DM 转 IFC 真实派生...",
  });

  useEffect(() => {
    if (!localFileId) return;
    const fileId = localFileId;
    let cancelled = false;

    async function loadManifest() {
      setState({
        status: "loading",
        message: "正在请求 PanAEC Engine 3DM 转 IFC 真实派生...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/3dm-derivative?format=manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "PanAEC Engine 3DM 转 IFC 失败"),
          );
        }
        const manifest = (await response.json()) as ThreeDmDerivativeManifest;
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
        title="3DM 源文件查看"
        file={file}
        sourceUrl={sourceUrl}
        reason="当前文件没有绑定本地源文件 ID，无法启动 PanAEC Engine 3DM 转 IFC 真实派生。"
      />
    );
  }

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <AdapterRequiredPanel
        title="3DM 转 IFC 失败"
        file={file}
        reason={`${state.message}。系统不会用 Rhino display mesh、浏览器三维预览或伪几何替代真实 IFC。`}
      />
    );
  }

  const manifest = state.value;
  if (!manifest.permissions.canView || !manifest.ifcArtifact) {
    return (
      <AdapterRequiredPanel
        title="3DM IFC 派生未生成"
        file={file}
        reason={
          manifest.notes.filter(Boolean).join(" ") ||
          "需要 PanAEC Engine 3DM->IFC 命令或 Rhino/Speckle HTTP sidecar 生成真实 IFC。"
        }
      />
    );
  }

  return <Rhino3dmIfcDerivativeViewer file={file} manifest={manifest} />;
}

function Rhino3dmIfcDerivativeViewer({
  file,
  manifest,
}: {
  file: ModuleFileNode;
  manifest: ThreeDmDerivativeManifest;
}) {
  const ifcArtifact = manifest.ifcArtifact;
  if (!ifcArtifact) {
    return (
      <AdapterRequiredPanel
        title="3DM IFC 派生不可用"
        file={file}
        reason="当前没有可加载的 3DM->IFC 派生产物。"
      />
    );
  }
  const ifcFile: ModuleFileNode = {
    ...file,
    id: `${file.id}:3dm-ifc`,
    name: `${file.name.replace(/\.[^.]+$/, "")}.ifc`,
    size: ifcArtifact.size ?? file.size,
    mimeType: ifcArtifact.mediaType,
    checksum: ifcArtifact.etag,
  };
  const ifcSourceUrl = threeDmIfcDerivativeArtifactUrl(ifcArtifact);
  return (
    <IfcNativeOpenViewer
      key={`${ifcFile.id}:${ifcArtifact.etag}:${ifcArtifact.cacheKey ?? ""}`}
      file={ifcFile}
      sourceUrl={ifcSourceUrl}
    />
  );
}

function threeDmIfcDerivativeArtifactUrl(
  artifact: ThreeDmDerivativeManifest["ifcArtifact"],
): string {
  if (!artifact?.url) return "";
  const version = artifact.cacheKey || artifact.etag || "";
  if (!version) return artifact.url;
  try {
    const base =
      typeof window === "undefined"
        ? "http://localhost/"
        : window.location.href;
    const url = new URL(artifact.url, base);
    url.searchParams.set("v", version);
    return url.pathname + url.search;
  } catch {
    const separator = artifact.url.includes("?") ? "&" : "?";
    return `${artifact.url}${separator}v=${encodeURIComponent(version)}`;
  }
}

function SketchUpPanAecPendingViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const [state, setState] = useState<LoadState<SkpDerivativeManifest>>({
    status: "loading",
    message: "正在请求 PanAEC Engine SKP 真实解析...",
  });

  useEffect(() => {
    if (!localFileId) return;
    const fileId = localFileId;
    let cancelled = false;

    async function loadManifest() {
      setState({
        status: "loading",
        message: "正在请求 PanAEC Engine SKP 真实解析...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/skp-derivative?format=manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "PanAEC Engine SKP 解析失败"),
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
        reason="当前文件没有绑定本地源文件 ID，无法启动 PanAEC Engine SKP 真实解析。"
      />
    );
  }

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <SkpSourcePackageFallbackViewer
        file={file}
        sourceUrl={sourceUrl}
        reason={`${state.message}。当前先打开 SKP 源包真实内容；几何模型仍需真实 SKP 转 IFC/GLB 命令、授权适配器或同源 GLB 派生。`}
      />
    );
  }

  const manifest = state.value;
  if (!manifest.permissions.canView) {
    return (
      <SkpSourcePackageFallbackViewer
        file={file}
        sourceUrl={sourceUrl}
        reason={
          manifest.notes.filter(Boolean).join(" ") ||
          "当前没有可加载的 SKP 几何派生；已转入真实 SKP 源包查看。"
        }
      />
    );
  }

  if (!manifest.derivativeArtifact && manifest.ifcArtifact) {
    return <SketchUpIfcDerivativeViewer file={file} manifest={manifest} />;
  }

  if (!manifest.derivativeArtifact) {
    return (
      <SkpSourcePackageFallbackViewer
        file={file}
        sourceUrl={sourceUrl}
        reason={
          manifest.notes.filter(Boolean).join(" ") ||
          "当前没有可加载的 SKP IFC/GLB 派生；已转入真实 SKP 源包查看。"
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

function SketchUpIfcDerivativeViewer({
  file,
  manifest,
}: {
  file: ModuleFileNode;
  manifest: SkpDerivativeManifest;
}) {
  const ifcArtifact = manifest.ifcArtifact;
  if (!ifcArtifact) {
    return (
      <AdapterRequiredPanel
        title="SKP IFC 派生不可用"
        file={file}
        reason="当前没有可加载的 SKP->IFC 派生产物。"
      />
    );
  }
  const ifcFile: ModuleFileNode = {
    ...file,
    id: `${file.id}:skp-ifc`,
    name: `${file.name.replace(/\.[^.]+$/, "")}.ifc`,
    size: ifcArtifact.size ?? file.size,
    mimeType: ifcArtifact.mediaType,
    checksum: ifcArtifact.etag,
  };
  return <IfcNativeOpenViewer file={ifcFile} sourceUrl={ifcArtifact.url} />;
}

function SkpSourcePackageFallbackViewer({
  file,
  sourceUrl,
  reason,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  reason: string;
}) {
  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  const [state, setState] = useState<LoadState<SkpSourcePackageManifest>>({
    status: "loading",
    message: "正在打开 SKP 源包...",
  });

  useEffect(() => {
    if (!localFileId) return;
    const fileId = localFileId;
    let cancelled = false;

    async function loadSourcePackage() {
      setState({
        status: "loading",
        message: "正在打开 SKP 源包...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(fileId)}/archive-manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "SKP 源包索引失败"),
          );
        }
        const manifest = (await response.json()) as SkpSourcePackageManifest;
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

    void loadSourcePackage();

    return () => {
      cancelled = true;
    };
  }, [localFileId]);

  if (!localFileId) {
    return (
      <LightweightEngineeringSourceViewer
        title="SKP 源文件已打开"
        file={file}
        sourceUrl={sourceUrl}
        reason={reason}
      />
    );
  }

  if (state.status === "loading") {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === "failed") {
    return (
      <LightweightEngineeringSourceViewer
        title="SKP 源文件已打开"
        file={file}
        sourceUrl={sourceUrl}
        reason={`${reason} SKP 源包目录索引失败：${state.message}`}
      />
    );
  }

  const manifest = state.value;
  const modelEntry =
    manifest.entries.find((entry) => entry.name === "model.dat") ??
    manifest.entries.find((entry) => entry.name.endsWith("/model.dat")) ??
    null;
  const materialEntries = manifest.entries.filter((entry) =>
    entry.name.startsWith("materials/"),
  );
  const styleEntries = manifest.entries.filter((entry) =>
    entry.name.startsWith("styles/"),
  );
  const visibleEntries = manifest.entries.slice(0, 80);
  const metrics: ViewerMetric[] = [
    { label: "格式", value: ".skp" },
    { label: "源包引擎", value: manifest.engine || "7z" },
    { label: "条目", value: manifest.fileCount.toLocaleString() },
    { label: "材质", value: materialEntries.length.toLocaleString() },
    { label: "样式", value: styleEntries.length.toLocaleString() },
    {
      label: "model.dat",
      value: modelEntry
        ? formatModuleFileSize(modelEntry.uncompressedSize)
        : "未发现",
    },
  ];

  return (
    <EngineeringViewportFrame
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={`${panaecLabel} · SKP 源包查看`}
    >
      <div className="absolute inset-0 overflow-auto bg-slate-950 p-4 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <section className="rounded-md border border-slate-800 bg-slate-900/72 p-5">
            <p className="text-xs font-medium text-emerald-300">
              SKP 源文件已打开
            </p>
            <h3 className="mt-1 break-words text-lg font-medium text-white">
              {file.name}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{reason}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MetricCard
                label="压缩源大小"
                value={formatModuleFileSize(manifest.compressedBytes)}
              />
              <MetricCard
                label="展开后大小"
                value={formatModuleFileSize(manifest.uncompressedBytes)}
              />
              <MetricCard
                label="核心数据"
                value={modelEntry ? modelEntry.name : "未发现 model.dat"}
              />
              <MetricCard
                label="风险路径"
                value={manifest.unsafePathCount.toLocaleString()}
              />
            </div>
            {manifest.warnings.length ? (
              <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                {manifest.warnings.slice(0, 4).join("；")}
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-md border border-slate-800 bg-slate-900/72">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-emerald-300">
                  SKP 容器条目
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  显示真实源包目录；几何显示仍等待真实 IFC/GLB 派生。
                </p>
              </div>
              <div className="flex items-center gap-2">
                {localFileId ? (
                  <a
                    href={`/api/local-files/${encodeURIComponent(localFileId)}/bom-export?format=csv`}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                  >
                    <Download className="h-4 w-4" />
                    导出 BOM 清单
                  </a>
                ) : null}
                <a
                  href={sourceUrl}
                  download={file.name}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
                >
                  <Download className="h-4 w-4" />
                  源文件
                </a>
              </div>
            </div>
            <div className="max-h-[58vh] overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">路径</th>
                    <th className="px-3 py-2 font-medium">类型</th>
                    <th className="px-3 py-2 font-medium">压缩后</th>
                    <th className="px-3 py-2 font-medium">原始大小</th>
                    <th className="px-3 py-2 font-medium">方式</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr
                      key={entry.name}
                      className="border-t border-slate-800/80 text-slate-200"
                    >
                      <td className="px-3 py-2">
                        <span
                          className="block truncate"
                          style={{
                            paddingLeft: `${Math.min(entry.depth, 8) * 12}px`,
                          }}
                          title={entry.name}
                        >
                          {entry.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{entry.kind}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {entry.directory
                          ? "-"
                          : formatModuleFileSize(entry.compressedSize)}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {entry.directory
                          ? "-"
                          : formatModuleFileSize(entry.uncompressedSize)}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {entry.methodLabel || "external"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </EngineeringViewportFrame>
  );
}

function skpGlbDerivativeIsFallback(manifest: SkpDerivativeManifest): boolean {
  return manifest.derivativeArtifact?.source === "glb-fallback";
}

function skpGlbRouteLabel(manifest: SkpDerivativeManifest): string {
  return skpGlbDerivativeIsFallback(manifest)
    ? `${panaecLabel} · SKP 绑定 GLB（非现场解析）`
    : `${panaecLabel} · SKP 真实解析`;
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
    message: "正在加载 PanAEC Engine SKP 模型...",
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
        reason={`${state.message}。请检查 PanAEC Engine SKP 派生结果是否为有效 GLB 模型。`}
      />
    );
  }

  const localFileId = file.localFileId ?? file.localFile?.fileId ?? null;
  return (
    <ExchangeModelWorkbench
      file={file}
      sourceUrl={sourceUrl}
      preview={state.value}
      routeLabel={skpGlbRouteLabel(manifest)}
      status={
        skpGlbDerivativeIsFallback(manifest)
          ? "PanAEC Engine SKP 绑定 GLB 模型（非现场解析）"
          : "PanAEC Engine SKP 真实模型"
      }
      formatLabel=".skp"
      upAxis={groupModelUpAxis(state.value.group)}
      toolbarActions={
        localFileId ? (
          <SkpBomExportToolbarAction localFileId={localFileId} />
        ) : undefined
      }
    />
  );
}

// IFC 构件属性写回浮层:真实 ifcopenshell 原子编辑(版本递增 + 审计记录),
// 不做前端假改——成功后展示新版本号,几何/派生缓存按新 checksum 自动重建。
export function IfcElementEditOverlay({
  localFileId,
  element,
  onClose,
}: {
  localFileId: string;
  element: IfcElementProperties;
  onClose: () => void;
}) {
  const [name, setName] = useState(element.name ?? "");
  const [tag, setTag] = useState(element.tag ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const attributes: Record<string, string | null> = {};
    if (name !== (element.name ?? "")) attributes.Name = name || null;
    if (tag !== (element.tag ?? "")) attributes.Tag = tag || null;
    const operations = [
      {
        globalId: element.globalId,
        ...(Object.keys(attributes).length ? { attributes } : {}),
        ...(note.trim()
          ? {
              propertySet: {
                name: "PanAEC_审核",
                properties: { 备注: note.trim() },
              },
            }
          : {}),
      },
    ];
    if (!operations[0]?.attributes && !operations[0]?.propertySet) {
      setBusy(false);
      setError("没有任何变更。");
      return;
    }
    void fetch(`/api/local-files/${encodeURIComponent(localFileId)}/ifc-edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operations }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          version?: string;
          message?: string;
          applied?: Array<{ changes: string[] }>;
        };
        if (!response.ok) {
          throw new Error(payload.message || `HTTP ${response.status}`);
        }
        element.name = name;
        element.tag = tag;
        setMessage(
          `已写回 ${payload.version ?? ""}:${(payload.applied ?? [])
            .flatMap((entry) => entry.changes)
            .join("; ")}`,
        );
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="viewer-floating-panel absolute right-3 top-3 z-40 w-80 rounded-md border border-slate-700 bg-slate-900/95 p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">编辑构件属性</p>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-100"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <p className="mt-1 break-all text-xs text-slate-400">
        {element.type} · {element.globalId}
      </p>
      <label className="mt-3 block text-xs text-slate-300">
        构件名称(Name)
        <input
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs text-slate-300">
        构件标记(Tag)
        <input
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs text-slate-300">
        审核备注(写入属性集 PanAEC_审核.备注,可留空)
        <input
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="mt-3 w-full rounded bg-sky-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? "写回中…(ifcopenshell 原子编辑)" : "写回 IFC(版本递增 + 审计)"}
      </button>
      {message ? (
        <p className="mt-2 text-xs leading-5 text-emerald-300">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs leading-5 text-red-300">{error}</p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-slate-400">
        写回为真实源文件编辑:版本号递增并记录审计;派生/校验/BOM 缓存按新
        checksum 自动重建。
      </p>
    </div>
  );
}

function IfcBomExportToolbarActions({ localFileId }: { localFileId: string }) {
  const base = `/api/local-files/${encodeURIComponent(localFileId)}/bom-export`;
  return (
    <>
      <EngineeringWorkbenchIconButton
        label="导出 BOM 汇总清单"
        title="按截面/长度分组导出 BOM 汇总清单（CSV，几何实测）"
        onClick={() => window.location.assign(`${base}?format=csv`)}
      >
        <ClipboardList className="h-3.5 w-3.5" />
      </EngineeringWorkbenchIconButton>
      <EngineeringWorkbenchIconButton
        label="导出 BOM 构件明细"
        title="导出逐构件明细表（GlobalId/楼层/实测尺寸/形心）"
        onClick={() => window.location.assign(`${base}?format=elements-csv`)}
      >
        <Download className="h-3.5 w-3.5" />
      </EngineeringWorkbenchIconButton>
    </>
  );
}

function SkpBomExportToolbarAction({ localFileId }: { localFileId: string }) {
  return (
    <EngineeringWorkbenchIconButton
      label="导出 BOM 清单"
      title="按构件定义导出 BOM 清单（CSV，SDK 实例计数）"
      onClick={() => {
        window.location.assign(
          `/api/local-files/${encodeURIComponent(localFileId)}/bom-export?format=csv`,
        );
      }}
    >
      <ClipboardList className="h-3.5 w-3.5" />
    </EngineeringWorkbenchIconButton>
  );
}

export function buildSketchUpThreeGroup(
  scene: Object3D,
  file: ModuleFileNode,
  manifest: SkpDerivativeManifest,
): Group {
  const group = new Group();
  const worldUnitsToMillimeters = gltfWorldUnitsToMillimeters;
  group.name = file.name;
  group.userData = {
    sourceFormat: ".skp",
    routeLabel: skpGlbRouteLabel(manifest),
    originalName: manifest.originalName,
    worldUnitsToMillimeters,
    sourceUnitLabel: "SKP GLB derivative world unit = meter",
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
      : boxToScaledSerializableBounds(nativeBounds, worldUnitsToMillimeters);
    const materials = meshMaterialList(object);
    materials.forEach(normalizeSourceMaterialForDisplay);
    const baseMaterial = materials.find(
      (material) =>
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial,
    );
    const baseColor: [number, number, number] =
      baseMaterial instanceof MeshStandardMaterial ||
      baseMaterial instanceof MeshBasicMaterial
        ? [baseMaterial.color.r, baseMaterial.color.g, baseMaterial.color.b]
        : neutralMeshColorTuple();

    materials.forEach((material) => {
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial
      ) {
        prepareSelectableMaterial(
          material,
          colorTupleFromUserData(material.userData.architokenDisplayColor) ??
            baseColor,
        );
        material.toneMapped = false;
        material.needsUpdate = true;
      }
    });

    object.userData = {
      ...object.userData,
      componentId: object.uuid,
      componentGroupKey: sketchUpComponentGroupKey(object, group),
      sourceName: object.name || `${file.name} 构件 ${ordinal}`,
      sourceFormat: ".skp",
      objectType: object.userData.objectType ?? "SketchUp Component",
      routeLabel: skpGlbRouteLabel(manifest),
      materialSource: describeMeshMaterials(object, baseColor),
      baseColor,
      sourceProperties: [
        ...metricUserData(object.userData.sourceProperties),
        {
          label: "单位换算",
          value: "SKP GLB 派生世界单位按 meter 处理，属性面板换算为 mm",
        },
      ],
      ...(serializedBounds
        ? {
            nativeBounds: serializedBounds,
            dimensionsMm: boundsDimensions(serializedBounds),
            nativeCenterMm: boundsCenter(serializedBounds),
          }
        : {}),
    };
  });
  applyComponentAggregateBoundsToMeshes(group);
  normalizeThreeGroupReferencePlane(group, "y");
  const nativeBounds = new Box3().setFromObject(group);
  applyAggregateModelBoundsToMeshes(
    group,
    nativeBounds,
    false,
    worldUnitsToMillimeters,
  );
  return group;
}

function sketchUpComponentGroupKey(object: Mesh, root: Group): string {
  const ancestor = nearestMultiMeshAncestor(object, root);
  const nameGroupKey = sketchUpLikeComponentNameGroupKey(object);
  if (!ancestor || ancestor.parent === root) {
    return nameGroupKey ? `skp:${nameGroupKey}` : `skp:mesh:${object.uuid}`;
  }
  if (nameGroupKey) return `skp:${nameGroupKey}`;
  return `skp:node:${objectPathWithinRoot(ancestor, root)}`;
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
    message: "正在读取 PanAEC Engine 文件状态...",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSourcePreview() {
      setState({
        status: "loading",
        message: "正在读取 PanAEC Engine 文件状态...",
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
    { label: "引擎", value: panaecLabel },
    { label: "状态", value: preview.embeddedPreview ? "有预览图" : "待生成" },
  ];

  return (
    <EngineeringViewportFrame
      file={file}
      sourceUrl={sourceUrl}
      metrics={metrics}
      routeLabel={`${panaecLabel} · 源文件状态`}
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
              <MetricCard label="查看结果" value="待 PanAEC Engine 生成" />
            </div>
            {embeddedPreviewUrl && preview.embeddedPreview ? (
              <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3">
                <p className="text-xs font-medium text-emerald-200">
                  源文件内嵌预览图
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  该图来自源文件内嵌缩略图，不作为几何解析结果；正式查看结果仍由
                  PanAEC Engine 生成。
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
    routeLabel: `${panaecLabel} · 源文件状态`,
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
  options: { generatedThreeDmDerivative?: boolean } = {},
): IfcGeometryPreview {
  const group = new Group();
  group.userData.worldUnitsToMillimeters =
    lengthDisplayUnitToMillimeters(lengthUnit);
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
      const resolvedDisplay = resolveIfcElementDisplayColor(
        element ?? undefined,
        [color.x, color.y, color.z, color.w],
        {
          generatedThreeDmDerivative:
            options.generatedThreeDmDerivative === true,
          expressID: flatMesh.expressID,
        },
      );
      const displayColor = ifcDisplayColor([
        resolvedDisplay.color[0],
        resolvedDisplay.color[1],
        resolvedDisplay.color[2],
      ]);
      if (
        element &&
        resolvedDisplay.source !== "openbim-unassigned-appearance"
      ) {
        element.sourceColor = `${formatRgbColor(displayColor)} / alpha ${formatCoord(resolvedDisplay.color[3])}`;
      }
      const material = new MeshStandardMaterial({
        color: new Color(displayColor[0], displayColor[1], displayColor[2]),
        opacity: Math.max(0.18, Math.min(resolvedDisplay.color[3], 1)),
        transparent: resolvedDisplay.color[3] < 0.98,
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
        materialSource:
          element?.displayColorSource ??
          "openBIM 未声明 IfcStyledItem / IfcSurfaceStyle 表现样式",
        sourceFormat: ".ifc",
        routeLabel: `${panaecLabel} · IFC 模型`,
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
    group.userData.nativeBounds = nativeBounds.clone();
    group.userData.renderOffset = renderOffset.clone();
    group.userData.upAxis = upAxis;
    group.userData.viewTarget =
      upAxis === "y"
        ? new Vector3(center.x, nativeBounds.min.y, center.z)
        : new Vector3(center.x, center.y, nativeBounds.min.z);
    group.userData.sourceOriginPreserved = true;
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
    const name = readableEngineeringText(formatIfcValue(line.Name));
    const objectType = readableEngineeringText(formatIfcValue(line.ObjectType));
    const tag = readableEngineeringText(formatIfcValue(line.Tag));
    const predefinedType = readableEngineeringText(
      formatIfcValue(line.PredefinedType),
    );
    const properties = Object.entries(line)
      .filter(([key]) => key !== "type" && key !== "expressID")
      .map(([key, value]) => ({
        label: readableEngineeringText(key),
        value: readableEngineeringText(formatIfcValue(value)),
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

function objectMaterialList(object: Object3D): unknown[] {
  const material = (object as { material?: unknown }).material;
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
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

function neutralMeshColorTupleImpl(): [number, number, number] {
  return [
    neutralEngineeringMeshColor.r,
    neutralEngineeringMeshColor.g,
    neutralEngineeringMeshColor.b,
  ];
}

function normalizeSourceMaterialForDisplayImpl(material: unknown) {
  if (!isColorBearingMaterial(material)) return;
  const sourceColor: [number, number, number] = colorTupleFromUserData(
    material.userData.architokenSourceColor,
  ) ?? [material.color.r, material.color.g, material.color.b];
  const displayColor = engineeringVisibleMaterialColor(
    sourceColor,
    Boolean(material.vertexColors),
  );
  material.userData.architokenSourceColor = sourceColor;
  material.userData.architokenDisplayColor = displayColor.color;
  material.userData.architokenDisplayAdjusted = displayColor.adjusted;
  if (!material.vertexColors) {
    material.color.setRGB(
      displayColor.color[0],
      displayColor.color[1],
      displayColor.color[2],
    );
  }
  material.needsUpdate = true;
}

function engineeringVisibleMaterialColor(
  sourceColor: [number, number, number],
  hasVertexColors: boolean,
): { color: [number, number, number]; adjusted: boolean } {
  if (hasVertexColors || materialColorLuminance(sourceColor) >= 0.08) {
    return { color: sourceColor, adjusted: false };
  }
  return { color: neutralMeshColorTuple(), adjusted: true };
}

function materialColorLuminance(color: [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function firstMeshMaterialColor(object: Mesh): [number, number, number] | null {
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
  material.needsUpdate = true;
}

function applyMeshSelectionMaterialState(
  material: unknown,
  isSelected: boolean,
  objectBaseColor?: [number, number, number] | null,
) {
  if (!isColorBearingMaterial(material)) return;
  prepareSelectableMaterial(material);
  const materialBaseColor = colorTupleFromUserData(
    material.userData.architokenBaseColor,
  ) ??
    objectBaseColor ?? [material.color.r, material.color.g, material.color.b];

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
  const firstSourceColor = materials[0]
    ? colorTupleFromUserData(materials[0].userData.architokenSourceColor)
    : null;
  const displayAdjusted = materials.some(
    (material) => material.userData.architokenDisplayAdjusted === true,
  );
  const label = materialNames.length
    ? materialNames.slice(0, 3).join(" / ")
    : "源文件材质/颜色";
  if (displayAdjusted && firstSourceColor) {
    return `${label} · 源色 ${formatRgbColor(firstSourceColor)} -> 显示 ${formatRgbColor(
      firstColor as [number, number, number],
    )}`;
  }
  return `${label} · ${formatRgbColor(firstColor as [number, number, number])}`;
}

function boxToBounds(box: Box3): Bounds3D {
  return {
    min: vectorToSerializablePoint(box.min),
    max: vectorToSerializablePoint(box.max),
  };
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

function lengthDisplayUnitToMillimeters(unit: LengthDisplayUnit): number {
  const metersPerUnit =
    Number.isFinite(unit.metersPerUnit) && unit.metersPerUnit > 0
      ? unit.metersPerUnit
      : 1;
  return metersPerUnit * 1000;
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
  if (prefix === "CENTI")
    return { label: "cm", precision: 1, metersPerUnit: 0.01 };
  if (prefix === "DECI")
    return { label: "dm", precision: 2, metersPerUnit: 0.1 };
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
    const maxComponent = Math.max(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0);
    const factor = maxComponent > 1 ? 255 : 1;
    const normalized = new Color(
      clampNumber((color[0] ?? 0) / factor, 0, 1),
      clampNumber((color[1] ?? 0) / factor, 0, 1),
      clampNumber((color[2] ?? 0) / factor, 0, 1),
    );
    const luminance =
      normalized.r * 0.2126 + normalized.g * 0.7152 + normalized.b * 0.0722;
    return {
      color:
        luminance < 0.08 ? neutralEngineeringMeshColor.clone() : normalized,
      source:
        luminance < 0.08 ? "源文件颜色过暗，使用可视化默认色" : "源文件颜色",
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

function applyAggregateModelBoundsToMeshes(
  group: Group,
  nativeBounds: Box3,
  preferForDegenerateDimensions = false,
  worldUnitsToMillimeters = 1,
) {
  if (nativeBounds.isEmpty()) return;
  const bounds =
    worldUnitsToMillimeters === 1
      ? boxToBounds(nativeBounds)
      : boxToScaledSerializableBounds(nativeBounds, worldUnitsToMillimeters);
  const dimensions = boundsDimensions(bounds);
  const center = boundsCenter(bounds);

  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.userData = {
      ...object.userData,
      modelBounds: bounds,
      modelDimensionsMm: dimensions,
      modelCenterMm: center,
      preferModelBoundsForDegenerateDimensions:
        preferForDegenerateDimensions || undefined,
    };
  });
}

function applyComponentAggregateBoundsToMeshes(group: Group) {
  const buckets = new Map<string, { bounds: Bounds3D; meshCount: number }>();

  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const key = exchangeComponentAggregationKey(object);
    const bounds = boundsUserData(object.userData.nativeBounds);
    if (!key || !bounds) return;

    const existing = buckets.get(key);
    buckets.set(key, {
      bounds: existing ? unionBounds(existing.bounds, bounds) : bounds,
      meshCount: (existing?.meshCount ?? 0) + 1,
    });
  });

  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const key = exchangeComponentAggregationKey(object);
    if (!key) return;
    const bucket = buckets.get(key);
    if (!bucket || bucket.meshCount <= 1) return;
    object.userData = {
      ...object.userData,
      componentBounds: bucket.bounds,
      componentDimensionsMm: boundsDimensions(bucket.bounds),
      componentCenterMm: boundsCenter(bucket.bounds),
      componentMeshCount: bucket.meshCount,
    };
  });
}

function unionBounds(left: Bounds3D, right: Bounds3D): Bounds3D {
  return {
    min: {
      x: Math.min(left.min.x, right.min.x),
      y: Math.min(left.min.y, right.min.y),
      z: Math.min(left.min.z, right.min.z),
    },
    max: {
      x: Math.max(left.max.x, right.max.x),
      y: Math.max(left.max.y, right.max.y),
      z: Math.max(left.max.z, right.max.z),
    },
  };
}

function exchangeComponentAggregationKey(object: Mesh): string {
  const explicitGroupKey = stringUserData(object.userData.componentGroupKey);
  if (explicitGroupKey) return explicitGroupKey;

  const componentId = stringUserData(object.userData.componentId);
  return isGenericExchangeComponentId(componentId) ? "" : componentId;
}

export function meshSelectionAggregationKey(object: Mesh): string {
  return stringUserData(object.userData.selectionGroupKey);
}

function isGenericExchangeComponentId(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "solid" ||
    normalized === "shell" ||
    normalized === "face" ||
    normalized === "wire" ||
    normalized === "edge" ||
    normalized === "mesh" ||
    normalized === "object"
  );
}

function componentAggregateBoundsForObject(object: Mesh): {
  bounds: Bounds3D;
  meshCount: number;
} | null {
  const key = exchangeComponentAggregationKey(object);
  if (!key) return null;

  let root: Object3D = object;
  while (root.parent) root = root.parent;

  let mergedBounds: Bounds3D | null = null;
  let meshCount = 0;
  root.traverse((candidate) => {
    if (!(candidate instanceof Mesh)) return;
    if (exchangeComponentAggregationKey(candidate) !== key) return;
    const bounds = boundsUserData(candidate.userData.nativeBounds);
    if (!bounds) return;
    mergedBounds = mergedBounds ? unionBounds(mergedBounds, bounds) : bounds;
    meshCount += 1;
  });

  return mergedBounds && meshCount > 1
    ? { bounds: mergedBounds, meshCount }
    : null;
}

function isDegenerateDimensionVector(value: Bounds3DPoint | null): boolean {
  if (!value) return false;
  const epsilon = 1e-6;
  return (
    Math.abs(value.x) <= epsilon ||
    Math.abs(value.y) <= epsilon ||
    Math.abs(value.z) <= epsilon
  );
}

function shouldUseAggregateDimensions(
  localDimensions: Bounds3DPoint | null,
  aggregateDimensions: Bounds3DPoint | null,
  preferAggregate: boolean,
): boolean {
  if (!preferAggregate || !aggregateDimensions) return false;
  if (!isDegenerateDimensionVector(localDimensions)) return false;
  if (!localDimensions) return true;
  const epsilon = 1e-6;
  return (
    Math.abs(aggregateDimensions.x) > Math.abs(localDimensions.x) + epsilon ||
    Math.abs(aggregateDimensions.y) > Math.abs(localDimensions.y) + epsilon ||
    Math.abs(aggregateDimensions.z) > Math.abs(localDimensions.z) + epsilon
  );
}

export function buildExchangeObjectPropertyRows(
  object: Mesh,
  file: ModuleFileNode,
  routeLabel: string,
): IfcPropertyRow[] {
  const rawLocalBounds =
    boundsUserData(object.userData.nativeBounds) ??
    (() => {
      object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      return box ? boxToBounds(box) : null;
    })();
  const rawDimensions =
    vectorUserData(object.userData.dimensionsMm) ??
    boundsDimensions(rawLocalBounds);
  const componentAggregate = componentAggregateBoundsForObject(object);
  const componentBounds =
    boundsUserData(object.userData.componentBounds) ??
    componentAggregate?.bounds ??
    null;
  const componentDimensions =
    vectorUserData(object.userData.componentDimensionsMm) ??
    boundsDimensions(componentBounds);
  const aggregateBounds = boundsUserData(object.userData.modelBounds);
  const aggregateDimensions =
    vectorUserData(object.userData.modelDimensionsMm) ??
    boundsDimensions(aggregateBounds);
  const useComponentDimensions = shouldUseAggregateDimensions(
    rawDimensions,
    componentDimensions,
    true,
  );
  const useAggregateDimensions =
    !useComponentDimensions &&
    shouldUseAggregateDimensions(
      rawDimensions,
      aggregateDimensions,
      object.userData.preferModelBoundsForDegenerateDimensions === true,
    );
  const localBounds = useComponentDimensions
    ? componentBounds
    : useAggregateDimensions
      ? aggregateBounds
      : rawLocalBounds;
  const dimensions = useComponentDimensions
    ? componentDimensions
    : useAggregateDimensions
      ? aggregateDimensions
      : rawDimensions;
  const center = useComponentDimensions
    ? (vectorUserData(object.userData.componentCenterMm) ??
      boundsCenter(localBounds))
    : useAggregateDimensions
      ? (vectorUserData(object.userData.modelCenterMm) ??
        boundsCenter(localBounds))
      : (vectorUserData(object.userData.nativeCenterMm) ??
        boundsCenter(localBounds));
  const explicitDimensionSource = stringUserData(
    object.userData.dimensionSourceLabel,
  );
  const dimensionSource = useComponentDimensions
    ? `构件聚合包围盒（${componentAggregate?.meshCount ?? finiteNumberUserData(object.userData.componentMeshCount, 2)} 个同源 mesh 合并）`
    : useAggregateDimensions
      ? "整模包围盒（选中构件尺寸退化时回退）"
      : explicitDimensionSource || null;
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
    ...(dimensionSource
      ? [
          {
            key: "dimensionSource",
            label: "尺寸来源",
            value: dimensionSource,
          },
        ]
      : []),
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
      routeLabel: options?.routeLabel ?? `${panaecLabel} · CAD 模型`,
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
      group.userData.nativeBounds = nativeBounds.clone();
      group.userData.renderOffset = new Vector3(0, 0, 0);
      group.userData.viewTarget = new Vector3(
        center.x,
        center.y,
        nativeBounds.min.z,
      );
      group.userData.upAxis = "z";
      group.userData.sourceOriginPreserved = true;
      applyAggregateModelBoundsToMeshes(group, nativeBounds, true);
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
    group.userData.nativeBounds = nativeBounds.clone();
    group.userData.renderOffset = new Vector3(0, 0, 0);
    group.userData.viewTarget = new Vector3(
      renderCenter.x,
      renderCenter.y,
      nativeBounds.min.z,
    );
    group.userData.upAxis = "z";
    group.userData.sourceOriginPreserved = true;
    applyAggregateModelBoundsToMeshes(group, nativeBounds, true);
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

export function stlGeometryDisplayGroups(
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
  const edgeOwner = new Map<string, number>();

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const vertexKeys = stlTriangleVertexKeys(position, triangle);
    for (const key of stlTriangleEdgeKeys(vertexKeys)) {
      const owner = edgeOwner.get(key);
      if (owner === undefined) {
        edgeOwner.set(key, triangle);
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

function stlTriangleVertexKeys(
  position: VertexAttributeLike,
  triangle: number,
): [string, string, string] {
  return [0, 1, 2].map((corner) => {
    const vertex = triangle * 3 + corner;
    return quantizedStlVertexKey(
      position.getX(vertex),
      position.getY(vertex),
      position.getZ(vertex),
    );
  }) as [string, string, string];
}

function stlTriangleEdgeKeys(
  vertexKeys: [string, string, string],
): [string, string, string] {
  return [
    stlEdgeKey(vertexKeys[0], vertexKeys[1]),
    stlEdgeKey(vertexKeys[1], vertexKeys[2]),
    stlEdgeKey(vertexKeys[2], vertexKeys[0]),
  ];
}

function stlEdgeKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function quantizedStlVertexKey(x: number, y: number, z: number): string {
  const precision = 1000;
  return `${Math.round(x * precision)}:${Math.round(y * precision)}:${Math.round(z * precision)}`;
}

export function stlCoplanarFacePatchTriangleIndices(
  geometry: BufferGeometry,
  faceIndex: number,
  maxTriangles = 1600,
): number[] {
  const position = geometry.getAttribute("position");
  const triangleCount = position ? Math.floor(position.count / 3) : 0;
  if (!position || faceIndex < 0 || faceIndex >= triangleCount) return [];

  const edgeOwners = new Map<string, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const vertexKeys = stlTriangleVertexKeys(position, triangle);
    for (const edgeKey of stlTriangleEdgeKeys(vertexKeys)) {
      const owners = edgeOwners.get(edgeKey);
      if (owners) {
        owners.push(triangle);
      } else {
        edgeOwners.set(edgeKey, [triangle]);
      }
    }
  }

  const seedNormal = stlTriangleNormal(position, faceIndex);
  if (!seedNormal) return [faceIndex];

  const normalDotThreshold = Math.cos(degreesToRadians(18));
  const visited = new Uint8Array(triangleCount);
  const queue = [faceIndex];
  const result: number[] = [];
  visited[faceIndex] = 1;

  while (queue.length && result.length < maxTriangles) {
    const triangle = queue.shift();
    if (triangle === undefined) break;
    result.push(triangle);

    const vertexKeys = stlTriangleVertexKeys(position, triangle);
    for (const edgeKey of stlTriangleEdgeKeys(vertexKeys)) {
      const neighbors = edgeOwners.get(edgeKey);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (visited[neighbor]) continue;
        const normal = stlTriangleNormal(position, neighbor);
        if (!normal || normal.dot(seedNormal) < normalDotThreshold) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
  }

  return result.length ? result : [faceIndex];
}

function stlTriangleNormal(
  position: VertexAttributeLike,
  triangle: number,
): Vector3 | null {
  const offset = triangle * 3;
  const first = new Vector3(
    position.getX(offset),
    position.getY(offset),
    position.getZ(offset),
  );
  const second = new Vector3(
    position.getX(offset + 1),
    position.getY(offset + 1),
    position.getZ(offset + 1),
  );
  const third = new Vector3(
    position.getX(offset + 2),
    position.getY(offset + 2),
    position.getZ(offset + 2),
  );
  const normal = second.sub(first).cross(third.sub(first));
  return normal.lengthSq() > 1e-12 ? normal.normalize() : null;
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

function includePoint(bounds: Bounds2D, point: Bounds2DPoint) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
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
  const suspiciousCount = (
    compact.match(
      /[^\x20-\x7e\u3000-\u303f\uff01-\uff5e\u4e00-\u9fff°²³µ×ØøΦφ±≤≥]/gu,
    ) ?? []
  ).length;
  const readableCount = (compact.match(/[A-Za-z0-9_\u4e00-\u9fff]/gu) ?? [])
    .length;
  if (badCount > 0 && compact.length <= 12) return true;
  if (badCount / compact.length > 0.2) return true;
  if (suspiciousCount / compact.length > 0.25) return true;
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
