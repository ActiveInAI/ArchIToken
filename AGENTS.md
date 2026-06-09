# AGENTS.md · ArchIToken

This file is the current development-agent instruction entry for ChatGPT / Codex work in this repository.

`CLAUDE.md` and tracked `.claude/` files are retired. Claude, Anthropic and other providers may remain as optional runtime/model adapters, but they are not the active repository development identity or instruction source.

---

## 1. Project Identity

- **Project**: ArchIToken
- **Repository / codebase name**: ArchIToken
- **Positioning**: AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
- **Owner**: AIA · One-Person Company
- **Default language**: Simplified Chinese for collaboration
- **Current development assistant**: ChatGPT / Codex

ArchIToken is not a clone or direct replacement for Revit, Tekla, PKPM, Glodon, ZWCAD, Siemens Building X or similar mature single-point products. It is the open engineering intelligence layer above those tools. `ArchIToken` is the active product, repository, codebase and package/API compatibility name.

---

## 2. Source Of Truth

Read these before changing architecture, product scope, module behavior or frontend workbench structure:

1. `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md`
2. `02-architecture/CONSTITUTION.md`
3. `02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md`
4. `02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md`
5. `02-architecture/MODULES.md`
6. `02-architecture/MODULE-REGISTRY.md`
7. `02-architecture/ARCHITECTURE.md`
8. `02-architecture/BUSINESS_MODULE_WORKBENCH.md`
9. `docs/03_ARCHITOKEN_TECH_STACK.md`

Any mismatch between chat context and repository Markdown must be resolved by updating repository documents or following the documents.

---

## 3. Non-Negotiable Rules

1. Do not invent versions, APIs, benchmark claims or competitor claims. Verify from repository truth or primary sources.
2. Every platform module, term, rule and AI output must respect the relevant professional role, regulator, jurisdiction, national/industry/local/foreign standards, technical code, contract and organization policy.
3. This applies across AEC, production, logistics, customs, tax, finance, accounting, HR, organization governance, AI, data, cybersecurity and software engineering.
4. Missing professional or regulatory source means the system may only output a heuristic suggestion, not "compliant", "non-compliant", "construction-ready", "submission-ready", "acceptance-ready", "customs-ready", "tax-ready", "posting-ready", "payment-ready" or "publish-ready".
5. Do not turn modules into isolated landing pages, marketing pages, dashboards or single-product clones.
6. `/app/modules/digital_twin` must use the same Open CDE module workbench as other modules. Standalone `/app/digital-twin` is retired and must not be reintroduced as a separate product entry.
7. Keep `wechat_light` as the default white/green theme unless the user explicitly chooses another theme.
8. Use Registry over hardcoded Enum for modules, models, tools, renderers, schemas, workflows and rules.
9. Route AI calls through internal Router / ModelRouter / InferenceRouter abstractions. Direct vendor calls in business logic are not allowed.
10. Generator and Evaluator must remain separated through Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver.
11. Do not introduce GPL/AGPL/SSPL/BUSL into distributed runtime without an explicit isolation and license review.
12. Preserve user changes in dirty worktrees. Never revert unrelated files.
13. Keep docs, tests and implementation aligned when changing behavior.
14. Use `ArchIToken` as the active product, repository and compatibility name in user-facing UI, docs and release surfaces. Do not introduce alternate active product identities unless the source-of-truth documents are intentionally updated.

---

## 4. Repository Shape

| Path | Role |
|---|---|
| `01-product/` | Product requirements |
| `02-architecture/` | Constitution, architecture, modules and registry truth |
| `03-frontend/` | Next.js / React / TypeScript frontend workbench |
| `04-backend/` | Rust backend and Python agent orchestrator |
| `05-infra/` | Docker, Kubernetes, deployment, runtime, observability and scale infrastructure |
| `06-workers/` | CAD, BIM, Office, PDF, GIS, media and AI workers |
| `07-deployment/` | Runbooks and deployment guidance |
| `08-sdk/` | Generated and planned SDK contracts |
| `docs/` | Supporting technical records |

---

## 5. Frontend Workbench Rules

- The product shell must be consistent across all 16 modules.
- Top duplicate/split business entry bands are not allowed.
- File system, lifecycle, approval, audit, AI assistant, business objects and operation queue belong to the unified workbench.
- Digital twin module entry is not a special full-screen exception.
- Prefer D3, React Flow, Mermaid and bpmn-js style clear data visualization where the module needs graph, flow, chart, gantt or topology views.
- Keep visual language aligned with WeChat-style white/gray/green controls.

---

## 6. Runtime Provider Boundary

OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, vLLM, LM Studio and other providers are runtime options behind adapters.

They are not project identities. The repository must avoid files that make a specific vendor assistant the authoritative development source unless the user explicitly switches the development workflow.
