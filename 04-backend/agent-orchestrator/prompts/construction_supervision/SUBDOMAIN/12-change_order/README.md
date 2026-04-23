# SUBDOMAIN · 12-change_order · 变更管理

## 定位
设计变更 / 工程洽商 / 签证 / 索赔 / 变更影响评估 · 合同管理的最活跃一角。
与 quantity_costing 双向联动 · 每一次变更都可能改 BOQ 与工期。

## 核心实体
- `engineering_change` · 设计变更 (RFC · 最严重一级)
- `site_consultation` · 工程洽商 (小范围调整)
- `claim` · 索赔 (一方主张补偿)
- `certification` · 签证 (现场费用 / 工期证明)
- `change_impact_assessment` · 变更影响评估 (造价 · 工期 · 质量)

## 主要标准
- GB 50500-2013 建设工程工程量清单计价规范 (变更计价)
- AIA A201-2017 General Conditions (美式变更程序)
- FIDIC Red Book 2017 §13 Variations and Adjustments
- GB/T 50326-2017 建设工程项目管理规范 (变更控制章节)

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 识别变更需求来源(设计 / 现场 / 甲方) · 准备评估
- [ ] `generator.md` · 生成: RFC · 洽商单 · 签证单 · 索赔函 · 影响评估报告
- [ ] `evaluator.md` · 评估: 变更依据合法性 · 计价与工期影响准确性
- [ ] `SCHEMA.sql` · engineering_changes / site_consultations / claims / certifications / change_impact_assessments
- [ ] `CHECKS.md` · 变更必须三方签字 · 计价必须对照 GB 50500 · 索赔必须在合同约定期限内

## 不变量
- `engineering_change.status = approved` · 必须 `approved_by_owner IS NOT NULL`
- 变更导致的 BOQ 调整 · 必须同步生成 `csr.certifications` 签证记录
- 索赔逾期提交(超过合同约定 · 通常 28 天 · FIDIC) · 默认不予受理标记

## 现状
Stage 1 骨架占位 · 变更链路具体模板留 Stage 2。

---

version: 0.1.0 · 2026-04-23
