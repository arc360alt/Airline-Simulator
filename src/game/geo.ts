import { AIRPORT_BY_CODE } from '../data/airports';

export interface LatLon {
  lat: number;
  lon: number;
}

const D2R = Math.PI / 180;

function toVec(lat: number, lon: number): [number, number, number] {
  const la = lat * D2R;
  const lo = lon * D2R;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** Point along the great circle between two airports, t in 0..1 */
export function greatCircle(from: string, to: string, t: number): LatLon {
  const A = AIRPORT_BY_CODE[from];
  const B = AIRPORT_BY_CODE[to];
  const a = toVec(A.lat, A.lon);
  const b = toVec(B.lat, B.lon);
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return { lat: A.lat, lon: A.lon };
  const s = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / s;
  const k2 = Math.sin(t * omega) / s;
  const x = a[0] * k1 + b[0] * k2;
  const y = a[1] * k1 + b[1] * k2;
  const z = a[2] * k1 + b[2] * k2;
  return { lat: Math.asin(z) / D2R, lon: Math.atan2(y, x) / D2R };
}
