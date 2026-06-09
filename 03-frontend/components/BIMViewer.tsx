// components/BIMViewer.tsx — Universal BIM/engineering 3D viewport
// License: Apache-2.0
"use client";

import {
  Component,
  Suspense,
  useEffect,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  Bounds,
  Center,
  Environment,
  Grid,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { TilesRenderer as Tiles3dRenderer } from "3d-tiles-renderer/r3f";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";

export interface BIMViewerProps {
  sourceUrl?: string | null;
  materialUrl?: string | null;
  ifcData?: string | null;
  fileName?: string;
  mimeType?: string;
  className?: string;
  showStatusPanel?: boolean;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function isGltfSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return (
    ext === ".glb" ||
    ext === ".gltf" ||
    normalizedMimeType === "model/gltf-binary" ||
    normalizedMimeType === "model/gltf+json"
  );
}

function isTiles3dSource(fileName?: string, mimeType?: string): boolean {
  const normalizedFileName = fileName?.toLowerCase() ?? "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return (
    normalizedFileName.endsWith("tileset.json") ||
    normalizedMimeType === "application/vnd.3dtiles+json" ||
    normalizedMimeType === "model/vnd.3dtiles"
  );
}

function isStlSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return (
    ext === ".stl" ||
    normalizedMimeType === "model/stl" ||
    normalizedMimeType === "application/sla"
  );
}

function isPlySource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return ext === ".ply" || normalizedMimeType === "model/ply";
}

function isColladaSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return ext === ".dae" || normalizedMimeType.includes("collada");
}

function isIfcSource(
  fileName?: string,
  mimeType?: string,
  ifcData?: string | null,
  sourceUrl?: string | null,
): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  const normalizedUrl = sourceUrl?.toLowerCase() ?? "";

  return (
    ext === ".ifc" ||
    normalizedMimeType.includes("ifc") ||
    normalizedMimeType.includes("step") ||
    normalizedUrl.endsWith(".ifc") ||
    Boolean(ifcData?.startsWith("ISO-10303-21"))
  );
}

function GltfModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} />;
}

function Tiles3dModel({ url }: { url: string }) {
  return <Tiles3dRenderer url={url} />;
}

function StlModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  geometry.computeVertexNormals();
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#cbd5e1" metalness={0.15} roughness={0.38} />
    </mesh>
  );
}

function PlyModel({ url }: { url: string }) {
  const geometry = useLoader(PLYLoader, url);
  geometry.computeVertexNormals();
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#cbd5e1" metalness={0.12} roughness={0.42} />
    </mesh>
  );
}

function ColladaModel({ url }: { url: string }) {
  const collada = useLoader(ColladaLoader, url);
  if (!collada) {
    return null;
  }
  return <primitive object={collada.scene} />;
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
      <Grid
        infiniteGrid
        fadeDistance={40}
        sectionColor="#334155"
        cellColor="#1e293b"
      />
      <Html center>
        <div className="viewer-floating-panel w-80 rounded-md p-4 text-center text-slate-100">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            {detail ??
              (canParseIfc
                ? "模型源文件已接入。当前浏览器仅显示源码预览，完整查看需等待 PanAEC Engine 完成轻量化处理。"
                : "该工程格式需要 PanAEC Engine 生成可视化模型后查看。")}
          </p>
        </div>
      </Html>
    </Center>
  );
}

type GltfValidationStatus = "idle" | "checking" | "valid" | "invalid";

interface GltfValidationState {
  key: string;
  status: GltfValidationStatus;
  reason?: string;
}

type ModelAxisAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "front"
  | "back"
  | "reset";

interface BimViewTransform {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

const defaultBimViewTransform: BimViewTransform = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
};

