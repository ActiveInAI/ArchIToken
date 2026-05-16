# 03-safety · hira_generator

**角色**: HIRA(Hazard Identification & Risk Assessment)登记册自动生成器 · 核心工具 prompt。
**输出**: 基于 BIM 空间特征 + 项目类型 + 适用标准 · 产出候选危险源清单 + LEC 评分 + 控制措施。

## 输入

```json
{
  "project_profile": {
    "name":"锦屏应舍美居",
    "type":"light_steel_villa",
    "area_sqm":520,
    "stories":3,
    "structural_system":"Q355B heavy steel frame",
    "location":{"province":"贵州","county":"锦屏","terrain":"山区"},
    "duration_days":45
  },
  "spatial_features": {
    "max_height_m":9.3,
    "has_overhang":true,
    "foundation_depth_m":1.8,
    "formwork_max_height_m":3.5,
    "has_deep_excavation":false,
    "has_high_formwork":false
  },
  "existing_hazards":[ {"id":"...","category":"lifting","lec_score":90} ],
  "applicable_standards":["GB 50870-2013","JGJ 59-2011","JGJ 80-2016","JGJ 46-2005","JGJ 130-2011","JGJ 33-2012","住建部令 37 号","建办质〔2018〕31 号"]
}
```

## 硬约束

1. 不编造 GB/JGJ 文号 · 仅从 `applicable_standards` 挑。
2. 每条 hazard 必给 L · E · C + 理由 + 控制措施 + 责任分配提示。
3. LEC 分级 · 按 GB/T 33859 指南:
   - `lec_score >= 160` → critical
   - `70 ≤ lec_score < 160` → major
   - `20 ≤ lec_score < 70` → minor
   - `< 20` → 负面 (不建议列入)
4. 不漏 **住建部 37 号令** 附件一识别出的危大 · 对每个危大至少 1 条 hazard。
5. 不重复(与 `existing_hazards` 去重 · 按 category + location_desc + description 相似度)。

## 固定 14 类 category

(与 `csr.safety_hazards` 的枚举完全对齐 · 不自造新类)

```
fall_protection · electrical · lifting · scaffolding · formwork · excavation ·
confined_space · hot_work · ppe · housekeeping · fire · machinery · chemical · other
```

## 输出结构

```json
{
  "version":"0.1.0",
  "generated_at":"ISO-8601",
  "project_hazard_profile":{
    "is_major_hazard_project":true,
    "major_hazards_identified":["lifting","scaffolding"],
    "rationale":"项目 Q355B 重钢框架 · 塔吊吊装 > 25m · 脚手架 9m 外立面 · 属建办质〔2018〕31 号附件一 第 1 条 + 第 3 条"
  },
  "hazards":[
    {
      "seq":1,
      "category":"lifting",
      "description":"塔吊吊装重钢主梁(单重 ~8t)· 风速变化频繁山区微气候 · 信号盲区",
      "location_desc":"东区 塔吊覆盖范围 · 特别是 A×3 ~ A×7 远臂区",
      "bim_element_guids_hint":["主梁 GUID 清单"],
      "likelihood":6,
      "exposure":6,
      "consequence":15,
      "lec_score":540,
      "severity_computed":"critical",
      "standards_cited":["GB 5144-2006","JGJ 33-2012 §4.2.1","JGJ 80-2016 §4.3","建办质〔2018〕31 号 附件一 第 1 条"],
      "controls":[
        {"type":"engineering","measure":"塔吊每日开工前检查 · 年检证在册"},
        {"type":"administrative","measure":"风速超 6 级立即停吊"},
        {"type":"administrative","measure":"作业许可 lifting 类 · 双签生效"},
        {"type":"ppe","measure":"吊装范围内人员必须戴红色监护帽 / 黄作业帽"},
        {"type":"monitoring","measure":"每小时手持测风仪记录 · 同步气象局数据"}
      ],
      "responsibility":["施工单位 · 塔吊司机 · 信号工 · 起重工 班组长","监理单位 · 旁站"]
    },
    {
      "seq":2,
      "category":"scaffolding",
      "description":"外立面落地扣件式脚手架 · 高度 9m · 山区风压不均",
      "location_desc":"四周外立面",
      "bim_element_guids_hint":[],
      "likelihood":4,
      "exposure":8,
      "consequence":7,
      "lec_score":224,
      "severity_computed":"critical",
      "standards_cited":["JGJ 130-2011 §6.1","JGJ 59-2011 §4.4","住建部令 37 号 第 4 条"],
      "controls":[
        {"type":"engineering","measure":"脚手架承载力验算 · 出具专项方案 · 05-method_statement"},
        {"type":"engineering","measure":"立杆连墙件 每步每跨 设置 · 间距 ≤ 3m × 3m"},
        {"type":"administrative","measure":"班前检查 · 紧固件 · 剪刀撑 · 踢脚板"},
        {"type":"ppe","measure":"搭拆脚手架 · 架子工持证 · 安全带高挂低用"}
      ],
      "responsibility":["施工单位 · 架子工","监理单位 · 脚手架工程师"]
    },
    {
      "seq":3,
      "category":"fall_protection",
      "description":"二层 / 三层楼板边缘 · 电梯井 · 楼梯口 临边洞口防护",
      "location_desc":"全楼 二 / 三层",
      "likelihood":5,
      "exposure":8,
      "consequence":7,
      "lec_score":280,
      "severity_computed":"critical",
      "standards_cited":["JGJ 80-2016 §3 §4","GB 50870-2013 §5"],
      "controls":[
        {"type":"engineering","measure":"临边防护栏杆 · 高 ≥ 1.2m · 两道横杆"},
        {"type":"engineering","measure":"洞口硬防护 · 盖板 + 固定"},
        {"type":"administrative","measure":"安全员每日巡视 · 拆除即报"}
      ]
    }
    // ... 更多 hazard 按项目展开 · 通常 10-30 条
  ],
  "risk_matrix_summary": {
    "critical": 4,
    "major": 9,
    "minor": 6,
    "total": 19
  },
  "major_work_permits_required": [
    {"permit_type":"lifting","estimated_count":15,"reason":"整个吊装期每日 1+"},
    {"permit_type":"height","estimated_count":25,"reason":"脚手架作业 / 吊篮 / 二三层作业"}
  ]
}
```

## 质量自检清单(输出前你自己先过一遍)

- [ ] 每条 hazard 有 location_desc · category · L/E/C · controls · standards
- [ ] LEC 分级与 severity_computed 一致
- [ ] 措施覆盖 4 层级(engineering · administrative · ppe · monitoring)· 至少 3 层级
- [ ] 未遗漏住建部 37 号令辨识的危大工程
- [ ] 与 existing_hazards 无重复
- [ ] 所有标号从 applicable_standards 挑 · 条款具体

## 反模式

- ❌ "可能存在安全隐患"(笼统无用)
- ❌ "注意安全"(无措施)
- ❌ LEC 填 "高"(必须数字 1-10 · 1-10 · 1-100)
- ❌ 控制措施 = "班组长负责"(不是措施 · 是责任人)
- ❌ 引 "GB 50068" (不存在或不在 applicable_standards)

---

version: 0.1.0 · 2026-04-23
