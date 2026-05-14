# 01-progress · TODO

子域待完善项 · 留给 AIA 醒来决策 · Claude 不擅自落定。

---

## 1. 设计待决策

- [ ] **EVM 基线选择策略**: 当 schedule 改到 v3 · EVM 基线是永远锚 v1 · 还是滚动到 latest baseline?
  PMBOK 推荐 "锚 v1" · 但合同变更允许 rebaseline。建议默认 v1 · 重大变更时人工决策。

- [ ] **关键路径算法**: 本 Module 用 "total_float = 0" 简化判定。未来是否引入专用 CPM 算法(关键链 · CCPM)?
  涉及依赖 [Rust crate] · 待调研。

- [ ] **WBS 导入格式**: 支持哪些格式?
  Module 2 支持: CSV (自定义列) · Primavera XER · MS Project MPP (只读)。
  Module 3 加: Asta Powerproject · 广联达 BIM5D。

## 2. 技术待实现

- [ ] `POST /v1/csr/progress/sync/csv` · CSV 解析器 · Rust + xsv crate
- [ ] `POST /v1/csr/progress/sync/navis` · Navisworks TimeLiner CSV 专用入口
- [ ] `SlaCategory` 扩展 · 进度子域的特定 SLA(目前共用宪法 §8 的通用值)
- [ ] Gantt 前端 2000+ activity 的虚拟化方案(react-window vs canvas)· 需做 benchmark

## 3. 标准查找待完成

- [ ] 检索 `AS 4817-2006` 全文 · 决定是否正式引用(目前仅 STANDARDS.md 提及)
- [ ] 检索 `NASA/SP-2012-599` · 开源 PDF 是否可直接引用 · 许可证确认

## 4. 与其它模块协作待定

- [ ] 与 `quantity_costing` · 5D 联动的数据流方向
  - 是 01-progress 拉 BOQ? 还是 5D 事件由 quantity_costing 推过来?
  - 建议: `production_manufacturing` + `material_logistics` 维持自己的 FK · 由 BFF 层在前端聚合
- [ ] 与 `digital_twin` · 竣工后的进度数据是否迁移到孪生侧?
  - 建议: 只保留归档副本到 digital_archive · 孪生侧只用当前值

## 5. 测试缺口

- [ ] prompts/ 4 文件的黄金样本 (3+/文件)
- [ ] prompts/ 4 文件的反例样本 (1+/文件)
- [ ] EVM 公式单元测试(特别是 CPI / SPI 除零 edge case)
- [ ] WBS 递归写入的环路检测测试
- [ ] 锦屏真实数据回放测试

## 6. 文档缺口

- [ ] 录一个 5 分钟 demo 视频 · RecoveryWizard 完整流程
- [ ] 写一篇 blog · "用 LangGraph 做进度纠偏分析的工程实践"(对外)

---

version: 0.1.0 · 2026-04-23
