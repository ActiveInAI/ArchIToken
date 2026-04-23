# InsomeOS · 模块注册机制 (Module Registry)

**文档编号**: INSOMEOS-MODULE-REGISTRY-V1
**定稿日期**: 2026-04-23
**姊妹文档**: [`MODULES.md`](./MODULES.md) · 11 模块规范

---

## 0. 为什么不用 enum

| 候选 | 问题                                                                      |
|------|---------------------------------------------------------------------------|
| Rust `enum BusinessPhase` | 加一个模块要改 enum 定义、match 臂全部扫一遍,下游 crate 重编译,且版本升级会撞 serde 兼容 |
| Python `Enum` | 同样的"牵一发动全身"问题,prompt 目录与 enum 同步要手工维护 |
| PostgreSQL `CREATE TYPE ENUM` | `ALTER TYPE ADD VALUE` 不可回滚 · 无法删除成员 · 多模块版本并存困难 |

**决策**: 用"数据而非类型"表达模块。
- Rust 层: `trait Module` + `ModuleRegistry` (`BTreeMap<&'static str, Arc<dyn Module>>`)
- Python 层: `@dataclass ModuleSpec` + `MODULE_REGISTRY: dict[str, ModuleSpec]`
- SQL 层: `modules` 注册表 + `module_id TEXT` 外键

三层共用同一把 `id` (英文蛇形)作为 key。加减模块是 *运行时注册*,不是 *编译期类型*。

---

## 1. Rust 层:`trait Module` + `ModuleRegistry`

位置: `04-backend/shared/src/modules/mod.rs`

```rust
use std::sync::Arc;
use std::collections::BTreeMap;
use once_cell::sync::Lazy;

pub trait Module: Send + Sync + 'static {
    fn id(&self) -> &'static str;
    fn zh_name(&self) -> &'static str;
    fn en_name(&self) -> &'static str;
    fn order(&self) -> u32;
    fn description(&self) -> &'static str;
    fn prompt_dir(&self) -> &'static str { self.id() }
    fn enabled(&self) -> bool { true }
}

pub struct ModuleRegistry {
    modules: BTreeMap<&'static str, Arc<dyn Module>>,
}

impl ModuleRegistry {
    pub fn new() -> Self { Self { modules: BTreeMap::new() } }

    pub fn register(&mut self, m: Arc<dyn Module>) {
        self.modules.insert(m.id(), m);
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn Module>> {
        self.modules.get(id).cloned()
    }

    pub fn list(&self) -> Vec<Arc<dyn Module>> {
        let mut v: Vec<_> = self.modules.values().cloned().collect();
        v.sort_by_key(|m| m.order());
        v
    }

    pub fn list_enabled(&self) -> Vec<Arc<dyn Module>> {
        self.list().into_iter().filter(|m| m.enabled()).collect()
    }
}

pub static REGISTRY: Lazy<ModuleRegistry> = Lazy::new(|| {
    let mut r = ModuleRegistry::new();
    r.register(Arc::new(marketing_service::MarketingService));
    r.register(Arc::new(concept_design::ConceptDesign));
    r.register(Arc::new(standard_library::StandardLibrary));
    r.register(Arc::new(detailed_design::DetailedDesign));
    r.register(Arc::new(quantity_costing::QuantityCosting));
    r.register(Arc::new(material_logistics::MaterialLogistics));
    r.register(Arc::new(manufacturing::Manufacturing));
    r.register(Arc::new(construction_supervision::ConstructionSupervision));
    r.register(Arc::new(digital_twin::DigitalTwin));
    r.register(Arc::new(digital_archive::DigitalArchive));
    r.register(Arc::new(settings_center::SettingsCenter));
    r
});
```

每个模块文件(例 `marketing_service.rs`)只做 5 件事:

```rust
use super::Module;

pub struct MarketingService;

impl Module for MarketingService {
    fn id(&self)          -> &'static str { "marketing_service" }
    fn zh_name(&self)     -> &'static str { "市场客服" }
    fn en_name(&self)     -> &'static str { "Marketing Service" }
    fn order(&self)       -> u32           { 1 }
    fn description(&self) -> &'static str {
        "项目初期客户接洽 · 需求收集 · 初步方案沟通"
    }
}
```

运行时调用:

```rust
for m in shared::modules::REGISTRY.list_enabled() {
    println!("{}. {} / {}", m.order(), m.zh_name(), m.en_name());
}
```

---

## 2. Python 层:`ModuleSpec` + `MODULE_REGISTRY`

位置: `04-backend/agent-orchestrator/src/insomeos_agent/modules.py`

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class ModuleSpec:
    id: str
    zh_name: str
    en_name: str
    order: int
    description: str
    prompt_dir: str | None = None
    enabled: bool = True

    def __post_init__(self) -> None:
        if self.prompt_dir is None:
            object.__setattr__(self, "prompt_dir", self.id)


MODULE_REGISTRY: dict[str, ModuleSpec] = {
    "marketing_service": ModuleSpec(
        id="marketing_service",
        zh_name="市场客服",
        en_name="Marketing Service",
        order=1,
        description="项目初期客户接洽 · 需求收集 · 初步方案沟通",
    ),
    # ... 其余 10 个模块在 modules.py 完整列出
}


def list_modules(enabled_only: bool = True) -> list[ModuleSpec]:
    mods = sorted(MODULE_REGISTRY.values(), key=lambda m: m.order)
    return [m for m in mods if m.enabled] if enabled_only else mods


def get_module(module_id: str) -> ModuleSpec | None:
    return MODULE_REGISTRY.get(module_id)
