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
  BoxSelect,
  Cloud,
  Crosshair,
  Download,
  FileUp,
  Info,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  MousePointer2,
  Move3D,
  Navigation,
  PanelBottom,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  RotateCcw,
  Ruler,
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
import { BIMViewer } from "@/components/BIMViewer";
import { DockableViewerToolbar } from "@/components/DockableViewerToolbar";
import {
  extensionOf,
  fileTypeForFileName,
  stageRouteForFileName,
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
  upAxis: ModelUpAxis;
  topTypes: MetricItem[];
  keyCounts: MetricItem[];
  elements: IfcElementProperties[];
  group: Group | null;
}

interface IfcElementProperties {
  expressID: number;
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
  sourceColor?: string;
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
  viewer: "cad_vector_entities" | "dxf_canvas" | "dwg_vector_pdf";
  engine: string;
  sheets: CadDerivativeSheet[];
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
  ".obj",
  ".ply",
  ".fbx",
  ".dae",
]);
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

  if (meshExtensions.has(ext)) {
    return <MeshEngineeringViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".ifc") {
    return <IfcWasmViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".dxf") {
    return <CadNativeDrawingViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === ".dwg") {
    return <DwgVectorPdfViewer file={file} />;
  }

  if (occtExtensions.has(ext)) {
    return <OcctModelViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (unsupportedOcctKernelExtensions.has(ext)) {
    return (
      <LightweightEngineeringSourceViewer
        title="需要 OCCT/OCP 授权转换链路"
        file={file}
        sourceUrl={sourceUrl}
        reason="SAT、Parasolid X_T/X_B 属于 CAD kernel 交换格式，浏览器端不能可靠直接解析。已进入 FileTypeRegistry；生产查看需后端 OCCT/OCP 或授权 CAD adapter 生成 glTF/GLB derivative。"
      />
    );
  }

  return (
    <LightweightEngineeringSourceViewer
      title="工程源文件轻量查看"
      file={file}
      sourceUrl={sourceUrl}
      reason="当前格式未启用安全可用的浏览器几何 loader。系统先展示真实源文件绑定、签名、字节摘要和生产 adapter 路线；几何查看由后端原生/IFC/轻量化 derivative 管线生成。"
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
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const ext = file.localFile?.ext || extensionOf(file.name) || "unknown";
  const route =
    ext === ".stl"
      ? "STL native mesh 实时查看"
      : ext === ".obj"
        ? "OBJ native mesh 实时查看"
        : ext === ".ply"
          ? "PLY native mesh 实时查看"
          : ext === ".fbx"
            ? "FBX scene 实时查看"
            : ext === ".dae"
              ? "Collada scene 实时查看"
              : "GLB/glTF native derivative 实时查看";
  const metrics: ViewerMetric[] = [
    { label: "格式", value: ext },
    { label: "大小", value: formatModuleFileSize(file.size) },
    { label: "MIME", value: file.mimeType || "model/*" },
    { label: "源", value: file.localFileId ? "本地源文件" : "CDE 文件" },
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
        />
      }
      asideOpen={propertiesOpen}
      asideLabel="属性"
      onToggleAside={() => setPropertiesOpen((value) => !value)}
    >
      <BIMViewer
        sourceUrl={sourceUrl}
        fileName={file.name}
        mimeType={file.mimeType}
        className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        showStatusPanel={false}
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
          routeLabel: "STL native mesh 实时查看",
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
        "STL native mesh 实时查看",
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
      routeLabel="STL native mesh 实时查看"
      aside={
        <ExchangePropertyPanel
          file={file}
          routeLabel="STL native mesh 实时查看"
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
        status="STL native mesh 实时查看"
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
            <EngineeringCommandActions />
            {toolbarActions}
            {onToggleDrawer && drawer ? (
              <button
                type="button"
                onClick={onToggleDrawer}
                className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md"
                aria-pressed={drawerOpen}
                aria-label={drawerOpen ? `收起${drawerLabel}` : `展开${drawerLabel}`}
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
                aria-label={asideOpen ? `收起${asideLabel}` : `展开${asideLabel}`}
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

function EngineeringCommandActions() {
  return (
    <>
      <EngineeringCommandButton label="选择构件">
        <MousePointer2 className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="坐标 / 位置">
        <MapPin className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="图层">
        <Layers className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="构件树">
        <BoxSelect className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="编辑">
        <PencilLine className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="云线批注">
        <Cloud className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="查找">
        <Search className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="属性">
        <Info className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="视点">
        <Crosshair className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="移动">
        <Move3D className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="场景">
        <Maximize2 className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="漫游">
        <Navigation className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
      <EngineeringCommandButton label="测量">
        <Ruler className="h-3.5 w-3.5" />
      </EngineeringCommandButton>
    </>
  );
}

function EngineeringCommandButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      className="viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md opacity-80 disabled:opacity-60"
      title={`${label}需要后端 CAD/BIM transaction adapter`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ExchangePropertyPanel({
  file,
  routeLabel,
  metrics,
  sourceUrl,
  selectedRows,
  selectedTitle,
}: {
  file: ModuleFileNode;
  routeLabel: string;
  metrics: ViewerMetric[];
  sourceUrl: string;
  selectedRows?: IfcPropertyRow[] | undefined;
  selectedTitle?: string | undefined;
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
      value: "native mesh / exchange derivative",
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
            void exportExchangePropertyRows(file.name, primaryRows, templateFile)
          }
          className="viewer-ghost-tool inline-flex h-7 items-center justify-center gap-1 rounded px-1 text-[10px] font-medium"
          title="导出当前选中构件属性清单"
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
          <label
            key={row.key}
            className="block rounded-md bg-slate-950/20 p-2"
          >
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

function IfcWasmViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [state, setState] = useState<LoadState<IfcSummary>>({
    status: "loading",
    message: "正在加载 web-ifc WASM 并解析 IFC...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadIfc() {
      setState({
        status: "loading",
        message: "正在加载 web-ifc WASM 并解析 IFC...",
      });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`读取 IFC 失败: HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const ifc = await import("web-ifc");
        const api = new ifc.IfcAPI();
        await api.Init((path) => `/wasm/web-ifc/${path}`, true);
        const modelID = api.OpenModel(new Uint8Array(buffer), {
          COORDINATE_TO_ORIGIN: false,
          CIRCLE_SEGMENTS: 16,
        });

        if (modelID < 0) {
          api.Dispose();
          throw new Error("web-ifc 无法打开该 IFC 文件。");
        }

        const group = buildIfcGroup(api, modelID);
        activeGroup = group.group;
        const summary: IfcSummary = {
          schema: api.GetModelSchema(modelID),
          totalLines: api.GetAllLines(modelID).size(),
          totalMeshes: group.totalMeshes,
          renderedFragments: group.renderedFragments,
          truncated: group.truncated,
          nativeBounds: boxToSerializableBounds(group.nativeBounds),
          renderOffset: vectorToSerializablePoint(group.renderOffset),
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
          reason="web-ifc 能读取该文件的实体数据，但该模型没有可流式输出的几何，或几何被源文件省略。"
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
      routeLabel="IFC openBIM runtime · WASM fallback"
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
        status={`IFC 构件可选 / BIM ${summary.upAxis.toUpperCase()}-up 坐标`}
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
          <h3 className="mt-0.5 text-sm font-medium text-slate-50">
            构件属性
          </h3>
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
  xlsx.writeFile(workbook, `${safeExportName(fileName)}-selected-properties.xlsx`);
}

function modelBomRowFromPropertyRows(
  rows: IfcPropertyRow[],
): Record<string, string> {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const byLabel = new Map(rows.map((row) => [row.label, row.value]));
  const componentId =
    byKey.get("componentId") ?? byLabel.get("构件ID") ?? "";
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
  return {
    构件ID: componentId,
    三维尺寸: byKey.get("dimensions") ?? byLabel.get("三维尺寸（mm）") ?? "",
    name,
    ObjectType: objectType,
    X尺寸: byKey.get("sizeX") ?? byLabel.get("X尺寸（mm）") ?? "",
    Y尺寸: byKey.get("sizeY") ?? byLabel.get("Y尺寸（mm）") ?? "",
    Z尺寸: byKey.get("sizeZ") ?? byLabel.get("Z尺寸（mm）") ?? "",
    坐标位置: byKey.get("coordinates") ?? byLabel.get("坐标位置（mm）") ?? "",
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
    dimensions: formatMmVector(element.geometryDimensions ?? null),
    name: decodeEngineeringText(element.name),
    objectType: decodeEngineeringText(element.objectType),
    tag: decodeEngineeringText(element.tag),
    predefinedType: decodeEngineeringText(element.predefinedType),
    quantity: 1,
    material: propertyValueFromElement(element, ["Material", "材料", "材质"]),
    density: propertyValueFromElement(element, ["Density", "MassDensity", "密度"]),
    weight: propertyValueFromElement(element, ["Weight", "Mass", "重量"]),
    unit: propertyValueFromElement(element, ["Unit", "MeasureUnit", "单位"]),
    unitPrice: propertyValueFromElement(element, ["UnitPrice", "单价"]),
    totalPrice: propertyValueFromElement(element, ["TotalPrice", "TotalCost", "Amount", "总价"]),
  };
}

function propertyValueFromElement(
  element: IfcElementProperties,
  patterns: string[],
  fallback = "",
): string {
  return decodeEngineeringText(findIfcPropertyValue(element, patterns) ?? fallback);
}

export function buildIfcPropertyRows(
  file: ModuleFileNode,
  summary: IfcSummary,
  selected: IfcElementProperties | null,
  draftValues: Record<string, string>,
): IfcPropertyRow[] {
  if (!selected) return [];
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
      value: prop(["Revit", "ElementId", "Tag", "Id"], "待绑定 Revit ElementId"),
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
      label: "三维尺寸（mm）",
      value: formatMmVector(selected.geometryDimensions ?? null),
    },
    {
      key: "nativeCenter",
      label: "坐标位置（mm）",
      value: formatMmVector(selected.geometryCenter ?? null),
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
      value: prop(["TotalPrice", "TotalCost", "Amount", "总价"], defaultPending),
      editable: true,
    },
    {
      key: "size",
      label: "规格尺寸",
      value: prop(["Size", "规格", "Dimensions", "Length", "Width", "Height"], defaultPending),
      editable: true,
    },
    {
      key: "supplier",
      label: "供应厂商",
      value: prop(["Supplier", "Manufacturer", "厂商", "供应商"], defaultPending),
      editable: true,
    },
    {
      key: "grade",
      label: "等级信息",
      value: prop(["Grade", "等级", "FireRating", "LoadBearing"], defaultPending),
      editable: true,
    },
    {
      key: "conceptDesigner",
      label: "方案设计师",
      value: prop(["ConceptDesigner", "方案设计师", "方案设计", "Designer", "设计"], defaultPending),
      editable: true,
    },
    {
      key: "detailDesigner",
      label: "深化设计师",
      value: prop(["DetailDesigner", "深化设计师", "深化设计", "Detailer", "BIMDesigner"], defaultPending),
      editable: true,
    },
    {
      key: "processEngineer",
      label: "工艺工程师",
      value: prop(["ProcessEngineer", "工艺工程师", "工艺", "工法", "ManufacturingEngineer"], defaultPending),
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
      value: prop(["Zone", "Storey", "BuildingStorey", "施工区域"], defaultPending),
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
  runtimeLabel = "CAD 原生图纸实体矢量查看",
}: {
  file: ModuleFileNode;
  sourceUrl: string;
  runtimeLabel?: string;
}) {
  const [state, setState] = useState<LoadState<DxfPreview>>({
    status: "loading",
    message: "正在打开 CAD 图纸...",
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
        message: "正在打开 CAD 图纸...",
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
        title="DXF 解析失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const preview = state.value;
  if (preview.primitiveCount === 0) {
    return (
      <AdapterRequiredPanel
        title="DXF 未解析到可见 CAD 实体"
        file={file}
        reason={`已读取源 DXF，但当前前端解析器没有生成可见矢量实体。实体数 ${preview.entityCount.toLocaleString()}，待补充实体解释器：${
          preview.unsupportedEntityTypes.length
            ? preview.unsupportedEntityTypes.join("、")
            : "未声明"
        }。该文件应继续走 LibreDWG/ODA/FreeCAD worker 生成可审计矢量 manifest。`}
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
        asideLabel="DXF 解析"
        onToggleAside={() => setDetailsOpen((current) => !current)}
        aside={<DxfDetailsPanel preview={preview} />}
      >
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
            const worldXPerPixel = currentViewBox.width / Math.max(rect.width, 1);
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
      </EngineeringViewportFrame>
    </section>
  );
}

function DxfDetailsPanel({ preview }: { preview: DxfPreview }) {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="shrink-0">
        <p className="arch-primary-text text-xs font-medium">
          DXF 实体矢量解析
        </p>
        <h3 className="arch-text mt-1 text-lg font-medium">图层 / 解析状态</h3>
        {preview.paperSpaceEntityCount > 0 ? (
          <p className="arch-muted mt-2 text-xs leading-5">
            当前优先显示 model space；已跳过{" "}
            {preview.paperSpaceEntityCount.toLocaleString()} 个 paper space
            实体。
          </p>
        ) : null}
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
              已保留源 DXF，不用图片派生替代：
              {preview.unsupportedEntityTypes.join("、")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DwgVectorPdfViewer({
  file,
}: {
  file: ModuleFileNode;
}) {
  const [state, setState] = useState<LoadState<CadDerivativeManifest>>({
    status: "loading",
    message: "正在打开 DWG CAD 图纸...",
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
            "该 DWG 只有模块元数据，没有绑定真实本地文件流，无法启动后端 DWG 原生转换。",
        });
        return;
      }

      setState({
        status: "loading",
        message: "正在打开 DWG CAD 图纸...",
      });

      try {
        const response = await fetch(
          `/api/local-files/${encodeURIComponent(localFileId)}/cad-derivative?format=manifest`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await responseErrorMessage(response, "DWG 图纸打开失败"),
          );
        }
        const manifest = (await response.json()) as CadDerivativeManifest;
        if (!manifest.sheets.length) {
          throw new Error("DWG 转换成功但没有返回可浏览图纸页。");
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
        title="DWG CAD 图纸打开失败"
        file={file}
        reason={`${state.message}。系统不再自动打开带水印或外部跳转的 DDC PDF 回退；请使用已源码编译的 LibreDWG、ODAFileConverter 或隔离授权 sidecar 读取 DWG 实体并输出 CAD 矢量图纸。`}
      />
    );
  }

  const manifest = state.value;
  const selectedSheet =
    manifest.sheets.find((sheet) => sheet.id === selectedSheetId) ??
    manifest.sheets[0];

  if (
    (manifest.viewer === "cad_vector_entities" ||
      manifest.viewer === "dxf_canvas") &&
    selectedSheet
  ) {
    return (
      <CadNativeDrawingViewer
        file={file}
        sourceUrl={selectedSheet.url}
        runtimeLabel={`DWG CAD 图纸实体矢量 · ${manifest.engine}`}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="DWG 引擎" value={manifest.engine} />
        <MetricCard
          label="源格式"
          value={manifest.sourceFormat.toUpperCase()}
        />
        <MetricCard
          label="图纸页"
          value={manifest.sheets.length.toLocaleString()}
        />
        <MetricCard label="查看模式" value="DWG 后端矢量页" />
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
              title={`打开 DWG 图纸页 ${sheet.name}`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
        <p className="arch-muted mt-3 text-xs leading-5">
          这是显式启用的授权 DWG 矢量页回退。默认生产路径优先使用 DWG-to-DXF
          实体矢量，并禁止自动打开带水印或外部跳转的第三方页面。
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
    const points = primitive.points.map((point) =>
      dxfSvgPoint(bounds, point),
    );
    const d = dxfPathFromPoints(points, primitive.closed);
    return d ? <path d={d} fill="none" {...common} /> : null;
  }

  if (primitive.kind === "solid") {
    const points = primitive.points.map((point) =>
      dxfSvgPoint(bounds, point),
    );
    const d = dxfPathFromPoints(points, true);
    return d ? (
      <path
        d={d}
        fill="none"
        strokeOpacity={0.72}
        {...common}
      />
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
      <g stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
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
  let start = primitive.startAngle;
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
  let start = primitive.startAngle;
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
    arrowup: () =>
      setViewport((current) => ({ ...current, panY: current.panY + step })),
    arrowdown: () =>
      setViewport((current) => ({ ...current, panY: current.panY - step })),
    arrowleft: () =>
      setViewport((current) => ({ ...current, panX: current.panX + step })),
    arrowright: () =>
      setViewport((current) => ({ ...current, panX: current.panX - step })),
    w: () =>
      setViewport((current) => ({
        ...current,
        zoom: Math.min(30, current.zoom * zoomStep),
      })),
    s: () =>
      setViewport((current) => ({
        ...current,
        zoom: Math.max(0.08, current.zoom / zoomStep),
      })),
    a: () =>
      setViewport((current) => ({ ...current, panX: current.panX + step })),
    d: () =>
      setViewport((current) => ({ ...current, panX: current.panX - step })),
    q: () =>
      setViewport((current) => ({ ...current, panY: current.panY - step })),
    e: () =>
      setViewport((current) => ({ ...current, panY: current.panY + step })),
    r: () => setViewport({ zoom: 1, panX: 0, panY: 0 }),
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
    message: "正在打开 CAD exchange 源文件...",
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadOcct() {
      setState({
        status: "loading",
        message: "正在打开 CAD exchange 源文件...",
      });

      try {
        const ext = (
          file.localFile?.ext || extensionOf(file.name)
        ).toLowerCase();
        const cacheKey = occtMeshCacheKey(file, sourceUrl, ext);
        const meshes = await readOcctMeshes(cacheKey, sourceUrl, ext);

        const preview = buildOcctGroup(meshes, {
          sourceFormat: ext,
          sourceName: file.name,
          mimeType: file.mimeType,
          routeLabel: "OCCT WASM CAD exchange 真实解析",
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
        title="OCCT 解析失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const ext = file.localFile?.ext || extensionOf(file.name);
  const routeLabel = "OCCT WASM CAD exchange 真实解析";
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
        status="OCCT WASM CAD exchange 真实解析"
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
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const baseColor = object.userData.baseColor as
        | [number, number, number]
        | undefined;
      const isSelected =
        object.userData.expressID === selectedExpressID ||
        object.uuid === selectedObjectUuid;
      materials.forEach((material) => {
        if (
          !(material instanceof MeshStandardMaterial) &&
          !(material instanceof MeshBasicMaterial)
        ) {
          return;
        }
        if (baseColor && !material.vertexColors) {
          material.color.setRGB(baseColor[0], baseColor[1], baseColor[2]);
        }
        if (material instanceof MeshStandardMaterial) {
          material.emissive = new Color(isSelected ? "#f59e0b" : "#000000");
          material.emissiveIntensity = isSelected ? 0.45 : 0;
        }
        material.needsUpdate = true;
      });
    });
  }, [group, selectedExpressID, selectedObjectUuid]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    const nearestMesh = findNearestMesh(event.object);
    const expressID = findExpressID(event.object);
    if (!expressID && !nearestMesh) return;
    event.stopPropagation();
    if (expressID) onMeshSelect?.(expressID);
    if (nearestMesh) onObjectSelect?.(nearestMesh);
  }

  const renderOffset = vectorUserData(group?.userData.renderOffset);
  const baseRotationX = upAxis === "z" ? -Math.PI / 2 : 0;

  return (
    <section
      className={
        className ??
        "relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      }
      tabIndex={0}
      onKeyDown={(event) => handleModelKeyDown(event, setViewTransform)}
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
          target={[0, 0, 0]}
        />
      </Canvas>
    </section>
  );
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
) {
  const moveStep = event.shiftKey ? 4 : 1;
  const rotateStep = event.shiftKey ? 0.18 : 0.08;
  const key = event.key.toLowerCase();
  const handlers: Record<string, () => void> = {
    arrowup: () =>
      setViewTransform((current) => ({
        ...current,
        offsetZ: current.offsetZ - moveStep,
      })),
    arrowdown: () =>
      setViewTransform((current) => ({
        ...current,
        offsetZ: current.offsetZ + moveStep,
      })),
    arrowleft: () =>
      setViewTransform((current) => ({
        ...current,
        offsetX: current.offsetX - moveStep,
      })),
    arrowright: () =>
      setViewTransform((current) => ({
        ...current,
        offsetX: current.offsetX + moveStep,
      })),
    w: () =>
      setViewTransform((current) => ({
        ...current,
        rotateX: current.rotateX - rotateStep,
      })),
    s: () =>
      setViewTransform((current) => ({
        ...current,
        rotateX: current.rotateX + rotateStep,
      })),
    a: () =>
      setViewTransform((current) => ({
        ...current,
        rotateY: current.rotateY - rotateStep,
      })),
    d: () =>
      setViewTransform((current) => ({
        ...current,
        rotateY: current.rotateY + rotateStep,
      })),
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
    occtRuntimePromise = import("occt-import-js").then(({ default: occtimportjs }) =>
      occtimportjs({
        locateFile: (path) => `/wasm/occt-import-js/${path}`,
      }),
    );
  }
  return occtRuntimePromise;
}

function occtMeshCacheKey(
  file: ModuleFileNode,
  sourceUrl: string,
  ext: string,
): string {
  return [
    sourceUrl,
    ext,
    file.localFile?.checksum ?? file.checksum ?? file.updatedAt ?? file.size,
  ].join(":");
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
      throw new Error(result.error ?? "OCCT 未生成可渲染 mesh。");
    }

    return result.meshes;
  })().catch((error) => {
    occtMeshCache.delete(cacheKey);
    throw error;
  });

  occtMeshCache.set(cacheKey, promise);
  return promise;
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

function LoadingPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="relative flex min-h-[calc(100vh-220px)] items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950/95 p-4 text-center shadow-xl">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
        <p className="mt-3 truncate text-sm font-medium">{title}</p>
        <span className="sr-only">{message}</span>
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
    message: "正在读取工程源文件摘要...",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSourcePreview() {
      setState({
        status: "loading",
        message: "正在读取工程源文件摘要...",
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
        reason={`${reason} 源文件摘要读取失败：${state.message}`}
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
    { label: "签名", value: preview.signature || "empty" },
    { label: "预览", value: preview.embeddedPreview ? "内嵌图" : "源摘要" },
  ];

  return (
    <EngineeringViewportFrame
      metrics={metrics}
      routeLabel={preview.routeLabel}
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
        <div className="grid min-h-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.52fr)]">
          <section className="min-w-0 rounded-md border border-slate-800 bg-slate-900/72 p-4">
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
              <MetricCard label="Registry" value={preview.registryLabel} />
              <MetricCard
                label="源文件绑定"
                value={file.localFileId ?? file.localFile?.fileId ?? file.id}
              />
              <MetricCard
                label="读取模式"
                value={
                  preview.isProbablyText ? "text signature" : "binary signature"
                }
              />
            </div>
            {embeddedPreviewUrl && preview.embeddedPreview ? (
              <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3">
                <p className="text-xs font-medium text-emerald-200">
                  DWG 源文件内嵌预览图
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  该图来自 DWG 二进制内嵌缩略/预览图，不作为几何解析结果；几何实体仍走授权 adapter 或 DXF 派生。
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={embeddedPreviewUrl}
                  alt={`${file.name} ${preview.embeddedPreview.label}`}
                  className="mt-3 max-h-[52vh] max-w-full rounded-md border border-slate-700 bg-white object-contain"
                />
              </div>
            ) : null}
            <pre className="mt-4 max-h-[52vh] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200">
              {preview.isProbablyText
                ? preview.asciiPreview
                : preview.hexPreview}
            </pre>
          </section>

          <section className="min-w-0 rounded-md border border-slate-800 bg-slate-900/72 p-4">
            <h3 className="text-sm font-medium text-white">Byte signature</h3>
            <pre className="mt-3 max-h-[52vh] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300">
              {preview.hexPreview}
            </pre>
            <h3 className="mt-4 text-sm font-medium text-white">
              Readable head
            </h3>
            <pre className="mt-3 max-h-56 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300">
              {preview.asciiPreview || "(empty)"}
            </pre>
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
  const previewRoute = stageRouteForFileName(file.name, "preview");
  const convertRoute = stageRouteForFileName(file.name, "convert");
  const registryEntry = fileTypeForFileName(file.name);
  const embeddedPreview = extractEmbeddedRasterPreview(bytes);

  return {
    byteLength: buffer.byteLength,
    signature: bytesToHex(signatureBytes, false),
    mimeType:
      file.mimeType || registryEntry?.mimeType || "application/octet-stream",
    registryLabel: registryEntry?.label ?? "Unregistered engineering source",
    routeLabel: routeLabelFromStages(previewRoute, convertRoute),
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

function routeLabelFromStages(
  previewRoute: ReturnType<typeof stageRouteForFileName>,
  convertRoute: ReturnType<typeof stageRouteForFileName>,
): string {
  const preview = previewRoute
    ? `${previewRoute.mode}/${previewRoute.status}`
    : "preview/unregistered";
  const convert = convertRoute ? `${convertRoute.adapter}` : "adapter pending";
  return `${preview} · ${convert}`;
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
  const pngStart = indexOfBytes(scan, [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
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
    if (size > 54 && size <= 16 * 1024 * 1024 && bmpStart + size <= scan.length) {
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
      const displayColor = ifcDisplayColor(
        [color.x, color.y, color.z],
        element?.type ?? "IFCENTITY",
        flatMesh.expressID,
      );
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
        routeLabel: "IFC openBIM runtime · WASM fallback",
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
    element.geometryDimensions = vectorToSerializablePoint(
      bounds.getSize(new Vector3()),
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
  _ifcType: string,
  _expressID: number,
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

function scoreDxfDecodedText(source: DxfSourceText, preferredDecoder: string): number {
  const text = source.text;
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  const mojibakeCount = (text.match(/[ÃÂ�]/g) ?? []).length;
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const declaredBonus = source.decoder === preferredDecoder ? -30 : 0;
  const chineseBonus = source.decoder === "gb18030" && cjkCount > 0 ? -20 : 0;
  return replacementCount * 1000 + mojibakeCount * 120 - cjkCount + declaredBonus + chineseBonus;
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
  const focusBounds = buildDxfFocusBounds(primitives, safeBounds);
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

function buildDxfFocusBounds(
  primitives: DxfPrimitive[],
  fallback: Bounds2D,
): Bounds2D {
  const points = primitives
    .flatMap(dxfPrimitiveReferencePoints)
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 24) return fallback;
  const clustered = densestDxfClusterBounds(points, fallback);
  if (clustered) return clustered;

  const xs = points.map((point) => point.x).sort((left, right) => left - right);
  const ys = points.map((point) => point.y).sort((left, right) => left - right);
  const trim = Math.min(Math.floor(points.length * 0.02), 80);
  const minX = xs[trim] ?? fallback.minX;
  const maxX = xs[xs.length - trim - 1] ?? fallback.maxX;
  const minY = ys[trim] ?? fallback.minY;
  const maxY = ys[ys.length - trim - 1] ?? fallback.maxY;
  const focused = normalizeBounds({ minX, minY, maxX, maxY });
  const fallbackArea = Math.max(
    (fallback.maxX - fallback.minX) * (fallback.maxY - fallback.minY),
    1,
  );
  const focusedArea = Math.max(
    (focused.maxX - focused.minX) * (focused.maxY - focused.minY),
    1,
  );

  return focusedArea < fallbackArea * 0.98 ? focused : fallback;
}

function densestDxfClusterBounds(
  points: Array<{ x: number; y: number }>,
  fallback: Bounds2D,
): Bounds2D | null {
  const width = Math.max(fallback.maxX - fallback.minX, 1);
  const height = Math.max(fallback.maxY - fallback.minY, 1);
  const bins = 56;
  const counts = new Map<string, number>();

  for (const point of points) {
    const ix = Math.max(
      0,
      Math.min(
        bins - 1,
        Math.floor(((point.x - fallback.minX) / width) * bins),
      ),
    );
    const iy = Math.max(
      0,
      Math.min(
        bins - 1,
        Math.floor(((point.y - fallback.minY) / height) * bins),
      ),
    );
    const key = `${ix}:${iy}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestKey = "";
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  if (!bestKey || bestCount < 16) return null;

  const [bestX, bestY] = bestKey.split(":").map(Number);
  if (bestX === undefined || bestY === undefined) return null;
  const clusterPoints = points.filter((point) => {
    const ix = Math.max(
      0,
      Math.min(
        bins - 1,
        Math.floor(((point.x - fallback.minX) / width) * bins),
      ),
    );
    const iy = Math.max(
      0,
      Math.min(
        bins - 1,
        Math.floor(((point.y - fallback.minY) / height) * bins),
      ),
    );
    return Math.abs(ix - bestX) <= 2 && Math.abs(iy - bestY) <= 2;
  });
  if (clusterPoints.length < 24) return null;

  const bounds = createEmptyBounds();
  clusterPoints.forEach((point) => includePoint(bounds, { ...point, z: 0 }));
  const normalized = padBounds(normalizeBounds(bounds), 0.14);
  const fallbackArea = Math.max(width * height, 1);
  const focusedArea = Math.max(
    (normalized.maxX - normalized.minX) * (normalized.maxY - normalized.minY),
    1,
  );
  return focusedArea < fallbackArea * 0.75 ? normalized : null;
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

function dxfPrimitiveReferencePoints(
  primitive: DxfPrimitive,
): Array<{ x: number; y: number }> {
  if (primitive.kind === "polyline" || primitive.kind === "solid") {
    return primitive.points;
  }
  if (primitive.kind === "circle" || primitive.kind === "arc") {
    return [
      { x: primitive.cx - primitive.r, y: primitive.cy - primitive.r },
      { x: primitive.cx + primitive.r, y: primitive.cy + primitive.r },
      { x: primitive.cx, y: primitive.cy },
    ];
  }
  if (primitive.kind === "point") {
    return [{ x: primitive.x, y: primitive.y }];
  }
  if (primitive.kind === "ellipse") {
    return [
      { x: primitive.cx - primitive.rx, y: primitive.cy - primitive.ry },
      { x: primitive.cx + primitive.rx, y: primitive.cy + primitive.ry },
      { x: primitive.cx, y: primitive.cy },
    ];
  }
  return [{ x: primitive.x, y: primitive.y }];
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

function formatMmVector(value: Bounds3DPoint | null): string {
  if (!value) return "待解析";
  return `X ${formatMm(value.x)} / Y ${formatMm(value.y)} / Z ${formatMm(value.z)}`;
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
    vectorUserData(object.userData.dimensionsMm) ?? boundsDimensions(localBounds);
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
      value: object.name || stringUserData(object.userData.sourceName, object.uuid),
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
      value: formatMmVector(dimensions),
    },
    { key: "sizeX", label: "X尺寸（mm）", value: formatMm(dimensions?.x ?? 0) },
    { key: "sizeY", label: "Y尺寸（mm）", value: formatMm(dimensions?.y ?? 0) },
    { key: "sizeZ", label: "Z尺寸（mm）", value: formatMm(dimensions?.z ?? 0) },
    {
      key: "coordinates",
      label: "坐标位置（mm）",
      value: formatMmVector(center),
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
      value: stringUserData(object.userData.sourceFormat, extensionOf(file.name)),
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
      objectType: "CAD exchange mesh",
      sourceFormat: options?.sourceFormat ?? "CAD exchange",
      sourceName: options?.sourceName ?? mesh.name ?? `occt-mesh-${index}`,
      routeLabel: options?.routeLabel ?? "OCCT WASM CAD exchange 真实解析",
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
      (stlGroups.length === 1 ? options.sourceName : `${options.sourceName} #${index + 1}`);
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
        { label: "源顶点范围", value: `${stlGroup.start} - ${stlGroup.start + stlGroup.count}` },
        { label: "顶点", value: stats.vertexCount.toLocaleString() },
        { label: "三角面", value: stats.faceCount.toLocaleString() },
        { label: "颜色", value: hasVertexColors ? "源文件 vertex color" : "源文件未声明" },
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

function stlGeometryDisplayGroups(geometry: BufferGeometry): StlGeometryGroup[] {
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

function connectedStlTriangleGroups(geometry: BufferGeometry): StlGeometryGroup[] {
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
      output[index * itemSize + item] = attribute.getComponent(start + index, item);
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
