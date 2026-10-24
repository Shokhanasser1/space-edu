import * as THREE from 'three';

/**
 * Variant C's world: the numbers, the routes and the pictures painted on
 * canvases. Nothing here renders - the scene file turns it into meshes.
 *
 * Scale. The town is drawn at 3 m per scene unit, so the 12 m bus is 4 units
 * long and every reading in metres is honest about the drawing. The stadium is
 * its own island at 4 m per unit, because a 400 m track at the town's scale
 * would not fit beside the town. The map of Tashkent - Samarkand is laid out
 * in the town's units (1 unit = 3 m) with Tashkent sitting on the garage, so
 * zooming out from the bus to the map is one continuous camera move.
 */

export const TOWN_M = 3;
export const STADIUM_M = 4;
export const BUS_LEN_M = 12;
export const BUS_WID_M = 2.5;
export const GARAGE_LEN_M = 14;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((2 - 2 * t) * (2 - 2 * t) * (2 - 2 * t)) / 2);

/** Small seeded generator so the town is the same town on every load. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TA = { x: 0, z: 0 };
const TB = { x: 0, z: 0 };

/**
 * A polyline on the ground with its arc length. `trueLength` rescales the
 * measured length - the map's road is drawn through a handful of towns but is
 * about 300 km long on the ground.
 */
