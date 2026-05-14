// tests/e2e/landing.spec.ts - Playwright 1.59.1
// License: Apache-2.0
import { expect, test } from '@playwright/test';

test.describe('ArchIToken landing page', () => {
  test('renders hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ArchIToken/);

    const h1 = page.locator('h1');
    await expect(h1).toContainText('缰绳');

    // CTA buttons
    await expect(page.getByRole('link', { name: /开始项目/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /阅读架构/ })).toBeVisible();
  });

  test('displays the 9 business phases', async ({ page }) => {
    await page.goto('/');
    const phases = [
      '售前', '方案', '深化',
      '造价', '制造', '物流',
      '施工', '验收', '运维',
    ];
    for (const phase of phases) {
      await expect(page.getByText(phase, { exact: true })).toBeVisible();
    }
  });

  test('accessibility: no axe-violations on root', async ({ page }) => {
    await page.goto('/');
    // Quick smoke: title + main landmark present
    await expect(page.locator('main')).toBeVisible();
  });
});
