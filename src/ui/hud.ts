import { bus } from '../game/bus';
import { S, game, SPEEDS } from '../game/state';
import { h } from './dom';
import { clock, money } from './format';
import { sfx } from './sfx';
import { iconEl } from './icons';

/** Split-flap style text: each glyph sits on its own tile and flips when it changes. */
class Flap {
  el = h('div.flap');
  private chars: HTMLSpanElement[] = [];
  private lastFlip = new WeakMap<HTMLSpanElement, number>();

  set(text: string): void {
    while (this.chars.length < text.length) {
      const c = h('span.flap-char');
      this.chars.push(c);
      this.el.appendChild(c);
    }
    while (this.chars.length > text.length) this.chars.pop()!.remove();
    text.split('').forEach((ch, i) => {
      const span = this.chars[i];
      if (span.textContent !== ch) {
        span.textContent = ch;
        // fast-changing digits just update, so the counter never shows blank tiles
        const now = performance.now();
        if (now - (this.lastFlip.get(span) ?? 0) > 600) {
          span.classList.remove('flip');
          void span.offsetWidth; // restart animation
          span.classList.add('flip');
        }
        this.lastFlip.set(span, now);
      }
    });
  }
}

export function mountHud(root: HTMLElement): void {
  const cash = new Flap();
  const logo = h('div.logo-badge');
  const name = h('div.brand-name');
  const slogan = h('div.brand-slogan');
  const time = h('div.clock');
  const rep = h('div.gauge-fill');
  const repVal = h('span.gauge-val');
  const joy = h('div.gauge-fill');
  const joyVal = h('span.gauge-val');
  const rp = h('span.chip-val');
  const fuel = h('span.chip-val');
  const fleet = h('span.chip-val');

  const speedBtns = SPEEDS.map((sp, i) =>
    h('button.speed-btn', {
      title: sp === 0 ? 'Pause (space)' : `${sp}× speed (${i})`,
      onclick: () => setSpeed(sp),
    }, sp === 0 ? iconEl('pause', 12) : `${sp}×`),
  );

  function setSpeed(sp: number): void {
    game.speed = sp;
    sfx.click();
    bus.emit('speed', sp);
  }

  const hud = h('header.hud',
    h('div.brand', { onclick: () => bus.emit('openPanel', 'settings'), title: 'Edit airline profile' }, logo, h('div', name, slogan)),
    h('div.hud-cash', h('div.hud-label', 'Cash'), cash.el),
    h('div.hud-gauges',
      h('div.gauge', { title: 'Reputation: drives demand. Earned by happy passengers, lost by incidents.' },
        h('span.gauge-label', 'REP'), h('div.gauge-track', rep), repVal),
      h('div.gauge', { title: 'Passenger happiness, averaged over recent flights.' },
        h('span.gauge-label', 'SAT'), h('div.gauge-track', joy), joyVal),
    ),
    h('div.hud-chips',
      h('button.chip', { title: 'Research points', onclick: () => bus.emit('openPanel', 'research') }, iconEl('rp', 15), h('span.chip-key', 'RP'), rp),
      h('div.chip', { title: 'Fuel price per litre' }, iconEl('fuel', 15), h('span.chip-key', 'FUEL'), fuel),
      h('button.chip', { title: 'Planes in the air / fleet size', onclick: () => bus.emit('openPanel', 'fleet') }, iconEl('fleet', 15), h('span.chip-key', 'AIRBORNE'), fleet),
    ),
    h('div.hud-time', time, h('div.speed-row', speedBtns)),
  );
  root.appendChild(hud);

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setSpeed(game.speed === 0 ? 1 : 0);
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 0 && n < SPEEDS.length && e.key !== ' ') setSpeed(SPEEDS[n]);
  });

  function update(): void {
    if (!game.s) return;
    const s = S();
    logo.textContent = s.airline.code;
    logo.style.background = s.airline.color;
    name.textContent = s.airline.name;
    slogan.textContent = s.airline.slogan;
    cash.set(money(s.money));
    cash.el.classList.toggle('negative', s.money < 0);
    time.textContent = clock(s.time);
    rep.style.width = `${s.reputation}%`;
    repVal.textContent = s.reputation.toFixed(0);
    joy.style.width = `${s.satisfaction}%`;
    joyVal.textContent = s.satisfaction.toFixed(0);
    rp.textContent = Math.floor(s.rp).toString();
    fuel.textContent = `$${s.fuelPrice.toFixed(2)}`;
    fleet.textContent = `${s.planes.filter((p) => p.status === 'flying').length}/${s.planes.length}`;
    speedBtns.forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === game.speed));
    hud.classList.toggle('paused', game.speed === 0);
  }

  let acc = 0;
  bus.on('tick', () => {
    // the flap animation looks best at ~6 updates per second
    const now = performance.now();
    if (now - acc > 160) {
      acc = now;
      update();
    }
  });
  bus.on('change', update);
  bus.on('speed', update);
  update();
}
