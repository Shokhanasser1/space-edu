import { useState } from 'react';
import { ArrowUpFromLine, Lightbulb, Package, Timer, Weight } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import {
  Chip,
  DimLine,
  EC,
  ForceArrow,
  Formula,
  G,
  GroupLabel,
  Ground,
  HaloText,
  InfoBox,
  LabScene,
  PaperGrid,
  PlayControls,
  RichPill,
  ScaleBar,
  SidePill,
  niceAxis,
  plain,
  rich,
  richSvg,
  smart,
} from './PotentialEnergy.parts';

/**
 * Tab 1 — a tower crane lifts a crate past the storeys of a building (3 m
 * each). The crane pulls with F = mg (it lifts at a steady 1 m/s, so a = 0)
 * and does the work A = F·h = mgh; that work is stored in the crate as
 * potential energy E_p = mgh, measured from the ground (the zero level).
 * Preset 10 kg to 5 m: E_p = 10 · 9.8 · 5 = 490 J; twice the height or twice
 * the mass gives 980 J. Each storey adds mg · 3 J (294 J for 10 kg).
 * The bars of the energy panel use the overview's own metre scale, so their
 * tops sit exactly at the crate's height. Strings come from T.lift.
 */

const FLOOR_H = 3; // m per storey
const FLOORS = 6;
const H_MAX = FLOORS * FLOOR_H; // 18 m: the roof
const V_HOIST = 1; // m/s, steady hoisting speed
const SPEEDUP = 2; // the animation runs twice as fast as real time
const M_MIN = 1;
const M_MAX = 40;
const CRATE_W = 1.4; // m (drawn a little larger than a real 10 kg crate, for visibility)
const CRATE_H = 1.1;
const SLING = 0.9;
const IDLE = { y: 0, running: false, done: false, dir: 0 };

/** World box of the overview (metres): building on the left, crane on the right. */
const WX0 = -11;
const WX1 = 9.2;
const WX1_N = 6.4;
const WORLD_TOP = 24.4;
const AXIS_W = 40;
const AXIS_W_N = 30;
const STRIP_W = 66;

const PRESETS = [
  { id: 'base', m: 10, h: 5, icon: Package },
  { id: 'h2', m: 10, h: 10, icon: ArrowUpFromLine },
  { id: 'm2', m: 20, h: 5, icon: Weight },
];

const TONES = { idle: '#22d3ee', up: '#60a5fa', down: '#fbbf24', paused: '#a78bfa', done: '#34d399', ground: '#22d3ee' };

