// lib/design-system-registry.ts - PanUI frontend design-system baseline
// License: Apache-2.0

export type DesignSystemPackageRole =
  | 'runtime_component'
  | 'runtime_icon'
  | 'runtime_chart'
  | 'runtime_ai_component'
  | 'runtime_token'
  | 'runtime_mobile'
  | 'developer_tool'
  | 'reference';

export type DesignSystemPackageState =
  | 'selected'
  | 'selected_version_pinned'
  | 'reference_only'
  | 'developer_tool_only';

export interface DesignSystemPackage {
  name: string;
  sourceUrl: string;
  role: DesignSystemPackageRole;
  state: DesignSystemPackageState;
  license: 'Apache-2.0' | 'MIT' | 'license_required';
  note: string;
}

export const activeDesignSystemId = 'pan_ui';

export const archDesignSystemStorageKey = 'architoken_design_system';

export const panUiRuntimePackages = [
  {
    name: 'PanUI',
    sourceUrl: 'https://github.com/ActiveInAI/PanUI',
    role: 'runtime_component',
    state: 'selected_version_pinned',
    license: 'Apache-2.0',
    note: 'Primary AI Native component primitive system for ArchIToken web workbench and React Native parity.',
  },
  {
    name: 'react',
    sourceUrl: 'https://github.com/facebook/react',
    role: 'runtime_component',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'Web UI runtime for PanUI and the Next.js workbench.',
  },
  {
    name: 'react-native',
    sourceUrl: 'https://github.com/facebook/react-native',
    role: 'runtime_mobile',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'Mobile renderer target for PanUI parity; mobile packages are added in the mobile workspace, not forced into the Next.js bundle.',
  },
  {
    name: 'tailwindcss',
    sourceUrl: 'https://github.com/tailwindlabs/tailwindcss',
    role: 'runtime_token',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'Token and utility styling layer for the web implementation of PanUI.',
  },
  {
    name: 'lucide-react',
    sourceUrl: 'https://github.com/lucide-icons/lucide',
    role: 'runtime_icon',
    state: 'selected',
    license: 'MIT',
    note: 'Default icon source for PanUI web controls and workbench actions.',
  },
  {
    name: 'd3',
    sourceUrl: 'https://github.com/d3/d3',
    role: 'runtime_chart',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'Primary custom charting and analytical visualization route for project, cost, workflow and topology views.',
  },
  {
    name: '@xyflow/react',
    sourceUrl: 'https://github.com/xyflow/xyflow',
    role: 'runtime_chart',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'Node-based workflow, topology, dependency and editable graph route for PanUI workbenches.',
  },
] as const satisfies readonly DesignSystemPackage[];

export const panUiReferencePackages = [
  {
    name: 'radix-ui',
    sourceUrl: 'https://github.com/radix-ui/primitives',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Accessible primitive reference for future PanUI overlays, menus, dialogs and selects.',
  },
  {
    name: 'shadcn-ui',
    sourceUrl: 'https://github.com/shadcn-ui/ui',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Style and composition reference only. PanUI is not a shadcn/ui dependency or clone.',
  },
  {
    name: 'nativewind',
    sourceUrl: 'https://github.com/nativewind/nativewind',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'React Native styling reference for future mobile PanUI implementation.',
  },
] as const satisfies readonly DesignSystemPackage[];

export const panUiSourcePackages = [
  ...panUiRuntimePackages,
  ...panUiReferencePackages,
] as const satisfies readonly DesignSystemPackage[];

export const archDesignSystemDevelopmentRules = [
  'PanUI is the active design-system baseline for new UI. Do not add legacy component-runtime packages or imports.',
  'AI Native surfaces must expose agent state, tool traces, approvals, audit events, file state and operation queues as first-class primitives.',
  'React Native is a first-class product target. Web components must keep token and prop semantics that can be implemented with native primitives.',
  'shadcn/ui and Radix are references or primitive sources when useful; neither defines the ArchIToken product identity.',
  'Custom CSS is allowed for engineering viewers, canvas overlays, transparent dock rails, BIM/CAD tools and low-level responsive constraints, but it must inherit PanUI tokens.',
  'Module and workflow emphasis colors must use semantic multi-accent tokens with icons/labels as the meaning source; do not return to a blue-only status language.',
  'Every runtime package must keep a license entry in this registry and remain compatible with the AI Native + React Native PanUI baseline.',
] as const;
