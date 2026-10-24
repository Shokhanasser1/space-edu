import { useRef, useState } from 'react';
import { Droplets, Landmark, Lightbulb } from 'lucide-react';

import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  FormulaTile,
  G,
  GroupLabel,
  LIQUIDS,
  LabScene,
  LineGraph,
  LiquidGrad,
  P0,
  PC,
  PlayControls,
  Rich,
  RichPill,
  SpeedPicker,
  SvgRich,
  ToggleChip,
  fmtForce,
  fmtG,
  plain,
  surfacePath,
} from './HydrostaticPressure.parts';

/**
 * Tab 3 — pressure on the walls grows with depth.
 *  · Jets: a bottle on a 40 cm stand with three plugged holes 5, 15 and
 *    25 cm above its bottom. Water level 35 cm → depths 0.30 / 0.20 / 0.10 m,
 *    wall pressures 2940 / 1960 / 980 Pa, jet speeds v = √(2gh) = 2.42 /
 *    1.98 / 1.40 m/s; they land 0.73 / 0.66 / 0.51 m from the wall. With the
 *    tap closed the level falls (Torricelli, 8 mm holes) and the jets weaken.
 *  · Dam: a water depth of 100 m presses on the foot of the dam with
 *    ρgH = 980 kPa ≈ 9.7 atm, and on every metre of its width with
 *    F = ρgH²/2 = 49 MN — so dams are built thick at the bottom.
 */

export default function WallsSim({ T }) {
  const t = T.walls;
  const [mode, setMode] = useState('jets');
  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <GroupLabel>{t.modeLabel}</GroupLabel>
        <Segmented
          label={t.modeLabel}
          className="grid-cols-2"
          size="lg"
          value={mode}
          onChange={setMode}
          accent="#22d3ee"
          options={[
            { value: 'jets', label: t.modes.jets.name, sub: t.modes.jets.sub, icon: Droplets },
            { value: 'dam', label: t.modes.dam.name, sub: t.modes.dam.sub, icon: Landmark },
          ]}
        />
      </div>
      {mode === 'jets' ? <JetsLab T={T} /> : <DamLab T={T} />}
    </div>
  );
}

/* =================================================================== jets */

const WATER = LIQUIDS.water;
const STAND = 0.4; // m, stand under the bottle
const BH = 0.5; // inner height of the bottle
const BR = 0.09; // inner radius (18 cm across)
const WALL = 0.008; // wall thickness drawn
const HOLES = [0.05, 0.15, 0.25]; // heights of the holes above the bottom
const A_RATIO = 0.004 ** 2 / BR ** 2; // (hole area) / (bottle cross-section), 8 mm holes
const P_REF = WATER.rho * G * 0.45; // pressure of the longest wall arrow

function jetsAt(level) {
  return HOLES.map((z) => {
    const d = Math.max(0, level - z);
    const v = Math.sqrt(2 * G * d);
    const y0 = STAND + z;
    const tf = Math.sqrt((2 * y0) / G);
    return { z, d, v, y0, tf, range: v * tf, p: WATER.rho * G * d, on: d > 0.003 };
  });
}

