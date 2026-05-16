# 11-compliance · regulation_diff_detector

**角色**: 法规变更差异检测 · 子域特定。
**输入**: 两版本 standard(旧版 / 新版)· 或 · 住建部新发布的公告文本。
**输出**: 差异清单(added / changed / removed)+ 影响评估。

## 输入

```json
{
  "old_version":{
    "standard_code":"GB 50411-2009",
    "effective_from":"2010-10-01",
    "clauses":[ {"no":"§6.1.1","text":"...","is_mandatory":true} ]
  },
  "new_version":{
    "standard_code":"GB 50411-2019",
    "effective_from":"2020-08-01",
    "clauses":[ {"no":"§6.1.1","text":"...(修订)","is_mandatory":true} ]
  },
  "affected_projects":["<project id · 锦屏>"]
}
```

## 硬约束

1. 不猜 clause 对应关系 · 必须按 no + 语义相似度匹配
2. 语义相似度 · 调 `vector_search`(pgvector cosine · 阈值 0.80)
3. 不省略 clause_text · 保留原文
4. changed 必给 diff markdown · 不只说"修改了"

## 输出

```json
{
  "version":"0.1.0",
  "diff_at":"ISO-8601",
  "old_standard":"GB 50411-2009",
  "new_standard":"GB 50411-2019",

  "summary":{
    "added":4,
    "changed":12,
    "removed":2,
    "mandatory_changes":6,
    "mandatory_new":3,
    "mandatory_removed":0
  },

  "added_clauses":[
    {
      "no":"§6.3.5",
      "text":"外墙保温材料必须为 A 级不燃材料",
      "is_mandatory":true,
      "impact":"本项目如使用 B1 级保温 · 需更换或走变更"
    }
  ],

  "changed_clauses":[
    {
      "no":"§6.1.1",
      "old_text":"围护结构传热系数 K ≤ 0.6 W/(m²·K)",
      "new_text":"围护结构传热系数 K ≤ 0.45 W/(m²·K)",
      "is_mandatory":true,
      "diff_md":"- K ≤ **0.6** W/(m²·K)\n+ K ≤ **0.45** W/(m²·K) (更严格)",
      "retroactive_risk":"high",
      "retroactive_reason":"已施工围护结构设计按 0.6 · 若强制回溯 · 需加保温或换材料",
      "recommended_action":"供法务 + 设计咨询 · 确认是否可按"项目开工时版本"继续"
    }
  ],

  "removed_clauses":[
    {
      "no":"§8.2.3",
      "text":"(已作废)",
      "note":"新规统一到 §8.2.1 · 无实质影响"
    }
  ],

  "retroactive_check_required":true,
  "retroactive_scope":{
    "sub_parts_affected":["建筑节能"],
    "inspection_lots_count":18,
    "existing_verdicts_to_review":"全部 accepted lot 的节能分部项目"
  },

  "recommendations":[
    "立即咨询锦屏县住建局 · 确认本项目适用版本(开工版 or 当前版)",
    "若按新版执行 · 预计需要 · 换保温板 + 重测 K 值 · 成本 ¥12,000 · 工期 3 日",
    "若按开工版执行 · 需在档案中显式声明 · 防未来查询"
  ]
}
```

## 反模式

- ❌ "内容大致相同"(必须具体 diff)
- ❌ changed 只写条款号 · 不带 text
- ❌ retroactive_risk 用"可能有影响"(必须 high/medium/low)

---

version: 0.1.0 · 2026-04-23
