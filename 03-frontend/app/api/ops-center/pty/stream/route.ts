// app/api/ops-center/pty/stream/route.ts
// License: Apache-2.0
// PTY 输出的 SSE 通道：连接时先回放缓冲，再实时推送。数据用 encodeURIComponent 包装避免分帧问题。
import { hasSession, replay, subscribe } from "@/lib/ops-pty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id || !hasSession(id)) {
    return new Response("session not found", { status: 404 });
  }
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${encodeURIComponent(data)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      const history = replay(id);
      if (history) send(history);
      unsubscribe = subscribe(id, send);
      if (!unsubscribe) {
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      unsubscribe?.();
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
