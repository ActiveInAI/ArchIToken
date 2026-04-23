# CLAUDE.md · InsomeOS

> 这份文件是 Claude Code 在 Zed 里干活时读到的第一个指令集。
> 单一事实源原则 (宪法 Article 2):`versions.toml` 是所有版本号的唯一权威来源。

---

## 项目身份

- **项目名**: InsomeOS (G6 · 继承 Baja1000 · 2026-04 改名)
- **所有者**: AIA · One-Person Company · `ActiveInAI@outlook.com`
- **位置**: 美国 · 默认简体中文沟通
- **硬件**: 2× NVIDIA DGX Spark (spark-insome001 / spark-insome002 · ARM64 + GB10 · 128GB 统一内存 · QSFP DAC 直连 192.168.100.0/24 · MTU 9000)
- **仓库根**: `~/dev/insomeos/`
- **开发环境**: Zed 编辑器 + Claude Code

---

## 7 事实源 (宪法 Article 2)

以下 7 个文件是 InsomeOS 的全部权威配置。任何不一致都是 CI 错误。

1. `versions.toml`           · 所有组件版本号的唯一来源
2. `CLAUDE.md`                · 本文件·Claude 工作指令
3. `constitution.toml`        · 19 条宪法 + CI 拦截配置
4. `deny.toml`                · cargo-deny 许可证 / 供应链黑名单
5. `.mcp.json`                · MCP 服务器配置
6. `rego/*.rego`              · OPA 策略·RLS / RBAC
7. `schemas/*.json`           · JSON Schema · 工程数据模型

---

## 关键纠错记录 (Claude 易错点)

Claude 过往在此项目上的高频错误,必须避免:

| 错误 | 正确 |
| --- | --- |
| 把项目叫 Pan.AEC | 叫 **InsomeOS** (旧名已退役) |
| 用 § 符号分节 | 用 **阿拉伯数字 + 中英文** ("1.1" / "Section 4" / "第 4 章") |
| 说"许可证只接受 Apache/MIT" | **Apache/MIT/BSD/MPL/PostgreSQL/ISC/Zlib** 全部允许 |
| 用 `^` `~` `*` `latest` | **严格 `@x.y.z` patch 锁定** |
| 编造训练数据里的版本号 | **只从 `versions.toml` 读** · 没有就问 AIA 要 GitHub 链接 |
| 写 PG 18.3 | PG baseline **16.13** · upgrade 目标 **17.6.0** (Supabase tag `17.6.0.066-disk-no-fail-sam-2`) |
| 写 Langfuse v4.x | Langfuse **v3.169.0** · Py SDK **v4.5.0** · JS SDK **v5.2.0** |
| 写 Next.js 16.2.4 | **16.2** (2026-03-18) · 16.2.4 不存在 |
| 写 React 19.2.1 / 19.2.2 | **19.2.5** |
| 写 TypeScript 5.9.2 | **6.0.3** (TS 6.0 GA 于 2026-03-23) |
| 写 Tailwind 4.1.13 | **v4.2.4** |
| 长篇 HTML 蓝图 | AIA 在 Zed 用 Claude Code · 要可执行的文件不要对话 |

> 本表于 2026-04-23-d patch 后与 versions.toml 3.4.0 对齐

---

## 仓库结构

实际目录布局为带序号的 `NN-xxx/` 惯例（按架构阶段排序），非 `apps/*` + `crates/*` 单体仓风格。

| 目录 | 作用 |
| --- | --- |
| `01-product/` | 产品需求 (PRD.md 等) |
| `02-architecture/` | 架构 · 宪法 (CONSTITUTION.md · ARCHITECTURE.md · PRINCIPLES.md) |
| `03-frontend/` | Next.js 16.2 + React 19.2.5 + TS 6.0.3 前端 |
| `04-backend/` | Rust 1.95.0 + axum 0.8.9 后端 (含 harness-core · agent-orchestrator · file-parsers · shared) |
| `05-infra/` | 基础设施 (k8s · k8s-cluster · k8s-manifests · docker · ci · rainbond · iceberg) |
| `06-agents/` | (待建) Agent Python 层 (Langfuse Py SDK · HermesAgent · LangGraph) |
| `07-deployment/` | 部署手册 (runbook.md) |
| `08-sdk/` | 客户端 SDK (openapitools.json) |
| `09-testing/` | E2E 测试 (Playwright · landing.spec.ts) |

---

## 技术栈概要 (详见 `versions.toml`)

### 前端 (03-frontend/)
- Next.js 16.2 + React 19.2.5 + TypeScript 6.0.3 + Tailwind v4.2.4
- Bun 1.3.13 + Turbopack + Utoo
- `@supabase/supabase-js` v2.104.0 (2026-04-23 升级)

