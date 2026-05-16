# 03-safety · WORKFLOW

安全控制流程 · mermaid + 状态机 + RACI。

---

## 1. 全景

```mermaid
flowchart TD
    A[合同签订] --> B[HSE 计划编制<br/>safety_plan v1]
    B --> C{含危大?}
    C -->|yes| D[辨识危大<br/>住建部 37 号令]
    C -->|超规模| E[专家论证<br/>05-method_statement]
    D --> F[HIRA 登记册<br/>hira_generator]
    E --> F
    F --> G[控制措施 + 应急预案]
    G --> H[三级交底<br/>company → project → crew]

    H --> I[每日班前会<br/>toolbox_talk]
    I --> J{作业风险 ≥ 中?}
    J -->|yes| K[申请作业许可<br/>work_permit]
    J -->|no| L[作业]
    K --> M[supervisor + safety 双签]
    M --> L

    L --> N{巡视发现?}
    N -->|隐患| O[safety_hazard 登记]
    N -->|事故/未遂| P[incident_report 24h 内]
    N -->|正常| L

    O --> Q[A5 整改通知]
    Q --> R[闭环]
    P --> S[升级 · 本地安监上报]
```

## 2. hazard 状态机

```mermaid
stateDiagram-v2
    [*] --> open: 登记
    open --> rectifying: A5 签发
    rectifying --> verifying: 整改完成 · 请求复查
    verifying --> closed: 复查合格 + 影像
    verifying --> rectifying: 复查失败
    open --> dismissed: 误报 / 豁免
    closed --> [*]
    dismissed --> [*]
```

## 3. work_permit 状态机

```mermaid
stateDiagram-v2
    [*] --> requested: 申请
    requested --> approved: 双签通过
    approved --> active: 实际开工 · 填 actual_start_at
    active --> closed: 作业结束 · 填 actual_end_at
    approved --> expired: end_at 到 · 未开工
    active --> expired: end_at 到 · 未关
    approved --> revoked: 条件变化 · 撤销
    active --> revoked: 同上
    closed --> [*]
    expired --> [*]
    revoked --> [*]
```

## 4. incident 状态机

```mermaid
stateDiagram-v2
    [*] --> pending: 上报
    pending --> investigating: 调查启动
    investigating --> closed: 调查结束 · 报告归档
    investigating --> referred_to_authority: 重大 · 上报安监
    closed --> [*]
    referred_to_authority --> closed: 权威批复后收档
```

## 5. RACI · 安全子域

| 活动 | O | C | S | SO(Safety Officer) | D |
|---|:-:|:-:|:-:|:-:|:-:|
| HSE 计划 | I | **R** | **A/R** | R | C |
| 危大辨识 | I | **R** | **A/R** | R | C |
| HIRA 生成 | I | R | **A/R** | **R** | I |
| 专项方案 | I | **R** | **A** | R | C |
| 专家论证 | I | **R** | **A** | C | C |
| 三级交底 | I | **A/R** | R (见证) | R | I |
| 作业许可双签 | I | R | **R** | **R** | I |
| 班前会 | I | **A/R** | C | R | I |
| 隐患整改 | I | **A/R** | **R** | R | I |
| 事故 24h 上报 | I | **A/R** | R | R | I |
| 工程暂停令 (B3) | I | I | **A/R** | I | I |

## 6. 跨子域触发

| 源 | 事件 | 目标 |
|---|---|---|
| 03-safety | hazard.severity = critical | → 01-progress · activity.paused |
| 03-safety | incident.severity = fatal | → 工程暂停令 · 全项目 |
| 03-safety | permit.expired 未关 | → supervision_log 违规记录 |
| 02-quality | defect 导致 · rework 现场 | → hazard 识别(动火 / 高处再评估) |
| 01-progress | 赶工方案 | → HIRA 重评估(资源叠加 · 风险升高) |

## 7. 危大工程清单(锦屏适用)

基于 建办质〔2018〕31 号 附件一 · 锦屏 520㎡ 重钢别墅项目:
- ✅ 起重吊装 (塔吊 · QTZ40 以上)
- ✅ 脚手架工程 (外立面作业 · 高度 ~9m)
- ❌ 深基坑 (基础埋深 < 3m · 非深)
- ❌ 高大模板 (模板高度 < 8m)
- ❌ 暗挖工程 / 爆破 / 建筑拆除 (本项目不涉及)

所以锦屏的危大清单 = 吊装 + 脚手架 · 两项专项方案需编。

---

version: 0.1.0 · 2026-04-23
