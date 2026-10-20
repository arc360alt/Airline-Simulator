import { MODEL_BY_ID, attendantsNeeded, PILOTS_PER_PLANE } from '../../data/planes';
import { S } from '../../game/state';
import type { Staff } from '../../game/types';
import { assignStaff, fire, hire, rerollCandidates, train } from '../../game/actions';
import { crewFor, hireFee, salaryFor, trainCost, xpForNext } from '../../game/economy';
import { h } from '../dom';
import { duration, money, stars } from '../format';
import { confirmModal } from '../modal';
import { report } from '../toast';
import { act, avatar, empty, stat, tabs } from './common';
import type { Panel } from './types';

export const crewPanel: Panel = {
  id: 'crew', title: 'Crew & Hiring', short: 'Crew', icon: 'crew', color: '#8338ec', key: 'C',
  render,
};

function render(): HTMLElement {
  const s = S();
  const [tab, tabEl] = tabs('crew', [
    { id: 'hire', label: 'Applicants', badge: s.candidates.length },
    { id: 'staff', label: 'Your Crew', badge: s.staff.length },
  ]);
  return h('div', tabEl, tab === 'hire' ? applicants() : roster());
}

function perks(st: Staff): HTMLElement {
  const lvl = st.level;
  return st.role === 'pilot'
    ? h('div.perks', h('span', `${Math.round(((lvl - 1) * 0.07 / 1.18) * 100)}% safer`), h('span', `+${lvl - 1}% speed`))
    : h('div.perks', h('span', `${Math.round((lvl - 1) * 7.5)}% faster boarding`), h('span', `+${(lvl * 2.2).toFixed(0)} sat`));
}

function applicants(): HTMLElement {
  const s = S();
  const root = h('div',
    h('div.toolbar',
      h('p.hint', 'New applicants show up every morning. Higher levels fly safer and turn planes around faster — but cost more.'),
      h('button.btn', { onclick: act(rerollCandidates) }, `Post job ad · ${money(5000)}`),
    ),
  );
  if (!s.candidates.length) {
    root.append(empty('crew', 'No applicants today', 'Post a job ad or wait until tomorrow.'));
    return root;
  }
  root.append(
    h('div.people-grid',
      s.candidates.map((c) =>
        h(`article.card.person.${c.role}`,
          h('div.person-head', avatar(c.name, c.color, c.role),
            h('div', h('div.person-name', c.name), h('div.person-role', c.role === 'pilot' ? 'Pilot' : 'Flight Attendant'))),
          h('div.level-row', h('span.stars', stars(c.level)), h('span.level', `LVL ${c.level}`)),
          h('div.trait', `“${c.trait}”`),
          perks(c),
          h('div.row.between',
            h('div.salary', `${money(salaryFor(c.role, c.level))}/day`),
            h('button.btn.primary.small', { disabled: s.money < hireFee(c), onclick: act(() => hire(c.id)) }, `Hire · ${money(hireFee(c))}`),
          ),
        ),
      ),
    ),
  );
  return root;
}

function roster(): HTMLElement {
  const s = S();
  if (!s.staff.length) return empty('crew', 'No staff yet', 'Every aircraft needs 2 pilots and at least 1 flight attendant. Hire from the Applicants tab.');

  const wages = s.staff.reduce((a, st) => a + salaryFor(st.role, st.level), 0);
  const pilots = s.staff.filter((x) => x.role === 'pilot');
  const atts = s.staff.filter((x) => x.role === 'attendant');

  const sorted = [...s.staff].sort((a, b) => (a.role === b.role ? b.level - a.level : a.role === 'pilot' ? -1 : 1));
  return h('div',
    h('div.summary-strip',
      stat('Pilots', String(pilots.length)),
      stat('Attendants', String(atts.length)),
      stat('Unassigned', String(s.staff.filter((x) => !x.planeId).length)),
      stat('Wages/day', money(wages)),
    ),
    h('div.roster', sorted.map(staffRow)),
  );
}

function staffRow(st: Staff): HTMLElement {
  const s = S();
  const plane = st.planeId ? s.planes.find((p) => p.id === st.planeId) : null;
  const mid = plane?.status === 'flying';
  const options = s.planes.filter((p) => {
    if (p.id === st.planeId) return true;
    const { pilots, attendants } = crewFor(p.id);
    const need = st.role === 'pilot' ? PILOTS_PER_PLANE : attendantsNeeded(MODEL_BY_ID[p.modelId]);
    return (st.role === 'pilot' ? pilots.length : attendants.length) < need && p.status !== 'flying';
  });

  const statusText =
    st.status === 'training' ? `Training · ${duration(st.until - s.time)}`
    : st.status === 'injured' ? `Recovering · ${duration(st.until - s.time)}`
    : mid ? 'Flying' : plane ? 'On duty' : 'Free';

  return h(`div.roster-row.${st.role}`,
    avatar(st.name, st.color, st.role),
    h('div.roster-main',
      h('div.person-name', st.name, h('span.level', `LVL ${st.level}`)),
      h('div.xp', h('div.xp-fill', { style: { width: `${(st.xp / xpForNext(st.level)) * 100}%` } })),
      h('div.roster-meta', `${statusText} · ${st.flights} flights · ${money(salaryFor(st.role, st.level))}/day`),
    ),
    h('div.roster-actions',
      h('select.mini-select', {
        disabled: mid,
        onchange: (e: Event) => report(assignStaff(st.id, (e.target as HTMLSelectElement).value || null)),
      },
        h('option', { value: '' }, '— unassigned —'),
        options.map((p) => h('option', { value: p.id, selected: p.id === st.planeId }, `${p.tail} ${p.nickname}`)),
      ),
      h('div.row',
        h('button.btn.small', {
          disabled: st.level >= 10 || st.status !== 'ready' || mid,
          title: 'Send to training: +1 level',
          onclick: act(() => train(st.id)),
        }, st.level >= 10 ? 'MAX' : `${money(trainCost(st))}`),
        h('button.btn.small.danger', {
          disabled: mid,
          onclick: async () => {
            if (await confirmModal(`Let ${st.name} go?`, 'They will leave immediately.', 'Fire', true)) report(fire(st.id));
          },
        }, 'Fire'),
      ),
    ),
  );
}
