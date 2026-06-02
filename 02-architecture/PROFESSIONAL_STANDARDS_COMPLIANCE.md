# ArchIToken · 跨行业专业资格、监管与标准规范合规基线

**文档编号**: ARCHITOKEN-PROFESSIONAL-STANDARDS-COMPLIANCE-V1
**状态**: Active
**适用范围**: 平台、16 模块、术语、Schema、业务逻辑、AI 输出、审批、交付物、对外材料、外部技能/平台适配器
**定稿日期**: 2026-05-16

---

## 1. 总原则

ArchIToken 的每个模块、每个名词、每个业务逻辑和每个 AI 输出,必须符合对应专业执业边界、监管边界、国家标准、行业标准、地方规定、国外标准体系、技术规程、项目合同与企业制度。

本要求不只覆盖建筑设计、结构、施工、监理和项目管理,也覆盖生产制造、运输物流、海关贸易、税务、金融、财务会计、人力资源、组织治理、AI、数据安全、网络安全、软件工程和外部工具适配。

系统不得把 AI 生成内容、规则命中或 RAG 检索结果表述为注册人员签章结论、报审成果或可直接施工依据。任何涉及设计、结构、安全、造价、施工、监理、验收、档案和运维责任的输出,必须明确:

- 适用专业角色。
- 适用法域与标准版本。
- 依据来源与条文引用。
- 证据材料。
- 责任人或审批人。
- 输出状态。
- 是否需要注册执业人员复核、签章或项目负责人批准。

---

## 2. 权威来源层级

发生冲突时,按以下优先级处理; 同级冲突按更严格、更安全、更保守原则处理,并要求人工专业复核:

1. 法律、行政法规、部门规章、强制性工程建设规范。
2. 现行强制性国家标准、工程建设强制性条文。
3. 现行推荐性国家标准、行业标准、地方标准、团体标准。
4. 注册执业资格制度、考试/注册/执业管理规定、继续教育与电子证照规则。
5. IPMA / IPMP 项目管理能力基线、ISO 项目管理与资产管理相关标准。
6. 行业主管部门、监管机构、口岸/海关/税务/金融/数据/网信/市场监管/人社/交通等主管机构规则。
7. 项目合同、设计任务书、施工组织设计、监理规划、企业标准、组织制度。
8. 厂商技术手册、产品认证、检测报告、外部平台 skill 或 API 文档。
9. AI 启发式建议和经验规则。

第 9 类只能作为辅助建议,不得作为合规结论。

---

## 3. 领域与专业角色矩阵

| 专业角色                         | 系统必须尊重的边界                                                                 | 主要关联模块                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IPMP / IPMA 项目管理             | 项目目标、干系人、WBS、进度、资源、风险、变更、沟通、采购、质量和治理闭环          | `planning_management`, `construction_management`, `finance_management`, `human_resources`, `digital_archive` |
| 一级注册建筑师                   | 总图、场地、建筑设计、建筑构造、建筑经济、法规、材料、设备、消防疏散等建筑专业责任 | `concept_design`, `detailed_design`, `standard_library`, `digital_archive`                                   |
| 一级注册结构工程师               | 荷载、抗震、结构体系、构件、连接、基础、钢结构、计算书、校核、结构安全责任         | `detailed_design`, `production_manufacturing`, `construction_management`, `digital_twin`, `digital_archive`  |
| 一级注册建造师                   | 施工组织、进度、质量、安全、资源、分包、现场管理、交付和项目负责人职责             | `planning_management`, `material_logistics`, `production_manufacturing`, `construction_management`           |
| 注册造价工程师                   | 工程量清单、计价、定额、变更、签证、结算、成本控制和造价文件责任                   | `quantity_costing`, `finance_management`, `planning_management`, `digital_archive`                           |
| 注册监理工程师                   | 质量、进度、投资、安全、合同、信息、旁站、检验批、隐蔽验收、竣工资料责任           | `construction_management`, `digital_archive`, `digital_twin`                                                 |
| 专项工程师 / 检测机构 / 审图机构 | 岩土、机电、消防、节能、幕墙、智能化、检测、施工图审查等专项边界                   | `standard_library`, `detailed_design`, `construction_management`, `digital_archive`                          |
| 生产制造负责人 / 质量负责人      | 工艺、产线、设备、质检、焊接、涂装、防火、防腐、MES/ERP、追溯和出厂放行            | `production_manufacturing`, `standard_library`, `digital_archive`                                            |
| 物流运输负责人                   | 采购、运输、装卸、路线、危货、超限、仓储、到货签收、损耗和运输合同                 | `material_logistics`, `planning_management`, `digital_archive`                                               |
| 海关 / 贸易合规负责人            | HS 编码、报关、原产地、关税、贸易管制、禁限物项、进出口单证和口岸监管              | `material_logistics`, `finance_management`, `digital_archive`                                                |
| 税务负责人 / 税务师              | 增值税、企业所得税、发票、扣缴、转让定价、税收优惠、涉税档案和申报责任             | `finance_management`, `quantity_costing`, `digital_archive`                                                  |
| 金融 / 风控 / 合规负责人         | 支付、融资、保函、保险、反洗钱、反欺诈、金融消费者保护、授信和资金安全             | `finance_management`, `planning_management`, `settings_center`                                               |
| 财务会计 / 审计负责人            | 会计准则、收入成本确认、预算、结算、审计证据、内控、报表和档案                     | `finance_management`, `quantity_costing`, `digital_archive`                                                  |
| 人力资源 / 劳动合规负责人        | 劳动合同、薪酬、社保、工时、培训、资质证书、岗位权限和绩效                         | `human_resources`, `settings_center`, `digital_archive`                                                      |
| 组织治理 / 内控负责人            | 授权矩阵、董事会/管理层决策、印章、审批流、职责分离、内控和合规记录                | `settings_center`, `planning_management`, `digital_archive`                                                  |
| AI 治理 / 数据保护负责人         | 模型使用、提示注入、数据分类分级、个人信息、跨境传输、模型安全和审计               | `ai_center`, `settings_center`, `digital_archive`                                                            |
| 软件 / DevSecOps 负责人          | SDLC、供应链安全、许可证、SBOM、API 变更、漏洞响应、日志和发布回滚                 | `ai_center`, `settings_center`, `digital_archive`                                                            |

