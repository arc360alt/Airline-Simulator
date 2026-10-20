import { AIRPORTS, AIRPORT_BY_CODE, RECOMMENDED_HUBS, SIZE_LABEL } from '../data/airports';
import { h } from './dom';

interface HubPickerOptions {
  value: string;
  onChange: (code: string) => void;
  /** optional extra text per airport, e.g. a relocation price */
  note?: (code: string) => string;
}

/**
 * Hub chooser: one-click buttons for recommended hubs (with the reason in a
 * tooltip), plus a full dropdown grouped into recommended and all airports.
 */
export function hubPicker(opts: HubPickerOptions): HTMLElement {
  let value = opts.value;
  const recommended = new Set(RECOMMENDED_HUBS.map((r) => r.code));
  const others = AIRPORTS.filter((a) => a.size >= 2 && !recommended.has(a.code)).sort((a, b) => a.city.localeCompare(b.city));
  const label = (code: string) => {
    const a = AIRPORT_BY_CODE[code];
    const note = opts.note?.(code);
    return `${a.city} (${a.code}) · ${SIZE_LABEL[a.size]}${note ? ` · ${note}` : ''}`;
  };

  const select = h('select.route-select',
    h('optgroup', { label: 'Recommended hubs' }, RECOMMENDED_HUBS.map((r) => h('option', { value: r.code, selected: r.code === value }, label(r.code)))),
    h('optgroup', { label: 'All airports' }, others.map((a) => h('option', { value: a.code, selected: a.code === value }, label(a.code)))),
  ) as HTMLSelectElement;

  const why = h('div.hub-why');
  const chips = RECOMMENDED_HUBS.map((r) =>
    h('button.hub-chip', {
      type: 'button',
      title: `${AIRPORT_BY_CODE[r.code].city}: ${r.why}`,
      'data-code': r.code,
      onclick: () => set(r.code),
    }, h('b', r.code), h('span', AIRPORT_BY_CODE[r.code].city.replace(/ \(NYC\)$/, ''))),
  );

  const paint = () => {
    chips.forEach((c) => c.classList.toggle('active', c.dataset.code === value));
    if (select.value !== value) select.value = value;
    const rec = RECOMMENDED_HUBS.find((r) => r.code === value);
    why.textContent = rec ? rec.why : `${AIRPORT_BY_CODE[value].city}, ${AIRPORT_BY_CODE[value].country}`;
  };
  const set = (code: string) => {
    value = code;
    paint();
    opts.onChange(code);
  };
  select.addEventListener('change', () => set(select.value));
  paint();

  return h('div.hub-picker', h('div.hub-chips', chips), select, why);
}
