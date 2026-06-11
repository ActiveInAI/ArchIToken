// app/api/ops-center/pty/route.ts
// License: Apache-2.0
// PTY 会话控制：创建 / 输入 / 调整大小 / 结束。输出通过 ./stream 的 SSE 推送。
import {
  createSession,
  killSession,
  listSessions,
  resizeSession,
  writeSession,
} from "@/lib/ops-pty";
import { resolveSafe } from "@/lib/ops-center-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sessions: listSessions() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  let body: {
    op?: string;
    id?: string;
    data?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "请求体必须为 JSON" }, { status: 400 });
  }

  switch (body.op) {
    case "create": {
      let cwd: string | undefined;
      if (body.cwd) {
        try {
          cwd = resolveSafe(body.cwd);
        } catch {
          cwd = undefined;
        }
      }
      const id = createSession({
        ...(cwd ? { cwd } : {}),
        cols: Number(body.cols) || 80,
        rows: Number(body.rows) || 24,
      });
      return json({ ok: true, id });
    }
    case "input": {
      if (!body.id || typeof body.data !== "string")
        return json({ error: "缺少 id 或 data" }, 400);
      return json({ ok: writeSession(body.id, body.data) });
    }
    case "resize": {
      if (!body.id) return json({ error: "缺少 id" }, 400);
      return json({
        ok: resizeSession(body.id, Number(body.cols) || 80, Number(body.rows) || 24),
      });
    }
    case "kill": {
      if (!body.id) return json({ error: "缺少 id" }, 400);
      return json({ ok: killSession(body.id) });
    }
    default:
      return json({ error: `未知操作: ${body.op}` }, 400);
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
