import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { ReleaseContextOnUnmount } from '@/views/explore/lab/Hologram';
import { LAB_DPR } from '@/views/explore/lab/LabCanvas';
import {
  BUS_LEN_M,
  CHINOR,
  CITIES,
  FRAME_ORIGIN,
  GARAGE,
  GARAGE_PLAN,
  GARAGE_TARGET,
  GARAGE_TRACK,
  LAP,
  LAP_S,
  MAP_CENTER,
  MAP_FIT,
  MAP_PLANE,
  MAP_ROAD,
  MAP_Y,
  PLANS,
  ROAD,
  STADIUM,
  STADIUM_M,
  TASHKENT_XZ,
  TRACK_RO,
  TOWN_M,
  TRIP_PLAN,
  TRIP_SCALE,
  clamp,
  easeInOut,
  fmt,
  lerp,
  paintGlow,
  paintMap,
  smoothstep,
} from './Variant3DScene.world';
import {
  Axes3D,
  Bus,
  Clock3D,
  PARKED_BUS,
  Runner,
  StadiumIsland,
  Tag,
  TownIsland,
  ribbonGeometry,
  writeRibbon,
} from './Variant3DScene.models';

const CYAN = '#22d3ee';
const VIOLET = '#a78bfa';
const AMBER = '#fbbf24';

/* ------------------------------------------------------------------ */
/* Live state: written by the Director once per frame, read by the rest */
/* ------------------------------------------------------------------ */

function makeLive() {
  const a = ROAD.point(0);
  const l = LAP.point(0);
  return {
    t: 0,
    gT: 0,
    mT: 0,
    zoomS: 0,
    viewW: 20,
    camDist: 10,
    pxW: 800,
    ratio: 1,
    route: { s: 0, path: 0, turn: 0, back: false, phase: 'idle', disp: 0, x: a.x, z: a.z, sx: a.x, sz: a.z, total: 1 },
    bus: { x: a.x, z: a.z, ry: 0 },
    runner: { x: l.x, z: l.z, ry: 0, stride: 0, amp: 0, last: 0 },
    garage: { path: 0, phase: 'idle' },
    trip: { s: 0, x: TASHKENT_XZ.x, z: TASHKENT_XZ.z, path: 0, disp: 0, phase: 'idle' },
    phaseKey: '',
  };
}

const P = { x: 0, z: 0 };
const TN = { x: 1, z: 0 };

function put(el, s) {
  if (el && el.__v !== s) {
    el.textContent = s;
    el.__v = s;
  }
}
function bar(el, f) {
  if (!el) return;
  const w = `${(clamp(f, 0, 1) * 100).toFixed(1)}%`;
  if (el.__w !== w) {
    el.style.width = w;
    el.__w = w;
  }
}

function fmtDist(m, u) {
  if (m < 1000) return `${fmt(m)} ${u.m}`;
  return `${fmt(m / 1000, m < 10000 ? 1 : 0)} ${u.km}`;
}
function fmtPct(r) {
  const p = r * 100;
  if (p >= 10) return `${fmt(p)} %`;
  if (p >= 1) return `${fmt(p, 1)} %`;
  if (p >= 0.1) return `${fmt(p, 2)} %`;
  return `${fmt(p, 3)} %`;
}