function JetsLab({ T }) {
  const t = T.walls.jets;
  const dec = T.decimal;
  const [H, setH] = useState(0.35);
  const [tap, setTap] = useState(true);
  const [speed, setSpeed] = useState(1);
  const idle = { level: 0.35, open: false, time: 0 };
  const [sim, setSim] = useState(idle);
  const level = sim.level;
  const jets = jetsAt(level);
  const flowing = sim.open && jets.some((j) => j.on);
  const drained = sim.open && !jets.some((j) => j.on);
  // the tap (or plugged holes) keep the level at H; open holes without the tap drain it
  const draining = sim.open && !tap;
  const active = (sim.open && !drained) || (!draining && Math.abs(level - H) > 1e-4);

  useRafLoop(active, (dtReal) => {
    setSim((p) => {
      const dt = dtReal * speed;
      let lv = p.level;
      if (p.open && !tap) {
        const out = jetsAt(lv).reduce((s, j) => s + (j.on ? j.v : 0), 0);
        lv = Math.max(HOLES[0], lv - A_RATIO * out * dt);
      } else {
        lv = Math.abs(H - lv) < 1e-4 ? H : lv + (H - lv) * (1 - Math.exp(-dt / 0.3));
      }
      return { ...p, level: lv, time: p.open ? p.time + dt : p.time };
    });
  });

  const toggle = () => setSim({ ...sim, open: drained ? false : !sim.open });
  const reset = () => setSim({ ...idle, level: sim.level });
  const changeH = (v) => setH(v);
  const changeTap = (on) => setTap(on);

  /* ---- explanation */
  const ex = t.explain;
  const kind = !sim.open ? 'idle' : drained ? 'drained' : tap ? 'steady' : 'falling';
  const settled = useSettled(kind, 300);
  const v = jets.map((j) => fmt(j.v, 2, dec));
  const text =
    {
      idle: ex.idle,
      steady: ex.steady(v[0], v[1], v[2]),
      falling: ex.falling,
      drained: ex.drained,
    }[settled] ?? ex.idle;
  const tone = { idle: '#22d3ee', steady: '#34d399', falling: '#fbbf24', drained: '#a78bfa' }[settled] ?? '#22d3ee';

  /* ---- graph v(h) */
  const curve = [];
  for (let i = 0; i <= 60; i += 1) {
    const d = (0.45 * i) / 60;
    curve.push({ x: d, y: Math.sqrt(2 * G * d) });
  }
  const names = [t.holes.low, t.holes.mid, t.holes.high];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <ToggleChip label={t.tap.label} sub={tap ? t.tap.on : t.tap.off} on={tap} onChange={changeTap} accent="#38bdf8" />
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-snug text-gray-400">
            <Rich>{t.setup}</Rich>
          </div>
        </div>
        <PlayControls
          labels={{ start: t.open, pause: t.close, resume: t.open, again: t.refill, reset: T.common.reset }}
          running={sim.open && !drained}
          done={drained}
          started={sim.open || sim.time > 0}
          onToggle={toggle}
          onReset={reset}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <JetsScene
          T={T}
          sim={sim}
          jets={jets}
          tap={tap}
          flowing={flowing}
          speed={speed}
          ariaLabel={plain(t.scene.aria(fmt(level * 100, 1, dec), v[0], v[1], v[2]))}
        />
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LineGraph
            idKey="hp-jets"
            title={t.graph.title}
            series={[{ id: 'v', color: PC.vel, points: curve }]}
            dots={jets.filter((j) => j.on).map((j, i) => ({ id: `j${i}`, x: j.d, y: j.v, color: PC.velText, label: String(HOLES.indexOf(j.z) + 1) }))}
            xMax={0.45}
            yMax={3}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={200}
            decimal={dec}
            ariaLabel={t.graph.aria}
          />
          <FormulaTile
            tag={t.f.p.tag}
            color={PC.hydroText}
            general={t.f.p.general}
            filled={t.f.p.filled(fmt(jets[0].d, 2, dec), fmtG(jets[0].p, 0, dec))}
            ok={flowing}
          />
          <FormulaTile tag={t.f.v.tag} color={PC.velText} general={t.f.v.general} filled={t.f.v.filled(fmt(jets[0].d, 2, dec), v[0])} ok={flowing} />
        </div>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {jets.map((j, i) => (
          <Readout
            key={j.z}
            label={names[i]}
            symbol={`v${['₁', '₂', '₃'][i]}`}
            value={fmt(j.v, 2, dec)}
            unit={T.ms}
            accent={PC.vel}
            textColor={j.on ? PC.velText : '#64748b'}
            active={flowing && i === 0}
            sub={<Rich>{t.sub.hole(fmt(j.d, 2, dec), fmtG(j.p, 0, dec))}</Rich>}
          />
        ))}
        <Readout
          label={t.readouts.level}
          symbol="H"
          value={fmt(level * 100, 1, dec)}
          unit={T.cm}
          accent={WATER.chip}
          textColor={WATER.text}
          sub={tap ? t.sub.levelTap : sim.open ? t.sub.levelFall : t.sub.levelIdle}
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-2 sm:p-4">
        <RangeField
          id="hp-jets-h"
          label={t.levelLabel}
          symbol="H"
          min={0.28}
          max={0.45}
          step={0.01}
          value={H}
          onChange={changeH}
          disabled={sim.open && !tap}
          accent="#38bdf8"
          display={`${fmt(H * 100, 0, dec)} ${T.cm}`}
          hint={t.levelHint}
        />
        <SpeedPicker label={T.speedLabel} value={speed} onChange={setSpeed} />
      </div>
    </div>
  );
}

