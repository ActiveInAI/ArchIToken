# 08-acceptance · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/acceptance/unit-projects` | 创建单位工程 |
| POST | `/v1/csr/acceptance/records` | 验收记录 |
| POST | `/v1/csr/acceptance/records/{id}/sign` | 某方签字(owner/contractor/supervisor/designer/geotechnical) |
| POST | `/v1/csr/acceptance/hidden-works` | 隐蔽工程记录 |
| POST | `/v1/csr/acceptance/hidden-works/{id}/bury` | 验收通过后 · 登记实际掩埋时间 |
| POST | `/v1/csr/acceptance/handover-certificates` | 竣工证书 |
| POST | `/v1/csr/acceptance/handover-certificates/{id}/file` | 备案完成标记 |
| POST | `/v1/csr/acceptance/five-parties-signoff-orchestrator` | LLM 协调(子域特定) |
| GET | `/v1/csr/acceptance/project-completion-status/{project_id}` | 竣工准备度 |

## 2. Schemas

```yaml
components:
  schemas:
    csr_UnitProject:
      type: object
      required: [project_id, code, name]
      properties:
        id: { type: string, format: uuid }
        code: { type: string }
        name: { type: string }
        gross_floor_area_sqm: { type: number }
        stories: { type: integer }
        verdict: { type: string, enum: [pending, pass, fail, accepted] }

    csr_AcceptanceRecord:
      type: object
      required: [project_id, target_type, target_id, record_no, level, acceptance_at, verdict]
      properties:
        id: { type: string, format: uuid }
        target_type:
          type: string
          enum: [inspection_lot, sub_item, sub_part, unit_project, hidden_work, special]
        target_id: { type: string, format: uuid }
        record_no: { type: string }
        level: { type: string, enum: [inspection_lot, sub_item, sub_part, unit_project, special] }
        acceptance_at: { type: string, format: date-time }
        standards_cited:
          type: array
          minItems: 1
          items:
            type: object
            properties:
              standard: { type: string }
              clause:   { type: string }
        verdict: { type: string, enum: [accepted, rejected, conditional] }
        conditional_items: { type: array }
        signed_by_owner_id: { type: string, format: uuid, nullable: true }
        signed_by_contractor_id: { type: string, format: uuid, nullable: true }
        signed_by_supervisor_id: { type: string, format: uuid, nullable: true }
        signed_by_designer_id: { type: string, format: uuid, nullable: true }
        signed_by_geotechnical_id: { type: string, format: uuid, nullable: true }

    csr_HiddenWork:
      type: object
      required: [project_id, hw_no, title, category, before_buried_at, content]
      properties:
        id: { type: string, format: uuid }
        hw_no: { type: string }
        category: { type: string, enum: [rebar, waterproof, insulation, foundation, embedded, other] }
        before_buried_at: { type: string, format: date-time }
        actual_buried_at: { type: string, format: date-time, nullable: true }
        content: { type: string }
        photo_evidence_ids:
          type: array
          minItems: 4
          items: { type: string, format: uuid }
        verdict: { type: string, enum: [pending, pass, fail] }

    csr_HandoverCertificate:
      type: object
      required: [project_id, unit_project_id, cert_no, type, final_acceptance_date,
                 supervisor_assessment_report_uri,
                 signed_by_owner_id, signed_by_contractor_id, signed_by_supervisor_id,
                 signed_by_designer_id, cert_pdf_uri, cert_pdf_sha256]
      properties:
        id: { type: string, format: uuid }
        cert_no: { type: string }
        type: { type: string, enum: [completion, handover_partial, owner_occupancy] }
        final_acceptance_date: { type: string, format: date }
        filing_deadline: { type: string, format: date }
        filing_completed_at: { type: string, format: date-time, nullable: true }
        status: { type: string, enum: [issued, filed, archived, voided] }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_AR_STANDARDS_MISSING` · accepted 但无 standards_cited |
| 400 | `CSR_HW_PHOTOS_INSUFFICIENT` · 隐蔽影像 < 4 张 |
| 400 | `CSR_UNIT_FIVE_SIGS_INCOMPLETE` · 单位工程五方未齐 |
| 409 | `CSR_HC_ALREADY_FILED` · 证书已备案 · 不可修改 |
| 422 | `CSR_FILING_OVERDUE_SOFT` · 已过 15 日 · 仍允许备案 · 但警告 |

---

version: 0.1.0 · 2026-04-23
