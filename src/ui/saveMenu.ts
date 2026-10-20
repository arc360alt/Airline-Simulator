import { AIRPORT_BY_CODE } from '../data/airports';
import { MAX_SLOTS, deleteSlot, listSaves, type SaveMeta } from '../game/state';
import { h } from './dom';
import { money } from './format';
import { confirmModal } from './modal';

export type SaveChoice = { kind: 'load'; id: string } | { kind: 'new' };

function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Title screen listing every saved airline. Resolves with the player's choice. */
export function saveMenu(root: HTMLElement): Promise<SaveChoice> {
  return new Promise((resolve) => {
    const list = h('div.save-list');
    const newBtn = h('button.btn.primary.big', { onclick: () => finish({ kind: 'new' }) }, 'New airline');
    const capNote = h('p.hint.save-cap');

    const finish = (choice: SaveChoice) => {
      screen.classList.add('takeoff');
      setTimeout(() => {
        screen.remove();
        resolve(choice);
      }, 500);
    };

    const card = (m: SaveMeta, first: boolean) =>
      h(`div.save-card${first ? '.latest' : ''}`, {
        role: 'button',
        tabindex: 0,
        onclick: () => finish({ kind: 'load', id: m.id }),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') finish({ kind: 'load', id: m.id });
        },
      },
        h('div.save-logo', { style: { background: m.color } }, m.code),
        h('div.save-main',
          h('div.save-name', m.name, first ? h('span.tag', 'LAST PLAYED') : null),
          h('div.save-meta', `Hub ${m.hub} · ${AIRPORT_BY_CODE[m.hub]?.city ?? ''}`),
          h('div.save-meta', `Day ${m.day} · ${money(m.money)} · ${m.planes} plane${m.planes === 1 ? '' : 's'} · ${ago(m.updatedAt)}`),
        ),
        h('div.save-actions',
          h('button.btn.small.primary', { onclick: (e: Event) => { e.stopPropagation(); finish({ kind: 'load', id: m.id }); } }, first ? 'Continue' : 'Load'),
          h('button.btn.small.danger', {
            title: 'Delete this save',
            onclick: async (e: Event) => {
              e.stopPropagation();
              if (await confirmModal(`Delete ${m.name}?`, 'This save file will be permanently deleted. This cannot be undone.', 'Delete', true)) {
                deleteSlot(m.id);
                paint();
              }
            },
          }, 'Delete'),
        ),
      );

    const paint = () => {
      const saves = listSaves();
      if (!saves.length) {
        // nothing left to pick: go straight to founding a new airline
        finish({ kind: 'new' });
        return;
      }
      list.replaceChildren(...saves.map((m, i) => card(m, i === 0)));
      const full = saves.length >= MAX_SLOTS;
      (newBtn as HTMLButtonElement).disabled = full;
      capNote.textContent = full
        ? `You have ${MAX_SLOTS} save files, the maximum. Delete one to start another airline.`
        : `${saves.length} of ${MAX_SLOTS} save files used.`;
    };

    const screen = h('div.onboard',
      h('div.onboard-inner.save-inner',
        h('div.title-block',
          h('div.title-kicker', 'FLIGHT OPERATIONS CONSOLE'),
          h('h1.game-title', h('span', 'AIRLINE'), h('span', 'SIMULATOR')),
          h('p.title-sub', 'Choose an airline to continue, or found a new one.'),
        ),
        h('div.save-panel',
          h('div.ticket-label', 'SAVE FILES'),
          list,
          h('div.save-foot', capNote, newBtn),
        ),
      ),
    );
    root.appendChild(screen);
    paint();
  });
}
