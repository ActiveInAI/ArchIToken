"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api, type AgentInvokeResponse } from "@/lib/api";
import { getBackendRequestContext } from "@/lib/backend-api";
import { normalizeModuleId, type ModuleId } from "@/lib/module-registry";

/// AI-NATIVE 全局命令界面（Cmd/Ctrl+K 唤起，贯穿所有 /app 页面）。
/// 体现两条产品原则：
///  · AI 是主界面——人表达意图，AI 编排 harness，人审阅平静结果；
///  · HARNESS 可见即信任——六门控链（ToolRouter→Planner→Generator→
///    Evaluator→RuleChecker→SchemaValidator→Approver）与证据、裁决可见。
/// 接真实端点 /v1/agents/invoke，不造假。

const GATE_ORDER = [
  "ToolRouter",
  "Planner",
  "Generator",
  "Evaluator",
  "RuleChecker",
  "SchemaValidator",
  "Approver",
] as const;

const GATE_LABEL: Record<string, string> = {
  ToolRouter: "工具路由",
  Planner: "规划",
  Generator: "生成",
  Evaluator: "评估",
  RuleChecker: "规则校核",
  SchemaValidator: "结构校验",
  Approver: "审批门控",
};

const VERDICT_META: Record<
  string,
  { label: string; tone: "ok" | "warn" | "danger"; desc: string }
> = {
  approved: { label: "已通过", tone: "ok", desc: "结果通过全部门控，可直接采用。" },
  revise: {
    label: "需修订",
    tone: "warn",
    desc: "门控建议修订，结果仅供草拟参考。",
  },
  rejected: {
    label: "已拦截",
    tone: "danger",
    desc: "门控拦截：缺少可验证来源或不满足规则，仅作草拟，不可直接采用。",
  },
};