系统可辅助这些角色工作,但不能替代注册执业责任、企业授权责任、监管申报责任或法定签字/签章责任。

---

## 4. 术语治理

任何 UI 文案、数据字段、API 名称、Prompt、Schema、报告标题或交付物名词,必须进入术语表或来源可追溯的模块词库。

每个术语至少包含:

| 字段                  | 要求                                                     |
| --------------------- | -------------------------------------------------------- |
| `term_id`             | 稳定英文 key                                             |
| `zh_name` / `en_name` | 中英文名称                                               |
| `discipline`          | 建筑、结构、施工、造价、监理、项目管理、档案、AI、运维等 |
| `professional_role`   | 适用执业角色                                             |
| `jurisdiction`        | 国家、行业、地方、项目或企业                             |
| `source_ref`          | 法规、标准、规范、规程、合同或企业制度来源               |
| `definition`          | 可审计定义                                               |
| `forbidden_aliases`   | 禁用混写、误写或营销化说法                               |
| `evidence_required`   | 使用该术语时需要的证据                                   |
| `owner_module`        | 维护模块                                                 |

没有术语来源的词不得进入生产 UI、报告、API 或 Prompt 主干。

跨行业术语必须保留 `domain` 和 `jurisdiction`。例如“验收”“结算”“发票”“清关”“合规”“风险”“模型”“签章”“发布”“共享”“删除”“归档”等词在不同领域含义不同,不得混用。

---

## 5. 业务规则治理

任何业务规则、校核逻辑、风险判断、AI 评分、状态转移和自动化操作,必须登记为可审计规则。

最小规则字段:

```text
rule_id
module_id
discipline
professional_role
jurisdiction
source_type
source_ref
clause_ref
trigger
inputs
condition
output
severity
evidence_required
approval_required
fallback_when_source_missing
```

如果 `source_ref` 或 `clause_ref` 缺失,该规则只能输出“经验建议 / heuristic”,不能输出“合规 / 不合规 / 可施工 / 可报审”。

---

## 6. AI 输出状态

AI 输出必须带状态,禁止默认当成专业结论:

| 状态                           | 含义                            | 是否可报审/施工/签章 |
| ------------------------------ | ------------------------------- | -------------------- |
| `draft_assist`                 | AI 草稿或资料整理               | 否                   |
| `rule_checked`                 | 已通过机器规则和 Schema 检查    | 否                   |
| `professional_review_required` | 需要对应注册人员复核            | 否                   |
| `professional_reviewed`        | 已由专业责任人审阅              | 视项目流程           |
| `signoff_ready`                | 资料齐备,等待签章或审批         | 否                   |
| `signed_record`                | 已有合法责任主体签章/批准并归档 | 可按项目权限使用     |

所有涉及生命安全、结构安全、消防、安全生产、造价结算、合同责任、监理验收和竣工档案的输出,默认至少为 `professional_review_required`。

---

## 7. 标准族库要求

`standard_library` 是全平台合规底座,必须支持:

