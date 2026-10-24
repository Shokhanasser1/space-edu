import { useMemo, useState } from 'react';
import { Cog, Lightbulb, Settings2 } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { Calc, Panel, PlayButtons, RichPill, SimScene, SpinArrow, TimeChip, Toolbar, num, numt, timeWords } from './RotationTransmission.parts';
import { TAU, gearOutline, slowScale } from './RotationTransmission.geometry';

/**
 * Meshing gears with the same tooth size (module m = 3 mm), so a gear's
 * pitch radius is r = m·z/2. The same number of teeth of each gear passes
 * the contact point every second - z₁n₁ = z₂n₂ - which is the same as
 * equal speeds of the pitch circles there, ω₁r₁ = ω₂r₂. Neighbouring gears
 * turn opposite ways; with an idler in the middle the third gear turns like
 * the first, and the overall ratio is z₃/z₁ whatever the idler's teeth.
 *
 * Phases: gear 1 has a tooth at its angle φ₁ (pointing at gear 2 when
 * φ₁ = 0); a gear B to the right of gear A meshes when
 * φ_B = π − π/z_B − φ_A·z_A/z_B.
 */

const MOD = 0.003; // m
const COLS = [
  { fill: '#bae6fd', stroke: '#0369a1', pill: '#0284c7', text: '#7dd3fc' },
  { fill: '#fbcfe8', stroke: '#be185d', pill: '#db2777', text: '#f9a8d4' },
  { fill: '#ddd6fe', stroke: '#6d28d9', pill: '#7c3aed', text: '#c4b5fd' },
];
const IDLE = { running: false, a1: 0, t: 0, n1: 0, n2: 0, n3: 0 };

