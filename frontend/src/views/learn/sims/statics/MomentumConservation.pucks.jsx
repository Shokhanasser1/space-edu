import { useMemo, useState } from 'react';
import { Disc3, Lightbulb, Link2, Target, Weight } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, textWidth, useElementSize, useRafLoop } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import { COL, Panel, PanelTitle, PlayButtons, RichPill, SimScene, TimeChip, Toolbar, numt, par, rich, richSvg, sfmt } from './MomentumConservation.parts';

/**
 * Two pucks on an air-hockey table, seen from above. Puck 1 slides at v₁
 * along a line b off the centre of puck 2, which is at rest. Momentum is a
 * vector: p₁ + p₂ is the same before and after, component by component.
 *
 * Elastic: smooth discs, the impulse acts along the line of centres n:
 *   J = 2μ(v₁·n),  v₁′ = v₁ − (J/m₁)n,  v₂′ = (J/m₂)n  (μ = m₁m₂/(m₁+m₂)).
 * Equal masses then fly apart at 90°.
 * Sticky: the pucks join into one rigid body; its centre of mass moves at
 * V = m₁v₁/(m₁+m₂) and it spins at ω = L/I (angular momentum about the
 * centre of mass, I includes each disc's own mr²/2). The kinetic energy left
 * is MV²/2 + Iω²/2; the rest becomes heat. Time runs 2× slower.
 */

const R = 0.08; // m, puck radius
const XT = 1.2; // table half-length
const YT = 0.7; // table half-width
const X10 = -0.95;
const TS = 0.5;
const T_POST = 1.6;
const BOX = { x0: -XT - 0.06, x1: XT + 0.06, y0: -YT - 0.06, y1: YT + 0.06 };

const PRESETS = [
  { id: 'billiard', m1: 0.2, m2: 0.2, v: 2, b: 8, elastic: true, icon: Target },
  { id: 'central', m1: 0.2, m2: 0.2, v: 2, b: 0, elastic: true, icon: Disc3 },
  { id: 'sticky', m1: 0.2, m2: 0.2, v: 2, b: 8, elastic: false, icon: Link2 },
  { id: 'heavy', m1: 0.1, m2: 0.4, v: 2, b: 6, elastic: true, icon: Weight },
];

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const len = (a) => Math.hypot(a.x, a.y);

/** Time until a point at p moving at v leaves the box |x| ≤ ax, |y| ≤ ay. */
function exitTime(p, v, ax, ay) {
  let t = Infinity;
  if (v.x > 1e-9) t = Math.min(t, (ax - p.x) / v.x);
  if (v.x < -1e-9) t = Math.min(t, (-ax - p.x) / v.x);
  if (v.y > 1e-9) t = Math.min(t, (ay - p.y) / v.y);
  if (v.y < -1e-9) t = Math.min(t, (-ay - p.y) / v.y);
  return Math.max(0, t);
}

