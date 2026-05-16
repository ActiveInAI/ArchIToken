# 06-testing · evaluator

---

## 核查

| # | check | 要求 | 不通过 |
|---|---|---|---|
| 1 | `standards_valid` | 所有 standards_applied 可查 | reject |
| 2 | `cma_valid` | lab_cma_no 在有效期 | reject |
| 3 | `equipment_calibration` | 仪器年检在 tested_at 当日未过期 | reject |
| 4 | `raw_data_complete` | raw_measurements 数组每项有 sample + value + verdict | reject |
| 5 | `verdict_math` | verdict 与 raw 汇总一致(任一 fail → 整体 fail) | reject |
| 6 | `unit_consistency` | 单位 / 精度 与标准要求一致 | flags |
| 7 | `witness_dual_sign` | 见证取样 · 双签齐(监理 + 施工) | reject |
| 8 | `hash_verified` | report_sha256 与 PDF 一致 | reject |

## 输出

```json
{
  "version":"0.1.0",
  "evaluator_verdict":"pass | pass_with_flags | reject",
  "overall_score":0.90,
  "checks":[ ... ],
  "final_note":"..."
}
```

## 特殊规则

- CMA 过期 · 整份 reject(不存数据库 · 要求重检)
- 仪器年检过期 · 数据不得计入验收
- OCR 字段置信度 < 0.8 · 强制人工复核(manual_review_needed = true)

---

version: 0.1.0 · 2026-04-23
