import { bus } from '../game/bus';
import { h } from './dom';
import { sfx } from './sfx';

const ICON: Record<string, string> = { good: '✔', bad: '✖', info: 'ℹ', money: '$', research: '⚗' };

export function mountToasts(root: HTMLElement): void {
  const tray = h('div.toast-tray');
  root.appendChild(tray);

  bus.on('toast', ({ msg, kind }) => {
    const el = h(`div.toast.toast-${kind}`, h('span.toast-icon', ICON[kind]), h('span', msg));
    tray.prepend(el);
    ({ good: sfx.good, bad: sfx.bad, money: sfx.cash, research: sfx.research, info: sfx.click })[kind]();
    while (tray.children.length > 4) tray.lastElementChild?.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4700);
  });
}

/** Show the result of an action — failures become a red toast. */
export function report(result: { ok: boolean; why?: string }): boolean {
  if (!result.ok) bus.emit('toast', { msg: result.why ?? 'Action not available.', kind: 'bad' });
  return result.ok;
}
