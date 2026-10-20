import { MODEL_BY_ID, attendantsNeeded, PILOTS_PER_PLANE } from '../data/planes';
import { AIRPORT_BY_CODE } from '../data/airports';
import { RESEARCH_BY_ID } from '../data/research';
import { WIFI, SEATS, FOOD, DRINKS, findAmenity } from '../data/amenities';
import { randomPlaneName } from '../data/names';
import type { Airline, Plane } from './types';
import { bus } from './bus';
import { S, game, freshState, log, uid, saveGame, MIN_PER_DAY } from './state';
import { airportPrice, crewFor, distanceKm, hireFee, installCost, resaleValue, trainCost } from './economy';
import { spend, earn, refreshCandidates, refreshMarket, startRepair } from './sim';
import { money } from '../ui/format';

type Result = { ok: true } | { ok: false; why: string };
const ok: Result = { ok: true };
const fail = (why: string): Result => ({ ok: false, why });

function done(msg?: string, kind: 'good' | 'money' | 'research' | 'info' = 'good'): Result {
  if (msg) log(msg, kind, true);
  bus.emit('change');
  saveGame();
  return ok;
}

function afford(n: number): boolean {
  return S().money >= n;
}

export function updateAirline(patch: Partial<Pick<Airline, 'name' | 'code' | 'slogan' | 'color'>>): Result {
  const a = S().airline;
  const name = patch.name?.trim();
  const code = patch.code?.toUpperCase().replace(/[^A-Z]/g, '');
  if (patch.name !== undefined && !name) return fail('Airline name cannot be empty');
  if (patch.code !== undefined && (!code || code.length !== 2)) return fail('Airline code must be 2 letters');
  if (name) a.name = name.slice(0, 28);
  if (code) a.code = code;
  if (patch.slogan !== undefined) a.slogan = patch.slogan.trim().slice(0, 40);
  if (patch.color) a.color = patch.color;
  document.documentElement.style.setProperty('--livery', a.color);
  return done(`Airline profile updated: ${a.name}.`, 'info');
}

export const HUB_MOVE_FEE = 50_000;

/** Total cost of moving the hub: admin fee, plus landing rights if not already owned. */
export function hubMoveCost(code: string): number {
  return HUB_MOVE_FEE + (S().owned.includes(code) ? 0 : airportPrice(code));
}

/**
 * Move the airline's home base. The old hub stays owned as a regular airport,
 * so existing routes keep flying; new planes are delivered to the new hub.
 */
export function relocateHub(code: string): Result {
  const s = S();
  const target = AIRPORT_BY_CODE[code];
  if (!target) return fail('Unknown airport');
  if (s.airline.hub === code) return fail('That is already your hub');
  if (target.size < 2) return fail('Regional airports are too small to be a hub');
  const cost = hubMoveCost(code);
  if (!afford(cost)) return fail('Not enough money');
  spend(cost);
  const old = s.airline.hub;
  if (!s.owned.includes(code)) s.owned.push(code);
  s.airline.hub = code;
  return done(`Moved headquarters from ${AIRPORT_BY_CODE[old].city} to ${target.city} (${code}) for ${money(cost)}.`, 'money');
}

export function newGame(airline: Airline): void {
  game.s = freshState(airline);
  game.speed = 1;
  refreshMarket();
  refreshCandidates();
  log(`${airline.name} has begun operations at ${AIRPORT_BY_CODE[airline.hub].city}. Acquire an aircraft, hire a crew and plan your first route.`, 'good');
  saveGame();
  bus.emit('change');
}

// ─── Airports ────────────────────────────────────────────────────────────────

export function buyAirport(code: string): Result {
  const s = S();
  if (s.owned.includes(code)) return fail('Already yours');
  const price = airportPrice(code);
  if (!afford(price)) return fail('Not enough money');
  spend(price);
  s.owned.push(code);
  return done(`Landing rights secured at ${AIRPORT_BY_CODE[code].city} (${code}) for ${money(price)}.`, 'money');
}

