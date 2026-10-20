import { DRINKS, FOOD, SEATS, WIFI, findAmenity, type Amenity } from '../../data/amenities';
import { S } from '../../game/state';
import { bus } from '../../game/bus';
import { installUpgrade, setMenu } from '../../game/actions';
import { installCost, planeJoy, servicePerPax } from '../../game/economy';
import { h } from '../dom';
import { iconEl } from '../icons';
import { money, pct } from '../format';
import { confirmSpend } from '../modal';
import { act, section, stat } from './common';
import type { Panel } from './types';

export const servicePanel: Panel = {
  id: 'service', title: 'In-flight Service', short: 'Service', icon: 'service', color: '#ff3d7f', key: 'S',
  render,
};

function locked(a: Amenity): boolean {
  return !!a.requires && !S().research.includes(a.requires);
}

function menuCards(kind: 'food' | 'drinks', list: Amenity[]): HTMLElement {
  const current = S().service[kind];
  return h('div.menu-grid',
    list.map((a) =>
      h(`button.menu-card${a.id === current ? '.active' : ''}${locked(a) ? '.locked' : ''}`, {
        disabled: locked(a),
        onclick: act(() => setMenu(kind, a.id)),
      },
        h('span.menu-emoji', locked(a) ? iconEl('lock', 20) : a.emoji),
        h('span.menu-name', a.name),
        h('span.menu-desc', a.desc),
        h('span.menu-stats',
          h('span', { class: a.joy >= 0 ? 'pos' : 'neg' }, `${a.joy >= 0 ? '+' : ''}${a.joy} sat`),
          a.fareBonus ? h('span', `+${pct(a.fareBonus)} fare`) : null,
          h('span', `${money(a.cost)}/pax`),
        ),
      ),
    ),
  );
}

function cabinRow(kind: 'wifi' | 'seats', list: Amenity[]): HTMLElement {
  const s = S();
  return h('div.cabin-grid',
    list.slice(1).map((a) => {
      const targets = s.planes.filter((p) => p[kind] !== a.id);
      const total = targets.reduce((sum, p) => sum + installCost(a.cost, p), 0);
      const have = s.planes.length - targets.length;
      return h(`div.cabin-card${locked(a) ? '.locked' : ''}`,
        h('div.menu-emoji', locked(a) ? iconEl('lock', 20) : a.emoji),
        h('div', h('b', a.name), h('div.menu-desc', a.desc),
          h('div.menu-stats', h('span.pos', `+${a.joy} sat`), h('span', `+${pct(a.fareBonus)} fare`), h('span', `${money(a.cost)}/seat`))),
        h('div.cabin-side',
          h('span.tag', `${have}/${s.planes.length} planes`),
          h('button.btn.small', {
            disabled: locked(a) || !targets.length || s.money < total,
            onclick: async () => {
              if (!(await confirmSpend(total, s.money, `${a.name} on ${targets.length} planes`))) return;
              let n = 0;
              for (const p of targets) if (installUpgrade(p.id, kind, a.id, true).ok) n++;
              bus.emit('toast', { msg: `Installed ${a.name} on ${n} plane${n === 1 ? '' : 's'}.`, kind: 'money' });
            },
          }, targets.length ? `Fit all · ${money(total)}` : 'All fitted'),
        ),
      );
    }),
  );
}

function render(): HTMLElement {
  const s = S();
  const avgJoy = s.planes.length ? s.planes.reduce((a, p) => a + planeJoy(p), 0) / s.planes.length : 0;
  return h('div',
    h('div.summary-strip',
      stat('Menu cost', `${money(servicePerPax())}/pax`),
      stat('Fleet comfort', s.planes.length ? `${avgJoy.toFixed(0)} / 100` : '—'),
      stat('Satisfaction', s.satisfaction.toFixed(0)),
    ),
    h('p.hint', 'Happy passengers boost your reputation and will pay a little more per ticket. Food & drinks apply to every flight; cabin upgrades are fitted per plane.'),
    section('Snacks & Meals', menuCards('food', FOOD)),
    section('Drinks Trolley', menuCards('drinks', DRINKS)),
    section('Wifi', cabinRow('wifi', WIFI)),
    section('Seats', cabinRow('seats', SEATS)),
    h('p.hint', `Currently serving ${findAmenity(FOOD, s.service.food).name} and ${findAmenity(DRINKS, s.service.drinks).name}. Locked items can be unlocked in Research.`),
  );
}
