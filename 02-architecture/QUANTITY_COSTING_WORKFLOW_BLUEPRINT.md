# ArchIToken · 计量造价编审一体化蓝图

**文档编号**: ARCHITOKEN-QUANTITY-COSTING-WORKFLOW-BLUEPRINT-V1
**状态**: draft for implementation
**适用模块**: `quantity_costing`
**定位**: ArchIToken 自研计量造价 + 编审一体化 + Open CDE 审计归档

---

## 1. 目标

`quantity_costing` 从当前的 BOQ / 成本测算面板升级为完整的计量造价编审一体化模块。

模块采用 GCCP7.0 操作手册中体现的业务流程逻辑作为流程参考,但实现必须是 ArchIToken 自研:

- 不复制广联达专有 UI、品牌、图标、报表模板、定额库、规则库、文件格式或内部实现。
- 不实现用户登录、云助手、消息盒子、在线客服、云空间、备份中心等外围产品功能。
- 计价依据使用国家标准、地方标准定额、地方费用定额、人材机价格、企业补充定额、项目合同和审计约定。
- 所有专业输出默认进入 `professional_review_required`,不得把 AI 或机器规则结果表述为注册造价工程师结论。
- 所有文件、版本、计算、规则、报告、审批和归档必须进入 Open CDE 工作台、审计链和可回滚生命周期。

---

## 2. 标准与规则边界

### 2.1 国家清单计价基线

当前国家清单计价基线采用:

- `GB/T 50500-2024` · 建设工程工程量清单计价标准。
- 住建部公告来源: <https://www.mohurd.gov.cn/gongkai/zc/wjk/art/2024/art_6186304e164c4c4982904f8734983235.html>
- 实施日期: 2025-09-01。

旧项目、历史审计或合同明确约定时,可保留历史标准版本,但必须记录标准版本、适用日期、适用法域和采用理由。

### 2.2 地方标准定额

地方标准定额必须进入 Registry,不得写死在业务代码中。最小字段:

```text
standard_id
jurisdiction
specialty
version
effective_from
effective_to
source_ref
publisher
status
license_boundary
review_required
```

地方定额内容不得由系统编造。来源缺失时,系统只能生成经验测算或待补资料提醒,不得输出正式计价、审定或结算结论。

### 2.3 规则分类

计量造价规则分为:

- `national_standard_rule`: 国家标准规则。
- `local_quota_rule`: 地方定额规则。
- `fee_rule`: 规费、税金、费用汇总和取费规则。
- `enterprise_rule`: 企业补充定额或内部成本规则。
- `contract_rule`: 项目合同或审计约定。
- `heuristic_rule`: 来源不完整的经验规则,仅允许辅助提示。

每条规则必须携带 `source_ref`、`clause_ref`、`professional_role`、`evidence_required` 和 `approval_required`。

---

## 3. 业务流程

### 3.1 总流程

```text
新建/打开工程
  -> 编制
  -> 新建审核
  -> 导入审定
  -> 工程匹配
  -> 多版本管理
  -> 送审/审定对比
  -> 核增核减
  -> 费用分析 / 清单分析
  -> 审核报告
  -> 报表导出
  -> 审定转预算
  -> CDE 归档
```

### 3.2 编制主线

编制区包含:

- 工程概况。
- 项目结构树。
- 分部分项。
- 措施项目。
- 其他项目。
- 费用汇总。
- 报表。

编制数据可来自人工录入、Excel/CSV 导入、BIM/IFC 计量草稿、图纸计量草稿或历史工程复制。任何自动抽量结果在人工复核前只能作为草稿。

### 3.3 审核主线

审核区包含:

- 新建审核。
- 导入审定。
- 多版本管理。
- 切换送审。
- 删除非当前审核版本。
- 数据转换。
- 审定转预算。

审核版本必须保留送审版和审定版的独立快照。再次新建审核时,当前审定数据可成为下一审的送审基线,并生成新的审定版本。

### 3.4 分析报告主线

分析报告区包含:

- 费用分析。
- 清单分析。
- 过滤条件。
- 批量勾选。
- 合并分析。
- 定位到工程。
- 审核报告。
- 报表方案。

报告来源必须可追溯到被勾选的清单分析项、费用分析项、工程结构节点和审核版本。

---

## 4. 工作台信息架构

`/app/modules/quantity_costing` 使用统一 `ModuleWorkbenchShell`,不得引入独立产品入口或孤立大屏。

建议主工作区分为以下业务面板:

| 面板     | 责任                                     |
| -------- | ---------------------------------------- |
| 工程导航 | 项目、单项、单位、专业工程结构树         |
| 编制     | 分部分项、措施、其他项目、费用汇总       |
| 审核     | 审核版本、导入审定、数据转换、审定转预算 |
| 对比     | 送审/审定差异、增删改标识、详细对比      |
| 分析     | 费用分析、清单分析、筛选、合并、定位     |
| 报表     | 审核报告、报表方案、导出、归档           |
| 标准定额 | 国家标准、地方定额、人材机价格、取费规则 |
| 审批审计 | AI 门禁、专业复核、审批记录、归档证据    |

右侧抽屉继续承载生命周期、审批、审计和 AI 建议。AI 建议不得绕过 RuleChecker、SchemaValidator 和 Approver。

---

## 5. 数据模型

### 5.1 核心对象

建议新增或演进以下对象:

```text
cost_projects
cost_project_tree_nodes
cost_standards
cost_quota_libraries
cost_quota_items
cost_price_snapshots
cost_bill_versions
cost_review_versions
cost_boq_items
cost_quota_subitems
cost_resource_items
cost_unit_price_components
cost_quantity_details
cost_measure_items
cost_other_items
cost_fee_summary_items
cost_delta_analysis_items
cost_review_reports
cost_report_templates
cost_audit_events
cost_approval_records
```

### 5.2 项目结构树

项目结构树节点:

```text
node_id
project_id
parent_id
node_type        // project, single_project, unit_project, specialty
name
specialty
sort_order
standard_profile_id
quota_library_id
created_from
audit_state
```

支持文件合并、添加、替换、匹配、复制到和批量删除。删除必须是软删除或版本变更,不得直接破坏历史审计。

### 5.3 版本对象

预算和审核版本:

```text
version_id
project_id
version_type     // estimate, budget, progress_measurement, settlement, review
review_round
submitted_version_id
approved_version_id
description
status
created_by
created_at
source_file_ids
audit_event_ids
```

审核版本至少包含:

- `submitted`: 送审数据快照。
- `approved`: 审定数据快照。
- `comparison`: 差异分析结果。

---

## 6. 编制数据结构

### 6.1 分部分项清单项

```text
item_id
project_id
node_id
version_id
item_type          // boq_item, quota_subitem
code
name
feature
unit
submitted_qty
approved_qty
qty_delta
submitted_unit_price
approved_unit_price
submitted_total
approved_total
amount_delta
change_mark        // none, add, delete, modify, temporary
change_reason
source_ref
rule_id
element_id
```

计算规则:

```text
qty_delta = approved_qty - submitted_qty
amount_delta = approved_total - submitted_total
submitted_total = submitted_qty * submitted_unit_price
approved_total = approved_qty * approved_unit_price
```

金额计算需要支持精度策略、四舍五入策略、税前/税后口径和地方取费规则。

### 6.2 工程量明细

```text
detail_id
item_id
version_side       // submitted, approved
expression
result_qty
unit
source_file_id
source_element_id
review_note
```

工程量表达式必须可解析、可计算、可审计。不能解析时保留原文并标记为 `manual_review_required`。

### 6.3 工料机

```text
resource_id
quota_subitem_id
resource_type      // labor, material, machine
code
name
unit
standard_consumption
submitted_consumption
approved_consumption
standard_price
submitted_price
approved_price
delta_reason
```

工料机对比必须至少显示标准定额、送审、审定三组数据。

### 6.4 单价构成

```text
component_id
item_id
component_type     // labor, material, machine, management, profit, risk, fee, tax
base_formula
rate
submitted_amount
approved_amount
amount_delta
source_rule_id
```

修改计算基数或费率时,必须记录变更字段、变更前值、变更后值和操作者。

---

## 7. 审核与对比规则

### 7.1 增删改标识

标识规则:

| 标识 | 条件                                             |
| ---- | ------------------------------------------------ |
| 增   | 送审合价为 0 或空,且审定合价不为 0 或空          |
| 删   | 送审合价不为 0 或空,且审定合价为 0 或空          |
| 改   | 编码、工程量、单价、合价、项目特征或构成发生变化 |
| 临   | 临时项、待确认项或无完整标准来源项               |
| 无   | 送审与审定关键字段一致                           |

颜色是 UI 表达,不能作为业务真源。业务真源是 `change_mark` 和差异字段。

### 7.2 增减说明

自动说明规则:

- 增项: 送审合价为空或 0,审定合价不为空且不为 0。
- 减项: 送审合价不为空且不为 0,审定合价为空或 0。
- 调项: 送审编码与审定编码不同。
- 调量: 工程量不同,且不符合调项条件。
- 调价: 综合单价不同,且不符合调项条件。

用户可覆盖自动说明,但必须保留自动说明、人工说明和编辑历史。

