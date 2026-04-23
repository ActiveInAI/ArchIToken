# 05-method_statement · WORKFLOW

---

## 1. 全景

```mermaid
flowchart TB
    A[识别危大工程<br/>03-safety HIRA] --> B[施工方编制方案]
    B --> C[上传 PDF + 结构化元数据<br/>pdf_sha256 锁]
    C --> D[监理审查<br/>review_status = in_review]
    D -->|major 意见| E[退回修改]
    E --> B
    D -->|approved| F{is_super_scale?}

    F -->|否| G[company 交底 seq=1]
    F -->|是| H[筹备专家论证<br/>expert_review scheduled]
    H --> I[论证会<br/>5 位专家 + 3 专业]
    I -->|pass| G
    I -->|pass_with_revisions| J[修订方案]
    J --> D
    I -->|fail| B

    G --> K[project 交底 seq=2]
    K --> L[crew 交底 seq=3]
    L --> M[三级齐<br/>允许开工]
    M --> N[相关 activity 解除阻塞]
```

## 2. method_statement 状态机

```mermaid
stateDiagram-v2
    [*] --> pending: 上传
    pending --> in_review: 监理开始审查
    in_review --> rejected: major 意见
    rejected --> in_review: 重新提交(version_no+1)
    in_review --> approved: 无 major 意见
    approved --> superseded: 被更新版本取代
    approved --> [*]: 项目完成
    superseded --> [*]
```

## 3. expert_review 状态机

```mermaid
stateDiagram-v2
    [*] --> scheduled: 预约
    scheduled --> in_progress: 会议开始
    in_progress --> concluded: verdict 给出
    concluded --> archived: 会议纪要 + 结论归档
    archived --> [*]
```

## 4. RACI

| 活动 | O | C | S | SO | Expert |
|---|:-:|:-:|:-:|:-:|:-:|
| 方案编制 | I | **A/R** | C | C | - |
| 方案审查 | I | R | **A/R** | R | - |
| 邀请专家 | I | R (负担费用) | **A/R** | R | - |
| 专家论证 | I | R | R | R | **A/R** |
| 意见修订 | I | **A/R** | R | C | - |
| 三级交底 | I | **A/R** | R (见证) | R | - |
| 开工前核查 | I | R | **A/R** | R | - |

## 5. 触发关系

| 事件 | → |
|---|---|
| `03-safety.HIRA` 识别危大 | 本子域生成 MS 占位 |
| MS approved | 03-safety 允许发该类 work_permit |
| 三级交底齐 + MS approved | 01-progress 的 activity 解除阻塞(is_key_process 自动 TRUE) |
| MS rejected | 01-progress 的 activity 标 `blocked_by_ms = ms_id` |

---

version: 0.1.0 · 2026-04-23
