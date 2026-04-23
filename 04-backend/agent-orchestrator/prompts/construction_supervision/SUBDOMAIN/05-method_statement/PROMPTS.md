# 05-method_statement · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 触发 | 输出 |
|---|---|---|---|
| `prompts/planner.md` | Planner | API | DAG |
| `prompts/generator.md` | Generator | planner | 方案骨架 / 审查意见草稿 / 交底要点 |
| `prompts/evaluator.md` | Evaluator | generator | pass / reject |
| `prompts/expert_review_facilitator.md` | 子域特定 | `/expert-review/facilitate` | 会议议程 / 实时摘要 / 终纪 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | Claude Opus 4.7 | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | Claude Opus 4.7 | 0 |
| expert_review_facilitator | Claude Opus 4.7 | 0.2 |

## 3. 关键约定

- 方案生成 · 只出 **骨架 + 章节提要** · 不代替施工单位写具体计算
- 审查意见 · 基于 GB/JGJ 条款 · 引用具体
- 论证辅助 · 只做会议组织 + 摘要 · **不代替专家判断**

## 4. 测试

- 方案审查 · 3+ 黄金样本(吊装 / 脚手架 / 模板)
- 论证会议纪要转写 · 3 段真实录音样本

---

version: 0.1.0 · 2026-04-23
