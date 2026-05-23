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
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  api,
  type QuantityCostingOverview,
  type QuantityCostingSnapshotPayload,
  type QuantityCostingSnapshotResponse,
} from "@/lib/api";
import { getBackendRequestContext } from "@/lib/backend-api";
import type { ModuleActionResult } from "@/lib/module-actions";
import { createModuleAuditEvent } from "@/lib/module-actions";
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
  calculateCostingDashboard,
  calculateFeeSummaryItem,
  calculateMeasureItem,
  calculateOtherItem,
  calculateQuotaUnitPrice,
  convertBoqItemData,
  costChangeMarkLabels,
  createNextReviewVersion,
  formatMoney,
  generateReviewReportSnapshot,
  quantityCostingPhase1Project,
  quantityCostingPhase2FeeRules,
  quantityCostingPhase2MeasureItems,
  quantityCostingPhase2OtherItems,
  quantityCostingPhase2Registry,
  roundMoney,
  roundQuantity,
  selectCostItemsByDeltaShare,
  type ComputedCostBoqItem,
  type CostChangeMark,
  type CostFeeRule,
  type CostMeasureItem,
  type CostOtherItem,
  type CostSummary,
  type QuantityCostingBoqItem,
  type QuantityCostingProject,
} from "@/lib/quantity-costing";

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

  function emit(summary: string) {
    onAudit?.(
      createModuleAuditEvent(
        `${spec.id}-operation`,
        "ModuleOperationalPanel",
        summary,
      ),
    );
  }

  function selectFeature(feature: ModuleFeatureCard) {
    setSelectedFeatureId(feature.id);
    emit(`${spec.zhName}: 打开功能 ${feature.title}`);
  }

  function runOperation(operation: ModuleOperationButton) {
    setOperationStates((current) => ({
      ...current,
      [operation.id]: `已执行 · ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`,
    }));
    emit(`${spec.zhName}: ${operation.result}`);
  }

  if (spec.id === "quantity_costing") {
    return <QuantityCostingControl onAudit={emit} />;
  }

  return (
    <section className="rounded-lg border border-cyan-200/18 bg-[#071523] p-4 text-white shadow-[0_18px_70px_rgba(2,6,23,0.32)]">
      <div className="flex flex-col gap-3 border-b border-cyan-200/10 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[10px] text-cyan-200/64">
            Functional system
          </p>
          <h2 className="mt-1 text-3xl font-medium">{profile.title}</h2>
          <p className="mt-2 max-w-5xl text-sm leading-7 text-cyan-50/68">
            {profile.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.statusTracks.map((track) => (
            <span
              key={track}
              className="rounded-full border border-cyan-200/16 bg-cyan-300/8 px-3 py-1 text-xs font-medium text-cyan-100"
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
                    ? "border-cyan-200/70 bg-cyan-300/14 shadow-[0_0_28px_rgba(34,211,238,0.18)]"
                    : "border-cyan-200/12 bg-white/[0.045] hover:border-cyan-200/36 hover:bg-cyan-300/8"
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
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-cyan-50/62">
                  {feature.description}
                </p>
                <p className="mt-3 text-xs text-cyan-200/70">
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
          <div className="rounded-lg border border-cyan-200/14 bg-slate-950/52 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] text-cyan-200/58">
                  Selected function
                </p>
                <h3 className="mt-1 text-2xl font-medium">
                  {selectedFeature?.title}
                </h3>
              </div>
              <CircleDot className="h-5 w-5 text-cyan-200" />
            </div>
            <p className="mt-3 text-sm leading-7 text-cyan-50/68">
              {selectedFeature?.description}
            </p>
            <div className="mt-4 grid gap-2">
              {selectedFeature?.metrics.map((metric) => (
                <div
                  key={metric}
                  className="rounded-lg border border-cyan-200/12 bg-white/[0.045] px-3 py-2 text-sm text-cyan-50/78"
                >
                  {metric}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-200/14 bg-slate-950/52 p-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-cyan-200" />
              <h3 className="text-xl font-medium">操作按钮区</h3>
            </div>
            <div className="mt-3 space-y-2">
              {profile.operations.map((operation) => (
                <button
                  key={operation.id}
                  type="button"
                  onClick={() => runOperation(operation)}
                  className="w-full rounded-lg border border-cyan-200/14 bg-cyan-300/10 px-3 py-3 text-left transition hover:border-cyan-200/50 hover:bg-cyan-300/18"
                >
                  <span className="block text-sm font-medium text-white">
                    {operation.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-cyan-50/58">
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
  | "edit_quantity"
  | "edit_price"
  | "convert_to_approved"
  | "convert_to_submitted"
  | "detail_compare"
  | "quantity_detail"
  | "mark_review"
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
  const [boqOverrides, setBoqOverrides] = useState<
    Record<string, QuantityCostingBoqItem>
  >({});
  const [activeMainNav, setActiveMainNav] = useState<CostingMainNav>("审核");
  const [activeBudgetTab, setActiveBudgetTab] =
    useState<CostingBudgetTab>("分部分项");
  const [activeDetailTab, setActiveDetailTab] =
    useState<CostingDetailTab>("工程量明细");
  const sourceCostProject = backendSnapshot
    ? quantitySnapshotToProject(backendSnapshot)
    : quantityCostingPhase1Project;
  const activeCostProject: QuantityCostingProject = {
    ...sourceCostProject,
    boqItems: sourceCostProject.boqItems.map(
      (item) => boqOverrides[item.itemId] ?? item,
    ),
  };
  const dashboard = calculateCostingDashboard(activeCostProject);
  const quotaBreakdown = calculateQuotaUnitPrice(
    quantityCostingPhase2Registry,
    "quota-steel-member-demo",
  );
  const measureItems = quantitySnapshotMeasureItems(backendSnapshot).map(
    (item) => calculateMeasureItem(item),
  );
  const otherItems = quantitySnapshotOtherItems(backendSnapshot).map((item) =>
    calculateOtherItem(item),
  );
  const feeSummary = quantitySnapshotFeeRules(backendSnapshot).map((rule) =>
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
  const visibleSummary = summarizeVisibleCostItems(visibleItems);
  const selectedItem =
    dashboard.computedItems.find((item) => item.itemId === selectedItemId) ??
    visibleItems[0] ??
    dashboard.computedItems[0];
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
        changeReason: item.autoChangeReason,
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
    try {
      const saved = await api.quantityCosting.saveSnapshot(projectId, payload);
      const [overview, snapshot] = await Promise.all([
        api.quantityCosting.overview(projectId),
        api.quantityCosting.latestSnapshot(projectId),
      ]);
      setBackendOverview(overview);
      setBackendSnapshot(snapshot);
      setBackendState(snapshot ? "已保存 · 已反显" : "已保存");
      onAudit(
        `计量造价: 保存编审快照 清单${saved.boqItemCount}项 措施${saved.measureItemCount}项`,
      );
    } catch {
      setBackendState("保存失败 · 使用样例");
      onAudit("计量造价: 保存编审快照失败,继续使用前端样例");
    }
  }

  function createReview() {
    const next = createNextReviewVersion(
      { ...activeCostProject, versions: activeReviewVersions },
      `第${reviewRoundCount + 1}审`,
    );
    setReviewVersions((current) => [...current, next]);
    setActiveMainNav("审核");
    setActiveBudgetTab("分部分项");
    onAudit(`计量造价: 新建审核版本 ${next.description}`);
  }

  function importApproved() {
    setActiveMainNav("审核");
    setActiveBudgetTab("分部分项");
    setConversionState("已导入审定 · 名称匹配 4 项 · 手动匹配 1 项");
    onAudit("计量造价: 导入审定并完成工程结构匹配");
  }

  function convertSelected() {
    if (!selectedItem) {
      return;
    }
    const result = convertBoqItemData(selectedItem, "submitted_to_approved");
    if (result.blockedReason) {
      setConversionState(result.blockedReason);
      onAudit(`计量造价: 数据转换被阻止 · ${result.blockedReason}`);
      return;
    }
    setBoqOverrides((current) => ({
      ...current,
      [selectedItem.itemId]: result.item,
    }));
    setActiveBudgetTab("分部分项");
    setActiveDetailTab("换算信息");
    setConversionState(`${selectedItem.displayName}: 送审数据已同步到审定`);
    onAudit(`计量造价: ${selectedItem.displayName} 执行送审到审定转换`);
  }

  function selectTopAnalysisRows() {
    const ids = selectCostItemsByDeltaShare(visibleItems, 50);
    setSelectedAnalysisIds(ids);
    setActiveMainNav("审核");
    setActiveBudgetTab("分部分项");
    setActiveDetailTab("详细对比");
    onAudit(`计量造价: 清单分析按增减金额占比前50%勾选 ${ids.length} 项`);
  }

  function generateReport() {
    const ids =
      selectedAnalysisIds.length > 0
        ? selectedAnalysisIds
        : selectCostItemsByDeltaShare(visibleItems, 50);
    const report = generateReviewReportSnapshot(activeCostProject, ids);
    setSelectedAnalysisIds(ids);
    setActiveMainNav("报表");
    setActiveBudgetTab("报表");
    setReportState(
      `${report.selectedCount} 项 · 增减 ${formatMoney(report.amountDelta)} · 待专业复核`,
    );
    onAudit(`计量造价: 生成审核报告草稿,状态 ${report.outputState}`);
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
      sourceCostProject.boqItems.find((item) => item.itemId === itemId);
    if (!sourceItem) {
      setConversionState("未找到当前清单项，修改未执行。");
      return;
    }
    setBoqOverrides((current) => ({
      ...current,
      [itemId]: updater(current[itemId] ?? sourceItem),
    }));
    setSelectedItemId(itemId);
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
        <div className="arch-gccp-search">本地标准库 · {backendState}</div>
      </div>

      <div className="arch-gccp-ribbon">
        <button type="button" onClick={createReview}>
          <FileCog className="h-4 w-4" />
          新建审核
        </button>
        <button type="button" onClick={importApproved}>
          <CheckCircle2 className="h-4 w-4" />
          导入审定
        </button>
        <button type="button" onClick={convertSelected}>
          <Workflow className="h-4 w-4" />
          数据转换
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
        <button type="button" onClick={() => selectBudgetTab("取费设置")}>
          <Layers3 className="h-4 w-4" />
          费用设置
        </button>
        <button type="button" onClick={() => selectMainNav("质控")}>
          <Activity className="h-4 w-4" />
          校验检查
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

      <div className="arch-gccp-body">
        <aside className="arch-gccp-project-tree">
          <div className="arch-gccp-tree-path">单项工程 &gt; 单位工程</div>
          <div className="arch-gccp-tree-tabs">
            <button type="button" className="is-active">
              项目结构
            </button>
            <button type="button">快速查询</button>
          </div>
          <div className="arch-gccp-tree-tools">
            <span>新建</span>
            <span>文件合并</span>
            <span>↑</span>
            <span>↓</span>
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
            <button type="button" onClick={selectTopAnalysisRows}>
              筛选
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
            <span>
              送审 {formatMoney(visibleSummary.submittedTotal)} · 审定{" "}
              {formatMoney(visibleSummary.approvedTotal)} · 入库送审{" "}
              {formatMoney(persistedSubmittedTotal)} · 入库审定{" "}
              {formatMoney(persistedApprovedTotal)}
            </span>
          </div>

          <div className="arch-gccp-grid-wrap">
            {activeBudgetTab === "工程概况" ? (
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
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th rowSpan={2}>序</th>
                    <th rowSpan={2}>标记</th>
                    <th rowSpan={2}>编码</th>
                    <th rowSpan={2}>类别</th>
                    <th rowSpan={2}>名称</th>
                    <th rowSpan={2}>项目特征</th>
                    <th rowSpan={2}>单位</th>
                    <th colSpan={3}>送审</th>
                    <th colSpan={3}>审定</th>
                    <th colSpan={4}>增减</th>
                    <th rowSpan={2}>来源</th>
                  </tr>
                  <tr>
                    <th>工程量</th>
                    <th>综合单价</th>
                    <th>综合合价</th>
                    <th>工程量</th>
                    <th>综合单价</th>
                    <th>综合合价</th>
                    <th>工程量差</th>
                    <th>核增</th>
                    <th>核减</th>
                    <th>增减说明</th>
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
                      <td>{item.autoChangeReason}</td>
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
                      <td>{item.sourceRef || "待来源复核"}</td>
                    </tr>
                  ))}
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
                  {[
                    [
                      "1",
                      "编码校验",
                      `${visibleItems.length} 条清单`,
                      "通过",
                      "已检查",
                      activeCostProject.standardProfileId,
                    ],
                    [
                      "2",
                      "来源校验",
                      `${phase2ReviewCount} 组来源待复核`,
                      phase2ReviewCount > 0 ? "待复核" : "通过",
                      "待处理",
                      "国家/地方标准定额",
                    ],
                    [
                      "3",
                      "增减复核",
                      `${selectedAnalysisIds.length} 项已勾选`,
                      "需专业判断",
                      "审核中",
                      "编审差异规则",
                    ],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${row[0]}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {activeBudgetTab === "报表" ? (
              <table className="arch-gccp-grid">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>报表名称</th>
                    <th>数据来源</th>
                    <th>状态</th>
                    <th>送审合计</th>
                    <th>审定合计</th>
                    <th>增减金额</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "1",
                      "分部分项工程量清单与计价表",
                      "分部分项",
                      reportState,
                    ],
                    ["2", "措施项目清单与计价表", "措施项目", "待生成"],
                    ["3", "审核报告", "分析与报告", reportState],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                      <td>{formatMoney(dashboard.summary.submittedTotal)}</td>
                      <td>{formatMoney(dashboard.summary.approvedTotal)}</td>
                      <td>{formatMoney(dashboard.summary.amountDelta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

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
                      <th>类别</th>
                      <th>名称</th>
                      <th>含量/基数</th>
                      <th>费率</th>
                      <th>金额</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotaBreakdown.components
                      .filter(
                        (item) =>
                          activeDetailTab === "单价构成" ||
                          ["labor", "material", "machine"].includes(
                            item.componentType,
                          ),
                      )
                      .map((item) => (
                        <tr key={item.componentId}>
                          <td>{componentTypeLabel(item.componentType)}</td>
                          <td>{item.name}</td>
                          <td>{item.baseAmount}</td>
                          <td>
                            {item.rate === null ? "-" : formatRate(item.rate)}
                          </td>
                          <td>{formatMoney(item.amount)}</td>
                          <td>{item.sourceRef || "待来源复核"}</td>
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
                      <tr>
                        <td>计算结果</td>
                        <td>{selectedItem?.submittedQty ?? 0}</td>
                        <td>
                          {selectedItem?.submittedQty ?? 0}{" "}
                          {selectedItem?.qtyDelta
                            ? `${selectedItem.qtyDelta > 0 ? "+" : ""}${selectedItem.qtyDelta}`
                            : ""}
                        </td>
                        <td>{selectedItem?.approvedQty ?? 0}</td>
                        <td>✓</td>
                        <td>{selectedItem?.ruleId}</td>
                      </tr>
                      <tr>
                        <td>清单增减金额</td>
                        <td>
                          {formatMoney(selectedItem?.submittedTotal ?? 0)}
                        </td>
                        <td>{formatMoney(selectedItem?.approvedTotal ?? 0)}</td>
                        <td>{formatMoney(selectedItem?.amountDelta ?? 0)}</td>
                        <td>
                          {selectedItem?.sourceReviewRequired ? "复核" : "通过"}
                        </td>
                        <td>{selectedItem?.sourceRef}</td>
                      </tr>
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
                      <tr>
                        <td>JZMJ</td>
                        <td>建筑面积</td>
                        <td>m2</td>
                        <td>{activeCostProject.treeNodes.length * 1000}</td>
                      </tr>
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
        <span>100%</span>
      </footer>
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
    { id: "edit_quantity", label: "编辑审定工程量" },
    { id: "edit_price", label: "编辑审定综合单价" },
    { id: "convert_to_approved", label: "送审数据同步到审定" },
    { id: "convert_to_submitted", label: "审定数据回写送审" },
    { id: "detail_compare", label: "查看详细对比" },
    { id: "quantity_detail", label: "查看工程量明细" },
    { id: "mark_review", label: "标记待复核" },
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
      className="rounded-lg border border-cyan-200/14 bg-slate-950/52 p-4 text-left transition hover:border-cyan-200/48 hover:bg-cyan-300/10"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-200">
        {icon}
      </span>
      <span className="mt-3 block text-lg font-medium text-white">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-cyan-50/68">
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
    <div className="rounded-lg border border-cyan-200/14 bg-slate-950/52 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <span className="text-cyan-200">{icon}</span>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-cyan-200/16 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
      {label}: {value}
    </span>
  );
}

function featureStatusClass(status: ModuleFeatureCard["status"]) {
  if (status === "blocked") {
    return "bg-red-400/14 text-red-200";
  }
  if (status === "review") {
    return "bg-amber-300/14 text-amber-200";
  }
  if (status === "running") {
    return "bg-cyan-300/14 text-cyan-100";
  }
  return "bg-emerald-300/14 text-emerald-200";
}
