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
    name: '白绿业务',
    description: '微信/企业微信式白底、浅灰分割、绿色主色,默认业务系统主题。',
    intent: '日常业务、文件协同、审批和工程台账。',
  },
  {
    id: 'industrial_dark',
    name: '工业深色',
    description: '面向夜间运维、大屏驾驶舱和工厂监控的低亮度主题。',
    intent: '数字孪生、HMI、大屏监控和现场指挥。',
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
