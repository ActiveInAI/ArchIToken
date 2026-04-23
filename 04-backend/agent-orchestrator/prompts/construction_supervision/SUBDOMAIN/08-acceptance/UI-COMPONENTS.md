# 08-acceptance · UI-COMPONENTS

---

## 1. 单位工程概览

### `<UnitProjectSummary />`
- 路径: `/projects/[id]/acceptance/unit-projects/[upId]`
- 总览:8 大分部 / 节能 / 专项 · 状态矩阵
- 进度条:总批 pass 率 / 累计照片留痕数 / 待整改数
- 快链:竣工预验收向导 入口

### `<CompletionReadiness />`
- 竣工准备度仪表盘
- 卡片:分部全 pass? 节能 pass? 消防? 防雷? 人防?
- 缺的 item 直接列到前端 · 每项附"整改建议"链接

## 2. 隐蔽工程

### `<HiddenWorkForm />`
- 步骤:category → title → BIM 选构件 → 拍照(≥ 4 张,app 强制)
- 双签:扫监理 + 施工二维码
- 通过后才能点"允许掩埋" · 写 actual_buried_at

### `<HiddenWorkGallery />`
- 按 category / 时间 浏览
- 搜索:构件 GUID / 关键词

## 3. 验收记录

### `<AcceptanceRecordForm />`
- target_type 5 选 1 (inspection_lot / sub_item / sub_part / unit_project / special)
- 根据 level 自动加载所需签字栏
- standards_cited · 从 standard_library 搜索加入

### `<FivePartiesSignoffPanel />` (核心)
- 五方签字界面
- 每方:名字 · 单位 · 扫签章 or 电子签
- 实时显示:谁还没签 · 已签者高亮
- 后端每签一次 · 触发消息给其它方

## 4. 竣工证书

### `<HandoverCertificateBuilder />`
- 自动汇总分部 + 专项 acceptance 记录
- PDF 预览(按 建质 171 号 标准模板)
- 五方终极签字
- 签齐后 · 系统生成 cert_pdf + SHA256 · 锁定不可改

### `<FilingCountdown />`
- 竣工后 · 15 工作日倒计时条(顶部 banner)
- 逾期红条持续警告

## 5. 看板

### `<AcceptanceDashboard />`
- 累计:sub_part 验收 N / M · unit_project 验收 X / Y
- 专项状态:消防 / 节能 / 防雷 / 人防 单卡
- 证书清单:已开具 / 已备案 / 已归档

---

version: 0.1.0 · 2026-04-23
