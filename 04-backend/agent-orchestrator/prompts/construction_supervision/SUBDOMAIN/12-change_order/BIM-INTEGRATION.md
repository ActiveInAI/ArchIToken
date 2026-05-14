# 12-change_order · BIM-INTEGRATION

---

## 1. 变更的 3D 定位

`engineering_changes.bim_element_guids` + `site_consultations.bim_element_guids` · 每个变更都锚到具体构件。

### 用途

- 前端 `<ChangeOrderKanban />` 选中卡片 · BIM 自动高亮涉及构件
- 设计审查 · 直接在 BIM 上看"这个变更影响哪些梁柱"
- 历史回溯 · 某构件被改过几次 · 每次变更内容

## 2. 变更触发 BIM 新版

engineering_change.status = approved · 且涉及设计调整 · 自动在 detailed_design 触发一个新 bim_model 版本请求。

流程:
- RFC approved → 通知 detailed_design(pgmq)
- detailed_design 产新 IFC → CSR.bim_models INSERT
- 旧 bim_model superseded
- 新模型重跑 clash_triage

## 3. 变更成本 · 5D 联动

`engineering_changes.affected_boq_items` → quantity_costing 的 BOQ。

前端展示:
- 左 · BIM 3D · 高亮受影响构件
- 中 · BOQ 清单差异 · 旧量 vs 新量
- 右 · 累计 △cost · △days

## 4. 签证的 BIM 证据

`certifications.attachment_uri` · 可关联 BIM 截图(某部位的"变更前 vs 变更后"对比)· 作为签字证据。

## 5. IFC 属性回写

竣工 · 每构件的 Property Set:
- `IfcPset_ArchIToken_Changes` · 该构件一生所经历的 rfc_nos 数组
- 运维期查询 · 知道"这根梁被改过 2 次 · 理由是什么"

---

version: 0.1.0 · 2026-04-23
