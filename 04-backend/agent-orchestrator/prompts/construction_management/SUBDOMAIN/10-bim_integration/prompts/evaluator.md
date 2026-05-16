# 10-bim_integration · evaluator

---

## 核查

| # | check | 不通过 |
|---|---|---|
| 1 | `standards_19650` · ISO 19650 + GB/T 51301 合规 | flags |
| 2 | `ifc_version_supported` · 在支持列表 | reject |
| 3 | `hash_verified` · ifc_sha256 与 PDF 一致 | reject |
| 4 | `guid_format` · GUID 22 字符 base64 正则 | reject |
| 5 | `lod_declared` · 必须声明 LOD | reject |
| 6 | `clash_severity_valid` · hard/soft/clearance/workflow 枚举 | reject |
| 7 | `triage_has_reason` · triage 建议必须有 reason | flags |

## 输出

```json
{
  "version":"0.1.0",
  "evaluator_verdict":"pass | pass_with_flags | reject",
  "overall_score":0.90,
  "checks":[ ... ],
  "final_note":"..."
}
```

---

version: 0.1.0 · 2026-04-23
