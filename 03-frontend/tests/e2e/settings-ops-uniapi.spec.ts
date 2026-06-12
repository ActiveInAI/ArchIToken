// tests/e2e/settings-ops-uniapi.spec.ts
// License: Apache-2.0
// 设置中心 → 运维中心 → UniAPI 页签：状态接口可达、文档入口与（未配置时的）密钥引导可见。

import { expect, test } from "@playwright/test";

test.describe("设置中心 · 运维中心 · UniAPI", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: "architoken_access",
        value: "ops-uniapi-e2e",
        url: baseURL ?? "http://127.0.0.1:3000",
      },
    ]);
  });

  test("opens the UniAPI tab and shows gateway status or key guidance", async ({
    page,
  }) => {
    await page.goto("/app/modules/settings_center");
    await expect(page.getByTestId("settings-center-overview")).toBeVisible();

    await page.getByTestId("settings-center-card-ops").click();
    const opsConsole = page.getByTestId("settings-center-ops-console");
    await expect(opsConsole).toBeVisible();

    await opsConsole.getByRole("button", { name: "API 网关", exact: true }).click();

    // 默认选中最左侧网关（字母序第一个：Agnes AI），文档入口在已配置 / 未配置两种状态下都渲染
    await expect(opsConsole.getByRole("link", { name: "官网" })).toHaveAttribute(
      "href",
      "https://agnes-ai.com/",
      { timeout: 15000 },
    );
    // 切到 UniAPI 后文档入口随网关联动
    await opsConsole.getByRole("button", { name: "UniAPI", exact: true }).click();
    await expect(opsConsole.getByRole("link", { name: "接口文档" })).toBeVisible({
      timeout: 15000,
    });
    await expect(opsConsole.getByRole("link", { name: "官网" })).toHaveAttribute(
      "href",
      "https://uniapi.ai/",
    );

    // 未配置密钥 → 引导文案；已配置 → 模型列表区块。两者必居其一。
    await expect(
      opsConsole.getByText(/尚未配置 UniAPI 密钥|模型列表/).first(),
    ).toBeVisible();
  });

  test("uniapi status endpoint returns a well-formed payload", async ({ request }) => {
    const response = await request.get("/api/ops-center/uniapi");
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as {
      configured: boolean;
      baseUrl: string;
      models: unknown[];
      usageHistory: unknown[];
      warnings: unknown[];
      thresholds: { lowBalanceUsd: number; keyRotateDays: number };
    };
    expect(typeof payload.configured).toBe("boolean");
    expect(payload.baseUrl).toContain("uniapi");
    expect(Array.isArray(payload.models)).toBeTruthy();
    expect(Array.isArray(payload.usageHistory)).toBeTruthy();
    expect(Array.isArray(payload.warnings)).toBeTruthy();
    expect(payload.thresholds.lowBalanceUsd).toBeGreaterThan(0);
    expect(payload.thresholds.keyRotateDays).toBeGreaterThan(0);
  });

  test("agnes gateway endpoint returns a well-formed payload", async ({ request }) => {
    const response = await request.get("/api/ops-center/uniapi?provider=agnes");
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as {
      provider: { id: string; name: string };
      configured: boolean;
      baseUrl: string;
      models: unknown[];
    };
    expect(payload.provider.id).toBe("agnes");
    expect(payload.baseUrl).toContain("agnes");
    expect(Array.isArray(payload.models)).toBeTruthy();
  });
});
