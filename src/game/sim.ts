import { MODEL_BY_ID, PLANE_MODELS } from '../data/planes';
import { AIRPORT_BY_CODE } from '../data/airports';
import { randomAvatarColor, randomName, randomTrait } from '../data/names';
import type { Plane, Staff, Role, Incident } from './types';
import { bus } from './bus';
import { S, game, day, log, uid, MIN_PER_DAY, MINUTES_PER_SECOND, saveGame, settings } from './state';
import {
  crashShare, crewFor, crewReady, dailySalaries, estimateLeg, incidentRisk, mods, parkingFees, planeJoy,
  repairCost, repairMinutes, salaryFor, turnaroundMinutes, xpForNext,
} from './economy';
import { greatCircle } from './geo';
import { money } from '../ui/format';

const MAX_STEP = 5;
let autosaveTimer = 0;

export function tick(realDt: number): void {
  if (!game.s) return;
  const total = realDt * game.speed * MINUTES_PER_SECOND;
  let remaining = total;
  while (remaining > 0) {
    const step = Math.min(MAX_STEP, remaining);
    remaining -= step;
    advance(step);
    if (game.speed === 0) break; // a crash may auto-pause mid-tick
  }
  autosaveTimer += realDt;
  if (autosaveTimer > 10) {
    autosaveTimer = 0;
    saveGame();
  }
  bus.emit('tick', total);
}

function advance(minutes: number): void {
  const s = S();
  const before = day(s.time);
  s.time += minutes;
  if (day(s.time) !== before) newDay();

  for (const st of s.staff) {
    if (st.status !== 'ready' && s.time >= st.until) finishStaffStatus(st);
  }
  // iterate over a copy: crashes remove planes
  for (const plane of [...s.planes]) updatePlane(plane);
}

function finishStaffStatus(st: Staff): void {
  if (st.status === 'training') {
    st.level = Math.min(10, st.level + 1);
    st.xp = 0;
    log(`${st.name} completed training and is now level ${st.level}.`, 'good', true);
  } else if (st.status === 'injured') {
    log(`${st.name} has recovered and is back on duty.`, 'info');
  }
  st.status = 'ready';
  bus.emit('change');
}

function updatePlane(p: Plane): void {
  const s = S();
  switch (p.status) {
    case 'repair':
      if (s.time >= p.statusUntil) {
        p.condition = 100;
        p.status = 'idle';
        log(`${p.tail} "${p.nickname}" has completed maintenance and is back in service.`, 'good');
        bus.emit('change');
      }
      return;

    case 'idle': {
      if (s.autoRepairAt > 0 && p.condition < s.autoRepairAt) {
        if (startRepair(p, true)) return;
      }
      const route = s.routes.find((r) => r.id === p.routeId);
      if (!route) {
        p.hold = 'No route assigned';
        return;
      }
      const crew = crewReady(p);
      if (!crew.ok) {
        p.hold = crew.why;
        return;
      }
      if (p.condition <= 5) {
        p.hold = 'Too damaged to fly';
        return;
      }
      p.hold = '';
      p.status = 'boarding';
      p.statusUntil = s.time + turnaroundMinutes(p);
      return;
    }

    case 'boarding':
      if (s.time >= p.statusUntil) depart(p);
      return;

    case 'flying': {
      const leg = p.leg!;
      const progress = (s.time - leg.depart) / (leg.arrive - leg.depart);
      if (leg.incident && !leg.incidentDone && progress >= leg.incidentAt) {
        leg.incidentDone = true;
        if (leg.incident === 'crash') return crash(p, leg.incidentAt);
        if (leg.incident === 'emergency') {
          log(`${p.tail} declared an emergency over ${regionName(leg.from, leg.to)}. The crew is handling it.`, 'bad', true);
        }
      }
      if (s.time >= leg.arrive) arrive(p);
      return;
    }
  }
}

function regionName(from: string, to: string): string {
  return `the ${AIRPORT_BY_CODE[from].city}–${AIRPORT_BY_CODE[to].city} corridor`;
}

