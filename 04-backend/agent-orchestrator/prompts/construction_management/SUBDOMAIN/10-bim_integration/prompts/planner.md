# 10-bim_integration · planner

---

## 输入

```json
{
  "project_id":"uuid",
  "task_type":"upload_model | clash_triage | generate_4d_links | generate_5d_links | lod_assessment",
  "context":{ "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单:`current_bim_active` · `activities_need_4d` · `boq_items_need_5d` · `element_metadata_by_guid`
2. 工具:`sql_query` · `ifc_query` · `clash_detect_engine`(Rust)· `llm_generate`
3. 不直接做几何计算 · 走 Rust 函数

## 典型 DAG

### clash_triage
- s1 · ifc_query:all_elements
- s2 · clash_detect_engine(Rust · 产出 raw clashes)
- s3 · llm_generate:ifc_clash_triage.md(分级 + 建议)
- s4 · llm_generate:evaluator.md

### generate_4d_links
- s1 · activities_need_4d
- s2 · ifc_query:elements_by_type(按 IFC type → WBS)
- s3 · generator(建议链接方案)
- s4 · evaluator

### upload_model
- s1 · SHA256 校验
- s2 · ifc_query:basic_stats(elements_count, storeys 等)
- s3 · 自动触发 clash_detect + triage

---

version: 0.1.0 · 2026-04-23
