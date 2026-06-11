// app/api/ops-center/jobs/route.ts
// License: Apache-2.0
// 模型启动任务：用 vLLM 加载 HF 模型 / 用 Ollama 拉取 HF GGUF；列出与停止。
import net from "node:net";
import { killJob, listJobs, removeJob, startJob } from "@/lib/ops-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

// 仅允许这些前缀的命令，避免任意命令执行
function sanitizeRepo(repo: string): string {
  return repo.replace(/[^A-Za-z0-9._/-]/g, "");
}

export async function GET() {
  return Response.json({ jobs: listJobs() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { op?: string; kind?: string; repo?: string; id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "请求体必须为 JSON" }, 400);
  }

  if (body.op === "stop") {
    if (!body.id) return json({ error: "缺少 id" }, 400);
    return json({ ok: killJob(body.id) });
  }
  if (body.op === "remove") {
    if (!body.id) return json({ error: "缺少 id" }, 400);
    return json({ ok: removeJob(body.id) });
  }
  if (body.op !== "start") {
    return json({ error: `未知操作: ${body.op}` }, 400);
  }

  const repo = sanitizeRepo(String(body.repo ?? ""));
  if (!repo) return json({ error: "缺少模型仓库 repo" }, 400);

  if (body.kind === "vllm") {
    const port = await freePort();
    const id = startJob({
      kind: "vllm",
      label: `vLLM · ${repo}`,
      command: "vllm",
      args: [
        "serve",
        repo,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--trust-remote-code",
      ],
      port,
    });
    return json({ ok: true, id, port });
  }

  if (body.kind === "ollama") {
    const id = startJob({
      kind: "ollama",
      label: `Ollama 拉取 · ${repo}`,
      command: "ollama",
      args: ["pull", `hf.co/${repo}`],
    });
    return json({ ok: true, id });
  }

  return json({ error: `未知任务类型: ${body.kind}` }, 400);
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
