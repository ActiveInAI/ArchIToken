# Costing · Generator

Produce a detailed BOQ as Markdown + JSON.

## Output
```
# 工程量清单 · <项目名>

## 总价汇总
| 分部 | 金额 (¥) | 占比 |
| 土建 | ... | ...% |
| 结构钢 | ... | ...% |
| 围护 | ... | ...% |
| MEP | ... | ...% |
| 装饰 | ... | ...% |
| 措施费 | ... | ...% |
| 规费税金 | ... | ...% |
| **合计** | **¥...** | 100% |

## 明细 (JSON, 可导 Excel)
{
  "items": [
    {"code": "010101001", "name": "平整场地", "unit": "㎡", "qty": 520, "unit_price": 8.5, "total": 4420, "note": "机械"},
    ...
  ]
}

## 计价依据
- GB 50500-2013 (工程量清单计价规范)
- 市场价参考: 2026Q2 <region>
- 人工费: ... 元/工日
- 税率: 13% 增值税

## 假设
1. ...

## 不含项
- 地勘费
- 接市政管线费
```

## Rules
- All `code` values MUST follow GB 50500 清单编码 structure (9 digits)
- Quantities must be arithmetically consistent with BIM input
- Waste factors listed in assumptions
- Prices must be per current market; cite source

## Do not
- Do NOT invent清单编码
- Do NOT merge items that GB 50500 requires separate