- 国家标准、行业标准、地方标准、团体标准、企业标准、项目标准。
- 强制性条文与推荐性条文分级。
- 标准版本、发布日期、实施日期、废止状态、替代关系。
- 条文原文引用边界、摘要、适用条件、排除条件。
- 专业角色绑定。
- 结构化规则绑定。
- RAG 检索与人工校核分离。
- 项目采用标准清单。
- 变更影响分析。

标准状态不明、版本不明、来源不明时,系统必须提示“标准来源未确认”,不得静默通过。

---

## 8. 模块验收要求

每个模块验收必须补充以下维度:

| 维度     | 验收要求                                            |
| -------- | --------------------------------------------------- |
| 专业角色 | 明确模块涉及哪些注册执业角色和项目管理角色          |
| 标准来源 | 明确采用哪些标准族库、规范、规程和项目文件          |
| 术语表   | 模块核心名词全部可追溯                              |
| 规则库   | 模块核心逻辑全部有规则登记                          |
| 证据链   | 文件、模型、图片、计算、审批、会议、现场记录可追溯  |
| 人工复核 | 关键输出必须有人工复核和责任主体                    |
| AI 状态  | AI 输出不得跳过状态机                               |
| 审计     | 每次规则命中、AI 调用、审批动作、交付物生成都可审计 |

---

## 9. 跨行业标准体系与监管目录

平台必须把标准与监管来源做成 Registry,不是写死在 Prompt 里。

| 领域                | 国内权威入口                                             | 国际/国外标准体系示例                                                         | 典型系统要求                                   |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| 建筑/结构/施工/监理 | 住建部、住建部执业资格注册中心、全国标准信息公共服务平台 | ISO, buildingSMART, ISO 19650, Eurocode, IBC, ASCE, AISC, AWS                 | 标准版本、执业角色、条文证据、签审状态         |
| 项目管理            | IPMP / IPMA, 行业项目管理制度                            | IPMA ICB, ISO 21502, PMI / PMBOK                                              | WBS、风险、变更、干系人、审批和复盘            |
| 生产制造            | 工信、市场监管、应急、行业协会、企业标准                 | ISO 9001, ISO 14001, ISO 45001, IEC, ASTM, AWS                                | 工艺、质检、设备、追溯、放行                   |
| 运输物流            | 交通运输主管部门、海事/民航/铁路/道路运输规则            | ISO, IMO, ICAO, IATA, ADR/RID where applicable                                | 路线、装卸、超限、危货、签收、损耗             |
| 海关/贸易           | 海关总署、商务主管部门、口岸监管                         | WCO, HS, WTO, Incoterms                                                       | HS 编码、原产地、禁限、报关、关税、单证        |
| 税务                | 国家税务总局、地方税务规则                               | OECD tax guidance, tax treaties, local tax codes                              | 发票、税种、扣缴、申报、税务档案               |
| 金融/支付/保险      | 人行、国家金融监督管理总局、证监会、外汇局               | Basel, FATF, IOSCO, IAIS, PCI DSS                                             | KYC/AML、授信、支付、保函、保险、资金安全      |
| 财务会计/审计       | 财政部、审计署、会计准则体系                             | IFRS, IASB, IAASB, COSO                                                       | 凭证、收入成本、预算、审计证据、内控           |
| 人力/组织           | 人社、工会、企业治理制度                                 | ILO, ISO 30414, ISO 37001                                                     | 劳动合同、资质、岗位权限、绩效、反舞弊         |
| AI/数据/网络安全    | 网信、工信、公安、市场监管、数据主管部门                 | ISO/IEC 42001, ISO/IEC 23894, NIST AI RMF, ISO/IEC 27001, NIST CSF, EU AI Act | 数据分类、模型风险、个人信息、跨境、日志、评估 |
| 软件工程/供应链     | 网信、工信、密码和开源许可证规则                         | ISO/IEC/IEEE 12207, ISO/IEC 25010, OWASP, SLSA, SPDX, CycloneDX               | SDLC、SBOM、许可证、漏洞、API 兼容、发布回滚   |

---

## 10. 外部技能、CAD 平台与 ForgeCAD 适配边界

外部技能文件、CLI、SaaS、CAD 平台和工程协作平台可以作为参考或适配目标,但必须进入 Adapter / ToolRouter / WorkflowRouter 边界。

ForgeCAD `forgecad-project` skill 的可借鉴点:

- 项目生命周期: init、clone、push、pull、status、rename、visibility。
- 文件管理: list、read、save、delete、rename、mkdir、copy。
- 成员管理: owner、editor、viewer。
- 发布共享: publish、shares、link。
- 同步机制: 内容 hash diff,而不是只靠时间戳。
- AI Agent 工作流: 创建模型、编辑、推送、校验、发布。

ArchIToken 的约束:

