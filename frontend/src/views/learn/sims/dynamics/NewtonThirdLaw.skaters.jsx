import { useState } from 'react';
import { Equal, Lightbulb, Scale, Users } from 'lucide-react';
import { Explain, RangeField, Readout, clamp, fmt, useRafLoop } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import { COL, ForceArrow, Panel, Person, PlayButtons, RichPill, ScaleBar, SimScene, Tag, TimeChip, Toolbar, fmtt, richWidth, shoulderOf } from './NewtonThirdLaw.parts';

/**
 * Two skaters on ice push each other apart with their palms. While they
 * push (Δt = 0.5 s) skater 1 acts on skater 2 with F₁₂ and skater 2 acts on
 * skater 1 with F₂₁ = −F₁₂: equal in size, opposite in direction, applied to
 * different bodies. Each force accelerates its own body, a = F/m, so the
 * lighter skater gets the larger acceleration and leaves faster:
 * a₁/a₂ = v₁/v₂ = m₂/m₁. After the push there is no force (ice friction is
 * neglected) and both glide uniformly. The push is shown 4× slower, the
 * glide in real time - the chip says which.
 */

const DT = 0.5; // s, how long the push lasts
const T_END = 4; // s
const SLOW = 4; // the push is shown this many times slower
const X0 = 0.32; // m, each skater's feet from the middle at the start
const F_MAX = 120; // N, slider maximum (and the force graph's range)
const BOX = { x0: -6.6, x1: 6.6, y0: -0.55, y1: 2.9 };
const PAD_WIDE = { l: 24, r: 24, t: 56, b: 30 };
const PAD_NARROW = { l: 10, r: 10, t: 44, b: 26 };
const M_PER_N = 1.5 / 120; // force arrows: 120 N ↔ 1.5 m of the scene
const M_PER_A = 0.3; // acceleration arrows: 1 m/s² ↔ 0.3 m
const M_PER_V = 0.7; // velocity arrows: 1 m/s ↔ 0.7 m

const PRESETS = [
  { id: 'pair', m1: 60, m2: 40, F: 120, icon: Users },
  { id: 'equal', m1: 50, m2: 50, F: 100, icon: Equal },
  { id: 'double', m1: 80, m2: 40, F: 120, icon: Scale },
];
const IDLE = { running: false, t: 0, done: false };

/** A heavier skater is drawn a little taller (1.45 m at 40 kg … 1.8 m at 100 kg). */
const heightOf = (m) => 1.45 + (0.35 * (m - 40)) / 60;

/** Distance and speed of a skater that is pushed with acceleration a for DT, then glides. */
function travel(a, t) {
  if (t <= DT) return { s: 0.5 * a * t * t, v: a * t };
  return { s: 0.5 * a * DT * DT + a * DT * (t - DT), v: a * DT };
}

