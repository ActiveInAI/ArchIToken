# ArchIToken · 产品需求文档 (PRD)

**文档编号**: ARCHITOKEN-PRD-V2.0
**历史仓库 / 代码库名**: ArchIToken
**定稿日期**: 2026-04-19
**主理人**: ActiveInAI (AIA) · OPC
**哲学基础**: Harness Engineering (智灵姐 · 2026-04-14)

---

## 0. 定位声明

ArchIToken 不是"又一个 AEC AI 工具"。它是:

> **AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS。**
>
> 让建筑工程师不需要成为 AI 专家,就能让 AI 安全、稳定、合规地为他们干活。

核心公式(宪法第 1 条): `ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS`

ArchIToken 全部价值在 Harness 层。具体供应商模型和版本是可替换运行时配置,不得写死在产品契约里。`ArchIToken` 保留为历史仓库、路径、包名/API 兼容标识和迁移期技术别名。

产品公式:

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

ArchIToken 不是 Revit、Tekla、PKPM、广联达、中望、Siemens Building X 等单点产品的复刻或替代。ArchIToken 是它们之上的开放工程智能操作层,负责把文件、模型、标准、业务对象、AI Agent、审批、审计、生命周期和交付物组织成可私有化运行的工程系统。

定位与竞品边界以 [`../02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md`](../02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md) 为准。

---

## 1. 目标用户

### 1.1 主用户画像 (3 类)

| 画像 | 描述 | 痛点 | ArchIToken 解法 |
|------|------|------|---------------|
| **小型开发商 / 甲方** | 2-20 人团队,做自建房、轻钢别墅、装配式住宅 | 看不懂图纸、不会判造价、被设计院 / 施工队信息不对称碾压 | 传入户型草图 → 生成 3D、造价估算和合规风险草稿 → 注册人员/项目责任人复核 |
| **独立建筑师 / 小事务所** | 1-10 人,做方案深化、扩初、施工图 | Revit / Rhino 工时消耗 80%,真正的设计思考只剩 20% | AI 生成首版 BIM 和审查清单 → 建筑师、结构师、造价师按专业边界复核 |
| **施工队长 / 项目经理** | 带 5-50 人现场班组 | 图纸看错、工程量算错、进度对不上 | 扫图纸进 App → 生成工程量草稿、4D 施工时序和现场风险自检清单 → 建造师/监理师确认 |

### 1.2 非目标用户 (明确排除)

- ❌ 大型国央企设计院 (已有龙图、PKPM、鸿业等国产 CAD 体系,不是 ArchIToken 的早期用户)
- ❌ 超高层 / 大型公共建筑 (非锦屏案例规模,需要风荷载、地震、消防等超专项,v2.0 不覆盖)
- ❌ 文物保护 / 历史建筑 (规范极其特殊,作为未来独立产品线)

---

## 2. 核心能力 (16 模块 · 并列架构)

### 2.1 十六模块 (registry-based · 未来可增删)

**2026-06-01 代码同步**: 当前 Rust / 前端注册表为 **16 个 active module**,采用 **registry-based 模块并列架构 + 运行时注册**。
完整规范: [`../02-architecture/MODULES.md`](../02-architecture/MODULES.md)
注册机制: [`../02-architecture/MODULE-REGISTRY.md`](../02-architecture/MODULE-REGISTRY.md)

```
 1 · personal_center          · 个人中心
 2 · marketing_service        · 市场客服
 3 · planning_management      · 计划管理
 4 · concept_design           · 方案设计
 5 · standard_library         · 标准族库          (全局引用资源)
 6 · detailed_design          · 深化设计
 7 · quantity_costing         · 计量造价
 8 · material_logistics       · 材料物流
 9 · production_manufacturing · 生产制造
10 · construction_management  · 施工管理
11 · digital_twin             · 数字孪生
12 · digital_archive          · 数字档案
13 · finance_management       · 财务管理
14 · human_resources          · 人力资源
15 · ai_center                · AI中心
16 · settings_center          · 设置中心          (side-car · 无上下游)
```

每个模块在 LangGraph 1.1.8 里编译为 planner / generator / evaluator 三节点图:

