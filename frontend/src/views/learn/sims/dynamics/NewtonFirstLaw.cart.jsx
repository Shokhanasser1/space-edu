import { useState } from 'react';
import { Hand, Hourglass, Infinity as InfinityIcon, OctagonX, RotateCcw, Snowflake, TreePine } from 'lucide-react';

import { Arrow, Btn, RangeField, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, GroupLabel, LabScene, LiveExplain, Ruler, ScaleChip, Sym, TagPill, hash01, lineView, niceMax, num, rulerStep, tickDigits } from './NewtonFirstLaw.parts';

/**
 * Tab 1 — "Arava va to'p": a cart carrying a ball is pushed along a chosen
 * surface. While the push lasts the force changes the cart's velocity; after
 * it only friction acts, and the cart slows down — not "by itself". The less
 * friction, the further it rolls; on the ideal surface (μ = 0) the resultant
 * force is zero and the cart keeps its velocity for ever (Newton's first law).
 * "Keskin to'xtatish" drops a chock in front of the wheel: the chock stops
 * the cart, but nothing pushes the ball back, so it keeps its velocity and
 * flies off the front (inertia), lands and rolls on.
 *
 * Model: one push = force F for PUSH_T = 0.5 s; friction μmg opposes the
 * motion (kinetic) or balances a weaker push (static, F ≤ μmg). The ball
 * sits in a shallow cradle on the cart, rolls over the deck without
 * horizontal force after the stop, falls under gravity (g = 9.8 m/s²) and
 * then rolls on the same surface (deceleration μg). Default: F = 20 N,
 * m = 5 kg, wood μ = 0.05 → v = (20 − 2.45)·0.5/5 = 1.755 m/s,
 * stop after 0.439 + 1.755²/(2·0.49) = 3.58 m.
 */

export const G = 9.8;
export const PUSH_T = 0.5; // s, one push
const CART_L = 1.0; // m
const WHEEL_R = 0.11;
const WHEEL_DX = 0.32;
const BODY_Y0 = 0.14;
const BODY_Y1 = 0.4;
const BALL_R = 0.1;
const BALL_Y = 0.49; // ball centre while it rides in the cradle
const BALL_DX = -0.08; // ball offset from the cart centre
const X0 = CART_L / 2; // cart centre at the start: its rear is at x = 0
const KF_WIDE = 4.6; // px per newton in the scene (one scale for all forces)
const KF_NARROW = 2.6;
const JOLT_READ = 3; // s the sudden-stop message stays up, so it can be read

export const SURFACES = {
  ice: { mu: 0.02, icon: Snowflake, graph: '#7dd3fc', flag: '#0284c7' },
  wood: { mu: 0.05, icon: TreePine, graph: '#fbbf24', flag: '#b45309' },
  sand: { mu: 0.2, icon: Hourglass, graph: '#d6b98c', flag: '#a16207' },
  ideal: { mu: 0, icon: InfinityIcon, graph: '#c4b5fd', flag: '#7c3aed' },
};
const SURFACE_IDS = ['ice', 'wood', 'sand', 'ideal'];

const COL = {
  push: PALETTE.force, // itarish kuchi F
  fric: '#b45309', // ishqalanish kuchi
  stop: '#334155', // to'siq kuchi
  cart: '#dc2626',
  cartDark: '#991b1b',
  ball: '#ec4899',
  ballDark: '#9d174d',
};

/** Distance and time of one push from rest, from the formulas (μ = 0 → Infinity). */
export function predict(F, m, mu) {
  const fMax = mu * m * G;
  if (F <= fMax + 1e-9) return { stuck: true, s: 0, t: 0, v1: 0 };
  const a1 = (F - fMax) / m;
  const v1 = a1 * PUSH_T;
  const s1 = 0.5 * a1 * PUSH_T * PUSH_T;
  if (mu <= 0) return { stuck: false, s: Infinity, t: Infinity, v1 };
  return { stuck: false, s: s1 + (v1 * v1) / (2 * mu * G), t: PUSH_T + v1 / (mu * G), v1 };
}

const freshRun = () => ({
  t: 0,
  x: X0,
  v: 0,
  push: 0,
  started: false,
  stuck: false,
  chock: null,
  jolt: 0,
  joltV: 0,
  ball: { mode: 'cart', x: X0 + BALL_DX, y: BALL_Y, vx: 0, vy: 0 },
  trail: [],
  samples: [{ t: 0, v: 0, vb: null }],
  active: false,
});
const fresh = () => ({ ...freshRun(), runs: {}, flags: {} });

