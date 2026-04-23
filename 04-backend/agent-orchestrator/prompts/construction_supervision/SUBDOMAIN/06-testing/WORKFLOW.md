# 06-testing · WORKFLOW

---

## 1. 取样 + 送检全流程

```mermaid
flowchart TB
    A[触发 · 计划抽样时点] --> B[监理通知取样]
    B --> C[见证取样 test_witnessing]
    C --> D{取样合格?}
    D -->|否| E[补样]
    D -->|是| F[封样 + 照片]
    F --> G[送实验室]
    G --> H[CMA 实验室检测]
    H --> I[lab_report 回传]
    I --> J{verdict?}
    J -->|pass| K[07-inspection_lot 主控通过]
    J -->|fail| L[02-quality 生成 defect]
    L --> M[A5 整改]
```

## 2. 现场检测流程

```mermaid
flowchart LR
    A[选点计划] --> B[监理 + 操作员到场]
    B --> C[校验仪器年检]
    C -->|过期| D[换仪器]
    C -->|OK| E[onsite_test 开始]
    E --> F[测量 + 录数据]
    F --> G[即时判定]
    G -->|pass| H[入数据库]
    G -->|fail| I[02-quality defect]
```

## 3. RACI

| 活动 | O | C | S |
|---|:-:|:-:|:-:|
| 抽样计划 | I | R | **A/R** |
| 见证取样 | I | R (取样) | **A/R** (见证) |
| 送检 | I | **A/R** | R |
| CMA 查验 | I | I | **A/R** |
| 现场检测操作 | I | R (如自行) | **A/R** (见证 / 平行) |
| 不合格升级 | I | R | **A/R** |

## 4. 触发关系

| 事件 | → |
|---|---|
| `lab_report.verdict = 'fail'` | 02-quality INSERT defect + linked_defect_ids 回填 |
| `onsite_test.verdict = 'fail'` | 同 |
| `lab_report.verdict = 'pass'` | 07-inspection_lot 对应主控项标 passed |
| `onsite_test.equipment_calibration < tested_at` | 拒绝 INSERT(CHECK 约束) |

---

version: 0.1.0 · 2026-04-23
