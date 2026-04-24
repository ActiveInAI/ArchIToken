// components/DigitalTwinWorkbench.tsx - ArchIToken digital twin workbench
// License: Apache-2.0
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  FileCheck2,
  GitBranch,
  Layers3,
  Radar,
  Satellite,
  Settings2,
} from 'lucide-react';
import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  getTwinBlockingIssues,
  getTwinReadinessScore,
  twinExportPackages,
  twinIntegrityGates,
  twinLayers,
  twinSceneNodes,
  twinSensors,
  type TwinLayerId,
  type TwinSceneNode,
  type TwinSensorPoint,
} from '@/lib/digital-twin';

const layerLabels: Record<TwinLayerId, string> = {
  bim: 'BIM 语义',
  splat: '3DGS 现实层',
  iot: 'IoT/SCADA',
  safety: '安全质量',
  schedule: '4D 进度',
};

const activeLayerDefaults = new Set<TwinLayerId>(['bim', 'splat', 'iot']);

export function DigitalTwinWorkbench() {
  const [selectedId, setSelectedId] = useState('building-a');
  const [activeLayers, setActiveLayers] = useState<Set<TwinLayerId>>(activeLayerDefaults);

  const selectedNode =
    twinSceneNodes.find((node) => node.id === selectedId) ?? twinSceneNodes[0];

  const readiness = getTwinReadinessScore();
  const blockers = getTwinBlockingIssues();

  const toggleLayer = (layerId: TwinLayerId) => {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-[#eef2eb] text-[#111817]">
      <section className="border-b border-[#111817]/10 bg-[#111817] text-white">
        <div className="container mx-auto grid gap-8 px-6 py-10 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[#74d99f]">
              <Satellite className="h-3.5 w-3.5" />
              digital_twin module · WebGPU-first
            </div>
            <h1 className="font-serif text-4xl font-black md:text-6xl">
              数字孪生工作台
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/72 md:text-lg">
              按 Pascal Editor 的可编辑场景树组织 Site、Building、Level、Zone 和 Element,
              以 Gaussian Splatting 承载点云、360 全景、倾斜摄影和视频重建,
              再用 IFC/IDS/BCF 保证几何、属性、证据和导出清单完整。
            </p>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HeroMetric label="孪生就绪度" value={`${readiness}%`} tone="green" />
            <HeroMetric label="活动图层" value={`${activeLayers.size}/5`} tone="blue" />
            <HeroMetric label="阻断项" value={String(blockers.length)} tone="orange" />
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-5 px-6 py-6 xl:grid-cols-[280px_1fr_340px]">
        <aside className="space-y-5 self-start">
          <Panel title="可编辑场景树" icon={<GitBranch className="h-4 w-4" />}>
            <div className="space-y-2">
              {twinSceneNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={`w-full border px-3 py-3 text-left transition-colors ${
                    selectedId === node.id
                      ? 'border-[#18a058] bg-[#e6f5eb]'
                      : 'border-[#111817]/10 bg-white hover:border-[#18a058]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-bold">{node.name}</span>
                    <span className="font-mono text-[10px] uppercase text-[#1f6d7a]">
                      {node.kind}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[#52615d]">
                    <Badge>{node.source}</Badge>
                    <Badge>{node.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="图层开关" icon={<Layers3 className="h-4 w-4" />}>
            <div className="space-y-2">
              {twinLayers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => toggleLayer(layer.layerId)}
                  className={`w-full border px-3 py-3 text-left ${
                    activeLayers.has(layer.layerId)
                      ? 'border-[#18a058] bg-[#e6f5eb]'
                      : 'border-[#111817]/10 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{layerLabels[layer.layerId]}</span>
                    <span className="font-mono text-xs text-[#c85b28]">{layer.progress}%</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#52615d]">{layer.name}</p>
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="self-start overflow-hidden border border-[#111817]/12 bg-[#0d1412] shadow-[0_28px_90px_rgba(17,24,23,0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#74d99f]">
                Twin Scene
              </p>
              <h2 className="font-serif text-2xl font-black">IFC + 3DGS + IoT 融合视口</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(activeLayers).map((layerId) => (
                <span
                  key={layerId}
                  className="border border-white/12 bg-white/[0.06] px-3 py-1 text-xs text-white/78"
                >
                  {layerLabels[layerId]}
                </span>
              ))}
            </div>
          </div>
          <TwinViewport
            activeLayers={activeLayers}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-3">
            <ViewportNote icon={<Boxes className="h-4 w-4" />} title="Editable Nodes">
              Site / Building / Level / Zone / Element 节点可继续移动、替换、拆分和合并。
            </ViewportNote>
            <ViewportNote icon={<Radar className="h-4 w-4" />} title="3DGS Reality">
              现场点云和影像先转 SPZ/PLY 高斯泼溅,再与 BIM 语义层对齐。
            </ViewportNote>
            <ViewportNote icon={<Activity className="h-4 w-4" />} title="Live IoT">
              MQTT/SCADA 点位绑定到 IFC 元素,异常直接生成 Evidence Token。
            </ViewportNote>
          </div>
        </section>

        <aside className="space-y-5 self-start">
          <Panel title="当前节点" icon={<Settings2 className="h-4 w-4" />}>
            {selectedNode ? <NodeInspector node={selectedNode} /> : null}
          </Panel>

          <Panel title="完整性门禁" icon={<FileCheck2 className="h-4 w-4" />}>
            <div className="space-y-3">
              {twinIntegrityGates.map((gate) => (
                <div key={gate.id} className="border border-[#111817]/10 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-bold">{gate.name}</span>
                    <span className={statusClass(gate.status)}>{gate.score}%</span>
                  </div>
                  <div className="h-1.5 bg-[#dfe6dc]">
                    <div
                      className="h-full bg-[#18a058]"
                      style={{ width: `${gate.score}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#52615d]">{gate.detail}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="导出清单" icon={<Download className="h-4 w-4" />}>
            <div className="space-y-2">
              {twinExportPackages.map((pkg) => (
                <div key={pkg.id} className="border border-[#111817]/10 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-bold">{pkg.name}</span>
                    {pkg.ready ? (
                      <CheckCircle2 className="h-4 w-4 text-[#18a058]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#c85b28]" />
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs text-[#1f6d7a]">{pkg.format}</p>
                  <p className="mt-2 text-xs leading-5 text-[#52615d]">
                    {pkg.checks.join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function TwinViewport({
  activeLayers,
  selectedId,
  onSelect,
}: {
  activeLayers: Set<TwinLayerId>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-[620px] w-full">
      <Canvas shadows gl={{ antialias: true, alpha: false }}>
        <color attach="background" args={['#0d1412']} />
        <PerspectiveCamera makeDefault position={[7.8, 5.4, 8.2]} fov={46} />
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={3} maxDistance={30} />
        <ambientLight intensity={0.42} />
        <directionalLight position={[6, 8, 5]} intensity={1.5} castShadow />
        <pointLight position={[-5, 3, -2]} intensity={1.1} color="#74d99f" />
        <Suspense fallback={null}>
          <Environment preset="city" background={false} />
          <Grid
            args={[28, 28]}
            cellSize={0.35}
            cellThickness={0.45}
            cellColor="#31514a"
            sectionSize={2.8}
            sectionThickness={1}
            sectionColor="#6a817a"
            fadeDistance={18}
            fadeStrength={1}
            infiniteGrid
          />
          {activeLayers.has('bim') &&
            twinSceneNodes.map((node) => (
              <TwinNodeMesh
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                onSelect={onSelect}
              />
            ))}
          {activeLayers.has('splat') && <GaussianSplatLayer />}
          {activeLayers.has('iot') &&
            twinSensors.map((sensor) => <SensorBeacon key={sensor.id} sensor={sensor} />)}
          {activeLayers.has('schedule') && <SchedulePath />}
        </Suspense>
      </Canvas>
    </div>
  );
}

function TwinNodeMesh({
  node,
  selected,
  onSelect,
}: {
  node: TwinSceneNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const color = selected ? '#74d99f' : node.status === 'issue' ? '#f07836' : '#1f6d7a';
  const opacity = node.kind === 'site' ? 0.34 : node.source === '3DGS' ? 0.42 : 0.76;

  return (
    <mesh
      position={node.position}
      castShadow={node.kind !== 'site'}
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <boxGeometry args={node.size} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? '#18a058' : '#000000'}
        emissiveIntensity={selected ? 0.32 : 0}
        metalness={0.14}
        opacity={opacity}
        roughness={0.68}
        transparent
      />
    </mesh>
  );
}

function GaussianSplatLayer() {
  const group = useRef<THREE.Group>(null);
  const splats = useMemo(
    () =>
      Array.from({ length: 92 }, (_, index) => {
        const angle = index * 0.48;
        const band = (index % 9) - 4;
        return {
          position: [
            -3.9 + Math.sin(angle) * 0.34,
            0.7 + (index % 18) * 0.095,
            band * 0.46 + Math.cos(angle) * 0.22,
          ] as [number, number, number],
          color: index % 4 === 0 ? '#f07836' : index % 4 === 1 ? '#74d99f' : '#2e6f95',
          radius: 0.035 + (index % 5) * 0.008,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.04;
    }
  });

  return (
    <group ref={group}>
      {splats.map((splat, index) => (
        <mesh key={`${splat.position.join('-')}-${index}`} position={splat.position}>
          <sphereGeometry args={[splat.radius, 12, 12]} />
          <meshStandardMaterial
            color={splat.color}
            emissive={splat.color}
            emissiveIntensity={0.22}
            opacity={0.72}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function SensorBeacon({ sensor }: { sensor: TwinSensorPoint }) {
  const ref = useRef<THREE.Mesh>(null);
  const color =
    sensor.status === 'critical'
      ? '#ff4d4f'
      : sensor.status === 'warning'
        ? '#f07836'
        : '#74d99f';

  useFrame(({ clock }) => {
    if (ref.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 2.6) * 0.18;
      ref.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={ref} position={sensor.position}>
      <sphereGeometry args={[0.12, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
    </mesh>
  );
}

function SchedulePath() {
  const points = useMemo(
    () => [
      new THREE.Vector3(-4.8, 0.18, -2.7),
      new THREE.Vector3(-2.2, 0.55, 2.2),
      new THREE.Vector3(0.8, 0.88, -1.6),
      new THREE.Vector3(3.5, 1.2, 2.4),
    ],
    [],
  );

  return (
    <line>
      <bufferGeometry attach="geometry" setFromPoints={points} />
      <lineBasicMaterial attach="material" color="#f07836" />
    </line>
  );
}

function NodeInspector({ node }: { node: TwinSceneNode }) {
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl font-black">{node.name}</h3>
          <p className="mt-1 font-mono text-xs text-[#1f6d7a]">{node.id}</p>
        </div>
        <span className="border border-[#111817]/10 bg-[#eef2eb] px-2 py-1 text-xs">
          {node.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CheckTile ok={node.geometryComplete} label="几何" />
        <CheckTile ok={node.propertyComplete} label="属性" />
      </div>
      <div className="mt-4 space-y-2">
        {Object.entries(node.properties).map(([key, value]) => (
          <div key={key} className="grid grid-cols-[110px_1fr] gap-2 text-xs">
            <span className="text-[#52615d]">{key}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#111817]/12 bg-[#f8faf4] p-4 shadow-[0_18px_45px_rgba(17,24,23,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-black">{title}</h2>
        <span className="flex h-8 w-8 items-center justify-center bg-[#111817] text-white">
          {icon}
        </span>
      </div>
      {children}
    </section>
  );
}

function HeroMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'blue' | 'orange';
}) {
  const toneClass =
    tone === 'green' ? 'text-[#74d99f]' : tone === 'blue' ? 'text-[#9bd2ff]' : 'text-[#f8a15f]';

  return (
    <div className="border border-white/12 bg-white/[0.05] p-4">
      <p className="text-xs text-white/52">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function ViewportNote({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.04] p-3 text-white">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <span className="text-[#74d99f]">{icon}</span>
        {title}
      </div>
      <p className="text-xs leading-5 text-white/62">{children}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="bg-[#eef2eb] px-2 py-0.5">{children}</span>;
}

function CheckTile({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="border border-[#111817]/10 bg-white p-3">
      <div className="mb-1 flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-[#18a058]" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-[#c85b28]" />
        )}
        <span className="font-serif text-lg font-bold">{label}</span>
      </div>
      <p className="text-xs text-[#52615d]">{ok ? 'complete' : 'needs review'}</p>
    </div>
  );
}

function statusClass(status: 'pass' | 'review' | 'fail') {
  if (status === 'pass') {
    return 'font-mono text-sm font-bold text-[#18a058]';
  }
  if (status === 'fail') {
    return 'font-mono text-sm font-bold text-[#d93025]';
  }
  return 'font-mono text-sm font-bold text-[#c85b28]';
}
