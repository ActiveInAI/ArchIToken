# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]

### Added — 2026-06-11 · Audit integrity & doc/impl reconciliation

- **Added (stage BOM — ABOM 数字档案 archive; lifecycle closed end-to-end)**: `20260611000012_archive_package_bom.sql` adds `archive_packages`/`archive_package_items` derived from an installation BOM, archiving **only accepted (`is_archivable`) lines** — `bom_derive_archive_package()` raises if nothing is accepted (未验收不得闭环/归档), and `bom_archive_is_complete()` reports whether every installation line is accepted (sealable). Each archive item traces to its source IBOM line (and thus the whole chain). Tenant RLS + FORCE + project-scope. The `archive` operation + an `archivePackages` count were threaded through the Gateway `bom_derive`/`bom_chain_summary`, the typed frontend client, and the chain panel; `digital_archive` now uses an archive-focused `BomChainPanel` (3rd previously-shell module wired). Proven on pg16 (no-acceptance archive rejected; only accepted items archived; completeness flips true once all accepted) and added to the BOM-chain CI gate (now RBOM→CBOM→Planning / EBOM→MTO→PBOM / MBOM→Shipment→IBOM→Archive). Rust `clippy -D` + frontend `eslint`/`tsc` green.
- **Added (BOM chain frontend — material_logistics + construction_management)**: two previously-bare-shell modules now have real businessHomes via a shared `components/BomChainPanel.tsx` — a live BOM derivation-chain dashboard (per-stage counts + gate readiness) and a derive action, backed by a typed client `lib/bom-chain.ts` that calls `GET /v1/bom/chain-summary` and `POST /v1/bom/derive` via the existing runtime-context request helpers. `material_logistics` uses the default (procurement-focused) view; `construction_management` uses an installation-focused view (未签收不得安装 / 未验收不得归档). Wired into `ModuleDetailWorkbench` dispatch. `eslint` clean and `tsc --noEmit` reports no errors in the new files (browser render not verified in this environment).
- **Added (BOM chain HTTP API)**: the multi-stage BOM chain is now consumable over the Gateway. `postgres_runtime_store` gains `bom_chain_summary(tx, project_id)` (per-stage counts + gate readiness: purchasable/releasable/installable/archivable) and `bom_derive(tx, op, source_id, …)` (dispatches to the SQL derivation functions). Two endpoints (`bin/gateway.rs`): `GET /v1/bom/chain-summary?tenant_id=&project_id=` (RegistryRead) and `POST /v1/bom/derive` (GenerationCreate), both run inside `begin_tenant_tx` so tenant **and project (R4)** RLS scope the data. `cargo clippy --all-targets -- -D warnings` + `fmt` green; the exact summary query and every derive-dispatch statement (incl. the `COALESCE($n::numeric,1.00)` cast) proven against pg16. This is the API bridge from the BOM data model to product/UI consumption.
- **Added (stage BOMs — CBOM 方案设计 + Planning 项目管理; 9-stage BOM model complete)**: `20260611000011_concept_planning_bom.sql` adds `concept_boms`/`concept_bom_lines` (CBOM, derived from a customer-confirmed demand BOM; `is_ready_for_deepening` only when `status='selected'`) and `planning_boms`/`planning_bom_lines` (Planning, derived from a selected concept; a standard 7-phase lifecycle WBS mirroring the BOM chain; `is_baselined` gate). Functions `bom_derive_concept_bom()` / `bom_derive_planning_bom()` enforce the confirmed→selected→baselined gates. Tenant RLS + FORCE + project-scope; folded into the BOM-chain CI gate. **This completes all 9 business-stage BOMs requested** (客服报价 RBOM · 方案设计 CBOM · 深化设计 EBOM · 计量造价 QBOM/BOQ · 材料采购 MTO/PBOM · 生产制造 MBOM · 物流运输 Shipment · 施工管理 IBOM · 项目管理 Planning), all governed by a uniform model: upstream-status gates, full source traceability, per-stage release gates, and tenant/project RLS. The CI gate now asserts the whole RBOM→CBOM→Planning / EBOM→MTO→PBOM / MBOM→Shipment→IBOM chain on every build.
- **Added (stage BOM — RBOM 客服报价/需求 BOM, upstream entry)**: `20260611000010_demand_quote_bom.sql` adds `demand_boms`/`demand_bom_lines` — the upstream entry that feeds the chain (customer requirement → estimated components/materials → quote, then into deepening). Per-line `est_total_cny` is a generated column (qty × unit price); `is_ready_for_design` is true only when `status='customer_confirmed'` (master-doc rule: 无客户确认不得进入深化). Helpers: `bom_demand_quote_total()` and `bom_assert_demand_ready_for_design()` (raises until confirmed). Tenant RLS + FORCE + project-scope. Proven on pg16: quote total 52150 from generated columns; unconfirmed demand blocked from deepening, ready after customer confirmation. Also folded into the BOM-chain CI gate.
- **Added (BOM derivation chain CI gate)**: `04-backend/scripts/smoke-bom-derivation-chain.sh` replays all migrations on a scratch DB, seeds an approved component BOM, runs the full derivation chain (MTO→PBOM, MBOM→Shipment→IBOM) and asserts every governance gate (approved-only / released-only, purchasable / releasable / installable / archivable) and source traceability with `RAISE EXCEPTION`. Wired into `smoke-p0-production-gates.sh` (syntax pre-check + run), so the multi-stage BOM chain is now CI-verified on every build instead of only ad-hoc. Passes against pg16.
- **Added (stage BOM — Shipment 物流 BOM)**: `20260611000009_shipment_bom.sql` adds `shipment_boms`/`shipment_bom_lines` derived per part from a released manufacturing BOM, completing the physical flow MBOM(fabricated)→Shipment(dispatch/transit/receive)→IBOM(install). `bom_derive_shipment_bom(manufacturing_bom_id)` is gated on the source MBOM `status='released'`; each line traces to its source MBOM line; a generated `is_installable` column is true only when `dispatch_state='received'` (master-doc rule: 未签收不得安装). Tenant RLS + FORCE + project-scope. Proven on pg16: draft-MBOM derive rejected; 2 lines, 0 installable until received → 1 after receiving one, traceable with weight carried.
- **Added (stage BOM — IBOM 施工安装 BOM)**: `20260611000008_installation_bom.sql` adds `installation_boms`/`installation_bom_lines` derived per part from a **released** manufacturing BOM, completing the EBOM→MTO/PBOM→MBOM→IBOM chain. `bom_derive_installation_bom(manufacturing_bom_id)` is gated on the source MBOM `status='released'`; each install line traces to its source MBOM line; a generated `is_archivable` column is true only when `acceptance_state='accepted'` (master-doc rule: 未验收不得闭环/归档). Tenant RLS + FORCE + project-scope. Proven on pg16: draft-MBOM derive rejected; 2 install lines, archive blocked by 2 unaccepted lines, dropping to 1 block after accepting one, traceable with weight carried.
- **Added (stage BOM — MBOM 制造 BOM)**: `20260611000007_manufacturing_bom.sql` adds `manufacturing_boms`/`manufacturing_bom_lines` derived **per-part** from an approved component bom_version (manufacturing is per fabrication item, not aggregated), complementing the program-specific `heavy_steel_module_work_orders`. `bom_derive_manufacturing_bom(bom_version_id)` is gated on `status='approved'`; each line is traceable to its source `bom_line` and carries quantity/weight + R5 grade/section refs; a generated `is_releasable` column is true only when both a process route and a QC rule are defined (master-doc rule: 工艺/质检规则缺失不得排产). Tenant RLS + FORCE + project-scope. Proven on pg16: draft derive rejected; 3 per-part lines, 0 releasable until process+QC defined → 1, traceable with weight carried.
- **Added (stage BOMs — MTO 材料提量 → PBOM 采购 BOM)**: realized the first downstream stage of the multi-stage BOM chain as **derivations of the approved component BOM** (not copies), per the source-of-truth model. `20260611000006_material_takeoff_procurement_bom.sql` adds `bom_material_takeoffs`/`bom_material_takeoff_lines` (MTO) and `procurement_boms`/`procurement_bom_lines` (PBOM), each with tenant RLS + FORCE + project-scope (R4 pattern), plus two derivation functions: `bom_derive_material_takeoff(bom_version_id, waste_factor)` aggregates issued lines by the R5 controlled grade+section into net/gross quantity & weight and is **gated on `status='approved'`** (downstream consumes approved only); `bom_derive_procurement_bom(mto_id)` emits procurement lines carrying the price-evidence state machine, with a generated `is_purchasable` column true only for `supplier_quote`/`locked`. Proven on pg16: draft-version derive rejected; 2 source Q355D/H lines aggregate to net 15 / gross 15.75 (waste 1.05) / weight 730.992→767.5416, traceable to source version; PBOM starts 0-purchasable and flips to purchasable only after a price is locked.
- **Added (backend R5 — BOM controlled master data)**: `bom_lines.material_grade`/`section_size` were inline free-text, so weights weren't deterministically derivable and material takeoff couldn't group by a controlled spec. `20260611000005_bom_master_data.sql` adds two global engineering-reference tables — `bom_material_grades` (12 seeded grades with real densities: Q235B/Q355D/10.9S/304/6061…) and `bom_section_profiles` (profile type + formula kind + area + unit weight) — and adds nullable FK columns `material_grade_ref`/`section_profile_ref` to `bom_lines` (text columns kept for compat; safe non-destructive backfill links rows whose text already matches a known grade). Proven on pg16: full chain applies, FKs present, and area×density reproduces the stored unit weight exactly (`H200X200X8X12 → 48.7328 kg/m`), so weight is now deterministically derivable from controlled master data.
- **Added (backend R4 — project-level RLS)**: RLS predicates were tenant-only; project isolation relied on FKs, not policy. `20260611000004_project_scope_rls.sql` adds a `current_project()` helper and RESTRICTIVE `*_project_scope` policies on `boq_items`, `bim_uploads`, `compliance_findings`, `agent_invocations` (all already `FORCE`d, `project_id UUID`). The predicate `current_project() IS NULL OR project_id = current_project()` is **permissive when `app.current_project` is unset** (tenant-wide queries unaffected — zero regression) and **enforces project isolation when set**. The Gateway `begin_tenant_tx(context)` now binds `app.current_project` (txn-local) when the request carries a valid project UUID. Proven on pg16 as a non-bypass role: project=X→1 row, project=Y→1 row, unset→2 rows, and a cross-project INSERT (context=Y, write X) is rejected by `WITH CHECK`. Full gateway test suite 37 passed; `clippy -D warnings` + `fmt` green.

