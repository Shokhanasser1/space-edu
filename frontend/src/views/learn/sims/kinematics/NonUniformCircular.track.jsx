import { useState } from 'react';
import { CircleDot, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, TimeGraph, makeView } from '../kit/scene';
import { Panel, PlayButtons, RichPill, SimScene, Tag, TimeChip, Toolbar, arcD, num, rich, stepText } from './NonUniformCircular.parts';

/**
 * A car on a circular track whose speed changes at a constant rate a_τ
 * (until it reaches the 20 m/s limit or stops). At every moment
 *   a_τ = Δv/Δt (along ±v),  a_n = v²/R (to the centre),
 *   a = √(a_τ² + a_n²),  β = angle between a and v = atan2(a_n, a_τ),
 * so the total acceleration leans forward (β < 90°) when speeding up and
 * backward (β > 90°) when braking. Real time; v(t) is drawn as it happens.
 */

export const COL = {
  v: PALETTE.vel,
  vText: PALETTE.velText,
  at: '#2563eb',
  atText: '#93c5fd',
  an: '#db2777',
  anText: '#f9a8d4',
  a: PALETTE.acc,
  aText: PALETTE.accText,
};
const VMAX = 20;
const PRESETS = [
  { id: 'speed', icon: TrendingUp, v0: 5, at: 1.5 },
  { id: 'brake', icon: TrendingDown, v0: 20, at: -2 },
  { id: 'uniform', icon: CircleDot, v0: 12, at: 0 },
];
const start = (v0) => ({ running: false, done: false, t: 0, s: 0, v: v0, limitAt: null, samples: [{ x: 0, y: v0 }] });

/** Angle between a and v in degrees (0…180), or null when there is no acceleration. */
export function betaDeg(at, an) {
  if (Math.abs(at) < 1e-9 && Math.abs(an) < 1e-9) return null;
  return (Math.atan2(an, at) * 180) / Math.PI;
}

