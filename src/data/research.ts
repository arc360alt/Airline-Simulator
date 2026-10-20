export type Branch = 'fleet' | 'ops' | 'comfort' | 'crew' | 'biz';

export interface Mods {
  fuel: number;
  wear: number;
  risk: number;
  pilotRisk: number;
  repairCost: number;
  repairTime: number;
  turnaround: number;
  loadBonus: number;
  airportCost: number;
  fees: number;
  salary: number;
  rpMult: number;
  candidateLevel: number;
  crewJoy: number;
  repGain: number;
  speed: number;
}

export interface ResearchNode {
  id: string;
  name: string;
  emoji: string;
  branch: Branch;
  /** column in the tree (tier) */
  tier: number;
  /** row inside the tree grid */
  row: number;
  cost: number;
  money: number;
  requires: string[];
  desc: string;
  apply?: (m: Mods) => void;
}

export const BRANCHES: Record<Branch, { name: string; color: string }> = {
  fleet: { name: 'Fleet', color: '#38bdf8' },
  ops: { name: 'Operations', color: '#f59e0b' },
  comfort: { name: 'Comfort', color: '#f472b6' },
  crew: { name: 'Crew', color: '#a78bfa' },
  biz: { name: 'Business', color: '#34d399' },
};

export const RESEARCH: ResearchNode[] = [
  // Fleet
  { id: 'electric', name: 'Electric Propulsion', emoji: '⚡', branch: 'fleet', tier: 0, row: 0, cost: 20, money: 50_000, requires: [], desc: 'Unlocks the Hummingbird eJ-30 electric plane.' },
  { id: 'jet-age', name: 'Jet Age', emoji: '✈️', branch: 'fleet', tier: 0, row: 1, cost: 30, money: 120_000, requires: [], desc: 'Unlocks Albatross A-160 & Heron H-200 jets.' },
  { id: 'long-haul', name: 'Long-haul Cert', emoji: '🌏', branch: 'fleet', tier: 1, row: 1, cost: 80, money: 400_000, requires: ['jet-age'], desc: 'Unlocks the Pelican W-300 wide-body.' },
  { id: 'jumbo', name: 'Superjumbo', emoji: '🐘', branch: 'fleet', tier: 2, row: 0, cost: 160, money: 1_200_000, requires: ['long-haul'], desc: 'Unlocks the double-decker Mammoth M-520.' },
  { id: 'supersonic', name: 'Supersonic Flight', emoji: '🚀', branch: 'fleet', tier: 2, row: 1, cost: 220, money: 1_800_000, requires: ['long-haul'], desc: 'Unlocks the Falcon SST supersonic jet.' },
  { id: 'aero', name: 'Winglets', emoji: '🪽', branch: 'fleet', tier: 1, row: 0, cost: 45, money: 150_000, requires: ['electric'], desc: 'All planes cruise 6% faster.', apply: (m) => { m.speed += 0.06; } },

  // Operations
  { id: 'fuel-1', name: 'Fuel Planning', emoji: '⛽', branch: 'ops', tier: 0, row: 2, cost: 15, money: 40_000, requires: [], desc: '-8% fuel use.', apply: (m) => { m.fuel *= 0.92; } },
  { id: 'fuel-2', name: 'Lean Burn Engines', emoji: '🔥', branch: 'ops', tier: 1, row: 2, cost: 50, money: 200_000, requires: ['fuel-1'], desc: '-10% fuel use.', apply: (m) => { m.fuel *= 0.9; } },
  { id: 'fuel-3', name: 'Sustainable Fuel', emoji: '🌿', branch: 'ops', tier: 2, row: 2, cost: 120, money: 600_000, requires: ['fuel-2', 'electric'], desc: '-15% fuel use.', apply: (m) => { m.fuel *= 0.85; } },
  { id: 'maint-1', name: 'Line Maintenance', emoji: '🔧', branch: 'ops', tier: 0, row: 3, cost: 15, money: 40_000, requires: [], desc: 'Repairs 25% cheaper and 25% faster.', apply: (m) => { m.repairCost *= 0.75; m.repairTime *= 0.75; } },
  { id: 'maint-2', name: 'Predictive Maint.', emoji: '📈', branch: 'ops', tier: 1, row: 3, cost: 55, money: 180_000, requires: ['maint-1'], desc: 'Planes wear out 30% slower.', apply: (m) => { m.wear *= 0.7; } },
  { id: 'maint-3', name: 'Composite Airframes', emoji: '🧬', branch: 'ops', tier: 2, row: 3, cost: 140, money: 700_000, requires: ['maint-2'], desc: '-35% chance of mechanical failure.', apply: (m) => { m.risk *= 0.65; } },
  { id: 'turn', name: 'Rapid Turnarounds', emoji: '⏱️', branch: 'ops', tier: 1, row: 4, cost: 40, money: 120_000, requires: ['maint-1'], desc: 'Ground time between flights -25%.', apply: (m) => { m.turnaround *= 0.75; } },

  // Comfort
  { id: 'wifi-basic', name: 'Basic Wifi', emoji: '📶', branch: 'comfort', tier: 0, row: 5, cost: 15, money: 30_000, requires: [], desc: 'Unlocks basic in-flight wifi.' },
  { id: 'wifi-sat', name: 'Satellite Wifi', emoji: '🛰️', branch: 'comfort', tier: 1, row: 5, cost: 60, money: 220_000, requires: ['wifi-basic'], desc: 'Unlocks blazing satellite wifi.' },
  { id: 'comfy-seats', name: 'Extra-legroom Seats', emoji: '🛋️', branch: 'comfort', tier: 0, row: 6, cost: 20, money: 50_000, requires: [], desc: 'Unlocks extra-legroom seat upgrades.' },
  { id: 'lie-flat', name: 'Lie-flat Pods', emoji: '🛏️', branch: 'comfort', tier: 1, row: 6, cost: 90, money: 400_000, requires: ['comfy-seats'], desc: 'Unlocks luxury lie-flat seating.' },
  { id: 'hot-meals', name: 'Hot Galleys', emoji: '🍝', branch: 'comfort', tier: 0, row: 7, cost: 15, money: 35_000, requires: [], desc: 'Unlocks hot meals and barista coffee.' },
  { id: 'gourmet', name: 'Premium Catering', emoji: '👨‍🍳', branch: 'comfort', tier: 1, row: 7, cost: 70, money: 250_000, requires: ['hot-meals'], desc: 'Unlocks gourmet menus and the cocktail bar.' },
  { id: 'luxury-brand', name: 'Luxury Brand', emoji: '💎', branch: 'comfort', tier: 2, row: 6, cost: 150, money: 800_000, requires: ['lie-flat', 'gourmet'], desc: 'Unlocks champagne service. +10% reputation gain.', apply: (m) => { m.repGain *= 1.1; } },

  // Crew
  { id: 'academy', name: 'Flight Academy', emoji: '🎓', branch: 'crew', tier: 0, row: 8, cost: 25, money: 80_000, requires: [], desc: 'Job applicants arrive +1 level higher.', apply: (m) => { m.candidateLevel += 1; } },
  { id: 'academy-2', name: 'Senior Recruitment', emoji: '🌟', branch: 'crew', tier: 1, row: 8, cost: 75, money: 260_000, requires: ['academy'], desc: 'Job applicants arrive another +1 level higher.', apply: (m) => { m.candidateLevel += 1; } },
  { id: 'crm', name: 'Crew Resource Mgmt', emoji: '🧠', branch: 'crew', tier: 1, row: 9, cost: 50, money: 160_000, requires: ['academy'], desc: 'Pilot-caused incidents -25%.', apply: (m) => { m.pilotRisk *= 0.75; } },
  { id: 'charm', name: 'Service Training', emoji: '😊', branch: 'crew', tier: 0, row: 9, cost: 20, money: 50_000, requires: [], desc: 'Attendants raise passenger satisfaction by 5.', apply: (m) => { m.crewJoy += 5; } },
  { id: 'union', name: 'Labour Agreement', emoji: '🤝', branch: 'crew', tier: 2, row: 9, cost: 110, money: 300_000, requires: ['crm', 'charm'], desc: 'All salaries -12%.', apply: (m) => { m.salary *= 0.88; } },

  // Business
  { id: 'mkt-1', name: 'Brand Campaign', emoji: '🎵', branch: 'biz', tier: 0, row: 10, cost: 15, money: 40_000, requires: [], desc: '+5% passenger demand.', apply: (m) => { m.loadBonus += 0.05; } },
  { id: 'mkt-2', name: 'Digital Marketing', emoji: '📱', branch: 'biz', tier: 1, row: 10, cost: 60, money: 200_000, requires: ['mkt-1'], desc: '+8% passenger demand.', apply: (m) => { m.loadBonus += 0.08; } },
  { id: 'loyalty', name: 'Loyalty Programme', emoji: '💳', branch: 'biz', tier: 2, row: 10, cost: 120, money: 500_000, requires: ['mkt-2'], desc: '+6% demand, +25% reputation gain.', apply: (m) => { m.loadBonus += 0.06; m.repGain *= 1.25; } },
  { id: 'hub-deals', name: 'Airport Partnerships', emoji: '🏛️', branch: 'biz', tier: 1, row: 11, cost: 45, money: 150_000, requires: ['mkt-1'], desc: 'Airports 25% cheaper, landing fees -20%.', apply: (m) => { m.airportCost *= 0.75; m.fees *= 0.8; } },
  { id: 'lab', name: 'Research Campus', emoji: '🔬', branch: 'biz', tier: 0, row: 11, cost: 30, money: 100_000, requires: [], desc: '+50% research points from flights.', apply: (m) => { m.rpMult *= 1.5; } },
];

export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(
  RESEARCH.map((r) => [r.id, r]),
);

export function baseMods(): Mods {
  return {
    fuel: 1, wear: 1, risk: 1, pilotRisk: 1, repairCost: 1, repairTime: 1, turnaround: 1,
    loadBonus: 0, airportCost: 1, fees: 1, salary: 1, rpMult: 1, candidateLevel: 0,
    crewJoy: 0, repGain: 1, speed: 1,
  };
}

export function computeMods(unlocked: string[]): Mods {
  const m = baseMods();
  for (const id of unlocked) RESEARCH_BY_ID[id]?.apply?.(m);
  return m;
}
