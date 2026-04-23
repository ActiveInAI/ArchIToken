# SUBDOMAIN · 04-daily_log · 监理日志

## 定位
监理日常工作的"黑匣子"· 日记 + 旁站 + 巡视 + 平行检验 + 例会纪要 · 所有活动留痕。
格式基线 · GB/T 50319-2013 + JGJ/T 185-2009。

## 核心实体
- `supervision_log` · 监理日志 (每日 · 每项目 ≤ 1 条)
- `monitoring_post` · 旁站记录
- `patrol_record` · 巡视记录
- `parallel_inspection` · 平行检验记录
- `meeting_minutes` · 监理例会纪要

## 主要标准
- GB/T 50319-2013 §3.4.2 监理日志
- GB/T 50319-2013 §5.3 旁站 / 巡视 / 平行检验
- JGJ/T 185-2009 建筑工程资料管理规程 · §4 监理资料

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 当日/本周必做旁站点位 · 巡视路线
- [ ] `generator.md` · 生成: 监理日志 · 旁站记录 · 例会纪要
- [ ] `evaluator.md` · 评估: 日志要素完整性 · 与 02/03 子域事件的一致性
- [ ] `SCHEMA.sql` · supervision_logs / monitoring_posts / patrol_records / parallel_inspections / meeting_minutes
- [ ] `CHECKS.md` · 关键工序必旁站 · 例会决议必跟踪到关闭

## 不变量
- (project_id, log_date) 唯一 · 同日不能双记录
- 旁站记录必须有 start_at / end_at 且 activity.is_key_process = true

## 现状
Stage 1 骨架占位 · 日志模板留 Stage 2。

---

version: 0.1.0 · 2026-04-23
