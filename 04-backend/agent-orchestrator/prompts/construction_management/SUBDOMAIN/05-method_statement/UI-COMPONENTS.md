# 05-method_statement · UI-COMPONENTS

---

## 1. 方案上传与审查

### `<MethodStatementUploader />`
- 拖拽 PDF · 自动计算 SHA-256 · 前端 `crypto.subtle.digest`
- 填元数据 · scope / hazard_category / is_super_scale 自动识别
- 点"AI 辅助填超规模判定" → 调 planner → generator

### `<MsReviewPane />`
- 左 · PDF 预览(PDF.js · 支持批注)
- 右 · 审查意见列表 · 每条 severity(minor/major)
- 底 · approve / reject 按钮 · reject 要写原因

### `<MsVersionCompare />`
- v1 vs v2 差异 · PDF.js diff mode
- 用于方案修订后的复审

## 2. 专家论证

### `<ExpertReviewSetup />`
- 5+ 专家填表 · 自动校验专业覆盖 ≥ 3
- 会议链接生成(腾讯会议 / Zoom API)

### `<ExpertReviewMeeting />` (核心)
- 大屏共享 · PDF + BIM 双栏
- 专家席位 · 可独立举手 / 发言 / 投票
- 录音自动转写 · LLM 实时纪要草稿

### `<ExpertVerdictForm />`
- 每位专家独立意见 · pass / pass_with_revisions / fail
- 必须 mandatory 字段标识 "强制性意见"(方案必改点)

## 3. 三级交底

### `<BriefingForm />`
- 步骤:
  1. 选关联方案(method_statement)
  2. 按顺序:company(完成?)→ project → crew
  3. 录音 + 关键点 markdown
  4. 参会签字(扫二维码 or 拍照片墙)

### `<BriefingAttendanceWall />`
- 签到照片墙 · 实时显示

## 4. 看板

### `<MsDashboard />`
- 按状态分列:pending · in_review · rejected · approved · (超规模单独标)
- 红色:approved 但 crew 级交底未做 · 开工风险高

## 5. 其它

- 国际化:英文项目 · 专家论证报告双语
- 离线友好:交底现场可能信号差 · 先本地保存再同步

---

version: 0.1.0 · 2026-04-23
