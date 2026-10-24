import { useState } from 'react';
import { ArrowDownToLine, Lightbulb, Scissors, Square, TrendingDown } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import { Apple, C, Chip, G, GroupLabel, Label, LabScene, LcdBox, PlayControls, Person, Vec, personGeometry } from './Weightlessness.parts';

/**
 * Tab 1 — a person on a bathroom scale in a lift, holding an apple. The lift
 * starts down with acceleration a: the scale reads P = m(g − a), the released
 * apple falls relative to the cabin with g − a. When the cable snaps (a = g)
 * the scale reads 0 and the apple hangs in the air, although mg is unchanged.
 * Left: the whole shaft; right: the cabin seen by a camera riding with it.
 */

const T_RUN = 2; // s of lift motion
const SLOW = 0.5; // screen time runs at half speed
const Y0 = 24; // m — the cabin floor starts at the 9th floor
const FLOOR = 3; // m between floors
const H_PERSON = 1.7; // m
const CW = 2.4; // m, cabin inner width
const CH = 2.5; // m, cabin inner height
const SCALE_H = 0.07; // m, bathroom scale height
const PX = 1.4; // m, person (and scale) position in the cabin
const APPLE_R = 0.045; // m
const PRESETS = [
  { id: 'rest', a: 0, icon: Square },
  { id: 'down', a: 2, icon: TrendingDown },
  { id: 'cut', a: G, icon: Scissors },
];
const IDLE = { t: 0, running: false, done: false };
const isFree = (a) => Math.abs(G - a) < 1e-9;

/** Apple release point in cabin metres (taken from the pictogram's hand). */
const HAND_Q = personGeometry('hold').armF[2];
const APPLE0 = { x: PX + HAND_Q.x * H_PERSON + 0.05, y: SCALE_H + HAND_Q.y * H_PERSON - 0.035 };

function appleY(rel, t) {
  return Math.max(APPLE_R, APPLE0.y - 0.5 * rel * t * t);
}

