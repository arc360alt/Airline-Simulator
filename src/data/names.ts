const FIRST = [
  'Ava', 'Bo', 'Cass', 'Dev', 'Eli', 'Fen', 'Gia', 'Hal', 'Ines', 'Jun', 'Kit', 'Lu', 'Mo', 'Nia',
  'Oz', 'Pia', 'Quin', 'Rae', 'Sol', 'Tam', 'Uma', 'Vic', 'Wren', 'Xan', 'Yuki', 'Zed', 'Amir',
  'Bea', 'Cruz', 'Dara', 'Emre', 'Fatou', 'Goran', 'Hana', 'Ivo', 'Jade', 'Kofi', 'Lena', 'Mateo',
  'Noor', 'Olu', 'Priya', 'Rafa', 'Sana', 'Tomas', 'Ula', 'Vera', 'Wes', 'Ximena', 'Yara', 'Zuri',
];

const LAST = [
  'Okafor', 'Nakamura', 'Lindqvist', 'Moreau', 'Haddad', 'Ramos', 'Kowalski', 'Chen', 'Patel', 'Nguyen',
  'Mbeki', 'Silva', 'Ivanova', 'Kim', 'Rossi', 'Novak', 'Dubois', 'Hart', 'Fontaine', 'Abara', 'Sato',
  'Varga', 'Oyelaran', 'Andersen', 'Morales', 'Schmidt', 'Walsh', 'Kaur', 'Reyes', 'Tanaka', 'Müller',
  'O’Brien', 'Johansson', 'Costa', 'Mensah', 'Rahman', 'Park', 'Bianchi', 'Hughes', 'Larsen',
];

const TRAITS = [
  'Exceptionally smooth landings', 'Calm under pressure', 'Former air force', 'Perfect on-time record',
  'Speaks four languages', 'Detail-oriented', 'Former flight instructor', 'Great with nervous flyers',
  'Night-flight specialist', 'Long-haul veteran', 'Strong safety record', 'Fast learner',
  'Excellent crew leader', 'Mountain-airport certified', 'Customer-service award winner',
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomName(): string {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

export function randomTrait(): string {
  return pick(TRAITS);
}

const AVATAR_COLORS = ['#4fd1ff', '#ffb547', '#3ddc97', '#a78bfa', '#ff7a8a', '#5eead4', '#fbbf24', '#93c5fd'];
export function randomAvatarColor(): string {
  return pick(AVATAR_COLORS);
}

const PLANE_NICKNAMES = [
  'Meridian', 'Northern Star', 'Aurora', 'Horizon', 'Atlas', 'Zephyr', 'Polaris', 'Vega', 'Sirocco',
  'Cirrus', 'Halcyon', 'Odyssey', 'Equinox', 'Solstice', 'Orion', 'Mistral', 'Endeavour', 'Voyager',
  'Pathfinder', 'Spirit of Discovery', 'Silver Arrow', 'Altair', 'Sierra', 'Monsoon',
];
export function randomPlaneName(): string {
  return pick(PLANE_NICKNAMES);
}
