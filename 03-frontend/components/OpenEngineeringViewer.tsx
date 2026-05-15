// components/OpenEngineeringViewer.tsx - Browser-native open engineering viewers
// License: Apache-2.0
'use client';

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Bounds, Environment, Grid, Html, OrbitControls } from '@react-three/drei';
import { AlertTriangle, Download, FileUp, MousePointer2, RotateCcw } from 'lucide-react';
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
}

interface DxfPrimitiveBase {
  layer: string;
}

interface DxfPolylinePrimitive extends DxfPrimitiveBase {
  kind: 'polyline';
  points: Array<{ x: number; y: number }>;
  closed: boolean;
}

interface DxfArcPrimitive extends DxfPrimitiveBase {
  kind: 'arc';
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
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
  | DxfPolylinePrimitive
  | DxfArcPrimitive
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
const engineeringTextFontStack =
  '"Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "PingFang SC", "WenQuanYi Micro Hei", "Arial Unicode MS", system-ui, sans-serif';
const ifcPropertyChineseLabels: Record<string, string> = {
  ExpressID: 'STEP编号',
  'IFC Type': 'IFC类型',
  GlobalId: '全局ID',
  OwnerHistory: '所有者历史',
  Name: '名称',
  Description: '描述',
  ObjectType: '对象类型',
  ObjectPlacement: '对象定位',
  Representation: '几何表达',
  Tag: '构件标记',
  PredefinedType: '预定义类型',
};
const ifcTypeChineseLabels: Record<string, string> = {
  IFCBEAM: '梁',
  IFCCOLUMN: '柱',
  IFCMEMBER: '杆件',
  IFCPLATE: '板件',
  IFCWALL: '墙',
  IFCSLAB: '板',
  IFCDOOR: '门',
  IFCWINDOW: '窗',
  IFCELEMENTASSEMBLY: '构件装配',
  IFCBUILDINGELEMENTPROXY: '代理构件',
  IFCFASTENER: '紧固件',
  IFCMECHANICALFASTENER: '机械紧固件',
  IFCDISCRETEACCESSORY: '离散附件',
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

type BomExportScope = 'selected' | 'model';

interface BomTemplateColumn {
  header: string;
  key: string;
}

interface IfcBomRow {
  expressID: number;
  globalId: string;
  type: string;
  typeZh: string;
  name: string;
  objectType: string;
  tag: string;
  predefinedType: string;
  quantity: number;
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
  { header: 'STEP编号', key: 'expressID' },
  { header: '全局ID', key: 'globalId' },
  { header: '构件类型', key: 'typeZh' },
  { header: 'IFC类型', key: 'type' },
  { header: '名称', key: 'name' },
  { header: '对象类型', key: 'objectType' },
  { header: '构件标记', key: 'tag' },
  { header: '预定义类型', key: 'predefinedType' },
  { header: '数量', key: 'quantity' },
];

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
    return <DxfCanvasViewer file={file} sourceUrl={sourceUrl} />;
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
          elements: group.elements,
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
        <MetricCard label="构件" value={summary.elements.length.toLocaleString()} />
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
        <IfcInspectionWorkbench file={file} summary={summary} />
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

function IfcInspectionWorkbench({
  file,
  summary,
}: {
  file: ModuleFileNode;
  summary: IfcSummary;
}) {
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(
    summary.elements[0]?.expressID ?? null,
  );
  const selected =
    summary.elements.find((element) => element.expressID === selectedExpressID) ??
    null;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <ThreeGroupViewport
        group={summary.group}
        label={file.name}
        status="IFC 构件可选 / BIM Z-up 坐标"
        selectedExpressID={selectedExpressID}
        onMeshSelect={setSelectedExpressID}
      />
      <IfcPropertyPanel
        file={file}
        summary={summary}
        selected={selected}
        onSelectFirst={() =>
          setSelectedExpressID(summary.elements[0]?.expressID ?? null)
        }
      />
    </section>
  );
}

function IfcPropertyPanel({
  file,
  summary,
  selected,
  onSelectFirst,
}: {
  file: ModuleFileNode;
  summary: IfcSummary;
  selected: IfcElementProperties | null;
  onSelectFirst: () => void;
}) {
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  return (
    <aside className="arch-card flex min-h-[640px] flex-col rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="arch-primary-text text-xs font-semibold uppercase">
            Element properties
          </p>
          <h3 className="arch-text mt-1 text-lg font-semibold">构件属性</h3>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => templateInputRef.current?.click()}
          className="arch-btn inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          title="上传本地 BOM 导出模板"
        >
          <FileUp className="h-4 w-4" />
          {templateFile ? templateFile.name : '上传模板'}
        </button>
        <button
          type="button"
          onClick={() => void exportIfcBom(file.name, summary, 'selected', selected, templateFile)}
          disabled={!selected}
          className="arch-btn inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          title="只导出当前选中构件"
        >
          <Download className="h-4 w-4" />
          导出选中
        </button>
        <button
          type="button"
          onClick={() => void exportIfcBom(file.name, summary, 'model', selected, templateFile)}
          className="arch-btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          title="导出整个模型 BOM"
        >
          <Download className="h-4 w-4" />
          导出整模
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricCard label="可选构件" value={summary.elements.length.toLocaleString()} />
        <MetricCard label="几何网格" value={summary.totalMeshes.toLocaleString()} />
      </div>

      {selected ? (
        <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
          <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-3">
            <p className="arch-muted text-xs">#{selected.expressID}</p>
            <h4 className="arch-text mt-1 text-base font-semibold">
              {decodeEngineeringText(selected.name || chineseIfcType(selected.type))}
            </h4>
            <p className="arch-primary-text mt-1 text-sm font-medium">
              {chineseIfcType(selected.type)} · {selected.type}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {selected.properties.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-[var(--arch-border)] px-3 py-2"
              >
                <p className="arch-muted text-[11px] font-medium">{item.label}</p>
                <p className="arch-text mt-1 break-words text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--arch-border)] p-5 text-center">
          <div>
            <MousePointer2 className="arch-primary-text mx-auto h-8 w-8" />
            <p className="arch-text mt-3 text-sm font-medium">
              点击 IFC 构件后显示属性
            </p>
            <button
              type="button"
              onClick={onSelectFirst}
              className="arch-btn mt-3 rounded-lg px-3 py-2 text-sm font-medium"
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
  const xlsx = await import('xlsx');
  const sourceElements =
    scope === 'selected' && selected ? [selected] : summary.elements;
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
    scope === 'selected' ? '选中构件BOM' : '模型BOM',
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(typeRows),
    '类型汇总',
  );
  xlsx.writeFile(workbook, `${safeExportName(fileName)}-${scope === 'selected' ? 'selected' : 'model'}-BOM.xlsx`);
}

async function exportIfcBomWithTemplate(
  xlsx: typeof import('xlsx'),
  fileName: string,
  scope: BomExportScope,
  templateFile: File,
  rows: IfcBomRow[],
  typeRows: Array<Record<string, string | number>>,
) {
  if (templateFile.name.toLowerCase().endsWith('.json')) {
    const columns = await readJsonTemplateColumns(templateFile);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(toTemplateRows(rows, columns)),
      'BOM',
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(typeRows),
      '类型汇总',
    );
    xlsx.writeFile(workbook, `${safeExportName(fileName)}-${scope}-template-BOM.xlsx`);
    return;
  }

  const workbook = xlsx.read(await templateFile.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0] ?? 'BOM';
  const sheet = workbook.Sheets[sheetName] ?? xlsx.utils.aoa_to_sheet([]);
  workbook.Sheets[sheetName] = sheet;
  if (!workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames.unshift(sheetName);
  }
  xlsx.utils.sheet_add_json(sheet, toTemplateRows(rows, defaultBomTemplateColumns), {
    origin: -1,
    skipHeader: false,
  });
  workbook.Sheets['类型汇总'] = xlsx.utils.json_to_sheet(typeRows);
  if (!workbook.SheetNames.includes('类型汇总')) {
    workbook.SheetNames.push('类型汇总');
  }
  xlsx.writeFile(workbook, `${safeExportName(fileName)}-${scope}-template-BOM.xlsx`);
}

async function readJsonTemplateColumns(file: File): Promise<BomTemplateColumn[]> {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const columns = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && 'columns' in parsed
        ? (parsed as { columns?: unknown }).columns
        : null;
    if (!Array.isArray(columns)) return defaultBomTemplateColumns;
    return columns
      .map((entry): BomTemplateColumn | null => {
        if (typeof entry === 'string') {
          const found = defaultBomTemplateColumns.find((column) => column.header === entry || column.key === entry);
          return found ?? { header: entry, key: entry };
        }
        if (typeof entry !== 'object' || !entry) return null;
        const candidate = entry as { header?: unknown; key?: unknown };
        if (typeof candidate.header !== 'string' || typeof candidate.key !== 'string') return null;
        return { header: candidate.header, key: candidate.key };
      })
      .filter((entry): entry is BomTemplateColumn => Boolean(entry));
  } catch {
    return defaultBomTemplateColumns;
  }
}

function bomRowFromElement(element: IfcElementProperties): IfcBomRow {
  return {
    expressID: element.expressID,
    globalId: decodeEngineeringText(element.globalId),
    type: element.type,
    typeZh: chineseIfcType(element.type),
    name: decodeEngineeringText(element.name),
    objectType: decodeEngineeringText(element.objectType),
    tag: decodeEngineeringText(element.tag),
    predefinedType: decodeEngineeringText(element.predefinedType),
    quantity: 1,
  };
}

function toTemplateRows(
  rows: IfcBomRow[],
  columns: BomTemplateColumn[],
): Array<Record<string, string | number>> {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [
        column.header,
        row[column.key as keyof IfcBomRow] ?? '',
      ]),
    ) as Record<string, string | number>,
  );
}

