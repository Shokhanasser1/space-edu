import { useMemo, useState } from 'react';
import { Gauge, Lightbulb, Mountain, ZoomIn, Building2 } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, makeView } from '../kit/scene';
import { Calc, Panel, PlayButtons, RichPill, SimScene, SpinArrow, TimeChip, Toolbar, num, numt, timeWords } from './RotationTransmission.parts';
import { TAU, beltLoop, gearOutline, slowScale } from './RotationTransmission.geometry';

/**
 * A bicycle: the pedals turn the chainring (z₁ teeth) at n₁ = n/60; the
 * chain moves the same number of teeth of each sprocket per second, so the
 * rear sprocket (z₂ teeth) turns at n₂ = n₁·z₁/z₂. The rear wheel sits on the
 * sprocket's axle: same ω₂, but its rim moves at ω₂R - the bike's speed when
 * the wheel rolls without slipping, v = 2πR·n₂. Defaults (44/16, 70 rpm,
 * R = 0.34 m) give 6.85 m/s ≈ 24.7 km/h. Chain pitch p = 12.7 mm, so a
 * sprocket's pitch radius is r = z·p/2π. Shown slowed down.
 */

const P = 0.0127; // m, chain pitch (½ inch)
const CRANK = 0.17; // m
const PRESETS = [
  { id: 'hill', icon: Mountain, z1: 32, z2: 28 },
  { id: 'city', icon: Building2, z1: 44, z2: 16 },
  { id: 'fast', icon: Gauge, z1: 52, z2: 11 },
];
const IDLE = { running: false, t: 0, aP: 0, aW: 0, x: 0, s: 0 };
const COL = { ring: '#0369a1', sprocket: '#be185d', chain: '#334155', frame: '#0f766e' };

