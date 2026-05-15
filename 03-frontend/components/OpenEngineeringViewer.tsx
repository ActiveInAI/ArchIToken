// components/OpenEngineeringViewer.tsx - Browser-native open engineering viewers
// License: Apache-2.0
'use client';

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, Environment, Grid, Html, OrbitControls } from '@react-three/drei';
import { AlertTriangle } from 'lucide-react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { BIMViewer } from '@/components/BIMViewer';
import { extensionOf } from '@/lib/file-type-registry';
import { formatModuleFileSize, type ModuleFileNode } from '@/lib/module-file-system';
import type { IDxf, IEntity, IPoint } from 'dxf-parser';
import type * as WebIfc from 'web-ifc';

interface OpenEngineeringViewerProps {
  file: ModuleFileNode;
  sourceUrl: string;
}

type LoadState<T> =
  | { status: 'loading'; message: string }
  | { status: 'ready'; value: T }
  | { status: 'failed'; message: string };

interface MetricItem {
  label: string;
  value: string;
}

interface IfcSummary {
  schema: string;
  totalLines: number;
  totalMeshes: number;
  renderedFragments: number;
  truncated: boolean;
  topTypes: MetricItem[];
  keyCounts: MetricItem[];
  group: Group | null;
}

interface DxfPrimitiveBase {
  layer: string;
}

interface DxfPathPrimitive extends DxfPrimitiveBase {
  kind: 'path';
  d: string;
}

interface DxfCirclePrimitive extends DxfPrimitiveBase {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}

interface DxfTextPrimitive extends DxfPrimitiveBase {
  kind: 'text';
  x: number;
  y: number;
  value: string;
  size: number;
}

type DxfPrimitive =
  | DxfPathPrimitive
  | DxfCirclePrimitive
  | DxfTextPrimitive;

interface DxfPreview {
  primitiveCount: number;
  entityCount: number;
  layers: string[];
  bounds: Bounds2D;
  primitives: DxfPrimitive[];
}

interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface OcctPreview {
  meshCount: number;
  vertexCount: number;
  faceCount: number;
  group: Group;
}

const meshExtensions = new Set(['.glb', '.gltf', '.stl', '.obj', '.ply']);
const occtExtensions = new Set(['.step', '.stp', '.iges', '.igs', '.brep']);
const unsupportedOcctKernelExtensions = new Set(['.sat', '.x_t', '.x_b']);
const ifcKeyTypes = [
  ['IFCPROJECT', '项目'],
  ['IFCSITE', '场地'],
  ['IFCBUILDING', '建筑'],
  ['IFCBUILDINGSTOREY', '楼层'],
  ['IFCBEAM', '梁'],
  ['IFCCOLUMN', '柱'],
  ['IFCMEMBER', '杆件'],
  ['IFCPLATE', '板件'],
  ['IFCWALL', '墙'],
  ['IFCSLAB', '楼板'],
  ['IFCDOOR', '门'],
  ['IFCWINDOW', '窗'],
] as const;

const maxIfcFragments = 5000;

