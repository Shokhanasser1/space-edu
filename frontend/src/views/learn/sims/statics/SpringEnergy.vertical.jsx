import { useEffect, useState } from 'react';
import { BookOpen, Lightbulb, Maximize2, Pause, Play, RotateCcw, Weight } from 'lucide-react';
import { Arrow, Btn, Explain, RangeField, Readout, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import {
  COL,
  EN,
  G,
  Calc,
  Coil,
  Defs,
  EnergyBars,
  Panel,
  Results,
  RichPill,
  SceneChip,
  SimScene,
  Tag,
  Toolbar,
  XYGraph,
  axisStep,
  rich,
  stepDigits,
} from './SpringEnergy.parts';

/**
 * A toy spring gun pointing up: a ball of mass m rests on a spring of
 * stiffness k compressed by x. Released, the spring pushes it until the
 * free length, the ball flies up, stops and falls back onto the spring,
 * compressing it again by x. Energy: kx²/2 → mv²/2 → mgh → mv²/2 → kx²/2,
 * the total staying kx²/2 (no air resistance). The top is at
 * h = kx²/(2mg) above the start (the compressed position).
 *
 * Exact motion. In contact (y < x, y measured from the start): simple
 * harmonic about the equilibrium d = mg/k, y = x − d − (x − d)·cos ωt; the
 * ball leaves at y = x with v₁ = √(2g(h − x)); then free flight. Shown 3×
 * slower. Preset: k = 400 N/m, x = 7 cm, m = 0.1 kg → E_p = 0.98 J,
 * h = 1.00 m; x = 14 cm → 3.92 J, 4.00 m; m = 0.2 kg → 0.50 m.
 */

const SLOW = 3;
const STROBE = 0.05; // s of real time between strobe marks
const L0 = 22; // cm, free length of the spring in the tube
const TUBE = L0 + 3; // cm, tube height
const BALL_R = 2; // cm, ball radius (zoom view)
const X_MIN = 3;
const X_MAX = 14; // cm
const K_MIN = 200;
const K_MAX = 600; // N/m
const M_MIN = 0.1;
const M_MAX = 0.3; // kg
const E_ABS = (K_MAX * (X_MAX / 100) ** 2) / 2; // full glow

const PRESETS = [
  { id: 'book', k: 400, x: 7, m: 0.1, icon: BookOpen },
  { id: 'double', k: 400, x: 14, m: 0.1, icon: Maximize2 },
  { id: 'heavy', k: 400, x: 7, m: 0.2, icon: Weight },
];
const same = (a, b) => Math.abs(a - b) < 1e-9;
const matchPreset = (p) => PRESETS.find((q) => q.k === p.k && same(q.x, p.x) && same(q.m, p.m))?.id ?? null;

/** Exact motion: y (m, the ball's bottom above its start) and v (m/s, up +) at time t. */
function motion({ k, x, m }) {
  const x0 = x / 100;
  const d = (m * G) / k; // compression at equilibrium
  const A = x0 - d;
  const w = Math.sqrt(k / m);
  const t1 = Math.acos(clamp(-d / A, -1, 1)) / w; // leaves the spring
  const v1 = w * Math.sqrt(Math.max(0, A * A - d * d));
  const tf = (2 * v1) / G; // time of flight
  const T = 2 * t1 + tf;
  const yA = (t) => x0 - d - A * Math.cos(w * t);
  const vA = (t) => A * w * Math.sin(w * t);
  const pos = (t) => {
    if (t <= 0) return 0;
    if (t <= t1) return yA(t);
    if (t <= t1 + tf) {
      const s = t - t1;
      return x0 + v1 * s - (G * s * s) / 2;
    }
    return yA(Math.max(0, T - t));
  };
  const vel = (t) => {
    if (t <= 0 || t >= T) return 0;
    if (t <= t1) return vA(t);
    if (t <= t1 + tf) return v1 - G * (t - t1);
    return -vA(T - t);
  };
  const E0 = (k * x0 * x0) / 2;
  return { x0, w, t1, v1, tf, T, pos, vel, E0, h: E0 / (m * G), tTop: t1 + tf / 2 };
}

/** Where the three parts of the scene go: the world view, the bars, the zoom. */
function layout(W, H, narrow) {
  if (narrow) {
    const split = Math.round(W * 0.56);
    return {
      world: { x0: 4, x1: split, y0: 44, y1: H - 10 },
      bars: { x: split + 6, y: 44, w: W - split - 12, h: Math.round(H * 0.44) },
      zoom: { x: split + 6, y: Math.round(H * 0.44) + 52, w: W - split - 12, h: H - Math.round(H * 0.44) - 60 },
    };
  }
  const zw = 230;
  const bw = 236;
  return {
    world: { x0: 16 + zw + 24, x1: W - bw - 40, y0: 56, y1: H - 14 },
    bars: { x: W - bw - 16, y: 56, w: bw, h: H - 72 },
    zoom: { x: 16, y: 56, w: zw, h: H - 72 },
  };
}

function worldTop(h) {
  return Math.max(4.5, Math.ceil((h * 1.1 + 0.2) * 2) / 2);
}

export default function VerticalSim({ T }) {
  const tx = T.vertical;
  const u = T.u;
  const sym = T.sym;
  const dec = T.decimal;
  const [prm, setPrm] = useState({ k: 400, x: 7, m: 0.1 });
  const [preset, setPreset] = useState('book');
  const [sim, setSim] = useState({ t: 0, running: false, run: 1 });
  const [results, setResults] = useState([]);

  const mo = motion(prm);
  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = p.t + dt / SLOW;
      if (t >= mo.T) return { ...p, t: mo.T, running: false };
      return { ...p, t };
    });
  });

  /* write a row when the ball reaches the top */
  const topped = sim.t >= mo.tTop;
  useEffect(() => {
    if (!topped) return;
    setResults((r) => (r.some((row) => row.run === sim.run) ? r : [...r, { run: sim.run, ...prm, E: mo.E0, h: mo.h }].slice(-5)));
  }, [topped, sim.run, prm, mo.E0, mo.h]);

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
  const done = sim.t >= mo.T - 1e-12;
  const toggle = () => {
    if (sim.running) setSim((p) => ({ ...p, running: false }));
    else if (done) setSim((p) => ({ t: 0, running: true, run: p.run + 1 }));
    else setSim((p) => ({ ...p, running: true }));
  };
  const reset = () => setSim((p) => ({ t: 0, running: false, run: p.t > 0 ? p.run + 1 : p.run }));

  /* ---- physics now */
  const y = mo.pos(sim.t);
  const v = mo.vel(sim.t);
  const comp = Math.max(0, mo.x0 - y);
  const Eel = (prm.k * comp * comp) / 2;
  const Ek = (prm.m * v * v) / 2;
  const Eg = prm.m * G * y;
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const mTxt = (n) => fmt(n, Math.abs(n * 10 - Math.round(n * 10)) < 1e-6 ? 1 : 2, dec);
  const xmTxt = fmt(mo.x0, Math.abs(prm.x - Math.round(prm.x)) < 1e-6 ? 2 : 3, dec);

  /* ---- explanation */
  let key;
  if (sim.t <= 0) key = 'idle';
  else if (done) key = 'done';
  else if (sim.t < mo.t1) key = 'push';
  else if (sim.t > mo.t1 + mo.tf) key = 'land';
  else if (v > 0.25 * mo.v1) key = 'up';
  else if (v > -0.5 * mo.v1) key = 'top';
  else key = 'down';
  const settled = useSettled(key, key === 'push' || key === 'land' ? 0 : 120);
  const ex = tx.explain;
  const prev = [...results].reverse().find((r) => r.run !== sim.run && r.k === prm.k && same(r.m, prm.m) !== same(r.x, prm.x));
  const ratio = (a, b) => fmt(Math.max(a, b) / Math.min(a, b), 1, dec);
  let cmp = '';
  if (prev && same(prev.m, prm.m)) cmp = ex.compareX(f1(prev.x), f1(prm.x), ratio(prm.x, prev.x), f2(prev.h), f2(mo.h), ratio(mo.h, prev.h));
  else if (prev) cmp = ex.compareM(mTxt(prev.m), mTxt(prm.m), f2(prev.h), f2(mo.h), ratio(mo.h, prev.h));
  const textBy = {
    idle: () => ex.idle(f1(prm.x), f2(mo.E0), f2(mo.h)),
    push: () => ex.push,
    up: () => ex.up(f2(mo.E0)),
    top: () => ex.top(f2(mo.E0), f2(mo.h)),
    down: () => ex.down,
    land: () => ex.land,
    done: () => `${ex.done(f1(prm.x))}${cmp ? ` ${cmp}` : ''}`,
  };
  const text = (textBy[settled] ?? textBy.idle)();
  const tone = { idle: '#a78bfa', push: '#a78bfa', up: '#34d399', top: '#60a5fa', down: '#34d399', land: '#a78bfa', done: '#22d3ee' }[settled] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.v, color: COL.vel, kind: 'arrow' },
    { label: tx.legend.h, color: COL.h, kind: 'dash' },
    { label: tx.legend.strobe, color: '#e11d48', kind: 'dot' },
    { label: tx.legend.x, color: COL.x, kind: 'line' },
  ];

  /* ---- calculation */
  const rows = [
    { sym: sym.Ep, color: EN.elText, formula: 'k·x²/2', subst: `${prm.k} · ${xmTxt}² / 2`, result: `${f2(mo.E0)} ${u.J}` },
    { sym: 'h', color: COL.hText, formula: 'k·x²/(2mg)', subst: `${f2(mo.E0)} / (${mTxt(prm.m)} · ${fmt(G, 1, dec)})`, result: `${f2(mo.h)} ${T.m}` },
    { sym: 'v', color: COL.velText, formula: '√(2g(h − x))', subst: `√(2 · ${fmt(G, 1, dec)} · ${f2(mo.h - mo.x0)})`, result: `${f2(mo.v1)} ${T.ms}` },
  ];

  /* ---- graph: energy against height */
  const xStepG = axisStep(mo.h * 1.05, 5);
  const xMaxG = xStepG * Math.ceil((mo.h * 1.05) / xStepG);
  const yMaxG = mo.E0 * 1.2;
  const yStepG = axisStep(yMaxG, 4);
  const eEl = (yy) => (yy < mo.x0 ? (prm.k * (mo.x0 - yy) ** 2) / 2 : 0);
  const pts = (f, a, b, n = 60) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n).map((yy) => ({ x: yy, y: f(yy) }));
  const graph = (
    <XYGraph
      title={tx.graph.title}
      legend={[
        { label: tx.graph.el, color: EN.elText },
        { label: tx.graph.k, color: EN.kText },
        { label: tx.graph.g, color: EN.gText },
        { label: tx.graph.tot, color: EN.totText, kind: 'dash' },
      ]}
      xMin={0}
      xMax={xMaxG}
      yMin={0}
      yMax={yMaxG}
      xStep={xStepG}
      yStep={yStepG}
      xDigits={stepDigits(xStepG)}
      yDigits={stepDigits(yStepG)}
      xLabel={tx.graph.x}
      yLabel={tx.graph.y}
      lines={[
        { id: 'tot', pts: [{ x: 0, y: mo.E0 }, { x: mo.h, y: mo.E0 }], color: EN.totText, width: 1.6, dash: '6 4' },
        { id: 'g', pts: [{ x: 0, y: 0 }, { x: mo.h, y: mo.E0 }], color: EN.gText },
        { id: 'el', pts: [...pts(eEl, 0, mo.x0, 24), { x: mo.h, y: 0 }], color: EN.elText },
        { id: 'k', pts: [...pts((yy) => mo.E0 - eEl(yy) - prm.m * G * yy, 0, mo.x0, 24), { x: mo.h, y: 0 }], color: EN.kText },
      ]}
      points={[
        { id: 'pe', x: y, y: Eel, color: EN.elText },
        { id: 'pk', x: y, y: Ek, color: EN.kText },
        { id: 'pg', x: y, y: Eg, color: EN.gText },
      ]}
      guides={[{ id: 'h', x: mo.h, y: mo.E0, color: 'rgba(147,197,253,0.5)' }]}
      labels={[{ id: 'hl', x: mo.h, y: mo.E0 * 0.5, text: `h = ${f2(mo.h)} ${T.m}`, bg: 'rgba(15,23,42,0.85)', color: EN.gText, anchor: 'end' }]}
      height={230}
      decimal={dec}
      ariaLabel={tx.graph.label(f2(mo.E0), f2(mo.h))}
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
        accent="#60a5fa"
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
        chip={<SceneChip text={T.common.slower(SLOW)} />}
        ariaLabel={tx.sceneLabel(f2(y), f2(v), f2(mo.h))}
        height={(W, narrow) => (narrow ? clamp(W * 1.4, 460, 520) : clamp(W * 0.36, 440, 480))}
      >
        {(W, H, narrow) => (
          <VerticalDrawing W={W} H={H} narrow={narrow} prm={prm} mo={mo} t={sim.t} y={y} v={v} Eel={Eel} Ek={Ek} Eg={Eg} results={results} run={sim.run} tx={tx} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={`${settled}-${sim.run}`} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.el} symbol="kx²/2" value={f2(Eel)} unit={u.J} accent={EN.el} textColor={EN.elText} active={Eel > 1e-4} sub={tx.readouts.elSub(f1(comp * 100))} />
        <Readout label={tx.readouts.k} symbol="mv²/2" value={f2(Ek)} unit={u.J} accent={EN.k} textColor={EN.kText} active={Ek > 1e-4} sub={tx.readouts.kSub(f2(Math.abs(v)))} />
        <Readout label={tx.readouts.g} symbol="mgy" value={f2(Eg)} unit={u.J} accent={EN.g} textColor={EN.gText} active={Eg > 1e-4} sub={tx.readouts.gSub(f2(Eel + Ek + Eg))} />
        <Readout label={tx.readouts.y} symbol="y" value={f2(y)} unit={T.m} accent={COL.h} textColor={COL.hText} sub={tx.readouts.ySub(f2(mo.h))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="se-vx" label={tx.xLabel} symbol="x" min={X_MIN} max={X_MAX} step={0.5} value={prm.x} onChange={(val) => setParam('x', val)} accent={COL.x} display={`${f1(prm.x)} ${u.cm}`} />
          <RangeField id="se-vk" label={tx.kLabel} symbol="k" min={K_MIN} max={K_MAX} step={50} value={prm.k} onChange={(val) => setParam('k', val)} accent={COL.k} display={`${prm.k} ${u.Nm}`} />
          <RangeField
            id="se-vm"
            label={tx.mLabel}
            symbol="m"
            min={M_MIN}
            max={M_MAX}
            step={0.05}
            value={prm.m}
            onChange={(val) => setParam('m', Math.round(val * 100) / 100)}
            accent={COL.m}
            display={`${mTxt(prm.m)} ${u.kg}`}
          />
          <Calc title={tx.calc} rows={rows} note={tx.calcNote} />
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
              { id: 'h', label: tx.table.h, color: COL.hText },
            ]}
            rows={results.map((r) => ({ id: r.run, highlight: r.run === sim.run, cells: { x: f1(r.x), k: r.k, m: mTxt(r.m), E: f2(r.E), h: f2(r.h) } }))}
            empty={tx.table.empty}
            note={tx.table.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

function VerticalDrawing({ W, H, narrow, prm, mo, t, y, v, Eel, Ek, Eg, results, run, tx, T }) {
  const dec = T.decimal;
  const u = T.u;
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const L = layout(W, H, narrow);
  const wv = L.world;

  /* world view: y in metres above the start, ground at the tube's floor */
  const yGround = -(L0 - prm.x) / 100;
  const yTop = worldTop(mo.h);
  const yBot = yGround - 0.12;
  const ky = (wv.y1 - wv.y0 - 8) / (yTop - yBot);
  const sy = (yy) => wv.y1 - (yy - yBot) * ky;
  const col = Math.round((wv.x0 + wv.x1) / 2 + (narrow ? 8 : 20));
  const step = niceStep(ky, narrow ? 34 : 42);
  const ballR = narrow ? 6 : 8;

  const gridLines = [];
  for (let g = Math.ceil(yBot / step) * step; g <= yTop + 1e-9; g += step) {
    const gy = sy(g);
    gridLines.push(<line key={`h${g.toFixed(2)}`} x1={wv.x0} x2={wv.x1} y1={gy} y2={gy} stroke={Math.abs(g) < 1e-9 ? '#cbd5e1' : '#e2e8f0'} />);
    if (g > -1e-9 && gy > wv.y0 + 24)
      gridLines.push(
        <text key={`t${g.toFixed(2)}`} x={wv.x0 + 4} y={gy - 3} fontSize="10.5" fill={Math.abs(g) < 1e-9 ? '#0f172a' : '#64748b'} fontWeight={Math.abs(g) < 1e-9 ? 700 : 400}>
          {fmt(g, step < 1 ? 1 : 0, dec)}
        </text>,
      );
  }
  for (let gx = col - Math.floor((col - wv.x0) / (step * ky)) * step * ky; gx <= wv.x1; gx += step * ky) {
    gridLines.push(<line key={`v${gx.toFixed(1)}`} x1={gx} x2={gx} y1={wv.y0} y2={sy(yGround)} stroke="#e2e8f0" />);
  }

  /* strobe: ball centres every 0.05 s; on the way down they land on the same spots */
  const strobe = [];
  if (t > 0) {
    for (let ti = STROBE; ti <= Math.min(t, mo.T) + 1e-9 && strobe.length < 120; ti += STROBE) {
      const yi = mo.pos(ti);
      const down = mo.vel(ti) < 0;
      strobe.push(
        <circle key={ti.toFixed(2)} cx={col} cy={sy(yi) - ballR} r={down ? 4.5 : 2.6} fill={down ? 'none' : '#e11d48'} stroke={down ? '#e11d48' : 'none'} strokeWidth="1.3" opacity="0.65" />,
      );
    }
  }

  const tubeTopY = sy((TUBE - (L0 - prm.x)) / 100);
  const tubeW = narrow ? 12 : 16;
  const vpx = narrow ? 6 : 9;
  const vLen = Math.min(narrow ? 60 : 110, Math.abs(v) * vpx);
  const ballCy = sy(y) - ballR;
  const prevRows = results.filter((r) => r.run !== run && Math.abs(r.h - mo.h) > 0.02 && r.h <= yTop);

  /* zoom view of the gun: z in cm above the tube floor */
  const zm = L.zoom;
  const zTop = TUBE + 13;
  const zPadT = narrow ? 24 : 30;
  const zPadB = narrow ? 10 : 14;
  const sz = (zm.h - zPadT - zPadB) / (zTop + 1);
  const zy = (z) => zm.y + zm.h - zPadB - (z + 1) * sz;
  const zcx = zm.x + zm.w * (narrow ? 0.56 : 0.58);
  const compCm = Math.max(0, mo.x0 - y) * 100;
  const plateZ = L0 - compCm;
  const ballZ = L0 - prm.x + y * 100; // ball bottom
  const tubeHalf = (BALL_R + 0.6) * sz;
  const zoomMag = Math.round(sz / (ky / 100));

  return (
    <g>
      <Defs />
      <rect width={W} height={H} fill="#fbfcfe" />
      <defs>
        <clipPath id="se-zoom-clip">
          <rect x={zm.x} y={zm.y} width={zm.w} height={zm.h} rx={12} />
        </clipPath>
      </defs>

      {/* ---------- world view */}
      {gridLines}
      <text x={wv.x0 + 4} y={wv.y0 + 10} fontSize="11" fontWeight="700" fill="#475569">
        {tx.axis}
      </text>
      {/* ground */}
      <rect x={wv.x0} y={sy(yGround)} width={wv.x1 - wv.x0} height={wv.y1 - sy(yGround) + 14} fill="#e7e5e4" />
      <line x1={wv.x0} x2={wv.x1} y1={sy(yGround)} y2={sy(yGround)} stroke="#78716c" strokeWidth="2" />
      {/* start level and the predicted top */}
      <line x1={wv.x0 + 30} x2={wv.x1} y1={sy(0)} y2={sy(0)} stroke="#94a3b8" strokeDasharray="4 4" />
      {!narrow && (
        <text x={wv.x1 - 4} y={sy(0) - 4} textAnchor="end" fontSize="11" fill="#64748b">
          {tx.start}
        </text>
      )}
      {prevRows.map((r) => (
        <g key={r.run}>
          <line x1={col - 46} x2={col + 46} y1={sy(r.h) - 0} y2={sy(r.h)} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 3" />
          <text x={col + 50} y={sy(r.h) + 4} textAnchor="start" fontSize="10.5" fill="#64748b">
            {`${f2(r.h)} ${T.m}`}
          </text>
        </g>
      ))}
      <line x1={wv.x0 + 30} x2={wv.x1} y1={sy(mo.h)} y2={sy(mo.h)} stroke={COL.h} strokeWidth="1.6" strokeDasharray="7 5" />
      <RichPill x={wv.x1 - 4} y={sy(mo.h) - (narrow ? 13 : 15)} text={narrow ? `h = ${f2(mo.h)} ${T.m}` : tx.hTag(f2(mo.h))} bg={COL.h} size={fs} box={box} anchor="end" />

      {strobe}

      {/* the gun, to scale */}
      <rect x={col - tubeW / 2} y={tubeTopY} width={tubeW} height={sy(yGround) - tubeTopY} rx={2} fill="url(#se-tube)" stroke="#475569" />
      <rect x={col - tubeW / 2 - 6} y={sy(yGround) - 5} width={tubeW + 12} height={5} rx={1.5} fill="#475569" />
      {/* magnifier frame around it */}
      <rect x={col - tubeW / 2 - 8} y={tubeTopY - 10} width={tubeW + 16} height={sy(yGround) - tubeTopY + 14} rx={4} fill="none" stroke="#0891b2" strokeWidth="1.2" strokeDasharray="3 3" />
      {!narrow && (
        <>
          <line x1={zm.x + zm.w} y1={zm.y + 10} x2={col - tubeW / 2 - 8} y2={tubeTopY - 10} stroke="#0891b2" strokeWidth="1" strokeDasharray="3 4" opacity="0.3" />
          <line x1={zm.x + zm.w} y1={zm.y + zm.h - 10} x2={col - tubeW / 2 - 8} y2={sy(yGround) + 4} stroke="#0891b2" strokeWidth="1" strokeDasharray="3 4" opacity="0.3" />
        </>
      )}

      {/* the ball (drawn larger than life; its bottom is at the true height) */}
      <circle cx={col} cy={ballCy} r={ballR} fill="url(#se-ball)" stroke="#881337" strokeWidth="1" />
      {Math.abs(v) > 0.05 && (
        <g>
          <Arrow x1={col - ballR - 6} y1={ballCy} x2={col - ballR - 6} y2={ballCy - Math.sign(v) * vLen} color={COL.vel} width={3} head={Math.min(10, vLen * 0.6)} />
          <Tag x={col - ballR - 12} y={ballCy - Math.sign(v) * vLen * 0.55 + 4} text={narrow ? 'v' : `v = ${f2(Math.abs(v))} ${T.ms}`} color={COL.vel} anchor="end" size={narrow ? 11 : 12} />
        </g>
      )}

      {/* ---------- zoom view of the gun */}
      <rect x={zm.x} y={zm.y} width={zm.w} height={zm.h} rx={12} fill="#ffffff" stroke="#0891b2" strokeWidth="1.3" />
      <g clipPath="url(#se-zoom-clip)">
        {Array.from({ length: Math.floor(zTop / 2) + 2 }, (_, i) => i * 2).map((z) => (
          <line key={`zg${z}`} x1={zm.x} x2={zm.x + zm.w} y1={zy(z)} y2={zy(z)} stroke="#eef2f7" />
        ))}
        {/* tube (back), spring, plate, ball, tube walls */}
        <rect x={zcx - tubeHalf} y={zy(TUBE)} width={tubeHalf * 2} height={zy(0) - zy(TUBE)} fill="#f1f5f9" />
        <Coil x1={zcx} y1={zy(0)} x2={zcx} y2={zy(plateZ) + 2} turns={11} r={tubeHalf * 0.72} width={narrow ? 1.6 : 2.2} glow={Math.sqrt(Eel / E_ABS)} />
        <rect x={zcx - tubeHalf * 0.86} y={zy(plateZ) - 2} width={tubeHalf * 1.72} height={narrow ? 3 : 4} rx={1.5} fill="#334155" />
        <circle cx={zcx} cy={zy(ballZ + BALL_R)} r={BALL_R * sz} fill="url(#se-ball)" stroke="#881337" strokeWidth="1" />
        <rect x={zcx - tubeHalf - 4} y={zy(TUBE)} width={4} height={zy(0) - zy(TUBE)} fill="url(#se-tube)" stroke="#64748b" strokeWidth="0.8" opacity="0.9" />
        <rect x={zcx + tubeHalf} y={zy(TUBE)} width={4} height={zy(0) - zy(TUBE)} fill="url(#se-tube)" stroke="#64748b" strokeWidth="0.8" opacity="0.9" />
        <rect x={zcx - tubeHalf - 12} y={zy(0)} width={tubeHalf * 2 + 24} height={6} rx={2} fill="#475569" />
        {/* free length mark and the compression x */}
        <line x1={zcx - tubeHalf - 4} x2={zcx + tubeHalf + 22} y1={zy(L0)} y2={zy(L0)} stroke="#94a3b8" strokeDasharray="3 3" />
        {compCm > 0.1 && (
          <g>
            <line x1={zcx + tubeHalf + 4} x2={zcx + tubeHalf + 22} y1={zy(plateZ)} y2={zy(plateZ)} stroke={COL.x} strokeWidth="1" />
            <Arrow x1={zcx + tubeHalf + 16} y1={zy(L0)} x2={zcx + tubeHalf + 16} y2={zy(plateZ)} color={COL.x} width={2.4} head={Math.min(8, compCm * sz * 0.45)} />
            <Tag x={zcx + tubeHalf + 22} y={(zy(L0) + zy(plateZ)) / 2 + 4} text={`x = ${f1(compCm)} ${u.cm}`} color={COL.x} anchor="start" size={narrow ? 10 : 12} />
          </g>
        )}
        {!narrow && (
          <text x={zcx - tubeHalf - 8} y={zy(L0) + 4} textAnchor="end" fontSize="10.5" fill="#64748b">
            {tx.free}
          </text>
        )}
      </g>
      <text x={zm.x + 10} y={zm.y + (narrow ? 15 : 19)} fontSize={narrow ? 10 : 11} fontWeight="700" fill="#0e7490">
        {tx.zoom(zoomMag)}
      </text>
      {!narrow && (
        <text x={zm.x + 10} y={zm.y + zm.h - 6} fontSize="10.5" fill="#64748b">
          {tx.zoomNote(`${prm.k} ${u.Nm}`, `${fmt(prm.m * 1000, 0, dec)} ${u.g}`)}
        </text>
      )}

      {/* ---------- energy bars */}
      <EnergyBars
        x={L.bars.x}
        y={L.bars.y}
        w={L.bars.w}
        h={L.bars.h}
        narrow={narrow}
        title={tx.bars.title}
        totalLabel={`E = ${f2(mo.E0)} ${u.J}`}
        bars={[
          { id: 'el', label: 'kx²/2', value: Eel, color: EN.el, sub: narrow ? undefined : tx.bars.el },
          { id: 'k', label: 'mv²/2', value: Ek, color: EN.k, sub: narrow ? undefined : tx.bars.k },
          { id: 'g', label: 'mgy', value: Eg, color: EN.g, sub: narrow ? undefined : tx.bars.g },
          { id: 't', label: 'E', value: Eel + Ek + Eg, color: EN.tot, sub: narrow ? undefined : tx.bars.tot },
        ]}
        total={mo.E0}
        max={mo.E0 * 1.18}
        dec={dec}
      />
    </g>
  );
}
