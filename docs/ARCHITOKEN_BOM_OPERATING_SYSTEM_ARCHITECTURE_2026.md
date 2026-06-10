# ArchIToken BOM 应用、数据库、智能体、工作流与技术架构

文档状态: 架构蓝图 / 目标方案  
版本日期: 2026-06-08  
适用范围: ArchIToken 16 模块、Open CDE 工作台、BOM / BOQ / 采购 / 生产 / 施工 / 财务 / 档案闭环  
核心结论: BOM 不是一张物料表,也不是硬件采购清单。BOM 是 ArchIToken 的企业运营事实主线,必须贯穿业务架构、应用架构、数据架构、智能体架构、工作流门禁和部署运行体系。

---

## 1. 项目理解与边界

ArchIToken 的仓库真源明确定位为:

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

因此 BOM 体系不能做成独立 SaaS 页面、普通 ERP 物料模块或孤立的 Excel 替代品。它必须服务以下目标:

| 维度 | ArchIToken 中 BOM 的真实含义 |
|---|---|
| 业务 | 把客户需求、方案、深化、造价、采购、生产、物流、施工、验收、档案、财务、人力与 AI 运营串成可追溯事实链 |
| 数据 | 以 BOM 为核心组织构件、材料、工序、价格、供应商、批次、质量、发运、安装、成本和凭证候选 |
| 应用 | 在 16 模块工作台内呈现 BOM 对象、版本、来源、审批、差异、任务和文件证据 |
| 智能体 | 通过 Agent 编排从文件、模型、会议、标准、历史项目和业务动作中抽取、校核、转换和推进 BOM |
| 工作流 | Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver 是所有 BOM 输出的门禁 |
| 技术 | 通过 Gateway、Rust Harness Core、Python Agent Orchestrator、StorageRouter、ObjectStore、EventStore、VectorStore、GraphStore 和 Database Manager 落地 |

### 1.1 本文不做的事

| 不做 | 原因 |
|---|---|
| 不把 BOM 做成单独页面 | 仓库规则要求 16 模块统一 Open CDE 工作台,不能变成孤立产品入口 |
| 不把 AI 输出直接作为最终生产结论 | 必须经过 Evaluator、RuleChecker、SchemaValidator、Approver 和专业复核 |
| 不把硬件采购当成架构主体 | 硬件只是承载层;业务、数据库、Agent 和工作流才是主体系 |
| 不把私有格式派生文件当真源 | IFC/openBIM、源文件、对象存储、版本链和审计链是真源 |
| 不用硬编码 Enum 扩展业务对象 | 模块、Agent、Tool、Schema、Workflow、Rule 都应走 Registry |

### 1.2 当前仓库中的模块数量真源

当前 `ARCHITOKEN-SOURCE-OF-TRUTH.md`、`MODULES.md`、`PRD.md`、`module-registry.ts`、迁移 `20260601000001_module_registry_16.sql` 和 `docs/04_ARCHITOKEN_API_AND_INTEGRATION_MAP.md` 均确认当前是 16 模块。本文按 16 模块编制。

---

## 2. 4A 总体架构

ArchIToken 的 BOM 架构按 4A 拆解:

```text
Business Architecture
  -> Application Architecture
  -> Data Architecture
  -> Technology Architecture
```

### 2.1 Business Architecture: BOM 驱动企业运营

ArchIToken 的核心不是“人用软件填表”,而是“AI 运行企业经营管理体系,人做确认、创新和外部界面”。BOM 在其中承担企业运营主数据和项目事实链角色。

| 业务阶段 | 输入事实 | BOM 形态 | 输出事实 | 人工责任 |
|---|---|---|---|---|
| 市场客服 | 客户需求、会议纪要、场地资料、照片、合同草案 | RBOM / Demand BOM | 需求构件、面积、风格、预算边界、交付范围 | 销售/项目负责人确认需求边界 |
| 计划管理 | 商机、资源、里程碑、预算 | Planning BOM | WBS、交付节奏、资源占用、审批计划 | 项目经理确认范围和里程碑 |
| 方案设计 | 户型、风格、标准族库、约束 | CBOM / Concept BOM | 方案构件、空间、估算材料、方案差异 | 建筑师/设计负责人确认方案 |
| 标准族库 | 标准、构件族、材料、做法、规则 | Master BOM / Library BOM | 标准构件、材料、节点、规则、属性模板 | 标准库负责人维护版本 |
| 深化设计 | IFC/DWG/STEP/模型、节点、结构约束 | EBOM / Engineering BOM | 构件明细、规格、数量、连接件、构造节点 | 设计师/结构工程师复核 |
| 计量造价 | EBOM、图纸、定额、价格快照 | QBOM / BOQ BOM | BOQ、成本拆解、增减项、价格依据 | 造价负责人复核 |
| 材料物流 | QBOM、库存、供应商、采购策略 | PBOM / Procurement BOM | 采购需求、询价、比价、订单、批次计划 | 采购/物流负责人确认 |
| 生产制造 | EBOM/PBOM、工艺路线、设备能力 | MBOM / Manufacturing BOM | 工单、工序、CNC、焊接、质检、包装 | 生产负责人/质检确认 |
| 施工管理 | 到场批次、安装顺序、图纸、质检 | IBOM / Installation BOM | 进场验收、安装记录、整改、检验批 | 施工/监理/质检确认 |
| 数字孪生 | as-built IFC、传感器、照片、点云 | Asset BOM | 构件状态、运维对象、告警绑定 | 运维负责人确认 |
| 数字档案 | 所有最终文件、审批、签章、审计 | ABOM / Archive BOM | 归档包、版本链、留存策略 | 档案负责人确认 |
| 财务管理 | 合同、订单、验收、发票、成本 | FBOM / Finance BOM | 成本归集、付款依据、凭证候选 | 财务/审计确认 |
| 人力资源 | 班组、工时、岗位、资质 | Labor BOM | 工时、绩效、资格、结算依据 | HR/项目经理确认 |
| AI 中心 | 模型、Agent、工具、RAG、成本 | Agent BOM | Agent 能力、成本、权限、审计 | AI 管理员确认 |
| 设置中心 | 租户、账号、角色、权限、策略 | Governance BOM | 权限边界、审批策略、组织策略 | 管理员确认 |

### 2.2 Application Architecture: 统一工作台,多模块共享 BOM 对象

应用层不是做一个单独的 `/bom` 大屏,而是在现有 `/app/modules/[moduleId]` 工作台中加入 BOM 对象视图和事务入口。

| 应用入口 | 必备能力 |
|---|---|
| 模块首页 | 显示本模块相关 BOM 对象、版本状态、待处理审批、风险和最近文件 |
| 文件工作台 | 源文件、模型、Excel、PDF、图纸、照片、CNC、质检记录与 BOM 版本绑定 |
| BOM 对象浏览器 | 树表、矩阵、版本差异、来源追溯、审批状态、变更影响 |
| 模型 / 图纸视图 | 选择 IFC/DWG 构件后联动 BOM item、属性、来源、质检和安装记录 |
| 工作流面板 | 显示 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver |
| 审批抽屉 | 显示审批人、意见、退回、驳回、签审证据 |
| 智能体面板 | 显示 Agent 计划、工具调用、RAG 引用、规则命中、失败原因 |
| 数据库管理入口 | 设置中心 / Database Manager 查看 BOM schema、索引、RLS、审计、事件 |

### 2.3 Data Architecture: 多 Store 组合

当前运行态已经确认:

| Store | 运行提供者 | BOM 用途 |
|---|---|---|
| RelationalStore | PostgreSQL + pgvector | BOM 主事实、版本、行项、审批、租户隔离、事务 |
| ObjectStore | SeaweedFS S3 | 源文件、模型、图纸、Excel、PDF、CNC、归档包、派生产物 |
| VectorStore | Qdrant / pgvector fallback | 标准、历史项目、会议纪要、采购记录、规则说明的语义检索 |
| EventStore | NATS JetStream / PostgreSQL outbox fallback | BOM 版本发布、审批、采购、生产、安装、财务事件 |
| GraphStore | PostgreSQL adjacency | 项目、构件、材料、供应商、工序、文件、Agent、审批关系 |
| TimeSeriesStore | ClickHouse / PostgreSQL fallback | 生产进度、IoT、安装进度、设备状态、质量趋势 |
| AnalyticsStore | ClickHouse / materialized views fallback | 成本偏差、采购周期、生产效率、Agent 成本、质量统计 |
| CacheStore | Valkey | 短期任务状态、锁、幂等、队列游标、UI 会话状态 |

### 2.4 Technology Architecture: Router + Worker + Agent

```text
Frontend Module Workbench
  -> OpenAPI SDK / ModuleBackendAdapter
  -> API Gateway / Rust Harness Core
  -> TransactionStore / Audit / IAM / StorageRouter
  -> WorkflowRouter
      -> Planner
      -> ToolRouter / Skill Registry / MCP Tool Registry
      -> ModelRouter / InferenceRouter
      -> Generator
      -> Evaluator
      -> RuleChecker
      -> SchemaValidator
      -> Approver
  -> Stores: PostgreSQL, SeaweedFS S3, Qdrant, NATS, ClickHouse, Valkey
  -> Workers: CAD/BIM/PDF/Office/OCR/Geometry/Cost/Production/Archive
```

---

## 3. BOM 类型体系

### 3.1 BOM 类型注册

所有 BOM 类型应作为 registry 配置,不能写死在枚举里。

| bom_type | 中文名 | 主模块 | 说明 |
|---|---|---|---|
| `requirement_bom` | 需求 BOM | `marketing_service` | 从客户需求、会议、场地、合同边界抽取 |
| `planning_bom` | 计划 BOM | `planning_management` | 将范围拆成 WBS、资源和交付节奏 |
| `concept_bom` | 方案 BOM | `concept_design` | 从方案空间、构件和估算材料形成 |
| `library_bom` | 标准族库 BOM | `standard_library` | 标准构件、材料、节点、做法和规则模板 |
| `engineering_bom` | 深化设计 BOM | `detailed_design` | 从 IFC/DWG/模型/节点深化生成构件级明细 |
| `quantity_bom` | 计量造价 BOM | `quantity_costing` | 与 BOQ、定额、清单、价格快照对应 |
| `procurement_bom` | 采购 BOM | `material_logistics` | 采购需求、供应商、批次、交期、价格 |
| `manufacturing_bom` | 生产 BOM | `production_manufacturing` | 工艺路线、工单、CNC、焊接、质检、包装 |
| `shipment_bom` | 发运 BOM | `material_logistics` | 包装、装车、发运、到货、签收 |
| `installation_bom` | 安装 BOM | `construction_management` | 施工段、安装记录、检验批、整改闭环 |
| `asset_bom` | 资产 BOM | `digital_twin` | 运维构件、IoT 绑定、维保状态 |
| `archive_bom` | 档案 BOM | `digital_archive` | as-built、签章、归档包、留存策略 |
| `finance_bom` | 财务 BOM | `finance_management` | 合同、订单、验收、发票、付款和凭证候选 |
| `labor_bom` | 人力 BOM | `human_resources` | 班组、工时、资质、绩效、结算依据 |
| `agent_bom` | Agent BOM | `ai_center` | Agent、工具、模型、成本、权限和审计 |
| `governance_bom` | 治理 BOM | `settings_center` | 组织、角色、权限、审批策略和安全基线 |