function JetsScene({ T, sim, jets, tap, flowing, speed, ariaLabel }) {
  const t = T.walls.jets;
  const dec = T.decimal;
  const legend = [
    { label: t.legend.wall, color: PC.hydro, kind: 'arrow' },
    { label: t.legend.v, color: PC.vel, kind: 'arrow' },
    { label: t.legend.jet, color: WATER.jet, kind: 'dash' },
  ];
  const chips = speed !== 1 ? <Chip>{T.slowChip(speed)}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 1.0, 340, 420) : clamp(W * 0.62, 430, 520))}>
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const pad = narrow ? { l: 64, r: 10, t: 50, b: 30 } : { l: 110, r: 18, t: 66, b: 36 };
        const topM = STAND + BH + 0.13;
        const k = Math.min((H - pad.t - pad.b) / topM, (W - pad.l - pad.r) / (1.02 + 0.1));
        const x0 = pad.l + 0.1 * k; // bottle axis
        const sx = (x) => x0 + x * k;
        const sy = (y) => H - pad.b - y * k;
        const level = sim.level;
        const yLev = sy(STAND + level);
        const yBot = sy(STAND);
        const xIn0 = sx(-BR);
        const xIn1 = sx(BR);
        const wPx = Math.max(3, WALL * k);
        const Lmax = 0.16 * k;
        const aLen = (p) => (p / P_REF) * Lmax;
        const floorY = sy(0);

        /* the wall-pressure diagram on the left wall, outside */
        const wx = xIn0 - wPx;
        const wall = [];
        const nW = 6;
        for (let i = 1; i <= nW; i += 1) {
          const d = (level * i) / nW;
          const L = aLen(WATER.rho * G * d);
          if (L > 4) wall.push(<Arrow key={`w${i}`} x1={wx - 2} y1={yLev + d * k - (i === nW ? 2 : 0)} x2={wx - 2 - L} y2={yLev + d * k - (i === nW ? 2 : 0)} color={PC.hydro} width={2} head={7} />);
        }
        const Lb = aLen(WATER.rho * G * level);

        /* jets and droplets */
        const xOut = xIn1 + wPx;
        const jetEls = jets.map((j, i) => {
          const yh = sy(j.y0);
          if (!sim.open || !j.on) {
            return (
              <g key={`j${i}`}>
                {!sim.open && <rect x={xOut - 1} y={yh - 4} width={narrow ? 8 : 10} height={8} rx={2} fill="#78350f" />}
                {sim.open && <circle cx={xOut} cy={yh} r={2.4} fill="#1e293b" />}
              </g>
            );
          }
          const pts = [];
          const n = 28;
          for (let s = 0; s <= n; s += 1) {
            const tt = (j.tf * s) / n;
            pts.push(`${(xOut + j.v * tt * k).toFixed(1)},${sy(j.y0 - 0.5 * G * tt * tt).toFixed(1)}`);
          }
          const drops = [];
          const N = 12;
          for (let q = 0; q < N; q += 1) {
            const ph = (sim.time / j.tf + q / N + i * 0.17) % 1;
            const tt = ph * j.tf;
            drops.push(<circle key={q} cx={xOut + j.v * tt * k} cy={sy(j.y0 - 0.5 * G * tt * tt)} r={narrow ? 1.8 : 2.4} fill={WATER.jet} opacity={0.9} />);
          }
          const xLand = xOut + j.range * k;
          const vLen = j.v * (narrow ? 14 : 22);
          return (
            <g key={`j${i}`}>
              <polyline points={pts.join(' ')} fill="none" stroke={WATER.deep} strokeWidth={narrow ? 3 : 4.5} strokeLinecap="round" opacity="0.45" />
              {drops}
              <ellipse cx={xLand} cy={floorY - 1} rx={narrow ? 7 : 10} ry={2.5} fill={WATER.deep} opacity="0.5" />
              <Arrow x1={xOut + 2} y1={yh} x2={xOut + 2 + vLen} y2={yh} color={PC.vel} width={narrow ? 2.2 : 2.8} head={narrow ? 7 : 9} />
              <text x={xLand + (i === 2 ? -6 : 6)} y={floorY - 7 - i * (fs + 1)} textAnchor={i === 2 ? 'end' : 'start'} fontSize={fs - 1} fontWeight="700" fill={WATER.edge}>
                {`${fmt(j.range, 2, dec)} ${T.m}`}
              </text>
            </g>
          );
        });

        /* floor ruler from the outer wall */
        const ticks = [];
        for (let x = 0; x <= 1.0 + 1e-9; x += 0.1) {
          const px = xOut + x * k;
          if (px > W - pad.r) break;
          const big = Math.round(x * 10) % 2 === 0;
          ticks.push(<line key={`f${x.toFixed(1)}`} x1={px} x2={px} y1={floorY} y2={floorY + (big ? 7 : 4)} stroke="#94a3b8" />);
          if (big)
            ticks.push(
              <text key={`ft${x.toFixed(1)}`} x={px} y={floorY + fs + 8} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
                {fmt(x, 1, dec)}
              </text>,
            );
        }

        const tapX = sx(-BR * 0.35);
        const tapY = sy(STAND + BH + 0.08);
        const gradId = 'hp-jets-water';

        return (
          <g>
            <defs>
              <LiquidGrad id={gradId} liq={WATER} />
              <pattern id="hp-wood" width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="10" height="10" fill="#d6b48a" />
                <line x1="0" y1="3" x2="10" y2="3" stroke="#b08860" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* floor */}
            <rect x={0} y={floorY} width={W} height={H - floorY} fill="#f1f5f9" />
            <line x1={0} x2={W} y1={floorY} y2={floorY} stroke="#64748b" strokeWidth={1.5} />
            {ticks}
            {!narrow && (
              <text x={W - pad.r} y={floorY + fs + 8} textAnchor="end" fontSize={fs - 1} fill="#64748b">
                {t.scene.floorAxis}
              </text>
            )}

            {/* stand */}
            <rect x={sx(-0.15)} y={yBot} width={0.3 * k} height={Math.max(5, 0.025 * k)} fill="url(#hp-wood)" stroke="#92704a" />
            <rect x={sx(-0.13)} y={yBot} width={Math.max(4, 0.02 * k)} height={floorY - yBot} fill="#a8865e" />
            <rect x={sx(0.13) - Math.max(4, 0.02 * k)} y={yBot} width={Math.max(4, 0.02 * k)} height={floorY - yBot} fill="#a8865e" />

            {/* water */}
            <rect x={xIn0} y={yLev} width={xIn1 - xIn0} height={yBot - yLev} fill={`url(#${gradId})`} />
            <path d={surfacePath(xIn0, xIn1, yLev, flowing ? 1.2 : 0, sim.time * 9, 22)} fill="none" stroke={WATER.edge} strokeWidth={1.8} />

            {/* bottle */}
            <path
              d={`M${xIn0 - wPx},${sy(STAND + BH)} L${xIn0 - wPx},${yBot + wPx} L${xIn1 + wPx},${yBot + wPx} L${xIn1 + wPx},${sy(STAND + BH)}`}
              fill="none"
              stroke="#475569"
              strokeWidth={narrow ? 2 : 2.6}
              strokeLinejoin="round"
            />

            {/* tap */}
            <path d={`M${sx(-0.3)},${tapY - 10} L${tapX + 6},${tapY - 10} L${tapX + 6},${tapY}`} fill="none" stroke="#64748b" strokeWidth={narrow ? 5 : 7} strokeLinejoin="round" />
            <rect x={tapX - 4} y={tapY - 22} width={20} height={6} rx={2} fill={tap ? '#0284c7' : '#94a3b8'} />
            {tap && sim.open && flowing && (
              <line x1={tapX + 6} x2={tapX + 6} y1={tapY} y2={yLev} stroke={WATER.deep} strokeWidth={3} opacity="0.6" strokeDasharray="6 5" strokeDashoffset={-sim.time * 120} />
            )}

            {/* wall pressure */}
            {Lb > 4 && <polygon points={`${wx - 2},${yLev} ${wx - 2 - Lb},${yBot} ${wx - 2},${yBot}`} fill={PC.hydro} opacity="0.08" />}
            {wall}
            {Lb > 4 && !narrow && (
              <text x={wx - Lb - 6} y={yBot - 2} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill={PC.hydro}>
                {`${fmtG(WATER.rho * G * level, 0, dec)} ${T.Pa}`}
              </text>
            )}

            {/* hole numbers and depth marks */}
            {jets.map((j, i) => (
              <g key={`n${i}`}>
                <line x1={xIn1 - 6} x2={xIn1} y1={sy(j.y0)} y2={sy(j.y0)} stroke="#334155" strokeWidth={1} />
                <circle cx={xIn1 - (narrow ? 14 : 18)} cy={sy(j.y0)} r={narrow ? 7 : 8.5} fill="#fff" stroke="#334155" />
                <text x={xIn1 - (narrow ? 14 : 18)} y={sy(j.y0) + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#334155">
                  {i + 1}
                </text>
              </g>
            ))}

            {jetEls}

            {/* level and depth of the lowest hole */}
            <RichPill x={wx - Lb - 6} y={yLev - 2} anchor="end" text={t.scene.levelTag(fmt(level * 100, 0, dec))} bg={WATER.edge} size={fs - 1} box={box} />
            {sim.open && jets[0].on && (
              <text x={xOut + (narrow ? 10 : 14)} y={sy(jets[0].y0) - (narrow ? 8 : 10)} fontSize={fs - 1} fontWeight="700" fill={PC.vel}>
                <SvgRich text={t.scene.vTag(fmt(jets[0].v, 2, dec))} fs={fs - 1} />
              </text>
            )}
            {!sim.open && (
              <RichPill x={xOut + (narrow ? 50 : 70)} y={sy(jets[1].y0)} text={t.scene.plugged} bg="#78350f" size={fs - 1} box={box} />
            )}
          </g>
        );
      }}
    </LabScene>
  );
}