function motion(m1, m2, v, bcm, elastic) {
  const b = bcm / 100;
  const M = m1 + m2;
  const u1 = { x: v, y: 0 };
  const r10 = { x: X10, y: b };
  const r20 = { x: 0, y: 0 };
  const P = mul(u1, m1);
  const E0 = 0.5 * m1 * v * v;
  const hit = Math.abs(b) < 2 * R - 1e-9;
  if (!hit) {
    const tEnd = (XT - R - 0.07 - X10) / v;
    const at = (t) => ({ r1: add(r10, mul(u1, t)), r2: r20, v1: u1, v2: { x: 0, y: 0 } });
    return { hit, tc: Infinity, tEnd, at, P, E0, Ek: E0, Q: 0, n: null };
  }
  const xc = -Math.sqrt(4 * R * R - b * b);
  const tc = (xc - X10) / v;
  const r1c = { x: xc, y: b };
  const n = { x: -xc / (2 * R), y: -b / (2 * R) }; // from puck 1 to puck 2
  if (elastic) {
    const mu = (m1 * m2) / M;
    const J = 2 * mu * (u1.x * n.x + u1.y * n.y);
    const v1f = add(u1, mul(n, -J / m1));
    const v2f = mul(n, J / m2);
    const tAfter = Math.min(T_POST, Math.max(exitTime(r1c, v1f, XT - R - 0.07, YT - R - 0.07), 0.25) , Math.max(exitTime(r20, v2f, XT - R - 0.07, YT - R - 0.07), 0.25));
    const at = (t) => {
      if (t <= tc) return { r1: add(r10, mul(u1, t)), r2: r20, v1: u1, v2: { x: 0, y: 0 } };
      const d = t - tc;
      return { r1: add(r1c, mul(v1f, d)), r2: add(r20, mul(v2f, d)), v1: v1f, v2: v2f };
    };
    return { hit, tc, tEnd: tc + tAfter, at, P, E0, Ek: E0, Q: 0, n, v1f, v2f };
  }
  // sticky: a rigid pair moving and spinning
  const rc = mul(add(mul(r1c, m1), mul(r20, m2)), 1 / M);
  const V = mul(P, 1 / M);
  const d1 = add(r1c, mul(rc, -1));
  const d2 = add(r20, mul(rc, -1));
  const L = m1 * (d1.x * (u1.y - V.y) - d1.y * (u1.x - V.x)) + m2 * (d2.x * (0 - V.y) - d2.y * (0 - V.x));
  const I = m1 * (d1.x ** 2 + d1.y ** 2) + m2 * (d2.x ** 2 + d2.y ** 2) + 0.5 * (m1 + m2) * R * R;
  const w = L / I;
  const Ek = 0.5 * M * (V.x ** 2 + V.y ** 2) + 0.5 * I * w * w;
  const reachMax = Math.max(len(d1), len(d2)) + R;
  const tAfter = Math.min(T_POST, Math.max(0.3, exitTime(rc, V, XT - reachMax - 0.07, YT - reachMax - 0.07)));
  const rot = (d, a) => ({ x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) });
  const spinV = (d) => ({ x: -w * d.y, y: w * d.x });
  const at = (t) => {
    if (t <= tc) return { r1: add(r10, mul(u1, t)), r2: r20, v1: u1, v2: { x: 0, y: 0 } };
    const s = t - tc;
    const c = add(rc, mul(V, s));
    const e1 = rot(d1, w * s);
    const e2 = rot(d2, w * s);
    return { r1: add(c, e1), r2: add(c, e2), v1: add(V, spinV(e1)), v2: add(V, spinV(e2)), c };
  };
  return { hit, tc, tEnd: tc + tAfter, at, P, E0, Ek, Q: E0 - Ek, n, V, w };
}

const IDLE = { t: 0, running: false, done: false };

