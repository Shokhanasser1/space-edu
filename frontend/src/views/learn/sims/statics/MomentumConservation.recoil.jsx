import { useMemo, useState } from 'react';
import { Crosshair, Flame, Lightbulb, Rocket, Scissors, Wrench } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, makeView } from '../kit/scene';
import {
  CART,
  COL,
  Calc,
  Cart,
  CmMarker,
  MomentumChart,
  Panel,
  PlayButtons,
  RichPill,
  SimScene,
  TimeChip,
  Toolbar,
  cartTop,
  fmtt,
  niceMax,
  numt,
  par,
  pillWidth,
  sfmt,
  springPath,
} from './MomentumConservation.parts';

/**
 * Bodies at rest fly apart: the total momentum was zero and stays zero,
 *   m₁v₁ + m₂v₂ = 0  →  v₁ = −m₂v₂ / m₁.
 * Four cases: two carts pushed apart by a spring, a free rifle and its
 * bullet, an astronaut throwing a wrench, a spaceship's engine throwing out
 * a portion of gas (jet propulsion). The push lasts τ; during it both bodies
 * gain speed in the same proportion (v ∝ (1 − cos πt/τ)/2), so the sum of the
 * momenta is zero at every instant. The centre of mass stays where it was.
 */

const PRESETS = [
  {
    id: 'carts',
    icon: Scissors,
    m1: { min: 0.5, max: 4, step: 0.5, def: 1, unit: 'kg' },
    m2: { min: 0.5, max: 4, step: 0.5, def: 2, unit: 'kg' },
    v2: { min: 0.25, max: 2, step: 0.25, def: 1 },
    dir: 1,
    rate: 0.5, // sim seconds per real second
    push: 0.08,
    box: { x0: -2.1, x1: 2.1, y0: -0.2, y1: 0.66 },
    tMax: 2.4,
    edge: 2.0,
  },
  {
    id: 'gun',
    icon: Crosshair,
    m1: { min: 2, max: 6, step: 0.5, def: 4, unit: 'kg' },
    m2: { min: 5, max: 20, step: 1, def: 9, unit: 'g' },
    v2: { min: 300, max: 1000, step: 50, def: 800 },
    dir: 1,
    rate: 1,
    push: 0.002,
    box: { x0: -3, x1: 3, y0: -0.42, y1: 0.95 },
    tMax: 1.6,
    edge: 2.85,
  },
  {
    id: 'astro',
    icon: Wrench,
    m1: { min: 60, max: 150, step: 5, def: 100, unit: 'kg' },
    m2: { min: 0.5, max: 10, step: 0.5, def: 2, unit: 'kg' },
    v2: { min: 1, max: 10, step: 0.5, def: 5 },
    dir: 1,
    rate: 2,
    push: 0.25,
    box: { x0: -5, x1: 5, y0: -0.55, y1: 2.75 },
    tMax: 10,
    edge: 4.7,
  },
  {
    id: 'ship',
    icon: Rocket,
    m1: { min: 500, max: 3000, step: 100, def: 1000, unit: 'kg' },
    m2: { min: 5, max: 50, step: 5, def: 10, unit: 'kg' },
    v2: { min: 1000, max: 4000, step: 250, def: 2000 },
    dir: -1,
    rate: 1,
    push: 0.05,
    box: { x0: -30, x1: 30, y0: -4.4, y1: 5.8 },
    tMax: 2.6,
    edge: 27,
  },
];
const BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

/** Size (m) and start of each body per case: body 1 = the big one, body 2 = the part thrown off. */
const LAYOUT = {
  carts: { x1: -0.25, x2: 0.25 },
  gun: { x1: -0.1, x2: 0.2 },
  astro: { x1: -0.3, x2: -0.14 },
  ship: { x1: -16, x2: -20.2 },
};

const kgOf = (cfg, v) => (cfg.unit === 'g' ? v / 1000 : v);

