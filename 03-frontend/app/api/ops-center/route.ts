// app/api/ops-center/route.ts
// License: Apache-2.0
// 运维中心后端：直接以 insome 身份调用 docker / kubectl / shell，统一聚合主机、容器、
// k3s 集群、本地大模型的运行态，并提供容器/集群操作与终端命令执行。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import type {
  OpsCenterSnapshot,
  OpsContainer,
  OpsExecResult,
  OpsK8sSummary,
  OpsLogsResult,
  OpsModelSummary,
} from "@/lib/ops-center-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const HOME = os.homedir();
const DEFAULT_TIMEOUT = 6000;
const MAX_BUFFER = 8 * 1024 * 1024;

interface ExecOk {
  stdout: string;
  stderr: string;
  code: number;
}

async function run(
  cmd: string,
  args: string[],
  opts: { timeout?: number; cwd?: string } = {},
): Promise<ExecOk> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      maxBuffer: MAX_BUFFER,
      cwd: opts.cwd ?? HOME,
      env: process.env,
    });
    return { stdout: String(stdout), stderr: String(stderr), code: 0 };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      code?: number | string;
    };
    return {
      stdout: err.stdout ? String(err.stdout) : "",
      stderr: err.stderr ? String(err.stderr) : message(error),
      code: typeof err.code === "number" ? err.code : 1,
    };
  }
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function singleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// ---------------------------------------------------------------------------
// GET：总览快照
// ---------------------------------------------------------------------------
export async function GET() {
  const errors: string[] = [];
  const [containers, k8s, models] = await Promise.all([
    listContainers(errors),
    summarizeK8s(errors),
    summarizeModels(errors),
  ]);

  const running = containers.filter((item) => item.running).length;
  const snapshot: OpsCenterSnapshot = {
    generatedAt: new Date().toISOString(),
    host: collectHost(),
    containers,
    containerSummary: {
      total: containers.length,
      running,
      stopped: containers.length - running,
    },
    k8s,
    models,
    errors,
  };

  return Response.json(snapshot, { headers: { "cache-control": "no-store" } });
}

function collectHost(): OpsCenterSnapshot["host"] {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    uptimeSec: Math.round(os.uptime()),
    loadavg: os.loadavg().map((value) => Math.round(value * 100) / 100) as [
      number,
      number,
      number,
    ],
    cpuCount: os.cpus().length,
    memTotal: total,
    memFree: free,
    memUsedPct: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
  };
}

interface DockerPsRow {
  ID?: string;
  Image?: string;
  Names?: string;
  Ports?: string;
  Status?: string;
  State?: string;
}

async function listContainers(errors: string[]): Promise<OpsContainer[]> {
  const result = await run("docker", [
    "ps",
    "-a",
    "--no-trunc",
    "--format",
    "{{json .}}",
  ]);
  if (result.code !== 0 && !result.stdout.trim()) {
    errors.push(`docker ps 失败: ${result.stderr.trim() || "未知错误"}`);
    return [];
  }
  const containers = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as DockerPsRow;
      } catch {
        return null;
      }
    })
    .filter((row): row is DockerPsRow => row !== null)
    .map((row): OpsContainer => {
      const state = (row.State ?? "").toLowerCase();
      const status = row.Status ?? "";
      const running = state
        ? state === "running"
        : /^up\b/i.test(status.trim());
      const name = row.Names ?? row.ID ?? "";
      return {
        id: row.ID ?? name,
        name,
        image: row.Image ?? "",
        state: state || (running ? "running" : "exited"),
        status,
        ports: row.Ports ?? "",
        running,
        stack: stackOf(name),
      };
    })
    .sort((a, b) => {
      if (a.running !== b.running) return a.running ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  // 尽力补充 CPU / 内存（仅运行中的容器；失败不影响主体）
  try {
    const stats = await run(
      "docker",
      [
        "stats",
        "--no-stream",
        "--format",
        "{{json .}}",
      ],
      { timeout: 4000 },
    );
    if (stats.code === 0) {
      const byName = new Map<string, { cpu: string; mem: string }>();
      for (const line of stats.stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const row = JSON.parse(trimmed) as {
            Name?: string;
            CPUPerc?: string;
            MemUsage?: string;
            MemPerc?: string;
          };
          if (row.Name) {
            byName.set(row.Name, {
              cpu: row.CPUPerc ?? "",
              mem: row.MemUsage ?? "",
            });
          }
        } catch {
          /* ignore single row */
        }
      }
      for (const container of containers) {
        const found = byName.get(container.name);
        if (found) {
          container.cpuPerc = found.cpu;
          container.memUsage = found.mem;
        }
      }
    }
  } catch {
    /* stats 可选 */
  }

  return containers;
}

