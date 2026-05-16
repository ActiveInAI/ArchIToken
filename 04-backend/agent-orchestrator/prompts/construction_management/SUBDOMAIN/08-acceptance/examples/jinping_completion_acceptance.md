# Example · 锦屏 · 6/12-6/14 竣工验收

---

## 1. 时间线

- 6/9 · 防雷专项通过
- 6/10 · 消防专项通过
- 6/11 · 节能专项通过
- 6/12 09:00 · sub_part 8 分部全 pass · unit_project rollup
- 6/12 10:00 · 监理出工程质量评估报告 JP-QAR-2026-0001
- 6/12 15:00 · 五方邀请发出
- 6/13 14:00 · 联合验收会
- 6/13 16:30 · 五方签字(勘察单位赵工延至 6/14 08:00 补签)
- 6/14 09:00 · handover_certificate JP-HC-2026-0001 开具
- 6/14 - 7/4 · 15 工作日备案窗口

## 2. 6/12 10:00 · 质量评估报告

planner → generator 180s 出草稿 · 张总监审阅修改 20 分钟 · PDF 导出。

核心结论:
> 本工程施工质量满足设计及 GB 50300-2013 等相关规范要求。各分部分项工程验收合格。建议建设单位按 建质〔2013〕171 号 组织竣工验收。

## 3. 6/12 15:00 · 五方邀请

five_parties_signoff_orchestrator stage=invite:
- 生成 5 封邀请邮件(公文腔)
- 附件清单 7 项
- 会前准备清单 6 项
- 邮件自动发出(走企业邮箱)

## 4. 6/13 14:00 · 联合验收会

议程执行:
- 14:00 - 14:10 业主开场
- 14:10 - 14:30 监理质量评估报告
- 14:30 - 14:45 施工竣工报告
- 14:45 - 15:15 现场核查(除设计王工视频 · 其他 4 方到场)
- 15:15 - 15:35 设计王工视频评议
- 15:35 - 16:05 讨论
  - 发现 2 处 conditional · 色差 + 散水
- 16:05 - 16:30 签字(四方现场签 · 勘察赵工邮寄)

## 5. 6/13 16:30 · 签字进度跟踪

orchestrator stage=track:
```json
{"signoff_progress":{
  "owner":{"signed":true},
  "contractor":{"signed":true},
  "supervisor":{"signed":true},
  "designer":{"signed":true},
  "geotechnical":{"signed":false,"reason":"赵工已口头同意 · 邮寄签字中"}
}}
```

6/14 08:00 · 赵工签字 PDF 收到 · 扫描上传 · all_signed=true。

## 6. 6/14 09:00 · handover_certificate 开具

- cert_no:JP-HC-2026-0001
- type:completion
- final_acceptance_date:2026-06-13
- filing_deadline:2026-07-04 (15 自然日 · 简化)
- 签字齐:owner + contractor + supervisor + designer + geotechnical

acceptance_record(target=unit_project)· verdict=conditional(2 conditional_items)
→ 自动变为 handover 的 "附条件通过"。

## 7. 6/14 10:00 · orchestrator stage=close

生成会议纪要 PDF · 列 conditional_items 与 due date · 分发五方。

## 8. 6/18 · 散水修正闭环

施工方按期修正 · 照片留痕 + 监理复查 · conditional_items[0] 标 closed。

## 9. 6/20 · 色差修补闭环

同上 · conditional_items[1] closed · 整体 conditional → accepted 转化。

## 10. 6/22 · 备案

建设单位携完整材料到县建设主管部门备案:
- 质量评估报告
- 竣工证书
- 5 方签字单
- 全部 8 分部验收记录
- 消防 / 节能 / 防雷 专项
- 2 个 conditional 闭环证据

filing_completed_at = 2026-06-22(距 deadline 7/4 还有 12 日 · 无风险)。

## 11. 后续触发

- 6/23 · 启动 digital_archive 归档流程(28 日批次)
- 6/23 · 启动 digital_twin 运维数据流
- 7/4 · 备案正式公示 · 项目官方"竣工"

## 12. 回顾

- 全程 · 5/1 开工 · 6/13 验收 · 6/22 备案 · 45 日工期 + 9 日备案
- 监理节省 · 质量评估报告草稿 LLM 90% 完成 · 比手写快 2 天
- 五方协调 · 邮件自动发 · 签字进度实时看板 · 比微信群效率高 3 倍
- 零违约金 · 完整合规 · digital_archive 副本齐全 · 可复盘 / 可举证

---

version: 0.1.0 · 2026-04-23
