// components/DigitalTwinWebGPUViewport.tsx - WebGPU-first heavy steel twin viewport
// License: Apache-2.0
'use client';

import {
  Cable as ApiOutlined,
  Network as DeploymentUnitOutlined,
  TriangleAlert as WarningOutlined,
  Zap as ThunderboltOutlined,
} from 'lucide-react';
import { Tag, Tooltip } from '@/components/pan-ui';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  buildSteelTwinWebGpuScene,
  steelTwinWebGpuAdapterManifest,
  type SteelMemberTwinGeometry,
  type SteelTwinLayerId,
  type SteelTwinWebGpuPickTarget,
} from '@/lib/digital-twin';
import { webgpuUnavailableReason } from '@/lib/webgpu-render-router';

interface DigitalTwinWebGPUViewportProps {
  activeLayerIds: ReadonlySet<SteelTwinLayerId>;
  selectedMemberId: string;
  geometryOverrides?: Partial<Record<string, SteelMemberTwinGeometry>>;
  hiddenMemberIds?: ReadonlySet<string>;
  progressPlaying: boolean;
  onSelectMember: (memberId: string) => void;
  className?: string;
  fallback?: ReactNode;
}

type RuntimeState =
  | { mode: 'initializing'; message: string }
  | {
      mode: 'webgpu';
      message: string;
      adapterLabel: string;
      featureCount: number;
      limitText: string;
      vertexCount: number;
    }
  | { mode: 'fallback'; message: string };