- **Fixed (backend R1)**: the `agent_invocations` run ledger was never written (agent runs only left audit events). `harness-core/src/postgres_runtime_store.rs` now exposes `record_agent_invocation(...)` and the Gateway `invoke_agent_handler` (`bin/gateway.rs`) persists each run (project/tenant/module, user_input, planner/generator/evaluator model identities, verdict cast to the `verdict` enum, revision_count, final_output + gate trace as jsonb, measured latency_ms). The orchestrator `AgentResponse` (`agent-orchestrator/.../state.py`, `main.py`) now surfaces `planner_model`/`generator_model`/`evaluator_model` so the ledger columns are populated end-to-end (no longer NULL). Write is **best-effort/non-fatal** — a ledger or FK failure never breaks the agent response. Verified: `cargo check`/`cargo test` green, orchestrator pytest+ruff+mypy green, and the exact INSERT (FK + `::verdict` cast + jsonb + NULL-verdict path) succeeds against pg16.
- **Fixed (backend R6, partial)**: ToolRouter now performs **real per-tool permission enforcement** instead of emitting an unevaluated `requires_permission_check` flag. `agent-orchestrator/.../tool_router.py` resolves the caller's roles to a permission set (`engineer`/`reviewer`/`auditor` → `knowledge:read`/`rag:read`/`cde:read`/`audit:read`) and, per tool, records an `allowed`/`denied` decision; denied tools fail their `ToolResult` and have their evidence (CDE files, attachments) excluded from the governed source references. Covered by new tests (auditor → CDE denied; engineer → CDE allowed). The dedicated `ModelRouter:8091`/`ToolRouter:8092` port services and the `GeometryRouter`/`RenderRouter`/`WorkflowRouter` components remain target-state (see reconciliation).
- **Fixed**: cleared pre-existing strict-`mypy` failures in the orchestrator (`main.py` gate-status `Literal` typing via a `GateStatus` alias; `module_graph.py` dead `ToolCall.get` branch). `mypy src` is now green (12 files, 0 issues).
- **Fixed (append-only compat — regression caught via cross-window coordination)**: the side-effect trigger functions in `20260609000002_heavy_steel_module_operation_runtime.sql` and `20260609000003_module_operation_runtime.sql` wrote `audit_events` with `ON CONFLICT (id) DO UPDATE`. After the append-only trigger landed, any re-fire (e.g. an UPDATE of an operation-run row) would have hit the UPDATE path and been rejected, breaking the operation-run write. Changed both to `ON CONFLICT (id) DO NOTHING` (append-only-correct — the original audit row stays immutable). Proven end-to-end on a full-chain pg16 DB: INSERT then UPDATE of a real `module_operation_runs` row both fire the prepare trigger with no append-only error, and the audit row remains a single immutable record. (`20260609000001`'s audit insert already used `DO NOTHING`.)
- **Added (backend, "six Routers" made real)**: `GeometryRouter`, `RenderRouter` and `WorkflowRouter` previously existed only as names in strings. They are now genuine Registry-driven boundary components in `harness-core` (`geometry_router.rs`, `render_router.rs`, `workflow_router.rs`), each returning an auditable routing decision: GeometryRouter layers on `file_runtime_registry` to pick a geometry kernel (IfcOpenShell/OCCT/Blender/PanAEC OpenUSD/3D Tiles/DXF/licensed) + capability + IFC-binding requirement + fallback; RenderRouter encodes the WebGPU-first rule (WebGL only ever an audited fallback, never primary); WorkflowRouter resolves an object kind to the fixed six-gate chain + mandatory human approval + `issued`-only downstream. 13 new unit tests; full harness-core lib suite 185 passed; `cargo clippy --all-targets -- -D warnings` and `cargo fmt --check` green (crate enforces `clippy::pedantic` + `clippy::nursery` + `missing_docs`).
- **Added (routers reachable over HTTP)**: the three routers are now exposed as read-only Gateway endpoints — `GET /v1/routers/geometry?source=`, `GET /v1/routers/render?format=&target=`, `GET /v1/routers/workflow?module_id=&object_type=` — each returning the router's JSON routing decision (`bin/gateway.rs`). Covered by a `#[tokio::test]` wiring test. This closes the "process-internal vs port-service" gap: the routing boundaries are now callable from the gateway REST surface; standalone `:8091`/`:8092` ports remain an optional deployment-topology choice, not a code gap.

- **Added**: `04-backend/migrations/20260611000001_audit_events_append_only.sql` — DB-level append-only enforcement for `audit_events` and `cost_audit_events` (BEFORE UPDATE/DELETE/TRUNCATE triggers reject mutation). Closes the audit finding that the audit ledger was append-only by convention only. Verified on pg16: INSERT succeeds, UPDATE/DELETE/TRUNCATE rejected.
- **Added**: `04-backend/migrations/20260611000002_documented_name_compat_views.sql` — RLS-respecting (`security_invoker = true`) compatibility views reconciling documented names with real tables: `event_outbox`→`data_event_outbox`, `sjg157_categories`→`semantic_dictionary_categories`, `naming_rules`→`component_bom_naming_rules`, `import_batches`→`component_bom_import_batches`. Names with no real backing are deliberately not aliased.
- **Changed**: `04-backend/scripts/smoke-p0-production-gates.sh` now applies both migrations in the base-migration block and adds `assert_audit_append_only` (proves UPDATE/DELETE on `audit_events` are rejected) as a P0 CI gate.
- **Added**: `docs/ARCHITOKEN_CODE_AUDIT_DOC_VS_IMPL_2026-06-11.md` (6-subsystem code audit with file:line evidence) and `docs/ARCHITOKEN_IMPLEMENTATION_RECONCILIATION_2026-06-11.md` (authoritative documented-name→real-name map, claim corrections, and a no-fake implementation roadmap). When docs and code conflict, the reconciliation table is authoritative.

### Changed — 2026-06-09 · 16-module registry truth alignment

- **Updated**: active repository docs now treat `personal_center`, `finance_management` and `human_resources` as first-class active modules.
- **Updated**: legacy `finance_hr` remains only as a disabled historical alias that normalizes to `finance_management`; active prompts live under `finance_management/` and `human_resources/`.
- **Updated**: API and workbench docs now describe 16 active modules. Earlier 14-module entries below are historical phase records, not current truth.

### Changed — 2026-05-16 · Professional standards compliance

- **Added**: `02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md` as the cross-domain professional qualification, regulator, terminology, standards/codes and rule-governance baseline.
- **Updated**: Constitution from 21 to 22 articles. New Article 21 requires every platform module, term, business rule and AI output to bind professional roles, regulators, standards/codes, evidence and review state.
- **Updated**: `README.md`, `AGENTS.md`, `PRD.md`, `MODULES.md`, `MODULE-REGISTRY.md`, `ARCHITECTURE.md`, `MANIFEST.md` and `CONTRIBUTING.md` to make IPMP/IPMA, registered AEC roles, production, logistics, customs, tax, finance, accounting, HR, organization, AI, data, cybersecurity, software and global standards non-optional.
- **Updated**: `docs/ADAPTER_SOURCE_MAP.md` to include the ForgeCAD project skill boundary for project/file/member/publish/sync workflows.
- **Changed**: PRD wording now treats AI outputs as drafts/prechecks requiring professional review rather than automatic professional conclusions.

### Changed — 2026-05-15 · ChatGPT / Codex development entry

- **Added**: `AGENTS.md` as the current ChatGPT / Codex development-agent instruction entry.
- **Removed**: root `CLAUDE.md` and the active Zed + Claude Code setup guide. Claude / Anthropic remains only as optional runtime/model adapter or historical reference.
- **Updated**: source-truth and repository-entry docs now point to `AGENTS.md` instead of Claude-specific workflow files.

### Changed — 2026-04-23 · 14 模块并列架构重构 (Phase 1 · 文档层)

Business model reset: 9 "business phases" (enum) → **14 modules** (registry). This Phase 1 commit is documentation-only; code changes follow in Phases 2-4 (Rust / Python / SQL).

- **New**: `02-architecture/MODULES.md` — 14 modules full spec (id, zh/en name, order, description, inputs/outputs, prompt_dir, tables, migration map)
- **New**: `02-architecture/MODULE-REGISTRY.md` — Registry mechanism (Rust `trait Module + ModuleRegistry` / Python `@dataclass ModuleSpec + dict` / SQL `modules` table), add/remove checklists
- **Updated**: `README.md` · `01-product/PRD.md` · `02-architecture/CONSTITUTION.md` · `02-architecture/ARCHITECTURE.md` · `AGENTS.md` — all references from "module registry" / "ModuleId enum" to "14 modules / registry"
- **Architecture decision**: all 14 modules are peers (no business-vs-horizontal split); future modules added/removed via registry only, no existing-code churn
- **Semantics**:
  - `pre_sales` → `marketing_service`
  - `concept` → `concept_design`
  - NEW `standard_library` (global reference resource)
  - `develop` → `detailed_design`
  - `costing` → `quantity_costing`
  - `logistics` → `material_logistics`
  - `production_manufacturing`
  - `construction` + `acceptance` → merged into `construction_management`
  - `operations` → `digital_twin`
  - NEW `digital_archive` (long-term project archival)
  - NEW `settings_center` (side-car · global config for the other 10)
- **Implementation strategy** (Phases 2-4):
  - Rust: remove `ModuleId` enum, introduce `shared/src/modules/` trait + 14 module structs + `Lazy` global REGISTRY
  - Python: rename `modules.py` → `modules.py`, `module_graph.py` → `module_graph.py`; `git mv` 14 prompt dirs to new names, add 3 new dirs with templates
  - SQL: new `modules` registry table; drop any `module_id` ENUM type; business FKs become `module_id TEXT REFERENCES modules(id)`

## [2.0.0] — 2026-04-19

Major architectural reset. Not backward-compatible with 1.x.

### Added
- Harness Engineering philosophy (智灵姐 · 2026-04-14) codified into 19-article CI-enforced Constitution
- 6-engine hot-swap inference routing (vLLM 0.19.1, SGLang 0.5.10.post1, TensorRT-LLM 1.2.0, LMDeploy 0.12.3, Ollama 0.21.0, llama.cpp b8840)
- `RollbackGuard` enforcing §8 SLA and §15 < 30 s auto-recovery
- module-registry LangGraph agent orchestrator with 3-role Harness pattern (planner / generator / evaluator)
- Full AEC file-parser suite: DWG, DXF, IFC4, IFC5 IFCX, STEP, PDF, XML (all 100% Rust)
- Multi-tenant PostgreSQL RLS (§16 hard isolation)
- 7-language SDK auto-generation from a single OpenAPI 3.1 spec
- DGX Spark-first deployment; Rainbond 6.7.1 China one-click template

### Changed
- **Frontend: Vue removed**; Next.js 16.2.4 + React 19.2.5 is the sole production frontend (§12)
- **Cache: Redis → Valkey 8-alpine** (BSD-3 · baseline · v2.0 目标 9.0.3) to eliminate SSPL exposure
- **DWG parsing: LibreDWG (GPL-3) → acadrust 0.3.4** (pure Rust, MIT)
- **IFC parsing: IfcOpenShell (LGPL-3) → ifc-lite-core 2.1.9 + bimifc-parser 0.2.0** (MIT)
- **YOLOv8 (AGPL) → not used**; defer to project-specific MIT detectors
- Dependency policy clarified (§4): fast-moving development ecosystems may use bounded compatible ranges; release, CI, deployment and production artifacts remain reproducible through lockfiles, constraints files, image digests or explicit release tags.

### Removed
- v1.x dual-track frontend (React + Vue in parallel)
- ComfyUI removed from the main dependency graph; retained as an **optional external service** only, never statically linked (§3 compliance)

### Security
- Default-deny Kubernetes NetworkPolicies in the `architoken` namespace
- Distroless container runtime images; non-root, read-only root FS
- JWT auth via Supabase 2.188.1; RBAC with 7 roles × 9 permissions

### Notes
- Anchor validation project: **应舍美居·锦屏** (Qiandongnan, Guizhou — 520 ㎡ three-storey heavy-steel villa, Q355B, ¥680k, 45 d)
- All 2026-04 GitHub versions verified with GPG signatures where the repository provides them

## [1.x.x] and earlier
Not documented here; see historical issues + commits.
