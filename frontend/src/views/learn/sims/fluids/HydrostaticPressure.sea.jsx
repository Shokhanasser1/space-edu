import { useState } from 'react';
import { Anchor, Lightbulb, Ship, Timer, Waves } from 'lucide-react';

import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, groupThousands, niceStep, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  FormulaTile,
  G,
  GroupLabel,
  LIQUIDS,
  LabScene,
  LineGraph,
  P0,
  PC,
  PlayControls,
  Rich,
  RichPill,
  fmtForce,
  fmtPress,
  niceCeil,
  plain,
  surfacePath,
  useSmooth,
} from './HydrostaticPressure.parts';

/**
 * Tab 4 — down into the sea: the total pressure p = p₀ + ρgh grows by about
 * 1 atm every 10 m of sea water (ρ = 1030 kg/m³). The vehicle descends at
 * 1 m/s with time sped up (chip); the view zooms with the depth, and the
 * left axis (depth) and the right axis (pressure in atm) are the same lines.
 * A 1 m² hatch with 1 atm inside takes F = (p − p₀)·S = ρghS.
 * Presets: 10 m → 202.2 kPa ≈ 2 atm; diver 40 m → 505.1 kPa ≈ 5 atm;
 * submarine 300 m → 3.13 MPa ≈ 31 atm, hatch 3.03 MN ≈ 309 t;
 * Mariana Trench 11 000 m → 111.1 MPa ≈ 1100 atm, hatch 111.0 MN ≈ 11 330 t.
 */

const SEA = LIQUIDS.sea;
const RHO = SEA.rho;
const MAXD = 11000;
const V_DIVE = 1; // m/s, descent speed of the vehicle
const PRESETS = [
  { id: 'm10', h: 10, icon: Waves },
  { id: 'diver', h: 40, icon: Anchor },
  { id: 'sub', h: 300, icon: Ship },
  { id: 'trench', h: 11000, icon: Anchor },
];
const SPEEDUPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const toU = (h) => Math.cbrt(h / MAXD);
const fromU = (u) => MAXD * u ** 3;
const vehicleFor = (h) => (h <= 60 ? 'diver' : h <= 1500 ? 'sub' : 'bathy');

