// components/ModuleOperationalPanel.tsx - Module-specific interactive business surface
// License: Apache-2.0
'use client';

import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleDot,
  Factory,
  FileCog,
  Layers3,
  PackageCheck,
  Pause,
  Play,
  ScanLine,
  ShieldAlert,
  Truck,
  Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ModuleActionResult } from '@/lib/module-actions';
import { createMockAuditEvent } from '@/lib/module-actions';
import {
  getModuleOperationalProfile,
  type ModuleFeatureCard,
  type ModuleOperationButton,
} from '@/lib/module-operations';
import type { ModuleSpec } from '@/lib/module-registry';
import {
  steelMembers,
  steelSensors,
  steelTwinLayers,
} from '@/lib/digital-twin';

type AuditEvent = ModuleActionResult['auditEvent'];

const featureStatusLabels: Record<ModuleFeatureCard['status'], string> = {
  ready: '就绪',
  running: '运行中',
  review: '审阅',
  blocked: '阻断',
};

export function ModuleOperationalPanel({
  spec,
  onAudit,
}: {
  spec: ModuleSpec;
  onAudit?: (event: AuditEvent) => void;
}) {
  const profile = getModuleOperationalProfile(spec.id);
  const [selectedFeatureId, setSelectedFeatureId] = useState(profile.features[0]?.id ?? '');
  const [operationStates, setOperationStates] = useState<Record<string, string>>({});
  const selectedFeature = profile.features.find((feature) => feature.id === selectedFeatureId) ?? profile.features[0];

  function emit(summary: string) {
    onAudit?.(createMockAuditEvent(`${spec.id}-operation`, 'ModuleOperationalPanel', summary));
  }

  function selectFeature(feature: ModuleFeatureCard) {
    setSelectedFeatureId(feature.id);
    emit(`${spec.zhName}: 打开功能 ${feature.title}`);
  }

  function runOperation(operation: ModuleOperationButton) {
    setOperationStates((current) => ({
      ...current,
      [operation.id]: `已执行 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
    }));
    emit(`${spec.zhName}: ${operation.result}`);
  }

  return (
    <section className="rounded-[1.75rem] border border-cyan-200/18 bg-[#071523] p-4 text-white shadow-[0_18px_70px_rgba(2,6,23,0.32)]">
      <div className="flex flex-col gap-3 border-b border-cyan-200/10 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/64">
            Functional system
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-[-0.05em]">{profile.title}</h2>
          <p className="mt-2 max-w-5xl text-sm leading-7 text-cyan-50/68">{profile.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.statusTracks.map((track) => (
            <span key={track} className="rounded-full border border-cyan-200/16 bg-cyan-300/8 px-3 py-1 text-xs font-black text-cyan-100">
              {track}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {profile.features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => selectFeature(feature)}
                className={`rounded-2xl border p-4 text-left transition ${
                  feature.id === selectedFeatureId
                    ? 'border-cyan-200/70 bg-cyan-300/14 shadow-[0_0_28px_rgba(34,211,238,0.18)]'
                    : 'border-cyan-200/12 bg-white/[0.045] hover:border-cyan-200/36 hover:bg-cyan-300/8'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-black">{feature.title}</h3>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${featureStatusClass(feature.status)}`}>
                    {featureStatusLabels[feature.status]}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-cyan-50/62">{feature.description}</p>
                <p className="mt-3 text-xs text-cyan-200/70">Owner: {feature.owner}</p>
              </button>
            ))}
          </div>

          {spec.id === 'digital_twin' ? <DigitalTwinControl onAudit={emit} /> : null}
          {spec.id === 'production_manufacturing' ? <ProductionControl onAudit={emit} /> : null}
          {spec.id === 'construction_supervision' ? <ConstructionControl onAudit={emit} /> : null}
          {spec.id === 'material_logistics' ? <MaterialLogisticsControl onAudit={emit} /> : null}
          {!['digital_twin', 'production_manufacturing', 'construction_supervision', 'material_logistics'].includes(spec.id) ? (
            <GenericModuleControl selectedFeature={selectedFeature} onAudit={emit} />
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border border-cyan-200/14 bg-slate-950/52 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-200/58">
                  Selected function
                </p>
                <h3 className="mt-1 text-2xl font-black">{selectedFeature?.title}</h3>
              </div>
              <CircleDot className="h-5 w-5 text-cyan-200" />
            </div>
            <p className="mt-3 text-sm leading-7 text-cyan-50/68">{selectedFeature?.description}</p>
            <div className="mt-4 grid gap-2">
              {selectedFeature?.metrics.map((metric) => (
                <div key={metric} className="rounded-2xl border border-cyan-200/12 bg-white/[0.045] px-3 py-2 text-sm text-cyan-50/78">
                  {metric}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-cyan-200/14 bg-slate-950/52 p-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-cyan-200" />
              <h3 className="text-xl font-black">操作按钮区</h3>
            </div>
            <div className="mt-3 space-y-2">
              {profile.operations.map((operation) => (
                <button
                  key={operation.id}
                  type="button"
                  onClick={() => runOperation(operation)}
                  className="w-full rounded-2xl border border-cyan-200/14 bg-cyan-300/10 px-3 py-3 text-left transition hover:border-cyan-200/50 hover:bg-cyan-300/18"
                >
                  <span className="block text-sm font-black text-white">{operation.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-cyan-50/58">
                    {operationStates[operation.id] ?? operation.result}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function GenericModuleControl({
  selectedFeature,
  onAudit,
}: {
  selectedFeature: ModuleFeatureCard | undefined;
  onAudit: (summary: string) => void;
}) {
  const [reviewState, setReviewState] = useState('未生成');
  const [riskState, setRiskState] = useState('等待评估');
  const [handoverState, setHandoverState] = useState('未移交');

  function update(label: string, setter: (value: string) => void, value: string) {
    setter(value);
    onAudit(`${selectedFeature?.title ?? '模块功能'}: ${label}`);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ActionTile
        icon={<FileCog className="h-5 w-5" />}
        title="生成业务包"
        value={reviewState}
        onClick={() => update('生成业务包完成', setReviewState, '已生成 · 待评估')}
      />
      <ActionTile
        icon={<ShieldAlert className="h-5 w-5" />}
        title="风险校核"
        value={riskState}
        onClick={() => update('风险校核完成', setRiskState, '发现 2 项可控风险')}
      />
      <ActionTile
        icon={<PackageCheck className="h-5 w-5" />}
        title="移交下游"
        value={handoverState}
        onClick={() => update('移交状态更新', setHandoverState, '已生成下游 Token')}
      />
    </div>
  );
}

function DigitalTwinControl({ onAudit }: { onAudit: (summary: string) => void }) {
  const [selectedMemberId, setSelectedMemberId] = useState(steelMembers[0]?.id ?? '');
  const [activeLayerIds, setActiveLayerIds] = useState(() => steelTwinLayers.slice(0, 4).map((layer) => layer.id));
  const [playing, setPlaying] = useState(false);
  const [overlay, setOverlay] = useState<'quality' | 'safety' | 'cost'>('quality');
  const [viewpoint, setViewpoint] = useState('总览视角');
  const [snapshotCount, setSnapshotCount] = useState(0);
  const selectedMember = steelMembers.find((member) => member.id === selectedMemberId) ?? steelMembers[0];
  const activeSensors = steelSensors.filter((sensor) => sensor.memberId === selectedMember?.id || sensor.status !== 'normal');

  function toggleLayer(layerId: string) {
    setActiveLayerIds((current) =>
      current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId],
    );
    onAudit(`数字孪生: 切换图层 ${layerId}`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
      <div className="rounded-[1.5rem] border border-cyan-200/14 bg-slate-950/52 p-4">
        <h3 className="text-xl font-black">构件树</h3>
        <div className="mt-3 space-y-2">
          {steelMembers.slice(0, 7).map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setSelectedMemberId(member.id);
                onAudit(`数字孪生: 选择构件 ${member.memberMark}`);
              }}
              className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                selectedMemberId === member.id
                  ? 'border-cyan-200/70 bg-cyan-300/14'
                  : 'border-cyan-200/12 bg-white/[0.045] hover:border-cyan-200/36'
              }`}
            >
              <span className="block text-sm font-black">{member.memberMark}</span>
              <span className="mt-1 block text-xs text-cyan-50/58">{member.assembly} · {member.status}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[420px] rounded-[1.5rem] border border-cyan-200/14 bg-[#020817] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-200/58">
              WebGPU viewport
            </p>
            <h3 className="mt-1 text-2xl font-black">{viewpoint} · {selectedMember?.memberMark}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label="WebGPU" value="ready" />
            <StatusPill label="Three.js fallback" value="standby" />
          </div>
        </div>

        <div className="relative mt-4 min-h-[300px] overflow-hidden rounded-[1.4rem] border border-cyan-200/12 bg-[radial-gradient(circle_at_45%_32%,rgba(34,211,238,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(3,7,18,1))]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-[12%] top-[24%] h-12 w-[70%] -skew-x-12 rounded bg-cyan-100/78 shadow-[0_0_28px_rgba(103,232,249,0.42)]" />
          <div className="absolute left-[18%] top-[48%] h-12 w-[58%] -skew-x-12 rounded bg-cyan-300/36 shadow-[0_0_34px_rgba(34,211,238,0.3)]" />
          <div className="absolute left-[28%] top-[20%] h-[170px] w-7 rounded bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.3)]" />
          <div className="absolute right-[25%] top-[22%] h-[170px] w-7 rounded bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.3)]" />
          <div className={`absolute right-[18%] top-[44%] h-20 w-20 rounded-full border ${
            overlay === 'quality'
              ? 'border-emerald-300 bg-emerald-300/24'
              : overlay === 'safety'
                ? 'border-red-300 bg-red-400/24'
                : 'border-amber-300 bg-amber-300/24'
          } shadow-[0_0_34px_rgba(34,211,238,0.2)]`} />
          {Array.from({ length: 26 }, (_, index) => (
            <span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-full bg-cyan-100/72 shadow-[0_0_12px_rgba(103,232,249,0.86)]"
              style={{ left: `${10 + ((index * 19) % 78)}%`, top: `${14 + ((index * 23) % 70)}%` }}
            />
          ))}
          <div className="absolute bottom-4 left-4 right-4 grid gap-2 md:grid-cols-3">
            {['IFC', 'GLB', '点云', '360', '三维扫描', '倾斜摄影'].map((source) => (
              <span key={source} className="rounded-xl border border-cyan-200/16 bg-slate-950/64 px-3 py-2 text-xs font-black">
                {source}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {['总览视角', '吊装视角', '构件视角', '点云残差', '成本热区'].map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => {
                setViewpoint(view);
                onAudit(`数字孪生: 切换视角 ${view}`);
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${
                viewpoint === view ? 'border-cyan-200 bg-cyan-300 text-slate-950' : 'border-cyan-200/12 bg-white/[0.045]'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <ControlBox title="图层管理" icon={<Layers3 className="h-4 w-4" />}>
          {steelTwinLayers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => toggleLayer(layer.id)}
              className={`mb-2 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
                activeLayerIds.includes(layer.id)
                  ? 'border-cyan-200/60 bg-cyan-300/14'
                  : 'border-cyan-200/12 bg-white/[0.045]'
              }`}
            >
              <span>{layer.name}</span>
              <span>{layer.progress}%</span>
            </button>
          ))}
        </ControlBox>

        <ControlBox title="进度与叠加" icon={<Activity className="h-4 w-4" />}>
          <button
            type="button"
            onClick={() => {
              setPlaying((current) => !current);
              onAudit(`数字孪生: ${playing ? '暂停' : '播放'}进度对比`);
            }}
            className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-slate-950"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? '暂停进度' : '播放进度'}
          </button>
          <div className="grid grid-cols-3 gap-2">
            {(['quality', 'safety', 'cost'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setOverlay(item);
                  onAudit(`数字孪生: 切换 ${item} overlay`);
                }}
                className={`rounded-xl border px-2 py-2 text-xs font-black ${
                  overlay === item ? 'border-cyan-200 bg-cyan-300 text-slate-950' : 'border-cyan-200/12 bg-white/[0.045]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </ControlBox>

        <ControlBox title="模型状态" icon={<ScanLine className="h-4 w-4" />}>
          <p className="text-sm leading-6 text-cyan-50/72">
            {selectedMember?.section} · {selectedMember?.materialGrade}
          </p>
          <p className="mt-2 text-xs text-cyan-200/72">
            IoT 告警: {activeSensors.length} · 几何 {selectedMember?.geometryStatus} · 属性 {selectedMember?.propertyStatus}
          </p>
          <button
            type="button"
            onClick={() => {
              setSnapshotCount((current) => current + 1);
              onAudit('数字孪生: 已导出孪生快照和模型包');
            }}
            className="mt-3 w-full rounded-xl border border-cyan-200/30 bg-white/[0.06] px-3 py-2 text-xs font-black"
          >
            导出孪生快照 #{snapshotCount + 1}
          </button>
        </ControlBox>
      </div>
    </div>
  );
}

function ProductionControl({ onAudit }: { onAudit: (summary: string) => void }) {
  const [workOrderState, setWorkOrderState] = useState('排产中');
  const [cncState, setCncState] = useState('未生成');
  const [qcState, setQcState] = useState('待检');
  const [shipmentState, setShipmentState] = useState('待包装');

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <ActionTile icon={<Factory className="h-5 w-5" />} title="工单状态" value={workOrderState} onClick={() => { setWorkOrderState('已下发 MES'); onAudit('生产制造: 工单状态切换为已下发 MES'); }} />
      <ActionTile icon={<FileCog className="h-5 w-5" />} title="CNC 文件" value={cncState} onClick={() => { setCncState('NC/DXF 已生成'); onAudit('生产制造: 已生成 CNC/数控文件'); }} />
      <ActionTile icon={<CheckCircle2 className="h-5 w-5" />} title="质检状态" value={qcState} onClick={() => { setQcState('焊接/涂装复检通过'); onAudit('生产制造: 质检状态更新为通过'); }} />
      <ActionTile icon={<Truck className="h-5 w-5" />} title="发运批次" value={shipmentState} onClick={() => { setShipmentState('PKG-RF-07 已发运'); onAudit('生产制造: 发运批次已安排'); }} />
    </div>
  );
}

function ConstructionControl({ onAudit }: { onAudit: (summary: string) => void }) {
  const [safetyIssues, setSafetyIssues] = useState(6);
  const [rectification, setRectification] = useState('11 单 · 81% 闭环');
  const [logState, setLogState] = useState('今日未生成');
  const [record, setRecord] = useState('AR');

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1.1fr_1fr]">
      <ActionTile icon={<ShieldAlert className="h-5 w-5" />} title="安全问题" value={`${safetyIssues} 项`} onClick={() => { setSafetyIssues((current) => current + 1); onAudit('施工监理: 已创建安全问题和整改责任'); }} />
      <ActionTile icon={<CheckCircle2 className="h-5 w-5" />} title="整改闭环" value={rectification} onClick={() => { setRectification('12 单 · 86% 闭环'); onAudit('施工监理: 整改闭环状态更新'); }} />
      <ActionTile icon={<FileCog className="h-5 w-5" />} title="日志生成" value={logState} onClick={() => { setLogState('施工日志已生成'); onAudit('施工监理: 已生成施工日志'); }} />
      <div className="rounded-[1.5rem] border border-cyan-200/14 bg-slate-950/52 p-4 lg:col-span-3">
        <h3 className="text-xl font-black">AR / 360 / 扫描记录选择</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {['AR', '360 全景', '三维扫描', '倾斜摄影', '无人机'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setRecord(item);
                onAudit(`施工监理: 选择 ${item} 证据记录`);
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${
                record === item ? 'border-cyan-200 bg-cyan-300 text-slate-950' : 'border-cyan-200/12 bg-white/[0.045]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MaterialLogisticsControl({ onAudit }: { onAudit: (summary: string) => void }) {
  const [inventory, setInventory] = useState('红区 3 类');
  const [purchase, setPurchase] = useState('采购计划待生成');
  const [cutting, setCutting] = useState('下料单待生成');
  const [receipt, setReceipt] = useState('8 包待签收');

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <ActionTile icon={<Boxes className="h-5 w-5" />} title="库存状态" value={inventory} onClick={() => { setInventory('已锁定 Q355B 批次'); onAudit('材料物流: 库存状态已更新'); }} />
      <ActionTile icon={<PackageCheck className="h-5 w-5" />} title="采购计划" value={purchase} onClick={() => { setPurchase('5 批采购计划已生成'); onAudit('材料物流: 采购计划已生成'); }} />
      <ActionTile icon={<FileCog className="h-5 w-5" />} title="下料单" value={cutting} onClick={() => { setCutting('312 条下料单已生成'); onAudit('材料物流: 下料单已生成'); }} />
      <ActionTile icon={<Truck className="h-5 w-5" />} title="物流签收" value={receipt} onClick={() => { setReceipt('PKG-RF-07 已签收'); onAudit('材料物流: 批次签收状态已更新'); }} />
    </div>
  );
}

function ActionTile({
  icon,
  title,
  value,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.5rem] border border-cyan-200/14 bg-slate-950/52 p-4 text-left transition hover:border-cyan-200/48 hover:bg-cyan-300/10"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
        {icon}
      </span>
      <span className="mt-3 block text-lg font-black text-white">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-cyan-50/68">{value}</span>
    </button>
  );
}

function ControlBox({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-cyan-200/14 bg-slate-950/52 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        <span className="text-cyan-200">{icon}</span>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-cyan-200/16 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
      {label}: {value}
    </span>
  );
}

function featureStatusClass(status: ModuleFeatureCard['status']) {
  if (status === 'blocked') {
    return 'bg-red-400/14 text-red-200';
  }
  if (status === 'review') {
    return 'bg-amber-300/14 text-amber-200';
  }
  if (status === 'running') {
    return 'bg-cyan-300/14 text-cyan-100';
  }
  return 'bg-emerald-300/14 text-emerald-200';
}
