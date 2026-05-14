# ArchIToken v2.0 · Final Delivery Manifest

**Status**: ✅ Complete · 113 files · 492 KB
**Date**: 2026-04-19
**Archive**: `architoken-v2.0-complete.tar.gz` (97 KB compressed)
**License**: Apache-2.0 OR MIT (dual) · 100% permissive

---

## Architecture decision (the one you asked about)

> **"Vue or Next? Both bloated?"**
>
> Decided: **Next.js 16.2.4 + React 19.2.5 single path.** Vue dropped from v2.0.
>
> **Rationale**: OPC × 2 maintenance is unsustainable. Next covers 100 % English + 90 % China markets via good i18n. Single SDK, single design system, single test suite, single Storybook.

---

## Delivered tree (113 files)

```
architoken/
├── README.md                          ← 123 lines · project entrypoint
├── LICENSE (Apache-2.0)               ← dual license
├── LICENSE-MIT
├── CHANGELOG.md                       ← v2.0.0 release notes
├── CONTRIBUTING.md                    ← developer guide
├── CODE_OF_CONDUCT.md
├── SECURITY.md                        ← vuln reporting
├── .editorconfig
├── .gitignore                         ← 82 lines, covers rust/node/py/ide/ai
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md       ← Constitution-aware checklist
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── workflows/
│       ├── ci.yml                     ← license-§3 + rust + py + fe + openapi + security
│       └── release.yml                ← docker matrix build + SBOM
│
├── 01-product/
│   └── PRD.md                         ← 3 personas · module registry · NFR · market · risks
│
├── 02-architecture/
│   ├── ARCHITECTURE.md                ← 8 layers, every version @x.y.z (+ 11-module registry diagram 2026-04-23)
│   ├── CONSTITUTION.md                ← 19 articles, CI-enforced (+ 2026-04-23 模块化修正)
│   ├── MODULES.md                     ← 14 modules spec · 2026-04-23 (NEW)
│   └── MODULE-REGISTRY.md             ← Rust trait + Py dataclass + SQL modules table (NEW)
│
├── 03-frontend/                       ← Next.js 16.2.4 · React 19.2.5 (single path)
│   ├── package.json                   ← frontend deps resolved through bun.lock for reproducible builds
│   ├── next.config.mjs                ← Turbopack, RSC, CSP headers
│   ├── tsconfig.json                  ← strict, noUncheckedIndexedAccess
│   ├── tailwind.config.ts             ← v4.2.4 with design tokens
│   ├── app/
│   │   ├── layout.tsx                 ← root RSC layout
│   │   ├── page.tsx                   ← landing (hero + module registry + feature grid)
│   │   ├── globals.css                ← tailwind v4 @theme block
│   │   └── app/projects/page.tsx      ← project list (uses lib/api.ts)
│   ├── components/
│   │   ├── Providers.tsx              ← React Query 5.99.1
│   │   └── BIMViewer.tsx              ← Three.js 0.184.0 + @react-three/fiber 9.6.0
│   └── lib/
│       └── api.ts                     ← typed REST client (projects + agents + harness)
│
├── 04-backend/
│   ├── Cargo.toml                     ← Rust 1.95.0 workspace, resolved through Cargo.lock for reproducible builds
│   ├── deny.toml                      ← cargo-deny 0.18.5 · §3 license gate
│   ├── openapi.yaml                   ← OpenAPI 3.1 single source of truth (§5)
│   │
│   ├── harness-core/                  ← L3 Rust · 11 source files
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs                 ← crate root, invariants
│   │   │   ├── inference.rs           ← ChatCompletion trait · InferenceRouter
│   │   │   ├── rollback_guard.rs      ← §8 SLA + §15 <30s rollback
│   │   │   ├── error.rs               ← HarnessError · IntoResponse mapping
│   │   │   ├── config.rs              ← typed config from env + TOML
│   │   │   ├── observability.rs       ← OTLP + Prometheus + record_latency! macro
│   │   │   ├── permissions.rs         ← JWT + 7-role RBAC + §16 tenant isolation
│   │   │   ├── rag.rs                 ← pgvector retrieval
│   │   │   ├── sla.rs                 ← enforce() wrapper
│   │   │   ├── tools.rs               ← sandboxed tool registry
│   │   │   └── bin/gateway.rs         ← the runnable binary
│   │   └── tests/
│   │       └── compat_suite.rs        ← §7 contract tests (6 engines)
│   │
│   ├── file-parsers/                  ← AEC Rust parsers
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                 ← unified Parser trait · parse_auto()
│   │       ├── dwg.rs                 ← acadrust 0.3.4 + dxf 0.6.1
│   │       ├── ifc.rs                 ← ifc-lite-core 2.1.9 + bimifc-parser 0.2.0
│   │       ├── pdf.rs                 ← pdf_oxide 0.3.34 + lopdf 0.40.0
│   │       └── xml.rs                 ← quick-xml 0.39.2
│   │
│   ├── shared/                        ← shared domain types
│   │   ├── Cargo.toml
│   │   └── src/lib.rs                 ← ModuleId · Project · BoqItem · ComplianceFinding
│   │
│   ├── agent-orchestrator/            ← L4 Python LangGraph
│   │   ├── pyproject.toml             ← Python 3.14 · AI stack uses bounded ranges during development; release uses lock/constraints
│   │   ├── AGENTS.md                  ← 37 lines · Constitution §13 compliant
│   │   ├── src/architoken_agent/
│   │   │   ├── __init__.py
│   │   │   ├── settings.py            ← pydantic BaseSettings
│   │   │   ├── state.py               ← ModuleId · AgentRole · PhaseState TypedDict
│   │   │   ├── inference.py           ← HTTP client to Rust Gateway · §9 role models
│   │   │   ├── prompts.py             ← @lru_cache loader
│   │   │   ├── module_graph.py         ← 3-role LangGraph factory (planner→gen→eval)
│   │   │   ├── modules.py              ← 9 compiled graphs registry
│   │   │   └── main.py                ← FastAPI app · /v1/agents/invoke
│   │   ├── prompts/                   ← 27 prompt files · module registry × 3 roles
│   │   │   ├── pre_sales/{planner,generator,evaluator}.md
│   │   │   ├── concept/{planner,generator,evaluator}.md
│   │   │   ├── develop/{planner,generator,evaluator}.md
│   │   │   ├── costing/{planner,generator,evaluator}.md
│   │   │   ├── production_manufacturing/{planner,generator,evaluator}.md
│   │   │   ├── logistics/{planner,generator,evaluator}.md
│   │   │   ├── construction/{planner,generator,evaluator}.md
│   │   │   ├── acceptance/{planner,generator,evaluator}.md
│   │   │   └── operations/{planner,generator,evaluator}.md
│   │   └── tests/
│   │       ├── conftest.py
│   │       └── test_modules.py
│   │
│   └── migrations/                    ← SQL
│       ├── 20260419000001_initial_schema.sql  ← tables + enums + indexes + pgvector
│       ├── 20260419000002_rls_policies.sql    ← §16 RLS force-enabled
│       └── seeds/
│           └── 001_anchor_jinping.sql         ← 应舍美居·锦屏 demo data
│
├── 05-infra/
│   ├── docker/
│   │   ├── Dockerfile.gateway         ← Rust multi-stage + cargo-deny + distroless
│   │   ├── Dockerfile.agent           ← Python 3.14 + uv + pip-licenses
│   │   ├── Dockerfile.frontend        ← Bun 1.3.13 build · Node 25 runtime
│   │   ├── docker-compose.yml         ← full local stack
│   │   ├── otel-collector.yaml
│   │   └── prometheus.yaml
│   ├── k8s/
│   │   ├── 00-namespace.yaml          ← PSS restricted + default-deny netpol
│   │   ├── 01-config.yaml             ← ConfigMap + Secret template
│   │   ├── 10-gateway.yaml            ← Deployment + Service + HPA 3-20 + NetPol
│   │   ├── 20-agent.yaml              ← Deployment + HPA 2-10
│   │   ├── 30-frontend.yaml           ← Deployment 3 replicas
│   │   └── 90-ingress.yaml            ← nginx + HSTS + cert-manager
│   ├── rainbond/
│   │   └── template.yaml              ← Rainbond 6.7.1 one-click for China
│   └── ci/
│       ├── ci.yml
│       └── release.yml
│
├── 06-workers/
│   ├── architoken_workers/            ← CAD, document, GIS, openBIM, OCR workers
│   └── tests/                         ← worker contract tests
│
├── 07-deployment/
│   └── runbook.md                     ← 325 lines · operator guide
│
├── 08-sdk/
│   ├── README.md                      ← how to regenerate
│   └── openapitools.json              ← 7-language SDK generator config
│
└── 03-frontend/tests/e2e/
    └── landing.spec.ts                ← Playwright 1.59.1 E2E
```