// ─── Planes ──────────────────────────────────────────────────────────────────

function tailNumber(): string {
  const s = S();
  return `${s.airline.code}-${(100 + s.nextId).toString()}`;
}

function addPlane(modelId: string, condition: number, age: number, used: boolean): Plane {
  const s = S();
  const plane: Plane = {
    id: uid('P'),
    modelId,
    tail: tailNumber(),
    nickname: randomPlaneName(),
    condition,
    age,
    flights: 0,
    wifi: 'none',
    seats: 'standard',
    routeId: null,
    location: s.airline.hub,
    status: 'idle',
    statusUntil: 0,
    leg: null,
    profit: 0,
    used,
    hold: 'No route assigned',
  };
  s.planes.push(plane);
  return plane;
}

function modelUnlocked(modelId: string): boolean {
  const req = MODEL_BY_ID[modelId].requires;
  return !req || S().research.includes(req);
}

export function buyNewPlane(modelId: string): Result {
  const model = MODEL_BY_ID[modelId];
  if (!modelUnlocked(modelId)) return fail('Research required');
  if (!afford(model.price)) return fail('Not enough money');
  spend(model.price);
  const p = addPlane(modelId, 100, 0, false);
  return done(`Took delivery of a new ${model.name}, ${p.tail} "${p.nickname}".`, 'money');
}

export function buyUsedPlane(listingId: string): Result {
  const s = S();
  const listing = s.market.find((l) => l.id === listingId);
  if (!listing) return fail('Listing gone');
  if (!modelUnlocked(listing.modelId)) return fail('Research required');
  if (!afford(listing.price)) return fail('Not enough money');
  spend(listing.price);
  s.market = s.market.filter((l) => l !== listing);
  const p = addPlane(listing.modelId, listing.condition, listing.age, true);
  return done(`Acquired a used ${MODEL_BY_ID[p.modelId].name}, ${p.tail}.`, 'money');
}

export function sellPlane(planeId: string): Result {
  const s = S();
  const p = s.planes.find((x) => x.id === planeId);
  if (!p) return fail('No such plane');
  if (p.status === 'flying') return fail('Wait until it lands');
  const value = resaleValue(p);
  earn(value);
  for (const st of s.staff) if (st.planeId === p.id) st.planeId = null;
  s.planes = s.planes.filter((x) => x !== p);
  return done(`Sold ${p.tail} "${p.nickname}" for ${money(value)}.`, 'money');
}

export function repairPlane(planeId: string): Result {
  const p = S().planes.find((x) => x.id === planeId);
  if (!p) return fail('No such plane');
  if (p.status === 'flying') return fail('Plane is in the air');
  if (p.status === 'repair') return fail('Already in the hangar');
  if (p.condition >= 99.5) return fail('Already in perfect shape');
  return startRepair(p) ? ok : fail('Not enough money');
}

export function renamePlane(planeId: string, nickname: string): Result {
  const p = S().planes.find((x) => x.id === planeId);
  if (!p) return fail('No such plane');
  p.nickname = nickname.slice(0, 24) || p.nickname;
  return done();
}

export function installUpgrade(planeId: string, kind: 'wifi' | 'seats', id: string, quiet = false): Result {
  const s = S();
  const p = s.planes.find((x) => x.id === planeId);
  if (!p) return fail('No such plane');
  const list = kind === 'wifi' ? WIFI : SEATS;
  const item = findAmenity(list, id);
  if (item.requires && !s.research.includes(item.requires)) return fail('Research required');
  if (p[kind] === id) return fail('Already installed');
  const cost = installCost(item.cost, p);
  if (!afford(cost)) return fail('Not enough money');
  spend(cost);
  p[kind] = id;
  const msg = `Installed ${item.name} on ${p.tail} for ${money(cost)}.`;
  if (quiet) {
    log(msg, 'money');
    return done();
  }
  return done(msg, 'money');
}

