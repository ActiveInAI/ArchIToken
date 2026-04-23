# construction_supervision · DATA-MODEL

本模块的 48 张 PostgreSQL 表按 12 子域分布 · 命名、索引、RLS、审计列统一规范。
所有表在 `csr_` schema (construction_supervision 缩写) · 与其它模块表物理隔离。

---

## 1. 命名规范

### 1.1 Schema 与表名

- Schema: `csr` (construction_supervision · 3 字母缩写 · 避免超长)
- 表名: 复数 · `snake_case` · 例 `csr.inspection_lots`
- 关联表: `<left>_<right>s` · 例 `csr.crew_workers`
- 软删列: `deleted_at TIMESTAMPTZ`
- 所有表必带 · `id UUID PK` · `tenant_id UUID NOT NULL` · `created_at / updated_at TIMESTAMPTZ`

### 1.2 字段规范

| 规范 | 说明 | 例 |
|---|---|---|
| 主键 | `id UUID DEFAULT uuidv7()` | UUIDv7 · 可索引 · 时序有序 |
| 外键 | `<ref>_id UUID NOT NULL REFERENCES xxx(id)` | `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT` |
| 多租户 | `tenant_id UUID NOT NULL` · RLS FORCE | 宪法 §16 |
| 模块标记 | `module_id TEXT NOT NULL DEFAULT 'construction_supervision' REFERENCES modules(id)` | 11 模块并列架构 |
| 钱 | `INTEGER` · 分 (CNY) / cent (USD) 最小单位 | 避免 float |
| 金额本位 | `currency TEXT NOT NULL DEFAULT 'CNY'` | ISO 4217 |
| 量 | `NUMERIC(18,4)` | 工程量精度 |
| 时间 | `TIMESTAMPTZ` · UTC 存 · 前端按租户时区显 | 不用 timestamp without time zone |
| 布尔 | `BOOLEAN NOT NULL DEFAULT FALSE` | 避免 NULL 三态 |
| 枚举 | `TEXT CHECK (x IN ('a','b','c'))` | 不用 PG enum 类型 (对齐模块架构) |
| JSON | `JSONB` · 必要时 GIN 索引 | 非结构化辅字段 |
| 审计 | `created_by UUID · updated_by UUID` | 对接 settings_center 的 `users` |

### 1.3 索引策略

- **B-tree**: 所有外键列 · 所有 `created_at DESC` · 所有 tenant_id
- **复合**: `(tenant_id, project_id, status)` 作为多数查询入口
- **GIN**: JSONB 列(如果会查) · 全文搜索列(监理日志正文)
- **BRIN**: 超大时序表(影像 / 日志) · `created_at` 列
- **唯一**: `(tenant_id, project_id, natural_key)` 防重

### 1.4 RLS (宪法 §16)

每个表必开 `ROW LEVEL SECURITY FORCE` · 基础策略:

```sql
CREATE POLICY tenant_isolation ON csr.<tbl>
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 48 张表按子域分布

### 2.1 子域 01-progress · 进度管理 (5 表)

| # | 表名 | 用途 |
|---|---|---|
| 1 | `csr.schedules` | 进度计划主表 · 一个项目多版本 |
| 2 | `csr.wbs_nodes` | WBS 工作分解结构节点 (邻接表 · parent_id) |
| 3 | `csr.activities` | 工序 · 对应 MS Project Task · 起止 / 工期 / 约束 |
| 4 | `csr.milestones` | 里程碑 · 合同 / 关键节点 |
| 5 | `csr.progress_snapshots` | 进度快照 · 每日 / 每周 EVM 指标 (PV/EV/AC/CPI/SPI) |

### 2.2 子域 02-quality · 质量控制 (5 表)

| # | 表名 | 用途 |
|---|---|---|
| 6 | `csr.quality_plans` | 质量计划 (QP) |
| 7 | `csr.material_receipts` | 材料进场验收记录 (见证取样入口) |
| 8 | `csr.quality_defects` | 质量缺陷登记 |
| 9 | `csr.rectification_orders` | 监理整改通知单 (A5 表) |
| 10 | `csr.non_conformance_reports` | NCR 不合格品报告 |

### 2.3 子域 03-safety · 安全控制 (5 表)

| # | 表名 | 用途 |
|---|---|---|
| 11 | `csr.safety_plans` | 安全方案 (HSE 计划) |
| 12 | `csr.safety_hazards` | 安全隐患登记 |
| 13 | `csr.work_permits` | 作业许可 (动火 / 高处 / 受限空间 / 吊装) |
| 14 | `csr.toolbox_talks` | 班前会 / 安全交底记录 |
| 15 | `csr.incident_reports` | 事故 / 未遂事件 |

### 2.4 子域 04-daily_log · 监理日志 (4 表)

| # | 表名 | 用途 |
|---|---|---|
| 16 | `csr.supervision_logs` | 监理日志 · 日报 (A4 格式) |
| 17 | `csr.monitoring_posts` | 旁站记录 (关键部位 / 关键工序) |
| 18 | `csr.patrol_records` | 巡视记录 |
| 19 | `csr.parallel_inspections` | 平行检验记录 |

### 2.5 子域 05-method_statement · 施工方案 (3 表)

| # | 表名 | 用途 |
|---|---|---|
| 20 | `csr.method_statements` | 专项 / 危大专项施工方案 |
| 21 | `csr.technical_briefings` | 技术交底 (公司级 / 项目级 / 班组级) |
| 22 | `csr.expert_reviews` | 超过一定规模危大专家论证记录 |

### 2.6 子域 06-testing · 检测试验 (3 表)

| # | 表名 | 用途 |
|---|---|---|
| 23 | `csr.test_witnessings` | 见证取样记录 |
| 24 | `csr.lab_reports` | 实验室检测报告 (关联 CMA 资质) |
| 25 | `csr.onsite_tests` | 现场实体检测 (回弹 / 取芯 / 超声) |

### 2.7 子域 07-inspection_lot · 检验批 (3 表)

| # | 表名 | 用途 |
|---|---|---|
| 26 | `csr.inspection_lots` | 检验批 (最底层验收单元) |
| 27 | `csr.sub_items` | 分项工程 |
| 28 | `csr.sub_parts` | 分部工程 · 子分部工程 |

### 2.8 子域 08-acceptance · 验收管理 (4 表)

| # | 表名 | 用途 |
|---|---|---|
| 29 | `csr.unit_projects` | 单位工程 |
| 30 | `csr.acceptance_records` | 验收记录 (对各级验收树的汇总) |
| 31 | `csr.hidden_works` | 隐蔽工程验收记录 |
| 32 | `csr.handover_certificates` | 竣工 / 移交证书 |

### 2.9 子域 09-risk_analysis · 风险分析 (3 表)

| # | 表名 | 用途 |
|---|---|---|
| 33 | `csr.risk_entries` | 风险登记册 (LEC 评价) |
| 34 | `csr.risk_monitoring_points` | 监测点位 · 与 IoT 传感器关联 |
| 35 | `csr.emergency_plans` | 应急预案 |

### 2.10 子域 10-bim_integration · BIM 集成 (4 表)

| # | 表名 | 用途 |
|---|---|---|
| 36 | `csr.bim_models` | BIM 模型版本 (指向对象存储) |
| 37 | `csr.clash_reports` | 碰撞检查报告 |
| 38 | `csr.bim_to_wbs_links` | BIM 元素 → WBS 映射 (4D) |
| 39 | `csr.bim_to_boq_links` | BIM 元素 → BOQ 映射 (5D · 对接 `quantity_costing`) |

### 2.11 子域 11-compliance · 合规审查 (4 表)

| # | 表名 | 用途 |
|---|---|---|
| 40 | `csr.mandatory_clauses` | 强条库 (GB / JGJ 强制条文) |
| 41 | `csr.compliance_checks` | 合规检查记录 |
| 42 | `csr.permit_approvals` | 报建审批进度 (施工许可 / 质监 / 安监 / 消防) |
| 43 | `csr.archive_packages` | 归档包 (对接 `digital_archive`) |

### 2.12 子域 12-change_order · 变更管理 (5 表)

| # | 表名 | 用途 |
|---|---|---|
| 44 | `csr.engineering_changes` | 设计变更 (RFC) |
| 45 | `csr.site_consultations` | 工程洽商 |
| 46 | `csr.claims` | 索赔 |
| 47 | `csr.certifications` | 签证 |
| 48 | `csr.change_impact_assessments` | 变更影响评估 (造价 / 工期 / 质量) |

---

## 3. 共享 / 引用表 (不计入 48)

本模块引用但不拥有的表 · 存在其它模块 schema:

| 表 | 归属 | 用途 |
|---|---|---|
| `public.modules` | root · Phase 4 新建 | 11 模块注册表 |
| `public.projects` | root · 待建 | 项目主表 (所有模块共用) |
| `public.users · public.tenants · public.roles` | `settings_center` | 租户 / 用户 / RBAC |
| `sl.family_types` | `standard_library` | 族 / 材料库 (被 02/03/07 子域引用) |
| `qc.boq_items` | `quantity_costing` | BOQ 条目 (被 12 子域引用) |
| `mf.work_orders` | `manufacturing` | 加工工单 (被 07/08 子域引用) |
| `ml.shipments` | `material_logistics` | 运输单 (被 02 子域引用) |
| `dt.twin_models` | `digital_twin` | 孪生模型 (被本模块 output) |
| `da.archive_items` | `digital_archive` | 档案项 (被本模块 output) |

---

## 4. 索引热路径 (高 QPS 查询)

| 查询 | 表 | 索引 |
|---|---|---|
| 项目级 + 时间范围的日志 | `csr.supervision_logs` | `(tenant_id, project_id, created_at DESC)` |
| 未闭环的整改单 | `csr.rectification_orders` | `(tenant_id, project_id, status) WHERE status != 'closed'` (partial) |
| 某工序的最新检验批 | `csr.inspection_lots` | `(activity_id, created_at DESC)` |
| BIM 元素 → WBS 查询 | `csr.bim_to_wbs_links` | `(bim_element_guid)` + `(wbs_node_id)` |
| 监理日志全文搜索 | `csr.supervision_logs` | GIN on `to_tsvector('simple', body)` |
| 隐患状态看板 | `csr.safety_hazards` | `(tenant_id, status, severity)` |

---

## 5. 分区策略 (单表 > 1000 万行时)

触发条件 · 任一表预估行数超 10M · 启用 partition。
默认策略:

- **按时间**: `PARTITION BY RANGE (created_at)` · 月分区
- **按租户**: `PARTITION BY LIST (tenant_id)` (仅超大 SaaS 用)
- **默认不分区**: 小型单租户先 logical · 规模到位再拆

预期分区表 (Phase 4+):
- `csr.photo_evidences` (影像留痕 · 月分区)
- `csr.supervision_logs` (月分区)
- `csr.patrol_records` (月分区)
- `csr.progress_snapshots` (月分区)

---

## 6. 迁移顺序 (Phase 4 执行)

1. `modules` 表 (root) · 已在 Phase 4 计划
2. `csr` schema + 48 表 · 按 2.1 → 2.12 顺序 (依赖从弱到强)
3. RLS policies · 每表一条 tenant_isolation
4. Seed 数据 · `mandatory_clauses` 从 GB 50300-2013 灌入

---

## 7. 审计列 (strong-writes tables)

以下 5 类表额外加 `history_*` 副表 · 保留全量变更史:
- `engineering_changes` / `claims` / `certifications` (合规+法务关键)
- `rectification_orders` / `acceptance_records` (违约举证关键)

History 副表结构 · 与主表同列 + `operation TEXT · history_at TIMESTAMPTZ`。

---

version: 0.1.0 · 2026-04-23
