import { useState } from 'react';
import { Building2, Lightbulb, Mountain, MountainSnow, Plane, Sigma, Waves } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  Formula,
  SidePill,
  GroupLabel,
  H_SCALE,
  HaloText,
  LabScene,
  LiveGraph,
  MMHG,
  P0,
  P0_MM,
  PC,
  PaperGrid,
  RHO_AIR0,
  pAt,
  seeded,
  smart,
  whole,
} from './AtmosphericPressure.parts';

/**
 * Tab 2 — the pressure falls as we climb, because less air is left above
 * us. Model (stated on screen): an isothermal atmosphere at 0 °C,
 * p = p₀·e^(−h/H) with H = 8 km, and the air density falls the same way,
 * ρ = 1.29·e^(−h/H) kg/m³. Near the ground the textbook rule "about 1 mm Hg
 * less every 12 m" is drawn as a dashed line beside the curve.
 *
 * Places: sea level 0 m → 101.3 kPa, 760 mm Hg; Tashkent 450 m →
 * 101.3·e^(−0.05625) = 95.8 kPa = 718 mm (the 12 m rule: 760 − 37.5 ≈
 * 722 mm); Big Chimgan 3309 m → 67.0 kPa = 503 mm; Everest 8849 m →
 * 33.5 kPa = 251 mm; an airliner at 10 000 m → 29.0 kPa = 218 mm.
 * Water boils (Antoine's formula) at ≈ 100, 98.5, 89, 72 and 69 °C there.
 */

const PLACES = [
  { id: 'sea', h: 0, x: 0.105, icon: Waves },
  { id: 'tashkent', h: 450, x: 0.22, icon: Building2 },
  { id: 'chimgan', h: 3309, x: 0.4, icon: Mountain },
  { id: 'everest', h: 8849, x: 0.655, icon: MountainSnow },
  { id: 'plane', h: 10000, x: 0.845, icon: Plane },
];
const H_MAX = 11000;
const Y_TOP = 11.6; // km shown in the landscape
const Y_BOT = -0.45; // km, the sea floor strip
// terrain profile: [x fraction, altitude km]
const TERRAIN = [
  [0, 0], [0.135, 0], [0.155, 0.22], [0.18, 0.44], [0.265, 0.47], [0.3, 0.9], [0.345, 2.0], [0.375, 2.9], [0.4, 3.309],
  [0.425, 2.7], [0.46, 2.05], [0.5, 2.6], [0.54, 4.2], [0.58, 5.9], [0.62, 7.6], [0.655, 8.849], [0.69, 7.7],
  [0.73, 6.4], [0.77, 6.9], [0.82, 5.3], [0.9, 4.3], [1, 3.7],
];

/** Boiling point of water (°C) at a pressure in mm Hg, Antoine's formula. */
const boil = (mm) => 1730.63 / (8.07131 - Math.log10(mm)) - 233.426;
/** The marker's x (fraction of the landscape) for a height, through the places. */
function xForH(h) {
  if (h <= 0) return PLACES[0].x;
  for (let i = 1; i < PLACES.length; i += 1) {
    const a = PLACES[i - 1];
    const b = PLACES[i];
    if (h <= b.h) return a.x + ((h - a.h) / (b.h - a.h)) * (b.x - a.x);
  }
  return PLACES[PLACES.length - 1].x;
}
function terrainAt(xf) {
  for (let i = 1; i < TERRAIN.length; i += 1) {
    const [x0, y0] = TERRAIN[i - 1];
    const [x1, y1] = TERRAIN[i];
    if (xf <= x1) return y0 + ((xf - x0) / (x1 - x0)) * (y1 - y0);
  }
  return TERRAIN[TERRAIN.length - 1][1];
}

