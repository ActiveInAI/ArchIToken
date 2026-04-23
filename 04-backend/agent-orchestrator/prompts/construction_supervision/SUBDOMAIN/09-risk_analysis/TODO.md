# 09-risk_analysis · TODO

---

## 1. 设计待决策

- [ ] **LEC 地域 / 项目类型修正系数**: 不同地区(山区 / 平原)· 不同项目(高层 / 别墅)· 风险基础 L 值差异大
  建议:标准 LEC + `project_risk_profile` 修正 · settings_center 配置
- [ ] **残余 LEC 的约束**: 是否强制 residual_lec < lec_score?(对策失败时)
  建议:软约束 + flag · 允许 residual ≥ score 时必写理由
- [ ] **风险成本影响货币化**: 是否每条 risk 都要 expected_cost_cny?
  建议:critical / major 必须 · minor 选填

## 2. 技术待实现

- [ ] `mc_simulate` Rust 函数 · triangle + bernoulli 混合分布 · 10000 iterations 性能 < 500ms
- [ ] IoT 数据时序表 · 用 TimescaleDB 或 pgvector 超表
- [ ] 预案触发的 real-time 处理 · pgmq LISTEN/NOTIFY + WebSocket 到前端
- [ ] 气象预警外部 API 接入(中央气象台 / 地方防汛办)

## 3. 数据

- [ ] 历史项目风险库 · 作为 similar_project_risks 查询基础 · 需至少 50 个项目数据
- [ ] 地区气象数据 · 5 年雨量 / 风速 分布 · 作为 L 值基础

## 4. 测试

- [ ] LEC 边界(159.99 vs 160) trigger 测试
- [ ] 应急预案触发 · 端到端回归(mocked IoT 输入)
- [ ] 蒙特卡洛 · 同种子结果一致性
- [ ] 风险热力图 · 1000+ risks 的渲染性能

---

version: 0.1.0 · 2026-04-23
