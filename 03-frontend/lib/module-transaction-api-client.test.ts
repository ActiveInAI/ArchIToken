import { describe, expect, it } from "vitest";

import { mapBackendModuleTransaction } from "./module-transaction-api-client";

describe("module transaction api client", () => {
  it("maps backend lifecycle transactions into frontend workbench transactions", () => {
    const transaction = mapBackendModuleTransaction({
      id: "33333333-3333-4333-8333-333333333333",
      moduleId: "finance_management",
      transactionType: "合同付款审批",
      status: "pending_approval",
      actor: "Backend",
      createdAt: "2026-06-01T01:00:00.000Z",
      updatedAt: "2026-06-01T01:05:00.000Z",
      relatedFileIds: ["44444444-4444-4444-8444-444444444444"],
      relatedArtifactIds: ["artifact-001"],
      approvals: [],
    });

    expect(transaction.moduleId).toBe("finance_management");
    expect(transaction.currentState).toBe("pending_approval");
    expect(transaction.status).toBe("waiting");
    expect(transaction.approvals[0]?.status).toBe("pending");
    expect(transaction.auditTrail[0]?.summary).toContain("合同付款审批");
  });

  it("keeps approved backend approvals visible in the workbench", () => {
    const transaction = mapBackendModuleTransaction({
      id: "55555555-5555-4555-8555-555555555555",
      moduleId: "human_resources",
      transactionType: "人员资质复核",
      status: "approved",
      actor: "Backend",
      createdAt: "2026-06-01T02:00:00.000Z",
      updatedAt: "2026-06-01T02:05:00.000Z",
      relatedFileIds: [],
      relatedArtifactIds: [],
      approvals: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          transactionId: "55555555-5555-4555-8555-555555555555",
          approver: "业务负责人",
          decision: "approved",
          comment: "证据齐备。",
          decidedAt: "2026-06-01T02:06:00.000Z",
        },
      ],
    });

    expect(transaction.status).toBe("approved");
    expect(transaction.approvals[0]?.status).toBe("approved");
    expect(transaction.approvals[0]?.comment).toBe("证据齐备。");
  });
});
