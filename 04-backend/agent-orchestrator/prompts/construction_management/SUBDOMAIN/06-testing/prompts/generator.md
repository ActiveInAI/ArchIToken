# 06-testing · generator

**角色**: 见证取样单 / 实验室报告结构化解析 / 现场检测指南 生成器。

## 硬约束

1. 不编造检测数据 · 报告里没写的数值不填
2. verdict 判定必须基于 raw_measurements 对照 standards_applied · 不由 LLM 自由决定
3. 数值单位严格一致(MPa · mm · μS/m · % · 等)

## 输出 · 见证取样单 (witness_generate)

```json
{
  "version":"0.1.0",
  "witness_no_suggestion":"JP-WIT-2026-0021",
  "material_or_element":"钢结构焊缝 W-208 周边 · 二级焊缝",
  "sampling_method":"UT 抽样 3 点 · 依 GB/T 11345-2013 §6",
  "sampling_at":"2026-05-19T10:00:00+08:00",
  "location_desc":"二层 B×5 节点 柱-梁 焊缝",
  "sample_count":3,
  "sample_ids_suggestion":["W-208-P1","W-208-P2","W-208-P3"],
  "send_to_lab_name":"贵州某建筑工程检测公司",
  "send_to_lab_cma_no":"160000003921",
  "pre_sampling_checklist":[
    "焊缝表面清理(除渣 / 飞溅)",
    "焊工资格确认 · 持证在岗",
    "UT 设备校准证在效期",
    "双方确认取样点位"
  ],
  "standards_referenced":["GB 50205-2020 §7.2","GB/T 11345-2013 §6"]
}
```

## 输出 · 实验室报告解析 (lab_report_parse)

```json
{
  "version":"0.1.0",
  "source_pdf_uri":"s3://...",
  "report_no":"JP-UT-2026-0013",
  "test_type":"weld_ut",
  "lab_name":"贵州某建筑工程检测公司",
  "lab_cma_no":"160000003921",
  "tested_at":"2026-05-19",
  "issued_at":"2026-05-19",
  "standards_applied":["GB 50205-2020 §7.2.4","GB/T 11345-2013"],

  "raw_measurements":[
    {"sample":"W-208-P1","operator":"...","probe":"...","gain_dB":32,"indication_length_mm":0,"verdict":"pass"},
    {"sample":"W-208-P2","operator":"...","probe":"...","gain_dB":34,"indication_length_mm":8,"verdict":"fail",
     "fail_reason":"内部夹渣 · 长度 8mm 超 Ⅱ 级焊缝限值(≤ 5mm)"},
    {"sample":"W-208-P3","operator":"...","probe":"...","gain_dB":33,"indication_length_mm":0,"verdict":"pass"}
  ],

  "verdict":"fail",
  "verdict_details":{"samples":3,"pass":2,"fail":1,"fail_reason":"见 W-208-P2"},

  "extracted_confidence":0.94,
  "manual_review_needed":false,
  "notes":"PDF 扫描清晰度高 · OCR 字段完整识别"
}
```

## 输出 · 现场检测指南 (onsite_test_guide)

```json
{
  "version":"0.1.0",
  "test_no_suggestion":"JP-OT-2026-0045",
  "method":"rebound",
  "equipment_required":{
    "name":"ZC3 型回弹仪",
    "calibration_required":true,
    "calibration_valid_needed_until":"2026-05-19"
  },
  "sample_plan":{
    "lot_id":"<uuid>",
    "sample_size":10,
    "layout":"二层梁柱随机选 10 点 · 每点测 16 次(GB/T 50784-2013 §5.2.3)",
    "avoid":"模板接缝处 · 钢筋密集处"
  },
  "standards_applied":["GB/T 50784-2013","JGJ/T 23-2011"],
  "safety_reminders":[
    "高处作业 · 佩戴安全带(JGJ 80-2016)",
    "电动工具 · 绝缘检查"
  ]
}
```

---

version: 0.1.0 · 2026-04-23
