# 11-compliance · UI-COMPONENTS

---

## 1. 强条库

### `<MandatoryClauseLibrary />`
- 路径: `/standards/clauses`
- 搜索 · 按 standard_code + keywords + 语义(pgvector)
- 每条 · 显示 · is_mandatory 徽章 · 适用分部 · 生效期

## 2. 合规检查

### `<ComplianceCheckList />`
- 项目级 · 按 target 分组
- non_compliant 红色顶置

### `<ComplianceHeatmap />`
- BIM 叠加 · 按构件显示最近合规状态

### `<ComplianceCheckDetail />`
- 单条 · 逐 clause 显示 · compliant/violated/n/a
- 链接:跳 quality defects(若触发)

## 3. 法规差异

### `<RegulationDiffPanel />`
- 对比两版本 · 新增 / 修改 / 删除 clauses
- 每条 · 建议"采纳 / 忽略"按钮

## 4. 报建审批

### `<PermitApprovalTimeline />`
- 项目时间轴 · 各许可申请 / 审批 / 有效期
- 红色 · expired 或即将到期(30 日内)

## 5. 归档

### `<ArchivePackageBuilder />`
- 7 类清单 · 进度条(各类已收集数 / 应有数)
- 一键组装 · 生成 zip/tar.gz · 计算 SHA-256

### `<ArchivePackageTimeline />`
- 项目级归档历史(monthly · stage · completion)

---

version: 0.1.0 · 2026-04-23
