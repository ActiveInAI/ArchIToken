// components/BIMViewer.tsx — Universal BIM/engineering 3D viewport
// License: Apache-2.0
'use client';

import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, Environment, Grid, Html, OrbitControls, useGLTF } from '@react-three/drei';

export interface BIMViewerProps {
  sourceUrl?: string | null;
  ifcData?: string | null;
  fileName?: string;
  mimeType?: string;
  className?: string;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function isGltfSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : '';
  const normalizedMimeType = mimeType?.toLowerCase() ?? '';

  return ext === '.glb'
    || ext === '.gltf'
    || normalizedMimeType === 'model/gltf-binary'
    || normalizedMimeType === 'model/gltf+json';
}

function isIfcSource(
  fileName?: string,
  mimeType?: string,
  ifcData?: string | null,
  sourceUrl?: string | null,
): boolean {
  const ext = fileName ? extensionOf(fileName) : '';
  const normalizedMimeType = mimeType?.toLowerCase() ?? '';
  const normalizedUrl = sourceUrl?.toLowerCase() ?? '';

  return ext === '.ifc'
    || normalizedMimeType.includes('ifc')
    || normalizedMimeType.includes('step')
    || normalizedUrl.endsWith('.ifc')
    || Boolean(ifcData?.startsWith('ISO-10303-21'));
}

function GltfModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} />;
}

function EmptyEngineeringScene({
  label,
  canParseIfc,
  detail,
}: {
  label: string;
  canParseIfc: boolean;
  detail?: string;
}) {
  return (
    <Center>
      <Grid infiniteGrid fadeDistance={40} sectionColor="#334155" cellColor="#1e293b" />
      <Html center>
        <div className="w-80 rounded-2xl border border-slate-700 bg-slate-950/90 p-4 text-center text-slate-100 shadow-xl backdrop-blur">
          <p className="text-sm font-black">{label}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            {detail ??
              (canParseIfc
                ? 'IFC 源文件已接入。当前前端未安装 IFC WASM 解析器，已显示 IFC 源码预览；后续可由后端 Worker 转换为 GLB/3D Tiles。'
                : '该工程格式需要后端解析管线生成可视化 derivative，例如 GLB、glTF 或 3D Tiles。')}
          </p>
        </div>
      </Html>
    </Center>
  );
}

type GltfValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface GltfValidationState {
  key: string;
  status: GltfValidationStatus;
  reason?: string;
}

function isLikelyValidGltfPayload(buffer: ArrayBuffer, fileName?: string, mimeType?: string): boolean {
  if (buffer.byteLength < 4) return false;

  const bytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 96)));
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));

  if (magic === 'glTF') return true;

  const ext = fileName ? extensionOf(fileName) : '';
  const normalizedMimeType = mimeType?.toLowerCase() ?? '';

  if (ext === '.gltf' || normalizedMimeType === 'model/gltf+json') {
    const head = new TextDecoder().decode(bytes).trimStart();
    return head.startsWith('{');
  }

  return false;
}

class GltfErrorBoundary extends Component<
  {
    resetKey: string;
    fallback: ReactNode;
    children: ReactNode;
  },
  {
    hasError: boolean;
    message: string | null;
  }
