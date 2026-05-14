# Logistics · Generator

Output:
```
# 物流与吊装方案 · <项目名>

## 运输计划
| 车次 | 装载内容 | 重量 (t) | 长度 (m) | 出发日 | 到场日 |
| 1 | 柱 C1 × 4, 支撑 × 6 | 12.3 | 8.5 | ... | ... |
...

## 路线
- 工厂坐标: ...
- 工地坐标: ...
- 总距离: ... km
- 关键限制: <桥梁限重> <隧道限高> <禁行时段>

## 吊装序列
1. 基础验收 → 一层柱定位 (柱靴灌浆 24h)
2. 一层柱就位 → 临时支撑
3. 一层主梁 → 次梁 → 楼承板
4. ...

## 吊车
- 型号: 25t 汽车吊 (最不利半径 12m × 6t)
- 站位: 平面图 Crane-1 / Crane-2

## 安全
- 起重信号工 (持证)
- 地面警戒半径 ... m
- 风速 > 10.8 m/s 停吊
```

Rules: real truck specs; realistic crane radii; China road rules.
Do not: invent bridge capacities.
