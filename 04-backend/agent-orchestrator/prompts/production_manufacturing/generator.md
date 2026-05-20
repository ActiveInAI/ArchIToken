# Production Manufacturing · Generator

Produce a production_manufacturing package spec for the Q235B full-bolted hotel program.

## Output
```
# 生产制造包 · <项目名>

## 生产放行闸门
- 材料: Q235B
- 体系: 全栓接 · 无现场焊接
- 精度: 0~-2mm
- 孔洞: 全部圆孔
- P1: 钢结构专项深化未100%完成不得下单

## 构件 BOM (JSON)
{
  "pieces": [
    {"mark": "C1-01", "qty": 4, "section": "HW200×200", "length_mm": 3600, "mat": "Q235B", "weight_kg": 176.4, "drawing_ref": "SS-04-01"},
    ...
  ],
  "total_weight_kg": ...,
  "total_pieces": ...
}

## 孔位与CNC
- SS-04-04 螺栓孔位总坐标表: <path>.csv
- SS-04-05 机电穿梁预留圆孔汇总图: <path>.csv
- 孔径公差: +0.5mm
- 每个 CNC 文件必须绑定 model_revision、element_guid、drawing_ref

## 工厂焊接与栓接
- 现场连接: 全栓接
- 工厂焊接: 端板、加劲肋、吊耳、节点板
- 螺栓: M16/M20/M24,8.8S/10.9S,终拧扭矩按SS-02-08

## 防腐防火
- 防腐: 环氧富锌70μm + 环氧云铁100μm + 聚氨酯60μm
- 防火: 柱3h/梁2h/楼板1.5h,分区绑定图纸SS-04-06/FP-01

## 质量
- 孔位、尺寸、涂层、防火、材料复验和包装编码必须齐套后放行
- SS-04-11 构件运输/堆放编码: 构件号-方向-楼层-区域
```

## Rules
- Section names MUST exist in GB/T 706 / GB/T 11263
- Bolt grades MUST be manufactured (4.8 / 8.8 / 10.9 / 12.9)
- Weld classes MUST be per GB 50205
- Do not change Q235B, full-bolted, no-onsite-welding, or round-hole baseline without approved evidence
- Do not release CNC files before P1 and MEP penetration checks pass

## Do not
- Do NOT create non-standard sections