function moduleFromPath(pathname: string | null): ModuleId {
  const segment = pathname?.match(/\/app\/modules\/([^/?#]+)/)?.[1];
  return (segment ? normalizeModuleId(segment) : null) ?? "ai_center";
}

const FALLBACK_VERDICT = {
  label: "需修订",
  tone: "warn" as const,
  desc: "门控建议修订，结果仅供草拟参考。",
};

export function AiCommandSurface() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentInvokeResponse | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  async function submit() {
    const text = intent.trim();
    if (text === "" || pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    const ctx = getBackendRequestContext();
    try {
      const response = await api.agents.invoke({
        projectId: ctx.projectId,
        tenantId: ctx.tenantId,
        moduleId: moduleFromPath(pathname),
        userInput: text,
        locale: "zh-CN",
      });
      setResult(response);
    } catch {
      setError("AI 编排服务暂不可达，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="ai-command-trigger"
        aria-label="AI 命令（Cmd/Ctrl+K）"
        onClick={() => setOpen(true)}
      >
        <span className="ai-command-trigger__spark">✦</span>
        <span>AI 命令</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <div
          className="ai-command-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="AI 命令"
          onClick={() => setOpen(false)}
        >
          <div
            className="ai-command-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ai-command-input-row">
              <span className="ai-command-input-row__spark">✦</span>
              <textarea
                ref={inputRef}
                className="ai-command-input"
                rows={1}
                placeholder={`向 ${GATE_LABEL.Approver ? "" : ""}AI 表达你的意图，例如「按当前工程估算钢结构每吨综合单价」（Enter 执行）`}
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
              <button
                type="button"
                className="ai-command-run"
                disabled={pending || intent.trim() === ""}
                onClick={() => void submit()}
              >
                {pending ? "编排中…" : "执行"}
              </button>
            </div>

            <div className="ai-command-context">
              当前模块上下文 ·{" "}
              <b>{moduleFromPath(pathname)}</b> · 经 HARNESS 六门控可信编排
            </div>

            {error ? <div className="ai-command-error">{error}</div> : null}

            {pending && !result ? (
              <HarnessTimeline pending gates={[]} />
            ) : null}

            {result ? <AiResult result={result} /> : null}

            {!result && !pending && !error ? (
              <div className="ai-command-hint">
                <p>AI 会调用工具、检索证据、经六道门控校验后给出结果。</p>
                <ul>
                  <li>结果带 <b>来源证据</b>与<b>门控裁决</b>，可信可追溯。</li>
                  <li>无可验证来源的内容会被门控标记为「草拟」，不会冒充结论。</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function AiResult({ result }: { result: AgentInvokeResponse }) {
  const verdict = VERDICT_META[result.verdict] ?? FALLBACK_VERDICT;
  return (
    <div className="ai-command-result">
      <div className={`ai-verdict ai-verdict--${verdict.tone}`}>
        <span className="ai-verdict__label">{verdict.label}</span>
        <span className="ai-verdict__desc">{verdict.desc}</span>
      </div>

      <HarnessTimeline pending={false} gates={result.gates} />

      <GateFindings gates={result.gates} />

      {result.ragChunks.length > 0 ? (
        <div className="ai-evidence">
          <div className="ai-evidence__title">来源证据 · {result.ragChunks.length} 条</div>
          <div className="ai-evidence__list">
            {result.ragChunks.slice(0, 8).map((chunk, index) => (
              <span key={index} className="ai-evidence__chip" title={chunk.content}>
                {chunk.title || chunk.source}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ai-output">
        <MiniMarkdown text={asText(result.finalOutput)} />
      </div>
    </div>
  );
}

/// 门控结构化发现：把 RuleChecker/SchemaValidator/Approver 的机器可判定结果
/// (code + severity + message)按严重度呈现,而非只看自由文本 notes。
function GateFindings({ gates }: { gates: AgentInvokeResponse["gates"] }) {
  const findings = gates.flatMap((gate) =>
    (gate.findings ?? []).map((finding) => ({ gate: gate.name, ...finding })),
  );
  if (findings.length === 0) return null;
  return (
    <div className="ai-findings">
      <div className="ai-findings__title">门控发现 · {findings.length} 项</div>
      <ul className="ai-findings__list">
        {findings.slice(0, 12).map((finding, index) => (
          <li
            key={index}
            className={`ai-finding is-${finding.severity}`}
            title={finding.standard ?? finding.field ?? undefined}
          >
            <span className="ai-finding__gate">{finding.gate}</span>
            <code className="ai-finding__code">{finding.code}</code>
            <span className="ai-finding__msg">{finding.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HarnessTimeline({
  gates,
  pending,
}: {
  gates: AgentInvokeResponse["gates"];
  pending: boolean;
}) {
  const byName = new Map(gates.map((gate) => [gate.name, gate]));
  return (
    <div className="ai-harness" aria-label="HARNESS 门控链">
      {GATE_ORDER.map((name) => {
        const gate = byName.get(name);
        const status = pending
          ? "running"
          : (gate?.status ?? "idle");
        return (
          <div
            key={name}
            className={`ai-harness__gate is-${status}`}
            title={gate?.notes ?? GATE_LABEL[name]}
          >
            <span className="ai-harness__dot" />
            <span className="ai-harness__name">{GATE_LABEL[name]}</span>
          </div>
        );
      })}
    </div>
  );
}

function asText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output == null) return "";
  if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    if (typeof record.markdown === "string") return record.markdown;
    if (typeof record.text === "string") return record.text;
    try {
      return "```json\n" + JSON.stringify(output, null, 2) + "\n```";
    } catch {
      return String(output);
    }
  }
  return String(output);
}

/// 轻量 markdown 渲染：标题 / 表格 / 粗体 / 列表 / 引用 / 段落。
function MiniMarkdown({ text }: { text: string }): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const inline = (s: string): ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={idx}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={idx}>{part}</span>
      ),
    );
  };
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    // 表格：管道行起始，下一行也是管道行（兼容缺少 --- 分隔行的输出）
    const isPipeRow = (s: string) =>
      s.includes("|") && (s.match(/\|/g)?.length ?? 0) >= 2;
    const isSeparator = (s: string) => /^[\s|:-]+$/.test(s) && s.includes("-");
    if (isPipeRow(line) && isPipeRow(lines[i + 1] ?? "")) {
      const header = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 1;
      if (isSeparator(lines[i] ?? "")) {
        i += 1; // 跳过 --- 分隔行（若有）
      }
      const rows: string[][] = [];
      while (i < lines.length && isPipeRow(lines[i] ?? "")) {
        const cells = (lines[i] ?? "")
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        if (!isSeparator(lines[i] ?? "")) {
          rows.push(cells);
        }
        i += 1;
      }
      blocks.push(
        <table key={key++} className="ai-md-table">
          <thead>
            <tr>
              {header.map((h, hi) => (
                <th key={hi}>{inline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h4 key={key++}>{inline(line.slice(4))}</h4>);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h3 key={key++}>{inline(line.slice(3))}</h3>);
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h2 key={key++}>{inline(line.slice(2))}</h2>);
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={key++}>{inline(line.slice(2))}</blockquote>,
      );
      i += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*] /, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, ii) => (
            <li key={ii}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    blocks.push(<p key={key++}>{inline(line)}</p>);
    i += 1;
  }
  return <div className="ai-md">{blocks}</div>;
}
