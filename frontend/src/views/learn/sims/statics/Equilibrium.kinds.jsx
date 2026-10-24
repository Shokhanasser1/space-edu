import { useState } from 'react';
import { ArrowLeft, ArrowRight, Lightbulb, Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import { Chip, G, InfoBox, LabScene, Panel, Sym, SvgSym, ForceArrow, num } from './Equilibrium.parts';

/**
 * Tab 4 — the three kinds of equilibrium: a ball in a bowl (stable), on a
 * hump (unstable) and on a flat table (neutral). All three get the same
 * nudge. The component of gravity along the surface, mg·sinβ, points back to
 * the bottom of the bowl, away from the top of the hump, and is zero on the
 * table; the ball's centre of gravity rises, falls or stays level.
 * A solid ball rolling without slipping: a = −(5/7)·g·sinβ − c·v along the
 * surface (c = 1.6 1/s stands for rolling resistance and air), N = m(g·cosβ + κv²).
 */

const COL = {
  mg: '#dc2626',
  N: '#2563eb',
  Ft: '#ea580c',
  FtText: '#fdba74',
};
const KIND_COL = {
  stable: { line: '#059669', text: '#6ee7b7', series: '#34d399' },
  unstable: { line: '#db2777', text: '#f9a8d4', series: '#f472b6' },
  neutral: { line: '#7c3aed', text: '#c4b5fd', series: '#a78bfa' },
};

const R_BOWL = 0.35;
const X_RIM = 0.3;
const H_RIM = R_BOWL - Math.sqrt(R_BOWL ** 2 - X_RIM ** 2); // 0.17 m
const H_DOME = 0.18;
const W_DOME = 0.58;
const X_WALL = 0.64; // the ball's contact point stops here (bumpers)
const BALL_R = 0.05;
const BALL_M = 0.2; // kg
const ROLL = 5 / 7; // a solid ball rolling: a = (5/7)·g·sinβ
const C_RES = 1.6; // 1/s
const ARROW_M = 0.26; // m of drawing for mg
const T_GRAPH = 8; // s
const BOX = { x0: -0.72, x1: 0.72, y0: -0.27, y1: 0.62 };
const KINDS = ['stable', 'unstable', 'neutral'];

const SURF = {
  stable: {
    f: (x) => (Math.abs(x) <= X_RIM ? R_BOWL - Math.sqrt(R_BOWL ** 2 - x * x) : H_RIM),
    fp: (x) => (Math.abs(x) < X_RIM ? x / Math.sqrt(R_BOWL ** 2 - x * x) : 0),
    fpp: (x) => (Math.abs(x) < X_RIM ? R_BOWL ** 2 / (R_BOWL ** 2 - x * x) ** 1.5 : 0),
    y0: 0,
  },
  unstable: {
    f: (x) => (Math.abs(x) < W_DOME ? (H_DOME * (1 + Math.cos((Math.PI * x) / W_DOME))) / 2 : 0),
    fp: (x) => (Math.abs(x) < W_DOME ? ((-H_DOME * Math.PI) / (2 * W_DOME)) * Math.sin((Math.PI * x) / W_DOME) : 0),
    fpp: (x) => (Math.abs(x) < W_DOME ? ((-H_DOME * (Math.PI / W_DOME) ** 2) / 2) * Math.cos((Math.PI * x) / W_DOME) : 0),
    y0: H_DOME,
  },
  neutral: { f: () => 0, fp: () => 0, fpp: () => 0, y0: 0 },
};

const REST = { x: 0, v: 0, s: 0, moved: false, rest: true };
const IDLE = { balls: { stable: REST, unstable: REST, neutral: REST }, t: 0, running: false, done: false, samples: [] };

/** Gravity's part along the surface and the support force for a ball at contact x moving at v. */
function forcesAt(kind, x, v) {
  const sf = SURF[kind];
  const fp = sf.fp(x);
  const cb = 1 / Math.sqrt(1 + fp * fp);
  const sb = fp * cb;
  const kappa = sf.fpp(x) * cb ** 3;
  const mg = BALL_M * G;
  return { sb, cb, Ft: -mg * sb, N: Math.max(0, BALL_M * (G * cb + kappa * v * v)), mg };
}

function stepBall(kind, b, h) {
  const sf = SURF[kind];
  let { x, v, s } = b;
  const fp = sf.fp(x);
  const cb = 1 / Math.sqrt(1 + fp * fp);
  const sb = fp * cb;
  const a = -ROLL * G * sb - C_RES * v;
  v += a * h;
  x += v * cb * h;
  s += v * h;
  if (Math.abs(x) >= X_WALL) {
    x = Math.sign(x) * X_WALL;
    v = 0;
  }
  return { ...b, x, v, s };
}

function settledBall(kind, b) {
  const sf = SURF[kind];
  const fp = sf.fp(b.x);
  if (kind === 'stable') return Math.abs(b.x) < 0.0015 && Math.abs(b.v) < 0.006;
  if (Math.abs(b.x) >= X_WALL - 1e-9) return Math.abs(b.v) < 1e-9;
  return Math.abs(b.v) < 0.004 && Math.abs(fp) < 1e-9;
}

/* ==================================================================== sim */

export default function KindsSim({ T }) {
  const L = T.kinds;
  const dec = T.decimal;
  const [v0, setV0] = useState(0.6);
  const [slow, setSlow] = useState(1);
  const [sim, setSim] = useState(IDLE);
  const [paused, setPaused] = useState(false);

  useRafLoop(sim.running && !paused, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const dts = dt * slow;
      const n = Math.max(1, Math.ceil(dts / 0.002));
      const h = dts / n;
      const balls = { ...p.balls };
      for (const kd of KINDS) {
        let b = balls[kd];
        if (b.rest) continue;
        for (let i = 0; i < n; i += 1) b = stepBall(kd, b, h);
        if (settledBall(kd, b)) b = { ...b, x: kd === 'stable' ? 0 : b.x, v: 0, rest: true };
        balls[kd] = b;
      }
      const t = p.t + dts;
      const last = p.samples[p.samples.length - 1];
      const samples = t <= T_GRAPH + 1e-9 && (!last || t - last.x >= 0.03) ? [...p.samples, { x: t, b: KINDS.map((kd) => balls[kd].x) }] : p.samples;
      const all = KINDS.every((kd) => balls[kd].rest);
      return { balls, t, running: !all, done: all, samples };
    });
  });

  const nudge = (dir) => {
    setPaused(false);
    setSim((p) => {
      const fresh = !p.running;
      const balls = {};
      for (const kd of KINDS) balls[kd] = { ...p.balls[kd], v: p.balls[kd].v + dir * v0, moved: true, rest: false };
      const t = fresh ? 0 : p.t;
      return { balls, t, running: true, done: false, samples: fresh ? [{ x: 0, b: KINDS.map((kd) => balls[kd].x) }] : p.samples };
    });
  };
  const reset = () => {
    setPaused(false);
    setSim(IDLE);
  };

  /* ---- per-ball state */
  const info = {};
  for (const kd of KINDS) {
    const b = sim.balls[kd];
    const f = forcesAt(kd, b.x, b.v);
    const dh = (SURF[kd].f(b.x) - SURF[kd].y0) * 100; // cm
    let state;
    if (!b.moved) state = 'eq';
    else if (kd === 'stable') state = b.rest ? 'back' : 'returning';
    else if (kd === 'unstable') state = b.rest ? 'gone' : 'away';
    else state = b.rest ? 'newPlace' : 'rolling';
    // which way gravity's part along the surface points: to the equilibrium point or away from it
    const toward = Math.abs(f.Ft) < 1e-4 || Math.abs(b.x) < 1e-6 ? 0 : Math.sign(f.Ft) === -Math.sign(b.x) ? 1 : -1;
    info[kd] = { b, f, dh, state, toward };
  }

  const anyMoved = KINDS.some((kd) => sim.balls[kd].moved);
  let key;
  if (!anyMoved) key = 'idle';
  else if (sim.done) key = 'done';
  else if (paused) key = 'paused';
  else if (sim.t < 2.2) key = 'push';
  else key = 'run';
  const settled = useSettled(key, key === 'push' || key === 'idle' ? 0 : 300);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    push: ex.push,
    run: ex.run,
    paused: ex.paused(fmt(Math.abs(info.stable.f.Ft), 2, dec), fmt(Math.abs(info.unstable.f.Ft), 2, dec)),
    done: ex.done(fmt(info.neutral.b.x * 100, 0, dec).replace('-', '')),
  }[settled];
  const tone = { idle: '#22d3ee', push: '#fb923c', run: '#fb923c', paused: '#fbbf24', done: '#34d399' }[settled];

  const ftText = (kd) => {
    const it = info[kd];
    const val = fmt(Math.abs(it.f.Ft), 2, dec);
    if (it.toward === 0) return L.readouts.ftZero;
    return it.toward > 0 ? L.readouts.ftBack(val) : L.readouts.ftAway(val);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Btn icon={ArrowLeft} onClick={() => nudge(-1)} className="min-h-[52px] text-[15px] sm:min-w-[170px]">
            {L.pushLeft}
          </Btn>
          <Btn variant="primary" icon={ArrowRight} onClick={() => nudge(1)} className="min-h-[52px] text-[15px] sm:min-w-[170px]">
            {L.pushRight}
          </Btn>
          <Btn icon={paused ? Play : Pause} onClick={() => setPaused((x) => !x)} disabled={!sim.running} aria-pressed={paused} className="min-h-[52px] text-[15px]">
            {paused ? T.common.resume : T.common.pause}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!anyMoved} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
        <div className="xl:w-[300px]">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{L.speedLabel}</p>
          <Segmented
            label={L.speedLabel}
            className="grid-cols-2"
            value={slow}
            onChange={setSlow}
            options={[
              { value: 1, label: L.speeds.real, sub: '×1' },
              { value: 0.25, label: L.speeds.slow, sub: '×¼' },
            ]}
          />
        </div>
      </div>

      <KindsScene T={T} info={info} slow={slow} t={sim.t} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {KINDS.map((kd) => (
          <Readout
            key={kd}
            label={L.kinds[kd].name}
            symbol="Δh"
            value={num(info[kd].dh, 1, dec)}
            unit={T.cm}
            accent={KIND_COL[kd].line}
            textColor={KIND_COL[kd].text}
            active={info[kd].state === 'back' || info[kd].state === 'gone' || info[kd].state === 'newPlace'}
            sub={
              <>
                <span className="block font-semibold" style={{ color: KIND_COL[kd].text }}>
                  {L.states[info[kd].state]}
                </span>
                <Sym>{ftText(kd)}</Sym>
              </>
            }
          />
        ))}
        <Readout label={L.readouts.t} symbol="t" value={fmt(sim.t, 1, dec)} unit={T.s} accent="#22d3ee" textColor="#a5f3fc" sub={slow < 1 ? L.readouts.tSlow : L.readouts.tReal} active={sim.running && !paused} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="eq-v0" label={L.v0} symbol="v₀" min={0.2} max={1} step={0.1} value={v0} onChange={setV0} accent={COL.Ft} display={`${fmt(v0, 1, dec)} ${T.ms}`} hint={L.v0Hint} />
          <InfoBox
            title={L.info.title}
            items={KINDS.map((kd) => [L.kinds[kd].short, L.info[kd], KIND_COL[kd].text])}
          >
            <p className="mt-2 text-[11px] leading-snug text-gray-500">{L.info.note}</p>
          </InfoBox>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={L.graph.title}
            series={KINDS.map((kd, i) => ({ id: kd, label: L.kinds[kd].short, color: KIND_COL[kd].series, points: sim.samples.map((p) => ({ x: p.x, y: p.b[i] })) }))}
            xMax={T_GRAPH}
            yMin={-0.8}
            yMax={0.8}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={sim.t > 0 && sim.t <= T_GRAPH ? sim.t : undefined}
            decimal={dec}
            yDigits={1}
            height={260}
            ariaLabel={L.graph.label}
            note={L.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function layout(W, narrow) {
  const top = narrow ? 34 : 50;
  const cap = narrow ? 30 : 36;
  if (!narrow) {
    const gap = 12;
    const cw = (W - 2 * 10 - 2 * gap) / 3;
    const sub = clamp(cw * 0.64, 170, 250);
    return { narrow, top, cap, cw, rowH: sub + cap, H: top + sub + cap + 6, cell: (i) => ({ x: 10 + i * (cw + gap), y: top, w: cw, h: sub }) };
  }
  const rowH = clamp(W * 0.5 + cap, 190, 280);
  return { narrow, top, cap, cw: W, rowH, H: top + 3 * rowH + 4, cell: (i) => ({ x: 4, y: top + i * rowH, w: W - 8, h: rowH - cap }) };
}

function KindsScene({ T, info, slow, t }) {
  const L = T.kinds;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: COL.mg, label: L.legend.mg, kind: 'arrow' },
        { color: COL.N, label: L.legend.N, kind: 'arrow' },
        { color: COL.Ft, label: L.legend.Ft, kind: 'dash' },
      ]}
      chips={
        <Chip icon={Timer} color="#0891b2">
          {slow < 1 ? L.chipSlow : L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => layout(W, narrow).H}
      ariaLabel={L.sceneLabel(...KINDS.map((kd) => L.states[info[kd].state]))}
    >
      {(W, H, narrow) => {
        const lay = layout(W, narrow);
        return KINDS.map((kd, i) => <KindPanel key={kd} T={T} kind={kd} it={info[kd]} cell={lay.cell(i)} cap={lay.cap} narrow={narrow} />);
      }}
    </LabScene>
  );
}

