# SUBDOMAIN · 08-acceptance · 验收管理

## 定位
从隐蔽工程到五方联合竣工验收的全套流程 · 合并原 v2.0 的 `acceptance` 阶段。
法理基础 · 建质〔2013〕171 号 房屋建筑和市政基础设施工程竣工验收备案管理办法。

## 核心实体
- `unit_project` · 单位工程
- `acceptance_record` · 验收记录 (统一对 4 级验收树)
- `hidden_work` · 隐蔽工程验收记录
- `handover_certificate` · 竣工 / 移交证书

## 主要标准
- GB 50300-2013 建筑工程施工质量验收统一标准 (根标准)
- 建质〔2013〕171 号 竣工验收备案管理办法
- GB/T 50319-2013 §5.6 工程质量评估报告
- 国务院令 279 号 建设工程质量管理条例 (五方责任主体法源)

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 按 WBS + Inspection Lot 生成验收计划
- [ ] `generator.md` · 生成: 验收记录 · 隐蔽工程记录 · 质量评估报告
- [ ] `evaluator.md` · 评估: 4 级汇总一致性 · 五方签字齐全性
- [ ] `SCHEMA.sql` · unit_projects / acceptance_records / hidden_works / handover_certificates
- [ ] `CHECKS.md` · 隐蔽必 ≥ 4 张留痕影像 · 单位验收必五方齐

## 不变量
- `acceptance_record.verdict = accepted` · 必须引用 `standard_code` + `clause_no`
- 五方联合竣工验收 · 五方 `signed_at` 都不能空
- 隐蔽工程 · `before_buried_at` 必须存在且有影像

## 现状
Stage 1 骨架占位 · 验收单模板留 Stage 2。

---

version: 0.1.0 · 2026-04-23