export class Track {
  constructor(points, { trueLength = 0, closed = false } = {}) {
    this.p = points;
    this.n = points.length;
    this.cum = new Float64Array(this.n);
    for (let i = 1; i < this.n; i += 1) {
      this.cum[i] = this.cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    const raw = this.cum[this.n - 1] || 1;
    if (trueLength) {
      const k = trueLength / raw;
      for (let i = 0; i < this.n; i += 1) this.cum[i] *= k;
    }
    this.length = this.cum[this.n - 1];
    this.closed = closed;
    this.win = (this.length / this.n) * 2.5;
  }

  index(d) {
    const v = clamp(d, 0, this.length);
    let lo = 0;
    let hi = this.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= v) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  point(d, out = { x: 0, z: 0 }) {
    let v = d;
    if (this.closed) v = ((d % this.length) + this.length) % this.length;
    const i = this.index(v);
    const seg = this.cum[i + 1] - this.cum[i];
    const f = seg > 0 ? clamp((v - this.cum[i]) / seg, 0, 1) : 0;
    const a = this.p[i];
    const b = this.p[Math.min(i + 1, this.n - 1)];
    out.x = a[0] + (b[0] - a[0]) * f;
    out.z = a[1] + (b[1] - a[1]) * f;
    return out;
  }

  /** Unit direction of travel at `d`, smoothed over a few samples. */
  tangent(d, out = { x: 1, z: 0 }) {
    let a = d - this.win;
    let b = d + this.win;
    if (!this.closed) {
      a = Math.max(0, a);
      b = Math.min(this.length, b);
    }
    this.point(a, TA);
    this.point(b, TB);
    const dx = TB.x - TA.x;
    const dz = TB.z - TA.z;
    const l = Math.hypot(dx, dz) || 1;
    out.x = dx / l;
    out.z = dz / l;
    return out;
  }

  /** Shortest distance from a point to the polyline (brute force; used at build time). */
  distance(x, z) {
    let best = Infinity;
    for (let i = 0; i < this.n; i += 1) {
      const dx = this.p[i][0] - x;
      const dz = this.p[i][1] - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

export function smoothTrack(ctrl, spacing, opts) {
  const curve = new THREE.CatmullRomCurve3(
    ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  );
  const n = Math.max(16, Math.ceil(curve.getLength() / spacing));
  const pts = curve.getSpacedPoints(n).map((v) => [v.x, v.z]);
  return new Track(pts, opts);
}

/* ------------------------------------------------------------------ */
/* Town island                                                         */
/* ------------------------------------------------------------------ */

export const TOWN = { cx: 0, cz: 0, hx: 50, hz: 32, r: 11 };
export const STADIUM = { cx: 0, cz: -112, hx: 30, hz: 19, r: 8 };

const ROAD_RAW = smoothTrack(
  [[-36, 18], [-27, 20.5], [-18, 14], [-17, 3], [-21, -8], [-13, -18], [0, -19], [8, -9], [17, -2], [28, -6], [35, -15.5]],
  0.3,
);
/** Rounded to a whole metre so "2 x L" in the round trip is exactly what the readout shows. */
export const ROAD = new Track(ROAD_RAW.p, { trueLength: Math.round(ROAD_RAW.length * TOWN_M) / TOWN_M });
export const ROAD_LEN_M = Math.round(ROAD.length * TOWN_M);
export const A_POINT = { x: ROAD.p[0][0], z: ROAD.p[0][1] };
export const B_POINT = { x: ROAD.p[ROAD.n - 1][0], z: ROAD.p[ROAD.n - 1][1] };
export const AB_DIRECT_M = Math.hypot(B_POINT.x - A_POINT.x, B_POINT.z - A_POINT.z) * TOWN_M;

export const RIVER = smoothTrack(
  [[-9.5, -26.5], [-6.5, -22], [-5.5, -14], [-8, -6], [-6, 4], [-2, 13], [-3, 22], [0.4, 32.05]],
  0.5,
);
export const POND = { x: -10.4, z: -27.6, rx: 3.6, rz: 2.5 };

/** The reference body for the ground frame - a big plane tree inside the road's bend. */
export const CHINOR = { x: -14.2, z: -6.6 };
/** Where its axes start: at the tree's foot, just clear of the crown so the y axis is visible. */
export const FRAME_ORIGIN = { x: CHINOR.x - 1.4, z: CHINOR.z + 3.4 };

export const GARAGE = { x1: -43.5, x2: -45.09, zBack: 6.4, zFront: 11.2, bay: 1.47, wall: 0.12, h: 1.45 };

const gp = (d) => {
  const p = ROAD.point(d);
  return [p.x, p.z];
};
/** The bus comes back along the road past stop A and noses into bay 1. */
export const GARAGE_TRACK = smoothTrack(
  [gp(3.4), gp(1.6), gp(0), [-39.6, 17.25], [-42.3, 15.55], [-43.45, 13.2], [-43.5, 11.0], [-43.5, 8.8]],
  0.15,
);
export const GARAGE_TARGET = { x: -39.6, y: 0.6, z: 13.6 };

/* ------------------------------------------------------------------ */
/* Stadium                                                             */
/* ------------------------------------------------------------------ */

export const LAP_S = 84.39 / STADIUM_M;
export const LAP_R = (400 / STADIUM_M - 2 * LAP_S) / (2 * Math.PI);
export const TRACK_RI = LAP_R - 0.3 / STADIUM_M;
export const TRACK_LANE = 1.22 / STADIUM_M;
export const TRACK_RO = TRACK_RI + 6 * TRACK_LANE;

function lapPoints() {
  const pts = [];
  const hs = LAP_S / 2;
  const { cx, cz } = STADIUM;
  const step = 0.25;
  const nb = Math.ceil((Math.PI * LAP_R) / step);
  const ns = Math.ceil(LAP_S / step);
  for (let i = 0; i < nb; i += 1) {
    const f = (i / nb) * Math.PI;
    pts.push([cx + hs + LAP_R * Math.sin(f), cz + LAP_R * Math.cos(f)]);
  }
  for (let i = 0; i < ns; i += 1) pts.push([cx + hs - (i / ns) * LAP_S, cz - LAP_R]);
  for (let i = 0; i < nb; i += 1) {
    const f = (i / nb) * Math.PI;
    pts.push([cx - hs - LAP_R * Math.sin(f), cz - LAP_R * Math.cos(f)]);
  }
  for (let i = 0; i <= ns; i += 1) pts.push([cx - hs + (i / ns) * LAP_S, cz + LAP_R]);
  return pts;
}
/** Lane 1, measured 30 cm from the kerb: exactly 400 m. Start = finish, counter-clockwise. */
export const LAP = new Track(lapPoints(), { trueLength: 400 / STADIUM_M, closed: true });

/* ------------------------------------------------------------------ */
/* Motion plans: time -> distance along a track                        */
/* ------------------------------------------------------------------ */

/** Speed up at `a`, cruise at `v`, slow down at `a`: covers L metres. */
export function trapezoid(L, v, a) {
  const tA = v / a;
  const dA = 0.5 * a * tA * tA;
  if (2 * dA >= L) {
    const t1 = Math.sqrt(L / a);
    const T = 2 * t1;
    return {
      T,
      at(t) {
        const u = clamp(t, 0, T);
        if (u <= t1) return 0.5 * a * u * u;
        const r = T - u;
        return L - 0.5 * a * r * r;
      },
    };
  }
  const tC = (L - 2 * dA) / v;
  const T = 2 * tA + tC;
  return {
    T,
    at(t) {
      const u = clamp(t, 0, T);
      if (u < tA) return 0.5 * a * u * u;
      if (u < tA + tC) return dA + v * (u - tA);
      const r = T - u;
      return L - 0.5 * a * r * r;
    },
  };
}

const BUS_V = 10;
const BUS_A = 1.4;
export const TURN_PAUSE = 3;
const OUT = trapezoid(ROAD_LEN_M, BUS_V, BUS_A);
const RUN = trapezoid(400, 6.5, 2.2);

/**
 * Each plan writes into `o`: s (units along its track), path (m travelled),
 * turn (0..1 through the U-turn), back (returning), phase.
 */
export const PLANS = {
  ab: {
    T: OUT.T,
    total: ROAD_LEN_M,
    run(t, o) {
      const m = OUT.at(t);
      o.s = m / TOWN_M;
      o.path = m;
      o.turn = 0;
      o.back = false;
      o.phase = t <= 0 ? 'idle' : t >= OUT.T ? 'done' : 'out';
    },
  },
  aba: {
    T: OUT.T * 2 + TURN_PAUSE,
    total: 2 * ROAD_LEN_M,
    run(t, o) {
      const T1 = OUT.T;
      if (t < T1) {
        const m = OUT.at(t);
        o.s = m / TOWN_M;
        o.path = m;
        o.turn = 0;
        o.back = false;
        o.phase = t <= 0 ? 'idle' : 'out';
      } else if (t < T1 + TURN_PAUSE) {
        o.s = ROAD.length;
        o.path = ROAD_LEN_M;
        o.turn = easeInOut((t - T1) / TURN_PAUSE);
        o.back = false;
        o.phase = 'atB';
      } else {
        const m = OUT.at(t - T1 - TURN_PAUSE);
        o.s = (ROAD_LEN_M - m) / TOWN_M;
        o.path = ROAD_LEN_M + m;
        o.turn = 1;
        o.back = true;
        o.phase = t >= T1 * 2 + TURN_PAUSE ? 'done' : 'back';
      }
    },
  },
  lap: {
    T: RUN.T,
    total: 400,
    run(t, o) {
      const m = RUN.at(t);
      o.s = m / STADIUM_M;
      o.path = m;
      o.turn = 0;
      o.back = false;
      o.phase = t <= 0 ? 'idle' : t >= RUN.T ? 'done' : m < 200 ? 'run1' : 'run2';
    },
  },
};

export const GARAGE_PLAN = trapezoid(GARAGE_TRACK.length * TOWN_M, 2.4, 0.7);

/* ------------------------------------------------------------------ */
/* Map: Tashkent -> Samarkand                                          */
/* ------------------------------------------------------------------ */

export const GEO = { kmLon: 84.65, kmLat: 110.57, lonMin: 66.0, lonMax: 70.2, latMin: 39.1, latMax: 41.9 };
const TK = { lat: 41.311, lon: 69.279 };
export const TASHKENT_XZ = { x: GARAGE.x1, z: 8.8 };
export const MAP_Y = -17;

export function geoWorld(lat, lon, out = { x: 0, z: 0 }) {
  out.x = TASHKENT_XZ.x + ((lon - TK.lon) * GEO.kmLon * 1000) / TOWN_M;
  out.z = TASHKENT_XZ.z - ((lat - TK.lat) * GEO.kmLat * 1000) / TOWN_M;
  return out;
}

export const CITIES = [
  { key: 'tashkent', lat: 41.311, lon: 69.279, big: true },
  { key: 'gulistan', lat: 40.49, lon: 68.784, big: false },
  { key: 'jizzakh', lat: 40.116, lon: 67.842, big: false },
  { key: 'samarkand', lat: 39.654, lon: 66.976, big: true },
].map((c) => ({ ...c, ...geoWorld(c.lat, c.lon) }));

const M39 = [
  [41.311, 69.279], [41.112, 69.047], [40.87, 68.8], [40.49, 68.784], [40.33, 68.3],
  [40.116, 67.842], [40.02, 67.59], [39.76, 67.27], [39.654, 66.976],
];
export const TRIP_LEN_M = 300000;
export const MAP_ROAD = smoothTrack(
  M39.map(([la, lo]) => {
    const w = geoWorld(la, lo);
    return [w.x, w.z];
  }),
  150,
  { trueLength: TRIP_LEN_M / TOWN_M },
);
const SAM = CITIES[3];
export const TRIP_DISP_M = Math.hypot(SAM.x - TASHKENT_XZ.x, SAM.z - TASHKENT_XZ.z) * TOWN_M;
export const TRIP_PLAN = trapezoid(TRIP_LEN_M, 75 / 3.6, 0.5);
/** Simulated seconds per real second at speed x1 on the map. */
export const TRIP_SCALE = 420;

export const MAP_PLANE = (() => {
  const c = geoWorld((GEO.latMin + GEO.latMax) / 2, (GEO.lonMin + GEO.lonMax) / 2);
  return {
    x: c.x,
    z: c.z,
    w: ((GEO.lonMax - GEO.lonMin) * GEO.kmLon * 1000) / TOWN_M,
    h: ((GEO.latMax - GEO.latMin) * GEO.kmLat * 1000) / TOWN_M,
  };
})();
export const MAP_CENTER = { x: (TASHKENT_XZ.x + SAM.x) / 2, z: (TASHKENT_XZ.z + SAM.z) / 2 };
export const MAP_FIT = 47000;

/* ------------------------------------------------------------------ */
/* Number formatting (Uzbek: decimal comma, thin space for thousands)  */
/* ------------------------------------------------------------------ */

const THIN = ' ';
export function fmt(v, digits = 0) {
  const s = Math.abs(v).toFixed(digits);
  const zero = Number(s) === 0;
  const [i, f] = s.split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  return (v < 0 && !zero ? '−' : '') + int + (f ? `,${f}` : '');
}

/* ------------------------------------------------------------------ */
/* Canvas textures                                                      */
/* ------------------------------------------------------------------ */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function texture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Furrows for the fields: white with darker rows, tinted by vertex colour. */
export function paintStripes() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(60, 45, 20, 0.30)';
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 6);
  const t = texture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft round spot for glows and halos. */
export function paintGlow() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return texture(c);
}

/** A stopwatch face, 0-60 s. */
export function paintClock(unit) {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.beginPath();
  g.arc(128, 128, 122, 0, Math.PI * 2);
  g.fillStyle = '#f8fafc';
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = '#0f172a';
  g.stroke();
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    const r1 = 112;
    const r0 = big ? 92 : 102;
    g.beginPath();
    g.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0);
    g.lineTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1);
    g.lineWidth = big ? 5 : 2;
    g.strokeStyle = big ? '#0f172a' : '#64748b';
    g.stroke();
  }
  g.fillStyle = '#0f172a';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('0', 128, 66);
  g.fillText('15', 190, 129);
  g.fillText('30', 128, 192);
  g.fillText('45', 66, 129);
  g.font = 'bold 22px sans-serif';
  g.fillStyle = '#0891b2';
  g.fillText(unit, 128, 160);
  return texture(c);
}

