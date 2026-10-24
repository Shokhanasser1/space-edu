import { useState } from 'react';
import { Lightbulb, MoveDownLeft, Ruler, Weight } from 'lucide-react';

import { Arrow, Explain, RangeField, Readout, Segmented, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FArrow, FC, G, GroupLabel, LabScene, PAIRS, PaperGrid, PlayControls, Rich, ScaleBar, TagPill, XYGraph, forceUnit, niceMax, num, trim } from './StaticFriction.parts';

/**
 * Tab 2 — a block on a board that is raised slowly. While tg α ≤ μ₀ static
 * friction equals the down-slope pull mg sinα and the block stays put; at the
 * critical angle α₀ = arctg μ₀ it breaks away and slides down with
 * a = g(sinα − μcosα). Wood on wood: μ₀ = 0.5 → α₀ = 26.6°.
 */

const A_MAX = 45; // °
const RATE_FAR = 4; // °/s while far from the limit
const RATE_NEAR = 1.2; // °/s close to it, like a careful experimenter
const BOARD = 1; // m
const S0 = 0.76; // m, block centre from the hinge at the start
const S_MIN = 0.11; // m, block resting on the stopper
const IDLE = { alpha: 0, s: S0, v: 0, sliding: false, running: false, raise: false, done: false, measured: null };
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function stepIncline(p, dt, c) {
  let s = { ...p };
  const crit = deg(Math.atan(c.mu0));
  if (s.raise && !s.sliding && !s.done) {
    const rate = Math.tan(rad(s.alpha)) < 0.8 * c.mu0 ? RATE_FAR : RATE_NEAR;
    const next = Math.min(A_MAX, s.alpha + rate * dt);
    // stop exactly at the critical angle the moment it is crossed
    s.alpha = s.alpha < crit && next >= crit ? crit + 1e-6 : next;
    if (s.alpha >= A_MAX) s.raise = false;
  }
  if (!s.sliding && !s.done && Math.tan(rad(s.alpha)) > c.mu0 + 1e-12) {
    s = { ...s, sliding: true, raise: false, measured: s.measured ?? s.alpha };
  }
  if (s.sliding) {
    const a = G * (Math.sin(rad(s.alpha)) - c.mu * Math.cos(rad(s.alpha)));
    s.v += a * dt;
    s.s -= s.v * dt;
    if (s.s <= S_MIN) s = { ...s, s: S_MIN, v: 0, sliding: false, done: true, running: false };
  }
  if (!s.raise && !s.sliding) s.running = false;
  return s;
}

