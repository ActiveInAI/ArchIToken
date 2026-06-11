# ArchIToken 文档↔实现 校正与对齐（权威）

**日期**: 2026-06-11
**地位**: 当文档与代码冲突时，**以本表为准**。本文件解决 2026-06-11 代码审计发现的"文档把目标态写成现状态 / 命名漂移"问题。
**证据**: 见 `ARCHITOKEN_CODE_AUDIT_DOC_VS_IMPL_2026-06-11.md`（含 `file:line`）。

---

## 0. 本轮已落地的真实修复（已验证）

| 修复 | 文件 | 验证 |
|---|---|---|
| `audit_events` / `cost_audit_events` **数据库级 append-only**（阻断 UPDATE/DELETE/TRUNCATE） | `04-backend/migrations/20260611000001_audit_events_append_only.sql` | ✅ 在 pg16 全链迁移后实测：INSERT 通过、UPDATE/DELETE/TRUNCATE 均报 `append-only ledger ... not permitted` |
| 文档名→实名 **兼容视图**（RLS-respecting, `security_invoker=true`） | `04-backend/migrations/20260611000002_documented_name_compat_views.sql` | ✅ 实测：`event_outbox`(=`data_event_outbox`, 21 行)、`sjg157_categories`、`naming_rules`、`import_batches` 视图可查且尊重调用方 RLS |
| **R1 · `agent_invocations` 运行账本写入**（后端，含模型列） | `postgres_runtime_store.rs`(`record_agent_invocation`) + `bin/gateway.rs` + orchestrator `state.py`/`main.py`(surface planner/generator/evaluator_model) | ✅ `cargo check`/`cargo test`、orchestrator pytest/ruff/mypy 全绿；INSERT（FK + `::verdict` + jsonb + 模型列 + NULL verdict）pg16 实测成功；best-effort 非致命 |
| **R6（部分）· ToolRouter 真权限执行** | `agent-orchestrator/.../tool_router.py` 角色→权限集 + per-tool allow/deny；拒绝则结果失败且证据剔除 | ✅ 新增测试覆盖（auditor→CDE 拒绝、engineer→CDE 放行）；27 测试全绿 |
| **strict mypy 修复**（pre-existing） | orchestrator `main.py`(GateStatus Literal)、`module_graph.py`(去除死分支) | ✅ `mypy src` 12 文件 0 问题 |
| **六大 Router 落地** · Geometry/Render/Workflow Router | `harness-core/src/geometry_router.rs`、`render_router.rs`、`workflow_router.rs`（Registry 驱动，返回可审计路由决策 + 回退 + 测试） | ✅ 13 新测试；lib 全套 185 passed；`clippy --all-targets -D warnings`(pedantic+nursery+missing_docs) 与 `fmt --check` 全绿 |

> 这两条把"audit 可被改删""命名漂移（有真实后端的表）"两个审计问题真正关闭，且全 24+2 条迁移在干净库一次过。

---

## 1. 命名对照表（文档名 → 真实实现）

