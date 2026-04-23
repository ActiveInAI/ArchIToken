# 01-progress · API

REST API 草案 · OpenAPI 3.1 片段。前端 / SDK 的契约源头。
完整文件后续合入 `04-backend/openapi.yaml`(Phase 4 · 模块化时按 `/components/schemas/csr/...` 组织)。

---

## 1. 路径列表

| Method | Path | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/v1/csr/progress/schedules` | Bearer | 创建新进度计划 |
| POST | `/v1/csr/progress/schedules/{id}/baseline` | Bearer | 锁定基线 |
| GET | `/v1/csr/progress/schedules/{project_id}/active` | Bearer | 取当前活动计划 |
| GET | `/v1/csr/progress/wbs/{schedule_id}` | Bearer | 拉 WBS 树 |
| POST | `/v1/csr/progress/activities/{id}/progress` | Bearer | 更新工序进度 |
| POST | `/v1/csr/progress/snapshots` | Bearer | 推一次 EVM 快照 |
| GET | `/v1/csr/progress/snapshots/{project_id}` | Bearer | 查快照时间序列 |
| POST | `/v1/csr/progress/recovery/analyze` | Bearer | 触发纠偏分析 LangGraph |
| GET | `/v1/csr/progress/milestones/{project_id}` | Bearer | 查里程碑 |
| POST | `/v1/csr/progress/sync/csv` | Bearer | Primavera/MSP CSV 导入 |

## 2. OpenAPI 3.1 Snippets

### 2.1 Schemas

```yaml
components:
  schemas:
    csr_Schedule:
      type: object
      required: [id, project_id, version_no, name, planned_start, planned_finish]
      properties:
        id:             { type: string, format: uuid }
        project_id:     { type: string, format: uuid }
        version_no:     { type: integer, minimum: 1 }
        name:           { type: string, maxLength: 255 }
        is_baseline:    { type: boolean }
        is_active:      { type: boolean }
        planned_start:  { type: string, format: date }
        planned_finish: { type: string, format: date }
        data_date:      { type: string, format: date, nullable: true }
        source:         { type: string, enum: [manual, primavera_xer, msp_mpp, bim_4d, generated] }
        remarks:        { type: string, nullable: true }
        created_at:     { type: string, format: date-time }

    csr_WbsNode:
      type: object
      required: [id, schedule_id, code, name, level]
      properties:
        id:              { type: string, format: uuid }
        schedule_id:     { type: string, format: uuid }
        parent_id:       { type: string, format: uuid, nullable: true }
        code:            { type: string, pattern: '^[0-9]+(\.[0-9]+)*$' }
        name:            { type: string }
        level:           { type: integer, minimum: 1 }
        weight:          { type: number, minimum: 0, maximum: 1 }
        budget_cost_cny: { type: number }
        children:        { type: array, items: { $ref: '#/components/schemas/csr_WbsNode' } }

    csr_Activity:
      type: object
      required: [id, schedule_id, wbs_node_id, code, name, duration_days]
      properties:
        id:                  { type: string, format: uuid }
        code:                { type: string }
        name:                { type: string }
        duration_days:       { type: number, minimum: 0 }
        is_key_process:      { type: boolean }
        early_start:         { type: string, format: date, nullable: true }
        early_finish:        { type: string, format: date, nullable: true }
        late_start:          { type: string, format: date, nullable: true }
        late_finish:         { type: string, format: date, nullable: true }
        total_float:         { type: number, nullable: true }
        free_float:          { type: number, nullable: true }
        actual_start:        { type: string, format: date, nullable: true }
        actual_finish:       { type: string, format: date, nullable: true }
        pct_complete:        { type: number, minimum: 0, maximum: 100 }
        predecessors:
          type: array
          items:
            type: object
            required: [pred_id, type]
            properties:
              pred_id:  { type: string, format: uuid }
              type:     { type: string, enum: [FS, SS, FF, SF] }
              lag_days: { type: number, default: 0 }
        bim_element_guids:
          type: array
          items: { type: string, pattern: '^[0-9A-Za-z_$]{22}$' }

    csr_ProgressSnapshot:
      type: object
      required: [project_id, snapshot_date, pv_cny, ev_cny, ac_cny, overall_pct]
      properties:
        id:            { type: string, format: uuid }
        project_id:    { type: string, format: uuid }
        schedule_id:   { type: string, format: uuid }
        snapshot_date: { type: string, format: date }
        pv_cny:        { type: number }
        ev_cny:        { type: number }
        ac_cny:        { type: number }
        cpi:           { type: number, readOnly: true }
        spi:           { type: number, readOnly: true }
        budget_at_completion_cny:   { type: number, nullable: true }
        estimate_at_completion_cny: { type: number, nullable: true }
        overall_pct:   { type: number }

    csr_Milestone:
      type: object
      required: [id, project_id, code, name, category, target_date]
      properties:
        id:         { type: string, format: uuid }
        project_id: { type: string, format: uuid }
        code:       { type: string }
        name:       { type: string }
        category:   { type: string, enum: [contract, payment, regulatory, internal, handover] }
        target_date:{ type: string, format: date }
        actual_date:{ type: string, format: date, nullable: true }
        status:     { type: string, enum: [pending, achieved, slipped, waived] }
        liquidated_damages_cny_per_day: { type: number, nullable: true }

    csr_RecoveryAnalysis:
      type: object
      required: [spi_current, top_delays, scenarios]
      properties:
        spi_current: { type: number }
        top_delays:
          type: array
          items:
            type: object
            properties:
              activity_id: { type: string, format: uuid }
              lag_days:    { type: number }
              root_cause:  { type: string }
        scenarios:
          type: array
          items:
            type: object
            required: [option, recovery_days, incremental_cost_cny, risk]
            properties:
              option:               { type: string }
              recovery_days:        { type: number }
              incremental_cost_cny: { type: number }
              risk:                 { type: string, enum: [low, medium, high] }