export function OpenEngineeringViewer({
  file,
  sourceUrl,
}: OpenEngineeringViewerProps) {
  const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();

  if (meshExtensions.has(ext)) {
    return (
      <BIMViewer
        sourceUrl={sourceUrl}
        fileName={file.name}
        mimeType={file.mimeType}
        className="relative min-h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
      />
    );
  }

  if (ext === '.ifc') {
    return <IfcWasmViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (ext === '.dxf') {
    return <DxfSvgViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (occtExtensions.has(ext)) {
    return <OcctModelViewer file={file} sourceUrl={sourceUrl} />;
  }

  if (unsupportedOcctKernelExtensions.has(ext)) {
    return (
      <AdapterRequiredPanel
        title="需要 OCCT/OCP 授权转换链路"
        file={file}
        reason="SAT、Parasolid X_T/X_B 属于 CAD kernel 交换格式，浏览器端不能可靠直接解析。已进入 FileTypeRegistry；生产查看需后端 OCCT/OCP 或授权 CAD adapter 生成 glTF/GLB derivative。"
      />
    );
  }

  return (
    <AdapterRequiredPanel
      title="需要专用 viewer/worker"
      file={file}
      reason="该工程格式已入库，但当前浏览器端没有安全可用的开源解析器。必须接入对应 worker 或授权服务后生成 derivative。"
    />
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
    status: 'loading',
    message: '正在加载 web-ifc WASM 并解析 IFC...',
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadIfc() {
      setState({
        status: 'loading',
        message: '正在加载 web-ifc WASM 并解析 IFC...',
      });

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`读取 IFC 失败: HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const ifc = await import('web-ifc');
        const api = new ifc.IfcAPI();
        await api.Init((path) => `/wasm/web-ifc/${path}`, true);
        const modelID = api.OpenModel(new Uint8Array(buffer), {
          COORDINATE_TO_ORIGIN: true,
          CIRCLE_SEGMENTS: 16,
        });

        if (modelID < 0) {
          api.Dispose();
          throw new Error('web-ifc 无法打开该 IFC 文件。');
        }

        const group = buildIfcGroup(api, modelID);
        activeGroup = group.group;
        const summary: IfcSummary = {
          schema: api.GetModelSchema(modelID),
          totalLines: api.GetAllLines(modelID).size(),
          totalMeshes: group.totalMeshes,
          renderedFragments: group.renderedFragments,
          truncated: group.truncated,
          topTypes: buildIfcTopTypes(api, modelID),
          keyCounts: buildIfcKeyCounts(ifc, api, modelID),
          group: group.group,
        };

        api.CloseModel(modelID);
        api.Dispose();

        if (!cancelled) {
          setState({ status: 'ready', value: summary });
        } else if (group.group) {
          disposeGroup(group.group);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'failed',
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

  if (state.status === 'loading') {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === 'failed') {
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
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Schema" value={summary.schema} />
        <MetricCard label="IFC 行" value={summary.totalLines.toLocaleString()} />
        <MetricCard label="几何网格" value={summary.totalMeshes.toLocaleString()} />
        <MetricCard
          label="渲染片段"
          value={
            summary.truncated
              ? `${summary.renderedFragments.toLocaleString()}+`
              : summary.renderedFragments.toLocaleString()
          }
        />
      </div>

      {summary.group ? (
        <ThreeGroupViewport
          group={summary.group}
          label={file.name}
          status="IFC / web-ifc WASM 真实解析"
        />
      ) : (
        <AdapterRequiredPanel
          title="IFC 已解析，但未生成几何"
          file={file}
          reason="web-ifc 能读取该文件的实体数据，但该模型没有可流式输出的几何，或几何被源文件省略。"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <SummaryGrid title="关键对象" items={summary.keyCounts} />
        <SummaryGrid title="IFC 实体 Top 24" items={summary.topTypes} />
      </div>
    </section>
  );
}

function DxfSvgViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [state, setState] = useState<LoadState<DxfPreview>>({
    status: 'loading',
    message: '正在解析 DXF 并生成 SVG 预览...',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDxf() {
      setState({
        status: 'loading',
        message: '正在解析 DXF 并生成 SVG 预览...',
      });

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`读取 DXF 失败: HTTP ${response.status}`);
        }
        const text = await response.text();
        const { default: DxfParser } = await import('dxf-parser');
        const parser = new DxfParser();
        const parsed = parser.parseSync(text);

        if (!parsed) {
          throw new Error('DXF parser 未返回实体数据。');
        }

        const preview = buildDxfPreview(parsed);
        if (!cancelled) {
          setState({ status: 'ready', value: preview });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'failed',
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

  if (state.status === 'loading') {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === 'failed') {
    return (
      <AdapterRequiredPanel
        title="DXF 解析失败"
        file={file}
        reason={state.message}
      />
    );
  }

  const preview = state.value;
  const width = Math.max(preview.bounds.maxX - preview.bounds.minX, 1);
  const height = Math.max(preview.bounds.maxY - preview.bounds.minY, 1);
  const padding = Math.max(width, height) * 0.04;
  const viewBox = [
    preview.bounds.minX - padding,
    -preview.bounds.maxY - padding,
    width + padding * 2,
    height + padding * 2,
  ].join(' ');

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="DXF 实体" value={preview.entityCount.toLocaleString()} />
        <MetricCard label="SVG 图元" value={preview.primitiveCount.toLocaleString()} />
        <MetricCard label="图层" value={preview.layers.length.toLocaleString()} />
        <MetricCard label="大小" value={formatModuleFileSize(file.size)} />
      </div>

      <div className="arch-card h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-xl border">
        <svg
          role="img"
          aria-label={`${file.name} DXF preview`}
          viewBox={viewBox}
          className="h-full w-full bg-[var(--arch-surface)]"
        >
          <g transform="scale(1 -1)">
            {preview.primitives.map((primitive, index) => {
              if (primitive.kind === 'circle') {
                return (
                  <circle
                    key={`${primitive.layer}-${index}`}
                    cx={primitive.cx}
                    cy={primitive.cy}
                    r={primitive.r}
                    fill="none"
                    stroke="var(--arch-primary)"
                    strokeWidth={Math.max(width, height) / 900}
                  />
                );
              }

              if (primitive.kind === 'text') {
                return (
                  <text
                    key={`${primitive.layer}-${index}`}
                    x={primitive.x}
                    y={primitive.y}
                    transform={`scale(1 -1) translate(0 ${-2 * primitive.y})`}
                    fill="var(--arch-text)"
                    fontSize={Math.max(primitive.size, Math.max(width, height) / 90)}
                  >
                    {primitive.value}
                  </text>
                );
              }

              return (
                <path
                  key={`${primitive.layer}-${index}`}
                  d={primitive.d}
                  fill="none"
                  stroke="var(--arch-primary)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={Math.max(width, height) / 900}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}

function OcctModelViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [state, setState] = useState<LoadState<OcctPreview>>({
    status: 'loading',
    message: '正在加载 OCCT WASM 并解析 CAD exchange 文件...',
  });

  useEffect(() => {
    let cancelled = false;
    let activeGroup: Group | null = null;

    async function loadOcct() {
      setState({
        status: 'loading',
        message: '正在加载 OCCT WASM 并解析 CAD exchange 文件...',
      });

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`读取 CAD 文件失败: HTTP ${response.status}`);
        }
        const content = new Uint8Array(await response.arrayBuffer());
        const { default: occtimportjs } = await import('occt-import-js');
        const occt = await occtimportjs({
          locateFile: (path) => `/wasm/occt-import-js/${path}`,
        });
        const ext = (file.localFile?.ext || extensionOf(file.name)).toLowerCase();
        const params = {
          linearUnit: 'millimeter' as const,
          linearDeflectionType: 'bounding_box_ratio' as const,
          linearDeflection: 0.001,
          angularDeflection: 0.5,
        };
        const result =
          ext === '.brep'
            ? occt.ReadBrepFile(content, params)
            : ext === '.iges' || ext === '.igs'
              ? occt.ReadIgesFile(content, params)
              : occt.ReadStepFile(content, params);

        if (!result.success || !result.meshes?.length) {
          throw new Error(result.error ?? 'OCCT 未生成可渲染 mesh。');
        }

        const preview = buildOcctGroup(result.meshes);
        activeGroup = preview.group;

        if (!cancelled) {
          setState({ status: 'ready', value: preview });
        } else {
          disposeGroup(preview.group);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'failed',
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
  }, [file, sourceUrl]);

  if (state.status === 'loading') {
    return <LoadingPanel title={file.name} message={state.message} />;
  }

  if (state.status === 'failed') {
    return (
      <AdapterRequiredPanel
        title="OCCT 解析失败"
        file={file}
        reason={state.message}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Mesh" value={state.value.meshCount.toLocaleString()} />
        <MetricCard label="顶点" value={state.value.vertexCount.toLocaleString()} />
        <MetricCard label="三角面" value={state.value.faceCount.toLocaleString()} />
        <MetricCard label="格式" value={file.localFile?.ext || extensionOf(file.name)} />
      </div>
      <ThreeGroupViewport
        group={state.value.group}
        label={file.name}
        status="OCCT WASM CAD exchange 真实解析"
      />
    </section>
  );
}

function ThreeGroupViewport({
  group,
  label,
  status,
}: {
  group: Group;
  label: string;
  status: string;
}) {
  return (
    <section className="relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="absolute left-4 top-4 z-10 rounded-xl border border-slate-700 bg-slate-950/85 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
        <p className="font-black">{status}</p>
        <p className="mt-1 max-w-[32rem] truncate text-xs text-slate-300">
          {label}
        </p>
      </div>
      <Canvas shadows="percentage" camera={{ position: [12, 10, 12], fov: 45 }}>
        <color attach="background" args={['#020817']} />
        <ambientLight intensity={0.58} />
        <directionalLight position={[10, 14, 10]} intensity={1.15} castShadow />
        <Environment preset="city" />
        <Grid
          infiniteGrid
          fadeDistance={80}
          sectionColor="#1f9f7a"
          cellColor="#1e293b"
        />
        <Center>
          <Bounds fit clip observe margin={1.15}>
            <primitive object={group} />
          </Bounds>
        </Center>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </section>
  );
}

function LoadingPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="relative min-h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <Canvas camera={{ position: [6, 5, 6], fov: 45 }}>
        <color attach="background" args={['#020817']} />
        <ambientLight intensity={0.6} />
        <Grid
          infiniteGrid
          fadeDistance={45}
          sectionColor="#334155"
          cellColor="#1e293b"
        />
        <Html center>
          <div className="w-80 rounded-2xl border border-slate-700 bg-slate-950/90 p-4 text-center text-slate-100 shadow-xl backdrop-blur">
            <p className="text-sm font-black">{title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{message}</p>
          </div>
        </Html>
      </Canvas>
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
    <section className="arch-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="arch-primary-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="arch-text text-xl font-black">{title}</h3>
          <p className="arch-muted mt-2 max-w-4xl text-sm leading-6">
            {reason}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="格式"
              value={file.localFile?.ext || extensionOf(file.name) || 'unknown'}
            />
            <MetricCard label="MIME" value={file.mimeType} />
            <MetricCard label="大小" value={formatModuleFileSize(file.size)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted rounded-2xl border px-3 py-3">
      <p className="arch-muted text-[11px] font-bold">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function SummaryGrid({ title, items }: { title: string; items: MetricItem[] }) {
  return (
    <section className="arch-card rounded-2xl p-4">
      <h3 className="arch-text text-base font-black">{title}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="arch-card-muted rounded-xl border px-3 py-2"
          >
            <p className="arch-text truncate text-sm font-black">{item.label}</p>
            <p className="arch-primary-text mt-1 text-xs font-bold">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildIfcTopTypes(
  api: WebIfc.IfcAPI,
  modelID: number,
): MetricItem[] {
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
  ifc: typeof import('web-ifc'),
  api: WebIfc.IfcAPI,
  modelID: number,
): MetricItem[] {
  const items: MetricItem[] = [];

  for (const [constantName, label] of ifcKeyTypes) {
      const typeID = ifc[constantName];
      if (typeof typeID !== 'number') continue;
      const value = api
        .GetLineIDsWithType(modelID, typeID, true)
        .size()
        .toLocaleString();
      items.push({ label, value });
  }

  return items;
}

function buildIfcGroup(api: WebIfc.IfcAPI, modelID: number) {
  const group = new Group();
  let totalMeshes = 0;
  let renderedFragments = 0;
  let truncated = false;

  api.StreamAllMeshes(modelID, (flatMesh) => {
    totalMeshes += 1;

    for (let index = 0; index < flatMesh.geometries.size(); index += 1) {
      if (renderedFragments >= maxIfcFragments) {
        truncated = true;
        break;
      }

      const placedGeometry = flatMesh.geometries.get(index);
      const geometry = api.GetGeometry(modelID, placedGeometry.geometryExpressID);
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

      const color = placedGeometry.color;
      const material = new MeshStandardMaterial({
        color: new Color(color.x, color.y, color.z),
        opacity: Math.max(0.18, Math.min(color.w, 1)),
        transparent: color.w < 0.98,
        roughness: 0.55,
        metalness: 0.08,
        side: DoubleSide,
      });
      group.add(new Mesh(meshGeometry, material));
      renderedFragments += 1;
      disposeWebIfcHandle(geometry);
    }

    disposeWebIfcHandle(flatMesh.geometries);
    disposeWebIfcHandle(flatMesh);
  });

  return {
    group: renderedFragments > 0 ? group : null,
    totalMeshes,
    renderedFragments,
    truncated,
  };
}

function disposeWebIfcHandle(handle: unknown) {
  const releasable = handle as { delete?: () => void };
  if (typeof releasable.delete === 'function') {
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
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indexData), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function buildDxfPreview(dxf: IDxf): DxfPreview {
  const primitives: DxfPrimitive[] = [];
  const bounds = createEmptyBounds();

  for (const entity of dxf.entities) {
    primitives.push(...primitiveFromDxfEntity(entity, bounds));
  }

  const safeBounds = normalizeBounds(bounds);
  const layers = [...new Set(primitives.map((primitive) => primitive.layer))]
    .filter(Boolean)
    .sort();

  return {
    primitiveCount: primitives.length,
    entityCount: dxf.entities.length,
    layers,
    bounds: safeBounds,
    primitives,
  };
}

function primitiveFromDxfEntity(
  entity: IEntity,
  bounds: Bounds2D,
): DxfPrimitive[] {
  const layer = entity.layer || '0';
  const typed = entity as IEntity & {
    vertices?: IPoint[];
    center?: IPoint;
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    startPoint?: IPoint;
    position?: IPoint;
    text?: string;
    height?: number;
    textHeight?: number;
  };

  if (entity.type === 'LINE' && typed.vertices?.length) {
    const [start, end] = typed.vertices;
    if (start && end) {
      includePoint(bounds, start);
      includePoint(bounds, end);
      return [{ kind: 'path', layer, d: `M ${start.x} ${start.y} L ${end.x} ${end.y}` }];
    }
  }

  if (
    (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') &&
    typed.vertices?.length
  ) {
    typed.vertices.forEach((point) => includePoint(bounds, point));
    const [first, ...rest] = typed.vertices;
    if (!first) return [];
    const d = [
      `M ${first.x} ${first.y}`,
      ...rest.map((point) => `L ${point.x} ${point.y}`),
    ].join(' ');
    return [{ kind: 'path', layer, d }];
  }

  if (entity.type === 'CIRCLE' && typed.center && typed.radius) {
    includeCircle(bounds, typed.center, typed.radius);
    return [
      {
        kind: 'circle',
        layer,
        cx: typed.center.x,
        cy: typed.center.y,
        r: typed.radius,
      },
    ];
  }

  if (
    entity.type === 'ARC' &&
    typed.center &&
    typed.radius &&
    typeof typed.startAngle === 'number' &&
    typeof typed.endAngle === 'number'
  ) {
    const start = arcPoint(typed.center, typed.radius, typed.startAngle);
    const end = arcPoint(typed.center, typed.radius, typed.endAngle);
    includeCircle(bounds, typed.center, typed.radius);
    const largeArc = Math.abs(typed.endAngle - typed.startAngle) > 180 ? 1 : 0;
    return [
      {
        kind: 'path',
        layer,
        d: `M ${start.x} ${start.y} A ${typed.radius} ${typed.radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      },
    ];
  }

  if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && typed.text) {
    const point = typed.startPoint ?? typed.position;
    if (!point) return [];
    includePoint(bounds, point);
    return [
      {
        kind: 'text',
        layer,
        x: point.x,
        y: point.y,
        value: cleanDxfText(typed.text),
        size: typed.textHeight ?? typed.height ?? 12,
      },
    ];
  }

  if (entity.type === 'POINT' && typed.position) {
    includeCircle(bounds, typed.position, 1);
    return [
      {
        kind: 'circle',
        layer,
        cx: typed.position.x,
        cy: typed.position.y,
        r: 1,
      },
    ];
  }

  return [];
}

function buildOcctGroup(meshes: import('occt-import-js').OcctMesh[]): OcctPreview {
  const group = new Group();
  let vertexCount = 0;
  let faceCount = 0;

  meshes.forEach((mesh, index) => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(mesh.attributes.position.array);
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    if (mesh.attributes.normal?.array.length) {
      geometry.setAttribute(
        'normal',
        new Float32BufferAttribute(new Float32Array(mesh.attributes.normal.array), 3),
      );
    } else {
      geometry.computeVertexNormals();
    }

    if (mesh.index?.array.length) {
      geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.index.array), 1));
      faceCount += Math.floor(mesh.index.array.length / 3);
    } else {
      faceCount += Math.floor(positions.length / 9);
    }

    vertexCount += Math.floor(positions.length / 3);

    const color = mesh.color ?? [
      0.09 + (index % 4) * 0.11,
      0.7,
      0.52 + (index % 3) * 0.08,
    ];
    const material = new MeshStandardMaterial({
      color: new Color(color[0] ?? 0.14, color[1] ?? 0.72, color[2] ?? 0.55),
      metalness: 0.12,
      roughness: 0.42,
      side: DoubleSide,
    });

    const object = new Mesh(geometry, material);
    object.name = mesh.name ?? `occt-mesh-${index}`;
    group.add(object);
  });

  return {
    meshCount: meshes.length,
    vertexCount,
    faceCount,
    group,
  };
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

function arcPoint(center: IPoint, radius: number, angleDegrees: number): IPoint {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * radius,
    y: center.y + Math.sin(radians) * radius,
    z: center.z ?? 0,
  };
}

function cleanDxfText(value: string): string {
  return value.replace(/\\P/g, ' ').replace(/[{}]/g, '').trim();
}
