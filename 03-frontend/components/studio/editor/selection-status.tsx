"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

/**
 * Visually hidden live region that announces selection changes to screen
 * readers. Studio-only.
 */
export function SelectionStatus() {
  const t = useTranslations("a11y.selection");
  const selection = useStudioEditorStore((s) => s.selection);

  const message = useMemo(() => {
    if (!selection) return t("none");
    if (selection.kind === "wall") return t("wall", { id: selection.id });
    if (selection.kind === "room") return t("room", { id: selection.id });
    if (selection.kind === "opening") return t("opening", { id: selection.id });
    return "";
  }, [selection, t]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="sr-only"
    >
      {message}
    </div>
  );
}
