# construction_supervision · MANIFEST

模块清单 · 机器可读 TOML frontmatter + 人工可读正文。
本模块是 ArchIToken 14 模块里的第 8 个 · `order = 8` · 覆盖施工管理模块内的验收子域。

---

```toml
[module]
id          = "construction_supervision"
zh_name     = "施工监理"
en_name     = "Construction Supervision"
order       = 8
stage       = "Stage 1 · 骨架"
version     = "0.1.0"
updated_at  = "2026-04-23"
parents     = ["detailed_design", "production_manufacturing", "material_logistics", "standard_library"]
children    = ["digital_twin", "digital_archive"]

[module.sla]
planner     = 60     # 秒
generator   = 180
evaluator   = 60

[module.philosophy]
# 施工 + 监理 一体化 · 三控两管一协调
three_controls = ["quality", "schedule", "investment"]   # 三控
two_managements = ["contract", "information"]             # 两管
coordination    = "organizational"                        # 一协调

[subdomains]
count = 13
# 01-12 是实际业务子域 · 00 为 overview · 实际业务子域 12 个

[[subdomain]]
id          = "00-overview"
zh_name     = "总览"
en_name     = "Overview"
is_overview = true
description = "子域索引 · 术语表入口 · 三控两管一协调体系图"

[[subdomain]]
id          = "01-progress"
zh_name     = "进度管理"
en_name     = "Schedule & Progress"
description = "4D 施工模拟 · WBS 分解 · 关键路径 · 里程碑追踪 · 挣值分析"
primary_standards = ["GB/T 50502-2009", "GB 50326-2017", "PMBOK 7"]

[[subdomain]]
id          = "02-quality"
zh_name     = "质量控制"
en_name     = "Quality Control"
description = "材料进场检验 · 实体质量检查 · 不合格品处置 · PDCA 闭环"
primary_standards = ["GB 50300-2013", "GB/T 50319-2013", "ISO 9001:2015"]

[[subdomain]]
id          = "03-safety"
zh_name     = "安全控制"
en_name     = "Safety Control"
description = "高大模板 / 脚手架 / 起重 / 高处作业 / 临时用电 · 危大工程管理"
primary_standards = ["GB 50870-2013", "JGJ 59-2011", "ISO 45001:2018", "OSHA 29 CFR 1926"]

[[subdomain]]
id          = "04-daily_log"
zh_name     = "监理日志"
en_name     = "Daily Supervision Log"
description = "监理日记 · 旁站记录 · 巡视记录 · 平行检验 · 日周月报"
primary_standards = ["GB/T 50319-2013", "JGJ/T 185-2009"]

[[subdomain]]
id          = "05-method_statement"
zh_name     = "施工方案与技术交底"
en_name     = "Method Statement & Technical Briefing"
description = "专项施工方案 · 超过一定规模危大方案专家论证 · 三级技术交底"
primary_standards = ["住建部令第37号", "GB 50656-2011", "建质〔2018〕31号"]

[[subdomain]]
id          = "06-testing"
zh_name     = "检测试验"
en_name     = "Testing & Inspection"
description = "见证取样 · 送检 · 实体检测(钢筋保护层/结构回弹/钢构超声)"
primary_standards = ["GB 50204-2015", "GB 50205-2020", "GB/T 50784-2013"]

[[subdomain]]
id          = "07-inspection_lot"
zh_name     = "检验批"
en_name     = "Inspection Lot"
description = "检验批 → 分项 → 分部 → 单位工程 四级验收树"
primary_standards = ["GB 50300-2013", "GB 50202-2018 ~ GB 50210-2018 系列"]

[[subdomain]]
id          = "08-acceptance"
zh_name     = "验收管理"
en_name     = "Acceptance Management"
description = "隐蔽工程验收 · 分部分项验收 · 竣工预验收 · 五方责任主体竣工验收"
primary_standards = ["GB 50300-2013", "建质〔2013〕171号", "GB/T 50319-2013"]

[[subdomain]]
id          = "09-risk_analysis"
zh_name     = "风险分析"
en_name     = "Risk Analysis"
description = "风险登记册 · LEC 评价 · 应急预案 · 监督监测点位"
primary_standards = ["ISO 31000:2018", "GB/T 33859-2017", "GB/T 27921-2023"]

[[subdomain]]
id          = "10-bim_integration"
zh_name     = "BIM 集成"
en_name     = "BIM Integration"
description = "IFC 交付 · LOD 等级 · 碰撞检查 · 4D/5D 集成 · CDE 协同"
primary_standards = ["ISO 19650-1:2018", "ISO 19650-2:2018", "GB/T 51301-2018"]

[[subdomain]]
id          = "11-compliance"
zh_name     = "合规审查"
en_name     = "Compliance & Regulatory"
description = "强条核查 · 报建审批 · 消防验收 · 节能专项 · 档案归档"
primary_standards = ["GB 50300-2013", "GB 50411-2019", "GB/T 50328-2019"]

[[subdomain]]
id          = "12-change_order"
zh_name     = "变更管理"
en_name     = "Change Order Management"
description = "设计变更 · 工程洽商 · 索赔 · 签证 · 变更影响评估"
primary_standards = ["GB 50500-2013", "AIA A201-2017", "FIDIC Red Book 2017"]

[entities]
count = 30
# 30 个核心实体 · 对应 KEY-ENTITIES.md 里的完整 ER 图

[[entity]]
id = "project";                     zh = "项目";                     table = "projects"
[[entity]]
id = "contract";                    zh = "施工合同";                 table = "contracts"
[[entity]]
id = "bim_model";                   zh = "BIM 模型";                 table = "bim_models"
[[entity]]
id = "drawing";                     zh = "施工图";                   table = "drawings"
[[entity]]
id = "schedule";                    zh = "进度计划";                 table = "schedules"
[[entity]]
id = "activity";                    zh = "工序";                     table = "activities"
[[entity]]
id = "milestone";                   zh = "里程碑";                   table = "milestones"
[[entity]]
id = "wbs_node";                    zh = "WBS 节点";                 table = "wbs_nodes"
[[entity]]
id = "crew";                        zh = "班组";                     table = "crews"
[[entity]]
id = "worker";                      zh = "作业人员";                 table = "workers"
[[entity]]
id = "machinery";                   zh = "机械设备";                 table = "machineries"
[[entity]]
id = "material_receipt";            zh = "材料进场验收";             table = "material_receipts"
[[entity]]
id = "inspection_lot";              zh = "检验批";                   table = "inspection_lots"
[[entity]]
id = "sub_item";                    zh = "分项工程";                 table = "sub_items"
[[entity]]
id = "sub_part";                    zh = "分部工程";                 table = "sub_parts"
[[entity]]
id = "unit_project";                zh = "单位工程";                 table = "unit_projects"
[[entity]]
id = "acceptance_record";           zh = "验收记录";                 table = "acceptance_records"
[[entity]]
id = "hidden_work";                 zh = "隐蔽工程记录";             table = "hidden_works"
[[entity]]
id = "photo_evidence";              zh = "影像留痕";                 table = "photo_evidences"
[[entity]]
id = "quality_defect";              zh = "质量缺陷";                 table = "quality_defects"
[[entity]]
id = "rectification_order";         zh = "整改通知单";               table = "rectification_orders"
[[entity]]
id = "safety_hazard";               zh = "安全隐患";                 table = "safety_hazards"
[[entity]]
id = "supervision_log";             zh = "监理日志";                 table = "supervision_logs"
[[entity]]
id = "monitoring_post";             zh = "旁站记录";                 table = "monitoring_posts"
[[entity]]
id = "meeting_minutes";             zh = "监理例会纪要";             table = "meeting_minutes"
[[entity]]
id = "engineering_change";          zh = "工程变更";                 table = "engineering_changes"
[[entity]]
id = "technical_briefing";          zh = "技术交底";                 table = "technical_briefings"
[[entity]]
id = "method_statement";            zh = "专项施工方案";             table = "method_statements"
[[entity]]
id = "test_witnessing";             zh = "见证取样";                 table = "test_witnessings"
[[entity]]
id = "risk_entry";                  zh = "风险登记";                 table = "risk_entries"
```