### 3.2 BOM 生命周期状态

```text
draft
  -> submitted
  -> generated
  -> evaluated
  -> rule_checked
  -> schema_validated
  -> pending_approval
  -> approved
  -> issued
  -> consumed
  -> archived
```

异常状态:

```text
blocked
rejected
superseded
voided
professional_review_required
```

关键规则:

1. `generated` 不能进入采购、生产、施工或财务。
2. `rule_checked` 只表示规则检查完成,不表示专业合规。
3. `schema_validated` 只表示结构合法,不表示事实正确。
4. `approved` 必须绑定审批人、角色、证据、时间、版本和审计事件。
5. `issued` 才能被下游采购/生产/施工正式引用。
6. `consumed` 表示已被下游订单、工单、安装或财务引用,不能无痕修改。
7. 修改 `issued/consumed` 版本必须走变更单和差异版本。

---

## 4. 16 模块 BOM 落点

| 模块 | BOM 职责 | 主要输入 | 主要输出 | 关键数据库对象 |
|---|---|---|---|---|
| `personal_center` | 个人待办、审批和最近 BOM 任务入口 | 用户、权限、任务 | 待审清单、最近版本、收藏 | `module_transactions`, `audit_events` |
| `marketing_service` | 需求 BOM 采集 | 客户需求、会议纪要、图片 | 需求条目、范围边界、报价草案 | `bom_sets`, `bom_versions`, `bom_items` |
| `planning_management` | 计划 BOM / WBS 绑定 | 需求 BOM、资源 | WBS、里程碑、资源需求 | `project_plan_*`, `bom_relations` |
| `concept_design` | 方案 BOM | 方案、空间、材料估算 | 方案构件、差异、估算成本 | `bom_items`, `item_sources` |
| `standard_library` | Master Data / Library BOM | 标准、族库、材料、做法 | 标准构件、属性模板、规则 | `semantic_dictionary_*`, `material_specs` |
| `detailed_design` | EBOM | IFC/DWG/STEP/节点 | 构件、规格、数量、连接件 | `bim_uploads`, `assets`, `bom_items` |
| `quantity_costing` | QBOM / BOQ | EBOM、图纸、定额、价格 | BOQ、综合单价、差异 | `cost_*`, `bom_price_bindings` |
| `material_logistics` | PBOM / Shipment BOM | QBOM、库存、供应商 | 采购需求、订单、批次、发运 | `purchase_lines`, `shipments` |
| `production_manufacturing` | MBOM | EBOM/PBOM、工艺路线 | 工单、工序、CNC、质检、包装 | `work_orders`, `production_operations`, `qc_records` |
| `construction_management` | IBOM | 到场批次、图纸、施工段 | 安装、检验批、整改、验收 | `installation_records`, `site_receipts` |
| `digital_twin` | Asset BOM | as-built、IoT、点云、照片 | 运维构件、状态、告警 | `data_timeseries_points`, `data_graph_edges` |
| `digital_archive` | Archive BOM | 终版文件、审批、签章 | 归档包、保存期、检索索引 | `asset_versions`, `object_store_bindings` |
| `finance_management` | Finance BOM | 合同、采购、验收、发票 | 成本归集、付款依据、凭证候选 | `finance_posting_candidates` |
| `human_resources` | Labor BOM | 班组、工时、岗位、资质 | 工时成本、绩效、结算依据 | `labor_assignments`, `time_entries` |
| `ai_center` | Agent BOM | 模型、工具、RAG、权限 | Agent 配置、成本、审计 | `agent_invocations`, `ai_center_*` |
| `settings_center` | Governance BOM | 租户、角色、权限、策略 | 权限、审批链、安全策略 | `auth_*`, `iam_*` |

---

## 5. 领域模型

### 5.1 核心实体

| 实体 | 说明 | 关键字段 |
|---|---|---|
| Tenant | 租户 / 公司 | `tenant_id`, `locale`, `region` |
| Project | 项目 | `project_id`, `current_module_id`, `budget`, `location` |
| Module | 16 模块注册表 | `module_id`, `order_num`, `enabled` |
| BusinessObject | 业务对象抽象 | `object_type`, `object_id`, `module_id`, `status` |
| CDE File | 工程源文件或派生产物 | `file_id`, `module_id`, `object_key`, `sha256`, `status` |
| Artifact | 生成/转换产物 | `artifact_id`, `role`, `format`, `status`, `version` |
| Transaction | 生命周期事务 | `transaction_id`, `module_id`, `status`, `related_file_ids` |
| Approval | 审批记录 | `approver`, `decision`, `comment`, `decided_at` |
| AuditEvent | 审计事件 | `actor`, `action`, `target_type`, `target_id`, `details` |
| BOM Set | 一个 BOM 主对象 | `bom_id`, `bom_type`, `project_id`, `owner_module_id` |
| BOM Version | BOM 版本 | `version_id`, `version_no`, `state`, `source_version_id` |
| BOM Item | BOM 行项 | `item_id`, `parent_item_id`, `item_code`, `qty`, `unit` |
| Item Source | 行项来源 | `source_file_id`, `ifc_guid`, `drawing_entity_id`, `agent_run_id` |
| Material Spec | 材料规格 | `material_code`, `grade`, `standard`, `supplier_constraints` |
| Process Route | 工艺路线 | `operation_code`, `work_center`, `qc_gate` |
| Batch | 批次 | `batch_no`, `supplier`, `heat_no`, `certificate_file_id` |
| Installation Record | 安装记录 | `element_id`, `location`, `installed_at`, `verdict` |
| Finance Candidate | 财务候选事实 | `contract_id`, `po_id`, `receipt_id`, `invoice_id`, `amount` |

### 5.2 BOM 行项层级

```text
Project
  -> Building / Zone / Floor / Segment
    -> Assembly
      -> Component
        -> Part
          -> Material / Accessory / Operation / Cost Resource
```

对重钢、装配式和建筑设计场景,建议行项粒度如下:

| 粒度 | 示例 | 用途 |
|---|---|---|
| 空间级 | 楼栋、楼层、轴网、施工段 | 计划、施工、成本汇总 |
| 系统级 | 主体结构、围护、屋面、门窗、机电 | 专业分解 |
| 构件级 | 钢柱、主梁、次梁、檩条、墙板、门窗 | EBOM/IBOM 主线 |
| 零件级 | 连接板、螺栓、檩托、加劲肋 | MBOM、采购、质检 |
| 材料级 | 钢材、板材、涂料、保温材料 | 采购、库存、复检 |
| 工序级 | 切割、钻孔、焊接、喷涂、打包 | 生产、工时、成本 |
| 证据级 | 图纸、IFC GUID、照片、质保书、检测报告 | 审计、索赔、验收 |

---

## 6. 数据库架构

### 6.1 复用现有表

新 BOM schema 必须复用现有平台事实表,避免重复建一套孤立系统。

| 现有表/表族 | 用途 |
|---|---|
| `tenants`, `users`, `auth_*`, `iam_*` | 租户、账号、角色、权限、会话 |
| `modules` | 16 模块 registry |
| `projects` | 项目主数据 |
| `module_files` | 模块 CDE 文件节点 |
| `module_transactions` | 生命周期事务 |
| `module_transaction_approvals` | 模块审批 |
| `audit_events` / `audit_log` | 审计 |
| `assets`, `asset_versions`, `asset_files` | 文件、模型、档案资产 |
| `object_store_bindings` | SeaweedFS S3 对象绑定 |
| `conversion_jobs`, `runtime_executions` | Worker 执行与转换 |
| `bim_uploads` | BIM 源文件元数据 |
| `boq_items` | 初始 BOQ 表 |
| `cost_*` | 计量造价详细工作流 |
| `semantic_dictionary_*` | bSDD / SJG / 标准字典 / 术语 |
| `rag_chunks` | 知识向量块 |
| `agent_invocations` | Agent 调用审计 |
| `data_graph_edges` | 图关系 |
| `data_event_outbox` | 事件 outbox |
| `data_timeseries_points` | 时序数据 |
| `data_analytics_events` | 分析事件 |

### 6.2 新增 BOM schema

建议新增 PostgreSQL schema:

```sql
CREATE SCHEMA IF NOT EXISTS bom;
```

#### 6.2.1 `bom.bom_sets`

一个 BOM 主对象,不直接存行项。

```sql
CREATE TABLE bom.bom_sets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    owner_module_id     TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    bom_type            TEXT NOT NULL,
    bom_key             TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    source_object_type  TEXT NOT NULL DEFAULT '',
    source_object_id    TEXT NOT NULL DEFAULT '',
    current_version_id  UUID,
    status              TEXT NOT NULL DEFAULT 'draft',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, bom_key)
);
```

#### 6.2.2 `bom.bom_versions`

BOM 版本是下游消费的稳定单位。

```sql
CREATE TABLE bom.bom_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_set_id          UUID NOT NULL REFERENCES bom.bom_sets(id) ON DELETE CASCADE,
    version_no          INTEGER NOT NULL CHECK (version_no >= 1),
    version_label       TEXT NOT NULL,
    state               TEXT NOT NULL DEFAULT 'draft',
    source_version_id   UUID REFERENCES bom.bom_versions(id) ON DELETE SET NULL,
    change_reason       TEXT NOT NULL DEFAULT '',
    related_file_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    transaction_id      UUID REFERENCES module_transactions(id) ON DELETE SET NULL,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    issue_no            TEXT NOT NULL DEFAULT '',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, bom_set_id, version_no)
);
```

#### 6.2.3 `bom.bom_items`

BOM 行项承载多类型对象,但关键字段要结构化,不能只放 JSON。

```sql
CREATE TABLE bom.bom_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id      UUID NOT NULL REFERENCES bom.bom_versions(id) ON DELETE CASCADE,
    parent_item_id      UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    item_no             TEXT NOT NULL,
    item_code           TEXT NOT NULL DEFAULT '',
    item_name           TEXT NOT NULL,
    item_type           TEXT NOT NULL,
    discipline          TEXT NOT NULL DEFAULT '',
    zone_key            TEXT NOT NULL DEFAULT '',
    floor_key           TEXT NOT NULL DEFAULT '',
    grid_key            TEXT NOT NULL DEFAULT '',
    element_id          TEXT NOT NULL DEFAULT '',
    ifc_guid            TEXT NOT NULL DEFAULT '',
    standard_ref        TEXT NOT NULL DEFAULT '',
    material_code       TEXT NOT NULL DEFAULT '',
    specification       TEXT NOT NULL DEFAULT '',
    unit                TEXT NOT NULL,
    quantity            NUMERIC(20,6) NOT NULL DEFAULT 0,
    waste_rate          NUMERIC(12,6) NOT NULL DEFAULT 0,
    net_quantity        NUMERIC(20,6) NOT NULL DEFAULT 0,
    procurement_qty     NUMERIC(20,6) NOT NULL DEFAULT 0,
    unit_weight_kg      NUMERIC(20,6) NOT NULL DEFAULT 0,
    total_weight_kg     NUMERIC(20,6) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'draft',
    confidence          NUMERIC(8,6) NOT NULL DEFAULT 0,
    review_required     BOOLEAN NOT NULL DEFAULT TRUE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, bom_version_id, item_no)
);
```

