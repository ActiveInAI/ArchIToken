# 11-compliance · TODO

---

## 1. 设计待决策

- [ ] **适用法规截面**: 项目全生命周期是锁开工版本 · 还是一直跟最新?
  建议:默认锁开工 · settings_center 可按项目类型覆写。
- [ ] **住建部标准爬虫**: 每周扫描 · 从哪获取权威? 住建部官网 + 全国工程建设标准化信息网?
  建议:官网 RSS + 人工白名单 · Stage 5 验证。
- [ ] **强条全文库**: 先收录 GB 50300 · GB 50204 · GB 50205 · GB 50411 · GB 50057 · GB 50016 六大核心? 还是全量?
  建议:Phase 4 先 6 核心 · 逐步加。

## 2. 技术待实现

- [ ] pgvector 768 维 embedding · 用哪个模型?(text-embedding-3-small 或 bge-large-zh)
- [ ] clause_text 入库的 PDF/DOCX 解析(住建部标准 PDF 多样)
- [ ] archive_package 的 zip 打包 · 走 digital_archive 服务

## 3. 数据

- [ ] 6 核心 GB 的强条全文 · 清洗入库(人工 + OCR)
- [ ] 各地地标 · 初期只支持贵州 / 上海 / 北京

## 4. 测试

- [ ] regulation_diff · GB 50411-2009 vs 2019 真实对比 · 专家评估
- [ ] archive 完整性 CHECK · 缺类测试
- [ ] compliance_check 自动触发 · 端到端回归

---

version: 0.1.0 · 2026-04-23
