# Example · 锦屏 · Day 7 · 5/19 完整日志

**场景**: 2026-05-19 17:30 · 系统自动触发 daily_summary_generator · 5 分钟内监理签认。

---

## 1. 17:30:00 · Scheduler 触发

pg_cron 每日 17:30 调 `/v1/csr/daily-log/daily-summary?project_id=...&date=2026-05-19`。

## 2. Planner 输出

```json
{"task_type":"daily_summary","steps":[...7 步...]}
```

## 3. SQL 上游输出(节选)

- patrols · 3 条(08:30 / 13:00 / 16:30)
- monitoring_posts · 1 条(A1210 · 07:00-09:30)
- parallel_inspections · 1 条(UT W-208 · fail)
- defects · 1 条(夹渣 · major)
- rectifications · 2 条事件(issued · closed)
- weather · 上午晴 19°C · 下午多云 25°C

## 4. daily_summary_generator 输出

(body · summary · key_events · 见 prompt 示例结构 · 完整内容写入 `supervision_logs`)

## 5. Evaluator 结论

```json
{
  "evaluator_verdict":"pass_with_flags",
  "overall_score":0.90,
  "flags_notes":"下午 PM 段可更具体 · 但不阻塞签发"
}
```

## 6. 17:30:45 · 写 `supervision_logs.draft`

数据库 INSERT · patrol_count=3 · monitoring_post_count=1 · parallel_inspection_count=1 · rectification_issued=1 · rectification_closed=1。

## 7. 17:31 · 推送监理

微信 / 企业微信通知 张总监:
> [监理日志] 锦屏 Day 7 日志草稿已生成 · 请审阅签认
> [进入 App 审阅](deep-link)

## 8. 17:35 · 张总监审阅

打开 `<DailyLogReviewer />`:
- 左侧 · 当日 7 个记录一览
- 中间 · AI 生成的 body(Markdown)
- 右侧 · 修改建议区

快速修改:
- 下午 PM 段加一句 "14:00 复查 W-208 复焊外观合格"
- 明日计划里 "已签发 lifting 作业许可 JP-WP-LIFT-2026-0032" → "已签发 · 00:00 起效"

## 9. 17:38 · 点"签认"

- 前端 POST `/v1/csr/daily-log/supervision-logs/{id}/sign`
- 后端写 signed_by · signed_at = 17:38
- 锁定:body 禁止再改 · 只能追加 addendum(审计留痕)
- pgmq 消息 · digital_archive 月底批次归档

## 10. 17:40 · 归档准备

消息链:
- `csr.supervision_logs` → `digital_archive.archive_items` 候选清单
- 等月底归档批次跑 · 5/31 23:00 执行

## 11. 产出

- 日志 id: `<uuid>`
- body 长度:825 字
- 编辑次数:2(小修)
- 从 AI 生成到签认:8 分钟
- 对比 AI 之前的手写日志:平均耗时 35 分钟 → 省 27 分钟

## 12. 后续

- 本日日志成为 digital_archive 的第 7 条监理资料
- 月报 5/31 生成时自动汇总本日数据
- 关键事件(UT 不合格 → A5 闭环)进入"典型案例库" · 供培训新监理用

---

version: 0.1.0 · 2026-04-23
