// components/PanAIControlClient.tsx - Native PanAI Control UI host
// License: Apache-2.0
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ModuleId } from '@/lib/module-registry';

export type PanAIControlClientProps = {
  moduleId: ModuleId;
  moduleName: string;
  selectedFeatureTitle?: string;
  auditEventCount?: number;
  surface?: string;
  assistant?: string;
  sourcePath?: string;
};

export function PanAIControlClient({
  moduleId,
  moduleName,
  selectedFeatureTitle,
  auditEventCount = 0,
  surface = 'module_workbench',
  assistant = 'architoken',
  sourcePath,
}: PanAIControlClientProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => {
    const params = new URLSearchParams({
      hostProject: 'architoken',
      hostModule: moduleId,
      hostModuleName: moduleName,
      hostSurface: surface,
      hostAssistant: assistant,
      hostBridge: 'panai-host-v1',
    });

    if (selectedFeatureTitle) {
      params.set('hostFeature', selectedFeatureTitle);
    }
    if (sourcePath) {
      params.set('hostSourcePath', sourcePath);
    }
    if (auditEventCount > 0) {
      params.set('hostAuditCount', String(auditEventCount));
    }

    return `/api/panai/ui/?${params.toString()}`;
  }, [assistant, auditEventCount, moduleId, moduleName, selectedFeatureTitle, sourcePath, surface]);

  const context = useMemo(
    () => ({
      moduleId,
      moduleName,
      selectedFeature: selectedFeatureTitle ?? '',
      auditEventCount,
      surface,
      assistant,
      sourcePath: sourcePath ?? '',
    }),
    [assistant, auditEventCount, moduleId, moduleName, selectedFeatureTitle, sourcePath, surface],
  );

  const publishContext = useCallback(() => {
    const frameWindow = frameRef.current?.contentWindow;
    if (!frameWindow) return;

    try {
      const target = frameWindow as typeof frameWindow & {
        __PANAI_HOST_CONTEXT__?: Record<string, unknown>;
        __ARCHITOKEN_OPENCLAW_CONTEXT__?: Record<string, unknown>;
      };
      target.__PANAI_HOST_CONTEXT__ = {
        ...(target.__PANAI_HOST_CONTEXT__ ?? {}),
        ...context,
      };
      target.__ARCHITOKEN_OPENCLAW_CONTEXT__ = {
        ...(target.__ARCHITOKEN_OPENCLAW_CONTEXT__ ?? {}),
        ...context,
      };
      frameWindow.localStorage.setItem('panai.host.context', JSON.stringify(context));
      frameWindow.localStorage.setItem('architoken.openclaw.context', JSON.stringify(context));
      frameWindow.postMessage({ type: 'PANAI_HOST_CONTEXT', payload: context }, window.location.origin);
      frameWindow.postMessage({ type: 'ARCHITOKEN_OPENCLAW_CONTEXT', payload: context }, window.location.origin);
    } catch {
      // The proxied PanAI page is same-origin; this keeps the host resilient if the upstream changes.
    }
  }, [context]);

  useEffect(() => {
    publishContext();
  }, [publishContext]);

  return (
    <iframe
      ref={frameRef}
      key={`${moduleId}:${selectedFeatureTitle ?? ''}`}
      title={`PanAI Control - ${moduleName}`}
      src={src}
      className="h-full min-h-[520px] w-full border-0 bg-[var(--arch-surface)]"
      allow="clipboard-read; clipboard-write; fullscreen"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
      onLoad={publishContext}
    />
  );
}
