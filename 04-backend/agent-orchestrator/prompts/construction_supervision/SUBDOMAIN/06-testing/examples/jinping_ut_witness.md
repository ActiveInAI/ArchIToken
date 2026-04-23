# Example · 锦屏 · 5/19 W-208 焊缝 UT 见证取样与报告

---

## 1. 10:00 · 见证取样

监理张工 + 施工方焊工共同到场 · 焊缝 W-208 表面清理完毕。

前端 `<WitnessForm />`:
- material_or_element:钢结构焊缝 W-208 周边 · 二级焊缝
- sampling_method:UT 抽样 3 点 · 依 GB/T 11345-2013 §6
- sample_count:3
- sample_ids:W-208-P1 / P2 / P3
- 送检单位:贵州某建筑工程检测公司 · CMA 160000003921
- 前端 SHA256 + EXIF 封样照片 3 张(打水印 + GPS)

witness_no = **JP-WIT-2026-0021** INSERT 入库。

## 2. 10:15 · UT 现场检测

操作员开始 UT · 监理见证。3 点依次扫查。

## 3. 13:00 · CMA 实验室数据回传

实验室上传 PDF 报告到项目桶 · 调 `/v1/csr/testing/lab-reports`。

### 3.1 Planner 输出

```json
{
  "task_type":"lab_report_parse",
  "steps":[
    {"id":"s1","tool":"pdf_extract","params":{"ocr":true}},
    {"id":"s2","tool":"sql_query","params":{"template":"lab_cma_cache","cma_no":"160000003921"}},
    {"id":"s3","tool":"llm_generate","prompt_ref":"generator.md"},
    {"id":"s4","tool":"llm_generate","prompt_ref":"evaluator.md"}
  ]
}
```

### 3.2 Generator 解析

- 报告 PDF → OCR → 结构化:
  - report_no:JP-UT-2026-0013
  - tested_at / issued_at:2026-05-19
  - raw_measurements 3 行:P1 pass · P2 fail(8mm 夹渣)· P3 pass
- verdict = **fail**
- extracted_confidence:0.94

### 3.3 Evaluator 审查

- ✓ standards_valid(GB 50205-2020 §7.2.4 · GB/T 11345-2013)
- ✓ cma_valid(160000003921 有效至 2028)
- ✓ raw_data_complete
- ✓ verdict_math(1 fail → 整体 fail)
- ✓ hash_verified
- pass

## 4. 14:45 · lab_report 入库

```sql
-- 见 DATA-MODEL.md 第 3 节 INSERT
```

linked_witness_id 回填到 JP-WIT-2026-0021。

## 5. 14:45 · 自动触发 02-quality

`verdict = 'fail'` · pgmq 消息触发:
- 在 `csr.quality_defects` 创建 defect(severity = major · category = weld)
- linked_defect_ids 写回 lab_report

## 6. 14:50 · 进入 02-quality 整改流程

- A5 整改通知单 JP-RO-2026-0017 签发
- 14:30 - 14:40 二次 UT · 合格报告 JP-UT-2026-0014 回传
- 15:00 整改闭环

## 7. 关键数据点

- 从取样 10:00 到报告入库 14:45 · 4.75 小时(含检测 + 上传 + 解析)
- OCR + LLM 解析时间:< 20 秒
- 监理人工介入:见证 30min + 审核报告 5min · 远低于传统纸质流程(≥ 2h)

## 8. 档案留痕

- `test_witnessings.sealed_photo_ids` · 3 张封样照片
- `lab_reports.report_uri + report_sha256` · 原件防篡
- `quality_defects.photo_evidence_ids` · 缺陷证据链
- 月底批次进入 digital_archive

---

version: 0.1.0 · 2026-04-23
