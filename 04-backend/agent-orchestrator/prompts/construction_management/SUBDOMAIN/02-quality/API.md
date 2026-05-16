# 02-quality · API

REST API 草案 · OpenAPI 3.1 片段。

---

## 1. 路径列表

| Method | Path | 说明 |
|---|---|---|
| POST | `/v1/csr/quality/plans` | 创建 / 更新质量计划 |
| POST | `/v1/csr/quality/material-receipts` | 材料进场验收 |
| GET | `/v1/csr/quality/material-receipts/{project_id}?verdict=pending` | 待验收清单 |
| POST | `/v1/csr/quality/defects` | 登记缺陷 |
| GET | `/v1/csr/quality/defects/{project_id}?status=open` | 缺陷列表 |
| POST | `/v1/csr/quality/defects/{id}/rectify` | 触发 A5 生成 |
| POST | `/v1/csr/quality/defects/{id}/close` | 整改闭环(附照片) |
| POST | `/v1/csr/quality/ncr` | NCR 升级 |
| POST | `/v1/csr/quality/ncr/{id}/approve` | 让步 / 处置审批(designer / owner) |
| POST | `/v1/csr/quality/classify` | LLM 缺陷分类器(返回 category 候选) |

## 2. Schemas

```yaml
components:
  schemas:
    csr_MaterialReceipt:
      type: object
      required: [project_id, material_code, batch_no, supplier_name, quantity, unit]
      properties:
        id:             { type: string, format: uuid }
        project_id:     { type: string, format: uuid }
        material_code:  { type: string }
        material_name:  { type: string }
        batch_no:       { type: string }
        supplier_name:  { type: string }
        received_at:    { type: string, format: date-time }
        quantity:       { type: number, minimum: 0 }
        unit:           { type: string, enum: [kg, m, m2, m3, t, pcs, set] }
        cert_no:        { type: string, nullable: true }
        cert_uri:       { type: string, format: uri, nullable: true }
        witness_required: { type: boolean }
        verdict:        { type: string, enum: [pending, pass, fail, concession, returned] }
        photo_evidence_ids: { type: array, items: { type: string, format: uuid } }

    csr_QualityDefect:
      type: object
      required: [project_id, category, severity, description]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        inspection_lot_id: { type: string, format: uuid, nullable: true }
        activity_id: { type: string, format: uuid, nullable: true }
        category:
          type: string
          enum: [material, workmanship, dimension, alignment, weld, concrete, finish, mep, other]
        severity: { type: string, enum: [minor, major, critical] }
        location_desc: { type: string, nullable: true }
        bim_element_guids:
          type: array
          items: { type: string, pattern: '^[0-9A-Za-z_$]{22}$' }
        description: { type: string }
        standards_violated:
          type: array
          items:
            type: object
            properties:
              standard: { type: string }
              clause:   { type: string }
        status: { type: string, enum: [open, rectifying, verifying, closed, dismissed] }
        photo_evidence_ids: { type: array, items: { type: string, format: uuid } }

    csr_RectificationOrder:
      type: object
      required: [project_id, form_code, serial_no, deadline, required_action]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        defect_id: { type: string, format: uuid, nullable: true }
        hazard_id: { type: string, format: uuid, nullable: true }
        form_code: { type: string, enum: [A5, B3] }
        serial_no: { type: string }
        issued_at: { type: string, format: date-time }
        issued_to_unit: { type: string }
        deadline:   { type: string, format: date-time }
        required_action: { type: string }
        response_body:   { type: string, nullable: true }
        status: { type: string, enum: [open, acknowledged, rectifying, closed, overdue, escalated] }
        closed_photos: { type: array, items: { type: string, format: uuid } }

    csr_NCR:
      type: object
      required: [project_id, defect_id, ncr_no, disposition]
      properties:
        id: { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        defect_id:  { type: string, format: uuid }
        ncr_no:     { type: string }
        disposition: { type: string, enum: [rework, repair, concession, scrap] }
        designer_approved_by: { type: string, format: uuid, nullable: true }
        owner_approved_by: { type: string, format: uuid, nullable: true }
        cost_impact_cny: { type: number }
        schedule_impact_days: { type: number }
        status: { type: string, enum: [raised, designer_reviewing, owner_reviewing, approved, rejected, implemented, closed] }
```

## 3. 核心 path

```yaml
paths:
  /v1/csr/quality/defects/{id}/rectify:
    post:
      tags: [csr-quality]
      summary: 触发 A5 整改单生成 (LangGraph)
      security: [{ bearerAuth: [] }]
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
              properties:
                issued_to_unit: { type: string }
                custom_action:  { type: string, nullable: true }
      responses:
        '201':
          description: A5 生成成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/csr_RectificationOrder'

  /v1/csr/quality/defects/{id}/close:
    post:
      tags: [csr-quality]
      summary: 整改闭环 · 强制附 ≥ 1 张整改后照片
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [after_photos]
              properties:
                after_photos:
                  type: array
                  minItems: 1
                  items: { type: string, format: uuid }
                remarks: { type: string }
      responses:
        '200': { description: closed · 整改单同步闭环 }
        '400': { description: CSR_QUALITY_CLOSE_NO_PHOTO }

  /v1/csr/quality/classify:
    post:
      tags: [csr-quality]
      summary: LLM 缺陷分类器(category + severity 候选)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [description]
              properties:
                project_id: { type: string, format: uuid }
                description: { type: string }
                bim_element_guids: { type: array, items: { type: string } }
                photo_ids: { type: array, items: { type: string, format: uuid } }
      responses:
        '200':
          description: 分类结果 + 置信度
          content:
            application/json:
              schema:
                type: object
                properties:
                  category_suggestions:
                    type: array
                    items:
                      type: object
                      properties:
                        category:   { type: string }
                        confidence: { type: number }
                        reason:     { type: string }
                  severity_suggestion: { type: string, enum: [minor, major, critical] }
                  standards_suggested:
                    type: array
                    items:
                      type: object
                      properties:
                        standard: { type: string }
                        clause:   { type: string }
```

## 4. 错误码

| HTTP | code | 说明 |
|---|---|---|
| 400 | `CSR_QUALITY_CLOSE_NO_PHOTO` | 闭环缺整改后影像 |
| 400 | `CSR_QUALITY_INVALID_CATEGORY` | category 枚举外 |
| 403 | `CSR_QUALITY_NO_AUTH_A5` | 无签发 A5 权限 (非 supervisor) |
| 409 | `CSR_QUALITY_NCR_ALREADY_APPROVED` | 重复审批 |
| 422 | `CSR_QUALITY_CONCESSION_NO_DESIGNER` | 让步未获 designer 批准 |

## 5. 限流

| endpoint | tenant 限流 |
|---|---|
| POST defects | 120/min (高峰时期密集录入) |
| POST classify | 30/min (LLM 成本控制) |
| POST defects/{id}/rectify | 60/min |

---

version: 0.1.0 · 2026-04-23
