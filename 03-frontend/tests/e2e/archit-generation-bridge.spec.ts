// tests/e2e/archit-generation-bridge.spec.ts
// ArchIT 生成台真浏览器验收：户型套件生成 + 候选切换芯片闭环
// License: Apache-2.0

import { expect, test } from "@playwright/test";

test.describe("ArchIT 生成台", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: "architoken_access",
        value: "archit-bridge-e2e",
        url: baseURL ?? "http://127.0.0.1:3000",
      },
    ]);
  });

  test("生成户型套件并通过候选芯片切换重新生成", async ({ page }) => {
    // Two full floorplan-suite generations (layout + DXF + colour SVG + file
    // registration) are CPU-bound and run ~45s locally; constrained CI runners
    // need substantially more headroom, so the budget is generous.
    test.setTimeout(300_000);
    await page.goto("/app/modules/concept_design");

    // 打开生成台浮窗
    const launcher = page.getByRole("button", { name: "打开 ArchIT 生成台" });
    await expect(launcher).toBeVisible({ timeout: 20_000 });
    await launcher.click();
    await expect(page.getByText("ArchIT 生成台")).toBeVisible();

    // 发送户型套件指令（不带全套，避免渲染/IFC 的分钟级耗时）
    const input = page.getByPlaceholder(/请输入需求/);
    await input.fill("生成90平两室一厅的户型");
    await input.press("Enter");

    // 套件产物与交互面板出现
    await expect(page.getByText("户型图纸套件解析结果")).toBeVisible({
      timeout: 150_000,
    });
    await expect(page.getByText(/规范预检报告/)).toBeVisible();
    await expect(page.getByText(/彩平图/).first()).toBeVisible();

    // 候选切换芯片：四候选齐全，点击候选 B 重新生成
    const candidateB = page
      .getByRole("button", { name: /Generate B · 镜像采光/ })
      .first();
    await expect(candidateB).toBeVisible();
    await candidateB.click();

    // 第二轮套件返回，当前候选切换为 Generate B（其芯片在新面板中禁用）
    const summaries = page.getByText("户型图纸套件解析结果");
    await expect(summaries).toHaveCount(2, { timeout: 150_000 });
    const panels = page.locator("text=当前 Generate B · 镜像采光");
    await expect(panels.first()).toBeVisible();

    // 风格预设芯片存在（不实际点击：渲染为分钟级 GPU 任务）
    await expect(
      page.getByRole("button", { name: "新中式" }).first(),
    ).toBeVisible();
  });
});
