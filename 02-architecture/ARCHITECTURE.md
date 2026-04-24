# InsomeOS · 全栈架构规范 v2.0

**文档编号**: INSOMEOS-ARCH-V2.0-FINAL  
**定稿日期**: 2026-04-19  
**2026-04-23 修正**: 业务阶段模型由 "9 phases enum" 重构为 **"11 modules registry"**. 所有业务流程图、时序图均按 11 模块顺序重绘; `settings_center` 标为 side-car. 详细规范见 [`MODULES.md`](./MODULES.md) · 注册机制见 [`MODULE-REGISTRY.md`](./MODULE-REGISTRY.md).
**2026-04-24 扩展**: ArchIToken 数字孪生、openBIM、CAD kernel、SCADA、PDF 与多模态生成参考库进入开源技术雷达, 见 [`OPEN_SOURCE_RADAR.md`](./OPEN_SOURCE_RADAR.md).
**基础**: Harness Engineering 哲学 + 2026-04 实时 GitHub 版本核验

---

## 架构核心决策 (v2.0 相对 v1.x 的修正)

| 项 | v1.x (已废弃) | v2.0 (定稿) | 理由 |
|----|--------------|-------------|------|
| 前端 | React + Vue 双轨并列 | **React 单路径** (Next.js 16.2.4) | OPC 工时 × 2 不可持续; Vue 降级为"未来适配层"战略预留 |
| 主后端语言 | Rust + Python 平行 | **Rust 主 + Python 仅用于 LangGraph** | 50+ 文件格式并行解析必须 Rust |
| 数据库 | 自拼 PG + Redis + MinIO | **Supabase 全家桶 1.26.04** | OPC 时间是最贵资源 |
| Redis | Redis 7+ (SSPL) | **Valkey 9.0.3** (BSD-3 · v2.0 目标 · baseline 实装 8-alpine) | 许可证合规硬红线 |
| 推理引擎 | 单一 vLLM | **6 路热插拔** | Harness 哲学: 可替换优于最优 |
| 容器 | Docker Compose | **Kubernetes 1.35.4 + Rainbond 6.7.1** | 租户模板编译期隔离 |

---

## 1. 八层架构 (自底向上)