/** Falling-water streaks, scrolled down the cliff by the scene. */
export function paintWaterfall() {
  const c = canvas(64, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#7dd3fc';
  g.fillRect(0, 0, 64, 128);
  const R = rng(3);
  for (let i = 0; i < 22; i += 1) {
    const x = R() * 64;
    const w = 1 + R() * 3;
    const y = R() * 128;
    const h = 20 + R() * 60;
    g.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.5})`;
    g.fillRect(x, y, w, h);
    g.fillRect(x, y - 128, w, h);
  }
  const t = texture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Opaque at the top, gone at the bottom: the waterfall turns to mist. */
export function paintFade() {
  const c = canvas(4, 64);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.55, '#d0d0d0');
  grd.addColorStop(1, '#000000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 64);
  return texture(c, false);
}

/** Track, lanes and the football pitch, 48 x 24 units around the stadium centre. */
export function paintStadium(grass) {
  const W = 1024;
  const H = 512;
  const PPU = W / 48;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const X = (x) => (x + 24) * PPU;
  const Y = (z) => (z + 12) * PPU;
  const hs = LAP_S / 2;
  const shape = (r) => {
    g.beginPath();
    g.moveTo(X(-hs), Y(-r));
    g.lineTo(X(hs), Y(-r));
    g.arc(X(hs), Y(0), r * PPU, -Math.PI / 2, Math.PI / 2);
    g.lineTo(X(-hs), Y(r));
    g.arc(X(-hs), Y(0), r * PPU, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  };
  g.fillStyle = grass;
  g.fillRect(0, 0, W, H);
  shape(TRACK_RO + 0.7);
  g.fillStyle = '#d6d3c4';
  g.fill();
  shape(TRACK_RO);
  g.fillStyle = '#c4553b';
  g.fill();
  g.save();
  shape(TRACK_RI);
  g.clip();
  const span = 2 * (hs + TRACK_RI);
  for (let i = 0; i < 18; i += 1) {
    g.fillStyle = i % 2 ? '#4b9d44' : '#57ad4f';
    g.fillRect(X(-hs - TRACK_RI) + (i * span * PPU) / 18, 0, (span * PPU) / 18 + 1, H);
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  for (let k = 0; k <= 6; k += 1) {
    g.lineWidth = k === 0 || k === 6 ? 2.4 : 1.4;
    shape(TRACK_RI + k * TRACK_LANE);
    g.stroke();
  }
  // Finish line (= start for one lap) across the home straight.
  g.fillStyle = '#ffffff';
  g.fillRect(X(hs) - 3, Y(TRACK_RI), 6, (TRACK_RO - TRACK_RI) * PPU);
  for (let i = 0; i < 12; i += 1) {
    g.fillStyle = i % 2 ? '#111827' : '#ffffff';
    g.fillRect(X(hs) + 3, Y(TRACK_RI) + (i * (TRACK_RO - TRACK_RI) * PPU) / 12, 5, ((TRACK_RO - TRACK_RI) * PPU) / 12 + 0.5);
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = 'bold 9px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 6; k += 1) g.fillText(String(k + 1), X(hs) - 12, Y(TRACK_RI + (k + 0.5) * TRACK_LANE));
  // Pitch.
  const PL = 105 / STADIUM_M / 2;
  const PW = 68 / STADIUM_M / 2;
  const u = (m) => (m / STADIUM_M) * PPU;
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 2;
  g.strokeRect(X(-PL), Y(-PW), 2 * PL * PPU, 2 * PW * PPU);
  g.beginPath();
  g.moveTo(X(0), Y(-PW));
  g.lineTo(X(0), Y(PW));
  g.stroke();
  g.beginPath();
  g.arc(X(0), Y(0), u(9.15), 0, Math.PI * 2);
  g.stroke();
  for (const side of [-1, 1]) {
    const gx = side < 0 ? X(-PL) : X(PL) - u(16.5);
    g.strokeRect(gx, Y(0) - u(20.16), u(16.5), u(40.32));
    const gx2 = side < 0 ? X(-PL) : X(PL) - u(5.5);
    g.strokeRect(gx2, Y(0) - u(9.16), u(5.5), u(18.32));
    const gx3 = side < 0 ? X(-PL) - u(1.6) : X(PL);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillRect(gx3, Y(0) - u(3.66), u(1.6), u(7.32));
  }
  return texture(c);
}

/**
 * A stylised map of the Tashkent - Samarkand corridor: lowlands, oases,
 * mountain ranges, the Syr Darya, Chirchiq and Zarafshan, the Aydar lakes.
 * Shapes are hand-placed approximations, good for a sense of distance, not
 * for navigation.
 */
export function paintMap(lakeLabel) {
  const W = 1024;
  const H = 896;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const px = (lon) => ((lon - GEO.lonMin) / (GEO.lonMax - GEO.lonMin)) * W;
  const py = (lat) => ((GEO.latMax - lat) / (GEO.latMax - GEO.latMin)) * H;
  const sx = W / (GEO.lonMax - GEO.lonMin);
  const sy = H / (GEO.latMax - GEO.latMin);
  const R = rng(11);

  g.fillStyle = '#123049';
  g.fillRect(0, 0, W, H);

  const blob = (lat, lon, rLon, rLat, color) => {
    const x = px(lon);
    const y = py(lat);
    const rx = rLon * sx;
    const ry = rLat * sy;
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  // Kyzylkum to the west and north-west: warm sand.
  blob(41.4, 66.3, 0.9, 0.6, 'rgba(120, 96, 52, 0.55)');
  blob(40.9, 66.1, 0.6, 0.4, 'rgba(120, 96, 52, 0.45)');
  blob(41.7, 67.2, 0.8, 0.35, 'rgba(110, 90, 50, 0.35)');
  // Oases and irrigated land: green.
  blob(41.25, 69.25, 0.45, 0.3, 'rgba(46, 125, 78, 0.65)');
  blob(40.6, 68.55, 0.55, 0.35, 'rgba(46, 125, 78, 0.55)');
  blob(40.15, 67.85, 0.3, 0.2, 'rgba(46, 125, 78, 0.5)');
  blob(39.7, 66.9, 0.55, 0.16, 'rgba(46, 125, 78, 0.6)');
  blob(39.75, 67.5, 0.35, 0.12, 'rgba(46, 125, 78, 0.45)');

  // Grid, every half degree.
  for (let lon = 66; lon <= 70.2; lon += 0.5) {
    g.strokeStyle = Number.isInteger(lon) ? 'rgba(103, 232, 249, 0.16)' : 'rgba(103, 232, 249, 0.07)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px(lon), 0);
    g.lineTo(px(lon), H);
    g.stroke();
  }
  for (let lat = 39.5; lat <= 41.9; lat += 0.5) {
    g.strokeStyle = Number.isInteger(lat) ? 'rgba(103, 232, 249, 0.16)' : 'rgba(103, 232, 249, 0.07)';
    g.beginPath();
    g.moveTo(0, py(lat));
    g.lineTo(W, py(lat));
    g.stroke();
  }

  // Mountain ranges as little low-poly peaks.
  const ranges = [
    [[41.95, 69.6], [41.8, 69.95], [41.6, 70.15]],
    [[41.15, 69.85], [40.95, 70.05], [40.8, 70.18]],
    [[39.85, 69.6], [39.75, 69.0], [39.7, 68.5], [39.62, 68.0]],
    [[39.35, 67.9], [39.3, 67.3], [39.25, 66.7], [39.2, 66.2]],
    [[40.6, 66.05], [40.55, 66.6], [40.45, 67.1], [40.38, 67.45]],
    [[39.98, 67.25], [39.92, 67.6], [39.95, 67.95]],
  ];
  for (const rangePts of ranges) {
    for (let i = 0; i < rangePts.length - 1; i += 1) {
      const [la0, lo0] = rangePts[i];
      const [la1, lo1] = rangePts[i + 1];
      const steps = Math.ceil(Math.hypot((lo1 - lo0) * sx, (la1 - la0) * sy) / 9);
      for (let k = 0; k < steps; k += 1) {
        const f = k / steps;
        const x = px(lo0 + (lo1 - lo0) * f) + (R() - 0.5) * 16;
        const y = py(la0 + (la1 - la0) * f) + (R() - 0.5) * 14;
        const s = 6 + R() * 9;
        g.fillStyle = 'rgba(58, 76, 112, 0.95)';
        g.beginPath();
        g.moveTo(x - s, y + s * 0.6);
        g.lineTo(x, y - s);
        g.lineTo(x, y + s * 0.6);
        g.fill();
        g.fillStyle = 'rgba(96, 118, 160, 0.95)';
        g.beginPath();
        g.moveTo(x, y - s);
        g.lineTo(x + s, y + s * 0.6);
        g.lineTo(x, y + s * 0.6);
        g.fill();
        if (s > 11) {
          g.fillStyle = 'rgba(226, 232, 240, 0.85)';
          g.beginPath();
          g.moveTo(x - s * 0.28, y - s * 0.55);
          g.lineTo(x, y - s);
          g.lineTo(x + s * 0.28, y - s * 0.55);
          g.fill();
        }
      }
    }
  }

  // Lakes.
  const lake = (lat, lon, rLon, rLat, rot) => {
    g.save();
    g.translate(px(lon), py(lat));
    g.rotate(rot);
    g.beginPath();
    g.ellipse(0, 0, rLon * sx, rLat * sy, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(37, 120, 190, 0.95)';
    g.fill();
    g.strokeStyle = 'rgba(125, 211, 252, 0.7)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  };
  lake(40.93, 66.55, 0.62, 0.075, -0.1);
  lake(40.84, 66.05, 0.2, 0.07, 0.2);
  lake(40.6, 67.55, 0.22, 0.05, -0.35);
  g.fillStyle = 'rgba(186, 230, 253, 0.85)';
  g.font = 'italic 15px sans-serif';
  g.textAlign = 'center';
  g.fillText(lakeLabel, px(66.6), py(41.07));

  // Rivers.
  const river = (pts, w) => {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const [lw, col] of [[w * 3.2, 'rgba(56, 189, 248, 0.18)'], [w, 'rgba(96, 196, 245, 0.95)']]) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      pts.forEach(([la, lo], i) => (i ? g.lineTo(px(lo), py(la)) : g.moveTo(px(lo), py(la))));
      g.stroke();
    }
  };
  river([[40.25, 70.2], [40.22, 69.6], [40.22, 69.27], [40.4, 69.05], [40.62, 68.88], [40.84, 68.7], [40.98, 68.62], [41.2, 68.35], [41.45, 68.1], [41.9, 67.75]], 3);
  river([[41.72, 70.05], [41.5, 69.62], [41.3, 69.38], [41.18, 69.2], [41.05, 68.98], [40.95, 68.77]], 2);
  river([[39.42, 68.5], [39.5, 67.85], [39.6, 67.45], [39.68, 67.1], [39.72, 66.85], [39.78, 66.45], [39.86, 66.0]], 2.4);

  // Fade to transparent at the edges so the map floats.
  g.globalCompositeOperation = 'destination-in';
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(1, H / W);
  const fade = g.createRadialGradient(0, 0, W * 0.3, 0, 0, W * 0.56);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(-W, -W, W * 2, W * 2);
  g.restore();
  g.globalCompositeOperation = 'source-over';
  return texture(c);
}
