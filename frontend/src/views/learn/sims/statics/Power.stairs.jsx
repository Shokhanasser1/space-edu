import { useState } from 'react';
import { Footprints, Lightbulb, Scale, Timer, Zap } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Chip, Climber, Formula, G, GroupLabel, HP, LabScene, LiveGraph, PC, PaperGrid, PlayControls, niceAxis, pickTimeScale, smart, whole } from './Power.parts';

/**
 * Tab 1 — the stairs race. Two pupils climb the same height h (whole
 * storeys of 3 m) in times t₁ and t₂. Lifting their bodies takes the work
 * A = mgh; the power is the work done per second, N = A/t. The climb is
 * taken as uniform, so the work grows linearly, A(t) = N·t, and the slope of
 * the A–t line is the power.
 *
 * Preset (the lesson's example): m = 60 kg, h = 6 m (2 storeys),
 * t₁ = 10 s → A = 60·9.8·6 = 3528 J, N₁ = 352.8 W ≈ 353 W (≈ 0.48 hp);
 * running it in t₂ = 5 s → the same 3528 J but N₂ = 705.6 W.
 */

const FLOOR_H = 3;
const HALF = 1.5; // one flight rises half a storey
const RUN = 2.4; // horizontal run of a flight: 8 treads × 0.3 m
const LAND = 0.75; // landing depth
const TW = RUN + 2 * LAND; // inner width of the stairwell, 3.9 m
const RISER = HALF / 9; // 9 risers of 1/6 m
const TREAD = RUN / 8;
const GAP = 1.7; // between the two stairwells
const PERSON_H = 1.7;
const SLOPE = HALF / RUN;
const IDLE = { t: 0, running: false, done: false };

const PRESETS = [
  { id: 'walkRun', icon: Footprints, floors: 2, m1: 60, t1: 10, m2: 60, t2: 5 },
  { id: 'heavyLight', icon: Scale, floors: 2, m1: 80, t1: 12, m2: 40, t2: 12 },
  { id: 'samePower', icon: Zap, floors: 2, m1: 60, t1: 10, m2: 30, t2: 5 },
];

/** Where a climber who has risen y metres stands on the zigzag of flights. */
function stairPos(y, h) {
  if (y >= h - 1e-9) return { x: LAND * 0.45, dir: 1, onStairs: false };
  const j = Math.floor(y / HALF + 1e-9);
  const f = (y - j * HALF) / HALF;
  return j % 2 === 0 ? { x: LAND + RUN * f, dir: 1, onStairs: true } : { x: LAND + RUN * (1 - f), dir: -1, onStairs: true };
}

/** "walk" / "run"… from the vertical speed of the climb. */
function paceOf(v) {
  if (v < 0.35) return 'slow';
  if (v < 0.8) return 'walk';
  if (v < 1.6) return 'run';
  return 'sprint';
}