export default function BikeSim({ T }) {
  const tx = T.bike;
  const dec = T.decimal;
  const [preset, setPreset] = useState('city');
  const [z1, setZ1] = useState(44);
  const [z2, setZ2] = useState(16);
  const [rpm, setRpm] = useState(70);
  const [R, setR] = useState(0.34);
  const [sim, setSim] = useState(IDLE);

  const nu1 = rpm / 60;
  const ratio = z1 / z2;
  const nu2 = nu1 * ratio;
  const w1 = TAU * nu1;
  const w2 = TAU * nu2;
  const v = w2 * R;
  const kmh = v * 3.6;
  const r1 = (z1 * P) / TAU;
  const r2 = (z2 * P) / TAU;
  const vc = w1 * r1; // chain speed = ω₂r₂ too
  const rollout = TAU * R * ratio;
  const scale = slowScale(nu2, 1);

  useRafLoop(sim.running, (dt) => {
    const d = dt * scale;
    setSim((p) => (p.running ? { ...p, t: p.t + d, aP: p.aP - w1 * d, aW: p.aW - w2 * d, x: p.x + v * d, s: p.s + vc * d } : p));
  });

  const started = sim.t > 0;
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setZ1(p.z1);
    setZ2(p.z2);
  };
  const setTeeth = (setter) => (x) => {
    setter(x);
    setPreset(null);
  };

  let key = 'idle';
  if (started) key = ratio < 1.6 ? 'low' : ratio > 3.6 ? 'high' : 'mid';
  const settled = useSettled(key, key === 'idle' ? 0 : 250);
  const ex = tx.explain;
  const K = numt(ratio, dec);
  const Sx = fmt(rollout, 2, dec);
  const Kmh = fmt(kmh, 1, dec);
  const text = { idle: ex.idle, low: ex.low(K, Sx), mid: ex.mid(K, Sx, Kmh), high: ex.high(K, Sx, Kmh) }[settled];
  const tone = { idle: '#22d3ee', low: '#34d399', mid: '#22d3ee', high: '#fb923c' }[settled];

  const legend = [
    { label: tx.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: tx.legend.chain, color: COL.chain, kind: 'line' },
    { label: tx.legend.mark, color: '#e11d48', kind: 'dot' },
  ];
  const vMax = Math.max(v, vc);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.gearsLabel}
        value={preset}
        onChange={pick}
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SimScene
            legend={legend}
            chip={<TimeChip text={timeWords(T.common, scale, dec)} />}
            ariaLabel={tx.sceneLabel(Kmh)}
            height={(W, narrow) => (narrow ? W * 0.72 : clamp(W * 0.6, 330, 420))}
          >
            {(W, H, narrow) => <BikeDrawing W={W} H={H} narrow={narrow} R={R} r1={r1} r2={r2} z1={z1} z2={z2} sim={sim} v={v} tx={tx} dec={dec} />}
          </SimScene>
        </div>
        <div className="lg:col-span-2">
          <SimScene
            chip={
              <>
                <ZoomIn size={14} className="text-cyan-600" aria-hidden="true" />
                <span className="font-medium">{tx.zoomTitle}</span>
              </>
            }
            ariaLabel={tx.zoomLabel(z1, z2)}
            height={(W) => (W < 400 ? W * 0.72 : clamp(W * 0.91, 330, 420))}
          >
            {(W, H, narrow) => <ZoomDrawing W={W} H={H} narrow={narrow} r1={r1} r2={r2} z1={z1} z2={z2} sim={sim} vc={vc} tx={tx} dec={dec} />}
          </SimScene>
        </div>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.cadence} symbol="n₁" value={fmt(rpm, 0, dec)} unit={T.common.rpm} accent={COL.ring} textColor="#7dd3fc" sub={tx.readouts.cadenceSub(fmt(nu1, 2, dec))} />
        <Readout label={tx.readouts.wheel} symbol="n₂" value={fmt(nu2, 2, dec)} unit={T.hz} accent={COL.sprocket} textColor="#f9a8d4" sub={tx.readouts.wheelSub(fmt(nu2 * 60, 0, dec))} />
        <Readout label={tx.readouts.ratio} symbol="z₁/z₂" value={`${z1}/${z2}`} accent="#facc15" textColor="#fde68a" sub={`= ${K} · ${tx.readouts.ratioSub(Sx)}`} />
        <Readout label={tx.readouts.speed} symbol="v" value={Kmh} unit={T.kmh} accent={PALETTE.vel} textColor={PALETTE.velText} sub={tx.readouts.speedSub(fmt(v, 2, dec))} active />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="bike-z1" label={tx.z1} symbol="z₁" min={22} max={52} step={1} value={z1} onChange={setTeeth(setZ1)} accent={COL.ring} display={String(z1)} />
          <RangeField id="bike-z2" label={tx.z2} symbol="z₂" min={11} max={34} step={1} value={z2} onChange={setTeeth(setZ2)} accent="#db2777" display={String(z2)} />
          <RangeField id="bike-n" label={tx.cadence} symbol="n₁" min={30} max={120} step={5} value={rpm} onChange={setRpm} accent="#22d3ee" display={`${rpm} ${T.common.rpm}`} hint={tx.cadenceHint} />
          <RangeField id="bike-r" label={tx.radius} symbol="R" min={0.25} max={0.36} step={0.01} value={R} onChange={setR} accent="#a78bfa" display={`${fmt(R, 2, dec)} ${T.m}`} hint={tx.radiusHint} />
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-200">{tx.axle.title}</p>
            <p className="text-xs text-gray-500">{tx.axle.omega(num(w2, dec))}</p>
            <div className="mt-2 space-y-2">
              {[
                [tx.axle.chain, vc, '#f9a8d4', `r₂ = ${fmt(r2 * 1000, 0, dec)} ${T.common.mm}`],
                [tx.axle.rim, v, PALETTE.velText, `R = ${fmt(R * 1000, 0, dec)} ${T.common.mm}`],
              ].map(([name, val, col, rr]) => (
                <div key={name} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: 'minmax(0, 11rem) 1fr' }}>
                  <span className="leading-tight text-gray-300">
                    {name}
                    <span className="block text-[11px] text-gray-500 tabular-nums">{rr}</span>
                  </span>
                  <span className="relative block h-6">
                    <span className="absolute inset-y-2 left-0 right-0 rounded-full bg-white/[0.06]" />
                    <span className="absolute inset-y-1.5 left-0 rounded-full" style={{ width: `${Math.max(1.5, (val / vMax) * 64)}%`, background: col }} />
                    <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-white" style={{ left: `calc(${Math.max(1.5, (val / vMax) * 64)}% + 8px)` }}>
                      {num(val, dec)} {T.ms}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Calc
            title={tx.calc.title}
            rows={[
              { sym: 'n₁', color: '#7dd3fc', formula: `${rpm} ${T.common.rpm}`, subst: `${rpm} / 60 ${T.s}`, result: `${fmt(nu1, 2, dec)} ${T.hz}` },
              { sym: 'n₂', color: '#f9a8d4', formula: 'n₁·z₁/z₂', subst: `${fmt(nu1, 2, dec)} ${T.hz} · ${z1} / ${z2}`, result: `${fmt(nu2, 2, dec)} ${T.hz}` },
              { sym: 'v', color: PALETTE.velText, formula: '2πR·n₂', subst: `2 · ${fmt(3.14, 2, dec)} · ${fmt(R, 2, dec)} ${T.m} · ${fmt(nu2, 2, dec)} ${T.hz}`, result: `${fmt(v, 2, dec)} ${T.ms} = ${Kmh} ${T.kmh}` },
            ]}
            note={tx.pitchNote}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scenes */

function Wheel({ cx, cy, r, a, k }) {
  const deg = (-a * 180) / Math.PI;
  const tyre = Math.max(4, 0.032 * k);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r - tyre / 2} fill="none" stroke="#1f2937" strokeWidth={tyre} />
      <circle cx={cx} cy={cy} r={r - tyre - 1.5} fill="none" stroke="#94a3b8" strokeWidth="2" />
      <g transform={`rotate(${deg.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}>
        {Array.from({ length: 16 }, (_, i) => {
          const b = (i / 16) * TAU;
          return <line key={i} x1={cx} y1={cy} x2={cx + (r - tyre - 2) * Math.cos(b)} y2={cy - (r - tyre - 2) * Math.sin(b)} stroke="#94a3b8" strokeWidth="1" />;
        })}
        <circle cx={cx + (r - tyre * 1.6) * 1} cy={cy} r={Math.max(2.5, tyre * 0.45)} fill="#e11d48" />
      </g>
      <circle cx={cx} cy={cy} r={Math.max(3, 0.02 * k)} fill="#475569" />
    </g>
  );
}

function Sprocket({ cx, cy, r, z, a, pk, color }) {
  const d = useMemo(() => gearOutline(r, z, 0.3 * pk, 0.32 * pk), [r, z, pk]);
  const deg = (-a * 180) / Math.PI;
  return (
    <g transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${deg.toFixed(2)})`}>
      <path d={d} fill="#e2e8f0" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      {r > 22 &&
        Array.from({ length: 5 }, (_, i) => {
          const b = (i / 5) * TAU;
          return <line key={i} x1={0} y1={0} x2={r * 0.72 * Math.cos(b)} y2={-r * 0.72 * Math.sin(b)} stroke={color} strokeWidth={Math.max(2, r * 0.1)} strokeLinecap="round" opacity="0.55" />;
        })}
      <circle r={Math.max(2.5, r * 0.18)} fill="#fff" stroke={color} strokeWidth="1.2" />
    </g>
  );
}

