// components/DigitalTwinOperationsPanel.tsx - Unified digital twin operations sidecar
// License: Apache-2.0
'use client';

import {
  AimOutlined,
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CodeSandboxOutlined,
  CompassOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  EyeOutlined,
  HeatMapOutlined,
  LineChartOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Button, Progress, Segmented, Switch, Tag, Tooltip } from 'antd';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { DigitalTwinWebGPUViewport } from '@/components/DigitalTwinWebGPUViewport';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import {
  getSteelTwinBlockingIssues,
  getSteelTwinReadinessScore,
  steelExportPackages,
  steelMembers,
  steelProcessMetrics,
  steelQualityGates,
  steelTwinRuntimeCapabilities,
  steelSensors,
  steelSimulationThreads,
  steelTwinLayers,
  steelTwinViewportModes,
  steelTwinVisualizationReferences,
  type SteelMember,
  type SteelMemberStatus,
  type SteelMemberTwinGeometry,
  type SteelSensorPoint,
  type SteelTwinLayerId,
  type SteelTwinViewportModeId,
  getSteelMemberTwinGeometry,
  getSteelSensorTwinPosition,
} from '@/lib/digital-twin';

interface DigitalTwinOperationsPanelProps {
  onAudit?: (event: ModuleAuditEvent) => void;
  variant?: 'sidecar' | 'main';
}

const defaultModeId: SteelTwinViewportModeId = steelTwinViewportModes[0]?.id ?? 'cde_model';
const defaultMemberId = steelMembers[0]?.id ?? '';
const defaultLayerIds: SteelTwinLayerId[] = [
  'semantic_ifc',
  'reality_splat',
  'iot_scada',
  'simulation',
  'process',
  'risk',
];

interface SteelFrameElement {
  id: string;
  kind: 'column' | 'beam' | 'brace' | 'deck' | 'truss' | 'outrigger' | 'crane';
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  opacity?: number;
}

