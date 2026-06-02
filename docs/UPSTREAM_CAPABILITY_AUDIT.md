# Upstream Capability Audit

Status: active governance record.

Rule: complete capability coverage is mandatory. License, authorization, hosting model, desktop runtime, and dependency weight decide the isolation boundary, not whether a strong project must be implemented.

The words `selected`, `reference_only`, `candidate`, and `licensed_gated` are historical registry labels for implementation boundaries. They must not be read as "optional". If an upstream carries production capability, standard truth, fixture value, SDK/API contract, workflow pattern, or clean-room implementation knowledge, ArchIToken must map it into runtime adapters, source-build routes, synchronized contract sources, tests, clean-room references, licensed adapters, or explicit blocked/failed evidence.

## Decision Changes

| Project | Prior issue | Current decision | Isolation |
| --- | --- | --- | --- |
| https://github.com/KoStard/ForgeCAD | Was treated as reference because licensing/runtime shape was unclear. | Primary Text-to-CAD / CAD generation route. | External CLI or isolated service. Completed jobs require persisted CAD/render artifacts. |
| https://github.com/specklesystems/speckle-server | Was treated as reference because SPDX/license detection was unclear. | Selected model collaboration/sync route. | Isolated Speckle Server/API service. Core uses API/SDK boundaries only. |
| https://github.com/Unstructured-IO/unstructured | Was treated as reference because dependency weight needed review. | Selected fallback document extraction route. | Isolated worker/service package when Docling, MinerU, or MarkItDown are insufficient. |

## Already Aligned

| Project | Decision | Reason |
| --- | --- | --- |
| https://github.com/blender/blender | `selected_external_process` | Strong render/model/video capability; GPL/runtime handled through external process. |
| https://github.com/FreeCAD/FreeCAD | `selected_external_process` | Strong CAD conversion capability; desktop/native runtime handled through headless process. |
| https://github.com/LibreDWG/libredwg | `selected_external_process` | DWG fallback value; GPL handled through isolated sidecar, while main DWG remains licensed-gated. |
| https://github.com/CGAL/cgal | isolated candidate/worker boundary | Strong geometry capability; GPL/commercial licensing controls boundary. |
| https://github.com/opendatalab/MinerU | isolated CLI worker | Strong PDF/Office document-intelligence extraction capability; use the upstream 3.1.15+ CLI/container under its published license and keep model/artifact output behind worker contracts. |
| https://github.com/VikParuchuri/marker | `selected_external_process` | Strong PDF-to-Markdown capability; GPL handled by service/process isolation. |
| https://github.com/ONLYOFFICE/DocumentServer | `selected_external_process` | Strong Office editing capability; AGPL/commercial route handled by isolated service. |
| https://github.com/CollaboraOnline/online | `selected_external_process` | Strong Office editing route; WOPI/service boundary required. |
| https://github.com/frappe/erpnext | `selected_external_process` | Strong ERP capability; GPL route handled through service/API isolation. |
| https://github.com/aspen-cloud/triplit | `selected_external_process` | Strong sync capability; AGPL handled through service boundary if adopted. |
| https://github.com/Adam-CAD/CADAM | `selected_external_process` | Strong Text-to-CAD reference; GPL handled through external process/service. |

## Non-Runtime Full-Use Boundaries

These are not optional references. They are non-runtime full-use boundaries because they are archived, organization-level, duplicate, sample-only, vendor-specific without an authorized runtime path, or superseded at runtime by a stronger implementation route. They still must be synchronized, cited, converted into fixtures, used for clean-room behavior, or tracked as blocked/failed evidence where relevant.

| Project | Reason |
| --- | --- |
| buildingSMART archived/schema/sample repositories | Standards/spec/fixture sources, not runtime engines. |
| https://github.com/ThatOpen | Organization-level source; concrete web-ifc packages are selected separately. |
| https://github.com/specklesystems | Organization-level source; concrete Speckle SDK/server/exporter routes are selected separately. |
| https://github.com/specklesystems/speckle-connectors-dui | UI design reference; production sync uses Speckle Server/API/SDK routes. |
| https://github.com/specklesystems/speckle-excel | Archived connector. |
| https://github.com/specklesystems/speckle-powerbi | PowerBI-specific route requires a licensed enterprise BI adapter decision. |
| https://github.com/specklesystems/speckle-sharp | Archived legacy SDK; current SDK route is selected. |
| https://github.com/symbiontarch/ForgeCAD-archive | Superseded by KoStard/ForgeCAD primary route. |
| https://github.com/jtw465/forgecad-studio-suite | Superseded by KoStard/ForgeCAD primary route. |
| https://github.com/BIM-Tools | Organization-level source; choose concrete repos before implementation. |
| https://github.com/KittyCAD/text-to-cad-ui | Archived UI/reference around an external API route, not the selected runtime. |
| https://github.com/dream-num | Organization-level source; concrete Univer route is selected separately. |

## Enforcement

- Architecture constitution Article 4 defines capability-first selection.
- `03-frontend/lib/adapter-source-registry.ts` records decisions for product/runtime routing.
- `06-workers/architoken_workers/engine_registry.py` records dispatchable worker isolation policies.
- Worker dispatch fails when a dispatchable adapter has no isolation policy.
- Completed worker results must include real persisted artifacts or explicit service results; no manifest-only success for generation/conversion.
