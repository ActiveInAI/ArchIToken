# Zed + Claude Code 集成 · InsomeOS 工作流

文档 ID: IOS-ZC-2026-006
目的: 让 AIA 在 Zed 编辑器里直接用 Claude Code · 不再切浏览器窗口
前提: AIA 是 Claude Max 20x 会员 · DGX Spark ARM64 · Zed 0.231.2

---

## 1 · 一次性设置 (15 分钟)

### 1.1 确认 Claude Code CLI 已安装

```bash
which claude
claude --version
```

如果没装,一键安装(DGX Spark ARM64 支持):

```bash
curl -fsSL https://claude.ai/install.sh | bash

# 让 shell 识别 claude 命令
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 用你的 Max 20x 会员登录
claude login
# 会打开浏览器授权 · 登录后回到终端按回车
```

### 1.2 确认 Zed 版本

```bash
zed --version  # 或 zedg --version (你装的是 L10n 汉化版)
```

需要 **≥ 0.231.2**。你本地已装 `zedg-zh-cn-linux-aarch64-v0.231.2.deb`,满足。

### 1.3 编辑 Zed 配置 (加入 Claude Code 外部 Agent)

```bash
# 打开配置文件
zed ~/.config/zed/settings.json
```

追加或合并以下内容:

```json
{
  "agent": {
    "default_profile": "write",
    "default_model": {
      "provider": "anthropic",
      "model": "claude-opus-4-7"
    },
    "external_agents": {
      "claude_code": {
        "command": "claude",
        "args": []
      }
    },
    "always_allow_tool_actions": false,
    "notify_when_agent_waiting": "primary_screen",
    "use_modifier_to_send": false
  },
  "language_models": {
    "anthropic": {
      "version": "1",
      "api_url": "https://api.anthropic.com"
    }
  }
}
```

保存后 Zed 会自动重载配置。

### 1.4 在 Zed 里打开 Agent Panel

| 平台 | 快捷键 |
|---|---|
| Linux / Windows | `Ctrl+?` |
| macOS | `Cmd+?` |

或者右上角 ✨ 图标 → **Open Agent Panel**。

Agent Panel 打开后,顶部有模型/agent 下拉,切到 **claude_code** (外部 agent),
就可以直接在 Zed 侧边栏里和 Claude Code 对话了。不用再切浏览器。

---

## 2 · InsomeOS 项目专用工作流

### 2.1 在项目根放 CLAUDE.md

你已经有了 `~/dev/insomeos/CLAUDE.md` (本项目交付文件之一)。
Claude Code 启动时会自动读这个文件作为第一指令。

### 2.2 启动 Claude Code 会话 (从项目根)

两种方式:

**方式 A · Zed Agent Panel (推荐)**:
1. 在 Zed 里打开 `~/dev/insomeos/` 项目
2. `Ctrl+?` 打开 Agent Panel
3. 切换到 `claude_code` agent
4. 直接在 Zed 窗口内对话

**方式 B · Zed 内嵌终端**:
```bash
# 在 Zed 内嵌终端 (Ctrl+` 打开)
cd ~/dev/insomeos
claude
```
这会启动一个 Claude Code 交互会话,输出就在 Zed 终端面板里。

### 2.3 关键提示词模板 (贴到 Agent Panel 开头)

```
请读 ~/dev/insomeos/CLAUDE.md 和 ~/dev/insomeos/versions.toml
作为唯一权威。任何版本号都必须来自 versions.toml 的 current 字段。
本次任务: <你的具体需求>
```

---

## 3 · 常用命令速查

### 3.1 Zed 窗口内 (不用切浏览器)

| 操作 | 快捷键 |
|---|---|
| 打开 Agent Panel | `Ctrl+?` |
| 打开内嵌终端 | `Ctrl+\`` |
| 命令面板 | `Ctrl+Shift+P` |
| 多面板布局 | `Ctrl+\` 竖分 · `Ctrl+K Ctrl+\` 横分 |
| 切换 Agent 模型 | Agent Panel 右上角下拉 |

### 3.2 Claude Code 会话内命令

```
/help            查看全部命令
/model           切换模型 (opus-4-7 / sonnet / haiku)
/compact         压缩上下文 (对话长时用)
/clear           清空会话
/exit            退出
```

### 3.3 InsomeOS 项目专用 (自定义到 ~/.claude/commands/)

建议在 `~/.claude/commands/` 目录下创建几个 shortcut:

```bash
mkdir -p ~/.claude/commands

