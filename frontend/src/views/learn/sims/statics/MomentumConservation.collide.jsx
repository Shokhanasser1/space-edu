import { useMemo, useState } from 'react';
import { Activity, ArrowRightLeft, Lightbulb, Link2, Magnet, MoveRight, Weight } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import {
  CART,
  COL,
  Calc,
  Cart,
  CmMarker,
  EnergyBars,
  MomentumChart,
  Panel,
  PanelTitle,
  PlayButtons,
  RichPill,
  SimScene,
  Tag,
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
 * Two carts on a smooth horizontal track - a closed system: gravity and the
 * track's support cancel, friction is neglected, so the only forces that
 * change a cart's momentum are the carts' forces on each other.
 *
 * Springy bumpers (elastic): a linear spring acts for τ = 0.04 s; relative
 * motion δ(t) = v_r·sin(ωt)/ω, ω = π/τ, so after the contact
 *   v₁′ = ((m₁ − m₂)v₁ + 2m₂v₂)/(m₁ + m₂),  v₂′ = ((m₂ − m₁)v₂ + 2m₁v₁)/(m₁ + m₂)
 * and both momentum and kinetic energy are conserved.
 * Sticky bumpers (perfectly inelastic): the same squeeze until the relative
 * speed is zero (τ/2), then the carts stay together:
 *   v′ = (m₁v₁ + m₂v₂)/(m₁ + m₂),  Q = μv_r²/2 is lost to heat, μ = m₁m₂/(m₁+m₂).
 * The contact is at x = 0; the carts start so that they meet there.
 * Time runs 2× slower, and 20× slower during the short contact.
 */

const LH = 1.8; // m: end stops' inner faces at ±LH
const BUMP = 0.05; // m: each bumper (spring or sticky pad)
const TAU = 0.04; // s: contact time of the springy bumpers
const TS = 0.5; // sim seconds per real second
const TS_HIT = 0.05; // during the contact
const T_PRE = 1.0; // s: at most this long before the contact
const T_POST = 1.6; // s: at most this long after it
const BOX = { x0: -LH - 0.12, x1: LH + 0.12, y0: -0.27, y1: 0.66 };

const PRESETS = [
  { id: 'swap', m1: 1, v1: 2, m2: 1, v2: 0, elastic: true, icon: ArrowRightLeft },
  { id: 'stick', m1: 1, v1: 2, m2: 1, v2: 0, elastic: false, icon: Link2 },
  { id: 'heavy', m1: 3, v1: 2, m2: 1, v2: 0, elastic: true, icon: Weight },
  { id: 'light', m1: 1, v1: 2.5, m2: 4, v2: 0, elastic: true, icon: MoveRight },
];

/** The whole motion of the two carts, analytic. */
function collision(m1, v1, m2, v2, elastic) {
  const L = CART.L;
  const M = m1 + m2;
  const mu = (m1 * m2) / M;
  const vr = v1 - v2;
  const meet = vr > 1e-9;
  const w = Math.PI / TAU;
  const E0 = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const P = m1 * v1 + m2 * v2;
  const V = P / M;
  const v1f = meet ? (elastic ? ((m1 - m2) * v1 + 2 * m2 * v2) / M : V) : v1;
  const v2f = meet ? (elastic ? ((m2 - m1) * v2 + 2 * m1 * v1) / M : V) : v2;
  const Q = meet && !elastic ? 0.5 * mu * vr * vr : 0;
  const F0 = mu * w * Math.max(vr, 0); // peak contact force

  if (!meet) {
    const x10 = -0.5 - L / 2;
    const x20 = 0.5 + L / 2;
    const hits = [T_POST + 0.4];
    if (v1 < 0) hits.push((x10 - L / 2 + LH) / -v1);
    if (v1 > 0) hits.push((LH - L / 2 - x10) / v1);
    if (v2 > 0) hits.push((LH - x20 - L / 2) / v2);
    if (v2 < 0) hits.push((x20 - L / 2 + LH) / -v2);
    const tEnd = Math.max(0.2, Math.min(...hits));
    const at = (t) => ({ x1: x10 + v1 * t, x2: x20 + v2 * t, v1, v2, F: 0, d: 0, Ep: 0, Q: 0 });
    return { meet, tc: Infinity, te: Infinity, tEnd, at, x10, x20, v1f, v2f, E0, P, V, Q, F0, mu };
  }

  const x1c = -BUMP - L / 2;
  const x2c = BUMP + L / 2;
  const A = LH - L - BUMP - 0.04;
  const tc = Math.min(T_PRE, A / Math.max(Math.abs(v1), Math.abs(v2), 1e-6));
  const x10 = x1c - v1 * tc;
  const x20 = x2c - v2 * tc;
  const tauEff = elastic ? TAU : TAU / 2;
  const te = tc + tauEff;
  const inside = (tp) => {
    const f = 1 - Math.cos(w * tp);
    const s = tp - Math.sin(w * tp) / w;
    const d = (vr * Math.sin(w * tp)) / w;
    const e = 0.5 * mu * vr * vr * Math.sin(w * tp) ** 2;
    return {
      x1: x1c + v1 * tp - (mu / m1) * vr * s,
      x2: x2c + v2 * tp + (mu / m2) * vr * s,
      v1: v1 - (mu / m1) * vr * f,
      v2: v2 + (mu / m2) * vr * f,
      F: mu * w * vr * Math.sin(w * tp),
      d,
      Ep: elastic ? e : 0,
      Q: elastic ? 0 : e,
    };
  };
  const end = inside(tauEff);
  const dEnd = elastic ? 0 : vr / w;
  const hits = [T_POST];
  if (v1f < -1e-9) hits.push((end.x1 - L / 2 + LH) / -v1f);
  if (v2f > 1e-9) hits.push((LH - end.x2 - L / 2) / v2f);
  const tEnd = te + Math.max(0.25, Math.min(...hits));
  const at = (t) => {
    if (t <= tc) return { x1: x10 + v1 * t, x2: x20 + v2 * t, v1, v2, F: 0, d: 0, Ep: 0, Q: 0 };
    if (t < te) return inside(t - tc);
    const dt = t - te;
    return { x1: end.x1 + v1f * dt, x2: end.x2 + v2f * dt, v1: v1f, v2: v2f, F: 0, d: dEnd, Ep: 0, Q };
  };
  return { meet, tc, te, tEnd, at, x10, x20, v1f, v2f, E0, P, V, Q, F0, mu };
}

/** Moves sim time on by `dtReal` real seconds, slower inside the contact. */
function advance(mo, t0, dtReal) {
  let t = t0;
  let rem = dtReal;
  for (let i = 0; i < 4 && rem > 1e-9 && t < mo.tEnd; i += 1) {
    const inHit = mo.meet && t >= mo.tc && t < mo.te;
    const rate = inHit ? TS_HIT : TS;
    const boundary = mo.meet ? (t < mo.tc ? mo.tc : t < mo.te ? mo.te : mo.tEnd) : mo.tEnd;
    const step = rem * rate;
    if (t + step >= boundary) {
      rem -= (boundary - t) / rate;
      t = boundary;
    } else {
      t += step;
      rem = 0;
    }
  }
  return Math.min(t, mo.tEnd);
}

const IDLE = { t: 0, running: false, done: false };

export default function CollideSim({ T }) {
  const tx = T.collide;
  const U = T.u;
  const dec = T.decimal;
  const [preset, setPreset] = useState('swap');
  const [m1, setM1] = useState(1);
  const [v1, setV1] = useState(2);
  const [m2, setM2] = useState(1);
  const [v2, setV2] = useState(0);
  const [elastic, setElastic] = useState(true);
  const [sim, setSim] = useState(IDLE);
  const mo = useMemo(() => collision(m1, v1, m2, v2, elastic), [m1, v1, m2, v2, elastic]);
  const st = mo.at(sim.t);
  const started = sim.t > 0 || sim.running;
  const phase = !mo.meet ? 'apart' : sim.t < mo.tc ? 'before' : sim.t < mo.te ? 'hit' : 'after';

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = advance(mo, p.t, dt);
      if (t >= mo.tEnd - 1e-9) return { t: mo.tEnd, running: false, done: true };
      return { ...p, t };
    });
  });

  const stop = () => setSim(IDLE);
  const toggle = () => setSim((p) => (p.done ? { t: 0, running: true, done: false } : { ...p, running: !p.running }));
  const match = (a, b, c, d, e) => PRESETS.find((p) => p.m1 === a && p.v1 === b && p.m2 === c && p.v2 === d && p.elastic === e)?.id ?? 'custom';
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setM1(p.m1);
    setV1(p.v1);
    setM2(p.m2);
    setV2(p.v2);
    setElastic(p.elastic);
    stop();
  };
  const change = (setter, key) => (val) => {
    setter(val);
    const next = { m1, v1, m2, v2, elastic, [key]: val };
    setPreset(match(next.m1, next.v1, next.m2, next.v2, next.elastic));
    stop();
  };

  /* ---- numbers */
  const f2 = (v) => sfmt(v, 2, dec);
  const kg = (m) => `${numt(m, dec)} ${U.kg}`;
  const p1 = m1 * st.v1;
  const p2 = m2 * st.v2;
  const p1b = m1 * v1;
  const p2b = m2 * v2;
  const Ek = 0.5 * m1 * st.v1 ** 2 + 0.5 * m2 * st.v2 ** 2;
  const Ekf = 0.5 * m1 * mo.v1f ** 2 + 0.5 * m2 * mo.v2f ** 2;
  const pct = mo.E0 > 0 ? (mo.Q / mo.E0) * 100 : 0;

  /* ---- words */
  let key = 'idle';
  if (!mo.meet) key = 'apart';
  else if (phase === 'hit') key = elastic ? 'hitElastic' : 'hitSticky';
  else if (phase === 'after') {
    if (!elastic) key = Math.abs(mo.V) < 1e-9 ? 'doneStop' : 'doneSticky';
    else if (m1 === m2) key = 'doneSwap';
    else if (mo.v1f < -1e-9) key = 'doneRebound';
    else if (m1 > m2) key = 'doneHeavy';
    else key = 'doneElastic';
  } else if (started) key = 'before';
  const settled = useSettled(key, key === 'before' ? 150 : 0);
  const ex = tx.explain;
  let text;
  if (settled === 'apart') text = ex.apart(f2(mo.P));
  else if (settled === 'before') text = ex.before(f2(mo.P), f2(mo.V));
  else if (settled === 'hitElastic') text = ex.hitElastic;
  else if (settled === 'hitSticky') text = ex.hitSticky;
  else if (settled === 'doneSwap') text = ex.doneSwap(f2(mo.v1f), f2(mo.v2f));
  else if (settled === 'doneRebound') text = ex.doneRebound(f2(mo.v1f), f2(mo.v2f), f2(mo.P));
  else if (settled === 'doneHeavy') text = ex.doneHeavy(f2(mo.v1f), f2(mo.v2f), f2(mo.P), fmt(mo.E0, 2, dec));
  else if (settled === 'doneElastic') text = ex.doneElastic(f2(mo.P), fmt(mo.E0, 2, dec));
  else if (settled === 'doneSticky') text = ex.doneSticky(f2(mo.V), fmt(mo.E0, 2, dec), fmt(Ekf, 2, dec), fmt(mo.Q, 2, dec), fmt(pct, 0, dec));
  else if (settled === 'doneStop') text = ex.doneStop(fmt(mo.E0, 2, dec));
  else text = ex.idle(f2(mo.P));
  const tone =
    settled === 'idle' || settled === 'apart'
      ? '#22d3ee'
      : settled.startsWith('hit')
        ? '#f87171'
        : settled === 'doneSticky' || settled === 'doneStop'
          ? '#fb923c'
          : settled.startsWith('done')
            ? '#34d399'
            : '#fbbf24';

  const legend = [
    { label: tx.legend.cart1, color: COL.b1, kind: 'square' },
    { label: tx.legend.cart2, color: COL.b2, kind: 'square' },
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
    { label: tx.legend.force, color: COL.force, kind: 'arrow' },
    { label: tx.legend.cm, color: COL.sum, kind: 'dot' },
  ];
  const chip = (W, narrow) => {
    const hot = phase === 'hit';
    const words = hot ? (narrow ? T.common.slowShort(20) : tx.chipHit) : narrow ? T.common.slowShort(2) : T.common.slow(2);
    return <TimeChip text={words} hot={hot} extra={narrow ? null : tx.phase[phase === 'apart' ? 'before' : phase]} />;
  };

  /* ---- graph samples (the whole motion is known) */
  const series = useMemo(() => {
    const ts = [];
    const n = 140;
    for (let i = 0; i <= n; i += 1) ts.push((mo.tEnd * i) / n);
    if (mo.meet) for (let i = 0; i <= 24; i += 1) ts.push(mo.tc + ((mo.te - mo.tc) * i) / 24);
    ts.sort((a, b) => a - b);
    return ts.map((t) => {
      const s = mo.at(t);
      return { t, p1: m1 * s.v1, p2: m2 * s.v2 };
    });
  }, [mo, m1, m2]);
  const upto = series.filter((s) => s.t <= sim.t + 1e-9);
  const pts = [...upto, { t: sim.t, p1, p2 }];
  const pMax = niceMax(Math.max(Math.abs(p1b), Math.abs(p2b), Math.abs(m1 * mo.v1f), Math.abs(m2 * mo.v2f), Math.abs(mo.P), 0.5));
  const eMax = niceMax(Math.max(mo.E0, 0.5));
  const after = phase === 'after' || (phase === 'apart' && sim.done);
  const nowLabel = phase === 'after' ? tx.chart.after : tx.chart.now;

  const vPrime = (i) => (phase === 'after' ? `v_${i}′` : `v_${i}`);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={preset}
        onChange={pickPreset}
        accent="#60a5fa"
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} done={sim.done} onToggle={toggle} onReset={stop} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={chip}
        ariaLabel={tx.sceneLabel(kg(m1), f2(st.v1), kg(m2), f2(st.v2), f2(p1 + p2))}
        height={(W, narrow) => (narrow ? clamp(W * 0.5, 180, 260) : clamp(W * 0.27, 290, 340))}
      >
        {(W, H, narrow) => (
          <CollideDrawing W={W} H={H} narrow={narrow} mo={mo} st={st} m1={m1} m2={m2} elastic={elastic} phase={phase} started={started} T={T} vPrime={vPrime} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.p1}
          symbol="p₁"
          value={f2(p1)}
          unit={U.kgms}
          accent={COL.b1}
          textColor={COL.b1Text}
          sub={tx.readouts.pSub(1, kg(m1), f2(st.v1), T.ms)}
          active={started}
        />
        <Readout
          label={tx.readouts.p2}
          symbol="p₂"
          value={f2(p2)}
          unit={U.kgms}
          accent={COL.b2}
          textColor={COL.b2Text}
          sub={tx.readouts.pSub(2, kg(m2), f2(st.v2), T.ms)}
          active={started}
        />
        <Readout
          label={tx.readouts.sum}
          symbol="p₁ + p₂"
          value={f2(p1 + p2)}
          unit={U.kgms}
          accent={COL.sum}
          textColor={COL.sumText}
          sub={tx.readouts.sumSub(f2(mo.P))}
          active={started}
        />
        <Readout
          label={tx.readouts.ek}
          symbol="Eₖ"
          value={fmt(Ek, 2, dec)}
          unit={U.J}
          accent={COL.ek}
          textColor={COL.ekText}
          sub={
            after && mo.meet
              ? elastic
                ? tx.readouts.ekKept(fmt(mo.E0, 2, dec))
                : tx.readouts.ekLost(fmt(mo.Q, 2, dec), fmt(pct, 0, dec))
              : phase === 'hit'
                ? elastic
                  ? tx.readouts.ekSpring(fmt(st.Ep, 2, dec))
                  : tx.readouts.ekHeat(fmt(st.Q, 2, dec))
                : tx.readouts.ekBefore(fmt(mo.E0, 2, dec))
          }
          active={started}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <div>
            <PanelTitle>{tx.bumperLabel}</PanelTitle>
            <Segmented
              label={tx.bumperLabel}
              className="grid-cols-2"
              value={elastic ? 'elastic' : 'sticky'}
              onChange={(v) => change(setElastic, 'elastic')(v === 'elastic')}
              accent={elastic ? '#a78bfa' : '#fb923c'}
              options={[
                { value: 'elastic', label: tx.bumpers.elastic.name, sub: tx.bumpers.elastic.sub, icon: Activity },
                { value: 'sticky', label: tx.bumpers.sticky.name, sub: tx.bumpers.sticky.sub, icon: Magnet },
              ]}
            />
          </div>
          <RangeField id="mc-m1" label={tx.m1} symbol="m₁" min={0.5} max={4} step={0.5} value={m1} onChange={change(setM1, 'm1')} accent={COL.b1} display={kg(m1)} hint={tx.massHint} />
          <RangeField
            id="mc-v1"
            label={tx.v1}
            symbol="v₁"
            min={-3}
            max={3}
            step={0.5}
            value={v1}
            onChange={change(setV1, 'v1')}
            accent={COL.b1}
            display={`${fmtt(v1, 1, dec)} ${T.ms}`}
          />
          <RangeField id="mc-m2" label={tx.m2} symbol="m₂" min={0.5} max={4} step={0.5} value={m2} onChange={change(setM2, 'm2')} accent={COL.b2} display={kg(m2)} />
          <RangeField
            id="mc-v2"
            label={tx.v2}
            symbol="v₂"
            min={-3}
            max={3}
            step={0.5}
            value={v2}
            onChange={change(setV2, 'v2')}
            accent={COL.b2}
            display={`${fmtt(v2, 1, dec)} ${T.ms}`}
            hint={tx.vHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{tx.closed.title}</p>
            <p className="mt-1">{tx.closed.text}</p>
          </div>
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          <MomentumChart
            title={tx.chart.title}
            beforeLabel={tx.chart.before}
            nowLabel={nowLabel}
            rows={[
              { id: 'p1', label: 'p_1', color: COL.b1Line, text: COL.b1Text, before: p1b, now: p1 },
              { id: 'p2', label: 'p_2', color: COL.b2Line, text: COL.b2Text, before: p2b, now: p2 },
              { id: 'sum', label: 'Σp', color: COL.sumLine, text: COL.sumText, before: mo.P, now: p1 + p2, sum: true },
            ]}
            max={pMax}
            unit={U.kgms}
            dec={dec}
            ariaLabel={tx.chart.label(f2(p1b), f2(p2b), f2(p1), f2(p2), f2(mo.P))}
            note={tx.chart.note}
          />
          <Calc
            title={tx.calc.title}
            rows={calcRows(tx, U, T, dec, m1, v1, m2, v2, elastic, mo)}
            note={mo.meet ? tx.calc.note : tx.calc.noteApart}
          />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <EnergyBars
            title={tx.energy.title}
            cols={[
              { id: 'ek', label: 'E_k', color: COL.ek, text: COL.ekText, value: Ek, sub: tx.energy.ek },
              { id: 'ep', label: 'E_p', color: COL.ep, text: COL.epText, value: st.Ep, sub: tx.energy.ep, dim: !elastic },
              { id: 'q', label: 'Q', color: COL.heat, text: COL.heatText, value: st.Q, sub: tx.energy.q, dim: elastic },
              { id: 'e', label: 'E', color: '#94a3b8', text: COL.total, value: Ek + st.Ep + st.Q, sub: tx.energy.e },
            ]}
            max={eMax}
            level={mo.E0}
            levelLabel={tx.energy.level(fmt(mo.E0, 2, dec))}
            unit={U.J}
            dec={dec}
            note={elastic ? tx.energy.noteElastic : tx.energy.noteSticky}
            ariaLabel={tx.energy.label(fmt(Ek, 2, dec), fmt(st.Ep, 2, dec), fmt(st.Q, 2, dec))}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={tx.graph.title}
            series={[
              { id: 'p1', label: 'p₁', color: COL.b1Line, points: pts.map((s) => ({ x: s.t, y: s.p1 })) },
              { id: 'p2', label: 'p₂', color: COL.b2Line, points: pts.map((s) => ({ x: s.t, y: s.p2 })) },
              { id: 'sum', label: 'p₁ + p₂', color: COL.sumLine, dash: '6 5', points: pts.map((s) => ({ x: s.t, y: s.p1 + s.p2 })) },
            ]}
            xMax={mo.tEnd}
            yMax={pMax}
            yMin={-pMax}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            marker={sim.t}
            decimal={dec}
            xDigits={1}
            yDigits={pMax < 2 ? 1 : 0}
            height={190}
            note={tx.graph.note}
            ariaLabel={tx.graph.label}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ calculation */

function calcRows(tx, U, T, dec, m1, v1, m2, v2, elastic, mo) {
  const n = (x) => numt(x, dec);
  const v = (x) => par(fmtt(x, 2, dec));
  const r2 = (x) => sfmt(x, 2, dec);
  const rows = [
    {
      sym: 'p',
      color: COL.sumText,
      formula: 'm₁v₁ + m₂v₂',
      subst: `${n(m1)}·${v(v1)} + ${n(m2)}·${v(v2)}`,
      result: `${r2(mo.P)} ${U.kgms}`,
    },
  ];
  if (!mo.meet) return rows;
  if (elastic) {
    rows.push(
      {
        sym: 'v₁′',
        color: COL.b1Text,
        formula: '((m₁ − m₂)v₁ + 2m₂v₂) / (m₁ + m₂)',
        subst: `(${par(fmtt(m1 - m2, 2, dec))}·${v(v1)} + 2·${n(m2)}·${v(v2)}) / ${n(m1 + m2)}`,
        result: `${r2(mo.v1f)} ${T.ms}`,
      },
      {
        sym: 'v₂′',
        color: COL.b2Text,
        formula: '((m₂ − m₁)v₂ + 2m₁v₁) / (m₁ + m₂)',
        subst: `(${par(fmtt(m2 - m1, 2, dec))}·${v(v2)} + 2·${n(m1)}·${v(v1)}) / ${n(m1 + m2)}`,
        result: `${r2(mo.v2f)} ${T.ms}`,
      },
      {
        sym: 'p′',
        color: COL.sumText,
        formula: 'm₁v₁′ + m₂v₂′',
        subst: `${n(m1)}·${par(r2(mo.v1f))} + ${n(m2)}·${par(r2(mo.v2f))}`,
        result: `${r2(m1 * mo.v1f + m2 * mo.v2f)} ${U.kgms}`,
      },
    );
  } else {
    const Ekf = 0.5 * (m1 + m2) * mo.V ** 2;
    rows.push(
      {
        sym: 'v′',
        color: COL.velText,
        formula: '(m₁v₁ + m₂v₂) / (m₁ + m₂)',
        subst: `${par(r2(mo.P))} / ${n(m1 + m2)}`,
        result: `${r2(mo.V)} ${T.ms}`,
      },
      {
        sym: 'Q',
        color: COL.heatText,
        formula: 'Eₖ − Eₖ′',
        subst: `${fmt(mo.E0, 2, dec)} − ${fmt(Ekf, 2, dec)}`,
        result: `${fmt(mo.Q, 2, dec)} ${U.J}`,
      },
    );
  }
  return rows;
}

/* ----------------------------------------------------------------- scene */

function CollideDrawing({ W, H, narrow, mo, st, m1, m2, elastic, phase, started, T, vPrime }) {
  const tx = T.collide;
  const U = T.u;
  const dec = T.decimal;
  const pad = narrow ? { l: 6, r: 6, t: 40, b: 24 } : { l: 14, r: 14, t: 52, b: 26 };
  const view = makeView(BOX, W, H, pad);
  const k = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const L = CART.L;
  const f2 = (v) => sfmt(v, 2, dec);

  const half = (BUMP - st.d / 2) * k; // each bumper's drawn length, px
  const yB = Y(0.11);
  const face1 = X(st.x1 + L / 2);
  const face2 = X(st.x2 - L / 2);

  const bumper = (face, dir, color) => {
    const tip = face + dir * half;
    if (elastic) {
      return (
        <g>
          <path d={springPath(face, tip - dir * 2, yB, Math.max(2.5, 0.02 * k), 4)} fill="none" stroke="#475569" strokeWidth={narrow ? 1.3 : 2} strokeLinejoin="round" />
          <line x1={tip} x2={tip} y1={yB - Math.max(4, 0.035 * k)} y2={yB + Math.max(4, 0.035 * k)} stroke="#334155" strokeWidth={narrow ? 2 : 3} strokeLinecap="round" />
        </g>
      );
    }
    const h = Math.max(6, 0.08 * k);
    const x = Math.min(face, tip);
    const w = Math.abs(tip - face);
    const ticks = [];
    for (let yy = yB - h / 2 + 2; yy < yB + h / 2 - 1; yy += narrow ? 2.5 : 3.2) {
      ticks.push(<line key={yy} x1={tip - dir * Math.min(3, w * 0.4)} x2={tip} y1={yy} y2={yy + 1.2} stroke={color} strokeWidth="1" />);
    }
    return (
      <g>
        <rect x={x} y={yB - h / 2} width={w} height={h} rx={Math.min(3, w / 3)} fill="#fde68a" stroke={color} strokeWidth="1.2" />
        {ticks}
      </g>
    );
  };

  const stack1 = cartTop(m1);
  const stack2 = cartTop(m2);
  const kV = narrow ? 18 : 42; // px per m/s
  const velArrow = (xc, v, stack, i, color) => {
    const yTop = Y(stack);
    const ya = yTop - (narrow ? 26 : 36);
    const from = X(xc);
    const len = v * kV;
    const label = tx.vTag(vPrime(i), f2(v), T.ms);
    const pw = pillWidth(label, fs);
    const py = ya - (narrow ? 14 : 18);
    // cart 1's value hangs to the left of its centre, cart 2's to the right: they never meet
    const px = i === 1 ? from + (narrow ? 6 : 12) - pw / 2 : from - (narrow ? 6 : 12) + pw / 2;
    return (
      <g>
        {Math.abs(len) > 3 ? (
          <Arrow x1={from} y1={ya} x2={from + len} y2={ya} color={COL.vel} width={narrow ? 2.4 : 3.2} head={narrow ? 8 : 12} />
        ) : (
          <circle cx={from} cy={ya} r={narrow ? 2.5 : 3.5} fill={COL.vel} />
        )}
        <RichPill x={px} y={py} text={label} bg={color} size={fs} box={box} />
      </g>
    );
  };

  const fLen = (narrow ? 34 : 70) * (mo.F0 > 0 ? st.F / mo.F0 : 0);
  const yF = Y(-0.075);
  const cmX = (m1 * st.x1 + m2 * st.x2) / (m1 + m2);
  const axisDigits = niceStep(k, narrow ? 60 : 100) < 1 ? 1 : 0;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 18 : 27} />
      <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 60 : 100} xUnit={tx.axis} showY={false} decimal={dec} digits={axisDigits} />

      {/* track and end stops */}
      <rect x={X(-LH - 0.08)} y={Y(0)} width={(2 * LH + 0.16) * k} height={Math.max(4, 0.035 * k)} rx={3} fill="#cbd5e1" />
      <line x1={X(-LH - 0.08)} x2={X(LH + 0.08)} y1={Y(0)} y2={Y(0)} stroke="#64748b" strokeWidth="1.5" />
      {[-1, 1].map((s) => (
        <rect key={s} x={s < 0 ? X(-LH - 0.07) : X(LH)} y={Y(0.16)} width={0.07 * k} height={0.16 * k} rx={2} fill="#64748b" />
      ))}

      {/* contact point */}
      {mo.meet && (
        <line x1={X(0)} x2={X(0)} y1={Y(0.0)} y2={Y(0.3)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 4" opacity={phase === 'before' || !started ? 0.8 : 0.35} />
      )}

      {bumper(face1, 1, COL.b1)}
      {bumper(face2, -1, COL.b2)}
      <Cart view={view} xc={st.x1} color={COL.b1} label="1" mass={m1} roll={st.x1 - mo.x10} fs={fs} />
      <Cart view={view} xc={st.x2} color={COL.b2} label="2" mass={m2} roll={st.x2 - mo.x20} fs={fs} />

      {/* mass labels */}
      <RichPill x={X(st.x1) + 10 - pillWidth(tx.mTag(1, numt(m1, dec), U.kg), fs - 0.5) / 2} y={Y(stack1) - (narrow ? 10 : 14)} text={tx.mTag(1, numt(m1, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />
      <RichPill x={X(st.x2) - 10 + pillWidth(tx.mTag(2, numt(m2, dec), U.kg), fs - 0.5) / 2} y={Y(stack2) - (narrow ? 10 : 14)} text={tx.mTag(2, numt(m2, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />

      {/* velocities */}
      {velArrow(st.x1, st.v1, stack1, 1, COL.b1)}
      {velArrow(st.x2, st.v2, stack2, 2, COL.b2)}

      {/* contact forces, equal and opposite */}
      {phase === 'hit' && fLen > 3 && (
        <g>
          {/* drawn just under the track, from the point where the bumpers touch */}
          <line x1={(face1 + face2) / 2} x2={(face1 + face2) / 2} y1={yB} y2={yF} stroke={COL.force} strokeWidth="1.2" strokeDasharray="2 3" />
          {[
            [-1, 'F_21'],
            [1, 'F_12'],
          ].map(([dir, name]) => {
            const x0 = (face1 + face2) / 2 + dir * 3;
            return (
              <g key={name}>
                <Arrow x1={x0} y1={yF} x2={x0 + dir * fLen} y2={yF} color={COL.force} width={narrow ? 2.4 : 3.2} head={narrow ? 8 : 11} />
                <Tag x={x0 + dir * (fLen + 5)} y={yF + 5} text={name} color={COL.force} size={fs + 1} anchor={dir < 0 ? 'end' : 'start'} />
              </g>
            );
          })}
        </g>
      )}

      {/* centre of mass */}
      <CmMarker x={X(cmX)} y={Y(-0.15)} size={narrow ? 6 : 8} label={narrow ? null : tx.cmTag(f2(mo.V))} fs={fs - 1} />
    </g>
  );
}