/** One small time step (h ≤ 1/240 s), mutating the copy `s`. */
function stepOnce(s, h, F, m, mu) {
  const fMax = mu * m * G;
  if (s.chock === null) {
    const Fp = s.push > 0 ? F : 0;
    if (s.v > 1e-9 || Fp > fMax + 1e-9) {
      const a = (Fp - fMax) / m;
      let dt = h;
      if (a < 0 && s.v + a * h <= 0) dt = s.v / -a;
      s.x += s.v * dt + 0.5 * a * dt * dt;
      s.v = dt < h ? 0 : Math.max(0, s.v + a * dt);
      s.stuck = false;
    } else if (Fp > 0) s.stuck = true;
    if (s.push > 0) s.push = Math.max(0, s.push - h);
  } else s.jolt += h;
  s.t += h;

  const b = s.ball;
  if (b.mode === 'cart') {
    b.x = s.x + BALL_DX;
    b.vx = s.v;
  } else if (b.mode === 'slide') {
    b.x += b.vx * h;
    if (b.x >= s.x + CART_L / 2) b.mode = 'air';
  } else if (b.mode === 'air') {
    b.x += b.vx * h;
    b.y += b.vy * h - 0.5 * G * h * h;
    b.vy -= G * h;
    if (b.y <= BALL_R) {
      b.y = BALL_R;
      b.vy = 0;
      b.mode = b.vx > 1e-6 ? 'ground' : 'rest';
    }
  } else if (b.mode === 'ground') {
    const a = -mu * G;
    let dt = h;
    if (a < 0 && b.vx + a * h <= 0) dt = b.vx / -a;
    b.x += b.vx * dt + 0.5 * a * dt * dt;
    b.vx = dt < h ? 0 : b.vx + a * dt;
    if (b.vx <= 1e-9) {
      b.vx = 0;
      b.mode = 'rest';
    }
  }
}

function advance(p, dt, F, m, mu, surface) {
  const s = { ...p, ball: { ...p.ball } };
  let left = dt;
  while (left > 1e-9) {
    let h = Math.min(left, 1 / 240);
    if (s.push > 0) h = Math.min(h, s.push);
    stepOnce(s, h, F, m, mu);
    left -= h;
  }
  const free = s.ball.mode === 'slide' || s.ball.mode === 'air' || s.ball.mode === 'ground';
  const last = s.samples[s.samples.length - 1];
  if (s.t - last.t >= 0.04) {
    let samples = [...s.samples, { t: s.t, v: s.v, vb: s.ball.mode === 'cart' ? null : s.ball.vx }];
    if (samples.length > 2400) samples = samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1);
    s.samples = samples;
  }
  if (s.ball.mode === 'slide' || s.ball.mode === 'air') {
    const lt = s.trail[s.trail.length - 1];
    if (!lt || s.ball.x - lt.x > 0.03) s.trail = [...s.trail, { x: s.ball.x, y: s.ball.y }];
  }
  s.active = s.push > 0 || s.v > 0 || free || (s.chock !== null && s.jolt < JOLT_READ + 0.2);
  if (!s.active) {
    s.samples = [...s.samples, { t: s.t, v: s.v, vb: s.ball.mode === 'cart' ? null : s.ball.vx }];
    s.runs = { ...s.runs, [surface]: s.samples.map((q) => ({ x: q.t, y: q.v })) };
    if (s.chock === null && s.started) s.flags = { ...s.flags, [surface]: s.x - X0 };
  }
  return s;
}

/** Keeps a polyline inside x ≤ xMax (interpolating the cut point). */
function clip(points, xMax) {
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const q = points[i];
    if (q.x <= xMax) out.push(q);
    else {
      const a = points[i - 1];
      if (a) out.push({ x: xMax, y: a.y + ((q.y - a.y) * (xMax - a.x)) / Math.max(1e-9, q.x - a.x) });
      break;
    }
  }
  return out;
}

/* ================================================================= sim */

