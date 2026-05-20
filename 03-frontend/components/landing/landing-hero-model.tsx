"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  type HeroPartInfo,
  useHeroModelStore,
} from "@/stores/hero-model.store";

const DEFAULT_MODEL_PATH = "/models/hero-building.glb";
const DEFAULT_EDGE_COLOR = "#d4d4d4";
const DEFAULT_ACCENT_COLOR = "#c4f542";
const DEFAULT_PANEL_COLOR = "#0f0f12";

// 模型规格化：最长边目标尺寸；camera distance 配套缩放，保证模型与原 cube hero
// 视觉占比相近（不修改 Canvas 的 fov/dpr/shadows 等结构性 props）。
const TARGET_LONGEST_EDGE = 5;
const CAMERA_DISTANCE = 10;
const CAMERA_TILT_DEG = 6;
const CAMERA_FOV = 38;
const AUTO_ROTATE_SPEED = 0.375;

interface ProcessedMesh {
  readonly id: string;
  readonly name: string;
  readonly uuid: string;
  readonly geometry: THREE.BufferGeometry;
  readonly triangles: number;
  readonly vertices: number;
  readonly size: readonly [number, number, number];
}

interface ProcessedModel {
  readonly meshes: readonly ProcessedMesh[];
  readonly totalTriangles: number;
  readonly height: number;
  readonly center: THREE.Vector3;
  readonly floorY: number;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useProcessedModel(modelPath: string): ProcessedModel {
  const gltf = useGLTF(modelPath);

  return useMemo(() => {
    const scene = gltf.scene;
    const collected: ProcessedMesh[] = [];

    scene.updateMatrixWorld(true);

    let idx = 0;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geo = (mesh.geometry as THREE.BufferGeometry).clone();
      geo.applyMatrix4(mesh.matrixWorld);
      collected.push({
        id: `mesh-${idx}-${mesh.uuid.slice(-6)}`,
        name: mesh.name || `Mesh ${idx}`,
        uuid: mesh.uuid,
        geometry: geo,
        triangles: 0,
        vertices: 0,
        size: [0, 0, 0],
      });
      idx++;
    });

    // 全局包围盒（原始世界坐标）
    const globalBox = new THREE.Box3();
    for (const m of collected) {
      m.geometry.computeBoundingBox();
      globalBox.union(m.geometry.boundingBox!);
    }
    const sizeVec = new THREE.Vector3();
    globalBox.getSize(sizeVec);
    const centerVec = new THREE.Vector3();
    globalBox.getCenter(centerVec);
    const longestEdge = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
    const scale = TARGET_LONGEST_EDGE / longestEdge;

    // 以模型中心进行缩放：先平移使整个 bbox 中心 → 原点，再统一缩放
    const translateMat = new THREE.Matrix4().makeTranslation(
      -centerVec.x,
      -centerVec.y,
      -centerVec.z,
    );
    const scaleMat = new THREE.Matrix4().makeScale(scale, scale, scale);
    const transform = new THREE.Matrix4().multiplyMatrices(
      scaleMat,
      translateMat,
    );

    let totalTriangles = 0;
    const meshes: ProcessedMesh[] = collected.map((m) => {
      m.geometry.applyMatrix4(transform);
      m.geometry.computeBoundingBox();
      m.geometry.computeVertexNormals();
      const bb = m.geometry.boundingBox!;
      const size: [number, number, number] = [
        bb.max.x - bb.min.x,
        bb.max.y - bb.min.y,
        bb.max.z - bb.min.z,
      ];
      const verts = m.geometry.attributes.position?.count ?? 0;
      const tris = m.geometry.index
        ? m.geometry.index.count / 3
        : verts / 3;
      totalTriangles += tris;
      return {
        ...m,
        triangles: tris,
        vertices: verts,
        size,
      };
    });

    // 缩放后的全局包围盒
    const finalBox = new THREE.Box3();
    for (const m of meshes) finalBox.union(m.geometry.boundingBox!);
    const finalCenter = new THREE.Vector3();
    finalBox.getCenter(finalCenter);
    const finalSize = new THREE.Vector3();
    finalBox.getSize(finalSize);

    console.log(`[HeroModel] Loaded ${meshes.length} meshes`);
    if (meshes.length > 0) {
      console.log(
        "[HeroModel] First meshes:",
        meshes
          .slice(0, 10)
          .map((m) => m.name)
          .join(", "),
      );
    }
    console.log(`[HeroModel] Total triangles: ${Math.round(totalTriangles)}`);
    if (totalTriangles > 300_000) {
      console.warn(
        `[HeroModel] Triangle count ${Math.round(totalTriangles)} > 300k. Consider running gltf-transform to optimize.`,
      );
    }

    return {
      meshes,
      totalTriangles,
      height: finalSize.y,
      center: finalCenter,
      floorY: finalBox.min.y,
    };
  }, [gltf.scene]);
}

interface PartProps {
  readonly data: ProcessedMesh;
  readonly edgeColor: string;
  readonly accentColor: string;
  readonly panelColor: string;
  readonly enableInteraction: boolean;
  readonly onPartSelect: ((info: HeroPartInfo | null) => void) | undefined;
}