---

## Constitutional compliance matrix

| § | Article | Evidence |
|---|---------|----------|
| §1 | Agent = Model + Harness | `InferenceRouter` is the only entry; direct engine calls rejected |
| §2 | Model floor, Harness ceiling | 6 engines hot-swap; model list is config, not code |
| §3 | 100% Apache/MIT/BSD | `deny.toml` + `license-checker` + `pip-licenses` in CI |
| §4 | Reproducible dependencies | Development may use bounded compatible ranges for fast-moving ecosystems; release/CI/deployment artifacts are fixed by lockfiles, constraints, image digests or release tags. |
| §5 | OpenAPI 3.1 single source | `04-backend/openapi.yaml` + `openapitools.json` |
| §6 | Unidirectional L0→L7 | cargo workspace dependency graph + eslint-plugin-boundaries |
| §7 | 6 engines OpenAI-compatible | `ChatCompletion` trait + `compat_suite.rs` |
| §8 | SLA 60/90/180/180 s | `SlaCategory::max_duration()` + `sla::enforce()` |
| §9 | AI does not self-evaluate | Planner, Generator, and Evaluator are separate router roles |
| §10 | LLM whitelist | ArchIToken role aliases + gateway enforcement |
| §11 | 5-defect defense | 5 sections in `11-security.md` (see PRD §5) |
| §12 | Front-end single path | No `vue` dependency anywhere in repo |
| §13 | AGENTS.md < 100 lines | `agent-orchestrator/AGENTS.md` is 37 lines |
| §14 | Constraints > guidance | Evaluator prompts say "judge, don't rewrite" |
| §15 | RollbackGuard < 30 s | `assert!(elapsed < Duration::from_secs(30))` |
| §16 | Multi-tenant isolation | RLS FORCE on every tenant-scoped table |
| §17 | Chinese path CI-gated | Rainbond template + LMDeploy (Qwen/GLM) |
| §18 | Rust for backend | Only Python is LangGraph (§4 exception) |
| §19 | AIA is rider not executor | CI automates; AIA approves, doesn't babysit |

