import * as THREE from 'three';
import { feature } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Position } from 'geojson';
import land110 from 'world-atlas/land-110m.json';
import { latLonToVec3 } from './geometry';

/**
 * Resolution-independent Earth layers.
 *
 * Instead of painting everything into one big texture (which turns blocky when
 * you zoom in), each layer is drawn the way it stays sharp:
 *  - coastlines, graticule: real 3D line geometry
 *  - land dots: point geometry
 *  - land fill: a land/sea mask sampled with a threshold in the shader, so the
 *    edge is computed per pixel and stays smooth at any zoom
 */

export type Detail = 'low' | 'medium' | 'high';
type LandTopo = Topology<{ land: GeometryCollection }>;
const cache = new Map<Detail, FeatureCollection>();

function toFeatures(topo: LandTopo): FeatureCollection {
  return feature(topo, topo.objects.land) as unknown as FeatureCollection;
}

/** 110m is bundled for an instant first paint; 50m and 10m are fetched on demand. */
export async function loadLand(detail: Detail): Promise<FeatureCollection> {
  if (!cache.has(detail)) {
    const topo =
      detail === 'low' ? land110
      : detail === 'medium' ? (await import('world-atlas/land-50m.json')).default
      : (await import('world-atlas/land-10m.json')).default;
    cache.set(detail, toFeatures(topo as unknown as LandTopo));
  }
  return cache.get(detail)!;
}

export function landNow(): FeatureCollection {
  if (!cache.has('low')) cache.set('low', toFeatures(land110 as unknown as LandTopo));
  return cache.get('low')!;
}

/** White-on-black equirectangular land mask (anti-aliased), used by the earth shader. */
export function paintLandMask(land: FeatureCollection, width: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width / 2;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const projection = geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, width / 4]);
  ctx.beginPath();
  geoPath(projection, ctx)(land);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return canvas;
}

function rings(land: FeatureCollection): Position[][] {
  const out: Position[][] = [];
  for (const f of land.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') out.push(...g.coordinates);
    else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) out.push(...poly);
  }
  return out;
}

/** Segment pairs (x,y,z,x,y,z…) for every coastline, lifted just above the surface. */
export function coastlinePositions(land: FeatureCollection, radius = 1.0006): Float32Array {
  const pts: number[] = [];
  const v = new THREE.Vector3();
  const push = (lon: number, lat: number) => {
    v.copy(latLonToVec3(lat, lon, radius));
    pts.push(v.x, v.y, v.z);
  };
  for (const ring of rings(land)) {
    for (let i = 1; i < ring.length; i++) {
      const [lon0, lat0] = ring[i - 1];
      const [lon1, lat1] = ring[i];
      // skip the artificial edges that run along the antimeridian / poles
      if (Math.abs(lon1 - lon0) > 180) continue;
      // long edges are subdivided so they follow the sphere instead of cutting through it
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon1 - lon0), Math.abs(lat1 - lat0)) / 1.5));
      for (let s = 0; s < steps; s++) {
        const a = s / steps;
        const b = (s + 1) / steps;
        push(lon0 + (lon1 - lon0) * a, lat0 + (lat1 - lat0) * a);
        push(lon0 + (lon1 - lon0) * b, lat0 + (lat1 - lat0) * b);
      }
    }
  }
  return new Float32Array(pts);
}

/** Lat/lon grid lines every 10°, as line segments. */
export function graticulePositions(radius = 1.0003): Float32Array {
  const pts: number[] = [];
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lon = -180; lon < 180; lon += 10) {
    for (let lat = -80; lat < 80; lat += 2) seg(latLonToVec3(lat, lon, radius), latLonToVec3(lat + 2, lon, radius));
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    for (let lon = -180; lon < 180; lon += 2) seg(latLonToVec3(lat, lon, radius), latLonToVec3(lat, lon + 2, radius));
  }
  return new Float32Array(pts);
}

/** A 1° dot grid (spaced evenly on the sphere), kept only where the mask says land. */
export function landDotPositions(mask: HTMLCanvasElement, radius = 1.0004): Float32Array {
  const ctx = mask.getContext('2d')!;
  const { width, height } = mask;
  const data = ctx.getImageData(0, 0, width, height).data;
  const pts: number[] = [];
  for (let lat = -89.5; lat < 90; lat += 1) {
    const step = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    for (let lon = -180; lon < 180; lon += step) {
      const x = Math.floor(((lon + 180) / 360) * width);
      const y = Math.floor(((90 - lat) / 180) * height);
      if (data[(y * width + x) * 4] > 128) {
        const v = latLonToVec3(lat, lon, radius);
        pts.push(v.x, v.y, v.z);
      }
    }
  }
  return new Float32Array(pts);
}

/** Round, anti-aliased sprite for the land dots. */
export function dotSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fillStyle = '#fff';
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const earthFragment = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec3 uOcean;
  uniform vec3 uOceanDeep;
  uniform vec3 uLand;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    // threshold the bilinearly-filtered mask: the coastline edge is resolved per
    // pixel, so it stays smooth however far you zoom in
    float m = texture2D(uMask, vUv).r;
    float w = max(fwidth(m), 0.0001);
    float land = smoothstep(0.5 - w, 0.5 + w, m);
    vec3 ocean = mix(uOceanDeep, uOcean, 1.0 - abs(vUv.y - 0.5) * 2.0);
    vec3 col = mix(ocean, uLand, land);
    // lights follow the camera, so the side you look at is always lit
    float light = 0.78 + 0.22 * max(dot(vNormal, normalize(vec3(-0.35, 0.45, 1.0))), 0.0);
    gl_FragColor = vec4(col * light, 1.0);
    #include <colorspace_fragment>
  }
`;
