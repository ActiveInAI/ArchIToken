// app/app/digital-twin/page.tsx - Digital Twin module entry
// License: Apache-2.0

import type { Metadata } from 'next';
import { DigitalTwinWorkbench } from '@/components/DigitalTwinWorkbench';

export const metadata: Metadata = {
  title: '数字孪生工作台',
  description:
    'ArchIToken digital twin module with editable scene tree, Gaussian Splatting reality layer, IFC semantics, IoT/SCADA streams, and export gates.',
};

export default function DigitalTwinPage() {
  return <DigitalTwinWorkbench />;
}

