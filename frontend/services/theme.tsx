import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyThemeColors, getThemeColors, ThemeColors, ThemeMode } from '@/constants/Theme';

const THEME_MODE_KEY = 'theme_mode';

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  initialized: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'light',
  setMode: () => undefined,
  colors: getThemeColors('light'),
  initialized: false,
});

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then(value => {
        if (value === 'dark' || value === 'light') {
          setModeState(value);
          applyThemeColors(value);
        } else {
          applyThemeColors('light');
        }
      })
      .finally(() => setInitialized(true));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyThemeColors(next);
    AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => undefined);
  }, []);

  const colors = useMemo(() => getThemeColors(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, colors, initialized }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
