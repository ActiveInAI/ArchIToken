# ArchIToken Frontend Ant Design Standard

Status: active frontend design-system contract.

ArchIToken frontend now uses the Ant Design ecosystem as the global component and token baseline. This is a platform rule for `/app`, `/app/modules`, module workbenches, file viewers, dialogs, drawers, AI assistant surfaces, tables, forms, charts and future mobile shells.

## Commercial Use

Runtime Ant Design packages selected in `03-frontend/package.json` are MIT-licensed and can be used commercially when license notices and dependency records are preserved. Every version upgrade or new Ant Design ecosystem package must repeat license/SBOM review before distributed runtime use.

This decision does not relax ArchIToken's existing rule for other ecosystems: GPL/AGPL/SSPL/BUSL code must stay isolated unless an explicit license review approves a distribution model.

## Runtime Baseline

| Package | Role | Runtime decision |
|---|---|---|
| `antd` | Primary React component system | selected, pinned to Ant Design 5 |
| `@ant-design/icons` | Product icon family | selected |
| `@ant-design/pro-components` | Enterprise workbench tables, forms, descriptions and dense admin surfaces | selected |
| `@ant-design/charts` | AntV-backed React chart layer | selected |
| `@ant-design/x` | AI chat and assistant components | selected, pinned to v1 for AntD 5 peer compatibility |
| `antd-style` | Token-aware styling bridge | selected |
| `@ant-design/colors` | Color token source | selected |
| `@ant-design/cssinjs-utils` | CSS-in-JS utility layer | selected |
| `@ant-design/static-style-extract` | Static style extraction candidate | selected tooling candidate |

Ant Design 5 is the current production baseline because `@ant-design/pro-components` and `@ant-design/x@1` share the AntD 5 peer contract. Ant Design 6 must not become the app baseline until ProComponents and Ant Design X are upgraded together and CI confirms peer compatibility.

## Reference And Development Sources

| Source | Use |
|---|---|
| https://github.com/ant-design/ant-design-cli/blob/main/README.zh-CN.md | CLI/dev workflow reference only |
| https://github.com/ant-design/ant-design-pro | Enterprise app reference only; do not replace the Open CDE workbench shell |
| https://github.com/ant-design/ant-design-web3 | Web3 UI reference only; Token compliance stays under ArchIToken governance |
| https://github.com/ant-design/ant-design-mobile | Mobile UI reference for future mobile shell |
| https://github.com/ant-design/ant-design-mobile-rn | React Native reference only |
| https://github.com/ant-design/theme-token | Token documentation reference |
| https://github.com/ant-design/antd-issue-helper | Developer issue reproduction reference |
| https://github.com/ant-design/ant-design-pro-cli | Scaffold reference only |
| https://github.com/ant-design/antd-skill | AI/UI skill reference |
| https://github.com/ant-design/doc | Documentation reference |
| https://github.com/ant-design/ant-design-web3/blob/main/README-zh_CN.md | Chinese Web3 documentation reference |

## Implementation Contract

1. The global provider must route Ant Design through `ConfigProvider`, Chinese locale and ArchIToken theme tokens.
2. `wechat_light` remains the default theme, expressed through Ant Design tokens rather than a competing visual language.
3. New buttons, inputs, selects, forms, tables, tabs, menus, modals, drawers, notifications, tooltips, tags, descriptions, layout primitives, icons, charts and AI chat surfaces must start from Ant Design ecosystem components.
4. Custom CSS is allowed only for engineering viewer canvases, transparent dock rails, full-screen model/CAD tools, low-level layout constraints, or behavior Ant Design cannot express safely.
5. Existing non-AntD components are technical debt. When touched, they must migrate toward Ant Design components or a tokenized wrapper.
6. Do not introduce another UI component library without updating `03-frontend/lib/design-system-registry.ts`, this document, `docs/03_ARCHITOKEN_TECH_STACK.md` and `02-architecture/BUSINESS_MODULE_WORKBENCH.md`.
7. Ant Design Pro is a reference, not a shell replacement. ArchIToken must keep the unified Open CDE module workbench and 14-module registry.
8. Viewer toolbars, BIM/CAD property panels and floating file tools must keep the transparent, dockable, non-obstructive behavior required by the viewer contract, while inheriting color, font, radius and control tokens from Ant Design.

## Code Owners' Checklist

- Add or update Ant Design runtime packages only through `03-frontend/package.json` and `bun.lock`.
- Keep source URLs in `03-frontend/lib/adapter-source-registry.ts`.
- Keep design-system package rules in `03-frontend/lib/design-system-registry.ts`.
- Run frontend lint, typecheck, targeted tests and build after UI-system changes.
- Preserve module registry, file lifecycle, approval, audit and OpenBIM rules when changing UI.
