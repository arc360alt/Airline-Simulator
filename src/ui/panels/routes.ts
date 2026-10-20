import { AIRPORT_BY_CODE } from '../../data/airports';
import { MODEL_BY_ID } from '../../data/planes';
import { S } from '../../game/state';
import { bus } from '../../game/bus';
import type { Route } from '../../game/types';
import { createRoute, deleteRoute, setRoutePrice } from '../../game/actions';
import { distanceKm, estimateLeg } from '../../game/economy';
import { h } from '../dom';
import { dist, duration, money, pct } from '../format';
import { confirmModal } from '../modal';
import { report } from '../toast';
import { ui } from '../uiState';
import { empty, refreshPanel } from './common';
import type { Panel } from './types';

export const routesPanel: Panel = {
  id: 'routes', title: 'Route Planner', short: 'Routes', icon: 'routes', color: '#ffb703', key: 'R',
  render,
};

function airportOptions(selected: string, exclude = ''): HTMLOptionElement[] {
  return S().owned
    .filter((c) => c !== exclude)
    .map((c) => h('option', { value: c, selected: c === selected }, `${c} · ${AIRPORT_BY_CODE[c].city}`));
}

function planner(): HTMLElement {
  const s = S();
  if (s.owned.length < 2) {
    return h('div.card.planner',
      h('p', 'You need landing rights at two airports before you can open a route.'),
      h('button.btn.primary', { onclick: () => bus.emit('openPanel', 'airports') }, 'Browse airports'),
    );
  }
  if (!s.owned.includes(ui.routeFrom)) ui.routeFrom = s.airline.hub;
  if (!s.owned.includes(ui.routeTo) || ui.routeTo === ui.routeFrom) {
    // prefer a destination that is not already connected to the origin
    const linked = (c: string) => s.routes.some((r) => (r.from === ui.routeFrom && r.to === c) || (r.to === ui.routeFrom && r.from === c));
    const others = s.owned.filter((c) => c !== ui.routeFrom);
    ui.routeTo = others.find((c) => !linked(c)) ?? others[0];
  }

  const d = distanceKm(ui.routeFrom, ui.routeTo);
  const fleetModels = [...new Set(s.planes.map((p) => p.modelId))].map((id) => MODEL_BY_ID[id]);
  const canFly = fleetModels.filter((m) => m.range >= d);

  return h('div.card.planner',
    h('div.planner-row',
      h('select.route-select', { onchange: (e: Event) => { ui.routeFrom = (e.target as HTMLSelectElement).value; refreshPanel(); } }, airportOptions(ui.routeFrom)),
      h('span.planner-arrow', '⇄'),
      h('select.route-select', { onchange: (e: Event) => { ui.routeTo = (e.target as HTMLSelectElement).value; refreshPanel(); } }, airportOptions(ui.routeTo, ui.routeFrom)),
    ),
    h('div.planner-info',
      h('span', `${dist(d)}`),
      h('span', canFly.length ? `Your ${canFly.map((m) => m.name.split(' ')[0]).join(', ')} can fly it` : fleetModels.length ? 'None of your planes have the range' : 'No planes yet'),
    ),
    h('button.btn.primary.wide', {
      onclick: () => {
        if (report(createRoute(ui.routeFrom, ui.routeTo))) refreshPanel();
      },
    }, 'Open route'),
  );
}

function routeCard(r: Route): HTMLElement {
  const s = S();
  const planes = s.planes.filter((p) => p.routeId === r.id);
  const d = distanceKm(r.from, r.to);
  const sample = planes[0];
  const est = sample ? estimateLeg(r, sample) : null;
  const priceLabel = h('b', `${r.priceMult.toFixed(2)}×`);
  const estEl = h('div.route-est');

  const paintEstimate = () => {
    estEl.replaceChildren();
    if (!sample) {
      estEl.append(h('span.hint', 'Assign a plane from the Fleet panel to start flying.'));
      return;
    }
    const e = estimateLeg(r, sample);
    estEl.append(
      h('span', `${money(e.fare)} fare`),
      h('span', `${pct(e.lf)} full`),
      h('span', `${duration(e.minutes)}`),
      h('span', { class: e.revenue - e.cost >= 0 ? 'pos' : 'neg' }, `${money(e.revenue - e.cost)}/flight`),
    );
  };
  paintEstimate();

  return h('article.card.route-card',
    h('div.route-head',
      h('div.route-codes',
        h('button.code-btn', { onclick: () => bus.emit('focusAirport', r.from) }, r.from),
        h('span.route-line', h('span.route-plane', '✈')),
        h('button.code-btn', { onclick: () => bus.emit('focusAirport', r.to) }, r.to),
      ),
      h('div.route-cities', `${AIRPORT_BY_CODE[r.from].city} ⇄ ${AIRPORT_BY_CODE[r.to].city} · ${dist(d)}`),
    ),
    h('div.route-planes',
      planes.length
        ? planes.map((p) => h('span.tag', `${p.tail} · ${MODEL_BY_ID[p.modelId].name.split(' ')[0]}`))
        : h('span.tag.warn', 'No planes assigned'),
    ),
    h('label.price-slider',
      h('span', 'Ticket price ', priceLabel),
      h('input', {
        type: 'range', min: 0.5, max: 2.5, step: 0.05, value: r.priceMult,
        oninput: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          setRoutePrice(r.id, v);
          priceLabel.textContent = `${v.toFixed(2)}×`;
          paintEstimate();
        },
        onchange: (e: Event) => (e.target as HTMLInputElement).blur(),
      }),
      h('div.slider-ends', h('span', 'Bargain'), h('span', 'Fair'), h('span', 'Premium')),
    ),
    estEl,
    h('div.row.between',
      h('div.route-totals', `${r.flights} flights · `, h('span', { class: r.profit >= 0 ? 'pos' : 'neg' }, `${money(r.profit)} lifetime`)),
      h('button.btn.small.danger', {
        onclick: async () => {
          if (await confirmModal('Close this route?', `${r.from} ⇄ ${r.to} will stop operating and its planes will be parked.`, 'Close route', true)) {
            report(deleteRoute(r.id));
          }
        },
      }, 'Close'),
    ),
    est && est.lf < 0.4 ? h('div.callout', 'Lots of empty seats. Try lowering the price or improving in-flight service.') : null,
  );
}

function render(): HTMLElement {
  const s = S();
  return h('div',
    planner(),
    s.routes.length
      ? h('div.route-list', s.routes.map(routeCard))
      : empty('routes', 'No routes yet', 'Pick two of your airports above and open a route. Aircraft on a route shuttle back and forth automatically.'),
  );
}