export default function SkatersSim({ T }) {
  const tx = T.skaters;
  const dec = T.decimal;
  const [m1, setM1] = useState(60);
  const [m2, setM2] = useState(40);
  const [F, setF] = useState(120);
  const [sim, setSim] = useState(IDLE);

  const a1 = F / m1;
  const a2 = F / m2;
  const p1 = travel(a1, sim.t);
  const p2 = travel(a2, sim.t);
  const x1 = -X0 - p1.s;
  const x2 = X0 + p2.s;
  const started = sim.t > 0;
  const pushing = started && sim.t < DT;
  const preset = PRESETS.find((p) => p.m1 === m1 && p.m2 === m2 && p.F === F)?.id ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      let t = p.t;
      let rem = dt;
      if (t < DT) {
        const need = (DT - t) * SLOW;
        if (rem < need) {
          t += rem / SLOW;
          rem = 0;
        } else {
          t = DT;
          rem -= need;
        }
      }
      t += rem;
      if (t >= T_END) return { running: false, t: T_END, done: true };
      return { ...p, t };
    });
  });

  const pick = (id) => {
    const pr = PRESETS.find((x) => x.id === id);
    setM1(pr.m1);
    setM2(pr.m2);
    setF(pr.F);
    setSim(IDLE);
  };
  const change = (setter) => (v) => {
    setter(v);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (started && sim.t <= DT) key = 'push';
  else if (sim.t > DT) key = 'glide';
  const ex = tx.explain;
  const v1 = a1 * DT;
  const v2 = a2 * DT;
  let text = ex.idle;
  if (key === 'push') text = ex.push(fmt(F, 0, dec));
  else if (key === 'glide')
    text =
      m1 === m2
        ? ex.glideEqual(fmtt(v1, 2, dec))
        : ex.glideDiff(m1 < m2 ? tx.who1 : tx.who2, fmtt(Math.max(m1, m2) / Math.min(m1, m2), 2, dec), Math.max(m1, m2), Math.min(m1, m2));
  else if (key === 'done') text = ex.done(fmt(p1.s, 1, dec), fmt(p2.s, 1, dec), m2, m1);
  const tone = key === 'push' ? '#f87171' : key === 'idle' ? '#22d3ee' : '#34d399';

  /* ---- graphs (right is positive: the force on skater 1 and its velocity are negative) */
  const tNow = sim.t;
  const fPts = (sign) => {
    const pts = [{ x: 0, y: 0 }];
    if (tNow > 0) {
      pts.push({ x: 0, y: sign * F }, { x: Math.min(tNow, DT), y: sign * F });
      if (tNow > DT) pts.push({ x: DT, y: 0 }, { x: tNow, y: 0 });
    }
    return pts;
  };
  const vPts = (sign, a) => {
    const pts = [{ x: 0, y: 0 }];
    if (tNow > 0) {
      const tp = Math.min(tNow, DT);
      pts.push({ x: tp, y: sign * a * tp });
      if (tNow > DT) pts.push({ x: tNow, y: sign * a * DT });
    }
    return pts;
  };

  const legend = [
    { label: tx.legend.force, color: COL.force, kind: 'arrow' },
    { label: tx.legend.acc, color: COL.acc, kind: 'arrow' },
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
  ];
  const chipText = !started ? tx.chipIdle : sim.t < DT ? tx.chipPush : T.common.realTime;
  const chipShort = !started ? tx.chipIdleShort : sim.t < DT ? tx.chipPushShort : T.common.realTime;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={preset}
        onChange={pick}
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} done={sim.done} onToggle={toggle} onReset={reset} playLabel={tx.push} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={chipText} short={chipShort} />}
        ariaLabel={tx.sceneLabel(m1, m2, F, fmt(x1, 1, dec), fmt(x2, 1, dec))}
        height={(W, narrow) => {
          if (narrow) return clamp(W * 0.62, 210, 300);
          const k = (W - PAD_WIDE.l - PAD_WIDE.r) / (BOX.x1 - BOX.x0);
          return clamp((BOX.y1 - BOX.y0) * k + PAD_WIDE.t + PAD_WIDE.b, 320, 520);
        }}
      >
        {(W, H, narrow) => (
          <SkatersDrawing W={W} H={H} narrow={narrow} m1={m1} m2={m2} F={F} a1={a1} a2={a2} x1={x1} x2={x2} p1={p1} p2={p2} t={sim.t} tx={tx} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={key} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.force} symbol="F" value={fmt(F, 0, dec)} unit={T.common.N} accent={COL.force} textColor={COL.forceText} active={pushing} sub={tx.readouts.forceSub} />
        <Readout
          label={tx.readouts.a1}
          symbol="a₁"
          value={fmtt(a1, 2, dec)}
          unit={T.ms2}
          accent={COL.b1}
          textColor={COL.b1Text}
          sub={tx.readouts.aSub('₁', F, m1, fmt(p1.v, 2, dec))}
        />
        <Readout
          label={tx.readouts.a2}
          symbol="a₂"
          value={fmtt(a2, 2, dec)}
          unit={T.ms2}
          accent={COL.b2}
          textColor={COL.b2Text}
          sub={tx.readouts.aSub('₂', F, m2, fmt(p2.v, 2, dec))}
        />
        <Readout label={tx.readouts.ratio} symbol="v₂ : v₁" value={fmtt(m1 / m2, 2, dec)} accent={COL.vel} textColor={COL.velText} sub={tx.readouts.ratioSub(m1, m2, fmtt(v1, 2, dec), fmtt(v2, 2, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="n3-m1" label={tx.m1} symbol="m₁" min={40} max={100} step={5} value={m1} onChange={change(setM1)} accent={COL.b1} display={`${m1} ${T.common.kg}`} />
          <RangeField id="n3-m2" label={tx.m2} symbol="m₂" min={40} max={100} step={5} value={m2} onChange={change(setM2)} accent={COL.b2} display={`${m2} ${T.common.kg}`} />
          <RangeField
            id="n3-f"
            label={tx.F}
            symbol="F"
            min={20}
            max={F_MAX}
            step={10}
            value={F}
            onChange={change(setF)}
            accent={COL.force}
            display={`${F} ${T.common.N}`}
            hint={tx.FHint}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TimeGraph
              title={tx.graphF.title}
              ariaLabel={tx.graphF.label}
              series={[
                { id: 'f21', label: tx.graphF.s1, color: COL.b1Line, points: fPts(-1) },
                { id: 'f12', label: tx.graphF.s2, color: COL.b2Line, points: fPts(1) },
              ]}
              xMax={T_END}
              yMin={-F_MAX}
              yMax={F_MAX}
              xLabel={tx.graphF.x}
              yLabel={tx.graphF.y}
              marker={tNow}
              height={170}
              decimal={dec}
              note={tx.graphF.note}
            />
            <TimeGraph
              title={tx.graphV.title}
              ariaLabel={tx.graphV.label}
              series={[
                { id: 'v1', label: tx.graphV.s1, color: COL.b1Line, points: vPts(-1, a1) },
                { id: 'v2', label: tx.graphV.s2, color: COL.b2Line, points: vPts(1, a2) },
              ]}
              xMax={T_END}
              yMin={-2}
              yMax={2}
              xLabel={tx.graphV.x}
              yLabel={tx.graphV.y}
              marker={tNow}
              height={170}
              decimal={dec}
              note={tx.graphV.note}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function SkatersDrawing({ W, H, narrow, m1, m2, F, a1, a2, x1, x2, p1, p2, t, tx, T }) {
  const dec = T.decimal;
  const pad = narrow ? PAD_NARROW : PAD_WIDE;
  // on a phone the camera starts close and zooms out as the skaters glide apart
  const half = narrow ? clamp(Math.max(Math.abs(x1), Math.abs(x2)) + 1, 3.2, BOX.x1) : BOX.x1;
  const view = makeView({ ...BOX, x0: -half, x1: half }, W, H, pad);
  const k = view.k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const gy = view.sy(0);
  const h1 = heightOf(m1) * k;
  const h2 = heightOf(m2) * k;
  const started = t > 0;
  const pushing = started && t < DT;
  const after = t >= DT;

  // poses: leaning into the push, back to upright while gliding
  const b = after ? clamp((t - DT) / 0.35, 0, 1) : 0;
  const lean = -0.1 + 0.12 * b;
  const pose1 = { fx: view.sx(x1), fy: gy, h: h1, dir: 1, lean };
  const pose2 = { fx: view.sx(x2), fy: gy, h: h2, dir: -1, lean };
  const s1 = shoulderOf(pose1);
  const s2 = shoulderOf(pose2);
  const r1 = 0.4 * h1;
  const r2 = 0.4 * h2;
  const contact = { x: s1.x + ((s2.x - s1.x) * r1) / (r1 + r2), y: (s1.y + s2.y) / 2 + 0.1 * Math.min(h1, h2) };
  const rest = (s, h, dir) => ({ x: s.x + dir * 0.2 * h, y: s.y + 0.28 * h });
  const mix = (p, q) => ({ x: p.x + (q.x - p.x) * b, y: p.y + (q.y - p.y) * b });
  const hand1 = mix(contact, rest(s1, h1, 1));
  const hand2 = mix(contact, rest(s2, h2, -1));

  // torso centre (point of application of the push on each body)
  const torso = (pose) => ({ x: pose.fx - pose.dir * Math.sin(pose.lean) * 0.62 * pose.h, y: pose.fy - Math.cos(pose.lean) * 0.62 * pose.h });
  const c1 = torso(pose1);
  const c2 = torso(pose2);
  const kF = M_PER_N * k;
  const kA = M_PER_A * k;
  const kV = M_PER_V * k;
  const lenF = F * kF;
  const hipY1 = gy - 0.38 * h1;
  const hipY2 = gy - 0.38 * h2;
  const vY1 = gy - h1 - (narrow ? 10 : 0.5 * k);
  const vY2 = gy - h2 - (narrow ? 10 : 0.5 * k);
  const L1 = p1.v * kV;
  const L2 = p2.v * kV;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} />
      {/* ice */}
      <rect x={0} y={gy} width={W} height={Math.max(8, 0.3 * k)} fill="#e0f2fe" />
      <line x1={0} x2={W} y1={gy} y2={gy} stroke="#7dd3fc" strokeWidth="2" />
      {/* skate tracks */}
      {started && (
        <>
          <line x1={view.sx(-X0)} x2={view.sx(x1)} y1={gy + 4} y2={gy + 4} stroke={COL.b1} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 4" />
          <line x1={view.sx(X0)} x2={view.sx(x2)} y1={gy + 4} y2={gy + 4} stroke={COL.b2} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 4" />
        </>
      )}
      <AxisNumbers view={view} W={W} H={H} xUnit={T.common.axisX} showY={false} decimal={dec} />
      {/* starting place */}
      <line x1={view.sx(0)} x2={view.sx(0)} y1={gy} y2={view.sy(2.45)} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />
      {!narrow && (
        <text x={view.sx(0)} y={view.sy(2.45) - 6} textAnchor="middle" fontSize={11} fill={COL.muted}>
          {tx.centre}
        </text>
      )}

      {/* distances after the push */}
      {after && !narrow && (
        <>
          <Dim xa={view.sx(-X0)} xb={view.sx(x1)} y={gy + 0.17 * k} color={COL.b1} text={tx.sTag('₁', fmt(p1.s, 1, dec))} fs={fs - 1} box={box} />
          <Dim xa={view.sx(X0)} xb={view.sx(x2)} y={gy + 0.17 * k} color={COL.b2} text={tx.sTag('₂', fmt(p2.s, 1, dec))} fs={fs - 1} box={box} />
        </>
      )}

      {/* skaters */}
      <Person {...pose1} hand={hand1} color={COL.b1} bulk={0.85 + 0.35 * ((m1 - 40) / 60)} skates />
      <Person {...pose2} hand={hand2} color={COL.b2} bulk={0.85 + 0.35 * ((m2 - 40) / 60)} skates />
      {pushing && <circle cx={contact.x} cy={contact.y} r={narrow ? 5 : 8} fill="#facc15" className="cl-pulse" />}

      {/* mass labels, pushed outwards so the two never overlap */}
      {!narrow && (
        <>
          <RichPill x={pose1.fx + 8 - richWidth(tx.massTag('₁', m1), fs) / 2 - 8} y={gy - h1 - 0.22 * k} text={tx.massTag('₁', m1)} bg="#fff" color={COL.b1} border="#bfdbfe" size={fs} box={box} />
          <RichPill x={pose2.fx - 8 + richWidth(tx.massTag('₂', m2), fs) / 2 + 8} y={gy - h2 - 0.22 * k} text={tx.massTag('₂', m2)} bg="#fff" color={COL.b2} border="#fbcfe8" size={fs} box={box} />
        </>
      )}

      {/* the pair of forces while they push */}
      {pushing && (
        <>
          <ForceArrow x={c1.x} y={c1.y} dx={-lenF} dy={0} color={COL.force} dot={COL.b1} width={narrow ? 3 : 4} head={narrow ? 10 : 14} />
          <ForceArrow x={c2.x} y={c2.y} dx={lenF} dy={0} color={COL.force} dot={COL.b2} width={narrow ? 3 : 4} head={narrow ? 10 : 14} />
          {narrow ? (
            <>
              <Tag x={c1.x - lenF - 4} y={c1.y + 4} text="F₂₁" color={COL.force} size={fs} anchor="end" />
              <Tag x={c2.x + lenF + 4} y={c2.y + 4} text="F₁₂" color={COL.force} size={fs} anchor="start" />
            </>
          ) : (
            <>
              <RichPill x={c1.x - lenF / 2 - 6} y={c1.y - 18} text={tx.fTag('F₂₁', F)} bg={COL.force} size={fs} box={box} />
              <RichPill x={c2.x + lenF / 2 + 6} y={c2.y - 18} text={tx.fTag('F₁₂', F)} bg={COL.force} size={fs} box={box} />
            </>
          )}
          <ForceArrow x={pose1.fx} y={hipY1} dx={-a1 * kA} dy={0} color={COL.acc} width={narrow ? 2.5 : 3} head={narrow ? 8 : 11} />
          <ForceArrow x={pose2.fx} y={hipY2} dx={a2 * kA} dy={0} color={COL.acc} width={narrow ? 2.5 : 3} head={narrow ? 8 : 11} />
          <Tag x={pose1.fx - a1 * kA - 4} y={hipY1 + 5} text={narrow ? 'a₁' : tx.aTag('₁', fmtt(a1, 2, dec))} color={COL.acc} size={fs} anchor="end" />
          <Tag x={pose2.fx + a2 * kA + 4} y={hipY2 + 5} text={narrow ? 'a₂' : tx.aTag('₂', fmtt(a2, 2, dec))} color={COL.acc} size={fs} anchor="start" />
        </>
      )}

      {/* velocities: arrows centred over each skater */}
      {started && L1 > 4 && <VelArrow cx={pose1.fx} y={vY1} L={L1} dir={-1} narrow={narrow} sym="v₁" text={tx.vTag('₁', fmt(p1.v, 2, dec))} fs={fs} box={box} crowded={pose2.fx - pose1.fx < 260} />}
      {started && L2 > 4 && <VelArrow cx={pose2.fx} y={vY2} L={L2} dir={1} narrow={narrow} sym="v₂" text={tx.vTag('₂', fmt(p2.v, 2, dec))} fs={fs} box={box} crowded={pose2.fx - pose1.fx < 260} />}

      <ScaleBar x={narrow ? 14 : W - 24 - 50 * kF} y={narrow ? 34 : 72} len={50 * kF} color={COL.force} text={tx.scale(50)} size={narrow ? 10 : 11} />
    </g>
  );
}

/** A velocity arrow centred at cx; its value pill sits above it, or beside the tip when the skaters are close. */
function VelArrow({ cx, y, L, dir, narrow, sym, text, fs, box, crowded }) {
  const x0 = cx - (dir * L) / 2;
  const tip = cx + (dir * L) / 2;
  const w = richWidth(text, fs) + 16;
  return (
    <g>
      <ForceArrow x={x0} y={y} dx={dir * L} dy={0} color={COL.vel} width={narrow ? 2.5 : 3} head={narrow ? 8 : 11} />
      {narrow ? (
        <Tag x={tip + dir * 4} y={y + 5} text={sym} color={COL.vel} size={fs} anchor={dir > 0 ? 'start' : 'end'} />
      ) : crowded ? (
        <RichPill x={tip + dir * (w / 2 + 6)} y={y} text={text} bg={COL.vel} size={fs} box={box} />
      ) : (
        <RichPill x={cx} y={y - 17} text={text} bg={COL.vel} size={fs} box={box} />
      )}
    </g>
  );
}

/** A distance mark on the ice: |←— s —→| between two x positions. */
function Dim({ xa, xb, y, color, text, fs, box }) {
  if (Math.abs(xb - xa) < 30) return null;
  return (
    <g pointerEvents="none">
      <line x1={xa} x2={xb} y1={y} y2={y} stroke={color} strokeWidth="1.5" />
      <line x1={xa} x2={xa} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="1.5" />
      <line x1={xb} x2={xb} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="1.5" />
      <RichPill x={(xa + xb) / 2} y={y} text={text} bg="#fff" color={color} border={color} size={fs} box={box} />
    </g>
  );
}
