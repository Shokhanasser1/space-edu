import { useRef, useState } from 'react';
import { Hand, Lightbulb, Link2, Minus, Play, RotateCcw, Rows2 } from 'lucide-react';
import { Arrow, Btn, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import { COL, Calc, Coil, Defs, Panel, RichPill, RulerH, SimScene, Tag, TimeChip, Toolbar, XYGraph, integrate, rich } from './ElasticForce.parts';

/**
 * Stretch or compress a spring by dragging the block on its end (or with
 * the slider) and see the elastic force: F_el = k|x|, always pointing back
 * towards the undeformed length - to the wall when stretched, away from it
 * when compressed (F_el,x = −kx). The hand holding the block pulls with an
 * equal and opposite force F.
 *
 * Two springs together: in series the same force runs through both and
 * the stretches add (x = x₁ + x₂, 1/k = 1/k₁ + 1/k₂); in parallel both
 * stretch by x and the forces add (F = F₁ + F₂, k = k₁ + k₂).
 *
 * "Release" lets the 0.5 kg block go: a lightly damped oscillation about
 * x = 0 on a smooth table, shown slowed down 3×.
 */

const SLOW = 3;
const M_BLOCK = 0.5; // kg
const ZETA = 0.05;
const X_MIN = -6; // cm
const X_MAX = 10; // cm
const L0 = 20; // cm, free length of the whole set
const PRESET = { mode: 'one', k1: 100, k2: 100, x: 5 };

function kEq(mode, k1, k2) {
  if (mode === 'series') return (k1 * k2) / (k1 + k2);
  if (mode === 'parallel') return k1 + k2;
  return k1;
}

export default function StiffSim({ T }) {
  const tx = T.stiff;
  const u = T.u;
  const dec = T.decimal;
  const [mode, setMode] = useState(PRESET.mode);
  const [k1, setK1] = useState(PRESET.k1);
  const [k2, setK2] = useState(PRESET.k2);
  const [sim, setSim] = useState({ x: PRESET.x / 100, v: 0, running: false, released: false });

  const k = kEq(mode, k1, k2);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const c = 2 * ZETA * Math.sqrt(k * M_BLOCK);
      const r = integrate(p.x, p.v, dt / SLOW, (x, v) => (-k * x - c * v) / M_BLOCK);
      if (Math.abs(r.x) < 2e-4 && Math.abs(r.v) < 3e-3) return { ...p, x: 0, v: 0, running: false };
      return { ...p, x: r.x, v: r.v };
    });
  });

  const hold = (xcm) => setSim({ x: clamp(xcm, X_MIN, X_MAX) / 100, v: 0, running: false, released: false });
  const release = () => setSim((p) => ({ ...p, v: 0, running: true, released: true }));
  const reset = () => {
    setMode(PRESET.mode);
    setK1(PRESET.k1);
    setK2(PRESET.k2);
    hold(PRESET.x);
  };

  /* ---- physics */
  const x = sim.x; // m, + stretched, − compressed
  const xcm = x * 100;
  const Fel = k * Math.abs(x); // N
  const Fx = -k * x; // projection on the x axis (to the right)
  const x1 = mode === 'series' ? (k * x) / k1 : x; // m
  const x2 = mode === 'series' ? (k * x) / k2 : x;
  const F1 = k1 * Math.abs(mode === 'series' ? x1 : x);
  const F2 = k2 * Math.abs(mode === 'series' ? x2 : x);
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const kTxt = (n) => (Math.abs(n - Math.round(n)) < 1e-6 ? fmt(n, 0, dec) : fmt(n, 1, dec));

  /* ---- explanation */
  const still = Math.abs(xcm) < 0.05;
  let key;
  if (sim.released && sim.running) key = 'run';
  else if (sim.released && still) key = 'rest';
  else if (still) key = 'zero';
  else if (mode === 'series') key = xcm > 0 ? 'seriesS' : 'seriesC';
  else if (mode === 'parallel') key = xcm > 0 ? 'parallelS' : 'parallelC';
  else key = xcm > 0 ? 'stretch' : 'compress';
  const settled = useSettled(key, key === 'run' ? 0 : 250);
  const ex = tx.explain;
  const ax = f1(Math.abs(xcm));
  let text;
  if (settled === 'run') text = ex.run;
  else if (settled === 'rest') text = ex.rest;
  else if (settled === 'zero') text = ex.zero;
  else if (settled === 'stretch') text = ex.stretch(ax, f2(Fel));
  else if (settled === 'compress') text = ex.compress(ax, f2(Fel));
  else if (settled.startsWith('series')) text = `${xcm > 0 ? ex.stretchShort(ax, f2(Fel)) : ex.compressShort(ax, f2(Fel))} ${ex.series(f1(Math.abs(x1 * 100)), f1(Math.abs(x2 * 100)), kTxt(k))}`;
  else if (settled.startsWith('parallel')) text = `${xcm > 0 ? ex.stretchShort(ax, f2(Fel)) : ex.compressShort(ax, f2(Fel))} ${ex.parallel(f2(F1), f2(F2), kTxt(k))}`;
  else text = ex.zero;
  const tone = { run: '#fbbf24', rest: '#22d3ee', zero: '#22d3ee' }[settled] ?? (xcm < 0 ? '#f472b6' : '#22d3ee');

  const legend = [
    { label: tx.legend.fel, color: COL.fel, kind: 'arrow' },
    ...(sim.released ? [] : [{ label: tx.legend.hand, color: COL.hand, kind: 'arrow' }]),
    { label: tx.legend.x, color: COL.x, kind: 'line' },
  ];

  /* ---- calculation rows */
  const xm = f2(Math.abs(x));
  const rows = [];
  if (mode === 'series') rows.push({ sym: 'k', color: '#d9f99d', formula: 'k₁k₂ / (k₁ + k₂)', subst: `${k1}·${k2} / (${k1} + ${k2})`, result: `${kTxt(k)} ${u.Nm}` });
  if (mode === 'parallel') rows.push({ sym: 'k', color: '#d9f99d', formula: 'k₁ + k₂', subst: `${k1} + ${k2}`, result: `${kTxt(k)} ${u.Nm}` });
  rows.push({ sym: T.fel, color: COL.felText, formula: 'k·|x|', subst: `${kTxt(k)} ${u.Nm} · ${xm} ${T.m}`, result: `${f2(Fel)} ${u.N}` });
  if (mode === 'series') rows.push({ sym: 'x₁', color: COL.s1Text, formula: `${T.fel} / k₁`, subst: `${f2(Fel)} / ${k1}`, result: `${f1(Math.abs(x1 * 100))} ${u.cm}` });
  if (mode === 'parallel') rows.push({ sym: 'F₁', color: COL.s1Text, formula: 'k₁·|x|', subst: `${k1} · ${xm}`, result: `${f2(F1)} ${u.N}` });

  const yMax = (k1 + k2) * 0.06;
  const yMin = -(k1 + k2) * 0.1;
  const yStep = (k1 + k2) * 0.16 > 30 ? 10 : (k1 + k2) * 0.16 > 12 ? 5 : 2;
  const line = (kk) => [
    { x: X_MIN, y: (-kk * X_MIN) / 100 },
    { x: X_MAX, y: (-kk * X_MAX) / 100 },
  ];
  const graphLines =
    mode === 'one'
      ? [{ id: 'k1', pts: line(k1), color: COL.felText }]
      : [
          { id: 'k1', pts: line(k1), color: COL.s1Text, width: 1.5, dash: '5 4' },
          { id: 'k2', pts: line(k2), color: COL.s2Text, width: 1.5, dash: '5 4' },
          { id: 'k', pts: line(k), color: COL.felText },
        ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.modeLabel}
        cols="grid-cols-1 sm:grid-cols-3"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setSim((p) => ({ ...p, running: false, released: false, v: 0 }));
        }}
        accent="#a3e635"
        options={[
          { value: 'one', label: tx.modes.one.name, sub: tx.modes.one.sub, icon: Minus },
          { value: 'series', label: tx.modes.series.name, sub: tx.modes.series.sub, icon: Link2 },
          { value: 'parallel', label: tx.modes.parallel.name, sub: tx.modes.parallel.sub, icon: Rows2 },
        ]}
      >
        <Btn variant="primary" icon={sim.released ? Hand : Play} onClick={sim.released ? () => hold(xcm) : release} disabled={!sim.released && still} className="min-h-[52px] text-[15px] xl:min-w-[168px]">
          {sim.released ? tx.grab : tx.release}
        </Btn>
        <Btn icon={RotateCcw} onClick={reset} className="min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={sim.released ? T.common.slower(SLOW) : tx.chipHold} extra={T.common.cell(`1 ${u.cm}`)} />}
        ariaLabel={tx.sceneLabel(f1(xcm), kTxt(k), f2(Fel))}
        height={(W, narrow) => (narrow ? clamp(W * 0.86, 300, 350) : clamp(W * 0.33, 340, 380))}
      >
        {(W, H, narrow) => (
          <StiffDrawing W={W} H={H} narrow={narrow} mode={mode} k1={k1} k2={k2} x={x} x1={x1} x2={x2} Fx={Fx} released={sim.released} onDrag={hold} tx={tx} T={T} kTxt={kTxt} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.x}
          symbol="x"
          value={`${xcm > 0.05 ? '+' : ''}${f1(xcm)}`}
          unit={u.cm}
          accent={COL.x}
          textColor={COL.xText}
          sub={still ? tx.readouts.none : xcm > 0 ? tx.readouts.stretch : tx.readouts.compress}
        />
        <Readout label={tx.readouts.k} symbol="k" value={kTxt(k)} unit={u.Nm} accent="#a3e635" textColor="#d9f99d" sub={tx.modes[mode].sub} />
        <Readout
          label={tx.readouts.fel}
          symbol={rich(T.fel)}
          value={f2(Fel)}
          unit={u.N}
          accent={COL.fel}
          textColor={COL.felText}
          sub={still ? tx.readouts.noForce : Fx < 0 ? tx.readouts.toWall : tx.readouts.fromWall}
        />
        <Readout label={tx.readouts.parts[mode]} accent={mode === 'one' ? COL.hand : COL.s1} textColor="#fff">
          <div className="mt-2 space-y-1 text-sm tabular-nums">
            {mode === 'one' ? (
              <>
                <p className="flex justify-between gap-2">
                  <span style={{ color: COL.handText }}>{tx.readouts.hand}</span>
                  <span className="font-semibold">{sim.released ? '—' : `${f2(Fel)} ${u.N}`}</span>
                </p>
                <p className="text-xs leading-snug text-gray-400">{rich(tx.readouts.third)}</p>
              </>
            ) : mode === 'series' ? (
              <>
                <p className="flex justify-between gap-2">
                  <span style={{ color: COL.s1Text }}>x₁</span>
                  <span className="font-semibold">{`${f1(x1 * 100)} ${u.cm}`}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span style={{ color: COL.s2Text }}>x₂</span>
                  <span className="font-semibold">{`${f1(x2 * 100)} ${u.cm}`}</span>
                </p>
                <p className="text-xs text-gray-400">{tx.readouts.seriesNote}</p>
              </>
            ) : (
              <>
                <p className="flex justify-between gap-2">
                  <span style={{ color: COL.s1Text }}>F₁</span>
                  <span className="font-semibold">{`${f2(F1)} ${u.N}`}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span style={{ color: COL.s2Text }}>F₂</span>
                  <span className="font-semibold">{`${f2(F2)} ${u.N}`}</span>
                </p>
                <p className="text-xs text-gray-400">{rich(tx.readouts.parallelNote)}</p>
              </>
            )}
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="ef-x"
            label={tx.xLabel}
            symbol="x"
            min={X_MIN}
            max={X_MAX}
            step={0.5}
            value={Math.round(xcm * 2) / 2}
            onChange={hold}
            accent={COL.x}
            display={`${xcm > 0.05 ? '+' : ''}${f1(xcm)} ${u.cm}`}
            hint={tx.xHint}
          />
          <RangeField id="ef-k1" label={tx.k1} symbol="k₁" min={20} max={150} step={10} value={k1} onChange={setK1} accent={COL.s1Text} display={`${k1} ${u.Nm}`} />
          {mode !== 'one' && <RangeField id="ef-k2" label={tx.k2} symbol="k₂" min={20} max={150} step={10} value={k2} onChange={setK2} accent={COL.s2Text} display={`${k2} ${u.Nm}`} />}
          <Calc title={tx.calc} rows={rows} />
        </Panel>
        <Panel className="lg:col-span-3">
          <XYGraph
            title={tx.graph.title}
            legend={
              mode === 'one'
                ? [{ label: tx.graph.eq(kTxt(k)), color: COL.felText }]
                : [
                    { label: tx.graph.k1(k1), color: COL.s1Text, kind: 'dash' },
                    { label: tx.graph.k2(k2), color: COL.s2Text, kind: 'dash' },
                    { label: tx.graph.eq(kTxt(k)), color: COL.felText },
                  ]
            }
            xMin={X_MIN}
            xMax={X_MAX}
            yMin={yMin}
            yMax={yMax}
            xStep={2}
            yStep={yStep}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            lines={graphLines}
            marker={{ x: xcm, y: Fx, color: '#fff' }}
            height={250}
            decimal={dec}
            ariaLabel={tx.graph.label}
            note={tx.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

function StiffDrawing({ W, H, narrow, mode, k1, k2, x, x1, x2, Fx, released, onDrag, tx, T, kTxt }) {
  const dec = T.decimal;
  const u = T.u;
  const f1 = (n) => fmt(n, 1, dec);
  const f2 = (n) => fmt(n, 2, dec);
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const drag = useRef(null);

  const wallX = narrow ? 18 : 44;
  const blockW = narrow ? 30 : 44;
  const blockH = narrow ? 40 : 52;
  const room = narrow ? 58 : 200; // room right of the farthest block for the hand's arrow
  const s = clamp((W - wallX - blockW - room) / (L0 + X_MAX), 5, 28); // px per cm
  const ay = Math.round(H * (narrow ? 0.48 : 0.47));
  const tableY = ay + blockH / 2;
  const px = (cm) => wallX + (L0 + cm) * s;
  const xcm = x * 100;
  const end = px(xcm);
  const view = makeView({ x0: -wallX / s, x1: (W - wallX) / s, y0: -(H - ay) / s, y1: ay / s }, W, H, { l: 0, r: 0, t: 0, b: 0 });

  /* forces: one scale for the scene, sized for the largest force the sliders allow */
  const maxF = (k1 + k2) * 0.1;
  const fpx = Math.min(narrow ? 6 : 12, (narrow ? 52 : 190) / maxF);
  const F = Math.abs(Fx);
  const dir = Math.sign(x); // +1 stretched
  const yFel = ay - blockH / 2 - (narrow ? 34 : 22);
  const yHand = yFel - (narrow ? 24 : 30);

  const toCm = (e) => {
    const svg = e.currentTarget.ownerSVGElement ?? e.currentTarget;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    return (sx - wallX) / s - L0;
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = toCm(e) - xcm;
    onDrag(Math.round(xcm * 10) / 10);
  };
  const onMove = (e) => {
    if (drag.current === null) return;
    onDrag(Math.round((toCm(e) - drag.current) * 10) / 10);
  };
  const onUp = () => {
    drag.current = null;
  };

  /* springs */
  const springs = [];
  const turns = Math.max(10, Math.round((L0 * s) / 15)); // fixed by the free length, so a stretched spring opens its coils
  if (mode === 'one') springs.push(<Coil key="a" x1={wallX} y1={ay} x2={end} y2={ay} turns={turns} r={narrow ? 8 : 12} color={COL.s1} />);
  if (mode === 'series') {
    const j = wallX + (L0 / 2 + x1 * 100) * s;
    springs.push(<Coil key="a" x1={wallX} y1={ay} x2={j - 5} y2={ay} turns={Math.round(turns / 2)} r={narrow ? 8 : 12} color={COL.s1} />);
    springs.push(<Coil key="b" x1={j + 5} y1={ay} x2={end} y2={ay} turns={Math.round(turns / 2)} r={narrow ? 8 : 12} color={COL.s2} />);
    springs.push(<circle key="j" cx={j} cy={ay} r={narrow ? 4 : 5.5} fill="#fff" stroke="#334155" strokeWidth="2.5" />);
  }
  if (mode === 'parallel') {
    const dy = narrow ? 11 : 15;
    springs.push(<Coil key="a" x1={wallX} y1={ay - dy} x2={end} y2={ay - dy} turns={turns} r={narrow ? 6 : 9} color={COL.s1} />);
    springs.push(<Coil key="b" x1={wallX} y1={ay + dy} x2={end} y2={ay + dy} turns={turns} r={narrow ? 6 : 9} color={COL.s2} />);
  }

  /* spring labels */
  const labels = [];
  const ly = mode === 'parallel' ? ay - (narrow ? 34 : 44) : ay - (narrow ? 26 : 32);
  if (mode === 'one') labels.push(<RichPill key="la" x={(wallX + end) / 2} y={ly} text={`k = ${kTxt(k1)} ${u.Nm}`} bg={COL.s1} size={fs} box={box} />);
  if (mode === 'series') {
    const j = wallX + (L0 / 2 + x1 * 100) * s;
    labels.push(<RichPill key="la" x={(wallX + j) / 2} y={ly} text={`k₁ = ${k1}`} bg={COL.s1} size={fs} box={box} />);
    labels.push(<RichPill key="lb" x={(j + end) / 2} y={ly} text={`k₂ = ${k2}`} bg={COL.s2} size={fs} box={box} />);
    if (!narrow && Math.abs(xcm) > 0.4) {
      labels.push(<RichPill key="x1" x={(wallX + j) / 2} y={ay + blockH / 2 + 2} text={`x₁ = ${f1(x1 * 100)} ${u.cm}`} bg="#fff" color={COL.s1} border="#fcd34d" size={11} box={box} />);
      labels.push(<RichPill key="x2" x={(j + end) / 2} y={ay + blockH / 2 + 2} text={`x₂ = ${f1(x2 * 100)} ${u.cm}`} bg="#fff" color={COL.s2} border="#c4b5fd" size={11} box={box} />);
    }
  }
  if (mode === 'parallel') {
    labels.push(<RichPill key="la" x={(wallX + end) / 2} y={ly} text={`k₁ = ${k1}`} bg={COL.s1} size={fs} box={box} />);
    labels.push(<RichPill key="lb" x={(wallX + end) / 2} y={ay + (narrow ? 30 : 38)} text={`k₂ = ${k2}`} bg={COL.s2} size={fs} box={box} />);
  }

  const rulerY = tableY + (narrow ? 22 : 30);
  const rh = narrow ? 22 : 26;
  const hatch = [];
  for (let y = ay - 80; y < tableY + 6; y += 9) hatch.push(<line key={y} x1={wallX - 14} y1={y + 9} x2={wallX} y2={y} stroke="#94a3b8" strokeWidth="1.2" />);

  return (
    <g>
      <Defs />
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={Math.max(10, s * 0.99)} />

      {/* wall and table */}
      <rect x={wallX - 14} y={ay - 80} width={14} height={tableY - ay + 86} fill="#e2e8f0" />
      {hatch}
      <line x1={wallX} x2={wallX} y1={ay - 80} y2={tableY + 6} stroke="#334155" strokeWidth="3" />
      <rect x={wallX} y={tableY} width={W - wallX - 8} height={6} fill="#cbd5e1" />
      <line x1={wallX} x2={W - 8} y1={tableY} y2={tableY} stroke="#64748b" strokeWidth="1.5" />

      {/* free length */}
      <line x1={px(0)} x2={px(0)} y1={ay - blockH / 2 - 8} y2={rulerY} stroke="#94a3b8" strokeDasharray="4 3" />

      {springs}
      {labels}

      {/* block */}
      <g
        role="presentation"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <rect x={end - 6} y={ay - blockH / 2 - 14} width={blockW + 40} height={blockH + 18} fill="transparent" />
        <rect x={end} y={ay - blockH / 2} width={blockW} height={blockH} rx={6} fill="url(#ef-block)" stroke="#1e293b" strokeWidth="1.5" />
        <rect x={end + 3} y={ay - blockH / 2 + 3} width={blockW - 6} height={5} rx={2} fill="#fff" opacity="0.35" />
        <text x={end + blockW / 2} y={ay + 4} textAnchor="middle" fontSize={narrow ? 9 : 11} fontWeight="700" fill="#fff">
          {tx.block}
        </text>
        {!released && (
          <g>
            <line x1={end + blockW} x2={end + blockW + 10} y1={ay} y2={ay} stroke="#334155" strokeWidth="3" />
            <circle cx={end + blockW + (narrow ? 17 : 21)} cy={ay} r={narrow ? 8 : 11} fill="#fdf4ff" stroke={COL.hand} strokeWidth="3" />
          </g>
        )}
      </g>
      {!released && Math.abs(xcm) < 0.05 && !narrow && (
        <text x={end + blockW + 40} y={ay + 4} fontSize="12" fill="#a21caf" fontWeight="600">
          {tx.drag}
        </text>
      )}

      {/* forces */}
      {F > 0.01 && (
        <g>
          <line x1={end} x2={end} y1={ay - blockH / 2} y2={yFel} stroke={COL.fel} strokeWidth="1" strokeDasharray="2 2" />
          <Arrow x1={end} y1={yFel} x2={end - dir * F * fpx} y2={yFel} color={COL.fel} width={3.5} head={12} />
          <Tag x={end - dir * F * fpx - dir * 6} y={yFel + 5} text={T.fel} color={COL.fel} anchor={dir > 0 ? 'end' : 'start'} size={narrow ? 12 : 14} />
          {!released && (
            <>
              <line x1={end + blockW} x2={end + blockW} y1={ay - blockH / 2} y2={yHand} stroke={COL.hand} strokeWidth="1" strokeDasharray="2 2" />
              <Arrow x1={end + blockW} y1={yHand} x2={end + blockW + dir * F * fpx} y2={yHand} color={COL.hand} width={3} head={11} />
              <Tag x={end + blockW + dir * F * fpx + dir * 6} y={yHand + 5} text="F" color={COL.hand} anchor={dir > 0 ? 'start' : 'end'} size={narrow ? 12 : 14} />
            </>
          )}
          {!narrow && <RichPill x={end + blockW / 2} y={yHand - (released ? -8 : 22)} text={tx.felTag(f2(F))} bg={COL.fel} size={fs} box={box} />}
        </g>
      )}

      {/* ruler and deformation */}
      <RulerH y={rulerY} h={rh} x0={px(0)} s={s} from={X_MIN} to={X_MAX} unit={narrow ? undefined : tx.ruler} dec={dec} />
      {Math.abs(xcm) > 0.2 && <Arrow x1={px(0)} y1={rulerY - 6} x2={end} y2={rulerY - 6} color={COL.x} width={3} head={Math.min(10, Math.abs(xcm) * s * 0.5)} />}
      <text x={px(0)} y={rulerY + rh + 15} textAnchor="middle" fontSize="11" fill="#64748b">
        {tx.free}
      </text>
      {Math.abs(xcm) > 0.05 && (
        <RichPill x={(px(0) + end) / 2} y={rulerY + rh + (narrow ? 34 : 38)} text={tx.xTag(`${xcm > 0 ? '+' : ''}${f1(xcm)}`)} bg={COL.x} size={fs} box={box} />
      )}

      {/* force scale */}
      <g>
        <line x1={W - 22 - 5 * fpx} x2={W - 22} y1={H - 16} y2={H - 16} stroke="#334155" strokeWidth="2" />
        <line x1={W - 22 - 5 * fpx} x2={W - 22 - 5 * fpx} y1={H - 20} y2={H - 12} stroke="#334155" strokeWidth="1.5" />
        <line x1={W - 22} x2={W - 22} y1={H - 20} y2={H - 12} stroke="#334155" strokeWidth="1.5" />
        <text x={W - 28 - 5 * fpx} y={H - 12} textAnchor="end" fontSize="11" fill="#475569">
          {tx.scale(5)}
        </text>
      </g>
    </g>
  );
}
