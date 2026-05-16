# 04-daily_log · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/daily-log/patrols` | 巡视记录 |
| POST | `/v1/csr/daily-log/monitoring-posts` | 旁站(start → end 两次调用) |
| PATCH | `/v1/csr/daily-log/monitoring-posts/{id}/end` | 结束旁站 |
| POST | `/v1/csr/daily-log/parallel-inspections` | 平行检验 |
| POST | `/v1/csr/daily-log/meetings` | 例会纪要 |
| POST | `/v1/csr/daily-log/daily-summary` | 触发日志汇总 LLM |
| GET | `/v1/csr/daily-log/supervision-logs/{project_id}` | 查日志列表 |
| GET | `/v1/csr/daily-log/supervision-logs/{project_id}/{date}` | 查某日日志 |
| POST | `/v1/csr/daily-log/supervision-logs/{id}/sign` | 签认 |
| POST | `/v1/csr/daily-log/monthly-report/{project_id}/{yyyymm}` | 触发月报生成 |

## 2. Schemas

```yaml
components:
  schemas:
    csr_SupervisionLog:
      type: object
      required: [project_id, log_date, body]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        log_date:   { type: string, format: date }
        weather: { type: object }
        body: { type: string }
        summary_auto: { type: string, nullable: true }
        patrol_count: { type: integer }
        monitoring_post_count: { type: integer }
        parallel_inspection_count: { type: integer }
        key_events:
          type: array
          items:
            type: object
            properties:
              time:      { type: string }
              subdomain: { type: string }
              event:     { type: string }
              ref_id:    { type: string, format: uuid, nullable: true }
        rectification_issued: { type: integer }
        rectification_closed: { type: integer }
        signed_by: { type: string, format: uuid, nullable: true }
        signed_at: { type: string, format: date-time, nullable: true }

    csr_MonitoringPost:
      type: object
      required: [project_id, activity_id, supervisor_id, start_at, location_desc, content]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        activity_id: { type: string, format: uuid }
        start_at: { type: string, format: date-time }
        end_at: { type: string, format: date-time, nullable: true }
        supervisor_id: { type: string, format: uuid }
        location_desc: { type: string }
        bim_element_guids: { type: array, items: { type: string } }
        content: { type: string }
        findings: { type: string, nullable: true }
        actions_taken: { type: string, nullable: true }
        related_defect_ids: { type: array, items: { type: string, format: uuid } }
        related_rectification_ids: { type: array, items: { type: string, format: uuid } }

    csr_PatrolRecord:
      type: object
      required: [project_id, supervisor_id, start_at]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        supervisor_id: { type: string, format: uuid }
        start_at: { type: string, format: date-time }
        end_at: { type: string, format: date-time, nullable: true }
        route: { type: array }
        focus_items: { type: array, items: { type: string } }
        findings_summary: { type: string, nullable: true }
        photo_evidence_ids: { type: array, items: { type: string, format: uuid } }

    csr_MeetingMinutes:
      type: object
      required: [project_id, meeting_type, held_at, chair_unit]
      properties:
        id: { type: string, format: uuid }
        meeting_type:
          type: string
          enum: [first_meeting, regular_weekly, monthly, topic, change_review, safety_review]
        held_at: { type: string, format: date-time }
        duration_min: { type: integer }
        chair_unit: { type: string }
        venue: { type: string }
        attendees: { type: array }
        absentees: { type: array }
        agenda: { type: array }
        decisions: { type: array }
        action_items: { type: array }
        transcript_md: { type: string, nullable: true }
        status: { type: string, enum: [draft, circulated, approved, archived] }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_LOG_DUPLICATE_DATE` · 同日已有日志(用 PUT) |
| 400 | `CSR_LOG_PATROL_NO_EVIDENCE` · 巡视无 GPS 轨迹且照片 < 2 张 |
| 403 | `CSR_LOG_NO_SIGN_AUTH` · 非总监不可签认 |
| 422 | `CSR_LOG_MONITORING_NOT_KEY_PROCESS` · 旁站关联工序非 key_process |

---

version: 0.1.0 · 2026-04-23
