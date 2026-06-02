// app/api/panai/host/route.test.ts - PanAI direct-control host bridge contracts
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("PanAI host bridge", () => {
  it("exposes direct API control and does not advertise embedded UI", async () => {
    const response = await GET();
    const payload = (await response.json()) as {
      integrationMode?: string;
      embeddedUi?: boolean;
      legacyEmbeddedControl?: string;
      routes?: { modules?: Array<{ id?: string; routeHref?: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.integrationMode).toBe("direct_api");
    expect(payload.embeddedUi).toBe(false);
    expect(payload.legacyEmbeddedControl).toBe("removed");
    expect(payload.routes?.modules?.some((module) => module.id === "planning_management")).toBe(true);
  });

  it("returns controlled navigation instructions for PanAI", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "navigate_module",
          moduleId: "planning-management",
        }),
      }),
    );
    const payload = (await response.json()) as {
      href?: string;
      auditEvent?: { actor?: string; summary?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.href).toBe("/app/modules/planning_management");
    expect(payload.auditEvent?.actor).toBe("PanAI");
    expect(payload.auditEvent?.summary).toContain("计划管理");
  });

  it("runs artifact actions through the ArchIToken gate chain", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "run_artifact_action",
          moduleId: "planning_management",
          artifactId: "wbs-baseline",
          action: "approve",
        }),
      }),
    );
    const payload = (await response.json()) as {
      controlledBy?: string;
      result?: { artifact?: { status?: string }; action?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.controlledBy).toBe("PanAI");
    expect(payload.result?.action).toBe("approve");
    expect(payload.result?.artifact?.status).toBe("approved");
  });
});
