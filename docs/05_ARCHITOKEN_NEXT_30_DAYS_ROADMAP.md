# ArchIToken 未来 30 天路线图

本路线图按 1 个全栈工程师 + AI 原生开发、每天 12 小时执行。目标是在前端重做和后端 API 稳定之间建立并行节奏，避免被展示页面、临时 demo 或无合同实现分散。

## 0. 必须完成

- 稳定 OpenAPI：模块、文件、生命周期、审批、审计、AI Agent、知识库入口。
- 后端 Rust 合同：内存实现可测，Store trait 可替换，typed error 完整。
- TypeScript SDK：从 OpenAPI 生成，前端 adapter 只依赖 SDK。
- 外接知识库：完成 ingestion 合同、元数据、RAG 索引、MCP tool 入口。
- AI Native Multimodal Engineering Generation & Conversion Engine：完成 generation job、artifact、mock pipeline、Skill Registry、MCP Tool Registry、WorkflowRouter、Evaluator、SchemaValidator、AuditEvent。
- 11 个标准模块：需求、文件类型、审批点、状态机、AI 能力一致。
- CI：Rust、Python、Frontend、OpenAPI、License、Security gate 全部保留。

## 1. 可延后

- 复杂权限 UI、低代码流程编排 UI、完整移动端体验、复杂报表编辑器。
- 多租户计费系统、精细化资源配额、跨区域容灾。
- 全量生产级 BIM/CAD 转换器、完整 WebGPU 编辑器、生产级 3DGS 管线、视频到数字孪生高精度重建优化。

## 2. 禁止分心

- 不为单个页面新增 UI-only API。
- 新模块必须使用 active module id。
- 不做无合同数据库 migration。
- 不在未稳定 SDK 前大规模重写前端页面。
- 不删除或弱化 CI/Security/License gate。
- 不让 AI 输出绕过评估、规则校验、Schema 校验和审批。
- 不把多模态生成做成前端 demo；它必须通过后端 API、WorkflowRouter、Skill Registry、MCP Tool Registry、StorageRouter 暴露。

## 3. 并行策略

- 后端先稳定 API 和 SDK，前端重做只接 adapter。
- 前端每天只消费已通过 Redocly 和 SDK generation 的合同。
- AI/RAG/MCP 与业务模块并行，但所有 Agent 输出先进入事务和审计，不直接覆盖业务事实。
- ObjectStore、TransactionStore、EventStore 先定义 trait 和 contract tests，再替换 in-memory 实现。
- 多模态前 7 天只做后端 API、schema、job model、artifact model、mock pipeline；第 8-14 天做文本/图片/CAD/PDF/BIM 基础互转 PoC；第 15-21 天做 RAG/MCP/Skill/Evaluator/Test/Debug；第 22-30 天做数字孪生、导出、验收和 PR 合并准备。

## 4. 30 天执行计划

