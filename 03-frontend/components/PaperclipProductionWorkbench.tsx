// components/PaperclipProductionWorkbench.tsx - Paperclip-backed production module surface
// License: Apache-2.0
'use client';

import { Activity, ExternalLink, Factory, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import type { ModuleSpec } from '@/lib/module-registry';

export function PaperclipProductionWorkbench({
  spec,
  onAudit,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [paperclipOrigin, setPaperclipOrigin] = useState(
    process.env.NEXT_PUBLIC_PAPERCLIP_PUBLIC_URL ?? '',
  );

  useEffect(() => {
    if (paperclipOrigin || typeof window === 'undefined') {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setPaperclipOrigin(`${window.location.protocol}//${window.location.hostname}:3111`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [paperclipOrigin]);

  const paperclipSrc = useMemo(() => {
    const params = new URLSearchParams({
      architokenModule: spec.id,
      architokenModuleName: spec.zhName,
      architokenRole: 'production_manufacturing',
      architokenRelease: 'v2026.517.0',
    });
    const url = new URL('/', paperclipOrigin || 'http://127.0.0.1:3111');
    url.search = params.toString();
    return url.toString();
  }, [paperclipOrigin, spec.id, spec.zhName]);

  function record(summary: string) {
    onAudit?.(createModuleAuditEvent('production-paperclip', 'PaperclipProductionWorkbench', summary));
  }

  function reloadPaperclip() {
    setReloadKey((current) => current + 1);
    record('生产制造: 重新加载 Paperclip v2026.517.0 控制台');
  }

  return (
    <section className="arch-surface flex h-full min-h-0 flex-col overflow-hidden border-0">
      <header className="flex shrink-0 flex-col gap-2 border-b bg-[var(--arch-surface)] px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--arch-primary-soft)] text-[var(--arch-primary)]">
            <Factory className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="arch-primary-text shrink-0 arch-type-caption font-medium">Paperclip</span>
              <h2 className="arch-text truncate arch-type-title font-medium">
                生产制造
              </h2>
              <span className="arch-chip rounded-md px-2 py-1 arch-type-caption font-medium">
                v2026.517.0
              </span>
            </div>
            <p className="arch-muted truncate arch-type-caption">
              Paperclip 完整接管本模块主工作区；CNC/QC/MES/ERP 放行仍回写 ArchIToken 审计与审批链。
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="arch-chip inline-flex items-center gap-1 rounded-md px-2 py-1 arch-type-caption font-medium">
            <Activity className="h-3.5 w-3.5" />
            Agent / Issue / Heartbeat / Budget
          </span>
          <span className="arch-chip inline-flex items-center gap-1 rounded-md px-2 py-1 arch-type-caption font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Router + Approver
          </span>
          <button
            type="button"
            onClick={reloadPaperclip}
            className="arch-btn inline-flex items-center gap-1 rounded-md px-2 py-1.5 arch-type-caption font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
          <a
            href={paperclipSrc}
            target="_blank"
            rel="noreferrer"
            className="arch-btn inline-flex items-center gap-1 rounded-md px-2 py-1.5 arch-type-caption font-medium"
            onClick={() => record('生产制造: 新窗口打开 Paperclip 控制台')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            新窗口
          </a>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-[#0b1020]">
        <iframe
          key={`${paperclipSrc}:${reloadKey}`}
          src={paperclipSrc}
          title="Paperclip Production Manufacturing"
          className="h-full w-full border-0 bg-[#0b1020]"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer"
          onLoad={() => record('生产制造: Paperclip 控制台已加载')}
        />
      </div>
    </section>
  );
}
