import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

import { Arrow, Btn, RangeField, Readout, fmt, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, PALETTE, TimeGraph } from '../kit/scene';
import { Chip, GroupLabel, LabScene, LiveExplain, PlayControls, ScaleChip, Sym, TagPill, hash01, niceMax, num, tickDigits } from './NewtonFirstLaw.parts';

/**
 * Tab 2 — "Ochiq kosmosda": a small spacecraft far from stars and planets,
 * seen from above, on a coordinate grid tied to a space station (an
 * inertial frame). With the engines off the resultant force is zero and the
 * craft flies in a straight line at constant speed — the 1-second marks stay
 * equally spaced for ever. A short burn (force F for 1 s) changes the
 * velocity: along the motion it speeds the craft up, against it slows it
 * down, sideways it turns the velocity; after the burn the motion is uniform
 * and straight again, with the new velocity.
 *
 * Default: m = 1000 kg, F = 2000 N, burn 1 s → Δv = F·Δt/m = 2 m/s;
 * v₀ = 4 m/s → 6 m/s after a forward burn; after a sideways burn
 * v = (4; 2) m/s, |v| = 4.47 m/s, 26.6° to the x axis.
 */

const BURN_T = 1; // s
const SHIP_L = 6; // m
const V0 = 4; // m/s
const START_X = 14; // m from the station
const DIRS = {
  fwd: { x: 1, y: 0, icon: ArrowRight },
  back: { x: -1, y: 0, icon: ArrowLeft },
  up: { x: 0, y: 1, icon: ArrowUp },
  down: { x: 0, y: -1, icon: ArrowDown },
};
const KF_WIDE = 0.03; // px per newton
const KF_NARROW = 0.018;
const BURN_COL = PALETTE.force;

const initial = () => ({
  t: 0,
  x: START_X,
  y: 0,
  vx: V0,
  vy: 0,
  s: 0,
  burn: null,
  lastBurn: null,
  burnEnd: -1e9,
  running: false,
  started: false,
  trail: [{ x: START_X, y: 0, burn: false }],
  marks: [{ n: 0, x: START_X, y: 0 }],
  samples: [{ t: 0, vx: V0, vy: 0 }],
});

function advance(p, dt, F, m) {
  const s = { ...p };
  let left = dt;
  while (left > 1e-9) {
    let h = Math.min(left, 1 / 120);
    if (s.burn) h = Math.min(h, s.burn.left);
    const ax = s.burn ? (DIRS[s.burn.dir].x * F) / m : 0;
    const ay = s.burn ? (DIRS[s.burn.dir].y * F) / m : 0;
    const x1 = s.x + s.vx * h + 0.5 * ax * h * h;
    const y1 = s.y + s.vy * h + 0.5 * ay * h * h;
    s.s += Math.hypot(x1 - s.x, y1 - s.y);
    s.x = x1;
    s.y = y1;
    s.vx += ax * h;
    s.vy += ay * h;
    const tPrev = s.t;
    s.t += h;
    if (Math.floor(s.t + 1e-9) > Math.floor(tPrev + 1e-9)) {
      let marks = [...s.marks, { n: Math.floor(s.t + 1e-9), x: s.x, y: s.y }];
      if (marks.length > 80) marks = marks.slice(marks.length - 80);
      s.marks = marks;
    }
    if (s.burn) {
      const leftB = s.burn.left - h;
      if (leftB <= 1e-9) {
        s.lastBurn = s.burn.dir;
        s.burn = null;
        s.burnEnd = s.t;
      } else s.burn = { ...s.burn, left: leftB };
    }
    left -= h;
  }
  const lt = s.trail[s.trail.length - 1];
  if (Math.hypot(s.x - lt.x, s.y - lt.y) > 0.4 || !!s.burn !== lt.burn) {
    let trail = [...s.trail, { x: s.x, y: s.y, burn: !!s.burn }];
    if (trail.length > 900) trail = trail.slice(trail.length - 900);
    s.trail = trail;
  }
  const ls = s.samples[s.samples.length - 1];
  if (s.t - ls.t >= 0.05) {
    let samples = [...s.samples, { t: s.t, vx: s.vx, vy: s.vy }];
    if (samples.length > 2400) samples = samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1);
    s.samples = samples;
  }
  return s;
}

