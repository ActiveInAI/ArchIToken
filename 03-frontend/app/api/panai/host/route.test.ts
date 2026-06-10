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
      commands?: string[];
    };

    expect(response.status).toBe(200);
    expect(payload.integrationMode).toBe("direct_api");
    expect(payload.embeddedUi).toBe(false);
    expect(payload.legacyEmbeddedControl).toBe("removed");
    expect(
      payload.routes?.modules?.some(
        (module) => module.id === "planning_management",
      ),
    ).toBe(true);
    expect(payload.commands).toContain("create_folder");
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

  it("records PanAI audit events through the host bridge", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "create_audit_event",
          moduleId: "production_manufacturing",
          actor: "PanAI",
          summary: "PanAI Host 收到用户指令",
        }),
      }),
    );
    const payload = (await response.json()) as {
      moduleId?: string;
      auditEvent?: { actor?: string; summary?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.moduleId).toBe("production_manufacturing");
    expect(payload.auditEvent?.actor).toBe("PanAI");
    expect(payload.auditEvent?.summary).toContain("PanAI Host");
  });

  it("creates a real CDE folder and exposes a frontend refresh event", async () => {
    const contextResponse = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "set_context",
          moduleId: "standard_library",
          parentId: "standard_library-root",
        }),
      }),
    );
    const contextPayload = (await contextResponse.json()) as {
      eventCursor?: number;
    };
    expect(contextResponse.status).toBe(200);

    const response = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "create_folder",
          name: "新建一个文件夹",
        }),
      }),
    );
    const payload = (await response.json()) as {
      action?: string;
      moduleId?: string;
      parentId?: string;
      node?: { id?: string; name?: string; parentId?: string; type?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.action).toBe("create_folder");
    expect(payload.moduleId).toBe("standard_library");
    expect(payload.parentId).toBe("standard_library-root");
    expect(payload.node?.type).toBe("folder");
    expect(payload.node?.parentId).toBe("standard_library-root");
    expect(payload.node?.name).toMatch(/^新建文件夹/);

    const listResponse = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "list_files",
          moduleId: "standard_library",
          parentId: "standard_library-root",
        }),
      }),
    );
    const listPayload = (await listResponse.json()) as {
      files?: Array<{ id?: string; parentId?: string; type?: string }>;
    };
    expect(listResponse.status).toBe(200);
    expect(
      listPayload.files?.some(
        (file) =>
          file.id === payload.node?.id &&
          file.type === "folder" &&
          file.parentId === "standard_library-root",
      ),
    ).toBe(true);

    const pollResponse = await POST(
      new Request("http://localhost:3000/api/panai/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "poll_events",
          since: contextPayload.eventCursor,
        }),
      }),
    );
    const pollPayload = (await pollResponse.json()) as {
      events?: Array<{
        type?: string;
        moduleId?: string;
        parentId?: string;
        node?: { id?: string };
      }>;
    };

    expect(pollResponse.status).toBe(200);
    expect(
      pollPayload.events?.some(
        (event) =>
          event.type === "file_created" &&
          event.moduleId === "standard_library" &&
          event.parentId === "standard_library-root" &&
          event.node?.id === payload.node?.id,
      ),
    ).toBe(true);
  });
});