function Part({
  data,
  edgeColor,
  accentColor,
  panelColor,
  enableInteraction,
  onPartSelect,
}: PartProps) {
  const hoveredId = useHeroModelStore((s) => s.hoveredId);
  const selectedId = useHeroModelStore((s) => s.selectedId);
  const setHovered = useHeroModelStore((s) => s.setHovered);
  const setSelected = useHeroModelStore((s) => s.setSelected);

  const isHovered = hoveredId === data.id;
  const isSelected = selectedId === data.id;

  let panelOpacity = 0.75;
  let panelHex = panelColor;
  let edgeHex = edgeColor;
  let emissiveHex = "#000000";
  let emissiveIntensity = 0;

  if (isSelected) {
    panelOpacity = 1.0;
    panelHex = "#1a1a1f";
    edgeHex = accentColor;
    emissiveHex = accentColor;
    emissiveIntensity = 0.35;
  } else if (isHovered) {
    panelOpacity = 0.85;
    edgeHex = accentColor;
  }

  const interactionHandlers = enableInteraction
    ? {
        onPointerOver: (e: THREE.Event) => {
          (e as unknown as { stopPropagation: () => void }).stopPropagation();
          setHovered(data.id);
          if (typeof document !== "undefined")
            document.body.style.cursor = "pointer";
        },
        onPointerOut: (e: THREE.Event) => {
          (e as unknown as { stopPropagation: () => void }).stopPropagation();
          setHovered(null);
          if (typeof document !== "undefined") document.body.style.cursor = "";
        },
        onClick: (e: THREE.Event) => {
          (e as unknown as { stopPropagation: () => void }).stopPropagation();
          if (isSelected) {
            setSelected(null);
            onPartSelect?.(null);
          } else {
            const info: HeroPartInfo = {
              id: data.id,
              name: data.name,
              uuid: data.uuid,
              size: data.size,
              triangles: Math.round(data.triangles),
              vertices: data.vertices,
            };
            setSelected(info);
            onPartSelect?.(info);
          }
        },
      }
    : {};

  return (
    <mesh geometry={data.geometry} {...interactionHandlers}>
      <meshStandardMaterial
        color={panelHex}
        transparent
        opacity={panelOpacity}
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
        emissive={emissiveHex}
        emissiveIntensity={emissiveIntensity}
        depthWrite={panelOpacity > 0.95}
      />
      <Edges threshold={15} color={edgeHex}>
        <lineBasicMaterial color={edgeHex} linewidth={1.5} />
      </Edges>
    </mesh>
  );
}

interface ModelSceneProps {
  readonly modelPath: string;
  readonly edgeColor: string;
  readonly accentColor: string;
  readonly panelColor: string;
  readonly enableInteraction: boolean;
  readonly onPartSelect: ((info: HeroPartInfo | null) => void) | undefined;
}

function ModelScene({
  modelPath,
  edgeColor,
  accentColor,
  panelColor,
  enableInteraction,
  onPartSelect,
}: ModelSceneProps) {
  const model = useProcessedModel(modelPath);
  const setSelected = useHeroModelStore((s) => s.setSelected);

  // ESC 取消选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        onPartSelect?.(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelected, onPartSelect]);

  return (
    <group>
      <Grid
        position={[0, model.floorY, 0]}
        args={[80, 80]}
        cellSize={0.3}
        cellThickness={0.7}
        cellColor="#5A5A5A"
        sectionSize={3}
        sectionThickness={1.6}
        sectionColor="#9A9A9A"
        fadeDistance={70}
        fadeStrength={1.0}
        infiniteGrid
      />
      {model.meshes.map((m) => (
        <Part
          key={m.id}
          data={m}
          edgeColor={edgeColor}
          accentColor={accentColor}
          panelColor={panelColor}
          enableInteraction={enableInteraction}
          onPartSelect={onPartSelect}
        />
      ))}
    </group>
  );
}

export interface HeroModelProps {
  readonly modelPath?: string;
  readonly enableInteraction?: boolean;
  readonly edgeColor?: string;
  readonly accentColor?: string;
  readonly panelColor?: string;
  readonly onPartSelect?: (info: HeroPartInfo | null) => void;
}

export function LandingHeroModel({
  modelPath = DEFAULT_MODEL_PATH,
  enableInteraction = true,
  edgeColor = DEFAULT_EDGE_COLOR,
  accentColor = DEFAULT_ACCENT_COLOR,
  panelColor = DEFAULT_PANEL_COLOR,
  onPartSelect,
}: HeroModelProps) {
  const reducedMotion = useReducedMotion();
  const setSelected = useHeroModelStore((s) => s.setSelected);

  // 自动旋转：仅 reducedMotion 时暂停；hover / 选中 / 用户拖拽时
  // drei 会把用户增量与 autoRotate 增量合并，永远不停（与原 cube hero 一致）。
  const shouldAutoRotate = !reducedMotion;

  // Camera：模型中心已被对齐到原点，target = 原点，cameraY = 单纯的 tilt 抬升。
  const cameraTilt = THREE.MathUtils.degToRad(CAMERA_TILT_DEG);
  const cameraY = Math.sin(cameraTilt) * CAMERA_DISTANCE;
  const cameraXZ = Math.cos(cameraTilt) * CAMERA_DISTANCE;
  const target: [number, number, number] = [0, 0, 0];

  return (
    <Canvas
      data-testid="hero-3d-canvas"
      camera={{ position: [cameraXZ, cameraY, cameraXZ], fov: CAMERA_FOV }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      onPointerMissed={() => {
        setSelected(null);
        onPartSelect?.(null);
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 16, 8]} intensity={0.95} color="#FFFFFF" />
      <directionalLight position={[-8, 6, -10]} intensity={0.4} color="#A8C8FF" />

      <ModelScene
        modelPath={modelPath}
        edgeColor={edgeColor}
        accentColor={accentColor}
        panelColor={panelColor}
        enableInteraction={enableInteraction}
        onPartSelect={onPartSelect}
      />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        target={target}
        minPolarAngle={THREE.MathUtils.degToRad(30)}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate={shouldAutoRotate}
        autoRotateSpeed={AUTO_ROTATE_SPEED}
      />
    </Canvas>
  );
}

useGLTF.preload(DEFAULT_MODEL_PATH);
