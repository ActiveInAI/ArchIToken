# 02-quality · BIM-INTEGRATION

质量子域与 BIM 的集成点。

---

## 1. 核心集成:缺陷定位到构件

`quality_defect.bim_element_guids TEXT[]` · 直接关联到 IFC `GlobalId`。

效果:
- 前端 `<DefectKanban />` 点击任意缺陷 · 同步在 `<BIMViewer />` 高亮目标构件
- 移动端监理巡视 · 扫构件二维码 → 直接定位到对应 IFC 元素 → 新建缺陷预填 `bim_element_guids`

## 2. IFC 实体 → 缺陷 category 映射

| IFC 实体 | 典型 defect.category |
|---|---|
| `IfcBeam` / `IfcColumn` (钢) | weld · dimension · alignment |
| `IfcBeam` / `IfcColumn` (混凝土) | concrete · dimension · alignment |
| `IfcSlab` | concrete · dimension |
| `IfcWall` / `IfcWallStandardCase` | workmanship · finish · dimension |
| `IfcCovering` | finish · workmanship |
| `IfcPipeSegment` / `IfcDuctSegment` | mep · alignment |
| `IfcReinforcingBar` | concrete (保护层) |

LLM 分类器 `defect_classifier.md` 可根据 IFC type 预判 category。

## 3. 影像 EXIF · GPS · BIM 三角定位

`photo_evidence` 表:
- `exif` · JSONB · 含 orientation / timestamp / focal_length
- `gps` · GEOGRAPHY(Point, 4326) 或 `POINT` · 手机上传的经纬度
- `bim_element_guids` · 人工选中或自动推断

自动推断流程(Stage 3+ 实现):
```
photo.gps ≈ (x, y) →
  IFC spatial index(PostGIS 或 R-tree)查最近元素 →
  返回 TOP 3 候选给 supervisor 确认
```

## 4. 碰撞检查触发缺陷

如果 10-bim_integration 的 `clash_report` 标为 hard clash · 又已施工(activity.actual_start IS NOT NULL)
· 自动创建 quality_defect(category=dimension, severity=major) + rectification_order。

```sql
-- pseudo trigger
INSERT INTO csr.quality_defects(..., category, severity, bim_element_guids, description)
SELECT ..., 'dimension', 'major', ARRAY[c.element_a, c.element_b],
       '碰撞报告 ' || c.report_no || ' · 元素 ' || c.element_a || ' 与 ' || c.element_b || ' 相交'
FROM csr.clash_reports c
WHERE c.project_id = ... AND c.hard_clash AND c.status = 'confirmed';
```

## 5. 参考标准

- ISO 19650-2:2018 · §5.5 CDE 状态下的 issue 管理
- buildingSMART BCF (BIM Collaboration Format) 3.0 · 缺陷互操作格式(Stage 4 导出兼容)

---

version: 0.1.0 · 2026-04-23
