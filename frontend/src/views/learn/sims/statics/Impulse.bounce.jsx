import { useState } from 'react';
import { Lightbulb, Ruler as RulerIcon } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, fmt, textWidth, useElementSize, useRafLoop } from '../kit/ui';
import {
  COL,
  Chip,
  ConcreteWall,
  FormulaTile,
  LabScene,
  Panel,
  PaperGrid,
  PlayControls,
  PulseGraph,
  Ruler,
  ScaleBar,
  VecArrow,
  lineView,
  niceMax,
  niceUnit,
  pickNice,
  trim,
} from './Impulse.parts';

/**
 * Tab 4 — bounce or stick. Two balls of the same mass (0.5 kg) move along a
 * smooth floor at the same speed into a wall: a plasticine ball sticks
 * (v₂ = 0, Δp = −mv), a rubber ball bounces back (v₂ = −e·v, Δp = −(1+e)mv).
 * The wall touches both for the same time Δt, so the bouncing ball needs a
 * (1 + e) times bigger force. +x points towards the wall. Contact is taken
 * as a constant force. Preset: v = 6 m/s, full bounce, Δt = 0.01 s →
 * Δp = −3 and −6 kg·m/s, F = −300 N and −600 N. Strings come from T.bounce.
 */

export const M_BALL = 0.5; // kg
const APPROACH = 1.5; // m
const WALL = 0.15; // m thick
const LANE_COL = { clay: '#d97706', clayText: '#fcd34d', rubber: '#0284c7', rubberText: '#7dd3fc' };
const IDLE = { t: 0, running: false, done: false };

/** Front of a ball (m, 0 = wall face, > 0 = squashed) at time t. */
function ballFront(t, v, e, dt, tHit) {
  const tc = t - tHit;
  if (tc <= 0) return -APPROACH + v * t;
  const a = ((1 + e) * v) / dt;
  if (tc < dt) return v * tc - (a * tc * tc) / 2;
  return (v * dt * (1 - e)) / 2 - e * v * (tc - dt);
}

/** Velocity of a ball at time t (+ towards the wall). */
function ballVel(t, v, e, dt, tHit) {
  const tc = t - tHit;
  if (tc <= 0) return v;
  if (tc < dt) return v - (((1 + e) * v) / dt) * tc;
  return -e * v;
}

