export interface PlaneModel {
  id: string;
  name: string;
  maker: string;
  emoji: string;
  blurb: string;
  capacity: number;
  /** cruise speed, km/h */
  speed: number;
  /** max range, km */
  range: number;
  price: number;
  /** litres per km */
  fuelBurn: number;
  /** multiplier on base failure chance (lower is safer) */
  risk: number;
  /** multiplier on wear per flight */
  wear: number;
  /** research id needed to buy, if any */
  requires?: string;
  color: string;
}

export const PLANE_MODELS: PlaneModel[] = [
  {
    id: 'sparrow', name: 'Sparrow S-19', maker: 'Pipwing Aero', emoji: '🐦',
    blurb: 'Rugged 19-seat turboprop. Inexpensive to buy, less reliable with age.',
    capacity: 19, speed: 450, range: 1800, price: 180_000, fuelBurn: 1.1, risk: 1.25, wear: 1.2, color: '#ffb703',
  },
  {
    id: 'hummingbird', name: 'Hummingbird eJ-30', maker: 'Voltaire Air', emoji: '⚡',
    blurb: 'Quiet battery-electric commuter. Short range, near-zero fuel cost.',
    capacity: 30, speed: 420, range: 1000, price: 420_000, fuelBurn: 0.15, risk: 0.8, wear: 0.7, requires: 'electric', color: '#8ac926',
  },
  {
    id: 'kestrel', name: 'Kestrel K-70', maker: 'Pipwing Aero', emoji: '🦅',
    blurb: 'Dependable 70-seat regional aircraft with low maintenance needs.',
    capacity: 70, speed: 540, range: 2600, price: 650_000, fuelBurn: 2.3, risk: 1.0, wear: 1.0, color: '#fb8500',
  },
  {
    id: 'albatross', name: 'Albatross A-160', maker: 'Brightjet', emoji: '✈️',
    blurb: 'Efficient narrow-body jet for busy short- and medium-haul routes.',
    capacity: 160, speed: 830, range: 5600, price: 2_400_000, fuelBurn: 4.4, risk: 0.9, wear: 1.0, requires: 'jet-age', color: '#219ebc',
  },
  {
    id: 'heron', name: 'Heron H-200', maker: 'Brightjet', emoji: '🛩️',
    blurb: 'Stretched narrow-body with the range for transatlantic service.',
    capacity: 200, speed: 850, range: 7200, price: 3_400_000, fuelBurn: 5.2, risk: 0.85, wear: 0.95, requires: 'jet-age', color: '#023e8a',
  },
  {
    id: 'pelican', name: 'Pelican W-300', maker: 'Oceanic Works', emoji: '🦢',
    blurb: 'Twin-aisle wide-body built for long ocean crossings.',
    capacity: 300, speed: 880, range: 12_000, price: 7_800_000, fuelBurn: 7.8, risk: 0.75, wear: 0.9, requires: 'long-haul', color: '#7b2cbf',
  },
  {
    id: 'falcon', name: 'Falcon SST', maker: 'Mach Dynamics', emoji: '🚀',
    blurb: 'Supersonic airliner. Cruises above Mach 2 at a steep fuel cost.',
    capacity: 100, speed: 2150, range: 7000, price: 11_500_000, fuelBurn: 16, risk: 1.1, wear: 1.5, requires: 'supersonic', color: '#e63946',
  },
  {
    id: 'mammoth', name: 'Mammoth M-520', maker: 'Oceanic Works', emoji: '🐘',
    blurb: 'Double-deck flagship with the highest capacity in the sky.',
    capacity: 520, speed: 900, range: 14_800, price: 15_500_000, fuelBurn: 12.5, risk: 0.7, wear: 0.9, requires: 'jumbo', color: '#c1121f',
  },
];

export const MODEL_BY_ID: Record<string, PlaneModel> = Object.fromEntries(
  PLANE_MODELS.map((m) => [m.id, m]),
);

export const PILOTS_PER_PLANE = 2;
export function attendantsNeeded(model: PlaneModel): number {
  return Math.max(1, Math.ceil(model.capacity / 50));
}
