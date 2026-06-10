# ArchIToken 工作树变更治理记录 2026-06-08

## 目的

本记录用于治理当前脏工作树，避免数据智能体架构、OpenAPI 合约、前端 E2E 视觉验证和用户已有改动混在一起提交或回滚。

当前规则：

- 不执行 `git reset --hard`、`git checkout --` 或其它会回滚未认领文件的操作。
- 不删除未确认来源的未跟踪文件。
- 提交前必须按本记录拆分范围，并重新运行对应验证命令。
- 任何不在“本轮认领范围”的文件，只能记录和隔离，不能顺手修改或回滚。

## 本轮认领范围

### 1. 跨栈模块 Registry parity

认领文件：

- `04-backend/agent-orchestrator/tests/test_modules.py`
- `04-backend/agent-orchestrator/src/architoken_agent/module_specs.py`
- `03-frontend/lib/module-registry.ts`
- `04-backend/harness-core/src/module_registry.rs`
- `02-architecture/MODULES.md`

治理结论：

- Python、frontend、Rust 的 active module id 顺序必须由 Registry/文档互证，不允许继续以硬编码 Enum 作为唯一来源。
- `MODULES.md` 中的模块名称也进入 Python registry parity 测试。

### 2. 数据智能体工作流与合约

认领文件：

- `04-backend/agent-orchestrator/src/architoken_agent/module_graph.py`
- `04-backend/agent-orchestrator/src/architoken_agent/state.py`
- `04-backend/agent-orchestrator/src/architoken_agent/inference.py`
- `04-backend/agent-orchestrator/src/architoken_agent/main.py`
- `04-backend/agent-orchestrator/src/architoken_agent/modules.py`
- `04-backend/agent-orchestrator/src/architoken_agent/tool_router.py`
- `04-backend/openapi.yaml`
- `03-frontend/lib/api.ts`
- `03-frontend/lib/api.test.ts`

治理结论：

- 工作流边界保持 `ToolRouter -> Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver`。
- `AgentResponse` 保留 `output_status`、`gates`、`tool_calls`、`tool_results`、`rag_chunks`、`tool_router_notes` 等结构化审计字段。
- AI 调用仍通过内部 router/adapter 抽象，不在业务逻辑中直接调用外部 vendor。

### 3. OpenAPI validator/codegen smoke

认领文件：

- `04-backend/agent-orchestrator/tests/test_openapi_contract.py`
- `04-backend/openapi.yaml`
- `08-sdk/openapitools.json`
- `08-sdk/smoke-openapi-contract.sh`
- `08-sdk/README.md`

治理结论：

- OpenAPI 3.1 schema、local `$ref`、`ModuleId` registry 边界、agent gate enum、SDK generator 配置均有测试覆盖。
- `08-sdk/smoke-openapi-contract.sh` 统一执行 Redocly lint 和临时 TypeScript SDK 生成。
- `ModuleId` 仍然是 Registry pattern，不允许回退成 OpenAPI enum。

### 4. 前端 E2E/视觉证据

认领文件：

- `03-frontend/playwright.config.ts`
- `03-frontend/tests/e2e/module-business-home.spec.ts`

治理结论：

- Playwright 增加自动 `webServer`，在未设置 `PLAYWRIGHT_BASE_URL` 时执行 `bun run dev`，并复用已有 3000 服务。
- 失败时保留截图和 trace。
- `digital_twin` 通过桌面和移动 compact 视口验证：统一 Open CDE shell、无全局顶部重复入口、业务面板可见、孪生 viewport/canvas 可见、关键几何不重叠，并附加截图证据。
- 设置中心数据库右键菜单测试改为真实用户路径：先选择非 PostgreSQL 资源，再在资源表行右键。

### 5. 前端 provider/theme/PanAI 边界

认领文件：

- `03-frontend/components/AICenterWorkbench.tsx`
- `03-frontend/lib/generation-client.ts`
- `03-frontend/lib/local-models-action.ts`
- `03-frontend/lib/ai-provider-router.test.ts`
- `03-frontend/lib/generation-client.test.ts`
- `03-frontend/lib/local-models-action.test.ts`
- `03-frontend/lib/theme-registry.ts`
- `03-frontend/lib/theme-registry.test.ts`
- `03-frontend/app/api/panai/host/route.ts`
- `03-frontend/app/api/panai/host/route.test.ts`
- `03-frontend/components/PanAIHostWindow.tsx`
- `03-frontend/lib/panai-native-url.ts`
- `03-frontend/lib/panai-native-url.test.ts`

