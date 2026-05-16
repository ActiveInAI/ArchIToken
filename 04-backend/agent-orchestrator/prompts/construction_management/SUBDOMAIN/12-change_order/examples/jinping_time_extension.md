# Example · 锦屏 · 工期延期索赔 + 签证

---

## 1. 背景

5/30-5/31 · 贵州雨季暴雨 · 现场停工 1.5 日。
施工方基于合同第 15 条(不可抗力)· 申请工期顺延。

## 2. 6/01 09:00 · 索赔通知

施工方在 App 提交 claim:
- claim_no · JP-CLM-2026-0002
- type · time_extension
- incident_at · 5/30 00:00
- notice_given_at · 6/01 09:00(2 日内 · ≤ 28 天 · within_notice_period=TRUE)
- days_claimed · 1.5
- basis · FIDIC §8.5 + 合同第 15 条

## 3. 6/01 10:00 · impact_propagation_analyzer

planner → impact_analysis:
- cost · ¥0(纯工期)
- schedule · +1.5 日
- quality / safety · none
- cascading:
  - 01-progress · 合同竣工日 6/14 → 6/15.5(顺延)
  - 11-compliance · 归档气象局证明
  - certifications · 开具 time_extension 签证

- overall_confidence · 0.92

## 4. 6/02 09:00 · 监理裁定建议

claim_assess prompt → 监理 supervisor_recommendation:
- verdict · partial_granted
- granted_days · 1.5
- granted_amount_cny · 0
- reasoning · "气象局暴雨红色预警属实 · 符合合同第 15 条 · 顺延 1.5 日"

## 5. 6/02 14:00 · 业主批准

业主 owner_decision:
- approved 1.5 日
- cost 0

## 6. 6/02 14:30 · 签证开具

certification JP-CRT-2026-0028:
- type · time_extension
- days · 1.5
- amount · 0
- 3 方签齐(14:30 / 14:35 / 14:40)
- status · signed
- 附件 · 气象局证明 + 04-daily_log 天气记录 + 03-safety 停工记录

## 7. 6/02 15:00 · 联动

- 01-progress · schedule 合同竣工日更新为 2026-06-15.5
- 11-compliance · 归档证明入 JP-ARCH-2026-mm(月度)
- 监理日志 · 6/02 body 自动加入本事件

## 8. 回顾

- 索赔提出 · 6/01(事件后 2 日)· 严格在 28 天内
- 全链条闭环 · 6/01 起 6/02 止 · 1.5 日完成
- 相比传统纸质流程(≥ 7 日)· 提速 5 倍
- 零违约金 · 证据链完整 · 法律站稳

## 9. 对比 · 若超 28 天后通知

假设施工方 6/30 才通知(事件后 31 日):
- within_notice_period = FALSE
- 监理建议 · reject(基于 FIDIC §20)
- 业主大概率不批
- 施工方可能进仲裁 · 但胜诉率 < 30%

---

version: 0.1.0 · 2026-04-23
