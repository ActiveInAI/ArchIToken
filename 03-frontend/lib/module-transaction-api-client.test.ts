import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mapBackendModuleTransaction,
  persistModuleOperationAudit,
} from "./module-transaction-api-client";

describe("module transaction api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("persists module workbench audit events as real backend transactions", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          moduleId: string;
          transactionType: string;
          actor: string;
          relatedArtifactIds: string[];
        };
        return new Response(
          JSON.stringify({
            id: "77777777-7777-4777-8777-777777777777",
            moduleId: body.moduleId,
            transactionType: body.transactionType,
            status: "draft",
            actor: body.actor,
            createdAt: "2026-06-08T10:00:00.000Z",
            updatedAt: "2026-06-08T10:00:00.000Z",
            relatedFileIds: [],
            relatedArtifactIds: body.relatedArtifactIds,
            approvals: [],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(
      fetchMock as unknown as typeof fetch,
    );

    const transaction = await persistModuleOperationAudit({
      moduleId: "detailed_design",
      event: {
        id: "module-backend-unit-1",
        at: "2026-06-08T10:00:00.000Z",
        actor: "Workbench",
        summary: "生成深化图纸包并同步模块",
      },
      source: "unit-test",
    });

    expect(transaction?.moduleId).toBe("detailed_design");
    expect(transaction?.type).toBe("生成深化图纸包并同步模块");
    expect(transaction?.relatedArtifactIds).toEqual([
      "audit:module-backend-unit-1",
      "source:unit-test",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/transactions");
    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"),
    ) as {
      moduleId: string;
      transactionType: string;
      actor: string;
      relatedArtifactIds: string[];
    };
    expect(requestBody).toEqual({
      moduleId: "detailed_design",
      transactionType: "生成深化图纸包并同步模块",
      actor: "Workbench",
      relatedArtifactIds: ["audit:module-backend-unit-1", "source:unit-test"],
    });
  });

  it("does not re-persist backend replay audit events", async () => {
    const fetchMock = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      fetchMock as unknown as typeof fetch,
    );

    const transaction = await persistModuleOperationAudit({
      moduleId: "standard_library",
      event: {
        id: "backend-cde-88888888-8888-4888-8888-888888888888",
        at: "2026-06-08T10:00:00.000Z",
        actor: "BackendModuleFileApiClient",
        summary: "同步后端 CDE 文件节点",
      },
    });

    expect(transaction).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
