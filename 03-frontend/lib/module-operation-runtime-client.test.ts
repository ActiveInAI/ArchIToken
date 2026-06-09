// lib/module-operation-runtime-client.test.ts
// License: Apache-2.0

import { describe, expect, it, vi } from "vitest";

import {
  normalizeModuleOperationKey,
  recordModuleOperationRuntime,
} from "./module-operation-runtime-client";

describe("module operation runtime client", () => {
  it("normalizes frontend operation ids into database route keys", () => {
    expect(
      normalizeModuleOperationKey("standard_library", "Publish Version!"),
    ).toBe("standard_library.publish_version");
    expect(normalizeModuleOperationKey("ai_center", "agent.flow:Run")).toBe(
      "ai_center.agent.flow:run",
    );
  });

  it("posts module operations through the database-manager proxy", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        expect(_input).toBe("/api/database-manager/module-operations");
        expect(init?.method).toBe("POST");
        expect(payload).toMatchObject({
          moduleId: "construction_management",
          operationKey: "construction_management.site.safety_check",
          operationLabel: "施工安全巡检写入",
          actor: "ModuleOperationalPanel",
          sourceSurface: "module_operational_panel",
          targetType: "module_feature",
          targetId: "safety",
        });
        return new Response(
          JSON.stringify({
            operationRunId: "run-1",
            tenantId: "tenant-1",
            projectId: "project-1",
            moduleId: "construction_management",
            operationSurface: "module_operation_write",
            operationKey: payload.operationKey,
            operationLabel: payload.operationLabel,
            operationKind: payload.operationKind,
            status: payload.status,
            actor: payload.actor,
            sourceSurface: payload.sourceSurface,
            targetType: payload.targetType,
            targetId: payload.targetId,
            idempotencyKey: payload.idempotencyKey,
            requestPayload: payload.requestPayload,
            resultPayload: payload.resultPayload,
            evidence: payload.evidence,
            professionalState: "professional_review_required",
            approvalState: "approval_required",
            eventId: "event-1",
            auditEventId: "audit-1",
            graphEdgeId: "graph-1",
            createdAt: "2026-06-09T00:00:00Z",
            updatedAt: "2026-06-09T00:00:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    );

    const run = await recordModuleOperationRuntime(
      {
        moduleId: "construction_management",
        operationId: "site.safety_check",
        operationLabel: "施工安全巡检写入",
        targetType: "module_feature",
        targetId: "safety",
        idempotencyKey: "frontend:test:construction:safety",
      },
      fetchMock,
    );

    expect(run.operationRunId).toBe("run-1");
    expect(run.graphEdgeId).toBe("graph-1");
  });
});