function BimSixAxisControlPanel({
  onAction,
}: {
  onAction: (action: ModelAxisAction) => void;
}) {
  const buttons: Array<{
    action: ModelAxisAction;
    label: string;
    title: string;
    className: string;
  }> = [
    { action: "up", label: "上", title: "沿上轴移动", className: "col-start-2" },
    { action: "front", label: "前", title: "沿前轴移动", className: "col-start-4" },
    { action: "left", label: "左", title: "沿左轴移动", className: "col-start-1 row-start-2" },
    { action: "reset", label: "中", title: "重置六轴位置", className: "col-start-2 row-start-2" },
    { action: "right", label: "右", title: "沿右轴移动", className: "col-start-3 row-start-2" },
    { action: "back", label: "后", title: "沿后轴移动", className: "col-start-4 row-start-2" },
    { action: "down", label: "下", title: "沿下轴移动", className: "col-start-2 row-start-3" },
  ];

  return (
    <div
      className="viewer-floating-panel absolute bottom-3 left-3 z-20 grid grid-cols-4 grid-rows-3 gap-1 rounded-md p-1.5"
      aria-label="六轴操控"
    >
      {buttons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => onAction(button.action)}
          className={`viewer-ghost-tool flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold ${button.className}`}
          title={button.title}
          aria-label={button.title}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

function applyBimAxisAction(
  action: ModelAxisAction,
  setViewTransform: Dispatch<SetStateAction<BimViewTransform>>,
  step = 1,
) {
  setViewTransform((current) => {
    if (action === "reset") return defaultBimViewTransform;
    if (action === "left") return { ...current, offsetX: current.offsetX - step };
    if (action === "right") return { ...current, offsetX: current.offsetX + step };
    if (action === "up") return { ...current, offsetZ: current.offsetZ + step };
    if (action === "down") return { ...current, offsetZ: current.offsetZ - step };
    if (action === "front") return { ...current, offsetY: current.offsetY - step };
    return { ...current, offsetY: current.offsetY + step };
  });
}

function handleBimKeyDown(
  event: KeyboardEvent<HTMLElement>,
  setViewTransform: Dispatch<SetStateAction<BimViewTransform>>,
) {
  const step = event.shiftKey ? 4 : 1;
  const key = event.key.toLowerCase();
  const handlers: Record<string, () => void> = {
    arrowup: () => applyBimAxisAction("up", setViewTransform, step),
    arrowdown: () => applyBimAxisAction("down", setViewTransform, step),
    arrowleft: () => applyBimAxisAction("left", setViewTransform, step),
    arrowright: () => applyBimAxisAction("right", setViewTransform, step),
    pageup: () => applyBimAxisAction("front", setViewTransform, step),
    pagedown: () => applyBimAxisAction("back", setViewTransform, step),
    w: () => applyBimAxisAction("front", setViewTransform, step),
    s: () => applyBimAxisAction("back", setViewTransform, step),
    a: () => applyBimAxisAction("left", setViewTransform, step),
    d: () => applyBimAxisAction("right", setViewTransform, step),
    r: () => applyBimAxisAction("reset", setViewTransform, step),
  };
  const handler = handlers[key];
  if (!handler) return;
  event.preventDefault();
  handler();
}

function isLikelyValidGltfPayload(
  buffer: ArrayBuffer,
  fileName?: string,
  mimeType?: string,
): boolean {
  if (buffer.byteLength < 4) return false;

  const bytes = new Uint8Array(
    buffer.slice(0, Math.min(buffer.byteLength, 96)),
  );
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));

  if (magic === "glTF") return true;

  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  const head = new TextDecoder().decode(bytes).trimStart();

  if (head.startsWith("{")) return true;

  if (ext === ".gltf" || normalizedMimeType === "model/gltf+json") {
    return head.startsWith("{");
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
  constructor(props: {
    resetKey: string;
    fallback: ReactNode;
    children: ReactNode;
  }) {
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
    console.error("GLB/glTF derivative failed to render in BIMViewer", error);
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
  fileName = "工程模型",
  mimeType,
  className,
  showStatusPanel = true,
}: BIMViewerProps) {
  const [loadedIfcData, setLoadedIfcData] = useState<string | null>(null);
  const [gltfValidation, setGltfValidation] = useState<GltfValidationState>({
    key: "",
    status: "idle",
  });
  const [viewTransform, setViewTransform] =
    useState<BimViewTransform>(defaultBimViewTransform);
  const effectiveIfcData = ifcData ?? loadedIfcData;

  const canRenderGltf = Boolean(sourceUrl && isGltfSource(fileName, mimeType));
  const canRenderTiles3d = Boolean(
    sourceUrl && isTiles3dSource(fileName, mimeType),
  );
  const canRenderStl = Boolean(sourceUrl && isStlSource(fileName, mimeType));
  const canRenderPly = Boolean(sourceUrl && isPlySource(fileName, mimeType));
  const canRenderCollada = Boolean(
    sourceUrl && isColladaSource(fileName, mimeType),
  );
  const canParseIfc = isIfcSource(
    fileName,
    mimeType,
    effectiveIfcData,
    sourceUrl,
  );
  const gltfValidationKey = `${sourceUrl ?? ""}:${fileName}:${mimeType ?? ""}`;

  const status = canRenderTiles3d
    ? "PanAEC Engine 模型流式查看"
    : canRenderPly
      ? "PanAEC Engine 模型实时查看"
      : canRenderCollada
        ? "PanAEC Engine 模型实时查看"
        : canRenderStl
          ? "PanAEC Engine 模型实时查看"
          : canRenderGltf
            ? gltfValidation.key === gltfValidationKey &&
              gltfValidation.status === "invalid"
              ? "PanAEC Engine 模型校验失败"
              : gltfValidation.key === gltfValidationKey &&
                  gltfValidation.status === "checking"
                ? "PanAEC Engine 模型校验中"
                : "PanAEC Engine 模型实时查看"
            : canParseIfc
              ? effectiveIfcData?.startsWith("ISO-10303-21")
                ? "PanAEC Engine 源文件预览可用"
                : "PanAEC Engine 正在读取源文件"
              : "工程文件已接入，等待 PanAEC Engine 处理";

  useEffect(() => {
    let cancelled = false;

    async function validateGltfSource() {
      if (!canRenderGltf || !sourceUrl) {
        setGltfValidation({
          key: gltfValidationKey,
          status: "idle",
        });
        return;
      }

      setGltfValidation({
        key: gltfValidationKey,
        status: "checking",
      });

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        const buffer = await response.arrayBuffer();

        if (cancelled) return;

        if (isLikelyValidGltfPayload(buffer, fileName, mimeType)) {
          setGltfValidation({
            key: gltfValidationKey,
            status: "valid",
          });
          return;
        }

        setGltfValidation({
          key: gltfValidationKey,
          status: "invalid",
          reason:
            "artifact 内容不是 glTF JSON，也不是以 glTF magic 开头的 GLB 二进制。",
        });
      } catch (error) {
        if (cancelled) return;

        setGltfValidation({
          key: gltfValidationKey,
          status: "invalid",
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
      if (
        !sourceUrl ||
        ifcData ||
        !isIfcSource(fileName, mimeType, null, sourceUrl)
      ) {
        setLoadedIfcData(null);
        return;
      }

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        const text = await response.text();

        if (!cancelled && text.startsWith("ISO-10303-21")) {
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
    <section
      className={
        className ??
        "relative min-h-[calc(100vh-180px)] overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
      }
      tabIndex={0}
      onKeyDown={(event) => handleBimKeyDown(event, setViewTransform)}
    >
      {showStatusPanel ? (
        <div className="viewer-floating-panel absolute left-4 top-4 z-10 rounded-md px-4 py-2 text-sm text-white">
          <p className="font-medium">{status}</p>
          <p className="mt-1 max-w-[28rem] truncate text-xs text-slate-300">
            {fileName}
          </p>
        </div>
      ) : null}

      <BimSixAxisControlPanel
        onAction={(action) => applyBimAxisAction(action, setViewTransform)}
      />

      <Canvas shadows="percentage" camera={{ position: [10, 8, 10], fov: 45 }}>
        <color attach="background" args={["#020817"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 12, 8]} intensity={1.2} castShadow />
        <Environment preset="city" />

        <Suspense
          fallback={
            <Html center>
              <div className="viewer-floating-panel rounded-md px-4 py-2 text-sm text-slate-100">
                正在加载工程模型...
              </div>
            </Html>
          }
        >
          <group
            position={[
              viewTransform.offsetX,
              viewTransform.offsetY,
              viewTransform.offsetZ,
            ]}
          >
            {canRenderTiles3d && sourceUrl ? (
              <Tiles3dModel url={sourceUrl} />
            ) : canRenderGltf && sourceUrl ? (
              gltfValidation.key === gltfValidationKey &&
              gltfValidation.status === "valid" ? (
                <GltfErrorBoundary
                  resetKey={gltfValidationKey}
                  fallback={
                    <EmptyEngineeringScene
                      label={fileName}
                      canParseIfc={canParseIfc}
                      detail="PanAEC Engine 模型已返回，但浏览器解析失败。页面已保持可用；请检查模型生成结果。"
                    />
                  }
                >
                  <Bounds fit clip observe margin={1.35}>
                    <Center>
                      <GltfModel url={sourceUrl} />
                    </Center>
                  </Bounds>
                </GltfErrorBoundary>
              ) : (
                <EmptyEngineeringScene
                  label={fileName}
                  canParseIfc={canParseIfc}
                  detail={
                    gltfValidation.status === "checking"
                      ? "PanAEC Engine 模型已返回，正在校验文件头..."
                      : gltfValidation.status === "invalid"
                        ? `PanAEC Engine 模型已返回，但内容暂不可用。${gltfValidation.reason ?? ""}`
                        : "PanAEC Engine 模型已返回，正在准备校验。"
                  }
                />
              )
            ) : canRenderStl && sourceUrl ? (
              <Bounds fit clip observe margin={1.35}>
                <Center>
                  <StlModel url={sourceUrl} />
                </Center>
              </Bounds>
            ) : canRenderPly && sourceUrl ? (
              <Bounds fit clip observe margin={1.35}>
                <Center>
                  <PlyModel url={sourceUrl} />
                </Center>
              </Bounds>
            ) : canRenderCollada && sourceUrl ? (
              <Bounds fit clip observe margin={1.35}>
                <Center>
                  <ColladaModel url={sourceUrl} />
                </Center>
              </Bounds>
            ) : (
              <EmptyEngineeringScene
                label={fileName}
                canParseIfc={canParseIfc}
              />
            )}
          </group>
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>

      {effectiveIfcData?.startsWith("ISO-10303-21") ? (
        <div className="viewer-floating-panel absolute bottom-4 left-4 z-10 h-48 w-80 overflow-auto rounded-md p-3">
          <div className="mb-2 text-xs font-medium text-cyan-300">
            源文件预览
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-300">
            {effectiveIfcData}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
