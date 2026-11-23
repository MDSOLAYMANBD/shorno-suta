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

const isHex = (hex: string | undefined): hex is string => !!hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex);
const fullHex = (hex: string) => (hex.length === 4 ? `#${hex.slice(1).split('').map((c) => c + c).join('')}` : hex).toLowerCase();

type Rgb = [number, number, number];
const rgbOf = (hex: string): Rgb => {
  const n = parseInt(fullHex(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOfRgb = (c: Rgb) =>
  `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** Relative luminance, 0 (black) to 1 (white). */
function luminance(hex: string) {
  const [r, g, b] = rgbOf(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black text, whichever reads better on the colour. */
const readableOn = (hex: string) => (luminance(hex) > 0.4 ? '#111827' : '#ffffff');

/** A colour too dark to show on the dark page, mixed with white until its luminance is `target`. */
function liftForDark(hex: string, target: number) {
  if (luminance(hex) >= target) return fullHex(hex);
  const from = rgbOf(hex);
  const at = (t: number) => hexOfRgb(from.map((c) => c + (255 - c) * t) as Rgb);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const t = (lo + hi) / 2;
    if (luminance(at(t)) < target) lo = t;
    else hi = t;
  }
  return at((lo + hi) / 2);
}

/**
 * The shop's colours as CSS (the same way as the CORE Shop engine): the whole theme on the
 * light page; in the admin's dark mode only the shop's own colours (lifted so they show on the
 * dark page), with the dark background, cards, text and borders from index.css (.dark).
 * They used to be set on the page itself, which outranked .dark: dark mode stayed light.
 */
function themeCss(config: ThemeConfig) {
  const light: string[] = [];
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const hex = config[key as keyof ThemeConfig];
    if (isHex(hex)) light.push(`${cssVar}:${hexToHsl(fullHex(hex))}`);
  }
  const dark: string[] = [];
  const own = (name: 'primary' | 'accent', target: number) => {
    const hex = config[name];
    if (!isHex(hex)) return null;
    const onDark = liftForDark(hex, target);
    dark.push(`--${name}:${hexToHsl(onDark)}`, `--${name}-foreground:${hexToHsl(readableOn(onDark))}`);
    return onDark;
  };
  const primary = own('primary', 0.2);
  own('accent', 0.14);
  if (primary) dark.push(`--ring:${hexToHsl(primary)}`);
  return `:root:not(.dark){${light.join(';')}}\n:root.dark{${dark.join(';')}}`;
}

function applyTheme(config: ThemeConfig) {
  let tag = document.getElementById('shop-theme') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'shop-theme';
    document.head.appendChild(tag);
  }
  tag.textContent = themeCss(config);
  // colours an older version set on the page itself would outrank the dark mode
  for (const cssVar of Object.values(CSS_VAR_MAP)) document.documentElement.style.removeProperty(cssVar);
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
