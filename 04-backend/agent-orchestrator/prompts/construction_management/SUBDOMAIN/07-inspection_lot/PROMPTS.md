# 07-inspection_lot · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 触发 | 输出 |
|---|---|---|---|
| `prompts/planner.md` | Planner | API | DAG |
| `prompts/generator.md` | Generator | planner | 批评定叙述 / 主控 / 一般 细化 |
| `prompts/evaluator.md` | Evaluator | generator | pass / reject |
| `prompts/lot_boundary_advisor.md` | 子域特定 | `/lot-boundary-advisor` | 批划分方案 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | architoken-planner | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | architoken-evaluator | 0 |
| lot_boundary_advisor | architoken-generator | 0.2 |

## 3. 关键约定

- 主控判定必须引标号 + 条款 · 否则 evaluator reject
- 一般项目合格率由数据库 trigger 自动算 · LLM 不代算
- lot_boundary_advisor 建议 · 不代替施工组织设计(CSR 的前置由 GB/T 50502-2009 规)

---

version: 0.1.0 · 2026-04-23
