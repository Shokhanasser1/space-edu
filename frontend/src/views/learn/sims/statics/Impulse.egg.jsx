import { useState } from 'react';
import { BedSingle, Lightbulb, Package, Ruler as RulerIcon, Square, Wind } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop } from '../kit/ui';
import {
  COL,
  Chip,
  ConcreteWall,
  FormulaTile,
  GroupLabel,
  InfoBox,
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
 * Tab 3 — the same change of momentum with a longer stopping time needs a
 * smaller force, F = Δp/Δt. Two equal eggs (60 g) are thrown at the same
 * speed, seen from above (gravity acts across the view, so it does not
 * change the horizontal motion): one at a concrete wall (Δt ≈ 0.002 s), one
 * at a target the reader picks — a hanging bed sheet (0.2 s), a pillow on
 * the wall (0.05 s), a sandbag (0.015 s) or a plywood board (0.005 s). The
 * stopping is taken as uniform, so the egg sinks d = v·Δt/2. An egg breaks
 * when the average force exceeds ≈ 25 N.
 * Preset: v = 5 m/s → Δp = 0.3 kg·m/s; wall 150 N, sheet 1.5 N (100×).
 * Strings come from T.soft.
 */

export const M_EGG = 0.06; // kg
export const F_BREAK = 25; // N, about the force that cracks an egg's shell
const WALL_DT = 0.002;
export const TARGETS = {
  sheet: { dt: 0.2, icon: Wind },
  pillow: { dt: 0.05, icon: BedSingle },
  sand: { dt: 0.015, icon: Package },
  board: { dt: 0.005, icon: Square },
};
const APPROACH = 1.2; // m of flight shown before the target
const X_MAX = 0.95; // m of room behind the target face
const IDLE = { t: 0, running: false, done: false };

/** Position of the egg's front (m, 0 = target face) at time t for a uniform stop over dt. */
function frontAt(t, v, tHit, dt) {
  const tc = t - tHit;
  if (tc <= 0) return -APPROACH + v * t;
  if (tc < dt) return v * tc - (v * tc * tc) / (2 * dt);
  return (v * dt) / 2;
}

export default function EggSim({ T }) {
  const L = T.soft;
  const dec = T.decimal;
  const [target, setTarget] = useState('sheet');
  const [v, setV] = useState(5);
  const [sim, setSim] = useState(IDLE);

  const dtA = WALL_DT;
  const dtB = TARGETS[target].dt;
  const tHit = APPROACH / v;
  const dp = M_EGG * v;
  const FA = dp / dtA;
  const FB = dp / dtB;
  const brokenA = FA > F_BREAK;
  const brokenB = FB > F_BREAK;
  const tEnd = tHit + Math.max(dtA, dtB) + 0.15;
  const slow = pickNice((2 * v) / APPROACH, [2, 4, 5, 10, 20]);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt / slow);
      const done = t >= tEnd - 1e-9;
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
  const nameB = L.targets[target].name;
  const Tr = (n, k = 2) => trim(n, dec, k);
  const Fs = (n) => trim(n, dec, n < 10 ? 2 : 1);

  /* explanation */
  let key = 'idle';
  if (sim.done) key = brokenB ? 'doneBoth' : 'done';
  else if (t > 0) key = tc < 0 ? 'fly' : tc < dtB ? 'soft' : brokenB ? 'doneBoth' : 'done';
  // the phases follow one another in time and never flip back, so no debounce is needed
  const settled = key;
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    fly: ex.fly(Tr(dp, 3)),
    soft: ex.soft(nameB, Tr(dtB, 3), Fs(FB), Fs(FA)),
    done: ex.done(Fs(FA), Fs(FB), trim(dtB / dtA, dec, 1)),
    doneBoth: ex.doneBoth(nameB, Tr(dtB, 3), Fs(FB)),
  }[settled];
  const tone = { idle: '#22d3ee', fly: '#a5b4fc', soft: '#fbbf24', done: '#34d399', doneBoth: '#f87171' }[settled];

  /* graphs: the same time axis in ms, each with its own force axis */
  const tMaxMs = niceMax(1.3 * Math.max(dtA, dtB) * 1000);
  const marker = tc > 0 ? tc * 1000 : undefined;
  const graph = (F, dts, color, title, broken) => {
    const ms = dts * 1000;
    const yMax = niceMax(Math.max(F * 1.3, F > F_BREAK ? F_BREAK : 0));
    const live = tc > 0 ? Math.min(tc * 1000, ms) : ms;
    const pts = (until) => [
      { x: 0, y: 0 },
      { x: 0, y: F },
      { x: until, y: F },
      { x: until, y: 0 },
    ];
    const narrowPulse = ms / tMaxMs < 0.12;
    return (
      <PulseGraph
        title={title}
        series={[
          { id: 'full', color, points: [...pts(ms), { x: tMaxMs, y: 0 }], width: 2, opacity: tc > 0 && tc * 1000 < ms ? 0.4 : 1 },
          { id: 'area', color, points: pts(live), fill: color, fillOpacity: 0.32, width: 0 },
        ]}
        xMax={tMaxMs}
        yMax={yMax}
        xLabel={L.graph.t}
        yLabel={L.graph.y}
        marker={marker}
        threshold={{ y: F_BREAK, label: L.graph.limit, color: '#fbbf24' }}
        labels={[
          {
            x: narrowPulse ? ms + tMaxMs * 0.03 : ms / 2,
            y: narrowPulse ? F * 0.62 : Math.min(F * 0.5, yMax * 0.5),
            text: L.graph.area(Fs(F), Tr(dts, 3), Tr(dp, 3)),
            color: '#f8fafc',
            anchor: narrowPulse ? 'start' : 'middle',
          },
        ]}
        decimal={dec}
        height={170}
        note={broken ? L.graph.broke : L.graph.safe}
      />
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.targetLabel}</GroupLabel>
          <Segmented
            label={L.targetLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={target}
            onChange={change(setTarget)}
            accent="#fbbf24"
            options={Object.keys(TARGETS).map((id) => ({ value: id, label: L.targets[id].name, sub: L.targets[id].sub, icon: TARGETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} startLabel={L.throw} />
      </div>

      <EggScene T={T} target={target} v={v} t={t} tHit={tHit} dtA={dtA} dtB={dtB} FA={FA} FB={FB} brokenA={brokenA} brokenB={brokenB} slow={slow} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.dp} symbol="Δp" value={Tr(dp, 3)} unit={T.pu} accent={COL.dp} textColor={COL.dpText} sub={L.dpSub} />
        <Readout
          label={L.wall}
          symbol={<span>F₁</span>}
          value={Fs(FA)}
          unit={T.N}
          accent={COL.F}
          textColor={COL.FText}
          sub={L.FSub(Tr(dtA, 3), brokenA)}
          active={tc >= dtA}
        />
        <Readout
          label={nameB}
          symbol={<span>F₂</span>}
          value={Fs(FB)}
          unit={T.N}
          accent={brokenB ? COL.F : '#34d399'}
          textColor={brokenB ? COL.FText : '#6ee7b7'}
          sub={L.FSub(Tr(dtB, 3), brokenB)}
          active={tc >= dtB}
        />
        <Readout label={L.readouts.ratio} symbol={<span className="whitespace-nowrap">F₁ / F₂</span>} value={`${trim(FA / FB, dec, 1)}×`} accent="#fbbf24" textColor="#fde68a" sub={L.ratioSub} />
      </div>

      <Panel>
        <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile tag={L.f1} color={COL.dpText} general="Δp = m·v − 0 = m·v" filled={`= ${Tr(M_EGG)} ${T.kg} · ${Tr(v, 1)} ${T.ms}`} result={`Δp = ${Tr(dp, 3)} ${T.pu}`} />
          <FormulaTile tag={L.wall} color={COL.FText} general="F₁ = Δp / Δt₁" filled={`= ${Tr(dp, 3)} / ${Tr(dtA, 3)}`} result={`F₁ = ${Fs(FA)} ${T.N}`} />
          <FormulaTile tag={nameB} color={brokenB ? COL.FText : '#6ee7b7'} general="F₂ = Δp / Δt₂" filled={`= ${Tr(dp, 3)} / ${Tr(dtB, 3)}`} result={`F₂ = ${Fs(FB)} ${T.N}`} ok={!brokenB && sim.done} />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="imp-egg-v"
            label={L.v}
            symbol="v"
            min={2}
            max={8}
            step={0.5}
            value={v}
            onChange={change(setV)}
            accent={COL.v}
            display={`${Tr(v, 1)} ${T.ms}`}
            hint={L.vHint(trim(v * 3.6, dec, 0))}
          />
          <InfoBox
            title={L.info.title}
            cols="grid-cols-2"
            items={[
              [L.info.m, `${trim(M_EGG * 1000, dec, 0)} ${T.g}`, '#e2e8f0'],
              [L.info.limit, `≈ ${F_BREAK} ${T.N}`, '#fde68a'],
              [L.info.d1, `${trim(((v * dtA) / 2) * 100, dec, 2)} ${T.cm}`, COL.FText],
              [L.info.d2, `${trim(((v * dtB) / 2) * 100, dec, 1)} ${T.cm}`, brokenB ? COL.FText : '#6ee7b7'],
            ]}
          />
          <p className="text-xs leading-snug text-gray-500">{L.info.note}</p>
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.life.title}</p>
            <ul className="mt-1.5 space-y-1.5">
              {L.life.items.map(([term, txt]) => (
                <li key={term} className="text-xs leading-snug text-gray-400">
                  <span className="font-semibold text-gray-200">{term}</span> — {txt}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          {graph(FA, dtA, '#f87171', L.graph.titleA, brokenA)}
          {graph(FB, dtB, brokenB ? '#f87171' : '#34d399', L.graph.titleB(nameB), brokenB)}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function EggTop({ cx, cy, rx, ry, squash = 0, cracked }) {
  const sx = Math.min(squash, rx * 0.35);
  const ex = rx - sx / 2;
  const ey = ry + sx * 0.3;
  const c = cx + sx / 2;
  return (
    <g>
      <ellipse cx={c + 1.5} cy={cy + 2.5} rx={ex} ry={ey} fill="#0f172a" opacity="0.13" />
      <ellipse cx={c} cy={cy} rx={ex} ry={ey} fill="url(#imp-egg)" stroke="#c19a5b" strokeWidth="1.1" />
      <ellipse cx={c - ex * 0.25} cy={cy - ey * 0.35} rx={ex * 0.38} ry={ey * 0.22} fill="#fff" opacity="0.7" />
      {cracked && (
        <path
          d={`M${c + ex * 0.95},${cy - ey * 0.1} l${-ex * 0.35},${-ey * 0.25} l${-ex * 0.18},${ey * 0.35} l${-ex * 0.25},${-ey * 0.3} M${c + ex * 0.6},${cy + ey * 0.05} l${-ex * 0.2},${ey * 0.45}`}
          fill="none"
          stroke="#78350f"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/** A broken egg against the target face at x (px): egg white, yolk and shell bits. */
function Splat({ x, cy, r }) {
  const w = r * 1.5;
  const blob = `M${x},${cy - w} C${x - w * 0.6},${cy - w * 1.05} ${x - w * 1.25},${cy - w * 0.6} ${x - w * 1.15},${cy - w * 0.05} C${x - w * 1.4},${cy + w * 0.5} ${x - w * 0.7},${cy + w * 1.1} ${x},${cy + w * 0.9} Z`;
  const bits = [
    [-1.55, -0.55, 0],
    [-1.35, 0.75, 40],
    [-0.9, -1.15, 75],
    [-1.8, 0.15, 120],
  ];
  return (
    <g>
      <path d={blob} fill="#fffbeb" stroke="#fcd34d" strokeWidth="1" opacity="0.95" />
      <circle cx={x - r * 0.75} cy={cy + r * 0.05} r={r * 0.55} fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
      <circle cx={x - r * 0.9} cy={cy - r * 0.12} r={r * 0.16} fill="#fde68a" />
      {bits.map(([dx, dy, rot]) => (
        <path
          key={rot}
          d={`M0,0 l${r * 0.45},${-r * 0.12} l${-r * 0.1},${r * 0.3} Z`}
          transform={`translate(${(x + dx * r).toFixed(1)} ${(cy + dy * r).toFixed(1)}) rotate(${rot})`}
          fill="#fef3c7"
          stroke="#c19a5b"
          strokeWidth="0.9"
        />
      ))}
    </g>
  );
}

/** The chosen target, seen from above, its face at x0 px; `b` = how far it is pushed in (px). */
function TargetTop({ kind, x0, top, bot, yc, b, k, dentHalf }) {
  if (kind === 'sheet' || kind === 'board') {
    const a1 = top + 6;
    const a2 = bot - 6;
    const sheet = kind === 'sheet';
    return (
      <g>
        <path
          d={`M${x0},${a1} Q${x0 + 2 * b},${yc} ${x0},${a2}`}
          fill="none"
          stroke={sheet ? '#60a5fa' : '#a16207'}
          strokeWidth={sheet ? 4 : 7}
          strokeLinecap="round"
        />
        {sheet && <path d={`M${x0},${a1} Q${x0 + 2 * b},${yc} ${x0},${a2}`} fill="none" stroke="#dbeafe" strokeWidth="1.2" strokeDasharray="2 5" />}
        {!sheet && <path d={`M${x0 - 1.5},${a1 + 3} Q${x0 + 2 * b - 1.5},${yc} ${x0 - 1.5},${a2 - 3}`} fill="none" stroke="#ca8a04" strokeWidth="1.2" />}
        {[a1, a2].map((ya) => (
          <circle key={ya} cx={x0} cy={ya} r={sheet ? 5 : 5.5} fill="#334155" stroke="#fff" strokeWidth="1.5" />
        ))}
      </g>
    );
  }
  const depth = (kind === 'pillow' ? 0.25 : 0.2) * k;
  const fill = kind === 'pillow' ? '#fef3c7' : '#e7c98f';
  const edge = kind === 'pillow' ? '#d6b56b' : '#a16207';
  const y1 = top + 4;
  const y2 = bot - 4;
  const h = dentHalf;
  const face = `M${x0 + 6},${y1} Q${x0},${y1} ${x0},${y1 + 6} L${x0},${yc - h} C${x0 + b * 0.9},${yc - h * 0.55} ${x0 + b},${yc - h * 0.3} ${x0 + b},${yc} C${x0 + b},${yc + h * 0.3} ${x0 + b * 0.9},${yc + h * 0.55} ${x0},${yc + h} L${x0},${y2 - 6} Q${x0},${y2} ${x0 + 6},${y2} L${x0 + depth},${y2} L${x0 + depth},${y1} Z`;
  const dots = [];
  if (kind === 'sand') {
    for (let i = 0; i < 26; i += 1) {
      const a = Math.sin((i + 1) * 91.7) * 43758.5453;
      const c = Math.sin((i + 1) * 47.3) * 43758.5453;
      dots.push(<circle key={i} cx={x0 + 6 + (a - Math.floor(a)) * (depth - 10)} cy={y1 + 5 + (c - Math.floor(c)) * (y2 - y1 - 10)} r={1} fill="#92400e" opacity="0.45" />);
    }
  }
  return (
    <g>
      <path d={face} fill={fill} stroke={edge} strokeWidth="1.4" strokeLinejoin="round" />
      {kind === 'pillow' && <path d={`M${x0 + depth * 0.5},${y1 + 8} L${x0 + depth * 0.5},${y2 - 8}`} stroke={edge} strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />}
      {dots}
    </g>
  );
}

function EggScene({ T, target, v, t, tHit, dtA, dtB, FA, FB, brokenA, brokenB, slow }) {
  const L = T.soft;
  const dec = T.decimal;
  const kFor = (narrow) => (narrow ? 100 : 210) / 240; // px per newton; 240 N = the hardest hit possible here
  const tc = t - tHit;

  return (
    <LabScene
      legend={[
        { color: COL.v, label: L.legend.v, kind: 'arrow' },
        { color: COL.F, label: L.legend.F, kind: 'arrow' },
        { color: '#fca5a5', label: L.legend.record, kind: 'dasharrow' },
      ]}
      chips={(W, narrow) => {
        const kF = kFor(narrow);
        const uF = niceUnit(kF, narrow ? 24 : 32);
        return (
          <>
            <Chip strong={tc > 0 && tc < dtB}>{L.chipSlow(slow)}</Chip>
            <Chip icon={RulerIcon} color={COL.F}>
              <ScaleBar px={uF * kF} label={`${trim(uF, dec)} ${T.N}`} color={COL.F} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 300 : 350)}
      ariaLabel={L.sceneLabel(fmt(v, 1, dec), trim(FA, dec, 1), trim(FB, dec, 2))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const topPad = narrow ? 74 : 54;
        // room on the left for the whole egg at its starting point
        const k0 = (W - 20) / (APPROACH + X_MAX);
        const rx = Math.max(narrow ? 9 : 12, 0.0285 * k0);
        const view = lineView(-APPROACH - 0.02, X_MAX, W, 12 + 2 * rx, 10);
        const k = view.k;
        const step = niceUnit(k, narrow ? 46 : 64);
        const gap = 10;
        const rulerY = H - 28;
        const laneH = (rulerY - 6 - topPad - gap) / 2;
        const lanes = [
          { id: 'A', top: topPad, dt: dtA, F: FA, broken: brokenA, kind: 'wall', name: L.wall },
          { id: 'B', top: topPad + laneH + gap, dt: dtB, F: FB, broken: brokenB, kind: target, name: L.targets[target].name },
        ];
        const ry = rx * 0.77;
        const x0 = view.sx(0);
        const kF = kFor(narrow);
        const kv = narrow ? 5 : 9;
        const box = { w: W, h: H };
        return (
          <>
            <defs>
              <radialGradient id="imp-egg" cx="40%" cy="35%" r="70%">
                <stop offset="0" stopColor="#fffaf0" />
                <stop offset="0.7" stopColor="#f5e6c8" />
                <stop offset="1" stopColor="#e8cfa0" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={H} step={step} rowPx={narrow ? 24 : 28} />
            {lanes.map((ln) => {
              const bot = ln.top + laneH;
              const yc = ln.top + laneH / 2 + 6;
              const front = frontAt(t, v, tHit, ln.dt);
              const pen = Math.max(0, front);
              const lc = t - tHit;
              const inContact = lc > 0 && lc < ln.dt;
              const stopped = lc >= ln.dt;
              const b = pen * k;
              const cxEgg = view.sx(front) - rx;
              const label = L.laneTag(ln.name, trim(ln.dt, dec, 3));
              const Fpx = ln.F * kF;
              const tagF = L.FTag(trim(ln.F, dec, ln.F < 10 ? 2 : 1));
              const tagW = textWidth(tagF, fs, 600) + 16;
              return (
                <g key={ln.id}>
                  <rect x={0} y={ln.top} width={W} height={laneH} fill="#f1f5f9" opacity="0.55" />
                  <line x1={0} x2={W} y1={ln.top} y2={ln.top} stroke="#cbd5e1" strokeDasharray="5 5" />
                  <line x1={0} x2={W} y1={bot} y2={bot} stroke="#cbd5e1" strokeDasharray="5 5" />
                  <text x={10} y={ln.top + 17} fontSize={fs} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                    {label}
                  </text>
                  {ln.kind === 'wall' ? (
                    <ConcreteWall x={x0} y={ln.top + 2} w={0.15 * k} h={laneH - 4} seed={1} />
                  ) : (
                    <>
                      {(ln.kind === 'pillow' || ln.kind === 'sand') && (
                        <ConcreteWall x={x0 + (ln.kind === 'pillow' ? 0.25 : 0.2) * k} y={ln.top + 2} w={0.12 * k} h={laneH - 4} seed={2} />
                      )}
                      <TargetTop kind={ln.kind} x0={x0} top={ln.top} bot={bot} yc={yc} b={b} k={k} dentHalf={ry * 1.7} />
                    </>
                  )}
                  {/* the egg, or what is left of it */}
                  {stopped && ln.broken ? (
                    <Splat x={x0 + Math.min(b, 4)} cy={yc} r={rx * 1.25} />
                  ) : (
                    <EggTop cx={cxEgg} cy={yc} rx={rx} ry={ry} squash={ln.kind === 'wall' && inContact ? rx * 0.3 : 0} cracked={inContact && ln.broken} />
                  )}
                  {/* velocity while flying */}
                  {lc < 0 && <VecArrow x={cxEgg} y={yc - ry - 11} dx={v * kv} dy={0} color={COL.v} main="v" fs={fs} width={2.6} place="right" />}
                  {/* the target's force on the egg: live while stopping, kept faintly afterwards */}
                  {(inContact || stopped) && (
                    <g opacity={inContact ? 1 : 0.55}>
                      <VecArrow
                        x={view.sx(front)}
                        y={yc + ry + 10}
                        dx={-Fpx}
                        dy={0}
                        color={COL.F}
                        main="F"
                        fs={fs}
                        width={3.2}
                        dash={inContact ? undefined : '6 4'}
                        place="left"
                      />
                      <Pill x={view.sx(front) - Math.max(Fpx, 14) - 18 - tagW / 2} y={yc + ry + 10} text={tagF} bg={COL.F} size={fs} box={box} />
                    </g>
                  )}
                  {stopped && (
                    <Pill
                      x={x0 - 0.45 * k}
                      y={yc - ry - 16}
                      text={ln.broken ? L.broken : L.intact}
                      bg={ln.broken ? '#b91c1c' : '#047857'}
                      size={fs}
                      box={box}
                    />
                  )}
                </g>
              );
            })}
            <text x={10} y={lanes[1].top + laneH - 8} fontSize={fs - 1} fill="#64748b" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
              {L.topView}
            </text>
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
          </>
        );
      }}
    </LabScene>
  );
}
