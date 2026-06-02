// components/GlobalPanAIDock.tsx - Global PanAI control dock
// License: Apache-2.0
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Bot, Network, PanelRightOpen } from 'lucide-react';
import { FloatingWindowFrame } from '@/components/FloatingWindowFrame';
import { PanAIControlClient } from '@/components/PanAIControlClient';
import {
  getModuleSpec,
  normalizeModuleId,
  type ModuleId,
} from '@/lib/module-registry';

export function GlobalPanAIDock() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const context = useMemo(() => resolveGlobalPanAIContext(pathname, searchParams), [pathname, searchParams]);
  const [open, setOpen] = useState(false);

  function setDockOpen(next: boolean) {
    setOpen(next);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setDockOpen(true)}
        className="arch-btn-primary fixed bottom-5 right-5 z-[80] flex h-12 w-12 items-center justify-center rounded-md shadow-lg"
        aria-label="打开 PanAI 全局控制台"
        title="PanAI 全局控制台"
      >
        <Network className="h-5 w-5" />
      </button>
    );
  }

  return (
    <FloatingWindowFrame
      title="PanAI"
      eyebrow="全局控制台"
      subtitle={context.subtitle}
      icon={<Bot className="h-5 w-5" />}
      onClose={() => setDockOpen(false)}
      defaultSize={{ width: 1180, height: 780 }}
      minSize={{ width: 680, height: 520 }}
      placement="center"
      zIndex={80}
      bodyClassName="p-0 overflow-hidden"
      defaultViewportRatio={0.78}
      footer={
        <div className="flex min-w-0 items-center gap-2 arch-type-caption">
          <PanelRightOpen className="arch-primary-text h-4 w-4 shrink-0" />
          <span className="arch-muted truncate">
            {context.surfaceLabel} · {context.sourcePath || '/'}
          </span>
        </div>
      }
      footerClassName="px-3 py-2"
    >
      <PanAIControlClient
        moduleId={context.moduleId}
        moduleName={context.moduleName}
        selectedFeatureTitle={context.selectedFeatureTitle}
        surface={context.surface}
        sourcePath={context.sourcePath}
      />
    </FloatingWindowFrame>
  );
}

function resolveGlobalPanAIContext(pathname: string, searchParams: { get: (name: string) => string | null }) {
  const moduleId = moduleIdFromPath(pathname) ?? normalizeModuleId(searchParams.get('module') ?? '') ?? 'ai_center';
  const spec = getModuleSpec(moduleId);
  const surface = surfaceFromPath(pathname);
  const surfaceLabel = surfaceLabelFor(surface);
  const selectedFeatureTitle = surface === 'module_workbench' ? spec.zhName : surfaceLabel;

  return {
    moduleId,
    moduleName: spec.zhName,
    selectedFeatureTitle,
    surface,
    surfaceLabel,
    sourcePath: pathname,
    subtitle: `${spec.zhName} · ${surfaceLabel}`,
  };
}

function moduleIdFromPath(pathname: string): ModuleId | null {
  const match = pathname.match(/^\/app\/modules\/([^/?#]+)/);
  return normalizeModuleId(match?.[1] ?? '');
}

function surfaceFromPath(pathname: string): string {
  if (pathname.startsWith('/app/modules')) return 'module_workbench';
  if (pathname.startsWith('/app/projects')) return 'project_workbench';
  if (pathname.startsWith('/app/dev')) return 'developer_workbench';
  if (pathname.startsWith('/studio')) return 'studio_workbench';
  if (pathname.startsWith('/home')) return 'home_workbench';
  if (pathname.startsWith('/project')) return 'project_workspace';
  return 'global_shell';
}

function surfaceLabelFor(surface: string): string {
  const labels: Record<string, string> = {
    module_workbench: '业务模块工作台',
    project_workbench: '项目工作台',
    developer_workbench: '开发工作台',
    studio_workbench: '设计工作台',
    home_workbench: '主页工作台',
    project_workspace: '项目空间',
    global_shell: '全局 Shell',
  };
  return labels[surface] ?? '全局 Shell';
}
