# ArchIToken · 定位与竞品战略

**文档编号**: ARCHITOKEN-POSITIONING-COMPETITIVE-STRATEGY-V1
**状态**: Active
**适用范围**: 产品定位、架构评审、路线图、对外叙事、竞品对标、模块验收
**核心公式**:

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

---

## 1. 定位

ArchIToken 是 AEC 行业的 AI-Native 平台、Harness Engineering 系统、OpenBIM CDE Workflow OS、Speckle CDE 互操作运行时、IFCDB-Agent 数据库/Agent 路由和后端原生文件运行时。它负责把模型、文件、标准、BIM 语义、业务对象、审批、Agent、工具、审计和交付物组织成可运行、可追踪、可回滚、可私有化部署的工程系统。

### 1.1 三层身份

| 层 | 身份 | 边界 |
|---|---|---|
| AEC AI-Native | AEC 业务对象、标准、文件、审批和模型运行时原生围绕 AI 协作设计 | Planner、Generator、Evaluator、RuleChecker、SchemaValidator、Approver、Router |
| Harness Engineering | 让通用模型和工程工具在强约束下安全干活 | Router、Sandbox、RollbackGuard、Schema Gate、审计、权限、回滚 |
| OpenBIM CDE Workflow OS | 工程文件、对象、版本、权限、审批、审计和交付证据底座 | IFC、IDS、BCF、bSDD、COBie、OpenCDE API、Speckle、IFCDB-Agent、对象存储、PostgreSQL、长期归档 |
| openBIM/Speckle Runtime | CDE 内的开放 BIM 语义和对象级协同运行时 | IFC、IDS、BCF、bSDD、COBie、OpenCDE API、Speckle stream/object/commit/connector、IFCDB-Agent query/object graph |
| Backend-native File Runtime | 所有复杂格式优先由后端 worker、授权适配器或企业服务处理 | DXF、DWG、RVT、DGN、Office、PDF、STEP、GLB、点云、3D Tiles、真实源文件绑定 |
| Module Workflow OS | 14 模块并列运行的业务操作系统 | 商机、计划、方案、标准、深化、造价、物流、生产、施工、孪生、档案、财务人力、AI 中心、设置中心 |

### 1.2 一句话

ArchIToken 不伪造 Revit、Tekla、广联达、PKPM、ZWCAD 或 Siemens Building X 的专有内核。ArchIToken 追求成为企业可私有化部署的开放工程 CDE 与运行时,通过 openBIM/Speckle、后端原生解析和授权适配器连接这些生态。

---

## 2. 我们做什么

ArchIToken 必须优先建设这些能力:

- 私有化部署、本地模型、本地数据、弱网与离线可运行。
- OpenAPI、AsyncAPI、JSON Schema、IFC Schema、Module Schema 多 Schema 真源。
- IFC、IDS、BCF、bSDD、COBie 等 openBIM 语义与交付门禁。
- 模块文件系统、版本、权限、生命周期、审批、审计和交付物归档。
- Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver 的工程门禁链。
- 从市场客服到数字档案的 14 模块闭环。
- 中国重钢结构、装配式、制造、施工、交付场景的深度业务模板。
- 与 Autodesk、Trimble、Siemens、广联达、PKPM、斯维尔、中望等生态通过适配器连接。

---

## 3. 我们不做什么

ArchIToken 不以复刻成熟大厂单点能力为路线:

- 不做 Revit / Tekla / ZWCAD 级别的通用 CAD/BIM 建模器。
- 不做 PKPM 级别的结构计算与强审查认证系统。
- 不做广联达 / 斯维尔级别的全国定额、计价、算量软件全量替代。
- 不做 Siemens 级别的楼宇自控、工业控制与大型运维生态全栈。
- 不依赖封闭格式、私有 SDK 或不可审计黑盒作为核心运行时。
- 不复制、逆向、嵌入或分发竞品专有代码、WASM、二进制、规则库、定额库或模型库。

这些能力可以通过导入导出、插件、适配器、人工确认、企业授权、独立外部服务接入,但不得成为 ArchIToken 核心不可替换依赖。

---

## 4. 竞品对标边界

