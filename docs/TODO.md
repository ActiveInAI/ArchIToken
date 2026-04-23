# TODO · 发现的待补项 · 2026-04-23

## 缺失的工具链配置 (非紧急 · 但 Sprint 01 完成前需补)

### 1. Playwright 配置缺失
- 现状: 09-testing/landing.spec.ts 孤儿 spec · 无 playwright.config.*
- 后果: E2E 测试当前无法执行
- 决策待定:
  (a) 在 09-testing/ 内建 playwright.config.ts + package.json
  (b) 把 landing.spec.ts 迁到 03-frontend/tests/ · 与前端共享 node_modules
- 影响: Sprint 01 E2E 验证环节

### 2. Justfile 缺失
- 现状: CLAUDE.md 和 versions.toml meta 提到 `just versions-check`
- 后果: 版本漂移自动巡检当前无入口
- 需要: 在仓库根建 Justfile · 至少包含 versions-check · cargo-check · typecheck · test 几个 target
- 影响: 宪法 Article 2 的 CI 自动化部分

### 3. scripts/check-versions.py 待验证
- 现状: 若存在则好 · 不存在需补
- 验证: ls ~/dev/insomeos/scripts/
- 如不存在 · 本 TODO 再追加一条

### 4. scripts/ 目录已验证不存在 (2026-04-23)
- 现状: `ls ~/dev/insomeos/scripts/` 返回 "没有那个文件或目录"
- 后果: `scripts/check-versions.py` 确认缺失 · `just versions-check` 和 `.github/workflows/versions-check.yml` 的核心逻辑无处可跑
- 需要:
  - 创建 `scripts/` 目录
  - 新建 `scripts/check-versions.py` · 读取 `versions.toml` 的所有 `check_url` · 调 GitHub API 比对 `current` vs 最新 release · 超过 `stale_after_days=14` 则 warn · `stale_hard_days=30` 则 fail
  - 新建 `.github/workflows/versions-check.yml` · cron `0 3 * * 1` (每周一 03:00 UTC)
- 依赖: 先完成第 2 项 Justfile · 再把 `just versions-check` 指向此脚本
- 影响: 宪法 Article 2 的单一事实源自动巡检 · 当前完全缺位
