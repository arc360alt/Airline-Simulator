import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { AIRPORTS, AIRPORT_BY_CODE } from '../data/airports';
import { MODEL_BY_ID } from '../data/planes';
import type { GameState } from '../game/types';
import { settings } from '../game/state';
import { globePalette } from '../ui/theme';
import {
  coastlinePositions, dotSprite, earthFragment, earthVertex, graticulePositions, landDotPositions,
  landNow, loadLand, paintLandMask, type Detail,
} from './earth';
import { arcHeight, arcPoint, atmosphereFragment, atmosphereVertex, buildPlaneMesh, latLonToVec3 } from './geometry';

export interface PlaneHover {
  planeId: string;
  x: number;
  y: number;
}

interface Effect {
  mesh: THREE.Mesh;
  born: number;
}

const DEFAULT_DISTANCE = 3.3;
/** Zoom in closer than this (camera distance from the centre) and the 10m coastline is loaded. */
const HIGH_DETAIL_DISTANCE = 1.9;

export class Globe {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private earth: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points;
  private coast: LineSegments2;
  private coastMat: LineMaterial;
  private graticule: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private dots: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private airportsGroup = new THREE.Group();
  private routesGroup = new THREE.Group();
  private planesGroup = new THREE.Group();
  private fxGroup = new THREE.Group();
  private planeMeshes = new Map<string, THREE.Group>();
  private arcMaterials: LineMaterial[] = [];
  private effects: Effect[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-10, -10);
  private downAt = { x: 0, y: 0 };
  private flyTo: { dir: THREE.Vector3 } | null = null;
  private lastFrame = performance.now();
  private lastWorldKey = '';
  private lastAirline = '';
  private hubRing: THREE.Mesh | null = null;
  private selected: string | null = null;
  private detail: Detail | null = null;
  private loadingDetail: Detail | null = null;

