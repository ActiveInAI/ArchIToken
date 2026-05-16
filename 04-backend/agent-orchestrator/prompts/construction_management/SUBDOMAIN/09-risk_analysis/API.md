# 09-risk_analysis · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/risk-analysis/entries` | 登记风险 |
| GET | `/v1/csr/risk-analysis/entries/{project_id}?severity=...&status=...` | 查询 |
| POST | `/v1/csr/risk-analysis/monte-carlo` | 蒙特卡洛进度模拟 |
| POST | `/v1/csr/risk-analysis/monitoring-points` | 监测点位 |
| POST | `/v1/csr/risk-analysis/monitoring-points/{id}/data` | IoT 推数据(或走 MQTT) |
| POST | `/v1/csr/risk-analysis/emergency-plans` | 应急预案 |
| POST | `/v1/csr/risk-analysis/emergency-plans/{id}/trigger` | 手动触发预案 |
| POST | `/v1/csr/risk-analysis/drills` | 演练记录 |

## 2. Schemas (核心)

```yaml
components:
  schemas:
    csr_RiskEntry:
      type: object
      required: [project_id, risk_no, title, category, description, likelihood, exposure, consequence, treatment_strategy, owner_id]
      properties:
        id: { type: string, format: uuid }
        risk_no: { type: string }
        title: { type: string }
        category:
          type: string
          enum: [weather, geological, mechanical, electrical, fire, hazmat, schedule, cost, quality, regulatory, health, fraud, supplier, political, force_majeure, other]
        description: { type: string }
        likelihood: { type: integer, minimum: 1, maximum: 10 }
        exposure: { type: integer, minimum: 1, maximum: 10 }
        consequence: { type: integer, minimum: 1, maximum: 100 }
        lec_score: { type: number, readOnly: true }
        severity: { type: string, enum: [negligible, minor, major, critical], readOnly: true }
        treatment_strategy: { type: string, enum: [avoid, mitigate, transfer, accept] }
        controls: { type: array }
        status: { type: string, enum: [open, mitigating, monitored, closed, realized] }

    csr_MonitoringPoint:
      type: object
      required: [project_id, point_no, name, category, data_source, threshold_json]
      properties:
        id: { type: string, format: uuid }
        point_no: { type: string }
        category: { type: string, enum: [weather, strain, tilt, displacement, gas, water_level, vibration, temperature, crowd, iot_custom] }
        iot_topic: { type: string, nullable: true }
        threshold_json:
          type: object
          required: [warning, alarm]
          properties:
            warning: { type: object, properties: { value: { type: number }, unit: { type: string } } }
            alarm:   { type: object, properties: { value: { type: number }, unit: { type: string } } }
        status: { type: string, enum: [active, paused, faulty, retired] }

    csr_EmergencyPlan:
      type: object
      required: [project_id, plan_no, title, scenario, scope, trigger_conditions, procedures, emergency_contacts]
      properties:
        id: { type: string, format: uuid }
        plan_no: { type: string }
        scenario: { type: string }
        trigger_conditions: { type: array }
        procedures: { type: array }
        emergency_contacts: { type: array }
        last_drill_at: { type: string, format: date-time, nullable: true }
        next_drill_due: { type: string, format: date, readOnly: true }
        status: { type: string, enum: [draft, approved, active, archived] }

    csr_MonteCarloResult:
      type: object
      properties:
        iterations: { type: integer }
        duration_days:
          type: object
          properties:
            p10: { type: number }
            p50: { type: number }
            p90: { type: number }
            mean: { type: number }
            stdev: { type: number }
        cost_cny:
          type: object
          properties:
            p10: { type: number }
            p50: { type: number }
            p90: { type: number }
        top_drivers:
          type: array
          items:
            type: object
            properties:
              risk_id: { type: string, format: uuid }
              sensitivity: { type: number }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_RISK_CRITICAL_NO_MONITORING` · critical 风险未挂监测点 |
| 400 | `CSR_RISK_CRITICAL_NO_PLAN` · critical 风险未挂预案 |
| 422 | `CSR_RISK_LEC_RANGE` · L/E/C 超范围 |

---

version: 0.1.0 · 2026-04-23
