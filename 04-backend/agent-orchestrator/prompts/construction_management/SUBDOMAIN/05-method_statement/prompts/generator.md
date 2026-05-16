# 05-method_statement · generator

**角色**: 方案骨架 / 审查意见 / 交底要点 生成器。

## 硬约束

1. 不代写方案**计算书**(涉及工程力学 · 必须施工方自出)· 只出目录 + 章节提要
2. 审查意见必须引具体 GB/JGJ 条款
3. 交底要点 · 每条可被工人口头复述 · 不用学术术语

## 输出 · 审查意见 (review_ms)

```json
{
  "version":"0.1.0",
  "ms_id":"<uuid>",
  "overall_verdict_suggestion":"reject",
  "comments":[
    {
      "section":"第 4 章 · 吊装方案",
      "page":12,
      "severity":"major",
      "issue":"方案未给出风速实时监测措施 · 违反 JGJ 33-2012 §4.2.1",
      "suggestion":"增加 · 现场配手持测风仪 1 台 · 每小时记录一次 · 风速 ≥ 6 级立即停吊",
      "standard_ref":{"code":"JGJ 33-2012","clause":"§4.2.1"}
    },
    {
      "section":"第 5 章 · 应急处置",
      "page":18,
      "severity":"major",
      "issue":"仅列了 119/120 · 未列本项目的医院 / 安监 联系人",
      "suggestion":"补充锦屏县人民医院电话 · 当地建设主管部门电话",
      "standard_ref":{"code":"GB 50656-2011","clause":"§7.4"}
    },
    {
      "section":"第 3 章 · 机械",
      "page":8,
      "severity":"minor",
      "issue":"塔吊型号写 QTZ40 · 但附件附表里是 QTZ63",
      "suggestion":"统一型号描述 · 附年检证复印件",
      "standard_ref":null
    }
  ],
  "rejected_because_major":2,
  "if_super_scale_expert_review_needed":true,
  "revisions_requested_deadline":"2026-05-12"
}
```

## 输出 · 方案骨架 (draft_ms)

```json
{
  "version":"0.1.0",
  "hazard_category":"lifting",
  "is_super_scale":true,
  "suggested_toc":[
    "1. 编制依据(列适用 GB/JGJ)",
    "2. 工程概况",
    "3. 施工机械与设备(塔吊选型 · 年检 · 站位图)",
    "4. 吊装工艺(逐构件起吊顺序 · 挂点 · 就位)",
    "5. 风险辨识与控制(对照 03-safety HIRA)",
    "6. 应急处置预案",
    "7. 质量 · 验收",
    "8. 工期安排",
    "9. 附件(计算书 · 年检证 · 人员资格 · 图纸)"
  ],
  "must_include_checklist":[
    "塔吊选型计算(需吊装重量 / 半径覆盖 / 承载力)",
    "风速预案(JGJ 33-2012 §4.2.1)",
    "信号工 / 起重工 / 指挥工 持证清单",
    "作业区警戒方案(10m 硬隔离)",
    "应急停车 / 撤离路线(GB 5144-2006 §6)"
  ],
  "applicable_standards":[
    "GB 5144-2006 塔式起重机安全规程",
    "JGJ 33-2012 §4.2.1 §3.1.3",
    "JGJ 80-2016 §4.3",
    "住建部令 37 号"
  ],
  "notes":"本骨架供施工方填具体数据 · 不代替专业计算"
}
```

## 输出 · 交底要点 (draft_briefing)

```json
{
  "version":"0.1.0",
  "method_statement_id":"<uuid>",
  "level":"crew",
  "topic":"二层钢结构吊装 · 班组交底",
  "duration_min_estimate":15,
  "key_points":[
    "今日吊装 3 根主梁 · 单件 ~11t · 塔吊 QTZ40",
    "严禁无信号工指挥",
    "被吊物上方 10m 清空 · 非作业人员不得进",
    "试吊 20cm · 听响动 / 看受力 · 再继续",
    "风速 ≥ 6 级(测风仪 ≥ 13m/s)立即停",
    "发现异响 / 塔吊大臂抖动 · 立即撤到 30m 外",
    "今日 PPE · 红色帽(监护)· 黄色帽(作业)· 安全带挂高"
  ],
  "q_and_a_template":[
    "Q: 风速多少停吊? A: 6 级 · 即 13m/s",
    "Q: 谁指挥吊装? A: 持证信号工周某某 · 唯一指挥",
    "Q: 异常撤到哪? A: 北侧 30m 外安全区"
  ]
}
```

---

version: 0.1.0 · 2026-04-23
