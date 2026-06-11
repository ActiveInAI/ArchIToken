// app/api/ops-center/ports/route.ts
// License: Apache-2.0
// 端口/服务总览：聚合主机监听端口(ss) + 容器端口映射(docker) + HTTP 可达探测，
// 便于按端口直接打开/管理各服务。
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type Scope = "lan" | "local" | "other";

interface PortEntry {
  port: number;
  scope: Scope;
  process: string;
  pid: number | null;
  container: string | null;
  http: boolean;
}

interface Listener {
  port: number;
  scope: Scope;
  process: string;
  pid: number | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function scopeOf(addr: string): Scope {
  if (addr === "0.0.0.0" || addr === "*" || addr === "[::]" || addr === "::") return "lan";
  if (addr === "127.0.0.1" || addr === "[::1]" || addr === "::1") return "local";
  return "other";
}

async function listListeners(errors: string[]): Promise<Listener[]> {
  try {
    const { stdout } = await execFileAsync("ss", ["-tlnpH"], {
      timeout: 5000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const out: Listener[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cols = trimmed.split(/\s+/);
      const local = cols[3] ?? "";
      const idx = local.lastIndexOf(":");
      if (idx < 0) continue;
      const addr = local.slice(0, idx);
      const port = Number(local.slice(idx + 1));
      if (!Number.isFinite(port) || port <= 0) continue;
      const procPart = cols.slice(5).join(" ");
      const match = procPart.match(/"([^"]+)",pid=(\d+)/);
      out.push({
        port,
        scope: scopeOf(addr),
        process: match ? (match[1] ?? "") : "",
        pid: match ? Number(match[2]) : null,
      });
    }
    return out;
  } catch (error) {
    errors.push(`ss 监听端口获取失败: ${message(error)}`);
    return [];
  }
}

async function dockerPortMap(errors: string[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["ps", "--format", "{{.Names}}\t{{.Ports}}"],
      { timeout: 5000, maxBuffer: 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      const [name, ports] = line.split("\t");
      if (!name || !ports) continue;
      const re = /(?:0\.0\.0\.0|127\.0\.0\.1|\[::\]|\*):(\d+)->/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(ports)) !== null) {
        const hostPort = Number(match[1]);
        if (Number.isFinite(hostPort) && !map.has(hostPort)) map.set(hostPort, name);
      }
    }
  } catch (error) {
    errors.push(`docker 端口映射获取失败: ${message(error)}`);
  }
  return map;
}

async function probeHttp(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(700),
      redirect: "manual",
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const errors: string[] = [];
  const [listeners, dockerMap] = await Promise.all([
    listListeners(errors),
    dockerPortMap(errors),
  ]);

  const byPort = new Map<number, PortEntry>();
  for (const listener of listeners) {
    const existing = byPort.get(listener.port);
    if (existing) {
      if (listener.scope === "lan") existing.scope = "lan";
      if (!existing.process && listener.process) {
        existing.process = listener.process;
        existing.pid = listener.pid;
      }
    } else {
      byPort.set(listener.port, {
        port: listener.port,
        scope: listener.scope,
        process: listener.process,
        pid: listener.pid,
        container: dockerMap.get(listener.port) ?? null,
        http: false,
      });
    }
  }

  const ports = Array.from(byPort.values());
  await Promise.allSettled(
    ports.map(async (entry) => {
      entry.http = await probeHttp(entry.port);
    }),
  );
  ports.sort((a, b) => a.port - b.port);

  return Response.json(
    { generatedAt: new Date().toISOString(), ports, errors },
    { headers: { "cache-control": "no-store" } },
  );
}