### 7.3 数据转换

支持:

- `submitted_to_approved`: 送审同步到审定。
- `approved_to_submitted`: 审定同步到送审。

数据转换必须产生版本事件,并允许按清单、子目、措施项目范围勾选执行。审增项执行送审到审定时必须受限,避免覆盖审定新增依据。

---

## 8. 核增核减

### 8.1 基本关系

```text
amount_delta = approved_amount - submitted_amount
amount_delta = increase_amount - decrease_amount
```

当 `核增有效` 启用时,界面和报表必须保持核增、核减、增减金额平衡。

### 8.2 计算类型

| 类型           | 规则                                          |
| -------------- | --------------------------------------------- |
| 代码型核增     | 通过费用或分部分项代码映射核增统计项          |
| 费用代号型核增 | 按费用代号公式统计核增列金额                  |
| 常数型核增     | 无可映射公式时,按审定与送审差额判断核增或核减 |

### 8.3 费率变化

当审定费率大于送审费率时,核增计算需要同时考虑:

```text
核增基数 * 审定费率 + 送审基数 * 费率差额
```

具体适用条件必须由 `fee_rule` 或项目取费规则声明,不得在业务代码里写死。

---

## 9. 分析与报告

### 9.1 费用分析

费用分析支持:

- 展开到项目、单项、单位、费用层级。
- 结构树联动过滤。
- 勾选、取消勾选、批量勾选。
- 按金额绝对值、增减比例、金额占比前 X% 选择。
- 导出 Excel。
- 复制单元格。
- 定位到工程。

### 9.2 清单分析

清单分析支持:

- 右键勾选、取消勾选、批量勾选。
- 按增减金额占比、排名、金额阈值批量选择。
- 文本过滤: 名称、项目特征、增减说明、标识。
- 数值过滤: 送审金额、审定金额、增减金额、工程量差、单价价差、增减比例。
- 多条件且关系。
- 过滤状态下禁止合并分析。
- 合并分析按单位工程、编码、名称、项目特征等条件执行。

### 9.3 合并分析

合并条件:

- 单位工程。
- 编码。
- 名称。
- 项目特征。
- 单位。

约束:

- 单位不一致时工程量不累计。
- 综合单价不一致时合并行不显示单一综合单价。
- 金额、价差等可累计字段按数值累计。
- 合并名称缺失时使用首条清单名称加汇总后缀。

### 9.4 审核报告

审核报告由以下数据生成:

- 项目信息。
- 工程结构。
- 费用信息。
- 勾选的清单分析项。
- 详细分析。
- 核增核减汇总。
- 标准/定额/价格来源。
- 专业复核与审批状态。

报告工具必须支持:

- 预览。
- 编辑状态切换。
- 撤销/重做。
- 复制/粘贴。
- 缩放。
- Word / Excel / PDF 导出。
- CDE 归档。

---

## 10. 导入导出

### 10.1 输入

优先支持开放或通用格式:

- `.xlsx`
- `.csv`
- `.json`
- `.ifc`
- `.dwg` / `.dxf` 经授权或开源 sidecar 派生
- `.pdf` 作为表格/图纸提取输入

专有格式如 GBQ7、GBQ6、QBQ5 只能在具备合法授权、格式规范或用户提供适配器时接入。无授权时不得声明兼容。

### 10.2 输出

输出类型:

- 清单 Excel。
- 审核报告 Word/PDF。
- 成本基线 JSON。
- CDE 归档包。
- 审定预算版本。

输出必须记录:

```text
source_version_id
standard_profile_id
quota_library_id
price_snapshot_id
rule_check_result_id
schema_validation_result_id
approval_record_id
archive_record_id
```

---

## 11. AI 与专业门禁

计量造价 AI 链路:

```text
Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
```

AI 可做:

- 提取图纸或模型中的待复核工程量。
- 建议清单映射。
- 生成增减说明草稿。
- 生成审核报告草稿。
- 提醒标准/定额缺失。

AI 不可做:

- 直接宣称计价合规。
- 直接生成可结算、可审定、可支付结论。
- 绕过注册造价工程师或授权责任人复核。
- 编造标准、定额、价格来源。

---

## 12. 分阶段实现

### Phase 1 · 编审骨架

- 工程结构树。
- 分部分项表。
- 送审/审定双版本。
- 增删改标识。
- 工程量差、增减金额。
- 新建审核、导入审定、多版本。
- 费用汇总。
- 基础审核报告。

### Phase 2 · 计价引擎

- 标准定额 Registry。
- 清单编码规则。
- 工料机。
- 单价构成。
- 措施项目。
- 其他项目。
- 核增核减三类算法。
- 价格快照。