function depart(p: Plane): void {
  const s = S();
  const route = s.routes.find((r) => r.id === p.routeId);
  if (!route) {
    p.status = 'idle';
    return;
  }
  // planes shuttle back and forth between the route's two airports
  const from = p.location === route.to ? route.to : route.from;
  const to = from === route.from ? route.to : route.from;
  const dirRoute = { ...route, from, to };
  const est = estimateLeg(dirRoute, p);

  const risk = incidentRisk(p);
  let incident: Incident | null = null;
  if (Math.random() < risk) {
    const r = Math.random();
    const crashP = crashShare(p);
    incident = r < crashP ? 'crash' : r < crashP + 0.35 ? 'emergency' : 'minor';
  }

  p.leg = {
    from, to,
    depart: s.time,
    arrive: s.time + est.minutes,
    distance: est.distance,
    pax: est.pax,
    revenue: est.revenue,
    cost: est.cost,
    joy: 0,
    incident,
    incidentAt: 0.25 + Math.random() * 0.5,
    incidentDone: false,
  };
  p.status = 'flying';
  p.location = from;
  spend(est.cost);
}

function arrive(p: Plane): void {
  const s = S();
  const leg = p.leg!;
  const model = MODEL_BY_ID[p.modelId];
  const m = mods();
  const route = s.routes.find((r) => r.id === p.routeId);

  let revenue = leg.revenue;
  let joy = estimateJoy(p);
  let wear = (0.7 + leg.distance / 4500) * model.wear * m.wear * (0.7 + Math.random() * 0.6);

  if (leg.incident === 'emergency') {
    revenue *= 0.55; // refunds & vouchers
    joy -= 25;
    wear += 18;
    s.reputation -= 3;
    s.stats.incidents++;
  } else if (leg.incident === 'minor') {
    joy -= 8;
    wear += 6;
    s.reputation -= 0.4;
    s.stats.incidents++;
    log(`${p.tail} had a minor ${pickFault()} on the way to ${leg.to}.`, 'bad');
  }

  earn(revenue);
  p.profit += revenue - leg.cost;
  if (route) {
    route.flights++;
    route.profit += revenue - leg.cost;
  }
  p.condition = Math.max(0, p.condition - wear);
  p.flights++;
  p.location = leg.to;
  p.status = 'idle';
  p.leg = null;

  s.stats.flights++;
  s.stats.pax += leg.pax;
  s.today.pax += leg.pax;
  s.satisfaction = s.satisfaction * 0.94 + joy * 0.06;
  s.reputation += ((joy - 50) / 260) * (joy > 50 ? m.repGain : 1);
  s.reputation = Math.max(0, Math.min(100, s.reputation));
  s.rp += (0.25 + leg.distance / 3500) * m.rpMult;

  const hours = (leg.arrive - leg.depart) / 60;
  for (const st of [...crewFor(p.id).pilots, ...crewFor(p.id).attendants]) {
    st.flights++;
    st.xp += 0.6 + hours * 0.6;
    if (st.level < 10 && st.xp >= xpForNext(st.level)) {
      st.xp -= xpForNext(st.level);
      st.level++;
      log(`${st.name} reached level ${st.level}.`, 'good');
    }
  }
}

function estimateJoy(p: Plane): number {
  // planeJoy covers service & crew; add a little flight-to-flight luck
  return Math.max(0, Math.min(100, planeJoy(p) + (Math.random() - 0.5) * 8));
}

function pickFault(): string {
  const faults = ['hydraulic hiccup', 'sticky landing gear', 'grumpy engine', 'cracked windshield', 'avionics glitch', 'bird strike'];
  return faults[Math.floor(Math.random() * faults.length)];
}

function crash(p: Plane, at: number): void {
  const s = S();
  const leg = p.leg!;
  const pos = greatCircle(leg.from, leg.to, at);
  const model = MODEL_BY_ID[p.modelId];
  const payout = Math.round(model.price * 0.3);
  s.planes = s.planes.filter((x) => x !== p);
  s.stats.crashes++;
  s.stats.incidents++;
  s.reputation = Math.max(0, s.reputation - 14);
  earn(payout);
  for (const st of s.staff.filter((x) => x.planeId === p.id)) {
    st.planeId = null;
    st.status = 'injured';
    st.until = s.time + MIN_PER_DAY * 3;
  }
  log(
    `${p.tail} "${p.nickname}" went down near ${regionName(leg.from, leg.to)}. All passengers and crew evacuated safely, but the aircraft is a write-off. Insurance paid ${money(payout)}.`,
    'bad',
    true,
  );
  bus.emit('crash', { planeId: p.id, lat: pos.lat, lon: pos.lon });
  if (settings.pauseOnCrash) {
    game.speed = 0;
    bus.emit('speed', 0);
  }
  bus.emit('change');
}

