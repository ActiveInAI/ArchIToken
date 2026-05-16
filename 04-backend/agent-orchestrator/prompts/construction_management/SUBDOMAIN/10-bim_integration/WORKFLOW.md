# 10-bim_integration · WORKFLOW

---

## 1. 全景

```mermaid
flowchart TB
    A[detailed_design 产出 IFC] --> B[CSR 镜像 bim_models v1]
    B --> C[解析 · 索引 GUID]
    C --> D[碰撞扫描]
    D --> E[ifc_clash_triage LLM 分级]
    E --> F{hard clashes?}
    F -->|>0 hard| G[回 detailed_design 修正]
    G --> B
    F -->|all resolved/accepted| H[模型 status=active]

    H --> I[4D 链接 · activities.bim_element_guids]
    H --> J[5D 链接 · boq_items.bim_element_guids]

    I --> K[每日进度 · BIM 切片]
    J --> L[每日产值 · BIM 热图]

    M[施工变更] --> N[新 bim_models vN]
    N --> D

    O[竣工] --> P[bim_models 升 'as-built']
    P --> Q[移交 digital_twin]
```

## 2. CDE 状态(ISO 19650)

```mermaid
stateDiagram-v2
    [*] --> WIP: 草稿
    WIP --> Shared: 团队协作
    Shared --> Published: 合同交付(正式)
    Published --> Archive: 项目结束
    Shared --> WIP: 退回修改
    Archive --> [*]
```

## 3. clash_report 状态机

```mermaid
stateDiagram-v2
    [*] --> open
    open --> acknowledged: 已阅
    acknowledged --> fixing: 设计返工
    fixing --> resolved: 新模型确认解决
    open --> accepted_as_is: 可接受(软碰撞)
    open --> duplicate: 重复报告
    resolved --> [*]
    accepted_as_is --> [*]
    duplicate --> [*]
```

## 4. RACI

| 活动 | O | C | S | D |
|---|:-:|:-:|:-:|:-:|
| BIM 模型产出 | I | R | C | **A/R** |
| 碰撞扫描 | I | R | **A/R** | C |
| 分级 (triage) | I | I | **A/R** | C |
| 修正 (hard clashes) | I | R | R | **A/R** |
| 4D/5D 链接维护 | I | R | **A/R** | I |
| CDE 状态流转 | C | R | **A/R** | R |

## 5. 触发

| 事件 | → |
|---|---|
| bim_model status=active | 替换前一个为 superseded |
| clash_report.clash_type=hard AND status=open · 关联 activity | 禁止该 activity 进施工 |
| 每次 bim_model 上传 | 自动跑碰撞扫描 · 产出 clash_reports |

---

version: 0.1.0 · 2026-04-23
