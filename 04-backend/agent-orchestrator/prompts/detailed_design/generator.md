# Detailed Design · Generator

Produce a BIM + drawing package spec in Markdown + JSON blocks for the 100-room Q235B bolted hotel catalog.

## Output
```
# 深化设计包 · <项目名>

## 项目控制基线
- 结构体系: Q235B全栓接重钢 · 无现场焊接
- 精度: 0~-2mm · 孔洞均为圆孔
- 模数: 跨度≤12m · 层高3.6m · ≤5层/18m · 600mm模数
- 周期: 65~75天(P1 D1-D15 / P2 D15-D60 / P3 D40-D75)

## BIM 模型
- IFC 版本: IFC4.3
- 构件清单 (JSON):
  {
    "columns": [{"id": "C-01", "section": "HW200×200", "length_m": 3.6, "material": "Q235B"}, ...],
    "beams":   [...],
    "bolted_connections": [...],
    "mep_round_penetrations": [...]
  }

## 198份图纸目录
| 专项 | 数量 | 阶段 | 关键闸门 |
|---|---:|---|---|
| ① 重钢装配式钢结构专项深化 | 42 | P1为主 | 下单前100%完成 |
| ② 建筑土建深化 | 25 | P2/P3 | 取消砌体承重,钢骨架围护 |
| ③ 室内精装深化 | 33 | P1/P2/P3 | 预埋前置,声桥切断 |
| ④ 机电综合深化 | 30 | P1/P2/P3 | 穿梁圆孔与SS-04-05一致 |
| ⑤ 软装·厨房·景观·智能化 | 16 | P1/P2/P3 | 重型预埋和钢基座 |
| ⑥ 装配式围护结构 | 20 | P2/P3 | ALC/气密/热桥 |
| ⑦ 消防专项深化 | 14 | P2 | 防火包覆和排烟避梁 |
| ⑧ 现场装配施工工艺 | 18 | P2/P3 | 吊装/调平/紧固/QC |

## P1先行冻结清单
- SS-01-01~SS-01-12 结构体系与截面定型
- SS-02-01~SS-02-11 全栓接节点深化
- SS-03-01~SS-03-08 模块化单元拆分深化
- SS-04-01~SS-04-05/08/09 关键加工、孔位、BOM和预埋件
- MEP-01-01~03, MEP-02-01~02/04, ID-03-01/05, ID-04-01~02

## 规范校核
| 规范/规则 | 用途 | 输出状态 |
| GB 50017 | 钢结构设计依据 | professional_review_required |
| GB 50011 | 抗震缝/抗侧力体系 | professional_review_required |
| GB 50009 | 荷载取值 | professional_review_required |
| GB 50205 / GB 50661 | 钢结构施工质量和焊接 | professional_review_required |
```

## Rules
- Use Q235B unless the input explicitly approves another material.
- Treat the 198-sheet catalog as the required directory structure.
- P1 sheets must be separated and marked as production blockers where applicable.
- MEP penetrations must use round holes and reference SS-04-05.
- Do not label outputs construction-ready or submission-ready without professional signoff.
- Code clauses MUST be real; reject invented ones.
- All units metric, SI

## Do not
- Do NOT output raw IFC STEP; output a JSON summary (the Harness writes the IFC)
- Do NOT approve undersized sections
