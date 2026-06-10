# ArchIToken Database Design In One Diagram

Snapshot: 2026-06-09.

```mermaid
flowchart TB
  User[用户 / Agent / Worker] --> UI[统一模块工作台<br/>14+ 业务模块 / CDE / AI Center / Settings]
  UI --> Gateway[ArchIToken Gateway<br/>唯一业务 API 入口]

  Gateway --> Guard[控制面<br/>RBAC + RLS + 审批 + 审计 + SchemaValidator]
  Guard --> DataPlane[DataPlane / StorageRouter<br/>按能力路由, 不让模块直连数据库]

  DataPlane --> Pg[(PostgreSQL 主干真源<br/>租户/账号/权限/项目/模块/审批/审计<br/>资产元数据/文件版本/对象绑定/data_plane_bindings)]
  DataPlane --> Obj[(SeaweedFS S3 ObjectStore<br/>源文件/派生文件/IFC-DWG-PDF-Office-图片-BIM-CAD 大对象)]
  DataPlane --> Cache[(Valkey CacheStore<br/>会话/缓存/限流/短锁/临时状态)]
  DataPlane --> Event[(NATS JetStream EventStore<br/>事件流/任务信号/异步集成)]
  DataPlane --> Vec[(Qdrant VectorStore<br/>RAG 向量/语义检索/相似构件与知识)]
  DataPlane --> CH[(ClickHouse<br/>TimeSeries + Analytics<br/>IoT/进度/日志/运营分析)]
  DataPlane --> Graph[ArchIToken Graph Sidecar<br/>GraphStore HTTP API<br/>health / edges / neighbors / delete]

  Graph --> GraphPg[(PostgreSQL data_graph_edges<br/>图关系 canonical fallback)]
  Pg -. 事务真源/约束/审计 .-> Guard
  Obj -. object_store_bindings 元数据 .-> Pg
  Event -. postgres_outbox fallback .-> Pg
  CH -. postgres_partitioned / materialized fallback .-> Pg
  Vec -. pgvector fallback .-> Pg
  GraphPg -. RLS tenant context .-> Pg

  classDef trunk fill:#e8fff3,stroke:#16a34a,color:#083b24;
  classDef sidecar fill:#eef6ff,stroke:#2563eb,color:#102a43;
  classDef control fill:#fff7ed,stroke:#ea580c,color:#431407;
  classDef client fill:#f8fafc,stroke:#94a3b8,color:#0f172a;

  class Pg trunk;
  class Obj,Cache,Event,Vec,CH,Graph,GraphPg sidecar;
  class Guard,DataPlane control;
  class User,UI,Gateway client;
```

One sentence summary:

ArchIToken 的数据库不是一个大库包打天下，而是 **PostgreSQL 做业务真源和审计约束，DataPlane 把文件、缓存、事件、向量、时序分析、图关系分别路由到真实专用存储；所有模块只能经过 Gateway/Router/审批审计链路访问，不允许前端或业务模块绕开直连。**
