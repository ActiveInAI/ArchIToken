// lib/font-registry.ts - ArchIToken UI font registry
// License: Apache-2.0

export const archFontStorageKey = 'architoken_font';

export const archFontSources = [
  {
    id: 'google_fonts_catalog',
    name: 'Google Fonts',
    url: 'https://fonts.google.com/',
    sourceType: 'catalog',
    integrationScope: 'candidate_discovery',
    licenseBoundary: '目录级来源；加入运行时前必须逐字体核验许可证、版本和文件来源。',
  },
  {
    id: 'googlefonts_github_org',
    name: 'Google Fonts GitHub Organization',
    url: 'https://github.com/googlefonts',
    sourceType: 'organization',
    integrationScope: 'candidate_discovery',
    licenseBoundary: '组织级来源；不可按组织整体授权，必须进入具体仓库和字体家族核验。',
  },
  {
    id: 'google_fonts_repository',
    name: 'google/fonts',
    url: 'https://github.com/google/fonts',
    sourceType: 'repository_catalog',
    integrationScope: 'candidate_discovery',
    licenseBoundary: '仓库按字体目录提供许可证和 METADATA.pb；加入前必须读取对应字体目录许可证。',
  },
  {
    id: 'fontsource_repository',
    name: 'Fontsource',
    url: 'https://github.com/fontsource/fontsource',
    sourceType: 'package_catalog',
    integrationScope: 'candidate_discovery',
    licenseBoundary: '包管理来源；加入前必须读取具体 @fontsource/* 包 README/license。',
  },
  {
    id: 'noto_distribution_repository',
    name: 'Noto Fonts Distribution',
    url: 'https://github.com/notofonts/notofonts.github.io',
    sourceType: 'distribution_catalog',
    integrationScope: 'candidate_discovery',
    licenseBoundary: 'Noto 分发和构建来源；具体字体仍需到对应 repo/release 核验。',
  },
  {
    id: 'noto_cjk_repository',
    name: 'Noto CJK',
    url: 'https://github.com/notofonts/noto-cjk',
    sourceType: 'font_repository',
    integrationScope: 'runtime_candidate',
    licenseBoundary: 'Pan-CJK 候选；加入前记录 release/commit、字体文件、LICENSE 和所选地区字形。',
  },
  {
    id: 'microsoft_selawik_repository',
    name: 'Microsoft Selawik',
    url: 'https://github.com/microsoft/Selawik',
    sourceType: 'font_repository',
    integrationScope: 'runtime_candidate',
    licenseBoundary: 'Segoe UI 替代候选；加入前记录 release/commit、字体文件和 OFL 许可证。',
  },
  {
    id: 'microsoft_cascadia_code_repository',
    name: 'Microsoft Cascadia Code',
    url: 'https://github.com/microsoft/cascadia-code',
    sourceType: 'font_repository',
    integrationScope: 'runtime_candidate',
    licenseBoundary: '代码/日志等宽字体候选；加入前记录 release、具体变体和许可证。',
  },
] as const;

export const archFonts = [
  {
    id: 'system_sans',
    name: '系统默认',
    cssVariable: '--arch-font-system-sans',
    description: '沿用当前 Inter Tight / Noto Sans SC / system-ui 回退栈。',
  },
  {
    id: 'harmonyos_sans',
    name: 'HarmonyOS Sans',
    cssVariable: '--arch-font-harmonyos-sans',
    description: '华为 HarmonyOS Sans SC，作为可选界面字体加载。',
  },
] as const;

export type ArchFontSourceSpec = (typeof archFontSources)[number];
export type ArchFontSourceId = ArchFontSourceSpec['id'];
export type ArchFontSpec = (typeof archFonts)[number];
export type ArchFontId = ArchFontSpec['id'];

export const defaultArchFontId: ArchFontId = 'system_sans';

export function normalizeArchFontId(value: string | null | undefined): ArchFontId {
  return archFonts.some((font) => font.id === value)
    ? (value as ArchFontId)
    : defaultArchFontId;
}

export function getArchFont(fontId: ArchFontId): ArchFontSpec {
  const defaultFont = archFonts.find((font) => font.id === defaultArchFontId);
  if (!defaultFont) {
    throw new Error('ArchIToken default font is not registered.');
  }
  return archFonts.find((font) => font.id === fontId) ?? defaultFont;
}