| 文档名 | 真实状态 | 实名 / 处置 |
|---|---|---|
| `event_outbox` | ✅ 存在(改名) | 实名 `data_event_outbox`；已建兼容视图 `event_outbox` |
| `sjg157_categories` | ✅ 存在(改名) | 实名 `semantic_dictionary_categories`；已建兼容视图 |
| `naming_rules` | ✅ 存在(改名) | 实名 `component_bom_naming_rules`；已建兼容视图 |
| `import_batches` | ✅ 存在(改名) | 实名 `component_bom_import_batches`；已建兼容视图 |
| `agent_runs` / `agent_tool_calls` | ⚠️ 近似表存在但**从不写入** | 近似表 `agent_invocations`（schema 正确，但当前无 INSERT）— 见 §3 路线图 R1 |
| `object_versions` / `schema_versions` / `business_objects` | ❌ 不存在 | 通用版本/对象表未实现；版本化由领域表（`bom_versions`、`asset_versions`）就地实现。文档应改为"领域表版本化"口径 |
| `operation_queue` / `resource_locks` / `workflow_runs` | ❌ 不存在 | 无队列/锁/编排表；现仅有 `module_operation_runs` 等运行记录表。文档的"操作队列/资源锁/工作流编排"为**目标态** |
| `price_evidence` | ❌ 不存在 | 仅 `cost_price_snapshots` / `cost_unit_price_components`；价格证据状态机（user_input→locked→expired）为**目标态** |
| `ModelRouter` | ⚠️ 实名不同 | 真实组件是 `InferenceRouter`（HTTP+failover）；但按 **engine** 路由而非成本/模型选择，无 8091 端口服务 |
| `StorageRouter` | ✅ 存在 | 真实 trait 族 |
| `ToolRouter` | ⚠️ 弱 | 存在工具/技能注册表，但 Python `ToolRouter` **不执行工具、不强制 per-tool 权限**（只发意图+取只读证据）；无 8092 端口服务 |
| `GeometryRouter` / `RenderRouter` / `WorkflowRouter` | ✅ 已实现(2026-06-11) | `harness-core` 真实 Registry 驱动组件 + 测试(`geometry_router.rs`/`render_router.rs`/`workflow_router.rs`)；不再只是字符串名 |
| LangGraph 编排 | ❌ 未用 | `langgraph` 声明依赖从未 import；六门禁是手写 async 链（功能真实，技术栈标注应更正） |

---

## 2. 对外/文档口径校正（把"已实现"降级为真实档位）

| 原口径 | 校正后口径 |
|---|---|
| "六大 Router 强边界" | **6 个 Router 概念均有真实代码**：Inference(=Model)、Storage、ToolRouter(已加 per-tool 权限执行)、Geometry/Render/Workflow(2026-06-11 落地为 Registry 组件+测试)。仅剩 `:8091`/`:8092` 独立端口服务为部署拓扑项，非代码缺口 |
| "REST/SSE/gRPC" | **REST-only 已实现**；SSE/gRPC（tonic）声明但未实现 |
| "16 个对等真实业务台" | **9 个真实业务台** + 4 个裸文件壳（material_logistics / construction_management / digital_archive / human_resources）+ 1 个 iframe 外链（production_manufacturing）+ 2 个偏薄（concept_design / standard_library） |
| "原生格式运行时全部就绪" | 约 **1/3 当前可端到端跑**（ifcopenshell/ifctester/numpy/shapely/cv2/openpyxl 已装）；CAD/几何内核路径（ezdxf/OCCT/cadquery/build123d/cgal）**库未安装→运行时 blocked**（代码真实） |
| "可审计闭环 / 生产门禁全通过" | RLS 负例、备份恢复演练、Agent 合规降级门**真有测试**；但最贵的**重钢 BOM→数据库桥接门禁在 CI 关闭**（`INCLUDE_BOM_DB_BRIDGE=0`，依赖本地 xlsx） |
| "agent_runs 账本可回放" | 运行**仅留审计事件**；`agent_invocations` 账本表存在但未写入 |
| AI 生成 | 默认走 `local_deterministic_adapter`（确定性桩），需配置外部 provider 才走真模型 |

> 维持不变的真实强项：4A/Registry、auth/RBAC/RLS(deny-by-default+FORCE)、Postgres 事务、RollbackGuard、pgvector/Qdrant RAG、六门禁链(Evaluator 真独立)、~570 真测试 + 35 实 smoke 脚本、CI 全 job 无 allow-failure。

---

## 3. 路线图：需要代码实现的项（如实标注，不造假）

按性价比排序。每项给出**确切落点**，便于后续直接动手。

