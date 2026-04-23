# InsomeOS · 11 模块规范 (Modules Specification)

**文档编号**: INSOMEOS-MODULES-V1
**定稿日期**: 2026-04-23
**作者**: AIA · One-Person Company
**取代**: 2026-04-19 v2.0 文档里的"9 业务阶段"模型

---

## 0. 设计原则 (Design Principles)

这份文档替换掉 v2.0 的"9 业务阶段"(`售前 → 方案 → 深化 → 造价 → 制造 → 物流 → 施工 → 验收 → 运维`)。
从 2026-04-23 起,InsomeOS 采用 **11 模块并列架构**:

1. **11 模块完全并列**,不分"业务流程"与"横向能力"。`settings_center` 与 `marketing_service` 是同一等级的公民。
2. **未来可随时增删**。加一个模块 = 注册一次;删一个模块 = 注销一次。不改任何已有代码、数据库 schema、前端路由。
3. **不用 Rust `enum` / Python `Enum`**。用 `trait Module + ModuleRegistry` / `@dataclass ModuleSpec + MODULE_REGISTRY`,运行时注册。
4. **数据库不用 `ENUM`**。用 `modules` 表 + 业务表里的 `module_id TEXT` 外键。
5. **英文 id 是规范 key**,`snake_case`。中文名仅给 UI 用。

注册机制与"加模块 N 步"checklist 见姊妹文档:
[`MODULE-REGISTRY.md`](./MODULE-REGISTRY.md)

---

## 1. 11 模块一览

按 `order` 字段顺序列出。`order` 用于 UI 默认排序与初始工作流链接,不构成强依赖——任何模块都能独立被调用。

| order | id (en snake_case)         | zh_name    | en_name (Display)          |
|:-----:|----------------------------|-----------|----------------------------|
|   1   | `marketing_service`        | 市场客服   | Marketing Service          |
|   2   | `concept_design`           | 方案设计   | Concept Design             |
|   3   | `standard_library`         | 标准族库   | Standard Library           |
|   4   | `detailed_design`          | 深化设计   | Detailed Design            |
|   5   | `quantity_costing`         | 计量造价   | Quantity & Costing         |
|   6   | `material_logistics`       | 材料物流   | Material Logistics         |
|   7   | `manufacturing`            | 加工制造   | Manufacturing              |
|   8   | `construction_supervision` | 施工监理   | Construction Supervision   |
|   9   | `digital_twin`             | 数字孪生   | Digital Twin               |
|  10   | `digital_archive`          | 数字档案   | Digital Archive            |
|  11   | `settings_center`          | 设置中心   | Settings Center            |

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

---

### 2.1 `marketing_service` · 市场客服

- **id**: `marketing_service`
- **zh_name**: 市场客服
- **en_name**: Marketing Service
- **order**: 1
- **description**:
  项目初期客户接洽、线索获取、需求收集、初步方案沟通的入口模块。
  承接从"客户敲门"到"签意向书"之间的全部对话与资料留痕。
  是 InsomeOS 里唯一面向潜客的模块,也是商机→项目的转化点。
- **inputs**: `[]` (起点 · 入口模块)
- **outputs**: `[concept_design]`
- **prompt_dir**: `prompts/marketing_service/`
- **tables**: `leads`, `inquiries`, `quotes_draft`, `contacts`

### 2.2 `concept_design` · 方案设计

- **id**: `concept_design`
- **zh_name**: 方案设计
- **en_name**: Concept Design
- **order**: 2
- **description**:
  面向已确认需求的客户输出多方案比选:户型、立面、风格、体量、造价估。
  产出 3 个候选方案(SVG + 3D + 造价估)供客户选型。
  覆盖传统 AEC 里的"方案 / 概念设计"阶段,但不做施工图深化。
- **inputs**: `[marketing_service]`
- **outputs**: `[detailed_design, quantity_costing]`
- **prompt_dir**: `prompts/concept_design/`
- **tables**: `concepts`, `concept_variants`, `style_tags`

### 2.3 `standard_library` · 标准族库

- **id**: `standard_library`
- **zh_name**: 标准族库
- **en_name**: Standard Library
- **order**: 3
- **description**:
  InsomeOS 的"构件 / 节点 / 材料 / 做法 / 规范条款"标准库。
  被方案设计、深化设计、计量造价、加工制造、施工监理多个模块共同引用。
  支持族版本化、跨项目复用、与 GB/IBC/Eurocode 规范条款双向绑定。
  本身不消费任何上游输入,是全局共享资源。
- **inputs**: `[]` (全局共享 · 被多模块引用)
- **outputs**: `[]` (被引用 · 不产生下游工件)
- **prompt_dir**: `prompts/standard_library/`
- **tables**: `family_types`, `family_versions`, `material_catalog`, `code_clauses`

