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

const bottomModules = [
  { id: 'overview', label: '综合全览', icon: <Activity className="h-5 w-5" />, active: true },
  { id: 'tree', label: '大纲目录树', icon: <GitBranch className="h-5 w-5" /> },
  { id: 'zero-code', label: '零代码编排', icon: <Workflow className="h-5 w-5" /> },
  { id: 'blueprint', label: '蓝图编辑器', icon: <Cpu className="h-5 w-5" /> },
  { id: 'twin-editor', label: '孪生编辑器', icon: <ScanLine className="h-5 w-5" /> },
  { id: 'device', label: '设备详情', icon: <Layers3 className="h-5 w-5" /> },
];

export function DigitalTwinWorkbench() {
  const [selectedStageId, setSelectedStageId] = useState(fallbackStage?.id ?? 'erection');
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
    <main className="min-h-screen bg-[#020817] p-3 text-cyan-50 md:p-5">
      <div className="relative mx-auto min-h-[calc(100vh-24px)] max-w-[1840px] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_50%_10%,rgba(34,211,238,0.16),transparent_32%),linear-gradient(180deg,#06162b_0%,#020817_72%)] shadow-[0_0_80px_rgba(8,145,178,0.18)]">
        <FrameChrome />
        <TopBar readiness={readiness} blockers={blockers.length} exportReady={exportReady} />

        <section className="relative z-10 grid gap-4 px-4 pb-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_330px]">
          <LeftPanel selectedStageId={selectedStageId} onSelectStage={setSelectedStageId} />

          <section className="space-y-4">
            <CenterScene selectedStage={selectedStage} activeMembers={activeMembers.length} />
            <ModuleDock />
          </section>

          <RightPanel
            warningSensors={warningSensors}
            criticalGates={criticalGates}
            readiness={readiness}
          />
        </section>
      </div>
    </main>
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
        <div className="hidden h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-cyan-300/15 lg:block" />
        <div className="rounded-b-[2rem] border-x border-b border-cyan-300/30 bg-cyan-300/10 px-6 py-3 text-center shadow-[0_0_30px_rgba(34,211,238,0.18)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-cyan-200/72">
            ArchIToken · Heavy Steel Twin
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-[0.08em] text-white md:text-3xl">
            重钢结构数字孪生平台
          </h1>
        </div>
        <div className="hidden h-px bg-gradient-to-l from-transparent via-cyan-300/45 to-cyan-300/15 lg:block" />
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
  selectedStageId,
  onSelectStage,
}: {
  selectedStageId: string;
  onSelectStage: (stageId: string) => void;
}) {
  const tonnage = steelProcessMetrics.find((metric) => metric.id === 'tonnage');
  const members = steelProcessMetrics.find((metric) => metric.id === 'members');

  return (
    <aside className="space-y-4">
      <HmiPanel title="项目大纲目录树" eyebrow="Outline tree" icon={<GitBranch className="h-4 w-4" />}>
        <div className="space-y-1.5">
          {steelTwinStages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                selectedStageId === stage.id
                  ? 'border-cyan-200/70 bg-cyan-300/16 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                  : 'border-cyan-300/10 bg-cyan-950/18 hover:border-cyan-300/35'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-cyan-100/10 font-mono text-[10px] text-cyan-100">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{stage.name}</span>
                <span className="mt-0.5 block truncate text-[10px] text-cyan-100/48">
                  {stage.evidence}
                </span>
              </span>
              <StageLamp status={stage.status} />
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
}: {
  selectedStage: (typeof steelTwinStages)[number] | undefined;
  activeMembers: number;
}) {
  return (
    <HmiPanel
      title="重钢构件加工-物流-吊装总览"
      eyebrow="Twin scene"
      icon={<Factory className="h-4 w-4" />}
      className="min-h-[620px]"
    >
      <div className="relative min-h-[520px] overflow-hidden rounded-[1.5rem] border border-cyan-300/16 bg-[#061427] shadow-inner">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.08)_1px,transparent_1px)] bg-[size:38px_38px]" />
        <div className="absolute inset-x-5 top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/18 bg-slate-950/52 px-4 py-2 backdrop-blur">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-cyan-200/62">
              当前作业包
            </p>
            <p className="text-lg font-black text-white">{selectedStage?.name ?? '施工管理'}</p>
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
            stroke="#22d3ee"
            strokeDasharray="12 10"
            strokeWidth="3"
            filter="url(#glow)"
          />
          <path
            d="M260 160 L420 215 L560 155 L742 244"
            fill="none"
            stroke="#facc15"
            strokeDasharray="10 8"
            strokeWidth="2.5"
            filter="url(#glow)"
          />
          <path
            d="M745 310 C785 360 810 415 748 455"
            fill="none"
            stroke="#fb7185"
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
    <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
      <HmiPanel title="监控视频" eyebrow="Vision monitor" icon={<Video className="h-4 w-4" />}>
        <div className="relative h-40 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#061427]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.16),transparent_38%),linear-gradient(135deg,rgba(34,211,238,0.12),transparent)]" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <span className="rounded bg-cyan-300/10 px-2 py-1 font-mono text-[10px] text-cyan-100">
              现场摄像头 · 吊装区
            </span>
            <PlayCircle className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-cyan-300/20 bg-slate-950/56 p-2 text-xs text-cyan-100/76">
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
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/8 p-3">
            <p className="text-xs text-cyan-100/58">孪生就绪度</p>
            <p className="mt-1 text-4xl font-black text-emerald-300">{readiness}%</p>
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
              className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/12 bg-cyan-950/18 px-3 py-2"
            >
              <span className="text-sm font-bold text-white">{pkg.name}</span>
              {pkg.ready ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-300" />
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
                ? 'border-cyan-200/70 bg-cyan-300/16 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                : 'border-cyan-300/12 bg-cyan-950/18 hover:border-cyan-300/42'
            }`}
          >
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-slate-950/48 text-cyan-100 transition group-hover:scale-105">
              {module.icon}
            </span>
            <span className="mt-2 block text-sm font-black text-white">{module.label}</span>
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
      className={`absolute ${node.width} -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 shadow-[0_14px_34px_rgba(0,0,0,0.35)] backdrop-blur ${sceneToneClass(
        node.tone,
      )}`}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
          {node.icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">{node.title}</span>
          <span className="mt-1 block truncate font-mono text-[10px] text-cyan-50/68">
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
      <div className="absolute inset-0 rounded-[2rem] border border-cyan-200/18 bg-cyan-300/8 shadow-[0_0_70px_rgba(34,211,238,0.16)] [transform:skew(-12deg)_rotateX(58deg)_rotateZ(-2deg)]" />
      <div className="absolute left-[11%] top-[40%] h-10 w-[68%] rounded bg-slate-200/84 shadow-[0_0_22px_rgba(226,232,240,0.32)] [transform:skew(-18deg)]" />
      <div className="absolute left-[20%] top-[30%] h-10 w-[52%] rounded bg-slate-300/90 [transform:skew(-18deg)]" />
      <div className="absolute left-[32%] top-[17%] h-24 w-8 rounded bg-cyan-100 shadow-[0_0_20px_rgba(103,232,249,0.5)]" />
      <div className="absolute right-[30%] top-[18%] h-24 w-8 rounded bg-cyan-100 shadow-[0_0_20px_rgba(103,232,249,0.5)]" />
      <div className="absolute left-[23%] top-[20%] h-[164px] w-6 rotate-[-26deg] rounded bg-emerald-200 shadow-[0_0_20px_rgba(167,243,208,0.45)]" />
      <div className="absolute right-[18%] top-[24%] h-28 w-28 rounded border border-red-300/80 bg-red-500/22 shadow-[0_0_34px_rgba(239,68,68,0.38)]" />
      <div className="absolute right-[3%] top-[38%] h-28 w-4 rotate-[-38deg] rounded bg-amber-300 shadow-[0_0_20px_rgba(250,204,21,0.45)]" />
      <div className="absolute right-0 top-[65%] h-12 w-12 rounded-full border border-amber-200/70 bg-orange-400/28 shadow-[0_0_26px_rgba(251,146,60,0.42)]" />
      {Array.from({ length: 34 }, (_, index) => (
        <span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-cyan-100/70 shadow-[0_0_10px_rgba(103,232,249,0.74)]"
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
        <div key={thread.id} className="rounded-2xl border border-cyan-300/14 bg-slate-950/62 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-white">{thread.name}</p>
            <span className="font-mono text-xs font-black text-cyan-200">{thread.confidence}%</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/58">{thread.engine}</p>
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
    <section className={`rounded-[1.6rem] border border-cyan-300/18 bg-[#061226]/86 p-4 shadow-[inset_0_0_30px_rgba(34,211,238,0.05),0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/58">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-white">{title}</h2>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/28 bg-cyan-300/10 text-cyan-100">
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
      <div className="pointer-events-none absolute left-3 top-3 h-10 w-28 border-l border-t border-cyan-300/50" />
      <div className="pointer-events-none absolute right-3 top-3 h-10 w-28 border-r border-t border-cyan-300/50" />
      <div className="pointer-events-none absolute bottom-3 left-3 h-10 w-28 border-b border-l border-cyan-300/50" />
      <div className="pointer-events-none absolute bottom-3 right-3 h-10 w-28 border-b border-r border-cyan-300/50" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:28px_28px]" />
    </>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'green' | 'amber' | 'red' }) {
  return (
    <div className="rounded-xl border border-cyan-300/16 bg-slate-950/36 px-3 py-2">
      <p className="text-[10px] text-cyan-100/50">{label}</p>
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
    <div className="rounded-2xl border border-cyan-300/14 bg-slate-950/36 p-3 text-center">
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 ${tone === 'green' ? 'border-emerald-300/70' : 'border-cyan-200/70'} bg-cyan-950/28 shadow-[0_0_26px_rgba(34,211,238,0.18)]`}>
        <span>
          <span className={`block text-xl font-black ${tone === 'green' ? 'text-emerald-300' : 'text-cyan-100'}`}>
            {value}
          </span>
          <span className="block font-mono text-[10px] text-cyan-100/52">{unit}</span>
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-white">{label}</p>
    </div>
  );
}

function MiniBar({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-cyan-100/64">{label}</span>
        <span className={danger ? 'font-mono font-black text-red-300' : 'font-mono font-black text-cyan-200'}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-cyan-950/80">
        <div className={`h-full rounded-full ${danger ? 'bg-red-400' : 'bg-cyan-300'}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SceneBadge({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'green' | 'amber' | 'red' }) {
  return (
    <span className="rounded-full border border-cyan-300/16 bg-slate-950/50 px-3 py-1 text-xs">
      <span className="text-cyan-100/52">{label}</span>
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
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-cyan-300/12 bg-cyan-950/18 px-3 py-2 text-sm">
      <span className="truncate text-white">{label}</span>
      <span className="font-mono text-cyan-100/70">{value}</span>
      <span className={level === 'critical' ? 'h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]' : 'h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]'} />
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
    return 'bg-emerald-300/12 text-emerald-200';
  }
  if (status === 'active') {
    return 'bg-cyan-300/12 text-cyan-100';
  }
  if (status === 'watch') {
    return 'bg-amber-300/12 text-amber-200';
  }
  return 'bg-red-400/14 text-red-200';
}

function sceneToneClass(tone: string) {
  if (tone === 'red') {
    return 'border-red-300/45 bg-red-500/16';
  }
  if (tone === 'amber') {
    return 'border-amber-300/45 bg-amber-300/14';
  }
  if (tone === 'blue') {
    return 'border-blue-300/45 bg-blue-500/14';
  }
  return 'border-cyan-300/45 bg-cyan-300/14';
}

function textToneClass(tone: 'cyan' | 'green' | 'amber' | 'red') {
  if (tone === 'green') {
    return 'text-emerald-300';
  }
  if (tone === 'amber') {
    return 'text-amber-300';
  }
  if (tone === 'red') {
    return 'text-red-300';
  }
  return 'text-cyan-200';
}
