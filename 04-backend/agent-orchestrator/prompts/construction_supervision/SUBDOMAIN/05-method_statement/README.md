# SUBDOMAIN · 05-method_statement · 施工方案与技术交底

## 定位
专项施工方案(含危大专项) + 三级技术交底 · 每个关键工序开工前必过本子域。
超过一定规模的危大方案 · 必须专家论证 · 本子域记录论证闭环。

## 核心实体
- `method_statement` · 专项施工方案 (含 `is_super_scale`, `expert_reviewed_at`)
- `technical_briefing` · 技术交底 (公司级 / 项目级 / 班组级)
- `expert_review` · 危大专家论证记录

## 主要标准
- 住建部令第 37 号 危险性较大的分部分项工程安全管理规定
- 建办质〔2018〕31 号 有关问题的通知(危大辨识清单)
- GB 50656-2011 施工企业安全生产管理规范
- GB/T 50319-2013 §5.2.2 施工组织设计 / 专项方案审批程序

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 根据 BIM + WBS 识别需要专项方案的分部分项
- [ ] `generator.md` · 生成: 专项施工方案骨架 · 技术交底记录 · 专家论证邀请
- [ ] `evaluator.md` · 评估: 方案是否覆盖危大清单 · 论证结论是否落地
- [ ] `SCHEMA.sql` · method_statements / technical_briefings / expert_reviews
- [ ] `CHECKS.md` · 危大必方案 · 超规模必论证 · 交底必三级

## 不变量
- `is_super_scale = true` AND `expert_reviewed_at IS NULL` · 禁止开工
- 三级交底 · 同一工序必须按 company→project→crew 顺序签认完毕

## 现状
Stage 1 骨架占位 · 方案模板与论证清单留 Stage 2。

---

version: 0.1.0 · 2026-04-23
