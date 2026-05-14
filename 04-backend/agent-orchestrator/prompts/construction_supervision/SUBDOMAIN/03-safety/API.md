# 03-safety · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/safety/plans` | HSE 计划 |
| POST | `/v1/csr/safety/hira/generate` | LLM 生成 HIRA |
| POST | `/v1/csr/safety/hazards` | 登记隐患 |
| POST | `/v1/csr/safety/hazards/{id}/close` | 闭环隐患 |
| GET | `/v1/csr/safety/hazards/{project_id}?severity=...&status=...` | 查询 |
| POST | `/v1/csr/safety/work-permits` | 申请作业许可 |
| POST | `/v1/csr/safety/work-permits/{id}/approve-supervisor` | supervisor 签 |
| POST | `/v1/csr/safety/work-permits/{id}/approve-safety` | safety officer 签 |
| POST | `/v1/csr/safety/work-permits/{id}/start` | 实际开工 |
| POST | `/v1/csr/safety/work-permits/{id}/close` | 结束关闭 |
| POST | `/v1/csr/safety/toolbox-talks` | 班前会记录 |
| POST | `/v1/csr/safety/incidents` | 事故上报 |

## 2. Schemas (核心)

```yaml
components:
  schemas:
    csr_SafetyHazard:
      type: object
      required: [project_id, category, severity, description]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        source: { type: string, enum: [patrol, inspection, hira_ai, whistleblower, contractor_self] }
        category:
          type: string
          enum: [fall_protection, electrical, lifting, scaffolding, formwork,
                 excavation, confined_space, hot_work, ppe, housekeeping, fire,
                 machinery, chemical, other]
        severity: { type: string, enum: [minor, major, critical] }
        likelihood: { type: integer, minimum: 1, maximum: 10 }
        exposure: { type: integer, minimum: 1, maximum: 10 }
        consequence: { type: integer, minimum: 1, maximum: 100 }
        lec_score: { type: number, readOnly: true }
        location_desc: { type: string }
        gps:
          type: object
          properties: { lat: { type: number }, lon: { type: number } }
        bim_element_guids: { type: array, items: { type: string } }
        description: { type: string }
        immediate_action: { type: string }
        status: { type: string, enum: [open, rectifying, verifying, closed, dismissed] }

    csr_WorkPermit:
      type: object
      required: [project_id, permit_no, permit_type, scope_desc, location_desc, start_at, end_at]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        activity_id: { type: string, format: uuid, nullable: true }
        permit_no: { type: string }
        permit_type: { type: string, enum: [hot_work, height, confined_space, lifting, excavation, electrical_switch] }
        hot_work_level: { type: string, enum: [level_1, level_2, level_3], nullable: true }
        scope_desc: { type: string }
        location_desc: { type: string }
        bim_element_guids: { type: array, items: { type: string } }
        start_at: { type: string, format: date-time }
        end_at:   { type: string, format: date-time }
        risk_controls: { type: array, items: { type: object } }
        ppe_required: { type: array, items: { type: string } }
        status: { type: string, enum: [requested, approved, active, closed, expired, revoked] }

    csr_IncidentReport:
      type: object
      required: [project_id, incident_at, type, severity_grade, description, immediate_action]
      properties:
        id: { type: string, format: uuid }
        incident_at: { type: string, format: date-time }
        reported_at: { type: string, format: date-time, readOnly: true }
        late_reported: { type: boolean, readOnly: true }
        type: { type: string, enum: [incident, near_miss, occupational_illness, property_damage] }
        severity_grade: { type: string, enum: [minor_injury, serious_injury, fatal, mass_injury, property_only] }
        location_desc: { type: string }
        involved_workers: { type: array, items: { type: object } }
        initial_cause: { type: string }
        description: { type: string }
        immediate_action: { type: string }
        external_reported: { type: array, items: { type: string } }
        investigation_status: { type: string, enum: [pending, investigating, closed, referred_to_authority] }
```

## 3. 核心 path · HIRA 生成

```yaml
paths:
  /v1/csr/safety/hira/generate:
    post:
      tags: [csr-safety]
      summary: LLM 生成 HIRA 登记册(基于 BIM + 项目类型 + 适用标准)
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [project_id]
              properties:
                project_id: { type: string, format: uuid }
                scope:
                  type: string
                  enum: [whole_project, module, specific_activity]
                module_code:   { type: string, nullable: true }
                activity_id:  { type: string, format: uuid, nullable: true }
      responses:
        '202':
          description: 异步作业已派发 · SSE 订阅
          content:
            application/json:
              schema:
                type: object
                properties:
                  task_id:    { type: string }
                  stream_url: { type: string, format: uri }
```

## 4. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_SAFETY_WP_DUAL_SIGN_MISSING` · 许可审批缺一签 |
| 400 | `CSR_SAFETY_WP_PERIOD_INVALID` · 作业时间跨度异常 |
| 400 | `CSR_SAFETY_INCIDENT_LATE` · 事故延报警告(仍入库 · 标 late) |
| 409 | `CSR_SAFETY_WP_OVERLAP` · 两个许可区域 · 时间冲突 |
| 422 | `CSR_SAFETY_HAZARD_LEC_INVALID` · L/E/C 超出范围 |

## 5. 限流

| endpoint | tenant 限流 |
|---|---|
| POST hazards | 120/min |
| POST hira/generate | 5/min (LLM 贵) |
| POST incidents | 60/min (紧急场景允许高频) |

---

version: 0.1.0 · 2026-04-23
