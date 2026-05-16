# Example · 锦屏 · B5 检验批评定与整改

---

## 1. 背景

项目 5/17 完成二层钢结构全部梁柱节点焊接。
分项工程 "焊接连接" · 需划分检验批评定。

## 2. 5/17 10:00 · 触发 lot_boundary_advisor

前端 `<LotBoundaryAdvisorDialog />`:
- sub_item · 焊接连接
- preferred_granularity · medium

### LLM 建议 3 批

1. **JP-LOT-2026-F2A-001** · 二层 A 轴 · 5 节点
2. **JP-LOT-2026-F2B-001** · 二层 B 轴 · 3 节点(含 W-208)
3. **JP-LOT-2026-F2C-001** · 二层 C 轴 · 5 节点

每批 main_items 5 项 + general_items 3 项。

监理张工审阅 · 一键创建。

## 3. 5/17 - 5/19 · 施工与检测

- A 轴批 · 检测数据全合格
- B 轴批 · 5/19 UT 发现 W-208 不合格(见 06-testing 示例)
- C 轴批 · 焊接中

## 4. 5/19 · B 轴批评定

施工方自检后提交 `main_items` + `general_items` JSON:
- main_items · 5 项 · 1 fail(UT)
- general_items · 3 项 · 全 pass

### 数据库 trigger 自动算

- `main_pass = 4 / main_total = 5`
- `general_pass_rate = 0.96`
- `verdict = 'fail'` (主控未 100%)

## 5. 5/19 10:30 · generator 写评定叙述

见 generator.md 示例输出 · 显示:
- overall_verdict_expected · fail
- 原因 · UT W-208 夹渣
- 整改路径 · 02-quality 已生成 A5 JP-RO-2026-0017

## 6. 5/19 14:30 · 整改闭环

(见 02-quality 和 06-testing 场景)

## 7. 5/19 15:00 · B 批重评

施工方在前端重提交 `main_items`(W-208 项 verdict 改为 pass · 附复检报告 evidence_id):

```json
"main_items":[
  {"name":"焊缝外观","verdict":"pass"},
  {"name":"焊缝内部缺陷 UT","verdict":"pass",
   "evidence_ids":["<JP-UT-2026-0014 复检报告>"]},
  {"name":"焊材匹配","verdict":"pass"},
  {"name":"焊工资格","verdict":"pass"},
  {"name":"焊接工艺评定","verdict":"pass"}
]
```

数据库 trigger 重算 · `verdict = 'pass'`。

## 8. 5/19 15:10 · 向上聚合

- B 批 verdict = pass
- A + B + C 都 pass(C 批在 5/20 通过)· sub_item 焊接连接 verdict → pass(trigger)
- 焊接连接 pass · 其它钢结构分项也要 pass · sub_part 钢结构 verdict → pass
- 8 大分部全 pass · unit_project 可进入 08-acceptance 单位工程验收

## 9. 回顾

- 3 批划分 · 粒度 medium · 锚到 BIM 构件 + 材料批次
- LLM 辅助写评定叙述 · 但 verdict 由 DB trigger 决定(不幻觉)
- fail → 整改 → 重评 · 全程留痕
- 数据库 CHECK 强制主控 100% · 不可绕过

---

version: 0.1.0 · 2026-04-23
