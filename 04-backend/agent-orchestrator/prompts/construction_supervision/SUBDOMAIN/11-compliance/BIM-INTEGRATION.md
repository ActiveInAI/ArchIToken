# 11-compliance · BIM-INTEGRATION

---

## 1. 强条 · BIM 元素 匹配

`compliance_checks.bim_element_guids` · 记录被检查的具体构件。

用途:
- 在 BIM 上可视化"合规热图":绿(合规)· 红(违反强条)· 黄(flagged)
- 点构件看"受哪些强条约束"· 避免盲区

## 2. 规范 clause · 空间范围

某些强条有空间约束:
- 防雷强条 · 适用于屋顶构件(IfcRoof)
- 消防强条 · 楼梯 / 疏散通道 · IfcRailing / IfcStair
- 节能强条 · 围护结构 · IfcWallStandardCase · IfcWindow · IfcRoof

`sl.code_clauses.sub_part_applicable[]` + IFC 类型 · 自动匹配。

## 3. 合规热力图

`<ComplianceHeatmap />`:
- BIM 3D 每构件 · 最近 compliance_check 的状态
- 红色 · 正违反强条(必整改)
- 橙色 · partial(有 flagged general)
- 绿色 · 合规

## 4. 档案 BIM 关联

archive_package 的 has_bim · 指向 bim_model 的竣工版本。
归档时 · BIM 文件也进档(作为"工程对象档案"核心)。

## 5. IFC Property 回写

强条合规信息 · 回写 IFC:
- `IfcPset_InsomeOS_ComplianceLatest` · 最后一次 compliance_check id / verdict / date

---

version: 0.1.0 · 2026-04-23
