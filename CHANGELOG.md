# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]

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
