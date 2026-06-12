// components/ops/OpsUniApi.tsx
// License: Apache-2.0
// UniAPI 云端大模型网关运维面板：连接状态与延迟、余额/消耗速率/余量预测、用量趋势、
// 低余额与密钥轮换告警、密钥在线修改（审计留痕）、端到端对话自检、可筛选可复制的模型列表。
// 官网 https://uniapi.ai/ · 使用文档 https://docs.uniapi.ai/ · 接口文档 https://api-docs.uniapi.ai/
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Empty, Input, Segmented, Spin, Tag } from "@/components/pan-ui";
import {
  Activity,
  Boxes,
  Check,
  CircleDollarSign,
  Cloud,
  Copy,
  ExternalLink,
  KeyRound,
  Pencil,
  RefreshCcw,
  Stethoscope,
  TrendingUp,
  Wallet,
} from "lucide-react";

interface UniApiModel {
  id: string;
  ownedBy: string;
}

interface UniApiBilling {
  balance: number;
  used: number;
  cacheUsed: number;
  unlimited: boolean;
}

interface UniApiUsagePoint {
  ts: number;
  balance: number;
  used: number;
}

interface UniApiStatus {
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

type GatewayId = "uniapi" | "agnes";

// 按字母排序展示
const GATEWAY_OPTIONS: Array<{ label: string; value: GatewayId }> = [
  { label: "Agnes AI", value: "agnes" },
  { label: "UniAPI", value: "uniapi" },
];

const GATEWAY_DOCS: Record<GatewayId, Array<{ label: string; url: string }>> = {
  uniapi: [
    { label: "官网", url: "https://uniapi.ai/" },
    { label: "使用文档", url: "https://docs.uniapi.ai/" },
    { label: "接口文档", url: "https://api-docs.uniapi.ai/" },
  ],
  agnes: [
    { label: "官网", url: "https://agnes-ai.com/" },
    { label: "开发者文档", url: "https://agnes-ai.com/doc/overview" },
  ],
};

const AUTO_REFRESH_MS = 60000;

function formatUsd(value: number): string {
  return `$${value >= 100 ? value.toFixed(2) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function OpsUniApi({
  onAudit,
}: {
  onAudit?: ((action: string, detail: string) => void) | undefined;
}) {
  // 默认选中最左侧（字母序第一个）网关
  const [gateway, setGateway] = useState<GatewayId>(GATEWAY_OPTIONS[0]!.value);
  const [status, setStatus] = useState<UniApiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyNotice, setKeyNotice] = useState<string | null>(null);
  const [selftesting, setSelftesting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await fetch(`/api/ops-center/uniapi?provider=${gateway}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as UniApiStatus;
        setStatus(data);
      } catch {
        if (!silent) setStatus(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [gateway],
  );

  useEffect(() => {
    let active = true;
    fetch(`/api/ops-center/uniapi?provider=${gateway}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: UniApiStatus) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active)
          setStatus({
            provider: {
              id: gateway,
              name: GATEWAY_OPTIONS.find((option) => option.value === gateway)?.label ?? gateway,
            },
            configured: false,
            keyUpdatedAt: null,
            baseUrl: "",
            reachable: false,
            reason: "状态接口请求失败",
            latencyMs: null,
            models: [],
            billing: null,
            usageHistory: [],
            burnRatePerDay: null,
            daysRemaining: null,
            burnWindowSpanMs: null,
            burnWindowUsed: null,
            warnings: [],
            thresholds: { lowBalanceUsd: 5, keyRotateDays: 90, selftestModel: "deepseek-v3.2" },
            generatedAt: new Date().toISOString(),
          });
      });
    const timer = window.setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [gateway, load]);

  const saveKey = useCallback(async () => {
    const value = keyDraft.trim();
    if (!value) {
      setKeyError("密钥不能为空");
      return;
    }
    setKeySaving(true);
    setKeyError(null);
    setKeyNotice(null);
    try {
      const response = await fetch("/api/ops-center/uniapi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "set-key", key: value, provider: gateway }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        file?: string;
        reachable?: boolean;
        reason?: string;
        modelCount?: number;
      };
      if (!response.ok || !data.ok) throw new Error(data.error || "保存失败");
      setEditingKey(false);
      setKeyDraft("");
      setKeyNotice(
        data.reachable
          ? `密钥已保存到 ${data.file}，校验通过（${data.modelCount} 个模型可用）`
          : `密钥已保存到 ${data.file}，但校验未通过：${data.reason ?? "网关不可达"}`,
      );
      onAudit?.(
        "ops-uniapi-set-key",
        `file=${data.file}; reachable=${data.reachable}; models=${data.modelCount ?? 0}`,
      );
      await load();
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setKeySaving(false);
    }
  }, [keyDraft, load, onAudit, gateway]);

  const runSelftest = useCallback(async () => {
    const model = status?.thresholds.selftestModel ?? "deepseek-v3.2";
    if (
      !window.confirm(
        `将通过 ${model} 发送一次极小的对话请求（约 $0.0001 量级），验证 /v1/chat/completions 端到端可用。继续？`,
      )
    ) {
      return;
    }
    setSelftesting(true);
    setKeyError(null);
    setKeyNotice(null);
    try {
      const response = await fetch("/api/ops-center/uniapi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "chat-selftest", provider: gateway }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        model?: string;
        latencyMs?: number;
        reply?: string;
        totalTokens?: number | null;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(
          `自检失败（${data.model ?? model}，${data.latencyMs ?? "?"}ms）：${data.error ?? "未知错误"}`,
        );
      }
      setKeyNotice(
        `对话自检通过：${data.model} 在 ${data.latencyMs}ms 内返回「${(data.reply ?? "").trim()}」` +
          (data.totalTokens ? `，消耗 ${data.totalTokens} tokens` : ""),
      );
      onAudit?.("ops-uniapi-selftest", `model=${data.model}; latency=${data.latencyMs}ms; ok=true`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "自检失败";
      setKeyError(text);
      onAudit?.("ops-uniapi-selftest", `ok=false; ${text.slice(0, 160)}`);
    } finally {
      setSelftesting(false);
    }
  }, [status, onAudit, gateway]);

  const providerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of status?.models ?? []) {
      const key = model.ownedBy || "未知";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [status]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (status?.models ?? []).filter((model) => {
      if (provider !== "all" && (model.ownedBy || "未知") !== provider) return false;
      if (!text) return true;
      return `${model.id} ${model.ownedBy}`.toLowerCase().includes(text);
    });
  }, [status, query, provider]);

  const copyModelId = useCallback((id: string) => {
    void navigator.clipboard?.writeText(id);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((value) => (value === id ? null : value)), 1500);
  }, []);

  const keyEditor = (
    <span className="flex min-w-0 items-center gap-1">
      <span className="w-80 max-w-full">
        <Input
          size="small"
          type="password"
          placeholder="粘贴 UNIAPI_API_KEY（sk-…）"
          value={keyDraft}
          onChange={(event) => setKeyDraft(event.target.value)}
          onPressEnter={() => void saveKey()}
        />
      </span>
      <Button size="small" type="primary" loading={keySaving} onClick={() => void saveKey()}>
        保存
      </Button>
      {editingKey ? (
        <Button
          size="small"
          type="text"
          disabled={keySaving}
          onClick={() => {
            setEditingKey(false);
            setKeyDraft("");
            setKeyError(null);
          }}
        >
          取消
        </Button>
      ) : null}
    </span>
  );

  const keyMessages = (
    <>
      {keyError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {keyError}
        </div>
      ) : null}
      {keyNotice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {keyNotice}
        </div>
      ) : null}
    </>
  );

  const gatewaySwitcher = (
    <Segmented options={GATEWAY_OPTIONS} value={gateway} onChange={setGateway} />
  );

  const docLinks = (
    <span className="flex items-center gap-1">
      {GATEWAY_DOCS[gateway].map((link) => (
        <Button
          key={link.url}
          size="small"
          type="text"
          icon={<ExternalLink className="h-3.5 w-3.5" />}
          href={link.url}
          target="_blank"
          rel="noreferrer"
        >
          {link.label}
        </Button>
      ))}
    </span>
  );

  // 切换网关后旧状态不匹配时回到加载态，等待新网关数据
  if (status === null || status.provider.id !== gateway) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">{gatewaySwitcher}</div>
        <div className="flex flex-1 items-center justify-center py-16">
          <Spin tip="探测 API 网关…" />
        </div>
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          {gatewaySwitcher}
          {docLinks}
          <Button
            size="small"
            className="ml-auto"
            icon={<RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => void load()}
            disabled={loading}
          >
            重新探测
          </Button>
        </div>
        {keyMessages}
        <Empty
          description={
            <div className="space-y-2">
              <p>尚未配置 {status.provider.name} 密钥</p>
              <p className="arch-muted text-xs">{status.reason}</p>
              <p className="arch-muted text-xs">
                在 {status.provider.name} 控制台创建密钥后，粘贴到下方保存即可（写入前端
                .env.local）。
              </p>
              <div className="flex justify-center">{keyEditor}</div>
            </div>
          }
        />
      </div>
    );
  }

  const billing = status.billing;
  const lowBalance =
    billing !== null && !billing.unlimited && billing.balance < status.thresholds.lowBalanceUsd;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="flex flex-wrap items-center gap-2">
        {gatewaySwitcher}
        <Tag color={status.reachable ? "green" : "slate"} icon={<Cloud className="h-3.5 w-3.5" />}>
          {status.baseUrl.replace("https://", "")} {status.reachable ? "在线" : "离线"}
          {status.latencyMs !== null ? ` · ${status.latencyMs}ms` : ""}
        </Tag>
        {editingKey ? (
          keyEditor
        ) : (
          <button
            type="button"
            title="点击修改密钥"
            onClick={() => {
              setEditingKey(true);
              setKeyNotice(null);
            }}
            className="group inline-flex max-w-full items-center"
          >
            <Tag color="cyan" icon={<KeyRound className="h-3.5 w-3.5" />}>
              {status.keyName} · {status.keyMasked}
              <Pencil className="ml-1 inline h-3 w-3 opacity-40 transition group-hover:opacity-100" />
            </Tag>
          </button>
        )}
        {docLinks}
        <span className="ml-auto flex items-center gap-1">
          <Button
            size="small"
            icon={<Stethoscope className="h-4 w-4" />}
            loading={selftesting}
            onClick={() => void runSelftest()}
          >
            对话自检
          </Button>
          <Button
            size="small"
            icon={<RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => void load()}
            disabled={loading}
          >
            刷新
          </Button>
        </span>
      </div>

      {keyMessages}
      {status.warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
        >
          {warning}
        </div>
      ))}
      {status.reason ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {status.reason}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <UniMetric
          icon={<Boxes className="h-4 w-4" />}
          label="可用模型"
          value={`${status.models.length}`}
          hint="GET /v1/models"
        />
        <UniMetric
          icon={<Wallet className="h-4 w-4" />}
          label="余额"
          value={billing ? (billing.unlimited ? "不限" : formatUsd(billing.balance)) : "—"}
          hint={
            billing
              ? `USD · 低于 $${status.thresholds.lowBalanceUsd} 告警`
              : "余额接口不可用"
          }
          tone={lowBalance ? (billing && billing.balance <= 0 ? "rose" : "amber") : "emerald"}
        />
        <UniMetric
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="累计消耗"
          value={billing ? formatUsd(billing.used) : "—"}
          hint={billing && billing.cacheUsed > 0 ? `待扣缓存 ${formatUsd(billing.cacheUsed)}` : "USD"}
        />
        <UniMetric
          icon={<TrendingUp className="h-4 w-4" />}
          label="日消耗速率"
          value={
            status.burnRatePerDay !== null
              ? `${formatUsd(status.burnRatePerDay)}/天`
              : status.burnWindowUsed !== null && status.burnWindowSpanMs !== null
                ? formatUsd(status.burnWindowUsed)
                : "—"
          }
          hint={
            status.burnRatePerDay !== null
              ? status.daysRemaining !== null
                ? `按近 24h 实测估算 · 余额预计可用 ${
                    status.daysRemaining >= 99 ? "99+" : status.daysRemaining.toFixed(1)
                  } 天`
                : "按近 24h 实测估算"
              : status.burnWindowUsed !== null && status.burnWindowSpanMs !== null
                ? `近 ${(status.burnWindowSpanMs / 3600000).toFixed(1)} 小时实测 · 满 6 小时后估日速率`
                : "样本积累中（满 6 小时后估日速率）"
          }
          tone={
            status.burnRatePerDay !== null &&
            status.daysRemaining !== null &&
            status.daysRemaining < 7
              ? "amber"
              : "emerald"
          }
        />
        <UniMetric
          icon={<KeyRound className="h-4 w-4" />}
          label="密钥"
          value={status.keySource === "进程环境变量" ? "环境变量" : ".env 文件"}
          hint={
            status.keyUpdatedAt
              ? `${formatRelative(status.keyUpdatedAt)}轮换 · 周期 ${status.thresholds.keyRotateDays} 天`
              : `未记录轮换时间 · 周期 ${status.thresholds.keyRotateDays} 天`
          }
        />
      </div>

      <UsageTrend points={status.usageHistory} />

      <section className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-100 bg-white p-4 shadow-sm">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <div>
            <p className="arch-primary-text font-mono text-[10px]">Models</p>
            <h4 className="arch-text text-sm font-medium">模型列表 · {filtered.length}</h4>
          </div>
          <div className="ml-auto w-64">
            <Input
              size="small"
              allowClear
              placeholder="搜索模型 ID / 提供方"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </header>
        {providerCounts.length > 1 ? (
          <div className="mb-3 flex flex-wrap items-center gap-1">
            <ProviderChip
              label={`全部 ${status.models.length}`}
              active={provider === "all"}
              onClick={() => setProvider("all")}
            />
            {providerCounts.map(([name, count]) => (
              <ProviderChip
                key={name}
                label={`${name} ${count}`}
                active={provider === name}
                onClick={() => setProvider(name)}
              />
            ))}
          </div>
        ) : null}
        {status.models.length === 0 ? (
          <Empty description="未取到模型列表（网关离线或密钥无效）" />
        ) : filtered.length === 0 ? (
          <Empty description="没有匹配的模型" />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">模型 ID</th>
                  <th className="px-3 py-2 font-medium">提供方</th>
                  <th className="px-3 py-2 text-right font-medium">复制</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((model) => (
                  <tr key={model.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-800">{model.id}</td>
                    <td className="px-3 py-2 text-slate-600">{model.ownedBy || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          title="复制模型 ID"
                          onClick={() => copyModelId(model.id)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-100 text-slate-400 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          {copiedId === model.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 用量趋势（近 7 天累计消耗 sparkline）
// ---------------------------------------------------------------------------
function UsageTrend({ points }: { points: UniApiUsagePoint[] }) {
  const recent = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return [];
    const cutoff = last.ts - 7 * 24 * 3600 * 1000;
    return points.filter((point) => point.ts >= cutoff);
  }, [points]);

  return (
    <section className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <p className="arch-primary-text font-mono text-[10px]">Usage Trend</p>
          <h4 className="arch-text text-sm font-medium">用量趋势 · 近 7 天</h4>
        </div>
        {recent.length >= 2 ? (
          <span className="arch-muted text-[11px]">
            区间消耗 {formatUsd((recent[recent.length - 1]?.used ?? 0) - (recent[0]?.used ?? 0))}
          </span>
        ) : null}
      </header>
      {recent.length < 2 ? (
        <p className="arch-muted flex items-center gap-1.5 text-xs">
          <Activity className="h-3.5 w-3.5" />
          数据积累中——面板每次刷新都会记录一个采样点（5 分钟粒度），稍后即可看到趋势。
        </p>
      ) : (
        <Sparkline points={recent} />
      )}
    </section>
  );
}

function Sparkline({ points }: { points: UniApiUsagePoint[] }) {
  const WIDTH = 600;
  const HEIGHT = 56;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const tsSpan = Math.max(1, last.ts - first.ts);
  const usedMin = Math.min(...points.map((point) => point.used));
  const usedMax = Math.max(...points.map((point) => point.used));
  const usedSpan = Math.max(usedMax - usedMin, 1e-9);
  const coords = points.map((point) => {
    const x = ((point.ts - first.ts) / tsSpan) * WIDTH;
    const y = HEIGHT - 4 - ((point.used - usedMin) / usedSpan) * (HEIGHT - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-14 w-full"
        role="img"
        aria-label="近 7 天累计消耗趋势"
      >
        <polyline
          points={`0,${HEIGHT} ${coords.join(" ")} ${WIDTH},${HEIGHT}`}
          fill="rgb(16 185 129 / 0.08)"
          stroke="none"
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="arch-muted mt-1 flex justify-between text-[10px]">
        <span>{new Date(first.ts).toLocaleString()}</span>
        <span>{new Date(last.ts).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 复用小组件
// ---------------------------------------------------------------------------
function ProviderChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition " +
        (active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-100 text-slate-500 hover:border-emerald-200 hover:text-emerald-700")
      }
    >
      {label}
    </button>
  );
}

function UniMetric({
  icon,
  label,
  value,
  hint,
  tone = "emerald",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-700";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white p-3 shadow-sm">
      <span className="flex items-center justify-between">
        <span className="arch-muted text-[11px]">{label}</span>
        <span className={"inline-flex h-7 w-7 items-center justify-center rounded-md " + toneClass}>
          {icon}
        </span>
      </span>
      <span className="text-lg font-semibold text-slate-800">{value}</span>
      {hint ? (
        <span className="arch-muted truncate text-[11px]" title={hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
