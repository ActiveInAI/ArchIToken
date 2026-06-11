# ArchIToken 代码审计 · 文档 vs 实现落差报告

**日期**: 2026-06-11
**方法**: 6 路并行只读代码审计（后端 Rust / 数据库迁移 / 前端 16 模块 / Workers / AI 门禁 / 测试 CI），每条文档声明要求 `file:line` 证据并判级（真实 / 部分 / 桩 / 缺失）。
**一句话**: 代码**真实且有工程纪律**（非脚手架、非 mock 农场），但文档按"理想目标架构"书写——大量**具名表/路由器/服务在代码里不存在或改了名**，约一半前端模块是壳，许多 worker 因缺库而 inert。**设计水平高，实现是可信的 late-alpha，文档对外口径偏夸大。**

---

## 1. 修正后的总判定

| 维度 | 初判 | 审计后修正 |
|---|---|---|
| 架构设计思维 | 高 | **维持：高**（4A/Registry/六门禁/真源纪律确为资深级） |
| 后端实现 | 早期 | **上调：扎实 late-alpha**（51k 行 Rust，70-80% 承重逻辑，auth/RBAC/RLS/事务/RollbackGuard/RAG 真实） |
| 测试/CI | 薄 | **上调：诚实工程**（~570 真测试 + 35 实 smoke 脚本，CI 全 job 无 allow-failure，RLS 负例与备份恢复演练真跑） |
| 文档可信度 | — | **下调：目标态写成现状态**（系统性命名漂移 + 能力夸大） |
| OpenBIM / 商业生产 | 未达 | **维持：未达**（与项目自评 Gate 一致） |

---

## 2. 六大子系统逐项落差

### 2.1 后端 Rust（51,031 行 / 125 文件）
| 声明 | 实况 | 判级 |
|---|---|---|
| 4A + Registry-over-Enum | `ModuleId(String)` 真字符串注册表，工具/技能注册表带 schema-ref 校验 | ✅ 真实 |
| 六大 Router 强边界 | 仅 **2/6 存在**：InferenceRouter(=ModelRouter, 真 HTTP+failover)、StorageRouter(真 trait 族)。**GeometryRouter/RenderRouter/WorkflowRouter 不存在**，只是 JSON/reason 字符串里的名字 | ⚠️ 部分/桩 |
| Gateway auth/tenant/ratelimit/audit | JWT+RBAC(40+ 调用点)+Valkey 限流+审计 真实并强制 | ✅ 真实 |
| REST + SSE + gRPC | **REST-only**；`tonic` 是声明依赖无任何使用，SSE 缺失 | ❌ 缺失(2/3) |
| Harness Core 事务/RollbackGuard/RAG/RBAC/schema gate | 五项均真实（pgvector 余弦 SQL、Qdrant HTTP、启动校验 ~60 表） | ✅ 真实 |
| **隐藏点** | AI 生成默认走 `local_deterministic_adapter`（确定性桩，非真模型）；Gateway `/v1/audit-events` 是**内存态**，持久审计在 file/transaction 路径 | ⚠️ 混合 |

### 2.2 数据库（24 迁移 SQL）
| 声明具名表 | 实况 | 判级 |
|---|---|---|
| `object_versions` / `schema_versions` / `business_objects` | 全仓 **0 次出现**（版本化由领域表 `bom_versions`/`asset_versions` 实现） | ❌ 缺失(具名) |
| RLS 租户隔离 + 负例 | 真实：`ENABLE RLS`×83、`CREATE POLICY`×69、deny-by-default+FORCE | ✅ 真实 |
| `audit_events` 追加 + `module_transactions` + `event_outbox` | 表存在，audit 由**触发器**写；但 outbox 实名 `data_event_outbox`，audit_events **无 RLS、可被 UPDATE/DELETE**（append-only 仅约定） | ⚠️ 部分 |
| `operation_queue`/`resource_locks`/`workflow_runs` | 全仓 **0 次出现**（仅有 `*_runs` 运行表，无队列/锁/编排表） | ❌ 缺失 |
| `price_evidence` | **0 次出现**（仅 `cost_price_snapshots`） | ❌ 缺失 |
| component_bom 12 张表 | **真实 4 / 改名近似 2 / 降级为列或缺失 5**（`line_validation_results`/`weight_calculation_results`/`material_grades`/`section_profiles`/`component_name_tokens` 多为行内文本列） | ⚠️ 部分 |

### 2.3 前端 16 模块
- **真实业务台 9/16**：personal_center、marketing_service、planning_management(8192 行)、detailed_design、quantity_costing、digital_twin、finance_management、ai_center、settings_center。
- **壳/部分 7/16**：material_logistics / construction_management / digital_archive / human_resources = **纯裸文件台无业务 UI**；production_manufacturing = **iframe 外链** Paperclip；concept_design / standard_library = 偏薄。
- 共享外壳/CDE 文件台/审批/审计**真实且全模块生效**，但**数据全停在内存 fixture / session 适配器**，未接真实持久化业务库。`ApprovalWorkflowPanel`/`AgentGateTimeline` 是**孤儿组件**（无活跃引用）。

