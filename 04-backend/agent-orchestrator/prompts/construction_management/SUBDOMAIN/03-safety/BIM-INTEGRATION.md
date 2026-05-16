# 03-safety · BIM-INTEGRATION

---

## 1. 核心:危险源 3D 定位

`safety_hazard.bim_element_guids TEXT[]` + `gps` · 双通道定位。

前端 `<HazardMap />` 效果:
- 3D 模型上显示所有 open 的 hazard · 按 severity 色码
- LEC ≥ 70 的标红
- 点击跳详情

## 2. 危大工程识别辅助

HIRA 生成器 (`hira_generator.md`) 可从 BIM 模型抽取:
- 层高 (IfcBuildingStorey.Elevation) → 高处作业范围
- 基坑深度 (IfcSlab 负标高) → 深基坑识别
- 模板支撑高度 → 高大模板识别
- 悬挑构件(IfcBeam 附 IfcCurtainWall)→ 外立面作业

## 3. 作业许可 3D 区域

`work_permit.bim_element_guids` · 吊装 / 动火的作业区域可以在 BIM 上高亮。
避免两个许可区域冲突(e.g. 吊装区 AND 动火区交叉)· 前端冲突检查。

## 4. 进场前检查(Stage 3+)

机械进场(塔吊 / 施工升降机) · 通过 BIM 预模拟:
- 塔吊大臂回转范围不得超出红线
- 升降机附墙节点与结构梁不碰撞

## 5. PPE 色码规范

| PPE | IFC 附属 | UI 标识 |
|---|---|---|
| 安全帽 · 红 | 管理员 | 🔴 |
| 安全帽 · 黄 | 作业员 | 🟡 |
| 安全帽 · 蓝 | 技术 | 🔵 |
| 安全帽 · 白 | 监理 / 业主 | ⚪ |

## 6. 参考

- ISO 45001:2018 §8.1.2 对 operational planning 要求可视化识别危险源
- 住建部 37 号令未强制 3D · 但行业最佳实践已广泛使用

---

version: 0.1.0 · 2026-04-23
