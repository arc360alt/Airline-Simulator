import { AIRPORTS, AIRPORT_BY_CODE, SIZE_LABEL, type Airport } from '../../data/airports';
import { S } from '../../game/state';
import { bus } from '../../game/bus';
import { buyAirport } from '../../game/actions';
import { airportPrice, distanceKm } from '../../game/economy';
import { h } from '../dom';
import { dist, money } from '../format';
import { confirmSpend } from '../modal';
import { report } from '../toast';
import { ui } from '../uiState';
import { refreshPanel, tabs } from './common';
import type { Panel } from './types';

export const airportsPanel: Panel = {
  id: 'airports', title: 'Airports', short: 'Airports', icon: 'airports', color: '#2a9d8f', key: 'A',
  render,
};

function sizePips(size: number): HTMLElement {
  return h('span.pips', { title: SIZE_LABEL[size] }, Array.from({ length: 4 }, (_, i) => h(`span.pip${i < size ? '.on' : ''}`)));
}

async function buy(a: Airport): Promise<void> {
  const price = airportPrice(a.code);
  if (await confirmSpend(price, S().money, `Landing rights at ${a.city}`)) report(buyAirport(a.code));
}

function detail(code: string): HTMLElement {
  const s = S();
  const a = AIRPORT_BY_CODE[code];
  const owned = s.owned.includes(code);
  const routes = s.routes.filter((r) => r.from === code || r.to === code);
  const fromHub = distanceKm(s.airline.hub, code);
  return h('article.card.airport-detail',
    h('div.airport-big-code', a.code),
    h('div',
      h('div.airport-city', `${a.city}, ${a.country}`),
      h('div.airport-meta', sizePips(a.size), ` ${SIZE_LABEL[a.size]}`, code !== s.airline.hub ? ` · ${dist(fromHub)} from hub` : ' · Your hub'),
      h('div.airport-meta', owned ? `${routes.length} route${routes.length === 1 ? '' : 's'} · upkeep ${money(a.size * 120)}/day` : `Upkeep ${money(a.size * 120)}/day once owned`),
    ),
    h('div.airport-actions',
      owned
        ? h('button.btn', {
            onclick: () => {
              ui.routeFrom = code === s.airline.hub ? s.airline.hub : code;
              bus.emit('openPanel', 'routes');
            },
          }, 'Plan route')
        : h('button.btn.primary', { disabled: s.money < airportPrice(code), onclick: () => buy(a) }, `Buy rights · ${money(airportPrice(code))}`),
    ),
  );
}

function render(): HTMLElement {
  const s = S();
  const [tab, tabEl] = tabs('airports', [
    { id: 'all', label: 'All' },
    { id: 'owned', label: 'Yours', badge: s.owned.length },
  ]);
  const q = ui.airportFilter.toLowerCase();
  const list = AIRPORTS
    .filter((a) => tab === 'all' || s.owned.includes(a.code))
    .sort((a, b) => distanceKm(s.airline.hub, a.code) - distanceKm(s.airline.hub, b.code));

  const search = h('input.text-input.search', {
    placeholder: 'Search city, country or code…',
    value: ui.airportFilter,
    oninput: (e: Event) => {
      ui.airportFilter = (e.target as HTMLInputElement).value;
      // filter in place so the input keeps focus while typing
      const term = ui.airportFilter.toLowerCase();
      document.querySelectorAll<HTMLElement>('.airport-row').forEach((row) => {
        row.style.display = !term || row.dataset.search!.includes(term) ? '' : 'none';
      });
    },
    onblur: refreshPanel,
  });

  return h('div',
    ui.selectedAirport ? detail(ui.selectedAirport) : h('p.hint', 'Tip: click any dot on the globe to inspect that airport.'),
    tabEl,
    search,
    h('div.airport-list',
      list.map((a) => {
        const owned = s.owned.includes(a.code);
        return h(`div.airport-row${owned ? '.owned' : ''}${ui.selectedAirport === a.code ? '.selected' : ''}`, {
          'data-search': `${a.code} ${a.city} ${a.country}`.toLowerCase(),
          style: { display: !q || `${a.code} ${a.city} ${a.country}`.toLowerCase().includes(q) ? '' : 'none' },
          onclick: () => {
            ui.selectedAirport = a.code;
            bus.emit('focusAirport', a.code);
            refreshPanel();
          },
        },
          h('span.airport-code', a.code),
          h('div.airport-names', h('b', a.city), h('small', `${a.country} · ${dist(distanceKm(s.airline.hub, a.code))}`)),
          sizePips(a.size),
          owned
            ? h('span.tag.owned', a.code === s.airline.hub ? 'HUB' : 'OWNED')
            : h('button.btn.small', {
                disabled: s.money < airportPrice(a.code),
                onclick: (e: Event) => {
                  e.stopPropagation();
                  void buy(a);
                },
              }, money(airportPrice(a.code))),
        );
      }),
    ),
  );
}
