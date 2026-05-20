"use client";

import { AnimatePresence, motion } from "motion/react";
import { useHeroModelStore } from "@/stores/hero-model.store";

export function HeroPartInfoPanel() {
  const info = useHeroModelStore((s) => s.selectedInfo);
  const setSelected = useHeroModelStore((s) => s.setSelected);

  return (
    <AnimatePresence>
      {info ? (
        <motion.div
          key={info.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          data-testid="hero-part-info-panel"
          className="pointer-events-auto absolute bottom-6 right-6 z-30 min-w-[280px] rounded-lg border-l-2 border-accent-lime bg-black/70 p-5 backdrop-blur-md"
        >
          <button
            type="button"
            aria-label="close"
            onClick={() => setSelected(null)}
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center text-fg-5 transition-colors hover:text-fg-9"
          >
            ×
          </button>

          <div className="pr-6">
            <div
              className="font-display text-h4 font-semibold text-fg-9"
              title={info.name}
            >
              {info.name}
            </div>
            <div className="mt-1 font-mono text-micro tracking-eyebrow text-[#666]">
              UUID · {info.uuid.slice(-6)}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 font-mono text-micro tracking-eyebrow uppercase">
            <div>
              <div className="text-[#666]">SIZE (m)</div>
              <div className="mt-1 text-fg-9">
                {info.size[0]!.toFixed(2)} × {info.size[1]!.toFixed(2)} ×{" "}
                {info.size[2]!.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[#666]">TRIANGLES</div>
              <div className="mt-1 text-fg-9">
                {info.triangles.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[#666]">VERTICES</div>
              <div className="mt-1 text-fg-9">
                {info.vertices.toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
