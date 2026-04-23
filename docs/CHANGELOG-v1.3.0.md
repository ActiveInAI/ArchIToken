# InsomeOS · CHANGELOG · v1.3.0 · 2026-04-23

文档 ID: IOS-CL-2026-005
作者: AIA
范围: Sprint 01 升级计划 · 从 2026-04-22 baseline 迁移到 2026-04-23 upgrade

---

## 1 · 本轮修正的认知错误 (Claude 之前 memory 里写错的版本号)

| 组件 | Claude 错写 | AIA 实际 | 来源 |
| --- | --- | --- | --- |
| PostgreSQL | 18.3 | 16.13 (baseline) / 17.6.0.066 (upgrade) | AIA 2026-04-23 链接 |
| pgvector | 0.8.3 | 0.8.2 | 仓库实况 |
| Valkey | 9.1.0 | 8-alpine (baseline) | 仓库实况 |
| Langfuse | v3.4 | v4.x (Py SDK 4.5.0 / JS SDK 5.0.1) | github.com/langfuse/langfuse/releases |
| Next.js | 16.2.4 | 16.2 (2026-03-18) | 无 16.2.4 tag |
| React | 19.2.5 | 19.2.1 / 19.2.2 | npmjs.com/package/react |
| TypeScript | 6.0.3 | 5.9.2 | github.com/microsoft/typescript/releases |
| Tailwind CSS | 4.2.5 | 4.1.13 | 4.2 尚未公开发布 |
| 项目名 | Pan.AEC | InsomeOS | AIA 明确纠正 |
| 符号使用 | § 符号 | 阿拉伯数字 + 中英文 | AIA 明确禁用 § |
| 许可证 | 只 Apache/MIT | Apache/MIT/BSD/MPL/PostgreSQL/ISC/Zlib | AIA 明确扩展 |

---

## 2 · AIA 2026-04-23 提供的 GitHub 链接 (升级目标)

以下 8 个链接全部为 Sprint 01 的升级目标,已写入 `versions.toml` 的 `[data_upgrade.*]` 段。

1. https://github.com/apache/iceberg/releases/tag/apache-iceberg-1.10.1
   → Apache Iceberg **1.10.1** · Apache-2.0 · 湖仓

2. https://github.com/supabase/supabase/releases/tag/v1.26.04
   → Supabase 单仓 **v1.26.04** · Apache-2.0

3. https://github.com/supabase/postgres/releases/tag/17.6.0.066-disk-no-fail-sam-2
   → supabase/postgres **17.6.0.066-disk-no-fail-sam-2** · PostgreSQL
   → 从 baseline 的 pg16.13 升级到 PG 17.6.0 + Supabase 扩展集

4. https://github.com/supabase/supabase-js/releases/tag/v2.104.0
   → supabase-js **v2.104.0** · MIT · Next.js 16.2 前端 client

5. https://github.com/supabase/realtime/releases/tag/v2.86.3
   → supabase/realtime **v2.86.3** · Apache-2.0 · Elixir · WebSocket broker

6. https://github.com/supabase/auth/releases/tag/v2.188.1
   → supabase/auth (GoTrue) **v2.188.1** · Apache-2.0

7. https://github.com/supabase/postgres-meta/releases/tag/v0.96.4
   → supabase/postgres-meta **v0.96.4** · Apache-2.0

(第 8 个 supabase/supabase v1.26.04 在用户消息里重复,已并入 2)

---

## 3 · Sprint 01 升级步骤 (用户在 Zed 里走 Claude Code 流程)

### 阶段 A · 数据层升级 (D1–D3)

```bash
# 1. 停 baseline postgres
cd ~/dev/insomeos/05-infra/k8s-manifests
kubectl delete -f postgres.yaml

# 2. 切 Supabase 全家桶 (v1.26.04)
#    本地走 supabase/docker compose · 不再用独立 pgvector:pg16 镜像
git clone https://github.com/supabase/supabase.git supabase-vendor \
  --depth 1 --branch v1.26.04
cd supabase-vendor/docker
cp .env.example .env
#    编辑 .env·设置 POSTGRES_VERSION=17.6.0.066-disk-no-fail-sam-2
docker compose pull
docker compose up -d

# 3. 验证
docker exec -it supabase-db psql -U postgres -c "SELECT version();"
#    期望: PostgreSQL 17.6 on aarch64-unknown-linux-gnu
docker exec -it supabase-db psql -U postgres -c "\dx"
#    期望扩展: vector · pg_trgm · pgcrypto · uuid-ossp · btree_gin · plpgsql

# 4. 跑 pgTAP 基础断言 (确保 RLS · 迁移能跑)
cd ~/dev/insomeos/04-backend
sqlx database create
sqlx migrate run
pg_prove -d postgresql://postgres:postgres@localhost:5433/insomeos migrations/*.sql
```

