import { useState } from 'react';
import { CarFront, Earth, Lightbulb, Moon, Satellite, WashingMachine } from 'lucide-react';
import { Arrow, Explain, Readout, clamp, fmt, groupThousands, niceStep, useRafLoop } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { Calc, Panel, PlayButtons, RichPill, SimScene, TAU, Tag, TimeChip, Toolbar, num, numt, sci, stepText, timeWords } from './CentripetalAcceleration.parts';

/**
 * Real circles, from a washing-machine drum to the Moon. For each one the
 * radius R and the period T give v = 2πR/T and a = v²/R = 4π²R/T². Time on
 * screen is scaled so that one turn takes a few seconds, and the chip says
 * by how much. Values (school data):
 *   car on a bend   R = 50 m,       v = 10 m/s (lesson example) → 2 m/s²
 *   drum, spin      R = 0.25 m,     1000 rpm (T = 0.06 s)       → 2742 m/s²
 *   Earth, equator  R = 6400 km,    T = 24 h                    → 0.034 m/s²
 *   ISS             r = 6790 km,    T = 92.9 min                → 8.6 m/s²
 *   Moon            r = 384 000 km, T = 27.3 days               → 0.0027 m/s²
 */

const G = 9.81;
const EX = [
  { id: 'car', icon: CarFront, R: 50, T: (TAU * 50) / 10, scale: 5, rDigits: 0, tone: '#60a5fa' },
  { id: 'drum', icon: WashingMachine, R: 0.25, T: 0.06, scale: 1 / 50, rDigits: 2, tone: '#f472b6' },
  { id: 'earth', icon: Earth, R: 6.4e6, T: 86400, scale: 10000, tone: '#34d399' },
  { id: 'iss', icon: Satellite, R: 6.79e6, T: 92.9 * 60, scale: 1000, tone: '#a78bfa' },
  { id: 'moon', icon: Moon, R: 3.84e8, T: 27.3 * 86400, scale: 300000, tone: '#cbd5e1' },
].map((e) => {
  const v = (TAU * e.R) / e.T;
  return { ...e, v, a: (v * v) / e.R };
});
const BY_ID = Object.fromEntries(EX.map((e) => [e.id, e]));
const R_EARTH = 6.371e6;
const C = PALETTE;
const LOG0 = -3;
const LOG1 = 4;

/** "50 m", "0.25 m", "6 400 km", "384 000 km" as value and unit. */
function lenParts(R, T, digits = 0) {
  if (R >= 1e4) return { value: groupThousands(R / 1000), unit: T.km };
  return { value: fmt(R, digits, T.decimal), unit: T.m };
}
function lenText(R, T, digits = 0) {
  const p = lenParts(R, T, digits);
  return `${p.value} ${p.unit}`;
}

/** A period in its natural unit, plus the value in seconds. */
function periodParts(e, T) {
  const dec = T.decimal;
  if (e.T >= 86400 * 2) return { value: fmt(e.T / 86400, 1, dec), unit: T.common.day, sec: `${groupThousands(e.T)} ${T.s}` };
  if (e.T >= 7200) return { value: fmt(e.T / 3600, 0, dec), unit: T.h, sec: `${groupThousands(e.T)} ${T.s}` };
  if (e.T >= 600) return { value: fmt(e.T / 60, 1, dec), unit: T.common.min, sec: `${groupThousands(e.T)} ${T.s}` };
  return { value: e.T < 1 ? fmt(e.T, 2, dec) : numt(e.T, dec, 3), unit: T.s, sec: null };
}

