import { describe, expect, it } from 'vitest';
import { resolveOpenClawNavigationAction } from './openclaw-workbench-chat';

describe('resolveOpenClawNavigationAction', () => {
  it('routes module navigation commands to registered module hrefs', () => {
    expect(resolveOpenClawNavigationAction('进入市场客服模块', 'planning_management')).toMatchObject({
      type: 'navigate_module',
      moduleId: 'marketing_service',
      href: '/app/modules/marketing_service',
    });
  });

  it('recognizes planning aliases from other modules', () => {
    expect(resolveOpenClawNavigationAction('切换到甘特计划', 'marketing_service')).toMatchObject({
      moduleId: 'planning_management',
      href: '/app/modules/planning_management',
    });
  });

  it('does not navigate for diagnostic questions', () => {
    expect(resolveOpenClawNavigationAction('为什么还是不能进入市场客服？', 'planning_management')).toBeNull();
  });
});
