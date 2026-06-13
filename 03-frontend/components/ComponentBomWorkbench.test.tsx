// components/ComponentBomWorkbench.test.tsx - Component BOM workbench contract tests
// License: Apache-2.0
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComponentBomWorkbench } from "@/components/ComponentBomWorkbench";

afterEach(() => {
  cleanup();
});

describe("ComponentBomWorkbench", () => {
  it("renders source-derived BOM counts and review-required state", () => {
    render(<ComponentBomWorkbench />);

    expect(screen.getByText("构件物料清单")).toBeTruthy();
    expect(screen.getByText("SJG 157 类目")).toBeTruthy();
    expect(screen.getByText("5678")).toBeTruthy();
    expect(screen.getByText("命名规则")).toBeTruthy();
    expect(screen.getByText("41")).toBeTruthy();
    expect(screen.getByText("BOM 行")).toBeTruthy();
    // 去 mock:初始无导入,BOM 行/校验均为 0(不再展示 demo 14 行/19 警告)
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getByText("professional_review_required")).toBeTruthy();
    expect(screen.getByText("0 个校验警告，0 个错误")).toBeTruthy();
  });

  it("shows source workbook evidence and blocks publish before approval", () => {
    render(<ComponentBomWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "源表" }));
    expect(
      screen.getByText("建筑工程信息模型语义字典编码表_SJG157-2024.xlsx"),
    ).toBeTruthy();
    expect(
      screen.getByText("装配式钢结构建筑构件标准化命名规则V1.0.xlsx"),
    ).toBeTruthy();
    expect(screen.getByText("（待导入）构件物料清单.xlsx")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /发布/ }));
    expect(screen.getByText("下游发布被阻止")).toBeTruthy();
    expect(screen.getByText(/未经专业批准/)).toBeTruthy();
  });
});
