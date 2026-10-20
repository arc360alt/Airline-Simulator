import { bus } from '../game/bus';
import { S, game } from '../game/state';
import { AIRPORTS } from '../data/airports';
import { MODEL_BY_ID } from '../data/planes';
import { airportPrice, crewReady, distanceKm } from '../game/economy';
import { h, patchInto } from './dom';
import { money } from './format';
import { ui } from './uiState';
import { PANELS } from './shell';

/**
 * Guided tutorial: a highlight ring over the relevant UI plus an instruction card.
 * Action steps advance on their own once the player has done the thing;
 * info steps have a Next button. Nothing is blocked — the player can click
 * anywhere while the tutorial is running.
 */

const KEY = 'airline-sim/tutorial/v1';
type Status = 'active' | 'done' | 'dismissed';
interface Saved {
  step: number;
  status: Status;
}

interface Step {
  title: string;
  body: () => string;
  /** CSS selector (or finder) for the element to highlight */
  target?: string | (() => Element | null);
  /** the panel that must be open for the target to exist */
  panel?: string;
  /** action steps: auto-advance when this becomes true */
  done?: () => boolean;
}

function pilots(): number {
  return S().staff.filter((x) => x.role === 'pilot').length;
}
function attendants(): number {
  return S().staff.filter((x) => x.role === 'attendant').length;
}

/** A cheap, in-range airport near the hub, so the advice is concrete. */
function suggestedAirport(): string {
  const s = S();
  const hub = s.airline.hub;
  const range = Math.max(1800, ...s.planes.map((p) => MODEL_BY_ID[p.modelId].range));
  const pick = AIRPORTS
    .filter((a) => !s.owned.includes(a.code) && distanceKm(hub, a.code) <= range * 0.9)
    .sort((a, b) => airportPrice(a.code) - airportPrice(b.code) || distanceKm(hub, a.code) - distanceKm(hub, b.code))[0];
  return pick ? `${pick.city} (${pick.code}) for ${money(airportPrice(pick.code))}` : 'a nearby airport';
}

function sparrowBuyButton(): Element | null {
  const card = [...document.querySelectorAll('.model-card')].find((c) => c.textContent?.includes('Sparrow'));
  return card?.querySelector('button.primary') ?? document.querySelector('.store-grid');
}