| order | 模块 id                      | 中文名     | 典型输入                         | 典型输出                                   | SLA   |
|:-----:|------------------------------|-----------|---------------------------------|--------------------------------------------|-------|
| 1     | `personal_center`            | 个人中心   | 个人资料 / 账号安全 / 最近工作   | 个人待办 + 最近文件 + 通知偏好             | 实时   |
| 2     | `marketing_service`          | 市场客服   | 客户需求描述 + 场地照片          | 报价单 + 初版方案 PDF                      | 60s   |
| 3     | `planning_management`        | 计划管理   | 商机 + 需求 + 资源约束           | WBS + 里程碑 + 资源计划 + 审批计划         | 60s   |
| 4     | `concept_design`             | 方案设计   | 户型 / 面积 / 风格偏好           | 3 个方案 SVG + 3D + 造价估                | 90s   |
| 5     | `standard_library`           | 标准族库   | 族 / 材料 / 规范条款维护请求     | 版本化族库条目 + 规范绑定                  | 60s   |
| 6     | `detailed_design`            | 深化设计   | 选定方案 + 规范要求 + 族库引用   | BIM (IFC4) + 结构计算 + 施工图 + 碰撞报告 | 180s  |
| 7     | `quantity_costing`           | 计量造价   | BIM + 材料市场价 + 定额          | BOQ (GB 50500 + CSI 双口径) + 报价 Excel  | 60s   |
| 8     | `material_logistics`         | 材料物流   | BOQ + 加工 BOM + 场地坐标        | 运输路径 + 吊装顺序 + 堆料计划             | 60s   |
| 9     | `production_manufacturing`   | 生产制造   | 结构件 BIM + 族库构件            | CNC / 焊接文件 + 加工 BOM + 质检单         | 90s   |
| 10    | `construction_management`    | 施工管理   | 4D 模拟 + 到场构件 + 规范条款    | 进度计划 + 班组调度 + 安全/验收报告 + 整改清单 | 180s |
| 11    | `digital_twin`               | 数字孪生   | 竣工 IFC + IoT 传感器            | 三维运维视图 + 异常告警 + 维保计划         | 实时流 |
| 12    | `digital_archive`            | 数字档案   | 各模块最终工件 + 交付规范        | 归档包 + 保存周期元数据                    | 60s   |
| 13    | `finance_management`         | 财务管理   | 合同 / 预算 / 收付款 / 发票 / 成本事实 | 资金计划 + 成本归集 + 结算归档       | 60s   |
| 14    | `human_resources`            | 人力资源   | 人员 / 班组 / 资质 / 考勤 / 绩效依据 | 班组绩效 + 工时结算依据 + 人员合规档案 | 60s   |
| 15    | `ai_center`                  | AI中心     | 模型 / RAG / MCP / Agent 配置    | 模型路由 + 工具权限 + 成本审计策略         | 实时   |
| 16    | `settings_center` *(side-car)* | 设置中心 | 人员 / 账号 / 密码 / 单位岗位 / 权限 | 身份与权限配置推送 (被其它模块拉取)        | 实时   |

当前阶段,Paperclip v2026.517.0 完整接管 `production_manufacturing` 模块主工作区,用于 Agent 组织、工厂任务、heartbeat、预算和治理编排;不得替代 ArchIToken 的模块 ID、CDE 文件、CNC/QC/MES/ERP 真源或专业审批结论。

**架构承诺**: 未来新增模块(例如"拿地分析 / 方案投标 / 碳排放核算")不需改任何已有代码 —— 只在
`modules` 表 + Rust `REGISTRY` + Python `MODULE_REGISTRY` 各加一行,加配 3 个 prompt 文件即可。

### 2.2 核心技术能力