function Director({ cfg, live, dom }) {
  useFrame((state, raw) => {
    const c = cfg.current;
    const dt = Math.min(raw, 0.1);
    const u = c.uz.units;
    const plan = PLANS[c.route];
    const finish = () => {
      c.playing = false;
      c.onFinish();
    };

    // Clocks.
    if (c.playing) {
      if (c.mode === 'point') {
        if (c.scenario === 'garage') {
          if (live.gT >= GARAGE_PLAN.T) live.gT = 0;
          live.gT = Math.min(GARAGE_PLAN.T, live.gT + dt * c.speed);
          if (live.gT >= GARAGE_PLAN.T) finish();
        } else {
          if (live.mT >= TRIP_PLAN.T) live.mT = 0;
          live.mT = Math.min(TRIP_PLAN.T, live.mT + dt * c.speed * TRIP_SCALE);
          if (live.mT >= TRIP_PLAN.T) finish();
        }
      } else {
        if (live.t >= plan.T) live.t = 0;
        live.t = Math.min(plan.T, live.t + dt * c.speed);
        if (live.t >= plan.T) finish();
      }
    }

    // The route (A -> B, A -> B -> A or the lap).
    const R = live.route;
    plan.run(live.t, R);
    const lap = c.route === 'lap';
    const track = lap ? LAP : ROAD;
    const mpu = lap ? STADIUM_M : TOWN_M;
    track.point(R.s, P);
    track.tangent(R.s, TN);
    R.x = P.x;
    R.z = P.z;
    R.sx = track.p[0][0];
    R.sz = track.p[0][1];
    R.disp = Math.hypot(R.x - R.sx, R.z - R.sz) * mpu;
    if (R.phase === 'done' && (c.route === 'aba' || lap)) R.disp = 0;
    R.total = plan.total;
    const ry = Math.atan2(-TN.z, TN.x) + (c.route === 'aba' ? Math.PI * R.turn : 0);

    // Bus pose.
    const bus = live.bus;
    if (c.mode === 'point') {
      const m = GARAGE_PLAN.at(live.gT);
      GARAGE_TRACK.point(m / TOWN_M, P);
      GARAGE_TRACK.tangent(m / TOWN_M, TN);
      bus.x = P.x;
      bus.z = P.z;
      bus.ry = Math.atan2(-TN.z, TN.x);
      live.garage.path = m;
      live.garage.phase = live.gT <= 0 ? 'idle' : live.gT >= GARAGE_PLAN.T ? 'done' : 'run';
    } else if (!lap) {
      bus.x = R.x;
      bus.z = R.z;
      bus.ry = ry;
    } else {
      ROAD.point(0, P);
      ROAD.tangent(0, TN);
      bus.x = P.x;
      bus.z = P.z;
      bus.ry = Math.atan2(-TN.z, TN.x);
    }

    // Runner pose.
    const run = live.runner;
    if (lap && c.mode === 'path') {
      run.x = R.x;
      run.z = R.z;
      run.ry = ry;
      run.stride = Math.max(0, R.path - run.last) * 1.25;
      run.last = R.path;
      const moving = R.phase === 'run1' || R.phase === 'run2';
      run.amp += ((moving ? 1 : 0) - run.amp) * Math.min(1, dt * 6);
    } else {
      LAP.point(0, P);
      LAP.tangent(0, TN);
      run.x = P.x;
      run.z = P.z;
      run.ry = Math.atan2(-TN.z, TN.x);
      run.stride = 0;
      run.last = 0;
      run.amp += (0 - run.amp) * Math.min(1, dt * 6);
    }

    // Zoom (smoothed) and the trip on the map.
    live.zoomS += (c.zoom - live.zoomS) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(c.zoom - live.zoomS) < 1e-4) live.zoomS = c.zoom;
    const tr = live.trip;
    tr.path = TRIP_PLAN.at(live.mT);
    tr.s = tr.path / TOWN_M;
    MAP_ROAD.point(tr.s, P);
    tr.x = P.x;
    tr.z = P.z;
    tr.disp = Math.hypot(tr.x - TASHKENT_XZ.x, tr.z - TASHKENT_XZ.z) * TOWN_M;
    tr.phase = live.mT <= 0 ? 'idle' : live.mT >= TRIP_PLAN.T ? 'done' : 'run';
    const viewM = live.viewW * TOWN_M;
    live.ratio = BUS_LEN_M / Math.max(1e-6, viewM);

    // Which sentence to show.
    let key;
    if (c.mode === 'path') key = `${c.route}_${R.phase}`;
    else if (c.mode === 'frame') key = `frame_${c.frame}`;
    else if (live.zoomS >= 0.78) key = tr.phase === 'run' ? 'pt_trip' : tr.phase === 'done' ? 'pt_tripdone' : 'pt_map';
    else if (live.ratio >= 0.1) key = live.garage.phase === 'done' ? 'pt_street_done' : 'pt_street';
    else if (live.ratio >= 0.01) key = 'pt_mid';
    else key = 'pt_point';
    if (key !== live.phaseKey) {
      live.phaseKey = key;
      c.onPhase(key);
    }

    // Readouts, straight into the DOM.
    const d = dom.current;
    if (c.mode === 'path') {
      put(d.t, `${fmt(live.t, 1)} ${u.s}`);
      put(d.s, `${fmt(R.path)} ${u.m}`);
      put(d.d, `${fmt(R.disp)} ${u.m}`);
      put(d.arrow, `${fmt(R.disp)} ${u.m}`);
      bar(d.sBar, R.path / R.total);
      bar(d.dBar, R.disp / R.total);
    } else if (c.mode === 'frame') {
      put(d.t, `${fmt(live.t, 1)} ${u.s}`);
      if (c.frame === 'ground') {
        put(d.bx, fmt((bus.x - FRAME_ORIGIN.x) * TOWN_M));
        put(d.bz, fmt((bus.z - FRAME_ORIGIN.z) * TOWN_M));
        put(d.tx, '0');
        put(d.tz, '0');
      } else {
        const fx = Math.cos(bus.ry);
        const fz = -Math.sin(bus.ry);
        const vx = FRAME_ORIGIN.x - bus.x;
        const vz = FRAME_ORIGIN.z - bus.z;
        put(d.bx, '0');
        put(d.bz, '0');
        put(d.tx, fmt((vx * fx + vz * fz) * TOWN_M));
        put(d.tz, fmt((vx * -fz + vz * fx) * TOWN_M));
      }
      put(d.by, '0');
      put(d.ty, '0');
    } else {
      put(d.view, fmtDist(viewM, u));
      put(d.ratio, fmtPct(live.ratio));
      const h = Math.floor(live.mT / 3600);
      const mi = Math.floor((live.mT % 3600) / 60);
      put(d.t, `${fmt(live.mT)} ${u.s}`);
      put(d.tH, `≈ ${h} ${u.h} ${mi} ${u.min}`);
      put(d.s, `${fmt(tr.path / 1000)} ${u.km}`);
      put(d.d, `${fmt(tr.disp / 1000)} ${u.km}`);
      put(d.tripArrow, `${fmt(tr.disp / 1000)} ${u.km}`);
      // A scale bar about 90 px long, rounded to 1, 2 or 5 x 10^n.
      const pxPerM = live.pxW / Math.max(1e-6, viewM);
      const want = 90 / pxPerM;
      const p10 = 10 ** Math.floor(Math.log10(want));
      const nice = [5, 2, 1].map((k) => k * p10).find((v) => v <= want * 1.15) || p10;
      if (d.scaleBar) {
        const w = `${Math.round(nice * pxPerM)}px`;
        if (d.scaleBar.__w !== w) {
          d.scaleBar.style.width = w;
          d.scaleBar.__w = w;
        }
      }
      put(d.scaleLabel, nice >= 1000 ? `${fmt(nice / 1000)} ${u.km}` : `${fmt(nice)} ${u.m}`);
    }
  }, -2);
  return null;
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

