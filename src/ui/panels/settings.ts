import { S, currentSlot, deleteSlot, exportSave, game, importSave, MAX_SLOTS, listSaves, rebootTo, saveGame, settings, updateSettings } from '../../game/state';
import { bus } from '../../game/bus';
import type { Settings } from '../../game/types';
import { h } from '../dom';
import { HUB_MOVE_FEE, hubMoveCost, relocateHub, updateAirline } from '../../game/actions';
import { AIRPORT_BY_CODE } from '../../data/airports';
import { hubPicker } from '../hubPicker';
import { money } from '../format';
import { LIVERIES } from '../onboarding';
import { ACCENTS, resolvedTheme } from '../theme';
import type { Accent } from '../../game/types';
import { report } from '../toast';
import { confirmModal, confirmSpend, openModal } from '../modal';
import { refreshPanel, section } from './common';
import type { Panel } from './types';

export const settingsPanel: Panel = {
  id: 'settings', title: 'Settings', short: 'Settings', icon: 'settings', color: '#8d99ae', key: 'O',
  render,
};

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function toggle(key: BoolKey, label: string, hint: string): HTMLElement {
  return h('label.toggle-row',
    h('div', h('b', label), h('div.hint', hint)),
    h('span.switch',
      h('input', { type: 'checkbox', checked: settings[key], onchange: (e: Event) => updateSettings({ [key]: (e.target as HTMLInputElement).checked }) }),
      h('span.switch-knob'),
    ),
  );
}

function segmented<K extends keyof Settings>(key: K, options: { value: Settings[K]; label: string }[]): HTMLElement {
  return h('div.segmented',
    options.map((o) =>
      h(`button${settings[key] === o.value ? '.active' : ''}`, {
        onclick: () => {
          updateSettings({ [key]: o.value } as Partial<Settings>);
          bus.emit('change');
        },
      }, o.label),
    ),
  );
}

function render(): HTMLElement {
  return h('div.settings',
    airlineSection(),
    section('Look & feel',
      h('div.setting', h('b', 'Theme'), segmented('theme', [
        { value: 'light', label: 'Day' },
        { value: 'dark', label: 'Night' },
        { value: 'system', label: 'Auto' },
      ])),
      accentPicker(),
      h('div.setting', h('b', 'Globe quality'), segmented('quality', [
        { value: 'low', label: 'Speedy' },
        { value: 'high', label: 'Pretty' },
      ])),
      h('div.setting', h('b', 'Distance units'), segmented('units', [
        { value: 'km', label: 'Kilometres' },
        { value: 'mi', label: 'Miles' },
      ])),
    ),
    section('Globe',
      toggle('autoRotate', 'Spin the globe', 'Slowly rotate the Earth when you are not dragging it.'),
      toggle('showArcs', 'Route arcs', 'Draw animated flight paths for every route.'),
      toggle('showAllAirports', 'All airports', 'Show airports you do not own yet as small dots.'),
      toggle('showLabels', 'Airport labels', 'Show codes above your airports.'),
    ),
    section('Sound',
      toggle('sound', 'Sound effects', 'Chirpy bleeps for purchases, research and trouble.'),
      h('label.setting', h('b', 'Volume'),
        h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.volume, oninput: (e: Event) => updateSettings({ volume: Number((e.target as HTMLInputElement).value) }) }),
      ),
    ),
    section('Gameplay',
      toggle('confirmBig', 'Confirm big purchases', 'Ask before spending more than a quarter of your cash.'),
      toggle('pauseOnCrash', 'Pause on crash', 'Stop the clock when a plane goes down.'),
      toggle('ticker', 'News ticker', 'Show the scrolling departures board at the bottom.'),
      h('div.setting',
        h('div', h('b', 'Tutorial'), h('div.hint', 'Walk through the basics again, step by step.')),
        h('button.btn', { onclick: () => bus.emit('tutorial') }, 'Replay tutorial'),
      ),
    ),
    section('Save files',
      h('p.hint', `Each airline has its own save file (${listSaves().length} of ${MAX_SLOTS} used). The game autosaves every 10 seconds.`),
      h('div.row.wrap',
        h('button.btn', { onclick: () => { if (saveGame()) bus.emit('toast', { msg: 'Game saved.', kind: 'good' }); } }, 'Save now'),
        h('button.btn', { onclick: () => rebootTo({ kind: 'picker' }) }, 'Switch airline'),
        h('button.btn', {
          disabled: listSaves().length >= MAX_SLOTS,
          title: listSaves().length >= MAX_SLOTS ? 'All save files are in use: delete one first' : 'Found another airline in a new save file',
          onclick: () => rebootTo({ kind: 'new' }),
        }, 'New airline'),
      ),
      h('div.row.wrap', { style: { marginTop: '8px' } },
        h('button.btn', { onclick: showExport }, 'Export'),
        h('button.btn', { onclick: showImport }, 'Import'),
        h('button.btn.danger', {
          onclick: async () => {
            if (await confirmModal(`Delete ${S().airline.name}?`, 'This airline\u2019s save file will be permanently deleted. Your other save files are not affected.', 'Delete airline', true)) {
              const id = currentSlot();
              if (id) deleteSlot(id);
              game.s = null;
              rebootTo({ kind: 'picker' });
            }
          },
        }, 'Delete this airline'),
      ),
    ),
    section('Shortcuts',
      h('div.shortcuts',
        ['Space · pause', '1–4 · speed', 'F · fleet', 'B · store', 'C · crew', 'R · routes', 'A · airports', 'S · service', 'T · research', 'L · books', 'O · settings', 'Esc · close']
          .map((k) => h('span.kbd', k)),
      ),
    ),
  );
}

/** Unsaved profile edits; kept outside render() so the panel's periodic redraw doesn't wipe them. */
let draft: { name: string; code: string; slogan: string; color: string } | null = null;

