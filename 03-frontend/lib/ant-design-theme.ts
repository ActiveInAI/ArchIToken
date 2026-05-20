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
  const isDark = themeId === 'huly_dark';
  const primary = '#205DC2';
  const colorBgBase = isDark ? '#161719' : '#F1F1F4';
  const colorBgContainer = isDark ? '#1E2024' : '#FBFBFC';
  const colorBorder = isDark ? 'rgba(255, 255, 255, .08)' : 'rgba(0, 0, 0, .09)';
  const colorTextBase = isDark ? 'rgba(255, 255, 255, .8)' : 'rgba(0, 0, 0, .8)';

  return {
    cssVar: {
      key: `architoken-${themeId}`,
      prefix: 'arch',
    },
    hashed: true,
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorSuccess: '#05A05C',
      colorInfo: primary,
      colorWarning: '#F47758',
      colorError: '#CB4B42',
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
      fontSize: font.baseFontSize,
      fontSizeSM: Math.max(font.baseFontSize - 2, 11),
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
        fontWeight: 500,
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
        itemSelectedBg: isDark ? 'rgba(55, 122, 230, 0.18)' : 'rgba(55, 122, 230, 0.1)',
      },
      Table: {
        borderColor: colorBorder,
        cellPaddingBlock: 10,
        cellPaddingInline: 12,
        headerBg: isDark ? '#1A1C20' : '#EFEFF2',
        rowHoverBg: isDark ? 'rgba(255, 255, 255, .04)' : 'rgba(0, 0, 0, .04)',
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