function KindPanel({ T, kind, it, cell, cap, narrow }) {
  const L = T.kinds;
  const sf = SURF[kind];
  const view = makeView(BOX, cell.w, cell.h, { l: 4, r: 4, t: 4, b: 4 });
  const X = (x) => cell.x + view.sx(x);
  const Y = (y) => cell.y + view.sy(y);
  const { k } = view;
  const fs = narrow ? 10.5 : 12;
  const box = { w: cell.x + cell.w, h: cell.y + cell.h + cap };
  const kF = (ARROW_M * k) / (BALL_M * G);

  /* the surface, exactly across the cell (no clip path: it keeps full-page captures and old engines happy) */
  const xa = view.wx(0);
  const xb = view.wx(cell.w);
  const pts = [];
  for (let i = 0; i <= 120; i += 1) {
    const x = xa + ((xb - xa) * i) / 120;
    pts.push(`${X(x).toFixed(1)},${Y(sf.f(x)).toFixed(1)}`);
  }
  const bottom = cell.y + cell.h;
  const solid = `${cell.x},${bottom} ${pts.join(' ')} ${cell.x + cell.w},${bottom}`;
  const grid = [];
  for (let gx = Math.ceil(xa / 0.1) * 0.1; gx <= xb + 1e-9; gx += 0.1) grid.push(<line key={`x${gx.toFixed(2)}`} x1={X(gx)} x2={X(gx)} y1={cell.y} y2={bottom} stroke="#e8edf3" />);
  for (let gy = Math.ceil(view.wy(cell.h) / 0.1) * 0.1; gy <= view.wy(0) + 1e-9; gy += 0.1) grid.push(<line key={`y${gy.toFixed(2)}`} x1={cell.x} x2={cell.x + cell.w} y1={Y(gy)} y2={Y(gy)} stroke="#e8edf3" />);

  /* the ball */
  const { b, f } = it;
  const c = { x: X(b.x - BALL_R * f.sb), y: Y(sf.f(b.x) + BALL_R * f.cb) };
  const rb = BALL_R * k;
  const spin = -b.s / BALL_R;
  const tang = { x: f.cb, y: f.sb }; // along the surface, to +x (world)
  const nrm = { x: -f.sb, y: f.cb };
  const ghost = { x: X(0), y: Y(sf.y0 + BALL_R) };
  const col = KIND_COL[kind];

  return (
    <g>
      <g>
        <rect x={cell.x} y={cell.y} width={cell.w} height={cell.h + cap} rx={8} fill="#fbfcfe" />
        <g aria-hidden="true">{grid}</g>
        <polygon points={solid} fill={kind === 'neutral' ? '#efe2cd' : '#e2e8f0'} />
        <polyline points={pts.join(' ')} fill="none" stroke={kind === 'neutral' ? '#b08d5b' : '#475569'} strokeWidth="2.5" />
        {kind !== 'stable' &&
          [-1, 1].map((s) => <rect key={s} x={X(s * (X_WALL + BALL_R + 0.012)) - 0.012 * k} y={Y(0.1)} width={0.024 * k} height={0.1 * k} rx={2} fill="#94a3b8" stroke="#475569" />)}

        {/* where the ball was in equilibrium */}
        <line x1={X(0)} x2={X(0)} y1={Y(sf.y0) + 4} y2={Y(sf.y0) + 12} stroke="#0f172a" strokeWidth="1.5" />
        {b.moved && <circle cx={ghost.x} cy={ghost.y} r={rb} fill="none" stroke={col.line} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8" />}

        {/* the ball */}
        <circle cx={c.x} cy={c.y} r={rb} fill={col.line} stroke="#0f172a" strokeWidth="1.5" />
        <circle cx={c.x - rb * 0.3} cy={c.y - rb * 0.3} r={rb * 0.32} fill="#fff" opacity="0.35" />
        <line x1={c.x - rb * Math.cos(spin)} y1={c.y + rb * Math.sin(spin)} x2={c.x + rb * Math.cos(spin)} y2={c.y - rb * Math.sin(spin)} stroke="#fff" strokeWidth="1.6" opacity="0.8" />

        {/* forces */}
        <ForceArrow x={c.x} y={c.y} dx={0} dy={f.mg * kF} color={COL.mg} label="mg" fs={fs} box={box} width={2.6} head={9} labelAt={{ x: c.x + 7, y: c.y + f.mg * kF + 2, anchor: 'start' }} />
        <ForceArrow x={c.x} y={c.y} dx={nrm.x * f.N * kF} dy={-nrm.y * f.N * kF} color={COL.N} label="N" fs={fs} box={box} width={2.6} head={9} />
        {Math.abs(f.Ft) * kF > 3 && (
          <ForceArrow
            x={c.x}
            y={c.y}
            dx={tang.x * f.Ft * kF}
            dy={-tang.y * f.Ft * kF}
            color={COL.Ft}
            label="mg·sinβ"
            fs={fs - 1}
            box={box}
            width={2.4}
            head={9}
            dash="5 3"
            labelAt={{ x: c.x + tang.x * f.Ft * kF + Math.sign(f.Ft) * 6, y: c.y - tang.y * f.Ft * kF - 9, anchor: f.Ft > 0 ? 'start' : 'end' }}
          />
        )}
        <circle cx={c.x} cy={c.y} r={2} fill="#0f172a" />
      </g>

      {/* caption */}
      <path
        d={`M${cell.x},${cell.y + cell.h} H${cell.x + cell.w} V${cell.y + cell.h + cap - 8} Q${cell.x + cell.w},${cell.y + cell.h + cap} ${cell.x + cell.w - 8},${cell.y + cell.h + cap} H${cell.x + 8} Q${cell.x},${cell.y + cell.h + cap} ${cell.x},${cell.y + cell.h + cap - 8} Z`}
        fill="#f8fafc"
      />
      <line x1={cell.x} x2={cell.x + cell.w} y1={cell.y + cell.h} y2={cell.y + cell.h} stroke="#e2e8f0" />
      <circle cx={cell.x + 14} cy={cell.y + cell.h + cap / 2} r={5} fill={col.line} />
      <text x={cell.x + 25} y={cell.y + cell.h + cap / 2 + fs * 0.36} fontSize={fs} fontWeight="700" fill="#0f172a">
        {L.kinds[kind].name}
        <tspan fontWeight="500" fill="#64748b">{` · ${L.kinds[kind].where}`}</tspan>
      </text>
      <rect x={cell.x + 0.5} y={cell.y + 0.5} width={cell.w - 1} height={cell.h + cap - 1} rx={8} fill="none" stroke="#cbd5e1" />
      {!narrow && it.dh !== 0 && Math.abs(it.dh) > 0.05 && (
        <SvgSym x={cell.x + cell.w - 10} y={cell.y + 18} text="Δh" value={`${num(it.dh, 1, T.decimal)} ${T.cm}`} color={col.line} fs={fs} anchor="end" />
      )}
    </g>
  );
}
