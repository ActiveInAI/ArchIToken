// tests/e2e/landing.spec.ts - Playwright 1.59.1
// License: Apache-2.0
import { expect, test } from "@playwright/test";

test.describe("ArchIToken landing page", () => {
  test("renders hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ArchIToken/);

    await expect(page.locator("h1")).toContainText("ArchIToken");
    await expect(
      page.getByRole("link", { name: /进入项目控制台/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /查看业务链条/ }),
    ).toBeVisible();
  });

  test("displays the 15 public business-chain modules", async ({ page }) => {
    await page.goto("/");
    const modules = [
      "市场客服",
      "计划管理",
      "方案设计",
      "标准族库",
      "深化设计",
      "计量造价",
      "材料物流",
      "生产制造",
      "施工管理",
      "数字孪生",
      "数字档案",
      "财务管理",
      "人力资源",
      "AI中心",
      "设置中心",
    ];
    for (const moduleName of modules) {
      await expect(
        page.getByText(moduleName, { exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("accessibility: no axe-violations on root", async ({ page }) => {
    await page.goto("/");
    // Quick smoke: title + main landmark present
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("AI center routing", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: "architoken_access",
        value: "ai-center-e2e",
        url: baseURL ?? "http://127.0.0.1:3000",
      },
    ]);
  });

  test("keeps the user-selected provider when a stale catalog response returns", async ({
    page,
  }) => {
    await page.route(
      "https://openrouter.ai/api/v1/models?output_modalities=all",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [{ id: "openrouter/stale-catalog-model" }],
          }),
        });
      },
    );

    await page.goto("/app/modules/ai_center");
    await page.getByRole("button", { name: "OpenRouter", exact: true }).click();
    await expect
      .poll(async () => {
        const raw = await page.evaluate(() =>
          localStorage.getItem("architoken.llm_config"),
        );
        return raw ? JSON.parse(raw).provider : null;
      })
      .toBe("openrouter");

    await page.getByRole("button", { name: "vLLM", exact: true }).click();
    await page.waitForTimeout(1_000);

    const storedProvider = await page.evaluate(() => {
      const raw = localStorage.getItem("architoken.llm_config");
      return raw ? JSON.parse(raw).provider : null;
    });
    expect(storedProvider).toBe("vllm");
    await expect(
      page.getByRole("button", { name: "vLLM", exact: true }),
    ).toHaveClass(/arch-card-selected/);
  });
});
