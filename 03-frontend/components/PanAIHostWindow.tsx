// components/PanAIHostWindow.tsx - PanAI surface hosted by ArchIToken
// License: Apache-2.0
"use client";

import { useMemo } from "react";
import { FloatingWindowFrame } from "@/components/FloatingWindowFrame";
import { resolvePanAINativeUrl } from "@/lib/panai-native-url";
import type { ModuleSpec } from "@/lib/module-registry";

export function PanAIHostWindow({
  module,
  minimized,
  onMinimize,
  onClose,
}: {
  module: ModuleSpec;
  minimized?: boolean;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const nativeUrl = useMemo(
    () =>
      resolvePanAINativeUrl({
        configuredUrl: process.env.NEXT_PUBLIC_PANAI_NATIVE_URL,
        location:
          typeof window === "undefined"
            ? undefined
            : {
                protocol: window.location.protocol,
                hostname: window.location.hostname,
              },
      }),
    [],
  );
  return (
    <FloatingWindowFrame
      title="PanAI"
      subtitle={module.zhName}
      icon={
        <span
          aria-hidden="true"
          className="block h-5 w-5 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/assets/logo-mark.svg")' }}
        />
      }
      onClose={onClose}
      onMinimize={onMinimize}
      hidden={minimized ?? false}
      defaultSize={{ width: 1360, height: 860 }}
      minSize={{ width: 360, height: 360 }}
      placement="center"
      defaultViewportRatio={0.92}
      zIndex={140}
      bodyClassName="p-0"
    >
      <div className="relative h-full w-full overflow-hidden bg-white">
        <iframe
          src={nativeUrl}
          title="PanAI"
          className="h-full w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; fullscreen; microphone; camera; display-capture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </FloatingWindowFrame>
  );
}
