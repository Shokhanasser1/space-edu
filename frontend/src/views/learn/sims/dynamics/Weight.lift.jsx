import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Feather, Lightbulb, Timer } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import { BathScale, Chip, FC, ForceArrow, Formula, G, GroupLabel, LabScene, PaperGrid, Person, PlayControls, SidePill, newtons, niceAxis, num } from './Weight.parts';

/**
 * Tab 1 — a person on a bathroom scale in a lift. The ride follows a real
 * lift's profile: stand still → speed up → move uniformly → brake → stand,
 * going up from the 1st to the 9th floor or down again; a third ride is the
 * free-fall thought experiment (the cabin falls with a = g, then the safety
 * brake stops it with a = g upwards).
 *
 * Upwards is the positive axis. Newton's 2nd law for the person: N − mg = ma,
 * so N = m(g + a); by the 3rd law the person presses on the scale with
 * P = N = m(g + a). With a = 2 m/s² up and m = 60 kg: P = 708 N; with
 * a = 2 m/s² down: P = 468 N; uniform motion or rest: P = mg = 588 N;
 * free fall (a = −g): P = 0. Strings come from T.lift.
 */

const FLOOR_H = 3; // m per storey
const FLOORS = 9;
const TOP = (FLOORS - 1) * FLOOR_H; // 24 m: floor of the 9th storey
const VMAX = 3; // m/s, cruising speed of the lift
const REST = 1; // s standing still before and after
const CABIN_H = 2.4; // m
const M_MAX = 100;
const A_MAX = 4;
const T_FALL = Math.sqrt(TOP / G); // free fall then braking at g: lands exactly on the 1st floor
const IDLE = { t: 0, running: false, done: false };

const RIDES = {
  up: { icon: ArrowUpFromLine },
  down: { icon: ArrowDownToLine },
  fall: { icon: Feather },
};

function buildRide(kind, a) {
  let segs;
  let h0;
  if (kind === 'fall') {
    h0 = TOP;
    segs = [
      { dur: REST, a: 0, phase: 'rest' },
      { dur: T_FALL, a: -G, phase: 'freeFall' },
      { dur: T_FALL, a: G, phase: 'catch' },
      { dur: REST, a: 0, phase: 'stop' },
    ];
  } else {
    const dir = kind === 'up' ? 1 : -1;
    const ta = VMAX / a;
    const tc = Math.max(0, (TOP - VMAX * ta) / VMAX);
    h0 = kind === 'up' ? 0 : TOP;
    segs = [
      { dur: REST, a: 0, phase: 'rest' },
      { dur: ta, a: dir * a, phase: kind === 'up' ? 'accUp' : 'accDown' },
      { dur: tc, a: 0, phase: kind === 'up' ? 'cruiseUp' : 'cruiseDown' },
      { dur: ta, a: -dir * a, phase: kind === 'up' ? 'brakeUp' : 'brakeDown' },
      { dur: REST, a: 0, phase: 'stop' },
    ];
  }
  let t0 = 0;
  let h = h0;
  let v = 0;
  const out = segs.map((s) => {
    const seg = { ...s, t0, h0: h, v0: v };
    h += v * s.dur + 0.5 * s.a * s.dur * s.dur;
    v += s.a * s.dur;
    t0 += s.dur;
    return seg;
  });
  return { kind, segs: out, total: t0 };
}

function rideState(ride, t) {
  const segs = ride.segs;
  let seg = segs[segs.length - 1];
  for (const s of segs) {
    if (s.dur > 0 && t < s.t0 + s.dur) {
      seg = s;
      break;
    }
  }
  const tau = clamp(t - seg.t0, 0, seg.dur);
  const v = seg.v0 + seg.a * tau;
  return { h: seg.h0 + seg.v0 * tau + 0.5 * seg.a * tau * tau, v: Math.abs(v) < 1e-9 ? 0 : v, a: seg.a, phase: seg.phase };
}

