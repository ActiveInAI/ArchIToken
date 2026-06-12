// app/api/ops-center/uniapi/route.ts
// License: Apache-2.0
// 云端大模型 API 网关运维状态（多网关：UniAPI / Agnes AI，?provider= 切换，默认 uniapi）：
// - 密钥发现（进程环境变量 / 主目录 .env*）与在线修改（写回 .env，立即生效）
// - 模型列表与余额用量探测（含延迟测量）；余额按网关风格分派：
//   uniapi → /v1/billing/usage?unit=usd（https://api-docs.uniapi.ai/）
//   agnes  → /v1/dashboard/billing/{subscription,usage}（OpenAI dashboard 风格，
//            https://agnes-ai.com/doc/overview，基地址 https://apihub.agnes-ai.com/v1）
// - 用量历史持久化（~/.architoken/ops/<id>-usage.json），计算 24h 消耗速率与余量预测
// - 低余额 / 密钥轮换周期告警阈值（UNIAPI_BALANCE_WARN_USD / UNIAPI_KEY_ROTATE_DAYS，全网关共用）
// - 端到端对话自检（chat-selftest，向廉价模型发送极小请求验证 /v1/chat/completions 链路）
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const PROBE_TIMEOUT = 8000;
const HISTORY_MIN_INTERVAL_MS = 5 * 60 * 1000;
const HISTORY_MAX_POINTS = 4032; // 5 分钟粒度约 14 天
const HISTORY_RETURN_POINTS = 200;

const LOW_BALANCE_WARN_USD = Number(process.env.UNIAPI_BALANCE_WARN_USD || 5);
const KEY_ROTATE_DAYS = Number(process.env.UNIAPI_KEY_ROTATE_DAYS || 90);

interface GatewayProvider {
  id: string;
  name: string;
  baseUrl: string;
  keyNames: string[];
  primaryKeyName: string;
  selftestModel: string;
  billingKind: "uniapi" | "openai-dashboard";
}

