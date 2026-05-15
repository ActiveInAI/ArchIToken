# Contributing to ArchIToken

Thank you for your interest. ArchIToken has a strict engineering culture. Please read this entirely before opening your first PR.

## 1. Read the Truth Sources First

Start with [`AGENTS.md`](./AGENTS.md), then read:

1. [`02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md`](./02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md)
2. [`02-architecture/CONSTITUTION.md`](./02-architecture/CONSTITUTION.md)
3. [`02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md`](./02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md)
4. [`02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md)
5. [`02-architecture/MODULES.md`](./02-architecture/MODULES.md)
6. [`02-architecture/BUSINESS_MODULE_WORKBENCH.md`](./02-architecture/BUSINESS_MODULE_WORKBENCH.md)

The Constitution currently has 22 articles. They are not suggestions; every one is expected to become CI-enforced.

ArchIToken's fixed positioning is:

```text
ArchIToken = AEC AI Harness + Open CDE + Module Workflow OS
```

Do not describe ArchIToken as a clone or direct replacement for Revit, Tekla, PKPM, Glodon, ZWCAD, Siemens Building X or other mature single-point products.

Every module, term, business rule and AI output must bind to the relevant professional role, regulator, jurisdiction, standard/code source, evidence chain and review state. This covers AEC, production, logistics, customs, tax, finance, accounting, HR, organization governance, AI, data, cybersecurity and software engineering. Missing source means the output is a heuristic suggestion, not a professional compliance conclusion.

Common PR rejections:

- Added AGPL/GPL/SSPL/BUSL into distributed runtime without an isolation and license review.
- Hard-coded a module/model/tool enum where Registry is required.
- Bypassed ModelRouter, InferenceRouter, ToolRouter or WorkflowRouter.
- Used the same model or process as both Generator and Evaluator for critical output.
- Changed API, schema, module behavior or UI workbench contracts without updating the relevant Markdown and tests.
- Produced "compliant", "construction-ready", "submission-ready" or "acceptance-ready" output without professional source, evidence and review state.
- Turned a module into an isolated landing page, marketing page, dashboard or single-product clone.
- Made `/app/modules/digital_twin` diverge from the unified Open CDE module workbench.
- Changed the default WeChat-style white/green frontend theme without an explicit product decision.

## 2. Development loop

### 2.1 Setup

```bash
# Rust
rustup install 1.95.0
rustup default 1.95.0
cargo install cargo-deny@=0.18.5 cargo-chef@=0.1.71 cargo-nextest@=0.9.109

# Python
pip install uv==0.5.14

# Frontend
curl -fsSL https://bun.sh/install | bash
bun upgrade --stable   # → 1.3.13

# Dev stack
docker compose -f docker-compose.production.yml config
```

### 2.2 Common commands

```bash
# Rust
cd 04-backend
cargo fmt
cargo clippy --all-targets --all-features -- -D warnings
cargo nextest run
cargo deny check   # must pass

# Python
cd 04-backend/agent-orchestrator
ruff check src tests
mypy src
pytest

# Frontend
cd 03-frontend
bun run lint
bun run typecheck
bun run test
bun run build
```

## 3. Pull request checklist

Every PR MUST include:

- [ ] `cargo deny check` passes (no new non-permissive license)
- [ ] Version and dependency changes follow the current version policy in `versions.toml` and lockfiles
- [ ] If you changed an API surface, you updated OpenAPI / AsyncAPI / JSON Schema and regenerated SDKs where applicable
- [ ] If you touched `02-architecture/`, you updated the source-of-truth chain or wrote an RFC first
- [ ] CI is green on your branch
- [ ] You added or updated tests
- [ ] You updated `CHANGELOG.md`

## 4. Commit style

```
<type>(<scope>): <short summary>

<body — why, not what>

Refs: CONSTITUTION <article number>
```

Types: `feat`, `fix`, `docs`, `perf`, `refactor`, `test`, `chore`, `revert`.

## 5. Architecture changes (RFCs)

Changes to `02-architecture/` require an RFC:

1. Create `docs/rfcs/YYYY-MM-DD-<slug>.md`
2. Use the RFC template at `docs/rfcs/TEMPLATE.md`
3. Open a PR tagged `rfc`
4. Wait ≥ 7 calendar days for review
5. Once accepted, update `CONSTITUTION_HISTORY.md`

## 6. Model Routing

Do not hard-code vendor model versions in docs, prompts, UI, or tests.
Repository defaults use stable ArchIToken role aliases:

```text
architoken-planner
architoken-generator
architoken-evaluator
```

Deployment maps those aliases to real provider models through environment or
secret-managed runtime config. Model changes are deployment changes unless they
alter the public contract or evaluation policy.

OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, vLLM, LM Studio and other providers are runtime options behind adapters. They are not project identities.

## 7. Security

Please disclose vulnerabilities privately to `ActiveInAI@outlook.com`. Do NOT file public issues. See [`SECURITY.md`](./SECURITY.md).

## 8. Code of conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## 9. Licensing of your contribution

By submitting a PR, you agree your code is dual-licensed under Apache-2.0 OR MIT, matching the project.

---

**Need help?** Open an issue with the `question` label.
