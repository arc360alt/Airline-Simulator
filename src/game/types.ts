export type PlaneStatus = 'idle' | 'boarding' | 'flying' | 'repair';
export type Incident = 'minor' | 'emergency' | 'crash';
export type Role = 'pilot' | 'attendant';
export type StaffStatus = 'ready' | 'injured' | 'training';

export interface Leg {
  from: string;
  to: string;
  depart: number;
  arrive: number;
  distance: number;
  pax: number;
  revenue: number;
  cost: number;
  joy: number;
  incident: Incident | null;
  /** 0..1 progress at which the incident strikes */
  incidentAt: number;
  incidentDone: boolean;
}

export interface Plane {
  id: string;
  modelId: string;
  tail: string;
  nickname: string;
  condition: number;
  age: number;
  flights: number;
  wifi: string;
  seats: string;
  routeId: string | null;
  location: string;
  status: PlaneStatus;
  statusUntil: number;
  leg: Leg | null;
  profit: number;
  used: boolean;
  hold: string;
}

export interface Staff {
  id: string;
  name: string;
  role: Role;
  level: number;
  xp: number;
  planeId: string | null;
  status: StaffStatus;
  until: number;
  trait: string;
  color: string;
  flights: number;
}

export interface Route {
  id: string;
  from: string;
  to: string;
  priceMult: number;
  flights: number;
  profit: number;
}

export interface Listing {
  id: string;
  modelId: string;
  condition: number;
  age: number;
  price: number;
}

export interface DayLedger {
  day: number;
  revenue: number;
  expenses: number;
  pax: number;
}

export type LogKind = 'info' | 'good' | 'bad' | 'money' | 'research';
export interface LogEntry {
  t: number;
  msg: string;
  kind: LogKind;
}

export interface Airline {
  name: string;
  code: string;
  color: string;
  hub: string;
  slogan: string;
}

export interface GameState {
  version: number;
  airline: Airline;
  money: number;
  /** in game minutes since day 0 00:00 */
  time: number;
  reputation: number;
  satisfaction: number;
  owned: string[];
  planes: Plane[];
  staff: Staff[];
  routes: Route[];
  candidates: Staff[];
  market: Listing[];
  lastMarketDay: number;
  lastCandidatesDay: number;
  research: string[];
  rp: number;
  service: { food: string; drinks: string };
  fuelPrice: number;
  autoRepairAt: number;
  ledger: DayLedger[];
  today: DayLedger;
  log: LogEntry[];
  stats: { pax: number; flights: number; crashes: number; revenue: number; incidents: number };
  nextId: number;
}

export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'teal' | 'green' | 'yellow' | 'orange' | 'red' | 'pink' | 'purple';

export interface Settings {
  theme: Theme;
  accent: Accent;
  autoRotate: boolean;
  showLabels: boolean;
  showAllAirports: boolean;
  showArcs: boolean;
  sound: boolean;
  volume: number;
  units: 'km' | 'mi';
  quality: 'low' | 'high';
  confirmBig: boolean;
  ticker: boolean;
  pauseOnCrash: boolean;
}