| # | 能力 | 技术实现 |
|---|------|---------|
| 1 | **50+ AEC 文件格式解析** | Rust 原生 (acadrust 0.3.4 / ifc-lite-core 2.1.9 / pdf_oxide 0.3.34 / quick-xml 0.39.2) |
| 2 | **多模态 AI 生成** | 文生图 (ComfyUI 0.19.3 外部服务) / 文生 3D / 图生 3D (Hunyuan3D-2 via SGLang 0.5.10) |
| 3 | **智能合规预审** | RAG (标准族库 + IFC schema) → RuleChecker → SchemaValidator → 专业复核状态机 |
| 4 | **智能工程量清单 (BOQ)** | IFC → 几何拓扑分析 → 材料库匹配 → Excel/PDF 输出 |
| 5 | **资产标签 (Asset Tagging)** | 每个构件自动生成二维码 + 属性表 (进场/安装/验收时间) |
| 6 | **实时协同编辑** | Supabase Realtime 2.85.2 (WebSocket CDC) → 多人同步 BIM 批注 |
| 7 | **数字孪生** | IFC → glTF + three.js r184 + IoT 时序数据流 |
| 8 | **项目管理** | 16 模块看板 + 甘特图 + 班组排班 (看板从 `/v1/modules` 动态渲染) |
| 9 | **可视化运营监控** | Prometheus + Grafana + 自定义 ArchIToken Dashboard |

---

## 3. 全球市场定位

### 3.0 竞品对标原则

ArchIToken 对标 Autodesk、Trimble、Siemens、Speckle、广联达、北京构力、斯维尔、中望等厂商时,只对标工作流、数据流、开放性、AI 审计、私有化和模块闭环,不宣称在 CAD/BIM 建模、结构计算、全国定额算量或楼宇运维生态上短期全面替代。

允许的市场叙事是:

- 在开放数据、AI 门禁、私有化部署和工程审计链上形成差异化优势。
- 通过适配器连接主流 CAD/BIM/造价/结构/数字孪生生态。
- 在中国重钢结构小中型项目闭环上形成垂直深度。

禁止的市场叙事是:

- 无证据宣称全面超越或完全替代成熟大厂软件。
- 把封闭专有格式、规则库、SDK 或二进制作为核心不可替换依赖。

### 3.1 两阶段上市策略

**Phase 0 (2026 Q2-Q3) — 中国锚点期**
- 锚点项目: 应舍美居·锦屏 (贵州黔东南 · 520㎡ 三层重钢别墅 · ¥680K · 45 天交付)
- 验证点: 文档覆盖中国 GB 规范、国产/本地模型链路、supabase 自托管 (数据不出境)
- 目标: 3 个示范项目,全部来自贵州/四川/云南小型开发商

**Phase 1 (2026 Q4+) — 全球开源期**
- 开源所有代码 (100% Apache-2.0/MIT/BSD)
- 英文文档 + 多语言 UI (i18n: zh-CN, en-US, es-ES, ja-JP, de-DE 优先 5 语言)
- 国际模型通道: OpenAI-compatible gateway + role-based model aliases
- 国际规范覆盖: IBC (美国), Eurocode (欧盟), 日本建筑基准法

### 3.2 语言 / 区域矩阵

| 区域 | UI 语言 | 推理引擎 | 规范库 | 数据驻留 |
|------|---------|---------|---------|---------|
| 中国大陆 | zh-CN | LMDeploy + vLLM + 本地模型路由 | GB 50001 系列 | 自建数据中心 / 阿里云 |
| 北美 | en-US | vLLM + SGLang + TensorRT-LLM | IBC / ASCE 7 | AWS us-east-1 |
| 欧盟 | en-US, es-ES, de-DE, fr-FR | vLLM + SGLang | Eurocode 0-9 | GDPR 合规, Frankfurt |
| 日本 | ja-JP | vLLM + LMDeploy | 建築基準法 | AWS ap-northeast-1 |

---

## 4. 非功能需求 (NFR)

| 类别 | 指标 | 强制等级 |
|------|------|---------|
| **生成 SLA** | 60s / 90s / 180s / 180s (见 §2.1) | **强制**,超时自动 RollbackGuard |
| **可用性** | 核心 API 99.9% (年停机 < 8.76h) | **强制** |
| **模型切换** | < 30 秒自动回滚异常模型 | **强制** |
| **数据隔离** | 多租户 RLS (PostgreSQL Row Level Security) | **强制** |
| **文件大小** | 单个 BIM 模型支持 ≥ 512 GB | **强制** |
| **并发用户** | 单 DGX Spark 集群 ≥ 1000 并发会话 | **强制** |
| **许可证** | 100% Apache/MIT/BSD,零传染性依赖 | **强制** (宪法 §3) |
| **响应延迟** | P50 < 500ms, P99 < 2s (非生成型 API) | 强推荐 |
| **冷启动** | 首屏 < 3s (Next.js 16.2 Turbopack + RSC) | 强推荐 |

