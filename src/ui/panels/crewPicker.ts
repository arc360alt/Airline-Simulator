import { MODEL_BY_ID, attendantsNeeded, PILOTS_PER_PLANE } from '../../data/planes';
import { S } from '../../game/state';
import { bus } from '../../game/bus';
import type { Plane, Role, Staff } from '../../game/types';
import { assignStaff } from '../../game/actions';
import { crewFor, salaryFor } from '../../game/economy';
import { h, patchInto } from '../dom';
import { duration, money, stars } from '../format';
import { openModal } from '../modal';
import { report } from '../toast';
import { avatar } from './common';

type Availability =
  | { kind: 'here' }
  | { kind: 'free' }
  | { kind: 'elsewhere'; tail: string }
  | { kind: 'blocked'; why: string };

function availability(st: Staff, plane: Plane): Availability {
  const s = S();
  if (st.planeId === plane.id) return { kind: 'here' };
  if (st.status === 'injured') return { kind: 'blocked', why: `Recovering · ${duration(st.until - s.time)}` };
  if (st.status === 'training') return { kind: 'blocked', why: `In training · ${duration(st.until - s.time)}` };
  if (st.planeId) {
    const other = s.planes.find((x) => x.id === st.planeId);
    if (other?.status === 'flying') return { kind: 'blocked', why: `Flying on ${other.tail}` };
    return { kind: 'elsewhere', tail: other?.tail ?? 'another plane' };
  }
  return { kind: 'free' };
}

// people already on this plane first, so each pick visibly lands at the top
const ORDER: Record<Availability['kind'], number> = { here: 0, free: 1, elsewhere: 2, blocked: 3 };

/**
 * Pick crew for a plane: lists everyone in the chosen role. Clicking an
 * available person adds them immediately; people already on this plane (or
 * unavailable) are greyed out. Stays open so several seats can be filled, and
 * closes itself once every seat is taken.
 */
export function openCrewPicker(planeId: string, role: Role): void {
  const body = h('div');
  let closed = false;
  // repaint whenever game data changes (an add, or someone finishing training)
  const stop = bus.on('change', () => paint());
  const finish = openModal(h('div.crew-picker', body), {
    wide: true,
    onClose: () => {
      closed = true;
      stop();
    },
  });

  const paint = () => {
    if (closed) return;
    const s = S();
    const plane = s.planes.find((x) => x.id === planeId);
    if (!plane || plane.status === 'flying') return finish();
    const model = MODEL_BY_ID[plane.modelId];
    const need = role === 'pilot' ? PILOTS_PER_PLANE : attendantsNeeded(model);
    const { pilots, attendants } = crewFor(plane.id);
    const have = (role === 'pilot' ? pilots : attendants).length;
    const full = have >= need;
    const label = role === 'pilot' ? 'pilot' : 'flight attendant';

    const people = s.staff
      .filter((x) => x.role === role)
      .map((st) => ({ st, av: availability(st, plane) }))
      .sort((a, b) => ORDER[a.av.kind] - ORDER[b.av.kind] || b.st.level - a.st.level);

    const row = ({ st, av }: { st: Staff; av: Availability }) => {
      const pickable = !full && (av.kind === 'free' || av.kind === 'elsewhere');
      const status =
        av.kind === 'here' ? '✓ On this plane'
        : av.kind === 'free' ? 'Available'
        : av.kind === 'elsewhere' ? `On ${av.tail} · will move here`
        : av.why;
      return h(`button.picker-row.${av.kind}${pickable ? '' : '.disabled'}`, {
        type: 'button',
        disabled: !pickable,
        onclick: () => {
          if (report(assignStaff(st.id, plane.id))) {
            bus.emit('toast', { msg: `${st.name} added to ${plane.tail}.`, kind: 'good' });
          }
        },
      },
        avatar(st.name, st.color, st.role),
        h('div.picker-main',
          h('div.picker-name', st.name, h('span.level', `LVL ${st.level}`)),
          h('div.picker-meta', h('span.stars', stars(st.level)), ` · ${money(salaryFor(st.role, st.level))}/day · ${st.trait}`),
        ),
        h(`span.picker-status.${av.kind}`, status),
        pickable ? h('span.picker-add', 'Add') : null,
      );
    };

    patchInto(body, h('div',
      h('div.picker-head',
        h('div',
          h('h2.modal-title', `Add ${label}s`),
          h('div.picker-sub', `${plane.tail} "${plane.nickname}" · ${model.name}`),
        ),
        h(`div.picker-seats${full ? '.full' : ''}`, h('b', `${have}/${need}`), h('span', 'seats filled')),
      ),
      h('div.picker-seatbar', Array.from({ length: need }, (_, i) => h(`span${i < have ? '.on' : ''}`))),
      people.length
        ? h('div.picker-list', people.map(row))
        : h('p.hint', `You haven't hired any ${label}s yet.`),
      h('div.row.between.picker-foot',
        h('button.btn.ghost', {
          onclick: () => {
            finish();
            bus.emit('openPanel', 'crew');
          },
        }, `Hire more ${label}s`),
        h('button.btn.primary', { onclick: finish }, 'Done'),
      ),
    ));

    // close a moment after the last seat fills, so the player sees it tick over
    if (full) setTimeout(finish, 900);
  };

  paint();
}
