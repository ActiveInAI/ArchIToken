# Example · 锦屏 · 吊装专项方案 + 专家论证 + 三级交底

---

## 1. 时间线

- 5/10 · 施工方提交 JP-MS-2026-0005 v1
- 5/10 下午 · 监理审查 · 提 2 major 意见 · 退回
- 5/11 · 施工方提交 v2
- 5/11 下午 · 监理审查通过 · 标 super_scale
- 5/12 · 建立 expert_review JP-ER-2026-0002 · 邀请 5 专家
- 5/13 14:00 · 视频论证会 · verdict = pass_with_revisions
- 5/13 18:00 · 施工方提交 v3(按强制意见修订)
- 5/14 09:00 · 复审通过 · v3 effective
- 5/14 10:00-11:00 · company 级交底
- 5/14 14:00-14:40 · project 级交底
- 5/15 07:00 · crew 级交底 · 开工

## 2. 5/10 · v1 方案

主要内容:
- 塔吊 QTZ40 · 站位图 · 年检证附件
- 吊装顺序 A→B→C
- 风速预案 · 5 级停
- 信号工 / 起重工 清单

监理审查(张总监 + LLM 辅助):
```json
{
  "overall_verdict_suggestion":"reject",
  "rejected_because_major":2,
  "comments":[
    {
      "severity":"major",
      "issue":"风速 5 级停不符合 JGJ 33-2012 §4.2.1 要求(6 级)",
      "suggestion":"改为 6 级(13m/s)· 并加固定式测风仪"
    },
    {
      "severity":"major",
      "issue":"应急预案仅列 119/120 · 缺本项目 / 当地联系"
    }
  ]
}
```

## 3. 5/11 · v2 方案

修订:
- 风速预案 · 6 级停
- 应急预案 · 补充锦屏人民医院 0855-xxx / 县安监 0855-yyy

监理 review_status = approved。

但属 super_scale(单件 11.2t > 10t) · 必须专家论证。

## 4. 5/12 · 建立论证会

- JP-ER-2026-0002
- 5 位专家 · 专业 3 类(钢结构 + 起重机械 + 安全)
- 视频会议 · 腾讯会议链接

## 5. 5/13 14:00 · 论证会

facilitator 输出 · pre 阶段议程:
- 开场 5min · 方案介绍 20min · 专家提问 40min · 合议 15min · 投票 5min · 结论 10min
- 总计 95min

会中 facilitator 每 3 分钟输出增量 summary · 实时投屏。

会后 facilitator 出 minutes_md · verdict = **pass_with_revisions**:
- 强制修订 2 条 · 脚手架时序前置 · 固定测风仪
- 建议 2 条 · 开工前复测风速 · 应急演练

## 6. 5/13 18:00 · v3 方案

按 mandatory 两条修订:
- 第 4.1 章 · 吊装前置条件 · 脚手架拆除许可先出
- 第 3.2 章 · 设备清单 · 增加 1 台固定式测风仪

## 7. 5/14 09:00 · 复审通过

review_status = approved · expert_reviewed_at = 5/13 17:00 · final_ms_uri 更新。

## 8. 三级交底

### 5/14 10:00-11:00 · company 级(seq=1)
- giver · 贵州某钢构公司总工
- audience · 项目部 + 监理部 · 11 人
- 议题 · v3 方案全讲 · 60 分钟
- 录音 + 签字留痕

### 5/14 14:00-14:40 · project 级(seq=2)
- giver · 项目经理李工
- audience · 班组长 + 带班员 · 7 人
- 议题 · 分工 + 关键节点 · 40 分钟

### 5/15 07:00-07:20 · crew 级(seq=3)
- giver · 吊装班组长王工
- audience · 7 名作业工 + 2 名辅工 · 9 人
- 议题 · 今日 3 根主梁吊装 · 20 分钟
- 关键要点 · 见 generator.md 输出

## 9. 5/15 07:30 · 开工

- 方案 approved · 三级齐 · work_permit 申请流程畅通
- A1210 activity unblocked · 可以 start
- 首根主梁 08:00 起吊 · 全程监理旁站

## 10. 回顾

从 5/10 到 5/15 开工 · 5 日走完 v1-v3 + 论证 + 三级交底。
过程中:
- LLM 审查节省 ≈ 4 小时(总监原本要完整读 3 遍)
- 论证 facilitator 的实时摘要 · 帮助远程专家把握节奏
- 交底要点自动生成 · 班组长只需补充项目特定细节

**Day 15 开工 · 整个吊装施工 3 天完成 · 零事故**。

---

version: 0.1.0 · 2026-04-23