- 不把 ForgeCAD skill 直接作为生产执行权限。必须经过 ToolRouter、权限、审计、沙箱和人工确认。
- `delete --force`、`push --force`、公开发布、成员变更、可见性变更等动作必须二次确认并进入审批流。
- 共享链接是 live reference 时,必须同步生成不可变归档快照和审计记录。
- 外部 CAD/脚本输出只能是工程草稿或模型资产,不能自动成为专业结论。
- ForgeCAD、Autodesk、Trimble、Speckle、中望、广联达、PKPM 等都只能通过适配器连接,不能成为不可替换核心。

---

## 11. 电子合同、电子签章与支付边界

平台默认采用电子合同、电子签章、线上审批和线上归档流程。线下合同盖章可以存在,但只能作为电子流程完成后的补充证据或项目/法域要求的追加步骤。

业务规则:

- `marketing_service` 的客户需求提交、预付定金、合同草案、签署、发票和后续方案设计任务必须形成可追踪交易链。
- 京东、微信、抖音、支付宝、银联、信用卡、PayPal、企业转账等支付方式只能通过支付/财务合规 adapter 接入;未接入真实 adapter 时,系统只能生成“待支付/支付意向/测试沙箱”状态,不得显示生产支付成功。
- 电子签章必须绑定签署主体、证书/印章来源、签署时间、合同版本、文件哈希、签署意图、权限审批和归档记录。
- 涉及预付款、定金、退款、税票、跨境支付、外汇、反洗钱、KYC/KYB、消费者保护和合同责任时,必须进入 `finance_management` / `digital_archive` / `settings_center` 的财税、档案和权限审计边界。
- AI 可以协助起草合同、提取条款、比对风险和生成审批摘要,但不能替代法务、财务、项目负责人或授权签署人的审查与签章责任。

禁止事项:

- 禁止用页面状态替代真实支付网关、清结算或银行回执。
- 禁止用图片章、伪造签名或不可追踪 PDF 覆盖层冒充电子签章。
- 禁止绕过合同版本、哈希、审批、签署主体和归档证据直接进入“合同已签/款项已付/可开工”状态。

---

## 12. 基线来源

当前文档只固化治理边界,不在仓库内复制标准全文。标准全文、执业资格规则和工程建设强制性要求必须从官方或授权来源取得。

权威入口:

- IPMA ICB4: <https://ipma.world/ipma-standards-development-programme/icb4/>
- 全国标准信息公共服务平台: <https://std.samr.gov.cn/>
- 住房和城乡建设部: <https://www.mohurd.gov.cn/>
- 中国政府网政策公开: <https://www.gov.cn/zhengce/>
- 住房和城乡建设部执业资格注册中心: <https://www.pqrc.org.cn/>
- ForgeCAD project skill: <https://github.com/KoStard/ForgeCAD/blob/mainline/skills/forgecad-project/SKILL.md>
- 海关总署: <https://www.customs.gov.cn/>
- 国家税务总局政策法规库: <https://fgk.chinatax.gov.cn/>
- 国家金融监督管理总局: <https://www.nfra.gov.cn/>
- 中国人民银行: <https://www.pbc.gov.cn/>
- 中国证监会: <https://www.csrc.gov.cn/>
- 财政部: <https://www.mof.gov.cn/>
- 交通运输部: <https://www.mot.gov.cn/>
- 工业和信息化部: <https://www.miit.gov.cn/>
- 国家互联网信息办公室: <https://www.cac.gov.cn/>
- 人力资源和社会保障部: <https://www.mohrss.gov.cn/>
- ISO: <https://www.iso.org/>
- IEC: <https://www.iec.ch/>
- ITU: <https://www.itu.int/>
- W3C: <https://www.w3.org/>
- IETF: <https://www.ietf.org/>
- IEEE Standards Association: <https://standards.ieee.org/>
- NIST: <https://www.nist.gov/>
- WCO: <https://www.wcoomd.org/>
- WTO: <https://www.wto.org/>
- IASB / IFRS: <https://www.ifrs.org/>
- OWASP: <https://owasp.org/>
- SPDX: <https://spdx.dev/>
- CycloneDX: <https://cyclonedx.org/>

---

## 13. 禁止事项

- 禁止把 AI 草稿称为注册建筑师、注册结构工程师、注册建造师、注册造价工程师或注册监理工程师结论。
- 禁止把经验规则写成国家标准、行业标准或强制性条文。
- 禁止没有版本和来源的“规范库”进入生产。
- 禁止绕过 `standard_library`、RuleChecker、SchemaValidator 和 Approver 直接生成专业结论。
- 禁止用营销词替代工程术语。
- 禁止无证据宣称“自动报审”“自动施工”“自动验收”“自动签章”。
- 禁止把海关申报、税务申报、金融交易、财务报告、人事处分、公开发布、删除数据、变更权限等高风险动作交给 AI 或外部 skill 自动执行。