// ─── Service menu ────────────────────────────────────────────────────────────

export function setMenu(kind: 'food' | 'drinks', id: string): Result {
  const s = S();
  const item = findAmenity(kind === 'food' ? FOOD : DRINKS, id);
  if (item.requires && !s.research.includes(item.requires)) return fail('Research required');
  s.service[kind] = id;
  return done(`Now serving ${item.name} on every flight.`, 'info');
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export function hire(candidateId: string): Result {
  const s = S();
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c) return fail('Candidate left');
  const fee = hireFee(c);
  if (!afford(fee)) return fail('Not enough money');
  spend(fee);
  s.candidates = s.candidates.filter((x) => x !== c);
  s.staff.push({ ...c, id: uid('S') });
  return done(`Hired ${c.role === 'pilot' ? 'pilot' : 'flight attendant'} ${c.name}.`, 'good');
}

export function fire(staffId: string): Result {
  const s = S();
  const st = s.staff.find((x) => x.id === staffId);
  if (!st) return fail('No such person');
  const plane = st.planeId ? s.planes.find((p) => p.id === st.planeId) : null;
  if (plane?.status === 'flying') return fail('They are mid-flight!');
  s.staff = s.staff.filter((x) => x !== st);
  return done(`${st.name} has left the company.`, 'info');
}

export function assignStaff(staffId: string, planeId: string | null): Result {
  const s = S();
  const st = s.staff.find((x) => x.id === staffId);
  if (!st) return fail('No such person');
  const current = st.planeId ? s.planes.find((p) => p.id === st.planeId) : null;
  if (current?.status === 'flying') return fail('They are mid-flight!');
  if (planeId) {
    const plane = s.planes.find((p) => p.id === planeId);
    if (!plane) return fail('No such plane');
    if (plane.status === 'flying') return fail('Plane is in the air');
    const { pilots, attendants } = crewFor(planeId);
    const need = st.role === 'pilot' ? PILOTS_PER_PLANE : attendantsNeeded(MODEL_BY_ID[plane.modelId]);
    const have = st.role === 'pilot' ? pilots.length : attendants.length;
    if (have >= need) return fail(`That plane already has enough ${st.role}s`);
  }
  st.planeId = planeId;
  return done();
}

/** Fill every empty crew seat with the best available unassigned staff. */
export function autoCrew(): Result {
  const s = S();
  let filled = 0;
  for (const plane of s.planes) {
    if (plane.status === 'flying') continue;
    for (const role of ['pilot', 'attendant'] as const) {
      const need = role === 'pilot' ? PILOTS_PER_PLANE : attendantsNeeded(MODEL_BY_ID[plane.modelId]);
      let have = s.staff.filter((x) => x.planeId === plane.id && x.role === role).length;
      const free = s.staff
        .filter((x) => !x.planeId && x.role === role && x.status !== 'injured')
        .sort((a, b) => b.level - a.level);
      while (have < need && free.length) {
        free.shift()!.planeId = plane.id;
        have++;
        filled++;
      }
    }
  }
  if (!filled) return fail('No free staff to place');
  return done(`Auto-assigned ${filled} crew member${filled > 1 ? 's' : ''}.`, 'info');
}

export function train(staffId: string): Result {
  const s = S();
  const st = s.staff.find((x) => x.id === staffId);
  if (!st) return fail('No such person');
  if (st.level >= 10) return fail('Already max level');
  if (st.status !== 'ready') return fail('Not available right now');
  const plane = st.planeId ? s.planes.find((p) => p.id === st.planeId) : null;
  if (plane?.status === 'flying') return fail('They are mid-flight!');
  const cost = trainCost(st);
  if (!afford(cost)) return fail('Not enough money');
  spend(cost);
  st.status = 'training';
  st.until = s.time + MIN_PER_DAY * (0.5 + st.level * 0.25);
  return done(`${st.name} enrolled in training for ${money(cost)}.`, 'money');
}

