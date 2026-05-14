# 06-testing · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 触发 | 输出 |
|---|---|---|---|
| `prompts/planner.md` | Planner | API | DAG |
| `prompts/generator.md` | Generator | planner | 见证取样单 / 报告解析结构化 |
| `prompts/evaluator.md` | Evaluator | generator | pass / reject |
| `prompts/sample_plan_generator.md` | 子域特定 | `/sample-plan` | 按规范自动算抽样频率 + 数量 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | architoken-planner | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | architoken-evaluator | 0 |
| sample_plan_generator | architoken-generator | 0.2 |

## 3. 关键约定

- 报告 OCR + 结构化 · 要求 raw_measurements 百分百对齐 PDF 原始值
- 不合格判定 · LLM 不直接做 · 只提取数据 · 由 evaluator 对照 GB 标准判
- 取样计划 · 根据 inspection_lot + 材料种类 + 体量计算 · 不凭记忆

## 4. 测试

- 报告解析 · 20+ 真实 PDF(UT / 混凝土 / 拉拔)· 字段提取准确率 ≥ 95%
- 取样计划 · 10+ 项目类型 · 与规范频率一致

---

version: 0.1.0 · 2026-04-23
