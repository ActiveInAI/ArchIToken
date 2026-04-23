# 03-safety · PROMPTS

4 个 prompt: 三角色 + `hira_generator.md`。

---

## 1. 清单

| 文件 | 角色 | 触发 | 输出 |
|---|---|---|---|
| `prompts/planner.md` | Planner | API | DAG |
| `prompts/generator.md` | Generator | planner | 作业许可 / 交底 / HSE 计划 / 事故报告草稿 |
| `prompts/evaluator.md` | Evaluator | generator | pass / reject |
| `prompts/hira_generator.md` | 子域特定 | `/hira/generate` | HIRA 登记册(L/E/C + 措施) |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | Claude Opus 4.7 | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | Claude Opus 4.7 | 0 |
| hira_generator | Claude Opus 4.7 | 0.2 |

## 3. 关键约定

- 隐患 / 许可 / 事故类 · 全部涉及法律责任 · 生成后必须 evaluator 核查引用的 JGJ / 住建部文号。
- LEC 评分 · LLM 给出建议值 + 理由 · 不代替人工打分(用户可改)。
- 班前会交底 · 支持语音 input → 转写 → LLM 总结 · 不是 LLM 原创。

## 4. 测试

- 每 prompt 3+ 黄金样本
- HIRA generator 的回归: 10+ 真实项目数据集 · 期望召回率 ≥ 80%(已知危险源)

---

version: 0.1.0 · 2026-04-23