#### 6.2.4 来源、计量、属性、价格

```sql
CREATE TABLE bom.item_sources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_item_id         UUID NOT NULL REFERENCES bom.bom_items(id) ON DELETE CASCADE,
    source_kind         TEXT NOT NULL,
    source_file_id      UUID REFERENCES module_files(id) ON DELETE SET NULL,
    source_artifact_id  TEXT NOT NULL DEFAULT '',
    source_element_id   TEXT NOT NULL DEFAULT '',
    source_location     JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_method   TEXT NOT NULL,
    agent_run_id        UUID,
    evidence_hash       TEXT NOT NULL DEFAULT '',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bom.item_measurements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_item_id         UUID NOT NULL REFERENCES bom.bom_items(id) ON DELETE CASCADE,
    measurement_type    TEXT NOT NULL,
    formula             TEXT NOT NULL DEFAULT '',
    input_values        JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_value        NUMERIC(20,6) NOT NULL DEFAULT 0,
    unit                TEXT NOT NULL,
    rule_ref            TEXT NOT NULL DEFAULT '',
    source_status       TEXT NOT NULL DEFAULT 'source_pending',
    reviewer            UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bom.item_properties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_item_id         UUID NOT NULL REFERENCES bom.bom_items(id) ON DELETE CASCADE,
    property_key        TEXT NOT NULL,
    property_value      TEXT NOT NULL,
    value_type          TEXT NOT NULL DEFAULT 'text',
    unit                TEXT NOT NULL DEFAULT '',
    standard_ref        TEXT NOT NULL DEFAULT '',
    source_ref          TEXT NOT NULL DEFAULT '',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, bom_item_id, property_key)
);

CREATE TABLE bom.price_bindings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_item_id         UUID NOT NULL REFERENCES bom.bom_items(id) ON DELETE CASCADE,
    price_snapshot_id   UUID REFERENCES cost_price_snapshots(id) ON DELETE SET NULL,
    resource_item_id    UUID REFERENCES cost_resource_items(id) ON DELETE SET NULL,
    currency            TEXT NOT NULL DEFAULT 'CNY',
    unit_price          NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_price         NUMERIC(20,4) NOT NULL DEFAULT 0,
    source_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 6.2.5 采购、生产、物流、现场、财务扩展

```sql
CREATE TABLE bom.procurement_demands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id      UUID NOT NULL REFERENCES bom.bom_versions(id) ON DELETE CASCADE,
    demand_no           TEXT NOT NULL,
    demand_type         TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft',
    required_date       DATE,
    supplier_strategy   TEXT NOT NULL DEFAULT '',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, demand_no)
);

CREATE TABLE bom.purchase_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    procurement_demand_id UUID REFERENCES bom.procurement_demands(id) ON DELETE SET NULL,
    bom_item_id         UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    supplier_id         TEXT NOT NULL DEFAULT '',
    po_no               TEXT NOT NULL DEFAULT '',
    material_code       TEXT NOT NULL,
    ordered_qty         NUMERIC(20,6) NOT NULL DEFAULT 0,
    received_qty        NUMERIC(20,6) NOT NULL DEFAULT 0,
    unit                TEXT NOT NULL,
    unit_price          NUMERIC(20,4) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'planned',
    expected_arrival    DATE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bom.production_work_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id      UUID NOT NULL REFERENCES bom.bom_versions(id) ON DELETE CASCADE,
    work_order_no       TEXT NOT NULL,
    work_center         TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'planned',
    planned_start       TIMESTAMPTZ,
    planned_finish      TIMESTAMPTZ,
    actual_start        TIMESTAMPTZ,
    actual_finish       TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, project_id, work_order_no)
);

CREATE TABLE bom.production_operations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    work_order_id       UUID NOT NULL REFERENCES bom.production_work_orders(id) ON DELETE CASCADE,
    bom_item_id         UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    operation_code      TEXT NOT NULL,
    operation_name      TEXT NOT NULL,
    sequence_no         INTEGER NOT NULL,
    machine_code        TEXT NOT NULL DEFAULT '',
    qc_required         BOOLEAN NOT NULL DEFAULT TRUE,
    status              TEXT NOT NULL DEFAULT 'planned',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bom.qc_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_item_id         UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    operation_id        UUID REFERENCES bom.production_operations(id) ON DELETE SET NULL,
    qc_type             TEXT NOT NULL,
    verdict             TEXT NOT NULL DEFAULT 'pending',
    measured_values     JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_file_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    inspector_id        UUID REFERENCES users(id),
    inspected_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bom.logistics_packages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    package_no          TEXT NOT NULL,
    bom_version_id      UUID REFERENCES bom.bom_versions(id) ON DELETE SET NULL,
    package_type        TEXT NOT NULL DEFAULT '',
    gross_weight_kg     NUMERIC(20,6) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'packing',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, project_id, package_no)
);

CREATE TABLE bom.site_receipts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    package_id          UUID REFERENCES bom.logistics_packages(id) ON DELETE SET NULL,
    receipt_no          TEXT NOT NULL,
    received_at         TIMESTAMPTZ,
    receiver_id         UUID REFERENCES users(id),
    verdict             TEXT NOT NULL DEFAULT 'pending',
    issue_summary       TEXT NOT NULL DEFAULT '',
    evidence_file_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bom.installation_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_item_id         UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    element_id          TEXT NOT NULL DEFAULT '',
    install_zone        TEXT NOT NULL DEFAULT '',
    installed_at        TIMESTAMPTZ,
    crew_id             TEXT NOT NULL DEFAULT '',
    verdict             TEXT NOT NULL DEFAULT 'pending',
    evidence_file_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bom.finance_posting_candidates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_type         TEXT NOT NULL,
    source_id           TEXT NOT NULL,
    bom_item_id         UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    amount              NUMERIC(20,4) NOT NULL DEFAULT 0,
    currency            TEXT NOT NULL DEFAULT 'CNY',
    posting_type        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'candidate',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 6.2.6 变更与差异

```sql
CREATE TABLE bom.change_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    change_no           TEXT NOT NULL,
    source_module_id    TEXT NOT NULL REFERENCES modules(id),
    reason              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft',
    related_file_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
    transaction_id      UUID REFERENCES module_transactions(id) ON DELETE SET NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, change_no)
);

CREATE TABLE bom.diff_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    change_order_id     UUID REFERENCES bom.change_orders(id) ON DELETE CASCADE,
    from_item_id        UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    to_item_id          UUID REFERENCES bom.bom_items(id) ON DELETE SET NULL,
    diff_type           TEXT NOT NULL,
    qty_delta           NUMERIC(20,6) NOT NULL DEFAULT 0,
    amount_delta        NUMERIC(20,4) NOT NULL DEFAULT 0,
    reason              TEXT NOT NULL DEFAULT '',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

### 6.3 索引、RLS 与分区

必建索引:

```sql
CREATE INDEX idx_bom_sets_scope
    ON bom.bom_sets(tenant_id, project_id, owner_module_id, bom_type, status);

CREATE INDEX idx_bom_versions_scope
    ON bom.bom_versions(tenant_id, project_id, bom_set_id, state, version_no DESC);

CREATE INDEX idx_bom_items_version
    ON bom.bom_items(tenant_id, bom_version_id, parent_item_id, item_type);

CREATE INDEX idx_bom_items_element
    ON bom.bom_items(tenant_id, project_id, element_id, ifc_guid);

CREATE INDEX idx_bom_items_material
    ON bom.bom_items(tenant_id, project_id, material_code, specification);

CREATE INDEX idx_bom_items_metadata
    ON bom.bom_items USING gin (metadata);
