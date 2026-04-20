# Contributing to InsomeOS

Thank you for your interest. InsomeOS has a strict engineering culture — please read this entirely before opening your first PR.

## 1. Read the Constitution first

Open [`02-architecture/CONSTITUTION.md`](./02-architecture/CONSTITUTION.md) and read all 19 articles. They're not suggestions; every one is CI-enforced.

Common PR rejections:

- § 3 — introduced an AGPL/GPL/LGPL/SSPL dependency
- § 4 — used `^x.y.z` or `~x.y.z` instead of `=x.y.z`
- § 5 — changed an API response without updating `openapi.yaml` first
- § 6 — made L3 import from L5
- § 9 — used the same model for generator and evaluator
- § 12 — added Vue back into the frontend tree

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
bun upgrade --stable   # → 1.3.12

# Dev stack
docker compose -f 05-infra/docker/docker-compose.yml up -d
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
- [ ] All version bumps use `=x.y.z`
- [ ] If you changed an API surface, you updated `04-backend/openapi.yaml` and regenerated SDKs
- [ ] If you touched `02-architecture/`, you wrote an RFC first (see §5)
- [ ] CI is green on your branch
- [ ] You added or updated tests
- [ ] You updated `CHANGELOG.md`

## 4. Commit style

```
<type>(<scope>): <short summary>

<body — why, not what>

Refs: CONSTITUTION §<n>
```

Types: `feat`, `fix`, `docs`, `perf`, `refactor`, `test`, `chore`, `revert`.

## 5. Architecture changes (RFCs)

Changes to `02-architecture/` require an RFC:

1. Create `docs/rfcs/YYYY-MM-DD-<slug>.md`
2. Use the RFC template at `docs/rfcs/TEMPLATE.md`
3. Open a PR tagged `rfc`
4. Wait ≥ 7 calendar days for review
5. Once accepted, update `CONSTITUTION_HISTORY.md`

## 6. Model whitelist (Constitution §10)

Only approved models may be used:

```
claude-4.7-sonnet / claude-4.7-opus
gpt-5.2
qwen-3.5-max
glm-4.7-plus
deepseek-v3.2
gemma-4-27b
kimi-k2-preview
llama-4-70b
```

Propose a new model via RFC; the evaluation template in `docs/rfcs/TEMPLATE-model.md` walks you through the criteria.

## 7. Security

Please disclose vulnerabilities privately to `ActiveInAI@outlook.com`. Do NOT file public issues. See [`SECURITY.md`](./SECURITY.md).

## 8. Code of conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## 9. Licensing of your contribution

By submitting a PR, you agree your code is dual-licensed under Apache-2.0 OR MIT, matching the project.

---

**Need help?** Open an issue with the `question` label.
