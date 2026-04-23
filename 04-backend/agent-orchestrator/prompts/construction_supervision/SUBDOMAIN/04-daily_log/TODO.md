# 04-daily_log · TODO

---

## 1. 设计待决策

- [ ] **签认权限**: 总监独占? 副总监也可? 不可签情况下的 delegate 流程
  建议:默认总监独占 · 请假期间可授权副监理(记录 delegation_log)

- [ ] **补签机制**: 忘签认后 · 多久之内可补? 补签是否留痕?
  建议:72h 内可补 · 超过强制留补签备注

- [ ] **日志签认后修改**: 完全禁止 or 允许 addendum?
  建议:禁止改 body · 允许追加 `addendums` JSONB 数组(发现后补充内容)

## 2. 技术待实现

- [ ] Scheduler 17:30 自动触发 · pg_cron + pgmq
- [ ] 巡视 GPS 轨迹的楼层投影算法(BIM 层面坐标系 vs WGS84)
- [ ] 例会录音转写 · Whisper v3 Chinese 本地部署 · 对比 Azure
- [ ] `<CoverageHeatmap />` BIM 热图 · 需要 BIM 平面展开算法

## 3. 数据模型升级

- [ ] 日志 body 改 Markdown + Mermaid 结构化 · 后端解析时区分"事实段"和"结论段"
- [ ] key_events 的 ref_id 反向索引 · 方便"某 ref_id 出现在哪些日志"

## 4. 测试

- [ ] daily_summary_generator 在 10+ 真实日数据上跑 · 漏报率 < 5%
- [ ] 签认权限 RBAC 回归
- [ ] 离线录入 · 恢复网络后冲突解决(两端都改了的情况)

## 5. 对接

- [ ] 建质〔2017〕214 号 质量安全手册 · 其中要求的日志字段与本表映射
- [ ] 各地监理协会对"监理日志"的地方差异 · 浙江 / 上海 / 广东 · Stage 4 统计

---

version: 0.1.0 · 2026-04-23
