import { useState } from 'react';
import { Lightbulb, MoveHorizontal, Shuffle } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { Calc, Panel, PlayButtons, RichPill, SimScene, SpinArrow, Tag, TimeChip, Toolbar, num, numt, timeWords } from './RotationTransmission.parts';
import { TAU, beltLoop, slowScale } from './RotationTransmission.geometry';

/**
 * Belt drive: a motor turns pulley 1 at frequency n₁; a belt that does not
 * slip carries the motion to pulley 2. Every point of the belt, and every
 * point on both rims, moves at the same speed v = ω₁R₁ = ω₂R₂, so
 * n₂ = n₁·R₁/R₂ and the gear ratio is i = n₁/n₂ = R₂/R₁. A crossed belt
 * reverses pulley 2. The turn counters show N₁/N₂ = R₂/R₁. Fast set-ups are
 * shown slowed down (the chip says by how much).
 */

const D = 0.9; // m, distance between the axles
const C1 = { x: 0, y: 0 };
const C2 = { x: D, y: 0 };
const BOX = { x0: -0.3, x1: D + 0.3, y0: -0.45, y1: 0.31 };
const COL = { p1: '#0891b2', p1Text: '#a5f3fc', p2: '#db2777', p2Text: '#f9a8d4', belt: '#1f2937' };
const IDLE = { running: false, a1: 0, a2: 0, s: 0, t: 0, n1: 0, n2: 0 };

