"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

type Vec3Tuple = [number, number, number];

const STORY_HEIGHT = 3.6;
const STORIES = 4;
const SPAN_X = 4.5;
const SPAN_Z = 4.5;
const COLS_X = 4;
const COLS_Z = 3;
const COL_SECTION = 0.18;
const BEAM_SECTION = 0.14;
const JOINT_SECTION = COL_SECTION * 1.5;
const SLAB_THICKNESS = 0.08;

const COL_WHITE = "#F5F5F0";
const BEAM_GREY = "#9C9C9C";
const SLAB_GREY = "#3F3F3F";
const JOINT_GREY = "#D8D8D8";
const ENVELOPE_FROST = "#A8C8FF";
const ACCENT_LIME = "#D4FF3A";

// Building lives at world origin; OrbitControls.target = building center, so
// autoRotate genuinely spins the building around its own axis. The visual
// off-center placement (building on the right half of the screen) is
// achieved at the parent layer by widening the canvas wrapper to 150% of
// the viewport — the canvas center (where the building renders) lands at
// viewport ~75%. See landing-hero.tsx hero-3d-wrapper.
const MODEL_SHIFT_X = 0;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = window.requestAnimationFrame(() => setReduced(mq.matches));
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      mq.removeEventListener("change", onChange);
    };
  }, []);
  return reduced;
}

type SelectableKind = "column" | "beam-x" | "beam-z" | "joint";

interface ColumnProps {
  readonly id: string;
  readonly position: Vec3Tuple;
  readonly height: number;
  readonly hovered: boolean;
  readonly selected: boolean;
  readonly onHover: (id: string | null) => void;
  readonly onSelect: (id: string, kind: SelectableKind) => void;
}

function Column({ id, position, height, hovered, selected, onHover, onSelect }: ColumnProps) {
  const emissiveStrength = selected ? 0.8 : hovered ? 0.4 : 0;
  const color = selected || hovered ? ACCENT_LIME : COL_WHITE;
  return (
    <mesh
      position={position}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onHover(id);
      }}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id, "column");
      }}
    >
      <boxGeometry args={[COL_SECTION, height, COL_SECTION]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveStrength > 0 ? ACCENT_LIME : "#000000"}
        emissiveIntensity={emissiveStrength}
        roughness={0.7}
      />
    </mesh>
  );
}

interface BeamProps {
  readonly id: string;
  readonly position: Vec3Tuple;
  readonly length: number;
  readonly axis: "x" | "z";
  readonly hovered: boolean;
  readonly selected: boolean;
  readonly onHover: (id: string | null) => void;
  readonly onSelect: (id: string, kind: SelectableKind) => void;
}

function Beam({ id, position, length, axis, hovered, selected, onHover, onSelect }: BeamProps) {
  const args: [number, number, number] =
    axis === "x" ? [length, BEAM_SECTION, BEAM_SECTION] : [BEAM_SECTION, BEAM_SECTION, length];
  const emissiveStrength = selected ? 0.8 : hovered ? 0.4 : 0;
  const color = selected || hovered ? ACCENT_LIME : BEAM_GREY;
  return (
    <mesh
      position={position}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onHover(id);
      }}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id, axis === "x" ? "beam-x" : "beam-z");
      }}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveStrength > 0 ? ACCENT_LIME : "#000000"}
        emissiveIntensity={emissiveStrength}
        roughness={0.6}
      />
    </mesh>
  );
}

interface JointProps {
  readonly id: string;
  readonly position: Vec3Tuple;
  readonly hovered: boolean;
  readonly selected: boolean;
  readonly onHover: (id: string | null) => void;
  readonly onSelect: (id: string, kind: SelectableKind) => void;
}

function Joint({ id, position, hovered, selected, onHover, onSelect }: JointProps) {
  const emissiveStrength = selected ? 0.9 : hovered ? 0.5 : 0;
  const color = selected || hovered ? ACCENT_LIME : JOINT_GREY;
  return (
    <mesh
      position={position}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onHover(id);
      }}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id, "joint");
      }}
    >
      <boxGeometry args={[JOINT_SECTION, JOINT_SECTION, JOINT_SECTION]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveStrength > 0 ? ACCENT_LIME : "#000000"}
        emissiveIntensity={emissiveStrength}
        roughness={0.45}
        metalness={0.3}
      />
    </mesh>
  );
}

