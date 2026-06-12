// components/QuantityCostingWorkbench.test.tsx - Quantity costing workbench wiring tests
// License: Apache-2.0
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModuleOperationalPanel } from "@/components/ModuleOperationalPanel";
import { getModuleSpec } from "@/lib/module-registry";

afterEach(() => {
  cleanup();
});

function renderCostingPanel() {
  return render(
    <ModuleOperationalPanel spec={getModuleSpec("quantity_costing")} />,
  );
}

describe("QuantityCosting workbench wiring", () => {
  it("校验检查驱动真实规则引擎并输出结论", () => {
    renderCostingPanel();

    fireEvent.click(screen.getByRole("button", { name: "校验检查" }));

    expect(screen.getByText("编码格式校验")).toBeTruthy();
    expect(screen.getByText("核增核减平衡校验")).toBeTruthy();
    expect(screen.getByText("校验结论")).toBeTruthy();
    // 样例工程的钢构件审定价 6920 偏离定额组价基准,触发单价偏差警告
    expect(screen.getByText("综合单价偏差校验")).toBeTruthy();
    expect(screen.getAllByText(/偏离定额组价/).length).toBeGreaterThan(0);
  });

  it("审定计算式可编辑且回车后重算审定工程量", () => {
    renderCostingPanel();

    const input = screen.getByLabelText(
      "计算式(审定)",
    ) as HTMLInputElement;
    expect(input.value).toBe("25.8+1.4");

    fireEvent.change(input, { target: { value: "25.8+SSL*0.1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // SSL=送审工程量 25.8 → 25.8+2.58=28.38
    expect(
      screen.getByText(/审定计算式已生效：25.8\+SSL\*0.1 = 28.38/),
    ).toBeTruthy();
  });

  it("非法计算式不生效并提示错误", () => {
    renderCostingPanel();

    const input = screen.getByLabelText("计算式(审定)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25.8+*2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText(/审定计算式未生效/)).toBeTruthy();
  });

  it("审定转预算生成真实预算版本与凭证计划", () => {
    renderCostingPanel();

    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    fireEvent.click(screen.getByRole("button", { name: "审定转预算" }));
    fireEvent.click(screen.getByRole("button", { name: "费用分析" }));

    expect(
      screen.getByText(/\[审定预算\]锦屏应舍美居重钢样板工程/),
    ).toBeTruthy();
    expect(screen.getByText("审定结算凭证计划合计")).toBeTruthy();
    expect(screen.getAllByText("已生成凭证草稿").length).toBeGreaterThan(0);
  });

  it("简便设计编辑页眉并实时预览，表头列设置控制报表网格", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    const analysisTabs = document.querySelector(
      ".arch-gccp-analysis-tabs",
    ) as HTMLElement;
    fireEvent.click(
      within(analysisTabs).getByRole("button", { name: "审核报告" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "简便设计" }));
    const headerInput = screen.getByLabelText(
      "页眉中部内容",
    ) as HTMLInputElement;
    expect(headerInput.value).toBe("审核报表");
    fireEvent.change(headerInput, { target: { value: "竣工结算审核报表" } });

    expect(screen.getByText(/页眉：.*竣工结算审核报表/)).toBeTruthy();
    expect(screen.getByText(/页脚：.*第 1 页/)).toBeTruthy();

    // 隐藏「序号」列后预览与设计状态同步
    fireEvent.click(screen.getByRole("checkbox", { name: "序号" }));
    expect(screen.getByText("已更新表头列设置")).toBeTruthy();
  });

  it("水印按文字→图片→无循环切换并提示图片未选图", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    const analysisTabs = document.querySelector(
      ".arch-gccp-analysis-tabs",
    ) as HTMLElement;
    fireEvent.click(
      within(analysisTabs).getByRole("button", { name: "审核报告" }),
    );

    const watermarkButton = screen.getByRole("button", { name: "水印" });
    fireEvent.click(watermarkButton);
    expect(
      screen.getAllByText(/图片水印 company-seal.png/).length,
    ).toBeGreaterThan(0);

    fireEvent.click(watermarkButton);
    expect(screen.getAllByText("无水印").length).toBeGreaterThan(0);

    fireEvent.click(watermarkButton);
    expect(screen.getAllByText(/文字水印「ArchIToken/).length).toBeGreaterThan(
      0,
    );
  });

  it("临时编辑在未生成报告时给出引导，统一替换输出单位工程计划", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    const analysisTabs = document.querySelector(
      ".arch-gccp-analysis-tabs",
    ) as HTMLElement;
    fireEvent.click(
      within(analysisTabs).getByRole("button", { name: "审核报告" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "临时编辑" }));
    expect(screen.getByText("无可编辑内容 · 先生成审核报告")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "统一替换" }));
    expect(
      screen.getAllByText(/统一替换 \d+ 个单位工程 · 待专业复核/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("已统一替换单位工程报表方案与设计")).toBeTruthy();
  });
});