export default function TrackSim({ T }) {
  const tx = T.track;
  const dec = T.decimal;
  const [preset, setPreset] = useState('speed');
  const [R, setR] = useState(50);
  const [v0, setV0] = useState(5);
  const [at, setAt] = useState(1.5);
  const [sim, setSim] = useState(() => start(5));

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const atEff = (p.v >= VMAX - 1e-9 && at > 0) || (p.v <= 1e-9 && at < 0) ? 0 : at;
      const vNew = clamp(p.v + atEff * dt, 0, VMAX);
      const t = p.t + dt;
      const s = p.s + ((p.v + vNew) / 2) * dt;
      let limitAt = p.limitAt;
      if (limitAt === null && at > 0 && vNew >= VMAX - 1e-9) limitAt = t;
      let done = false;
      if (at < 0 && vNew <= 1e-9) done = true;
      if (limitAt !== null && t - limitAt >= 4) done = true;
      if (Math.abs(at) < 1e-9 && t >= 12) done = true;
      if (t >= 24) done = true;
      const last = p.samples[p.samples.length - 1];
      const samples = done || t - last.x >= 0.05 ? [...p.samples, { x: t, y: vNew }] : p.samples;
      return { ...p, t, s, v: vNew, limitAt, done, running: !done, samples };
    });
  });

  const started = sim.t > 0;
  const toggle = () => {
    if (sim.done) setSim({ ...start(v0), running: true });
    else if (v0 < 1e-9 && Math.abs(at) < 1e-9) setSim(start(v0));
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(start(v0));
  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setV0(p.v0);
    setAt(p.at);
    setSim(start(p.v0));
  };
  const changeR = (x) => {
    setR(x);
    setSim(start(v0));
  };
  const changeV0 = (x) => {
    setV0(x);
    setPreset(null);
    setSim(start(x));
  };
  const changeAt = (x) => {
    setAt(x);
    setPreset(null);
    setSim(start(v0));
  };

  /* ---- the present moment */
  const v = sim.v;
  const atNow = (v >= VMAX - 1e-9 && at > 0) || (v <= 1e-9 && at < 0 && started) ? 0 : at;
  const an = (v * v) / R;
  const a = Math.hypot(atNow, an);
  const beta = betaDeg(atNow, an);
  const B = beta === null ? '—' : fmt(beta, 0, dec);

  /* ---- explanation */
  let key = 'idle';
  if (v0 < 1e-9 && Math.abs(at) < 1e-9) key = 'still';
  else if (started) {
    if (sim.done && at < 0) key = 'stopped';
    else if (sim.limitAt !== null) key = 'limit';
    else if (v < 0.8 && atNow > 0) key = 'start';
    else if (atNow > 0) key = 'speed';
    else if (atNow < 0) key = 'brake';
    else key = 'uniform';
  }
  const settled = useSettled(key, key === 'idle' ? 0 : 250);
  const ex = tx.explain;
  const text = {
    idle: ex.idle,
    still: ex.still,
    stopped: ex.stopped,
    limit: ex.limit(num(an, dec)),
    start: ex.start(fmt(at, 1, dec)),
    speed: ex.speed(B),
    brake: ex.brake(B),
    uniform: ex.uniform(num(an, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', still: '#94a3b8', stopped: '#94a3b8', limit: '#34d399', start: COL.atText, speed: '#60a5fa', brake: '#f472b6', uniform: '#34d399' }[settled];

  /* ---- graph range */
  let tEnd = 12;
  if (at > 0) tEnd = Math.min(24, Math.max(0, (VMAX - v0) / at) + 4);
  else if (at < 0) tEnd = Math.max(1, v0 / -at);
  const xMax = Math.max(2, Math.ceil(tEnd / 2) * 2);

  const legend = [
    { label: tx.legend.v, color: COL.v, kind: 'arrow' },
    { label: tx.legend.at, color: COL.at, kind: 'arrow' },
    { label: tx.legend.an, color: COL.an, kind: 'arrow' },
    { label: tx.legend.a, color: COL.a, kind: 'arrow' },
  ];
  const atSub = Math.abs(atNow) < 1e-9 ? tx.readouts.atZero : atNow > 0 ? tx.readouts.atAlong : tx.readouts.atAgainst;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={preset}
        onChange={pick}
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: rich(tx.presets[p.id].sub), icon: p.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} done={sim.done} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TrackChip T={T} R={R} />}
        ariaLabel={tx.sceneLabel(fmt(v, 1, dec), num(a, dec), B)}
        height={(W, narrow) => (narrow ? W * 1.62 : clamp(W * 0.42, 430, 500))}
      >
        {(W, H, narrow) => <TrackDrawing W={W} H={H} narrow={narrow} R={R} s={sim.s} v={v} at={atNow} an={an} beta={beta} started={started} tx={tx} dec={dec} unitM={T.m} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.v} symbol="v" value={fmt(v, 1, dec)} unit={T.ms} accent={COL.v} textColor={COL.vText} sub={tx.readouts.vSub(fmt(v * 3.6, 0, dec))} />
        <Readout label={tx.readouts.at} symbol={rich('a_τ')} value={fmt(atNow, 1, dec)} unit={T.ms2} accent={COL.at} textColor={COL.atText} sub={rich(atSub)} />
        <Readout label={tx.readouts.an} symbol={rich('a_n')} value={num(an, dec)} unit={T.ms2} accent={COL.an} textColor={COL.anText} sub={rich(tx.readouts.anSub)} />
        <Readout label={tx.readouts.a} symbol="a" value={num(a, dec)} unit={T.ms2} accent={COL.a} textColor={COL.aText} sub={rich(tx.readouts.aSub(B))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="nu-R" label={tx.R} symbol="R" min={25} max={100} step={5} value={R} onChange={changeR} accent="#a78bfa" display={`${R} ${T.m}`} />
          <RangeField id="nu-v0" label={tx.v0} symbol={rich('v_0')} min={0} max={20} step={0.5} value={v0} onChange={changeV0} accent={COL.v} display={`${fmt(v0, 1, dec)} ${T.ms}`} />
          <RangeField
            id="nu-at"
            label={tx.at}
            symbol={rich('a_τ')}
            min={-3}
            max={3}
            step={0.1}
            value={at}
            onChange={changeAt}
            accent={COL.at}
            display={`${at > 0 ? '+' : ''}${fmt(at, 1, dec)} ${T.ms2}`}
            valueText={`${fmt(at, 1, dec)} ${T.ms2}`}
            hint={tx.atHint}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={tx.graph.title}
            series={[{ id: 'v', label: tx.graph.series, color: '#34d399', points: sim.samples }]}
            xMax={xMax}
            yMax={VMAX}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            marker={sim.t}
            decimal={dec}
            note={rich(tx.graph.note)}
          />
        </Panel>
      </div>
    </div>
  );
}

function TrackChip({ T, R }) {
  const step = R <= 40 ? 5 : R <= 80 ? 10 : 20;
  return <TimeChip text={T.common.realTime} extra={T.common.cell(`${stepText(step, T.decimal)} ${T.m}`)} />;
}

/* ----------------------------------------------------------------- scene */

