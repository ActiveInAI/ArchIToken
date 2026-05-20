// lib/design-system-registry.ts - ArchIToken frontend design-system baseline
// License: Apache-2.0

export type DesignSystemPackageRole =
  | 'runtime_component'
  | 'runtime_icon'
  | 'runtime_chart'
  | 'runtime_ai_component'
  | 'runtime_token'
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
  license: 'MIT' | 'license_required';
  note: string;
}

export const activeDesignSystemId = 'ant_design';

export const archDesignSystemStorageKey = 'architoken_design_system';

export const antDesignRuntimePackages = [
  {
    name: 'antd',
    sourceUrl: 'https://github.com/ant-design/ant-design',
    role: 'runtime_component',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'Primary React component system. Pinned to Ant Design 5 because ProComponents and Ant Design X v1 share the AntD 5 peer contract.',
  },
  {
    name: '@ant-design/icons',
    sourceUrl: 'https://github.com/ant-design/ant-design-icons',
    role: 'runtime_icon',
    state: 'selected',
    license: 'MIT',
    note: 'Default icon source for product UI. Use before adding another icon family.',
  },
  {
    name: '@ant-design/pro-components',
    sourceUrl: 'https://github.com/ant-design/pro-components',
    role: 'runtime_component',
    state: 'selected',
    license: 'MIT',
    note: 'Dense enterprise workbench components for module tables, forms, descriptions and layout surfaces.',
  },
  {
    name: '@ant-design/charts',
    sourceUrl: 'https://github.com/ant-design/ant-design-charts',
    role: 'runtime_chart',
    state: 'selected',
    license: 'MIT',
    note: 'React chart layer above AntV for module KPIs, flow, cost and operations visualization.',
  },
  {
    name: '@ant-design/x',
    sourceUrl: 'https://github.com/ant-design/x',
    role: 'runtime_ai_component',
    state: 'selected_version_pinned',
    license: 'MIT',
    note: 'AI chat and assistant components. Pinned to v1 while the main UI baseline remains AntD 5.',
  },
  {
    name: 'antd-style',
    sourceUrl: 'https://github.com/ant-design/antd-style',
    role: 'runtime_token',
    state: 'selected',
    license: 'MIT',
    note: 'Token-aware styling bridge for custom engineering viewer surfaces that cannot be expressed as stock components.',
  },
  {
    name: '@ant-design/colors',
    sourceUrl: 'https://github.com/ant-design/ant-design-colors',
    role: 'runtime_token',
    state: 'selected',
    license: 'MIT',
    note: 'Color palette source for token derivation.',
  },
  {
    name: '@ant-design/cssinjs-utils',
    sourceUrl: 'https://github.com/ant-design/cssinjs-utils',
    role: 'runtime_token',
    state: 'selected',
    license: 'MIT',
    note: 'CSS-in-JS utilities for token extraction and theme tooling.',
  },
  {
    name: '@ant-design/static-style-extract',
    sourceUrl: 'https://github.com/ant-design/static-style-extract',
    role: 'runtime_token',
    state: 'selected',
    license: 'MIT',
    note: 'Static style extraction candidate for production SSR/static CSS optimization.',
  },
] as const satisfies readonly DesignSystemPackage[];

export const antDesignReferencePackages = [
  {
    name: 'ant-design-cli',
    sourceUrl: 'https://github.com/ant-design/ant-design-cli/blob/main/README.zh-CN.md',
    role: 'developer_tool',
    state: 'developer_tool_only',
    license: 'MIT',
    note: 'Reference for legacy Ant Design development tooling, not a runtime dependency.',
  },
  {
    name: 'ant-design-pro',
    sourceUrl: 'https://github.com/ant-design/ant-design-pro',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Enterprise admin application reference. ArchIToken keeps its own Open CDE workbench shell.',
  },
  {
    name: 'ant-design-web3',
    sourceUrl: 'https://github.com/ant-design/ant-design-web3',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Web3 component reference only; Token compliance UI must follow ArchIToken governance rules.',
  },
  {
    name: 'ant-design-mobile',
    sourceUrl: 'https://github.com/ant-design/ant-design-mobile',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Mobile UI reference. Add runtime package only when a mobile shell is implemented.',
  },
  {
    name: 'ant-design-mobile-rn',
    sourceUrl: 'https://github.com/ant-design/ant-design-mobile-rn',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'React Native reference. Not part of the current Next.js runtime.',
  },
  {
    name: 'theme-token',
    sourceUrl: 'https://github.com/ant-design/theme-token',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Theme token documentation and design reference.',
  },
  {
    name: 'antd-issue-helper',
    sourceUrl: 'https://github.com/ant-design/antd-issue-helper',
    role: 'developer_tool',
    state: 'developer_tool_only',
    license: 'MIT',
    note: 'Issue reproduction helper. Not shipped in product runtime.',
  },
  {
    name: 'ant-design-pro-cli',
    sourceUrl: 'https://github.com/ant-design/ant-design-pro-cli',
    role: 'developer_tool',
    state: 'developer_tool_only',
    license: 'MIT',
    note: 'Pro project scaffolding reference. ArchIToken uses the existing Next.js app shell.',
  },
  {
    name: 'antd-skill',
    sourceUrl: 'https://github.com/ant-design/antd-skill',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Skill packaging reference for AI-assisted UI generation.',
  },
  {
    name: 'ant-design-doc',
    sourceUrl: 'https://github.com/ant-design/doc',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Documentation source reference.',
  },
  {
    name: 'ant-design-web3-zh',
    sourceUrl: 'https://github.com/ant-design/ant-design-web3/blob/main/README-zh_CN.md',
    role: 'reference',
    state: 'reference_only',
    license: 'MIT',
    note: 'Chinese Web3 documentation reference.',
  },
] as const satisfies readonly DesignSystemPackage[];

export const antDesignSourcePackages = [
  ...antDesignRuntimePackages,
  ...antDesignReferencePackages,
] as const satisfies readonly DesignSystemPackage[];

export const archDesignSystemDevelopmentRules = [
  'New frontend UI must start from Ant Design components, ProComponents, Ant Design Charts, Ant Design X, or tokenized Ant Design wrappers.',
  'Custom CSS is allowed only for engineering viewers, canvas overlays, transparent dock rails, or layout behavior that Ant Design cannot express cleanly.',
  'Do not introduce a second component system for buttons, forms, tables, tabs, menus, modals, drawers, notifications, icons, charts, or AI chat without updating this registry and the architecture docs.',
  'Huly appearance follows the upstream five-option model: theme-light, theme-dark, theme-system, normal-font, and small-font; Ant Design tokens must bridge into that model.',
  'Module and workflow emphasis colors must use semantic multi-accent tokens with icons/labels as the meaning source; do not return to a blue-only status language.',
  'Every runtime package must keep a license entry in this registry and remain compatible with the pinned Ant Design baseline.',
] as const;