function motion(pre, m1, m2, v2abs) {
  const v2 = pre.dir * v2abs;
  const v1 = (-m2 * v2) / m1;
  const tau = pre.push;
  const lay = LAYOUT[pre.id];
  const disp = (v, t) => {
    if (t <= 0) return 0;
    if (t < tau) {
      const u = t / tau;
      return v * tau * (u / 2 - Math.sin(Math.PI * u) / (2 * Math.PI));
    }
    return v * (tau / 2) + v * (t - tau);
  };
  const vel = (v, t) => (t <= 0 ? 0 : t < tau ? (v * (1 - Math.cos((Math.PI * t) / tau))) / 2 : v);
  // body 1 reaches the edge of the scene, or tMax
  const margin = { carts: 0.4, gun: 0.65, astro: 0.5, ship: 4 }[pre.id];
  const room = v1 > 0 ? pre.edge - lay.x1 - margin : lay.x1 + pre.edge - margin;
  const tEnd = Math.min(pre.tMax, tau + Math.max(0.3, room / Math.max(Math.abs(v1), 1e-6)));
  const at = (t) => ({ x1: lay.x1 + disp(v1, t), x2: lay.x2 + disp(v2, t), u1: vel(v1, t), u2: vel(v2, t) });
  return { v1, v2, tEnd, at, tau };
}

const IDLE = { t: 0, running: false, done: false };