cat > ~/.claude/commands/versions.md << 'EOF'
# /versions · 查 versions.toml 里某个组件的当前版本
读取 ~/dev/insomeos/versions.toml · 查找 $ARG 对应的 current 字段 · 返回精确版本号
EOF

cat > ~/.claude/commands/pin.md << 'EOF'
# /pin · 检查 Cargo.toml/package.json 是否违反 pin_patch 规则
扫描当前文件 · 找出所有 ^ ~ * latest 使用 · 报错并提示改成 =x.y.z
EOF

cat > ~/.claude/commands/nvfp4.md << 'EOF'
# /nvfp4 · 检查某个模型是否有 NVFP4 版本
查 ~/dev/insomeos/versions.toml 的 [model_format_policy.nvfp4_locked] 段
列出已有 NVFP4 的模型 + 升级候选
EOF
```

在会话里输入 `/versions axum` 就会返回 `=0.8.9`。

---

## 4 · 工作区布局建议 (Zed 单窗口完成全部工作)

```
┌────────────────────────────────────────────────────────┐
│  Zed · InsomeOS 项目窗口                                │
├───────────────┬─────────────────────────┬──────────────┤
│               │                         │              │
│   文件树      │   代码编辑区             │  Agent Panel │
│  (左侧栏)     │   (Cargo.toml /          │  (Claude     │
│               │    04-backend/src/...)   │   Code)      │
│               │                         │              │
│               │                         │              │
├───────────────┴─────────────────────────┴──────────────┤
│  内嵌终端 (Ctrl+`)                                      │
│  $ cargo check --workspace                              │
│  $ just versions-check                                  │
└────────────────────────────────────────────────────────┘
```

配置:

```json
{
  "agent_panel": {"dock": "right", "default_width": 480},
  "terminal": {"dock": "bottom", "default_height": 240},
  "project_panel": {"dock": "left", "default_width": 240}
}
```

---

## 5 · 常见问题

### 5.1 claude 命令找不到

```bash
# 确认 PATH
echo $PATH | tr ':' '\n' | grep -E "\.local|claude"

# 若不在 PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 5.2 Zed Agent Panel 里看不到 claude_code

检查 settings.json 语法:

```bash
# 用 jq 校验
cat ~/.config/zed/settings.json | jq .
# 如果报错 · 说明 JSON 语法有问题
```

### 5.3 每次都要重新登录

```bash
# Claude CLI 凭证默认存在
ls -la ~/.claude/

# 如果被清了 · 重新登录
claude login
```

### 5.4 想走 Insome VPN 代理

如果 DGX Spark 要通过 VPS 走 Claude API:

```bash
# 临时(当前会话):
export HTTPS_PROXY=http://127.0.0.1:10809
claude

# 永久:
echo 'export HTTPS_PROXY=http://127.0.0.1:10809' >> ~/.bashrc
```

配合你的 Xray 26.3.27 客户端即可。

---

## 6 · 切窗口问题根治

AIA 2026-04-23 原话:**"我想在 zed 中使用 claude code · 应该怎么打开使用?现在切窗口太麻烦"**

根治方案:**Zed 0.231.2 的 Agent Panel 本就是为了解决这个问题设计的**。只要按第 1-4 章配好,以后的工作流就是:

1. 打开 Zed · 加载 `~/dev/insomeos/` 项目
2. `Ctrl+\`` 打开终端(底部)· `Ctrl+?` 打开 Agent Panel(右侧)
3. 左侧文件树 · 中间代码 · 右侧 Claude · 底部 shell
4. **全部在一个 Zed 窗口内**
5. 关闭浏览器里的 claude.ai · 不再切窗口

---

## 7 · 参考链接

- Zed Agent Panel 文档: https://zed.dev/docs/agent-panel
- Zed 外部 Agent 配置: https://zed.dev/docs/agent/external-agents
- Claude Code 官方: https://github.com/anthropics/claude-code
- Claude Code 文档: https://code.claude.com/docs/
- Claude Code GitHub Actions: https://code.claude.com/docs/en/github-actions
