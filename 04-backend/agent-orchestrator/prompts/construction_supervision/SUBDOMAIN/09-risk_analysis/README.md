# SUBDOMAIN · 09-risk_analysis · 风险分析

## 定位
施工风险的半定量管理 · 登记册 + LEC 评价 + 监测点位 + 应急预案。
与 03-safety 的区别 · 03 管"已识别危大工程的法定流程" · 09 管"全项目的系统风险识别与追踪"。

## 核心实体
- `risk_entry` · 风险登记 (包含 L · E · C 三因子)
- `risk_monitoring_point` · 监测点位 (与 IoT 传感器联动)
- `emergency_plan` · 应急预案

## 主要标准
- ISO 31000:2018 Risk management guidelines
- GB/T 33859-2017 风险管理 组织管理风险评估指南
- GB/T 27921-2023 风险管理 风险评估技术(等同 IEC 31010)
- GB/T 23694-2013 风险管理 术语
- PMBOK Guide 7th · §11 风险管理

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 基于 WBS + 地质 + 气象 · 扫描项目级风险清单
- [ ] `generator.md` · 生成: 风险登记册 · LEC 评分 · 应急预案
- [ ] `evaluator.md` · 评估: 风险覆盖度 · 监测措施完整性
- [ ] `SCHEMA.sql` · risk_entries / risk_monitoring_points / emergency_plans
- [ ] `CHECKS.md` · LEC 合理性 · 监测点位与危大工程对齐

## 不变量
- LEC 分数 · 按 GB/T 33859 分级 (低 < 20 · 中 20-70 · 高 70-160 · 极高 > 160)
- 高 / 极高风险 · 必须有对应监测点位
- 应急预案必须有演练记录 (annual 或 every 6 months)

## 现状
Stage 1 骨架占位 · LEC 量表 / 预案模板留 Stage 2。

---

version: 0.1.0 · 2026-04-23