### Phase 3 · 分析报表

- 费用分析。
- 清单分析。
- 批量勾选。
- 过滤、合并、定位。
- 报表方案。
- Word / Excel / PDF 导出。
- 审定转预算。

### Phase 4 · BIM / 图纸计量

- IFC / DWG / DXF / PDF / Excel / CSV 导入。
- 构件到清单映射。
- `element_id` / `rule_id` / `source_file_id` 追踪。
- 自动抽量生成待复核草稿。

---

## 13. 当前实现状态

状态日期: 2026-06-02。

本轮实现按 GCCP7.0 操作手册中的编审一体化、分析报告、项目结构树、分部分项、措施项目、其他项目、费用汇总和报表工作流做功能映射,但保持 ArchIToken 自研工作台、Open CDE、专业复核和审计边界。

| GCCP7.0 参考工作流                                        | ArchIToken 当前实现                                                                               | 主要文件                                                                                   | 状态                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| 新建审核、导入审定、切换送审、审定转预算                  | 送审/审定双快照、多轮审核、审定转送审、送审转审定、审定转预算包生成                               | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 项目结构树合并、复制、删除、批删                          | 项目/单项/单位/专业树节点合并、复制、软删除、批量删除和当前审核保护                               | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 工程概况、工程特征、版本管理                              | 工程信息、特征缺项提示、版本表和审核状态展示                                                      | `03-frontend/components/ModuleOperationalPanel.tsx`                                        | 已落地                                      |
| 分部分项差额、增删改颜色、详细对比、增减说明              | 清单编码/名称/特征/工程量/综合单价双版本编辑、差额、核增核减、增删改/临时标识、自动和人工增减说明 | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 工料机显示、单价构成                                      | 标准、送审、审定三组工料机对比; 人工、材料、机械、管理费、利润、风险单价构成拆分                  | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 工程量明细                                                | 清单工程量表达式明细、来源、人工复核状态展示                                                      | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地; 真实图纸/模型抽量需接入 Worker 来源 |
| 数据转换                                                  | 分部分项、措施项目、其他项目、费用汇总支持送审到审定和审定到送审转换,审增项保护                   | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 措施项目、其他项目、费用汇总                              | 措施费、暂列金额、计日工、总承包服务费、取费和税金计算; 差额、标识、增减说明                      | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 费用分析、清单分析、审核报告                              | 费用层级汇总、清单筛选、批量选择、合并分析约束、审核报告预览                                      | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| 报表更多、保存/载入方案、设计、统一替换、水印、页码、导出 | 报表方案保存/载入/恢复、更多报表、导出任务、设计状态、水印、页码和统一替换计划                    | `03-frontend/lib/quantity-costing.ts`, `03-frontend/components/ModuleOperationalPanel.tsx` | 已落地                                      |
| GBQ7、GBQ6、QBQ5 等专有格式                               | 不声明兼容; 仅在具备合法授权、格式规范或用户提供适配器后接入                                      | 本文第 10.1 节                                                                             | 外部授权或适配器阻塞                        |
| 国家/地方定额、人材机价格正式库                           | 保留 Registry 和来源字段; 无来源时输出保持 `professional_review_required`                         | `03-frontend/lib/quantity-costing.ts`                                                      | 需接入真实标准/定额/价格来源                |

当前自动化验证:

- `./node_modules/.bin/tsc --noEmit --pretty false`
- `bun test lib/quantity-costing.test.ts lib/engineering-quantity-takeoff.test.ts lib/finance-management.test.ts`
- `./node_modules/.bin/eslint components/ModuleOperationalPanel.tsx lib/quantity-costing.ts lib/quantity-costing.test.ts`

---

## 14. 验收标准

完成后必须满足:

- 不依赖广联达专有格式也能完成预算、审核、审定、报表和归档流程。
- 每个清单项可追踪标准、定额、价格、工程量来源和版本。
- 送审与审定差异可视、可筛选、可报告。
- 核增核减计算可解释、可复核。
- 报表来源可追溯到分析勾选项和审核版本。
- 所有专业输出默认 `professional_review_required`。
- 审批通过后才允许进入正式归档状态。
- 所有导入、计算、转换、报告、审批动作写入审计事件。

---

## 15. 明确不做

- 不做用户登录。
- 不做云宝助手、在线客服、消息盒子。
- 不复制广联达专有 UI、图标、品牌、文案、模板或内部流程实现。
- 不逆向或伪造 GBQ7 / GBQ6 / QBQ5 文件兼容。
- 不编造地方定额、取费文件、人材机价格或标准条文。
- 不把 AI 草稿标记为审定、结算、支付或合规结论。
