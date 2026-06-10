# 02-quality · UI-COMPONENTS

前端组件规划 · Next.js 16.2.6 + React 19.2.5 + TypeScript 6.0.3 + Tailwind v4.3.0。

---

## 1. 列表视图

### `<MaterialReceiptList />`
- 路径: `/projects/[id]/quality/materials`
- 过滤: verdict(pending / pass / fail / concession / returned) · 供应商 · 日期
- 操作: 新建 · 签发 pass/fail · 批量打印合格证附件

### `<DefectKanban />` (核心)
- 路径: `/projects/[id]/quality/defects`
- 看板列: open → rectifying → verifying → closed / dismissed
- 卡片信息: category 图标 · severity 色码 · 截止时间倒计时 · BIM 图标(点击跳转 3D)
- 拖拽: rectifying → verifying 触发后端状态更新
- 筛选: category · severity · activity · 关键词

### `<RectificationOrderList />`
- 路径: `/projects/[id]/quality/rectifications`
- 列: 编号 · 缺陷 / 隐患引用 · deadline · status · 剩余时间
- 红色高亮: deadline 内 6 小时 · 已 overdue

### `<NcrList />`
- 路径: `/projects/[id]/quality/ncr`
- 列: ncr_no · disposition 徽章 · 审批进度(designer / owner) · cost / schedule impact

## 2. 详情

### `<DefectDetail />`
- 路径: `/projects/[id]/quality/defects/[defectId]`
- 三栏:
  - 左 · 属性 + 状态历史
  - 中 · 影像走廊 (前 · 中 · 后) · 点击放大
  - 右 · `<BIMViewer />` 聚焦相关构件

### `<RectificationOrderA5 />`
- 印刷样式组件 · 严格按 GB/T 50319-2013 表 A.0.5 排版
- 打印 / PDF 导出按钮
- 可附前 · 后影像自动排版

### `<NcrReview />`
- designer / owner 审批界面
- 侧边显示合同条款 / 规范原文(自 standard_library)
- 批准 / 拒绝 · 必填理由

## 3. 表单

### `<MaterialReceiptForm />`
- 字段:material_code (下拉 · 族库模糊搜) · batch_no · supplier · quantity · unit · cert_uri(拖拽上传)
- 自动判定 `witness_required`(根据 sl.material_catalog.witness_required 默认值)
- 多图上传(合格证 · 外观 · 现场)

### `<DefectCreateForm />`
- 可从 inspection_lot / activity / BIM / scan QR 四入口启动
- 描述字段支持 · Ctrl+Enter 触发 `/v1/csr/quality/classify` LLM 建议
- 分类器返回后 · 用户一键采纳或覆盖

### `<RectificationIssueForm />`
- 自 `<DefectDetail />` 触发
- 自动填充: required_action (LLM 生成 · 可编辑) · deadline (按 severity)
- 选择 issued_to_unit

### `<DefectCloseForm />`
- 上传整改后影像 ≥ 1
- 填复查情况
- 提交 · 前端强制校验 photo 数量

## 4. 图表 / 看板

### `<QualityTrendDashboard />`
- 卡片: 本月开单 / 闭环 / 逾期 · 按 severity 分色
- 图 1: 缺陷按 category 饼图
- 图 2: 整改闭环时长直方图
- 图 3: Top 10 缺陷工序

### `<MaterialVerdictSparkline />`
- 小图 · 材料合格率趋势

## 5. 分类器交互

### `<DefectClassifierChip />`
- 在 `<DefectCreateForm />` 描述框下方
- 按 Ctrl+Enter · 调 `/v1/csr/quality/classify`
- 显示 top 3 category + severity 建议 · 用户点击采纳

## 6. 状态管理

- TanStack Query 5.99.1 · 缺陷 / 整改单 / NCR 列表
- Zustand 5.0.12 · 看板过滤 · 选中项 · 多图上传缓冲

## 7. i18n · a11y · 性能

同 01-progress · 不赘述。特别注意:
- severity 色码 + 图标双通道(色盲友好)
- 影像走廊支持键盘方向键导航

---

version: 0.1.0 · 2026-04-23