export default function BounceSim({ T }) {
  const L = T.bounce;
  const dec = T.decimal;
  const [v, setV] = useState(6);
  const [e, setE] = useState(1);
  const [dt, setDt] = useState(0.01);
  const [sim, setSim] = useState(IDLE);

  const tHit = APPROACH / v;
  const tEnd = tHit + dt + APPROACH / v;
  const kA = pickNice((2.2 * v) / APPROACH, [1, 2, 4, 5, 10, 20]);
  const kC = pickNice(1.2 / dt, [20, 50, 100, 200, 500]);
  const w0 = tHit - 0.3 * dt;
  const w1 = tHit + 1.3 * dt;

  useRafLoop(sim.running, (dts) => {
    setSim((p) => {
      if (!p.running) return p;
      let rem = dts;
      let t = p.t;
      while (rem > 1e-9 && t < tEnd) {
        const inW = t >= w0 && t < w1;
        const rate = inW ? 1 / kC : 1 / kA;
        const bound = t < w0 ? w0 : inW ? w1 : tEnd;
        const need = (bound - t) / rate;
        if (need <= rem) {
          t = bound;
          rem -= need;
        } else {
          t += rem * rate;
          rem = 0;
        }
      }
      t = Math.min(t, tEnd);
      const done = t >= tEnd - 1e-12;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const tc = t - tHit;
  const p1 = M_BALL * v;
  const dpA = -p1;
  const dpB = -(1 + e) * p1;
  const FA = dpA / dt;
  const FB = dpB / dt;
  const ratio = 1 + e;
  const Tr = (n, k = 2) => trim(n, dec, k);
  const inSlow = t >= w0 && t < w1;

  /* explanation */
  let key = 'idle';
  if (sim.done) key = e > 0.001 ? 'done' : 'doneSame';
  else if (t > 0) key = tc < 0 ? 'approach' : tc < dt ? 'contact' : e > 0.001 ? 'after' : 'doneSame';
  // the phases follow one another in time and never flip back, so no debounce is needed
  const settled = key;
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    approach: ex.approach(Tr(p1)),
    contact: ex.contact(Tr(dt, 3)),
    after: ex.after(Tr(e * v, 2)),
    done: ex.done(Tr(-dpA), Tr(-dpB), trim(ratio, dec, 2), Tr(-FA, 0), Tr(-FB, 0)),
    doneSame: ex.doneSame,
  }[settled];
  const tone = { idle: '#22d3ee', approach: '#a5b4fc', contact: '#f87171', after: '#7dd3fc', done: '#34d399', doneSame: '#fbbf24' }[settled];

  /* F–t graph (magnitudes, ms) */
  const ms = dt * 1000;
  const xMax = niceMax(1.5 * ms);
  const yMax = niceMax(-FB * 1.15);
  const live = tc > 0 ? Math.min(tc * 1000, ms) : ms;
  const rect = (F, until) => [
    { x: 0, y: 0 },
    { x: 0, y: F },
    { x: until, y: F },
    { x: until, y: 0 },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <p className="max-w-3xl text-sm leading-relaxed text-gray-300">{L.intro}</p>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} startLabel={L.launch} />
      </div>

      <BounceScene T={T} v={v} e={e} dt={dt} t={t} tHit={tHit} FA={FA} FB={FB} kA={kA} kC={kC} inSlow={inSlow} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.dpA} symbol={<span className="whitespace-nowrap">|Δp|</span>} value={Tr(-dpA)} unit={T.pu} accent={LANE_COL.clay} textColor={LANE_COL.clayText} sub={L.pSub(Tr(p1), '0')} />
        <Readout label={L.readouts.dpB} symbol={<span className="whitespace-nowrap">|Δp|</span>} value={Tr(-dpB)} unit={T.pu} accent={LANE_COL.rubber} textColor={LANE_COL.rubberText} sub={L.pSub(Tr(p1), Tr(-e * p1))} />
        <Readout label={L.readouts.FA} symbol={<span className="whitespace-nowrap">|F|</span>} value={Tr(-FA, 0)} unit={T.N} accent={COL.F} textColor={LANE_COL.clayText} sub={L.FSub} active={tc >= dt} />
        <Readout label={L.readouts.FB} symbol={<span className="whitespace-nowrap">|F|</span>} value={Tr(-FB, 0)} unit={T.N} accent={COL.F} textColor={LANE_COL.rubberText} sub={L.ratioSub(trim(ratio, dec, 2))} active={tc >= dt} />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          <p className="text-xs text-gray-400">{L.axisNote}</p>
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.clay}
            color={LANE_COL.clayText}
            general="Δp = m·v₂ − m·v₁"
            filled={`= ${Tr(M_BALL)} · 0 − ${Tr(M_BALL)} · ${Tr(v, 1)}`}
            result={`Δp = ${Tr(dpA)} ${T.pu}`}
          />
          <FormulaTile
            tag={L.rubber}
            color={LANE_COL.rubberText}
            general="Δp = m·v₂ − m·v₁"
            filled={`= ${Tr(M_BALL)} · (${Tr(-e * v)}) − ${Tr(M_BALL)} · ${Tr(v, 1)}`}
            result={`Δp = ${Tr(dpB)} ${T.pu}`}
          />
          <FormulaTile
            tag={L.fTag}
            color={COL.FText}
            general="F = Δp / Δt"
            filled={`${Tr(dpA)} / ${Tr(dt, 3)}   ·   ${Tr(dpB)} / ${Tr(dt, 3)}`}
            result={`${Tr(FA, 0)} ${T.N}   ·   ${Tr(FB, 0)} ${T.N}`}
            ok={sim.done}
          />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="imp-b-v" label={L.v} symbol="v₁" min={2} max={10} step={0.5} value={v} onChange={change(setV)} accent={COL.v} display={`${Tr(v, 1)} ${T.ms}`} hint={L.vHint(Tr(M_BALL))} />
          <RangeField
            id="imp-b-e"
            label={L.e}
            symbol="v₂"
            min={0}
            max={1}
            step={0.05}
            value={e}
            onChange={change(setE)}
            accent={LANE_COL.rubber}
            display={L.eDisplay(Tr(e * v), trim(e * 100, dec, 0))}
            hint={L.eHint}
          />
          <RangeField
            id="imp-b-dt"
            label={L.dt}
            symbol="Δt"
            min={0.005}
            max={0.05}
            step={0.005}
            value={dt}
            onChange={change(setDt)}
            accent="#22d3ee"
            display={`${Tr(dt, 3)} ${T.s}`}
            hint={L.dtHint}
          />
          <VectorDiagram T={T} p1={p1} e={e} />
        </Panel>
        <Panel className="lg:col-span-3">
          <PulseGraph
            title={L.graph.title}
            legend={[
              { color: LANE_COL.clay, label: L.clay, kind: 'area' },
              { color: LANE_COL.rubber, label: L.rubber, kind: 'area' },
            ]}
            series={[
              { id: 'B', color: LANE_COL.rubberText, points: [...rect(-FB, ms), { x: xMax, y: 0 }], width: 2, opacity: 0.6 },
              { id: 'A', color: LANE_COL.clayText, points: [...rect(-FA, ms), { x: xMax, y: 0 }], width: 2, opacity: 0.6 },
              { id: 'Bf', color: LANE_COL.rubberText, points: rect(-FB, live), fill: LANE_COL.rubber, fillOpacity: 0.35, width: 0 },
              { id: 'Af', color: LANE_COL.clayText, points: rect(-FA, live), fill: LANE_COL.clay, fillOpacity: 0.55, width: 0 },
            ]}
            xMax={xMax}
            yMax={yMax}
            xLabel={L.graph.t}
            yLabel={L.graph.y}
            marker={tc > 0 ? tc * 1000 : undefined}
            labels={[
              { x: ms / 2, y: -FA / 2, text: L.graph.area(Tr(-dpA)), color: '#fef3c7' },
              ...(e > 0.05 ? [{ x: ms / 2, y: (-FA - FB) / 2 + (-FB + FA) * 0.1, text: L.graph.area(Tr(-dpB)), color: '#e0f2fe' }] : []),
            ]}
            decimal={dec}
            height={300}
            note={L.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- vector panel */

/** p₁ + Δp = p₂ drawn head to tail for both balls. */
function VectorDiagram({ T, p1, e }) {
  const L = T.bounce;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const rows = [
    { id: 'clay', name: L.clay, p2: 0, color: LANE_COL.clayText },
    { id: 'rubber', name: L.rubber, p2: -e * p1, color: LANE_COL.rubberText },
  ];
  const x0 = W * 0.52;
  const k = (W * 0.36) / p1;
  const rowH = 76;
  const H = rows.length * rowH + 4;
  const tag = (s, val) => `${s} = ${trim(val, dec, 2)}`;
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-xs font-semibold text-gray-400">{L.vector.title}</p>
      <div ref={ref} className="mt-1 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.vector.title} className="block">
          {rows.map((r, i) => {
            const y = 4 + i * rowH;
            const yA = y + 22;
            const yB = y + 42;
            const yC = y + 62;
            return (
              <g key={r.id}>
                <text x={0} y={y + 8} fontSize="11" fontWeight="700" fill={r.color}>
                  {r.name}
                </text>
                <line x1={x0} x2={x0} y1={y + 12} y2={y + rowH - 6} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                <line x1={x0 + p1 * k} x2={x0 + p1 * k} y1={yA} y2={yB} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
                <Arrow x1={x0} y1={yA} x2={x0 + p1 * k} y2={yA} color={COL.pText} width={2.6} head={9} />
                <text x={x0 + p1 * k + 6} y={yA + 4} fontSize="11" fill={COL.pText}>
                  {tag('p₁', p1)}
                </text>
                <Arrow x1={x0 + p1 * k} y1={yB} x2={x0 + r.p2 * k} y2={yB} color={COL.dpText} width={2.6} head={9} />
                <text x={x0 + r.p2 * k - 6} y={yB + 4} textAnchor="end" fontSize="11" fill={COL.dpText}>
                  {tag('Δp', r.p2 - p1)}
                </text>
                {Math.abs(r.p2) > 1e-9 ? (
                  <Arrow x1={x0} y1={yC} x2={x0 + r.p2 * k} y2={yC} color="#c7d2fe" width={2.6} head={9} dash="5 3" />
                ) : (
                  <circle cx={x0} cy={yC} r={3.5} fill="#c7d2fe" />
                )}
                <text x={x0 + Math.min(0, r.p2 * k) - 6} y={yC + 4} textAnchor="end" fontSize="11" fill="#c7d2fe">
                  {tag('p₂', r.p2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs leading-snug text-gray-500">{L.vector.note}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function Ball({ kind, cx, cy, rx, ry }) {
  const clay = kind === 'clay';
  return (
    <g>
      <ellipse cx={cx + 1.5} cy={cy + ry + 1} rx={rx * 0.85} ry={2.6} fill="#0f172a" opacity="0.15" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={clay ? 'url(#imp-clay)' : 'url(#imp-rubber)'} stroke={clay ? '#92400e' : '#075985'} strokeWidth="1.2" />
      {clay ? (
        <g fill="none" stroke="#b45309" strokeWidth="1" opacity="0.6">
          <path d={`M${cx - rx * 0.4},${cy - ry * 0.2} q${rx * 0.2},${-ry * 0.25} ${rx * 0.45},0`} />
          <path d={`M${cx - rx * 0.1},${cy + ry * 0.35} q${rx * 0.2},${-ry * 0.2} ${rx * 0.4},0`} />
        </g>
      ) : (
        <>
          <path d={`M${cx},${cy - ry} Q${cx + rx * 0.45},${cy} ${cx},${cy + ry}`} fill="none" stroke="#e0f2fe" strokeWidth="1.4" opacity="0.8" />
          <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.4} rx={rx * 0.28} ry={ry * 0.18} fill="#fff" opacity="0.75" />
        </>
      )}
    </g>
  );
}

function BounceScene({ T, v, e, dt, t, tHit, FA, FB, kA, kC, inSlow }) {
  const L = T.bounce;
  const dec = T.decimal;
  const tc = t - tHit;
  const pScale = niceMax(M_BALL * v, 1);
  const FScale = niceMax(-FB, 1);
  const pLenMax = (narrow) => (narrow ? 70 : 120);
  const FLenMax = (narrow) => (narrow ? 120 : 230);

  return (
    <LabScene
      legend={[
        { color: COL.p, label: L.legend.p, kind: 'arrow' },
        { color: COL.F, label: L.legend.F, kind: 'arrow' },
        { color: '#fca5a5', label: L.legend.record, kind: 'dasharrow' },
      ]}
      chips={(W, narrow) => {
        const kF = FLenMax(narrow) / FScale;
        const kp = pLenMax(narrow) / pScale;
        const uF = niceUnit(kF, narrow ? 24 : 32);
        const up = niceUnit(kp, narrow ? 22 : 30);
        return (
          <>
            <Chip strong={inSlow}>{inSlow ? L.chipHit(kC) : kA > 1 ? L.chipSlow(kA) : L.chipReal}</Chip>
            <Chip icon={RulerIcon} color={COL.F}>
              <ScaleBar px={uF * kF} label={`${trim(uF, dec)} ${T.N}`} color={COL.F} />
              <span className="text-slate-300">·</span>
              <ScaleBar px={up * kp} label={`${trim(up, dec)} ${T.pu}`} color={COL.p} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 330 : 360)}
      ariaLabel={L.sceneLabel(fmt(t, 3, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const topPad = narrow ? 78 : 56;
        const rulerY = H - 28;
        const r = narrow ? 14 : 20;
        const view = lineView(-APPROACH - 0.02, WALL + 0.05, W, 14 + 2 * r, 8);
        const k = view.k;
        const step = niceUnit(k, narrow ? 46 : 64);
        const laneH = (rulerY - topPad - 6) / 2;
        const kF = FLenMax(narrow) / FScale;
        const kp = pLenMax(narrow) / pScale;
        const x0 = view.sx(0);
        const box = { w: W, h: H };
        const lanes = [
          { id: 'clay', e: 0, F: FA, top: topPad, name: L.laneClay },
          { id: 'rubber', e, F: FB, top: topPad + laneH + 6, name: L.laneRubber(trim(e * v, dec, 2)) },
        ];
        return (
          <>
            <defs>
              <radialGradient id="imp-clay" cx="38%" cy="32%" r="75%">
                <stop offset="0" stopColor="#fcd34d" />
                <stop offset="1" stopColor="#d97706" />
              </radialGradient>
              <radialGradient id="imp-rubber" cx="38%" cy="32%" r="75%">
                <stop offset="0" stopColor="#7dd3fc" />
                <stop offset="1" stopColor="#0369a1" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={rulerY} step={step} rowPx={narrow ? 24 : 28} />
            <ConcreteWall x={x0} y={topPad - 6} w={WALL * k} h={rulerY - topPad + 6} seed={3} />
            {lanes.map((ln) => {
              const floor = ln.top + laneH - 4;
              const front = ballFront(t, v, ln.e, dt, tHit);
              const vel = ballVel(t, v, ln.e, dt, tHit);
              const squash = Math.min(Math.max(0, front) * k, r * 0.55);
              const rx = r - squash / 2;
              const ry = r + squash * 0.22;
              const cx = front > 0 ? x0 - rx : view.sx(front) - r;
              const cyBall = floor - ry;
              const inContact = tc > 0 && tc < dt;
              const after = tc >= dt;
              const p = M_BALL * vel;
              const Fpx = -ln.F * kF;
              const tagF = L.FTag(trim(-ln.F, dec, 0));
              const tagW = textWidth(tagF, fs, 600) + 16;
              const yArrow = cyBall - ry - 12;
              return (
                <g key={ln.id}>
                  <rect x={0} y={floor} width={x0} height={5} fill="#cbd5e1" />
                  <line x1={0} x2={x0} y1={floor} y2={floor} stroke="#475569" strokeWidth={1.5} />
                  <text x={10} y={ln.top + 14} fontSize={fs} fontWeight="700" fill={ln.id === 'clay' ? '#92400e' : '#075985'} stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                    {ln.name}
                  </text>
                  <Ball kind={ln.id} cx={cx} cy={cyBall} rx={rx} ry={ry} />
                  {/* momentum of the ball */}
                  {Math.abs(p) > 1e-6 && !inContact && (
                    <VecArrow
                      x={p > 0 ? Math.min(cx, x0 - 26 - p * kp) : Math.max(cx, 34 - p * kp)}
                      y={yArrow}
                      dx={p * kp}
                      dy={0}
                      color={COL.p}
                      main="p"
                      sub={tc < 0 ? '1' : '2'}
                      fs={fs}
                      width={3}
                      place={p > 0 ? 'right' : 'left'}
                    />
                  )}
                  {after && Math.abs(p) <= 1e-6 && <Pill x={cx - r - 30} y={yArrow} text="p₂ = 0" bg={COL.p} size={fs - 1} box={box} />}
                  {/* the wall's force on the ball: live during contact, kept faintly afterwards */}
                  {(inContact || after) && (
                    <g opacity={inContact ? 1 : 0.6}>
                      <VecArrow
                        x={x0}
                        y={cyBall + (narrow ? 2 : 4)}
                        dx={-Fpx}
                        dy={0}
                        color={COL.F}
                        main="F"
                        fs={fs}
                        width={3.4}
                        dash={inContact ? undefined : '6 4'}
                        place="above"
                      />
                      <Pill x={x0 - Fpx - 10 - tagW / 2} y={cyBall + (narrow ? 2 : 4)} text={tagF} bg={COL.F} size={fs} box={box} />
                    </g>
                  )}
                </g>
              );
            })}
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
          </>
        );
      }}
    </LabScene>
  );
}
