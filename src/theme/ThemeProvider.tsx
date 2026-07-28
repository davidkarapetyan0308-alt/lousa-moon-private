import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { Colors, Typography, Spacing, Rounded, Elevation, ThemeName, Themes, normalizeThemeName } from './tokens';
import { useUserStore } from '../store';

interface ThemeContextType {
  colors: typeof Colors.light;
  typography: typeof Typography;
  spacing: typeof Spacing;
  rounded: typeof Rounded;
  elevation: typeof Elevation;
  isDark: boolean;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const storeTheme = useUserStore((s) => s.theme);
  const setStoreTheme = useUserStore((s) => s.setTheme);

  // Persisted data from older builds can contain removed theme identifiers.
  // Normalize before indexing Themes so an old value can never crash startup.
  const currentTheme = normalizeThemeName(storeTheme);
  const isDark = currentTheme === 'midnight_moon';
  const colors = Themes[currentTheme]?.colors || Colors.light;

  useEffect(() => {
    if (storeTheme !== currentTheme) setStoreTheme(currentTheme);
  }, [currentTheme, setStoreTheme, storeTheme]);

  const setTheme = useCallback((name: ThemeName) => {
    setStoreTheme(normalizeThemeName(name));
  }, [setStoreTheme]);

  return (
    <ThemeContext.Provider
      value={{
        colors: colors as typeof Colors.light,
        typography: Typography,
        spacing: Spacing,
        rounded: Rounded,
        elevation: Elevation,
        isDark,
        themeName: currentTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export { Colors, Typography, Spacing, Rounded, Elevation };