export default function RecoilSim({ T }) {
  const tx = T.recoil;
  const U = T.u;
  const dec = T.decimal;
  const [pid, setPid] = useState('carts');
  const pre = BY_ID[pid];
  const [vals, setVals] = useState(() => ({ m1: pre.m1.def, m2: pre.m2.def, v2: pre.v2.def }));
  const [sim, setSim] = useState(IDLE);
  const m1 = kgOf(pre.m1, vals.m1);
  const m2 = kgOf(pre.m2, vals.m2);
  const mo = useMemo(() => motion(pre, m1, m2, vals.v2), [pre, m1, m2, vals.v2]);
  const st = mo.at(sim.t);
  const started = sim.t > 0 || sim.running;
  const pushing = sim.t > 0 && sim.t < mo.tau;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = p.t + dt * pre.rate;
      if (t >= mo.tEnd) return { t: mo.tEnd, running: false, done: true };
      return { ...p, t };
    });
  });

  const stop = () => setSim(IDLE);
  const toggle = () => setSim((p) => (p.done ? { t: 0, running: true, done: false } : { ...p, running: !p.running }));
  const pick = (id) => {
    const p = BY_ID[id];
    setPid(id);
    setVals({ m1: p.m1.def, m2: p.m2.def, v2: p.v2.def });
    stop();
  };
  const change = (key) => (v) => {
    setVals((o) => ({ ...o, [key]: v }));
    stop();
  };

  /* ---- numbers */
  const p1 = m1 * st.u1;
  const p2 = m2 * st.u2;
  const pf = m2 * Math.abs(mo.v2);
  const E1 = 0.5 * m1 * mo.v1 ** 2;
  const E2 = 0.5 * m2 * mo.v2 ** 2;
  const Ek = 0.5 * m1 * st.u1 ** 2 + 0.5 * m2 * st.u2 ** 2;
  const share2 = (E2 / (E1 + E2)) * 100;
  const ratio = m1 / m2;
  const vStr = (v) => sfmt(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2, dec);
  const massStr = (cfg, v) => `${numt(v, dec)} ${cfg.unit === 'g' ? U.g : U.kg}`;
  const eStr = (e) => (e >= 100 ? numt(e, dec, 4) : fmt(e, 2, dec));
  const pStr = (x) => (Math.abs(x) >= 100 ? numt(x, dec, 5) : sfmt(x, 2, dec));

  /* ---- words */
  const c = tx.cases[pid];
  let key = 'idle';
  if (pushing) key = 'push';
  else if (sim.t >= mo.tau && started) key = 'done';
  const settled = useSettled(`${pid}-${key}`, 0);
  let text;
  if (settled.endsWith('-push')) text = tx.push;
  else if (settled.endsWith('-done'))
    text = c.done(vStr(Math.abs(mo.v1)), vStr(Math.abs(mo.v2)), pStr(pf), eStr(E1), eStr(E2), fmtt(Math.max(ratio, 1 / ratio), 1, dec), fmt(share2, share2 > 99 ? 1 : 0, dec));
  else text = c.idle;
  const tone = settled.endsWith('-idle') ? '#22d3ee' : settled.endsWith('-push') ? '#f87171' : '#34d399';

  const legend = [
    { label: c.b1, color: COL.b1, kind: 'line' },
    { label: c.b2, color: COL.b2, kind: 'line' },
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
    { label: tx.legend.cm, color: COL.sum, kind: 'dot' },
  ];
  const chipText = (narrow) => {
    if (pre.rate === 1) return T.common.realTime;
    if (pre.rate < 1) return narrow ? T.common.slowShort(1 / pre.rate) : T.common.slow(1 / pre.rate);
    return narrow ? T.common.fastShort(pre.rate) : T.common.fast(pre.rate);
  };

  const pMax = niceMax(Math.max(pf, 1e-6));

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={pid}
        onChange={pick}
        accent="#f472b6"
        options={PRESETS.map((p) => ({ value: p.id, label: tx.cases[p.id].name, sub: tx.cases[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons
          common={T.common}
          running={sim.running}
          started={started}
          done={sim.done}
          onToggle={toggle}
          onReset={stop}
          startLabel={c.action}
          startIcon={pid === 'carts' ? Flame : BY_ID[pid].icon}
        />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <TimeChip text={chipText(narrow)} extra={narrow ? null : c.scene} />}
        ariaLabel={tx.sceneLabel(c.b1, vStr(st.u1), c.b2, vStr(st.u2))}
        height={(W, narrow) =>
          pid === 'astro' ? (narrow ? clamp(W * 0.72, 240, 340) : clamp(W * 0.34, 330, 410)) : narrow ? clamp(W * 0.56, 200, 280) : clamp(W * 0.28, 300, 350)
        }
      >
        {(W, H, narrow) => <RecoilDrawing W={W} H={H} narrow={narrow} pre={pre} mo={mo} st={st} m1={m1} m2={m2} sim={sim} T={T} vStr={vStr} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={c.v1Label}
          symbol="v₁"
          value={vStr(st.u1)}
          unit={T.ms}
          accent={COL.b1}
          textColor={COL.b1Text}
          sub={tx.readouts.pSub(1, pStr(p1), U.kgms)}
          active={started}
        />
        <Readout
          label={c.v2Label}
          symbol="v₂"
          value={vStr(st.u2)}
          unit={T.ms}
          accent={COL.b2}
          textColor={COL.b2Text}
          sub={tx.readouts.pSub(2, pStr(p2), U.kgms)}
          active={started}
        />
        <Readout
          label={tx.readouts.sum}
          symbol="p₁ + p₂"
          value={sfmt(p1 + p2, 2, dec)}
          unit={U.kgms}
          accent={COL.sum}
          textColor={COL.sumText}
          sub={tx.readouts.sumSub}
          active={started}
        />
        <Readout
          label={tx.readouts.ek}
          symbol="Eₖ"
          value={eStr(Ek)}
          unit={U.J}
          accent={COL.ek}
          textColor={COL.ekText}
          sub={started && sim.t >= mo.tau ? c.share(fmt(share2, share2 > 99 ? 1 : 0, dec)) : c.source}
          active={started}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="mc-r-m1"
            label={c.m1}
            symbol="m₁"
            min={pre.m1.min}
            max={pre.m1.max}
            step={pre.m1.step}
            value={vals.m1}
            onChange={change('m1')}
            accent={COL.b1}
            display={massStr(pre.m1, vals.m1)}
          />
          <RangeField
            id="mc-r-m2"
            label={c.m2}
            symbol="m₂"
            min={pre.m2.min}
            max={pre.m2.max}
            step={pre.m2.step}
            value={vals.m2}
            onChange={change('m2')}
            accent={COL.b2}
            display={massStr(pre.m2, vals.m2)}
          />
          <RangeField
            id="mc-r-v2"
            label={c.v2}
            symbol="|v₂|"
            min={pre.v2.min}
            max={pre.v2.max}
            step={pre.v2.step}
            value={vals.v2}
            onChange={change('v2')}
            accent={COL.vel}
            display={`${numt(vals.v2, dec, 4)} ${T.ms}`}
            hint={c.hint}
          />
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          <MomentumChart
            title={tx.chart.title}
            beforeLabel={tx.chart.before}
            nowLabel={tx.chart.now}
            rows={[
              { id: 'p1', label: 'p_1', color: COL.b1Line, text: COL.b1Text, before: 0, now: p1 },
              { id: 'p2', label: 'p_2', color: COL.b2Line, text: COL.b2Text, before: 0, now: p2 },
              { id: 'sum', label: 'Σp', color: COL.sumLine, text: COL.sumText, before: 0, now: p1 + p2, sum: true },
            ]}
            max={pMax}
            unit={U.kgms}
            dec={dec}
            ariaLabel={tx.chart.label(pStr(p1), pStr(p2))}
            digits={pMax >= 1000 ? 0 : 2}
            note={tx.chart.note}
          />
          <Calc
            title={tx.calc.title}
            rows={[
              { sym: 'm₁v₁ + m₂v₂', color: COL.sumText, formula: '0', subst: null, result: null },
              {
                sym: 'v₁',
                color: COL.b1Text,
                formula: '−m₂v₂ / m₁',
                subst: `−${numt(m2, dec, 4)}·${par(vStr(mo.v2))} / ${numt(m1, dec, 4)}`,
                result: `${vStr(mo.v1)} ${T.ms}`,
              },
              {
                sym: 'Eₖ₁ : Eₖ₂',
                color: COL.ekText,
                formula: 'm₂ : m₁',
                subst: `${eStr(E1)} ${U.J} : ${eStr(E2)} ${U.J}`,
                result: `1 : ${numt(ratio, dec, 3)}`,
              },
            ]}
            note={tx.calc.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function RecoilDrawing({ W, H, narrow, pre, mo, st, m1, m2, sim, T, vStr }) {
  const tx = T.recoil;
  const U = T.u;
  const dec = T.decimal;
  const pad = narrow ? { l: 6, r: 6, t: 40, b: 24 } : { l: 14, r: 14, t: 52, b: 26 };
  const view = makeView(pre.box, W, H, pad);
  const k = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const started = sim.t > 0 || sim.running;
  const released = sim.t > 0;
  const cm = (m1 * st.x1 + m2 * st.x2) / (m1 + m2);
  const cm0 = (m1 * LAYOUT[pre.id].x1 + m2 * LAYOUT[pre.id].x2) / (m1 + m2);
  const axisStep = niceStep(k, narrow ? 60 : 100);

  /* velocity arrow + label for a body at screen point (sx, sy); off-screen bodies get an edge marker */
  const kV = (narrow ? 0.45 : 1) * (pre.id === 'carts' ? 40 : pre.id === 'gun' ? 34 : pre.id === 'astro' ? 14 : 3.2);
  const vel = (sx, sy, v, i, color, labelDy) => {
    if (!released || Math.abs(v) < 1e-9) return null;
    const off = sx < -10 || sx > W + 10;
    const label = tx.vTag(i, vStr(v), T.ms);
    const pw = pillWidth(label, fs);
    if (off) {
      const ex = v > 0 ? W - 10 : 10;
      return (
        <g>
          <Arrow x1={ex - Math.sign(v) * 34} y1={sy} x2={ex} y2={sy} color={COL.vel} width={narrow ? 2.4 : 3.2} head={narrow ? 8 : 12} />
          <RichPill x={ex - Math.sign(v) * (pw / 2 + 40)} y={sy} text={label} bg={color} size={fs} box={box} />
        </g>
      );
    }
    let len = v * kV;
    len = clamp(len, -W * 0.3, W * 0.3);
    const ya = sy + labelDy;
    return (
      <g>
        {Math.abs(len) > 4 && <Arrow x1={sx} y1={ya} x2={sx + len} y2={ya} color={COL.vel} width={narrow ? 2.4 : 3.2} head={narrow ? 8 : 12} />}
        <RichPill x={sx + (Math.abs(len) > 4 ? len / 2 : 0)} y={ya - (narrow ? 14 : 18)} text={label} bg={color} size={fs} box={box} />
      </g>
    );
  };

  let scene = null;
  if (pre.id === 'carts') {
    const L = CART.L;
    const gap = Math.max(0, st.x2 - st.x1 - L); // between the cart bodies
    const springFree = 0.16;
    const sa = X(st.x1 + L / 2);
    const sb = X(st.x1 + L / 2 + Math.min(springFree, gap));
    const yS = Y(0.11);
    scene = (
      <g>
        <rect x={X(-2.02)} y={Y(0)} width={4.04 * k} height={Math.max(4, 0.035 * k)} rx={3} fill="#cbd5e1" />
        <line x1={X(-2.02)} x2={X(2.02)} y1={Y(0)} y2={Y(0)} stroke="#64748b" strokeWidth="1.5" />
        <path d={springPath(sa, sb, yS, Math.max(2.5, 0.025 * k), 6)} fill="none" stroke="#334155" strokeWidth={narrow ? 1.3 : 2} strokeLinejoin="round" />
        <line x1={sb} x2={sb} y1={yS - Math.max(4, 0.03 * k)} y2={yS + Math.max(4, 0.03 * k)} stroke="#334155" strokeWidth={narrow ? 2 : 3} strokeLinecap="round" />
        {!released && (
          <path
            d={`M${X(st.x1 + 0.12)},${Y(CART.y1)} Q${(X(st.x1 + 0.12) + X(st.x2 - 0.12)) / 2},${Y(CART.y1) + 0.03 * k} ${X(st.x2 - 0.12)},${Y(CART.y1)}`}
            fill="none"
            stroke="#92400e"
            strokeWidth={narrow ? 1.2 : 1.8}
          />
        )}
        <Cart view={view} xc={st.x1} color={COL.b1} label="1" mass={m1} roll={st.x1 - LAYOUT.carts.x1} fs={fs} />
        <Cart view={view} xc={st.x2} color={COL.b2} label="2" mass={m2} roll={st.x2 - LAYOUT.carts.x2} fs={fs} />
        <RichPill x={X(st.x1) + 10 - pillWidth(tx.mTag(1, numt(m1, dec), U.kg), fs - 0.5) / 2} y={Y(cartTop(m1)) - (narrow ? 10 : 14)} text={tx.mTag(1, numt(m1, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />
        <RichPill x={X(st.x2) - 10 + pillWidth(tx.mTag(2, numt(m2, dec), U.kg), fs - 0.5) / 2} y={Y(cartTop(m2)) - (narrow ? 10 : 14)} text={tx.mTag(2, numt(m2, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />
        {vel(X(st.x1), Y(cartTop(m1)), st.u1, 1, COL.b1, narrow ? -26 : -36)}
        {vel(X(st.x2), Y(cartTop(m2)), st.u2, 2, COL.b2, narrow ? -26 : -36)}
      </g>
    );
  } else if (pre.id === 'gun') {
    const gy = 0.14; // barrel axis height: the stock rests on the ice
    const gx = st.x1; // muzzle-side reference: the gun's centre
    const bx = st.x2;
    const P = (x, y) => `${X(gx + x).toFixed(1)},${Y(gy + y).toFixed(1)}`;
    const stock = `M${P(-0.55, 0.02)} L${P(-0.12, 0.03)} L${P(-0.05, -0.02)} L${P(-0.3, -0.08)} L${P(-0.58, -0.13)} Z`;
    const flash = released && sim.t < 0.05;
    const bulletVisible = X(bx) < W + 20;
    scene = (
      <g>
        <rect x={X(-3)} y={Y(0)} width={6 * k} height={Math.max(3, 0.03 * k)} fill="#e2e8f0" />
        <line x1={X(-3)} x2={X(3)} y1={Y(0)} y2={Y(0)} stroke="#94a3b8" strokeWidth="1.5" />
        <text x={X(2.9)} y={Y(0) + fs + 6} textAnchor="end" fontSize={fs - 1} fill="#94a3b8">
          {tx.ice}
        </text>
        {/* rifle */}
        <path d={stock} fill="#92400e" stroke="#451a03" strokeWidth="1" strokeLinejoin="round" />
        <rect x={X(gx - 0.14)} y={Y(gy + 0.035)} width={0.66 * k} height={Math.max(3, 0.035 * k)} rx="2" fill="#334155" />
        <rect x={X(gx - 0.08)} y={Y(gy + 0.0)} width={0.3 * k} height={Math.max(3, 0.045 * k)} rx="3" fill="#78350f" />
        <path d={`M${P(-0.04, -0.01)} q${0.02 * k},${0.07 * k} ${0.06 * k},${0.07 * k}`} fill="none" stroke="#334155" strokeWidth={Math.max(1.2, 0.01 * k)} />
        <line x1={X(gx + 0.25)} x2={X(gx + 0.25)} y1={Y(gy + 0.07)} y2={Y(gy + 0.035)} stroke="#334155" strokeWidth={Math.max(1.5, 0.012 * k)} />
        {flash && (
          <g>
            <circle cx={X(gx + 0.54)} cy={Y(gy + 0.018)} r={0.07 * k} fill="#fde047" opacity="0.85" />
            <circle cx={X(gx + 0.54)} cy={Y(gy + 0.018)} r={0.04 * k} fill="#f97316" />
          </g>
        )}
        {/* bullet */}
        {bulletVisible && (
          <g>
            {released && <line x1={X(Math.max(gx + 0.52, bx - 1.5))} x2={X(bx)} y1={Y(gy + 0.018)} y2={Y(gy + 0.018)} stroke={COL.b2} strokeWidth="2" opacity="0.35" />}
            <rect x={X(bx - 0.03)} y={Y(gy + 0.028)} width={Math.max(5, 0.04 * k)} height={Math.max(3, 0.02 * k)} rx={Math.max(1.5, 0.01 * k)} fill={COL.b2} />
          </g>
        )}
        {released && !bulletVisible && <line x1={X(gx + 0.55)} x2={W} y1={Y(gy + 0.018)} y2={Y(gy + 0.018)} stroke={COL.b2} strokeWidth="1.5" opacity="0.25" strokeDasharray="6 6" />}
        <RichPill x={X(gx)} y={Y(gy + 0.2)} text={tx.mTag(1, numt(m1, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />
        {!released && <RichPill x={X(bx + 0.25)} y={Y(gy + 0.2)} text={tx.mTag(2, numt(m2 * 1000, dec), U.g)} bg={COL.b2} size={fs - 0.5} box={box} />}
        {vel(X(gx), Y(gy + 0.2), st.u1, 1, COL.b1, narrow ? -24 : -32)}
        {vel(X(bx), Y(gy + 0.018), st.u2, 2, COL.b2, narrow ? -20 : -28)}
      </g>
    );
  } else if (pre.id === 'astro') {
    const ax = st.x1;
    const wx = st.x2;
    // the arm reaches for the wrench while throwing, then stays stretched forward
    const sh = { x: ax + 0.12, y: 1.3 };
    const reach = 0.62;
    const dx = clamp(wx - sh.x, 0.02, reach);
    const hand = { x: sh.x + dx, y: sh.y };
    const half = reach / 2;
    const drop = Math.sqrt(Math.max(0, half * half - (dx / 2) ** 2));
    const elbow = { x: sh.x + dx / 2, y: sh.y - drop };
    const armW = Math.max(5, 0.13 * k);
    const wrenchX = released ? wx : hand.x;
    scene = (
      <g>
        {/* faint stars */}
        {[
          [-4.2, 2.1],
          [-2.4, 0.4],
          [-1.2, 2.3],
          [1.6, 1.9],
          [3.1, 0.2],
          [4.3, 1.6],
          [-3.5, 0.05],
          [2.4, 0.15],
        ].map(([x, y], i) => (
          <circle key={i} cx={X(x)} cy={Y(y)} r={narrow ? 1.2 : 1.8} fill="#94a3b8" opacity="0.6" />
        ))}
        {/* astronaut: backpack, suit, helmet */}
        <rect x={X(ax - 0.42)} y={Y(1.55)} width={0.22 * k} height={0.75 * k} rx={0.06 * k} fill="#cbd5e1" stroke="#64748b" />
        <rect x={X(ax - 0.25)} y={Y(1.6)} width={0.5 * k} height={0.85 * k} rx={0.14 * k} fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
        <rect x={X(ax - 0.12)} y={Y(1.3)} width={0.24 * k} height={0.14 * k} rx={0.03 * k} fill={COL.b1} opacity="0.85" />
        <rect x={X(ax - 0.22)} y={Y(0.8)} width={0.17 * k} height={0.75 * k} rx={0.07 * k} fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
        <rect x={X(ax + 0.05)} y={Y(0.8)} width={0.17 * k} height={0.75 * k} rx={0.07 * k} fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
        <circle cx={X(ax)} cy={Y(1.85)} r={0.26 * k} fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
        <ellipse cx={X(ax + 0.08)} cy={Y(1.86)} rx={0.15 * k} ry={0.11 * k} fill="#1e3a8a" />
        <ellipse cx={X(ax + 0.03)} cy={Y(1.9)} rx={0.05 * k} ry={0.03 * k} fill="#fff" opacity="0.6" />
        <polyline
          points={`${X(sh.x)},${Y(sh.y)} ${X(elbow.x)},${Y(elbow.y)} ${X(hand.x)},${Y(hand.y)}`}
          fill="none"
          stroke="#64748b"
          strokeWidth={armW + 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={`${X(sh.x)},${Y(sh.y)} ${X(elbow.x)},${Y(elbow.y)} ${X(hand.x)},${Y(hand.y)}`}
          fill="none"
          stroke="#f8fafc"
          strokeWidth={armW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* wrench */}
        <g transform={`translate(${X(wrenchX).toFixed(1)} ${Y(sh.y).toFixed(1)}) rotate(${sim.t > mo.tau ? ((sim.t - mo.tau) * 260) % 360 : -70})`}>
          <rect x={-0.18 * k} y={-0.025 * k} width={0.36 * k} height={0.05 * k} rx={0.02 * k} fill={COL.b2} />
          <circle cx={0.18 * k} cy={0} r={0.055 * k} fill="none" stroke={COL.b2} strokeWidth={Math.max(2, 0.03 * k)} />
          <circle cx={-0.18 * k} cy={0} r={0.045 * k} fill={COL.b2} />
        </g>
        <RichPill x={X(ax)} y={Y(2.35)} text={tx.mTag(1, numt(m1, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />
        {!released && <RichPill x={X(hand.x + 0.55)} y={Y(sh.y + 0.45)} text={tx.mTag(2, numt(m2, dec), U.kg)} bg={COL.b2} size={fs - 0.5} box={box} />}
        {vel(X(ax), Y(2.35), st.u1, 1, COL.b1, narrow ? -24 : -32)}
        {vel(X(wx), Y(sh.y + 0.25), st.u2, 2, COL.b2, narrow ? -14 : -20)}
      </g>
    );
  } else {
    const sx = st.x1;
    const gx = st.x2;
    const burn = released && sim.t < mo.tau + 0.08;
    const P = (x, y) => `${X(sx + x).toFixed(1)},${Y(y).toFixed(1)}`;
    const hull = `M${P(-3, 1.1)} L${P(1.6, 1.1)} Q${P(3.4, 1.0)} ${P(3.6, 0)} Q${P(3.4, -1.0)} ${P(1.6, -1.1)} L${P(-3, -1.1)} Z`;
    const puffR = released ? Math.min(4, 0.6 + (sim.t - 0) * 30) : 0;
    scene = (
      <g>
        {[
          [-26, 4.2],
          [-17, -2.6],
          [-8, 4.6],
          [3, -3.2],
          [12, 4.1],
          [21, -2.3],
          [26, 2.8],
          [-22, 0.6],
          [16, 1],
        ].map(([x, y], i) => (
          <circle key={i} cx={X(x)} cy={Y(y)} r={narrow ? 1.2 : 1.8} fill="#94a3b8" opacity="0.6" />
        ))}
        {/* exhaust cloud = the thrown-off gas */}
        {released && gx > pre.box.x0 - 6 && (
          <g opacity={clamp(1 - sim.t * 3, 0.15, 0.9)}>
            <circle cx={X(Math.max(gx, pre.box.x0 + 1))} cy={Y(0)} r={puffR * k} fill={COL.b2} opacity="0.25" />
            <circle cx={X(Math.max(gx, pre.box.x0 + 1))} cy={Y(0)} r={puffR * 0.55 * k} fill={COL.b2} opacity="0.35" />
          </g>
        )}
        {!released && <ellipse cx={X(gx + 0.6)} cy={Y(0)} rx={0.9 * k} ry={0.55 * k} fill={COL.b2} opacity="0.5" />}
        {burn && <path d={`M${P(-3, 0.7)} L${P(-5.5, 0)} L${P(-3, -0.7)} Z`} fill="#f97316" opacity="0.85" />}
        {/* ship */}
        <path d={hull} fill="#f1f5f9" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x={X(sx - 3.4)} y={Y(0.75)} width={0.6 * k} height={1.5 * k} rx={0.15 * k} fill="#475569" />
        <path d={`M${P(-2.4, 1.1)} L${P(-3.4, 2.4)} L${P(-1.2, 1.1)} Z`} fill={COL.b1} />
        <path d={`M${P(-2.4, -1.1)} L${P(-3.4, -2.4)} L${P(-1.2, -1.1)} Z`} fill={COL.b1} />
        {[0.2, 1.4].map((x) => (
          <circle key={x} cx={X(sx + x)} cy={Y(0.25)} r={0.32 * k} fill="#bfdbfe" stroke="#475569" />
        ))}
        <RichPill x={X(sx)} y={Y(3.2)} text={tx.mTag(1, numt(m1, dec, 4), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />
        {!released && <RichPill x={X(gx)} y={Y(-1.6)} text={tx.mTag(2, numt(m2, dec), U.kg)} bg={COL.b2} size={fs - 0.5} box={box} />}
        {vel(X(sx), Y(3.2), st.u1, 1, COL.b1, narrow ? -24 : -32)}
        {vel(X(gx), Y(-1.9), st.u2, 2, COL.b2, 0)}
      </g>
    );
  }

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 18 : 27} />
      <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 60 : 100} xUnit={tx.axis} showY={false} decimal={dec} digits={axisStep < 1 ? 1 : 0} />
      {started && <line x1={X(cm0)} x2={X(cm0)} y1={Y(pre.box.y1)} y2={Y(pre.box.y0)} stroke={COL.sum} strokeWidth="1" strokeDasharray="2 5" opacity="0.5" />}
      {scene}
      <CmMarker x={X(cm)} y={Y(pre.id === 'carts' ? -0.075 : pre.id === 'gun' ? -0.18 : pre.id === 'astro' ? -0.25 : -3.1)} size={narrow ? 6 : 8} label={narrow ? null : tx.cmTag} fs={fs - 1} />
    </g>
  );
}
