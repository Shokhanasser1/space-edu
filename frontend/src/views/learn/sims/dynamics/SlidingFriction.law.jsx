import { useState } from 'react';
import { Disc, Eraser, Lightbulb, RectangleHorizontal, RectangleVertical, Ruler as RulerIcon, StretchHorizontal } from 'lucide-react';

import { Btn, Explain, Pill, Readout, Segmented, clamp, fmt, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Block, Chip, FORCE, FORCE_TEXT, G, GroupLabel, LabScene, LabWeight, PlayControls, Rich, ScaleBar, VecArrow, Wheel, round, trim } from './SlidingFriction.parts';

/**
 * Tab 2 — the law F = μN on the lab bench. A 0.5 kg wooden block
 * (20 × 10 × 4 cm) is pulled across a wooden table with a spring scale at a
 * steady 0.1 m/s; then the pull equals friction and the scale reads it.
 * Weights of 0.5 kg raise N in steps of 4.9 N and F grows with it
 * (μ = 0.25: F = 1.23, 2.45, 3.68, 4.90, 6.13 N). Turning the block on
 * another face changes the contact area (200, 80, 40 cm²) but not F. On
 * wheels the rolling friction is ≈ 0.02·N, 12.5 times smaller. Each steady
 * pull drops a point on the F(N) graph. Strings come from T.law.
 */

const M0 = 0.5; // kg, the block
const MW = 0.5; // kg, one weight
const MU_S = 0.25; // wood on wood, sliding
const MU_R = 0.02; // rolling, small wheels
const FACES = {
  flat: { L: 20, H: 4, S: 200, icon: RectangleHorizontal },
  side: { L: 20, H: 10, S: 80, icon: StretchHorizontal },
  end: { L: 10, H: 20, S: 40, icon: RectangleVertical },
  wheels: { L: 20, H: 4, S: null, raise: 3, icon: Disc },
};
const STRETCH = 0.7; // s for the spring to stretch before the block moves
const SPEED = 10; // cm/s — a steady 0.1 m/s
const TRAVEL = 24; // cm along the table
const RECORD_AT = 1; // s of steady sliding before the reading is taken
const CM_PER_N = 1.6; // spring-scale extension
const SPAN = 100; // cm of bench the drawing needs
const IDLE = { phase: 'idle', t: 0, d: 0, paused: false, recorded: false };
const MARK = { flat: 'circle', side: 'square', end: 'triangle', wheels: 'diamond' };
const MARK_COLOR = { flat: '#fca5a5', side: '#fdba74', end: '#f9a8d4', wheels: '#6ee7b7' };

