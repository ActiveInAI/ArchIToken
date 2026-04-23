# 07-inspection_lot · API

---

## 1. 路径

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/inspection-lot/sub-parts` | 创建分部 |
| POST | `/v1/csr/inspection-lot/sub-items` | 创建分项 |
| POST | `/v1/csr/inspection-lot/lots` | 创建检验批 |
| POST | `/v1/csr/inspection-lot/lots/{id}/evaluate` | 提交评定(主控 / 一般) |
| POST | `/v1/csr/inspection-lot/lots/{id}/supervisor-review` | 监理复核 |
| GET | `/v1/csr/inspection-lot/tree/{project_id}` | 四级验收树 |
| POST | `/v1/csr/inspection-lot/lot-boundary-advisor` | LLM 批划分建议 |
| POST | `/v1/csr/inspection-lot/rollup/{sub_item_id}` | 向上聚合(同 trigger) |

## 2. Schemas

```yaml
components:
  schemas:
    csr_SubPart:
      type: object
      required: [project_id, unit_project_id, code, name, level, standard_code]
      properties:
        id: { type: string, format: uuid }
        code: { type: string }
        name: { type: string }
        level: { type: integer, enum: [1, 2] }
        standard_code: { type: string }
        verdict: { type: string, enum: [pending, pass, fail, accepted] }

    csr_SubItem:
      type: object
      required: [project_id, sub_part_id, code, name]
      properties:
        id: { type: string, format: uuid }
        sub_part_id: { type: string, format: uuid }
        code: { type: string }
        name: { type: string }
        standard_clause: { type: array }
        verdict: { type: string, enum: [pending, pass, fail, accepted] }

    csr_InspectionLot:
      type: object
      required: [project_id, sub_item_id, lot_no, batch_description]
      properties:
        id: { type: string, format: uuid }
        lot_no: { type: string }
        batch_description: { type: string }
        bim_element_guids: { type: array, items: { type: string } }
        activity_ids: { type: array, items: { type: string, format: uuid } }
        main_items:
          type: array
          items:
            type: object
            required: [name, standard, clause, verdict]
            properties:
              name: { type: string }
              standard: { type: string }
              clause: { type: string }
              verdict: { type: string, enum: [pass, fail, pending] }
              evidence_ids: { type: array, items: { type: string, format: uuid } }
        general_items:
          type: array
          items:
            type: object
            required: [name, sample_size, pass_count]
            properties:
              name: { type: string }
              sample_size: { type: integer }
              pass_count: { type: integer }
              spec: { type: string }
              pass_rate: { type: number, readOnly: true }
        verdict: { type: string, enum: [pending, pass, fail, accepted] }
        main_total: { type: integer, readOnly: true }
        main_pass: { type: integer, readOnly: true }
        general_pass_rate: { type: number, readOnly: true }
```

## 3. 核心 path

```yaml
paths:
  /v1/csr/inspection-lot/lots/{id}/evaluate:
    post:
      tags: [csr-inspection-lot]
      summary: 提交检验批评定 · 触发 verdict 自动计算
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [main_items, general_items]
              properties:
                main_items:
                  type: array
                  minItems: 1
                  items: { $ref: '#/components/schemas/csr_InspectionLot/properties/main_items/items' }
                general_items:
                  type: array
                  items: { $ref: '#/components/schemas/csr_InspectionLot/properties/general_items/items' }
      responses:
        '200':
          description: 评定完成 · verdict 返回
          content:
            application/json:
              schema:
                type: object
                properties:
                  verdict: { type: string }
                  main_pass: { type: integer }
                  main_total: { type: integer }
                  general_pass_rate: { type: number }

  /v1/csr/inspection-lot/lot-boundary-advisor:
    post:
      tags: [csr-inspection-lot]
      summary: LLM 建议检验批划分(按规范 + 施工段 + BIM)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [sub_item_id]
              properties:
                sub_item_id: { type: string, format: uuid }
                preferred_granularity: { type: string, enum: [coarse, medium, fine] }
      responses:
        '200':
          description: 建议划分
          content:
            application/json:
              schema:
                type: object
                properties:
                  suggested_lots:
                    type: array
                    items:
                      type: object
                      properties:
                        lot_no: { type: string }
                        batch_description: { type: string }
                        bim_element_guids: { type: array, items: { type: string } }
                        main_items_template: { type: array }
                        general_items_template: { type: array }
```

## 4. 错误码

| HTTP | code |
|---|---|
| 400 | `CSR_LOT_MAIN_MISSING` · 主控项目为空 |
| 400 | `CSR_LOT_EVIDENCE_MISSING` · evidence_ids 为空但 verdict=pass |
| 409 | `CSR_LOT_ALREADY_ACCEPTED` · 已 accepted · 不能重评 |
| 422 | `CSR_LOT_STANDARD_NOT_FOUND` · 引用标号不存在 |

---

version: 0.1.0 · 2026-04-23
