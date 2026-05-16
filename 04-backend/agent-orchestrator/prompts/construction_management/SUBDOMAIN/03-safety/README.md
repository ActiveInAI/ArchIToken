# SUBDOMAIN · 03-safety · 安全控制

> 危险源辨识 · 危大工程 · 高处 / 吊装 / 临电 / 脚手架 / 模板 / 基坑 / 动火 / 受限空间 全覆盖。

---

## 1. 定位

输入: BIM + 施工方案 + 法规 + 现场条件。输出: HIRA 登记册 · 作业许可 · 班前会 · 事故 / 未遂 记录。
合并 v2.0 的"HSE 管理" + 危大专项 · 作为现场安全的单一入口。

## 2. 核心实体

| 实体 | 表 |
|---|---|
| `safety_plan` | `csr.safety_plans` · HSE 计划 |
| `safety_hazard` | `csr.safety_hazards` · 隐患登记(HIRA) |
| `work_permit` | `csr.work_permits` · 作业许可 (动火/高处/受限/吊装) |
| `toolbox_talk` | `csr.toolbox_talks` · 班前会 / 安全交底 |
| `incident_report` | `csr.incident_reports` · 事故 / 未遂 |

完整 DDL: [`DATA-MODEL.md`](./DATA-MODEL.md)

## 3. 主要标准

- **GB 50870-2013** 建筑施工安全技术统一规范 (根)
- **GB 50656-2011** 施工企业安全生产管理规范
- **JGJ 59-2011** 建筑施工安全检查标准
- **JGJ 80-2016** 高处作业 / **JGJ 46-2005** 临电 / **JGJ 130-2011** 扣件脚手架 / **JGJ 162-2008** 模板 / **JGJ 180-2009** 土石方
- **住建部令 第 37 号** 危险性较大的分部分项工程安全管理规定
- **建办质〔2018〕31 号** 危大工程识别清单
- **ISO 45001:2018** · **OSHA 29 CFR 1926**

## 4. 业务场景

> Day 12 · 施工到钢结构吊装 · HIRA 识别 12 条风险 · 最严重 3 条自动生成作业许可模板。
> 班前会 7:00 · 吊装前 AI 自动生成当日交底 · 班组签收 · 10:00 开吊装。

详细场景: [`examples/jinping_lifting_permit.md`](./examples/jinping_lifting_permit.md)

## 5. 关键业务流程

```mermaid
flowchart TB
    A[合同签订] --> B[HIRA 初识别<br/>safety_plan + safety_hazards]
    B --> C{含危大工程?}
    C -->|yes| D[专项方案<br/>05-method_statement]
    C -->|超规模| E[专家论证]
    D --> F[交底 · 3 级<br/>company→project→crew]
    E --> F
    F --> G[作业许可生成<br/>work_permit]

    G --> H[班前会<br/>toolbox_talk]
    H --> I[现场作业]
    I --> J{隐患发现?}
    J -->|yes| K[safety_hazard 登记]
    J -->|no| I
    K --> L[整改 (共用 A5)]
    L --> M[闭环]

    I --> N{事故/未遂?}
    N -->|yes| O[incident_report 24h 内]
    N -->|no| I
```

## 6. API 入口

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/safety/plans` | HSE 计划 |
| POST | `/v1/csr/safety/hira/generate` | LLM 生成 HIRA(子域特定) |
| POST | `/v1/csr/safety/hazards` | 登记隐患 |
| POST | `/v1/csr/safety/work-permits` | 申请作业许可 |
| POST | `/v1/csr/safety/work-permits/{id}/approve` | 批准 |
| POST | `/v1/csr/safety/work-permits/{id}/close` | 作业结束关闭 |
| POST | `/v1/csr/safety/toolbox-talks` | 班前会记录 |
| POST | `/v1/csr/safety/incidents` | 事故 / 未遂上报 |

## 7. 前端组件

- `<HazardMap />` · BIM 热力图 · 高风险部位标红
- `<WorkPermitWizard />` · 四联单式申请向导
- `<ToolboxTalkForm />` · 班前会 · 支持语音转写
- `<IncidentReportForm />` · 事故 24h 内上报

## 8. Prompts

- `prompts/planner.md`
- `prompts/generator.md` · 生成 HSE 计划 / 作业许可 / 交底文本
- `prompts/evaluator.md`
- `prompts/hira_generator.md` · **核心工具** · BIM + 标准 → HIRA 登记册

## 9. 不变量

- I-1 · `work_permit.status = closed` 必须有 end_at · 不允许遗留 open 过夜
- I-2 · 高处 / 动火 / 受限 / 吊装 四类 · 必须 `approved_by` 为 supervisor + safety officer 双签
- I-3 · `safety_hazard.severity = critical` · 自动触发 B3 工程暂停令
- I-4 · 危大工程开工前 · 必须三级交底齐(company/project/crew 各 1 条)
- I-5 · `incident_report` 必须 24h 内入库 · 迟报自动标 `late_reported = true` 留痕

## 10. SLA

| 操作 | planner | generator | evaluator |
|---|---|---|---|
| HIRA 生成 | 60s | 240s | 120s |
| 作业许可模板 | 30s | 60s | 30s |
| 班前会交底 | 30s | 60s | 30s |
| 事故报告协助 | 30s | 120s | 60s |

## 11. 状态

Stage 2 · 完整骨架 · 5 表 · 4 prompts。

---

version: 0.1.0 · 2026-04-23
