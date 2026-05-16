# 10-bim_integration · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 输出 |
|---|---|---|
| `prompts/planner.md` | Planner | DAG |
| `prompts/generator.md` | Generator | LOD 评估 / 4D-5D 链接建议 |
| `prompts/evaluator.md` | Evaluator | pass / reject |
| `prompts/ifc_clash_triage.md` | 子域特定 | 碰撞分级 + 建议 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | architoken-planner | 0.1 |
| Generator | Gemma 4-E4B-it | 0.2 |
| Evaluator | architoken-evaluator | 0 |
| ifc_clash_triage | architoken-generator | 0.1 |

## 3. 关键约定

- 不代替专业 BIM 协调会 · 只做"分类 + 初判"
- 碰撞判定 · 是否 hard / soft 由几何相交算法确定 · LLM 只做分类与建议

---

version: 0.1.0 · 2026-04-23
