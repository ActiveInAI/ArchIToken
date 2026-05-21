// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
'use client';

import Link from 'next/link';
import {
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Archive,
  Bot,
  Boxes,
  BrainCircuit,
  Calculator,
  CalendarDays,
  ChevronLeft,
  Command,
  CreditCard,
  Factory,
  HardHat,
  Headphones,
  Library,
  Lightbulb,
  Menu,
  PencilRuler,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Workflow,
} from 'lucide-react';
import { FloatingWindowFrame } from '@/components/FloatingWindowFrame';
import { ModuleDetailWorkbench } from '@/components/ModuleDetailWorkbench';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import type { ModuleActionResult } from '@/lib/module-actions';
import {
  getModuleSpec,
  moduleSpecs,
  moduleStatusLabels,
  MODULE_TREE_GROUPS,
  type ModuleId,
} from '@/lib/module-registry';

const moduleAccentClasses = [
  'arch-module-accent-blue',
  'arch-module-accent-red',
  'arch-module-accent-yellow',
  'arch-module-accent-green',
  'arch-module-accent-purple',
  'arch-module-accent-cyan',
  'arch-module-accent-orange',
] as const;

export function ModuleWorkbenchShell({
  initialModuleId,
  initialRailExpanded = true,
}: {
  initialModuleId?: ModuleId;
  initialRailExpanded?: boolean;
}) {
  const fallbackModuleId = initialModuleId ?? 'construction_management';
  const [query, setQuery] = useState('');
  const [railExpanded, setRailExpanded] = useState(initialRailExpanded);
  const [railWidth, setRailWidth] = useState(248);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [selectedFeatureTitle, setSelectedFeatureTitle] = useState<string>('');

  function toggleModuleRail() {
    setRailExpanded((current) => {
      const next = !current;
      const serialized = String(next);
      document.cookie = `architoken.moduleRailExpanded=${serialized}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }
  const [auditEvents, setAuditEvents] = useState<ModuleActionResult['auditEvent'][]>([]);
  const selectedSpec = getModuleSpec(fallbackModuleId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = normalizedQuery
    ? moduleSpecs.filter((spec) =>
        [spec.id, spec.zhName, spec.enName, spec.summary, spec.track]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : moduleSpecs;
  const moduleById = new Map(moduleSpecs.map((spec) => [spec.id, spec] as const));

  function handleAudit(event: ModuleActionResult['auditEvent']) {
    setAuditEvents((current) => [event, ...current].slice(0, 12));
  }

  function startRailResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = railWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setRailWidth(clampNumber(startWidth + moveEvent.clientX - startX, 156, 440));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  const shellGridStyle = {
    '--module-context-template': railExpanded ? `${railWidth}px` : '0px',
  } as CSSProperties;

  return (
    <main className="arch-app h-[100dvh] w-screen overflow-hidden">
      <div
        className="grid h-full min-h-0 grid-cols-[44px_var(--module-context-template)_minmax(0,1fr)]"
        style={shellGridStyle}
      >
        <aside className="arch-huly-rail flex min-h-0 flex-col items-center border-r">
          <div className="flex h-12 shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={toggleModuleRail}
              className="arch-huly-icon-button"
              aria-expanded={railExpanded}
              aria-label={railExpanded ? '收起模块目录' : '展开模块目录'}
            >
              {railExpanded ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            <div className="grid gap-1">
              {moduleSpecs.map((spec) => (
                <Link
                  key={spec.id}
                  href={spec.routeHref}
                  prefetch={false}
                  title={`${spec.zhName} · ${spec.id}`}
                  className={`arch-huly-module-dot ${moduleAccentClass(spec.order)} ${
                    spec.id === selectedSpec.id ? 'is-active' : ''
                  }`}
                  aria-label={spec.zhName}
                >
                  <ModuleRailIcon moduleId={spec.id} />
                </Link>
              ))}
            </div>
          </nav>

          <div className="flex shrink-0 flex-col items-center gap-1 px-1 py-2">
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="arch-huly-icon-button"
              aria-label="打开 OpenClaw"
              title="OpenClaw"
            >
              <Bot className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              className="arch-huly-icon-button"
              aria-label="打开审计抽屉"
              title="审计"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <aside className={`arch-huly-context relative flex min-h-0 flex-col overflow-hidden border-r ${railExpanded ? '' : 'pointer-events-none'}`}>
          <div className="arch-huly-context-header">
            <div className="flex min-w-0 items-center gap-2">
              <span className="arch-huly-workspace-mark">A</span>
              <div className="min-w-0">
                <h1 className="arch-text truncate arch-type-body font-medium">ArchIToken</h1>
                <p className="arch-muted truncate arch-type-caption">Open CDE workbench</p>
              </div>
            </div>
            <Command className="arch-muted h-4 w-4 shrink-0" />
          </div>

          <div className="px-2 pb-2">
            <label className="arch-huly-search">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模块、工作流、标准"
                className="min-w-0 flex-1 bg-transparent arch-type-caption outline-none placeholder:opacity-60"
              />
            </label>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {normalizedQuery ? (
              <div className="grid gap-1">
                {filteredModules.map((spec) => (
                  <ModuleNavItem
                    key={spec.id}
                    spec={spec}
                    selected={spec.id === selectedSpec.id}
                    railExpanded={railExpanded}
                    accentClass={moduleAccentClass(spec.order)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {MODULE_TREE_GROUPS.map((group) => (
                  <section key={group.id} className="space-y-1">
                    <p className="arch-huly-group-label">{group.title}</p>
                    <div className="grid gap-1">
                      {group.modules.map((moduleId) => {
                        const spec = moduleById.get(moduleId);
                        if (!spec) return null;
                        return (
                          <ModuleNavItem
                            key={spec.id}
                            spec={spec}
                            selected={spec.id === selectedSpec.id}
                            railExpanded={railExpanded}
                            accentClass={moduleAccentClass(spec.order)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </nav>

          <div className="arch-huly-context-footer">
            <ThemeSwitcher />
          </div>
          {railExpanded ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整模块上下文栏宽度"
              onPointerDown={startRailResize}
              className="absolute inset-y-0 right-[-4px] z-20 hidden w-2 cursor-ew-resize touch-none lg:block"
              title="拖动调整模块上下文栏宽度"
            />
          ) : null}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="arch-app min-h-0 flex-1 overflow-hidden p-0">
            <ModuleDetailWorkbench
              key={selectedSpec.id}
              spec={selectedSpec}
              onAudit={handleAudit}
              onFeatureSelect={setSelectedFeatureTitle}
            />
          </div>
        </section>
      </div>

      {inspectorOpen ? (
        <InspectorDrawer selectedSpec={selectedSpec} auditEvents={auditEvents} onClose={() => setInspectorOpen(false)} />
      ) : null}

      <WorkbenchIntelligenceDialog
        selectedSpec={selectedSpec}
        selectedFeatureTitle={selectedFeatureTitle}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
      />
    </main>
  );
}

function ModuleRailIcon({ moduleId }: { moduleId: ModuleId }) {
  const className = 'h-4 w-4';
  const icons: Record<ModuleId, ReactNode> = {
    marketing_service: <Headphones className={className} />,
    planning_management: <CalendarDays className={className} />,
    concept_design: <Lightbulb className={className} />,
    standard_library: <Library className={className} />,
    detailed_design: <PencilRuler className={className} />,
    quantity_costing: <Calculator className={className} />,
    material_logistics: <Truck className={className} />,
    production_manufacturing: <Factory className={className} />,
    construction_management: <HardHat className={className} />,
    digital_twin: <Boxes className={className} />,
    digital_archive: <Archive className={className} />,
    finance_hr: <CreditCard className={className} />,
    ai_center: <BrainCircuit className={className} />,
    settings_center: <Settings className={className} />,
  };
  return icons[moduleId] ?? <Ruler className={className} />;
}

function ModuleNavItem({
  spec,
  selected,
  railExpanded,
  accentClass,
}: {
  spec: (typeof moduleSpecs)[number];
  selected: boolean;
  railExpanded: boolean;
  accentClass: string;
}) {
  return (
    <Link
      href={spec.routeHref}
      prefetch={false}
      title={`${spec.zhName} · ${spec.id}`}
      className={`arch-huly-nav-item ${accentClass} ${selected ? 'is-active' : ''} ${
        railExpanded ? 'grid-cols-[30px_1fr]' : 'grid-cols-1 justify-items-center'
      }`}
    >
      <span className={`arch-huly-nav-index ${selected ? 'is-active' : ''}`}>
        {String(spec.order).padStart(2, '0')}
      </span>
      {railExpanded ? (
        <span className="min-w-0">
          <span className="arch-huly-nav-title block truncate">{spec.zhName}</span>
          <span className="arch-huly-nav-code arch-muted mt-0.5 block truncate font-mono">
            {spec.id}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function moduleAccentClass(order: number): string {
  return moduleAccentClasses[(order - 1) % moduleAccentClasses.length] ?? moduleAccentClasses[0];
}

function InspectorDrawer({
  selectedSpec,
  auditEvents,
  onClose,
}: {
  selectedSpec: ReturnType<typeof getModuleSpec>;
  auditEvents: ModuleActionResult['auditEvent'][];
  onClose: () => void;
}) {
  return (
    <FloatingWindowFrame
      title="审计 / 模块上下文"
      eyebrow="审计"
      subtitle={selectedSpec.zhName}
      icon={<ShieldCheck className="h-4 w-4" />}
      onClose={onClose}
      defaultSize={{ width: 460, height: 720 }}
      minSize={{ width: 340, height: 420 }}
      placement="right"
      zIndex={66}
      bodyClassName="p-3"
    >
      <section className="arch-huly-row-muted rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Workflow className="arch-primary-text h-4 w-4" />
          <h3 className="arch-text font-medium">{selectedSpec.zhName}</h3>
        </div>
        <div className="mt-3 space-y-2">
          <InfoRow label="状态" value={moduleStatusLabels[selectedSpec.status]} />
          <InfoRow label="Schema" value={selectedSpec.schemaRef} />
          <InfoRow label="Track" value={selectedSpec.track} />
        </div>
      </section>

      <section className="arch-huly-row mt-3 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="arch-primary-text arch-type-caption font-medium">审计面板</p>
            <h3 className="arch-text mt-1 font-medium">操作审计</h3>
          </div>
          <ShieldCheck className="arch-primary-text h-5 w-5" />
        </div>
        <div className="mt-4 space-y-2">
          {auditEvents.length === 0 ? (
            <p className="arch-huly-row-muted rounded-lg border border-dashed p-4 arch-type-body leading-6">
              文件、生命周期、审批、artifact 和 AI 操作都会写入这里。
            </p>
          ) : (
            auditEvents.map((event) => (
              <div key={event.id} className="arch-huly-row-muted rounded-lg p-3">
                <p className="arch-text arch-type-body font-medium">{event.summary}</p>
                <p className="arch-muted mt-2 arch-type-caption">
                  {event.actor} · {event.at}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </FloatingWindowFrame>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-huly-row flex items-start justify-between gap-3 rounded-md px-3 py-2 arch-type-caption">
      <span className="arch-muted">{label}</span>
      <span className="arch-text max-w-[70%] break-words text-right font-medium">{value}</span>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function WorkbenchIntelligenceDialog({
  selectedSpec,
  selectedFeatureTitle,
  open,
  onOpenChange,
}: {
  selectedSpec: ReturnType<typeof getModuleSpec>;
  selectedFeatureTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const openClawSrc = buildOpenClawControlSrc(selectedSpec, selectedFeatureTitle);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="arch-btn-primary fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-md shadow-lg"
        aria-label="打开 ArchIToken"
        title="ArchIToken"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <FloatingWindowFrame
      title="ArchIToken"
      eyebrow="AI 业务系统"
      subtitle={selectedFeatureTitle || selectedSpec.zhName}
      icon={<Bot className="h-5 w-5" />}
      onClose={() => onOpenChange(false)}
      defaultSize={{ width: 1120, height: 760 }}
      minSize={{ width: 680, height: 520 }}
      placement="center"
      zIndex={70}
      bodyClassName="p-0 overflow-hidden"
      defaultViewportRatio={0.75}
    >
      <iframe
        key={openClawSrc}
        src={openClawSrc}
        title={`ArchIToken - ${selectedSpec.zhName}`}
        className="h-full min-h-[440px] w-full border-0 bg-black"
        allow="clipboard-read; clipboard-write"
        referrerPolicy="no-referrer"
      />
    </FloatingWindowFrame>
  );
}

function buildOpenClawControlSrc(
  selectedSpec: ReturnType<typeof getModuleSpec>,
  selectedFeatureTitle: string,
) {
  const params = new URLSearchParams({
    architokenModule: selectedSpec.id,
    architokenModuleName: selectedSpec.zhName,
  });

  if (selectedFeatureTitle) {
    params.set('architokenFeature', selectedFeatureTitle);
  }

  return `/api/openclaw/ui/?${params.toString()}`;
}