export default function StairsSim({ T }) {
  const S = T.stairs;
  const dec = T.decimal;
  const [preset, setPreset] = useState('walkRun');
  const [floors, setFloors] = useState(2);
  const [m1, setM1] = useState(60);
  const [t1, setT1] = useState(10);
  const [m2, setM2] = useState(60);
  const [t2, setT2] = useState(5);
  const [sim, setSim] = useState(IDLE);

  const h = floors * FLOOR_H;
  const A1 = m1 * G * h;
  const A2 = m2 * G * h;
  const N1 = A1 / t1;
  const N2 = A2 / t2;
  const tEnd = Math.max(t1, t2);
  const k = pickTimeScale(tEnd, 15);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt * k);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setFloors(p.floors);
    setM1(p.m1);
    setT1(p.t1);
    setM2(p.m2);
    setT2(p.t2);
    setSim(IDLE);
  };
  const change = (setter) => (v) => {
    setter(v);
    setPreset(null);
    setSim(IDLE);
  };

  const t = sim.t;
  const started = t > 0 || sim.running;
  const f1 = Math.min(1, t / t1);
  const f2 = Math.min(1, t / t2);
  const a1 = A1 * f1;
  const a2 = A2 * f2;
  const names = S.names;

  /* ---- explanation */
  const sameA = Math.abs(A1 - A2) < 0.5;
  const sameT = Math.abs(t1 - t2) < 1e-6;
  const sameN = Math.abs(N1 - N2) < 0.05;
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (started) key = t < Math.min(t1, t2) - 1e-9 ? 'climb' : 'first';
  const settled = useSettled(key, key === 'idle' || key === 'done' ? 0 : 150);
  const W = (n) => `${smart(n, dec)} ${T.W}`;
  const J = (n) => whole(n, dec);
  const sec = (n) => smart(n, dec);
  const big = N1 >= N2 ? 0 : 1;
  const fast = t1 <= t2 ? 0 : 1;
  const heavy = A1 >= A2 ? 0 : 1;
  const Ns = [N1, N2];
  const As = [A1, A2];
  const ts = [t1, t2];
  const vals = {
    h: sec(h),
    n1: names[0],
    n2: names[1],
    N: W(N1),
    Nj: smart(N1, dec),
    big: names[big],
    small: names[1 - big],
    Nbig: smart(Ns[big], dec),
    Nsmall: smart(Ns[1 - big], dec),
    Wbig: W(Ns[big]),
    Wsmall: W(Ns[1 - big]),
    first: names[fast],
    other: names[1 - fast],
    tFirst: sec(ts[fast]),
    Afirst: J(As[fast]),
    A: J(A1),
    fast: names[fast],
    slow: names[1 - fast],
    tf: sec(ts[fast]),
    ts: sec(ts[1 - fast]),
    Wfast: W(Ns[fast]),
    Wslow: W(Ns[1 - fast]),
    t: sec(t1),
    heavy: names[heavy],
    Ah: J(As[heavy]),
    Al: J(As[1 - heavy]),
    Wh: W(Ns[heavy]),
    Wl: W(Ns[1 - heavy]),
    ratio: smart(Ns[big] / Math.max(Ns[1 - big], 1e-9), dec, 2),
  };
  const rel = sameN ? 'sameN' : sameA ? 'sameA' : sameT ? 'sameT' : 'general';
  let text;
  if (settled === 'done') text = S.explain.done[rel](vals);
  else if (settled === 'climb') text = sameN ? S.explain.climbSame(vals) : S.explain.climb(vals);
  else if (settled === 'first') text = S.explain.first(vals);
  else text = S.explain.idle(vals);
  const tone = settled === 'done' ? '#34d399' : settled === 'idle' ? '#22d3ee' : '#fbbf24';

  /* ---- graph */
  const xAx = niceAxis(tEnd);
  const yAx = niceAxis(Math.max(A1, A2) * 1.04);
  const live = (A, ti) => {
    if (t <= 0) return [{ x: 0, y: 0 }];
    const pts = [{ x: 0, y: 0 }, { x: Math.min(t, ti), y: (A * Math.min(t, ti)) / ti }];
    if (t > ti) pts.push({ x: t, y: A });
    return pts;
  };
  const plan = (A, ti) => [{ x: 0, y: 0 }, { x: ti, y: A }, { x: xAx.max, y: A }];
  const series = [
    { id: 'p1', label: S.graph.plan, color: 'rgba(148,163,184,0.55)', points: plan(A1, t1), dash: '4 4', dot: false, width: 1.6 },
    { id: 'p2', label: S.graph.plan, color: 'rgba(148,163,184,0.55)', points: plan(A2, t2), dash: '4 4', dot: false, width: 1.6, legend: false },
    { id: 'a1', label: names[0], color: '#60a5fa', points: live(A1, t1) },
    { id: 'a2', label: names[1], color: '#f472b6', points: live(A2, t2) },
  ];

  // the slope of each line is the power: label it next to the line
  const graphNotes = [0, 1].map((i) => {
    const ti = i === 0 ? t1 : t2;
    const Ai = i === 0 ? A1 : A2;
    const xm = ti * 0.5;
    const up = (i === 0 ? N1 >= N2 : N2 > N1) ? 1 : -1;
    return { x: xm, y: Ai * 0.5 + up * yAx.max * 0.09, text: S.graph.slope(i === 0 ? '₁' : '₂', smart(i === 0 ? N1 : N2, dec)), color: i === 0 ? '#93c5fd' : '#f9a8d4', anchor: up > 0 ? 'end' : 'start' };
  });

  const climber = (i) => {
    const ti = i === 0 ? t1 : t2;
    const m = i === 0 ? m1 : m2;
    const N = i === 0 ? N1 : N2;
    const A = i === 0 ? A1 : A2;
    const a = i === 0 ? a1 : a2;
    const col = i === 0 ? PC.one : PC.two;
    const txt = i === 0 ? PC.oneText : PC.twoText;
    return (
      <Readout
        key={i}
        label={S.readouts.power(names[i])}
        symbol={i === 0 ? 'N₁' : 'N₂'}
        value={smart(N, dec)}
        unit={T.W}
        accent={col}
        textColor={txt}
        active={!sameN && big === i}
        sub={
          <>
            {S.readouts.work(i === 0 ? '₁' : '₂', J(a), J(A))}
            <br />
            <span className="text-gray-500">{S.readouts.hp(smart(N / HP, dec, 2), fmt(m, 0, dec), sec(ti))}</span>
          </>
        }
      />
    );
  };

  const group = (i) => {
    const col = i === 0 ? PC.one : PC.two;
    const m = i === 0 ? m1 : m2;
    const ti = i === 0 ? t1 : t2;
    const v = h / ti;
    const sub = i === 0 ? '₁' : '₂';
    return (
      <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: col }} aria-hidden="true" />
          {names[i]}
        </p>
        <RangeField
          id={`pw-st-m${i}`}
          label={S.mass}
          symbol={`m${sub}`}
          min={20}
          max={120}
          step={5}
          value={m}
          onChange={change(i === 0 ? setM1 : setM2)}
          accent={col}
          display={`${fmt(m, 0, dec)} ${T.kg}`}
          hint={S.massHint(whole(m * G, dec))}
        />
        <RangeField
          id={`pw-st-t${i}`}
          label={S.time}
          symbol={`t${sub}`}
          min={2}
          max={30}
          step={0.5}
          value={ti}
          onChange={change(i === 0 ? setT1 : setT2)}
          accent={col}
          display={`${sec(ti)} ${T.s}`}
          hint={S.paceHint(fmt(v, 2, dec), S.pace[paceOf(v)])}
        />
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{S.presetsLabel}</GroupLabel>
          <Segmented
            label={S.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={preset}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: S.presets[p.id].name, sub: S.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <StairsScene T={T} h={h} floors={floors} t={t} k={k} m={[m1, m2]} ts={[t1, t2]} A={[A1, A2]} a={[a1, a2]} N={[N1, N2]} />

      <Explain icon={Lightbulb} id={`${settled}-${rel}`} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={S.readouts.time}
          symbol="t"
          value={fmt(t, 1, dec)}
          unit={T.s}
          accent={PC.time}
          textColor={PC.timeText}
          sub={
            <>
              {S.readouts.timeSub(names[0], sec(t1), names[1], sec(t2))}
              <br />
              <span className="text-gray-500">{S.readouts.workSame(J(A1), J(A2), sec(h))}</span>
            </>
          }
        />
        {climber(0)}
        {climber(1)}
        <Readout label={S.readouts.formula} accent={PC.N}>
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text="N = A / t = mgh / t" />
            </p>
            <p className="tabular-nums text-gray-400">
              N₁ = {fmt(m1, 0, dec)}·{smart(G, dec)}·{sec(h)} / {sec(t1)} = <b style={{ color: PC.oneText }}>{smart(N1, dec)}</b> {T.W}
            </p>
            <p className="tabular-nums text-gray-400">
              N₂ = {fmt(m2, 0, dec)}·{smart(G, dec)}·{sec(h)} / {sec(t2)} = <b style={{ color: PC.twoText }}>{smart(N2, dec)}</b> {T.W}
            </p>
            <p className="text-xs text-gray-500">{sameN ? S.equal : S.ratio(names[big], vals.ratio)}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="pw-st-floors"
            label={S.height}
            symbol="h"
            min={1}
            max={5}
            step={1}
            value={floors}
            onChange={change(setFloors)}
            accent="#94a3b8"
            display={S.floorsDisplay(floors, sec(h))}
            hint={S.heightHint}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {group(0)}
            {group(1)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LiveGraph
            title={S.graph.title}
            series={series}
            notes={graphNotes}
            xMax={xAx.max}
            yMax={yAx.max}
            xDigits={xAx.digits}
            yDigits={yAx.digits}
            xLabel={S.graph.t}
            yLabel={S.graph.y}
            marker={t}
            decimal={dec}
            ariaLabel={S.graph.label}
            note={S.graph.note}
            height={250}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

function StairsScene({ T, h, floors, t, k, m, ts, A, a, N }) {
  const S = T.stairs;
  const dec = T.decimal;
  const names = S.names;

  return (
    <LabScene
      legend={[
        { color: PC.one, label: names[0], kind: 'dot' },
        { color: PC.two, label: names[1], kind: 'dot' },
        { color: '#475569', label: S.legend.h, kind: 'dash' },
      ]}
      chips={
        <Chip icon={Timer}>
          {k === 1 ? S.chipReal : S.chipFast(k)} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? clamp(300 + floors * 42, 360, 520) : clamp(360 + floors * 50, 460, 600))}
      ariaLabel={S.sceneLabel(smart(h, dec), fmt(t, 1, dec), whole(a[0], dec), whole(a[1], dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const topPad = narrow ? 50 : 66;
        const groundY = H - (narrow ? 34 : 40);
        const worldW = 2 * TW + GAP;
        const axisPad = narrow ? 34 : 54;
        const rPad = narrow ? 10 : 40;
        const kH = (groundY - topPad) / (h + 2.9);
        const panelW = narrow ? 0 : clamp(W - (axisPad + worldW * kH + rPad), 340, 600);
        const leftW = W - panelW;
        const kk = Math.min(kH, (leftW - axisPad - rPad) / worldW);
        const x0 = axisPad + Math.max(0, (leftW - axisPad - rPad - worldW * kk) / 2);
        const sx = (X) => x0 + X * kk;
        const sy = (Y) => groundY - Y * kk;
        const cell = kk >= 18 ? kk : 2 * kk;
        const towers = [0, TW + GAP];
        const cols = [PC.one, PC.two];

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={leftW} y1={groundY} cell={cell} ax={sx(0)} ay={groundY} />

            {/* height axis */}
            <g aria-hidden="true">
              <line x1={sx(0) - (narrow ? 14 : 22)} x2={sx(0) - (narrow ? 14 : 22)} y1={groundY} y2={sy(h + 2.4)} stroke="#94a3b8" strokeWidth="1.2" />
              {Array.from({ length: Math.round((h + 1.5) / HALF) + 1 }, (_, i) => i * HALF)
                .filter((y) => y <= h + 1.5 + 1e-9)
                .map((y) => {
                  const major = Math.abs(y / FLOOR_H - Math.round(y / FLOOR_H)) < 1e-9;
                  return (
                    <g key={`ax${y}`}>
                      <line x1={sx(0) - (narrow ? 14 : 22) - (major ? 5 : 3)} x2={sx(0) - (narrow ? 14 : 22)} y1={sy(y)} y2={sy(y)} stroke="#64748b" />
                      {major && (
                        <text x={sx(0) - (narrow ? 21 : 30)} y={sy(y) + 4} textAnchor="end" fontSize={fs - 1} fill={y === 0 ? '#0f172a' : '#64748b'} fontWeight={y === 0 ? 700 : 500}>
                          {smart(y, dec)}
                        </text>
                      )}
                    </g>
                  );
                })}
              <text x={6} y={sy(h + 2.4) - 4} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {S.axisH}
              </text>
            </g>

            {towers.map((ox, i) => (
              <Stairwell key={`tw${i}`} ox={ox} h={h} floors={floors} sx={sx} sy={sy} kk={kk} color={cols[i]} done={t >= ts[i] - 1e-9 && t > 0} />
            ))}

            {/* storey badges between the stairwells */}
            {Array.from({ length: floors + 1 }, (_, i) => (
              <Pill
                key={`fl${i}`}
                x={sx(TW + GAP / 2)}
                y={sy(i * FLOOR_H + (i === floors ? 1.6 : 1.25))}
                text={narrow || GAP * kk < 64 ? String(i + 1) : S.floorName(i + 1)}
                bg="#ffffff"
                color="#475569"
                border="#cbd5e1"
                size={fs - 1}
              />
            ))}

            {/* the target height */}
            <line x1={sx(-0.2)} x2={sx(worldW + 0.2)} y1={sy(h)} y2={sy(h)} stroke="#475569" strokeWidth="1.4" strokeDasharray="6 5" />
            <Pill x={sx(TW + GAP / 2)} y={sy(h)} text={S.hTag(smart(h, dec))} bg="#334155" size={fs} box={box} />

            {/* ground */}
            <rect x={0} y={groundY} width={leftW} height={H - groundY} fill="#f1f5f9" />
            <line x1={0} x2={leftW} y1={groundY} y2={groundY} stroke="#475569" strokeWidth="1.6" />
            {Array.from({ length: Math.ceil(leftW / 10) }, (_, i) => (
              <line key={`gh${i}`} x1={i * 10} x2={i * 10 - 7} y1={groundY + 1} y2={groundY + 8} stroke="#94a3b8" />
            ))}

            {/* the two climbers */}
            {towers.map((ox, i) => {
              const ti = ts[i];
              const y = h * Math.min(1, t / ti);
              const pos = stairPos(y, h);
              const moving = t > 0 && t < ti - 1e-9;
              const atStart = t <= 0;
              const px = sx(ox + (atStart ? LAND * 0.45 : pos.x));
              const py = sy(atStart ? 0 : y);
              const v = h / ti;
              const ph = PERSON_H * kk;
              const label = t >= ti - 1e-9 && t > 0 ? S.doneTag(fmt(ti, 1, dec)) : S.aTag(whole(a[i], dec));
              return (
                <g key={`cl${i}`}>
                  <Climber
                    x={px}
                    y={py}
                    h={ph}
                    dir={atStart ? 1 : pos.dir}
                    phase={y * 3}
                    lean={clamp((v - 0.4) / 1.0, 0, 1)}
                    moving={moving && pos.onStairs}
                    slope={SLOPE}
                    shirt={cols[i]}
                  />
                  <Pill x={px} y={py - ph - (narrow ? 13 : 16)} text={label} bg={cols[i]} size={fs} box={box} />
                  <Pill x={sx(ox + TW / 2)} y={groundY + (narrow ? 17 : 20)} text={S.nameTag(names[i], fmt(m[i], 0, dec))} bg={cols[i]} size={fs} box={box} />
                </g>
              );
            })}

            {!narrow && <WorkBlocks T={T} x0={leftW + 8} x1={W - 18} top={topPad + 18} base={groundY} t={t} ts={ts} A={A} a={a} N={N} fs={fs} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** One stairwell: walls, landings, the zigzag of flights with rails, doors and a finish flag. */
function Stairwell({ ox, h, floors, sx, sy, kk, color, done }) {
  const flights = [];
  for (let j = 0; j < floors * 2; j += 1) {
    const y0 = j * HALF;
    const d = j % 2 === 0 ? 1 : -1;
    const xs = ox + (d === 1 ? LAND : LAND + RUN);
    const pts = [[xs, y0]];
    let x = xs;
    let y = y0;
    for (let r = 0; r < 9; r += 1) {
      y += RISER;
      pts.push([x, y]);
      if (r < 8) {
        x += d * TREAD;
        pts.push([x, y]);
      }
    }
    const xe = x;
    const under = [
      [xe, y0 + HALF - 0.3],
      [xs + d * 0.35, y0 - 0.02],
    ];
    const poly = [...pts, ...under].map(([px, py]) => `${sx(px).toFixed(1)},${sy(py).toFixed(1)}`).join(' ');
    flights.push(
      <g key={`f${j}`}>
        <polygon points={poly} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.1" strokeLinejoin="round" />
        <polyline points={pts.map(([px, py]) => `${sx(px).toFixed(1)},${sy(py).toFixed(1)}`).join(' ')} fill="none" stroke="#64748b" strokeWidth="1.4" strokeLinejoin="round" />
        {/* handrail */}
        <line x1={sx(xs)} y1={sy(y0 + 0.9)} x2={sx(xe)} y2={sy(y0 + HALF + 0.9)} stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={sx(xs + d * 0.1)} y1={sy(y0 + 0.9 + 0.06)} x2={sx(xs + d * 0.1)} y2={sy(y0 + RISER)} stroke="#cbd5e1" strokeWidth="1.2" />
        <line x1={sx(xe - d * 0.1)} y1={sy(y0 + HALF + 0.85)} x2={sx(xe - d * 0.1)} y2={sy(y0 + HALF)} stroke="#cbd5e1" strokeWidth="1.2" />
      </g>,
    );
  }
  const slab = 0.22;
  const top = h + 2.9;
  return (
    <g aria-hidden="true">
      <rect x={sx(ox)} y={sy(top)} width={TW * kk} height={sy(0) - sy(top)} fill="#f8fafc" opacity="0.7" />
      {/* landings at each storey (left) and half-storey (right) */}
      {Array.from({ length: floors + 1 }, (_, i) => (
        <rect key={`ls${i}`} x={sx(ox - 0.3)} y={sy(i * FLOOR_H)} width={(LAND + 0.3) * kk} height={slab * kk} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      ))}
      {Array.from({ length: floors }, (_, i) => (
        <rect key={`lm${i}`} x={sx(ox + LAND + RUN)} y={sy(i * FLOOR_H + HALF)} width={LAND * kk} height={slab * kk} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      ))}
      {flights}
      {/* walls */}
      <line x1={sx(ox)} x2={sx(ox)} y1={sy(0)} y2={sy(top)} stroke="#64748b" strokeWidth="3" />
      <line x1={sx(ox + TW)} x2={sx(ox + TW)} y1={sy(0)} y2={sy(top)} stroke="#64748b" strokeWidth="3" />
      <rect x={sx(ox - 0.3)} y={sy(top + 0.25)} width={(TW + 0.6) * kk} height={0.25 * kk} fill="#94a3b8" />
      {/* finish flag on the top landing */}
      <line x1={sx(ox + 0.62)} x2={sx(ox + 0.62)} y1={sy(h)} y2={sy(h + 1.25)} stroke="#334155" strokeWidth="1.6" />
      <path d={`M${sx(ox + 0.62)},${sy(h + 1.25)} L${sx(ox + 0.62) + 0.55 * kk},${sy(h + 1.05)} L${sx(ox + 0.62)},${sy(h + 0.85)} Z`} fill={done ? color : '#cbd5e1'} />
    </g>
  );
}

/**
 * The work done in each second as a block: a column of t blocks of N joules
 * each stacks up to A = N·t. Same height, different block sizes → same work,
 * different power.
 */
function WorkBlocks({ T, x0, x1, top, base, t, ts, A, a, N, fs }) {
  const S = T.stairs;
  const dec = T.decimal;
  const names = S.names;
  const yAx = niceAxis(Math.max(A[0], A[1]) * 1.04);
  const colTop = top + 42;
  const kA = (base - colTop) / yAx.max;
  const axX = x0 + 54;
  const cw = clamp((x1 - axX - 40) / 2 - 30, 46, 120);
  const gap = clamp((x1 - axX - 2 * cw) / 3, 24, 90);
  const cols = [PC.one, PC.two];
  const texts = ['#1d4ed8', '#be185d'];
  return (
    <g aria-hidden="true">
      <line x1={x0} x2={x0} y1={top - 8} y2={base} stroke="#e2e8f0" strokeWidth="1.5" />
      <text x={(x0 + x1) / 2 + 20} y={top + 6} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#334155">
        {S.blocks.title}
      </text>
      <text x={(x0 + x1) / 2 + 20} y={top + 24} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
        {S.blocks.sub}
      </text>
      {/* axis */}
      {[0, 1, 2, 3, 4].map((i) => {
        const v = i * yAx.step;
        return (
          <g key={`y${i}`}>
            <line x1={axX - 4} x2={x1} y1={base - v * kA} y2={base - v * kA} stroke={i === 0 ? '#94a3b8' : '#eef2f7'} />
            <text x={axX - 7} y={base - v * kA + 4} textAnchor="end" fontSize={fs - 1.5} fill="#64748b">
              {whole(v, dec)}
            </text>
          </g>
        );
      })}
      <text x={axX - 7} y={colTop - 10} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {S.blocks.axis}
      </text>
      {[0, 1].map((i) => {
        const cx = axX + gap + i * (cw + gap);
        const el = Math.min(t, ts[i]);
        const n = Math.floor(el + 1e-9);
        const part = el - n;
        const hB = N[i] * kA;
        const blocks = [];
        for (let b = 0; b < n; b += 1) {
          blocks.push(
            <rect key={`b${b}`} x={cx} y={base - (b + 1) * hB + 0.5} width={cw} height={Math.max(0.5, hB - 1)} rx={Math.min(3, hB / 3)} fill={cols[i]} opacity={b % 2 === 0 ? 0.95 : 0.7} />,
          );
        }
        if (part > 1e-6) {
          blocks.push(<rect key="bp" x={cx} y={base - (n + part) * hB} width={cw} height={part * hB} rx={Math.min(3, hB / 3)} fill={cols[i]} opacity={0.45} />);
        }
        const fullTop = base - A[i] * kA;
        const done = t >= ts[i] - 1e-9 && t > 0;
        return (
          <g key={`c${i}`}>
            <rect x={cx} y={fullTop} width={cw} height={base - fullTop} rx={3} fill="none" stroke={cols[i]} strokeWidth="1.4" strokeDasharray="4 3" opacity="0.6" />
            {blocks}
            {/* one block, labelled */}
            {hB > 12 && n >= 1 && (
              <text x={cx + cw / 2} y={base - hB / 2 + 4} textAnchor="middle" fontSize={fs - 1.5} fontWeight="700" fill="#fff">
                {S.blocks.one}
              </text>
            )}
            <text x={cx + cw / 2} y={fullTop - 8} textAnchor="middle" fontSize={fs} fontWeight="700" fill={texts[i]}>
              {`${whole(a[i], dec)} ${T.J}`}
            </text>
            <text x={cx + cw / 2} y={base + 16} textAnchor="middle" fontSize={fs} fontWeight="700" fill={texts[i]}>
              {names[i]}
            </text>
            <text x={cx + cw / 2} y={base + 31} textAnchor="middle" fontSize={fs - 1.5} fill="#475569">
              {done ? S.blocks.total(smart(ts[i], dec), smart(N[i], dec)) : S.blocks.count(n, smart(N[i], dec))}
            </text>
          </g>
        );
      })}
    </g>
  );
}
