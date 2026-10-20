import { AIRPORT_BY_CODE } from '../data/airports';
import { hubPicker } from './hubPicker';
import type { Airline } from '../game/types';
import { h } from './dom';

export const LIVERIES = ['#4fd1ff', '#ffb547', '#3ddc97', '#a78bfa', '#ff6b7d', '#e5e7eb', '#2f6fed', '#d4a648'];
const NAME_IDEAS = ['Meridian Air', 'Northwind Airways', 'Atlas Aviation', 'Horizon Pacific', 'Corsair International', 'Aurora Airlines', 'Sterling Air', 'Polaris Airways', 'Altair Air', 'Crescent Airlines'];
const SLOGANS = ['Connecting the world.', 'Your journey, our priority.', 'Fly further.', 'Every mile matters.', 'Above and beyond.', 'Wherever you are going.'];

function deriveCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z ]/g, '').split(' ').filter(Boolean);
  if (!words.length) return 'XX';
  if (words.length === 1) return words[0].slice(0, 2).padEnd(2, 'X');
  return (words[0][0] + words[1][0]).slice(0, 2);
}

/**
 * Title screen + "found your airline" form. Resolves with the new airline, or
 * null if the player went back to the save list (only offered when `canGoBack`).
 */
export function onboarding(root: HTMLElement, canGoBack = false): Promise<Airline | null> {
  return new Promise((resolve) => {
    let color = LIVERIES[0];
    let hub = 'ORD';
    let codeTouched = false;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

    const nameInput = h('input.text-input.big', { value: pick(NAME_IDEAS), maxlength: 28, placeholder: 'Airline name' }) as HTMLInputElement;
    const codeInput = h('input.text-input.code-input', { value: deriveCode(nameInput.value), maxlength: 2 }) as HTMLInputElement;
    const sloganInput = h('input.text-input', { value: pick(SLOGANS), maxlength: 40 }) as HTMLInputElement;
    const hubField = hubPicker({ value: hub, onChange: (code) => { hub = code; paint(); } });
    const preview = h('div.ticket-logo');
    const previewName = h('div.ticket-name');
    const previewHub = h('div.ticket-hub');

    const paint = () => {
      if (!codeTouched) codeInput.value = deriveCode(nameInput.value);
      preview.textContent = codeInput.value.toUpperCase() || 'XX';
      preview.style.background = color;
      previewName.textContent = nameInput.value || 'Your Airline';
      const a = AIRPORT_BY_CODE[hub];
      previewHub.textContent = `${a.code} · ${a.city}`;
      swatches.forEach((s) => s.classList.toggle('active', s.dataset.color === color));
      document.documentElement.style.setProperty('--livery', color);
    };

    nameInput.addEventListener('input', paint);
    codeInput.addEventListener('input', () => {
      codeTouched = true;
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
      paint();
    });

    const swatches = LIVERIES.map((c) =>
      h('button.swatch', { type: 'button', 'data-color': c, style: { background: c }, onclick: () => { color = c; paint(); } }),
    );

    const screen = h('div.onboard',
      h('div.onboard-inner',
        h('div.title-block',
          h('div.title-kicker', 'FLIGHT OPERATIONS CONSOLE'),
          h('h1.game-title', h('span', 'AIRLINE'), h('span', 'SIMULATOR')),
          h('p.title-sub', 'Found an airline, build a fleet and connect the world.'),
        ),
        h('form.ticket', {
          onsubmit: (e: Event) => {
            e.preventDefault();
            screen.classList.add('takeoff');
            setTimeout(() => {
              screen.remove();
              resolve({
                name: nameInput.value.trim() || 'Independent Air',
                code: (codeInput.value.toUpperCase() + 'XX').slice(0, 2),
                color,
                hub,
                slogan: sloganInput.value.trim(),
              });
            }, 700);
          },
        },
          h('div.ticket-main',
            h('div.ticket-label', 'NEW AIRLINE · PRE-FLIGHT SETUP'),
            h('label.field', h('span.field-label', 'Airline name'), nameInput),
            h('div.field-row',
              h('label.field', h('span.field-label', 'Code'), codeInput),
              h('label.field.grow', h('span.field-label', 'Slogan'), sloganInput),
            ),
            h('div.field', h('span.field-label', 'Home hub'), h('p.hint.hub-hint', 'Your headquarters: your first airport is free here. You can move it later in Settings.'), hubField),
            h('div.field', h('span.field-label', 'Livery colour'), h('div.swatches', swatches)),
          ),
          h('div.ticket-stub',
            preview,
            previewName,
            previewHub,
            h('button.btn.primary.big', { type: 'submit' }, 'Begin operations'),
            canGoBack
              ? h('button.btn.ghost.small', {
                  type: 'button',
                  onclick: () => {
                    screen.remove();
                    resolve(null);
                  },
                }, 'Back to save files')
              : null,
          ),
        ),
      ),
    );
    root.appendChild(screen);
    paint();
  });
}