export default function InclineSim({ T }) {
  const L = T.incline;
  const dec = T.decimal;
  const [pair, setPair] = useState('wood');
  const [m, setM] = useState(2);
  const [sim, setSim] = useState(IDLE);
  const c = { ...PAIRS[pair], m, w: m * G };
  const crit = deg(Math.atan(c.mu0));

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? stepIncline(p, dt, c) : p));
  });

  const pick = (id) => {
    setPair(id);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true, raise: true });
    else if (sim.running) setSim((p) => ({ ...p, running: false }));
    else setSim((p) => ({ ...p, running: true, raise: !p.sliding && p.alpha < A_MAX ? true : p.raise }));
  };
  const reset = () => setSim(IDLE);
  const setAngle = (alpha) => {
    setSim((p0) => {
      const p = p0.done ? { ...IDLE, measured: p0.measured } : p0;
      if (p.sliding) return p; // the block is already on its way down
      const s = { ...p, alpha, raise: false };
      if (Math.tan(rad(alpha)) > c.mu0 + 1e-12) return { ...s, sliding: true, running: true, measured: s.measured ?? alpha };
      return { ...s, running: false };
    });
  };

  const al = rad(sim.alpha);
  const down = c.w * Math.sin(al);
  const nForce = c.w * Math.cos(al);
  const fmax = c.mu0 * nForce;
  const f = sim.sliding || sim.done ? c.mu * nForce : Math.min(down, fmax);
  const tg = Math.tan(al);
  const aNow = sim.sliding ? G * (Math.sin(al) - c.mu * Math.cos(al)) : 0;
  const A1 = (n) => num(n, 1, dec);
  const N2 = (n) => num(n, n < 10 ? 2 : 1, dec);
  const atCrit = !sim.sliding && Math.abs(sim.alpha - crit) < 1e-3;
  const cmp = tg > c.mu0 + 1e-9 ? '>' : atCrit ? '=' : '<';

  let key = 'flat';
  if (sim.done) key = 'done';
  else if (sim.sliding) key = 'slide';
  else if (sim.alpha < 0.25) key = 'flat';
  else if (tg >= 0.85 * c.mu0) key = 'near';
  else key = 'hold';
  const settled = useSettled(key, key === 'flat' || key === 'done' || key === 'slide' ? 0 : 250);
  const ex = L.explain;
  const measured = sim.measured ?? null;
  const text = {
    flat: ex.flat,
    hold: ex.hold(A1(sim.alpha), N2(down), num(tg, 2, dec), trim(c.mu0, dec)),
    near: ex.near(num(tg, 3, dec), trim(c.mu0, dec)),
    slide: ex.slide(N2(c.mu * nForce), num(aNow, 2, dec)),
    done: ex.done(A1(crit), num(c.mu0, 2, dec)),
  }[settled];
  const tone = { flat: '#22d3ee', hold: '#2dd4bf', near: '#fbbf24', slide: '#f87171', done: '#34d399' }[settled];
  const started = sim.alpha > 0 || sim.running || sim.done;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.pairsLabel}</GroupLabel>
          <Segmented
            label={L.pairsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={pair}
            onChange={pick}
            options={Object.keys(PAIRS).map((id) => ({ value: id, label: T.pull.pairs[id], sub: T.pull.pairSub(trim(PAIRS[id].mu0, dec), trim(PAIRS[id].mu, dec)), icon: PAIRS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} startLabel={L.start} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <InclineScene T={T} c={c} sim={sim} f={f} crit={crit} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.angle}
          symbol="α"
          value={`${A1(sim.alpha)}°`}
          accent="#22d3ee"
          textColor="#a5f3fc"
          sub={<Rich>{L.readouts.tan(num(tg, 2, dec), trim(c.mu0, dec), cmp)}</Rich>}
        />
        <Readout label={L.readouts.down} symbol="mg sinα" value={N2(down)} unit={T.N} accent={FC.weight} textColor={FC.weightText} sub={L.readouts.downSub} />
        <Readout
          label={L.readouts.fric}
          symbol={<Rich>{L.tagFric('').split(' =')[0]}</Rich>}
          value={N2(f)}
          unit={T.N}
          accent={FC.fric}
          textColor={FC.fricText}
          active={sim.sliding}
          sub={<Rich>{sim.sliding || sim.done ? L.readouts.fricSlide : L.readouts.fricRest(N2(fmax))}</Rich>}
        />
        <Readout
          label={L.readouts.crit}
          symbol={<Rich>α₀</Rich>}
          value={measured !== null ? `${A1(crit)}°` : '—'}
          accent="#fbbf24"
          textColor="#fde68a"
          active={measured !== null}
          sub={<Rich>{measured !== null ? L.readouts.critSub(num(c.mu0, 2, dec)) : L.readouts.critUnknown}</Rich>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="sf-angle"
            label={L.angle}
            symbol="α"
            min={0}
            max={A_MAX}
            step={0.5}
            value={Math.round(sim.alpha * 2) / 2}
            onChange={setAngle}
            accent="#22d3ee"
            display={`${A1(sim.alpha)}°`}
            hint={L.angleHint}
            disabled={sim.sliding}
          />
          <RangeField
            id="sf-imass"
            label={L.mass}
            symbol="m"
            min={0.5}
            max={5}
            step={0.5}
            value={m}
            onChange={(n) => {
              setM(n);
              setSim((p) => ({ ...IDLE, alpha: p.sliding || p.done ? 0 : p.alpha, measured: p.measured }));
            }}
            accent={FC.weightLine}
            display={`${num(m, 1, dec)} ${T.kg}`}
            hint={L.massHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{T.pull.info.title}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
              {[
                [T.pull.info.mu0, trim(c.mu0, dec), '#fde68a'],
                [T.pull.info.mu, trim(c.mu, dec), FC.fricText],
                ['mg', `${N2(c.w)} ${T.N}`, FC.weightText],
              ].map(([k, v, col]) => (
                <div key={k}>
                  <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: col }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <InclineGraph T={T} c={c} sim={sim} f={f} crit={crit} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- graph */

function InclineGraph({ T, c, sim, f, crit }) {
  const L = T.incline.graph;
  const dec = T.decimal;
  const yMax = niceMax(Math.max(Math.sin(rad(A_MAX)), c.mu0) * c.w * 1.05);
  const n = 90;
  const downPts = [];
  const maxPts = [];
  const fricPts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * A_MAX;
    const r = rad(a);
    downPts.push({ x: a, y: c.w * Math.sin(r) });
    maxPts.push({ x: a, y: c.mu0 * c.w * Math.cos(r) });
    if (a <= crit) fricPts.push({ x: a, y: c.w * Math.sin(r) });
  }
  const rc = rad(crit);
  fricPts.push({ x: crit, y: c.w * Math.sin(rc) }, { x: crit, y: c.mu * c.w * Math.cos(rc) });
  for (let i = 0; i <= n; i += 1) {
    const a = crit + (i / n) * (A_MAX - crit);
    fricPts.push({ x: a, y: c.mu * c.w * Math.cos(rad(a)) });
  }
  const al = rad(sim.alpha);
  return (
    <XYGraph
      title={L.title}
      legend={[
        { label: L.down, color: FC.weightLine, dash: '5 4' },
        { label: L.max, color: '#fbbf24', dash: '5 4' },
        { label: L.fric, color: FC.fricLine },
      ]}
      series={[
        { id: 'down', points: downPts, color: FC.weightLine, dash: '5 5', width: 2 },
        { id: 'max', points: maxPts, color: '#fbbf24', dash: '5 5', width: 2 },
        { id: 'fric', points: fricPts, color: FC.fricLine, width: 3, opacity: 0.95 },
      ]}
      notes={sim.measured !== null ? [{ x: crit, y: c.w * Math.sin(rc), text: T.incline.critRay(num(crit, 1, dec)), color: '#fde68a', dy: -12 }] : []}
      dots={[
        { x: sim.alpha, y: c.w * Math.sin(al), color: FC.weightLine, r: 4 },
        { x: sim.alpha, y: f, color: '#fca5a5' },
      ]}
      marker={sim.alpha}
      xMax={A_MAX}
      xParts={3}
      xSuffix="°"
      yMax={yMax}
      xLabel={L.x}
      yLabel={L.y}
      decimal={dec}
      ariaLabel={L.label}
      note={L.note}
      height={230}
    />
  );
}

/* ---------------------------------------------------------------- scene */

function inclineGeom(W, H, narrow, c) {
  const hy = H - (narrow ? 34 : 40);
  const meterW = narrow ? 0 : 150;
  const maxLb = (hy - (narrow ? 64 : 80)) / Math.sin(rad(A_MAX));
  const Lb = Math.min(W - meterW - (narrow ? 44 : 150), maxLb);
  const hx = narrow ? 26 : Math.max(70, (W - meterW - Lb) * 0.42);
  const A = narrow ? 84 : 130; // px of mg
  const k = A / c.w;
  return { hy, hx, Lb, k, unit: forceUnit(k, narrow ? 24 : 34), meterX: W - (narrow ? 0 : 96) };
}

function InclineScene({ T, c, sim, f, crit }) {
  const L = T.incline;
  const dec = T.decimal;
  const N2 = (n) => num(n, n < 10 ? 2 : 1, dec);
  const state = sim.done ? L.stateEnd : sim.sliding ? L.stateSlide : L.stateRest;

  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.weight, kind: 'arrow' },
        { color: FC.normal, label: L.legend.normal, kind: 'arrow' },
        { color: FC.fric, label: L.legend.fric, kind: 'arrow' },
        { color: FC.weightLine, label: L.legend.comp, kind: 'darrow' },
      ]}
      chips={(W, H, narrow) => {
        const g = inclineGeom(W, H, narrow, c);
        return (
          <>
            <Chip icon={sim.sliding ? MoveDownLeft : Weight} strong color={sim.done ? '#059669' : sim.sliding ? '#dc2626' : '#0f766e'}>
              {state}
            </Chip>
            <Chip icon={Ruler} color="#475569">
              <ScaleBar px={g.unit * g.k} text={L.chipScale(trim(g.unit, dec))} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 330 : 460)}
      ariaLabel={L.sceneLabel(num(sim.alpha, 1, dec), state)}
    >
      {(W, H, narrow) => {
        const { hy, hx, Lb, k, meterX } = inclineGeom(W, H, narrow, c);
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const al = rad(sim.alpha);
        const ca = Math.cos(al);
        const sa = Math.sin(al);
        const u = { x: ca, y: -sa }; // up the slope (screen)
        const nrm = { x: -sa, y: -ca }; // out of the board
        const thick = narrow ? 10 : 14;
        const P = (sm, off = 0) => ({ x: hx + nrm.x * (thick + off) + u.x * (sm / BOARD) * Lb, y: hy + nrm.y * (thick + off) + u.y * (sm / BOARD) * Lb });
        const bw = narrow ? 50 : 84;
        const bh = narrow ? 32 : 50;
        const contact = P(sim.s);
        const center = P(sim.s, bh / 2);
        const endB = { x: hx + u.x * Lb, y: hy + u.y * Lb };
        const boardPts = [
          { x: hx, y: hy },
          endB,
          { x: endB.x + nrm.x * thick, y: endB.y + nrm.y * thick },
          { x: hx + nrm.x * thick, y: hy + nrm.y * thick },
        ];
        const kind = c.floor;
        const boardFill = { wood: '#d9a868', asphalt: '#4b5563', ice: '#bfe6f6' }[kind];
        const boardEdge = { wood: '#8a5a2b', asphalt: '#1f2937', ice: '#6bb7d6' }[kind];
        const nForce = c.w * ca;
        const down = c.w * sa;
        const showComp = !sim.sliding && !sim.done && sim.alpha > 1;
        const wTip = { x: center.x, y: center.y + c.w * k };
        const parTip = { x: center.x - u.x * down * k, y: center.y - u.y * down * k };
        const perpTip = { x: center.x - nrm.x * nForce * k, y: center.y - nrm.y * nForce * k };
        const nBase = { x: contact.x + u.x * (narrow ? 7 : 10), y: contact.y + u.y * (narrow ? 7 : 10) };
        const nTip = { x: nBase.x + nrm.x * nForce * k, y: nBase.y + nrm.y * nForce * k };
        const fBase = { x: contact.x - u.x * (narrow ? 6 : 8), y: contact.y - u.y * (narrow ? 6 : 8) };
        const fTip = { x: fBase.x + u.x * f * k, y: fBase.y + u.y * f * k };
        const arcR = narrow ? 38 : 56;
        const arcEnd = { x: hx + arcR * ca, y: hy - arcR * sa };
        const crR = Lb + (narrow ? 18 : 34);
        const cr = rad(crit);
        const vLen = sim.sliding ? Math.max(8, sim.v * (narrow ? 26 : 40)) : 0;
        const vBase = P(sim.s, bh + (narrow ? 10 : 14));
        const meterTop = narrow ? 0 : 136;
        const meterBot = hy - 6;
        const mh = meterBot - meterTop;
        const tg = Math.tan(al);
        const over = tg > c.mu0 + 1e-9;
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid W={W} top={0} bottom={hy} step={narrow ? 22 : 28} />
            {/* floor */}
            <rect x={0} y={hy} width={W} height={H - hy} fill="#e2e8f0" />
            <line x1={0} x2={W} y1={hy} y2={hy} stroke="#475569" strokeWidth="2" />
            {Array.from({ length: Math.ceil(W / 14) }, (_, i) => (
              <line key={i} x1={i * 14} y1={hy + 2} x2={i * 14 - 10} y2={hy + 12} stroke="#94a3b8" strokeWidth="1" />
            ))}

            {/* critical angle ray, once found */}
            {sim.measured !== null && (
              <g>
                <line x1={hx} y1={hy} x2={hx + crR * Math.cos(cr)} y2={hy - crR * Math.sin(cr)} stroke="#d97706" strokeWidth="1.5" strokeDasharray="6 5" />
                <TagPill x={hx + crR * Math.cos(cr) + 6} y={hy - crR * Math.sin(cr)} text={L.critRay(num(crit, 1, dec))} bg="#fffbeb" color="#b45309" border="#f59e0b" size={fs - 1} anchor="start" box={box} />
              </g>
            )}

            {/* stand under the raised end */}
            {sim.alpha > 0.3 && (
              <g>
                <rect x={endB.x - (narrow ? 12 : 16)} y={hy - 4} width={narrow ? 24 : 32} height={4} rx={1} fill="#475569" />
                <line x1={endB.x} x2={endB.x} y1={hy - 4} y2={endB.y + 2} stroke="#64748b" strokeWidth={narrow ? 3 : 4} />
                <circle cx={endB.x} cy={endB.y + 2} r={narrow ? 3 : 4} fill="#334155" />
              </g>
            )}

            {/* the board, its hinge and stopper */}
            <polygon points={boardPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill={boardFill} stroke={boardEdge} strokeWidth="1.5" strokeLinejoin="round" />
            {kind === 'ice' && <line x1={boardPts[3].x} y1={boardPts[3].y} x2={boardPts[2].x} y2={boardPts[2].y} stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />}
            {kind === 'wood' &&
              [0.18, 0.43, 0.7].map((q) => {
                const a = { x: hx + u.x * Lb * q + nrm.x * thick * 0.5, y: hy + u.y * Lb * q + nrm.y * thick * 0.5 };
                return <line key={q} x1={a.x} y1={a.y} x2={a.x + u.x * Lb * 0.16} y2={a.y + u.y * Lb * 0.16} stroke="#a8723a" strokeWidth="1.1" />;
              })}
            <circle cx={hx} cy={hy} r={narrow ? 4 : 5} fill="#334155" stroke="#fff" strokeWidth="1.5" />
            {(() => {
              const s0 = P(0);
              const s1 = P(0, narrow ? 10 : 14);
              return <line x1={s0.x} y1={s0.y} x2={s1.x} y2={s1.y} stroke="#334155" strokeWidth={narrow ? 4 : 5} strokeLinecap="round" />;
            })()}

            {/* angle arc */}
            {sim.alpha > 0.3 && (
              <g>
                <path d={`M${hx + arcR},${hy} A${arcR},${arcR} 0 0 0 ${arcEnd.x.toFixed(1)},${arcEnd.y.toFixed(1)}`} fill="none" stroke="#0891b2" strokeWidth="2" />
                <text x={hx + (arcR + 8) * Math.cos(al / 2) + 4} y={hy - (arcR + 8) * Math.sin(al / 2) + 4} fontSize={fs + 1} fontWeight="700" fill="#0e7490">
                  α = {num(sim.alpha, 1, dec)}°
                </text>
              </g>
            )}

            {/* the block */}
            <g transform={`translate(${contact.x.toFixed(1)} ${contact.y.toFixed(1)}) rotate(${(-sim.alpha).toFixed(2)})`}>
              <rect x={-bw / 2} y={-bh} width={bw} height={bh} rx={3} fill="#2563eb" fillOpacity="0.16" stroke="#1d4ed8" strokeWidth="2" />
              <rect x={-bw / 2 + 4} y={-bh + 4} width={bw - 8} height={bh - 8} rx={2} fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" />
            </g>

            {/* components of mg (dashed) with the parallelogram */}
            {showComp && (
              <g>
                <line x1={parTip.x} y1={parTip.y} x2={wTip.x} y2={wTip.y} stroke={FC.weight} strokeOpacity="0.35" strokeDasharray="3 3" />
                <line x1={perpTip.x} y1={perpTip.y} x2={wTip.x} y2={wTip.y} stroke={FC.weight} strokeOpacity="0.35" strokeDasharray="3 3" />
                <Arrow x1={center.x} y1={center.y} x2={parTip.x} y2={parTip.y} color={FC.weightLine} width={2.2} head={9} dash="5 3" />
                <Arrow x1={center.x} y1={center.y} x2={perpTip.x} y2={perpTip.y} color={FC.weightLine} width={2.2} head={9} dash="5 3" />
                {!narrow && down * k > 26 && (
                  <text x={parTip.x - 6} y={parTip.y - 6} textAnchor="end" fontSize={fs} fontStyle="italic" fontWeight="600" fill="#6d28d9" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                    {L.compPar}
                  </text>
                )}
                {!narrow && (
                  <text x={perpTip.x + 8} y={perpTip.y + 4} fontSize={fs} fontStyle="italic" fontWeight="600" fill="#6d28d9" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                    {L.compPerp}
                  </text>
                )}
              </g>
            )}

            {/* forces */}
            <FArrow x1={center.x} y1={center.y} x2={wTip.x} y2={wTip.y} color={FC.weight} width={narrow ? 3 : 3.5} head={narrow ? 10 : 13} />
            <FArrow x1={nBase.x} y1={nBase.y} x2={nTip.x} y2={nTip.y} color={FC.normal} width={narrow ? 3 : 3.5} head={narrow ? 10 : 13} />
            {f > 1e-9 && <FArrow x1={fBase.x} y1={fBase.y} x2={fTip.x} y2={fTip.y} color={FC.fric} width={narrow ? 3.5 : 4} head={narrow ? 11 : 13} />}
            {sim.sliding && <Arrow x1={vBase.x} y1={vBase.y} x2={vBase.x - u.x * vLen} y2={vBase.y - u.y * vLen} color={PALETTE.vel} width={3} head={10} />}

            <TagPill x={wTip.x - 8} y={wTip.y - 8} text={L.tagW(N2(c.w))} bg={FC.weight} size={fs} anchor="end" box={box} />
            <TagPill x={nTip.x - 6} y={nTip.y - 10} text={L.tagN(N2(nForce))} bg={FC.normal} size={fs} anchor="end" box={box} />
            {f > 1e-9 && <TagPill x={fTip.x + 8} y={fTip.y - 12} text={L.tagFric(N2(f))} bg={FC.fric} size={fs} anchor="start" box={box} />}
            {sim.sliding && <TagPill x={vBase.x - u.x * vLen - 6} y={vBase.y - u.y * vLen - 12} text={L.tagV(num(sim.v, 2, dec))} bg={PALETTE.vel} size={fs - 1} anchor="end" box={box} />}

            {/* tg α against μ₀ */}
            {!narrow && (
              <g>
                <text x={meterX + 11} y={meterTop - 12} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
                  {L.meterTitle}
                </text>
                <rect x={meterX} y={meterTop} width={22} height={mh} rx={11} fill="#f1f5f9" stroke="#cbd5e1" />
                <rect x={meterX + 3} y={meterBot - 3 - Math.min(1, tg) * (mh - 6)} width={16} height={Math.min(1, tg) * (mh - 6)} rx={8} fill={over ? '#ef4444' : '#14b8a6'} />
                {[0, 0.25, 0.5, 0.75, 1].map((q) => (
                  <g key={q}>
                    <line x1={meterX - 5} x2={meterX} y1={meterBot - 3 - q * (mh - 6)} y2={meterBot - 3 - q * (mh - 6)} stroke="#94a3b8" />
                    <text x={meterX - 8} y={meterBot - 3 - q * (mh - 6) + 4} textAnchor="end" fontSize={fs - 2} fill="#64748b">
                      {trim(q, dec)}
                    </text>
                  </g>
                ))}
                <line x1={meterX - 4} x2={meterX + 30} y1={meterBot - 3 - c.mu0 * (mh - 6)} y2={meterBot - 3 - c.mu0 * (mh - 6)} stroke="#d97706" strokeWidth="2" strokeDasharray="4 3" />
                <TagPill x={meterX + 32} y={meterBot - 3 - c.mu0 * (mh - 6)} text={L.meterMu(trim(c.mu0, dec))} bg="#fffbeb" color="#b45309" border="#f59e0b" size={fs - 1} anchor="start" box={box} />
                {(() => {
                  const yv = meterBot - 3 - Math.min(1, tg) * (mh - 6);
                  const ym = meterBot - 3 - c.mu0 * (mh - 6);
                  const y = Math.abs(yv - ym) < 24 ? (over ? ym - 24 : ym + 24) : yv;
                  return <TagPill x={meterX + 32} y={y} text={num(tg, 2, dec)} bg={over ? '#ef4444' : '#14b8a6'} size={fs - 1} anchor="start" box={box} />;
                })()}
              </g>
            )}
          </>
        );
      }}
    </LabScene>
  );
}
