"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
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

const MODULE_FLOW_ORDER: ReadonlyArray<ModuleId> = [
  "marketing_service",
  "planning_management",
  "concept_design",
  "standard_library",
  "detailed_design",
  "quantity_costing",
  "material_logistics",
  "production_manufacturing",
  "construction_management",
  "digital_twin",
  "digital_archive",
  "finance_hr",
  "ai_center",
  "settings_center",
];

const MODULE_LABELS = {
  marketing_service: "市场客服",
  planning_management: "计划管理",
  concept_design: "方案设计",
  standard_library: "标准族库",
  detailed_design: "深化设计",
  quantity_costing: "计量造价",
  material_logistics: "材料物流",
  production_manufacturing: "生产制造",
  construction_management: "施工管理",
  digital_twin: "数字孪生",
  digital_archive: "数字档案",
  finance_hr: "财务人力",
  ai_center: "AI中心",
  settings_center: "设置中心",
} satisfies Record<ModuleId, string>;

interface ModuleFlowCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly primaryAction: string;
  readonly artifactPrefix: string;
  readonly flowSteps: readonly string[];
  readonly outputName: string;
  readonly dataObjects: readonly string[];
}

const MODULE_COPY = {
  marketing_service: {
    eyebrow: "INSOME LEAD INTAKE",
    title: "市场客服 · 线索到方案入口",
    description: "把客户需求、预算和房型意向直接生成可进入方案设计的 INSOME Floorplan 数据。",
    primaryAction: "生成客服方案草案",
    artifactPrefix: "marketing-intake",
    outputName: "客户需求包 / 方案线索",
    dataObjects: ["客户画像", "预算区间", "房型意向", "预约证据"],
    flowSteps: ["客户需求录入", "INSOME 生成户型候选", "形成需求包", "流转到计划和方案"],
  },
  planning_management: {
    eyebrow: "INSOME PROJECT FLOW",
    title: "计划管理 · 立项/WBS/资源基线",
    description: "把 INSOME 方案候选转成项目令牌、WBS、周期、资源和审批计划，连接后续设计、采购、生产、施工。",
    primaryAction: "生成项目计划基线",
    artifactPrefix: "planning-baseline",
    outputName: "WBS / 里程碑 / 资源计划",
    dataObjects: ["项目编码", "WBS", "里程碑", "资源矩阵"],
    flowSteps: ["机会转项目", "生成 WBS/CBS/RACI", "绑定周期与资源", "推送审批计划"],
  },
  concept_design: {
    eyebrow: "INSOME CONCEPT STUDIO",
    title: "方案设计 · 在线平面与方案编辑",
    description: "使用 INSOME 的户型生成、约束检查、估算和可视化组件承接方案设计模块。",
    primaryAction: "生成方案比选",
    artifactPrefix: "concept-design",
    outputName: "方案模型 / 平面图 / 比选记录",
    dataObjects: ["Floorplan", "面积指标", "约束检查", "方案版本"],
    flowSteps: ["承接需求包", "生成平面和体量候选", "做可建造性初筛", "交付深化设计"],
  },
  standard_library: {
    eyebrow: "INSOME STANDARD PACK",
    title: "标准族库 · 规范/构件/IDS 规则接入",
    description: "把方案模型映射到企业标准、构件族库、IFC/IDS/BCF 和审批规则，形成后续设计校验基线。",
    primaryAction: "生成标准校核包",
    artifactPrefix: "standard-pack",
    outputName: "标准包 / 构件族 / IDS 规则",
    dataObjects: ["设计规范", "构件族", "IDS", "BCF"],
    flowSteps: ["读取方案对象", "匹配标准和族库", "生成 IDS/BCF 校核项", "回写规则证据"],
  },
  detailed_design: {
    eyebrow: "INSOME DETAIL DESIGN",
    title: "深化设计 · BIM/IFC/施工图深化",
    description: "把 INSOME 平面和方案 Token 转成深化模型、钢构专项、机电综合、围护消防和现场装配交付清单。",
    primaryAction: "生成深化任务包",
    artifactPrefix: "detail-design",
    outputName: "深化模型 / 图纸包 / 审签记录",
    dataObjects: ["IFC", "深化图纸", "碰撞问题", "审签状态"],
    flowSteps: ["接收方案模型", "拆解专业图纸包", "生成碰撞/审签任务", "冻结生产输入"],
  },
  quantity_costing: {
    eyebrow: "INSOME BOQ COSTING",
    title: "计量造价 · MTO/BOQ/变更估算",
    description: "从方案和深化对象提取工程量、价格快照、合同边界和变更影响，形成可追溯成本基线。",
    primaryAction: "生成 BOQ 草案",
    artifactPrefix: "quantity-cost",
    outputName: "工程量 / 清单 / 成本基线",
    dataObjects: ["MTO", "BOQ", "价格快照", "变更估算"],
    flowSteps: ["读取模型对象", "提取工程量", "绑定价格和合同", "输出成本基线"],
  },
  material_logistics: {
    eyebrow: "INSOME SUPPLY FLOW",
    title: "材料物流 · 采购/批次/装车/签收",
    description: "把 BOQ 和生产包转成采购计划、材料批次、包装装车、物流到场和签收证据。",
    primaryAction: "生成材料物流包",
    artifactPrefix: "material-flow",
    outputName: "采购包 / 批次追踪 / 到货证据",
    dataObjects: ["采购计划", "炉批号", "装车单", "签收单"],
    flowSteps: ["承接 BOQ/BOM", "生成采购和补料计划", "绑定批次和二维码", "跟踪到场签收"],
  },
  production_manufacturing: {
    eyebrow: "INSOME FACTORY FLOW",
    title: "生产制造 · BOM/CNC/质检/排产",
    description: "把冻结后的深化和材料数据转成工厂 BOM、CNC 文件、排产、质检和构件状态。",
    primaryAction: "生成生产下单包",
    artifactPrefix: "factory-package",
    outputName: "BOM / CNC / 质检记录",
    dataObjects: ["BOM", "CNC", "排产单", "质检批次"],
    flowSteps: ["接收冻结图纸", "生成 BOM 和 CNC", "安排生产批次", "回写质检状态"],
  },
  construction_management: {
    eyebrow: "INSOME SITE FLOW",
    title: "施工管理 · 现场装配/质量安全/影像证据",
    description: "把生产和物流状态接到现场安装计划、质量安全、整改闭环、AR/点云/影像证据。",
    primaryAction: "生成现场执行包",
    artifactPrefix: "site-execution",
    outputName: "施工计划 / 质量安全 / 现场证据",
    dataObjects: ["安装任务", "检验批", "安全记录", "影像证据"],
    flowSteps: ["接收到货构件", "生成安装和质检任务", "采集现场证据", "推送竣工交付"],
  },
  digital_twin: {
    eyebrow: "INSOME TWIN FLOW",
    title: "数字孪生 · BIM/点云/IoT/运维场景",
    description: "把方案、施工、档案和现场证据汇入可编辑数字孪生，形成资产状态和运维入口。",
    primaryAction: "生成孪生场景包",
    artifactPrefix: "digital-twin",
    outputName: "Twin Token / 场景 / 资产状态",
    dataObjects: ["BIM", "3DGS", "IoT", "运维工单"],
    flowSteps: ["接收模型和现场证据", "对齐空间与构件", "生成孪生场景", "连接运维状态"],
  },
  digital_archive: {
    eyebrow: "INSOME ARCHIVE FLOW",
    title: "数字档案 · 合同/图纸/审批/证据归档",
    description: "把全链条模型、图纸、合同、审批、质检和现场证据归档为可审计长期资产。",
    primaryAction: "生成档案归集包",
    artifactPrefix: "archive-package",
    outputName: "数字档案 / 审计包 / 长期保存",
    dataObjects: ["合同", "图纸", "审批", "审计证据"],
    flowSteps: ["收集交付物", "校验版本和签章", "归档证据链", "输出审计包"],
  },
  finance_hr: {
    eyebrow: "INSOME ENTERPRISE FLOW",
    title: "财务人力 · 付款/成本/人员/绩效",
    description: "把项目进度、合同边界、成本归集和人员工时接入财务、人力和经营分析。",
    primaryAction: "生成经营结算包",
    artifactPrefix: "finance-hr",
    outputName: "付款计划 / 成本归集 / 人员绩效",
    dataObjects: ["付款节点", "成本中心", "工时", "绩效"],
    flowSteps: ["读取合同和进度", "归集成本和工时", "生成付款节点", "输出经营分析"],
  },
  ai_center: {
    eyebrow: "INSOME AI HARNESS",
    title: "AI中心 · Planner/Generator/Evaluator 编排",
    description: "把各模块业务对象接入模型路由、提示词版本、评测、成本计量和人工审批责任。",
    primaryAction: "生成 AI 编排包",
    artifactPrefix: "ai-harness",
    outputName: "AI 路由 / Trace / 评测记录",
    dataObjects: ["Planner", "Generator", "Evaluator", "Trace"],
    flowSteps: ["接收模块任务", "选择模型和工具", "生成并评测结果", "进入规则和审批"],
  },
  settings_center: {
    eyebrow: "INSOME GOVERNANCE FLOW",
    title: "设置中心 · 组织/权限/模型路由/规则治理",
    description: "把全平台模块、角色、租户、权限、模型路由和审批规则统一配置成治理基线。",
    primaryAction: "生成治理配置包",
    artifactPrefix: "governance-config",
    outputName: "权限配置 / 模型路由 / 审批规则",
    dataObjects: ["组织角色", "RLS", "模型路由", "审批规则"],
    flowSteps: ["读取模块 registry", "配置角色权限", "绑定模型路由", "发布治理规则"],
  },
} satisfies Record<ModuleId, ModuleFlowCopy>;

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
  specialistPanel,
  specialistLabel = "专业工作台",
}: {
  moduleId: ModuleId;
  onAudit?: (event: ModuleAuditEvent) => void;
  specialistPanel?: ReactNode;
  specialistLabel?: string;
}) {
  const copy = MODULE_COPY[moduleId];
  const currentModuleIndex = MODULE_FLOW_ORDER.indexOf(moduleId);
  const previousModuleId = currentModuleIndex > 0 ? MODULE_FLOW_ORDER[currentModuleIndex - 1] ?? null : null;
  const nextModuleId =
    currentModuleIndex >= 0 && currentModuleIndex < MODULE_FLOW_ORDER.length - 1
      ? MODULE_FLOW_ORDER[currentModuleIndex + 1] ?? null
      : null;
  const [plans, setPlans] = useState<ReadonlyArray<Floorplan>>(() =>
    moduleId === "marketing_service"
      ? homeFloorplanVariants
      : generateResidentialProposals(initialResidentialSpec),
  );
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [createdFiles, setCreatedFiles] = useState<ReadonlyArray<string>>([]);
  const [activeView, setActiveView] = useState<"flow" | "specialist">("flow");
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
            {specialistPanel ? (
              <div className="mr-2 flex rounded-md border arch-border bg-[var(--arch-surface-muted)] p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveView("flow")}
                  className={`h-7 rounded px-3 text-[11px] ${
                    activeView === "flow"
                      ? "bg-[var(--module-accent)] text-[var(--module-accent-foreground)]"
                      : "arch-muted"
                  }`}
                >
                  业务流
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("specialist")}
                  className={`h-7 rounded px-3 text-[11px] ${
                    activeView === "specialist"
                      ? "bg-[var(--module-accent)] text-[var(--module-accent-foreground)]"
                      : "arch-muted"
                  }`}
                >
                  {specialistLabel}
                </button>
              </div>
            ) : null}
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

      {activeView === "specialist" && specialistPanel ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          {specialistPanel}
        </div>
      ) : (
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
            <div className="mb-4 rounded-lg border arch-border bg-[var(--arch-surface)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {MODULE_FLOW_ORDER.map((id, index) => (
                  <Link
                    key={id}
                    href={`/app/modules/${id}`}
                    className={`inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[11px] ${
                      id === moduleId
                        ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--module-accent)]"
                        : "arch-border arch-muted hover:text-[var(--module-accent)]"
                    }`}
                  >
                    <span className="font-mono">{String(index + 1).padStart(2, "0")}</span>
                    {MODULE_LABELS[id]}
                  </Link>
                ))}
              </div>
              <div className="mt-3 grid gap-2 text-[12px] arch-muted md:grid-cols-3">
                <FlowNeighbor label="上游" moduleId={previousModuleId} />
                <FlowNeighbor label="当前输出" text={copy.outputName} />
                <FlowNeighbor label="下游" moduleId={nextModuleId} />
              </div>
            </div>

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
                    {copy.flowSteps.map((step) => (
                      <BridgeStep key={step} text={step} />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border arch-border bg-[var(--arch-surface)] p-4">
                  <p className="text-[11px] text-[var(--module-accent)]">业务对象</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {copy.dataObjects.map((item) => (
                      <span key={item} className="rounded-md border arch-border px-2 py-1 text-[11px] arch-text">
                        {item}
                      </span>
                    ))}
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
              href={nextModuleId ? `/app/modules/${nextModuleId}` : "/studio"}
              className="mt-3 inline-flex items-center gap-2 text-[12px] text-[var(--module-accent)]"
            >
              {nextModuleId ? `进入${MODULE_LABELS[nextModuleId]}模块` : "打开完整 INSOME Studio"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
      )}
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

function FlowNeighbor({
  label,
  moduleId,
  text,
}: {
  label: string;
  moduleId?: ModuleId | null;
  text?: string;
}) {
  const value = moduleId ? MODULE_LABELS[moduleId] : text ?? "链路起点";
  return (
    <div className="rounded-md border arch-border bg-[var(--arch-surface-muted)] px-3 py-2">
      <p className="text-[10px] text-[var(--module-accent)]">{label}</p>
      <p className="mt-1 text-[12px] arch-text">{value}</p>
    </div>
  );
}