export function startRepair(p: Plane, auto = false): boolean {
  const s = S();
  if (p.status !== 'idle' && p.status !== 'boarding') return false;
  const cost = repairCost(p);
  if (s.money < cost) {
    if (!auto) bus.emit('toast', { msg: 'Not enough cash for repairs.', kind: 'bad' });
    return false;
  }
  spend(cost);
  p.status = 'repair';
  p.statusUntil = s.time + repairMinutes(p);
  log(`${auto ? 'Auto-repair: ' : ''}${p.tail} went into the hangar for ${money(cost)}.`, 'money');
  bus.emit('change');
  return true;
}

export function earn(n: number): void {
  const s = S();
  s.money += n;
  s.today.revenue += n;
  s.stats.revenue += n;
}

export function spend(n: number): void {
  const s = S();
  s.money -= n;
  s.today.expenses += n;
}

function newDay(): void {
  const s = S();
  const d = day(s.time);
  const wages = dailySalaries();
  const parking = parkingFees();
  spend(wages + parking);
  s.ledger.push({ ...s.today });
  if (s.ledger.length > 60) s.ledger.shift();
  log(`Day ${d} — paid ${money(wages)} wages and ${money(parking)} airport upkeep. Yesterday's profit: ${money(s.today.revenue - s.today.expenses)}.`, 'money');
  s.today = { day: d, revenue: 0, expenses: 0, pax: 0 };

  // planes age a year every month of game time
  for (const p of s.planes) p.age += 1 / 30;

  // fuel price wanders around
  const drift = (Math.random() - 0.5) * 0.08 + (0.85 - s.fuelPrice) * 0.05;
  s.fuelPrice = Math.max(0.45, Math.min(1.6, s.fuelPrice + drift));
  if (Math.random() < 0.05) {
    const spike = Math.random() < 0.5;
    s.fuelPrice = Math.max(0.45, Math.min(1.6, s.fuelPrice * (spike ? 1.3 : 0.75)));
    log(spike ? 'Oil supply shock: fuel prices up 30%.' : 'Oversupply: fuel prices down 25%.', spike ? 'bad' : 'good', true);
  }

  if (d - s.lastMarketDay >= 2) refreshMarket();
  if (d - s.lastCandidatesDay >= 1) refreshCandidates();

  if (s.money < 0) {
    log('Cash is negative. The bank charges 0.5% daily interest on debt.', 'bad', true);
    spend(Math.abs(s.money) * 0.005);
  }
  bus.emit('change');
}

export function refreshMarket(): void {
  const s = S();
  s.lastMarketDay = day();
  const available = PLANE_MODELS.filter((m) => !m.requires || s.research.includes(m.requires));
  s.market = Array.from({ length: 5 }, () => {
    const model = available[Math.floor(Math.random() * available.length)];
    const condition = Math.round(30 + Math.random() * 55);
    const age = Math.round(3 + Math.random() * 22);
    const price = Math.round((model.price * (0.22 + condition / 230) * Math.max(0.35, 1 - age * 0.018)) / 1000) * 1000;
    return { id: uid('L'), modelId: model.id, condition, age, price };
  });
}

export function makeCandidate(role: Role): Staff {
  const bonus = mods().candidateLevel;
  const roll = Math.random();
  const lvl = roll < 0.5 ? 1 : roll < 0.8 ? 2 : roll < 0.95 ? 3 : 4;
  return {
    id: uid('C'),
    name: randomName(),
    role,
    level: Math.min(10, lvl + bonus),
    xp: 0,
    planeId: null,
    status: 'ready',
    until: 0,
    trait: randomTrait(),
    color: randomAvatarColor(),
    flights: 0,
  };
}

export function refreshCandidates(): void {
  const s = S();
  s.lastCandidatesDay = day();
  s.candidates = [
    ...Array.from({ length: 4 }, () => makeCandidate('pilot')),
    ...Array.from({ length: 5 }, () => makeCandidate('attendant')),
  ];
}

export { salaryFor };
