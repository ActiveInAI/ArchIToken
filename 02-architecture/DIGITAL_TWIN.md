# ArchIToken · 重钢结构数字孪生模块开发契约

**文档编号**: ARCHITOKEN-DIGITAL-TWIN-V1
**模块 id**: `digital_twin`
**所属架构**: 14 modules registry · [`MODULES.md`](./MODULES.md)
**状态**: active prototype · standalone HMI cockpit
**定稿日期**: 2026-04-24
**适用范围**: 重钢结构项目的设计、制造、物流、吊装、检测、归档与运维数字孪生
**页面边界**: `/app/modules/digital_twin` 是统一 CDE 模块工作台; `/app/digital-twin` 是独立 HMI / SCADA / CIM 数字孪生驾驶舱

---

## 1. 开发原则

本模块必须按文档先行方式开发。任何前端、后端、Agent、数据表或测试变更,都必须能回溯到本文中的需求编号。

1. **模块优先**: 统一使用 `digital_twin` 模块 id,并服从 14 模块统一工作台契约。
2. **独立驾驶舱优先**: `/app/digital-twin` 的默认交互形态是 HMI / SCADA / CIM 数字孪生驾驶舱,不是营销卡片页。
3. **重钢优先**: 页面和数据必须面向重钢结构,覆盖钢柱、钢梁、桁架、连廊、焊缝、螺栓、吊装、堆场、工厂加工和物流。
4. **文档可测**: 每条关键需求必须有前端 fixture、单元测试或 E2E 验证之一。
5. **实景分层**: 3DGS、点云、BIM、IoT、仿真、流程和风险必须分层表达,不得混成一个概念。

`/app/modules/digital_twin` 不得默认进入孤立大屏。它必须和其它模块一样使用统一 CDE 文件工作台、生命周期、审批、审计、右侧业务对象 / 操作队列和 AI 助手。

---

## 2. 术语约束

| 术语 | 正确定义 | 禁止写法 |
|------|----------|----------|
| 3DGS / Gaussian Splatting | 基于多视角图片、视频、360 全景等影像数据重建连续实景表达,用于现场真实感浏览、遮挡关系和视觉证据 | 不得写成“三维扫描点云本身” |
| 点云 / LiDAR / E57 | 三维扫描测量结果,用于控制点、轴线、标高、偏差、残差和几何校核 | 不得与 3DGS 混写为同一层 |
| IFC4.3 / MBD | 结构构件语义、几何、属性、GUID、焊缝、螺栓、材料、清单的模型主干 | 不得只当作可视化 mesh |
| 形性一体 | 几何形态与结构性能一体化表达,包括应力、应变、挠度、振动、疲劳和腐蚀 | 不得只显示 3D 外观 |
| 算测融合 | 仿真计算结果与实测传感 / 点云 / 检测数据闭环校正 | 不得只显示离线仿真图 |
| 流程孪生 | 制造、物流、堆场、吊装、检测、交付的动态流程模型 | 不得只显示静态流程图 |

---

## 3. 业务链条

数字孪生驾驶舱必须能承接以下工程生命期链条:

1. `concept_design` · 方案设计: 跨度、柱网、吊装分区、施工边界。
2. `detailed_design` · 深化设计: IFC4.3 / MBD、节点详图、焊缝、螺栓、构件编码。
3. `standard_library` · 标准族库: 构件族、节点族、材料族、规范条款。
4. `quantity_costing` · 计量造价: MTO / BOQ / BOM、变更差异、费用曲线。
5. `material_logistics` · 材料物流: DDMRP 缓冲、采购、运输、GPS、进场验收。
6. `production_manufacturing` · 生产制造: 下料、组立、焊接、矫正、涂装、防火、质检。
7. `construction_supervision` · 施工管理: 吊装、临撑、AR 复核、点云残差、质量安全。
8. `digital_twin` · 数字孪生: HMI 大屏、IoT/SCADA、形性一体、算测融合、流程孪生。
9. `digital_archive` · 数字档案: 合同、图纸、模型、检测、签章、版本、长期留存。

---

## 4. UI 信息架构

### 4.1 独立桌面驾驶舱

`/app/digital-twin` 桌面宽屏必须采用 HMI / SCADA / CIM 驾驶舱结构:

| 区域 | 必须内容 |
|------|----------|
| 顶部状态栏 | 模型深化、制造节拍、物流到场、吊装阻断、交付包、孪生就绪度 |
| 左侧目录树 | 9 个工程生命期节点,支持选中当前作业包 |
| 中央主视图 | 重钢构件加工、物流、堆场、吊装、连廊风险、3DGS 影像实景、点云 E57 校核 |
| 右侧监控 | 视觉监控、传感报警、质量门禁、导出清单 |
| 底部模块坞 | 综合全览、大纲目录树、零代码编排、蓝图编辑器、孪生编辑器、设备详情 |

### 4.2 独立驾驶舱移动端

移动端允许纵向堆叠,但必须保留以下顺序:

1. 标题与关键指标。
2. 项目大纲目录树。
3. 钢构统计。
4. 中央孪生主视图。
5. 功能模块坞。
6. 监控、报警、门禁、导出。

---

