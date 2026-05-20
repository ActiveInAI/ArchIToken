// components/DigitalTwinOperationsPanel.tsx - Unified digital twin operations sidecar
// License: Apache-2.0
'use client';

import {
  AimOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CodeSandboxOutlined,
  CompassOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  EyeOutlined,
  HeatMapOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Button, Progress, Segmented, Switch, Tag, Tooltip } from 'antd';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
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
  steelTwinViewportModes,
  steelTwinVisualizationReferences,
  type SteelMember,
  type SteelMemberStatus,
  type SteelSensorPoint,
  type SteelTwinLayerId,
  type SteelTwinViewportModeId,
} from '@/lib/digital-twin';

interface DigitalTwinOperationsPanelProps {
  onAudit?: (event: ModuleAuditEvent) => void;
  variant?: 'sidecar' | 'main';
}

const defaultModeId: SteelTwinViewportModeId = steelTwinViewportModes[0]?.id ?? 'cde_model';
const defaultMemberId = steelMembers[0]?.id ?? '';
const defaultLayerIds: SteelTwinLayerId[] = ['semantic_ifc', 'iot_scada', 'risk'];

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

  const activeMode =
    steelTwinViewportModes.find((mode) => mode.id === activeModeId) ??
    steelTwinViewportModes[0];
  const selectedMember =
    steelMembers.find((member) => member.id === selectedMemberId) ??
    steelMembers[0];
  const activeLayerCount = activeLayerIds.size;
  const readinessScore = getSteelTwinReadinessScore();
  const blockingIssues = getSteelTwinBlockingIssues();
  const bundledReferences = steelTwinVisualizationReferences.filter((reference) => reference.bundledRuntime);

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
    setSelectedMemberId(memberId);
    emit(`数字孪生: 选择构件 ${member?.memberMark ?? memberId}`);
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
      <section className="grid min-h-[calc(100dvh-190px)] gap-3 p-3">
        <div className="arch-card-muted rounded-lg p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="arch-primary-text font-mono text-[10px] font-medium">
                DIGITAL TWIN OPS
              </p>
              <h3 className="arch-text mt-1 text-lg font-medium">
                重钢结构数字孪生运行面板
              </h3>
              <p className="arch-muted mt-1 text-xs leading-5">
                Three.js fallback + IFC/GLB derivative，主视口、图层、构件和传感数据统一在模块主窗口显示。
              </p>
            </div>
            <div className="grid min-w-[360px] flex-1 grid-cols-2 gap-2 md:grid-cols-4">
              <MetricTile label="成熟度" value={`${readinessScore}%`} icon={<SafetyCertificateOutlined />} />
              <MetricTile label="活动图层" value={`${activeLayerCount}`} icon={<ClusterOutlined />} />
              <MetricTile label="阻断项" value={`${blockingIssues.length}`} icon={<WarningOutlined />} />
              <MetricTile label="运行时" value={`${bundledReferences.length}`} icon={<ThunderboltOutlined />} />
            </div>
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

        <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="arch-card overflow-hidden rounded-lg">
            <div className="arch-surface-muted flex items-center justify-between gap-3 border-b px-3 py-2">
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
            <div className="h-[min(66vh,760px)] min-h-[520px] bg-[linear-gradient(180deg,rgba(7,193,96,0.08),rgba(255,255,255,0.95))]">
              <Canvas
                dpr={[1, 1.6]}
                shadows="percentage"
                gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
                camera={{ position: [7, 6, 8], fov: 42 }}
              >
                <TwinScene
                  activeLayerIds={activeLayerIds}
                  selectedMemberId={selectedMember.id}
                  progressPlaying={progressPlaying}
                  onSelectMember={selectMember}
                />
              </Canvas>
            </div>
          </div>

          <aside className="grid content-start gap-3">
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
              </div>
            </div>

            <div className="arch-card rounded-lg p-3">
              <div className="flex items-center gap-2">
                <HeatMapOutlined className="arch-primary-text" />
                <p className="arch-primary-text text-xs font-medium">图层栈</p>
              </div>
              <div className="mt-3 grid gap-2">
                {steelTwinLayers.slice(0, 5).map((layer) => (
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
                {steelSensors.slice(0, 4).map((sensor) => (
                  <SensorRow key={sensor.id} sensor={sensor} />
                ))}
              </div>
            </div>
          </aside>
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
            Three.js fallback
          </Tag>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricTile label="成熟度" value={`${readinessScore}%`} icon={<SafetyCertificateOutlined />} />
          <MetricTile label="活动图层" value={`${activeLayerCount}`} icon={<ClusterOutlined />} />
          <MetricTile label="阻断项" value={`${blockingIssues.length}`} icon={<WarningOutlined />} />
          <MetricTile label="运行时" value={`${bundledReferences.length}`} icon={<ThunderboltOutlined />} />
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
        <div className="h-60 bg-[linear-gradient(180deg,rgba(7,193,96,0.08),rgba(255,255,255,0.95))]">
          <Canvas
            dpr={[1, 1.6]}
            shadows="percentage"
            gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
            camera={{ position: [7, 6, 8], fov: 42 }}
          >
            <TwinScene
              activeLayerIds={activeLayerIds}
              selectedMemberId={selectedMember.id}
              progressPlaying={progressPlaying}
              onSelectMember={selectMember}
            />
          </Canvas>
        </div>
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
        </div>
      </div>

      <div className="arch-card rounded-lg p-3">
        <div className="flex items-center gap-2">
          <DeploymentUnitOutlined className="arch-primary-text" />
          <p className="arch-primary-text text-xs font-medium">构件树 / 选择</p>
        </div>
        <div className="mt-3 grid gap-2">
          {steelMembers.slice(0, 7).map((member) => (
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
          <p className="arch-primary-text text-xs font-medium">参考栈 / 运行时</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steelTwinVisualizationReferences.map((reference) => (
            <Tooltip key={reference.id} title={reference.runtimeDecision}>
              <Tag color={reference.bundledRuntime ? 'success' : 'default'} className="m-0">
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

function TwinScene({
  activeLayerIds,
  selectedMemberId,
  progressPlaying,
  onSelectMember,
}: {
  activeLayerIds: Set<SteelTwinLayerId>;
  selectedMemberId: string;
  progressPlaying: boolean;
  onSelectMember: (memberId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
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
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.14) * 0.05;
      if (progressPlaying) {
        groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.2) * 0.04;
      }
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[7, 6, 8]} fov={42} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[5, 8, 5]} intensity={1.55} castShadow />
      <pointLight position={[-5, 3, -4]} intensity={0.8} color="#07c160" />
      <gridHelper args={[12, 24, '#07c160', '#d8efe2']} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#f8fbf9" roughness={0.86} metalness={0.02} transparent opacity={0.88} />
      </mesh>

      <group ref={groupRef}>
        {activeLayerIds.has('semantic_ifc')
          ? steelMembers.map((member) => (
              <SteelMemberMesh
                key={member.id}
                member={member}
                selected={member.id === selectedMemberId}
                onSelect={onSelectMember}
              />
            ))
          : null}

        {activeLayerIds.has('risk')
          ? steelMembers
              .filter((member) => member.risk !== 'low')
              .map((member) => <RiskEnvelope key={`${member.id}-risk`} member={member} />)
          : null}

        {activeLayerIds.has('iot_scada')
          ? steelSensors.map((sensor) => <SensorBeacon key={sensor.id} sensor={sensor} />)
          : null}

        {activeLayerIds.has('reality_splat') ? <RealitySplatLayer /> : null}

        {activeLayerIds.has('process') ? (
          <line>
            <bufferGeometry attach="geometry" setFromPoints={processRoute} />
            <lineBasicMaterial attach="material" color="#fa8c16" linewidth={2} />
          </line>
        ) : null}
      </group>

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={5} maxDistance={16} />
    </>
  );
}

function SteelMemberMesh({
  member,
  selected,
  onSelect,
}: {
  member: SteelMember;
  selected: boolean;
  onSelect: (memberId: string) => void;
}) {
  const rotation = member.rotation ?? [0, 0, 0];

  return (
    <group position={member.position} rotation={rotation}>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(member.id);
        }}
      >
        <boxGeometry args={member.size} />
        <meshStandardMaterial
          color={memberColor(member)}
          roughness={0.42}
          metalness={0.28}
          emissive={selected ? '#053b21' : '#000000'}
          emissiveIntensity={selected ? 0.16 : 0}
        />
      </mesh>
      {selected ? (
        <mesh scale={[1.16, 1.16, 1.16]}>
          <boxGeometry args={member.size} />
          <meshBasicMaterial color="#07c160" wireframe transparent opacity={0.78} />
        </mesh>
      ) : null}
    </group>
  );
}

function RiskEnvelope({ member }: { member: SteelMember }) {
  const rotation = member.rotation ?? [0, 0, 0];
  const color = member.risk === 'high' ? '#ff4d4f' : '#faad14';

  return (
    <mesh position={member.position} rotation={rotation}>
      <boxGeometry args={[member.size[0] + 0.34, member.size[1] + 0.34, member.size[2] + 0.34]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.65} />
    </mesh>
  );
}

function SensorBeacon({ sensor }: { sensor: SteelSensorPoint }) {
  const color =
    sensor.status === 'critical'
      ? '#ff4d4f'
      : sensor.status === 'warning'
        ? '#faad14'
        : '#07c160';

  return (
    <mesh position={sensor.position}>
      <sphereGeometry args={[sensor.status === 'critical' ? 0.14 : 0.1, 18, 18]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.24} />
    </mesh>
  );
}

function RealitySplatLayer() {
  const splats = useMemo(
    () =>
      Array.from({ length: 64 }, (_, index) => {
        const angle = index * 0.57;
        const radius = 1.2 + (index % 9) * 0.18;
        return {
          position: [
            Math.cos(angle) * radius,
            1.2 + Math.sin(index * 0.91) * 0.36,
            Math.sin(angle) * radius,
          ] as [number, number, number],
          scale: 0.026 + (index % 5) * 0.012,
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
          <meshStandardMaterial color={splat.color} emissive={splat.color} emissiveIntensity={0.18} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
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
  if (member.risk === 'high') return '#ff7875';
  if (member.risk === 'medium') return '#faad14';
  if (member.status === 'installed') return '#07c160';
  if (member.status === 'in_transit') return '#0fa36b';
  return '#63d69b';
}

function metricToneClass(tone: (typeof steelProcessMetrics)[number]['tone']) {
  if (tone === 'red') return 'text-red-600';
  if (tone === 'amber') return 'text-amber-600';
  return 'arch-primary-text';
}
