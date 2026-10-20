import { settings } from '../game/state';
import type { Accent } from '../game/types';
import { bus } from '../game/bus';

export type Resolved = 'light' | 'dark';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function resolvedTheme(): Resolved {
  if (settings.theme === 'system') return media.matches ? 'dark' : 'light';
  return settings.theme;
}

/**
 * Accent colours. Each has a bright shade for night mode and a deeper shade for
 * day mode so text and thin lines keep enough contrast on white.
 */
export const ACCENTS: Record<Accent, { name: string; dark: string; light: string; lightInk: string }> = {
  blue: { name: 'Blue', dark: '#4fd1ff', light: '#0a7fc0', lightInk: '#ffffff' },
  teal: { name: 'Teal', dark: '#2dd4bf', light: '#0d8a80', lightInk: '#ffffff' },
  green: { name: 'Green', dark: '#4ade80', light: '#16884a', lightInk: '#ffffff' },
  yellow: { name: 'Yellow', dark: '#facc15', light: '#a87b00', lightInk: '#1a1400' },
  orange: { name: 'Orange', dark: '#ff9f43', light: '#cf5c0a', lightInk: '#ffffff' },
  red: { name: 'Red', dark: '#ff5d6c', light: '#c8303f', lightInk: '#ffffff' },
  pink: { name: 'Pink', dark: '#f472b6', light: '#c0307a', lightInk: '#ffffff' },
  purple: { name: 'Purple', dark: '#a78bfa', light: '#6d4fd8', lightInk: '#ffffff' },
};

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The accent hex for the current mode. */
export function accentColor(): string {
  const a = ACCENTS[settings.accent] ?? ACCENTS.blue;
  return resolvedTheme() === 'dark' ? a.dark : a.light;
}

export function applyTheme(): void {
  const root = document.documentElement;
  const dark = resolvedTheme() === 'dark';
  const a = ACCENTS[settings.accent] ?? ACCENTS.blue;
  const c = dark ? a.dark : a.light;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = settings.accent;
  root.style.setProperty('--accent', c);
  root.style.setProperty('--accent-soft', rgba(c, 0.12));
  root.style.setProperty('--accent-ink', dark ? '#05080f' : a.lightInk);
  root.style.setProperty('--glow', dark ? `0 0 14px ${rgba(c, 0.35)}` : 'none');
}

media.addEventListener('change', () => {
  if (settings.theme === 'system') {
    applyTheme();
    bus.emit('settings');
  }
});

/** Colours the 3D scene uses, kept in sync with the CSS tokens. */
export interface GlobePalette {
  ocean: string;
  oceanDeep: string;
  land: string;
  landDot: string;
  landDotAlpha: number;
  coast: string;
  coastAlpha: number;
  grid: string;
  gridAlpha: number;
  atmosphere: string;
  airport: string;
  arc: string;
  stars: boolean;
}

export function globePalette(): GlobePalette {
  const c = accentColor();
  return resolvedTheme() === 'dark'
    ? {
        ocean: '#0a1626', oceanDeep: '#050b15', land: '#132a3f',
        landDot: c, landDotAlpha: 0.32, coast: c, coastAlpha: 0.9, grid: '#78beff', gridAlpha: 0.1,
        atmosphere: c, airport: '#5d7894', arc: c, stars: true,
      }
    : {
        ocean: '#c9d8e6', oceanDeep: '#b3c6d8', land: '#f4f7fa',
        landDot: '#1e466e', landDotAlpha: 0.16, coast: '#285078', coastAlpha: 0.8, grid: '#285078', gridAlpha: 0.12,
        atmosphere: '#ffffff', airport: '#6b7f95', arc: c, stars: false,
      };
}
