# 05-method_statement · BIM-INTEGRATION

---

## 1. 方案的 BIM 依据

- `method_statements.scope_activity_ids` → `activities.bim_element_guids`
- 方案 PDF 里的 "适用范围" 部分 · 可从 BIM 模型直接生成构件清单
- Reviewer 审查时 · 一边读方案一边在 `<BIMViewer />` 看涉及构件

## 2. 自动辅助识别危大工程

`hira_generator.md` (03-safety) 已从 BIM 抽取:
- 楼层高度 → 高大模板
- 基坑深度 → 深基坑
- 构件重量 → 起重吊装超规模

这些结果灌入 `method_statement.hazard_category` + `is_super_scale`。

## 3. 论证前的 3D 演示

`<ExpertReviewMeeting />` 支持:
- 屏幕共享 `<BIMViewer />` 给专家
- 专家点击构件加意见 · 写入 `verdict_comments.bim_element_guids`
- 论证纪要自动附 3D 截图(带时间戳 · 防后期修改)

## 4. 三级交底的 BIM 辅助

- 交底现场 · project / crew 级支持 `<BIMViewer />` 直接调取
- 作业人员通过 App 扫构件二维码 · 回顾自己相关的交底内容
- 提高"交底是否真懂"的留痕质量

## 5. IFC 数据回写

- 方案 approved 后 · 方案 PDF 链接作为属性回写到 IFC 文件 (`IfcPropertySet` 自定义属性 `ArchIToken_MethodStatement_URI`)
- 未来查任意构件 · 能看到"它的专项方案在哪"

---

version: 0.1.0 · 2026-04-23