```

所有 `bom.*` 表必须:

1. 启用 RLS。
2. 使用 `current_tenant()` 隔离。
3. mutation 写 `audit_events` 和 `data_event_outbox`。
4. 生产大表按 `tenant_id/project_id` 逻辑隔离,必要时按时间或项目分区。
5. 不允许通过前端直接 SQL 写入,只能通过 Gateway / Database Manager 管控路径。

---

## 7. BOM Ontology 与数据血缘

### 7.1 Ontology 层

Ontology 不是单独画图,而是可查询的图关系和语义字典。

| 来源 | 作用 |
|---|---|
| `semantic_dictionary_standards` | 标准体系,如 IFC、bSDD、GB、企业标准 |
| `semantic_dictionary_namespaces` | 命名空间 |
| `semantic_dictionary_rdf_terms` | RDF/术语节点 |
| `semantic_dictionary_categories` | 分类 |
| `semantic_dictionary_classification_mappings` | 分类映射 |
| `semantic_dictionary_terminologies` | 术语 |
| `bim_model_unit_semantic_bindings` | 模型单元语义绑定 |
| `data_graph_edges` | 跨对象图关系 |

### 7.2 图关系类型

建议在 `data_graph_edges.relationship_type` 中登记:

| relationship_type | from -> to | 用途 |
|---|---|---|
| `project_has_bom` | project -> bom_set | 项目拥有 BOM |
| `bom_has_version` | bom_set -> bom_version | 版本链 |
| `version_has_item` | bom_version -> bom_item | 行项 |
| `item_has_child` | bom_item -> bom_item | 层级 |
| `item_derived_from_file` | bom_item -> module_file | 来源文件 |
| `item_derived_from_ifc_element` | bom_item -> ifc_element | 模型来源 |
| `item_maps_to_standard` | bom_item -> standard_term | 标准映射 |
| `item_maps_to_material` | bom_item -> material_spec | 材料规格 |
| `item_maps_to_boq` | bom_item -> cost_boq_item | 造价映射 |
| `item_generates_purchase_line` | bom_item -> purchase_line | 采购 |
| `item_generates_work_order` | bom_item -> work_order | 生产 |
| `item_installed_by_record` | bom_item -> installation_record | 现场安装 |
| `item_backed_by_qc` | bom_item -> qc_record | 质量证据 |
| `item_backed_by_archive` | bom_item -> asset_version | 档案 |
| `agent_generated_item` | agent_run -> bom_item | Agent 生成 |
| `approval_controls_version` | approval -> bom_version | 审批 |
| `change_order_changes_item` | change_order -> bom_item | 变更 |

### 7.3 单一事实来源

| 事实类型 | 真源 | 不允许 |
|---|---|---|
| 源文件 | ObjectStore + `module_files` + `asset_versions` | 浏览器缓存、截图、下载副本 |
| BOM 版本 | `bom.bom_versions` | 前端 state |
| BOM 行项 | `bom.bom_items` | Excel 临时表作为唯一事实 |
| 构件几何 | IFC / DWG / STEP 源文件与 worker manifest | GLB/截图替代源文件 |
| 价格 | `cost_price_snapshots` + source evidence | Agent 编造价格 |
| 采购 | 采购单/供应商/审批 | 未审批的建议 |
| 生产 | 工单、工序、质检、设备记录 | 手工口头状态 |
| 现场 | 到货、安装、照片、检验批、监理确认 | 无证据完工 |
| 财务 | 合同、发票、付款、验收、凭证 | BOM 自动入账 |

---

## 8. 应用架构

### 8.1 BOM Workbench 嵌入位置

建议新增可复用组件:

| 组件 | 位置 | 作用 |
|---|---|---|
| `BomObjectPanel` | `03-frontend/components` | 当前模块 BOM 摘要、状态、待办 |
| `BomExplorer` | `03-frontend/components` | BOM 树表、筛选、展开、搜索 |
| `BomVersionDiffPanel` | `03-frontend/components` | 版本差异、增删改、金额/重量影响 |
| `BomSourceTraceDrawer` | `03-frontend/components` | 来源文件、IFC GUID、图元、Agent、规则证据 |
| `BomApprovalPanel` | `03-frontend/components` | 审批、驳回、退回、签审 |
| `BomAgentRunPanel` | `03-frontend/components` | Agent 计划、工具、RAG、门禁结果 |
| `BomModelLinkPanel` | `OpenEngineeringEditor` 内 | 选中构件联动 BOM item |

这些组件由 `ModuleDetailWorkbench` 调用,不要新增一个独立产品壳。

### 8.2 视图模式

| 视图 | 用途 |
|---|---|
| BOM 树 | 项目/楼栋/楼层/构件/材料层级 |
| BOM 矩阵 | 行项 × 属性 × 来源 × 成本 × 状态 |
| 版本差异 | V1/V2/V3 差异、变更原因、影响金额 |
| 来源追溯 | 文件、模型、图纸、照片、会议、Agent、规则 |
| 模型联动 | 点构件看 BOM,点 BOM 定位模型 |
| 采购视图 | 供应商、交期、订单、到货 |
| 生产视图 | 工单、工序、CNC、质检 |
| 现场视图 | 到场、安装、检验批、整改 |
| 财务视图 | 合同、订单、验收、发票、付款依据 |
| Agent 视图 | 计划、工具调用、置信度、失败原因 |

### 8.3 用户操作

| 操作 | 后端合同 | 门禁 |
|---|---|---|
| 创建 BOM | `POST /v1/bom/sets` | 权限 + 审计 |
| 导入 BOM | `POST /v1/bom/import-jobs` | 文件校验 + SchemaValidator |
| 从模型提取 | `POST /v1/bom/extraction-jobs` | Worker + Evaluator |
| 生成版本 | `POST /v1/bom/sets/{id}/versions` | Transaction |
| 提交复核 | `POST /v1/bom/versions/{id}/submit` | RuleChecker |
| 审批版本 | `POST /v1/bom/versions/{id}/approve` | Approver |
| 发布下游 | `POST /v1/bom/versions/{id}/issue` | approved only |
| 创建变更 | `POST /v1/bom/change-orders` | 差异计算 + 审批 |
| 生成采购需求 | `POST /v1/bom/versions/{id}/procurement-demands` | issued only |
| 生成工单 | `POST /v1/bom/versions/{id}/work-orders` | issued only |
| 归档 | `POST /v1/bom/versions/{id}/archive` | 数字档案审批 |

---

## 9. 智能体架构

### 9.1 Agent 编排原则

1. Agent 不直接写最终态。
2. 所有 Agent 请求带 `module_id`, `task_type`, `input_artifacts`, `expected_schema`, `permission_context`。
3. 模型选择只走 `ModelRouter / InferenceRouter`。
4. 工具只走 `ToolRouter / Skill Registry / MCP Tool Registry`。
5. 文件写入只走 CDE / ObjectStore / ModuleBackendAdapter。
6. 每次输出都有 `trace`, `tool_calls`, `rag_chunks`, `gates`, `output_status`, `audit_id`。
7. 对专业结论,Agent 只能给建议或草稿,不能直接给“可施工/可验收/可支付”。

### 9.2 Agent 类型

| Agent | 主模块 | 输入 | 工具 | 输出 | 门禁 |
|---|---|---|---|---|---|
| `DemandStructuringAgent` | 市场客服 | 会议纪要、客户需求、图片 | OCR、RAG、Schema | 需求 BOM 草稿 | 人工确认 |
| `PlanningBomAgent` | 计划管理 | 需求 BOM、资源、里程碑 | WBS 规则、图关系 | 计划 BOM | 项目经理确认 |
| `StandardLibraryAgent` | 标准族库 | 标准、族库、材料 | 术语库、bSDD、规则库 | 标准映射建议 | 标准库审批 |
| `ModelExtractionAgent` | 深化设计 | IFC/DWG/STEP | CAD/BIM worker、OpenEngineeringEditor | EBOM 草稿 | 设计复核 |
| `BomNormalizationAgent` | 多模块 | 多来源 BOM | 单位换算、去重、字典映射 | 标准化 BOM | SchemaValidator |
| `MeasurementAgent` | 计量造价 | EBOM、图纸、规则 | 几何测量、造价规则 | 工程量明细 | 造价复核 |
| `CostMappingAgent` | 计量造价 | BOM、定额、价格 | cost_* 表、价格快照 | BOQ/QBOM | 造价审批 |
| `ProcurementAgent` | 材料物流 | QBOM、库存、供应商 | 供应商库、价格、交期 | 采购需求 | 采购审批 |
| `ProductionRouteAgent` | 生产制造 | EBOM/PBOM、设备能力 | 工艺库、CNC worker | MBOM/工单 | 生产审批 |
| `QcPlanningAgent` | 生产/施工 | MBOM/IBOM、标准 | 质检规则、抽样规则 | QC 计划 | 质检审批 |
| `LogisticsAgent` | 材料物流 | 包装、工单、交期 | 路径、车辆、批次 | 发运 BOM | 物流确认 |
| `SiteInstallAgent` | 施工管理 | 到场、图纸、计划 | 移动端、照片、二维码 | 安装记录 | 监理/施工确认 |
| `ChangeImpactAgent` | 多模块 | 变更请求、旧版/新版 | diff、图关系、成本 | 影响分析 | 项目审批 |
| `FinanceControlAgent` | 财务管理 | 采购、验收、合同、发票 | 财务规则、权限 | 凭证候选 | 财务审批 |
| `ArchiveAgent` | 数字档案 | approved/issued 版本 | 归档规则、对象存储 | 归档包清单 | 档案审批 |
| `DataQualityAgent` | AI 中心 | BOM 全库 | 规则、异常检测 | 质量问题 | 数据治理 |

### 9.3 三层智能体结构

```text
个体智能体
  执行单个任务: 提取、映射、归一、差异、生成报告

流程智能体
  编排跨步骤任务: 模型 -> EBOM -> BOQ -> 采购 -> 工单

企业级智能体
  经营协同: 项目成本、交付风险、产能、资金、人员、客户承诺
```

### 9.4 Agent 状态和审计

建议新增或扩展:

```sql
CREATE TABLE bom.agent_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id           TEXT NOT NULL REFERENCES modules(id),
    agent_id            TEXT NOT NULL,
    task_type           TEXT NOT NULL,
    input_refs          JSONB NOT NULL DEFAULT '[]'::jsonb,
    output_refs         JSONB NOT NULL DEFAULT '[]'::jsonb,
    output_status       TEXT NOT NULL DEFAULT 'draft',
    gates               JSONB NOT NULL DEFAULT '[]'::jsonb,
    tool_calls          JSONB NOT NULL DEFAULT '[]'::jsonb,
    rag_chunks          JSONB NOT NULL DEFAULT '[]'::jsonb,
    model_route         JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_estimate       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'queued',
    error_message       TEXT NOT NULL DEFAULT '',
    audit_event_id      UUID,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

该表可与现有 `agent_invocations` 并行一段时间,后续归一到通用 AgentRun 表。

---

## 10. 工作流架构

### 10.1 通用 BOM 门禁链

```text
Create / Import / Extract
  -> Planner
  -> Generator
  -> Evaluator
  -> RuleChecker
  -> SchemaValidator
  -> Approver
  -> Issue
  -> Downstream Consume
  -> Archive
```

| Gate | 检查内容 | 失败处理 |
|---|---|---|
| Planner | 任务拆解、输入是否齐、目标 schema | `blocked` |
| Generator | 生成 BOM 草稿、来源引用 | `generated` 但不可下游 |
| Evaluator | 完整性、重复、异常、置信度 | 退回修正 |
| RuleChecker | 标准、单位、编码、专业规则 | `rule_checked` 或 `blocked` |
| SchemaValidator | JSON Schema / SQL 约束 / IFC Schema / Module Schema | 结构失败直接阻断 |
| Approver | 人工专业复核、签审、审批意见 | approved/rejected |

### 10.2 模型到 EBOM

```text
IFC/DWG/STEP source file
  -> ObjectStore 保存源文件
  -> module_files 建档
  -> Worker 解析
  -> Element identity map
  -> ModelExtractionAgent
  -> EBOM draft
  -> Evaluator
  -> RuleChecker
  -> SchemaValidator
  -> 设计/结构复核
  -> EBOM approved
```

### 10.3 EBOM 到 BOQ/QBOM

```text
EBOM approved
  -> MeasurementAgent
  -> cost_quantity_details / cost_boq_items
  -> CostMappingAgent
  -> price snapshot binding
  -> RuleChecker
  -> 造价复核
  -> QBOM issued
```

### 10.4 QBOM 到采购

```text
QBOM issued
  -> ProcurementAgent
  -> procurement_demand
  -> supplier / price / delivery comparison
  -> approval
  -> purchase_lines
  -> EventStore 发布 procurement.demand.issued
```

### 10.5 EBOM/PBOM 到生产

```text
EBOM/PBOM issued
  -> ProductionRouteAgent
  -> MBOM
  -> work_orders
  -> operations
  -> CNC / weld / paint / package artifacts
  -> QC plan
  -> production events
```

### 10.6 到场、安装、验收

```text
shipment_bom
  -> site_receipt
  -> material receipt / witness sampling
  -> installation_record
  -> inspection lot
  -> NCR / rectification if failed
  -> as-built update
  -> archive
```

### 10.7 变更闭环

```text
change request
  -> locate affected BOM versions
  -> diff_items
  -> affected cost / procurement / production / site / finance
  -> approval
  -> new BOM version
  -> downstream cancellation / supplement / rework
```

---

## 11. API 与事件架构

### 11.1 REST API

