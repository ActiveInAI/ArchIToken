# Article 2 对齐流程 (InsomeOS · 2026-04-23 确立)

任何修改 CLAUDE.md · AGENTS.md · README.md · 或项目内任何
.md / .toml / .json / .yaml 配置文件前,执行 4 步:

1. **Read versions.toml**
   从 [lang.*] [frontend.*] [rust.*] [data_*] [agent.*] [inference.*]
   [multimodal.*] [infra.*] [local_models.*] [anthropic.*] 等对应段
   取 current / full_tag / hf_id / ms_id 的原值。

2. **改文件**
   版本号严格抄 versions.toml · 禁止 ^ ~ * latest ·
   禁止使用训练记忆里的版本号。

3. **全文 grep 核验**
   grep -nE "[0-9]+\.[0-9]+\.[0-9]+|v[0-9]|[A-Z]-?[0-9]+[BM]" <改过的文件>

4. **逐行标注每个 hit 类型**
   - [matches versions.toml · L<行号>]  → 与真值对齐
   - [历史引用·表左列·错误示例]         → 故意保留展示"曾写错什么"
   - [非版本·日期/硬件/阈值/网络]        → 不是版本号
   - [最低版本约束·兼容当前 current]     → like "Node 22+" with current 22.14.0
   - [已删除依赖·ADR-<编号>]             → 保留做决策记录
   - [仍需修正]                          → 必须改成真值

5. **报告完整清单**
   所有 hit 按上述类型标注 · 0 待修正才算对齐完成。

关键词:
- 禁止推测版本号
- 冲突时 versions.toml 优先 (Article 2)
- 发现冲突必须主动报告 · 不能默默改

---

# 版本号规则 (2026-04-23 AIA 最终确立)

## 核心原则
versions.toml 和 Cargo.toml / package.json 里 pinned 的 current
字段是权威值。Claude 不自主改任何版本号。

## 允许的动作

### 1 · 补录(0 版本改动)
Cargo.toml / package.json 锁了版本但 versions.toml 漏录 →
补录进 versions.toml · 原值抄写 · 数字不动。

### 2 · 元数据修复(0 版本改动)
URL 过期 · license SPDX 错 · notes 陈旧 → 修元数据 · current 不动。

### 3 · patch 升级(需 AIA 批准)
形如 =0.1.88 → =0.1.89 · 只升最后一位。前提:
- 无 breaking change(查 CHANGELOG)
- cargo check --workspace / bun install 升级后仍绿
- 单次同族最多 3-5 包(如 tokio 生态一起升)
- 独立 commit · 不混其它任务
- AIA 主动说"升"或 ACK 具体包才执行

## 禁止的动作

- minor 跨版本  0.12.x → 0.13.x  禁
- major 跨版本  1.x → 2.x         禁
- 引入 pre-release(除 R4a 白名单例外)
- 批量升不相关包(一次 10+)         禁
- 用训练记忆推测 license · 必须 cargo metadata 真值
- 看起来"可以升"就自动升 · 必须 AIA 授权

## 冲突处理

Cargo.toml 和 versions.toml 不一致:
- 优先相信 Cargo.toml(它有 cargo check 绿灯作证)
- 两边都不自动改
- 报告冲突 · 列可选方案 · AIA 决策

## 升级扫描补充

B1 这类"补录" commit 后 · 可额外跑 cargo update --dry-run
或 cargo outdated 生成"可升 patch 候选清单"· 只报告不执行 ·
作为未来 AIA 闲时决策参考池。

---

# 规则落地 5 · 2026-04-23 B3 确立

## 规则 1 · toml 精度到 patch
versions.toml 所有 current 必须 x.y.z 三位齐全(或等价完整标签如
"0.184.0")。禁止 "16.2" / "v1.5" 这种省略 patch 的简化表达。
编辑时:若现有 current 不到 patch 位 · 从 bun.lock / Cargo.lock /
pyproject 逆向取真值补齐。

## 规则 2 · 升级不降级
统一漂移时(如 Bun 1.3.11 本机 · 1.3.12 CI · 1.3.13 versions.toml)
选最高的 · 全链路同步升级。例外:有明确兼容问题才考虑降级 · 且需
AIA 授权 + 独立 ADR。

## 规则 3 · Python 两层版本号独立管理
- 运行时 python3 可以是 3.12(系统)或 3.13(uv 管理) · 不强制统一
- 但 pyproject.toml requires-python 不用 ==3.14.* 这种硬约束
- 改用 ">=3.13,<3.15" 范围 · 允许 spark02 本机 3.12 通过 uv venv
  跑 3.14 虚拟环境 · 同时排除未来 3.15 breaking

## 规则 4 · 文档注释 = 运行时真值
CLAUDE.md · ARCHITECTURE.md · README.md · *.md · *.tsx · *.sql 里
任何版本号注释必须等于:
- versions.toml 的 current 值(首选)
- 或 bun.lock / Cargo.lock 解析值(运行时真值)
不允许"目标值"与"当前值"混写 · 必须明确标注 "(target)" 或
"(baseline)" 二选一。

## 规则 5 · toml+md 控制策略
Article 2 有两层事实源:
- versions.toml = 单一版本权威(数字)
- 02-architecture/*.md = 决策权威(为什么选这个数字)

改版本号 = 改 versions.toml + 同步所有 md 提及 · 单 commit
改决策理由 = 只改 md · versions.toml 不动 · 单 commit
两者不混 · 便于回滚。
