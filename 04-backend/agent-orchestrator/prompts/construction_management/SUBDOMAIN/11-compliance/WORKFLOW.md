# 11-compliance · WORKFLOW

---

## 1. 合规扫描流程

```mermaid
flowchart TB
    A[事件触发<br/>inspection_lot · ms · change_order] --> B[按 target 聚合适用强条]
    B --> C[逐条核查<br/>compliance_check]
    C --> D{全合规?}
    D -->|yes| E[verdict=compliant · 继续]
    D -->|部分违反强条| F[verdict=non_compliant]
    F --> G[followup_actions · 触发 02-quality A5]
    G --> H[整改 · 闭环]
    H --> C
    D -->|general_flagged > 0| I[verdict=partial · 提醒 · 不阻]
```

## 2. 法规变更流程

```mermaid
flowchart LR
    A[新规发布<br/>住建部 / GB / JGJ] --> B[regulation_diff_detector]
    B --> C[差异清单<br/>added/changed/removed clauses]
    C --> D[supervisor 人工确认]
    D -->|采纳| E[sl.code_clauses INSERT/UPDATE]
    E --> F[反查历史 target · 重扫合规]
    F --> G{发现回溯违反?}
    G -->|yes| H[告警 · 评估风险]
    G -->|no| I[记录在案 · 继续]
```

## 3. 报建审批

```mermaid
flowchart LR
    A[开工前] --> B[construction_permit · 住建局]
    B --> C[quality_registration · 质监]
    B --> D[safety_filing · 安监]
    C & D --> E[开工]

    E --> F[施工过程]
    F --> G[fire_design_review · 消防设计审查]
    G --> H[fire_acceptance · 消防验收(竣工前)]
    F --> I[lightning_protection · 防雷验收]
    F --> J[civil_defense · 人防验收(如有)]
    F --> K[environmental · 环保验收]
    F --> L[energy · 节能验收]

    H & I & J & K & L --> M[竣工验收 · 08-acceptance]
```

## 4. 归档流程

```mermaid
flowchart TB
    A[月底] --> B[monthly archive_package]
    B --> C[digital_archive 月度归档]

    D[阶段完] --> E[stage archive_package]

    F[竣工] --> G[completion archive_package]
    G --> H{完整性检查<br/>7 类齐?}
    H -->|否| I[补材料]
    I --> G
    H -->|是| J[digital_archive 最终归档]
    J --> K[本地城建档案馆纸电混合移交]
```

## 5. RACI

| 活动 | O | C | S |
|---|:-:|:-:|:-:|
| 合规扫描 | I | I | **A/R** |
| 整改触发 | I | R | **A/R** |
| 法规采纳 | I | I | **A/R** |
| 报建准备 | **A/R** | R | C |
| 专项验收 | **A** | R | R |
| 归档包组装 | I | R | **A/R** |

## 6. 触发

| 事件 | → |
|---|---|
| inspection_lot verdict=pass | 本子域 auto compliance_check |
| method_statement approved | 同 |
| engineering_change approved | 同 |
| compliance_check verdict=non_compliant | 02-quality defect INSERT |
| 专项未通过 | 08-acceptance 阻 handover_certificate |
| 归档包 status=archived | digital_archive 接收 |

---

version: 0.1.0 · 2026-04-23
