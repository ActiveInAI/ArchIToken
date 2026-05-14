# 12-change_order · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 输出 |
|---|---|---|
| `prompts/planner.md` | Planner | DAG |
| `prompts/generator.md` | Generator | RFC 草稿 / 索赔评估 / 签证模板 |
| `prompts/evaluator.md` | Evaluator | pass / reject |
| `prompts/impact_propagation_analyzer.md` | 子域特定 | 四维 + cascading 影响 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | architoken-planner | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | architoken-evaluator | 0 |
| impact_propagation_analyzer | architoken-generator | 0.1 |

## 3. 关键约定

- 金额 / 天数 必须数字 + 单位
- 合同条款引用必须原文(合同专用条款 · 不编)
- 不代判 owner 批准(仅给建议)

---

version: 0.1.0 · 2026-04-23
