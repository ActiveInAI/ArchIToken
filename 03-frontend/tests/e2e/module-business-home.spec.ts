// tests/e2e/module-business-home.spec.ts
// License: Apache-2.0

import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function visibleBox(locator: Locator, label: string) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  // boundingBox() can momentarily return null while the element re-lays out
  // (e.g. right after a sidebar directory expand on a slower CI runner). Poll
  // until it reports real layout bounds instead of failing on a transient null.
  await expect(async () => {
    const pending = await locator.boundingBox();
    expect(pending, `${label} should have layout bounds`).not.toBeNull();
    expect(pending?.width ?? 0).toBeGreaterThan(8);
    expect(pending?.height ?? 0).toBeGreaterThan(8);
  }).toPass({ timeout: 5_000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} should have layout bounds`);
  return box;
}

async function wheelSidebarNav(page: Page, nav: Locator, deltaY: number) {
  const box = await visibleBox(nav, "module sidebar navigation");
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.wheel(0, deltaY);
}

async function openSettingsPeoplePage(page: Page) {
  await page.goto("/app/modules/settings_center");
  await expect(page.getByTestId("settings-center-overview")).toBeVisible();
  await page.getByTestId("settings-center-card-identity").click();
  const settingsCrud = page.getByTestId("settings-center-crud");
  await expect(settingsCrud).toBeVisible();
  return settingsCrud;
}

async function resolveWorkbenchColor(page: Page, cssVariableName: string) {
  return page
    .locator(".open-cde-explorer")
    .first()
    .evaluate((element, variableName) => {
      const rawValue = getComputedStyle(element)
        .getPropertyValue(variableName)
        .trim();
      const probe = document.createElement("span");
      probe.style.color = rawValue;
      document.body.appendChild(probe);
      const resolvedColor = getComputedStyle(probe).color;
      probe.remove();
      return resolvedColor;
    }, cssVariableName);
}

async function expectWorkbenchSurfaceGeometry(page: Page) {
  const sidebarBox = await visibleBox(
    page.locator(".arch-huly-context"),
    "module sidebar",
  );
  const surfaceBox = await visibleBox(
    page.locator(".open-cde-explorer").first(),
    "Open CDE workbench surface",
  );
  const viewport = page.viewportSize();

  expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(surfaceBox.x + 2);
  if (viewport) {
    expect(surfaceBox.x + surfaceBox.width).toBeLessThanOrEqual(
      viewport.width + 2,
    );
    expect(surfaceBox.height).toBeLessThanOrEqual(viewport.height + 2);
  }
}

const visualViewportCases = [
  {
    label: "desktop",
    size: { width: 1440, height: 900 },
    sidebarCompact: false,
  },
  {
    label: "mobile compact",
    size: { width: 390, height: 844 },
    sidebarCompact: true,
  },
] as const;

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

  for (const viewportCase of visualViewportCases) {
    test(`renders digital_twin inside the unified Open CDE workbench on ${viewportCase.label}`, async ({
      page,
      context,
      baseURL,
    }) => {
      // Digital twin is the heaviest module surface (WebGPU probe + audited
      // Three.js fallback + multiple layout-geometry assertions). The default 30s
      // budget is too tight against a cold CI dev server, so give it headroom.
      test.setTimeout(90_000);
      await page.setViewportSize(viewportCase.size);
      await context.addCookies([
        {
          name: "architoken.moduleSidebarCompact",
          value: viewportCase.sidebarCompact ? "true" : "false",
          url: baseURL ?? "http://127.0.0.1:3000",
        },
      ]);

      await page.goto("/app/modules/digital_twin");

      await expect(page.locator(".arch-huly-context")).toBeVisible();
      await expect(page.locator(".open-cde-explorer")).toBeVisible();
      await expect(page.locator(".open-cde-business-panel")).toBeVisible();
      await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
      await expect(page.locator(".arch-workbench-primary-nav")).toHaveCount(0);
      await expect(page.locator(".arch-workbench-domain-tabs")).toHaveCount(0);
      await expect(page.locator(".arch-workbench-breadcrumbbar")).toHaveCount(
        0,
      );
      await expect(
        page.getByText("材料数字化工厂孪生系统").first(),
      ).toBeVisible();
      await expect(
        page.locator(".arch-digital-twin-viewport canvas").first(),
      ).toBeVisible();
      await expect(
        page
          .locator(".arch-digital-twin-panel")
          .filter({ hasText: /WebGPU|Audited fallback|WebGPU init/ })
          .first(),
      ).toBeVisible();
      await expectWorkbenchSurfaceGeometry(page);
      const twinViewportBox = await visibleBox(
        page.locator(".arch-digital-twin-viewport").first(),
        "digital twin viewport",
      );
      expect(twinViewportBox.width).toBeGreaterThan(
        viewportCase.sidebarCompact ? 260 : 960,
      );
      expect(twinViewportBox.height).toBeGreaterThan(520);
      // The viewport-geometry assertions above already prove the digital twin
      // renders inside the workbench. A full page.screenshot() here only served
      // as a debug attachment but blocks on document.fonts.ready, which can hang
      // indefinitely on a headless CI runner without the web fonts — so it is
      // intentionally omitted to keep the surface assertion deterministic.
    });
  }

  for (const moduleId of ["marketing_service", "planning_management"]) {
    test(`hides the generic CDE ribbon on dedicated ${moduleId} business home`, async ({
      page,
    }) => {
      await page.goto(`/app/modules/${moduleId}`);

      await expect(page.locator(".open-cde-business-panel")).toBeVisible();
      await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    });
  }

  test("opens detailed_design as the component BOM workbench and keeps steel platform available", async ({
    page,
  }) => {
    await page.goto("/app/modules/detailed_design");

    await expect(page.getByText("构件物料清单").first()).toBeVisible();
    await expect(page.getByText("SJG 157 类目").first()).toBeVisible();
    await expect(page.getByText("命名规则").first()).toBeVisible();
    await expect(
      page.getByText("19 个校验警告，0 个错误").first(),
    ).toBeVisible();
    await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);

    await page.getByRole("button", { name: "2D/3D深化" }).click();

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

  test("allows manual sidebar resizing below the old 220px floor without icon-only collapse", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/modules/personal_center");

    const moduleTree = page.locator(".arch-huly-context");
    const resizeHandle = page.getByRole("separator", {
      name: "调整模块导航栏宽度",
    });
    const startBox = await visibleBox(moduleTree, "module sidebar");
    expect(startBox.width).toBeGreaterThan(220);

    await expect(
      resizeHandle,
      "sidebar resize handle should be visible",
    ).toBeVisible();
    const handleBox = await resizeHandle.boundingBox();
    expect(
      handleBox,
      "sidebar resize handle should have layout bounds",
    ).not.toBeNull();
    if (!handleBox) throw new Error("sidebar resize handle should have bounds");
    const handleStartX = handleBox.x + 2;
    const handleStartY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(handleStartX, handleStartY);
    await page.mouse.down();
    await page.mouse.move(handleStartX - 140, handleStartY, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => (await moduleTree.boundingBox())?.width ?? 0)
      .toBeLessThan(170);
    await expect
      .poll(async () => (await moduleTree.boundingBox())?.width ?? 0)
      .toBeGreaterThan(130);
    await expect(moduleTree).toHaveClass(/is-narrow-labels/);
    await expect(moduleTree).not.toHaveClass(/is-compact/);
    await expect(page.getByTestId("module-nav-personal_center")).toContainText(
      "个人中心",
    );
  });

  test("keeps personal center accents restrained to action state", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    const explorer = page.locator(".open-cde-explorer").first();
    await expect(explorer).toHaveClass(/arch-module-accent-blue/);

    const accentColor = await resolveWorkbenchColor(page, "--module-accent");
    const softAccentColor = await resolveWorkbenchColor(
      page,
      "--module-accent-soft",
    );
    const eyebrow = page.getByText("Personal Command Center");
    const activityBanner = page.getByText("个人中心仅显示真实运行时数据。");

    await expect(eyebrow).toBeVisible();
    await expect(activityBanner).toBeVisible();
    await expect
      .poll(() =>
        eyebrow.evaluate((element) => getComputedStyle(element).color),
      )
      .toBe("rgb(95, 99, 104)");
    await expect
      .poll(() =>
        activityBanner.evaluate((element) => getComputedStyle(element).color),
      )
      .toBe(accentColor);
    await expect
      .poll(() =>
        activityBanner.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe(softAccentColor);
  });

  test("opens actionable right-click menu without seeded fake approvals", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    await expect(page.getByText(/default transaction created/)).toHaveCount(0);

    const approvalRows = page
      .locator("table")
      .filter({ hasText: "事项" })
      .first()
      .locator("tbody tr");

    // 等待真实队列数据或空态出现，避免在异步加载完成前取行数
    await expect(
      approvalRows.first().or(page.getByText("暂无真实待审批事项")),
    ).toBeVisible({ timeout: 15000 });

    if ((await approvalRows.count()) > 0) {
      await approvalRows.first().click({ button: "right" });

      const menu = page.getByRole("menu", { name: "审批操作" });
      await expect(menu).toBeVisible();
      await expect(
        menu.getByRole("menuitem", { name: /展开审批详情/ }),
      ).toBeVisible();
      await expect(
        menu.getByRole("menuitem", { name: /打开来源模块/ }),
      ).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: /通过/ })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: /退回/ })).toBeVisible();
      return;
    }

    await expect(page.getByText("暂无真实待审批事项")).toBeVisible();
    await page.getByRole("heading", { name: "审批工作区" }).click({
      button: "right",
    });
    const menu = page.getByRole("menu", { name: "个人中心" });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /定位待处理审批/ }),
    ).toBeVisible();
  });

  test("creates a real personal approval transaction from the empty queue", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    await page.getByRole("button", { name: "新建审批" }).first().click();
    await expect(page.getByLabel("审批事项名称")).toBeVisible();
    await page.getByLabel("审批事项名称").fill("现场签证审批测试");
    await page.getByRole("button", { name: "提交审批" }).click();

    await expect(page.getByText("现场签证审批测试").first()).toBeVisible();
    await expect(page.getByText(/default transaction created/)).toHaveCount(0);

    const detail = page.getByRole("region", {
      name: /审批详情 现场签证审批测试/,
    });
    await expect(detail).toBeVisible();
    await expect(
      detail.getByRole("heading", { name: "审批详情" }),
    ).toBeVisible();
    await detail
      .getByRole("heading", { name: "审批详情" })
      .click({ button: "right" });
    const menu = page.getByRole("menu", { name: "审批操作" });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /展开审批详情/ }),
    ).toBeVisible();
  });

  test("shows settings people search results instead of a blank approval detail", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    await page.getByPlaceholder("搜索审批、模块、人员").fill("皮卡丘");

    await expect(page.getByText(/人员目录命中.*皮卡丘/).first()).toBeVisible();
    await expect(page.getByText("真实审批事务").first()).toBeVisible();
    await expect(page.getByText("设置中心人员目录").first()).toBeVisible();
    await expect(page.getByText("皮卡丘").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "清空搜索" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "新建审批" })).toHaveCount(1);
  });

  test("searches approvals by approver and opens approval notices", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    await page.getByRole("button", { name: "新建审批" }).first().click();
    await page.getByLabel("审批事项名称").fill("材料样板审批");
    await page.getByLabel("审批人").selectOption("皮卡丘");
    await page.getByRole("button", { name: "提交审批" }).click();
    // 主从布局：详情常驻中栏，提交后直接可见
    await expect(
      page.getByRole("region", { name: /审批详情 材料样板审批/ }),
    ).toBeVisible();

    await page.getByPlaceholder("搜索审批、模块、人员").fill("皮卡丘");
    await expect(
      page.locator("tbody tr").filter({ hasText: "材料样板审批" }).first(),
    ).toBeVisible();

    await page.getByPlaceholder("搜索审批、模块、人员").fill("不存在的审批");
    await expect(
      page.getByText(/没有找到“不存在的审批”关联的真实审批/).first(),
    ).toBeVisible();
    await page.getByText("待处理审批: 材料样板审批").click();

    await expect(page.getByPlaceholder("搜索审批、模块、人员")).toHaveValue("");
    await expect(
      page.getByRole("region", { name: /审批详情 材料样板审批/ }),
    ).toBeVisible();
  });

  test("toggles the personal account panel from the top-right avatar", async ({
    page,
  }) => {
    await page.goto("/app/modules/personal_center");

    const accountButton = page.getByRole("button", { name: "账号资料" });
    const accountPanel = page.getByRole("dialog", { name: "个人资料" });

    await expect(accountButton).toBeVisible();
    await expect(accountPanel).toHaveCount(0);

    await accountButton.click();
    await expect(accountPanel).toBeVisible();
    await expect(accountButton).toHaveAttribute("aria-expanded", "true");

    await accountButton.click();
    await expect(accountPanel).toHaveCount(0);
    await expect(accountButton).toHaveAttribute("aria-expanded", "false");
  });

  test("toggles the audit drawer from the sidebar header", async ({ page }) => {
    await page.goto("/app/modules/settings_center");

    const moduleTree = page.locator(".arch-huly-context");
    const contextHeader = moduleTree.locator(".arch-huly-context-header");
    const auditToggle = contextHeader.getByRole("button", {
      name: "打开审计面板",
    });

    await expect(auditToggle).toBeVisible();
    await expect(contextHeader.locator("svg")).toHaveCount(1);
    await expect(page.getByText("操作审计")).toHaveCount(0);

    await auditToggle.click();
    await expect(
      contextHeader.getByRole("button", { name: "关闭审计面板" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("操作审计")).toBeVisible();

    await contextHeader.getByRole("button", { name: "关闭审计面板" }).click();
    await expect(page.getByText("操作审计")).toHaveCount(0);
    await expect(
      contextHeader.getByRole("button", { name: "打开审计面板" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("opens a shared right-click menu for every module sidebar entry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/modules/ai_center");

    const moduleTree = page.locator(".arch-huly-context");

    for (const moduleCase of sidebarModuleCases) {
      const moduleLink = moduleTree.getByTestId(`module-nav-${moduleCase.id}`);

      await moduleLink.scrollIntoViewIfNeeded();
      await moduleLink.click({ button: "right" });

      const menu = page.getByTestId("module-context-menu");
      await expect(menu).toBeVisible();
      await expect(menu).toContainText(moduleCase.zhName);
      await expect(
        menu.getByRole("menuitem", { name: "打开模块" }),
      ).toBeVisible();
      await expect(
        menu.getByRole("menuitem", { name: /子目录/ }),
      ).toBeVisible();
      await expect(
        menu.getByRole("menuitem", { name: "复制模块路径" }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }

    await moduleTree
      .getByTestId("module-nav-settings_center")
      .click({ button: "right" });
    await page
      .getByTestId("module-context-menu")
      .getByRole("menuitem", { name: "打开模块" })
      .click();
    await expect(page).toHaveURL(/\/app\/modules\/settings_center$/);
  });

  test("keeps manual sidebar scroll position during module route changes", async ({
    page,
  }) => {
    await page.goto("/app/modules/marketing_service");
    const moduleTree = page.locator(".arch-huly-context");
    const nav = page.locator(".arch-huly-context-nav");
    await moduleTree.getByRole("link", { name: /标准族库/ }).dblclick();
    await moduleTree.getByRole("link", { name: /计量造价/ }).dblclick();
    await moduleTree.getByRole("link", { name: /材料物流/ }).dblclick();
    await wheelSidebarNav(page, nav, 360);
    await expect
      .poll(() => nav.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await expect(
      moduleTree.getByRole("link", { name: /材料物流/ }),
    ).toBeVisible();
    const manualScrollTop = await nav.evaluate((element) => element.scrollTop);

    await moduleTree.getByRole("link", { name: /材料物流/ }).click();
    await expect(page).toHaveURL(/\/app\/modules\/material_logistics$/);

    await expect
      .poll(() => nav.evaluate((element) => element.scrollTop))
      .toBeCloseTo(manualScrollTop, 0);

    await page.mouse.move(900, 420);
    await page.mouse.wheel(0, 700);
    await expect
      .poll(() => nav.evaluate((element) => element.scrollTop))
      .toBeCloseTo(manualScrollTop, 0);

    await wheelSidebarNav(page, nav, 700);
    await expect
      .poll(
        async () =>
          (await nav.evaluate((element) => element.scrollTop)) >
          manualScrollTop,
      )
      .toBe(true);
  });

  test("routes cross-module sidebar folder clicks to the owning module folder", async ({
    page,
  }) => {
    await page.goto("/app/modules/marketing_service");

    const moduleTree = page.locator(".arch-huly-context");
    await expect(page.getByText("灵感来自每一位创作者")).toBeVisible();
    await expect(sidebarDirectoryNode(moduleTree, "0号合伙人")).toBeVisible();

    await moduleTree
      .getByTestId("module-nav-standard_library")
      .scrollIntoViewIfNeeded();
    await moduleTree
      .getByTestId("module-nav-standard_library")
      .click({ button: "right" });
    await page
      .getByTestId("module-context-menu")
      .getByRole("menuitem", { name: /展开子目录/ })
      .click();

    const enterpriseFolder = moduleTree.getByRole("button", {
      name: /^企业工法$/,
    });
    await expect(enterpriseFolder).toBeVisible();
    await expect(sidebarDirectoryNode(moduleTree, "0号合伙人")).toBeVisible();

    await enterpriseFolder.click();

    await expect(page).toHaveURL(/\/app\/modules\/standard_library$/);
    await expect(page.getByText("灵感来自每一位创作者")).toHaveCount(0);
    await expect(page.locator(".arch-huly-nav-item.is-active")).toContainText(
      "标准族库",
    );
    await expect(
      moduleTree.getByRole("button", { name: /^企业工法$/ }),
    ).toHaveClass(/is-active/);
    await expect(page.locator(".open-cde-statusbar")).toContainText(
      "选中: 企业工法",
    );
  });

  test("opens production manufacturing CDE folders from the sidebar", async ({
    page,
  }) => {
    await page.goto("/app/modules/production_manufacturing");

    const moduleTree = page.locator(".arch-huly-context");
    // The active module auto-expands its directory tree on navigation; an explicit
    // dblclick toggle would race the async expand and collapse it again.
    const releaseFolder = sidebarDirectoryNode(moduleTree, "P1生产放行");

    await expect(releaseFolder).toBeVisible();
    await releaseFolder.click();

    await expect(page).toHaveURL(/\/app\/modules\/production_manufacturing$/);
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();
    await expect(page.locator(".open-cde-statusbar")).toContainText(
      "选中: P1生产放行",
    );
    await expect(page.locator(".open-cde-business-panel")).toHaveCount(0);
  });

  test("audits sidebar single-click and double-click directory behavior across all modules", async ({
    page,
  }) => {
    test.setTimeout(60_000);
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

      await moduleLink.scrollIntoViewIfNeeded();
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

    const scrollModel = await page.evaluate(() => {
      const nav = document.querySelector(".arch-huly-context-nav");
      const directories = Array.from(
        document.querySelectorAll(".arch-huly-module-directory"),
      );
      return {
        navCanScroll: nav ? nav.scrollHeight > nav.clientHeight : false,
        nestedScrollableDirectories: directories.filter(
          (directory) =>
            directory.scrollHeight > directory.clientHeight &&
            getComputedStyle(directory).overflowY !== "visible",
        ).length,
      };
    });
    expect(scrollModel.navCanScroll).toBe(true);
    expect(scrollModel.nestedScrollableDirectories).toBe(0);
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
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.localStorage.getItem("architoken.openModuleDirectoryIds") ??
            "",
        ),
      )
      .toContain("personal_center");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.localStorage.getItem("architoken.openModuleDirectoryIds") ??
            "",
        ),
      )
      .toContain("standard_library");

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

  test("double-clicks sidebar subdirectories to toggle child directories without inline rename", async ({
    page,
  }) => {
    await page.goto("/app/modules/standard_library");

    const moduleTree = page.locator(".arch-huly-context");
    const standardFolder = moduleTree.getByRole("button", {
      name: /^标准规范$/,
    });
    const nationalStandardsFolder = moduleTree.getByRole("button", {
      name: /^中国国家标准$/,
    });

    await expect(standardFolder).toBeVisible();
    await expect(nationalStandardsFolder).toHaveCount(0);

    await standardFolder.click();
    await expect(nationalStandardsFolder).toHaveCount(0);
    await expect(
      moduleTree.locator(".arch-huly-module-directory-node input"),
    ).toHaveCount(0);

    await standardFolder.dblclick();
    await expect(nationalStandardsFolder).toBeVisible();
    await expect(
      moduleTree.locator(".arch-huly-module-directory-node input"),
    ).toHaveCount(0);

    await standardFolder.dblclick();
    await expect(nationalStandardsFolder).toHaveCount(0);
  });

  test("opens file explorer rows from the visible name and keeps right-click context actions", async ({
    page,
  }) => {
    await page.goto("/app/modules/standard_library");

    const standardFolderRow = page
      .locator(".open-cde-file-row")
      .filter({ hasText: "标准规范" })
      .first();
    const standardFolderName = standardFolderRow
      .locator(".arch-huly-file-name")
      .first();

    await expect(standardFolderRow).toBeVisible();
    await standardFolderName.click({ button: "right" });
    await expect(
      page.getByRole("menu", { name: /标准规范操作菜单/ }),
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^打开/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /重命名/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("menu", { name: /标准规范操作菜单/ }),
    ).toHaveCount(0);

    await standardFolderName.dblclick();
    await expect(page.locator(".open-cde-inline-rename")).toHaveCount(0);
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();
    await expect(page.locator(".open-cde-statusbar")).toContainText(
      "选中: 标准规范",
    );
  });

  test("uses one return menu before create in the file ribbon and context menu", async ({
    page,
  }) => {
    await page.goto("/app/modules/standard_library");

    const moduleTree = page.locator(".arch-huly-context");
    await moduleTree.getByRole("button", { name: /^标准规范$/ }).click();
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();

    const ribbonActions = page.locator(".open-cde-ribbon-actions");
    const returnButton = ribbonActions.getByRole("button", { name: /返回/ });
    const createButton = ribbonActions.getByRole("button", { name: /新建/ });

    await expect(returnButton).toHaveCount(1);
    await expect(returnButton).toBeVisible();
    await expect(
      ribbonActions.getByRole("button", { name: /返回上一级/ }),
    ).toHaveCount(0);
    await expect(
      ribbonActions.getByRole("button", { name: /返回主目录/ }),
    ).toHaveCount(0);
    await expect(createButton).toBeVisible();

    const returnX = await returnButton.evaluate(
      (element) => element.getBoundingClientRect().x,
    );
    const createX = await createButton.evaluate(
      (element) => element.getBoundingClientRect().x,
    );
    expect(returnX).toBeLessThan(createX);

    await returnButton.click();
    const returnMenu = page.getByRole("menu", { name: "返回" });
    await expect(returnMenu).toBeVisible();
    await returnMenu.getByRole("menuitem", { name: /返回上一级/ }).click();
    await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    await expect(
      page.locator(".open-cde-file-row").filter({ hasText: "标准规范" }),
    ).toBeVisible();

    await page
      .locator(".open-cde-file-row")
      .filter({ hasText: "标准规范" })
      .first()
      .dblclick();
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();
    await returnButton.click();
    await returnMenu.getByRole("menuitem", { name: /返回主目录/ }).click();
    await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    await expect(
      page.locator(".open-cde-file-row").filter({ hasText: "标准规范" }),
    ).toBeVisible();

    await page
      .locator(".open-cde-file-row")
      .filter({ hasText: "标准规范" })
      .first()
      .dblclick();
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();
    await page.locator(".open-cde-stage").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 520,
          clientY: rect.top + 520,
        }),
      );
    });
    const contextMenu = page.getByRole("menu", {
      name: "文件空白区域操作菜单",
    });
    await expect(contextMenu).toBeVisible();
    const contextReturn = contextMenu.getByRole("menuitem", { name: /^返回$/ });
    const contextCreate = contextMenu.getByRole("menuitem", { name: /^新建/ });
    await expect(contextReturn).toBeVisible();
    await expect(contextCreate).toBeVisible();
    const contextReturnY = await contextReturn.evaluate(
      (element) => element.getBoundingClientRect().y,
    );
    const contextCreateY = await contextCreate.evaluate(
      (element) => element.getBoundingClientRect().y,
    );
    expect(contextReturnY).toBeLessThan(contextCreateY);
    await contextReturn.hover();
    await expect(page.getByRole("menu", { name: "返回" })).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /返回上一级/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /返回主目录/ }),
    ).toBeVisible();
  });

  test("uses one button to switch between detailed and icon views", async ({
    page,
  }) => {
    await page.goto("/app/modules/standard_library");

    const moduleTree = page.locator(".arch-huly-context");
    await moduleTree.getByRole("button", { name: /^标准规范$/ }).click();
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();
    await expect(page.locator(".open-cde-file-row").first()).toBeVisible();

    const viewToggle = page.getByRole("button", { name: /切换到图标视图/ });
    await expect(viewToggle).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "详细信息视图", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "图标视图", exact: true }),
    ).toHaveCount(0);

    await viewToggle.click();
    await expect(page.locator(".open-cde-file-card").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /切换到详细信息视图/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /切换到详细信息视图/ }).click();
    await expect(page.locator(".open-cde-file-row").first()).toBeVisible();
  });

  test("opens AI center model service and membership pages", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/app/modules/ai_center");

    await expect(page.getByTestId("ai-center-card-modelService")).toBeVisible();
    await expect(page.getByTestId("ai-center-card-routing")).toHaveCount(0);
    await expect(page.getByTestId("ai-center-card-inference")).toHaveCount(0);
    await expect(page.getByTestId("ai-center-card-membership")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hugging Face", exact: true }),
    ).toHaveCount(0);

    await page.getByTestId("ai-center-card-modelService").click();
    await expect(
      page.getByRole("button", { name: "Hugging Face", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("选择模型 (Model)")).toBeVisible();
    await page.getByRole("button", { name: "返回" }).click();

    await page.getByTestId("ai-center-card-membership").click();
    await expect(page.getByText("会员充值").first()).toBeVisible();
    await expect(page.getByTestId("ai-plan-card-professional")).toBeVisible();
    await expect(page.getByTestId("ai-plan-card-team")).toBeVisible();
    await expect(page.getByTestId("ai-billing-checkout")).toHaveCount(0);

    await page.getByTestId("ai-plan-card-team").scrollIntoViewIfNeeded();
    await page.getByTestId("ai-plan-card-team").click();
    await expect(page.getByTestId("ai-billing-checkout")).toBeVisible();
    await expect(page.getByRole("heading", { name: "套餐订单" })).toBeVisible();
    const checkoutBox = await page
      .getByTestId("ai-billing-checkout")
      .boundingBox();
    const checkoutSummaryBox = await page
      .getByTestId("ai-checkout-summary")
      .boundingBox();
    if (!checkoutBox || !checkoutSummaryBox) {
      throw new Error("Unable to measure AI checkout summary layout");
    }
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(checkoutBox.width).toBeGreaterThan(viewportWidth * 0.72);
    expect(checkoutSummaryBox.width).toBeGreaterThan(checkoutBox.width * 0.8);
    expect(checkoutSummaryBox.height).toBeLessThan(260);
    await expect(
      page.getByRole("button", { name: "返回会员充值" }),
    ).toBeVisible();
  });

  test("opens settings center cards as separate internal pages", async ({
    page,
  }) => {
    await page.goto("/app/modules/settings_center");

    await expect(page.getByTestId("settings-center-overview")).toBeVisible();
    await expect(
      page.getByTestId("settings-center-card-identity"),
    ).toBeVisible();
    await expect(
      page.getByTestId("settings-center-card-database"),
    ).toBeVisible();
    await expect(page.getByTestId("settings-center-crud")).toHaveCount(0);

    await page.getByTestId("settings-center-card-identity").click();
    await expect(page.getByTestId("settings-center-crud")).toBeVisible();
    await page.getByRole("button", { name: "返回" }).click();

    await page.getByTestId("settings-center-card-database").click();
    await expect(page.getByTestId("settings-database-runtime")).toBeVisible();
  });

  test("opens settings center right-click menus for identity and database rows", async ({
    page,
  }) => {
    const settingsCrud = await openSettingsPeoplePage(page);

    await page
      .getByTestId("settings-person-person-pikachu")
      .click({ button: "right" });
    await expect(
      page.getByTestId("settings-identity-context-menu"),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "编辑人员" }),
    ).toBeVisible();

    await settingsCrud.getByRole("button", { name: "部门管理" }).click();
    await page
      .getByTestId("settings-unit-unit-management")
      .click({ button: "right" });
    await expect(
      page.getByTestId("settings-identity-context-menu"),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "编辑部门" }),
    ).toBeVisible();

    await settingsCrud.getByRole("button", { name: "岗位管理" }).click();
    await page
      .getByTestId("settings-position-pos-chairman")
      .click({ button: "right" });
    await expect(
      page.getByTestId("settings-identity-context-menu"),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "编辑岗位" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "返回" }).click();
    await expect(page.getByTestId("settings-center-overview")).toBeVisible();
    await page.getByTestId("settings-center-card-database").click();
    await expect(page.getByTestId("settings-database-runtime")).toBeVisible();
    await page.getByRole("button", { name: /SeaweedFS S3 对象存储/ }).click();
    await expect(
      page.getByTestId("settings-database-store-grid"),
    ).toBeVisible();
    const firstDatabaseRow = page
      .locator('tr[data-testid^="settings-database-store-"]')
      .filter({ hasText: "SeaweedFS S3 对象存储" })
      .first();
    await expect(firstDatabaseRow).toBeVisible();
    await firstDatabaseRow.scrollIntoViewIfNeeded();
    const databaseRowBox = await visibleBox(firstDatabaseRow, "database row");
    await page.mouse.click(
      databaseRowBox.x + 24,
      databaseRowBox.y + databaseRowBox.height / 2,
      { button: "right" },
    );
    await expect(
      page.getByTestId("settings-database-context-menu"),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /进入二级管理|查看 fallback 说明/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "复制连接/端口" }),
    ).toBeVisible();
  });

  test("appends new positions and reorders them from the context menu", async ({
    page,
  }) => {
    const settingsCrud = await openSettingsPeoplePage(page);
    await settingsCrud.getByRole("button", { name: "岗位管理" }).click();

    const positionRows = page.locator('[data-testid^="settings-position-"]');
    const originalCount = await positionRows.count();
    await expect(positionRows.first()).toContainText("董事长");
    await expect(positionRows.nth(originalCount - 1)).toContainText(
      "材料工程师",
    );

    await page.getByRole("button", { name: "新建岗位" }).click();
    await page.getByTestId("settings-position-name").fill("CFO");
    await page.getByTestId("settings-position-level").fill("L2");
    await page.getByTestId("settings-save-person").click();

    await expect(positionRows).toHaveCount(originalCount + 1);
    await expect(positionRows.first()).toContainText("董事长");
    await expect(positionRows.nth(originalCount)).toContainText("CFO");

    await positionRows.nth(originalCount).click({ button: "right" });
    const positionMenu = page.getByTestId("settings-identity-context-menu");
    await expect(positionMenu).toBeVisible();
    await expect(
      positionMenu.getByRole("menuitem", { name: "下移" }),
    ).toBeDisabled();
    await positionMenu.getByRole("menuitem", { name: "上移" }).click();

    await expect(positionRows.nth(originalCount - 1)).toContainText("CFO");
    await expect(positionRows.nth(originalCount)).toContainText("材料工程师");

    await positionRows.nth(originalCount - 1).click({ button: "right" });
    await expect(positionMenu).toBeVisible();
    await positionMenu.getByRole("menuitem", { name: "下移" }).click();

    await expect(positionRows.nth(originalCount)).toContainText("CFO");
  });

  test("inserts a new position below the row used to create it", async ({
    page,
  }) => {
    const settingsCrud = await openSettingsPeoplePage(page);
    await settingsCrud.getByRole("button", { name: "岗位管理" }).click();

    const positionRows = page.locator('[data-testid^="settings-position-"]');
    const productionManagerRow = page.getByTestId(
      "settings-position-pos-production-manager",
    );
    await productionManagerRow.scrollIntoViewIfNeeded();
    const productionManagerIndex = await positionRows.evaluateAll((rows) =>
      rows.findIndex((row) => row.textContent?.includes("生产经理")),
    );
    expect(productionManagerIndex).toBeGreaterThanOrEqual(0);

    await productionManagerRow.click({ button: "right" });
    await page
      .getByTestId("settings-identity-context-menu")
      .getByRole("menuitem", { name: "新建岗位" })
      .click();

    await expect(page.getByTestId("settings-position-level")).toHaveValue("L2");
    await page.getByTestId("settings-position-name").fill("技术总工");
    await page.getByTestId("settings-save-person").click();

    const insertedRow = positionRows.nth(productionManagerIndex + 1);
    await expect(insertedRow).toContainText("技术总工");
    await expect(insertedRow).toContainText("项目交付部");
    await expect(insertedRow).toContainText("L2");
  });

  test("persists deleted positions after reload", async ({ page }) => {
    const settingsCrud = await openSettingsPeoplePage(page);
    await settingsCrud.getByRole("button", { name: "岗位管理" }).click();

    const materialEngineerRow = page.getByTestId(
      "settings-position-pos-material-engineer",
    );
    await materialEngineerRow.scrollIntoViewIfNeeded();
    await expect(materialEngineerRow).toBeVisible();
    await materialEngineerRow.click({ button: "right" });

    await page
      .getByTestId("settings-identity-context-menu")
      .getByRole("menuitem", { name: "删除岗位" })
      .click();

    await expect(materialEngineerRow).toHaveCount(0);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("settings-center-card-identity").click();
    const reloadedSettingsCrud = page.getByTestId("settings-center-crud");
    await expect(reloadedSettingsCrud).toBeVisible();
    await reloadedSettingsCrud
      .getByRole("button", { name: "岗位管理" })
      .click();
    await expect(
      page.getByTestId("settings-position-pos-material-engineer"),
    ).toHaveCount(0);
  });

  test("opens the create command as a cascading menu instead of a floating dialog", async ({
    page,
  }) => {
    await page.goto("/app/modules/standard_library");

    const moduleTree = page.locator(".arch-huly-context");
    await moduleTree.getByRole("button", { name: /^标准规范$/ }).click();
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();

    await page
      .locator(".open-cde-ribbon")
      .getByRole("button", { name: /新建/ })
      .click();

    await expect(page.getByRole("menu", { name: "新建" })).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭 新建" })).toHaveCount(
      0,
    );

    await page.getByRole("menuitem", { name: /新建文件/ }).hover();
    await expect(
      page.getByRole("menu", { name: "新建文件类型" }),
    ).toBeVisible();

    await page.getByRole("menuitem", { name: /创建位置/ }).hover();
    await expect(
      page.getByRole("menu", { name: "选择创建位置" }),
    ).toBeVisible();
  });

  test("keeps the create location submenu open while scrolling through folders", async ({
    page,
  }) => {
    await page.goto("/app/modules/material_logistics");

    const moduleTree = page.locator(".arch-huly-context");
    // The active module auto-expands its directory tree on navigation, so the
    // folder node is present without an explicit expand toggle (a dblclick here
    // would race the async expand and collapse it again).
    const packageFolder = sidebarDirectoryNode(moduleTree, "包装单元");

    await expect(packageFolder).toBeVisible();
    await packageFolder.click();
    await expect(page.locator(".open-cde-ribbon")).toBeVisible();

    await page
      .locator(".open-cde-ribbon")
      .getByRole("button", { name: /新建/ })
      .click();
    await page.getByRole("menuitem", { name: /创建位置/ }).hover();

    const locationMenu = page.getByRole("menu", { name: "选择创建位置" });
    await expect(locationMenu).toBeVisible();
    await expect
      .poll(() =>
        locationMenu.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);

    await locationMenu.hover();
    await page.mouse.wheel(0, 520);

    await expect(locationMenu).toBeVisible();
    await expect(page.getByRole("menu", { name: "新建" })).toBeVisible();
    await expect
      .poll(() => locationMenu.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  });

  test("keeps standard_library file-first surface without the root ribbon", async ({
    page,
  }) => {
    await page.goto("/app/modules/standard_library");

    await expect(page.locator(".open-cde-business-panel")).toHaveCount(0);
    await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
  });

  // BOM 派生链三模块（commit c538c7d）以 BomChainPanel 作为业务首页:
  // 业务面板必须呈现且加载出 BOM 链真实内容，root ribbon 仍不出现。
  for (const [moduleId, panelTitle] of [
    ["material_logistics", "构件物料 BOM 派生链"],
    ["construction_management", "施工安装 BOM 链"],
    ["digital_archive", "数字档案 · BOM 归档链"],
  ] as const) {
    test(`shows ${moduleId} BOM chain business home without the root ribbon`, async ({
      page,
    }) => {
      await page.goto(`/app/modules/${moduleId}`);

      await expect(page.locator(".open-cde-business-panel")).toHaveCount(1);
      await expect(page.getByText(panelTitle).first()).toBeVisible({
        timeout: 20000,
      });
      await expect(page.locator(".open-cde-ribbon")).toHaveCount(0);
    });
  }
});
