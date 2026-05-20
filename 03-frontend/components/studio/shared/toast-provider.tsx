"use client";

import { Toaster } from "sonner";

/**
 * Sonner Toaster wrapper with INSOME tokens. Rendered once at the top of
 * /studio; Home does not use toasts in Phase 2 (add there if needed later).
 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          borderRadius: 0,
          border: "1px solid var(--color-fg-2)",
          background: "var(--color-fg-0)",
          color: "var(--color-fg-8)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        },
      }}
    />
  );
}
