# 04-daily_log · PROMPTS

4 个 prompt · 三角色 + `daily_summary_generator.md`。

---

## 1. 清单

| 文件 | 角色 |
|---|---|
| `prompts/planner.md` | Planner |
| `prompts/generator.md` | Generator(单项记录 · 旁站/巡视/例会) |
| `prompts/evaluator.md` | Evaluator |
| `prompts/daily_summary_generator.md` | **核心** · 全天汇总 |

## 2. 模型路由

| 角色 | 模型 | 温度 |
|---|---|---|
| Planner | Claude Opus 4.7 | 0.1 |
| Generator | Gemma 4-E4B-it | 0.3 |
| Evaluator | Claude Opus 4.7 | 0 |
| daily_summary_generator | Claude Opus 4.7 | 0.2 |

## 3. 调用约定

### 17:30 自动触发汇总
Scheduler 每日 17:30 对每个 active 项目调 `/v1/csr/daily-log/daily-summary`:
- planner → daily_summary_generator → evaluator
- 产出 supervision_log.draft
- 推送监理的 inbox

### 监理签认路径
前端调 `/v1/csr/daily-log/supervision-logs/{id}/sign`
- 后端校验 · signed_by 必须 total_supervisor 角色
- 写 signed_at · 锁 edit
- pgmq 发 "log signed" → 归档准备

## 4. 输出一致性

- daily_summary_generator 的 body 是 **Markdown** · 直接能 render · 不是纯文本
- 引用其它子域事件 · 必须 ref_id 点击跳转
- 月报同样走 LLM · 但用独立 prompt (未列 · Stage 3)

## 5. 测试

- daily_summary · 从 10 个真实日的记录集输入 · 期望 body 长度 300-1200 字 · 关键事件不漏
- meeting_minutes 转写 · Whisper v3 + Claude 后处理 · 测试 5 段中英混合录音

---

version: 0.1.0 · 2026-04-23