const STEPS: Step[] = [
  {
    title: 'Welcome aboard',
    body: () => `You are now the CEO of <b>${S().airline.name}</b>. This short tutorial walks you through running your first flight: buying a plane, hiring a crew, getting landing rights and opening a route. You can keep playing normally while it runs.`,
  },
  {
    title: 'Your cash',
    target: '.hud-cash',
    body: () => 'This is your bank balance. Ticket sales add money; fuel, airport fees, wages and repairs take it away. If it drops below zero the bank charges daily interest.',
  },
  {
    title: 'Reputation & satisfaction',
    target: '.hud-gauges',
    body: () => '<b>REP</b> is how the public sees you; higher reputation fills more seats. <b>SAT</b> is how happy recent passengers were. Good service and safe flights raise both; incidents hurt them.',
  },
  {
    title: 'Time controls',
    target: '.hud-time',
    body: () => 'The game clock runs in real time. Pause or speed up here (or press <kbd>Space</kbd> to pause and <kbd>1</kbd>–<kbd>4</kbd> for speed). Wages and airport upkeep are paid each midnight.',
  },
  {
    title: 'Your menus',
    target: '.dock',
    body: () => 'Everything you manage lives in this rail: your Fleet, the plane Store, Crew, Routes, Airports, in-flight Service, Research, the company Books and Settings.',
  },
  {
    title: 'Buy your first plane',
    panel: 'store',
    target: sparrowBuyButton,
    done: () => S().planes.length > 0,
    body: () => `The <b>Sparrow S-19</b> is a cheap 19-seat turboprop with ${MODEL_BY_ID.sparrow.range.toLocaleString()} km of range, perfect for short hops. Click <b>Buy new</b>. (The Used Lot is cheaper, but worn planes break down more.)`,
  },
  {
    title: 'Hire a crew',
    panel: 'crew',
    target: () => (ui.tabs.crew === 'staff' ? document.querySelector('.tabs') : document.querySelector('.people-grid')),
    done: () => pilots() >= 2 && attendants() >= 1,
    body: () =>
      `Every plane needs <b>2 pilots</b> and at least <b>1 flight attendant</b> (one per 50 seats). Higher-level pilots crash less; higher-level attendants board faster and keep passengers happy.<br><br>Hired so far: pilots <b>${Math.min(2, pilots())}/2</b>, attendants <b>${Math.min(1, attendants())}/1</b>.`,
  },
  {
    title: 'Get landing rights',
    panel: 'airports',
    target: '.airport-list',
    done: () => S().owned.length > 1,
    body: () => `A route needs two airports you own. Your hub is free; buy one more. The list is sorted by distance from your hub. A good first pick: <b>${suggestedAirport()}</b>. Click its price to buy it.`,
  },
  {
    title: 'Open a route',
    panel: 'routes',
    target: '.planner',
    done: () => S().routes.length > 0,
    body: () => `Choose your hub (<b>${S().airline.hub}</b>) and your new airport, check the distance is within your plane's range, then click <b>Open route</b>.`,
  },
  {
    title: 'Crew up and assign the route',
    panel: 'fleet',
    target: '.plane-card',
    done: () => S().planes.some((p) => p.routeId && crewReady(p).ok),
    body: () => {
      const p = S().planes[0];
      const crewOk = p ? crewReady(p).ok : false;
      return `Two things on your plane's card:<br>1. ${crewOk ? '<s>Assign crew</s> ✓' : 'Click <b>Auto-crew</b> at the top to seat your staff'}<br>2. ${p?.routeId ? '<s>Choose a route</s> ✓' : 'Pick your new route in the <b>Route</b> dropdown'}`;
    },
  },
  {
    title: 'Ready for take-off',
    done: () => S().planes.some((p) => p.status === 'flying'),
    body: () => {
      const p = S().planes.find((x) => x.routeId);
      const state = p?.status === 'boarding' ? 'Passengers are boarding now.' : 'Your plane will start boarding in a moment.';
      return `${state} Once it departs you'll see it fly along the route on the globe. Planes then shuttle back and forth automatically, earning money every leg. Hover a plane on the globe for details; click it to open its card.`;
    },
  },
  {
    title: 'Speed things up',
    target: '.speed-row',
    body: () => 'Flights take a while in real time. Try <b>3×</b> or <b>8×</b> to watch the money roll in, then pause when you want to plan.',
  },
  {
    title: 'Ticket prices',
    panel: 'routes',
    target: '.price-slider',
    body: () => 'Each route has a price slider. Higher prices earn more per passenger but fewer people buy tickets. The estimate below the slider shows fare, how full the plane will be and profit per flight.',
  },
  {
    title: 'In-flight service',
    target: '[data-panel="service"]',
    body: () => 'In <b>Service</b> you pick the food and drinks served on every flight, and fit wifi or better seats to your planes. Happier passengers raise your reputation and accept higher fares.',
  },
  {
    title: 'Research',
    target: '[data-panel="research"]',
    body: () => 'Every flight earns <b>research points</b>. Spend them in <b>Research</b> to unlock jets and wide-bodies, better cabins, cheaper fuel, safer maintenance and more.',
  },
  {
    title: 'Keep planes healthy',
    panel: 'fleet',
    target: '.inline-range',
    body: () => 'Planes lose condition every flight, and worn planes are more likely to have faults or even crash. <b>Auto-repair</b> sends planes to the hangar when they drop below this level. You can also click <b>Repair</b> on any plane card.',
  },
  {
    title: "You're all set",
    body: () => 'From here, grow however you like: more airports, more routes, bigger planes, better crews. Check <b>Books</b> to see how your airline is doing. You can replay this tutorial any time from <b>Settings</b>. Have a good flight!',
  },
];

let saved: Saved = load();
let overlay: HTMLElement;
let ring: HTMLElement;
let card: HTMLElement;
let scrolledStep = -1;
let advancing = false;

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    /* ignore */
  }
  return { step: 0, status: 'dismissed' };
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* ignore */
  }
}

/** Has the player ever been offered / finished the tutorial? */
function seen(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}

export function startTutorial(): void {
  saved = { step: 0, status: 'active' };
  persist();
  ui.tutorialActive = true;
  delete card.dataset.key;
  bus.emit('change');
  update();
}

function stop(status: Status): void {
  saved.status = status;
  persist();
  ui.tutorialActive = false;
  overlay.classList.remove('show');
  bus.emit('change');
}

function go(step: number): void {
  saved.step = Math.max(0, Math.min(STEPS.length - 1, step));
  persist();
  delete card.dataset.key;
  update();
}

function resolveTarget(step: Step): { el: Element | null; needsPanel: string | null } {
  if (step.panel && ui.open !== step.panel) {
    return { el: document.querySelector(`[data-panel="${step.panel}"]`), needsPanel: step.panel };
  }
  if (!step.target) return { el: null, needsPanel: null };
  const el = typeof step.target === 'string' ? document.querySelector(step.target) : step.target();
  return { el, needsPanel: null };
}

function renderCard(index: number, needsPanel: string | null): void {
  const step = STEPS[index];
  const isAction = !!step.done;
  const panelName = needsPanel ? PANELS.find((p) => p.id === needsPanel)?.title ?? needsPanel : '';
  const body = h('div.tut-body');
  body.innerHTML = step.body();
  patchInto(card, h('div',
    h('div.tut-head',
      h('span.tut-count', `STEP ${index + 1} / ${STEPS.length}`),
      h('button.tut-close', { title: 'End tutorial', onclick: () => stop('dismissed') }, '×'),
    ),
    h('div.tut-progress', h('div.tut-progress-fill', { style: { width: `${((index + 1) / STEPS.length) * 100}%` } })),
    h('h3.tut-title', step.title),
    needsPanel ? h('div.tut-cue', `First, open ${panelName} using the highlighted button.`) : null,
    body,
    h('div.tut-foot',
      index > 0 ? h('button.btn.ghost.small', { onclick: () => go(index - 1) }, 'Back') : h('span'),
      isAction
        ? h('div.row',
            h('span.tut-wait', 'Waiting for you…'),
            h('button.btn.small', { onclick: () => go(index + 1) }, 'Skip step'),
          )
        : index === STEPS.length - 1
          ? h('button.btn.primary.small', { onclick: () => stop('done') }, 'Finish')
          : h('button.btn.primary.small', { onclick: () => go(index + 1) }, index === 0 ? "Let's go" : 'Next'),
    ),
  ));
}