```
┌───────────────────────────────────────────────────────────────┐
│ L7 · Consumer Surfaces   │ Next.js 16.2.4 + React 19.2.5 PWA  │
│                          │ + React Native 0.85.1 (移动)       │
│                          │ + Tauri 2.10.1 (桌面 · 实验性)     │
├───────────────────────────────────────────────────────────────┤
│ L6 · Auto-Generated SDK  │ OpenAPI 3.1 → TS/Python/Rust/Go    │
│                          │ /Java/Swift/Kotlin (7 语言)        │
├───────────────────────────────────────────────────────────────┤
│ L5 · Unified API Gateway │ axum 0.8.9 (REST+SSE) +            │
│                          │ tonic 0.14.5 (gRPC) + MCP Server   │
├───────────────────────────────────────────────────────────────┤
│ L4 · Agent Orchestration │ LangGraph 1.1.8 (Python · 主)      │
│                          │ + VoltAgent 2.0.7 (TS · 前端直连)  │
├───────────────────────────────────────────────────────────────┤
│ L3 · Harness Core (Rust) │ Rust 1.95.0 + tokio + sea-orm      │
│                          │ 2.0.0-rc.38 + utoipa 5.4.0         │
├───────────────────────────────────────────────────────────────┤
│ L2 · Inference Engines   │ 6 路并列热插拔 (全 OpenAI 兼容)     │
│                          │ vLLM 0.19.1 / SGLang 0.5.10.post1  │
│                          │ / TensorRT-LLM 1.2.0 / LMDeploy    │
│                          │ 0.12.3 / Ollama 0.21.0 / llama.cpp │
│                          │ b8840                              │
├───────────────────────────────────────────────────────────────┤
│ L1 · Compute Frameworks  │ PyTorch 2.11.0 + TensorRT-LLM      │
│                          │ 1.2.0 + JAX 0.10.0 + Flax 0.12.6   │
│                          │ + Triton 3.6.0 + TensorRT 10.16    │
├───────────────────────────────────────────────────────────────┤
│ L0b · PaaS Layer         │ Rainbond 6.7.1 (应用编排, 中文)    │
│                          │                                    │
│ L0a · Orchestration      │ Kubernetes 1.35.4 + Cilium 1.19.3  │
│                          │ + containerd 2.2.3                 │
│                          │                                    │
│ L0  · Hardware Baseline  │ 2 × NVIDIA DGX Spark (GB10)        │
│                          │ ConnectX-7 @ 200GbE                │
│                          │ 256 GB 统一内存池                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. 精确版本清单 (全部 2026-04 GitHub 实时核验)

### 2.1 L0 硬件层

| 项 | 规格 | 备注 |
|----|------|------|
| GPU/SoC | NVIDIA DGX Spark × 2 (GB10 Grace-Blackwell) | SM_121, 每台 128 GB 统一内存 |
| 互联 | ConnectX-7 QSFP DAC 200 GbE | MTU 9000, 静态 IP 192.168.100.0/24 |
| 存储 | NVMe 4 TB × 2 (本地) + S3 兼容对象存储 | Ceph 或 MinIO (MinIO 已改 AGPL,避免) |
| OS | Ubuntu Server 24.04 LTS | HWE kernel for GB10 |

### 2.2 L0a / L0b 编排与 PaaS

| 组件 | 版本 | 提交/日期 | 许可 | 源 |
|------|------|-----------|------|-----|
| kubernetes/kubernetes | **v1.35.4** | 2026-04-15 · `7b8c6cf` | Apache-2.0 | github.com/kubernetes/kubernetes |
| cilium/cilium | **v1.19.3** | 2026-04-15 · `f5eb641` | Apache-2.0 | github.com/cilium/cilium |
| cilium/cilium-cli | **v0.19.2** | 2026-04 | Apache-2.0 | github.com/cilium/cilium-cli |
| containerd/containerd | **v2.2.3** | 2026-04 | Apache-2.0 | github.com/containerd/containerd |
| goodrain/rainbond | **v6.7.1-release** | 2026-04-13 · `025fad9` ✓GPG | Apache-2.0 | github.com/goodrain/rainbond |

### 2.3 L1 计算框架

| 组件 | 版本 | 提交/日期 | 许可 |
|------|------|-----------|------|
| pytorch/pytorch | **v2.11.0** | 2026-03-23 | BSD-3 |
| NVIDIA/TensorRT-LLM | **v1.2.0** | 2026-03-12 · `51f5ef3` ✓GPG | Apache-2.0 |
| NVIDIA/TensorRT | **v10.16** | 2026-03-25 · `52399f5` ✓GPG | Apache-2.0 |
| onnx/onnx-tensorrt | **release/10.16-GA** | 2026-03-25 · `6bde659` ✓GPG | Apache-2.0 |
| pytorch/TensorRT (Torch-TRT) | **v2.11.0** | 2026-04-07 · `0cc00aa` ✓GPG | BSD-3 |
| triton-lang/triton | **v3.6.0** | 2026-01-21 · `7c56a5e` ✓GPG | MIT |
| jax-ml/jax | **v0.10.0** | 2026-04-16 | Apache-2.0 |
| google/flax | **v0.12.6** | 2026-03-20 · `1572c84` | Apache-2.0 |
| onnx/onnx | **v1.21.0** | 2026 | Apache-2.0 |
| microsoft/onnxruntime | **v1.24.4** | 2026-03-17 · `2d92497` ✓GPG | MIT |

### 2.4 L2 推理引擎 (6 路并列)

| 组件 | 版本 | 提交/日期 | 许可 | 角色 |
|------|------|-----------|------|------|
| vllm-project/vllm | **v0.19.1** | 2026-04-18 · `b1388b1` | Apache-2.0 | 通用高吞吐 (默认) |
| sgl-project/sglang | **v0.5.10.post1** | 2026-04 | Apache-2.0 | 复杂 Agent 编排 |
| NVIDIA/TensorRT-LLM | **v1.2.0** | (同 L1) | Apache-2.0 | DGX Spark 极致性能 |
| InternLM/lmdeploy | **v0.12.3** | 2026-04-08 · `8ea459f` ✓GPG | Apache-2.0 | 国产模型 (Qwen3.5/GLM4.7) |
| ollama/ollama | **v0.21.0** | 2026-04-16 · `57653b8` ✓GPG | MIT | 开发本地迭代 |
| ggml-org/llama.cpp | **b8840** | 2026-04-18 · `9e5647a` ✓GPG | MIT | 边缘/CPU 兜底 |

附加:
- huggingface/huggingface_hub **v1.11.0** (Apache-2.0)
- huggingface/huggingface.js `ollama-utils-v0.0.18`
- NVIDIA/k8s-nim-operator **v3.1.0** (Apache-2.0)
- NVIDIA-AI-Blueprints/rag **v2.5.0**
- Comfy-Org/ComfyUI **v0.19.3** (⚠️ GPL-3.0 · 强制外部服务)
- Comfy-Org/comfy-cli **v1.7.2**
- Comfy-Org/ComfyUI_frontend **v1.44.4**
- buildingSMART/validate **v0.8.3** (MIT, IFC 官方验证器)

### 2.5 L3 Harness 核心 (Rust)

| 组件 | 版本 | 许可 | 用途 |
|------|------|------|------|
| rust-lang/rust | **1.95.0** | MIT/Apache-2.0 | 编译器 (2026-04-16 · cfg_select!, if-let guards) |
| rust-lang/rustup | **1.29.0** | MIT/Apache-2.0 | 工具链管理 |
| rust-lang/cargo | **0.96.0** | MIT/Apache-2.0 | 包管理 |
| rust-lang/cc-rs | **cc-v1.2.60** | MIT/Apache-2.0 | C 绑定构建 |
| tokio-rs/axum | **v0.8.9** | MIT | HTTP 服务 (2026-04-14 · `c59208c`) |
| hyperium/tonic | **v0.14.5** | MIT | gRPC 服务 |
| juhaku/utoipa | **utoipa-5.4.0** | MIT/Apache-2.0 | OpenAPI 生成 |
| SeaQL/sea-orm | **2.0.0-rc.38** | MIT/Apache-2.0 | 异步 ORM |
| SeaQL/sea-query | **1.0.0-rc.33** | MIT/Apache-2.0 | 查询构造器 |
| SeaQL/sea-schema | **0.16.2** | MIT/Apache-2.0 | Schema 反射 |
| SeaQL/seaography | **1.1.4** | MIT/Apache-2.0 | GraphQL 自动生成 |
| SeaQL/sea-streamer | **0.5.2** | MIT/Apache-2.0 | 流处理 |
| SeaQL/FireDBG.for.Rust | **1.81.0** | MIT/Apache-2.0 | 时间旅行调试 |
| launchbadge/sqlx | **v0.8.6** | MIT/Apache-2.0 | 编译期 SQL 宏 (热路径) |

### 2.6 L3 AEC 文件格式解析 Rust Crate

| Crate | 版本 | 用途 |
|-------|------|------|
| **acadrust** | 0.3.4 | 纯 Rust DWG + DXF ASCII/Binary |
| **dxf** | 0.6.1 | 成熟 DXF 库 (备选) |
| **ifc-lite-core** | 2.1.9 | 高性能 IFC/STEP 解析 |
| **ifc-lite-wasm** | 2.1.8 | 浏览器端 WebAssembly |
| **ifc-lite-geometry** | 2.1.8 | IFC 几何处理 |
| **bimifc-parser** | 0.2.0 | IFC4 STEP + IFC5 IFCX |
| **avila-tesselation** | 0.1.0 | IFC → 三角网格 (100% Rust) |
| **avila-mesh** | 0.1.0 | 网格结构 |
| **fj** (Fornjot) | 0.49.0 | B-rep CAD 内核 |
| **cadk** | 0.1.0 | B-Rep + CSG |
| **csgrs** | 0.20.1 | CSG on BSP tree |
| **pdf_oxide** | 0.3.34 | 最快 Rust PDF (3830 PDF 100% 通过率) |
| **fullbleed** | 0.6.11 | HTML/CSS → PDF 确定性渲染 |
| **lopdf** | 0.40.0 | PDF 底层操作 |
| **quick-xml** | 0.39.2 | 高性能 XML |
| **xsd-parser** | 1.5.2 | XSD Schema 解析 |
| **tree-sitter-ifc** | 0.1.0 | IFC STEP 树解析 |
| **dxf-tools-rs** | 0.1.3 | DXF 工具集 |
| **dxf2image** | 0.1.1 | DXF 预览 |

**Revit .rvt 策略**: Rust 生态无成熟解析器,通过 Autodesk IFC Exporter 插件桥接。

### 2.7 L4 Agent 编排

| 组件 | 版本 | 提交/日期 | 许可 |
|------|------|-----------|------|
| langchain-ai/langgraph | **1.1.8** | 2026-04-17 · `4956134` ✓GPG | MIT |
| VoltAgent/voltagent | **@voltagent/server-elysia@2.0.7** | 2026-04-11 · `9d5ed63` ✓GPG | MIT |
| **Python 运行时** | 3.14 | — | PSF |
| **uv** (包管理) | 0.5.x | — | MIT/Apache-2.0 |

### 2.8 L6 SDK 生成

- OpenAPI Specification 3.1
- openapi-generator 7.x (Apache-2.0)
- 自动生成 7 语言:TypeScript (via utoipa-typescript) / Python / Rust (同仓) / Go / Java / Swift / Kotlin

### 2.9 L7 前端 (React 单路径)

| 组件 | 版本 | 许可 | 角色 |
|------|------|------|------|
| facebook/react | **v19.2.5** | MIT | UI 核心 |
| vercel/next.js | **v16.2.4** | MIT | SSR/RSC 框架 |
| facebook/react-native | **v0.85.1** | MIT | 移动端 |
| microsoft/TypeScript | **v6.0.3** | Apache-2.0 | 类型系统 |
| oven-sh/bun | **bun-v1.3.13** | MIT | 运行时 |
| utooland/utoo | **utoo-v1.0.27** | MIT | 包管理 (国产化) |
| vitejs/vite | **v8.0.8** | MIT | 构建 (RN/独立包) |
| vitejs/vite-plugin-react | **plugin-rsc@0.5.24** | MIT | React RSC 插件 |
| tailwindlabs/tailwindcss | **v4.2.4** | MIT | 样式系统 |
| pmndrs/zustand | **v5.0.12** | MIT | 客户端状态 |
| TanStack/query | **react-query 5.99.1** | MIT | 服务端状态 |
| d3/d3 | **v7.9.0** | ISC | 2D 数据可视化 |
| mrdoob/three.js | **r184** | MIT | 3D/BIM 可视化 (WebGPU 动态光) |
| tauri-apps/tauri | **tauri-cli-v2.10.1** | MIT/Apache-2.0 | 桌面壳 (⚠️ Linux 实验) |
| vercel/turborepo | **v2.9.6** | MIT | Monorepo 编排 |
| vercel/ai | **@ai-sdk/amazon-bedrock@3.0.97** | Apache-2.0 | AI SDK (前端桥) |
| nodejs/node | **v25.9.0** | MIT | Node 兼容性 |

**已移除** (相对 v1.x):
- ❌ vuejs/core v3.5.32 (战略预留,非当前交付)
- ❌ vuejs/pinia, vue-router, devtools, create-vue, vite-plugin-vue

### 2.10 数据层

| 组件 | 版本 | 提交/日期 | 许可 |
|------|------|-----------|------|
| supabase/supabase | **v1.26.04** | 2026-04-09 · `152d36b` ✓GPG | Apache-2.0 |
| supabase/postgres | **17.6.0** (upgrade target · baseline 16.13) | 2026-04 | PostgreSQL License |
| supabase/realtime | **v2.85.2** | 2026-04 | Apache-2.0 |
| supabase/postgres-meta | **v0.96.4** | 2026-04 | Apache-2.0 |
| supabase/auth | **v2.188.1** | 2026-04 | Apache-2.0 |
| supabase/edge-runtime | **v1.73.7** | 2026-04 | MIT |
| supabase/supavisor | **v2.8.0** | 2026-04 | Apache-2.0 |
| supabase/supabase-js | **v2.103.3** | 2026-04 | MIT |
| valkey-io/valkey | **9.0.3** (target · baseline 8-alpine) | 2026-04 | BSD-3 |

### 2.11 .NET / 其他

- microsoft/agent-framework **dotnet-1.1.0** (MIT, 可选 .NET Agent 接入)
- rustdesk/rustdesk **1.4.6** (AGPL-3.0 ⚠️, 仅作为独立远程工具,不进入 InsomeOS)
- jmoiron/sqlx **v1.4.0** (MIT, Go 语言 SDK 客户端可用)

---

## 3. 关键架构原则

### 3.1 依赖方向 (CI 强制单向)

```
L0 ← L0a ← L0b ← L1 ← L2 ← L3 ← L4 ← L5 ← L6 ← L7
```

- 任何反向调用 = CI 拒绝合并
- 实现: cargo workspace 拓扑校验 + import linter

### 3.2 数据流 (请求生命周期示例)

```
用户输入 "帮我看看这个户型合不合规" + 上传 .dwg
    │
    ▼