### 后端 Rust (04-backend/)
- rustc 1.95.0
- axum =0.8.9 + utoipa =5.4.0 + sea-orm =2.0.0-rc.38
- 22 个依赖已于 2026-04-22 从虚构版本修正到 crates.io 真实稳定版
- 见 `versions.toml` 的 `[rust.*]` 段

### AEC 文件解析 (04-backend/file-parsers/)
- ifc-lite-core 2.1.9 / acadrust 0.3.4 / pdf_oxide 0.3.34 / fj 0.49.0
- csgrs 已删除 (core2 0.4.0 yanked · ADR-0017)

### 数据层
- **baseline (2026-04-22)**: PG 16.13 + pgvector 0.8.2 + Valkey 8-alpine
- **upgrade (2026-04-23)**: Supabase v1.26.04 + PG 17.6.0 (tag `17.6.0.066-disk-no-fail-sam-2`) + realtime v2.86.3 + auth v2.188.1 + postgres-meta v0.96.4
- Apache Iceberg 1.10.1 (Phase 1 启用)
- pgmq 1.12.0 (替代 NATS · NATS 明确禁用)

### Agent / LLM
- LangGraph 1.1.8 (PG checkpointer 必选)
- OpenClaw 0.12.3 (Node 22+/Bun · pnpm · Vitest 70% · SOUL.md + SKILL.md + AGENTS.md)
- HermesAgent v0.10.0 (Python 3.11+ · SQLite+FTS5)
- MCP spec 2026-03-26 + rmcp =1.5.0
- Langfuse v3.169.0 (Py SDK v4.5.0 · JS SDK v5.2.0 · Helm langfuse-1.5.27)
- LLM 路由: Claude Opus 4.7 · Gemma 4-E4B (含 4-E4B-it / Gemma-4-31B-IT-NVFP4) · qwen3.6:35b-a3b (Ollama)

### 多模态
- 文生图: Qwen-Image-Edit 2511 · HunyuanImage 3.0
- 文生 3D: HY-World 2.0 (替代 Hunyuan3D)
- 文生视频: Wan 2.7 (替代 FLUX.1)
- ComfyUI 0.3.45 (GPL-3 · 独立 K8s namespace · WS+REST+MCP)

---

## 许可证政策

### 白名单 (whitelist) — 无限制使用
Apache-2.0 · MIT · BSD-2-Clause · BSD-3-Clause · MPL-2.0 · PostgreSQL · ISC · Zlib · Unlicense · CC0 · 0BSD · PSF-2.0

### 容忍 (tolerated) — 仅独立进程或动态链接
LGPL-2.1 · LGPL-3.0 · EPL-2.0 · CDDL

### GPL-3 例外 — 独立 K8s namespace · 零静态链接
ComfyUI · YOLO-World · LibreDWG (通过 WS/REST/MCP 通信)

### 黑名单 (blacklist) — 禁止引入
AGPL-3.0 · SSPL-1.0 · BSL-1.1 · Elastic-2.0 · Commons-Clause · CC-BY-NC · CC-BY-SA

CI 由 `cargo-deny check licenses` 强制拦截 (配置见 `deny.toml`)。

---

## 工作流 (Harness Engineering · Anthropic 5×3)

- 5 维能力: Plan · Memory · Act · Perceive · Optimize (PMAP+O)
- 3 纲工程: Observability · Reliability · Reproducibility
- 3 斩命令: `/rewind` · `/compact` · `/clear`

每次 Agent 会话必须被 Langfuse trace · 采样率默认 1.0。

---

## Sprint 01 · Day 1-30

见 `CHANGELOG-v1.3.0.md` 第 3 节。

---

## 给 Claude 的硬规则

1. **不凭记忆写版本号**。所有版本号必须来自 `versions.toml`。如果 `versions.toml` 里没有,开 TODO 让 AIA 贴 GitHub 链接,不要猜。
2. **不生成长篇 HTML 蓝图**。AIA 要可执行文件(Rust/TS/SQL/YAML/TOML),不要对话式 HTML。
3. **不用 `^` `~` `*` `latest`**。只用 `=x.y.z`。
4. **不用 § 符号**。用阿拉伯数字 + 中英文标号。
5. **不把 Pan.AEC / Baja1000 当成当前项目名**。当前是 **InsomeOS**。
6. **不静态链接 GPL-3 组件**。ComfyUI / YOLO-World 走独立进程 + WS/REST/MCP。
7. **不引入 NATS**。异步队列用 pgmq · pub/sub 用 Valkey Streams · 跨服务事件用 PG LISTEN/NOTIFY。
8. **不在中亚选 Yandex**。用 GCP Kazakhstan Astana Tier IV。

---

## 出错时怎么纠正

如果 Claude 生成了违反以上任何一条的代码或配置,AIA 会直接在 Zed 里指出。
Claude 不应该辩解,直接:
1. 读 `versions.toml` + 本文件
2. 修正输出
3. 更新 memory (如果是重复错误)
