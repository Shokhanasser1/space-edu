import { useState } from 'react';
import { BrickWall, ChevronsRight, Equal, Lightbulb } from 'lucide-react';
import { Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, TimeGraph, makeView } from '../kit/scene';
import { COL, ForceArrow, Panel, Person, PlayButtons, RichPill, ScaleBar, SimScene, Tag, TimeChip, Toolbar, fmtt, rich } from './NewtonThirdLaw.parts';

/**
 * Two spring balances hooked together. At the hook balance 1 acts on
 * balance 2 with F₁₂ and balance 2 acts on balance 1 with F₂₁ = −F₁₂, so the
 * two always read the same, however the pull is shared out.
 *
 *   wall - balance 1 hangs on a wall hook, pupil B pulls balance 2: both
 *          read B's force.
 *   tug  - pupils A and B (50 kg each) pull the two ends. Each one braces
 *          against the floor; the floor pushes A back with F_A and B back
 *          with F_B (the "effort"). The balances are light, so the force
 *          along them is the same everywhere: with equal masses the reading
 *          is T = (F_A + F_B)/2, and the difference accelerates both pupils
 *          together, a = (F_B − F_A)/(m_A + m_B). Whoever pushes the floor
 *          harder wins the tug - yet the two balances never disagree.
 */

const M = 50; // kg, each pupil
const RAMP = 0.6; // s, the pupils take this long to start pulling
const WIN = 1; // m, the ribbon has to reach a pupil's line
const T_MAX = 8; // s
const DYN_MAX = 200; // N, full scale of a balance
const BAL = 0.98; // m, one balance from its ring to its hook
const YB = 1; // m, height of the balances
const BOX = { x0: -3.5, x1: 3.5, y0: -0.45, y1: 2.25 };
const PAD_WIDE = { l: 20, r: 20, t: 56, b: 14 };
const PAD_NARROW = { l: 8, r: 8, t: 44, b: 10 };
const M_PER_N = 1.3 / 200; // force arrows: 200 N ↔ 1.3 m
const M_PER_A = 0.6; // acceleration arrow: 1 m/s² ↔ 0.6 m
const M_PER_V = 0.8; // velocity arrow: 1 m/s ↔ 0.8 m

const PRESETS = [
  { id: 'wall', mode: 'wall', FA: 100, FB: 100, icon: BrickWall },
  { id: 'tug', mode: 'tug', FA: 100, FB: 100, icon: Equal },
  { id: 'strong', mode: 'tug', FA: 100, FB: 140, icon: ChevronsRight },
];
const IDLE = { running: false, t: 0, X: 0, V: 0, F: 0, done: false, winner: null, samples: [{ x: 0, y: 0 }] };

/** Acceleration of the whole system and the reading of the balances. */
function forces(mode, EA, EB) {
  if (mode === 'wall') return { a: 0, F: EB };
  return { a: (EB - EA) / (2 * M), F: (EA + EB) / 2 };
}
const ramp = (t) => Math.min(1, t / RAMP);

