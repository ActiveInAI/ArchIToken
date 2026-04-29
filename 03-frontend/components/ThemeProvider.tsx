// components/ThemeProvider.tsx - ArchIToken global theme provider
// License: Apache-2.0
'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  archThemeStorageKey,
  defaultArchThemeId,
  getArchTheme,
  normalizeArchThemeId,
  type ArchThemeId,
  type ArchThemeSpec,
} from '@/lib/theme-registry';

interface ArchThemeContextValue {
  themeId: ArchThemeId;
  theme: ArchThemeSpec;
  setThemeId: (themeId: ArchThemeId) => void;
}

const ArchThemeContext = createContext<ArchThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ArchThemeId>(() => {
    if (typeof window === 'undefined') {
      return defaultArchThemeId;
    }
    return normalizeArchThemeId(window.localStorage.getItem(archThemeStorageKey));
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    window.localStorage.setItem(archThemeStorageKey, themeId);
  }, [themeId]);

  const value = useMemo<ArchThemeContextValue>(
    () => ({
      themeId,
      theme: getArchTheme(themeId),
      setThemeId: setThemeIdState,
    }),
    [themeId],
  );

  return (
    <ArchThemeContext.Provider value={value}>
      <div data-theme={themeId} className="arch-theme-root">
        {children}
      </div>
    </ArchThemeContext.Provider>
  );
}

export function useArchTheme(): ArchThemeContextValue {
  const context = useContext(ArchThemeContext);
  if (!context) {
    throw new Error('useArchTheme must be used inside ThemeProvider');
  }
  return context;
}
