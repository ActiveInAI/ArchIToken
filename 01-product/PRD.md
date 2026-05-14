# ArchIToken · 产品需求文档 (PRD)

**文档编号**: ARCHITOKEN-PRD-V2.0
**定稿日期**: 2026-04-19
**主理人**: ActiveInAI (AIA) · OPC
**哲学基础**: Harness Engineering (智灵姐 · 2026-04-14)

---

## 0. 定位声明

ArchIToken 不是"又一个 AEC AI 工具"。它是:

> **AEC 行业专用的大模型缰绳 (Harness for AEC)。**
>
> 让建筑工程师不需要成为 AI 专家,就能让 AI 安全、稳定、合规地为他们干活。

核心公式(宪法第 1 条): `Agent = Model + Harness`

ArchIToken 全部价值在 Harness 层。模型 (Claude 4.x / GPT-5.2 / Qwen3.5 / GLM4.7 / DeepSeek V3.2) 是可替换组件,随时可热插拔。

---

## 1. 目标用户

### 1.1 主用户画像 (3 类)

| 画像 | 描述 | 痛点 | ArchIToken 解法 |
|------|------|------|---------------|
| **小型开发商 / 甲方** | 2-20 人团队,做自建房、轻钢别墅、装配式住宅 | 看不懂图纸、不会判造价、被设计院 / 施工队信息不对称碾压 | 传入户型草图 → 产出 3D + 造价 + 合规审查,全部自动 |
| **独立建筑师 / 小事务所** | 1-10 人,做方案深化、扩初、施工图 | Revit / Rhino 工时消耗 80%,真正的设计思考只剩 20% | AI 生成首版 BIM → 架构师只做审美决策与规范修正 |
| **施工队长 / 项目经理** | 带 5-50 人现场班组 | 图纸看错、工程量算错、进度对不上 | 扫图纸进 App → 自动工程量清单 + 4D 施工时序 + 现场合规自检 |

### 1.2 非目标用户 (明确排除)

- ❌ 大型国央企设计院 (已有龙图、PKPM、鸿业等国产 CAD 体系,不是 ArchIToken 的早期用户)
- ❌ 超高层 / 大型公共建筑 (非锦屏案例规模,需要风荷载、地震、消防等超专项,v2.0 不覆盖)
- ❌ 文物保护 / 历史建筑 (规范极其特殊,作为未来独立产品线)

---

## 2. 核心能力 (14 模块 · 并列架构)

### 2.1 十四模块 (registry-based · 未来可增删)

**2026-05-14 代码同步**: 当前 Rust / 前端注册表为 **14 个 active module**,采用 **registry-based 模块并列架构 + 运行时注册**。
完整规范: [`../02-architecture/MODULES.md`](../02-architecture/MODULES.md)
注册机制: [`../02-architecture/MODULE-REGISTRY.md`](../02-architecture/MODULE-REGISTRY.md)

```
 1 · marketing_service        · 市场客服
 2 · planning_management      · 计划管理
 3 · concept_design           · 方案设计
 4 · standard_library         · 标准族库          (全局引用资源)
 5 · detailed_design          · 深化设计
 6 · quantity_costing         · 计量造价
 7 · material_logistics       · 材料物流
 8 · production_manufacturing · 生产制造
 9 · construction_supervision · 施工管理
10 · digital_twin             · 数字孪生
11 · digital_archive          · 数字档案
12 · finance_hr               · 财务人力
13 · ai_center                · AI中心
14 · settings_center          · 设置中心          (side-car · 无上下游)
```

每个模块在 LangGraph 1.1.8 里编译为 planner / generator / evaluator 三节点图:

| order | 模块 id                      | 中文名     | 典型输入                         | 典型输出                                   | SLA   |
|:-----:|------------------------------|-----------|---------------------------------|--------------------------------------------|-------|
| 1     | `marketing_service`          | 市场客服   | 客户需求描述 + 场地照片          | 报价单 + 初版方案 PDF                      | 60s   |
| 2     | `planning_management`        | 计划管理   | 商机 + 需求 + 资源约束           | WBS + 里程碑 + 资源计划 + 审批计划         | 60s   |
| 3     | `concept_design`             | 方案设计   | 户型 / 面积 / 风格偏好           | 3 个方案 SVG + 3D + 造价估                | 90s   |
| 4     | `standard_library`           | 标准族库   | 族 / 材料 / 规范条款维护请求     | 版本化族库条目 + 规范绑定                  | 60s   |
| 5     | `detailed_design`            | 深化设计   | 选定方案 + 规范要求 + 族库引用   | BIM (IFC4) + 结构计算 + 施工图 + 碰撞报告 | 180s  |
| 6     | `quantity_costing`           | 计量造价   | BIM + 材料市场价 + 定额          | BOQ (GB 50500 + CSI 双口径) + 报价 Excel  | 60s   |
| 7     | `material_logistics`         | 材料物流   | BOQ + 加工 BOM + 场地坐标        | 运输路径 + 吊装顺序 + 堆料计划             | 60s   |
| 8     | `production_manufacturing`   | 生产制造   | 结构件 BIM + 族库构件            | CNC / 焊接文件 + 加工 BOM + 质检单         | 90s   |
| 9     | `construction_supervision`   | 施工管理   | 4D 模拟 + 到场构件 + 规范条款    | 进度计划 + 班组调度 + 安全/验收报告 + 整改清单 | 180s |
| 10    | `digital_twin`               | 数字孪生   | 竣工 IFC + IoT 传感器            | 三维运维视图 + 异常告警 + 维保计划         | 实时流 |
| 11    | `digital_archive`            | 数字档案   | 各模块最终工件 + 交付规范        | 归档包 + 保存周期元数据                    | 60s   |
| 12    | `finance_hr`                 | 财务人力   | 合同 / 预算 / 人员 / 成本事实    | 资金计划 + 成本归集 + 班组绩效             | 60s   |
| 13    | `ai_center`                  | AI中心     | 模型 / RAG / MCP / Agent 配置    | 模型路由 + 工具权限 + 成本审计策略         | 实时   |
| 14    | `settings_center` *(side-car)* | 设置中心 | 租户 / RBAC / 模型路由 / 预算配置 | 全局配置推送 (被其它 13 模块拉取)          | 实时   |

