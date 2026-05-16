# 08-acceptance · WORKFLOW

---

## 1. 全景(竣工阶段)

```mermaid
flowchart TB
    A[7 大分部 + 节能分部 全 pass] --> B[施工方 · 竣工报告]
    B --> C[监理 · 工程质量评估报告<br/>GB/T 50319 §5.6.5]
    C --> D[五方约定联合验收日期]

    D --> E[专项验收]
    E --> E1[消防 · GB 50016]
    E --> E2[防雷 · GB 50057]
    E --> E3[节能 · GB 50411]
    E --> E4[人防 · GB 50038]

    E1 & E2 & E3 & E4 --> F{全专项通过?}
    F -->|否| G[整改 · 待验]
    G --> F
    F -->|是| H[五方联合验收会]
    H --> I[现场核查 + 资料审查]
    I --> J{一致通过?}
    J -->|yes| K[五方签字<br/>acceptance_record verdict=accepted]
    J -->|条件通过| L[列 conditional_items]
    J -->|不通过| M[整改 · 再验]

    K --> N[开具 handover_certificate]
    L --> N
    N --> O[15 工作日内备案]
    O --> P[完档移交 digital_archive]
```

## 2. 状态机

### acceptance_record

```mermaid
stateDiagram-v2
    [*] --> scheduled: 约定日期
    scheduled --> in_progress: 会议开始
    in_progress --> accepted: 五方签齐 + 通过
    in_progress --> conditional: 条件通过
    in_progress --> rejected: 不通过
    rejected --> scheduled: 整改后重约
    conditional --> accepted: 条件闭环
    accepted --> [*]
```

### handover_certificate

```mermaid
stateDiagram-v2
    [*] --> issued: 五方签齐开具
    issued --> filed: 备案通过
    filed --> archived: 档案移交
    issued --> voided: 严重发现 · 撤销(极少)
    archived --> [*]
    voided --> [*]
```

## 3. 隐蔽工程状态机

```mermaid
stateDiagram-v2
    [*] --> pending: 施工完 · 即将覆盖
    pending --> pass: 验收合格 + 影像 ≥4 + 双签
    pending --> fail: 验收不合格
    fail --> pending: 暴露 · 整改 · 再验
    pass --> [*]: 允许掩埋
```

## 4. RACI · 五方联合验收

| 活动 | O | C | S | D | G |
|---|:-:|:-:|:-:|:-:|:-:|
| 竣工报告 | I | **A/R** | C | C | I |
| 质量评估报告 | I | I | **A/R** | I | I |
| 消防 / 节能 专项 | **A** | R | R | R | I |
| 五方约定 | **A/R** | R | R | R | R |
| 现场核查 | R | R | **R** | R | R |
| 验收决议 | **A/R** | R | R | R | R |
| 竣工证书开具 | **A/R** | R | R | R | I |
| 15 日备案 | **A/R** | C | C | I | I |
| 档案移交 | **A** | R | R | R | R |

## 5. 15 工作日备案(建质 171 号)

- 自 final_acceptance_date 起 · 15 工作日内(不含节假日)
- 逾期 · 建设单位被处罚(3 ~ 30 万)
- ArchIToken 在 filing_deadline 前 3 天推送警报

## 6. 触发

| 事件 | → |
|---|---|
| 所有 sub_part verdict=pass | unit_project rollup → 可进入竣工流程 |
| acceptance_record verdict=accepted (level=unit_project) | 生成 handover_certificate |
| handover_certificate filed | 触发 digital_archive 归档流程 |
| handover_certificate filed | 启动 digital_twin 的运维数据流 |

---

version: 0.1.0 · 2026-04-23
