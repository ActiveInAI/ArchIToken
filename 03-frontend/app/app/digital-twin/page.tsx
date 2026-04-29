// app/app/digital-twin/page.tsx - Digital Twin module entry
// License: Apache-2.0

import type { Metadata } from 'next';
import { DigitalTwinWorkbench } from '@/components/DigitalTwinWorkbench';

export const metadata: Metadata = {
  title: '重钢结构数字孪生指挥舱',
  description:
    'ArchIToken heavy steel digital twin cockpit with IFC4.3/MBD semantics, Gaussian Splatting reality capture, IoT/SCADA streams, shape-performance simulation, DDMRP process twin, quality gates, and editable handover packages.',
};

export default function DigitalTwinPage() {
  return <DigitalTwinWorkbench />;
}