**架构承诺**: 未来新增模块(例如"拿地分析 / 方案投标 / 碳排放核算")不需改任何已有代码 —— 只在
`modules` 表 + Rust `REGISTRY` + Python `MODULE_REGISTRY` 各加一行,加配 3 个 prompt 文件即可。

### 2.2 核心技术能力

| # | 能力 | 技术实现 |
|---|------|---------|
| 1 | **50+ AEC 文件格式解析** | Rust 原生 (acadrust 0.3.4 / ifc-lite-core 2.1.9 / pdf_oxide 0.3.34 / quick-xml 0.39.2) |
| 2 | **多模态 AI 生成** | 文生图 (ComfyUI 0.19.3 外部服务) / 文生 3D / 图生 3D (Hunyuan3D-2 via SGLang 0.5.10) |
| 3 | **智能合规审查** | RAG (GB 50001 系列 + IFC schema) → LangGraph Reviewer Agent |
| 4 | **智能工程量清单 (BOQ)** | IFC → 几何拓扑分析 → 材料库匹配 → Excel/PDF 输出 |
| 5 | **资产标签 (Asset Tagging)** | 每个构件自动生成二维码 + 属性表 (进场/安装/验收时间) |
| 6 | **实时协同编辑** | Supabase Realtime 2.85.2 (WebSocket CDC) → 多人同步 BIM 批注 |
| 7 | **数字孪生** | IFC → glTF + three.js r184 + IoT 时序数据流 |
| 8 | **项目管理** | 14 模块看板 + 甘特图 + 班组排班 (看板从 `/v1/modules` 动态渲染) |
| 9 | **可视化运营监控** | Prometheus + Grafana + 自定义 ArchIToken Dashboard |

---

## 3. 全球市场定位

### 3.1 两阶段上市策略

**Phase 0 (2026 Q2-Q3) — 中国锚点期**
- 锚点项目: 应舍美居·锦屏 (贵州黔东南 · 520㎡ 三层重钢别墅 · ¥680K · 45 天交付)
- 验证点: 文档覆盖中国 GB 规范、Qwen3.5 + GLM4.7 国产模型链路、supabase 自托管 (数据不出境)
- 目标: 3 个示范项目,全部来自贵州/四川/云南小型开发商

**Phase 1 (2026 Q4+) — 全球开源期**
- 开源所有代码 (100% Apache-2.0/MIT/BSD)
- 英文文档 + 多语言 UI (i18n: zh-CN, en-US, es-ES, ja-JP, de-DE 优先 5 语言)
- 国际模型通道: Claude 4.7 / GPT-5.2 / Gemini 3.0 / Llama 4
- 国际规范覆盖: IBC (美国), Eurocode (欧盟), 日本建筑基准法

### 3.2 语言 / 区域矩阵

| 区域 | UI 语言 | 推理引擎 | 规范库 | 数据驻留 |
|------|---------|---------|---------|---------|
| 中国大陆 | zh-CN | LMDeploy (Qwen3.5/GLM4.7) + vLLM | GB 50001 系列 | 自建数据中心 / 阿里云 |
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

### 5.1 AI 5 重缺陷防御 (宪法 §11)

| 缺陷 | 防御 |
|------|------|
| 幻觉 | RAG 强制引用 + 生成器/评估器双 Agent |
| 偏见 | 训练数据审计 + 输出多样性检测 |
| 越权 | RBAC + 沙箱 + 二次确认 |
| 隐私泄露 | 数据脱敏 + 审计日志 + 加密传输/存储 |
| 提示注入 | 输入过滤 + 工具白名单 + 结构化输出 |

### 5.2 合规矩阵

| 法规 | 区域 | 应对 |
|------|------|------|
| GDPR | 欧盟 | 数据本地化 + 被遗忘权 API + DPO 联系人 |
| 中国《网络安全法》《数据安全法》《个人信息保护法》 | 中国 | 数据境内存储 + 安全评估 + 个人信息出境备案 |
| CCPA | 美国加州 | Do Not Sell + 数据访问权 API |
| HIPAA | 美国 (医疗建筑适用) | 不直接适用,但提供加密与审计能力备用 |

---

## 6. 成功指标 (Phase 0)

- ✅ 3 个示范项目全流程跑通 (marketing_service → digital_archive · 14 模块)
- ✅ 生成 SLA 达标率 ≥ 95%
- ✅ 单项目节省设计工时 ≥ 60% (对比传统 Revit 流程)
- ✅ 零重大 AI 缺陷事故 (幻觉导致的规范错误)
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
- `02-architecture/CONSTITUTION.md` (21 条宪法)

---

**文档终**
