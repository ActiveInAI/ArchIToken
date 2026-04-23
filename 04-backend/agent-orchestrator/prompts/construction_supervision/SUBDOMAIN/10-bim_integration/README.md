# SUBDOMAIN · 10-bim_integration · BIM 集成

## 定位
施工阶段的 BIM 应用 · IFC 模型接入 · 4D (与进度) · 5D (与造价) · CDE 协同。
本模块是 BIM 模型的"使用方" · 主模型在 detailed_design · 本子域只镜像 + 过程加持。

## 核心实体
- `bim_model` · BIM 模型版本 (镜像自 detailed_design)
- `clash_report` · 碰撞检查报告
- `bim_to_wbs_link` · BIM 元素 → WBS 映射 (4D 桥梁)
- `bim_to_boq_link` · BIM 元素 → BOQ 映射 (5D 桥梁 · 与 quantity_costing 协同)

## 主要标准
- ISO 19650-1:2018 / -2:2018 / -3:2020 / -5:2020 (BIM 信息管理全套)
- GB/T 51301-2018 建筑信息模型设计交付标准
- GB/T 51269-2017 建筑信息模型分类和编码标准
- GB/T 51447-2021 建筑信息模型存储标准
- AIA LOD Specification (100 / 200 / 300 / 350 / 400 / 500)

## Stage 2 待建文件
- [ ] `planner.md` · 规划: 按 WBS 从 detailed_design 拉取需要 4D / 5D 的元素集
- [ ] `generator.md` · 生成: 4D 模拟动画描述 · 碰撞报告 · 5D 提量核对
- [ ] `evaluator.md` · 评估: LOD 是否满足施工阶段 (通常 LOD 350) · CDE 状态流转
- [ ] `SCHEMA.sql` · bim_models / clash_reports / bim_to_wbs_links / bim_to_boq_links
- [ ] `CHECKS.md` · IFC4 合法性 · 元素 GlobalId 唯一性 · LOD 阈值

## 不变量
- `bim_model.ifc_uri` · 必须是对象存储路径 (s3:// 或 supabase://)
- 碰撞报告 · 硬碰撞(实体相交)必须 rectify 后才能发布
- 4D 链接 · activity_id 必须合法 · 循环引用在写入时拒绝

## 现状
Stage 1 骨架占位 · CDE 状态机 / IFC 合规校验留 Stage 2。

---

version: 0.1.0 · 2026-04-23