export default function AltitudeSim({ T }) {
  const C = T.alt;
  const dec = T.decimal;
  const [hT, setHT] = useState(3309);
  const [hD, setHD] = useState(3309);

  useRafLoop(Math.abs(hT - hD) > 0.01, (dt) => {
    setHD((h) => {
      const next = h + (hT - h) * (1 - Math.exp(-dt * 2.6));
      return Math.abs(hT - next) < 2 ? hT : next;
    });
  });

  const place = PLACES.find((p) => p.h === hT)?.id ?? null;
  const p = pAt(hD);
  const mm = p / MMHG;
  const rho = RHO_AIR0 * Math.exp(-hD / H_SCALE);
  const pct = (p / P0) * 100;
  const moving = Math.abs(hT - hD) > 25;

  /* ---- explanation */
  let key = place ?? 'custom';
  if (moving) key = hT > hD ? 'up' : 'down';
  const settled = useSettled(key, moving ? 120 : 300);
  const pT = pAt(hT);
  const vals = {
    h: whole(hT, dec),
    kpa: fmt(pT / 1000, 1, dec),
    mm: whole(pT / MMHG, dec),
    pct: whole((pT / P0) * 100, dec),
    rule: whole(P0_MM - hT / 12, dec),
    tb: whole(boil(pT / MMHG), dec),
  };
  const text = C.explain[settled](vals);
  const tone = settled === 'up' || settled === 'down' ? '#fbbf24' : settled === 'plane' ? '#a78bfa' : settled === 'sea' ? '#34d399' : '#22d3ee';

  /* ---- graph p(h) in mm Hg, the 12 m rule dashed */
  const curve = Array.from({ length: 56 }, (_, i) => {
    const h = (i / 55) * H_MAX;
    return { x: h / 1000, y: pAt(h) / MMHG };
  });
  const rule = [
    { x: 0, y: P0_MM },
    { x: (P0_MM * 12) / 1000, y: 0 },
  ];
  const dots = PLACES.map((pl) => ({
    id: pl.id,
    x: pl.h / 1000,
    y: pAt(pl.h) / MMHG,
    color: pl.id === place ? '#22d3ee' : '#94a3b8',
    r: pl.id === place ? 5 : 3.5,
    label: pl.id === place ? `${whole(pAt(pl.h) / MMHG, dec)} ${T.mmHg}` : undefined,
    anchor: pl.h > 9000 ? 'end' : 'start',
    dx: pl.h > 9000 ? -8 : 8,
    dy: -8,
    textColor: '#a5f3fc',
  }));
  dots.push({ id: 'now', x: hD / 1000, y: mm, color: '#f472b6', r: 5.5 });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <GroupLabel>{C.placesLabel}</GroupLabel>
        <Segmented
          label={C.placesLabel}
          className="grid-cols-2 md:grid-cols-5"
          size="lg"
          value={place}
          onChange={(id) => setHT(PLACES.find((pl) => pl.id === id).h)}
          options={PLACES.map((pl) => ({
            value: pl.id,
            label: C.places[pl.id],
            sub: C.placeSub(whole(pl.h, dec), whole(pAt(pl.h) / MMHG, dec)),
            icon: pl.icon,
          }))}
        />
      </div>

      <AltitudeScene T={T} hD={hD} hT={hT} place={place} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={C.readouts.h}
          symbol="h"
          value={whole(hD, dec)}
          unit={T.m}
          accent={PC.h}
          textColor={PC.hText}
          sub={place ? C.places[place] : C.readouts.hSub}
        />
        <Readout
          label={C.readouts.p}
          symbol="p"
          value={fmt(p / 1000, 1, dec)}
          unit={T.kPa}
          accent={PC.atm}
          textColor={PC.atmText}
          active={!moving}
          sub={
            <>
              {C.readouts.pSub(fmt(mm, 0, dec), whole(pct, dec))}
              <br />
              <span className="text-gray-500">{C.readouts.boil(whole(boil(mm), dec))}</span>
            </>
          }
        />
        <Readout
          label={C.readouts.rho}
          symbol="ρ"
          value={fmt(rho, 2, dec)}
          unit={T.kgm3}
          accent={PC.rho}
          textColor={PC.rhoText}
          sub={C.readouts.rhoSub(fmt(RHO_AIR0, 2, dec), fmt(rho, 2, dec))}
        />
        <Readout label={C.readouts.formula} accent={PC.atm}>
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text="p = p₀·e" />
              <sup className="font-serif italic">−h/H</sup>
            </p>
            <p className="tabular-nums text-gray-400">
              {fmt(P0 / 1000, 1, dec)}·e<sup>−{smart(hD / 1000, dec, 2)}/8</sup> = <b style={{ color: PC.atmText }}>{fmt(p / 1000, 1, dec)}</b> {T.kPa}
            </p>
            <p className="text-xs text-gray-500">{hD <= 1500 ? C.readouts.rule(whole(hD, dec), whole(P0_MM - hD / 12, dec)) : C.readouts.model}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="atm-alt-h"
            label={C.slider}
            symbol="h"
            min={0}
            max={H_MAX}
            step={10}
            value={hT}
            onChange={setHT}
            accent={PC.h}
            display={`${whole(hT, dec)} ${T.m}`}
            hint={C.sliderHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{C.table.title}</p>
            <ul className="mt-1.5 space-y-1">
              {PLACES.map((pl) => {
                const on = pl.id === place;
                const pp = pAt(pl.h);
                return (
                  <li
                    key={pl.id}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[13px] tabular-nums transition-colors ${on ? 'bg-white/10 text-white' : 'text-gray-400'}`}
                  >
                    <span>{C.table.row(C.places[pl.id], whole(pl.h, dec))}</span>
                    <span style={{ color: on ? PC.atmText : undefined }}>
                      {whole(pp / MMHG, dec)} {T.mmHg} · {fmt(pp / 1000, 1, dec)} {T.kPa}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-xs text-gray-500">{C.table.note}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LiveGraph
            title={C.graph.title}
            series={[
              { id: 'model', label: C.graph.model, color: '#38bdf8', points: curve },
              { id: 'rule', label: C.graph.rule, color: 'rgba(148,163,184,0.85)', points: rule, dash: '6 5', width: 1.8 },
            ]}
            dots={dots}
            xMax={H_MAX / 1000}
            yMax={800}
            xTicks={[0, 2, 4, 6, 8, 10]}
            xLabel={C.graph.x}
            yLabel={C.graph.y}
            marker={hD / 1000}
            decimal={dec}
            ariaLabel={C.graph.label}
            note={C.graph.note}
            height={250}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

function AltitudeScene({ T, hD, hT, place }) {
  const C = T.alt;
  const dec = T.decimal;
  const p = pAt(hD);
  const mm = p / MMHG;

  return (
    <LabScene
      legend={[
        { color: PC.air, label: C.legend.air, kind: 'dot' },
        { color: '#f472b6', label: C.legend.marker, kind: 'dot' },
        { color: PC.h, label: C.legend.h, kind: 'dash' },
      ]}
      chips={
        <>
          <Chip icon={Sigma} color={PC.atm}>
            {C.chipModel}
          </Chip>
          <Chip icon={Mountain} color={PC.atm} strong>
            {C.chipNow(whole(hD, dec), whole(mm, dec))}
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? clamp(W * 1.62, 540, 640) : clamp(W * 0.5, 480, 580))}
      ariaLabel={C.sceneLabel(whole(hD, dec), fmt(p / 1000, 1, dec), whole(mm, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const topPad = narrow ? 64 : 84;
        const landW = narrow ? W : Math.round(W * 0.57);
        const landH = narrow ? Math.round(H * 0.56) : H;
        const groundPad = narrow ? 14 : 26;
        const axisL = narrow ? 34 : 44;
        const lx0 = axisL;
        const lx1 = landW - (narrow ? 8 : 14);
        const kY = (landH - groundPad - topPad) / (Y_TOP - Y_BOT);
        const sy = (km) => landH - groundPad - (km - Y_BOT) * kY;
        const sx = (f) => lx0 + f * (lx1 - lx0);
        const box = { w: landW, h: landH };

        /* terrain path */
        const pts = TERRAIN.map(([f, km]) => `${sx(f).toFixed(1)},${sy(km).toFixed(1)}`);
        const terrain = `M${sx(0)},${landH} L${pts.join(' L')} L${sx(1)},${landH} Z`;

        /* air dots, thinner with height (exponential in height), kept out of the ground */
        const rnd = seeded(23);
        const air = [];
        const nAir = narrow ? 170 : 300;
        const norm = 1 - Math.exp(-Y_TOP / 8);
        for (let i = 0; i < nAir; i += 1) {
          const f = rnd();
          const km = -8 * Math.log(1 - rnd() * norm);
          if (km > terrainAt(f) + 0.12) air.push({ x: sx(f), y: sy(km) });
        }

        const mx = sx(xForH(hD));
        const myKm = hD / 1000;
        const my = sy(myKm);
        const markerScale = narrow ? 0.8 : 1;

        /* instruments area */
        const ix0 = narrow ? 10 : landW + 12;
        const ix1 = W - (narrow ? 10 : 16);
        const iy0 = narrow ? landH + 14 : topPad + 4;
        const iy1 = H - (narrow ? 14 : 22);

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={lx0} y0={sy(Y_TOP)} x1={lx1} y1={sy(0)} cell={kY} ax={lx0} ay={sy(0)} />

            {/* altitude axis */}
            <g aria-hidden="true">
              {[0, 2, 4, 6, 8, 10].map((km) => (
                <g key={`ax${km}`}>
                  <line x1={lx0 - 5} x2={lx0} y1={sy(km)} y2={sy(km)} stroke="#64748b" />
                  <text x={lx0 - 8} y={sy(km) + 4} textAnchor="end" fontSize={fs - 1} fill={km === 0 ? '#0f172a' : '#64748b'} fontWeight={km === 0 ? 700 : 400}>
                    {km}
                  </text>
                </g>
              ))}
              <line x1={lx0} x2={lx0} y1={sy(Y_TOP)} y2={sy(0)} stroke="#94a3b8" />
              <text x={lx0 - 8} y={sy(Y_TOP) + 2} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
                {C.axisKm}
              </text>
            </g>

            {/* air */}
            <g aria-hidden="true">
              {air.map((d, i) => (
                <circle key={`a${i}`} cx={d.x} cy={d.y} r={narrow ? 1.5 : 1.9} fill={PC.air} opacity="0.55" />
              ))}
            </g>

            {/* sea and land */}
            <rect x={lx0} y={sy(0)} width={sx(0.15) - lx0} height={landH - sy(0)} fill="#bfdbfe" />
            <path d={terrain} fill="#e7e5e4" stroke="#78716c" strokeWidth="1.4" strokeLinejoin="round" />
            <SnowCaps sx={sx} sy={sy} />
            <City x={sx(0.22)} y={sy(0.47)} s={markerScale} />
            <line x1={lx0} x2={sx(0.15)} y1={sy(0)} y2={sy(0)} stroke="#3b82f6" strokeWidth="1.4" />
            <Airliner x={sx(0.93)} y={sy(10)} s={narrow ? 0.75 : 1} />

            {/* place labels */}
            {PLACES.map((pl) => {
              const on = pl.id === place;
              const pos = {
                sea: { x: sx(pl.x), y: sy(0) + (narrow ? 10 : 12), side: 0 },
                tashkent: { x: sx(0.22) + 32 * markerScale, y: sy(0.47) - 20, side: 1 },
                chimgan: { x: sx(0.4) - 16 * markerScale, y: sy(3.309) - 22, side: -1 },
                everest: { x: sx(0.655) - 16 * markerScale, y: sy(8.849) - 22, side: -1 },
                plane: { x: sx(0.93), y: sy(10) + (narrow ? 22 : 26), side: 0 },
              }[pl.id];
              const label = narrow ? C.placesShort[pl.id] : C.placeTag(C.places[pl.id], whole(pl.h, dec));
              return <SidePill key={pl.id} x={pos.x} y={pos.y} side={pos.side} gap={0} text={label} bg={on ? '#0f172a' : 'rgba(100,116,139,0.85)'} fs={fs - 1} box={box} />;
            })}

            {/* the current height */}
            <line x1={lx0} x2={lx1} y1={my} y2={my} stroke={PC.h} strokeWidth="1.3" strokeDasharray="6 5" opacity="0.8" />
            <Balloon x={mx} y={my} s={markerScale} />
            {!narrow && <Pill x={lx0 + 52} y={my - 12} text={`h = ${whole(hD, dec)} ${T.m}`} bg={PC.h} size={fs} box={box} />}
            {Math.abs(hT - hD) > 25 && (
              <HaloText x={mx + 24 * markerScale} y={my - 30 * markerScale} anchor="start" color="#be185d" fs={fs}>
                {hT > hD ? '↑' : '↓'}
              </HaloText>
            )}

            {!narrow && <line x1={landW} x2={landW} y1={topPad - 10} y2={H - 16} stroke="#e2e8f0" strokeWidth="1.5" />}
            {narrow && <line x1={8} x2={W - 8} y1={landH + 2} y2={landH + 2} stroke="#e2e8f0" strokeWidth="1.5" />}

            <Instruments T={T} x0={ix0} x1={ix1} y0={iy0} y1={iy1} mm={mm} hD={hD} narrow={narrow} fs={fs} />
          </>
        );
      }}
    </LabScene>
  );
}

/** Snow on the two high peaks. */
function SnowCaps({ sx, sy }) {
  const cap = (pts) => `M${pts.map(([f, km]) => `${sx(f).toFixed(1)},${sy(km).toFixed(1)}`).join(' L')} Z`;
  return (
    <g aria-hidden="true">
      <path d={cap([[0.375, 2.9], [0.4, 3.309], [0.418, 2.86], [0.405, 2.95], [0.392, 2.84]])} fill="#ffffff" stroke="#a8a29e" strokeWidth="0.8" />
      <path d={cap([[0.6, 6.8], [0.62, 7.6], [0.655, 8.849], [0.69, 7.7], [0.705, 7.2], [0.67, 7.5], [0.645, 7.2], [0.625, 7.4]])} fill="#ffffff" stroke="#a8a29e" strokeWidth="0.8" />
    </g>
  );
}

/** A small skyline for Tashkent. */
function City({ x, y, s }) {
  const b = [
    [-26, 10, 14], [-14, 9, 24], [-4, 8, 16], [5, 9, 30], [15, 8, 12], [24, 9, 20],
  ];
  return (
    <g aria-hidden="true">
      {b.map(([dx, w, h]) => (
        <rect key={dx} x={x + dx * s} y={y - h * s} width={w * s} height={h * s} fill="#94a3b8" stroke="#64748b" strokeWidth="0.6" />
      ))}
      <rect x={x + 7.5 * s} y={y - 38 * s} width={4 * s} height={8 * s} fill="#64748b" />
    </g>
  );
}

/** Side view of an airliner. */
function Airliner({ x, y, s }) {
  return (
    <g aria-hidden="true" transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-34,0 Q-36,-5 -28,-6 L22,-6 Q34,-6 38,0 Q34,5 22,5 L-28,5 Q-36,5 -34,0 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
      <path d="M-28,-6 L-36,-18 L-30,-18 L-18,-6 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <path d="M-4,1 L-18,14 L-10,14 L10,1 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      {[-20, -12, -4, 4, 12, 20].map((dx) => (
        <circle key={dx} cx={dx} cy={-2} r={1.4} fill="#0ea5e9" />
      ))}
    </g>
  );
}

/** A hot-air balloon whose basket floor sits at (x, y). */
function Balloon({ x, y, s }) {
  return (
    <g aria-hidden="true" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`}>
      <ellipse cx={0} cy={-36} rx={15} ry={17} fill="#f472b6" stroke="#be185d" strokeWidth="1.4" />
      <path d="M-9,-49 Q0,-60 9,-49 L5,-22 L-5,-22 Z" fill="#fbcfe8" opacity="0.8" />
      <line x1={-10} y1={-24} x2={-5} y2={-9} stroke="#7c2d12" strokeWidth="1" />
      <line x1={10} y1={-24} x2={5} y2={-9} stroke="#7c2d12" strokeWidth="1" />
      <rect x={-6} y={-9} width={12} height={9} rx={1.5} fill="#a16207" stroke="#713f12" strokeWidth="1" />
    </g>
  );
}

/**
 * The instruments that travel with the balloon: an aneroid barometer (its
 * corrugated box swells as the pressure falls and turns the needle), a
 * mercury barometer and a sample of the air with molecules as dots.
 */
function Instruments({ T, x0, x1, y0, y1, mm, hD, narrow, fs }) {
  const C = T.alt;
  const dec = T.decimal;
  const w = x1 - x0;
  const h = y1 - y0;
  // dial
  const R = narrow ? clamp(Math.min(w * 0.24, h * 0.36), 52, 78) : clamp(Math.min(w * 0.25, h * 0.27), 70, 112);
  const cx = narrow ? x0 + R + 8 : x0 + w * 0.34;
  const cy = narrow ? y0 + R + 22 : y0 + R + 28;
  // mercury barometer
  const tx = narrow ? x1 - 30 : x0 + w * 0.84;
  const tTop = y0 + (narrow ? 22 : 30);
  const tBase = y1 - (narrow ? 22 : 30);
  // sample box
  const bs = narrow ? clamp(w - 2 * R - 90, 64, 96) : clamp(w * 0.3, 90, 130);
  const bx = narrow ? cx + R + 16 : cx - bs / 2;
  const by = narrow ? cy - bs / 2 + 10 : cy + R + 46;

  return (
    <g aria-hidden="true">
      <Aneroid cx={cx} cy={cy} R={R} mm={mm} fs={fs} C={C} T={T} />
      <text x={cx} y={cy - R - 18} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
        {C.inst.aneroid}
      </text>
      <MercuryBarometer x={tx} top={tTop} base={tBase} mm={mm} fs={fs} T={T} dec={dec} title={C.inst.mercury} narrow={narrow} />
      <AirSample x={bx} y={by} s={bs} rhoRatio={Math.exp(-hD / H_SCALE)} fs={fs} title={C.inst.sample} caption={C.inst.sampleSub(fmt(RHO_AIR0 * Math.exp(-hD / H_SCALE), 2, dec))} />
    </g>
  );
}

function Aneroid({ cx, cy, R, mm, fs, C, T }) {
  const lo = 150;
  const hi = 800;
  const ang = (v) => ((225 - ((v - lo) / (hi - lo)) * 270) * Math.PI) / 180;
  const pt = (v, r) => ({ x: cx + Math.cos(ang(v)) * r, y: cy - Math.sin(ang(v)) * r });
  const ticks = [];
  for (let v = lo; v <= hi; v += 10) {
    const major = v % 50 === 0;
    const a = pt(v, R * 0.86);
    const b = pt(v, R * (major ? 0.74 : 0.8));
    ticks.push(<line key={`t${v}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#334155" strokeWidth={major ? 1.6 : 0.8} />);
    if (v % 100 === 0) {
      const l = pt(v, R * 0.62);
      ticks.push(
        <text key={`l${v}`} x={l.x} y={l.y + fs * 0.35} textAnchor="middle" fontSize={fs - 1.5} fontWeight="600" fill="#334155">
          {v}
        </text>,
      );
    }
  }
  // kPa marks just outside the mm scale
  const kpa = [20, 40, 60, 80, 100].map((k) => {
    const v = (k * 1000) / MMHG;
    const a = pt(v, R * 0.885);
    const b = pt(v, R * 0.925);
    const l = pt(v, R * 0.965);
    return (
      <g key={`k${k}`}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PC.atm} strokeWidth="1.4" />
        <text x={l.x} y={l.y + 3} textAnchor="middle" fontSize={fs - 3} fill={PC.atm} fontWeight="700">
          {k}
        </text>
      </g>
    );
  });
  const needle = pt(clamp(mm, lo, hi), R * 0.8);
  const tail = pt(clamp(mm, lo, hi), -R * 0.18);
  const normA = pt(760, R * 0.86);
  const normB = pt(760, R * 0.97);
  // the aneroid box, thicker as the pressure falls
  const bw = R * 0.62;
  const bh = R * (0.11 + 0.13 * (1 - clamp(mm / 760, 0, 1)));
  const bTop = cy + R * 0.66 - bh;
  const zig = (side) => {
    const x = cx + (side * bw) / 2;
    const n = 4;
    let d = `M${x},${bTop}`;
    for (let i = 1; i <= n; i += 1) d += ` L${x + side * (i % 2 ? 4 : 0)},${bTop + (bh * i) / n}`;
    return d;
  };
  return (
    <g>
      <circle cx={cx} cy={cy} r={R + 9} fill="#d6a756" stroke="#92400e" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={R + 2} fill="#fffdf7" stroke="#b45309" strokeWidth="1.2" />
      {ticks}
      {kpa}
      <line x1={normA.x} y1={normA.y} x2={normB.x} y2={normB.y} stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" />
      <text x={cx} y={cy - R * 0.28} textAnchor="middle" fontSize={fs - 2} fill="#64748b">
        {T.mmHg}
      </text>
      <text x={cx} y={cy + R * 0.3} textAnchor="middle" fontSize={fs - 2.5} fill={PC.atm} fontWeight="700">
        {T.kPa}
      </text>
      {/* aneroid box with its lever */}
      <rect x={cx - bw / 2 - 4} y={cy + R * 0.66} width={bw + 8} height={3} fill="#78716c" />
      <path d={zig(-1)} fill="none" stroke="#57534e" strokeWidth="1.2" />
      <path d={zig(1)} fill="none" stroke="#57534e" strokeWidth="1.2" />
      <rect x={cx - bw / 2} y={bTop - 2} width={bw} height={3} rx={1} fill="#a8a29e" stroke="#57534e" strokeWidth="0.8" />
      <line x1={cx} y1={bTop - 2} x2={cx} y2={cy + 6} stroke="#57534e" strokeWidth="1" strokeDasharray="2 2" />
      <text x={cx} y={cy + R * 0.66 + 14} textAnchor="middle" fontSize={fs - 2.5} fill="#78716c">
        {C.inst.box}
      </text>
      {/* needle */}
      <line x1={tail.x} y1={tail.y} x2={needle.x} y2={needle.y} stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#0f172a" />
      <circle cx={cx} cy={cy} r={2} fill="#d6a756" />
    </g>
  );
}

function MercuryBarometer({ x, top, base, mm, fs, T, dec, title, narrow }) {
  const len = 0.9; // m of tube above the dish surface
  const k = (base - top - 26) / len;
  const yS = base - 10; // dish surface
  const yTop = yS - (mm / 1000) * k;
  const tw = narrow ? 9 : 11;
  return (
    <g>
      <text x={narrow ? x + 26 : x} y={top - 6} textAnchor={narrow ? 'end' : 'middle'} fontSize={fs} fontWeight="700" fill="#334155">
        {title}
      </text>
      {/* scale */}
      {[0, 100, 200, 300, 400, 500, 600, 700, 800].map((v) => (
        <g key={`s${v}`}>
          <line x1={x - tw / 2 - 7} x2={x - tw / 2 - 2} y1={yS - (v / 1000) * k} y2={yS - (v / 1000) * k} stroke="#64748b" />
          {(v % 200 === 0 || !narrow) && (
            <text x={x - tw / 2 - 10} y={yS - (v / 1000) * k + 4} textAnchor="end" fontSize={fs - 2.5} fill="#64748b">
              {v}
            </text>
          )}
        </g>
      ))}
      <rect x={x - tw / 2 - 2} y={yS - len * k - 4} width={tw + 4} height={len * k + 16} rx={(tw + 4) / 2} fill="rgba(248,250,252,0.95)" stroke="#64748b" strokeWidth="1.3" />
      <rect x={x - tw / 2} y={yTop} width={tw} height={base - yTop - 2} fill="#9aa5b4" />
      <path d={`M${x - tw / 2},${yTop + 2} Q${x},${yTop - 3} ${x + tw / 2},${yTop + 2}`} fill="#9aa5b4" />
      <rect x={x - 22} y={yS} width={44} height={base - yS + 6} rx={3} fill="#b8c2cf" stroke="#64748b" strokeWidth="1.3" />
      <line x1={x + tw / 2 + 3} x2={x + tw / 2 + 12} y1={yTop} y2={yTop} stroke="#334155" strokeWidth="1.2" />
      <text x={x + tw / 2 + 14} y={yTop + 4} fontSize={fs - 1} fontWeight="700" fill="#334155">
        {whole(mm, dec)}
      </text>
      <text x={x + tw / 2 + 14} y={yTop + 4 + fs} fontSize={fs - 2.5} fill="#64748b">
        {T.mm}
      </text>
    </g>
  );
}

function AirSample({ x, y, s, rhoRatio, fs, title, caption }) {
  const rnd = seeded(5);
  const all = Array.from({ length: 64 }, () => ({ x: x + 6 + rnd() * (s - 12), y: y + 6 + rnd() * (s - 12) }));
  const n = Math.round(64 * rhoRatio);
  return (
    <g>
      <text x={x + s / 2} y={y - 8} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#334155">
        {title}
      </text>
      <rect x={x} y={y} width={s} height={s} rx={8} fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.4" />
      {all.slice(0, n).map((d, i) => (
        <circle key={`m${i}`} cx={d.x} cy={d.y} r={2.4} fill={PC.air} stroke="#0284c7" strokeWidth="0.6" />
      ))}
      <text x={x + s / 2} y={y + s + 15} textAnchor="middle" fontSize={fs - 1.5} fill="#0f766e" fontWeight="700">
        {caption}
      </text>
    </g>
  );
}
