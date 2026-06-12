// lib/quantity-costing-approval.ts
// License: Apache-2.0
// 注册造价工程师审批流内核。GCCP7.0 的「项目审核认证单」仅是纸面产物，
// 这里将其数字化为双状态机（超越点）：
// - 审批单 cost_approval_records.status：not_started → waiting → approved/rejected/returned
// - 报告 cost_review_reports.output_state：
//   draft_assist → rule_checked → professional_review_required → professional_reviewed
//   → signoff_ready → signed_record
//   驳回(reject)回到 rule_checked 整改后重新送审；退回(return)回到 draft_assist 重做。
// AI 辅助产出必须经注册造价工程师审批才能进入 signoff_ready，审批通过强制留痕。

export type CostApprovalStatus =
  | "not_started"
  | "waiting"
  | "approved"
  | "rejected"
  | "returned";

export type CostApprovalAction = "approve" | "reject" | "return";

export type CostReportOutputState =
  | "draft_assist"
  | "rule_checked"
  | "professional_review_required"
  | "professional_reviewed"
  | "signoff_ready"
  | "signed_record";

export interface CostApprovalRecord {
  approvalKey: string;
  title: string;
  professionalRole: string;
  approverLabel: string;
  status: CostApprovalStatus;
  decision: string;
  evidenceRefs: string[];
  reportKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostApprovalDecisionInput {
  action: CostApprovalAction;
  decision: string;
  approverLabel: string;
  evidenceRefs?: string[];
}

export interface CostApprovalDecisionResult {
  record: CostApprovalRecord;
  reportOutputState: CostReportOutputState;
  error: string | null;
}

export interface CostApprovalSummary {
  total: number;
  waiting: number;
  approved: number;
  rejected: number;
  returned: number;
  signedOff: boolean;
}

export const COST_APPROVAL_DEFAULT_ROLE = "注册造价工程师";

export const costApprovalStatusLabels: Record<CostApprovalStatus, string> = {
  not_started: "未发起",
  waiting: "待审批",
  approved: "已通过",
  rejected: "已驳回",
  returned: "已退回",
};

export const costReportOutputStateLabels: Record<CostReportOutputState, string> = {
  draft_assist: "AI 草稿",
  rule_checked: "规则校验通过",
  professional_review_required: "待专业复核",
  professional_reviewed: "专业已复核",
  signoff_ready: "可签发",
  signed_record: "已签章归档",
};

/** 发起审批：从报告生成待审批单。重复发起返回原单（approval_key 唯一约束语义）。 */
export function createApprovalRecord(
  input: {
    reportKey: string;
    title: string;
    professionalRole?: string;
  },
  now = new Date().toISOString(),
): CostApprovalRecord {
  return {
    approvalKey: `approval-${input.reportKey}`,
    title: input.title,
    professionalRole: input.professionalRole ?? COST_APPROVAL_DEFAULT_ROLE,
    approverLabel: "",
    status: "waiting",
    decision: "",
    evidenceRefs: [],
    reportKey: input.reportKey,
    createdAt: now,
    updatedAt: now,
  };
}

const decisionTransitions: Record<
  CostApprovalAction,
  { status: CostApprovalStatus; reportOutputState: CostReportOutputState }
> = {
  approve: { status: "approved", reportOutputState: "professional_reviewed" },
  reject: { status: "rejected", reportOutputState: "rule_checked" },
  return: { status: "returned", reportOutputState: "draft_assist" },
};

/**
 * 审批裁决。约束：
 * - 只有 waiting 状态可裁决；
 * - 三种动作都必须填写审批意见（decision）；
 * - 通过(approve)必须至少附 1 条证据引用（审计留痕，对齐 evidence_refs 列语义）。
 * 违反约束时返回 error 且原单不变。
 */
export function decideApproval(
  record: CostApprovalRecord,
  input: CostApprovalDecisionInput,
  now = new Date().toISOString(),
): CostApprovalDecisionResult {
  const fail = (error: string): CostApprovalDecisionResult => ({
    record,
    reportOutputState: "professional_review_required",
    error,
  });
  if (record.status !== "waiting") {
    return fail(
      `审批单当前为「${costApprovalStatusLabels[record.status]}」，只有待审批状态可裁决。`,
    );
  }
  if (!input.decision.trim()) {
    return fail("审批意见不能为空。");
  }
  if (!input.approverLabel.trim()) {
    return fail("缺少审批人。");
  }
  const evidenceRefs = input.evidenceRefs ?? [];
  if (input.action === "approve" && evidenceRefs.length === 0) {
    return fail("审批通过必须附至少 1 条证据引用（计算书/对比表/现场核验记录）。");
  }
  const transition = decisionTransitions[input.action];
  return {
    record: {
      ...record,
      status: transition.status,
      decision: input.decision.trim(),
      approverLabel: input.approverLabel.trim(),
      evidenceRefs,
      updatedAt: now,
    },
    reportOutputState: transition.reportOutputState,
    error: null,
  };
}

/**
 * 签发：professional_reviewed → signoff_ready → signed_record。
 * 只有审批已通过的报告可签发；签章归档为终态。
 */
export function advanceSignOff(
  current: CostReportOutputState,
  approval: CostApprovalRecord | null,
): { next: CostReportOutputState; error: string | null } {
  if (approval?.status !== "approved") {
    return {
      next: current,
      error: "签发前必须有已通过的注册造价工程师审批单。",
    };
  }
  if (current === "professional_reviewed") {
    return { next: "signoff_ready", error: null };
  }
  if (current === "signoff_ready") {
    return { next: "signed_record", error: null };
  }
  if (current === "signed_record") {
    return { next: current, error: "报告已签章归档，为终态。" };
  }
  return {
    next: current,
    error: `「${costReportOutputStateLabels[current]}」状态不可签发。`,
  };
}

/** 重新送审：被驳回/退回后整改完成，生成新的待审批单（沿用 key，覆盖裁决信息）。 */
export function resubmitApproval(
  record: CostApprovalRecord,
  now = new Date().toISOString(),
): { record: CostApprovalRecord; error: string | null } {
  if (record.status !== "rejected" && record.status !== "returned") {
    return {
      record,
      error: "只有已驳回或已退回的审批单可以重新送审。",
    };
  }
  return {
    record: {
      ...record,
      status: "waiting",
      decision: "",
      approverLabel: "",
      evidenceRefs: [],
      updatedAt: now,
    },
    error: null,
  };
}

export function summarizeApprovals(
  records: CostApprovalRecord[],
  reportOutputState: CostReportOutputState,
): CostApprovalSummary {
  const count = (status: CostApprovalStatus) =>
    records.filter((record) => record.status === status).length;
  return {
    total: records.length,
    waiting: count("waiting"),
    approved: count("approved"),
    rejected: count("rejected"),
    returned: count("returned"),
    signedOff: reportOutputState === "signed_record",
  };
}

/** gateway upsert 载荷（请求体 camelCase，见生产化里程碑约定）。 */
export function buildApprovalUpsertPayload(record: CostApprovalRecord): {
  approvalKey: string;
  title: string;
  professionalRole: string;
  status: CostApprovalStatus;
  decision: string;
  evidenceRefs: string[];
} {
  return {
    approvalKey: record.approvalKey,
    title: record.title,
    professionalRole: record.professionalRole,
    status: record.status,
    decision: record.decision,
    evidenceRefs: record.evidenceRefs,
  };
}
