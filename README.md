# ArchIToken · AEC Harness for LLMs

> **模型决定下限,Harness 决定上限。**

[![License](https://img.shields.io/badge/License-Apache--2.0%20%2F%20MIT-blue.svg)](./LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.95.0-orange)](https://www.rust-lang.org/)
[![Python](https://img.shields.io/badge/Python-3.14.0-yellow)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black)](https://nextjs.org/)
[![Version](https://img.shields.io/badge/version-2.1.0--architoken-brightgreen)](./CHANGELOG.md)

ArchIToken is an open-source **Harness** that lets general-purpose LLMs do safe, reliable work in the **Architecture · Engineering · Construction (AEC)** industry. It is the system engineering around the model — not another AI toy.

```text
Agent = Model + Harness
                ▲
                └── ArchIToken lives here
```

---

## Architecture truth source

ArchIToken uses GitHub documents as the engineering source of truth.

Read these first:

1. [`02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md`](./02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md)
2. [`02-architecture/CONSTITUTION.md`](./02-architecture/CONSTITUTION.md)
3. [`02-architecture/MODULES.md`](./02-architecture/MODULES.md)
4. [`02-architecture/MODULE-REGISTRY.md`](./02-architecture/MODULE-REGISTRY.md)
5. [`02-architecture/ARCHITECTURE.md`](./02-architecture/ARCHITECTURE.md)

---

## Core decisions

| Area | Decision | Principle |
|--------|----------|----------|
| Project identity | **ArchIToken** | Single active project identity |
| Engineering philosophy | **Technology serves goals** | No language/framework religion |
| Core backend | **Rust / Cxx first** | Python / Go / C++ / Perl / Shell / CUDA / WASM allowed when useful |
| Frontend | **Next.js 16.2.4 + React 19.2.5 + TypeScript 6.0.3 + WASM** | Application engineering base |
| Rendering | **WebGPU first, Three.js r184 compatible** | Three.js is ecosystem/compat layer, not the only rendering path |
| Registry | **Registry over Enum** | Modules, agents, tools, models, routers, renderers, geometry kernels, rules |
| Router | **Internal unified Router** | OpenRouter is only one external adapter, not the internal architecture |
| Schema | **OpenAPI + AsyncAPI + JSON Schema + IFC Schema + Module Schema** | Multi-schema truth system |
| Data | **Capability composition** | Structured, unstructured, vector, time-series, object, cache/state, audit |
| Cache/state | **Zedis first** | Not a single database religion |
| Deployment | **k8s + Docker + local private deployment** | Docker Compose for local dev, Kubernetes for production |
| AI gate | **Generator != Evaluator** | Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver |

---

## Repository layout

```text
architoken/
├── 01-product/             PRD, personas, success metrics
├── 02-architecture/        Constitution, source of truth, modules, registry, architecture
├── 03-frontend/            Next.js · React · TypeScript · WASM · WebGPU · Three.js compatibility
├── 04-backend/
│   ├── Cargo.toml          Rust workspace
│   ├── harness-core/       Router, RollbackGuard, RAG, RBAC, schema gates
│   ├── file-parsers/       DWG / DXF / IFC / STEP / PDF / XML
│   ├── shared/             Domain types, registries, module schema
│   ├── agent-orchestrator/ Agent orchestration adapters and prompt trees
│   ├── migrations/         PostgreSQL schema + RLS policies + module registry tables
│   ├── openapi.yaml        REST API contract
│   └── deny.toml           cargo-deny config
├── 05-infra/
│   ├── docker/             Dockerfile per service + local compose
│   ├── k8s/                Kubernetes manifests
│   ├── rainbond/           Optional China private deployment template
│   └── ci/                 GitHub Actions
├── 06-workers/             File conversion and domain worker adapters
├── 07-deployment/          Production runbook
├── 08-sdk/                 Auto-generated clients
└── 03-frontend/tests/e2e/  Playwright E2E tests
```

---

## Quickstart (local)

```bash
git clone https://github.com/ActiveInAI/ArchIToken.git
cd ArchIToken
docker compose -f 05-infra/docker/docker-compose.yml up -d
# → frontend at http://localhost:3000
# → gateway  at http://localhost:8080
# → agent    at http://localhost:7001
```

## 14 modules (registry-based · pluggable)

```text
 1 · marketing_service          · 市场客服
 2 · planning_management        · 计划管理
 3 · concept_design             · 方案设计
 4 · standard_library           · 标准族库
 5 · detailed_design            · 深化设计
 6 · quantity_costing           · 计量造价
 7 · material_logistics         · 材料物流
 8 · production_manufacturing   · 生产制造
 9 · construction_supervision   · 施工管理
10 · digital_twin               · 数字孪生
11 · digital_archive            · 数字档案
12 · finance_hr                 · 财务人力
13 · ai_center                  · AI中心
14 · settings_center            · 设置中心 (side-car)
```

All 14 modules are **peers** — no rigid “business vs. horizontal” split. Future modules can be added or retired through registry entries rather than global enum rewrites.

Registry mechanism:

```text
Rust:      trait Module + ModuleRegistry
Python:    ModuleSpec adapter when useful
Database:  modules table + module_id TEXT foreign keys
Frontend:  Module Schema driven UI
```

Implementation maturity: the gateway already exposes runtime capabilities, module files, transactions, generation, artifacts, openBIM, assets, conversion jobs, viewer commands, skills, MCP tools, and knowledge source routes. Many of these routes are intentionally **contract-first / in-memory preview** until the production PostgreSQL, object storage, model-provider, queue, and worker adapters are wired.

---

## Module expansion baseline

### Standard Library / 标准族库

Includes standards, family components, templates, materials, drawings, models, construction methods, rule libraries, and versioned engineering knowledge.

### Material Logistics / 材料物流

Includes inventory, suppliers, prices, purchase planning, cutting lists, BOM, packaging, loading, delivery, site stacking, receiving, loss control, and batch tracking.

### Production Manufacturing / 生产制造

Includes production planning, process routing, cutting optimization, CNC files, welding, coating, QC, MES/ERP integration, component coding, packaging, shipping, and progress feedback.

### Construction Management / 施工管理

Includes construction plans, schedule, quality, safety, logs, AR, 360 capture, 3D scanning, oblique photography, drones, construction robots, IoT, visual progress comparison, defect detection, rectification loop, and completion documents.

---

## Constitution (21 articles · CI-enforced)

Not soft guidelines — violations should fail CI.

Highlights:

- 第 3 条 · 技术服务目标,不做语言或框架信仰
- 第 6 条 · Registry 替代 Enum
- 第 7 条 · 多 Schema 协同真源
- 第 9 条 · 内部统一 Router,OpenRouter 只是外部适配器
- 第 12 条 · AI 不自评: Generator 与 Evaluator 分离
- 第 15 条 · 前端工程基座与 WebGPU 优先不冲突
- 第 16 条 · 数据库是能力组合,不是单一产品信仰
- 第 18 条 · 部署基线: k8s + Docker + 本地私有化
- 第 19 条 · 文档即环境,仓库文档是唯一真源
- 第 20 条 · 模块必须全面定义输入、输出、规则、Schema 与审计

Read the full text: [`02-architecture/CONSTITUTION.md`](./02-architecture/CONSTITUTION.md)

---

## Anchor case · 应舍美居·锦屏

ArchIToken's first production target is a 520 ㎡ three-storey heavy-steel villa in 贵州黔东南, Q355B structure, 300 mm grid, 45-day delivery, ¥680k budget. Real project; real forcing function. When the system can close the project's 14 modules end-to-end, the platform baseline has succeeded.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Read the Constitution first and open an RFC before touching core architecture. During active development, fast-moving ecosystems such as LangChain, LangGraph, OpenAI and Anthropic may use bounded compatible ranges; release, CI, deployment and production artifacts must remain reproducible through lockfiles, constraints files, image digests or explicit release tags.

## License

Apache-2.0 OR MIT · maintainer: [ActiveInAI](mailto:ActiveInAI@outlook.com)
