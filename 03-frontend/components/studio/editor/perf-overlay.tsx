"use client";

import { useEffect, useState } from "react";

/**
 * Dev-only FPS counter for Studio 3D. Pure requestAnimationFrame sampling —
 * no R3F hook dependency, so it can live outside <Canvas>.
 *
 * NOTE(phase-4-devtools): when devtools pane lands, upgrade to drei <Stats>
 * with MS / MEM inside the Canvas tree.
 */
export function PerfOverlay() {
  const [fps, setFps] = useState<number>(0);
  const enabled = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let lastTime = performance.now();
    let frames = 0;
    let acc = 0;
    const tick = () => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      frames++;
      acc += dt;
      if (acc >= 500) {
        setFps(Math.round((frames * 1000) / acc));
        frames = 0;
        acc = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;
  const color = fps >= 50 ? "#D4FF3A" : fps >= 30 ? "#FFD36B" : "#FF4B1F";
  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-10 border border-fg-2 bg-fg-0 px-2 py-1 font-mono text-[10px] tracking-eyebrow uppercase"
      style={{ color }}
    >
      {fps} fps
    </div>
  );
}
