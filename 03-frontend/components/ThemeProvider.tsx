// components/ThemeProvider.tsx - ArchIToken global theme provider
// License: Apache-2.0
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  archThemeStorageKey,
  defaultArchThemeId,
  getArchTheme,
  normalizeArchThemeId,
  type ArchThemeId,
  type ArchThemeSpec,
} from '@/lib/theme-registry';
import {
  archFontStorageKey,
  defaultArchFontId,
  getArchFont,
  normalizeArchFontId,
  type ArchFontId,
  type ArchFontSpec,
} from '@/lib/font-registry';

interface ArchThemeContextValue {
  themeId: ArchThemeId;
  theme: ArchThemeSpec;
  setThemeId: (themeId: ArchThemeId) => void;
  fontId: ArchFontId;
  font: ArchFontSpec;
  setFontId: (fontId: ArchFontId) => void;
}

const ArchThemeContext = createContext<ArchThemeContextValue | null>(null);
const archAppearanceChangeEventName = 'architoken-appearance-change';

function getServerThemeSnapshot(): ArchThemeId {
  return defaultArchThemeId;
}

function getServerFontSnapshot(): ArchFontId {
  return defaultArchFontId;
}

function getClientThemeSnapshot(): ArchThemeId {
  if (typeof window === 'undefined') {
    return defaultArchThemeId;
  }

  return normalizeArchThemeId(window.localStorage.getItem(archThemeStorageKey));
}

function getClientFontSnapshot(): ArchFontId {
  if (typeof window === 'undefined') {
    return defaultArchFontId;
  }

  return normalizeArchFontId(window.localStorage.getItem(archFontStorageKey));
}

function subscribeToAppearanceChanges(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleAppearanceChange = () => {
    onStoreChange();
  };

  window.addEventListener('storage', handleAppearanceChange);
  window.addEventListener(archAppearanceChangeEventName, handleAppearanceChange);

  return () => {
    window.removeEventListener('storage', handleAppearanceChange);
    window.removeEventListener(archAppearanceChangeEventName, handleAppearanceChange);
  };
}

function getServerSystemDarkSnapshot(): boolean {
  return false;
}

function getClientSystemDarkSnapshot(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeToSystemThemeChanges(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useSyncExternalStore(
    subscribeToAppearanceChanges,
    getClientThemeSnapshot,
    getServerThemeSnapshot,
  );
  const fontId = useSyncExternalStore(
    subscribeToAppearanceChanges,
    getClientFontSnapshot,
    getServerFontSnapshot,
  );
  const systemDark = useSyncExternalStore(
    subscribeToSystemThemeChanges,
    getClientSystemDarkSnapshot,
    getServerSystemDarkSnapshot,
  );
  const resolvedThemeId: Exclude<ArchThemeId, 'huly_system'> =
    themeId === 'huly_system' ? (systemDark ? 'huly_dark' : 'wechat_light') : themeId;
  const hulyThemeClass = resolvedThemeId === 'huly_dark' ? 'theme-dark' : 'theme-light';
  const hulyFontClass = fontId === 'huly_compact' ? 'small-font' : 'normal-font';

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    document.documentElement.dataset.resolvedTheme = resolvedThemeId;
    document.documentElement.dataset.font = fontId;
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'normal-font', 'small-font');
    document.documentElement.classList.add(hulyThemeClass, hulyFontClass);
  }, [fontId, hulyFontClass, hulyThemeClass, resolvedThemeId, themeId]);

  const setThemeId = useCallback((nextThemeId: ArchThemeId) => {
    const normalizedThemeId = normalizeArchThemeId(nextThemeId);

    document.documentElement.dataset.theme = normalizedThemeId;
    window.localStorage.setItem(archThemeStorageKey, normalizedThemeId);
    window.dispatchEvent(new Event(archAppearanceChangeEventName));
  }, []);
  const setFontId = useCallback((nextFontId: ArchFontId) => {
    const normalizedFontId = normalizeArchFontId(nextFontId);

    document.documentElement.dataset.font = normalizedFontId;
    window.localStorage.setItem(archFontStorageKey, normalizedFontId);
    window.dispatchEvent(new Event(archAppearanceChangeEventName));
  }, []);

  const value = useMemo<ArchThemeContextValue>(
    () => ({
      themeId,
      theme: getArchTheme(themeId),
      setThemeId,
      fontId,
      font: getArchFont(fontId),
      setFontId,
    }),
    [fontId, setFontId, setThemeId, themeId],
  );
  const themeStyle = useMemo<CSSProperties | undefined>(() => undefined, []);

  return (
    <ArchThemeContext.Provider value={value}>
      <div
        data-theme={themeId}
        data-resolved-theme={resolvedThemeId}
        data-font={fontId}
        className={`arch-theme-root min-h-screen ${hulyThemeClass} ${hulyFontClass}`}
        style={themeStyle}
      >
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