export default function LiftSim({ T }) {
  const L = T.lift;
  const dec = T.decimal;
  const [m, setM] = useState(10);
  const [h, setH] = useState(5);
  const [sim, setSim] = useState(IDLE);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const step = V_HOIST * SPEEDUP * dt;
      const d = h - p.y;
      if (Math.abs(d) <= step) return { y: h, running: false, done: true, dir: 0 };
      return { y: p.y + Math.sign(d) * step, running: true, done: false, dir: Math.sign(d) };
    });
  });

  const atTarget = Math.abs(sim.y - h) < 1e-6;
  const toggle = () => {
    if (sim.running) setSim((p) => ({ ...p, running: false }));
    else if (atTarget) setSim({ ...IDLE, running: h > 0 });
    else setSim((p) => ({ ...p, running: true, done: false }));
  };
  const reset = () => setSim(IDLE);
  const changeH = (n) => {
    setH(n);
    // once the crate has left the ground the crane follows the slider at once
    if (sim.y > 1e-6 || sim.running) setSim((p) => ({ ...p, running: Math.abs(p.y - n) > 1e-6, done: Math.abs(p.y - n) <= 1e-6 }));
  };
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setM(p.m);
    setH(p.h);
    setSim(IDLE);
  };

  const y = sim.y;
  const mg = m * G;
  const E = mg * y;
  const preset = PRESETS.find((p) => p.m === m && p.h === h)?.id ?? null;

  /* ---- explanation */
  let key = 'idle';
  if (sim.running) key = sim.dir < 0 ? 'down' : 'up';
  else if (sim.done) key = y < 1e-6 ? 'ground' : 'done';
  else if (y > 1e-6) key = 'paused';
  const settled = useSettled(key, key === 'up' || key === 'down' ? 220 : 0);
  const ex = L.explain;
  const S = (n) => smart(n, dec);
  const vals = {
    m: S(m),
    h: S(h),
    y: fmt(y, 1, dec),
    g: fmt(G, 1, dec),
    mg: S(mg),
    floor: S(mg * FLOOR_H),
    E: S(mg * h),
    Ey: fmt(E, 1, dec),
    Ebase: S(10 * G * 5),
  };
  let text;
  if (settled === 'done') text = (ex.done[preset] ?? ex.done.other)(vals);
  else text = ex[settled](vals);
  const tone = TONES[settled] ?? '#22d3ee';

  /* ---- where is the crate */
  let where = L.where.ground;
  if (y >= H_MAX - 1e-6) where = L.where.roof;
  else if (y > 1e-6) where = L.where.storey(Math.min(FLOORS, Math.floor(y / FLOOR_H + 1e-9) + 1));

  /* ---- graph */
  const yAx = niceAxis(mg * H_MAX);
  const series = [
    { id: 'line', label: L.graph.line, color: 'rgba(147,197,253,0.45)', points: [{ x: 0, y: 0 }, { x: H_MAX, y: mg * H_MAX }], dash: '5 5', dot: false },
    { id: 'now', label: L.graph.now, color: '#60a5fa', points: [{ x: 0, y: 0 }, { x: y, y: E }] },
  ];

  const playLabels = { ...T.common, start: sim.y > h ? L.lower : L.lift, resume: sim.y > h ? L.lower : L.lift };

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
            onChange={pickPreset}
            options={PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id].name, sub: L.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls
          labels={playLabels}
          running={sim.running}
          done={sim.done && atTarget && y > 1e-6}
          started={y > 1e-6 && !atTarget}
          onToggle={toggle}
          onReset={reset}
          disabled={!sim.running && atTarget && h === 0}
        />
      </div>

      <LiftScene T={T} m={m} h={h} y={y} running={sim.running} dir={sim.dir} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.h} symbol="h" value={fmt(y, 1, dec)} unit={T.m} accent={EC.ep} textColor="#bfdbfe" sub={where} />
        <Readout label={L.readouts.mg} symbol="mg" value={S(mg)} unit={T.N} accent={EC.mg} textColor={EC.mgText} sub={L.mgSub(S(mg))} />
        <Readout
          label={L.readouts.ep}
          symbol={rich('E_p')}
          value={fmt(E, 1, dec)}
          unit={T.J}
          accent={EC.ep}
          textColor={EC.epText}
          active={y > 1e-6}
          sub={rich(L.epSub(fmt(E / 1000, 2, dec)))}
        />
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[17px] text-gray-100">
              <Formula text="E_p = mgh" />
            </p>
            <p className="tabular-nums text-gray-400">
              = {S(m)} · {fmt(G, 1, dec)} · {fmt(y, 1, dec)} = <b style={{ color: EC.epText }}>{fmt(E, 1, dec)}</b> {T.J}
            </p>
            <p className="text-xs text-gray-500">{L.formulaNote}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="pe-lift-m"
            label={L.mass}
            symbol="m"
            min={M_MIN}
            max={M_MAX}
            step={1}
            value={m}
            onChange={setM}
            accent={EC.mg}
            display={`${S(m)} ${T.kg}`}
            hint={L.massHint(S(mg))}
          />
          <RangeField
            id="pe-lift-h"
            label={L.height}
            symbol="h"
            min={0}
            max={H_MAX}
            step={0.5}
            value={h}
            onChange={changeH}
            accent={EC.ep}
            display={`${fmt(h, 1, dec)} ${T.m}`}
            valueText={`${fmt(h, 1, dec)} ${T.m}`}
            hint={L.heightHint}
          />
          <InfoBox title={L.info.title}>
            <p className="tabular-nums">{rich(L.info.floor(S(mg), S(mg * FLOOR_H)))}</p>
            <p className="mt-1 text-gray-400">{rich(L.info.uniform)}</p>
          </InfoBox>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={rich(L.graph.title)}
            series={series.map((s) => ({ ...s, label: rich(s.label) }))}
            xMax={20}
            yMax={yAx.max}
            yDigits={yAx.digits}
            xLabel={L.graph.x}
            yLabel={richSvg(L.graph.y, 11)}
            marker={h}
            decimal={dec}
            ariaLabel={L.graph.label}
            note={rich(L.graph.note)}
            height={230}
            onScrub={(x) => changeH(clamp(Math.round(x * 2) / 2, 0, H_MAX))}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

