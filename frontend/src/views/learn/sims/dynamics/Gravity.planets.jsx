import { useState } from 'react';
import { CircleDot, Earth, Lightbulb, Mars, Moon, Orbit, Venus } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Astronaut, Chip, FormulaTile, GroupLabel, LabScene, PlayControls, num, sci } from './Gravity.parts';

/**
 * Tab 1 — the same astronaut on six worlds. The mass m stays the same, the
 * gravitational field strength g = GM/R² of the world changes, so the force
 * of gravity F = m·g changes with it. A 1 kg load on a spring scale reads
 * g newtons (g in N/kg), and the same take-off speed v₀ = 2.8 m/s gives a
 * jump of h = v₀²/(2g): 0.40 m on Earth, 2.42 m on the Moon. The jump runs
 * in real time. Strings come from T.planets.
 */

const V0 = 2.8; // take-off speed, the same push on every world (m/s)
const G_EARTH = 9.8;
const G_MAX = 24.8;
const SCALE_MAX = 25; // spring scale range, N

/** g (accepted value, digits shown), M = mantissa·10^exp kg, R in km — G·M/R² rounds to g. */
const BODIES = {
  earth: { g: 9.8, gd: 1, M: [5.97, 24], R: 6371, icon: Earth, accent: '#2563eb', ground: '#dcfce7', edge: '#16a34a', dots: '#86efac' },
  moon: { g: 1.62, gd: 2, M: [7.35, 22], R: 1737, icon: Moon, accent: '#64748b', ground: '#f1f5f9', edge: '#94a3b8', dots: '#cbd5e1' },
  mars: { g: 3.71, gd: 2, M: [6.42, 23], R: 3396, icon: Mars, accent: '#c2410c', ground: '#ffedd5', edge: '#ea580c', dots: '#fdba74' },
  venus: { g: 8.87, gd: 2, M: [4.87, 24], R: 6052, icon: Venus, accent: '#ca8a04', ground: '#fef9c3', edge: '#ca8a04', dots: '#fde047' },
  jupiter: { g: 24.8, gd: 1, M: [1.9, 27], R: 71492, icon: CircleDot, accent: '#b45309', gas: true, bands: ['#fde7c7', '#f5c99b', '#fbe3c4', '#e9b384', '#fdf0dc'] },
  saturn: { g: 10.4, gd: 1, M: [5.68, 26], R: 60268, icon: Orbit, accent: '#a16207', gas: true, bands: ['#fdf6d8', '#f3e1a6', '#fbf0c8', '#ead39a', '#fdf8e6'] },
};
const ORDER = ['earth', 'moon', 'mars', 'venus', 'jupiter', 'saturn'];
const IDLE = { t: 0, running: false, done: false };

const jumpHeight = (g) => (V0 * V0) / (2 * g);

