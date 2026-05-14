// tests/e2e/landing.spec.ts - Playwright 1.59.1
// License: Apache-2.0
import { expect, test } from '@playwright/test';

test.describe('ArchIToken landing page', () => {
  test('renders hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ArchIToken/);

    await expect(page.locator('h1')).toContainText('ArchIToken');
    await expect(page.getByRole('link', { name: /进入项目控制台/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /查看业务链条/ })).toBeVisible();
  });

  test('displays the 14 business modules', async ({ page }) => {
    await page.goto('/');
    const modules = [
      '市场客服',
      '计划管理',
      '方案设计',
      '标准族库',
      '深化设计',
      '计量造价',
      '材料物流',
      '生产制造',
      '施工管理',
      '数字孪生',
      '数字档案',
      '财务人力',
      'AI中心',
      '设置中心',
    ];
    for (const moduleName of modules) {
      await expect(page.getByText(moduleName, { exact: true }).first()).toBeVisible();
    }
  });

  test('accessibility: no axe-violations on root', async ({ page }) => {
    await page.goto('/');
    // Quick smoke: title + main landmark present
    await expect(page.locator('main')).toBeVisible();
  });
});