/** Rename the airline, its code, slogan or livery at any time. */
function airlineSection(): HTMLElement {
  const a = S().airline;
  const d = (draft ??= { name: a.name, code: a.code, slogan: a.slogan, color: a.color });
  const name = h('input.text-input', { value: d.name, maxlength: 28, oninput: () => (d.name = name.value) }) as HTMLInputElement;
  const code = h('input.text-input.code-input', {
    value: d.code,
    maxlength: 2,
    oninput: () => (d.code = code.value = code.value.toUpperCase().replace(/[^A-Z]/g, '')),
  }) as HTMLInputElement;
  const slogan = h('input.text-input', { value: d.slogan, maxlength: 40, placeholder: 'Optional', oninput: () => (d.slogan = slogan.value) }) as HTMLInputElement;
  const swatches = LIVERIES.map((c) =>
    h(`button.swatch${c === d.color ? '.active' : ''}`, {
      type: 'button',
      style: { background: c },
      onclick: (e: Event) => {
        d.color = c;
        swatches.forEach((s) => s.classList.toggle('active', s === e.currentTarget));
      },
    }),
  );
  return section('Airline profile',
    h('form', {
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (report(updateAirline(d))) draft = null;
        (document.activeElement as HTMLElement | null)?.blur();
      },
    },
      h('label.field', h('span.field-label', 'Airline name'), name),
      h('div.field-row',
        h('label.field', h('span.field-label', 'Code'), code),
        h('label.field.grow', h('span.field-label', 'Slogan'), slogan),
      ),
      h('div.field', h('span.field-label', 'Livery colour'), h('div.swatches', swatches)),
      h('div.row.end',
        h('button.btn.ghost', { type: 'button', onclick: () => { draft = null; refreshPanel(); } }, 'Reset'),
        h('button.btn.primary', { type: 'submit' }, 'Save profile'),
      ),
    ),
    hubSection(),
  );
}

/** The airport the player has picked to move to (kept across panel redraws). */
let hubDraft: string | null = null;

function hubSection(): HTMLElement {
  const s = S();
  const current = s.airline.hub;
  const target = hubDraft && hubDraft !== current ? hubDraft : null;
  const cost = target ? hubMoveCost(target) : 0;
  return h('div.hub-move',
    h('div.field-label', 'Home hub'),
    h('p.hint', `Currently ${AIRPORT_BY_CODE[current].city} (${current}). Moving costs a ${money(HUB_MOVE_FEE)} fee, plus landing rights if you don\u2019t own the new airport. Your old hub stays yours as a normal airport, so routes keep flying.`),
    hubPicker({
      value: hubDraft ?? current,
      note: (code) => (code === current ? 'current hub' : money(hubMoveCost(code))),
      onChange: (code) => {
        hubDraft = code;
        refreshPanel();
      },
    }),
    h('div.row.end',
      h('button.btn.primary', {
        disabled: !target || s.money < cost,
        onclick: async () => {
          if (!target) return;
          if (!(await confirmSpend(cost, s.money, `Moving your hub to ${AIRPORT_BY_CODE[target].city}`))) return;
          if (report(relocateHub(target))) hubDraft = null;
        },
      }, target ? `Move hub to ${target} · ${money(cost)}` : 'Pick a new hub above'),
    ),
  );
}

/** Colour theme swatches; each works in both day and night mode. */
function accentPicker(): HTMLElement {
  const dark = resolvedTheme() === 'dark';
  return h('div.setting.accent-setting',
    h('div', h('b', 'Colour theme'), h('div.hint', 'Works with both day and night mode.')),
    h('div.accent-swatches',
      (Object.keys(ACCENTS) as Accent[]).map((id) =>
        h(`button.accent-swatch${settings.accent === id ? '.active' : ''}`, {
          type: 'button',
          title: ACCENTS[id].name,
          'aria-label': `${ACCENTS[id].name} theme`,
          'aria-pressed': settings.accent === id ? 'true' : 'false',
          style: { '--swatch': dark ? ACCENTS[id].dark : ACCENTS[id].light } as any,
          onclick: () => {
            updateSettings({ accent: id });
            bus.emit('change');
          },
        }, h('span.accent-dot'), h('span.accent-name', ACCENTS[id].name)),
      ),
    ),
  );
}

function showExport(): void {
  const code = exportSave();
  const area = h('textarea.text-input.code', { readonly: true }, code) as HTMLTextAreaElement;
  const close = openModal(h('div.confirm',
    h('h2.modal-title', 'Your save code'),
    h('p', 'Copy this somewhere safe. Paste it into Import to restore your airline on any browser.'),
    area,
    h('div.row.end',
      h('button.btn', { onclick: () => { void navigator.clipboard?.writeText(code); bus.emit('toast', { msg: 'Copied to clipboard.', kind: 'good' }); } }, 'Copy'),
      h('button.btn.primary', { onclick: () => close() }, 'Done'),
    ),
  ));
  setTimeout(() => area.select(), 50);
}

function showImport(): void {
  const area = h('textarea.text-input.code', { placeholder: 'Paste save code…' }) as HTMLTextAreaElement;
  const close = openModal(h('div.confirm',
    h('h2.modal-title', 'Import a save'),
    h('p', 'The imported airline is added as a new save file; your current airlines are not touched.'),
    area,
    h('div.row.end',
      h('button.btn.ghost', { onclick: () => close() }, 'Cancel'),
      h('button.btn.primary', {
        onclick: () => {
          const id = importSave(area.value);
          if (id) rebootTo({ kind: 'load', id });
          else bus.emit('toast', { msg: 'That code did not work.', kind: 'bad' });
        },
      }, 'Load'),
    ),
  ));
}
