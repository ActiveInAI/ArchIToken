// tests/e2e/module-business-home.spec.ts
// License: Apache-2.0

import { expect, test, type Locator } from "@playwright/test";

const sidebarModuleCases = [
  {
    id: "personal_center",
    zhName: "个人中心",
    directoryLabel: "个人审批",
  },
  {
    id: "marketing_service",
    zhName: "市场客服",
    directoryLabel: "0号合伙人",
  },
  {
    id: "planning_management",
    zhName: "计划管理",
    directoryLabel: "马来西亚柔佛 1-2 层重钢结构项目集群",
  },
  {
    id: "concept_design",
    zhName: "方案设计",
    directoryLabel: "场地资料",
  },
  {
    id: "standard_library",
    zhName: "标准族库",
    directoryLabel: "标准规范",
  },
  {
    id: "detailed_design",
    zhName: "深化设计",
    directoryLabel: "钢平台深化包",
  },
  {
    id: "quantity_costing",
    zhName: "计量造价",
    directoryLabel: "变更估算",
  },
  {
    id: "material_logistics",
    zhName: "材料物流",
    directoryLabel: "SS-04-08构件BOM",
  },
  {
    id: "production_manufacturing",
    zhName: "生产制造",
    directoryLabel: "P1生产放行",
  },
  {
    id: "construction_management",
    zhName: "施工管理",
    directoryLabel: "吊装顺序",
  },
  {
    id: "digital_twin",
    zhName: "数字孪生",
    directoryLabel: "WebGPU 快照",
  },
  {
    id: "digital_archive",
    zhName: "数字档案",
    directoryLabel: "马来西亚柔佛 1-2 层重钢结构项目集群",
  },
  {
    id: "finance_management",
    zhName: "财务管理",
    directoryLabel: "财务核对",
  },
  {
    id: "human_resources",
    zhName: "人力资源",
    directoryLabel: "劳动合规",
  },
  {
    id: "ai_center",
    zhName: "AI中心",
    directoryLabel: "AI API网关",
  },
  {
    id: "settings_center",
    zhName: "设置中心",
    directoryLabel: "角色权限",
  },
] as const;

