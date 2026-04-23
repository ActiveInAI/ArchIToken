# SUBDOMAIN · 03-safety · 安全控制

## 定位
危险源辨识 · 危大工程管理 · 高处 / 吊装 / 临电 / 脚手架 / 模板 / 基坑 / 动火 / 受限空间 全覆盖。
基础 · 住建部令第 37 号 + JGJ 59-2011 + ISO 45001:2018。

## 核心实体
- `safety_plan` · 安全方案 (HSE 计划)
- `safety_hazard` · 安全隐患登记
- `work_permit` · 作业许可 (动火 / 高处 / 受限 / 吊装)
- `toolbox_talk` · 班前会 / 安全交底
- `incident_report` · 事故 / 未遂

## 主要标准
- GB 50870-2013 建筑施工安全技术统一规范
- GB 50656-2011 施工企业安全生产管理规范
- JGJ 59-2011 建筑施工安全检查标准
- JGJ 46 / 80 / 128 / 130 / 162 / 166 / 180 系列 (临电 / 高处 / 脚手 / 模板 / 土方)
- 住建部令第 37 号 · 建办质〔2018〕31 号
- ISO 45001:2018 · OSHA 29 CFR 1926

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 识别项目级危大清单 · 制定 HIRA 登记册
- [ ] `generator.md` · 生成: 作业许可单 · 班前会记录 · 应急预案
- [ ] `evaluator.md` · 评估: 危险源辨识完整度 · 许可闭环 · 法规覆盖度
- [ ] `SCHEMA.sql` · safety_plans / safety_hazards / work_permits / toolbox_talks / incident_reports
- [ ] `CHECKS.md` · 危大必须专项方案 + 交底 + 旁站 · 超规模必须专家论证

## 不变量
- 作业许可开出但未关闭的许可 · 在 end_at 之前不允许新开同类许可
- 重大 / 一般事故必须 24h 内 incident_report 入库
- 危大工程 (`method_statement.is_major = true`) 开工前 · technical_briefing 三级必全

## 现状
Stage 1 骨架占位 · 实际策略逻辑留 Stage 2。

---

version: 0.1.0 · 2026-04-23
