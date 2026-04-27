# ArchIToken Full Local Audit

- Generated: 2026-04-27 00:00 UTC+08:00
- Root: `/home/insome/dev/insomeos`
- Branch: `sync/architoken-integrate-20260427-093621`
- Mode: local-only audit; no source fixes, no CI fixes, no commit, no push.
- Output files are excluded from their own scan to keep counts stable.

## Scope And Counts

- Directories scanned: **93**
- Files scanned: **351**
- Text files read fully: **351**
- Binary/unknown files: **0**
- Large/generated text files over 256 KiB: **1**
- Excluded directory names: `.git`, `node_modules`, `target`, `.next`, `dist`, `build`, `coverage`, `test-results`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`.

## Executive Verdict

ArchIToken 的新方向已经在 README、宪法附录、Source-of-Truth、前端 landing、模块工作台和数字孪生 fixture 中出现,但仓库实际执行层仍处在 InsomeOS v2.0 → ArchIToken v2.1/v3.0 的中间态。最大风险不是单点 CI,而是跨层契约不一致: 名称、业务模块、OpenAPI、DB enum、Python Agent、SDK、部署命名和前端实际 runtime 未完全合流。

## Focus Audit

| 关注项 | 结论 |
| --- | --- |
| ArchIToken 与 InsomeOS 命名迁移 | 未完成。README/宪法/Source-of-Truth 已声明 ArchIToken,但 active code/config/deploy/SDK/Agent 仍大量使用 InsomeOS/insomeos。 |
| 9 phase / BusinessPhase 残留 | 高风险残留。OpenAPI、Python state/phases/phase_graph/tests、initial_schema.sql 仍是 phase-era contract。 |
| Module Registry 落地 | 部分落地。02-architecture 与 04-backend/shared 有 Rust registry,但 Python MODULE_REGISTRY、DB modules 表、OpenAPI /v1/modules 未闭环。 |
| manufacturing / fabrication 迁移 | 未完成。README/宪法要求 production_manufacturing,但 frontend/shared/prompts/API 仍有 manufacturing/fabrication。 |
| 数据库设计与 StorageRouter | 未完成。PostgreSQL/Supabase/Valkey/Zedis 是直接实现名,StorageRouter 仅在架构文档中出现。 |
| OpenAPI phase/9-phase | 未完成。04-backend/openapi.yaml 仍暴露 /v1/phases、BusinessPhase schema 和 phase 字段。 |
| Agent prompt 与 Python 包 | 未完成。insomeos_agent 包、CLI、Docker CMD、CI coverage、tests、prompt loader 仍是旧命名和 9 phase。 |
| CI 失败根因 | 更多是项目一致性问题而非 CI 过严。严格门禁应保留,用它驱动命名/契约/测试收敛。 |
| 前端 ArchIToken/WebGPU/模块工作台方向 | 方向已转。已有 ArchIToken landing、modules workbench、heavy-steel digital twin fixture; 但 WebGPU/3DGS runtime 尚未工程化。 |
| 文档真源一致性 | 不一致。CONSTITUTION/ADDENDUM/SOURCE-OF-TRUTH 应作为当前准则,PRD/ARCHITECTURE/MODULES/CLAUDE/MANIFEST 需迁移或归档标识。 |

## Keyword Coverage

| Keyword | Files With Hit |
| --- | --- |
| InsomeOS | 72 |
| insomeos | 76 |
| BusinessPhase | 15 |
| business_phase | 4 |
| 9-phase | 5 |
| manufacturing | 30 |
| fabrication | 16 |
| Supabase | 20 |
| PostgreSQL | 21 |
| Zedis | 5 |
| Redis | 7 |
| Valkey | 12 |
| WebGPU | 10 |
| Three.js | 14 |
| OpenRouter | 5 |
| InferenceRouter | 8 |

## Category Coverage

| Category | File Count |
| --- | --- |
| 后端 | 258 |
| 文档 | 241 |
| Agent | 220 |
| Prompt | 207 |
| 数据库 | 54 |
| 配置 | 44 |
| 前端 | 27 |
| 部署 | 26 |
| 测试 | 7 |
| CI | 4 |
| 迁移 | 4 |

## Module Coverage

| Module Area | File Count |
| --- | --- |
| Backend/Agent | 218 |
| Frontend | 26 |
| Infra/Deployment | 25 |
| Backend/Shared Registry | 14 |
| Backend/Harness Core | 13 |
| Root/Governance | 12 |
| Architecture | 10 |
| Docs/Archive | 8 |
| Backend/File Parsers | 6 |
| CI/GitHub | 5 |
| Backend/Workspace | 4 |
| Backend/Database Migrations | 3 |
| Agent memory | 2 |
| SDK | 2 |
| Deployment Runbook | 1 |
| Product | 1 |
| Testing | 1 |

## Binary Or Large Files

| Path | Size Bytes | Type | Use / Summary |
| --- | --- | --- | --- |
| 03-frontend/tsconfig.tsbuildinfo | 317065 | generated-tsbuildinfo | TypeScript 增量编译生成元数据; 记录编译图、输入版本与缓存状态。 |

## Complete Directory Tree

```text
.
.claude
  memory.md (5530 B)
  settings.local.json (434 B)
