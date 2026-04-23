# 11-compliance · planner

---

## 输入

```json
{
  "project_id":"uuid",
  "task_type":"compliance_check | regulation_diff | permit_track | archive_assemble",
  "context":{ "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单:`applicable_clauses_for_target` · `target_metadata` · `clause_history` · `permits_for_project` · `all_module_records`
2. 工具:`sql_query` · `llm_generate` · `vector_search`(语义搜强条)· `archive_zip`(调 digital_archive)
3. 绝对不自造标号。

## 典型 DAG

### compliance_check
- s1 · applicable_clauses_for_target
- s2 · target_metadata(缺陷 / 主控 / 变更 内容)
- s3 · llm_generate:generator.md · 逐 clause 判 verdict
- s4 · evaluator

### regulation_diff
- s1 · standard_library 两版本对比(sql_query:clause_history)
- s2 · llm_generate:regulation_diff_detector.md
- s3 · evaluator

### archive_assemble
- s1 · all_module_records · 汇集所有候选档案 item
- s2 · completeness_check(7 类)
- s3 · generator(table_of_contents)
- s4 · archive_zip(调 digital_archive)
- s5 · evaluator

---

version: 0.1.0 · 2026-04-23
