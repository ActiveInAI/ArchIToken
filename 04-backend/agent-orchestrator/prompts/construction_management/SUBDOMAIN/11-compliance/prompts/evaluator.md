# 11-compliance · evaluator

---

## 核查

| # | check | 不通过 |
|---|---|---|
| 1 | `clauses_effective` · 引用 clause effective_from <= now <= effective_to | reject |
| 2 | `verdict_math` · non_compliant 必须 mandatory_violated > 0 | reject |
| 3 | `evidence_present` · violated 必须 evidence_refs | reject |
| 4 | `followup_actions_linked` · non_compliant 必有 02-quality A5 | reject |
| 5 | `archive_completeness` · completion 必 7 类齐 | reject |
| 6 | `standards_cited_all_valid` · 全部存在 standard_library | reject |

---

version: 0.1.0 · 2026-04-23
