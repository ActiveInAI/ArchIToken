# 07-inspection_lot · BIM-INTEGRATION

---

## 1. 批的 3D 锚定

`inspection_lot.bim_element_guids` · 每批锚到具体构件集。

用途:
- 树视图 + 3D 联动:点击树节点 · BIM 高亮对应构件
- 批 fail 时 · BIM 标红相关构件 · 一眼看出问题部位
- 批 accepted 时 · BIM 标绿 · 竣工度一目了然

## 2. 按构件划分批

`lot_boundary_advisor.md` 的核心策略:
- 按楼层 / 轴线 / 施工缝划分
- BIM 里的 `IfcBuildingStorey` → 按层粗划
- `IfcGrid` → 按轴线细划
- 同时考虑 BOQ 的材料批次(同一批次材料 · 尽量同批)

## 3. 构件属性回写

批 verdict = 'pass' · 将信息回写 IFC `IfcPset_ArchIToken_Acceptance`:
- `LotNo`
- `VerdictAt`
- `AcceptedBy`

便于未来查询任一构件 · 知道它在哪批里通过了验收。

## 4. 验收树的 3D 可视化

`<AcceptanceTree />` 左右分屏:
- 左 · 验收树(四级嵌套)
- 右 · `<BIMViewer />` 按选中节点范围自动聚焦

选 sub_part = 钢结构 · BIM 只显示钢结构构件;选具体 lot · 更细粒度。

## 5. IFC 数据来源

主来源 · detailed_design 的 `bim_models` 主表。
本子域只引用 guid 数组 · 不自持 BIM 元数据。

---

version: 0.1.0 · 2026-04-23
