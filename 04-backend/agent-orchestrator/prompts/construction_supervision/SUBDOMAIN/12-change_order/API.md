# 12-change_order · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/change-order/engineering-changes` | RFC 提交 |
| POST | `/v1/csr/change-order/engineering-changes/{id}/review` | 监理审查 |
| POST | `/v1/csr/change-order/engineering-changes/{id}/approve` | 业主批准 |
| POST | `/v1/csr/change-order/site-consultations` | 洽商 |
| POST | `/v1/csr/change-order/claims` | 索赔 |
| POST | `/v1/csr/change-order/claims/{id}/supervisor-recommend` | 监理裁定建议 |
| POST | `/v1/csr/change-order/claims/{id}/owner-decide` | 业主决定 |
| POST | `/v1/csr/change-order/certifications` | 签证 |
| POST | `/v1/csr/change-order/impact-analysis` | 影响分析 LLM |

## 2. Schemas (精选)

```yaml
components:
  schemas:
    csr_EngineeringChange:
      type: object
      required: [project_id, rfc_no, title, initiator, initiator_user_id, reason_category, description]
      properties:
        id: { type: string, format: uuid }
        rfc_no: { type: string }
        initiator: { type: string, enum: [owner, contractor, supervisor, designer, regulator] }
        reason_category:
          type: string
          enum: [design_error, design_improvement, site_condition, owner_request, regulatory, force_majeure, cost_optimization, other]
        description: { type: string }
        impact_cost_cny: { type: number }
        impact_schedule_days: { type: number }
        status: { type: string, enum: [draft, reviewing, approved, rejected, executed, closed, cancelled] }

    csr_Claim:
      type: object
      required: [project_id, claim_no, claimant, claim_type, incident_at, notice_given_at, basis_description]
      properties:
        id: { type: string, format: uuid }
        claimant: { type: string, enum: [owner, contractor] }
        claim_type: { type: string, enum: [cost, time_extension, both, delay_damages, defect_damages] }
        incident_at: { type: string, format: date-time }
        notice_given_at: { type: string, format: date-time }
        submitted_at: { type: string, format: date-time, nullable: true }
        amount_claimed_cny: { type: number, nullable: true }
        days_claimed: { type: number, nullable: true }
        within_notice_period: { type: boolean, readOnly: true }
        status: { type: string, enum: [notified, submitted, under_review, partial_granted, granted, rejected, settled] }

    csr_Certification:
      type: object
      required: [project_id, cert_no, cert_type, issued_at, scope, description]
      properties:
        id: { type: string, format: uuid }
        cert_no: { type: string }
        cert_type:
          type: string
          enum: [quantity_adjustment, additional_work, material_change, time_extension, rate_adjustment, force_majeure_waiver, other]
        amount_cny: { type: number }
        days: { type: number }
        status: { type: string, enum: [draft, pending, signed, paid, contested] }

    csr_ChangeImpactAssessment:
      type: object
      properties:
        cost_impact_cny: { type: number }
        schedule_impact_days: { type: number }
        quality_impact: { type: string, enum: [none, minor, moderate, major] }
        safety_impact: { type: string, enum: [none, minor, moderate, major] }
        cascading_effects: { type: array }
        confidence: { type: number }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_CO_RFC_OWNER_NOT_SIGNED` · approve 时业主未签 |
| 400 | `CSR_CO_CLAIM_LATE` · 索赔超 28 天(仍入但警告) |
| 400 | `CSR_CO_CRT_THREE_SIGS_MISSING` · 大额签证未三方签 |
| 409 | `CSR_CO_RFC_ACTIVE_EXECUTING` · 未 closed 前不可再改 |

---

version: 0.1.0 · 2026-04-23
