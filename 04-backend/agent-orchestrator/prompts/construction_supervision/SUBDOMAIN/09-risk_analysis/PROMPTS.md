# 09-risk_analysis · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 输出 |
|---|---|---|
| `prompts/planner.md` | Planner | DAG |
| `prompts/generator.md` | Generator | 风险登记 / 预案草稿 |
| `prompts/evaluator.md` | Evaluator | pass / reject |
| `prompts/monte_carlo_schedule_simulator.md` | 子域特定 | P10/50/90 + 敏感性 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | Claude Opus 4.7 | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | Claude Opus 4.7 | 0 |
| monte_carlo | Claude Opus 4.7 | 0 (确定性) |

## 3. 关键约定

- LEC 分数由 L/E/C 相乘 · LLM 只建议 L/E/C · 不自改分数
- 预案 procedures · 每步给 time_minutes(不写"尽快")
- 蒙特卡洛 · 种子固定 · 可复现

---

version: 0.1.0 · 2026-04-23
