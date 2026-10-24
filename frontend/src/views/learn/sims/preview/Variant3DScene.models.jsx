import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import {
  CHINOR,
  GARAGE,
  GARAGE_TRACK,
  POND,
  RIVER,
  ROAD,
  STADIUM,
  TOWN,
  TOWN_M,
  STADIUM_M,
  paintClock,
  paintFade,
  paintStadium,
  paintStripes,
  paintWaterfall,
  rng,
} from './Variant3DScene.world';

/**
 * Everything static in variant C is built here from three.js primitives and
 * merged into a handful of meshes - a whole town of houses, poplars and
 * fields is four draw calls, which is what keeps it smooth on a phone.
 */

export const GRASS = '#86b84b';
const SOIL = '#a07a52';
const TRUNK = '#7a5235';
const LEAF = ['#4f9a3a', '#5fae46', '#468f36', '#6cb84f'];
const POPLAR = ['#3f7d32', '#4a8c38', '#3a7430'];
const WALLS = ['#f3e3c3', '#ead7b2', '#f7efe1', '#dcc196', '#efe0c4'];
const ROOF_FLAT = ['#9b7653', '#8c6a4a', '#a8865f'];
const ROOF_PITCH = ['#c0583c', '#3d7f8c', '#b4532f', '#64748b'];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Collects coloured primitives under a movable "group" transform and merges them. */
class Kit {
  constructor({ uv = false } = {}) {
    this.parts = [];
    this.uv = uv;
    this.group = new THREE.Matrix4();
  }

  at(x, z, ry = 0, y = 0) {
    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(1, 1, 1);
    this.group.compose(_p, _q, _s);
    return this;
  }

  reset() {
    this.group.identity();
    return this;
  }

