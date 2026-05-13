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

interface ArchThemeContextValue {
  themeId: ArchThemeId;
  theme: ArchThemeSpec;
  setThemeId: (themeId: ArchThemeId) => void;
}

const ArchThemeContext = createContext<ArchThemeContextValue | null>(null);
const archThemeChangeEventName = 'architoken-theme-change';

function getServerThemeSnapshot(): ArchThemeId {
  return defaultArchThemeId;
}

function getClientThemeSnapshot(): ArchThemeId {
  if (typeof window === 'undefined') {
    return defaultArchThemeId;
  }

  return normalizeArchThemeId(window.localStorage.getItem(archThemeStorageKey));
}

function subscribeToThemeChanges(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleThemeChange = () => {
    onStoreChange();
  };

  window.addEventListener('storage', handleThemeChange);
  window.addEventListener(archThemeChangeEventName, handleThemeChange);

  return () => {
    window.removeEventListener('storage', handleThemeChange);
    window.removeEventListener(archThemeChangeEventName, handleThemeChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useSyncExternalStore(
    subscribeToThemeChanges,
    getClientThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  const setThemeId = useCallback((nextThemeId: ArchThemeId) => {
    const normalizedThemeId = normalizeArchThemeId(nextThemeId);

    document.documentElement.dataset.theme = normalizedThemeId;
    window.localStorage.setItem(archThemeStorageKey, normalizedThemeId);
    window.dispatchEvent(new Event(archThemeChangeEventName));
  }, []);

  const value = useMemo<ArchThemeContextValue>(
    () => ({
      themeId,
      theme: getArchTheme(themeId),
      setThemeId,
    }),
    [setThemeId, themeId],
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