export function rerollCandidates(): Result {
  const cost = 5_000;
  if (!afford(cost)) return fail('Not enough money');
  spend(cost);
  refreshCandidates();
  return done('Job advert posted. New applicants are available.', 'info');
}

export function rerollMarket(): Result {
  const cost = 8_000;
  if (!afford(cost)) return fail('Not enough money');
  spend(cost);
  refreshMarket();
  return done('Broker found new used-aircraft listings.', 'info');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function createRoute(from: string, to: string): Result {
  const s = S();
  if (from === to) return fail('Pick two different airports');
  if (!s.owned.includes(from) || !s.owned.includes(to)) return fail('You need landing rights at both ends');
  if (s.routes.some((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from))) return fail('Route already exists');
  s.routes.push({ id: uid('R'), from, to, priceMult: 1, flights: 0, profit: 0 });
  return done(`New route opened: ${from} ⇄ ${to} (${Math.round(distanceKm(from, to)).toLocaleString()} km).`, 'good');
}

export function deleteRoute(routeId: string): Result {
  const s = S();
  s.routes = s.routes.filter((r) => r.id !== routeId);
  for (const p of s.planes) if (p.routeId === routeId) p.routeId = null;
  return done('Route closed. Planes will finish their current flight.', 'info');
}

export function setRoutePrice(routeId: string, mult: number): Result {
  const r = S().routes.find((x) => x.id === routeId);
  if (!r) return fail('No such route');
  r.priceMult = Math.max(0.5, Math.min(2.5, mult));
  bus.emit('change');
  return ok;
}

export function assignPlaneToRoute(planeId: string, routeId: string | null): Result {
  const s = S();
  const p = s.planes.find((x) => x.id === planeId);
  if (!p) return fail('No such plane');
  if (routeId) {
    const r = s.routes.find((x) => x.id === routeId);
    if (!r) return fail('No such route');
    const model = MODEL_BY_ID[p.modelId];
    const dist = distanceKm(r.from, r.to);
    if (dist > model.range) return fail(`Too far! ${model.name} range is ${model.range.toLocaleString()} km`);
    // ferry the plane to the route if it is parked elsewhere
    if (p.status !== 'flying' && p.location !== r.from && p.location !== r.to) {
      p.location = r.from;
    }
  }
  p.routeId = routeId;
  return done();
}

// ─── Research ────────────────────────────────────────────────────────────────

export function canResearch(id: string): Result {
  const s = S();
  const node = RESEARCH_BY_ID[id];
  if (s.research.includes(id)) return fail('Already researched');
  const missing = node.requires.filter((r) => !s.research.includes(r));
  if (missing.length) return fail(`Requires ${missing.map((m) => RESEARCH_BY_ID[m].name).join(' + ')}`);
  if (s.rp < node.cost) return fail(`Need ${Math.ceil(node.cost - s.rp)} more RP`);
  if (!afford(node.money)) return fail('Not enough money');
  return ok;
}

export function research(id: string): Result {
  const check = canResearch(id);
  if (!check.ok) return check;
  const s = S();
  const node = RESEARCH_BY_ID[id];
  s.rp -= node.cost;
  spend(node.money);
  s.research.push(id);
  return done(`Research complete: ${node.name}. ${node.desc}`, 'research');
}

export function buyResearchPoints(): Result {
  const s = S();
  const cost = 20_000 + s.research.length * 2_000;
  if (!afford(cost)) return fail('Not enough money');
  spend(cost);
  s.rp += 5;
  return done(`Funded a research grant: +5 RP for ${money(cost)}.`, 'research');
}

export function researchGrantCost(): number {
  return 20_000 + S().research.length * 2_000;
}

export function setAutoRepair(threshold: number): void {
  S().autoRepairAt = threshold;
  bus.emit('change');
}