  push(geo, color, x = 0, y = 0, z = 0, o = {}) {
    let g = geo;
    if (g.index) {
      g = geo.toNonIndexed();
      geo.dispose();
    }
    if (!this.uv && g.attributes.uv) g.deleteAttribute('uv');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _m.compose(_p, _q, _s).premultiply(this.group);
    g.applyMatrix4(_m);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    if (typeof color === 'function') {
      for (let i = 0; i < pos.count; i += 1) {
        color(pos.getX(i), pos.getY(i), pos.getZ(i), _c);
        col[i * 3] = _c.r;
        col[i * 3 + 1] = _c.g;
        col[i * 3 + 2] = _c.b;
      }
    } else {
      _c.set(color);
      for (let i = 0; i < pos.count; i += 1) {
        col[i * 3] = _c.r;
        col[i * 3 + 1] = _c.g;
        col[i * 3 + 2] = _c.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return g;
  }

  box(w, h, d, x, y, z, color, o) {
    return this.push(new THREE.BoxGeometry(w, h, d), color, x, y, z, o);
  }

  build() {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

const hash = (x, y, z) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

/* ------------------------------------------------------------------ */
/* Ribbons: roads, rivers, trails                                      */
/* ------------------------------------------------------------------ */

/** Writes a flat strip `width` wide along `pts`, shifted `offset` to the right of travel. */
export function writeRibbon(pos, pts, width, y, offset = 0) {
  const n = pts.length;
  const hw = width / 2;
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const nx = -tz;
    const nz = tx;
    const ox = p[0] + nx * offset;
    const oz = p[1] + nz * offset;
    pos[i * 6] = ox + nx * hw;
    pos[i * 6 + 1] = y;
    pos[i * 6 + 2] = oz + nz * hw;
    pos[i * 6 + 3] = ox - nx * hw;
    pos[i * 6 + 4] = y;
    pos[i * 6 + 5] = oz - nz * hw;
  }
}

export function ribbonGeometry(pts, width, y = 0, offset = 0) {
  const n = pts.length;
  const pos = new Float32Array(n * 6);
  const nor = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  writeRibbon(pos, pts, width, y, offset);
  for (let i = 0; i < n * 2; i += 1) nor[i * 3 + 1] = 1;
  for (let i = 0; i < n; i += 1) {
    uv[i * 4] = i / Math.max(1, n - 1);
    uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = i / Math.max(1, n - 1);
    uv[i * 4 + 3] = 1;
  }
  const idx = [];
  for (let i = 0; i < n - 1; i += 1) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function subPoints(track, d0, d1, step = 0.3) {
  const out = [];
  const n = Math.max(2, Math.ceil((d1 - d0) / step) + 1);
  for (let i = 0; i < n; i += 1) {
    const p = track.point(d0 + ((d1 - d0) * i) / (n - 1));
    out.push([p.x, p.z]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Islands                                                              */
/* ------------------------------------------------------------------ */

function roundedRect(hx, hz, r) {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);
  s.quadraticCurveTo(hx, -hz, hx, -hz + r);
  s.lineTo(hx, hz - r);
  s.quadraticCurveTo(hx, hz, hx - r, hz);
  s.lineTo(-hx + r, hz);
  s.quadraticCurveTo(-hx, hz, -hx, hz - r);
  s.lineTo(-hx, -hz + r);
  s.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
  return s;
}

/** A grass-topped slab with soil sides; the top sits at y = 0. */
function islandGeometry(hx, hz, r) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(hx, hz, r), {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.6,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.rotateX(Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.max.y, 0);
  geo.computeBoundingBox();
  return geo;
}

/** The rocky underside that makes it a floating island. */
function rockGeometry(hx, hz, top, depth, seed) {
  const R = rng(seed);
  const k = new Kit();
  const shade = (y0, d) => (x, y, z, out) => {
    const t = Math.min(1, Math.max(0, (y0 - y) / d));
    out.set('#8a6a4c').lerp(_tmpColor.set('#3a2f2a'), t);
  };
  const cone = (rx, rz, d, x, z, segs) => {
    const geo = new THREE.ConeGeometry(1, 1, segs, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      if (y > 0.49 || y < -0.49) continue;
      const j = 1 + (hash(pos.getX(i), y, pos.getZ(i)) - 0.5) * 0.45;
      pos.setX(i, pos.getX(i) * j);
      pos.setZ(i, pos.getZ(i) * j);
    }
    geo.rotateY(R() * 6);
    geo.computeVertexNormals();
    k.push(geo, shade(top, d), x, top - d / 2, z, { rx: Math.PI, sx: rx, sy: d, sz: rz });
  };
  cone(hx * 0.9, hz * 0.86, depth, 0, 0, 12);
  cone(hx * 0.32, hz * 0.34, depth * 0.55, -hx * 0.55, hz * 0.3, 8);
  cone(hx * 0.28, hz * 0.3, depth * 0.48, hx * 0.58, -hz * 0.25, 8);
  cone(hx * 0.22, hz * 0.26, depth * 0.4, hx * 0.3, hz * 0.55, 7);
  return k.build();
}
const _tmpColor = new THREE.Color();

function islandMaterials() {
  return {
    grass: new THREE.MeshStandardMaterial({ color: GRASS, roughness: 1 }),
    soil: new THREE.MeshStandardMaterial({ color: SOIL, roughness: 1, flatShading: true }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    flat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
    smooth: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Little things the town is made of                                    */
/* ------------------------------------------------------------------ */

function pick(R, list) {
  return list[Math.floor(R() * list.length) % list.length];
}

function poplar(k, R, x, z, s = 1) {
  k.reset();
  const h = (3.3 + R() * 1.5) * s;
  k.push(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 5), TRUNK, x, 0.35, z);
  k.push(new THREE.ConeGeometry(0.62 * s, h, 6), pick(R, POPLAR), x, 0.55 + h / 2, z, { ry: R() * 3 });
}

function roundTree(k, R, x, z, s = 1) {
  k.reset();
  k.push(new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 0.9 * s, 5), TRUNK, x, 0.45 * s, z);
  k.push(new THREE.IcosahedronGeometry(1.05 * s, 0), pick(R, LEAF), x, 1.62 * s, z, { sy: 0.88, ry: R() * 3 });
}

function chinorTree(k, x, z) {
  k.reset();
  k.push(new THREE.CylinderGeometry(0.32, 0.6, 2.8, 7), '#6f4a2e', x, 1.4, z);
  k.push(new THREE.IcosahedronGeometry(2.5, 0), '#3f8f3a', x, 4.1, z, { ry: 0.4 });
  k.push(new THREE.IcosahedronGeometry(1.9, 0), '#4b9c40', x + 1.5, 3.5, z + 0.7, { ry: 1.1 });
  k.push(new THREE.IcosahedronGeometry(1.8, 0), '#378235', x - 1.4, 3.6, z - 0.8, { ry: 2.2 });
  k.push(new THREE.IcosahedronGeometry(1.5, 0), '#52a646', x + 0.2, 5.4, z - 0.3, { ry: 0.7 });
}

function house(k, R, x, z, ry, kind) {
  k.at(x, z, ry);
  const w = 2.3 + R() * 1.3;
  const d = 2.1 + R() * 1.1;
  const h = 1.1 + R() * 0.5;
  k.box(w, h, d, 0, h / 2, 0, pick(R, WALLS));
  if (kind === 'flat') {
    k.box(w + 0.3, 0.16, d + 0.3, 0, h + 0.08, 0, pick(R, ROOF_FLAT));
    if (R() < 0.65) {
      // Ayvon: a shaded porch on wooden posts.
      k.box(w * 0.75, 0.08, 0.9, 0, h * 0.8, d / 2 + 0.45, '#7c5a3c');
      k.box(0.09, h * 0.8, 0.09, -w * 0.33, h * 0.4, d / 2 + 0.82, '#6b4a2f');
      k.box(0.09, h * 0.8, 0.09, w * 0.33, h * 0.4, d / 2 + 0.82, '#6b4a2f');
    }
  } else {
    const r = (w + 0.35) / 1.732;
    k.push(new THREE.CylinderGeometry(r, r, d + 0.35, 3), pick(R, ROOF_PITCH), 0, h + 0.5 * 0.62 * r, 0, {
      rx: -Math.PI / 2,
      sz: 0.62,
    });
  }
  k.box(0.5, 0.8, 0.06, w * 0.18, 0.4, d / 2 + 0.03, '#5b3b24');
  k.box(0.46, 0.4, 0.06, -w * 0.24, h * 0.58, d / 2 + 0.03, '#9bd4ee');
  k.box(0.06, 0.4, 0.46, w / 2 + 0.03, h * 0.58, 0, '#9bd4ee');
  k.reset();
}

function madrasa(k, x, z, ry) {
  k.at(x, z, ry);
  k.box(5.6, 2.3, 5.4, 0, 1.15, 0, '#e2c79b');
  k.box(3.0, 3.3, 0.7, 0, 1.65, 2.8, '#d9b98a');
  k.box(1.3, 2.0, 0.06, 0, 1.0, 3.16, '#1e3a8a');
  k.box(3.1, 0.22, 0.75, 0, 3.32, 2.8, '#18a5c4');
  k.push(new THREE.CylinderGeometry(1.55, 1.6, 0.7, 14), '#d9b98a', 0, 2.65, -0.2);
  k.push(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#16a3c9', 0, 3.0, -0.2, { sy: 1.25 });
  k.push(new THREE.ConeGeometry(0.14, 0.6, 6), '#fbbf24', 0, 5.3, -0.2);
  for (const sx of [-1, 1]) {
    k.push(new THREE.CylinderGeometry(0.26, 0.34, 5.2, 10), '#dcc196', sx * 2.5, 2.6, 2.75);
    k.push(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), '#18a5c4', sx * 2.5, 4.6, 2.75);
    k.push(new THREE.ConeGeometry(0.34, 0.7, 10), '#18a5c4', sx * 2.5, 5.55, 2.75);
  }
  k.reset();
}

function busStop(k, x, z, ry) {
  k.at(x, z, ry);
  k.box(2.4, 0.09, 1.0, 0, 1.0, 0, '#334155');
  for (const sx of [-1.1, 1.1]) for (const sz of [-0.42, 0.42]) k.box(0.07, 1.0, 0.07, sx, 0.5, sz, '#94a3b8');
  k.box(2.2, 0.7, 0.05, 0, 0.6, 0.42, '#a5d8f0');
  k.box(1.8, 0.07, 0.32, 0, 0.32, 0.2, '#b45309');
  k.push(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), '#cbd5e1', 1.45, 0.75, -0.35);
  k.push(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16), '#2563eb', 1.45, 1.45, -0.35, { rx: Math.PI / 2 });
  k.reset();
}

function garage(k) {
  const { x1, x2, zBack, zFront, bay, wall, h } = GARAGE;
  const right = x1 + bay / 2;
  const mid = x1 - bay / 2;
  const left = x2 - bay / 2;
  const len = zFront - zBack;
  const cz = (zBack + zFront) / 2;
  k.reset();
  k.box(right - left + 1.2, 0.04, len + 2.2, (right + left) / 2, 0.02, cz + 0.6, '#a3a8ae');
  k.box(wall, h, len, right + wall / 2, h / 2, cz, '#d6d3cb');
  k.box(wall, h, len, mid - wall / 2, h / 2, cz, '#d6d3cb');
  k.box(wall, h, len, left - wall / 2, h / 2, cz, '#d6d3cb');
  k.box(right - left + wall * 2, h, wall, (right + left) / 2, h / 2, zBack - wall / 2, '#cfcac0');
  k.box(right - left + 0.5, 0.16, len + 0.45, (right + left) / 2, h + 0.08, cz + 0.12, '#5b6b7f');
  k.box(right - left + 0.3, 0.32, 0.08, (right + left) / 2, h - 0.12, zFront + 0.02, '#1d4ed8');
  // Yellow bay lines on the floor.
  for (const xx of [right - 0.05, mid + 0.05, mid - wall - 0.05, left + 0.05]) {
    k.box(0.05, 0.012, len + 1.2, xx, 0.045, cz + 0.6, '#facc15');
  }
}

function bridge(k, x, z, ry) {
  k.at(x, z, ry);
  for (const sz of [-1.3, 1.3]) {
    k.box(4.8, 0.26, 0.26, 0, 0.02, sz, '#a8a29e');
    k.box(4.8, 0.07, 0.08, 0, 0.5, sz, '#e7e5e4');
    for (let i = -2; i <= 2; i += 1) k.box(0.09, 0.5, 0.09, i * 1.15, 0.25, sz, '#a8a29e');
  }
  k.reset();
}

/* ------------------------------------------------------------------ */
/* Town builder                                                        */
/* ------------------------------------------------------------------ */

const FIELDS = [
  { x: 12, z: 13.5, w: 11, d: 8, c: '#9ccc65', rot: false },
  { x: 24.5, z: 13.5, w: 12, d: 8, c: '#d9bd55', rot: true },
  { x: 37, z: 13.5, w: 11, d: 8, c: '#8bc34a', rot: false },
  { x: 12, z: 23.2, w: 11, d: 8, c: '#c7a466', rot: true },
  { x: 24.5, z: 23.2, w: 12, d: 8, c: '#b2d975', rot: false },
  { x: 36, z: 22.5, w: 9, d: 7, c: '#e3c55a', rot: true },
];

function insideIsland(I, x, z, m) {
  const ax = Math.abs(x - I.cx);
  const az = Math.abs(z - I.cz);
  if (ax > I.hx - m || az > I.hz - m) return false;
  const dx = Math.max(0, ax - (I.hx - I.r));
  const dz = Math.max(0, az - (I.hz - I.r));
  return Math.hypot(dx, dz) <= I.r - m;
}

export function buildTown() {
  const R = rng(917);
  const flat = new Kit();
  const smooth = new Kit();
  const water = new Kit();
  const fields = new Kit({ uv: true });
  const occupied = [];
  const nearestRoad = (x, z) => {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < ROAD.n; i += 3) {
      const d = Math.hypot(ROAD.p[i][0] - x, ROAD.p[i][1] - z);
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return { d: best, p: ROAD.p[bi] };
  };
  const inField = (x, z, m) => FIELDS.some((f) => Math.abs(x - f.x) < f.w / 2 + m && Math.abs(z - f.z) < f.d / 2 + m);
  const free = (x, z, r, { road = 1.2, river = 1.2, edge = 1.6 } = {}) => {
    if (!insideIsland(TOWN, x, z, r + edge)) return false;
    if (ROAD.distance(x, z) < 1.2 + r + road) return false;
    if (RIVER.distance(x, z) < 1.3 + r + river) return false;
    if (GARAGE_TRACK.distance(x, z) < 1.0 + r + 0.6) return false;
    if (inField(x, z, r + 0.3)) return false;
    return !occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  };
  const take = (x, z, r) => occupied.push({ x, z, r });

  // Island.
  const ground = islandGeometry(TOWN.hx, TOWN.hz, TOWN.r);
  const rock = rockGeometry(TOWN.hx, TOWN.hz, -3.4, 15, 5);

  // Road, centre dashes, edge lines and the depot lane to the garage.
  smooth.push(ribbonGeometry(ROAD.p, 2.3, 0.035), '#4a5160');
  for (const off of [-1.02, 1.02]) smooth.push(ribbonGeometry(ROAD.p, 0.08, 0.042, off), '#e5e7eb');
  for (let d = 0.6; d < ROAD.length - 0.8; d += 1.6) smooth.push(ribbonGeometry(subPoints(ROAD, d, d + 0.75), 0.09, 0.044), '#f6d77a');
  let gStart = 0;
  while (gStart < GARAGE_TRACK.length && ROAD.distance(GARAGE_TRACK.point(gStart).x, GARAGE_TRACK.point(gStart).z) < 0.4) gStart += 0.3;
  let gEnd = GARAGE_TRACK.length;
  while (gEnd > 0 && GARAGE_TRACK.point(gEnd).z < GARAGE.zFront + 0.5) gEnd -= 0.2;
  smooth.push(ribbonGeometry(subPoints(GARAGE_TRACK, Math.max(0, gStart - 1.5), gEnd, 0.25), 1.7, 0.033), '#4a5160');

  // River with sandy banks, the pond it starts from, and the lip of the waterfall.
  smooth.push(ribbonGeometry(RIVER.p, 3.8, 0.01), '#d9c79a');
  water.push(ribbonGeometry(RIVER.p, 2.5, 0.016), '#3d9fe0');
  water.push(new THREE.CircleGeometry(1, 22), '#3d9fe0', POND.x, 0.017, POND.z, { rx: -Math.PI / 2, sx: POND.rx, sy: POND.rz });
  smooth.push(new THREE.CircleGeometry(1, 22), '#d9c79a', POND.x, 0.011, POND.z, { rx: -Math.PI / 2, sx: POND.rx + 0.7, sy: POND.rz + 0.7 });
  const end = RIVER.p[RIVER.n - 1];
  const edgeZ = ground.boundingBox.max.z;
  water.box(2.5, 0.03, edgeZ - end[1] + 0.25, end[0], -0.3, (end[1] + edgeZ) / 2 + 0.05, '#4aa8e6', { rx: 0.72 });
  take(POND.x, POND.z, 4.5);

  // Bridge where the road crosses the river.
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < ROAD.n; i += 1) {
    const d = RIVER.distance(ROAD.p[i][0], ROAD.p[i][1]);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  const bp = ROAD.p[bi];
  const bt = ROAD.tangent(ROAD.cum[bi]);
  bridge(flat, bp[0], bp[1], Math.atan2(-bt.z, bt.x));
  take(bp[0], bp[1], 3.4);

  // Stops A and B on the right-hand side of the road, the chinor, the garage.
  const t0 = ROAD.tangent(0);
  const t1 = ROAD.tangent(ROAD.length);
  const stopA = { x: ROAD.p[0][0] - t0.z * 2.1 + t0.x * 0.6, z: ROAD.p[0][1] + t0.x * 2.1 + t0.z * 0.6 };
  const stopB = { x: ROAD.p[ROAD.n - 1][0] - t1.z * 2.1 - t1.x * 0.6, z: ROAD.p[ROAD.n - 1][1] + t1.x * 2.1 - t1.z * 0.6 };
  busStop(flat, stopA.x, stopA.z, Math.atan2(-t0.z, t0.x));
  busStop(flat, stopB.x, stopB.z, Math.atan2(-t1.z, t1.x));
  take(stopA.x, stopA.z, 2);
  take(stopB.x, stopB.z, 2);
  chinorTree(flat, CHINOR.x, CHINOR.z);
  take(CHINOR.x, CHINOR.z, 4.2);
  garage(flat);
  take(-44.3, 9.2, 4.2);
  take(-44.3, 13.5, 2.5);

  // Landmark at B.
  madrasa(flat, 41.5, -24.5, -0.5);
  take(41.5, -24.5, 5);

  // Houses in clusters, each turned to face the road.
  const clusters = [
    { x: -38, z: 24, r: 10, n: 9 },
    { x: -31, z: 7, r: 6, n: 4 },
    { x: 37, z: -17, r: 10, n: 9 },
    { x: 13, z: -25, r: 7, n: 5 },
    { x: 22, z: -13, r: 5, n: 3 },
    { x: -13, z: 22, r: 7, n: 5 },
    { x: -29, z: -3, r: 6, n: 3 },
  ];
  for (const c of clusters) {
    let placed = 0;
    for (let tries = 0; tries < 160 && placed < c.n; tries += 1) {
      const a = R() * Math.PI * 2;
      const rr = Math.sqrt(R()) * c.r;
      const x = c.x + Math.cos(a) * rr;
      const z = c.z + Math.sin(a) * rr;
      if (!free(x, z, 2.0, { road: 0.9 })) continue;
      const nr = nearestRoad(x, z);
      const ry = nr.d < 14 ? Math.atan2(nr.p[0] - x, nr.p[1] - z) : R() * Math.PI * 2;
      house(flat, R, x, z, ry, R() < 0.6 ? 'flat' : 'pitched');
      take(x, z, 2.1);
      placed += 1;
    }
  }

  // Fields with furrows.
  for (const f of FIELDS) {
    const geo = new THREE.PlaneGeometry(f.w, f.d, 1, 1);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const a = pos.getX(i) / 2.4;
      const b = pos.getY(i) / 2.4;
      uv.setXY(i, f.rot ? b : a, f.rot ? a : b);
    }
    fields.push(geo, f.c, f.x, 0.012, f.z, { rx: -Math.PI / 2 });
  }
  // A farm shed by the fields.
  house(flat, R, 44.5, 6.5, -Math.PI / 2, 'pitched');
  take(44.5, 6.5, 2.2);

  // Poplars along the road and the river.
  for (let d = 3; d < ROAD.length - 3; d += 4.2) {
    const p = ROAD.point(d);
    const t = ROAD.tangent(d);
    for (const side of [-1, 1]) {
      const x = p.x - t.z * 2.7 * side;
      const z = p.z + t.x * 2.7 * side;
      if (!free(x, z, 0.6, { road: -0.6, river: 0.4 })) continue;
      poplar(flat, R, x, z, 0.95);
      take(x, z, 1.1);
    }
  }
  for (let d = 2; d < RIVER.length - 2; d += 4.6) {
    const p = RIVER.point(d);
    const t = RIVER.tangent(d);
    for (const side of [-1, 1]) {
      const x = p.x - t.z * 2.9 * side;
      const z = p.z + t.x * 2.9 * side;
      if (!free(x, z, 0.6, { river: -0.4, road: 0.6 })) continue;
      poplar(flat, R, x, z, 0.85);
      take(x, z, 1.1);
    }
  }

  // An orchard, then trees wherever there is room.
  for (let x = -45; x <= -27; x += 3.1) {
    for (let z = -27; z <= -14; z += 3.1) {
      const jx = x + (R() - 0.5) * 0.6;
      const jz = z + (R() - 0.5) * 0.6;
      if (!free(jx, jz, 0.9, { road: 1 })) continue;
      roundTree(flat, R, jx, jz, 0.72);
      take(jx, jz, 1.2);
    }
  }
  for (let i = 0; i < 260; i += 1) {
    const x = (R() * 2 - 1) * (TOWN.hx - 3);
    const z = (R() * 2 - 1) * (TOWN.hz - 3);
    if (!free(x, z, 1.1, { road: 1 })) continue;
    roundTree(flat, R, x, z, 0.8 + R() * 0.4);
    take(x, z, 1.6);
  }

  // Low hills and boulders near the back edge.
  for (const [x, z, r] of [[6, -28.5, 4], [17, -29.5, 5], [29, -28, 4.2], [-24, -29.5, 3.6], [-40, -27, 3.2]]) {
    flat.reset();
    flat.push(new THREE.IcosahedronGeometry(r, 1), '#6fa63d', x, 0, z, { sy: 0.32, ry: R() * 3 });
  }
  for (let i = 0; i < 9; i += 1) {
    const x = (R() * 2 - 1) * (TOWN.hx - 2.5);
    const z = (R() * 2 - 1) * (TOWN.hz - 2.5);
    if (!free(x, z, 0.5, { edge: 0.6 })) continue;
    flat.reset();
    flat.push(new THREE.DodecahedronGeometry(0.4 + R() * 0.4, 0), '#9ca3af', x, 0.15, z, { ry: R() * 3 });
  }

  return {
    ground,
    rock,
    flat: flat.build(),
    smooth: smooth.build(),
    water: water.build(),
    fields: fields.build(),
    fall: { x: end[0], z: edgeZ + 0.06 },
  };
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function Waterfall({ x, z, width = 3, height = 8 }) {
  const res = useMemo(() => {
    const map = paintWaterfall();
    const alphaMap = paintFade();
    map.repeat.set(1, 1.6);
    const mat = new THREE.MeshBasicMaterial({
      map,
      alphaMap,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      color: '#e0f6ff',
      opacity: 0.95,
    });
    const geo = new THREE.PlaneGeometry(width, height);
    return { map, alphaMap, mat, geo };
  }, [width, height]);
  useEffect(
    () => () => {
      res.map.dispose();
      res.alphaMap.dispose();
      res.mat.dispose();
      res.geo.dispose();
    },
    [res],
  );
  useFrame((_, dt) => {
    res.map.offset.y = (res.map.offset.y + Math.min(dt, 0.1) * 0.9) % 1;
  });
  return <mesh geometry={res.geo} material={res.mat} position={[x, -0.55 - height / 2, z]} renderOrder={2} />;
}

export function TownIsland() {
  const res = useMemo(() => {
    const geo = buildTown();
    const mats = islandMaterials();
    mats.water = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.2,
      metalness: 0.15,
      emissive: '#0b4f7a',
      emissiveIntensity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    mats.stripes = paintStripes();
    mats.fields = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: mats.stripes,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    return { geo, mats };
  }, []);
  useEffect(
    () => () => {
      Object.values(res.geo).forEach((g) => g?.dispose?.());
      Object.values(res.mats).forEach((m) => m.dispose());
    },
    [res],
  );
  const { geo, mats } = res;
  return (
    <group>
      <mesh geometry={geo.ground} material={[mats.grass, mats.soil]} receiveShadow />
      <mesh geometry={geo.rock} material={mats.rock} />
      <mesh geometry={geo.smooth} material={mats.smooth} receiveShadow />
      <mesh geometry={geo.water} material={mats.water} receiveShadow />
      <mesh geometry={geo.fields} material={mats.fields} receiveShadow />
      <mesh geometry={geo.flat} material={mats.flat} castShadow receiveShadow />
      <Waterfall x={geo.fall.x} z={geo.fall.z} />
    </group>
  );
}

function buildStadium() {
  const R = rng(404);
  const k = new Kit();
  const { cx, cz } = STADIUM;
  const ground = islandGeometry(STADIUM.hx, STADIUM.hz, STADIUM.r);
  ground.translate(cx, 0, cz);
  ground.computeBoundingBox();
  const rock = rockGeometry(STADIUM.hx, STADIUM.hz, -3.4, 11, 9);
  rock.translate(cx, 0, cz);

  // Main stand behind the back straight, low stand on the home side.
  const seat = ['#7c3aed', '#8b5cf6', '#0ea5e9', '#22d3ee'];
  for (let i = 0; i < 4; i += 1) {
    const h = 0.45 * (i + 1);
    k.box(27, h, 1.0, cx, h / 2, cz - 12.4 - i, seat[i]);
  }
  k.box(27.4, 2.4, 0.3, cx, 1.2, cz - 16.2, '#94a3b8');
  k.box(28, 0.16, 5, cx, 3.55, cz - 14.0, '#e2e8f0', { rx: 0.07 });
  for (const x of [-12.5, -4.2, 4.2, 12.5]) k.box(0.18, 3.5, 0.18, cx + x, 1.75, cz - 16.1, '#cbd5e1');
  for (let i = 0; i < 2; i += 1) {
    const h = 0.3 * (i + 1);
    k.box(19, h, 0.9, cx, h / 2, cz + 12.1 + i * 0.9, i ? '#a78bfa' : '#c4b5fd');
  }
  // Floodlights.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = cx + sx * 22.5;
      const z = cz + sz * 13.2;
      k.push(new THREE.CylinderGeometry(0.12, 0.18, 7.5, 6), '#cbd5e1', x, 3.75, z);
      k.box(1.5, 0.8, 0.22, x, 7.7, z, '#fef3c7', { ry: Math.atan2(-(cz - z), cx - x) + Math.PI / 2 });
    }
  }
  // Changing rooms at the west end, scoreboard at the east.
  k.box(2.6, 1.5, 6, cx - 26, 0.75, cz, '#e7dcc5');
  k.box(2.9, 0.16, 6.3, cx - 26, 1.58, cz, '#64748b');
  k.box(0.25, 1.7, 4.6, cx + 26.2, 2.2, cz, '#0f172a');
  k.box(0.27, 1.4, 4.3, cx + 26.2, 2.2, cz, '#155e75');
  for (const sz of [-1.8, 1.8]) k.box(0.15, 1.4, 0.15, cx + 26.2, 0.7, cz + sz, '#94a3b8');
  // Trees round the edge.
  for (let i = 0; i < 70; i += 1) {
    const a = (i / 70) * Math.PI * 2 + R() * 0.05;
    const x = cx + Math.cos(a) * (STADIUM.hx - 2.2);
    const z = cz + Math.sin(a) * (STADIUM.hz - 2.0);
    if (!insideIsland(STADIUM, x, z, 1.2)) continue;
    if (Math.abs(z - cz) > 11.5 && Math.abs(x - cx) < 15) continue;
    if (Math.abs(x - cx) > 24.5 && Math.abs(z - cz) < 4.5) continue;
    if (Math.abs(Math.abs(x - cx) - 22.5) < 1.5 && Math.abs(Math.abs(z - cz) - 13.2) < 1.5) continue;
    if (i % 2) roundTree(k, R, x, z, 0.75 + R() * 0.3);
    else poplar(k, R, x, z, 0.85);
  }
  return { ground, rock, flat: k.build() };
}

export function StadiumIsland() {
  const res = useMemo(() => {
    const geo = buildStadium();
    const mats = islandMaterials();
    mats.fieldTex = paintStadium(GRASS);
    mats.field = new THREE.MeshStandardMaterial({
      map: mats.fieldTex,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    geo.plane = new THREE.PlaneGeometry(48, 24);
    return { geo, mats };
  }, []);
  useEffect(
    () => () => {
      Object.values(res.geo).forEach((g) => g?.dispose?.());
      Object.values(res.mats).forEach((m) => m.dispose());
    },
    [res],
  );
  const { geo, mats } = res;
  return (
    <group>
      <mesh geometry={geo.ground} material={[mats.grass, mats.soil]} receiveShadow />
      <mesh geometry={geo.rock} material={mats.rock} />
      <mesh geometry={geo.plane} material={mats.field} position={[STADIUM.cx, 0.015, STADIUM.cz]} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh geometry={geo.flat} material={mats.flat} castShadow receiveShadow />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Bus                                                                 */
/* ------------------------------------------------------------------ */

const BUS_PARTS = [
  // material, size (m), centre (m); the bus points along +x, its doors face +z (right).
  ['body', [12, 1.3, 2.5], [0, 1.0, 0]],
  ['dark', [12.04, 0.32, 2.53], [0, 0.42, 0]],
  ['stripe', [12.06, 0.24, 2.55], [0, 1.58, 0]],
  ['glass', [11.4, 1.0, 2.53], [0.05, 2.18, 0]],
  ['body', [11.9, 0.36, 2.47], [0, 2.86, 0]],
  ['roof', [11.6, 0.2, 2.36], [0, 3.12, 0]],
  ['roof', [3.2, 0.32, 1.7], [-1.6, 3.36, 0]],
  ['glass', [0.08, 1.45, 2.3], [6.0, 2.05, 0]],
  ['sign', [0.09, 0.32, 1.7], [6.03, 2.9, 0]],
  ['glass', [0.08, 0.9, 2.1], [-6.0, 2.3, 0]],
  ['lamp', [0.08, 0.24, 0.45], [6.03, 0.82, 0.85]],
  ['lamp', [0.08, 0.24, 0.45], [6.03, 0.82, -0.85]],
  ['tail', [0.08, 0.32, 0.3], [-6.03, 0.95, 1.0]],
  ['tail', [0.08, 0.32, 0.3], [-6.03, 0.95, -1.0]],
  ['dark', [1.15, 2.25, 0.05], [4.6, 1.55, 1.27]],
  ['dark', [1.15, 2.25, 0.05], [-0.4, 1.55, 1.27]],
  ['body', [0.16, 1.0, 2.57], [-3.6, 2.18, 0]],
  ['body', [0.16, 1.0, 2.57], [-1.3, 2.18, 0]],
  ['body', [0.16, 1.0, 2.57], [1.6, 2.18, 0]],
  ['body', [0.16, 1.0, 2.57], [3.6, 2.18, 0]],
];
const WHEELS = [[4.0, 1.13], [4.0, -1.13], [-3.7, 1.13], [-3.7, -1.13]];

function BusBody({ stripe }) {
  const res = useMemo(() => {
    const mats = {
      body: new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.45 }),
      stripe: new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: '#1b2d44', roughness: 0.15, metalness: 0.5 }),
      roof: new THREE.MeshStandardMaterial({ color: '#dfe5ec', roughness: 0.6 }),
      sign: new THREE.MeshStandardMaterial({ color: '#7c2d12', emissive: '#fbbf24', emissiveIntensity: 1.1 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#fefce8', emissive: '#fff7cc', emissiveIntensity: 1 }),
      tail: new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#ef4444', emissiveIntensity: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.7 }),
      tyre: new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9 }),
      hub: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.4 }),
    };
    const geos = {
      box: new THREE.BoxGeometry(1, 1, 1),
      tyre: new THREE.CylinderGeometry(0.5, 0.5, 0.34, 14),
      hub: new THREE.CylinderGeometry(0.24, 0.24, 0.36, 10),
    };
    return { mats, geos };
  }, [stripe]);
  useEffect(
    () => () => {
      Object.values(res.mats).forEach((m) => m.dispose());
      Object.values(res.geos).forEach((g) => g.dispose());
    },
    [res],
  );
  const { mats, geos } = res;
  return (
    <group>
      {BUS_PARTS.map(([m, s, p], i) => (
        <mesh key={i} geometry={geos.box} material={mats[m]} scale={s} position={p} castShadow />
      ))}
      {WHEELS.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.5, z]} rotation-x={Math.PI / 2}>
          <mesh geometry={geos.tyre} material={mats.tyre} castShadow />
          <mesh geometry={geos.hub} material={mats.hub} />
        </group>
      ))}
    </group>
  );
}

