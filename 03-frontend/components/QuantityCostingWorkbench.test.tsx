// components/QuantityCostingWorkbench.test.tsx - Quantity costing workbench wiring tests
// License: Apache-2.0
// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModuleOperationalPanel } from "@/components/ModuleOperationalPanel";
import { getModuleSpec } from "@/lib/module-registry";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it("批量载价生成计划预览，后端不可达时本地兜底应用", async () => {
    renderCostingPanel();

    const priceCsv = [
      "资源编号,资源名称,单价,来源",
      "labor-steel-install,钢构件安装人工,300,川价信息2026-06",
      "no-such-id,不存在资源,1,x",
    ].join("\n");
    const input = screen.getByLabelText("市场价文件") as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([priceCsv], "川价信息.csv", { type: "text/csv" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/载价计划: 匹配 1\/2 条 · 待确认/)).toBeTruthy();
    });
    expect(screen.getByText("编号匹配")).toBeTruthy();
    expect(
      screen.getAllByText("未匹配", { selector: "td" }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "确认载价" }));
    await waitFor(() => {
      expect(
        screen.getByText(/本地载价 1 条|已载价 1 条资源/),
      ).toBeTruthy();
    });
  });

  it("导入定额解析失败时给出行级错误提示", async () => {
    renderCostingPanel();

    const badCsv = "名称,单位\n钢梁,t";
    const input = screen.getByLabelText("定额库文件") as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([badCsv], "残缺定额.csv", { type: "text/csv" })],
      },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/导入失败: 表头缺少必需列: 定额编号/),
      ).toBeTruthy();
    });
  });

  it("审批流: 送审→通过→两步签发到签章归档", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    const analysisTabs = document.querySelector(
      ".arch-gccp-analysis-tabs",
    ) as HTMLElement;
    fireEvent.click(
      within(analysisTabs).getByRole("button", { name: "审核报告" }),
    );

    // 未送审先签发被拦截
    fireEvent.click(screen.getByRole("button", { name: "签发" }));
    expect(
      screen.getByText(/签发前必须有已通过的注册造价工程师审批单/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "送审审批" }));
    expect(screen.getByText(/已送审 注册造价工程师 · 待审批/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "审批通过" }));
    expect(screen.getByText(/已通过 · 核增核减口径符合/)).toBeTruthy();
    expect(screen.getByText("专业已复核")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "签发" }));
    expect(screen.getByText("可签发")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "签发" }));
    expect(screen.getByText("已签章归档")).toBeTruthy();

    // 终态后再签发被拦截
    fireEvent.click(screen.getByRole("button", { name: "签发" }));
    expect(screen.getByText(/已签章归档，为终态/)).toBeTruthy();
  });

  it("审批流: 驳回回到规则校验态，重新送审后可再裁决", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    const analysisTabs = document.querySelector(
      ".arch-gccp-analysis-tabs",
    ) as HTMLElement;
    fireEvent.click(
      within(analysisTabs).getByRole("button", { name: "审核报告" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "送审审批" }));
    fireEvent.click(screen.getByRole("button", { name: "审批驳回" }));
    expect(screen.getByText(/已驳回 · 费率\/口径存在问题/)).toBeTruthy();
    expect(screen.getByText("规则校验通过")).toBeTruthy();

    // 驳回状态不可直接再裁决
    fireEvent.click(screen.getByRole("button", { name: "审批通过" }));
    expect(screen.getByText(/只有待审批状态可裁决/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "重新送审" }));
    expect(screen.getByText("整改后已重新送审 · 待审批")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "审批通过" }));
    expect(screen.getByText("专业已复核")).toBeTruthy();
  });

  it("凭证移交财务: 未审批被阻断，审批通过后放行", async () => {
    renderCostingPanel();

    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    fireEvent.click(screen.getByRole("button", { name: "审定转预算" }));

    fireEvent.click(screen.getByRole("button", { name: "移交财务" }));
    expect(
      screen.getByText(/移交被阻断: 需注册造价工程师审批通过/),
    ).toBeTruthy();

    const analysisTabs = document.querySelector(
      ".arch-gccp-analysis-tabs",
    ) as HTMLElement;
    fireEvent.click(
      within(analysisTabs).getByRole("button", { name: "审核报告" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "送审审批" }));
    fireEvent.click(screen.getByRole("button", { name: "审批通过" }));

    fireEvent.click(screen.getByRole("button", { name: "移交财务" }));
    await waitFor(() => {
      expect(
        screen.getByText(/数据服务未连接 · 暂存本地待移交|已移交财务/),
      ).toBeTruthy();
    });
  });

  it("Excel 导出生成真实工作簿（6 张工作表）并应用报表设计", async () => {
    renderCostingPanel();

    fireEvent.click(screen.getByRole("button", { name: "分析与报告" }));
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /(已导出|已生成) 6 张工作表 · \[审核\]锦屏应舍美居重钢样板工程-报表\.xlsx/,
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("样例态显示演示横幅，提供新建工程入口", () => {
    renderCostingPanel();
    // 未接通后端时显示演示样例横幅
    expect(
      screen.getByText(/演示样例 · 点「新建工程」开始录入真实工程/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "新建工程" }));
    expect(
      screen.getByRole("dialog", { name: "新建工程" }),
    ).toBeTruthy();
    expect(screen.getByText("新建空白造价工程")).toBeTruthy();
  });

  it("新增清单行追加到分部分项并标记待自动保存", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "新增清单" }));
    expect(
      screen.getAllByText("新增清单项").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/自动保存: 有改动 · 待自动保存/)).toBeTruthy();
  });

  it("空工程名新建被拦截", () => {
    renderCostingPanel();
    fireEvent.click(screen.getByRole("button", { name: "新建工程" }));
    fireEvent.click(
      screen.getByRole("button", { name: "创建并开始录入" }),
    );
    expect(screen.getByText(/自动保存: 工程名称不能为空/)).toBeTruthy();
  });

  it("IFC反查: 上传→几何实测→映射 GB 清单→填充分部分项", async () => {
    const manifest = {
      summary: {
        lineCount: 2,
        elementCount: 8,
        totalWeightKg: 3000,
        geometryFailures: 0,
        byClass: { IfcColumn: 5, IfcBeam: 3 },
      },
      lines: [
        {
          lineNo: 1,
          category: "钢柱",
          ifcClass: "IfcColumn",
          sectionLabel: "H306X151X8X12",
          lengthMm: 3000,
          quantity: 5,
          unitWeightKg: 200,
          totalWeightKg: 1000,
          storeys: { "1F": 5 },
          globalIds: ["g1"],
        },
        {
          lineNo: 2,
          category: "钢梁",
          ifcClass: "IfcBeam",
          sectionLabel: "H500X200X10X16",
          lengthMm: 6000,
          quantity: 3,
          unitWeightKg: 666,
          totalWeightKg: 2000,
          storeys: { "1F": 3 },
          globalIds: ["g2"],
        },
      ],
    };
    // 按 URL 分派：挂载时的后端 API 调用一律失败回落，仅拦 IFC 上传/提取
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/api/local-files/upload")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            file: { fileId: "local-test-ifc", originalName: "钢框架.ifc" },
          }),
        });
      }
      if (typeof url === "string" && url.includes("/bom-export")) {
        return Promise.resolve({ ok: true, json: async () => manifest });
      }
      if (
        typeof url === "string" &&
        url.includes("/quantity-costing/semantic-categories")
      ) {
        // 真实 SJG157 钢结构小类（经 request 包装，需含 headers/status）
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({
            standard_code: "SJG 157-2024",
            categories: [
              {
                code: "30-03.95.03",
                name_zh: "钢柱",
                ifc_entity: "IfcColumn",
                table_code: "30",
                object_group: "element",
                level_name: "小类",
                parent_code: null,
              },
              {
                code: "30-03.95.09",
                name_zh: "钢梁",
                ifc_entity: "IfcBeam",
                table_code: "30",
                object_group: "element",
                level_name: "小类",
                parent_code: null,
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error("backend unavailable in test"));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    renderCostingPanel();
    const input = screen.getByLabelText("IFC模型文件") as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(["IFC"], "钢框架.ifc", { type: "application/octet-stream" }),
        ],
      },
    });

    // 映射出 SJG157 钢结构清单（钢柱/钢梁），带真实字典编码填入分部分项
    await waitFor(() => {
      expect(document.body.textContent).toContain("30-03.95.03");
    });
    expect(document.body.textContent).toContain("30-03.95.09");
    expect(screen.getAllByText("钢柱").length).toBeGreaterThan(0);
    expect(screen.getAllByText("钢梁").length).toBeGreaterThan(0);
    // SJG157 字典查询确有发起
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("/quantity-costing/semantic-categories"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("/api/local-files/upload"),
      ),
    ).toBe(true);
  });
});
