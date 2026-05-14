# construction_supervision · CORE · README

施工监理模块 · 60 秒速览 + 锦屏应舍美居场景示例。

---

## 1. 60 秒速览

**是什么**: ArchIToken 14 模块里的第 8 个 · 覆盖施工管理模块内的验收子域。
**干什么**: 现场施工 + 监理验收 一体化 · 把 BIM + BOQ + 加工 BOM + 进场批次 → 进度 / 质量 / 安全 / 验收 / 整改 / 变更 / 档案。
**法理基础**: 国务院令第 279 号《建设工程质量管理条例》(五方责任主体) + GB/T 50319-2013 《建设工程监理规范》。
**体系**: "三控两管一协调" · 三控 = 质量 / 进度 / 投资 · 两管 = 合同 / 信息 · 一协调 = 组织协调。
**子域**: 12 个 (01-progress ~ 12-change_order) + 00-overview 索引。
**实体**: 30 个核心领域对象 (详见 `KEY-ENTITIES.md`)。
**标准**: 引用 77 份真实标准 · 覆盖 GB / JGJ / 住建部 / ISO / PMI / Eurocode / FIDIC / 地方。
**数据**: `csr` schema · 48 张表 · RLS FORCE · 时序表 BRIN + 文本表 GIN。
**SLA**: planner 60s / generator 180s / evaluator 60s (宪法 §8)。
**3 角色 Prompt**: `planner.md` → `generator.md` → `evaluator.md` (宪法 §9 · 独立模型强制)。
**产出方向**: `digital_twin` (运维) + `digital_archive` (归档)。
**输入方向**: `detailed_design` + `production_manufacturing` + `material_logistics` + `standard_library` + `quantity_costing` (双向) + `settings_center` (配置)。

---

## 2. 锚点项目 · 应舍美居·锦屏 (真实工程)

### 2.1 项目基本情况

| 项 | 值 |
|---|---|
| 位置 | 贵州省黔东南苗族侗族自治州 · 锦屏县 |
| 类型 | 三层重钢别墅 · 独栋 |
| 建筑面积 | 520 ㎡ |
| 结构形式 | Q355B 重钢框架 · 300 mm 柱网 |
| 围护体系 | 轻钢龙骨 + 岩棉 + 纤维水泥板 |
| 工期 | 45 天 (结构 15 天 · 围护 15 天 · 装饰 / 机电 15 天) |
| 预算 | ¥680,000 |
| 五方 |  O · 业主私人<br>C · 贵州某钢构公司<br>S · 某地方监理公司<br>D · 建筑师事务所 (AIA 朋友)<br>G · 县勘察院 |
| BIM | Revit 2024 → IFC4 导出 · `ifc-lite-core 2.1.9` 解析 |

### 2.2 本模块在锦屏场景的典型一天 (Day 7)

```
06:45  班组早班会 + 安全交底 (04-daily_log 生成 toolbox_talks)
07:00  二层柱焊接开始 · 监理旁站 (04-daily_log · monitoring_posts)
09:30  见证取样:焊缝超声 UT 抽 3 点 (06-testing · test_witnessings)
10:15  UT 报告回传 · 1 点缺陷 → 质量缺陷登记 (02-quality)
       → A5 整改通知单自动生成 (02-quality · rectification_orders)
11:00  班组返工 · 打磨重焊
13:00  复查 · 合格 · 闭环整改单
14:30  一层钢柱与基础连接 → 隐蔽工程验收 (08-acceptance · hidden_works)
       10 张影像自动归档 (photo_evidences)
16:00  总进度汇报:PV 23.5% · EV 22.1% · AC 24.0%
       → SPI 0.94 · CPI 0.92 (01-progress · progress_snapshots)
17:30  监理日志生成:旁站 1 次 · 巡视 4 次 · 平行检验 1 次 · 整改 1 单
       Planner → Generator → Evaluator 三角色闭环 · 200s 完成
17:45  监理工程师签章 · 入库 supervision_logs
```

这一天触发 ArchIToken 的:
- 7 个 `csr.*` 表写入
- 1 次 `standard_library` 查询 (焊缝 UT 合格标准 · GB 50205 §7.2.4)
- 1 次 `quantity_costing` 联动 (返工量 = 0 · 不影响造价)
- 1 次变更评估 (无)
- 零次上报 `digital_twin` (结构未竣工)
- 零次 `digital_archive` 写入 (按周批量)

### 2.3 在锦屏上验证的"成功指标"

- 监理日志生成 · AIA 审阅 / 改动 < 20% 即算合格
- A5 整改通知单格式 · 贵州省监理协会认可
- 五方联合验收的 ArchIToken PDF · 能直接打印签字
- 竣工档案 · 符合 GB/T 50328-2019 归档规范 (县档案馆入档)

---

## 3. 目录导航

```
construction_supervision/
├── MANIFEST.md        ← 机器可读 TOML + 12 子域 + 30 实体
├── STANDARDS.md       ← 77 份真实标准 · 6 层
├── DATA-MODEL.md      ← 48 张表 · 命名 · 索引 · RLS
├── WORKFLOW.md        ← mermaid 全流程 + 五方 RACI
├── CORE/
│   ├── README.md      ← 本文件
│   ├── GLOSSARY.md    ← 200+ 中英术语 · 每条附标准号
│   └── KEY-ENTITIES.md← 30 核心实体 + mermaid ER
└── SUBDOMAIN/
    ├── 00-overview/README.md
    ├── 01-progress/README.md
    ├── 02-quality/README.md
    ├── 03-safety/README.md
    ├── 04-daily_log/README.md
    ├── 05-method_statement/README.md
    ├── 06-testing/README.md
    ├── 07-inspection_lot/README.md
    ├── 08-acceptance/README.md
    ├── 09-risk_analysis/README.md
    ├── 10-bim_integration/README.md
    ├── 11-compliance/README.md
    └── 12-change_order/README.md
```

---

## 4. 下一步 (Stage 2 预告)

- 每个子域填 `planner.md · generator.md · evaluator.md` 三文件
- 每个子域落 `SCHEMA.sql` (对应 48 表里属于自己的那些)
- 每个子域落 `CHECKS.md` (合规校验规则 · 宪法 §8 SLA 映射)
- CORE 层补 `PROMPT-TEMPLATE.md` (3 角色的基础模板 · 宪法 §14)

---

version: 0.1.0 · 2026-04-23
