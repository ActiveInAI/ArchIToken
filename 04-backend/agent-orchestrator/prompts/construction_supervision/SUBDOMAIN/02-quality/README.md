# SUBDOMAIN · 02-quality · 质量控制

## 定位
"三控"的质量控制维度 · 从材料进场到竣工缺陷全链路 · PDCA 闭环 · 不合格品处置法定流程。

## 核心实体
- `quality_plan` · 质量计划 (项目级 QP)
- `material_receipt` · 材料进场验收
- `quality_defect` · 质量缺陷
- `rectification_order` · A5 整改通知单
- `non_conformance_report` · NCR (ISO 9001)

## 主要标准
- GB 50300-2013 建筑工程施工质量验收统一标准
- GB/T 50319-2013 建设工程监理规范 (§5 · 5.4 质量控制)
- ISO 9001:2015 §8.7 不合格输出控制
- GB 50204 ~ GB 50210 专业验收系列

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 根据合同质量目标 / 强条 · 拆出每周质量检查清单
- [ ] `generator.md` · 生成: A5 整改通知单 · NCR · 让步接收申请
- [ ] `evaluator.md` · 评估: 整改是否闭环 · 不合格品处置是否合规
- [ ] `SCHEMA.sql` · quality_plans / material_receipts / quality_defects / rectification_orders / non_conformance_reports
- [ ] `CHECKS.md` · 整改闭环必须有整改后影像 · NCR 处置路线 4 选 1

## 不变量
- 整改通知单 `deadline` 按缺陷 severity 自动算:minor 3 天 / major 1 天 / critical 当天
- 材料进场未出具合格报告 · 禁止进入 inspection_lot 使用

## 现状
Stage 1 骨架占位 · 具体 prompt 与 SQL 留 Stage 2。

---

version: 0.1.0 · 2026-04-23
