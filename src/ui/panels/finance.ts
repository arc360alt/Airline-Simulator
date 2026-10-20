import { S } from '../../game/state';
import type { DayLedger } from '../../game/types';
import { dailySalaries, parkingFees } from '../../game/economy';
import { h } from '../dom';
import { clock, money } from '../format';
import { section, stat } from './common';
import type { Panel } from './types';

export const financePanel: Panel = {
  id: 'finance', title: 'Company Books', short: 'Books', icon: 'finance', color: '#06d6a0', key: 'L',
  render,
};

function chart(days: DayLedger[]): HTMLCanvasElement {
  const canvas = h('canvas.chart') as HTMLCanvasElement;
  const W = 460;
  const H = 180;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  // draw immediately so the canvas is complete when it is swapped into the page
  {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--text').trim();
    const good = css.getPropertyValue('--good').trim();
    const bad = css.getPropertyValue('--bad').trim();
    const muted = css.getPropertyValue('--muted').trim();
    const max = Math.max(1, ...days.flatMap((d) => [d.revenue, d.expenses]));
    const pad = { l: 8, r: 8, t: 12, b: 22 };
    const slot = (W - pad.l - pad.r) / Math.max(1, days.length);
    const bw = Math.max(3, slot * 0.36);
    const yOf = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);

    ctx.strokeStyle = muted;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([4, 4]);
    for (let i = 1; i <= 3; i++) {
      const y = yOf((max * i) / 3);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    days.forEach((d, i) => {
      const x = pad.l + i * slot + slot / 2;
      const draw = (v: number, color: string, dx: number) => {
        const y = yOf(v);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect(x + dx, y, bw, H - pad.b - y, [2, 2, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      draw(d.revenue, good, -bw - 1);
      draw(d.expenses, bad, 1);
      if (days.length <= 16 || i % 2 === 0) {
        ctx.fillStyle = muted;
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`D${d.day}`, x, H - 6);
      }
    });

    // profit line
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    days.forEach((d, i) => {
      const x = pad.l + i * slot + slot / 2;
      const y = yOf(Math.max(0, d.revenue - d.expenses));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  return canvas;
}

function render(): HTMLElement {
  const s = S();
  const days = [...s.ledger.slice(-13), s.today];
  const last7 = s.ledger.slice(-7);
  const weekProfit = last7.reduce((a, d) => a + d.revenue - d.expenses, 0);
  const fleetValue = s.planes.length;

  return h('div',
    h('div.summary-strip',
      stat('Cash', money(s.money), s.money < 0 ? 'warn' : ''),
      stat('Today', money(s.today.revenue - s.today.expenses), s.today.revenue - s.today.expenses < 0 ? 'warn' : ''),
      stat('Last 7 days', money(weekProfit), weekProfit < 0 ? 'warn' : ''),
    ),
    h('div.card.chart-card',
      h('div.chart-legend', h('span.lg.good', 'Revenue'), h('span.lg.bad', 'Expenses'), h('span.lg.ink', 'Profit')),
      chart(days),
    ),
    section('Daily overheads',
      h('div.kv', h('span', 'Crew wages'), h('b', money(dailySalaries()))),
      h('div.kv', h('span', 'Airport upkeep'), h('b', money(parkingFees()))),
      h('div.kv', h('span', 'Fuel price'), h('b', `$${s.fuelPrice.toFixed(2)} / L`)),
    ),
    section('All-time',
      h('div.stat-grid',
        stat('Passengers', s.stats.pax.toLocaleString()),
        stat('Flights', s.stats.flights.toLocaleString()),
        stat('Revenue', money(s.stats.revenue)),
        stat('Incidents', String(s.stats.incidents)),
        stat('Crashes', String(s.stats.crashes), s.stats.crashes ? 'warn' : ''),
        stat('Fleet', `${fleetValue} planes`),
      ),
    ),
    section('Logbook',
      h('div.logbook',
        s.log.slice(0, 40).map((l) => h(`div.log-line.k-${l.kind}`, h('span.log-time', clock(l.t).replace('DAY ', 'D')), h('span', l.msg))),
      ),
    ),
  );
}