export default function LifeSim({ T }) {
  const tx = T.life;
  const dec = T.decimal;
  const [id, setId] = useState('car');
  const e = BY_ID[id];
  const [sim, setSim] = useState({ running: true, phi: 0 });

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? { ...p, phi: p.phi + (TAU / e.T) * e.scale * dt } : p));
  });

  const pick = (x) => {
    setId(x);
    setSim((p) => ({ ...p, phi: 0 }));
  };
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim({ running: false, phi: 0 });

  const per = periodParts(e, T);
  const vSub = e.v >= 1000 ? `≈ ${fmt(e.v / 1000, 2, dec)} ${T.km}/${T.s}` : `≈ ${num(e.v * 3.6, dec)} ${T.kmh}`;
  const aSub = e.a >= G ? tx.readouts.gTimes(num(e.a / G, dec, 2)) : tx.readouts.gFrac(num(G / e.a, dec, 2));
  const ex = tx.explain;
  const text = {
    car: ex.car(num(e.a, dec)),
    drum: ex.drum(groupThousands(e.a), num(e.a / G, dec, 2)),
    earth: ex.earth(num(e.v, dec), num(e.a, dec)),
    iss: ex.iss(fmt(e.v / 1000, 2, dec), num(e.a, dec, 2)),
    moon: ex.moon(num(e.a, dec)),
  }[id];

  const legend = [
    { label: tx.legend.path, color: C.path, kind: 'dash' },
    { label: tx.legend.v, color: C.vel, kind: 'arrow' },
    { label: tx.legend.a, color: C.acc, kind: 'arrow' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={id}
        onChange={pick}
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        options={EX.map((x) => ({ value: x.id, label: tx.presets[x.id].name, sub: tx.presets[x.id].sub, icon: x.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={sim.phi > 0} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<LifeChip e={e} T={T} />}
        ariaLabel={tx.sceneLabel(tx.presets[id].name, lenText(e.R, T, e.rDigits), `${per.value} ${per.unit}`)}
        height={(W, narrow) => (narrow ? W * 0.96 : clamp(W * 0.4, 400, 470))}
      >
        {(W, H, narrow) => <LifeDrawing W={W} H={H} narrow={narrow} e={e} phi={sim.phi} tx={tx} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={id} tone={e.tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.R} symbol="R" value={lenParts(e.R, T, e.rDigits).value} unit={lenParts(e.R, T, e.rDigits).unit} accent={C.path} textColor={C.pathText} sub={`2πR = ${lenText(TAU * e.R, T, e.rDigits)}`} />
        <Readout label={tx.readouts.T} symbol="T" value={per.value} unit={per.unit} accent={C.time} textColor="#a5f3fc" sub={per.sec ?? `n = ${num(1 / e.T, dec)} ${T.hz}`} />
        <Readout label={tx.readouts.v} symbol="v" value={num(e.v, dec)} unit={T.ms} accent={C.vel} textColor={C.velText} sub={vSub} />
        <Readout label={tx.readouts.a} symbol="a" value={num(e.a, dec)} unit={T.ms2} accent={C.acc} textColor={C.accText} sub={aSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <Compare current={id} onPick={pick} tx={tx} T={T} />
        </Panel>
        <Panel className="lg:col-span-2">
          <Calc
            title={tx.calc.title}
            rows={[
              { sym: 'v', color: C.velText, formula: '2πR/T', subst: `2 · ${fmt(3.14, 2, dec)} · ${sci(e.R, dec, 3)} ${T.m} / ${sci(e.T, dec, 3)} ${T.s}`, result: `${num(e.v, dec)} ${T.ms}` },
              { sym: 'a', color: C.accText, formula: 'v²/R', subst: `(${num(e.v, dec)} ${T.ms})² / ${sci(e.R, dec, 3)} ${T.m}`, result: `${num(e.a, dec)} ${T.ms2}` },
              { sym: 'a/g', color: '#e2e8f0', formula: `a / 9.8 ${T.ms2}`, subst: null, result: num(e.a / G, dec) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function LifeChip({ e, T }) {
  return <TimeChip text={timeWords(T.common, e.scale, T.decimal)} />;
}

/* ------------------------------------------------------------ comparison */

function Compare({ current, onPick, tx, T }) {
  const dec = T.decimal;
  const pct = (a) => ((Math.log10(a) - LOG0) / (LOG1 - LOG0)) * 100;
  const gp = pct(G);
  const ticks = [];
  for (let p = LOG0; p <= LOG1; p += 1) ticks.push(p);
  const sup = (p) => `10${String(p).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`;
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{tx.compare.title}</p>
      <p className="text-xs text-gray-500">{tx.compare.sub}</p>
      <div className="mt-3 space-y-1">
        {EX.map((x) => {
          const on = x.id === current;
          const w = clamp(pct(x.a), 1, 100);
          const inside = w > 78;
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(x.id)}
              className={`grid w-full grid-cols-[88px_1fr] items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors sm:grid-cols-[120px_1fr] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 min-h-10 ${
                on ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <span className={`truncate text-xs sm:text-sm ${on ? 'font-semibold text-white' : 'text-gray-400'}`}>{tx.presets[x.id].name}</span>
              <span className="relative block h-5">
                <span className="absolute inset-y-1.5 left-0 right-0 rounded-full bg-white/[0.06]" />
                <span className="absolute inset-y-1 left-0 rounded-full" style={{ width: `${w}%`, background: on ? C.acc : '#64748b' }} />
                <span className="absolute inset-y-[-6px] w-0 border-l border-dashed border-cyan-300/60" style={{ left: `${gp}%` }} />
                <span
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums ${inside ? 'text-white' : on ? 'text-orange-200' : 'text-gray-400'}`}
                  style={inside ? { right: `${100 - w + 2}%` } : { left: `calc(${w}% + 6px)` }}
                >
                  {num(x.a, dec)}
                </span>
              </span>
            </button>
          );
        })}
        <div className="grid grid-cols-[88px_1fr] gap-2 px-2 sm:grid-cols-[120px_1fr]">
          <span />
          <span className="relative block h-8">
            {ticks.map((p) => (
              <span key={p} className="absolute top-0 -translate-x-1/2 text-[10px] text-gray-500 tabular-nums" style={{ left: `${((p - LOG0) / (LOG1 - LOG0)) * 100}%` }}>
                {sup(p)}
              </span>
            ))}
            <span className="absolute top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-cyan-300" style={{ left: `${gp}%` }}>
              {tx.compare.g}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function hash(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Simple land blobs on a globe of radius r (screen px), turned by `rot`. */
function Land({ cx, cy, r, rot }) {
  const blobs = [
    [0.3, 0.55, 0.32],
    [1.6, 0.7, 0.26],
    [2.5, 0.35, 0.22],
    [3.6, 0.62, 0.3],
    [4.7, 0.8, 0.18],
    [5.5, 0.4, 0.2],
  ];
  return (
    <g>
      {blobs.map(([ang, rho, size], j) => {
        const bx = rho * Math.cos(ang + rot);
        const by = rho * Math.sin(ang + rot);
        const pts = [];
        for (let i = 0; i < 10; i += 1) {
          const t = (i / 10) * TAU;
          const rr = size * (0.65 + 0.5 * hash(j * 10 + i));
          let x = bx + rr * Math.cos(t);
          let y = by + rr * Math.sin(t);
          const d = Math.hypot(x, y);
          if (d > 0.97) {
            x *= 0.97 / d;
            y *= 0.97 / d;
          }
          pts.push(`${(cx + x * r).toFixed(1)},${(cy - y * r).toFixed(1)}`);
        }
        return <polygon key={j} points={pts.join(' ')} fill="#86efac" stroke="#22c55e" strokeWidth="1" strokeLinejoin="round" />;
      })}
    </g>
  );
}

function Globe({ cx, cy, r, rot }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" />
      <Land cx={cx} cy={cy} r={r} rot={rot} />
    </g>
  );
}

function LifeDrawing({ W, H, narrow, e, phi, tx, T }) {
  const dec = T.decimal;
  const pad = narrow ? { l: 14, r: 14, t: 46, b: 30 } : { l: 30, r: 30, t: 62, b: 34 };
  const m = e.id === 'drum' ? 1.45 : e.id === 'moon' ? 1.18 : 1.3;
  // planetary circles are laid out in kilometres (the kit's view has a lower limit on px per unit)
  const U = e.R >= 1e5 ? 1000 : 1;
  const Rw = e.R / U;
  const view = makeView({ x0: -m * Rw, x1: m * Rw, y0: -m * Rw, y1: m * Rw }, W, H, pad);
  const cx = view.sx(0);
  const cy = view.sy(0);
  const Rp = Rw * view.k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const px = cx + Rp * Math.cos(phi);
  const py = cy - Rp * Math.sin(phi);
  const tX = -Math.sin(phi);
  const tY = -Math.cos(phi);
  const iX = -Math.cos(phi);
  const iY = Math.sin(phi);
  const L = clamp(Rp * 0.42, 40, 96);
  const deg = (-phi * 180) / Math.PI;
  const step = niceStep(view.k, narrow ? 24 : 28);
  const stepM = step * U;
  const cellTxt = T.common.cell(stepM >= 1000 ? `${stepText(stepM / 1000, dec)} ${T.km}` : `${stepText(stepM, dec)} ${T.m}`);

  let decor = null;
  let body = null;
  let bodyT = 11; // body half-size along the velocity
  let bodyN = 11; // and across it
  if (e.id === 'car') {
    const w = 8 * view.k;
    decor = (
      <g>
        <circle cx={cx} cy={cy} r={Rp + w / 2 + 3} fill="#e2e8f0" />
        <circle cx={cx} cy={cy} r={Rp} fill="none" stroke="#94a3b8" strokeWidth={w} />
        <circle cx={cx} cy={cy} r={Rp - w / 2} fill="#dcfce7" stroke="#fff" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={Rp + w / 2} fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={Rp} fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="8 10" />
      </g>
    );
    const cl = Math.max(4.5 * view.k, 26);
    const cw = Math.max(1.9 * view.k, 13);
    bodyT = cl / 2 + 2;
    bodyN = cw / 2 + 2;
    body = (
      <g transform={`translate(${px} ${py}) rotate(${deg - 90})`}>
        <rect x={-cl / 2} y={-cw / 2} width={cl} height={cw} rx={cw * 0.35} fill="#1d4ed8" stroke="#0f172a" strokeWidth="1.2" />
        <rect x={cl * 0.05} y={-cw / 2 + 2} width={cl * 0.22} height={cw - 4} rx={2} fill="#bfdbfe" />
        <rect x={-cl * 0.36} y={-cw / 2 + 2} width={cl * 0.16} height={cw - 4} rx={2} fill="#bfdbfe" />
      </g>
    );
  } else if (e.id === 'drum') {
    const holes = [];
    [0.35, 0.55, 0.75, 0.9].forEach((f, ri) => {
      const n = Math.round(8 + ri * 7);
      for (let i = 0; i < n; i += 1) {
        const b = (i / n) * TAU + ri * 0.2;
        holes.push(<circle key={`${ri}-${i}`} cx={cx + f * Rp * Math.cos(b)} cy={cy - f * Rp * Math.sin(b)} r={Math.max(1.6, Rp * 0.018)} fill="#94a3b8" />);
      }
    });
    const lifters = [1, 3, 5].map((j) => {
      const b = (j / 6) * TAU;
      return (
        <g key={j} transform={`rotate(${(-b * 180) / Math.PI} ${cx} ${cy})`}>
          <rect x={cx + Rp * 0.8} y={cy - Rp * 0.07} width={Rp * 0.2} height={Rp * 0.14} rx={Rp * 0.04} fill="#cbd5e1" stroke="#64748b" />
        </g>
      );
    });
    decor = (
      <g>
        <rect x={cx - Rp * 1.3} y={cy - Rp * 1.3} width={Rp * 2.6} height={Rp * 2.6} rx={Rp * 0.18} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={Rp * 1.12} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={Rp} fill="#f1f5f9" stroke="#475569" strokeWidth="3" />
        <g transform={`rotate(${deg} ${cx} ${cy})`}>
          {holes}
          {lifters}
        </g>
        <circle cx={cx} cy={cy} r={Rp * 0.1} fill="#94a3b8" />
      </g>
    );
    body = (
      <g transform={`translate(${px} ${py}) rotate(${deg})`}>
        <path d="M-9,-6 C-3,-11 6,-9 9,-3 C12,4 4,9 -3,7 C-10,5 -13,-2 -9,-6 Z" fill="#f472b6" stroke="#9d174d" strokeWidth="1.2" />
      </g>
    );
  } else if (e.id === 'earth') {
    decor = (
      <g>
        <Globe cx={cx} cy={cy} r={Rp} rot={phi} />
        <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={C.ink} strokeWidth="1.5" />
        <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke={C.ink} strokeWidth="1.5" />
        <Tag x={cx} y={cy + 22} text={tx.labels.pole} color={C.ink} size={fs} italic={false} weight={600} />
      </g>
    );
    body = <circle cx={px} cy={py} r={7} fill="#e11d48" stroke="#fff" strokeWidth="2.5" />;
  } else if (e.id === 'iss') {
    bodyT = 15;
    bodyN = 15;
    decor = (
      <g>
        <Globe cx={cx} cy={cy} r={(R_EARTH / U) * view.k} rot={(phi * e.T) / 86400} />
        <Tag x={cx} y={cy + 5} text={tx.labels.earth} color="#1e3a8a" size={fs + 1} italic={false} />
      </g>
    );
    body = (
      <g transform={`translate(${px} ${py}) rotate(${deg})`}>
        <rect x={-15} y={-3} width={30} height={6} fill="#475569" />
        <rect x={-12} y={-13} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
        <rect x={3} y={-13} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
        <rect x={-12} y={4} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
        <rect x={3} y={4} width={9} height={9} fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
        <rect x={-4} y={-5} width={8} height={10} rx={2} fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.8" />
      </g>
    );
  } else {
    decor = (
      <g>
        <Globe cx={cx} cy={cy} r={narrow ? 13 : 16} rot={(phi * e.T) / 86400} />
        <Tag x={cx} y={cy + (narrow ? 30 : 34)} text={tx.labels.earth} color="#1e3a8a" size={fs} italic={false} />
      </g>
    );
    body = (
      <g>
        <circle cx={px} cy={py} r={narrow ? 9 : 11} fill="#e5e7eb" stroke="#64748b" strokeWidth="1.5" />
        <circle cx={px - 3} cy={py - 2} r={2.2} fill="#cbd5e1" />
        <circle cx={px + 3} cy={py + 3} r={1.6} fill="#cbd5e1" />
      </g>
    );
  }

  const labelName = { car: tx.labels.car, drum: tx.labels.sock, earth: tx.labels.city, iss: tx.labels.iss, moon: tx.labels.moon }[e.id];

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 24 : 28} />
      {decor}
      <circle cx={cx} cy={cy} r={Rp} fill="none" stroke={C.path} strokeOpacity={e.id === 'car' ? 0 : 0.75} strokeWidth="2" strokeDasharray="6 6" />
      {e.id !== 'earth' && e.id !== 'iss' && e.id !== 'moon' && <circle cx={cx} cy={cy} r={3} fill={C.ink} />}

      <Arrow x1={px + iX * bodyN} y1={py + iY * bodyN} x2={px + iX * (bodyN + L)} y2={py + iY * (bodyN + L)} color={C.acc} width={3.5} head={13} />
      <Arrow x1={px + tX * bodyT} y1={py + tY * bodyT} x2={px + tX * (bodyT + L)} y2={py + tY * (bodyT + L)} color={C.vel} width={3.5} head={13} />
      {body}
      <Tag x={px + tX * (bodyT + 14 + L)} y={py + tY * (bodyT + 14 + L) + 5} text="v" color={C.vel} size={fs + 3} />
      <Tag x={px + iX * (bodyN + L) - tX * 16} y={py + iY * (bodyN + L) - tY * 16 + 5} text="a" color={C.acc} size={fs + 3} />
      <RichPill x={px - iX * (bodyN + 22)} y={py - iY * (bodyN + 22)} text={labelName} bg="#fff" color={C.ink} border="#cbd5e1" size={fs - 1} box={box} />

      <text x={12} y={H - 12} fontSize={fs - 1} fill={C.muted}>
        {e.id === 'moon' ? `${tx.dirOnly} · ${tx.enlarged}` : tx.dirOnly}
      </text>
      <text x={W - 12} y={H - 12} textAnchor="end" fontSize={fs - 1} fill={C.muted}>
        {cellTxt}
      </text>
    </g>
  );
}