export default function PucksSim({ T }) {
  const tx = T.pucks;
  const U = T.u;
  const dec = T.decimal;
  const [preset, setPreset] = useState('billiard');
  const [m1, setM1] = useState(0.2);
  const [m2, setM2] = useState(0.2);
  const [v, setV] = useState(2);
  const [b, setB] = useState(8);
  const [elastic, setElastic] = useState(true);
  const [sim, setSim] = useState(IDLE);
  const mo = useMemo(() => motion(m1, m2, v, b, elastic), [m1, m2, v, b, elastic]);
  const st = mo.at(sim.t);
  const started = sim.t > 0 || sim.running;
  const after = mo.hit && sim.t > mo.tc;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = p.t + dt * TS;
      if (t >= mo.tEnd) return { t: mo.tEnd, running: false, done: true };
      return { ...p, t };
    });
  });

  const stop = () => setSim(IDLE);
  const toggle = () => setSim((p) => (p.done ? { t: 0, running: true, done: false } : { ...p, running: !p.running }));
  const near = (a, c) => Math.abs(a - c) < 1e-9;
  const match = (o) => PRESETS.find((p) => near(p.m1, o.m1) && near(p.m2, o.m2) && near(p.v, o.v) && p.b === o.b && p.elastic === o.elastic)?.id ?? 'custom';
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setM1(p.m1);
    setM2(p.m2);
    setV(p.v);
    setB(p.b);
    setElastic(p.elastic);
    stop();
  };
  const change = (setter, key) => (val) => {
    setter(val);
    setPreset(match({ m1, m2, v, b, elastic, [key]: val }));
    stop();
  };

  /* ---- numbers */
  const p1 = mul(st.v1, m1);
  const p2 = mul(st.v2, m2);
  const ps = add(p1, p2);
  // a stuck pair also spins about its centre of mass (each disc turns too): its energy is the constant mo.Ek
  const Ek = after && !elastic ? mo.Ek : 0.5 * m1 * len(st.v1) ** 2 + 0.5 * m2 * len(st.v2) ** 2;
  const f2 = (x) => sfmt(x, 2, dec);
  const angle =
    mo.hit && elastic && len(mo.v1f) > 1e-6 && len(mo.v2f) > 1e-6
      ? (Math.acos(clamp((mo.v1f.x * mo.v2f.x + mo.v1f.y * mo.v2f.y) / (len(mo.v1f) * len(mo.v2f)), -1, 1)) * 180) / Math.PI
      : null;
  const pct = mo.E0 > 0 ? (mo.Q / mo.E0) * 100 : 0;

  /* ---- words */
  let key = 'idle';
  if (!mo.hit) key = started ? 'miss' : 'idleMiss';
  else if (after) {
    if (!elastic) key = 'doneSticky';
    else if (b === 0) key = near(m1, m2) ? 'doneCentral' : 'doneLine';
    else if (near(m1, m2)) key = 'doneRight';
    else key = 'doneElastic';
  } else if (started) key = 'before';
  // no debounce: each text needs the numbers of the case it names, and those change with the preset
  const settled = key;
  const ex = tx.explain;
  let text;
  if (settled === 'idleMiss' || settled === 'miss') text = ex.miss(numt(2 * R * 100, dec));
  else if (settled === 'before') text = ex.before(f2(mo.P.x));
  else if (settled === 'doneSticky') text = ex.doneSticky(f2(mo.P.x), f2(len(mo.V)), fmt(pct, 0, dec));
  else if (settled === 'doneCentral') text = ex.doneCentral(f2(v));
  else if (settled === 'doneLine') text = ex.doneLine(f2(mo.v1f.x), f2(mo.v2f.x), f2(mo.P.x));
  else if (settled === 'doneRight')
    text = ex.doneRight(f2(len(mo.v1f)), f2(len(mo.v2f)), fmt(angle ?? 90, 0, dec), f2(m1 * mo.v1f.y), f2(m2 * mo.v2f.y));
  else if (settled === 'doneElastic') text = ex.doneElastic(f2(m1 * mo.v1f.y), par(f2(m2 * mo.v2f.y)), f2(m1 * mo.v1f.x), par(f2(m2 * mo.v2f.x)), f2(mo.P.x));
  else text = ex.idle(numt(b, dec), f2(mo.P.x));
  const tone = settled.startsWith('idle') || settled === 'miss' ? '#22d3ee' : settled === 'before' ? '#fbbf24' : settled === 'doneSticky' ? '#fb923c' : '#34d399';

  const legend = [
    { label: tx.legend.puck1, color: COL.b1, kind: 'dot' },
    { label: tx.legend.puck2, color: COL.b2, kind: 'dot' },
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
    { label: tx.legend.trail, color: '#64748b', kind: 'dash' },
  ];

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
        chip={(W, narrow) => <TimeChip text={narrow ? T.common.slowShort(2) : T.common.slow(2)} extra={narrow ? null : tx.chip} />}
        ariaLabel={tx.sceneLabel(f2(len(st.v1)), f2(len(st.v2)), f2(ps.x), f2(ps.y))}
        height={(W, narrow) => (narrow ? clamp(W * 0.66, 230, 320) : clamp(W * 0.42, 380, 470))}
      >
        {(W, H, narrow) => <PucksDrawing W={W} H={H} narrow={narrow} mo={mo} st={st} sim={sim} b={b} m1={m1} m2={m2} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.p1}
          symbol="|p₁|"
          value={fmt(len(p1), 2, dec)}
          unit={U.kgms}
          accent={COL.b1}
          textColor={COL.b1Text}
          sub={rich(tx.readouts.comp(f2(p1.x), f2(p1.y)))}
          active={started}
        />
        <Readout
          label={tx.readouts.p2}
          symbol="|p₂|"
          value={fmt(len(p2), 2, dec)}
          unit={U.kgms}
          accent={COL.b2}
          textColor={COL.b2Text}
          sub={rich(tx.readouts.comp(f2(p2.x), f2(p2.y)))}
          active={started}
        />
        <Readout
          label={tx.readouts.sum}
          symbol="|p₁ + p₂|"
          value={fmt(len(ps), 2, dec)}
          unit={U.kgms}
          accent={COL.sum}
          textColor={COL.sumText}
          sub={rich(tx.readouts.comp(f2(ps.x), f2(ps.y)))}
          active={started}
        />
        <Readout
          label={tx.readouts.ek}
          symbol="Eₖ"
          value={fmt(Ek, 3, dec)}
          unit={U.J}
          accent={COL.ek}
          textColor={COL.ekText}
          sub={after ? (elastic ? tx.readouts.ekKept : tx.readouts.ekLost(fmt(mo.Q, 3, dec), fmt(pct, 0, dec))) : tx.readouts.ekBefore(fmt(mo.E0, 3, dec))}
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
              onChange={(val) => change(setElastic, 'elastic')(val === 'elastic')}
              accent={elastic ? '#a78bfa' : '#fb923c'}
              options={[
                { value: 'elastic', label: tx.bumpers.elastic.name, sub: tx.bumpers.elastic.sub },
                { value: 'sticky', label: tx.bumpers.sticky.name, sub: tx.bumpers.sticky.sub },
              ]}
            />
          </div>
          <RangeField id="mc-p-m1" label={tx.m1} symbol="m₁" min={0.1} max={0.5} step={0.05} value={m1} onChange={change(setM1, 'm1')} accent={COL.b1} display={`${numt(m1, dec)} ${U.kg}`} />
          <RangeField id="mc-p-m2" label={tx.m2} symbol="m₂" min={0.1} max={0.5} step={0.05} value={m2} onChange={change(setM2, 'm2')} accent={COL.b2} display={`${numt(m2, dec)} ${U.kg}`} />
          <RangeField id="mc-p-v" label={tx.v} symbol="v₁" min={0.5} max={3} step={0.25} value={v} onChange={change(setV, 'v')} accent={COL.vel} display={`${numt(v, dec)} ${T.ms}`} />
          <RangeField
            id="mc-p-b"
            label={tx.b}
            symbol="b"
            min={-14}
            max={14}
            step={1}
            value={b}
            onChange={change(setB, 'b')}
            accent="#f59e0b"
            display={`${numt(b, dec)} ${U.cm}`}
            hint={tx.bHint(numt(2 * R * 100, dec))}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <VectorDiagram
            T={T}
            before={{ p1: mul({ x: v, y: 0 }, m1), p2: { x: 0, y: 0 } }}
            now={{ p1, p2 }}
            showNow={started}
            angle={after && elastic && b !== 0 ? angle : null}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- vector diagram */

