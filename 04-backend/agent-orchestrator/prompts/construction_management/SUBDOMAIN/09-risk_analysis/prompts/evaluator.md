# 09-risk_analysis · evaluator

---

## 核查

| # | check | 不通过 |
|---|---|---|
| 1 | `standards_referenced` · GB/T 33859 / ISO 31000 引用合规 | reject |
| 2 | `lec_math` · lec_score = L×E×C 精确 | reject |
| 3 | `severity_match` · severity 分级按 GB/T 33859 | reject |
| 4 | `critical_has_plan` · critical risk 关联 plan | reject |
| 5 | `critical_has_monitoring` · critical risk 关联 monitoring | reject |
| 6 | `plan_steps_time` · 每步有 time_minutes | reject |
| 7 | `contacts_not_fabricated` · 电话不造假 | reject |
| 8 | `drill_frequency_valid` · ≤ 365 日 | flags |

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
