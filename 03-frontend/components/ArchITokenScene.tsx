// components/ArchITokenScene.tsx — ArchIToken 3D business-chain backdrop
// License: Apache-2.0
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const tokenNodes: Array<[number, number, number]> = [
  [-5.8, -1.6, -1.2],
  [-3.5, 0.8, 0.4],
  [-0.8, -0.2, -0.2],
  [1.8, 1.1, 0.8],
  [4.6, -0.7, -0.5],
  [6.2, 1.5, 0.6],
];

function ArchAsset() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const columns = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const col = index % 6;
        const row = Math.floor(index / 6);
        return {
          position: [col * 0.64 - 1.6, row * 0.62 - 0.4, (row % 2) * 0.5 - 0.25] as [
            number,
            number,
            number,
          ],
          height: 0.75 + ((index * 7) % 5) * 0.14,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.22) * 0.18 - 0.28;
      group.current.position.y = Math.sin(t * 0.5) * 0.08;
    }
    if (ring.current) {
      ring.current.rotation.z = t * 0.28;
      ring.current.rotation.x = Math.PI / 2.8;
    }
  });

  return (
    <group ref={group} position={[1.4, -0.4, 0]}>
      <mesh position={[0, -0.95, 0]} receiveShadow>
        <boxGeometry args={[5.2, 0.12, 3.4]} />
        <meshStandardMaterial color="#d8ddd3" roughness={0.72} metalness={0.08} />
      </mesh>

      {columns.map((column, index) => (
        <mesh
          key={`${column.position.join('-')}-${index}`}
          position={[column.position[0], column.position[1], column.position[2]]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.26, column.height, 0.26]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? '#18a058' : index % 3 === 1 ? '#2e6f95' : '#f07836'}
            roughness={0.48}
            metalness={0.16}
          />
        </mesh>
      ))}

      <mesh ref={ring} position={[0.1, 0.45, 0]}>
        <torusGeometry args={[2.55, 0.025, 16, 96]} />
        <meshStandardMaterial color="#111817" emissive="#18a058" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={[0.1, 0.45, 0]}>
        <torusGeometry args={[1.75, 0.018, 16, 96]} />
        <meshStandardMaterial color="#f07836" emissive="#f07836" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}

function TokenChain() {
  const chain = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(tokenNodes.map((p) => new THREE.Vector3(...p))), []);
  const points = useMemo(() => curve.getPoints(80), [curve]);

  useFrame(({ clock }) => {
    if (chain.current) {
      chain.current.position.x = Math.sin(clock.getElapsedTime() * 0.32) * 0.08;
    }
  });

  return (
    <group ref={chain}>
      <line>
        <bufferGeometry attach="geometry" setFromPoints={points} />
        <lineBasicMaterial attach="material" color="#1f6d7a" linewidth={1} />
      </line>

      {tokenNodes.map((node, index) => (
        <mesh key={node.join('-')} position={node} castShadow>
          <sphereGeometry args={[index === 2 ? 0.18 : 0.13, 24, 24]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? '#18a058' : '#f07836'}
            emissive={index % 2 === 0 ? '#0f7d45' : '#c6511d'}
            emissiveIntensity={0.2}
            roughness={0.36}
            metalness={0.38}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.5, 8.6]} fov={40} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} castShadow />
      <pointLight position={[-5, 2, 3]} intensity={1.2} color="#18a058" />
      <pointLight position={[5, -1, 4]} intensity={0.85} color="#f07836" />
      <TokenChain />
      <ArchAsset />
    </>
  );
}

export function ArchITokenScene() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.8]}
        shadows
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 2.5, 8.6], fov: 40 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
