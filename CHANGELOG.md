# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]

### Changed — 2026-04-23 · 11 模块并列架构重构 (Phase 1 · 文档层)

Business model reset: 9 "business phases" (enum) → **11 "modules" (registry)**. This Phase 1 commit is documentation-only; code changes follow in Phases 2-4 (Rust / Python / SQL).

- **New**: `02-architecture/MODULES.md` — 11 modules full spec (id, zh/en name, order, description, inputs/outputs, prompt_dir, tables, migration map)
- **New**: `02-architecture/MODULE-REGISTRY.md` — Registry mechanism (Rust `trait Module + ModuleRegistry` / Python `@dataclass ModuleSpec + dict` / SQL `modules` table), add/remove checklists
- **Updated**: `README.md` · `01-product/PRD.md` · `02-architecture/CONSTITUTION.md` · `02-architecture/ARCHITECTURE.md` · `CLAUDE.md` — all references from "9 phases" / "BusinessPhase enum" to "11 modules / registry"
- **Architecture decision**: all 11 modules are peers (no business-vs-horizontal split); future modules added/removed via registry only, no existing-code churn
- **Semantics**:
  - `pre_sales` → `marketing_service`
  - `concept` → `concept_design`
  - NEW `standard_library` (global reference resource)
  - `develop` → `detailed_design`
  - `costing` → `quantity_costing`
  - `logistics` → `material_logistics`
  - `fabrication` → `manufacturing`
  - `construction` + `acceptance` → merged into `construction_supervision`
  - `operations` → `digital_twin`
  - NEW `digital_archive` (long-term project archival)
  - NEW `settings_center` (side-car · global config for the other 10)
- **Implementation strategy** (Phases 2-4):
  - Rust: remove `BusinessPhase` enum, introduce `shared/src/modules/` trait + 11 module structs + `Lazy` global REGISTRY
  - Python: rename `phases.py` → `modules.py`, `phase_graph.py` → `module_graph.py`; `git mv` 9 prompt dirs to new names, add 3 new dirs with templates
  - SQL: new `modules` registry table; drop any `business_phase` ENUM type; business FKs become `module_id TEXT REFERENCES modules(id)`

## [2.0.0] — 2026-04-19

Major architectural reset. Not backward-compatible with 1.x.

### Added
- Harness Engineering philosophy (智灵姐 · 2026-04-14) codified into 19-article CI-enforced Constitution
- 6-engine hot-swap inference routing (vLLM 0.19.1, SGLang 0.5.10.post1, TensorRT-LLM 1.2.0, LMDeploy 0.12.3, Ollama 0.21.0, llama.cpp b8840)
- `RollbackGuard` enforcing §8 SLA and §15 < 30 s auto-recovery
- 9-phase LangGraph agent orchestrator with 3-role Harness pattern (planner / generator / evaluator)
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
- All dependencies patch-pinned `=x.y.z` (§4); no `^`, `~`, or floating tags anywhere

### Removed
- v1.x dual-track frontend (React + Vue in parallel)
- ComfyUI removed from the main dependency graph; retained as an **optional external service** only, never statically linked (§3 compliance)

### Security
- Default-deny Kubernetes NetworkPolicies in the `insomeos` namespace
- Distroless container runtime images; non-root, read-only root FS
- JWT auth via Supabase 2.188.1; RBAC with 7 roles × 9 permissions

### Notes
- Anchor validation project: **应舍美居·锦屏** (Qiandongnan, Guizhou — 520 ㎡ three-storey heavy-steel villa, Q355B, ¥680k, 45 d)
- All 2026-04 GitHub versions verified with GPG signatures where the repository provides them

## [1.x.x] and earlier
Not documented here; see historical issues + commits.