function chainPoints(loop, S, n = 200) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const p = S(loop.at((i / n) * loop.length));
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function BikeDrawing({ W, H, narrow, R, r1, r2, z1, z2, sim, v, tx, dec }) {
  const pad = narrow ? { l: 8, r: 8, t: 42, b: 8 } : { l: 14, r: 14, t: 56, b: 8 };
  const view = makeView({ x0: -0.42, x1: 1.46, y0: -0.07, y1: 1.08 }, W, H, pad);
  const k = view.k;
  const S = (p) => ({ x: view.sx(p.x), y: view.sy(p.y) });
  const fs = narrow ? 11 : 12;
  const dy = R - 0.34;
  const A = { x: 0, y: R };
  const F = { x: 1.04, y: R };
  const BB = { x: 0.41, y: R - 0.07 };
  const Sx = { x: 0.3, y: 0.8 + dy };
  const Ht = { x: 0.93, y: 0.8 + dy };
  const Hb = { x: 0.97, y: 0.62 + dy };
  const loop = beltLoop(BB, r1, A, r2, false);
  const s = S;
  const tube = (p, q, w = 5, c = COL.frame) => <line x1={s(p).x} y1={s(p).y} x2={s(q).x} y2={s(q).y} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  const pc = { x: BB.x + CRANK * Math.cos(sim.aP), y: BB.y + CRANK * Math.sin(sim.aP) };
  const pb = { x: BB.x - CRANK * Math.cos(sim.aP), y: BB.y - CRANK * Math.sin(sim.aP) };
  const tw = Math.max(3, 0.016 * k);

  // road dashes move backwards under the bike
  const period = 0.5;
  const off = -((sim.x % period) + period) % period;
  const dashes = [];
  for (let x = -0.6 + off; x < 1.7; x += period) dashes.push(<line key={x.toFixed(3)} x1={view.sx(x)} x2={view.sx(x + 0.25)} y1={view.sy(-0.035)} y2={view.sy(-0.035)} stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />);

  const marks = [];
  const nM = Math.round(loop.length / 0.05);
  for (let i = 0; i < nM; i += 1) {
    const p = S(loop.at(sim.s + (i / nM) * loop.length));
    marks.push(<circle key={i} cx={p.x} cy={p.y} r={1.3} fill="#e2e8f0" />);
  }

  const kV = narrow ? 9 : 13;
  const Lv = clamp(v * kV, 10, narrow ? 140 : 210);
  const arrowY = view.sy(1.0 + dy);
  const ax0 = view.sx(0.25);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <rect x={0} y={view.sy(0)} width={W} height={H - view.sy(0)} fill="#e2e8f0" />
      <line x1={0} x2={W} y1={view.sy(0)} y2={view.sy(0)} stroke="#64748b" strokeWidth="2" />
      {dashes}

      {/* far-side crank and pedal */}
      {tube(BB, pb, tw * 0.8, '#94a3b8')}
      <rect x={s(pb).x - 0.045 * k} y={s(pb).y - 0.012 * k} width={0.09 * k} height={0.024 * k} rx={2} fill="#94a3b8" />

      <Wheel cx={s(A).x} cy={s(A).y} r={R * k} a={sim.aW} k={k} />
      <Wheel cx={s(F).x} cy={s(F).y} r={R * k} a={sim.aW} k={k} />

      {/* frame */}
      {tube(A, BB)}
      {tube(A, Sx)}
      {tube(BB, Sx)}
      {tube(Sx, Ht)}
      {tube(BB, Hb, 6)}
      {tube(Ht, Hb, 7)}
      {tube(Hb, F, 4.5, '#475569')}
      {tube(Sx, { x: 0.27, y: 0.9 + dy }, 3.5, '#475569')}
      <path
        d={`M${view.sx(0.16)},${view.sy(0.915 + dy)} Q${view.sx(0.27)},${view.sy(0.95 + dy)} ${view.sx(0.36)},${view.sy(0.925 + dy)} L${view.sx(0.34)},${view.sy(0.9 + dy)} L${view.sx(0.17)},${view.sy(0.9 + dy)} Z`}
        fill="#1f2937"
      />
      {tube(Ht, { x: 0.9, y: 0.9 + dy }, 3.5, '#475569')}
      {tube({ x: 0.9, y: 0.9 + dy }, { x: 1.0, y: 0.92 + dy }, 3.5, '#475569')}
      {tube({ x: 1.0, y: 0.92 + dy }, { x: 1.03, y: 0.86 + dy }, 5, '#1f2937')}

      {/* drive */}
      <Sprocket cx={s(A).x} cy={s(A).y} r={r2 * k} z={z2} a={sim.aW} pk={P * k} color={COL.sprocket} />
      <Sprocket cx={s(BB).x} cy={s(BB).y} r={r1 * k} z={z1} a={sim.aP} pk={P * k} color={COL.ring} />
      <polyline points={chainPoints(loop, S)} fill="none" stroke={COL.chain} strokeWidth={Math.max(2, 0.008 * k)} strokeLinejoin="round" />
      {marks}
      {tube(BB, pc, tw, '#334155')}
      <rect x={s(pc).x - 0.045 * k} y={s(pc).y - 0.012 * k} width={0.09 * k} height={0.024 * k} rx={2} fill="#334155" />
      <circle cx={s(pc).x} cy={s(pc).y} r={3} fill="#e11d48" />

      <SpinArrow cx={s(A).x} cy={s(A).y} r={R * k + 9} from={(160 * Math.PI) / 180} span={0.9} dir={-1} color="#be185d" width={2.4} head={9} />

      {/* velocity of the bike */}
      <Arrow x1={ax0} y1={arrowY} x2={ax0 + Lv} y2={arrowY} color={PALETTE.vel} width={3.5} head={13} />
      <RichPill x={ax0 + Lv + (narrow ? 58 : 70)} y={arrowY} text={tx.speedTag(fmt(v * 3.6, 1, dec))} bg={PALETTE.vel} size={fs} box={{ w: W, h: H }} />
    </g>
  );
}