| 方法 | Endpoint | 用途 |
|---|---|---|
| GET | `/v1/bom/types` | BOM 类型 registry |
| GET | `/v1/projects/{project_id}/boms` | 项目 BOM 列表 |
| POST | `/v1/bom/sets` | 创建 BOM |
| GET | `/v1/bom/sets/{bom_id}` | BOM 主对象 |
| POST | `/v1/bom/sets/{bom_id}/versions` | 创建版本 |
| GET | `/v1/bom/versions/{version_id}` | 版本详情 |
| GET | `/v1/bom/versions/{version_id}/items` | 行项列表 |
| POST | `/v1/bom/versions/{version_id}/items` | 新增行项 |
| PATCH | `/v1/bom/items/{item_id}` | 修改行项草稿 |
| GET | `/v1/bom/items/{item_id}/sources` | 来源追溯 |
| GET | `/v1/bom/items/{item_id}/graph` | 图关系 |
| POST | `/v1/bom/import-jobs` | 导入 Excel/CSV/JSON/ERP |
| POST | `/v1/bom/extraction-jobs` | 从模型/图纸提取 |
| POST | `/v1/bom/versions/{version_id}/submit` | 提交复核 |
| POST | `/v1/bom/versions/{version_id}/approve` | 审批 |
| POST | `/v1/bom/versions/{version_id}/reject` | 驳回 |
| POST | `/v1/bom/versions/{version_id}/issue` | 发布 |
| POST | `/v1/bom/change-orders` | 创建变更 |
| GET | `/v1/bom/change-orders/{change_id}/diff` | 变更差异 |
| POST | `/v1/bom/versions/{version_id}/agent-runs` | 执行 BOM Agent |

### 11.2 事件

事件写入 `data_event_outbox`,再由 NATS JetStream 发布。

| event_type | 触发 |
|---|---|
| `bom.set.created` | 创建 BOM |
| `bom.version.created` | 创建版本 |
| `bom.version.submitted` | 提交复核 |
| `bom.version.rule_checked` | 规则检查完成 |
| `bom.version.approved` | 审批通过 |
| `bom.version.issued` | 发布下游 |
| `bom.version.archived` | 归档 |
| `bom.item.changed` | 行项变化 |
| `bom.change_order.created` | 创建变更 |
| `bom.change_order.approved` | 变更审批 |
| `procurement.demand.issued` | 生成采购需求 |
| `production.work_order.created` | 生成工单 |
| `site.receipt.recorded` | 到场验收 |
| `finance.posting_candidate.created` | 财务候选 |
| `agent.bom_run.completed` | Agent 运行完成 |

事件 payload 必须包括:

```json
{
  "tenantId": "...",
  "projectId": "...",
  "moduleId": "...",
  "targetType": "...",
  "targetId": "...",
  "version": 1,
  "actor": "...",
  "auditId": "...",
  "idempotencyKey": "..."
}
```

---

## 12. 技术运行架构

### 12.1 服务分层

| 服务 | 语言 | 职责 |
|---|---|---|
| `architoken-gateway` | Rust / axum | OpenAPI、鉴权、审计、限流、事务 |
| `harness-core` | Rust | Module Registry、Lifecycle、Generation、StorageRouter |
| `bom-service` | Rust | BOM API、版本、行项、差异、发布、RLS |
| `database-manager` | Rust + Go | 数据库资源、schema、CRUD、审计、连接 |
| `agent-orchestrator` | Python | LangGraph / Planner / Generator / Evaluator 编排 |
| `format-workers` | Rust/C++/Python/Go | CAD/BIM/PDF/Office/OCR/Geometry |
| `costing-service` | Rust | BOQ、价格、成本、造价工作流 |
| `production-adapter` | 外部服务/sidecar | Paperclip/MES/CNC/质检适配 |
| `archive-worker` | Rust/Python | 归档包、签章、校验、长期保存 |
| `observability` | Prometheus/ClickHouse/log | 指标、日志、事件、审计 |

### 12.2 数据流

```text
User / Agent / Worker
  -> Gateway
  -> PermissionGuard + Tenant RLS
  -> Module Transaction
  -> BOM Service
  -> RelationalStore write
  -> ObjectStore source/artifact binding
  -> GraphStore relation edges
  -> EventStore outbox
  -> AuditEvent
  -> Frontend event refresh
```

### 12.3 文件与对象存储

| 文件类型 | 存储 | 处理 |
|---|---|---|
| IFC/DWG/DXF/STEP/SKP/3DM/RVT | ObjectStore source artifact | Worker 解析,源文件保留 |
| Excel/CSV | ObjectStore + import manifest | SchemaValidator |
| PDF/Office | ObjectStore + Collabora/Stirling/PaddleOCR | 源文件真源,派生可追溯 |
| CNC/NC | ObjectStore + production manifest | 生产审批 |
| 照片/视频/点云 | ObjectStore + metadata | 现场/孪生证据 |
| 归档包 | ObjectStore + archive manifest | digital_archive 审批 |

### 12.4 缓存与锁

Valkey 仅用于短期状态:

| Key | 用途 |
|---|---|
| `bom:lock:{version_id}` | 编辑锁 |
| `bom:job:{job_id}` | 导入/提取任务状态 |
| `bom:idempotency:{key}` | 幂等 |
| `bom:cursor:{query}` | 大列表分页游标 |
| `agent:run:{run_id}` | Agent 运行短期状态 |

不能把 Valkey 当 BOM 真源。

---

## 13. 权限、安全与等保考虑

### 13.1 权限模型

权限范围至少包括:

```text
tenant
project
module
bom_set
bom_version
bom_item
file
transaction
approval
agent_run
```

关键权限:

| permission | 说明 |
|---|---|
| `bom.read` | 查看 BOM |
| `bom.create` | 创建 BOM |
| `bom.edit_draft` | 编辑草稿 |
| `bom.submit` | 提交复核 |
| `bom.rule_check` | 触发规则检查 |
| `bom.approve` | 审批 |
| `bom.issue` | 发布下游 |
| `bom.change_order.create` | 创建变更 |
| `bom.consume.procurement` | 采购消费 |
| `bom.consume.production` | 生产消费 |
| `bom.consume.finance` | 财务消费 |
| `bom.admin` | 管理 |

### 13.2 等保与企业安全

| 控制项 | BOM 系统要求 |
|---|---|
| 身份鉴别 | MFA、强密码、扫码/验证码、会话过期 |
| 访问控制 | RBAC + 项目/模块/资源粒度权限 |
| 安全审计 | 所有读写、导出、审批、Agent 调用写审计 |
| 入侵防范 | WAF、API 限流、工具沙箱、命令白名单 |
| 数据完整性 | checksum、版本、签名、不可篡改审计 |
| 数据保密性 | TLS、对象存储加密、敏感字段脱敏 |
| 备份恢复 | PostgreSQL、ObjectStore、配置、审计日志备份 |
| 运维安全 | JumpServer 作为运维堡垒机入口,SSH/RDP/HTTPS 运维统一审计 |
| 日志留存 | API、DB、对象存储、Agent、Worker、操作系统日志集中保存 |
| 最小权限 | Agent、Worker、DB 用户、对象存储 bucket 分权 |

### 13.3 JumpServer 边界

JumpServer 只作为运维审计和堡垒入口:

```text
运维人员
  -> JumpServer
  -> 服务器 / 数据库 / k8s / 网络设备
  -> 命令审计 / 会话录像 / 文件传输控制
```

它不替代 ArchIToken 内部 IAM、BOM 审批和业务审计。

---

## 14. 与外部系统集成

| 系统 | 集成内容 | 方式 |
|---|---|---|
| CAD/BIM 工具 | IFC/DWG/RVT/SKP/3DM/STEP 源文件和派生 | ObjectStore + Worker + Adapter |
| ERP | 采购、库存、订单、财务 | REST/Webhook/CSV/DB connector |
| MES | 工单、工序、设备、质检 | Adapter / sidecar |
| WMS | 库存、库位、批次 | API/CSV |
| 供应商 | 询价、报价、交期、质保书 | 门户/API/导入 |
| 微信/小程序 | 移动审批、现场拍照、扫码构件 | API Gateway + 审计 |
| 财务软件 | 合同、发票、凭证候选 | Finance adapter |
| 对象存储 | 文件、模型、归档包 | S3-compatible |
| 模型服务 | 本地/云模型 | ModelRouter / InferenceRouter |

---

## 15. 实施路线

### P0: 架构和真源对齐

| 交付物 | 文件 |
|---|---|
| 对齐 API 文档模块数量真源 | `docs/04_ARCHITOKEN_API_AND_INTEGRATION_MAP.md` |
| BOM 架构文档 | 本文 |
| BOM 类型 registry 草案 | `02-architecture/MODULES.md` / 新 registry 文档 |
| BOM OpenAPI 草案 | `docs/04_ARCHITOKEN_API_AND_INTEGRATION_MAP.md` |

### P1: 数据库与后端核心

| 交付物 | 文件/目录 |
|---|---|
| `bom` schema migration | `04-backend/migrations/YYYYMMDD_bom_operating_system.sql` |
| Rust BOM service | `04-backend/harness-core/src/bom_*` |
| API handler | `04-backend/harness-core/src` |
| RLS / audit / outbox | migrations + tests |
| Database Manager 可视化 | `03-frontend/components/database-manager` |

### P2: 前端工作台

| 交付物 | 文件/目录 |
|---|---|
| BOM object panel | `03-frontend/components/BomObjectPanel.tsx` |
| BOM explorer | `03-frontend/components/BomExplorer.tsx` |
| BOM diff | `03-frontend/components/BomVersionDiffPanel.tsx` |
| BOM trace drawer | `03-frontend/components/BomSourceTraceDrawer.tsx` |
| Module integration | `ModuleDetailWorkbench.tsx` |

### P3: Worker 与 Agent

| 交付物 | 文件/目录 |
|---|---|
| BOM extraction worker | `06-workers/architoken_workers` |
| Agent prompts | `04-backend/agent-orchestrator/prompts/*` |
| Tool registry | `ai_center` registry |
| RAG / vector index | Qdrant + `rag_chunks` |
| Event integration | NATS / outbox |

### P4: 业务闭环

| 交付物 | 模块 |
|---|---|
| 模型 -> EBOM | 深化设计 |
| EBOM -> BOQ/QBOM | 计量造价 |
| QBOM -> PBOM | 材料物流 |
| EBOM/PBOM -> MBOM | 生产制造 |
| Shipment/IBOM | 施工管理 |
| Archive/Finance | 数字档案 / 财务管理 |

---

## 16. 验收清单

### 16.1 架构验收

| 检查项 | 通过标准 |
|---|---|
| 16 模块一致 | 文档、前端 registry、数据库 modules 表一致 |
| BOM 不孤立 | 所有 BOM 入口嵌入模块工作台 |
| Router 边界 | Agent/模型/工具不直连供应商 |
| 文件真源 | 源文件保留在 ObjectStore + CDE |
| 审计 | 每次 mutation 有 AuditEvent |
| RLS | 所有 BOM 表 tenant 隔离 |
| 版本 | issued/consumed 不可无痕改 |
| 专业复核 | 专业结论不能由 AI 直接最终化 |

### 16.2 数据验收

