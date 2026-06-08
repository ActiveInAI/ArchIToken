// components/SettingsCenterDatabasePanel.test.tsx - database settings console interaction tests
// License: Apache-2.0
// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsCenterDatabasePanel } from "./SettingsCenterDatabasePanel";
import type { DatabaseRuntimeSnapshot } from "@/lib/database-runtime-types";

const runtimeSnapshot: DatabaseRuntimeSnapshot = {
  generatedAt: "2026-06-08T12:00:00.000Z",
  gateway: {
    status: "ready",
    runtimeProfile: "development",
    persistenceMode: "external",
    databaseMode: "postgres",
    objectStoreMode: "seaweedfs",
    databaseConfigured: true,
    objectStoreConfigured: true,
    queueConfigured: true,
    telemetryConfigured: true,
  },
  bindings: [],
  containers: [],
  errors: [],
  stores: [
    {
      id: "postgres",
      name: "PostgreSQL 主干库",
      group: "architoken",
      category: "relational",
      capability: "relational_store",
      provider: "postgres",
      endpoint: "127.0.0.1:5433",
      status: "live",
      role: "系统主干库",
      source: "gateway",
      fallbackProvider: "memory",
      splitPhase: "phase_1_postgres_trunk",
      externalized: true,
      metrics: [
        { label: "表", value: "89", tone: "good" },
        { label: "容量", value: "27 MB", tone: "good" },
      ],
      managementLinks: [],
      notes: [],
      updatedAt: "2026-06-08T12:00:00.000Z",
    },
    {
      id: "seaweedfs_s3",
      name: "SeaweedFS S3 对象存储",
      group: "architoken",
      category: "object",
      capability: "object_store",
      provider: "seaweedfs_s3",
      endpoint: "127.0.0.1:8333",
      status: "live",
      role: "对象存储",
      source: "gateway",
      fallbackProvider: "local",
      splitPhase: "phase_2_object_store",
      externalized: true,
      metrics: [
        { label: "桶", value: "architoken-assets", tone: "good" },
        { label: "对象", value: "39", tone: "good" },
      ],
      managementLinks: [],
      notes: [],
      updatedAt: "2026-06-08T12:00:00.000Z",
    },
  ],
};

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function stubRuntimeFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/database-runtime")) {
      return jsonResponse(runtimeSnapshot);
    }
    if (url.includes("/api/database-manager/postgresql/crud/tables")) {
      return jsonResponse([]);
    }
    if (url.includes("/api/database-manager/postgresql/crud/rows")) {
      return jsonResponse({
        schemaName: "public",
        tableName: "agent_invocations",
        primaryKeyColumns: ["id"],
        columns: [],
        rows: [],
        limit: 25,
        offset: 0,
        totalRows: 0,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SettingsCenterDatabasePanel interactions", () => {
  it("opens a resource row context menu without changing the selected resource", async () => {
    vi.stubGlobal("fetch", stubRuntimeFetch());
    render(<SettingsCenterDatabasePanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /SeaweedFS S3 对象存储/,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "SeaweedFS S3 对象存储",
        }),
      ).toBeTruthy();
    });

    fireEvent.contextMenu(
      await screen.findByTestId("settings-database-store-postgres"),
      { clientX: 520, clientY: 360 },
    );

    expect(
      await screen.findByTestId("settings-database-context-menu"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "SeaweedFS S3 对象存储",
      }),
    ).toBeTruthy();
  });

  it("falls back to legacy copy when Clipboard API is blocked", async () => {
    vi.stubGlobal("fetch", stubRuntimeFetch());
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("clipboard denied");
        }),
      },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => true),
    });

    render(<SettingsCenterDatabasePanel />);

    fireEvent.click(await screen.findByRole("tab", { name: "连接" }));
    fireEvent.click(await screen.findByRole("button", { name: "复制" }));

    expect(await screen.findByText("连接信息已复制")).toBeTruthy();
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});