const VIEWS = {
  // n* are for portrait-ish screens: the long side of the island is turned to run up the screen.
  town: { x: 0, z: 0, hx: 46, hz: 30, az: 0.3, el: 0.84, nx: 44, nz: 29, naz: 1.22, nel: 0.98 },
  ground: { x: -12, z: -2, hx: 27, hz: 19, az: -0.42, el: 0.8, nx: 21, nz: 17, naz: -0.42, nel: 0.86 },
  stadium: { x: STADIUM.cx, z: STADIUM.cz, hx: 30.6, hz: 19.6, az: 0.22, el: 0.8, nx: 29, nz: 19, naz: 1.3, nel: 0.95 },
};

/**
 * Distance at which a view's box (island top down to the slab's underside)
 * fills the frame: start from a guess and rescale by how far the corners
 * project outside the screen. Cached per view and aspect ratio.
 */
const fitCam = new THREE.PerspectiveCamera();
const fitCache = new Map();
const _corner = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
function fitView(name, v, fov, aspect) {
  const key = `${name}|${fov}|${aspect.toFixed(2)}`;
  const hit = fitCache.get(key);
  if (hit) return hit;
  const narrow = aspect < 1.3;
  const hx = narrow ? v.nx : v.hx;
  const hz = narrow ? v.nz : v.hz;
  const az = narrow ? v.naz : v.az;
  const el = narrow ? v.nel : v.el;
  // Desktop keeps the bottom free for the caption; phones keep the top free for the readouts.
  const c0 = narrow ? -0.13 : 0.05;
  const fill = narrow ? 0.8 : 0.88;
  fitCam.fov = fov;
  fitCam.aspect = aspect;
  fitCam.near = 0.1;
  fitCam.far = 5000;
  fitCam.updateProjectionMatrix();
  const dx = Math.sin(az) * Math.cos(el);
  const dy = Math.sin(el);
  const dz = Math.cos(az) * Math.cos(el);
  const t = new THREE.Vector3(v.x, 0, v.z);
  let dist = hx * 2;
  const tanV = Math.tan((fov * Math.PI) / 360);
  for (let it = 0; it < 10; it += 1) {
    fitCam.position.set(t.x + dx * dist, t.y + dy * dist, t.z + dz * dist);
    fitCam.lookAt(t);
    fitCam.updateMatrixWorld();
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const y of [-3.6, 4]) {
          _corner.set(v.x + sx * hx, y, v.z + sz * hz).project(fitCam);
          x0 = Math.min(x0, _corner.x);
          x1 = Math.max(x1, _corner.x);
          y0 = Math.min(y0, _corner.y);
          y1 = Math.max(y1, _corner.y);
        }
      }
    }
    // Centre the box on screen, then scale the distance so it fills the frame.
    const H = dist * tanV;
    _right.setFromMatrixColumn(fitCam.matrixWorld, 0);
    _up.setFromMatrixColumn(fitCam.matrixWorld, 1);
    t.addScaledVector(_right, ((x0 + x1) / 2) * H * aspect).addScaledVector(_up, ((y0 + y1) / 2 - c0) * H);
    dist *= Math.max((x1 - x0) / 2 / 0.95, (y1 - y0) / 2 / fill);
  }
  const out = { dist, x: t.x, y: t.y, z: t.z, dx, dy, dz };
  fitCache.set(key, out);
  return out;
}

const V = () => new THREE.Vector3();