export function DigitalTwinOperationsPanel({
  onAudit,
  variant = 'sidecar',
}: DigitalTwinOperationsPanelProps) {
  const [activeModeId, setActiveModeId] = useState<SteelTwinViewportModeId>(defaultModeId);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<SteelTwinLayerId>>(
    () => new Set(steelTwinViewportModes[0]?.focusLayerIds ?? defaultLayerIds),
  );
  const [selectedMemberId, setSelectedMemberId] = useState(defaultMemberId);
  const [progressPlaying, setProgressPlaying] = useState(false);
  const [memberGeometryOverrides, setMemberGeometryOverrides] = useState<
    Partial<Record<string, SteelMemberTwinGeometry>>
  >({});
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(() => new Set());

  const activeMode =
    steelTwinViewportModes.find((mode) => mode.id === activeModeId) ??
    steelTwinViewportModes[0];
  const visibleMembers = steelMembers.filter((member) => !hiddenMemberIds.has(member.id));
  const selectedMember =
    visibleMembers.find((member) => member.id === selectedMemberId) ??
    visibleMembers[0] ??
    steelMembers[0];
  const selectedMemberGeometry = selectedMember
    ? getSteelMemberTwinGeometry(selectedMember, memberGeometryOverrides)
    : null;
  const activeLayerCount = activeLayerIds.size;
  const readinessScore = getSteelTwinReadinessScore();
  const blockingIssues = getSteelTwinBlockingIssues();
  const runtimeReadyCount = steelTwinRuntimeCapabilities.filter((capability) => capability.status !== 'planned').length;

  function emit(summary: string) {
    onAudit?.(createModuleAuditEvent('digital-twin-ops', 'DigitalTwinOperationsPanel', summary));
  }

  function selectMode(modeId: SteelTwinViewportModeId) {
    const nextMode = steelTwinViewportModes.find((mode) => mode.id === modeId);
    setActiveModeId(modeId);
    if (nextMode) {
      setActiveLayerIds(new Set(nextMode.focusLayerIds));
      emit(`数字孪生: 切换视口 ${nextMode.name}`);
    }
  }

  function toggleLayer(layerId: SteelTwinLayerId, checked: boolean) {
    setActiveLayerIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(layerId);
      } else {
        next.delete(layerId);
      }
      return next;
    });
    const layer = steelTwinLayers.find((item) => item.layerId === layerId);
    emit(`数字孪生: ${checked ? '启用' : '关闭'}图层 ${layer?.name ?? layerId}`);
  }

  function selectMember(memberId: string) {
    const member = steelMembers.find((item) => item.id === memberId);
    if (!member || hiddenMemberIds.has(memberId)) return;
    setSelectedMemberId(memberId);
    emit(`数字孪生: 选择构件 ${member?.memberMark ?? memberId}`);
  }

  function moveSelectedMember(axis: 'x' | 'y' | 'z', delta: number) {
    if (!selectedMember) return;
    setMemberGeometryOverrides((current) => {
      const base = current[selectedMember.id] ?? getSteelMemberTwinGeometry(selectedMember);
      const position: [number, number, number] = [...base.position];
      const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      position[axisIndex] = Math.round((position[axisIndex] + delta) * 100) / 100;
      return {
        ...current,
        [selectedMember.id]: {
          ...base,
          position,
        },
      };
    });
    emit(`数字孪生: 移动构件 ${selectedMember.memberMark} ${axis}${delta > 0 ? '+' : ''}${delta}m`);
  }

  function resetSelectedMemberGeometry() {
    if (!selectedMember) return;
    setMemberGeometryOverrides((current) => {
      const next = { ...current };
      delete next[selectedMember.id];
      return next;
    });
    emit(`数字孪生: 重置构件 ${selectedMember.memberMark} 位姿覆盖`);
  }

  function softDeleteSelectedMember() {
    if (!selectedMember) return;
    setHiddenMemberIds((current) => {
      const next = new Set(current);
      next.add(selectedMember.id);
      return next;
    });
    const nextMember = visibleMembers.find((member) => member.id !== selectedMember.id);
    if (nextMember) {
      setSelectedMemberId(nextMember.id);
    }
    emit(`数字孪生: 软删除/隐藏构件 ${selectedMember.memberMark}, 待写入 IFC/BCF 变更审批`);
  }

  function restoreHiddenMembers() {
    setHiddenMemberIds(new Set());
    emit('数字孪生: 恢复本会话隐藏构件');
  }

  function togglePlayback() {
    setProgressPlaying((current) => {
      const next = !current;
      emit(`数字孪生: ${next ? '播放' : '暂停'}4D进度回放`);
      return next;
    });
  }

  if (!activeMode || !selectedMember) {
    return null;
  }

  if (variant === 'main') {
    return (
      <section className="relative h-[calc(100dvh-188px)] min-h-[760px] overflow-hidden rounded-lg border border-cyan-300/25 bg-[#06121f] text-slate-100 shadow-[0_24px_80px_rgba(0,13,31,0.42)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(38,198,255,0.22),transparent_34%),linear-gradient(180deg,rgba(5,25,44,0.14),rgba(2,7,16,0.68))]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(85,220,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(85,220,255,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />

        <div className="absolute inset-0 z-0">
          <DigitalTwinWebGPUViewport
            activeLayerIds={activeLayerIds}
            selectedMemberId={selectedMember.id}
            geometryOverrides={memberGeometryOverrides}
            hiddenMemberIds={hiddenMemberIds}
            progressPlaying={progressPlaying}
            onSelectMember={selectMember}
            className="h-full w-full bg-[#06121f]"
            fallback={
              <ThreeTwinFallbackViewport
                activeLayerIds={activeLayerIds}
                selectedMemberId={selectedMember.id}
                geometryOverrides={memberGeometryOverrides}
                hiddenMemberIds={hiddenMemberIds}
                progressPlaying={progressPlaying}
                onSelectMember={selectMember}
                className="h-full"
              />
            }
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-[linear-gradient(180deg,rgba(1,8,18,0.82),transparent)]" />
        <header className="pointer-events-none absolute left-4 right-4 top-3 z-30 grid items-start gap-3 lg:grid-cols-[340px_minmax(0,1fr)_340px]">
          <div className="hidden rounded-md border border-cyan-300/25 bg-[#041422]/70 px-3 py-2 shadow-[0_0_28px_rgba(12,211,255,0.14)] backdrop-blur lg:block">
            <div className="flex items-center justify-between text-[11px] text-cyan-100/80">
              <span className="font-mono">DIGITAL TWIN OPS</span>
              <span className="text-emerald-300">LIVE</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <TwinHudStat label="成熟度" value={`${readinessScore}%`} tone="green" />
              <TwinHudStat label="图层" value={`${activeLayerCount}`} tone="cyan" />
              <TwinHudStat label="阻断" value={`${blockingIssues.length}`} tone="red" />
            </div>
          </div>

          <div className="mx-auto min-w-0 max-w-[760px] rounded-md border border-cyan-300/30 bg-[#03111f]/75 px-5 py-2 text-center shadow-[0_0_32px_rgba(12,211,255,0.18)] backdrop-blur">
            <p className="text-[11px] font-medium uppercase text-cyan-200/75">
              WebGPU / IFC4.3 / 3DGS / IoT / FEA Runtime
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold tracking-normal text-white">
              材料数字化工厂孪生系统
            </h3>
          </div>

          <div className="hidden rounded-md border border-cyan-300/25 bg-[#041422]/70 px-3 py-2 shadow-[0_0_28px_rgba(12,211,255,0.14)] backdrop-blur lg:block">
            <div className="flex items-center justify-between text-[11px] text-cyan-100/80">
              <span>{activeMode.name}</span>
              <span>{runtimeReadyCount}/{steelTwinRuntimeCapabilities.length} 技术栈</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <TwinHudStat label="钢量" value="1,280t" tone="cyan" />
              <TwinHudStat label="构件" value="2,418" tone="green" />
              <TwinHudStat label="吊装" value="86%" tone="amber" />
            </div>
          </div>
        </header>

        <aside className="pointer-events-auto absolute left-4 top-[118px] z-30 hidden w-[330px] space-y-3 lg:block">
          <TwinHudPanel icon={<BarChartOutlined />} title="产线总览" badge="PRODUCTION">
            <div className="grid grid-cols-2 gap-2">
              {steelProcessMetrics.slice(0, 4).map((metric) => (
                <TwinHudMetric key={metric.id} metric={metric} />
              ))}
            </div>
            <MicroBarChart values={[72, 88, 81, 94, 86, 91, 79, 97]} tone="cyan" />
          </TwinHudPanel>

          <TwinHudPanel icon={<LineChartOutlined />} title="质量与能耗趋势" badge="QUALITY">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <TrendBars values={[38, 44, 41, 57, 68, 62, 74, 83, 79, 88]} />
              <div className="text-right">
                <p className="text-2xl font-semibold text-emerald-300">92%</p>
                <p className="text-[11px] text-cyan-100/65">制造节拍</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <TwinHudStat label="UT/RT" value="91%" tone="green" />
              <TwinHudStat label="残差" value="26mm" tone="amber" />
              <TwinHudStat label="红区" value="18%" tone="red" />
            </div>
          </TwinHudPanel>

          <TwinHudPanel icon={<RadarChartOutlined />} title="传感器告警" badge="SCADA">
            <div className="grid gap-2">
              {steelSensors.slice(0, 5).map((sensor) => (
                <TwinHudSensorRow key={sensor.id} sensor={sensor} />
              ))}
            </div>
          </TwinHudPanel>
        </aside>

        <aside className="pointer-events-auto absolute right-4 top-[118px] z-30 hidden w-[330px] space-y-3 xl:block">
          <TwinHudPanel icon={<CodeSandboxOutlined />} title="选中构件" badge={selectedMember.memberMark}>
            <h4 className="truncate text-base font-semibold text-white">
              {selectedMember.memberMark} · {selectedMember.section}
            </h4>
            <p className="mt-1 truncate text-[11px] text-cyan-100/65">
              {selectedMember.assembly} / {selectedMember.siteStatus}
            </p>
            <div className="mt-3 grid gap-2">
              <TwinHudInfo label="状态" value={memberStatusLabel(selectedMember.status)} />
              <TwinHudInfo label="材质" value={selectedMember.materialGrade} />
              <TwinHudInfo label="焊缝" value={selectedMember.weldSpec} />
              <TwinHudInfo label="螺栓" value={selectedMember.boltSpec} />
              {selectedMemberGeometry ? (
                <TwinHudInfo label="坐标" value={formatPosition(selectedMemberGeometry.position)} />
              ) : null}
            </div>
            <MemberEditControls
              tone="hud"
              hiddenCount={hiddenMemberIds.size}
              onMove={moveSelectedMember}
              onReset={resetSelectedMemberGeometry}
              onDelete={softDeleteSelectedMember}
              onRestore={restoreHiddenMembers}
            />
          </TwinHudPanel>

          <TwinHudPanel icon={<HeatMapOutlined />} title="图层控制" badge="LAYERS">
            <div className="grid gap-2">
              {steelTwinLayers.map((layer) => (
                <LayerToggleHud
                  key={layer.id}
                  layer={layer}
                  checked={activeLayerIds.has(layer.layerId)}
                  onChange={(checked) => toggleLayer(layer.layerId, checked)}
                />
              ))}
            </div>
          </TwinHudPanel>
        </aside>

        <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-30 grid gap-3 lg:left-[370px] xl:right-[370px]">
          <div className="rounded-md border border-cyan-300/25 bg-[#03111f]/80 p-2 shadow-[0_0_30px_rgba(12,211,255,0.18)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {steelTwinViewportModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => selectMode(mode.id)}
                  className={`min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    activeModeId === mode.id
                      ? 'border-cyan-200 bg-cyan-300/20 text-white shadow-[0_0_18px_rgba(34,211,238,0.28)]'
                      : 'border-cyan-300/20 bg-cyan-950/25 text-cyan-100/75 hover:border-cyan-200/60 hover:text-white'
                  }`}
                >
                  {mode.name}
                </button>
              ))}
              <Button
                size="small"
                type={progressPlaying ? 'primary' : 'default'}
                icon={progressPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={togglePlayback}
                className="min-h-9"
              >
                4D回放
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3 p-3">
      <div className="arch-card-muted rounded-lg p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="arch-primary-text font-mono text-[10px] font-medium">
              DIGITAL TWIN OPS
            </p>
            <h3 className="arch-text mt-1 text-sm font-medium">
              重钢结构数字孪生运行面板
            </h3>
          </div>
          <Tag color="success" className="m-0 shrink-0 font-medium">
            WebGPU preferred
          </Tag>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricTile label="成熟度" value={`${readinessScore}%`} icon={<SafetyCertificateOutlined />} />
          <MetricTile label="活动图层" value={`${activeLayerCount}`} icon={<ClusterOutlined />} />
          <MetricTile label="阻断项" value={`${blockingIssues.length}`} icon={<WarningOutlined />} />
          <MetricTile label="技术栈" value={`${runtimeReadyCount}/${steelTwinRuntimeCapabilities.length}`} icon={<ThunderboltOutlined />} />
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="arch-primary-text text-xs font-medium">视口模式</p>
            <p className="arch-muted mt-1 text-[11px] leading-5">{activeMode.engine}</p>
          </div>
          <Tooltip title={activeMode.kpi}>
            <Button
              size="small"
              type="text"
              shape="circle"
              icon={<EyeOutlined />}
              aria-label="查看当前视口指标"
            />
          </Tooltip>
        </div>
        <Segmented
          block
          size="small"
          className="mt-3"
          value={activeModeId}
          options={steelTwinViewportModes.map((mode) => ({
            label: mode.name,
            value: mode.id,
          }))}
          onChange={(value) => selectMode(value as SteelTwinViewportModeId)}
        />
      </div>

      <div className="arch-card overflow-hidden rounded-lg">
        <div className="arch-surface-muted border-b px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="arch-primary-text text-xs font-medium">三维主视口</p>
              <h4 className="arch-text mt-0.5 truncate text-sm font-medium">
                {selectedMember.memberMark} · {selectedMember.assembly}
              </h4>
            </div>
            <Button
              size="small"
              type={progressPlaying ? 'primary' : 'default'}
              icon={<PlayCircleOutlined />}
              onClick={togglePlayback}
            >
              4D
            </Button>
          </div>
        </div>
        <DigitalTwinWebGPUViewport
          activeLayerIds={activeLayerIds}
          selectedMemberId={selectedMember.id}
          geometryOverrides={memberGeometryOverrides}
          hiddenMemberIds={hiddenMemberIds}
          progressPlaying={progressPlaying}
          onSelectMember={selectMember}
          className="h-60 bg-[linear-gradient(180deg,rgba(7,193,96,0.08),rgba(255,255,255,0.95))]"
          fallback={
            <ThreeTwinFallbackViewport
              activeLayerIds={activeLayerIds}
              selectedMemberId={selectedMember.id}
              geometryOverrides={memberGeometryOverrides}
              hiddenMemberIds={hiddenMemberIds}
              progressPlaying={progressPlaying}
              onSelectMember={selectMember}
              className="h-full"
            />
          }
        />
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CodeSandboxOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">选中构件</p>
        </div>
        <h4 className="arch-text mt-2 text-base font-medium">
          {selectedMember.memberMark} · {selectedMember.section}
        </h4>
        <div className="mt-3 grid gap-2">
          <InfoPill label="状态" value={memberStatusLabel(selectedMember.status)} />
          <InfoPill label="材质" value={selectedMember.materialGrade} />
          <InfoPill label="焊缝" value={selectedMember.weldSpec} />
          <InfoPill label="螺栓" value={selectedMember.boltSpec} />
          <InfoPill label="现场" value={selectedMember.siteStatus} />
          {selectedMemberGeometry ? (
            <InfoPill label="坐标" value={formatPosition(selectedMemberGeometry.position)} />
          ) : null}
        </div>
        <MemberEditControls
          hiddenCount={hiddenMemberIds.size}
          onMove={moveSelectedMember}
          onReset={resetSelectedMemberGeometry}
          onDelete={softDeleteSelectedMember}
          onRestore={restoreHiddenMembers}
        />
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <DeploymentUnitOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">构件树 / 选择</p>
        </div>
        <div className="mt-3 grid gap-2">
          {visibleMembers.slice(0, 7).map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => selectMember(member.id)}
              className={`rounded-md border px-3 py-2 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] ${
                selectedMember.id === member.id ? 'arch-card-selected' : 'arch-card-muted'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="arch-text block truncate text-xs font-medium">
                    {member.memberMark} · {member.assembly}
                  </span>
                  <span className="arch-muted mt-1 block truncate text-[11px]">
                    {member.section} / {member.siteStatus}
                  </span>
                </span>
                <RiskDot risk={member.risk} />
              </span>
            </button>
          ))}
          {hiddenMemberIds.size > 0 ? (
            <Button size="small" onClick={restoreHiddenMembers}>
              恢复隐藏构件 {hiddenMemberIds.size}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <HeatMapOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">图层栈</p>
        </div>
        <div className="mt-3 grid gap-3">
          {steelTwinLayers.map((layer) => (
            <div key={layer.id} className="arch-card-muted rounded-md p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="arch-text truncate text-xs font-medium">{layer.name}</p>
                  <p className="arch-muted mt-1 line-clamp-1 text-[11px]">{layer.standard}</p>
                </div>
                <Switch
                  size="small"
                  checked={activeLayerIds.has(layer.layerId)}
                  onChange={(checked) => toggleLayer(layer.layerId, checked)}
                  aria-label={`切换 ${layer.name}`}
                />
              </div>
              <Progress
                className="mt-2"
                percent={layer.progress}
                size="small"
                showInfo={false}
                status={layer.status === 'blocked' ? 'exception' : 'active'}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <BarChartOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">过程指标</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {steelProcessMetrics.slice(0, 4).map((metric) => (
            <div key={metric.id} className="arch-card-muted rounded-md px-3 py-2">
              <p className="arch-muted truncate text-[11px] font-medium">{metric.name}</p>
              <p className={`mt-1 text-sm font-medium ${metricToneClass(metric.tone)}`}>
                {metric.value}
                <span className="ml-1 text-[10px] font-medium">{metric.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <AimOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">传感器 / 告警</p>
        </div>
        <div className="mt-3 grid gap-2">
          {steelSensors.slice(0, 5).map((sensor) => (
            <SensorRow key={sensor.id} sensor={sensor} />
          ))}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <SafetyCertificateOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">质量门禁</p>
        </div>
        <div className="mt-3 grid gap-2">
          {steelQualityGates.slice(0, 5).map((gate) => (
            <div key={gate.id} className="arch-card-muted rounded-md px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="arch-text truncate text-xs font-medium">{gate.name}</p>
                <Tag color={gate.status === 'fail' ? 'error' : gate.status === 'review' ? 'warning' : 'success'} className="m-0">
                  {gate.score}%
                </Tag>
              </div>
              <Progress
                className="mt-2"
                percent={gate.score}
                size="small"
                showInfo={false}
                status={gate.status === 'fail' ? 'exception' : gate.status === 'review' ? 'active' : 'success'}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <ExperimentOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">仿真线程</p>
        </div>
        <div className="mt-3 grid gap-2">
          {steelSimulationThreads.slice(0, 4).map((thread) => (
            <div key={thread.id} className="arch-card-muted rounded-md px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="arch-text truncate text-xs font-medium">{thread.name}</p>
                <span className="arch-primary-text text-[11px] font-medium">{thread.confidence}%</span>
              </div>
              <p className="arch-muted mt-1 line-clamp-1 text-[11px]">{thread.engine}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CompassOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">孪生技术栈</p>
        </div>
        <div className="mt-3 grid gap-2">
          {steelTwinRuntimeCapabilities.map((capability) => (
            <Tooltip key={capability.id} title={`${capability.role} · ${capability.standard}`}>
              <Tag
                color={
                  capability.status === 'implemented'
                    ? 'success'
                    : capability.status === 'adapter_ready'
                      ? 'processing'
                      : 'default'
                }
                className="m-0 w-full truncate py-1"
              >
                {capability.name}
              </Tag>
            </Tooltip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steelTwinVisualizationReferences.slice(0, 5).map((reference) => (
            <Tooltip key={reference.id} title={reference.runtimeDecision}>
              <Tag color={reference.bundledRuntime ? 'success' : 'default'} className="m-0 text-[11px]">
                {reference.name}
              </Tag>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <ApartmentOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">交付包</p>
        </div>
        <div className="mt-3 grid gap-2">
          {steelExportPackages.map((pkg) => (
            <div key={pkg.id} className="arch-card-muted flex items-center justify-between gap-3 rounded-md px-3 py-2">
              <span className="min-w-0">
                <span className="arch-text block truncate text-xs font-medium">{pkg.name}</span>
                <span className="arch-muted mt-1 block truncate text-[11px]">{pkg.format}</span>
              </span>
              {pkg.ready ? (
                <CheckCircleOutlined className="arch-primary-text shrink-0" />
              ) : (
                <WarningOutlined className="shrink-0 text-amber-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ThreeTwinFallbackViewport({
  activeLayerIds,
  selectedMemberId,
  geometryOverrides,
  hiddenMemberIds,
  progressPlaying,
  onSelectMember,
  className = '',
}: {
  activeLayerIds: Set<SteelTwinLayerId>;
  selectedMemberId: string;
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>>;
  hiddenMemberIds: ReadonlySet<string>;
  progressPlaying: boolean;
  onSelectMember: (memberId: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.6]}
        shadows="percentage"
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ position: [7, 6, 8], fov: 42 }}
      >
        <TwinScene
          activeLayerIds={activeLayerIds}
          selectedMemberId={selectedMemberId}
          geometryOverrides={geometryOverrides}
          hiddenMemberIds={hiddenMemberIds}
          progressPlaying={progressPlaying}
          onSelectMember={onSelectMember}
        />
      </Canvas>
    </div>
  );
}

function TwinScene({
  activeLayerIds,
  selectedMemberId,
  geometryOverrides,
  hiddenMemberIds,
  progressPlaying,
  onSelectMember,
}: {
  activeLayerIds: Set<SteelTwinLayerId>;
  selectedMemberId: string;
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>>;
  hiddenMemberIds: ReadonlySet<string>;
  progressPlaying: boolean;
  onSelectMember: (memberId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const fixtureElements = useMemo(() => buildFactoryFixtureElements(), []);
  const visibleMembers = useMemo(
    () => steelMembers.filter((member) => !hiddenMemberIds.has(member.id)),
    [hiddenMemberIds],
  );
  const visibleSensors = useMemo(
    () => steelSensors.filter((sensor) => !hiddenMemberIds.has(sensor.memberId)),
    [hiddenMemberIds],
  );
  const processRoute = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.6, 0.2, -3.2),
        new THREE.Vector3(-1.8, 0.35, -2.5),
        new THREE.Vector3(0.8, 0.5, -0.8),
        new THREE.Vector3(3.8, 0.35, -2.6),
        new THREE.Vector3(5.2, 0.25, -3.4),
      ]).getPoints(42),
    [],
  );

  useFrame(({ clock }) => {
    if (groupRef.current) {
      if (progressPlaying) {
        groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.2) * 0.025;
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#071421']} />
      <fog attach="fog" args={['#071421', 18, 38]} />
      <PerspectiveCamera makeDefault position={[8.2, 5.8, 10.4]} fov={39} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#d8fbff', '#0b1621', 1.02]} />
      <directionalLight
        position={[6, 10, 5]}
        intensity={1.82}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-7, 5, -5]} intensity={0.82} color="#68e8ff" />
      <pointLight position={[-4.5, 3, -3]} intensity={1.1} color="#13f3ff" />
      <pointLight position={[4.4, 2.2, -2.4]} intensity={0.7} color="#ffb84d" />
      <gridHelper args={[16, 32, '#19d5ff', '#1e4b5f']} position={[0, -0.012, 0]} />
      <SiteBase />
      <FactoryShell />
      <ProductionTwinLine progressPlaying={progressPlaying} />
      <WarehouseRackLayer />
      <FactoryFixtureModel elements={fixtureElements} />
      <ContactShadows
        position={[0, -0.012, 0]}
        opacity={0.42}
        scale={15.5}
        blur={2.6}
        far={9}
      />

      <group ref={groupRef}>
        {activeLayerIds.has('semantic_ifc') ? (
          <>
            {visibleMembers.map((member) => (
              <SteelMemberMesh
                key={member.id}
                member={member}
                geometryOverrides={geometryOverrides}
                selected={member.id === selectedMemberId}
                onSelect={onSelectMember}
              />
            ))}
          </>
        ) : null}

        {activeLayerIds.has('risk')
          ? visibleMembers
              .filter((member) => member.risk !== 'low')
              .map((member) => (
                <RiskEnvelope
                  key={`${member.id}-risk`}
                  member={member}
                  geometryOverrides={geometryOverrides}
                />
              ))
          : null}

        {activeLayerIds.has('simulation') ? <SimulationOverlay progressPlaying={progressPlaying} /> : null}

        {activeLayerIds.has('iot_scada')
          ? visibleSensors.map((sensor) => (
              <SensorBeacon
                key={sensor.id}
                sensor={sensor}
                geometryOverrides={geometryOverrides}
              />
            ))
          : null}

        <SceneTwinLabels
          selectedMember={visibleMembers.find((member) => member.id === selectedMemberId) ?? visibleMembers[0]}
          geometryOverrides={geometryOverrides}
          sensors={visibleSensors.filter((sensor) => sensor.status !== 'normal').slice(0, 3)}
        />

        {activeLayerIds.has('reality_splat') ? (
          <>
            <RealitySplatLayer />
            <PointCloudResidualLayer />
          </>
        ) : null}

        {activeLayerIds.has('process') ? <ProcessRouteLayer points={processRoute} /> : null}
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4.8}
        maxDistance={16}
        target={[0.1, 2.05, 0.2]}
      />
    </>
  );
}

function SiteBase() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]} receiveShadow>
        <planeGeometry args={[16, 11]} />
        <meshStandardMaterial color="#253645" roughness={0.78} metalness={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, 0]} receiveShadow>
        <planeGeometry args={[12.6, 7.6]} />
        <meshStandardMaterial color="#314758" roughness={0.72} metalness={0.2} transparent opacity={0.92} />
      </mesh>
      {[-4, -2, 0, 2, 4].map((x) => (
        <mesh key={`aisle-${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.018, 0]}>
          <planeGeometry args={[0.035, 7.6]} />
          <meshBasicMaterial color="#6ee7ff" transparent opacity={0.18} />
        </mesh>
      ))}
      {[-3, -1, 1, 3].map((z) => (
        <mesh key={`cross-aisle-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.017, z]}>
          <planeGeometry args={[12.6, 0.035]} />
          <meshBasicMaterial color="#6ee7ff" transparent opacity={0.16} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.9, -0.02, -2.95]}>
        <ringGeometry args={[0.82, 1.08, 72]} />
        <meshBasicMaterial color="#faad14" transparent opacity={0.34} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function FactoryShell() {
  const roofLines = useMemo(() => Array.from({ length: 9 }, (_, index) => -4 + index), []);
  const wallRibs = useMemo(() => Array.from({ length: 10 }, (_, index) => -7.2 + index * 1.6), []);

  return (
    <group>
      <mesh position={[0, 3.05, -5.2]} receiveShadow>
        <boxGeometry args={[16, 6.1, 0.08]} />
        <meshStandardMaterial color="#d9e7ec" roughness={0.76} metalness={0.04} transparent opacity={0.78} />
      </mesh>
      <mesh position={[-8, 2.8, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10.4, 5.6, 0.08]} />
        <meshStandardMaterial color="#cbd9df" roughness={0.8} metalness={0.04} transparent opacity={0.46} />
      </mesh>
      <mesh position={[0, 5.95, 0]} rotation={[0.03, 0, 0]} receiveShadow>
        <boxGeometry args={[16.5, 0.08, 10.8]} />
        <meshStandardMaterial color="#233749" roughness={0.64} metalness={0.34} transparent opacity={0.68} />
      </mesh>
      {wallRibs.map((x) => (
        <mesh key={`wall-rib-${x}`} position={[x, 3.05, -5.14]}>
          <boxGeometry args={[0.045, 5.7, 0.12]} />
          <meshStandardMaterial color="#7f9aa8" roughness={0.45} metalness={0.42} />
        </mesh>
      ))}
      {roofLines.map((z) => (
        <mesh key={`roof-line-${z}`} position={[0, 5.9, z]}>
          <boxGeometry args={[16.2, 0.07, 0.055]} />
          <meshStandardMaterial color="#4d6a78" roughness={0.42} metalness={0.48} emissive="#092535" emissiveIntensity={0.14} />
        </mesh>
      ))}
      {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => (
        <mesh key={`window-${x}`} position={[x, 3.5, -5.095]}>
          <boxGeometry args={[0.84, 1.8, 0.03]} />
          <meshBasicMaterial color="#7de9ff" transparent opacity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function ProductionTwinLine({ progressPlaying }: { progressPlaying: boolean }) {
  const shuttleRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!shuttleRef.current) return;
    const phase = progressPlaying ? clock.getElapsedTime() : 0.8;
    shuttleRef.current.position.x = -3.1 + ((Math.sin(phase * 0.72) + 1) / 2) * 6.2;
  });

  return (
    <group>
      <mesh position={[0, 0.18, -2.55]} receiveShadow castShadow>
        <boxGeometry args={[8.6, 0.16, 0.54]} />
        <meshStandardMaterial color="#176d9a" roughness={0.36} metalness={0.44} emissive="#06364f" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0.34, -2.55]} receiveShadow>
        <boxGeometry args={[8.35, 0.05, 0.48]} />
        <meshStandardMaterial color="#0d2538" roughness={0.52} metalness={0.18} />
      </mesh>
      <group ref={shuttleRef} position={[-1.8, 0.62, -2.55]}>
        <mesh castShadow>
          <boxGeometry args={[0.72, 0.42, 0.5]} />
          <meshStandardMaterial color="#f7f8fb" roughness={0.42} metalness={0.08} emissive="#225b6e" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <boxGeometry args={[0.78, 0.05, 0.56]} />
          <meshBasicMaterial color="#34d5ff" transparent opacity={0.42} />
        </mesh>
      </group>

      {[-4.6, 4.6].map((x) => (
        <group key={`guard-${x}`} position={[x, 0.5, -2.55]}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.85, 1.36]} />
            <meshStandardMaterial color="#f4b400" roughness={0.36} metalness={0.26} emissive="#4a2e00" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}
      {[-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6].map((x) => (
        <mesh key={`rail-${x}`} position={[x, 0.76, -3.34]} castShadow>
          <boxGeometry args={[0.08, 0.88, 0.08]} />
          <meshStandardMaterial color="#f4b400" roughness={0.4} metalness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, -3.34]} castShadow>
        <boxGeometry args={[7.5, 0.07, 0.08]} />
        <meshStandardMaterial color="#f4b400" roughness={0.42} metalness={0.22} />
      </mesh>

      <FactoryMachine position={[-3.4, 0.54, -0.85]} accent="#2f9bff" />
      <FactoryMachine position={[3.25, 0.54, -0.95]} accent="#12c2a0" />
      <RobotArm position={[-2.6, 0.26, -1.7]} color="#f7f8fb" />
      <RobotArm position={[2.4, 0.26, -1.74]} color="#ffb84d" />
    </group>
  );
}

function FactoryMachine({
  position,
  accent,
}: {
  position: [number, number, number];
  accent: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.86, 0.92]} />
        <meshStandardMaterial color="#cfd8df" roughness={0.5} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.49, 0]}>
        <boxGeometry args={[1.28, 0.06, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.46} />
      </mesh>
      <mesh position={[0.62, 0.02, -0.48]}>
        <boxGeometry args={[0.12, 0.28, 0.12]} />
        <meshBasicMaterial color="#0b1724" />
      </mesh>
    </group>
  );
}

function RobotArm({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.4, 24]} />
        <meshStandardMaterial color="#263847" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh castShadow position={[0.18, 0.68, 0]} rotation={[0, 0, -0.46]}>
        <boxGeometry args={[0.18, 0.94, 0.18]} />
        <meshStandardMaterial color={color} roughness={0.34} metalness={0.42} />
      </mesh>
      <mesh castShadow position={[0.62, 1.08, 0]} rotation={[0, 0, 0.86]}>
        <boxGeometry args={[0.16, 0.92, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.34} metalness={0.42} />
      </mesh>
      <mesh position={[0.96, 0.86, 0]}>
        <sphereGeometry args={[0.12, 18, 18]} />
        <meshStandardMaterial color="#1fd6ff" emissive="#0d89a8" emissiveIntensity={0.32} roughness={0.2} />
      </mesh>
    </group>
  );
}

function WarehouseRackLayer() {
  const bays = useMemo(() => Array.from({ length: 6 }, (_, index) => -3 + index * 1.2), []);

  return (
    <group position={[-5.7, 0, 3.75]} rotation={[0, 0.08, 0]}>
      {bays.map((x) => (
        <group key={`rack-${x}`} position={[x, 0, 0]}>
          {[0.8, 1.6, 2.4].map((y) => (
            <mesh key={`rack-beam-${x}-${y}`} position={[0, y, 0]}>
              <boxGeometry args={[0.82, 0.04, 0.82]} />
              <meshStandardMaterial color="#d8e5ea" roughness={0.42} metalness={0.42} transparent opacity={0.42} />
            </mesh>
          ))}
          {[-0.48, 0.48].map((sx) =>
            [-0.54, 0.54].map((sz) => (
              <mesh key={`rack-post-${x}-${sx}-${sz}`} position={[sx, 1.24, sz]}>
                <boxGeometry args={[0.035, 2.1, 0.035]} />
                <meshStandardMaterial color="#8ba7b2" roughness={0.38} metalness={0.5} transparent opacity={0.5} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

function FactoryFixtureModel({ elements }: { elements: SteelFrameElement[] }) {
  return (
    <group>
      {elements.map((element) => (
        <FactoryFixtureElementMesh key={element.id} element={element} />
      ))}
    </group>
  );
}

function FactoryFixtureElementMesh({ element }: { element: SteelFrameElement }) {
  const rotation = element.rotation ?? [0, 0, 0];
  const isDeck = element.kind === 'deck';
  return (
    <group position={element.position} rotation={rotation}>
      <mesh castShadow={!isDeck} receiveShadow>
        <boxGeometry args={element.size} />
        <meshStandardMaterial
          color={element.color}
          roughness={isDeck ? 0.74 : 0.34}
          metalness={isDeck ? 0.06 : 0.64}
          transparent={typeof element.opacity === 'number'}
          opacity={element.opacity ?? 1}
        />
      </mesh>
      {element.kind === 'crane' || element.kind === 'outrigger' ? (
        <mesh scale={[1.012, 1.012, 1.012]}>
          <boxGeometry args={element.size} />
          <meshBasicMaterial color="#6ee7ff" wireframe transparent opacity={0.1} />
        </mesh>
      ) : null}
    </group>
  );
}

function SimulationOverlay({ progressPlaying }: { progressPlaying: boolean }) {
  const pulseRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const phase = progressPlaying ? clock.getElapsedTime() : 0.7;
    pulseRef.current.children.forEach((child, index) => {
      child.scale.setScalar(1 + Math.sin(phase * 2.2 + index * 0.6) * 0.05);
    });
  });

  return (
    <group ref={pulseRef}>
      <mesh position={[-1.1, 2.74, 2.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 48]} />
        <meshBasicMaterial color="#4f73ff" transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[2.25, 4.38, 3.36]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.18, 48]} />
        <meshBasicMaterial color="#ff4d4f" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[5.15, 0.08, -3.38]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.36, 64]} />
        <meshBasicMaterial color="#fa8c16" transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SteelMemberMesh({
  member,
  geometryOverrides,
  selected,
  onSelect,
}: {
  member: SteelMember;
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>>;
  selected: boolean;
  onSelect: (memberId: string) => void;
}) {
  const geometry = getSteelMemberTwinGeometry(member, geometryOverrides);
  const rotation = geometry.rotation ?? [0, 0, 0];
  const bodyOpacity = selected ? 0.96 : memberBodyOpacity(member);

  return (
    <group position={geometry.position} rotation={rotation}>
      <mesh
        castShadow={selected}
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(member.id);
        }}
      >
        <boxGeometry args={geometry.size} />
        <meshStandardMaterial
          color={memberColor(member)}
          roughness={0.32}
          metalness={0.62}
          transparent
          opacity={bodyOpacity}
          depthWrite={selected}
          emissive={selected ? '#053b21' : '#000000'}
          emissiveIntensity={selected ? 0.2 : 0}
        />
      </mesh>
      {selected ? (
        <>
          <mesh scale={[1.035, 1.035, 1.035]}>
            <boxGeometry args={geometry.size} />
            <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.72} />
          </mesh>
          <mesh position={[0, geometry.size[1] / 2 + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.24, 48]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.68} side={THREE.DoubleSide} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function RiskEnvelope({
  member,
  geometryOverrides,
}: {
  member: SteelMember;
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>>;
}) {
  const geometry = getSteelMemberTwinGeometry(member, geometryOverrides);
  const color = member.risk === 'high' ? '#ff4d4f' : '#faad14';
  const top: [number, number, number] = [
    geometry.position[0],
    geometry.position[1] + geometry.size[1] / 2 + 0.12,
    geometry.position[2],
  ];

  return (
    <group position={top}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.25, 48]} />
        <meshBasicMaterial color={color} transparent opacity={member.risk === 'high' ? 0.62 : 0.46} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[member.risk === 'high' ? 0.12 : 0.095, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.32} roughness={0.24} />
      </mesh>
    </group>
  );
}

function SensorBeacon({
  sensor,
  geometryOverrides,
}: {
  sensor: SteelSensorPoint;
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>>;
}) {
  const color =
    sensor.status === 'critical'
      ? '#ff4d4f'
      : sensor.status === 'warning'
        ? '#faad14'
        : '#07c160';

  return (
    <group position={getSteelSensorTwinPosition(sensor, geometryOverrides)}>
      <mesh>
        <sphereGeometry args={[sensor.status === 'critical' ? 0.14 : 0.1, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.38} roughness={0.24} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.32} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SceneTwinLabels({
  selectedMember,
  geometryOverrides,
  sensors,
}: {
  selectedMember: SteelMember | undefined;
  geometryOverrides: Partial<Record<string, SteelMemberTwinGeometry>>;
  sensors: SteelSensorPoint[];
}) {
  return (
    <group>
      {selectedMember ? (
        <FloatingTwinLabel
          position={liftLabelPosition(getSteelMemberTwinGeometry(selectedMember, geometryOverrides).position, 0.78)}
          title={selectedMember.memberMark}
          value={memberStatusLabel(selectedMember.status)}
          tone={selectedMember.risk === 'high' ? 'red' : selectedMember.risk === 'medium' ? 'amber' : 'cyan'}
        />
      ) : null}
      {sensors.map((sensor) => (
        <FloatingTwinLabel
          key={`label-${sensor.id}`}
          position={liftLabelPosition(getSteelSensorTwinPosition(sensor, geometryOverrides), 0.34)}
          title={sensor.name}
          value={sensor.value}
          tone={sensor.status === 'critical' ? 'red' : sensor.status === 'warning' ? 'amber' : 'green'}
        />
      ))}
    </group>
  );
}

function FloatingTwinLabel({
  position,
  title,
  value,
  tone,
}: {
  position: [number, number, number];
  title: string;
  value: string;
  tone: TwinHudTone;
}) {
  return (
    <Html position={position} center distanceFactor={9} occlude>
      <div className={`min-w-[118px] rounded border px-2 py-1 text-[10px] shadow-[0_0_18px_rgba(0,0,0,0.28)] backdrop-blur ${hudToneBadge(tone)}`}>
        <p className="truncate font-semibold text-white">{title}</p>
        <p className="mt-0.5 truncate text-[10px] opacity-85">{value}</p>
      </div>
    </Html>
  );
}

function liftLabelPosition(
  [x, y, z]: [number, number, number],
  offset: number,
): [number, number, number] {
  return [x, y + offset, z];
}

function RealitySplatLayer() {
  const splats = useMemo(
    () =>
      Array.from({ length: 180 }, (_, index) => {
        const angle = index * 0.57;
        const radius = 1.2 + (index % 13) * 0.2;
        return {
          position: [
            Math.cos(angle) * radius + Math.sin(index * 0.17) * 0.4,
            1.05 + Math.sin(index * 0.91) * 0.46 + (index % 5) * 0.12,
            Math.sin(angle) * radius + Math.cos(index * 0.23) * 0.28,
          ] as [number, number, number],
          scale: 0.018 + (index % 5) * 0.009,
          color: index % 4 === 0 ? '#07c160' : index % 4 === 1 ? '#8fe8b3' : index % 4 === 2 ? '#faad14' : '#9aa4b2',
        };
      }),
    [],
  );

  return (
    <group>
      {splats.map((splat, index) => (
        <mesh key={`${splat.color}-${index}`} position={splat.position}>
          <sphereGeometry args={[splat.scale, 10, 10]} />
          <meshStandardMaterial color={splat.color} emissive={splat.color} emissiveIntensity={0.18} transparent opacity={0.48} />
        </mesh>
      ))}
    </group>
  );
}

function PointCloudResidualLayer() {
  const points = useMemo(
    () =>
      Array.from({ length: 72 }, (_, index) => {
        const x = -4.7 + (index % 12) * 0.82;
        const z = -3.1 + Math.floor(index / 12) * 1.12;
        return {
          position: [
            x + Math.sin(index * 1.7) * 0.08,
            0.06 + Math.abs(Math.sin(index * 0.83)) * 0.22,
            z + Math.cos(index * 1.31) * 0.08,
          ] as [number, number, number],
          critical: index % 17 === 0 || index % 23 === 0,
        };
      }),
    [],
  );

  return (
    <group>
      {points.map((point, index) => (
        <mesh key={`residual-${index}`} position={point.position}>
          <boxGeometry args={[0.055, point.critical ? 0.18 : 0.095, 0.055]} />
          <meshStandardMaterial
            color={point.critical ? '#ff4d4f' : '#4f73ff'}
            emissive={point.critical ? '#4b1010' : '#111b49'}
            emissiveIntensity={0.22}
            roughness={0.35}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function ProcessRouteLayer({ points }: { points: THREE.Vector3[] }) {
  return (
    <group>
      <line>
        <bufferGeometry attach="geometry" setFromPoints={points} />
        <lineBasicMaterial attach="material" color="#fa8c16" linewidth={2} />
      </line>
      {points
        .filter((_, index) => index % 8 === 0)
        .map((point, index) => (
          <mesh key={`route-${index}`} position={point}>
            <sphereGeometry args={[index % 3 === 0 ? 0.095 : 0.065, 14, 14]} />
            <meshStandardMaterial color="#fa8c16" emissive="#5b2e00" emissiveIntensity={0.2} roughness={0.3} metalness={0.35} />
          </mesh>
        ))}
    </group>
  );
}

function buildFactoryFixtureElements(): SteelFrameElement[] {
  const elements: SteelFrameElement[] = [];

  [-4.8, 4.8].forEach((x) => {
    elements.push({
      id: `gantry-post-front-${x}`,
      kind: 'column',
      position: [x, 1.85, -3.35],
      size: [0.12, 3.7, 0.12],
      color: '#5f7681',
      opacity: 0.58,
    });
    elements.push({
      id: `gantry-post-back-${x}`,
      kind: 'column',
      position: [x, 1.85, 3.35],
      size: [0.12, 3.7, 0.12],
      color: '#5f7681',
      opacity: 0.42,
    });
  });

  elements.push(
    {
      id: 'gantry-rail-front',
      kind: 'outrigger',
      position: [0, 3.72, -3.35],
      size: [10.1, 0.12, 0.16],
      color: '#6e8792',
      opacity: 0.62,
    },
    {
      id: 'gantry-rail-back',
      kind: 'outrigger',
      position: [0, 3.72, 3.35],
      size: [10.1, 0.12, 0.16],
      color: '#6e8792',
      opacity: 0.48,
    },
    {
      id: 'assembly-table-a',
      kind: 'deck',
      position: [-2.8, 0.24, 1.55],
      size: [2.25, 0.12, 1.1],
      color: '#dce8ec',
      opacity: 0.5,
    },
    {
      id: 'assembly-table-b',
      kind: 'deck',
      position: [0, 0.24, 1.55],
      size: [2.25, 0.12, 1.1],
      color: '#dce8ec',
      opacity: 0.46,
    },
    {
      id: 'assembly-table-c',
      kind: 'deck',
      position: [2.8, 0.24, 1.55],
      size: [2.25, 0.12, 1.1],
      color: '#dce8ec',
      opacity: 0.42,
    },
    {
      id: 'inspection-portal',
      kind: 'outrigger',
      position: [5.35, 1.35, 0.2],
      size: [0.12, 2.7, 1.8],
      color: '#1fd6ff',
      opacity: 0.36,
    },
    {
      id: 'crane-boom',
      kind: 'crane',
      position: [5.55, 2.15, -2.65],
      size: [0.11, 4.25, 0.11],
      rotation: [0.18, 0, -0.52],
      color: '#d98b00',
      opacity: 0.82,
    },
  );

  return elements;
}

type TwinHudTone = 'cyan' | 'green' | 'amber' | 'red';

function TwinHudPanel({
  icon,
  title,
  badge,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-cyan-300/25 bg-[#03111f]/78 p-3 text-slate-100 shadow-[0_0_28px_rgba(12,211,255,0.14)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-cyan-300">{icon}</span>
          <h4 className="truncate text-sm font-semibold text-white">{title}</h4>
        </div>
        <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] text-cyan-100/80">
          {badge}
        </span>
      </div>
      {children}
    </section>
  );
}

function TwinHudStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: TwinHudTone;
}) {
  return (
    <div className="rounded border border-cyan-300/15 bg-cyan-950/25 px-2 py-1.5">
      <p className="truncate text-[10px] text-cyan-100/62">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${hudToneText(tone)}`}>{value}</p>
    </div>
  );
}

function TwinHudMetric({ metric }: { metric: (typeof steelProcessMetrics)[number] }) {
  return (
    <div className="rounded border border-cyan-300/15 bg-[#061927]/80 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-cyan-100/70">{metric.name}</p>
        <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${hudToneDot(metric.tone)}`} />
      </div>
      <p className={`mt-1 text-lg font-semibold ${hudToneText(metric.tone)}`}>
        {metric.value}
        {metric.unit ? <span className="ml-1 text-[10px] font-medium text-cyan-100/55">{metric.unit}</span> : null}
      </p>
    </div>
  );
}

function MicroBarChart({
  values,
  tone,
}: {
  values: number[];
  tone: TwinHudTone;
}) {
  return (
    <div className="mt-3 flex h-16 items-end gap-1.5 rounded border border-cyan-300/15 bg-[#061927]/70 px-2 py-2">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`min-h-2 flex-1 rounded-t-sm ${hudToneBar(tone)}`}
          style={{ height: `${Math.max(14, Math.min(100, value))}%` }}
        />
      ))}
    </div>
  );
}

function TrendBars({ values }: { values: number[] }) {
  return (
    <div className="flex h-20 items-end gap-1.5 rounded border border-cyan-300/15 bg-[#061927]/70 px-2 py-2">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="min-h-2 flex-1 rounded-t-sm bg-[linear-gradient(180deg,#40e8ff,#1677ff)] shadow-[0_0_10px_rgba(34,211,238,0.32)]"
          style={{ height: `${Math.max(12, Math.min(100, value))}%` }}
        />
      ))}
    </div>
  );
}

function TwinHudSensorRow({ sensor }: { sensor: SteelSensorPoint }) {
  const tone: TwinHudTone =
    sensor.status === 'critical' ? 'red' : sensor.status === 'warning' ? 'amber' : 'green';
  return (
    <div className="rounded border border-cyan-300/15 bg-[#061927]/72 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-white">{sensor.name}</p>
        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${hudToneBadge(tone)}`}>
          {sensor.value}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-cyan-100/55">
        <span className="truncate">{sensor.limit}</span>
        <span>{sensor.trend === 'up' ? 'UP' : sensor.trend === 'down' ? 'DOWN' : 'STABLE'}</span>
      </div>
    </div>
  );
}

function TwinHudInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-cyan-300/15 bg-[#061927]/72 px-2.5 py-2 text-[11px]">
      <span className="shrink-0 text-cyan-100/58">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-100">{value}</span>
    </div>
  );
}

function LayerToggleHud({
  layer,
  checked,
  onChange,
}: {
  layer: (typeof steelTwinLayers)[number];
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded border border-cyan-300/15 bg-[#061927]/72 px-2.5 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white">{layer.name}</p>
          <p className="mt-1 truncate text-[10px] text-cyan-100/52">{layer.standard}</p>
        </div>
        <Switch
          size="small"
          checked={checked}
          onChange={onChange}
          aria-label={`切换 ${layer.name}`}
        />
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-cyan-950/80">
        <span
          className={`block h-full rounded-full ${layer.status === 'blocked' ? 'bg-red-400' : layer.status === 'review' ? 'bg-amber-300' : 'bg-cyan-300'}`}
          style={{ width: `${layer.progress}%` }}
        />
      </div>
    </div>
  );
}

function hudToneText(tone: TwinHudTone | (typeof steelProcessMetrics)[number]['tone']) {
  if (tone === 'red') return 'text-red-300';
  if (tone === 'amber') return 'text-amber-300';
  if (tone === 'green') return 'text-emerald-300';
  return 'text-cyan-300';
}

function hudToneDot(tone: TwinHudTone | (typeof steelProcessMetrics)[number]['tone']) {
  if (tone === 'red') return 'bg-red-300 shadow-[0_0_10px_rgba(248,113,113,0.7)]';
  if (tone === 'amber') return 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]';
  if (tone === 'green') return 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]';
  return 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.7)]';
}

