# 10-bim_integration · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/bim/models` | 上传 IFC 模型 · 建 bim_model |
| POST | `/v1/csr/bim/models/{id}/activate` | 激活(其它同项目模型 superseded) |
| POST | `/v1/csr/bim/clash-detect` | 触发碰撞扫描(返回 task_id) |
| POST | `/v1/csr/bim/clash-triage` | LLM 分级(子域特定) |
| POST | `/v1/csr/bim/clash-reports/{id}/resolve` | 标记解决 |
| POST | `/v1/csr/bim/wbs-links/batch` | 4D 链接批量 |
| POST | `/v1/csr/bim/boq-links/batch` | 5D 链接 |
| GET | `/v1/csr/bim/element/{guid}` | 元素全景(所有跨模块关联) |
| GET | `/v1/csr/bim/models/{id}/viewer-package` | 前端加载包(glTF 分块) |

## 2. Schemas

```yaml
components:
  schemas:
    csr_BimModel:
      type: object
      required: [project_id, model_no, version_no, ifc_version, ifc_uri, ifc_sha256]
      properties:
        id: { type: string, format: uuid }
        model_no: { type: string }
        version_no: { type: integer }
        origin: { type: string, enum: [detailed_design, contractor, as_built, clash_fix] }
        ifc_version: { type: string, enum: [IFC2X3, IFC4, IFC4.1, IFC4.3, IFCX] }
        ifc_uri: { type: string, format: uri }
        ifc_sha256: { type: string, pattern: '^[0-9a-f]{64}$' }
        lod_aia: { type: string, enum: ['100','200','300','350','400','500'] }
        lod_gb: { type: string, enum: [P1, P2, P3, P4] }
        cde_state: { type: string, enum: [WIP, Shared, Published, Archive] }
        status: { type: string, enum: [draft, active, superseded, archived] }

    csr_ClashReport:
      type: object
      required: [project_id, bim_model_id, report_no, clash_type, element_a_guid, element_b_guid]
      properties:
        id: { type: string, format: uuid }
        report_no: { type: string }
        clash_type: { type: string, enum: [hard, soft, clearance, workflow] }
        element_a_guid: { type: string, pattern: '^[0-9A-Za-z_$]{22}$' }
        element_b_guid: { type: string, pattern: '^[0-9A-Za-z_$]{22}$' }
        element_a_type: { type: string }
        element_b_type: { type: string }
        intersection_volume_m3: { type: number }
        severity: { type: string, enum: [must_fix, major, minor, observation] }
        status: { type: string, enum: [open, acknowledged, fixing, resolved, accepted_as_is, duplicate] }

    csr_BimToWbsLink:
      type: object
      required: [project_id, bim_model_id, bim_element_guid, activity_id]
      properties:
        bim_element_guid: { type: string }
        activity_id: { type: string, format: uuid }
        link_type: { type: string, enum: [installation, demolition, rework, inspection] }
        weight: { type: number }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_BIM_IFC_HASH_MISMATCH` |
| 400 | `CSR_BIM_GUID_INVALID` · GUID 正则不符 |
| 409 | `CSR_BIM_ACTIVE_EXISTS` · 激活时已有另一 active |
| 409 | `CSR_BIM_HARD_CLASH_UNRESOLVED` · 激活时仍有 open hard clash |

---

version: 0.1.0 · 2026-04-23