export default function BeltSim({ T }) {
  const tx = T.belt;
  const dec = T.decimal;
  const [crossed, setCrossed] = useState(false);
  const [r1cm, setR1] = useState(10);
  const [r2cm, setR2] = useState(20);
  const [nu1, setNu1] = useState(1);
  const [sim, setSim] = useState(IDLE);

  const R1 = r1cm / 100;
  const R2 = r2cm / 100;
  const w1 = TAU * nu1;
  const v = w1 * R1;
  const w2 = v / R2;
  const nu2 = w2 / TAU;
  const ratio = nu1 / nu2; // = R2 / R1
  const scale = slowScale(Math.max(nu1, nu2));
  const dir2 = crossed ? 1 : -1; // world angle direction of pulley 2 (pulley 1 turns clockwise: −1)

  useRafLoop(sim.running, (dt) => {
    const d = dt * scale;
    setSim((p) =>
      p.running ? { ...p, a1: p.a1 - w1 * d, a2: p.a2 + dir2 * w2 * d, s: p.s + v * d, t: p.t + d, n1: p.n1 + nu1 * d, n2: p.n2 + nu2 * d } : p,
    );
  });

  const started = sim.t > 0;
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim(IDLE);
  // a new set-up starts the turn counters again (the wheels keep their place)
  const restartCount = () => setSim((p) => ({ ...p, n1: 0, n2: 0 }));
  const change = (setter) => (x) => {
    setter(x);
    restartCount();
  };

  /* ---- explanation: the main rule, then the turn count once the slower pulley has made a whole turn */
  const whole = Math.floor(Math.min(sim.n1, sim.n2) + 1e-9);
  const sameSize = r1cm === r2cm;
  let key = 'idle';
  if (started) key = sameSize ? 'same' : r2cm > r1cm ? 'down' : 'up';
  const settled = useSettled(key, key === 'idle' ? 0 : 200);
  const ex = tx.explain;
  let text;
  if (settled === 'down') text = ex.down(numt(ratio, dec), num(nu2, dec));
  else if (settled === 'up') text = ex.up(numt(1 / ratio, dec), num(nu2, dec));
  else if (settled === 'same') text = ex.same;
  else text = ex.idle;
  if (settled !== 'idle' && !sameSize && whole >= 1) {
    const nFast = whole * (r2cm > r1cm ? ratio : 1 / ratio);
    text += ` ${r2cm > r1cm ? ex.count(numt(nFast, dec), whole, numt(ratio, dec)) : ex.count(whole, numt(nFast, dec), numt(ratio, dec))}`;
  }
  if (crossed && settled !== 'idle') text = `${text} ${ex.crossed}`;
  const tone = settled === 'idle' ? '#22d3ee' : crossed ? '#f472b6' : whole >= 1 ? '#34d399' : '#22d3ee';

  const counter = (
    <div className="space-y-0.5 tabular-nums">
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ color: COL.p1 }}>N₁</span>
        <span className="font-semibold">{fmt(sim.n1, 1, dec)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ color: COL.p2 }}>N₂</span>
        <span className="font-semibold">{fmt(sim.n2, 1, dec)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-current/10 pt-0.5 opacity-80">
        <span>{tx.counter.ratio('')}</span>
        <span className="font-semibold">{sim.n2 > 0.05 ? fmt(sim.n1 / sim.n2, 2, dec) : '—'}</span>
      </div>
    </div>
  );

  const legend = [
    { label: tx.legend.belt, color: COL.belt, kind: 'line' },
    { label: tx.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: tx.legend.mark, color: COL.p2, kind: 'dot' },
  ];
  const f2 = (x) => fmt(x, 2, dec);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.typeLabel}
        value={crossed ? 'crossed' : 'open'}
        onChange={(x) => {
          setCrossed(x === 'crossed');
          restartCount();
        }}
        cols="grid-cols-2"
        accent={crossed ? '#f472b6' : '#22d3ee'}
        options={[
          { value: 'open', label: tx.types.open.name, sub: tx.types.open.sub, icon: MoveHorizontal },
          { value: 'crossed', label: tx.types.crossed.name, sub: tx.types.crossed.sub, icon: Shuffle },
        ]}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={timeWords(T.common, scale, dec)} extra={T.common.cell(`10 ${T.common.cm}`)} />}
        ariaLabel={tx.sceneLabel(r1cm, r2cm, f2(nu1), num(nu2, dec))}
        height={(W, narrow) => (narrow ? W * 0.8 : clamp(W * 0.36, 370, 430))}
        overlay={
          <div className="pointer-events-none absolute bottom-3 right-3 hidden w-[190px] rounded-xl border border-slate-200 bg-white/95 p-3 text-[13px] text-slate-700 shadow-sm xl:block">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{tx.counter.title}</p>
            {counter}
          </div>
        }
      >
        {(W, H, narrow) => (
          <BeltDrawing W={W} H={H} narrow={narrow} R1={R1} R2={R2} crossed={crossed} sim={sim} v={v} nu1={nu1} nu2={nu2} tx={tx} dec={dec} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={`${settled}-${crossed}`} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.p1} symbol="n₁" value={f2(nu1)} unit={T.hz} accent={COL.p1} textColor={COL.p1Text} sub={tx.readouts.omega(num(w1, dec), num(nu1 * 60, dec))} />
        <Readout label={tx.readouts.p2} symbol="n₂" value={num(nu2, dec)} unit={T.hz} accent={COL.p2} textColor={COL.p2Text} sub={tx.readouts.omega(num(w2, dec), num(nu2 * 60, dec))} />
        <Readout label={tx.readouts.v} symbol="v" value={num(v, dec)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={tx.readouts.vSub} />
        <Readout
          label={tx.readouts.i}
          symbol="i"
          value={numt(ratio, dec)}
          accent="#facc15"
          textColor="#fde68a"
          sub={`i = R₂/R₁ · ${sameSize ? tx.readouts.iSame : ratio > 1 ? tx.readouts.iDown : tx.readouts.iUp}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="belt-r1" label={tx.r1} symbol="R₁" min={5} max={25} step={1} value={r1cm} onChange={change(setR1)} accent={COL.p1} display={`${r1cm} ${T.common.cm}`} />
          <RangeField id="belt-r2" label={tx.r2} symbol="R₂" min={5} max={25} step={1} value={r2cm} onChange={change(setR2)} accent={COL.p2} display={`${r2cm} ${T.common.cm}`} />
          <RangeField
            id="belt-nu"
            label={tx.nu1}
            symbol="n₁"
            min={0.2}
            max={2}
            step={0.05}
            value={nu1}
            onChange={change(setNu1)}
            accent="#22d3ee"
            display={`${f2(nu1)} ${T.hz}`}
            hint={tx.nuHint(num(nu1 * 60, dec))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-200 xl:hidden">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{tx.counter.title}</p>
            {counter}
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <Calc
            title={tx.calc.title}
            rows={[
              { sym: 'v', color: PALETTE.velText, formula: 'ω₁R₁', subst: `${num(w1, dec)} ${T.rads} · ${f2(R1)} ${T.m}`, result: `${num(v, dec)} ${T.ms}` },
              { sym: 'ω₂', color: COL.p2Text, formula: 'v/R₂', subst: `${num(v, dec)} ${T.ms} / ${f2(R2)} ${T.m}`, result: `${num(w2, dec)} ${T.rads}` },
              { sym: 'n₂', color: COL.p2Text, formula: 'n₁·R₁/R₂', subst: `${f2(nu1)} ${T.hz} · ${r1cm} / ${r2cm}`, result: `${num(nu2, dec)} ${T.hz}` },
              { sym: 'i', color: '#fde68a', formula: 'n₁/n₂ = R₂/R₁', subst: `${r2cm} / ${r1cm}`, result: numt(ratio, dec) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

/** A pulley: grooved disc, spokes, hub and a coloured mark on the rim, turned by `a` (world radians). */
function Pulley({ cx, cy, r, a, color, spokes = 5 }) {
  const deg = (-a * 180) / Math.PI;
  const sw = Math.max(2, r * 0.07);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r * 0.84} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      <g transform={`rotate(${deg.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}>
        {Array.from({ length: spokes }, (_, i) => {
          const b = (i / spokes) * TAU;
          return <line key={i} x1={cx + r * 0.2 * Math.cos(b)} y1={cy - r * 0.2 * Math.sin(b)} x2={cx + r * 0.8 * Math.cos(b)} y2={cy - r * 0.8 * Math.sin(b)} stroke="#94a3b8" strokeWidth={sw} strokeLinecap="round" />;
        })}
        <circle cx={cx + r * 0.92} cy={cy} r={Math.max(3.5, r * 0.08)} fill={color} stroke="#fff" strokeWidth="1.5" />
      </g>
      <circle cx={cx} cy={cy} r={Math.max(4, r * 0.2)} fill="#64748b" />
      <circle cx={cx} cy={cy} r={2} fill="#0f172a" />
    </g>
  );
}

function BeltDrawing({ W, H, narrow, R1, R2, crossed, sim, v, nu1, nu2, tx, dec }) {
  const pad = narrow ? { l: 10, r: 10, t: 44, b: 8 } : { l: 30, r: 30, t: 58, b: 14 };
  const view = makeView(BOX, W, H, pad);
  const k = view.k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const loop = beltLoop(C1, R1, C2, R2, crossed);
  const bw = Math.max(5, 0.02 * k);
  const S = (p) => ({ x: view.sx(p.x), y: view.sy(p.y) });

  // belt polyline and moving marks
  const pts = [];
  const nS = 260;
  for (let i = 0; i <= nS; i += 1) {
    const p = S(loop.at((i / nS) * loop.length));
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  const nMarks = Math.max(12, Math.round(loop.length / 0.06));
  const marks = [];
  for (let i = 0; i < nMarks; i += 1) {
    const q = loop.at(sim.s + (i / nMarks) * loop.length);
    const p = S(q);
    const nx = -q.ty; // perpendicular on screen (y flipped)
    const ny = -q.tx;
    marks.push(<line key={i} x1={p.x + nx * bw * 0.45} y1={p.y + ny * bw * 0.45} x2={p.x - nx * bw * 0.45} y2={p.y - ny * bw * 0.45} stroke="#fbbf24" strokeWidth="2" />);
  }

  const c1 = S(C1);
  const c2 = S(C2);
  const r1 = R1 * k;
  const r2 = R2 * k;
  const kV = narrow ? 34 : 48; // px per m/s
  const Lv = clamp(v * kV, 14, narrow ? 80 : 120);
  const dir2 = crossed ? 1 : -1;

  // velocity of the rim mark: world direction dir·(−sin a, cos a), y flipped on screen
  const rimArrow = (c, r, a, dir) => {
    const mx = c.x + r * 0.92 * Math.cos(a);
    const my = c.y - r * 0.92 * Math.sin(a);
    return <Arrow x1={mx} y1={my} x2={mx - dir * Math.sin(a) * Lv} y2={my - dir * Math.cos(a) * Lv} color={PALETTE.vel} width={2.8} head={10} />;
  };

  // speed arrow and label beside the first run, on its upper side
  const run = loop.runs[0];
  const ra = S(run.a);
  const rb = S(run.b);
  const rl = Math.hypot(rb.x - ra.x, rb.y - ra.y) || 1;
  const ux = (rb.x - ra.x) / rl;
  const uy = (rb.y - ra.y) / rl;
  const n = uy <= 0 ? { x: uy, y: -ux } : { x: -uy, y: ux };
  const nUp = n.y <= 0 ? n : { x: -n.x, y: -n.y };
  const along = crossed ? 0.28 : 0.5;
  const mid = { x: ra.x + (rb.x - ra.x) * along, y: ra.y + (rb.y - ra.y) * along };
  const aStart = { x: mid.x - ux * Lv * 0.5 + nUp.x * 14, y: mid.y - uy * Lv * 0.5 + nUp.y * 14 };
  const aEnd = { x: mid.x + ux * Lv * 0.5 + nUp.x * 14, y: mid.y + uy * Lv * 0.5 + nUp.y * 14 };

  const label = (c, r, name, val, color, rAng) => (
    <g>
      <line x1={c.x} y1={c.y} x2={c.x + r * Math.cos(rAng)} y2={c.y - r * Math.sin(rAng)} stroke="#0f172a" strokeWidth="1.2" strokeDasharray="3 3" />
      <RichPill x={c.x} y={c.y + r + bw + (narrow ? 16 : 22)} text={name} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs - 1} box={box} />
      <RichPill x={c.x} y={c.y + r + bw + (narrow ? 38 : 48)} text={val} bg={color} size={fs} box={box} />
    </g>
  );

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={20} />
      {/* axle supports */}
      {[c1, c2].map((c, i) => (
        <path key={i} d={`M${c.x - 10},${c.y} L${c.x - 22},${H} L${c.x + 22},${H} L${c.x + 10},${c.y} Z`} fill="#e2e8f0" stroke="#cbd5e1" />
      ))}

      <Pulley cx={c1.x} cy={c1.y} r={r1} a={sim.a1} color={COL.p1} />
      <Pulley cx={c2.x} cy={c2.y} r={r2} a={sim.a2} color={COL.p2} />

      <polyline points={pts.join(' ')} fill="none" stroke={COL.belt} strokeWidth={bw} strokeLinejoin="round" />
      {marks}

      {r1 > 26 && <SpinArrow cx={c1.x} cy={c1.y} r={r1 * 0.55} from={(150 * Math.PI) / 180} span={1.5} dir={-1} color={COL.p1} width={2.4} head={8} />}
      {r2 > 26 && <SpinArrow cx={c2.x} cy={c2.y} r={r2 * 0.55} from={dir2 < 0 ? (150 * Math.PI) / 180 : (30 * Math.PI) / 180} span={1.5} dir={dir2} color={COL.p2} width={2.4} head={8} />}

      {rimArrow(c1, r1, sim.a1, -1)}
      {rimArrow(c2, r2, sim.a2, dir2)}

      <Arrow x1={aStart.x} y1={aStart.y} x2={aEnd.x} y2={aEnd.y} color={PALETTE.vel} width={3} head={11} />
      <RichPill x={mid.x + nUp.x * 36} y={mid.y + nUp.y * 36} text={tx.vTag(num(v, dec))} bg={PALETTE.vel} size={fs} box={box} />

      {label(c1, r1, tx.p1, tx.pTag(1, fmt(nu1, 2, dec)), COL.p1, (-135 * Math.PI) / 180)}
      {label(c2, r2, tx.p2, tx.pTag(2, num(nu2, dec)), COL.p2, (-45 * Math.PI) / 180)}
      <Tag x={c1.x + r1 * 0.55 * Math.cos((-135 * Math.PI) / 180) - 10} y={c1.y - r1 * 0.55 * Math.sin((-135 * Math.PI) / 180)} text="R_1" color="#0f172a" size={fs} anchor="end" />
      <Tag x={c2.x + r2 * 0.55 * Math.cos((-45 * Math.PI) / 180) + 10} y={c2.y - r2 * 0.55 * Math.sin((-45 * Math.PI) / 180)} text="R_2" color="#0f172a" size={fs} anchor="start" />
    </g>
  );
}
