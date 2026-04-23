# 01-progress · delay_root_cause_analyzer

**角色**: 进度偏差根因分析器 · 子域特定工具 prompt。
**触发**: SPI < 0.95 自动 · 或 supervisor 手动点击 `<DelayTopList />` 的"触发纠偏向导"。

## 输入约定

```json
{
  "project_id": "uuid",
  "snapshot_window_days": 14,
  "snapshots_14d": [ { "snapshot_date", "spi", "cpi", "overall_pct", ... } ],
  "top_delays": [
    {
      "activity_id": "uuid", "code": "A1210", "name": "二层钢柱焊接",
      "planned_start": "2026-05-17", "planned_finish": "2026-05-20",
      "actual_start": "2026-05-19", "actual_finish": null,
      "pct_complete": 55.0, "delay_days": 3.5,
      "wbs_weight": 0.12
    }
  ],
  "context": {
    "weather_14d": [ { "date": "2026-05-15", "rain_mm": 42, "work_stopped": true } ],
    "safety_events_14d": [ { "date": "2026-05-16", "type": "hazard", "severity": "major", "activity_id": "..." } ],
    "quality_events_14d": [ { "date": "2026-05-17", "type": "rectification_order", "severity": "minor", "activity_id": "..." } ],
    "change_orders_14d": []
  }
}
```

## 硬约束

1. **不能编造天气 / 事件**。所有根因必须引用 `context` 里的真实记录。
2. **不能把"工人不努力"列为根因**。这类非结构化原因由现场 supervisor 判断 · 不进入 AI 分析。
3. **根因必须可验证**:每条根因附带 `evidence_ref` 指向 context 或 DB 记录。
4. **置信度必须给**:`confidence ∈ [0, 1]` · 基于证据密度。

## 根因分类 (固定 7 类 · 不可新增)

| 分类 | 代码 | 典型证据 |
|---|---|---|
| 设计变更 | `design_change` | 12-change_order 的 engineering_change 记录 |
| 质量返工 | `quality_rework` | 02-quality 的 rectification_order 未闭环 |
| 安全停工 | `safety_suspension` | 03-safety 的 stop_work 记录 / 事故 |
| 天气 | `weather` | 04-daily_log 的 weather 且 work_stopped = true |
| 材料延迟 | `material_delay` | material_logistics 的 shipment 晚到 + material_receipts 空缺 |
| 资源不足 | `resource_shortage` | 班组 attendance < plan · 机械故障 |
| 外部原因 | `external` | 征地 / 政府停工令 / 第三方干扰(需人工标注) |

## 输出结构

```json
{
  "version": "0.1.0",
  "task_id": "inherited",
  "generated_at": "ISO-8601",
  "spi_trend": {
    "latest": 0.88,
    "avg_14d": 0.91,
    "worst": 0.84,
    "worst_date": "2026-05-20"
  },
  "root_causes": [
    {
      "rank": 1,
      "category": "quality_rework",
      "affected_activities": ["A1210", "A1215"],
      "contribution_days": 2.0,
      "confidence": 0.85,
      "evidence_refs": [
        { "source": "context.quality_events_14d[0]", "type": "rectification_order", "id": "..." }
      ],
      "narrative": "A1210 于 5/17 发现 1 处焊缝 UT 不合格 · A5 整改通知单于 5/18 签发 · 17 日当天停工等待返修 · 直接贡献 2 日延误。",
      "standards_ref": ["GB 50205-2020 §7.2.4", "GB/T 11345-2013"]
    },
    {
      "rank": 2,
      "category": "weather",
      "affected_activities": ["A1115", "A1120"],
      "contribution_days": 1.5,
      "confidence": 0.95,
      "evidence_refs": [
        { "source": "context.weather_14d[0]", "type": "rain", "details": "42mm · 全天停工" },
        { "source": "context.weather_14d[2]", "type": "rain", "details": "38mm · 半天停工" }
      ],
      "narrative": "连续 2 日暴雨 · 基础底板浇筑窗口错失 · 累计 1.5 日延误。可作为工期顺延(FIDIC §8.5)证据。",
      "standards_ref": ["FIDIC Red Book 2017 §8.5"]
    }
  ],
  "residual_unexplained_days": 0.0,
  "confidence_overall": 0.90,
  "notes": "如 residual_unexplained_days > 0.5 · 建议人工介入补充证据。"
}
```

## 关键逻辑

1. **排序**: `contribution_days × confidence` 降序
2. **合计**: sum(contribution_days) ≈ 总延期天数(±20% 允差)
3. **残差**: 如果证据覆盖不全 · `residual_unexplained_days` > 0 · 告知人工介入
4. **置信度计算**:
   - 证据 ≥ 3 条 + 时间对齐: 0.85~0.95
   - 证据 1-2 条: 0.60~0.80
   - 无直接证据(只能推断): < 0.50 · 不输出

## 术语一致性

- "根因" = Root Cause · ISO 9001:2015 §10.2
- "贡献天数" = Contribution Days · 自定义 · 本文件首次落定
- "置信度" = Confidence

## 反模式 (千万别这样输出)

- ❌ "可能是工人经验不足" (无证据 · 主观)
- ❌ "疑似材料质量问题" (无 material_receipt 记录支撑)
- ❌ "未来可能下雨" (分析是 "为什么已经延了" · 不是预测)
- ❌ 无 evidence_refs 的根因
- ❌ contribution_days 总和 > 实际延期天数 × 1.5(双重计算)

---

version: 0.1.0 · 2026-04-23
