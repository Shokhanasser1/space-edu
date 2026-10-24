import { useRef, useState } from 'react';
import { BookOpen, Lightbulb, Maximize2, Minimize2, MoveLeft, Pause, Play, RotateCcw } from 'lucide-react';
import { Arrow, Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import { COL, EN, Calc, Coil, Defs, Panel, RichPill, RulerH, ScaleBar, SceneChip, SimScene, Tag, Toolbar, XYGraph, rich } from './SpringEnergy.parts';

/**
 * Where the energy of a spring comes from. Drag the block (or use the
 * slider) to stretch or compress a spring of stiffness k; the hand pulls
 * with F = kx, the spring pulls back with F_el = kx. "Stretch" replays the
 * stretching slowly (quasi-statically, 8 cm/s in real time): the force grows
 * from 0 to kx, so the work is the area of the triangle under the F–x line,
 * A = ½·kx·x = kx²/2 - half of the rectangle F·x. That work is stored as
 * E_p = kx²/2. The second graph is the parabola E_p(x): x/2, x, 2x give
 * E/4, E, 4E. Preset (lesson example): k = 200 N/m, x = 10 cm → F = 20 N,
 * E_p = 1 J; x = 5 cm → 0.25 J; x = 20 cm → 4 J; x = −10 cm → 1 J.
 */

const X_MIN = -15; // cm
const X_MAX = 20; // cm
const L0 = 30; // cm, free length of the spring
const K_MIN = 50;
const K_MAX = 300; // N/m
const F_MAX = (K_MAX * X_MAX) / 100; // 60 N, the force axis
const E_MAX = (K_MAX * (X_MAX / 100) ** 2) / 2; // 6 J, the energy axis
const RATE = 8; // cm/s: how fast the hand stretches the spring in the replay

const PRESETS = [
  { id: 'book', k: 200, x: 10, icon: BookOpen },
  { id: 'half', k: 200, x: 5, icon: Minimize2 },
  { id: 'double', k: 200, x: 20, icon: Maximize2 },
  { id: 'compress', k: 200, x: -10, icon: MoveLeft },
];
const cellTxt = (c, dec) => fmt(c, Number.isInteger(c) ? 0 : 1, dec);
const matchPreset = (k, x) => PRESETS.find((p) => p.k === k && Math.abs(p.x - x) < 1e-9)?.id ?? null;

/** Sizes of the drawing for a given width (shared by the scene and its chip). */
function layout(W, narrow) {
  const wallX = narrow ? 18 : 44;
  const blockW = narrow ? 30 : 46;
  const blockH = narrow ? 40 : 56;
  const room = narrow ? 46 : 190;
  const s = clamp((W - wallX - blockW - room) / (L0 + X_MAX), 4, 24); // px per cm
  const fpx = Math.min(narrow ? 1.2 : 3, (narrow ? 50 : 170) / F_MAX); // px per N
  const cell = niceStep(s, Math.max(10, s * 0.99)); // cm per grid square
  return { wallX, blockW, blockH, room, s, fpx, cell };
}

export default function StoreSim({ T }) {
  const tx = T.store;
  const u = T.u;
  const sym = T.sym;
  const dec = T.decimal;
  const [k, setK] = useState(200);
  const [xT, setXT] = useState(10); // cm, the chosen deformation
  const [preset, setPreset] = useState('book');
  const [ph, setPh] = useState({ p: 1, running: false }); // replay progress 0…1
  const [graph, setGraph] = useState('fx');

  useRafLoop(ph.running, (dt) => {
    setPh((q) => {
      if (!q.running) return q;
      const p = Math.min(1, q.p + (dt * RATE) / Math.max(1, Math.abs(xT)));
      return { p, running: p < 1 };
    });
  });

  const hold = (xcm) => {
    const v = clamp(Math.round(xcm * 10) / 10, X_MIN, X_MAX);
    setXT(v);
    setPh({ p: 1, running: false });
    setPreset(matchPreset(k, v));
  };
  const changeK = (v) => {
    setK(v);
    setPreset(matchPreset(v, xT));
  };
  const pick = (id) => {
    const p = PRESETS.find((q) => q.id === id);
    setK(p.k);
    setXT(p.x);
    setPreset(id);
    setPh({ p: 0, running: true });
  };
  const toggle = () => {
    if (ph.running) setPh((q) => ({ ...q, running: false }));
    else if (ph.p >= 1) setPh({ p: 0, running: true });
    else setPh((q) => ({ ...q, running: true }));
  };
  const reset = () => setPh({ p: 0, running: false });

  /* ---- physics (x in cm on screen, metres in the formulas) */
  const x = Math.round(xT * ph.p * 10) / 10; // cm, to the 0.1 cm the readouts show
  const xm = Math.abs(x) / 100;
  const F = k * xm; // N, the hand's force = the elastic force
  const E = (k * xm * xm) / 2; // J, E_p = kx²/2 = work of the hand
  const still = Math.abs(x) < 0.05;
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const mDig = Math.abs(x * 10 - Math.round(x * 10)) > 1e-6 ? 4 : Math.abs(x - Math.round(x)) < 1e-6 ? 2 : 3;
  const xmTxt = fmt(xm, mDig, dec);

  /* ---- explanation */
  let key;
  if (ph.running) key = 'anim';
  else if (still) key = 'zero';
  else key = x > 0 ? 'stretch' : 'compress';
  const settled = useSettled(key, key === 'anim' || key === 'zero' ? 0 : 300);
  const ex = tx.explain;
  let text;
  if (settled === 'anim') text = ex.anim;
  else if (settled === 'stretch') text = ex.stretch(f1(Math.abs(x)), f1(F), f1(F / 2), xmTxt, f2(E), f2(4 * E));
  else if (settled === 'compress') text = ex.compress(f1(Math.abs(x)), f1(F), f1(F / 2), xmTxt, f2(E));
  else text = ex.zero;
  const tone = { anim: '#fbbf24', stretch: '#a78bfa', compress: '#a78bfa', zero: '#22d3ee' }[settled] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.hand, color: COL.hand, kind: 'arrow' },
    { label: tx.legend.fel, color: COL.fel, kind: 'arrow' },
    { label: tx.legend.x, color: COL.x, kind: 'line' },
    { label: tx.legend.energy, color: EN.el, kind: 'band' },
  ];

  /* ---- calculation */
  const rows = [
    { sym: 'F', color: COL.handText, formula: 'k·x', subst: `${k} ${u.Nm} · ${xmTxt} ${T.m}`, result: `${f1(F)} ${u.N}` },
    { sym: 'A', color: EN.elText, formula: '½·F·x', subst: `½ · ${f1(F)} ${u.N} · ${xmTxt} ${T.m}`, result: `${f2(E)} ${u.J}` },
    { sym: sym.Ep, color: EN.elText, formula: 'k·x²/2', subst: `${k} · ${xmTxt}² / 2`, result: `${f2(E)} ${u.J}` },
  ];

  /* ---- graphs */
  const ax = xm;
  const big = ax >= 0.06 && F >= 14;
  const fxGraph = (
    <XYGraph
      title={tx.graph.fxTitle}
      legend={[
        { label: tx.graph.line, color: COL.handText },
        { label: tx.graph.area, color: EN.el, kind: 'band' },
        { label: tx.graph.rect, color: '#cbd5e1', kind: 'dash' },
      ]}
      xMin={0}
      xMax={X_MAX / 100}
      yMin={0}
      yMax={F_MAX}
      xStep={0.05}
      yStep={10}
      xDigits={2}
      xLabel={tx.graph.x}
      yLabel={tx.graph.f}
      lines={[{ id: 'f', pts: [{ x: 0, y: 0 }, { x: X_MAX / 100, y: (k * X_MAX) / 100 }], color: COL.handText }]}
      areas={ax > 0 ? [{ id: 'tri', pts: [{ x: 0, y: 0 }, { x: ax, y: 0 }, { x: ax, y: F }], color: EN.el, opacity: 0.5, stroke: EN.elText }] : []}
      rects={ax > 0 ? [{ id: 'rect', x0: 0, y0: 0, x1: ax, y1: F, color: 'rgba(226,232,240,0.6)' }] : []}
      guides={ax > 0 ? [{ id: 'g', x: ax, y: F, color: 'rgba(252,165,165,0.55)' }] : []}
      labels={
        ax > 0
          ? [
              big
                ? { id: 'e', x: (2 * ax) / 3, y: F / 3, text: `${sym.Ep} = A = ${f2(E)} ${u.J}`, bg: EN.el }
                : { id: 'e', x: ax + 0.006, y: Math.max(F / 2, 4), text: `${sym.Ep} = ${f2(E)} ${u.J}`, bg: EN.el, anchor: 'start' },
              ...(big
                ? [
                    { id: 'r', x: ax / 2, y: F + F_MAX * 0.07, text: `F·x = ${f2(F * ax)} ${u.J}`, bg: 'rgba(15,23,42,0.85)', color: '#cbd5e1', border: 'rgba(203,213,225,0.5)' },
                    { id: 'kx', x: ax + 0.007, y: F - F_MAX * 0.07, text: `kx = ${f1(F)} ${u.N}`, bg: 'rgba(15,23,42,0.85)', color: COL.handText, anchor: 'start' },
                  ]
                : []),
            ]
          : []
      }
      marker={{ x: ax, y: F, color: COL.handText }}
      height={250}
      decimal={dec}
      ariaLabel={tx.graph.fxLabel(f1(F), xmTxt, f2(E))}
      note={tx.graph.fxNote}
      header={<GraphSwitch value={graph} onChange={setGraph} tx={tx} />}
    />
  );

  const parabola = [];
  for (let i = 0; i <= 40; i += 1) {
    const xx = (i / 40) * (X_MAX / 100);
    parabola.push({ x: xx, y: (k * xx * xx) / 2 });
  }
  const marks = [
    { id: 'q', x: ax / 2, e: E / 4, text: (v) => `x/2 → ${v}` },
    { id: 'e', x: ax, e: E, text: (v) => `x → ${v}` },
    { id: 'd', x: 2 * ax, e: 4 * E, text: (v) => `2x → ${v}` },
  ].filter((m) => ax > 0.004 && m.x <= X_MAX / 100 + 1e-9 && m.e <= E_MAX + 1e-9);
  const exGraph = (
    <XYGraph
      title={tx.graph.exTitle}
      legend={[{ label: tx.graph.parabola, color: EN.elText }]}
      xMin={0}
      xMax={X_MAX / 100}
      yMin={0}
      yMax={E_MAX}
      xStep={0.05}
      yStep={1}
      xDigits={2}
      xLabel={tx.graph.x}
      yLabel={tx.graph.e}
      lines={[{ id: 'p', pts: parabola, color: EN.elText }]}
      guides={marks.map((m) => ({ id: m.id, x: m.x, y: m.e, color: 'rgba(196,181,253,0.45)' }))}
      points={marks.map((m) => ({ id: m.id, x: m.x, y: m.e, color: m.id === 'e' ? '#fff' : EN.elText, r: m.id === 'e' ? 5.5 : 4.5 }))}
      labels={ax >= 0.03 ? marks.map((m) => ({ id: m.id, x: m.x, y: m.e + E_MAX * 0.07, text: m.text(`${f2(m.e)} ${u.J}`), bg: m.id === 'e' ? EN.el : 'rgba(15,23,42,0.85)', color: m.id === 'e' ? '#fff' : EN.elText })) : []}
      height={250}
      decimal={dec}
      ariaLabel={tx.graph.exLabel(f2(E))}
      note={tx.graph.exNote}
      header={<GraphSwitch value={graph} onChange={setGraph} tx={tx} />}
    />
  );

  const playLabel = ph.running ? T.common.pause : ph.p > 0 && ph.p < 1 ? T.common.resume : xT < 0 ? tx.compressBtn : tx.stretchBtn;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        cols="grid-cols-2 lg:grid-cols-4"
        value={preset}
        onChange={pick}
        accent="#a78bfa"
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <Btn variant="primary" icon={ph.running ? Pause : Play} onClick={toggle} disabled={Math.abs(xT) < 0.05} className="min-h-[52px] text-[15px] xl:min-w-[150px]">
          {playLabel}
        </Btn>
        <Btn icon={RotateCcw} onClick={reset} disabled={ph.p === 0 && !ph.running} className="min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <SceneChip kind="ruler" text={T.common.cell(`${cellTxt(layout(W, narrow).cell, dec)} ${u.cm}`)} extra={narrow ? undefined : tx.chip} />}
        ariaLabel={tx.sceneLabel(f1(x), k, f1(F), f2(E))}
        height={(W, narrow) => (narrow ? clamp(W * 0.8, 280, 300) : clamp(W * 0.3, 320, 350))}
      >
        {(W, H, narrow) => <StoreDrawing W={W} H={H} narrow={narrow} k={k} x={x} E={E} onDrag={hold} tx={tx} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.x}
          symbol="x"
          value={`${x > 0.05 ? '+' : ''}${f1(x)}`}
          unit={u.cm}
          accent={COL.x}
          textColor={COL.xText}
          sub={still ? tx.readouts.none : `${x > 0 ? tx.readouts.stretch : tx.readouts.compress} · ${xmTxt} ${T.m}`}
        />
        <Readout label={tx.readouts.f} symbol="F" value={f1(F)} unit={u.N} accent={COL.hand} textColor={COL.handText} sub={tx.readouts.fSub(f1(F / 2))} />
        <Readout label={tx.readouts.e} symbol={rich(sym.Ep)} value={f2(E)} unit={u.J} accent={EN.el} textColor={EN.elText} active={!still} sub={rich(tx.readouts.eSub)} />
        <Readout label={rich(tx.readouts.cmp)} accent="#e2e8f0">
          <Compare E={E} still={still} tx={tx} u={u} dec={dec} />
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="se-x"
            label={tx.xLabel}
            symbol="x"
            min={X_MIN}
            max={X_MAX}
            step={0.5}
            value={Math.round(xT * 2) / 2}
            onChange={hold}
            accent={COL.x}
            display={`${xT > 0.05 ? '+' : ''}${f1(xT)} ${u.cm}`}
            hint={tx.xHint}
            disabled={ph.running}
          />
          <RangeField id="se-k" label={tx.kLabel} symbol="k" min={K_MIN} max={K_MAX} step={10} value={k} onChange={changeK} accent={COL.k} display={`${k} ${u.Nm}`} hint={tx.kHint} />
          <Calc title={tx.calc} rows={rows} note={tx.calcNote} />
        </Panel>
        <Panel className="lg:col-span-3">{graph === 'fx' ? fxGraph : exGraph}</Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- pieces */