/** P(t) as a step line from 0 to tEnd. */
function stepPoints(ride, m, tEnd) {
  const pts = [];
  for (const s of ride.segs) {
    if (s.t0 > tEnd + 1e-9) break;
    const P = Math.max(0, m * (G + s.a));
    pts.push({ x: s.t0, y: P }, { x: Math.min(s.t0 + s.dur, tEnd), y: P });
  }
  return pts;
}

const TONES = {
  idle: '#22d3ee',
  rest: '#34d399',
  stop: '#34d399',
  cruiseUp: '#34d399',
  cruiseDown: '#34d399',
  accUp: '#fb923c',
  brakeDown: '#fb923c',
  accDown: '#60a5fa',
  brakeUp: '#60a5fa',
  freeFall: '#a78bfa',
  catch: '#f87171',
  done: '#34d399',
};

export default function LiftSim({ T }) {
  const L = T.lift;
  const dec = T.decimal;
  const [kind, setKind] = useState('up');
  const [m, setM] = useState(60);
  const [acc, setAcc] = useState(2);
  const [sim, setSim] = useState(IDLE);
  const ride = useMemo(() => buildRide(kind, acc), [kind, acc]);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(ride.total, p.t + dt);
      const done = t >= ride.total - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickKind = (k) => {
    setKind(k);
    setSim(IDLE);
  };

  const t = sim.t;
  const st = rideState(ride, t);
  const mg = m * G;
  const P = Math.max(0, m * (G + st.a));
  const started = t > 0 || sim.running;
  const NN = (n) => newtons(n, dec);
  const aAbs = Math.abs(st.a);
  const aDir = st.a > 1e-9 ? 'up' : st.a < -1e-9 ? 'down' : 'none';
  const vDir = st.v > 1e-9 ? 'up' : st.v < -1e-9 ? 'down' : 'none';
  const ARROW = { up: '↑', down: '↓', none: '' };
  const floorNo = clamp(Math.round(st.h / FLOOR_H) + 1, 1, FLOORS);

  /* ---- explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (started) key = st.phase;
  const settled = useSettled(key, key === 'idle' || key === 'done' ? 0 : 160);
  const ex = L.explain;
  // the words describe the settled phase, so take its numbers too (not the
  // live ones, which run ahead of the debounced message)
  const phaseA = { accUp: acc, brakeDown: acc, accDown: -acc, brakeUp: -acc, freeFall: -G, catch: G }[settled] ?? 0;
  const vals = {
    P: NN(Math.max(0, m * (G + phaseA))),
    mg: NN(mg),
    a: num(Math.abs(phaseA), 1, dec),
    m: fmt(m, 0, dec),
    Pup: NN(m * (G + acc)),
    Pdown: NN(m * (G - acc)),
    P2: NN(2 * mg),
    kg: fmt(P / G, 1, dec),
  };
  const text = settled === 'done' ? ex.done[kind](vals) : ex[settled](vals);
  const tone = TONES[settled] ?? '#22d3ee';

  /* ---- formula */
  const F = (n, d = 1) => num(n, d, dec);
  let formula = L.formula.zero;
  let filled = `= ${fmt(m, 0, dec)} · ${F(G)} = `;
  if (aDir === 'up') {
    formula = L.formula.up;
    filled = `= ${fmt(m, 0, dec)} · (${F(G)} + ${F(aAbs)}) = `;
  } else if (aDir === 'down') {
    formula = L.formula.down;
    filled = `= ${fmt(m, 0, dec)} · (${F(G)} − ${F(aAbs)}) = `;
  }
  const caseId = st.phase === 'freeFall' ? 'fall' : aDir === 'up' ? 'up' : aDir === 'down' ? 'down' : 'zero';

  /* ---- graph */
  const xAx = niceAxis(ride.total);
  const pPeak = kind === 'fall' ? 2 * mg : m * (G + acc);
  const yAx = niceAxis(pPeak * 1.05);
  const series = [
    { id: 'plan', label: L.graph.plan, color: 'rgba(196,181,253,0.45)', points: stepPoints(ride, m, ride.total), dash: '4 4', dot: false },
    { id: 'mg', label: L.graph.mg, color: '#f87171', points: [{ x: 0, y: mg }, { x: xAx.max, y: mg }], dash: '6 5', dot: false },
    { id: 'P', label: L.graph.P, color: '#a78bfa', points: started ? stepPoints(ride, m, t) : [{ x: 0, y: P }] },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.ridesLabel}</GroupLabel>
          <Segmented
            label={L.ridesLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={kind}
            onChange={pickKind}
            options={Object.keys(RIDES).map((id) => ({ value: id, label: L.rides[id].name, sub: L.rides[id].sub, icon: RIDES[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <LiftScene T={T} kind={kind} st={st} m={m} P={P} t={t} running={sim.running} floorNo={floorNo} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.a}
          symbol="a"
          value={F(aAbs)}
          unit={`${T.ms2} ${ARROW[aDir]}`}
          accent={FC.a}
          textColor={FC.aText}
          sub={started ? L.phase[st.phase] : L.dirNone}
        />
        <Readout
          label={L.readouts.v}
          symbol="v"
          value={F(Math.abs(st.v))}
          unit={`${T.ms} ${ARROW[vDir]}`}
          accent={FC.v}
          textColor={FC.vText}
          sub={L.hSub(F(st.h), floorNo)}
        />
        <Readout
          label={L.readouts.P}
          symbol="P"
          value={NN(P)}
          unit={T.N}
          accent={FC.P}
          textColor={FC.PText}
          active={Math.abs(P - mg) > 0.5}
          sub={
            <>
              {L.pSub(NN(mg), F(P / mg, 2))}
              <br />
              <span className="text-gray-500">{L.kgNote(fmt(P / G, 1, dec), fmt(m, 0, dec))}</span>
            </>
          }
        />
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text={formula} />
            </p>
            <p className="tabular-nums text-gray-400">
              {filled}
              <b style={{ color: FC.PText }}>{NN(P)}</b> {T.N}
            </p>
            <p className="text-xs text-gray-500">{L.caseNote[caseId]}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wt-lift-m"
            label={L.mass}
            symbol="m"
            min={30}
            max={M_MAX}
            step={5}
            value={m}
            onChange={(n) => {
              setM(n);
              setSim(IDLE);
            }}
            accent={FC.mg}
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={L.massHint(NN(mg))}
          />
          <RangeField
            id="wt-lift-a"
            label={L.accel}
            symbol="a"
            min={0.5}
            max={A_MAX}
            step={0.5}
            value={kind === 'fall' ? A_MAX : acc}
            disabled={kind === 'fall'}
            onChange={(n) => {
              setAcc(n);
              setSim(IDLE);
            }}
            accent={FC.a}
            display={kind === 'fall' ? `${F(G)} ${T.ms2}` : `${F(acc)} ${T.ms2}`}
            hint={kind === 'fall' ? L.accelFallHint : L.accelHint(F(VMAX))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.cases.title}</p>
            <ul className="mt-1.5 space-y-1">
              {['up', 'zero', 'down', 'fall'].map((id) => {
                const on = started && caseId === id;
                const val = { up: m * (G + acc), zero: mg, down: m * (G - acc), fall: 0 }[id];
                return (
                  <li
                    key={id}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[13px] transition-colors ${on ? 'bg-white/10 text-white' : 'text-gray-400'}`}
                  >
                    <span>
                      <span className="font-semibold">{L.cases[id].when}</span> <Formula text={L.cases[id].rule} />
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: on ? FC.PText : undefined }}>
                      {id === 'up' || id === 'down' ? (kind === 'fall' ? '—' : `${NN(val)} ${T.N}`) : `${NN(val)} ${T.N}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={xAx.max}
            yMax={yAx.max}
            xDigits={xAx.digits}
            yDigits={yAx.digits}
            xLabel={L.graph.t}
            yLabel={L.graph.y}
            marker={t}
            decimal={dec}
            ariaLabel={L.graph.label}
            note={L.graph.note}
            height={250}
            onScrub={(x) => {
              const tt = Math.min(x, ride.total);
              setSim({ t: tt, running: false, done: tt >= ride.total - 1e-9 });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

function LiftScene({ T, kind, st, m, P, t, running, floorNo }) {
  const L = T.lift;
  const dec = T.decimal;
  const mg = m * G;
  // one force scale for every setting of this ride, so the arrows compare honestly
  const fMax = kind === 'fall' ? 2 * M_MAX * G : M_MAX * (G + A_MAX);
  const vMax = kind === 'fall' ? G * T_FALL : VMAX;
  const aMax = kind === 'fall' ? G : A_MAX;
  const NN = (n) => newtons(n, dec);
  const F = (n, d = 1) => num(n, d, dec);
  const cellN = (kF) => niceStep(kF, 22);
  const kFof = (H, feetY) => (H - feetY - 34) / fMax;

  return (
    <LabScene
      legend={[
        { color: FC.mg, label: L.legend.mg, kind: 'arrow' },
        { color: FC.N, label: L.legend.N, kind: 'arrow' },
        { color: FC.P, label: L.legend.P, kind: 'arrow' },
        { color: FC.a, label: L.legend.a, kind: 'arrow' },
        { color: FC.v, label: L.legend.v, kind: 'arrow' },
      ]}
      chips={
        <Chip icon={Timer}>
          {L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 450 : 500)}
      ariaLabel={L.sceneLabel(L.phase[st.phase], NN(P), NN(mg))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const topPad = narrow ? 44 : 60;
        const Wo = Math.round(clamp(W * 0.22, 104, 270));
        const gap = narrow ? 8 : 20;
        const cx0 = Wo + gap;
        const closeW = W - cx0;

        /* ---------- close-up geometry */
        const hp = narrow ? 148 : 186; // person height, px (≈ 1.75 m)
        const pxM = hp / 1.75;
        const cabinTop = topPad + 16;
        const floorY = Math.round(cabinTop + hp * 1.32);
        const sH = Math.max(10, Math.round(hp * 0.075));
        const scaleTop = floorY - sH;
        const press = clamp((P / 1000) * 2.2, 0, 3.5);
        const feet = scaleTop + press;
        const cw = Math.min(closeW - (narrow ? 6 : 24), narrow ? 9999 : Math.round(hp * 2.15));
        const cabX = cx0 + (narrow ? 2 : 12);
        const pcx = cabX + cw * (narrow ? 0.56 : 0.5);
        const kF = kFof(H, scaleTop);
        const cell = cellN(kF);
        const comY = feet - 0.55 * hp;
        const lenMg = mg * kF;
        const lenP = P * kF;
        const xN = pcx - 0.056 * hp;
        const xP = pcx + 0.056 * hp;
        const kA = (narrow ? 44 : 64) / aMax;

        /* ---------- building overview geometry */
        const groundY = H - 26;
        const worldTop = FLOORS * FLOOR_H + 3.2;
        const kS = (groundY - (topPad + 6)) / worldTop;
        const syS = (mm) => groundY - mm * kS;
        const bx0 = narrow ? 24 : 40;
        const bx1 = Wo - 6;
        const bw = bx1 - bx0;
        const shW = clamp(bw * 0.36, 26, 58);
        const shX = bx0 + (bw - shW) / 2;
        const cabY0 = syS(st.h + CABIN_H);
        const cabY1 = syS(st.h);
        const cabMid = (cabY0 + cabY1) / 2;
        const kVo = 44 / vMax;
        const kAo = 44 / aMax;

        /* rail brackets in the close-up move past the cabin as it travels */
        const brackets = [];
        const iLo = Math.floor(st.h - (H - floorY) / pxM) - 1;
        const iHi = Math.ceil(st.h + floorY / pxM) + 1;
        for (let i = iLo; i <= iHi; i += 1) brackets.push(floorY - (i - st.h) * pxM);

        /* bars (wide screens only) */
        const barsX0 = cabX + cw + 44;
        const barsX1 = W - 20;
        const showBars = !narrow && barsX1 - barsX0 >= 270;

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={cx0} y0={0} x1={W} y1={H} cell={cell * kF} ax={pcx} ay={scaleTop} />

            {/* ================= building overview */}
            <g aria-hidden="true">
              <rect x={0} y={0} width={Wo + gap / 2} height={H} fill="#f8fafc" />
              <line x1={Wo + gap / 2} x2={Wo + gap / 2} y1={8} y2={H - 8} stroke="#cbd5e1" strokeDasharray="4 5" />
              {/* machine room + building */}
              <rect x={shX - 10} y={syS(worldTop)} width={shW + 20} height={syS(FLOORS * FLOOR_H) - syS(worldTop)} fill="#e2e8f0" stroke="#94a3b8" />
              <circle cx={shX + shW / 2} cy={syS(worldTop - 1.4)} r={Math.max(4, kS * 0.8)} fill="#fff" stroke="#475569" strokeWidth="1.6" />
              <rect x={bx0} y={syS(FLOORS * FLOOR_H)} width={bw} height={groundY - syS(FLOORS * FLOOR_H)} fill="#f1f5f9" stroke="#94a3b8" />
              {Array.from({ length: FLOORS }, (_, i) => {
                const y0 = syS((i + 1) * FLOOR_H);
                const ww = Math.max(4, (shX - bx0) * 0.5);
                const wh = Math.max(4, kS * 1.2);
                const on = i + 1 === floorNo;
                return (
                  <g key={`fl${i}`}>
                    <line x1={bx0} x2={bx1} y1={syS(i * FLOOR_H)} y2={syS(i * FLOOR_H)} stroke="#cbd5e1" />
                    <rect x={bx0 + (shX - bx0 - ww) / 2} y={y0 + kS * 0.9} width={ww} height={wh} rx={1} fill="#dbeafe" />
                    <rect x={shX + shW + (bx1 - shX - shW - ww) / 2} y={y0 + kS * 0.9} width={ww} height={wh} rx={1} fill="#dbeafe" />
                    <text
                      x={bx1 - 3}
                      y={syS(i * FLOOR_H + 1.5) + 4}
                      textAnchor="end"
                      fontSize={fs - 2}
                      fontWeight={on ? 800 : 500}
                      fill={on ? '#0f172a' : '#94a3b8'}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              <rect x={shX} y={syS(FLOORS * FLOOR_H)} width={shW} height={groundY - syS(FLOORS * FLOOR_H)} fill="#e2e8f0" stroke="#94a3b8" />
              {/* cable */}
              <line x1={shX + shW / 2} x2={shX + shW / 2} y1={syS(worldTop - 1.4)} y2={cabY0} stroke="#475569" strokeWidth="1.4" />
              {/* cabin */}
              <rect x={shX + 2} y={cabY0} width={shW - 4} height={cabY1 - cabY0} rx={2} fill="#ffffff" stroke="#0f172a" strokeWidth="1.6" />
              <Person cx={shX + shW / 2} feetY={cabY1 - 1.5} h={Math.max(12, kS * 1.75)} />
              {/* ground */}
              <line x1={0} x2={Wo + gap / 2} y1={groundY} y2={groundY} stroke="#475569" strokeWidth="1.6" />
              {Array.from({ length: Math.ceil((Wo + gap / 2) / 9) }, (_, i) => (
                <line key={`gh${i}`} x1={i * 9} x2={i * 9 - 7} y1={groundY + 1} y2={groundY + 8} stroke="#94a3b8" />
              ))}
              {/* h axis */}
              {[0, 6, 12, 18, 24].map((hh) => (
                <g key={`ax${hh}`}>
                  <line x1={bx0 - 5} x2={bx0} y1={syS(hh)} y2={syS(hh)} stroke="#64748b" />
                  <text x={bx0 - 7} y={syS(hh) + 4} textAnchor="end" fontSize={fs - 2} fill="#64748b" fontWeight={hh === 0 ? 700 : 400}>
                    {hh}
                  </text>
                </g>
              ))}
              <text x={4} y={syS(worldTop) + 10} fontSize={fs - 2} fontWeight="700" fill="#475569">
                {L.axisH}
              </text>
            </g>
            {/* v and a beside the small cabin */}
            {Math.abs(st.v) > 0.02 && (
              <>
                <ForceArrow x1={shX - 9} y1={cabMid} x2={shX - 9} y2={cabMid - st.v * kVo} color={FC.v} width={2.6} head={9} dot={false} />
                <text x={shX - 9} y={st.v > 0 ? cabMid - st.v * kVo - 6 : cabMid - st.v * kVo + 14} textAnchor="middle" fontSize={fs} fontStyle="italic" fontWeight="700" fill={FC.v} stroke="#fff" strokeWidth="3" paintOrder="stroke">
                  v
                </text>
              </>
            )}
            {Math.abs(st.a) > 1e-9 && (
              <>
                <ForceArrow x1={shX + shW + 9} y1={cabMid} x2={shX + shW + 9} y2={cabMid - st.a * kAo} color={FC.a} width={2.6} head={9} dot={false} />
                <text
                  x={shX + shW + 9}
                  y={st.a > 0 ? cabMid - st.a * kAo - 6 : cabMid - st.a * kAo + 14}
                  textAnchor="middle"
                  fontSize={fs}
                  fontStyle="italic"
                  fontWeight="700"
                  fill={FC.a}
                  stroke="#fff"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  a
                </text>
              </>
            )}

            {/* ================= close-up of the cabin */}
            <g aria-hidden="true">
              {[cabX - 8, cabX + cw + 8].map((rx) => (
                <g key={`rail${rx}`}>
                  <line x1={rx} x2={rx} y1={0} y2={H} stroke="#94a3b8" strokeWidth="3" />
                  {brackets.map((by) => (
                    <line key={`br${by.toFixed(1)}`} x1={rx - 6} x2={rx + 6} y1={by} y2={by} stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
                  ))}
                </g>
              ))}
              <line x1={cabX + cw / 2} x2={cabX + cw / 2} y1={0} y2={cabinTop} stroke="#475569" strokeWidth="2.6" />
              <rect x={cabX + cw / 2 - 9} y={cabinTop - 7} width={18} height={7} rx={2} fill="#475569" />
              <rect x={cabX} y={cabinTop} width={cw} height={floorY - cabinTop + 12} rx={8} fill="#f8fafc" fillOpacity="0.88" stroke="#475569" strokeWidth="2.5" />
              {[1, 2, 3].map((i) => (
                <line key={`pn${i}`} x1={cabX + (cw * i) / 4} x2={cabX + (cw * i) / 4} y1={cabinTop + 6} y2={floorY - 2} stroke="#e2e8f0" strokeWidth="1.2" />
              ))}
              <rect x={cabX + cw * 0.3} y={cabinTop + 6} width={cw * 0.4} height={5} rx={2.5} fill="#fde68a" />
              <line
                x1={cabX + 10}
                x2={cabX + cw - 10}
                y1={scaleTop - (0.95 / 1.75) * hp}
                y2={scaleTop - (0.95 / 1.75) * hp}
                stroke="#cbd5e1"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* floor indicator */}
              <rect x={cabX + cw - (narrow ? 50 : 60)} y={cabinTop + 10} width={narrow ? 40 : 48} height={narrow ? 22 : 26} rx={5} fill="#0f172a" />
              <text
                x={cabX + cw - (narrow ? 30 : 36)}
                y={cabinTop + (narrow ? 26 : 28.5)}
                textAnchor="middle"
                fontSize={narrow ? 13 : 15}
                fontWeight="800"
                fill="#fb923c"
                fontFamily="ui-monospace, monospace"
              >
                {floorNo}
                {st.v > 0.02 ? '▲' : st.v < -0.02 ? '▼' : ''}
              </text>
              {/* floor slab */}
              <rect x={cabX} y={floorY} width={cw} height={12} rx={3} fill="#94a3b8" />
            </g>

            <BathScale cx={pcx} topY={scaleTop} w={0.46 * hp} h={sH} press={press} lit highlight={null} />
            <Person cx={pcx} feetY={feet} h={hp} />

            {/* scale display, enlarged */}
            <LcdBubble
              x={pcx - (narrow ? 0.66 : 0.64) * hp}
              y={scaleTop - 0.1 * hp}
              toX={pcx - 0.1 * hp}
              toY={scaleTop + sH * 0.55}
              label={L.scaleLabel}
              value={`${NN(P)} ${T.N}`}
              fs={fs}
              narrow={narrow}
            />

            {/* forces */}
            <ForceArrow x1={pcx} y1={comY} x2={pcx} y2={comY + lenMg} color={FC.mg} width={narrow ? 3 : 3.6} head={narrow ? 11 : 13} />
            {P > 0.5 ? (
              <>
                <ForceArrow x1={xN} y1={feet} x2={xN} y2={feet - lenP} color={FC.N} width={narrow ? 3 : 3.6} head={narrow ? 11 : 13} />
                <ForceArrow x1={xP} y1={feet} x2={xP} y2={feet + lenP} color={FC.P} width={narrow ? 3 : 3.6} head={narrow ? 11 : 13} />
              </>
            ) : (
              <circle cx={pcx} cy={feet} r={3.5} fill="#0f172a" />
            )}
            <SidePill x={pcx + 0.2 * hp} y={comY + Math.min(lenMg * 0.45, 26)} side={1} gap={2} text={narrow ? L.tag.mgShort(NN(mg)) : L.tag.mg(NN(mg))} bg={FC.mg} fs={fs} box={box} />
            {P > 0.5 ? (
              <>
                <SidePill x={pcx - 0.19 * hp} y={feet - Math.max(lenP, 0.36 * hp) + 8} side={-1} gap={2} text={narrow ? L.tag.NShort(NN(P)) : L.tag.N(NN(P))} bg={FC.N} fs={fs} box={box} />
                <SidePill x={xP + 4} y={feet + Math.max(lenP - 6, 18)} side={1} gap={4} text={narrow ? L.tag.PShort(NN(P)) : L.tag.P(NN(P))} bg={FC.P} fs={fs} box={box} />
              </>
            ) : (
              <SidePill x={pcx + 0.24 * hp} y={feet + 22} side={1} gap={2} text={L.tag.zero} bg={FC.P} fs={fs} box={box} />
            )}

            {/* acceleration of the cabin */}
            {Math.abs(st.a) > 1e-9 && (
              <>
                <ForceArrow
                  x1={cabX + cw - (narrow ? 16 : 26)}
                  y1={(cabinTop + floorY) / 2 + 10}
                  x2={cabX + cw - (narrow ? 16 : 26)}
                  y2={(cabinTop + floorY) / 2 + 10 - st.a * kA}
                  color={FC.a}
                  width={narrow ? 2.8 : 3.2}
                  head={narrow ? 10 : 12}
                  dot={false}
                />
                {!narrow && (
                  <Pill
                    x={cabX + cw - 26}
                    y={(cabinTop + floorY) / 2 + 10 - st.a * kA - Math.sign(st.a) * 16}
                    text={L.tag.a(F(Math.abs(st.a)))}
                    bg={FC.a}
                    size={fs}
                    box={box}
                  />
                )}
              </>
            )}

            {/* scale of the force grid */}
            <text x={W - 10} y={H - 10} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#64748b">
              {L.cell(newtons(cell, dec))}
            </text>

            {showBars && <ForceBars L={L} T={T} x0={barsX0} x1={barsX1} base={scaleTop} kF={kF} mg={mg} P={P} a={st.a} m={m} fs={fs} />}

            {running && <circle cx={shX + shW / 2} cy={cabMid} r={shW * 0.55} fill="#7c3aed" className="cl-pulse" opacity="0.2" />}
          </>
        );
      }}
    </LabScene>
  );
}

/** The scale's reading, enlarged in a call-out joined to the scale's window. */
function LcdBubble({ x, y, toX, toY, label, value, fs, narrow }) {
  const w = narrow ? 70 : 92;
  const h = narrow ? 26 : 32;
  return (
    <g aria-hidden="true">
      <line x1={x + w / 2 - 6} y1={y + h / 2} x2={toX} y2={toY} stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 3" />
      <text x={x} y={y + h / 2 + 14} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {label}
      </text>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={6} fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <text x={x} y={y + (narrow ? 5 : 6)} textAnchor="middle" fontSize={narrow ? 14 : 17} fontWeight="800" fill="#4ade80" fontFamily="ui-monospace, Menlo, Consolas, monospace">
        {value}
      </text>
    </g>
  );
}

/** mg, N and P as bars on one force scale, with the difference ma marked. */
function ForceBars({ L, T, x0, x1, base, kF, mg, P, a, m, fs }) {
  const dec = T.decimal;
  const NN = (n) => newtons(n, dec);
  const bw = clamp((x1 - x0) * 0.12, 40, 56);
  const gp = clamp((x1 - x0) * 0.16, 52, 84);
  const total = 3 * bw + 2 * gp;
  const left = x0 + (x1 - x0 - total) / 2 - 20;
  const mgY = base - mg * kF;
  const bars = [
    { id: 'mg', F: mg, color: FC.mg, text: FC.mg },
    { id: 'N', F: P, color: FC.N, text: FC.N },
    { id: 'P', F: P, color: FC.P, text: FC.P },
  ];
  const ma = m * a;
  const diff = Math.abs(P - mg) * kF > 2;
  const pY = base - P * kF;
  return (
    <g aria-hidden="true">
      <text x={left + total / 2} y={Math.min(mgY, pY) - 40} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
        {L.bars.title}
      </text>
      <line x1={left - 14} x2={left + total + 14} y1={base} y2={base} stroke="#475569" strokeWidth="1.6" />
      {bars.map((b, i) => {
        const bx = left + i * (bw + gp);
        const top = base - b.F * kF;
        return (
          <g key={b.id}>
            <rect x={bx} y={top} width={bw} height={Math.max(0, base - top)} rx={4} fill={b.color} opacity="0.88" />
            <text x={bx + bw / 2} y={Math.min(top, mgY) - 7} textAnchor="middle" fontSize={fs} fontWeight="700" fill={b.text}>
              {NN(b.F)} {T.N}
            </text>
            <text x={bx + bw / 2} y={base + 18} textAnchor="middle" fontSize={fs + 2} fontStyle="italic" fontWeight="700" fill={b.text}>
              {b.id}
            </text>
            <text x={bx + bw / 2} y={base + 34} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
              {b.id === 'P' ? L.bars.onScale : L.bars.onPerson}
            </text>
            {diff && b.id !== 'mg' && (
              <rect
                x={bx + 1}
                y={Math.min(top, mgY)}
                width={bw - 2}
                height={Math.abs(mgY - top)}
                rx={3}
                fill={FC.a}
                fillOpacity={P > mg ? 0.55 : 0.12}
                stroke={FC.a}
                strokeWidth="1.6"
                strokeDasharray={P > mg ? undefined : '4 3'}
              />
            )}
          </g>
        );
      })}
      <line x1={left - 14} x2={left + total + 14} y1={mgY} y2={mgY} stroke={FC.mg} strokeWidth="1.4" strokeDasharray="5 4" />
      <text x={left - 18} y={mgY + 4} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill={FC.mg}>
        mg
      </text>
      {diff && (
        <text x={left + total + 18} y={(mgY + pY) / 2 + 4} fontSize={fs} fontWeight="700" fill="#c2410c">
          {L.bars.ma(num(ma, 0, dec))}
        </text>
      )}
      <text x={left + total / 2} y={base + 60} textAnchor="middle" fontSize={fs} fill="#334155">
        {L.bars.law2}
      </text>
      <text x={left + total / 2} y={base + 78} textAnchor="middle" fontSize={fs} fill="#334155">
        {L.bars.law3}
      </text>
    </g>
  );
}
