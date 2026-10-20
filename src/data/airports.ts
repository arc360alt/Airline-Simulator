export interface Airport {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** 1 = regional strip, 4 = mega hub */
  size: 1 | 2 | 3 | 4;
}

export const AIRPORTS: Airport[] = [
  // North America
  { code: 'JFK', city: 'New York', country: 'USA', lat: 40.64, lon: -73.78, size: 4 },
  { code: 'LAX', city: 'Los Angeles', country: 'USA', lat: 33.94, lon: -118.41, size: 4 },
  { code: 'ORD', city: 'Chicago', country: 'USA', lat: 41.98, lon: -87.9, size: 4 },
  { code: 'ATL', city: 'Atlanta', country: 'USA', lat: 33.64, lon: -84.43, size: 4 },
  { code: 'DFW', city: 'Dallas', country: 'USA', lat: 32.9, lon: -97.04, size: 3 },
  { code: 'DEN', city: 'Denver', country: 'USA', lat: 39.86, lon: -104.67, size: 3 },
  { code: 'SFO', city: 'San Francisco', country: 'USA', lat: 37.62, lon: -122.38, size: 3 },
  { code: 'SEA', city: 'Seattle', country: 'USA', lat: 47.45, lon: -122.31, size: 2 },
  { code: 'MIA', city: 'Miami', country: 'USA', lat: 25.79, lon: -80.29, size: 3 },
  { code: 'BOS', city: 'Boston', country: 'USA', lat: 42.36, lon: -71.01, size: 2 },
  { code: 'EWR', city: 'Newark (NYC)', country: 'USA', lat: 40.69, lon: -74.17, size: 3 },
  { code: 'LGA', city: 'New York LaGuardia', country: 'USA', lat: 40.78, lon: -73.87, size: 2 },
  { code: 'SAN', city: 'San Diego', country: 'USA', lat: 32.73, lon: -117.19, size: 2 },
  { code: 'LAS', city: 'Las Vegas', country: 'USA', lat: 36.08, lon: -115.15, size: 2 },
  { code: 'PHX', city: 'Phoenix', country: 'USA', lat: 33.43, lon: -112.01, size: 2 },
  { code: 'ANC', city: 'Anchorage', country: 'USA', lat: 61.17, lon: -149.99, size: 1 },
  { code: 'HNL', city: 'Honolulu', country: 'USA', lat: 21.32, lon: -157.92, size: 2 },
  { code: 'YYZ', city: 'Toronto', country: 'Canada', lat: 43.68, lon: -79.63, size: 3 },
  { code: 'YVR', city: 'Vancouver', country: 'Canada', lat: 49.19, lon: -123.18, size: 2 },
  { code: 'MEX', city: 'Mexico City', country: 'Mexico', lat: 19.44, lon: -99.07, size: 3 },
  { code: 'CUN', city: 'Cancún', country: 'Mexico', lat: 21.04, lon: -86.87, size: 1 },
  // South America
  { code: 'GRU', city: 'São Paulo', country: 'Brazil', lat: -23.43, lon: -46.47, size: 3 },
  { code: 'GIG', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.81, lon: -43.25, size: 2 },
  { code: 'EZE', city: 'Buenos Aires', country: 'Argentina', lat: -34.82, lon: -58.54, size: 2 },
  { code: 'BOG', city: 'Bogotá', country: 'Colombia', lat: 4.7, lon: -74.15, size: 2 },
  { code: 'LIM', city: 'Lima', country: 'Peru', lat: -12.02, lon: -77.11, size: 2 },
  { code: 'SCL', city: 'Santiago', country: 'Chile', lat: -33.39, lon: -70.79, size: 2 },
  // Europe
  { code: 'LHR', city: 'London', country: 'UK', lat: 51.47, lon: -0.45, size: 4 },
  { code: 'CDG', city: 'Paris', country: 'France', lat: 49.01, lon: 2.55, size: 4 },
  { code: 'FRA', city: 'Frankfurt', country: 'Germany', lat: 50.04, lon: 8.56, size: 3 },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands', lat: 52.31, lon: 4.76, size: 3 },
  { code: 'MAD', city: 'Madrid', country: 'Spain', lat: 40.47, lon: -3.56, size: 3 },
  { code: 'FCO', city: 'Rome', country: 'Italy', lat: 41.8, lon: 12.25, size: 3 },
  { code: 'DUB', city: 'Dublin', country: 'Ireland', lat: 53.42, lon: -6.27, size: 2 },
  { code: 'CPH', city: 'Copenhagen', country: 'Denmark', lat: 55.62, lon: 12.65, size: 2 },
  { code: 'ATH', city: 'Athens', country: 'Greece', lat: 37.94, lon: 23.94, size: 2 },
  { code: 'KEF', city: 'Reykjavík', country: 'Iceland', lat: 63.98, lon: -22.61, size: 1 },
  { code: 'IST', city: 'Istanbul', country: 'Türkiye', lat: 41.26, lon: 28.74, size: 4 },
  // Africa & Middle East
  { code: 'DXB', city: 'Dubai', country: 'UAE', lat: 25.25, lon: 55.36, size: 4 },
  { code: 'DOH', city: 'Doha', country: 'Qatar', lat: 25.27, lon: 51.61, size: 3 },
  { code: 'CAI', city: 'Cairo', country: 'Egypt', lat: 30.12, lon: 31.41, size: 2 },
  { code: 'RAK', city: 'Marrakesh', country: 'Morocco', lat: 31.61, lon: -8.04, size: 1 },
  { code: 'LOS', city: 'Lagos', country: 'Nigeria', lat: 6.58, lon: 3.32, size: 2 },
  { code: 'NBO', city: 'Nairobi', country: 'Kenya', lat: -1.32, lon: 36.93, size: 2 },
  { code: 'JNB', city: 'Johannesburg', country: 'South Africa', lat: -26.14, lon: 28.25, size: 3 },
  { code: 'CPT', city: 'Cape Town', country: 'South Africa', lat: -33.97, lon: 18.6, size: 2 },
  // Asia
  { code: 'DEL', city: 'Delhi', country: 'India', lat: 28.56, lon: 77.1, size: 3 },
  { code: 'BOM', city: 'Mumbai', country: 'India', lat: 19.09, lon: 72.87, size: 3 },
  { code: 'MLE', city: 'Malé', country: 'Maldives', lat: 4.19, lon: 73.53, size: 1 },
  { code: 'SIN', city: 'Singapore', country: 'Singapore', lat: 1.36, lon: 103.99, size: 4 },
  { code: 'BKK', city: 'Bangkok', country: 'Thailand', lat: 13.69, lon: 100.75, size: 3 },
  { code: 'HKG', city: 'Hong Kong', country: 'China', lat: 22.31, lon: 113.91, size: 4 },
  { code: 'PEK', city: 'Beijing', country: 'China', lat: 40.08, lon: 116.58, size: 4 },
  { code: 'PVG', city: 'Shanghai', country: 'China', lat: 31.14, lon: 121.81, size: 3 },
  { code: 'ICN', city: 'Seoul', country: 'South Korea', lat: 37.46, lon: 126.44, size: 3 },
  { code: 'NRT', city: 'Tokyo', country: 'Japan', lat: 35.77, lon: 140.39, size: 4 },
  { code: 'MNL', city: 'Manila', country: 'Philippines', lat: 14.51, lon: 121.02, size: 2 },
  // Oceania
  { code: 'SYD', city: 'Sydney', country: 'Australia', lat: -33.95, lon: 151.18, size: 3 },
  { code: 'MEL', city: 'Melbourne', country: 'Australia', lat: -37.67, lon: 144.84, size: 2 },
  { code: 'PER', city: 'Perth', country: 'Australia', lat: -31.94, lon: 115.97, size: 1 },
  { code: 'AKL', city: 'Auckland', country: 'New Zealand', lat: -37.01, lon: 174.79, size: 2 },
  { code: 'PPT', city: 'Papeete', country: 'French Polynesia', lat: -17.55, lon: -149.61, size: 1 },
];

