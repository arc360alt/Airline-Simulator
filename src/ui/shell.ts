import { bus } from '../game/bus';
import { S, game, settings } from '../game/state';
import { MODEL_BY_ID } from '../data/planes';
import { h, clear, patchInto } from './dom';
import { clock, duration, pct } from './format';
import { sfx } from './sfx';
import { iconEl } from './icons';
import type { Panel } from './panels/types';
import { ui } from './uiState';
import { fleetPanel } from './panels/fleet';
import { storePanel } from './panels/store';
import { crewPanel } from './panels/crew';
import { routesPanel } from './panels/routes';
import { airportsPanel } from './panels/airports';
import { servicePanel } from './panels/service';
import { researchPanel } from './panels/research';
import { financePanel } from './panels/finance';
import { settingsPanel } from './panels/settings';

export const PANELS: Panel[] = [
  fleetPanel, storePanel, crewPanel, routesPanel, airportsPanel,
  servicePanel, researchPanel, financePanel, settingsPanel,
];


let drawer: HTMLElement;
let drawerBody: HTMLElement;
let drawerTitle: HTMLElement;
let drawerIcon: HTMLElement;
let dockButtons = new Map<string, HTMLElement>();
let pointerDownInDrawer = false;
let dirty = false;

export function openPanel(id: string | null): void {
  if (ui.open === id) id = null;
  ui.open = id;
  sfx.click();
  for (const [pid, btn] of dockButtons) btn.classList.toggle('active', pid === id);
  drawer.classList.toggle('open', !!id);
  if (id) {
    drawerBody.scrollTop = 0;
    render();
  }
}

export function refreshPanel(): void {
  dirty = true;
}

let renderedPanel: string | null = null;

function render(): void {
  const panel = PANELS.find((p) => p.id === ui.open);
  if (!panel || !game.s) return;
  if (renderedPanel !== panel.id) {
    // switching panels: start fresh
    renderedPanel = panel.id;
    drawerTitle.textContent = panel.title;
    drawerIcon.replaceChildren(iconEl(panel.icon, 18));
    drawer.style.setProperty('--panel-color', panel.color);
    drawerBody.replaceChildren(panel.render());
  } else {
    // same panel: patch in place so scroll positions and hover states survive
    patchInto(drawerBody, panel.render());
  }
  dirty = false;
}

function canRerender(): boolean {
  if (pointerDownInDrawer) return false;
  const active = document.activeElement;
  return !(active && drawer.contains(active) && active.matches('input, select, textarea'));
}

export function mountShell(root: HTMLElement): void {
  const dock = h('nav.dock',
    PANELS.map((p) => {
      const btn = h('button.dock-btn', { 'data-panel': p.id, onclick: () => openPanel(p.id), title: `${p.title} (${p.key})`, style: { '--btn-color': p.color } as any },
        h('span.dock-icon', iconEl(p.icon, 22)),
        h('span.dock-label', p.short),
      );
      dockButtons.set(p.id, btn);
      return btn;
    }),
  );

  drawerTitle = h('h2.drawer-title');
  drawerIcon = h('span.drawer-icon');
  drawerBody = h('div.drawer-body');
  drawer = h('aside.drawer',
    h('div.drawer-head', drawerIcon, drawerTitle, h('button.drawer-close', { onclick: () => openPanel(null), title: 'Close (Esc)' }, iconEl('close', 16))),
    h('div.perforation'),
    drawerBody,
  );
  drawer.addEventListener('pointerdown', () => (pointerDownInDrawer = true));
  // The panel holds off redrawing while a control has focus (so it can't change
  // under the player mid-choice). Once a dropdown/slider/checkbox has committed
  // its value, release focus and redraw right away, so the result shows up and
  // the control is ready to use again (e.g. adding a second crew member).
  drawer.addEventListener('change', (e) => {
    const el = e.target as HTMLElement;
    if (!el.matches('select, input[type="range"], input[type="checkbox"]')) return;
    setTimeout(() => {
      el.blur();
      dirty = true;
    });
  });
  window.addEventListener('pointerup', () => (pointerDownInDrawer = false));

  const ticker = h('div.ticker');
  const tickerWrap = h('footer.ticker-wrap', h('div.ticker-tag', 'OPS LOG'), h('div.ticker-window', ticker));

  const tooltip = h('div.plane-tip');

  root.append(dock, drawer, tickerWrap, tooltip);

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    // a popup on top (picker, confirm dialog) gets Esc first; only close the panel when none is open
    if (document.querySelector('.modal-backdrop')) return;
    if (e.key === 'Escape' && ui.open) openPanel(null);
    const p = PANELS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
    if (p && !e.metaKey && !e.ctrlKey) openPanel(p.id);
  });

  bus.on('change', () => (dirty = true));
  bus.on('openPanel', (id) => {
    if (ui.open !== id) openPanel(id);
  });

  // redraw on data changes, plus a slow refresh so live numbers stay fresh
  let last = 0;
  bus.on('tick', () => {
    const now = performance.now();
    if (!ui.open || !canRerender()) return;
    if (dirty || now - last > 1000) {
      last = now;
      render();
    }
  });

  // ticker: the latest happenings, departure-board style
  let lastLogKey = '';
  const updateTicker = () => {
    if (!game.s) return;
    tickerWrap.style.display = settings.ticker ? '' : 'none';
    const items = S().log.slice(0, 8);
    const key = items.map((l) => l.t + l.msg).join();
    if (key === lastLogKey) return;
    lastLogKey = key;
    clear(ticker);
    const row = items.map((l) => h(`span.tick-item.k-${l.kind}`, h('b', clock(l.t).replace('DAY ', 'D')), ' ', l.msg));
    // two copies make the marquee loop seamless
    ticker.append(h('div.tick-row', row), h('div.tick-row', { 'aria-hidden': 'true' }, row.map((n) => n.cloneNode(true))));
    ticker.style.animationDuration = `${Math.max(30, items.reduce((a, l) => a + l.msg.length, 0) / 6)}s`;
  };
  bus.on('change', updateTicker);
  bus.on('settings', updateTicker);
  setInterval(updateTicker, 2000);

  // tooltip for planes hovered on the globe
  showPlaneTip = (hover) => {
    if (!hover || !game.s) {
      tooltip.classList.remove('show');
      return;
    }
    const p = S().planes.find((x) => x.id === hover.planeId);
    if (!p || !p.leg) return tooltip.classList.remove('show');
    const t = (S().time - p.leg.depart) / (p.leg.arrive - p.leg.depart);
    clear(tooltip);
    tooltip.append(
      h('div.tip-tail', `${p.tail} · ${p.nickname}`),
      h('div.tip-route', h('b', p.leg.from), h('span.tip-line', h('span.tip-dot', { style: { left: `${t * 100}%` } })), h('b', p.leg.to)),
      h('div.tip-meta', `${MODEL_BY_ID[p.modelId].name} · ${p.leg.pax} pax · ${pct(p.condition / 100)} condition`),
      h('div.tip-meta', `ETA ${duration(Math.max(0, p.leg.arrive - S().time))}`),
    );
    tooltip.style.transform = `translate(${hover.x + 16}px, ${hover.y + 16}px)`;
    tooltip.classList.add('show');
  };
}

export let showPlaneTip: (hover: { planeId: string; x: number; y: number } | null) => void = () => {};