.editorconfig (302 B)
.github
  ISSUE_TEMPLATE
    bug_report.yml (1611 B)
    feature_request.yml (998 B)
  PULL_REQUEST_TEMPLATE.md (1368 B)
  workflows
    ci.yml (5873 B)
    release.yml (2169 B)
.gitignore (1372 B)
01-product
  PRD.md (10635 B)
02-architecture
  ARCHITECTURE.md (22601 B)
  ARCHITOKEN-CONSTITUTION-ADDENDUM.md (15058 B)
  ARCHITOKEN-SOURCE-OF-TRUTH.md (5751 B)
  BUSINESS_MODULE_WORKBENCH.md (5154 B)
  CONSTITUTION.md (11008 B)
  DIGITAL_TWIN.md (7839 B)
  MODULE-REGISTRY.md (11621 B)
  MODULES.md (15328 B)
  OPEN_SOURCE_RADAR.md (15333 B)
  PRINCIPLES.md (4635 B)
03-frontend
  app
    app
      digital-twin
        page.tsx (610 B)
      modules
        page.tsx (596 B)
      projects
        page.tsx (3657 B)
    globals.css (1110 B)
    layout.tsx (1536 B)
    page.tsx (37975 B)
  bun.lock (214074 B)
  components
    ArchITokenScene.tsx (5918 B)
    BIMViewer.tsx (3094 B)
    BusinessModuleWorkbench.tsx (14685 B)
    DigitalTwinWorkbench.tsx (24703 B)
    Providers.tsx (656 B)
  eslint.config.mjs (273 B)
  lib
    api.test.ts (1090 B)
    api.ts (4979 B)
    business-modules.test.ts (2374 B)
    business-modules.ts (11642 B)
    digital-twin.test.ts (2751 B)
    digital-twin.ts (22388 B)
  next-env.d.ts (247 B)
  next.config.mjs (383 B)
  package.json (2222 B)
  postcss.config.mjs (94 B)
  tailwind.config.ts (1051 B)
  tsconfig.json (1149 B)
  tsconfig.tsbuildinfo (317065 B)
