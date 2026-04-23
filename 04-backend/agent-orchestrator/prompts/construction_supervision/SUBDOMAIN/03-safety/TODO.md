# 03-safety · TODO

---

## 1. 设计待决策

- [ ] **Safety Officer 是否必须独立于 Supervisor?** · 双签要求 · 宪法 §9 精神 · 个人项目是否豁免?
  建议:规模 > 1000㎡ 强制独立 · 小项目可以 safety officer = supervisor 代行 · 但日志留痕。

- [ ] **LEC 评分标准化** · 不同项目类型(山区 / 城市 / 地下)的基础 L 值差异 · 是否引入修正系数?
  建议:Stage 3 加 `project_risk_profile` 基线 · 对 L 系数 × 1.0 / 0.8 / 1.2 调整。

- [ ] **未遂事件鼓励上报** · 如何防止下属故意瞒报? AI 能否侦测(从日志 / 视频 / 物料异常)?
  建议:Stage 4 引入"异常模式侦测"LLM · 交叉对比 daily_log vs 工程量异常。

## 2. 技术待实现

- [ ] `POST /v1/csr/safety/hira/generate` 异步任务 SSE stream 实现(Phase 4 LangGraph)
- [ ] 塔吊 / 升降机 年检证 OCR · 自动填 `risk_controls[0].verified = true`
- [ ] 测风仪 IoT 直连 · `risk_controls.verified_each_hour` 自动化
- [ ] `csr.work_permits.scope_overlap_check` DB 函数实现

## 3. 数据待接入

- [ ] 住建部 37 号令附件一"危大清单"结构化入 `standard_library.code_clauses`
- [ ] JGJ 59-2011 的扣分标准 · 用于安全文明施工评分自动化

## 4. 测试缺口

- [ ] `hira_generator` · 针对 5 种项目类型(villa · 高层 · 地下 · 公建 · 桥梁)· 各 5 个黄金样本
- [ ] 许可签发 E2E · 双签流程回归
- [ ] 事故延报场景(late_reported = TRUE)处置逻辑

## 5. 文档待补

- [ ] "监理如何独立于施工单位" 的边界案例集 · 给 AIA 醒来讲
- [ ] 住建部 37 号令 附件一 清单的逐条示例 · 让 hira_generator 更好引用

---

version: 0.1.0 · 2026-04-23
