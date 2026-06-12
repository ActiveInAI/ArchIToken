import { describe, expect, it } from "vitest";
import {
  advanceSignOff,
  buildApprovalUpsertPayload,
  createApprovalRecord,
  decideApproval,
  resubmitApproval,
  summarizeApprovals,
  type CostApprovalRecord,
} from "./quantity-costing-approval";

const AT = "2026-06-12T00:00:00.000Z";
const LATER = "2026-06-12T01:00:00.000Z";

function waitingRecord(): CostApprovalRecord {
  return createApprovalRecord(
    { reportKey: "rpt-heavy-steel-001", title: "重钢样板工程审核认证单" },
    AT,
  );
}

describe("createApprovalRecord", () => {
  it("creates a waiting record with registered cost engineer role", () => {
    const record = waitingRecord();
    expect(record.approvalKey).toBe("approval-rpt-heavy-steel-001");
    expect(record.status).toBe("waiting");
    expect(record.professionalRole).toBe("注册造价工程师");
    expect(record.evidenceRefs).toEqual([]);
  });
});

describe("decideApproval", () => {
  it("approves with decision and evidence, advancing report to professional_reviewed", () => {
    const result = decideApproval(
      waitingRecord(),
      {
        action: "approve",
        decision: "核增核减口径符合 GB/T50500-2024，同意出具。",
        approverLabel: "张工（注册造价工程师 川 J20260001）",
        evidenceRefs: ["calc-book-001", "delta-table-007"],
      },
      LATER,
    );
    expect(result.error).toBeNull();
    expect(result.record.status).toBe("approved");
    expect(result.record.updatedAt).toBe(LATER);
    expect(result.reportOutputState).toBe("professional_reviewed");
  });

  it("rejects approval without evidence refs", () => {
    const original = waitingRecord();
    const result = decideApproval(original, {
      action: "approve",
      decision: "同意",
      approverLabel: "张工",
    });
    expect(result.error).toContain("证据引用");
    expect(result.record).toEqual(original);
  });

  it("requires a non-empty decision and approver for every action", () => {
    expect(
      decideApproval(waitingRecord(), {
        action: "reject",
        decision: "  ",
        approverLabel: "张工",
      }).error,
    ).toContain("审批意见");
    expect(
      decideApproval(waitingRecord(), {
        action: "return",
        decision: "缺少送审清单",
        approverLabel: "",
      }).error,
    ).toContain("审批人");
  });

  it("reject sends report back to rule_checked, return to draft_assist", () => {
    const reject = decideApproval(waitingRecord(), {
      action: "reject",
      decision: "税金费率口径不符，整改后重新送审。",
      approverLabel: "张工",
    });
    expect(reject.record.status).toBe("rejected");
    expect(reject.reportOutputState).toBe("rule_checked");

    const ret = decideApproval(waitingRecord(), {
      action: "return",
      decision: "送审范围不完整，退回重做。",
      approverLabel: "张工",
    });
    expect(ret.record.status).toBe("returned");
    expect(ret.reportOutputState).toBe("draft_assist");
  });

  it("refuses to decide a non-waiting record", () => {
    const approved = decideApproval(waitingRecord(), {
      action: "approve",
      decision: "同意",
      approverLabel: "张工",
      evidenceRefs: ["e1"],
    }).record;
    const again = decideApproval(approved, {
      action: "reject",
      decision: "改判",
      approverLabel: "李工",
    });
    expect(again.error).toContain("待审批");
    expect(again.record.status).toBe("approved");
  });
});

describe("advanceSignOff", () => {
  const approved = decideApproval(
    waitingRecord(),
    {
      action: "approve",
      decision: "同意",
      approverLabel: "张工",
      evidenceRefs: ["e1"],
    },
    LATER,
  ).record;

  it("walks professional_reviewed → signoff_ready → signed_record", () => {
    const first = advanceSignOff("professional_reviewed", approved);
    expect(first).toEqual({ next: "signoff_ready", error: null });
    const second = advanceSignOff("signoff_ready", approved);
    expect(second).toEqual({ next: "signed_record", error: null });
  });

  it("blocks sign-off without an approved record", () => {
    const blocked = advanceSignOff("professional_reviewed", waitingRecord());
    expect(blocked.next).toBe("professional_reviewed");
    expect(blocked.error).toContain("已通过");
    expect(advanceSignOff("professional_reviewed", null).error).toContain(
      "已通过",
    );
  });

  it("treats signed_record as terminal and rejects other states", () => {
    expect(advanceSignOff("signed_record", approved).error).toContain("终态");
    expect(advanceSignOff("draft_assist", approved).error).toContain(
      "不可签发",
    );
  });
});

describe("resubmitApproval", () => {
  it("resets a rejected record to waiting and clears the decision", () => {
    const rejected = decideApproval(waitingRecord(), {
      action: "reject",
      decision: "整改",
      approverLabel: "张工",
    }).record;
    const result = resubmitApproval(rejected, LATER);
    expect(result.error).toBeNull();
    expect(result.record.status).toBe("waiting");
    expect(result.record.decision).toBe("");
    expect(result.record.evidenceRefs).toEqual([]);
  });

  it("refuses to resubmit waiting or approved records", () => {
    expect(resubmitApproval(waitingRecord()).error).toContain("重新送审");
  });
});

describe("summarizeApprovals / payload", () => {
  it("counts statuses and reflects sign-off", () => {
    const rejected = decideApproval(waitingRecord(), {
      action: "reject",
      decision: "整改",
      approverLabel: "张工",
    }).record;
    const summary = summarizeApprovals(
      [waitingRecord(), rejected],
      "signed_record",
    );
    expect(summary).toEqual({
      total: 2,
      waiting: 1,
      approved: 0,
      rejected: 1,
      returned: 0,
      signedOff: true,
    });
  });

  it("builds a camelCase gateway payload", () => {
    const payload = buildApprovalUpsertPayload(waitingRecord());
    expect(payload).toEqual({
      approvalKey: "approval-rpt-heavy-steel-001",
      title: "重钢样板工程审核认证单",
      professionalRole: "注册造价工程师",
      status: "waiting",
      decision: "",
      evidenceRefs: [],
    });
  });
});
