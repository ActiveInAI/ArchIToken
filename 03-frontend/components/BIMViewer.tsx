// components/BIMViewer.tsx — IFC/BIM 3D 视口
// three.js 0.184.0 · @react-three/fiber 9.6.0 · @react-three/drei 10.7.7
// License: Apache-2.0
'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';

export interface BIMElement {
  id: string;
  type: 'wall' | 'floor' | 'beam' | 'column' | 'roof' | 'door' | 'window';
  geometry: {
    position: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number];
  };
  material: {
    color: string;
    metalness?: number;
    roughness?: number;
  };
  properties: Record<string, string | number | boolean>;
}

interface BIMViewerProps {
  elements: BIMElement[];
  onElementClick?: (element: BIMElement) => void;
  className?: string;
}

export function BIMViewer({ elements, onElementClick, className }: BIMViewerProps) {
  return (
    <div className={className ?? 'w-full h-[600px] border border-ink'}>
      <Canvas shadows gl={{ antialias: true, alpha: false }}>
        <color attach="background" args={['#1a1a1c']} />
        <PerspectiveCamera makeDefault position={[15, 12, 15]} fov={45} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2.1}
        />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Suspense fallback={null}>
          <Environment preset="city" background={false} />
          <Grid
            args={[50, 50]}
            cellSize={0.3}
            cellThickness={0.5}
            cellColor="#444"
            sectionSize={3}
            sectionThickness={1}
            sectionColor="#888"
            fadeDistance={30}
            fadeStrength={1}
            infiniteGrid
          />
          {elements.map((el) => (
            <BIMMesh
              key={el.id}
              element={el}
              onClick={() => onElementClick?.(el)}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

function BIMMesh({
  element,
  onClick,
}: {
  element: BIMElement;
  onClick: () => void;
}) {
  const geometry = useMemo(
    () => new THREE.BoxGeometry(...element.geometry.size),
    [element.geometry.size],
  );

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: element.material.color,
        metalness: element.material.metalness ?? 0.1,
        roughness: element.material.roughness ?? 0.75,
      }),
    [element.material],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={element.geometry.position}
      rotation={element.geometry.rotation ?? [0, 0, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}