function hudToneBar(tone: TwinHudTone) {
  if (tone === 'red') return 'bg-[linear-gradient(180deg,#ff8080,#ef4444)] shadow-[0_0_10px_rgba(248,113,113,0.34)]';
  if (tone === 'amber') return 'bg-[linear-gradient(180deg,#ffe082,#f59e0b)] shadow-[0_0_10px_rgba(245,158,11,0.34)]';
  if (tone === 'green') return 'bg-[linear-gradient(180deg,#6ee7b7,#10b981)] shadow-[0_0_10px_rgba(16,185,129,0.34)]';
  return 'bg-[linear-gradient(180deg,#67e8f9,#0ea5e9)] shadow-[0_0_10px_rgba(14,165,233,0.34)]';
}

function hudToneBadge(tone: TwinHudTone) {
  if (tone === 'red') return 'border-red-300/35 bg-red-500/18 text-red-200';
  if (tone === 'amber') return 'border-amber-300/35 bg-amber-500/18 text-amber-200';
  if (tone === 'green') return 'border-emerald-300/35 bg-emerald-500/18 text-emerald-200';
  return 'border-cyan-300/35 bg-cyan-500/18 text-cyan-100';
}

function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="arch-card rounded-md px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="arch-primary-text">{icon}</span>
        <span className="arch-muted text-[11px] font-medium">{label}</span>
      </div>
      <p className="arch-text mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted flex items-start justify-between gap-3 rounded-md px-3 py-2 text-[11px]">
      <span className="arch-muted shrink-0 font-medium">{label}</span>
      <span className="arch-text min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}

