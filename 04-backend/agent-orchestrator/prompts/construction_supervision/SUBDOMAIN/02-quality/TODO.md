# 02-quality · TODO

子域待完善项 · 留给 AIA 醒来决策。

---

## 1. 设计待决策

- [ ] **严重性升级阈值**: 当 `severity = critical` 且 `open > 2h` · 是否自动升级工程暂停令 (B3)?
  建议 · yes · 但需要 supervisor 二次确认(避免误触发)。

- [ ] **NCR 让步接收的"有权人员"**: designer 不可得时(锦屏是个人建筑师) · 让步由 owner + supervisor 共同批?
  ISO 9001 未明确 · 国务院 279 有倾向 designer。建议 designer 优先 · owner 可代理。

- [ ] **多语言缺陷描述**: 英文描述的 classify 准确率如何保证? 训练样本能否双语混合?

## 2. 技术待实现

- [ ] CMA 合格证真伪查验 API · 外部接口(住建部或地方 CMA 数据库)· 合同 / 法律可行性待确认
- [ ] 影像 hash 去重 + SHA-256 · 防伪 · Stage 3 落地
- [ ] BCF 3.0 导出 · 与外部 BIM 协作 · Stage 4 落地
- [ ] defect_classifier 的 vision encoder 选型 · Gemma 4-E4B 多模态 vs OpenCLIP

## 3. 数据待接入

- [ ] `standard_library` 的 GB 50300 全文入库(条款级) · Phase 4 seed 做
- [ ] 常用材料族库(钢材 · 混凝土 · 砌块 ...)witness_required 默认值

## 4. 测试缺口

- [ ] 4 prompt 黄金样本 · 每个 3+
- [ ] defect_classifier · 100+ 真实缺陷标注数据集 · 期望 category top-1 ≥ 85%
- [ ] NCR 四选 1 的决策树回归测试

---

version: 0.1.0 · 2026-04-23
