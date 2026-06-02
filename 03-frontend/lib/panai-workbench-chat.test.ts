import { describe, expect, it } from 'vitest';
import { resolvePanAINavigationAction } from './panai-workbench-chat';

describe('resolvePanAINavigationAction', () => {
  it('routes module navigation commands to registered module hrefs', () => {
    expect(resolvePanAINavigationAction('进入市场客服模块', 'planning_management')).toMatchObject({
      type: 'navigate_module',
      moduleId: 'marketing_service',
      href: '/app/modules/marketing_service',
    });
  });

  it('recognizes planning aliases from other modules', () => {
    expect(resolvePanAINavigationAction('切换到甘特计划', 'marketing_service')).toMatchObject({
      moduleId: 'planning_management',
      href: '/app/modules/planning_management',
    });
  });

  it('does not navigate for diagnostic questions', () => {
    expect(resolvePanAINavigationAction('为什么还是不能进入市场客服？', 'planning_management')).toBeNull();
  });
});
