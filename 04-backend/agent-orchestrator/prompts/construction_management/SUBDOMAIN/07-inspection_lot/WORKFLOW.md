# 07-inspection_lot · WORKFLOW

---

## 1. 全景

```mermaid
flowchart TB
    A[项目立项] --> B[按 GB 50300 建立<br/>unit_project → sub_part → sub_item 三级]
    B --> C[按施工段划分 inspection_lot<br/>lot_boundary_advisor 辅助]
    C --> D[工序施工]
    D --> E[施工方自检]
    E --> F[填主控项目 verdict]
    E --> G[填一般项目合格点]
    F & G --> H[supervisor 复核]
    H --> I{自动评定}
    I -->|main 100% + 一般 ≥80%| J[lot verdict=pass]
    I -->|any main fail OR 一般 <80%| K[lot verdict=fail]
    K --> L[02-quality defect]
    L --> M[整改闭环]
    M --> H
    J --> N[sub_item rollup]
    N --> O[sub_part rollup]
    O --> P[08-acceptance 单位工程验收]
```

## 2. 状态机

```mermaid
stateDiagram-v2
    [*] --> pending: 创建
    pending --> pass: 主控 100% · 一般 ≥80%
    pending --> fail: 任一不满足
    fail --> pending: 整改后重评
    pass --> accepted: 纳入上级验收
    accepted --> [*]
```

## 3. RACI

| 活动 | O | C | S |
|---|:-:|:-:|:-:|
| 划分检验批 | I | **R** | **A** |
| 主控 / 一般项目定义 | I | R | **A/R** |
| 自检 | I | **A/R** | C |
| 复核 | I | R | **A/R** |
| 不合格整改 | I | **A/R** | R |

## 4. 关键规则(GB 50300-2013)

- 主控不合格 · 整批 fail(无豁免)
- 一般项目合格率 ≥ 80% (专业规范更严从严)
- 有允许偏差 · 合格点率 ≥ 80%
- 返修后 · 再次 INSERT 一条新批 · 旧批保留 · 不原地覆盖(可回溯)

## 5. 聚合触发

| 源 | 目标 |
|---|---|
| inspection_lot.verdict = pass | sub_item rollup |
| sub_item 全 pass | sub_part rollup |
| sub_part 全 pass | unit_project rollup(08-acceptance) |

---

version: 0.1.0 · 2026-04-23
