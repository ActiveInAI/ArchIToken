// app/app/modules/page.tsx - ArchIToken business module workbench entry
// License: Apache-2.0

import type { Metadata } from 'next';
import { BusinessModuleWorkbench } from '@/components/BusinessModuleWorkbench';

export const metadata: Metadata = {
  title: '业务模块工作台',
  description:
    'ArchIToken 11-module business workbench for marketing, concept design, standard library, detailed design, costing, logistics, manufacturing, construction supervision, digital twin, archive, and settings.',
};

export default function ModulesPage() {
  return <BusinessModuleWorkbench />;
}
