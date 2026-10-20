import { MODEL_BY_ID, PLANE_MODELS, attendantsNeeded, type PlaneModel } from '../../data/planes';
import { RESEARCH_BY_ID } from '../../data/research';
import { S } from '../../game/state';
import { bus } from '../../game/bus';
import { buyNewPlane, buyUsedPlane, rerollMarket } from '../../game/actions';
import { h, meter } from '../dom';
import { iconEl } from '../icons';
import { dist, money } from '../format';
import { confirmSpend } from '../modal';
import { report } from '../toast';
import { act, bar, empty, tabs } from './common';
import type { Panel } from './types';

export const storePanel: Panel = {
  id: 'store', title: 'Hangar Store', short: 'Store', icon: 'store', color: '#ff5d3a', key: 'B',
  render,
};

function render(): HTMLElement {
  const s = S();
  const [tab, tabEl] = tabs('store', [
    { id: 'new', label: 'Factory New' },
    { id: 'used', label: 'Used Lot', badge: s.market.length },
  ]);
  return h('div', tabEl, tab === 'new' ? newPlanes() : usedPlanes());
}

function specs(m: PlaneModel): HTMLElement {
  const safety = Math.max(0, 1.6 - m.risk);
  return h('div.specs',
    h('div.spec', h('span', 'Seats'), bar(m.capacity, 520, '#ff5d3a'), h('b', String(m.capacity))),
    h('div.spec', h('span', 'Speed'), bar(m.speed, 2150, '#219ebc'), h('b', `${m.speed} km/h`)),
    h('div.spec', h('span', 'Range'), bar(m.range, 14800, '#2a9d8f'), h('b', dist(m.range))),
    h('div.spec', h('span', 'Thirst'), bar(m.fuelBurn, 16, '#e63946'), h('b', `${m.fuelBurn} L/km`)),
    h('div.spec', h('span', 'Safety'), bar(safety, 1, '#8ac926'), h('b', safety > 0.75 ? 'Great' : safety > 0.55 ? 'Good' : 'Meh')),
  );
}

function locked(m: PlaneModel): string | null {
  if (!m.requires || S().research.includes(m.requires)) return null;
  return RESEARCH_BY_ID[m.requires].name;
}

function newPlanes(): HTMLElement {
  const s = S();
  return h('div.store-grid',
    PLANE_MODELS.map((m) => {
      const lock = locked(m);
      return h(`article.card.model-card${lock ? '.locked' : ''}`, { style: { '--livery': m.color } as any },
        h('div.model-hero', h('span.model-emoji', iconEl('fleet', 26)), h('div', h('div.model-name', m.name), h('div.model-maker', m.maker))),
        h('p.model-blurb', m.blurb),
        specs(m),
        h('div.model-crew', `Crew: 2 pilots + ${attendantsNeeded(m)} attendant${attendantsNeeded(m) > 1 ? 's' : ''}`),
        h('div.row.between',
          h('div.price-tag', money(m.price)),
          lock
            ? h('button.btn', { onclick: () => bus.emit('openPanel', 'research') , title: `Requires research: ${lock}` }, 'Requires research')
            : h('button.btn.primary', {
                disabled: s.money < m.price,
                onclick: async () => {
                  if (await confirmSpend(m.price, s.money, m.name)) report(buyNewPlane(m.id));
                },
              }, 'Buy new'),
        ),
      );
    }),
  );
}

function usedPlanes(): HTMLElement {
  const s = S();
  const root = h('div',
    h('div.toolbar',
      h('p.hint', 'Second-hand planes are cheap but worn — they break down more often. Fresh listings arrive every 2 days.'),
      h('button.btn', { onclick: act(rerollMarket) }, `New listings · ${money(8000)}`),
    ),
  );
  if (!s.market.length) {
    root.append(empty('store', 'No listings', 'Check back in a couple of days, or pay your broker to find more.'));
    return root;
  }
  root.append(
    h('div.store-grid',
      s.market.map((l) => {
        const m = MODEL_BY_ID[l.modelId];
        const lock = locked(m);
        const saving = 1 - l.price / m.price;
        return h(`article.card.model-card.used${lock ? '.locked' : ''}`, { style: { '--livery': m.color } as any },
          h('div.model-hero', h('span.model-emoji', iconEl('fleet', 26)), h('div', h('div.model-name', m.name), h('div.model-maker', `${l.age} years old · ${m.capacity} seats`))),
          h('div.cond', h('span', `Condition ${l.condition}%`), meter(l.condition)),
          h('div.sticker', `-${Math.round(saving * 100)}%`),
          h('div.row.between',
            h('div.price-tag', money(l.price), h('s.old-price', money(m.price))),
            lock
              ? h('button.btn', { disabled: true }, `${lock}`)
              : h('button.btn.primary', {
                  disabled: s.money < l.price,
                  onclick: async () => {
                    if (await confirmSpend(l.price, s.money, `This used ${m.name}`)) report(buyUsedPlane(l.id));
                  },
                }, 'Buy used'),
          ),
        );
      }),
    ),
  );
  return root;
}