export default function GearSim({ T }) {
  const tx = T.gears;
  const dec = T.decimal;
  const [three, setThree] = useState(false);
  const [z1, setZ1] = useState(20);
  const [z2, setZ2] = useState(40);
  const [z3, setZ3] = useState(30);
  const [nu1, setNu1] = useState(0.5);
  const [sim, setSim] = useState(IDLE);

  const nu2 = (nu1 * z1) / z2;
  const nu3 = (nu1 * z1) / z3;
  const w1 = TAU * nu1;
  const r1 = (MOD * z1) / 2;
  const v = w1 * r1;
  const scale = slowScale(Math.max(nu1, nu2, three ? nu3 : 0));

  useRafLoop(sim.running, (dt) => {
    const d = dt * scale;
    setSim((p) => (p.running ? { ...p, a1: p.a1 - w1 * d, t: p.t + d, n1: p.n1 + nu1 * d, n2: p.n2 + nu2 * d, n3: p.n3 + nu3 * d } : p));
  });

  const started = sim.t > 0;
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim(IDLE);
  const change = (setter) => (x) => {
    setter(x);
    setSim((p) => ({ ...p, n1: 0, n2: 0, n3: 0 }));
  };

  /* ---- explanation: the main rule, then the turn count once the slower gear has made a whole turn */
  const whole = Math.floor(Math.min(sim.n1, sim.n2) + 1e-9);
  const ratio12 = z2 / z1;
  let key = 'idle';
  if (started) key = three ? 'three' : z1 === z2 ? 'same' : z2 > z1 ? 'down' : 'up';
  const settled = useSettled(key, key === 'idle' ? 0 : 200);
  const ex = tx.explain;
  let text = ex.idle;
  if (settled === 'down') text = ex.down(numt(ratio12, dec), num(nu2, dec));
  else if (settled === 'up') text = ex.up(numt(1 / ratio12, dec), num(nu2, dec));
  else if (settled === 'same') text = ex.same;
  else if (settled === 'three') text = ex.three(numt(z3 / z1, dec));
  if ((settled === 'down' || settled === 'up') && whole >= 1) {
    text += ` ${z2 > z1 ? ex.count(numt(whole * ratio12, dec), whole, numt(ratio12, dec)) : ex.count(whole, numt(whole / ratio12, dec), numt(ratio12, dec))}`;
  }
  const tone = settled === 'three' ? '#a78bfa' : whole >= 1 && settled !== 'idle' ? '#34d399' : '#22d3ee';

  const dirs = [T.common.cw, T.common.ccw, T.common.cw];
  const legend = [
    { label: tx.legend.pitch, color: '#64748b', kind: 'dash' },
    { label: tx.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: tx.legend.mark, color: '#e11d48', kind: 'dot' },
  ];
  const f2 = (x) => fmt(x, 2, dec);
  const ratio = three ? z3 / z1 : ratio12;

  const calcRows = [
    { sym: 'n₂', color: COLS[1].text, formula: 'n₁·z₁/z₂', subst: `${f2(nu1)} ${T.hz} · ${z1} / ${z2}`, result: `${num(nu2, dec)} ${T.hz}` },
  ];
  if (three) calcRows.push({ sym: 'n₃', color: COLS[2].text, formula: 'n₂·z₂/z₃ = n₁·z₁/z₃', subst: `${f2(nu1)} ${T.hz} · ${z1} / ${z3}`, result: `${num(nu3, dec)} ${T.hz}` });
  calcRows.push(
    three
      ? { sym: 'i', color: '#fde68a', formula: 'n₁/n₃ = z₃/z₁', subst: `${z3} / ${z1}`, result: numt(z3 / z1, dec) }
      : { sym: 'i', color: '#fde68a', formula: 'n₁/n₂ = z₂/z₁', subst: `${z2} / ${z1}`, result: numt(ratio12, dec) },
    { sym: 'r₁', color: COLS[0].text, formula: 'm·z₁/2', subst: `3 ${T.common.mm} · ${z1} / 2`, result: `${fmt(r1 * 1000, 0, dec)} ${T.common.mm}` },
    { sym: 'v', color: PALETTE.velText, formula: '2πn₁·r₁', subst: `2 · ${fmt(3.14, 2, dec)} · ${f2(nu1)} ${T.hz} · ${fmt(r1, 3, dec)} ${T.m}`, result: `${num(v, dec)} ${T.ms}` },
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.countLabel}
        value={three ? 'three' : 'two'}
        onChange={(x) => {
          setThree(x === 'three');
          setSim((p) => ({ ...p, n1: 0, n2: 0, n3: 0 }));
        }}
        cols="grid-cols-2"
        accent={three ? '#a78bfa' : '#22d3ee'}
        options={[
          { value: 'two', label: tx.counts.two.name, sub: tx.counts.two.sub, icon: Cog },
          { value: 'three', label: tx.counts.three.name, sub: tx.counts.three.sub, icon: Settings2 },
        ]}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={timeWords(T.common, scale, dec)} />}
        ariaLabel={tx.sceneLabel(z1, z2, f2(nu1), num(nu2, dec))}
        height={(W, narrow) => (narrow ? W * 0.82 : clamp(W * 0.38, 380, 440))}
      >
        {(W, H, narrow) => <GearDrawing W={W} H={H} narrow={narrow} zs={three ? [z1, z2, z3] : [z1, z2]} a1={sim.a1} v={v} nus={[nu1, nu2, nu3]} tx={tx} dec={dec} ms={T.ms} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.g(1)} symbol="n₁" value={f2(nu1)} unit={T.hz} accent={COLS[0].pill} textColor={COLS[0].text} sub={tx.readouts.sub(z1, dirs[0])} />
        <Readout label={tx.readouts.g(2)} symbol="n₂" value={num(nu2, dec)} unit={T.hz} accent={COLS[1].pill} textColor={COLS[1].text} sub={tx.readouts.sub(z2, dirs[1])} />
        {three ? (
          <Readout label={tx.readouts.g(3)} symbol="n₃" value={num(nu3, dec)} unit={T.hz} accent={COLS[2].pill} textColor={COLS[2].text} sub={tx.readouts.sub(z3, dirs[2])} />
        ) : (
          <Readout label={tx.readouts.v} symbol="v" value={num(v, dec)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub="v = ω₁r₁ = ω₂r₂" />
        )}
        <Readout label={tx.readouts.i} symbol="i" value={numt(ratio, dec)} accent="#facc15" textColor="#fde68a" sub={three ? tx.readouts.iSub3 : tx.readouts.iSub2} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="gear-z1" label={tx.z(1)} symbol="z₁" min={10} max={40} step={1} value={z1} onChange={change(setZ1)} accent={COLS[0].pill} display={String(z1)} />
          <RangeField id="gear-z2" label={tx.z(2)} symbol="z₂" min={10} max={40} step={1} value={z2} onChange={change(setZ2)} accent={COLS[1].pill} display={String(z2)} />
          {three && <RangeField id="gear-z3" label={tx.z(3)} symbol="z₃" min={10} max={40} step={1} value={z3} onChange={change(setZ3)} accent={COLS[2].pill} display={String(z3)} />}
          <RangeField
            id="gear-nu"
            label={tx.nu1}
            symbol="n₁"
            min={0.1}
            max={1}
            step={0.05}
            value={nu1}
            onChange={change(setNu1)}
            accent="#22d3ee"
            display={`${f2(nu1)} ${T.hz}`}
            hint={tx.nuHint(num(nu1 * 60, dec))}
          />
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-300">{tx.module}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <Calc title={tx.calc.title} rows={calcRows} />
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function Gear({ cx, cy, r, z, m, phi, col, holes }) {
  const d = useMemo(() => gearOutline(r, z, m, 1.25 * m), [r, z, m]);
  const deg = (-phi * 180) / Math.PI;
  return (
    <g>
      <g transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${deg.toFixed(2)})`}>
        <path d={d} fill={col.fill} stroke={col.stroke} strokeWidth="1.3" strokeLinejoin="round" />
        {holes &&
          Array.from({ length: 5 }, (_, i) => {
            const b = (i / 5) * TAU + TAU / 10;
            return <circle key={i} cx={r * 0.55 * Math.cos(b)} cy={-r * 0.55 * Math.sin(b)} r={r * 0.14} fill="#fbfcfe" stroke={col.stroke} strokeWidth="1" strokeOpacity="0.6" />;
          })}
        <circle r={Math.max(5, r * 0.2)} fill="#fff" stroke={col.stroke} strokeWidth="1.3" />
        <circle cx={r - 2.2 * m} cy={0} r={Math.max(3, m * 0.55)} fill="#e11d48" stroke="#fff" strokeWidth="1" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#475569" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={cx} cy={cy} r={2.5} fill="#0f172a" />
    </g>
  );
}

function GearDrawing({ W, H, narrow, zs, a1, v, nus, tx, dec, ms }) {
  const rs = zs.map((z) => (MOD * z) / 2);
  const xs = [0];
  for (let i = 1; i < zs.length; i += 1) xs.push(xs[i - 1] + rs[i - 1] + rs[i]);
  const rMax = Math.max(...rs);
  const edge = 2.6 * MOD;
  const box = {
    x0: -rs[0] - edge - 0.012,
    x1: xs[xs.length - 1] + rs[rs.length - 1] + edge + 0.012,
    y0: -(rMax + edge + 0.05),
    y1: rMax + edge + 0.022,
  };
  const pad = narrow ? { l: 10, r: 10, t: 46, b: 8 } : { l: 30, r: 30, t: 60, b: 10 };
  const view = makeView(box, W, H, pad);
  const k = view.k;
  const m = MOD * k;
  const fs = narrow ? 11 : 12;
  const bx = { w: W, h: H };

  const phis = [a1];
  for (let i = 1; i < zs.length; i += 1) phis.push(Math.PI - Math.PI / zs[i] - (phis[i - 1] * zs[i - 1]) / zs[i]);
  const cs = xs.map((x) => ({ x: view.sx(x), y: view.sy(0) }));
  const Lv = clamp(v * 320, 14, narrow ? 70 : 100);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={22} />
      {zs.map((z, i) => (
        <Gear key={i} cx={cs[i].x} cy={cs[i].y} r={rs[i] * k} z={z} m={m} phi={phis[i]} col={COLS[i]} holes={rs[i] * k > 42} />
      ))}
      {/* contact points: the pitch circles share one speed v there */}
      {zs.slice(1).map((_, i) => {
        const px = cs[i].x + rs[i] * k;
        const py = cs[i].y;
        const down = i % 2 === 0; // gear 1 turns clockwise: its right edge moves down
        return (
          <g key={`c${i}`}>
            <Arrow x1={px} y1={py} x2={px} y2={py + (down ? Lv : -Lv)} color={PALETTE.vel} width={3} head={11} />
            <circle cx={px} cy={py} r={4} fill={PALETTE.vel} stroke="#fff" strokeWidth="1.5" />
            {!narrow && <RichPill x={px} y={py + (down ? Lv + 16 : -Lv - 16)} text={`v = ${num(v, dec)} ${ms}`} bg={PALETTE.vel} size={fs - 1} box={bx} />}
          </g>
        );
      })}
      {zs.map((z, i) => {
        const rt = rs[i] * k + m + 10;
        const dir = i % 2 === 0 ? -1 : 1;
        return (
          <g key={`l${i}`}>
            <SpinArrow cx={cs[i].x} cy={cs[i].y} r={rt} from={dir < 0 ? (125 * Math.PI) / 180 : (55 * Math.PI) / 180} span={1.2} dir={dir} color={COLS[i].stroke} width={2.6} head={10} />
            <RichPill x={cs[i].x} y={cs[i].y + rs[i] * k + m + (narrow ? 16 : 20)} text={tx.gTag(i + 1, z)} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs - 1} box={bx} />
            <RichPill x={cs[i].x} y={cs[i].y + rs[i] * k + m + (narrow ? 38 : 46)} text={tx.nuTag(i + 1, num(nus[i], dec))} bg={COLS[i].pill} size={fs} box={bx} />
          </g>
        );
      })}
    </g>
  );
}