### 2.4 `detailed_design` · 深化设计

- **id**: `detailed_design`
- **zh_name**: 深化设计
- **en_name**: Detailed Design
- **order**: 4
- **description**:
  把选定的概念方案深化为可施工的 BIM + 施工图。
  包含结构计算、节点详图、机电综合、碰撞检查、规范合规复核。
  产出 IFC4 + 施工图 PDF + 结构计算书。
- **inputs**: `[concept_design, standard_library]`
- **outputs**: `[quantity_costing, manufacturing, construction_supervision]`
- **prompt_dir**: `prompts/detailed_design/`
- **tables**: `bim_models`, `drawings`, `structure_calcs`, `clash_reports`

### 2.5 `quantity_costing` · 计量造价

- **id**: `quantity_costing`
- **zh_name**: 计量造价
- **en_name**: Quantity & Costing
- **order**: 5
- **description**:
  从 BIM / 图纸抽取工程量清单 (BOQ),结合材料市场价、人工定额、机械台班产出详细造价。
  支持中式清单计价(GB 50500)与欧美 BOQ / CSI MasterFormat 双口径。
  对接标准族库的材料目录。
- **inputs**: `[concept_design, detailed_design, standard_library]`
- **outputs**: `[material_logistics, manufacturing]`
- **prompt_dir**: `prompts/quantity_costing/`
- **tables**: `boq_items`, `cost_breakdowns`, `price_snapshots`

### 2.6 `material_logistics` · 材料物流

- **id**: `material_logistics`
- **zh_name**: 材料物流
- **en_name**: Material Logistics
- **order**: 6
- **description**:
  从 BOQ 与加工 BOM 反推采购、运输、到场、进场验收全流程。
  产出运输路径、吊装顺序、进场时间窗、场地堆料计划。
- **inputs**: `[quantity_costing, manufacturing]`
- **outputs**: `[construction_supervision]`
- **prompt_dir**: `prompts/material_logistics/`
- **tables**: `purchase_orders`, `shipments`, `site_receiving`

### 2.7 `manufacturing` · 加工制造

- **id**: `manufacturing`
- **zh_name**: 加工制造
- **en_name**: Manufacturing
- **order**: 7
- **description**:
  面向装配式、轻钢、重钢、幕墙、门窗等需要工厂预制的构件。
  把 BIM 构件翻译成 CNC / 焊接文件 + 加工 BOM + 质检单。
  对接工厂 MES / ERP,回传加工进度与质检结果。
- **inputs**: `[detailed_design, quantity_costing, standard_library]`
- **outputs**: `[material_logistics, construction_supervision]`
- **prompt_dir**: `prompts/manufacturing/`
- **tables**: `work_orders`, `cnc_files`, `qc_records`

### 2.8 `construction_supervision` · 施工监理 · **status: active · depth: production-ready**

- **id**: `construction_supervision`
- **zh_name**: 施工监理
- **en_name**: Construction Supervision
- **order**: 8
- **status**: **active** (2026-04-23 深度试点 · Stage 1-5 完成)
- **depth**: **production-ready baseline (v0.1.0)**
- **files**: **~170** (12 subdomains × 14 files + 7 module-level)
- **sql_tables**: **52** (48 业务 + 4 全局)
- **prompts**: **48** (12 × 4 · planner/generator/evaluator + 子域特定)
- **examples**: 12 个锦屏应舍美居真实场景
- **changelog**: [`prompts/construction_supervision/CHANGELOG.md`](../04-backend/agent-orchestrator/prompts/construction_supervision/CHANGELOG.md)
- **integration**: [`prompts/construction_supervision/INTEGRATION.md`](../04-backend/agent-orchestrator/prompts/construction_supervision/INTEGRATION.md)
- **description**:
  现场施工 + 监理验收一体化的模块(合并原 v2.0 的"施工"+"验收")。
  4D 施工模拟、进度计划、班组调度、安全检查、工序报验、分部分项验收、隐蔽工程影像留痕。
  产出进度报表、监理日志、验收报告与整改清单。
  **本模块是 InsomeOS 11 模块中第一个 production-ready 的深度试点 · 可作为其它 10 模块的范式模板。**
- **inputs**: `[detailed_design, manufacturing, material_logistics, standard_library]`
- **outputs**: `[digital_twin, digital_archive]`
- **prompt_dir**: `prompts/construction_supervision/`
- **tables**: `schedules`, `crews`, `daily_logs`, `qa_inspections`, `acceptance_reports`

### 2.9 `digital_twin` · 数字孪生

