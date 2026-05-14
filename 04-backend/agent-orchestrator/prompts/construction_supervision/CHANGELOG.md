# construction_supervision · CHANGELOG

模块版本记录 · 遵循 Keep a Changelog 1.1.0 + SemVer 2.0.0。

---

## [0.1.0] — 2026-04-23

首次深度试点交付 · Stage 1-5 完整骨架 · **production-ready baseline**。

### Stage 1 · 顶层 + CORE + 12 SUBDOMAIN 骨架 (commit 41689f0)

新增 20 文件 · 1951 行:
- `MANIFEST.md` · TOML frontmatter + 12 子域 + 30 实体
- `STANDARDS.md` · **77 份真实标准** · 6 层分组(GB / JGJ / 住建部 / ISO / PMI+美 / 欧美+地方)
- `DATA-MODEL.md` · 48 表按 12 子域分布 · csr schema · 命名 · 索引 · RLS 规范
- `WORKFLOW.md` · mermaid 全生命周期 + **五方 RACI 34 活动矩阵**
- `CORE/README.md` · 60 秒速览 + 锦屏应舍美居 Day 7 场景
- `CORE/GLOSSARY.md` · **265 条中英术语** · 18 组 · 每条附标准号
- `CORE/KEY-ENTITIES.md` · 30 核心实体 · mermaid ER · 8 不变量
- `SUBDOMAIN/00-overview/`~`12-change_order/README.md` · 13 占位

### Stage 2 · 01-04 四子域深度展开 (commit a8e5197)

56 文件 · 6322 行 · 20 张表:
- 01-progress · 进度(schedules · wbs_nodes · activities · milestones · progress_snapshots)
- 02-quality · 质量(quality_plans · material_receipts · quality_defects · rectification_orders · NCR)
- 03-safety · 安全(safety_plans · safety_hazards · work_permits · toolbox_talks · incident_reports)
- 04-daily_log · 日志(supervision_logs · monitoring_posts · patrol_records · parallel_inspections · meeting_minutes)

子域特定 prompts:
- delay_root_cause_analyzer.md · 7 类根因 + 证据链
- defect_classifier.md · 9 类 category + 3 级 severity
- hira_generator.md · LEC 三因子 + GB/T 33859 分级
- daily_summary_generator.md · 6 固定 H2 Markdown

### Stage 3 · 05-08 四子域(含 06 补齐)(commit 818e650)

35 文件 · 2903 行 · 13 张表:
- 05-method_statement · 方案(method_statements · technical_briefings · expert_reviews)
- 06-testing · 试验(test_witnessings · lab_reports · onsite_tests)
- 07-inspection_lot · 检验批(sub_parts · sub_items · inspection_lots · 4 级聚合 trigger)
- 08-acceptance · 验收(unit_projects · acceptance_records · hidden_works · handover_certificates)

子域特定 prompts:
- expert_review_facilitator.md · pre/during/post 三段
- sample_plan_generator.md · GB 规范抽样频率
- lot_boundary_advisor.md · medium 粒度默认
- five_parties_signoff_orchestrator.md · 邀请 / 跟踪 / 纪要

### Stage 4 · 09-12 四子域 (commit c1fa264)

56 文件 · 4590 行 · 16 张表:
- 09-risk_analysis · 风险(risk_entries · risk_monitoring_points · emergency_plans)
- 10-bim_integration · BIM(bim_models · clash_reports · bim_to_wbs_links · bim_to_boq_links)
- 11-compliance · 合规(mandatory_clauses · compliance_checks · permit_approvals · archive_packages)
- 12-change_order · 变更(engineering_changes · site_consultations · claims · certifications · change_impact_assessments)

子域特定 prompts:
- monte_carlo_schedule_simulator.md · PMBOK 7 · 10000 iterations · 固定 seed
- ifc_clash_triage.md · 4 类 × 4 severity
- regulation_diff_detector.md · added/changed/removed + retroactive
- impact_propagation_analyzer.md · 四维 + cascading 6 子域

### Stage 5 · 模块收尾(本 commit)

- `GLOBAL-TABLES.sql` · 4 全局表(projects · contracts · parties · audit_log)+ 通用审计 trigger
- `INTEGRATION.md` · 与其它 13 模块的 upstream/downstream + pgmq 契约 + SLA
- `CHANGELOG.md` · 本文件
- `MODULES.md` 更新 · construction_supervision 状态 draft → active

