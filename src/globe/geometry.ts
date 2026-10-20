import * as THREE from 'three';
import { greatCircle } from '../game/geo';
import { distanceKm } from '../game/economy';

const D2R = Math.PI / 180;

/** Matches three.js SphereGeometry UVs, so an equirectangular texture lines up. */
export function latLonToVec3(lat: number, lon: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * D2R;
  const theta = (lon + 180) * D2R;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

export function arcHeight(from: string, to: string): number {
  return 0.015 + Math.min(1, distanceKm(from, to) / 15000) * 0.16;
}

/** Point on a lifted great-circle arc between two airports. */
export function arcPoint(from: string, to: string, t: number, height = arcHeight(from, to)): THREE.Vector3 {
  const { lat, lon } = greatCircle(from, to, t);
  return latLonToVec3(lat, lon, 1.004 + Math.sin(Math.PI * t) * height);
}

/** A cute low-poly airliner, nose pointing toward +Z. */
export function buildPlaneMesh(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const accent = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshBasicMaterial({ color: '#1d1a2f' });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.026, 4, 8), body);
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), glass);
  cockpit.position.set(0, 0.0022, 0.014);
  cockpit.scale.set(1, 0.6, 1.4);
  g.add(cockpit);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.006);
  wingShape.lineTo(0.021, -0.004);
  wingShape.lineTo(0.021, -0.008);
  wingShape.lineTo(0, -0.004);
  wingShape.lineTo(-0.021, -0.008);
  wingShape.lineTo(-0.021, -0.004);
  wingShape.closePath();
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.0012, bevelEnabled: false }), accent);
  wing.rotation.x = -Math.PI / 2;
  wing.position.set(0, -0.0008, 0.002);
  g.add(wing);

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0.002);
  tailShape.lineTo(0.008, -0.003);
  tailShape.lineTo(0.008, -0.005);
  tailShape.lineTo(-0.008, -0.005);
  tailShape.lineTo(-0.008, -0.003);
  tailShape.closePath();
  const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(tailShape, { depth: 0.001, bevelEnabled: false }), accent);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -0.012);
  g.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.008, 0.006), accent);
  fin.position.set(0, 0.0045, -0.015);
  fin.rotation.x = -0.35;
  g.add(fin);

  // little glowing halo so planes read at a distance
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.022, 0.0245, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.name = 'halo';
  g.add(halo);

  g.scale.setScalar(1.3);
  return g;
}

export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Rendered on the back faces of a slightly larger sphere: glows strongest at the rim of the Earth. */
export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  void main() {
    float i = pow(clamp(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.5), 4.0);
    gl_FragColor = vec4(uColor, clamp(i * uStrength, 0.0, 1.0));
  }
`;