04-backend
  Cargo.lock (148661 B)
  Cargo.toml (4699 B)
  agent-orchestrator
    AGENTS.md (1561 B)
    prompts
      acceptance
        evaluator.md (322 B)
        generator.md (917 B)
        planner.md (462 B)
      concept
        evaluator.md (587 B)
        generator.md (922 B)
        planner.md (813 B)
      construction
        evaluator.md (352 B)
        generator.md (966 B)
        planner.md (374 B)
      construction_supervision
        CHANGELOG.md (6827 B)
        CORE
          GLOSSARY.md (22029 B)
          KEY-ENTITIES.md (10020 B)
          README.md (5213 B)
        DATA-MODEL.md (9374 B)
        GLOBAL-TABLES.sql (18342 B)
        INTEGRATION.md (7051 B)
        MANIFEST.md (8999 B)
        STANDARDS.md (10373 B)
        SUBDOMAIN
          00-overview
            README.md (1411 B)
          01-progress
            API.md (10144 B)
            BIM-INTEGRATION.md (3139 B)
            DATA-MODEL.md (17321 B)
            PROMPTS.md (3627 B)
            README.md (5563 B)
            STANDARDS.md (2292 B)
            TODO.md (2221 B)
            UI-COMPONENTS.md (4355 B)
            WORKFLOW.md (3770 B)
            examples
              jinping_week6_recovery.md (5227 B)
            prompts
              delay_root_cause_analyzer.md (4680 B)
              evaluator.md (4082 B)
              generator.md (4913 B)
              planner.md (3783 B)
          02-quality
            API.md (8327 B)
            BIM-INTEGRATION.md (2277 B)
            DATA-MODEL.md (14533 B)
            PROMPTS.md (1595 B)
            README.md (4511 B)
            STANDARDS.md (2703 B)
            TODO.md (1431 B)
            UI-COMPONENTS.md (3352 B)
            WORKFLOW.md (3644 B)
            examples
              jinping_weld_rework.md (4375 B)
            prompts
              defect_classifier.md (3535 B)
              evaluator.md (2522 B)
              generator.md (4292 B)
              planner.md (2510 B)
          03-safety
            API.md (5911 B)
            BIM-INTEGRATION.md (1440 B)
            DATA-MODEL.md (15157 B)
            PROMPTS.md (1188 B)
            README.md (4186 B)
            STANDARDS.md (2710 B)
            TODO.md (1743 B)
            UI-COMPONENTS.md (2142 B)
            WORKFLOW.md (3673 B)
            examples
              jinping_lifting_permit.md (3360 B)
            prompts
              evaluator.md (2367 B)
              generator.md (4199 B)
              hira_generator.md (6230 B)
              planner.md (2281 B)
          04-daily_log
            API.md (4573 B)
            BIM-INTEGRATION.md (1052 B)
            DATA-MODEL.md (14574 B)
            PROMPTS.md (1527 B)
            README.md (3534 B)
            STANDARDS.md (1376 B)
            TODO.md (1481 B)
            UI-COMPONENTS.md (1865 B)
            WORKFLOW.md (2463 B)
            examples
              jinping_day7_log.md (2585 B)
            prompts
              daily_summary_generator.md (4247 B)
              evaluator.md (1588 B)
              generator.md (2975 B)
              planner.md (2103 B)
          05-method_statement
            API.md (4257 B)
            BIM-INTEGRATION.md (1334 B)
            DATA-MODEL.md (12697 B)
            PROMPTS.md (1086 B)
            README.md (3707 B)
            STANDARDS.md (2200 B)
            TODO.md (1430 B)
            UI-COMPONENTS.md (1733 B)
            WORKFLOW.md (2193 B)
            examples
              jinping_lifting_ms.md (3602 B)
            prompts
              evaluator.md (1073 B)
              expert_review_facilitator.md (4677 B)
              generator.md (3560 B)
              planner.md (1921 B)
          06-testing
            API.md (3590 B)
            BIM-INTEGRATION.md (1066 B)
            DATA-MODEL.md (10800 B)
            PROMPTS.md (1124 B)
            README.md (3537 B)
            STANDARDS.md (1750 B)
            TODO.md (1303 B)
            UI-COMPONENTS.md (1636 B)
            WORKFLOW.md (1530 B)
            examples
              jinping_ut_witness.md (2652 B)
            prompts
              evaluator.md (1130 B)
              generator.md (2938 B)
              planner.md (1665 B)
              sample_plan_generator.md (2988 B)
          07-inspection_lot
            API.md (5736 B)
            BIM-INTEGRATION.md (1247 B)
            DATA-MODEL.md (11794 B)
            PROMPTS.md (924 B)
            README.md (3916 B)
            STANDARDS.md (1790 B)
            TODO.md (1351 B)
            UI-COMPONENTS.md (1558 B)
            WORKFLOW.md (1747 B)
            examples
              jinping_lot_b5.md (2506 B)
            prompts
              evaluator.md (853 B)
              generator.md (2017 B)
              lot_boundary_advisor.md (3064 B)
              planner.md (1648 B)
          08-acceptance
            API.md (4449 B)
            BIM-INTEGRATION.md (1045 B)
            DATA-MODEL.md (14542 B)
            PROMPTS.md (1016 B)
            README.md (3933 B)
            STANDARDS.md (1259 B)
            TODO.md (1399 B)
            UI-COMPONENTS.md (1854 B)
            WORKFLOW.md (2972 B)
            examples
              jinping_completion_acceptance.md (3502 B)
            prompts
              evaluator.md (1182 B)
              five_parties_signoff_orchestrator.md (4879 B)
              generator.md (3100 B)
              planner.md (1841 B)
          09-risk_analysis
            API.md (4257 B)
            BIM-INTEGRATION.md (1093 B)
            DATA-MODEL.md (13661 B)
            PROMPTS.md (801 B)
            README.md (3320 B)
            STANDARDS.md (1375 B)
            TODO.md (1371 B)
            UI-COMPONENTS.md (1156 B)
            WORKFLOW.md (2100 B)
            examples
              jinping_rainy_season_risk.md (3009 B)
            prompts
              evaluator.md (821 B)
              generator.md (2899 B)
              monte_carlo_schedule_simulator.md (2690 B)
              planner.md (1112 B)
          10-bim_integration
            API.md (3050 B)
            BIM-INTEGRATION.md (2637 B)
            DATA-MODEL.md (10700 B)
            PROMPTS.md (764 B)
            README.md (3552 B)
            STANDARDS.md (1788 B)
            TODO.md (1106 B)
            UI-COMPONENTS.md (1325 B)
            WORKFLOW.md (1975 B)
            examples
              jinping_ifc_clash.md (2525 B)
            prompts
              evaluator.md (749 B)
              generator.md (1398 B)
              ifc_clash_triage.md (3144 B)
              planner.md (1051 B)
          11-compliance
            API.md (3870 B)
            BIM-INTEGRATION.md (1184 B)
            DATA-MODEL.md (12852 B)
            PROMPTS.md (803 B)
            README.md (3629 B)
            STANDARDS.md (1633 B)
            TODO.md (1210 B)
            UI-COMPONENTS.md (1163 B)
            WORKFLOW.md (2638 B)
            examples
              jinping_code_check.md (2620 B)
            prompts
              evaluator.md (587 B)
              generator.md (2770 B)
              planner.md (1123 B)
              regulation_diff_detector.md (2883 B)
          12-change_order
            API.md (3693 B)
            BIM-INTEGRATION.md (1395 B)
            DATA-MODEL.md (15697 B)
            PROMPTS.md (785 B)
            README.md (3748 B)
            STANDARDS.md (1279 B)
            TODO.md (996 B)
            UI-COMPONENTS.md (1441 B)
            WORKFLOW.md (2720 B)
            examples
              jinping_time_extension.md (2175 B)
            prompts
              evaluator.md (677 B)
              generator.md (2083 B)
              impact_propagation_analyzer.md (3395 B)
              planner.md (1110 B)
        WORKFLOW.md (7809 B)
      costing
        evaluator.md (441 B)
        generator.md (1113 B)
        planner.md (547 B)
      develop
        evaluator.md (551 B)
        generator.md (1137 B)
        planner.md (598 B)
      fabrication
        evaluator.md (357 B)
        generator.md (1003 B)
        planner.md (476 B)
      logistics
        evaluator.md (322 B)
        generator.md (818 B)
        planner.md (493 B)
      operations
        evaluator.md (362 B)
        generator.md (1045 B)
        planner.md (453 B)
      pre_sales
        evaluator.md (1304 B)
        generator.md (1415 B)
        planner.md (1613 B)
    pyproject.toml (1878 B)
    src
      insomeos_agent
        __init__.py (238 B)
        inference.py (2901 B)
        main.py (3258 B)
        phase_graph.py (7118 B)
        phases.py (3034 B)
        prompts.py (972 B)
        settings.py (2296 B)
        state.py (2752 B)
    tests
      conftest.py (152 B)
      test_phases.py (2252 B)
  deny.toml (2275 B)
  file-parsers
    Cargo.toml (1051 B)
    src
      dwg.rs (2011 B)
      ifc.rs (3003 B)
      lib.rs (2878 B)
      pdf.rs (1935 B)
      xml.rs (1357 B)
  harness-core
    Cargo.toml (2176 B)
    src
      bin
        gateway.rs (3091 B)
      config.rs (5193 B)
      error.rs (3372 B)
      inference.rs (7156 B)
      lib.rs (2612 B)
      observability.rs (2950 B)
      permissions.rs (5529 B)
      rag.rs (4610 B)
      rollback_guard.rs (7004 B)
      sla.rs (1557 B)
      tools.rs (3065 B)
    tests
      compat_suite.rs (2257 B)
  migrations
    20260419000001_initial_schema.sql (8773 B)
    20260419000002_rls_policies.sql (4714 B)
    seeds
      001_anchor_jinping.sql (4049 B)
  openapi.yaml (12178 B)
  shared
    Cargo.toml (524 B)
    src
      lib.rs (2252 B)
      modules
        concept_design.rs (706 B)
        construction_supervision.rs (781 B)
        detailed_design.rs (663 B)
        digital_archive.rs (727 B)
        digital_twin.rs (662 B)
        manufacturing.rs (671 B)
        marketing_service.rs (728 B)
        material_logistics.rs (612 B)
        mod.rs (3835 B)
        quantity_costing.rs (701 B)
        settings_center.rs (730 B)
        standard_library.rs (808 B)
