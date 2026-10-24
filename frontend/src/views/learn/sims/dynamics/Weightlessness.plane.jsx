import { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';

import { Explain, RangeField, Readout, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import { C, Chip, G, Label, LabScene, PlayControls, Person } from './Weightlessness.parts';

/**
 * Tab 4 — the "zero-g" aircraft. Level flight (n = 1) → a pull-up along an arc
 * at constant speed (overload n ≈ 1.8) → engines only cancel the drag, so the
 * aircraft flies the parabola of a thrown stone: a = g, everyone inside is
 * weightless (n = 0) for t = 2v·sinθ/g ≈ 22 s → pull-out arc (n ≈ 1.8) →
 * level flight. n = |a − g|/g = P/(mg) is computed from the real kinematics.
 */

const V = 150; // m/s (540 km/h) at the start of the parabola
const N_PULL = 1.8; // load factor at the bottom of the arcs
const R_ARC = (V * V) / ((N_PULL - 1) * G); // m — arc radius giving n = 1.8 in level flight
const ALT0 = 6000; // m
const T_LEVEL = 8; // s of level flight before and after
const SPEED = 4; // screen time ×4
const M_PAX = 70; // kg
const PHASES = ['level', 'pullup', 'parabola', 'pullout'];

/** The whole manoeuvre for entry angle th (rad): phase table and a sampler. */
function buildFlight(th) {
  const tArc = (R_ARC * th) / V;
  const tPar = (2 * V * Math.sin(th)) / G;
  const t1 = T_LEVEL;
  const t2 = t1 + tArc;
  const t3 = t2 + tPar;
  const t4 = t3 + tArc;
  const tEnd = t4 + T_LEVEL;
  const x1 = V * T_LEVEL;
  const p2 = { x: x1 + R_ARC * Math.sin(th), y: ALT0 + R_ARC * (1 - Math.cos(th)) };
  const p3 = { x: p2.x + V * Math.cos(th) * tPar, y: p2.y };
  const c3 = { x: p3.x + R_ARC * Math.sin(th), y: p3.y + R_ARC * Math.cos(th) };
  const p4 = { x: p3.x + R_ARC * Math.sin(th), y: ALT0 };
  const ac = (V * V) / R_ARC;
  const nArc = (gam) => Math.sqrt(ac * ac + 2 * ac * G * Math.cos(gam) + G * G) / G;

  const at = (t) => {
    if (t <= t1) return { x: V * t, y: ALT0, vx: V, vy: 0, ax: 0, ay: 0, n: 1, phase: 'level' };
    if (t <= t2) {
      const gam = (V * (t - t1)) / R_ARC;
      return {
        x: x1 + R_ARC * Math.sin(gam),
        y: ALT0 + R_ARC * (1 - Math.cos(gam)),
        vx: V * Math.cos(gam),
        vy: V * Math.sin(gam),
        ax: -ac * Math.sin(gam),
        ay: ac * Math.cos(gam),
        n: nArc(gam),
        phase: 'pullup',
      };
    }
    if (t <= t3) {
      const u = t - t2;
      return {
        x: p2.x + V * Math.cos(th) * u,
        y: p2.y + V * Math.sin(th) * u - 0.5 * G * u * u,
        vx: V * Math.cos(th),
        vy: V * Math.sin(th) - G * u,
        ax: 0,
        ay: -G,
        n: 0,
        phase: 'parabola',
      };
    }
    if (t <= t4) {
      const gam = -th + (V * (t - t3)) / R_ARC;
      return {
        x: c3.x + R_ARC * Math.sin(gam),
        y: c3.y - R_ARC * Math.cos(gam),
        vx: V * Math.cos(gam),
        vy: V * Math.sin(gam),
        ax: -ac * Math.sin(gam),
        ay: ac * Math.cos(gam),
        n: nArc(gam),
        phase: 'pullout',
      };
    }
    const u = Math.min(t, tEnd) - t4;
    return { x: p4.x + V * u, y: ALT0, vx: V, vy: 0, ax: 0, ay: 0, n: 1, phase: 'level' };
  };

  const samples = [];
  for (let i = 0; i <= 400; i += 1) samples.push({ t: (tEnd * i) / 400, ...at((tEnd * i) / 400) });
  const peak = p2.y + (V * Math.sin(th)) ** 2 / (2 * G);
  return { th, tArc, tPar, t1, t2, t3, t4, tEnd, at, samples, peak, xEnd: p4.x + V * T_LEVEL, nTop: nArc(th) };
}

const IDLE = { t: 0, running: false, done: false };

export default function PlaneSim({ T }) {
  const L = T.plane;
  const dec = T.decimal;
  const [deg, setDeg] = useState(45);
  const [sim, setSim] = useState(IDLE);
  const fl = useMemo(() => buildFlight((deg * Math.PI) / 180), [deg]);
  const started = sim.running || sim.t > 0;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(fl.tEnd, p.t + dt * SPEED);
      const done = t >= fl.tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const s = fl.at(sim.t);
  const zeroG = Math.min(Math.max(sim.t - fl.t2, 0), fl.tPar);
  const F1 = (n) => fmt(n, 1, dec);
  const phase = started ? s.phase : 'idle';
  const phaseIdx = sim.t <= fl.t1 ? 0 : sim.t <= fl.t2 ? 1 : sim.t <= fl.t3 ? 2 : sim.t <= fl.t4 ? 3 : 0;

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (started) key = s.phase === 'level' && sim.t > fl.t4 ? 'level2' : s.phase;
  const settled = useSettled(key, 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(fmt(ALT0 / 1000, 0, dec), fmt(V * 3.6, 0, dec)),
    level: ex.level,
    pullup: ex.pullup(F1(N_PULL)),
    parabola: ex.parabola(F1(fl.tPar)),
    pullout: ex.pullout(F1(N_PULL)),
    level2: ex.level,
    done: ex.done(F1(fl.tPar)),
  }[settled];
  const tone = { idle: '#22d3ee', level: '#94a3b8', level2: '#94a3b8', pullup: '#fb923c', parabola: '#f472b6', pullout: '#fb923c', done: '#34d399' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{L.phasesLabel}</p>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label={L.phasesLabel}>
            {PHASES.map((ph, i) => {
              const on = started && !sim.done && phaseIdx === i;
              const col = ph === 'parabola' ? '#f472b6' : ph === 'level' ? '#94a3b8' : '#fb923c';
              return (
                <li
                  key={ph}
                  aria-current={on ? 'step' : undefined}
                  className={`min-h-10 rounded-xl border px-3 py-1.5 transition-colors ${on ? 'text-white' : 'border-white/10 bg-white/[0.035] text-gray-300'}`}
                  style={on ? { borderColor: `${col}99`, background: `${col}1f` } : undefined}
                >
                  <span className="block text-sm font-semibold leading-tight">
                    <span className="mr-1.5 tabular-nums" style={{ color: col }}>
                      {i + 1}.
                    </span>
                    {L.phases[ph].name}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-gray-400 tabular-nums">{L.phases[ph].sub(F1(fl.nTop))}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <PlaneScene T={T} fl={fl} t={sim.t} s={s} started={started} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.phase}
          accent={phase === 'parabola' ? '#f472b6' : phase === 'pullup' || phase === 'pullout' ? '#fb923c' : '#94a3b8'}
          value={<span className="text-[20px] sm:text-[24px]">{started ? L.phases[s.phase].name : L.readouts.ready}</span>}
          sub={L.readouts.phaseSub(fmt(sim.t, 1, dec), fmt(fl.tEnd, 1, dec))}
        />
        <Readout label={L.readouts.n} symbol="n" value={fmt(started ? s.n : 1, 2, dec)} accent={C.P} textColor={C.PText} active={started && s.n < 0.01} sub={L.readouts.nSub} />
        <Readout
          label={L.readouts.P(M_PAX)}
          symbol="P"
          value={fmt((started ? s.n : 1) * M_PAX * G, 0, dec)}
          unit={T.common.N}
          accent={C.P}
          textColor={C.PText}
          sub={L.readouts.Psub(fmt(M_PAX * G, 0, dec))}
        />
        <Readout label={L.readouts.zero} symbol="t₀" value={F1(zeroG)} unit={T.s} accent={C.time} textColor="#a5f3fc" sub={L.readouts.zeroSub(F1(fl.tPar))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-pink-400" style={{ width: `${(zeroG / fl.tPar) * 100}%` }} />
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wl-plane-th"
            label={L.thSlider}
            symbol="θ"
            min={30}
            max={60}
            step={5}
            value={deg}
            onChange={(n) => {
              setDeg(n);
              setSim(IDLE);
            }}
            accent="#f472b6"
            display={`${deg}°`}
            hint={L.thHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-relaxed">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.formulaTitle}</p>
            <p className="mt-1 tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">t = 2v·sinθ / g</span> = 2 · {fmt(V, 0, dec)} · sin {deg}° / {F1(G)} ={' '}
              <b className="text-pink-300">{F1(fl.tPar)}</b> {T.s}
            </p>
            <p className="tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">Δh = (v·sinθ)² / 2g</span> = <b className="text-gray-100">{fmt(fl.peak - fl.at(fl.t2).y, 0, dec)}</b> {T.m}
            </p>
            <p className="tabular-nums text-gray-300">{L.arcNote(fmt(R_ARC / 1000, 2, dec), F1(N_PULL))}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: 'rgba(148,163,184,0.55)', dash: '5 5', dot: false, points: fl.samples.map((q) => ({ x: q.t, y: q.n })) },
              {
                id: 'n',
                label: L.graph.n,
                color: '#c084fc',
                points: started ? fl.samples.filter((q) => q.t <= sim.t).map((q) => ({ x: q.t, y: q.n })).concat([{ x: sim.t, y: s.n }]) : [],
              },
            ]}
            xMax={Math.ceil(fl.tEnd / 20) * 20}
            yMax={2}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={sim.t}
            yDigits={1}
            decimal={dec}
            note={L.graph.note}
            ariaLabel={L.graph.label}
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- scene */

function PlaneIcon({ x, y, angle, s = 1 }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${s})`}>
      <path d="M-26,-3 Q-28,0 -26,3 L18,4 Q27,3 28,0 Q27,-3 18,-4 Z" fill="#f8fafc" stroke="#334155" strokeWidth={1.3} />
      <path d="M-22,-3 L-27,-14 L-20,-14 L-12,-3 Z" fill="#db2777" stroke="#334155" strokeWidth={1} />
      <path d="M-4,1 L-12,10 L-6,10 L8,1 Z" fill="#cbd5e1" stroke="#334155" strokeWidth={1} />
      {[-14, -8, -2, 4, 10].map((px) => (
        <circle key={px} cx={px} cy={-1} r={1.1} fill="#38bdf8" />
      ))}
      <path d="M20,-3 Q25,-2.5 26,-0.5 L20,-0.5 Z" fill="#38bdf8" />
    </g>
  );
}

const PHASE_COL = { level: '#94a3b8', pullup: '#ea580c', parabola: '#db2777', pullout: '#ea580c' };

function PlaneScene({ T, fl, t, s, started, running }) {
  const L = T.plane;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: PHASE_COL.parabola, label: L.legend.zero, kind: 'line' },
        { color: PHASE_COL.pullup, label: L.legend.over, kind: 'line' },
        { color: C.vel, label: L.legend.v, kind: 'arrow' },
        { color: C.acc, label: L.legend.a, kind: 'arrow' },
      ]}
      chips={<Chip>{L.speedChip(SPEED)} · t = {fmt(t, 1, dec)} {T.s}</Chip>}
      height={(W, narrow) => (narrow ? 470 : 430)}
      ariaLabel={L.sceneLabel(fmt(s.y, 0, dec), fmt(s.n, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const top = narrow ? 48 : 62;
        const profH = narrow ? 270 : H;
        const pad = { l: narrow ? 34 : 50, r: narrow ? 14 : 24, t: top, b: 28 };
        const x0 = -400;
        const x1 = fl.xEnd + 400;
        const y0 = ALT0 - 180;
        const y1 = fl.peak + (narrow ? 380 : 160);
        const kx = (W - pad.l - pad.r) / (x1 - x0);
        const ky = Math.max(kx, (profH - pad.t - pad.b) / (y1 - y0));
        const stretch = ky / kx;
        const sx = (x) => pad.l + (x - x0) * kx;
        const sy = (y) => profH - pad.b - (y - y0) * ky;

        const plan = fl.samples.map((q) => `${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ');
        // flown trail, split by phase colour
        const runs = [];
        if (started) {
          let cur = null;
          for (const q of fl.samples) {
            if (q.t > t) break;
            if (!cur || cur.phase !== q.phase) {
              cur = { phase: q.phase, pts: cur ? [cur.pts[cur.pts.length - 1]] : [] };
              runs.push(cur);
            }
            cur.pts.push(`${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`);
          }
          if (cur) cur.pts.push(`${sx(s.x).toFixed(1)},${sy(s.y).toFixed(1)}`);
        }
        const px = sx(s.x);
        const py = sy(s.y);
        // screen-space directions follow the drawn (possibly stretched) path
        const vsx = s.vx * kx;
        const vsy = -s.vy * ky;
        const vl = Math.hypot(vsx, vsy);
        const angle = (Math.atan2(vsy, vsx) * 180) / Math.PI;
        const vLen = (Math.hypot(s.vx, s.vy) / V) * (narrow ? 58 : 84);
        const aMag = Math.hypot(s.ax, s.ay);
        const asx = s.ax * kx;
        const asy = -s.ay * ky;
        const al = Math.hypot(asx, asy) || 1;
        const aLen = aMag * (narrow ? 3.6 : 4.6);

        /* the altitude axis */
        const ticks = [];
        for (let a = Math.ceil(y0 / 500) * 500; a <= y1; a += 500) ticks.push(a);
        const xt = [];
        for (let x = 0; x <= x1; x += 2000) xt.push(x);

        /* inset: the cabin seen from behind */
        const ins = narrow ? { x: 10, y: profH + 6, w: W - 20, h: H - profH - 16 } : { x: pad.l + 8, y: top + 6, w: Math.min(300, W * 0.26), h: 150 };
        const fr = Math.min(ins.h * 0.42, ins.w * 0.22);
        const fcx = ins.x + fr + 16;
        const fcy = ins.y + ins.h / 2 + 8;
        const n = started ? s.n : 1;
        const pose = n < 0.05 ? 'float' : n > 1.3 ? 'pressed' : 'stand';
        const floorY = fcy + fr * 0.55;
        const bob = n < 0.05 ? Math.sin(t * 0.9) * fr * 0.08 : 0;
        const meter = { x: fcx + fr + 22, y: ins.y + ins.h - 34, w: ins.x + ins.w - (fcx + fr + 22) - 14 };

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* grid */}
            <g aria-hidden="true">
              {ticks.map((a) => (
                <g key={`ya${a}`}>
                  <line x1={pad.l} x2={W - pad.r} y1={sy(a)} y2={sy(a)} stroke="#e2e8f0" />
                  <text x={6} y={sy(a) + 4} fontSize={fs - 1} fill={C.muted}>
                    {fmt(a / 1000, 1, dec)}
                  </text>
                </g>
              ))}
              {xt.map((x) => (
                <g key={`xa${x}`}>
                  <line x1={sx(x)} x2={sx(x)} y1={pad.t - 6} y2={profH - pad.b} stroke="#eef2f7" />
                  <text x={sx(x)} y={profH - 10} fontSize={fs - 1} fill={C.muted} textAnchor="middle">
                    {fmt(x / 1000, 0, dec)}
                  </text>
                </g>
              ))}
              <text x={6} y={pad.t - 10} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {L.axisY}
              </text>
              <text x={W - 8} y={profH - 10} fontSize={fs - 1} fontWeight="700" fill="#475569" textAnchor="end">
                {L.axisX}
              </text>
            </g>
            {/* planned profile and the flown trail */}
            <polyline points={plan} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 6" />
            {runs.map((r, i) =>
              r.pts.length > 1 ? (
                <polyline key={i} points={r.pts.join(' ')} fill="none" stroke={PHASE_COL[r.phase]} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              ) : null,
            )}
            {/* the parabola's duration bracket */}
            {(() => {
              const a = fl.at(fl.t2);
              const b = fl.at(fl.t3);
              const yb = sy(fl.peak) - 16;
              return (
                <g>
                  <line x1={sx(a.x)} x2={sx(b.x)} y1={yb} y2={yb} stroke="#db2777" strokeWidth={1.2} />
                  <line x1={sx(a.x)} x2={sx(a.x)} y1={yb - 4} y2={yb + 4} stroke="#db2777" strokeWidth={1.2} />
                  <line x1={sx(b.x)} x2={sx(b.x)} y1={yb - 4} y2={yb + 4} stroke="#db2777" strokeWidth={1.2} />
                  <Label x={(sx(a.x) + sx(b.x)) / 2} y={yb - 6} size={fs - 1} color="#be185d">
                    {L.zeroTag(fmt(fl.tPar, 1, dec))}
                  </Label>
                </g>
              );
            })()}
            {/* vectors and the aircraft */}
            {started && aMag > 0.01 && (
              <g>
                <line x1={px} y1={py} x2={px + (asx / al) * (aLen - 9)} y2={py + (asy / al) * (aLen - 9)} stroke={C.acc} strokeWidth={3} strokeLinecap="round" />
                <path
                  d={`M${px + (asx / al) * aLen},${py + (asy / al) * aLen} L${px + (asx / al) * (aLen - 10) - (asy / al) * 5},${py + (asy / al) * (aLen - 10) + (asx / al) * 5} L${px + (asx / al) * (aLen - 10) + (asy / al) * 5},${py + (asy / al) * (aLen - 10) - (asx / al) * 5} Z`}
                  fill={C.acc}
                />
                <Label x={px + (asx / al) * (aLen + 12)} y={py + (asy / al) * (aLen + 12) + 4} size={fs} color={C.acc} italic>
                  {s.phase === 'parabola' ? L.tags.ag : 'a'}
                </Label>
              </g>
            )}
            <line x1={px} y1={py} x2={px + (vsx / vl) * (vLen - 9)} y2={py + (vsy / vl) * (vLen - 9)} stroke={C.vel} strokeWidth={3} strokeLinecap="round" />
            <path
              d={`M${px + (vsx / vl) * vLen},${py + (vsy / vl) * vLen} L${px + (vsx / vl) * (vLen - 10) - (vsy / vl) * 5},${py + (vsy / vl) * (vLen - 10) + (vsx / vl) * 5} L${px + (vsx / vl) * (vLen - 10) + (vsy / vl) * 5},${py + (vsy / vl) * (vLen - 10) - (vsx / vl) * 5} Z`}
              fill={C.vel}
            />
            <PlaneIcon x={px} y={py} angle={angle} s={narrow ? 0.8 : 1} />
            {running && <circle cx={px} cy={py} r={12} fill={PHASE_COL[s.phase]} className="cl-pulse" opacity="0.2" />}
            <Label x={px} y={py + (narrow ? 26 : 30)} size={fs - 1} color="#334155" weight={600}>
              {L.tags.alt(fmt(s.y / 1000, 2, dec), fmt(Math.hypot(s.vx, s.vy) * 3.6, 0, dec))}
            </Label>
            {stretch > 1.05 && (
              <text x={W - pad.r} y={profH - pad.b - 6} textAnchor="end" fontSize={fs - 1} fill="#94a3b8">
                {L.stretch(fmt(stretch, 1, dec))}
              </text>
            )}

            {/* ================= inset */}
            <rect x={ins.x} y={ins.y} width={ins.w} height={ins.h} rx={14} fill="#f8fafc" stroke="#cbd5e1" />
            <text x={ins.x + 12} y={ins.y + 18} fontSize={fs - 1} fontWeight="700" fill="#334155">
              {L.insideTag}
            </text>
            <defs>
              <clipPath id="wl-plane-cab">
                <circle cx={fcx} cy={fcy} r={fr - 3} />
              </clipPath>
            </defs>
            <circle cx={fcx} cy={fcy} r={fr} fill="#e2e8f0" stroke="#64748b" strokeWidth={3} />
            <g clipPath="url(#wl-plane-cab)">
              <rect x={fcx - fr} y={floorY} width={2 * fr} height={fr} fill="#94a3b8" />
              <Person
                x={fcx - fr * 0.18}
                y={n < 0.05 ? floorY - fr * 0.22 + bob : floorY}
                h={fr * 1.15}
                pose={pose}
                grounded={n >= 0.05}
                facing={1}
                shirt="#2563eb"
                rotate={n < 0.05 ? -20 + Math.sin(t * 0.6) * 8 : 0}
              />
              <circle cx={fcx + fr * 0.45} cy={n < 0.05 ? fcy - fr * 0.2 - bob : floorY - 5} r={5} fill="#f59e0b" stroke="#b45309" />
            </g>
            {/* n gauge */}
            <text x={meter.x} y={ins.y + 40} fontSize={fs} fontWeight="700" fill={n < 0.05 ? '#be185d' : n > 1.3 ? '#c2410c' : '#334155'}>
              {n < 0.05 ? L.state.zero : n > 1.3 ? L.state.over : L.state.normal}
            </text>
            <text x={meter.x} y={ins.y + 58} fontSize={fs - 1} fill="#475569">
              {L.state.formula(fmt(n, 2, dec))}
            </text>
            <g>
              <rect x={meter.x} y={meter.y} width={meter.w} height={8} rx={4} fill="#e2e8f0" />
              <rect x={meter.x} y={meter.y} width={Math.max(0, Math.min(1, n / 2)) * meter.w} height={8} rx={4} fill={n < 0.05 ? '#db2777' : n > 1.3 ? '#ea580c' : '#9333ea'} />
              {[0, 1, 2].map((v) => (
                <g key={v}>
                  <line x1={meter.x + (v / 2) * meter.w} x2={meter.x + (v / 2) * meter.w} y1={meter.y - 3} y2={meter.y + 11} stroke="#64748b" />
                  <text x={meter.x + (v / 2) * meter.w} y={meter.y + 24} fontSize={fs - 2} fill="#64748b" textAnchor="middle">
                    {v}
                  </text>
                </g>
              ))}
            </g>
          </>
        );
      }}
    </LabScene>
  );
}


