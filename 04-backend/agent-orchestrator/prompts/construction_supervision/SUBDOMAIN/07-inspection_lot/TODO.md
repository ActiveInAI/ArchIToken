# 07-inspection_lot · TODO

---

## 1. 设计待决策

- [ ] **版本化主控**: 整改后批重评 · 是覆盖旧 main_items 还是新建一行(version_no)?
  建议:覆盖正常 · 但保留 `main_items_history` JSONB 数组存过去版本。合规审计用。
- [ ] **分部自定义**: 锦屏这种小项目 · 实际分部常简化(如不分智能建筑)。是否允许项目自定义分部清单?
  建议:标准 10 分部为模板 · 项目可勾选启用(enabled=false 的分部不进验收)。
- [ ] **四级树命名**: `sub_part.level=1` 分部 vs `level=2` 子分部 · UI 如何折叠显示最直观?

## 2. 技术待实现

- [ ] sub_item → sub_part rollup 触发器完善(本 Module 只示范 sub_item)
- [ ] lot_boundary_advisor 的 coverage_check 算法 · 递归 BIM 元素判
- [ ] 批 fail 后 · 自动生成 quality_defect 的消息链完整验证

## 3. 标准

- [ ] GB 50204-2015 / GB 50205-2020 各分项的主控 / 一般项目清单 · 入 standard_library
- [ ] 检验批划分一般规则(按施工段 / 轴线 / 材料批次)· 作为 lot_boundary_advisor 的"规则库"

## 4. 测试

- [ ] 四级聚合 · 5 级不同深度项目的回归
- [ ] 主控 CHECK 约束的边界测试(整批 fail / pass 场景)
- [ ] lot_boundary_advisor · 3 种粒度下的合理性(专家盲测)

---

version: 0.1.0 · 2026-04-23
