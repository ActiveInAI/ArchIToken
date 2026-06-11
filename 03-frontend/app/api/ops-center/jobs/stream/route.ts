// app/api/ops-center/jobs/stream/route.ts
// License: Apache-2.0
// 任务日志 SSE：连接时回放缓冲，再实时推送。数据 encodeURIComponent 包装避免分帧。
import { hasJob, replayJob, subscribeJob } from "@/lib/ops-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id || !hasJob(id)) {
    return new Response("job not found", { status: 404 });
  }
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${encodeURIComponent(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      const history = replayJob(id);
      if (history) send(history);
      unsubscribe = subscribeJob(id, send);
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
