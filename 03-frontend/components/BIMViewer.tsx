// components/BIMViewer.tsx — Universal BIM/engineering 3D viewport
// License: Apache-2.0
"use client";

import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
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
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";

export interface BIMViewerProps {
  sourceUrl?: string | null;
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

function isStlSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return (
    ext === ".stl" ||
    normalizedMimeType === "model/stl" ||
    normalizedMimeType === "application/sla"
  );
}

function isObjSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return ext === ".obj" || normalizedMimeType === "model/obj";
}

function isPlySource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return ext === ".ply" || normalizedMimeType === "model/ply";
}

function isFbxSource(fileName?: string, mimeType?: string): boolean {
  const ext = fileName ? extensionOf(fileName) : "";
  const normalizedMimeType = mimeType?.toLowerCase() ?? "";

  return ext === ".fbx" || normalizedMimeType.includes("fbx");
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

function StlModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  geometry.computeVertexNormals();
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#cbd5e1" metalness={0.15} roughness={0.38} />
    </mesh>
  );
}

function ObjModel({ url }: { url: string }) {
  const object = useLoader(OBJLoader, url);
  return <primitive object={object} />;
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

function FbxModel({ url }: { url: string }) {
  const object = useLoader(FBXLoader, url);
  return <primitive object={object} />;
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
                ? "IFC 源文件已接入。当前前端未安装 IFC WASM 解析器，已显示 IFC 源码预览；后续可由后端 Worker 转换为 GLB/3D Tiles。"
                : "该工程格式需要后端解析管线生成可视化 derivative，例如 GLB、glTF 或 3D Tiles。")}
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
  const effectiveIfcData = ifcData ?? loadedIfcData;

  const canRenderGltf = Boolean(sourceUrl && isGltfSource(fileName, mimeType));
  const canRenderStl = Boolean(sourceUrl && isStlSource(fileName, mimeType));
  const canRenderObj = Boolean(sourceUrl && isObjSource(fileName, mimeType));
  const canRenderPly = Boolean(sourceUrl && isPlySource(fileName, mimeType));
  const canRenderFbx = Boolean(sourceUrl && isFbxSource(fileName, mimeType));
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

  const status = canRenderObj
    ? "OBJ mesh 实时渲染"
    : canRenderPly
      ? "PLY mesh 实时渲染"
      : canRenderFbx
        ? "FBX scene 实时渲染"
        : canRenderCollada
          ? "Collada scene 实时渲染"
          : canRenderStl
            ? "STL mesh 实时渲染"
            : canRenderGltf
              ? gltfValidation.key === gltfValidationKey &&
                gltfValidation.status === "invalid"
                ? "GLB/glTF derivative 校验失败"
                : gltfValidation.key === gltfValidationKey &&
                    gltfValidation.status === "checking"
                  ? "GLB/glTF derivative 校验中"
                  : "GLB/glTF 模型实时渲染"
              : canParseIfc
                ? effectiveIfcData?.startsWith("ISO-10303-21")
                  ? "IFC 源文件已接入，源码预览可用"
                  : "IFC 源文件已接入，正在读取源码"
                : "工程文件已接入，等待解析 derivative";

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
    >
      {showStatusPanel ? (
        <div className="viewer-floating-panel absolute left-4 top-4 z-10 rounded-md px-4 py-2 text-sm text-white">
          <p className="font-medium">{status}</p>
          <p className="mt-1 max-w-[28rem] truncate text-xs text-slate-300">
            {fileName}
          </p>
        </div>
      ) : null}

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
          {canRenderGltf && sourceUrl ? (
            gltfValidation.key === gltfValidationKey &&
            gltfValidation.status === "valid" ? (
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
                    ? "GLB/glTF derivative 已返回，正在校验文件头..."
                    : gltfValidation.status === "invalid"
                      ? `GLB/glTF derivative 已返回，但内容不是有效 glTF/GLB。${gltfValidation.reason ?? ""}`
                      : "GLB/glTF derivative 已返回，正在准备校验。"
                }
              />
            )
          ) : canRenderStl && sourceUrl ? (
            <Bounds fit clip observe margin={1.35}>
              <Center>
                <StlModel url={sourceUrl} />
              </Center>
            </Bounds>
          ) : canRenderObj && sourceUrl ? (
            <Bounds fit clip observe margin={1.35}>
              <Center>
                <ObjModel url={sourceUrl} />
              </Center>
            </Bounds>
          ) : canRenderPly && sourceUrl ? (
            <Bounds fit clip observe margin={1.35}>
              <Center>
                <PlyModel url={sourceUrl} />
              </Center>
            </Bounds>
          ) : canRenderFbx && sourceUrl ? (
            <Bounds fit clip observe margin={1.35}>
              <Center>
                <FbxModel url={sourceUrl} />
              </Center>
            </Bounds>
          ) : canRenderCollada && sourceUrl ? (
            <Bounds fit clip observe margin={1.35}>
              <Center>
                <ColladaModel url={sourceUrl} />
              </Center>
            </Bounds>
          ) : (
            <EmptyEngineeringScene label={fileName} canParseIfc={canParseIfc} />
          )}
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>

      {effectiveIfcData?.startsWith("ISO-10303-21") ? (
        <div className="viewer-floating-panel absolute bottom-4 left-4 z-10 h-48 w-80 overflow-auto rounded-md p-3">
          <div className="mb-2 text-xs font-medium text-cyan-300">
            IFC 源码预览 ISO-10303-21
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-300">
            {effectiveIfcData}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