export default function BalancesSim({ T }) {
  const tx = T.balances;
  const dec = T.decimal;
  const [mode, setMode] = useState('wall');
  const [FA, setFA] = useState(100);
  const [FB, setFB] = useState(100);
  const [sim, setSim] = useState(IDLE);
  const started = sim.t > 0;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(T_MAX, p.t + dt);
      const r = ramp(t);
      const f = forces(mode, FA * r, FB * r);
      const V = p.V + f.a * dt;
      let X = p.X + V * dt;
      let done = t >= T_MAX;
      let winner = null;
      if (mode === 'tug' && Math.abs(X) >= WIN) {
        X = Math.sign(X) * WIN;
        done = true;
        winner = X > 0 ? 'B' : 'A';
      }
      const last = p.samples[p.samples.length - 1];
      const samples = done || t - last.x >= 0.04 ? [...p.samples, { x: t, y: f.F }] : p.samples;
      return { running: !done, t, X, V, F: f.F, done, winner, samples };
    });
  });

  const pick = (id) => {
    const pr = PRESETS.find((x) => x.id === id);
    setMode(pr.mode);
    setFA(pr.FA);
    setFB(pr.FB);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const preset = mode === 'wall' ? 'wall' : FA === FB ? 'tug' : FA === 100 && FB === 140 ? 'strong' : null;

  /* ---- current state */
  const r = ramp(sim.t);
  const EA = started ? FA * r : 0;
  const EB = started ? FB * r : 0;
  const live = started && !sim.done;
  const aNow = live ? forces(mode, EA, EB).a : 0;
  const reading = sim.F;

  /* ---- explanation */
  let key;
  if (!started) key = mode === 'wall' ? 'idleWall' : 'idleTug';
  else if (sim.winner) key = 'win';
  else if (sim.done) key = 'time';
  else if (reading < 0.5) key = 'zero';
  else if (mode === 'wall') key = 'wall';
  else if (FA === FB) key = Math.abs(sim.V) > 0.02 ? 'coast' : 'equal';
  else key = FB > FA ? 'strongB' : 'strongA';
  const settled = useSettled(key, started && !sim.done ? 250 : 0);
  const ex = tx.explain;
  const Fn = fmt(reading, 0, dec);
  let text;
  if (settled === 'idleWall') text = ex.idleWall;
  else if (settled === 'idleTug') text = ex.idleTug;
  else if (settled === 'win') text = ex.win(sim.winner);
  else if (settled === 'time') text = ex.time(Fn);
  else if (settled === 'zero') text = ex.zero;
  else if (settled === 'wall') text = ex.wall(Fn);
  else if (settled === 'equal') text = ex.equal(Fn);
  else if (settled === 'coast') text = ex.coast(Fn);
  else {
    const w = settled === 'strongB' ? 'B' : 'A';
    text = ex.strong(w, Math.max(FA, FB), Math.min(FA, FB), fmtt(Math.abs(FB - FA) / (2 * M), 2, dec), Fn);
  }
  const tone = settled === 'win' || settled === 'time' ? '#34d399' : settled.startsWith('strong') ? '#fbbf24' : settled.startsWith('idle') ? '#22d3ee' : '#f87171';

  const legend = [
    { label: tx.legend.pair, color: COL.force, kind: 'arrow' },
    { label: tx.legend.floor, color: COL.friction, kind: 'arrow' },
    { label: tx.legend.acc, color: COL.acc, kind: 'arrow' },
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={preset}
        onChange={pick}
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} done={sim.done} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.realTime} />}
        ariaLabel={tx.sceneLabel(Fn, Fn)}
        height={(W, narrow) => {
          const pad = narrow ? PAD_NARROW : PAD_WIDE;
          const k = (W - pad.l - pad.r) / (BOX.x1 - BOX.x0);
          return clamp((BOX.y1 - BOX.y0) * k + pad.t + pad.b, narrow ? 250 : 340, 520);
        }}
      >
        {(W, H, narrow) => (
          <BalancesDrawing W={W} H={H} narrow={narrow} mode={mode} sim={sim} EA={EA} EB={EB} a={aNow} reading={reading} tx={tx} dec={dec} N={T.common.N} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.d1} symbol="F₂₁" value={Fn} unit={T.common.N} accent={COL.b1} textColor={COL.b1Text} active={live && reading > 0.5} sub={tx.readouts.d1Sub} />
        <Readout label={tx.readouts.d2} symbol="F₁₂" value={Fn} unit={T.common.N} accent={COL.b2} textColor={COL.b2Text} active={live && reading > 0.5} sub={tx.readouts.d2Sub} />
        <Readout
          label={tx.readouts.a}
          symbol="a"
          value={fmtt(Math.abs(aNow), 2, dec)}
          unit={T.ms2}
          accent={COL.acc}
          textColor={COL.accText}
          sub={mode === 'wall' ? tx.readouts.aWall : rich(tx.readouts.aSub)}
        />
        <Readout label={tx.readouts.v} symbol="v" value={fmt(Math.abs(sim.V), 2, dec)} unit={T.ms} accent={COL.vel} textColor={COL.velText} sub={tx.readouts.vSub(fmt(sim.X, 2, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="n3-fa"
            label={tx.FA}
            symbol={rich('F_A')}
            min={0}
            max={DYN_MAX}
            step={10}
            value={FA}
            onChange={setFA}
            accent={COL.b1}
            disabled={mode === 'wall'}
            display={mode === 'wall' ? '—' : `${FA} ${T.common.N}`}
            valueText={mode === 'wall' ? tx.wallHint : `${FA} ${T.common.N}`}
            hint={mode === 'wall' ? tx.wallHint : tx.FHint}
          />
          <RangeField id="n3-fb" label={tx.FB} symbol={rich('F_B')} min={0} max={DYN_MAX} step={10} value={FB} onChange={setFB} accent={COL.b2} display={`${FB} ${T.common.N}`} hint={mode === 'wall' ? tx.FHint : undefined} />
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">{rich(mode === 'wall' ? tx.wallNote : tx.tugNote)}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={tx.graph.title}
            ariaLabel={tx.graph.label}
            series={[
              { id: 'd1', label: tx.graph.s1, color: COL.b1Line, points: sim.samples },
              { id: 'd2', label: tx.graph.s2, color: COL.b2Line, points: sim.samples, dash: '7 6' },
            ]}
            xMax={T_MAX}
            yMax={DYN_MAX}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            marker={sim.t}
            height={190}
            decimal={dec}
            note={tx.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

/** A horizontal spring balance from its ring (xr) to its hook (xh), reading F. */
function Balance({ xr, xh, y, hc, F, color, showNumbers }) {
  const dir = Math.sign(xh - xr) || 1;
  const L = Math.abs(xh - xr);
  const px = (u) => xr + dir * u * L;
  const u0 = 0.2;
  const u1 = 0.72;
  const up = u0 + ((u1 - u0) * clamp(F, 0, DYN_MAX)) / DYN_MAX;
  const ticks = [];
  for (let n = 0; n <= 10; n += 1) {
    const major = n % 5 === 0;
    const x = px(u0 + ((u1 - u0) * n) / 10);
    ticks.push(<line key={n} x1={x} x2={x} y1={y - hc / 2 + 1} y2={y - hc / 2 + 1 + hc * (major ? 0.42 : 0.26)} stroke="#64748b" strokeWidth={major ? 1.3 : 0.8} />);
    if (major && showNumbers)
      ticks.push(
        <text key={`t${n}`} x={x} y={y + hc / 2 - 2.5} textAnchor="middle" fontSize={Math.max(7, hc * 0.3)} fill="#64748b">
          {n * 20}
        </text>,
      );
  }
  // spring: from the ring end of the casing to the pointer
  const sa = px(0.13);
  const sb = px(up);
  const coils = 9;
  const amp = hc * 0.2;
  const pts = [`${sa},${y}`];
  for (let i = 1; i <= coils * 2; i += 1) pts.push(`${sa + ((sb - sa) * i) / (coils * 2 + 1)},${y + (i % 2 ? -amp : amp)}`);
  pts.push(`${sb},${y}`);
  const xl = Math.min(px(0.12), px(0.78));
  return (
    <g pointerEvents="none">
      <circle cx={px(0.05)} cy={y} r={L * 0.042} fill="none" stroke="#475569" strokeWidth={Math.max(2, L * 0.014)} />
      <line x1={px(0.092)} x2={px(0.12)} y1={y} y2={y} stroke="#475569" strokeWidth={Math.max(2, L * 0.014)} />
      <line x1={sb} x2={px(0.955)} y1={y} y2={y} stroke="#475569" strokeWidth={Math.max(2, L * 0.016)} />
      <rect x={xl} y={y - hc / 2} width={L * 0.66} height={hc} rx={Math.min(5, hc / 3)} fill="#f8fafc" fillOpacity="0.92" stroke={color} strokeWidth="2" />
      {ticks}
      <polyline points={pts.join(' ')} fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeLinejoin="round" />
      <line x1={sb} x2={sb} y1={y - hc / 2 + 1} y2={y + hc / 2 - 1} stroke={COL.ink} strokeWidth="2.2" />
      <path d={`M${sb - 4},${y - hc / 2 - 5} L${sb + 4},${y - hc / 2 - 5} L${sb},${y - hc / 2 + 1} Z`} fill={COL.ink} />
      <circle cx={px(0.975)} cy={y} r={L * 0.03} fill="none" stroke="#334155" strokeWidth={Math.max(2, L * 0.014)} />
    </g>
  );
}

function BalancesDrawing({ W, H, narrow, mode, sim, EA, EB, a, reading, tx, dec, N }) {
  const pad = narrow ? PAD_NARROW : PAD_WIDE;
  const view = makeView(BOX, W, H, pad);
  const k = view.k;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const gy = view.sy(0);
  const by = view.sy(YB);
  const X = sim.X;
  const hc = Math.max(11, 0.17 * k);
  const started = sim.t > 0;
  const hook = view.sx(X);
  const ring1 = view.sx(X - BAL);
  const ring2 = view.sx(X + BAL);
  const hand1 = { x: view.sx(X - BAL + 0.05 * BAL), y: by };
  const hand2 = { x: view.sx(X + BAL - 0.05 * BAL), y: by };
  const h = 1.6 * k;
  const leanOf = (E) => (started ? 0.1 + (0.36 * E) / DYN_MAX : 0.06);
  const fxA = hand1.x - 0.05 * k;
  const fxB = hand2.x + 0.05 * k;
  const kF = M_PER_N * k;
  const show = started && reading > 0.5;
  const lenPair = reading * kF;
  const off = hc / 2 + (narrow ? 7 : 9);
  const pillY = by - hc / 2 - Math.max(narrow ? 30 : 34, 0.42 * k);

  // floor planks (fixed to the floor, so they show the pupils' motion)
  const planks = [];
  for (let x = Math.ceil(BOX.x0 / 0.7) * 0.7; x <= BOX.x1; x += 0.7) planks.push(<line key={x} x1={view.sx(x)} x2={view.sx(x)} y1={gy} y2={H} stroke="#e7d5bb" strokeWidth="1" />);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} />
      <rect x={0} y={gy} width={W} height={H - gy} fill="#f6ead9" />
      {planks}
      <line x1={0} x2={W} y1={gy} y2={gy} stroke="#c8a97e" strokeWidth="2" />

      {/* centre mark and the two winning lines */}
      <line x1={view.sx(0)} x2={view.sx(0)} y1={gy - 6} y2={gy + 10} stroke={COL.ink} strokeWidth="2" />
      {mode === 'tug' && (
        <>
          {[
            [-WIN, COL.b1, tx.lineA],
            [WIN, COL.b2, tx.lineB],
          ].map(([x, c, label]) => (
            <g key={x}>
              <line x1={view.sx(x)} x2={view.sx(x)} y1={gy + 12} y2={view.sy(0.62)} stroke={c} strokeWidth="2" strokeDasharray="5 4" />
              {!narrow && (
                <text x={view.sx(x)} y={gy + 42} textAnchor="middle" fontSize={11} fontWeight="600" fill={c}>
                  {label}
                </text>
              )}
            </g>
          ))}
        </>
      )}

      {/* the wall, or pupil A */}
      {mode === 'wall' ? (
        <g>
          <defs>
            <pattern id="n3-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2" />
            </pattern>
          </defs>
          <rect x={view.sx(-BAL - 0.3)} y={view.sy(2.05)} width={0.22 * k} height={gy - view.sy(2.05)} fill="#e2e8f0" stroke="#94a3b8" />
          <rect x={view.sx(-BAL - 0.3)} y={view.sy(2.05)} width={0.22 * k} height={gy - view.sy(2.05)} fill="url(#n3-hatch)" opacity="0.6" />
          <line x1={view.sx(-BAL - 0.08)} x2={hand1.x} y1={by} y2={by} stroke="#334155" strokeWidth={Math.max(2, 0.014 * k)} />
          {!narrow && (
            <text x={view.sx(-BAL - 0.19)} y={view.sy(2.05) - 6} textAnchor="middle" fontSize={11} fill={COL.muted}>
              {tx.wall}
            </text>
          )}
        </g>
      ) : (
        <Person fx={fxA} fy={gy} h={h} dir={1} lean={leanOf(EA)} hand={hand1} color={COL.b1} stride={0.22} />
      )}
      <Person fx={fxB} fy={gy} h={h} dir={-1} lean={leanOf(EB)} hand={hand2} color={COL.b2} stride={0.22} />
      {!narrow && (
        <>
          {mode === 'tug' && (
            <text x={fxA - 0.25 * k} y={gy - h - 0.12 * k} textAnchor="middle" fontSize={12} fontWeight="700" fill={COL.b1}>
              {tx.pupil('A')}
            </text>
          )}
          <text x={fxB + 0.25 * k} y={gy - h - 0.12 * k} textAnchor="middle" fontSize={12} fontWeight="700" fill={COL.b2}>
            {tx.pupil('B')}
          </text>
        </>
      )}

      {/* the balances */}
      <Balance xr={ring1} xh={hook} y={by} hc={hc} F={reading} color={COL.b1} showNumbers={hc >= 18} />
      <Balance xr={ring2} xh={hook} y={by} hc={hc} F={reading} color={COL.b2} showNumbers={hc >= 18} />
      {/* ribbon on the hooks */}
      <line x1={hook} x2={hook} y1={by + hc / 2} y2={gy} stroke={COL.force} strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="2 4" />
      <path d={`M${hook},${by + 2} L${hook + 0.05 * k},${by + 0.2 * k} L${hook},${by + 0.16 * k} L${hook - 0.05 * k},${by + 0.2 * k} Z`} fill="#ef4444" opacity="0.85" />

      <RichPill x={(ring1 + hook) / 2 - (narrow ? 0.25 * k : 0)} y={pillY} text={tx.reading(fmt(reading, 0, dec))} bg={COL.b1} size={narrow ? 12 : 14} weight={700} box={box} />
      <RichPill x={(ring2 + hook) / 2 + (narrow ? 0.25 * k : 0)} y={pillY} text={tx.reading(fmt(reading, 0, dec))} bg={COL.b2} size={narrow ? 12 : 14} weight={700} box={box} />
      {!narrow && (
        <>
          <text x={(ring1 + hook) / 2} y={by + hc / 2 + off + 16} textAnchor="middle" fontSize={11} fill={COL.muted}>
            {tx.dyn1}
          </text>
          <text x={(ring2 + hook) / 2} y={by + hc / 2 + off + 16} textAnchor="middle" fontSize={11} fill={COL.muted}>
            {tx.dyn2}
          </text>
        </>
      )}

      {/* the pair at the hook */}
      {show && (
        <>
          <ForceArrow x={hook} y={by - off} dx={lenPair} dy={0} color={COL.force} dot={COL.b1} width={narrow ? 2.8 : 3.5} head={narrow ? 9 : 12} />
          <ForceArrow x={hook} y={by + off} dx={-lenPair} dy={0} color={COL.force} dot={COL.b2} width={narrow ? 2.8 : 3.5} head={narrow ? 9 : 12} />
          <Tag x={hook + lenPair + 5} y={by - off + 5} text="F₂₁" color={COL.force} size={fs + 1} anchor="start" />
          <Tag x={hook - lenPair - 5} y={by + off + 5} text="F₁₂" color={COL.force} size={fs + 1} anchor="end" />
        </>
      )}

      {/* the floor pushes the pupils */}
      {started && mode === 'tug' && EA > 0.5 && (
        <>
          <ForceArrow x={fxA} y={gy - 3} dx={-EA * kF} dy={0} color={COL.friction} dot={COL.b1} width={narrow ? 2.6 : 3.2} head={narrow ? 9 : 11} />
          <Tag x={fxA - EA * kF - 4} y={gy + (narrow ? 14 : 18)} text={narrow ? 'F_A' : tx.floorTag('A', fmt(EA, 0, dec))} color={COL.friction} size={fs} anchor={narrow ? 'end' : 'start'} />
        </>
      )}
      {started && EB > 0.5 && (
        <>
          <ForceArrow x={fxB} y={gy - 3} dx={EB * kF} dy={0} color={COL.friction} dot={COL.b2} width={narrow ? 2.6 : 3.2} head={narrow ? 9 : 11} />
          <Tag x={fxB + EB * kF + 4} y={gy + (narrow ? 14 : 18)} text={narrow ? 'F_B' : tx.floorTag('B', fmt(EB, 0, dec))} color={COL.friction} size={fs} anchor={narrow ? 'start' : 'end'} />
        </>
      )}

      {/* motion of the whole system */}
      {!narrow && Math.abs(a) > 0.004 && (
        <>
          <ForceArrow x={hook} y={view.sy(1.8)} dx={a * M_PER_A * k} dy={0} color={COL.acc} width={3} head={10} />
          <Tag x={hook + a * M_PER_A * k + Math.sign(a) * 5} y={view.sy(1.8) + 5} text={narrow ? 'a' : tx.aTag(fmtt(Math.abs(a), 2, dec))} color={COL.acc} size={fs} anchor={a > 0 ? 'start' : 'end'} />
        </>
      )}
      {!narrow && Math.abs(sim.V) > 0.01 && (
        <>
          <ForceArrow x={hook} y={view.sy(2.05)} dx={sim.V * M_PER_V * k} dy={0} color={COL.vel} width={3} head={10} />
          <Tag x={hook + sim.V * M_PER_V * k + Math.sign(sim.V) * 5} y={view.sy(2.05) + 5} text={narrow ? 'v' : tx.vTag(fmt(Math.abs(sim.V), 2, dec))} color={COL.vel} size={fs} anchor={sim.V > 0 ? 'start' : 'end'} />
        </>
      )}
      {sim.winner && <RichPill x={view.sx(sim.winner === 'B' ? WIN : -WIN)} y={view.sy(0.38)} text={tx.winTag(sim.winner)} bg={sim.winner === 'B' ? COL.b2 : COL.b1} size={fs + 1} weight={700} box={box} />}

      <ScaleBar x={narrow ? 12 : W - 22 - 100 * kF} y={narrow ? 34 : 72} len={100 * kF} color={COL.force} text={`100 ${N}`} size={narrow ? 10 : 11} />
    </g>
  );
}
