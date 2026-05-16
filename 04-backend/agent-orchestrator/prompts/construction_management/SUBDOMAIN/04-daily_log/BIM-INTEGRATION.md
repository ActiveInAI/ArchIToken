# 04-daily_log · BIM-INTEGRATION

---

## 1. 旁站位点

`monitoring_post.bim_element_guids` · 把旁站关联到具体构件。
前端 `<BIMViewer />` 显示历史旁站轨迹 · 构件图标显示"已旁站次数"。

## 2. 巡视 GPS 与 BIM 叠加

`patrol_record.gps_trace` (LineString) · 可投影到 BIM 楼层平面 · 形成巡视覆盖热图。

用途:
- 月报看 "监理覆盖率" · 是否有盲区
- 某日巡视集中在哪层 / 哪区

## 3. 平行检验锚定

`parallel_inspection.inspection_lot_id` → `sub_item` → `bim_element_guids`。
前端点某检验结果 · 直接跳构件详情。

## 4. 日志中事件的 3D 回放

日志 `key_events` 数组里的每条 event · 如有 `ref_id`(指向 defect / hazard / acceptance_record)· 前端支持 "3D 回放":
- 按当日事件时序 · 在 BIM 上逐个高亮
- 形成 "一日巡检电影" · 便于汇报 / 审计

## 5. IFC 参考

无新引用 · 主要借用 `02-quality` / `03-safety` / `01-progress` 已建立的 GUID 链接。

---

version: 0.1.0 · 2026-04-23