  onAirportClick: (code: string) => void = () => {};
  onPlaneClick: (planeId: string) => void = () => {};
  onPlaneHover: (hover: PlaneHover | null) => void = () => {};

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'globe-labels';
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.005, 100);
    this.camera.position.copy(latLonToVec3(30, -40, DEFAULT_DISTANCE));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.25;
    this.controls.maxDistance = 6;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.7;
    this.controls.autoRotateSpeed = 0.35;

    // lights follow the camera, so the side you look at is always lit (planes & markers)
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-2, 2, 4);
    this.camera.add(key);
    this.scene.add(this.camera);

    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 192, 128),
      new THREE.ShaderMaterial({
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
        uniforms: {
          uMask: { value: null },
          uOcean: { value: new THREE.Color() },
          uOceanDeep: { value: new THREE.Color() },
          uLand: { value: new THREE.Color() },
        },
      }),
    );
    this.scene.add(this.earth);

    this.graticule = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(graticulePositions(), 3)),
      new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }),
    );
    this.scene.add(this.graticule);

    this.dots = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ size: 0.006, map: dotSprite(), transparent: true, alphaTest: 0.05, depthWrite: false }),
    );
    this.scene.add(this.dots);

    this.coastMat = new LineMaterial({ linewidth: 1.4, transparent: true, depthWrite: false });
    this.coast = new LineSegments2(new LineSegmentsGeometry(), this.coastMat);
    this.scene.add(this.coast);

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: { uColor: { value: new THREE.Color() }, uStrength: { value: 1 } },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.scene.add(this.atmosphere);

    this.stars = this.makeStars();
    this.scene.add(this.stars);

    this.scene.add(this.airportsGroup, this.routesGroup, this.planesGroup, this.fxGroup);

    this.bindPointer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.useLand('low', landNow());
    this.applyTheme();
  }

  private pixelRatio(): number {
    return Math.min(window.devicePixelRatio, settings.quality === 'high' ? 2 : 1);
  }

  private makeStars(): THREE.Points {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(25 + Math.random() * 20);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
  }

  /**
   * Swap in a coastline dataset: rebuild the land mask, coastline lines and land dots.
   * `fillLand` drives the mask & dots and defaults to `land`; the 10m set is only
   * used for the crisp coastline lines (a 4096px mask can't hold more detail, and
   * that dataset's winding makes the raster fill cover the whole globe).
   */
  private useLand(detail: Detail, land: ReturnType<typeof landNow>, fillLand = land): void {
    this.detail = detail;
    const mask = paintLandMask(fillLand, detail === 'low' ? 2048 : 4096);
    const tex = new THREE.CanvasTexture(mask);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const old = this.earth.material.uniforms.uMask.value as THREE.Texture | null;
    this.earth.material.uniforms.uMask.value = tex;
    old?.dispose();

    const coastGeo = new LineSegmentsGeometry().setPositions(coastlinePositions(land));
    this.coast.geometry.dispose();
    this.coast.geometry = coastGeo;

    this.dots.geometry.dispose();
    this.dots.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(landDotPositions(mask), 3));
  }

  /** Load a more detailed coastline in the background (no-op if already shown or loading). */
  private upgradeLand(detail: Detail): void {
    const rank = { low: 0, medium: 1, high: 2 };
    if (this.loadingDetail || (this.detail && rank[this.detail] >= rank[detail])) return;
    this.loadingDetail = detail;
    void Promise.all([loadLand(detail), loadLand(detail === 'high' ? 'medium' : detail)])
      .then(([land, fill]) => this.useLand(detail, land, fill))
      .finally(() => (this.loadingDetail = null));
  }

  /** Recolour everything that depends on light/dark mode, accent or quality. */
  applyTheme(): void {
    const pal = globePalette();
    const u = this.earth.material.uniforms;
    u.uOcean.value.set(pal.ocean);
    u.uOceanDeep.value.set(pal.oceanDeep);
    u.uLand.value.set(pal.land);
    this.coastMat.color.set(pal.coast);
    this.coastMat.opacity = pal.coastAlpha;
    this.graticule.material.color.set(pal.grid);
    this.graticule.material.opacity = pal.gridAlpha;
    this.dots.material.color.set(pal.landDot);
    this.dots.material.opacity = pal.landDotAlpha;
    this.atmosphere.material.uniforms.uColor.value.set(pal.atmosphere);
    this.atmosphere.material.uniforms.uStrength.value = pal.stars ? 1.2 : 1.6;
    this.atmosphere.material.blending = pal.stars ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.stars.visible = pal.stars;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.resize();
    if (settings.quality === 'high') this.upgradeLand('medium');
    this.lastWorldKey = ''; // force markers/arcs to rebuild with new colours
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    // pull back a bit on narrow/portrait screens so the whole globe fits
    this.camera.fov = w < h ? 55 : 40;
    this.camera.updateProjectionMatrix();
    // screen-space line widths need the real drawing-buffer size
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    for (const m of [this.coastMat, ...this.arcMaterials]) m.resolution.copy(size);
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    });
    el.addEventListener('pointerleave', () => {
      this.pointer.set(-10, -10);
      this.onPlaneHover(null);
    });
    el.addEventListener('pointerdown', (e) => {
      this.downAt = { x: e.clientX, y: e.clientY };
      this.flyTo = null;
    });
    el.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 5) return;
      const hit = this.pick();
      if (hit?.type === 'airport') this.onAirportClick(hit.id);
      if (hit?.type === 'plane') this.onPlaneClick(hit.id);
    });
  }

  private pick(): { type: 'airport' | 'plane'; id: string } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const planeHits = this.raycaster.intersectObjects(this.planesGroup.children, true);
    for (const h of planeHits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.planeId) o = o.parent;
      if (o) return { type: 'plane', id: o.userData.planeId };
    }
    const hits = this.raycaster.intersectObjects([this.earth, ...this.airportsGroup.children], false);
    const first = hits[0];
    if (first && first.object.userData.code) return { type: 'airport', id: first.object.userData.code };
    return null;
  }

  focus(code: string, select = true): void {
    const a = AIRPORT_BY_CODE[code];
    if (!a) return;
    if (select) this.selected = code;
    this.flyTo = { dir: latLonToVec3(a.lat, a.lon).normalize() };
    this.lastWorldKey = '';
  }

  explode(lat: number, lon: number): void {
    const pos = latLonToVec3(lat, lon, 1.01);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.01, 0.018, 32),
        new THREE.MeshBasicMaterial({ color: i === 0 ? '#ffb547' : '#ff5d6c', transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      this.fxGroup.add(ring);
      this.effects.push({ mesh: ring, born: performance.now() + i * 250 });
    }
  }

  /**
   * How big markers and planes should be relative to the default view. Scaling
   * with the camera's height above the surface keeps them a steady size on
   * screen instead of ballooning when you zoom in.
   */
  private zoomScale(): number {
    return THREE.MathUtils.clamp((this.camera.position.length() - 1) / (DEFAULT_DISTANCE - 1), 0.12, 1.8);
  }

  /** Rebuild airport markers and route arcs if anything relevant changed. */
  private syncWorld(s: GameState): void {
    const key = [
      s.owned.join(','),
      s.routes.map((r) => r.id).join(','),
      settings.showAllAirports, settings.showArcs, settings.showLabels,
      s.airline.color, s.airline.hub, this.selected,
    ].join('|');
    if (key === this.lastWorldKey) return;
    this.lastWorldKey = key;
    const pal = globePalette();

    for (const child of [...this.airportsGroup.children]) {
      child.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
      });
      this.airportsGroup.remove(child);
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    const ownedMat = new THREE.MeshLambertMaterial({ color: s.airline.color });
    const otherMat = new THREE.MeshBasicMaterial({ color: pal.airport, transparent: true, opacity: 0.75 });
    const selMat = new THREE.MeshBasicMaterial({ color: '#ffb547' });

    for (const a of AIRPORTS) {
      const owned = s.owned.includes(a.code);
      if (!owned && !settings.showAllAirports && a.code !== this.selected) continue;
      const pos = latLonToVec3(a.lat, a.lon, 1);
      const up = pos.clone().normalize();
      const isSel = a.code === this.selected;
      const pinHeight = 0.035 + a.size * 0.006;
      // geometry origin sits on the ground so the marker scales from its base
      const geo = owned
        ? new THREE.CylinderGeometry(0.009, 0.004, pinHeight, 10).translate(0, pinHeight / 2, 0)
        : new THREE.SphereGeometry(0.004 + a.size * 0.0013, 10, 8);
      const marker = new THREE.Mesh(geo, isSel ? selMat : owned ? ownedMat : otherMat);
      marker.position.copy(pos);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      marker.userData.code = a.code;
      marker.userData.scalable = true;
      // invisible fat hit-target so tiny markers are easy to click
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(pos);
      hit.userData.code = a.code;
      hit.userData.scalable = true;
      this.airportsGroup.add(marker, hit);

      if (settings.showLabels && (owned || isSel)) {
        const el = document.createElement('div');
        el.className = `globe-label${owned ? ' owned' : ''}${isSel ? ' selected' : ''}`;
        el.textContent = a.code;
        const label = new CSS2DObject(el);
        label.position.set(0, (owned ? pinHeight : 0.008) + 0.01, 0); // local to the marker, whose +Y points away from Earth
        marker.add(label);
      }
    }

    // hub ring
    if (this.hubRing) this.scene.remove(this.hubRing);
    const hub = AIRPORT_BY_CODE[s.airline.hub];
    const hubPos = latLonToVec3(hub.lat, hub.lon, 1.002);
    this.hubRing = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.036, 48),
      new THREE.MeshBasicMaterial({ color: s.airline.color, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.hubRing.position.copy(hubPos);
    this.hubRing.lookAt(hubPos.clone().multiplyScalar(2));
    this.scene.add(this.hubRing);

    // route arcs: screen-space dashed lines, so they stay thin and crisp at any zoom
    for (const child of [...this.routesGroup.children]) {
      this.routesGroup.remove(child);
      (child as Line2).geometry.dispose();
    }
    this.arcMaterials.forEach((m) => m.dispose());
    this.arcMaterials = [];
    if (settings.showArcs) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      for (const r of s.routes) {
        const pts: number[] = [];
        for (let i = 0; i <= 128; i++) {
          const p = arcPoint(r.from, r.to, i / 128);
          pts.push(p.x, p.y, p.z);
        }
        const mat = new LineMaterial({
          color: new THREE.Color(pal.arc).getHex(),
          linewidth: 1.8,
          transparent: true,
          opacity: 0.9,
          dashed: true,
          dashSize: 0.012,
          gapSize: 0.008,
          depthWrite: false,
        });
        mat.resolution.copy(size);
        this.arcMaterials.push(mat);
        const line = new Line2(new LineGeometry().setPositions(pts), mat);
        line.computeLineDistances();
        this.routesGroup.add(line);
      }
    }

    // repaint plane colours if the livery changed
    if (s.airline.color !== this.lastAirline) {
      this.lastAirline = s.airline.color;
      for (const mesh of this.planeMeshes.values()) this.planesGroup.remove(mesh);
      this.planeMeshes.clear();
    }
  }

  private syncPlanes(s: GameState, zoom: number): void {
    const flying = new Set<string>();
    for (const p of s.planes) {
      if (p.status !== 'flying' || !p.leg) continue;
      flying.add(p.id);
      let mesh = this.planeMeshes.get(p.id);
      if (!mesh) {
        mesh = buildPlaneMesh(s.airline.color);
        mesh.userData.planeId = p.id;
        // tint the wing colour to the model so mixed fleets are fun to look at
        const accent = (mesh.children[2] as THREE.Mesh).material as THREE.MeshLambertMaterial;
        accent.color.set(MODEL_BY_ID[p.modelId].color).lerp(new THREE.Color(s.airline.color), 0.5);
        this.planeMeshes.set(p.id, mesh);
        this.planesGroup.add(mesh);
      }
      const leg = p.leg;
      const t = Math.max(0, Math.min(1, (s.time - leg.depart) / (leg.arrive - leg.depart)));
      const height = arcHeight(leg.from, leg.to);
      const pos = arcPoint(leg.from, leg.to, t, height);
      const ahead = arcPoint(leg.from, leg.to, Math.min(1, t + 0.01), height);
      if (t >= 0.99) ahead.copy(pos).add(pos.clone().sub(arcPoint(leg.from, leg.to, t - 0.01, height)));
      mesh.position.copy(pos);
      mesh.up.copy(pos).normalize();
      mesh.lookAt(ahead);
      mesh.scale.setScalar(1.6 * zoom);
    }
    for (const [id, mesh] of this.planeMeshes) {
      if (!flying.has(id)) {
        this.planesGroup.remove(mesh);
        this.planeMeshes.delete(id);
      }
    }
  }

  private hideBacksideLabels(): void {
    const camDir = this.camera.position.clone().normalize();
    this.airportsGroup.traverse((o) => {
      if (o instanceof CSS2DObject) {
        const n = (o.parent as THREE.Object3D).position.clone().normalize();
        o.visible = n.dot(camDir) > 0.15;
      }
    });
  }

  frame(s: GameState | null): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const zoom = this.zoomScale();
    if (s) {
      this.syncWorld(s);
      this.syncPlanes(s, zoom);
    }

    for (const child of this.airportsGroup.children) if (child.userData.scalable) child.scale.setScalar(zoom);
    for (const m of this.arcMaterials) {
      // keep dashes the same length on screen at every zoom level
      m.dashScale = 1 / zoom;
      m.dashOffset -= dt * 0.02;
    }
    if (this.hubRing) {
      const k = (now / 1400) % 1;
      this.hubRing.scale.setScalar((1 + k * 1.2) * zoom);
      (this.hubRing.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }
    for (const mesh of this.planeMeshes.values()) {
      const halo = mesh.getObjectByName('halo');
      if (halo) halo.scale.setScalar(1 + Math.sin(now / 300) * 0.15);
    }

    this.effects = this.effects.filter((fx) => {
      const age = (now - fx.born) / 2600;
      if (age < 0) return true;
      fx.mesh.scale.setScalar(1 + age * 9);
      (fx.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age);
      if (age >= 1) {
        this.fxGroup.remove(fx.mesh);
        return false;
      }
      return true;
    });

    if (this.flyTo) {
      // ease toward the target; framerate-independent and finishes when it arrives
      const k = 1 - Math.pow(0.012, dt);
      const dist = this.camera.position.length();
      const goal = Math.min(dist, 2.6);
      const dir = this.camera.position.clone().normalize().lerp(this.flyTo.dir, k).normalize();
      this.camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(dist, goal, k)));
      if (dir.normalize().angleTo(this.flyTo.dir) < 0.002 && Math.abs(dist - goal) < 0.01) this.flyTo = null;
    }

    // fetch the most detailed coastline once the player zooms in close
    if (settings.quality === 'high' && this.camera.position.length() < HIGH_DETAIL_DISTANCE) this.upgradeLand('high');

    this.controls.autoRotate = settings.autoRotate && !this.flyTo;
    // rotate more gently when close to the surface
    this.controls.rotateSpeed = 0.15 + 0.35 * Math.min(1, zoom);
    this.controls.update();
    this.hideBacksideLabels();

    // hover tooltips for planes
    const hit = this.pointer.x > -2 ? this.pick() : null;
    if (hit?.type === 'plane') {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.onPlaneHover({
        planeId: hit.id,
        x: ((this.pointer.x + 1) / 2) * r.width + r.left,
        y: ((1 - this.pointer.y) / 2) * r.height + r.top,
      });
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.onPlaneHover(null);
      this.renderer.domElement.style.cursor = hit?.type === 'airport' ? 'pointer' : 'grab';
    }

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}
