import { useState } from 'react';
import { ArrowDownToLine, Lightbulb, RotateCcw } from 'lucide-react';
import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import {
  COL,
  G,
  LIQUIDS,
  LIQ_SWATCH,
  LiquidFill,
  LiquidGradient,
  Panel,
  PanelTitle,
  RichPill,
  SimScene,
  Tag,
  TimeChip,
  Toolbar,
  makeSwatch,
  num,
  numt,
  rhoText,
  rich,
  shade,
  ForceArrow,
} from './Archimedes.parts';

/**
 * Sink or float. Six everyday bodies are let go just above a liquid at
 * once. Each one sinks while its weight mg is larger than the greatest push
 * the liquid can give it (ρ_body > ρ_liquid), hangs inside the liquid when
 * the densities are equal, and otherwise floats with the share ρ_b/ρ_l of
 * its volume under the surface - it goes down until the displaced liquid
 * weighs as much as the body (ice: 0.90 in fresh water, 0.87 in sea water).
 *
 * Salty water is adjustable: more salt, a denser liquid (a sodium chloride
 * table at 20 °C gives the salt per litre of water); the egg (1080 kg/m³)
 * sinks in fresh and sea water, hangs at 1080 kg/m³ and rises above it.
 *
 * Every body is integrated with mg, F_A = ρ_l·g·V_sub (with the right
 * submerged share for its shape: block, ball, egg, bottle on its side) and a
 * drag that lets it settle. Time is slowed down 2×.
 */

const BODIES = [
  { id: 'wood', rho: 500, shape: 'box', w: 8, h: 5, d: 5, color: '#d9a066', edge: '#8a5a2b' },
  { id: 'ice', rho: 900, shape: 'box', w: 6, h: 6, d: 6, color: '#dff2fd', edge: '#4ea3d4' },
  { id: 'cork', rho: 240, shape: 'cyl', w: 5, h: 2.5, color: '#d8a874', edge: '#9a6a37' },
  { id: 'steel', rho: 7800, shape: 'ball', w: 4, h: 4, color: '#9aa3ad', edge: '#4b5563' },
  { id: 'egg', rho: 1080, shape: 'egg', w: 5.6, h: 4.2, color: '#f3e3c7', edge: '#b08a57' },
  { id: 'bottle', rho: 50, shape: 'bottle', w: 17, h: 6.2, body: 14, color: '#d8eefc', edge: '#5b9bd5' },
];
const BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b]));
const LIQ_IDS = ['water', 'sea', 'brine', 'oil', 'mercury'];
const SWATCH = Object.fromEntries(BODIES.map((b) => [b.id, makeSwatch(b.color, b.edge, b.shape === 'ball' || b.shape === 'egg')]));

const TANK = { x0: -42, x1: 42, h: 36, wall: 1.2 }; // cm
const A_TANK = 0.84 * 0.3; // m², tank floor (84 cm × 30 cm)
const H0 = 0.26; // m, liquid depth with nothing in it
const HOLD = 0.02; // m, bodies are held this far above the surface
const SLOW = 2;
const BRINE_MAX = 1190;

/** Volume in m³ of a body (dimensions in cm). */
function volumeOf(b) {
  if (b.shape === 'box') return (b.w * b.h * b.d) / 1e6;
  if (b.shape === 'cyl') return (Math.PI * (b.w / 2) ** 2 * b.h) / 1e6;
  if (b.shape === 'ball') return ((4 / 3) * Math.PI * (b.w / 2) ** 3) / 1e6;
  if (b.shape === 'egg') return ((4 / 3) * Math.PI * (b.w / 2) * (b.h / 2) ** 2) / 1e6;
  return (Math.PI * (b.h / 2) ** 2 * b.body) / 1e6; // bottle: its cylindrical body
}

/** Share of the volume below a level that is at the fraction t of the body's height. */
function share(shape, t) {
  const x = clamp(t, 0, 1);
  if (shape === 'box' || shape === 'cyl') return x;
  if (shape === 'ball' || shape === 'egg') return x * x * (3 - 2 * x);
  const th = 2 * Math.acos(1 - 2 * x);
  return (th - Math.sin(th)) / (2 * Math.PI);
}

