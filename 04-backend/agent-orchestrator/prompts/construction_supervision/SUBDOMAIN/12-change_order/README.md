# SUBDOMAIN · 12-change_order · 变更管理

> 设计变更 · 工程洽商 · 签证 · 索赔 · 变更影响传播分析。

---

## 1. 定位

合同管理的最活跃一角。与其它模块最强耦合:
- ← detailed_design · 设计变更发起
- ← 现场 · 工程洽商 / 签证
- ↔ quantity_costing · 双向联动(变更改 BOQ)
- → 01-progress · 变更影响工期
- → 11-compliance · 每次变更都走合规检查

## 2. 核心实体

| 实体 | 表 |
|---|---|
| `engineering_change` | `csr.engineering_changes` · 设计变更(RFC) |
| `site_consultation` | `csr.site_consultations` · 工程洽商 |
| `claim` | `csr.claims` · 索赔 |
| `certification` | `csr.certifications` · 签证 |
| `change_impact_assessment` | `csr.change_impact_assessments` · 影响评估 |

## 3. 主要标准

- **GB 50500-2013** 建设工程工程量清单计价规范(计价依据)
- **AIA A201-2017** General Conditions (美式变更程序)
- **FIDIC Red Book 2017** §13 Variations and Adjustments
- **GB/T 50326-2017** 项目管理规范 · 变更控制

## 4. 业务场景

> 6/11 · 锦屏雨季停工 1.5 日 · 施工方申请工期顺延 · 基于 FIDIC §8.5。
> impact_propagation_analyzer · 自动算影响:工期 +1.5 日 · 成本 +0 · 合同触发违约金转换 ¥3000。
> 监理复核 · 业主批准 · 6/12 签发工期变更签证。

详见 [`examples/jinping_time_extension.md`](./examples/jinping_time_extension.md)

## 5. 关键流程

```mermaid
flowchart TB
    A[变更需求发起] --> B{类型?}
    B -->|设计改动| C[engineering_change · RFC]
    B -->|小范围调整| D[site_consultation · 洽商]
    B -->|一方主张补偿| E[claim · 索赔]
    B -->|现场认定| F[certification · 签证]

    C & D & E & F --> G[impact_propagation_analyzer]
    G --> H[对工期 / 成本 / 质量 三影响]
    H --> I[三方审查(owner · contractor · supervisor)]
    I --> J{通过?}
    J -->|yes| K[执行变更]
    J -->|no| L[驳回 / 重提]

    K --> M[联动 · quantity_costing boq 调整]
    K --> N[联动 · 01-progress schedule 调整]
    K --> O[联动 · 11-compliance 合规扫描]
    K --> P[归档 · digital_archive]
```

## 6. API

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/change-order/engineering-changes` | 提交 RFC |
| POST | `/v1/csr/change-order/site-consultations` | 洽商 |
| POST | `/v1/csr/change-order/claims` | 索赔 |
| POST | `/v1/csr/change-order/certifications` | 签证 |
| POST | `/v1/csr/change-order/impact-analysis` | 影响分析(子域特定) |
| POST | `/v1/csr/change-order/engineering-changes/{id}/approve` | 三方审批 |

## 7. 前端组件

- `<ChangeOrderKanban />` · 变更看板(draft / reviewing / approved / executed / closed)
- `<ImpactAnalysisReport />` · 影响分析报告
- `<ClaimLedger />` · 索赔台账
- `<CertificationBook />` · 签证台账

## 8. Prompts

- `prompts/planner.md`
- `prompts/generator.md`
- `prompts/evaluator.md`
- `prompts/impact_propagation_analyzer.md` · **核心** · 影响传播分析

## 9. 不变量

- I-1 · `engineering_change.status=approved` · 必须 `approved_by_owner_at IS NOT NULL`
- I-2 · 变更导致 BOQ 调整 · 必须同步 certifications 签证
- I-3 · 索赔必须合同期内提出(FIDIC 典型 28 天)· 超期标 late
- I-4 · 签证 cost > ¥50,000 · 必须三方签(非二方)
- I-5 · RFC 批准后 · 必须生成 change_impact_assessment

## 10. SLA

| 操作 | planner | generator | evaluator |
|---|---|---|---|
| 影响分析 | 60s | 300s | 120s |
| RFC 审查 | 60s | 180s | 60s |
| 索赔评估 | 60s | 240s | 120s |

## 11. 状态

Stage 4 · 5 表 · 4 prompts · 锦屏工期延期签证场景。

---

version: 0.1.0 · 2026-04-23
