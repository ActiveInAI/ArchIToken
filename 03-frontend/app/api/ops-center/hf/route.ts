// app/api/ops-center/hf/route.ts
// License: Apache-2.0
// Hugging Face 本地模型缓存：调用 `hf cache list` 解析下载的模型/数据集与体积。
// 缓存较大，单独按需加载，并在 globalThis 上做 30s 缓存，避免重复扫描。
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

interface HfEntry {
  type: string; // model | dataset | space
  repo: string;
  size: string;
  sizeBytes: number;
  lastModified: string;
  refs: string;
}

interface HfResult {
  available: boolean;
  reason?: string;
  entries: HfEntry[];
  totalDisk: string;
  count: number;
}

interface HfCache {
  at: number;
  data: HfResult;
}

function parseSize(text: string): number {
  const match = text.trim().match(/^([\d.]+)\s*([KMGTP])?/i);
  if (!match || !match[1]) return 0;
  const value = Number.parseFloat(match[1]);
  const unit = (match[2] ?? "").toUpperCase();
  const mult: Record<string, number> = {
    "": 1,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
  };
  return value * (mult[unit] ?? 1);
}

export async function GET() {
  const store = globalThis as Record<string, unknown>;
  const cached = store.__opsHfCache as HfCache | undefined;
  const now = Date.now();
  if (cached && now - cached.at < 30000) {
    return Response.json(cached.data, { headers: { "cache-control": "no-store" } });
  }

  let data: HfResult;
  try {
    const { stdout } = await execFileAsync("hf", ["cache", "list"], {
      timeout: 25000,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
    const entries: HfEntry[] = [];
    let totalDisk = "";
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("id\t") || /^id\s+size/.test(trimmed)) continue;
      if (trimmed.startsWith("Found")) {
        const m = trimmed.match(/and\s+([\d.]+\s*[KMGTP]?)\s+on disk/i);
        if (m && m[1]) totalDisk = m[1].replace(/\s+/g, "");
        continue;
      }
      let cols = line.split("\t");
      if (cols.length < 2) cols = trimmed.split(/\s{2,}/);
      const id = (cols[0] ?? "").trim();
      const slash = id.indexOf("/");
      if (slash < 0) continue;
      entries.push({
        type: id.slice(0, slash),
        repo: id.slice(slash + 1),
        size: (cols[1] ?? "").trim(),
        sizeBytes: parseSize(cols[1] ?? ""),
        lastModified: (cols[3] ?? "").trim(),
        refs: (cols[4] ?? "").trim(),
      });
    }
    entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
    data = { available: true, entries, totalDisk, count: entries.length };
  } catch (error) {
    data = {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
      entries: [],
      totalDisk: "",
      count: 0,
    };
  }

  store.__opsHfCache = { at: now, data } satisfies HfCache;
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
