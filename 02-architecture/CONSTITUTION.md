# InsomeOS · 宪法 19 条

**性质**: 强约束. 违反 = CI 拒绝合并. 非软规范.  
**哲学**: Harness Engineering — "约束优于指导, 边界优于自由"

**2026-04-23 修正 (摘要)**: "9 业务阶段" 模型已废弃, 重构为 **11 模块并列架构 + 运行时注册**.
详见 [`MODULES.md`](./MODULES.md) (11 模块规范) 与 [`MODULE-REGISTRY.md`](./MODULE-REGISTRY.md) (注册机制).
语义变化: `construction` + `acceptance` 合并为 `construction_supervision`; 新增
`standard_library` · `digital_archive` · `settings_center` 三个模块; `operations` 更名为
`digital_twin` 并明确走孪生路线. 本次修正不新增 CI 条款, 但把下列条款的实现基准从
"BusinessPhase enum" 切到 "`trait Module` + `ModuleRegistry` / `@dataclass ModuleSpec`
+ `MODULE_REGISTRY` / SQL `modules` 表". 未来加减模块只需在注册表增删, 不触发宪法修正.

---

## §1 · Agent = Model + Harness
InsomeOS 的全部价值在 Harness 层. 模型是可替换组件, 永远不依赖某个具体模型的能力假设.
**CI 执行**: 模型调用必须经过 `harness_core::InferenceRouter` trait, 直连 API 的代码 PR 自动拒绝.

## §2 · 模型决定下限, Harness 决定上限
任何优化先问 Harness 能不能做, 再考虑换模型.
**CI 执行**: 架构评审清单 (模板在 `.github/PULL_REQUEST_TEMPLATE.md`).

## §3 · 100% Apache / MIT / BSD 许可
禁止 AGPL / GPL / LGPL / SSPL / BUSL 进入分发边界.
**CI 执行**: `cargo-deny check` + `license-checker --failOn "GPL;AGPL;LGPL;SSPL;BUSL"` + `pip-licenses --fail-on "GPL;AGPL"`.

## §4 · 版本补丁级钉住
所有依赖必须 `@MAJOR.MINOR.PATCH`, 禁用 `^` / `~` / `*` / `latest`.
**CI 执行**: Cargo.lock / pnpm-lock.yaml / uv.lock 全部提交, `--frozen-lockfile` 构建.

## §5 · OpenAPI 3.1 单一真源
所有 SDK, 前端类型, 文档从 OpenAPI 派生, 不允许手写客户端.
**CI 执行**: `utoipa --validate` + SDK diff 检查.

## §6 · 层间依赖单向
L0 → L7 单向, 反向调用即拒绝.
**CI 执行**: cargo workspace 拓扑检查 + import linter (前端 `eslint-plugin-boundaries`).

## §7 · 6 推理引擎全部 OpenAI 兼容
任何新引擎必须实现统一 `ChatCompletion` 协议.
**CI 执行**: 契约测试 `harness_core::tests::compat_suite`.

## §8 · 生成 SLA 强制
生成类调用的硬上限 (按能力分类, 非按阶段):
- 文生图: 60 秒
- 图生 3D: 90 秒
- 文生 3D: 180 秒
- 合规审查: 180 秒

每个模块 (见 `MODULES.md` 的 11 模块) 以 `module_id` 为 key 登记自己的 SLA 预算, 存在
`sla_budgets` 表里, 由 `settings_center` 统一管理. 不再硬编码 per-phase 常量; 加减模块
不改 SLA 枚举.
**CI 执行**: `RollbackGuard` 监控, 连续 3 次超时 = 自动切换备选模型. SLA 预算 schema 校验
确保每个启用模块都有预算行.

## §9 · AI 不自评
生成器与评估器必须独立 Agent, 独立提示词, 推荐独立模型.
每个模块目录 `prompts/<module_id>/` 下必须有 `planner.md` · `generator.md` · `evaluator.md`
三个文件, 对应 LangGraph 三节点. 此结构对全部 11 模块一致, 不因模块新增而变.
**CI 执行**: LangGraph 图定义 schema 校验, 生成器与评估器不能引用同一 `model_id`;
prompt 目录完整性扫描 (`scripts/check-prompt-tree.py`).

## §10 · LLM 白名单
只使用: Claude 4.x / GPT-5.2 / Qwen3.5 / GLM4.7 / DeepSeek V3.2 / Gemma4 / Kimi K2 / Llama 4.
**CI 执行**: `harness_core::model_registry` 注册表校验.

## §11 · 5 重 AI 缺陷防御
幻觉 / 偏见 / 越权 / 隐私泄露 / 提示注入 — 每个独立子系统.
**CI 执行**: 安全测试套件 `cargo test --features security-suite`, 每日定时运行.

## §12 · 前端单路径 (v2.0 新增)
v2.0 定稿: **Next.js 16.2.4 + React 19.2.5 为唯一生产前端**. Vue 战略预留不进入 v2.0.
**CI 执行**: monorepo 结构校验, `packages/*` 禁止 `vue` 依赖.

## §13 · 文档即环境
`AGENTS.md` 必须 < 100 行, 只作目录. 详细文档散落在 `/docs`, Agent 按需加载.
**CI 执行**: 文档大小 lint `scripts/check-agents-md-size.sh`.

## §14 · 约束优于指导
告诉 Agent "不能做什么" 比 "应该怎么做" 更有效.
**CI 执行**: Prompt review 模板 (见 `04-backend/agent-orchestrator/prompts/REVIEW.md`).

## §15 · RollbackGuard < 30 秒
任何模型切换异常必须 30 秒内自动回滚上一版本.
**CI 执行**: 混沌测试 `cargo test --features chaos`, 每周触发.

## §16 · 多租户强制隔离
甲方 / 设计院 / 施工方 / 监理数据逻辑与物理双重隔离.
**CI 执行**: PostgreSQL RLS 策略必须存在, `sqlx` 宏编译期检查.

## §17 · 国产化路径必须可行
Qwen + GLM + LMDeploy 链路必须通过同样 CI 门槛.
**CI 执行**: 双路径集成测试 `tests/cn_pipeline.rs`.

## §18 · Rust 为后端唯一主语言
除 L4 Agent 编排 (LangGraph Python) 外, 所有服务必须 Rust 实现.
**CI 执行**: CODEOWNERS 规则 + 新增语言需宪法修正.

## §19 · AIA 是骑手不是执行者
OPC 定方向、定边界、定验收; 系统自己找路.
这是 Harness 哲学对个体开发者的解放.
**CI 执行**: 心法, 非机器约束. 但在所有 design review 首问中强制被问到.

---

## 修正程序

宪法修正需:
1. 在 `/docs/amendments/` 提交 RFC (Markdown)
2. AIA 独立审核 7 天
3. 修正生效后, 所有相关 CI 规则同步更新
4. 记录在 `CONSTITUTION_HISTORY.md`

---

**版本**: 19 条 · v2.0 · 2026-04-19 定稿 · 2026-04-23 修正 (9 阶段 → 11 模块 · §8 · §9 实现基准同步)
