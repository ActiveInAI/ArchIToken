// lib/theme-registry.ts - ArchIToken design-system theme registry
// License: Apache-2.0

export type ArchThemeId = 'wechat_light' | 'industrial_dark';

export interface ArchThemeSpec {
  id: ArchThemeId;
  name: string;
  description: string;
  intent: string;
}

export const archThemeStorageKey = 'architoken_theme';
export const defaultArchThemeId: ArchThemeId = 'wechat_light';

export const archThemes: ArchThemeSpec[] = [
  {
    id: 'wechat_light',
    name: '微信同款',
    description: '微信/企业微信式白底、浅灰分割、绿色主色,默认业务协同主题。',
    intent: '日常业务、文件协同、审批、聊天助手和工程台账。',
  },
  {
    id: 'industrial_dark',
    name: '科幻魔法',
    description: '深墨底色、能量绿、星辉青与奥术紫组成的高沉浸工作主题。',
    intent: '数字孪生、AI 中心、模型推演、现场指挥和沉浸式演示。',
  },
];

export function normalizeArchThemeId(value: string | null | undefined): ArchThemeId {
  return archThemes.some((theme) => theme.id === value)
    ? (value as ArchThemeId)
    : defaultArchThemeId;
}

export function getArchTheme(themeId: ArchThemeId): ArchThemeSpec {
  const defaultTheme = archThemes.find((theme) => theme.id === defaultArchThemeId);
  if (!defaultTheme) {
    throw new Error('ArchIToken default theme is not registered.');
  }
  return archThemes.find((theme) => theme.id === themeId) ?? defaultTheme;
}