/**
 * The bus, posed every frame from `live.bus` (or a fixed `pose`). Children
 * are in scene units and ride with the bus - the bus frame's axes and clock
 * live there.
 */
export function Bus({ live, pose, stripe = '#7c3aed', children }) {
  const ref = useRef(null);
  useFrame(() => {
    const p = pose || live?.bus;
    if (!ref.current || !p) return;
    ref.current.position.set(p.x, 0, p.z);
    ref.current.rotation.y = p.ry;
  });
  return (
    <group ref={ref} position={pose ? [pose.x, 0, pose.z] : undefined} rotation-y={pose ? pose.ry : 0}>
      <group scale={1 / TOWN_M}>
        <BusBody stripe={stripe} />
      </group>
      {children}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

/** Drawn about 4 times life size so a person is visible on a 400 m track. */
const RUNNER_SCALE = 4 / STADIUM_M;

export function Runner({ live }) {
  const root = useRef(null);
  const body = useRef(null);
  const legs = useRef([]);
  const arms = useRef([]);
  const phase = useRef(0);
  const res = useMemo(() => {
    const mats = {
      shirt: new THREE.MeshStandardMaterial({ color: '#8b5cf6', roughness: 0.6 }),
      shorts: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: '#c68642', roughness: 0.7 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 }),
    };
    const geos = { box: new THREE.BoxGeometry(1, 1, 1), head: new THREE.SphereGeometry(0.13, 12, 10) };
    return { mats, geos };
  }, []);
  useEffect(
    () => () => {
      Object.values(res.mats).forEach((m) => m.dispose());
      Object.values(res.geos).forEach((g) => g.dispose());
    },
    [res],
  );
  useFrame(() => {
    const r = live.runner;
    if (!root.current) return;
    root.current.position.set(r.x, 0, r.z);
    root.current.rotation.y = r.ry;
    phase.current += r.stride;
    const s = Math.sin(phase.current);
    legs.current.forEach((l, i) => {
      if (l) l.rotation.z = (i ? -s : s) * 0.85 * r.amp;
    });
    arms.current.forEach((a, i) => {
      if (a) a.rotation.z = (i ? s : -s) * 0.8 * r.amp;
    });
    if (body.current) {
      body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.06 * r.amp;
      body.current.rotation.z = -0.18 * r.amp;
    }
  });
  const { mats, geos } = res;
  return (
    <group ref={root}>
      <group scale={RUNNER_SCALE}>
        <group ref={body}>
          <mesh geometry={geos.box} material={mats.shirt} scale={[0.26, 0.6, 0.42]} position={[0, 1.22, 0]} castShadow />
          <mesh geometry={geos.head} material={mats.skin} position={[0.02, 1.68, 0]} castShadow />
          {[0.12, -0.12].map((z, i) => (
            <group key={z} ref={(el) => (legs.current[i] = el)} position={[0, 0.92, z]}>
              <mesh geometry={geos.box} material={mats.shorts} scale={[0.19, 0.3, 0.17]} position={[0, -0.12, 0]} castShadow />
              <mesh geometry={geos.box} material={mats.skin} scale={[0.13, 0.62, 0.13]} position={[0, -0.55, 0]} castShadow />
              <mesh geometry={geos.box} material={mats.shoe} scale={[0.26, 0.09, 0.13]} position={[0.05, -0.88, 0]} castShadow />
            </group>
          ))}
          {[0.27, -0.27].map((z, i) => (
            <group key={z} ref={(el) => (arms.current[i] = el)} position={[0, 1.46, z]}>
              <mesh geometry={geos.box} material={mats.skin} scale={[0.1, 0.56, 0.1]} position={[0, -0.27, 0]} castShadow />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Axes, clock, labels                                                  */
/* ------------------------------------------------------------------ */

export const AXIS_COLORS = { x: '#f43f5e', y: '#22c55e', z: '#3b82f6' };

export function Tag({ position, tone = 'slate', children, className = '' }) {
  const tones = {
    slate: 'border-white/15 bg-slate-950/75 text-white',
    amber: 'border-amber-300/50 bg-amber-950/80 text-amber-100',
    cyan: 'border-cyan-300/50 bg-cyan-950/80 text-cyan-100',
    violet: 'border-violet-300/50 bg-violet-950/80 text-violet-100',
    emerald: 'border-emerald-300/50 bg-emerald-950/80 text-emerald-100',
    rose: 'border-rose-300/50 bg-rose-950/80 text-rose-100',
  };
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-lg shadow-black/40 backdrop-blur-sm ${tones[tone]} ${className}`}
      >
        {children}
      </div>
    </Html>
  );
}

export function Axes3D({ length = 6, radius = 0.09 }) {
  const res = useMemo(() => {
    const geos = {
      shaft: new THREE.CylinderGeometry(1, 1, 1, 10),
      head: new THREE.ConeGeometry(1, 1, 14),
      ball: new THREE.SphereGeometry(1, 16, 12),
    };
    const mats = {};
    for (const [k, c] of Object.entries(AXIS_COLORS)) {
      mats[k] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.4 });
    }
    mats.o = new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#ffffff', emissiveIntensity: 0.3 });
    return { geos, mats };
  }, []);
  useEffect(
    () => () => {
      Object.values(res.geos).forEach((g) => g.dispose());
      Object.values(res.mats).forEach((m) => m.dispose());
    },
    [res],
  );
  const { geos, mats } = res;
  const hl = Math.min(length * 0.22, radius * 9);
  const hr = radius * 3.2;
  const arrow = (key, rot) => (
    <group key={key} rotation={rot}>
      <mesh geometry={geos.shaft} material={mats[key]} scale={[radius, length - hl, radius]} position={[0, (length - hl) / 2, 0]} castShadow />
      <mesh geometry={geos.head} material={mats[key]} scale={[hr, hl, hr]} position={[0, length - hl / 2, 0]} castShadow />
    </group>
  );
  const tip = length + 0.45 + radius * 2;
  return (
    <group>
      <mesh geometry={geos.ball} material={mats.o} scale={radius * 2.4} />
      {arrow('x', [0, 0, -Math.PI / 2])}
      {arrow('y', [0, 0, 0])}
      {arrow('z', [Math.PI / 2, 0, 0])}
      {[
        ['x', [tip, 0, 0]],
        ['y', [0, tip, 0]],
        ['z', [0, 0, tip]],
      ].map(([k, p]) => (
        <Html key={k} position={p} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className="grid h-6 w-6 place-items-center rounded-full font-mono text-sm font-bold text-white shadow-lg"
            style={{ background: AXIS_COLORS[k] }}
          >
            {k}
          </span>
        </Html>
      ))}
    </group>
  );
}

/** A stopwatch that faces the camera; one turn of the hand is 60 s of `live.t`. */
export function Clock3D({ live, radius = 0.9, unit = 's' }) {
  const hand = useRef(null);
  const res = useMemo(() => {
    const tex = paintClock(unit);
    return {
      tex,
      face: new THREE.CircleGeometry(radius, 36),
      faceMat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
      rim: new THREE.TorusGeometry(radius, radius * 0.07, 8, 36),
      rimMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 }),
      hand: new THREE.BoxGeometry(radius * 0.07, radius * 0.82, radius * 0.03),
      handMat: new THREE.MeshBasicMaterial({ color: '#e11d48', toneMapped: false }),
    };
  }, [radius, unit]);
  useEffect(
    () => () => {
      Object.values(res).forEach((v) => v.dispose());
    },
    [res],
  );
  useFrame(() => {
    if (hand.current) hand.current.rotation.z = -((live.t % 60) / 60) * Math.PI * 2;
  });
  return (
    <Billboard>
      <mesh geometry={res.face} material={res.faceMat} />
      <mesh geometry={res.rim} material={res.rimMat} />
      <group ref={hand} position={[0, 0, 0.02]}>
        <mesh geometry={res.hand} material={res.handMat} position={[0, radius * 0.36, 0]} />
      </group>
    </Billboard>
  );
}

export const PARKED_BUS = { x: GARAGE.x2, z: 8.8, ry: Math.PI / 2 };
