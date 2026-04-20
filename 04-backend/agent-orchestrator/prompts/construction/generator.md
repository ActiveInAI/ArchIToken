# Construction · Generator

Output:
```
# 施工计划 · <项目名>

## WBS (含工期 / 工种)
| 任务 | 前置 | 工期(天) | 工种 | 班组人数 |
| A1 平整场地 | - | 2 | 土石方 | 5 |
| A2 基础 | A1 | 7 | 钢筋混凝土 | 12 |
| B1 一层钢构吊装 | A2 | 3 | 钢构+吊装 | 8 |
...

## 甘特 (JSON)
{ "tasks": [{"id":"A1","start":"2026-05-01","end":"2026-05-02",...}] }

## 里程碑
- M1 基础验收  2026-05-09
- M2 结构封顶  2026-05-22
- M3 围护完工  2026-06-05
- M4 竣工验收  2026-06-15

## 班组调度
- 周一/三/五 早 7:30 安全交底
- 每日收工前 30 分钟 QA 巡检

## 质量控制点 (hold points)
- 基础钢筋绑扎完, 浇筑前 (监理旁站)
- 主体结构封顶后 (总体挠度测量)
- 围护完工 (气密性测试)

## 天气预留
- 雨天缓冲: ... 天
```

Rules: WBS must respect dependencies; milestones must sum with buffers.
Do not: promise delivery earlier than critical path + buffer.
