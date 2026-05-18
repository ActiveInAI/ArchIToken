// lib/ant-design-theme.ts - Ant Design token bridge for ArchIToken themes
// License: Apache-2.0

import { theme as antTheme, type ThemeConfig } from 'antd';
import type { ArchFontId } from '@/lib/font-registry';
import { getArchFont } from '@/lib/font-registry';
import type { ArchThemeId } from '@/lib/theme-registry';

export function createArchAntDesignTheme(
  themeId: ArchThemeId,
  fontId: ArchFontId,
): ThemeConfig {
  const font = getArchFont(fontId);
  const isDark = themeId === 'industrial_dark';
  const primary = isDark ? '#39ffb6' : '#07c160';
  const colorBgBase = isDark ? '#090b12' : '#f5f7fa';
  const colorBgContainer = isDark ? '#11151f' : '#ffffff';
  const colorBorder = isDark ? 'rgba(144, 238, 214, 0.2)' : '#e5e6eb';
  const colorTextBase = isDark ? '#f5fbff' : '#1f2329';

  return {
    cssVar: {
      key: `architoken-${themeId}`,
      prefix: 'arch',
    },
    hashed: true,
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorSuccess: primary,
      colorInfo: primary,
      colorWarning: isDark ? '#ffd166' : '#faad14',
      colorError: isDark ? '#ff5d8f' : '#ff4d4f',
      colorBgBase,
      colorBgContainer,
      colorBgElevated: colorBgContainer,
      colorBorder,
      colorTextBase,
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 40,
      fontFamily: `var(${font.cssVariable})`,
      fontSize: 14,
      fontSizeSM: 12,
      lineHeight: 1.55,
      wireframe: false,
    },
    components: {
      App: {
        colorBgBase,
      },
      Button: {
        borderRadius: 4,
        controlHeight: 36,
        fontWeight: 700,
        primaryShadow: 'none',
      },
      Card: {
        borderRadiusLG: 8,
        boxShadowTertiary: 'none',
        headerBg: colorBgContainer,
      },
      Drawer: {
        borderRadiusLG: 8,
        colorBgElevated: colorBgContainer,
      },
      Form: {
        itemMarginBottom: 12,
        labelFontSize: 12,
      },
      Input: {
        borderRadius: 6,
        controlHeight: 36,
      },
      Layout: {
        bodyBg: colorBgBase,
        headerBg: colorBgContainer,
        siderBg: colorBgContainer,
      },
      Menu: {
        itemBorderRadius: 6,
        itemHeight: 38,
      },
      Modal: {
        borderRadiusLG: 8,
        contentBg: colorBgContainer,
        headerBg: colorBgContainer,
      },
      Segmented: {
        borderRadius: 6,
        itemSelectedBg: isDark ? 'rgba(57, 255, 182, 0.16)' : '#e8f8ef',
      },
      Table: {
        borderColor: colorBorder,
        cellPaddingBlock: 10,
        cellPaddingInline: 12,
        headerBg: isDark ? '#171c2a' : '#f7f8fa',
        rowHoverBg: isDark ? 'rgba(57, 255, 182, 0.08)' : '#f0fbf5',
      },
      Tabs: {
        horizontalItemPadding: '10px 12px',
        itemSelectedColor: primary,
      },
      Tag: {
        borderRadiusSM: 4,
      },
      Tooltip: {
        borderRadius: 6,
      },
      Typography: {
        titleMarginBottom: 0,
        titleMarginTop: 0,
      },
    },
  };
}
