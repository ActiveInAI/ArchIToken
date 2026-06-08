// components/DatabaseManagerWorkbench.test.tsx - database CRUD workbench interaction tests
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
import { PostgresCrudPanel } from "./DatabaseManagerWorkbench";

const postgresCrudLayoutStorageKey = "architoken.postgres-crud-layout.v2";

const postgresTables = [
  {
    schemaName: "public",
    tableName: "agent_invocations",
    tableType: "BASE TABLE",
    estimatedRows: 0,
    totalBytes: 32768,
    primaryKeyColumns: ["id"],
    columns: [
      {
        columnName: "id",
        dataType: "uuid",
        isNullable: false,
        isPrimaryKey: true,
        ordinalPosition: 1,
      },
    ],
  },
  {
    schemaName: "public",
    tableName: "asset_files",
    tableType: "BASE TABLE",
    estimatedRows: 1,
    totalBytes: 131072,
    primaryKeyColumns: ["id"],
    columns: [
      {
        columnName: "id",
        dataType: "uuid",
        isNullable: false,
        isPrimaryKey: true,
        ordinalPosition: 1,
      },
      {
        columnName: "name",
        dataType: "text",
        isNullable: false,
        isPrimaryKey: false,
        ordinalPosition: 2,
      },
      {
        columnName: "status",
        dataType: "text",
        isNullable: true,
        isPrimaryKey: false,
        ordinalPosition: 3,
      },
    ],
  },
];

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function stubPostgresCrudFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/database-manager/postgresql/crud/tables")) {
      return jsonResponse(postgresTables);
    }
    if (
      url.includes("/api/database-manager/postgresql/crud/rows") &&
      url.includes("tableName=asset_files")
    ) {
      return jsonResponse({
        schemaName: "public",
        tableName: "asset_files",
        primaryKeyColumns: ["id"],
        columns: postgresTables[1]?.columns ?? [],
        rows: [{ id: "asset-1", name: "beam.ifc", status: "ready" }],
        limit: 25,
        offset: 0,
        totalRows: 1,
      });
    }
    if (url.includes("/api/database-manager/postgresql/crud/rows")) {
      return jsonResponse({
        schemaName: "public",
        tableName: "agent_invocations",
        primaryKeyColumns: ["id"],
        columns: postgresTables[0]?.columns ?? [],
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
  window.localStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
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
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(async () => undefined),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PostgresCrudPanel interactions", () => {
  it("opens a table-level context menu from blank CRUD space", async () => {
    vi.stubGlobal("fetch", stubPostgresCrudFetch());
    render(<PostgresCrudPanel />);

    await screen.findByTestId("postgres-crud-panel");
    const emptyCrudSpace = await screen.findByText("没有行数据");

    fireEvent.contextMenu(emptyCrudSpace, { clientX: 180, clientY: 240 });

    const menu = await screen.findByTestId("postgres-crud-context-menu");
    expect(menu.textContent).toContain("新增行");
    expect(menu.textContent).toContain("刷新表/行");
    expect(menu.textContent).toContain("复制表名");
    expect(menu.textContent).toContain("重置表格布局");
  });

  it("opens a row-level context menu without a fixed operation column", async () => {
    vi.stubGlobal("fetch", stubPostgresCrudFetch());
    render(<PostgresCrudPanel />);

    await screen.findByTestId("postgres-crud-panel");
    fireEvent.click(await screen.findByRole("button", { name: /asset_files/ }));

    const rowValue = await screen.findByText("beam.ifc");
    const row = rowValue.closest("tr");
    expect(row).toBeTruthy();

    fireEvent.contextMenu(row as HTMLTableRowElement, {
      clientX: 320,
      clientY: 280,
    });

    const menu = await screen.findByTestId("postgres-crud-context-menu");
    expect(menu.textContent).toContain("编辑选中行");
    expect(menu.textContent).toContain("复制行 JSON");
    expect(menu.textContent).toContain("删除选中行");
  });

  it("resizes PostgreSQL row columns by dragging the header separator", async () => {
    vi.stubGlobal("fetch", stubPostgresCrudFetch());
    render(<PostgresCrudPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /asset_files/ }));
    await screen.findByText("beam.ifc");

    const idResizeHandle = await screen.findByLabelText("调整 id 列宽");
    fireEvent(
      idResizeHandle,
      new MouseEvent("pointerdown", { bubbles: true, clientX: 100 }),
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 220 }));
    window.dispatchEvent(new MouseEvent("pointerup"));

    await waitFor(() => {
      const persisted = window.localStorage.getItem(
        postgresCrudLayoutStorageKey,
      );
      expect(persisted).toContain('"id":');
    });
  });

  it("resizes PostgreSQL CRUD row height by dragging the row handle", async () => {
    vi.stubGlobal("fetch", stubPostgresCrudFetch());
    render(<PostgresCrudPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /asset_files/ }));
    await screen.findByText("beam.ifc");

    const rowHeightHandle = await screen.findAllByLabelText("拖动调整行高");
    fireEvent(
      rowHeightHandle[0] as HTMLElement,
      new MouseEvent("pointerdown", { bubbles: true, clientY: 40 }),
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientY: 70 }));
    window.dispatchEvent(new MouseEvent("pointerup"));

    await waitFor(() => {
      const persisted = window.localStorage.getItem(
        postgresCrudLayoutStorageKey,
      );
      expect(persisted).toContain('"rowHeight":64');
    });
  });
});