/** Colour of sea water at depth d (m): light blue at the top, nearly black in the trench. */
const STOPS = [
  [0, [125, 211, 252]],
  [30, [14, 165, 233]],
  [200, [3, 105, 161]],
  [1000, [12, 74, 110]],
  [4000, [8, 47, 73]],
  [11000, [2, 6, 23]],
];
function seaColour(d) {
  const x = Math.log10(1 + d);
  for (let i = 1; i < STOPS.length; i += 1) {
    const [d1, c1] = STOPS[i];
    const [d0, c0] = STOPS[i - 1];
    const x0 = Math.log10(1 + d0);
    const x1 = Math.log10(1 + d1);
    if (x <= x1 || i === STOPS.length - 1) {
      const f = clamp((x - x0) / (x1 - x0), 0, 1);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(2,6,23)';
}

export default function SeaSim({ T }) {
  const t = T.sea;
  const dec = T.decimal;
  const [sim, setSim] = useState({ depth: 0, target: 300, running: false, factor: 50, wave: 0 });
  const { depth, target, running } = sim;

  useRafLoop(running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const step = V_DIVE * p.factor * dt;
      const dir = Math.sign(p.target - p.depth);
      let d = p.depth + dir * step;
      let run = true;
      if ((dir > 0 && d >= p.target) || (dir < 0 && d <= p.target) || dir === 0) {
        d = p.target;
        run = false;
      }
      return { ...p, depth: d, running: run, wave: p.wave + dt };
    });
  });

  const startTo = (from, to) => {
    const dist = Math.abs(to - from);
    const factor = SPEEDUPS.find((f) => dist / (V_DIVE * f) <= 6.5) ?? SPEEDUPS[SPEEDUPS.length - 1];
    setSim((p) => ({ ...p, depth: from, target: to, running: dist > 1e-6, factor }));
  };
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    startTo(depth, p.h);
  };
  const atTarget = Math.abs(depth - target) < 1e-6;
  const toggle = () => {
    if (running) setSim((p) => ({ ...p, running: false }));
    else if (atTarget) startTo(0, target);
    else startTo(depth, target);
  };
  const reset = () => {
    setSim((p) => ({ ...p, depth: 0, running: false }));
  };
  const onSlider = (u) => {
    const raw = fromU(u);
    const h = raw < 100 ? Math.round(raw * 10) / 10 : Math.round(raw);
    setSim((p) => ({ ...p, depth: h, target: h, running: false }));
  };

  /* ---- physics */
  const ph = RHO * G * depth;
  const p = P0 + ph;
  const atm = p / P0;
  const F = ph * 1; // hatch S = 1 m², 1 atm inside
  const tons = F / G / 1000;
  const pS = fmtPress(p, T, dec);
  const FS = fmtForce(F, T, dec);
  const vehicle = vehicleFor(running ? target : depth);
  const presetHere = PRESETS.find((x) => Math.abs(x.h - depth) < 1e-6);

  /* ---- explanation */
  const ex = t.explain;
  let kind;
  if (running) kind = target > depth ? 'down' : 'up';
  else if (depth < 0.05) kind = 'surface';
  else if (presetHere) kind = presetHere.id;
  else kind = 'free';
  const settled = useSettled(kind, 300);
  const hS = depth >= 100 ? groupThousands(depth) : fmt(depth, depth < 10 && depth % 1 ? 1 : 0, dec);
  const atmS = fmt(atm, atm < 10 ? 2 : atm < 100 ? 1 : 0, dec);
  const tonsS = tons >= 100 ? groupThousands(tons) : fmt(tons, 1, dec);
  const args = [`${pS.v} ${pS.u}`, atmS, `${FS.v} ${FS.u}`, tonsS];
  const text =
    {
      surface: ex.surface,
      down: ex.down(hS, `${pS.v} ${pS.u}`),
      up: ex.up(hS, `${pS.v} ${pS.u}`),
      m10: ex.m10(...args),
      diver: ex.diver(...args),
      sub: ex.sub(...args),
      trench: ex.trench(...args),
      free: ex.free(hS, ...args),
    }[settled] ?? ex.surface;
  const tone = { surface: '#38bdf8', down: '#0ea5e9', up: '#a78bfa', free: '#f87171' }[settled] ?? '#34d399';

  /* ---- view (zooms with the depth) and graph */
  const dTarget = clamp(niceCeil(Math.max(depth, 8) * 1.3), 12, 14000);
  const logDv = useSmooth(Math.log(dTarget), 0.35);
  const Dv = Math.exp(logDv);
  const big = P0 + RHO * G * Dv >= 1e6;
  const unitDiv = big ? 1e6 : 1e3;
  const gMax = niceCeil(((P0 + RHO * G * Dv) / unitDiv) * 1.05);
  const presetId = PRESETS.find((x) => Math.abs(x.h - target) < 1e-6)?.id ?? null;
  const vehicleName = t.vehicles[vehicle];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{t.presetsLabel}</GroupLabel>
          <Segmented
            label={t.presetsLabel}
            className="grid-cols-2 lg:grid-cols-4"
            size="lg"
            value={presetId}
            onChange={pickPreset}
            accent="#22d3ee"
            options={PRESETS.map((x) => ({ value: x.id, label: t.presets[x.id].name, sub: t.presets[x.id].sub, icon: x.icon }))}
          />
        </div>
        <PlayControls
          labels={{ start: t.dive, pause: T.common.pause, resume: T.common.resume, again: t.again, reset: t.surface }}
          running={running}
          done={atTarget && depth > 0}
          started={depth > 0}
          onToggle={toggle}
          onReset={reset}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <SeaScene
          T={T}
          depth={depth}
          Dv={Dv}
          vehicle={vehicle}
          running={running}
          factor={sim.factor}
          wave={sim.wave}
          ariaLabel={plain(t.scene.aria(hS, `${pS.v} ${pS.u}`, atmS))}
        />
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LineGraph
            idKey="hp-sea"
            title={t.graph.title}
            series={[
              { id: 'p0', color: PC.atmText, points: [{ x: 0, y: P0 / unitDiv }, { x: Dv, y: P0 / unitDiv }], dash: '3 4', width: 1.4, opacity: 0.8 },
              { id: 'p', color: '#a78bfa', points: [{ x: 0, y: P0 / unitDiv }, { x: Dv, y: (P0 + RHO * G * Dv) / unitDiv }] },
            ]}
            dots={[
              ...PRESETS.filter((x) => x.h <= Dv * 0.98 && x.h >= Dv * 0.08).map((x) => ({
                id: x.id,
                x: x.h,
                y: (P0 + RHO * G * x.h) / unitDiv,
                color: '#475569',
                r: 3.5,
                label: t.presets[x.id].dot,
                textColor: '#94a3b8',
              })),
              { id: 'now', x: depth, y: p / unitDiv, color: '#c4b5fd' },
            ]}
            marker={depth}
            xMax={Dv}
            yMax={gMax}
            xLabel={t.graph.x}
            yLabel={big ? t.graph.yM : t.graph.yk}
            height={300}
            decimal={dec}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
        </div>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.h} symbol="h" value={hS} unit={T.m} accent={SEA.chip} textColor={SEA.text} sub={vehicleName} />
        <Readout
          label={t.readouts.p}
          symbol={<Rich>p₀ + ρgh</Rich>}
          value={pS.v}
          unit={pS.u}
          accent={PC.total}
          textColor={PC.totalText}
          active={!running && !!presetHere}
          sub={<Rich>{t.sub.p(fmtPress(ph, T, dec).v + ' ' + fmtPress(ph, T, dec).u)}</Rich>}
        />
        <Readout label={t.readouts.atm} symbol="p / p₀" value={atmS} unit={T.atm} accent={PC.atm} textColor={PC.atmText} sub={t.sub.atm} />
        <Readout label={t.readouts.F} symbol="F" value={FS.v} unit={FS.u} accent={PC.hydro} textColor={PC.hydroText} sub={t.sub.F(tonsS)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="hp-sea-depth"
            label={t.depthLabel}
            symbol="h"
            min={0}
            max={1}
            step={0.001}
            value={toU(depth)}
            onChange={onSlider}
            accent={SEA.chip}
            display={`${hS} ${T.m}`}
            valueText={`${hS} ${T.m}`}
            hint={t.depthHint}
          />
        </div>
        <div className="lg:col-span-3 grid gap-2 sm:grid-cols-2">
            <FormulaTile
              tag={t.f.p.tag}
              color={PC.totalText}
              general={t.f.p.general}
              filled={t.f.p.filled(hS, fmtPress(ph, T, dec).v + ' ' + fmtPress(ph, T, dec).u, `${pS.v} ${pS.u}`)}
              ok={!running && !!presetHere}
            />
            <FormulaTile tag={t.f.F.tag} color={PC.hydroText} general={t.f.F.general} filled={t.f.F.filled(`${FS.v} ${FS.u}`, tonsS)} ok={!running && !!presetHere} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function Vehicle({ kind, x, y, s }) {
  if (kind === 'diver') {
    return (
      <g transform={`translate(${x},${y}) scale(${s})`}>
        <ellipse cx={-2} cy={0} rx={16} ry={5.5} fill="#1e293b" />
        <rect x={-12} y={-10} width={14} height={5} rx={2.5} fill="#facc15" stroke="#a16207" strokeWidth={0.8} />
        <circle cx={17} cy={-1} r={5} fill="#1e293b" />
        <rect x={17} y={-4} width={5} height={4} rx={1} fill="#7dd3fc" stroke="#0f172a" strokeWidth={0.6} />
        <path d="M-17,0 L-28,-5 L-28,5 Z" fill="#0f172a" />
        <path d="M2,4 L8,10" stroke="#1e293b" strokeWidth={3} strokeLinecap="round" />
        <circle cx={24} cy={-10} r={1.6} fill="#e0f2fe" opacity="0.8" />
        <circle cx={27} cy={-16} r={1.2} fill="#e0f2fe" opacity="0.7" />
      </g>
    );
  }
  if (kind === 'sub') {
    return (
      <g transform={`translate(${x},${y}) scale(${s})`}>
        <rect x={-30} y={-8} width={60} height={16} rx={8} fill="#334155" stroke="#0f172a" strokeWidth={1} />
        <rect x={-6} y={-16} width={14} height={9} rx={2} fill="#334155" stroke="#0f172a" strokeWidth={1} />
        <path d="M-30,0 L-38,-6 L-38,6 Z" fill="#1e293b" />
        <rect x={6} y={-5} width={8} height={8} fill="#fbbf24" stroke="#92400e" strokeWidth={1} />
        <circle cx={-14} cy={0} r={2} fill="#7dd3fc" />
        <circle cx={-20} cy={0} r={2} fill="#7dd3fc" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-30} y={-16} width={60} height={14} rx={7} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
      <rect x={-3} y={-2} width={6} height={5} fill="#64748b" />
      <circle cx={0} cy={11} r={9} fill="#475569" stroke="#0f172a" strokeWidth={1} />
      <rect x={-3.5} y={7.5} width={7} height={7} fill="#fbbf24" stroke="#92400e" strokeWidth={0.8} />
      <circle cx={6} cy={7} r={1.6} fill="#7dd3fc" />
    </g>
  );
}

function SeaScene({ T, depth, Dv, vehicle, running, factor, wave, ariaLabel }) {
  const t = T.sea;
  const dec = T.decimal;
  const legend = [
    { label: t.legend.p, color: PC.hydro, kind: 'arrow' },
    { label: t.legend.atm, color: PC.atm, kind: 'arrow' },
    { label: t.legend.hatch, color: '#fbbf24', kind: 'swatch' },
  ];
  const chips = running ? <Chip icon={Timer}>{t.scene.speedChip(groupThousands(factor))}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 1.2, 400, 480) : clamp(W * 0.64, 440, 540))}>
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const pad = narrow ? { l: 46, r: 50, t: 50, b: 14 } : { l: 64, r: 70, t: 64, b: 16 };
        const sky = narrow ? 50 : 62;
        const ySurf = pad.t + sky;
        const k = (H - pad.b - ySurf) / Dv;
        const sy = (d) => ySurf + d * k;
        const xL = pad.l;
        const xR = W - pad.r;
        const cx = (xL + xR) / 2;

        /* gradient of the water by absolute depth */
        const stops = [];
        for (let i = 0; i <= 8; i += 1) stops.push(<stop key={i} offset={`${(i / 8) * 100}%`} stopColor={seaColour((Dv * i) / 8)} />);

        /* left axis: depth; right axis: pressure in atm — the same lines */
        const ticks = [];
        const step = niceStep(k, narrow ? 34 : 42);
        for (let d = 0; d <= Dv + 1e-9; d += step) {
          const y = sy(d);
          if (y > H - pad.b - 4) break;
          ticks.push(
            <g key={`d${d}`}>
              <line x1={xL - 6} x2={xL} y1={y} y2={y} stroke="#64748b" />
              <text x={xL - 9} y={y + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
                {d >= 1000 ? groupThousands(d) : fmt(d, step < 1 ? 1 : 0, dec)}
              </text>
            </g>,
          );
        }
        const mPerAtm = P0 / (RHO * G);
        const aMax = 1 + Dv / mPerAtm;
        const aStep = niceStep(k * mPerAtm, narrow ? 34 : 42);
        const atmTicks = [1];
        for (let a = aStep; a <= aMax + 1e-9; a += aStep) if (a > 1 + 1e-9) atmTicks.push(a);
        const aTicks = atmTicks.map((a) => {
          const y = sy((a - 1) * mPerAtm);
          if (y > H - pad.b - 4 || (a !== 1 && y - ySurf < 14)) return null;
          return (
            <g key={`a${a}`}>
              <line x1={xR} x2={xR + 6} y1={y} y2={y} stroke="#0284c7" />
              <text x={xR + 9} y={y + 4} fontSize={fs - 1} fill="#0369a1">
                {a >= 1000 ? groupThousands(a) : fmt(a, aStep < 1 ? 1 : 0, dec)}
              </text>
            </g>
          );
        });

        /* the vehicle and the pressure on it */
        const vy = sy(depth);
        const sc = narrow ? 0.8 : 1.1;
        const ratio = (P0 + RHO * G * depth) / P0;
        const L = 8 + 9 * Math.log10(ratio);
        const R = (vehicle === 'sub' ? 40 : vehicle === 'bathy' ? 33 : 30) * sc;
        const Ry = (vehicle === 'sub' ? 20 : vehicle === 'bathy' ? 24 : 16) * sc;
        const arrows = [];
        if (depth > 0.3) {
          for (let i = 0; i < 8; i += 1) {
            const a = (i * Math.PI) / 4;
            const ex = Math.cos(a);
            const ey = Math.sin(a);
            const hx = cx + ex * (R + 4);
            const hy = vy + ey * (Ry + 4);
            arrows.push(<Arrow key={i} x1={hx + ex * L} y1={hy + ey * L} x2={hx} y2={hy} color={PC.hydro} width={2.4} head={8} />);
          }
        }
        const atmArrows = [];
        const nA = narrow ? 5 : 8;
        for (let i = 0; i < nA; i += 1) {
          const x = xL + ((i + 0.5) * (xR - xL)) / nA;
          atmArrows.push(<Arrow key={i} x1={x} y1={ySurf - (narrow ? 22 : 28)} x2={x} y2={ySurf - 3} color={PC.atm} width={2} head={7} />);
        }
        const floorVisible = sy(MAXD) < H - pad.b + 2;
        const yFloor = sy(MAXD);
        const pS = fmtPress(P0 + RHO * G * depth, T, dec);
        const hLabel = depth >= 100 ? groupThousands(depth) : fmt(depth, depth < 10 && depth % 1 ? 1 : 0, dec);
        const pillY = vy + Ry + L + (narrow ? 20 : 24) > H - pad.b - 12 ? vy - Ry - L - (narrow ? 20 : 24) : vy + Ry + L + (narrow ? 20 : 24);

        return (
          <g>
            <defs>
              <linearGradient id="hp-sea-water" x1="0" y1="0" x2="0" y2="1">
                {stops}
              </linearGradient>
              <linearGradient id="hp-sea-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <rect x={xL} y={pad.t - 10} width={xR - xL} height={ySurf - pad.t + 10} fill="url(#hp-sea-sky)" />
            <rect x={xL} y={ySurf} width={xR - xL} height={H - pad.b - ySurf} fill="url(#hp-sea-water)" />
            <path d={surfacePath(xL, xR, ySurf, 1.6, wave * 2.2, 40)} fill="none" stroke="#0369a1" strokeWidth={2} />
            {atmArrows}
            <RichPill x={cx} y={pad.t + (narrow ? 4 : 6)} text={t.scene.atm(fmt(P0 / 1000, 1, dec))} bg={PC.atm} size={fs - 1} box={box} />

            {floorVisible && (
              <g>
                <path
                  d={`M${xL},${H - pad.b} L${xL},${yFloor - 8} L${xL + (xR - xL) * 0.25},${yFloor - 2} L${xL + (xR - xL) * 0.5},${yFloor} L${xL + (xR - xL) * 0.78},${yFloor - 5} L${xR},${yFloor - 12} L${xR},${H - pad.b} Z`}
                  fill="#3f3a36"
                  opacity="0.92"
                />
                <text x={xR - 8} y={H - pad.b - 7} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#e7e5e4">
                  {t.scene.trench}
                </text>
              </g>
            )}

            {/* axes */}
            <line x1={xL} x2={xL} y1={ySurf} y2={H - pad.b} stroke="#94a3b8" />
            <line x1={xR} x2={xR} y1={ySurf} y2={H - pad.b} stroke="#7dd3fc" />
            {ticks}
            {aTicks}
            <text x={xL - 9} y={ySurf - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.scene.depthAxis}
            </text>
            <text x={xR + 9} y={ySurf - 8} fontSize={fs - 1} fontWeight="700" fill="#0369a1">
              {t.scene.atmAxis}
            </text>

            {/* depth line from the surface to the vehicle */}
            {depth > 0.3 && (
              <g>
                <line x1={cx - R - 26} x2={cx - R - 26} y1={ySurf} y2={vy} stroke="#e2e8f0" strokeWidth={1.3} strokeDasharray="4 4" opacity="0.8" />
                {vy - ySurf > 36 && (
                  <RichPill x={cx - R - 32} y={(ySurf + vy) / 2} anchor="end" text={t.scene.hTag(hLabel)} bg="#0f172a" size={fs - 1} box={box} />
                )}
              </g>
            )}

            {arrows}
            <Vehicle kind={vehicle} x={cx} y={vy} s={sc} />
            {depth > 0.3 && (
              <RichPill x={cx} y={pillY} text={t.scene.pTag(`${pS.v} ${pS.u}`)} bg={PC.total} size={fs - 1} box={box} />
            )}
            <text x={xL + 6} y={floorVisible ? ySurf + fs + 8 : H - pad.b - 6} fontSize={fs - 2} fill="#e2e8f0" opacity="0.8">
              {t.scene.noScale}
            </text>
          </g>
        );
      }}
    </LabScene>
  );
}
