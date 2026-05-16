# 02-quality · WORKFLOW

质量控制业务流程 · mermaid + 状态机 + RACI。

---

## 1. 全景流程 (PDCA 闭环)

```mermaid
flowchart TB
    P[Plan · 质量计划<br/>quality_plan v1] --> D[Do · 施工实施]
    D --> C1[Check 1 · 材料进场<br/>material_receipt]
    D --> C2[Check 2 · 检验批验收<br/>inspection_lot]
    D --> C3[Check 3 · 实体检测<br/>onsite_test]

    C1 -->|pass| D
    C1 -->|fail| Q[quality_defect<br/>缺陷登记]
    C2 -->|pass| D
    C2 -->|fail| Q
    C3 -->|pass| D
    C3 -->|fail| Q

    Q --> R{severity?}
    R -->|minor| RO_m[A5 整改<br/>deadline = 3 日]
    R -->|major| RO_M[A5 整改<br/>deadline = 1 日]
    R -->|critical| NCR[NCR 升级<br/>可能停工]

    RO_m --> K[返工 / 返修]
    RO_M --> K
    NCR --> K2[4 选 1 处置]

    K2 -->|rework| K
    K2 -->|repair| K
    K2 -->|concession| DES[Designer 批准]
    K2 -->|scrap| OUT[报废 · 出场]

    DES -->|approved| OWN[Owner 批准] --> D
    DES -->|rejected| K

    K --> V[Act · 复查]
    V -->|pass + 影像| CL[闭环]
    V -->|fail| K

    CL --> P2[更新 quality_plan<br/>或标为 lessons_learned]
```

---

## 2. quality_defect 状态机

```mermaid
stateDiagram-v2
    [*] --> open: 登记
    open --> rectifying: A5 签发 → 施工单位接收整改
    rectifying --> verifying: 自查完成 · 请求复查
    verifying --> closed: 复查合格 + 影像 ≥ 1
    verifying --> rectifying: 复查不合格 · 再返工
    open --> dismissed: 误报 · supervisor 撤销
    closed --> [*]
    dismissed --> [*]
```

## 3. rectification_order 状态机

```mermaid
stateDiagram-v2
    [*] --> open: supervisor 签发
    open --> acknowledged: contractor 签收
    acknowledged --> rectifying: 整改中
    rectifying --> closed: 复查合格 + 影像
    open --> overdue: 截止期已过(自动)
    acknowledged --> overdue: 同上
    rectifying --> overdue: 同上
    overdue --> escalated: > 2 次逾期 → 工程暂停令(B3)
    closed --> [*]
    escalated --> [*]
```

## 4. NCR (ISO 9001:2015 §8.7) 状态机

```mermaid
stateDiagram-v2
    [*] --> raised: 从 defect 升级
    raised --> designer_reviewing: disposition = concession
    raised --> owner_reviewing: disposition ∈ {rework, repair, scrap}
    designer_reviewing --> owner_reviewing: designer approved
    designer_reviewing --> rejected: designer rejected
    owner_reviewing --> approved: owner approved
    owner_reviewing --> rejected: owner rejected
    approved --> implemented: 执行处置
    implemented --> closed: 验证完成
    rejected --> [*]
    closed --> [*]
```

## 5. RACI

| 活动 | O | C | S | D |
|---|:-:|:-:|:-:|:-:|
| 质量计划编制 | I | **R** | **A** | C |
| 材料进场验收 | I | R | **A/R** | I |
| 见证取样 | I | R (取样) | **A/R** (见证) | I |
| 检验批验收 | I | **A/R** | R | I |
| 缺陷登记 | I | R | **A/R** | I |
| A5 整改签发 | I | I | **A/R** | I |
| 整改执行 | I | **A/R** | R (复查) | I |
| NCR 升级 | I | R | **A/R** | C |
| 让步接收批准 | **A** | R | R | **R** |
| 实体检测 | I | R | **A/R** | I |

## 6. 触发条件总览

| 事件 | 触发子域 |
|---|---|
| `quality_defect.severity = critical` 且 `open` 超 2 小时 | → 01-progress · activity.paused |
| `rectification_order.status = overdue` 累计 ≥ 2 条 | → 01-progress · 工期风险 + 03-safety 升级 |
| `material_receipt.verdict = fail` | → 12-change_order (材料变更) 或 material_logistics 换供 |
| `non_conformance_reports.disposition = concession approved` | → 11-compliance 留痕 |

---

version: 0.1.0 · 2026-04-23
