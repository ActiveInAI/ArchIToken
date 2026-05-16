# 02-quality · PROMPTS

本子域的 LangGraph Prompt 清单 + 使用说明。

---

## 1. 4 个 Prompt

| 文件 | 角色 | 触发 | 输出 |
|---|---|---|---|
| `prompts/planner.md` | Planner | API 路由 | 子任务 DAG |
| `prompts/generator.md` | Generator | planner 下发 | A5 整改单 / NCR / 缺陷叙述 |
| `prompts/evaluator.md` | Evaluator | generator 产出 | pass / reject / flags |
| `prompts/defect_classifier.md` | 子域特定 | 用户描述 + 影像 | category / severity / 标准引用 候选 |

## 2. 模型路由建议

| 角色 | 模型 | 温度 | 理由 |
|---|---|---|---|
| Planner | architoken-planner | 0.1 | 路径决策 |
| Generator | Gemma 4-E4B-it / Qwen3.6 | 0.3 | 结构化表单文本(A5 / NCR) |
| Evaluator | architoken-evaluator | 0 | 规范核查严格 |
| defect_classifier | architoken-generator | 0.2 | 结合图文多模态 |

## 3. 多模态约束

defect_classifier 是本子域唯一多模态 · 输入 description + 照片 embedding (vision encoder)。
如用 Ollama Gemma 走本地 · 需确认多模态支持(Gemma 4 原生多模态)。

## 4. 调用约定

`/v1/csr/quality/defects/{id}/rectify` 路径流:
```
user click → planner → sql_query (defect details) → generator (写 A5) → evaluator → 201 response
```

完整 DAG 在 `planner.md` 的 "task_type: rectify" 分支。

## 5. 测试规范

每 prompt 3+ 黄金样本 + 1+ 反例 · 放 `tests/snapshots/csr/quality/`。
特别:defect_classifier 回归测试 · 需跑 100+ 真实缺陷描述 · 准确率 ≥ 85%(category top-1)。

---

version: 0.1.0 · 2026-04-23
