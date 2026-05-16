# 08-acceptance · planner

---

## 输入

```json
{
  "project_id":"uuid",
  "task_type":"quality_assessment_report | hidden_work_check | schedule_five_parties | issue_handover_cert",
  "context":{ "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单:`completion_readiness` · `sub_part_acceptance_status` · `hidden_work_checklist` · `special_acceptance_status` · `five_parties_roster` · `rectification_unclosed`
2. 工具:`sql_query` · `llm_generate` · `pdf_render`(证书)· `notify_parties`(邮件 / SMS)
3. 不凭记忆给建质 171 号 / GB 50300 条款 · 查 standard_library。

## 输出 JSON

```json
{
  "version":"0.1.0",
  "task_id":"uuid",
  "task_type":"quality_assessment_report",
  "expected_sla_s":360,
  "steps":[
    {"id":"s1","tool":"sql_query","params":{"template":"completion_readiness","project_id":"..."}},
    {"id":"s2","tool":"sql_query","params":{"template":"sub_part_acceptance_status","project_id":"..."}},
    {"id":"s3","tool":"sql_query","params":{"template":"rectification_unclosed","project_id":"..."}},
    {"id":"s4","tool":"llm_generate","prompt_ref":"SUBDOMAIN/08-acceptance/prompts/generator.md","depends_on":["s1","s2","s3"]},
    {"id":"s5","tool":"llm_generate","prompt_ref":"SUBDOMAIN/08-acceptance/prompts/evaluator.md","depends_on":["s4"]}
  ]
}
```

## 典型 DAG

### schedule_five_parties
- s1 · five_parties_roster
- s2 · special_acceptance_status(消防 / 节能 / 防雷)· 必须全 pass 才可约
- s3 · llm_generate:five_parties_signoff_orchestrator.md
- s4 · notify_parties(邮件)

### issue_handover_cert
- s1 · sub_part_acceptance_status(全 pass)
- s2 · special_acceptance_status(全 pass)
- s3 · llm_generate:generator.md(cert 元数据)
- s4 · pdf_render(用 建质 171 号 模板)
- s5 · evaluator(核查)

---

version: 0.1.0 · 2026-04-23