interface SlabProps {
  readonly position: Vec3Tuple;
  readonly width: number;
  readonly depth: number;
}

function Slab({ position, width, depth }: SlabProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
      <meshStandardMaterial color={SLAB_GREY} transparent opacity={0.08} />
    </mesh>
  );
}

interface EnvelopeProps {
  readonly position: Vec3Tuple;
  readonly width: number;
  readonly height: number;
  readonly axis: "x" | "z";
}

function EnvelopePanel({ position, width, height, axis }: EnvelopeProps) {
  const args: [number, number, number] =
    axis === "x" ? [width, height, 0.04] : [0.04, height, width];
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={ENVELOPE_FROST}
        transparent
        opacity={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface PulsePointProps {
  readonly position: Vec3Tuple;
  readonly delay: number;
  readonly period: number;
}

function PulsePoint({ position, delay, period }: PulsePointProps) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useRef(delay);

  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime - start.current) % period;
    if (t < 1.0) {
      const phase = t / 1.0;
      // Tiny twinkle: scale 0.4 -> 1.4, opacity 0.95 -> 0
      const scale = 0.4 + phase * 1.0;
      const opacity = (1 - phase) * 0.95;
      ref.current.scale.setScalar(scale);
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity;
      ref.current.visible = true;
    } else {
      ref.current.visible = false;
    }
  });

  return (
    // Tiny base sphere — radius 0.06m, twinkle stays well under 0.2m diameter at peak
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.06, 12, 12]} />
      <meshBasicMaterial color={ACCENT_LIME} transparent />
    </mesh>
  );
}