export default function CartSim({ T }) {
  const L = T.cart;
  const dec = T.decimal;
  const [surface, setSurface] = useState('wood');
  const [F, setF] = useState(20);
  const [m, setM] = useState(5);
  const [s, setS] = useState(fresh);
  const mu = SURFACES[surface].mu;
  const fMax = mu * m * G;

  useRafLoop(s.active, (dt) => setS((p) => (p.active ? advance(p, dt, F, m, mu, surface) : p)));

  const push = () =>
    setS((p) => {
      if (p.chock !== null || p.push > 0) return p;
      return { ...p, push: PUSH_T, started: true, active: true };
    });
  const suddenStop = () =>
    setS((p) => {
      if (p.chock !== null || p.v <= 1e-6) return p;
      const ball = p.ball.mode === 'cart' ? { ...p.ball, mode: 'slide', vx: p.v } : p.ball;
      return {
        ...p,
        v: 0,
        push: 0,
        chock: p.x + WHEEL_DX + WHEEL_R + 0.015,
        jolt: 0,
        joltV: p.v,
        ball,
        trail: [{ x: ball.x, y: ball.y }],
        samples: [...p.samples, { t: p.t, v: p.v, vb: null }, { t: p.t, v: 0, vb: ball.vx }],
        active: true,
      };
    });
  const archive = (p) => (p.started && p.samples.length > 1 ? { ...p.runs, [surface]: p.samples.map((q) => ({ x: q.t, y: q.v })) } : p.runs);
  const reset = () => setS((p) => ({ ...freshRun(), runs: archive(p), flags: p.flags }));
  const pickSurface = (id) => {
    setSurface(id);
    setS((p) => ({ ...freshRun(), runs: archive(p), flags: p.flags }));
  };
  const changeF = (n) => {
    setF(n);
    setS(fresh());
  };
  const changeM = (n) => {
    setM(n);
    setS(fresh());
  };

  /* ---- forces now */
  const pushing = s.push > 0;
  const moving = s.v > 1e-6;
  const Fp = pushing ? F : 0;
  let fr = 0;
  if (s.chock === null) {
    if (moving || (pushing && F > fMax + 1e-9)) fr = fMax;
    else if (pushing) fr = F; // static friction balances a weak push
  }
  const R = Fp - fr;
  const b = s.ball;
  const ballFree = b.mode !== 'cart';
  const vBall = b.mode === 'cart' ? s.v : b.vx;
  const dist = s.x - X0;
  const pred = predict(F, m, mu);

  /* ---- explanation */
  let key = 'idle';
  if (s.chock !== null) {
    if (b.mode === 'slide' || b.mode === 'air' || s.jolt < JOLT_READ) key = 'jolt';
    else if (b.mode === 'ground') key = mu > 0 ? 'ballRoll' : 'ballGlide';
    else key = 'ballStop';
  } else if (pushing) key = s.stuck ? 'stuck' : 'push';
  else if (moving) key = mu > 0 ? 'slow' : 'glide';
  else if (s.started) key = s.stuck ? 'stuck' : 'stopped';
  const settled = useSettled(key, key === 'idle' || key === 'jolt' ? 0 : 250);
  const ex = L.explain;
  const F2 = (n) => num(n, 2, dec);
  const text = {
    idle: ex.idle,
    push: ex.push,
    stuck: ex.stuck(fmt(F, 0, dec), F2(fMax)),
    slow: ex.slow,
    glide: ex.glide(F2(s.v)),
    stopped: ex.stopped[surface](F2(dist)),
    jolt: ex.jolt(F2(s.joltV)),
    ballRoll: ex.ballRoll,
    ballGlide: ex.ballGlide(F2(b.vx)),
    ballStop: ex.ballStop(F2(Math.max(0, b.x - BALL_R - (s.x + CART_L / 2)))),
  }[settled];
  const tone = {
    idle: '#22d3ee',
    push: '#f87171',
    stuck: '#fbbf24',
    slow: '#fbbf24',
    glide: '#34d399',
    stopped: '#34d399',
    jolt: '#f472b6',
    ballRoll: '#fbbf24',
    ballGlide: '#34d399',
    ballStop: '#34d399',
  }[settled];

  /* ---- readout subs */
  let vSub = L.vSub.rest;
  if (s.chock !== null) vSub = L.vSub.stopped;
  else if (pushing) vSub = s.stuck ? L.vSub.stuck : L.vSub.push;
  else if (moving) vSub = mu > 0 ? L.vSub.slow : L.vSub.glide;
  const vbSub = { cart: L.vbSub.cart, slide: L.vbSub.fly, air: L.vbSub.fly, ground: L.vbSub.roll, rest: L.vbSub.rest }[b.mode];

  /* ---- graph */
  const cartPts = s.samples.map((q) => ({ x: q.t, y: q.v }));
  if (s.active) cartPts.push({ x: s.t, y: s.v });
  const ballPts = s.samples.filter((q) => q.vb !== null).map((q) => ({ x: q.t, y: q.vb }));
  if (ballFree && s.active) ballPts.push({ x: s.t, y: b.vx });
  const oldIds = SURFACE_IDS.filter((id) => s.runs[id] && !(id === surface && s.started));
  const ends = oldIds.map((id) => s.runs[id][s.runs[id].length - 1].x);
  const predT = s.started && Number.isFinite(pred.t) ? pred.t : 0;
  const xMax = Math.min(40, niceMax(Math.max(4, s.t + (mu > 0 ? 0 : 1), predT, ...ends)));
  const yTop = Math.max(0.5, predict(F, m, 0).v1, ...cartPts.map((q) => q.y), ...oldIds.flatMap((id) => s.runs[id].map((q) => q.y)));
  const yMax = niceMax(yTop);
  const series = [
    ...oldIds.map((id) => ({ id: `old-${id}`, label: L.surfaces[id].name, color: SURFACES[id].graph, points: clip(s.runs[id], xMax), dash: '5 5', dot: false })),
    { id: 'cart', label: L.graph.cart, color: PALETTE.velText, points: clip(cartPts, xMax) },
    ...(ballPts.length > 0 ? [{ id: 'ball', label: L.graph.ball, color: PALETTE.secondText, points: clip(ballPts, xMax), dash: '2 4' }] : []),
  ];

  const canPush = s.chock === null && !pushing;
  const canStop = s.chock === null && moving;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.surfaceLabel}</GroupLabel>
          <Segmented
            label={L.surfaceLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={surface}
            onChange={pickSurface}
            accent="#38bdf8"
            options={SURFACE_IDS.map((id) => ({ value: id, label: L.surfaces[id].name, sub: L.surfaces[id].sub, icon: SURFACES[id].icon }))}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 xl:flex">
          <Btn variant="primary" icon={Hand} onClick={push} disabled={!canPush} className="xl:min-w-[132px] min-h-[52px] text-[15px] px-3">
            {L.push}
          </Btn>
          <Btn icon={OctagonX} onClick={suddenStop} disabled={!canStop} className="min-h-[52px] text-[15px] px-3 leading-tight">
            {L.stop}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!s.started} className="min-h-[52px] text-[15px] px-3">
            {L.reset}
          </Btn>
        </div>
      </div>

      <CartScene T={T} s={s} Fp={Fp} fr={fr} surface={surface} />

      <LiveExplain id={settled} tone={tone} text={text} />

      {/* readouts */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.v} symbol="v" value={F2(s.v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={vSub} active={moving} />
        <Readout
          label={L.readouts.vb}
          symbol={<Sym s="v" sub={L.subBall} />}
          value={F2(vBall)}
          unit={T.ms}
          accent={PALETTE.second}
          textColor={PALETTE.secondText}
          sub={vbSub}
          active={ballFree && b.mode !== 'rest'}
        />
        <Readout
          label={L.readouts.s}
          symbol="s"
          value={F2(dist)}
          unit={T.m}
          accent={PALETTE.path}
          textColor={PALETTE.pathText}
          sub={pred.stuck ? L.sSubStuck : Number.isFinite(pred.s) ? L.sSub(F2(pred.s)) : L.sSubInf}
        />
        <Readout label={L.readouts.R} symbol="R" value={num(R, 2, dec)} unit={T.N} accent={PALETTE.force} textColor="#fca5a5">
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs leading-snug text-gray-400 tabular-nums">
              <span className="block whitespace-nowrap text-gray-300">
                R = <Sym s="F" /> − <Sym s="F" sub={L.subFric} />
              </span>
              <span className="block whitespace-nowrap">
                = {fmt(Fp, 0, dec)} − {F2(fr)}
              </span>
              <span className={`block ${Math.abs(R) < 1e-9 ? 'text-emerald-300' : 'text-amber-300'}`}>{Math.abs(R) < 1e-9 ? L.Rzero : R > 0 ? L.Rpos : L.Rneg}</span>
            </p>
            <div className="hidden sm:block">
              <MiniFBD mg={m * G} F={Fp} f={fr} L={L} />
            </div>
          </div>
        </Readout>
      </div>

      {/* controls + graph */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="nfl-force"
            label={L.force}
            symbol="F"
            min={5}
            max={30}
            step={1}
            value={F}
            onChange={changeF}
            accent={PALETTE.force}
            display={`${fmt(F, 0, dec)} ${T.N}`}
            hint={L.forceHint(fmt(PUSH_T, 1, dec))}
          />
          <RangeField
            id="nfl-mass"
            label={L.mass}
            symbol="m"
            min={2}
            max={10}
            step={0.5}
            value={m}
            onChange={changeM}
            accent="#94a3b8"
            display={`${fmt(m, 1, dec)} ${T.kg}`}
            hint={L.massHint(fmt(m * G, 1, dec))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300 tabular-nums">
            <Sym s="F" sub={L.subFric} /> = μ·m·g = {fmt(mu, 2, dec)} · {fmt(m, 1, dec)} · {fmt(G, 1, dec)} = <b className="text-amber-300">{F2(fMax)} {T.N}</b>
          </div>
          <Predictions T={T} F={F} m={m} surface={surface} flags={s.flags} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={xMax}
            yMax={yMax}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={s.started ? Math.min(s.t, xMax) : undefined}
            decimal={dec}
            yDigits={tickDigits(yMax)}
            height={210}
            note={L.graph.note}
            ariaLabel={L.graph.label}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- predictions */

function Predictions({ T, F, m, surface, flags }) {
  const L = T.cart;
  const dec = T.decimal;
  const rows = SURFACE_IDS.map((id) => ({ id, ...predict(F, m, SURFACES[id].mu) }));
  const finite = rows.filter((r) => Number.isFinite(r.s)).map((r) => r.s);
  const top = Math.max(0.1, ...finite) * 1.08;
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.predict.title}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => {
          const on = r.id === surface;
          const inf = !Number.isFinite(r.s);
          const pct = inf ? 100 : (r.s / top) * 100;
          const measured = flags[r.id] !== undefined;
          return (
            <li key={r.id} className="flex items-center gap-2 text-xs">
              <span className={`w-[72px] shrink-0 truncate ${on ? 'font-semibold text-white' : 'text-gray-400'}`}>{L.surfaces[r.id].name}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(r.stuck ? 0 : 2, pct)}%`,
                    background: inf ? `linear-gradient(90deg, ${SURFACES[r.id].graph}, transparent)` : SURFACES[r.id].graph,
                    opacity: on ? 1 : 0.55,
                  }}
                />
              </span>
              <span className={`w-[92px] shrink-0 text-right tabular-nums ${on ? 'text-white' : 'text-gray-400'}`}>
                {r.stuck ? L.predict.stuck : inf ? L.predict.inf : `${num(r.s, 2, dec)} ${T.m}`}
                {measured && <span className="ml-1 text-emerald-300" aria-label={L.predict.measured}>✓</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-gray-500">{L.predict.note}</p>
    </div>
  );
}

/* --------------------------------------------------------------- mini FBD */

function MiniFBD({ mg, F, f, L }) {
  const W = 104;
  const H = 76;
  const cx = W / 2;
  const cy = H / 2;
  const k = 30 / Math.max(mg, F, f, 1);
  const lab = (x, y, t, sub, color, anchor = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} fontSize="10" fontWeight="700" fill={color}>
      <tspan fontStyle="italic">{t}</tspan>
      {sub && (
        <tspan fontSize="7.5" dy="2.5">
          {sub}
        </tspan>
      )}
    </text>
  );
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" role="img" aria-label={L.fbdLabel}>
      <rect x={cx - 11} y={cy - 7} width={22} height={14} rx={3} fill="rgba(248,113,113,0.25)" stroke="rgba(248,113,113,0.6)" />
      <Arrow x1={cx} y1={cy} x2={cx} y2={cy + mg * k} color="#38bdf8" width={2} head={6} />
      <Arrow x1={cx} y1={cy} x2={cx} y2={cy - mg * k} color="#a78bfa" width={2} head={6} />
      {F > 0 && <Arrow x1={cx} y1={cy} x2={cx + F * k} y2={cy} color="#f87171" width={2} head={6} />}
      {f * k > 1.5 && <Arrow x1={cx} y1={cy} x2={cx - f * k} y2={cy} color="#fbbf24" width={2} head={6} />}
      <circle cx={cx} cy={cy} r={2.2} fill="#fff" />
      {lab(cx + 5, cy + mg * k - 2, 'mg', null, '#7dd3fc', 'start')}
      {lab(cx + 5, cy - mg * k + 9, 'N', null, '#c4b5fd', 'start')}
      {F > 0 && lab(Math.min(W - 6, cx + F * k), cy - 6, 'F', null, '#fca5a5', 'end')}
      {f > 0 && lab(Math.max(2, cx - Math.max(f * k, 8)), cy - 6, 'F', L.subFric, '#fcd34d', 'start')}
    </svg>
  );
}

/* ----------------------------------------------------------------- scene */

function CartScene({ T, s, Fp, fr, surface }) {
  const L = T.cart;
  const dec = T.decimal;
  const b = s.ball;
  const ballFree = b.mode !== 'cart';
  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: COL.push, label: L.legend.F, kind: 'arrow' },
        { color: COL.fric, label: L.legend.f, kind: 'arrow' },
        { color: COL.ball, label: L.legend.path, kind: 'dash' },
      ]}
      chips={(W, narrow) => (
        <>
          <Chip>{L.chipTime(fmt(s.t, 1, dec))}</Chip>
          <ScaleChip px={10 * (narrow ? KF_NARROW : KF_WIDE)} color={COL.push}>
            {L.scale(fmt(10, 0, dec))}
          </ScaleChip>
        </>
      )}
      height={(W, narrow) => (narrow ? 230 : 290)}
      ariaLabel={L.sceneLabel(num(s.x - X0, 2, dec), num(s.v, 2, dec), num(b.mode === 'cart' ? s.v : b.vx, 2, dec))}
    >
      {(W, H, narrow) => {
        const span = narrow ? 4.4 : 7.2;
        const target = Math.max(s.x + CART_L / 2, ballFree ? b.x + BALL_R : -Infinity);
        const camX0 = Math.max(-0.6, target - 0.68 * span);
        const view = lineView(camX0, camX0 + span, W, 0, 0);
        const k = view.k;
        const groundY = H - 58;
        const Y = (y) => groundY - y * k;
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const step = rulerStep(k, narrow ? 46 : 58);
        const kF = narrow ? KF_NARROW : KF_WIDE; // px per newton
        const kv = narrow ? 26 : 48; // px per m/s

        const cx = view.sx(s.x);
        const rear = view.sx(s.x - CART_L / 2);
        const front = view.sx(s.x + CART_L / 2);
        const wheelR = WHEEL_R * k;
        const spin = (s.x / WHEEL_R) % (2 * Math.PI);
        const bx = view.sx(b.x);
        const by = Y(b.y);
        const br = Math.max(4, BALL_R * k);
        const ballTop = b.mode === 'cart' ? Y(BALL_Y + BALL_R) : Y(BODY_Y1);
        const vRow = Math.min(ballTop, Y(BALL_Y + BALL_R)) - (narrow ? 16 : 20);
        const fRow = vRow - (narrow ? 26 : 30);
        const pushing = s.push > 0;
        const joltOn = s.chock !== null && s.jolt < 0.45;

        const vText = [{ t: 'v', italic: true }, { t: ` = ${num(s.v, 2, dec)} ${T.ms}` }];
        const vbText = [{ t: 'v', italic: true }, { t: L.subBall, sub: true }, { t: ` = ${num(b.vx, 2, dec)} ${T.ms}` }];
        const FText = [{ t: 'F', italic: true }, { t: ` = ${fmt(Fp, 0, dec)} ${T.N}` }];
        const fText = [{ t: 'F', italic: true }, { t: L.subFric, sub: true }, { t: ` = ${num(fr, 2, dec)} ${T.N}` }];
        const flagIds = Object.keys(s.flags);

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={groundY} step={step} />
            <Ground view={view} W={W} y={groundY} surface={surface} k={k} />
            <Ruler view={view} W={W} y={groundY + 18} step={step} unit={L.axisX} decimal={dec} digits={step < 1 ? 1 : 0} fs={fs - 1} minorDiv={step >= 1 ? 10 : 5} />
            {/* start line */}
            <line x1={view.sx(0)} x2={view.sx(0)} y1={groundY} y2={groundY - 0.75 * k} stroke={PALETTE.ink} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* stopping flags of earlier runs */}
            {flagIds.map((id) => {
              const fx = view.sx(s.flags[id]);
              if (fx < -60 || fx > W + 60) return null;
              const poleTop = groundY - (narrow ? 46 : 62);
              return (
                <g key={id} opacity={id === surface ? 1 : 0.75}>
                  <line x1={fx} x2={fx} y1={groundY} y2={poleTop} stroke={SURFACES[id].flag} strokeWidth="1.6" />
                  <path d={`M${fx},${poleTop} l14,5 l-14,5 Z`} fill={SURFACES[id].flag} />
                  <text x={fx + 3} y={poleTop - 5} fontSize={fs - 2} fontWeight="700" fill={SURFACES[id].flag} stroke="#fbfcfe" strokeWidth="3" paintOrder="stroke">
                    {L.flag(L.surfaces[id].name, num(s.flags[id], 2, dec))}
                  </text>
                </g>
              );
            })}

            {/* ball trail */}
            {s.trail.length > 0 && (
              <polyline
                points={[...s.trail, { x: b.x, y: b.y }].map((q) => `${view.sx(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={COL.ball}
                strokeWidth="2"
                strokeDasharray="3 4"
                strokeOpacity="0.7"
              />
            )}

            {/* chock */}
            {s.chock !== null && (
              <g>
                <path
                  d={`M${view.sx(s.chock)},${groundY} L${view.sx(s.chock + 0.03)},${Y(0.1)} L${view.sx(s.chock + 0.13)},${Y(0.1)} L${view.sx(s.chock + 0.15)},${groundY} Z`}
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                {joltOn && <circle cx={view.sx(s.chock + 0.02)} cy={Y(WHEEL_R)} r={wheelR * 1.4} fill="none" stroke="#f59e0b" strokeWidth="2" opacity={1 - s.jolt / 0.45} />}
              </g>
            )}

            {/* pusher hand */}
            {pushing && (
              <g>
                <path d={`M${rear - 0.42 * k},${Y(0.12)} Q${rear - 0.25 * k},${Y(0.27)} ${rear - 0.07 * k},${Y(0.27)}`} fill="none" stroke="#c0835a" strokeWidth={Math.max(5, 0.07 * k)} strokeLinecap="round" />
                <rect x={rear - 0.075 * k} y={Y(0.33)} width={0.075 * k} height={0.13 * k} rx={0.03 * k} fill="#f4c095" stroke="#c0835a" strokeWidth="1.2" />
              </g>
            )}

            {/* cart */}
            <g>
              <rect x={rear} y={Y(BODY_Y1)} width={front - rear} height={(BODY_Y1 - BODY_Y0) * k} rx={Math.max(3, 0.04 * k)} fill={COL.cart} stroke={COL.cartDark} strokeWidth="1.5" />
              <rect x={rear + 0.05 * k} y={Y(BODY_Y1) + 0.04 * k} width={front - rear - 0.1 * k} height={0.05 * k} rx={0.02 * k} fill="#fff" opacity="0.25" />
              <path d={`M${view.sx(s.x + BALL_DX) - 0.13 * k},${Y(BODY_Y1)} Q${view.sx(s.x + BALL_DX)},${Y(BODY_Y1 - 0.05)} ${view.sx(s.x + BALL_DX) + 0.13 * k},${Y(BODY_Y1)}`} fill="#7f1d1d" opacity="0.55" />
              {[-WHEEL_DX, WHEEL_DX].map((dx) => {
                const wx = view.sx(s.x + dx);
                const wy = Y(WHEEL_R);
                return (
                  <g key={dx}>
                    <circle cx={wx} cy={wy} r={wheelR} fill="#1e293b" />
                    <circle cx={wx} cy={wy} r={wheelR * 0.55} fill="#cbd5e1" />
                    {[0, Math.PI / 2].map((a0) => (
                      <line
                        key={a0}
                        x1={wx + Math.cos(spin + a0) * wheelR * 0.5}
                        y1={wy + Math.sin(spin + a0) * wheelR * 0.5}
                        x2={wx - Math.cos(spin + a0) * wheelR * 0.5}
                        y2={wy - Math.sin(spin + a0) * wheelR * 0.5}
                        stroke="#475569"
                        strokeWidth="1.5"
                      />
                    ))}
                    <circle cx={wx} cy={wy} r={1.8} fill="#1e293b" />
                  </g>
                );
              })}
            </g>

            {/* ball */}
            <g>
              <circle cx={bx} cy={by} r={br} fill={COL.ball} stroke={COL.ballDark} strokeWidth="1.5" />
              <path
                d={`M${bx + Math.cos(b.x / BALL_R) * br},${by + Math.sin(b.x / BALL_R) * br} L${bx - Math.cos(b.x / BALL_R) * br},${by - Math.sin(b.x / BALL_R) * br}`}
                stroke="#fff"
                strokeOpacity="0.55"
                strokeWidth="1.5"
              />
              <circle cx={bx - br * 0.35} cy={by - br * 0.35} r={br * 0.28} fill="#fff" opacity="0.5" />
            </g>

            {/* velocity of the cart */}
            {s.v > 1e-3 && (
              <>
                <Arrow x1={cx} y1={vRow} x2={cx + s.v * kv} y2={vRow} color={PALETTE.vel} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />
                <circle cx={cx} cy={vRow} r={3} fill={PALETTE.vel} />
              </>
            )}
            {(s.v > 1e-3 || s.started) && s.chock === null && (
              <TagPill x={cx - 8} y={vRow} anchor="end" parts={vText} bg={PALETTE.vel} size={fs} box={box} />
            )}

            {/* forces on the cart (horizontal ones, from its centre of mass) */}
            {(Fp > 0 || fr > 0) && <circle cx={cx} cy={fRow} r={3} fill={PALETTE.ink} />}
            {Fp > 0 && <Arrow x1={cx} y1={fRow} x2={cx + Fp * kF} y2={fRow} color={COL.push} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />}
            {fr > 0 && <Arrow x1={cx} y1={fRow} x2={cx - fr * kF} y2={fRow} color={COL.fric} width={narrow ? 3 : 3.5} head={narrow ? 9 : 11} />}
            {Fp > 0 && <TagPill x={cx + Fp * kF + 6} y={fRow} anchor="start" parts={FText} bg={COL.push} size={fs} box={box} />}
            {fr > 0 && <TagPill x={cx - Math.max(fr * kF, 6) - 6} y={fRow} anchor="end" parts={fText} bg={COL.fric} size={fs} box={box} />}
            {joltOn && (
              <g opacity={1 - s.jolt / 0.45}>
                <Arrow x1={front - 0.05 * k} y1={Y(WHEEL_R + 0.06)} x2={front - 0.05 * k - (narrow ? 70 : 130)} y2={Y(WHEEL_R + 0.06)} color={COL.stop} width={narrow ? 4 : 5} head={narrow ? 12 : 15} />
                <TagPill x={front - 0.05 * k - (narrow ? 76 : 136)} y={Y(WHEEL_R + 0.06)} anchor="end" parts={[{ t: L.stopForce }]} bg={COL.stop} size={fs} box={box} />
              </g>
            )}

            {/* velocity of the free ball */}
            {ballFree && b.vx > 1e-3 && (
              <>
                <Arrow x1={bx} y1={by - br - 10} x2={bx + b.vx * kv} y2={by - br - 10} color={PALETTE.vel} width={narrow ? 2.5 : 3} head={narrow ? 9 : 11} />
                <TagPill x={bx + b.vx * kv + 6} y={by - br - 10} anchor="start" parts={vbText} bg={PALETTE.vel} size={fs - 1} box={box} />
              </>
            )}

          </>
        );
      }}
    </LabScene>
  );
}

