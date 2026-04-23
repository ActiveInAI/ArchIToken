# 06-testing · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/testing/witnesses` | 见证取样 |
| POST | `/v1/csr/testing/lab-reports` | 实验室报告录入 |
| POST | `/v1/csr/testing/lab-reports/{id}/verify-cma` | CMA 查验 |
| POST | `/v1/csr/testing/onsite-tests` | 现场检测 |
| POST | `/v1/csr/testing/sample-plan` | LLM 取样计划生成 |
| GET | `/v1/csr/testing/by-lot/{lot_id}` | 按检验批查 |
| GET | `/v1/csr/testing/by-element/{guid}` | 按 BIM 构件查 |

## 2. Schemas

```yaml
components:
  schemas:
    csr_TestWitnessing:
      type: object
      required: [project_id, witness_no, material_or_element, sampling_method, sampling_at,
                 sample_count, witness_supervisor_id, sampler_contractor_id]
      properties:
        id: { type: string, format: uuid }
        witness_no: { type: string }
        material_or_element: { type: string }
        sampling_method: { type: string }
        sampling_at: { type: string, format: date-time }
        location_desc: { type: string }
        bim_element_guids: { type: array, items: { type: string } }
        sample_count: { type: integer, minimum: 1 }
        sample_ids_json: { type: array, items: { type: string } }
        witness_supervisor_id: { type: string, format: uuid }
        sampler_contractor_id: { type: string, format: uuid }
        sealed_photo_ids: { type: array, items: { type: string, format: uuid } }

    csr_LabReport:
      type: object
      required: [project_id, report_no, test_type, lab_name, lab_cma_no,
                 tested_at, issued_at, verdict, report_uri, report_sha256]
      properties:
        id: { type: string, format: uuid }
        report_no: { type: string }
        test_type:
          type: string
          enum: [concrete_compression, rebar_pullout, steel_tensile,
                 weld_ut, weld_mt, weld_rt, weld_pt,
                 waterproof, fire_resistance, admixture, mortar, thermal_performance, other]
        lab_name: { type: string }
        lab_cma_no: { type: string }
        tested_at: { type: string, format: date }
        issued_at: { type: string, format: date }
        verdict: { type: string, enum: [pass, fail, partial, 'n/a'] }
        verdict_details: { type: object }
        standards_applied: { type: array, items: { type: string } }
        raw_measurements: { type: array }
        report_uri: { type: string, format: uri }
        report_sha256: { type: string, pattern: '^[0-9a-f]{64}$' }

    csr_OnsiteTest:
      type: object
      required: [project_id, test_no, method, tested_at, tester_id,
                 equipment_name, equipment_serial_no, equipment_calibration_valid_until,
                 sample_size, verdict]
      properties:
        id: { type: string, format: uuid }
        test_no: { type: string }
        method:
          type: string
          enum: [rebound, core, rebar_scan, cover_measure, ut, mt, rt, pt, pull_off, tap_tone, other]
        equipment_calibration_valid_until: { type: string, format: date }
        sample_size: { type: integer, minimum: 1 }
        measurements: { type: array }
        verdict: { type: string, enum: [pass, fail, partial] }
```

## 3. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_TEST_CMA_EXPIRED` · CMA 证超期 |
| 400 | `CSR_TEST_EQUIPMENT_CAL_EXPIRED` · 仪器年检过期 |
| 400 | `CSR_TEST_SHA256_MISMATCH` · 报告 hash 不符 |
| 400 | `CSR_TEST_DUAL_SIGN_MISSING` · 见证 / 取样 其一缺 |
| 422 | `CSR_TEST_UNSUPPORTED_TYPE` · test_type 枚举外 |

---

version: 0.1.0 · 2026-04-23