| # | 项 | 确切落点 | 工作量 | 风险 |
|---|---|---|---|---|
| ~~R1~~ ✅ **已完成 (2026-06-11)** | **写 agent_invocations 运行账本** | 已落地：`postgres_runtime_store::record_agent_invocation` + `gateway.rs invoke_agent_handler` best-effort 写入（verdict/revision/final_output/gate trace/latency_ms）。模型名字段（planner/generator/evaluator）暂为 NULL——orchestrator summary 未返回，后续可在 `AgentInvokeResponseSummary` 补字段后填充 | — | 已验证 |
| R2 | **CI 纳入合成数据 BOM→DB 桥接门禁** | `.github/workflows/ci.yml:245` 区域去掉 `INCLUDE_BOM_DB_BRIDGE=0` 的硬关；用合成 fixtures 替代 `~/下载/*.xlsx`（`06-workers/tests/test_component_bom_worker.py` 的 skip 改为内置最小工作簿） | 中 | 低 |
| R3 | **4 个壳模块补业务对象 UI** | `03-frontend/components/ModuleDetailWorkbench.tsx` 分发表为 material_logistics / construction_management / digital_archive / human_resources 增加 `businessHome` 分支（参考 finance/quantity 的 `ModuleOperationalPanel` + `lib/<module>.ts`） | 大 | 低（需产品定义对象与字段） |
| ~~R4~~ ✅ **已完成 (2026-06-11)** | **RLS 谓词补到 project 粒度** | 已落地：`20260611000004_project_scope_rls.sql`（4 表 RESTRICTIVE、permissive-when-unset）+ gateway `begin_tenant_tx` 绑定 `app.current_project`。pg16 实测隔离生效且无回归。后续可按需把更多敏感表纳入同一模式 | — | 已验证 |
| ~~R5~~ ✅ **已完成 (2026-06-11)** | **BOM 主数据升级为受控表** | 已落地 `bom_material_grades` + `bom_section_profiles` + `bom_lines` 外键回引(附加、安全回填)。后续可继续把 `component_name_tokens` 等纳入同模式；重量 worker 改读 `section_profile_ref`/`material_grade_ref` | — | 已验证 |
| 阶段 BOM ✅ | **ABOM 数字档案(生命周期闭环)** | `20260611000012_*.sql`：`archive_packages/_items` 从 IBOM 仅归档 accepted 项 + `bom_derive_archive_package`(未验收不得归档)+ `bom_archive_is_complete`。API/前端 archive op + 计数已贯通,`digital_archive` 接 BOM 面板(第 3 个壳模块)。pg16 实测 + CI(EBOM→…→IBOM→Archive)。前端壳模块已接:material_logistics / construction_management / digital_archive | 中 | 已完成 |
| 阶段 BOM ✅ | **CBOM 方案设计 + Planning 项目管理(9 阶段收官)** | `20260611000011_*.sql`：`concept_boms/_lines`(confirmed demand 派生、`is_ready_for_deepening` 仅 selected)+ `planning_boms/_lines`(selected concept 派生、7 阶段生命周期 WBS、`is_baselined` 门禁)+ 派生函数。pg16 实测全过、纳入 CI。**至此 9 个业务阶段 BOM 全部真实落地**(报价/方案/深化/造价/采购/生产/物流/施工/项管),统一治理 + CI 守护 | 中 | 已完成 |
| 阶段 BOM ✅ | **RBOM 客服报价/需求 BOM(上游入口)** | `20260611000010_*.sql`：`demand_boms/_lines`(报价行 `est_total_cny` 生成列、`is_ready_for_design` 仅 customer_confirmed 为真=无客户确认不得进入深化)+ `bom_demand_quote_total` / `bom_assert_demand_ready_for_design`。pg16 实测:报价 52150；未确认入深化被拒,确认后放行。已纳入 BOM-chain CI 门禁 | 中 | 已完成 |
| 阶段 BOM ✅ | **Shipment 物流 BOM** | `20260611000009_*.sql`：`shipment_boms/_lines` 从 released MBOM 逐件派生 + `bom_derive_shipment_bom`(released 门禁、可追溯、生成列 `is_installable` 仅 received 为真=未签收不得安装)。补完 MBOM→物流→IBOM 物理流转。pg16 实测:草稿派生被拒；2 行、签收后才可安装 | 中 | 已完成 |
| 阶段 BOM ✅ | **IBOM 施工安装 BOM** | `20260611000008_*.sql`：`installation_boms/_lines` 从 released MBOM 逐件派生 + `bom_derive_installation_bom`(released 门禁、可追溯 source_mbom_line、生成列 `is_archivable` 仅 accepted 为真=未验收不得归档)。pg16 实测:草稿 MBOM 派生被拒；2 安装行被 2 未验收阻断归档→验收 1 件后剩 1 阻断。**EBOM→MTO/PBOM→MBOM→IBOM 全链贯通** | 中 | 已完成 |
| 阶段 BOM ✅ | **MBOM 制造 BOM** | `20260611000007_*.sql`：`manufacturing_boms/_lines` 按构件**逐件**从 approved 构件 BOM 派生 + `bom_derive_manufacturing_bom`(approved 门禁、可追溯 source_bom_line、生成列 `is_releasable` 仅工艺+质检齐备为真=工艺/质检缺失不得排产)。pg16 实测:草稿派生被拒；3 逐件行、0→1 可排产。**生产制造阶段 BOM 真实落地** | 中 | 已完成 |
| 阶段 BOM ✅ | **MTO 材料提量 → PBOM 采购 BOM** | `20260611000006_*.sql`：MTO/PBOM 四表（tenant RLS+FORCE+project-scope）+ 派生函数 `bom_derive_material_takeoff`(approved-only 门禁、按 R5 受控 grade/section 聚合、净/毛量+损耗)、`bom_derive_procurement_bom`(价格证据状态机 + 生成列 `is_purchasable` 仅 quote/locked)。pg16 实测:草稿派生被拒；Q355D 2 行→净15/毛15.75/重767.5416、可追溯；PBOM 锁价后才可采购。**采购阶段 BOM 真实落地** | 中 | 已完成 |
| R5 ✅ | **BOM 主数据受控表** | `20260611000005_bom_master_data.sql`：`bom_material_grades`(12 grade,真实密度)+ `bom_section_profiles`(型材+公式+面积+单重)+ `bom_lines` 加 `material_grade_ref/section_profile_ref` 外键(保留文本列、安全回填)。pg16 实测:area×密度精确复现单重(H200X200X8X12→48.7328），重量可确定性派生 | 中 | 已完成 |
| R4 ✅ | **RLS 谓词补到 project 粒度** | `20260611000004_project_scope_rls.sql`：`current_project()` + 4 张敏感表 RESTRICTIVE `*_project_scope` 策略（未设 project 放行、设了则隔离）；gateway `begin_tenant_tx` 按有效 project UUID 绑定。pg16 非 bypass 角色实测：X→1、Y→1、unset→2、跨项目写被 WITH CHECK 拒绝；37 gateway 测试全过 | 中 | 已完成 |
| R6 ✅ | **ToolRouter 真权限执行 + Router 落地 + HTTP 暴露** | ✅ ToolRouter per-tool allow/deny；✅ Geometry/Render/Workflow Router 真实 Registry 组件+测试；✅ 已暴露为 gateway 端点 `GET /v1/routers/{geometry,render,workflow}`（含 tokio 端点测试）。仅剩 `:8091`/`:8092` 独立端口服务为可选部署拓扑 | — | 已完成 |
| R7 | **格式 Worker 依赖落地** | `06-workers` 容器/`.venv` 预装 ezdxf / OCCT(OCP) / cadquery / build123d / pygalmesh，让 CAD/几何路径端到端可跑 | 中 | 低 |
| R8 | **OpenBIM 官方证据** | 真实项目 IFC+IDS+bSDD+BCF 样本 + 官方 Validate 报告，方可把 `mayClaimBuildingSmartOpenBim` 推进 | 大 | 外部依赖 |

> R1/R2/R4/R5 是数据库/CI 侧、可在本环境（已验证可用的 architoken-postgres pg16 容器）逐项验证；R3/R6/R7/R8 需要产品输入或外部依赖，属独立交付。