## 5. 数据契约

前端 fixture、API DTO 和未来数据库表字段必须覆盖以下实体:

| 实体 | 最小字段 |
|------|----------|
| `SteelTwinLayer` | `layerId`, `name`, `source`, `standard`, `progress`, `status` |
| `SteelTwinStage` | `id`, `name`, `scope`, `standard`, `evidence`, `progress`, `status` |
| `SteelMember` | `memberMark`, `assembly`, `kind`, `section`, `materialGrade`, `tonnage`, `weldSpec`, `boltSpec`, `shopStatus`, `siteStatus`, `risk` |
| `SteelSensorPoint` | `discipline`, `memberId`, `value`, `limit`, `trend`, `status`, `position` |
| `SteelQualityGate` | `group`, `score`, `status`, `standard`, `detail` |
| `SteelExportPackage` | `format`, `ready`, `checks` |

---

## 6. 技术分层

| 层 | 当前实现 | 后续目标 |
|----|----------|----------|
| HMI 驾驶舱 | Next.js + React + Tailwind CSS | 驾驶舱配置 JSON 化,支持租户主题 |
| 3D / CIM 主视图 | CSS/SVG HMI prototype | WebGPU renderer + OpenUSD / IFC / 3D Tiles |
| 3DGS 实景层 | fixture 标注为 video/photo/360 来源 | SPZ / PLY runtime loader,支持视频重建实景 |
| 点云校核层 | E57 / LiDAR residual 标注 | E57 / LAS / LAZ 控制点与残差热图 |
| BIM 语义层 | IFC4.3 / MBD fixture | buildingSMART IFC4.3 / IDS / BCF 校验 |
| 算测融合 | FEA / ROM / PHM fixture | Rust/C++ solver bridge + sensor correction |
| 流程孪生 | DDMRP / MES / WMS fixture | Simio-style discrete-event simulation |
| AI Agent | LangGraph / Hermes / Langfuse trace 标注 | RFI/NCR/规范检索 + 闭环整改建议 |

---

## 7. 标准与法规基线

本模块 UI 和数据不得只写中国规范,必须保留多法域映射能力:

| 类别 | 基线 |
|------|------|
| openBIM | buildingSMART IFC4.3, IDS, BCF, ISO 19650 |
| 中国 | GB 50017, GB 50205, GB 50661, GB 55006, GB 50500 |
| 美国 | AISC 360, AWS D1.1, RCSC, OSHA lift planning |
| 欧洲 | EN 1993, EN 1090, EN 14399, ISO 17635 |
| 澳洲 | AS 4100, AS/NZS 5131 |
| 项目管理 | PMBOK, IPMA ICB, ISO 21502 |
| 资产与孪生 | ISO 23247, ISO 55000, PHM |

---

## 8. 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| DT-AC-001 | `/app/digital-twin` 必须是 HMI / SCADA / CIM 驾驶舱风格; `/app/modules/digital_twin` 必须仍是统一 CDE 模块工作台 | Playwright screenshot |
| DT-AC-002 | `digital_twin` fixture 必须包含 9 个工程生命期节点 | Vitest |
| DT-AC-003 | 3DGS source 必须明确来自 video / photo / 360 等影像来源,并声明 LiDAR/E57 只做控制点或残差校核 | Vitest |
| DT-AC-004 | 必须包含焊缝、螺栓、吊装、点云残差、IFC/IDS、形性一体门禁 | Vitest |
| DT-AC-005 | 必须包含 IFC4.3、STEP、BOM、Inspection、BCF 等交付导出 | Vitest |
| DT-AC-006 | `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build` 必须通过 | CI / local |

---

## 9. 当前实现映射

| 文档需求 | 实现文件 |
|----------|----------|
| UI 信息架构 | [`../03-frontend/components/DigitalTwinWorkbench.tsx`](../03-frontend/components/DigitalTwinWorkbench.tsx) |
| 数据契约 | [`../03-frontend/lib/digital-twin.ts`](../03-frontend/lib/digital-twin.ts) |
| 验收测试 | [`../03-frontend/lib/digital-twin.test.ts`](../03-frontend/lib/digital-twin.test.ts) |
| 独立驾驶舱入口 | [`../03-frontend/app/app/digital-twin/page.tsx`](../03-frontend/app/app/digital-twin/page.tsx) |
| 模块工作台入口 | [`../03-frontend/app/app/modules/[moduleId]/page.tsx`](../03-frontend/app/app/modules/[moduleId]/page.tsx), [`../03-frontend/components/ModuleFileExplorer.tsx`](../03-frontend/components/ModuleFileExplorer.tsx) |

---

## 10. 后续开发顺序

1. 将 HMI scene nodes 抽出为可配置 JSON / TOML。
2. 接入真实 `digital_twin` API,替换 fixture。
3. 增加 3DGS SPZ / PLY loader,并与 E57 点云控制点对齐。
4. 接入 IFC4.3 / IDS / BCF 校验结果。
5. 接入 IoT / SCADA / MQTT / OPC UA 实时流。
6. 接入 FEA / ROM / PHM 算测融合服务。
7. 接入 LangGraph / Hermes Agent 风险解释与整改建议。
