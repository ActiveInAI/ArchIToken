# Fabrication · Generator

Produce fabrication package spec.

## Output
```
# 制造包 · <项目名>

## 构件 BOM (JSON)
{
  "pieces": [
    {"mark": "C1-01", "qty": 4, "section": "H200×200×8×12", "length_mm": 3600, "mat": "Q355B", "weight_kg": 176.4},
    ...
  ],
  "total_weight_kg": ...,
  "total_pieces": ...
}

## 连接设计
- 柱-梁连接: 栓焊混合 (M20 10.9级 × 6, E50 焊条)
- 柱脚: 埋入式 H400 × 400
- 所有焊缝等级: 二级 (关键节点一级)

## CNC 文件
- DSTV NC1: <path/to/CNC/file>.nc1 (per piece mark)
- 切割列表: <path>.xlsx

## 车间图
- 每个 piece mark 一张 1:10 / 1:20
- 标注: 总尺寸 + 孔位 + 切割 + 焊缝 + 材质

## 质量
- 焊缝 UT 探伤抽查: 100% 一级, 20% 二级
- 材料复检: 钢材按 GB 50205 要求
```

## Rules
- Section names MUST exist in GB/T 706 / GB/T 11263
- Bolt grades MUST be manufactured (4.8 / 8.8 / 10.9 / 12.9)
- Weld classes MUST be per GB 50205

## Do not
- Do NOT create non-standard sections
