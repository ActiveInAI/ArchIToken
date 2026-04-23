# InsomeOS · AEC Harness for LLMs

> **模型决定下限,Harness 决定上限。**
> — 智灵姐 · *Harness 时代,谁在驾驭 AI 这匹野马* · 2026-04-14

[![License](https://img.shields.io/badge/License-Apache--2.0%20%2F%20MIT-blue.svg)](./LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.95.0-orange)](https://www.rust-lang.org/)
[![Python](https://img.shields.io/badge/Python-3.14-yellow)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black)](https://nextjs.org/)
[![Version](https://img.shields.io/badge/version-2.0.0-brightgreen)](./CHANGELOG.md)

InsomeOS is an open-source **Harness** that lets general-purpose LLMs do safe, reliable work in the **Architecture · Engineering · Construction (AEC)** industry. It's not another AI tool; it's the system engineering around the model.

```
Agent = Model + Harness
                ▲
                └── InsomeOS lives here
```

---

## The decision we made

Previous drafts tried "React **and** Vue" as a dual-track frontend. For a one-person company, **that doubled maintenance and halved focus**. v2.0 is single-path:

| Choice | Decision | Why |
|--------|----------|-----|
| Frontend | **Next.js 16.2.4 + React 19.2.5** | One stack, one SDK, one design system |
| Backend | **Rust 1.95.0** (axum 0.8.9) | 50+ AEC file formats need zero-GC parallel parsing |
| Agents | **LangGraph 1.1.8** (Python 3.14) | Mature graph semantics, 3-role Harness (planner/generator/evaluator) |
| Data | **Supabase 1.26.04** + **Valkey 9.0.3** | Apache-2.0 / BSD-3; zero SSPL risk |
| Inference | **6 engines, hot-swap** | vLLM · SGLang · TensorRT-LLM · LMDeploy · Ollama · llama.cpp |

All dependencies are pinned at patch level (`=x.y.z`). The build is reproducible.

---

## Repository layout

```
insomeos/
├── 01-product/            PRD, personas, success metrics
├── 02-architecture/       ARCHITECTURE.md, CONSTITUTION.md (19 articles)
├── 03-frontend/           Next.js 16 · React 19 · Tailwind 4 · Three.js r184
├── 04-backend/
│   ├── Cargo.toml         Rust workspace
│   ├── harness-core/      L3 — InferenceRouter, RollbackGuard, RAG, RBAC
│   ├── file-parsers/      DWG / DXF / IFC / STEP / PDF / XML
│   ├── shared/            Domain types (Project, BoqItem, ComplianceFinding)
│   ├── agent-orchestrator/  L4 · LangGraph · 9 phases × 3 prompts
│   ├── migrations/        PostgreSQL schema + RLS policies
│   ├── openapi.yaml       Single source of truth for all SDKs
│   └── deny.toml          cargo-deny config (§3 license gate)
├── 05-infra/
│   ├── docker/            Dockerfile per service + local compose
│   ├── k8s/               Kubernetes manifests (namespace → ingress)
│   ├── rainbond/          China one-click PaaS template
│   └── ci/                GitHub Actions (ci.yml, release.yml)
├── 09-testing/            E2E (Playwright) · integration · contract
├── 07-deployment/         Production runbook
└── 08-sdk/                Auto-generated clients: TS / Py / Rust / Go / Java / Swift / Kotlin
```

---

## Quickstart (local)

```bash
git clone https://github.com/ActiveInAI/insomeos.git
cd insomeos
docker compose -f 05-infra/docker/docker-compose.yml up -d
# → frontend at http://localhost:3000
# → gateway  at http://localhost:8080
# → agent    at http://localhost:7001
```

---

## Nine business phases

```
售前 → 方案 → 深化 → 造价 → 制造 → 物流 → 施工 → 验收 → 运维
```

Each phase is a LangGraph compiled from three prompts (`prompts/<phase>/{planner,generator,evaluator}.md`). Every output is judged by an **independently-modeled evaluator** before it leaves the Harness (Constitution §9).

---

## Constitution (19 articles · CI-enforced)

Not soft guidelines — violations fail CI. Highlights:

- §3 · 100 % Apache / MIT / BSD; no AGPL / GPL / SSPL ever
- §4 · every version pinned `=x.y.z`
- §7 · all 6 inference engines speak OpenAI-compatible protocol
- §8 · SLA budgets: 60 s / 90 s / 180 s / 180 s, enforced by `RollbackGuard`
- §9 · generator and evaluator MUST be different models
- §15 · rollback < 30 s on sustained failure
- §16 · multi-tenant isolation via PostgreSQL RLS — no exceptions

Read the full text: [`02-architecture/CONSTITUTION.md`](./02-architecture/CONSTITUTION.md)

---

## Anchor case · 应舍美居·锦屏

InsomeOS's first production target is a 520 ㎡ three-storey heavy-steel villa in 贵州黔东南, Q355B structure, 300 mm grid, 45-day delivery, ¥680k budget. Real project; real forcing function. When the system can close that project's nine phases end-to-end, v2.0 has succeeded.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). tl;dr — read the Constitution first, open an RFC before touching anything in `02-architecture/`, and keep every dependency patch-pinned.

## License

Apache-2.0 OR MIT · maintainer: [ActiveInAI](mailto:ActiveInAI@outlook.com)

## Lineage

```
Pan.AI (2022-12) → PanAEC → AEC-OS → ArchTwin OS → Baja1000 → InsomeOS (2026-04)
```