export default function PlanetsSim({ T }) {
  const L = T.planets;
  const dec = T.decimal;
  const [bodyId, setBodyId] = useState('moon');
  const [m, setM] = useState(60);
  const [sim, setSim] = useState(IDLE);
  const [gVis, setGVis] = useTween(BODIES.moon.g);
  const b = BODIES[bodyId];
  const g = b.g;
  const tAir = (2 * V0) / g;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tAir, p.t + dt);
      const done = t >= tAir - 1e-9;
      return { t, running: !done, done };
    });
  });

  const pick = (id) => {
    setBodyId(id);
    setSim(IDLE);
    setGVis(BODIES[id].g, 650);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = sim.t;
  const y = Math.max(0, V0 * t - 0.5 * g * t * t);
  const v = sim.done || t === 0 ? 0 : V0 - g * t;
  const F = m * g;
  const FE = m * G_EARTH;
  const h = jumpHeight(g);
  const gS = fmt(g, b.gd, dec);
  const fF = (n) => num(n, n >= 1000 ? 0 : 1, dec);
  const ratio = g < G_EARTH ? G_EARTH / g : g / G_EARTH;
  const kS = fmt(ratio, ratio < 1.2 ? 2 : 1, dec);
  const name = L.bodies[bodyId];

  let key = 'idle';
  if (sim.done) key = 'landed';
  else if (t > 0) key = 'jump';
  const settled = useSettled(`${key}-${bodyId}`, 0);
  const [sKey, sBody] = settled.split('-');
  const sb = BODIES[sBody];
  const sName = L.bodies[sBody];
  const sg = fmt(sb.g, sb.gd, dec);
  const sRatio = sb.g < G_EARTH ? G_EARTH / sb.g : sb.g / G_EARTH;
  const sk = fmt(sRatio, sRatio < 1.2 ? 2 : 1, dec);
  const ex = L.explain;
  let text;
  if (sKey === 'jump') text = ex.jump(sg);
  else if (sKey === 'landed') {
    text =
      sBody === 'earth'
        ? ex.landedEarth(fmt(V0, 1, dec), sg, fmt(jumpHeight(sb.g), 2, dec), fmt((2 * V0) / sb.g, 2, dec))
        : ex.landed(sName.loc, fmt(jumpHeight(sb.g), 2, dec), fmt(jumpHeight(G_EARTH), 2, dec), fmt((2 * V0) / sb.g, 2, dec), sb.g < G_EARTH ? ex.higher : ex.lower);
  } else if (sBody === 'earth') text = ex.idleEarth(m, sg, fF(m * sb.g));
  else text = `${(sb.g < G_EARTH ? ex.idleLess : ex.idleMore)(sName.loc, sg, m, fF(m * sb.g), sk)}${sb.gas ? ex.gas(sName.name) : ''}`;
  const tone = { idle: '#22d3ee', jump: '#fb923c', landed: '#34d399' }[sKey];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.bodiesLabel}</GroupLabel>
          <Segmented
            label={L.bodiesLabel}
            className="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
            size="lg"
            value={bodyId}
            onChange={pick}
            accent={b.accent === '#64748b' ? '#94a3b8' : '#22d3ee'}
            options={ORDER.map((id) => ({
              value: id,
              label: L.bodies[id].name,
              sub: `g = ${fmt(BODIES[id].g, BODIES[id].gd, dec)} ${T.ms2}`,
              icon: BODIES[id].icon,
            }))}
          />
        </div>
        <PlayControls
          labels={{ ...T.common, start: L.jump, again: L.jumpAgain }}
          running={sim.running}
          done={sim.done}
          started={t > 0}
          onToggle={toggle}
          onReset={reset}
        />
      </div>

      <PlanetScene T={T} bodyId={bodyId} m={m} y={y} v={v} t={t} running={sim.running} done={sim.done} gVis={gVis} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.m} symbol="m" value={fmt(m, 0, dec)} unit={T.kg} accent="#e2e8f0" sub={L.mSub} />
        <Readout
          label={L.readouts.g}
          symbol="g"
          value={gS}
          unit={T.ms2}
          accent={PALETTE.acc}
          textColor={PALETTE.accText}
          sub={bodyId === 'earth' ? L.gSub.same(gS) : g < G_EARTH ? L.gSub.less(gS, kS) : L.gSub.more(gS, kS)}
        />
        <Readout
          label={L.readouts.F}
          symbol="F = mg"
          value={fF(F)}
          unit={T.N}
          accent={PALETTE.force}
          textColor="#fca5a5"
          sub={bodyId === 'earth' ? L.FSubEarth : L.FSub(fF(FE))}
        />
        <Readout
          label={L.readouts.h}
          symbol="h"
          value={fmt(h, 2, dec)}
          unit={T.m}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={L.hSub(fmt(V0, 1, dec), fmt(tAir, 2, dec))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="grav-mass"
            label={L.mass}
            symbol="m"
            min={10}
            max={150}
            step={5}
            value={m}
            onChange={setM}
            accent="#94a3b8"
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={L.massHint}
          />
          <FormulaTile tag={L.formula.F} color="#fca5a5" general="F = m · g" filled={`F = ${fmt(m, 0, dec)} · ${gS} = ${fF(F)} ${T.N}`} />
          <FormulaTile
            tag={L.formula.g}
            color={PALETTE.accText}
            general="g = G · M / R²"
            filled={`g = ${sci(6.67, -11, 2, dec)} · ${sci(b.M[0], b.M[1], 2, dec)} / (${sciOf(b.R * 1000, 3, dec)})² ≈ ${gS} ${T.ms2}`}
            note={L.formula.gNote(name.gen, grouped(b.R))}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <ForceBars T={T} m={m} bodyId={bodyId} onPick={pick} />
        </div>
      </div>
    </div>
  );
}

