// components/ModuleOperationalPanel.tsx - Module-specific interactive business surface
// License: Apache-2.0
"use client";

import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleDot,
  Factory,
  FileCog,
  Layers3,
  PackageCheck,
  Pause,
  Play,
  ScanLine,
  ShieldAlert,
  Truck,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  api,
  type QuantityCostingOverview,
  type QuantityCostingPriceSnapshot,
  type QuantityCostingRegistryResponse,
  type QuantityCostingSnapshotPayload,
  type QuantityCostingSnapshotResponse,
} from "@/lib/api";
import { getBackendRequestContext } from "@/lib/backend-api";
import {
  COSTING_DEFAULT_ROW_HEIGHT,
  COSTING_DETAIL_HEIGHT,
  COSTING_FENBU_COLUMNS,
  COSTING_TREE_WIDTH,
  clampColumnWidth,
  clampPaneSize,
  cycleRowHeight,
  defaultColumnWidths,
  rowHeightLabel,
} from "@/lib/costing-grid-layout";
import {
  defaultFinanceAccountingParameters,
  financeEntryTypeCatalogSize,
  financeEntryTypes,
  financeLedgerBooks,
  financeManualSections,
  financeManualSource,
  financeReconciliationPlan,
  financeVoucherSourceDocuments,
  financeVoucherTemplates,
  runReconciliation,
  runVoucherGeneration,
  tailDifferenceAdjustmentLabels,
  voucherDateSourceLabels,
  voucherResultViewLabels,
  voucherSequenceModeLabels,
  type FinanceAccountingParameters,
  type ReconciliationRun,
  type VoucherGenerationRun,
} from "@/lib/finance-management";
import type { ModuleActionResult } from "@/lib/module-actions";
import { createModuleAuditEvent } from "@/lib/module-actions";
import { recordModuleOperationRuntime } from "@/lib/module-operation-runtime-client";
import {
  getModuleOperationalProfile,
  type ModuleFeatureCard,
  type ModuleOperationButton,
} from "@/lib/module-operations";
import type { ModuleSpec } from "@/lib/module-registry";
import {
  steelMembers,
  steelSensors,
  steelTwinLayers,
} from "@/lib/digital-twin";
import {
  applyCostProjectImportPlan,
  addReportsToCostReportScheme,
  buildCostQuantityExpressionDetails,
  buildCostProjectImportPlan,
  buildCostResourceComparisonRows,
  buildReviewReportPreview,
  calculateCostingDashboard,
  calculateFeeSummaryItem,
  calculateIncreaseDecreaseByStrategy,
  calculateMeasureItem,
  calculateOtherItem,
  calculateQuotaUnitPrice,
  convertBoqItemData,
  convertFeeRuleData,
  convertMeasureItemData,
  convertOtherItemData,
  copyCostProjectNode,
  costChangeMarkLabels,
  createReportExportTasks,
  createReportExportTasksFromScheme,
  createReportSchemeApplicationPlan,
  createNextReviewVersion,
  deleteReviewVersion,
  filterCostAnalysisItems,
  formatMoney,
  generateReviewReportSnapshot,
  hasActiveCostAnalysisFilters,
  loadCostReportScheme,
  markCostProjectNodeDeleted,
  markCostProjectNodesDeleted,
  mergeCostAnalysisItems,
  quantityCostingDefaultReportMetadata,
  quantityCostingImportedReviewNodes,
  quantityCostingPhase1Project,
  quantityCostingPhase2FeeRules,
  quantityCostingPhase2MeasureItems,
  quantityCostingPhase2OtherItems,
  quantityCostingPhase2Registry,
  quantityCostingSystemReportScheme,
  restoreSystemReportScheme,
  roundMoney,
  roundQuantity,
  saveCostReportScheme,
  selectCostAnalysisItemsByRule,
  selectCostItemsByDeltaShare,
  inferBoqManualChangeReason,
  setBoqItemChangeReason,
  summarizeCostAnalysisByLevel,
  switchSubmittedReviewVersion,
  updateCostReportExportSettings,
  validateCostAnalysisMerge,
  type CostAnalysisExpandLevel,
  type CostAnalysisFilters,
  type CostingStandardRegistry,
  type CostChangeMark,
  type ComputedCostBoqItem,
  type CostFeeRule,
  type CostMeasureItem,
  type CostNumericField,
  type CostNumericOperator,
  type CostOtherItem,
  type CostProjectImportPlan,
  type CostReportScheme,
  type CostReportTask,
  type CostReviewReportMetadata,
  type CostReviewReportPreview,
  type CostSummary,
  convertReviewVersionToBudget,
  type QuantityCostingBoqItem,
  type QuantityCostingProject,
} from "@/lib/quantity-costing";
import {
  evaluateCostExpression,
  type CostExpressionVariable,
} from "@/lib/quantity-costing-expression";
import {
  applyDesignToUnitProjects,
  applyTemporaryReportEdits,
  buildReportDesignPreview,
  createDefaultReportDesign,
  describeReportWatermark,
  setReportColumnVisible,
  updateReportSimpleDesign,
  type CostReportSimpleDesign,
  type CostReportWatermarkMode,
} from "@/lib/quantity-costing-report-design";
import {
  advanceSignOff,
  costApprovalStatusLabels,
  costReportOutputStateLabels,
  createApprovalRecord,
  decideApproval,
  resubmitApproval,
  type CostApprovalAction,
  type CostApprovalRecord,
  type CostReportOutputState,
} from "@/lib/quantity-costing-approval";
import { runCostingRuleChecks } from "@/lib/quantity-costing-rule-check";
import {
  buildCostVoucherPlan,
  type CostVoucherPlan,
} from "@/lib/quantity-costing-finance-bridge";
import {
  postCostVoucherPlan,
  postToGeneralLedger,
} from "@/lib/finance-posting";
import { ACCOUNT_CATEGORY_LABELS } from "@/lib/finance-chart-of-accounts";
import {
  buildBalanceSheet,
  buildIncomeStatement,
  type LedgerBalanceInput,
} from "@/lib/finance-statements";
import {
  parsePriceQuoteCsv,
  parseQuotaRegistryCsv,
} from "@/lib/quantity-costing-registry-import";
import {
  buildCostReportExportWorkbook,
  buildCostReportWordHtml,
} from "@/lib/quantity-costing-report-export";
import {
  applyPriceLoadPlan,
  buildPriceUpdatePayload,
  createPriceLoadPlan,
  type CostPriceLoadPlan,
} from "@/lib/quantity-costing-price-load";
import {
  mapIfcManifestToBoqItems,
  type IfcTakeoffManifest,
} from "@/lib/quantity-costing-ifc-takeoff";

type AuditEvent = ModuleActionResult["auditEvent"];

const featureStatusLabels: Record<ModuleFeatureCard["status"], string> = {
  ready: "就绪",
  running: "运行中",
  review: "审阅",
  blocked: "阻断",
};

