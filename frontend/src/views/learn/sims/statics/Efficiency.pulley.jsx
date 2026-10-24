import { useMemo, useState } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, TimeGraph, makeView } from '../kit/scene';
import {
  BarEquation,
  Chip,
  DimLine,
  EC,
  Eq,
  EtaBar,
  FC,
  FikPanel,
  FlowPaper,
  ForceArrow,
  ForceScale,
  G,
  Ground,
  GroupLabel,
  LabScene,
  Panel,
  PlayControls,
  SankeyFlow,
  SceneRow,
  Step,
  Sym,
  SvgSym,
} from './Efficiency.parts';

/**
 * Tab 2 — lifting a load m by h = 1 m with a pulley system in which n rope
 * segments hold the moving block (n = 1: a fixed pulley, n = 2: a movable
 * pulley with a fixed one to turn the rope down, n = 3, 4: block and tackle).
 * Model (stated in the FIK panel):
 *   M = (number of movable pulleys)·m_b  — lifted together with the load
 *   F = (m + M)·g / n · (1 + n·k)        — k: extra force per pulley from axle friction
 *   s = n·h                              — the rope end travels n times further
 *   A_f = mgh,  A_t = F·s,  losses = Mgh (lifting the block) + k·n·(m + M)gh (heat)
 * Preset n = 2, m = 20 kg, m_b = 1 kg, k = 5 %:
 *   F = 21·9.8/2·1.1 = 113.19 N, s = 2 m, A_t = 226.38 J, A_f = 196 J,
 *   η = 86.6 %; losses 9.8 J (block) + 20.58 J (friction).
 * Ideal (k = 0, m_b = 0): F = mg/n, F·s = mgh, η = 100 % — the golden rule.
 */

const H_LIFT = 1; // m
const V_LOAD = 0.25; // m/s, real time
const R = 0.18; // pulley radius, m
const D = 2 * R; // spacing of the rope segments
const Y_CEIL = 5.95;
const Y_U = 5.55; // axle height of the fixed pulleys
const Y_LOAD0 = 0.5; // bottom of the load at the start
const LOAD_W = 0.56;
const LOAD_H = 0.6;
const HOOK = 0.38; // load top → axle of the movable pulleys
const MARK0 = Y_U - 0.42; // where the hand grips the free end at the start
const IDLE = { p: 0, running: false, done: false };
const SYSTEMS = [1, 2, 3, 4];
const N_COLORS = { 1: '#94a3b8', 2: '#60a5fa', 3: '#a78bfa', 4: '#f472b6' };

/** The forces and works of the system — nothing here changes while lifting. */
function pulleyPhysics(n, m, mb, k) {
  const movable = Math.floor(n / 2);
  const M = movable * mb;
  const W = (m + M) * G;
  const F0 = W / n;
  const F = F0 * (1 + n * k);
  const s = n * H_LIFT;
  const Af = m * G * H_LIFT;
  const At = F * s;
  const block = M * G * H_LIFT;
  const fric = At - W * H_LIFT;
  return { movable, M, W, F0, F, s, Af, At, block, fric, mg: m * G, eta: Af / At };
}

/** A tiny pulley-system icon for the selector: n rope segments, circles for the pulleys. */
function makePulleyIcon(n) {
  function PulleyIcon({ size = 16, strokeWidth = 2, style, className }) {
    const xs = Array.from({ length: n + 1 }, (_, i) => 12 - (n * 3.2) / 2 + i * 3.2);
    const upper = [];
    const lower = [];
    for (let i = 0; i < n; i += 1) ((i + 1) % 2 === n % 2 ? upper : lower).push((xs[i] + xs[i + 1]) / 2);
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth * 0.75} strokeLinecap="round" style={style} className={className} aria-hidden="true">
        <line x1="3" y1="2.5" x2="21" y2="2.5" />
        {upper.map((x) => (
          <circle key={`u${x}`} cx={x} cy="6" r="1.6" />
        ))}
        {lower.map((x) => (
          <circle key={`l${x}`} cx={x} cy="13.5" r="1.6" />
        ))}
        {xs.slice(0, n).map((x, i) => (
          <line key={x} x1={x} y1={i === 0 && n % 2 === 0 ? 2.5 : 6} x2={x} y2={i === 0 && n % 2 === 1 ? 15.5 : 13.5} />
        ))}
        <line x1={xs[n]} y1="6" x2={xs[n]} y2="21" />
        <rect x="9" y="16" width="6" height="5" rx="1" />
      </svg>
    );
  }
  return PulleyIcon;
}
const SYSTEM_ICONS = Object.fromEntries(SYSTEMS.map((n) => [n, makePulleyIcon(n)]));

