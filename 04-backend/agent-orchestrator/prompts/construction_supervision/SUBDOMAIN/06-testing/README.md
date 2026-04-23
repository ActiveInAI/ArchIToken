# SUBDOMAIN · 06-testing · 检测试验

## 定位
见证取样送第三方 CMA 实验室检测 · 现场无损 / 有损实体检测 · 数据回流到 07/08 子域。
实验数据是验收的硬证据 · 不可伪造 · 链上留痕 (hash + witness)。

## 核心实体
- `test_witnessing` · 见证取样记录
- `lab_report` · 实验室检测报告 (PDF + 结构化字段)
- `onsite_test` · 现场实体检测 (回弹 / 取芯 / UT / MT / RT / PT)

## 主要标准
- GB 50204-2015 §7.2 混凝土结构工程验收 · 见证取样规定
- GB 50205-2020 §7.2 钢结构焊缝检测规定 (UT / MT / RT / PT)
- GB/T 50784-2013 混凝土结构现场检测技术标准
- JGJ/T 23-2011 回弹法检测混凝土抗压强度
- GB/T 11345 / 9444 / 3323 / 18851 系列 NDT 方法标准

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 按 Inspection Lot 计算需要抽检的频率 / 批量
- [ ] `generator.md` · 生成: 见证取样单 · 送检委托单
- [ ] `evaluator.md` · 评估: 实验数据是否合格 · 不合格触发 02-quality
- [ ] `SCHEMA.sql` · test_witnessings / lab_reports / onsite_tests
- [ ] `CHECKS.md` · 抽样频率满足 GB 标准 · CMA 资质有效期校验

## 不变量
- 见证取样必须 `witness_worker_id` (监理方) + `sampler_worker_id` (施工方) 双签
- 实验室 CMA 证书过期 · 对应报告不得采信

## 现状
Stage 1 骨架占位 · 检测标准映射表留 Stage 2。

---

version: 0.1.0 · 2026-04-23