| 对象 | 强项 | ArchIToken 正确打法 |
|---|---|---|
| buildingSMART / openBIM | IFC、IDS、BCF、bSDD 等开放标准 | 兼容和执行标准,不把标准组织当竞品 |
| Speckle | 开源 AEC 数据协同、连接器、对象级数据流 | 学习开放数据流和连接器生态,用 Module Workflow OS 做工程闭环 |
| Autodesk / Forma / ACC / Revit | 设计建模、云协同、Docs、Revit 生态 | 做数据与审批审计层,通过 IFC、ACC API、文件同步等方式连接 |
| Trimble / Tekla / Trimble Connect | 钢结构深化、加工图、CDE、现场协同 | 尊重其深化能力,重点承接模型、制造、施工、归档与 AI 门禁 |
| Siemens / Building X / Lifecycle Twin | 运营数字孪生、资产运维、楼宇系统生态 | 学习运维孪生,优先做施工交付证据与重钢项目动态孪生 |
| 广联达 | 数字建筑平台、BIM5D、造价、施工、行业客户 | 先做数据闭环和适配器,在轻量项目和 AI 审计链上差异化 |
| 北京构力 / PKPM | 中国结构设计、审查、规范与工程计算 | 不硬碰结构计算,优先接入校核结果、审查证据和规范 RAG |
| 斯维尔 | BIM 算量、Revit/CAD/中望 CAD 算量 | 连接其算量结果,沉淀到 CDE、成本、审批和档案链 |
| 中望 / ZWCAD / ZW3D | DWG 兼容 CAD、2D/3D CAD/CAE/CAM | 不做桌面 CAD 替代,做 DWG/DXF 解析、预览、审计和工作流 |

---

## 5. 可超越方向

ArchIToken 的超越不来自“功能更多”,而来自“工程链条更闭环、AI 更可控、数据更开放”。

必须优先证明以下超越点:

1. **开放闭环**: 从商机到档案的 14 模块都能通过开放格式、Schema、审计事件闭环。
2. **AI 可控**: 生成器不能自评,关键输出必须经过评估、规则、Schema 和审批。
3. **私有化可交付**: 企业生产环境可本地部署,支持本地模型、本地对象存储和租户隔离。
4. **证据链优先**: 每个文件、对象、AI 输出、审批动作、交付物都有审计和版本轨迹。
5. **重钢场景深度**: 在 520 平米三层重钢别墅锚点项目中跑通设计、造价、制造、施工、孪生、档案。
6. **适配器生态**: 不替代一切,而是把主流工具输出接入统一工作流和 AI 门禁。

---

## 6. 禁止表述

任何 PR、文档、官网、演示或销售材料不得无证据宣称:

- “全面超越 Autodesk / Tekla / 广联达 / PKPM / Siemens”。
- “完全替代 Revit / Tekla / PKPM / 广联达 / 中望”。
- “自动生成可直接施工或可直接报审的结果”。正确表述必须是“生成待专业复核、待审批、待签章的草稿或预审结果”。
- “支持某竞品专有格式/规则库”,除非法律、许可、测试和数据流边界已完成评审。

允许表述:

- “对标主流 AEC 数据、协同、造价、施工、孪生平台的关键工作流”。
- “在开放数据、AI 审计、私有化部署和模块闭环上形成差异化优势”。
- “通过适配器连接 Autodesk、Trimble、Siemens、广联达、PKPM、斯维尔、中望等生态”。

---

## 7. 验收门槛

声称具备竞品级能力前,必须提供:

- 真实项目数据或可复现样例。
- 输入、输出、Schema、规则、审计事件完整链路。
- 导入导出兼容性测试。
- 性能、稳定性、错误恢复和回滚测试。
- 许可证与数据合规评审。
- 与至少一个主流工具或开放标准的互操作证明。

---

## 8. 路线优先级

1. 统一模块工作台、文件系统、生命周期、审批、审计。
2. openBIM / IFC / IDS / BCF / bSDD / COBie 的导入、验证、证据链。
3. 施工管理、生产制造、计量造价、数字档案的真实项目闭环。
4. 数字孪生作为施工、质量、安全、成本、档案证据层,不是孤立大屏。
5. Autodesk / Trimble / Speckle / 广联达 / PKPM / 斯维尔 / 中望适配器矩阵。
6. 行业基准测试、示范项目报告、对外案例。

---

## 9. 与宪法关系

本文件是 `CONSTITUTION.md` 的定位扩展。若本文与宪法冲突,以宪法为准; 若代码、PRD、README、演示页面与本文冲突,以本文和宪法为准。
