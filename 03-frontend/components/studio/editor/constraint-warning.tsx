"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { checkAllConstraints, type ConstraintViolation } from "@/lib/insome/core";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

/**
 * Global violation counter — floats in editor-shell top-right. Hover shows
 * per-violation details. Warnings only, never block; submission is still
 * allowed (per Phase 4.0 design decision: demo users shouldn't be locked out).
 */
export function ConstraintWarningBadge() {
  const t = useTranslations();
  const fp = useStudioEditorStore((s) => s.activeFloorplan);
  const result = useMemo(() => (fp ? checkAllConstraints(fp) : { passed: true, violations: [] }), [fp]);
  if (result.violations.length === 0) return null;
  return (
    <div
      className="group relative"
      aria-live="polite"
    >
      <button
        type="button"
        className="border border-accent-signal bg-fg-0 px-2 py-1 font-mono text-micro tracking-eyebrow uppercase text-accent-signal"
      >
        ⚠ {t("constraint.summary.count", { count: result.violations.length })}
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden min-w-[280px] border border-fg-2 bg-fg-0 p-3 text-small text-fg-8 shadow-xl group-hover:block group-focus-within:block">
        <div className="mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {t("constraint.summary.details")}
        </div>
        <ul className="space-y-1.5">
          {result.violations.map((v, i) => (
            <li key={i} className="text-micro text-fg-8">
              <span className="mr-2 text-accent-signal">⚠</span>
              {t(v.labelKey, (v.details ?? {}) as Record<string, number>)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Inline warning strip for a single Properties field. Consumer passes a
 * `check` function that returns the violations relevant to that field.
 */
export function ConstraintInlineHint({
  violations,
}: {
  readonly violations: ReadonlyArray<ConstraintViolation>;
}) {
  const t = useTranslations();
  if (violations.length === 0) return null;
  return (
    <div className="mt-1 font-mono text-micro text-accent-signal" role="alert">
      {violations.map((v, i) => (
        <div key={i}>
          ⚠ {t(v.labelKey, (v.details ?? {}) as Record<string, number>)}
        </div>
      ))}
    </div>
  );
}
