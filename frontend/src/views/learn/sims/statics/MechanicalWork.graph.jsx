import { useMemo, useState } from 'react';
import { ChartArea, Grid3x3, Lightbulb, Square, Triangle } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  Coil,
  DarkGraph,
  FC,
  ForceArrow,
  GroupLabel,
  LabScene,
  Panel,
  PlayControls,
  SceneRow,
  Sym,
  TagPill,
  WC,
  niceCeil,
  num,
  signKey,
  signed,
} from './MechanicalWork.parts';

/**
 * Tab 3 — work is the area under the F–s graph.
 *  const   a constant force: a rectangle, A = F·s (preset 40 N · 5 m = 200 J)
 *  spring  stretching a spring slowly, F = kx: a triangle, A = ½·x·F = kx²/2
 *          (preset k = 200 N/m, x = 0.5 m: F = 100 N, A = 25 J)
 *  piece   a force in three parts: 0→40 N over 0–2 m (triangle, 40 J), 40 N over
 *          2–5 m (rectangle, 120 J), −20 N over 5–7 m (braking, below the axis, −40 J);
 *          A = 40 + 120 − 40 = 120 J
 * The body moves at a steady pace; the area is shaded up to where it is.
 */

const AXES = {
  const: { xMax: 10, yMin: 0, yMax: 100, xStep: 1, yStep: 10, dur: 4 },
  spring: { xMax: 0.6, yMin: 0, yMax: 240, xStep: 0.1, yStep: 20, dur: 3.5 },
  piece: { xMax: 8, yMin: -30, yMax: 50, xStep: 1, yStep: 10, dur: 5 },
};
const PIECE = [
  { a: 0, b: 2, fa: 0, fb: 40 },
  { a: 2, b: 5, fa: 40, fb: 40 },
  { a: 5, b: 7, fa: -20, fb: -20 },
];
const XTICKS = { const: [0, 2, 4, 6, 8, 10], spring: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], piece: [0, 2, 4, 6, 8] };
const MODES = { const: { icon: Square }, spring: { icon: Triangle }, piece: { icon: ChartArea } };
const IDLE = { u: 0, running: false, done: false };
const L0 = 0.25; // natural length of the spring, m

function segmentsOf(mode, p) {
  if (mode === 'const') return [{ a: 0, b: p.s, fa: p.F, fb: p.F }];
  if (mode === 'spring') return [{ a: 0, b: p.x, fa: 0, fb: p.k * p.x }];
  return PIECE;
}
const fAt = (g, x) => (g.b === g.a ? g.fa : g.fa + ((g.fb - g.fa) * (x - g.a)) / (g.b - g.a));
/** Force at u (the last segment that contains u). */
function forceAt(segs, u) {
  for (let i = segs.length - 1; i >= 0; i -= 1) if (u >= segs[i].a - 1e-9 && u <= segs[i].b + 1e-9) return fAt(segs[i], Math.min(u, segs[i].b));
  return 0;
}
function segIndex(segs, u) {
  for (let i = 0; i < segs.length; i += 1) if (u < segs[i].b - 1e-9) return i;
  return segs.length - 1;
}
/** Work of segment g from its start up to u (area, signed). */
function segWork(g, u) {
  const x1 = clamp(u, g.a, g.b);
  if (x1 <= g.a) return 0;
  return ((g.fa + fAt(g, x1)) / 2) * (x1 - g.a);
}
const workUpTo = (segs, u) => segs.reduce((acc, g) => acc + segWork(g, u), 0);

/** Shaded polygons between the graph and F = 0 over [from, to], split where F changes sign. */
function areaPolys(segs, from, to) {
  const out = [];
  for (const g of segs) {
    const x0 = Math.max(g.a, from);
    const x1 = Math.min(g.b, to);
    if (x1 - x0 < 1e-9) continue;
    const f0 = fAt(g, x0);
    const f1 = fAt(g, x1);
    if (f0 * f1 < 0) {
      const r = x0 + ((x1 - x0) * f0) / (f0 - f1);
      out.push({ x0, x1: r, f0, f1: 0 }, { x0: r, x1, f0: 0, f1 });
    } else out.push({ x0, x1, f0, f1 });
  }
  return out;
}

const colOf = (k) => ({ pos: WC.pos, zero: WC.zero, neg: WC.neg })[k];
const textOf = (k) => ({ pos: WC.posText, zero: WC.zeroText, neg: WC.negText })[k];

