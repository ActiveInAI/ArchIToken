// components/ThemeSwitcher.tsx - Global ArchIToken theme switcher
// License: Apache-2.0
'use client';

import { Palette } from 'lucide-react';
import { useArchTheme } from '@/components/ThemeProvider';
import { archThemes, type ArchThemeId } from '@/lib/theme-registry';

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useArchTheme();

  return (
    <label className="arch-toolbar-control inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black">
      <Palette className="h-4 w-4" />
      <span className="hidden sm:inline">主题</span>
      <select
        value={themeId}
        onChange={(event) => setThemeId(event.target.value as ArchThemeId)}
        className="bg-transparent text-xs font-black outline-none"
        aria-label="切换 ArchIToken 主题"
      >
        {archThemes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </label>
  );
}