/** Tip-to-tail momentum triangles before and now, on one scale. */
function VectorDiagram({ T, before, now, showNow, angle }) {
  const tx = T.pucks;
  const U = T.u;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 460;
  const H = narrow ? 200 : 280;
  const gap = 14;
  const halfW = (W - gap) / 2;
  const sets = [before, showNow ? now : before];
  const pts = sets.flatMap((s) => [{ x: 0, y: 0 }, s.p1, add(s.p1, s.p2)]);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const pad = { l: 16, r: 16, t: 34, b: 30 };
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const k = Math.min((halfW - pad.l - pad.r) / spanX, (H - pad.t - pad.b) / Math.max(spanY, spanX * 0.15));
  const ox = (i) => i * (halfW + gap) + pad.l + (halfW - pad.l - pad.r - spanX * k) / 2 - minX * k;
  const oy = pad.t + (H - pad.t - pad.b - spanY * k) / 2 + maxY * k;
  const scr = (i, p) => ({ x: ox(i) + p.x * k, y: oy - p.y * k });
  const fs = narrow ? 11 : 12;

  const draw = (i, s) => {
    const o = scr(i, { x: 0, y: 0 });
    const a = scr(i, s.p1);
    const c = scr(i, add(s.p1, s.p2));
    const hasP2 = len(s.p2) * k > 3;
    const lab = (P, Q, text, color, side) => {
      const mx = (P.x + Q.x) / 2;
      const my = (P.y + Q.y) / 2;
      const dx = Q.x - P.x;
      const dy = Q.y - P.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * side * 14;
      const ny = (dx / L) * side * 14;
      return (
        <text x={mx + nx} y={my + ny + 4} textAnchor="middle" fontSize={fs + 2} fontStyle="italic" fontWeight="700" fill={color} fontFamily="Georgia, serif" stroke="#0b0b16" strokeWidth="3" paintOrder="stroke">
          {richSvg(text, fs + 2)}
        </text>
      );
    };
    return (
      <g>
        <circle cx={o.x} cy={o.y} r="3" fill="#e2e8f0" />
        {len(s.p1) * k > 3 && <Arrow x1={o.x} y1={o.y} x2={a.x} y2={a.y} color={COL.b1Line} width={3.2} head={11} />}
        {hasP2 && <Arrow x1={a.x} y1={a.y} x2={c.x} y2={c.y} color={COL.b2Line} width={3.2} head={11} />}
        <Arrow x1={o.x} y1={o.y} x2={c.x} y2={c.y} color={COL.sumLine} width={2} head={10} dash="6 4" />
        {len(s.p1) * k > 24 && lab(o, a, i ? 'p_1′' : 'p_1', COL.b1Text, -1)}
        {hasP2 && len(s.p2) * k > 24 && lab(a, c, i ? 'p_2′' : 'p_2', COL.b2Text, -1)}
        {len(add(s.p1, s.p2)) * k > 24 && lab(o, c, 'Σp', COL.sumText, 1.3)}
      </g>
    );
  };

  const nowSet = showNow ? now : before;
  let right = null;
  if (angle !== null && Math.abs(angle - 90) < 0.6) {
    // right-angle mark at the corner of the triangle (tip of p₁′)
    const a = scr(1, nowSet.p1);
    const u1 = { x: -nowSet.p1.x, y: nowSet.p1.y };
    const u2 = { x: nowSet.p2.x, y: -nowSet.p2.y };
    const s = 11;
    const e1 = mul(u1, s / (len(u1) || 1));
    const e2 = mul(u2, s / (len(u2) || 1));
    right = <path d={`M${a.x + e1.x},${a.y + e1.y} L${a.x + e1.x + e2.x},${a.y + e1.y + e2.y} L${a.x + e2.x},${a.y + e2.y}`} fill="none" stroke="#e2e8f0" strokeWidth="1.4" />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{tx.diagram.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.b1Line }} /> p₁
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: COL.b2Line }} /> p₂
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: COL.sumLine }} /> Σp
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.diagram.label(sfmt(add(nowSet.p1, nowSet.p2).x, 2, dec), sfmt(add(nowSet.p1, nowSet.p2).y, 2, dec))} className="block">
          {[0, 1].map((i) => (
            <g key={i}>
              <rect x={i * (halfW + gap)} y={0} width={halfW} height={H} rx="12" fill="rgba(0,0,0,0.25)" />
              <text x={i * (halfW + gap) + 12} y={20} fontSize="11" fontWeight="600" fill="#94a3b8" letterSpacing="0.08em">
                {(i ? tx.diagram.now : tx.diagram.before).toUpperCase()}
              </text>
              <line x1={i * (halfW + gap) + 10} x2={(i + 1) * halfW + i * gap - 10} y1={oy} y2={oy} stroke="rgba(255,255,255,0.08)" />
            </g>
          ))}
          {draw(0, before)}
          {draw(1, nowSet)}
          {right}
          {angle !== null && (
            <text x={W - 12} y={20} textAnchor="end" fontSize="12" fontWeight="700" fill="#e2e8f0">
              {tx.diagram.angle(fmt(angle, 0, dec))}
            </text>
          )}
          <text x={W / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="#64748b">
            {tx.diagram.sum(sfmt(add(before.p1, before.p2).x, 2, dec), sfmt(add(nowSet.p1, nowSet.p2).x, 2, dec), sfmt(add(nowSet.p1, nowSet.p2).y, 2, dec), U.kgms)}
          </text>
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{tx.diagram.note}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function PucksDrawing({ W, H, narrow, mo, st, sim, b, m1, m2, T }) {
  const tx = T.pucks;
  const U = T.u;
  const dec = T.decimal;
  const pad = narrow ? { l: 6, r: 6, t: 40, b: 8 } : { l: 14, r: 14, t: 50, b: 12 };
  const view = makeView(BOX, W, H, pad);
  const k = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const started = sim.t > 0 || sim.running;
  const rp = R * k;

  // trails: sampled positions up to now
  const trail = (which) => {
    const pts = [];
    const n = 80;
    for (let i = 0; i <= n; i += 1) {
      const t = (mo.tEnd * i) / n;
      if (t > sim.t) break;
      const s = mo.at(t);
      const p = which === 1 ? s.r1 : s.r2;
      pts.push(`${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`);
    }
    const p = which === 1 ? st.r1 : st.r2;
    pts.push(`${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`);
    return pts.join(' ');
  };

  const kV = narrow ? 22 : 48;
  const vArrow = (p, vv, i, color, other) => {
    const sp = len(vv);
    if (sp < 0.02) return null;
    const ux = vv.x / sp;
    const uy = vv.y / sp;
    const x1 = X(p.x) + ux * (rp + 3);
    const y1 = Y(p.y) - uy * (rp + 3);
    const L = sp * kV;
    const x2 = x1 + ux * L;
    const y2 = y1 - uy * L;
    const label = tx.vTag(i, fmt(sp, 2, dec), T.ms);
    // the value sits beside the arrow tip, on the side away from the other puck
    let nx = uy;
    let ny = ux;
    if (nx * (X(other.x) - X(p.x)) + ny * (Y(other.y) - Y(p.y)) > 0) {
      nx = -nx;
      ny = -ny;
    }
    const off = fs + 6;
    const pw = textWidth(label, fs) + 16;
    return (
      <g>
        <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={COL.vel} width={narrow ? 2.4 : 3.2} head={narrow ? 8 : 12} />
        <RichPill x={x2 + nx * off + ux * pw * 0.25} y={y2 + ny * off - uy * 6} text={label} bg={color} size={fs} box={box} />
      </g>
    );
  };

  const puck = (p, color, label, mass) => (
    <g>
      <circle cx={X(p.x) + 2} cy={Y(p.y) + 3} r={rp} fill="#0f172a" opacity="0.12" />
      <circle cx={X(p.x)} cy={Y(p.y)} r={rp} fill={color} stroke="#0f172a" strokeOpacity="0.4" strokeWidth="1.2" />
      <circle cx={X(p.x)} cy={Y(p.y)} r={rp * 0.62} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth={Math.max(1, rp * 0.08)} />
      {rp > 12 && (
        <text x={X(p.x)} y={Y(p.y) + fs * 0.38} textAnchor="middle" fontSize={fs + 1} fontWeight="800" fill="#fff">
          {label}
        </text>
      )}
      {!started && rp > 10 && <RichPill x={X(p.x)} y={Y(p.y) + rp + (narrow ? 13 : 17)} text={tx.mTag(label, numt(mass, dec), U.kg)} bg="#0f172a" size={fs - 0.5} box={box} />}
    </g>
  );

  const contact = mo.hit && sim.t > mo.tc;
  const cPoint = mo.hit ? mo.at(mo.tc) : null;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      {/* table */}
      <rect x={X(-XT)} y={Y(YT)} width={2 * XT * k} height={2 * YT * k} rx={Math.min(24, 0.12 * k)} fill="#eff6ff" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 18 : 28} color="#dbe7f5" strong="#c7d6ea" />
      <rect
        x={X(-XT)}
        y={Y(YT)}
        width={2 * XT * k}
        height={2 * YT * k}
        rx={Math.min(24, 0.12 * k)}
        fill="none"
        stroke="#1e3a8a"
        strokeWidth={Math.max(4, 0.035 * k)}
      />
      <line x1={X(0)} x2={X(0)} y1={Y(YT)} y2={Y(-YT)} stroke="#93c5fd" strokeWidth="1.5" opacity="0.6" />
      <circle cx={X(0)} cy={Y(0)} r={0.22 * k} fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity="0.6" />

      {/* aim line and offset b */}
      {!started && (
        <g>
          <line x1={X(X10)} x2={X(XT - 0.05)} y1={Y(b / 100)} y2={Y(b / 100)} stroke={COL.b1} strokeWidth="1.3" strokeDasharray="6 5" opacity="0.7" />
          <line x1={X(-0.3)} x2={X(XT - 0.05)} y1={Y(0)} y2={Y(0)} stroke="#64748b" strokeWidth="1" strokeDasharray="3 5" opacity="0.6" />
          {b !== 0 && (
            <g>
              <line x1={X(0.45)} x2={X(0.45)} y1={Y(0)} y2={Y(b / 100)} stroke="#d97706" strokeWidth="1.8" />
              <line x1={X(0.45) - 5} x2={X(0.45) + 5} y1={Y(0)} y2={Y(0)} stroke="#d97706" strokeWidth="1.8" />
              <line x1={X(0.45) - 5} x2={X(0.45) + 5} y1={Y(b / 100)} y2={Y(b / 100)} stroke="#d97706" strokeWidth="1.8" />
            </g>
          )}
          <RichPill x={X(0.45) + (narrow ? 40 : 52)} y={Y(b / 200)} text={tx.bTag(numt(b, dec), U.cm)} bg="#d97706" size={fs} box={box} />
        </g>
      )}

      {/* line of centres at the moment of contact */}
      {contact && mo.n && (
        <line
          x1={X(cPoint.r1.x - mo.n.x * 0.25)}
          y1={Y(cPoint.r1.y - mo.n.y * 0.25)}
          x2={X(cPoint.r2.x + mo.n.x * 0.35)}
          y2={Y(cPoint.r2.y + mo.n.y * 0.35)}
          stroke="#f59e0b"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          opacity="0.8"
        />
      )}

      {started && <polyline points={trail(1)} fill="none" stroke={COL.b1} strokeWidth="2" strokeDasharray="5 5" opacity="0.6" />}
      {started && contact && <polyline points={trail(2)} fill="none" stroke={COL.b2} strokeWidth="2" strokeDasharray="5 5" opacity="0.6" />}

      {puck(st.r2, COL.b2, '2', m2)}
      {puck(st.r1, COL.b1, '1', m1)}
      {contact && st.c && (
        <g>
          <line x1={X(mo.at(mo.tc).r1.x * (m1 / (m1 + m2)))} y1={Y((mo.at(mo.tc).r1.y * m1) / (m1 + m2))} x2={X(st.c.x)} y2={Y(st.c.y)} stroke={COL.sum} strokeWidth="1.6" strokeDasharray="4 4" />
          <circle cx={X(st.c.x)} cy={Y(st.c.y)} r={narrow ? 3.5 : 5} fill={COL.sum} stroke="#fff" strokeWidth="1.8" />
        </g>
      )}
      {started && vArrow(st.r1, st.v1, 1, COL.b1, st.r2)}
      {started && vArrow(st.r2, st.v2, 2, COL.b2, st.r1)}
    </g>
  );
}