export default function LiftSim({ T }) {
  const L = T.lift;
  const dec = T.decimal;
  const [m, setM] = useState(50);
  const [a, setA] = useState(G);
  const [sim, setSim] = useState(IDLE);
  const started = sim.running || sim.t > 0;
  const aEff = started ? a : 0;
  const preset = PRESETS.find((p) => Math.abs(p.a - a) < 1e-9)?.id ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(T_RUN, p.t + dt * SLOW);
      const done = t >= T_RUN - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setA(PRESETS.find((p) => p.id === id).a);
    setSim(IDLE);
  };

  const t = sim.t;
  const mg = m * G;
  const P = m * (G - aEff);
  const v = aEff * t;
  const drop = 0.5 * aEff * t * t;
  const rel = G - aEff;
  const free = started && isFree(a);
  const F0 = (n) => fmt(n, 0, dec);
  const F1 = (n) => fmt(n, 1, dec);

  let key = 'idle';
  if (sim.done) key = free ? 'doneCut' : a < 1e-9 ? 'doneRest' : 'doneDown';
  else if (started) key = free ? 'cut' : a < 1e-9 ? 'rest' : 'down';
  const settled = useSettled(key, 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(F0(mg)),
    rest: ex.rest(F0(P)),
    down: ex.down(F1(a), F0(P), F1(rel)),
    cut: ex.cut(F0(mg)),
    doneRest: ex.doneRest(F0(P)),
    doneDown: ex.doneDown(F1(T_RUN), F1(drop), F1(v), F0(P), F0(mg)),
    doneCut: ex.doneCut(F1(T_RUN), F1(drop), F1(v), F0(v * 3.6)),
  }[settled];
  const tone = { idle: '#22d3ee', rest: '#94a3b8', down: '#c084fc', cut: '#f472b6', doneRest: '#34d399', doneDown: '#34d399', doneCut: '#34d399' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={preset}
            onChange={pick}
            accent="#c084fc"
            options={PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id].name, sub: L.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <LiftScene T={T} m={m} a={a} aEff={aEff} t={t} started={started} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.P}
          symbol="P"
          value={F0(P)}
          unit={T.common.N}
          accent={C.P}
          textColor={C.PText}
          active={free}
          sub={L.readouts.Psub(F1(P / G))}
        />
        <Readout label={L.readouts.mg} symbol="mg" value={F0(mg)} unit={T.common.N} accent={C.mg} textColor={C.mgText} sub={L.readouts.mgSub} />
        <Readout
          label={L.readouts.a}
          symbol="a"
          value={F1(aEff)}
          unit={T.ms2}
          accent={C.acc}
          textColor={C.accText}
          sub={started ? (aEff > 1e-9 ? L.readouts.aDown : L.readouts.aZero) : L.readouts.aWait}
        />
        <Readout
          label={L.readouts.v}
          symbol="v"
          value={F1(v)}
          unit={T.ms}
          accent={C.vel}
          textColor={C.velText}
          sub={L.readouts.vSub(F1(t), F1(drop))}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / T_RUN) * 100}%` }} />
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wl-lift-a"
            label={L.aSlider}
            symbol="a"
            min={0}
            max={G}
            step={0.2}
            value={a}
            onChange={(n) => {
              setA(Math.round(n * 10) / 10);
              setSim(IDLE);
            }}
            accent={C.acc}
            display={`${F1(a)} ${T.ms2}`}
            hint={a < 1e-9 ? L.aHint.zero : isFree(a) ? L.aHint.free : L.aHint.less}
          />
          <RangeField
            id="wl-lift-m"
            label={L.mSlider}
            symbol="m"
            min={30}
            max={90}
            step={5}
            value={m}
            onChange={setM}
            accent={C.P}
            display={`${F0(m)} ${T.common.kg}`}
            hint={L.mHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-relaxed">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.formulaTitle}</p>
            <p className="mt-1 tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">P = m(g − a)</span> = {F0(m)} · ({F1(G)} − {F1(aEff)}) ={' '}
              <b style={{ color: C.PText }}>{F0(P)}</b> {T.common.N}
            </p>
            <p className="tabular-nums text-gray-300">
              {L.appleRel} <span className="font-serif italic text-gray-100">g − a</span> = <b style={{ color: C.accText }}>{F1(rel)}</b> {T.ms2}
            </p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <PGraph T={T} m={m} aNow={aEff} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- graph */

function PGraph({ T, m, aNow }) {
  const L = T.lift.graph;
  const mg = m * G;
  const yMax = Math.ceil((mg * 1.08) / 100) * 100;
  return (
    <TimeGraph
      title={L.title}
      series={[
        { id: 'mg', label: L.mg, color: '#f87171', dash: '6 5', dot: false, points: [{ x: 0, y: mg }, { x: 10, y: mg }] },
        { id: 'P', label: L.P, color: '#c084fc', dot: false, points: [{ x: 0, y: mg }, { x: G, y: 0 }] },
        { id: 'now', label: L.now, color: '#f0abfc', points: [{ x: aNow, y: m * (G - aNow) }] },
      ]}
      xMax={10}
      yMax={yMax}
      xLabel={L.x}
      yLabel={L.y}
      marker={aNow > 0 ? aNow : undefined}
      xDigits={1}
      decimal={T.decimal}
      note={L.note}
      ariaLabel={L.label}
    />
  );
}

/* --------------------------------------------------------------- scene */

function LiftScene({ T, m, a, aEff, t, started, running }) {
  const L = T.lift;
  const dec = T.decimal;
  const mg = m * G;
  const P = m * (G - aEff);
  const v = aEff * t;
  const drop = 0.5 * aEff * t * t;
  const yc = Y0 - drop;
  const free = started && isFree(a);
  const cut = isFree(a);
  const rel = G - aEff;
  const yA = started ? appleY(rel, t) : APPLE0.y;
  const floating = free && yA > APPLE_R + 1e-6;
  const onFloor = yA <= APPLE_R + 1e-6;

  return (
    <LabScene
      legend={[
        { color: C.mg, label: L.legend.mg, kind: 'arrow' },
        { color: C.N, label: L.legend.N, kind: 'arrow' },
        { color: C.P, label: L.legend.P, kind: 'arrow' },
        { color: C.vel, label: L.legend.v, kind: 'arrow' },
        { color: C.acc, label: L.legend.a, kind: 'arrow' },
      ]}
      chips={
        <>
          <Chip>
            {L.slowChip} · t = {fmt(t, 2, dec)} {T.s}
          </Chip>
          {free && (
            <Chip icon={ArrowDownToLine} color="#db2777" strong>
              {L.freeChip}
            </Chip>
          )}
        </>
      }
      height={(W, narrow) => (narrow ? 440 : 520)}
      ariaLabel={L.sceneLabel(fmt(P, 0, dec), fmt(drop, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const top = narrow ? 50 : 62;
        const bottom = 22;

        /* ---- shaft overview (left) */
        const SW = narrow ? 92 : clamp(W * 0.25, 170, 280);
        const ks = (H - top - bottom) / 31.6;
        const bw = narrow ? 5.4 : 8.6;
        const bx = narrow ? 56 : SW * 0.55;
        const sY = (y) => H - bottom - y * ks;
        const sX = (x) => bx + x * ks;
        const shaftHalf = 1.4;
        const cabW = 2.2;
        const cabH = 2.6;
        const ghosts = [];
        for (let k = 1; k * 0.5 <= t + 1e-9 && k <= 4; k += 1) ghosts.push(Y0 - 0.5 * aEff * (k * 0.5) ** 2);

        /* ---- cabin interior (right) */
        const IX0 = SW + (narrow ? 8 : 26);
        const IX1 = W - (narrow ? 8 : 18);
        const below = 0.52;
        const above = 0.4;
        const share = narrow ? 1 : 0.6;
        const ki = Math.min(((IX1 - IX0) * share) / (CW + 0.55), (H - top - bottom) / (CH + below + above));
        const cabinW = CW * ki;
        const cx0 = narrow ? IX0 + (IX1 - IX0 - cabinW) / 2 + 4 : IX0 + ((IX1 - IX0) * share - cabinW) / 2;
        const floorY = H - bottom - below * ki;
        const iX = (x) => cx0 + x * ki;
        const iY = (y) => floorY - y * ki;
        const wall = 0.07 * ki;
        const kF = (ki * 0.8) / 1000; // px per newton: 1000 N ↔ 0.8 m of cabin
        const pxP = iX(PX);
        const hPx = H_PERSON * ki;
        const feetY = iY(SCALE_H);
        const cmY = iY(SCALE_H + 0.52 * H_PERSON);
        const appleX = iX(APPLE0.x);
        const appleY0 = iY(yA);
        const ar = APPLE_R * ki * 1.25;

        /* the shaft wall seen through the cabin window, moving up as the cabin falls */
        const win = { x0: 0.14, x1: 0.82, y0: 1.0, y1: 2.15 };
        const slabs = [];
        for (let n = 1; n <= 11; n += 1) {
          const rel0 = (n - 1) * FLOOR - yc;
          if (rel0 > win.y0 - 2.6 && rel0 < win.y1 + 0.4) slabs.push({ n, rel: rel0 });
        }

        const showN = P > 0.5;
        const lcd = narrow
          ? { x: iX(CW) - Math.min(104, cabinW * 0.46) - 6, y: iY(CH) + 6, w: Math.min(104, cabinW * 0.46), h: 42 }
          : { x: iX(CW) + 70, y: iY(0.95), w: 190, h: 78 };

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />

            {/* ================= shaft overview */}
            <g aria-hidden="true">
              {[0, 10, 20, 30].map((y) => (
                <g key={`ax${y}`}>
                  <line x1={narrow ? 16 : 30} x2={sX(-bw / 2) - 3} y1={sY(y)} y2={sY(y)} stroke="#e2e8f0" />
                  <text x={narrow ? 3 : 8} y={sY(y) + 4} fontSize={fs - 1} fill={C.muted} fontWeight={y === 0 ? 700 : 400}>
                    {y}
                  </text>
                </g>
              ))}
              <text x={narrow ? 3 : 8} y={sY(31.2)} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {L.axisH}
              </text>
              {/* ground */}
              <rect x={sX(-bw / 2) - 14} y={sY(0)} width={bw * ks + 28} height={bottom} fill="#e7e5e4" />
              <line x1={sX(-bw / 2) - 14} x2={sX(bw / 2) + 14} y1={sY(0)} y2={sY(0)} stroke="#57534e" strokeWidth={2} />
              {/* building */}
              <rect x={sX(-bw / 2)} y={sY(30)} width={bw * ks} height={30 * ks} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />
              <rect x={sX(-1.8)} y={sY(31.4)} width={3.6 * ks} height={1.4 * ks} fill="#cbd5e1" stroke="#94a3b8" />
              {Array.from({ length: 10 }, (_, i) => i).map((i) => (
                <g key={`fl${i}`}>
                  <line x1={sX(-bw / 2)} x2={sX(bw / 2)} y1={sY(i * FLOOR)} y2={sY(i * FLOOR)} stroke="#cbd5e1" />
                  {!narrow && (
                    <text x={sX(-bw / 2) + 5} y={sY(i * FLOOR + 1.1)} fontSize={fs - 2} fill="#94a3b8">
                      {i + 1}
                    </text>
                  )}
                </g>
              ))}
              {/* shaft */}
              <rect x={sX(-shaftHalf)} y={sY(30)} width={2 * shaftHalf * ks} height={30 * ks} fill="#e2e8f0" stroke="#94a3b8" strokeDasharray="3 3" />
              {/* cable */}
              {cut && started ? (
                <>
                  <line x1={sX(0)} x2={sX(0)} y1={sY(30)} y2={sY(Y0 + cabH + 0.9)} stroke="#475569" strokeWidth={1.5} />
                  <path
                    d={`M${sX(0)},${sY(Y0 + cabH + 0.9)} l-2,4 l3,2 l-2,3`}
                    fill="none"
                    stroke="#475569"
                    strokeWidth={1.5}
                  />
                </>
              ) : (
                <line x1={sX(0)} x2={sX(0)} y1={sY(30)} y2={sY(yc + cabH)} stroke="#475569" strokeWidth={1.5} />
              )}
              {/* strobe ghosts every 0.5 s */}
              {ghosts.map((y, i) => (
                <rect
                  key={`g${i}`}
                  x={sX(-cabW / 2)}
                  y={sY(y + cabH)}
                  width={cabW * ks}
                  height={cabH * ks}
                  fill="none"
                  stroke="#a855f7"
                  strokeOpacity="0.45"
                  strokeDasharray="3 2"
                />
              ))}
              {/* the cabin */}
              <rect x={sX(-cabW / 2)} y={sY(yc + cabH)} width={cabW * ks} height={cabH * ks} rx={2} fill={free ? '#f5d0fe' : '#e9d5ff'} stroke="#7e22ce" strokeWidth={1.8} />
              <rect x={sX(-cabW / 2) + 3} y={sY(yc + cabH) + 3} width={cabW * ks - 6} height={cabH * ks * 0.45} rx={1} fill="#fff" opacity="0.7" />
            </g>
            {/* v and a next to the cabin */}
            {(() => {
              const ax = narrow ? sX(shaftHalf) + 8 : sX(bw / 2) + 14;
              const vx = narrow ? sX(shaftHalf) + 17 : sX(bw / 2) + 34;
              const y = sY(yc + cabH * 0.75);
              const vk = narrow ? 2.6 : 3.6;
              const ak = narrow ? 3.4 : 4.6;
              return (
                <>
                  {aEff > 1e-9 && started && <Vec x={ax} y={y} dx={0} dy={aEff * ak} color={C.acc} width={2.5} head={8} label={narrow ? 'a' : 'a'} size={fs} gap={6} />}
                  {v > 0.05 && <Vec x={vx} y={y} dx={0} dy={v * vk} color={C.vel} width={2.5} head={8} label="v" size={fs} gap={6} />}
                </>
              );
            })()}
            {drop > 0.3 && !narrow && (
              <Label x={sX(-bw / 2) - 6} y={sY(yc + cabH * 0.5) + 4} anchor="end" size={fs - 1} color="#7e22ce" weight={600}>
                {L.dropTag(fmt(drop, 1, dec))}
              </Label>
            )}

            {/* divider */}
            <line x1={SW + (narrow ? 2 : 10)} x2={SW + (narrow ? 2 : 10)} y1={top - 6} y2={H - 10} stroke="#e2e8f0" strokeDasharray="4 4" />
            {!narrow && (
              <Label x={iX(CW / 2) + 12} y={top + 4} anchor="start" size={fs - 1} color="#64748b" weight={600}>
                {L.insideTag}
              </Label>
            )}

            {/* ================= cabin interior */}
            <defs>
              <clipPath id="wl-lift-win">
                <rect x={iX(win.x0)} y={iY(win.y1)} width={(win.x1 - win.x0) * ki} height={(win.y1 - win.y0) * ki} rx={4} />
              </clipPath>
              <linearGradient id="wl-lift-wall" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#f8fafc" />
                <stop offset="1" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            {/* cable or a snapped stub */}
            {cut && started ? (
              <path
                d={`M${iX(CW / 2)},${iY(CH) - wall} l0,${-0.22 * ki} l-4,5 l5,4 l-4,5`}
                fill="none"
                stroke="#475569"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            ) : (
              <line x1={iX(CW / 2)} x2={iX(CW / 2)} y1={top - 4} y2={iY(CH) - wall} stroke="#475569" strokeWidth={3} />
            )}
            {/* shell */}
            <rect x={iX(0) - wall} y={iY(CH) - wall} width={cabinW + 2 * wall} height={(CH + 0.14) * ki + wall} rx={6} fill="#94a3b8" />
            <rect x={iX(0)} y={iY(CH)} width={cabinW} height={CH * ki} fill="url(#wl-lift-wall)" />
            {/* window to the shaft wall */}
            <g clipPath="url(#wl-lift-win)">
              <rect x={iX(win.x0)} y={iY(win.y1)} width={(win.x1 - win.x0) * ki} height={(win.y1 - win.y0) * ki} fill="#d6d3d1" />
              {slabs.map((s) => (
                <g key={`s${s.n}`}>
                  <rect x={iX(win.x0)} y={iY(s.rel)} width={(win.x1 - win.x0) * ki} height={0.22 * ki} fill="#78716c" />
                  <text x={iX((win.x0 + win.x1) / 2)} y={iY(s.rel + 1.25)} textAnchor="middle" fontSize={0.42 * ki} fontWeight="800" fill="#a8a29e">
                    {s.n}
                  </text>
                </g>
              ))}
            </g>
            <rect x={iX(win.x0)} y={iY(win.y1)} width={(win.x1 - win.x0) * ki} height={(win.y1 - win.y0) * ki} rx={4} fill="none" stroke="#64748b" strokeWidth={2} />
            <Label x={iX((win.x0 + win.x1) / 2)} y={iY(win.y0) + fs + 4} size={fs - 2} color="#64748b" weight={600}>
              {L.windowTag}
            </Label>
            {/* handrail */}
            <line x1={iX(0.05)} x2={iX(CW - 0.05)} y1={iY(0.95)} y2={iY(0.95)} stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" />
            {/* floor slab */}
            <rect x={iX(0) - wall} y={iY(0)} width={cabinW + 2 * wall} height={0.12 * ki} fill="#475569" />

            {/* bathroom scale */}
            <rect x={iX(PX - 0.22)} y={iY(SCALE_H)} width={0.44 * ki} height={SCALE_H * ki} rx={3} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
            <rect x={iX(PX + 0.12)} y={iY(SCALE_H) + 2} width={0.07 * ki} height={SCALE_H * ki - 4} rx={1} fill="#0b2e1d" />

            {/* the person */}
            <Person x={pxP} y={feetY} h={hPx} pose="hold" shirt="#0ea5e9" />

            {/* the apple */}
            {floating && (
              <circle cx={appleX} cy={appleY0} r={ar * 2.1} fill="none" stroke="#db2777" strokeWidth={1.5} strokeDasharray="3 3" />
            )}
            <Apple x={appleX} y={appleY0} r={ar} />
            {floating && (
              <Label x={appleX} y={appleY0 - ar * 2.1 - 6} size={fs - 1} color="#be185d">
                {L.floatTag}
              </Label>
            )}
            {started && !free && !onFloor && rel > 0 && (
              <Label x={appleX + ar + 8} y={appleY0 + 4} anchor="start" size={fs - 1} color="#b45309" weight={600}>
                {L.relTag(fmt(rel, 1, dec))}
              </Label>
            )}

            {/* forces: gravity at the centre of mass, N on the feet, P on the scale */}
            <Vec x={pxP} y={cmY} dx={0} dy={mg * kF} color={C.mg} label={L.tags.mg(fmt(mg, 0, dec))} place="right" size={fs} width={narrow ? 3 : 3.5} head={narrow ? 9 : 12} />
            {showN ? (
              <>
                <Vec
                  x={pxP - 0.07 * ki}
                  y={feetY}
                  dx={0}
                  dy={-P * kF}
                  color={C.N}
                  label={L.tags.N(fmt(P, 0, dec))}
                  place="left"
                  size={fs}
                  width={narrow ? 3 : 3.5}
                  head={narrow ? 9 : 12}
                />
                <Vec
                  x={pxP + 0.09 * ki}
                  y={feetY + 1}
                  dx={0}
                  dy={P * kF}
                  color={C.P}
                  label={L.tags.P(fmt(P, 0, dec))}
                  place="right"
                  size={fs}
                  width={narrow ? 3 : 3.5}
                  head={narrow ? 9 : 12}
                />
              </>
            ) : (
              <>
                <Pill x={pxP - 0.42 * ki} y={iY(0.42)} text={L.tags.N0} bg={C.N} size={fs - 1} />
                <Pill x={pxP + 0.42 * ki} y={iY(-0.24)} text={L.tags.P0} bg={C.P} size={fs - 1} />
              </>
            )}

            {/* cabin acceleration, outside the right wall */}
            {aEff > 1e-9 && (
              <Vec
                x={iX(CW) + wall + (narrow ? 10 : 16)}
                y={iY(CH * 0.8)}
                dx={0}
                dy={aEff * (narrow ? 5 : 7)}
                color={C.acc}
                label={narrow ? 'a' : L.tags.a(fmt(aEff, 1, dec))}
                place={narrow ? 'tip' : 'right'}
                size={fs}
                width={3}
                head={10}
              />
            )}

            {/* the scale's display */}
            {!narrow && <line x1={iX(PX + 0.2)} y1={iY(SCALE_H / 2)} x2={lcd.x} y2={lcd.y + lcd.h * 0.6} stroke="#94a3b8" strokeDasharray="3 3" />}
            <LcdBox x={lcd.x} y={lcd.y} w={lcd.w} h={lcd.h} value={fmt(P / G, 1, dec)} unit={T.common.kg} caption={narrow ? undefined : L.lcdCaption} dim={P < 0.5} />
            {!narrow && (
              <>
                <text x={lcd.x} y={lcd.y + lcd.h + 20} fontSize={fs} fill="#475569">
                  {L.lcdNote(fmt(P, 0, dec), fmt(G, 1, dec))}
                </text>
                <g transform={`translate(${lcd.x} ${lcd.y + lcd.h + 44})`}>
                  <line x1={0} x2={200 * kF} y1={0} y2={0} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
                  <line x1={0} x2={0} y1={-5} y2={5} stroke={C.ink} strokeWidth={1.5} />
                  <line x1={200 * kF} x2={200 * kF} y1={-5} y2={5} stroke={C.ink} strokeWidth={1.5} />
                  <text x={200 * kF + 8} y={4} fontSize={fs - 1} fill="#475569">
                    {L.scaleTag(200)}
                  </text>
                </g>
              </>
            )}
            {narrow && (
              <g transform={`translate(${IX0 + 2} ${H - 8})`}>
                <ScaleBarSvg px={200 * kF} />
                <text x={200 * kF + 8} y={0} fontSize={fs - 1} fill="#475569">
                  {L.scaleTag(200)}
                </text>
              </g>
            )}

            {running && floating && <circle cx={appleX} cy={appleY0} r={ar * 1.6} fill="#db2777" className="cl-pulse" opacity="0.35" />}
          </>
        );
      }}
    </LabScene>
  );
}

function ScaleBarSvg({ px }) {
  return (
    <g>
      <line x1={0} x2={px} y1={-4} y2={-4} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
      <line x1={0} x2={0} y1={-8} y2={0} stroke={C.ink} strokeWidth={1.5} />
      <line x1={px} x2={px} y1={-8} y2={0} stroke={C.ink} strokeWidth={1.5} />
    </g>
  );
}
