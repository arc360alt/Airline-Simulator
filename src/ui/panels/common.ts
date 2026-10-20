import { h } from '../dom';
import { ui } from '../uiState';
import { report } from '../toast';
import { bus } from '../../game/bus';
import { iconEl } from '../icons';

/** Ask the shell to redraw the open panel. */
export const refreshPanel = () => bus.emit('change');

type Res = { ok: boolean; why?: string };

/** Run an action and show a toast if it failed. */
export function act(fn: () => Res): () => void {
  return () => {
    report(fn());
    refreshPanel();
  };
}

export function tabs(panelId: string, options: { id: string; label: string; badge?: string | number }[], fallback = options[0].id): [string, HTMLElement] {
  const current = ui.tabs[panelId] ?? fallback;
  const el = h('div.tabs',
    options.map((o) =>
      h(`button.tab${o.id === current ? '.active' : ''}`, {
        onclick: () => {
          ui.tabs[panelId] = o.id;
          refreshPanel();
        },
      }, o.label, o.badge !== undefined && o.badge !== '' ? h('span.tab-badge', String(o.badge)) : null),
    ),
  );
  return [current, el];
}

export function empty(icon: string, title: string, hint: string): HTMLElement {
  return h('div.empty', h('div.empty-icon', iconEl(icon, 40)), h('div.empty-title', title), h('div.empty-hint', hint));
}

export function stat(label: string, value: string | Node, cls = ''): HTMLElement {
  return h(`div.stat${cls ? `.${cls}` : ''}`, h('span.stat-label', label), h('span.stat-value', value));
}

export function section(title: string, ...children: (Node | null | false)[]): HTMLElement {
  return h('section.section', h('h3.section-title', title), ...children);
}

export function bar(value: number, max: number, color: string): HTMLElement {
  return h('div.statbar', h('div.statbar-fill', { style: { width: `${Math.min(100, (value / max) * 100)}%`, background: color } }));
}

export function avatar(name: string, color: string, role: string): HTMLElement {
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2);
  return h('div.avatar', { style: { '--avatar': color } as any }, initials, h('span.avatar-role', role === 'pilot' ? 'CPT' : 'FA'));
}
