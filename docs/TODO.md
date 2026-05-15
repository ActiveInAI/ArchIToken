# TODO · 发现的待补项 · 2026-04-23

## 缺失的工具链配置 (非紧急 · 但 Sprint 01 完成前需补)

### 1. Playwright 配置缺失
- 状态: 已完成 · E2E 已迁到 `03-frontend/tests/e2e/`,并由 `03-frontend/playwright.config.ts` 接入 `bun run test:e2e`。

### 2. Justfile 缺失
- 现状: AGENTS.md 和 versions.toml meta 提到 `just versions-check`
- 后果: 版本漂移自动巡检当前无入口
- 需要: 在仓库根建 Justfile · 至少包含 versions-check · cargo-check · typecheck · test 几个 target
- 影响: 宪法 Article 2 的 CI 自动化部分

### 3. scripts/check-versions.py 待验证
- 现状: 若存在则好 · 不存在需补
- 验证: ls ~/dev/architoken/scripts/
- 如不存在 · 本 TODO 再追加一条

### 3.1 scripts/ 目录已验证不存在 (2026-04-23)
- 现状: `ls ~/dev/architoken/scripts/` 返回 "没有那个文件或目录"
- 后果: `scripts/check-versions.py` 确认缺失 · `just versions-check` 和 `.github/workflows/versions-check.yml` 的核心逻辑无处可跑
- 需要:
  - 创建 `scripts/` 目录
  - 新建 `scripts/check-versions.py` · 读取 `versions.toml` 的所有 `check_url` · 调 GitHub API 比对 `current` vs 最新 release · 超过 `stale_after_days=14` 则 warn · `stale_hard_days=30` 则 fail
  - 新建 `.github/workflows/versions-check.yml` · cron `0 3 * * 1` (每周一 03:00 UTC)
- 依赖: 先完成第 2 项 Justfile · 再把 `just versions-check` 指向此脚本
- 影响: 宪法 Article 2 的单一事实源自动巡检 · 当前完全缺位

---

## 4. K8s 集群恢复 (Sprint 02 目标)

状态: 暂搁 · 2026-04-23
现状:
- Spark-A (192.168.100.1 · control-plane) 离线 · kubectl API 不可达
- Spark-B (192.168.100.2 · worker) kubelet 正常运行
- Stage 2C commits (2f67dcd / cb0145d) 的 postgres-0 · valkey-0
  StatefulSet 数据在 spark02 local-path PV 里 · 一恢复就能起

Sprint 01 期间: 全走 docker-compose (05-infra/docker/compose.data.yml) ·
                不依赖 K8s · 所有 K8s yaml 保留原位。

Sprint 02 恢复步骤 (估 1 工作日):
1. 物理开机 Spark-A (192.168.100.1)
2. 验证 LAN 192.168.100.0/24 恢复 MTU 9000 QSFP DAC 连通
3. SSH spark01 · systemctl status kube-apiserver kubelet containerd
4. kubectl cluster-info · kubectl get nodes 应两节点都 Ready
5. kubectl get pods -A · 确认 postgres-0 · valkey-0 自动恢复
6. 跑一次 pg_prove + valkey-cli PING 验 Stage 2C 完整性
7. 如 PV 数据丢失 · 从 docker-compose 栈 pg_dump → restore 到 K8s

依赖:
- Spark-A 物理访问(AIA 动作)
- /etc/hosts 和 DNS 优先级审查(Tailscale MagicDNS vs LAN)
- 本 TODO 完成后 · kubectl 可用 · Sprint 02 才能做 K8s 迁移或 Istio 启用

---

## 5. Cargo.toml ↔ versions.toml 冲突项

状态:登记 · 等 AIA 决策 · 2026-04-23

### 5.1 csgrs 悬挂锁定
- Cargo.toml workspace.dependencies:csgrs = "=0.20.1"
- versions.toml L508-510:标注 REMOVED (ADR-0017 · core2 yanked 死锁)
- file-parsers/Cargo.toml:实际未用 csgrs(属悬挂锁定)

AIA 决策选项:
(a) 删 Cargo.toml workspace 的 csgrs 锁 · 同步 ADR-0017
(b) 撤销 ADR-0017 · csgrs 重新入 versions.toml
(c) 新增 [rust.csgrs_pinned] 记录过渡态

Phase B1 暂跳过 csgrs · 补录 29/30 包。

### 5.2 6 个 dormant 依赖 (workspace 声明未进 Cargo.lock)
- prost-types · quickcheck · tonic-build · tree-sitter-ifc · xsd-parser · csgrs
- 已在 versions.toml 补录 (除 csgrs) 并 notes 标注 dormant
- 未来若长期未激活 · 可另立 ADR 从 workspace.dependencies 清理

---

## 7. 前端依赖升级待办 (package.json 滞后 versions.toml 权威)

状态: 登记 · 2026-04-23 · 等 AIA 授权升级

AIA 2026-04-23 贴 GitHub 权威 tag:
- TypeScript v6.0.3 (https://github.com/microsoft/TypeScript/releases/tag/v6.0.3)
- Tailwind v4.2.4 (https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.4)

当前 package.json 实装:
- typescript: 5.9.3 (滞后 1 minor)
- tailwindcss: 4.2.2 (滞后 2 patch)

原因: npm registry 滞后于 GitHub release · Bun 从 npm 解析 · 所以 bun.lock 滞后。

AIA 决策待定:
(a) 等 npm registry 同步 · 届时 bun update 自然对齐 · 不手动
(b) 用 `bun add typescript@6.0.3 tailwindcss@4.2.4` 强制升 · 可能走 GitHub install (bun 支持 git+ssh 源) · 或 pkg.pr.new
(c) 临时保持 · versions.toml 记录 AIA 权威 · package.json 暂滞后 · 等自然对齐

Phase B4 开始前由 AIA 决策。

---

## 6. Phase B2 未补录的前端依赖清单 (待 B5 批量补)

状态: 登记 · 2026-04-23 · 非阻塞
范围: 03-frontend/package.json 里除 three 生态 3 包 + @types/* 5 包
      以外的 43 个包 · Phase B2 已改为 exact pin 但**未录入 versions.toml**

43 包分类(按 package.json 顺序):

**Next.js / React 核心** (4):
- next · react · react-dom · eslint-config-next

**状态管理 / 数据获取** (3):
- @tanstack/react-query · zustand · @supabase/supabase-js · @supabase/ssr

**验证 / 表单** (3):
- zod · react-hook-form · @hookform/resolvers

**样式 / 工具** (4):
- tailwindcss · @tailwindcss/postcss · postcss · autoprefixer
  tailwind-merge · clsx · class-variance-authority

**UI 组件** (8):
- @radix-ui/react-dialog · dropdown-menu · popover · select · slot · tabs · tooltip
- sonner · cmdk · lucide-react

**可视化** (1):
- d3

**日期** (1):
- date-fns

**工具链** (4):
- typescript · eslint · prettier · prettier-plugin-tailwindcss

**测试** (7):
- vitest · @vitejs/plugin-react
- @testing-library/react · jest-dom · user-event
- jsdom
- @playwright/test · playwright

**许可证核查** (1):
- license-checker

Phase B5 批量补录计划:
- 每个包从 bun pm ls 取 current(已 exact pin)
- license 从 npm registry API 查真值
- 按分类分组写 [frontend.*] 段
- 预计 40 分钟 + 独立 commit
