import { useState } from 'react';
import { Lightbulb, Moon, TestTube, Wind } from 'lucide-react';

import { Arrow, Explain, Pill, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, sig3 } from './Gravity.parts';

/**
 * Tab 3 — why everything falls with the same g. The force of gravity is
 * proportional to the mass (F = mg), so the acceleration a = F/m = g is the
 * same for a 1.32 kg hammer and a 0.03 kg falcon feather (Apollo 15, the
 * Moon, 1971), dropped from 1.6 m:
 *   Moon (no air):   t = √(2h/g) = √(2·1.6/1.62) = 1.41 s for both;
 *   Earth, vacuum:   t = √(2·1.6/9.8) = 0.571 s for both (Newton's tube);
 *   Earth, in air:   quadratic drag F = mg·(v/v_t)², v_t = 0.5 m/s for the
 *                    feather (lands after 3.24 s), 40 m/s for the hammer
 *                    (0.572 s): v = v_t·tanh(gt/v_t).
 * The run is shown slowed down (×½ by default; chip says so).
 * Strings come from T.fall.
 */

const H_DROP = 1.6;
const OBJ = {
  hammer: { m: 1.32, vt: 40 },
  feather: { m: 0.03, vt: 0.5 },
};
const ENVS = {
  moon: { g: 1.62, gd: 2, air: false, strobe: 0.2, icon: Moon },
  tube: { g: 9.8, gd: 1, air: false, strobe: 0.1, icon: TestTube },
  air: { g: 9.8, gd: 1, air: true, strobe: 0.1, icon: Wind },
};
const IDLE = { t: 0, running: false, done: false };

/* stable ln(cosh u) and acosh(e^z) for u, z ≥ 0 */
const lnCosh = (u) => u + Math.log1p(Math.exp(-2 * u)) - Math.LN2;
const acoshExp = (z) => z + Math.log1p(Math.sqrt(Math.max(0, 1 - Math.exp(-2 * z))));

function motion(o, env, t) {
  const { g, air } = env;
  if (!air) return { y: 0.5 * g * t * t, v: g * t, a: g };
  const x = (g * t) / o.vt;
  const th = Math.tanh(x);
  return { y: ((o.vt * o.vt) / g) * lnCosh(x), v: o.vt * th, a: g * (1 - th * th) };
}
function landTime(o, env) {
  const { g, air } = env;
  if (!air) return Math.sqrt((2 * H_DROP) / g);
  return (o.vt / g) * acoshExp((H_DROP * g) / (o.vt * o.vt));
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceMax(v, parts = 4) {
  const raw = Math.max(v, 1e-6) / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = NICE.find((q) => q * p >= raw - 1e-12) ?? 10;
  return m * p * parts;
}
function tickDigits(max, parts = 4) {
  const s = max / parts;
  for (let d = 0; d <= 3; d += 1) if (Math.abs(s * 10 ** d - Math.round(s * 10 ** d)) < 1e-6) return d;
  return 3;
}
function niceForce(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const q of [1, 2, 5, 10]) if (q * p >= v) return q * p;
  return 10 * p;
}

