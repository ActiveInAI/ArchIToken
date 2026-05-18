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
import { App as AntDesignApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { createArchAntDesignTheme } from '@/lib/ant-design-theme';
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

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    document.documentElement.dataset.font = fontId;
  }, [fontId, themeId]);

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
  const themeStyle = useMemo<CSSProperties | undefined>(() => {
    if (themeId !== 'wechat_light') {
      return undefined;
    }

    return {
      '--arch-primary': '#07c160',
      '--arch-primary-soft': '#e8f8ef',
      '--arch-success': '#07c160',
    } as CSSProperties;
  }, [themeId]);
  const antDesignTheme = useMemo(
    () => createArchAntDesignTheme(themeId, fontId),
    [fontId, themeId],
  );

  return (
    <ArchThemeContext.Provider value={value}>
      <ConfigProvider
        locale={zhCN}
        theme={antDesignTheme}
        componentSize="middle"
        wave={{ disabled: true }}
      >
        <AntDesignApp className="min-h-screen">
          <div data-theme={themeId} data-font={fontId} className="arch-theme-root" style={themeStyle}>
            {children}
          </div>
        </AntDesignApp>
      </ConfigProvider>
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
