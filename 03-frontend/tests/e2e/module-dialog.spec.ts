// tests/e2e/module-dialog.spec.ts
// License: Apache-2.0

import { expect, test } from '@playwright/test';

test.describe('module global dialog', () => {
  test('routes a Chinese navigation command to settings center', async ({ page }) => {
    await page.goto('/app/modules/material_logistics');
    await page.getByPlaceholder('生成、校核、派生、归档...').fill('打开设置中心');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/app\/modules\/settings_center$/);
    await expect(page.getByRole('heading', { name: /设置中心/ }).first()).toBeVisible();
  });
});