export const AIRPORT_BY_CODE: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.code, a]),
);

export const SIZE_LABEL = ['', 'Regional', 'Domestic', 'International', 'Mega Hub'];
export const SIZE_PRICE = [0, 60_000, 150_000, 350_000, 600_000];
export const SIZE_DEMAND = [0, 0.78, 0.9, 1.0, 1.1];

/** Airports that make strong home bases, with the reason shown to the player. */
export const RECOMMENDED_HUBS: { code: string; why: string }[] = [
  { code: 'ORD', why: 'Middle of the US: short hops to both coasts' },
  { code: 'JFK', why: 'New York: the busiest transatlantic gateway' },
  { code: 'EWR', why: 'New York: cheaper than JFK, same market' },
  { code: 'LAX', why: 'California: gateway to Asia and the Pacific' },
  { code: 'SFO', why: 'California: rich business routes to Asia' },
  { code: 'ATL', why: 'Huge domestic network across the US South' },
  { code: 'DFW', why: 'Central US with easy reach of Mexico' },
  { code: 'LHR', why: 'London: links Europe and North America' },
  { code: 'FRA', why: 'Heart of Europe, dense short-haul network' },
  { code: 'DXB', why: 'Halfway between Europe, Africa and Asia' },
  { code: 'SIN', why: 'Southeast Asia and Australia within reach' },
  { code: 'NRT', why: 'Tokyo: big market, Pacific crossings' },
];
