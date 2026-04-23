# SUBDOMAIN · 01-progress · 进度管理

## 定位
"三控"的进度控制维度 · 覆盖从施工组织设计审批到每日前锋线的全过程。
对接 BIM 的 4D 模拟与 quantity_costing 的 5D 视图。

## 核心实体
- `schedule` · 进度计划 (基线 / 当前)
- `wbs_node` · WBS 工作分解结构
- `activity` · 工序
- `milestone` · 里程碑
- `progress_snapshot` · 日 / 周 EVM 快照 (PV/EV/AC/CPI/SPI)

## 主要标准
- GB/T 50502-2009 建筑施工组织设计规范
- GB/T 50326-2017 建设工程项目管理规范
- PMBOK Guide 7th · EVM 章

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 将合同里程碑 + BIM 4D 分解为 WBS + 关键路径
- [ ] `generator.md` · 生成: 周进度纠偏方案 / 资源平衡调整
- [ ] `evaluator.md` · 评估: 基线 vs 实际偏差审查 · 赶工风险评估
- [ ] `SCHEMA.sql` · schedules / wbs_nodes / activities / milestones / progress_snapshots
- [ ] `CHECKS.md` · 关键路径不能断 / EVM 三值一致性 / 里程碑不可回退

## 不变量
- 基线 (baseline = true) 的 schedule · 每个 project 有且仅有 1 个
- 活动的 early_start ≤ late_start · 违反即拒绝写入

## 现状
Stage 1 骨架占位 · 实际 planner/generator/evaluator 留 Stage 2。

---

version: 0.1.0 · 2026-04-23