export default function FallSim({ T }) {
  const L = T.fall;
  const dec = T.decimal;
  const [envId, setEnvId] = useState('moon');
  const [slow, setSlow] = useState(0.5);
  const [sim, setSim] = useState(IDLE);
  const env = ENVS[envId];
  const tH = landTime(OBJ.hammer, env);
  const tF = landTime(OBJ.feather, env);
  const tEnd = Math.max(tH, tF);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt * slow);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const pickEnv = (id) => {
    setEnvId(id);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = sim.t;
  const st = (o, tl) => {
    const tt = Math.min(t, tl);
    const s = motion(o, env, tt);
    const landed = t >= tl - 1e-9;
    // aFly: the acceleration during the fall (the last in-flight value once it has landed)
    return { ...s, y: Math.min(H_DROP, s.y), landed, aFly: s.a, a: landed ? 0 : s.a };
  };
  const hm = st(OBJ.hammer, tH);
  const fe = st(OBJ.feather, tF);
  const FH = OBJ.hammer.m * env.g;
  const FF = OBJ.feather.m * env.g;
  const gS = fmt(env.g, env.gd, dec);
  const ratio = fmt(OBJ.hammer.m / OBJ.feather.m, 0, dec);
  const slowK = Math.round(1 / slow);
  const slowText = slow === 1 ? L.chipReal : L.chipSlow(slowK);

  let phase = 'idle';
  if (sim.done) phase = 'done';
  else if (t > 0) phase = env.air && hm.landed ? 'half' : 'fall';
  const settled = useSettled(`${envId}-${phase}`, 0);
  const [sEnv, sPhase] = settled.split('-');
  const ex = L.explain;
  const sE = ENVS[sEnv];
  const sg = fmt(sE.g, sE.gd, dec);
  const t2 = (x) => fmt(x, 2, dec);
  let text;
  if (sPhase === 'idle') text = ex[`${sEnv}Idle`];
  else if (sPhase === 'fall') text = sE.air ? ex.airFall(fmt(OBJ.feather.vt, 1, dec)) : ex.vacuumFall(ratio, sg);
  else if (sPhase === 'half') text = ex.airHalf(t2(landTime(OBJ.hammer, sE)));
  else if (sEnv === 'air') text = ex.airDone(t2(landTime(OBJ.hammer, sE)), t2(landTime(OBJ.feather, sE)));
  else text = ex[`${sEnv}Done`](t2(landTime(OBJ.hammer, sE)), sg);
  const tone = { idle: '#22d3ee', fall: '#fb923c', half: '#60a5fa', done: '#34d399' }[sPhase];

  /* v(t) for the graph */
  const series = [];
  for (const [id, o, tl, color, dash] of [
    ['hammer', OBJ.hammer, tH, '#6ee7b7', undefined],
    ['feather', OBJ.feather, tF, '#f9a8d4', '6 5'],
  ]) {
    const pts = [];
    const tMaxS = Math.min(t, tl);
    const n = 60;
    for (let i = 0; i <= n; i += 1) {
      const tt = (tMaxS * i) / n;
      pts.push({ x: tt, y: motion(o, env, tt).v });
    }
    series.push({ id, label: L[id], color, dash, points: t > 0 ? pts : [] });
  }
  const xMax = niceMax(tEnd);
  const yMax = niceMax(motion(OBJ.hammer, env, tH).v);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.envLabel}</GroupLabel>
          <Segmented
            label={L.envLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={envId}
            onChange={pickEnv}
            options={Object.keys(ENVS).map((id) => ({ value: id, label: L.envs[id].name, sub: L.envs[id].sub, icon: ENVS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <FallScene T={T} envId={envId} t={t} tH={tH} tF={tF} hm={hm} fe={fe} running={sim.running} slowText={slowText} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={slowText} />
        <Readout
          label={L.readouts.hammer}
          symbol="mg"
          value={fmt(FH, 2, dec)}
          unit={T.N}
          accent={PALETTE.force}
          textColor="#fca5a5"
          sub={hm.landed ? L.objLanded(fmt(OBJ.hammer.m, 2, dec)) : L.objSub(fmt(OBJ.hammer.m, 2, dec), fmt(hm.a, env.gd, dec))}
        />
        <Readout
          label={L.readouts.feather}
          symbol="mg"
          value={sig3(FF, dec)}
          unit={T.N}
          accent={PALETTE.second}
          textColor={PALETTE.secondText}
          sub={fe.landed ? L.objLanded(fmt(OBJ.feather.m, 2, dec)) : L.objSub(fmt(OBJ.feather.m, 2, dec), fmt(fe.a, env.gd, dec))}
        />
        <Readout label={L.readouts.times} accent="#e2e8f0">
          <div className="mt-2 space-y-1 text-sm tabular-nums">
            {[
              ['hammer', tH, hm.landed, '#6ee7b7'],
              ['feather', tF, fe.landed, '#f9a8d4'],
            ].map(([id, tl, landed, c]) => (
              <p key={id} className="flex items-baseline justify-between gap-2">
                <span className="text-gray-400">{L[id]}</span>
                <span className="text-lg font-bold" style={{ color: landed ? c : '#4b5563' }}>
                  {landed ? `${fmt(tl, 2, dec)} ${T.s}` : '…'}
                </span>
              </p>
            ))}
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.slowLabel}</p>
            <Segmented
              label={L.slowLabel}
              className="grid-cols-3"
              value={slow}
              onChange={setSlow}
              options={[1, 0.5, 0.25].map((s) => ({ value: s, label: s === 1 ? L.slow.real : L.slow.times(Math.round(1 / s)) }))}
            />
          </div>
          <FormulaTile
            tag={L.formula.tag}
            color={PALETTE.accText}
            general="a = F / m = m·g / m = g"
            filled={
              <>
                {L.hammer}: {fmt(FH, 2, dec)} {T.N} / {fmt(OBJ.hammer.m, 2, dec)} {T.kg} = {gS} {T.ms2}
                <br />
                {L.feather}: {sig3(FF, dec)} {T.N} / {fmt(OBJ.feather.m, 2, dec)} {T.kg} = {gS} {T.ms2}
              </>
            }
            note={env.air ? L.formula.airNote : L.formula.note(ratio)}
          />
          <FaBars T={T} FH={FH} FF={FF} aH={hm.aFly} aF={fe.aFly} g={env.g} started={t > 0} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={xMax}
            yMax={yMax}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={t}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(yMax)}
            note={env.air ? L.graph.noteAir(fmt(OBJ.feather.vt, 1, dec)) : L.graph.noteVac}
            ariaLabel={L.graph.label}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- F and a bars */

function FaBars({ T, FH, FF, aH, aF, g, started }) {
  const L = T.fall;
  const dec = T.decimal;
  const rows = [
    { id: 'F', title: L.bars.F, items: [[L.hammer, FH / FH, `${fmt(FH, 2, dec)} ${T.N}`, '#f87171'], [L.feather, FF / FH, `${sig3(FF, dec)} ${T.N}`, '#f9a8d4']] },
    {
      id: 'a',
      title: L.bars.a,
      items: [
        [L.hammer, (started ? aH : g) / g, `${fmt(started ? aH : g, 2, dec)} ${T.ms2}`, '#fb923c'],
        [L.feather, (started ? aF : g) / g, `${fmt(started ? aF : g, 2, dec)} ${T.ms2}`, '#fdba74'],
      ],
    },
  ];
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5 space-y-2.5">
      {rows.map((r) => (
        <div key={r.id}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{r.title}</p>
          {r.items.map(([name, f, val, c]) => (
            <div key={name} className="mt-1 flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-gray-400">{name}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200" style={{ width: `${Math.max(0.8, Math.min(1, f) * 100)}%`, background: c }} />
              </span>
              <span className="w-[86px] shrink-0 text-right text-xs font-semibold tabular-nums text-gray-200">{val}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function hash01(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A geologist's hammer hanging head down, bottom at (x, y). */
function Hammer({ x, y, h }) {
  const headH = h * 0.24;
  const headW = h * 0.7;
  const handleW = Math.max(5, h * 0.13);
  return (
    <g>
      <rect x={x - handleW / 2} y={y - h} width={handleW} height={h - headH + 2} rx={handleW / 2} fill="#b45309" stroke="#78350f" strokeWidth={1} />
      <rect x={x - handleW / 2} y={y - h} width={handleW} height={h * 0.3} rx={handleW / 2} fill="#1f2937" />
      <path
        d={`M${x - headW * 0.42},${y - headH} L${x + headW * 0.22},${y - headH} L${x + headW * 0.58},${y - headH * 0.45} L${x + headW * 0.22},${y} L${x - headW * 0.42},${y} Z`}
        fill="#64748b"
        stroke="#334155"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect x={x - headW * 0.42} y={y - headH} width={headW * 0.2} height={headH} fill="#475569" />
    </g>
  );
}

/** A falcon feather, quill down, bottom at (x, y). */
function Feather({ x, y, h, rot = 0 }) {
  const w = h * 0.34;
  const top = y - h;
  const vane = `M${x},${y - h * 0.16} C${x - w},${y - h * 0.32} ${x - w * 0.9},${top + h * 0.18} ${x},${top} C${x + w * 0.85},${top + h * 0.2} ${x + w * 0.8},${y - h * 0.36} ${x},${y - h * 0.16} Z`;
  return (
    <g transform={`rotate(${rot} ${x} ${y - h / 2})`}>
      <path d={vane} fill="#d6c3a5" stroke="#8b7355" strokeWidth={1} />
      {[0.3, 0.45, 0.6, 0.75].map((f) => (
        <path key={f} d={`M${x - w * 0.62},${y - h * f - h * 0.04} Q${x},${y - h * f + h * 0.03} ${x + w * 0.58},${y - h * f - h * 0.05}`} fill="none" stroke="#8b7355" strokeWidth={1.4} opacity="0.55" />
      ))}
      <line x1={x} y1={y} x2={x} y2={top + 2} stroke="#5b4636" strokeWidth={1.4} />
    </g>
  );
}

function FallScene({ T, envId, t, tH, tF, hm, fe, running, slowText }) {
  const L = T.fall;
  const dec = T.decimal;
  const env = ENVS[envId];
  const FH = OBJ.hammer.m * env.g;
  const FF = OBJ.feather.m * env.g;
  const legend = [
    { color: PALETTE.force, label: L.legend.F, kind: 'arrow' },
    { color: PALETTE.acc, label: L.legend.a, kind: 'arrow' },
    { color: '#334155', label: L.legend.strobe(fmt(env.strobe, 1, dec)), kind: 'ring' },
  ];

  return (
    <LabScene
      legend={legend}
      chips={
        <Chip>
          {slowText} · t = {fmt(t, 2, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 440 : 480)}
      ariaLabel={L.sceneLabel(L.envs[envId].name, fmt(t, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const padT = narrow ? 44 : 72;
        const groundY = H - (narrow ? 52 : 56);
        const objH = narrow ? 48 : 66;
        const k = (groundY - padT - objH - 24) / H_DROP;
        const rulerX = narrow ? 30 : 48;
        const hx = W * (narrow ? 0.42 : 0.4);
        const fx = W * (narrow ? 0.76 : 0.62);
        const yAt = (fallen) => groundY - (H_DROP - fallen) * k; // bottom of the object
        const barY = yAt(0) - objH - 10;
        const fRef = 84 / FH;
        const aRef = 84 / env.g;
        const fBar = niceForce(FH / 2.5);
        const rows = [];
        for (let i = 0; i <= Math.round(H_DROP / 0.2); i += 1) rows.push(i * 0.2);

        /* stroboscope: marks at n·Δt for both bodies */
        const marks = [];
        const nMax = Math.floor(Math.min(t, Math.max(tH, tF)) / env.strobe + 1e-9);
        for (let n = 0; n <= nMax; n += 1) {
          const tt = n * env.strobe;
          const yh = tt <= tH + 1e-9 ? yAt(Math.min(H_DROP, motion(OBJ.hammer, env, tt).y)) - objH / 2 : null;
          const yf = tt <= tF + 1e-9 ? yAt(Math.min(H_DROP, motion(OBJ.feather, env, tt).y)) - objH / 2 : null;
          marks.push({ n, tt, yh, yf });
        }

        const hy = yAt(hm.y);
        const fy = yAt(fe.y);
        const flutter = env.air && !fe.landed && t > 0 ? Math.sin(t * 9) * 14 : 0;
        const sway = env.air && !fe.landed && t > 0 ? Math.sin(t * 4.5) * (narrow ? 4 : 7) : 0;
        const hc = hy - objH / 2;
        const fc = fy - objH / 2;
        const side = narrow ? 18 : 26;
        const tubeL = hx - (narrow ? 48 : 70);
        const tubeR = fx + (narrow ? 40 : 70);

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {rows.map((m) => (
              <line key={`g${m}`} x1={rulerX} x2={W} y1={groundY - m * k} y2={groundY - m * k} stroke={PALETTE.grid} strokeWidth={1} />
            ))}
            {env.air &&
              Array.from({ length: 70 }, (_, i) => (
                <circle key={`air${i}`} cx={rulerX + 10 + hash01(i + 5) * (W - rulerX - 20)} cy={padT + hash01(i + 91) * (groundY - padT - 6)} r={1.6} fill="#7dd3fc" opacity="0.45" />
              ))}

            {/* Newton's tube */}
            {envId === 'tube' && (
              <g>
                <rect x={tubeL} y={barY - 26} width={tubeR - tubeL} height={groundY - barY + 26} rx={22} fill="#e0f2fe" fillOpacity="0.45" stroke="#7dd3fc" strokeWidth={2.5} />
                <rect x={tubeL + 6} y={barY - 20} width={8} height={groundY - barY + 10} rx={4} fill="#fff" opacity="0.7" />
                <rect x={tubeR - 1} y={barY + 14} width={narrow ? 10 : 16} height={12} rx={2} fill="#64748b" />
                <Pill x={tubeR + (narrow ? 10 : 16) + (textWidth(L.vacuum, fs - 1, 600) + 16) / 2 + 4} y={barY + 20} text={L.vacuum} bg="#0369a1" size={fs - 1} box={box} />
              </g>
            )}

            {/* height ruler */}
            <line x1={rulerX} x2={rulerX} y1={groundY} y2={groundY - H_DROP * k} stroke="#475569" strokeWidth={1.4} />
            {rows.map((m, i) => (
              <g key={`r${m}`}>
                <line x1={rulerX - 6} x2={rulerX} y1={groundY - m * k} y2={groundY - m * k} stroke="#475569" strokeWidth={1.2} />
                {i > 0 && (!narrow || i % 2 === 0) && (
                  <text x={rulerX - 9} y={groundY - m * k + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
                    {fmt(m, 1, dec)}
                  </text>
                )}
              </g>
            ))}
            <text x={rulerX + 6} y={groundY - H_DROP * k - 8} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {L.heightAxis}
            </text>

            {/* release bar */}
            <rect x={hx - side - 20} y={barY - 6} width={fx - hx + 2 * side + 40} height={6} rx={3} fill="#94a3b8" />
            {[hx, fx].map((x) => (
              <g key={`clamp${x}`}>
                <rect x={x - (t > 0 ? 13 : 7)} y={barY} width={5} height={12} rx={1.5} fill="#64748b" />
                <rect x={x + (t > 0 ? 8 : 2)} y={barY} width={5} height={12} rx={1.5} fill="#64748b" />
              </g>
            ))}

            {/* ground */}
            <rect x={0} y={groundY} width={W} height={H - groundY} fill={envId === 'moon' ? '#f1f5f9' : '#ecfccb'} />
            {envId === 'moon' &&
              Array.from({ length: 22 }, (_, i) => {
                const r = 2 + hash01(i + 9) * 8;
                return <ellipse key={`cr${i}`} cx={hash01(i + 2) * W} cy={groundY + 10 + hash01(i + 33) * (H - groundY - 16)} rx={r} ry={r * 0.4} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />;
              })}
            <line x1={0} x2={W} y1={groundY} y2={groundY} stroke={envId === 'moon' ? '#94a3b8' : '#65a30d'} strokeWidth={2} />
            {!narrow && (
              <text x={W - 10} y={H - 10} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill={envId === 'moon' ? '#475569' : '#3f6212'}>
                {L.ground[envId]}
              </text>
            )}

            {/* stroboscope marks, joined at equal moments */}
            {marks.map((mk) => (
              <g key={`s${mk.n}`}>
                {mk.yh !== null && mk.yf !== null && <line x1={hx + 6} x2={fx - 6} y1={mk.yh} y2={mk.yf} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 4" />}
                {mk.yh !== null && <circle cx={hx} cy={mk.yh} r={3.5} fill="#fff" stroke="#334155" strokeWidth={1.4} strokeOpacity="0.6" />}
                {mk.yf !== null && <circle cx={fx} cy={mk.yf} r={3.5} fill="#fff" stroke="#be185d" strokeWidth={1.4} strokeOpacity="0.6" />}
                {mk.yh !== null && mk.n > 0 && (!narrow || mk.n % 2 === 0) && (
                  <text x={hx - side - 30} y={mk.yh + 4} textAnchor="end" fontSize={fs - 2} fontWeight="600" fill="#475569" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                    {L.secTag(fmt(mk.tt, 1, dec))}
                  </text>
                )}
              </g>
            ))}

            {/* air flowing past the feather */}
            {env.air && running && !fe.landed && (
              <g stroke="#0284c7" strokeWidth={1.3} strokeLinecap="round" opacity="0.6" fill="none">
                {[-1, 0, 1].map((s) => (
                  <path key={`w${s}`} d={`M${fx + sway + s * 9},${fy - objH - 6} q${s * 3},-8 0,-16`} />
                ))}
              </g>
            )}

            {/* the bodies */}
            <Hammer x={hx} y={hy} h={objH} />
            <Feather x={fx + sway} y={fy} h={objH} rot={flutter} />

            {/* force of gravity (left) and acceleration (right) */}
            {!hm.landed && (
              <>
                <Arrow x1={hx - side} y1={hc} x2={hx - side} y2={hc + FH * fRef} color={PALETTE.force} width={3.5} head={11} />
                <circle cx={hx - side} cy={hc} r={3} fill={PALETTE.force} />
                <Pill x={hx - side - (textWidth(L.mgTag(fmt(FH, 2, dec)), fs - 1, 600) + 16) / 2 - 8} y={hc + 30} text={L.mgTag(fmt(FH, 2, dec))} bg={PALETTE.force} size={fs - 1} box={box} />
                {hm.a * aRef > 3 && <Arrow x1={hx + side} y1={hc} x2={hx + side} y2={hc + hm.a * aRef} color={PALETTE.acc} width={3} head={10} />}
                <text opacity={hm.a * aRef > 3 ? 1 : 0} x={hx + side + 8} y={hc + 18} fontSize={fs + 1} fontStyle="italic" fontWeight="700" fill={PALETTE.acc} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  a
                </text>
              </>
            )}
            {!fe.landed && (
              <>
                <line x1={fx - side} y1={fc} x2={fx - side} y2={fc + Math.max(2, FF * fRef)} stroke={PALETTE.force} strokeWidth={3} strokeLinecap="round" />
                <circle cx={fx - side} cy={fc} r={3} fill={PALETTE.force} />
                <Pill x={fx - side - (textWidth(L.mgTag(sig3(FF, dec)), fs - 1, 600) + 16) / 2 - 8} y={fc + 2} text={L.mgTag(sig3(FF, dec))} bg={PALETTE.force} size={fs - 1} box={box} />
                {fe.a * aRef > 3 && <Arrow x1={fx + side} y1={fc} x2={fx + side} y2={fc + fe.a * aRef} color={PALETTE.acc} width={3} head={10} />}
                <text opacity={fe.a * aRef > 3 ? 1 : 0} x={fx + side + 8} y={fc + 18} fontSize={fs + 1} fontStyle="italic" fontWeight="700" fill={PALETTE.acc} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  a
                </text>
                {env.air && t > 0.15 && <Pill x={fx + side + 58} y={fc - 18} text={L.dragTag} bg="#0369a1" size={fs - 1.5} box={box} />}
              </>
            )}

            {/* names and landing times */}
            <text x={hx} y={H - (narrow ? 8 : 10)} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#334155">
              {L.hammerTag(fmt(OBJ.hammer.m, 2, dec))}
            </text>
            <text x={fx} y={H - (narrow ? 8 : 10)} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#9d174d">
              {L.featherTag(fmt(OBJ.feather.m, 2, dec))}
            </text>
            {hm.landed && <Pill x={hx} y={groundY + 16} text={L.landTag(fmt(tH, 2, dec))} bg="#059669" size={fs - 1} box={box} />}
            {fe.landed && <Pill x={fx} y={groundY + 16} text={L.landTag(fmt(tF, 2, dec))} bg="#be185d" size={fs - 1} box={box} />}

            {/* force scale */}
            <g transform={`translate(${narrow ? 14 : W - 120} ${narrow ? 22 : groundY - 16})`}>
              <line x1={0} x2={fBar * fRef} y1={0} y2={0} stroke={PALETTE.force} strokeWidth={3} strokeLinecap="round" />
              <line x1={0} x2={0} y1={-4} y2={4} stroke={PALETTE.force} strokeWidth={1.5} />
              <line x1={fBar * fRef} x2={fBar * fRef} y1={-4} y2={4} stroke={PALETTE.force} strokeWidth={1.5} />
              <text x={fBar * fRef + 6} y={4} fontSize={fs - 1} fontWeight="700" fill="#991b1b">
                {L.forceScale(fmt(fBar, fBar < 1 ? 1 : 0, dec))}
              </text>
            </g>
          </>
        );
      }}
    </LabScene>
  );
}
