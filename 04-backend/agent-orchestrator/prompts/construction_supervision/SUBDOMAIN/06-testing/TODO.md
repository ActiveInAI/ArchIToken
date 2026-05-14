# 06-testing · TODO

---

## 1. 设计待决策

- [ ] **CMA 在线查验**: 调用省级 / 国家级 CMA 数据库? API 是否公开? 如不可调 · 走爬虫?
  建议:先手动维护 lab_cma_cache · Stage 4 接入 CNAS 公开查询接口(如开放)。
- [ ] **IoT 设备直连**: UT / 回弹仪 能否直接推数据到 ArchIToken? 主流设备是否开放?
  建议:先支持厂家 CSV 导出 · Stage 3+ 对接 Zebra / Olympus 厂家 API。
- [ ] **OCR 准确率阈值**: extracted_confidence < 0.8 · 强制人工。0.8 - 0.95 · flag 但入库。阈值合理吗?
  待真实数据验证 · 建议先 0.85 · 观察一个月调整。

## 2. 技术待实现

- [ ] PDF OCR · `pdf_oxide` + Tesseract / PaddleOCR · Rust 服务
- [ ] CMA 查验 · 外部 API 封装
- [ ] sample_plan_generator 的规则表 · 入 standard_library.code_clauses · schema 设计
- [ ] 仪器年检 · QR 扫码 + 设备资产表(设备管理模块 Stage 5+)

## 3. 标准

- [ ] GB 50204-2015 § 7 取样规则 · 入 standard_library(Module 4 seed)
- [ ] GB 50205-2020 § 7 UT/MT/RT 抽样比例表 · 入库

## 4. 测试

- [ ] 20+ 真实 PDF OCR 测试集
- [ ] sample_plan_generator · 10 种项目类型(villa / 高层 / 地下 / 市政 / 桥梁)
- [ ] CMA 过期场景回归

---

version: 0.1.0 · 2026-04-23