| 场景 | 验收 |
|---|---|
| 导入 Excel BOM | 生成 BOM version、items、sources、audit |
| 从 IFC 提取 EBOM | item 绑定 `ifc_guid`、source_file_id、worker evidence |
| EBOM 转 BOQ | 生成 cost_boq_items / price_bindings |
| 发布采购 | 生成 procurement_demand / event |
| 创建工单 | 生成 work_order / operations |
| 到场验收 | site_receipt 绑定 package/item/evidence |
| 安装记录 | installation_record 绑定 element/item/photo |
| 变更 | diff_items 说明增删改、数量和金额影响 |

### 16.3 Agent 验收

| 检查项 | 通过标准 |
|---|---|
| trace 完整 | plan、tools、rag、model route、gates 都有 |
| 输出结构化 | 符合 JSON Schema |
| 工具审计 | tool_calls 有输入、输出、耗时、错误 |
| RAG 引用 | 标准/历史/文档引用可追溯 |
| 门禁分离 | Generator 和 Evaluator 不同职责 |
| 人工复核 | 专业结论停在 `professional_review_required` |

---

## 17. 硬件只作为承载层

硬件配置应服务于上述架构,不是架构本身。30 人团队、3 开发、6 设计、目标 40-50 万预算时,优先保障:

1. PostgreSQL / ObjectStore / Backup 的可靠性。
2. BOM/Agent/Workflow 的数据完整性和审计。
3. 服务器虚拟化和容器部署。
4. 100 用户内可先用 CPU 服务器 + 云端/外部模型路由。
5. 本地 GPU worker 和万兆专线放到第二阶段,除非当前确有本地推理、渲染、点云或大批量模型处理负载。

硬件采购文档应作为附录,不能替代本文的应用、数据库、Agent 和工作流架构。

---

## 18. 依据来源

本文对齐以下仓库文件:

| 文件 | 用途 |
|---|---|
| `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md` | 唯一真源、项目定位、Router/Schema/Data/Deployment 原则 |
| `02-architecture/CONSTITUTION.md` | 工程宪法、Open CDE、AI 门禁、文件运行时、许可证和合规边界 |
| `02-architecture/MODULES.md` | 16 模块和业务边界 |
| `02-architecture/BUSINESS_MODULE_WORKBENCH.md` | 统一模块工作台、文件、生命周期、审批、审计 |
| `02-architecture/ARCHITECTURE.md` | 全栈架构和层次 |
| `02-architecture/ARCHITOKEN_DATABASE_MANAGER.md` | 数据库管理器与数据平面管理边界 |
| `docs/03_ARCHITOKEN_TECH_STACK.md` | 技术栈、前端、后端、运行时、文件路线 |
| `docs/ARCHITOKEN_DATABASE_RUNTIME_TOPOLOGY.md` | 当前 PostgreSQL / SeaweedFS / Valkey / NATS / Qdrant / ClickHouse 运行态 |
| `docs/04_ARCHITOKEN_API_AND_INTEGRATION_MAP.md` | OpenAPI、Agent API、WorkflowRouter、Artifact Schema |
| `docs/ARCHITOKEN_PLATFORM_FUNCTIONAL_MAP.md` | 16 模块功能全景 |
| `01-product/PRD.md` | 产品需求、模块链路、AI 门禁、合规要求 |
| `04-backend/migrations/*.sql` | 当前数据库表、RLS、数据平面、造价工作流、IAM |
| `03-frontend/lib/module-registry.ts` | 前端 ModuleSpec、Artifact、Workflow、AgentGate |
| `03-frontend/lib/module-lifecycle.ts` | 前端生命周期状态机 |
| `04-backend/harness-core/src/*` | Rust Harness Core、Generation、Lifecycle、StorageRouter 合同 |

---

## 19. 模块级详细业务过程

### 19.1 市场客服: 需求 BOM

| 步骤 | 输入 | Agent/服务 | 输出 | 状态 |
|---|---|---|---|---|
| 客户沟通 | 文字、语音转写、图片、微信记录、会议纪要 | `DemandStructuringAgent` | 原始需求条目 | `draft_assist` |
| 范围识别 | 面积、层数、房型、预算、风格、交付时间 | RuleChecker | 需求范围 | `rule_checked` |
| 缺失项追问 | 缺少场地、预算、功能房间、标准 | Planner | 待澄清问题 | `blocked` 或 `submitted` |
| 需求确认 | 客户确认、销售确认 | Approver | `requirement_bom` V1 | `approved` |
| 移交计划/方案 | approved V1 | EventStore | `bom.version.issued` | `issued` |

必备字段:

| 字段 | 说明 |
|---|---|
| `customer_requirement_id` | 客户需求来源 |
| `space_requirement` | 空间/房间/面积需求 |
| `budget_boundary` | 预算上下限 |
| `delivery_boundary` | 交付范围,设计/深化/采购/施工是否包含 |
| `assumption_list` | 仍未确认的假设 |
| `risk_list` | 早期风险 |

### 19.2 计划管理: 计划 BOM

| 步骤 | 输入 | 输出 |
|---|---|---|
| 需求拆 WBS | `requirement_bom` | 项目阶段、任务、交付物 |
| 资源估算 | 设计、开发、供应商、生产、施工资源 | `planning_bom` resource lines |
| 里程碑绑定 | 合同节点、客户节点、生产节点 | milestone linked BOM |
| 审批计划 | 模块责任人、专业复核人 | approval plan |

计划 BOM 不参与采购,但决定后续 BOM 的时间和责任矩阵。

### 19.3 方案设计: 方案 BOM

| 输入 | 输出 |
|---|---|
| 需求 BOM、标准族库、概念方案 | 空间清单、初步构件、主要材料、风格包、估算级数量 |

方案 BOM 的用途是比选,不能直接下生产。状态最多到 `professional_review_required` 或方案负责人 approved,不能标成可施工。

### 19.4 标准族库: Master BOM

标准族库是 BOM 的主数据来源:

| 主数据 | 示例 |
|---|---|
| 构件族 | 钢柱、钢梁、檩条、墙板、门窗、节点 |
| 材料 | 钢材牌号、板材、防腐、防火、保温、螺栓 |
| 做法 | 墙体构造、屋面构造、连接节点 |
| 规则 | 单位换算、损耗率、计量规则、质检规则 |
| 术语 | IFC 类、bSDD、GB 术语、企业编码 |

任何 BOM 行项若没有标准族库/语义字典锚点,状态应保持 `source_pending` 或 `review_required`。

### 19.5 深化设计: EBOM

EBOM 是构件级技术真源。典型提取链:

```text
IFC/DWG/STEP/设计参数
  -> source file checksum
  -> worker parse manifest
  -> element identity map
  -> geometry/property extraction
  -> component grouping
  -> EBOM items
  -> source trace
```

EBOM 行项必须尽量绑定:

| 绑定 | 字段 |
|---|---|
| IFC | `ifc_guid`, `ifc_class`, `pset`, `quantity_set` |
| DWG/DXF | `drawing_entity_id`, `layer`, `block_name`, `layout` |
| STEP/3D | `body_id`, `part_id`, `material_property` |
| CDE | `source_file_id`, `source_artifact_id`, `sha256` |
| 审批 | `transaction_id`, `approval_id`, `audit_id` |

### 19.6 计量造价: QBOM / BOQ

QBOM 的核心不是“把 EBOM 数量复制一遍”,而是把 EBOM 映射到计价规则。

| 映射 | 表 |
|---|---|
| 工程量表达式 | `cost_quantity_details` / `bom.item_measurements` |
| 清单项 | `cost_boq_items` |
| 定额子目 | `cost_quota_items`, `cost_quota_subitems` |
| 资源消耗 | `cost_resource_items` |
| 价格快照 | `cost_price_snapshots` |
| 审核差异 | `cost_delta_analysis_items` |

输出必须明确:

1. 送审量。
2. 审定量。
3. 差异量。
4. 单价来源。
5. 规则依据。
6. 是否需要造价专业复核。

### 19.7 材料物流: PBOM / Shipment BOM

PBOM 面向采购和到货,需要从技术规格转成采购规格:

| EBOM 字段 | PBOM 字段 |
|---|---|
| 构件规格 | 可采购材料规格 |
| 净量 | 采购量,含损耗和最小采购单位 |
| 材质 | 供应商可供牌号 |
| 交付节点 | 采购到货日期 |
| 构件位置 | 包装/发运/堆场位置 |

关键对象:

| 对象 | 说明 |
|---|---|
| 采购需求 | 按项目、专业、批次、交期聚合 |
| 询价/比价 | 供应商报价和交期 |
| 采购订单 | approved 后创建 |
| 到货批次 | 到场验收和质保书 |
| 堆场位置 | 现场安装顺序 |

### 19.8 生产制造: MBOM

MBOM 面向车间生产,它不是 EBOM 的复制:

| 差异 | EBOM | MBOM |
|---|---|---|
| 关注点 | 构件设计 | 制造执行 |
| 粒度 | 构件/零件 | 工序/设备/工装/质检 |
| 输出 | 构件清单 | 工单、工艺路线、CNC、包装 |
| 状态 | 设计审批 | 生产审批 |

MBOM 典型行:

| 字段 | 示例 |
|---|---|
| `work_order_no` | WO-202606-001 |
| `operation_code` | CUT / DRILL / WELD / PAINT / PACK |
| `machine_code` | CNC-01 |
| `qc_gate` | 尺寸复核、焊缝检测、防腐厚度 |
| `artifact_file_id` | NC 文件、作业指导书、质检表 |

### 19.9 施工管理: IBOM

IBOM 面向到场、安装、检验批和验收:

| 场景 | 必备绑定 |
|---|---|
| 到场验收 | 采购订单、发运包、质保书、照片 |
| 材料复检 | 样品、检测报告、标准依据 |
| 安装 | 构件二维码、安装位置、班组、照片 |
| 整改 | NCR、责任人、复验 |
| 验收 | 检验批、分项、分部、竣工资料 |

### 19.10 财务管理: Finance BOM

Finance BOM 不直接把工程数据入账,它产生凭证候选和付款依据:

| 业务事实 | 财务用途 |
|---|---|
| 采购订单 approved | 合同/应付候选 |
| 到货验收 pass | 入库/暂估/付款条件 |
| 安装验收 pass | 进度款/结算依据 |
| 变更单 approved | 增减项/签证 |
| 发票匹配 | 应付/税务 |

财务 Agent 只能输出候选,必须由财务人员审批。

---

## 20. JSON Schema 合同草案

### 20.1 `architoken.bom_set.v1`

```json
{
  "$id": "architoken.bom_set.v1",
  "type": "object",
  "required": ["tenantId", "projectId", "ownerModuleId", "bomType", "bomKey", "name"],
  "properties": {
    "tenantId": { "type": "string", "format": "uuid" },
    "projectId": { "type": "string", "format": "uuid" },
    "ownerModuleId": { "type": "string" },
    "bomType": { "type": "string" },
    "bomKey": { "type": "string" },
    "name": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "sourceObjectType": { "type": "string" },
    "sourceObjectId": { "type": "string" },
    "status": { "type": "string" },
    "metadata": { "type": "object" }
  },
  "additionalProperties": false
}
```

