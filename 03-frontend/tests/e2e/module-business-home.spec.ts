// tests/e2e/module-business-home.spec.ts
// License: Apache-2.0

import { expect, test } from "@playwright/test";

test.describe("module business home shell", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: "architoken_access",
        value: "module-home-e2e",
        url: baseURL ?? "http://127.0.0.1:3000",
      },
    ]);
  });

  for (const moduleId of ["marketing_service", "planning_management"]) {
    test(`hides the generic CDE ribbon on dedicated ${moduleId} business home`, async ({
      page,
    }) => {
      await page.goto(`/app/modules/${moduleId}`);

      await expect(page.locator(".open-cde-business-panel")).toBeVisible();
      await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    });
  }

  test("opens detailed_design as the steel platform 2D to 3D workbench", async ({
    page,
  }) => {
    await page.goto("/app/modules/detailed_design");

    await expect(
      page.locator('[data-business-context-root="steel-platform"]'),
    ).toBeVisible();
    await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    await expect(
      page.getByText("装配式钢结构深化工作室").first(),
    ).toBeVisible();
    await expect(page.getByText("2D 平面图").first()).toBeVisible();
    await expect(page.getByText("3D 模型").first()).toBeVisible();
    await expect(page.getByText("工程量 BOM").first()).toBeVisible();

    await page
      .getByRole("button", { name: /生成布局/ })
      .first()
      .click();
    await expect(page.getByText(/空间块/).first()).toBeVisible();
    await page
      .getByRole("button", { name: /算工程量/ })
      .first()
      .click();
    await expect(page.getByText(/工程量 BOM/).first()).toBeVisible();
  });

  test("uses a single module sidebar with icons and labels without a global top directory bar", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    const moduleTree = page.locator(".arch-huly-context");
    await expect(page.locator(".arch-workbench-primary-nav")).toHaveCount(0);
    await expect(page.locator(".arch-workbench-domain-tabs")).toHaveCount(0);
    await expect(page.locator(".arch-workbench-breadcrumbbar")).toHaveCount(0);
    await expect(page.locator(".arch-huly-rail")).toHaveCount(0);
    await expect(page.locator(".arch-huly-module-dot")).toHaveCount(0);
    await expect(page.locator(".arch-huly-nav-item")).toHaveCount(16);
    await expect(page.locator(".arch-huly-nav-icon")).toHaveCount(16);
    await expect(page.locator(".arch-huly-nav-index")).toHaveCount(0);
    await expect(moduleTree).toContainText("个人审批");
    await page.getByRole("button", { name: "仅显示模块图标" }).click();
    await expect(page.locator(".arch-huly-context.is-compact")).toBeVisible();
    await expect(page.locator(".arch-huly-nav-item")).toHaveCount(16);
    await expect(page.locator(".arch-huly-nav-icon")).toHaveCount(16);
    await expect(page.locator(".arch-huly-nav-label")).toHaveCount(0);
    await expect(moduleTree).not.toContainText("业务增长");
    await expect(moduleTree).not.toContainText("计划管理");

    await moduleTree.getByRole("link", { name: /市场客服/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/marketing_service$/);
    await expect(page.locator(".arch-huly-context.is-compact")).toBeVisible();
    await expect(page.locator(".arch-huly-nav-label")).toHaveCount(0);

    await page.getByRole("button", { name: "展开模块目录" }).click();
    await expect(page.locator(".arch-huly-context.is-compact")).toHaveCount(0);
    await expect(moduleTree).toContainText("业务增长");
    await expect(moduleTree).toContainText("现场交付");
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await moduleTree.getByRole("link", { name: /市场客服/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/marketing_service$/);
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await moduleTree.getByRole("link", { name: /方案设计/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/concept_design$/);
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await expect(moduleTree).toContainText("场地资料");
    const titleX = await page
      .locator(".arch-huly-nav-item.is-active .arch-huly-nav-title")
      .evaluate((element) => element.getBoundingClientRect().x);
    const childX = await page
      .locator(".arch-huly-module-directory-node span")
      .first()
      .evaluate((element) => element.getBoundingClientRect().x);
    expect(Math.abs(titleX - childX)).toBeLessThanOrEqual(2);
    await expect(moduleTree.getByRole("link", { name: /计划管理/ })).toBeVisible();
    await expect(moduleTree.getByRole("link", { name: /进度控制/ })).toHaveCount(
      0,
    );
    await expect(moduleTree.getByRole("link", { name: /审批与审计/ })).toHaveCount(
      0,
    );

    await moduleTree.getByRole("link", { name: /施工管理/ }).click();

    await expect(page).toHaveURL(/\/app\/modules\/construction_management$/);
    await expect(moduleTree.getByRole("link", { name: /施工管理/ })).toBeVisible();
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await expect(moduleTree).toContainText("场地资料");
    await expect(moduleTree.getByRole("link", { name: /吊装顺序/ })).toHaveCount(
      0,
    );
  });

  for (const moduleId of [
    "standard_library",
    "material_logistics",
    "construction_management",
    "digital_archive",
  ]) {
    test(`keeps ${moduleId} file-first surface without the root ribbon`, async ({
      page,
    }) => {
      await page.goto(`/app/modules/${moduleId}`);

      await expect(page.locator(".open-cde-business-panel")).toHaveCount(0);
      await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    });
  }
});
