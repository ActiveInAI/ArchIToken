# Impertio Studio OpenAEC Source Inventory

Status: active upstream inventory.
Verified: 2026-05-25 through `https://api.github.com/orgs/Impertio-Studio/repos?per_page=100`.
Organization: `https://github.com/Impertio-Studio`.
Repository index: `https://github.com/orgs/Impertio-Studio/repositories?type=all`.

This inventory records the user-supplied Impertio Studio organization and repository index as capability sources for ArchIToken. The repository names contain `Claude` because that is the upstream naming, but ArchIToken's active development assistant remains GPT / Codex. These repositories are imported as generic skill/source packages for ToolRouter, Worker/Adapter contracts, source-build manifests, and isolated service planning; they must not restore Claude as the repository identity or authoritative instruction source.

## Non-Negotiable GPL / AGPL Rule

When an Impertio package points to a foundational runtime whose own implementation is GPL, AGPL, SSPL, BUSL, commercial, unknown, or otherwise incompatible with ArchIToken core distribution, ArchIToken must not demote that runtime to `reference_only` only because of the license.

The required route is:

```text
selected_external_process | sidecar_service | container_service | licensed_gated_adapter
```

The adapter must produce real artifacts, API results, validation reports, or explicit failure evidence. Examples include Blender/Bonsai, QGIS, ERPNext/Frappe, Nextcloud, Open-PDF-style service stacks, n8n workflow services, and other heavy or copyleft runtimes discovered through these packages.

## Repository Ledger

| Repository | License from GitHub API | ArchIToken route | Boundary |
|---|---|---|---|
| `Frappe_Claude_Skill_Package` | NOASSERTION | selected source sync | Frappe/ERPNext runtime remains external service/API until license is reviewed |
| `.github` | NOASSERTION | organization metadata sync | profile/topics only; no runtime claim |
| `Blender-Bonsai-ifcOpenshell-Sverchok-Claude-Skill-Package` | MIT | selected source sync | Blender/Bonsai/IfcOpenShell jobs stay external process/service |
| `Tauri-2-Claude-Skill-Package` | MIT | selected source sync | desktop shell patterns only until runtime adapter is approved |
| `Nextcloud-Claude-Skill-Package` | MIT | selected source sync | Nextcloud runtime stays isolated service/API |
| `Fluent-i18n-Claude-Skill-Package` | MIT | selected source sync | may inform i18n workflow and glossary generation |
| `Vite-Claude-Skill-Package` | MIT | selected source sync | frontend build/workbench guidance |
| `React-Claude-Skill-Package` | MIT | selected source sync | React workbench guidance |
| `Skill-Package-Workflow-Template` | MIT | selected source sync | ToolRouter skill packaging template |
| `n8n-Claude-Skill-Package` | MIT | selected source sync | n8n runtime stays workflow service boundary |
| `pdf-lib-Claude-Skill-Package` | MIT | selected source sync | PDF editing/generation worker guidance |
| `PDFjs-Claude-Skill-Package` | MIT | selected source sync | browser PDF source-view guidance |
| `SolidJS-Claude-Skill-Package` | MIT | source sync/reference | no runtime switch away from React without architecture review |
| `Docker-Claude-Skill-Package` | MIT | selected source sync | container/runbook guidance |
| `Draw.io-Claude-Skill-Package` | MIT | selected source sync | diagram adapter guidance |
| `Cross-Tech-AEC-Claude-Skill-Package` | MIT | selected source sync | cross-format AEC adapter guidance |
| `ThatOpen-Claude-Skill-Package` | MIT | selected source sync | ThatOpen/WebIFC source-build and viewer contracts |
| `Three.js-Claude-Skill-Package` | MIT | selected source sync | Three.js WebGPU/fallback workbench guidance |
| `Speckle-Claude-Skill-Package` | MIT | selected source sync | Speckle CDE/API/connector boundary guidance |
| `QGIS-Claude-Skill-Package` | MIT | selected source sync | QGIS runtime stays external process/service |
| `Open-PDF-Studio-Claude-Skill-Package` | MIT | selected source sync | PDF service stack stays isolated when license/runtime requires |
| `erp-next-nl` | NOASSERTION | blocked for embedded runtime; source sync only | license review required before runtime use |
| `Y_App-extension-kg-planning` | NOASSERTION | blocked for embedded runtime; source sync only | license review required before runtime use |
| `TailwindCSS-Claude-Skill-Package` | MIT | selected source sync | styling guidance only; PanUI remains default UI contract |
| `shadcn-ui-Claude-Skill-Package` | MIT | source sync/reference | component reference only; no shell replacement |
| `Frontend-Design-Claude-Skill-Package` | MIT | selected source sync | frontend design QA guidance |
| `Rust-Claude-Skill-Package` | MIT | selected source sync | Rust worker/core guidance |
| `MariaDB-Claude-Skill-Package` | MIT | source sync/reference | PostgreSQL remains primary unless module contract selects MariaDB |
| `PostgreSQL-Claude-Skill-Package` | MIT | selected source sync | database schema, pgvector, PGMQ guidance |
| `CesiumJS-Claude-Skill-Package` | MIT | selected source sync | 3D Tiles/GIS viewer guidance |
| `pdfium-render-Claude-Skill-Package` | MIT | selected source sync | PDFium sidecar guidance |
| `WebGPU-Claude-Skill-Package` | MIT | selected source sync | WebGPU-first renderer/compute guidance |
| `IFC-Claude-Skill-Package` | MIT | selected source sync | IFC/openBIM validation and worker guidance |

## Implementation Contract

- `docs/ADAPTER_SOURCE_MAP.md` records the organization-level URL.
- `03-frontend/lib/adapter-source-registry.ts` records the organization as a selected isolated source-set.
- `06-workers/architoken_workers/source_build.py` records every public repository above in `impertio-studio-openaec-source-sync`.
- NOASSERTION repositories are source-synced for audit and review but remain blocked for embedded runtime use until the license file is read and recorded.
- Copyleft or service-heavy runtimes discovered through these repositories must be callable, not merely noted: CLI, container, HTTP service, IPC sidecar, or licensed adapter are the valid boundaries.