### 20.2 `architoken.bom_version.v1`

```json
{
  "$id": "architoken.bom_version.v1",
  "type": "object",
  "required": ["bomSetId", "versionNo", "versionLabel", "state"],
  "properties": {
    "bomSetId": { "type": "string", "format": "uuid" },
    "versionNo": { "type": "integer", "minimum": 1 },
    "versionLabel": { "type": "string" },
    "state": {
      "type": "string",
      "enum": ["draft", "submitted", "generated", "evaluated", "rule_checked", "schema_validated", "pending_approval", "approved", "issued", "consumed", "archived", "blocked", "rejected", "superseded", "voided", "professional_review_required"]
    },
    "sourceVersionId": { "type": ["string", "null"], "format": "uuid" },
    "changeReason": { "type": "string" },
    "relatedFileIds": { "type": "array", "items": { "type": "string" } },
    "relatedArtifactIds": { "type": "array", "items": { "type": "string" } },
    "transactionId": { "type": ["string", "null"], "format": "uuid" },
    "metadata": { "type": "object" }
  },
  "additionalProperties": false
}
```

### 20.3 `architoken.bom_item.v1`

```json
{
  "$id": "architoken.bom_item.v1",
  "type": "object",
  "required": ["bomVersionId", "itemNo", "itemName", "itemType", "unit", "quantity"],
  "properties": {
    "bomVersionId": { "type": "string", "format": "uuid" },
    "parentItemId": { "type": ["string", "null"], "format": "uuid" },
    "itemNo": { "type": "string" },
    "itemCode": { "type": "string" },
    "itemName": { "type": "string" },
    "itemType": { "type": "string" },
    "discipline": { "type": "string" },
    "zoneKey": { "type": "string" },
    "floorKey": { "type": "string" },
    "gridKey": { "type": "string" },
    "elementId": { "type": "string" },
    "ifcGuid": { "type": "string" },
    "standardRef": { "type": "string" },
    "materialCode": { "type": "string" },
    "specification": { "type": "string" },
    "unit": { "type": "string" },
    "quantity": { "type": "number", "minimum": 0 },
    "wasteRate": { "type": "number", "minimum": 0 },
    "netQuantity": { "type": "number", "minimum": 0 },
    "procurementQty": { "type": "number", "minimum": 0 },
    "unitWeightKg": { "type": "number", "minimum": 0 },
    "totalWeightKg": { "type": "number", "minimum": 0 },
    "status": { "type": "string" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "reviewRequired": { "type": "boolean" },
    "metadata": { "type": "object" }
  },
  "additionalProperties": false
}
```

### 20.4 `architoken.bom_agent_run.v1`

```json
{
  "$id": "architoken.bom_agent_run.v1",
  "type": "object",
  "required": ["tenantId", "projectId", "moduleId", "agentId", "taskType", "inputRefs", "outputStatus"],
  "properties": {
    "tenantId": { "type": "string", "format": "uuid" },
    "projectId": { "type": "string", "format": "uuid" },
    "moduleId": { "type": "string" },
    "agentId": { "type": "string" },
    "taskType": { "type": "string" },
    "inputRefs": { "type": "array", "items": { "type": "object" } },
    "outputRefs": { "type": "array", "items": { "type": "object" } },
    "outputStatus": { "type": "string" },
    "gates": { "type": "array", "items": { "type": "object" } },
    "toolCalls": { "type": "array", "items": { "type": "object" } },
    "ragChunks": { "type": "array", "items": { "type": "object" } },
    "modelRoute": { "type": "object" },
    "costEstimate": { "type": "object" },
    "status": { "type": "string" },
    "errorMessage": { "type": "string" },
    "auditEventId": { "type": ["string", "null"], "format": "uuid" }
  },
  "additionalProperties": false
}
```

---

## 21. API 请求与响应示例

### 21.1 创建 BOM

```http
POST /v1/bom/sets
Content-Type: application/json
Idempotency-Key: bom-create-project-a-ebom-001
```

```json
{
  "projectId": "00000000-0000-0000-0000-000000000001",
  "ownerModuleId": "detailed_design",
  "bomType": "engineering_bom",
  "bomKey": "EBOM-JP-20260608",
  "name": "锦屏重钢深化 EBOM",
  "description": "从深化设计 IFC 与节点图提取的构件级 EBOM",
  "sourceObjectType": "module_file",
  "sourceObjectId": "00000000-0000-0000-0000-00000000f001",
  "metadata": {
    "discipline": "steel_structure",
    "reviewPolicy": "registered_structural_engineer_required"
  }
}
```

响应:

```json
{
  "bomId": "00000000-0000-0000-0000-00000000b001",
  "status": "draft",
  "auditId": "00000000-0000-0000-0000-00000000a001"
}
```

### 21.2 从 IFC 提取 EBOM

```http
POST /v1/bom/extraction-jobs
Content-Type: application/json
```

```json
{
  "projectId": "00000000-0000-0000-0000-000000000001",
  "moduleId": "detailed_design",
  "bomType": "engineering_bom",
  "sourceFileId": "00000000-0000-0000-0000-00000000f001",
  "sourceFormat": "ifc",
  "expectedSchema": "architoken.bom_item.v1",
  "workflowPolicy": {
    "approvalRequired": true,
    "professionalReviewRequired": true,
    "allowedOutputStatus": "professional_review_required"
  }
}
```

响应:

```json
{
  "jobId": "00000000-0000-0000-0000-00000000e001",
  "transactionId": "00000000-0000-0000-0000-00000000t001",
  "status": "queued",
  "gates": [
    { "name": "Planner", "status": "pending" },
    { "name": "Generator", "status": "pending" },
    { "name": "Evaluator", "status": "pending" },
    { "name": "RuleChecker", "status": "pending" },
    { "name": "SchemaValidator", "status": "pending" },
    { "name": "Approver", "status": "pending" }
  ]
}
```

### 21.3 查询 BOM 行项

```http
GET /v1/bom/versions/{version_id}/items?limit=100&cursor=0&itemType=component
```

响应:

```json
{
  "items": [
    {
      "itemId": "00000000-0000-0000-0000-00000000i001",
      "itemNo": "S-001",
      "itemName": "H 型钢柱",
      "itemType": "component",
      "discipline": "steel_structure",
      "ifcGuid": "2A3K9XYZABCDEF12367",
      "unit": "件",
      "quantity": 1,
      "unitWeightKg": 128.5,
      "totalWeightKg": 128.5,
      "status": "professional_review_required",
      "confidence": 0.91,
      "reviewRequired": true
    }
  ],
  "pageInfo": {
    "hasNextPage": false,
    "nextCursor": null
  }
}
```

### 21.4 版本审批

```http
POST /v1/bom/versions/{version_id}/approve
Content-Type: application/json
```

```json
{
  "actor": "registered_structural_engineer",
  "decision": "approved",
  "comment": "构件来源、数量和材料规格已按当前设计文件复核。",
  "professionalRole": "registered_structural_engineer",
  "evidenceFileIds": [
    "00000000-0000-0000-0000-00000000f101"
  ]
}
```

---

## 22. 数据库落地清单

### 22.1 Migration 文件建议

| 文件 | 内容 |
|---|---|
| `20260608000001_bom_schema.sql` | `bom` schema、核心表、索引、RLS |
| `20260608000002_bom_event_outbox.sql` | 事件触发器和 outbox 写入 |
| `20260608000003_bom_agent_runs.sql` | AgentRun 表和审计绑定 |
| `20260608000004_bom_seed_registry.sql` | BOM 类型 registry seed |
| `20260608000005_bom_graph_relations.sql` | 图关系类型 registry |

### 22.2 RLS 模板

```sql
ALTER TABLE bom.bom_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom.bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom.bom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY bom_sets_tenant_isolation ON bom.bom_sets
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

CREATE POLICY bom_versions_tenant_isolation ON bom.bom_versions
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

CREATE POLICY bom_items_tenant_isolation ON bom.bom_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE bom.bom_sets FORCE ROW LEVEL SECURITY;
ALTER TABLE bom.bom_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE bom.bom_items FORCE ROW LEVEL SECURITY;
```

### 22.3 审计触发器思路

业务 API 应主动写审计;数据库触发器只作为兜底。

```sql
CREATE OR REPLACE FUNCTION bom.write_bom_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_events (
        tenant_id,
        module_id,
        target_type,
        target_id,
        action,
        actor,
        metadata,
        created_at
    ) VALUES (
        NEW.tenant_id,
        COALESCE(NEW.owner_module_id, 'ai_center'),
        TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        NEW.id::text,
        TG_OP,
        current_setting('app.current_actor', true),
        jsonb_build_object('table', TG_TABLE_NAME),
        NOW()
    );
    RETURN NEW;
END
$$ LANGUAGE plpgsql;
```

### 22.4 Outbox 写入规则

任何会改变下游消费结果的动作必须写 outbox:

| 动作 | event_type |
|---|---|
| approve | `bom.version.approved` |
| issue | `bom.version.issued` |
| archive | `bom.version.archived` |
| create purchase demand | `procurement.demand.issued` |
| create work order | `production.work_order.created` |
| site receipt | `site.receipt.recorded` |
| finance candidate | `finance.posting_candidate.created` |

---

## 23. Agent 合同与提示词边界

### 23.1 通用 Agent 输入

```json
{
  "module_id": "detailed_design",
  "task_type": "extract_engineering_bom",
  "tenant_id": "...",
  "project_id": "...",
  "input_artifacts": [
    {
      "artifact_id": "...",
      "artifact_type": "bim",
      "file_id": "...",
      "object_uri": "s3://architoken-assets/...",
      "sha256": "..."
    }
  ],
  "constraints": {
    "output_schema": "architoken.bom_item.v1",
    "professional_review_required": true,
    "no_final_compliance_claim": true
  },
  "permission_context": {
    "actor": "...",
    "roles": ["designer"],
    "scope": ["project:read", "bom:create"]
  }
}
```

### 23.2 通用 Agent 输出

```json
{
  "output_status": "professional_review_required",
  "structured_result": {
    "bom_set": {},
    "bom_version": {},
    "items": []
  },
  "citations": [
    { "source_type": "module_file", "source_id": "...", "location": {} }
  ],
  "gates": [
    { "name": "Evaluator", "status": "passed", "notes": [] },
    { "name": "RuleChecker", "status": "warning", "notes": ["部分材料标准未绑定"] },
    { "name": "SchemaValidator", "status": "passed", "schema": "architoken.bom_item.v1" }
  ],
  "tool_calls": [],
  "rag_chunks": [],
  "audit_context": {
    "audit_id": "...",
    "transaction_id": "..."
  }
}
```

### 23.3 禁止输出

Agent 不得输出:

| 禁止 | 替代表述 |
|---|---|
| “已合规” | “按当前规则未发现阻断项,仍需专业复核” |
| “可施工” | “可提交施工专业复核” |
| “可生产” | “可提交生产负责人审批” |
| “可付款” | “可作为付款候选依据,需财务审批” |
| “价格准确” | “价格来源为某快照/某供应商报价,需采购/造价确认” |

### 23.4 Agent 与工具路由

```text
Agent
  -> WorkflowRouter
  -> ToolRouter
      -> file_read
      -> ifc_parse
      -> cad_parse
      -> cost_mapping
      -> semantic_dictionary_lookup
      -> graph_query
      -> vector_search
      -> object_store_put
      -> event_outbox_write
  -> ModelRouter / InferenceRouter
  -> Audit
```

---

## 24. 典型项目端到端样例

以一个重钢装配式项目为例:

### 24.1 从客户需求到方案 BOM

1. 客户提供 520 平方米三层建筑需求。
2. 销售上传会议纪要和场地照片。
3. `DemandStructuringAgent` 生成需求 BOM:
   - 建筑面积。
   - 房间和功能。
   - 预算范围。
   - 风格偏好。
   - 交付时间。
4. 销售和项目负责人确认后发布 V1。
5. 方案设计接收 `bom.version.issued` 事件。

### 24.2 从方案到 EBOM

1. 方案设计生成多个概念方案。
2. 设计负责人选择方案并提交深化。
3. 深化设计上传 IFC/DWG/节点文件。
4. Worker 解析模型,生成 element identity map。
5. `ModelExtractionAgent` 生成 EBOM:
   - 钢柱。
   - 主梁。
   - 次梁。
   - 檩条。
   - 墙板。
   - 门窗。
   - 连接件。
6. 结构/深化负责人复核后 approved。

### 24.3 EBOM 到 QBOM 和报价

1. 计量造价读取 EBOM issued 版本。
2. `MeasurementAgent` 计算数量、重量、面积、长度。
3. `CostMappingAgent` 匹配清单、定额、价格快照。
4. 生成送审/审定/差异。
5. 造价负责人审批 QBOM。

### 24.4 QBOM 到采购和生产

1. `ProcurementAgent` 聚合材料需求。
2. 系统生成采购需求和询价清单。
3. 采购确认供应商、价格、交期。
4. `ProductionRouteAgent` 基于 EBOM/PBOM 生成 MBOM:
   - 工单。
   - 工序。
   - CNC 文件。
   - 焊接任务。
   - 质检点。
5. 生产负责人审批后下发。

### 24.5 现场闭环

1. 发运 BOM 生成包装和装车清单。
2. 到场扫码,形成 `site_receipt`。
3. 材料复检、质保书、照片写入 CDE。
4. 安装扫码记录构件位置和班组。
5. 检验批和整改绑定 BOM item。
6. as-built 信息进入数字孪生和数字档案。

### 24.6 财务闭环

1. 采购订单、到货验收、安装验收、发票进入 Finance BOM。
2. `FinanceControlAgent` 生成凭证候选。
3. 财务人员确认。
4. 审计可以从付款追溯到:
   - 合同。
   - 采购订单。
   - BOM 行项。
   - 到货验收。
   - 质检记录。
   - 安装记录。
   - 发票。
   - 审批。

---

## 25. 前后端实施文件映射

### 25.1 后端 Rust

| 文件 | 动作 |
|---|---|
| `04-backend/harness-core/src/bom_types.rs` | 新增 BOM DTO / enum-like registry value structs |
| `04-backend/harness-core/src/bom_service.rs` | BOM CRUD、版本、行项、审批、发布 |
| `04-backend/harness-core/src/bom_repository.rs` | PostgreSQL queries |
| `04-backend/harness-core/src/bom_events.rs` | Event outbox |
| `04-backend/harness-core/src/bom_graph.rs` | GraphStore edges |
| `04-backend/harness-core/src/bom_agent.rs` | Agent invocation bridge |
| `04-backend/harness-core/src/http.rs` | 路由挂载 |
| `04-backend/harness-core/tests/bom_*` | 单元/集成测试 |

### 25.2 数据库

| 文件 | 动作 |
|---|---|
| `04-backend/migrations/20260608000001_bom_schema.sql` | BOM schema |
| `04-backend/migrations/20260608000002_bom_rls.sql` | RLS |
| `04-backend/migrations/20260608000003_bom_events.sql` | outbox |
| `04-backend/migrations/20260608000004_bom_registry_seed.sql` | registry seed |
| `04-backend/migrations/seeds/002_bom_demo_project.sql` | 示例项目 |

### 25.3 前端

| 文件 | 动作 |
|---|---|
| `03-frontend/lib/bom-types.ts` | 类型 |
| `03-frontend/lib/bom-api-client.ts` | API client |
| `03-frontend/lib/bom-workflow.ts` | 状态机 helper |
| `03-frontend/components/BomObjectPanel.tsx` | 模块首页嵌入 |
| `03-frontend/components/BomExplorer.tsx` | BOM 树表 |
| `03-frontend/components/BomVersionDiffPanel.tsx` | diff |
| `03-frontend/components/BomSourceTraceDrawer.tsx` | 来源追溯 |
| `03-frontend/components/BomAgentRunPanel.tsx` | Agent trace |
| `03-frontend/components/ModuleDetailWorkbench.tsx` | 集成入口 |

### 25.4 Agent / Worker

| 文件 | 动作 |
|---|---|
| `04-backend/agent-orchestrator/prompts/detailed_design/bom_extractor.md` | EBOM 提取 |
| `04-backend/agent-orchestrator/prompts/quantity_costing/bom_cost_mapper.md` | QBOM 映射 |
| `04-backend/agent-orchestrator/prompts/material_logistics/procurement_bom_planner.md` | 采购 |
| `04-backend/agent-orchestrator/prompts/production_manufacturing/manufacturing_bom_planner.md` | 生产 |
| `06-workers/architoken_workers/bom_import_worker.py` | Excel/CSV 导入 |
| `06-workers/architoken_workers/bom_ifc_extract_worker.py` | IFC 提取 |
| `06-workers/architoken_workers/bom_diff_worker.py` | 差异 |

### 25.5 文档

| 文件 | 动作 |
|---|---|
| `docs/04_ARCHITOKEN_API_AND_INTEGRATION_MAP.md` | 修正 14 -> 16;加入 BOM API |
| `02-architecture/MODULES.md` | 增加 BOM 作为跨模块对象说明 |
| `02-architecture/BUSINESS_MODULE_WORKBENCH.md` | 加入 BOM 工作台组件规则 |
| `docs/ARCHITOKEN_DATABASE_RUNTIME_TOPOLOGY.md` | 加入 BOM runtime bindings |

---

## 26. 测试与验收计划

### 26.1 数据库测试

| 测试 | 断言 |
|---|---|
| migration up/down | schema 可创建,索引存在 |
| RLS tenant A/B | A 不能读 B |
| issued version immutability | issued 不允许直接改 item |
| change order | 只能通过 change_order 生成新版本 |
| outbox | approve/issue 写事件 |
| audit | mutation 写审计 |

### 26.2 API 测试

| 测试 | 断言 |
|---|---|
| create bom | 返回 bomId/auditId |
| create version | version_no 递增 |
| list items pagination | cursor 正确 |
| submit -> approve -> issue | 状态迁移合法 |
| reject | 状态为 rejected,保留原因 |
| invalid module | 404/400 typed error |
| idempotency | 相同 key 不重复创建 |

### 26.3 Agent 测试

| 测试 | 断言 |
|---|---|
| extract EBOM from fixture IFC | item 有 source_file_id/ifc_guid |
| normalize units | 单位换算准确 |
| missing standard | status 为 review_required |
| no direct approval | Agent 不能输出 approved |
| tool failure | status blocked,有 error evidence |
| trace completeness | gates/tool_calls/rag_chunks/audit_context 存在 |

### 26.4 前端测试

| 测试 | 断言 |
|---|---|
| module page shows BOM panel | 16 模块可见入口 |
| explorer paging/filter | 大列表不卡死 |
| version diff | 增删改显示正确 |
| source trace | 文件/模型/Agent/规则可展开 |
| approval | 审批按钮调用 API |
| model link | 点击模型构件定位 BOM item |

### 26.5 端到端测试

```text
上传 IFC
  -> 创建 EBOM extraction job
  -> 生成 EBOM draft
  -> rule_check
  -> schema_validate
  -> approve
  -> issue
  -> 生成 QBOM
  -> 生成采购需求
  -> 创建工单
  -> 到场验收
  -> 安装记录
  -> 归档
```

通过标准:

1. 每一步有数据库记录。
2. 每一步有审计事件。
3. 每一步能追溯源文件或上游版本。
4. 不存在 AI 直接 approved 的输出。
5. 下游消费的是 issued 版本,不是 draft。

---

## 27. 运维与备份

### 27.1 备份对象

| 对象 | 备份策略 |
|---|---|
| PostgreSQL | 每日全量 + WAL/PITR |
| SeaweedFS S3 | 对象复制 + 元数据校验 |
| Qdrant | collection snapshot |
| ClickHouse | 分区备份 |
| NATS JetStream | stream snapshot / outbox fallback |
| Valkey | 可不作为真源,仅必要时 RDB |
| 配置和 secrets | 加密备份 |
| 审计日志 | 只追加留存 |

### 27.2 恢复演练

| 演练 | 目标 |
|---|---|
| 单项目恢复 | 恢复项目 BOM、文件、审批、审计 |
| 单版本恢复 | 恢复某 BOM version 和来源 |
| 对象丢失检查 | 通过 object_store_bindings 和 checksum 发现 |
| Agent 重放 | 用 input_refs 重新运行并比对 |
| outbox 重放 | NATS 故障后从 PostgreSQL outbox 发布 |

### 27.3 监控指标

| 指标 | 含义 |
|---|---|
| `bom_versions_total` | BOM 版本数 |
| `bom_items_total` | BOM 行项数 |
| `bom_blocked_total` | 阻断数 |
| `bom_approval_latency_seconds` | 审批耗时 |
| `bom_agent_run_latency_seconds` | Agent 运行耗时 |
| `bom_agent_run_failed_total` | Agent 失败 |
| `bom_outbox_pending_total` | 待发布事件 |
| `bom_source_trace_missing_total` | 来源缺失 |

---

## 28. 决策摘要

1. BOM 是 ArchIToken 的企业运营对象主线,不是硬件清单,不是 Excel 表,不是单点 ERP。
2. 第一优先级是数据库真源、CDE 源文件、版本、审计、审批和工作流。
3. 现有 16 模块、ModuleBackendAdapter、生命周期状态机、StorageRouter、Database Manager、数据平面拆分都应复用。
4. 新增 `bom` schema,但不复制租户、文件、事务、审计、IAM 和对象存储。
5. Agent 能生成和校核,不能直接最终批准。
6. 下游采购、生产、施工、财务只能消费 `issued` 版本。
7. 变更必须通过 change order 和 diff,不能无痕改 issued/consumed BOM。
8. 硬件预算只承载运行,不决定业务架构。