function safeExportName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'ifc';
}

function DxfCanvasViewer({
  file,
  sourceUrl,
}: {
  file: ModuleFileNode;
  sourceUrl: string;
}) {
  const [state, setState] = useState<LoadState<DxfPreview>>({
    status: 'loading',
    message: '正在解析 DXF 并打开 Canvas 图纸视图...',
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [viewport, setViewport] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDxf() {
      setState({
        status: 'loading',
        message: '正在解析 DXF 并打开 Canvas 图纸视图...',
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

  useEffect(() => {
    if (state.status !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawDxfCanvas(canvas, state.value, viewport);

    function redraw() {
      if (state.status === 'ready' && canvas) {
        drawDxfCanvas(canvas, state.value, viewport);
      }
    }

    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [state, viewport]);

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

  return (
    <section
      className="space-y-4"
      tabIndex={0}
      onKeyDown={(event) => handleDxfKeyDown(event, setViewport)}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="DXF 实体" value={preview.entityCount.toLocaleString()} />
        <MetricCard label="DXF 图元" value={preview.primitiveCount.toLocaleString()} />
        <MetricCard label="图层" value={preview.layers.length.toLocaleString()} />
        <MetricCard label="大小" value={formatModuleFileSize(file.size)} />
      </div>

      <div className="arch-card relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-xl border">
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewport({ zoom: 1, panX: 0, panY: 0 })}
            className="arch-btn inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm"
          >
            <RotateCcw className="h-4 w-4" />
            重置视图
          </button>
        </div>
        <canvas
          ref={canvasRef}
          aria-label={`${file.name} DXF canvas viewer`}
          className="h-full w-full cursor-grab bg-[var(--arch-surface)] active:cursor-grabbing"
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
            setViewport((current) => ({
              ...current,
              panX: drag.panX + event.clientX - drag.x,
              panY: drag.panY + event.clientY - drag.y,
            }));
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        />
      </div>

      {preview.layers.length ? (
        <section className="arch-card rounded-xl p-4">
          <h3 className="arch-text text-base font-semibold">DXF 图层</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {preview.layers.map((layer) => (
              <span key={layer} className="arch-chip rounded-full px-3 py-1 text-xs font-medium">
                {layer}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function drawDxfCanvas(
  canvas: HTMLCanvasElement,
  preview: DxfPreview,
  viewport: { zoom: number; panX: number; panY: number },
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const context = canvas.getContext('2d');
  if (!context) return;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = readCssVariable('--arch-surface', '#ffffff');
  context.fillRect(0, 0, width, height);

  const boundsWidth = Math.max(preview.bounds.maxX - preview.bounds.minX, 1);
  const boundsHeight = Math.max(preview.bounds.maxY - preview.bounds.minY, 1);
  const baseScale = Math.min(width / boundsWidth, height / boundsHeight) * 0.86;
  const scale = baseScale * viewport.zoom;
  const centerX = (preview.bounds.minX + preview.bounds.maxX) / 2;
  const centerY = (preview.bounds.minY + preview.bounds.maxY) / 2;
  const strokeWidth = Math.max(1 / scale, Math.max(boundsWidth, boundsHeight) / 1800);

  context.save();
  context.translate(width / 2 + viewport.panX, height / 2 + viewport.panY);
  context.scale(scale, -scale);
  context.translate(-centerX, -centerY);

  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = readCssVariable('--arch-primary', '#07c160');
  context.fillStyle = readCssVariable('--arch-text', '#191919');
  context.lineWidth = strokeWidth;

  for (const primitive of preview.primitives) {
    if (primitive.kind === 'polyline') {
      const [firstPoint, ...restPoints] = primitive.points;
      if (!firstPoint) continue;
      context.beginPath();
      context.moveTo(firstPoint.x, firstPoint.y);
      for (const point of restPoints) {
        context.lineTo(point.x, point.y);
      }
      if (primitive.closed) context.closePath();
      context.stroke();
      continue;
    }

    if (primitive.kind === 'arc') {
      context.beginPath();
      context.arc(
        primitive.cx,
        primitive.cy,
        primitive.r,
        degreesToRadians(primitive.startAngle),
        degreesToRadians(primitive.endAngle),
      );
      context.stroke();
      continue;
    }

    if (primitive.kind === 'circle') {
      context.beginPath();
      context.arc(primitive.cx, primitive.cy, primitive.r, 0, Math.PI * 2);
      context.stroke();
      continue;
    }

    context.save();
    context.translate(primitive.x, primitive.y);
    context.scale(1, -1);
    context.font = `${Math.max(primitive.size, 8)}px ${engineeringTextFontStack}`;
    context.fillText(primitive.value, 0, 0);
    context.restore();
  }

  context.restore();
}

function readCssVariable(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function handleDxfKeyDown(
  event: KeyboardEvent<HTMLElement>,
  setViewport: Dispatch<SetStateAction<{ zoom: number; panX: number; panY: number }>>,
) {
  const step = event.shiftKey ? 80 : 28;
  const zoomStep = event.shiftKey ? 1.25 : 1.1;
  const key = event.key.toLowerCase();
  const handlers: Record<string, () => void> = {
    arrowup: () => setViewport((current) => ({ ...current, panY: current.panY + step })),
    arrowdown: () => setViewport((current) => ({ ...current, panY: current.panY - step })),
    arrowleft: () => setViewport((current) => ({ ...current, panX: current.panX + step })),
    arrowright: () => setViewport((current) => ({ ...current, panX: current.panX - step })),
    w: () => setViewport((current) => ({ ...current, zoom: Math.min(30, current.zoom * zoomStep) })),
    s: () => setViewport((current) => ({ ...current, zoom: Math.max(0.08, current.zoom / zoomStep) })),
    a: () => setViewport((current) => ({ ...current, panX: current.panX + step })),
    d: () => setViewport((current) => ({ ...current, panX: current.panX - step })),
    q: () => setViewport((current) => ({ ...current, panY: current.panY - step })),
    e: () => setViewport((current) => ({ ...current, panY: current.panY + step })),
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
  selectedExpressID = null,
  onMeshSelect,
}: {
  group: Group | null;
  label: string;
  status: string;
  selectedExpressID?: number | null;
  onMeshSelect?: (expressID: number) => void;
}) {
  const [viewTransform, setViewTransform] = useState<ViewTransform>(defaultViewTransform);

  useEffect(() => {
    if (!group) return;
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material = object.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      const baseColor = object.userData.baseColor as [number, number, number] | undefined;
      const isSelected = object.userData.expressID === selectedExpressID;
      if (baseColor) {
        material.color.setRGB(baseColor[0], baseColor[1], baseColor[2]);
      }
      material.emissive = new Color(isSelected ? '#f59e0b' : '#000000');
      material.emissiveIntensity = isSelected ? 0.45 : 0;
      material.needsUpdate = true;
    });
  }, [group, selectedExpressID]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    const expressID = findExpressID(event.object);
    if (!expressID) return;
    event.stopPropagation();
    onMeshSelect?.(expressID);
  }

  return (
    <section
      className="relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
      tabIndex={0}
      onKeyDown={(event) => handleModelKeyDown(event, setViewTransform)}
    >
      <div className="absolute left-4 top-4 z-10 rounded-lg border border-slate-700 bg-slate-950/85 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
        <p className="font-semibold">{status}</p>
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
        <axesHelper args={[8]} />
        {group ? (
          <Bounds fit clip observe margin={1.15}>
            <group
              position={[viewTransform.offsetX, viewTransform.offsetY, viewTransform.offsetZ]}
              rotation={[
                -Math.PI / 2 + viewTransform.rotateX,
                viewTransform.rotateY,
                viewTransform.rotateZ,
              ]}
              scale={viewTransform.scale}
            >
              <primitive object={group} onClick={handleClick} />
            </group>
          </Bounds>
        ) : null}
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </section>
  );
}

function handleModelKeyDown(
  event: KeyboardEvent<HTMLElement>,
  setViewTransform: Dispatch<SetStateAction<ViewTransform>>,
) {
  const moveStep = event.shiftKey ? 4 : 1;
  const rotateStep = event.shiftKey ? 0.18 : 0.08;
  const key = event.key.toLowerCase();
  const handlers: Record<string, () => void> = {
    arrowup: () => setViewTransform((current) => ({ ...current, offsetZ: current.offsetZ - moveStep })),
    arrowdown: () => setViewTransform((current) => ({ ...current, offsetZ: current.offsetZ + moveStep })),
    arrowleft: () => setViewTransform((current) => ({ ...current, offsetX: current.offsetX - moveStep })),
    arrowright: () => setViewTransform((current) => ({ ...current, offsetX: current.offsetX + moveStep })),
    w: () => setViewTransform((current) => ({ ...current, rotateX: current.rotateX - rotateStep })),
    s: () => setViewTransform((current) => ({ ...current, rotateX: current.rotateX + rotateStep })),
    a: () => setViewTransform((current) => ({ ...current, rotateY: current.rotateY - rotateStep })),
    d: () => setViewTransform((current) => ({ ...current, rotateY: current.rotateY + rotateStep })),
    q: () => setViewTransform((current) => ({ ...current, rotateZ: current.rotateZ - rotateStep })),
    e: () => setViewTransform((current) => ({ ...current, rotateZ: current.rotateZ + rotateStep })),
    z: () => setViewTransform((current) => ({ ...current, scale: Math.max(0.1, current.scale * 0.92) })),
    x: () => setViewTransform((current) => ({ ...current, scale: Math.min(10, current.scale * 1.08) })),
    r: () => setViewTransform(defaultViewTransform),
  };
  const handler = handlers[key];
  if (!handler) return;
  event.preventDefault();
  handler();
}

function findExpressID(object: object): number | null {
  const maybeObject = object as { userData?: Record<string, unknown>; parent?: unknown };
  const expressID = maybeObject.userData?.expressID;
  if (typeof expressID === 'number') return expressID;
  if (maybeObject.parent && typeof maybeObject.parent === 'object') {
    return findExpressID(maybeObject.parent);
  }
  return null;
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
          <div className="w-80 rounded-xl border border-slate-700 bg-slate-950/90 p-4 text-center text-slate-100 shadow-xl backdrop-blur">
            <p className="text-sm font-semibold">{title}</p>
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
        <span className="arch-primary-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="arch-text text-lg font-semibold">{title}</h3>
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
    <div className="arch-card-muted rounded-xl border px-3 py-3">
      <p className="arch-muted text-[11px] font-medium">{label}</p>
      <p className="arch-text mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function SummaryGrid({ title, items }: { title: string; items: MetricItem[] }) {
  return (
    <section className="arch-card rounded-2xl p-4">
      <h3 className="arch-text text-base font-semibold">{title}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="arch-card-muted rounded-xl border px-3 py-2"
          >
            <p className="arch-text truncate text-sm font-semibold">{item.label}</p>
            <p className="arch-primary-text mt-1 text-xs font-medium">
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
  const elementMap = new Map<number, IfcElementProperties>();
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
      const mesh = new Mesh(meshGeometry, material);
      mesh.userData = {
        expressID: flatMesh.expressID,
        ifcType: element?.type ?? 'IFCENTITY',
        ifcName: element?.name ?? '',
        baseColor: [color.x, color.y, color.z],
      };
      group.add(mesh);
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
    elements: Array.from(elementMap.values()).sort(
      (left, right) => left.expressID - right.expressID,
    ),
  };
}

function readIfcElementProperties(
  api: WebIfc.IfcAPI,
  modelID: number,
  expressID: number,
): IfcElementProperties | null {
  try {
    const line = api.GetLine(modelID, expressID, false) as Record<string, unknown>;
    const type =
      typeof line.type === 'number'
        ? api.GetNameFromTypeCode(line.type)
        : String(line.type ?? 'IFCENTITY');
    const globalId = decodeEngineeringText(formatIfcValue(line.GlobalId));
    const name = decodeEngineeringText(formatIfcValue(line.Name));
    const objectType = decodeEngineeringText(formatIfcValue(line.ObjectType));
    const tag = decodeEngineeringText(formatIfcValue(line.Tag));
    const predefinedType = decodeEngineeringText(formatIfcValue(line.PredefinedType));
    const properties = Object.entries(line)
      .filter(([key]) => key !== 'type' && key !== 'expressID')
      .map(([key, value]) => ({
        label: ifcPropertyChineseLabels[key] ?? key,
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
        { label: ifcPropertyChineseLabels.ExpressID ?? 'STEP编号', value: `#${expressID}` },
        {
          label: ifcPropertyChineseLabels['IFC Type'] ?? 'IFC类型',
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
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatIfcValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const typed = value as Record<string, unknown>;
    if ('value' in typed) return formatIfcValue(typed.value);
    if ('expressID' in typed && typeof typed.expressID === 'number') {
      return `#${typed.expressID}`;
    }
  }
  return '';
}

function chineseIfcType(type: string): string {
  return ifcTypeChineseLabels[type] ?? type.replace(/^IFC/, '');
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
      return [
        {
          kind: 'polyline',
          layer,
          points: [
            { x: start.x, y: start.y },
            { x: end.x, y: end.y },
          ],
          closed: false,
        },
      ];
    }
  }

  if (
    (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') &&
    typed.vertices?.length
  ) {
    typed.vertices.forEach((point) => includePoint(bounds, point));
    return [
      {
        kind: 'polyline',
        layer,
        points: typed.vertices.map((point) => ({ x: point.x, y: point.y })),
        closed: Boolean((typed as { shape?: boolean; closed?: boolean }).shape || (typed as { closed?: boolean }).closed),
      },
    ];
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
    includeCircle(bounds, typed.center, typed.radius);
    return [
      {
        kind: 'arc',
        layer,
        cx: typed.center.x,
        cy: typed.center.y,
        r: typed.radius,
        startAngle: typed.startAngle,
        endAngle: typed.endAngle,
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

function cleanDxfText(value: string): string {
  return decodeEngineeringText(
    value
      .replace(/\\P/g, ' ')
      .replace(/%%c/gi, 'Φ')
      .replace(/%%d/gi, '°')
      .replace(/%%p/gi, '±')
      .replace(/\\[AaCcFfHhQqTtWw][^;]*;/g, '')
      .replace(/[{}]/g, ''),
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
    chars.push(String.fromCharCode(Number.parseInt(hex.slice(index, index + 4), 16)));
  }
  return chars.join('');
}
