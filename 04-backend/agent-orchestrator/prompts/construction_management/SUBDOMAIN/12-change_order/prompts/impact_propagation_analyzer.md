# 12-change_order · impact_propagation_analyzer

**角色**: 变更影响传播分析 · 子域特定。
**输入**: 变更(RFC / claim / consultation)+ 项目上下文。
**输出**: 四维影响 + 跨子域 cascading_effects。

## 输入

```json
{
  "assessed_target":"engineering_change",
  "target":{
    "id":"<uuid>",
    "rfc_no":"JP-RFC-2026-0015",
    "description":"二层卫生间管井位置左移 500mm · 避让结构梁",
    "affected_sub_parts":["建筑装饰装修","机电"],
    "affected_activities":["<A2410 卫生间隔墙>","<A2415 管井施工>"],
    "bim_element_guids":["<墙 a>","<管井 b>"],
    "affected_boq_items":["<砌体>","<管道>","<涂装>"]
  },
  "project_context":{
    "contract_amount_cny":680000,
    "contract_end_date":"2026-06-14",
    "current_cpi":0.92,
    "current_spi":0.95,
    "critical_path_activities":["<A2510>","<A2610>"]
  },
  "historical_impact_stats":{
    "similar_rfc_avg_cost_cny":2800,
    "similar_rfc_avg_days":1.2
  }
}
```

## 硬约束

1. 不编数字 · cost 估算基于 BOQ + historical_stats
2. cascading_effects 必须覆盖所有 6 个直接联动子域
3. confidence 必给(0-1)· 低于 0.6 建议人工复审
4. quality_impact / safety_impact 分 none/minor/moderate/major 四级 · 不细分

## 输出

```json
{
  "version":"0.1.0",
  "assessment_no_suggestion":"JP-CIA-2026-0015",
  "assessed_target":"engineering_change",
  "target_id":"<uuid>",

  "cost_impact":{
    "cny":2400,
    "breakdown":[
      {"item":"砌体拆除重砌","cny":800},
      {"item":"管道材料","cny":600},
      {"item":"管道安装","cny":500},
      {"item":"涂装补充","cny":500}
    ],
    "confidence":0.85
  },
  "schedule_impact":{
    "days":1.0,
    "affected_activities":[
      {"id":"<A2410>","lag_days":1.0,"reason":"拆除重砌 + 等待硬化"},
      {"id":"<A2415>","lag_days":0.5,"reason":"管井就位晚"}
    ],
    "critical_path_affected":false,
    "spi_expected_after":0.94,
    "confidence":0.80
  },
  "quality_impact":{
    "level":"none",
    "reason":"施工工艺不变 · 仅位置 · 质量无影响"
  },
  "safety_impact":{
    "level":"minor",
    "reason":"拆除 + 二次砌筑 · 作业时间增加 · 交叉作业风险轻度 · 无新危大"
  },

  "cascading_effects":[
    {"subdomain":"01-progress","effect":"A2410 / A2415 工期各 +1 / +0.5 日 · schedule 重算"},
    {"subdomain":"10-bim_integration","effect":"需 BIM v3 模型更新 · 一个 IfcWall + 一个 IfcPipeSegment 位置"},
    {"subdomain":"quantity_costing","effect":"BOQ 4 项调整 · 总 +¥2400"},
    {"subdomain":"11-compliance","effect":"改后合规扫描 · 需验证节能 / 防水 条款仍通过"},
    {"subdomain":"certifications","effect":"RFC 批准后 · 自动开签证 JP-CRT-xxx · 金额 ¥2400 · 天数 1"},
    {"subdomain":"02-quality","effect":"新建 inspection_lot · 位置调整后重验砌筑"}
  ],

  "risk_flags":[
    "涉及管井 · 若后期再改 · 二次拆除代价翻倍 · 建议一次定准"
  ],

  "overall_confidence":0.82,
  "manual_review_needed":false,
  "recommended_action":"三方审查会 · 监理出具建议 approve · 对合同整体影响 < 0.5% · 可接受"
}
```

## 反模式

- ❌ "影响较大"(必须数字)
- ❌ cascading_effects 不覆盖 · 只写"可能影响"
- ❌ confidence 无来源说明

---

version: 0.1.0 · 2026-04-23
