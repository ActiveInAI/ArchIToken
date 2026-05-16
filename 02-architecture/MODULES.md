# ArchIToken · 14 模块规范 (Modules Specification)

**文档编号**: ARCHITOKEN-MODULES-V1
**定稿日期**: 2026-04-23
**作者**: AIA · One-Person Company

---

## 0. 设计原则 (Design Principles)

ArchIToken 采用 **registry-based 模块并列架构**。
2026-05-14 代码同步后,当前 active registry 为 **14 个模块**:

产品定位固定为:

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

1. **14 模块完全并列**,不分"业务流程"与"横向能力"。`settings_center` 与 `marketing_service` 是同一等级的公民。
2. **未来可随时增删**。加一个模块 = 注册一次;删一个模块 = 注销一次。不改任何已有代码、数据库 schema、前端路由。
3. **不用 Rust `enum` / Python `Enum`**。用 `trait Module + ModuleRegistry` / `@dataclass ModuleSpec + MODULE_REGISTRY`,运行时注册。
4. **数据库不用 `ENUM`**。用 `modules` 表 + 业务表里的 `module_id TEXT` 外键。
5. **英文 id 是规范 key**,`snake_case`。中文名仅给 UI 用。
6. **模块不是单点软件复刻**。每个模块都是 AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS + Speckle Runtime + Backend-native File Runtime 的业务运行单元,不得变成孤立 CAD/BIM/造价/结构/孪生大屏。
7. **模块必须跨行业合规**。每个模块、名词、规则和输出必须绑定专业角色、监管主体、标准/规范/规程来源、证据链、AI 输出状态和人工复核/签审策略。详细基线见 [`PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./PROFESSIONAL_STANDARDS_COMPLIANCE.md)。

注册机制与"加模块 N 步"checklist 见姊妹文档:
[`MODULE-REGISTRY.md`](./MODULE-REGISTRY.md)

前端统一业务模块工作台的开发契约见:
[`BUSINESS_MODULE_WORKBENCH.md`](./BUSINESS_MODULE_WORKBENCH.md)

---

## 1. 14 模块一览

按 `order` 字段顺序列出。`order` 用于 UI 默认排序与初始工作流链接,不构成强依赖——任何模块都能独立被调用。

| order | id (en snake_case)         | zh_name    | en_name (Display)          |
|:-----:|----------------------------|-----------|----------------------------|
|   1   | `marketing_service`        | 市场客服   | Marketing Service          |
|   2   | `planning_management`      | 计划管理   | Planning Management        |
|   3   | `concept_design`           | 方案设计   | Concept Design             |
|   4   | `standard_library`         | 标准族库   | Standard Library           |
|   5   | `detailed_design`          | 深化设计   | Detailed Design            |
|   6   | `quantity_costing`         | 计量造价   | Quantity & Costing         |
|   7   | `material_logistics`       | 材料物流   | Material Logistics         |
|   8   | `production_manufacturing` | 生产制造   | Production Manufacturing   |
|   9   | `construction_management` | 施工管理   | Construction Management    |
|  10   | `digital_twin`             | 数字孪生   | Digital Twin               |
|  11   | `digital_archive`          | 数字档案   | Digital Archive            |
|  12   | `finance_hr`               | 财务人力   | Finance & HR               |
|  13   | `ai_center`                | AI中心     | AI Capability Center       |
|  14   | `settings_center`          | 设置中心   | Settings Center            |

---

## 2. 模块规范 (Per-Module Spec)

每个模块必须定义如下 7 个字段:

- `id`          · 英文蛇形 key,全局唯一,路径与 API 都使用此 id
- `zh_name`     · 中文显示名
- `en_name`     · 英文显示名
- `order`       · 排序号 (u32)
- `description` · 3~5 句描述
- `inputs`      · 上游模块 id 列表 (可选 · `[]` 表示起点或侧车)
- `outputs`     · 下游模块 id 列表 (可选 · `[]` 表示终点或侧车)
- `prompt_dir`  · Python prompt 目录 (默认 = `id`)
- `tables`      · 该模块涉及的主表 (SQL) · 审计用
- `professional_roles` · 关联 IPMP / IPMA、注册执业角色、生产/物流/海关/税务/金融/财务/人力/组织/AI/软件等责任角色
- `regulatory_profile` · 监管机构、法域、申报/审批/备案边界
- `standards_profile` · 采用的国家标准、行业标准、地方标准、技术规程、合同和企业制度来源
- `terminology_scope` · 模块术语表与禁用混写
- `rule_set` · 模块业务规则、条文来源、触发条件和证据要求
- `signoff_policy` · AI 输出状态、人工复核、审批、签章和归档要求

缺少 `professional_roles`、`standards_profile`、`rule_set` 或 `signoff_policy` 的模块只能作为开发草稿,不得进入生产 registry。

---

### 2.1 `marketing_service` · 市场客服

- **id**: `marketing_service`
- **zh_name**: 市场客服
- **en_name**: Marketing Service
- **order**: 1
- **description**:
  项目初期客户接洽、线索获取、需求收集、初步方案沟通的入口模块。
  承接从"客户敲门"到"签意向书"之间的全部对话与资料留痕。
  是 ArchIToken 里唯一面向潜客的模块,也是商机→项目的转化点。
- **inputs**: `[]` (起点 · 入口模块)
- **outputs**: `[planning_management, concept_design]`
- **prompt_dir**: `prompts/marketing_service/`
- **tables**: `leads`, `inquiries`, `quotes_draft`, `contacts`

### 2.2 `planning_management` · 计划管理

- **id**: `planning_management`
- **zh_name**: 计划管理
- **en_name**: Planning Management
- **order**: 2
- **description**:
  项目立项、WBS、里程碑、资源计划、审批计划与跨模块交付总控模块。
  承接市场客服形成的商机和需求,将其转化为可执行的项目计划、责任矩阵和交付节奏。
  为方案设计、计量造价、生产制造、施工管理和财务人力提供统一计划基线。
- **inputs**: `[marketing_service]`
- **outputs**: `[concept_design, quantity_costing, production_manufacturing, construction_management, finance_hr]`
- **prompt_dir**: `prompts/planning_management/`
- **tables**: `project_plans`, `wbs_items`, `milestones`, `resource_plans`, `approval_plans`

### 2.3 `concept_design` · 方案设计

- **id**: `concept_design`
- **zh_name**: 方案设计
- **en_name**: Concept Design
- **order**: 3
- **description**:
  面向已确认需求的客户输出多方案比选:户型、立面、风格、体量、造价估。
  产出 3 个候选方案(SVG + 3D + 造价估)供客户选型。
  覆盖传统 AEC 里的"方案 / 概念设计"阶段,但不做施工图深化。
- **inputs**: `[marketing_service, planning_management]`
- **outputs**: `[detailed_design, quantity_costing]`
- **prompt_dir**: `prompts/concept_design/`
- **tables**: `concepts`, `concept_variants`, `style_tags`

### 2.4 `standard_library` · 标准族库

- **id**: `standard_library`
- **zh_name**: 标准族库
- **en_name**: Standard Library
- **order**: 4
- **description**:
  ArchIToken 的"构件 / 节点 / 材料 / 做法 / 规范条款"标准库。
  被方案设计、深化设计、计量造价、生产制造、施工管理多个模块共同引用。
  支持族版本化、跨项目复用、与 GB/IBC/Eurocode 规范条款双向绑定。
  本身不消费任何上游输入,是全局共享资源。
- **inputs**: `[]` (全局共享 · 被多模块引用)
- **outputs**: `[]` (被引用 · 不产生下游工件)
- **prompt_dir**: `prompts/standard_library/`
- **tables**: `family_types`, `family_versions`, `material_catalog`, `code_clauses`

### 2.5 `detailed_design` · 深化设计

- **id**: `detailed_design`
- **zh_name**: 深化设计
- **en_name**: Detailed Design
- **order**: 5
- **description**:
  把选定的概念方案深化为可施工的 BIM + 施工图。
  包含结构计算、节点详图、机电综合、碰撞检查、规范合规复核。
  产出 IFC4 + 施工图 PDF + 结构计算书。
- **inputs**: `[planning_management, concept_design, standard_library]`
- **outputs**: `[quantity_costing, production_manufacturing, construction_management]`
- **prompt_dir**: `prompts/detailed_design/`
- **tables**: `bim_models`, `drawings`, `structure_calcs`, `clash_reports`

### 2.6 `quantity_costing` · 计量造价

- **id**: `quantity_costing`
- **zh_name**: 计量造价
- **en_name**: Quantity & Costing
- **order**: 6
- **description**:
  从 BIM / 图纸抽取工程量清单 (BOQ),结合材料市场价、人工定额、机械台班产出详细造价。
  支持中式清单计价(GB 50500)与欧美 BOQ / CSI MasterFormat 双口径。
  对接标准族库的材料目录。
- **inputs**: `[planning_management, concept_design, detailed_design, standard_library]`
- **outputs**: `[material_logistics, production_manufacturing, finance_hr]`
- **prompt_dir**: `prompts/quantity_costing/`
- **tables**: `boq_items`, `cost_breakdowns`, `price_snapshots`

### 2.7 `material_logistics` · 材料物流

- **id**: `material_logistics`
- **zh_name**: 材料物流
- **en_name**: Material Logistics
- **order**: 7
- **description**:
  从 BOQ 与加工 BOM 反推采购、运输、到场、进场验收全流程。
  产出运输路径、吊装顺序、进场时间窗、场地堆料计划。
- **inputs**: `[quantity_costing, production_manufacturing]`
- **outputs**: `[construction_management, finance_hr]`
- **prompt_dir**: `prompts/material_logistics/`
- **tables**: `purchase_orders`, `shipments`, `site_receiving`

### 2.8 `production_manufacturing` · 生产制造

- **id**: `production_manufacturing`
- **zh_name**: 生产制造
- **en_name**: Production Manufacturing
- **order**: 8
- **description**:
  面向重钢结构、装配式构件和工厂预制全流程。
  把 BIM 构件翻译成 CNC / 焊接文件 + 加工 BOM + 质检单。
  对接工厂 MES / ERP,回传加工进度、发运批次与质检结果。
- **inputs**: `[planning_management, detailed_design, quantity_costing, standard_library]`
- **outputs**: `[material_logistics, construction_management, finance_hr]`
- **prompt_dir**: `prompts/production_manufacturing/`
- **tables**: `work_orders`, `cnc_files`, `qc_records`, `production_batches`

### 2.9 `construction_management` · 施工管理 · **status: active · depth: production-ready**

- **id**: `construction_management`
- **zh_name**: 施工管理
- **en_name**: Construction Management
- **order**: 9
- **status**: **active** (2026-04-23 深度试点 · Stage 1-5 完成)
- **depth**: **production-ready baseline (v0.1.0)**
- **files**: **~170** (12 subdomains × 14 files + 7 module-level)
- **sql_tables**: **52** (48 业务 + 4 全局)
- **prompts**: **48** (12 × 4 · planner/generator/evaluator + 子域特定)
- **examples**: 12 个锦屏应舍美居真实场景
- **changelog**: [`prompts/construction_management/CHANGELOG.md`](../04-backend/agent-orchestrator/prompts/construction_management/CHANGELOG.md)
- **integration**: [`prompts/construction_management/INTEGRATION.md`](../04-backend/agent-orchestrator/prompts/construction_management/INTEGRATION.md)
- **description**:
  现场施工管理 + 验收闭环一体化的模块(合并原 v2.0 的"施工"+"验收")。
  4D 施工模拟、进度计划、班组调度、安全检查、工序报验、分部分项验收、隐蔽工程影像留痕。
  产出进度报表、施工日志、验收报告与整改清单。
  **本模块是 ArchIToken 14 模块中第一个 production-ready 的深度试点 · 可作为其它模块的范式模板。**
- **inputs**: `[planning_management, detailed_design, production_manufacturing, material_logistics, standard_library]`
- **outputs**: `[digital_twin, digital_archive, finance_hr]`
- **prompt_dir**: `prompts/construction_management/`
- **tables**: `schedules`, `crews`, `daily_logs`, `qa_inspections`, `acceptance_reports`

### 2.10 `digital_twin` · 数字孪生

- **id**: `digital_twin`
- **zh_name**: 数字孪生
- **en_name**: Digital Twin
- **order**: 10
- **module_contract**: [`DIGITAL_TWIN.md`](./DIGITAL_TWIN.md)
- **description**:
  面向重钢结构项目的数字孪生业务模块。
  承接施工管理输出的 IFC4.3 / MBD、3DGS 影像实景、LiDAR/E57 点云校核、IoT/SCADA、FEA/ROM 形性一体与流程孪生数据。
  3DGS 只表示影像/视频/360 全景重建实景层,点云用于控制点和残差校核,二者必须分层表达。
  `/app/modules/digital_twin` 必须与其它模块一样使用统一 CDE 文件工作台、生命周期、审批、审计和右侧业务对象队列。
  专用 HMI / SCADA / CIM 驾驶舱保留在独立 `/app/digital-twin`,作为专业可视化工作面。
  详细 UI 信息架构、数据契约、标准基线与验收标准见模块契约文档。
- **inputs**: `[construction_management, detailed_design]`
- **outputs**: `[digital_archive]`
- **prompt_dir**: `prompts/digital_twin/`
- **tables**: `twin_models`, `iot_streams`, `alerts`, `maintenance_plans`

### 2.11 `digital_archive` · 数字档案

- **id**: `digital_archive`
- **zh_name**: 数字档案
- **en_name**: Digital Archive
- **order**: 11
- **description**:
  项目级 / 企业级的长期档案留存:合同、图纸、BOQ、验收、IoT 历史、审计日志。
  支持对接国家 / 地方城建档案馆数字交付规范(如 CJJ/T 117)。
  是"项目闭环"的最后一站,决定多年后能否复盘 / 法律举证。
- **inputs**: `[construction_management, digital_twin, finance_hr]`
- **outputs**: `[]` (终点)
- **prompt_dir**: `prompts/digital_archive/`
- **tables**: `archives`, `archive_items`, `retention_policies`

### 2.12 `finance_hr` · 财务人力

- **id**: `finance_hr`
- **zh_name**: 财务人力
- **en_name**: Finance & HR
- **order**: 12
- **description**:
  合同、收付款、发票、成本、预算、人员、班组、绩效、考勤和组织能力模块。
  从计划管理、计量造价、材料物流、生产制造和施工管理同步经营数据。
  为项目利润、资金计划、组织资源和人员绩效提供统一治理。
- **inputs**: `[planning_management, quantity_costing, material_logistics, production_manufacturing, construction_management]`
- **outputs**: `[digital_archive]`
- **prompt_dir**: `prompts/finance_hr/`
- **tables**: `contracts`, `payments`, `invoices`, `cost_entries`, `crew_attendance`, `performance_records`

### 2.13 `ai_center` · AI中心

- **id**: `ai_center`
- **zh_name**: AI中心
- **en_name**: AI Capability Center
- **order**: 13
- **description**:
  企业 AI、API、RAG、MCP、Agent、模型路由、工具权限、安全审计和成本策略模块。
  为所有业务模块提供统一 AI 能力编排、上下文治理、审计和成本控制。
  与设置中心共同构成平台级能力底座。
- **inputs**: `[]` (平台能力底座)
- **outputs**: `[]` (被其它模块引用)
- **prompt_dir**: `prompts/ai_center/`
- **tables**: `model_routes`, `rag_sources`, `mcp_tools`, `agent_runs`, `ai_cost_events`

### 2.14 `settings_center` · 设置中心

- **id**: `settings_center`
- **zh_name**: 设置中心
- **en_name**: Settings Center
- **order**: 14
- **description**:
  全局设置 side-car 模块:租户、用户、RBAC、模型路由、SLA 预算、规范库版本、UI 主题。
  **并列但无上下游**——不进入 AEC 工作流图,只为其它 13 个模块提供全局配置。
  任何模块运行时从 `settings_center` 拉配置。
- **inputs**: `[]` (side-car)
- **outputs**: `[]` (side-car)
- **prompt_dir**: `prompts/settings_center/`
- **tables**: `tenants`, `users`, `roles`, `role_bindings`, `model_routes`, `sla_budgets`, `ui_prefs`

---

## 3. 数据结构 (参考实现)

### 4.1 Rust (`04-backend/shared/src/modules/mod.rs`)

```rust
pub trait Module: Send + Sync {
    fn id(&self) -> &'static str;
    fn zh_name(&self) -> &'static str;
    fn en_name(&self) -> &'static str;
    fn order(&self) -> u32;
    fn description(&self) -> &'static str;
    fn prompt_dir(&self) -> &'static str { self.id() }
    fn enabled(&self) -> bool { true }
}
```

### 4.2 Python (`04-backend/agent-orchestrator/src/ArchIToken_agent/modules.py`)

```python
@dataclass(frozen=True)
class ModuleSpec:
    id: str
    zh_name: str
    en_name: str
    order: int
    description: str
    prompt_dir: str | None = None
    enabled: bool = True
```

### 4.3 SQL (`04-backend/migrations/*_modules_table.sql`)

```sql
CREATE TABLE modules (
    id          TEXT        PRIMARY KEY,
    zh_name     TEXT        NOT NULL,
    en_name     TEXT        NOT NULL,
    order_num   INTEGER     NOT NULL,
    description TEXT,
    enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

业务表的外键字段是 `module_id TEXT REFERENCES modules(id)`,不是 `ENUM` 类型。

---

## 4. 不变量 (Invariants)

系统运行时必须保证:

- I1 · 每个模块的 `id` 全局唯一,形如 `[a-z][a-z0-9_]*`。
- I2 · `order` 用于排序显示,但不是"严格依赖"。工作流图由 `inputs` / `outputs` 决定。
- I3 · `settings_center` 的 `inputs` / `outputs` 永远为空,它不进工作流。
- I4 · `standard_library` 的 `inputs` / `outputs` 也为空,但它被其它模块 *引用*(不是 *链接*)。
- I5 · 删除模块 = 在 `modules` 表里置 `enabled = FALSE`;不删行,保留 FK 可查历史。
- I6 · 新增模块 = `INSERT INTO modules` + Rust / Python 注册 + (可选) 创建 prompt 目录。
- I7 · 宪法 §8 SLA 预算按 `id` 配置,不再按"9 阶段"硬编码。
- I8 · 模块的专业角色、标准来源、术语表、规则库和签审策略必须齐备。

---

## 5. 相关文档

- [`MODULE-REGISTRY.md`](./MODULE-REGISTRY.md) · 注册机制 + "加模块 N 步" checklist
- [`CONSTITUTION.md`](./CONSTITUTION.md) · 宪法 22 条
- [`PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./PROFESSIONAL_STANDARDS_COMPLIANCE.md) · 专业资格、标准规范、术语与规则合规基线
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) · 全栈架构 (模块注册图取代原业务流程图)
- [`../01-product/PRD.md`](../01-product/PRD.md) · 产品需求(§2 改为 14 模块)

---

**文档终 · v1 · 2026-04-23**
