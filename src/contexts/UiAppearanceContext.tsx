import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type UiAppearance = 'light' | 'dark';

export const UI_APPEARANCE_STORAGE_KEY = 'luck_ui_appearance';

interface UiAppearanceContextValue {
  appearance: UiAppearance;
  setAppearance: (appearance: UiAppearance) => void;
  toggleAppearance: () => void;
}

const UiAppearanceContext = createContext<UiAppearanceContextValue | null>(null);

const readStoredAppearance = (): UiAppearance => {
  try {
    const stored = window.localStorage.getItem(UI_APPEARANCE_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  } catch {
    return 'light';
  }
};

export const UiAppearanceProvider = ({ children }: { children: ReactNode }) => {
  const [appearance, setAppearanceState] = useState<UiAppearance>(readStoredAppearance);

  const setAppearance = useCallback((nextAppearance: UiAppearance) => {
    setAppearanceState(nextAppearance);
    try {
      window.localStorage.setItem(UI_APPEARANCE_STORAGE_KEY, nextAppearance);
    } catch {
      // Storage may be unavailable in private browsing; the in-memory state still works.
    }
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearanceState(current => {
      const nextAppearance = current === 'light' ? 'dark' : 'light';
      try {
        window.localStorage.setItem(UI_APPEARANCE_STORAGE_KEY, nextAppearance);
      } catch {
        // Keep the UI responsive even when persistence is blocked.
      }
      return nextAppearance;
    });
  }, []);

  const value = useMemo(
    () => ({ appearance, setAppearance, toggleAppearance }),
    [appearance, setAppearance, toggleAppearance],
  );

  return <UiAppearanceContext.Provider value={value}>{children}</UiAppearanceContext.Provider>;
};

export const useUiAppearance = () => {
  const context = useContext(UiAppearanceContext);
  if (!context) {
    throw new Error('useUiAppearance must be used within UiAppearanceProvider');
  }
  return context;
};
