# 12-change_order · WORKFLOW

---

## 1. 全景

```mermaid
flowchart TB
    A[变更需求] --> B{类型}
    B -->|设计改动| C[RFC · engineering_change]
    B -->|小范围| D[洽商 · site_consultation]
    B -->|补偿主张| E[索赔 · claim]
    B -->|现场认定| F[签证 · certification]

    C --> G[impact_propagation_analyzer]
    D --> G
    E --> G
    G --> H[影响报告]

    H --> I[三方审查]
    I --> J{owner approve?}
    J -->|是| K[执行]
    J -->|否| L[驳回]

    K --> M[联动影响]
    M --> M1[BOQ · quantity_costing]
    M --> M2[schedule · 01-progress]
    M --> M3[BIM · 10-bim_integration]
    M --> M4[compliance_check · 11]
    M --> M5[签证 · certification]

    K --> N[归档 · digital_archive]
```

## 2. engineering_change 状态机

```mermaid
stateDiagram-v2
    [*] --> draft: 起草
    draft --> reviewing: 提交
    reviewing --> rejected: owner/designer 拒
    rejected --> draft: 重提
    reviewing --> approved: 三方签
    approved --> executed: 现场落地
    executed --> closed: 结清签证 + 归档
    reviewing --> cancelled: 发起方撤回
    cancelled --> [*]
    closed --> [*]
```

## 3. claim 状态机

```mermaid
stateDiagram-v2
    [*] --> notified: 28d 内通知
    notified --> submitted: 42d 详细资料
    submitted --> under_review: 监理评估
    under_review --> partial_granted: 部分支持
    under_review --> granted: 全支持
    under_review --> rejected: 驳回(+超期等)
    partial_granted --> settled: 支付 / 抵扣
    granted --> settled
    rejected --> [*]
    settled --> [*]
```

## 4. RACI

| 活动 | O | C | S | D |
|---|:-:|:-:|:-:|:-:|
| RFC 发起 | R | R | R | R |
| RFC 审查 | I | C | **A/R** | R |
| 设计确认 | I | I | R | **A/R** |
| RFC 批准 | **A/R** | R | R | R |
| 洽商 agreed | **A/R** (> 1 万) | R | R | C |
| 索赔提交 | C | **A/R** | R | I |
| 索赔裁定 | **A/R** | R | **A/R** (建议) | I |
| 签证开具 | R | R | **A/R** | I |

## 5. 合同期限关键点

| 行为 | 期限 | 标号 |
|---|---|---|
| 索赔通知 | 28 天(自事件) | FIDIC §20 |
| 索赔详细资料 | 42 天 | FIDIC §20 |
| 业主回复 | 28 天 | FIDIC §20 |
| 设计变更答复 | 14 天 | GF-2017-0201 专用条款(通常) |

## 6. 跨子域触发

| 事件 | → |
|---|---|
| engineering_change.status = approved | 同步 quantity_costing(BOQ) + 01-progress(schedule) + 10-bim_integration(新 v) |
| claim.claim_type = time_extension + granted | 01-progress 合同竣工日更新 |
| certification.status = signed + amount > 0 | quantity_costing 新增清单条目 |
| 任何变更 | 11-compliance 自动跑一次强条扫描 |

---

version: 0.1.0 · 2026-04-23