function GraphSwitch({ value, onChange, tx }) {
  return (
    <Segmented
      label={tx.graph.switchLabel}
      className="grid-cols-2"
      value={value}
      onChange={onChange}
      accent="#a78bfa"
      options={[
        { value: 'fx', label: tx.graph.fxTab },
        { value: 'ex', label: rich(tx.graph.exTab) },
      ]}
    />
  );
}

/** x/2, x and 2x side by side: the energy goes as x². */
function Compare({ E, still, tx, u, dec }) {
  const rowsC = [
    ['x/2', E / 4, '#a78bfa99'],
    ['x', E, '#a78bfa'],
    ['2x', 4 * E, '#c4b5fd'],
  ];
  return (
    <div className="mt-2 space-y-1.5">
      {rowsC.map(([name, v, col]) => (
        <div key={name} className="flex items-center gap-2">
          <span className="w-8 shrink-0 font-serif text-sm italic text-gray-300">{name}</span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${still ? 0 : (v / (4 * E)) * 100}%`, background: col }} />
          </span>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-gray-200">{still ? '—' : `${fmt(v, 2, dec)} ${u.J}`}</span>
        </div>
      ))}
      <p className="pt-0.5 text-[11px] leading-snug text-gray-500">{rich(tx.readouts.cmpNote)}</p>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

function StoreDrawing({ W, H, narrow, k, x, E, onDrag, tx, T }) {
  const dec = T.decimal;
  const u = T.u;
  const sym = T.sym;
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const drag = useRef(null);
  const { wallX, blockW, blockH, s, fpx } = layout(W, narrow);

  const ay = Math.round(H * (narrow ? 0.47 : 0.46));
  const tableY = ay + blockH / 2;
  const px = (cm) => wallX + (L0 + cm) * s;
  const end = px(x);
  const view = makeView({ x0: -wallX / s, x1: (W - wallX) / s, y0: -(H - ay) / s, y1: ay / s }, W, H, { l: 0, r: 0, t: 0, b: 0 });

  const F = (k * Math.abs(x)) / 100;
  const dir = Math.sign(x); // +1 stretched, −1 compressed
  const yFel = ay - blockH / 2 - (narrow ? 26 : 24);
  const yHand = yFel - (narrow ? 22 : 30);
  const coilR = narrow ? 9 : 14;

  const toCm = (e) => {
    const svg = e.currentTarget.ownerSVGElement ?? e.currentTarget;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    return (sx - wallX) / s - L0;
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = toCm(e) - x;
    onDrag(x);
  };
  const onMove = (e) => {
    if (drag.current === null) return;
    onDrag(toCm(e) - drag.current);
  };
  const onUp = () => {
    drag.current = null;
  };

  const turns = Math.max(10, Math.round((L0 * s) / 16));
  const rulerY = tableY + (narrow ? 18 : 26);
  const rh = narrow ? 20 : 24;
  const hatch = [];
  for (let y = ay - 84; y < tableY + 6; y += 9) hatch.push(<line key={y} x1={wallX - 14} y1={y + 9} x2={wallX} y2={y} stroke="#94a3b8" strokeWidth="1.2" />);
  const scaleN = [5, 10, 20, 50].find((n) => n * fpx >= 34) ?? 50;

  return (
    <g>
      <Defs />
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={Math.max(10, s * 0.99)} />

      {/* wall and table */}
      <rect x={wallX - 14} y={ay - 84} width={14} height={tableY - ay + 90} fill="#e2e8f0" />
      {hatch}
      <line x1={wallX} x2={wallX} y1={ay - 84} y2={tableY + 6} stroke="#334155" strokeWidth="3" />
      <rect x={wallX} y={tableY} width={W - wallX - 8} height={6} fill="#cbd5e1" />
      <line x1={wallX} x2={W - 8} y1={tableY} y2={tableY} stroke="#64748b" strokeWidth="1.5" />

      {/* free length */}
      <line x1={px(0)} x2={px(0)} y1={ay - blockH / 2 - 8} y2={rulerY} stroke="#94a3b8" strokeDasharray="4 3" />

      <Coil x1={wallX} y1={ay} x2={end} y2={ay} turns={turns} r={coilR} color={COL.steel} glow={Math.sqrt(E / E_MAX)} />

      {/* labels on the spring */}
      <RichPill x={wallX + 8} y={ay - coilR - (narrow ? 44 : 56)} text={`k = ${k} ${u.Nm}`} bg="#ecfccb" color="#3f6212" border="#a3e635" size={fs} box={box} anchor="start" />
      {E > 0.0005 && (end - wallX > (narrow ? 70 : 120) || !narrow) && (
        <RichPill x={(wallX + end) / 2} y={ay - coilR - (narrow ? 14 : 18)} text={`${sym.Ep} = ${f2(E)} ${u.J}`} bg={EN.el} size={fs} box={box} />
      )}

      {/* block, held by the hand */}
      <g role="presentation" style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <rect x={end - 8} y={ay - blockH / 2 - 14} width={blockW + 44} height={blockH + 20} fill="transparent" />
        <rect x={end} y={ay - blockH / 2} width={blockW} height={blockH} rx={6} fill="url(#se-block)" stroke="#1e293b" strokeWidth="1.5" />
        <rect x={end + 3} y={ay - blockH / 2 + 3} width={blockW - 6} height={5} rx={2} fill="#fff" opacity="0.35" />
        <line x1={end + blockW} x2={end + blockW + 10} y1={ay} y2={ay} stroke="#334155" strokeWidth="3" />
        <circle cx={end + blockW + (narrow ? 17 : 21)} cy={ay} r={narrow ? 8 : 11} fill="#fef2f2" stroke={COL.hand} strokeWidth="3" />
      </g>
      {Math.abs(x) < 0.05 && !narrow && (
        <text x={end + blockW + 42} y={ay + 4} fontSize="12" fill={COL.hand} fontWeight="600">
          {tx.drag}
        </text>
      )}

      {/* forces */}
      {F > 0.05 && (
        <g>
          <line x1={end} x2={end} y1={ay - blockH / 2} y2={yFel} stroke={COL.fel} strokeWidth="1" strokeDasharray="2 2" />
          <Arrow x1={end} y1={yFel} x2={end - dir * F * fpx} y2={yFel} color={COL.fel} width={3.5} head={Math.min(12, F * fpx * 0.6)} />
          <Tag x={end - dir * F * fpx - dir * 6} y={yFel + 5} text={T.sym.Fel} color={COL.fel} anchor={dir > 0 ? 'end' : 'start'} size={narrow ? 12 : 14} />
          <line x1={end + blockW} x2={end + blockW} y1={ay - blockH / 2} y2={yHand} stroke={COL.hand} strokeWidth="1" strokeDasharray="2 2" />
          <Arrow x1={end + blockW} y1={yHand} x2={end + blockW + dir * F * fpx} y2={yHand} color={COL.hand} width={3.5} head={Math.min(12, F * fpx * 0.6)} />
          <Tag x={end + blockW + dir * F * fpx + dir * 6} y={yHand + 5} text={narrow ? 'F' : `F = ${f1(F)} ${u.N}`} color={COL.hand} anchor={dir > 0 ? 'start' : 'end'} size={narrow ? 12 : 13} />
        </g>
      )}

      {/* ruler and deformation */}
      <RulerH y={rulerY} h={rh} x0={px(0)} s={s} from={X_MIN} to={X_MAX} unit={narrow ? undefined : tx.ruler} dec={dec} />
      {Math.abs(x) > 0.2 && <Arrow x1={px(0)} y1={rulerY - 7} x2={end} y2={rulerY - 7} color={COL.x} width={3} head={Math.min(10, Math.abs(x) * s * 0.5)} />}
      <text x={px(0)} y={rulerY + rh + 13} textAnchor="middle" fontSize="11" fill="#64748b">
        {tx.free}
      </text>
      {Math.abs(x) > 0.05 && <RichPill x={(px(0) + end) / 2} y={rulerY + rh + 34} text={tx.xTag(`${x > 0 ? '+' : ''}${f1(x)}`)} bg={COL.x} size={fs} box={box} />}

      {/* force scale */}
      <ScaleBar x={W - 18} y={H - 14} len={scaleN * fpx} label={`${scaleN} ${u.N}`} />
    </g>
  );
}
