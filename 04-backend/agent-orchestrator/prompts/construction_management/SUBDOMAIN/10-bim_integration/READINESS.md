# 10-bim_integration · READINESS

上线状态: closed-loop ready。本文不是阻塞清单,而是生产准入与受控增强记录。

---

## 上线准入

- [x] 子域纳入 construction_management 模块清单、标准、数据模型、工作流和审计链。
- [x] Planner / Generator / Evaluator / Special prompt 输出结构化 JSON,不得输出占位文本。
- [x] 租户、项目、角色、证据、审批、留痕和归档口径遵循平台宪法及监理合规要求。
- [x] 与 Open CDE、Module Workflow OS、digital_archive、standard_library 和 settings_center 的边界清晰。

## 决策口径

- [x] 默认执行 `STANDARDS.md`、`DATA-MODEL.md`、`WORKFLOW.md` 和本子域 `README.md` 已固化的业务规则。
- [x] 任何合同、地方标准、总监授权、业主例外或重大变更必须进入审批流,并写入 audit/event 证据链。
- [x] 外部标准全文、行业 API、专有格式或厂商 SDK 未完成法律/许可证审查前,只作为候选来源,不得默认进生产路由。

## 受控增强

- Geometry clash worker, chunked glTF, IFC property write-back, Navisworks CSV import, BCF 3.0 integration.
- 黄金样本、反例样本、真实项目回放、性能基准和地方标准差异按版本计划纳入 CI 与 standard_library seed。

---

version: 0.1.1 · 2026-05-16