L7 Next.js 前端 (React Server Component 生成初始页面)
    │
    ▼ HTTP POST /v1/harness/invoke (REST)
L5 axum 0.8.9 网关 (鉴权 + 限流 + 审计)
    │
    ▼ gRPC
L4 LangGraph 规划师 Agent (任务拆解)
    │   ├── 子任务 1: DWG 解析 → L3 Rust (acadrust 0.3.4)
    │   ├── 子任务 2: 规范 RAG → L3 sea-orm 2.0.0-rc.38 → Supabase pg
    │   └── 子任务 3: LLM 审查 → L2 vLLM 0.19.1 (主) / SGLang (备)
    │
    ▼
L4 LangGraph 生成器 Agent (合规报告生成)
    │
    ▼
L4 LangGraph 评估器 Agent (独立模型复查)
    │
    ▼ SSE 流式返回
L7 前端 (合规报告 + 整改清单 Markdown 渲染)
```

### 3.3 11 模块注册图 (替换原 9 阶段业务流程)

**设计原则**: 所有模块完全并列 · 运行时注册 · 不用 enum · 未来可增删.
时序只是 UI 默认排序 (order 1-11), 不是强依赖; 任何模块都可独立被调用.

```
                             ┌──────────────────────────────────────┐
                             │   settings_center (order 11)         │
                             │   side-car · 并列但无上下游          │
                             │   全局配置: tenants/RBAC/SLA/模型路由 │
                             └────────────────┬─────────────────────┘
                                              │ (全局引用)
                                              ▼
                             ┌──────────────────────────────────────┐
                             │   standard_library (order 3)         │
                             │   全局共享 · 构件 / 规范 / 材料库     │
                             │   被多模块 "引用"(不是 "链接")       │
                             └────────────────┬─────────────────────┘
                                              │ (被引用)
      ┌───────────────────────────────────────┴───────────────────────────────┐
      │                                                                       │
      ▼                                                                       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ marketing_   │    │ concept_     │    │ detailed_    │    │ quantity_    │