function computeGoal(c, live, camera, size, pos, target) {
  const aspect = size.width / Math.max(1, size.height);
  const tv = Math.tan((camera.fov * Math.PI) / 360);
  const th = tv * aspect;
  if (c.mode === 'point') {
    const dMin = Math.max(20, 12 / th);
    const dMax = MAP_FIT / Math.min(tv, th);
    const z = live.zoomS;
    const d = dMin * (dMax / dMin) ** z;
    const w = (d / dMax) ** 1.5;
    // At street level the camera leans a little towards the bus as it drives in.
    const f = 0.4 * (1 - smoothstep(0, 0.18, z));
    const sx = lerp(GARAGE_TARGET.x, live.bus.x, f);
    const sz = lerp(GARAGE_TARGET.z, live.bus.z, f);
    target.set(
      lerp(sx, MAP_CENTER.x, w),
      lerp(GARAGE_TARGET.y, MAP_Y, smoothstep(0.3, 0.8, z)),
      lerp(sz, MAP_CENTER.z + MAP_FIT * 0.1, w),
    );
    const el = lerp(0.82, 1.12, smoothstep(0.1, 0.9, z));
    const az = lerp(0.12, 0, smoothstep(0.05, 0.85, z));
    pos.set(
      target.x + Math.sin(az) * Math.cos(el) * d,
      target.y + Math.sin(el) * d,
      target.z + Math.cos(az) * Math.cos(el) * d,
    );
    live.camDist = d;
    live.viewW = 2 * d * th;
    live.pxW = size.width;
    return 'follow';
  }
  if (c.mode === 'frame' && c.frame === 'bus') {
    const b = live.bus;
    const fx = Math.cos(b.ry);
    const fz = -Math.sin(b.ry);
    const local = (lx, ly, lz, out) => out.set(b.x + fx * lx - fz * lz, ly, b.z + fz * lx + fx * lz);
    // Behind and above the bus, a little to its right; higher on a phone so houses by the road do not get in the way.
    if (aspect < 1.1) {
      local(-10.5, 9.5, 4.6, pos);
      local(1.8, 1.6, 0, target);
    } else {
      local(-7.6, 5.0, 6.0, pos);
      local(1.2, 0.9, 0, target);
    }
    return 'follow';
  }
  const name = c.mode === 'frame' ? 'ground' : c.route === 'lap' ? 'stadium' : 'town';
  const v = VIEWS[name];
  const f = fitView(name, v, camera.fov, aspect);
  target.set(f.x, f.y, f.z);
  pos.set(f.x + f.dx * f.dist, f.y + f.dy * f.dist, f.z + f.dz * f.dist);
  return 'orbit';
}

function CameraRig({ cfg, live, viewKey }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls);
  const look = useRef(V());
  const goalPos = useMemo(V, []);
  const goalTarget = useMemo(V, []);
  const tmp = useMemo(() => ({ o0: V(), o1: V() }), []);
  const flight = useRef({ t: 1, dur: 1.5, fromPos: V(), fromTarget: V() });
  const key = `${viewKey}|${Math.round(size.width / 60)}x${Math.round(size.height / 60)}`;

  useEffect(() => {
    const f = flight.current;
    f.t = 0;
    f.fromPos.copy(camera.position);
    f.fromTarget.copy(look.current);
  }, [key, camera]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.1);
    const c = cfg.current;
    const kind = computeGoal(c, live, camera, size, goalPos, goalTarget);
    const f = flight.current;
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = easeInOut(f.t);
      const { o0, o1 } = tmp;
      o0.subVectors(f.fromPos, f.fromTarget);
      o1.subVectors(goalPos, goalTarget);
      const d0 = Math.max(1e-3, o0.length());
      const d1 = Math.max(1e-3, o1.length());
      o0.divideScalar(d0).lerp(o1.divideScalar(d1), e);
      if (o0.lengthSq() < 1e-6) o0.set(0, 1, 0);
      o0.normalize();
      const dist = Math.exp(lerp(Math.log(d0), Math.log(d1), e));
      look.current.lerpVectors(f.fromTarget, goalTarget, e);
      camera.position.copy(look.current).addScaledVector(o0, dist);
      camera.lookAt(look.current);
      if (controls) controls.enabled = false;
      if (f.t >= 1 && kind === 'orbit' && controls) {
        controls.target.copy(goalTarget);
        const gd = goalPos.distanceTo(goalTarget);
        controls.minDistance = gd * 0.3;
        controls.maxDistance = gd * 1.6;
        controls.update();
        controls.enabled = true;
      }
    } else if (kind === 'follow') {
      camera.position.copy(goalPos);
      look.current.copy(goalTarget);
      camera.lookAt(look.current);
      if (controls) controls.enabled = false;
    } else if (controls) {
      if (!controls.enabled) {
        controls.target.copy(look.current);
        controls.enabled = true;
      }
      look.current.copy(controls.target);
    }
    const dist = camera.position.distanceTo(look.current);
    const near = clamp(dist / 220, 0.04, 4000);
    const far = Math.max(1200, dist * 4);
    if (Math.abs(camera.near - near) > near * 0.03 || Math.abs(camera.far - far) > far * 0.03) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Light: the sun's shadow box follows whatever the lesson looks at     */
/* ------------------------------------------------------------------ */

