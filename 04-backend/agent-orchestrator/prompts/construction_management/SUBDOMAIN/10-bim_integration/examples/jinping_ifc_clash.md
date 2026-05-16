# Example · 锦屏 · IFC 碰撞分级与修正

---

## 1. 5/5 · 施工方提交 IFC

- 文件 · JP-BIM-v1.ifc · 85.4MB · IFC4.3
- LOD 声明 · AIA 350 / GB P4
- 1842 elements · 3 storey
- SHA256:ab12cd34...

前端 `<BIMViewer />` 可直接打开。

## 2. 5/5 14:00 · 碰撞扫描

前端触发 `/v1/csr/bim/clash-detect`:
- Rust clash_detect_engine(几何相交算法)
- 3 分钟完成 · 检测到 252 raw clashes
- 结果入 `clash_reports`(暂 unclassified)

## 3. 5/5 14:05 · LLM triage

planner → ifc_clash_triage:

```json
{
  "total_raw": 252,
  "summary": {"must_fix":12,"major":26,"minor":118,"observation":96}
}
```

### 12 条 must_fix

摘 3 条:
1. 二层 B×5 主梁 × 给水管 DN80 · 实体相交 · → MEP 改道
2. 三层楼板 × 风管 DN500 · 实体相交 · → 楼板预留洞(需结构校核)
3. 消防喷淋管 × 天花石膏板 · 间距 0mm · → 喷淋头下移 30mm

### model_quality_assessment

- passes_lod_350:**false**(实际 300~350 之间)
- 主要问题:MEP 支架未建模 · 导致部分误报

### recommendations

- 12 条 must_fix 返回 detailed_design 修正(3 日内)
- MEP 设计补 LOD 350(支架 + 吊杆)
- 软碰撞集中会议复审

## 4. 5/5 14:30 · evaluator

```json
{"evaluator_verdict":"pass","overall_score":0.93}
```

- standards_19650 ✓
- triage_has_reason ✓
- guid_format ✓

## 5. 5/6 - 5/7 · 修正

detailed_design 修正:
- 5/6 · MEP 改道 8 条
- 5/7 · 结构校核 2 处梁开洞 · 设计更改签 RFC
- 5/7 · MEP 支架补建到 LOD 350

## 6. 5/7 15:00 · 新模型 v2

上传 JP-BIM-v2.ifc · 再次 clash detect:
- raw clashes · 从 252 降到 85
- must_fix · 0
- major · 5
- minor · 38
- observation · 42

v2 model.status → 'active'(v1 自动 superseded)。

## 7. 5/7 16:00 · 可进入施工

- hard clash 全部 resolved · 未阻施工的 activity
- 4D 链接 · 5 分钟自动生成 1080 条
- 5D 链接 · 同步生成 720 条

施工 5/8 正式开始 · 塔吊站位 + 场地布置 按 v2 模型执行。

## 8. 竣工 · as-built

6/14 竣工后 · 产出 JP-BIM-v-asbuilt.ifc:
- 包含所有施工期变更(CSR.engineering_changes · 6 条)
- IFC Property 回写:每构件含 ArchIToken Psets
- 移交 digital_twin 用

## 9. 价值

- 传统人工碰撞复查 · 1842 构件 ≈ 2-3 天
- LLM triage + Rust 引擎 · 12 分钟搞定分级
- must_fix 聚焦 · 设计 / 施工 协作效率提升 5x
- 模型 LOD 评估客观 · 避免"声称 LOD 350 实则 200"的盲信

---

version: 0.1.0 · 2026-04-23