/** Velocity and acceleration arrows from (x, y): t = unit direction of motion, i = unit direction to the centre (screen). */
function Vectors({ x, y, t, i, Lv, Lt, Ln, fs, carR, tags = true }) {
  const tip = { x: x + t.x * Lt + i.x * Ln, y: y + t.y * Lt + i.y * Ln };
  const La = Math.hypot(tip.x - x, tip.y - y);
  const o = (L) => Math.max(0, Math.min(carR, L - 6));
  return (
    <g>
      {Math.abs(Lt) > 3 && Ln > 3 && (
        <g stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4">
          <line x1={x + t.x * Lt} y1={y + t.y * Lt} x2={tip.x} y2={tip.y} />
          <line x1={x + i.x * Ln} y1={y + i.y * Ln} x2={tip.x} y2={tip.y} />
        </g>
      )}
      {Lv > 4 && <Arrow x1={x + t.x * o(Lv)} y1={y + t.y * o(Lv)} x2={x + t.x * Lv} y2={y + t.y * Lv} color={COL.v} width={3.4} head={12} />}
      {Math.abs(Lt) > 4 && <Arrow x1={x} y1={y} x2={x + t.x * Lt} y2={y + t.y * Lt} color={COL.at} width={3} head={11} />}
      {Ln > 4 && <Arrow x1={x} y1={y} x2={x + i.x * Ln} y2={y + i.y * Ln} color={COL.an} width={3} head={11} />}
      {La > 4 && <Arrow x1={x} y1={y} x2={tip.x} y2={tip.y} color={COL.a} width={4} head={13} />}
      {tags && Lv > 4 && <Tag x={x + t.x * (Lv + 14)} y={y + t.y * (Lv + 14) + 5} text="v" color={COL.v} size={fs + 3} />}
      {tags && Math.abs(Lt) > 18 && <Tag x={x + t.x * Lt - i.x * 14} y={y + t.y * Lt - i.y * 14 + 5} text="a_τ" color={COL.at} size={fs + 2} />}
      {tags && Ln > 18 && <Tag x={x + i.x * Ln - t.x * 16} y={y + i.y * Ln - t.y * 16 + 5} text="a_n" color={COL.an} size={fs + 2} />}
      {tags && La > 14 && <Tag x={tip.x + ((tip.x - x) / La) * 14} y={tip.y + ((tip.y - y) / La) * 14 + 5} text="a" color={COL.a} size={fs + 3} />}
    </g>
  );
}

