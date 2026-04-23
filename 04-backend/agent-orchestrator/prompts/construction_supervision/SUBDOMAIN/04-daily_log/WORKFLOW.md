# 04-daily_log · WORKFLOW

---

## 1. 全景

```mermaid
flowchart TB
    A[8:00 · 班组开工] --> B[全天记录实时写入]
    subgraph records [全天分散记录]
      B1[巡视 · patrol_record]
      B2[旁站 · monitoring_post]
      B3[平行检验 · parallel_inspection]
      B4[例会 · meeting_minutes · 按计划]
    end
    B --> B1 & B2 & B3 & B4

    records --> C[17:30 · 触发 daily_summary_generator]
    C --> D[supervision_log 草稿]
    D --> E[监理工程师审阅]
    E -->|合格| F[signed_at 签认]
    E -->|修改| C
    F --> G[归档到 digital_archive · 每月批次]
```

## 2. 日志状态机

```mermaid
stateDiagram-v2
    [*] --> draft_auto: 17:30 自动生成
    draft_auto --> reviewing: 监理打开审阅
    reviewing --> edited: 监理修改正文
    edited --> reviewing
    reviewing --> signed: 点击"签认"
    signed --> archived: 月底批次归档
    archived --> [*]

    draft_auto --> missed: 24h 未审阅 → 提醒升级
    missed --> reviewing: 监理终于审
```

## 3. 旁站流程

```mermaid
sequenceDiagram
    participant C as Contractor
    participant S as Supervisor
    participant Sys as System

    C->>Sys: 工序计划启动 (key_process=true)
    Sys->>S: 推送旁站提醒 (1h 前)
    S->>Sys: 点"开始旁站" · start_at 写入
    loop 全过程
        S->>Sys: 实时记录 (语音 / 文字 / 照片)
    end
    S->>Sys: 点"结束旁站" · end_at 写入
    Sys->>Sys: AI 汇总 content + findings
    S->>Sys: 审核后"签发"
```

## 4. RACI

| 活动 | O | C | S |
|---|:-:|:-:|:-:|
| 巡视 | I | I | **A/R** |
| 旁站 | I | C (配合) | **A/R** |
| 平行检验 | I | C | **A/R** |
| 监理日志 | I | I | **A/R** |
| 监理月报 | I | I | **A/R** |
| 例会主持 | C | C | **A/R** |
| 例会纪要 | I | I | **A/R** |

## 5. 自动触发

| 事件 | 触发 | 写入 |
|---|---|---|
| 02-quality 整改签发 | pgmq 消息 | supervision_log.key_events + rectification_issued++ |
| 02-quality 整改闭环 | 同 | rectification_closed++ |
| 03-safety 事故 / 作业许可 | 同 | supervision_log.key_events |
| 01-progress EVM 快照 | 同 | supervision_log.body 注入 SPI/CPI |
| 08-acceptance 验收 | 同 | key_events |

## 6. 月报生成

- 每月 26 日 23:00 触发 · 汇总前 28 天 supervision_logs
- 按 GB/T 50319-2013 §5.5 表 A.0.19 标准化输出
- 监理工程师审签后 · 发送五方

---

version: 0.1.0 · 2026-04-23