/** A positive number in standard form: 6371000 → "6.371·10⁶". */
function sciOf(n, digits, dec) {
  const e = Math.floor(Math.log10(n));
  return sci(n / 10 ** e, e, digits, dec);
}

function grouped(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ---------------------------------------------------------------- bars */

function ForceBars({ T, m, bodyId, onPick }) {
  const L = T.planets;
  const dec = T.decimal;
  const Fmax = m * G_MAX;
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.bars.title(fmt(m, 0, dec))}</p>
      <ul className="mt-3 space-y-1.5" aria-label={L.bars.label}>
        {ORDER.map((id) => {
          const bd = BODIES[id];
          const F = m * bd.g;
          const on = id === bodyId;
          const Icon = bd.icon;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(id)}
                className={`flex w-full min-h-10 items-center gap-2 sm:gap-3 rounded-xl px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                  on ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span className={`flex w-[84px] sm:w-[112px] shrink-0 items-center gap-1.5 text-xs sm:text-sm ${on ? 'font-semibold text-white' : 'text-gray-300'}`}>
                  <Icon size={15} aria-hidden="true" className={on ? 'text-cyan-300' : 'text-gray-500'} />
                  {L.bodies[id].name}
                </span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{ width: `${(F / Fmax) * 100}%`, background: on ? '#f87171' : 'rgba(248,113,113,0.45)' }}
                  />
                  <span className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${((m * G_EARTH) / Fmax) * 100}%` }} aria-hidden="true" />
                </span>
                <span className={`w-[74px] sm:w-[84px] shrink-0 text-right text-sm font-semibold tabular-nums ${on ? 'text-white' : 'text-gray-300'}`}>
                  {num(F, F >= 1000 ? 0 : 1, dec)} {T.N}
                </span>
                <span className="hidden sm:block w-[92px] shrink-0 text-right text-xs tabular-nums text-gray-500">
                  g = {fmt(bd.g, bd.gd, dec)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs leading-snug text-gray-500">{L.bars.note}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function niceForce(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const k of [1, 2, 5, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

function PlanetScene({ T, bodyId, m, y, v, t, running, done, gVis }) {
  const L = T.planets;
  const dec = T.decimal;
  const b = BODIES[bodyId];
  const name = L.bodies[bodyId];
  const F = m * b.g;
  const FE = m * G_EARTH;
  const FVis = m * gVis;

  return (
    <LabScene
      legend={[
        { color: PALETTE.force, label: L.legend.F, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: '#7c3aed', label: L.legend.h, kind: 'dash' },
        ...(bodyId === 'earth' ? [] : [{ color: '#f87171', label: L.legend.ghost, kind: 'dash' }]),
      ]}
      chips={
        <Chip>
          {L.chipReal} · t = {fmt(t, 2, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 430 : 470)}
      ariaLabel={L.sceneLabel(name.loc, fmt(m, 0, dec), num(F, F >= 1000 ? 0 : 1, dec), fmt(b.g, b.gd, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const leftW = Math.round(W * (narrow ? 0.6 : 0.64));
        const padT = narrow ? 40 : 66;
        const groundY = H - (narrow ? 62 : 74);
        const HM = 4.7;
        const k = (groundY - padT) / HM;
        const rulerX = narrow ? 26 : 44;
        const ax = leftW * (narrow ? 0.6 : 0.55);
        const feetY = groundY - y * k;
        const cy = feetY - 1.0 * k;
        const arrowMax = narrow ? 88 : 118;
        const fk = arrowMax / (m * G_MAX);
        const aLen = FVis * fk;
        const fBar = niceForce((m * G_MAX) / 4);
        const cell = 0.5 * k;

        /* comparison of jump heights, selected first */
        const marks = [];
        const order = [bodyId, ...ORDER.filter((id) => id !== bodyId)];
        for (const id of order) {
          const hy = groundY - jumpHeight(BODIES[id].g) * k;
          const free = marks.every((mk) => Math.abs(mk.y - hy) >= (narrow ? 12 : 14));
          marks.push({ id, y: hy, label: free && (!narrow || id === bodyId) });
        }
        const selY = groundY - jumpHeight(b.g) * k;
        const showApex = t > 0;

        /* spring scale */
        const sx0 = leftW;
        const sw = W - leftW;
        const armY = padT + (narrow ? 30 : 34);
        const rodX = sx0 + sw * (narrow ? 0.16 : 0.24);
        const dx = sx0 + sw * (narrow ? 0.48 : 0.5);
        const L0 = narrow ? 24 : 34;
        const y0 = armY + 8 + L0;
        const sk = (groundY - 80 - y0) / SCALE_MAX;
        const Fs = gVis; // 1 kg load
        const springEnd = y0 + Fs * sk;
        const coils = 12;
        const cw = narrow ? 6 : 8;
        let spring = `M${dx},${armY + 8} L${dx},${armY + 14}`;
        const segTop = armY + 14;
        const segBot = springEnd - 6;
        for (let i = 1; i <= coils * 2; i += 1) {
          const yy = segTop + ((segBot - segTop) * i) / (coils * 2);
          spring += ` L${dx + (i % 2 ? cw : -cw)},${yy}`;
        }
        spring += ` L${dx},${segBot} L${dx},${springEnd}`;
        const scaleX = dx + (narrow ? 14 : 20);
        const wTop = springEnd + 12;
        const wW = narrow ? 26 : 34;
        const wH = narrow ? 24 : 30;
        const ticks = [];
        for (let n = 0; n <= SCALE_MAX; n += 1) ticks.push(n);

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* lab-paper grid: 0.5 m cells */}
            {Array.from({ length: Math.ceil(W / cell) + 1 }, (_, i) => (
              <line key={`gx${i}`} x1={rulerX + i * cell} x2={rulerX + i * cell} y1={0} y2={groundY} stroke={PALETTE.grid} strokeWidth={1} />
            ))}
            {Array.from({ length: Math.ceil(groundY / cell) + 1 }, (_, i) => (
              <line key={`gy${i}`} x1={0} x2={W} y1={groundY - i * cell} y2={groundY - i * cell} stroke={PALETTE.grid} strokeWidth={1} />
            ))}
            <line x1={leftW} x2={leftW} y1={padT - 6} y2={groundY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 5" />

            {/* height ruler */}
            <line x1={rulerX} x2={rulerX} y1={groundY} y2={groundY - 4.5 * k} stroke="#475569" strokeWidth={1.4} />
            {Array.from({ length: 10 }, (_, i) => i * 0.5).map((hm) => {
              const major = Number.isInteger(hm);
              return (
                <g key={`r${hm}`}>
                  <line x1={rulerX - (major ? 7 : 4)} x2={rulerX} y1={groundY - hm * k} y2={groundY - hm * k} stroke="#475569" strokeWidth={1.2} />
                  {(major || !narrow) && hm > 0 && (
                    <text x={rulerX - 9} y={groundY - hm * k + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
                      {fmt(hm, major ? 0 : 1, dec)}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={rulerX + 6} y={groundY - 4.5 * k - 6} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {L.heightAxis}
            </text>

            {/* jump heights on the other worlds */}
            {marks.map((mk) => {
              const on = mk.id === bodyId;
              const bd = BODIES[mk.id];
              return (
                <g key={`m${mk.id}`} opacity={on ? 1 : 0.75}>
                  <line x1={rulerX + 2} x2={rulerX + (on ? 22 : 14)} y1={mk.y} y2={mk.y} stroke={on ? '#7c3aed' : bd.accent} strokeWidth={on ? 3 : 2} strokeLinecap="round" />
                  {mk.label && (
                    <text
                      x={rulerX + (on ? 27 : 19)}
                      y={mk.y + 4}
                      fontSize={fs - 1}
                      fontWeight={on ? 700 : 500}
                      fill={on ? '#5b21b6' : '#475569'}
                      stroke="#fbfcfe"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {L.compareTag(L.bodies[mk.id].name, fmt(jumpHeight(bd.g), 2, dec))}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ground */}
            {b.gas ? (
              <>
                {b.bands.map((c, i) => (
                  <rect key={`b${i}`} x={0} y={groundY + (i * (H - groundY)) / b.bands.length} width={W} height={(H - groundY) / b.bands.length + 1} fill={c} />
                ))}
                <rect x={ax - (narrow ? 40 : 64)} y={groundY} width={narrow ? 80 : 128} height={10} fill="#94a3b8" />
                <rect x={rodX - (narrow ? 22 : 30)} y={groundY} width={dx - rodX + (narrow ? 48 : 64)} height={10} fill="#94a3b8" />
                <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#d97706" strokeWidth={1.2} strokeDasharray="6 5" />
                <text x={W - 10} y={H - 10} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#92400e">
                  {L.noSurface}
                </text>
              </>
            ) : (
              <>
                <rect x={0} y={groundY} width={W} height={H - groundY} fill={b.ground} />
                {Array.from({ length: 26 }, (_, i) => {
                  const gx = hash01(i + 3) * W;
                  const gy = groundY + 8 + hash01(i + 41) * (H - groundY - 14);
                  const r = 1.5 + hash01(i + 77) * (bodyId === 'moon' ? 7 : 3.5);
                  return bodyId === 'moon' ? (
                    <ellipse key={`d${i}`} cx={gx} cy={gy} rx={r} ry={r * 0.45} fill="none" stroke={b.dots} strokeWidth={1.2} />
                  ) : (
                    <ellipse key={`d${i}`} cx={gx} cy={gy} rx={r} ry={r * 0.6} fill={b.dots} opacity="0.7" />
                  );
                })}
                <line x1={0} x2={W} y1={groundY} y2={groundY} stroke={b.edge} strokeWidth={2} />
              </>
            )}

            {/* towards the centre of the world */}
            <line x1={ax} x2={ax} y1={groundY + 2} y2={H} stroke={PALETTE.force} strokeOpacity="0.35" strokeWidth={1.5} strokeDasharray="3 4" />
            {!narrow && (
              <text x={ax + 8} y={H - 10} fontSize={fs - 1} fontWeight="600" fill="#b91c1c">
                {L.toCentre(name.gen)}
              </text>
            )}

            {/* apex of the jump */}
            {showApex && (
              <>
                <line x1={rulerX + 24} x2={ax + 0.5 * k} y1={selY} y2={selY} stroke="#7c3aed" strokeWidth={1.4} strokeDasharray="5 4" />
                {done && <Pill x={ax + 0.5 * k + 44} y={selY} text={L.jumpTag(fmt(jumpHeight(b.g), 2, dec))} bg="#7c3aed" size={fs} box={box} />}
              </>
            )}

            {/* astronaut */}
            {running && <ellipse cx={ax} cy={groundY} rx={0.32 * k} ry={4} fill="#0f172a" opacity={0.12 / (1 + y * 2)} />}
            {!running && <ellipse cx={ax} cy={groundY} rx={0.32 * k} ry={3.5} fill="#0f172a" opacity="0.14" />}
            <Astronaut x={ax} y={feetY} h={1.8 * k} />
            <Pill x={ax} y={feetY - 1.8 * k - 14} text={L.massTag(fmt(m, 0, dec))} bg="#0f172a" size={fs - 1} box={box} />

            {/* the same astronaut's force of gravity on Earth, for comparison */}
            {bodyId !== 'earth' && (
              <g opacity="0.75">
                <line x1={ax - 0.42 * k} x2={ax - 0.42 * k} y1={cy} y2={cy + m * G_EARTH * fk - 8} stroke="#f87171" strokeWidth={2.5} strokeDasharray="5 4" />
                <path d={`M${ax - 0.42 * k},${cy + m * G_EARTH * fk} l-5,-9 l10,0 Z`} fill="#f87171" />
                <text x={ax - 0.42 * k - 8} y={cy + m * G_EARTH * fk - 2} textAnchor="end" fontSize={fs - 2} fontWeight="700" fill="#b91c1c" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                  {L.ghostTag(num(FE, FE >= 1000 ? 0 : 1, dec))}
                </text>
              </g>
            )}

            {/* force of gravity, from the centre of mass */}
            <circle cx={ax} cy={cy} r={3.5} fill={PALETTE.force} stroke="#fff" strokeWidth={1.5} />
            <Arrow x1={ax} y1={cy} x2={ax} y2={cy + aLen} color={PALETTE.force} width={narrow ? 3.5 : 4.5} head={narrow ? 11 : 14} />
            {narrow ? (
              <Pill x={ax} y={Math.max(cy + aLen + 16, groundY + 16)} text={L.mgTag(num(F, F >= 1000 ? 0 : 1, dec))} bg={PALETTE.force} size={fs} box={box} />
            ) : (
              <Pill
                x={ax + 0.36 * k + (textWidth(L.mgTag(num(F, 1, dec)), fs, 600) + 16) / 2 + 6}
                y={cy + Math.max(aLen, 24) / 2}
                text={L.mgTag(num(F, F >= 1000 ? 0 : 1, dec))}
                bg={PALETTE.force}
                size={fs}
                box={box}
              />
            )}

            {/* velocity while in the air */}
            {running && Math.abs(v) > 0.05 && (
              <>
                <Arrow
                  x1={ax - 0.85 * k}
                  y1={feetY - 0.9 * k}
                  x2={ax - 0.85 * k}
                  y2={feetY - 0.9 * k - (v / V0) * (narrow ? 44 : 58)}
                  color={PALETTE.vel}
                  width={3}
                  head={10}
                />
                <text
                  x={ax - 0.85 * k - 10}
                  y={feetY - 0.9 * k - (v / V0) * (narrow ? 22 : 29) + 4}
                  textAnchor="end"
                  fontSize={fs + 1}
                  fontStyle="italic"
                  fontWeight="700"
                  fill={PALETTE.vel}
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  v
                </text>
              </>
            )}

            {/* force scale bar */}
            <g transform={`translate(${rulerX + 6} ${H - (narrow ? 14 : 16)})`}>
              <line x1={0} x2={fBar * fk} y1={0} y2={0} stroke={PALETTE.force} strokeWidth={3} strokeLinecap="round" />
              <line x1={0} x2={0} y1={-4} y2={4} stroke={PALETTE.force} strokeWidth={1.5} />
              <line x1={fBar * fk} x2={fBar * fk} y1={-4} y2={4} stroke={PALETTE.force} strokeWidth={1.5} />
              <text x={fBar * fk + 6} y={4} fontSize={fs - 1} fontWeight="700" fill="#991b1b">
                {L.forceScale(fmt(fBar, 0, dec))}
              </text>
            </g>

            {/* spring scale with a 1 kg load */}
            {!narrow && (
              <text x={sx0 + sw / 2} y={padT + 6} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
                {L.dyno.title}
              </text>
            )}
            <rect x={rodX - (narrow ? 18 : 26)} y={groundY - 7} width={narrow ? 36 : 52} height={7} rx={2} fill="#64748b" />
            <line x1={rodX} x2={rodX} y1={groundY - 7} y2={armY - 6} stroke="#64748b" strokeWidth={4} strokeLinecap="round" />
            <line x1={rodX} x2={dx + 4} y1={armY} y2={armY} stroke="#64748b" strokeWidth={4} strokeLinecap="round" />
            <circle cx={dx} cy={armY + 4} r={3} fill="none" stroke="#334155" strokeWidth={1.6} />
            {/* the scale plate */}
            <rect x={scaleX - 4} y={y0 - 8} width={narrow ? 30 : 40} height={SCALE_MAX * sk + 16} rx={4} fill="#fff" stroke="#cbd5e1" />
            {ticks.map((n) => (
              <g key={`s${n}`}>
                <line x1={scaleX} x2={scaleX + (n % 5 === 0 ? 9 : 5)} y1={y0 + n * sk} y2={y0 + n * sk} stroke="#475569" strokeWidth={n % 5 === 0 ? 1.3 : 0.8} />
                {n % 5 === 0 && (
                  <text x={scaleX + (narrow ? 11 : 13)} y={y0 + n * sk + 4} fontSize={fs - 2} fill="#334155">
                    {n}
                  </text>
                )}
              </g>
            ))}
            <text x={scaleX + (narrow ? 11 : 13)} y={y0 + SCALE_MAX * sk + 20} fontSize={fs - 2} fontWeight="700" fill="#334155">
              {T.N}
            </text>
            <path d={spring} fill="none" stroke="#334155" strokeWidth={1.6} strokeLinejoin="round" />
            {/* pointer */}
            <line x1={dx - 4} x2={scaleX + 9} y1={springEnd} y2={springEnd} stroke={PALETTE.force} strokeWidth={2.2} />
            <path d={`M${scaleX + 9},${springEnd} l-6,-4 l0,8 Z`} fill={PALETTE.force} />
            {/* hook and the 1 kg load */}
            <path d={`M${dx},${springEnd} L${dx},${wTop - 4} q0,5 -4,5`} fill="none" stroke="#334155" strokeWidth={1.6} />
            <path
              d={`M${dx - wW / 2 + 4},${wTop + 2} L${dx + wW / 2 - 4},${wTop + 2} L${dx + wW / 2},${wTop + wH} L${dx - wW / 2},${wTop + wH} Z`}
              fill="#334155"
              stroke="#0f172a"
              strokeLinejoin="round"
            />
            <circle cx={dx} cy={wTop} r={4} fill="none" stroke="#334155" strokeWidth={2} />
            <text x={dx} y={wTop + wH / 2 + 6} textAnchor="middle" fontSize={fs - 1.5} fontWeight="700" fill="#fff">
              {L.dyno.load}
            </text>
            {narrow ? (
              <Pill x={dx} y={wTop + wH + 14} text={L.dyno.reads(fmt(b.g, b.gd, dec))} bg={PALETTE.force} size={fs - 0.5} box={box} />
            ) : (
              <>
                <Pill x={scaleX + 66} y={springEnd} text={L.dyno.reads(fmt(b.g, b.gd, dec))} bg={PALETTE.force} size={fs} box={box} />
                <Pill x={sx0 + sw / 2} y={groundY - 22} text={L.dyno.gIs(fmt(b.g, b.gd, dec))} bg="#fff" color="#9a3412" border="#fdba74" size={fs} box={box} />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}