│ service (1)  │──▶ │ design (2)   │──▶ │ design (4)   │──▶ │ costing (5)  │
└──────────────┘    └──────────────┘    └──────┬───────┘    └──────┬───────┘
                                               │                   │
                          ┌────────────────────┴───┐               │
                          ▼                        ▼               ▼
                    ┌──────────────┐        ┌──────────────┐ ┌──────────────┐
                    │ manufacturing│        │ material_    │◀┤  (BOM/BOQ)   │
                    │      (7)     │        │ logistics (6)│ └──────────────┘
                    └──────┬───────┘        └──────┬───────┘
                           │                       │
                           └───────────┬───────────┘
                                       ▼
                           ┌──────────────────────┐
                           │ construction_        │
                           │ supervision (8)      │  ← 合并原 construction + acceptance
                           └──────────┬───────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
                 ┌──────────────┐           ┌──────────────┐
                 │ digital_     │           │ digital_     │
                 │ twin (9)     │──────────▶│ archive (10) │
                 └──────────────┘           └──────────────┘
                   实时运维                    长期留存
```

**读图要点**:
- 箭头表示 "典型工件流",不表示 "必须串行"。模块独立可调。
- `standard_library` 与 `settings_center` 不参与工作流串接,分别作为 "全局引用资源" 与 "全局配置 side-car"。
- 任何层都从 `modules` 表 / `ModuleRegistry` 拉列表,不存在硬编码的 9-phase 常量。
- 加一个模块 = SQL 注册 + Rust 一行 `r.register(...)` + Python 一条 dict entry + (可选) prompt 目录; 不改任何已有代码。

### 3.4 容错与回滚

- RollbackGuard: 模型调用失败或延迟超 SLA 120%, 自动切换备选模型
- 超时 SLA (宪法 §8):
  - 文生图: 60s
  - 图生 3D: 90s
  - 文生 3D: 180s
  - 合规审查: 180s
- 全链路追踪: OpenTelemetry → Jaeger

---

## 4. 许可证硬红线

宪法 §3 明令:

**允许** (宽松):
- Apache-2.0 · MIT · BSD-3 / BSD-2 · ISC · MPL-2.0 · CC0

**禁止** (进入分发边界):
- AGPL-3.0 / LGPL-3.0 / GPL-3.0 / GPL-2.0
- SSPL-1.0 / Commons Clause
- 任何 "Business Source License" / "Server Side License"

**外部服务例外** (独立进程, 禁止源码合并):
- ComfyUI (GPL-3.0) — 仅通过 HTTP API 调用

CI 实现: `cargo-deny` + `license-checker` (npm) + `pip-licenses`

---

## 5. 观测与运维

| 层次 | 工具 | 版本 |
|------|------|------|
| Metrics | Prometheus + Grafana | latest stable |
| Tracing | OpenTelemetry + Jaeger | otel-rust 0.27 |
| Logging | Vector + Loki | Vector 0.46 |
| APM | Sentry (自托管) | 24.x |
| Alert | AlertManager + 企业微信/Slack webhook | latest |

---

## 6. 部署拓扑

```
                    [Cloudflare / 国内CDN]
                            │
                    [HAProxy / Caddy 入口]
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
     [K8s Ingress]     [K8s Ingress]     [K8s Ingress]
      (Spark-A)          (Spark-B)         (CPU Node)
          │                 │                 │
       L2-L5              L2-L5           L6-L7 静态
       AI 重负载           AI 重负载        SDK/前端
          │                 │                 │
          └────────┬────────┴────────┬────────┘
                   │                 │
           [Supabase 集群]    [MinIO/Ceph S3]
           (PostgreSQL 17)    (对象存储)
                   │
              [Valkey 9.0.3*]
              (缓存/会话 · *v2.0 目标 · baseline 8-alpine)
```

---

## 7. 开发工作流 (GitOps)

1. 功能分支 → PR → CI 运行:
   - `cargo fmt --check` + `cargo clippy -D warnings`
   - `cargo deny check` (许可证 + 漏洞)
   - `cargo test` + `cargo nextest`
   - `pnpm lint` + `pnpm typecheck` + `pnpm test`
   - `pytest` (Python Agent)
   - E2E (Playwright) 关键路径
   - OpenAPI 规范 diff 检查
2. 合并 main → 自动部署 staging (Rainbond 模板)
3. 手动 approve → 部署 production

---

## 8. 演进路径

- v2.0 (当前, 2026-04-19): React 单前端 + 6 路推理
- v2.1 (2026 Q3): Vue 战略适配层 (如刚性客户需求)
- v2.2 (2026 Q4): 国际规范库 (IBC + Eurocode)
- v3.0 (2027): 联邦学习 (跨项目知识共享, 不传原始数据)

---

**文档终**
