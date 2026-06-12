"use client";

import { useEffect, useState } from "react";
import { fetchBomChainSummary, type BomChainSummary } from "@/lib/bom-chain";
import { api } from "@/lib/api";
import { getBackendRequestContext } from "@/lib/backend-api";

/// OpenBIM 数据主轴（血缘可视化）· 铁律 8：OpenBIM 是唯一数据主轴。
/// 展示从 IFC 源模型 → SJG157 语义分类 → BOM 九阶段派生链 → 造价清单 →
/// 下游交付 的连续数据流，全程可追溯到 IFC 构件 GlobalId。
/// 计数全部取自真实端点（bom/chain-summary、quantity-costing/overview）。

interface SpineNode {
  key: string;
  label: string;
  sub: string;
  count: number | null;
  phase: "source" | "chain" | "cost" | "downstream";
}

interface GateMark {
  afterKey: string;
  label: string;
  count: number;
}

export function OpenBimLineageSpine() {
  const [summary, setSummary] = useState<BomChainSummary | null>(null);
  const [boqCount, setBoqCount] = useState<number | null>(null);
  const [traceable, setTraceable] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ctx = getBackendRequestContext();
      const [chain, overview] = await Promise.allSettled([
        fetchBomChainSummary(),
        api.quantityCosting.overview(ctx.projectId),
      ]);
      if (cancelled) return;
      if (chain.status === "fulfilled") setSummary(chain.value);
      if (overview.status === "fulfilled") {
        setBoqCount(overview.value.boqItemCount);
        setTraceable(
          overview.value.boqItemCount -
            overview.value.sourceReviewRequiredCount,
        );
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nodes: SpineNode[] = [
    {
      key: "ifc",
      label: "IFC 源模型",
      sub: "OpenBIM / 几何实测",
      count: null,
      phase: "source",
    },
    {
      key: "sjg157",
      label: "SJG157 语义",
      sub: "建筑信息模型语义字典",
      count: null,
      phase: "source",
    },
    {
      key: "demand",
      label: "需求 RBOM",
      sub: "客服报价",
      count: summary?.demandBoms ?? null,
      phase: "chain",
    },
    {
      key: "concept",
      label: "概念 CBOM",
      sub: "方案设计",
      count: summary?.conceptBoms ?? null,
      phase: "chain",
    },
    {
      key: "planning",
      label: "规划 BOM",
      sub: "项目管理",
      count: summary?.planningBoms ?? null,
      phase: "chain",
    },
    {
      key: "component",
      label: "构件 EBOM",
      sub: "深化设计",
      count: summary?.componentBomVersions ?? null,
      phase: "chain",
    },
    {
      key: "cost",
      label: "造价清单",
      sub: "计量造价",
      count: boqCount,
      phase: "cost",
    },
    {
      key: "takeoff",
      label: "材料提量",
      sub: "material takeoff",
      count: summary?.materialTakeoffs ?? null,
      phase: "chain",
    },
    {
      key: "procurement",
      label: "采购 PBOM",
      sub: "材料物流",
      count: summary?.procurementBoms ?? null,
      phase: "chain",
    },
    {
      key: "manufacturing",
      label: "制造 MBOM",
      sub: "生产制造",
      count: summary?.manufacturingBoms ?? null,
      phase: "chain",
    },
    {
      key: "shipment",
      label: "发运 BOM",
      sub: "物流运输",
      count: summary?.shipmentBoms ?? null,
      phase: "downstream",
    },
    {
      key: "installation",
      label: "安装 IBOM",
      sub: "施工管理",
      count: summary?.installationBoms ?? null,
      phase: "downstream",
    },
    {
      key: "archive",
      label: "归档包",
      sub: "数字档案",
      count: summary?.archivePackages ?? null,
      phase: "downstream",
    },
  ];

  // 门控就绪行（阶段间的 harness 门控）
  const gates: GateMark[] = summary
    ? [
        { afterKey: "takeoff", label: "可采购", count: summary.purchasableLines },
        {
          afterKey: "manufacturing",
          label: "可发运",
          count: summary.releasableLines,
        },
        {
          afterKey: "installation",
          label: "可安装",
          count: summary.installableLines,
        },
        {
          afterKey: "archive",
          label: "可归档",
          count: summary.archivableLines,
        },
      ]
    : [];

  return (
    <section className="obim-spine" aria-label="OpenBIM 数据主轴">
      <header className="obim-spine__head">
        <div>
          <h3 className="obim-spine__title">OpenBIM 数据主轴 · 全链血缘</h3>
          <p className="obim-spine__sub">
            一切从 IFC / SJG 157-2024 语义字典连续流出，每个产物可追溯到构件
            GlobalId。
          </p>
        </div>
        {loaded && boqCount !== null ? (
          <div className="obim-spine__trace">
            造价清单 <b>{boqCount}</b> 项 · 可溯源至 IFC{" "}
            <b>{traceable ?? 0}</b> 项
          </div>
        ) : null}
      </header>

      <div className="obim-spine__flow">
        {nodes.map((node, index) => {
          const gate = gates.find((g) => g.afterKey === node.key);
          return (
            <div className="obim-spine__seg" key={node.key}>
              <div className={`obim-node is-${node.phase}`}>
                <span className="obim-node__label">{node.label}</span>
                <span className="obim-node__sub">{node.sub}</span>
                <span className="obim-node__count">
                  {node.count === null ? "源" : node.count}
                </span>
              </div>
              {index < nodes.length - 1 ? (
                <span className="obim-spine__arrow" aria-hidden>
                  →
                </span>
              ) : null}
              {gate ? (
                <span className="obim-gate" title="阶段门控就绪行">
                  {gate.label} {gate.count}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
