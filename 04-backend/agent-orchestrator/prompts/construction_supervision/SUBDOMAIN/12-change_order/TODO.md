# 12-change_order · TODO

---

## 1. 设计待决策

- [ ] **工作日 vs 自然日**: FIDIC §20 "28 天"按自然 · 国内实践有争议
  建议:默认自然日 · settings_center 可覆写
- [ ] **索赔逾期是否强 reject**: 超 28 天但业主愿意接受?
  建议:supervisor 可标 late_but_approved · 但留合同风险备注
- [ ] **变更累计上限**: 累计 △cost > 合同 10% 是否触发合同重谈?
  建议:报警 · 不自动拒

## 2. 技术待实现

- [ ] impact_propagation_analyzer Rust 依赖图 · 快速算 cascading
- [ ] 合同条款全文入库 · OCR 施工合同 PDF
- [ ] 索赔时效 · 每日 scan · pgmq reminder

## 3. 数据

- [ ] GF-2017-0201 施工合同 通用条款 · 结构化入库
- [ ] FIDIC §20 / §8 / §13 · 英文 + 中文翻译入库

## 4. 测试

- [ ] impact_analysis · 10 种典型变更场景
- [ ] 索赔逾期自动 reject 回归
- [ ] 签证三方签 · 边界测试(49,999 vs 50,001)

---

version: 0.1.0 · 2026-04-23
