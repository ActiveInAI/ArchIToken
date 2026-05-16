# Example · 锦屏 · 雨季风险登记 · 暴雨触发停工

---

## 1. 5/15 · 风险识别

项目开工前 · 监理提出"雨季山洪停工" · 用 register_risk prompt 辅助。

### 1.1 LLM 建议

- L=6 · E=6 · C=15 → LEC=540 → **critical**
- 对策:mitigate
- controls 3 项(排水 + 监测 + 预警)
- 残余 LEC ≈ 180

### 1.2 部署监测点位

因 critical · 必须监测:
- JP-MP-2026-0008 · 气象雨量监测点
- 设备 · ACME 雨量计 v2 · MQTT 推送
- 阈值 · warning 30mm/h · alarm 50mm/h

### 1.3 编制应急预案

JP-EP-2026-0003 · 雨季山洪应急预案:
- 6 步 procedures · 总响应时间 ≤ 25 分钟
- muster point · A 区东北高地
- 联系电话 5 个(120/119/防汛办/监理/电网)

5/17 · supervisor 审批通过 · status=active。

## 2. 5/17 · 蒙特卡洛模拟

前端 `<MonteCarloDashboard />` 触发:
```json
{"iterations":10000,"seed":42,"risks":[<雨季风险>,<材料延迟>,...]}
```

Rust mc_simulate 跑 10000 次 · 输出:
- p50 完工 2026-06-15(基线 2026-06-14 · 晚 1 日)
- p90 完工 2026-06-19(晚 5 日)
- probability_on_time 0.62
- top_driver #1 · 雨季停工(贡献 34%)

监理建议:
- 合同已含工期顺延条款 · OK
- 基于 p80 = 48.3 · 合同工期保留 3 日缓冲(已有)

## 3. 5/30 - 5/31 · 第一次触发(warning)

5/30 · 雨量计测得 34mm/h · 超 warning 阈值 30mm/h。
系统告警 · 通知张总监 · 自检无险情。
5/31 · 雨量 38mm/h · 持续 3h · 超 warning · 但未到 alarm。
全天停工 1 日 · 未启动预案。

## 4. 6/11 14:00 · 第二次触发(alarm)

雨量计测得 58mm/h · **超 alarm 阈值**。
系统自动触发 emergency_plan JP-EP-2026-0003:

- 14:00:00 · MQTT 告警 · pgmq 消息
- 14:00:01 · 值班员广播(step 1)
- 14:00:30 · 施工全停(step 2)
- 14:10 · 工人到齐 A 区集合点(step 3)
- 14:15 · 清点 22 人齐 · 通知监理(step 4)
- 14:20 · 塔吊回转零位 · 断电(step 5)
- 14:30 · 现场安全 · 开始持续监测(step 6)

14:30 - 16:30 · 持续暴雨 · 雨量 40-65mm/h。
16:30 · 雨量降到 20mm/h · 安全阈下。
16:30 - 18:30 · 连续 2h 低于 warning · 恢复标准达成。

## 5. 6/12 07:00 · 复工

次日晨 · 检查现场(排水沟满但未冲刷)· 塔吊检查 OK · 临电检查 OK。
07:00 正式复工。

## 6. 影响记录

- `risk_entries.realized_at` = 2026-06-11 14:00
- `realized_impact` = {"停工小时":17,"损失_cny":3200,"人员伤亡":0}
- risk status → realized → 6/12 处置完成 closed

## 7. 对 01-progress 的影响

见 01-progress 的 Day 6 场景:
- 01-progress 纠偏分析 · 雨季成为延误根因之一(贡献 1.5 日)
- 12-change_order · 工期顺延 1.5 日 · 基于 FIDIC §8.5 · 气象局证明
- 最终按期竣工

## 8. 演练

- 9/15 · 下一次预案演练(180 日后)
- 9/08 · 到期前 7 日 · 系统自动提醒
- 9/15 组织 · 参演 15 人 · 记录影像 + 过程 · update last_drill_at

---

version: 0.1.0 · 2026-04-23
