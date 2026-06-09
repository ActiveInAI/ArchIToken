// components/AICenterManagementPanels.tsx
// License: Apache-2.0
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  FileJson,
  Gauge,
  Key,
  Lock,
  Network,
  PlusCircle,
  Plug,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Table,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import {
  api,
  type AiCenterDatabaseBinding,
  type AiCenterInterfaceContract,
  type AiCenterManagementResponse,
  type AiCenterManagementStatus,
  type AiCenterVisualizationPanel,
} from "@/lib/api";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";

export type AICenterGovernancePanelId =
  | "interfaces"
  | "databases"
  | "visualization";
export type AICenterBillingPanelId =
  | "plans"
  | "topup"
  | "apiTokens"
  | "billing"
  | "governance";
type PaymentMethodId = "wechat" | "alipay" | "bank" | "stripe";
type PaymentOrderDraft = {
  kind: string;
  title: string;
  item: string;
  amount: string;
  rows: { label: string; value: string }[];
  ctaLabel: string;
  note: string;
};

const SERVICE_PLANS = [
  {
    id: "starter",
    name: "基础会员",
    price: "¥99/月",
    quota: "100 万调用点/月",
    members: "1 席位",
    api: "共享 API 限流",
    support: "工单支持",
    features: ["模型路由", "基础 RAG", "调用审计"],
  },
  {
    id: "professional",
    name: "专业会员",
    price: "¥499/月",
    quota: "800 万调用点/月",
    members: "5 席位",
    api: "独立 API Token",
    support: "工作日支持",
    features: ["多模型路由", "图像/文档任务", "项目级用量账单"],
    recommended: true,
  },
  {
    id: "team",
    name: "团队会员",
    price: "¥1,999/月",
    quota: "4,000 万调用点/月",
    members: "20 席位",
    api: "团队 API Token 池",
    support: "优先支持",
    features: ["部门额度", "审批流", "私有知识库"],
  },
  {
    id: "enterprise",
    name: "企业会员",
    price: "商务报价",
    quota: "专属额度池",
    members: "按组织配置",
    api: "专属网关与私有部署",
    support: "SLA 与专属支持",
    features: ["私有模型托管", "对公合同", "合规审计包"],
  },
];

const TOP_UP_PACKAGES = [
  {
    id: "topup-small",
    name: "轻量充值",
    credits: "100 万调用点",
    price: "¥99",
    scene: "问答、摘要、轻量 RAG",
  },
  {
    id: "topup-standard",
    name: "标准充值",
    credits: "600 万调用点",
    price: "¥499",
    scene: "图纸解析、OCR、批量问答",
    recommended: true,
  },
  {
    id: "topup-pro",
    name: "项目充值",
    credits: "3,000 万调用点",
    price: "¥1,999",
    scene: "项目级 Agent、图像和文档批处理",
  },
  {
    id: "topup-private",
    name: "企业额度包",
    credits: "专属额度池",
    price: "商务报价",
    scene: "私有部署、专属 API、对公结算",
  },
];

const PAYMENT_METHODS: {
  id: PaymentMethodId;
  label: string;
  description: string;
}[] = [
  { id: "wechat", label: "微信支付", description: "个人与小额快速支付" },
  { id: "alipay", label: "支付宝", description: "个人与企业在线支付" },
  { id: "bank", label: "对公转账", description: "合同、发票和线下入账" },
  { id: "stripe", label: "银行卡 / Stripe", description: "海外客户支付通道" },
];

const API_TOKEN_ROWS = [
  {
    name: "工作台默认 Token",
    token: "ak_live_cde_••••_8f29",
    scope: "AI 工作台 / RAG / 图像生成",
    quota: "共享专业会员额度",
    status: "启用",
    updatedAt: "2026-05-28",
  },
  {
    name: "项目 API Token",
    token: "ak_live_project_••••_42dc",
    scope: "项目任务 / Agent 调用 / 审计写入",
    quota: "单项目限额 200 万点/月",
    status: "启用",
    updatedAt: "2026-05-27",
  },
  {
    name: "外部集成 Token",
    token: "ak_test_partner_••••_71aa",
    scope: "测试环境 / API 沙箱",
    quota: "每日 5 万点",
    status: "测试",
    updatedAt: "2026-05-26",
  },
];

const BILLING_ROWS = [
  {
    id: "AT-20260528-001",
    item: "专业会员 / 月度",
    amount: "¥499.00",
    method: "微信支付",
    status: "已支付",
    updatedAt: "2026-05-28",
  },
  {
    id: "AT-20260527-002",
    item: "标准充值 / 600 万调用点",
    amount: "¥499.00",
    method: "支付宝",
    status: "已入账",
    updatedAt: "2026-05-27",
  },
  {
    id: "AT-20260524-003",
    item: "项目充值 / 3,000 万调用点",
    amount: "¥1,999.00",
    method: "对公转账",
    status: "待开票",
    updatedAt: "2026-05-24",
  },
];

