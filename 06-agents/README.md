# 06-agents

Python Agent 层 · Sprint 01 阶段 D (D7) 正式启用

## 技术栈 (取自 versions.toml 3.4.0)
- Langfuse Python SDK v4.5.0 (agent.langfuse_py_sdk)
- LangGraph 1.1.8 (agent.langgraph · PG checkpointer)
- HermesAgent v0.10.0 (agent.hermes_agent · Python 3.11+ · SQLite+FTS5)
- OpenClaw 0.12.3 (agent.openclaw · Node22+/Bun 但通过 MCP 由此层调用)
- MCP 2026-03-26 spec + rmcp =1.5.0

## 职责
- LLM 路由 (本地 IndustrialCoder-Thinking-32B-FP8 / Gemma-4-31B-NVFP4 / 远程 Opus 4.7)
- Agent 编排 (LangGraph)
- 追踪观测 (Langfuse)
- 工具调用 (MCP)

## 启用时机
见 docs/CHANGELOG-v1.3.0.md 第 3 节 · 阶段 D (Sprint 01 Day 7)