const PROVIDERS: Record<string, GatewayProvider> = {
  uniapi: {
    id: "uniapi",
    name: "UniAPI",
    baseUrl: (process.env.UNIAPI_BASE_URL || "https://api.uniapi.io").replace(/\/+$/, ""),
    keyNames: ["UNIAPI_API_KEY", "UNIAPI_KEY"],
    primaryKeyName: "UNIAPI_API_KEY",
    selftestModel: process.env.UNIAPI_SELFTEST_MODEL || "deepseek-v3.2",
    billingKind: "uniapi",
  },
  agnes: {
    id: "agnes",
    name: "Agnes AI",
    baseUrl: (process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com").replace(/\/+$/, ""),
    keyNames: ["AGNES_API_KEY", "AGNES_AI_API_KEY"],
    primaryKeyName: "AGNES_API_KEY",
    selftestModel: process.env.AGNES_SELFTEST_MODEL || "agnes-2.0-flash",
    billingKind: "openai-dashboard",
  },
};

function resolveProvider(request: Request): GatewayProvider {
  const id = new URL(request.url).searchParams.get("provider") ?? "uniapi";
  return PROVIDERS[id] ?? PROVIDERS.uniapi!;
}

function historyFile(provider: GatewayProvider): string {
  return path.join(os.homedir(), ".architoken", "ops", `${provider.id}-usage.json`);
}

export interface UniApiModel {
  id: string;
  ownedBy: string;
}

export interface UniApiBilling {
  balance: number;
  used: number;
  cacheUsed: number;
  unlimited: boolean;
}

export interface UniApiUsagePoint {
  ts: number;
  balance: number;
  used: number;
}

export interface UniApiStatus {
  provider: { id: string; name: string };
  configured: boolean;
  keyName?: string;
  keySource?: string;
  keyMasked?: string;
  keyUpdatedAt: number | null;
  baseUrl: string;
  reachable: boolean;
  reason?: string;
  latencyMs: number | null;
  models: UniApiModel[];
  billing: UniApiBilling | null;
  usageHistory: UniApiUsagePoint[];
  burnRatePerDay: number | null;
  daysRemaining: number | null;
  burnWindowSpanMs: number | null;
  burnWindowUsed: number | null;
  warnings: string[];
  thresholds: { lowBalanceUsd: number; keyRotateDays: number; selftestModel: string };
  generatedAt: string;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function maskKey(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// 密钥发现
// ---------------------------------------------------------------------------
interface FoundKey {
  name: string;
  value: string;
  source: string;
}

interface KeyCache {
  at: number;
  data: FoundKey | null;
}

// 与 ops-center 主路由的 detectProviders 同源策略：进程环境优先，其次扫描主目录 .env*
async function findApiKey(provider: GatewayProvider): Promise<FoundKey | null> {
  for (const name of provider.keyNames) {
    const value = process.env[name]?.trim();
    if (value && value.length > 3) {
      return { name, value, source: "进程环境变量" };
    }
  }

  const store = globalThis as Record<string, unknown>;
  const cacheBag = (store.__opsGatewayKeyCache ??= {}) as Record<string, KeyCache>;
  const cached = cacheBag[provider.id];
  const now = Date.now();
  if (cached && now - cached.at < 60000) return cached.data;

  let found: FoundKey | null = null;
  try {
    const pattern = provider.keyNames.join("|");
    const { stdout } = await execFileAsync(
      "bash",
      [
        "-lc",
        `find "$HOME" -maxdepth 4 \\( -name node_modules -o -name .git -o -name .next \\) -prune -o -type f -name '.env*' -print 2>/dev/null | grep -viE '\\.(example|sample|template)$' | head -100 | xargs -d '\\n' grep -HE '^(export +)?(${pattern})=' 2>/dev/null | head -10`,
      ],
      { timeout: 6000, maxBuffer: 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const sep = trimmed.indexOf(":");
      if (sep <= 0) continue;
      const file = trimmed.slice(0, sep);
      const cleaned = trimmed.slice(sep + 1).replace(/^export\s+/, "");
      const eq = cleaned.indexOf("=");
      if (eq <= 0) continue;
      const name = cleaned.slice(0, eq).trim();
      const value = cleaned
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (value.length > 3) {
        found = { name, value, source: file };
        break;
      }
    }
  } catch {
    /* 扫描失败视为未配置 */
  }
  cacheBag[provider.id] = { at: now, data: found } satisfies KeyCache;
  return found;
}

// ---------------------------------------------------------------------------
// 网关探测
// ---------------------------------------------------------------------------
async function fetchModels(
  provider: GatewayProvider,
  key: string,
): Promise<{ models: UniApiModel[]; latencyMs: number | null; reason?: string }> {
  const started = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/v1/models`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return {
        models: [],
        latencyMs,
        reason: `模型列表请求失败: ${response.status} ${response.statusText}`,
      };
    }
    const payload = (await response.json()) as {
      data?: Array<{ id?: string; owned_by?: string }>;
    };
    const models = (payload.data ?? [])
      .map((model) => ({ id: model.id ?? "", ownedBy: model.owned_by ?? "" }))
      .filter((model) => model.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    return { models, latencyMs };
  } catch (error) {
    return {
      models: [],
      latencyMs: null,
      reason: `${provider.name} 不可达: ${message(error)}`,
    };
  }
}

async function fetchBilling(
  provider: GatewayProvider,
  key: string,
): Promise<UniApiBilling | null> {
  return provider.billingKind === "uniapi"
    ? fetchBillingUniApi(provider, key)
    : fetchBillingOpenAiDashboard(provider, key);
}

async function fetchBillingUniApi(
  provider: GatewayProvider,
  key: string,
): Promise<UniApiBilling | null> {
  try {
    const response = await fetch(`${provider.baseUrl}/v1/billing/usage?unit=usd`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { balance?: number; used?: number; cache_used?: number };
    };
    if (!payload.success || !payload.data) return null;
    const balance = Number(payload.data.balance ?? 0);
    return {
      balance,
      used: Number(payload.data.used ?? 0),
      cacheUsed: Number(payload.data.cache_used ?? 0),
      unlimited: balance === -1,
    };
  } catch {
    return null; // 余额查询失败不影响主体
  }
}

// OpenAI dashboard 风格：subscription 给额度上限，usage 给累计消耗（单位为美分）
const DASHBOARD_UNLIMITED_USD = 10_000_000;

async function fetchBillingOpenAiDashboard(
  provider: GatewayProvider,
  key: string,
): Promise<UniApiBilling | null> {
  try {
    const headers = { authorization: `Bearer ${key}` };
    const [subRes, usageRes] = await Promise.all([
      fetch(`${provider.baseUrl}/v1/dashboard/billing/subscription`, {
        headers,
        signal: AbortSignal.timeout(PROBE_TIMEOUT),
        cache: "no-store",
      }),
      fetch(
        `${provider.baseUrl}/v1/dashboard/billing/usage?start_date=2023-01-01&end_date=2099-01-01`,
        { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT), cache: "no-store" },
      ),
    ]);
    if (!subRes.ok) return null;
    const sub = (await subRes.json()) as { hard_limit_usd?: number };
    const usage = usageRes.ok
      ? ((await usageRes.json()) as { total_usage?: number })
      : { total_usage: 0 };
    const limit = Number(sub.hard_limit_usd ?? 0);
    const used = Number(usage.total_usage ?? 0) / 100;
    const unlimited = limit >= DASHBOARD_UNLIMITED_USD;
    return {
      balance: unlimited ? -1 : Math.max(0, limit - used),
      used,
      cacheUsed: 0,
      unlimited,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 用量历史持久化
// ---------------------------------------------------------------------------
interface HistoryStore {
  points: UniApiUsagePoint[];
  meta: { keyUpdatedAt?: number };
}

async function loadHistory(provider: GatewayProvider): Promise<HistoryStore> {
  try {
    const text = await fs.readFile(historyFile(provider), "utf8");
    const parsed = JSON.parse(text) as Partial<HistoryStore>;
    return {
      points: Array.isArray(parsed.points) ? parsed.points : [],
      meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
    };
  } catch {
    return { points: [], meta: {} };
  }
}

async function saveHistory(provider: GatewayProvider, store: HistoryStore): Promise<void> {
  try {
    const file = historyFile(provider);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(store), "utf8");
  } catch {
    /* 持久化失败不影响主体 */
  }
}

async function recordUsage(
  provider: GatewayProvider,
  billing: UniApiBilling | null,
): Promise<HistoryStore> {
  const store = await loadHistory(provider);
  if (!billing) return store;
  const now = Date.now();
  const last = store.points[store.points.length - 1];
  if (!last || now - last.ts >= HISTORY_MIN_INTERVAL_MS || billing.used !== last.used) {
    store.points.push({ ts: now, balance: billing.balance, used: billing.used });
    if (store.points.length > HISTORY_MAX_POINTS) {
      store.points = store.points.slice(-HISTORY_MAX_POINTS);
    }
    await saveHistory(provider, store);
  }
  return store;
}

function thinPoints(points: UniApiUsagePoint[], max: number): UniApiUsagePoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: UniApiUsagePoint[] = [];
  for (let index = 0; index < max; index += 1) {
    const point = points[Math.floor(index * step)];
    if (point) out.push(point);
  }
  const lastPoint = points[points.length - 1];
  if (lastPoint && out[out.length - 1] !== lastPoint) out.push(lastPoint);
  return out;
}

// 日消耗估算的最小样本跨度：不足 6 小时不做外推，避免把短时测试放大成误导性的"日速率"
const MIN_BURN_SPAN_MS = 6 * 3600 * 1000;

interface BurnInfo {
  burnRatePerDay: number | null;
  windowSpanMs: number | null;
  windowUsed: number | null;
}

// 用 24h 窗口内最早的点估算日消耗；同时返回真实测得的窗口跨度与消耗，便于前端如实展示
function computeBurnRate(points: UniApiUsagePoint[]): BurnInfo {
  if (points.length < 2) return { burnRatePerDay: null, windowSpanMs: null, windowUsed: null };
  const now = Date.now();
  const windowStart = now - 24 * 3600 * 1000;
  const inWindow = points.filter((point) => point.ts >= windowStart);
  const base = inWindow.length >= 2 ? inWindow[0] : points[points.length - 2];
  const latest = points[points.length - 1];
  if (!base || !latest) return { burnRatePerDay: null, windowSpanMs: null, windowUsed: null };
  const spanMs = latest.ts - base.ts;
  const usedDelta = latest.used - base.used;
  if (spanMs <= 0 || usedDelta < 0) {
    return { burnRatePerDay: null, windowSpanMs: null, windowUsed: null }; // 账户重置/换号
  }
  return {
    burnRatePerDay: spanMs >= MIN_BURN_SPAN_MS ? (usedDelta / spanMs) * 24 * 3600 * 1000 : null,
    windowSpanMs: spanMs,
    windowUsed: usedDelta,
  };
}

// ---------------------------------------------------------------------------
// GET：状态快照
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const provider = resolveProvider(request);
  const generatedAt = new Date().toISOString();
  const thresholds = {
    lowBalanceUsd: LOW_BALANCE_WARN_USD,
    keyRotateDays: KEY_ROTATE_DAYS,
    selftestModel: provider.selftestModel,
  };
  const found = await findApiKey(provider);
  if (!found) {
    const status: UniApiStatus = {
      provider: { id: provider.id, name: provider.name },
      configured: false,
      keyUpdatedAt: null,
      baseUrl: provider.baseUrl,
      reachable: false,
      reason: `未发现 ${provider.keyNames.join(" / ")}（进程环境变量或主目录 .env* 文件）`,
      latencyMs: null,
      models: [],
      billing: null,
      usageHistory: [],
      burnRatePerDay: null,
      daysRemaining: null,
      burnWindowSpanMs: null,
      burnWindowUsed: null,
      warnings: [],
      thresholds,
      generatedAt,
    };
    return Response.json(status, { headers: { "cache-control": "no-store" } });
  }

  const [modelsResult, billing] = await Promise.all([
    fetchModels(provider, found.value),
    fetchBilling(provider, found.value),
  ]);
  const history = await recordUsage(provider, billing);
  const burn = computeBurnRate(history.points);
  const burnRatePerDay = burn.burnRatePerDay;
  const daysRemaining =
    billing && !billing.unlimited && burnRatePerDay && burnRatePerDay > 0
      ? billing.balance / burnRatePerDay
      : null;

  const warnings: string[] = [];
  if (billing && !billing.unlimited && billing.balance < LOW_BALANCE_WARN_USD) {
    warnings.push(
      `余额 $${billing.balance.toFixed(2)} 低于告警阈值 $${LOW_BALANCE_WARN_USD}（可用 UNIAPI_BALANCE_WARN_USD 调整），请及时充值。`,
    );
  }
  const keyUpdatedAt = history.meta.keyUpdatedAt ?? null;
  if (keyUpdatedAt && Date.now() - keyUpdatedAt > KEY_ROTATE_DAYS * 24 * 3600 * 1000) {
    warnings.push(
      `密钥已 ${Math.floor((Date.now() - keyUpdatedAt) / (24 * 3600 * 1000))} 天未轮换（阈值 ${KEY_ROTATE_DAYS} 天，可用 UNIAPI_KEY_ROTATE_DAYS 调整）。`,
    );
  }

  const status: UniApiStatus = {
    provider: { id: provider.id, name: provider.name },
    configured: true,
    keyName: found.name,
    keySource: found.source,
    keyMasked: maskKey(found.value),
    keyUpdatedAt,
    baseUrl: provider.baseUrl,
    reachable: modelsResult.models.length > 0 || !modelsResult.reason,
    ...(modelsResult.reason ? { reason: modelsResult.reason } : {}),
    latencyMs: modelsResult.latencyMs,
    models: modelsResult.models,
    billing,
    usageHistory: thinPoints(history.points, HISTORY_RETURN_POINTS),
    burnRatePerDay,
    daysRemaining,
    burnWindowSpanMs: burn.windowSpanMs,
    burnWindowUsed: burn.windowUsed,
    warnings,
    thresholds,
    generatedAt,
  };
  return Response.json(status, { headers: { "cache-control": "no-store" } });
}

// ---------------------------------------------------------------------------
// POST：操作分发（set-key / chat-selftest）
// ---------------------------------------------------------------------------
async function findKeyEnvFile(provider: GatewayProvider): Promise<string | null> {
  try {
    const pattern = provider.keyNames.join("|");
    // 只匹配已有非空取值的行，并排除 example/sample/template 模板文件，避免把真实密钥写进模板
    const { stdout } = await execFileAsync(
      "bash",
      [
        "-lc",
        `find "$HOME" -maxdepth 4 \\( -name node_modules -o -name .git -o -name .next \\) -prune -o -type f -name '.env*' -print 2>/dev/null | grep -viE '\\.(example|sample|template)$' | head -100 | xargs -d '\\n' grep -lE '^(export +)?(${pattern})=..+' 2>/dev/null | head -1`,
      ],
      { timeout: 6000, maxBuffer: 1024 * 1024 },
    );
    const file = stdout.split("\n")[0]?.trim();
    if (!file || /\.(example|sample|template)$/i.test(file)) return null;
    return file;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const provider = resolveProvider(request);
  let body: { op?: string; key?: string; model?: string; provider?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "请求体必须为 JSON" }, { status: 400 });
  }
  const bodyProvider = body.provider ? PROVIDERS[body.provider] : null;
  const target = bodyProvider ?? provider;
  switch (body.op) {
    case "set-key":
      return handleSetKey(target, String(body.key ?? ""));
    case "chat-selftest":
      return handleChatSelftest(target, body.model ? String(body.model) : target.selftestModel);
    default:
      return Response.json({ error: `未知操作: ${body.op}` }, { status: 400 });
  }
}

async function handleSetKey(provider: GatewayProvider, rawKey: string) {
  const key = rawKey.trim();
  if (!/^[A-Za-z0-9._-]{8,256}$/.test(key)) {
    return Response.json(
      { error: "密钥格式不合法（仅允许字母、数字、._-，长度 8–256）" },
      { status: 400 },
    );
  }

  const targetFile =
    (await findKeyEnvFile(provider)) ?? path.join(process.cwd(), ".env.local");
  const keyLineRe = new RegExp(`^(export\\s+)?(${provider.keyNames.join("|")})=`);
  try {
    let text = "";
    try {
      text = await fs.readFile(targetFile, "utf8");
    } catch {
      /* 文件不存在则新建 */
    }
    const lines = text.split("\n");
    let replaced = false;
    const next = lines.map((line) => {
      if (!replaced && keyLineRe.test(line.trim())) {
        replaced = true;
        return `${provider.primaryKeyName}=${key}`;
      }
      return line;
    });
    if (!replaced) {
      while (next.length > 0 && next[next.length - 1] === "") next.pop();
      next.push(
        "",
        `# ${provider.name} 云端大模型网关（运维中心「API 网关」页）`,
        `${provider.primaryKeyName}=${key}`,
        "",
      );
    }
    await fs.writeFile(targetFile, next.join("\n"), "utf8");
  } catch (error) {
    return Response.json(
      { error: `写入 ${targetFile} 失败: ${message(error)}` },
      { status: 500 },
    );
  }

  process.env[provider.primaryKeyName] = key;
  const store = globalThis as Record<string, unknown>;
  const cacheBag = (store.__opsGatewayKeyCache ??= {}) as Record<string, KeyCache>;
  delete cacheBag[provider.id];

  // 记录轮换时间，供轮换周期告警使用
  const history = await loadHistory(provider);
  history.meta.keyUpdatedAt = Date.now();
  await saveHistory(provider, history);

  // 立即用新密钥探测一次，回传校验结果
  const probe = await fetchModels(provider, key);
  return Response.json(
    {
      ok: true,
      file: targetFile,
      keyMasked: maskKey(key),
      reachable: probe.models.length > 0 || !probe.reason,
      ...(probe.reason ? { reason: probe.reason } : {}),
      modelCount: probe.models.length,
      latencyMs: probe.latencyMs,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

// 端到端对话自检：发送极小请求验证 /v1/chat/completions 全链路（约 1e-4 美元量级）
async function handleChatSelftest(provider: GatewayProvider, model: string) {
  if (!/^[\w.\-:/]{1,128}$/.test(model)) {
    return Response.json({ error: "模型 ID 不合法" }, { status: 400 });
  }
  const found = await findApiKey(provider);
  if (!found) {
    return Response.json({ error: `未配置 ${provider.name} 密钥` }, { status: 400 });
  }
  const started = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${found.value}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        temperature: 0,
        messages: [{ role: "user", content: "回复 PONG 两个字母即可" }],
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
      model?: string;
      usage?: { total_tokens?: number };
    } | null;
    if (!response.ok || !payload?.choices?.length) {
      return Response.json(
        {
          ok: false,
          model,
          latencyMs,
          error:
            payload?.error?.message ||
            `HTTP ${response.status} ${response.statusText}`,
        },
        { status: 502 },
      );
    }
    return Response.json(
      {
        ok: true,
        model: payload.model ?? model,
        latencyMs,
        reply: (payload.choices[0]?.message?.content ?? "").slice(0, 200),
        totalTokens: payload.usage?.total_tokens ?? null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { ok: false, model, latencyMs: Date.now() - started, error: message(error) },
      { status: 502 },
    );
  }
}
