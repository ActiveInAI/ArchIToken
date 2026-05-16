# 01-progress · PROMPTS

本子域的 LangGraph 节点 · Prompt 清单 + 使用说明。

---

## 1. 三角色 + 1 特殊 · 共 4 个 Prompt

| 文件 | 角色 | 触发条件 | 输入 | 输出 |
|---|---|---|---|---|
| `prompts/planner.md` | Planner | API 路由 / SSE 调用 | 项目 id + 任务类型 | 子任务 DAG + 工具调用计划 |
| `prompts/generator.md` | Generator | planner 下发 | 子任务上下文 | 结构化计划 / 纠偏方案 / EVM 分析 |
| `prompts/evaluator.md` | Evaluator | generator 产出 | 产出 + 合同 + 规范 | 通过 / 拒绝 / 修改建议 |
| `prompts/delay_root_cause_analyzer.md` | 子域特定 | SPI < 0.95 自动 / 手动 | 14 日快照 + 前 10 延期 activity | 根因树 + 置信度 |

## 2. 模型路由建议

宪法 §9 强制 generator 与 evaluator 用不同模型。本子域推荐:

| 角色 | 模型 | 温度 | 理由 |
|---|---|---|---|
| Planner | architoken-planner | 0.1 | 复杂任务分解强 |
| Generator | Gemma 4-E4B-it / Qwen3.6 (Ollama 本地) | 0.4 | 结构化文本产出 · 成本低 |
| Evaluator | architoken-evaluator | 0 | 严苛审查 · 低温度 |
| delay_root_cause_analyzer | architoken-generator | 0.2 | 推理链复杂 · 非频繁调用 |

路由由 `settings_center.model_routes` 配 · 不在 prompt 里 hard-code。

## 3. 调用约定

### 3.1 Planner 的输出 JSON

```json
{
  "task_type": "recovery_analysis",
  "steps": [
    {
      "id": "s1",
      "tool": "sql_query",
      "params": { "query_template": "last_14_snapshots", "project_id": "..." }
    },
    {
      "id": "s2",
      "tool": "sql_query",
      "params": { "query_template": "top_delays", "project_id": "...", "limit": 10 },
      "depends_on": ["s1"]
    },
    {
      "id": "s3",
      "tool": "llm_generate",
      "prompt_ref": "prompts/delay_root_cause_analyzer.md",
      "depends_on": ["s1", "s2"]
    },
    {
      "id": "s4",
      "tool": "llm_generate",
      "prompt_ref": "prompts/generator.md",
      "depends_on": ["s3"]
    },
    {
      "id": "s5",
      "tool": "llm_generate",
      "prompt_ref": "prompts/evaluator.md",
      "depends_on": ["s4"]
    }
  ],
  "expected_sla_s": 240
}
```

### 3.2 Evaluator 的决策矩阵

| 检查项 | 通过条件 | 否则 |
|---|---|---|
| 引用合规 | 每条纠偏建议引用至少 1 个 GB 标号 | reject |
| 数值一致 | △工期 / △成本 / CPI/SPI 自洽 (不矛盾) | reject |
| 影响面完整 | 覆盖下游 activity 的 predecessors 链 | flag + pass |
| 风险等级 | 合理 (与 09-risk_analysis 的风险登记对齐) | flag + pass |
| 整改触发 | 如根因是质量 · 必须 trigger 02-quality 的 RO 流程 | reject |

## 4. Prompt 模板原则 (宪法 §14 "约束优于指导")

每个 prompt 必须:
- 明确告诉模型"不能做什么"(例: 不能编造 GB 标号 · 不能改合同金额 · 不能自评通过)
- 引用 `GLOSSARY.md` 统一术语(中文 / 英文)
- 输出结构化 JSON · 前端好渲染 · evaluator 好检查
- SLA 预算显式声明(模型看预算就知道能思考多久)

## 5. 测试规范 (Stage 2 后跟上)

每个 prompt 必须:
- 有 3+ 个黄金样本(input → expected output JSON) · 放 `tests/snapshots/`
- 有 1+ 反例(故意带错误的 input · 期待 evaluator 拒绝) · 放 `tests/adversarial/`
- 回归测试每周跑一次 · CI 合入

## 6. 版本管理

prompt 改动 · SemVer:
- patch: 措辞 / 细节修正
- minor: 输出结构变化(兼容老字段)
- major: 输出结构不兼容

Prompt 文件头部放 `version: x.y.z` 与 `last_edit: YYYY-MM-DD`。本次全部 `0.1.0 · 2026-04-23`。

---

version: 0.1.0 · 2026-04-23
