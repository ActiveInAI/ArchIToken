# ArchIToken · 业务模块工作台开发契约

**文档编号**: ARCHITOKEN-BUSINESS-MODULE-WORKBENCH-V1  
**所属架构**: 11 modules registry · [`MODULES.md`](./MODULES.md)  
**状态**: active prototype · frontend module workbench  
**定稿日期**: 2026-04-24  
**适用范围**: `marketing_service` 到 `settings_center` 的 11 个业务模块统一入口

---

## 1. 目标

业务模块工作台用于把 ArchIToken 的 11 个模块从“首页展示”推进到“可开发、可测试、可扩展”的产品入口。

本工作台不是替代每个模块的深度页面,而是所有模块的统一控制台:

1. 显示模块顺序、上下游、状态、输入输出和关键交付物。
2. 为每个模块定义 AI Agent 能力、标准法规基线、数据对象和质量门禁。
3. 为后续模块深挖提供统一路由、统一 fixture、统一测试契约。
4. 避免为每个模块临时复制一套页面结构。

---

## 2. 模块范围

工作台必须覆盖 [`MODULES.md`](./MODULES.md) 中定义的全部 11 个模块:

| order | id | 中文名 | 当前开发策略 |
|-------|----|--------|--------------|
| 1 | `marketing_service` | 市场客服 | 商机入口与需求捕获 |
| 2 | `concept_design` | 方案设计 | 多方案生成与概念模型 |
| 3 | `standard_library` | 标准族库 | 全局规范、族库、材料库 |
| 4 | `detailed_design` | 深化设计 | IFC/IDS、节点详图、碰撞审查 |
| 5 | `quantity_costing` | 计量造价 | MTO/BOQ/BOM、价格与变更 |
| 6 | `material_logistics` | 材料物流 | DDMRP、采购、运输、到场 |
| 7 | `manufacturing` | 加工制造 | CNC、焊接、MES、质检 |
| 8 | `construction_supervision` | 施工监理 | 进度、质量、安全、AR、点云、影像 |
| 9 | `digital_twin` | 数字孪生 | HMI/SCADA/CIM 大屏,见 [`DIGITAL_TWIN.md`](./DIGITAL_TWIN.md) |
| 10 | `digital_archive` | 数字档案 | 合同、图纸、模型、检测、签章、长期留存 |
| 11 | `settings_center` | 设置中心 | 租户、RBAC、模型路由、SLA、合规策略 |

---

## 3. UI 信息架构

### 3.1 桌面布局

桌面工作台必须包含 5 个区域:

| 区域 | 内容 |
|------|------|
| 顶部总览 | 模块总数、已试点模块、关键门禁、AI Agent 覆盖率 |
| 左侧模块链 | 11 模块列表,展示顺序、状态、上下游类型 |
| 中央模块详情 | 当前模块目标、输入、输出、交付物、AI 能力 |
| 右侧治理面板 | 标准法规、质量门禁、数据对象、风险提醒 |
| 底部路线图 | 从统一工作台进入模块深度页、API、Agent prompt、数据库表 |

### 3.2 移动布局

移动端允许纵向堆叠,但必须保留:

1. 顶部总览。
2. 模块链。
3. 当前模块详情。
4. 治理面板。
5. 路线图。

---

## 4. 数据契约

前端 fixture 和后续 API DTO 必须至少包含:

| 字段 | 说明 |
|------|------|
| `id` | `ModuleId` 英文蛇形 key |
| `order` | UI 默认排序 |
| `zhName` / `enName` | 中英文显示名 |
| `status` | `active` / `pilot` / `planned` / `foundation` |
| `summary` | 2 到 4 句模块描述 |
| `inputs` / `outputs` | 上下游模块 id |
| `primaryArtifacts` | 当前模块主要交付物 |
| `aiCapabilities` | Planner / Generator / Evaluator 或工具能力 |
| `standards` | 标准法规基线 |
| `qualityGates` | 质量门禁 |
| `dataObjects` | 主数据对象或表 |
| `routeHref` | 前端入口 |

---

## 5. 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| BMW-AC-001 | fixture 必须覆盖 11 个模块,顺序与 `MODULES.md` 一致 | Vitest |
| BMW-AC-002 | 每个模块必须有输入输出、交付物、AI 能力、标准、质量门禁、数据对象 | Vitest |
| BMW-AC-003 | 所有 `inputs` / `outputs` 必须引用合法模块 id | Vitest |
| BMW-AC-004 | `digital_twin` 必须链接到 `/app/digital-twin` 和 `DIGITAL_TWIN.md` | Vitest |
| BMW-AC-005 | `/app/modules` 必须能在桌面与移动端渲染 | Playwright screenshot |
| BMW-AC-006 | `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build` 必须通过 | CI / local |

---

## 6. 当前实现映射

| 文档需求 | 实现文件 |
|----------|----------|
| 工作台页面 | [`../03-frontend/app/app/modules/page.tsx`](../03-frontend/app/app/modules/page.tsx) |
| 工作台组件 | [`../03-frontend/components/BusinessModuleWorkbench.tsx`](../03-frontend/components/BusinessModuleWorkbench.tsx) |
| 数据契约 | [`../03-frontend/lib/business-modules.ts`](../03-frontend/lib/business-modules.ts) |
| 验收测试 | [`../03-frontend/lib/business-modules.test.ts`](../03-frontend/lib/business-modules.test.ts) |

---

## 7. 后续开发顺序

1. 为 `construction_supervision` 深度页面接入已有 production-ready prompt 目录。
2. 为 `detailed_design` 增加 IFC / IDS / BCF 审查页面。
3. 为 `manufacturing` 增加重钢构件加工排产页面。
4. 为 `material_logistics` 增加 DDMRP 与构件运输页面。
5. 为 `digital_archive` 增加合同、图纸、模型、检测档案入口。
6. 为 `settings_center` 增加租户、RBAC、模型路由和合规策略。