```

LangGraph 图构造 (`module_graph.py`) 从 `MODULE_REGISTRY` 动态生成节点,不再硬编码 9 阶段。

---

## 3. SQL 层:`modules` 注册表

位置: `04-backend/migrations/YYYYMMDD_modules_table.sql`

```sql
CREATE TABLE IF NOT EXISTS modules (
    id          TEXT        PRIMARY KEY,
    zh_name     TEXT        NOT NULL,
    en_name     TEXT        NOT NULL,
    order_num   INTEGER     NOT NULL,
    description TEXT,
    enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO modules (id, zh_name, en_name, order_num, description) VALUES
    ('marketing_service',        '市场客服',   'Marketing Service',        1, '项目初期客户接洽 · 需求收集 · 初步方案沟通'),
    ('concept_design',           '方案设计',   'Concept Design',           2, '多方案比选 · 3 个候选方案(SVG + 3D + 造价估)'),
    ('standard_library',         '标准族库',   'Standard Library',         3, '构件 / 节点 / 材料 / 做法 / 规范条款的全局库'),
    ('detailed_design',          '深化设计',   'Detailed Design',          4, 'BIM + 施工图 + 结构计算 + 碰撞检查'),
    ('quantity_costing',         '计量造价',   'Quantity & Costing',       5, '工程量清单 + 造价(GB 50500 + BOQ 双口径)'),
    ('material_logistics',       '材料物流',   'Material Logistics',       6, '采购 / 运输 / 进场 / 堆料全流程'),
    ('manufacturing',            '加工制造',   'Manufacturing',            7, 'CNC / 焊接 / 预制构件 · 工厂 MES 对接'),
    ('construction_supervision', '施工监理',   'Construction Supervision', 8, '现场施工 + 监理验收一体化'),
    ('digital_twin',             '数字孪生',   'Digital Twin',             9, '竣工模型 + IoT + 运维告警'),
    ('digital_archive',          '数字档案',   'Digital Archive',         10, '项目 / 企业级长期档案留存'),
    ('settings_center',          '设置中心',   'Settings Center',         11, '全局 side-car · 租户 / RBAC / 模型路由 / SLA 预算')
ON CONFLICT (id) DO NOTHING;
```

业务表引用模块是 **TEXT 外键**,不是 enum:

```sql
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS current_module_id TEXT
        REFERENCES modules(id) ON DELETE SET NULL;
```

---

## 4. 运行时查询

| 动作               | Rust                                          | Python                                   | SQL                                         |
|--------------------|-----------------------------------------------|------------------------------------------|---------------------------------------------|
| 列出全部启用模块   | `REGISTRY.list_enabled()`                     | `list_modules(enabled_only=True)`        | `SELECT * FROM modules WHERE enabled ORDER BY order_num;` |
| 按 id 取一个模块   | `REGISTRY.get("marketing_service")`           | `get_module("marketing_service")`        | `SELECT * FROM modules WHERE id = $1;`      |
| 注销(禁用)       | 不实现 · 改 SQL `enabled` 再重启              | 不实现 · 改 SQL `enabled` 再重启         | `UPDATE modules SET enabled = FALSE WHERE id = $1;` |

运行时"注销"以 SQL `enabled` 为准,Rust / Python 重启后从表读取。不提供热拔插,避免跨层状态不一致。

---

## 5. "加一个新模块" · N 步 Checklist

当未来需要加一个模块(例: `site_acquisition` · 拿地分析),按以下顺序做:

1. **定规范** · 在 `02-architecture/MODULES.md` 里加一节(id · zh / en · order · description · inputs · outputs · tables)。
2. **SQL 层** · 写一条 migration:
   ```sql
   INSERT INTO modules (id, zh_name, en_name, order_num, description)
   VALUES ('site_acquisition', '拿地分析', 'Site Acquisition', 12, '...')
   ON CONFLICT (id) DO NOTHING;
   ```
3. **Rust 层** · 新建 `04-backend/shared/src/modules/site_acquisition.rs`,`impl Module for SiteAcquisition`,并在 `mod.rs` 的 `REGISTRY` 里加一行 `r.register(...)`。
4. **Python 层** · 在 `modules.py` 的 `MODULE_REGISTRY` 里加一条 `ModuleSpec`。
5. **prompt 层** · 创建 `prompts/site_acquisition/{planner,generator,evaluator}.md` 三个文件(先用模板占位,后逐个重写)。
6. **前端** · 无需改路由——路由由 `/v1/modules` API 动态下发(本次重构顺带打通)。
7. **测试** · `cargo test --workspace`、`pytest`、`psql -c "SELECT id FROM modules;"` 三处验证。
8. **CI** · `grep -rn "BusinessPhase\|business_phase" 04-backend/` 必须零命中,防止遗漏旧 enum 残留。

**关键承诺**: 除了上述 8 步涉及的文件外,不改任何已有代码。加模块是"加",不是"改"。

---

## 6. "删一个模块" · N 步 Checklist

删除以"禁用 + 保留历史"为默认策略。永久 DROP 只在未流入生产时允许。

1. SQL: `UPDATE modules SET enabled = FALSE, updated_at = now() WHERE id = 'xxx';`
2. Rust: 可选 · 从 `REGISTRY` 注册列表里删掉对应 `r.register(...)` 行。保留模块文件备用。
3. Python: 可选 · 从 `MODULE_REGISTRY` 字典里删一键。
4. prompt 目录:保留,改名 `prompts/_deprecated_<id>/`。
5. 前端:无需改,前端从 `/v1/modules?enabled=true` 拉列表,禁用后自动消失。
6. 数据库 FK: 被引用过的数据不删,`enabled = FALSE` 的模块仍是合法的 `module_id`。

**禁止**: `DROP ROW FROM modules WHERE id = 'xxx'`。这会引发外键级联异常。

---

## 7. 不变量 (Runtime Invariants)

- I1 · Rust `REGISTRY.list()` 必须与 `SELECT * FROM modules` 的 id 集合一致 · 启动时断言。
- I2 · Python `MODULE_REGISTRY` 必须与 Rust `REGISTRY` 的 id 集合一致 · CI 检查脚本 `scripts/check-module-parity.py`。
- I3 · prompt 目录名必须等于 `id`,除非显式设置 `prompt_dir`。启动时扫描不匹配即警告。
- I4 · 新增模块 PR 必须同时触达 3 层(SQL migration + Rust file + Python dict),缺任一层 CI 拒绝。

---

## 8. 迁移到本架构 (from v2.0 · 9 phases)

本次 2026-04-23 重构分 4 个 commit 实施:

1. **文档层** · MODULES.md + MODULE-REGISTRY.md + README/PRD/CONSTITUTION/ARCHITECTURE/CLAUDE.md 同步
2. **Rust 层** · 删 `BusinessPhase` enum · 新建 `shared/src/modules/`
3. **Python 层** · `phases.py` → `modules.py` · `phase_graph.py` → `module_graph.py` · prompt 目录 `git mv`
4. **数据库层** · 新建 `modules` 表 · 业务表 enum → `module_id TEXT FK` · OpenAPI 同步

每个 commit 完成后停下汇报等 ACK,不连跑。

---

**文档终 · v1 · 2026-04-23**