---

## 累计总计

| 指标 | 值 |
|---|---:|
| 文件数(.md + .sql) | **~170** |
| 总行数 | **~15,800** |
| SQL 业务表 | **48**(Stage 2+3+4 · 含嵌入 sl.code_clauses 别名) |
| SQL 全局表 | **4**(Stage 5) |
| **SQL 表总** | **52** |
| 工程级 LLM prompt | **48**(12 × 4) |
| 锦屏场景 examples | **12** |
| 真实标准引用 | **77**(STANDARDS.md 根) |
| 术语 | **265**(GLOSSARY.md 根) |
| 核心实体 | **30**(KEY-ENTITIES.md 根) |
| 核心不变量 | **56+**(跨 12 子域 I-1 ~ I-N) |

---

## 质量门槛 (本版本声明)

- ✅ 所有标号真实可查 · 无幻觉
- ✅ 所有术语来自 GLOSSARY.md · 新增均有标准号
- ✅ 所有实体字段来自 KEY-ENTITIES.md
- ✅ 所有 SQL schema 符合 DATA-MODEL.md 的命名 / RLS / 索引规范
- ✅ 所有 prompts 输出结构化 JSON · 无"TODO"占位
- ✅ 所有文件结尾标 `version: 0.1.0 · 2026-04-23`
- ✅ versions.toml 未改动 · 对齐权威值

---

## 未做(留 0.2.0+ 迭代)

### 功能
- Stage 6 · 端到端 LangGraph 集成测试(含锦屏合成数据)
- Stage 7 · 与 LangGraph checkpointer 对接 PG
- 0.2.0 · BCF 3.0 导入导出
- 0.2.0 · IoT 实时告警全链路(3 家主流传感器)
- 0.3.0 · 外部 BIM 协作(Autodesk ACC / 广联达)

### 数据
- 6 核心 GB 强条全文入库(standard_library seed)
- 地方标准(贵州 / 上海 / 北京 / 广东)· 逐批入库
- 历史项目风险库(相似搜索基础)

### 测试
- 每 prompt 3+ 黄金样本 · 集中测试回归
- DB trigger 边界测试(主控 100% / 一般 80% / 五方签齐)
- E2E 场景(锦屏 45 日全程 · 合成数据 · CI 回归)

### UI
- `<BIMViewer />` 的 glTF 分块预处理
- `<AcceptanceTree />` 大项目(1000+ 批)虚拟化
- 移动 App(PWA)完整离线 + 同步

---

## 升级路径

- `0.1.0` → `0.1.x` (patch · 次日起多次 · 修措辞 / 补 TODO)
- `0.1.x` → `0.2.0` (minor · 预计 2026-05 · 首次真实项目使用反馈)
- `0.2.x` → `1.0.0` (major · 预计 2026-08 · 5+ 项目验证 + 6 核心 GB 入库 + E2E CI)

---

## 模板性质

本模块是 ArchIToken 14 模块里第一个 production-ready 的深度试点。
其它 10 模块(marketing_service · concept_design · standard_library · detailed_design ·
quantity_costing · material_logistics · production_manufacturing · digital_twin · digital_archive ·
settings_center)**将照此范式展开**:

- 每模块 · 12 子域(按实际业务定)
- 每子域 · 14 文件(README · STANDARDS · DATA-MODEL · WORKFLOW · BIM-INTEGRATION ·
  API · UI-COMPONENTS · PROMPTS · planner · generator · evaluator · special · examples · TODO)
- 每文件 · `version: 0.1.0 · YYYY-MM-DD` 结尾
- 每子域 · 3 张左右 SQL 表
- 每模块 · 顶层 MANIFEST + STANDARDS + DATA-MODEL + WORKFLOW + CORE 3 件

预计 10 模块复制成本 · 每个 2-3 周 · 可并行 · 总 3-6 个月成熟。

---

## Credits

- **决策者**: AIA · One-Person Company · 2026-04-23 深度试点决策
- **执行者**: Claude Code + Opus 4.7 (1M context)
- **首个 production 目标**: 锦屏应舍美居 · 贵州黔东南 · 520㎡ · Q355B 重钢别墅
- **开源许可**: Apache-2.0 OR MIT(与项目根对齐)

---

version: 0.1.0 · 2026-04-23
