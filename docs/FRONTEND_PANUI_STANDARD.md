# ArchIToken Frontend PanUI Standard

Status: active frontend design-system contract.

ArchIToken frontend uses PanUI as the AI Native, React and React Native design-system baseline. This is a platform rule for `/app`, `/app/modules`, module workbenches, file viewers, dialogs, drawers, AI assistant surfaces, tables, forms, charts and future mobile shells.

## Commercial Use

PanUI is owned under `https://github.com/ActiveInAI/PanUI` and is distributed as an Apache-2.0 project unless a later license review changes that repository. Runtime packages selected in `03-frontend/package.json` must keep license notices and dependency records.

This decision does not relax ArchIToken's existing rule for other ecosystems: GPL/AGPL/SSPL/BUSL code must stay isolated unless an explicit license review approves a distribution model.

## Runtime Baseline

| Package | Role | Runtime decision |
| --- | --- | --- |
| `PanUI` | Primary component primitive system | selected, canonical source is `ActiveInAI/PanUI` |
| `react` | Web UI runtime | selected, pinned in `03-frontend/package.json` |
| `react-native` | First-class mobile target | selected as product target; mobile runtime enters the mobile workspace when implemented |
| `lucide-react` | Product icon family | selected for PanUI web controls |
| `tailwindcss` | Token and utility styling layer | selected for web implementation |
| `d3` | Analytical charting and custom SVG route | selected |
| `@xyflow/react` | Graph, flow, topology and node-based editor route | selected |
| `mermaid` | Text-to-diagram document route | selected |
| `bpmn-js` | BPMN 2.0 modeling and rendering route | selected |
| `three` + `@react-three/fiber` | Digital twin / 3D engineering route | selected; WebGPU primary, WebGL audited fallback only |

## Reference And Development Sources

| Source | Use |
| --- | --- |
| https://github.com/ActiveInAI/PanUI | Canonical PanUI repository |
| https://github.com/facebook/react-native | React Native renderer target |
| https://github.com/lucide-icons/lucide | Icon source |
| https://github.com/radix-ui/primitives | Accessible primitive reference only |
| https://github.com/shadcn-ui/ui | Composition and Tailwind reference only |
| https://github.com/nativewind/nativewind | React Native styling reference only |
| https://github.com/d3/d3 | D3 data visualization source |
| https://github.com/xyflow/xyflow | React Flow / xyflow node editor source |
| https://github.com/mermaid-js/mermaid | Mermaid text diagram source |
| https://github.com/bpmn-io/bpmn-js | BPMN 2.0 browser toolkit source |
| https://github.com/mrdoob/three.js | Three.js / WebGPU renderer source |

## AI Native Renderer Stack

The selected renderer stack is recorded in `03-frontend/lib/ai-native-renderer-registry.ts`. GitHub star counts are a dated adoption snapshot, not the sole selection criterion.

| Route | Primary use | GitHub evidence checked on 2026-06-08 | Decision |
| --- | --- | --- | --- |
| PanUI | Owned UI primitive layer | `ActiveInAI/PanUI`: 0 stars; `shadcn-ui/ui`: 115970 reference stars | Use owned PanUI for product identity; use shadcn/Radix only as references |
| D3 | Data charts and custom Gantt | `d3/d3`: 113036 stars | Best fit for auditable custom chart specs and engineering analytics |
| React Flow / xyflow | Workflow, topology, dependency and agent graphs | `xyflow/xyflow`: 36976 stars | Best fit for embedded React node/edge editors; whiteboard apps are separate adapters |
| Mermaid | Document-level diagrams | `mermaid-js/mermaid`: 88515 stars | Best fit for AI-generated text diagrams, diffs and Markdown documents |
| bpmn-js | BPMN 2.0 | `bpmn-io/bpmn-js`: 9554 stars | Use the BPMN-specific toolkit rather than generic graph shapes |
| Three.js / WebGPU | Digital twin and 3D engineering viewports | `mrdoob/three.js`: 112907 stars | Use Three as the WebGPU scene/loader ecosystem; fallback must be audited |

## Implementation Contract

1. The global provider writes `data-theme`, platform CSS variables and persisted `architoken_theme`; it must not route UI through a separate compatibility provider.
2. `wechat_light` is the default theme, expressed through PanUI tokens as a white/gray/green workbench. `huly_light`, `huly_dark` and `huly_system` remain selectable platform themes.
3. New buttons, inputs, selects, forms, tables, tabs, menus, modals, drawers, notifications, tooltips, tags, descriptions, layout primitives, icons, charts and AI chat surfaces must start from PanUI primitives or PanUI-approved chart/graph routes.
4. Custom CSS is allowed only for engineering viewer canvases, transparent dock rails, full-screen model/CAD tools, low-level layout constraints, or behavior PanUI cannot express safely.
5. Existing legacy UI components are technical debt. When touched, they must migrate toward PanUI primitives or tokenized wrappers.
6. Do not introduce another UI component library without updating `03-frontend/lib/design-system-registry.ts`, this document, `docs/03_ARCHITOKEN_TECH_STACK.md` and `02-architecture/BUSINESS_MODULE_WORKBENCH.md`.
7. PanUI is the product design system. shadcn/ui, Radix and NativeWind are references or primitive sources only when they improve accessibility, composition or native portability.
8. Viewer toolbars, BIM/CAD property panels and floating file tools must keep the transparent, dockable, non-obstructive behavior required by the viewer contract, while inheriting color, font, radius and control tokens from PanUI.
9. Module navigation and process indicators must use semantic multi-accent tokens where useful, with labels/icons as the primary meaning carrier so the UI does not degrade into a blue-only scheme or color-only status encoding.
10. Loading states must use the shared `ArchLoadingFlow` / `.arch-loading-skeleton` pattern: one-way left-to-right accelerated rainbow flow. Do not reintroduce circular loading spinners or pulse-only skeletons for primary loading feedback.
11. AI-generated renderer output must be structured before it is rendered: PanUI view state, D3 chart specs, React Flow node/edge manifests, Mermaid source, BPMN XML and Three scene manifests must pass schema validation, audit recording and approval gates where business state changes.

## Code Owners' Checklist

- Add or update PanUI runtime packages only through `03-frontend/package.json` and `bun.lock`.
- Keep source URLs in `03-frontend/lib/adapter-source-registry.ts`.
- Keep design-system package rules in `03-frontend/lib/design-system-registry.ts`.
- Keep AI Native renderer rules in `03-frontend/lib/ai-native-renderer-registry.ts`.
- Run frontend lint, typecheck, targeted tests and build after UI-system changes.
- Preserve module registry, file lifecycle, approval, audit and OpenBIM rules when changing UI.