function ZoomDrawing({ W, H, narrow, r1, r2, z1, z2, sim, vc, tx, dec }) {
  const pad = narrow ? { l: 10, r: 10, t: 44, b: 10 } : { l: 16, r: 16, t: 56, b: 12 };
  const view = makeView({ x0: -0.11, x1: 0.6, y0: -0.27, y1: 0.13 }, W, H, pad);
  const k = view.k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const A = { x: 0, y: 0 };
  const BB = { x: 0.41, y: -0.07 };
  const S = (p) => ({ x: view.sx(p.x), y: view.sy(p.y) });
  const loop = beltLoop(BB, r1, A, r2, false);
  const nLinks = Math.max(8, Math.round(loop.length / P));
  const rollers = [];
  for (let i = 0; i < nLinks; i += 1) {
    const p = S(loop.at(sim.s + (i / nLinks) * loop.length));
    rollers.push(<circle key={i} cx={p.x} cy={p.y} r={Math.max(1.6, 0.0036 * k)} fill="#e2e8f0" stroke={COL.chain} strokeWidth="1" />);
  }
  const pc = { x: BB.x + CRANK * Math.cos(sim.aP), y: BB.y + CRANK * Math.sin(sim.aP) };
  const a = S(A);
  const b = S(BB);
  // the top run (second straight of the loop: from the sprocket to the chainring)
  const run = loop.runs[1];
  const ra = S(run.a);
  const rb = S(run.b);
  const mid = { x: (ra.x + rb.x) / 2, y: (ra.y + rb.y) / 2 };
  const len = Math.hypot(rb.x - ra.x, rb.y - ra.y) || 1;
  const ux = (rb.x - ra.x) / len;
  const uy = (rb.y - ra.y) / len;
  const La = clamp(vc * 110, 18, 80);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      {Array.from({ length: Math.ceil(W / 22) + 1 }, (_, i) => (
        <line key={`x${i}`} x1={i * 22} x2={i * 22} y1={0} y2={H} stroke={PALETTE.grid} />
      ))}
      {Array.from({ length: Math.ceil(H / 22) + 1 }, (_, i) => (
        <line key={`y${i}`} x1={0} x2={W} y1={i * 22} y2={i * 22} stroke={PALETTE.grid} />
      ))}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" strokeWidth={0.014 * k} strokeLinecap="round" />
      <Sprocket cx={a.x} cy={a.y} r={r2 * k} z={z2} a={sim.aW} pk={P * k} color={COL.sprocket} />
      <Sprocket cx={b.x} cy={b.y} r={r1 * k} z={z1} a={sim.aP} pk={P * k} color={COL.ring} />
      <polyline points={chainPoints(loop, S, 240)} fill="none" stroke={COL.chain} strokeWidth={Math.max(3, 0.007 * k)} strokeLinejoin="round" />
      {rollers}
      <line x1={b.x} y1={b.y} x2={S(pc).x} y2={S(pc).y} stroke="#334155" strokeWidth={Math.max(5, 0.014 * k)} strokeLinecap="round" />
      <rect x={S(pc).x - 0.04 * k} y={S(pc).y - 0.011 * k} width={0.08 * k} height={0.022 * k} rx={3} fill="#334155" />
      <circle cx={S(pc).x} cy={S(pc).y} r={3.5} fill="#e11d48" />

      <SpinArrow cx={a.x} cy={a.y} r={r2 * k + 14} from={(150 * Math.PI) / 180} span={1.3} dir={-1} color={COL.sprocket} width={2.4} head={9} />
      <SpinArrow cx={b.x} cy={b.y} r={r1 * k + 14} from={(110 * Math.PI) / 180} span={1.1} dir={-1} color={COL.ring} width={2.4} head={9} />

      <Arrow x1={mid.x - ux * La * 0.5} y1={mid.y - uy * La * 0.5 - 16} x2={mid.x + ux * La * 0.5} y2={mid.y + uy * La * 0.5 - 16} color={PALETTE.vel} width={3} head={11} />
      <RichPill x={mid.x} y={mid.y - 38} text={tx.chainTag(num(vc, dec))} bg={PALETTE.vel} size={fs} box={box} />

      <RichPill x={a.x} y={a.y + r2 * k + (narrow ? 22 : 28)} text={`z_2 = ${z2}`} bg="#db2777" size={fs} box={box} />
      <text x={a.x} y={a.y + r2 * k + (narrow ? 48 : 58)} textAnchor="middle" fontSize={fs - 1} fill={PALETTE.muted}>
        {tx.sameAxle}
      </text>
      <RichPill x={b.x + r1 * k * 0.1} y={b.y + r1 * k + (narrow ? 22 : 30)} text={`z_1 = ${z1}`} bg="#0284c7" size={fs} box={box} />
    </g>
  );
}