interface AdapterInfoLike {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

const vertexStride = 6 * Float32Array.BYTES_PER_ELEMENT;
const gpuBufferUsageVertex = 0x0020;
const gpuBufferUsageCopyDst = 0x0008;

const steelTwinShader = /* wgsl */ `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vertexMain(
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
) -> VertexOut {
  var out: VertexOut;
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fragmentMain(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
`;

export function DigitalTwinWebGPUViewport({
  activeLayerIds,
  selectedMemberId,
  geometryOverrides = {},
  hiddenMemberIds = new Set<string>(),
  progressPlaying,
  onSelectMember,
  className = '',
  fallback,
}: DigitalTwinWebGPUViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pickTargetsRef = useRef<SteelTwinWebGpuPickTarget[]>([]);
  const activeLayerList = useMemo(
    () => Array.from(activeLayerIds).sort(),
    [activeLayerIds],
  );
  const hasVisualFallback = Boolean(fallback);
  const activeLayerKey = activeLayerList.join('|');
  const hiddenMemberKey = useMemo(
    () => Array.from(hiddenMemberIds).sort().join('|'),
    [hiddenMemberIds],
  );
  const geometryOverrideKey = useMemo(
    () =>
      Object.entries(geometryOverrides)
        .filter((entry): entry is [string, SteelMemberTwinGeometry] => Boolean(entry[1]))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, geometry]) => `${id}:${geometry.position.join(',')}:${geometry.size.join(',')}:${geometry.rotation?.join(',') ?? ''}`)
        .join('|'),
    [geometryOverrides],
  );
  const [runtime, setRuntime] = useState<RuntimeState>({
    mode: 'initializing',
    message: '正在请求 WebGPU Adapter...',
  });

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let device: GPUDevice | null = null;
    let vertexBuffer: GPUBuffer | null = null;
    let vertexBufferByteLength = 0;

    async function start() {
      const canvas = canvasRef.current;
      const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
      if (!canvas) {
        animationFrame = requestAnimationFrame(() => {
          void start();
        });
        return;
      }
      if (!gpu) {
        setRuntime({
          mode: 'fallback',
          message: `${getWebGpuUnavailableReason()} 已记录 failed WebGPU evidence；仅启用 Three.js 受审计恢复视口。`,
        });
        return;
      }
      const currentCanvas = canvas;

      try {
        setRuntime({
          mode: 'initializing',
          message: '正在创建 WebGPU device 和 WGSL 渲染管线...',
        });
        const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) {
          throw new Error('WebGPU adapter 不可用。');
        }

        const adapterInfo = await readAdapterInfo(adapter);
        const adapterLabel = formatAdapterInfo(adapterInfo);
        device = await adapter.requestDevice();
        const currentDevice = device;
        const context = currentCanvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!context) {
          throw new Error('Canvas 无法创建 webgpu context。');
        }

        const format = gpu.getPreferredCanvasFormat();
        context.configure({
          device: currentDevice,
          format,
          alphaMode: 'premultiplied',
        });
        const gpuContext = context;

        const pipeline = currentDevice.createRenderPipeline({
          label: 'ArchIToken steel twin WebGPU pipeline',
          layout: 'auto',
          vertex: {
            module: currentDevice.createShaderModule({
              label: 'ArchIToken steel twin WGSL shader',
              code: steelTwinShader,
            }),
            entryPoint: 'vertexMain',
            buffers: [
              {
                arrayStride: vertexStride,
                attributes: [
                  { shaderLocation: 0, offset: 0, format: 'float32x2' },
                  { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: 'float32x4' },
                ],
              },
            ],
          },
          fragment: {
            module: currentDevice.createShaderModule({
              label: 'ArchIToken steel twin WGSL fragment shader',
              code: steelTwinShader,
            }),
            entryPoint: 'fragmentMain',
            targets: [{ format }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });

        const featureCount = adapter.features.size;
        const limitText = `texture ${adapter.limits.maxTextureDimension2D}px / bind groups ${adapter.limits.maxBindGroups}`;
        let metricsReported = false;

        currentDevice.lost
          .then((info) => {
            if (!cancelled) {
          setRuntime({
            mode: 'fallback',
            message: `WebGPU device lost: ${info.message || info.reason}。必须保留 failed device evidence 后再启用恢复视口。`,
          });
        }
      })
          .catch(() => undefined);

        function renderFrame(now: number) {
          if (cancelled || !device) return;
          resizeCanvas(currentCanvas);
          const scene = buildSteelTwinWebGpuScene({
            activeLayerIds: activeLayerList,
            selectedMemberId,
            geometryOverrides,
            hiddenMemberIds: Array.from(hiddenMemberIds),
            progressPhase: progressPlaying ? now / 1000 : 0,
          });
          pickTargetsRef.current = scene.pickTargets;

          if (scene.vertices.byteLength > vertexBufferByteLength) {
            vertexBuffer?.destroy();
            vertexBufferByteLength = Math.max(scene.vertices.byteLength, vertexStride);
            vertexBuffer = device.createBuffer({
              label: 'ArchIToken steel twin vertex buffer',
              size: vertexBufferByteLength,
              usage: gpuBufferUsageVertex | gpuBufferUsageCopyDst,
            });
          }

          if (scene.vertexCount > 0 && vertexBuffer) {
            device.queue.writeBuffer(vertexBuffer, 0, scene.vertices);
          }

          const encoder = device.createCommandEncoder({
            label: 'ArchIToken steel twin command encoder',
          });
          const pass = encoder.beginRenderPass({
            label: 'ArchIToken steel twin render pass',
            colorAttachments: [
              {
                view: gpuContext.getCurrentTexture().createView(),
                clearValue: { r: 0.024, g: 0.071, b: 0.122, a: hasVisualFallback ? 0 : 1 },
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          });
          pass.setPipeline(pipeline);
          if (scene.vertexCount > 0 && vertexBuffer) {
            pass.setVertexBuffer(0, vertexBuffer);
            pass.draw(scene.vertexCount);
          }
          pass.end();
          device.queue.submit([encoder.finish()]);

          if (!metricsReported) {
            metricsReported = true;
            setRuntime({
              mode: 'webgpu',
              message: 'WebGPU 渲染管线运行中',
              adapterLabel,
              featureCount,
              limitText,
              vertexCount: scene.vertexCount,
            });
          }

          if (progressPlaying) {
            animationFrame = requestAnimationFrame(renderFrame);
          }
        }

        animationFrame = requestAnimationFrame(renderFrame);
      } catch (error) {
        if (!cancelled) {
          setRuntime({
            mode: 'fallback',
            message: `${error instanceof Error ? error.message : String(error)} ${getWebGpuUnavailableReason()} 已记录 failed WebGPU evidence；仅启用 Three.js 受审计恢复视口。`,
          });
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      vertexBuffer?.destroy();
      device?.destroy();
      pickTargetsRef.current = [];
    };
  }, [activeLayerKey, activeLayerList, geometryOverrideKey, geometryOverrides, hasVisualFallback, hiddenMemberIds, hiddenMemberKey, progressPlaying, selectedMemberId]);

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (runtime.mode !== 'webgpu') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const target = findPickTarget(pickTargetsRef.current, x, y);
    if (target) {
      onSelectMember(target.memberId);
    }
  }

  if (runtime.mode === 'fallback' && fallback) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {fallback}
        <RuntimeBadge runtime={runtime} />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {fallback ? <div className="absolute inset-0">{fallback}</div> : null}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${hasVisualFallback ? 'pointer-events-none opacity-0' : 'cursor-crosshair'}`}
        aria-label="WebGPU 重钢结构数字孪生主视口"
        onPointerDown={handlePointerDown}
        onContextMenu={(event) => event.preventDefault()}
      />
      <RuntimeBadge runtime={runtime} />
      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
        {activeLayerList.map((layerId) => (
          <Tag key={layerId} className="arch-digital-twin-tag m-0 border text-[11px] font-medium shadow-sm">
            {layerId}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function RuntimeBadge({ runtime }: { runtime: RuntimeState }) {
  if (runtime.mode === 'webgpu') {
    return (
      <div className="arch-digital-twin-panel pointer-events-none absolute right-3 top-3 max-w-[min(520px,calc(100%-1.5rem))] rounded-lg border px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="success" className="m-0 font-medium">
            <ThunderboltOutlined /> WebGPU
          </Tag>
          <Tooltip title={`${runtime.adapterLabel} · ${runtime.limitText}`}>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-100/70">
              <ApiOutlined />
              {runtime.featureCount} features · {runtime.vertexCount.toLocaleString()} vertices
            </span>
          </Tooltip>
        </div>
      </div>
    );
  }

  const icon = runtime.mode === 'fallback' ? <WarningOutlined /> : <DeploymentUnitOutlined />;
  const color = runtime.mode === 'fallback' ? 'warning' : 'processing';

  return (
    <div className="arch-digital-twin-panel pointer-events-none absolute right-3 top-3 max-w-[min(520px,calc(100%-1.5rem))] rounded-lg border px-3 py-2 backdrop-blur">
      <Tag color={color} className="m-0 font-medium">
        {icon} {runtime.mode === 'fallback' ? 'Audited fallback' : 'WebGPU init'}
      </Tag>
      <p className="mt-1 text-[11px] leading-5 text-cyan-100/70">
        {runtime.message}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-cyan-100/45">
        {steelTwinWebGpuAdapterManifest.rendererId} · {steelTwinWebGpuAdapterManifest.shaderLanguage.toUpperCase()}
      </p>
    </div>
  );
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function getWebGpuUnavailableReason(): string {
  // Delegate to the central WebGPU-first RenderRouter policy (issue #7) so the
  // diagnostic stays in one place. Called when WebGPU has already failed, so
  // the adapter is known-unavailable.
  const host = window.location.hostname;
  const localhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  return (
    webgpuUnavailableReason({
      hasWindow: true,
      isSecureContext: window.isSecureContext,
      isLocalhost: localhost,
      hasNavigatorGpu: Boolean(gpu),
      hasGpuAdapter: false,
      hasWebgl: true,
      userAgent: navigator.userAgent,
    }) ?? '当前浏览器未暴露 navigator.gpu。'
  );
}

async function readAdapterInfo(adapter: GPUAdapter): Promise<AdapterInfoLike> {
  const adapterWithInfo = adapter as GPUAdapter & {
    info?: AdapterInfoLike;
    requestAdapterInfo?: () => Promise<AdapterInfoLike>;
  };
  if (adapterWithInfo.info) return adapterWithInfo.info;
  if (adapterWithInfo.requestAdapterInfo) {
    return adapterWithInfo.requestAdapterInfo().catch(() => ({}));
  }
  return {};
}

function formatAdapterInfo(info: AdapterInfoLike): string {
  return [info.vendor, info.architecture, info.device, info.description]
    .filter((item): item is string => Boolean(item))
    .join(' / ') || 'WebGPU adapter';
}

function findPickTarget(
  targets: readonly SteelTwinWebGpuPickTarget[],
  x: number,
  y: number,
): SteelTwinWebGpuPickTarget | null {
  let best: { target: SteelTwinWebGpuPickTarget; score: number } | null = null;
  for (const target of targets) {
    const dx = Math.abs(x - target.center[0]);
    const dy = Math.abs(y - target.center[1]);
    const inside = dx <= target.size[0] / 2 && dy <= target.size[1] / 2;
    if (!inside) continue;
    const score = dx + dy + target.size[0] * target.size[1] * 0.05;
    if (!best || score < best.score) {
      best = { target, score };
    }
  }
  return best === null ? null : best.target;
}
