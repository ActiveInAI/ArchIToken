# 12-change_order · UI-COMPONENTS

---

## 1. 看板

### `<ChangeOrderKanban />` (核心)
- 路径: `/projects/[id]/change-orders`
- 看板列:draft → reviewing → approved → executed → closed
- 卡片:rfc_no / 发起方 / △cost / △days · 按大小排序
- 色码:批准(绿)· 审查(黄)· 拒(红)

### `<ClaimLedger />`
- 表格 · 索赔台账
- within_notice_period = FALSE 红色徽章(逾期)

## 2. 详情

### `<RfcDetail />`
- 左 · 变更内容 · markdown
- 中 · `<BIMViewer />` 聚焦受影响构件
- 右 · 影响分析报告 · △cost / △days / 下游触达

### `<ClaimDetail />`
- 证据 + 合同条款引用
- 监理裁定区 · 业主决定区
- 时效倒计时

## 3. 影响分析

### `<ImpactAnalysisReport />`
- 四维展示 · cost / schedule / quality / safety
- cascading_effects · 按子域分组
- confidence 徽章

### `<ImpactPropagationGraph />`
- DAG 图(d3)· 中心 RFC · 辐射下游影响(boq · schedule · bim · compliance)

## 4. 签证

### `<CertificationBook />`
- 签证册 · 按类型分组
- 三方签状态实时显示
- 关联 RFC / Claim / Consultation

## 5. 统计

### `<CumulativeChangeChart />`
- 累计 RFC 数 / 金额 / 天数 · 随时间曲线
- 对比合同初始值的占比(警戒 > 10%)

## 6. 索赔时效

### `<ClaimTimerCountdown />`
- 28 天 / 42 天 两个倒计时圈
- 超过自动红色 · 提醒 supervisor

---

version: 0.1.0 · 2026-04-23