function place(el: Element | null): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cw = Math.min(340, vw - 24);
  card.style.width = `${cw}px`;
  const ch = card.offsetHeight;

  if (!el) {
    ring.style.opacity = '0';
    overlay.classList.remove('dim');
    card.style.left = `${(vw - cw) / 2}px`;
    card.style.top = `${Math.max(12, vh * 0.62 - ch / 2)}px`;
    return;
  }
  const r = el.getBoundingClientRect();
  const pad = 6;
  ring.style.opacity = '1';
  overlay.classList.add('dim');
  ring.style.left = `${r.left - pad}px`;
  ring.style.top = `${r.top - pad}px`;
  ring.style.width = `${r.width + pad * 2}px`;
  ring.style.height = `${r.height + pad * 2}px`;

  // try right, left, below, above; fall back to the bottom of the screen
  const gap = 16;
  const options: [number, number][] = [
    [r.right + gap, r.top + r.height / 2 - ch / 2],
    [r.left - gap - cw, r.top + r.height / 2 - ch / 2],
    [r.left + r.width / 2 - cw / 2, r.bottom + gap],
    [r.left + r.width / 2 - cw / 2, r.top - gap - ch],
  ];
  const fits = ([x, y]: [number, number]) => x >= 8 && y >= 8 && x + cw <= vw - 8 && y + ch <= vh - 8;
  const clampY = (y: number) => Math.max(8, Math.min(vh - ch - 8, y));
  const clampX = (x: number) => Math.max(8, Math.min(vw - cw - 8, x));
  let pos = options.find(([x, y]) => fits([x, clampY(y)]) && (x >= 8 && x + cw <= vw - 8));
  if (pos) pos = [pos[0], clampY(pos[1])];
  else pos = [clampX((vw - cw) / 2), r.top > vh / 2 ? 12 : vh - ch - 12];
  card.style.left = `${clampX(pos[0])}px`;
  card.style.top = `${pos[1]}px`;
}

function update(): void {
  if (!overlay || !game.s || saved.status !== 'active') return;
  overlay.classList.add('show');
  const index = saved.step;
  const step = STEPS[index];

  if (step.done && step.done() && !advancing) {
    // brief pause so the player sees the step tick over
    advancing = true;
    card.classList.add('complete');
    setTimeout(() => {
      advancing = false;
      card.classList.remove('complete');
      if (saved.status === 'active' && saved.step === index) go(index + 1);
    }, 700);
  }

  const { el, needsPanel } = resolveTarget(step);
  // re-render when the step changes, or when its dynamic text changes
  const key = `${index}|${needsPanel}|${step.body()}`;
  if (card.dataset.key !== key) {
    card.dataset.key = key;
    renderCard(index, needsPanel);
  }
  if (el && !needsPanel && scrolledStep !== index && el.closest('.drawer-body')) {
    scrolledStep = index;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  place(el);
}

function offer(root: HTMLElement): void {
  const box = h('div.tut-offer',
    h('div.tut-title', 'New here?'),
    h('p', 'Take a quick guided tour that shows you how to buy a plane, hire a crew and launch your first flight.'),
    h('div.row.end',
      h('button.btn.ghost.small', {
        onclick: () => {
          saved = { step: 0, status: 'dismissed' };
          persist();
          box.remove();
        },
      }, 'No thanks'),
      h('button.btn.primary.small', {
        onclick: () => {
          box.remove();
          startTutorial();
        },
      }, 'Start tutorial'),
    ),
  );
  root.appendChild(box);
}

/** Mount the tutorial layer. `fresh` is true right after founding a new airline. */
export function mountTutorial(root: HTMLElement, fresh: boolean): void {
  ring = h('div.tut-ring');
  card = h('div.tut-card');
  overlay = h('div.tut-overlay', ring, card);
  root.appendChild(overlay);

  // auto-start only for a player's very first airline; later ones can replay it from Settings
  if (fresh && !seen()) startTutorial();
  else if (saved.status === 'active') {
    ui.tutorialActive = true;
    update();
  } else if (!seen()) offer(root);

  let last = 0;
  bus.on('tick', () => {
    const now = performance.now();
    if (now - last < 120) return;
    last = now;
    update();
  });
  bus.on('change', update);
  bus.on('tutorial', startTutorial);
  window.addEventListener('resize', update);
}
