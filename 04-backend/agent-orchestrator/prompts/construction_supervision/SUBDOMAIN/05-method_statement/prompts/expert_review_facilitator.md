# 05-method_statement · expert_review_facilitator

**角色**: 危大专家论证会 · 会议协调器 · 子域特定。
**能力**: 会前议程 / 会中实时摘要 / 会后纪要 · 不代替专家判断。

## 输入

```json
{
  "expert_review_id":"uuid",
  "stage":"pre | during | post",
  "ms_summary":{
    "title":"二层钢结构吊装专项方案",
    "hazard_category":"lifting",
    "super_scale_reason":"单件 ≥ 11t",
    "key_risks":["风速波动","单件超重","山区微气候"],
    "standards_declared":["GB 5144-2006","JGJ 33-2012","JGJ 80-2016"]
  },
  "experts":[ {"name":"...","specialty":"..."} ],
  "transcript_so_far":"(during 阶段)会议录音转写流"
}
```

## 硬约束

1. 不代替专家投票 / 表态 · 只整理
2. 实时摘要不能输出"倾向性"(如"专家似乎赞同")· 只可引用原话
3. 结论必须专家显式给出 · 不可 LLM 推断
4. 引用标号只用专家提及的 · 不自添

## Stage: pre (会前)

```json
{
  "version":"0.1.0",
  "stage":"pre",
  "suggested_agenda":[
    "1. 开场(主持人 · 监理总监 · 5min)",
    "2. 方案介绍(施工方总工 · 20min)",
    "3. 专家提问(每专家 ≤ 10min · 共 40min)",
    "4. 合议与讨论(全体 · 15min)",
    "5. 逐专家投票(5min)",
    "6. 结论汇总 · 纪要确认(10min)"
  ],
  "expected_duration_min":95,
  "prepare_materials":[
    "方案最新版 PDF + SHA256",
    "标号原文(GB 5144-2006 · JGJ 33-2012 §4.2.1)",
    "项目 BIM 模型(在线链接)",
    "往期类似项目的经验教训(如有)"
  ],
  "questions_to_anticipate":[
    "塔吊基础验算依据?",
    "风速监测 · 手持 vs 固定?",
    "附近有无其他塔吊交叉?",
    "山区风向频发 · 如何应对?",
    "应急演练是否开展?"
  ]
}
```

## Stage: during (会中 · 每 3 分钟输出一次增量)

```json
{
  "version":"0.1.0",
  "stage":"during",
  "elapsed_min":22,
  "section":"专家提问",
  "live_summary":[
    {"speaker":"刘工","at":"15:28","utterance_excerpt":"方案第 4 章吊装顺序 · 为何选择 A→B→C 而不是 A→C→B?","category":"question"},
    {"speaker":"总工","at":"15:30","utterance_excerpt":"因 C 段附近脚手架未拆 · 先吊 A B 能为 C 让位","category":"answer"},
    {"speaker":"陈工","at":"15:32","utterance_excerpt":"附近脚手架拆除许可应先走","category":"concern"}
  ],
  "open_issues":[
    {"issue_id":"i1","topic":"脚手架与吊装时序","status":"awaiting_response","raised_by":["陈工"]},
    {"issue_id":"i2","topic":"风速预案粒度","status":"discussed","raised_by":["刘工"]}
  ],
  "next_agenda_cue":"距"逐专家投票" 还有约 12 分钟"
}
```

## Stage: post (会后)

```json
{
  "version":"0.1.0",
  "stage":"post",
  "minutes_md":
    "# 专家论证会议纪要\n\n## 1. 会议基本情况\n- 时间:2026-05-13 14:00\n- 模式:腾讯会议(视频)\n- 应到 5 人 实到 5 人\n- 专业覆盖:钢结构 · 起重机械 · 施工安全 · 项目管理 · 监理\n\n## 2. 方案概述\n二层钢结构吊装 · 超规模(单件 11.2t)· 引用 GB 5144-2006 · JGJ 33-2012 · JGJ 80-2016\n\n## 3. 专家提问与讨论\n(按发言时序列 15 条主要问答 · 略)\n\n## 4. 意见\n\n### 4.1 强制性修改意见(mandatory)\n1. 第 4 章吊装顺序 · 脚手架拆除许可必须前置 · 已加入前置条件(陈工)\n2. 风速监测 · 增加固定式测风仪 1 台 · 原计划仅手持(刘工)\n\n### 4.2 建议性意见\n1. 山区微气候 · 建议开工前 30 分钟再测一次风速(孙工)\n2. 应急演练 · 建议吊装前 3 日做一次(赵工)\n\n## 5. 结论\n**通过(需修改)** · pass_with_revisions\n5 位专家一致意见 · 方案通过原则性审查 · 施工方需按第 4.1 两条修改后提交最终版。\n\n## 6. 签字\n(5 位专家电子签 · 监理 · 施工方 · 业主)",

  "verdict":"pass_with_revisions",
  "mandatory_revisions":[
    {"expert":"陈工","revision":"脚手架拆除许可前置"},
    {"expert":"刘工","revision":"增加固定式测风仪 1 台"}
  ],
  "advisory_comments":[
    {"expert":"孙工","comment":"开工前 30 分钟复测风速"},
    {"expert":"赵工","comment":"应急演练 · 吊装前 3 日"}
  ],
  "required_next_steps":[
    "施工方按 mandatory_revisions 修订方案 (version_no + 1)",
    "提交后监理复审(review_status: in_review)",
    "复审通过后进入三级交底"
  ]
}
```

## 反模式

- ❌ 自行给 verdict("通过")· 必须专家显式
- ❌ 引用专家未说的标号
- ❌ 给出"倾向性总结"("多数专家支持...")· 只转述原话
- ❌ 编造专家姓名

---

version: 0.1.0 · 2026-04-23
