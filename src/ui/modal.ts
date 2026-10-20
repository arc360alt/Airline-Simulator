import { h } from './dom';
import { settings } from '../game/state';
import { money } from './format';

export function openModal(content: HTMLElement, opts: { dismissable?: boolean; wide?: boolean; onClose?: () => void } = {}): () => void {
  const backdrop = h('div.modal-backdrop');
  const card = h(`div.modal${opts.wide ? '.wide' : ''}`, content);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    opts.onClose?.();
    backdrop.classList.add('out');
    setTimeout(() => backdrop.remove(), 200);
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.dismissable !== false) close();
  };
  if (opts.dismissable !== false) {
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
    window.addEventListener('keydown', onKey);
  }
  return close;
}

export function confirmModal(title: string, body: string, yes = 'Confirm', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let close = () => {};
    const finish = (v: boolean) => {
      close();
      resolve(v);
    };
    close = openModal(
      h('div.confirm',
        h('h2.modal-title', title),
        h('p', body),
        h('div.row.end',
          h('button.btn.ghost', { onclick: () => finish(false) }, 'Cancel'),
          h(`button.btn${danger ? '.danger' : '.primary'}`, { onclick: () => finish(true) }, yes),
        ),
      ),
    );
  });
}

/** Ask before spending more than 25% of the bank, if the setting is on. */
export async function confirmSpend(amount: number, cash: number, what: string): Promise<boolean> {
  if (!settings.confirmBig || amount < cash * 0.25) return true;
  return confirmModal('Confirm purchase', `${what} costs ${money(amount)} — that is ${Math.round((amount / Math.max(1, cash)) * 100)}% of your cash.`, 'Purchase');
}