const BILLING_PANELS: {
  id: AICenterBillingPanelId;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    id: "plans",
    label: "购买套餐",
    description: "选择会员等级，开通月度 AI 服务额度。",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "topup",
    label: "额度充值",
    description: "购买额外 AI 调用点数，按服务额度入账。",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: "apiTokens",
    label: "API Token",
    description: "管理外部系统调用 ArchIToken AI 的 API Token。",
    icon: <Key className="h-4 w-4" />,
  },
  {
    id: "billing",
    label: "订单账单",
    description: "查看支付订单、发票和用量记录。",
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    id: "governance",
    label: "高级治理",
    description: "后端接口、数据库和可视化注册表治理。",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

const STATUS_META: Record<
  AiCenterManagementStatus,
  { label: string; className: string }
> = {
  configured: {
    label: "已接入",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  approved: {
    label: "已批准",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  review: {
    label: "待审批",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  draft: {
    label: "待配置",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  disabled: {
    label: "已停用",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const MANAGEMENT_PANELS: {
  id: AICenterGovernancePanelId;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    id: "interfaces",
    label: "接口管理",
    description: "读取并更新后端 ai_center_interface_contracts。",
    icon: <Plug className="h-4 w-4" />,
  },
  {
    id: "databases",
    label: "数据库管理",
    description: "读取并更新后端 ai_center_database_bindings。",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "visualization",
    label: "可视化面板",
    description: "读取并更新后端 ai_center_visualization_panels。",
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

export function AICenterManagementPanels({
  compact = false,
  onAudit,
  activePanel,
  activeGovernancePanel,
  showCommercialStats = true,
  showGovernanceTabs = true,
  showHeader = true,
  showPanelTabs = true,
}: {
  compact?: boolean;
  onAudit?: (event: ModuleAuditEvent) => void;
  activePanel?: AICenterBillingPanelId;
  activeGovernancePanel?: AICenterGovernancePanelId;
  showCommercialStats?: boolean;
  showGovernanceTabs?: boolean;
  showHeader?: boolean;
  showPanelTabs?: boolean;
}) {
  const [localActivePanel, setLocalActivePanel] =
    useState<AICenterBillingPanelId>("plans");
  const [localGovernancePanel, setLocalGovernancePanel] =
    useState<AICenterGovernancePanelId>("interfaces");
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [selectedTopup, setSelectedTopup] = useState("topup-standard");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentMethodId>("wechat");
  const [checkoutOrder, setCheckoutOrder] = useState<PaymentOrderDraft | null>(
    null,
  );
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [data, setData] = useState<AiCenterManagementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emitAudit = (action: string, detail: string) => {
    onAudit?.(
      createModuleAuditEvent(action, "AICenterManagementPanels", detail),
    );
  };

  const loadManagement = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.aiCenter.management();
      setData(payload);
      emitAudit(
        "ai-center-management-refresh",
        `AI 中心管理数据已从 Gateway 刷新: ${payload.interfaceContracts.length}/${payload.databaseBindings.length}/${payload.visualizationPanels.length}`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, "AI 中心管理接口不可用"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadManagement();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPlanMeta =
    SERVICE_PLANS.find((plan) => plan.id === selectedPlan) ?? SERVICE_PLANS[0]!;
  const selectedTopupMeta =
    TOP_UP_PACKAGES.find((item) => item.id === selectedTopup) ??
    TOP_UP_PACKAGES[0]!;
  const selectedPaymentMeta =
    PAYMENT_METHODS.find((method) => method.id === selectedPayment) ??
    PAYMENT_METHODS[0]!;
  const resolvedActivePanel = activePanel ?? localActivePanel;
  const resolvedGovernancePanel = activeGovernancePanel ?? localGovernancePanel;

  const commercialStats = useMemo(
    () => [
      {
        label: "当前套餐",
        value: "专业会员",
        detail: "800 万调用点/月 · 5 席位",
        icon: <Zap className="h-4 w-4" />,
      },
      {
        label: "服务额度余额",
        value: "1,280 万",
        detail: "仅限平台内 AI 服务消费",
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: "本月 API 调用",
        value: "86,240",
        detail: "已写入审计与用量账单",
        icon: <Activity className="h-4 w-4" />,
      },
      {
        label: "API Token",
        value: String(API_TOKEN_ROWS.length),
        detail: "支持工作台、项目和外部集成",
        icon: <Key className="h-4 w-4" />,
      },
    ],
    [],
  );

  const governanceStats = useMemo(
    () => [
      {
        label: "接口合同",
        value: String(data?.interfaceContracts.length ?? 0),
        detail: `${countStatus(data?.interfaceContracts ?? [], "configured")} 已接入`,
        icon: <Network className="h-4 w-4" />,
      },
      {
        label: "数据对象",
        value: String(data?.databaseBindings.length ?? 0),
        detail: `${countStatus(data?.databaseBindings ?? [], "review")} 待审批`,
        icon: <Table className="h-4 w-4" />,
      },
      {
        label: "运行视图",
        value: String(data?.visualizationPanels.length ?? 0),
        detail: `${countStatus(data?.visualizationPanels ?? [], "approved")} 已批准`,
        icon: <Activity className="h-4 w-4" />,
      },
    ],
    [data],
  );

  const openPaymentOrder = (draft: PaymentOrderDraft) => {
    setPaymentMessage(null);
    setCheckoutOrder(draft);
    emitAudit(
      "ai-billing-order-checkout-open",
      `进入 ${draft.kind} 结算页: ${draft.item}`,
    );
  };

  const createPaymentOrder = () => {
    if (!checkoutOrder) return;
    const orderNo = `AT-${new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const message = `已创建${checkoutOrder.kind}订单 ${orderNo}：${checkoutOrder.item}，金额 ${checkoutOrder.amount}，支付方式 ${selectedPaymentMeta.label}。`;
    setPaymentMessage(message);
    setCheckoutOrder(null);
    emitAudit("ai-billing-order-create", message);
  };

  const copyApiToken = (token: string) => {
    void navigator.clipboard?.writeText(token).catch(() => undefined);
    const message = `已复制 API Token 标识：${token}`;
    setPaymentMessage(message);
    emitAudit("ai-api-token-copy", message);
  };

  const updateInterfaceStatus = async (
    contractKey: string,
    status: AiCenterManagementStatus,
  ) => {
    setSavingKey(`interface:${contractKey}`);
    setError(null);
    try {
      const updated = await api.aiCenter.updateInterfaceContract(contractKey, {
        status,
        metadata: { updatedFrom: "ai_center_workbench" },
      });
      setData((current) =>
        current
          ? {
              ...current,
              interfaceContracts: current.interfaceContracts.map((item) =>
                item.contractKey === updated.contractKey ? updated : item,
              ),
            }
          : current,
      );
      emitAudit(
        "ai-interface-contract-update",
        `接口合同状态已写回数据库: ${updated.contractKey} -> ${updated.status}`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, "接口合同状态写回失败"));
    } finally {
      setSavingKey(null);
    }
  };

  const updateDatabaseStatus = async (
    bindingKey: string,
    status: AiCenterManagementStatus,
  ) => {
    setSavingKey(`database:${bindingKey}`);
    setError(null);
    try {
      const updated = await api.aiCenter.updateDatabaseBinding(bindingKey, {
        status,
        metadata: { updatedFrom: "ai_center_workbench" },
      });
      setData((current) =>
        current
          ? {
              ...current,
              databaseBindings: current.databaseBindings.map((item) =>
                item.bindingKey === updated.bindingKey ? updated : item,
              ),
            }
          : current,
      );
      emitAudit(
        "ai-database-binding-update",
        `数据库绑定状态已写回数据库: ${updated.bindingKey} -> ${updated.status}`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, "数据库绑定状态写回失败"));
    } finally {
      setSavingKey(null);
    }
  };

  const updateVisualizationStatus = async (
    panelKey: string,
    status: AiCenterManagementStatus,
  ) => {
    setSavingKey(`visualization:${panelKey}`);
    setError(null);
    try {
      const updated = await api.aiCenter.updateVisualizationPanel(panelKey, {
        status,
        metadata: { updatedFrom: "ai_center_workbench" },
      });
      setData((current) =>
        current
          ? {
              ...current,
              visualizationPanels: current.visualizationPanels.map((item) =>
                item.panelKey === updated.panelKey ? updated : item,
              ),
            }
          : current,
      );
      emitAudit(
        "ai-visualization-panel-update",
        `可视化面板状态已写回数据库: ${updated.panelKey} -> ${updated.status}`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, "可视化面板状态写回失败"));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div
      className={[
        "ai-center-management",
        compact ? "mt-3 space-y-3" : "border-t px-4 pb-4 pt-4",
      ].join(" ")}
    >
      {showHeader ? (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-[var(--module-accent)]">
              AI Billing & API Access
            </p>
            <h3 className="arch-text mt-1 text-base font-medium">会员充值</h3>
            <p className="arch-muted mt-1 max-w-4xl text-xs leading-5">
              AI
              服务额度是平台内调用点数，不可提现、不可转让、不可交易；支付完成后写入用量账单、发票和审计记录。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadManagement()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[var(--module-accent)] hover:text-[var(--module-accent)] disabled:opacity-50"
          >
            {loading ? (
              <ArchLoadingFlow label="刷新中" size="inline" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            同步后端计量
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      {paymentMessage ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <span>{paymentMessage}</span>
        </div>
      ) : null}

      {showCommercialStats ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {commercialStats.map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-slate-100 bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="arch-muted inline-flex items-center gap-1">
                  {item.icon}
                  {item.label}
                </span>
                <span className="font-mono text-base font-semibold text-slate-950">
                  {item.value}
                </span>
              </div>
              <p className="arch-muted mt-1 text-[11px]">{item.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showPanelTabs ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {BILLING_PANELS.map((panel) => {
            const selected = resolvedActivePanel === panel.id;
            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => {
                  setCheckoutOrder(null);
                  setLocalActivePanel(panel.id);
                  emitAudit(
                    "ai-center-panel-switch",
                    `切换 AI 中心业务面板: ${panel.label}`,
                  );
                }}
                className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--module-accent)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[var(--module-accent)]"
                }`}
                title={panel.description}
              >
                {panel.icon}
                {panel.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4">
        {checkoutOrder ? (
          <BillingCheckoutPage
            order={checkoutOrder}
            selectedPayment={selectedPayment}
            onSelectPayment={setSelectedPayment}
            onBack={() => setCheckoutOrder(null)}
            onConfirm={createPaymentOrder}
          />
        ) : null}
        {!checkoutOrder && resolvedActivePanel === "plans" ? (
          <PlanPurchasePanel
            plans={SERVICE_PLANS}
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
            onOpenOrder={(planId) => {
              const plan =
                SERVICE_PLANS.find((item) => item.id === planId) ??
                selectedPlanMeta;
              openPaymentOrder({
                kind: "套餐购买",
                title: "套餐订单",
                item: plan.name,
                amount: plan.price,
                rows: [
                  { label: "会员等级", value: plan.name },
                  { label: "服务额度", value: plan.quota },
                  { label: "席位", value: plan.members },
                  { label: "金额", value: plan.price },
                ],
                ctaLabel: "生成套餐订单",
                note: "支付成功后开通会员、写入额度账户，并生成账单和审计记录。",
              });
            }}
          />
        ) : null}
        {!checkoutOrder && resolvedActivePanel === "topup" ? (
          <TopupPanel
            packages={TOP_UP_PACKAGES}
            selectedTopup={selectedTopup}
            onSelectTopup={setSelectedTopup}
            onOpenOrder={(packageId) => {
              const topup =
                TOP_UP_PACKAGES.find((item) => item.id === packageId) ??
                selectedTopupMeta;
              openPaymentOrder({
                kind: "额度充值",
                title: "充值订单",
                item: topup.credits,
                amount: topup.price,
                rows: [
                  { label: "充值包", value: topup.name },
                  { label: "额度", value: topup.credits },
                  { label: "用途", value: topup.scene },
                  { label: "金额", value: topup.price },
                ],
                ctaLabel: "立即充值",
                note: "额度只用于 AI 调用、文档解析、图像生成、RAG 检索和 Agent 工作流。",
              });
            }}
          />
        ) : null}
        {!checkoutOrder && resolvedActivePanel === "apiTokens" ? (
          <ApiTokenPanel items={API_TOKEN_ROWS} onCopy={copyApiToken} />
        ) : null}
        {!checkoutOrder && resolvedActivePanel === "billing" ? (
          <BillingHistoryPanel items={BILLING_ROWS} />
        ) : null}
        {!checkoutOrder && resolvedActivePanel === "governance" ? (
          <div className="rounded-md border border-slate-100 bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-950">
                  高级治理注册表
                </p>
                <p className="arch-muted mt-1 text-xs">
                  面向平台管理员，管理接口合同、数据库绑定和运行视图审批状态。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadManagement()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-[var(--module-accent)] hover:text-[var(--module-accent)] disabled:opacity-50"
              >
                {loading ? (
                  <ArchLoadingFlow label="刷新中" size="inline" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                刷新治理数据
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {governanceStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="arch-muted inline-flex items-center gap-1">
                      {item.icon}
                      {item.label}
                    </span>
                    <span className="font-mono text-base font-semibold text-slate-950">
                      {item.value}
                    </span>
                  </div>
                  <p className="arch-muted mt-1 text-[11px]">{item.detail}</p>
                </div>
              ))}
            </div>
            {showGovernanceTabs ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {MANAGEMENT_PANELS.map((panel) => {
                  const selected = resolvedGovernancePanel === panel.id;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => {
                        setLocalGovernancePanel(panel.id);
                        emitAudit(
                          "ai-center-governance-panel-switch",
                          `切换 AI 中心治理面板: ${panel.label}`,
                        );
                      }}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                        selected
                          ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--module-accent)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[var(--module-accent)]"
                      }`}
                      title={panel.description}
                    >
                      {panel.icon}
                      {panel.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="mt-4">
              {resolvedGovernancePanel === "interfaces" ? (
                <InterfaceManagementPanel
                  items={data?.interfaceContracts ?? []}
                  savingKey={savingKey}
                  onUpdateStatus={updateInterfaceStatus}
                />
              ) : null}
              {resolvedGovernancePanel === "databases" ? (
                <DatabaseManagementPanel
                  items={data?.databaseBindings ?? []}
                  savingKey={savingKey}
                  onUpdateStatus={updateDatabaseStatus}
                />
              ) : null}
              {resolvedGovernancePanel === "visualization" ? (
                <VisualizationPanel
                  items={data?.visualizationPanels ?? []}
                  savingKey={savingKey}
                  onUpdateStatus={updateVisualizationStatus}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BillingCheckoutPage({
  order,
  selectedPayment,
  onSelectPayment,
  onBack,
  onConfirm,
}: {
  order: PaymentOrderDraft;
  selectedPayment: PaymentMethodId;
  onSelectPayment: (method: PaymentMethodId) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const selectedPaymentMeta =
    PAYMENT_METHODS.find((method) => method.id === selectedPayment) ??
    PAYMENT_METHODS[0]!;
  const detailRows = order.rows.filter((row) => row.label !== "金额");
  const settlementRows = [
    ["会员与额度", "支付确认后写入额度账户"],
    ["账单记录", "生成订单、账单和支付凭证"],
    ["审计事件", "写入 AI 中心审计流"],
    ["后续协同", "同步项目用量与分摊"],
  ];

  return (
    <div
      className="ai-center-google-checkout w-full min-w-0 space-y-4 pb-5"
      data-testid="ai-billing-checkout"
    >
      <header className="ai-center-checkout-hero rounded-md border px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--arch-border)] px-2 py-1 text-xs font-medium text-[var(--arch-text)] hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回会员充值
          </button>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-[var(--module-accent)] bg-[var(--module-accent-soft)] px-2 py-0.5 text-[var(--arch-text)]">
              {order.kind}
            </span>
            <span className="rounded-full border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-2 py-0.5 text-[var(--arch-text-muted)]">
              待生成
            </span>
          </div>
        </div>
        <div className="mt-4 min-w-0">
          <p className="font-mono text-[10px] text-[var(--module-accent)]">
            AI Billing Checkout
          </p>
          <h4 className="mt-1 text-lg font-semibold text-[var(--arch-text)]">
            {order.title}
          </h4>
          <p className="arch-muted mt-1 max-w-[720px] text-xs leading-5">
            确认订单、选择支付方式，生成订单后写入账单、额度账户和审计事件。
          </p>
        </div>
      </header>

      <section
        className="ai-center-checkout-step rounded-md border p-4"
        data-testid="ai-checkout-summary"
      >
        <div className="grid gap-4 md:grid-cols-[42px_minmax(0,1fr)]">
          <CheckoutStepMarker step="1" />
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--arch-border)] pb-3">
              <div>
                <p className="font-mono text-[10px] text-[var(--module-accent)]">
                  ORDER
                </p>
                <h5 className="mt-1 text-base font-semibold text-[var(--arch-text)]">
                  订单
                </h5>
              </div>
              <Receipt className="h-4 w-4 text-[var(--module-accent)]" />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_180px]">
              <div className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-3">
                <p className="text-sm font-semibold text-[var(--arch-text)]">
                  {order.item}
                </p>
                <p className="arch-muted mt-1 text-[11px]">{order.kind}</p>
              </div>
              <dl className="grid gap-2 text-xs sm:grid-cols-3">
                {detailRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] px-3 py-2"
                  >
                    <dt className="arch-muted text-[11px]">{row.label}</dt>
                    <dd className="mt-1 font-medium text-[var(--arch-text)]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="ai-center-checkout-total rounded-md border px-3 py-3">
                <p className="arch-muted text-xs">应付金额</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-[var(--arch-text)]">
                  {order.amount}
                </p>
              </div>
            </div>
            <p className="arch-muted mt-3 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-2 text-[11px] leading-5">
              {order.note}
            </p>
          </div>
        </div>
      </section>

      <section className="ai-center-checkout-step rounded-md border p-4">
        <div className="grid gap-4 md:grid-cols-[42px_minmax(0,1fr)]">
          <CheckoutStepMarker step="2" />
          <div className="min-w-0">
            <div className="border-b border-[var(--arch-border)] pb-3">
              <p className="font-mono text-[10px] text-[var(--module-accent)]">
                PAYMENT
              </p>
              <h5 className="mt-1 text-base font-semibold text-[var(--arch-text)]">
                支付方式
              </h5>
            </div>
            <div className="mt-4">
              <PaymentMethodSelector
                selectedPayment={selectedPayment}
                onSelectPayment={onSelectPayment}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="ai-center-checkout-step rounded-md border p-4">
        <div className="grid gap-4 md:grid-cols-[42px_minmax(0,1fr)]">
          <CheckoutStepMarker step="3" />
          <div className="min-w-0">
            <div className="border-b border-[var(--arch-border)] pb-3">
              <p className="font-mono text-[10px] text-[var(--module-accent)]">
                SETTLEMENT
              </p>
              <h5 className="mt-1 text-base font-semibold text-[var(--arch-text)]">
                入账与审计
              </h5>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {settlementRows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-w-0 gap-2 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-accent)]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--arch-text)]">
                      {label}
                    </span>
                    <span className="arch-muted mt-1 block text-[11px] leading-5">
                      {value}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="ai-center-checkout-submit sticky bottom-3 z-10 rounded-md border p-3"
        data-testid="ai-checkout-submit"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-[var(--module-accent)]">
              CONFIRM
            </p>
            <h5 className="mt-1 text-sm font-semibold text-[var(--arch-text)]">
              确认并生成订单
            </h5>
            <p className="arch-muted mt-1 text-xs leading-5">
              {selectedPaymentMeta.label} · {order.kind}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="min-w-[150px] md:text-right">
              <p className="arch-muted text-xs">应付金额</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[var(--arch-text)]">
                {order.amount}
              </p>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="ai-center-checkout-action inline-flex min-h-11 min-w-[220px] items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium"
            >
              <CreditCard className="h-5 w-5" />
              {order.ctaLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CheckoutStepMarker({ step }: { step: string }) {
  return (
    <span className="ai-center-checkout-marker hidden h-9 w-9 place-items-center rounded-full border text-sm font-semibold md:grid">
      {step}
    </span>
  );
}

function PlanPurchasePanel({
  plans,
  selectedPlan,
  onSelectPlan,
  onOpenOrder,
}: {
  plans: typeof SERVICE_PLANS;
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
  onOpenOrder: (planId: string) => void;
}) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {plans.map((item) => {
        const selected = selectedPlan === item.id;
        return (
          <div
            key={item.id}
            className="grid content-start gap-2"
            data-testid={`ai-plan-column-${item.id}`}
          >
            <div
              data-testid={`ai-plan-card-${item.id}`}
              className={`flex min-h-[220px] flex-col overflow-hidden rounded-md border transition ${
                selected
                  ? "ai-center-selected-plan border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--arch-text)]"
                  : "border-[var(--arch-border)] bg-[var(--arch-surface)] hover:border-[var(--module-accent)]"
              }`}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelectPlan(item.id);
                  onOpenOrder(item.id);
                }}
                className={`flex flex-1 flex-col bg-transparent p-3 text-left ${
                  selected ? "ai-center-selected-plan-button" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-2 text-xl font-semibold">{item.price}</p>
                  </div>
                  {item.recommended ? (
                    <span className="rounded-full bg-[var(--module-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--module-accent-foreground)]">
                      推荐
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <KeyValue label="额度" value={item.quota} />
                  <KeyValue label="席位" value={item.members} />
                  <KeyValue label="API" value={item.api} />
                  <KeyValue label="支持" value={item.support} />
                </dl>
                <ul
                  className={`mt-3 space-y-1 border-t pt-2 text-xs ${
                    selected
                      ? "border-[var(--module-accent)] text-[var(--arch-text)]"
                      : "border-[var(--arch-border)] text-[var(--arch-muted)]"
                  }`}
                >
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-1.5">
                      <CheckCircle2
                        className={`mt-0.5 h-3.5 w-3.5 ${
                          selected
                            ? "text-[var(--module-accent)]"
                            : "text-[var(--arch-muted)]"
                        }`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopupPanel({
  packages,
  selectedTopup,
  onSelectTopup,
  onOpenOrder,
}: {
  packages: typeof TOP_UP_PACKAGES;
  selectedTopup: string;
  onSelectTopup: (packageId: string) => void;
  onOpenOrder: (packageId: string) => void;
}) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {packages.map((item) => {
        const selected = selectedTopup === item.id;
        return (
          <div
            key={item.id}
            className="grid content-start gap-2"
            data-testid={`ai-topup-column-${item.id}`}
          >
            <div
              data-testid={`ai-topup-card-${item.id}`}
              className={`flex min-h-[180px] flex-col overflow-hidden rounded-md border transition ${
                selected
                  ? "ai-center-selected-plan border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--arch-text)]"
                  : "border-[var(--arch-border)] bg-[var(--arch-surface)] hover:border-[var(--module-accent)]"
              }`}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelectTopup(item.id);
                  onOpenOrder(item.id);
                }}
                className={`flex flex-1 flex-col bg-transparent p-3 text-left ${
                  selected ? "ai-center-selected-plan-button" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--arch-text)]">
                    {item.name}
                  </p>
                  {item.recommended ? (
                    <span className="rounded-full bg-[var(--module-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--module-accent-foreground)]">
                      推荐
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-xl font-semibold text-[var(--arch-text)]">
                  {item.price}
                </p>
                <p
                  className={`mt-2 text-sm font-medium ${
                    selected
                      ? "text-[var(--module-accent)]"
                      : "text-[var(--arch-text)]"
                  }`}
                >
                  {item.credits}
                </p>
                <p className="arch-muted mt-3 text-xs leading-5">
                  {item.scene}
                </p>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ApiTokenPanel({
  items,
  onCopy,
}: {
  items: typeof API_TOKEN_ROWS;
  onCopy: (token: string) => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_180px_100px_120px_96px] border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            <span>API Token</span>
            <span>权限范围</span>
            <span>额度策略</span>
            <span>状态</span>
            <span>更新</span>
            <span>操作</span>
          </div>
          {items.map((item) => (
            <div
              key={item.token}
              className="grid grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_180px_100px_120px_96px] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-950">{item.name}</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-500">
                  {item.token}
                </p>
              </div>
              <p className="text-xs leading-5 text-slate-600">{item.scope}</p>
              <p className="text-xs leading-5 text-slate-600">{item.quota}</p>
              <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {item.status}
              </span>
              <span className="font-mono text-xs text-slate-500">
                {item.updatedAt}
              </span>
              <button
                type="button"
                onClick={() => onCopy(item.token)}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
              >
                <Copy className="h-3 w-3" />
                复制
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-slate-100 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-950">Token 接入</p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--module-accent)] px-2 py-1 text-xs font-medium text-[var(--module-accent)] hover:bg-[var(--module-accent-soft)]"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            新建
          </button>
        </div>
        <ul className="mt-3 space-y-3 text-xs text-slate-600">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--module-accent)]" />
            <span>
              所有 API 调用必须通过 ModelRouter、ToolRouter 和审计链。
            </span>
          </li>
          <li className="flex gap-2">
            <Wallet className="mt-0.5 h-4 w-4 text-blue-600" />
            <span>
              Token 只消耗 AI 服务额度，不代表资产、积分或可交易凭证。
            </span>
          </li>
          <li className="flex gap-2">
            <Lock className="mt-0.5 h-4 w-4 text-amber-600" />
            <span>生产 Token 应绑定租户、项目、额度上限和有效期。</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function BillingHistoryPanel({ items }: { items: typeof BILLING_ROWS }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[170px_minmax(220px,1fr)_110px_130px_100px_120px] border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            <span>订单号</span>
            <span>项目</span>
            <span>金额</span>
            <span>支付方式</span>
            <span>状态</span>
            <span>更新时间</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[170px_minmax(220px,1fr)_110px_130px_100px_120px] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0"
            >
              <span className="font-mono text-xs text-slate-600">
                {item.id}
              </span>
              <span className="font-medium text-slate-950">{item.item}</span>
              <span className="font-mono text-xs text-slate-700">
                {item.amount}
              </span>
              <span className="text-xs text-slate-600">{item.method}</span>
              <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {item.status}
              </span>
              <span className="font-mono text-xs text-slate-500">
                {item.updatedAt}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-slate-100 bg-white p-3">
        <p className="text-sm font-medium text-slate-950">支付接入流程</p>
        <ol className="mt-3 space-y-3 text-xs text-slate-600">
          <li>1. 创建套餐或充值订单，锁定金额和额度。</li>
          <li>2. 选择微信、支付宝、对公转账或海外支付通道。</li>
          <li>3. 支付成功后由财务确认，额度写入账户。</li>
          <li>4. 生成发票、账单、API 用量和审计记录。</li>
        </ol>
      </div>
    </div>
  );
}

function PaymentMethodSelector({
  selectedPayment,
  onSelectPayment,
}: {
  selectedPayment: PaymentMethodId;
  onSelectPayment: (method: PaymentMethodId) => void;
}) {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {PAYMENT_METHODS.map((method) => {
          const selected = selectedPayment === method.id;
          return (
            <button
              key={method.id}
              type="button"
              aria-pressed={selected}
              data-testid={`ai-payment-${method.id}`}
              onClick={() => onSelectPayment(method.id)}
              style={{
                backgroundColor: selected
                  ? "var(--module-accent-soft)"
                  : "var(--arch-surface)",
                borderColor: selected
                  ? "var(--module-accent)"
                  : "var(--arch-border)",
                boxShadow: selected
                  ? "inset 3px 0 0 var(--module-accent), 0 1px 2px rgba(17, 24, 39, 0.04)"
                  : "0 1px 1px rgba(17, 24, 39, 0.02)",
              }}
              className={`ai-center-checkout-payment flex min-h-[72px] items-start gap-3 rounded-md border px-3 py-3 text-left transition ${
                selected ? "is-selected" : ""
              }`}
            >
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  selected
                    ? "border-[var(--module-accent)]"
                    : "border-[var(--arch-border)]"
                }`}
              >
                {selected ? (
                  <span className="h-2 w-2 rounded-full bg-[var(--module-accent)]" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--arch-text)]">
                  {method.label}
                </span>
                <span className="arch-muted mt-1 block text-[11px] leading-5">
                  {method.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InterfaceManagementPanel({
  items,
  savingKey,
  onUpdateStatus,
}: {
  items: AiCenterInterfaceContract[];
  savingKey: string | null;
  onUpdateStatus: (
    contractKey: string,
    status: AiCenterManagementStatus,
  ) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[92px_minmax(220px,1fr)_minmax(180px,1fr)_160px_170px] border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          <span>方法</span>
          <span>接口合同</span>
          <span>边界</span>
          <span>数据对象</span>
          <span>状态</span>
        </div>
        {items.map((item) => (
          <div
            key={item.contractKey}
            className="grid grid-cols-[92px_minmax(220px,1fr)_minmax(180px,1fr)_160px_170px] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0"
          >
            <span className="font-mono text-xs font-semibold text-slate-800">
              {item.method}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-slate-950">{item.name}</p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500">
                {item.path}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="h-3 w-3" />
                {item.authPolicy}
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-600">{item.boundary}</p>
            <span className="font-mono text-xs text-slate-600">
              {item.dataObject}
            </span>
            <div className="flex flex-col items-start gap-2">
              <StatusBadge status={item.status} />
              <ActionButtons
                id={`interface:${item.contractKey}`}
                savingKey={savingKey}
                onReview={() => onUpdateStatus(item.contractKey, "review")}
                onApprove={() => onUpdateStatus(item.contractKey, "approved")}
              />
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <EmptyState label="后端暂无接口合同记录" />
        ) : null}
      </div>
    </div>
  );
}

function DatabaseManagementPanel({
  items,
  savingKey,
  onUpdateStatus,
}: {
  items: AiCenterDatabaseBinding[];
  savingKey: string | null;
  onUpdateStatus: (
    bindingKey: string,
    status: AiCenterManagementStatus,
  ) => Promise<void>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.bindingKey}
          className="rounded-md border border-slate-100 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-950">{item.name}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {item.objectName}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <dl className="mt-3 grid gap-2 text-xs text-slate-600">
            <KeyValue label="存储" value={item.storageAdapter} />
            <KeyValue label="生命周期" value={item.lifecyclePolicy} />
            <KeyValue label="RLS" value={item.rlsPolicy} />
            <KeyValue label="负责人" value={item.ownerRole} />
          </dl>
          <ActionButtons
            id={`database:${item.bindingKey}`}
            savingKey={savingKey}
            onReview={() => onUpdateStatus(item.bindingKey, "review")}
            onApprove={() => onUpdateStatus(item.bindingKey, "approved")}
          />
        </div>
      ))}
      {items.length === 0 ? (
        <EmptyState label="后端暂无数据库绑定记录" />
      ) : null}
    </div>
  );
}

function VisualizationPanel({
  items,
  savingKey,
  onUpdateStatus,
}: {
  items: AiCenterVisualizationPanel[];
  savingKey: string | null;
  onUpdateStatus: (
    panelKey: string,
    status: AiCenterManagementStatus,
  ) => Promise<void>;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
      <div className="rounded-md border border-slate-100 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-950">
              AI 运行视图注册表
            </p>
            <p className="arch-muted mt-1 text-xs">
              视图记录来自数据库，发布审查会写回状态。
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-[var(--module-accent)]" />
        </div>
        <div className="space-y-3">
          {items.map((panel) => (
            <div
              key={panel.panelKey}
              className="rounded-md border border-slate-100 p-3"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-950">{panel.name}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {panel.dataset}
                  </p>
                </div>
                <StatusBadge status={panel.status} />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                <span>视图: {panel.viewMode}</span>
                <span>刷新: {panel.refreshPolicy}</span>
                <span>准备度: {panel.readiness}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[var(--module-accent)]"
                  style={{ width: `${panel.readiness}%` }}
                />
              </div>
              <ActionButtons
                id={`visualization:${panel.panelKey}`}
                savingKey={savingKey}
                onReview={() => onUpdateStatus(panel.panelKey, "review")}
                onApprove={() => onUpdateStatus(panel.panelKey, "approved")}
              />
            </div>
          ))}
          {items.length === 0 ? (
            <EmptyState label="后端暂无可视化面板记录" />
          ) : null}
        </div>
      </div>
      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-950">发布门禁</p>
        <ul className="mt-3 space-y-3 text-xs text-slate-600">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>视图必须声明数据库数据集和租户隔离策略。</span>
          </li>
          <li className="flex gap-2">
            <Workflow className="mt-0.5 h-4 w-4 text-blue-600" />
            <span>AI 调用链必须保留 Planner 到 Approver 审计上下文。</span>
          </li>
          <li className="flex gap-2">
            <Gauge className="mt-0.5 h-4 w-4 text-amber-600" />
            <span>运行指标只能从真实后端事件或已声明配置对象读取。</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ActionButtons({
  id,
  savingKey,
  onReview,
  onApprove,
}: {
  id: string;
  savingKey: string | null;
  onReview: () => Promise<void>;
  onApprove: () => Promise<void>;
}) {
  const saving = savingKey === id;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void onReview()}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-[var(--module-accent)] hover:text-[var(--module-accent)] disabled:opacity-50"
      >
        <FileJson className="h-3 w-3" />
        审查
      </button>
      <button
        type="button"
        onClick={() => void onApprove()}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--module-accent)] px-2 py-1 text-xs font-medium text-[var(--module-accent-foreground)] hover:brightness-95 disabled:opacity-50"
      >
        <CheckCircle2 className="h-3 w-3" />
        批准
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: AiCenterManagementStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-sm text-slate-500">{label}</div>;
}

function countStatus<T extends { status: AiCenterManagementStatus }>(
  items: T[],
  status: AiCenterManagementStatus,
) {
  return items.filter((item) => item.status === status).length;
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err && "error" in err) {
    const error = (err as { error?: unknown }).error;
    if (typeof error === "string") {
      return error;
    }
  }
  return fallback;
}