function Lights({ cfg, live }) {
  const light = useRef(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const L = light.current;
    if (!L) return;
    const c = cfg.current;
    let cx = 0;
    let cz = 0;
    let r = 56;
    if (c.mode === 'point' && live.zoomS < 0.22) {
      cx = -40;
      cz = 13;
      r = 19;
    } else if (c.mode === 'path' && c.route === 'lap') {
      cx = STADIUM.cx;
      cz = STADIUM.cz;
      r = 34;
    }
    L.position.set(cx + 26, 52, cz + 30);
    target.position.set(cx, 0, cz);
    target.updateMatrixWorld();
    const sc = L.shadow.camera;
    if (sc.right !== r) {
      sc.left = -r;
      sc.right = r;
      sc.top = r;
      sc.bottom = -r;
      sc.updateProjectionMatrix();
    }
  });
  return (
    <>
      <hemisphereLight args={['#dbeafe', '#56602c', 1.15]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        ref={light}
        castShadow
        intensity={2.5}
        color="#fff1dc"
        target={target}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={150}
      />
      <primitive object={target} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Trajectory, displacement, markers                                    */
/* ------------------------------------------------------------------ */

function useGlowTexture() {
  const tex = useMemo(() => paintGlow(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function trailMaterials(color) {
  return {
    core: new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
    glow: new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  };
}

/** The glowing line the body leaves behind; the round trip leaves two, side by side. */
function RouteTrail({ routeId, live }) {
  const glowTex = useGlowTexture();
  const res = useMemo(() => {
    const track = routeId === 'lap' ? LAP : ROAD;
    const y = routeId === 'lap' ? 0.05 : 0.07;
    const lanes = routeId === 'aba'
      ? [
          { pts: track.p, off: 0.32, color: CYAN },
          { pts: [...track.p].reverse(), off: 0.32, color: VIOLET },
        ]
      : [{ pts: track.p, off: 0, color: CYAN }];
    const parts = lanes.map((l) => ({
      core: ribbonGeometry(l.pts, 0.38, y + 0.012, l.off),
      glow: ribbonGeometry(l.pts, 1.3, y, l.off),
      mats: trailMaterials(l.color),
    }));
    const head = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: CYAN,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const headGeo = new THREE.PlaneGeometry(1, 1);
    return { track, parts, head, headGeo, y };
  }, [routeId, glowTex]);
  useEffect(
    () => () => {
      res.parts.forEach((p) => {
        p.core.dispose();
        p.glow.dispose();
        p.mats.core.dispose();
        p.mats.glow.dispose();
      });
      res.head.dispose();
      res.headGeo.dispose();
    },
    [res],
  );
  const headRef = useRef(null);
  const markerRef = useRef(null);
  useFrame((state) => {
    const R = live.route;
    const n = res.track.n;
    const i = res.track.index(R.s);
    const counts = routeId === 'aba'
      ? [R.back || R.phase === 'atB' || R.phase === 'done' ? n - 1 : i, R.phase === 'done' ? n - 1 : R.back ? Math.max(0, n - 2 - i) : 0]
      : [R.phase === 'done' ? n - 1 : i];
    res.parts.forEach((p, k) => {
      p.core.setDrawRange(0, counts[k] * 6);
      p.glow.setDrawRange(0, counts[k] * 6);
    });
    if (headRef.current) {
      const s = (routeId === 'lap' ? 2.6 : 3.4) * (1 + Math.sin(state.clock.elapsedTime * 4) * 0.08);
      headRef.current.position.set(R.x, res.y + 0.03, R.z);
      headRef.current.scale.set(s, s, s);
    }
    if (markerRef.current) {
      const t = state.clock.elapsedTime;
      const h = routeId === 'lap' ? 3.6 : 3.3;
      markerRef.current.position.set(R.x, h + Math.sin(t * 3) * 0.18, R.z);
      markerRef.current.rotation.y = t * 1.5;
    }
  });
  return (
    <group>
      {res.parts.map((p, k) => (
        <group key={k}>
          <mesh geometry={p.glow} material={p.mats.glow} renderOrder={3} />
          <mesh geometry={p.core} material={p.mats.core} renderOrder={4} />
        </group>
      ))}
      <mesh ref={headRef} geometry={res.headGeo} material={res.head} rotation-x={-Math.PI / 2} renderOrder={5} />
      <group ref={markerRef}>
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.8, 1.6, 4]} />
          <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.7} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/**
 * An arrow from `start` to `end` on the ground plane. The solid copy is lit
 * and depth-tested; the x-ray copy shows through houses and trees, so the
 * displacement is always visible.
 */
function GroundArrow({ getEnds, children, labelLift = 1 }) {
  const root = useRef(null);
  const parts = useRef({});
  const label = useRef(null);
  const ends = useMemo(() => ({ sx: 0, sz: 0, ex: 0, ez: 0, y: 0.8, r: 0.16, hl: 1.4, hr: 0.5, show: true }), []);
  const res = useMemo(() => {
    const geos = { shaft: new THREE.CylinderGeometry(1, 1, 1, 12), head: new THREE.ConeGeometry(1, 1, 18) };
    const mats = {
      solid: new THREE.MeshStandardMaterial({ color: AMBER, emissive: '#f59e0b', emissiveIntensity: 0.55, roughness: 0.35 }),
      xray: new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false, toneMapped: false }),
    };
    return { geos, mats };
  }, []);
  useEffect(
    () => () => {
      Object.values(res.geos).forEach((g) => g.dispose());
      Object.values(res.mats).forEach((m) => m.dispose());
    },
    [res],
  );
  useFrame(() => {
    getEnds(ends);
    const dx = ends.ex - ends.sx;
    const dz = ends.ez - ends.sz;
    const len = Math.hypot(dx, dz);
    const visible = ends.show && len > ends.hl * 0.35;
    if (root.current) {
      root.current.visible = visible;
      root.current.position.set(ends.sx, ends.y, ends.sz);
      root.current.rotation.y = Math.atan2(-dz, dx);
    }
    if (visible) {
      const hl = Math.min(ends.hl, len * 0.45);
      const sl = Math.max(0.001, len - hl);
      const hr = ends.hr * Math.min(1, hl / ends.hl + 0.25);
      const { shaft, head, shaftX, headX } = parts.current;
      for (const m of [shaft, shaftX]) {
        if (!m) continue;
        m.scale.set(ends.r, sl, ends.r);
        m.position.set(0, sl / 2, 0);
      }
      for (const m of [head, headX]) {
        if (!m) continue;
        m.scale.set(hr, hl, hr);
        m.position.set(0, sl + hl / 2, 0);
      }
    }
    if (label.current) {
      const far = len > ends.hl * 0.35;
      label.current.position.set(far ? (ends.sx + ends.ex) / 2 : ends.sx, ends.y + labelLift, far ? (ends.sz + ends.ez) / 2 : ends.sz);
      label.current.visible = ends.show;
    }
  });
  const reg = (k) => (el) => {
    parts.current[k] = el;
  };
  return (
    <group>
      <group ref={root}>
        <group rotation-z={-Math.PI / 2}>
          <mesh ref={reg('shaft')} geometry={res.geos.shaft} material={res.mats.solid} castShadow />
          <mesh ref={reg('head')} geometry={res.geos.head} material={res.mats.solid} castShadow />
          <mesh ref={reg('shaftX')} geometry={res.geos.shaft} material={res.mats.xray} renderOrder={8} />
          <mesh ref={reg('headX')} geometry={res.geos.head} material={res.mats.xray} renderOrder={8} />
        </group>
      </group>
      <group ref={label}>{children}</group>
    </group>
  );
}

function RouteArrow({ live, routeId, uz, bind, showLabel }) {
  const lap = routeId === 'lap';
  const ring = useRef(null);
  const getEnds = (e) => {
    const R = live.route;
    e.sx = R.sx;
    e.sz = R.sz;
    e.ex = R.x;
    e.ez = R.z;
    e.y = lap ? 0.6 : 0.95;
    e.r = lap ? 0.16 : 0.24;
    e.hl = lap ? 1.3 : 2.0;
    e.hr = lap ? 0.5 : 0.72;
    e.show = true;
  };
  useFrame((state) => {
    const R = live.route;
    if (!ring.current) return;
    // Back where it started: the displacement is a point, drawn as a pulsing ring.
    const back = R.path > 5 && R.disp < 1.5;
    ring.current.visible = back;
    const s = (lap ? 1.6 : 2.0) * (1 + Math.sin(state.clock.elapsedTime * 4) * 0.12);
    ring.current.position.set(R.sx, 0.12, R.sz);
    ring.current.scale.set(s, s, s);
  });
  return (
    <group>
      <GroundArrow getEnds={getEnds} labelLift={lap ? 1.0 : 1.3}>
        {showLabel ? (
          <Tag tone="amber">
            {uz.sym.d} = <span ref={bind('arrow')} />
          </Tag>
        ) : null}
      </GroundArrow>
      <mesh ref={ring} rotation-x={-Math.PI / 2} renderOrder={6}>
        <torusGeometry args={[1, 0.09, 8, 48]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Pin({ x, z, color, label, tone, shift = false }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 2.35, 0]} castShadow>
        <sphereGeometry args={[0.34, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <Tag position={[0, 3.3, 0]} tone={tone} className={shift ? 'ml-[72px]' : ''}>
        {label}
      </Tag>
    </group>
  );
}

function RouteMarkers({ routeId, uz }) {
  if (routeId === 'lap') {
    return (
      <group>
        <Pin x={STADIUM.cx + LAP_S / 2} z={STADIUM.cz + TRACK_RO + 0.75} color={AMBER} tone="amber" label={uz.labels.start} />
      </group>
    );
  }
  const a = ROAD.p[0];
  const b = ROAD.p[ROAD.n - 1];
  return (
    <group>
      <Pin x={a[0] - 3.4} z={a[1] - 1.2} color={AMBER} tone="amber" label={uz.labels.A} shift />
      <Pin x={b[0] + 0.3} z={b[1] - 1.8} color="#e2e8f0" tone="slate" label={uz.labels.B} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Reference frames                                                    */
/* ------------------------------------------------------------------ */

function ClockPost({ live, height, radius }) {
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.06, radius * 0.08, height, 8]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <group position={[0, height + radius, 0]}>
        <Clock3D live={live} radius={radius} />
      </group>
    </group>
  );
}

function GroundFrame({ live, uz }) {
  return (
    <group>
      <group position={[FRAME_ORIGIN.x, 0.08, FRAME_ORIGIN.z]}>
        <Axes3D length={11} radius={0.26} />
        <group position={[-3.2, 0, -1.6]}>
          <ClockPost live={live} height={3.6} radius={1.45} />
        </group>
      </group>
      <Tag position={[CHINOR.x - 4.6, 5.6, CHINOR.z - 1.2]} tone="emerald">
        {uz.labels.chinorRef}
      </Tag>
    </group>
  );
}

function BusFrame({ live, uz }) {
  return (
    <group>
      <group position={[0, 1.16, 0]}>
        <Axes3D length={3.4} radius={0.065} />
      </group>
      <group position={[-1.35, 1.12, 0]}>
        <ClockPost live={live} height={0.5} radius={0.5} />
      </group>
      <Tag position={[-1.6, 3.15, 0]} tone="violet">
        {uz.labels.busRef}
      </Tag>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Material point: garage measurements and the map                      */
/* ------------------------------------------------------------------ */

function BusRuler({ uz }) {
  const L = BUS_LEN_M / TOWN_M;
  return (
    <group position={[0, 1.45, 0]}>
      <mesh>
        <boxGeometry args={[L, 0.035, 0.035]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {[-L / 2, L / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.035, 0.32, 0.035]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      <Tag position={[0, 0.42, 0]} tone="rose">
        {uz.labels.bus}
      </Tag>
    </group>
  );
}

function GarageRuler({ uz }) {
  const len = GARAGE.zFront - GARAGE.zBack;
  const x = GARAGE.x1 + GARAGE.bay / 2 + GARAGE.wall + 0.3;
  const y = 0.12;
  const cz = (GARAGE.zBack + GARAGE.zFront) / 2;
  return (
    <group position={[x, y, cz]}>
      <mesh>
        <boxGeometry args={[0.035, 0.035, len]} />
        <meshBasicMaterial color="#fde68a" toneMapped={false} />
      </mesh>
      {[-len / 2, len / 2].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[0.035, 0.32, 0.035]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} />
        </mesh>
      ))}
      <Tag position={[1.1, 0.3, 0.4]} tone="amber">
        {uz.labels.garage}
      </Tag>
    </group>
  );
}

const MAP_PTS = MAP_ROAD.p;

function MapLayer({ live, uz, bind, showCities, showTrip, showPoint }) {
  const glowTex = useGlowTexture();
  const res = useMemo(() => {
    const tex = paintMap(uz.labels.lake);
    const plane = new THREE.PlaneGeometry(MAP_PLANE.w, MAP_PLANE.h);
    const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
    const road = ribbonGeometry(MAP_PTS, 1, MAP_Y + 2);
    const trail = ribbonGeometry(MAP_PTS, 1, MAP_Y + 3);
    const over = (color, opacity) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false });
    const roadMat = over('#e2e8f0', 0.5);
    const trailMat = over(CYAN, 1);
    const disc = new THREE.CircleGeometry(1, 28);
    const cityMat = over('#f8fafc', 1);
    const ringMat = over('#22d3ee', 0.5);
    const dot = new THREE.SphereGeometry(1, 20, 14);
    const dotMat = over('#cffafe', 1);
    const halo = new THREE.PlaneGeometry(1, 1);
    const haloMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: CYAN,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { tex, plane, planeMat, road, trail, roadMat, trailMat, disc, cityMat, ringMat, dot, dotMat, halo, haloMat, width: 0 };
  }, [uz.labels.lake, glowTex]);
  useEffect(
    () => () => {
      Object.values(res).forEach((v) => v?.dispose?.());
    },
    [res],
  );
  const planeRef = useRef(null);
  const overlay = useRef(null);
  const cities = useRef([]);
  const dotRef = useRef(null);
  const haloRef = useRef(null);
  const dotLabel = useRef(null);

  useFrame((state) => {
    const d = live.camDist;
    const mapA = smoothstep(3000, 15000, d);
    res.planeMat.opacity = mapA;
    if (planeRef.current) planeRef.current.visible = mapA > 0.01;
    const overA = smoothstep(5000, 20000, d);
    res.roadMat.opacity = 0.5 * overA;
    res.trailMat.opacity = overA;
    res.cityMat.opacity = overA;
    res.ringMat.opacity = 0.45 * overA;
    if (overlay.current) overlay.current.visible = overA > 0.01;
    // Lines keep a constant on-screen width: rewrite the ribbons when the zoom changes enough.
    const w = d * 0.0042;
    if (Math.abs(w - res.width) > res.width * 0.04) {
      res.width = w;
      writeRibbon(res.road.attributes.position.array, MAP_PTS, w * 0.7, MAP_Y + 2);
      res.road.attributes.position.needsUpdate = true;
      writeRibbon(res.trail.attributes.position.array, MAP_PTS, w * 1.5, MAP_Y + 3);
      res.trail.attributes.position.needsUpdate = true;
      res.road.computeBoundingSphere();
      res.trail.computeBoundingSphere();
    }
    res.trail.setDrawRange(0, MAP_ROAD.index(live.trip.s) * 6);
    cities.current.forEach((m, i) => {
      if (!m) return;
      const s = d * (CITIES[i].big ? 0.011 : 0.007);
      m.scale.set(s, s, s);
    });
    // The bus, seen from far enough away, is a glowing dot.
    const dotA = smoothstep(0.03, 0.008, live.ratio);
    const tr = live.trip;
    const y = lerp(0.8, MAP_Y + 4, smoothstep(0.45, 0.72, live.zoomS));
    const atGarage = tr.s <= 0;
    const x = atGarage ? live.bus.x : tr.x;
    const z = atGarage ? live.bus.z : tr.z;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.12;
    if (dotRef.current) {
      dotRef.current.visible = dotA > 0.01;
      dotRef.current.position.set(x, y, z);
      const s = d * 0.0075;
      dotRef.current.scale.set(s, s, s);
      res.dotMat.opacity = dotA;
    }
    if (haloRef.current) {
      haloRef.current.visible = dotA > 0.01;
      haloRef.current.position.set(x, y, z);
      haloRef.current.quaternion.copy(state.camera.quaternion);
      const s = d * 0.07 * pulse;
      haloRef.current.scale.set(s, s, s);
      res.haloMat.opacity = dotA * 0.9;
    }
    if (dotLabel.current) dotLabel.current.position.set(x, y, z);
  });

  const getEnds = (e) => {
    e.sx = TASHKENT_XZ.x;
    e.sz = TASHKENT_XZ.z;
    e.ex = live.trip.x;
    e.ez = live.trip.z;
    e.y = MAP_Y + 5;
    const d = live.camDist;
    e.r = d * 0.0021;
    e.hl = d * 0.03;
    e.hr = d * 0.009;
    e.show = live.zoomS > 0.6 && live.trip.s > 0;
  };

  return (
    <group>
      <mesh ref={planeRef} geometry={res.plane} material={res.planeMat} position={[MAP_PLANE.x, MAP_Y, MAP_PLANE.z]} rotation-x={-Math.PI / 2} renderOrder={1} />
      <group ref={overlay}>
        <mesh geometry={res.road} material={res.roadMat} renderOrder={6} />
        <mesh geometry={res.trail} material={res.trailMat} renderOrder={7} />
        {CITIES.map((c, i) => (
          <group key={c.key} position={[c.x, MAP_Y + 6, c.z]} rotation-x={-Math.PI / 2}>
            <mesh ref={(el) => (cities.current[i] = el)} geometry={res.disc} material={c.big ? res.cityMat : res.ringMat} renderOrder={9} />
          </group>
        ))}
      </group>
      {showCities
        ? CITIES.map((c) => (
            <Tag key={c.key} position={[c.x, MAP_Y + 6, c.z]} tone={c.big ? 'cyan' : 'slate'} className={c.key === 'samarkand' ? 'mt-9' : '-mt-9'}>
              {uz.labels.cities[c.key]}
            </Tag>
          ))
        : null}
      <GroundArrow getEnds={getEnds} labelLift={0}>
        {showTrip ? (
          <Tag tone="amber">
            {uz.sym.d} = <span ref={bind('tripArrow')} />
          </Tag>
        ) : null}
      </GroundArrow>
      <mesh ref={haloRef} geometry={res.halo} material={res.haloMat} renderOrder={10} />
      <mesh ref={dotRef} geometry={res.dot} material={res.dotMat} renderOrder={11} />
      <group ref={dotLabel}>
        {showPoint ? (
          <Tag tone="cyan" className="ml-[118px] ring-2 ring-cyan-300/40">
            ← {uz.labels.point}
          </Tag>
        ) : null}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The canvas                                                          */
/* ------------------------------------------------------------------ */

export default function Variant3DCanvas({ uz, mode, route, frame, zoom, playing, speed, resetToken, phaseKey, onPhase, onFinish, dom, bind }) {
  const live = useMemo(makeLive, []);
  const cfg = useRef(null);
  const scenario = zoom < 0.5 ? 'garage' : 'trip';
  cfg.current = { uz, mode, route, frame, zoom, playing, speed, scenario, onPhase, onFinish };

  useEffect(() => {
    live.t = 0;
  }, [route, resetToken, live]);
  useEffect(() => {
    live.gT = 0;
    live.mT = 0;
  }, [resetToken, live]);

  const viewKey = `${mode}|${mode === 'frame' ? frame : ''}|${mode === 'path' ? route : ''}`;
  const street = phaseKey.startsWith('pt_street');
  const showCities = phaseKey === 'pt_map' || phaseKey === 'pt_trip' || phaseKey === 'pt_tripdone';
  const showPoint = showCities || phaseKey === 'pt_point';

  return (
    <Canvas
      dpr={LAB_DPR}
      shadows="percentage"
      camera={{ fov: 42, near: 0.1, far: 3000, position: [80, 120, 170] }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ReleaseContextOnUnmount />
      <Director cfg={cfg} live={live} dom={dom} />
      <CameraRig cfg={cfg} live={live} viewKey={viewKey} />
      <OrbitControls makeDefault enablePan={false} dampingFactor={0.08} maxPolarAngle={1.32} minPolarAngle={0.2} rotateSpeed={0.6} />
      <Lights cfg={cfg} live={live} />
      <TownIsland />
      <StadiumIsland />
      <Bus live={live}>
        {mode === 'frame' && frame === 'bus' ? <BusFrame live={live} uz={uz} /> : null}
        {mode === 'point' && street ? <BusRuler uz={uz} /> : null}
      </Bus>
      <Bus pose={PARKED_BUS} stripe="#0d9488" />
      <Runner live={live} />
      {mode === 'path' ? <RouteTrail key={route} routeId={route} live={live} /> : null}
      {mode === 'path' ? (
        <RouteArrow key={`a${route}`} routeId={route} live={live} uz={uz} bind={bind} showLabel={!phaseKey.endsWith('_idle')} />
      ) : null}
      {mode === 'path' ? <RouteMarkers routeId={route} uz={uz} /> : null}
      {mode === 'frame' ? <RouteMarkers routeId="ab" uz={uz} /> : null}
      {mode === 'frame' && frame === 'ground' ? <GroundFrame live={live} uz={uz} /> : null}
      {mode === 'frame' && frame === 'bus' ? (
        <Tag position={[CHINOR.x, 7.2, CHINOR.z]} tone="emerald">
          {uz.labels.chinor}
        </Tag>
      ) : null}
      {mode === 'point' && street ? <GarageRuler uz={uz} /> : null}
      {mode === 'point' ? <MapLayer live={live} uz={uz} bind={bind} showCities={showCities} showTrip={phaseKey === 'pt_trip' || phaseKey === 'pt_tripdone'} showPoint={showPoint} /> : null}
    </Canvas>
  );
}
