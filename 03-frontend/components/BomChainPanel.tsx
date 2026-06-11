// components/BomChainPanel.tsx
// Reusable businessHome for BOM-chain-consuming modules (material_logistics,
// construction_management): a live derivation-chain dashboard (per-stage counts +
// gate readiness) plus a derive action, backed by the Gateway /v1/bom/* API.
// License: Apache-2.0
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BOM_CHAIN_STAGES,
  type BomChainSummary,
  type BomDeriveOperation,
  deriveBom,
  fetchBomChainSummary,
} from "@/lib/bom-chain";
import type { ModuleSpec } from "@/lib/module-registry";

const DERIVE_OPERATIONS: { value: BomDeriveOperation; label: string }[] = [
  { value: "concept", label: "方案设计 CBOM (需 confirmed 需求)" },
  { value: "planning", label: "项目管理 Planning (需 selected 方案)" },
  { value: "material_takeoff", label: "材料提量 MTO (需 approved 构件 BOM)" },
  { value: "procurement", label: "材料采购 PBOM (需 MTO)" },
  { value: "manufacturing", label: "生产制造 MBOM (需 approved 构件 BOM)" },
  { value: "shipment", label: "物流运输 Shipment (需 released MBOM)" },
  { value: "installation", label: "施工安装 IBOM (需 released MBOM)" },
  { value: "archive", label: "数字档案 Archive (仅已验收项)" },
];

export function BomChainPanel({
  spec,
  title = "构件物料 BOM 派生链",
  subtitle = "构件 BOM 真源 → 材料提量 / 采购 / 制造 / 物流 / 施工，各阶段带发布门禁与全程可追溯",
  defaultOperation = "material_takeoff",
}: {
  spec: ModuleSpec;
  title?: string;
  subtitle?: string;
  defaultOperation?: BomDeriveOperation;
}) {
  const [summary, setSummary] = useState<BomChainSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<BomDeriveOperation>(defaultOperation);
  const [sourceId, setSourceId] = useState("");
  const [deriveMessage, setDeriveMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchBomChainSummary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchBomChainSummary()
      .then((data) => {
        if (active) {
          setSummary(data);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const runDerive = useCallback(async () => {
    if (!sourceId.trim()) {
      setDeriveMessage("请填写来源对象 ID (source id)");
      return;
    }
    setDeriveMessage(null);
    try {
      const result = await deriveBom(operation, sourceId.trim());
      setDeriveMessage(`已派生 ${result.operation} → ${result.id}`);
      await refresh();
    } catch (cause) {
      setDeriveMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }, [operation, sourceId, refresh]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4" data-module-id={spec.id}>
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
        >
          {loading ? "刷新中…" : "刷新"}
        </button>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          暂无法读取链路汇总：{error}（需后端 /v1/bom 端点可用）
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {BOM_CHAIN_STAGES.map((stage) => {
          const count = summary ? summary[stage.key] : null;
          const gateCount = summary && stage.gate ? summary[stage.gate.field] : null;
          return (
            <div key={stage.key} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-[13px] font-semibold text-slate-800">{stage.zh}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{count ?? "—"}</div>
              {stage.gate ? (
                <div className="mt-1 text-[11px] text-emerald-700">
                  {stage.gate.zh}: {gateCount ?? "—"}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-sm font-semibold text-slate-800">派生一步 (derive)</div>
        <p className="mb-2 text-[11px] text-slate-500">
          每步都受上游状态门禁约束（approved / released / customer_confirmed / selected）。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={operation}
            onChange={(event) => setOperation(event.target.value as BomDeriveOperation)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            {DERIVE_OPERATIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <input
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            placeholder="来源对象 ID"
            className="min-w-[18rem] rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => void runDerive()}
            className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            派生
          </button>
        </div>
        {deriveMessage ? (
          <div className="mt-2 text-[12px] text-slate-700">{deriveMessage}</div>
        ) : null}
      </section>
    </div>
  );
}
