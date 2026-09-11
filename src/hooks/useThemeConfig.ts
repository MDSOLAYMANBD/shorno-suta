import { useEffect, useMemo } from 'react';
import { useAllSettings } from './useAllSettings';

export interface ThemeConfig {
  primary: string;
  primary_foreground: string;
  secondary: string;
  secondary_foreground: string;
  accent: string;
  accent_foreground: string;
  background: string;
  foreground: string;
  card: string;
  card_foreground: string;
  muted: string;
  muted_foreground: string;
  border: string;
  input: string;
  ring: string;
}

export const DEFAULT_THEME: ThemeConfig = {
  primary: '#8C6A1A',
  primary_foreground: '#ffffff',
  secondary: '#6B1E2B',
  secondary_foreground: '#ffffff',
  accent: '#6B1E2B',
  accent_foreground: '#ffffff',
  background: '#ffffff',
  foreground: '#2A1519',
  card: '#ffffff',
  card_foreground: '#2A1519',
  muted: '#F5EFE6',
  muted_foreground: '#6B5A4A',
  border: '#E8DCC8',
  input: '#E8DCC8',
  ring: '#8C6A1A',
};

function hexToHsl(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const CSS_VAR_MAP: Record<keyof ThemeConfig, string> = {
  primary: '--primary',
  primary_foreground: '--primary-foreground',
  secondary: '--secondary',
  secondary_foreground: '--secondary-foreground',
  accent: '--accent',
  accent_foreground: '--accent-foreground',
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  card_foreground: '--card-foreground',
  muted: '--muted',
  muted_foreground: '--muted-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
};

function applyTheme(config: ThemeConfig) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const hex = config[key as keyof ThemeConfig];
    if (hex && /^#[0-9a-fA-F]{3,6}$/.test(hex)) {
      root.style.setProperty(cssVar, hexToHsl(hex));
    }
  }
}

export function useThemeConfig() {
  const { data: allSettings } = useAllSettings();

  const themeConfig = useMemo(() => {
    if (!allSettings) return DEFAULT_THEME;
    const raw = allSettings['theme_config'];
    if (raw) {
      try { return { ...DEFAULT_THEME, ...JSON.parse(raw) } as ThemeConfig; } catch { /* ignore */ }
    }
    return DEFAULT_THEME;
  }, [allSettings]);

  useEffect(() => {
    if (themeConfig) applyTheme(themeConfig);
  }, [themeConfig]);

  return themeConfig;
}

export { hexToHsl };