/* ------------------------------------------------------------ decoration */

function PaperGrid({ view, W, top, bottom, step }) {
  const lines = [];
  const first = Math.ceil(view.wx(0) / step) * step;
  for (let x = first; x <= view.wx(W); x += step) {
    const px = view.sx(x);
    lines.push(<line key={`v${x.toFixed(3)}`} x1={px} x2={px} y1={top} y2={bottom} stroke={PALETTE.grid} strokeWidth={1} />);
  }
  for (let y = bottom; y >= top; y -= 28) lines.push(<line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={PALETTE.grid} strokeWidth={1} />);
  return <g aria-hidden="true">{lines}</g>;
}

/** The surface band under the cart; its marks are fixed to the ground, so they show the motion. */
function Ground({ view, W, y, surface, k }) {
  const h = 16;
  const x0 = view.wx(-20);
  const x1 = view.wx(W + 20);
  const items = [];
  if (surface === 'wood') {
    const plank = 0.9;
    for (let i = Math.floor(x0 / plank); i <= Math.ceil(x1 / plank); i += 1) {
      const px = view.sx(i * plank);
      items.push(<line key={`p${i}`} x1={px} x2={px} y1={y} y2={y + h} stroke="#a16207" strokeOpacity="0.55" strokeWidth="1.2" />);
      items.push(
        <path
          key={`g${i}`}
          d={`M${px + 0.12 * k},${y + 5 + hash01(i) * 4} q${0.2 * k},-3 ${0.4 * k},0 t${0.3 * k},0`}
          fill="none"
          stroke="#b45309"
          strokeOpacity="0.35"
          strokeWidth="1"
        />,
      );
    }
  } else if (surface === 'sand') {
    const stepW = Math.max(0.03, 7 / k);
    for (let i = Math.floor(x0 / stepW); i <= Math.ceil(x1 / stepW); i += 1) {
      const px = view.sx((i + hash01(i) * 0.8) * stepW);
      items.push(<circle key={`d${i}`} cx={px} cy={y + 3 + hash01(i + 7) * (h - 6)} r={0.8 + hash01(i + 3) * 0.9} fill="#a16207" opacity={0.35 + hash01(i + 5) * 0.3} />);
    }
  } else if (surface === 'ice') {
    const stepW = 0.7;
    for (let i = Math.floor(x0 / stepW); i <= Math.ceil(x1 / stepW); i += 1) {
      const px = view.sx((i + hash01(i) * 0.6) * stepW);
      const len = (0.12 + hash01(i + 2) * 0.25) * k;
      items.push(<line key={`s${i}`} x1={px} x2={px + len} y1={y + 4 + hash01(i + 4) * 8} y2={y + 2 + hash01(i + 4) * 8} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />);
    }
  } else {
    // the ideal surface: a polished band with evenly spaced marks (they show the motion)
    const stepW = 0.5;
    for (let i = Math.floor(x0 / stepW); i <= Math.ceil(x1 / stepW); i += 1) {
      const px = view.sx(i * stepW);
      items.push(<path key={`i${i}`} d={`M${px},${y + h - 3} l${0.12 * k},${-(h - 6)}`} stroke="#8b5cf6" strokeOpacity="0.4" strokeWidth="1.4" />);
    }
    items.push(<line key="gloss" x1={0} x2={W} y1={y + 4} y2={y + 4} stroke="#fff" strokeWidth="2" opacity="0.9" />);
  }
  const fill = { wood: '#e9c89b', sand: '#f3e1b5', ice: '#dbeafe', ideal: '#ede9fe' }[surface];
  const edge = { wood: '#92400e', sand: '#b08944', ice: '#60a5fa', ideal: '#8b5cf6' }[surface];
  return (
    <g aria-hidden="true">
      <rect x={0} y={y} width={W} height={h} fill={fill} />
      {items}
      <line x1={0} x2={W} y1={y} y2={y} stroke={edge} strokeWidth="1.8" />
      <rect x={0} y={y + h} width={W} height={2} fill={edge} opacity="0.25" />
    </g>
  );
}
