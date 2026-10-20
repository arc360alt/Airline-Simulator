import { AIRPORT_BY_CODE, SIZE_DEMAND, SIZE_PRICE } from '../data/airports';
import { MODEL_BY_ID, attendantsNeeded, PILOTS_PER_PLANE, type PlaneModel } from '../data/planes';
import { computeMods, type Mods } from '../data/research';
import { DRINKS, FOOD, SEATS, WIFI, findAmenity } from '../data/amenities';
import type { Plane, Staff, Route } from './types';
import { S } from './state';

const R_EARTH = 6371;

export function distanceKm(a: string, b: string): number {
  const A = AIRPORT_BY_CODE[a];
  const B = AIRPORT_BY_CODE[b];
  const toRad = Math.PI / 180;
  const dLat = (B.lat - A.lat) * toRad;
  const dLon = (B.lon - A.lon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(A.lat * toRad) * Math.cos(B.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

let modsCache: { key: string; mods: Mods } = { key: '', mods: computeMods([]) };
export function mods(): Mods {
  const key = S().research.join(',');
  if (key !== modsCache.key) modsCache = { key, mods: computeMods(S().research) };
  return modsCache.mods;
}

export function airportPrice(code: string): number {
  return Math.round(SIZE_PRICE[AIRPORT_BY_CODE[code].size] * mods().airportCost);
}

export function landingFee(code: string, model: PlaneModel): number {
  const size = AIRPORT_BY_CODE[code].size;
  return Math.round((30 + size * 25) * (1 + model.capacity / 60) * mods().fees);
}

export function baseFare(distance: number): number {
  return 55 + distance * 0.17;
}

export function salaryFor(role: Staff['role'], level: number): number {
  const base = role === 'pilot' ? 140 + level * 110 : 70 + level * 55;
  return Math.round(base * mods().salary);
}

export function hireFee(st: Staff): number {
  return salaryFor(st.role, st.level) * 3;
}

export function xpForNext(level: number): number {
  return 40 + level * 40;
}

export function trainCost(st: Staff): number {
  return salaryFor(st.role, st.level + 1) * 8;
}

export function crewFor(planeId: string): { pilots: Staff[]; attendants: Staff[] } {
  const crew = S().staff.filter((x) => x.planeId === planeId);
  return {
    pilots: crew.filter((x) => x.role === 'pilot'),
    attendants: crew.filter((x) => x.role === 'attendant'),
  };
}

export function crewReady(plane: Plane): { ok: boolean; why: string } {
  const model = MODEL_BY_ID[plane.modelId];
  const { pilots, attendants } = crewFor(plane.id);
  const rp = pilots.filter((p) => p.status === 'ready').length;
  const ra = attendants.filter((p) => p.status === 'ready').length;
  if (rp < PILOTS_PER_PLANE) return { ok: false, why: `Needs ${PILOTS_PER_PLANE - rp} more pilot${PILOTS_PER_PLANE - rp > 1 ? 's' : ''}` };
  const need = attendantsNeeded(model);
  if (ra < need) return { ok: false, why: `Needs ${need - ra} more attendant${need - ra > 1 ? 's' : ''}` };
  return { ok: true, why: '' };
}

function avgLevel(list: Staff[]): number {
  if (!list.length) return 1;
  return list.reduce((a, b) => a + b.level, 0) / list.length;
}

/** Chance (0..1) that a flight has some kind of incident. */
export function incidentRisk(plane: Plane): number {
  const model = MODEL_BY_ID[plane.modelId];
  const m = mods();
  const wear = (100 - plane.condition) / 100;
  const ageFactor = 1 + Math.min(plane.age, 30) / 60;
  const pilotLvl = avgLevel(crewFor(plane.id).pilots);
  const pilotFactor = (1.25 - pilotLvl * 0.07) * m.pilotRisk;
  const raw = (0.003 + 0.07 * wear * wear) * model.risk * ageFactor * m.risk * Math.max(0.3, pilotFactor);
  return Math.min(0.6, raw);
}

/** Of the incidents that happen, how likely is it to be catastrophic? */
export function crashShare(plane: Plane): number {
  const pilotLvl = avgLevel(crewFor(plane.id).pilots);
  const base = plane.condition < 25 ? 0.12 : plane.condition < 50 ? 0.04 : 0.015;
  return base * Math.max(0.3, 1.3 - pilotLvl * 0.08);
}

export function flightMinutes(plane: Plane, distance: number): number {
  const model = MODEL_BY_ID[plane.modelId];
  const pilotLvl = avgLevel(crewFor(plane.id).pilots);
  const speed = model.speed * mods().speed * (1 + (pilotLvl - 1) * 0.01);
  return Math.max(25, (distance / speed) * 60 + 20);
}

export function turnaroundMinutes(plane: Plane): number {
  const model = MODEL_BY_ID[plane.modelId];
  const attLvl = avgLevel(crewFor(plane.id).attendants);
  const base = 35 + model.capacity * 0.18;
  return Math.max(15, base * (1.45 - attLvl * 0.075) * mods().turnaround);
}

export function planeJoy(plane: Plane): number {
  const s = S();
  const attLvl = avgLevel(crewFor(plane.id).attendants);
  const joy =
    45 +
    findAmenity(WIFI, plane.wifi).joy +
    findAmenity(SEATS, plane.seats).joy +
    findAmenity(FOOD, s.service.food).joy +
    findAmenity(DRINKS, s.service.drinks).joy +
    attLvl * 2.2 +
    mods().crewJoy -
    (100 - plane.condition) * 0.08;
  return Math.max(0, Math.min(100, joy));
}

export function fareBonus(plane: Plane): number {
  const s = S();
  return (
    findAmenity(WIFI, plane.wifi).fareBonus +
    findAmenity(SEATS, plane.seats).fareBonus +
    findAmenity(FOOD, s.service.food).fareBonus +
    findAmenity(DRINKS, s.service.drinks).fareBonus
  );
}

export function servicePerPax(): number {
  const s = S();
  return findAmenity(FOOD, s.service.food).cost + findAmenity(DRINKS, s.service.drinks).cost;
}

export function loadFactor(route: Route, plane: Plane): number {
  const s = S();
  const a = AIRPORT_BY_CODE[route.from];
  const b = AIRPORT_BY_CODE[route.to];
  const demand = (SIZE_DEMAND[a.size] + SIZE_DEMAND[b.size]) / 2;
  // passengers forgive higher prices if the service is nicer
  const priceSensitivity = (route.priceMult - 1 - fareBonus(plane) * 0.6) * 0.75;
  // more planes on the same route split the demand a little
  const competition = s.planes.filter((p) => p.routeId === route.id).length;
  const crowd = Math.max(0, competition - 1) * 0.04;
  const lf =
    (0.32 + s.reputation / 220 + planeJoy(plane) / 300 + mods().loadBonus) * demand -
    priceSensitivity -
    crowd;
  return Math.max(0.08, Math.min(1, lf));
}

export function estimateLeg(route: Route, plane: Plane) {
  const model = MODEL_BY_ID[plane.modelId];
  const distance = distanceKm(route.from, route.to);
  const lf = loadFactor(route, plane);
  const pax = Math.round(model.capacity * lf);
  const fare = baseFare(distance) * route.priceMult * (1 + fareBonus(plane));
  const revenue = pax * fare;
  const fuel = distance * model.fuelBurn * S().fuelPrice * mods().fuel;
  const cost = fuel + landingFee(route.to, model) + pax * servicePerPax();
  return { distance, lf, pax, fare, revenue, fuel, cost, minutes: flightMinutes(plane, distance) };
}

export function repairCost(plane: Plane): number {
  const model = MODEL_BY_ID[plane.modelId];
  return Math.round((100 - plane.condition) * model.price * 0.0009 * mods().repairCost);
}

export function repairMinutes(plane: Plane): number {
  return Math.round((30 + (100 - plane.condition) * 7) * mods().repairTime);
}

export function resaleValue(plane: Plane): number {
  const model = MODEL_BY_ID[plane.modelId];
  const ageDep = Math.max(0.15, 1 - plane.age * 0.035);
  return Math.round(model.price * 0.6 * ageDep * (0.4 + plane.condition / 166));
}

export function installCost(perSeat: number, plane: Plane): number {
  return Math.round(perSeat * MODEL_BY_ID[plane.modelId].capacity);
}

export function dailySalaries(): number {
  return S().staff.reduce((sum, st) => sum + salaryFor(st.role, st.level), 0);
}

export function parkingFees(): number {
  // a small daily fee per owned airport keeps expansion meaningful
  return S().owned.reduce((sum, code) => sum + AIRPORT_BY_CODE[code].size * 120, 0);
}
