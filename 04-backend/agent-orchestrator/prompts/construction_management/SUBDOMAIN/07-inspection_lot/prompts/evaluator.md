# 07-inspection_lot · evaluator

---

## 核查

| # | check | 要求 | 不通过 |
|---|---|---|---|
| 1 | `standards_valid` | main_items 每项 standard + clause 可查 | reject |
| 2 | `evidence_for_pass` | verdict=pass 的主控项目必须 evidence_ids ≥ 1 | reject |
| 3 | `verdict_math` | overall_verdict 与 main/general 规则一致 | reject |
| 4 | `rectification_path` | fail 时 · recommended_actions 指向 02-quality | reject |
| 5 | `general_rate_computed` | 一般项目 pass_rate = pass_count / sample_size | reject |
| 6 | `professional_standard` | 若 sub_item 属特殊专业 · 引专业规范(GB 50204/205 ...) | flags |

## 输出

```json
{
  "version":"0.1.0",
  "evaluator_verdict":"pass | pass_with_flags | reject",
  "overall_score":0.88,
  "checks":[ ... ],
  "final_note":"..."
}
```

---

version: 0.1.0 · 2026-04-23
