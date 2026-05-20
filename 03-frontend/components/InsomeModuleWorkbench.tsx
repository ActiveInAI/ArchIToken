"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Home,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import {
  FloorplanRenderer,
  generateResidentialProposals,
  summarizeFloorplan,
  type Floorplan,
} from "@/lib/insome/floorplan";
import { checkAllConstraints, estimatePriceSimple } from "@/lib/insome/core";
import type { ResidentialSpec } from "@/lib/insome/types";
import { homeFloorplanVariants } from "@/lib/insome/content/floorplan-variants";
import { moduleBackendAdapter } from "@/lib/module-backend-adapter";
import { getModuleRootId, type ModuleAuditEvent } from "@/lib/module-file-system";
import type { ModuleId } from "@/lib/module-registry";

type InsomeModuleId = Extract<ModuleId, "marketing_service" | "concept_design">;

const ROOM_LABELS: Record<string, string> = {
  "rooms.livingRoom": "客厅",
  "rooms.kitchen": "厨房",
  "rooms.diningRoom": "餐厅",
  "rooms.masterRoom": "主卧",
  "rooms.secondRoom": "次卧",
  "rooms.thirdRoom": "三卧",
  "rooms.bathroom": "卫浴",
  "rooms.secondBathroom": "次卫",
  "rooms.study": "书房",
  "rooms.hallway": "走廊",
  "rooms.balcony": "阳台",
};

const MODULE_COPY: Record<
  InsomeModuleId,
  {
    eyebrow: string;
    title: string;
    description: string;
    primaryAction: string;
    artifactPrefix: string;
  }
> = {
  marketing_service: {
    eyebrow: "INSOME LEAD INTAKE",
    title: "市场客服 · 线索到方案入口",
    description: "把客户需求、预算和房型意向直接生成可进入方案设计的 INSOME Floorplan 数据。",
    primaryAction: "生成客服方案草案",
    artifactPrefix: "marketing-intake",
  },
  concept_design: {
    eyebrow: "INSOME CONCEPT STUDIO",
    title: "方案设计 · 在线平面与方案编辑",
    description: "使用 INSOME 的户型生成、约束检查、估算和可视化组件承接方案设计模块。",
    primaryAction: "生成方案比选",
    artifactPrefix: "concept-design",
  },
};

const initialResidentialSpec: ResidentialSpec = {
  widthFt: 38,
  lengthFt: 48,
  stories: 2,
  style: "modern-light-steel",
  bedrooms: 3,
  bathrooms: 2,
};

