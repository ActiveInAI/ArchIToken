# 05-method_statement · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/method-statement/ms` | 提交方案(v1 或后续 vN) |
| POST | `/v1/csr/method-statement/ms/{id}/review-start` | 监理开始审查 |
| POST | `/v1/csr/method-statement/ms/{id}/review-comment` | 追加审查意见 |
| POST | `/v1/csr/method-statement/ms/{id}/review-decide` | 审查决议 approve/reject |
| POST | `/v1/csr/method-statement/expert-review` | 建立论证会(scheduled) |
| POST | `/v1/csr/method-statement/expert-review/{id}/hold` | 开始论证 |
| POST | `/v1/csr/method-statement/expert-review/{id}/finalize` | 论证结论 |
| POST | `/v1/csr/method-statement/briefings` | 提交交底记录(level = company/project/crew) |
| POST | `/v1/csr/method-statement/expert-review/facilitate` | LLM 辅助论证协调(子域特定) |

## 2. Schemas

```yaml
components:
  schemas:
    csr_MethodStatement:
      type: object
      required: [project_id, ms_no, title, scope, hazard_category, pdf_uri, pdf_sha256, authored_by_unit]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        ms_no: { type: string }
        title: { type: string }
        version_no: { type: integer }
        scope: { type: string }
        scope_activity_ids: { type: array, items: { type: string, format: uuid } }
        hazard_category:
          type: string
          enum: [deep_excavation, high_formwork, lifting, scaffolding, dismantling,
                 tunneling, underwater, open_caisson, temporary_structure, pipe_jacking, other]
        is_super_scale: { type: boolean }
        pdf_uri: { type: string, format: uri }
        pdf_sha256: { type: string, pattern: '^[0-9a-f]{64}$' }
        authored_by_unit: { type: string }
        review_status: { type: string, enum: [pending, in_review, rejected, approved, superseded] }
        review_comments: { type: array }
        expert_review_id: { type: string, format: uuid, nullable: true }

    csr_TechnicalBriefing:
      type: object
      required: [project_id, level, sequence_no, held_at, giver_id, giver_unit, audience_unit, topic]
      properties:
        id: { type: string, format: uuid }
        level: { type: string, enum: [company, project, crew] }
        sequence_no: { type: integer, enum: [1, 2, 3] }
        held_at: { type: string, format: date-time }
        giver_unit: { type: string }
        audience_unit: { type: string }
        topic: { type: string }
        key_points: { type: array }
        audience: { type: array }

    csr_ExpertReview:
      type: object
      required: [project_id, review_no, ms_draft_uri, ms_draft_sha256, scheduled_at]
      properties:
        id: { type: string, format: uuid }
        review_no: { type: string }
        ms_draft_uri: { type: string, format: uri }
        ms_draft_sha256: { type: string, pattern: '^[0-9a-f]{64}$' }
        scheduled_at: { type: string, format: date-time }
        held_at: { type: string, format: date-time, nullable: true }
        venue: { type: string, nullable: true }
        meeting_mode: { type: string, enum: [onsite, video, hybrid] }
        experts:
          type: array
          minItems: 5
          items:
            type: object
            properties:
              name: { type: string }
              specialty: { type: string }
              institution: { type: string }
              id_no: { type: string }
        attendees_count: { type: integer, minimum: 5 }
        specialties_covered:
          type: array
          minItems: 3
          items: { type: string }
        verdict: { type: string, enum: [pass, pass_with_revisions, fail], nullable: true }
        verdict_comments: { type: array }
        status: { type: string, enum: [scheduled, in_progress, concluded, archived] }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_MS_SHA256_MISMATCH` · PDF hash 与声明不符 |
| 400 | `CSR_MS_SUPER_NEEDS_EXPERT` · 超规模方案未经论证即批准 |
| 400 | `CSR_MS_BRIEFING_SEQUENCE_VIOLATION` · 交底序号跨级 |
| 409 | `CSR_MS_VERSION_CONFLICT` · version_no 重复 |
| 422 | `CSR_MS_EXPERT_INSUFFICIENT` · 专家 < 5 或专业 < 3 |

---

version: 0.1.0 · 2026-04-23
