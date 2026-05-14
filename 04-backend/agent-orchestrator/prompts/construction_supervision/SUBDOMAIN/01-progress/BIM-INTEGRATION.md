# 01-progress · BIM-INTEGRATION

本子域与 BIM 模型 (3D/4D/5D) 的集成点 · IFC 实体映射 · 外部工具对接。

---

## 1. 4D 集成本质

**4D** = 3D BIM + 时间轴。在本子域里意味着:
- `activity.bim_element_guids` ↔ IFC `GlobalId` (22 字符 base64 IfcRoot.GlobalId)
- 前端 `<ScheduleGantt />` 与 `<BIMViewer />` 选中联动
- 任何日期 t · 能切片显示"t 日已完成"的构件(绿) + "t 日在建"(黄) + "t 日未开始"(灰)

## 2. IFC 实体 → activity 映射规则

| IFC 实体 | 典型对应 activity 类 | 说明 |
|---|---|---|
| `IfcBuildingStorey` | 楼层级工序群 | 粗粒度 · 通常不直接挂 activity |
| `IfcBeam` / `IfcColumn` | 钢构件安装工序 | 本模块锦屏项目主力 |
| `IfcSlab` | 楼板浇筑 / 安装 | 混凝土 or 装配 |
| `IfcWall` / `IfcWallStandardCase` | 围护 / 隔墙工序 | |
| `IfcCovering` | 装饰 / 饰面工序 | |
| `IfcPipe*` `IfcDuct*` | 机电管线 | 对接 MEP 分部 |
| `IfcBuildingElementProxy` | 设计未分类的杂项 | 回写方要求报表 |
| `IfcReinforcingBar` | 钢筋工序 | 可选 · 通常合并到 IfcSlab/Beam 级 |

映射关系表达 · `csr.activities.bim_element_guids TEXT[]`(已在 DDL)。反向查询表 · `csr.bim_to_wbs_links` (见 `10-bim_integration`)。

## 3. 数据同步路线

```
[Revit / ArchiCAD / Bentley]
         │ (IFC4 / IFC5 export)
         ▼
[ifc-lite-core 2.1.9 Rust 解析]
         │  JSON 化: {guid, type, storey, volume, attrs}
         ▼
[detailed_design 模块 · bim_models (main)]
         │
         ▼
[本子域 · activity.bim_element_guids 关联]
         │
         ▼
[前端 <BIMViewer /> + <ScheduleGantt /> 联动]
```

## 4. 4D 工具对接 (可选 · 非必选)

| 工具 | 格式 | 对接方式 |
|---|---|---|
| Navisworks TimeLiner | CSV / XML | 导出后 POST `/v1/csr/progress/sync/navis` (Module 4 实现) |
| Synchro 4D | `.sp` XML | 解析器后置 · 本 Module 提供 CSV 兼容入口 |
| Autodesk Construction Cloud | API | OAuth + project binding (Module 5 实现) |
| 广联达 BIM5D | XML | 国内项目常用 · 解析器后置 |

**本 Module 不要求全部对接** · CSV 兼容路径 `POST /v1/csr/progress/sync/csv` 即可覆盖 95% 场景。

## 5. 5D 扩展 (与 quantity_costing 协同)

- `activity.bim_element_guids` 同时被 `quantity_costing` 的 `boq_items.bim_element_guids` 引用
- 任何构件有一个"施工工序" + 一个"清单项" · 前端按日期切片时能同时看到"今日产值" · 即挣值 EV 的现场视图
- 5D 视图 · 前端复用 `<BIMViewer />` · 仅换色码策略

## 6. 关键校验

- `bim_element_guids` 数组里的每个 GUID · 必须在 `bim_models.elements` 里存在
- 同一 GUID · 在同一 schedule 里最多对应 1 个 activity(允许同 GUID 挂多 schedule 版本)
- GUID 格式校验 · 正则 `^[0-9A-Za-z_$]{22}$` (IFC IfcRoot.GlobalId 标准)

## 7. 参考标准

- ISO 19650-2:2018 §5.4 · 4D 信息交付要求
- buildingSMART IFC 4.3 · GlobalId 定义
- GB/T 51301-2018 · BIM 元素编码(与 GUID 不冲突 · 各司其职)

---

version: 0.1.0 · 2026-04-23
