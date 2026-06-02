// tests/e2e/planning-management.spec.ts
// License: Apache-2.0

import { expect, test } from '@playwright/test';

test.describe('planning management module', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'architoken_access',
        value: 'planning-e2e',
        url: baseURL ?? 'http://127.0.0.1:3000',
      },
    ]);
  });

  test('opens the workbench, switches diagram families, saves and exports a plan package', async ({ page }) => {
    await page.goto('/app/modules/planning_management');

    await expect(page.locator('.open-cde-ribbon')).toHaveCount(0);
    await expect(page.locator('.feichuan-engine-switch')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /当前图表 甘特图/ })).toBeVisible();
    await expect(page.getByText('柔佛 1-2 层重钢结构项目集群').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /进度计划质量/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /企业多项目进度看板/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '企业多项目进度看板明细' })).toHaveCount(0);
    await page.getByRole('button', { name: /企业多项目进度看板/ }).click();
    await expect(page.getByRole('dialog', { name: '企业多项目进度看板明细' })).toBeVisible();
    await expect(page.getByText('企业进度看板')).toBeVisible();
    await expect(page.getByLabel('风险模型设置')).toBeVisible();
    await expect(page.getByLabel('计划资料接口适配台账')).toContainText('MPP/P6/GZP');
    await page.getByLabel('进度高风险阈值').fill('28');
    await expect(page.getByLabel('进度高风险阈值')).toHaveValue('28');
    const boardDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '进度看板导出' }).click();
    await expect((await boardDownload).suggestedFilename()).toMatch(/portfolio-board\.csv$/);
    await page.getByLabel('关闭企业看板').click();
    await expect(page.getByRole('dialog', { name: '企业多项目进度看板明细' })).toHaveCount(0);
    await expect(page.locator('.feichuan-timeline-header.is-single')).toBeVisible();
    await expect(page.locator('.feichuan-timeline-header > div')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /进度绩效指数 SPI/ })).toHaveClass(/is-success|is-warning|is-danger/);
    await expect(page.getByRole('button', { name: /进度预警/ })).toHaveClass(/is-warning/);
    await expect(page.getByRole('button', { name: /重大风险源/ })).toHaveClass(/is-danger/);
    await page.getByRole('button', { name: /进度预警/ }).click();
    await expect(page.getByRole('dialog', { name: '进度预警指标详情' })).toBeVisible();
    await page.getByLabel('关闭指标详情').click();
    await expect(page.locator('.feichuan-control-detail-popup')).toHaveCount(0);

    const taskPane = page.locator('.feichuan-gantt .feichuan-task-pane');
    await expect(taskPane).toBeVisible();
    const initialTaskPaneBox = await taskPane.boundingBox();
    expect(initialTaskPaneBox).not.toBeNull();
    if (!initialTaskPaneBox) throw new Error('expected task pane bounds');
    expect(initialTaskPaneBox.width).toBeLessThanOrEqual(350);
    const resizeHandle = page.getByRole('separator', { name: '调整任务表列宽' });
    const resizeBox = await resizeHandle.boundingBox();
    expect(resizeBox).not.toBeNull();
    if (!resizeBox) throw new Error('expected task pane resize handle bounds');
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 72, resizeBox.y + resizeBox.height / 2);
    await page.mouse.up();
    const resizedTaskPaneBox = await taskPane.boundingBox();
    expect(resizedTaskPaneBox).not.toBeNull();
    if (!resizedTaskPaneBox) throw new Error('expected resized task pane bounds');
    expect(resizedTaskPaneBox.width).toBeGreaterThan(initialTaskPaneBox.width + 40);
    const firstTaskName = page.locator('.feichuan-task-name').first();
    await expect(firstTaskName).toHaveCSS('writing-mode', 'horizontal-tb');
    await expect(firstTaskName).toHaveCSS('white-space', 'normal');

    await expect(page.locator('.feichuan-date-marker.is-data')).toBeVisible();
    await page.getByRole('button', { name: '前锋线' }).click();
    await expect(page.locator('.feichuan-date-marker.is-data')).toHaveCount(0);
    await page.getByRole('button', { name: '前锋线' }).click();
    await expect(page.locator('.feichuan-date-marker.is-data')).toBeVisible();

    await page.locator('.feichuan-task-list .feichuan-task-row').first().dblclick();
    await expect(page.getByRole('dialog', { name: '图上编辑任务浮层' })).toBeVisible();
    await page.getByLabel('关闭图上编辑').click();

    await page.getByRole('button', { name: /当前图表 甘特图/ }).click({ button: 'right' });
    const chartMenu = page.getByRole('menu', { name: '图表右键菜单' });
    await expect(chartMenu).toBeVisible();
    for (const menuText of ['新建甘特图', '保存', '导入', '导出', '另存为', '打印', '分享', '设置']) {
      await expect(chartMenu.getByRole('menuitem', { name: new RegExp(menuText) })).toBeVisible();
    }
    await chartMenu.getByRole('menuitem', { name: /设置/ }).click();
    await expect(page.getByRole('dialog', { name: '图表设置' })).toBeVisible();
    await page.getByLabel('关闭图表设置').click();

    await page.getByRole('button', { name: /当前图表 甘特图/ }).click();
    await page.getByRole('menu', { name: '切换图表视图' }).getByRole('menuitem', { name: /切换到流程图/ }).click();
    await page.getByRole('button', { name: /当前图表 流程图/ }).click({ button: 'right' });
    await expect(page.getByRole('menu', { name: '图表右键菜单' }).getByRole('menuitem', { name: /新建流程图/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: '新建', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '项目与图表启动器' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建项目' })).toBeVisible();
    await expect(page.getByRole('button', { name: '选择项目', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '打开示例计划' })).toBeVisible();
    await expect(page.getByRole('menu', { name: '新建图表类型' })).toBeVisible();
    await page.getByRole('menu', { name: '新建图表类型' }).getByRole('menuitem', { name: /新建甘特图/ }).click();
    await expect(page.locator('.feichuan-task-list').getByText(/新建甘特图 \d{4}-\d{2}-\d{2}/)).toBeVisible();
    await expect(page.getByLabel('编辑任务名称')).toHaveValue(/新建甘特图 \d{4}-\d{2}-\d{2}/);
    await expect(page.locator('.feichuan-task-list').getByText('未命名任务')).toBeVisible();
    await expect(page.locator('.feichuan-engine').getByText(/马来西亚|柔佛/)).toHaveCount(0);
    await page.getByRole('button', { name: '打开示例' }).click();
    await expect(page.getByText('柔佛 1-2 层重钢结构项目集群').first()).toBeVisible();
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '项目与图表启动器' })).toBeVisible();
    await page.getByRole('menu', { name: '新建图表类型' }).getByRole('menuitem', { name: /新建甘特图/ }).click();
    await expect(page.locator('.feichuan-task-list').getByText(/新建甘特图 \d{4}-\d{2}-\d{2}/)).toBeVisible();

    const ganttStage = page.locator('.feichuan-stage-scroll');
    const ganttStageBox = await ganttStage.boundingBox();
    expect(ganttStageBox).not.toBeNull();
    if (!ganttStageBox) throw new Error('expected gantt stage bounds');
    await page.mouse.click(
      ganttStageBox.x + Math.min(760, ganttStageBox.width - 12),
      ganttStageBox.y + Math.min(180, ganttStageBox.height - 12),
      { button: 'right' },
    );
    await expect(page.getByRole('menu', { name: '计划节点右键菜单' })).toBeVisible();
    await expect(page.getByRole('button', { name: /添加子节点/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /当前图表 甘特图/ }).click();
    await page.getByRole('menu', { name: '切换图表视图' }).getByRole('menuitem', { name: /切换到流程图/ }).click();
    await expect(page.getByText('流程图在线编制画布')).toBeVisible();
    await expect(page.locator('.feichuan-diagram .feichuan-task-pane')).toHaveCount(0);
    await page.getByRole('button', { name: '新增节点' }).click();
    await expect(page.locator('.feichuan-diagram-toolbar')).toContainText(/节点 \d+/);

    await page.getByRole('button', { name: /当前图表 流程图/ }).click();
    await page.getByRole('menu', { name: '切换图表视图' }).getByRole('menuitem', { name: /切换到思维导图/ }).click();
    await expect(page.getByText('思维导图在线编制画布')).toBeVisible();
    await expect(page.locator('.feichuan-diagram .feichuan-task-pane')).toHaveCount(0);

    const planningToolbar = page.locator('.feichuan-unified-toolbar');
    await planningToolbar.getByRole('button', { name: '保存', exact: true }).click();
    await planningToolbar.getByRole('button', { name: '导出', exact: true }).click();
    await expect(page.getByRole('menu', { name: '选择计划导出格式' })).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /ArchIToken 计划包/ }).click();
    await expect((await download).suggestedFilename()).toMatch(/\.archiplan\.json$/);
  });

  test('renders every planning chart view without runtime errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/app/modules/planning_management');

    for (const viewName of [
      '甘特图',
      '时标网络图',
      '双代号',
      'PERT图',
      '流程图',
      '思维导图',
      'WBS图',
      '矩阵图',
      '分析图',
      '鱼骨图',
      '燃尽图',
      '燃起图',
      '资源图',
      '风险矩阵',
      'RACI矩阵',
      '价值流图',
      'SWOT图',
    ]) {
      await page.getByRole('button', { name: /当前图表/ }).click();
      await page.getByRole('menu', { name: '切换图表视图' }).getByRole('menuitem', { name: new RegExp(`切换到${viewName}`) }).click();
      await expect(page.getByRole('button', { name: new RegExp(`当前图表 ${viewName}`) })).toBeVisible();
      await expect(page.locator('.feichuan-engine-title strong')).toHaveText(viewName);
    }

    expect(pageErrors).toEqual([]);
  });

  test('imports a CSV style plan table into a new editable gantt baseline', async ({ page }) => {
    await page.goto('/app/modules/planning_management');

    await page.locator('input[aria-label="导入计划包"]').setInputFiles({
      name: 'zpert-sample.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          '编号,任务名称,计划开始,计划完成,进度,负责人,前置任务',
          'A-001,专项计划导入,2026-06-01,2026-06-10,20,计划工程师,',
          'A-002,网络逻辑复核,2026-06-11,2026-06-20,0,计划工程师,A-001',
        ].join('\n'),
        'utf-8',
      ),
    });

    await expect(page.locator('.feichuan-task-list').getByText('导入计划 zpert-sample')).toBeVisible();
    await expect(page.locator('.feichuan-task-list').getByText('专项计划导入')).toBeVisible();
    await expect(page.locator('.feichuan-task-list').getByText('网络逻辑复核')).toBeVisible();
    await expect(page.locator('.feichuan-engine').getByText(/马来西亚|柔佛/)).toHaveCount(0);
  });
});
