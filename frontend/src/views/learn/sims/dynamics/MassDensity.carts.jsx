import { useMemo, useState } from 'react';
import { Boxes, CircleHelp, Equal, Lightbulb, Package, Scissors } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, PALETTE, makeView } from '../kit/scene';
import { COL, Calc, Panel, PanelTitle, PlayButtons, RichPill, SimScene, Tag, TimeChip, Toolbar, numt, pillWidth } from './MassDensity.parts';

/**
 * Mass as the measure of inertia: two carts on a smooth track, a compressed
 * spring between them, held by a thread. Cutting the thread lets the spring
 * push both carts with the same force (F = kx at the start, then less) for
 * the same short time, so they get speeds in the inverse ratio of their
 * masses: v₁/v₂ = m₂/m₁, i.e. m₁v₁ = m₂v₂. The lighter cart goes faster.
 *
 * The push is the real spring: the separation grows as s = x₀(1 − cos ωt),
 * ω = √(k/μ), μ = m₁m₂/(m₁+m₂), until the spring reaches its natural length
 * at t = π/2ω (≈ 0.05 s); each cart moves by its share of s about the fixed
 * centre of mass. Friction is neglected. Real time.
 */

const K = 600; // N/m, spring stiffness
const L0 = 0.12; // m, natural length of the spring
const CART_L = 0.3; // m
const BODY_Y0 = 0.05;
const BODY_Y1 = 0.15;
const WHEEL_R = 0.035;
const B = 1.345; // m, end stops' inner faces at ±B: the preset carts run exactly 1.00 m and 0.50 m
const STROBE = 0.2; // s between the position marks
const BLOCK = 0.5; // kg: an empty cart, and each weight on it
const BLOCK_H = 0.024;
const BOX = { x0: -1.6, x1: 1.6, y0: -0.12, y1: 0.46 };

const PRESETS = [
  { id: 'equal', m1: 1, m2: 1, icon: Equal },
  { id: 'double', m1: 1, m2: 2, icon: Package },
  { id: 'four', m1: 1, m2: 4, icon: Boxes },
  { id: 'unknown', m1: 1, m2: 3, icon: CircleHelp },
];

/** The whole motion for given masses (kg) and spring compression x₀ (m). */
function motion(m1, m2, x0) {
  const M = m1 + m2;
  const mu = (m1 * m2) / M;
  const w = Math.sqrt(K / mu);
  const tp = Math.PI / (2 * w); // end of the push
  const vrel = x0 * w; // speed of separation after the push
  const gap0 = L0 - x0; // compressed spring length
  const f1 = m2 / M; // cart 1's share of the separation
  const f2 = m1 / M;
  const D = B - gap0 / 2 - CART_L; // free run of each cart to its stop
  const sEnd = D / Math.max(f1, f2); // the faster cart reaches its stop
  const tEnd = sEnd <= x0 ? Math.acos(1 - sEnd / x0) / w : tp + (sEnd - x0) / vrel;
  const at = (t) => {
    const s = t <= 0 ? 0 : t < tp ? x0 * (1 - Math.cos(w * t)) : x0 + vrel * (t - tp);
    const sd = t <= 0 ? 0 : t < tp ? x0 * w * Math.sin(w * t) : vrel;
    return { s, d1: f1 * s, d2: f2 * s, v1: f1 * sd, v2: f2 * sd, F: t < tp ? K * (x0 - s) : 0 };
  };
  return { tp, gap0, tEnd, at, v1: f1 * vrel, v2: f2 * vrel, F0: K * x0 };
}

const IDLE = { t: 0, running: false, done: false, runs: [] };

