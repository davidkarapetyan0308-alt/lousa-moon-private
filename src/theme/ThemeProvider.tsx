import React, { createContext, useContext, useCallback } from 'react';
import { Colors, Typography, Spacing, Rounded, Elevation, ThemeName, Themes } from './tokens';
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

  // If theme is not loaded yet or set, default to rose_gold
  const currentTheme = storeTheme || 'rose_gold';
  const isDark = currentTheme === 'midnight_moon';
  const colors = isDark ? Colors.dark : Themes[currentTheme].colors;

  const setTheme = useCallback((name: ThemeName) => {
    setStoreTheme(name);
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

