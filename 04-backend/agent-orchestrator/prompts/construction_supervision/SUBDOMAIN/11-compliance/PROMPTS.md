# 11-compliance · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 输出 |
|---|---|---|
| `prompts/planner.md` | Planner | DAG |
| `prompts/generator.md` | Generator | 合规报告 / 归档包描述 |
| `prompts/evaluator.md` | Evaluator | pass / reject |
| `prompts/regulation_diff_detector.md` | 子域特定 | 法规差异 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | Claude Opus 4.7 | 0.1 |
| Generator | Gemma 4-E4B-it | 0.2 |
| Evaluator | Claude Opus 4.7 | 0 |
| regulation_diff_detector | Claude Opus 4.7 | 0.1 |

## 3. 关键约定

- 合规性判定必须引原文 · 不概括
- 法规差异必须给 added / changed / removed 三桶
- 归档完整性基于 JSON 清单 · 不跑 zip 逻辑(那是 digital_archive 的活)

---

version: 0.1.0 · 2026-04-23
