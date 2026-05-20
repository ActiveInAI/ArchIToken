# 重钢方案深化生产与 AI Token 商业化一体化协同体系

**状态**: 架构约束与实现路线。
**来源文档**: `/home/insome/下载/重钢方案深化生产与AI Token商业化一体化协同体系 · 可编辑版.html`
**文件编码**: `HS-BIM-AI-TOKEN-INTEGRATED-001`
**版本日期**: 2026-05-19

本文将用户提供的可编辑版 HTML 固化为 ArchIToken 的重钢业务实施约束。实现必须进入前端、后端、数据库、AI Router、文件派生 worker、审计和财税合同工作流,不能停留在静态页面或演示假数据。

## 1. 强制原则

1. BIM/IFC 主模型是工程语义真源,图纸、清单、报价、生产、物流、施工、数字孪生和档案必须回写模型、构件、版本和审计证据。
2. AI 只做受控生产力工具,必须经过 `Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver`。
3. “Token”在本项目内只允许表示 AI 服务额度、AI 调用点数、AI 算力点数、服务包额度和内部账单计量,不得设计为可交易虚拟币、收益权凭证或金融资产。
4. 市场客服录入的客户需求必须写入数据库,方案设计模块必须能导入这些需求,创建 AI 三维模型生成任务,并把任务结果回写 CDE 文件与业务对象。
5. 合同默认采用电子合同和电子签章流程。电子流程完成后,可补充线下纸质合同盖章,但线下流程不能替代线上审计链。
6. 意向定金是客户确认建筑方案后的业务流程节点,支付方式必须通过支付适配器隔离,支持微信、支付宝、银联、信用卡、PayPal 以及京东、抖音等渠道的可插拔扩展。
7. AI 大模型 API、私有模型推理、额度包、Token 计量、RAG 数据服务、工程审查服务和自动化工作流可作为商业化收入项,但必须保留合规边界、账单、退款和审计。

## 2. 模块闭环

| 模块 | 关键输入 | 关键输出 | 数据回写 |
|---|---|---|---|
| 市场客服 | 姓名、手机、地理位置级联(国家/省份/地市/区县/镇街)、Office/PDF 业务文档模板或自定义模板、建筑层数(1-5)、建筑结构、建筑面积、耐火等级、设防烈度、建筑风格、备注、资金预算金额与币种 | 可在线编辑的客户需求包、建筑方案草案、客户确认方案、意向定金意向、电子合同草案 Office/PDF 文档 | `marketing_requirements`, `concept_design_options`, `prepayment_intents`, CDE 文件;机器 JSON 仅作为隐藏载荷或内部接口数据 |
| 计划管理 | 客户需求包、项目边界、合同节点 | WBS、CBS、任务、里程碑 | `planning_tasks`, `work_breakdown_items` |
| 方案设计 | 市场需求、场地资料、风格参考、预算约束 | AI 三维方案任务、方案模型、比选报告 | `concept_generation_jobs`, `design_options`, CDE 文件 |
| 标准族库 | 标准规范、族库、材质、规则 | 可复用族库、IDS/BCF/校验规则 | `standard_library_items`, `rule_sets` |
| 深化设计 | 方案模型、IFC、DWG/DXF、STEP/STL/IGES | 深化模型、节点、构件、BOM、审查记录 | `cad_bim_derivatives`, `component_properties` |
| 计量造价 | BIM 构件、清单规则、价格库 | 工程量、BOQ、成本测算、报价 | `quantity_takeoff_items`, `cost_estimates` |
| 生产制造 | 深化模型、BOM、工艺路线 | 下料、排产、质检、构件状态 | `manufacturing_orders`, `fabrication_components` |
| 材料物流 | BOM、供应商、批次、运输 | 采购、装车、签收、批次追踪 | `logistics_batches`, `delivery_events` |
| 施工管理 | 进度、模型、交付物、现场数据 | 质量安全、整改、验收、竣工资料 | `site_events`, `inspection_records` |
| 数字孪生 | IFC/GLB/fragments/tiles、IoT、现场数据 | 运行态模型、状态、告警、视点 | `digital_twin_states`, `timeseries_events` |
| 数字档案 | 合同、签章、模型、报告、发票、审计 | 可追溯档案包 | `archive_packages`, `audit_events` |
| 财务人力 | 合同、账单、发票、成本、人力 | 收入确认、付款、税务、人力成本 | `billing_accounts`, `finance_entries` |
| AI 中心 | 模型路由、RAG、额度、工具 | AI 任务、额度账单、评审结果 | `ai_jobs`, `ai_usage_ledger` |
| 设置中心 | 租户、权限、支付、模型、适配器 | 策略、密钥、SLA、审计配置 | `tenant_settings`, `adapter_registry` |

