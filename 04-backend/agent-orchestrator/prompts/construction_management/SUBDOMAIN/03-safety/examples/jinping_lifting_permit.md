# Example · 锦屏 · Day 12 · 二层钢梁吊装作业许可

**场景**: 2026-05-12 06:30 · 今日主工作:二层 B×5-B×7 主梁吊装。
早 7:00 班前会前 · 必须出具 lifting 作业许可(双签)。

---

## 1. 06:35 · 现场背景

- 天气:晴 · 风速 3 级(测风仪实测 4.8 m/s)
- 塔吊:QTZ40 · 年检有效期至 2026-09
- 三根主梁已由 07-inspection_lot 完成进场验收
- 材料堆料区域已清场 · 架子工昨日完成脚手架复查

## 2. 06:40 · foreman 在 App 申请

`<WorkPermitWizard />` 步骤:
1. 类型 → lifting
2. 范围 → 二层 B×5~B×7 · 3 根主梁
3. BIM 选中 → 3 个 GUID: `2A3K9XYZABCDEF12367/68/69`
4. 时间 → 2026-05-12 09:30 - 11:30(2h)
5. 点"AI 辅助填充风险控制"→ 调 planner → generator

## 3. 06:40:30 · Generator 输出

(见本子域 generator.md 示例结构 · 完整填 risk_controls · ppe · checklist · emergency)

内容要点:
- 5 条 risk_controls(塔吊年检 · 风速 · 警戒 · 信号工 · 试吊)
- PPE 6 项(红黄安全帽 + 安全带 + 反光衣 + 钢头鞋 + 手套)
- pre_start_checklist 5 项
- emergency 2 场景
- 引用 GB 5144-2006 · JGJ 33-2012 · JGJ 80-2016

## 4. 06:41 · Evaluator 审查

```json
{
  "evaluator_verdict":"pass_with_flags",
  "overall_score":0.88,
  "flags_notes":"与上午架子工拆卸复查 09:00-10:00 区域重叠 · 建议错峰"
}
```

## 5. 06:45 · Supervisor 签字

张工(总监) 在 `<WorkPermitListToday />` 打开许可草稿:
- 复核 5 条 risk_controls 成立
- 核对 standards_cited 全部在 standard_library 可查
- 点击"监理签字" · supervisor_approved_by = 张工 ID · supervisor_approved_at = now()
- flag 建议:与架子工班组长沟通错峰 · 约 09:30 开始不冲突

## 6. 06:50 · Safety Officer 签字

李工(安全员)复核:
- 塔吊检验报告再看一眼(uri 链接)
- 测风仪电量正常(扫码确认)
- 吊装区 10m 警戒标识已预置
- 点"安全员签字" · 进入 status = approved

## 7. 07:00 · 班前会

`<ToolboxTalkForm />` 关联许可 id 自动带出要点:
- 今日吊装三根主梁
- 风速超 6 级立停
- 信号工:周工 · 证号 XXX
- 严禁无证起重作业

参会 9 人 · 全部扫码签到(签到流入 attendees JSONB)。

## 8. 09:30 · 实际开始吊装

foreman 在 App 上点"开始作业" · 前端调 `/work-permits/{id}/start` · `actual_start_at = now()` · status = active

## 9. 吊装全程

- 09:38 · 第 1 根主梁就位 · 受力确认 · 信号工无线电全程记录
- 10:05 · 第 2 根主梁就位
- 10:40 · 第 3 根主梁就位 · 第三阶段暂停 5 分钟 · 测风仪显示瞬间 6.1m/s · 等待 3 分钟下降到 4.5m/s 继续
- 11:10 · 全部就位 · 焊接点位由焊工小组接手

## 10. 11:15 · 许可关闭

foreman 点"结束作业":
- actual_end_at = 11:10:00
- close_remarks = "3 根主梁按计划完成 · 中段 1 次风速预警 5 分钟无实际影响 · 无人员/设备损伤"
- 上传吊装完成后照片 3 张

status → closed · `supervision_logs` 自动追加本事件。

## 11. 归档与回顾

- 该许可自动归档到 `digital_archive` 模块(Stage 后期)
- incidents · 本次无 · 计入"无事故天数"计数
- 04-daily_log · 当日监理日志收录本次吊装的旁站记录 + 许可 + 班前会 三个记录

---

version: 0.1.0 · 2026-04-23