> {
  constructor(props: { resetKey: string; fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: null,
    };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  override componentDidUpdate(previousProps: { resetKey: string }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
        message: null,
      });
    }
  }

  override componentDidCatch(error: unknown) {
    console.error('GLB/glTF derivative failed to render in BIMViewer', error);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function BIMViewer({
  sourceUrl,
  ifcData = null,
  fileName = '工程模型',
  mimeType,
  className,
}: BIMViewerProps) {
  const [loadedIfcData, setLoadedIfcData] = useState<string | null>(null);
  const [gltfValidation, setGltfValidation] = useState<GltfValidationState>({
    key: '',
    status: 'idle',
  });
  const effectiveIfcData = ifcData ?? loadedIfcData;

  const canRenderGltf = Boolean(sourceUrl && isGltfSource(fileName, mimeType));
  const canParseIfc = isIfcSource(fileName, mimeType, effectiveIfcData, sourceUrl);
  const gltfValidationKey = `${sourceUrl ?? ''}:${fileName}:${mimeType ?? ''}`;

  const status = canRenderGltf
    ? gltfValidation.key === gltfValidationKey && gltfValidation.status === 'invalid'
      ? 'GLB/glTF derivative 校验失败'
      : gltfValidation.key === gltfValidationKey && gltfValidation.status === 'checking'
        ? 'GLB/glTF derivative 校验中'
        : 'GLB/glTF 模型实时渲染'
    : canParseIfc
      ? effectiveIfcData?.startsWith('ISO-10303-21')
        ? 'IFC 源文件已接入，源码预览可用'
        : 'IFC 源文件已接入，正在读取源码'
      : '工程文件已接入，等待解析 derivative';

  useEffect(() => {
    let cancelled = false;

    async function validateGltfSource() {
      if (!canRenderGltf || !sourceUrl) {
        setGltfValidation({
          key: gltfValidationKey,
          status: 'idle',
        });
        return;
      }

      setGltfValidation({
        key: gltfValidationKey,
        status: 'checking',
      });

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        const buffer = await response.arrayBuffer();

        if (cancelled) return;

        if (isLikelyValidGltfPayload(buffer, fileName, mimeType)) {
          setGltfValidation({
            key: gltfValidationKey,
            status: 'valid',
          });
          return;
        }

        setGltfValidation({
          key: gltfValidationKey,
          status: 'invalid',
          reason: 'artifact 内容不是 glTF JSON，也不是以 glTF magic 开头的 GLB 二进制。',
        });
      } catch (error) {
        if (cancelled) return;

        setGltfValidation({
          key: gltfValidationKey,
          status: 'invalid',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void validateGltfSource();

    return () => {
      cancelled = true;
    };
  }, [canRenderGltf, sourceUrl, fileName, mimeType, gltfValidationKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadIfcSource() {
      if (!sourceUrl || ifcData || !isIfcSource(fileName, mimeType, null, sourceUrl)) {
        setLoadedIfcData(null);
        return;
      }

      try {
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        const text = await response.text();

        if (!cancelled && text.startsWith('ISO-10303-21')) {
          setLoadedIfcData(text);
        }
      } catch {
        if (!cancelled) setLoadedIfcData(null);
      }
    }

    void loadIfcSource();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl, ifcData, fileName, mimeType]);

  return (
    <section className={className ?? 'relative min-h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950'}>
      <div className="absolute left-4 top-4 z-10 rounded-xl border border-slate-700 bg-slate-950/85 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
        <p className="font-black">{status}</p>
        <p className="mt-1 max-w-[28rem] truncate text-xs text-slate-300">{fileName}</p>
      </div>

      <Canvas shadows camera={{ position: [10, 8, 10], fov: 45 }}>
        <color attach="background" args={['#020817']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 12, 8]} intensity={1.2} castShadow />
        <Environment preset="city" />

        <Suspense
          fallback={
            <Html center>
              <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-2 text-sm text-slate-100">
                正在加载工程模型...
              </div>
            </Html>
          }
        >
          {canRenderGltf && sourceUrl ? (
            gltfValidation.key === gltfValidationKey && gltfValidation.status === 'valid' ? (
              <GltfErrorBoundary
                resetKey={gltfValidationKey}
                fallback={
                  <EmptyEngineeringScene
                    label={fileName}
                    canParseIfc={canParseIfc}
                    detail="GLB/glTF derivative 已返回，但浏览器解析失败。页面已保持可用；请检查后端是否生成了有效 glTF/GLB 二进制。"
                  />
                }
              >
                <Bounds fit clip observe margin={1.2}>
                  <GltfModel url={sourceUrl} />
                </Bounds>
              </GltfErrorBoundary>
            ) : (
              <EmptyEngineeringScene
                label={fileName}
                canParseIfc={canParseIfc}
                detail={
                  gltfValidation.status === 'checking'
                    ? 'GLB/glTF derivative 已返回，正在校验文件头...'
                    : gltfValidation.status === 'invalid'
                      ? `GLB/glTF derivative 已返回，但内容不是有效 glTF/GLB。${gltfValidation.reason ?? ''}`
                      : 'GLB/glTF derivative 已返回，正在准备校验。'
                }
              />
            )
          ) : (
            <EmptyEngineeringScene label={fileName} canParseIfc={canParseIfc} />
          )}
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>

      {effectiveIfcData?.startsWith('ISO-10303-21') ? (
        <div className="absolute bottom-4 left-4 z-10 h-48 w-80 overflow-auto rounded-xl border border-slate-700 bg-slate-950/90 p-3 backdrop-blur">
          <div className="mb-2 text-xs font-bold text-cyan-300">IFC 源码预览 ISO-10303-21</div>
          <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-300">{effectiveIfcData}</pre>
        </div>
      ) : null}
    </section>
  );
}
