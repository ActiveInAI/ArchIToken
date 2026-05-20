// lib/theme-registry.ts - ArchIToken design-system theme registry
// License: Apache-2.0

export type ArchThemeId = 'huly_light' | 'huly_dark' | 'huly_system';

export interface ArchThemeSpec {
  id: ArchThemeId;
  name: string;
  description: string;
  intent: string;
}

export const archThemeStorageKey = 'architoken_theme';
export const defaultArchThemeId: ArchThemeId = 'huly_light';

export const archThemes: ArchThemeSpec[] = [
  {
    id: 'huly_light',
    name: '浅色',
    description: 'Huly theme-light: 浅灰工作区、白色导航面板、低对比分割线。',
    intent: '日常业务、文件协同、审批、图表、关系图和工程台账。',
  },
  {
    id: 'huly_dark',
    name: '深色',
    description: 'Huly theme-dark: 深色工作区、暗色面板和蓝色链接/焦点色。',
    intent: '低照度、模型查看、AI 中心、现场指挥和长时间工作。',
  },
  {
    id: 'huly_system',
    name: '系统',
    description: 'Huly theme-system: 跟随操作系统浅色/深色偏好。',
    intent: '随系统外观自动切换的默认工作模式。',
  },
];

export function normalizeArchThemeId(value: string | null | undefined): ArchThemeId {
  if (value === 'wechat_light') {
    return 'huly_light';
  }
  if (value === 'industrial_dark') {
    return 'huly_dark';
  }
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
