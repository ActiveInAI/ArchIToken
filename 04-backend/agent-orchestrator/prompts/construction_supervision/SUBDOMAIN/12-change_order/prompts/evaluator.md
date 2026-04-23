# 12-change_order · evaluator

---

## 核查

| # | check | 不通过 |
|---|---|---|
| 1 | `contract_clauses_valid` · 引用合同条款 / FIDIC 真实 | reject |
| 2 | `amount_days_specific` · 具体数字 | reject |
| 3 | `owner_approval_for_rfc` · RFC approved 必 owner 签 | reject |
| 4 | `claim_within_period` · within_notice_period=TRUE 或显式说明逾期处理 | flags |
| 5 | `cert_three_sigs_for_large` · > 5 万签证三方签 | reject |
| 6 | `impact_four_dims` · 影响分析覆盖 cost/sched/quality/safety 四维 | reject |
| 7 | `cascading_traced` · cascading_effects 对所有受影响子域有引用 | flags |

---

version: 0.1.0 · 2026-04-23