治理结论：

- 浏览器侧不直接拉取外部 provider catalog。
- 前端生成调用使用内部模型别名和 router 边界，不转发用户 provider API key。
- `wechat_light` 保持默认主题。

## 不认领但必须隔离的变更桶

以下内容当前可见于工作树，但本记录不声明其全部语义归属。提交前必须单独确认来源：

- 基础设施与部署：`.gitignore`、`05-infra/docker/*`、`05-infra/systemd/panai-gateway.service`、`03-frontend/.dockerignore`、`04-backend/.dockerignore`、`05-infra/desktop/`。
- 工程文件和侧车 worker：`06-workers/*`、`docs/SKETCHUP_SKP_SIDECAR.md`、`docs/RHINO_3DM_IFC_SIDECAR.md`、`03-frontend/lib/skp-derivative-server*`、`03-frontend/lib/three-dm-derivative-server*`。
- 大量产品/架构文档：`docs/01_*`、`docs/03_*`、`docs/04_*`、`docs/05_*`、`docs/14_*`、`docs/ADAPTER_SOURCE_MAP.md`、`docs/ARCHITOKEN_PLATFORM_FUNCTIONAL_MAP.md`、`docs/FRONTEND_PANUI_STANDARD.md`、`docs/ARCHITOKEN_4A_AGENT_ARCHITECTURE_BLUEPRINT_2026.html`。
- 已删除文档：`docs/ARCHITOKEN_AIONUI_FORK_STRATEGY.md`。删除必须单独确认，不应被第 1/5/6/7 缺口提交顺带带走。
- 根目录散落未跟踪产物：`.mcp.json`、`BetterSqlite3Driver-BI766XRT.js`、`There`、`openapitools.json`。
- Host bridge 工具：`tools/panai_host_bridge_mcp.mjs`。若纳入提交，需单独说明 ArchIToken Host Bridge 的运行边界。

## 建议提交拆分

1. `agent-registry-workflow-contract`
   - 只包含 agent orchestrator registry/workflow、Python tests、OpenAPI agent response/gate schema。
2. `openapi-sdk-contract-smoke`
   - 只包含 `test_openapi_contract.py`、`openapi.yaml` 示例修正、`08-sdk/smoke-openapi-contract.sh`、`08-sdk/README.md`。
3. `frontend-provider-theme-boundary`
   - 只包含 AI Center provider/router、theme default、PanAI host route/window 相关文件和 tests。
4. `frontend-e2e-visual-workbench`
   - 只包含 `playwright.config.ts`、`module-business-home.spec.ts` 和与该测试直接相关的最小 UI selector 修正。
5. `infra-worker-sidecars`
   - 只在确认后包含 Docker/systemd、SKP/3DM worker、sidecar docs。
6. `worktree-governance`
   - 只包含本文件。

## 已验证命令

截至本记录创建时，以下命令已通过：

- `uv run pytest` in `04-backend/agent-orchestrator` - 19 passed。
- `uv run ruff check src tests` - passed。
- `npx --yes @redocly/cli@2.30.0 lint 04-backend/openapi.yaml` - valid, zero warnings。
- `08-sdk/smoke-openapi-contract.sh` - Redocly lint 和 TypeScript SDK 生成通过。
- `./node_modules/.bin/tsc --noEmit` in `03-frontend` - passed。
- `bun run test -- lib/api.test.ts lib/generation-client.test.ts lib/local-models-action.test.ts lib/theme-registry.test.ts lib/ai-provider-router.test.ts lib/panai-native-url.test.ts app/api/panai/host/route.test.ts components/ArchLoadingFlow.test.tsx` - 8 files, 25 passed。
- `bun run test -- components/OpenEngineeringEditor.test.ts` - 36 passed。
- `./node_modules/.bin/playwright test tests/e2e/module-business-home.spec.ts --reporter=line` - 21 passed。

需要在最终提交前再次确认的命令：

- 如提交 Rust 侧 registry 或 gateway 改动，运行 `cargo test -p architoken-harness-core`。
- 如提交 `06-workers` 或 `05-infra` 相关桶，单独运行对应 smoke，不要用上述 agent/frontend 验证替代。

## 后续检查清单

- 提交前执行 `git status --short`，确认每个文件进入对应提交桶。
- 对未跟踪根目录产物只做隔离记录，不随本轮架构缺口提交。
- 若需要清理未跟踪文件，必须先确认来源和用途。
- 若继续新增架构/工作流变更，同步更新本记录或创建后续治理记录。
