import { MODEL_BY_ID, attendantsNeeded, PILOTS_PER_PLANE } from '../../data/planes';
import { SEATS, WIFI } from '../../data/amenities';
import { S } from '../../game/state';
import { bus } from '../../game/bus';
import type { Plane, Staff } from '../../game/types';
import {
  assignPlaneToRoute, assignStaff, autoCrew, installUpgrade, renamePlane, repairPlane, sellPlane, setAutoRepair,
} from '../../game/actions';
import { crewFor, distanceKm, incidentRisk, installCost, repairCost, resaleValue } from '../../game/economy';
import { h, meter } from '../dom';
import { iconEl } from '../icons';
import { dist, duration, money, pct } from '../format';
import { confirmModal, confirmSpend, openModal } from '../modal';
import { report } from '../toast';
import { ui } from '../uiState';
import { act, empty, stat, refreshPanel } from './common';
import type { Panel } from './types';
import { openCrewPicker } from './crewPicker';

export const fleetPanel: Panel = {
  id: 'fleet', title: 'Your Fleet', short: 'Fleet', icon: 'fleet', color: '#219ebc', key: 'F',
  render,
};

function render(): HTMLElement {
  const s = S();
  const flying = s.planes.filter((p) => p.status === 'flying').length;
  const root = h('div.panel-fleet');

  root.append(
    h('div.summary-strip',
      stat('Planes', String(s.planes.length)),
      stat('Airborne', String(flying)),
      stat('Avg condition', s.planes.length ? pct(s.planes.reduce((a, p) => a + p.condition, 0) / s.planes.length / 100) : '—'),
    ),
    h('div.toolbar',
      h('button.btn.primary', { onclick: () => bus.emit('openPanel', 'store') }, 'Buy planes'),
      h('button.btn', { onclick: act(autoCrew), title: 'Fill empty crew seats with your best free staff' }, 'Auto-crew'),
      h('label.inline-range', { title: 'Planes below this condition go to the hangar automatically when parked' },
        h('span', `Auto-repair below ${s.autoRepairAt ? `${s.autoRepairAt}%` : 'OFF'}`),
        h('input', {
          type: 'range', min: 0, max: 80, step: 5, value: s.autoRepairAt,
          oninput: (e: Event) => setAutoRepair(Number((e.target as HTMLInputElement).value)),
        }),
      ),
    ),
  );

  if (!s.planes.length) {
    root.append(empty('fleet', 'No aircraft yet', 'Visit the Hangar Store to acquire your first aircraft. A used Sparrow is an inexpensive way to start.'));
    return root;
  }

  for (const p of s.planes) root.append(planeCard(p));

  if (ui.highlightPlane) {
    const id = ui.highlightPlane;
    ui.highlightPlane = null;
    requestAnimationFrame(() => document.querySelector(`[data-plane="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }
  return root;
}

function statusLine(p: Plane): HTMLElement {
  const s = S();
  if (p.status === 'flying' && p.leg) {
    const t = (s.time - p.leg.depart) / (p.leg.arrive - p.leg.depart);
    return h('div.status.flying',
      h('span.status-badge', 'IN FLIGHT'),
      h('span', `${p.leg.from} → ${p.leg.to} · ${p.leg.pax} pax · ETA ${duration(p.leg.arrive - s.time)}`),
      h('div.progress', h('div.progress-fill', { style: { width: `${t * 100}%` } }), h('span.progress-plane', { style: { left: `${t * 100}%` } }, '✈')),
    );
  }
  if (p.status === 'boarding') return h('div.status.boarding', h('span.status-badge', 'BOARDING'), h('span', `At ${p.location} · departs in ${duration(p.statusUntil - s.time)}`));
  if (p.status === 'repair') return h('div.status.repair', h('span.status-badge', 'IN HANGAR'), h('span', `Ready in ${duration(p.statusUntil - s.time)}`));
  return h('div.status.idle', h('span.status-badge', 'PARKED'), h('span', `At ${p.location}${p.hold ? ` · ${p.hold}` : ''}`));
}

function crewRow(p: Plane, role: Staff['role']): HTMLElement {
  const { pilots, attendants } = crewFor(p.id);
  const list = role === 'pilot' ? pilots : attendants;
  const need = role === 'pilot' ? PILOTS_PER_PLANE : attendantsNeeded(MODEL_BY_ID[p.modelId]);
  const locked = p.status === 'flying';

  return h('div.crew-row',
    h('span.crew-role', `${role === 'pilot' ? 'Pilots' : 'Attendants'} ${list.length}/${need}`),
    h('div.crew-chips',
      list.map((st) =>
        h(`span.crew-chip${st.status !== 'ready' ? '.away' : ''}`, { title: `${st.name} · level ${st.level}${st.status !== 'ready' ? ` · ${st.status}` : ''}` },
          h('b', `L${st.level}`), ` ${st.name.split(' ')[0]}`,
          !locked && h('button.chip-x', { onclick: act(() => assignStaff(st.id, null)), title: 'Unassign' }, '×'),
        ),
      ),
      list.length < need && !locked &&
        h('button.btn.small.add-crew', { onclick: () => openCrewPicker(p.id, role) },
          role === 'pilot' ? '+ Add pilot' : '+ Add attendant'),
    ),
  );
}

function upgradeSelect(p: Plane, kind: 'wifi' | 'seats'): HTMLElement {
  const s = S();
  const list = kind === 'wifi' ? WIFI : SEATS;
  return h('label.upgrade',
    h('span', kind === 'wifi' ? 'Wifi' : 'Seats'),
    h('select.mini-select', {
      onchange: async (e: Event) => {
        const el = e.target as HTMLSelectElement;
        const item = list.find((a) => a.id === el.value)!;
        if (!(await confirmSpend(installCost(item.cost, p), s.money, item.name))) return refreshPanel();
        report(installUpgrade(p.id, kind, el.value));
        refreshPanel();
      },
    },
      list.map((a) => {
        const locked = !!a.requires && !s.research.includes(a.requires);
        return h('option', { value: a.id, selected: p[kind] === a.id, disabled: locked },
          `${a.name}${p[kind] === a.id ? '' : locked ? ' (locked)' : a.cost ? ` · ${money(installCost(a.cost, p))}` : ''}`);
      }),
    ),
  );
}

function planeCard(p: Plane): HTMLElement {
  const s = S();
  const model = MODEL_BY_ID[p.modelId];
  const risk = incidentRisk(p);
  const fix = repairCost(p);

  const routeSelect = h('select.route-select', {
    onchange: (e: Event) => report(assignPlaneToRoute(p.id, (e.target as HTMLSelectElement).value || null)),
  },
    h('option', { value: '' }, '— no route (parked) —'),
    s.routes.map((r) => {
      const d = distanceKm(r.from, r.to);
      return h('option', { value: r.id, selected: p.routeId === r.id, disabled: d > model.range },
        `${r.from} ⇄ ${r.to} · ${dist(d)}${d > model.range ? ' (out of range)' : ''}`);
    }),
  );

  return h('article.card.plane-card', { 'data-plane': p.id, style: { '--livery': model.color } as any },
    h('div.plane-head',
      h('div.plane-emoji', iconEl('fleet', 24)),
      h('div.plane-title',
        h('div.plane-name', `"${p.nickname}"`, h('button.icon-btn.text', { title: 'Rename', onclick: () => rename(p) }, 'Rename')),
        h('div.plane-sub', `${p.tail} · ${model.name}`, p.used && h('span.tag.used', 'USED')),
      ),
      h('div.plane-profit', { class: p.profit >= 0 ? 'pos' : 'neg' }, money(p.profit)),
    ),
    statusLine(p),
    h('div.plane-stats',
      h('div.cond', h('span', `Condition ${Math.round(p.condition)}%`), meter(p.condition)),
      stat('Risk/flight', `${(risk * 100).toFixed(1)}%`, risk > 0.05 ? 'warn' : ''),
      stat('Age', `${p.age.toFixed(1)}y`),
      stat('Flights', String(p.flights)),
    ),
    h('div.field', h('span.field-label', 'Route'), routeSelect),
    crewRow(p, 'pilot'),
    crewRow(p, 'attendant'),
    h('div.upgrades', upgradeSelect(p, 'wifi'), upgradeSelect(p, 'seats')),
    h('div.row.end',
      h('button.btn.small', {
        disabled: p.status === 'flying' || p.status === 'repair' || p.condition >= 99.5,
        onclick: act(() => repairPlane(p.id)),
      }, `Repair ${p.condition >= 99.5 ? '' : money(fix)}`),
      h('button.btn.small.danger', {
        disabled: p.status === 'flying',
        onclick: async () => {
          if (await confirmModal('Sell this plane?', `${p.tail} "${p.nickname}" will fetch ${money(resaleValue(p))}. Its crew will be unassigned.`, 'Sell', true)) {
            report(sellPlane(p.id));
          }
        },
      }, `Sell ${money(resaleValue(p))}`),
    ),
  );
}

function rename(p: Plane): void {
  const input = h('input.text-input', { value: p.nickname, maxlength: 24 }) as HTMLInputElement;
  const close = openModal(
    h('form.confirm', {
      onsubmit: (e: Event) => {
        e.preventDefault();
        report(renamePlane(p.id, input.value.trim()));
        close();
      },
    },
      h('h2.modal-title', 'Name your plane'),
      input,
      h('div.row.end', h('button.btn.primary', { type: 'submit' }, 'Save')),
    ),
  );
  setTimeout(() => input.select(), 50);
}
