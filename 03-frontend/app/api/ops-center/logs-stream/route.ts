// app/api/ops-center/logs-stream/route.ts
// License: Apache-2.0
// 容器日志的 SSE 实时流：docker logs --follow，客户端断开即终止子进程。
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const tail = Math.min(Math.max(Number(url.searchParams.get("tail") ?? 200), 1), 2000);
  if (!id) return new Response("missing id", { status: 400 });

  const child = spawn(
    "docker",
    ["logs", "--follow", "--tail", String(tail), "--timestamps", id],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: Buffer) => {
        try {
          controller.enqueue(encoder.encode(`data: ${encodeURIComponent(chunk.toString())}\n\n`));
        } catch {
          /* closed */
        }
      };
      child.stdout.on("data", send);
      child.stderr.on("data", send);
      child.on("close", () => {
        try {
          controller.enqueue(encoder.encode("event: end\ndata: end\n\n"));
          controller.close();
        } catch {
          /* ignore */
        }
      });
      child.on("error", (error) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${encodeURIComponent(`[error] ${error.message}`)}\n\n`),
          );
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      child.kill("SIGTERM");
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
