# InsomeOS · 工程决策原则

**性质**: 决策层文档 · 与 CONSTITUTION.md (法律层) 互补
**作用**: 当面临多种方案时, 用这个优先级排序做选择
**Established**: 2026-04-22 by ActiveInAI

---

## 六项原则 · 按优先级

上级原则优先于下级. 绝不为下级原则牺牲上级原则.

1. **稳** (Stability) — 代码合入后不因外部小版本抖动或局部修改整体崩溃.
2. **少修改** (Minimal Change) — 每次决策选对现有代码改动最小的方案.
3. **易维护** (Maintainability) — 读者比作者多 100 倍.
4. **高性能** (Performance) — 选型阶段就考虑 zero-copy / async-first.
5. **高效率** (Efficiency) — 资源使用克制, 不浪费 DGX Spark 128GB.
6. **强扩展 · 多并发** (Extensibility & Concurrency) — 为未来横向扩展留路.

---

## 快 vs. 稳 · 失效路径

> "追求快" 是一种失败模式, 不是一种原则.

当任何贡献者 (包括 AI agent) 提出"这样做最快"时, 必须自问:

- 它改动了几个文件? → 越多越差
- 它引入了几个新依赖? → 越多越差
- 它改动了既有 trait / 公共接口? → 任何改动都极差
- 它 bypass 了既有错误类型 / 日志 / 追踪? → 一票否决

任一答案为"是", 方案被拒绝.

---

## 七条具体落地规则 (binding)

### R1 · 错误类型 append-only
`HarnessError` enum 只 **append** 新 variant, 永不改名, 永不删除.
新依赖引入的错误用 `#[from]` 包装, 永不 `unwrap` 吞噬.

### R2 · 数据库访问统一
全仓库只允许一种数据库访问方式 (当前: sea-orm 2.0.0-rc.38).
不允许 sqlx + sea-orm 并存使用. 切换必须 RFC + 全量迁移.

### R3 · HTTP Handler 范式
所有 handler 返回 `Result<Json<ApiOk<T>>, HarnessError>`.
禁止裸 `(StatusCode, String)` 返回.

### R4 · 依赖 patch-pin
`Cargo.toml` 所有版本 `version = "=x.y.z"`. Cargo.lock 进 git.
依赖升级走独立 `chore(deps)` commit.

### R5 · 并发基础
`State<T>` 必须 `Clone + Send + Sync + 'static`.
长任务用 `tokio::spawn` + cancel token.
锁优先 `parking_lot::Mutex` / `dashmap`, 避免 `std::sync::Mutex`.

### R6 · 可观测性强制
每个 HTTP handler 有 `#[tracing::instrument]`.
每个 DB 查询有 span.
每个外部调用 (upstream inference / MCP) 有 trace + metric.

### R7 · OpenAPI 单源
`openapi.yaml` 是唯一真相. Rust route 和 struct 必须与其对齐
(utoipa 校验). 前端 SDK 由其生成.

---

## 违反信号 · STOP 清单

如果某次修改触发以下任一条件, 必须 **STOP**, 退回上一步, 和 AIA 确认方向:

- 删除了任何既有 public fn / struct / trait
- 同一仓库引入第二套同类库 (两种 DB / 两种 HTTP 框架)
- 跳过既有 error 类型, 用 `anyhow!` / `panic!` / `unwrap` 应付
- 手写了应该由 `openapi.yaml` 生成的类型
- 引入没 pin 到 patch 的依赖
- 改动了 `HarnessError` enum 的既有 variant (名字 / 类型 / 语义)

---

## 本文档的起源

2026-04-22 Stage 3A 启动, 执行 `harness-core` 与 K8s postgres 对接.
AI 助手首反应"改用 sqlx 最快, 给 `HarnessError` 改数据库 variant".
违反 R1 (不改既有) / R2 (不引入第二套 DB) / 全部核心原则.

AIA 拒绝该方案. 本文档将原则从口头约定变成不可反驳的文本, 作为未来
每次技术决策的 checklist.

> 稳 > 少修改 > 易维护 > 高性能 > 高效率 > 强扩展 · 多并发
