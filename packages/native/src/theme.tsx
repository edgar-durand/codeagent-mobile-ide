import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

export interface IDEThemeColors {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
}

export interface IDETheme {
  colors: IDEThemeColors;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radii: { sm: number; md: number; lg: number };
  typography: { bodySize: number; detailSize: number; monoFamily: string | undefined };
  minimumTouchSize: number;
}

export const DEFAULT_IDE_THEME: IDETheme = {
  colors: {
    canvas: '#0a0d12',
    surface: '#0d1117',
    surfaceRaised: '#161b22',
    border: '#262c3a',
    text: '#e5e7eb',
    textMuted: '#9ca3af',
    textSubtle: '#6b7280',
    accent: '#7c5cff',
    accentMuted: 'rgba(124,92,255,0.2)',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    overlay: 'rgba(0,0,0,0.48)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radii: { sm: 4, md: 8, lg: 12 },
  typography: {
    bodySize: 14,
    detailSize: 12,
    monoFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  minimumTouchSize: 44,
};

const IDEThemeContext = createContext<IDETheme>(DEFAULT_IDE_THEME);

export interface IDEThemeProviderProps {
  children: ReactNode;
  /** Partial semantic overrides; omitted values inherit the defaults. */
  theme?: Partial<Omit<IDETheme, 'colors' | 'spacing' | 'radii' | 'typography'>> & {
    colors?: Partial<IDEThemeColors>;
    spacing?: Partial<IDETheme['spacing']>;
    radii?: Partial<IDETheme['radii']>;
    typography?: Partial<IDETheme['typography']>;
  };
}

export function IDEThemeProvider({ children, theme }: IDEThemeProviderProps) {
  const value = useMemo<IDETheme>(
    () => ({
      ...DEFAULT_IDE_THEME,
      ...theme,
      colors: { ...DEFAULT_IDE_THEME.colors, ...theme?.colors },
      spacing: { ...DEFAULT_IDE_THEME.spacing, ...theme?.spacing },
      radii: { ...DEFAULT_IDE_THEME.radii, ...theme?.radii },
      typography: { ...DEFAULT_IDE_THEME.typography, ...theme?.typography },
    }),
    [theme],
  );
  return <IDEThemeContext.Provider value={value}>{children}</IDEThemeContext.Provider>;
}

export function useIDETheme(): IDETheme {
  return useContext(IDEThemeContext);
}
