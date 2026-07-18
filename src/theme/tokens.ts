// LOUSA MOON — unified design tokens.

const light = {
  primary: '#A64D72',
  onPrimary: '#FFFFFF',
  primaryContainer: '#F4DDE6',
  onPrimaryContainer: '#5B365F',
  inversePrimary: '#D985A5',
  primaryFixed: '#F4DDE6',
  primaryFixedDim: '#D985A5',
  onPrimaryFixed: '#211A24',
  onPrimaryFixedVariant: '#5B365F',

  secondary: '#5B365F',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#EEE7F7',
  onSecondaryContainer: '#5B365F',
  secondaryFixed: '#EEE7F7',
  secondaryFixedDim: '#B8A6D9',
  onSecondaryFixed: '#211A24',
  onSecondaryFixedVariant: '#5B365F',

  tertiary: '#A36F3D',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F8EFE2',
  onTertiaryContainer: '#6E4D28',
  tertiaryFixed: '#F8EFE2',
  tertiaryFixedDim: '#D6B27F',
  onTertiaryFixed: '#211A24',
  onTertiaryFixedVariant: '#6E4D28',

  surface: '#FFFFFF',
  surfaceDim: '#F2EAED',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FBF4F7',
  surfaceContainer: '#F8EFF2',
  surfaceContainerHigh: '#F3E9ED',
  surfaceContainerHighest: '#EDE1E6',
  onSurface: '#211A24',
  onSurfaceVariant: '#716771',
  surfaceVariant: '#F3E9ED',
  inverseSurface: '#2B232D',
  inverseOnSurface: '#FFF9FB',
  surfaceTint: '#A64D72',

  outline: '#857682',
  outlineVariant: '#E8DFE4',
  background: '#FBF4F7',
  onBackground: '#211A24',

  error: '#B24C5C',
  onError: '#FFFFFF',
  errorContainer: '#FBE8EC',
  onErrorContainer: '#7B2639',

  gold: '#B88747',
  goldDim: '#9A6A34',
  silver: '#B8B6C3',
  roseGold: '#D985A5',
  pearl: '#FFFDFE',
  cream: '#F8EFF2',
};

const dark: typeof light = {
  ...light,
  primary: '#F1B7CD',
  onPrimary: '#3A1C29',
  primaryContainer: '#6A304C',
  onPrimaryContainer: '#FFE6F0',
  inversePrimary: '#A64D72',
  secondary: '#D8C7E8',
  onSecondary: '#352940',
  secondaryContainer: '#49395A',
  onSecondaryContainer: '#F2E7FC',
  tertiary: '#D6B27F',
  onTertiary: '#4A321A',
  tertiaryContainer: '#634820',
  onTertiaryContainer: '#FFF0D7',
  surface: '#17131D',
  surfaceDim: '#17131D',
  surfaceBright: '#302A38',
  surfaceContainerLowest: '#110E16',
  surfaceContainerLow: '#1D1824',
  surfaceContainer: '#211B29',
  surfaceContainerHigh: '#2A2332',
  surfaceContainerHighest: '#342B3D',
  onSurface: '#F5EFF6',
  onSurfaceVariant: '#C9BEC9',
  surfaceVariant: '#342B3D',
  inverseSurface: '#F5EFF6',
  inverseOnSurface: '#2A2230',
  surfaceTint: '#F1B7CD',
  outline: '#A698A8',
  outlineVariant: 'rgba(255, 255, 255, 0.14)',
  background: '#17131D',
  onBackground: '#F5EFF6',
  error: '#FFB3C0',
  onError: '#5F1224',
  errorContainer: '#7B2639',
  onErrorContainer: '#FFE4E9',
  gold: '#D6B27F',
  goldDim: '#B88747',
  silver: '#B8B6C3',
  roseGold: '#F1B7CD',
  pearl: '#F5EFF6',
  cream: '#49395A',
};

export const Colors = { light, dark };

export const Typography = {
  displayLg: { fontFamily: 'serif', fontSize: 34, fontWeight: '600' as const, lineHeight: 40, letterSpacing: -0.4 },
  headlineLg: { fontFamily: 'sans-serif-medium', fontSize: 30, fontWeight: '600' as const, lineHeight: 36, letterSpacing: -0.2 },
  headlineLgMobile: { fontFamily: 'sans-serif-medium', fontSize: 28, fontWeight: '600' as const, lineHeight: 34 },
  headlineMd: { fontFamily: 'sans-serif-medium', fontSize: 23, fontWeight: '600' as const, lineHeight: 29 },
  bodyLg: { fontFamily: 'sans-serif', fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMd: { fontFamily: 'sans-serif', fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  labelMd: { fontFamily: 'sans-serif-medium', fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 0.2 },
  labelSm: { fontFamily: 'sans-serif-medium', fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.2 },
};

export const Spacing = { unit: 8, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, gutter: 20, marginMobile: 18, marginDesktop: 64, containerMaxWidth: 1280 };
export const Rounded = { sm: 8, DEFAULT: 12, md: 16, lg: 20, xl: 24, full: 9999 };
export const Elevation = {
  glass: { backgroundColor: 'rgba(255,253,254,0.96)', borderColor: 'rgba(91,54,95,0.12)', borderWidth: 1 },
  glassDark: { backgroundColor: 'rgba(33,27,41,0.96)', borderColor: 'rgba(255,255,255,0.11)', borderWidth: 1 },
  ambientGlow: { shadowColor: '#5B365F', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.025, shadowRadius: 18, elevation: 1 },
  goldGlow: { shadowColor: '#A64D72', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 },
};

export type ThemeName = 'rose_gold' | 'pearl_white' | 'midnight_moon' | 'moon_silver' | 'lavender_dream';
export const Themes: Record<ThemeName, { label: string; colors: typeof light }> = {
  rose_gold: { label: 'Light', colors: light },
  pearl_white: { label: 'Light', colors: light },
  moon_silver: { label: 'Light', colors: light },
  lavender_dream: { label: 'Light', colors: light },
  midnight_moon: { label: 'Dark', colors: dark },
};