/** The t at which share(shape, t) = f (bisection). */
function shareInv(shape, f) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (share(shape, mid) < f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const PROPS = Object.fromEntries(
  BODIES.map((b) => {
    const V = volumeOf(b);
    return [b.id, { V, m: b.rho * V, hgt: b.h / 100, area: V / (b.h / 100) }];
  }),
);

/** Slot centres along the tank floor (cm), equal gaps between the bodies. */
const SLOTS = (() => {
  const total = BODIES.reduce((s, b) => s + b.w, 0);
  const gap = (TANK.x1 - TANK.x0 - total) / (BODIES.length + 1);
  let x = TANK.x0 + gap;
  const out = {};
  BODIES.forEach((b) => {
    out[b.id] = x + b.w / 2;
    x += b.w + gap;
  });
  return out;
})();

/** Sodium chloride solution at 20 °C: mass share (%) → density (kg/m³), water taken as 1000. */
const BRINE = [
  [0, 998.2],
  [2, 1012.5],
  [4, 1026.8],
  [6, 1041.3],
  [8, 1055.9],
  [10, 1070.7],
  [12, 1085.7],
  [14, 1100.9],
  [16, 1116.2],
  [18, 1131.9],
  [20, 1147.8],
  [22, 1164.0],
  [24, 1180.4],
  [26, 1197.2],
];

/** Grams of salt dissolved in 1 kg (≈ 1 litre) of water for a brine of density rho. */
function saltFor(rho) {
  const r = rho - 1000 + 998.2;
  for (let i = 1; i < BRINE.length; i += 1) {
    const [w0, r0] = BRINE[i - 1];
    const [w1, r1] = BRINE[i];
    if (r <= r1) {
      const w = w0 + ((w1 - w0) * (r - r0)) / (r1 - r0);
      return (1000 * w) / (100 - w);
    }
  }
  return 360;
}

/** What a body does in a liquid: 'float' (with share), 'hover' or 'sink'. */
function fate(rhoB, rhoL) {
  if (Math.abs(rhoB - rhoL) < 0.5) return 'hover';
  return rhoB < rhoL ? 'float' : 'sink';
}

/** Digits for a submerged share in %: 0.4 % and 99.5 % need one decimal, the rest none. */
const pctDigits = (f) => (f < 0.01 || f > 0.995 ? 1 : 0);

const heldBody = () => ({ y: H0 + HOLD, v: 0, held: true, wait: 0, rest: true });
const START = { bodies: Object.fromEntries(BODIES.map((b) => [b.id, heldBody()])), L: H0, active: false, t: 0, amp: 0, phase: 0 };

function subOf(b, y, L) {
  const p = PROPS[b.id];
  return p.V * share(b.shape, (L - y) / p.hgt);
}

function step(p, dt, rhoL) {
  const T = dt / SLOW;
  const bodies = {};
  let any = false;
  let sumV = 0;
  let splash = 0;
  BODIES.forEach((b) => {
    const s = p.bodies[b.id];
    if (s.held) {
      bodies[b.id] = s;
      return;
    }
    if (s.wait > 0) {
      bodies[b.id] = { ...s, wait: Math.max(0, s.wait - T) };
      any = true;
      return;
    }
    if (s.rest) {
      bodies[b.id] = s;
      sumV += subOf(b, s.y, p.L);
      return;
    }
    const pr = PROPS[b.id];
    const k = rhoL * G * pr.area;
    const accel = (y, v) => {
      const d = clamp(p.L - y, 0, pr.hgt);
      const f = share(b.shape, d / pr.hgt);
      const mEff = pr.m + 0.5 * rhoL * pr.V * f;
      let F = -pr.m * G + rhoL * G * pr.V * f;
      if (d > 0) {
        // bobbing at the surface is damped strongly; under the surface the
        // drag is mostly quadratic (a little viscous drag lets a hovering body stop)
        const c = 2 * 0.42 * Math.sqrt(k * mEff) * (f < 0.999 ? 1 : 0.12);
        F += -c * v - 0.5 * 0.8 * rhoL * pr.area * Math.abs(v) * v;
      }
      return F / mEff;
    };
    let { y, v } = s;
    const wasDry = y >= p.L;
    const n = Math.min(240, Math.max(1, Math.ceil(T / 0.0004)));
    const h = T / n;
    for (let i = 0; i < n; i += 1) {
      v += accel(y, v) * h;
      y += v * h;
      if (y < 0) {
        y = 0;
        if (v < 0) v = 0;
      }
    }
    if (wasDry && y < p.L) splash = Math.max(splash, Math.min(1, Math.abs(v) * 0.6));
    let rest = false;
    const a = accel(y, v);
    const fa = fate(b.rho, rhoL);
    if (fa === 'float') {
      const yEq = p.L - shareInv(b.shape, b.rho / rhoL) * pr.hgt;
      if (Math.abs(v) < 0.004 && Math.abs(y - yEq) < 0.0012) {
        y = yEq;
        v = 0;
        rest = true;
      }
    } else if (fa === 'sink') {
      if (y <= 0 && v === 0) rest = true;
    } else if (Math.abs(v) < 0.002 && (y <= 0 || Math.abs(a) < 0.02)) {
      v = 0;
      rest = true;
    }
    if (!rest) any = true;
    sumV += subOf(b, y, p.L);
    bodies[b.id] = { ...s, y, v, rest };
  });
  const L = H0 + sumV / A_TANK;
  // floating bodies at rest ride on the surface as the level changes
  BODIES.forEach((b) => {
    const s = bodies[b.id];
    if (!s.held && s.rest && fate(b.rho, rhoL) === 'float') bodies[b.id] = { ...s, y: L - shareInv(b.shape, b.rho / rhoL) * PROPS[b.id].hgt };
  });
  const amp = Math.max(p.amp * Math.exp(-T / 0.5), splash * 0.5);
  return { ...p, bodies, L, active: any || amp > 0.01, amp: amp > 0.01 ? amp : 0, phase: p.phase + T * 9, t: p.t + T };
}

export default function FloatSim({ T }) {
  const tx = T.float;
  const U = T.u;
  const S = T.sym;
  const dec = T.decimal;
  const [liq, setLiq] = useState('water');
  const [brine, setBrine] = useState(1040);
  const [sel, setSel] = useState('ice');
  const [sim, setSim] = useState(START);

  const rhoL = liq === 'brine' ? brine : LIQUIDS[liq].rho;
  useRafLoop(sim.active, (dt) => setSim((p) => step(p, dt, rhoL)));

  const wake = (p) => ({ ...p, active: true, bodies: Object.fromEntries(Object.entries(p.bodies).map(([id, b]) => [id, b.held ? b : { ...b, rest: false }])) });
  const pickLiq = (id) => {
    setLiq(id);
    setSim(wake);
  };
  const changeBrine = (v) => {
    setBrine(v);
    if (liq !== 'brine') setLiq('brine');
    setSim(wake);
  };
  const anyHeld = BODIES.some((b) => sim.bodies[b.id].held);
  const drop = () =>
    setSim(() => ({
      ...START,
      active: true,
      bodies: Object.fromEntries(BODIES.map((b, i) => [b.id, { ...heldBody(), held: false, rest: false, wait: i * 0.07 }])),
    }));
  const reset = () => setSim(START);

  /* ---- the selected body */
  const b = BY_ID[sel];
  const pr = PROPS[sel];
  const st = sim.bodies[sel];
  const fa = fate(b.rho, rhoL);
  const dNow = clamp(sim.L - st.y, 0, pr.hgt);
  const fNow = st.held ? 0 : share(b.shape, dNow / pr.hgt);
  const FA = rhoL * G * pr.V * fNow;
  const mg = pr.m * G;
  const allRest = !anyHeld && BODIES.every((x) => sim.bodies[x.id].rest && sim.bodies[x.id].wait === 0);
  const settledSel = !st.held && st.rest;
  const N = settledSel && st.y <= 1e-6 ? Math.max(0, mg - FA) : 0;
  const nf = (v) => num(v, dec, 3);

  /* ---- words */
  const name = tx.bodies[sel];
  const lqName = liq === 'brine' ? tx.liquids.brine.name : tx.liquids[liq].name;
  const loc = tx.liquids[liq].loc;
  let key = 'idle';
  if (!anyHeld) key = settledSel ? fa : 'moving';
  const settled = useSettled(`${key}-${sel}-${liq}-${liq === 'brine' ? brine : 0}`, key === 'moving' ? 120 : 220);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  let text;
  const frac = Math.min(1, b.rho / rhoL);
  if (sKey === 'float') {
    text = ex.float(name, loc, rhoText(b.rho), rhoText(rhoL), fmt(frac, frac < 0.01 ? 4 : 2, dec), fmt(frac * 100, pctDigits(frac), dec));
    const extra = ex.extra[`${sel}_${liq}`] ?? ex.extra[liq] ?? ex.extra[sel];
    if (extra) text = `${text} ${extra}`;
  } else if (sKey === 'sink') {
    text = ex.sink(name, loc, rhoText(b.rho), rhoText(rhoL), nf(mg), nf(rhoL * G * pr.V), nf(Math.max(0, mg - rhoL * G * pr.V)));
    if (sel === 'egg') text = `${text} ${ex.eggSalt}`;
  } else if (sKey === 'hover') {
    text = ex.hover(name, loc, rhoText(b.rho), nf(mg));
  } else if (sKey === 'moving') text = ex.moving;
  else text = ex.idle(lqName, rhoText(rhoL));
  const tone = { float: '#34d399', sink: '#f87171', hover: '#fbbf24', moving: '#22d3ee' }[sKey] ?? '#22d3ee';

  const verdictWord = (f) => ({ float: tx.floats, sink: tx.sinks, hover: tx.hovers })[f];
  const verdictShort = (id) => {
    const f = fate(BY_ID[id].rho, rhoL);
    if (f === 'float') return `${tx.floatsShort} · ${fmt(Math.min(99.9, (BY_ID[id].rho / rhoL) * 100), pctDigits(BY_ID[id].rho / rhoL), dec)}%`;
    return f === 'sink' ? tx.sinksShort : tx.hoversShort;
  };

  const legend = [
    { label: tx.legend.mg, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.fa, color: COL.fa, kind: 'arrow' },
    { label: tx.legend.n, color: COL.n, kind: 'arrow' },
    { label: tx.legend.liquid(lqName), color: LIQUIDS[liq].surface, kind: 'square' },
  ];

  const salt = saltFor(brine);
  const resultValue = settledSel ? verdictWord(fa) : '?';
  const resultSub = !settledSel
    ? tx.readouts.guess
    : fa === 'float'
      ? rich(tx.readouts.shareSub(fmt(frac * 100, pctDigits(frac), dec)))
      : fa === 'sink'
        ? rich(tx.readouts.nSub(nf(N)))
        : rich(tx.readouts.hoverSub);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.liqLabel}
        value={liq}
        onChange={pickLiq}
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        accent="#38bdf8"
        options={LIQ_IDS.map((id) => ({
          value: id,
          label: tx.liquids[id].name,
          sub: `${rhoText(id === 'brine' ? brine : LIQUIDS[id].rho)} ${U.kgm3}`,
          icon: LIQ_SWATCH[id],
        }))}
      >
        <Btn variant="primary" icon={ArrowDownToLine} onClick={drop} className="xl:min-w-[172px] min-h-[52px] text-[15px]">
          {anyHeld ? tx.drop : tx.again}
        </Btn>
        <Btn icon={RotateCcw} onClick={reset} disabled={anyHeld} className="min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <TimeChip text={T.common.slower(SLOW)} extra={T.common.cell(cellText(W, narrow, T))} />}
        ariaLabel={tx.sceneLabel(lqName, rhoText(rhoL), BODIES.map((x) => `${tx.bodies[x.id]}: ${sim.bodies[x.id].held ? tx.held : verdictShort(x.id)}`).join(', '))}
        height={sceneHeight}
      >
        {(W, H, narrow) => <TankDrawing W={W} H={H} narrow={narrow} sim={sim} sel={sel} liq={liq} rhoL={rhoL} T={T} verdictShort={verdictShort} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.body}
          symbol={rich(S.rhoB)}
          value={rhoText(b.rho)}
          unit={U.kgm3}
          accent={b.edge}
          textColor={COL.volText}
          sub={tx.readouts.bodySub(name, numt(pr.m * 1000, dec), numt(pr.V * 1e6, dec))}
        />
        <Readout
          label={tx.readouts.liquid}
          symbol={rich(S.rhoL)}
          value={rhoText(rhoL)}
          unit={U.kgm3}
          accent={LIQUIDS[liq].surface}
          textColor="#93c5fd"
          sub={liq === 'brine' ? tx.readouts.saltSub(Math.round(salt / 5) * 5) : `${numt(rhoL / 1000, dec, 4)} ${U.gcm3}`}
        />
        <Readout
          label={tx.readouts.fa}
          symbol={rich('F_A')}
          value={st.held ? '0' : nf(FA)}
          unit={U.n}
          accent={COL.fa}
          textColor={COL.faText}
          sub={rich(tx.readouts.faSub(nf(mg), settledSel ? (fa === 'sink' ? '<' : '=') : ''))}
        />
        <Readout
          label={tx.readouts.result}
          value={resultValue}
          accent={settledSel ? { float: COL.float, sink: COL.sink, hover: COL.hover }[fa] : '#94a3b8'}
          textColor={settledSel ? { float: COL.floatText, sink: COL.sinkText, hover: COL.hoverText }[fa] : '#e2e8f0'}
          active={settledSel}
          sub={resultSub}
        />
      </div>

      <Panel>
        <PanelTitle>{tx.bodyLabel}</PanelTitle>
        <Segmented
          label={tx.bodyLabel}
          className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          value={sel}
          onChange={setSel}
          accent="#a78bfa"
          options={BODIES.map((x) => ({ value: x.id, label: tx.bodies[x.id], sub: `${rhoText(x.rho)} · ${verdictShort(x.id)}`, icon: SWATCH[x.id] }))}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <RangeField
            id="arx-salt"
            label={tx.salt}
            symbol={rich(S.rhoL)}
            min={1000}
            max={BRINE_MAX}
            step={5}
            value={brine}
            onChange={changeBrine}
            accent="#7dd3fc"
            display={`${brine} ${U.kgm3}`}
            valueText={`${brine} ${U.kgm3}`}
            hint={rich(tx.saltHint(Math.round(salt / 5) * 5, rhoText(BY_ID.egg.rho)))}
          />
          {allRest && <p className="mt-2 text-xs leading-snug text-gray-500">{tx.allNote}</p>}
        </Panel>
        <Panel className="lg:col-span-3">
          <DensityRuler T={T} rhoL={rhoL} sel={sel} />
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- layout */

const BOX = { x0: -46, x1: 46, y0: -3, y1: 46 };
const sceneHeight = (W, narrow) => (narrow ? clamp(W * 0.86, 300, 360) : clamp(W * 0.42, 400, 480));
const padFor = (narrow) => (narrow ? { l: 6, r: 6, t: 36, b: 4 } : { l: 14, r: 14, t: 54, b: 6 });
const gridPx = (narrow) => (narrow ? 18 : 30);

function cellText(W, narrow, T) {
  const view = makeView(BOX, W, Math.round(sceneHeight(W, narrow)), padFor(narrow));
  return `${numt(niceStep(view.k, gridPx(narrow)), T.decimal)} ${T.u.cm}`;
}

/* ------------------------------------------------------------------ scene */

function TankDrawing({ W, H, narrow, sim, sel, liq, rhoL, T, verdictShort }) {
  const tx = T.float;
  const U = T.u;
  const dec = T.decimal;
  const view = makeView(BOX, W, H, padFor(narrow));
  const { k } = view;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10 : 11.5;
  const box = { w: W, h: H };
  const lq = LIQUIDS[liq];
  const inL = X(TANK.x0);
  const inR = X(TANK.x1);
  const wall = TANK.wall * k;
  const floor = Y(0);
  const rim = Y(TANK.h);
  const surf = Y(sim.L * 100);

  /* forces on the selected body */
  const b = BY_ID[sel];
  const pr = PROPS[sel];
  const st = sim.bodies[sel];
  const d = clamp(sim.L - st.y, 0, pr.hgt);
  const f = st.held ? 0 : share(b.shape, d / pr.hgt);
  const mg = pr.m * G;
  const FA = rhoL * G * pr.V * f;
  const FAeq = Math.min(mg, rhoL * G * pr.V);
  const fpx = (narrow ? 34 : 60) / Math.max(mg, FAeq);
  const cap = narrow ? 60 : 100;
  const N = st.rest && !st.held && st.y <= 1e-6 ? Math.max(0, mg - FA) : 0;
  const cx = X(SLOTS[sel]);
  const cy = Y(st.y * 100 + b.h / 2);
  const off = Math.max(4, Math.min(8, b.w * k * 0.12));
  const lenMg = Math.min(cap, mg * fpx);
  const lenFa = Math.min(cap, FA * fpx);
  const lenN = Math.min(cap, N * fpx);
  const nf = (v) => num(v, dec, 3);

  return (
    <g>
      <defs>
        <LiquidGradient id="arx-flt-liq" liq={lq} />
        <radialGradient id="arx-flt-steel" cx="0.35" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.35" stopColor="#b6bec8" />
          <stop offset="1" stopColor="#4b5563" />
        </radialGradient>
        <radialGradient id="arx-flt-egg" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.6" stopColor="#f3e3c7" />
          <stop offset="1" stopColor="#d7bb8e" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={gridPx(narrow)} strong={PALETTE.grid} />

      {/* table */}
      <rect x={0} y={floor + wall} width={W} height={H - floor - wall} fill="#efe2cd" />
      <line x1={0} x2={W} y1={floor + wall} y2={floor + wall} stroke="#b08d5b" strokeWidth="2" />
      <rect x={inL} y={rim} width={inR - inL} height={floor - rim} fill="#f1f5f9" opacity="0.55" />

      {/* strings while held */}
      {BODIES.map((x) =>
        sim.bodies[x.id].held ? (
          <line key={`s${x.id}`} x1={X(SLOTS[x.id])} x2={X(SLOTS[x.id])} y1={0} y2={Y(sim.bodies[x.id].y * 100 + x.h)} stroke="#78350f" strokeWidth="1.2" strokeOpacity="0.7" />
        ) : null,
      )}

      {/* bodies, then the liquid over them, then outlines */}
      {BODIES.map((x) => (
        <Shape key={x.id} b={x} cx={X(SLOTS[x.id])} yB={Y(sim.bodies[x.id].y * 100)} k={k} />
      ))}
      <LiquidFill x0={inL} x1={inR} top={surf} bottom={floor} liq={lq} gradId="arx-flt-liq" amp={sim.amp * 3} phase={sim.phase} />
      {BODIES.map((x) =>
        sim.bodies[x.id].y < sim.L ? <ShapeOutline key={`o${x.id}`} b={x} cx={X(SLOTS[x.id])} yB={Y(sim.bodies[x.id].y * 100)} k={k} /> : null,
      )}

      {/* glass */}
      <rect x={inL - wall} y={rim} width={wall} height={floor - rim + wall} fill="#cbd5e1" opacity="0.85" />
      <rect x={inR} y={rim} width={wall} height={floor - rim + wall} fill="#cbd5e1" opacity="0.85" />
      <rect x={inL - wall} y={floor} width={inR - inL + 2 * wall} height={wall} fill="#cbd5e1" />
      <line x1={inL - wall} x2={inL - wall} y1={rim} y2={floor + wall} stroke="#94a3b8" />
      <line x1={inR + wall} x2={inR + wall} y1={rim} y2={floor + wall} stroke="#94a3b8" />

      {/* labels over the tank */}
      {BODIES.map((x, i) => {
        const s = sim.bodies[x.id];
        const on = x.id === sel;
        const lx = X(SLOTS[x.id]);
        const done = !s.held && s.rest;
        const v = fate(x.rho, rhoL);
        const color = done ? { float: COL.float, sink: COL.sink, hover: COL.hover }[v] : '#64748b';
        if (narrow) {
          return (
            <g key={`l${x.id}`}>
              <circle cx={lx} cy={rim - 13} r={8} fill={on ? '#7c3aed' : '#fff'} stroke={on ? '#7c3aed' : '#cbd5e1'} />
              <text x={lx} y={rim - 9.5} textAnchor="middle" fontSize="10" fontWeight="700" fill={on ? '#fff' : '#475569'}>
                {i + 1}
              </text>
            </g>
          );
        }
        return (
          <g key={`l${x.id}`}>
            <text x={lx} y={rim - 26} textAnchor="middle" fontSize={fs} fontWeight={on ? 800 : 600} fill={on ? '#5b21b6' : '#334155'}>
              {tx.bodies[x.id]}
            </text>
            <text x={lx} y={rim - 10} textAnchor="middle" fontSize={fs - 0.5} fontWeight="700" fill={color}>
              {s.held ? `${rhoText(x.rho)} ${U.kgm3}` : done ? verdictShort(x.id) : '…'}
            </text>
          </g>
        );
      })}

      {/* selection mark */}
      <rect
        x={cx - (b.w / 2) * k - 5}
        y={Y(st.y * 100 + b.h) - 5}
        width={b.w * k + 10}
        height={b.h * k + 10}
        rx={6}
        fill="none"
        stroke="#7c3aed"
        strokeOpacity="0.7"
        strokeDasharray="4 3"
      />

      {/* forces on the selected body */}
      <ForceArrow x1={cx - off} y1={cy} x2={cx - off} y2={cy + lenMg} color={COL.mg} width={narrow ? 2.4 : 3.2} head={narrow ? 8 : 10} />
      <Tag x={cx - off - 5} y={cy + lenMg} text="mg" color={COL.mg} anchor="end" size={narrow ? 11 : 13} />
      {lenFa > 2 && (
        <g>
          <ForceArrow x1={cx + off} y1={cy} x2={cx + off} y2={cy - lenFa} color={COL.fa} width={narrow ? 2.4 : 3.2} head={Math.min(narrow ? 8 : 10, lenFa * 0.6)} />
          <Tag x={cx + off + 5} y={cy - lenFa + 10} text="F_A" color={COL.fa} anchor="start" size={narrow ? 11 : 13} />
        </g>
      )}
      {lenN > 2 && (
        <g>
          <ForceArrow x1={cx + off + 10} y1={floor} x2={cx + off + 10} y2={floor - lenN} color={COL.n} width={narrow ? 2.2 : 3} head={Math.min(narrow ? 8 : 10, lenN * 0.6)} />
          <Tag x={cx + off + 15} y={floor - lenN + 10} text="N" color={COL.n} anchor="start" size={narrow ? 11 : 13} />
        </g>
      )}
      {!narrow && st.rest && !st.held && (
        <g>
          <RichPill x={cx + (b.w / 2) * k + 14} y={cy - 12} anchor="start" text={`F_A = ${nf(FA)} ${U.n}`} bg={COL.fa} size={fs} box={box} />
          <RichPill x={cx + (b.w / 2) * k + 14} y={cy + 12} anchor="start" text={`mg = ${nf(mg)} ${U.n}`} bg={COL.mg} size={fs} box={box} />
        </g>
      )}

      {narrow && (
        <RichPill
          x={W / 2}
          y={rim - 34}
          text={`${tx.bodies[sel]} · ${st.held ? `${rhoText(b.rho)} ${U.kgm3}` : st.rest ? verdictShort(sel) : '…'}`}
          bg="#fff"
          color="#5b21b6"
          border="#c4b5fd"
          size={fs}
          box={box}
        />
      )}
    </g>
  );
}

/** A body drawn at slot centre cx with its bottom at yB (px). */
function Shape({ b, cx, yB, k }) {
  const w = b.w * k;
  const h = b.h * k;
  const x0 = cx - w / 2;
  const yT = yB - h;
  if (b.shape === 'box') {
    const ice = b.id === 'ice';
    return (
      <g>
        <rect x={x0} y={yT} width={w} height={h} rx={ice ? 3 : 1.5} fill={b.color} fillOpacity={ice ? 0.85 : 1} stroke={b.edge} strokeWidth="1.2" />
        {!ice &&
          [0.25, 0.5, 0.75].map((fy) => (
            <path key={fy} d={`M${x0 + 2},${yT + h * fy} q${w * 0.25},${-h * 0.06} ${w * 0.5},0 t${w * 0.5 - 4},0`} fill="none" stroke={b.edge} strokeOpacity="0.45" strokeWidth="1" />
          ))}
        {ice && <path d={`M${x0 + w * 0.15},${yB - h * 0.2} L${x0 + w * 0.15},${yT + h * 0.18} L${x0 + w * 0.35},${yT + h * 0.18}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />}
      </g>
    );
  }
  if (b.shape === 'cyl') {
    const ry = Math.min(h * 0.28, w * 0.16);
    return (
      <g>
        <path d={`M${x0},${yT} L${x0},${yB} A${w / 2},${ry} 0 0 0 ${x0 + w},${yB} L${x0 + w},${yT} Z`} fill={b.color} stroke={b.edge} strokeWidth="1.2" />
        <ellipse cx={cx} cy={yT} rx={w / 2} ry={ry} fill={shade(b.color, 0.25)} stroke={b.edge} strokeWidth="1.2" />
        {[0.3, 0.55, 0.75].map((fx, i) => (
          <circle key={i} cx={x0 + w * fx} cy={yT + h * (0.45 + 0.15 * (i % 2))} r={Math.max(0.8, k * 0.15)} fill={b.edge} opacity="0.5" />
        ))}
      </g>
    );
  }
  if (b.shape === 'ball') return <circle cx={cx} cy={yB - h / 2} r={w / 2} fill="url(#arx-flt-steel)" stroke={b.edge} strokeWidth="1.2" />;
  if (b.shape === 'egg') {
    const cyE = yB - h / 2;
    return <path d={eggPath(cx, cyE, w / 2, h / 2)} fill="url(#arx-flt-egg)" stroke={b.edge} strokeWidth="1.2" />;
  }
  // bottle lying on its side: body, shoulder, neck and cap (pointing right)
  const bodyW = b.body * k;
  const bx0 = x0;
  const r = h / 2;
  const cyB = yB - r;
  const neckW = h * 0.36;
  const sh = (b.w - b.body) * k;
  return (
    <g>
      <path
        d={`M${bx0 + r * 0.5},${yT} L${bx0 + bodyW},${yT} C${bx0 + bodyW + sh * 0.45},${yT} ${bx0 + bodyW + sh * 0.5},${cyB - neckW / 2} ${bx0 + bodyW + sh * 0.62},${cyB - neckW / 2} L${bx0 + bodyW + sh * 0.84},${cyB - neckW / 2} L${bx0 + bodyW + sh * 0.84},${cyB + neckW / 2} L${bx0 + bodyW + sh * 0.62},${cyB + neckW / 2} C${bx0 + bodyW + sh * 0.5},${cyB + neckW / 2} ${bx0 + bodyW + sh * 0.45},${yB} ${bx0 + bodyW},${yB} L${bx0 + r * 0.5},${yB} Q${bx0},${yB} ${bx0},${cyB} Q${bx0},${yT} ${bx0 + r * 0.5},${yT} Z`}
        fill={b.color}
        fillOpacity="0.75"
        stroke={b.edge}
        strokeWidth="1.2"
      />
      <rect x={bx0 + bodyW + sh * 0.84} y={cyB - neckW * 0.62} width={sh * 0.16} height={neckW * 1.24} rx={1.5} fill="#2563eb" />
      <rect x={bx0 + bodyW * 0.3} y={yT} width={bodyW * 0.38} height={h} fill="#60a5fa" fillOpacity="0.45" />
      <line x1={bx0 + r * 0.6} x2={bx0 + bodyW * 0.95} y1={yT + h * 0.2} y2={yT + h * 0.2} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function eggPath(cx, cy, a, bb) {
  // slightly pointed at the right end
  return `M${cx - a},${cy} C${cx - a},${cy - bb * 1.05} ${cx + a * 0.55},${cy - bb * 1.05} ${cx + a},${cy} C${cx + a * 0.55},${cy + bb * 1.05} ${cx - a},${cy + bb * 1.05} ${cx - a},${cy} Z`;
}

function ShapeOutline({ b, cx, yB, k }) {
  const w = b.w * k;
  const h = b.h * k;
  const common = { fill: 'none', stroke: b.edge, strokeOpacity: 0.6, strokeWidth: 1.2, pointerEvents: 'none' };
  if (b.shape === 'ball') return <circle cx={cx} cy={yB - h / 2} r={w / 2} {...common} />;
  if (b.shape === 'egg') return <path d={eggPath(cx, yB - h / 2, w / 2, h / 2)} {...common} />;
  if (b.shape === 'bottle') return <rect x={cx - w / 2} y={yB - h} width={b.body * k} height={h} rx={h / 3} {...common} />;
  return <rect x={cx - w / 2} y={yB - h} width={w} height={h} rx={2} {...common} />;
}

/* ----------------------------------------------------------- density ruler */

function DensityRuler({ T, rhoL, sel }) {
  const tx = T.float.ruler;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const H = 136;
  const pad = { l: 14, r: 14 };
  const lo = 1; // log10(10)
  const hi = Math.log10(20000);
  const gx = (r) => pad.l + ((Math.log10(r) - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const xl = gx(rhoL);
  const barY = 58;
  const barH = 16;
  const sorted = [...BODIES].sort((a, b) => a.rho - b.rho);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{tx.title}</p>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.label(rhoText(rhoL))} className="block overflow-visible">
          <rect x={pad.l} y={barY} width={Math.max(0, xl - pad.l)} height={barH} rx="4" fill={COL.float} opacity="0.8" />
          <rect x={xl} y={barY} width={Math.max(0, W - pad.r - xl)} height={barH} rx="4" fill={COL.sink} opacity="0.8" />
          {xl - pad.l > 70 && (
            <text x={(pad.l + xl) / 2} y={barY + 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {tx.floats}
            </text>
          )}
          {W - pad.r - xl > 70 && (
            <text x={(xl + W - pad.r) / 2} y={barY + 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {tx.sinks}
            </text>
          )}
          {[10, 100, 1000, 10000].map((r) => (
            <g key={r}>
              <line x1={gx(r)} x2={gx(r)} y1={barY + barH} y2={barY + barH + 5} stroke="#64748b" />
              <text x={gx(r)} y={barY + barH + 17} textAnchor="middle" fontSize="10.5" fill="#94a3b8">
                {rhoText(r)}
              </text>
            </g>
          ))}
          <line x1={xl} x2={xl} y1={barY - 4} y2={H - 14} stroke="#93c5fd" strokeWidth="2.5" />
          <text x={clamp(xl, 60, W - 60)} y={H - 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#93c5fd">
            {tx.liquid(rhoText(rhoL))}
          </text>
          {sorted.map((x, i) => {
            const px = gx(x.rho);
            const on = x.id === sel;
            const ty = [12, 28, 44][i % 3];
            return (
              <g key={x.id}>
                <line x1={px} x2={px} y1={ty + 3} y2={barY} stroke={on ? '#c4b5fd' : '#64748b'} strokeWidth={on ? 1.6 : 1} />
                <circle cx={px} cy={barY + barH / 2} r={on ? 5 : 3.5} fill={x.color} stroke={on ? '#c4b5fd' : '#0b0b16'} strokeWidth="1.5" />
                <text x={clamp(px, 30, W - 30)} y={ty} textAnchor="middle" fontSize="10.5" fontWeight={on ? 700 : 500} fill={on ? '#ddd6fe' : '#94a3b8'}>
                  {`${T.float.bodies[x.id]} ${fmt(x.rho, 0, dec)}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{tx.note}</p>
    </div>
  );
}
