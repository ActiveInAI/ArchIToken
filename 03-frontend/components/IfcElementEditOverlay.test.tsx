// components/IfcElementEditOverlay.test.tsx
// License: Apache-2.0
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IfcElementEditOverlay } from "./OpenEngineeringEditor";

function fakeElement() {
  return {
    expressID: 101,
    type: "IfcColumn",
    globalId: "3VDBryIIT4FPByH7WHTIbv",
    name: "钢柱-0001",
    objectType: "",
    tag: "",
    predefinedType: "",
    properties: [],
  } as never;
}

describe("IfcElementEditOverlay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it("submits real write-back operations and shows the new version", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          version: "v1.2",
          applied: [
            {
              globalId: "3VDBryIIT4FPByH7WHTIbv",
              ifcClass: "IfcColumn",
              changes: ["Name: '钢柱-0001' -> 'GZ-1'"],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <IfcElementEditOverlay
        localFileId="local-test-1"
        element={fakeElement()}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/构件名称/), {
      target: { value: "GZ-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /写回 IFC/ }));

    await waitFor(() =>
      expect(screen.getByText(/已写回 v1\.2/)).toBeTruthy(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/local-files/local-test-1/ifc-edit");
    const body = JSON.parse(String(init.body));
    expect(body.operations).toEqual([
      {
        globalId: "3VDBryIIT4FPByH7WHTIbv",
        attributes: { Name: "GZ-1" },
      },
    ]);
  });

  it("refuses to submit when nothing changed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <IfcElementEditOverlay
        localFileId="local-test-1"
        element={fakeElement()}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /写回 IFC/ }));

    await waitFor(() => expect(screen.getByText("没有任何变更。")).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces server rejection verbatim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "ifc_edit_rejected",
            message: "IFC 编辑被拒绝(原子,未部分生效): GlobalId 不存在",
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(
      <IfcElementEditOverlay
        localFileId="local-test-1"
        element={fakeElement()}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/构件名称/), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /写回 IFC/ }));

    await waitFor(() =>
      expect(screen.getByText(/IFC 编辑被拒绝/)).toBeTruthy(),
    );
  });
});
