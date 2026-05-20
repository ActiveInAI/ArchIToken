import type { ReactElement } from "react";

/**
 * L1 default lighting rig.
 * No shadows (L1 keeps performance stable and avoids shadow-acne edge cases).
 * Not configurable via props — multi-preset lighting lands in L2 scene.
 */
export function DefaultLightingRig(): ReactElement {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#b1b1b1", 0.6]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
    </>
  );
}
