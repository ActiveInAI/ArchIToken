// app/api/ops-center/fs/route.ts
// License: Apache-2.0
// 在线代码编辑的文件系统后端：列目录 / 读文件 / 写文件（限主目录内）。
import { promises as fs } from "node:fs";
import path from "node:path";
import { OPS_ROOT, resolveSafe, toRel } from "@/lib/ops-center-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_READ_BYTES = 2 * 1024 * 1024;
const IGNORE = new Set([".git", "node_modules", ".next", ".turbo", "dist", "build"]);

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op") ?? "list";
  const rawPath = url.searchParams.get("path") ?? "";
  try {
    const target = resolveSafe(rawPath);
    if (op === "read") {
      const stat = await fs.stat(target);
      if (!stat.isFile()) return json({ error: "不是文件" }, 400);
      if (stat.size > MAX_READ_BYTES)
        return json({ error: `文件过大（${stat.size} 字节），上限 2MB` }, 413);
      const content = await fs.readFile(target, "utf8");
      return json({
        path: toRel(target),
        absolute: target,
        size: stat.size,
        content,
      });
    }
    // op === "list"
    const stat = await fs.stat(target);
    const dir = stat.isDirectory() ? target : path.dirname(target);
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const entries = await Promise.all(
      dirents.map(async (dirent) => {
        const full = path.join(dir, dirent.name);
        let size = 0;
        if (dirent.isFile()) {
          try {
            size = (await fs.stat(full)).size;
          } catch {
            size = 0;
          }
        }
        return {
          name: dirent.name,
          type: dirent.isDirectory() ? ("dir" as const) : ("file" as const),
          size,
          path: toRel(full),
          ignored: IGNORE.has(dirent.name),
        };
      }),
    );
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return json({
      dir: toRel(dir),
      parent: dir === OPS_ROOT ? null : toRel(path.dirname(dir)),
      entries,
    });
  } catch (error) {
    return json({ error: message(error) }, 400);
  }
}

export async function POST(request: Request) {
  let body: { op?: string; path?: string; content?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "请求体必须为 JSON" }, 400);
  }
  if (body.op !== "write") return json({ error: "仅支持 op=write" }, 400);
  if (typeof body.content !== "string") return json({ error: "缺少 content" }, 400);
  try {
    const target = resolveSafe(body.path ?? "");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body.content, "utf8");
    const stat = await fs.stat(target);
    return json({ ok: true, path: toRel(target), size: stat.size });
  } catch (error) {
    return json({ error: message(error) }, 400);
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