---

## 正文·导航

- 标准清单 → [`STANDARDS.md`](./STANDARDS.md) (35+ 份真实标准 · 6 层分组)
- 数据模型 → [`DATA-MODEL.md`](./DATA-MODEL.md) (48 张表 · 索引策略 · 命名规范)
- 全流程 → [`WORKFLOW.md`](./WORKFLOW.md) (mermaid 生命周期 + 五方 RACI)
- 快速入门 → [`CORE/README.md`](./CORE/README.md) (60 秒速览 · 锦屏场景)
- 术语表 → [`CORE/GLOSSARY.md`](./CORE/GLOSSARY.md) (200+ 中英术语 · 每条附标准号)
- 核心实体 → [`CORE/KEY-ENTITIES.md`](./CORE/KEY-ENTITIES.md) (30 实体 · mermaid ER)
- 12 子域 → [`SUBDOMAIN/`](./SUBDOMAIN/) (01-progress ~ 12-change_order)

---

## Stage 说明

- **Stage 1** (本阶段 · 2026-04-23): 骨架 — MANIFEST / STANDARDS / DATA-MODEL / WORKFLOW / CORE/* · 12 子域 README
- **Stage 2** (下阶段): 12 子域填充 {planner,generator,evaluator}.md + 各子域 SCHEMA.sql / CHECKS.md
- **Stage 3** (后续): 端到端 LangGraph 集成 + 合成数据 + 回归套件

---

version: 0.1.0 · 2026-04-23
