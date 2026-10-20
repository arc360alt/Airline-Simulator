/**
 * In-flight service options.
 * Wifi and seats are per-plane installs (one-off cost, scaled by seat count).
 * Food and drinks are airline-wide menus (cost per passenger per flight).
 */
export interface Amenity {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** happiness points added to each flight */
  joy: number;
  /** % fare premium passengers will tolerate */
  fareBonus: number;
  /** for installs: price per seat. for menus: cost per passenger */
  cost: number;
  requires?: string;
}

export const WIFI: Amenity[] = [
  { id: 'none', name: 'No Wifi', emoji: '📵', desc: 'No connectivity on board.', joy: 0, fareBonus: 0, cost: 0 },
  { id: 'basic', name: 'Basic Wifi', emoji: '📶', desc: 'Messaging and email.', joy: 6, fareBonus: 0.04, cost: 400, requires: 'wifi-basic' },
  { id: 'satellite', name: 'Satellite Wifi', emoji: '🛰️', desc: 'High-speed streaming-grade connection.', joy: 13, fareBonus: 0.09, cost: 1100, requires: 'wifi-sat' },
];

export const SEATS: Amenity[] = [
  { id: 'standard', name: 'Standard Seats', emoji: '🪑', desc: 'Standard economy pitch.', joy: 0, fareBonus: 0, cost: 0 },
  { id: 'comfy', name: 'Extra-legroom Seats', emoji: '🛋️', desc: 'Added padding and 5 cm more pitch.', joy: 9, fareBonus: 0.07, cost: 900, requires: 'comfy-seats' },
  { id: 'luxury', name: 'Lie-flat Pods', emoji: '🛏️', desc: 'Fully flat beds with direct aisle access.', joy: 20, fareBonus: 0.2, cost: 3200, requires: 'lie-flat' },
];

export const FOOD: Amenity[] = [
  { id: 'none', name: 'Nothing', emoji: '🚫', desc: 'No complimentary food.', joy: -6, fareBonus: 0, cost: 0 },
  { id: 'pretzels', name: 'Snack Pack', emoji: '🥨', desc: 'Pretzels or crackers.', joy: 0, fareBonus: 0, cost: 0.4 },
  { id: 'sandwich', name: 'Sandwich Box', emoji: '🥪', desc: 'Fresh sandwich and fruit.', joy: 5, fareBonus: 0.03, cost: 3.5 },
  { id: 'hot', name: 'Hot Meal', emoji: '🍝', desc: 'Choice of two hot entrées.', joy: 10, fareBonus: 0.06, cost: 8, requires: 'hot-meals' },
  { id: 'gourmet', name: 'Chef’s Tasting Menu', emoji: '🍣', desc: 'Multi-course menu designed by a guest chef.', joy: 18, fareBonus: 0.13, cost: 24, requires: 'gourmet' },
];

export const DRINKS: Amenity[] = [
  { id: 'water', name: 'Tap Water', emoji: '💧', desc: 'Water only.', joy: -2, fareBonus: 0, cost: 0.1 },
  { id: 'soda', name: 'Soft Drinks', emoji: '🥤', desc: 'Juice and soft drinks.', joy: 2, fareBonus: 0.01, cost: 0.8 },
  { id: 'coffee', name: 'Barista Coffee', emoji: '☕', desc: 'Espresso drinks and premium tea.', joy: 6, fareBonus: 0.03, cost: 2.2, requires: 'hot-meals' },
  { id: 'bar', name: 'Cocktail Bar', emoji: '🍹', desc: 'Full bar service with cocktails.', joy: 11, fareBonus: 0.07, cost: 6, requires: 'gourmet' },
  { id: 'bubbly', name: 'Champagne Service', emoji: '🥂', desc: 'Champagne and fine wines.', joy: 15, fareBonus: 0.1, cost: 12, requires: 'luxury-brand' },
];

export function findAmenity(list: Amenity[], id: string): Amenity {
  return list.find((a) => a.id === id) ?? list[0];
}
