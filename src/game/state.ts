import type { GameState, Settings, Airline, LogKind } from './types';
import { bus } from './bus';

/** pre-slots single save, migrated into a slot on first load */
const SAVE_KEY = 'airline-sim/save/v1';
const SETTINGS_KEY = 'airline-sim/settings/v1';

export const MIN_PER_DAY = 1440;
/** game minutes that pass per real second at 1x speed */
export const MINUTES_PER_SECOND = 12;
export const SPEEDS = [0, 1, 3, 8, 20];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'blue',
  autoRotate: true,
  showLabels: true,
  showAllAirports: true,
  showArcs: true,
  sound: true,
  volume: 0.5,
  units: 'km',
  quality: 'high',
  confirmBig: true,
  ticker: true,
  pauseOnCrash: true,
};

export function freshState(airline: Airline): GameState {
  return {
    version: 1,
    airline,
    money: 850_000,
    time: 6 * 60,
    reputation: 50,
    satisfaction: 55,
    owned: [airline.hub],
    planes: [],
    staff: [],
    routes: [],
    candidates: [],
    market: [],
    lastMarketDay: -1,
    lastCandidatesDay: -1,
    research: [],
    rp: 10,
    service: { food: 'pretzels', drinks: 'soda' },
    fuelPrice: 0.85,
    autoRepairAt: 35,
    ledger: [],
    today: { day: 0, revenue: 0, expenses: 0, pax: 0 },
    log: [],
    stats: { pax: 0, flights: 0, crashes: 0, revenue: 0, incidents: 0 },
    nextId: 1,
  };
}

/** The single live game. `null` before the player has founded an airline. */
export const game: { s: GameState | null; speed: number } = { s: null, speed: 1 };

export function S(): GameState {
  if (!game.s) throw new Error('No game running');
  return game.s;
}

export function uid(prefix: string): string {
  const s = S();
  return `${prefix}${(s.nextId++).toString(36)}`;
}

export function day(t = S().time): number {
  return Math.floor(t / MIN_PER_DAY);
}

export function log(msg: string, kind: LogKind = 'info', toast = false): void {
  const s = S();
  s.log.unshift({ t: s.time, msg, kind });
  if (s.log.length > 80) s.log.length = 80;
  if (toast) bus.emit('toast', { msg, kind });
}

// ── Save slots ──────────────────────────────────────────────────────────────
// Each airline lives in its own slot; a small index holds what the save picker
// shows, so listing saves never has to parse every full game.

const SLOT_PREFIX = 'airline-sim/slot/';
const INDEX_KEY = 'airline-sim/slots/v1';
const ACTIVE_KEY = 'airline-sim/active-slot';
export const MAX_SLOTS = 12;

export interface SaveMeta {
  id: string;
  name: string;
  code: string;
  color: string;
  hub: string;
  day: number;
  money: number;
  planes: number;
  updatedAt: number;
}

let activeSlot: string | null = null;
let warnedFull = false;

function readIndex(): SaveMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SaveMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SaveMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

function metaFor(id: string, s: GameState): SaveMeta {
  return {
    id,
    name: s.airline.name,
    code: s.airline.code,
    color: s.airline.color,
    hub: s.airline.hub,
    day: Math.floor(s.time / MIN_PER_DAY),
    money: s.money,
    planes: s.planes.length,
    updatedAt: Date.now(),
  };
}

function newSlotId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Move a save from the old single-slot format into the slot system (runs once). */
function migrateLegacy(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version === 1 && parsed.airline) {
      const id = newSlotId();
      localStorage.setItem(SLOT_PREFIX + id, raw);
      writeIndex([...readIndex(), metaFor(id, parsed)]);
      localStorage.setItem(ACTIVE_KEY, id);
    }
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* leave the old save where it is */
  }
}

/** All save files, most recently played first. */
export function listSaves(): SaveMeta[] {
  migrateLegacy();
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function currentSlot(): string | null {
  return activeSlot;
}

/** Start a fresh slot for a brand-new airline (call before newGame). */
export function beginNewSlot(): void {
  activeSlot = newSlotId();
}

export function saveGame(): boolean {
  if (!game.s) return false;
  activeSlot ??= newSlotId();
  try {
    localStorage.setItem(SLOT_PREFIX + activeSlot, JSON.stringify(game.s));
    const index = readIndex().filter((m) => m.id !== activeSlot);
    writeIndex([...index, metaFor(activeSlot, game.s)]);
    localStorage.setItem(ACTIVE_KEY, activeSlot);
    return true;
  } catch {
    // storage full or blocked: the game keeps running, warn once
    if (!warnedFull) {
      warnedFull = true;
      bus.emit('toast', { msg: 'Could not save: browser storage is full. Delete an old save file to free space.', kind: 'bad' });
    }
    return false;
  }
}

/** Load a slot into the live game. */
export function loadSlot(id: string): GameState | null {
  try {
    const raw = localStorage.getItem(SLOT_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1) return null;
    activeSlot = id;
    game.s = parsed;
    localStorage.setItem(ACTIVE_KEY, id);
    return parsed;
  } catch {
    return null;
  }
}

export function deleteSlot(id: string): void {
  try {
    localStorage.removeItem(SLOT_PREFIX + id);
    writeIndex(readIndex().filter((m) => m.id !== id));
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
  if (activeSlot === id) activeSlot = null;
}

export function exportSave(): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(S()))));
}

/** Import a save code into a NEW slot (never overwrites an existing airline). Returns the slot id. */
export function importSave(code: string): string | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as GameState;
    if (parsed.version !== 1 || !parsed.airline) return null;
    const id = newSlotId();
    localStorage.setItem(SLOT_PREFIX + id, JSON.stringify(parsed));
    writeIndex([...readIndex(), metaFor(id, parsed)]);
    return id;
  } catch {
    return null;
  }
}

// ── Boot intent: what to show after a reload ──────────────────────────────
// Switching airlines reloads the page (simplest way to reset every system);
// this one-shot flag tells the next boot where to go.

export type BootIntent = { kind: 'picker' } | { kind: 'new' } | { kind: 'load'; id: string };
const BOOT_KEY = 'airline-sim/boot';

export function rebootTo(intent: BootIntent): void {
  if (game.s && activeSlot) saveGame();
  try {
    sessionStorage.setItem(BOOT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
  location.reload();
}

export function takeBootIntent(): BootIntent | null {
  try {
    const raw = sessionStorage.getItem(BOOT_KEY);
    sessionStorage.removeItem(BOOT_KEY);
    return raw ? (JSON.parse(raw) as BootIntent) : null;
  } catch {
    return null;
  }
}

export const settings: Settings = loadSettings();

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  bus.emit('settings');
}
