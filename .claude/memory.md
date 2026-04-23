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
