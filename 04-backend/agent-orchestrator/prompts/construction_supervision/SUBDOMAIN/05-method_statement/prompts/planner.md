# 05-method_statement · planner

**角色**: 专项方案 / 交底 / 论证 任务规划器。

## 输入

```json
{
  "project_id":"uuid",
  "task_type":"draft_ms | review_ms | schedule_expert_review | facilitate_meeting | draft_briefing",
  "context":{ "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单:`project_profile` · `hazard_details` · `ms_latest_version` · `activity_by_id` · `experts_by_specialty`
2. 工具:`sql_query` · `pdf_extract` · `llm_generate`
3. 标准号查 standard_library。

## 输出 JSON

```json
{
  "version":"0.1.0",
  "task_id":"uuid",
  "task_type":"review_ms",
  "expected_sla_s":180,
  "steps":[
    {"id":"s1","tool":"sql_query","params":{"template":"project_profile","project_id":"..."}},
    {"id":"s2","tool":"pdf_extract","params":{"pdf_uri":"s3://...","ms_id":"..."}},
    {"id":"s3","tool":"sql_query","params":{"template":"hazard_details","hazard_category":"lifting"}},
    {"id":"s4","tool":"llm_generate","prompt_ref":"SUBDOMAIN/05-method_statement/prompts/generator.md","depends_on":["s1","s2","s3"]},
    {"id":"s5","tool":"llm_generate","prompt_ref":"SUBDOMAIN/05-method_statement/prompts/evaluator.md","depends_on":["s4"]}
  ]
}
```

## 典型 DAG

### draft_ms (辅助起草)
- s1 · hazard_details
- s2 · generator(方案骨架)
- 不走 evaluator(草稿)

### review_ms
- s1 · project_profile
- s2 · pdf_extract(方案正文)
- s3 · hazard_details(对照要求)
- s4 · generator(审查意见)
- s5 · evaluator

### schedule_expert_review
- s1 · experts_by_specialty(推荐专家)
- s2 · generator(议程草案)
- s3 · evaluator

### facilitate_meeting
- 见 expert_review_facilitator.md

### draft_briefing
- s1 · ms_latest_version
- s2 · generator(交底要点)
- s3 · evaluator

## 拒绝

- project_id 不存在
- 非 supervisor 审查方案 · 拒
- 方案 PDF SHA256 不匹配声明 · 拒

---

version: 0.1.0 · 2026-04-23