function sceneHeight(W, narrow) {
  if (!narrow) return 520;
  const Wo = W - STRIP_W;
  const k = (Wo - AXIS_W_N - 6) / (WX1_N - WX0);
  return clamp(44 + 28 + WORLD_TOP * k, 330, 470);
}

function LiftScene({ T, m, h, y, running, dir }) {
  const L = T.lift;
  const dec = T.decimal;
  const mg = m * G;
  const E = mg * y;
  const S = (n) => smart(n, dec);

  return (
    <LabScene
      legend={[
        { color: EC.mg, label: L.legend.mg, kind: 'arrow' },
        { color: EC.F, label: L.legend.F, kind: 'arrow' },
        { color: EC.v, label: L.legend.v, kind: 'arrow' },
        { color: EC.ep, label: L.legend.ep, kind: 'bar' },
        { color: '#94a3b8', label: L.legend.floor, kind: 'dash' },
      ]}
      chips={
        <Chip icon={Timer}>
          {L.chip(SPEEDUP, fmt(V_HOIST, 0, dec))}
        </Chip>
      }
      height={sceneHeight}
      ariaLabel={plain(L.sceneLabel(fmt(y, 1, dec), fmt(E, 1, dec)))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const topPad = narrow ? 44 : 66;
        const groundY = H - (narrow ? 28 : 36);
        const Wo = narrow ? W - STRIP_W : Math.round(clamp(W * 0.42, 330, 470));
        const Wc = narrow ? 0 : Math.round(clamp(W * 0.21, 176, 236));
        const axisW = narrow ? AXIS_W_N : AXIS_W;
        const wx1 = narrow ? WX1_N : WX1;
        const k = Math.min((Wo - axisW - 6) / (wx1 - WX0), (groundY - topPad) / WORLD_TOP);
        const ox = axisW + (Wo - axisW - (wx1 - WX0) * k) / 2 - WX0 * k;
        const sx = (xm) => ox + xm * k;
        const sy = (ym) => groundY - ym * k;
        const nCell = Math.max(1, Math.floor((FLOOR_H * k) / 22));
        const cellM = FLOOR_H / nCell;

        /* crate & rigging */
        const cTop = y + CRATE_H;
        const hookY = cTop + SLING;
        const crX0 = sx(-CRATE_W / 2);
        const crX1 = sx(CRATE_W / 2);
        const crY0 = sy(cTop);
        const crY1 = sy(y);
        const crMidY = (crY0 + crY1) / 2;
        const curStorey = y >= H_MAX - 1e-6 ? -1 : Math.floor(y / FLOOR_H + 1e-9) + 1;
        const dimX = sx(1.3);
        const dimLen = groundY - crY1;
        const showTarget = Math.abs(h - y) > 0.05;

        return (
          <>
            <defs>
              <clipPath id="pe-lift-ov">
                <rect x={0} y={0} width={Wo} height={H} />
              </clipPath>
              <linearGradient id="pe-lift-wood" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#e3b574" />
                <stop offset="1" stopColor="#c98f45" />
              </linearGradient>
            </defs>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={W} y1={groundY} cell={cellM * k} ax={sx(0)} ay={groundY} />

            {/* storey levels, carried across to the energy panel */}
            {Array.from({ length: FLOORS }, (_, i) => (
              <line
                key={`fl${i}`}
                x1={sx(-1.4)}
                x2={W}
                y1={sy((i + 1) * FLOOR_H)}
                y2={sy((i + 1) * FLOOR_H)}
                stroke="#94a3b8"
                strokeOpacity="0.55"
                strokeDasharray="3 5"
              />
            ))}

            <g clipPath="url(#pe-lift-ov)">
              <Building sx={sx} sy={sy} k={k} fs={fs} cur={curStorey} />
              <Crane sx={sx} sy={sy} k={k} />

              {/* target height */}
              {showTarget && (
                <g aria-hidden="true">
                  <line x1={sx(-1.25)} x2={sx(2.3)} y1={sy(h)} y2={sy(h)} stroke={EC.ep} strokeWidth="2" strokeDasharray="6 4" />
                  <rect x={crX0} y={sy(h + CRATE_H)} width={crX1 - crX0} height={CRATE_H * k} rx={2} fill="none" stroke={EC.ep} strokeWidth="1.4" strokeDasharray="4 3" />
                </g>
              )}

              {/* cable, hook, slings */}
              <line x1={sx(0)} x2={sx(0)} y1={sy(20.3)} y2={sy(hookY + 0.32)} stroke="#334155" strokeWidth="1.6" />
              <rect x={sx(-0.24)} y={sy(hookY + 0.36)} width={0.48 * k} height={0.3 * k} rx={1.5} fill="#475569" />
              <path
                d={`M${sx(0)},${sy(hookY + 0.06)} q${0.22 * k},${0.12 * k} 0,${0.24 * k} q${-0.18 * k},${-0.04 * k} ${-0.14 * k},${-0.16 * k}`}
                fill="none"
                stroke="#334155"
                strokeWidth="1.6"
              />
              <line x1={sx(0)} y1={sy(hookY - 0.08)} x2={sx(-0.6)} y2={crY0} stroke="#475569" strokeWidth="1.2" />
              <line x1={sx(0)} y1={sy(hookY - 0.08)} x2={sx(0.6)} y2={crY0} stroke="#475569" strokeWidth="1.2" />

              {running && <circle cx={sx(0)} cy={crMidY} r={CRATE_W * k * 0.75} fill={EC.ep} opacity="0.22" className="cl-pulse" />}
              <Crate x0={crX0} x1={crX1} y0={crY0} y1={crY1} />

              {/* height of the crate above the zero level */}
              {y > 0.02 && <DimLine x={dimX} y1={groundY} y2={crY1 + 1} color={EC.ep} />}
              {dimLen > 50 && (
                <RichPill x={dimX + 7} y={(groundY + crY1) / 2} anchor="start" text={L.hTag(fmt(y, 1, dec))} bg="#ffffff" color={EC.ep} border={EC.ep} size={fs} box={box} />
              )}
              <SidePill x={crX0} y={crMidY} side={-1} gap={6} text={L.mTag(S(m))} bg={EC.ink} fs={fs} box={box} />
              <RichPill
                x={dimX + 7}
                y={dimLen > 50 && dimLen < 90 ? crMidY - 14 : crMidY}
                anchor="start"
                text={L.epTag(fmt(E, 1, dec))}
                bg={EC.ep}
                size={fs}
                box={{ w: Wo, h: H }}
              />
              {showTarget && !narrow && Math.abs(h - y) > 3 && (
                <HaloText x={sx(2.3) + 5} y={sy(h) + 4} size={fs - 1} fill={EC.ep}>
                  {L.target(fmt(h, 1, dec))}
                </HaloText>
              )}
            </g>

            {/* ground and h axis */}
            <Ground x0={0} x1={Wo} y={groundY} depth={H - groundY} />
            <g aria-hidden="true">
              <rect x={0} y={topPad - 20} width={axisW - 2} height={groundY - topPad + 20} fill="#fbfcfe" opacity="0.85" />
              <line x1={axisW - 2} x2={axisW - 2} y1={sy(H_MAX + 1)} y2={groundY} stroke="#94a3b8" />
              {Array.from({ length: FLOORS + 1 }, (_, i) => (
                <g key={`ax${i}`}>
                  <line x1={axisW - 7} x2={axisW - 2} y1={sy(i * FLOOR_H)} y2={sy(i * FLOOR_H)} stroke="#64748b" />
                  <text x={axisW - 9} y={sy(i * FLOOR_H) + 4} textAnchor="end" fontSize={fs - 1} fill={i === 0 ? EC.ink : EC.muted} fontWeight={i === 0 ? 700 : 400}>
                    {i * FLOOR_H}
                  </text>
                </g>
              ))}
              <text x={4} y={sy(H_MAX + 1) - 6} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {L.axisH}
              </text>
            </g>
            {!narrow && (
              <text x={Wo - 8} y={H - 10} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#64748b">
                {L.cell(smart(cellM, dec))}
              </text>
            )}

            {narrow ? (
              <EnergyStrip T={T} x0={Wo + 4} x1={W - 4} sy={sy} groundY={groundY} y={y} h={h} mg={mg} fs={fs} />
            ) : (
              <>
                <CloseUp L={L} T={T} x0={Wo + 12} x1={Wo + Wc - 4} top={topPad - 4} bottom={groundY + 10} m={m} running={running} dir={dir} fs={fs} />
                <EnergyBars L={L} T={T} x0={Wo + Wc + 8} x1={W - 14} top={topPad} sy={sy} groundY={groundY} y={y} h={h} mg={mg} fs={fs} />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* ------------------------------------------------------------- drawings */

function Building({ sx, sy, k, fs, cur }) {
  const bx0 = sx(-10);
  const bx1 = sx(-1.4);
  const top = sy(H_MAX);
  return (
    <g aria-hidden="true">
      <rect x={sx(-10.25)} y={sy(H_MAX + 0.7)} width={sx(-1.15) - sx(-10.25)} height={0.7 * k} fill="#cbd5e1" stroke="#94a3b8" />
      <rect x={bx0} y={top} width={bx1 - bx0} height={sy(0) - top} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.2" />
      {Array.from({ length: FLOORS }, (_, i) => {
        const base = i * FLOOR_H;
        return (
          <g key={`st${i}`}>
            {i > 0 && <rect x={bx0} y={sy(base) - 1.5} width={bx1 - bx0} height={3} fill="#e2e8f0" />}
            {[0, 1, 2].map((j) => {
              const wx = -9.05 + j * 2.55;
              if (i === 0 && j === 1) {
                return <rect key={`d${j}`} x={sx(wx)} y={sy(base + 2.3)} width={1.6 * k} height={2.3 * k} rx={1} fill="#94a3b8" />;
              }
              return (
                <g key={`w${j}`}>
                  <rect x={sx(wx)} y={sy(base + 2.4)} width={1.6 * k} height={1.5 * k} rx={1} fill="#dbeafe" stroke="#94a3b8" strokeWidth="0.8" />
                  <line x1={sx(wx + 0.8)} x2={sx(wx + 0.8)} y1={sy(base + 2.4)} y2={sy(base + 0.9)} stroke="#94a3b8" strokeWidth="0.8" />
                </g>
              );
            })}
            <text
              x={bx1 - 4}
              y={sy(base + 1.5) + 4}
              textAnchor="end"
              fontSize={fs - 2}
              fontWeight={cur === i + 1 ? 800 : 500}
              fill={cur === i + 1 ? EC.ink : '#94a3b8'}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const CRANE = { fill: '#facc15', line: '#a16207' };

function Crane({ sx, sy, k }) {
  const mast0 = 3.2;
  const mast1 = 4.2;
  const jibB = 20.6;
  const jibT = 21.4;
  const mastPts = [];
  for (let yy = 0.5; yy < jibB - 0.01; yy += 1) {
    const y2 = Math.min(jibB, yy + 1);
    mastPts.push(`M${sx(mast0)},${sy(yy)} L${sx(mast1)},${sy(y2)} M${sx(mast1)},${sy(yy)} L${sx(mast0)},${sy(y2)}`);
  }
  const jib = [];
  for (let xx = -1.8; xx < mast0 - 0.01; xx += 0.8) {
    jib.push(`M${sx(xx)},${sy(jibB)} L${sx(xx + 0.4)},${sy(jibT)} L${sx(Math.min(mast0, xx + 0.8))},${sy(jibB)}`);
  }
  const cjib = [];
  for (let xx = mast1; xx < 8.6 - 0.01; xx += 0.8) {
    cjib.push(`M${sx(xx)},${sy(jibB)} L${sx(xx + 0.4)},${sy(21.1)} L${sx(Math.min(8.6, xx + 0.8))},${sy(jibB)}`);
  }
  return (
    <g aria-hidden="true">
      <rect x={sx(2.7)} y={sy(0.5)} width={2 * k} height={0.5 * k} fill="#cbd5e1" stroke="#94a3b8" />
      {/* mast */}
      <line x1={sx(mast0)} x2={sx(mast0)} y1={sy(0.5)} y2={sy(jibB)} stroke={CRANE.line} strokeWidth="1.8" />
      <line x1={sx(mast1)} x2={sx(mast1)} y1={sy(0.5)} y2={sy(jibB)} stroke={CRANE.line} strokeWidth="1.8" />
      <path d={mastPts.join(' ')} stroke={CRANE.fill} strokeWidth="1.2" fill="none" />
      {/* tower head and ties */}
      <line x1={sx(3.7)} x2={sx(3.7)} y1={sy(jibT)} y2={sy(24)} stroke={CRANE.line} strokeWidth="2" />
      <line x1={sx(3.7)} y1={sy(24)} x2={sx(-1.8)} y2={sy(jibT)} stroke="#475569" strokeWidth="1" />
      <line x1={sx(3.7)} y1={sy(24)} x2={sx(8.6)} y2={sy(21.1)} stroke="#475569" strokeWidth="1" />
      {/* jib */}
      <line x1={sx(-1.8)} x2={sx(mast0)} y1={sy(jibB)} y2={sy(jibB)} stroke={CRANE.line} strokeWidth="1.8" />
      <line x1={sx(-1.8)} x2={sx(mast0)} y1={sy(jibT)} y2={sy(jibT)} stroke={CRANE.line} strokeWidth="1.6" />
      <path d={jib.join(' ')} stroke={CRANE.fill} strokeWidth="1.3" fill="none" />
      {/* counter-jib with counterweight */}
      <line x1={sx(mast1)} x2={sx(8.6)} y1={sy(jibB)} y2={sy(jibB)} stroke={CRANE.line} strokeWidth="1.8" />
      <line x1={sx(mast1)} x2={sx(8.6)} y1={sy(21.1)} y2={sy(21.1)} stroke={CRANE.line} strokeWidth="1.4" />
      <path d={cjib.join(' ')} stroke={CRANE.fill} strokeWidth="1.2" fill="none" />
      <rect x={sx(7.0)} y={sy(jibB)} width={1.4 * k} height={1.3 * k} fill="#94a3b8" stroke="#64748b" />
      <rect x={sx(mast0)} y={sy(jibT)} width={k} height={(jibT - jibB) * k} fill={CRANE.fill} stroke={CRANE.line} />
      {/* operator cab */}
      <rect x={sx(mast1)} y={sy(jibB)} width={1.15 * k} height={1.4 * k} rx={2} fill="#e2e8f0" stroke="#64748b" />
      <rect x={sx(mast1 + 0.18)} y={sy(jibB - 0.2)} width={0.8 * k} height={0.6 * k} rx={1} fill="#bae6fd" />
      {/* trolley */}
      <rect x={sx(-0.45)} y={sy(jibB)} width={0.9 * k} height={0.32 * k} rx={1.5} fill="#334155" />
    </g>
  );
}

function Crate({ x0, x1, y0, y1 }) {
  const w = x1 - x0;
  const hh = y1 - y0;
  const b = Math.max(2, w * 0.1);
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y0} width={w} height={hh} rx={1.5} fill="url(#pe-lift-wood)" stroke="#7c4a1e" strokeWidth="1.4" />
      <line x1={x0 + b} y1={y0 + b} x2={x1 - b} y2={y1 - b} stroke="#9a6430" strokeWidth={Math.max(1, b * 0.55)} />
      <line x1={x1 - b} y1={y0 + b} x2={x0 + b} y2={y1 - b} stroke="#9a6430" strokeWidth={Math.max(1, b * 0.55)} />
      <rect x={x0 + b * 0.4} y={y0 + b * 0.4} width={w - b * 0.8} height={hh - b * 0.8} rx={1} fill="none" stroke="#7c4a1e" strokeWidth={Math.max(0.8, b * 0.35)} />
    </g>
  );
}

/** Close-up of the crate with the two forces on it, to a fixed force scale. */
function CloseUp({ L, T, x0, x1, top, bottom, m, running, dir, fs }) {
  const dec = T.decimal;
  const mg = m * G;
  const cw = x1 - x0;
  const cx = x0 + cw * 0.44;
  const crW = Math.min(cw * 0.42, 88);
  const crH = crW * 0.78;
  const gapHook = 22;
  const top0 = top + 34;
  const bot0 = bottom - 52;
  const ccy = (bot0 + top0 + crH / 2 + gapHook) / 2;
  const hookY = ccy - crH / 2 - gapHook;
  const maxLen = Math.max(40, bot0 - ccy - 6);
  const kF = maxLen / (M_MAX * G);
  const len = mg * kF;
  const step = mg > 0 ? [10, 20, 50, 100, 200].find((s) => s * kF >= 26) ?? 200 : 100;
  return (
    <g>
      <rect x={x0} y={top} width={cw} height={bottom - top} rx={12} fill="#ffffff" stroke="#cbd5e1" />
      <text x={x0 + cw / 2} y={top + 18} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#334155">
        {L.close.title}
      </text>
      <g aria-hidden="true">
        <line x1={cx} x2={cx} y1={top + 26} y2={hookY} stroke="#64748b" strokeWidth="2" />
        <rect x={cx - 7} y={hookY - 4} width={14} height={8} rx={2} fill="#475569" />
        <line x1={cx} y1={hookY + 4} x2={cx - crW * 0.42} y2={ccy - crH / 2} stroke="#475569" strokeWidth="1.4" />
        <line x1={cx} y1={hookY + 4} x2={cx + crW * 0.42} y2={ccy - crH / 2} stroke="#475569" strokeWidth="1.4" />
        <Crate x0={cx - crW / 2} x1={cx + crW / 2} y0={ccy - crH / 2} y1={ccy + crH / 2} />
      </g>
      <SidePill x={cx - crW / 2} y={ccy + crH / 2 - 10} side={-1} gap={4} text={L.mTag(smart(m, dec))} bg={EC.ink} fs={fs - 1} box={{ w: x1 - 4, h: bottom }} />
      <ForceArrow x1={cx} y1={hookY} x2={cx} y2={hookY - len} color={EC.F} width={3.4} head={12} />
      <ForceArrow x1={cx} y1={ccy} x2={cx} y2={ccy + len} color={EC.mg} width={3.4} head={12} />
      <SidePill x={cx + 6} y={hookY - Math.max(len * 0.55, 14)} side={1} gap={4} text={L.close.F(smart(mg, dec))} bg={EC.F} fs={fs - 1} box={{ w: x1 - 4, h: bottom }} />
      <SidePill x={cx + 6} y={ccy + Math.max(len * 0.6, crH / 2 + 12)} side={1} gap={4} text={L.close.mg(smart(mg, dec))} bg={EC.mg} fs={fs - 1} box={{ w: x1 - 4, h: bottom }} />
      {running && dir !== 0 && (
        <>
          <ForceArrow x1={cx - crW / 2 - 16} y1={ccy} x2={cx - crW / 2 - 16} y2={ccy - dir * 38} color={EC.v} width={2.8} head={10} dot={false} />
          <HaloText x={cx - crW / 2 - 16} y={dir > 0 ? ccy - 46 : ccy + 52} anchor="middle" size={fs - 1} fill={EC.v}>
            {L.close.vTag(fmt(V_HOIST, 0, dec))}
          </HaloText>
        </>
      )}
      <text x={x0 + cw / 2} y={bottom - 30} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#334155">
        {running ? L.close.uniform : L.close.rest}
      </text>
      <ScaleBar x={x0 + cw / 2 - (step * kF) / 2} y={bottom - 10} px={step * kF} label={L.close.scale(step)} fs={fs - 2} />
    </g>
  );
}

/** A_crane and E_p as bars drawn to the overview's metre scale, ticks at the storeys. */
function EnergyBars({ L, T, x0, x1, top, sy, groundY, y, h, mg, fs }) {
  const dec = T.decimal;
  const axisX = x0 + 48;
  const bw = clamp((x1 - axisX) * 0.17, 38, 56);
  const gap = clamp((x1 - axisX) * 0.14, 34, 64);
  const groupW = 2 * bw + gap;
  const left = axisX + (x1 - axisX - groupW) / 2;
  const yTop = sy(y);
  const E = mg * y;
  const showTarget = Math.abs(h - y) > 0.05;
  const bars = [
    { id: 'A', x: left, color: EC.F, text: '#0f766e', sym: 'A', cap: L.bars.A },
    { id: 'E', x: left + bw + gap, color: EC.ep, text: '#1d4ed8', sym: 'E_p', cap: L.bars.ep },
  ];
  return (
    <g aria-hidden="true">
      <text x={(x0 + x1) / 2 + 20} y={top + 6} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
        {L.bars.title}
      </text>
      <HaloText x={(x0 + x1) / 2 + 20} y={top + 24} anchor="middle" size={fs - 1} weight={600} fill="#475569">
        {L.bars.eq}
      </HaloText>
      <line x1={axisX} x2={axisX} y1={sy(H_MAX + 0.6)} y2={groundY} stroke="#94a3b8" />
      {Array.from({ length: FLOORS + 1 }, (_, i) => (
        <g key={`t${i}`}>
          <line x1={axisX - 5} x2={axisX} y1={sy(i * FLOOR_H)} y2={sy(i * FLOOR_H)} stroke="#64748b" />
          <text x={axisX - 7} y={sy(i * FLOOR_H) + 4} textAnchor="end" fontSize={fs - 2} fill={EC.muted}>
            {smart(mg * i * FLOOR_H, dec)}
          </text>
        </g>
      ))}
      <text x={axisX - 7} y={sy(H_MAX + 0.6) - 6} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {T.J}
      </text>
      <line x1={axisX} x2={x1} y1={groundY} y2={groundY} stroke="#475569" strokeWidth="1.6" />
      {bars.map((b) => (
        <g key={b.id}>
          {showTarget && b.id === 'E' && (
            <rect x={b.x} y={sy(h)} width={bw} height={groundY - sy(h)} rx={4} fill="none" stroke={EC.ep} strokeWidth="1.5" strokeDasharray="5 4" />
          )}
          <rect x={b.x} y={yTop} width={bw} height={Math.max(0, groundY - yTop)} rx={4} fill={b.color} opacity="0.9" />
          <text x={b.x + bw / 2} y={yTop - 8} textAnchor="middle" fontSize={fs} fontWeight="700" fill={b.text}>
            {fmt(E, 1, dec)} {T.J}
          </text>
          <text x={b.x + bw / 2} y={groundY + 16} textAnchor="middle" fontSize={fs + 2} fontStyle="italic" fontWeight="700" fill={b.text}>
            {b.id === 'E' ? (
              <>
                E
                <tspan fontSize={(fs + 2) * 0.72} dy={(fs + 2) * 0.28}>
                  p
                </tspan>
              </>
            ) : (
              b.sym
            )}
          </text>
          <text x={b.x + bw / 2} y={groundY + 30} textAnchor="middle" fontSize={fs - 2} fill="#64748b">
            {b.cap}
          </text>
        </g>
      ))}
      {y > 0.3 && (
        <text x={left + bw + gap / 2} y={Math.max(yTop + 22, sy(H_MAX) + 10)} textAnchor="middle" fontSize={fs + 8} fontWeight="700" fill="#64748b">
          =
        </text>
      )}
    </g>
  );
}

/** Phones: one slim E_p bar at the right edge, on the overview's metre scale. */
function EnergyStrip({ T, x0, x1, sy, groundY, y, h, mg, fs }) {
  const dec = T.decimal;
  const bx = x0 + 6;
  const bw = 14;
  const yTop = sy(y);
  return (
    <g aria-hidden="true">
      <rect x={x0 - 4} y={0} width={x1 - x0 + 8} height={groundY} fill="#f8fafc" />
      <line x1={x0 - 4} x2={x0 - 4} y1={8} y2={groundY} stroke="#cbd5e1" strokeDasharray="4 5" />
      <text x={(x0 + x1) / 2} y={sy(H_MAX + 1.2)} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#1d4ed8">
        E
        <tspan fontSize={(fs - 1) * 0.72} dy={(fs - 1) * 0.28}>
          p
        </tspan>
        <tspan dy={-(fs - 1) * 0.28}>, {T.J}</tspan>
      </text>
      {Math.abs(h - y) > 0.05 && <rect x={bx} y={sy(h)} width={bw} height={groundY - sy(h)} rx={3} fill="none" stroke={EC.ep} strokeWidth="1.3" strokeDasharray="4 3" />}
      <rect x={bx} y={yTop} width={bw} height={Math.max(0, groundY - yTop)} rx={3} fill={EC.ep} opacity="0.9" />
      {Array.from({ length: FLOORS + 1 }, (_, i) => (
        <text key={`s${i}`} x={bx + bw + 4} y={sy(i * FLOOR_H) + 3.5} fontSize={fs - 3} fill={EC.muted}>
          {smart(mg * i * FLOOR_H, dec)}
        </text>
      ))}
      <line x1={x0 - 4} x2={x1 + 4} y1={groundY} y2={groundY} stroke="#475569" strokeWidth="1.6" />
    </g>
  );
}