export function ModuleOperationalPanel({
  spec,
  onAudit,
}: {
  spec: ModuleSpec;
  onAudit?: (event: AuditEvent) => void;
}) {
  const profile = getModuleOperationalProfile(spec.id);
  const [selectedFeatureId, setSelectedFeatureId] = useState(
    profile.features[0]?.id ?? "",
  );
  const [operationStates, setOperationStates] = useState<
    Record<string, string>
  >({});
  const selectedFeature =
    profile.features.find((feature) => feature.id === selectedFeatureId) ??
    profile.features[0];

  function emit(
    summary: string,
    runtimeInput: {
      operationId?: string;
      operationLabel?: string;
      targetType?: string;
      targetId?: string;
      requestPayload?: Record<string, unknown>;
      resultPayload?: Record<string, unknown>;
    } = {},
  ) {
    const auditEvent = createModuleAuditEvent(
      `${spec.id}-operation`,
      "ModuleOperationalPanel",
      summary,
    );
    onAudit?.(auditEvent);
    const runtimePromise = recordModuleOperationRuntime({
      moduleId: spec.id,
      operationId: runtimeInput.operationId ?? "ui.audit",
      operationLabel: runtimeInput.operationLabel ?? summary,
      actor: "ModuleOperationalPanel",
      sourceSurface: "module_operational_panel",
      targetType: runtimeInput.targetType ?? "module",
      targetId: runtimeInput.targetId ?? spec.id,
      idempotencyKey: auditEvent.id,
      requestPayload: {
        auditEventId: auditEvent.id,
        moduleZhName: spec.zhName,
        moduleEnName: spec.enName,
        summary,
        ...(runtimeInput.requestPayload ?? {}),
      },
      resultPayload: runtimeInput.resultPayload ?? {},
      evidence: {
        frontendComponent: "ModuleOperationalPanel",
        profileTitle: profile.title,
      },
    }).catch((error) => {
      console.warn("module operation runtime write failed", error);
      return null;
    });
    return { auditEvent, runtimePromise };
  }

  function selectFeature(feature: ModuleFeatureCard) {
    setSelectedFeatureId(feature.id);
    emit(`${spec.zhName}: 打开功能 ${feature.title}`, {
      operationId: `feature.${feature.id}`,
      operationLabel: `打开功能 ${feature.title}`,
      targetType: "module_feature",
      targetId: feature.id,
      requestPayload: {
        featureId: feature.id,
        featureTitle: feature.title,
        featureOwner: feature.owner,
        featureStatus: feature.status,
      },
    });
  }

  async function runOperation(operation: ModuleOperationButton) {
    setOperationStates((current) => ({
      ...current,
      [operation.id]: "正在写入数据库运行时...",
    }));
    const { runtimePromise } = emit(`${spec.zhName}: ${operation.result}`, {
      operationId: operation.id,
      operationLabel: operation.label,
      targetType: selectedFeature ? "module_feature" : "module",
      targetId: selectedFeature?.id ?? spec.id,
      requestPayload: {
        featureId: selectedFeature?.id,
        featureTitle: selectedFeature?.title,
        operationResult: operation.result,
      },
      resultPayload: {
        result: operation.result,
      },
    });
    const run = await runtimePromise;
    const at = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setOperationStates((current) => ({
      ...current,
      [operation.id]: run
        ? `已写入数据库 · ${run.operationRunId.slice(0, 8)} · ${at}`
        : `本地已执行,数据库写入失败 · ${at}`,
    }));
  }

  if (spec.id === "quantity_costing") {
    return <QuantityCostingControl onAudit={emit} />;
  }

  if (spec.id === "finance_management") {
    return <FinanceManagementControl onAudit={emit} />;
  }

  return (
    <section className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4 text-[var(--arch-text)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--arch-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-normal text-[var(--module-accent)]">
            Functional system
          </p>
          <h2 className="mt-1 text-3xl font-medium">{profile.title}</h2>
          <p className="mt-2 max-w-5xl text-sm leading-7 text-[var(--arch-text-muted)]">
            {profile.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.statusTracks.map((track) => (
            <span
              key={track}
              className="rounded-full border border-[var(--module-accent-soft)] bg-[var(--module-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--module-accent)]"
            >
              {track}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {profile.features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => selectFeature(feature)}
                className={`rounded-lg border p-4 text-left transition ${
                  feature.id === selectedFeatureId
                    ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] shadow-[inset_3px_0_0_var(--module-accent)]"
                    : "border-[var(--arch-border)] bg-[var(--arch-surface)] hover:border-[var(--module-accent)] hover:bg-[var(--arch-surface-muted)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-medium">{feature.title}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${featureStatusClass(feature.status)}`}
                  >
                    {featureStatusLabels[feature.status]}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--arch-text-muted)]">
                  {feature.description}
                </p>
                <p className="mt-3 text-xs text-[var(--module-accent)]">
                  负责人: {feature.owner}
                </p>
              </button>
            ))}
          </div>

          {spec.id === "digital_twin" ? (
            <DigitalTwinControl onAudit={emit} />
          ) : null}
          {spec.id === "production_manufacturing" ? (
            <ProductionControl onAudit={emit} />
          ) : null}
          {spec.id === "construction_management" ? (
            <ConstructionControl onAudit={emit} />
          ) : null}
          {spec.id === "material_logistics" ? (
            <MaterialLogisticsControl onAudit={emit} />
          ) : null}
          {![
            "digital_twin",
            "production_manufacturing",
            "construction_management",
            "material_logistics",
          ].includes(spec.id) ? (
            <GenericModuleControl
              selectedFeature={selectedFeature}
              onAudit={emit}
            />
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-normal text-[var(--module-accent)]">
                  Selected function
                </p>
                <h3 className="mt-1 text-2xl font-medium">
                  {selectedFeature?.title}
                </h3>
              </div>
              <CircleDot className="h-5 w-5 text-[var(--module-accent)]" />
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--arch-text-muted)]">
              {selectedFeature?.description}
            </p>
            <div className="mt-4 grid gap-2">
              {selectedFeature?.metrics.map((metric) => (
                <div
                  key={metric}
                  className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-2 text-sm text-[var(--arch-text)]"
                >
                  {metric}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[var(--module-accent)]" />
              <h3 className="text-xl font-medium">操作按钮区</h3>
            </div>
            <div className="mt-3 space-y-2">
              {profile.operations.map((operation) => (
                <button
                  key={operation.id}
                  type="button"
                  onClick={() => void runOperation(operation)}
                  className="w-full rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-3 text-left transition hover:border-[var(--module-accent)] hover:bg-[var(--module-accent-soft)]"
                >
                  <span className="block text-sm font-medium text-[var(--arch-text)]">
                    {operation.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--arch-text-muted)]">
                    {operationStates[operation.id] ?? operation.result}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function GenericModuleControl({
  selectedFeature,
  onAudit,
}: {
  selectedFeature: ModuleFeatureCard | undefined;
  onAudit: (summary: string) => void;
}) {
  const [reviewState, setReviewState] = useState("未生成");
  const [riskState, setRiskState] = useState("等待评估");
  const [handoverState, setHandoverState] = useState("未移交");

  function update(
    label: string,
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    onAudit(`${selectedFeature?.title ?? "模块功能"}: ${label}`);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ActionTile
        icon={<FileCog className="h-5 w-5" />}
        title="生成业务包"
        value={reviewState}
        onClick={() =>
          update("生成业务包完成", setReviewState, "已生成 · 待评估")
        }
      />
      <ActionTile
        icon={<ShieldAlert className="h-5 w-5" />}
        title="风险校核"
        value={riskState}
        onClick={() =>
          update("风险校核完成", setRiskState, "发现 2 项可控风险")
        }
      />
      <ActionTile
        icon={<PackageCheck className="h-5 w-5" />}
        title="移交下游"
        value={handoverState}
        onClick={() =>
          update("移交状态更新", setHandoverState, "已生成下游 Token")
        }
      />
    </div>
  );
}

function DigitalTwinControl({
  onAudit,
}: {
  onAudit: (summary: string) => void;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(
    steelMembers[0]?.id ?? "",
  );
  const [activeLayerIds, setActiveLayerIds] = useState(() =>
    steelTwinLayers.slice(0, 4).map((layer) => layer.id),
  );
  const [playing, setPlaying] = useState(false);
  const [overlay, setOverlay] = useState<"quality" | "safety" | "cost">(
    "quality",
  );
  const [viewpoint, setViewpoint] = useState("总览视角");
  const [snapshotCount, setSnapshotCount] = useState(0);
  const selectedMember =
    steelMembers.find((member) => member.id === selectedMemberId) ??
    steelMembers[0];
  const activeSensors = steelSensors.filter(
    (sensor) =>
      sensor.memberId === selectedMember?.id || sensor.status !== "normal",
  );

  function toggleLayer(layerId: string) {
    setActiveLayerIds((current) =>
      current.includes(layerId)
        ? current.filter((id) => id !== layerId)
        : [...current, layerId],
    );
    onAudit(`数字孪生: 切换图层 ${layerId}`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
      <div className="rounded-lg border border-cyan-200/14 bg-slate-950/52 p-4">
        <h3 className="text-xl font-medium">构件树</h3>
        <div className="mt-3 space-y-2">
          {steelMembers.slice(0, 7).map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setSelectedMemberId(member.id);
                onAudit(`数字孪生: 选择构件 ${member.memberMark}`);
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                selectedMemberId === member.id
                  ? "border-cyan-200/70 bg-cyan-300/14"
                  : "border-cyan-200/12 bg-white/[0.045] hover:border-cyan-200/36"
              }`}
            >
              <span className="block text-sm font-medium">
                {member.memberMark}
              </span>
              <span className="mt-1 block text-xs text-cyan-50/58">
                {member.assembly} · {member.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[420px] rounded-lg border border-cyan-200/14 bg-[#020817] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] text-cyan-200/58">
              WebGPU viewport
            </p>
            <h3 className="mt-1 text-2xl font-medium">
              {viewpoint} · {selectedMember?.memberMark}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label="WebGPU" value="ready" />
            <StatusPill label="Three.js fallback" value="standby" />
          </div>
        </div>

        <div className="relative mt-4 min-h-[300px] overflow-hidden rounded-lg border border-cyan-200/12 bg-[radial-gradient(circle_at_45%_32%,rgba(34,211,238,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(3,7,18,1))]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-[12%] top-[24%] h-12 w-[70%] -skew-x-12 rounded bg-cyan-100/78 shadow-[0_0_28px_rgba(103,232,249,0.42)]" />
          <div className="absolute left-[18%] top-[48%] h-12 w-[58%] -skew-x-12 rounded bg-cyan-300/36 shadow-[0_0_34px_rgba(34,211,238,0.3)]" />
          <div className="absolute left-[28%] top-[20%] h-[170px] w-7 rounded bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.3)]" />
          <div className="absolute right-[25%] top-[22%] h-[170px] w-7 rounded bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.3)]" />
          <div
            className={`absolute right-[18%] top-[44%] h-20 w-20 rounded-full border ${
              overlay === "quality"
                ? "border-emerald-300 bg-emerald-300/24"
                : overlay === "safety"
                  ? "border-red-300 bg-red-400/24"
                  : "border-amber-300 bg-amber-300/24"
            } shadow-[0_0_34px_rgba(34,211,238,0.2)]`}
          />
          {Array.from({ length: 26 }, (_, index) => (
            <span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-full bg-cyan-100/72 shadow-[0_0_12px_rgba(103,232,249,0.86)]"
              style={{
                left: `${10 + ((index * 19) % 78)}%`,
                top: `${14 + ((index * 23) % 70)}%`,
              }}
            />
          ))}
          <div className="absolute bottom-4 left-4 right-4 grid gap-2 md:grid-cols-3">
            {["IFC", "GLB", "点云", "360", "三维扫描", "倾斜摄影"].map(
              (source) => (
                <span
                  key={source}
                  className="rounded-lg border border-cyan-200/16 bg-slate-950/64 px-3 py-2 text-xs font-medium"
                >
                  {source}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {["总览视角", "吊装视角", "构件视角", "点云残差", "成本热区"].map(
            (view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  setViewpoint(view);
                  onAudit(`数字孪生: 切换视角 ${view}`);
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  viewpoint === view
                    ? "border-cyan-200 bg-cyan-300 text-slate-950"
                    : "border-cyan-200/12 bg-white/[0.045]"
                }`}
              >
                {view}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="space-y-3">
        <ControlBox title="图层管理" icon={<Layers3 className="h-4 w-4" />}>
          {steelTwinLayers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => toggleLayer(layer.id)}
              className={`mb-2 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs ${
                activeLayerIds.includes(layer.id)
                  ? "border-cyan-200/60 bg-cyan-300/14"
                  : "border-cyan-200/12 bg-white/[0.045]"
              }`}
            >
              <span>{layer.name}</span>
              <span>{layer.progress}%</span>
            </button>
          ))}
        </ControlBox>

        <ControlBox title="进度与叠加" icon={<Activity className="h-4 w-4" />}>
          <button
            type="button"
            onClick={() => {
              setPlaying((current) => !current);
              onAudit(`数字孪生: ${playing ? "暂停" : "播放"}进度对比`);
            }}
            className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-sm font-medium text-slate-950"
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {playing ? "暂停进度" : "播放进度"}
          </button>
          <div className="grid grid-cols-3 gap-2">
            {(["quality", "safety", "cost"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setOverlay(item);
                  onAudit(`数字孪生: 切换 ${item} overlay`);
                }}
                className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                  overlay === item
                    ? "border-cyan-200 bg-cyan-300 text-slate-950"
                    : "border-cyan-200/12 bg-white/[0.045]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </ControlBox>

        <ControlBox title="模型状态" icon={<ScanLine className="h-4 w-4" />}>
          <p className="text-sm leading-6 text-cyan-50/72">
            {selectedMember?.section} · {selectedMember?.materialGrade}
          </p>
          <p className="mt-2 text-xs text-cyan-200/72">
            IoT 告警: {activeSensors.length} · 几何{" "}
            {selectedMember?.geometryStatus} · 属性{" "}
            {selectedMember?.propertyStatus}
          </p>
          <button
            type="button"
            onClick={() => {
              setSnapshotCount((current) => current + 1);
              onAudit("数字孪生: 已导出孪生快照和模型包");
            }}
            className="mt-3 w-full rounded-lg border border-cyan-200/30 bg-white/[0.06] px-3 py-2 text-xs font-medium"
          >
            导出孪生快照 #{snapshotCount + 1}
          </button>
        </ControlBox>
      </div>
    </div>
  );
}

type FinanceMainTab =
  | "系统参数"
  | "基础设置"
  | "凭证生成"
  | "财务核对"
  | "造价凭证贯通"
  | "财务报表";
type FinanceBottomTab =
  | "凭证生成报告"
  | "凭证列表"
  | "差异分析"
  | "对账方案字段";

const financeMainTabs: FinanceMainTab[] = [
  "系统参数",
  "基础设置",
  "凭证生成",
  "财务核对",
  "造价凭证贯通",
  "财务报表",
];

const financeBottomTabs: FinanceBottomTab[] = [
  "凭证生成报告",
  "凭证列表",
  "差异分析",
  "对账方案字段",
];
const defaultFinanceBookId = financeLedgerBooks[0]?.id ?? "legal-entity-book";

// 样例期末科目余额(借/贷累计),驱动资产负债表与利润表演示。
// 真实环境由总账(postToGeneralLedger)按期间汇总得到。
const financeStatementBalances: LedgerBalanceInput[] = [
  { code: "1002", name: "银行存款", debitTotal: 10_900_000, creditTotal: 2_400_000 },
  { code: "1122", name: "应收账款", debitTotal: 3_200_000, creditTotal: 1_800_000 },
  { code: "1403", name: "原材料", debitTotal: 1_500_000, creditTotal: 900_000 },
  { code: "1604", name: "在建工程", debitTotal: 3_400_000, creditTotal: 0 },
  { code: "2202", name: "应付账款", debitTotal: 1_200_000, creditTotal: 3_351_400 },
  { code: "2211", name: "应付职工薪酬", debitTotal: 0, creditTotal: 1_200_000 },
  { code: "2221", name: "应交税费", debitTotal: 0, creditTotal: 648_600 },
  { code: "4001", name: "实收资本", debitTotal: 0, creditTotal: 8_000_000 },
  { code: "4101", name: "盈余公积", debitTotal: 0, creditTotal: 600_000 },
  { code: "6001", name: "主营业务收入", debitTotal: 0, creditTotal: 6_800_000 },
  { code: "6401", name: "主营业务成本", debitTotal: 4_900_000, creditTotal: 0 },
  { code: "6602", name: "管理费用", debitTotal: 520_000, creditTotal: 0 },
  { code: "6603", name: "财务费用", debitTotal: 80_000, creditTotal: 0 },
];

// 财务工作台可拖拽面板尺寸边界(px),对标计量造价工作台。
const FINANCE_TREE_WIDTH = { default: 230, min: 170, max: 520 } as const;
const FINANCE_BOTTOM_HEIGHT = { default: 210, min: 120, max: 560 } as const;

// 样例:计量造价审定后移交财务的凭证草稿(对应 cost_voucher_drafts)。
// 真实环境从后端 cost_voucher_drafts 拉取;此处用代表性样例演示
// 「草稿 → 入库 → 过账 → 总账试算平衡」整条贯通链。
const handoffCostVoucherPlan: CostVoucherPlan = {
  planId: "demo-handoff-2026-06",
  projectId: "yubei-anzhi",
  projectName: "渝北区某安置房项目",
  reviewVersionId: "rv-2026-06",
  tailDifferenceMode: "fixed_account",
  generatedCount: 2,
  skippedCount: 1,
  approvedTotal: 3_400_000,
  vouchers: [
    {
      voucherId: "cv-fenbu",
      sourceDocType: "cost_review_version",
      sourceDocId: "rv-2026-06",
      description: "分部分项审定结算结转在建工程",
      generationStatus: "generated",
      skipReason: null,
      tailDifference: 0,
      tailAdjustedEntryId: null,
      balanced: true,
      debitTotal: 2_860_000,
      creditTotal: 2_860_000,
      entries: [
        {
          entryId: "e1",
          accountCode: "1604",
          accountName: "在建工程—分部分项",
          direction: "debit",
          amount: 2_860_000,
          summary: "分部分项审定合价",
          sourceTable: "cost_boq_items",
          sourceNodeId: null,
        },
        {
          entryId: "e2",
          accountCode: "2202",
          accountName: "应付账款—审定结算款",
          direction: "credit",
          amount: 2_860_000,
          summary: "应付施工单位结算款",
          sourceTable: "cost_boq_items",
          sourceNodeId: null,
        },
      ],
    },
    {
      voucherId: "cv-cuoshi",
      sourceDocType: "cost_review_version",
      sourceDocId: "rv-2026-06",
      description: "措施项目与规费审定结转",
      generationStatus: "generated",
      skipReason: null,
      tailDifference: 0,
      tailAdjustedEntryId: null,
      balanced: true,
      debitTotal: 540_000,
      creditTotal: 540_000,
      entries: [
        {
          entryId: "e3",
          accountCode: "1604",
          accountName: "在建工程—措施项目",
          direction: "debit",
          amount: 540_000,
          summary: "措施项目审定金额",
          sourceTable: "cost_measure_items",
          sourceNodeId: null,
        },
        {
          entryId: "e4",
          accountCode: "2221",
          accountName: "应交税费—应交增值税(销项)",
          direction: "credit",
          amount: 48_600,
          summary: "销项税额",
          sourceTable: "cost_fee_summary_items",
          sourceNodeId: null,
        },
        {
          entryId: "e5",
          accountCode: "2202",
          accountName: "应付账款—审定结算款",
          direction: "credit",
          amount: 491_400,
          summary: "应付措施费",
          sourceTable: "cost_measure_items",
          sourceNodeId: null,
        },
      ],
    },
    {
      voucherId: "cv-other",
      sourceDocType: "cost_review_version",
      sourceDocId: "rv-2026-06",
      description: "其他项目暂列金额(待发生)",
      generationStatus: "skipped",
      skipReason: "暂列金额未实际发生，暂不生成凭证",
      tailDifference: 0,
      tailAdjustedEntryId: null,
      balanced: true,
      debitTotal: 0,
      creditTotal: 0,
      entries: [],
    },
  ],
};

function FinanceManagementControl({
  onAudit,
}: {
  onAudit: (summary: string) => void;
}) {
  const [parameters, setParameters] = useState<FinanceAccountingParameters>(
    defaultFinanceAccountingParameters,
  );
  const [selectedBookIds, setSelectedBookIds] = useState(() =>
    financeLedgerBooks.map((book) => book.id),
  );
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() =>
    financeVoucherSourceDocuments.map((document) => document.id),
  );
  const [activeTab, setActiveTab] = useState<FinanceMainTab>("凭证生成");
  const [activeBottomTab, setActiveBottomTab] =
    useState<FinanceBottomTab>("凭证生成报告");
  const [selectedEntryTypeId, setSelectedEntryTypeId] = useState(
    financeEntryTypes.find((entry) => entry.code === "AOAE006")?.id ??
      financeEntryTypes[0]?.id ??
      "",
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    financeVoucherTemplates[0]?.id ?? "",
  );
  const [voucherRun, setVoucherRun] = useState<VoucherGenerationRun>(() =>
    runVoucherGeneration(
      defaultFinanceAccountingParameters,
      financeLedgerBooks.map((book) => book.id),
      financeVoucherSourceDocuments.map((document) => document.id),
    ),
  );
  const [reconciliationRun, setReconciliationRun] = useState<ReconciliationRun>(
    () => runReconciliation(financeReconciliationPlan, defaultFinanceBookId),
  );
  const [lastAction, setLastAction] = useState(
    "智能会计平台已按 K2617 手册加载系统参数、基础设置、凭证生成和财务核对。",
  );
  // 可拖拽面板尺寸(此前左栏 230px、底部 210px 写死,无法调整)。
  const [financeTreeWidth, setFinanceTreeWidth] = useState<number>(
    FINANCE_TREE_WIDTH.default,
  );
  const [financeBottomHeight, setFinanceBottomHeight] = useState<number>(
    FINANCE_BOTTOM_HEIGHT.default,
  );
  const startFinanceTreeResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = financeTreeWidth;
    const onMove = (moveEvent: MouseEvent) =>
      setFinanceTreeWidth(
        clampPaneSize(
          startWidth,
          moveEvent.clientX - startX,
          FINANCE_TREE_WIDTH.min,
          FINANCE_TREE_WIDTH.max,
        ),
      );
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const startFinanceBottomResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = financeBottomHeight;
    const onMove = (moveEvent: MouseEvent) =>
      setFinanceBottomHeight(
        clampPaneSize(
          startHeight,
          startY - moveEvent.clientY,
          FINANCE_BOTTOM_HEIGHT.min,
          FINANCE_BOTTOM_HEIGHT.max,
        ),
      );
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const selectedEntryType =
    financeEntryTypes.find((entry) => entry.id === selectedEntryTypeId) ??
    financeEntryTypes[0];
  const selectedTemplate =
    financeVoucherTemplates.find(
      (template) => template.id === selectedTemplateId,
    ) ?? financeVoucherTemplates[0];
  const selectedBook =
    financeLedgerBooks.find((book) => selectedBookIds.includes(book.id)) ??
    financeLedgerBooks[0];
  const selectedDocumentSet = new Set(selectedDocumentIds);
  const selectedBookSet = new Set(selectedBookIds);

  function audit(summary: string) {
    setLastAction(summary);
    onAudit(`财务管理: ${summary}`);
  }

  function changeParameter<K extends keyof FinanceAccountingParameters>(
    key: K,
    value: FinanceAccountingParameters[K],
  ) {
    setParameters((current) => ({ ...current, [key]: value }));
    audit(`更新系统参数 ${String(key)}`);
  }

  function toggleBook(bookId: string) {
    setSelectedBookIds((current) =>
      current.includes(bookId)
        ? current.length > 1
          ? current.filter((id) => id !== bookId)
          : current
        : [...current, bookId],
    );
  }

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.length > 1
          ? current.filter((id) => id !== documentId)
          : current
        : [...current, documentId],
    );
  }

  function generateVouchers() {
    const next = runVoucherGeneration(
      parameters,
      selectedBookIds,
      selectedDocumentIds,
    );
    setVoucherRun(next);
    setActiveTab("凭证生成");
    setActiveBottomTab(
      next.resultSections.includes("report") ? "凭证生成报告" : "凭证列表",
    );
    audit(next.auditSummary);
  }

  function reconcile() {
    const next = runReconciliation(
      financeReconciliationPlan,
      selectedBook?.id ?? defaultFinanceBookId,
    );
    setReconciliationRun(next);
    setActiveTab("财务核对");
    setActiveBottomTab(next.unbalancedCount > 0 ? "差异分析" : "对账方案字段");
    audit(next.auditSummary);
  }

  function renderMainPanel() {
    if (activeTab === "财务报表") {
      const income = buildIncomeStatement(financeStatementBalances);
      const sheet = buildBalanceSheet(financeStatementBalances);
      const yuan = (n: number) =>
        `¥${n.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      const cellTable =
        "w-full border-collapse text-xs [&_th]:border [&_th]:border-[var(--arch-border)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-[var(--arch-border)] [&_td]:px-2 [&_td]:py-1";
      return (
        <div className="grid h-full min-h-0 gap-3 overflow-auto xl:grid-cols-2">
          <div>
            <FinanceSectionHeader
              title="资产负债表"
              subtitle={
                sheet.balanced
                  ? "资产 = 负债 + 所有者权益 + 本期利润 ✓ 平衡"
                  : "✗ 未平衡(检查科目余额)"
              }
            />
            <table className={`mt-2 ${cellTable}`}>
              <thead>
                <tr className="bg-[var(--arch-surface-muted)]">
                  <th>科目</th>
                  <th>类别</th>
                  <th className="!text-right">余额</th>
                </tr>
              </thead>
              <tbody>
                {[...sheet.assets, ...sheet.liabilities, ...sheet.equity].map(
                  (line) => (
                    <tr key={line.code}>
                      <td>
                        {line.code} {line.name}
                      </td>
                      <td>{ACCOUNT_CATEGORY_LABELS[line.category]}</td>
                      <td className="text-right">{yuan(line.amount)}</td>
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot className="font-semibold">
                <tr>
                  <td colSpan={2}>资产合计</td>
                  <td className="text-right">{yuan(sheet.totalAssets)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>负债 + 权益 + 本期利润</td>
                  <td className="text-right">
                    {yuan(
                      sheet.totalLiabilities +
                        sheet.totalEquity +
                        sheet.netProfit,
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <FinanceSectionHeader
              title="利润表"
              subtitle={`本期净利润 ${yuan(income.netProfit)}`}
            />
            <table className={`mt-2 ${cellTable}`}>
              <thead>
                <tr className="bg-[var(--arch-surface-muted)]">
                  <th>项目</th>
                  <th className="!text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-semibold">
                  <td>一、营业收入</td>
                  <td className="text-right">{yuan(income.totalRevenue)}</td>
                </tr>
                {income.revenues.map((line) => (
                  <tr key={line.code}>
                    <td className="pl-5">
                      {line.code} {line.name}
                    </td>
                    <td className="text-right">{yuan(line.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>二、营业成本及费用</td>
                  <td className="text-right">{yuan(income.totalExpense)}</td>
                </tr>
                {income.expenses.map((line) => (
                  <tr key={line.code}>
                    <td className="pl-5">
                      {line.code} {line.name}
                    </td>
                    <td className="text-right">{yuan(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold">
                <tr>
                  <td>三、净利润</td>
                  <td className="text-right">{yuan(income.netProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }
    if (activeTab === "造价凭证贯通") {
      const posted = postCostVoucherPlan(handoffCostVoucherPlan, {
        period: "2026-06",
      });
      const ledger = postToGeneralLedger(posted.vouchers);
      const yuan = (n: number) =>
        `¥${n.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      const cellTable =
        "w-full border-collapse text-xs [&_th]:border [&_th]:border-[var(--arch-border)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-[var(--arch-border)] [&_td]:px-2 [&_td]:py-1";
      return (
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto">
          <FinanceSectionHeader
            title="造价凭证贯通 · 自计量造价审定移交"
            subtitle={`项目 ${handoffCostVoucherPlan.projectName} · 审定版本 ${handoffCostVoucherPlan.reviewVersionId} · 审定合计 ${yuan(
              handoffCostVoucherPlan.approvedTotal,
            )}`}
          />
          <div className="grid gap-2 text-xs md:grid-cols-4">
            <FinanceInfoTile
              label="移交草稿"
              value={`${
                handoffCostVoucherPlan.generatedCount +
                handoffCostVoucherPlan.skippedCount
              } 张`}
            />
            <FinanceInfoTile
              label="入库凭证"
              value={`${posted.postedCount} 张 · 跳过 ${posted.skippedCount}`}
            />
            <FinanceInfoTile
              label="借 / 贷合计"
              value={`${yuan(posted.totalDebit)} / ${yuan(posted.totalCredit)}`}
            />
            <FinanceInfoTile
              label="试算平衡"
              value={ledger.balanced ? "✓ 借贷平衡" : "✗ 不平衡"}
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--arch-text)]">
              入库正式凭证(草稿 → 编号入库)
            </p>
            <table className={cellTable}>
              <thead>
                <tr className="bg-[var(--arch-surface-muted)]">
                  <th>凭证号</th>
                  <th>期间</th>
                  <th>摘要</th>
                  <th className="!text-right">借方合计</th>
                  <th className="!text-right">贷方合计</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {posted.vouchers.map((voucher) => (
                  <tr key={voucher.sourceVoucherId}>
                    <td>{voucher.voucherNo || "—"}</td>
                    <td>{voucher.period}</td>
                    <td>
                      {voucher.description}
                      {voucher.status === "skipped" && voucher.skipReason
                        ? `（跳过:${voucher.skipReason}）`
                        : ""}
                    </td>
                    <td className="text-right">
                      {voucher.status === "posted"
                        ? yuan(voucher.debitTotal)
                        : "—"}
                    </td>
                    <td className="text-right">
                      {voucher.status === "posted"
                        ? yuan(voucher.creditTotal)
                        : "—"}
                    </td>
                    <td>
                      {voucher.status === "skipped"
                        ? "跳过"
                        : voucher.balanced
                          ? "已入库 ✓"
                          : "不平衡 ✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--arch-text)]">
              过账总账 · 试算平衡
            </p>
            <table className={cellTable}>
              <thead>
                <tr className="bg-[var(--arch-surface-muted)]">
                  <th>科目编码</th>
                  <th>科目名称</th>
                  <th className="!text-right">借方</th>
                  <th className="!text-right">贷方</th>
                  <th className="!text-right">期末余额</th>
                </tr>
              </thead>
              <tbody>
                {ledger.accounts.map((account) => (
                  <tr key={account.accountCode}>
                    <td>{account.accountCode}</td>
                    <td>{account.accountName}</td>
                    <td className="text-right">{yuan(account.debitTotal)}</td>
                    <td className="text-right">{yuan(account.creditTotal)}</td>
                    <td className="text-right">
                      {yuan(account.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--arch-surface-muted)] font-semibold">
                  <td colSpan={2}>合计</td>
                  <td className="text-right">{yuan(ledger.debitTotal)}</td>
                  <td className="text-right">{yuan(ledger.creditTotal)}</td>
                  <td className="text-right">
                    {ledger.balanced ? "借贷平衡 ✓" : "不平衡 ✗"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-[var(--arch-text-muted)]">
            样例数据演示「审定 → 凭证草稿 → 入库 → 过账 → 试算平衡」整条贯通链;接入后端
            cost_voucher_drafts 后即按真实审定移交凭证入库与过账。
          </p>
        </div>
      );
    }
    if (activeTab === "系统参数") {
      return (
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
            <FinanceSectionHeader
              title="系统参数"
              subtitle="K2617: 尾差、凭证顺序、凭证生成结果展示"
            />
            <table className="w-full border-collapse text-xs">
              <thead className="bg-[var(--module-accent-soft)] text-slate-700">
                <tr>
                  <FinanceHeadCell>参数项</FinanceHeadCell>
                  <FinanceHeadCell>当前取值</FinanceHeadCell>
                  <FinanceHeadCell>手册约束</FinanceHeadCell>
                  <FinanceHeadCell>状态</FinanceHeadCell>
                </tr>
              </thead>
              <tbody>
                <FinanceParameterRow
                  label="尾差调整方式"
                  value={
                    tailDifferenceAdjustmentLabels[
                      parameters.tailDifferenceAdjustment
                    ]
                  }
                  rule="金额最大分录行 / 固定科目二选一"
                  status={
                    parameters.tailDifferenceAdjustment === "fixed_account" &&
                    !parameters.tailDifferenceAccount
                      ? "待补科目"
                      : "可用"
                  }
                />
                <FinanceParameterRow
                  label="尾差调整科目"
                  value={parameters.tailDifferenceAccount ?? "未启用"}
                  rule="选择固定科目时必须录入"
                  status={
                    parameters.tailDifferenceAdjustment === "fixed_account"
                      ? "必填"
                      : "不适用"
                  }
                />
                <FinanceParameterRow
                  label="凭证顺序生成方式"
                  value={
                    voucherSequenceModeLabels[parameters.voucherSequenceMode]
                  }
                  rule="来源单据+凭证日期 / 来源单据+单据编码 / 凭证日期"
                  status="可用"
                />
                <FinanceParameterRow
                  label="凭证生成结果展示"
                  value={voucherResultViewLabels[parameters.voucherResultView]}
                  rule="报告 / 凭证列表 / 两者"
                  status="可用"
                />
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-sm border border-slate-200 bg-white p-3">
            <FinanceFieldLabel label="尾差调整方式">
              <select
                value={parameters.tailDifferenceAdjustment}
                onChange={(event) =>
                  changeParameter(
                    "tailDifferenceAdjustment",
                    event.target
                      .value as FinanceAccountingParameters["tailDifferenceAdjustment"],
                  )
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                {Object.entries(tailDifferenceAdjustmentLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </FinanceFieldLabel>
            <FinanceFieldLabel label="尾差调整科目">
              <input
                value={parameters.tailDifferenceAccount ?? ""}
                onChange={(event) =>
                  changeParameter(
                    "tailDifferenceAccount",
                    event.target.value || null,
                  )
                }
                placeholder="选择固定科目时填写"
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
              />
            </FinanceFieldLabel>
            <FinanceFieldLabel label="凭证顺序生成方式">
              <select
                value={parameters.voucherSequenceMode}
                onChange={(event) =>
                  changeParameter(
                    "voucherSequenceMode",
                    event.target
                      .value as FinanceAccountingParameters["voucherSequenceMode"],
                  )
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                {Object.entries(voucherSequenceModeLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </FinanceFieldLabel>
            <FinanceFieldLabel label="凭证生成结果展示">
              <select
                value={parameters.voucherResultView}
                onChange={(event) =>
                  changeParameter(
                    "voucherResultView",
                    event.target
                      .value as FinanceAccountingParameters["voucherResultView"],
                  )
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                {Object.entries(voucherResultViewLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </FinanceFieldLabel>
          </div>
        </div>
      );
    }

    if (activeTab === "基础设置") {
      return (
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
            <FinanceSectionHeader
              title="分录类型"
              subtitle={`手册提供 ${financeEntryTypeCatalogSize} 种参考类型；当前展开手册明确字段和样例规则`}
            />
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--module-accent-soft)] text-slate-700">
                  <tr>
                    <FinanceHeadCell>编码</FinanceHeadCell>
                    <FinanceHeadCell>名称</FinanceHeadCell>
                    <FinanceHeadCell>科目取值规则</FinanceHeadCell>
                    <FinanceHeadCell>影响因素</FinanceHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {financeEntryTypes.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedEntryTypeId(entry.id)}
                      className={`cursor-pointer border-t border-slate-100 ${
                        selectedEntryType?.id === entry.id
                          ? "bg-[var(--module-accent-soft)]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <FinanceCell strong>{entry.code}</FinanceCell>
                      <FinanceCell>{entry.name}</FinanceCell>
                      <FinanceCell>{entry.accountRule}</FinanceCell>
                      <FinanceCell>
                        {entry.influenceFactors.join(" / ")}
                      </FinanceCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
            <FinanceSectionHeader
              title="凭证模板"
              subtitle="来源单据、适用账簿、核算组织来源、凭证字、业务分类、模板分录"
            />
            <div className="grid min-h-[360px] gap-0 xl:grid-cols-[210px_minmax(0,1fr)]">
              <div className="border-r border-slate-200 bg-slate-50">
                {financeVoucherTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`block w-full border-b border-slate-200 px-3 py-3 text-left text-xs ${
                      selectedTemplate?.id === template.id
                        ? "bg-white text-[var(--module-accent)]"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    <span className="block font-semibold">{template.name}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {template.sourceDocumentType} · {template.accountChart}
                    </span>
                  </button>
                ))}
              </div>
              <div className="min-w-0 overflow-auto p-3">
                <div className="grid gap-2 text-xs md:grid-cols-3">
                  <FinanceInfoTile
                    label="来源单据"
                    value={selectedTemplate?.sourceDocumentType}
                  />
                  <FinanceInfoTile
                    label="凭证字"
                    value={selectedTemplate?.voucherWord}
                  />
                  <FinanceInfoTile
                    label="凭证日期"
                    value={
                      selectedTemplate
                        ? voucherDateSourceLabels[
                            selectedTemplate.voucherDateSource
                          ]
                        : ""
                    }
                  />
                  <FinanceInfoTile
                    label="核算组织来源"
                    value={selectedTemplate?.accountingOrgSource}
                  />
                  <FinanceInfoTile
                    label="适用账簿"
                    value={`${selectedTemplate?.applicableBookIds.length ?? 0} 个`}
                  />
                  <FinanceInfoTile
                    label="业务分类"
                    value={`${selectedTemplate?.businessCategories.length ?? 0} 条`}
                  />
                </div>
                <table className="mt-3 w-full border-collapse text-xs">
                  <thead className="bg-[var(--module-accent-soft)] text-slate-700">
                    <tr>
                      <FinanceHeadCell>分录</FinanceHeadCell>
                      <FinanceHeadCell>科目</FinanceHeadCell>
                      <FinanceHeadCell>借贷</FinanceHeadCell>
                      <FinanceHeadCell>生成条件</FinanceHeadCell>
                      <FinanceHeadCell>核算维度取源</FinanceHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTemplate?.entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <FinanceCell>{entry.summary}</FinanceCell>
                        <FinanceCell strong>{entry.accountSubject}</FinanceCell>
                        <FinanceCell>
                          {entry.debitCredit === "debit" ? "借" : "贷"}
                        </FinanceCell>
                        <FinanceCell>
                          {entry.generationCondition ?? "无条件生成"}
                        </FinanceCell>
                        <FinanceCell>
                          {entry.accountingDimensionSource.join(" / ")}
                        </FinanceCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "财务核对") {
      return (
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
            <FinanceSectionHeader
              title="对账方案"
              subtitle={financeReconciliationPlan.name}
            />
            <div className="space-y-2 p-3 text-xs">
              <FinanceInfoTile
                label="方案编码"
                value={financeReconciliationPlan.code}
              />
              <FinanceInfoTile
                label="科目表"
                value={financeReconciliationPlan.accountChart}
              />
              <FinanceInfoTile
                label="适用账簿"
                value={financeReconciliationPlan.applicableBookIds.join(" / ")}
              />
              <FinanceInfoTile
                label="当前账簿"
                value={`${reconciliationRun.bookName} · ${reconciliationRun.period}`}
              />
              <button
                type="button"
                onClick={reconcile}
                className="mt-2 w-full rounded border border-[var(--module-accent)] bg-[var(--module-accent)] px-3 py-2 text-xs font-semibold text-[var(--module-accent-foreground)] hover:brightness-95"
              >
                执行对账
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
            <FinanceSectionHeader
              title="总账科目与业务报表核对"
              subtitle="期末差异为 0 判定平衡；本期增加/减少差异不为 0 时进入差异分析"
            />
            <table className="w-full border-collapse text-xs">
              <thead className="bg-[var(--module-accent-soft)] text-slate-700">
                <tr>
                  <FinanceHeadCell>项目</FinanceHeadCell>
                  <FinanceHeadCell>科目</FinanceHeadCell>
                  <FinanceHeadCell align="right">期初差异</FinanceHeadCell>
                  <FinanceHeadCell align="right">本期增加差异</FinanceHeadCell>
                  <FinanceHeadCell align="right">本期减少差异</FinanceHeadCell>
                  <FinanceHeadCell align="right">期末差异</FinanceHeadCell>
                  <FinanceHeadCell>对账结果</FinanceHeadCell>
                  <FinanceHeadCell>关联操作</FinanceHeadCell>
                </tr>
              </thead>
              <tbody>
                {reconciliationRun.lines.map((line) => (
                  <tr key={line.itemId} className="border-t border-slate-100">
                    <FinanceCell strong>{line.itemName}</FinanceCell>
                    <FinanceCell>{line.accountSubject}</FinanceCell>
                    <FinanceCell align="right">
                      {formatMoney(line.beginningDifference)}
                    </FinanceCell>
                    <FinanceCell align="right">
                      {formatMoney(line.increaseDifference)}
                    </FinanceCell>
                    <FinanceCell align="right">
                      {formatMoney(line.decreaseDifference)}
                    </FinanceCell>
                    <FinanceCell align="right">
                      {formatMoney(line.endingDifference)}
                    </FinanceCell>
                    <FinanceCell>
                      <FinanceStatusBadge
                        tone={line.result === "balanced" ? "green" : "red"}
                        label={line.result === "balanced" ? "平衡" : "不平衡"}
                      />
                    </FinanceCell>
                    <FinanceCell>
                      {line.relatedOperation === "difference_analysis"
                        ? "差异分析"
                        : "联查明细账"}
                    </FinanceCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
          <FinanceSectionHeader
            title="凭证生成选择"
            subtitle="支持多账簿、多来源单据批量生成"
          />
          <div className="space-y-3 p-3 text-xs">
            <div>
              <p className="mb-2 font-semibold text-slate-700">账簿</p>
              {financeLedgerBooks.map((book) => (
                <FinanceCheckRow
                  key={book.id}
                  checked={selectedBookSet.has(book.id)}
                  label={book.name}
                  description={`${book.accountingSystem} · ${book.period}`}
                  onChange={() => toggleBook(book.id)}
                />
              ))}
            </div>
            <div>
              <p className="mb-2 font-semibold text-slate-700">来源单据</p>
              {financeVoucherSourceDocuments.map((document) => (
                <FinanceCheckRow
                  key={document.id}
                  checked={selectedDocumentSet.has(document.id)}
                  label={`${document.code} · ${document.name}`}
                  description={`${document.sourceSystem} / ${document.sourceDocumentType} / ${formatMoney(document.amount)}`}
                  onChange={() => toggleDocument(document.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={generateVouchers}
              className="w-full rounded border border-[var(--module-accent)] bg-[var(--module-accent)] px-3 py-2 text-xs font-semibold text-[var(--module-accent-foreground)] hover:brightness-95"
            >
              生成凭证
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
          <FinanceSectionHeader
            title="凭证生成报告"
            subtitle={`${voucherRun.generatedCount} 条已生成 · ${voucherRun.blockedCount} 条未生成`}
          />
          <table className="w-full border-collapse text-xs">
            <thead className="bg-[var(--module-accent-soft)] text-slate-700">
              <tr>
                <FinanceHeadCell>账簿</FinanceHeadCell>
                <FinanceHeadCell>来源单据</FinanceHeadCell>
                <FinanceHeadCell>模板</FinanceHeadCell>
                <FinanceHeadCell>业务分类</FinanceHeadCell>
                <FinanceHeadCell>凭证号</FinanceHeadCell>
                <FinanceHeadCell>状态</FinanceHeadCell>
                <FinanceHeadCell>报告信息</FinanceHeadCell>
              </tr>
            </thead>
            <tbody>
              {voucherRun.records.map((record) => (
                <tr key={record.id} className="border-t border-slate-100">
                  <FinanceCell>{record.bookName}</FinanceCell>
                  <FinanceCell>
                    <span className="font-semibold">
                      {record.sourceDocumentCode}
                    </span>
                    <span className="ml-1 text-slate-500">
                      {record.sourceDocumentType}
                    </span>
                  </FinanceCell>
                  <FinanceCell>{record.templateName ?? "-"}</FinanceCell>
                  <FinanceCell>
                    {record.businessCategoryName ?? "-"}
                  </FinanceCell>
                  <FinanceCell>{record.voucherNo ?? "-"}</FinanceCell>
                  <FinanceCell>
                    <FinanceStatusBadge
                      tone={record.status === "generated" ? "green" : "red"}
                      label={
                        record.status === "generated" ? "已生成" : "未生成"
                      }
                    />
                  </FinanceCell>
                  <FinanceCell>{record.message}</FinanceCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderBottomPanel() {
    if (activeBottomTab === "凭证列表") {
      const generated = voucherRun.records.filter(
        (record) => record.status === "generated",
      );
      return (
        <table className="w-full border-collapse text-xs">
          <thead className="bg-[var(--module-accent-soft)] text-slate-700">
            <tr>
              <FinanceHeadCell>凭证号</FinanceHeadCell>
              <FinanceHeadCell>账簿</FinanceHeadCell>
              <FinanceHeadCell>来源单据</FinanceHeadCell>
              <FinanceHeadCell>模板分录</FinanceHeadCell>
              <FinanceHeadCell>展示方式</FinanceHeadCell>
            </tr>
          </thead>
          <tbody>
            {generated.map((record) => (
              <tr key={record.id} className="border-t border-slate-100">
                <FinanceCell strong>{record.voucherNo}</FinanceCell>
                <FinanceCell>{record.bookName}</FinanceCell>
                <FinanceCell>{record.sourceDocumentCode}</FinanceCell>
                <FinanceCell>
                  {record.generatedEntryIds.join(" / ")}
                </FinanceCell>
                <FinanceCell>
                  {voucherResultViewLabels[record.resultView]}
                </FinanceCell>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeBottomTab === "差异分析") {
      return (
        <table className="w-full border-collapse text-xs">
          <thead className="bg-[var(--module-accent-soft)] text-slate-700">
            <tr>
              <FinanceHeadCell>对账项目</FinanceHeadCell>
              <FinanceHeadCell>检查项</FinanceHeadCell>
              <FinanceHeadCell>结果</FinanceHeadCell>
              <FinanceHeadCell>证据</FinanceHeadCell>
            </tr>
          </thead>
          <tbody>
            {reconciliationRun.lines.flatMap((line) =>
              line.checks.map((check) => (
                <tr
                  key={`${line.itemId}-${check.code}`}
                  className="border-t border-slate-100"
                >
                  <FinanceCell strong>{line.itemName}</FinanceCell>
                  <FinanceCell>{check.label}</FinanceCell>
                  <FinanceCell>
                    <FinanceStatusBadge
                      tone={check.passed ? "green" : "red"}
                      label={check.passed ? "通过" : "需处理"}
                    />
                  </FinanceCell>
                  <FinanceCell>{check.evidence}</FinanceCell>
                </tr>
              )),
            )}
          </tbody>
        </table>
      );
    }

    if (activeBottomTab === "对账方案字段") {
      return (
        <table className="w-full border-collapse text-xs">
          <thead className="bg-[var(--module-accent-soft)] text-slate-700">
            <tr>
              <FinanceHeadCell>对账项目</FinanceHeadCell>
              <FinanceHeadCell>余额方向</FinanceHeadCell>
              <FinanceHeadCell>科目</FinanceHeadCell>
              <FinanceHeadCell>核算维度</FinanceHeadCell>
              <FinanceHeadCell>业务报表</FinanceHeadCell>
              <FinanceHeadCell>报表过滤</FinanceHeadCell>
            </tr>
          </thead>
          <tbody>
            {financeReconciliationPlan.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <FinanceCell strong>{item.name}</FinanceCell>
                <FinanceCell>
                  {item.balanceDirection === "debit" ? "借方" : "贷方"}
                </FinanceCell>
                <FinanceCell>{item.accountSubject}</FinanceCell>
                <FinanceCell>{item.accountingDimension}</FinanceCell>
                <FinanceCell>{item.businessReport}</FinanceCell>
                <FinanceCell>{item.reportFilter}</FinanceCell>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="w-full border-collapse text-xs">
        <thead className="bg-[var(--module-accent-soft)] text-slate-700">
          <tr>
            <FinanceHeadCell>来源单据</FinanceHeadCell>
            <FinanceHeadCell>账簿</FinanceHeadCell>
            <FinanceHeadCell>期间</FinanceHeadCell>
            <FinanceHeadCell>状态</FinanceHeadCell>
            <FinanceHeadCell>信息</FinanceHeadCell>
          </tr>
        </thead>
        <tbody>
          {voucherRun.records.map((record) => (
            <tr key={record.id} className="border-t border-slate-100">
              <FinanceCell strong>{record.sourceDocumentCode}</FinanceCell>
              <FinanceCell>{record.bookName}</FinanceCell>
              <FinanceCell>{record.period}</FinanceCell>
              <FinanceCell>
                <FinanceStatusBadge
                  tone={record.status === "generated" ? "green" : "red"}
                  label={record.status === "generated" ? "已生成" : "未生成"}
                />
              </FinanceCell>
              <FinanceCell>{record.message}</FinanceCell>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section
      data-business-workbench
      className="flex h-full min-h-[720px] flex-col gap-2 overflow-hidden bg-[var(--arch-bg)] p-3 text-[var(--arch-text)]"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--module-accent-soft)] text-sm font-semibold text-[var(--module-accent)]">
            财
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              财务管理默认开发快照 · 智能会计平台
            </h2>
            <p className="truncate text-[11px] text-[var(--arch-text-muted)]">
              {financeManualSource.id} · {financeManualSource.title} ·{" "}
              {financeManualSource.version}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--module-accent)]">
          <span className="rounded-full border border-[var(--module-accent-soft)] bg-[var(--module-accent-soft)] px-2.5 py-1">
            本地样例库 · 待专业复核
          </span>
          <span className="rounded-full border border-[var(--module-accent-soft)] bg-[var(--module-accent-soft)] px-2.5 py-1">
            posting-ready 未启用
          </span>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-2 shadow-sm">
        <FinanceRibbonButton
          icon={<FileCog className="h-4 w-4" />}
          label="保存参数"
          onClick={() => audit("保存智能会计系统参数")}
        />
        <FinanceRibbonButton
          icon={<ShieldAlert className="h-4 w-4" />}
          label="参数校验"
          onClick={() => {
            setActiveTab("系统参数");
            audit("校验系统参数和尾差调整科目");
          }}
        />
        <FinanceRibbonButton
          icon={<Boxes className="h-4 w-4" />}
          label="分录类型"
          onClick={() => setActiveTab("基础设置")}
        />
        <FinanceRibbonButton
          icon={<Workflow className="h-4 w-4" />}
          label="凭证模板"
          onClick={() => setActiveTab("基础设置")}
        />
        <FinanceRibbonButton
          icon={<FileCog className="h-4 w-4" />}
          label="生成凭证"
          onClick={generateVouchers}
          primary
        />
        <FinanceRibbonButton
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="执行对账"
          onClick={reconcile}
        />
        <FinanceRibbonButton
          icon={<Activity className="h-4 w-4" />}
          label="差异分析"
          onClick={() => {
            setActiveTab("财务核对");
            setActiveBottomTab("差异分析");
            audit("打开财务核对差异分析");
          }}
        />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-1 text-xs shadow-sm md:flex">
        {financeMainTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-left font-medium ${
              activeTab === tab
                ? "bg-[var(--module-accent-soft)] text-[var(--module-accent)]"
                : "text-[var(--arch-text-muted)] hover:bg-[var(--arch-surface-muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        className="relative grid min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] shadow-sm"
        style={{
          gridTemplateColumns: `${financeTreeWidth}px minmax(0,1fr)`,
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整项目结构栏宽度"
          onMouseDown={startFinanceTreeResize}
          onDoubleClick={() => setFinanceTreeWidth(FINANCE_TREE_WIDTH.default)}
          title="拖拽调整宽度，双击复位"
          className="absolute bottom-0 top-0 z-20 w-[7px] cursor-col-resize hover:bg-[var(--module-accent-soft)]"
          style={{ left: `calc(${financeTreeWidth}px - 3px)` }}
        />
        <aside className="min-h-0 overflow-auto border-r border-[var(--arch-border)] bg-[var(--arch-surface)]">
          <div className="border-b border-[var(--arch-border)] px-3 py-2 text-xs font-semibold text-[var(--arch-text)]">
            项目结构
          </div>
          {financeManualSections.map((section) => (
            <div
              key={section.id}
              className="border-b border-[var(--arch-border)] px-3 py-2"
            >
              <p className="text-xs font-semibold text-[var(--arch-text)]">
                {section.name}
              </p>
              <div className="mt-1 space-y-1">
                {section.capabilities.map((capability) => (
                  <button
                    key={capability}
                    type="button"
                    onClick={() => {
                      const nextTab =
                        section.id === "system_parameters"
                          ? "系统参数"
                          : section.id === "financial_reconciliation"
                            ? "财务核对"
                            : section.id === "voucher_generation"
                              ? "凭证生成"
                              : "基础设置";
                      setActiveTab(nextTab);
                    }}
                    className="block w-full rounded-md px-2 py-1 text-left text-[11px] text-[var(--arch-text-muted)] hover:bg-[var(--module-accent-soft)] hover:text-[var(--module-accent)]"
                  >
                    {capability}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="min-h-0 overflow-auto bg-[var(--arch-bg)] p-2">
          <div className="mb-2 grid gap-2 text-xs md:grid-cols-5">
            <FinanceInfoTile
              label="账簿"
              value={`${selectedBookIds.length} 个`}
            />
            <FinanceInfoTile
              label="来源单据"
              value={`${selectedDocumentIds.length} 张`}
            />
            <FinanceInfoTile
              label="凭证生成"
              value={`${voucherRun.generatedCount} 成功 / ${voucherRun.blockedCount} 阻断`}
            />
            <FinanceInfoTile
              label="对账结果"
              value={`${reconciliationRun.balancedCount} 平衡 / ${reconciliationRun.unbalancedCount} 差异`}
            />
            <FinanceInfoTile label="最近动作" value={lastAction} />
          </div>
          <div className="min-h-[390px]">{renderMainPanel()}</div>
        </main>
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖拽调整底部面板高度"
        onMouseDown={startFinanceBottomResize}
        onDoubleClick={() => setFinanceBottomHeight(FINANCE_BOTTOM_HEIGHT.default)}
        title="拖拽调整高度，双击复位"
        className="h-[7px] shrink-0 cursor-row-resize rounded hover:bg-[var(--module-accent-soft)]"
      />

      <footer className="shrink-0 overflow-hidden rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--arch-border)] p-1 text-xs">
          {financeBottomTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveBottomTab(tab)}
              className={`rounded-md px-4 py-2 ${
                activeBottomTab === tab
                  ? "bg-[var(--module-accent-soft)] text-[var(--module-accent)]"
                  : "text-[var(--arch-text-muted)] hover:bg-[var(--arch-surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          className="overflow-auto"
          style={{ height: `${financeBottomHeight}px` }}
        >
          {renderBottomPanel()}
        </div>
      </footer>
    </section>
  );
}

function FinanceSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-2">
      <h3 className="text-sm font-semibold text-[var(--arch-text)]">{title}</h3>
      <p className="mt-0.5 text-[11px] text-[var(--arch-text-muted)]">
        {subtitle}
      </p>
    </div>
  );
}

function FinanceRibbonButton({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-[72px] items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
        primary
          ? "border-[var(--module-accent)] bg-[var(--module-accent)] text-[var(--module-accent-foreground)] hover:brightness-95"
          : "border-[var(--arch-border)] bg-[var(--arch-surface)] text-[var(--arch-text)] hover:border-[var(--module-accent)] hover:bg-[var(--module-accent-soft)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FinanceFieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs text-[var(--arch-text-muted)]">
      <span className="mb-1 block font-semibold text-[var(--arch-text)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function FinanceInfoTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] px-3 py-2">
      <p className="text-[11px] text-[var(--arch-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--arch-text)]">
        {value || "-"}
      </p>
    </div>
  );
}

function FinanceCheckRow({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label className="mb-1 flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] px-2 py-2 hover:border-[var(--module-accent)] hover:bg-[var(--module-accent-soft)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[var(--arch-text)]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--arch-text-muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}

function FinanceHeadCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`border-r border-[var(--arch-border)] px-3 py-2 ${
        align === "right" ? "text-right" : "text-left"
      } font-semibold`}
    >
      {children}
    </th>
  );
}

function FinanceCell({
  children,
  align = "left",
  strong = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <td
      className={`border-r border-[var(--arch-border)] px-3 py-2 ${
        align === "right" ? "text-right" : "text-left"
      } ${strong ? "font-semibold text-[var(--arch-text)]" : "text-[var(--arch-text-muted)]"}`}
    >
      {children}
    </td>
  );
}

function FinanceParameterRow({
  label,
  value,
  rule,
  status,
}: {
  label: string;
  value: string;
  rule: string;
  status: string;
}) {
  return (
    <tr className="border-t border-slate-100">
      <FinanceCell strong>{label}</FinanceCell>
      <FinanceCell>{value}</FinanceCell>
      <FinanceCell>{rule}</FinanceCell>
      <FinanceCell>
        <FinanceStatusBadge
          tone={status === "待补科目" ? "red" : "green"}
          label={status}
        />
      </FinanceCell>
    </tr>
  );
}

function FinanceStatusBadge({
  tone,
  label,
}: {
  tone: "green" | "red" | "gray";
  label: string;
}) {
  const classes =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

function quantitySnapshotToProject(
  snapshot: QuantityCostingSnapshotResponse,
): QuantityCostingProject {
  return {
    projectId: snapshot.costingProjectKey,
    projectName: snapshot.name,
    jurisdiction: snapshot.jurisdiction,
    standardProfileId: snapshot.standardProfileId,
    quotaLibraryId: snapshot.quotaLibraryId,
    currentNodeId:
      snapshot.treeNodes[0]?.nodeId ??
      quantityCostingPhase1Project.currentNodeId,
    treeNodes: snapshot.treeNodes.map((node) => ({
      nodeId: node.nodeId,
      projectId: snapshot.costingProjectKey,
      parentId: node.parentId,
      nodeType:
        node.nodeType as QuantityCostingProject["treeNodes"][number]["nodeType"],
      name: node.name,
      specialty: node.specialty,
      sortOrder: node.sortOrder,
      standardProfileId: node.standardProfileId,
      quotaLibraryId: node.quotaLibraryId,
      auditState:
        node.auditState as QuantityCostingProject["treeNodes"][number]["auditState"],
    })),
    versions: [
      {
        versionId: snapshot.reviewVersionId ?? snapshot.reviewKey,
        projectId: snapshot.costingProjectKey,
        versionType: "review",
        reviewRound: snapshot.reviewRound,
        submittedVersionId: null,
        approvedVersionId: null,
        description: snapshot.reviewDescription,
        status: "reviewing",
        createdBy: "backend",
        createdAt: new Date().toISOString(),
        sourceFileIds: [],
        auditEventIds: [],
      },
    ],
    boqItems: snapshot.boqItems.map((item) => ({
      itemId: item.itemId,
      projectId: snapshot.costingProjectKey,
      nodeId: item.nodeId,
      submittedCode: item.submittedCode,
      approvedCode: item.approvedCode,
      submittedName: item.submittedName,
      approvedName: item.approvedName,
      submittedFeature: item.submittedFeature,
      approvedFeature: item.approvedFeature,
      unit: item.unit,
      submittedQty: item.submittedQty,
      approvedQty: item.approvedQty,
      submittedUnitPrice: item.submittedUnitPrice,
      approvedUnitPrice: item.approvedUnitPrice,
      sourceRef: item.sourceRef,
      ruleId: item.ruleId,
      ...(item.elementId ? { elementId: item.elementId } : {}),
      manualReviewRequired: item.sourceReviewRequired,
      // 自动生成的增减说明（【】文案/无增减）随当前数据实时重算，
      // 不能固化为手工覆盖——否则数据转换/回写后旧说明残留。
      ...((manual) => (manual === undefined ? {} : { manualChangeReason: manual }))(
        inferBoqManualChangeReason(item.changeReason),
      ),
      temporary: item.changeMark === "temporary",
    })),
  };
}

function quantitySnapshotMeasureItems(
  snapshot: QuantityCostingSnapshotResponse | null,
): CostMeasureItem[] {
  if (!snapshot) return quantityCostingPhase2MeasureItems;
  return snapshot.measureItems.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    measureType: item.measureType as CostMeasureItem["measureType"],
    submittedBaseAmount: item.submittedBaseAmount,
    approvedBaseAmount: item.approvedBaseAmount,
    submittedRate: item.submittedRate,
    approvedRate: item.approvedRate,
    sourceRuleId: item.sourceRuleId,
    sourceRef: item.sourceRef,
  }));
}

function quantitySnapshotOtherItems(
  snapshot: QuantityCostingSnapshotResponse | null,
): CostOtherItem[] {
  if (!snapshot) return quantityCostingPhase2OtherItems;
  return snapshot.otherItems.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    otherType: item.otherType as CostOtherItem["otherType"],
    submittedAmount: item.submittedAmount,
    approvedAmount: item.approvedAmount,
    sourceRuleId: item.sourceRuleId,
    sourceRef: item.sourceRef,
  }));
}

function quantitySnapshotFeeRules(
  snapshot: QuantityCostingSnapshotResponse | null,
): CostFeeRule[] {
  if (!snapshot) return quantityCostingPhase2FeeRules;
  return snapshot.feeSummaryItems.map((item) => ({
    feeId: item.feeId,
    name: item.name,
    submittedBaseAmount: item.submittedBaseAmount,
    approvedBaseAmount: item.approvedBaseAmount,
    submittedRate: item.submittedRate,
    approvedRate: item.approvedRate,
    sourceRuleId: item.sourceRuleId,
    sourceRef: item.sourceRef,
  }));
}

type CostingMainNav =
  | "编制"
  | "审核"
  | "质控"
  | "报表"
  | "成本测算"
  | "工具"
  | "帮助"
  | "协作";

type CostingBudgetTab =
  | "工程概况"
  | "取费设置"
  | "分部分项"
  | "措施项目"
  | "其他项目"
  | "人材机汇总"
  | "费用汇总"
  | "质控检查"
  | "报表";

type CostingDetailTab =
  | "详细对比"
  | "工料机显示"
  | "单价构成"
  | "标准换算"
  | "换算信息"
  | "特征及内容"
  | "组价方案"
  | "工程量明细"
  | "反查图形工程量"
  | "说明信息";

type CostingAnalysisTab = "费用分析" | "清单分析" | "审核报告";

type CostingMergeCondition =
  | "nodeId"
  | "approvedCode"
  | "approvedName"
  | "approvedFeature"
  | "unit";

const costingMainNavItems: CostingMainNav[] = [
  "编制",
  "审核",
  "质控",
  "报表",
  "成本测算",
  "工具",
  "帮助",
  "协作",
];

const costingBudgetTabs: CostingBudgetTab[] = [
  "工程概况",
  "取费设置",
  "分部分项",
  "措施项目",
  "其他项目",
  "人材机汇总",
  "费用汇总",
];

const costingDetailTabs: CostingDetailTab[] = [
  "详细对比",
  "工料机显示",
  "单价构成",
  "标准换算",
  "换算信息",
  "特征及内容",
  "组价方案",
  "工程量明细",
  "反查图形工程量",
  "说明信息",
];

const costingAnalysisTabs: CostingAnalysisTab[] = [
  "费用分析",
  "清单分析",
  "审核报告",
];

const costingDefaultFilter: CostAnalysisFilters = {};

interface CostingFilterDraft {
  nameContains: string;
  featureContains: string;
  changeReasonContains: string;
  mark: CostChangeMark | "all";
  numericField: CostNumericField;
  numericOperator: CostNumericOperator;
  numericValue: string;
}

const costingDefaultFilterDraft: CostingFilterDraft = {
  nameContains: "",
  featureContains: "",
  changeReasonContains: "",
  mark: "all",
  numericField: "amountDelta",
  numericOperator: "abs_gte",
  numericValue: "10000",
};

type CostingEditableBoqField =
  | "approvedCode"
  | "approvedName"
  | "approvedFeature"
  | "approvedQty"
  | "approvedUnitPrice";

interface CostingEditCell {
  itemId: string;
  field: CostingEditableBoqField;
  value: string;
}

interface CostingContextMenuState {
  x: number;
  y: number;
  itemId: string;
}

type CostingContextAction =
  | "check"
  | "uncheck"
  | "batch_top50"
  | "export_excel"
  | "copy_cell"
  | "locate_project"
  | "clear_filter"
  | "merge_analysis"
  | "unmerge_analysis"
  | "edit_quantity"
  | "edit_price"
  | "convert_to_approved"
  | "convert_to_submitted"
  | "detail_compare"
  | "quantity_detail"
  | "mark_review"
  | "edit_reason"
  | "clear_reasons"
  | "clear_approved"
  | "report";

const costingEditableFieldLabels: Record<CostingEditableBoqField, string> = {
  approvedCode: "审定编码",
  approvedName: "审定名称",
  approvedFeature: "审定项目特征",
  approvedQty: "审定工程量",
  approvedUnitPrice: "审定综合单价",
};

function QuantityCostingControl({
  onAudit,
}: {
  onAudit: (summary: string) => void;
}) {
  const skipNextEditCommitRef = useRef(false);
  const [backendSnapshot, setBackendSnapshot] =
    useState<QuantityCostingSnapshotResponse | null>(null);
  const [backendRegistry, setBackendRegistry] =
    useState<CostingStandardRegistry | null>(null);
  const [registryState, setRegistryState] = useState("标准库读取中");
  const [registryImportState, setRegistryImportState] = useState("未导入");
  const [priceLoadPlan, setPriceLoadPlan] = useState<CostPriceLoadPlan | null>(
    null,
  );
  const [priceQuoteSourceName, setPriceQuoteSourceName] = useState("");
  const [priceSnapshots, setPriceSnapshots] = useState<
    QuantityCostingPriceSnapshot[]
  >([]);
  const quotaFileInputRef = useRef<HTMLInputElement | null>(null);
  const priceFileInputRef = useRef<HTMLInputElement | null>(null);
  const ifcFileInputRef = useRef<HTMLInputElement | null>(null);
  const [boqOverrides, setBoqOverrides] = useState<
    Record<string, QuantityCostingBoqItem>
  >({});
  const [measureOverrides, setMeasureOverrides] = useState<
    Record<string, CostMeasureItem>
  >({});
  const [otherOverrides, setOtherOverrides] = useState<
    Record<string, CostOtherItem>
  >({});
  const [feeRuleOverrides, setFeeRuleOverrides] = useState<
    Record<string, CostFeeRule>
  >({});
  const [activeMainNav, setActiveMainNav] = useState<CostingMainNav>("审核");
  const [activeBudgetTab, setActiveBudgetTab] =
    useState<CostingBudgetTab>("分部分项");
  const [activeDetailTab, setActiveDetailTab] =
    useState<CostingDetailTab>("工程量明细");
  // 分部分项核审表的列宽 / 行高(此前不可调,issue: 列宽行高无法调整)。
  const [costingColumnWidths, setCostingColumnWidths] = useState<
    Record<string, number>
  >(defaultColumnWidths);
  const [costingRowHeight, setCostingRowHeight] = useState<number>(
    COSTING_DEFAULT_ROW_HEIGHT,
  );
  const costingColResizeRef = useRef<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  // 可拖拽面板尺寸:左侧项目树宽度 / 底部明细面板高度(此前写死,无法调整)。
  const [costingTreeWidth, setCostingTreeWidth] = useState<number>(
    COSTING_TREE_WIDTH.default,
  );
  const [costingDetailHeight, setCostingDetailHeight] = useState<number>(
    COSTING_DETAIL_HEIGHT.default,
  );
  const [projectOverride, setProjectOverride] =
    useState<QuantityCostingProject | null>(null);
  // 自动保存：编辑后防抖持久化；newProjectDialog：从零新建空白工程
  const [autoSaveState, setAutoSaveState] = useState("未改动");
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: "",
    jurisdiction: "CN-SC",
    unitProjectName: "钢结构工程",
    specialty: "钢结构",
  });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const [addedBoqItems, setAddedBoqItems] = useState<QuantityCostingBoqItem[]>(
    [],
  );
  const [increaseEffective, setIncreaseEffective] = useState(true);
  const [hiddenRibbonActions, setHiddenRibbonActions] = useState<string[]>([]);
  const [importPlan, setImportPlan] = useState<CostProjectImportPlan | null>(
    null,
  );
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] =
    useState<CostingAnalysisTab>("清单分析");
  const [analysisFilters, setAnalysisFilters] =
    useState<CostAnalysisFilters>(costingDefaultFilter);
  const [analysisFilterDraft, setAnalysisFilterDraft] =
    useState<CostingFilterDraft>(costingDefaultFilterDraft);
  const [analysisMergeEnabled, setAnalysisMergeEnabled] = useState(false);
  const [analysisMergeConditions, setAnalysisMergeConditions] = useState<
    CostingMergeCondition[]
  >(["nodeId", "approvedCode"]);
  const [analysisExpandLevel, setAnalysisExpandLevel] =
    useState<CostAnalysisExpandLevel>("unit_project");
  const [analysisDirty, setAnalysisDirty] = useState(false);
  const [reportMetadata, setReportMetadata] =
    useState<CostReviewReportMetadata>(quantityCostingDefaultReportMetadata);
  const [reportPreview, setReportPreview] =
    useState<CostReviewReportPreview | null>(null);
  const [reportTasks, setReportTasks] = useState<CostReportTask[]>([]);
  const [reportScheme, setReportScheme] = useState<CostReportScheme>(
    quantityCostingSystemReportScheme,
  );
  const [reportSchemeState, setReportSchemeState] = useState("系统方案");
  const [reportDesign, setReportDesign] = useState<CostReportSimpleDesign>(() =>
    createDefaultReportDesign(),
  );
  const [showSimpleDesign, setShowSimpleDesign] = useState(false);
  const [reportTempEditState, setReportTempEditState] = useState("未编辑");
  const [approvalRecord, setApprovalRecord] =
    useState<CostApprovalRecord | null>(null);
  const [reportOutputState, setReportOutputState] =
    useState<CostReportOutputState>("professional_review_required");
  const [approvalMessage, setApprovalMessage] = useState("未发起审批");
  const [voucherHandoffState, setVoucherHandoffState] = useState("未移交");
  const [reportEditMode, setReportEditMode] = useState(false);
  const [reportZoom, setReportZoom] = useState(100);
  const [budgetConversionState, setBudgetConversionState] = useState("未转换");
  const [assistantVisible, setAssistantVisible] = useState(true);
  const [approvedExpressionDrafts, setApprovedExpressionDrafts] = useState<
    Record<string, string>
  >({});
  const sourceCostProject = backendSnapshot
    ? quantitySnapshotToProject(backendSnapshot)
    : quantityCostingPhase1Project;
  const structureProject =
    projectOverride && projectOverride.projectId === sourceCostProject.projectId
      ? projectOverride
      : sourceCostProject;
  const activeCostProject: QuantityCostingProject = {
    ...structureProject,
    boqItems: [
      ...sourceCostProject.boqItems.map(
        (item) => boqOverrides[item.itemId] ?? item,
      ),
      // 手工/IFC 新增的清单行（不在持久化源里，叠加在末尾）
      ...addedBoqItems.map((item) => boqOverrides[item.itemId] ?? item),
    ],
  };
  const dashboard = calculateCostingDashboard(
    activeCostProject,
    increaseEffective,
  );
  const reportDesignPreview = buildReportDesignPreview(reportDesign, {
    projectName: activeCostProject.projectName,
    unitProjectName:
      activeCostProject.treeNodes.find(
        (node) => node.nodeId === activeCostProject.currentNodeId,
      )?.name ?? activeCostProject.projectName,
    reviewer: reportMetadata.reviewer,
    date: new Date().toISOString().slice(0, 10),
    pageNumber: reportScheme.exportSettings.startPage,
    totalPages:
      reportScheme.exportSettings.totalPages ?? reportScheme.reportNames.length,
  });
  const visibleReportColumnIds = new Set(
    reportDesign.columns
      .filter((column) => column.visible)
      .map((column) => column.columnId),
  );
  const activeRegistry =
    backendRegistry && backendRegistry.quotaItems.length > 0
      ? backendRegistry
      : quantityCostingPhase2Registry;
  const quotaBreakdown = calculateQuotaUnitPrice(
    activeRegistry,
    activeRegistry.quotaItems[0]?.quotaItemId ?? "quota-steel-member-demo",
  );
  const sourceMeasureItems = quantitySnapshotMeasureItems(backendSnapshot).map(
    (item) => measureOverrides[item.itemId] ?? item,
  );
  const sourceOtherItems = quantitySnapshotOtherItems(backendSnapshot).map(
    (item) => otherOverrides[item.itemId] ?? item,
  );
  const sourceFeeRules = quantitySnapshotFeeRules(backendSnapshot).map(
    (rule) => feeRuleOverrides[rule.feeId] ?? rule,
  );
  const measureItems = sourceMeasureItems.map((item) =>
    calculateMeasureItem(item),
  );
  const otherItems = sourceOtherItems.map((item) => calculateOtherItem(item));
  const feeSummary = sourceFeeRules.map((rule) =>
    calculateFeeSummaryItem(rule),
  );
  const phase2ReviewCount = [
    quotaBreakdown,
    ...measureItems,
    ...otherItems,
    ...feeSummary,
  ].filter((item) => item.sourceReviewRequired).length;
  const [reviewVersions, setReviewVersions] = useState(
    activeCostProject.versions,
  );
  const activeReviewVersions = backendSnapshot
    ? activeCostProject.versions
    : reviewVersions;
  const [selectedItemId, setSelectedItemId] = useState(
    dashboard.computedItems[1]?.itemId ?? "",
  );
  const [editingCell, setEditingCell] = useState<CostingEditCell | null>(null);
  const [contextMenu, setContextMenu] =
    useState<CostingContextMenuState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(
    activeCostProject.currentNodeId,
  );
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<string[]>([]);
  const [conversionState, setConversionState] = useState("未执行");
  const [reportState, setReportState] = useState("待生成");
  const [backendOverview, setBackendOverview] =
    useState<QuantityCostingOverview | null>(null);
  const [backendState, setBackendState] = useState("读取中");
  const scopedNodeIds = collectCostingNodeScope(
    activeCostProject.treeNodes,
    selectedNodeId,
  );
  const scopedItems = dashboard.computedItems.filter((item) =>
    scopedNodeIds.has(item.nodeId),
  );
  const visibleItems =
    scopedItems.length > 0 ? scopedItems : dashboard.computedItems;
  const analysisItems = filterCostAnalysisItems(visibleItems, analysisFilters);
  const activeAnalysisFilter = hasActiveCostAnalysisFilters(analysisFilters);
  const analysisSummaryRows = summarizeCostAnalysisByLevel(
    activeCostProject,
    analysisItems,
    analysisExpandLevel,
  );
  const mergedAnalysisGroups = analysisMergeEnabled
    ? mergeCostAnalysisItems(analysisItems, analysisMergeConditions)
    : [];
  const visibleSummary = summarizeVisibleCostItems(visibleItems);
  const selectedItem =
    dashboard.computedItems.find((item) => item.itemId === selectedItemId) ??
    visibleItems[0] ??
    dashboard.computedItems[0];
  const resourceComparisonRows = buildCostResourceComparisonRows(
    quotaBreakdown,
    selectedItem ?? null,
  );
  const quantityExpressionDetails = selectedItem
    ? buildCostQuantityExpressionDetails(selectedItem)
    : [];
  const buildingAreaVariable: CostExpressionVariable = {
    code: "JZMJ",
    name: "建筑面积",
    unit: "m2",
    value: activeCostProject.treeNodes.length * 1000,
  };
  function buildItemExpressionVariables(
    item: ComputedCostBoqItem | QuantityCostingBoqItem,
  ): CostExpressionVariable[] {
    return [
      buildingAreaVariable,
      {
        code: "SSL",
        name: "送审工程量",
        unit: item.unit,
        value: roundQuantity(item.submittedQty),
      },
    ];
  }
  const ruleCheckReport = runCostingRuleChecks(
    dashboard,
    activeRegistry,
    {
      expressionInputs: Object.entries(approvedExpressionDrafts)
        .filter(([, expression]) => expression.trim() !== "")
        .map(([itemId, approvedExpression]) => {
          const item = dashboard.computedItems.find(
            (candidate) => candidate.itemId === itemId,
          );
          return {
            itemId,
            approvedExpression,
            variables: item ? buildItemExpressionVariables(item) : [],
          };
        }),
      variables: [buildingAreaVariable],
    },
  );
  const voucherPlan = buildCostVoucherPlan({
    dashboard,
    measureItems,
    otherItems,
    feeSummaryItems: feeSummary,
    reviewVersionId:
      [...activeReviewVersions]
        .reverse()
        .find((version) => version.versionType === "review")?.versionId ??
      "review-current",
  });
  const reviewRoundCount = activeReviewVersions.filter(
    (version) => version.versionType === "review",
  ).length;
  const persistedSubmittedTotal =
    (backendOverview?.boqSubmittedTotal ?? 0) +
    (backendOverview?.measureSubmittedTotal ?? 0) +
    (backendOverview?.otherSubmittedTotal ?? 0) +
    (backendOverview?.feeSubmittedTotal ?? 0);
  const persistedApprovedTotal =
    (backendOverview?.boqApprovedTotal ?? 0) +
    (backendOverview?.measureApprovedTotal ?? 0) +
    (backendOverview?.otherApprovedTotal ?? 0) +
    (backendOverview?.feeApprovedTotal ?? 0);
  const increaseStrategyPreview = calculateIncreaseDecreaseByStrategy({
    strategyType: "code",
    label: "当前范围核增核减",
    submittedAmount: visibleSummary.submittedTotal,
    approvedAmount: visibleSummary.approvedTotal,
    relatedIncreaseAmount: visibleSummary.increaseAmount,
  });
  const costingPanelStyle = {
    "--gccp-blue": "var(--arch-primary)",
    "--gccp-blue-strong": "var(--arch-primary)",
    "--gccp-on-accent": "var(--module-accent-foreground)",
    height: "100%",
    minHeight: 0,
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;
    const projectId = getBackendRequestContext().projectId;

    Promise.all([
      api.quantityCosting.overview(projectId),
      api.quantityCosting.latestSnapshot(projectId),
    ])
      .then(([overview, snapshot]) => {
        if (cancelled) return;
        setBackendOverview(overview);
        setBackendSnapshot(snapshot);
        setBackendState(
          snapshot
            ? "已接通 · 已反显"
            : overview.costProjectCount > 0
              ? "已接通"
              : "已接通 · 待导入",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setBackendState("未连接 · 使用样例");
      });

    loadBackendRegistry().catch(() => {
      if (cancelled) return;
      setRegistryState("未连接 · 使用样例");
    });
    void loadPriceSnapshots();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveWorkbenchSnapshot() {
    const projectId = getBackendRequestContext().projectId;
    const reviewRound = Math.max(1, reviewRoundCount);
    const payload: QuantityCostingSnapshotPayload = {
      costingProjectKey: activeCostProject.projectId,
      name: activeCostProject.projectName,
      jurisdiction: activeCostProject.jurisdiction,
      standardProfileId: activeCostProject.standardProfileId,
      quotaLibraryId: activeCostProject.quotaLibraryId,
      reviewKey: `review-${reviewRound}`,
      reviewRound,
      reviewDescription: `第${reviewRound}审 · 工作台快照`,
      treeNodes: activeCostProject.treeNodes.map((node) => ({
        nodeId: node.nodeId,
        parentId: node.parentId,
        nodeType: node.nodeType,
        name: node.name,
        specialty: node.specialty,
        sortOrder: node.sortOrder,
        standardProfileId: node.standardProfileId,
        quotaLibraryId: node.quotaLibraryId,
        auditState: node.auditState,
      })),
      boqItems: dashboard.computedItems.map((item) => ({
        itemId: item.itemId,
        nodeId: item.nodeId,
        submittedCode: item.submittedCode,
        approvedCode: item.approvedCode,
        submittedName: item.submittedName,
        approvedName: item.approvedName,
        submittedFeature: item.submittedFeature,
        approvedFeature: item.approvedFeature,
        unit: item.unit,
        submittedQty: item.submittedQty,
        approvedQty: item.approvedQty,
        qtyDelta: item.qtyDelta,
        submittedUnitPrice: item.submittedUnitPrice,
        approvedUnitPrice: item.approvedUnitPrice,
        submittedTotal: item.submittedTotal,
        approvedTotal: item.approvedTotal,
        amountDelta: item.amountDelta,
        increaseAmount: item.increaseAmount,
        decreaseAmount: item.decreaseAmount,
        changeMark: item.changeMark,
        changeReason: item.changeReason,
        sourceRef: item.sourceRef,
        ruleId: item.ruleId,
        elementId: item.elementId ?? null,
        sourceReviewRequired: item.sourceReviewRequired,
      })),
      measureItems: measureItems.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        measureType: item.measureType,
        submittedBaseAmount: item.submittedBaseAmount,
        approvedBaseAmount: item.approvedBaseAmount,
        submittedRate: item.submittedRate,
        approvedRate: item.approvedRate,
        submittedAmount: item.submittedAmount,
        approvedAmount: item.approvedAmount,
        amountDelta: item.amountDelta,
        changeMark: item.changeMark,
        sourceRuleId: item.sourceRuleId,
        sourceRef: item.sourceRef,
        sourceReviewRequired: item.sourceReviewRequired,
      })),
      otherItems: otherItems.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        otherType: item.otherType,
        submittedAmount: item.submittedAmount,
        approvedAmount: item.approvedAmount,
        amountDelta: item.amountDelta,
        changeMark: item.changeMark,
        sourceRuleId: item.sourceRuleId,
        sourceRef: item.sourceRef,
        sourceReviewRequired: item.sourceReviewRequired,
      })),
      feeSummaryItems: feeSummary.map((item) => ({
        feeId: item.feeId,
        name: item.name,
        submittedBaseAmount: item.submittedBaseAmount,
        approvedBaseAmount: item.approvedBaseAmount,
        submittedRate: item.submittedRate,
        approvedRate: item.approvedRate,
        submittedAmount: item.submittedAmount,
        approvedAmount: item.approvedAmount,
        amountDelta: item.amountDelta,
        changeMark: item.changeMark,
        sourceRuleId: item.sourceRuleId,
        sourceRef: item.sourceRef,
        sourceReviewRequired: item.sourceReviewRequired,
      })),
    };

    setBackendState("保存中");
    setAutoSaveState("保存中…");
    try {
      const saved = await api.quantityCosting.saveSnapshot(projectId, payload);
      const [overview, snapshot] = await Promise.all([
        api.quantityCosting.overview(projectId),
        api.quantityCosting.latestSnapshot(projectId),
      ]);
      setBackendOverview(overview);
      setBackendSnapshot(snapshot);
      setBackendState(snapshot ? "已保存 · 已反显" : "已保存");
      dirtyRef.current = false;
      setAutoSaveState(`已保存 ${new Date().toLocaleTimeString("zh-CN")}`);
      onAudit(
        `计量造价: 保存编审快照 清单${saved.boqItemCount}项 措施${saved.measureItemCount}项`,
      );
    } catch {
      setBackendState("保存失败 · 使用样例");
      setAutoSaveState("保存失败 · 改动仅在本地");
      onAudit("计量造价: 保存编审快照失败,继续使用前端样例");
    }
  }

  // 编辑后防抖自动保存：任何 override / 项目结构变更后 1.2s 自动持久化。
  // 样例工程（未接通后端或未新建真实工程）不自动保存，避免污染。
  const overrideSignature = JSON.stringify({
    boq: boqOverrides,
    measure: measureOverrides,
    other: otherOverrides,
    fee: feeRuleOverrides,
    added: addedBoqItems,
    project: projectOverride?.treeNodes.map((n) => n.nodeId) ?? null,
  });
  useEffect(() => {
    if (!backendSnapshot) {
      // 仍是样例数据，不触发自动保存
      return;
    }
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      return;
    }
    setAutoSaveState("有改动 · 待自动保存");
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void saveWorkbenchSnapshot();
    }, 1200);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // saveWorkbenchSnapshot 读取最新闭包，依赖签名触发即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideSignature]);

  function ribbonActionVisible(actionId: string): boolean {
    return !hiddenRibbonActions.includes(actionId);
  }

  function toggleRibbonAction(actionId: string) {
    setHiddenRibbonActions((current) =>
      current.includes(actionId)
        ? current.filter((id) => id !== actionId)
        : [...current, actionId],
    );
    onAudit(`计量造价: 工具栏自定义 ${actionId}`);
  }

  async function createBlankProject() {
    const name = newProjectForm.name.trim();
    if (name === "") {
      setAutoSaveState("工程名称不能为空");
      return;
    }
    const projectId = getBackendRequestContext().projectId;
    const projectKey = `qc-${Date.now()}`;
    const blankPayload: QuantityCostingSnapshotPayload = {
      costingProjectKey: projectKey,
      name,
      jurisdiction: newProjectForm.jurisdiction,
      standardProfileId: "GB/T50500-2024",
      quotaLibraryId: "SC-local-quota-placeholder",
      reviewKey: "review-1",
      reviewRound: 1,
      reviewDescription: "第1审 · 新建工程",
      treeNodes: [
        {
          nodeId: "node-root",
          parentId: null,
          nodeType: "project",
          name,
          specialty: "",
          sortOrder: 1,
          standardProfileId: "GB/T50500-2024",
          quotaLibraryId: "SC-local-quota-placeholder",
          auditState: "reviewing",
        },
        {
          nodeId: "node-unit-1",
          parentId: "node-root",
          nodeType: "unit_project",
          name: newProjectForm.unitProjectName.trim() || "单位工程",
          specialty: newProjectForm.specialty.trim(),
          sortOrder: 2,
          standardProfileId: "GB/T50500-2024",
          quotaLibraryId: "SC-local-quota-placeholder",
          auditState: "reviewing",
        },
      ],
      boqItems: [],
      measureItems: [],
      otherItems: [],
      feeSummaryItems: [],
    };
    setBackendState("新建工程中");
    try {
      await api.quantityCosting.saveSnapshot(projectId, blankPayload);
      const [overview, snapshot] = await Promise.all([
        api.quantityCosting.overview(projectId),
        api.quantityCosting.latestSnapshot(projectId),
      ]);
      // 清空所有本地 override，从空白工程开始
      setBoqOverrides({});
      setMeasureOverrides({});
      setOtherOverrides({});
      setFeeRuleOverrides({});
      setAddedBoqItems([]);
      setProjectOverride(null);
      setBackendOverview(overview);
      setBackendSnapshot(snapshot);
      setBackendState("已新建 · 已反显");
      dirtyRef.current = false;
      setAutoSaveState("空白工程已创建");
      setNewProjectDialogOpen(false);
      setActiveMainNav("编制");
      setActiveBudgetTab("分部分项");
      onAudit(`计量造价: 新建空白工程 ${name}`);
    } catch {
      setBackendState("新建工程失败 · 数据服务未连接");
      setAutoSaveState("新建失败");
    }
  }

  function addBoqRow() {
    const nodeId =
      selectedNodeId ||
      activeCostProject.treeNodes.find((n) => n.nodeType === "unit_project")
        ?.nodeId ||
      activeCostProject.currentNodeId;
    const newItem: QuantityCostingBoqItem = {
      itemId: `boq-new-${Date.now()}`,
      projectId: activeCostProject.projectId,
      nodeId,
      submittedCode: "",
      approvedCode: "",
      submittedName: "新增清单项",
      approvedName: "新增清单项",
      submittedFeature: "",
      approvedFeature: "",
      unit: "m3",
      submittedQty: 0,
      approvedQty: 0,
      submittedUnitPrice: 0,
      approvedUnitPrice: 0,
      sourceRef: "",
      ruleId: "",
    };
    setAddedBoqItems((current) => [...current, newItem]);
    setSelectedItemId(newItem.itemId);
    setAnalysisDirty(true);
    setActiveBudgetTab("分部分项");
    setAutoSaveState("有改动 · 待自动保存");
    dirtyRef.current = true;
    onAudit("计量造价: 新增清单行（双击单元格编辑编码/名称/量价）");
  }

  async function handleIfcTakeoffFile(file: File) {
    const nodeId =
      selectedNodeId ||
      activeCostProject.treeNodes.find((n) => n.nodeType === "unit_project")
        ?.nodeId ||
      activeCostProject.currentNodeId;
    setRegistryImportState(`IFC 几何实测中…（${file.name}）`);
    try {
      // 1. 上传 IFC 到本地文件运行时
      const form = new FormData();
      form.append("file", file);
      form.append("moduleId", "quantity_costing");
      const uploadResp = await fetch("/api/local-files/upload", {
        method: "POST",
        body: form,
      });
      if (!uploadResp.ok) {
        throw new Error("upload failed");
      }
      const uploaded = (await uploadResp.json()) as {
        file: { fileId: string; originalName: string };
      };
      // 2. 几何实测提取 BOM manifest（panaec-ifc-to-bom）
      const bomResp = await fetch(
        `/api/local-files/${encodeURIComponent(uploaded.file.fileId)}/bom-export?format=manifest`,
      );
      if (!bomResp.ok) {
        const err = (await bomResp.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "IFC BOM 提取失败");
      }
      const manifest = (await bomResp.json()) as IfcTakeoffManifest;
      // 3. 取 SJG 157-2024 钢结构小类字典（真实标准数据），按构件类别匹配编码
      let semanticCategories: Array<{
        code: string;
        nameZh: string;
        ifcEntity: string | null;
        levelName: string;
      }> = [];
      try {
        const sjg = await api.quantityCosting.semanticCategories({
          ifcEntities: [...new Set(manifest.lines.map((l) => l.ifcClass))],
          codePrefix: "30-03.95",
        });
        semanticCategories = sjg.categories.map((c) => ({
          code: c.code,
          nameZh: c.nameZh,
          ifcEntity: c.ifcEntity,
          levelName: c.levelName,
        }));
      } catch {
        // SJG157 字典不可达时编码留空，仍输出真实工程量
      }
      // 4. 映射为清单项：SJG157 精确匹配则填字典编码，否则留空待人工
      const result = mapIfcManifestToBoqItems(manifest, {
        projectId: activeCostProject.projectId,
        nodeId,
        sourceFileName: uploaded.file.originalName,
        semanticCategories: semanticCategories.filter(
          (c) => c.levelName === "小类",
        ),
      });
      if (result.boqItems.length === 0) {
        setRegistryImportState("IFC 未提取到可计量构件");
        return;
      }
      setAddedBoqItems((current) => [...current, ...result.boqItems]);
      setSelectedItemId(result.boqItems[0]!.itemId);
      setActiveMainNav("编制");
      setActiveBudgetTab("分部分项");
      dirtyRef.current = true;
      setAutoSaveState("有改动 · 待自动保存");
      setRegistryImportState(
        `IFC 反查完成：${result.mappedClassCount} 清单项 · 合计 ${result.totalWeightTon}t` +
          ` · SJG157 匹配 ${result.sjg157MatchedCount} 项` +
          (result.reviewRequiredCount > 0
            ? ` · ${result.reviewRequiredCount} 项待套码/复核`
            : ""),
      );
      onAudit(
        `计量造价: IFC 反查工程量 ${uploaded.file.originalName} → ${result.mappedClassCount} 清单项 ${result.totalWeightTon}t`,
      );
    } catch (error) {
      setRegistryImportState(
        `IFC 反查失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  function createReview() {
    const next = createNextReviewVersion(
      { ...activeCostProject, versions: activeReviewVersions },
      `第${reviewRoundCount + 1}审`,
    );
    setReviewVersions((current) => [...current, next]);
    setProjectOverride((current) => ({
      ...(current ?? activeCostProject),
      versions: [...activeReviewVersions, next],
    }));
    setAnalysisDirty(true);
    setActiveMainNav("审核");
    setActiveBudgetTab("分部分项");
    onAudit(`计量造价: 新建审核版本 ${next.description}`);
  }

  function importApproved() {
    const plan = buildCostProjectImportPlan(
      activeCostProject.treeNodes,
      quantityCostingImportedReviewNodes,
      ["name", "specialty", "standardProfile", "quotaLibrary"],
      "review_gbq7",
    );
    setImportPlan(plan);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("清单分析");
    setActiveMainNav("审核");
    setActiveBudgetTab("分部分项");
    setConversionState(
      `已生成导入匹配计划 · 自动匹配 ${plan.autoMatchedCount} · 待确认 ${plan.manualRequiredCount}`,
    );
    onAudit("计量造价: 导入审定生成工程结构匹配计划");
  }

  function confirmImportApproved() {
    const plan =
      importPlan ??
      buildCostProjectImportPlan(
        activeCostProject.treeNodes,
        quantityCostingImportedReviewNodes,
        ["name", "specialty", "standardProfile", "quotaLibrary"],
        "review_gbq7",
      );
    const merged = applyCostProjectImportPlan(
      activeCostProject,
      quantityCostingImportedReviewNodes,
      plan,
    );
    setProjectOverride(merged);
    setImportPlan(plan);
    setAnalysisDirty(true);
    setConversionState(
      `导入审定完成 · 自动匹配 ${plan.autoMatchedCount} · 新增/待手动 ${plan.manualRequiredCount}`,
    );
    onAudit("计量造价: 确认导入审定并更新项目结构树");
  }

  function mergeAuditProject() {
    const plan = buildCostProjectImportPlan(
      activeCostProject.treeNodes,
      quantityCostingImportedReviewNodes,
      ["name", "specialty"],
      "review_gbq7",
    );
    setProjectOverride(
      applyCostProjectImportPlan(
        activeCostProject,
        quantityCostingImportedReviewNodes,
        plan,
      ),
    );
    setImportPlan(plan);
    setAnalysisDirty(true);
    setConversionState("文件合并完成 · 添加/匹配导入单位工程");
    onAudit("计量造价: 项目结构树执行文件合并");
  }

  function deleteSelectedProjectNode() {
    setProjectOverride((current) =>
      markCostProjectNodeDeleted(current ?? activeCostProject, selectedNodeId),
    );
    setAnalysisDirty(true);
    setConversionState("当前单位工程已软删除并保留审计痕迹");
    onAudit("计量造价: 项目结构树删除单位工程");
  }

  function batchDeleteUnitProjects() {
    const unitNodeIds = activeCostProject.treeNodes
      .filter(
        (node) =>
          node.nodeType === "unit_project" &&
          node.auditState !== "archived" &&
          node.nodeId !== selectedNodeId,
      )
      .map((node) => node.nodeId);
    if (unitNodeIds.length === 0) {
      setConversionState("无可批量删除的非当前单位工程。");
      return;
    }
    setProjectOverride((current) =>
      markCostProjectNodesDeleted(current ?? activeCostProject, unitNodeIds),
    );
    setAnalysisDirty(true);
    setConversionState(`已批量软删除 ${unitNodeIds.length} 个单位工程`);
    onAudit("计量造价: 项目结构树批量删除单位工程");
  }

  function copySelectedProjectNode() {
    const targetParentId =
      activeCostProject.treeNodes.find((node) => node.nodeId === selectedNodeId)
        ?.parentId ?? activeCostProject.currentNodeId;
    const copied = copyCostProjectNode(
      activeCostProject,
      selectedNodeId,
      targetParentId,
    );
    setProjectOverride(copied);
    setAnalysisDirty(true);
    setConversionState("当前单位工程已复制到目标单项工程");
    onAudit("计量造价: 项目结构树复制到目标单项工程");
  }

  function switchSubmittedVersion() {
    const currentReview = activeReviewVersions
      .filter((version) => version.versionType === "review")
      .at(-1);
    const submitted =
      activeReviewVersions.find((version) => version.versionType !== "review")
        ?.versionId ?? "budget-v1";
    if (!currentReview) {
      setConversionState("未找到当前审核版本,切换送审未执行。");
      return;
    }
    const switched = switchSubmittedReviewVersion(
      { ...activeCostProject, versions: activeReviewVersions },
      currentReview.versionId,
      submitted,
    );
    setReviewVersions(switched.versions);
    setProjectOverride(switched);
    setConversionState(
      `${currentReview.description}: 已切换送审为 ${submitted}`,
    );
    onAudit("计量造价: 切换过程版本为送审版本");
  }

  function deletePreviousReview() {
    const previousReview = activeReviewVersions
      .filter((version) => version.versionType === "review")
      .at(-2);
    if (!previousReview) {
      setConversionState("无非当前审核版本可删除。");
      return;
    }
    const result = deleteReviewVersion(
      { ...activeCostProject, versions: activeReviewVersions },
      previousReview.versionId,
    );
    if (result.blockedReason) {
      setConversionState(result.blockedReason);
      onAudit(`计量造价: 删除审核版本被阻止 · ${result.blockedReason}`);
      return;
    }
    setReviewVersions(result.project.versions);
    setProjectOverride(result.project);
    setConversionState(`${previousReview.description}: 已删除审核版本`);
    onAudit("计量造价: 删除非当前审核版本");
  }

  function convertSelected() {
    convertCurrentTabData("submitted_to_approved");
  }

  function convertCurrentTabData(
    direction: "submitted_to_approved" | "approved_to_submitted",
  ) {
    const directionLabel =
      direction === "submitted_to_approved" ? "送审同步到审定" : "审定回写送审";

    if (activeBudgetTab === "措施项目") {
      const converted = sourceMeasureItems.map((item) =>
        convertMeasureItemData(item, direction),
      );
      setMeasureOverrides((current) => ({
        ...current,
        ...Object.fromEntries(
          converted.map((result) => [result.item.itemId, result.item]),
        ),
      }));
      setAnalysisDirty(true);
      setActiveDetailTab("换算信息");
      setConversionState(`措施项目 ${converted.length} 项已${directionLabel}`);
      onAudit(`计量造价: 措施项目批量${directionLabel}`);
      return;
    }

    if (activeBudgetTab === "其他项目") {
      const converted = sourceOtherItems.map((item) =>
        convertOtherItemData(item, direction),
      );
      setOtherOverrides((current) => ({
        ...current,
        ...Object.fromEntries(
          converted.map((result) => [result.item.itemId, result.item]),
        ),
      }));
      setAnalysisDirty(true);
      setActiveDetailTab("换算信息");
      setConversionState(`其他项目 ${converted.length} 项已${directionLabel}`);
      onAudit(`计量造价: 其他项目批量${directionLabel}`);
      return;
    }

    if (activeBudgetTab === "费用汇总" || activeBudgetTab === "取费设置") {
      const converted = sourceFeeRules.map((rule) =>
        convertFeeRuleData(rule, direction),
      );
      setFeeRuleOverrides((current) => ({
        ...current,
        ...Object.fromEntries(
          converted.map((result) => [result.rule.feeId, result.rule]),
        ),
      }));
      setAnalysisDirty(true);
      setActiveDetailTab("换算信息");
      setConversionState(`费用规则 ${converted.length} 项已${directionLabel}`);
      onAudit(`计量造价: 费用汇总批量${directionLabel}`);
      return;
    }

    if (!selectedItem) {
      return;
    }
    const result = convertBoqItemData(selectedItem, direction);
    if (result.blockedReason) {
      setConversionState(result.blockedReason);
      onAudit(`计量造价: 数据转换被阻止 · ${result.blockedReason}`);
      return;
    }
    setBoqOverrides((current) => ({
      ...current,
      [selectedItem.itemId]: result.item,
    }));
    setAnalysisDirty(true);
    setActiveBudgetTab("分部分项");
    setActiveDetailTab("换算信息");
    setConversionState(`${selectedItem.displayName}: 已${directionLabel}`);
    onAudit(`计量造价: ${selectedItem.displayName} 执行${directionLabel}`);
  }

  function selectTopAnalysisRows() {
    const ids = selectCostItemsByDeltaShare(analysisItems, 50);
    setSelectedAnalysisIds(ids);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("清单分析");
    setActiveMainNav("审核");
    setActiveBudgetTab("分部分项");
    setActiveDetailTab("详细对比");
    onAudit(`计量造价: 清单分析按增减金额占比前50%勾选 ${ids.length} 项`);
  }

  function selectAnalysisByRule(
    mode: "top_delta_share" | "delta_rank" | "absolute_delta",
  ) {
    const value =
      mode === "top_delta_share" ? 50 : mode === "delta_rank" ? 3 : 10000;
    const ids = selectCostAnalysisItemsByRule(analysisItems, { mode, value });
    setSelectedAnalysisIds(ids);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("清单分析");
    onAudit(`计量造价: 清单分析批量勾选 ${ids.length} 项`);
  }

  function applyAnalysisFilterPreset() {
    setAnalysisFilterDraft({
      ...costingDefaultFilterDraft,
      mark: "modify",
      numericValue: "10000",
    });
    setAnalysisFilters({
      mark: "modify",
      numeric: [{ field: "amountDelta", operator: "abs_gte", value: 10000 }],
    });
    setAnalysisMergeEnabled(false);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("清单分析");
    onAudit("计量造价: 清单分析应用过滤条件");
  }

  function applyAnalysisFilterDraft() {
    const numericValue = Number(
      analysisFilterDraft.numericValue.replace(/,/g, ""),
    );
    const nextFilters: CostAnalysisFilters = {
      ...(analysisFilterDraft.nameContains.trim()
        ? { nameContains: analysisFilterDraft.nameContains.trim() }
        : {}),
      ...(analysisFilterDraft.featureContains.trim()
        ? { featureContains: analysisFilterDraft.featureContains.trim() }
        : {}),
      ...(analysisFilterDraft.changeReasonContains.trim()
        ? {
            changeReasonContains:
              analysisFilterDraft.changeReasonContains.trim(),
          }
        : {}),
      ...(analysisFilterDraft.mark !== "all"
        ? { mark: analysisFilterDraft.mark }
        : {}),
      ...(Number.isFinite(numericValue)
        ? {
            numeric: [
              {
                field: analysisFilterDraft.numericField,
                operator: analysisFilterDraft.numericOperator,
                value: numericValue,
              },
            ],
          }
        : {}),
    };
    setAnalysisFilters(nextFilters);
    setAnalysisMergeEnabled(false);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("清单分析");
    onAudit("计量造价: 清单分析应用自定义过滤条件");
  }

  function clearAnalysisFilters() {
    setAnalysisFilters(costingDefaultFilter);
    setAnalysisFilterDraft(costingDefaultFilterDraft);
    setConversionState("清单分析过滤已取消");
    onAudit("计量造价: 清单分析取消过滤");
  }

  function rerunAnalysis() {
    setAnalysisDirty(false);
    setAnalysisPanelOpen(true);
    setConversionState(
      `重新分析完成 · 当前范围 ${analysisItems.length} 项 · ${analysisSummaryRows.length} 行`,
    );
    onAudit("计量造价: 分析与报告重新分析");
  }

  function toggleAnalysisMerge() {
    const validation = validateCostAnalysisMerge(analysisFilters);
    if (!analysisMergeEnabled && !validation.allowed) {
      setConversionState(
        validation.blockedReason ?? "当前状态不支持合并分析。",
      );
      onAudit("计量造价: 过滤状态阻止合并分析");
      return;
    }
    setAnalysisMergeEnabled((current) => !current);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("清单分析");
    onAudit(
      analysisMergeEnabled
        ? "计量造价: 取消合并分析"
        : "计量造价: 执行合并分析",
    );
  }

  function editSelectedChangeReason(item = selectedItem) {
    if (!item) {
      return;
    }
    const nextReason = `${item.autoChangeReason} 专业复核意见待补充。`;
    updateBoqItem(
      item.itemId,
      (current) => setBoqItemChangeReason(current, nextReason),
      `${item.displayName}: 增减说明已转为手工维护`,
    );
    setActiveDetailTab("说明信息");
  }

  function clearVisibleChangeReasons() {
    const nextOverrides = visibleItems.reduce<
      Record<string, QuantityCostingBoqItem>
    >((acc, item) => {
      acc[item.itemId] = setBoqItemChangeReason(item, "");
      return acc;
    }, {});
    setBoqOverrides((current) => ({ ...current, ...nextOverrides }));
    setAnalysisDirty(true);
    setConversionState(`已清空当前范围 ${visibleItems.length} 项自动增减说明`);
    onAudit("计量造价: 批量删除自动增减说明");
  }

  function generateReport() {
    const ids =
      selectedAnalysisIds.length > 0
        ? selectedAnalysisIds
        : selectCostItemsByDeltaShare(analysisItems, 50);
    const report = generateReviewReportSnapshot(activeCostProject, ids);
    const preview = buildReviewReportPreview(activeCostProject, ids, {
      ...reportMetadata,
      projectName: activeCostProject.projectName,
    });
    setSelectedAnalysisIds(ids);
    setReportPreview(preview);
    setAnalysisPanelOpen(true);
    setActiveAnalysisTab("审核报告");
    setActiveMainNav("报表");
    setActiveBudgetTab("报表");
    setReportState(
      `${report.selectedCount} 项 · 增减 ${formatMoney(report.amountDelta)} · 待专业复核`,
    );
    onAudit(`计量造价: 生成审核报告草稿,状态 ${report.outputState}`);
  }

  function buildReportExportData() {
    return buildCostReportExportWorkbook({
      scheme: reportScheme,
      design: reportDesign,
      dashboard,
      measureItems,
      otherItems,
      feeSummaryItems: feeSummary,
      metadata: reportMetadata,
      approval: approvalRecord,
      reportOutputStateLabel: costReportOutputStateLabels[reportOutputState],
      exportDate: new Date().toISOString().slice(0, 10),
    });
  }

  async function downloadReportArtifact(format: "excel" | "word") {
    const data = buildReportExportData();
    const fileName =
      format === "word"
        ? data.fileName.replace(/\.xlsx$/, ".doc")
        : data.fileName;
    const summaryText = `${data.sheets.length} 张工作表 · ${fileName}`;
    const canDownload =
      typeof window !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function";
    if (!canDownload) {
      setReportState(`已生成 ${summaryText} · 当前环境不支持自动下载`);
      return;
    }
    try {
      if (format === "excel") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        for (const sheet of data.sheets) {
          XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet(sheet.rows),
            sheet.name,
          );
        }
        XLSX.writeFile(workbook, fileName);
      } else {
        const html = buildCostReportWordHtml(data);
        const blob = new Blob(["﻿", html], {
          type: "application/msword",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      setReportState(`已导出 ${summaryText}`);
      onAudit(`计量造价: 报表导出 ${format.toUpperCase()} ${fileName}`);
    } catch {
      setReportState(`已生成 ${summaryText} · 当前环境不支持自动下载`);
    }
  }

  function createReportTasks(format: "excel" | "pdf" | "print" | "word") {
    const names =
      activeAnalysisTab === "审核报告"
        ? ["审核报告", "增减分析表"]
        : ["分部分项工程量清单与计价表", "费用汇总表"];
    const tasks = createReportExportTasks(
      names,
      [format],
      reportScheme.schemeId,
    );
    setReportTasks(tasks);
    setActiveMainNav("报表");
    setActiveBudgetTab("报表");
    onAudit(`计量造价: 创建报表${format.toUpperCase()}任务 ${tasks.length} 个`);
    if (format === "excel" || format === "word") {
      setReportState(`正在生成 ${format.toUpperCase()} 报表…`);
      void downloadReportArtifact(format);
      return;
    }
    try {
      window.print();
      setReportState("已发起打印 · 可在打印对话框另存为 PDF");
    } catch {
      setReportState(`${tasks.length} 个打印任务 · 当前环境不支持打印`);
    }
  }

  function runReportScheme(format?: "excel" | "pdf" | "print" | "word") {
    const scheme = format
      ? { ...reportScheme, formats: [format] }
      : reportScheme;
    const tasks = createReportExportTasksFromScheme(scheme);
    setReportTasks(tasks);
    setActiveMainNav("报表");
    setActiveBudgetTab("报表");
    setReportState(`${scheme.name}: ${tasks.length} 个任务 · 待专业复核`);
    onAudit(`计量造价: 执行报表方案 ${scheme.name}`);
  }

  function saveCurrentReportScheme() {
    const saved = saveCostReportScheme(reportScheme, "项目审核报表方案");
    setReportScheme(saved);
    setReportSchemeState("已保存报表方案");
    onAudit("计量造价: 保存报表方案");
  }

  function loadArchivedReportScheme() {
    const loaded = loadCostReportScheme({
      ...reportScheme,
      name: "历史审核报表方案",
      reportNames: ["审核报告", "增减分析表", "单位工程费用汇总表"],
      formats: ["excel", "pdf", "word"],
    });
    setReportScheme(loaded);
    setReportSchemeState("已载入历史报表方案");
    onAudit("计量造价: 载入报表方案");
  }

  function restoreDefaultReportScheme() {
    const restored = restoreSystemReportScheme();
    setReportScheme(restored);
    setReportSchemeState("已恢复系统报表方案");
    onAudit("计量造价: 恢复系统报表方案");
  }

  function addMoreReports() {
    const next = addReportsToCostReportScheme(reportScheme, [
      "其他项目清单与计价表",
      "措施项目清单与计价表",
    ]);
    setReportScheme(next);
    setReportSchemeState("已追加更多报表");
    onAudit("计量造价: 更多报表复制到工程文件");
  }

  function toggleReportWatermark() {
    // 手册 2.10.2：水印有文字、图片两种形式；按 文字→图片→无 循环切换。
    const order: CostReportWatermarkMode[] = ["text", "image", "none"];
    const nextMode =
      order[(order.indexOf(reportDesign.watermark.mode) + 1) % order.length] ??
      "text";
    const nextDesign = updateReportSimpleDesign(reportDesign, {
      watermark: {
        mode: nextMode,
        imageRef:
          nextMode === "image"
            ? reportDesign.watermark.imageRef || "company-seal.png"
            : reportDesign.watermark.imageRef,
      },
    });
    setReportDesign(nextDesign);
    setReportScheme(
      updateCostReportExportSettings(reportScheme, {
        includeWatermark: nextMode !== "none",
        watermarkText: nextDesign.watermark.text,
      }),
    );
    setReportSchemeState(describeReportWatermark(nextDesign.watermark));
    onAudit("计量造价: 报表设计更新水印设置");
  }

  function updateReportDesignField(
    patch: Parameters<typeof updateReportSimpleDesign>[1],
    summary: string,
  ) {
    setReportDesign((current) => updateReportSimpleDesign(current, patch));
    setReportSchemeState(summary);
  }

  function toggleReportColumn(columnId: string, visible: boolean) {
    setReportDesign((current) =>
      setReportColumnVisible(current, columnId, visible),
    );
    setReportSchemeState("已更新表头列设置");
  }

  function applyReportTempEdit() {
    // 手册 2.10.2 使用技巧 2：临时编辑只改预览呈现，不落库。
    if (!reportPreview || reportPreview.sections.length === 0) {
      setReportTempEditState("无可编辑内容 · 先生成审核报告");
      return;
    }
    const section = reportPreview.sections[0];
    const field = Object.keys(section?.rows[0] ?? {})[0];
    if (!section || section.rows.length === 0 || !field) {
      setReportTempEditState("无可编辑内容 · 先生成审核报告");
      return;
    }
    const result = applyTemporaryReportEdits(reportPreview.sections, [
      {
        sectionId: section.sectionId,
        rowIndex: 0,
        field,
        value: `${section.rows[0]?.[field] ?? ""}（临时编辑）`,
      },
    ]);
    setReportPreview({ ...reportPreview, sections: result.sections });
    setReportTempEditState(
      `临时编辑 ${result.appliedCount} 处 · 跳过 ${result.skippedCount} 处 · 仅本次预览`,
    );
    onAudit("计量造价: 报表临时编辑");
  }

  function submitForApproval() {
    if (approvalRecord && approvalRecord.status === "waiting") {
      setApprovalMessage("已有待审批单，请先裁决。");
      return;
    }
    const record = createApprovalRecord({
      reportKey: `rpt-${activeCostProject.projectId}`,
      title: `${activeCostProject.projectName} 项目审核认证单`,
    });
    setApprovalRecord(record);
    setReportOutputState("professional_review_required");
    setApprovalMessage(
      `已送审 ${record.professionalRole} · ${costApprovalStatusLabels[record.status]}`,
    );
    onAudit("计量造价: 审核报告送审注册造价工程师");
    void api.quantityCosting
      .submitApproval(getBackendRequestContext().projectId, {
        approvalKey: record.approvalKey,
        title: record.title,
        professionalRole: record.professionalRole,
      })
      .catch(() => {
        // 数据服务不可达时仅保留本地审批单，重连后由下次送审同步。
      });
  }

  function decideReportApproval(action: CostApprovalAction) {
    if (!approvalRecord) {
      setApprovalMessage("尚未发起审批，先点击「送审审批」。");
      return;
    }
    const decisions: Record<CostApprovalAction, string> = {
      approve: "核增核减口径符合 GB/T50500-2024，同意出具。",
      reject: "费率/口径存在问题，整改后重新送审。",
      return: "送审范围不完整，退回重做。",
    };
    const result = decideApproval(approvalRecord, {
      action,
      decision: decisions[action],
      approverLabel: reportMetadata.reviewer,
      evidenceRefs:
        action === "approve"
          ? [
              `rule-check:${activeCostProject.projectId}`,
              `delta-analysis:${selectedAnalysisIds.length}项`,
            ]
          : [],
    });
    if (result.error) {
      setApprovalMessage(result.error);
      return;
    }
    setApprovalRecord(result.record);
    setReportOutputState(result.reportOutputState);
    setApprovalMessage(
      `${costApprovalStatusLabels[result.record.status]} · ${result.record.decision}`,
    );
    onAudit(
      `计量造价: 审批${costApprovalStatusLabels[result.record.status]}（${reportMetadata.reviewer}）`,
    );
    if (
      result.record.status === "approved" ||
      result.record.status === "rejected" ||
      result.record.status === "returned"
    ) {
      void api.quantityCosting
        .decideApproval(getBackendRequestContext().projectId, {
          approvalKey: result.record.approvalKey,
          status: result.record.status,
          decision: result.record.decision,
        })
        .catch(() => {
          // 数据服务不可达时裁决保留在本地状态机。
        });
    }
  }

  async function handoffVoucherPlan() {
    if (approvalRecord?.status !== "approved") {
      setVoucherHandoffState(
        "移交被阻断: 需注册造价工程师审批通过后才能移交财务",
      );
      return;
    }
    try {
      const result = await api.quantityCosting.saveVoucherPlan(
        getBackendRequestContext().projectId,
        {
          planKey: voucherPlan.planId,
          vouchers: voucherPlan.vouchers.map((voucher) => ({
            voucherKey: voucher.voucherId,
            description: voucher.description,
            entries: voucher.entries.map((entry) => ({
              entryId: entry.entryId,
              accountCode: entry.accountCode,
              accountName: entry.accountName,
              direction: entry.direction,
              amount: entry.amount,
              summary: entry.summary,
            })),
            debitTotal: voucher.debitTotal,
            creditTotal: voucher.creditTotal,
            tailDifference: voucher.tailDifference,
            balanced: voucher.balanced,
            generationStatus: voucher.generationStatus,
            skipReason: voucher.skipReason ?? "",
          })),
        },
      );
      setVoucherHandoffState(
        `已移交财务 ${result.handedOffCount} 张凭证 · 跳过 ${result.skippedCount} 张`,
      );
      onAudit(`计量造价: 凭证计划移交财务 ${result.handedOffCount} 张`);
    } catch {
      setVoucherHandoffState("数据服务未连接 · 暂存本地待移交");
    }
  }

  function signOffReport() {
    const result = advanceSignOff(reportOutputState, approvalRecord);
    if (result.error) {
      setApprovalMessage(result.error);
      return;
    }
    setReportOutputState(result.next);
    setApprovalMessage(
      `签发推进至「${costReportOutputStateLabels[result.next]}」`,
    );
    onAudit(`计量造价: 报告签发 ${result.next}`);
  }

  function resubmitReportApproval() {
    if (!approvalRecord) {
      setApprovalMessage("尚未发起审批。");
      return;
    }
    const result = resubmitApproval(approvalRecord);
    if (result.error) {
      setApprovalMessage(result.error);
      return;
    }
    setApprovalRecord(result.record);
    setReportOutputState("professional_review_required");
    setApprovalMessage("整改后已重新送审 · 待审批");
    onAudit("计量造价: 审批重新送审");
  }

  function applyCustomPageNumbers() {
    const next = updateCostReportExportSettings(reportScheme, {
      pageNumberMode: "custom",
      startPage: 3,
      totalPages: 12,
    });
    setReportScheme(next);
    setReportSchemeState("已设置自定义连续页码");
    onAudit("计量造价: 报表设计更新连续页码");
  }

  function applyReportSchemeToUnitProjects() {
    const schemePlan = createReportSchemeApplicationPlan(
      activeCostProject,
      reportScheme,
    );
    const designPlan = applyDesignToUnitProjects(
      activeCostProject,
      reportDesign,
      schemePlan.targetNodeIds,
    );
    setReportState(
      `统一替换 ${designPlan.appliedCount} 个单位工程${
        designPlan.skippedNodeIds.length > 0
          ? ` · 跳过非单位工程 ${designPlan.skippedNodeIds.length} 个`
          : ""
      } · 待专业复核`,
    );
    setReportSchemeState("已统一替换单位工程报表方案与设计");
    onAudit("计量造价: 报表方案统一替换到单位工程");
  }

  function convertToBudget(source: "approved" | "submitted") {
    const result = convertReviewVersionToBudget(activeCostProject, source);
    setReviewVersions((current) => [
      ...current.filter(
        (version) => version.versionId !== result.version.versionId,
      ),
      result.version,
    ]);
    setBudgetConversionState(
      `${result.fileName} · ${result.boqItems.length} 条清单${
        result.droppedItemIds.length > 0
          ? ` · 丢弃空项 ${result.droppedItemIds.length} 条`
          : ""
      } · 待归档`,
    );
    setReportState("预算转换包已生成 · 待专业复核");
    setActiveMainNav("报表");
    setActiveBudgetTab("报表");
    onAudit(
      source === "approved"
        ? `计量造价: 生成审定转预算包 ${result.fileName}`
        : `计量造价: 生成送审转预算包 ${result.fileName}`,
    );
  }

  function applyApprovedExpression(itemId: string, expression: string) {
    const sourceItem =
      boqOverrides[itemId] ??
      sourceCostProject.boqItems.find((item) => item.itemId === itemId);
    if (!sourceItem) {
      setConversionState("未找到当前清单项，计算式未生效。");
      return;
    }
    const evaluation = evaluateCostExpression(
      expression,
      buildItemExpressionVariables(sourceItem),
    );
    if (evaluation.status !== "parsed" || evaluation.value === null) {
      setConversionState(`审定计算式未生效：${evaluation.error}`);
      return;
    }
    const nextQty = evaluation.value;
    updateBoqItem(
      itemId,
      (item) => ({ ...item, approvedQty: nextQty }),
      `计量造价: 审定计算式重算工程量 ${expression}=${nextQty}`,
    );
    setConversionState(`审定计算式已生效：${expression} = ${nextQty}`);
  }

  async function loadBackendRegistry() {
    const registry: QuantityCostingRegistryResponse =
      await api.quantityCosting.registry();
    setBackendRegistry({
      standards: registry.standards,
      quotaLibraries: registry.quotaLibraries,
      quotaItems: registry.quotaItems,
      priceResources: registry.priceResources,
    });
    const pendingCount =
      registry.standards.filter((entry) => !entry.sourceVerified).length +
      registry.quotaItems.filter((item) => item.sourceStatus !== "active")
        .length;
    setRegistryState(
      `已接通 · 标准 ${registry.standards.length} 项 · 定额 ${registry.quotaItems.length} 条` +
        (pendingCount > 0 ? ` · ${pendingCount} 项待来源核验` : "") +
        (registry.bootstrapped ? " · 首次初始化" : ""),
    );
  }

  function readImportFileText(file: File): Promise<string> {
    if (typeof file.text === "function") {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function handleQuotaImportFile(file: File) {
    const text = await readImportFileText(file);
    const baseName = file.name.replace(/\.[^.]*$/, "");
    const libraryId =
      baseName.replace(/[^\w一-鿿-]+/g, "-").slice(0, 64) ||
      "imported-quota";
    const parsed = parseQuotaRegistryCsv(text, {
      quotaLibraryId: libraryId,
      quotaLibraryName: baseName,
      jurisdiction: activeCostProject.jurisdiction,
      specialty: "",
      version: "imported",
      standardId: activeCostProject.standardProfileId,
      sourceRef: file.name,
      sourceVerified: false,
    });
    if (parsed.quotaItems.length === 0) {
      setRegistryImportState(
        `导入失败: ${parsed.errors[0]?.message ?? "无有效定额行"}`,
      );
      return;
    }
    try {
      const result = await api.quantityCosting.importRegistry({
        quotaLibraries: [
          {
            quotaLibraryId: libraryId,
            name: baseName,
            jurisdiction: activeCostProject.jurisdiction,
            version: "imported",
            standardId: activeCostProject.standardProfileId,
            sourceRef: file.name,
            sourceVerified: false,
          },
        ],
        quotaItems: parsed.quotaItems,
      });
      await loadBackendRegistry();
      setRegistryImportState(
        `已导入 ${result.quotaItemCount} 条定额 · ${result.resourceCount} 条资源` +
          (parsed.errors.length > 0
            ? ` · ${parsed.errors.length} 行错误已跳过`
            : "") +
          " · 来源待核验",
      );
      onAudit(`计量造价: 导入定额库 ${file.name}`);
    } catch {
      setRegistryImportState("导入失败: 数据服务未连接");
    }
  }

  async function handlePriceQuoteFile(file: File) {
    const parsed = parsePriceQuoteCsv(await readImportFileText(file));
    if (parsed.quotes.length === 0) {
      setRegistryImportState(
        `载价失败: ${parsed.errors[0]?.message ?? "无有效价格行"}`,
      );
      return;
    }
    const plan = createPriceLoadPlan(activeRegistry, parsed.quotes);
    setPriceLoadPlan(plan);
    setPriceQuoteSourceName(file.name);
    setActiveBudgetTab("人材机汇总");
    setRegistryImportState(
      `载价计划: 匹配 ${plan.idMatchedCount + plan.nameMatchedCount}/${plan.rows.length} 条 · 待确认`,
    );
    onAudit(`计量造价: 解析市场价文件 ${file.name}`);
  }

  async function loadPriceSnapshots() {
    try {
      const snapshots = await api.quantityCosting.priceSnapshots(
        getBackendRequestContext().projectId,
      );
      setPriceSnapshots(snapshots);
    } catch {
      // 数据服务不可达时不展示快照历史。
    }
  }

  async function decidePriceSnapshot(
    snapshotKey: string,
    status: "approved" | "archived",
  ) {
    try {
      await api.quantityCosting.decidePriceSnapshot(
        getBackendRequestContext().projectId,
        { snapshotKey, status },
      );
      await loadPriceSnapshots();
      setRegistryImportState(
        `快照 ${snapshotKey} 已${status === "approved" ? "批准" : "归档"}`,
      );
      onAudit(
        `计量造价: 价格快照${status === "approved" ? "批准" : "归档"} ${snapshotKey}`,
      );
    } catch {
      setRegistryImportState("数据服务未连接 · 快照状态未变更");
    }
  }

  async function confirmPriceLoad() {
    if (!priceLoadPlan) {
      return;
    }
    const payload = buildPriceUpdatePayload(priceLoadPlan);
    const priceDate = new Date().toISOString().slice(0, 10);
    const snapshotKey =
      `price-${priceQuoteSourceName.replace(/\.[^.]*$/, "").replace(/[^\w一-鿿-]+/g, "-")}-${priceDate}`.slice(
        0,
        120,
      );
    try {
      const result = await api.quantityCosting.importRegistry({
        priceUpdates: payload,
        priceSnapshot: {
          snapshotKey,
          projectId: getBackendRequestContext().projectId,
          jurisdiction: activeCostProject.jurisdiction,
          priceDate,
          sourceRef: priceQuoteSourceName,
          sourceVerified: payload.every((update) => update.sourceVerified),
        },
      });
      await loadBackendRegistry();
      await loadPriceSnapshots();
      setRegistryImportState(
        `已载价 ${result.priceUpdateCount} 条资源 · 快照 ${result.priceSnapshotKey ?? snapshotKey}（${result.priceSnapshotResourceCount} 条留痕）`,
      );
      onAudit(
        `计量造价: 批量载价 ${result.priceUpdateCount} 条 · 快照 ${snapshotKey}`,
      );
    } catch {
      const applied = applyPriceLoadPlan(activeRegistry, priceLoadPlan);
      setBackendRegistry(applied.registry);
      setRegistryImportState(
        `数据服务未连接 · 本地载价 ${applied.appliedCount} 条`,
      );
      onAudit(`计量造价: 本地批量载价 ${applied.appliedCount} 条`);
    }
    setPriceLoadPlan(null);
  }

  function selectMainNav(item: CostingMainNav) {
    setActiveMainNav(item);
    if (item === "质控") {
      setActiveBudgetTab("质控检查");
    } else if (item === "报表") {
      setActiveBudgetTab("报表");
    } else if (item === "编制") {
      setActiveBudgetTab("分部分项");
    }
    onAudit(`计量造价: 切换一级导航 ${item}`);
  }

  function selectBudgetTab(item: CostingBudgetTab) {
    setActiveBudgetTab(item);
    if (item === "分部分项") {
      setActiveDetailTab("工程量明细");
    } else if (item === "措施项目" || item === "费用汇总") {
      setActiveDetailTab("单价构成");
    }
    onAudit(`计量造价: 切换业务页签 ${item}`);
  }

  function selectProjectNode(nodeId: string) {
    const node = activeCostProject.treeNodes.find(
      (item) => item.nodeId === nodeId,
    );
    const nextScope = collectCostingNodeScope(
      activeCostProject.treeNodes,
      nodeId,
    );
    const nextItem = dashboard.computedItems.find((item) =>
      nextScope.has(item.nodeId),
    );
    setSelectedNodeId(nodeId);
    if (nextItem) {
      setSelectedItemId(nextItem.itemId);
    }
    onAudit(`计量造价: 项目结构定位 ${node?.name ?? nodeId}`);
  }

  function updateBoqItem(
    itemId: string,
    updater: (item: QuantityCostingBoqItem) => QuantityCostingBoqItem,
    summary: string,
  ) {
    const sourceItem =
      boqOverrides[itemId] ??
      sourceCostProject.boqItems.find((item) => item.itemId === itemId) ??
      addedBoqItems.find((item) => item.itemId === itemId);
    if (!sourceItem) {
      setConversionState("未找到当前清单项，修改未执行。");
      return;
    }
    setBoqOverrides((current) => ({
      ...current,
      [itemId]: updater(current[itemId] ?? sourceItem),
    }));
    setSelectedItemId(itemId);
    setAnalysisDirty(true);
    setConversionState(summary);
    onAudit(`计量造价: ${summary}`);
  }

  function beginBoqEdit(
    item: ComputedCostBoqItem,
    field: CostingEditableBoqField,
    event?: ReactMouseEvent,
  ) {
    event?.preventDefault();
    event?.stopPropagation();
    skipNextEditCommitRef.current = false;
    setSelectedItemId(item.itemId);
    setContextMenu(null);
    setEditingCell({
      itemId: item.itemId,
      field,
      value: String(item[field] ?? ""),
    });
  }

  function cancelBoqEdit() {
    skipNextEditCommitRef.current = true;
    setEditingCell(null);
  }

  function commitBoqEdit() {
    if (!editingCell) {
      return;
    }
    const field = editingCell.field;
    const label = costingEditableFieldLabels[field];
    const rawValue = editingCell.value.trim();
    const numericField =
      field === "approvedQty" || field === "approvedUnitPrice";
    if (numericField) {
      const parsedValue = Number(rawValue.replace(/,/g, ""));
      if (!Number.isFinite(parsedValue)) {
        setConversionState(`${label} 输入无效，修改未提交。`);
        return;
      }
      updateBoqItem(
        editingCell.itemId,
        (item) => ({
          ...item,
          [field]:
            field === "approvedQty"
              ? roundQuantity(parsedValue)
              : roundMoney(parsedValue),
        }),
        `${label} 已修改为 ${parsedValue}`,
      );
    } else {
      updateBoqItem(
        editingCell.itemId,
        (item) => ({ ...item, [field]: rawValue }),
        `${label} 已修改`,
      );
    }
    setEditingCell(null);
  }

  function clearApprovedBoqItem(itemId: string) {
    const item =
      dashboard.computedItems.find(
        (candidate) => candidate.itemId === itemId,
      ) ?? selectedItem;
    updateBoqItem(
      itemId,
      (current) => ({
        ...current,
        approvedCode: current.approvedCode || current.submittedCode,
        approvedName: current.approvedName || current.submittedName,
        approvedFeature: "",
        approvedQty: 0,
        approvedUnitPrice: 0,
        manualReviewRequired: true,
      }),
      `${item?.displayName ?? itemId}: 已清零审定并标记为删项`,
    );
    setActiveBudgetTab("分部分项");
    setActiveDetailTab("详细对比");
  }

  function convertBoqItem(
    item: ComputedCostBoqItem,
    direction: "submitted_to_approved" | "approved_to_submitted",
  ) {
    const result = convertBoqItemData(item, direction);
    if (result.blockedReason) {
      setConversionState(result.blockedReason);
      onAudit(`计量造价: 数据转换被阻止 · ${result.blockedReason}`);
      return;
    }
    setBoqOverrides((current) => ({
      ...current,
      [item.itemId]: result.item,
    }));
    setSelectedItemId(item.itemId);
    setAnalysisDirty(true);
    setActiveBudgetTab("分部分项");
    setActiveDetailTab("换算信息");
    setConversionState(
      direction === "submitted_to_approved"
        ? `${item.displayName}: 送审数据已同步到审定`
        : `${item.displayName}: 审定数据已回写送审`,
    );
    onAudit(
      direction === "submitted_to_approved"
        ? `计量造价: ${item.displayName} 执行送审到审定转换`
        : `计量造价: ${item.displayName} 执行审定到送审转换`,
    );
  }

  function openBoqContextMenu(
    event: ReactMouseEvent,
    item: ComputedCostBoqItem,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedItemId(item.itemId);
    setContextMenu({ x: event.clientX, y: event.clientY, itemId: item.itemId });
  }

  function runCostingContextAction(action: CostingContextAction) {
    const item =
      dashboard.computedItems.find(
        (candidate) => candidate.itemId === contextMenu?.itemId,
      ) ?? selectedItem;
    setContextMenu(null);
    if (!item) {
      return;
    }
    if (action === "check") {
      setSelectedAnalysisIds((current) =>
        current.includes(item.itemId) ? current : [...current, item.itemId],
      );
      setAnalysisPanelOpen(true);
      setActiveAnalysisTab("清单分析");
      setConversionState(`${item.displayName}: 已勾选进入审核报告范围`);
      onAudit(`计量造价: 清单分析勾选 ${item.displayName}`);
      return;
    }
    if (action === "uncheck") {
      setSelectedAnalysisIds((current) =>
        current.filter((itemId) => itemId !== item.itemId),
      );
      setConversionState(`${item.displayName}: 已取消勾选`);
      onAudit(`计量造价: 清单分析取消勾选 ${item.displayName}`);
      return;
    }
    if (action === "batch_top50") {
      selectTopAnalysisRows();
      return;
    }
    if (action === "export_excel") {
      createReportTasks("excel");
      return;
    }
    if (action === "copy_cell") {
      setConversionState(
        `已复制单元格: ${item.displayCode} ${item.displayName} ${formatMoney(item.amountDelta)}`,
      );
      onAudit("计量造价: 复制清单分析单元格内容");
      return;
    }
    if (action === "locate_project") {
      selectProjectNode(item.nodeId);
      setSelectedItemId(item.itemId);
      setActiveBudgetTab("分部分项");
      setActiveDetailTab("详细对比");
      return;
    }
    if (action === "clear_filter") {
      clearAnalysisFilters();
      return;
    }
    if (action === "merge_analysis") {
      if (!analysisMergeEnabled) {
        toggleAnalysisMerge();
      }
      return;
    }
    if (action === "unmerge_analysis") {
      if (analysisMergeEnabled) {
        toggleAnalysisMerge();
      }
      return;
    }
    if (action === "edit_quantity") {
      beginBoqEdit(item, "approvedQty");
      return;
    }
    if (action === "edit_price") {
      beginBoqEdit(item, "approvedUnitPrice");
      return;
    }
    if (action === "convert_to_approved") {
      convertBoqItem(item, "submitted_to_approved");
      return;
    }
    if (action === "convert_to_submitted") {
      convertBoqItem(item, "approved_to_submitted");
      return;
    }
    if (action === "detail_compare") {
      setSelectedItemId(item.itemId);
      setActiveDetailTab("详细对比");
      return;
    }
    if (action === "quantity_detail") {
      setSelectedItemId(item.itemId);
      setActiveDetailTab("工程量明细");
      return;
    }
    if (action === "mark_review") {
      setSelectedAnalysisIds((current) =>
        current.includes(item.itemId) ? current : [...current, item.itemId],
      );
      setActiveDetailTab("说明信息");
      setConversionState(`${item.displayName}: 已加入待复核清单`);
      onAudit(`计量造价: ${item.displayName} 标记待复核`);
      return;
    }
    if (action === "edit_reason") {
      editSelectedChangeReason(item);
      return;
    }
    if (action === "clear_reasons") {
      clearVisibleChangeReasons();
      return;
    }
    if (action === "clear_approved") {
      clearApprovedBoqItem(item.itemId);
      return;
    }
    if (action === "report") {
      const report = generateReviewReportSnapshot(activeCostProject, [
        item.itemId,
      ]);
      setSelectedAnalysisIds([item.itemId]);
      setActiveMainNav("报表");
      setActiveBudgetTab("报表");
      setReportState(
        `${report.selectedCount} 项 · 增减 ${formatMoney(report.amountDelta)} · 待专业复核`,
      );
      onAudit(`计量造价: ${item.displayName} 生成单项审核报告草稿`);
    }
  }

  function handleCostingKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (isCostingEditableTarget(event.target)) {
      return;
    }
    const shortcutKey = event.key.toLowerCase();
    const hasCommandModifier = event.ctrlKey || event.metaKey;

    if (hasCommandModifier) {
      if (shortcutKey === "s") {
        event.preventDefault();
        void saveWorkbenchSnapshot();
        return;
      }
      if (shortcutKey === "enter") {
        event.preventDefault();
        convertSelected();
        return;
      }
      if (shortcutKey === "f") {
        event.preventDefault();
        selectTopAnalysisRows();
        return;
      }
      if (shortcutKey === "p") {
        event.preventDefault();
        generateReport();
        return;
      }
      const tabIndex = Number(shortcutKey);
      const targetTab = costingBudgetTabs[tabIndex - 1];
      if (targetTab) {
        event.preventDefault();
        selectBudgetTab(targetTab);
      }
      return;
    }

    if (event.key === "Escape") {
      if (contextMenu || editingCell) {
        event.preventDefault();
        setContextMenu(null);
        cancelBoqEdit();
      }
      return;
    }

    if (event.key === "Delete") {
      if (activeBudgetTab === "分部分项" && selectedItem) {
        event.preventDefault();
        clearApprovedBoqItem(selectedItem.itemId);
      }
      return;
    }

    if (event.key === "Enter" && selectedItem) {
      event.preventDefault();
      setActiveDetailTab("详细对比");
    }
  }

  // 竖向 splitter:拖拽调整左侧项目树面板宽度。
  function startCostingTreeResize(event: ReactMouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = costingTreeWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setCostingTreeWidth(
        clampPaneSize(
          startWidth,
          moveEvent.clientX - startX,
          COSTING_TREE_WIDTH.min,
          COSTING_TREE_WIDTH.max,
        ),
      );
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // 横向 splitter:拖拽调整底部明细面板高度(向上拖增高)。
  function startCostingDetailResize(event: ReactMouseEvent) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = costingDetailHeight;
    const onMove = (moveEvent: MouseEvent) => {
      setCostingDetailHeight(
        clampPaneSize(
          startHeight,
          startY - moveEvent.clientY,
          COSTING_DETAIL_HEIGHT.min,
          COSTING_DETAIL_HEIGHT.max,
        ),
      );
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startCostingColumnResize(colId: string, event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const startWidth = costingColumnWidths[colId] ?? 80;
    costingColResizeRef.current = { id: colId, startX: event.clientX, startWidth };
    const onMove = (moveEvent: MouseEvent) => {
      const ref = costingColResizeRef.current;
      if (!ref) {
        return;
      }
      const width = clampColumnWidth(ref.startWidth, moveEvent.clientX - ref.startX);
      setCostingColumnWidths((prev) => ({ ...prev, [ref.id]: width }));
    };
    const onUp = () => {
      costingColResizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function resetCostingColumnWidth(colId: string) {
    const def = COSTING_FENBU_COLUMNS.find((column) => column.id === colId);
    if (!def) {
      return;
    }
    setCostingColumnWidths((prev) => ({ ...prev, [colId]: def.width }));
  }

  // A drag handle on a column's right edge. Drag to resize, double-click to
  // reset that column to its default width.
  function costingColumnResizeHandle(colId: string) {
    return (
      <span
        className="arch-gccp-col-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整列宽，双击复位"
        onMouseDown={(event) => startCostingColumnResize(colId, event)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          resetCostingColumnWidth(colId);
        }}
        onClick={(event) => event.stopPropagation()}
      />
    );
  }

  function renderEditableBoqCell(
    item: ComputedCostBoqItem,
    field: CostingEditableBoqField,
    displayValue: ReactNode,
    className = "",
  ) {
    const isEditing =
      editingCell?.itemId === item.itemId && editingCell.field === field;
    return (
      <td
        className={`is-editable ${className}`}
        title={`双击编辑${costingEditableFieldLabels[field]}`}
        onDoubleClick={(event) => beginBoqEdit(item, field, event)}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editingCell.value}
            className="arch-gccp-cell-editor"
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              setEditingCell((current) =>
                current ? { ...current, value: event.target.value } : current,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitBoqEdit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelBoqEdit();
              }
            }}
            onBlur={() => {
              if (skipNextEditCommitRef.current) {
                skipNextEditCommitRef.current = false;
                return;
              }
              commitBoqEdit();
            }}
          />
        ) : (
          displayValue
        )}
      </td>
    );
  }

  return (
    <section
      className="arch-quantity-costing-panel arch-gccp-costing"
      data-business-context-root="quantity-costing"
      style={costingPanelStyle}
      tabIndex={0}
      onKeyDown={handleCostingKeyDown}
      onMouseDown={(event) => {
        if (!isCostingEditableTarget(event.target)) {
          event.currentTarget.focus({ preventScroll: true });
        }
      }}
      onClick={() => setContextMenu(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target;
        const inBusinessSurface =
          target instanceof HTMLElement &&
          target.closest(
            ".arch-gccp-grid-wrap, .arch-gccp-detail-panel, .arch-gccp-project-tree",
          );
        if (selectedItem && inBusinessSurface) {
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            itemId: selectedItem.itemId,
          });
        }
      }}
    >
      <div className="arch-gccp-bluebar">
        <div className="arch-gccp-appmark">计</div>
        <div className="arch-gccp-project-title">
          {activeCostProject.projectName} · 编审一体化
          {!backendSnapshot ? (
            <span
              style={{
                marginLeft: "0.6rem",
                padding: "0.05rem 0.4rem",
                borderRadius: "3px",
                background: "var(--arch-danger, #d9534f)",
                color: "#fff",
                fontSize: "11px",
              }}
            >
              演示样例 · 点「新建工程」开始录入真实工程
            </span>
          ) : null}
        </div>
        <nav className="arch-gccp-main-nav" aria-label="编审一级导航">
          {costingMainNavItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => selectMainNav(item)}
              className={item === activeMainNav ? "is-active" : ""}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="arch-gccp-search">本地标准库 · {registryState}</div>
      </div>

      <div className="arch-gccp-ribbon">
        <button
          type="button"
          onClick={() => {
            setNewProjectForm({
              name: "",
              jurisdiction: "CN-SC",
              unitProjectName: "钢结构工程",
              specialty: "钢结构",
            });
            setNewProjectDialogOpen(true);
          }}
        >
          <FileCog className="h-4 w-4" />
          新建工程
        </button>
        {ribbonActionVisible("create-review") ? (
          <button type="button" onClick={createReview}>
            <FileCog className="h-4 w-4" />
            新建审核
          </button>
        ) : null}
        {ribbonActionVisible("import-approved") ? (
          <button type="button" onClick={importApproved}>
            <CheckCircle2 className="h-4 w-4" />
            导入审定
          </button>
        ) : null}
        {importPlan ? (
          <button type="button" onClick={confirmImportApproved}>
            <CheckCircle2 className="h-4 w-4" />
            确认导入
          </button>
        ) : null}
        <button type="button" onClick={convertSelected}>
          <Workflow className="h-4 w-4" />
          送审转审定
        </button>
        <button
          type="button"
          onClick={() => convertCurrentTabData("approved_to_submitted")}
        >
          <Workflow className="h-4 w-4" />
          审定转送审
        </button>
        <button type="button" onClick={selectTopAnalysisRows}>
          <ShieldAlert className="h-4 w-4" />
          分析与报告
        </button>
        <button type="button" onClick={generateReport}>
          <PackageCheck className="h-4 w-4" />
          审核报告
        </button>
        <button type="button" onClick={saveWorkbenchSnapshot}>
          <Boxes className="h-4 w-4" />
          保存快照
        </button>
        <span className="arch-gccp-ribbon-separator" />
        <button
          type="button"
          onClick={() => setIncreaseEffective((current) => !current)}
        >
          <CircleDot className="h-4 w-4" />
          核增{increaseEffective ? "有效" : "无效"}
        </button>
        <button type="button" onClick={switchSubmittedVersion}>
          <Workflow className="h-4 w-4" />
          切送审版
        </button>
        <button type="button" onClick={deletePreviousReview}>
          <Pause className="h-4 w-4" />
          删旧审核
        </button>
        <button type="button" onClick={() => selectBudgetTab("取费设置")}>
          <Layers3 className="h-4 w-4" />
          费用设置
        </button>
        <button type="button" onClick={() => selectMainNav("质控")}>
          <Activity className="h-4 w-4" />
          校验检查
        </button>
        <button
          type="button"
          onClick={() => quotaFileInputRef.current?.click()}
        >
          <Layers3 className="h-4 w-4" />
          导入定额
        </button>
        <button
          type="button"
          onClick={() => priceFileInputRef.current?.click()}
        >
          <ScanLine className="h-4 w-4" />
          批量载价
        </button>
        <button
          type="button"
          onClick={() => ifcFileInputRef.current?.click()}
        >
          <ScanLine className="h-4 w-4" />
          IFC反查工程量
        </button>
        <input
          ref={quotaFileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          aria-label="定额库文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleQuotaImportFile(file);
            }
            event.target.value = "";
          }}
        />
        <input
          ref={ifcFileInputRef}
          type="file"
          accept=".ifc,.ifczip"
          className="hidden"
          aria-label="IFC模型文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleIfcTakeoffFile(file);
            }
            event.target.value = "";
          }}
        />
        <input
          ref={priceFileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          aria-label="市场价文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handlePriceQuoteFile(file);
            }
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => toggleRibbonAction("import-approved")}
        >
          <ScanLine className="h-4 w-4" />
          工具栏
        </button>
        <button
          type="button"
          onClick={() => setAssistantVisible((current) => !current)}
        >
          <Activity className="h-4 w-4" />
          助手
        </button>
      </div>

      <div className="arch-gccp-tabs" role="tablist" aria-label="预算页签">
        {[
          ...costingBudgetTabs,
          ...(activeBudgetTab === "质控检查" ? (["质控检查"] as const) : []),
          ...(activeBudgetTab === "报表" ? (["报表"] as const) : []),
        ].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => selectBudgetTab(item)}
            className={item === activeBudgetTab ? "is-active" : ""}
          >
            {item}
          </button>
        ))}
      </div>

      <div
        className="arch-gccp-body"
        style={
          {
            position: "relative",
            "--arch-gccp-tree-w": `${costingTreeWidth}px`,
            "--arch-gccp-detail-h": `${costingDetailHeight}px`,
          } as CSSProperties
        }
      >
        <div
          className="arch-gccp-pane-resize-x"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整项目树宽度"
          style={{ left: `calc(${costingTreeWidth}px - 3px)` }}
          onMouseDown={startCostingTreeResize}
        />
        <aside className="arch-gccp-project-tree">
          <div className="arch-gccp-tree-path">单项工程 &gt; 单位工程</div>
          <div className="arch-gccp-tree-tabs">
            <button type="button" className="is-active">
              项目结构
            </button>
            <button type="button">快速查询</button>
          </div>
          <div className="arch-gccp-tree-tools">
            <button type="button" onClick={createReview}>
              新建
            </button>
            <button type="button" onClick={mergeAuditProject}>
              文件合并
            </button>
            <button type="button" onClick={copySelectedProjectNode}>
              复制
            </button>
            <button type="button" onClick={deleteSelectedProjectNode}>
              软删除
            </button>
            <button type="button" onClick={batchDeleteUnitProjects}>
              批删
            </button>
            <button type="button" onClick={addBoqRow}>
              新增清单
            </button>
          </div>
          <div className="arch-gccp-tree-list">
            {activeCostProject.treeNodes.map((node) => (
              <button
                key={node.nodeId}
                type="button"
                onClick={() => selectProjectNode(node.nodeId)}
                className={node.nodeId === selectedNodeId ? "is-active" : ""}
                style={{ paddingLeft: node.parentId ? 28 : 12 }}
              >
                <span className="arch-gccp-tree-node">⌂ {node.name}</span>
                <span>{node.auditState}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="arch-gccp-sheet-area">
          <div className="arch-gccp-sheet-toolbar">
            <button type="button" className="is-active">
              {activeBudgetTab}
            </button>
            <button type="button" onClick={convertSelected}>
              送审→审定
            </button>
            <button
              type="button"
              onClick={() => convertCurrentTabData("approved_to_submitted")}
            >
              审定→送审
            </button>
            <button type="button" onClick={selectTopAnalysisRows}>
              筛选
            </button>
            <button
              type="button"
              className={analysisDirty ? "is-dirty" : ""}
              onClick={rerunAnalysis}
            >
              重新分析
            </button>
            <button type="button" onClick={applyAnalysisFilterPreset}>
              过滤预设
            </button>
            <button
              type="button"
              onClick={() => selectAnalysisByRule("delta_rank")}
            >
              前3差异
            </button>
            <button
              type="button"
              onClick={() => selectAnalysisByRule("absolute_delta")}
            >
              大额差异
            </button>
            <button type="button" onClick={toggleAnalysisMerge}>
              {analysisMergeEnabled ? "取消合并" : "合并分析"}
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab("详细对比")}
            >
              颜色
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab("说明信息")}
            >
              列设置
            </button>
            <button
              type="button"
              onClick={() => setCostingRowHeight((height) => cycleRowHeight(height))}
              title="切换行高:紧凑 / 标准 / 宽松"
            >
              行高·{rowHeightLabel(costingRowHeight)}
            </button>
            <button
              type="button"
              onClick={() => {
                setCostingColumnWidths(defaultColumnWidths());
                setCostingRowHeight(COSTING_DEFAULT_ROW_HEIGHT);
              }}
              title="恢复默认列宽与行高"
            >
              复位
            </button>
            <button type="button" onClick={() => editSelectedChangeReason()}>
              增减说明
            </button>
            <button type="button" onClick={clearVisibleChangeReasons}>
              清说明
            </button>
            <span>
              送审 {formatMoney(visibleSummary.submittedTotal)} · 审定{" "}
              {formatMoney(visibleSummary.approvedTotal)} · 入库送审{" "}
              {formatMoney(persistedSubmittedTotal)} · 入库审定{" "}
              {formatMoney(persistedApprovedTotal)}
            </span>
          </div>

          <div className="arch-gccp-grid-wrap">
            {activeBudgetTab === "工程概况" ? (
              <>
                <table className="arch-gccp-grid">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>名称</th>
                      <th>送审内容</th>
                      <th>审定内容</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        "1",
                        "工程名称",
                        activeCostProject.projectName,
                        activeCostProject.projectName,
                      ],
                      [
                        "2",
                        "地区",
                        activeCostProject.jurisdiction,
                        activeCostProject.jurisdiction,
                      ],
                      [
                        "3",
                        "计价标准",
                        activeCostProject.standardProfileId,
                        activeCostProject.standardProfileId,
                      ],
                      [
                        "4",
                        "定额库",
                        activeCostProject.quotaLibraryId,
                        activeCostProject.quotaLibraryId,
                      ],
                      [
                        "5",
                        "审核版本",
                        `${reviewRoundCount} 审`,
                        activeReviewVersions.at(-1)?.description ?? "未生成",
                      ],
                    ].map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${row[0]}-${cellIndex}`}>{cell}</td>
                        ))}
                        <td>{activeCostProject.standardProfileId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="arch-gccp-grid arch-gccp-feature-grid">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>工程特征</th>
                      <th>送审内容</th>
                      <th>审定内容</th>
                      <th>复核状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["1", "结构类型", "重钢结构", "重钢结构", "通过"],
                      [
                        "2",
                        "建筑面积",
                        `${activeCostProject.treeNodes.length * 1000} m2`,
                        `${activeCostProject.treeNodes.length * 1000} m2`,
                        "通过",
                      ],
                      [
                        "3",
                        "计价依据",
                        activeCostProject.standardProfileId,
                        activeCostProject.standardProfileId,
                        phase2ReviewCount > 0 ? "待来源复核" : "通过",
                      ],
                      [
                        "4",
                        "专业范围",
                        activeCostProject.treeNodes
                          .filter((node) => node.nodeType === "unit_project")
                          .map((node) => node.specialty)
                          .join("、"),
                        activeCostProject.treeNodes
                          .filter((node) => node.nodeType === "unit_project")
                          .map((node) => node.specialty)
                          .join("、"),
                        "待专业确认",
                      ],
                    ].map((row) => (
                      <tr
                        key={row[0]}
                        className={
                          row[4] === "待来源复核" || row[4] === "待专业确认"
                            ? "is-warning-row"
                            : ""
                        }
                      >
                        {row.map((cell, cellIndex) => (
                          <td key={`${row[0]}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="arch-gccp-grid arch-gccp-feature-grid">
                  <thead>
                    <tr>
                      <th>版本</th>
                      <th>类型</th>
                      <th>送审版本</th>
                      <th>审定版本</th>
                      <th>状态</th>
                      <th>创建人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReviewVersions.map((version) => (
                      <tr key={version.versionId}>
                        <td>{version.description}</td>
                        <td>{version.versionType}</td>
                        <td>{version.submittedVersionId ?? "-"}</td>
                        <td>{version.approvedVersionId ?? "-"}</td>
                        <td>{version.status}</td>
                        <td>{version.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {activeBudgetTab === "取费设置" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>费用名称</th>
                    <th>送审基数</th>
                    <th>送审费率</th>
                    <th>送审金额</th>
                    <th>审定基数</th>
                    <th>审定费率</th>
                    <th>审定金额</th>
                    <th>增减金额</th>
                    <th>规则来源</th>
                  </tr>
                </thead>
                <tbody>
                  {feeSummary.map((item, index) => (
                    <tr key={item.feeId}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>{formatMoney(item.submittedBaseAmount)}</td>
                      <td>{formatRate(item.submittedRate)}</td>
                      <td>{formatMoney(item.submittedAmount)}</td>
                      <td>{formatMoney(item.approvedBaseAmount)}</td>
                      <td>{formatRate(item.approvedRate)}</td>
                      <td>{formatMoney(item.approvedAmount)}</td>
                      <td>{formatMoney(item.amountDelta)}</td>
                      <td>{item.sourceRef || "待来源复核"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "分部分项" ? (
              <table
                className="arch-gccp-grid arch-gccp-grid--resizable"
                style={
                  {
                    "--arch-gccp-row-h": `${costingRowHeight}px`,
                  } as CSSProperties
                }
              >
                <colgroup>
                  {COSTING_FENBU_COLUMNS.map((column) => (
                    <col
                      key={column.id}
                      style={{
                        width: `${costingColumnWidths[column.id] ?? column.width}px`,
                      }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>序{costingColumnResizeHandle("seq")}</th>
                    <th rowSpan={2}>标记{costingColumnResizeHandle("mark")}</th>
                    <th rowSpan={2}>编码{costingColumnResizeHandle("code")}</th>
                    <th rowSpan={2}>类别{costingColumnResizeHandle("cat")}</th>
                    <th rowSpan={2}>名称{costingColumnResizeHandle("name")}</th>
                    <th rowSpan={2}>
                      项目特征{costingColumnResizeHandle("feature")}
                    </th>
                    <th rowSpan={2}>单位{costingColumnResizeHandle("unit")}</th>
                    <th colSpan={3}>送审</th>
                    <th colSpan={3}>审定</th>
                    <th colSpan={4}>增减</th>
                    <th rowSpan={2}>来源{costingColumnResizeHandle("source")}</th>
                  </tr>
                  <tr>
                    <th>工程量{costingColumnResizeHandle("sub_qty")}</th>
                    <th>综合单价{costingColumnResizeHandle("sub_price")}</th>
                    <th>综合合价{costingColumnResizeHandle("sub_total")}</th>
                    <th>工程量{costingColumnResizeHandle("app_qty")}</th>
                    <th>综合单价{costingColumnResizeHandle("app_price")}</th>
                    <th>综合合价{costingColumnResizeHandle("app_total")}</th>
                    <th>工程量差{costingColumnResizeHandle("delta_qty")}</th>
                    <th>核增{costingColumnResizeHandle("inc")}</th>
                    <th>核减{costingColumnResizeHandle("dec")}</th>
                    <th>增减说明{costingColumnResizeHandle("reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="is-group">
                    <td />
                    <td />
                    <td />
                    <td>部</td>
                    <td>当前工程范围</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td>{formatMoney(visibleSummary.submittedTotal)}</td>
                    <td />
                    <td />
                    <td>{formatMoney(visibleSummary.approvedTotal)}</td>
                    <td />
                    <td>{formatMoney(visibleSummary.increaseAmount)}</td>
                    <td>{formatMoney(visibleSummary.decreaseAmount)}</td>
                    <td />
                    <td />
                  </tr>
                  {visibleItems.length === 0 ? (
                    <tr className="arch-gccp-empty-row">
                      <td colSpan={18}>
                        暂无清单项 —
                        请用上方「新建审核 / 导入审定」录入清单。录入后即可拖拽列宽、双击单元格编辑、在清单行右键调用核审操作。
                      </td>
                    </tr>
                  ) : null}
                  {visibleItems.map((item, index) => (
                    <tr
                      key={item.itemId}
                      onClick={() => {
                        setSelectedItemId(item.itemId);
                        onAudit(`计量造价: 定位到清单 ${item.displayName}`);
                      }}
                      onContextMenu={(event) => openBoqContextMenu(event, item)}
                      className={
                        selectedItemId === item.itemId ? "is-active" : ""
                      }
                    >
                      <td>{index + 1}</td>
                      <td>
                        <span className={`arch-gccp-mark ${item.changeMark}`}>
                          {costChangeMarkLabels[item.changeMark]}
                        </span>
                      </td>
                      {renderEditableBoqCell(
                        item,
                        "approvedCode",
                        item.displayCode || "待编码",
                      )}
                      <td>项</td>
                      {renderEditableBoqCell(
                        item,
                        "approvedName",
                        item.displayName || "未命名清单项",
                        "arch-gccp-name-cell",
                      )}
                      {renderEditableBoqCell(
                        item,
                        "approvedFeature",
                        item.approvedFeature ||
                          item.submittedFeature ||
                          item.autoChangeReason,
                      )}
                      <td>{item.unit}</td>
                      <td>{item.submittedQty}</td>
                      <td>{formatMoney(item.submittedUnitPrice)}</td>
                      <td>{formatMoney(item.submittedTotal)}</td>
                      {renderEditableBoqCell(
                        item,
                        "approvedQty",
                        item.approvedQty,
                      )}
                      {renderEditableBoqCell(
                        item,
                        "approvedUnitPrice",
                        formatMoney(item.approvedUnitPrice),
                      )}
                      <td>{formatMoney(item.approvedTotal)}</td>
                      <td>{item.qtyDelta}</td>
                      <td>{formatMoney(item.increaseAmount)}</td>
                      <td>{formatMoney(item.decreaseAmount)}</td>
                      <td>{item.changeReason}</td>
                      <td>{item.sourceRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "措施项目" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>标记</th>
                    <th>类别</th>
                    <th>名称</th>
                    <th>送审计算基数</th>
                    <th>送审费率</th>
                    <th>送审金额</th>
                    <th>审定计算基数</th>
                    <th>审定费率</th>
                    <th>审定金额</th>
                    <th>增减金额</th>
                    <th>增减说明</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {measureItems.map((item, index) => (
                    <tr key={item.itemId}>
                      <td>{index + 1}</td>
                      <td>
                        <span className={`arch-gccp-mark ${item.changeMark}`}>
                          {costChangeMarkLabels[item.changeMark]}
                        </span>
                      </td>
                      <td>
                        {item.measureType === "organization"
                          ? "组织措施"
                          : "技术措施"}
                      </td>
                      <td>{item.name}</td>
                      <td>{formatMoney(item.submittedBaseAmount)}</td>
                      <td>{formatRate(item.submittedRate)}</td>
                      <td>{formatMoney(item.submittedAmount)}</td>
                      <td>{formatMoney(item.approvedBaseAmount)}</td>
                      <td>{formatRate(item.approvedRate)}</td>
                      <td>{formatMoney(item.approvedAmount)}</td>
                      <td>{formatMoney(item.amountDelta)}</td>
                      <td>{item.changeReason}</td>
                      <td>{item.sourceRef || "待来源复核"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "其他项目" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>标记</th>
                    <th>其他项目</th>
                    <th>名称</th>
                    <th>送审金额</th>
                    <th>审定金额</th>
                    <th>增减金额</th>
                    <th>增减说明</th>
                    <th>规则来源</th>
                  </tr>
                </thead>
                <tbody>
                  {otherItems.map((item, index) => (
                    <tr key={item.itemId}>
                      <td>{index + 1}</td>
                      <td>
                        <span className={`arch-gccp-mark ${item.changeMark}`}>
                          {costChangeMarkLabels[item.changeMark]}
                        </span>
                      </td>
                      <td>{otherItemTypeLabel(item.otherType)}</td>
                      <td>{item.name}</td>
                      <td>{formatMoney(item.submittedAmount)}</td>
                      <td>{formatMoney(item.approvedAmount)}</td>
                      <td>{formatMoney(item.amountDelta)}</td>
                      <td>{item.changeReason}</td>
                      <td>{item.sourceRef || "待来源复核"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "人材机汇总" && priceSnapshots.length > 0 ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>价格快照</th>
                    <th>地区</th>
                    <th>价格日期</th>
                    <th>资源数</th>
                    <th>来源</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {priceSnapshots.map((snapshot) => (
                    <tr key={snapshot.snapshotKey}>
                      <td>{snapshot.snapshotKey}</td>
                      <td>{snapshot.jurisdiction}</td>
                      <td>{snapshot.priceDate}</td>
                      <td>{snapshot.resourceCount}</td>
                      <td>{snapshot.sourceRef || "-"}</td>
                      <td>
                        {snapshot.status === "review"
                          ? "待复核"
                          : snapshot.status === "approved"
                            ? "已批准"
                            : snapshot.status === "archived"
                              ? "已归档"
                              : snapshot.status}
                        {snapshot.sourceVerified ? " · 来源已验证" : ""}
                        {snapshot.status === "review" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void decidePriceSnapshot(
                                snapshot.snapshotKey,
                                "approved",
                              )
                            }
                          >
                            批准
                          </button>
                        ) : null}
                        {snapshot.status !== "archived" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void decidePriceSnapshot(
                                snapshot.snapshotKey,
                                "archived",
                              )
                            }
                          >
                            归档
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "人材机汇总" && priceLoadPlan ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>载价</th>
                    <th>资源</th>
                    <th>单位</th>
                    <th>现价</th>
                    <th>新价</th>
                    <th>价差</th>
                    <th>匹配</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {priceLoadPlan.rows.map((row) => (
                    <tr key={row.rowId}>
                      <td>{row.selected ? "✓" : "—"}</td>
                      <td>{row.resourceName}</td>
                      <td>{row.unit || "-"}</td>
                      <td>
                        {row.currentPrice === null
                          ? "未匹配"
                          : formatMoney(row.currentPrice)}
                      </td>
                      <td>{formatMoney(row.newPrice)}</td>
                      <td>
                        {row.priceDelta === null
                          ? "-"
                          : `${formatMoney(row.priceDelta)}${
                              row.deltaRatio === null
                                ? ""
                                : ` (${(row.deltaRatio * 100).toFixed(1)}%)`
                            }`}
                      </td>
                      <td>
                        {row.matchType === "id"
                          ? "编号匹配"
                          : row.matchType === "name"
                            ? "名称匹配"
                            : "未匹配"}
                      </td>
                      <td>{row.sourceRef || "-"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5}>
                      {`匹配 ${
                        priceLoadPlan.idMatchedCount +
                        priceLoadPlan.nameMatchedCount
                      } 条 · 未匹配 ${priceLoadPlan.unmatchedCount} 条`}
                    </td>
                    <td colSpan={3}>
                      <button type="button" onClick={() => void confirmPriceLoad()}>
                        确认载价
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPriceLoadPlan(null);
                          setRegistryImportState("载价已取消");
                        }}
                      >
                        取消
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "人材机汇总" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>类别</th>
                    <th>名称</th>
                    <th>单位</th>
                    <th>含量/基数</th>
                    <th>费率</th>
                    <th>金额</th>
                    <th>来源</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {quotaBreakdown.components.map((item, index) => (
                    <tr key={item.componentId}>
                      <td>{index + 1}</td>
                      <td>{componentTypeLabel(item.componentType)}</td>
                      <td>{item.name}</td>
                      <td>
                        {item.componentType === "management" ||
                        item.componentType === "profit" ||
                        item.componentType === "risk"
                          ? "项"
                          : quotaBreakdown.unit}
                      </td>
                      <td>{item.baseAmount}</td>
                      <td>
                        {item.rate === null ? "-" : formatRate(item.rate)}
                      </td>
                      <td>{formatMoney(item.amount)}</td>
                      <td>{item.sourceRef || "待来源复核"}</td>
                      <td>{item.sourceVerified ? "已验证" : "待复核"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "费用汇总" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>费用代号</th>
                    <th>名称</th>
                    <th>送审基数</th>
                    <th>送审费率</th>
                    <th>送审金额</th>
                    <th>审定基数</th>
                    <th>审定费率</th>
                    <th>审定金额</th>
                    <th>增减金额</th>
                    <th>增减说明</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {feeSummary.map((item, index) => (
                    <tr key={item.feeId}>
                      <td>{index + 1}</td>
                      <td>{item.feeId}</td>
                      <td>{item.name}</td>
                      <td>{formatMoney(item.submittedBaseAmount)}</td>
                      <td>{formatRate(item.submittedRate)}</td>
                      <td>{formatMoney(item.submittedAmount)}</td>
                      <td>{formatMoney(item.approvedBaseAmount)}</td>
                      <td>{formatRate(item.approvedRate)}</td>
                      <td>{formatMoney(item.approvedAmount)}</td>
                      <td>{formatMoney(item.amountDelta)}</td>
                      <td>{item.changeReason}</td>
                      <td>
                        {item.sourceReviewRequired ? "待来源复核" : "通过"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "质控检查" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>检查类型</th>
                    <th>对象</th>
                    <th>结果</th>
                    <th>处理状态</th>
                    <th>依据</th>
                  </tr>
                </thead>
                <tbody>
                  {ruleCheckReport.ruleResults.map((rule, ruleIndex) => (
                    <tr key={rule.ruleId}>
                      <td>{ruleIndex + 1}</td>
                      <td>{rule.ruleName}</td>
                      <td>
                        {rule.passed
                          ? `${rule.checkedCount} 项已检查`
                          : rule.findings
                              .map((finding) => finding.targetLabel)
                              .join("；")}
                      </td>
                      <td>
                        {rule.passed
                          ? "通过"
                          : rule.findings
                              .map((finding) => finding.result)
                              .join("；")}
                      </td>
                      <td>
                        {rule.passed
                          ? "已检查"
                          : rule.findings.some(
                                (finding) => finding.severity === "error",
                              )
                            ? "需整改"
                            : rule.findings.some(
                                  (finding) => finding.severity === "warning",
                                )
                              ? "待复核"
                              : "提示"}
                      </td>
                      <td>{rule.basis}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>—</td>
                    <td>校验结论</td>
                    <td>{`${ruleCheckReport.checkedRuleCount} 项规则 · ${visibleItems.length} 条清单 · ${phase2ReviewCount} 组来源待复核`}</td>
                    <td>{ruleCheckReport.conclusion}</td>
                    <td>
                      {ruleCheckReport.errorCount > 0
                        ? "需整改"
                        : ruleCheckReport.warningCount > 0
                          ? "待复核"
                          : "已检查"}
                    </td>
                    <td>{activeCostProject.standardProfileId}</td>
                  </tr>
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "报表" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    {visibleReportColumnIds.has("seq") ? <th>序号</th> : null}
                    {visibleReportColumnIds.has("report_name") ? (
                      <th>报表名称</th>
                    ) : null}
                    {visibleReportColumnIds.has("data_source") ? (
                      <th>数据来源</th>
                    ) : null}
                    {visibleReportColumnIds.has("status") ? <th>状态</th> : null}
                    {visibleReportColumnIds.has("submitted_total") ? (
                      <th>送审合计</th>
                    ) : null}
                    {visibleReportColumnIds.has("approved_total") ? (
                      <th>审定合计</th>
                    ) : null}
                    {visibleReportColumnIds.has("amount_delta") ? (
                      <th>增减金额</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {reportScheme.reportNames.map((name, index) => (
                    <tr key={name}>
                      {visibleReportColumnIds.has("seq") ? (
                        <td>{index + 1}</td>
                      ) : null}
                      {visibleReportColumnIds.has("report_name") ? (
                        <td>{name}</td>
                      ) : null}
                      {visibleReportColumnIds.has("data_source") ? (
                        <td>{reportSourceLabel(name)}</td>
                      ) : null}
                      {visibleReportColumnIds.has("status") ? (
                        <td>
                          {reportTasks.some((task) => task.name === name)
                            ? reportState
                            : "待生成"}
                        </td>
                      ) : null}
                      {visibleReportColumnIds.has("submitted_total") ? (
                        <td>{formatMoney(dashboard.summary.submittedTotal)}</td>
                      ) : null}
                      {visibleReportColumnIds.has("approved_total") ? (
                        <td>{formatMoney(dashboard.summary.approvedTotal)}</td>
                      ) : null}
                      {visibleReportColumnIds.has("amount_delta") ? (
                        <td>{formatMoney(dashboard.summary.amountDelta)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "报表" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>凭证</th>
                    <th>摘要</th>
                    <th>来源单据</th>
                    <th>借方合计</th>
                    <th>贷方合计</th>
                    <th>平衡</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherPlan.vouchers.map((voucher) => (
                    <tr key={voucher.voucherId}>
                      <td>{voucher.voucherId}</td>
                      <td>{voucher.description}</td>
                      <td>{voucher.sourceDocId}</td>
                      <td>{formatMoney(voucher.debitTotal)}</td>
                      <td>{formatMoney(voucher.creditTotal)}</td>
                      <td>{voucher.balanced ? "平衡" : "不平衡"}</td>
                      <td>
                        {voucher.generationStatus === "generated"
                          ? "已生成凭证草稿"
                          : (voucher.skipReason ?? "已跳过")}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>—</td>
                    <td>审定结算凭证计划合计</td>
                    <td>{voucherPlan.reviewVersionId}</td>
                    <td>{formatMoney(voucherPlan.approvedTotal)}</td>
                    <td>{formatMoney(voucherPlan.approvedTotal)}</td>
                    <td>
                      {`已生成 ${voucherPlan.generatedCount} 张 · 跳过 ${voucherPlan.skippedCount} 张`}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void handoffVoucherPlan()}
                      >
                        移交财务
                      </button>
                      {voucherHandoffState}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </div>

          <div
            className="arch-gccp-pane-resize-y"
            role="separator"
            aria-orientation="horizontal"
            aria-label="拖拽调整明细面板高度"
            onMouseDown={startCostingDetailResize}
          />

          <section className="arch-gccp-detail-panel">
            <div className="arch-gccp-detail-tabs">
              {costingDetailTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveDetailTab(item)}
                  className={item === activeDetailTab ? "is-active" : ""}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="arch-gccp-detail-grid">
              {activeDetailTab === "详细对比" ? (
                <table className="arch-gccp-subgrid">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>送审</th>
                      <th>审定</th>
                      <th>差异</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>名称</td>
                      <td>{selectedItem?.submittedName}</td>
                      <td>{selectedItem?.approvedName}</td>
                      <td>{selectedItem?.autoChangeReason}</td>
                    </tr>
                    <tr>
                      <td>工程量</td>
                      <td>{selectedItem?.submittedQty}</td>
                      <td>{selectedItem?.approvedQty}</td>
                      <td>{selectedItem?.qtyDelta}</td>
                    </tr>
                    <tr>
                      <td>综合单价</td>
                      <td>
                        {formatMoney(selectedItem?.submittedUnitPrice ?? 0)}
                      </td>
                      <td>
                        {formatMoney(selectedItem?.approvedUnitPrice ?? 0)}
                      </td>
                      <td>{formatMoney(selectedItem?.unitPriceDelta ?? 0)}</td>
                    </tr>
                    <tr>
                      <td>综合合价</td>
                      <td>{formatMoney(selectedItem?.submittedTotal ?? 0)}</td>
                      <td>{formatMoney(selectedItem?.approvedTotal ?? 0)}</td>
                      <td>{formatMoney(selectedItem?.amountDelta ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : null}

              {activeDetailTab === "工料机显示" ||
              activeDetailTab === "单价构成" ? (
                <table className="arch-gccp-subgrid">
                  <thead>
                    <tr>
                      <th>标识</th>
                      <th>类别</th>
                      <th>名称</th>
                      <th>标准含量</th>
                      <th>送审含量</th>
                      <th>审定含量</th>
                      <th>含量差</th>
                      <th>送审金额</th>
                      <th>审定金额</th>
                      <th>价差</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceComparisonRows
                      .filter(
                        (item) =>
                          activeDetailTab === "单价构成" ||
                          ["labor", "material", "machine"].includes(
                            item.componentType,
                          ),
                      )
                      .map((item) => (
                        <tr key={item.rowId}>
                          <td>
                            <span
                              className={`arch-gccp-mark ${item.changeMark}`}
                            >
                              {costChangeMarkLabels[item.changeMark]}
                            </span>
                          </td>
                          <td>{componentTypeLabel(item.componentType)}</td>
                          <td>{item.name}</td>
                          <td>{item.standardConsumption}</td>
                          <td>{item.submittedConsumption}</td>
                          <td>{item.approvedConsumption}</td>
                          <td>{item.consumptionDelta}</td>
                          <td>{formatMoney(item.submittedUnitPrice)}</td>
                          <td>{formatMoney(item.approvedUnitPrice)}</td>
                          <td>{formatMoney(item.unitPriceDelta)}</td>
                          <td>
                            {item.sourceReviewRequired
                              ? "待来源复核"
                              : item.sourceRef}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : null}

              {activeDetailTab === "工程量明细" ? (
                <>
                  <table className="arch-gccp-subgrid">
                    <thead>
                      <tr>
                        <th>内容说明</th>
                        <th>计算式(送审)</th>
                        <th>计算式(审定)</th>
                        <th>结果</th>
                        <th>累计标识</th>
                        <th>引用代码</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quantityExpressionDetails.map((detail) => {
                        const isQuantityLine =
                          detail.lineId.endsWith("-quantity");
                        const draft =
                          isQuantityLine && selectedItem
                            ? approvedExpressionDrafts[selectedItem.itemId]
                            : undefined;
                        const draftEvaluation =
                          isQuantityLine && selectedItem && draft !== undefined
                            ? evaluateCostExpression(
                                draft,
                                buildItemExpressionVariables(selectedItem),
                              )
                            : null;
                        return (
                          <tr key={detail.lineId}>
                            <td>{detail.description}</td>
                            <td>{detail.submittedExpression}</td>
                            <td>
                              {isQuantityLine && selectedItem ? (
                                <input
                                  className="arch-gccp-cell-editor"
                                  aria-label="计算式(审定)"
                                  value={draft ?? detail.approvedExpression}
                                  onChange={(event) =>
                                    setApprovedExpressionDrafts((current) => ({
                                      ...current,
                                      [selectedItem.itemId]:
                                        event.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    if (draft !== undefined) {
                                      applyApprovedExpression(
                                        selectedItem.itemId,
                                        draft,
                                      );
                                    }
                                  }}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" &&
                                      draft !== undefined
                                    ) {
                                      applyApprovedExpression(
                                        selectedItem.itemId,
                                        draft,
                                      );
                                    }
                                  }}
                                />
                              ) : (
                                detail.approvedExpression
                              )}
                            </td>
                            <td>
                              {draftEvaluation
                                ? draftEvaluation.status === "parsed"
                                  ? draftEvaluation.value
                                  : (draftEvaluation.error ?? "待复核")
                                : detail.approvedResult}
                            </td>
                            <td>
                              {detail.sourceReviewRequired ? "复核" : "✓"}
                            </td>
                            <td>{detail.variableCode}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <table className="arch-gccp-subgrid">
                    <thead>
                      <tr>
                        <th>变量名</th>
                        <th>变量说明</th>
                        <th>单位</th>
                        <th>变量值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem
                        ? buildItemExpressionVariables(selectedItem)
                        : [buildingAreaVariable]
                      ).map((variable) => (
                        <tr key={variable.code}>
                          <td>{variable.code}</td>
                          <td>{variable.name}</td>
                          <td>{variable.unit}</td>
                          <td>{variable.value}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>GCL</td>
                        <td>工程量差</td>
                        <td>{selectedItem?.unit}</td>
                        <td>{selectedItem?.qtyDelta ?? 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              ) : null}

              {[
                "标准换算",
                "换算信息",
                "特征及内容",
                "组价方案",
                "反查图形工程量",
                "说明信息",
              ].includes(activeDetailTab) ? (
                <table className="arch-gccp-subgrid">
                  <thead>
                    <tr>
                      <th>项目</th>
                      <th>内容</th>
                      <th>状态</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{activeDetailTab}</td>
                      <td>
                        {activeDetailTab === "特征及内容"
                          ? `${selectedItem?.submittedFeature || "-"} / ${selectedItem?.approvedFeature || "-"}`
                          : activeDetailTab === "组价方案"
                            ? `${quotaBreakdown.name} · 综合单价 ${formatMoney(quotaBreakdown.unitPrice)}`
                            : activeDetailTab === "反查图形工程量"
                              ? `${selectedItem?.elementId ?? "未绑定模型构件"}`
                              : activeDetailTab === "说明信息"
                                ? `${selectedItem?.changeReason ?? ""}`
                                : conversionState}
                      </td>
                      <td>
                        {selectedItem?.sourceReviewRequired ? "待复核" : "通过"}
                      </td>
                      <td>{selectedItem?.sourceRef || "待来源复核"}</td>
                    </tr>
                  </tbody>
                </table>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      {analysisPanelOpen ? (
        <section className="arch-gccp-analysis-panel">
          <div className="arch-gccp-analysis-tabs">
            {costingAnalysisTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={tab === activeAnalysisTab ? "is-active" : ""}
                onClick={() => setActiveAnalysisTab(tab)}
              >
                {tab}
              </button>
            ))}
            <button type="button" onClick={clearAnalysisFilters}>
              清过滤
            </button>
            <button
              type="button"
              className={analysisDirty ? "is-dirty" : ""}
              onClick={rerunAnalysis}
            >
              重新分析
            </button>
            {(["single_project", "unit_project", "fee"] as const).map(
              (level) => (
                <button
                  key={level}
                  type="button"
                  className={analysisExpandLevel === level ? "is-active" : ""}
                  onClick={() => setAnalysisExpandLevel(level)}
                >
                  {level === "single_project"
                    ? "单项"
                    : level === "unit_project"
                      ? "单位"
                      : "费用"}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                setAnalysisMergeConditions((current) =>
                  current.includes("unit")
                    ? ["nodeId", "approvedCode"]
                    : ["nodeId", "approvedCode", "unit"],
                )
              }
            >
              合并条件
            </button>
            <button type="button" onClick={() => createReportTasks("excel")}>
              Excel
            </button>
            <button type="button" onClick={() => createReportTasks("pdf")}>
              PDF
            </button>
            <button type="button" onClick={() => createReportTasks("word")}>
              Word
            </button>
            <button type="button" onClick={() => runReportScheme()}>
              执行方案
            </button>
            <button type="button" onClick={() => convertToBudget("approved")}>
              审定转预算
            </button>
            <button type="button" onClick={() => convertToBudget("submitted")}>
              送审转预算
            </button>
            <button type="button" onClick={() => setAnalysisPanelOpen(false)}>
              收起
            </button>
          </div>
          <div className="arch-gccp-filter-strip">
            <input
              value={analysisFilterDraft.nameContains}
              placeholder="名称"
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  nameContains: event.target.value,
                }))
              }
            />
            <input
              value={analysisFilterDraft.featureContains}
              placeholder="项目特征"
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  featureContains: event.target.value,
                }))
              }
            />
            <input
              value={analysisFilterDraft.changeReasonContains}
              placeholder="增减说明"
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  changeReasonContains: event.target.value,
                }))
              }
            />
            <select
              value={analysisFilterDraft.mark}
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  mark: event.target.value as CostingFilterDraft["mark"],
                }))
              }
            >
              <option value="all">全部标识</option>
              <option value="add">增</option>
              <option value="delete">删</option>
              <option value="modify">改</option>
              <option value="temporary">临</option>
              <option value="none">无</option>
            </select>
            <select
              value={analysisFilterDraft.numericField}
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  numericField: event.target.value as CostNumericField,
                }))
              }
            >
              <option value="submittedTotal">送审金额</option>
              <option value="approvedTotal">审定金额</option>
              <option value="amountDelta">增减金额</option>
              <option value="qtyDelta">工程量差</option>
              <option value="unitPriceDelta">单价价差</option>
              <option value="amountDeltaRatio">增减比例</option>
            </select>
            <select
              value={analysisFilterDraft.numericOperator}
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  numericOperator: event.target.value as CostNumericOperator,
                }))
              }
            >
              <option value="abs_gte">绝对值≥</option>
              <option value="gte">≥</option>
              <option value="lte">≤</option>
            </select>
            <input
              value={analysisFilterDraft.numericValue}
              placeholder="阈值"
              onChange={(event) =>
                setAnalysisFilterDraft((current) => ({
                  ...current,
                  numericValue: event.target.value,
                }))
              }
            />
            <button type="button" onClick={applyAnalysisFilterDraft}>
              确认过滤
            </button>
          </div>
          <div className="arch-gccp-analysis-grid">
            {activeAnalysisTab === "费用分析" ? (
              <table className="arch-gccp-subgrid">
                <thead>
                  <tr>
                    <th>展开</th>
                    <th>范围</th>
                    <th>清单数</th>
                    <th>送审</th>
                    <th>审定</th>
                    <th>增减</th>
                    <th>核增</th>
                    <th>核减</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisSummaryRows.map((row) => (
                    <tr key={row.rowId}>
                      <td>
                        {row.level === "single_project"
                          ? "单项"
                          : row.level === "unit_project"
                            ? "单位"
                            : "费用"}
                      </td>
                      <td>{row.nodeName}</td>
                      <td>{row.itemIds.length}</td>
                      <td>{formatMoney(row.submittedTotal)}</td>
                      <td>{formatMoney(row.approvedTotal)}</td>
                      <td>{formatMoney(row.amountDelta)}</td>
                      <td>{formatMoney(row.increaseAmount)}</td>
                      <td>{formatMoney(row.decreaseAmount)}</td>
                      <td>
                        {row.sourceReviewCount > 0
                          ? `${row.sourceReviewCount} 项待复核`
                          : "已验证"}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>规则</td>
                    <td colSpan={4}>
                      {increaseStrategyPreview.formulaSummary}
                    </td>
                    <td>{budgetConversionState}</td>
                    <td colSpan={2}>
                      核增有效: {increaseEffective ? "是" : "否"}
                    </td>
                    <td>{reportSchemeState}</td>
                  </tr>
                </tbody>
              </table>
            ) : null}

            {activeAnalysisTab === "清单分析" ? (
              <table className="arch-gccp-subgrid">
                <thead>
                  <tr>
                    <th>范围</th>
                    <th>清单数</th>
                    <th>合并</th>
                    <th>送审</th>
                    <th>审定</th>
                    <th>增减</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAnalysisFilter ? (
                    <tr className="is-warning-row">
                      <td colSpan={6}>
                        过滤条件已生效 · 过滤状态下不支持合并分析
                      </td>
                    </tr>
                  ) : null}
                  {(analysisMergeEnabled ? mergedAnalysisGroups : []).map(
                    (group) => (
                      <tr key={group.groupId}>
                        <td>{group.name}</td>
                        <td>{group.itemIds.length}</td>
                        <td>{group.changeMarks.join("/")}</td>
                        <td>{formatMoney(group.submittedTotal)}</td>
                        <td>{formatMoney(group.approvedTotal)}</td>
                        <td>{formatMoney(group.amountDelta)}</td>
                      </tr>
                    ),
                  )}
                  {!analysisMergeEnabled
                    ? analysisItems.slice(0, 5).map((item) => (
                        <tr key={item.itemId}>
                          <td>{item.displayName}</td>
                          <td>
                            {selectedAnalysisIds.includes(item.itemId)
                              ? "已选"
                              : "未选"}
                          </td>
                          <td>{costChangeMarkLabels[item.changeMark]}</td>
                          <td>{formatMoney(item.submittedTotal)}</td>
                          <td>{formatMoney(item.approvedTotal)}</td>
                          <td>{formatMoney(item.amountDelta)}</td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            ) : null}

            {activeAnalysisTab === "审核报告" ? (
              <>
                <div className="arch-gccp-report-toolbar">
                  <button type="button" onClick={generateReport}>
                    预览
                  </button>
                  <button
                    type="button"
                    className={reportEditMode ? "is-active" : ""}
                    onClick={() => setReportEditMode((current) => !current)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportState("已撤销上一步编辑")}
                  >
                    撤销
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportState("已重做编辑")}
                  >
                    重做
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportState("报告内容已复制")}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportState("报告内容已粘贴")}
                  >
                    粘贴
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReportZoom((current) => Math.min(current + 10, 160))
                    }
                  >
                    放大
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReportZoom((current) => Math.max(current - 10, 60))
                    }
                  >
                    缩小
                  </button>
                  <span>{reportZoom}%</span>
                  <button
                    type="button"
                    onClick={() => createReportTasks("word")}
                  >
                    Word
                  </button>
                  <button type="button" onClick={addMoreReports}>
                    更多报表
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSimpleDesign((current) => !current)}
                  >
                    简便设计
                  </button>
                  <button type="button" onClick={toggleReportWatermark}>
                    水印
                  </button>
                  <button type="button" onClick={applyReportTempEdit}>
                    临时编辑
                  </button>
                  <button type="button" onClick={applyCustomPageNumbers}>
                    页码
                  </button>
                  <button
                    type="button"
                    onClick={applyReportSchemeToUnitProjects}
                  >
                    统一替换
                  </button>
                  <button type="button" onClick={saveCurrentReportScheme}>
                    保存方案
                  </button>
                  <button type="button" onClick={loadArchivedReportScheme}>
                    载入方案
                  </button>
                  <button type="button" onClick={restoreDefaultReportScheme}>
                    恢复系统
                  </button>
                  <button
                    type="button"
                    onClick={() => runReportScheme("print")}
                  >
                    批量打印
                  </button>
                  <button type="button" onClick={submitForApproval}>
                    送审审批
                  </button>
                  <button
                    type="button"
                    onClick={() => decideReportApproval("approve")}
                  >
                    审批通过
                  </button>
                  <button
                    type="button"
                    onClick={() => decideReportApproval("reject")}
                  >
                    审批驳回
                  </button>
                  <button
                    type="button"
                    onClick={() => decideReportApproval("return")}
                  >
                    审批退回
                  </button>
                  <button type="button" onClick={signOffReport}>
                    签发
                  </button>
                  <button type="button" onClick={resubmitReportApproval}>
                    重新送审
                  </button>
                </div>
                {showSimpleDesign ? (
                  <div className="arch-gccp-report-design" data-testid="report-simple-design">
                    <table className="arch-gccp-subgrid">
                      <tbody>
                        <tr>
                          <td>页眉（中）</td>
                          <td>
                            <input
                              aria-label="页眉中部内容"
                              value={reportDesign.headerFooter.headerCenter}
                              onChange={(event) =>
                                updateReportDesignField(
                                  { headerFooter: { headerCenter: event.target.value } },
                                  "已更新页眉页脚",
                                )
                              }
                            />
                          </td>
                          <td>页脚（右）</td>
                          <td>
                            <input
                              aria-label="页脚右部内容"
                              value={reportDesign.headerFooter.footerRight}
                              onChange={(event) =>
                                updateReportDesignField(
                                  { headerFooter: { footerRight: event.target.value } },
                                  "已更新页眉页脚",
                                )
                              }
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>标题字号</td>
                          <td>
                            <input
                              aria-label="标题字号"
                              type="number"
                              value={reportDesign.titleStyle.fontSizePt}
                              onChange={(event) =>
                                updateReportDesignField(
                                  {
                                    titleStyle: {
                                      fontSizePt: Number(event.target.value) || 16,
                                    },
                                  },
                                  "已更新标题样式",
                                )
                              }
                            />
                          </td>
                          <td>表眉字号</td>
                          <td>
                            <input
                              aria-label="表眉字号"
                              type="number"
                              value={reportDesign.tableHeadStyle.fontSizePt}
                              onChange={(event) =>
                                updateReportDesignField(
                                  {
                                    tableHeadStyle: {
                                      fontSizePt: Number(event.target.value) || 10,
                                    },
                                  },
                                  "已更新表眉样式",
                                )
                              }
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>表头列设置</td>
                          <td colSpan={3}>
                            {reportDesign.columns.map((column) => (
                              <label key={column.columnId} style={{ marginRight: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={column.visible}
                                  onChange={(event) =>
                                    toggleReportColumn(
                                      column.columnId,
                                      event.target.checked,
                                    )
                                  }
                                />
                                {column.label}
                              </label>
                            ))}
                          </td>
                        </tr>
                        <tr>
                          <td>实时预览</td>
                          <td colSpan={3}>
                            <div>页眉：{reportDesignPreview.headerLine || "（空）"}</div>
                            <div>页脚：{reportDesignPreview.footerLine || "（空）"}</div>
                            <div>标题样式：{reportDesignPreview.titleSample}</div>
                            <div>水印：{reportDesignPreview.watermarkLabel}</div>
                            {reportDesignPreview.issues.map((issue) => (
                              <div key={issue} role="alert">
                                ⚠ {issue}
                              </div>
                            ))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <table className="arch-gccp-subgrid">
                  <tbody>
                    <tr>
                      <td>报告状态</td>
                      <td>{reportState}</td>
                      <td>选中清单</td>
                      <td>{selectedAnalysisIds.length}</td>
                    </tr>
                    <tr>
                      <td>审核人</td>
                      <td>{reportMetadata.reviewer}</td>
                      <td>任务</td>
                      <td>
                        {reportTasks.map((task) => task.format).join(", ") ||
                          "未创建"}
                      </td>
                    </tr>
                    <tr>
                      <td>报表方案</td>
                      <td>{reportScheme.name}</td>
                      <td>方案状态</td>
                      <td>{reportSchemeState}</td>
                    </tr>
                    <tr>
                      <td>导出设置</td>
                      <td>{describeReportWatermark(reportDesign.watermark)}</td>
                      <td>页码</td>
                      <td>{reportScheme.exportSettings.pageNumberMode}</td>
                    </tr>
                    <tr>
                      <td>报表设计</td>
                      <td>{reportDesignPreview.titleSample}</td>
                      <td>临时编辑</td>
                      <td>{reportTempEditState}</td>
                    </tr>
                    <tr>
                      <td>审批流</td>
                      <td>
                        {approvalRecord
                          ? `${approvalRecord.professionalRole} · ${costApprovalStatusLabels[approvalRecord.status]}`
                          : "未发起"}
                      </td>
                      <td>报告出具状态</td>
                      <td>{costReportOutputStateLabels[reportOutputState]}</td>
                    </tr>
                    <tr>
                      <td>审批意见</td>
                      <td colSpan={3}>{approvalMessage}</td>
                    </tr>
                    <tr>
                      <td>报告章节</td>
                      <td>
                        {reportPreview?.sections
                          .map((section) => section.title)
                          .join(" / ") ?? "待生成"}
                      </td>
                      <td>状态</td>
                      <td>
                        {reportPreview?.outputState ??
                          "professional_review_required"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {assistantVisible ? (
        <aside className="arch-gccp-assistant-strip">
          <span>造价助手</span>
          <span>
            清单 {analysisItems.length} 项 · 已选 {selectedAnalysisIds.length}{" "}
            项 · 来源待复核 {phase2ReviewCount} 组
          </span>
          <button
            type="button"
            onClick={() =>
              setReportMetadata((current) => ({
                ...current,
                reviewer: "注册造价工程师复核中",
              }))
            }
          >
            标记复核中
          </button>
        </aside>
      ) : null}

      {contextMenu ? (
        <CostingBusinessContextMenu
          item={
            dashboard.computedItems.find(
              (item) => item.itemId === contextMenu.itemId,
            ) ?? selectedItem
          }
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={runCostingContextAction}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <footer className="arch-gccp-statusbar">
        <span>清单工程量差=审定工程量-送审工程量</span>
        <span>
          转换: {conversionState} · 报告: {reportState}
        </span>
        <span>
          措施 {measureItems.length} 项 · 其他 {otherItems.length} 项 · 费用{" "}
          {feeSummary.length} 项
        </span>
        <span>待来源复核 {phase2ReviewCount} 组</span>
        <span>数据服务: {backendState}</span>
        <span>自动保存: {autoSaveState}</span>
        <span>导入/载价: {registryImportState}</span>
        <span>100%</span>
      </footer>

      {newProjectDialogOpen ? (
        <div
          role="dialog"
          aria-label="新建工程"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}
          onClick={() => setNewProjectDialogOpen(false)}
        >
          <div
            className="arch-gccp-new-project-dialog"
            style={{
              minWidth: "420px",
              background: "var(--arch-surface, #fff)",
              border: "1px solid var(--arch-border, #ddd)",
              borderRadius: "6px",
              padding: "1.2rem",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.8rem", fontSize: "15px" }}>
              新建空白造价工程
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
            >
              <label style={{ fontSize: "12px" }}>
                工程名称
                <input
                  className="arch-gccp-cell-editor"
                  autoFocus
                  style={{ width: "100%", marginTop: "0.2rem" }}
                  value={newProjectForm.name}
                  placeholder="例如：锦屏应舍美居重钢样板工程"
                  onChange={(event) =>
                    setNewProjectForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={{ fontSize: "12px" }}>
                地区（行政区划代码）
                <input
                  className="arch-gccp-cell-editor"
                  style={{ width: "100%", marginTop: "0.2rem" }}
                  value={newProjectForm.jurisdiction}
                  placeholder="CN-SC（四川）"
                  onChange={(event) =>
                    setNewProjectForm((current) => ({
                      ...current,
                      jurisdiction: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={{ fontSize: "12px" }}>
                首个单位工程名称
                <input
                  className="arch-gccp-cell-editor"
                  style={{ width: "100%", marginTop: "0.2rem" }}
                  value={newProjectForm.unitProjectName}
                  onChange={(event) =>
                    setNewProjectForm((current) => ({
                      ...current,
                      unitProjectName: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={{ fontSize: "12px" }}>
                专业
                <input
                  className="arch-gccp-cell-editor"
                  style={{ width: "100%", marginTop: "0.2rem" }}
                  value={newProjectForm.specialty}
                  onChange={(event) =>
                    setNewProjectForm((current) => ({
                      ...current,
                      specialty: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              <button
                type="button"
                onClick={() => setNewProjectDialogOpen(false)}
              >
                取消
              </button>
              <button type="button" onClick={() => void createBlankProject()}>
                创建并开始录入
              </button>
            </div>
            <p
              style={{
                margin: "0.8rem 0 0",
                fontSize: "11px",
                color: "var(--arch-text-muted, #888)",
              }}
            >
              创建后从空白结构树开始，逐条录入或从 IFC
              模型反查工程量；编辑自动保存到数据库（标准 GB/T50500-2024）。
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CostingBusinessContextMenu({
  item,
  x,
  y,
  onAction,
  onClose,
}: {
  item: ComputedCostBoqItem | undefined;
  x: number;
  y: number;
  onAction: (action: CostingContextAction) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actions: Array<{
    id: CostingContextAction;
    label: string;
    danger?: boolean;
  }> = [
    { id: "check", label: "勾选进入报告范围" },
    { id: "uncheck", label: "取消勾选" },
    { id: "batch_top50", label: "批量勾选金额占比前50%" },
    { id: "export_excel", label: "导出到Excel文件" },
    { id: "copy_cell", label: "复制单元格" },
    { id: "locate_project", label: "定位到工程" },
    { id: "clear_filter", label: "取消过滤" },
    { id: "merge_analysis", label: "合并分析" },
    { id: "unmerge_analysis", label: "取消合并" },
    { id: "edit_quantity", label: "编辑审定工程量" },
    { id: "edit_price", label: "编辑审定综合单价" },
    { id: "convert_to_approved", label: "送审数据同步到审定" },
    { id: "convert_to_submitted", label: "审定数据回写送审" },
    { id: "detail_compare", label: "查看详细对比" },
    { id: "quantity_detail", label: "查看工程量明细" },
    { id: "mark_review", label: "标记待复核" },
    { id: "edit_reason", label: "编辑增减说明" },
    { id: "clear_reasons", label: "批量删除自动增减说明" },
    { id: "report", label: "生成单项审核报告" },
    { id: "clear_approved", label: "删除审定行", danger: true },
  ];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="arch-gccp-context-menu"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="arch-gccp-context-title">
        <span>{item?.displayName ?? "清单项"}</span>
        <span>{item?.displayCode ?? "待编码"}</span>
      </div>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={action.danger ? "is-danger" : ""}
          onClick={() => onAction(action.id)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function collectCostingNodeScope(
  nodes: QuantityCostingProject["treeNodes"],
  nodeId: string,
) {
  const scoped = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (
        node.parentId &&
        scoped.has(node.parentId) &&
        !scoped.has(node.nodeId)
      ) {
        scoped.add(node.nodeId);
        changed = true;
      }
    }
  }
  if (!nodes.some((node) => node.nodeId === nodeId)) {
    return new Set(nodes.map((node) => node.nodeId));
  }
  return scoped;
}

function isCostingEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

function summarizeVisibleCostItems(items: ComputedCostBoqItem[]): CostSummary {
  const markCounts: Record<CostChangeMark, number> = {
    none: 0,
    add: 0,
    delete: 0,
    modify: 0,
    temporary: 0,
  };
  for (const item of items) {
    markCounts[item.changeMark] += 1;
  }
  return {
    submittedTotal: roundMoney(
      items.reduce((sum, item) => sum + item.submittedTotal, 0),
    ),
    approvedTotal: roundMoney(
      items.reduce((sum, item) => sum + item.approvedTotal, 0),
    ),
    amountDelta: roundMoney(
      items.reduce((sum, item) => sum + item.amountDelta, 0),
    ),
    increaseAmount: roundMoney(
      items.reduce((sum, item) => sum + item.increaseAmount, 0),
    ),
    decreaseAmount: roundMoney(
      items.reduce((sum, item) => sum + item.decreaseAmount, 0),
    ),
    sourceReviewCount: items.filter((item) => item.sourceReviewRequired).length,
    markCounts,
  };
}

function formatRate(value: number) {
  return `${roundMoney(value * 100)}%`;
}

function otherItemTypeLabel(value: CostOtherItem["otherType"]) {
  if (value === "provisional_sum") return "暂列金额";
  if (value === "daywork") return "计日工";
  return "总承包服务费";
}

function reportSourceLabel(name: string) {
  if (name.includes("分部分项")) return "分部分项";
  if (name.includes("措施")) return "措施项目";
  if (name.includes("其他")) return "其他项目";
  if (name.includes("费用")) return "费用汇总";
  if (name.includes("认证") || name.includes("审核")) return "审核报告";
  if (name.includes("增减")) return "分析与报告";
  return "报表方案";
}

function componentTypeLabel(
  value: ReturnType<
    typeof calculateQuotaUnitPrice
  >["components"][number]["componentType"],
) {
  if (value === "labor") return "人工";
  if (value === "material") return "材料";
  if (value === "machine") return "机械";
  if (value === "management") return "管理费";
  if (value === "profit") return "利润";
  if (value === "risk") return "风险";
  if (value === "tax") return "税金";
  return "费用";
}

function ProductionControl({
  onAudit,
}: {
  onAudit: (summary: string) => void;
}) {
  const [workOrderState, setWorkOrderState] = useState("排产中");
  const [cncState, setCncState] = useState("未生成");
  const [qcState, setQcState] = useState("待检");
  const [shipmentState, setShipmentState] = useState("待包装");
  const [paperclipState, setPaperclipState] = useState("v2026.517.0 已接入");

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <ActionTile
        icon={<Factory className="h-5 w-5" />}
        title="工单状态"
        value={workOrderState}
        onClick={() => {
          setWorkOrderState("已下发 MES");
          onAudit("生产制造: 工单状态切换为已下发 MES");
        }}
      />
      <ActionTile
        icon={<FileCog className="h-5 w-5" />}
        title="CNC 文件"
        value={cncState}
        onClick={() => {
          setCncState("NC/DXF 已生成");
          onAudit("生产制造: 已生成 CNC/数控文件");
        }}
      />
      <ActionTile
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="质检状态"
        value={qcState}
        onClick={() => {
          setQcState("焊接/涂装复检通过");
          onAudit("生产制造: 质检状态更新为通过");
        }}
      />
      <ActionTile
        icon={<Truck className="h-5 w-5" />}
        title="发运批次"
        value={shipmentState}
        onClick={() => {
          setShipmentState("PKG-RF-07 已发运");
          onAudit("生产制造: 发运批次已安排");
        }}
      />
      <ActionTile
        icon={<Workflow className="h-5 w-5" />}
        title="Paperclip编排"
        value={paperclipState}
        onClick={() => {
          setPaperclipState("已同步 heartbeat / budget / issue");
          onAudit("生产制造: Paperclip v2026.517.0 编排状态已同步到审计链");
        }}
      />
    </div>
  );
}

function ConstructionControl({
  onAudit,
}: {
  onAudit: (summary: string) => void;
}) {
  const [safetyIssues, setSafetyIssues] = useState(6);
  const [rectification, setRectification] = useState("11 单 · 81% 闭环");
  const [logState, setLogState] = useState("今日未生成");
  const [record, setRecord] = useState("AR");

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1.1fr_1fr]">
      <ActionTile
        icon={<ShieldAlert className="h-5 w-5" />}
        title="安全问题"
        value={`${safetyIssues} 项`}
        onClick={() => {
          setSafetyIssues((current) => current + 1);
          onAudit("施工管理: 已创建安全问题和整改责任");
        }}
      />
      <ActionTile
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="整改闭环"
        value={rectification}
        onClick={() => {
          setRectification("12 单 · 86% 闭环");
          onAudit("施工管理: 整改闭环状态更新");
        }}
      />
      <ActionTile
        icon={<FileCog className="h-5 w-5" />}
        title="日志生成"
        value={logState}
        onClick={() => {
          setLogState("施工日志已生成");
          onAudit("施工管理: 已生成施工日志");
        }}
      />
      <div className="rounded-lg border border-cyan-200/14 bg-slate-950/52 p-4 lg:col-span-3">
        <h3 className="text-xl font-medium">AR / 360 / 扫描记录选择</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {["AR", "360 全景", "三维扫描", "倾斜摄影", "无人机"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setRecord(item);
                onAudit(`施工管理: 选择 ${item} 证据记录`);
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                record === item
                  ? "border-cyan-200 bg-cyan-300 text-slate-950"
                  : "border-cyan-200/12 bg-white/[0.045]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MaterialLogisticsControl({
  onAudit,
}: {
  onAudit: (summary: string) => void;
}) {
  const [inventory, setInventory] = useState("红区 3 类");
  const [purchase, setPurchase] = useState("采购计划待生成");
  const [cutting, setCutting] = useState("下料单待生成");
  const [receipt, setReceipt] = useState("8 包待签收");

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <ActionTile
        icon={<Boxes className="h-5 w-5" />}
        title="库存状态"
        value={inventory}
        onClick={() => {
          setInventory("已锁定 Q355B 批次");
          onAudit("材料物流: 库存状态已更新");
        }}
      />
      <ActionTile
        icon={<PackageCheck className="h-5 w-5" />}
        title="采购计划"
        value={purchase}
        onClick={() => {
          setPurchase("5 批采购计划已生成");
          onAudit("材料物流: 采购计划已生成");
        }}
      />
      <ActionTile
        icon={<FileCog className="h-5 w-5" />}
        title="下料单"
        value={cutting}
        onClick={() => {
          setCutting("312 条下料单已生成");
          onAudit("材料物流: 下料单已生成");
        }}
      />
      <ActionTile
        icon={<Truck className="h-5 w-5" />}
        title="物流签收"
        value={receipt}
        onClick={() => {
          setReceipt("PKG-RF-07 已签收");
          onAudit("材料物流: 批次签收状态已更新");
        }}
      />
    </div>
  );
}

function ActionTile({
  icon,
  title,
  value,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4 text-left text-[var(--arch-text)] shadow-sm transition hover:border-[var(--module-accent)] hover:bg-[var(--module-accent-soft)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--module-accent-soft)] text-[var(--module-accent)]">
        {icon}
      </span>
      <span className="mt-3 block text-lg font-medium">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-[var(--arch-text-muted)]">
        {value}
      </span>
    </button>
  );
}

function ControlBox({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--arch-border)] bg-[var(--arch-surface)] p-4 text-[var(--arch-text)] shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <span className="text-[var(--module-accent)]">{icon}</span>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-[var(--module-accent-soft)] bg-[var(--module-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--module-accent)]">
      {label}: {value}
    </span>
  );
}

function featureStatusClass(status: ModuleFeatureCard["status"]) {
  if (status === "blocked") {
    return "bg-red-50 text-red-700";
  }
  if (status === "review") {
    return "bg-amber-50 text-amber-700";
  }
  if (status === "running") {
    return "bg-[var(--module-accent-soft)] text-[var(--module-accent)]";
  }
  return "bg-emerald-50 text-emerald-700";
}