function sidebarDirectoryNode(moduleTree: Locator, label: string) {
  return moduleTree
    .locator(".arch-huly-module-directory-node span")
    .filter({ hasText: label });
}

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
    await moduleTree.getByRole("link", { name: /市场客服/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/marketing_service$/);
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree.getByText("0号合伙人")).toHaveCount(0);
    await moduleTree.getByRole("link", { name: /市场客服/ }).dblclick();
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await moduleTree.getByRole("link", { name: /市场客服/ }).dblclick();
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree.getByText("0号合伙人")).toHaveCount(0);
    await moduleTree.getByRole("link", { name: /市场客服/ }).dblclick();
    await expect(moduleTree).toContainText("0号合伙人");
    await moduleTree.getByRole("link", { name: /方案设计/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/concept_design$/);
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await expect(moduleTree.getByText("场地资料")).toHaveCount(0);
    await moduleTree.getByRole("link", { name: /方案设计/ }).dblclick();
    await expect(moduleTree).toContainText("场地资料");
    const titleX = await page
      .locator(".arch-huly-nav-item.is-active .arch-huly-nav-title")
      .evaluate((element) => element.getBoundingClientRect().x);
    const childX = await page
      .locator(".arch-huly-module-directory-node span")
      .first()
      .evaluate((element) => element.getBoundingClientRect().x);
    expect(Math.abs(titleX - childX)).toBeLessThanOrEqual(2);
    await expect(
      moduleTree.getByRole("link", { name: /计划管理/ }),
    ).toBeVisible();
    await expect(
      moduleTree.getByRole("link", { name: /进度控制/ }),
    ).toHaveCount(0);
    await expect(
      moduleTree.getByRole("link", { name: /审批与审计/ }),
    ).toHaveCount(0);

    await moduleTree.getByRole("link", { name: /施工管理/ }).click();

    await expect(page).toHaveURL(/\/app\/modules\/construction_management$/);
    await expect(
      moduleTree.getByRole("link", { name: /施工管理/ }),
    ).toBeVisible();
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");
    await expect(moduleTree).toContainText("场地资料");
    await expect(moduleTree.getByText("吊装顺序")).toHaveCount(0);
    await moduleTree.getByRole("link", { name: /施工管理/ }).dblclick();
    await expect(moduleTree).toContainText("吊装顺序");

    await moduleTree.getByRole("link", { name: /标准族库/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/standard_library$/);
    const standardDirectoryTexts = moduleTree
      .locator(".arch-huly-module-directory-node span")
      .filter({ hasText: "标准规范" });
    const versionDirectoryTexts = moduleTree
      .locator(".arch-huly-module-directory-node span")
      .filter({ hasText: "版本库" });
    const standardDirectoryText = standardDirectoryTexts.first();
    const versionDirectoryText = versionDirectoryTexts.first();
    await expect(standardDirectoryTexts).toHaveCount(0);
    await expect(versionDirectoryTexts).toHaveCount(0);
    await moduleTree.getByRole("link", { name: /标准族库/ }).dblclick();
    await expect(standardDirectoryText).toBeVisible();
    await expect(versionDirectoryText).toBeVisible();
    const standardDirectoryBox = await standardDirectoryText.boundingBox();
    const versionDirectoryBox = await versionDirectoryText.boundingBox();
    expect(standardDirectoryBox).not.toBeNull();
    expect(versionDirectoryBox).not.toBeNull();
    expect(standardDirectoryBox!.y).toBeLessThan(versionDirectoryBox!.y);
    expect(
      Math.abs(standardDirectoryBox!.x - versionDirectoryBox!.x),
    ).toBeLessThanOrEqual(2);

    await moduleTree.getByRole("link", { name: /标准族库/ }).dblclick();
    await expect(standardDirectoryTexts).toHaveCount(0);
    await expect(versionDirectoryTexts).toHaveCount(0);
    await expect(moduleTree).toContainText("个人审批");
    await expect(moduleTree).toContainText("0号合伙人");

    await moduleTree.getByRole("link", { name: /标准族库/ }).dblclick();
    await expect(standardDirectoryText).toBeVisible();
    await expect(versionDirectoryText).toBeVisible();
  });

  test("audits sidebar single-click and double-click directory behavior across all modules", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    const moduleTree = page.locator(".arch-huly-context");
    const personalDirectoryNode = sidebarDirectoryNode(moduleTree, "个人审批");
    await expect(personalDirectoryNode).toBeVisible();

    for (const moduleCase of sidebarModuleCases) {
      const moduleLink = moduleTree.getByRole("link", {
        name: new RegExp(moduleCase.zhName),
      });
      const currentDirectoryNode = sidebarDirectoryNode(
        moduleTree,
        moduleCase.directoryLabel,
      );

      await moduleLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/app/modules/${moduleCase.id}$`),
      );

      if (moduleCase.id === "personal_center") {
        await expect(currentDirectoryNode).toBeVisible();
        await moduleLink.dblclick();
        await expect(currentDirectoryNode).toHaveCount(0);
        await moduleLink.click();
        await expect(currentDirectoryNode).toHaveCount(0);
        await moduleLink.dblclick();
        await expect(currentDirectoryNode).toBeVisible();
        continue;
      }

      await expect(currentDirectoryNode).toHaveCount(0);
      await expect(personalDirectoryNode).toBeVisible();

      await moduleLink.dblclick();
      await expect(currentDirectoryNode).toBeVisible();
      await expect(personalDirectoryNode).toBeVisible();

      await moduleLink.click();
      await expect(currentDirectoryNode).toBeVisible();
      await expect(personalDirectoryNode).toBeVisible();

      await moduleLink.dblclick();
      await expect(currentDirectoryNode).toHaveCount(0);
      await expect(personalDirectoryNode).toBeVisible();
    }
  });

  test("keeps expanded sidebar directories after module content remounts with stale cookies", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    const moduleTree = page.locator(".arch-huly-context");
    const personalDirectoryNode = sidebarDirectoryNode(moduleTree, "个人审批");
    const standardDirectoryNode = sidebarDirectoryNode(moduleTree, "标准规范");

    await expect(personalDirectoryNode).toBeVisible();
    await moduleTree.getByRole("link", { name: /标准族库/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/standard_library$/);
    await expect(standardDirectoryNode).toHaveCount(0);
    await moduleTree.getByRole("link", { name: /标准族库/ }).dblclick();
    await expect(standardDirectoryNode).toBeVisible();
    await expect(personalDirectoryNode).toBeVisible();
    await expect(page.getByText("建筑工程信息模型语义字典")).toBeVisible();

    await page.evaluate(() => {
      document.cookie =
        "architoken.openModuleDirectoryIds=quantity_costing; path=/; max-age=31536000; samesite=lax";
    });
    await page.reload({ waitUntil: "networkidle" });

    await expect(personalDirectoryNode).toBeVisible();
    await expect(standardDirectoryNode).toBeVisible();
    await expect(sidebarDirectoryNode(moduleTree, "变更估算")).toHaveCount(0);
    await expect(page.getByText("建筑工程信息模型语义字典")).toBeVisible();
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