### 阶段 B · Iceberg 引入 (D4–D5)

```bash
# Iceberg 1.10.1 作为湖仓规范 · Phase 1 启用
#    Sprint 01 仅做目录结构预留·不实际启动 Trino
mkdir -p ~/dev/insomeos/05-infra/iceberg
cat > ~/dev/insomeos/05-infra/iceberg/VERSION.md <<'EOF'
Apache Iceberg 1.10.1
Released: Q1 2026
License: Apache-2.0
Release URL: https://github.com/apache/iceberg/releases/tag/apache-iceberg-1.10.1
Use: lakehouse format spec · deferred to Sprint 03 (Phase 1)
Upstream from: Debezium 3.2 CDC writes
Query engine: Trino (future)
EOF
```

### 阶段 C · 前端 client 升级 (D6)

```bash
cd ~/dev/insomeos/03-frontend
bun add @supabase/supabase-js@2.104.0 --exact
#    写入 package.json dependencies 完全锁定
bun run typecheck
bun run test
```

### 阶段 D · Langfuse 重新部署 (D7)

```bash
# 之前错误地写了 v3.4 · 实际 Langfuse 主线到 v4
# 使用官方 Helm chart 3.167.4 · 对应 langfuse 应用 v4
helm repo add langfuse https://langfuse.github.io/langfuse-k8s
helm repo update
helm install langfuse langfuse/langfuse --version 3.167.4 \
  -n insomeos-obs --create-namespace \
  --set postgres.enabled=false \
  --set postgres.external.host=supabase-db \
  --set postgres.external.port=5432

# Python SDK 锁定
cd ~/dev/insomeos/04-backend/agent-orchestrator
uv add "langfuse==4.5.0" --exact

# JS SDK 锁定 (前端使用)
cd ~/dev/insomeos/03-frontend
bun add langfuse@5.0.1 --exact
```

### 阶段 E · Cargo.toml 已修 (2026-04-22 完成)

22 个依赖已从虚构版本修正到 crates.io 真实稳定版。
`cargo check --workspace` 应该通过。

若发现 `core2` 相关死锁 (csgrs 0.20.x 链式依赖),
执行 ADR-0017:从 `file-parsers` 删除 csgrs 依赖。

---

## 4 · 待 AIA 继续贴链接的组件 (still to verify)

我已搜集到的链接都写进 `versions.toml`,但以下组件仍需 AIA 确认或新链接:

- `utoo` · Sprint 01 D1 本机 `ut --version` 写回
- `Tauri` · 2.5.0 (待 AIA 确认是否选用桌面壳)
- `OCCT` · 几何内核版本 (7.9?待链接)
- `IfcOpenShell` · Python fallback 版本 (待链接)
- `Three.js` / `wgpu` · 前端 3D 版本 (待链接)
- `Apache AGE` 具体 tag (当前写 1.5.0)
- `pgmq` 官方 tembo-io tag (当前写 1.12.0)
- `SeaweedFS` 具体 tag (当前写 4.21)
- `Meilisearch` 具体 tag (当前写 1.43.0)
- `Debezium` 具体 tag (当前写 3.2)
- `Materialize` 具体 tag (当前写 0.152)
- `Kubernetes` / `ArgoCD` / `Istio` 具体 patch

**如果 AIA 手头有这些的 GitHub tag 链接,贴过来我直接写回 versions.toml。**

---

## 5 · 宪法 (Article 2) 的落地承诺

从本 CHANGELOG 起,以下三个文件之间的数据必须对齐,任何不对齐都是 CI 错误:

1. `versions.toml` · 单一事实源
2. `Cargo.toml` / `package.json` / `pyproject.toml` · 实际语言清单
3. `CHANGELOG-v1.3.0.md` · 本文件 · 记录每次版本迁移的原因

对齐检查由 `scripts/check-versions.py` 完成,`just versions-check` 本地跑,
`.github/workflows/versions-check.yml` 每周一 03:00 UTC cron 自动执行。

---

## 6 · 给 Claude Code 的工作指令 (AIA 在 Zed 里使用)

AIA 在 Zed 编辑器里通过 Claude Code 干活。未来 Claude 生成任何涉及版本号的
代码或配置,必须:

1. 先读 `versions.toml` 作为唯一真相
2. 禁止使用 `^`、`~`、`*`、`latest` 这些范围运算符
3. 禁止使用训练数据里的"记忆版本",一律以 `versions.toml` 为准
4. 如 `versions.toml` 里没有该组件,先开 issue/TODO 让 AIA 补 GitHub 链接,
   不要凭记忆编造
5. 输出 Cargo.toml / package.json / Dockerfile 时,版本号必须与
   `versions.toml` 的 `current` 字段完全一致