---

## How to actually start

```bash
# 1. Extract
tar xzf architoken-v2.0-complete.tar.gz
cd architoken

# 2. Read in this order
cat README.md
cat 02-architecture/CONSTITUTION.md
cat 02-architecture/ARCHITECTURE.md
cat 01-product/PRD.md

# 3. Local dev stack (requires Docker 28+)
cd 05-infra/docker
docker compose up -d

# 4. CI validation (runs against your clone)
cd ../../04-backend
cargo deny check
cargo test

cd ../03-frontend
bun install --frozen-lockfile
bun run lint && bun run typecheck && bun run test

cd ../04-backend/agent-orchestrator
uv pip install -e ".[dev]"
pytest
```

---

---

## 2026-04-23 · 14 模块并列架构重构 (Phase 1 · 文档层)

Architecture reset: 9 "business phases" (enum) → **11 "modules" (runtime registry)**. Documentation-only commit; code refactor follows in Phases 2-4.

**New files**:
- `02-architecture/MODULES.md` — 11-module spec (id, zh/en name, order, description, inputs/outputs, prompt_dir, tables, old→new migration map)
- `02-architecture/MODULE-REGISTRY.md` — registry mechanism spec (Rust `trait Module + ModuleRegistry`, Python `@dataclass ModuleSpec + dict`, SQL `modules` table); add/remove module checklists; runtime invariants

**Updated files**:
- `README.md` — `## Nine business phases` → `## 14 modules (registry-based · pluggable)`; removed "智灵姐 · Harness 时代" quote attribution, kept "模型决定下限, Harness 决定上限" slogan
- `01-product/PRD.md` — §2 rewritten: 11-module table, each row shows id/zh_name/inputs/outputs/SLA; §2.2 项目管理 dashboard now 11-module; §6 success metric 14 模块 closed-loop
- `02-architecture/CONSTITUTION.md` — 2026-04-23 修正 note at top; §8 SLA now per-`module_id` via `sla_budgets` table; §9 prompt-tree invariant strengthened; version footer updated
- `02-architecture/ARCHITECTURE.md` — new §3.3 "14 模块注册图" (ASCII diagram with side-car + global-reference callouts); old §3.3 容错与回滚 renumbered to §3.4
- `CLAUDE.md` — repo-structure table now lists MODULES.md / MODULE-REGISTRY.md; agent-orchestrator breakdown uses modules.py / module_graph.py / 11 prompt subdirs; term unified to "module" (never "phase")
- `CHANGELOG.md` — `[Unreleased]` entry added

**Architecture commitments** recorded:
- 14 modules completely peer-level; no business-vs-horizontal split
- Rust trait + registry (not enum); Python dataclass + dict (not Enum); SQL modules table (not ENUM type)
- Future modules add/remove by registering; existing code untouched
- `settings_center` is a side-car (no inputs/outputs); `standard_library` is a global reference resource
- `construction` + `acceptance` merged into `construction_supervision`

**Next phases** (each one commit, stop for ACK between):
- Phase 2 · Rust: remove `ModuleId` enum; scaffold `04-backend/shared/src/modules/` with 11 trait-impl structs + `Lazy` global REGISTRY
- Phase 3 · Python: `modules.py` → `modules.py`; `module_graph.py` → `module_graph.py`; `git mv` 14 prompt dirs + create 3 new (`standard_library` · `digital_archive` · `settings_center`)
- Phase 4 · DB + OpenAPI: new migrations for `modules` table + business FKs; `openapi.yaml` enum → registry reference

---

**End of manifest.**