### 2.4 Workers（45 文件）
- **无一返回伪造几何/罐头数据/NotImplementedError**——这点是真的。
- 当前环境**真正能跑出成果 ~12-14 个**（ifcopenshell/ifctester/numpy/shapely/cv2/openpyxl 已装）：component_bom、ifc ingest、ids validate、text_to_bim、bsdd、steel_platform(真算钢材吨位)、image…
- **代码真实但环境内全 `blocked` ~8-10 个**：ezdxf/OCCT/cadquery/build123d/cgal 等**库未安装**→DWG/STEP/CAD 内核路径无法端到端。
- 另有 ~15-18 个真实外部进程/HTTP 适配器（依赖未部署 sidecar）。
- "原生格式运行时全部就绪"主张在此环境**夸大**。

### 2.5 AI 六门禁链
- **六门禁本身真实**：Planner→Generator→Evaluator→RuleChecker→SchemaValidator→Approver 全在 `module_graph.py` 真执行、定序、Evaluator 用**不同模型别名**真独立；三个确定性门（Rule/Schema/Approver）逻辑扎实，未审"可施工/合规"声明被降级。
- **周边基础设施夸大**：**无 8091/8092 端口服务**；Python ToolRouter **不执行工具、不强制权限**（只发 6 个意图 + 取只读证据）；ModelRouter 是 engine-failover 非成本路由；`agent_runs`/`agent_tool_calls` **账本表不存在**（近似表 `agent_invocations` **从不被 INSERT**，运行只留审计事件）；`langgraph` 声明依赖**从未 import**（手写 async 链）。

### 2.6 测试 / CI
- ~570 真测试 + 35 实 smoke 脚本，**0 个 trivial 断言**；CI 9 job **全程无 allow-failure**，P0 gate 真起 Postgres+pgvector 跑迁移。
- **真硬核**：RLS 跨租户负例（非 0 即 `RAISE EXCEPTION`）、备份恢复演练（真 `pg_dump`→建库→`pg_restore`→校验行数）、运维审计归档、Agent 合规降级门。
- **盲点**：最贵的**重钢 BOM→数据库桥接门禁在 CI 里被关掉**（`INCLUDE_BOM_DB_BRIDGE=0`，依赖开发者本地 `~/下载/*.xlsx`），真实大体量闭环只在本地手动验证。

---

## 3. 系统性问题模式

1. **命名漂移（最普遍）**：文档按理想架构名书写，代码用实名。被点名但全仓 0 次出现：`object_versions`、`schema_versions`、`business_objects`、`operation_queue`、`resource_locks`、`workflow_runs`、`price_evidence`、`agent_runs`、`agent_tool_calls`、GeometryRouter/RenderRouter/WorkflowRouter、8091/8092 端口、LangGraph。
2. **能力夸大**：六大 Router(实 2)、原生格式全就绪(实 ~1/3 可跑)、16 真实业务台(实 9)、可审计闭环(BOM-DB 门禁在 CI 关闭)。
3. **真源/不可变性偏弱**：RLS 谓词基本只到 `tenant_id`（项目级靠外键非策略）；audit_events 可被改删；BOM 主数据多为行内文本列而非受控表。

## 4. 真正可信、应给分的部分
- 后端控制面（auth/RBAC/RLS/事务/RollbackGuard/RAG/schema gate）是**生产级真代码**。
- RLS deny-by-default + 备份恢复演练 + 跨租户负例 + Agent 合规降级，**是真测试不是 PPT**。
- 六门禁链 + Evaluator 真独立 + "AI 只出草稿"纪律，**确实落到了 `module_graph.py`**。
- Workers 诚实门控（缺库即显式 `blocked`，不伪造结果）。

## 5. 修正后的"水平"结论
> **架构设计 = 资深/上游；代码实现 = 可信 late-alpha（工程纪律真实，显著好于"Demo+想法"）；文档 = 目标态写成现状态，需按实名与实况校正后才能对外。** 距商业生产（L3/L4）的差距主要在：命名对齐、缺失基础设施（队列/锁/路由器/端口服务/run 账本）、格式运行时依赖落地、前端 7 个壳补实、CI 纳入真数据 BOM 门禁、OpenBIM 官方证据。

## 6. 优先修复清单（关闭文档-实现落差，按性价比）
| 优先级 | 动作 | 关闭的落差 |
|---|---|---|
| P0 | 文档全量按实名校正（或代码补齐具名表/路由器）——二选一，别两套名字 | 命名漂移 |
| P0 | 把 `agent_invocations` 真正 INSERT（写 run 账本），audit_events 加 append-only 约束/触发器 | 可审计性 |
| P0 | 前端 4 个纯壳模块（material_logistics/construction/archive/HR）补业务对象 UI 或文档降级标注 | 16→9 落差 |
| P1 | RLS 谓词补到 project 粒度；BOM 重量/材质/型材升级为受控主数据表 | 真源/隔离 |
| P1 | CI 纳入合成数据版 BOM-DB-bridge 门禁（去掉对本地 xlsx 的硬依赖） | 闭环验证 |
| P1 | 实现或显式降级 GeometryRouter/RenderRouter/WorkflowRouter、ToolRouter 权限执行 | 路由器边界 |
| P2 | Workers 容器预装 ezdxf/OCCT/cadquery 等，让 CAD/几何路径端到端可跑 | 格式运行时 |
| P2 | OpenBIM 真实 IFC+IDS+bSDD+BCF 样本 + 官方 Validate 报告 | mayClaim=false |
