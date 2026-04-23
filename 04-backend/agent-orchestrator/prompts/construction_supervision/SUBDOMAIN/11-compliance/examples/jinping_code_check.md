# Example · 锦屏 · 合规检查 + 法规变更应对

---

## 1. 5/19 · W-208 UT 不合格 · 自动合规扫描

- 触发:`csr.inspection_lots.verdict = 'fail'`
- pgmq 消息 → compliance 模块
- 系统自动 INSERT compliance_check:

```json
{
  "check_no":"JP-CC-2026-0055",
  "target_type":"inspection_lot",
  "target_id":"<lot>",
  "triggered_by":"auto_on_event",
  "verdict":"non_compliant",
  "mandatory_violated":2
}
```

- 违反:GB 50205-2020 §7.2.4(UT 限值)+ GB 50300-2013 §5.0.4(主控须全 pass)
- followup_actions:已挂接 02-quality 的 A5 JP-RO-2026-0017

整改闭环后 · 自动重跑 compliance_check · verdict=compliant。

## 2. 6/08 · 法规变更 · regulation_diff_detector

系统定时任务每周一 03:00 · 抓取住建部标准公告。
6/08 发现:**GB 50411-2019 (2020-08-01 生效)** vs **GB 50411-2009 (项目开工时适用版本)**。

### 6/08 03:15 · detector 输出

```json
{
  "summary":{"added":4,"changed":12,"mandatory_changes":6},
  "retroactive_check_required":true,
  "retroactive_scope":{
    "sub_parts_affected":["建筑节能"],
    "inspection_lots_count":18
  }
}
```

### 关键差异

- §6.1.1 · 围护 K 值:**0.6 → 0.45 W/(m²·K)**
- §6.3.5 · (新增)外墙保温必 A 级不燃

### retroactive_risk

- 高:现有保温设计是 B1 级 · 新规要 A 级
- 现有 K 值按 0.55 · 介于新旧之间

## 3. 6/08 09:00 · 张总监人工确认

打开 `<RegulationDiffPanel />`:
- 看到 6 条强制性变更
- 点击 "§6.1.1" · 看 diff
- 点击 "查本项目影响" · 跳转 compliance_checks retroactive view
- 手动调用法务咨询

## 4. 6/09 · 法务回复

锦屏县住建局 · 项目按"开工时版本"继续 · 但需:
- 显式在档案中说明按 GB 50411-2009
- 新增条款 §6.3.5(A 级) · 不适用(本项目是已采购 B1 级)
- 按 "项目适用法规截面" 原则

## 5. 6/09 10:00 · 系统记录

- `csr.compliance_checks` · 新建一条 regulation_snapshot 记录
- 标签 · "本项目适用 GB 50411-2009 版 · 截止 2026-04-20 开工版本"
- 归档 · 法务咨询函扫描件入 archive_package

## 6. 归档时刻

- 6/22 · archive_package JP-ARCH-2026-0001 · completion 类型
- 7 类全齐 · has_bim=true · 通过完整性检查
- 组装 zip · 480MB · SHA256 计算 · 上传 digital_archive

## 7. 价值

- 合规扫描自动化:从 "人工检查 2 小时" → 5 秒完成
- 法规追踪:每周扫描 · 不会漏住建部新规
- 回溯影响分析 · LLM 给出具体数字 · 决策依据清楚
- 归档完整性 · CHECK 约束强制 · 不缺类

---

version: 0.1.0 · 2026-04-23
