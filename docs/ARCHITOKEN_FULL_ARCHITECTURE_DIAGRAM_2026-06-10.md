# ArchIToken 完整架构图 · 2026-06-10

> AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
> 真源：全产品应用/BOM/数据库/Agent/Workflow/技术架构主文档 + 2026-06-10 架构评审 Gate

---

## 1. 总体分层架构（L7 → L0 + 4A）

```mermaid
flowchart TB
  subgraph BA["业务架构 BA · 16 模块对象链"]
    direction LR
    U["用户：业主 / 设计 / BIM / 造价 / 工厂 / 现场 / 管理员"]
  end

  subgraph L7["L7 · 工作台 (Web / Desktop / Mobile)"]
    Shell["ModuleWorkbenchShell · 统一壳 · 文件 · 对象 · 审批 · 审计 · AI 助手"]
  end
  subgraph L6["L6 · SDK / API 合同"]
    Contract["OpenAPI · AsyncAPI · TS/Python/Rust/Go SDK"]
  end
  subgraph L5["L5 · Gateway"]
    GW["鉴权 · 租户 · 限流 · 审计 · REST/SSE/gRPC/MCP"]
  end
  subgraph L4["L4 · Workflow / Agent"]
    Gate["Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver"]
  end
  subgraph L3["L3 · Harness Core (Rust)"]
    Routers["ModelRouter · ToolRouter · GeometryRouter · StorageRouter · RenderRouter · WorkflowRouter · Registry · Schema"]
  end
  subgraph L2["L2 · Data Plane (StorageRouter 能力)"]
    Data["PostgreSQL · ObjectStore · VectorStore · EventStore · CacheStore · TimeSeries · Graph · Analytics"]
  end
  subgraph L1["L1 · Worker / Runtime"]
    Workers["Office · PDF · CAD · BIM · IFC · DWG · 图像/视频 · AI/GPU · 导出"]
  end
  subgraph L0["L0 · Infrastructure"]
    Infra["Docker · Kubernetes · GPU 节点 · NVIDIA/AMD/Intel/Apple · 私有化部署"]
  end

  U --> Shell --> Contract --> GW --> Gate --> Routers --> Data
  Routers --> Workers --> Data
  Data --> Infra
  Workers --> Infra
```

---

## 2. 16 模块业务对象链 + BOM 形态（端到端闭环）

```mermaid
flowchart LR
  M1["marketing_service 市场客服<br/>RBOM/Demand BOM"]
  M2["planning_management 计划<br/>Planning BOM"]
  M3["concept_design 方案<br/>CBOM"]
  M4["standard_library 标准族库<br/>Master/Library BOM"]
  M5["detailed_design 深化<br/>EBOM"]
  M6["component_material BOM<br/>构件物料 BOM"]
  M7["quantity_costing 计量造价<br/>QBOM/BOQ"]
  M8["material_logistics 材料物流<br/>PBOM 采购"]
  M9["production_manufacturing 生产<br/>MBOM 制造"]
  M10["construction_management 施工<br/>IBOM 安装"]
  M11["digital_twin 数字孪生<br/>Asset BOM"]
  M12["digital_archive 数字档案<br/>ABOM 归档"]
  M13["finance_management 财务<br/>FBOM"]
  M14["human_resources 人力<br/>Labor BOM"]
  M15["ai_center AI 中心<br/>Agent BOM"]
  M16["settings_center 设置治理<br/>Governance BOM"]

  M1 --> M2 --> M3 --> M5 --> M6 --> M7
  M4 -. 标准/规则/族 .-> M3 & M5 & M7 & M10
  M6 --> M8
  M6 --> M9
  M7 --> M8
  M8 --> M10
  M9 --> M10
  M10 --> M11 --> M12
  M7 --> M13
  M2 --> M14
  M15 -. ModelRouter/ToolRouter/Agent 治理 .-> M1 & M5 & M7 & M9
  M16 -. 租户/权限/审批矩阵 .-> M1 & M11 & M13
```

