import { useState } from 'react';
import { Earth, Lightbulb, Moon, Mountain, Orbit, Ruler, Satellite } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, grouped, num, sig3 } from './Gravity.parts';

/**
 * Tab 2 — going up. Moving away from the Earth the distance to its centre
 * r = R + h grows and g falls as the inverse square:
 *   g(h) = g₀·(R/(R+h))², g₀ = 9.8 m/s², R = 6371 km.
 * Everest (8.8 km) keeps 99.7 % of g₀, the ISS (400 km) 88.5 % (8.68 m/s²),
 * h = R a quarter (2.45 m/s²), the Moon's distance (r ≈ 60 R) 1/3600.
 * The Earth and the distances are drawn to scale; the view zooms out as the
 * body climbs, and the g(r) curve is drawn over the same distance axis.
 * The altitude slider is logarithmic. Strings come from T.height.
 */

const R = 6371; // km
const G0 = 9.8;
const MASS = 60;
const H0 = 50; // km, knee of the logarithmic slider
const R_MOON = 384400; // km, centre to centre
const HMAX = R_MOON - R;
const LN = Math.log(1 + HMAX / H0);
const hOf = (u) => H0 * (Math.exp(u * LN) - 1);
const uOf = (h) => Math.log(1 + h / H0) / LN;
const gOf = (h) => G0 * (R / (R + h)) ** 2;
const RISE = 1 / 14; // slider fraction per second while "rising"

const PRESETS = [
  { id: 'surface', h: 0, icon: Earth },
  { id: 'everest', h: 8.849, icon: Mountain },
  { id: 'iss', h: 400, icon: Satellite },
  { id: 'hR', h: R, icon: Ruler },
  { id: 'geo', h: 35786, icon: Orbit },
  { id: 'moon', h: HMAX, icon: Moon },
];

/** Altitude in km for display: 0, 8.8, 400, 35 786. */
function hStr(h, dec) {
  if (h < 0.05) return '0';
  if (h < 10) return num(h, 1, dec);
  return grouped(h, 0, dec);
}
const rRStr = (k, dec) => num(k, k < 1.1 ? 3 : k < 10 ? 2 : 1, dec);
const gStr = (h, dec) => (h < 0.05 ? num(G0, 1, dec) : sig3(gOf(h), dec));
const pctStr = (p, dec) => num(p, p >= 99.95 ? 0 : p >= 1 ? 1 : 2, dec);
const FStr = (F, dec) => num(F, F >= 100 ? 0 : F >= 1 ? 1 : 2, dec);

