// tests/e2e/module-dialog.spec.ts
// License: Apache-2.0

import { expect, test } from '@playwright/test';

test.describe('module global dialog', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'architoken_access',
        value: 'module-dialog-e2e',
        url: baseURL ?? 'http://127.0.0.1:3000',
      },
    ]);
  });

  test('opens PanAI control with the current module context', async ({ page }) => {
    await page.goto('/app/modules/material_logistics');
    await page.getByRole('button', { name: '打开 PanAI 全局控制台' }).click();

    const frame = page.locator('iframe[title="PanAI Control - 材料物流"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /hostModule=material_logistics/);
    await expect(frame).toHaveAttribute('src', /hostSurface=module_workbench/);
  });

  test('opens PanAI control with detailed design context', async ({ page }) => {
    await page.goto('/app/modules/detailed_design');
    await page.getByRole('button', { name: '打开 PanAI 全局控制台' }).click();

    const frame = page.locator('iframe[title="PanAI Control - 深化设计"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /hostModule=detailed_design/);
    await expect(frame).toHaveAttribute('src', /hostAssistant=architoken/);
  });
});