| 天 | 重点 | 12 小时安排 | 当天输出物 | 验证命令 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| D01 | Generation API | 3h 读真源，5h generation job schema，4h artifact schema | job/artifact 合同 | `npx --yes @redocly/cli@2.30.0 lint 04-backend/openapi.yaml` | API 支持创建、查询、审批、拒绝、列 artifact |
| D02 | Job model | 4h Rust job model，4h in-memory store，4h tests | generation job mock | `cd 04-backend && cargo test --all-targets --all-features` | job 状态和 typed error 可测 |
| D03 | Artifact model | 4h artifact metadata，4h file binding，4h tests | artifact 进入文件系统 | `cargo clippy --all-targets --all-features -- -D warnings` | schema、metadata、version、permission、audit 完整 |
| D04 | Mock pipeline | 4h Planner，3h Generator mock，3h Evaluator mock，2h tests | mock pipeline | `cargo test --all-targets --all-features` | Planner -> Generator -> Evaluator 可追踪 |
| D05 | Validator/approval | 4h RuleChecker，4h SchemaValidator，4h approval | 校验和审批链 | `cargo test --all-targets --all-features` | Generator != Evaluator，approved 前不可生产使用 |
| D06 | Registry | 4h Skill Registry，4h MCP Tool Registry，4h sandbox policy | skill/tool 合同 | Redocly、SDK generate | skill/tool 有 schema、权限、sandbox、license |
| D07 | Router | 5h WorkflowRouter，3h ModelRouter，4h SDK adapter | 多模态路由底座 | SDK generate、contract tests | 前端/第三方通过同一 API 调用 |
| D08 | Text outputs | 3h text->document，3h text->table，3h text->PDF，3h fixtures | 文档/表格/PDF PoC | tests | 产物进入文件、事务、审批、审计 |
| D09 | Presentation/diagrams | 3h text->PPT，3h mindmap，3h flowchart，3h gantt | 演示和图表 PoC | tests | 图表 schema 和导出文件可验证 |
| D10 | Floorplan/CAD | 4h text->floorplan，4h text->CAD，4h evaluator | 户型/CAD preview | tests | CAD 只到 preview/draft，需审批 |
| D11 | Image conversion | 4h image->PDF drawing，4h image->CAD，4h review fixtures | 图片到图纸 PoC | tests | 尺寸、图层、置信度可复核 |
| D12 | BIM conversion | 4h CAD->BIM，4h PDF->BIM，4h IFC validation | 图纸到 BIM preview | tests | IFC/schema validator 通过 |
| D13 | BIM exports | 4h model->table，4h model->drawing，4h model->image | 模型导出 PoC | tests | 导出关联 element id 和版本 |
| D14 | Twin base | 4h text->twin，4h CAD/PDF->twin，4h scene schema | 数字孪生 preview | Redocly、tests | 场景、图层、坐标系和审批完整 |
| D15 | RAG grounding | 4h generation RAG，4h citation，4h tests | 生成引用知识库 | RAG tests | 不允许无来源工程结论 |
| D16 | MCP execution | 4h MCP generation tool，4h permission，4h audit | MCP 受控调用 | tests | tool sandbox 和审计完整 |
| D17 | Skill fixtures | 4h skill fixture schema，4h regression tests，4h debug report | Skill 测试框架 | tests | 每个 skill 有 Plan/Action/Review/Test/Debug/Report |
| D18 | Evaluator | 4h evaluator isolation，4h active review，4h negative tests | 独立评估器 | tests | Generator 和 Evaluator 分离 |
| D19 | License pool | 4h GitHub 候选采集机制，4h license policy，4h quarantine | 免费商用审查机制 | policy tests | MIT/Apache/BSD 优先，GPL/AGPL 等默认禁止 |
| D20 | Model updates | 4h model registry，4h update policy，4h router report | 模型更新机制 | tests | provider/model/skill 版本可回滚 |
| D21 | Module mapping | 5h 14 模块生成能力矩阵，4h examples，3h docs | 模块级生成合同 | docs + tests | 每模块明确调用能力和验收 |
| D22 | Video/pointcloud | 4h video->pointcloud，4h video->BIM，4h evaluator | 视频重建 PoC | tests | 点云坐标、误差和来源完整 |
| D23 | Twin pipeline | 4h video->twin，4h image->twin，4h WebGPU metadata | 多源孪生 PoC | SDK generate | 场景可被前端重做调用 |
| D24 | Export pipeline | 4h drawing->image，4h drawing->PDF，4h archive binding | 图纸导出 | tests | 导出 hash、版本、权限完整 |
| D25 | Archive/approval | 4h approved artifact archive，4h digital_archive binding，4h tests | 归档闭环 | tests | approved/archived 状态可追踪 |
| D26 | Third-party flow | 4h third-party generation，4h idempotency，4h API examples | 第三方接入 | contract tests | 外部系统不能绕过审批链 |
| D27 | Security/License | 5h Security/License/SBOM，4h CI reproducibility，3h docs | CI 固化 | CI local checks | 工具和模型许可可解释 |
| D28 | E2E generation | 6h end-to-end generation demo，3h bugfix，3h regression | 端到端生成链 | full checks | 生成结果全进入文件/事务/审批/审计 |
| D29 | Observability | 4h metrics，3h audit report，3h performance，2h release notes | 可观测基线 | load smoke | job、step、tool、model 耗时可追踪 |
| D30 | Merge readiness | 4h acceptance，3h risk review，3h docs，2h PR review | 合并前审查包 | full checks + diff review | 需求、合同、测试、风险可解释 |

## 5. 每日输出物规则

- 每天必须产出可 review 的代码或合同，不以口头结论作为交付。
- 每天结束必须记录：修改文件、根因、修复、验证命令、结果、剩余风险。
- 合同变更当天必须跑 Redocly 和 SDK generation。
- Rust 变更当天必须跑 fmt、clippy、test；涉及 gateway 必须跑 release build。
- 前端变更当天必须跑 lint、typecheck、test、build 中与变更相关的最小集合。
- 多模态变更当天必须产出 generation fixture、evaluation report、schema validation result、debug report 和 audit trail。

## 6. 最终验收

- 11 个标准模块都有稳定需求、文件、生命周期、审批、审计和 AI 能力定义。
- 后端 API 不依赖前端重做节奏，第三方可按 OpenAPI 调用。
- 前端重做通过 adapter 和 SDK 接入，不绕过 API。
- 外接知识库能服务 Agent、RAG、MCP 和 WorkflowRouter，并提供来源、权限和审计。
- 多模态生成与互转引擎能通过后端 API 服务第三方前端、外部系统和 AI Agent，并严格执行 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver。
- CI gate 不被弱化，License/Security/Rust/Python/Frontend/OpenAPI 全部可解释。