function MemberEditControls({
  tone = 'light',
  hiddenCount,
  onMove,
  onReset,
  onDelete,
  onRestore,
}: {
  tone?: 'light' | 'hud';
  hiddenCount: number;
  onMove: (axis: 'x' | 'y' | 'z', delta: number) => void;
  onReset: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const panelClass =
    tone === 'hud'
      ? 'mt-3 rounded border border-cyan-300/15 bg-[#061927]/72 p-2'
      : 'arch-card-muted mt-3 rounded-md p-2';
  const titleClass = tone === 'hud' ? 'text-[11px] font-medium text-cyan-200' : 'arch-primary-text text-[11px] font-medium';
  const noteClass = tone === 'hud' ? 'mt-2 text-[10px] leading-4 text-cyan-100/55' : 'arch-muted mt-2 text-[10px] leading-4';
  const hudButtonClass =
    tone === 'hud'
      ? 'border-cyan-300/25 bg-cyan-950/30 text-cyan-50 hover:!border-cyan-200 hover:!text-white'
      : '';

  return (
    <div className={panelClass}>
      <p className={titleClass}>构件编辑</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Button size="small" icon={<ArrowLeftOutlined />} className={hudButtonClass} onClick={() => onMove('x', -0.3)}>X-</Button>
        <Button size="small" icon={<VerticalAlignTopOutlined />} className={hudButtonClass} onClick={() => onMove('y', 0.3)}>Y+</Button>
        <Button size="small" icon={<ArrowDownOutlined />} className={hudButtonClass} onClick={() => onMove('z', -0.3)}>Z-</Button>
        <Button size="small" icon={<ArrowRightOutlined />} className={hudButtonClass} onClick={() => onMove('x', 0.3)}>X+</Button>
        <Button size="small" icon={<VerticalAlignBottomOutlined />} className={hudButtonClass} onClick={() => onMove('y', -0.3)}>Y-</Button>
        <Button size="small" icon={<ArrowUpOutlined />} className={hudButtonClass} onClick={() => onMove('z', 0.3)}>Z+</Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button size="small" icon={<ReloadOutlined />} className={hudButtonClass} onClick={onReset}>重置</Button>
        <Button size="small" icon={<DeleteOutlined />} danger onClick={onDelete}>删除</Button>
      </div>
      {hiddenCount > 0 ? (
        <Button size="small" icon={<ToolOutlined />} className={`mt-2 w-full ${hudButtonClass}`} onClick={onRestore}>
          恢复隐藏构件 {hiddenCount}
        </Button>
      ) : null}
      <p className={noteClass}>
        当前为会话内位姿覆盖和软删除,写回 IFC/BCF 前仍需审批。
      </p>
    </div>
  );
}

function SensorRow({ sensor }: { sensor: SteelSensorPoint }) {
  return (
    <div className="arch-card-muted rounded-md px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="arch-text truncate text-xs font-medium">{sensor.name}</p>
        <Tag color={sensor.status === 'critical' ? 'error' : sensor.status === 'warning' ? 'warning' : 'success'} className="m-0">
          {sensor.value}
        </Tag>
      </div>
      <p className="arch-muted mt-1 text-[11px]">{sensor.limit}</p>
    </div>
  );
}

function formatPosition([x, y, z]: [number, number, number]) {
  return `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} m`;
}

function RiskDot({ risk }: { risk: SteelMember['risk'] }) {
  const className =
    risk === 'high'
      ? 'bg-red-500'
      : risk === 'medium'
        ? 'bg-amber-500'
        : 'bg-[var(--arch-primary)]';

  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />;
}

function memberStatusLabel(status: SteelMemberStatus) {
  if (status === 'fabricated') return '工厂完成';
  if (status === 'in_transit') return '物流在途';
  if (status === 'erecting') return '施工安装';
  if (status === 'installed') return '安装完成';
  return '暂停/阻断';
}

function memberColor(member: SteelMember) {
  if (member.status === 'hold') return '#9c4d4d';
  if (member.status === 'erecting') return '#d89700';
  if (member.risk === 'medium') return '#a9802c';
  if (member.status === 'installed') return '#07c160';
  if (member.status === 'in_transit') return '#5f78a8';
  return '#6f8790';
}

function memberBodyOpacity(member: SteelMember) {
  if (member.risk === 'high') return 0.18;
  if (member.risk === 'medium') return 0.16;
  return 0.14;
}

function metricToneClass(tone: (typeof steelProcessMetrics)[number]['tone']) {
  if (tone === 'red') return 'text-red-600';
  if (tone === 'amber') return 'text-amber-600';
  return 'arch-primary-text';
}