/* ==================================================================== dam */

const DAM_H = 170; // m, crest height
const DAM_TOP = 10; // crest width
const DAM_BASE = 120; // base width
const RES = 170; // reservoir length drawn (wide screens; phones get a shorter one)

function DamLab({ T }) {
  const t = T.walls.dam;
  const dec = T.decimal;
  const [Hw, setHw] = useState(100);
  const [d, setD] = useState(60);
  const [act, setAct] = useState('base');
  const rho = WATER.rho;
  const depth = Math.min(d, Hw);
  const pBase = rho * G * Hw;
  const pD = rho * G * depth;
  const Fw = (rho * G * Hw * Hw) / 2; // per metre of width

  const changeH = (v) => {
    setHw(v);
    setAct('level');
  };
  const changeD = (v) => {
    setD(v);
    setAct('point');
  };

  const ex = t.explain;
  const settled = useSettled(act, 300);
  const pBaseS = fmtG(pBase / 1000, 0, dec);
  const atmS = fmt(pBase / P0, 1, dec);
  const FwS = fmtForce(Fw, T, dec);
  const text =
    {
      base: ex.base(fmt(Hw, 0, dec), pBaseS, atmS, fmt(DAM_BASE, 0, dec), fmt(DAM_TOP, 0, dec)),
      level: ex.level(fmt(Hw, 0, dec), pBaseS, `${FwS.v} ${FwS.u}`),
      point: ex.point(fmt(depth, 0, dec), fmtG(pD / 1000, 0, dec), fmtG(pD / 1000, 0, dec), fmtG(pD / G / 1000, 0, dec)),
    }[settled] ?? '';
  const tone = { base: '#34d399', level: '#38bdf8', point: '#f87171' }[settled] ?? '#34d399';

  return (
    <div className="space-y-3 sm:space-y-4">
      <DamScene
        T={T}
        Hw={Hw}
        depth={depth}
        onDrag={(v) => changeD(clamp(Math.round(v), 0, Hw))}
        ariaLabel={plain(t.scene.aria(fmt(Hw, 0, dec), pBaseS, fmt(depth, 0, dec), fmtG(pD / 1000, 0, dec)))}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.H} symbol="H" value={fmt(Hw, 0, dec)} unit={T.m} accent={WATER.chip} textColor={WATER.text} sub={t.sub.H(fmt(DAM_H, 0, dec))} />
        <Readout label={t.readouts.base} symbol="ρgH" value={pBaseS} unit={T.kPa} accent={PC.hydro} textColor={PC.hydroText} active={settled !== 'point'} sub={t.sub.base(atmS)} />
        <Readout
          label={t.readouts.point}
          symbol="ρgh"
          value={fmtG(pD / 1000, 0, dec)}
          unit={T.kPa}
          accent={PC.hydro}
          textColor={PC.hydroText}
          active={settled === 'point'}
          sub={t.sub.point(fmt(depth, 0, dec))}
        />
        <Readout label={t.readouts.F} symbol="F" value={FwS.v} unit={FwS.u} accent={PC.total} textColor={PC.totalText} sub={t.sub.F} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="hp-dam-h"
            label={t.levelLabel}
            symbol="H"
            min={20}
            max={160}
            step={1}
            value={Hw}
            onChange={changeH}
            accent="#38bdf8"
            display={`${fmt(Hw, 0, dec)} ${T.m}`}
          />
          <RangeField
            id="hp-dam-d"
            label={t.pointLabel}
            symbol="h"
            min={0}
            max={Hw}
            step={1}
            value={depth}
            onChange={changeD}
            accent={PC.hydro}
            display={`${fmt(depth, 0, dec)} ${T.m}`}
            hint={t.pointHint}
          />
          <FormulaTile tag={t.f.p.tag} color={PC.hydroText} general={t.f.p.general} filled={t.f.p.filled(fmt(Hw, 0, dec), fmtG(pBase, 0, dec), pBaseS)} />
          <FormulaTile tag={t.f.F.tag} color={PC.totalText} general={t.f.F.general} filled={t.f.F.filled(fmt(Hw, 0, dec), `${FwS.v} ${FwS.u}`)} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LineGraph
            idKey="hp-dam"
            title={t.graph.title}
            series={[
              {
                id: 'p',
                color: PC.hydro,
                points: [
                  { x: 0, y: 0 },
                  { x: Hw, y: (rho * G * Hw) / 1000 },
                ],
              },
            ]}
            dots={[{ id: 'pt', x: depth, y: pD / 1000, color: PC.hydroText }]}
            marker={depth}
            xMax={160}
            yMax={1600}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={280}
            decimal={dec}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
        </div>
      </div>
    </div>
  );
}

