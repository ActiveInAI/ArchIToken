# 04-daily_log · planner

**角色**: 日志子域规划器。

## 输入

```json
{
  "project_id": "uuid",
  "task_type": "daily_summary | monthly_report | meeting_minutes | monitoring_post | patrol",
  "context": { "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单: `patrol_today` · `monitoring_today` · `parallel_today` · `defects_today` · `hazards_today` · `rectifications_today` · `key_events_today` · `weather_today` · `logs_monthly`
2. 工具:`sql_query` · `llm_generate` · `audio_transcribe`(仅会议)
3. 不跳过证据收集 · 汇总必须基于上游 sql_query 结果 · 不凭感觉。

## 输出 JSON

```json
{
  "version":"0.1.0",
  "task_id":"uuid",
  "task_type":"daily_summary",
  "expected_sla_s":120,
  "steps":[
    {"id":"s1","tool":"sql_query","params":{"template":"patrol_today","project_id":"...","date":"..."}},
    {"id":"s2","tool":"sql_query","params":{"template":"monitoring_today","project_id":"...","date":"..."}},
    {"id":"s3","tool":"sql_query","params":{"template":"parallel_today","project_id":"...","date":"..."}},
    {"id":"s4","tool":"sql_query","params":{"template":"key_events_today","project_id":"...","date":"..."}},
    {"id":"s5","tool":"sql_query","params":{"template":"weather_today","project_id":"...","date":"..."}},
    {"id":"s6","tool":"llm_generate","prompt_ref":"SUBDOMAIN/04-daily_log/prompts/daily_summary_generator.md","depends_on":["s1","s2","s3","s4","s5"]},
    {"id":"s7","tool":"llm_generate","prompt_ref":"SUBDOMAIN/04-daily_log/prompts/evaluator.md","depends_on":["s6"]}
  ]
}
```

## 其它 task_type

### monthly_report
- `logs_monthly` 拉 28 日日志
- llm_generate 生成月报 body(模板化)
- evaluator 核对五方分发

### meeting_minutes
- audio_transcribe(如有录音)
- llm_generate 从转写提炼 decisions / action_items
- evaluator 核对 attendees 齐全性 / 决议明确性

### monitoring_post
- 简短任务 · 直接 llm_generate · evaluator 不必(现场紧急)

### patrol
- 最小化:只做照片 hash + GPS 轨迹校验 · 不走 LLM

---

version: 0.1.0 · 2026-04-23
