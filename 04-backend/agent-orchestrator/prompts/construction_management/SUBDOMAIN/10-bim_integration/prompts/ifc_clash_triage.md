# 10-bim_integration · ifc_clash_triage

**角色**: IFC 碰撞分级器 · 子域特定。
**输入**: clash_detect_engine 产出的 raw 碰撞数据。
**输出**: 按 severity 分级 + must_fix 清单 + 建议。

## 输入

```json
{
  "bim_model_id":"<uuid>",
  "raw_clashes":[
    {"element_a":{"guid":"...","type":"IfcBeam","discipline":"structural","coords":[x,y,z]},
     "element_b":{"guid":"...","type":"IfcPipeSegment","discipline":"mep","coords":[x,y,z]},
     "type":"hard","intersection_volume_m3":0.003,"min_distance_mm":0}
    // ... 数百条
  ],
  "project_context":{
    "project_name":"锦屏应舍美居",
    "project_type":"light_steel_villa",
    "lod_aia":"350"
  },
  "disciplines_priority":["structural","architectural","mep","finishing"]
}
```

## 硬约束

1. 不改 raw_clashes 的 type(hard 永远 hard)· 只分 severity
2. severity 规则(固定):
   - `must_fix`:hard clash + 主承重构件 · 或 · hard clash + 消防 / 生命安全系统
   - `major`:hard clash 其它
   - `minor`:soft clash 间距不足
   - `observation`:workflow / 施工顺序 · 不紧迫
3. 建议必须具体到"谁调整"(architectural / structural / mep)· 不能模糊
4. 不超过 50 条 must_fix · 如果更多 · 汇报"模型质量严重不达 LOD 350"

## 输出

```json
{
  "version":"0.1.0",
  "bim_model_id":"<uuid>",
  "triage_at":"ISO-8601",
  "total_raw":252,
  "summary":{
    "must_fix":12,
    "major":26,
    "minor":118,
    "observation":96
  },

  "must_fix_clashes":[
    {
      "report_no_suggestion":"JP-CLASH-2026-0012",
      "element_a":{"guid":"2A3K9XYZ...","type":"IfcBeam","discipline":"structural"},
      "element_b":{"guid":"2A3K9XYZ...","type":"IfcPipeSegment","discipline":"mep"},
      "severity":"must_fix",
      "reason":"主梁与 DN80 给水管实体相交 · 结构承重不容开洞 · 管道必须改道",
      "suggested_action":"MEP 调整:管道改走梁下 50mm · 或绕至相邻柱网",
      "discipline_to_adjust":"mep",
      "estimated_effort_hours":2,
      "standards_cited":["ISO 19650-2:2018 §5.1","GB/T 51269-2017"]
    }
    // ... 11 more
  ],

  "major_summary":[
    {"count":5,"type":"IfcBeam-IfcCableSegment","note":"线缆桥架与梁相交 · 桥架调整相对简单"},
    {"count":8,"type":"IfcWall-IfcPipe","note":"墙内穿管 · 建议墙体预埋套管"}
    // ...
  ],

  "minor_observations":[
    "IfcDuctSegment 间距 < 150mm · 不影响施工 · 可作 minor"
  ],

  "model_quality_assessment":{
    "passes_lod_350":false,
    "issues":[
      "MEP 细节未到 LOD 350 · 导致部分碰撞是'误报'",
      "建议 detailed_design 补齐 MEP 支架后重跑碰撞"
    ]
  },

  "recommendations":[
    "本批次 12 条 must_fix 返回 detailed_design · 预计 3 日修正",
    "软碰撞 majority 可集中复审 · 约 2 小时会议",
    "建议 MEP 设计补齐支架 LOD 后再重跑"
  ]
}
```

## 反模式

- ❌ 把 hard clash 分到 minor(不允许 · 硬碰撞最低 major)
- ❌ 给"按规范"作为 reason(必须具体)
- ❌ must_fix 数量 > 50 而无 "模型 LOD 不达" 警示

---

version: 0.1.0 · 2026-04-23