/* ==================================================================== sim */

export default function PulleySim({ T }) {
  const L = T.pulley;
  const dec = T.decimal;
  const [n, setN] = useState(2);
  const [m, setM] = useState(20);
  const [mb, setMb] = useState(1);
  const [k, setK] = useState(0.05);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);

  const ph = useMemo(() => pulleyPhysics(n, m, mb, k), [n, m, mb, k]);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const np = Math.min(1, p.p + (dt * V_LOAD) / H_LIFT);
      const done = np >= 1 - 1e-9;
      return { p: done ? 1 : np, running: !done, done };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
    setTouched(true);
  };
  const toggle = () => {
    setTouched(true);
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const makeIdeal = () => {
    setK(0);
    setMb(0);
    setSim(IDLE);
    setTouched(true);
  };

  /* ---- live values */
  const hNow = sim.p * H_LIFT;
  const sNow = n * hNow;
  const t = hNow / V_LOAD;
  const AfNow = ph.mg * hNow;
  const AtNow = ph.F * sNow;
  const blockNow = ph.block * sim.p;
  const fricNow = ph.fric * sim.p;
  const ideal = k === 0 && ph.M === 0;
  const E1 = (v) => fmt(v, 1, dec);
  const F2 = (v) => fmt(v, 2, dec);
  const P1 = (v) => fmt(v * 100, 1, dec);
  const gain = ph.mg / ph.F;

  /* ---- explanation */
  let key;
  if (sim.done) key = ideal ? 'doneIdeal' : 'done';
  else if (sim.p > 0) key = n === 1 ? 'movingFixed' : 'moving';
  else if (!touched) key = 'intro';
  else if (ideal) key = n === 1 ? 'idealFixed' : 'ideal';
  else key = n === 1 ? 'fixed' : n === 2 ? 'movable' : 'tackle';
  const settled = useSettled(key, sim.running ? 250 : 0);
  const ex = L.explain;
  const losses = [ph.block > 1e-9 && L.lossBlock(E1(ph.block)), ph.fric > 1e-9 && L.lossFric(E1(ph.fric))].filter(Boolean).join(', ');
  const text = {
    intro: ex.intro,
    fixed: ex.fixed(F2(ph.F), E1(ph.mg)),
    movable: ex.movable(F2(ph.F), F2(gain)),
    tackle: ex.tackle(n, F2(ph.F), F2(gain)),
    ideal: ex.ideal(n),
    idealFixed: ex.idealFixed,
    moving: ex.moving(F2(hNow), F2(sNow), n),
    movingFixed: ex.movingFixed(F2(hNow)),
    done: ex.done(E1(ph.Af), E1(ph.At), P1(ph.eta), losses),
    doneIdeal: ex.doneIdeal(E1(ph.Af)),
  }[settled];
  const tone = {
    intro: '#22d3ee',
    fixed: '#94a3b8',
    movable: '#60a5fa',
    tackle: '#f472b6',
    ideal: '#a78bfa',
    idealFixed: '#a78bfa',
    moving: '#fb923c',
    movingFixed: '#fb923c',
    done: '#34d399',
    doneIdeal: '#34d399',
  }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.systemsLabel}</GroupLabel>
          <Segmented
            label={L.systemsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={n}
            onChange={change(setN)}
            options={SYSTEMS.map((v) => ({ value: v, label: L.systems[v].name, sub: L.systems[v].sub, icon: SYSTEM_ICONS[v] }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.p > 0} onToggle={toggle} onReset={reset} />
      </div>

      <SceneRow
        under={
          <Explain icon={Lightbulb} id={settled} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        renderScene={(fitH) => (
          <PulleyScene
            T={T}
            n={n}
            m={m}
            ph={ph}
            t={t}
            running={sim.running}
            live={{ AfNow, AtNow, blockNow, fricNow, hNow, sNow }}
            fitH={fitH}
          />
        )}
        side={<PulleyFik T={T} n={n} m={m} mb={mb} k={k} ph={ph} flowing={sim.running} phase={t} />}
      />


      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.F} symbol="F" value={F2(ph.F)} unit={T.N} accent={FC.pull} textColor={FC.pullText} sub={L.FSub(E1(ph.mg), F2(gain))} />
        <Readout
          label={L.readouts.Af}
          symbol={<Sym>{T.sym.Af}</Sym>}
          value={E1(AfNow)}
          unit={T.J}
          accent={EC.useful}
          textColor={EC.usefulText}
          active={sim.running}
          sub={L.AfSub(F2(hNow), E1(ph.Af))}
        />
        <Readout
          label={L.readouts.At}
          symbol={<Sym>{T.sym.At}</Sym>}
          value={E1(AtNow)}
          unit={T.J}
          accent={EC.inputBar}
          textColor={EC.inputText}
          active={sim.running}
          sub={L.AtSub(F2(sNow), E1(ph.At))}
        />
        <Readout label={L.readouts.eta} symbol="η" value={P1(ph.eta)} unit="%" accent="#22d3ee" textColor="#a5f3fc" sub={<Sym>{L.etaSub}</Sym>}>
          <EtaBar eta={ph.eta} />
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="eff-pu-m"
            label={L.m}
            symbol="m"
            min={5}
            max={100}
            step={5}
            value={m}
            onChange={change(setM)}
            accent={FC.weight}
            display={`${m} ${T.kg}`}
            hint={L.mHint(E1(ph.mg))}
          />
          <RangeField
            id="eff-pu-mb"
            label={L.mb}
            symbol={<Sym>{T.sym.mb}</Sym>}
            min={0}
            max={5}
            step={0.5}
            value={mb}
            onChange={change(setMb)}
            accent={EC.blockBar}
            display={`${fmt(mb, 1, dec)} ${T.kg}`}
            hint={ph.movable > 0 ? L.mbHint(ph.movable, fmt(ph.M, 1, dec)) : L.mbHintFixed}
          />
          <RangeField
            id="eff-pu-k"
            label={L.k}
            symbol="k"
            min={0}
            max={0.1}
            step={0.01}
            value={k}
            onChange={change((v) => setK(Math.round(v * 100) / 100))}
            accent={EC.heatBar}
            display={`${fmt(k * 100, 0, dec)} %`}
            hint={L.kHint(n, fmt(n * k * 100, 0, dec))}
          />
          <Btn icon={Sparkles} onClick={makeIdeal} disabled={ideal} className="w-full">
            {L.idealBtn}
          </Btn>
        </Panel>
        <Panel className="lg:col-span-3">
          <PulleyGraph T={T} n={n} m={m} mb={mb} k={k} eta={ph.eta} onPick={change((v) => setM(clamp(Math.round(v / 5) * 5, 5, 100)))} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

/** One pulley wheel at (x, y) px, turned by `angle` degrees. */
function PulleyWheel({ x, y, rp, angle, fixed }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <circle r={rp} fill={fixed ? '#f1f5f9' : '#e0f2fe'} stroke="#334155" strokeWidth="2" />
      <circle r={rp * 0.78} fill="none" stroke="#94a3b8" strokeWidth="1" />
      <g transform={`rotate(${angle.toFixed(1)})`}>
        {[0, 120, 240].map((a) => (
          <line key={a} x1={0} y1={0} x2={rp * 0.72 * Math.cos((a * Math.PI) / 180)} y2={rp * 0.72 * Math.sin((a * Math.PI) / 180)} stroke="#64748b" strokeWidth="1.5" />
        ))}
      </g>
      <circle r={2.6} fill="#334155" />
    </g>
  );
}

/** Pulleys and rope of an n-segment system, in world metres (load centred on x = 0). */
function layout(n, lift) {
  const x1 = (-(n - 1) * D) / 2;
  const xs = Array.from({ length: n + 1 }, (_, i) => x1 + i * D);
  const loadBottom = Y_LOAD0 + lift;
  const loadTop = loadBottom + LOAD_H;
  const yL = loadTop + HOOK; // axle of the movable pulleys
  const upper = [];
  const lower = [];
  for (let i = 0; i < n; i += 1) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    if ((i + 1) % 2 === n % 2) upper.push({ cx, i });
    else lower.push({ cx, i });
  }
  // rope: from its anchor, segment by segment, around each pulley, then the free end
  const anchor = n % 2 === 0 ? { x: xs[0], y: Y_CEIL } : { x: xs[0], y: n === 1 ? loadTop + 0.12 : yL };
  const pts = [{ type: 'M', x: anchor.x, y: anchor.y }];
  for (let i = 0; i < n; i += 1) {
    const up = (i + 1) % 2 === n % 2;
    const y = up ? Y_U : yL;
    pts.push({ type: 'L', x: xs[i], y });
    pts.push({ type: 'A', x: xs[i + 1], y, up });
  }
  return { xs, loadBottom, loadTop, yL, upper, lower, anchor, pts, free: xs[n] };
}

function PulleyScene({ T, n, m, ph, t, running, live, fitH }) {
  const L = T.pulley;
  const S = T.sym;
  const dec = T.decimal;
  const lmg = (narrow, H) => (narrow ? 44 : clamp(H * 0.11, 52, 70));

  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.mg, kind: 'arrow' },
        { color: FC.pull, label: L.legend.F, kind: 'arrow' },
        { color: FC.tension, label: L.legend.T, kind: 'arrow' },
        { color: EC.useful, label: L.legend.h, kind: 'dim' },
        { color: FC.pull, label: L.legend.s, kind: 'dim' },
      ]}
      chips={(W, narrow, H) => (
        <>
          <Chip>{L.chip(fmt(t, 2, dec))}</Chip>
          <ForceScale kF={lmg(narrow, H) / ph.mg} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => fitH ?? (narrow ? 470 : 600)}
      ariaLabel={L.sceneLabel(n, m, fmt(ph.F, 1, dec), fmt(live.hNow, 2, dec), fmt(live.sNow, 2, dec))}
    >
      {(W, H, narrow) => {
        const Lmg = lmg(narrow, H);
        const pad = narrow ? { l: 18, r: 18, t: 58, b: 26 } : { l: 30, r: 30, t: 74, b: 30 };
        const view = makeView({ x0: -1.35, x1: 1.6, y0: 0, y1: Y_CEIL + 0.12 }, W, H, pad);
        const kpx = view.k;
        const sx = view.sx;
        const sy = view.sy;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const kF = Lmg / ph.mg;
        const g = layout(n, live.hNow);
        const rp = R * kpx;

        /* rope path in screen px */
        const d = g.pts
          .map((q) => {
            if (q.type === 'M') return `M${sx(q.x)},${sy(q.y)}`;
            if (q.type === 'L') return `L${sx(q.x)},${sy(q.y)}`;
            return `A${rp},${rp} 0 0 ${q.up ? 1 : 0} ${sx(q.x)},${sy(q.y)}`;
          })
          .join(' ');
        const handY = MARK0 - n * live.hNow;
        const floorY = sy(0);
        const coilX = sx(g.free);

        /* the pulleys turn with the rope */
        const turn = (i, up) => ((up ? 1 : -1) * ((i + 1) * live.hNow) / R) * (180 / Math.PI);
        const lowerXs = g.lower.map((q) => q.cx);
        const yokeX0 = Math.min(...(n % 2 === 1 && n > 1 ? [g.xs[0]] : []), ...lowerXs) - (n > 1 ? 0.06 : 0);
        const yokeX1 = Math.max(...lowerXs, -Infinity) + 0.06;
        const loadCx = sx(0);
        const loadCy = sy(g.loadBottom + LOAD_H / 2);
        const hookTop = n === 1 ? g.loadTop + 0.12 : g.yL;

        /* tensions: n rope segments hold the moving block */
        const tLen = ph.F0 * kF;
        const segTop = n === 1 ? g.loadTop + 0.12 : g.yL;
        const tStartY = sy(segTop) - (n === 1 ? 2 : 0);

        const barsW = 176;
        const barsH = 186;
        const barsX = W - barsW - 14;
        const showBars = !narrow && barsX > sx(g.free + 0.48) + 44;

        return (
          <>
            <Grid view={view} W={W} H={H} />
            <Ground W={W} y={floorY} depth={H - floorY} />

            {/* ceiling */}
            <rect x={0} y={sy(Y_CEIL + 0.12) - 40} width={W} height={40 + 0.12 * kpx} fill="#e2e8f0" />
            {Array.from({ length: Math.ceil(W / 12) + 2 }, (_, i) => (
              <line key={i} x1={i * 12 - 12} y1={sy(Y_CEIL)} x2={i * 12} y2={sy(Y_CEIL) - 12} stroke="#cbd5e1" strokeWidth="1.2" />
            ))}
            <line x1={0} x2={W} y1={sy(Y_CEIL)} y2={sy(Y_CEIL)} stroke="#475569" strokeWidth="2" />

            {/* straps of the fixed pulleys */}
            {g.upper.map((q) => (
              <line key={`st${q.cx}`} x1={sx(q.cx)} x2={sx(q.cx)} y1={sy(Y_CEIL)} y2={sy(Y_U)} stroke="#475569" strokeWidth="3" />
            ))}
            {n % 2 === 0 && <circle cx={sx(g.anchor.x)} cy={sy(Y_CEIL) + 4} r={4} fill="none" stroke="#475569" strokeWidth="2" />}

            {/* the movable block: yoke, hook */}
            {n > 1 && (
              <>
                <line x1={sx(yokeX0)} x2={sx(yokeX1)} y1={sy(g.yL)} y2={sy(g.yL)} stroke="#475569" strokeWidth="4" strokeLinecap="round" />
                <line x1={loadCx} x2={loadCx} y1={sy(g.yL)} y2={sy(g.loadTop)} stroke="#475569" strokeWidth="2.5" />
              </>
            )}
            {n === 1 && <line x1={loadCx} x2={loadCx} y1={sy(hookTop)} y2={sy(g.loadTop)} stroke="#475569" strokeWidth="2.5" />}

            {/* rope, then the free end down to the floor coil */}
            <path d={d} fill="none" stroke="#7c5a2e" strokeWidth="2.2" strokeLinejoin="round" />
            <line x1={coilX} x2={coilX} y1={sy(Y_U)} y2={floorY - 6} stroke="#7c5a2e" strokeWidth="2.2" />
            {[0, 1, 2].map((i) => (
              <ellipse key={i} cx={coilX + 10} cy={floorY - 4 - i * 3} rx={14} ry={4} fill="none" stroke="#7c5a2e" strokeWidth="1.8" />
            ))}

            {/* pulleys */}
            {g.upper.map((q) => (
              <PulleyWheel key={`u${q.cx}`} x={sx(q.cx)} y={sy(Y_U)} rp={rp} angle={turn(q.i, true)} fixed />
            ))}
            {g.lower.map((q) => (
              <PulleyWheel key={`l${q.cx}`} x={sx(q.cx)} y={sy(g.yL)} rp={rp} angle={turn(q.i, false)} />
            ))}

            {/* the load */}
            {running && (
              <rect x={loadCx - (LOAD_W * kpx) / 2 - 5} y={sy(g.loadTop) - 5} width={LOAD_W * kpx + 10} height={LOAD_H * kpx + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />
            )}
            <rect x={loadCx - (LOAD_W * kpx) / 2} y={sy(g.loadTop)} width={LOAD_W * kpx} height={LOAD_H * kpx} rx={4} fill="#64748b" stroke="#334155" strokeWidth="2" />
            <rect x={loadCx - (LOAD_W * kpx) / 2 + 4} y={sy(g.loadTop) + 4} width={LOAD_W * kpx - 8} height={4} rx={2} fill="#94a3b8" />
            <text x={loadCx} y={sy(g.loadTop) + fs + 2} textAnchor="middle" fontSize={fs - 2} fontWeight="700" fill="#fff">
              {m} {T.kg}
            </text>

            {/* rulers: the load rises h, the rope end travels s = n·h */}
            <line x1={sx(-0.62)} x2={sx(-1.02)} y1={sy(Y_LOAD0)} y2={sy(Y_LOAD0)} stroke={EC.useful} strokeWidth="1" strokeDasharray="3 3" />
            <line x1={sx(-0.62)} x2={sx(-1.02)} y1={sy(Y_LOAD0 + H_LIFT)} y2={sy(Y_LOAD0 + H_LIFT)} stroke={EC.useful} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <SvgSym x={sx(-1.02) - 4} y={sy(Y_LOAD0 + H_LIFT) + 4} text={L.targetTag(fmt(H_LIFT, 0, dec))} color={EC.useful} fs={fs - 2} anchor="end" weight={600} italic={false} />
            <DimLine
              p1={{ x: sx(-0.82), y: sy(Y_LOAD0) }}
              p2={{ x: sx(-0.82), y: sy(g.loadBottom) }}
              color={EC.useful}
              label={live.hNow > 0.08 ? L.hTag(fmt(live.hNow, 2, dec)) : null}
              fs={fs - 1}
              box={box}
            />
            <line x1={coilX + 4} x2={sx(g.free + 0.58)} y1={sy(MARK0)} y2={sy(MARK0)} stroke={FC.pull} strokeWidth="1" strokeDasharray="3 3" />
            <DimLine
              p1={{ x: sx(g.free + 0.48), y: sy(MARK0) }}
              p2={{ x: sx(g.free + 0.48), y: sy(handY) }}
              color={FC.pull}
              label={live.sNow > 0.08 ? L.sTag(fmt(live.sNow, 2, dec)) : null}
              fs={fs - 1}
              box={box}
            />

            {/* forces: weight of the load, the pull F, the n tensions holding the block */}
            <ForceArrow x={loadCx} y={loadCy} dx={0} dy={Lmg} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: loadCx + 8, y: loadCy + Lmg + 2, anchor: 'start' }} />
            <circle cx={loadCx} cy={loadCy} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            {g.xs.slice(0, n).map((x, i) => (
              <ForceArrow
                key={`t${x}`}
                x={sx(x)}
                y={tStartY}
                dx={0}
                dy={-tLen}
                color={FC.tension}
                width={2.4}
                head={8}
                label={i === 0 ? S.T : null}
                fs={fs - 1}
                box={box}
                labelAt={{ x: sx(x) - 6, y: tStartY - tLen * 0.55, anchor: 'end' }}
              />
            ))}
            <g pointerEvents="none">
              <rect x={sx(0) - 26} y={tStartY - tLen - 30} width={52} height={20} rx={10} fill={FC.tension} />
              <text x={sx(0)} y={tStartY - tLen - 16} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#fff">
                n = {n}
              </text>
            </g>

            {/* the hand on the free end and the pull F */}
            <g transform={`translate(${coilX.toFixed(1)} ${sy(handY).toFixed(1)})`}>
              <rect x={-9} y={-12} width={18} height={24} rx={7} fill="#f1c27d" stroke="#b07a3b" strokeWidth="1.5" />
              {[-5, 0, 5].map((yy) => (
                <line key={yy} x1={-7} x2={3} y1={yy} y2={yy} stroke="#b07a3b" strokeWidth="1" />
              ))}
              <rect x={7} y={-9} width={22} height={18} rx={4} fill="#3b82f6" stroke="#1e40af" strokeWidth="1.2" />
            </g>
            <ForceArrow x={coilX} y={sy(handY) + 14} dx={0} dy={ph.F * kF} color={FC.pull} label={S.F} fs={fs} box={box} labelAt={{ x: coilX - 8, y: sy(handY) + 14 + ph.F * kF + 2, anchor: 'end' }} />

            {/* live bar equation  A_t = A_f + losses */}
            {showBars && (
              <BarEquation
                x={barsX}
                y={narrow ? 70 : 132}
                w={barsW}
                h={barsH}
                full={ph.At}
                title={L.barsTitle}
                fs={11}
                box={box}
                valueText={(v) => fmt(v, 1, dec)}
                cols={[
                  { sym: S.At, value: live.AtNow, ghost: ph.At, color: EC.input, parts: [{ value: live.AtNow, color: EC.inputBar }] },
                  { sym: S.Af, value: live.AfNow, ghost: ph.Af, color: EC.useful, parts: [{ value: live.AfNow, color: EC.usefulBar }] },
                  {
                    sym: S.loss,
                    value: live.blockNow + live.fricNow,
                    ghost: ph.block + ph.fric,
                    color: EC.heat,
                    parts: [
                      { value: live.blockNow, color: EC.blockBar },
                      { value: live.fricNow, color: EC.heatBar },
                    ],
                  },
                ]}
              />
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* ============================================================ FIK panel */

function PulleyFik({ T, n, m, mb, k, ph, flowing, phase }) {
  const L = T.pulley;
  const M = L.method;
  const S = T.sym;
  const dec = T.decimal;
  const E1 = (v) => fmt(v, 1, dec);
  const F2 = (v) => fmt(v, 2, dec);
  const P1 = (v) => fmt(v * 100, 1, dec);
  const gS = fmt(G, 1, dec);
  const items = [
    { id: 'use', label: M.flowUseful, value: ph.Af, color: EC.useful, fill: EC.usefulBar, valueText: `${E1(ph.Af)} ${T.J} · ${P1(ph.eta)} %` },
    ph.block > 1e-9 && { id: 'block', label: M.flowBlock, value: ph.block, color: EC.block, fill: EC.blockBar, valueText: `${E1(ph.block)} ${T.J} · ${P1(ph.block / ph.At)} %` },
    ph.fric > 1e-9 && { id: 'fric', label: M.flowFric, value: ph.fric, color: EC.heat, fill: EC.heatBar, valueText: `${E1(ph.fric)} ${T.J} · ${P1(ph.fric / ph.At)} %` },
  ].filter(Boolean);
  const mS = fmt(m, 0, dec);
  const MS = fmt(ph.M, ph.M % 1 ? 1 : 0, dec);

  return (
    <FikPanel
      formula={M.formula}
      title={M.title}
      flow={
        <FlowPaper title={M.flowTitle} height={items.length > 2 ? 214 : 186} ariaLabel={M.flowLabel(E1(ph.At), E1(ph.Af))}>
          {(W, H) => (
            <>
              <SvgSym x={12} y={44} text={S.At} value={`${E1(ph.At)} ${T.J}`} color="#334155" fs={12} anchor="start" halo={false} />
              <SankeyFlow
                box={{ x: 12, y: 54, w: W - 20, h: H - 64 }}
                total={ph.At}
                labelW={Math.min(150, W * 0.44)}
                flowing={flowing}
                phase={phase}
                items={items}
              />
            </>
          )}
        </FlowPaper>
      }
    >
      <Step n={1} title={M.s1}>
        <Eq sym={`${S.Af} = mgh`} nums={`= ${mS}·${gS}·${fmt(H_LIFT, 0, dec)} =`} result={`${E1(ph.Af)} ${T.J}`} resultColor={EC.usefulText} />
      </Step>
      <Step n={2} title={M.s2}>
        <p className="mt-0.5 text-gray-400">{ph.movable > 0 ? M.mass(ph.movable, fmt(mb, mb % 1 ? 1 : 0, dec), MS) : M.massFixed}</p>
        <Eq sym="F = (m + M)g / n · (1 + n·k)" nums={`= (${mS} + ${MS})·${gS} / ${n} · (1 + ${n}·${fmt(k, 2, dec)}) = ${F2(ph.F)} ${T.N}`} />
        <Eq sym="s = n·h" nums={`= ${n}·${fmt(H_LIFT, 0, dec)} = ${fmt(ph.s, 0, dec)} ${T.m}`} />
      </Step>
      <Step n={3} title={M.s3}>
        <Eq sym={`${S.At} = F·s`} nums={`= ${F2(ph.F)}·${fmt(ph.s, 0, dec)} =`} result={`${E1(ph.At)} ${T.J}`} resultColor={EC.inputText} />
        <Eq sym={`η = ${S.Af} / ${S.At} · 100 %`} nums={`= ${E1(ph.Af)} / ${E1(ph.At)} · 100 % =`} result={`${P1(ph.eta)} %`} resultColor="#a5f3fc" />
      </Step>
      <Step n={4} title={M.s4}>
        <p className="mt-0.5 tabular-nums">{n === 1 ? M.goldFixed(F2(ph.mg / ph.F)) : M.gold(F2(ph.mg / ph.F), n)}</p>
        {n > 1 && <p className="mt-0.5 text-gray-400">{k === 0 && ph.M === 0 ? M.goldIdeal : M.goldNote}</p>}
      </Step>
    </FikPanel>
  );
}

/* ================================================================ graph */

function PulleyGraph({ T, n, m, mb, k, eta, onPick }) {
  const L = T.pulley;
  const dec = T.decimal;
  const curves = useMemo(
    () =>
      SYSTEMS.map((nn) => {
        const pts = [];
        for (let mm = 1; mm <= 100; mm += 1) {
          const ph = pulleyPhysics(nn, mm, mb, k);
          pts.push({ x: mm, y: ph.eta * 100 });
        }
        return { nn, pts };
      }),
    [mb, k],
  );
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        ...curves.map((c) => ({
          id: `n${c.nn}`,
          label: `n = ${c.nn}`,
          color: N_COLORS[c.nn],
          points: c.pts,
          dash: c.nn === n ? undefined : '5 5',
          dot: false,
        })),
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: m, y: eta * 100 }] },
      ]}
      xMax={100}
      yMax={100}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={m}
      decimal={dec}
      height={262}
      onScrub={onPick}
      note={L.graph.note}
    />
  );
}
