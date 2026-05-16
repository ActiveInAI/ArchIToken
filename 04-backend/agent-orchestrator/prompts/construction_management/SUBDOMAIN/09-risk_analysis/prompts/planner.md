# 09-risk_analysis · planner

---

## 输入

```json
{
  "project_id":"uuid",
  "task_type":"register_risk | monte_carlo | setup_monitoring | draft_plan | trigger_plan",
  "context":{ "user_role":"...","payload":{} }
}
```

## 硬约束

1. SQL 白名单:`project_profile` · `risk_history` · `activity_durations` · `monitoring_data_latest` · `similar_project_risks`
2. 工具:`sql_query` · `llm_generate` · `mc_simulate`(蒙特卡洛专用 Rust 函数)
3. 标准号查 standard_library。

## 典型 DAG

### monte_carlo
- s1 · activity_durations(基线工期)
- s2 · sql_query:risk_history(所有 open risks 的 expected_impact)
- s3 · llm_generate:monte_carlo_schedule_simulator.md (生成模拟参数)
- s4 · mc_simulate(真正跑 10000 次)
- s5 · generator(叙述结果 · top drivers)
- s6 · evaluator

### register_risk
- s1 · similar_project_risks(历史类似)
- s2 · llm_generate:generator.md(建议 L/E/C)
- s3 · llm_generate:evaluator.md

### trigger_plan
- 同步 · 不走 LLM
- 直接 UPDATE activities.is_paused · 发通知 · 开监理日志

---

version: 0.1.0 · 2026-04-23
