# 11-compliance · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/compliance/clauses` | 强条入库(或来自 sl.code_clauses) |
| POST | `/v1/csr/compliance/checks` | 执行合规检查(同步 / 异步) |
| GET | `/v1/csr/compliance/checks/{project_id}?verdict=non_compliant` | 查询违反 |
| POST | `/v1/csr/compliance/regulation-diff` | 法规变更差异 · LLM |
| POST | `/v1/csr/compliance/permit-approvals` | 报建记录 |
| GET | `/v1/csr/compliance/permits-expiring/{project_id}?days=30` | 即将过期 |
| POST | `/v1/csr/compliance/archive-packages` | 创建归档包 |
| POST | `/v1/csr/compliance/archive-packages/{id}/assemble` | 组装(调 digital_archive) |

## 2. Schemas

```yaml
components:
  schemas:
    csr_ComplianceCheck:
      type: object
      required: [project_id, check_no, target_type, target_id, triggered_by, verdict]
      properties:
        id: { type: string, format: uuid }
        check_no: { type: string }
        target_type:
          type: string
          enum: [inspection_lot, sub_item, sub_part, unit_project, method_statement, engineering_change, design_review, handover]
        target_id: { type: string, format: uuid }
        triggered_by: { type: string, enum: [manual, auto_on_event, scheduled, regulation_change] }
        clauses_checked:
          type: array
          items:
            type: object
            properties:
              standard: { type: string }
              clause: { type: string }
              is_mandatory: { type: boolean }
              verdict: { type: string, enum: [compliant, violated, n/a] }
        mandatory_violated: { type: integer }
        mandatory_total: { type: integer }
        verdict: { type: string, enum: [compliant, non_compliant, partial, 'n/a'] }

    csr_PermitApproval:
      type: object
      required: [project_id, permit_type, issuing_authority]
      properties:
        id: { type: string, format: uuid }
        permit_type:
          type: string
          enum: [construction_permit, quality_registration, safety_filing,
                 fire_design_review, fire_acceptance, civil_defense,
                 lightning_protection, environmental, energy]
        permit_no: { type: string, nullable: true }
        issuing_authority: { type: string }
        valid_from: { type: string, format: date }
        valid_to: { type: string, format: date, nullable: true }
        status: { type: string, enum: [applied, under_review, approved, rejected, expired, voided] }

    csr_ArchivePackage:
      type: object
      required: [project_id, package_no, package_type]
      properties:
        id: { type: string, format: uuid }
        package_no: { type: string }
        package_type: { type: string, enum: [monthly, stage, completion, post_occupancy] }
        status: { type: string, enum: [assembling, ready, archived, rejected] }
        has_monitoring_logs: { type: boolean }
        has_acceptance: { type: boolean }
        has_test_reports: { type: boolean }
        has_method_stmts: { type: boolean }
        has_change_orders: { type: boolean }
        has_permits: { type: boolean }
        has_photos: { type: boolean }
        has_bim: { type: boolean }

    csr_RegulationDiff:
      type: object
      properties:
        source_standards: { type: array, items: { type: string } }
        added_clauses: { type: array }
        changed_clauses: { type: array }
        removed_clauses: { type: array }
        retroactive_check_required: { type: boolean }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_COMP_NON_COMPLIANT_NO_DETAIL` · verdict=non_compliant 但 mandatory_violated=0 |
| 400 | `CSR_COMP_ARCHIVE_INCOMPLETE` · completion archive 缺 7 类之一 |
| 409 | `CSR_COMP_PERMIT_ACTIVE_EXISTS` · 同类型 approved permit 已存在 |

---

version: 0.1.0 · 2026-04-23
