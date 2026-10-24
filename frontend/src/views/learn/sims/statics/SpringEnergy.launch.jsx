import { useEffect, useState } from 'react';
import { BookOpen, Lightbulb, Maximize2, Pause, Play, RotateCcw, Weight } from 'lucide-react';
import { Arrow, Btn, Explain, RangeField, Readout, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import {
  COL,
  EN,
  Calc,
  Coil,
  Defs,
  EnergyBars,
  Panel,
  Results,
  RichPill,
  RulerH,
  SceneChip,
  SimScene,
  Tag,
  Toolbar,
  XYGraph,
  axisStep,
  rich,
  richWidth,
  stepDigits,
} from './SpringEnergy.parts';

/**
 * A spring launcher on a frictionless (air) track. A cart of mass m is
 * pressed against a spring of stiffness k, compressing it by x, and held.
 * Released, the spring pushes it for a quarter of an oscillation,
 * t₁ = (π/2)·√(m/k), with s(t) = −x·cos ωt (ω = √(k/m)); the energy flows
 * from E_p = kx²/2 into E_k = mv²/2 and their sum stays constant. At the
 * free length the cart leaves the (massless) spring with v = x·√(k/m) and
 * glides on at constant speed through a photogate. Motion is exact
 * (analytic), shown 20× slower. Lesson preset: k = 400 N/m, x = 5 cm,
 * m = 0.1 kg → E = 0.5 J, v = 3.16 m/s; x = 10 cm → 2 J, 6.32 m/s;
 * m = 0.4 kg → 0.5 J, 1.58 m/s.
 */

const SLOW = 20;
const L0 = 16; // cm, free length of the spring
const CART = 6; // cm, length of the cart
const GATE = 20; // cm from the free end: the photogate's beam
const END = 45; // cm from the free end: the bumper
const STROBE = 0.01; // s of real time between strobe marks
const X_MIN = 3;
const X_MAX = 10; // cm
const K_MIN = 100;
const K_MAX = 800; // N/m
const M_MIN = 0.05;
const M_MAX = 0.4; // kg
const E_ABS = (K_MAX * (X_MAX / 100) ** 2) / 2; // 4 J: full glow of the spring

const PRESETS = [
  { id: 'book', k: 400, x: 5, m: 0.1, icon: BookOpen },
  { id: 'double', k: 400, x: 10, m: 0.1, icon: Maximize2 },
  { id: 'heavy', k: 400, x: 5, m: 0.4, icon: Weight },
];
const same = (a, b) => Math.abs(a - b) < 1e-9;
const matchPreset = (p) => PRESETS.find((q) => q.k === p.k && same(q.x, p.x) && same(q.m, p.m))?.id ?? null;

/** Exact motion of the cart: s (m, its left face from the free end) and v at time t. */
function motion({ k, x, m }) {
  const x0 = x / 100;
  const w = Math.sqrt(k / m);
  const t1 = Math.PI / (2 * w);
  const v0 = x0 * w;
  const pos = (t) => (t <= 0 ? -x0 : t < t1 ? -x0 * Math.cos(w * t) : v0 * (t - t1));
  const vel = (t) => (t <= 0 ? 0 : t < t1 ? x0 * w * Math.sin(w * t) : v0);
  const tGate = t1 + (GATE - CART) / 100 / v0;
  const tEnd = t1 + (END - CART) / 100 / v0;
  return { x0, w, t1, v0, pos, vel, tGate, tEnd, E0: (k * x0 * x0) / 2 };
}

function layout(W, narrow) {
  const wallX = narrow ? 14 : 40;
  const sc = (W - wallX - (narrow ? 12 : 24)) / (L0 + END + 2); // px per cm
  const cell = niceStep(sc, Math.max(10, sc * 0.99));
  return { wallX, sc, cell };
}

export default function LaunchSim({ T }) {
  const tx = T.launch;
  const u = T.u;
  const sym = T.sym;
  const dec = T.decimal;
  const [prm, setPrm] = useState({ k: 400, x: 5, m: 0.1 });
  const [preset, setPreset] = useState('book');
  const [sim, setSim] = useState({ t: 0, running: false, run: 1 });
  const [results, setResults] = useState([]);

  const mo = motion(prm);
  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = p.t + dt / SLOW;
      if (t >= mo.tEnd) return { ...p, t: mo.tEnd, running: false };
      return { ...p, t };
    });
  });

  /* the photogate writes a row when the cart crosses its beam */
  const passed = sim.t >= mo.tGate;
  useEffect(() => {
    if (!passed) return;
    setResults((r) => (r.some((row) => row.run === sim.run) ? r : [...r, { run: sim.run, ...prm, E: mo.E0, v: mo.v0 }].slice(-5)));
  }, [passed, sim.run, prm, mo.E0, mo.v0]);

  const setParam = (key, v) => {
    const next = { ...prm, [key]: v };
    setPrm(next);
    setPreset(matchPreset(next));
    setSim((p) => ({ t: 0, running: false, run: p.run + 1 }));
  };
  const pick = (id) => {
    const p = PRESETS.find((q) => q.id === id);
    setPrm({ k: p.k, x: p.x, m: p.m });
    setPreset(id);
    setSim((q) => ({ t: 0, running: false, run: q.run + 1 }));
  };
  const done = sim.t >= mo.tEnd - 1e-12;
  const toggle = () => {
    if (sim.running) setSim((p) => ({ ...p, running: false }));
    else if (done) setSim((p) => ({ t: 0, running: true, run: p.run + 1 }));
    else setSim((p) => ({ ...p, running: true }));
  };
  const reset = () => setSim((p) => ({ t: 0, running: false, run: p.t > 0 ? p.run + 1 : p.run }));

  /* ---- physics now */
  const s = mo.pos(sim.t); // m
  const v = mo.vel(sim.t); // m/s
  const comp = Math.max(0, -s); // m
  const Eel = (prm.k * comp * comp) / 2;
  const Ek = (prm.m * v * v) / 2;
  const f2 = (n) => fmt(n, 2, dec);
  const f1 = (n) => fmt(n, 1, dec);
  const mTxt = (n) => fmt(n, Math.abs(n * 10 - Math.round(n * 10)) < 1e-6 ? 1 : 2, dec);
  const xmTxt = fmt(prm.x / 100, Math.abs(prm.x - Math.round(prm.x)) < 1e-6 ? 2 : 3, dec);

  /* ---- explanation */
  let key;
  if (sim.t <= 0) key = 'idle';
  else if (sim.t < mo.t1) key = 'push';
  else if (!done) key = 'free';
  else key = 'done';
  const settled = useSettled(key, 0);
  const ex = tx.explain;
  const prev = [...results].reverse().find((r) => r.run !== sim.run && r.k === prm.k && (same(r.m, prm.m) !== same(r.x, prm.x)));
  const ratio = (a, b) => fmt(Math.max(a, b) / Math.min(a, b), 1, dec);
  let text;
  if (settled === 'idle') text = ex.idle(f1(prm.x), f2(mo.E0));
  else if (settled === 'push') text = ex.push(f2(mo.E0), fmt(mo.t1, 3, dec));
  else if (settled === 'free') text = ex.free(f2(mo.v0));
  else if (prev && same(prev.m, prm.m)) text = ex.compareX(f1(prev.x), f1(prm.x), ratio(prm.x, prev.x), f2(prev.v), f2(mo.v0), ratio(mo.v0, prev.v), f2(prev.E), f2(mo.E0), ratio(mo.E0, prev.E));
  else if (prev) text = ex.compareM(mTxt(prev.m), mTxt(prm.m), ratio(prm.m, prev.m), f2(mo.E0), f2(prev.v), f2(mo.v0), ratio(mo.v0, prev.v));
  else text = ex.done(f2(mo.v0));
  const tone = { idle: '#a78bfa', push: '#fbbf24', free: '#34d399', done: '#22d3ee' }[settled] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.fel, color: COL.fel, kind: 'arrow' },
    { label: tx.legend.v, color: COL.vel, kind: 'arrow' },
    { label: tx.legend.x, color: COL.x, kind: 'line' },
    { label: tx.legend.strobe, color: '#64748b', kind: 'dot' },
  ];

  /* ---- calculation */
  const kmTxt = `${prm.k} / ${mTxt(prm.m)}`;
  const rows = [
    { sym: sym.Ep, color: EN.elText, formula: 'k·x²/2', subst: `${prm.k} · ${xmTxt}² / 2`, result: `${f2(mo.E0)} ${u.J}` },
    { sym: 'v', color: COL.velText, formula: 'x·√(k/m)', subst: `${xmTxt} · √(${kmTxt})`, result: `${f2(mo.v0)} ${T.ms}` },
    { sym: sym.Ek, color: EN.kText, formula: 'm·v²/2', subst: `${mTxt(prm.m)} · ${f2(mo.v0)}² / 2`, result: `${f2((prm.m * mo.v0 * mo.v0) / 2)} ${u.J}` },
  ];

  /* ---- graph: energy against the cart's position */
  const yMax = (prm.k * (X_MAX / 100) ** 2) / 2;
  const yStep = axisStep(yMax, 4);
  const xs = -prm.x;
  const curve = (f, a, b, n = 40) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n).map((sc) => ({ x: sc, y: f(sc) }));
  const ep = (sc) => (sc < 0 ? (prm.k * (sc / 100) ** 2) / 2 : 0);
  const scNow = clamp(s * 100, -X_MAX, 4);
  const graph = (
    <XYGraph
      title={tx.graph.title}
      legend={[
        { label: tx.graph.ep, color: EN.elText },
        { label: tx.graph.ek, color: EN.kText },
        { label: tx.graph.tot, color: EN.totText, kind: 'dash' },
      ]}
      xMin={-X_MAX}
      xMax={4}
      yMin={0}
      yMax={yMax}
      xStep={2}
      yStep={yStep}
      yDigits={stepDigits(yStep)}
      xLabel={tx.graph.x}
      yLabel={tx.graph.y}
      lines={[
        { id: 'ghost', pts: curve(ep, -X_MAX, 0), color: EN.elText, width: 1.3, dash: '4 4', opacity: 0.45 },
        { id: 'tot', pts: [{ x: xs, y: mo.E0 }, { x: 4, y: mo.E0 }], color: EN.totText, width: 1.6, dash: '6 4' },
        { id: 'ep', pts: [...curve(ep, xs, 0), { x: 4, y: 0 }], color: EN.elText },
        { id: 'ek', pts: [...curve((sc) => mo.E0 - ep(sc), xs, 0), { x: 4, y: mo.E0 }], color: EN.kText },
      ]}
      points={[
        { id: 'pe', x: scNow, y: Eel, color: EN.elText },
        { id: 'pk', x: scNow, y: Ek, color: EN.kText },
      ]}
      labels={[{ id: 'e0', x: xs, y: mo.E0 + yMax * 0.08, text: `E = ${f2(mo.E0)} ${u.J}`, bg: 'rgba(15,23,42,0.85)', color: EN.totText, anchor: 'start' }]}
      height={230}
      decimal={dec}
      ariaLabel={tx.graph.label(f2(mo.E0))}
      note={tx.graph.note}
    />
  );

  const playLabel = sim.running ? T.common.pause : done ? tx.again : sim.t > 0 ? T.common.resume : tx.release;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        cols="grid-cols-1 sm:grid-cols-3"
        value={preset}
        onChange={pick}
        accent="#34d399"
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="min-h-[52px] text-[15px] xl:min-w-[170px]">
          {playLabel}
        </Btn>
        <Btn icon={RotateCcw} onClick={reset} disabled={sim.t === 0 && !sim.running} className="min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <SceneChip text={T.common.slower(SLOW)} extra={narrow ? undefined : T.common.cell(`${fmt(layout(W, narrow).cell, Number.isInteger(layout(W, narrow).cell) ? 0 : 1, dec)} ${u.cm}`)} />}
        ariaLabel={tx.sceneLabel(f1(comp * 100), f2(v), f2(Eel), f2(Ek))}
        height={(W, narrow) => (narrow ? clamp(W * 0.95, 320, 350) : clamp(W * 0.4, 420, 460))}
      >
        {(W, H, narrow) => (
          <LaunchDrawing W={W} H={H} narrow={narrow} prm={prm} mo={mo} t={sim.t} held={sim.t <= 0} passed={passed} s={s} v={v} Eel={Eel} Ek={Ek} tx={tx} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={`${settled}-${sim.run}`} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.x}
          symbol="x"
          value={f1(prm.x)}
          unit={u.cm}
          accent={COL.x}
          textColor={COL.xText}
          sub={comp > 1e-5 ? tx.readouts.xNow(f1(comp * 100)) : tx.readouts.free}
        />
        <Readout label={tx.readouts.ep} symbol={rich(sym.Ep)} value={f2(Eel)} unit={u.J} accent={EN.el} textColor={EN.elText} active={Eel > 1e-4} sub={rich(tx.readouts.epSub)} />
        <Readout label={tx.readouts.ek} symbol={rich(sym.Ek)} value={f2(Ek)} unit={u.J} accent={EN.k} textColor={EN.kText} active={Ek > 1e-4} sub={rich(tx.readouts.ekSub(f2(Eel + Ek)))} />
        <Readout label={tx.readouts.v} symbol="v" value={f2(v)} unit={T.ms} accent={COL.vel} textColor={COL.velText} sub={tx.readouts.vSub(f2(mo.v0))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="se-lx"
            label={tx.xLabel}
            symbol="x"
            min={X_MIN}
            max={X_MAX}
            step={0.5}
            value={prm.x}
            onChange={(val) => setParam('x', val)}
            accent={COL.x}
            display={`${f1(prm.x)} ${u.cm}`}
          />
          <RangeField id="se-lk" label={tx.kLabel} symbol="k" min={K_MIN} max={K_MAX} step={50} value={prm.k} onChange={(val) => setParam('k', val)} accent={COL.k} display={`${prm.k} ${u.Nm}`} />
          <RangeField
            id="se-lm"
            label={tx.mLabel}
            symbol="m"
            min={M_MIN}
            max={M_MAX}
            step={0.05}
            value={prm.m}
            onChange={(val) => setParam('m', Math.round(val * 100) / 100)}
            accent={COL.m}
            display={`${mTxt(prm.m)} ${u.kg}`}
            hint={tx.hint}
          />
          <Calc title={tx.calc} rows={rows} />
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          {graph}
          <Results
            title={tx.table.title}
            cols={[
              { id: 'x', label: tx.table.x, color: COL.xText },
              { id: 'k', label: tx.table.k },
              { id: 'm', label: tx.table.m },
              { id: 'E', label: tx.table.E, color: EN.elText },
              { id: 'v', label: tx.table.v, color: COL.velText },
            ]}
            rows={results.map((r) => ({
              id: r.run,
              highlight: r.run === sim.run,
              cells: { x: f1(r.x), k: r.k, m: mTxt(r.m), E: f2(r.E), v: f2(r.v) },
            }))}
            empty={tx.table.empty}
            note={tx.table.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

function LaunchDrawing({ W, H, narrow, prm, mo, t, held, passed, s, v, Eel, Ek, tx, T }) {
  const dec = T.decimal;
  const u = T.u;
  const sym = T.sym;
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const { wallX, sc } = layout(W, narrow);
  const px = (cm) => wallX + (L0 + cm) * sc;
  const trackY = H - (narrow ? 98 : 100);
  const cartH = narrow ? 28 : 50;
  const ay = trackY - 3 - cartH / 2;
  const view = makeView({ x0: -wallX / sc, x1: (W - wallX) / sc, y0: -(H - trackY) / sc, y1: trackY / sc }, W, H, { l: 0, r: 0, t: 0, b: 0 });

  const scm = s * 100; // cm, the cart's left face
  const springEnd = Math.min(0, scm);
  const comp = -springEnd;
  const cx0 = px(scm);
  const cx1 = px(scm + CART);
  const top = trackY - 3 - cartH;
  const coilR = narrow ? 8 : 13;
  const turns = Math.max(8, Math.round((L0 * sc) / 13));
  const fpx = narrow ? 0.55 : 1.6; // px per N
  const vpx = narrow ? 4 : 10; // px per m/s
  const Fel = prm.k * (comp / 100);

  /* strobe marks every 0.01 s of real time */
  const strobe = [];
  if (t > 0) {
    for (let ti = 0; ti <= t + 1e-9 && strobe.length < 200; ti += STROBE) {
      const si = mo.pos(ti) * 100;
      strobe.push(<circle key={ti.toFixed(3)} cx={px(si + CART / 2)} cy={trackY + 6} r={narrow ? 2 : 2.8} fill={ti < mo.t1 ? EN.el : COL.vel} />);
    }
  }

  /* the bar chart */
  const bw = narrow ? 138 : 236;
  const bh = narrow ? Math.max(110, top - 34 - 44) : top - 56 - 50;
  const bx = W - bw - (narrow ? 6 : 16);
  const by = narrow ? 44 : 50;

  /* photogate */
  const gx = px(GATE);
  const gateTop = top - (narrow ? 18 : 62);
  const readTxt = passed ? `${f2(mo.v0)} ${T.ms}` : '— ' + T.ms;

  const rulerY = trackY + 26;
  const rh = narrow ? 18 : 22;
  const holes = [];
  for (let hx = wallX + 10; hx < px(END) - 4; hx += narrow ? 10 : 16) holes.push(<circle key={hx} cx={hx} cy={trackY + 6} r="1" fill="#94a3b8" />);

  return (
    <g>
      <Defs />
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={Math.max(10, sc * 0.99)} />

      {/* wall */}
      <rect x={wallX - 12} y={ay - (narrow ? 40 : 66)} width={12} height={trackY + 12 - ay + (narrow ? 40 : 66)} fill="#e2e8f0" />
      <line x1={wallX} x2={wallX} y1={ay - (narrow ? 40 : 66)} y2={trackY + 12} stroke="#334155" strokeWidth="3" />

      {/* air track with holes, the bumper */}
      <rect x={wallX} y={trackY} width={px(END) - wallX + 10} height={12} rx={2} fill="#e2e8f0" stroke="#94a3b8" />
      {holes}
      {strobe}
      <rect x={px(END)} y={trackY - (narrow ? 22 : 34)} width={10} height={narrow ? 22 : 34} rx={2} fill="#475569" />
      <rect x={px(END) - 4} y={trackY - (narrow ? 18 : 28)} width={4} height={narrow ? 14 : 22} rx={1.5} fill="#1e293b" />

      {/* photogate */}
      <g>
        <rect x={gx - 4} y={gateTop - 2} width={8} height={trackY + 12 - gateTop + 2} rx={2} fill="#334155" opacity="0.18" />
        <line x1={gx} x2={gx} y1={top - 4} y2={trackY - 3} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />
        <rect x={gx - 6} y={top - 10} width={12} height={8} rx={2} fill="#334155" />
        <circle cx={gx} cy={top - 6} r={2.4} fill="#ef4444" />
        {narrow ? (
          <RichPill x={gx} y={rulerY + rh + 14} text={readTxt} bg={passed ? COL.vel : '#334155'} size={10} box={box} />
        ) : (
          <g>
            <rect x={gx - 54} y={gateTop - 30} width={108} height={24} rx={6} fill="#0f172a" />
            <text x={gx} y={gateTop - 13} textAnchor="middle" fontSize="13" fontWeight="700" fill={passed ? '#6ee7b7' : '#64748b'} fontFamily="ui-monospace, monospace">
              {readTxt}
            </text>
            <text x={gx} y={gateTop - 36} textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">
              {tx.gate}
            </text>
          </g>
        )}
      </g>

      {/* spring and its plate */}
      <Coil x1={wallX} y1={ay} x2={px(springEnd) - 4} y2={ay} turns={turns} r={coilR} glow={Math.sqrt(Eel / E_ABS)} />
      <rect x={px(springEnd) - 5} y={ay - cartH * 0.38} width={5} height={cartH * 0.76} rx={1.5} fill="#334155" />

      {/* compression x, over the ruler (0 = free length) */}
      <line x1={px(0)} x2={px(0)} y1={ay - cartH * 0.38 - 6} y2={rulerY} stroke="#94a3b8" strokeDasharray="4 3" />
      {comp > 0.05 && (
        <g>
          <Arrow x1={px(0)} y1={trackY + 19} x2={px(-comp)} y2={trackY + 19} color={COL.x} width={2.6} head={Math.min(9, comp * sc * 0.45)} />
          <RichPill x={(px(-comp) + px(0)) / 2} y={rulerY + rh + 14} text={tx.xTag(f1(comp))} bg={COL.x} size={fs} box={box} />
        </g>
      )}

      {/* cart (glider) */}
      <g>
        <rect x={cx0} y={top} width={cx1 - cx0} height={cartH} rx={narrow ? 4 : 7} fill="url(#se-cart)" stroke="#0c4a6e" strokeWidth="1.4" />
        <rect x={cx0 + 3} y={top + 3} width={cx1 - cx0 - 6} height={narrow ? 3 : 5} rx={2} fill="#fff" opacity="0.35" />
        <text x={(cx0 + cx1) / 2} y={top + cartH / 2 + 4} textAnchor="middle" fontSize={narrow ? 9 : 12} fontWeight="700" fill="#fff">
          {`${fmt(prm.m, Math.abs(prm.m * 10 - Math.round(prm.m * 10)) < 1e-6 ? 1 : 2, dec)} ${u.kg}`}
        </text>
      </g>

      {/* latch holding the cart */}
      {held && (
        <g>
          <rect x={cx1} y={top - 8} width={narrow ? 6 : 9} height={cartH + 6} rx={2} fill="#f59e0b" stroke="#b45309" />
          <circle cx={cx1 + (narrow ? 3 : 4.5)} cy={top - 10} r={narrow ? 4 : 6} fill="#fbbf24" stroke="#b45309" />
        </g>
      )}

      {/* forces and velocity */}
      {Fel > 0.05 && (
        <g>
          <line x1={cx0} x2={cx0} y1={top} y2={top - (narrow ? 12 : 22)} stroke={COL.fel} strokeWidth="1" strokeDasharray="2 2" />
          <Arrow x1={cx0} y1={top - (narrow ? 12 : 22)} x2={cx0 + Fel * fpx} y2={top - (narrow ? 12 : 22)} color={COL.fel} width={3.2} head={Math.min(11, Fel * fpx * 0.6)} />
          {!narrow && <Tag x={cx0 + Fel * fpx + 6} y={top - 17} text={`${sym.Fel} = ${f1(Fel)} ${u.N}`} color={COL.fel} anchor="start" size={12} />}
        </g>
      )}
      {v > 0.01 && <VelArrow x={cx0 + 6} y={top - (narrow ? 28 : 46)} len={Math.min(Math.max(8, W - 10 - (cx0 + 6)), v * vpx)} text={narrow ? 'v' : `v = ${f2(v)} ${T.ms}`} W={W} narrow={narrow} />}

      {/* ruler */}
      <RulerH y={rulerY} h={rh} x0={px(0)} s={sc} from={-X_MAX} to={END} unit={narrow ? undefined : tx.ruler} dec={dec} />

      {/* energy bars */}
      <EnergyBars
        x={bx}
        y={by}
        w={bw}
        h={bh}
        narrow={narrow}
        title={tx.bars.title}
        totalLabel={`E = ${f2(mo.E0)} ${u.J}`}
        bars={[
          { id: 'el', label: sym.Ep, value: Eel, color: EN.el, sub: narrow ? undefined : tx.bars.el },
          { id: 'k', label: sym.Ek, value: Ek, color: EN.k, sub: narrow ? undefined : tx.bars.k },
          { id: 't', label: 'E', value: Eel + Ek, color: EN.tot, sub: narrow ? undefined : tx.bars.tot },
        ]}
        total={mo.E0}
        max={mo.E0 * 1.18}
        dec={dec}
      />
    </g>
  );
}

/** The velocity arrow with its label on the right, or on the left near the scene's edge. */
function VelArrow({ x, y, len, text, W, narrow }) {
  const size = narrow ? 12 : 13;
  const right = x + len + 8 + richWidth(text, size, 700) < W - 6;
  return (
    <g>
      <Arrow x1={x} y1={y} x2={x + len} y2={y} color={COL.vel} width={3.2} head={Math.min(11, len * 0.6)} />
      <Tag x={right ? x + len + 6 : x - 6} y={y + 5} text={text} color={COL.vel} anchor={right ? 'start' : 'end'} size={size} />
    </g>
  );
}