- **id**: `digital_twin`
- **zh_name**: 数字孪生
- **en_name**: Digital Twin
- **order**: 9
- **description**:
  竣工模型 + IoT 传感器实时数据流 + 能耗 / 结构健康 / 设备告警的三维运维模块。
  对接 IFC / glTF / three.js 渲染层与时序数据库。
  是 AEC 项目"运维期"的唯一接口。
- **inputs**: `[construction_supervision, detailed_design]`
- **outputs**: `[digital_archive]`
- **prompt_dir**: `prompts/digital_twin/`
- **tables**: `twin_models`, `iot_streams`, `alerts`, `maintenance_plans`

### 2.10 `digital_archive` · 数字档案

- **id**: `digital_archive`
- **zh_name**: 数字档案
- **en_name**: Digital Archive
- **order**: 10
- **description**:
  项目级 / 企业级的长期档案留存:合同、图纸、BOQ、验收、IoT 历史、审计日志。
  支持对接国家 / 地方城建档案馆数字交付规范(如 CJJ/T 117)。
  是"项目闭环"的最后一站,决定多年后能否复盘 / 法律举证。
- **inputs**: `[construction_supervision, digital_twin]`
- **outputs**: `[]` (终点)
- **prompt_dir**: `prompts/digital_archive/`
- **tables**: `archives`, `archive_items`, `retention_policies`

### 2.11 `settings_center` · 设置中心

- **id**: `settings_center`
- **zh_name**: 设置中心
- **en_name**: Settings Center
- **order**: 11
- **description**:
  全局设置 side-car 模块:租户、用户、RBAC、模型路由、SLA 预算、规范库版本、UI 主题。
  **并列但无上下游**——不进入 AEC 工作流图,只为其它 10 个模块提供全局配置。
  任何模块运行时从 `settings_center` 拉配置。
- **inputs**: `[]` (side-car)
- **outputs**: `[]` (side-car)
- **prompt_dir**: `prompts/settings_center/`
- **tables**: `tenants`, `users`, `roles`, `role_bindings`, `model_routes`, `sla_budgets`, `ui_prefs`

---

## 3. 新旧对照表 (Migration Map)

| 旧阶段 (v2.0 · 9 phases)         | 新模块 (v3.0 · 11 modules)       | 说明                                   |
|----------------------------------|----------------------------------|---------------------------------------|
| `pre_sales` (售前)               | `marketing_service`              | 更名 · 范围扩到"客服"                 |
| `concept` (方案)                 | `concept_design`                 | 更名 · 英文更规范                     |
| —                                | `standard_library` (新增)        | 新增 · 全局族库                       |
| `develop` (深化)                 | `detailed_design`                | 更名                                  |
| `costing` (造价)                 | `quantity_costing`               | 更名 · "计量"入名                     |
| `logistics` (物流)               | `material_logistics`             | 更名 · 限定范围到"材料"               |
| `fabrication` (制造)             | `manufacturing`                  | 更名                                  |
| `construction` + `acceptance`    | `construction_supervision`       | **合并** · 施工 + 监理验收一体        |
| `operations` (运维)              | `digital_twin`                   | 更名 · 明确走孪生路线                 |
| —                                | `digital_archive` (新增)         | 新增 · 长期档案留存                   |
| —                                | `settings_center` (新增)         | 新增 · 全局设置 side-car              |

---

## 4. 数据结构 (参考实现)

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

### 4.2 Python (`04-backend/agent-orchestrator/src/insomeos_agent/modules.py`)

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

## 5. 不变量 (Invariants)

系统运行时必须保证:

- I1 · 每个模块的 `id` 全局唯一,形如 `[a-z][a-z0-9_]*`。
- I2 · `order` 用于排序显示,但不是"严格依赖"。工作流图由 `inputs` / `outputs` 决定。
- I3 · `settings_center` 的 `inputs` / `outputs` 永远为空,它不进工作流。
- I4 · `standard_library` 的 `inputs` / `outputs` 也为空,但它被其它模块 *引用*(不是 *链接*)。
- I5 · 删除模块 = 在 `modules` 表里置 `enabled = FALSE`;不删行,保留 FK 可查历史。
- I6 · 新增模块 = `INSERT INTO modules` + Rust / Python 注册 + (可选) 创建 prompt 目录。
- I7 · 宪法 §8 SLA 预算按 `id` 配置,不再按"9 阶段"硬编码。

---

## 6. 相关文档

- [`MODULE-REGISTRY.md`](./MODULE-REGISTRY.md) · 注册机制 + "加模块 N 步" checklist
- [`CONSTITUTION.md`](./CONSTITUTION.md) · 宪法 19 条(本次重构后相关条款已同步更新)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) · 全栈架构 (模块注册图取代原业务流程图)
- [`../01-product/PRD.md`](../01-product/PRD.md) · 产品需求(§2 改为 11 模块)

---

**文档终 · v1 · 2026-04-23**