export default function LawSim({ T }) {
  const L = T.law;
  const dec = T.decimal;
  const [face, setFace] = useState('flat');
  const [n, setN] = useState(0);
  const [sim, setSim] = useState(IDLE);
  const [points, setPoints] = useState([]);
  const [msg, setMsg] = useState(null);

  const m = M0 + n * MW;
  const N = m * G;
  const mu = face === 'wheels' ? MU_R : MU_S;
  const F = mu * N;
  const Ff = (v) => trim(v, dec, 2);

  const record = () => {
    const prev = points[points.length - 1];
    const exists = points.some((p) => p.face === face && p.n === n);
    let next;
    if (exists) next = { key: 'repeat', args: [Ff(F)] };
    else if (!prev) next = { key: 'first', args: [Ff(F), Ff(N), trim(mu, dec)] };
    else if (face === 'wheels' && prev.face !== 'wheels') next = { key: 'wheels', args: [Ff(F), Ff(MU_S * N)] };
    else if (face !== 'wheels' && prev.face !== 'wheels' && prev.n === n && prev.face !== face) next = { key: 'sameN', args: [FACES[prev.face].S, FACES[face].S, Ff(F)] };
    else if (prev.face === face && prev.n !== n) next = { key: 'moreN', args: [Ff(prev.N), Ff(N), Ff(prev.F), Ff(F)] };
    else next = { key: 'generic', args: [Ff(F), Ff(N)] };
    if (!exists) setPoints([...points, { face, n, N, F }]);
    setMsg(next);
  };

  const running = (sim.phase === 'stretch' || sim.phase === 'slide') && !sim.paused;
  useRafLoop(running, (dt) => {
    const p = sim;
    if (p.phase === 'stretch') {
      const t = p.t + dt;
      setSim(t >= STRETCH ? { ...p, phase: 'slide', t: 0 } : { ...p, t });
    } else if (p.phase === 'slide') {
      const t = p.t + dt;
      const d = Math.min(TRAVEL, p.d + dt * SPEED);
      const done = d >= TRAVEL - 1e-9;
      const rec = !p.recorded && (t >= RECORD_AT || done);
      if (rec) record();
      setSim({ ...p, t, d, phase: done ? 'done' : 'slide', recorded: p.recorded || rec });
    }
  });

  const started = sim.phase !== 'idle';
  const toggle = () => {
    if (sim.phase === 'idle' || sim.phase === 'done') setSim({ ...IDLE, phase: 'stretch' });
    else setSim((p) => ({ ...p, paused: !p.paused }));
  };
  const reset = () => setSim(IDLE);
  const pickFace = (id) => {
    setFace(id);
    setSim(IDLE);
  };
  const pickN = (k) => {
    setN(k);
    setSim(IDLE);
  };
  const clearPoints = () => {
    setPoints([]);
    setMsg(null);
  };

  /* the pull on the scale right now: it grows while the spring stretches, then equals friction */
  const pull = sim.phase === 'idle' ? 0 : sim.phase === 'stretch' ? F * clamp(sim.t / STRETCH, 0, 1) : F;
  const steady = sim.phase === 'slide' || sim.phase === 'done';

  let key = 'idle';
  if (sim.phase === 'stretch') key = 'stretch';
  else if (steady) key = sim.recorded && msg ? `m:${msg.key}` : face === 'wheels' ? 'slideWheels' : 'slide';
  const settled = useSettled(key, 0);
  const ex = L.explain;
  let text = ex.idle;
  if (settled === 'stretch') text = ex.stretch;
  else if (settled === 'slide') text = ex.slide(Ff(N), Ff(F));
  else if (settled === 'slideWheels') text = ex.slideWheels(Ff(N), Ff(F));
  else if (settled.startsWith('m:') && msg) text = ex[msg.key](...msg.args);
  const tone = settled === 'stretch' ? '#fb923c' : settled.startsWith('m:') ? '#34d399' : settled === 'idle' ? '#22d3ee' : FORCE_TEXT.fr;

  const def = FACES[face];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.faceLabel}</GroupLabel>
          <Segmented
            label={L.faceLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={face}
            onChange={pickFace}
            options={Object.keys(FACES).map((id) => ({ value: id, label: L.faces[id].name, sub: L.faces[id].sub, icon: FACES[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} startLabel={T.common.pull} running={running} done={sim.phase === 'done'} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <LawScene T={T} face={face} n={n} N={N} pull={pull} d={sim.d} phase={sim.phase} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.N} symbol="N" value={Ff(N)} unit={T.N} accent={FORCE.N} textColor={FORCE_TEXT.N} sub={L.NSub(trim(m, dec))} />
        <Readout
          label={L.readouts.F}
          symbol={<Rich>{`F_{${T.sym.fr}}`}</Rich>}
          value={fmt(pull, 2, dec)}
          unit={T.N}
          accent={FORCE.fr}
          textColor={FORCE_TEXT.fr}
          active={steady}
          sub={started ? <Rich>{L.FSub}</Rich> : L.FWait}
        />
        <Readout label={L.readouts.mu} symbol="μ" value={steady ? round(F / N, 2, dec) : '—'} accent="#fbbf24" textColor="#fde68a" sub={face === 'wheels' ? L.muRoll : L.muSlide} />
        <Readout
          label={L.readouts.S}
          symbol="S"
          value={def.S ? fmt(def.S, 0, dec) : '≈ 0'}
          unit={T.cm2}
          accent="#f59e0b"
          textColor="#fcd34d"
          sub={def.S ? L.SSub : L.SWheels}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.loadLabel}</p>
            <Segmented
              label={L.loadLabel}
              className="grid-cols-3 sm:grid-cols-5"
              value={n}
              onChange={pickN}
              accent="#fbbf24"
              options={[0, 1, 2, 3, 4].map((k) => ({ value: k, label: k === 0 ? L.loadNone : `+${k}`, sub: L.loadSub(Ff((M0 + k * MW) * G)) }))}
            />
          </div>
          <PointsTable T={T} points={points} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FNGraph T={T} points={points} current={steady ? { N, F, face } : null} onClear={clearPoints} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the table */

function PointsTable({ T, points }) {
  const L = T.law;
  const dec = T.decimal;
  const rows = points.slice(-5);
  if (!rows.length) return <p className="rounded-xl bg-black/25 px-3 py-3 text-xs leading-snug text-gray-500">{L.graph.empty}</p>;
  return (
    <div className="overflow-hidden rounded-xl bg-black/25">
      <table className="w-full text-left text-[13px] tabular-nums">
        <thead className="text-[11px] uppercase tracking-[0.08em] text-gray-500">
          <tr>
            <th className="px-3 py-1.5 font-semibold" />
            <th className="px-2 py-1.5 font-semibold">N, {T.N}</th>
            <th className="px-2 py-1.5 font-semibold">F, {T.N}</th>
            <th className="px-2 py-1.5 font-semibold">F / N</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.face}${p.n}`} className="border-t border-white/5">
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-2 text-gray-300">
                  <svg width="12" height="12" aria-hidden="true">
                    <Marker kind={MARK[p.face]} x={6} y={6} r={4.5} color={MARK_COLOR[p.face]} />
                  </svg>
                  <span className="truncate text-xs">{L.faces[p.face].name}</span>
                </span>
              </td>
              <td className="px-2 py-1.5 text-cyan-200">{trim(p.N, dec, 2)}</td>
              <td className="px-2 py-1.5 text-red-200">{trim(p.F, dec, 2)}</td>
              <td className="px-2 py-1.5 text-amber-200">{round(p.F / p.N, 2, dec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------ the graph */

function Marker({ kind, x, y, r, color, hollow }) {
  const common = { fill: hollow ? 'none' : color, stroke: hollow ? color : '#0b0b16', strokeWidth: hollow ? 2 : 1.3 };
  if (kind === 'square') return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} {...common} />;
  if (kind === 'triangle') return <path d={`M${x},${y - r} L${x + r},${y + r * 0.8} L${x - r},${y + r * 0.8} Z`} {...common} />;
  if (kind === 'diamond') return <path d={`M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y} Z`} {...common} />;
  return <circle cx={x} cy={y} r={r * 0.9} {...common} />;
}

function FNGraph({ T, points, current, onClear }) {
  const L = T.law.graph;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const H = 244;
  const pad = { l: 40, r: 16, t: 20, b: 40 };
  const W = Math.max(width, 240);
  const xMax = 25;
  const yMax = 8;
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const hasSlide = points.some((p) => p.face !== 'wheels');
  const hasRoll = points.some((p) => p.face === 'wheels');
  const lineLabel = (text, x, y, color) => (
    <text x={x} y={y} textAnchor="end" fontSize="11" fontWeight="600" fill={color}>
      {text}
    </text>
  );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{L.title}</p>
        {Object.keys(MARK).map((f) => (
          <span key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
            <svg width="12" height="12" aria-hidden="true">
              <Marker kind={MARK[f]} x={6} y={6} r={4.5} color={MARK_COLOR[f]} />
            </svg>
            {T.law.faces[f].name}
          </span>
        ))}
        <Btn icon={Eraser} onClick={onClear} disabled={!points.length} className="ml-auto !min-h-9 !px-3 text-xs">
          {L.clear}
        </Btn>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.label} className="block overflow-visible">
          {[0, 2, 4, 6, 8].map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, 0, dec)}
              </text>
            </g>
          ))}
          {[0, 5, 10, 15, 20, 25].map((v) => (
            <g key={`x${v}`}>
              <line x1={gx(v)} x2={gx(v)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.05)" />
              <text x={gx(v)} y={H - pad.b + 16} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {fmt(v, 0, dec)}
              </text>
            </g>
          ))}
          <text x={W - pad.r} y={H - 3} textAnchor="end" fontSize="11" fill="#64748b">
            {L.x}
          </text>
          <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
            {L.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {hasSlide && (
            <>
              <line x1={gx(0)} y1={gy(0)} x2={gx(xMax)} y2={gy(MU_S * xMax)} stroke="#f87171" strokeWidth="2" strokeDasharray="6 5" />
              {lineLabel(L.slide, gx(xMax) - 4, gy(MU_S * xMax) - 8, '#fca5a5')}
            </>
          )}
          {hasRoll && (
            <>
              <line x1={gx(0)} y1={gy(0)} x2={gx(xMax)} y2={gy(MU_R * xMax)} stroke="#34d399" strokeWidth="2" strokeDasharray="6 5" />
              {lineLabel(L.roll, gx(xMax) - 4, gy(MU_R * xMax) - 8, '#6ee7b7')}
            </>
          )}
          {points.map((p) => (
            <Marker key={`${p.face}${p.n}`} kind={MARK[p.face]} x={gx(p.N)} y={gy(p.F)} r={6} color={MARK_COLOR[p.face]} />
          ))}
          {current && <circle cx={gx(current.N)} cy={gy(current.F)} r={11} fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 3" />}
          {!points.length && (
            <text x={(pad.l + W - pad.r) / 2} y={(pad.t + H - pad.b) / 2} textAnchor="middle" fontSize="12" fill="#64748b">
              {L.empty}
            </text>
          )}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{L.note}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

/** A closed hand gripping the ring of the spring scale, at (x, y), facing left. */
function Hand({ x, y, s }) {
  return (
    <g>
      <rect x={x} y={y - s * 0.55} width={s * 1.1} height={s * 1.1} rx={s * 0.42} fill="#f5c6a5" stroke="#b7795a" strokeWidth={1.2} />
      <path d={`M${x + s * 0.1},${y - s * 0.18} q${-s * 0.32},${s * 0.02} ${-s * 0.3},${s * 0.3}`} fill="none" stroke="#b7795a" strokeWidth={1.4} strokeLinecap="round" />
      {[0.2, 0.45, 0.7].map((f) => (
        <line key={f} x1={x + s * 0.08} x2={x + s * 0.42} y1={y - s * 0.55 + s * 1.1 * f + s * 0.1} y2={y - s * 0.55 + s * 1.1 * f + s * 0.1} stroke="#b7795a" strokeWidth={1} opacity={0.7} />
      ))}
      <rect x={x + s * 1.02} y={y - s * 0.42} width={s * 1.4} height={s * 0.84} rx={s * 0.2} fill="#60a5fa" stroke="#1d4ed8" strokeWidth={1} />
    </g>
  );
}

function LawScene({ T, face, n, N, pull, d, phase }) {
  const L = T.law;
  const dec = T.decimal;
  const def = FACES[face];
  const raise = def.raise ?? 0;
  const fr = T.sym.fr;
  const kForN = (narrow) => (narrow ? 66 : 136) / ((M0 + 4 * MW) * G);

  return (
    <LabScene
      legend={[
        { color: FORCE.mg, label: L.legend.mg, kind: 'arrow' },
        { color: FORCE.N, label: L.legend.N, kind: 'arrow' },
        { color: FORCE.fr, label: L.legend.fr, kind: 'arrow' },
        { color: FORCE.pull, label: L.legend.pull, kind: 'arrow' },
      ]}
      chips={(W, narrow) => {
        const kF = kForN(narrow);
        const sN = niceStep(kF, narrow ? 20 : 26);
        return (
          <>
            <Chip>{L.chipReal}</Chip>
            <Chip icon={RulerIcon} color={FORCE.mg}>
              <ScaleBar px={sN * kF} label={L.scaleLabel(trim(sN, dec))} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 280 : 430)}
      ariaLabel={L.sceneLabel(trim(N, dec, 2), fmt(pull, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 13;
        const kc = clamp((W - (narrow ? 16 : 56)) / SPAN, 2.3, 8.5); // px per cm
        const X0 = Math.max(narrow ? 8 : 20, (W - SPAN * kc) / 2);
        const px = (c) => X0 + c * kc;
        const tableY = H - (narrow ? 50 : 84);
        const kF = kForN(narrow);
        const box = { w: W, h: H };

        /* block */
        const back = 4 + d;
        const front = back + def.L;
        const bx = px(back);
        const bw = def.L * kc;
        const bh = def.H * kc;
        const by = tableY - (raise + def.H) * kc;
        const cx = bx + bw / 2;

        /* weights and the centre of mass of block + weights */
        const wW = 5 * kc;
        const wH = 3 * kc;
        let mom = M0 * (raise + def.H / 2);
        for (let i = 0; i < n; i += 1) mom += MW * (raise + def.H + 3 * i + 1.5);
        const cmH = mom / (M0 + n * MW);

        /* spring scale: hook on a 5 cm thread, the body stretched away from the hook by the pull */
        const threadY = tableY - (raise + 2) * kc;
        const hook = front + 5;
        const bodyL = hook + 1.5 + CM_PER_N * pull;
        const bodyH = 3.2 * kc;
        const pointer = hook + 19.5;
        const zero = bodyL + 18;
        const ticks = [];
        for (let f = 0; f <= 10; f += 1) {
          const tx = px(zero - CM_PER_N * f);
          const major = f % 2 === 0;
          ticks.push(<line key={`k${f}`} x1={tx} x2={tx} y1={threadY - bodyH / 2 + 2} y2={threadY - bodyH / 2 + (major ? bodyH * 0.38 : bodyH * 0.24)} stroke="#334155" strokeWidth={major ? 1.2 : 0.8} />);
          if ((narrow ? f % 5 === 0 : major) && kc > 2.6) {
            ticks.push(
              <text key={`n${f}`} x={tx} y={threadY + bodyH / 2 - 2.5} textAnchor="middle" fontSize={narrow ? 7.5 : Math.min(11, kc * 1.25)} fontWeight="600" fill="#334155">
                {f}
              </text>,
            );
          }
        }
        const springPts = [];
        const sx0 = px(pointer) + 2;
        const sx1 = px(bodyL + 21.4);
        const coils = 14;
        for (let i = 0; i <= coils; i += 1) springPts.push(`${(sx0 + ((sx1 - sx0) * i) / coils).toFixed(1)},${(threadY + (i % 2 ? -1 : 1) * bodyH * 0.16).toFixed(1)}`);
        const ringX = px(bodyL + 22) + 1.4 * kc;
        const reading = `${fmt(pull, 2, dec)} ${T.N}`;

        /* forces: friction is static while the spring stretches, then μN */
        const fric = phase === 'idle' ? 0 : pull;

        /* contact-area inset */
        const inW = narrow ? 104 : 140;
        const inH = narrow ? 66 : 86;
        const inX = W - inW - (narrow ? 8 : 12);
        const inY = narrow ? 82 : 100;
        const fk = (narrow ? 2.4 : 3.3); // px per cm in the inset
        const fpW = (face === 'end' ? 10 : 20) * fk;
        const fpH = (face === 'flat' || face === 'wheels' ? 10 : 4) * fk;
        const fpX = inX + inW / 2 - fpW / 2;
        const fpY = inY + 22 + (inH - 40 - fpH) / 2;

        const wheelR = 1.5 * kc;
        const rot = ((d / (2 * Math.PI * 1.5)) * 360) % 360;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* lab paper */}
            {Array.from({ length: Math.ceil(W / (narrow ? 24 : 30)) + 1 }, (_, i) => (
              <line key={`gv${i}`} x1={i * (narrow ? 24 : 30)} x2={i * (narrow ? 24 : 30)} y1={0} y2={tableY} stroke={PALETTE.grid} />
            ))}
            {Array.from({ length: Math.ceil(tableY / (narrow ? 24 : 30)) }, (_, i) => (
              <line key={`gh${i}`} x1={0} x2={W} y1={tableY - i * (narrow ? 24 : 30)} y2={tableY - i * (narrow ? 24 : 30)} stroke={PALETTE.grid} />
            ))}
            {/* table */}
            <rect x={0} y={tableY} width={W} height={H - tableY} fill="#f8fafc" />
            <rect x={narrow ? 14 : 30} y={tableY + 12} width={narrow ? 8 : 12} height={H - tableY - 12} fill="#b98a55" />
            <rect x={W - (narrow ? 22 : 42)} y={tableY + 12} width={narrow ? 8 : 12} height={H - tableY - 12} fill="#b98a55" />
            <rect x={0} y={tableY} width={W} height={12} fill="#e2b47c" stroke="#9a6531" strokeWidth={1.2} />
            <line x1={0} x2={W} y1={tableY + 6} y2={tableY + 6} stroke="#c98e4f" strokeOpacity={0.6} />

            {/* thread, block, wheels, weights */}
            <line x1={px(front)} x2={px(hook)} y1={threadY} y2={threadY} stroke="#334155" strokeWidth={1.3} />
            {face === 'wheels' && (
              <>
                <Wheel cx={bx + bw * 0.2} cy={tableY - wheelR} r={wheelR} rot={rot} />
                <Wheel cx={bx + bw * 0.8} cy={tableY - wheelR} r={wheelR} rot={rot} />
              </>
            )}
            <Block x={bx} y={by} w={bw} h={bh} kind="wood" />
            {Array.from({ length: n }, (_, i) => (
              <LabWeight key={i} cx={cx} y={by - i * wH} w={wW} h={wH} />
            ))}

            {/* spring scale */}
            <line x1={px(hook)} x2={px(pointer)} y1={threadY} y2={threadY} stroke="#64748b" strokeWidth={1.6} />
            <path d={`M${px(hook) + 3},${threadY - 3} a3,3 0 1 0 -3,3`} fill="none" stroke="#334155" strokeWidth={1.6} />
            <rect x={px(bodyL)} y={threadY - bodyH / 2} width={22 * kc} height={bodyH} rx={bodyH * 0.35} fill="#f1f5f9" stroke="#475569" strokeWidth={1.3} />
            {ticks}
            <polyline points={springPts.join(' ')} fill="none" stroke="#94a3b8" strokeWidth={1.2} />
            <rect x={px(pointer) - 1.5} y={threadY - bodyH / 2 + 1} width={3} height={bodyH - 2} fill={FORCE.fr} />
            <circle cx={ringX} cy={threadY} r={1.4 * kc} fill="none" stroke="#475569" strokeWidth={1.6} />
            <Hand x={ringX + 1.4 * kc - 2} y={threadY} s={Math.max(12, 3 * kc)} />
            <Pill x={px(bodyL + 11)} y={threadY - bodyH / 2 - (narrow ? 12 : 15)} text={reading} bg={FORCE.fr} size={narrow ? 11 : 12.5} box={box} />

            {/* forces */}
            <VecArrow x={cx - 7} y={tableY - cmH * kc} dx={0} dy={N * kF} color={FORCE.mg} main="mg" fs={fs} place="left" />
            <VecArrow x={cx + 7} y={tableY} dx={0} dy={-N * kF} color={FORCE.N} main="N" fs={fs} place="right" />
            {fric > 0 && <VecArrow x={bx} y={tableY - 3} dx={-fric * kF} dy={0} color={FORCE.fr} main="F" sub={fr} fs={fs} place="left" />}
            {pull > 0 && (
              <VecArrow x={px(front)} y={threadY - (narrow ? 6 : 8)} dx={pull * kF} dy={0} color={FORCE.pull} main={pull * kF > 30 ? 'F' : ''} sub={T.sym.pull} fs={fs - 1} place="above" width={2.6} />
            )}

            {/* contact area seen from above */}
            <g>
              <rect x={inX} y={inY} width={inW} height={inH} rx={10} fill="#ffffff" stroke="#e2e8f0" />
              <text x={inX + inW / 2} y={inY + 15} textAnchor="middle" fontSize={narrow ? 9.5 : 11} fontWeight="600" fill="#475569">
                {L.area}
              </text>
              {face === 'wheels' ? (
                <>
                  <rect x={fpX} y={fpY} width={fpW} height={fpH} rx={2} fill="none" stroke="#cbd5e1" strokeDasharray="3 3" />
                  {[
                    [0.2, 0.1],
                    [0.8, 0.1],
                    [0.2, 0.9],
                    [0.8, 0.9],
                  ].map(([u, v]) => (
                    <rect key={`${u}${v}`} x={fpX + fpW * u - 2.5} y={fpY + fpH * v - 1.5} width={5} height={3} fill="#d97706" />
                  ))}
                </>
              ) : (
                <rect x={fpX} y={fpY} width={fpW} height={fpH} rx={1.5} fill="#f59e0b" fillOpacity={0.35} stroke="#d97706" strokeWidth={1.4} />
              )}
              <text x={inX + inW / 2} y={inY + inH - 9} textAnchor="middle" fontSize={narrow ? 10 : 12} fontWeight="700" fill="#b45309" className="tabular-nums">
                {def.S ? L.areaTag(fmt(def.S, 0, dec)) : L.areaWheels}
              </text>
            </g>
          </>
        );
      }}
    </LabScene>
  );
}
