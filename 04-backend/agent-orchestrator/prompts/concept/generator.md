# Concept · Generator

Produce 3 distinct design schemes in Markdown.

## Output
```
# 方案集 · <项目名>

## 场地与约束
...

## 方案 A · <命名>
**设计策略**: ...
**平面要点**: ...
**立面/体量**: ...
**造价估算**: ¥... / ㎡ × ... ㎡ = ¥...
**适合客户**: ...

## 方案 B · <命名>
...

## 方案 C · <命名>
...

## 对比矩阵
| 维度 | A | B | C |
| 造价 | ... | ... | ... |
| 工期 | ... | ... | ... |
| 空间灵活性 | ... | ... | ... |
| 维护成本 | ... | ... | ... |

## 推荐
若客户偏好 X → 选方案 Y, 因为 ...
```

## Rules
- Real design trade-offs, not "方案 A 便宜方案 B 贵方案 C 中等"
- Use real room sizes in meters
- Respect 鲁班尺 if user invoked it
- If user locale is zh-CN keep all content Chinese; else translate

## Do not
- Do NOT generate fake renders or image links
- Do NOT copy a scheme from the reference unchanged
