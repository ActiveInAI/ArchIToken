# 06-testing · UI-COMPONENTS

---

## 1. 取样

### `<WitnessForm />`
- 选材料 / 构件 → 自动推荐取样方法(查 sl.material_catalog)
- 相机 · 拍封样 ≥ 3 张 · 包含样品编号二维码
- 双方扫码签字(监理 + 施工)

### `<SampleBarcodePrinter />`
- 样品编号 · 小贴标打印(Zebra / ESC-POS)
- 送实验室免得混批

## 2. 实验室报告

### `<LabReportImport />`
- 拖拽 PDF → 前端 SHA-256 计算 → 后端 OCR
- LLM 辅助解析:report_no / test_type / verdict / measurements · 生成草稿
- 用户确认后 INSERT

### `<LabCmaCheck />`
- CMA 证编号 · 一键调 `/v1/csr/testing/lab-reports/{id}/verify-cma`
- 实时显示:证有效期 + 认定范围(对应 test_type)

## 3. 现场检测

### `<OnsiteTestForm />`
- 仪器选型 · 扫设备编号 · 自动查年检有效期
- 过期 · 红色警告 · 不允许提交
- 测量表格:每行 sample / value / spec / verdict · 支持粘贴 Excel

### `<EquipmentInventory />`
- 项目用仪器清单 · 年检到期倒计时
- 到期前 7 天预警

## 4. 聚合视图

### `<TestingDashboard />`
- 卡片:本月见证 N 次 · 合格率 XX% · 不合格 M 个(已转 defect)
- 图:test_type 分布饼 · 合格率按类型
- 表:待领取 / 送检 进度

### `<SamplePlanTimeline />`
- 基于 sample_plan_generator 产出的抽样计划
- 日 / 周 / 月视图
- 绿:已完成 · 黄:到期未做 · 红:逾期

## 5. 移动优先

- Witness / Onsite 两个表单 · 平板 / 手机友好
- 相机直接上传 · 自动打水印(时间 + GPS + 项目名)
- 弱网缓存 · 恢复后同步

---

version: 0.1.0 · 2026-04-23