export function InsomeModuleWorkbench({
  moduleId,
  onAudit,
}: {
  moduleId: InsomeModuleId;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const copy = MODULE_COPY[moduleId];
  const [plans, setPlans] = useState<ReadonlyArray<Floorplan>>(() =>
    moduleId === "marketing_service"
      ? homeFloorplanVariants
      : generateResidentialProposals(initialResidentialSpec),
  );
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [createdFiles, setCreatedFiles] = useState<ReadonlyArray<string>>([]);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];

  const metrics = useMemo(() => {
    if (!selectedPlan) return null;
    const summary = summarizeFloorplan(selectedPlan);
    const price = estimatePriceSimple(selectedPlan, { currency: "CNY" });
    const constraints = checkAllConstraints(selectedPlan);
    return { summary, price, constraints };
  }, [selectedPlan]);

  function regenerate() {
    const nextPlans = generateResidentialProposals(initialResidentialSpec);
    setPlans(nextPlans);
    setSelectedPlanId(nextPlans[0]?.id ?? "");
    setSelectedRoomId(null);
    emitAudit(`${copy.title} 生成 ${nextPlans.length} 个 INSOME 方案候选。`);
  }

  function persistArtifact(kind: "json" | "svg") {
    if (!selectedPlan) return;

    const extension = kind === "json" ? "json" : "svg";
    const safePlanId = selectedPlan.id.replace(/[^a-zA-Z0-9-]/g, "-");
    const fileName = `${copy.artifactPrefix}-${safePlanId}.${extension}`;
    const parentId = getModuleRootId(moduleId);
    const result = moduleBackendAdapter.createFile({
      moduleId,
      parentId,
      name: fileName,
      type: "file",
    });
    window.localStorage.setItem(
      `architoken-insome-artifact:${moduleId}:${fileName}`,
      JSON.stringify({
        kind,
        moduleId,
        generatedAt: new Date().toISOString(),
        floorplan: selectedPlan,
        metrics,
      }),
    );
    setCreatedFiles((current) => [fileName, ...current].slice(0, 4));
    onAudit?.(result.auditEvent);
  }

  function emitAudit(summary: string) {
    onAudit?.({
      id: `insome-${moduleId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      actor: "INSOME Module Bridge",
      summary,
    });
  }

  if (!selectedPlan || !metrics) {
    return null;
  }

  return (
    <section className="arch-module-home flex h-full min-h-0 flex-col bg-[var(--arch-bg)]">
      <div className="border-b arch-border bg-[var(--arch-surface)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] font-normal tracking-[0.08em] text-[var(--module-accent)]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-[18px] font-normal leading-7 arch-text">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-5 arch-muted">{copy.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/home"
              className="inline-flex h-8 items-center gap-2 rounded-md border arch-border px-3 text-[12px] arch-text hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
            >
              <Home className="h-3.5 w-3.5" />
              INSOME Home
            </Link>
            <Link
              href="/studio"
              className="inline-flex h-8 items-center gap-2 rounded-md border arch-border px-3 text-[12px] arch-text hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              INSOME Studio
            </Link>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-0 overflow-hidden">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b arch-border bg-[var(--arch-surface-muted)] px-5 py-3">
            <button
              type="button"
              onClick={regenerate}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--module-accent)] bg-[var(--module-accent)] px-3 text-[12px] text-[var(--module-accent-foreground)]"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              {copy.primaryAction}
            </button>
            {plans.map((plan, index) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setSelectedRoomId(null);
                }}
                className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[12px] ${
                  selectedPlan.id === plan.id
                    ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--module-accent)]"
                    : "arch-border arch-text"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                方案 {index + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => persistArtifact("json")}
              className="ml-auto inline-flex h-8 items-center gap-2 rounded-md border arch-border px-3 text-[12px] arch-text hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
            >
              <Save className="h-3.5 w-3.5" />
              写入 CDE JSON
            </button>
            <button
              type="button"
              onClick={() => persistArtifact("svg")}
              className="inline-flex h-8 items-center gap-2 rounded-md border arch-border px-3 text-[12px] arch-text hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              写入图纸 SVG
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            <div className="grid min-h-[680px] grid-cols-[minmax(0,1fr)_300px] gap-4">
              <div className="min-h-[680px] rounded-lg border arch-border bg-[var(--arch-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[var(--module-accent)]">INSOME Floorplan Renderer</p>
                    <h2 className="mt-1 text-[16px] font-normal arch-text">在线平面方案编辑视图</h2>
                  </div>
                  <span className="rounded-md border arch-border px-2 py-1 text-[11px] arch-muted">
                    {selectedRoomId ? ROOM_LABELS[selectedRoomId] ?? selectedRoomId : "未选择房间"}
                  </span>
                </div>
                <div className="mt-4 h-[590px] overflow-hidden rounded-lg border arch-border bg-white">
                  <FloorplanRenderer
                    floorplan={selectedPlan}
                    selectedRoomId={selectedRoomId}
                    scheme={moduleId === "marketing_service" ? "pastel" : "standard"}
                    theme="home"
                    showDimensions
                    showGrid
                    translator={(key) => ROOM_LABELS[key] ?? key}
                    onRoomSelect={(roomId) => setSelectedRoomId(roomId)}
                    className="h-full w-full"
                  />
                </div>
              </div>

              <div className="grid content-start gap-4">
                <MetricBlock label="建筑面积" value={`${metrics.price.totalAreaSqm.toFixed(1)} m²`} />
                <MetricBlock label="空间数量" value={`${metrics.summary.roomCount} 个`} />
                <MetricBlock
                  label="估算价格"
                  value={`${Math.round(metrics.price.breakdown.total / 10000)} 万 CNY`}
                />
                <div className="rounded-lg border arch-border bg-[var(--arch-surface)] p-4">
                  <p className="text-[11px] text-[var(--module-accent)]">约束检查</p>
                  <div className="mt-3 flex items-center gap-2 text-[13px] arch-text">
                    <CheckCircle2 className="h-4 w-4 text-[var(--arch-success)]" />
                    {metrics.constraints.passed ? "当前候选未触发错误级约束" : "存在需人工处理的约束"}
                  </div>
                  <p className="mt-2 text-[12px] leading-5 arch-muted">
                    {metrics.constraints.violations.length} 条提示。正式结构、造价和报批结果必须进入人工审批链。
                  </p>
                </div>
                <div className="rounded-lg border arch-border bg-[var(--arch-surface)] p-4">
                  <p className="text-[11px] text-[var(--module-accent)]">模块贯通</p>
                  <div className="mt-3 grid gap-2 text-[12px] arch-muted">
                    <BridgeStep text="客户需求进入市场客服模块" />
                    <BridgeStep text="INSOME 生成 Floorplan 数据与图纸候选" />
                    <BridgeStep text="候选写入 CDE 文件和审计轨迹" />
                    <BridgeStep text="方案设计模块继续在线编辑与比选" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="border-l arch-border bg-[var(--arch-surface)] p-4">
          <p className="text-[11px] text-[var(--module-accent)]">CDE 输出</p>
          <div className="mt-3 grid gap-2">
            {createdFiles.length > 0 ? (
              createdFiles.map((fileName) => (
                <div key={fileName} className="rounded-md border arch-border px-3 py-2 text-[12px] arch-text">
                  {fileName}
                </div>
              ))
            ) : (
              <p className="rounded-md border arch-border px-3 py-2 text-[12px] leading-5 arch-muted">
                点击写入按钮后会生成模块文件节点，并把 INSOME floorplan 数据保存在本地 CDE 工件索引中。
              </p>
            )}
          </div>

          <div className="mt-5 rounded-lg border arch-border bg-[var(--arch-surface-muted)] p-4">
            <p className="text-[11px] text-[var(--module-accent)]">下一步</p>
            <Link
              href={moduleId === "marketing_service" ? "/app/modules/concept_design" : "/studio"}
              className="mt-3 inline-flex items-center gap-2 text-[12px] text-[var(--module-accent)]"
            >
              {moduleId === "marketing_service" ? "进入方案设计模块" : "打开完整 INSOME Studio"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border arch-border bg-[var(--arch-surface)] p-4">
      <p className="text-[11px] text-[var(--module-accent)]">{label}</p>
      <p className="mt-2 text-[22px] font-normal leading-7 arch-text">{value}</p>
    </div>
  );
}

function BridgeStep({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--module-accent)]" />
      <span>{text}</span>
    </div>
  );
}
