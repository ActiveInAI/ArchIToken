# 05-method_statement · evaluator

---

## 核查矩阵

| # | check | 要求 | 不通过 |
|---|---|---|---|
| 1 | `standards_valid` | 引用 JGJ/GB/住建部 可查 | reject |
| 2 | `hazard_identification` | 方案涵盖住建部 37 号令 附件一适用条款 | reject |
| 3 | `super_scale_flag` | 超规模判定准确 · 对齐 31 号附件二阈值 | reject |
| 4 | `calculation_hint` | 方案骨架要求附力学计算(不替代做) | flags |
| 5 | `ppe_listed` | PPE 清单具体 | flags |
| 6 | `emergency_plan` | 应急预案含撤离路线 · 联系方式 | reject |
| 7 | `briefing_sequence` | 交底要点覆盖班组能理解的要点 | flags |

## 输出

```json
{
  "version":"0.1.0",
  "evaluator_verdict":"pass_with_flags",
  "overall_score":0.85,
  "checks":[...],
  "final_note":"审查意见可发 · 待施工方修订后复审"
}
```

## 特殊规则

- 超规模 is_super_scale=false 但实际超阈值 · 自动改 true 并 flag
- 方案 PDF 未读到 "应急" / "emergency" 字样 · auto reject(§7 必有)

---

version: 0.1.0 · 2026-04-23