export default function SpaceSim({ T }) {
  const L = T.space;
  const dec = T.decimal;
  const [F, setF] = useState(2000);
  const [m, setM] = useState(1000);
  const [s, setS] = useState(initial);

  useRafLoop(s.running, (dt) => setS((p) => (p.running ? advance(p, dt, F, m) : p)));

  const toggle = () => setS((p) => ({ ...p, running: !p.running, started: true }));
  const reset = () => setS(initial());
  const fire = (dir) => setS((p) => (p.burn ? p : { ...p, burn: { dir, left: BURN_T }, running: true, started: true }));

  const v = Math.hypot(s.vx, s.vy);
  const dv = (F * BURN_T) / m;
  const angle = v > 1e-6 ? (Math.atan2(s.vy, s.vx) * 180) / Math.PI : 0;
  const Fnow = s.burn ? F : 0;
  const F1 = (n) => num(n, 1, dec);
  const F2 = (n) => num(n, 2, dec);

  /* ---- explanation */
  let key = 'idle';
  if (s.burn) {
    const d = DIRS[s.burn.dir];
    const dot = v > 1e-6 ? (d.x * s.vx + d.y * s.vy) / v : 0;
    if (v < 0.05) key = 'start';
    else if (dot > 0.35) key = 'speedUp';
    else if (dot < -0.35) key = 'slowDown';
    else key = 'turn';
  } else if (s.started) {
    if (s.t - s.burnEnd < 3.5) key = 'after';
    else key = v < 0.05 ? 'rest' : 'coast';
  }
  const settled = useSettled(key, key === 'idle' ? 0 : 200);
  const ex = L.explain;
  const text = {
    idle: ex.idle(F1(V0)),
    coast: ex.coast(F2(v)),
    rest: ex.rest,
    start: ex.start,
    speedUp: ex.speedUp,
    slowDown: ex.slowDown,
    turn: ex.turn,
    after: ex.after(F2(v)),
  }[settled];
  const tone = { idle: '#22d3ee', coast: '#34d399', rest: '#34d399', start: '#f87171', speedUp: '#f87171', slowDown: '#f87171', turn: '#f87171', after: '#a78bfa' }[settled];

  /* ---- graph */
  const xMax = niceMax(Math.max(10, s.t));
  const vxPts = s.samples.map((q) => ({ x: q.t, y: q.vx }));
  const vyPts = s.samples.map((q) => ({ x: q.t, y: q.vy }));
  if (s.running) {
    vxPts.push({ x: s.t, y: s.vx });
    vyPts.push({ x: s.t, y: s.vy });
  }
  const top = Math.max(V0 + dv, ...vxPts.map((q) => Math.abs(q.y)), ...vyPts.map((q) => Math.abs(q.y)));
  const yMax = niceMax(top);
  const hasNeg = [...vxPts, ...vyPts].some((q) => q.y < -0.01);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.burnsLabel}</GroupLabel>
          <div role="group" aria-label={L.burnsLabel} className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {Object.keys(DIRS).map((id) => {
              const Icon = DIRS[id].icon;
              const on = s.burn?.dir === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => fire(id)}
                  disabled={!!s.burn}
                  aria-label={L.burns[id].aria}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:cursor-not-allowed ${
                    on ? 'border-red-400/70 bg-red-500/20 text-white' : 'border-white/10 bg-white/[0.035] text-gray-200 hover:bg-white/[0.08] disabled:opacity-40'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={18} strokeWidth={2.4} className={on ? 'text-red-300' : 'text-gray-400'} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">{L.burns[id].name}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-gray-400 tabular-nums">{L.burnSub(fmt(BURN_T, 0, dec), F1(dv))}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <PlayControls labels={T.common} running={s.running} done={false} started={s.started} onToggle={toggle} onReset={reset} />
      </div>

      <SpaceScene T={T} s={s} F={Fnow} />

      <LiveExplain id={settled} tone={tone} text={text} />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.v} symbol="v" value={F2(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={
            <>
              <Sym s="v" sub="x" /> = {F1(s.vx)} · <Sym s="v" sub="y" /> = {F1(s.vy)} {T.ms}
            </>
          } active={!!s.burn} />
        <Readout label={L.readouts.F} symbol="F" value={fmt(Fnow, 0, dec)} unit={T.N} accent={PALETTE.force} textColor="#fca5a5" sub={s.burn ? L.FSubOn : L.FSubOff} active={!!s.burn} />
        <Readout label={L.readouts.dir} symbol="α" value={v > 0.05 ? F1(angle) : '—'} unit={v > 0.05 ? '°' : undefined} accent="#a78bfa" textColor="#ddd6fe" sub={s.burn && settled === 'turn' ? L.dirTurn : L.dirSub} />
        <Readout label={L.readouts.t} symbol="t" value={F1(s.t)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.tSub(F1(s.s), F1(Math.hypot(s.x, s.y)))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="nfl-thrust"
            label={L.thrust}
            symbol="F"
            min={500}
            max={5000}
            step={100}
            value={F}
            onChange={setF}
            accent={PALETTE.force}
            display={`${fmt(F, 0, dec)} ${T.N}`}
            hint={L.thrustHint}
          />
          <RangeField
            id="nfl-ship-mass"
            label={L.mass}
            symbol="m"
            min={500}
            max={4000}
            step={100}
            value={m}
            onChange={setM}
            accent="#94a3b8"
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={L.massHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300 tabular-nums">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.dvTitle}</p>
            <p className="mt-1">
              <Sym s="Δv" /> = <Sym s="F" />·<Sym s="Δt" /> / <Sym s="m" /> = {fmt(F, 0, dec)} · {fmt(BURN_T, 0, dec)} / {fmt(m, 0, dec)} ={' '}
              <b className="text-emerald-300">
                {F2(dv)} {T.ms}
              </b>
            </p>
            <p className="mt-1 text-[11px] text-gray-500">{L.dvNote}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'vx', label: L.graph.vx, color: PALETTE.velText, points: vxPts },
              { id: 'vy', label: L.graph.vy, color: '#67e8f9', points: vyPts, dash: '6 4' },
            ]}
            xMax={xMax}
            yMax={yMax}
            yMin={hasNeg ? -yMax : 0}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={s.started ? s.t : undefined}
            decimal={dec}
            yDigits={tickDigits(hasNeg ? 2 * yMax : yMax)}
            height={210}
            note={L.graph.note}
            ariaLabel={L.graph.label}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function SpaceScene({ T, s, F }) {
  const L = T.space;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: BURN_COL, label: L.legend.F, kind: 'arrow' },
        { color: PALETTE.path, label: L.legend.path, kind: 'line' },
        { color: PALETTE.path, label: L.legend.marks, kind: 'ring' },
      ]}
      chips={(W, narrow) => (
        <>
          <Chip>{L.chipTime(fmt(s.t, 1, dec))}</Chip>
          <ScaleChip px={1000 * (narrow ? KF_NARROW : KF_WIDE)} color={BURN_COL}>
            {L.scale(fmt(1000, 0, dec))}
          </ScaleChip>
        </>
      )}
      height={(W, narrow) => (narrow ? 320 : 380)}
      ariaLabel={L.sceneLabel(num(s.x, 0, dec), num(s.y, 0, dec), num(Math.hypot(s.vx, s.vy), 1, dec))}
    >
      {(W, H, narrow) => {
        const span = narrow ? 42 : 84; // m across the drawing
        const k = W / span;
        const cxw = s.x + (narrow ? 4 : 10);
        const cyw = s.y;
        const view = {
          k,
          sx: (x) => W / 2 + (x - cxw) * k,
          sy: (y) => H / 2 + 10 - (y - cyw) * k,
          wx: (px) => cxw + (px - W / 2) / k,
          wy: (py) => cyw - (py - H / 2 - 10) / k,
        };
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const kv = narrow ? 13 : 22;
        const kF = narrow ? KF_NARROW : KF_WIDE;
        const px = view.sx(s.x);
        const py = view.sy(s.y);
        const v = Math.hypot(s.vx, s.vy);
        const vLen = Math.min(v * kv, W * 0.42);
        const ux = v > 1e-6 ? s.vx / v : 1;
        const uy = v > 1e-6 ? -s.vy / v : 0;
        const d = s.burn ? DIRS[s.burn.dir] : null;

        /* trail split into coast / burn runs */
        const runs = [];
        let cur = null;
        for (const q of [...s.trail, { x: s.x, y: s.y, burn: !!s.burn }]) {
          if (!cur || cur.burn !== q.burn) {
            if (cur) cur.pts.push(q);
            cur = { burn: q.burn, pts: cur ? [cur.pts[cur.pts.length - 1], q] : [q] };
            runs.push(cur);
          } else cur.pts.push(q);
        }
        let lastLab = -1e9;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Stars view={view} W={W} H={H} />
            <Grid view={view} W={W} H={H} minPx={narrow ? 34 : 44} />
            <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 60 : 80} xUnit={L.axisX} decimal={dec} />
            <Station view={view} label={L.station} fs={fs - 1} />

            {/* trajectory */}
            {runs.map((r, i) => (
              <polyline
                key={i}
                points={r.pts.map((q) => `${view.sx(q.x).toFixed(1)},${view.sy(q.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={r.burn ? BURN_COL : PALETTE.path}
                strokeOpacity={r.burn ? 0.85 : 0.75}
                strokeWidth={r.burn ? 5 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {s.marks.map((mk) => {
              const mx = view.sx(mk.x);
              const my = view.sy(mk.y);
              if (mx < -20 || mx > W + 20 || my < -20 || my > H + 20) return null;
              const showLab = mk.n > 0 && Math.abs(mx - lastLab) > 34 && Math.hypot(mx - px, my - py) > SHIP_L * k * 0.7;
              if (showLab) lastLab = mx;
              return (
                <g key={mk.n}>
                  <circle cx={mx} cy={my} r={4} fill="#fff" stroke={PALETTE.path} strokeWidth="2" />
                  {showLab && (
                    <text x={mx} y={my + 17} textAnchor="middle" fontSize={fs - 2} fontWeight="600" fill="#6d28d9" stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
                      {L.secTag(mk.n)}
                    </text>
                  )}
                </g>
              );
            })}

            <Ship x={px} y={py} k={k} burn={s.burn?.dir} t={s.t} />

            {/* velocity */}
            {v > 0.02 && (
              <>
                <Arrow x1={px} y1={py} x2={px + ux * vLen} y2={py + uy * vLen} color={PALETTE.vel} width={narrow ? 3 : 3.5} head={narrow ? 10 : 13} />
                <TagPill
                  x={px + ux * (vLen + 8) + (ux >= 0 ? 0 : -4)}
                  y={py + uy * vLen + (Math.abs(uy) > 0.5 ? (uy > 0 ? 14 : -14) : -16)}
                  anchor={ux >= -0.2 ? 'start' : 'end'}
                  parts={[{ t: 'v', italic: true }, { t: ` = ${num(v, 2, dec)} ${T.ms}` }]}
                  bg={PALETTE.vel}
                  size={fs}
                  box={box}
                />
              </>
            )}
            {/* engine force */}
            {d && (
              <>
                <Arrow x1={px} y1={py} x2={px + d.x * F * kF} y2={py - d.y * F * kF} color={BURN_COL} width={narrow ? 3.5 : 4} head={narrow ? 11 : 14} />
                <TagPill
                  x={px + d.x * (F * kF + 10)}
                  y={py - d.y * (F * kF + 14) + (d.y === 0 ? 18 : 0)}
                  anchor={d.x > 0 ? 'start' : d.x < 0 ? 'end' : 'middle'}
                  parts={[{ t: 'F', italic: true }, { t: ` = ${fmt(F, 0, dec)} ${T.N}` }]}
                  bg={BURN_COL}
                  size={fs}
                  box={box}
                />
              </>
            )}
            <circle cx={px} cy={py} r={2.5} fill={PALETTE.ink} />
          </>
        );
      }}
    </LabScene>
  );
}

/** Faint dots fixed to the station's frame, so the drift shows even between grid lines. */
function Stars({ view, W, H }) {
  const cell = 9;
  const x0 = Math.floor(view.wx(0) / cell) - 1;
  const x1 = Math.ceil(view.wx(W) / cell) + 1;
  const y0 = Math.floor(view.wy(H) / cell) - 1;
  const y1 = Math.ceil(view.wy(0) / cell) + 1;
  const dots = [];
  for (let i = x0; i <= x1; i += 1) {
    for (let j = y0; j <= y1; j += 1) {
      const h = hash01(i * 73 + j * 151);
      if (h > 0.55) continue;
      const x = view.sx((i + hash01(i * 13 + j * 7)) * cell);
      const y = view.sy((j + hash01(i * 5 + j * 31)) * cell);
      dots.push(<circle key={`${i}_${j}`} cx={x} cy={y} r={0.8 + h * 1.4} fill="#94a3b8" opacity={0.35 + h * 0.5} />);
    }
  }
  return <g aria-hidden="true">{dots}</g>;
}

/** The space station at the origin: the reference body of the grid. */
function Station({ view, label, fs }) {
  const x = view.sx(0);
  const y = view.sy(0);
  const k = view.k;
  const p = 3.2 * k;
  return (
    <g aria-hidden="true">
      <rect x={x - 0.4 * k} y={y - p} width={0.8 * k} height={2 * p} fill="#64748b" />
      {[-1, 1].map((sgn) => (
        <g key={sgn}>
          <rect x={x - 2.2 * k} y={y + sgn * p - (sgn > 0 ? 0 : 1.6 * k)} width={4.4 * k} height={1.6 * k} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />
          <line x1={x - 2.2 * k} x2={x + 2.2 * k} y1={y + sgn * (p + 0.8 * k)} y2={y + sgn * (p + 0.8 * k)} stroke="#93c5fd" strokeWidth="0.8" />
        </g>
      ))}
      <rect x={x - 1.6 * k} y={y - 0.9 * k} width={3.2 * k} height={1.8 * k} rx={0.6 * k} fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
      <circle cx={x + 1.6 * k} cy={y} r={0.45 * k} fill="#cbd5e1" stroke="#475569" />
      <text x={x} y={y + p + 2.4 * k + fs} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
        {label}
      </text>
    </g>
  );
}

/** Top view of the craft, nose to +x, with the flame of the working thruster. */
function Ship({ x, y, k, burn, t }) {
  const l = SHIP_L * k;
  const w = 2.2 * k;
  const flick = 0.85 + 0.15 * Math.sin(t * 40);
  const flame = (fx, fy, dx, dy, len) => {
    const nx = -dy;
    const ny = dx;
    const hw = w * 0.22;
    return (
      <path
        d={`M${fx + nx * hw},${fy + ny * hw} Q${fx + dx * len * 0.6 + nx * hw},${fy + dy * len * 0.6 + ny * hw} ${fx + dx * len},${fy + dy * len} Q${fx + dx * len * 0.6 - nx * hw},${fy + dy * len * 0.6 - ny * hw} ${fx - nx * hw},${fy - ny * hw} Z`}
        fill="url(#nfl-flame)"
      />
    );
  };
  return (
    <g>
      <defs>
        <linearGradient id="nfl-flame" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {burn === 'fwd' && flame(x - l / 2, y, -1, 0, l * 0.55 * flick)}
      {burn === 'back' && flame(x + l / 2 - 0.1 * l, y, 1, 0, l * 0.35 * flick)}
      {burn === 'up' && flame(x, y + w / 2, 0, 1, l * 0.32 * flick)}
      {burn === 'down' && flame(x, y - w / 2, 0, -1, l * 0.32 * flick)}
      <path
        d={`M${x - l / 2},${y - w * 0.36} L${x + l * 0.18},${y - w / 2} Q${x + l / 2},${y - w * 0.3} ${x + l / 2},${y} Q${x + l / 2},${y + w * 0.3} ${x + l * 0.18},${y + w / 2} L${x - l / 2},${y + w * 0.36} Z`}
        fill="#e2e8f0"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <rect x={x - l * 0.18} y={y - w * 1.05} width={l * 0.3} height={w * 0.5} rx={1.5} fill="#2563eb" stroke="#1e3a8a" strokeWidth="1" />
      <rect x={x - l * 0.18} y={y + w * 0.55} width={l * 0.3} height={w * 0.5} rx={1.5} fill="#2563eb" stroke="#1e3a8a" strokeWidth="1" />
      <rect x={x - l / 2 - 0.05 * l} y={y - w * 0.22} width={0.08 * l} height={w * 0.44} rx={1} fill="#475569" />
      <circle cx={x + l * 0.22} cy={y} r={w * 0.2} fill="#7dd3fc" stroke="#0369a1" strokeWidth="1" />
      <line x1={x - l * 0.3} x2={x + l * 0.05} y1={y} y2={y} stroke="#94a3b8" strokeWidth="1" />
      {burn && <circle cx={x} cy={y} r={l * 0.62} fill={BURN_COL} className="cl-pulse" opacity="0.18" />}
    </g>
  );
}

