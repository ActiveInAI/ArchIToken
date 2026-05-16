# Example · 锦屏 · 5/19 焊缝夹渣返工闭环

**场景**: 2026-05-19 Day 8 · 二层钢柱-钢梁节点焊缝 UT 抽检发现夹渣 · 一日内完成整改闭环。

---

## 1. 10:15 · 见证取样与发现

Supervisor 张工在施工班组完成 A×3 节点焊接后 · 见证 UT 抽检 3 点 · 其中 W-208 节点:
- 检测方法: GB/T 11345-2013 超声探伤 · 二级焊缝要求
- 发现: 内部 8mm 长夹渣 · 超过 §7.2.4 允许值(≤5mm)

**第三方 CMA 实验室出具报告 JP-UT-2026-0013** · 判定不合格。

## 2. 10:20 · 前端操作

张工打开 `<DefectCreateForm />`:
- 入口: 扫构件二维码 → 自动填 `bim_element_guids = ['2A3K9XYZABCDEF12367']`
- activity_id 自动挂上 `A1210` (二层钢柱焊接)
- 描述框输入: "二层 B×5 节点焊缝 W-208 UT 发现内部 8mm 夹渣"
- 上传 3 张照片 · UT 探头位置 · 报告单 · 肉眼可见部位

按 Ctrl+Enter · 前端调 `/v1/csr/quality/classify`。

## 3. 10:20:15 · defect_classifier 响应

```json
{
  "category_suggestions": [
    {"category":"weld","confidence":0.94,"reason":"焊缝 + UT + 夹渣 强关键词命中"}
  ],
  "severity_suggestion": "major",
  "severity_rationale": "主控项目 · 二级焊缝内部缺陷超限 · 需整改",
  "standards_suggested": [
    {"code":"GB 50205-2020","clause":"§7.2.4","relevance":0.95},
    {"code":"GB/T 11345-2013","clause":"§8","relevance":0.78}
  ]
}
```

张工点击"采纳" · 表单自动填充 · 10:22 提交缺陷 · 系统自动 INSERT `quality_defects`。

## 4. 10:22:30 · 自动触发 A5 整改单生成

后端检测到 new defect · severity=major · 自动调 `/v1/csr/quality/defects/{id}/rectify`。

### planner 输出(简)
```json
{"steps":[
  {"id":"s1","tool":"sql_query","params":{"template":"defect_details","defect_id":"..."}},
  {"id":"s2","tool":"sql_query","params":{"template":"related_standards","category":"weld","severity":"major"}},
  {"id":"s3","tool":"llm_generate","prompt_ref":"generator.md"},
  {"id":"s4","tool":"llm_generate","prompt_ref":"evaluator.md"}
]}
```

### generator 输出(摘 required_action)
> 一、立即清除焊缝 W-208 内部夹渣 · 清根深度 ≥ 10mm
> 二、按原焊接工艺 WPS-S01 重新焊接 · 焊工资格保持
> 三、重焊后 UT 复检 100% · 合格级别 GB/T 11345-2013 Ⅱ 级
> 四、复检报告 4 小时内递交监理
> 五、留存影像 ≥ 3 张(清根后 · 焊接中 · 复检后)

### evaluator 结论
```json
{"evaluator_verdict":"pass","overall_score":0.91,"checks":[...全 pass...]}
```

### 10:25 · A5 整改通知单入库
- serial_no: JP-RO-2026-0017
- deadline: 2026-05-20 10:25(1 日)
- status: open → 前端自动推送班组长手机

## 5. 10:40 · 班组签收

班组长王工在施工方 App 签收 · status → acknowledged。

## 6. 11:30 · 开始整改

- 11:30 · 砂轮清根 (留影像 P001)
- 13:00 · 重新焊接 (留影像 P002)
- 14:00 · 焊接完成
- 14:15 · 第三方 CMA UT 复检开始 (留影像 P003)
- 14:40 · 复检报告 JP-UT-2026-0014 出具 · Ⅱ 级合格

## 7. 14:45 · 申请闭环

班组提交 `<DefectCloseForm />`:
- 上传 3 张整改后影像 (P001, P002, P003)
- 附复检报告 PDF

前端调 `/v1/csr/quality/defects/{id}/close`。后端:
- 校验 closed_photos 数组 size ≥ 1 ✓
- 校验照片 hash 非重复 ✓
- 写 `rectification_orders.status = closed`
- 写 `quality_defects.status = closed`
- 发 pgmq 消息 → 04-daily_log 监理日志会自动收录本事件

## 8. 15:00 · 复查签认

张工打开 `<DefectDetail />` 复查 · 查 UT 报告 · 影像齐全 · 标准合格。
点击"监理复查通过" · 写 `quality_defects.closed_at` · 整改单 `status = closed`。

## 9. 17:30 · 当日监理日志自动汇总

```
04-daily_log → supervision_logs.body 自动追加:
"10:15 见证 UT 抽检 · 发现焊缝 W-208 不合格
 10:25 签发整改通知单 JP-RO-2026-0017
 14:40 CMA 复检合格 JP-UT-2026-0014
 15:00 整改闭环"
```

## 10. 产出与统计

- 总耗时: 10:15 发现 → 15:00 闭环 = **4 小时 45 分钟**(远快于 1 日 deadline)
- 对进度影响: 下游 A1215 (后续吊装) 延 0.5 日 · SPI 影响 -0.02
- 对成本影响: 人工返工 ¥1,800 + CMA 复检 ¥600 = ¥2,400(由施工单位自担)
- 对合规影响: 0(完整留痕 · 标准引用充分)

---

version: 0.1.0 · 2026-04-23
