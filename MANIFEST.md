# ArchIToken · Repository Manifest

**Status**: active working repository
**Updated**: 2026-05-16
**License**: Apache-2.0 OR MIT
**Development entry**: `AGENTS.md` for ChatGPT / Codex

---

## 1. Positioning

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

ArchIToken is not a clone or direct replacement for Revit, Tekla, PKPM, Glodon, ZWCAD, Siemens Building X or similar mature single-point products. It is the open engineering intelligence layer above those tools.

---

## 2. Root Files

| File | Role | Current status |
|---|---|---|
| `AGENTS.md` | ChatGPT / Codex development-agent instruction entry | active |
| `README.md` | Repository entrypoint and architecture reading order | active |
| `LICENSE` | Apache-2.0 license text | active |
| `LICENSE-MIT` | MIT license text | active |
| `SECURITY.md` | Vulnerability reporting and security model | active |
| `CONTRIBUTING.md` | Contributor and PR rules | active |
| `CODE_OF_CONDUCT.md` | Community conduct policy | active |
| `CHANGELOG.md` | Human-readable change log | active |
| `versions.toml` | Version and upstream reference registry | active |
| `.env.production.example` | Production environment template | active |
| `.env.phase7.example` | Phase 7 runtime environment template | active |
| `docker-compose.production.yml` | Production-oriented compose entry | active |
| `docker-compose.phase7.yml` | Phase 7 local runtime compose entry | active |
| `docker-compose.phase8-scale.yml` | Phase 8 scale-test compose entry | active |

`CLAUDE.md`, tracked `.claude/` files and `docs/ZED-CLAUDE-CODE-SETUP.md` are retired. Claude / Anthropic references may remain only as optional model-provider adapters, historical changelog entries or reference material.

---

## 3. Source Of Truth

Read in this order:

1. `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md`
2. `02-architecture/CONSTITUTION.md`
3. `02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md`
4. `02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md`
5. `AGENTS.md`
6. `02-architecture/MODULES.md`
7. `02-architecture/MODULE-REGISTRY.md`
8. `02-architecture/ARCHITECTURE.md`
9. `01-product/PRD.md`
10. `README.md`

---

## 4. Repository Layout

| Path | Role |
|---|---|
| `.github/` | GitHub issue, PR and workflow templates |
| `01-product/` | Product requirements and market scope |
| `02-architecture/` | Constitution, architecture, module registry and positioning truth |
| `03-frontend/` | Next.js / React / TypeScript primary production frontend workbench |
| `03-frontend-vite/` | Experimental Phase 7 Open AEC sidecar workbench; not the production primary frontend |
| `04-backend/` | Rust backend and Python agent orchestrator |
| `05-infra/` | Docker, Kubernetes, runtime, observability and scale infrastructure manifests |
| `06-workers/` | CAD, BIM, Office, PDF, GIS, media and AI worker adapters |
| `07-deployment/` | Deployment runbooks |
| `08-sdk/` | SDK generation and API client contracts |
| `config/` | Shared seed configuration such as the technology radar |
| `docs/` | Supporting technical notes, patches and historical records |
| `infra/` | Phase 8 runtime, observability and scale baseline manifests |
| `tools/` | Local tooling and load-test utilities |

---

## 5. Active Module Model

ArchIToken uses 16 peer modules through registry-based contracts:

```text
personal_center
marketing_service
planning_management
concept_design
standard_library
detailed_design
quantity_costing
material_logistics
production_manufacturing
construction_management
digital_twin
digital_archive
finance_management
human_resources
ai_center
settings_center
```

Modules must share the same platform shell, Open CDE file workbench, lifecycle, approval, audit, AI assistant and business-object workflow. `/app/modules/digital_twin` is not an isolated digital twin cockpit; standalone `/app/digital-twin` is retired and must not be reintroduced as a separate product entry.

---

## 6. Engineering Constraints

- Registry replaces hardcoded Enum for modules, tools, models, renderers, workflows and rules.
- Every module, term, rule and AI output must bind to professional roles, regulators, standards/codes, evidence and review state across AEC, production, logistics, customs, tax, finance, accounting, HR, organization, AI, data, cybersecurity and software.
- AI calls must route through internal ModelRouter / InferenceRouter / ToolRouter / WorkflowRouter boundaries.
- Generator and Evaluator must remain separated through Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver.
- Default frontend theme is `wechat_light`, a WeChat-style white/gray/green product shell.
- WebGPU is the primary high-performance rendering path; Three.js is fallback and ecosystem layer.
- External providers, including OpenAI and Anthropic, are runtime adapter choices, not project identities.
- Security-critical actions must be auditable: files, lifecycle, approvals, model calls, tool calls and worker derivatives.

---

## 7. Validation

Common checks:

```bash
cd 03-frontend
bun run lint
bun run typecheck
bun run test
bun run build

cd ../04-backend
cargo check
cargo test

cd agent-orchestrator
pytest
```

Run only the checks relevant to the files touched by a change when working locally, but CI should remain strict.
