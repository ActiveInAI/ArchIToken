# 10-bim_integration · BIM-INTEGRATION

> 本子域即"BIM 集成"· 本文件描述跨模块的 BIM 协作面。

---

## 1. 与 detailed_design 的主从关系

- **detailed_design 是主**:BIM 模型的编辑 · 版本 · 产权归 detailed_design
- **CSR 是从 + 扩展**:镜像 + 按施工进度 / 验收 / 风险 补充属性 + 链接

镜像机制:
- detailed_design 发布新版本 · pgmq 消息 `detailed_design.bim_published`
- CSR 订阅 · INSERT 一条 csr.bim_models 记录(origin=detailed_design)

## 2. 外部 BIM 工具对接

| 工具 | 接入方式 | CSV / 原生 |
|---|---|---|
| Autodesk Revit | IFC 导出 | IFC4.3 |
| Autodesk Navisworks | CSV 时间线 · clash 导出 | CSV |
| Bentley Synchro 4D | IFC + .sp XML | IFC + CSV |
| Graphisoft ArchiCAD | IFC 导出 | IFC4 |
| 广联达 BIM5D | XML | CSV 兼容 |
| Autodesk Construction Cloud | API 同步 | REST |

**Module 4**:IFC4.3 + CSV 两路径覆盖 90% 场景。
**Module 5+**:API 集成(AEC ACC · 广联达等)。

## 3. Rust 解析栈

基础 · ArchIToken STEP scanner(Rust 原生 · 无 AGPL/GPL 运行时依赖)。
配合:
- `tree-sitter-ifc 0.1.0` · STEP 树解析
- 几何网格生成 · 外部隔离 adapter/worker，进入前必须通过 license/advisory gate

## 4. 前端 3D 渲染

- `<BIMViewer />` · Three.js r184 + IfcJS(web-ifc)
- IFC → glTF 预转 · 浏览器拉小文件
- 大模型(> 100MB)· 分块加载 · OPFS 缓存

## 5. 跨子域引用

| CSR 子域 | 引用本子域 |
|---|---|
| 01-progress | `activities.bim_element_guids` + `bim_to_wbs_links` |
| 02-quality | `quality_defects.bim_element_guids` |
| 03-safety | `safety_hazards.bim_element_guids` |
| 04-daily_log | `monitoring_posts.bim_element_guids` |
| 06-testing | `test_witnessings.bim_element_guids` |
| 07-inspection_lot | `inspection_lots.bim_element_guids` |
| 08-acceptance | `hidden_works.bim_element_guids` |
| 09-risk_analysis | `risk_entries.bim_element_guids` |
| 11-compliance | `compliance_checks.bim_element_guids` |
| 12-change_order | `engineering_changes.bim_element_guids` |

即:**本子域是全模块的空间索引底座**。

## 6. 属性回写 IFC

竣工时 · CSR 所有子域的关键数据 · 回写 IFC Property Sets:
- `IfcPset_ArchIToken_Progress` · 工序 · 完成日期
- `IfcPset_ArchIToken_Quality` · 最后检验结果
- `IfcPset_ArchIToken_Tests` · 最后测试报告
- `IfcPset_ArchIToken_Acceptance` · 最终验收状态
- `IfcPset_ArchIToken_AsBuilt` · 竣工版本 · 档案链接

未来任何人 · 打开 as-built IFC · 可直接查任一构件的"建造历史"。

---

version: 0.1.0 · 2026-04-23
