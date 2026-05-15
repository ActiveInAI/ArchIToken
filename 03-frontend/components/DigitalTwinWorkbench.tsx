// components/DigitalTwinWorkbench.tsx - ArchIToken heavy steel HMI digital twin cockpit
// License: Apache-2.0
'use client';

import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Cpu,
  Factory,
  GitBranch,
  HardHat,
  Layers3,
  PackageCheck,
  PlayCircle,
  ScanLine,
  ShieldCheck,
  Truck,
  Video,
  Workflow,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  getSteelTwinBlockingIssues,
  getSteelTwinReadinessScore,
  steelExportPackages,
  steelMembers,
  steelProcessMetrics,
  steelQualityGates,
  steelSensors,
  steelSimulationThreads,
  steelTwinLayers,
  steelTwinStages,
  type SteelStageStatus,
} from '@/lib/digital-twin';

const fallbackStage = steelTwinStages.find((stage) => stage.id === 'erection') ?? steelTwinStages[0];

const twinSceneNodes = [
  {
    id: 'detail',
    title: '深化建模',
    subtitle: 'IFC4.3 / MBD',
    x: 15,
    y: 23,
    width: 'w-28 md:w-36',
    tone: 'cyan',
    icon: <Boxes className="h-4 w-4" />,
  },
  {
    id: 'production_manufacturing',
    title: '构件加工线',
    subtitle: '下料 组立 焊接',
    x: 15,
    y: 52,
    width: 'w-36 md:w-48',
    tone: 'blue',
    icon: <Factory className="h-4 w-4" />,
  },
  {
    id: 'paint',
    title: '涂装/防火',
    subtitle: 'DFT 238um',
    x: 41,
    y: 18,
    width: 'w-28 md:w-36',
    tone: 'amber',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: 'yard',
    title: '构件堆场',
    subtitle: 'DDMRP 红区 18%',
    x: 48,
    y: 54,
    width: 'w-32 md:w-44',
    tone: 'cyan',
    icon: <PackageCheck className="h-4 w-4" />,
  },
  {
    id: 'lift',
    title: '400t 吊装区',
    subtitle: 'LIFT-46 半径34m',
    x: 69,
    y: 34,
    width: 'w-32 md:w-44',
    tone: 'red',
    icon: <HardHat className="h-4 w-4" />,
  },
  {
    id: 'corridor',
    title: '高空连廊',
    subtitle: '净空冲突 180mm',
    x: 68,
    y: 63,
    width: 'w-32 md:w-44',
    tone: 'red',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
];

const twinObjectTree = [
  {
    id: 'semantic-model',
    stageId: 'detail-design',
    title: '结构语义模型',
    evidence: 'IFC4.3 构件树、MBD 属性、IDS 校核',
    status: 'active' as SteelStageStatus,
  },
  {
    id: 'member-index',
    stageId: 'production_manufacturing',
    title: '构件编码索引',
    evidence: '柱/梁/支撑/桁架 · 炉批号与二维码',
    status: 'active' as SteelStageStatus,
  },
  {
    id: 'space-zones',
    stageId: 'erection',
    title: '空间与吊装分区',
    evidence: 'A/B 区、400t 吊装区、连廊冲突区',
    status: 'blocked' as SteelStageStatus,
  },
  {
    id: 'process-chain',
    stageId: 'production_manufacturing',
    title: '制造工序链',
    evidence: '下料、组立、焊接、UT/RT、涂装 DFT',
    status: 'active' as SteelStageStatus,
  },
  {
    id: 'logistics-batches',
    stageId: 'logistics',
    title: '物流批次',
    evidence: 'PKG-RF-07、GPS、签收、堆场占用',
    status: 'watch' as SteelStageStatus,
  },
  {
    id: 'lift-permits',
    stageId: 'erection',
    title: '吊装作业包',
    evidence: 'LIFT-46、半径34m、permit-to-lift',
    status: 'blocked' as SteelStageStatus,
  },
  {
    id: 'reality-capture',
    stageId: 'shape-performance',
    title: '实景点云层',
    evidence: 'E57 控制点、3DGS、360 影像残差',
    status: 'active' as SteelStageStatus,
  },
  {
    id: 'sensor-points',
    stageId: 'shape-performance',
    title: '传感点位',
    evidence: '应变、振动、位移、风速、扭矩',
    status: 'watch' as SteelStageStatus,
  },
  {
    id: 'risk-gates',
    stageId: 'archive',
    title: '告警与证据链',
    evidence: 'BCF、NCR、ITP、交付包与签章',
    status: 'active' as SteelStageStatus,
  },
];

const bottomModules = [
  { id: 'overview', label: '综合全览', icon: <Activity className="h-5 w-5" />, active: true },
  { id: 'tree', label: '对象层级树', icon: <GitBranch className="h-5 w-5" /> },
  { id: 'zero-code', label: '零代码编排', icon: <Workflow className="h-5 w-5" /> },
  { id: 'blueprint', label: '蓝图编辑器', icon: <Cpu className="h-5 w-5" /> },
  { id: 'twin-editor', label: '孪生编辑器', icon: <ScanLine className="h-5 w-5" /> },
  { id: 'device', label: '设备详情', icon: <Layers3 className="h-5 w-5" /> },
];

export function DigitalTwinWorkbench({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedStageId, setSelectedStageId] = useState(fallbackStage?.id ?? 'erection');
  const [selectedObjectId, setSelectedObjectId] = useState('lift-permits');
  const selectedStage =
    steelTwinStages.find((stage) => stage.id === selectedStageId) ??
    fallbackStage ??
    steelTwinStages[0];
  const readiness = getSteelTwinReadinessScore();
  const blockers = getSteelTwinBlockingIssues();
  const warningSensors = steelSensors.filter((sensor) => sensor.status !== 'normal');
  const activeMembers = steelMembers.filter((member) =>
    ['erecting', 'hold', 'in_transit'].includes(member.status),
  );
  const criticalGates = steelQualityGates.filter((gate) => gate.status !== 'pass');
  const exportReady = steelExportPackages.filter((pkg) => pkg.ready).length;

  return (
    <main className={`${embedded ? 'h-full min-h-0 p-0' : 'min-h-screen p-3 md:p-5 arch-twin-root'}`}>
      <div
        className={`relative mx-auto overflow-hidden border ${
          embedded
            ? 'arch-surface flex h-full min-h-0 max-w-none flex-col rounded-lg'
            : 'arch-twin-shell min-h-[calc(100vh-24px)] max-w-[1840px] rounded-[2rem]'
        }`}
      >
        {embedded ? null : <FrameChrome />}
        {embedded ? (
          <TwinWorkspaceHeader
            readiness={readiness}
            blockers={blockers.length}
            exportReady={exportReady}
          />
        ) : (
          <TopBar readiness={readiness} blockers={blockers.length} exportReady={exportReady} />
        )}

        <section
          className={`relative z-10 grid min-h-0 gap-3 ${
            embedded
              ? 'flex-1 overflow-hidden p-3 lg:grid-cols-[280px_minmax(0,1fr)]'
              : 'px-4 pb-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_330px]'
          }`}
        >
          <LeftPanel
            selectedObjectId={selectedObjectId}
            onSelectObject={(node) => {
              setSelectedObjectId(node.id);
              setSelectedStageId(node.stageId);
            }}
          />

          <section className="min-h-0 space-y-4 overflow-y-auto">
            <CenterScene selectedStage={selectedStage} activeMembers={activeMembers.length} compact={embedded} />
            <ModuleDock />
          </section>

          {embedded ? null : (
            <RightPanel
              warningSensors={warningSensors}
              criticalGates={criticalGates}
              readiness={readiness}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function TwinWorkspaceHeader({
  readiness,
  blockers,
  exportReady,
}: {
  readiness: number;
  blockers: number;
  exportReady: number;
}) {
  return (
    <header className="arch-surface-muted flex shrink-0 flex-col gap-3 border-b px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">ArchIToken Twin</p>
        <h2 className="arch-text mt-1 truncate text-xl font-black tracking-[-0.02em]">
          数字孪生 · 重钢结构加工、物流与吊装总览
        </h2>
        <p className="arch-muted mt-1 truncate text-xs">
          WebGPU 优先，Three.js fallback，融合 IFC、GLB、点云、360、三维扫描和倾斜摄影。
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <TwinToolButton icon={<ScanLine className="h-4 w-4" />} label="渲染检测" primary />
        <TwinToolButton icon={<GitBranch className="h-4 w-4" />} label="多源对齐" />
        <TwinToolButton icon={<PackageCheck className="h-4 w-4" />} label="快照导出" />
        <span className="arch-chip rounded-md px-2 py-1 text-xs font-black">
          {readiness}% · {exportReady}/{steelExportPackages.length} · 阻断 {blockers}
        </span>
      </div>
    </header>
  );
}

function TwinToolButton({
  icon,
  label,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black transition ${
        primary ? 'arch-btn-primary' : 'arch-btn'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TopBar({
  readiness,
  blockers,
  exportReady,
}: {
  readiness: number;
  blockers: number;
  exportReady: number;
}) {
  return (
    <header className="relative z-10 px-4 pb-3 pt-3 md:px-7 md:pt-4">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="arch-twin-divider hidden h-px lg:block" />
        <div className="arch-twin-title-card rounded-b-[2rem] border-x border-b px-6 py-3 text-center">
          <p className="arch-twin-muted font-mono text-[10px] uppercase tracking-[0.34em]">
            ArchIToken · Heavy Steel Twin
          </p>
          <h1 className="arch-twin-text mt-1 text-2xl font-black tracking-[0.08em] md:text-3xl">
            重钢结构数字孪生平台
          </h1>
        </div>
        <div className="arch-twin-divider hidden h-px lg:block" />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-6">
        <StatusChip label="深化模型" value="92%" tone="cyan" />
        <StatusChip label="制造节拍" value="92%" tone="green" />
        <StatusChip label="物流到场" value="76%" tone="amber" />
        <StatusChip label="吊装阻断" value={String(blockers)} tone="red" />
        <StatusChip label="交付包" value={`${exportReady}/${steelExportPackages.length}`} tone="cyan" />
        <StatusChip label="孪生就绪" value={`${readiness}%`} tone="green" />
      </div>
    </header>
  );
}

function LeftPanel({
  selectedObjectId,
  onSelectObject,
}: {
  selectedObjectId: string;
  onSelectObject: (node: (typeof twinObjectTree)[number]) => void;
}) {
  const tonnage = steelProcessMetrics.find((metric) => metric.id === 'tonnage');
  const members = steelProcessMetrics.find((metric) => metric.id === 'members');

  return (
    <aside className="min-h-0 space-y-4 overflow-y-auto">
      <HmiPanel title="孪生对象层级树" eyebrow="Twin object tree" icon={<GitBranch className="h-4 w-4" />}>
        <div className="space-y-1.5">
          {twinObjectTree.map((node, index) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectObject(node)}
              className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                selectedObjectId === node.id
                  ? 'arch-twin-card-active'
                  : 'arch-twin-card hover:border-[var(--arch-twin-accent)] hover:bg-[var(--arch-twin-accent-soft)]'
              }`}
            >
              <span className="arch-twin-accent-soft flex h-6 w-6 items-center justify-center rounded font-mono text-[10px]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="arch-twin-text block truncate text-sm font-black">{node.title}</span>
                <span className="arch-twin-muted mt-0.5 block truncate text-[10px]">
                  {node.evidence}
                </span>
              </span>
              <StageLamp status={node.status} />
            </button>
          ))}
        </div>
      </HmiPanel>

      <HmiPanel title="钢构统计" eyebrow="Steel metrics" icon={<Boxes className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <Gauge label="总钢量" value={tonnage?.value ?? '1,280'} unit="t" tone="cyan" />
          <Gauge label="构件数" value={members?.value ?? '2,418'} unit="pcs" tone="green" />
        </div>
        <div className="mt-4 space-y-3">
          {steelTwinLayers.slice(0, 4).map((layer) => (
            <MiniBar key={layer.id} label={layer.name} value={layer.progress} />
          ))}
        </div>
      </HmiPanel>
    </aside>
  );
}

function CenterScene({
  selectedStage,
  activeMembers,
  compact = false,
}: {
  selectedStage: (typeof steelTwinStages)[number] | undefined;
  activeMembers: number;
  compact?: boolean;
}) {
  return (
    <HmiPanel
      title="重钢构件加工-物流-吊装总览"
      eyebrow="Twin scene"
      icon={<Factory className="h-4 w-4" />}
      className={compact ? 'min-h-[520px]' : 'min-h-[620px]'}
    >
      <div className={`arch-twin-canvas relative overflow-hidden rounded-lg shadow-inner ${compact ? 'min-h-[420px]' : 'min-h-[520px]'}`}>
        <div className="arch-twin-canvas-grid absolute inset-0" />
        <div className="arch-twin-canvas-toolbar absolute inset-x-5 top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2 backdrop-blur">
          <div>
            <p className="arch-twin-muted font-mono text-[10px] uppercase tracking-[0.26em]">
              当前作业包
            </p>
            <p className="arch-twin-text text-lg font-black">{selectedStage?.name ?? '施工管理'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SceneBadge label="活动构件" value={`${activeMembers} 件`} tone="cyan" />
            <SceneBadge label="3DGS" value="影像实景层" tone="green" />
            <SceneBadge label="点云" value="E57 校核" tone="amber" />
            <SceneBadge label="吊装" value="LIFT-46" tone="red" />
          </div>
        </div>

        <svg
          className="absolute inset-0 z-0 h-full w-full"
          viewBox="0 0 1000 620"
          role="img"
          aria-label="重钢结构生产物流吊装流程线"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M170 385 C260 305 360 300 445 365 S640 470 760 320"
            fill="none"
            className="arch-twin-path-primary"
            strokeDasharray="12 10"
            strokeWidth="3"
            filter="url(#glow)"
          />
          <path
            d="M260 160 L420 215 L560 155 L742 244"
            fill="none"
            className="arch-twin-path-warning"
            strokeDasharray="10 8"
            strokeWidth="2.5"
            filter="url(#glow)"
          />
          <path
            d="M745 310 C785 360 810 415 748 455"
            fill="none"
            className="arch-twin-path-danger"
            strokeDasharray="8 8"
            strokeWidth="2.5"
            filter="url(#glow)"
          />
        </svg>

        <div className="absolute inset-0 z-10">
          {twinSceneNodes.map((node) => (
            <SceneNode key={node.id} node={node} />
          ))}
          <IsometricPlant />
          <RealityLayerNote />
        </div>
      </div>
    </HmiPanel>
  );
}

function RightPanel({
  warningSensors,
  criticalGates,
  readiness,
}: {
  warningSensors: typeof steelSensors;
  criticalGates: typeof steelQualityGates;
  readiness: number;
}) {
  return (
    <aside className="min-h-0 space-y-4 overflow-y-auto lg:col-span-2 xl:col-span-1">
      <HmiPanel title="监控视频" eyebrow="Vision monitor" icon={<Video className="h-4 w-4" />}>
        <div className="arch-twin-canvas relative h-40 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,var(--arch-twin-accent-soft),transparent_38%),linear-gradient(135deg,var(--arch-twin-accent-soft),transparent)]" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <span className="arch-twin-accent-soft rounded px-2 py-1 font-mono text-[10px]">
              现场摄像头 · 吊装区
            </span>
            <PlayCircle className="arch-twin-accent h-5 w-5" />
          </div>
          <div className="arch-twin-canvas-toolbar absolute bottom-4 left-4 right-4 rounded-xl p-2 text-xs">
            视觉 AI 检测: 人员闯入 0 · 吊钩偏摆 1 · 连廊净空冲突 1
          </div>
        </div>
      </HmiPanel>

      <HmiPanel title="传感与报警" eyebrow="Live alarms" icon={<AlertTriangle className="h-4 w-4" />}>
        <div className="space-y-2">
          {warningSensors.map((sensor) => (
            <AlarmRow key={sensor.id} label={sensor.name} value={sensor.value} level={sensor.status} />
          ))}
        </div>
      </HmiPanel>

      <HmiPanel title="门禁摘要" eyebrow="Quality gates" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="arch-twin-card rounded-2xl p-3">
            <p className="arch-twin-muted text-xs">孪生就绪度</p>
            <p className="arch-twin-success-text mt-1 text-4xl font-black">{readiness}%</p>
          </div>
          {criticalGates.slice(0, 5).map((gate) => (
            <MiniBar key={gate.id} label={gate.name} value={gate.score} danger={gate.status === 'fail'} />
          ))}
        </div>
      </HmiPanel>

      <HmiPanel title="导出清单" eyebrow="Handover" icon={<Truck className="h-4 w-4" />}>
        <div className="space-y-2">
          {steelExportPackages.slice(0, 5).map((pkg) => (
            <div
              key={pkg.id}
              className="arch-twin-card flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            >
              <span className="arch-twin-text text-sm font-bold">{pkg.name}</span>
              {pkg.ready ? (
                <CheckCircle2 className="arch-twin-success-text h-4 w-4" />
              ) : (
                <AlertTriangle className="arch-twin-warning-text h-4 w-4" />
              )}
            </div>
          ))}
        </div>
      </HmiPanel>
    </aside>
  );
}

function ModuleDock() {
  return (
    <HmiPanel title="功能模块坞" eyebrow="CIM editor dock" icon={<Workflow className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {bottomModules.map((module) => (
          <button
            key={module.id}
            type="button"
            className={`group rounded-2xl border px-3 py-3 text-center transition ${
              module.active
                ? 'arch-twin-card-active'
                : 'arch-twin-card hover:border-[var(--arch-twin-accent)] hover:bg-[var(--arch-twin-accent-soft)]'
            }`}
          >
            <span className="arch-twin-icon mx-auto flex h-11 w-11 items-center justify-center rounded-2xl transition group-hover:scale-105">
              {module.icon}
            </span>
            <span className="arch-twin-text mt-2 block text-sm font-black">{module.label}</span>
          </button>
        ))}
      </div>
    </HmiPanel>
  );
}

function SceneNode({
  node,
}: {
  node: (typeof twinSceneNodes)[number];
}) {
  return (
    <div
      className={`absolute ${node.width} -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 shadow-[var(--arch-twin-glow)] backdrop-blur ${sceneToneClass(
        node.tone,
      )}`}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <div className="flex items-start gap-2">
        <span className="arch-twin-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
          {node.icon}
        </span>
        <span className="min-w-0">
          <span className="arch-twin-text block truncate text-sm font-black">{node.title}</span>
          <span className="arch-twin-muted mt-1 block truncate font-mono text-[10px]">
            {node.subtitle}
          </span>
        </span>
      </div>
    </div>
  );
}

function IsometricPlant() {
  return (
    <div className="absolute left-1/2 top-[54%] h-[310px] w-[560px] max-w-[86%] -translate-x-1/2 -translate-y-1/2">
      <div className="absolute inset-0 rounded-[2rem] border border-[var(--arch-twin-border)] bg-[var(--arch-twin-accent-soft)] shadow-[var(--arch-twin-glow)] [transform:skew(-12deg)_rotateX(58deg)_rotateZ(-2deg)]" />
      <div className="absolute left-[11%] top-[40%] h-10 w-[68%] rounded bg-[var(--arch-twin-model-slab)] shadow-[var(--arch-twin-glow)] [transform:skew(-18deg)]" />
      <div className="absolute left-[20%] top-[30%] h-10 w-[52%] rounded bg-[var(--arch-twin-model-slab)] [transform:skew(-18deg)]" />
      <div className="absolute left-[32%] top-[17%] h-24 w-8 rounded bg-[var(--arch-twin-model-beam)] shadow-[var(--arch-twin-glow)]" />
      <div className="absolute right-[30%] top-[18%] h-24 w-8 rounded bg-[var(--arch-twin-model-beam)] shadow-[var(--arch-twin-glow)]" />
      <div className="absolute left-[23%] top-[20%] h-[164px] w-6 rotate-[-26deg] rounded bg-[var(--arch-success)] shadow-[var(--arch-twin-glow)]" />
      <div className="arch-twin-model-danger absolute right-[18%] top-[24%] h-28 w-28 rounded" />
      <div className="absolute right-[3%] top-[38%] h-28 w-4 rotate-[-38deg] rounded bg-[var(--arch-twin-warning)] shadow-[var(--arch-twin-glow)]" />
      <div className="arch-twin-model-warning absolute right-0 top-[65%] h-12 w-12 rounded-full" />
      {Array.from({ length: 34 }, (_, index) => (
        <span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-[var(--arch-twin-accent)] shadow-[var(--arch-twin-glow)]"
          style={{
            left: `${14 + ((index * 17) % 68)}%`,
            top: `${10 + ((index * 29) % 72)}%`,
          }}
        />
      ))}
    </div>
  );
}

function RealityLayerNote() {
  return (
    <div className="absolute bottom-4 left-4 right-4 grid gap-3 md:grid-cols-3">
      {steelSimulationThreads.slice(0, 3).map((thread) => (
        <div key={thread.id} className="arch-twin-canvas-toolbar rounded-2xl p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="arch-twin-text text-sm font-black">{thread.name}</p>
            <span className="arch-twin-accent font-mono text-xs font-black">{thread.confidence}%</span>
          </div>
          <p className="arch-twin-muted mt-2 line-clamp-2 text-xs leading-5">{thread.engine}</p>
        </div>
      ))}
    </div>
  );
}

function HmiPanel({
  title,
  eyebrow,
  icon,
  children,
  className = '',
}: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`arch-twin-panel rounded-[1.6rem] p-4 backdrop-blur ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="arch-twin-muted font-mono text-[10px] uppercase tracking-[0.3em]">
            {eyebrow}
          </p>
          <h2 className="arch-twin-text mt-1 text-xl font-black tracking-[-0.035em]">{title}</h2>
        </div>
        <span className="arch-twin-icon flex h-9 w-9 items-center justify-center rounded-xl">
          {icon}
        </span>
      </div>
      {children}
    </section>
  );
}

function FrameChrome() {
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 h-10 w-28 border-l border-t border-[var(--arch-twin-border)]" />
      <div className="pointer-events-none absolute right-3 top-3 h-10 w-28 border-r border-t border-[var(--arch-twin-border)]" />
      <div className="pointer-events-none absolute bottom-3 left-3 h-10 w-28 border-b border-l border-[var(--arch-twin-border)]" />
      <div className="pointer-events-none absolute bottom-3 right-3 h-10 w-28 border-b border-r border-[var(--arch-twin-border)]" />
      <div className="arch-twin-frame-grid pointer-events-none absolute inset-0" />
    </>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'green' | 'amber' | 'red' }) {
  return (
    <div className="arch-twin-card rounded-xl px-3 py-2">
      <p className="arch-twin-muted text-[10px]">{label}</p>
      <p className={`mt-1 font-mono text-lg font-black ${textToneClass(tone)}`}>{value}</p>
    </div>
  );
}

function StageLamp({ status }: { status: SteelStageStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-black ${stageLampClass(status)}`}>
      {stageLabel(status)}
    </span>
  );
}

function Gauge({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: 'cyan' | 'green' }) {
  return (
    <div className="arch-twin-card rounded-2xl p-3 text-center">
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 bg-[var(--arch-twin-accent-soft)] shadow-[var(--arch-twin-glow)] ${tone === 'green' ? 'border-[var(--arch-success)]' : 'border-[var(--arch-twin-accent)]'}`}>
        <span>
          <span className={`block text-xl font-black ${tone === 'green' ? 'arch-twin-success-text' : 'arch-twin-accent'}`}>
            {value}
          </span>
          <span className="arch-twin-muted block font-mono text-[10px]">{unit}</span>
        </span>
      </div>
      <p className="arch-twin-text mt-2 text-sm font-bold">{label}</p>
    </div>
  );
}

function MiniBar({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="arch-twin-muted truncate">{label}</span>
        <span className={danger ? 'arch-twin-danger-text font-mono font-black' : 'arch-twin-accent font-mono font-black'}>
          {value}%
        </span>
      </div>
      <div className="arch-twin-progress-track h-1.5 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${danger ? 'bg-[var(--arch-twin-danger)]' : 'arch-twin-progress-fill'}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SceneBadge({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'green' | 'amber' | 'red' }) {
  return (
    <span className="arch-twin-card rounded-full px-3 py-1 text-xs">
      <span className="arch-twin-muted">{label}</span>
      <span className={`ml-2 font-black ${textToneClass(tone)}`}>{value}</span>
    </span>
  );
}

function AlarmRow({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level: 'normal' | 'warning' | 'critical';
}) {
  return (
    <div className="arch-twin-card grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl px-3 py-2 text-sm">
      <span className="arch-twin-text truncate">{label}</span>
      <span className="arch-twin-muted font-mono">{value}</span>
      <span className={level === 'critical' ? 'h-2.5 w-2.5 rounded-full bg-[var(--arch-twin-danger)] shadow-[var(--arch-twin-glow)]' : 'h-2.5 w-2.5 rounded-full bg-[var(--arch-twin-warning)] shadow-[var(--arch-twin-glow)]'} />
    </div>
  );
}

function stageLabel(status: SteelStageStatus) {
  if (status === 'complete') {
    return '完成';
  }
  if (status === 'active') {
    return '运行';
  }
  if (status === 'watch') {
    return '预警';
  }
  return '阻断';
}

function stageLampClass(status: SteelStageStatus) {
  if (status === 'complete') {
    return 'arch-twin-stage-complete';
  }
  if (status === 'active') {
    return 'arch-twin-stage-active';
  }
  if (status === 'watch') {
    return 'arch-twin-stage-watch';
  }
  return 'arch-twin-stage-blocked';
}

function sceneToneClass(tone: string) {
  if (tone === 'red') {
    return 'arch-twin-tone-danger';
  }
  if (tone === 'amber') {
    return 'arch-twin-tone-warning';
  }
  if (tone === 'blue') {
    return 'arch-twin-tone-blue';
  }
  return 'arch-twin-tone-accent';
}

function textToneClass(tone: 'cyan' | 'green' | 'amber' | 'red') {
  if (tone === 'green') {
    return 'arch-twin-success-text';
  }
  if (tone === 'amber') {
    return 'arch-twin-warning-text';
  }
  if (tone === 'red') {
    return 'arch-twin-danger-text';
  }
  return 'arch-twin-accent';
}