> 下游只读上游 **issued** 版本；跨模块只按 `project_id / object_id / version_id` 引用，不复制第二真源。

---

## 3. AI 正向工程闭环（构件实例血缘链）

```mermaid
flowchart LR
  R["customer_requirement<br/>需求"] --> S["source_file / meeting / contract"]
  S --> ME["model_element / ifc_guid<br/>element_type / property_set"]
  ME --> DV["drawing_view / detail"]
  DV --> Q["quantity_takeoff / material_takeoff<br/>QTO / MTO"]
  Q --> B["bom_line / boq_item / quote_line"]
  B --> P["purchase_request / fabrication_part / work_order"]
  P --> I["installation_task / acceptance_record"]
  I --> A["archive_package / audit_event"]
  A -. 双向回跳 .-> R
```

> 工程对象 = 类型 + 几何 + 属性集 + 关系 + 版本证据；AI 输出默认 `draft_assist` / `professional_review_required`，AI 不代签客户确认。

---

## 4. 数据架构（StorageRouter 八能力 + 真源边界）

```mermaid
flowchart TB
  SR["StorageRouter"]
  SR --> TS["TransactionStore<br/>PostgreSQL/Supabase · 业务事务/版本/审批"]
  SR --> OS["ObjectStore<br/>S3/SeaweedFS · IFC/DWG/Office/PDF/归档"]
  SR --> VS["VectorStore<br/>pgvector/Qdrant · 标准检索/RAG（可重建索引）"]
  SR --> ES["EventStore<br/>outbox/NATS JetStream · 工作流事件"]
  SR --> CS["CacheStore<br/>Valkey · 会话/锁/队列状态"]
  SR --> TSS["TimeSeriesStore<br/>PG分区/ClickHouse · IoT/进度"]
  SR --> GS["GraphStore<br/>Neo4j/AGE · 构件关系/供应链"]
  SR --> AS["AnalyticsStore<br/>ClickHouse · 成本/进度 BI"]

  TS --> Truth["事实真源：PostgreSQL 业务对象 + CDE/ObjectStore 源文件"]
  VS -. 不做真源 .-> Truth
  CS -. 不做真源 .-> Truth
```

> 控制面禁止项：前端/Agent 不得自创字段直接入库；Worker 不得绕过 Workflow 改业务状态；无价格证据不得写正式采购价；无 IDS/Validate/BCF/审批不得声明就绪。

---

## 5. 三层 Agent 工程架构 + 6 门禁链

```mermaid
flowchart TB
  subgraph Gate["固定门禁链（每个 Agent 输出必经）"]
    direction LR
    P["Planner"] --> G["Generator"] --> E["Evaluator"] --> RC["RuleChecker"] --> SV["SchemaValidator"] --> AP["Approver(人工)"]
  end

  subgraph L1A["个体 Agent · 单任务"]
    A1["ExcelBOMImport · SJG157Classify · PDFExtract · PhotoQualityCheck"]
  end
  subgraph L2A["流程 Agent · 串联状态机"]
    A2["RequirementToPlan · DesignToBOM · BOMToPurchase · ChangeImpact"]
  end
  subgraph L3A["企业 Agent · 经营预警（只建议）"]
    A3["OperationsReview · CostRisk · CashflowWatch · DataQualityGovernor"]
  end
  subgraph Gov["协同/治理 Agent"]
    A4["Collaboration · Scheduling · DatabaseSteward · MetadataGovernance · PriceEvidence · OpenBimEvidence"]
  end

  A1 --> Gate
  A2 --> Gate
  A3 --> Gate
  A4 --> Gate
  Gate --> Out["artifact / approval_task / audit_event"]
```

> Agent 是 Registry/任务目录/权限边界，不是常驻 GPU 进程（P0 24-32 → P1 80-120 → 成熟 160-200）；不得自动审批/付款/发布/破坏性 SQL。

---

## 6. 全产品工作流状态机（lead → archived）