function PrefabFrame({ reducedMotion }: { readonly reducedMotion: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const totalHeight = STORIES * STORY_HEIGHT;
  const colXs = useMemo(
    () => Array.from({ length: COLS_X }, (_, i) => (i - (COLS_X - 1) / 2) * SPAN_X),
    [],
  );
  const colZs = useMemo(
    () => Array.from({ length: COLS_Z }, (_, i) => (i - (COLS_Z - 1) / 2) * SPAN_Z),
    [],
  );
  const widthX = SPAN_X * (COLS_X - 1);
  const widthZ = SPAN_Z * (COLS_Z - 1);

  const columns = useMemo(
    () => colXs.flatMap((x) => colZs.map((z) => ({ id: `c-${x}-${z}`, x, z }))),
    [colXs, colZs],
  );

  const pulsePoints = useMemo<Array<{ pos: Vec3Tuple; delay: number; period: number }>>(() => {
    if (reducedMotion) return [];
    return [
      { pos: [colXs[0]!, STORY_HEIGHT * 1, colZs[0]!], delay: 0, period: 7 },
      { pos: [colXs[1]!, STORY_HEIGHT * 2, colZs[2]!], delay: 1.4, period: 7 },
      { pos: [colXs[3]!, STORY_HEIGHT * 3, colZs[1]!], delay: 2.8, period: 7 },
      { pos: [colXs[2]!, STORY_HEIGHT * 4, colZs[0]!], delay: 4.2, period: 7 },
      { pos: [colXs[0]!, STORY_HEIGHT * 2, colZs[2]!], delay: 5.6, period: 7 },
    ];
  }, [colXs, colZs, reducedMotion]);

  const handleHover = (id: string | null) => setHovered(id);
  const handleSelect = (id: string, _kind: SelectableKind) => {
    setSelected((prev) => (prev === id ? null : id));
  };

  return (
    <group
      position={[MODEL_SHIFT_X, 0, 0]}
      onPointerMissed={() => setSelected(null)}
    >
      {/* Columns */}
      {columns.map(({ id, x, z }) => (
        <Column
          key={id}
          id={id}
          position={[x, totalHeight / 2, z]}
          height={totalHeight}
          hovered={hovered === id}
          selected={selected === id}
          onHover={handleHover}
          onSelect={handleSelect}
        />
      ))}

      {/* Beams + Joints + Slabs per story */}
      {Array.from({ length: STORIES + 1 }).map((_, story) => {
        const y = story * STORY_HEIGHT;
        return (
          <group key={`story-${story}`}>
            {colZs.map((z) => {
              const id = `bx-${story}-${z}`;
              return (
                <Beam
                  key={id}
                  id={id}
                  axis="x"
                  length={widthX}
                  position={[0, y, z]}
                  hovered={hovered === id}
                  selected={selected === id}
                  onHover={handleHover}
                  onSelect={handleSelect}
                />
              );
            })}
            {colXs.map((x) => {
              const id = `bz-${story}-${x}`;
              return (
                <Beam
                  key={id}
                  id={id}
                  axis="z"
                  length={widthZ}
                  position={[x, y, 0]}
                  hovered={hovered === id}
                  selected={selected === id}
                  onHover={handleHover}
                  onSelect={handleSelect}
                />
              );
            })}
            {colXs.flatMap((x) =>
              colZs.map((z) => {
                const id = `j-${story}-${x}-${z}`;
                return (
                  <Joint
                    key={id}
                    id={id}
                    position={[x, y, z]}
                    hovered={hovered === id}
                    selected={selected === id}
                    onHover={handleHover}
                    onSelect={handleSelect}
                  />
                );
              }),
            )}
            {story > 0 ? (
              <Slab
                position={[0, y - SLAB_THICKNESS / 2, 0]}
                width={widthX + COL_SECTION}
                depth={widthZ + COL_SECTION}
              />
            ) : null}
          </group>
        );
      })}

      {/* Envelope panels — back (z = -widthZ/2) + one side (x = -widthX/2) */}
      <EnvelopePanel
        position={[0, totalHeight / 2, -widthZ / 2 - 0.05]}
        width={widthX}
        height={totalHeight}
        axis="x"
      />
      <EnvelopePanel
        position={[-widthX / 2 - 0.05, totalHeight / 2, 0]}
        width={widthZ}
        height={totalHeight}
        axis="z"
      />

      {pulsePoints.map((p, i) => (
        <PulsePoint key={`pulse-${i}`} position={p.pos} delay={p.delay} period={p.period} />
      ))}
    </group>
  );
}

export function LandingHero3D() {
  const reducedMotion = useReducedMotion();

  const totalHeight = STORIES * STORY_HEIGHT;
  // Target = building center → autoRotate spins around the building itself.
  const target: Vec3Tuple = [0, totalHeight / 2, 0];
  const cameraTilt = THREE.MathUtils.degToRad(15);
  const cameraDistance = 30;
  const cameraY = totalHeight / 2 + Math.sin(cameraTilt) * cameraDistance;
  const cameraXZ = Math.cos(cameraTilt) * cameraDistance;

  return (
    <Canvas
      data-testid="hero-3d-canvas"
      camera={{ position: [cameraXZ, cameraY, cameraXZ], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 16, 8]} intensity={0.95} color="#FFFFFF" />
      <directionalLight position={[-8, 6, -10]} intensity={0.4} color="#A8C8FF" />

      {/* Infinite grid spans full canvas width — brightened so floor lines
          are clearly visible against the dark hero background. */}
      <Grid
        position={[0, 0, 0]}
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

      <PrefabFrame reducedMotion={reducedMotion} />

      {/*
        OrbitControls with autoRotate ALWAYS on (unless reduce-motion).
        User drags concurrently — drei merges user delta + autoRotate delta
        each frame, so dragging never stops the rotation; releasing keeps the
        new orbit angle continuing to rotate.
      */}
      {/*
        - enableZoom=false → wheel scrolls the page, not the model
        - maxPolarAngle ≈ 88° → camera can't tilt below ground (grid stays floor)
        - minPolarAngle 5° → can't look straight down either
        - autoRotate around target = building center (true self-rotation)
      */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        target={target}
        minPolarAngle={THREE.MathUtils.degToRad(5)}
        maxPolarAngle={THREE.MathUtils.degToRad(88)}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.45}
      />
    </Canvas>
  );
}
