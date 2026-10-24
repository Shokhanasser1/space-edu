import { useState } from 'react';
import { CloudSnow, Droplets, Lightbulb, Ruler, Snowflake, Timer } from 'lucide-react';

import { Arrow, Explain, RangeField, Readout, Segmented, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, FArrow, FC, G, GroupLabel, LabScene, PaperGrid, PlayControls, Rich, ScaleBar, Slab, TagPill, forceUnit, tagWidth, niceMax, num, trim } from './StaticFriction.parts';

/**
 * Tab 3 — why friction is useful. The driven wheel pushes the road back; by
 * Newton's third law the road pushes the car forward with static friction
 * (the tyre's contact point is at rest for an instant). That force can be at
 * most μ₀mg, so a_max = μ₀g: 7.84 m/s² on dry asphalt, 0.98 m/s² on ice.
 * Ask for more and the wheel spins: friction becomes sliding, a = μg.
 * Preset: a 1000 kg car, the wheel pushes with 3 kN — dry asphalt grips
 * (a = 3 m/s², 43 km/h after 4 s), ice spins (a = 0.49 m/s², 7 km/h).
 */

const CAR_M = 1000; // kg
const T_RUN = 4; // s
const X_VIEW = 66; // m on screen
export const ROADS = {
  dry: { mu0: 0.8, mu: 0.6, kind: 'asphalt' },
  wet: { mu0: 0.5, mu: 0.4, kind: 'wet', icon: Droplets },
  snow: { mu0: 0.3, mu: 0.2, kind: 'snow', icon: CloudSnow },
  ice: { mu0: 0.1, mu: 0.05, kind: 'ice', icon: Snowflake },
};
const LANE2 = ['wet', 'snow', 'ice'];
const IDLE = { t: 0, running: false, done: false };

/** What the road does with a wheel pushing it back with F newtons. */
function laneOf(id, F) {
  const r = ROADS[id];
  const fmax = r.mu0 * CAR_M * G;
  const grip = F <= fmax + 1e-6;
  const a = grip ? F / CAR_M : r.mu * G;
  return { ...r, id, fmax, grip, a, f: grip ? F : r.mu * CAR_M * G, aMax: r.mu0 * G };
}

