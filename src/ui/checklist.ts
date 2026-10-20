import { bus } from '../game/bus';
import { S, game } from '../game/state';
import { h, patchInto } from './dom';
import { iconEl } from './icons';
import { ui } from './uiState';

const KEY = 'airline-sim/checklist-hidden';

interface Step {
  label: string;
  panel: string;
  done: () => boolean;
}

const STEPS: Step[] = [
  { label: 'Buy your first plane', panel: 'store', done: () => S().planes.length > 0 },
  { label: 'Hire 2 pilots + 1 attendant', panel: 'crew', done: () => S().staff.filter((x) => x.role === 'pilot').length >= 2 && S().staff.some((x) => x.role === 'attendant') },
  { label: 'Assign the crew to a plane', panel: 'fleet', done: () => S().staff.some((x) => x.planeId) },
  { label: 'Buy landing rights somewhere', panel: 'airports', done: () => S().owned.length > 1 },
  { label: 'Open a route', panel: 'routes', done: () => S().routes.length > 0 },
  { label: 'Put a plane on the route', panel: 'fleet', done: () => S().planes.some((p) => p.routeId) },
  { label: 'Unlock your first research', panel: 'research', done: () => S().research.length > 0 },
];

function hidden(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function mountChecklist(root: HTMLElement): void {
  const box = h('div.checklist');
  root.appendChild(box);

  const paint = () => {
    if (!game.s || hidden() || ui.tutorialActive) {
      box.style.display = 'none';
      return;
    }
    const doneCount = STEPS.filter((s) => s.done()).length;
    if (doneCount === STEPS.length) {
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    patchInto(box, h('div',
      h('div.checklist-head',
        h('b', 'Flight plan'),
        h('span.checklist-count', `${doneCount}/${STEPS.length}`),
        h('button.icon-btn', {
          title: 'Hide',
          onclick: () => {
            try {
              localStorage.setItem(KEY, '1');
            } catch {
              /* ignore */
            }
            paint();
          },
        }, iconEl('close', 14)),
      ),
      h('ol', STEPS.map((s) => h(`li${s.done() ? '.done' : ''}`, { onclick: () => bus.emit('openPanel', s.panel) }, h('span.check-box', s.done() ? iconEl('check', 12) : null), s.label))),
    ));
  };
  bus.on('change', paint);
  paint();
}