---

## 5. 安全与合规

### 5.1 专业与标准合规

平台必须执行 [`../02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md`](../02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md):

- 每个模块、名词、逻辑和 AI 输出都必须绑定专业角色、监管主体、标准来源、证据链和审批状态。
- 适用角色包括 IPMP / IPMA、一级注册建筑师、一级注册结构工程师、一级注册建造师、注册造价工程师、注册监理工程师和专项工程师。
- 适用领域继续扩展到生产、运输、海关、税务、金融、财务、人力、组织、AI、数据安全、网络安全和软件工程。
- 缺少标准来源或专业责任边界时,系统只能输出“经验建议”,不得输出“合规/不合规/可施工/可报审/可验收”。
- 任何设计、结构、安全、造价、施工、监理、验收和档案类输出默认需要人工专业复核。

### 5.2 AI 5 重缺陷防御

| 缺陷 | 防御 |
|------|------|
| 幻觉 | RAG 强制引用 + 生成器/评估器双 Agent |
| 偏见 | 训练数据审计 + 输出多样性检测 |
| 越权 | RBAC + 沙箱 + 二次确认 |
| 隐私泄露 | 数据脱敏 + 审计日志 + 加密传输/存储 |
| 提示注入 | 输入过滤 + 工具白名单 + 结构化输出 |
| 规范误用 | 标准族库版本控制 + 条文来源 + 专业角色 + 人工审批 |

### 5.3 数据与隐私合规矩阵

| 法规 | 区域 | 应对 |
|------|------|------|
| GDPR | 欧盟 | 数据本地化 + 被遗忘权 API + DPO 联系人 |
| 中国《网络安全法》《数据安全法》《个人信息保护法》 | 中国 | 数据境内存储 + 安全评估 + 个人信息出境备案 |
| CCPA | 美国加州 | Do Not Sell + 数据访问权 API |
| HIPAA | 美国 (医疗建筑适用) | 不直接适用,但提供加密与审计能力备用 |

---

## 6. 成功指标 (Phase 0)

- ✅ 3 个示范项目全流程跑通 (personal_center → settings_center · 16 模块)
- ✅ 生成 SLA 达标率 ≥ 95%
- ✅ 单项目节省设计工时 ≥ 60% (对比传统 Revit 流程)
- ✅ 零重大 AI 缺陷事故 (幻觉、规范误用或未复核专业结论导致的错误)
- ✅ 开源 GitHub ≥ 1000 ⭐

---

## 7. 风险与缓解

| 风险 | 严重性 | 缓解 |
|------|--------|------|
| 模型厂商政策变化 | 高 | 6 推理引擎 + 模型白名单机制,随时切换 |
| ComfyUI GPL-3.0 传染 | 高 | 强制外部服务化,永不静态链接 |
| Revit .rvt 无 Rust 解析器 | 中 | 通过官方 IFC Exporter 桥接 (牺牲少量保真度) |
| DGX Spark 单点故障 | 中 | 双机热备 + K8s 自动迁移 |
| 中国 AEC 客户对开源的信任度 | 中 | 联合高校 / 行业协会背书 + 真实交付案例 |
| AIA 作为 OPC 的 bus factor | **极高** | **开源即风险缓解**: 代码、文档、CI 全部公开,他人可接手 |

---

## 8. 依赖的上游文档

- 《Harness 时代,谁在驾驭 AI 这匹野马》· 智灵姐 · 2026-04-14 (哲学基础)
- Anthropic 《Effective harnesses for long-running agents》· 2025-11
- OpenAI Codex Agent 工程实践博客 · 2026-02
- `02-architecture/ARCHITECTURE.md` (架构决议 v2.0)
- `02-architecture/CONSTITUTION.md` (22 条宪法)
- `02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md` (专业资格与标准规范合规基线)

---

**文档终**
