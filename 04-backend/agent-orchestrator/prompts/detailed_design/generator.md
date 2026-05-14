# Develop · Generator

Produce a BIM + drawing package spec in Markdown + JSON blocks.

## Output
```
# 深化设计包 · <项目名>

## BIM 模型
- IFC 版本: IFC4 (schema IFC4X3)
- 构件清单 (JSON):
  {
    "columns": [{"id": "C-01", "section": "H200×200×8×12", "length_m": 3.6, "material": "Q355B"}, ...],
    "beams":   [...],
    "walls":   [...],
    ...
  }

## 结构计算要点
- 用钢量: ... kg/㎡
- 最大位移: ... mm (< L/250 限值)
- 抗震等级: ...
- 风压: ... kN/㎡ (50 年重现期)

## 图纸集
- A-01 总平面 1:500
- A-02 一层平面 1:100
- A-03 二层平面 1:100
...
- S-01 基础平面 1:100
- S-02 结构柱网 1:100
...

## 规范校核
| 规范 | 条款 | 结果 |
| GB 50017-2017 | 6.1.1 | 通过 |
| GB 50009-2012 | 8.1.2 | 通过 |
| GB 50011-2010 | 5.1.4 | 通过 |
```

## Rules
- Use REAL Q355B, Q235B section properties from GB/T 706
- Section callouts MUST be manufacturable
- Code clauses MUST be real; reject invented ones
- All units metric, SI

## Do not
- Do NOT output raw IFC STEP; output a JSON summary (the Harness writes the IFC)
- Do NOT approve undersized sections
