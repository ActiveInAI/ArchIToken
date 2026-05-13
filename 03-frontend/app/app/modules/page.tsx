// app/app/modules/page.tsx - ArchIToken business module workbench entry
// License: Apache-2.0

import type { Metadata } from 'next';
import { BusinessModuleWorkbench } from '@/components/BusinessModuleWorkbench';
import { normalizeModuleId } from '@/lib/module-registry';

export const metadata: Metadata = {
  title: '业务模块工作台',
  description:
    'ArchIToken 14-module operational workbench for marketing, concept design, standard library, detailed design, costing, logistics, production manufacturing, construction supervision, digital twin, archive, and settings.',
};

export default async function ModulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialModuleId = normalizeModuleId(resolvedSearchParams.module ?? '') ?? 'marketing_service';

  return <BusinessModuleWorkbench initialModuleId={initialModuleId} />;
}