05-infra
  ci
    ci.yml (5872 B)
    release.yml (2169 B)
  docker
    Dockerfile.agent (1983 B)
    Dockerfile.frontend (1789 B)
    Dockerfile.gateway (2200 B)
    compose.data.yml (1220 B)
    docker-compose.yml (3994 B)
    otel-collector.yaml (771 B)
    prometheus.yaml (658 B)
  k8s
  k8s-cluster
    CLUSTER.md (2045 B)
    containerd-registry-mirror.md (1953 B)
    storage.md (1605 B)
  k8s-manifests
    .env.example (420 B)
    README.md (2137 B)
    postgres.yaml (2906 B)
    valkey.yaml (2317 B)
    00-namespace.yaml (949 B)
    01-config.yaml (1260 B)
    10-gateway.yaml (4365 B)
    20-agent.yaml (2302 B)
    30-frontend.yaml (1735 B)
    90-ingress.yaml (1594 B)
  rainbond
    KNOWN_ISSUES.md (1544 B)
    template.yaml (3768 B)
    values.yaml (2525 B)
07-deployment
  runbook.md (8968 B)
08-sdk
  README.md (2310 B)
  openapitools.json (3021 B)
09-testing
  landing.spec.ts (1128 B)
CHANGELOG.md (4330 B)
CLAUDE.md (8129 B)
CODE_OF_CONDUCT.md (1670 B)
CONTRIBUTING.md (3082 B)
LICENSE (733 B)
LICENSE-MIT (1067 B)
MANIFEST.md (14144 B)
README.md (8519 B)
SECURITY.md (1086 B)
docs
  ADR-0018-secrets-management.md (1758 B)
  AIA-OVERNIGHT-REPORT-2026-04-24.md (10599 B)
  ARCHITOKEN-MIGRATION-TRACKER.md (5743 B)
  CHANGELOG-v1.3.0.md (7127 B)
  TODO.md (6070 B)
  ZED-CLAUDE-CODE-SETUP.md (7778 B)
  patches
    PATCH-2026-04-23-c.md (7574 B)
    PATCH-2026-04-23-d.md (7115 B)
