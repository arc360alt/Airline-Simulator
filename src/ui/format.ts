import { settings } from '../game/state';

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
}

export function moneyFull(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString()}`;
}

export function clock(t: number): string {
  const d = Math.floor(t / 1440);
  const m = Math.floor(t % 1440);
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `DAY ${d} · ${hh}:${mm}`;
}

export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function dist(km: number): string {
  if (settings.units === 'mi') return `${Math.round(km * 0.621371).toLocaleString()} mi`;
  return `${Math.round(km).toLocaleString()} km`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function stars(level: number): string {
  return '★'.repeat(Math.min(5, Math.ceil(level / 2))) + '☆'.repeat(5 - Math.min(5, Math.ceil(level / 2)));
}
