# SUBDOMAIN · 07-inspection_lot · 检验批

## 定位
4 级验收树的底层 · 最小验收单元 · GB 50300-2013 的根基概念。
检验批 → 分项 → 分部 → 单位 · 自下而上汇总验收结论。

## 核心实体
- `inspection_lot` · 检验批 (main_items / general_items JSONB 数组 · verdict 四态)
- `sub_item` · 分项工程
- `sub_part` · 分部工程 (子分部扁平化进同表 · 用 `parent_sub_part_id` 表示)

## 主要标准
- GB 50300-2013 §4.0.5 检验批 / §5.0.4 主控项目 / §5.0.5 一般项目
- GB 50202-2018 ~ GB 50210-2018 专业验收规范系列
- GB 50204-2015 混凝土结构 · GB 50205-2020 钢结构 · GB 50411-2019 节能

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 按工程量 / 施工段 拆分检验批 · 主控 / 一般项目挑选
- [ ] `generator.md` · 生成: 检验批验收单 · 合格率计算 · 评定结论
- [ ] `evaluator.md` · 评估: 主控项目全合格 · 一般项目合格率 ≥ 80%
- [ ] `SCHEMA.sql` · inspection_lots / sub_items / sub_parts
- [ ] `CHECKS.md` · 主控 100% · 一般 ≥ 80% · 不合格必走 02-quality 整改

## 不变量
- 主控项目 `pass_required = true` · 不合格即整批不合格
- 一般项目合格率按 GB 50300-2013 §5.0.6 计算 · 默认门槛 80% (专业标准更严则从严)
- 检验批的 `verdict = pass` 才能汇入分项 · 逐级向上

## 现状
Stage 1 骨架占位 · 主控 / 一般项目映射表留 Stage 2。

---

version: 0.1.0 · 2026-04-23