function stackOf(name: string): string {
  // 用容器名前缀粗略归组：architoken-postgres -> architoken
  const cleaned = name.replace(/^\//, "");
  const match = cleaned.match(/^([a-z0-9]+)[-_]/i);
  // 无统一前缀的容器用其自身名称成组，不再归入「其他」
  return (match && match[1] ? match[1] : cleaned).toLowerCase();
}

async function summarizeK8s(errors: string[]): Promise<OpsK8sSummary> {
  const nodesRaw = await run(
    "kubectl",
    ["get", "nodes", "-o", "json"],
    { timeout: 5000 },
  );
  if (nodesRaw.code !== 0) {
    return { available: false, reason: nodesRaw.stderr.trim().slice(0, 200) };
  }
  let nodes: OpsK8sSummary["nodes"] = [];
  try {
    const parsed = JSON.parse(nodesRaw.stdout) as {
      items?: Array<{
        metadata?: { name?: string };
        status?: {
          conditions?: Array<{ type?: string; status?: string }>;
          nodeInfo?: { kubeletVersion?: string };
        };
      }>;
    };
    nodes = (parsed.items ?? []).map((node) => {
      const ready = (node.status?.conditions ?? []).some(
        (c) => c.type === "Ready" && c.status === "True",
      );
      return {
        name: node.metadata?.name ?? "unknown",
        ready,
        version: node.status?.nodeInfo?.kubeletVersion ?? "",
      };
    });
  } catch (error) {
    errors.push(`解析节点失败: ${message(error)}`);
  }

  const podSummary = { total: 0, running: 0, pending: 0, failed: 0, succeeded: 0 };
  const namespaces = new Set<string>();
  // 用 custom-columns 只取命名空间和阶段，避免 -o json 在大规模集群下超出输出缓冲
  const podsRaw = await run(
    "kubectl",
    [
      "get",
      "pods",
      "-A",
      "--no-headers",
      "-o",
      "custom-columns=NS:.metadata.namespace,PHASE:.status.phase",
    ],
    { timeout: 9000 },
  );
  if (podsRaw.code === 0) {
    for (const line of podsRaw.stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const ns = parts[0];
      const phase = parts[1] ?? "";
      podSummary.total += 1;
      if (ns) namespaces.add(ns);
      if (phase === "Running") podSummary.running += 1;
      else if (phase === "Pending") podSummary.pending += 1;
      else if (phase === "Failed") podSummary.failed += 1;
      else if (phase === "Succeeded") podSummary.succeeded += 1;
    }
  } else if (podsRaw.stderr.trim()) {
    errors.push(`Pod 列表获取失败: ${podsRaw.stderr.trim().slice(0, 160)}`);
  }

  return {
    available: true,
    nodes,
    podSummary,
    namespaceCount: namespaces.size,
  };
}

const LLM_ENDPOINTS: Array<{ name: string; url: string; kind: "ollama" | "openai" }> = [
  { name: "Ollama", url: "http://127.0.0.1:11434", kind: "ollama" },
  { name: "Ollama Auth Proxy", url: "http://127.0.0.1:11435", kind: "ollama" },
  { name: "LM Studio", url: "http://127.0.0.1:1234", kind: "openai" },
  { name: "vLLM", url: "http://127.0.0.1:8000", kind: "openai" },
  { name: "llama.cpp", url: "http://127.0.0.1:8080", kind: "openai" },
];

const PROVIDER_FAMILIES: Array<{ name: string; keys: string[] }> = [
  { name: "OpenAI", keys: ["OPENAI_API_KEY"] },
  { name: "Anthropic / Claude", keys: ["ANTHROPIC_API_KEY"] },
  { name: "Google / Gemini", keys: ["GOOGLE_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"] },
  { name: "DeepSeek", keys: ["DEEPSEEK_API_KEY"] },
  { name: "Groq", keys: ["GROQ_API_KEY"] },
  { name: "Mistral", keys: ["MISTRAL_API_KEY"] },
  { name: "OpenRouter", keys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"] },
  { name: "Azure", keys: ["AZURE_API_KEY", "AZURE_OPENAI_API_KEY"] },
  { name: "xAI / Grok", keys: ["XAI_API_KEY", "GROK_API_KEY"] },
  { name: "Moonshot / Kimi", keys: ["MOONSHOT_API_KEY"] },
  { name: "DashScope / 通义", keys: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"] },
  { name: "Cohere", keys: ["COHERE_API_KEY"] },
  { name: "Together", keys: ["TOGETHER_API_KEY"] },
  { name: "Perplexity", keys: ["PERPLEXITY_API_KEY"] },
  {
    name: "Hugging Face",
    keys: ["HF_TOKEN", "HUGGINGFACEHUB_API_TOKEN", "HUGGINGFACE_API_KEY", "HF_API_TOKEN"],
  },
];

interface LlmCandidate {
  name: string;
  url: string;
  kind: "ollama" | "openai";
  curated: boolean;
}

// 在固定默认端点之外，扫描监听端口里疑似 LLM 服务（python/vllm/llama 等）的进程并探测
async function discoverLlmEndpoints(): Promise<LlmCandidate[]> {
  const curated: LlmCandidate[] = LLM_ENDPOINTS.map((endpoint) => ({
    ...endpoint,
    curated: true,
  }));
  const knownPorts = new Set(curated.map((endpoint) => Number(new URL(endpoint.url).port)));
  const extra: LlmCandidate[] = [];
  try {
    const { stdout } = await execFileAsync("ss", ["-tlnpH"], {
      timeout: 4000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const procRe = /python|vllm|llama|lms|lmstudio|sglang|mlx|tabby|text-gen|aphrodite|ollama|infinity|tei/i;
    for (const line of stdout.split("\n")) {
      const cols = line.trim().split(/\s+/);
      const local = cols[3] ?? "";
      const idx = local.lastIndexOf(":");
      if (idx < 0) continue;
      const addr = local.slice(0, idx);
      const port = Number(local.slice(idx + 1));
      if (!Number.isFinite(port) || knownPorts.has(port)) continue;
      const loopOrLan =
        addr === "127.0.0.1" ||
        addr === "0.0.0.0" ||
        addr === "*" ||
        addr === "[::]" ||
        addr === "::1" ||
        addr === "[::1]";
      if (!loopOrLan) continue;
      const procPart = cols.slice(5).join(" ");
      const match = procPart.match(/"([^"]+)",pid=\d+/);
      const proc = match ? (match[1] ?? "") : "";
      if (!proc || !procRe.test(proc)) continue;
      knownPorts.add(port);
      extra.push({
        name: `${proc}:${port}`,
        url: `http://127.0.0.1:${port}`,
        kind: "openai",
        curated: false,
      });
      if (extra.length >= 20) break;
    }
  } catch {
    /* 发现失败不致命 */
  }
  return [...curated, ...extra];
}

async function probeLlmEndpoint(
  endpoint: LlmCandidate,
  models: OpsModelSummary["models"],
): Promise<{ reachable: boolean; modelCount: number }> {
  try {
    const path = endpoint.kind === "ollama" ? "/api/tags" : "/v1/models";
    const response = await fetch(`${endpoint.url}${path}`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!response.ok) return { reachable: false, modelCount: 0 };
    const payload = (await response.json()) as {
      models?: Array<{
        name?: string;
        size?: number;
        details?: { parameter_size?: string; family?: string };
      }>;
      data?: Array<{ id?: string }>;
    };
    const found =
      endpoint.kind === "ollama"
        ? (payload.models ?? []).map((model) => ({
            name: model.name ?? "unknown",
            sizeBytes: model.size ?? 0,
            params: model.details?.parameter_size ?? "",
            family: model.details?.family ?? "",
            source: endpoint.name,
          }))
        : (payload.data ?? []).map((model) => ({
            name: model.id ?? "unknown",
            sizeBytes: 0,
            params: "",
            family: "",
            source: endpoint.name,
          }));
    models.push(...found);
    return { reachable: true, modelCount: found.length };
  } catch {
    return { reachable: false, modelCount: 0 };
  }
}

async function summarizeModels(errors: string[]): Promise<OpsModelSummary> {
  const models: OpsModelSummary["models"] = [];
  const candidates = await discoverLlmEndpoints();
  const probed = await Promise.all(
    candidates.map(async (endpoint) => ({
      endpoint,
      ...(await probeLlmEndpoint(endpoint, models)),
    })),
  );
  const endpoints = probed
    .filter((item) => item.endpoint.curated || item.reachable)
    .map((item) => ({
      name: item.endpoint.name,
      url: item.endpoint.url,
      kind: item.endpoint.kind,
      reachable: item.reachable,
      modelCount: item.modelCount,
    }));
  const providers = await detectProviders(errors);
  return { endpoints, models, providers };
}

interface ProviderCache {
  at: number;
  data: OpsModelSummary["providers"];
}

async function detectProviders(errors: string[]): Promise<OpsModelSummary["providers"]> {
  const store = globalThis as Record<string, unknown>;
  const cached = store.__opsProviderCache as ProviderCache | undefined;
  const now = Date.now();
  if (cached && now - cached.at < 60000) return cached.data;
  try {
    const { stdout } = await execFileAsync(
      "bash",
      [
        "-lc",
        `find "$HOME" -maxdepth 4 \\( -name node_modules -o -name .git -o -name .next \\) -prune -o -type f -name '.env*' -print 2>/dev/null | head -100 | xargs -d '\\n' grep -hE '^(export +)?[A-Za-z0-9_]+=' 2>/dev/null | head -5000`,
      ],
      { timeout: 6000, maxBuffer: 4 * 1024 * 1024 },
    );
    const present = new Set<string>();
    for (const line of stdout.split("\n")) {
      const cleaned = line.trim().replace(/^export\s+/, "");
      const eq = cleaned.indexOf("=");
      if (eq <= 0) continue;
      const key = cleaned.slice(0, eq).trim().toUpperCase();
      const value = cleaned.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (value.length > 3) present.add(key);
    }
    const data = PROVIDER_FAMILIES.flatMap((family) => {
      const hit = family.keys.find((key) => present.has(key.toUpperCase()));
      return hit ? [{ name: family.name, keyName: hit }] : [];
    });
    store.__opsProviderCache = { at: now, data } satisfies ProviderCache;
    return data;
  } catch (error) {
    errors.push(`Provider 检测失败: ${message(error)}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// POST：操作分发
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "请求体必须为 JSON" }, { status: 400 });
  }
  const op = String(body.op ?? "");

  try {
    switch (op) {
      case "container.start":
      case "container.stop":
      case "container.restart":
      case "container.remove":
        return await handleContainerAction(op, body);
      case "container.logs":
        return await handleLogs(body);
      case "k8s.restart":
        return await handleK8sRestart(body);
      case "k8s.scale":
        return await handleK8sScale(body);
      case "exec.run":
        return await handleExec(body);
      default:
        return Response.json({ error: `未知操作: ${op}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

async function handleContainerAction(
  op: string,
  body: Record<string, unknown>,
) {
  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "缺少容器 id" }, { status: 400 });
  const action = op.split(".")[1] ?? ""; // start | stop | restart | remove
  const dockerArgs =
    action === "remove" ? ["rm", "-f", id] : [action, id];
  const result = await run("docker", dockerArgs, { timeout: 30000 });
  const ok = result.code === 0;
  return Response.json(
    {
      ok,
      action,
      id,
      output: (result.stdout || result.stderr).trim(),
    },
    { headers: { "cache-control": "no-store" }, status: ok ? 200 : 500 },
  );
}

async function handleLogs(body: Record<string, unknown>) {
  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "缺少容器 id" }, { status: 400 });
  const tail = Math.min(Math.max(Number(body.tail ?? 200), 1), 2000);
  const result = await run(
    "docker",
    ["logs", "--tail", String(tail), "--timestamps", id],
    { timeout: 8000 },
  );
  const payload: OpsLogsResult = {
    id,
    tail,
    // docker logs 把应用日志同时写到 stdout/stderr，这里合并展示
    logs: `${result.stdout}${result.stderr}`.trimEnd(),
  };
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

async function handleK8sRestart(body: Record<string, unknown>) {
  const namespace = String(body.namespace ?? "default").trim();
  const deployment = String(body.deployment ?? "").trim();
  if (!deployment)
    return Response.json({ error: "缺少 deployment" }, { status: 400 });
  const result = await run(
    "kubectl",
    ["-n", namespace, "rollout", "restart", `deployment/${deployment}`],
    { timeout: 15000 },
  );
  const ok = result.code === 0;
  return Response.json(
    { ok, output: (result.stdout || result.stderr).trim() },
    { status: ok ? 200 : 500 },
  );
}

async function handleK8sScale(body: Record<string, unknown>) {
  const namespace = String(body.namespace ?? "default").trim();
  const deployment = String(body.deployment ?? "").trim();
  const replicas = Math.max(0, Math.min(Number(body.replicas ?? 1), 50));
  if (!deployment)
    return Response.json({ error: "缺少 deployment" }, { status: 400 });
  const result = await run(
    "kubectl",
    [
      "-n",
      namespace,
      "scale",
      `deployment/${deployment}`,
      `--replicas=${replicas}`,
    ],
    { timeout: 15000 },
  );
  const ok = result.code === 0;
  return Response.json(
    { ok, output: (result.stdout || result.stderr).trim() },
    { status: ok ? 200 : 500 },
  );
}

async function handleExec(body: Record<string, unknown>) {
  const command = String(body.command ?? "").trim();
  if (!command) return Response.json({ error: "命令为空" }, { status: 400 });
  const requestedCwd = String(body.cwd ?? HOME).trim() || HOME;
  const timeout = Math.min(Math.max(Number(body.timeout ?? 60000), 1000), 120000);

  // 在请求的工作目录中执行，并回传执行后的 pwd 以支持 cd 持久化
  const wrapped = `cd ${singleQuote(requestedCwd)} 2>/dev/null || cd ${singleQuote(
    HOME,
  )}; ${command}\n__ops_rc=$?; printf '\\n__OPS_CWD__:%s\\n' "$(pwd)"; exit $__ops_rc`;
  const result = await run("bash", ["-lc", wrapped], { timeout });

  let cwd = requestedCwd;
  let stdout = result.stdout;
  const marker = stdout.lastIndexOf("__OPS_CWD__:");
  if (marker >= 0) {
    const after = stdout.slice(marker + "__OPS_CWD__:".length);
    cwd = after.split("\n")[0]?.trim() || requestedCwd;
    stdout = stdout.slice(0, marker).replace(/\n$/, "");
  }

  const payload: OpsExecResult = {
    command,
    cwd,
    code: result.code,
    stdout,
    stderr: result.stderr,
  };
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}