```

### 2.2 Paths (精选)

```yaml
paths:
  /v1/csr/progress/schedules:
    post:
      tags: [csr-progress]
      summary: 创建进度计划(含 WBS + activities)
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [schedule, wbs, activities]
              properties:
                schedule:   { $ref: '#/components/schemas/csr_Schedule' }
                wbs:        { type: array, items: { $ref: '#/components/schemas/csr_WbsNode' } }
                activities: { type: array, items: { $ref: '#/components/schemas/csr_Activity' } }
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/csr_Schedule'
        '409':
          description: version_no 冲突

  /v1/csr/progress/schedules/{id}/baseline:
    post:
      tags: [csr-progress]
      summary: 锁定进度计划为基线(每项目仅 1 条)
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200': { description: 锁定成功 }
        '409': { description: 本项目已有基线 · 使用 /replace-baseline }

  /v1/csr/progress/snapshots:
    post:
      tags: [csr-progress]
      summary: 推一次 EVM 快照(默认 upsert · 同日覆盖)
      security: [{ bearerAuth: [] }]
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/csr_ProgressSnapshot'
      responses:
        '201': { description: 快照入库 }

  /v1/csr/progress/recovery/analyze:
    post:
      tags: [csr-progress]
      summary: 触发纠偏分析 LangGraph (planner → generator → evaluator)
      security: [{ bearerAuth: [] }]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [project_id]
              properties:
                project_id: { type: string, format: uuid }
                horizon_days:
                  type: integer
                  default: 14
                  description: 分析未来多少天内的风险 · 默认 14 日
      responses:
        '202':
          description: 异步作业已派发(SSE stream 可订阅结果)
          content:
            application/json:
              schema:
                type: object
                properties:
                  task_id: { type: string, format: uuid }
                  stream_url: { type: string, format: uri }
        '200':
          description: 同步返回(小项目 · SLA 内完成)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/csr_RecoveryAnalysis'
```

## 3. 错误码

| HTTP | code | 说明 |
|---|---|---|
| 400 | `CSR_PROGRESS_SCHEDULE_PERIOD_INVALID` | finish < start |
| 400 | `CSR_PROGRESS_WBS_CYCLE` | WBS 邻接表检测到环 |
| 400 | `CSR_PROGRESS_PCT_OUT_OF_RANGE` | pct_complete 不在 [0,100] |
| 409 | `CSR_PROGRESS_BASELINE_EXISTS` | 本项目已有基线 |
| 409 | `CSR_PROGRESS_SNAPSHOT_DUPLICATE` | 同日已存在快照(用 PUT 替换) |
| 422 | `CSR_PROGRESS_ACTIVITY_INVALID_GUID` | BIM GUID 格式非法 |

## 4. 限流 (L5 Gateway)

| endpoint | tenant 限流 | 全局限流 |
|---|---|---|
| POST schedules | 10/min | 1000/min |
| POST snapshots | 60/min (每日作业预期 1/日但允许调试) | 10000/min |
| POST recovery/analyze | 5/min | 200/min (LLM 成本控制) |

---

version: 0.1.0 · 2026-04-23
