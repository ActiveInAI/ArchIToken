# 06-testing · BIM-INTEGRATION

---

## 1. 检测点位 3D 锚定

`test_witnessing.bim_element_guids` + `onsite_test.bim_element_guids` · 让每次检测锚到具体构件。

用途:
- `<BIMViewer />` 显示构件 · 上角标"已测 N 次 · 最近结果 pass/fail"
- 历史回溯:某构件施工期间 · UT 测过几次 · 强度值变化趋势

## 2. 抽检密度热图

按构件 GUID 聚合检测次数 · 生成"检测密度 heatmap":
- 绿 · 已测 ≥ 要求频率
- 黄 · 已测 < 要求频率
- 红 · 未测(但该批次到了抽检频率)

## 3. 样品追踪

`test_witnessing.sample_ids_json` → `lab_report.raw_measurements` · 每个样本的 sample_id 关联回原构件 + 取样位置。

可视化:BIM 上显示取样点(坐标信息从手机 GPS 投影到 BIM 楼层)。

## 4. IFC Property 回写

- 合格报告合并到 IFC `IfcPset_ArchIToken_Tests`
- 属性:`LatestReportNo` · `LatestReportVerdict` · `LatestReportAt`
- 未来 digital_twin 运维阶段 · 可以直接查某构件历史检测数据

---

version: 0.1.0 · 2026-04-23
