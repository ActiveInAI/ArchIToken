// components/ThemeSwitcher.tsx - Global ArchIToken theme switcher
// License: Apache-2.0
'use client';

import { BgColorsOutlined, FontSizeOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useArchTheme } from '@/components/ThemeProvider';
import { archFonts, type ArchFontId } from '@/lib/font-registry';
import { archThemes, type ArchThemeId } from '@/lib/theme-registry';

export function ThemeSwitcher() {
  const { themeId, setThemeId, fontId, setFontId } = useArchTheme();

  return (
    <div className="grid gap-1.5 px-1 py-1">
      <div className="arch-toolbar-control inline-flex w-full min-w-0 items-center gap-1.5 px-1.5 py-1 arch-type-body font-semibold">
        <BgColorsOutlined className="shrink-0 arch-type-title" />
        <span className="hidden sm:inline">主题</span>
        <Select<ArchThemeId>
          aria-label="切换 ArchIToken 主题"
          className="min-w-0 flex-1"
          options={archThemes.map((theme) => ({ label: theme.name, value: theme.id }))}
          popupMatchSelectWidth={false}
          size="small"
          value={themeId}
          variant="borderless"
          onChange={setThemeId}
        />
      </div>
      <div className="arch-toolbar-control inline-flex w-full min-w-0 items-center gap-1.5 px-1.5 py-1 arch-type-body font-semibold">
        <FontSizeOutlined className="shrink-0 arch-type-title" />
        <span className="hidden sm:inline">字体</span>
        <Select<ArchFontId>
          aria-label="切换 ArchIToken 界面字体"
          className="min-w-0 flex-1"
          options={archFonts.map((font) => ({ label: font.name, value: font.id }))}
          popupMatchSelectWidth={false}
          size="small"
          value={fontId}
          variant="borderless"
          onChange={setFontId}
        />
      </div>
    </div>
  );
}
