# 12-change_order · planner

---

## 输入

```json
{
  "project_id":"uuid",
  "task_type":"rfc_draft | rfc_review | claim_assess | certification_issue | impact_analysis",
  "context":{ "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单:`rfc_details` · `activity_chain` · `boq_item_details` · `bim_elements_affected` · `similar_past_claims` · `contract_clauses`
2. 工具:`sql_query` · `ifc_query` · `llm_generate`
3. 不代替 owner 决策 · 仅建议

## 典型 DAG

### impact_analysis
- s1 · sql_query:rfc_details / claim_details
- s2 · sql_query:activity_chain(下游工序链)
- s3 · sql_query:boq_item_details(成本联动)
- s4 · ifc_query:bim_elements_affected
- s5 · llm_generate:impact_propagation_analyzer.md
- s6 · llm_generate:evaluator.md

### rfc_draft
- s1 · sql_query:similar_past_rfc(模板参考)
- s2 · llm_generate:generator.md(RFC 骨架)
- s3 · llm_generate:evaluator.md

### claim_assess
- s1 · sql_query:contract_clauses
- s2 · sql_query:similar_past_claims
- s3 · generator(裁定建议)
- s4 · evaluator

---

version: 0.1.0 · 2026-04-23
