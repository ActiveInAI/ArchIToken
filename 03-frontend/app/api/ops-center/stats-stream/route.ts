// app/api/ops-center/stats-stream/route.ts
// License: Apache-2.0
// 容器资源曲线的 SSE 流：每 2.5s 采一帧 docker stats，推送全部运行中容器的 CPU/内存。
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const INTERVAL_MS = 2500;

interface StatsRow {
  Name?: string;
  CPUPerc?: string;
  MemPerc?: string;
  MemUsage?: string;
}

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const num = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(num) ? num : 0;
}

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };
      while (!closed) {
        try {
          const { stdout } = await execFileAsync(
            "docker",
            ["stats", "--no-stream", "--format", "{{json .}}"],
            { timeout: 8000, maxBuffer: 4 * 1024 * 1024 },
          );
          const rows = stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              try {
                return JSON.parse(line) as StatsRow;
              } catch {
                return null;
              }
            })
            .filter((row): row is StatsRow => row !== null)
            .map((row) => ({
              name: row.Name ?? "",
              cpu: parsePercent(row.CPUPerc),
              mem: parsePercent(row.MemPerc),
              memUsage: row.MemUsage ?? "",
            }));
          if (!closed) emit({ t: Date.now(), rows });
        } catch (error) {
          if (!closed) emit({ t: Date.now(), error: String(error), rows: [] });
        }
        await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
    },
  });
}
