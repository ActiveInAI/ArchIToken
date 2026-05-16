# 04-daily_log · UI-COMPONENTS

---

## 1. 核心:全天时间轴

### `<DailyLogTimeline />` (核心)
- 路径: `/projects/[id]/daily-log/[date]`
- 左 · 时间轴 (7:00 - 19:00 · 30 分钟一格)
- 每个事件 · 按 subdomain 色码 · 点击打开详情
- 右 · markdown 编辑器 · supervision_log.body

## 2. 移动端快速记录

### `<PatrolQuickRecord />`
- 移动端底部固定按钮"开始巡视"
- 自动启 GPS 轨迹
- 拍照 · 自动上传 · 自动挂当前 patrol
- 结束时 · 填关注点 + 发现 · 2 分钟完成 1 次巡视

### `<MonitoringPostActive />`
- 旁站中界面 · 大号计时器
- 中文语音输入(Web Speech API)· 实时加到 content
- 按钮"发现问题" · 弹快速缺陷 / 隐患 · 自动关联旁站 id

## 3. 例会

### `<MeetingMinuteForm />`
- 会前:选 meeting_type · 填 agenda
- 会中:录音开启 / agenda 勾选
- 会后:录音转写(Whisper / Azure) · AI 建议 decisions / action_items
- 签到:扫码 · 实时显示 attendees

## 4. 审阅与签认

### `<DailyLogReviewer />`
- 路径: `/projects/[id]/daily-log/[date]/review`
- 上段 · AI 生成的 summary + body
- 下段 · 可编辑 markdown
- 侧边:当日全部记录(右侧抽屉)· 供核对
- 底部:"签认归档"大按钮 · 签认后禁止编辑

## 5. 月报

### `<MonthlyReportWizard />`
- 步骤 1 · 选月份
- 步骤 2 · AI 汇总草稿
- 步骤 3 · 监理补充/修改
- 步骤 4 · PDF 预览 · 五方分发

## 6. 图表

### `<CoverageHeatmap />`
- 巡视 GPS 轨迹 · 热图投影到 BIM 楼层
- 周 / 月视图 · 找盲区

### `<LogComplianceBadge />`
- 项目卡片上显示 "本月日志签认率" 93%
- 未签认日志数量徽章

## 7. i18n / a11y / 性能

- 移动端离线优先 · PWA · IndexedDB 暂存未同步数据
- 录音上传走分片 · 弱网友好

---

version: 0.1.0 · 2026-04-23
