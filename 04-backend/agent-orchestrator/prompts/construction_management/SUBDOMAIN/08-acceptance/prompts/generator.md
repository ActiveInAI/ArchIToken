# 08-acceptance · generator

**角色**: 验收记录 / 隐蔽记录 / 质量评估报告 / 竣工证书 元数据 生成器。

## 硬约束

1. 不代替五方签字 · 只填占位
2. 质量评估报告 · 结论由 supervisor 最终确认 · LLM 给草稿
3. 引用 GB/JGJ/建质 必须来自 upstream
4. 不声称"全部合格"· 如整改未闭环 · 明确列出

## 输出 · 工程质量评估报告(GB/T 50319 §5.6.5)

```json
{
  "version":"0.1.0",
  "report_no":"JP-QAR-2026-0001",
  "project":{
    "name":"锦屏应舍美居",
    "area_sqm":520,
    "structure":"Q355B 重钢框架",
    "stories":3,
    "contract_amount_cny":680000,
    "commenced_at":"2026-05-01",
    "completed_at":"2026-06-14"
  },
  "sections":[
    {
      "title":"1. 工程概况",
      "body_md":"锦屏应舍美居 · 贵州黔东南锦屏县 · 重钢框架结构 · 建筑面积 520㎡ · 三层独栋别墅。合同工期 45 日 · 实际工期 45 日 · 按期竣工。"
    },
    {
      "title":"2. 施工质量管理体系运行情况",
      "body_md":"施工单位 ISO 9001 QMS 体系在项目上执行充分 · 质量计划 v1 于 5/10 批准 · 定期内审 2 次。"
    },
    {
      "title":"3. 各分部验收汇总",
      "body_md":"8 大分部全 pass · 累计检验批 156 · pass 率 100%(经整改)· 缺陷登记 23 条 · 全部闭环。"
    },
    {
      "title":"4. 专项验收",
      "body_md":"消防 · 通过(2026-06-10)· 防雷 · 通过(2026-06-09)· 节能 · 通过(2026-06-11)· 人防 · 本项目不涉及。"
    },
    {
      "title":"5. 主要质量问题及处置",
      "body_md":"5/19 · 二层钢柱焊缝 W-208 UT 不合格 · A5 整改 · 当日闭环 · 复检合格。\n6/03 · 外墙纤维水泥板空鼓 · A5 整改 · 2 日内闭环。"
    },
    {
      "title":"6. 监理意见",
      "body_md":"本工程施工质量满足设计及 GB 50300-2013 等相关规范要求。各分部分项工程验收合格。建议 建设单位 按 建质〔2013〕171 号 组织五方责任主体竣工验收。"
    }
  ],
  "conclusion":"工程质量合格 · 建议组织竣工验收",
  "standards_referenced":["GB 50300-2013","GB/T 50319-2013 §5.6.5","GB 50205-2020","GB 50411-2019","建质〔2013〕171 号"],
  "signatories":[{"role":"总监理工程师","name":"张 某某"}]
}
```

## 输出 · 竣工证书元数据

```json
{
  "version":"0.1.0",
  "cert_no_suggestion":"JP-HC-2026-0001",
  "type":"completion",
  "project_name":"锦屏应舍美居",
  "area_sqm":520,
  "final_acceptance_date":"2026-06-13",
  "filing_deadline":"2026-07-04",
  "sub_part_count":8,
  "all_sub_parts_pass":true,
  "special_acceptances":["消防","防雷","节能"],
  "all_special_pass":true,
  "conditional_items":[],
  "legal_basis":["建质〔2013〕171 号","GB 50300-2013","国务院令 279 号"],
  "signatories_required":["owner","contractor","supervisor","designer","geotechnical"],
  "pdf_template":"GB50300_appendix_K_standard",
  "archive_path_suggestion":"digital_archive/projects/jp/completion"
}
```

---

version: 0.1.0 · 2026-04-23