```mermaid
stateDiagram-v2
  [*] --> lead
  lead --> requirement_captured
  requirement_captured --> project_planned
  project_planned --> concept_selected
  concept_selected --> detailed_design_reviewed
  detailed_design_reviewed --> bom_issued
  bom_issued --> cost_approved
  cost_approved --> procurement_started
  procurement_started --> manufacturing_started
  manufacturing_started --> shipment_started
  shipment_started --> site_installation
  site_installation --> acceptance_review
  acceptance_review --> handover
  handover --> archived
  archived --> [*]

  note right of bom_issued
    对象统一生命周期:
    draft → generated → evaluated →
    rule_checked → schema_validated →
    reviewing → approved → issued →
    archived (异常 → blocked)
  end note
```

---

## 7. 技术栈与 Router 边界（端口）

```mermaid
flowchart LR
  FE["前端 :3000<br/>Next.js 16.2.6 · React 19.2.5 · TS 6.0.3<br/>WebGPU · Three.js r184 · Monaco"]
  GWs["Gateway :8080<br/>Rust · axum · tonic · utoipa OpenAPI 3.1"]
  AO["agent-orchestrator :8090<br/>Python · LangGraph"]
  MR["ModelRouter :8091"]
  TR["ToolRouter :8092"]
  PDF["pdf-worker :8093"]
  DBM["database-manager :8094"]
  OFF["office-worker :9980"]
  DB[("PostgreSQL · S3/SeaweedFS · pgvector · Valkey · NATS")]

  FE --> GWs --> DB
  GWs --> AO --> MR
  AO --> TR
  GWs --> PDF & DBM & OFF
  MR -. 经 Router 适配 .-> EXT["vLLM/SGLang/Ollama · OpenRouter/HF"]
```

> 规则：Rust-first · WebGPU-first · Registry-over-Enum · 业务逻辑不得直连外部模型 SDK / 不得绕过 Gateway 写库 / Worker 产物不当真源。

---

## 8. 部署拓扑（一期 6 台 CPU + BIM GPU 专项）

```mermaid
flowchart TB
  subgraph srv01["srv-01 · ¥58,450"]
    A["CDE/API/数据库<br/>PostgreSQL · Gateway · Outbox · ModelRouter<br/>Xeon 676X · 64→256GB"]
  end
  subgraph srv02["srv-02 · ¥83,200"]
    B["NAS/备份/CDE 文件<br/>4×22TB RAID5 (~66TB) · 离线归档<br/>Xeon 658X"]
  end
  subgraph srv03["srv-03 · ¥58,650 + GPU"]
    C["BIM/IFC/模型派生 · Validate<br/>Xeon 676X · GPU 方案A 2×RTX PRO 6000D 84GB ¥136,000<br/>或方案B 4×RTX 5090 32GB ¥144,000"]
  end
  subgraph srv04["srv-04 · ¥46,800"]
    D["CI/通用 Worker<br/>Office/PDF/CAD 解析 · Schema 校验"]
  end
  subgraph srv05["srv-05 · ¥46,800"]
    E["App/API/队列<br/>任务队列 · 缓存 · Agent 调度"]
  end
  subgraph srv06["srv-06 · ¥46,800"]
    F["JumpServer/日志/审计<br/>堡垒机 · 监控 · 备份校验"]
  end

  A <--> B
  A <--> C
  A <--> E
  C --> B
  D --> A
  E --> A
  F -. 只读审计 .-> A & B & C & D & E
```

> CPU 物料 ¥340,700 / 含离线备份盘 ¥355,500；升级门：676X→696X +¥24,650、658X→696X +¥32,500、64GB→256GB +¥40,500/台。仅支撑 L2 内部试点（30-100 用户）；1000/1万/10万用户须迁云或 IDC 多副本。

---

## 9. 架构评审 Gate 结论（2026-06-10）

| 标志位 | 值 |
|---|---|
| `ready_for_architecture_review` | **true** |
| `ready_for_openbim_review` | false |
| `mayClaimBuildingSmartOpenBim` | false |
| `ready_for_l2_internal_pilot` | **true** |
| `ready_for_l3_commercial_production` | false |