function Car({ x, y, deg, L, Wd }) {
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(2)})`}>
      <rect x={-Wd / 2} y={-L / 2} width={Wd} height={L} rx={Wd * 0.35} fill="#334155" stroke="#0f172a" strokeWidth="1.2" />
      <rect x={-Wd / 2 + Wd * 0.14} y={-L * 0.3} width={Wd * 0.72} height={L * 0.2} rx={2} fill="#cbd5e1" />
      <rect x={-Wd / 2 + Wd * 0.14} y={L * 0.18} width={Wd * 0.72} height={L * 0.14} rx={2} fill="#cbd5e1" />
    </g>
  );
}

function TrackDrawing({ W, H, narrow, R, s, v, at, an, beta, started, tx, dec, unitM }) {
  const Lw = narrow ? W : W * 0.6;
  const Ht = narrow ? W * 0.92 : H;
  const pad = narrow ? { l: 12, r: 12, t: 44, b: 10 } : { l: 26, r: 10, t: 60, b: 16 };
  const m = 1.2 * R;
  const view = makeView({ x0: -m, x1: m, y0: -m, y1: m }, Lw, Ht, pad);
  const k = view.k;
  const cx = view.sx(0);
  const cy = view.sy(0);
  const Rp = R * k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const step = R <= 40 ? 5 : R <= 80 ? 10 : 20;

  // the car runs counter-clockwise from the bottom of the track
  const phi = -Math.PI / 2 + s / R;
  const px = cx + Rp * Math.cos(phi);
  const py = cy - Rp * Math.sin(phi);
  const t = { x: -Math.sin(phi), y: -Math.cos(phi) }; // screen direction of motion
  const i = { x: -Math.cos(phi), y: Math.sin(phi) }; // screen direction to the centre
  const aRef = Math.max(3, (VMAX * VMAX) / R); // the largest a_n on this track

  const road = Math.max(8 * k, 20);
  const carL = Math.max(4.6 * k, narrow ? 24 : 30);
  const carW = Math.max(1.9 * k, narrow ? 12 : 15);
  const deg = (-phi * 180) / Math.PI;
  const travelled = Math.min(s / R, Math.PI * 2 - 0.01);

  // magnified view of the car and its vectors
  const bx = narrow ? 12 : Lw + 6;
  const by = narrow ? Ht + 4 : 64;
  const bw = narrow ? W - 24 : W - Lw - 18;
  const bh = narrow ? H - Ht - 14 : H - by - 18;
  const C = { x: bx + bw / 2, y: by + bh / 2 + 6 };
  const S = 0.44 * Math.min(bw, bh - 50);
  // directions matter here: the total acceleration is always drawn the same length
  const aNow = Math.hypot(at, an);
  const kAi = aNow > 1e-9 ? (0.8 * S) / aNow : 0;
  const zl = { Lv: (v / VMAX) * S, Lt: at * kAi, Ln: an * kAi };
  const tip = { x: C.x + t.x * zl.Lt + i.x * zl.Ln, y: C.y + t.y * zl.Lt + i.y * zl.Ln };
  const vAng = Math.atan2(-t.y, t.x);
  const aAng = Math.atan2(-(tip.y - C.y), tip.x - C.x);
  let dAng = aAng - vAng;
  while (dAng > Math.PI) dAng -= Math.PI * 2;
  while (dAng < -Math.PI) dAng += Math.PI * 2;
  const showBeta = beta !== null && Math.hypot(tip.x - C.x, tip.y - C.y) > 40 && zl.Lv > 40;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={Math.max(12, step * k * 0.99)} />

      {/* the track */}
      <circle cx={cx} cy={cy} r={Rp + road / 2 + 4} fill="#e2e8f0" />
      <circle cx={cx} cy={cy} r={Rp} fill="none" stroke="#9ca3af" strokeWidth={road} />
      <circle cx={cx} cy={cy} r={Rp - road / 2} fill="#dcfce7" stroke="#fff" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={Rp + road / 2} fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={Rp} fill="none" stroke={PALETTE.path} strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="6 7" />
      {travelled > 0.02 && <path d={arcD(cx, cy, Rp, -Math.PI / 2, -Math.PI / 2 + travelled)} fill="none" stroke={PALETTE.path} strokeWidth="3" strokeLinecap="round" opacity="0.8" />}
      <line x1={cx} y1={cy + Rp - road / 2} x2={cx} y2={cy + Rp + road / 2} stroke="#fff" strokeWidth="3" />
      <line x1={cx} y1={cy + Rp - road / 2} x2={cx} y2={cy + Rp + road / 2} stroke="#0f172a" strokeWidth="1" strokeDasharray="2 2" />
      <line x1={cx} y1={cy} x2={cx - Rp * 0.7071} y2={cy - Rp * 0.7071} stroke="#64748b" strokeWidth="1" strokeDasharray="3 4" />
      <circle cx={cx} cy={cy} r={4} fill="#0f172a" />
      <Tag x={cx + 10} y={cy + 16} text="O" color="#0f172a" size={fs} italic={false} anchor="start" />
      <RichPill x={cx - Rp * 0.36} y={cy - Rp * 0.36 - 14} text={`R = ${R} ${unitM}`} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs - 1} box={box} />

      <Car x={px} y={py} deg={deg} L={carL} Wd={carW} />
      <Vectors x={px} y={py} t={t} i={i} Lv={(v / VMAX) * 0.85 * Rp} Lt={(at / aRef) * 0.85 * Rp} Ln={(an / aRef) * 0.85 * Rp} fs={fs} carR={carL / 2} tags={!narrow} />

      {/* magnified view */}
      <rect x={bx} y={by} width={bw} height={bh} rx="14" fill="#ffffff" stroke="#e2e8f0" />
      <text x={bx + 14} y={by + 22} fontSize={fs + 1} fontWeight="700" fill="#0f172a">
        {tx.zoom}
      </text>
      <Car x={C.x} y={C.y} deg={deg} L={narrow ? 34 : 42} Wd={narrow ? 17 : 21} />
      {showBeta && <path d={arcD(C.x, C.y, 30, vAng, vAng + dAng)} fill="none" stroke="#475569" strokeWidth="1.6" />}
      <Vectors x={C.x} y={C.y} t={t} i={i} Lv={zl.Lv} Lt={zl.Lt} Ln={zl.Ln} fs={fs} carR={narrow ? 17 : 21} />
      {beta !== null && (started || v > 0) && (
        <RichPill x={bx + bw - 54} y={by + 22} text={tx.betaTag(fmt(beta, 0, dec))} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs} box={box} />
      )}
      {(narrow ? tx.zoomNote.split('; ') : [tx.zoomNote]).map((line, j, all) => (
        <text key={j} x={bx + 14} y={by + bh - 12 - (all.length - 1 - j) * (fs + 3)} fontSize={fs - 1} fill={PALETTE.muted}>
          {line}
        </text>
      ))}
    </g>
  );
}