export default function GripSim({ T }) {
  const L = T.grip;
  const dec = T.decimal;
  const [road2, setRoad2] = useState('ice');
  const [FkN, setFkN] = useState(3);
  const [sim, setSim] = useState(IDLE);
  const F = FkN * 1000;
  const l1 = laneOf('dry', F);
  const l2 = laneOf(road2, F);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(T_RUN, p.t + dt);
      return { t, running: t < T_RUN, done: t >= T_RUN };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = sim.t;
  const kmh = (a) => num(a * t * 3.6, 0, dec);
  const A2 = (n) => num(n, 2, dec);
  const kN2 = (n) => trim(Number((n / 1000).toFixed(2)), dec, 2);

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t > 0) key = !l1.grip ? 'slipBoth' : !l2.grip ? 'slip2' : 'both';
  const settled = useSettled(key, key === 'idle' || key === 'done' ? 0 : 250);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    both: ex.both(trim(F / CAR_M, dec, 2)),
    slip2: ex.slip2(L.locCap[road2], kN2(l2.fmax), kN2(F), A2(l2.a)),
    slipBoth: ex.slipBoth(kN2(l1.fmax), A2(l1.a)),
    done: ex.done(num(l1.a * T_RUN * 3.6, 0, dec), L.loc[road2], num(l2.a * T_RUN * 3.6, 0, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', both: '#34d399', slip2: '#f87171', slipBoth: '#f87171', done: '#34d399' }[settled];

  const vMax = niceMax(Math.max(l1.a, l2.a, 1) * T_RUN);
  const samples = (a) => {
    const pts = [];
    const n = Math.max(1, Math.ceil((t / T_RUN) * 40));
    for (let i = 0; i <= n; i += 1) {
      const ti = (i / n) * t;
      pts.push({ x: ti, y: a * ti });
    }
    return pts;
  };

  const laneTile = (l, name, sym) => (
    <Readout
      label={name}
      symbol={<Rich>{sym}</Rich>}
      value={A2(l.a)}
      unit={T.ms2}
      accent={l.grip ? '#34d399' : '#f87171'}
      textColor={l.grip ? PALETTE.velText : FC.fricText}
      active={!l.grip}
      sub={l.grip ? L.readouts.grip(kmh(l.a)) : L.readouts.slip(kmh(l.a))}
    />
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.laneLabel}</GroupLabel>
          <Segmented
            label={L.laneLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={road2}
            onChange={(id) => {
              setRoad2(id);
              setSim(IDLE);
            }}
            options={LANE2.map((id) => ({
              value: id,
              label: L.surfaces[id],
              sub: <Rich>{L.surfSub(trim(ROADS[id].mu0, dec), trim(ROADS[id].mu0 * G, dec, 2))}</Rich>,
              icon: ROADS[id].icon,
            }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <GripScene T={T} l1={l1} l2={l2} F={F} t={t} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {laneTile(l1, L.surfaces.dry, 'a₁')}
        {laneTile(l2, L.surfaces[road2], 'a₂')}
        <Readout label={L.readouts.amax} symbol={<Rich>a_max = μ₀g</Rich>} accent="#fbbf24">
          <div className="mt-2 space-y-1.5">
            {[l1, l2].map((l) => (
              <div key={l.id} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-gray-400">{L.surfaces[l.id]}</span>
                <span className="text-lg font-bold tabular-nums text-[#fde68a]">
                  {trim(l.aMax, dec, 2)} <span className="text-xs font-normal text-gray-400">{T.ms2}</span>
                </span>
              </div>
            ))}
          </div>
        </Readout>
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug tabular-nums text-gray-400">
            <p>
              <span className="font-serif italic text-gray-200">
                <Rich>F_max = μ₀mg</Rich>
              </span>{' '}
              = {trim(l2.mu0, dec)} · {CAR_M} · {trim(G, dec)} = <b className="text-[#fde68a]">{Math.round(l2.fmax)}</b> {T.N}
            </p>
            <p>
              F = {Math.round(F)} {T.N} {l2.grip ? '≤' : '>'} <Rich>F_max</Rich> →{' '}
              <b style={{ color: l2.grip ? '#6ee7b7' : '#fca5a5' }}>{l2.grip ? L.readouts.ok : L.readouts.spin}</b>
            </p>
            <p>
              {l2.grip ? (
                <>
                  <span className="font-serif italic text-gray-200">a = F/m</span> = {Math.round(F)} / {CAR_M} = <b className="text-white">{A2(l2.a)}</b> {T.ms2}
                </>
              ) : (
                <>
                  <span className="font-serif italic text-gray-200">a = μg</span> = {trim(l2.mu, dec)} · {trim(G, dec)} = <b className="text-white">{A2(l2.a)}</b> {T.ms2}
                </>
              )}
            </p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="sf-grip-f"
            label={L.force}
            symbol="F"
            min={0.5}
            max={10}
            step={0.1}
            value={FkN}
            onChange={(n) => {
              setFkN(n);
              setSim(IDLE);
            }}
            accent={FC.fricLine}
            display={`${num(FkN, 1, dec)} ${T.kN}`}
            hint={L.forceHint(kN2(l1.fmax), kN2(l2.fmax), L.loc[road2])}
          />
          <p className="text-xs text-gray-500">{L.car(CAR_M)}</p>
          <HowItWorks T={T} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'v1', label: L.surfaces.dry, color: PALETTE.velText, points: samples(l1.a) },
              { id: 'v2', label: L.surfaces[road2], color: '#7dd3fc', points: samples(l2.a) },
            ]}
            xMax={T_RUN}
            yMax={vMax}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={t}
            decimal={dec}
            ariaLabel={L.graph.label}
            note={L.graph.note}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- foot and wheel */

function HowItWorks({ T }) {
  const H = T.grip.how;
  const ground = (w) => (
    <>
      <line x1={4} x2={w - 4} y1={62} y2={62} stroke="#64748b" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={8 + i * 12} y1={64} x2={2 + i * 12} y2={72} stroke="#475569" strokeWidth="1" />
      ))}
    </>
  );
  const pair = (cx) => (
    <>
      <Arrow x1={cx - 2} y1={67} x2={cx - 40} y2={67} color="#94a3b8" width={2.5} head={9} dash="4 3" />
      <Arrow x1={cx + 2} y1={56} x2={cx + 42} y2={56} color={FC.fricLine} width={3} head={10} />
    </>
  );
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{H.title}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <figure>
          <svg viewBox="0 0 150 80" className="block h-auto w-full" role="img" aria-label={H.label}>
            {ground(150)}
            {/* the back leg pushing off: trouser, shoe on the ground */}
            <path d="M68,46 L90,6" stroke="#64748b" strokeWidth="12" strokeLinecap="round" />
            <path d="M46,61 L46,53 Q48,45 58,44 L74,44 Q80,45 84,49 L96,55 Q100,57 100,61 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
            <line x1={46} x2={100} y1={61} y2={61} stroke="#334155" strokeWidth="2.5" />
            {pair(72)}
            <text x={24} y={79} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {H.push}
            </text>
            <text x={136} y={46} fontSize="9" fill={FC.fricLine} textAnchor="end" fontWeight="600">
              {H.fric}
            </text>
          </svg>
          <figcaption className="mt-1 text-[11px] leading-snug text-gray-400">{H.foot}</figcaption>
        </figure>
        <figure>
          <svg viewBox="0 0 150 80" className="block h-auto w-full" role="img" aria-label={H.label}>
            {ground(150)}
            <circle cx={75} cy={36} r={25} fill="#1f2937" stroke="#0f172a" strokeWidth="2" />
            <circle cx={75} cy={36} r={13} fill="#94a3b8" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx={75} cy={36} r={3} fill="#334155" />
            <path d="M75,8 A28,28 0 0 1 101,26" stroke="#fbbf24" strokeWidth="2" fill="none" />
            <path d="M101,26 l-1,-7 l-5,5 z" fill="#fbbf24" />
            {pair(75)}
            <text x={27} y={79} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {H.push}
            </text>
            <text x={146} y={46} fontSize="9" fill={FC.fricLine} textAnchor="end" fontWeight="600">
              {H.fric}
            </text>
          </svg>
          <figcaption className="mt-1 text-[11px] leading-snug text-gray-400">{H.wheel}</figcaption>
        </figure>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

/** Side view of a hatchback, its front at x, wheels on y; `spin` = wheel turn in radians. */
function SideCar({ front, y, len, color, spin, slip, t }) {
  const h = len * 0.36;
  const r = len * 0.12;
  const x0 = front - len;
  const wr = x0 + len * 0.23;
  const wf = x0 + len * 0.78;
  const body = `M${x0 + 2},${y - r * 0.9} L${x0 + 2},${y - h * 0.62} Q${x0 + 4},${y - h * 0.72} ${x0 + len * 0.12},${y - h * 0.74} L${x0 + len * 0.26},${y - h * 1.0} L${x0 + len * 0.66},${y - h * 1.0} L${x0 + len * 0.84},${y - h * 0.66} L${front - 3},${y - h * 0.56} Q${front},${y - h * 0.5} ${front},${y - r * 0.9} Z`;
  const wheel = (cx, driven) => (
    <g>
      <circle cx={cx} cy={y - r} r={r} fill="#111827" />
      <circle cx={cx} cy={y - r} r={r * 0.55} fill="#cbd5e1" />
      {[0, 1, 2].map((i) => {
        const a = spin + (i * Math.PI * 2) / 3;
        return <line key={i} x1={cx} y1={y - r} x2={cx + Math.cos(a) * r * 0.5} y2={y - r + Math.sin(a) * r * 0.5} stroke="#475569" strokeWidth="1.6" />;
      })}
      {driven && slip && <circle cx={cx} cy={y - r} r={r + 2.5} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />}
    </g>
  );
  return (
    <g>
      {slip &&
        [0, 1, 2, 3].map((i) => {
          const ph = (t * 2.2 + i * 0.25) % 1;
          return <circle key={i} cx={wr - r - ph * len * 0.5} cy={y - r * 0.6 - ph * r * 1.4} r={r * (0.4 + ph * 0.9)} fill="#94a3b8" opacity={0.45 * (1 - ph)} />;
        })}
      <path d={body} fill={color} stroke="#0f172a" strokeWidth="1.3" strokeLinejoin="round" />
      <path d={`M${x0 + len * 0.29},${y - h * 0.94} L${x0 + len * 0.46},${y - h * 0.94} L${x0 + len * 0.46},${y - h * 0.7} L${x0 + len * 0.2},${y - h * 0.7} Z`} fill="#e0f2fe" />
      <path d={`M${x0 + len * 0.5},${y - h * 0.94} L${x0 + len * 0.64},${y - h * 0.94} L${x0 + len * 0.78},${y - h * 0.7} L${x0 + len * 0.5},${y - h * 0.7} Z`} fill="#e0f2fe" />
      <rect x={front - 6} y={y - h * 0.52} width={4} height={3} rx={1} fill="#fde68a" />
      {wheel(wr, true)}
      {wheel(wf, false)}
    </g>
  );
}

function gripGeom(W, narrow) {
  const carL = narrow ? 58 : 96;
  const padL = carL + (narrow ? 8 : 20);
  const padR = narrow ? 14 : 30;
  const kx = (W - padL - padR) / X_VIEW;
  const kF = (narrow ? 60 : 110) / 8000; // px per newton
  return { carL, padL, kx, kF, unit: forceUnit(kF, narrow ? 22 : 30) };
}

function GripScene({ T, l1, l2, F, t }) {
  const L = T.grip;
  const dec = T.decimal;
  const kN2 = (n) => trim(Number((n / 1000).toFixed(2)), dec, 2);
  return (
    <LabScene
      legend={[
        { color: FC.fric, label: L.legend.fric, kind: 'arrow' },
        { color: '#64748b', label: L.legend.push, kind: 'darrow' },
        { color: PALETTE.vel, label: L.legend.vel, kind: 'arrow' },
      ]}
      chips={(W, H, narrow) => {
        const g = gripGeom(W, narrow);
        return (
          <>
            <Chip icon={Timer}>{L.chipTime(num(t, 1, dec))}</Chip>
            <Chip icon={Ruler} color="#475569">
              <ScaleBar px={g.unit * g.kF} text={`= ${kN2(g.unit)} ${T.kN}`} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 300 : 360)}
      ariaLabel={L.sceneLabel(num(t, 1, dec), num(l1.a * t * 3.6, 0, dec), num(l2.a * t * 3.6, 0, dec))}
    >
      {(W, H, narrow) => {
        const { carL, padL, kx, kF } = gripGeom(W, narrow);
        const fs = narrow ? 10 : 12;
        const box = { w: W, h: H };
        const slabH = narrow ? 14 : 18;
        const rulerY = H - (narrow ? 30 : 32);
        const y2 = rulerY - slabH - (narrow ? 30 : 34);
        const y1 = y2 - (narrow ? 112 : 132);
        const carH = carL * 0.36;
        const sx = (x) => padL + x * kx;
        const lanes = [
          { l: l1, y: y1, color: '#2563eb', key: 'l1' },
          { l: l2, y: y2, color: '#db2777', key: 'l2' },
        ];
        const step = narrow ? 20 : 10;
        const ticks = [];
        for (let x = 0; x <= X_VIEW; x += step / 2) ticks.push(x);
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid W={W} top={0} bottom={rulerY} step={narrow ? 22 : 28} />
            {/* ruler */}
            <rect x={0} y={rulerY} width={W} height={H - rulerY} fill="#f1f5f9" />
            <line x1={0} x2={W} y1={rulerY} y2={rulerY} stroke="#475569" strokeWidth="1.3" />
            {ticks.map((x) => {
              const major = Math.abs(x / step - Math.round(x / step)) < 1e-6;
              const px = sx(x);
              return (
                <g key={x}>
                  <line x1={px} x2={px} y1={rulerY} y2={rulerY + (major ? 8 : 4)} stroke="#475569" strokeWidth={major ? 1.3 : 1} />
                  {major && px < W - (narrow ? 50 : 34) && (
                    <text x={px} y={rulerY + 20} textAnchor="middle" fontSize={fs} fill="#475569" fontWeight={x === 0 ? 700 : 500}>
                      {x}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={W - 6} y={rulerY + 20} textAnchor="end" fontSize={fs} fontWeight="700" fill="#475569">
              {L.axisX}
            </text>

            {lanes.map(({ l, y, color, key }) => {
              const x = 0.5 * l.a * t * t;
              const v = l.a * t;
              const front = sx(x);
              const wr = front - carL + carL * 0.23;
              const ghost = 0.5 * (F / CAR_M) * t * t; // how far the wheel turns if it spins
              const spin = ((l.grip ? x : Math.max(x, ghost * 1.4)) / 0.3) % (Math.PI * 2);
              const slip = !l.grip && t > 0;
              const fLen = l.f * kF;
              const vLen = v * (narrow ? 1.6 : 3);
              const tag = L.laneTag(L.surfaces[l.id], trim(l.mu0, dec));
              const labelY = y - (narrow ? 58 : 72);
              const vY = y - carH - (narrow ? 8 : 10);
              const dark = l.kind === 'asphalt' || l.kind === 'wet';
              return (
                <g key={key}>
                  <Slab x0={0} x1={W} y={y} h={slabH} kind={l.kind} />
                  <line x1={sx(0)} x2={sx(0)} y1={y - 6} y2={y + slabH} stroke={FC.ink} strokeWidth="1.5" strokeDasharray="3 2" />
                  {slip && <line x1={Math.max(sx(0) - carL + carL * 0.23, 0)} x2={wr} y1={y + 1.5} y2={y + 1.5} stroke={dark ? '#111827' : '#64748b'} strokeWidth="2.5" opacity="0.55" />}
                  <SideCar front={front} y={y} len={carL} color={color} spin={spin} slip={slip} t={t} />
                  {/* the pair of forces at the driven wheel's contact: on the road (back) and on the tyre (forward) */}
                  <Arrow x1={wr} y1={y + slabH * 0.55} x2={wr - fLen} y2={y + slabH * 0.55} color={dark ? '#e2e8f0' : '#475569'} width={2.5} head={9} dash="4 3" />
                  <FArrow x1={wr} y1={y - 1} x2={wr + fLen} y2={y - 1} color={FC.fric} width={narrow ? 3 : 3.5} head={narrow ? 9 : 12} />
                  {v > 0.05 && <Arrow x1={front - carL * 0.5} y1={vY} x2={front - carL * 0.5 + vLen} y2={vY} color={PALETTE.vel} width={3} head={10} />}
                  <TagPill x={narrow ? 8 : 12} y={labelY} text={tag} bg="#ffffff" color="#0f172a" border="#cbd5e1" size={fs} anchor="start" box={box} />
                  {slip && <TagPill x={(narrow ? 8 : 12) + tagWidth(tag, fs) + 6} y={labelY} text={L.slip} bg="#dc2626" size={fs} anchor="start" box={box} />}
                  <TagPill x={wr + Math.max(fLen, 4) / 2} y={y + slabH + (narrow ? 12 : 14)} text={L.tagFric(kN2(l.f))} bg={FC.fric} size={fs} box={box} />
                  {v > 0.05 && <TagPill x={front - carL * 0.5 + vLen + 6} y={vY} text={L.tagV(num(v * 3.6, 0, dec))} bg={PALETTE.vel} size={fs} anchor="start" box={box} />}
                </g>
              );
            })}
          </>
        );
      }}
    </LabScene>
  );
}