versions.toml (69968 B)
```

## Defect Matrix

- P0 count: **10**
- P1 count: **14**
- P2 count: **10**

### P0
| ID | 领域 | 缺陷 | 建议动作 |
| --- | --- | --- | --- |
| P0-01 | 命名迁移 | ArchIToken 与 InsomeOS 在 README/宪法外已分裂; crate、Python 包、Docker/K8s、SDK、测试仍大量使用 InsomeOS。 | 统一 active code/config/deploy/package 命名,历史文档只保留 lineage。 |
| P0-02 | 业务模型 | OpenAPI、Python agent、DB migration、测试仍使用 9-phase/BusinessPhase。 | 以 module_id + Module Registry + Module Schema 替换 phase 合同。 |
| P0-03 | 数据库契约 | initial_schema.sql 使用 PostgreSQL ENUM business_phase 与 projects.phase/agent_invocations.phase。 | 新建 modules 表和 module_id FK,提供数据迁移脚本。 |
| P0-04 | 数据能力分层 | Supabase/PostgreSQL/Zedis/Valkey/Redis 被直接写入文档、配置、infra 与代码,StorageRouter 未落地。 | 定义 StorageRouter trait/API,PostgreSQL/Valkey 仅作为 adapter。 |
| P0-05 | 生产制造命名 | README/宪法要求 production_manufacturing,但代码/前端/prompt 仍有 manufacturing/fabrication。 | 一次性迁移 ID、路径、prompt、测试、OpenAPI 与 DB alias。 |
| P0-06 | Agent 包命名 | pyproject、Docker、CI、imports、tests 均绑定 insomeos_agent。 | 引入 architoken_agent,提供兼容 shim 后再移除旧名。 |
| P0-07 | OpenAPI 真源 | 04-backend/openapi.yaml 暴露 /v1/phases、BusinessPhase 和 phase 字段,SDK 生成仍 insomeos。 | 升级 OpenAPI 3.1 为 module registry contract 并重生成 SDK。 |
| P0-08 | CI 根因 | CI 严格度不是主要问题; 它暴露的是命名、契约、文档和测试漂移。 | 保持 -D warnings/严格门禁,先修项目事实不一致。 |
| P0-09 | Module Registry 落地不全 | 文档和 Rust shared registry 已有雏形,但 Python/API/DB/SDK/前端路由未闭环。 | 建立 registry parity 测试和端到端 schema source。 |
| P0-10 | 业务逻辑深度 | 前端已有工作台/数字孪生展示与 fixtures,但缺少完整生命周期事务、审批、状态机与后端联动。 | 先建模块工作流 contract,再接 API/DB/agent 执行链。 |

### P1
| ID | 领域 | 缺陷 | 建议动作 |
| --- | --- | --- | --- |
| P1-01 | 文档真源冲突 | README/CONSTITUTION/SOURCE-OF-TRUTH 与 PRD/ARCHITECTURE/MODULES/CLAUDE/MANIFEST 存在时代差。 | 设定优先级并把旧文档转 archive 或迁移。 |
| P1-02 | 数字孪生 runtime | 前端大量体现 WebGPU/3DGS 方向,但实际仍主要是 React/CSS/SVG/fixture。 | 落地 WebGPU capability、3DGS/SPZ/PLY loader、IFC/点云对齐测试。 |
| P1-03 | 开源技术雷达 | OPEN_SOURCE_RADAR 选型丰富,但未形成依赖许可/安全/集成边界。 | 为每个候选库补 ADR 和 adapter 边界。 |
| P1-04 | 部署命名 | Docker/K8s/Rainbond 使用 insomeos namespace、image、host、secret。 | 改为 ArchIToken 命名并保留迁移兼容域名。 |
| P1-05 | SDK 命名 | 08-sdk/openapitools.json 和 README 仍生成 @insomeos/sdk、insomeos_sdk 等。 | 重命名 SDK 坐标并规划 package deprecation。 |
| P1-06 | Prompt 目录 | 旧 9 个 phase prompt 与新的 construction_supervision 12 子域并存。 | 按 11 模块拆分 prompt registry。 |
| P1-07 | DB 文档/实装偏差 | construction_supervision/GLOBAL-TABLES.sql 引用 public.modules,实际 migrations 未创建。 | 把 prompt DDL 转正式 migration 或标明草案。 |
| P1-08 | Agent 指令陈旧 | CLAUDE.md 仍要求当前项目名 InsomeOS,会误导自动化代理。 | 改写为 ArchIToken active instruction,旧版归档。 |
| P1-09 | 生成文件入库 | 03-frontend/tsconfig.tsbuildinfo 是编译缓存。 | 评估从 git 移除并加入 ignore。 |
| P1-10 | 解析链断开 | harness-core/Cargo.toml 暂时注释 file-parsers path 依赖。 | 恢复文件解析 adapter 或引入替代实现。 |
| P1-11 | 测试缺口 | 缺少 module registry 与 OpenAPI/DB/Python/前端的 parity 测试。 | 新增跨层 contract test。 |
| P1-12 | 文档过度领先 | 宪法定义 Model/Render/Storage/Tool Router,代码只明显落地 InferenceRouter。 | 按 Router 分层补最小接口。 |
| P1-13 | 安全/合规文档品牌 | SECURITY/CODE_OF_CONDUCT/CONTRIBUTING 仍是 InsomeOS。 | 迁移品牌并保留历史说明。 |
| P1-14 | 项目结构命名 | 仓库路径、Rust crate、binary、metric、localStorage key 仍旧名。 | 规划 rename sequence,避免一次性破坏兼容。 |

### P2
| ID | 领域 | 缺陷 | 建议动作 |
| --- | --- | --- | --- |
| P2-01 | 历史档案标识 | MANIFEST、patch、overnight report 等历史文件未统一标 archive。 | 补 archive banner。 |
| P2-02 | 样例 URI | 示例 s3://insomeos 和 auth.insomeos.io 会污染新用户理解。 | 样例迁移到 architoken 或标 legacy。 |
| P2-03 | 指标命名 | insomeos_sla_latency_seconds 等 metric 尚未改名。 | 添加 dual metric 过渡。 |
| P2-04 | 测试标题 | Playwright landing spec 仍断言 InsomeOS 标题。 | 与 UI 新标题同步。 |
| P2-05 | 版本清单 | versions.toml 很大且含未来候选项,需定期验证。 | 增加版本审计流程。 |
| P2-06 | 许可证文档 | LICENSE/MIT 正常,但品牌周边文档未同步。 | 保留许可文件,更新周边说明。 |
| P2-07 | local agent memory | .claude/memory.md 可能含旧上下文。 | 标本地辅助,不得作为真源。 |
| P2-08 | 前端 API token key | localStorage 使用 insomeos_token。 | 兼容读取旧 key,写入新 key。 |
| P2-09 | Construction docs | 施工监理子域文档质量高但与主模块迁移未完全同步。 | 逐步纳入 module registry。 |
| P2-10 | 格式治理 | 部分 Markdown/TOML/YAML 文档编号仍 INSOMEOS。 | 迁移编号体系。 |

## Recommended Repair Order

| Order | Step | Do Next |
| --- | --- | --- |
| 1 | Freeze current truth | Declare `CONSTITUTION.md` + addendum + source-of-truth as active; mark MANIFEST/patch/overnight docs archive. |
| 2 | Contract migration | OpenAPI: replace `/v1/phases`, `BusinessPhase`, `phase` with `/v1/modules`, `module_id`, Module Schema. |
| 3 | Database migration | Create `modules` table, migrate `business_phase` enum columns to `module_id`, add aliases for old phase values. |
| 4 | Python Agent migration | Move `insomeos_agent` to `architoken_agent` with compatibility shim; replace `phases.py`/`phase_graph.py` with module registry graph. |
| 5 | Manufacturing rename | Migrate `manufacturing`/`fabrication` to `production_manufacturing` across docs, Rust registry, TS fixtures, prompts, tests. |
| 6 | StorageRouter baseline | Add minimal StorageRouter capability model before changing concrete PostgreSQL/Valkey infra. |
| 7 | Frontend logic bridge | Connect module workbench and digital twin fixtures to API contracts and workflow state transitions, not just display data. |
| 8 | WebGPU/3DGS runtime | Add feature detection, fallback, loader contract, and tests for actual WebGPU/3DGS path. |
| 9 | Deploy/SDK naming | Rename Docker/K8s/Rainbond/SDK package coordinates after API compatibility plan is in place. |
| 10 | CI parity gates | Add registry parity checks and keep strict CI; do not relax warnings or contract validation. |

## File Index Reference

Every scanned file has a per-file summary, keyword hit list, risk and action in `docs/ARCHITOKEN_FILE_INDEX.md`. Each row includes a short SHA-256 prefix to show the bytes were read during audit.
