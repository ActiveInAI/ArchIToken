"use client";

import { useState, type ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTranslations } from "next-intl";

export type ErrorBoundaryScope = "app" | "workspace" | "editor" | "scene";

export interface ErrorBoundaryProps {
  readonly scope: ErrorBoundaryScope;
  readonly children: ReactNode;
}

export function ErrorBoundary({ scope, children }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => <ErrorFallback {...props} scope={scope} />}
      onError={(error, info) => {
        console.error(`[insome:${scope}]`, error, info);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

function ErrorFallback({
  error,
  resetErrorBoundary,
  scope,
}: FallbackProps & { scope: ErrorBoundaryScope }) {
  const t = useTranslations("error.boundary");
  const [showDetails, setShowDetails] = useState(false);
  const isDev = process.env.NODE_ENV === "development";
  const titleKey = scope === "scene" ? "3dTitle" : "title";
  const descKey = scope === "scene" ? "3dDescription" : "description";

  return (
    <div
      role="alert"
      className="flex h-full w-full items-center justify-center bg-fg-0 p-8"
    >
      <div className="max-w-[48ch] border border-fg-2 bg-fg-1 p-6">
        <div className="mb-3 font-display text-h3 font-bold tracking-tight text-fg-8">
          {t(titleKey)}
        </div>
        <p className="mb-5 text-small text-fg-4">{t(descKey)}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetErrorBoundary}
            className="border border-accent-signal bg-accent-signal px-4 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-9 transition-opacity hover:opacity-90"
          >
            {t("reload")}
          </button>
          {isDev ? (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="font-mono text-micro tracking-eyebrow uppercase text-fg-4 hover:text-fg-8"
            >
              {t("details")}
            </button>
          ) : null}
        </div>
        {showDetails && isDev ? (
          <pre className="mt-4 max-h-48 overflow-auto border border-fg-2 bg-fg-0 p-3 text-micro text-fg-4">
            {error instanceof Error ? (error.stack ?? error.message) : String(error)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
