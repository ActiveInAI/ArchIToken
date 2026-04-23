# InsomeOS v2.0 · Final Delivery Manifest

**Status**: ✅ Complete · 113 files · 492 KB
**Date**: 2026-04-19
**Archive**: `insomeos-v2.0-complete.tar.gz` (97 KB compressed)
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
insomeos/
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
│   └── PRD.md                         ← 3 personas · 9 phases · NFR · market · risks
│
├── 02-architecture/
│   ├── ARCHITECTURE.md                ← 8 layers, every version @x.y.z
│   └── CONSTITUTION.md                ← 19 articles, CI-enforced
│
├── 03-frontend/                       ← Next.js 16.2.4 · React 19.2.5 (single path)
│   ├── package.json                   ← all deps pinned =x.y.z
│   ├── next.config.mjs                ← Turbopack, RSC, CSP headers
│   ├── tsconfig.json                  ← strict, noUncheckedIndexedAccess
│   ├── tailwind.config.ts             ← v4.2.2 with design tokens
│   ├── app/
│   │   ├── layout.tsx                 ← root RSC layout
│   │   ├── page.tsx                   ← landing (hero + 9 phases + feature grid)
│   │   ├── globals.css                ← tailwind v4 @theme block
│   │   └── app/projects/page.tsx      ← project list (uses lib/api.ts)
│   ├── components/
│   │   ├── Providers.tsx              ← React Query 5.99.1
│   │   └── BIMViewer.tsx              ← Three.js 0.184.0 + @react-three/fiber 9.6.0
│   └── lib/
│       └── api.ts                     ← typed REST client (projects + agents + harness)
│
├── 04-backend/
│   ├── Cargo.toml                     ← Rust 1.95.0 workspace, 40+ crates pinned =x.y.z
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
│   │   └── src/lib.rs                 ← BusinessPhase · Project · BoqItem · ComplianceFinding
│   │
│   ├── agent-orchestrator/            ← L4 Python LangGraph
│   │   ├── pyproject.toml             ← Python 3.14 · langgraph 1.1.8 · all ==x.y.z
│   │   ├── AGENTS.md                  ← 37 lines · Constitution §13 compliant
│   │   ├── src/insomeos_agent/
│   │   │   ├── __init__.py
│   │   │   ├── settings.py            ← pydantic BaseSettings
│   │   │   ├── state.py               ← BusinessPhase · AgentRole · PhaseState TypedDict
│   │   │   ├── inference.py           ← HTTP client to Rust Gateway · §9 role models
│   │   │   ├── prompts.py             ← @lru_cache loader
│   │   │   ├── phase_graph.py         ← 3-role LangGraph factory (planner→gen→eval)
│   │   │   ├── phases.py              ← 9 compiled graphs registry
│   │   │   └── main.py                ← FastAPI app · /v1/agents/invoke
│   │   ├── prompts/                   ← 27 prompt files · 9 phases × 3 roles
│   │   │   ├── pre_sales/{planner,generator,evaluator}.md
│   │   │   ├── concept/{planner,generator,evaluator}.md
│   │   │   ├── develop/{planner,generator,evaluator}.md
│   │   │   ├── costing/{planner,generator,evaluator}.md
│   │   │   ├── fabrication/{planner,generator,evaluator}.md
│   │   │   ├── logistics/{planner,generator,evaluator}.md
│   │   │   ├── construction/{planner,generator,evaluator}.md
│   │   │   ├── acceptance/{planner,generator,evaluator}.md
│   │   │   └── operations/{planner,generator,evaluator}.md
│   │   └── tests/
│   │       ├── conftest.py
│   │       └── test_phases.py
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
├── 09-testing/
│   └── landing.spec.ts                ← Playwright 1.59.1 E2E
│
├── 07-deployment/
│   └── runbook.md                     ← 325 lines · operator guide
│
└── 08-sdk/
    ├── README.md                      ← how to regenerate
    └── openapitools.json              ← 7-language SDK generator config
```

---

## Constitutional compliance matrix

| § | Article | Evidence |
|---|---------|----------|
| §1 | Agent = Model + Harness | `InferenceRouter` is the only entry; direct engine calls rejected |
| §2 | Model floor, Harness ceiling | 6 engines hot-swap; model list is config, not code |
| §3 | 100% Apache/MIT/BSD | `deny.toml` + `license-checker` + `pip-licenses` in CI |
| §4 | Patch-pinned @x.y.z | Every version in every file: `=1.48.0`, `16.2.4`, `1.1.8` etc. |
| §5 | OpenAPI 3.1 single source | `04-backend/openapi.yaml` + `openapitools.json` |
| §6 | Unidirectional L0→L7 | cargo workspace dependency graph + eslint-plugin-boundaries |
| §7 | 6 engines OpenAI-compatible | `ChatCompletion` trait + `compat_suite.rs` |
| §8 | SLA 60/90/180/180 s | `SlaCategory::max_duration()` + `sla::enforce()` |
| §9 | AI does not self-evaluate | `DEFAULT_ROLE_MODELS` uses 3 different models |
| §10 | LLM whitelist | `whitelisted_models` list + gateway enforcement |
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
tar xzf insomeos-v2.0-complete.tar.gz
cd insomeos

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

**End of manifest.**
