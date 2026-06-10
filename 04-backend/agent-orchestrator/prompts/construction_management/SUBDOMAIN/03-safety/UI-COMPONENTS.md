# 03-safety · UI-COMPONENTS

前端组件 · Next.js 16.2.6 + React 19.2.5 + TypeScript 6.0.3 + Tailwind v4.3.0。

---

## 1. 看板与热图

### `<HazardMap />` (核心 · 3D)
- `<BIMViewer />` 之上叠加隐患图钉 · 按 severity / lec_score 色码
- 点击跳详情

### `<HazardKanban />`
- 看板: open → rectifying → verifying → closed / dismissed
- 卡片: LEC 分数大字 · 类型图标 · 位置

### `<IncidentTimeline />`
- 时间线视图 · 未遂 / 事故 区分色
- 死亡 / 重伤事件 顶部永久高亮

## 2. 作业许可

### `<WorkPermitWizard />` (核心)
- 步骤:
  1. 类型选择(6 种)
  2. 范围与时间
  3. BIM 区域选择(多选构件)
  4. 风险控制措施(AI 自动建议)
  5. PPE 清单
  6. 双签
- 结束自动生成 PDF · 可打印张贴现场

### `<WorkPermitListToday />`
- 当日活动许可 · 按时间排序
- 即将到期高亮(≤ 1 小时)

## 3. 班前会

### `<ToolboxTalkForm />`
- 字段: 话题 · 要点(可从关联许可自动带) · PPE 勾选 · 签到(扫工人二维码)
- 录音 · 自动转写 → transcript_md

### `<ToolboxTalkAttendanceWall />`
- 照片墙 · 实时显示已签到人数

## 4. 事故上报

### `<IncidentReportForm />`
- 12 字段表单 · 红色边框提示紧急
- 24h 倒计时 · 展示距 incident_at 已过多久
- 多图必传

### `<IncidentAttachmentReview />`
- 调查员回看现场影像 · 支持马赛克隐私处理

## 5. HIRA

### `<HiraRegisterTable />`
- 表格:类别 · 描述 · L · E · C · LEC · 控制措施 · 责任人
- 支持 LLM 生成后 · 逐条确认 / 修改

## 6. 看板

### `<SafetyDashboard />`
- 卡片 1: 本月 hazards 开 / 闭
- 卡片 2: 高 LEC 未闭
- 卡片 3: 本月 incidents (数 + 严重性)
- 图: Heinrich 金字塔(未遂 → 轻伤 → 重伤 → 死亡 统计)

## 7. 其它

- i18n / a11y / 性能 · 同 01 02 子域
- 特殊:
  - `<HazardMap />` 3D 热图 · Three.js r184 · 用 `InstancedMesh` 渲染 1000+ 图钉
  - `<IncidentReportForm />` 离线可用 · IndexedDB 暂存 · 恢复网络即上报(事故现场信号差场景)

---

version: 0.1.0 · 2026-04-23
