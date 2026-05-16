# SUBDOMAIN · 11-compliance · 合规审查

> 强条库 + 报建审批 + 消防 / 人防 / 节能 / 防雷 专项 + 归档对接。

---

## 1. 定位

法规"守门员"· 不合规阻断下游。
- 强条库 · GB / JGJ 强制条文 · 违反即违法
- 报建审批 · 施工许可 / 质监 / 安监 / 消防
- 归档 · 对接 digital_archive 与地方城建档案馆

## 2. 核心实体

| 实体 | 表 |
|---|---|
| `mandatory_clause` | `csr.mandatory_clauses` · 强条库 |
| `compliance_check` | `csr.compliance_checks` · 合规检查记录 |
| `permit_approval` | `csr.permit_approvals` · 报建审批 |
| `archive_package` | `csr.archive_packages` · 归档包 |

## 3. 主要标准

- **GB 50300-2013** 质量强条入口
- **GB 50411-2019** 节能强条 · **GB 50057-2010** 防雷强条
- **GB/T 50328-2019** 文件归档规范
- 工程建设标准强制性条文汇编(住建部汇编)
- **建质〔2017〕214 号** 工程质量安全手册
- **国务院令第 279 号** 建设工程质量管理条例

## 4. 业务场景

> 每次设计变更 · 每次批验收 · 都自动跑强条扫描。
> 6/08 · 系统检测到 GB 50411-2019 §6 节能强条有新增 · 提示 AIA 人工确认。
> 监理采纳 · 配置新强条 · 反查所有已 accepted 批 · 无违反 · 合规性得证。

详见 [`examples/jinping_code_check.md`](./examples/jinping_code_check.md)

## 5. 关键流程

```mermaid
flowchart TB
    A[任一验收 / 变更] --> B[trigger · 强条扫描]
    B --> C[按 target 聚合所有强条]
    C --> D{全合规?}
    D -->|yes| E[pass · 继续]
    D -->|no| F[违反强条 · 必 reject]
    F --> G[整改闭环(共用 02-quality A5)]

    H[规范新版发布] --> I[regulation_diff_detector]
    I --> J[差异清单]
    J --> K[supervisor 人工确认采纳]
    K --> L[反查历史 · 重评风险]

    M[项目阶段关键点] --> N[报建审批 · permit_approvals]
    N --> O[消防 / 人防 / 节能 / 防雷 专项]

    P[竣工] --> Q[归档包 archive_packages]
    Q --> R[digital_archive 正式归档]
    Q --> S[城建档案馆(本地)]
```

## 6. API

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/compliance/clauses` | 入库强条 |
| POST | `/v1/csr/compliance/checks` | 合规检查记录 |
| POST | `/v1/csr/compliance/regulation-diff` | 法规变更差异检测(子域特定) |
| POST | `/v1/csr/compliance/permit-approvals` | 报建进度 |
| POST | `/v1/csr/compliance/archive-packages` | 归档包 |

## 7. 前端组件

- `<MandatoryClauseLibrary />` · 强条库检索 + 全文
- `<ComplianceCheckDashboard />` · 合规状态看板
- `<RegulationDiffPanel />` · 法规差异比对
- `<PermitApprovalTimeline />` · 报建进度时间轴
- `<ArchivePackageBuilder />` · 归档包组装

## 8. Prompts

- `prompts/planner.md`
- `prompts/generator.md`
- `prompts/evaluator.md`
- `prompts/regulation_diff_detector.md` · **核心** · 法规变更差异

## 9. 不变量

- I-1 · 强条 `effective_to IS NULL OR effective_to > now()` 才生效
- I-2 · 违反强条 · 下游相关 activities 自动阻(trigger)
- I-3 · 归档包 · 必须含 8 分部 + 所有监理资料 + 所有专项
- I-4 · 消防 / 节能 / 防雷 · 必须通过才可开具 handover_certificate
- I-5 · permit_approvals 有效期 · 过期自动提醒

## 10. SLA

| 操作 | planner | generator | evaluator |
|---|---|---|---|
| 合规扫描 | 30s | 120s | 30s |
| 法规差异检测 | 60s | 300s | 120s |
| 归档包组装 | 60s | 180s | 60s |

## 11. 状态

Stage 4 · 4 表 · 4 prompts · 锦屏强条检查场景。

---

version: 0.1.0 · 2026-04-23
