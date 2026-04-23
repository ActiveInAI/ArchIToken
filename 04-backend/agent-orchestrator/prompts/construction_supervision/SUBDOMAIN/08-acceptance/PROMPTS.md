# 08-acceptance · PROMPTS

---

## 1. 清单

| 文件 | 角色 | 触发 | 输出 |
|---|---|---|---|
| `prompts/planner.md` | Planner | API | DAG |
| `prompts/generator.md` | Generator | planner | 验收记录 / 隐蔽记录 / 质量评估报告草稿 |
| `prompts/evaluator.md` | Evaluator | generator | pass / reject |
| `prompts/five_parties_signoff_orchestrator.md` | 子域特定 | `/five-parties-signoff-orchestrator` | 协调五方签认(邀请 + 进度追踪 + 纪要) |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | Claude Opus 4.7 | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | Claude Opus 4.7 | 0 |
| five_parties_signoff_orchestrator | Claude Opus 4.7 | 0.2 |

## 3. 关键约定

- 工程质量评估报告:LLM 汇总监理月报 + 全部 sub_part 验收记录 + 整改历史 · 出专业稿
- 五方邀请信件:中文公文格式 · 自动含验收日议程 / 会前准备清单
- 不代替任何一方签字 · 只追踪

---

version: 0.1.0 · 2026-04-23
