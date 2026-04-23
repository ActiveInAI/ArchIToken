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