export default function HeightSim({ T }) {
  const L = T.height;
  const dec = T.decimal;
  const [u, setU] = useTween(uOf(PRESETS[2].h));
  const [running, setRunning] = useState(false);

  useRafLoop(running, (dt) => {
    const next = Math.min(1, u + dt * RISE);
    setU(next);
    if (next >= 1) setRunning(false);
  });

  const h = u < 1e-6 ? 0 : hOf(u);
  const r = R + h;
  const rR = r / R;
  const g = gOf(h);
  const pct = (g / G0) * 100;
  const F = MASS * g;
  const active = PRESETS.find((p) => Math.abs(uOf(p.h) - u) < 0.0015)?.id;
  const done = u >= 1 - 1e-9;

  const pick = (id) => {
    setRunning(false);
    setU(uOf(PRESETS.find((p) => p.id === id).h), 700);
  };
  const toggle = () => {
    if (done) {
      setU(0);
      setRunning(true);
    } else setRunning((x) => !x);
  };
  const reset = () => {
    setRunning(false);
    setU(0, 500);
  };

  let key = 'mid';
  if (h < 1) key = 'surface';
  else if (h < 100) key = 'low';
  else if (h < 2000) key = 'leo';
  else if (Math.abs(rR - 2) < 0.04) key = 'twoR';
  else if (h >= 30000 && h < 42000) key = 'geo';
  else if (h >= 300000) key = 'moon';
  const settled = useSettled(key, 250);
  const ex = L.explain;
  const k2 = rR * rR;
  const text = {
    surface: ex.surface(gStr(0, dec), grouped(R, 0, dec)),
    low: ex.low(hStr(h, dec), num((h / R) * 100, 2, dec), gStr(h, dec), pctStr(pct, dec)),
    leo: ex.leo(hStr(h, dec), gStr(h, dec), pctStr(pct, dec)),
    twoR: ex.twoR(num(G0, 1, dec), gStr(h, dec)),
    geo: ex.geo(hStr(h, dec), rRStr(rR, dec), gStr(h, dec), num(k2, 0, dec)),
    moon: ex.moon(rRStr(rR, dec), gStr(h, dec), grouped(k2, 0, dec)),
    mid: ex.mid(rRStr(rR, dec), gStr(h, dec), num(k2, k2 < 10 ? 2 : 1, dec)),
  }[settled];
  const tone = { surface: '#22d3ee', low: '#34d399', leo: '#a78bfa', twoR: '#fb923c', geo: '#60a5fa', moon: '#e2e8f0', mid: '#fb923c' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
            size="lg"
            value={active}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id], sub: `h = ${hStr(p.h, dec)} ${T.km}`, icon: p.icon }))}
          />
        </div>
        <PlayControls
          labels={{ ...T.common, start: L.rise, again: L.rise, resume: L.rise }}
          running={running}
          done={done && !running}
          started={u > 1e-6}
          onToggle={toggle}
          onReset={reset}
        />
      </div>

      <HeightScene T={T} h={h} active={active} running={running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.h}
          symbol="h"
          value={hStr(h, dec)}
          unit={T.km}
          accent="#a78bfa"
          textColor="#c4b5fd"
          sub={h < R ? L.hSubPct(num((h / R) * 100, h / R < 0.01 ? 2 : 1, dec)) : L.hSubR(num(h / R, h / R < 10 ? 1 : 0, dec))}
        />
        <Readout label={L.readouts.r} symbol="r" value={grouped(r, 0, dec)} unit={T.km} accent={PALETTE.disp} textColor={PALETTE.dispText} sub={L.rSub(rRStr(rR, dec))} />
        <Readout label={L.readouts.g} symbol="g" value={gStr(h, dec)} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={L.gSub(pctStr(pct, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.F} symbol="F = mg" value={FStr(F, dec)} unit={T.N} accent={PALETTE.force} textColor="#fca5a5" sub={L.FSub(fmt(MASS, 0, dec), FStr(MASS * G0, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="grav-height"
            label={L.slider}
            symbol="h"
            min={0}
            max={1000}
            step={1}
            value={Math.round(u * 1000)}
            onChange={(n) => {
              setRunning(false);
              setU(n / 1000);
            }}
            accent="#a78bfa"
            display={`${hStr(h, dec)} ${T.km}`}
            valueText={`${hStr(h, dec)} ${T.km}`}
            hint={L.sliderHint}
          />
          <FormulaTile
            tag={L.formula.g}
            color={PALETTE.accText}
            general="g = g₀ · (R / (R + h))²"
            filled={`g = ${num(G0, 1, dec)} · (${grouped(R, 0, dec)} / ${grouped(r, 0, dec)})² = ${gStr(h, dec)} ${T.ms2}`}
            note={L.formula.gNote(grouped(R, 0, dec))}
          />
          <FormulaTile tag={L.formula.F} color="#fca5a5" general="F = m · g" filled={`F = ${fmt(MASS, 0, dec)} · ${gStr(h, dec)} = ${FStr(F, dec)} ${T.N}`} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <AltitudeLadder T={T} active={active} onPick={pick} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- ladder */

function AltitudeLadder({ T, active, onPick }) {
  const L = T.height;
  const dec = T.decimal;
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.ladder.title}</p>
      <ul className="mt-3 space-y-1.5" aria-label={L.ladder.title}>
        {PRESETS.map((p) => {
          const g = gOf(p.h);
          const pct = (g / G0) * 100;
          const on = p.id === active;
          const Icon = p.icon;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(p.id)}
                className={`flex w-full min-h-10 items-center gap-2 sm:gap-3 rounded-xl px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                  on ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span className={`flex w-[104px] sm:w-[150px] shrink-0 items-center gap-1.5 text-xs sm:text-sm leading-tight ${on ? 'font-semibold text-white' : 'text-gray-300'}`}>
                  <Icon size={15} aria-hidden="true" className={`shrink-0 ${on ? 'text-cyan-300' : 'text-gray-500'}`} />
                  <span className="min-w-0">
                    {L.presets[p.id]}
                    <span className="block text-[11px] font-normal text-gray-500 tabular-nums">
                      {hStr(p.h, dec)} {T.km}
                    </span>
                  </span>
                </span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${Math.max(pct, 0.6)}%`, background: on ? '#fb923c' : 'rgba(251,146,60,0.45)' }}
                  />
                </span>
                <span className={`w-[70px] sm:w-[84px] shrink-0 text-right text-sm font-semibold tabular-nums ${on ? 'text-white' : 'text-gray-300'}`}>
                  {gStr(p.h, dec)}
                </span>
                <span className="hidden sm:block w-[62px] shrink-0 text-right text-xs tabular-nums text-gray-500">{pctStr(pct, dec)} %</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs leading-snug text-gray-500">{L.ladder.note}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

const CONTINENTS = [
  { x: 0.28, y: -0.42, rx: 0.3, ry: 0.17, rot: 24 },
  { x: -0.22, y: -0.05, rx: 0.26, ry: 0.36, rot: -12 },
  { x: 0.52, y: 0.28, rx: 0.17, ry: 0.3, rot: 8 },
  { x: -0.5, y: 0.52, rx: 0.24, ry: 0.12, rot: -20 },
  { x: 0.12, y: 0.66, rx: 0.2, ry: 0.1, rot: 10 },
];
const CLOUDS = [
  { x: 0.05, y: -0.7, rx: 0.32, ry: 0.06 },
  { x: 0.6, y: -0.1, rx: 0.22, ry: 0.05 },
  { x: -0.4, y: 0.25, rx: 0.28, ry: 0.05 },
];

function HeightScene({ T, h, active, running }) {
  const L = T.height;
  const dec = T.decimal;
  const rR = (R + h) / R;
  const g = gOf(h);

  return (
    <LabScene
      legend={[
        { color: PALETTE.force, label: L.legend.F, kind: 'arrow' },
        { color: PALETTE.acc, label: L.legend.curve, kind: 'line' },
        { color: '#94a3b8', label: L.legend.rings, kind: 'dash' },
      ]}
      chips={<Chip icon={Ruler}>{L.chip}</Chip>}
      height={(W, narrow) => (narrow ? 380 : 440)}
      ariaLabel={L.sceneLabel(hStr(h, dec), gStr(h, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const axisY = H - (narrow ? 58 : 66);
        const curveTop = narrow ? 64 : 84;
        const curveH = axisY - curveTop;
        const x1 = Math.max(3.4, rR * 1.15 + 0.3);
        const x0 = -0.3 - (x1 - 3.4) * 0.05;
        const padR = narrow ? 12 : 26;
        const k = (W - padR) / (x1 - x0);
        const sx = (rr) => (rr - x0) * k;
        const cx = sx(0);
        const gy = (rr) => axisY - curveH / (rr * rr);

        /* ring step in units of R */
        let step = 1;
        for (const s of [1, 2, 5, 10, 20]) {
          step = s;
          if (s * k >= (narrow ? 44 : 56)) break;
        }
        const rings = [];
        for (let n = step; n <= x1 + 1e-9; n += step) rings.push(n);
        if (step > 1) rings.unshift(1);

        /* the g(r) curve */
        const pts = [];
        for (let px = sx(1); px <= W + 3; px += 3) pts.push(`${px.toFixed(1)},${gy(px / k + x0).toFixed(1)}`);
        const area = `M${sx(1)},${axisY} L${pts.join(' L')} L${W},${axisY} Z`;

        /* guide levels g₀, g₀/4, g₀/9 */
        const levels = [1, 2, 3].filter((n) => n === 1 || (n <= x1 && k >= 30));

        const ox = sx(rR);
        const arrowMax = narrow ? 64 : 104;
        const aLen = (g / G0) * arrowMax;
        const dotY = gy(rR);
        const gText = L.gTag(gStr(h, dec));
        const gW = textWidth(gText, fs, 600) + 16;
        const mgText = L.mgTag(FStr(MASS * g, dec));
        const moonX = sx(R_MOON / R);
        const moonR = Math.max(4, (1737 / R) * k);
        const earthLabelInside = k > 70;

        return (
          <>
            <defs>
              <radialGradient id="grav-earth" cx="62%" cy="38%" r="75%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="70%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </radialGradient>
              <clipPath id="grav-earth-clip">
                <circle cx={cx} cy={axisY} r={k} />
              </clipPath>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* faint lab grid */}
            {Array.from({ length: Math.ceil(W / 34) + 1 }, (_, i) => (
              <line key={`gx${i}`} x1={i * 34} x2={i * 34} y1={0} y2={H} stroke={PALETTE.grid} strokeWidth={1} opacity="0.7" />
            ))}
            {Array.from({ length: Math.ceil(H / 34) + 1 }, (_, i) => (
              <line key={`gy${i}`} x1={0} x2={W} y1={axisY - i * 34} y2={axisY - i * 34} stroke={PALETTE.grid} strokeWidth={1} opacity="0.7" />
            ))}

            {/* spheres r = nR */}
            {rings
              .filter((n) => n > 1)
              .map((n) => (
                <circle key={`ring${n}`} cx={cx} cy={axisY} r={n * k} fill="none" stroke="#94a3b8" strokeOpacity="0.45" strokeWidth={1} strokeDasharray="4 6" />
              ))}

            {/* area under g(r) and the guide levels */}
            <path d={area} fill={PALETTE.acc} opacity="0.07" />
            {levels.map((n) => (
              <g key={`lv${n}`}>
                <line x1={sx(n)} x2={W} y1={gy(n)} y2={gy(n)} stroke={PALETTE.acc} strokeOpacity="0.35" strokeWidth={1} strokeDasharray="3 4" />
                <line x1={sx(n)} x2={sx(n)} y1={gy(n)} y2={axisY} stroke={PALETTE.acc} strokeOpacity="0.35" strokeWidth={1} strokeDasharray="3 4" />
                <text x={W - 6} y={gy(n) - 5} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#c2410c" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                  {n === 1 ? L.levelTop(num(G0, 1, dec)) : L.level(n * n, num(G0 / (n * n), 2, dec))}
                </text>
              </g>
            ))}
            <polyline points={pts.join(' ')} fill="none" stroke={PALETTE.acc} strokeWidth={2.5} strokeLinejoin="round" />
            <text x={sx(1) + 8} y={curveTop - 8} fontSize={fs - 1} fontWeight="700" fill="#9a3412" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
              {L.gAxis}
            </text>

            {/* the Earth, to scale */}
            <circle cx={cx} cy={axisY} r={k * (1 + 100 / R)} fill="#e0f2fe" />
            <circle cx={cx} cy={axisY} r={k} fill="url(#grav-earth)" />
            <g clipPath="url(#grav-earth-clip)">
              {CONTINENTS.map((c, i) => (
                <ellipse
                  key={`c${i}`}
                  cx={cx + c.x * k}
                  cy={axisY + c.y * k}
                  rx={c.rx * k}
                  ry={c.ry * k}
                  transform={`rotate(${c.rot} ${cx + c.x * k} ${axisY + c.y * k})`}
                  fill="#4ade80"
                  opacity="0.8"
                />
              ))}
              {CLOUDS.map((c, i) => (
                <ellipse key={`cl${i}`} cx={cx + c.x * k} cy={axisY + c.y * k} rx={c.rx * k} ry={c.ry * k} fill="#fff" opacity="0.5" />
              ))}
            </g>
            {earthLabelInside ? (
              <text x={Math.max(cx + 0.45 * k, 30)} y={axisY - 0.5 * k} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#fff" stroke="#1e3a8a" strokeWidth={3} paintOrder="stroke">
                {L.earth}
              </text>
            ) : (
              <text x={cx} y={axisY - k - 8} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#1e40af" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                {L.earth}
              </text>
            )}

            {/* the Moon at its distance */}
            {moonX < W + moonR && (
              <g>
                <circle cx={moonX} cy={axisY - moonR - 14} r={moonR} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
                <text x={moonX} y={axisY - 2 * moonR - 20} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#475569">
                  {L.moon}
                </text>
              </g>
            )}

            {/* distance axis r */}
            <line x1={Math.max(cx, 0)} x2={W} y1={axisY} y2={axisY} stroke="#64748b" strokeWidth={1.4} />
            {rings.map((n) => (
              <g key={`t${n}`}>
                <line x1={sx(n)} x2={sx(n)} y1={axisY - 5} y2={axisY + 5} stroke="#475569" strokeWidth={1.4} />
                {sx(n) < W - 22 && (
                  <text x={sx(n)} y={axisY + 18} textAnchor="middle" fontSize={fs - 1} fontWeight={n === 1 ? 700 : 500} fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                    {n === 1 ? 'R' : `${n}R`}
                  </text>
                )}
              </g>
            ))}
            <text x={W - 6} y={axisY + 18} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              r
            </text>

            {/* the body: g on the curve, force towards the centre */}
            <line x1={ox} x2={ox} y1={axisY} y2={dotY} stroke="#7c3aed" strokeWidth={1.4} strokeDasharray="4 4" />
            <circle cx={ox} cy={dotY} r={5} fill={PALETTE.acc} stroke="#fff" strokeWidth={2} />
            <Pill x={ox + gW / 2 + 9} y={Math.min(dotY, axisY - 28)} text={gText} bg={PALETTE.acc} size={fs} box={box} />
            {aLen > 3 && (
              <>
                <Arrow x1={ox - 8} y1={axisY} x2={ox - 8 - aLen} y2={axisY} color="#fff" width={narrow ? 6 : 7.5} head={narrow ? 13 : 16} />
                <Arrow x1={ox - 8} y1={axisY} x2={ox - 8 - aLen} y2={axisY} color={PALETTE.force} width={narrow ? 3.5 : 4} head={narrow ? 11 : 13} />
              </>
            )}
            {running && <circle cx={ox} cy={axisY} r={14} fill="#7c3aed" className="cl-pulse" opacity="0.3" />}
            <circle cx={ox} cy={axisY} r={narrow ? 7 : 8.5} fill={PALETTE.ink} stroke="#fff" strokeWidth={2.5} />
            <Pill x={ox - Math.max(aLen, 30) / 2 - 8} y={axisY + 38} text={mgText} bg={PALETTE.force} size={fs} box={box} />
            {active && active !== 'surface' && (
              <Pill
                x={ox - (textWidth(L.presets[active], fs - 1, 600) + 16) / 2 - 12}
                y={axisY - 20}
                text={L.presets[active]}
                bg="#fff"
                color="#5b21b6"
                border="#c4b5fd"
                size={fs - 1}
                box={box}
              />
            )}
          </>
        );
      }}
    </LabScene>
  );
}