export default function CartsSim({ T }) {
  const tx = T.carts;
  const U = T.u;
  const dec = T.decimal;
  const [preset, setPreset] = useState('double');
  const [m1, setM1] = useState(1);
  const [m2, setM2] = useState(2);
  const [xcm, setXcm] = useState(3);
  const [sim, setSim] = useState(IDLE);
  const unknown = preset === 'unknown';
  const x0 = xcm / 100;
  const mo = useMemo(() => motion(m1, m2, x0), [m1, m2, x0]);
  const st = mo.at(sim.t);
  const released = sim.t > 0 || sim.running;
  const pushed = sim.t >= mo.tp;
  const hide2 = unknown && !sim.done;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = p.t + dt;
      if (t < mo.tEnd) return { ...p, t };
      const n = (p.runs[0]?.n ?? 0) + 1;
      return { ...p, t: mo.tEnd, running: false, done: true, runs: [{ n, m1, m2, unknown, v1: mo.v1, v2: mo.v2 }, ...p.runs].slice(0, 5) };
    });
  });

  const stop = () => setSim((p) => ({ ...p, t: 0, running: false, done: false }));
  const toggle = () => setSim((p) => (p.done ? { ...p, t: 0, running: true, done: false } : { ...p, running: !p.running }));
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setM1(p.m1);
    setM2(p.m2);
    stop();
  };
  const matchPreset = (a, b) => PRESETS.find((p) => p.id !== 'unknown' && p.m1 === a && p.m2 === b)?.id ?? 'custom';
  const changeM1 = (v) => {
    setM1(v);
    if (!unknown) setPreset(matchPreset(v, m2));
    stop();
  };
  const changeM2 = (v) => {
    setM2(v);
    setPreset(matchPreset(m1, v));
    stop();
  };
  const changeX = (v) => {
    setXcm(v);
    stop();
  };

  /* ---- words */
  const f2 = (v) => fmt(v, 2, dec);
  const kg = (m) => `${numt(m, dec)} ${U.kg}`;
  const ratioMV = m2 / m1;
  let key = 'idle';
  if (sim.done) key = unknown ? 'doneUnknown' : 'done';
  else if (released) key = unknown ? 'runUnknown' : m1 === m2 ? 'runEqual' : m2 > m1 ? 'run2' : 'run1';
  const settled = useSettled(key, key.startsWith('run') ? 120 : 0);
  const ex = tx.explain;
  const end = mo.at(mo.tEnd);
  let text;
  if (settled === 'runEqual') text = ex.runEqual(f2(mo.v1));
  else if (settled === 'run2') text = ex.run2(numt(m2 / m1, dec), f2(mo.v1), f2(mo.v2));
  else if (settled === 'run1') text = ex.run1(numt(m1 / m2, dec), f2(mo.v1), f2(mo.v2));
  else if (settled === 'runUnknown') text = ex.runUnknown(f2(mo.v1), f2(mo.v2));
  else if (settled === 'done') text = ex.done(fmt(mo.tEnd, 1, dec), f2(end.d1), f2(end.d2), numt(ratioMV, dec));
  else if (settled === 'doneUnknown') text = ex.doneUnknown(fmt(mo.v1 / mo.v2, 1, dec), numt(m1, dec), fmt(m1 * (mo.v1 / mo.v2), 1, dec));
  else text = ex.idle(numt(xcm, dec), numt(mo.F0, dec));
  const tone = settled === 'idle' ? '#22d3ee' : settled.startsWith('done') ? '#34d399' : '#f472b6';

  const legend = [
    { label: tx.legend.cart1, color: COL.cart1, kind: 'square' },
    { label: tx.legend.cart2, color: COL.cart2, kind: 'square' },
    { label: tx.legend.force, color: PALETTE.force, kind: 'arrow' },
    { label: tx.legend.vel, color: PALETTE.vel, kind: 'arrow' },
    { label: tx.legend.marks(fmt(STROBE, 1, dec)), color: '#64748b', kind: 'dot' },
  ];

  const q = '?';
  const p1 = m1 * st.v1;
  const p2 = m2 * st.v2;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={preset}
        onChange={pickPreset}
        accent="#f472b6"
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons
          common={T.common}
          running={sim.running}
          started={released}
          done={sim.done}
          onToggle={toggle}
          onReset={stop}
          startLabel={tx.cut}
          startIcon={Scissors}
        />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <TimeChip text={T.common.realTime} extra={T.common.cell(cellText(W, narrow, T))} />}
        ariaLabel={tx.sceneLabel(kg(m1), hide2 ? q : kg(m2), f2(st.v1), f2(st.v2))}
        height={sceneHeight}
      >
        {(W, H, narrow) => (
          <CartsDrawing W={W} H={H} narrow={narrow} mo={mo} st={st} t={sim.t} m1={m1} m2={m2} hide2={hide2} released={released} done={sim.done} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.v1} symbol="v₁" value={f2(st.v1)} unit={T.ms} accent={COL.cart1} textColor={COL.cart1Text} sub={`m₁ = ${kg(m1)}`} active={released} />
        <Readout
          label={tx.readouts.v2}
          symbol="v₂"
          value={f2(st.v2)}
          unit={T.ms}
          accent={COL.cart2}
          textColor={COL.cart2Text}
          sub={`m₂ = ${hide2 ? `${q} ${U.kg}` : kg(m2)}`}
          active={released}
        />
        <Readout
          label={tx.readouts.ratio}
          symbol="v₁/v₂"
          value={released && st.v2 > 0 ? f2(st.v1 / st.v2) : '—'}
          accent="#facc15"
          textColor="#fde68a"
          sub={`m₂/m₁ = ${hide2 ? q : f2(ratioMV)}`}
        />
        <Readout
          label={tx.readouts.mv}
          symbol="m·v"
          value={f2(p1)}
          unit={U.kgms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={`m₁v₁ = ${f2(p1)} · m₂v₂ = ${hide2 ? q : f2(p2)}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="md-m1"
            label={tx.m1}
            symbol="m₁"
            min={0.5}
            max={4}
            step={0.5}
            value={m1}
            onChange={changeM1}
            accent={COL.cart1}
            display={kg(m1)}
            hint={tx.massHint}
          />
          {unknown ? (
            <div className="rounded-xl border border-dashed border-pink-400/40 bg-pink-500/[0.06] px-3 py-2.5 text-sm text-gray-300">
              <span className="font-semibold text-pink-200">m₂ = ?</span> — {tx.unknownNote}
            </div>
          ) : (
            <RangeField id="md-m2" label={tx.m2} symbol="m₂" min={0.5} max={4} step={0.5} value={m2} onChange={changeM2} accent={COL.cart2} display={kg(m2)} />
          )}
          <RangeField
            id="md-x"
            label={tx.x}
            symbol="x"
            min={1}
            max={5}
            step={0.5}
            value={xcm}
            onChange={changeX}
            accent={PALETTE.force}
            display={`${numt(xcm, dec)} ${U.cm}`}
            hint={tx.xHint(numt(mo.F0, dec))}
          />
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          <Calc
            title={tx.calc.title}
            rows={[
              { sym: 'F', color: '#fca5a5', formula: 'kx', subst: `${K} ${U.nm} · ${fmt(x0, 3, dec)} ${T.m}`, result: `${numt(mo.F0, dec)} ${U.n}` },
              {
                sym: 'v_1/v_2',
                color: '#fde68a',
                formula: 'm_2/m_1',
                subst: `${hide2 ? q : kg(m2)} / ${kg(m1)}`,
                result: hide2 ? (pushed ? `${f2(mo.v1)} / ${f2(mo.v2)} = ${fmt(mo.v1 / mo.v2, 1, dec)}` : q) : numt(ratioMV, dec),
              },
              {
                sym: 'm_1v_1',
                color: COL.cart1Text,
                subst: `${kg(m1)} · ${pushed ? f2(mo.v1) : q} ${T.ms}`,
                result: pushed ? `${f2(m1 * mo.v1)} ${U.kgms}` : q,
              },
              {
                sym: 'm_2v_2',
                color: COL.cart2Text,
                subst: `${hide2 ? q : kg(m2)} · ${pushed ? f2(mo.v2) : q} ${T.ms}`,
                result: pushed && !hide2 ? `${f2(m2 * mo.v2)} ${U.kgms}` : q,
              },
              ...(unknown && sim.done
                ? [{ sym: 'm_2', color: COL.cart2Text, formula: 'm_1·v_1/v_2', subst: `${kg(m1)} · ${f2(mo.v1)} / ${f2(mo.v2)}`, result: `${fmt((m1 * mo.v1) / mo.v2, 1, dec)} ${U.kg}` }]
                : []),
            ]}
            note={tx.calc.note}
          />
          <RunsTable runs={sim.runs} T={T} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ small parts */

const sceneHeight = (W, narrow) => (narrow ? W * 0.52 : clamp(W * 0.25, 280, 330));
const scenePad = (narrow) => (narrow ? { l: 6, r: 6, t: 40, b: 26 } : { l: 18, r: 18, t: 56, b: 28 });
const gridMinPx = (narrow) => (narrow ? 18 : 26);

/** "10 cm" / "25 cm": the grid step the drawing uses at this width. */
function cellText(W, narrow, T) {
  const view = makeView(BOX, W, Math.round(sceneHeight(W, narrow)), scenePad(narrow));
  const step = niceStep(view.k, gridMinPx(narrow));
  return step < 1 ? `${numt(step * 100, T.decimal)} ${T.u.cm}` : `${numt(step, T.decimal)} ${T.m}`;
}

function RunsTable({ runs, T }) {
  const tx = T.carts;
  const dec = T.decimal;
  const f2 = (v) => fmt(v, 2, dec);
  return (
    <div>
      <PanelTitle>{tx.runs.title}</PanelTitle>
      {runs.length === 0 ? (
        <p className="rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-500">{tx.runs.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-black/25">
          <table className="w-full min-w-[420px] text-sm tabular-nums">
            <caption className="sr-only">{tx.runs.title}</caption>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
                <th className="px-3 py-2 font-medium">№</th>
                <th className="px-2 py-2 font-medium">m₁, {T.u.kg}</th>
                <th className="px-2 py-2 font-medium">m₂, {T.u.kg}</th>
                <th className="px-2 py-2 font-medium">v₁, {T.ms}</th>
                <th className="px-2 py-2 font-medium">v₂, {T.ms}</th>
                <th className="px-2 py-2 font-medium">v₁/v₂</th>
                <th className="px-3 py-2 font-medium">m₂/m₁</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.n} className="border-t border-white/5 text-gray-200">
                  <td className="px-3 py-1.5 text-gray-500">{r.n}</td>
                  <td className="px-2 py-1.5">{numt(r.m1, dec)}</td>
                  <td className="px-2 py-1.5">{r.unknown ? <span className="text-pink-200">? → {fmt((r.m1 * r.v1) / r.v2, 1, dec)}</span> : numt(r.m2, dec)}</td>
                  <td className="px-2 py-1.5" style={{ color: COL.cart1Text }}>
                    {f2(r.v1)}
                  </td>
                  <td className="px-2 py-1.5" style={{ color: COL.cart2Text }}>
                    {f2(r.v2)}
                  </td>
                  <td className="px-2 py-1.5 font-semibold text-amber-200">{f2(r.v1 / r.v2)}</td>
                  <td className="px-3 py-1.5 font-semibold text-amber-200">{f2(r.m2 / r.m1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

/** A zig-zag spring from x = a to x = b (px) around height y (px). */
function springPath(a, b, y, amp, coils) {
  const pts = [`M${a.toFixed(1)},${y.toFixed(1)}`];
  const lead = Math.min(6, (b - a) * 0.1);
  pts.push(`L${(a + lead).toFixed(1)},${y.toFixed(1)}`);
  const n = coils * 2;
  const span = b - a - 2 * lead;
  for (let i = 0; i < n; i += 1) {
    const x = a + lead + (span * (i + 0.5)) / n;
    pts.push(`L${x.toFixed(1)},${(y + (i % 2 ? amp : -amp)).toFixed(1)}`);
  }
  pts.push(`L${(b - lead).toFixed(1)},${y.toFixed(1)}`);
  pts.push(`L${b.toFixed(1)},${y.toFixed(1)}`);
  return pts.join(' ');
}

function Cart({ view, xc, color, label, mass, hidden, roll, fs }) {
  const X = view.sx;
  const Y = view.sy;
  const k = view.k;
  const left = X(xc - CART_L / 2);
  const w = CART_L * k;
  const top = Y(BODY_Y1);
  const h = (BODY_Y1 - BODY_Y0) * k;
  const n = Math.round((mass - BLOCK) / BLOCK);
  const wr = WHEEL_R * k;
  const deg = (-roll / WHEEL_R) * (180 / Math.PI);
  return (
    <g>
      {[-0.09, 0.09].map((dx) => (
        <g key={dx} transform={`translate(${X(xc + dx).toFixed(1)} ${Y(WHEEL_R).toFixed(1)}) rotate(${deg.toFixed(1)})`}>
          <circle r={wr} fill="#1e293b" />
          <circle r={wr * 0.55} fill="#94a3b8" />
          <line x1={-wr * 0.55} y1={0} x2={wr * 0.55} y2={0} stroke="#1e293b" strokeWidth={Math.max(1, wr * 0.18)} />
          <circle r={wr * 0.16} fill="#1e293b" />
        </g>
      ))}
      <rect x={left} y={top} width={w} height={h} rx={Math.min(7, h * 0.25)} fill={color} stroke="#0f172a" strokeOpacity="0.35" />
      <rect x={left + 3} y={top + 3} width={w - 6} height={Math.max(2, h * 0.18)} rx={2} fill="#fff" opacity="0.28" />
      {h > 16 && (
        <text x={left + w / 2} y={top + h / 2 + fs * 0.4} textAnchor="middle" fontSize={fs + 1} fontWeight="800" fill="#fff">
          {label}
        </text>
      )}
      {hidden ? (
        <g>
          <rect x={X(xc - 0.085)} y={Y(BODY_Y1 + 0.13)} width={0.17 * k} height={0.13 * k} rx={4} fill="#fdf2f8" stroke={color} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={X(xc)} y={Y(BODY_Y1 + 0.065) + fs * 0.6} textAnchor="middle" fontSize={Math.min(0.09 * k, 30)} fontWeight="800" fill={color}>
            ?
          </text>
        </g>
      ) : (
        Array.from({ length: n }, (_, i) => {
          const y0 = BODY_Y1 + i * BLOCK_H;
          return (
            <g key={i}>
              <rect x={X(xc - 0.06)} y={Y(y0 + BLOCK_H) + 0.5} width={0.12 * k} height={BLOCK_H * k - 1} rx={2} fill="#475569" stroke="#1e293b" strokeWidth="0.8" />
              <line x1={X(xc - 0.055)} x2={X(xc + 0.055)} y1={Y(y0 + BLOCK_H) + 1.5} y2={Y(y0 + BLOCK_H) + 1.5} stroke="#94a3b8" strokeWidth="1" opacity="0.8" />
            </g>
          );
        })
      )}
    </g>
  );
}

function CartsDrawing({ W, H, narrow, mo, st, t, m1, m2, hide2, released, done, T }) {
  const tx = T.carts;
  const U = T.u;
  const dec = T.decimal;
  const view = makeView(BOX, W, H, scenePad(narrow));
  const k = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const x1s = -mo.gap0 / 2 - CART_L / 2;
  const x2s = mo.gap0 / 2 + CART_L / 2;
  const x1c = x1s - st.d1;
  const x2c = x2s + st.d2;
  const f2 = (v) => fmt(v, 2, dec);

  // spring: fixed to cart 1, pressed by cart 2 until it reaches its natural length
  const sa = X(x1c + CART_L / 2);
  const sb = X(x1c + CART_L / 2 + Math.min(L0, mo.gap0 + st.s));
  const ySpring = Y(0.1);

  // strobe marks every STROBE seconds after the thread is cut
  const marks = [];
  for (let i = 1; i * STROBE <= t + 1e-9; i += 1) {
    const p = mo.at(i * STROBE);
    marks.push(<circle key={`a${i}`} cx={X(x1s - p.d1)} cy={Y(-0.0175)} r={narrow ? 2.2 : 3.2} fill={COL.cart1} />);
    marks.push(<circle key={`b${i}`} cx={X(x2s + p.d2)} cy={Y(-0.0175)} r={narrow ? 2.2 : 3.2} fill={COL.cart2} />);
  }

  const kF = narrow ? 2.4 : 4.2; // px per newton
  const kV = narrow ? 42 : 100; // px per m/s
  const showF = st.F > 0.05;
  const showV = released && st.v1 > 0.003;

  const stack1 = BODY_Y1 + Math.round((m1 - BLOCK) / BLOCK) * BLOCK_H;
  const stack2 = hide2 ? BODY_Y1 + 0.13 : BODY_Y1 + Math.round((m2 - BLOCK) / BLOCK) * BLOCK_H;

  const massPillY = (stack) => Y(stack) - (narrow ? 13 : 17);
  const velArrow = (xc, v, dir, color, name, stack) => {
    const from = X(xc + dir * (CART_L / 2)) + dir * 4;
    let to = from + dir * v * kV;
    to = clamp(to, 6, W - 6);
    const label = tx.vTag(name, f2(v));
    const pw = pillWidth(label, fs);
    const face = from;
    // keep the value pill outside the cart, on the side it moves to
    let px = (from + to) / 2;
    if (dir < 0) px = Math.min(px, face - 6 - pw / 2);
    else px = Math.max(px, face + 6 + pw / 2);
    // on a phone there is no room beside the cart: the value goes above its mass label
    const py = narrow ? massPillY(stack) - (fs + 13) : Y(0.1) - 22;
    if (narrow) px = X(xc);
    return (
      <g>
        <Arrow x1={from} y1={Y(0.1)} x2={to} y2={Y(0.1)} color={color} width={narrow ? 2.6 : 3.2} head={narrow ? 9 : 12} />
        <RichPill x={px} y={py} text={label} bg={color} size={fs} box={box} />
      </g>
    );
  };

  const forceArrow = (xc, dir, name) => {
    const from = X(xc - dir * (CART_L / 2));
    const to = from + dir * st.F * kF;
    return (
      <g>
        <Arrow x1={from} y1={Y(0.1)} x2={to} y2={Y(0.1)} color="#fff" width={(narrow ? 2.6 : 3.4) + 3} head={(narrow ? 9 : 12) + 3} />
        <Arrow x1={from} y1={Y(0.1)} x2={to} y2={Y(0.1)} color={PALETTE.force} width={narrow ? 2.6 : 3.4} head={narrow ? 9 : 12} />
        <Tag x={to + dir * 4} y={Y(0.1) - 8} text={name} color={PALETTE.force} size={fs + 2} anchor={dir < 0 ? 'end' : 'start'} />
      </g>
    );
  };

  const bracket = (xa, xb, color, label) => {
    const y = Y(-0.06);
    const a = X(xa);
    const b = X(xb);
    if (Math.abs(b - a) < 8) return null;
    return (
      <g>
        <line x1={a} x2={b} y1={y} y2={y} stroke={color} strokeWidth="1.6" />
        <line x1={a} x2={a} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="1.6" />
        <line x1={b} x2={b} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="1.6" />
        <RichPill x={(a + b) / 2} y={y + (narrow ? 1 : 0)} text={label} bg={color} size={fs} box={box} />
      </g>
    );
  };

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={gridMinPx(narrow)} />
      <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 60 : 110} xUnit={tx.axis} showY={false} decimal={dec} digits={niceStep(k, narrow ? 60 : 110) < 1 ? 1 : 0} />

      {/* track */}
      <rect x={X(BOX.x0 + 0.03)} y={Y(0)} width={X(BOX.x1 - 0.03) - X(BOX.x0 + 0.03)} height={0.035 * k} rx={3} fill="#cbd5e1" />
      <line x1={X(BOX.x0 + 0.03)} x2={X(BOX.x1 - 0.03)} y1={Y(0)} y2={Y(0)} stroke="#64748b" strokeWidth="1.5" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={s < 0 ? X(-B - 0.06) : X(B)} y={Y(0.13)} width={0.06 * k} height={0.13 * k} rx={2} fill="#64748b" />
          <rect x={s < 0 ? X(-B) - 0.014 * k : X(B)} y={Y(0.12)} width={0.014 * k} height={0.1 * k} fill="#1e293b" />
        </g>
      ))}

      {/* start positions */}
      {released &&
        [x1s, x2s].map((x, i) => <line key={i} x1={X(x)} x2={X(x)} y1={Y(0.0)} y2={Y(-0.075)} stroke={i ? COL.cart2 : COL.cart1} strokeWidth="1.4" strokeDasharray="3 3" />)}
      {marks}

      {/* spring and thread */}
      <path d={springPath(sa, sb, ySpring, Math.max(3, 0.026 * k), 7)} fill="none" stroke="#334155" strokeWidth={narrow ? 1.4 : 2} strokeLinejoin="round" />
      <line x1={sb} x2={sb} y1={Y(0.075)} y2={Y(0.125)} stroke="#334155" strokeWidth={narrow ? 2 : 3} strokeLinecap="round" />
      {!released && (
        <path
          d={`M${X(x1c + 0.12)},${Y(BODY_Y1)} Q${(X(x1c + 0.12) + X(x2c - 0.12)) / 2},${Y(BODY_Y1) + 0.03 * k} ${X(x2c - 0.12)},${Y(BODY_Y1)}`}
          fill="none"
          stroke="#92400e"
          strokeWidth={narrow ? 1.2 : 1.8}
        />
      )}

      <Cart view={view} xc={x1c} color={COL.cart1} label="1" mass={m1} roll={-st.d1} fs={fs} />
      <Cart view={view} xc={x2c} color={COL.cart2} label="2" mass={m2} hidden={hide2} roll={st.d2} fs={fs} />

      {/* labels */}
      <RichPill x={X(x1c)} y={massPillY(stack1)} text={tx.mTag(1, `${numt(m1, dec)} ${U.kg}`)} bg={COL.cart1} size={fs} box={box} />
      <RichPill x={X(x2c)} y={massPillY(stack2)} text={tx.mTag(2, hide2 ? '?' : `${numt(m2, dec)} ${U.kg}`)} bg={COL.cart2} size={fs} box={box} />

      {showF && forceArrow(x1c, -1, 'F_1')}
      {showF && forceArrow(x2c, 1, 'F_2')}
      {showF && <RichPill x={X(0)} y={Y(-0.07)} text={tx.fTag(numt(st.F, dec))} bg={PALETTE.force} size={fs} box={box} />}

      {showV && velArrow(x1c, st.v1, -1, PALETTE.vel, 1, stack1)}
      {showV && velArrow(x2c, st.v2, 1, PALETTE.vel, 2, stack2)}

      {done && bracket(x1s, x1c, COL.cart1, tx.sTag(1, f2(st.d1)))}
      {done && bracket(x2s, x2c, COL.cart2, tx.sTag(2, f2(st.d2)))}
    </g>
  );
}
