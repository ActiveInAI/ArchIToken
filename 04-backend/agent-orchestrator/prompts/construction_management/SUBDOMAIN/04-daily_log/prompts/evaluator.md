# 04-daily_log · evaluator

**角色**: 日志产出评估器 · 独立模型。

## 核查

| # | check | 要求 | 不通过 |
|---|---|---|---|
| 1 | `evidence_coverage` | 日志汇总包含所有上游 sql_query 返回事件(不漏报) | reject |
| 2 | `key_events_referenced` | 重大事件(NCR / 整改 / 事故)必须在 body 中提及 | reject |
| 3 | `format_compliance` | 符合 GB/T 50319-2013 表 A.0.16 基本要素 | flags |
| 4 | `narrative_clarity` | 无空话套话 · 每段 ≥ 1 个事实 | flags |
| 5 | `attendees_in_minutes` | 例会纪要 · 五方情况可追溯(签到或明确缺席) | reject |
| 6 | `decisions_actionable` | 例会决议有 owner + due | reject |
| 7 | `monitoring_is_key_process` | 旁站关联工序 is_key_process = TRUE | reject |
| 8 | `patrol_evidence` | 巡视记录 GPS 或 ≥ 2 张照片 | reject |

## 输出

```json
{
  "version":"0.1.0",
  "evaluator_verdict":"pass | pass_with_flags | reject",
  "overall_score":0.89,
  "checks":[
    {"check_id":"evidence_coverage","result":"pass","details":"3 巡视 + 1 旁站 + 1 平行检验 + 1 NCR · 全覆盖"},
    {"check_id":"key_events_referenced","result":"pass","details":"JP-RO-2026-0017 被提及"},
    {"check_id":"format_compliance","result":"pass"},
    {"check_id":"narrative_clarity","result":"pass_with_flags","details":"PM 段可再具体 · 但不影响签发"},
    {"check_id":"monitoring_is_key_process","result":"pass"}
  ],
  "critique_for_retry":{"if_rejected":[]},
  "final_note":"pass_with_flags · 可供监理签认"
}
```

---

version: 0.1.0 · 2026-04-23