/* ==================================================================== sim */

export default function AreaSim({ T }) {
  const L = T.graph;
  const dec = T.decimal;
  const [mode, setMode] = useState('const');
  const [F, setF] = useState(40);
  const [s, setS] = useState(5);
  const [kSp, setK] = useState(200);
  const [xSp, setX] = useState(0.5);
  const [sim, setSim] = useState(IDLE);
  const ax = AXES[mode];
  const segs = useMemo(() => segmentsOf(mode, { F, s, k: kSp, x: xSp }), [mode, F, s, kSp, xSp]);
  const end = segs[segs.length - 1].b;
  const u = sim.u;
  const fNow = forceAt(segs, u);
  const aNow = workUpTo(segs, u);
  const aAll = workUpTo(segs, end);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const nu = Math.min(end, p.u + (end / ax.dur) * dt);
      const done = nu >= end - 1e-9;
      return { u: nu, running: !done, done };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
  };
  const pickMode = (m) => {
    setMode(m);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- explanation */
  const J = (n) => signed(n, mode === 'spring' ? 1 : 0, dec);
  const uD = mode === 'spring' ? 2 : 1;
  let key;
  if (sim.done) key = `done_${mode}`;
  else if (u === 0 && !sim.running) key = `intro_${mode}`;
  else key = mode === 'piece' ? `run_piece${segIndex(segs, u)}` : `run_${mode}`;
  const settled = useSettled(key, 120);
  const ex = L.explain;
  const text = {
    intro_const: ex.intro_const,
    run_const: ex.run_const(fmt(F, 0, dec), fmt(u, 1, dec), J(aNow)),
    done_const: ex.done_const(fmt(F, 0, dec), fmt(s, 1, dec), J(aAll), fmt(aAll / (ax.xStep * ax.yStep), 0, dec), fmt(ax.xStep * ax.yStep, 0, dec)),
    intro_spring: ex.intro_spring,
    run_spring: ex.run_spring(fmt(u, 2, dec), fmt(fNow, 0, dec), J(aNow)),
    done_spring: ex.done_spring(fmt(xSp, 2, dec), fmt(kSp * xSp, 0, dec), J(aAll), fmt(kSp, 0, dec)),
    intro_piece: ex.intro_piece,
    run_piece0: ex.run_piece0,
    run_piece1: ex.run_piece1,
    run_piece2: ex.run_piece2,
    done_piece: ex.done_piece,
  }[settled];
  const tone = settled.startsWith('done') ? colOf(signKey(aAll)) : settled === 'run_piece2' ? WC.neg : settled.startsWith('run') ? WC.pos : '#22d3ee';

  const kNow = signKey(aNow, mode === 'spring' ? 1 : 0);
  const kAll = signKey(aAll, mode === 'spring' ? 1 : 0);
  const cellJ = ax.xStep * ax.yStep;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.modesLabel}</GroupLabel>
          <Segmented
            label={L.modesLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={mode}
            onChange={pickMode}
            options={Object.keys(MODES).map((m) => ({ value: m, label: L.modes[m].name, sub: L.modes[m].sub, icon: MODES[m].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={u > 0} onToggle={toggle} onReset={reset} />
      </div>

      <SceneRow
        renderScene={(fitH) => <AreaScene T={T} mode={mode} segs={segs} u={u} fNow={fNow} aNow={aNow} running={sim.running} fitH={fitH} />}
        side={<AreaPanel T={T} mode={mode} segs={segs} u={u} done={sim.done} F={F} s={s} kSp={kSp} xSp={xSp} aAll={aAll} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={mode === 'spring' ? L.readouts.x : L.readouts.s}
          symbol={mode === 'spring' ? 'x' : 's'}
          value={fmt(u, uD, dec)}
          unit={T.m}
          accent={FC.disp}
          textColor={FC.dispText}
          sub={L.uSub(fmt(end, uD, dec))}
          active={sim.running}
        />
        <Readout
          label={L.readouts.F}
          symbol="F"
          value={num(fNow, mode === 'spring' ? 0 : 0, dec)}
          unit={T.N}
          accent={FC.pull}
          textColor={FC.pullText}
          sub={mode === 'piece' ? L.segNames[segIndex(segs, u)] : L.fSub[mode]}
        />
        <Readout label={L.readouts.A} symbol="A" value={J(aNow)} unit={T.J} accent={colOf(kNow)} textColor={textOf(kNow)} sub={L.aSub} active={sim.running} />
        <Readout label={L.readouts.total} symbol="A" value={J(aAll)} unit={T.J} accent={colOf(kAll)} textColor={textOf(kAll)} sub={L.totalSub(fmt(aAll / cellJ, mode === 'spring' ? 1 : 0, dec), fmt(cellJ, 0, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          {mode === 'const' && (
            <>
              <RangeField id="mw-gF" label={L.F} symbol="F" min={10} max={100} step={5} value={F} onChange={change(setF)} accent={FC.pull} display={`${F} ${T.N}`} hint={L.FHint} />
              <RangeField
                id="mw-gs"
                label={L.s}
                symbol="s"
                min={1}
                max={10}
                step={0.5}
                value={s}
                onChange={change(setS)}
                accent={FC.disp}
                display={`${fmt(s, 1, dec)} ${T.m}`}
                hint={L.sHint(fmt(F * s, 0, dec))}
              />
            </>
          )}
          {mode === 'spring' && (
            <>
              <RangeField
                id="mw-gk"
                label={L.k}
                symbol="k"
                min={50}
                max={400}
                step={10}
                value={kSp}
                onChange={change(setK)}
                accent="#7c3aed"
                display={`${kSp} ${T.Nm}`}
                hint={L.kHint}
              />
              <RangeField
                id="mw-gx"
                label={L.x}
                symbol="x"
                min={0.1}
                max={0.6}
                step={0.05}
                value={xSp}
                onChange={change(setX)}
                accent={FC.disp}
                display={`${fmt(xSp, 2, dec)} ${T.m}`}
                hint={L.xHint(fmt(kSp * xSp, 0, dec))}
              />
            </>
          )}
          {mode === 'piece' && <p className="text-sm leading-relaxed text-gray-300">{L.pieceNote}</p>}
          <div className="flex items-start gap-2.5 rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300">
            <Grid3x3 size={18} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
            <p>
              <Sym>{L.cellRule(fmt(ax.yStep, 0, dec), fmt(ax.xStep, mode === 'spring' ? 1 : 0, dec), fmt(cellJ, 0, dec))}</Sym>
            </p>
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <WorkGraph T={T} segs={segs} u={u} end={end} mode={mode} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function AreaScene({ T, mode, segs, u, fNow, aNow, running, fitH }) {
  const L = T.graph;
  const dec = T.decimal;
  const ax = AXES[mode];
  const cellJ = ax.xStep * ax.yStep;
  const xD = mode === 'spring' ? 1 : 0;
  const end = segs[segs.length - 1].b;
  return (
    <LabScene
      legend={[
        { color: FC.pull, label: L.legend.F, kind: 'line' },
        { color: WC.pos, label: L.legend.pos, kind: 'area' },
        ...(mode === 'piece' ? [{ color: WC.neg, label: L.legend.neg, kind: 'area' }] : []),
        { color: FC.disp, label: mode === 'spring' ? L.legend.x : L.legend.s, kind: 'arrow' },
      ]}
      chips={<Chip icon={Grid3x3}>{L.cell(fmt(ax.yStep, 0, dec), fmt(ax.xStep, xD, dec), fmt(cellJ, 0, dec))}</Chip>}
      height={(W, narrow) => fitH ?? (narrow ? 360 : 470)}
      ariaLabel={L.sceneLabel[mode](fmt(u, mode === 'spring' ? 2 : 1, dec), fmt(fNow, 0, dec), signed(aNow, mode === 'spring' ? 1 : 0, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const stripH = narrow ? 104 : 132;
        const gTop = stripH + (narrow ? 26 : 34);
        const gBot = H - (narrow ? 28 : 32);
        const padL = narrow ? 42 : 58;
        const padR = narrow ? 14 : 26;
        const gx = (v) => padL + (v / ax.xMax) * (W - padL - padR);
        const gy = (f) => gBot - ((f - ax.yMin) / (ax.yMax - ax.yMin)) * (gBot - gTop);
        const y0 = gy(0);
        const pxX = gx(ax.xStep) - gx(0);
        const pxY = gy(0) - gy(ax.yStep);
        const everyX = Math.max(1, Math.ceil(30 / pxX));
        const everyY = Math.max(1, Math.ceil(20 / pxY));

        /* grid and axes */
        const grid = [];
        const nX = Math.round(ax.xMax / ax.xStep);
        for (let i = 0; i <= nX; i += 1) {
          const v = i * ax.xStep;
          grid.push(<line key={`gx${i}`} x1={gx(v)} x2={gx(v)} y1={gTop} y2={gBot} stroke="#e2e8f0" />);
          if (i % everyX === 0 && i > 0)
            grid.push(
              <text key={`tx${i}`} x={gx(v)} y={gBot + 15} textAnchor="middle" fontSize={fs - 2} fill="#64748b">
                {fmt(v, xD, dec)}
              </text>,
            );
        }
        const nY0 = Math.round(ax.yMin / ax.yStep);
        const nY1 = Math.round(ax.yMax / ax.yStep);
        for (let j = nY0; j <= nY1; j += 1) {
          const v = j * ax.yStep;
          grid.push(<line key={`gy${j}`} x1={padL} x2={W - padR} y1={gy(v)} y2={gy(v)} stroke="#e2e8f0" />);
          if (j % everyY === 0)
            grid.push(
              <text key={`ty${j}`} x={padL - 6} y={gy(v) + 4} textAnchor="end" fontSize={fs - 2} fill={j === 0 ? '#0f172a' : '#64748b'} fontWeight={j === 0 ? 700 : 400}>
                {num(v, 0, dec)}
              </text>,
            );
        }

        /* areas: the part already covered (bright) and the rest (faint) */
        const done = areaPolys(segs, 0, u);
        const rest = areaPolys(segs, u, end);
        const poly = (p, key, faint) => {
          const k = p.f0 + p.f1 >= 0 ? 'pos' : 'neg';
          return (
            <polygon
              key={key}
              points={`${gx(p.x0)},${y0} ${gx(p.x0)},${gy(p.f0)} ${gx(p.x1)},${gy(p.f1)} ${gx(p.x1)},${y0}`}
              fill={colOf(k)}
              opacity={faint ? 0.07 : 0.34}
            />
          );
        };

        /* the graph line */
        const solid = [];
        const dashed = [];
        segs.forEach((g, i) => {
          const a1 = Math.min(g.b, Math.max(g.a, u));
          if (a1 > g.a) solid.push(<line key={`s${i}`} x1={gx(g.a)} y1={gy(g.fa)} x2={gx(a1)} y2={gy(fAt(g, a1))} stroke={FC.pull} strokeWidth="3.2" strokeLinecap="round" />);
          if (a1 < g.b) dashed.push(<line key={`d${i}`} x1={gx(a1)} y1={gy(fAt(g, a1))} x2={gx(g.b)} y2={gy(g.fb)} stroke={FC.pull} strokeWidth="2" strokeDasharray="6 5" opacity="0.55" />);
          const next = segs[i + 1];
          const fEnd = next ? next.fa : 0;
          if (Math.abs(fEnd - g.fb) > 1e-9) {
            dashed.push(<line key={`j${i}`} x1={gx(g.b)} y1={gy(g.fb)} x2={gx(g.b)} y2={gy(fEnd)} stroke={FC.pull} strokeWidth="1.4" strokeDasharray="2 3" opacity="0.6" />);
          }
        });

        /* labels inside the areas */
        const labels = [];
        if (mode === 'piece') {
          segs.forEach((g, i) => {
            const x1 = Math.min(g.b, u);
            if (x1 <= g.a) return;
            const w = segWork(g, u);
            if (gx(x1) - gx(g.a) < 34) return;
            const fm = (g.fa + fAt(g, x1)) / 2;
            const yC = g.fa === g.fb ? gy(fm / 2) : gy(fAt(g, x1) / 3);
            labels.push(
              <TagPill key={`l${i}`} x={(gx(g.a) + gx(x1)) / 2 + (g.fa === g.fb ? 0 : (gx(x1) - gx(g.a)) / 6)} y={yC} text={`A_{${i + 1}} = ${signed(w, 0, dec)} ${T.J}`} bg={w < 0 ? WC.negInk : WC.posInk} fs={fs - 1} box={box} />,
            );
          });
        } else if (u > 0) {
          const g = segs[0];
          const x1 = Math.min(u, g.b);
          const wpx = gx(x1) - gx(0);
          const f1 = fAt(g, x1);
          if (wpx > 60 && Math.abs(gy(f1) - y0) > 26) {
            const cx = mode === 'spring' ? gx((2 * x1) / 3) : gx(x1 / 2);
            const cy = mode === 'spring' ? gy(f1 / 3) : gy(f1 / 2);
            labels.push(<TagPill key="l" x={cx} y={cy} text={`A = ${signed(aNow, mode === 'spring' ? 1 : 0, dec)} ${T.J}`} bg={WC.posInk} fs={fs} box={box} />);
          }
        }

        const aligned = mode !== 'spring';
        const cur = gx(u);
        return (
          <>
            {/* the strip with the moving body */}
            <rect x={0} y={0} width={W} height={stripH} fill="#f8fafc" />
            <line x1={0} x2={W} y1={stripH} y2={stripH} stroke="#e2e8f0" strokeWidth="1.5" />
            {aligned ? <CartStrip T={T} u={u} fNow={fNow} gx={gx} stripH={stripH} narrow={narrow} fs={fs} box={box} ax={ax} running={running} W={W} /> : <SpringStrip T={T} u={u} fNow={fNow} stripH={stripH} narrow={narrow} fs={fs} box={box} ax={ax} W={W} padR={padR} />}

            {/* the F–s graph */}
            {grid}
            {rest.map((p, i) => poly(p, `r${i}`, true))}
            {done.map((p, i) => poly(p, `d${i}`, false))}
            <line x1={padL} x2={W - padR + 6} y1={y0} y2={y0} stroke="#334155" strokeWidth="1.8" />
            <path d={`M${W - padR + 10},${y0} L${W - padR + 2},${y0 - 4} L${W - padR + 2},${y0 + 4} Z`} fill="#334155" />
            <line x1={padL} x2={padL} y1={gBot} y2={gTop - 8} stroke="#334155" strokeWidth="1.8" />
            <path d={`M${padL},${gTop - 12} L${padL - 4},${gTop - 4} L${padL + 4},${gTop - 4} Z`} fill="#334155" />
            <text x={padL + 8} y={gTop - 6} fontSize={fs - 1} fontWeight="700" fill="#475569">
              F, {T.N}
            </text>
            <text x={W - padR} y={y0 - 7} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {mode === 'spring' ? 'x' : 's'}, {T.m}
            </text>
            {dashed}
            {solid}
            {labels}

            {/* cursor */}
            <line x1={cur} x2={cur} y1={aligned ? 8 : gTop - 4} y2={gBot} stroke="#0891b2" strokeWidth="1.4" strokeDasharray="4 4" opacity={u > 0 || aligned ? 0.8 : 0} />
            {u > 0 && <circle cx={cur} cy={gy(fNow)} r={5} fill={FC.pull} stroke="#fff" strokeWidth="2" />}
          </>
        );
      }}
    </LabScene>
  );
}

/** A cart on a track, its centre on the graph's s-axis, pulled by F (to the left when F < 0). */
function CartStrip({ T, u, fNow, gx, stripH, narrow, fs, box, ax, running, W }) {
  const trackY = stripH - (narrow ? 22 : 26);
  const cw = Math.max(narrow ? 30 : 44, (gx(0.75) - gx(0)) * 1);
  const chh = narrow ? 18 : 24;
  const c = { x: gx(u), y: trackY - chh / 2 - 7 };
  const kFs = (narrow ? 44 : 78) / Math.max(Math.abs(ax.yMax), Math.abs(ax.yMin));
  const fl = fNow * kFs;
  return (
    <g>
      <line x1={0} x2={W} y1={trackY} y2={trackY} stroke="#64748b" strokeWidth="2" />
      {running && <rect x={c.x - cw / 2 - 4} y={c.y - chh / 2 - 4} width={cw + 8} height={chh + 8} rx={7} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
      <rect x={c.x - cw / 2} y={c.y - chh / 2} width={cw} height={chh} rx={4} fill="#fcd9a8" stroke="#b7791f" strokeWidth="2" />
      <circle cx={c.x - cw * 0.28} cy={trackY - 4} r={4} fill="#334155" />
      <circle cx={c.x + cw * 0.28} cy={trackY - 4} r={4} fill="#334155" />
      {Math.abs(fl) > 2 && (
        <ForceArrow
          x={c.x + (fl > 0 ? cw / 2 : -cw / 2)}
          y={c.y}
          dx={fl}
          dy={0}
          color={FC.pull}
          label="F"
          value={`${num(fNow, 0, T.decimal)} ${T.N}`}
          fs={fs}
          box={box}
          width={3.2}
        />
      )}
    </g>
  );
}

/** A spring fixed to a wall, stretched slowly by a hand: F = kx at every moment. */
function SpringStrip({ T, u, fNow, stripH, narrow, fs, box, ax, W, padR }) {
  const L = T.graph;
  const dec = T.decimal;
  const y = stripH - (narrow ? 40 : 50);
  const wallX = narrow ? 16 : 26;
  const l0 = narrow ? 64 : 120;
  const kS = (W - padR - (narrow ? 70 : 130) - wallX - l0) / ax.xMax;
  const x0 = wallX + l0;
  const xe = x0 + u * kS;
  const kFs = (narrow ? 40 : 70) / ax.yMax;
  const hatch = [];
  for (let yy = y - 34; yy < y + 30; yy += 9) hatch.push(<line key={yy} x1={wallX - 10} y1={yy + 9} x2={wallX} y2={yy} stroke="#94a3b8" strokeWidth="1.2" />);
  return (
    <g>
      <rect x={wallX - 10} y={y - 34} width={10} height={64} fill="#e2e8f0" />
      {hatch}
      <line x1={wallX} x2={wallX} y1={y - 34} y2={y + 30} stroke="#475569" strokeWidth="2.4" />
      <Coil x1={wallX} y1={y} x2={xe} y2={y} turns={narrow ? 9 : 13} r={narrow ? 7 : 10} lead={8} />
      <line x1={xe} x2={xe} y1={y - 11} y2={y + 11} stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      <circle cx={xe + 9} cy={y} r={narrow ? 7 : 9} fill="#f5c9a6" stroke="#b45309" strokeWidth="1.6" />
      <line x1={x0} x2={x0} y1={y - 26} y2={y + 26} stroke="#0f172a" strokeWidth="1.3" strokeDasharray="3 3" />
      <text x={x0} y={y - 30} textAnchor="middle" fontSize={fs - 2} fill="#475569">
        x = 0
      </text>
      {fNow * kFs > 2 && <ForceArrow x={xe + 20} y={y} dx={fNow * kFs} dy={0} color={FC.pull} label="F" value={`${fmt(fNow, 0, dec)} ${T.N}`} fs={fs} box={box} />}
      {u > 0.002 && (
        <>
          <line x1={x0} x2={x0} y1={y + 20} y2={y + 32} stroke={FC.disp} strokeWidth="1.6" />
          <ForceArrow x={x0} y={y + 26} dx={xe - x0} dy={0} color={FC.disp} width={2.4} head={Math.min(10, (xe - x0) * 0.6)} />
          <TagPill x={(x0 + xe) / 2} y={y + 26 + fs + 4} text={`x = ${fmt(u, 2, dec)} ${T.m}`} bg={FC.disp} fs={fs - 1} box={box} />
        </>
      )}
      <text x={wallX + 4} y={y - 22} fontSize={fs - 2} fill="#64748b">
        {L.spring}
      </text>
    </g>
  );
}

/* ============================================================ side panel */

function AreaPanel({ T, mode, segs, u, done, F, s, kSp, xSp, aAll }) {
  const L = T.graph.side;
  const dec = T.decimal;
  const J = (n, d = 0) => `${signed(n, d, dec)} ${T.J}`;
  let rows;
  if (mode === 'const') {
    rows = [{ id: 'r', fig: L.rect, sym: 'A = F · s', nums: `= ${fmt(F, 0, dec)} ${T.N} · ${fmt(s, 1, dec)} ${T.m} =`, res: J(F * s), on: u > 0, w: F * s }];
  } else if (mode === 'spring') {
    rows = [
      {
        id: 't',
        fig: L.tri,
        sym: 'A = ½ · x · F_{max}',
        nums: `= ½ · ${fmt(xSp, 2, dec)} ${T.m} · ${fmt(kSp * xSp, 0, dec)} ${T.N} =`,
        res: J((kSp * xSp * xSp) / 2, 1),
        on: u > 0,
        w: 1,
      },
      { id: 'k', fig: L.spring, sym: 'A = kx²/2', nums: `= ${fmt(kSp, 0, dec)} · ${fmt(xSp, 2, dec)}² / 2 =`, res: J((kSp * xSp * xSp) / 2, 1), on: u > 0, w: 1 },
    ];
  } else {
    rows = segs.map((g, i) => {
      const w = segWork(g, g.b);
      const isTri = g.fa !== g.fb;
      return {
        id: `p${i}`,
        fig: `${i + 1}) ${isTri ? L.tri : L.rect} · ${fmt(g.a, 0, dec)}–${fmt(g.b, 0, dec)} ${T.m}${w < 0 ? ` · ${L.below}` : ''}`,
        sym: isTri ? `A_{${i + 1}} = ½ · Δs · F` : `A_{${i + 1}} = Δs · F`,
        nums: isTri ? `= ½ · ${fmt(g.b - g.a, 0, dec)} · ${fmt(g.fb, 0, dec)} =` : `= ${fmt(g.b - g.a, 0, dec)} · ${g.fa < 0 ? `(${num(g.fa, 0, dec)})` : fmt(g.fa, 0, dec)} =`,
        res: J(w),
        on: u > g.a + 1e-9,
        w,
      };
    });
  }
  const total = mode === 'piece' ? `A = ${segs.map((g, i) => (i === 0 ? fmt(segWork(g, g.b), 0, dec) : `${segWork(g, g.b) < 0 ? '−' : '+'} ${fmt(Math.abs(segWork(g, g.b)), 0, dec)}`)).join(' ')} = ${J(aAll)}` : null;
  return (
    <Panel>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">A = S</span>
        {L.title}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-gray-400">{L.lead}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const col = r.w < 0 ? WC.neg : WC.pos;
          return (
            <li
              key={r.id}
              className={`rounded-xl border px-3 py-2 transition-colors ${r.on ? '' : 'border-white/5 opacity-60'}`}
              style={r.on ? { borderColor: `${col}66`, background: `${col}12` } : undefined}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{r.fig}</p>
              <p className="mt-0.5 font-serif text-[15px] italic text-gray-100">
                <Sym>{r.sym}</Sym>
              </p>
              <p className="text-[13.5px] tabular-nums text-gray-400">
                <Sym>{r.nums}</Sym> <b style={{ color: r.w < 0 ? WC.negText : WC.posText }}>{r.res}</b>
              </p>
            </li>
          );
        })}
      </ul>
      {total && (
        <div className={`mt-2 rounded-xl bg-black/25 px-3 py-2.5 ${done ? 'ring-1 ring-emerald-400/50' : ''}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">{L.total}</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">
            <Sym>{total}</Sym>
          </p>
        </div>
      )}
      <ul className="mt-3 space-y-1 text-[12.5px] leading-snug text-gray-400">
        {L.rules.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-500" aria-hidden="true" />
            <span>
              <Sym>{r}</Sym>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ================================================================ graph */

function WorkGraph({ T, segs, u, end, mode }) {
  const L = T.graph.work;
  const dec = T.decimal;
  const ax = AXES[mode];
  const { all, top, bottom, step } = useMemo(() => {
    const pts = [];
    let hi = 0;
    let lo = 0;
    const n = 120;
    for (let i = 0; i <= n; i += 1) {
      const x = (end * i) / n;
      const w = workUpTo(segs, x);
      pts.push({ x, y: w });
      hi = Math.max(hi, w);
      lo = Math.min(lo, w);
    }
    const step = niceCeil(Math.max(hi - lo, 1e-6) / 4);
    return { all: pts, top: Math.ceil(hi / step - 1e-9) * step || step, bottom: Math.floor(lo / step + 1e-9) * step, step };
  }, [segs, end]);
  const yTicks = [];
  for (let v = bottom; v <= top + 1e-9; v += step) yTicks.push(v);
  const done = all.filter((p) => p.x <= u + 1e-9);
  if (u > 0) done.push({ x: u, y: workUpTo(segs, u) });
  const xD = mode === 'spring' ? 1 : 0;
  return (
    <DarkGraph
      title={L.title}
      series={[
        { id: 'all', color: 'rgba(251,191,36,0.35)', points: all, dash: '5 5', dot: false, width: 2 },
        { id: 'done', label: L.A, color: '#fbbf24', points: done.length ? done : [{ x: 0, y: 0 }] },
      ]}
      xMax={ax.xMax}
      xTicks={XTICKS[mode]}
      yMin={bottom}
      yMax={top}
      yTicks={yTicks}
      xLabel={mode === 'spring' ? L.xSpring : L.x}
      yLabel={L.y}
      marker={u > 0 ? u : undefined}
      decimal={dec}
      height={230}
      xDigits={xD}
      yDigits={step < 1 ? 1 : 0}
      note={L.note}
    />
  );
}