## 3. 文件与模型运行时

IFC、DWG、DXF、RVT、DGN、STEP、STP、IGES、IGS、STL、OBJ、FBX、glTF、GLB、3DM、SKP、USD、PDF、3D PDF、Office、代码和压缩包都必须通过 FileTypeRegistry、Adapter Isolation Registry、StorageRouter 和 Worker 管线进入。

优先顺序:

1. 源文件流和源格式元数据。
2. 授权或开源 runtime 的实体级解析。
3. 后端派生缓存: `glb`, `fragments`, `tiles`, `svg`, `pdf`, `properties index`, `bom index`。
4. 前端轻量加载与分页属性。
5. 明确失败并返回 adapter 缺口,禁止用截图、空 canvas、水印 PDF、外部广告页或假解析冒充支持。

IFC 生产管线必须支持:

- 首次上传后生成 `glb/fragments/tiles + properties index`。
- API 使用 stream、ETag、cache-control 和 derivative manifest。
- 前端默认加载轻量几何和分页属性,不在每次打开时重复整文件解析原始 IFC。
- 属性面板保留原始属性字段,并补充方案设计师、深化设计师、工艺工程师、材质、密度、重量、单位、单价、总价、毫米级三维尺寸、构件 ID 和跨软件 ID。

## 4. AI 与商业化

AI 能力按服务目录计量:

- AI 钢构报价助手。
- AI 方案比选报告。
- AI 深化审查平台。
- AI 计量造价平台。
- 钢构生产协同 SaaS。
- 构件物流追踪 API。
- 施工 AI 助手。
- 数字孪生交付平台。
- AI 数字档案系统。
- 财税补贴 AI 助手。

商业字段至少包括:

- `tenant_id`
- `customer_id`
- `project_id`
- `module_id`
- `capability_id`
- `model_provider`
- `model_id`
- `input_tokens`
- `output_tokens`
- `compute_units`
- `service_credits`
- `currency`
- `unit_price`
- `total_price`
- `invoice_status`
- `refund_status`
- `audit_event_id`

## 5. 验收门槛

1. 市场客服提交客户需求后,数据库能查到需求包、建筑方案草案、客户确认方案、电子合同草案和意向定金支付意向。
   - 用户可见文件必须是 Office/PDF 业务文档并可在线编辑;不得把 JSON 文件作为市场客服主文件展示。
   - 文档生成必须支持平台模板和自定义模板输入,模板选择/说明必须随 CDE 文档进入审计链。
2. 意向定金流程能进入支付适配器,并生成可审计支付意向,不能只展示按钮。
3. 方案设计能导入市场需求包并创建 AI 三维生成任务。
4. 生成任务必须通过 Router,输出必须经过 Evaluator、RuleChecker、SchemaValidator 和 Approver 状态流转。
5. IFC/DWG/DXF/STEP/STL/IGES/Office/PDF 查看必须返回真实源文件、真实派生、真实属性或明确失败原因。
6. 任何 AI、合规、合同、财税、报价、清单、模型和施工输出都必须携带状态、证据、人工审批要求和审计记录。
