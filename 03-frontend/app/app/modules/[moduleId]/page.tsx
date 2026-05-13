// app/app/modules/[moduleId]/page.tsx - ArchIToken module detail route
// License: Apache-2.0

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { BusinessModuleWorkbench } from '@/components/BusinessModuleWorkbench';
import { getModuleSpec, normalizeModuleId } from '@/lib/module-registry';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}): Promise<Metadata> {
  const { moduleId } = await params;
  const normalized = normalizeModuleId(moduleId);

  if (!normalized) {
    return { title: '模块不存在' };
  }

  const spec = getModuleSpec(normalized);
  return {
    title: `${spec.zhName} · 业务模块`,
    description: `${spec.zhName} operational workbench: ${spec.summary}`,
  };
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const normalized = normalizeModuleId(moduleId);

  if (!normalized) {
    notFound();
  }

  const cookieStore = await cookies();
  const initialRailExpanded = cookieStore.get('architoken.moduleRailExpanded')?.value === 'true';

  return <BusinessModuleWorkbench initialModuleId={normalized} initialRailExpanded={initialRailExpanded} />;
}
