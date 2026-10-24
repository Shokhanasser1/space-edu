import { useMemo, useState } from 'react';
import { Droplets, Gauge, Lightbulb, Lock, LockOpen, RotateCcw, Timer } from 'lucide-react';

import { Btn, Explain, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import {
  CV,
  Chip,
  FlowDashes,
  G,
  GridCm,
  GroupLabel,
  LIQ,
  LabScene,
  LiquidBody,
  Panel,
  PressureArrow,
  Ruler,
  ScaleBar,
  SurfaceLine,
  SymPill,
  Valve,
  big,
  surfacePoints,
} from './CommunicatingVessels.parts';

/**
 * Tab 1 — five vessels of different shapes (straight, wide, slanted, narrow,
 * a funnel) joined at the bottom by one pipe, with a tap in the pipe.
 *
 * Model (all lengths in cm, volumes in cm³ = mL):
 *   V_i — liquid above the vessel floor (y = 0); h_i = level(V_i) from the
 *   vessel's shape. The pipe and stems stay full and are not counted.
 *   Q_i — flow from the pipe into vessel i. The pipe is a node with no
 *   storage, so ΣQ_i = 0 in each connected group, and
 *     dQ_i/dt = γ·A_i·(H − h_i) − β·Q_i,   H = (ΣA_i h_i + (β/γ)ΣQ_i) / ΣA_i,
 *   a damped U-tube oscillation (period ≈ 1.2 s, damping ratio 0.5) that
 *   ends with every level equal: the liquid is at rest only when the
 *   pressure ρgh at the floor is the same in every vessel.
 *   dV_i/dt = Q_i (+ the pour into the chosen vessel, 150 mL/s).
 * Preset: 10 cm of water everywhere → p = 1000 · 9.8 · 0.10 = 980 Pa.
 */

const TILT = (32 * Math.PI) / 180;
const H_TOP = 30; // vessel height, cm
const H0 = 10; // starting level, cm
const PIPE_Y0 = -5.2; // pipe channel, cm
const PIPE_Y1 = -2.2;
const PIPE_X0 = 3.6;
const PIPE_X1 = 83.4;
const TAP_X = 30;
const POUR_RATE = 150; // cm³/s
const PORTION = 500; // cm³ per jug
const MAX_LEVEL = 28.5;
const EQ_LIMIT = 26.5;
const OMEGA = (2 * Math.PI) / 1.2;
const GAMMA = OMEGA * OMEGA;
const BETA = 2 * 0.5 * OMEGA;
const WINDOW = 20; // s shown on the graph
const BOX = { x0: -6.5, x1: 90, y0: -9, y1: 37.5 };

const VESSELS = [
  { id: 'straight', kind: 'cyl', cx: 7, r: 2.5, color: '#0ea5e9' },
  { id: 'wide', kind: 'cyl', cx: 20.5, r: 5, color: '#6366f1' },
  { id: 'slanted', kind: 'slant', cx: 37, r: 1.6, color: '#a855f7' },
  { id: 'narrow', kind: 'cyl', cx: 64, r: 1, color: '#ec4899' },
  { id: 'funnel', kind: 'cone', cx: 79.5, r: 1, s: 0.2, color: '#f59e0b' },
];
const LEFT = [0, 1];
const RIGHT = [2, 3, 4];
const LIQUIDS = ['water', 'kerosene', 'mercury'];

/* --------------------------------------------------------------- geometry */

const halfW = (v, y) => (v.kind === 'slant' ? v.r / Math.cos(TILT) : v.kind === 'cone' ? v.r + v.s * y : v.r);
const centerX = (v, y) => (v.kind === 'slant' ? v.cx + y * Math.tan(TILT) : v.cx);
const areaAt = (v, h) => (v.kind === 'cone' ? Math.PI * (v.r + v.s * h) ** 2 : v.kind === 'slant' ? (Math.PI * v.r * v.r) / Math.cos(TILT) : Math.PI * v.r * v.r);
const volumeOf = (v, h) => (v.kind === 'cone' ? (Math.PI / (3 * v.s)) * ((v.r + v.s * h) ** 3 - v.r ** 3) : areaAt(v, 0) * h);
const levelOf = (v, V) => (v.kind === 'cone' ? (Math.cbrt((3 * v.s * Math.max(0, V)) / Math.PI + v.r ** 3) - v.r) / v.s : Math.max(0, V) / areaAt(v, 0));
const stemHalf = (v) => Math.min(halfW(v, 0), 1);

/** The level at which `vol` cm³ would stand in the vessels `ids` at rest. */
function restLevel(ids, vol) {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    const v = ids.reduce((s, j) => s + volumeOf(VESSELS[j], mid), 0);
    if (v > vol) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const groupsFor = (open) => (open ? [[0, 1, 2, 3, 4]] : [LEFT, RIGHT]);

function initial() {
  const h = VESSELS.map(() => H0);
  return {
    V: VESSELS.map((v) => volumeOf(v, H0)),
    Q: VESSELS.map(() => 0),
    rate: VESSELS.map(() => 0),
    t: 0,
    pour: 0,
    full: false,
    calm: 0,
    pipe: [0, 0, 0, 0],
    stem: [0, 0, 0, 0, 0],
    samples: [{ t: 0, h }],
  };
}

/** Closing the tap stops the flow through it: each group's net flow is removed. */
function cutAtTap(p) {
  const h = p.V.map((V, i) => levelOf(VESSELS[i], V));
  const Q = p.Q.slice();
  for (const g of [LEFT, RIGHT]) {
    const S = g.reduce((s, i) => s + Q[i], 0);
    const SA = g.reduce((s, i) => s + areaAt(VESSELS[i], h[i]), 0);
    for (const i of g) Q[i] -= (S * areaAt(VESSELS[i], h[i])) / SA;
  }
  return { ...p, Q, calm: 0 };
}

function step(p, dt, target, open) {
  const V = p.V.slice();
  const Q = p.Q.slice();
  const h0 = V.map((x, i) => levelOf(VESSELS[i], x));
  let pour = p.pour;
  let full = p.full;
  const n = Math.max(1, Math.ceil(dt * 240));
  const hs = dt / n;
  const groups = groupsFor(open);
  for (let k = 0; k < n; k += 1) {
    const h = V.map((x, i) => levelOf(VESSELS[i], x));
    const A = h.map((x, i) => areaAt(VESSELS[i], x));
    for (const g of groups) {
      let sa = 0;
      let sh = 0;
      for (const i of g) {
        sa += A[i];
        sh += A[i] * h[i] + (BETA / GAMMA) * Q[i];
      }
      const H = sh / sa;
      for (const i of g) Q[i] += hs * (GAMMA * A[i] * (H - h[i]) - BETA * Q[i]);
    }
    let pr = 0;
    if (pour > 0) {
      pr = Math.min(POUR_RATE, pour / hs);
      pour = Math.max(0, pour - pr * hs);
    }
    for (let i = 0; i < V.length; i += 1) V[i] += hs * (Q[i] + (i === target ? pr : 0));
  }
  const h = V.map((x, i) => levelOf(VESSELS[i], x));
  if (pour > 0 && h[target] > MAX_LEVEL) {
    pour = 0;
    full = true;
  }
  const rate = h.map((x, i) => (x - h0[i]) / Math.max(dt, 1e-6));
  // flow along the pipe: what leaves the vessels on the left goes right
  const pipeV = [];
  let acc = 0;
  for (let i = 0; i < 4; i += 1) {
    acc -= Q[i];
    pipeV.push(acc / 7.07); // cm/s in a Ø3 cm pipe
  }
  const pipe = p.pipe.map((x, i) => x + pipeV[i] * dt);
  const stem = p.stem.map((x, i) => x + (Q[i] / (Math.PI * stemHalf(VESSELS[i]) ** 2)) * dt);
  const spread = Math.max(...groups.map((g) => Math.max(...g.map((i) => h[i])) - Math.min(...g.map((i) => h[i]))));
  const still = pour === 0 && spread < 0.02 && Math.max(...Q.map(Math.abs)) < 0.8;
  const t = p.t + dt;
  const last = p.samples[p.samples.length - 1];
  let samples = p.samples;
  if (t - last.t >= 0.08) {
    samples = [...p.samples, { t, h }];
    while (samples.length > 2 && samples[1].t < t - WINDOW) samples = samples.slice(1);
  }
  return { V, Q, rate, t, pour, full, calm: still ? p.calm + dt : 0, pipe, stem, pipeV, samples };
}

/* ------------------------------------------------------------------ icons */

function makeVesselIcon(v) {
  function VesselIcon({ size = 16, style, className }) {
    const s = 24;
    let d;
    if (v.kind === 'cyl' && v.r >= 4) d = 'M5 4 V20 H19 V4';
    else if (v.kind === 'cyl' && v.r <= 1) d = 'M10.5 3 V21 H13.5 V3';
    else if (v.kind === 'cyl') d = 'M8.5 4 V20 H15.5 V4';
    else if (v.kind === 'slant') d = 'M5 21 L16 3 M9 21 L20 3';
    else d = 'M3.5 3 L10.5 21 H13.5 L20.5 3';
    return (
      <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
        <path d={d} />
      </svg>
    );
  }
  return VesselIcon;
}
const ICONS = Object.fromEntries(VESSELS.map((v) => [v.id, makeVesselIcon(v)]));

/* ==================================================================== sim */

export default function ShapesSim({ T }) {
  const L = T.shapes;
  const dec = T.decimal;
  const [target, setTarget] = useState(3);
  const [open, setOpen] = useState(true);
  const [liquid, setLiquid] = useState('water');
  const [sim, setSim] = useState(initial);
  const [touched, setTouched] = useState(false);
  const liq = LIQ[liquid];

  const active = sim.pour > 0 || sim.calm < 2.5;
  useRafLoop(active, (dt) => setSim((p) => step(p, dt, target, open)));

  const h = sim.V.map((V, i) => levelOf(VESSELS[i], V));
  const groups = groupsFor(open);
  const groupOfTarget = open ? [0, 1, 2, 3, 4] : LEFT.includes(target) ? LEFT : RIGHT;
  const restAfterPour = restLevel(
    groupOfTarget,
    groupOfTarget.reduce((s, i) => s + sim.V[i], 0) + PORTION,
  );
  const canPour = sim.pour === 0 && restAfterPour <= EQ_LIMIT;

  const pour = () => {
    if (!canPour) return;
    setTouched(true);
    setSim((p) => ({ ...p, pour: PORTION, full: false, calm: 0 }));
  };
  const toggleTap = (o) => {
    if (o === open) return;
    setTouched(true);
    setOpen(o);
    setSim((p) => (o ? { ...p, calm: 0 } : cutAtTap(p)));
  };
  const reset = () => {
    setSim(initial());
    setTouched(false);
    setOpen(true);
  };

  /* ---- derived values */
  const hMin = Math.min(...h);
  const hMax = Math.max(...h);
  const spread = hMax - hMin;
  const hMean = h.reduce((s, x) => s + x, 0) / h.length;
  const still = sim.calm > 0.15;
  const pOf = (x) => liq.rho * G * (x / 100);
  const level = (x) => fmt(x, 1, dec);
  const leftH = (h[0] + h[1]) / 2;
  const rightH = (h[2] + h[3] + h[4]) / 3;
  const groupsDiffer = !open && Math.abs(leftH - rightH) > 0.05;

  /* ---- explanation */
  let key;
  if (sim.full) key = 'full';
  else if (sim.pour > 0) key = `pour-${target}`;
  else if (!touched) key = 'intro';
  else if (!still) key = open ? 'flowing' : 'flowingClosed';
  else if (!canPour && sim.pour === 0) key = 'nearlyFull';
  else if (open) key = 'settled';
  else key = groupsDiffer ? 'closedDiffer' : 'closedEqual';
  const settled = useSettled(key, key.startsWith('pour') || key === 'full' ? 0 : 300);
  const ex = L.explain;
  let text;
  if (settled.startsWith('pour')) text = ex.pouring(L.vessels[VESSELS[Number(settled.slice(5))].id].into, L.liquids[liquid]);
  else if (settled === 'settled') text = ex.settled(L.liquidsGen[liquid], level(hMean), big(pOf(hMean), 0, dec));
  else if (settled === 'closedDiffer') text = ex.closedDiffer(level(leftH), level(rightH));
  else text = ex[settled] ?? ex.intro;
  const tone =
    { full: '#f87171', nearlyFull: '#f87171', flowing: '#22d3ee', flowingClosed: '#22d3ee', settled: '#34d399', closedDiffer: '#fbbf24', closedEqual: '#fbbf24', intro: '#22d3ee' }[settled] ??
    '#60a5fa';

  /* ---- readout texts */
  const same = spread < 0.05;
  // a range while the levels differ: smaller, and never broken across lines
  const span = (a, b) => <span className="whitespace-nowrap text-[19px] sm:text-[24px]">{`${a}\u2060–\u2060${b}`}</span>;
  const levelValue = same ? level(hMean) : span(level(hMin), level(hMax));
  const levelSub = same ? L.levelSame : !open && still ? L.levelClosed : L.levelMoving;
  const pValue = same ? big(pOf(hMean), 0, dec) : span(big(pOf(hMin), 0, dec), big(pOf(hMax), 0, dec));
  const totalV = sim.V.reduce((s, x) => s + x, 0);

  const series = useMemo(() => {
    const t0 = Math.max(0, sim.t - WINDOW);
    return VESSELS.map((v, i) => ({
      id: v.id,
      label: L.vessels[v.id].name,
      color: v.color,
      points: sim.samples.map((s) => ({ x: s.t - t0, y: s.h[i] })),
    }));
  }, [sim.samples, sim.t, L]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.targetLabel}</GroupLabel>
          <Segmented
            label={L.targetLabel}
            className="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
            value={target}
            onChange={setTarget}
            disabled={sim.pour > 0}
            options={VESSELS.map((v, i) => ({ value: i, label: `${i + 1}. ${L.vessels[v.id].name}`, sub: L.vessels[v.id].sub, icon: ICONS[v.id] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={Droplets} onClick={pour} disabled={!canPour} className="xl:min-w-[164px] min-h-[52px] text-[15px]">
            {sim.pour > 0 ? L.pouring : L.pour(fmt(PORTION / 1000, 1, dec))}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!touched && sim.pour === 0} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <ShapesScene T={T} sim={sim} h={h} target={target} open={open} liquid={liquid} groups={groups} onPick={(i) => sim.pour === 0 && setTarget(i)} onTap={() => toggleTap(!open)} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.level} symbol="h" value={levelValue} unit={T.cm} accent={CV.level} textColor={CV.levelText} sub={levelSub} />
        <Readout
          label={L.readouts.pressure}
          symbol="p"
          value={pValue}
          unit={T.Pa}
          accent={CV.pressure}
          textColor={CV.pressureText}
          sub={L.pSub(big(liq.rho, 0, dec), fmt(G, 1, dec), fmt(hMean / 100, 3, dec))}
        />
        <Readout label={L.readouts.volume} symbol="V" accent={liq.dot} sub={L.volumeSub(big(totalV, 0, dec))}>
          <VolumeBars V={sim.V} liq={liq} dec={dec} />
        </Readout>
        <Readout
          label={L.readouts.spread}
          symbol="Δh"
          value={fmt(spread, 1, dec)}
          unit={T.cm}
          accent="#f59e0b"
          textColor="#fcd34d"
          active={spread > 0.05}
          sub={L.spreadSub}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.liquidLabel}</p>
            <Segmented
              label={L.liquidLabel}
              className="grid-cols-3"
              value={liquid}
              onChange={setLiquid}
              accent={LIQ[liquid].dot}
              options={LIQUIDS.map((id) => ({ value: id, label: L.liquids[id], sub: L.rhoSub(big(LIQ[id].rho, 0, dec)) }))}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.tapLabel}</p>
            <Segmented
              label={L.tapLabel}
              className="grid-cols-2"
              value={open}
              onChange={toggleTap}
              accent={open ? '#34d399' : '#f87171'}
              options={[
                { value: true, label: L.tap.open, sub: L.tapSub.open, icon: LockOpen },
                { value: false, label: L.tap.closed, sub: L.tapSub.closed, icon: Lock },
              ]}
            />
          </div>
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">{L.note}</p>
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">{L.teapot}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={WINDOW}
            yMax={32}
            xLabel={L.graph.t}
            yLabel={L.graph.h}
            decimal={dec}
            note={L.graph.note}
            ariaLabel={L.graph.label}
            height={190}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- volumes */

function VolumeBars({ V, liq, dec }) {
  const max = Math.max(...V, 1);
  return (
    <div className="mt-2 flex items-end gap-1.5" aria-hidden="true">
      {VESSELS.map((v, i) => (
        <div key={v.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] tabular-nums leading-none text-gray-300">{big(V[i], 0, dec)}</span>
          <span className="relative h-9 w-full overflow-hidden rounded-md bg-white/10">
            <span className="absolute inset-x-0 bottom-0 rounded-md" style={{ height: `${(V[i] / max) * 100}%`, background: liq.dot, opacity: 0.85 }} />
          </span>
          <span className="text-[10px] font-bold leading-none" style={{ color: v.color }}>
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================= scene */

function ShapesScene({ T, sim, h, target, open, liquid, groups, onPick, onTap }) {
  const L = T.shapes;
  const dec = T.decimal;
  const liq = LIQ[liquid];
  return (
    <LabScene
      ariaLabel={L.sceneLabel(h.map((x) => fmt(x, 1, dec)).join('; '), open ? L.tap.open : L.tap.closed)}
      legend={[
        { kind: 'box', color: liq.edge, fill: liquid === 'mercury' ? '#cbd5e1' : liq.fill, label: L.legend.liquid(L.liquidsLower[liquid]) },
        { kind: 'down', color: CV.pressure, label: L.legend.pressure },
        { kind: 'arrow', color: CV.flow, label: L.legend.flow },
        { kind: 'dash', color: CV.level, label: L.legend.level },
      ]}
      chips={(W, narrow, H) => {
        const kP = pxPerPa(makeView(BOX, W, H, padFor(narrow)).k, liq);
        const step = niceStep(kP, narrow ? 18 : 26);
        return (
          <>
            <Chip icon={open ? LockOpen : Lock} color={open ? CV.open : CV.closed}>
              {open ? L.tapTag.open : L.tapTag.closed}
            </Chip>
            {!narrow && (
              <Chip icon={Gauge} color={CV.pressure}>
                {L.pScale}
                <ScaleBar px={step * kP} color={CV.pressure} />
                {big(step, 0, dec)} {T.Pa}
              </Chip>
            )}
            {!narrow && <Chip icon={Timer}>{L.realTime}</Chip>}
          </>
        );
      }}
      height={(W, narrow) => {
        const pad = narrow ? 50 : 84;
        const k = (W - 24) / (BOX.x1 - BOX.x0);
        return clamp(k * (BOX.y1 - BOX.y0) + pad, 250, 560);
      }}
    >
      {(W, H, narrow) => <ShapesDrawing T={T} W={W} H={H} narrow={narrow} sim={sim} h={h} target={target} open={open} liq={liq} groups={groups} onPick={onPick} onTap={onTap} />}
    </LabScene>
  );
}

const padFor = (narrow) => (narrow ? { l: 10, r: 8, t: 30, b: 20 } : { l: 14, r: 12, t: 56, b: 28 });

/** Pressure arrows: the same px per pascal in every vessel; the scale fits the liquid (28 cm column ≈ 42 % of its height). */
const pxPerPa = (k, liq) => (0.42 * 28 * k) / (liq.rho * G * 0.28);

/** The pipe's glass: rounded ends, the bottom wall, and the top wall broken where the stems enter. */
function pipeGlass(sx, top, bot, stems) {
  const r = (bot - top) / 2;
  const x0 = sx(PIPE_X0);
  const x1 = sx(PIPE_X1);
  let d = `M${x0 + r},${top} A${r},${r} 0 0 0 ${x0 + r},${bot} L${x1 - r},${bot} A${r},${r} 0 0 0 ${x1 - r},${top}`;
  for (let i = stems.length - 1; i >= 0; i -= 1) d += ` L${stems[i].b},${top} M${stems[i].a},${top}`;
  return `${d} L${x0 + r},${top}`;
}

function ShapesDrawing({ T, W, H, narrow, sim, h, target, open, liq, groups, onPick, onTap }) {
  const L = T.shapes;
  const dec = T.decimal;
  const view = makeView(BOX, W, H, padFor(narrow));
  const { sx, sy, k } = view;
  const fs = narrow ? 10 : 12;
  const box = { w: W, h: H };
  const phase = sim.t * 7;
  const men = liq.meniscus * clamp(k * 0.35, 1.5, 4);
  const kP = pxPerPa(k, liq);

  const yFloor = sy(0);
  const pipeTop = sy(PIPE_Y1);
  const pipeBot = sy(PIPE_Y0);
  const pipeMid = (pipeTop + pipeBot) / 2;
  const stemXs = VESSELS.map((v) => sx(v.cx));
  const stems = VESSELS.map((v, i) => ({ a: stemXs[i] - stemHalf(v) * k, b: stemXs[i] + stemHalf(v) * k }));
  const tapX = sx(TAP_X);

  /* the geometry of each vessel at its level, in px */
  const xl = (v, y) => sx(centerX(v, y) - halfW(v, y));
  const xr = (v, y) => sx(centerX(v, y) + halfW(v, y));
  const bodies = VESSELS.map((v, i) => {
    const amp = clamp(Math.abs(sim.rate[i]) * 0.9, 0, 2.4) + (sim.pour > 0 && i === target ? 1.4 : 0);
    const ys = sy(h[i]);
    const surface = surfacePoints(xl(v, h[i]), xr(v, h[i]), ys, { men, amp, phase: phase + i * 1.7 });
    return {
      surface,
      left: [
        [xl(v, 0), yFloor],
        [xl(v, h[i]), ys],
      ],
      right: [
        [xr(v, h[i]), ys],
        [xr(v, 0), yFloor],
      ],
    };
  });

  /* the common level line(s) and where their labels go */
  const slantL = (hh) => centerX(VESSELS[2], hh) - halfW(VESSELS[2], hh);
  const slantR = (hh) => centerX(VESSELS[2], hh) + halfW(VESSELS[2], hh);
  const lines = [];
  for (const g of groups) {
    const hs = g.map((i) => h[i]);
    if (Math.max(...hs) - Math.min(...hs) < 0.15) {
      const hm = hs.reduce((s, x) => s + x, 0) / hs.length;
      const xa = sx(Math.min(...g.map((i) => centerX(VESSELS[i], hm) - halfW(VESSELS[i], hm))) - 2.2);
      const xb = sx(Math.max(...g.map((i) => centerX(VESSELS[i], hm) + halfW(VESSELS[i], hm))) + 2.2);
      const labelX = g.includes(0) ? sx((25.5 + slantL(hm)) / 2) : sx((slantR(hm) + 63) / 2);
      lines.push({ key: g.join(''), xa, xb: g.includes(0) && !g.includes(2) ? Math.max(xb, labelX + 40) : xb, y: sy(hm), hm, labelX });
    }
  }

  const tv = VESSELS[target];
  const jugS = clamp(k / 8, 0.55, 1.35);
  const pouring = sim.pour > 0;
  const spout = { x: sx(centerX(tv, H_TOP)), y: sy(H_TOP + 2.6) };
  const liquidLine = liq === LIQ.mercury ? '#b9c3cf' : liq.fill;

  return (
    <g>
      <GridCm view={view} W={W} H={H} />

      {/* ruler */}
      <Ruler x={sx(-1.6)} yBottom={yFloor} k={k} from={0} to={H_TOP} minor={1} major={narrow ? 10 : 5} side={-1} fs={fs - 1} decimal={dec} />
      <text x={sx(-1.6) - 3} y={sy(H_TOP) - 10} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {L.rulerUnit}
      </text>

      {/* stand under the pipe */}
      <rect x={sx(PIPE_X0) - 4} y={pipeBot + 3} width={sx(PIPE_X1) - sx(PIPE_X0) + 8} height={Math.max(3, k * 0.45)} rx="2" fill="#cbd5e1" />

      {/* glass of the vessels (behind the liquid) */}
      {VESSELS.map((v, i) => (
        <path
          key={`gl${v.id}`}
          d={`M${xl(v, H_TOP)},${sy(H_TOP)} L${xl(v, 0)},${yFloor} L${xr(v, 0)},${yFloor} L${xr(v, H_TOP)},${sy(H_TOP)} Z`}
          fill="url(#cv-glass)"
          stroke="none"
          opacity={i === target ? 1 : 0.9}
        />
      ))}

      {/* all the liquid in one layer, so the joins show no seams */}
      <g opacity={liq.opacity}>
        <rect x={sx(PIPE_X0)} y={pipeTop} width={sx(PIPE_X1) - sx(PIPE_X0)} height={pipeBot - pipeTop} rx={(pipeBot - pipeTop) / 2} fill={liq.fill} />
        {VESSELS.map((v, i) => (
          <rect key={`sl${v.id}`} x={stems[i].a} y={yFloor - 1} width={stems[i].b - stems[i].a} height={pipeTop - yFloor + 3} fill={liq.fill} />
        ))}
        {bodies.map((b, i) => (
          <LiquidBody key={`lq${VESSELS[i].id}`} liq={liq} left={b.left} right={b.right} surface={b.surface} flat />
        ))}
      </g>
      {bodies.map((b, i) => (
        <SurfaceLine key={`sf${VESSELS[i].id}`} liq={liq} surface={b.surface} />
      ))}

      {/* flow: dashes in the pipe and the stems, chevrons above the pipe */}
      {VESSELS.slice(0, 4).map((v, i) => {
        const vel = sim.pipeV?.[i] ?? 0;
        const xa = stemXs[i];
        const xb = stemXs[i + 1];
        return (
          <g key={`pf${v.id}`}>
            <FlowDashes x1={xa} y1={pipeMid} x2={xb} y2={pipeMid} offset={sim.pipe[i] * k} on={Math.abs(vel) > 0.2} width={narrow ? 1.6 : 2.2} />
            {Math.abs(vel) > 0.6 && <FlowHead x={i === 1 ? (xa + tapX) / 2 - 4 : (xa + xb) / 2} y={pipeTop - (narrow ? 6 : 10)} dir={Math.sign(vel)} s={narrow ? 0.7 : 1} />}
          </g>
        );
      })}
      {VESSELS.map((v, i) => (
        <FlowDashes
          key={`sd${v.id}`}
          x1={stemXs[i]}
          y1={pipeTop + 1}
          x2={stemXs[i]}
          y2={yFloor}
          offset={-sim.stem[i] * k}
          on={Math.abs(sim.Q[i] / (Math.PI * stemHalf(v) ** 2)) > 0.3}
          width={narrow ? 1.4 : 1.8}
          dash="4 6"
        />
      ))}

      {/* glass walls */}
      <path d={pipeGlass(sx, pipeTop, pipeBot, stems)} fill="none" stroke={CV.glass} strokeWidth="2.4" strokeLinejoin="round" />
      {VESSELS.map((v, i) => {
        const lip = Math.max(2.5, k * 0.45);
        const yT = sy(H_TOP);
        return (
          <g key={`wl${v.id}`} pointerEvents="none">
            <path d={`M${xl(v, H_TOP) - lip},${yT} L${xl(v, H_TOP)},${yT} L${xl(v, 0)},${yFloor} L${stems[i].a},${yFloor} L${stems[i].a},${pipeTop}`} fill="none" stroke={CV.glass} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={`M${xr(v, H_TOP) + lip},${yT} L${xr(v, H_TOP)},${yT} L${xr(v, 0)},${yFloor} L${stems[i].b},${yFloor} L${stems[i].b},${pipeTop}`} fill="none" stroke={CV.glass} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={`M${xl(v, H_TOP * 0.92) + 2.4},${sy(H_TOP * 0.92)} L${xl(v, H_TOP * 0.55) + 2.4},${sy(H_TOP * 0.55)}`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <line x1={xl(v, H_TOP) + 1.5} x2={xr(v, H_TOP) - 1.5} y1={yT + 2.5} y2={yT + 2.5} stroke={v.color} strokeWidth="3" strokeLinecap="round" opacity={i === target ? 1 : 0.5} />
          </g>
        );
      })}

      {/* tap */}
      <Valve x={tapX} y={pipeMid} r={narrow ? 6 : 9} open={open} onClick={onTap} label={narrow ? null : open ? L.tap.open : L.tap.closed} />

      {/* pressure at the floor: equal pressure, equal arrows */}
      {VESSELS.map((v, i) => {
        const len = liq.rho * G * (h[i] / 100) * kP;
        return <PressureArrow key={`pa${v.id}`} x1={stemXs[i]} y1={yFloor - len - 1} x2={stemXs[i]} y2={yFloor - 1} width={narrow ? 2 : 2.8} head={narrow ? 6 : 9} />;
      })}

      {/* common level */}
      {lines.map((ln) => (
        <g key={ln.key} pointerEvents="none">
          <line x1={ln.xa} x2={ln.xb} y1={ln.y} y2={ln.y} stroke={CV.level} strokeWidth="1.6" strokeDasharray="7 5" />
          {!narrow && <SymPill x={ln.labelX} y={ln.y} text={L.levelTag(fmt(ln.hm, 1, dec))} bg={CV.level} fs={fs} box={box} />}
        </g>
      ))}

      {/* numbers and floor pressures under the pipe */}
      {VESSELS.map((v, i) => {
        const x = stemXs[i];
        const y = pipeBot + (narrow ? 13 : 19);
        const p = liq.rho * G * (h[i] / 100);
        const bx = narrow ? x : x - 26;
        return (
          <g key={`lb${v.id}`} pointerEvents="none">
            <circle cx={bx} cy={y} r={narrow ? 6.5 : 8} fill={v.color} />
            <text x={bx} y={y + (narrow ? 3.2 : 4)} textAnchor="middle" fontSize={narrow ? 9 : 11} fontWeight="700" fill="#fff">
              {i + 1}
            </text>
            {!narrow && (
              <text x={x - 14} y={y + 4} fontSize={fs - 0.5} fontWeight="700" fill={CV.pressure}>
                {L.pTag(big(p, 0, dec))}
              </text>
            )}
          </g>
        );
      })}

      {/* hit areas: click a vessel to pour into it */}
      {VESSELS.map((v, i) => (
        <path
          key={`hit${v.id}`}
          d={`M${xl(v, H_TOP) - 6},${sy(H_TOP + 1)} L${xl(v, 0) - 6},${yFloor} L${xr(v, 0) + 6},${yFloor} L${xr(v, H_TOP) + 6},${sy(H_TOP + 1)} Z`}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => onPick(i)}
        />
      ))}

      {/* the jug and its stream */}
      {pouring && <PourStream v={tv} h={h[target]} spout={spout} sx={sx} sy={sy} k={k} color={liquidLine} t={sim.t} s={jugS} />}
      <Jug x={spout.x} y={spout.y} s={jugS} tilt={pouring ? -42 : 0} color={liquidLine} />
    </g>
  );
}

/** A small jug with its spout at (x, y); tilt < 0 pours to the left. */
function Jug({ x, y, s, tilt, color }) {
  return (
    <g
      pointerEvents="none"
      style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt}deg) scale(${s.toFixed(3)})`, transition: 'transform 0.35s ease' }}
    >
      <path d="M-1,-2 L7,-2 L6,4 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5,-3 L31,-3 L29,27 Q29,31 25,31 L11,31 Q7,31 7,27 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7.6,9 L30.3,9 L29.8,16 L8.1,16 Z" fill={color} fillOpacity="0.75" />
      <path d="M30,4 C41,4 41,22 29.3,22" fill="none" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

/** The stream from the jug's spout down to the surface (along the tube for the slanted vessel). */
function PourStream({ v, h, spout, sx, sy, k, color, t, s }) {
  const pts = [[spout.x, spout.y + 2 * s]];
  if (v.kind === 'slant') {
    pts.push([sx(centerX(v, H_TOP)), sy(H_TOP)]);
    pts.push([sx(centerX(v, h) - halfW(v, h) * 0.35), sy(h)]);
  } else {
    pts.push([spout.x, sy(h)]);
  }
  const d = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`;
  const w = Math.max(2.2, Math.min(4, k * 0.38));
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke={color} strokeOpacity="0.9" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth={w * 0.4} strokeDasharray="3 7" strokeDashoffset={-t * 90} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A small flow-direction arrow above the pipe. */
function FlowHead({ x, y, dir, s }) {
  const l = 14 * s;
  return (
    <g pointerEvents="none">
      <line x1={x - (dir * l) / 2} x2={x + (dir * l) / 2} y1={y} y2={y} stroke={CV.flow} strokeWidth={2.4 * s} strokeLinecap="round" />
      <path d={`M${x + (dir * l) / 2 + dir * 5 * s},${y} L${x + (dir * l) / 2 - dir * 2 * s},${y - 4.5 * s} L${x + (dir * l) / 2 - dir * 2 * s},${y + 4.5 * s} Z`} fill={CV.flow} />
    </g>
  );
}
