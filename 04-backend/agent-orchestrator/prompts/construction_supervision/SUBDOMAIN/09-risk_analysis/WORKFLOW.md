# 09-risk_analysis · WORKFLOW

---

## 1. 全景

```mermaid
flowchart TB
    A[项目立项] --> B[风险识别 HIRA + 经验库]
    B --> C[risk_entry L/E/C 评分]
    C --> D{severity}
    D -->|critical| E[必须 · 监测 + 预案]
    D -->|major| F[建议 · 监测 + 预案]
    D -->|minor/negligible| G[登记即可]

    E & F --> H[IoT 监测点位部署]
    H --> I[实时数据流]
    I --> J{超阈值?}
    J -->|warning| K[系统告警 · 通知]
    J -->|alarm| L[触发 emergency_plan]
    L --> M[停工 · 撤离 · 救援]
    J -->|normal| I

    E & F --> N[应急预案编制]
    N --> O[approved]
    O --> P[每 6 月演练]
    P --> Q[演练记录 · reset next_drill_due]
```

## 2. 状态机

### risk_entry

```mermaid
stateDiagram-v2
    [*] --> open: 登记
    open --> mitigating: 对策实施中
    mitigating --> monitored: 残余风险监测
    monitored --> closed: 风险消失 (项目阶段结束)
    open --> realized: 风险发生 (事故/延误)
    realized --> closed: 处置完成
    closed --> [*]
```

### emergency_plan

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> approved: supervisor 批
    approved --> active: 随项目激活
    active --> archived: 项目结束
```

## 3. RACI

| 活动 | O | C | S | SO |
|---|:-:|:-:|:-:|:-:|
| 风险识别 | I | R | **A/R** | R |
| LEC 评分 | I | R | **A/R** | R |
| 监测点位部署 | C (费用) | **A/R** | R | R |
| 预案编制 | I | R | **A/R** | R |
| 预案审批 | **A** | C | R | R |
| 定期演练 | I | **A/R** | R (观察) | R |
| 触发处置 | C | **A/R** | R | **R** |

## 4. 触发链

| 事件 | → |
|---|---|
| `risk_entry.severity=critical` 且监测点位为空 | CHECK 拒绝 |
| monitoring_point 超 alarm 阈 | emergency_plan 自动触发 → 03-safety work_permits 暂停 |
| emergency_plan 触发 | 01-progress activity.paused + supervisor 通知 |
| next_drill_due 到期 7 日内 | notifications + supervision_logs 提醒 |
| `realized_at` 填 | 01-progress 工期影响评估 + 12-change_order 潜在变更 |

---

version: 0.1.0 · 2026-04-23
