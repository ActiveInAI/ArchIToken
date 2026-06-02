// tests/e2e/module-dialog.spec.ts
// License: Apache-2.0

import { expect, test } from '@playwright/test';

test.describe('legacy embedded AI control', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'architoken_access',
        value: 'module-dialog-e2e',
        url: baseURL ?? 'http://127.0.0.1:3000',
      },
    ]);
  });

  test('does not mount the legacy embedded control on module workbenches', async ({ page }) => {
    await page.goto('/app/modules/material_logistics');

    await expect(page.locator('button[aria-label*="全局控制台"]')).toHaveCount(0);
    await expect(page.locator('iframe[title*="Control"]')).toHaveCount(0);
  });

  test('does not mount the legacy embedded control on detailed design', async ({ page }) => {
    await page.goto('/app/modules/detailed_design');

    await expect(page.locator('button[aria-label*="全局控制台"]')).toHaveCount(0);
    await expect(page.locator('iframe[title*="Control"]')).toHaveCount(0);
  });
});