function DamScene({ T, Hw, depth, onDrag, ariaLabel }) {
  const t = T.walls.dam;
  const dec = T.decimal;
  const drag = useRef(null);
  const legend = [
    { label: t.legend.p, color: PC.hydro, kind: 'arrow' },
    { label: t.legend.water, color: WATER.deep, kind: 'swatch' },
    { label: t.legend.dam, color: '#cbd5e1', kind: 'swatch' },
  ];
  return (
    <LabScene legend={legend} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 0.9, 300, 380) : clamp(W * 0.42, 380, 470))}>
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const pad = narrow ? { l: 34, r: 10, t: 20, b: 30 } : { l: 52, r: 24, t: 62, b: 34 };
        const res = narrow ? 80 : RES;
        const worldW = res + DAM_BASE + (narrow ? 20 : 40);
        const k = Math.min((W - pad.l - pad.r) / worldW, (H - pad.t - pad.b) / (DAM_H + 8));
        const x0 = pad.l + res * k; // dam face
        const sx = (x) => x0 + x * k;
        const sy = (y) => H - pad.b - y * k;
        const yS = sy(Hw);
        const yG = sy(0);
        const Lmax = 0.42 * res * k;
        const aLen = (pp) => (pp / (WATER.rho * G * 160)) * Lmax;
        const arrows = [];
        const n = 8;
        for (let i = 1; i <= n; i += 1) {
          const dd = (Hw * i) / n;
          const L = aLen(WATER.rho * G * dd);
          const y = sy(Hw - dd) - (i === n ? 2 : 0);
          if (L > 4) arrows.push(<Arrow key={i} x1={x0 - 2 - L} y1={y} x2={x0 - 2} y2={y} color={PC.hydro} width={narrow ? 2 : 2.6} head={narrow ? 7 : 9} />);
        }
        const Lb = aLen(WATER.rho * G * Hw);
        const yP = sy(Hw - depth);
        const Lp = aLen(WATER.rho * G * depth);
        const dam = `M${sx(0)},${yG} L${sx(0)},${sy(DAM_H)} L${sx(DAM_TOP)},${sy(DAM_H)} L${sx(DAM_BASE)},${yG} Z`;
        const ruler = [];
        for (let dd = 0; dd <= Hw + 1e-9; dd += 20) {
          const y = sy(Hw - dd);
          ruler.push(
            <g key={dd}>
              <line x1={pad.l - 4} x2={pad.l + 4} y1={y} y2={y} stroke="#64748b" />
              <text x={pad.l - 7} y={y + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
                {dd}
              </text>
            </g>,
          );
        }

        const onDown = (e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { rect: e.currentTarget.ownerSVGElement.getBoundingClientRect() };
        };
        const onMove = (e) => {
          if (!drag.current) return;
          const rc = drag.current.rect;
          const qy = ((e.clientY - rc.top) / rc.height) * H;
          onDrag((qy - yS) / k);
        };
        const onUp = () => {
          drag.current = null;
        };

        return (
          <g>
            <defs>
              <linearGradient id="hp-dam-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={WATER.top} stopOpacity="0.9" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.75" />
              </linearGradient>
              <pattern id="hp-concrete" width="9" height="9" patternUnits="userSpaceOnUse">
                <rect width="9" height="9" fill="#e2e8f0" />
                <circle cx="2" cy="3" r="0.9" fill="#94a3b8" />
                <circle cx="6.5" cy="7" r="0.7" fill="#a3aebd" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="#f8fafc" />
            {/* ground */}
            <rect x={0} y={yG} width={W} height={H - yG} fill="#d6c7a8" />
            <line x1={0} x2={W} y1={yG} y2={yG} stroke="#8b7355" strokeWidth={1.5} />
            {/* reservoir */}
            <rect x={pad.l} y={yS} width={x0 - pad.l} height={yG - yS} fill="url(#hp-dam-water)" />
            <path d={surfacePath(pad.l, x0, yS, 0)} stroke={WATER.edge} strokeWidth={2} fill="none" />
            {/* downstream river */}
            <rect x={sx(DAM_BASE) - 4} y={sy(5)} width={W - sx(DAM_BASE) + 4} height={yG - sy(5)} fill={WATER.deep} opacity="0.45" />
            {/* dam */}
            <path d={dam} fill="url(#hp-concrete)" stroke="#475569" strokeWidth={1.5} />
            <text x={sx(DAM_BASE * 0.42)} y={sy(DAM_H * 0.12)} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#475569">
              {t.scene.dam}
            </text>
            {/* thickness marks */}
            <line x1={sx(0)} x2={sx(DAM_TOP)} y1={sy(DAM_H) - 8} y2={sy(DAM_H) - 8} stroke="#334155" strokeWidth={1.2} />
            <text x={sx(DAM_TOP / 2)} y={sy(DAM_H) - 13} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#334155">
              {`${DAM_TOP} ${T.m}`}
            </text>
            <line x1={sx(0)} x2={sx(DAM_BASE)} y1={yG + 12} y2={yG + 12} stroke="#334155" strokeWidth={1.2} />
            <line x1={sx(0)} x2={sx(0)} y1={yG + 7} y2={yG + 17} stroke="#334155" strokeWidth={1.2} />
            <line x1={sx(DAM_BASE)} x2={sx(DAM_BASE)} y1={yG + 7} y2={yG + 17} stroke="#334155" strokeWidth={1.2} />
            <text x={sx(DAM_BASE / 2)} y={yG + 12 + fs + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#334155">
              {`${DAM_BASE} ${T.m}`}
            </text>
            {/* pressure diagram */}
            {Lb > 4 && <polygon points={`${x0 - 2},${yS} ${x0 - 2 - Lb},${yG} ${x0 - 2},${yG}`} fill={PC.hydro} opacity="0.12" />}
            {Lb > 4 && <line x1={x0 - 2} y1={yS} x2={x0 - 2 - Lb} y2={yG} stroke={PC.hydro} strokeDasharray="4 3" opacity="0.8" />}
            {arrows}
            <text x={x0 - 6 - Lb} y={yG - 6} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill={PC.hydro}>
              {`${fmtG((WATER.rho * G * Hw) / 1000, 0, dec)} ${T.kPa}`}
            </text>
            {/* depth ruler */}
            <line x1={pad.l} x2={pad.l} y1={yS} y2={yG} stroke="#64748b" />
            {ruler}
            <text x={pad.l - 7} y={yS - 8} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#475569">
              {t.scene.depthAxis}
            </text>
            {/* the point on the face */}
            {Lp > 3 && <Arrow x1={x0 - 2 - Lp} y1={yP} x2={x0 - 2} y2={yP} color="#991b1b" width={narrow ? 3 : 4} head={narrow ? 9 : 12} />}
            <line x1={x0 + 6} x2={x0 + 6} y1={yS} y2={yP} stroke={PC.ink} strokeWidth={1.4} strokeDasharray="3 3" />
            <circle cx={x0} cy={yP} r={narrow ? 6 : 7} fill="#fff" stroke="#991b1b" strokeWidth={2.5} />
            <RichPill
              x={x0 + (narrow ? 12 : 16)}
              y={yP}
              anchor="start"
              text={t.scene.pTag(fmt(depth, 0, dec), fmtG((WATER.rho * G * depth) / 1000, 0, dec))}
              bg="#991b1b"
              size={fs - 1}
              box={box}
            />
            <circle
              cx={x0}
              cy={yP}
              r={18}
              fill="transparent"
              style={{ cursor: 'ns-resize', touchAction: 'none' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </g>
        );
      }}
    </LabScene>
  );
}
