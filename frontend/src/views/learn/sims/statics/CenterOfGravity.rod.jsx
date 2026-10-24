import { useId, useRef, useState } from 'react';
import { Crosshair, Equal, Hand, Layers, Lightbulb, Scale, Snail, Weight } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  CC,
  CgMark,
  Chip,
  Eq,
  ForceArrow,
  ForceScale,
  FormulaPanel,
  G,
  GroupLabel,
  LabScene,
  Panel,
  PlayControls,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  deg,
  num,
  rad,
  svgPoint,
  symWidth,
} from './CenterOfGravity.parts';
import { makeView } from '../kit/scene';

/**
 * Tab 1 — loads on a light rod balanced on a finger. The weights m₁g, m₂g
 * (m₃g) of the loads add up to one resultant M·g that passes through the
 * centre of gravity C:
 *   x_C = (m₁x₁ + m₂x₂ + …) / (m₁ + m₂ + …),
 * and the rod stays level only when the finger is right under C. Otherwise
 * the moment M·g·(x_C − x_T) turns it about the fingertip until an end
 * touches the table (shown four times slower than real).
 * Preset: 2 kg at 0.20 m and 3 kg at 0.70 m → x_C = 2.5 / 5 = 0.50 m,
 * M·g = 49 N; check: 19.6·0.30 = 29.4·0.20 = 5.88 N·m.
 */

const ROD = 1; // m, length of the light rod (a metre stick)
const HS = 0.3; // m, height of the fingertip above the table
const SLOW = 0.25; // the tipping is shown four times slower than real
const TOL = 0.005; // m, half the width of the fingertip: closer than this counts as "under C"
const X_MIN = 0.05;
const X_MAX = 0.95;
const XS_MIN = 0.1;
const XS_MAX = 0.9;
const IDLE = { th: 0, om: 0, running: false, done: null, started: false };

const PRESETS = {
  lesson: { m: [2, 3], x: [0.2, 0.7], xs: 0.4, icon: Scale },
  equal: { m: [2, 2], x: [0.1, 0.9], xs: 0.35, icon: Equal },
  heavy: { m: [4, 1], x: [0.1, 0.9], xs: 0.5, icon: Weight },
  three: { m: [1, 2, 3], x: [0.2, 0.5, 0.8], xs: 0.45, icon: Layers },
};

const snap = (v, step) => Math.round(v / step) * step;
const loadsOf = (p) => p.m.map((m, i) => ({ m, x: p.x[i] }));

/** Centre of gravity of the loads and the turning of the rod about the fingertip. */
function analyse(loads, xs) {
  const M = loads.reduce((s, l) => s + l.m, 0);
  const sum = loads.reduce((s, l) => s + l.m * l.x, 0);
  const xc = sum / M;
  const off = xc - xs;
  const I = Math.max(1e-4, loads.reduce((s, l) => s + l.m * (l.x - xs) ** 2, 0));
  const limR = Math.min(Math.asin(Math.min(1, HS / (ROD - xs))), rad(35));
  const limL = Math.min(Math.asin(Math.min(1, HS / xs)), rad(35));
  return { M, sum, xc, off, I, limR, limL, balanced: Math.abs(off) < TOL };
}

export default function RodSim({ T }) {
  const L = T.rod;
  const dec = T.decimal;
  const [loads, setLoads] = useState(() => loadsOf(PRESETS.lesson));
  const [xs, setXs] = useState(PRESETS.lesson.xs);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);

  const a = analyse(loads, xs);
  const preset =
    Object.keys(PRESETS).find((k) => {
      const p = PRESETS[k];
      return p.m.length === loads.length && p.m.every((m, i) => m === loads[i].m && Math.abs(p.x[i] - loads[i].x) < 1e-9);
    }) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      let { th, om } = p;
      let done = null;
      let rem = dt * SLOW;
      while (rem > 1e-9) {
        const h = Math.min(1 / 600, rem);
        rem -= h;
        om += ((a.M * G * a.off * Math.cos(th)) / a.I) * h;
        th += om * h;
        if (th >= a.limR) {
          th = a.limR;
          done = 'right';
          break;
        }
        if (th <= -a.limL) {
          th = -a.limL;
          done = 'left';
          break;
        }
      }
      return { ...p, th, om: done ? 0 : om, running: !done, done };
    });
  });

  const changed = () => {
    setSim(IDLE);
    setTouched(true);
  };
  const setLoad = (i, patch) => {
    setLoads((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    changed();
  };
  const setCount = (n) => {
    setLoads((ls) => (n > ls.length ? [...ls, { m: 1, x: ls.some((l) => Math.abs(l.x - 0.9) < 1e-9) ? 0.45 : 0.9 }] : ls.slice(0, n)));
    changed();
  };
  const moveFinger = (v) => {
    setXs(clamp(v, XS_MIN, XS_MAX));
    changed();
  };
  const pick = (id) => {
    const p = PRESETS[id];
    setLoads(loadsOf(p));
    setXs(p.xs);
    changed();
  };
  const toggle = () => {
    setTouched(true);
    if (sim.done || !sim.started) {
      setSim(a.balanced ? { ...IDLE, started: true, done: 'balanced' } : { ...IDLE, started: true, running: true });
    } else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- numbers */
  const F2 = (n) => fmt(n, 2, dec);
  const F1 = (n) => fmt(n, 1, dec);
  const M1 = (n) => fmt(n, Number.isInteger(n) ? 0 : 1, dec);
  const Mg = a.M * G;
  const side = a.off > 0 ? 'right' : 'left';

  /* ---- explanation */
  let key;
  if (sim.done === 'balanced') key = 'balanced';
  else if (sim.done) key = sim.done === 'right' ? 'fellR' : 'fellL';
  else if (sim.started) key = a.off > 0 ? 'tipR' : 'tipL';
  else if (a.balanced) key = 'ready';
  else if (!touched) key = 'intro';
  else key = 'held';
  const settled = useSettled(key, key === 'held' ? 300 : 0);
  const ex = L.explain;
  const text = {
    intro: ex.intro(F2(xs), F2(a.xc)),
    ready: ex.ready(F2(a.xc)),
    balanced: ex.balanced(F1(Mg)),
    held: ex.held(F2(a.xc), F2(Math.abs(a.off)), L.side[side]),
    tipR: ex.tip(F2(Math.abs(a.off)), L.side.right),
    tipL: ex.tip(F2(Math.abs(a.off)), L.side.left),
    fellR: ex.fell(L.dir.right, F2(a.xc)),
    fellL: ex.fell(L.dir.left, F2(a.xc)),
  }[settled];
  const tone = { intro: '#22d3ee', ready: '#22d3ee', balanced: '#34d399', held: '#a78bfa', tipR: '#fb923c', tipL: '#fb923c', fellR: '#f87171', fellL: '#f87171' }[
    settled
  ];

  const status = sim.done === 'balanced' ? L.thSub.balanced : sim.done ? L.thSub[sim.done === 'right' ? 'fellR' : 'fellL'] : sim.started ? L.thSub[side] : a.balanced ? L.thSub.ready : L.thSub.held;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={L.play} running={sim.running} done={!!sim.done} started={sim.started} onToggle={toggle} onReset={reset} />
      </div>

      <SceneRow
        renderScene={(fitH) => (
          <RodScene
            T={T}
            loads={loads}
            xs={xs}
            a={a}
            sim={sim}
            fitH={fitH}
            onLoad={(i, x) => setLoad(i, { x })}
            onFinger={moveFinger}
          />
        )}
        side={<RodFormula T={T} loads={loads} a={a} xs={xs} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.xc}
          symbol={<Sym>{'x_{C}'}</Sym>}
          value={F2(a.xc)}
          unit={T.m}
          accent={CC.cg}
          textColor="#fde68a"
          sub={L.xcSub(fmt(a.sum, 2, dec), M1(a.M))}
        />
        <Readout label={L.readouts.Mg} symbol="Mg" value={F1(Mg)} unit={T.N} accent={CC.result} textColor={CC.resultText} sub={L.MgSub(M1(a.M))} />
        <Readout
          label={L.readouts.xs}
          symbol={<Sym>{L.sym.xs}</Sym>}
          value={F2(xs)}
          unit={T.m}
          accent="#f2c4a0"
          textColor="#fde7d6"
          sub={a.balanced ? L.xsOn : L.xsOff(num(a.off, 2, dec))}
          active={a.balanced}
        />
        <Readout label={L.readouts.th} symbol="θ" value={`${F1(Math.abs(deg(sim.th)))}°`} accent={a.balanced ? CC.stable : '#fb923c'} textColor="#e2e8f0" sub={status} active={sim.running} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GroupLabel>{L.panel.loads}</GroupLabel>
            <Segmented
              label={L.panel.count}
              className="grid-cols-2 w-full sm:w-auto"
              value={loads.length}
              onChange={setCount}
              options={[2, 3].map((n) => ({ value: n, label: L.panel.countOpt(n) }))}
            />
          </div>
          {loads.map((l, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-black/20 px-3 pt-2 pb-1">
              <p className="text-xs font-semibold text-gray-300">
                <Sym>{L.panel.load(i + 1)}</Sym>
              </p>
              <div className="grid gap-x-5 sm:grid-cols-2">
                <RangeField
                  id={`cog-m${i}`}
                  label={L.panel.mass}
                  symbol={<Sym>{`m_{${i + 1}}`}</Sym>}
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={l.m}
                  onChange={(v) => setLoad(i, { m: v })}
                  accent={CC.weight}
                  display={`${M1(l.m)} ${T.kg}`}
                />
                <RangeField
                  id={`cog-x${i}`}
                  label={L.panel.pos}
                  symbol={<Sym>{`x_{${i + 1}}`}</Sym>}
                  min={X_MIN}
                  max={X_MAX}
                  step={0.05}
                  value={l.x}
                  onChange={(v) => setLoad(i, { x: v })}
                  accent="#94a3b8"
                  display={`${F2(l.x)} ${T.m}`}
                />
              </div>
            </div>
          ))}
        </Panel>
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="cog-xs"
            label={L.panel.support}
            symbol={<Sym>{L.sym.xs}</Sym>}
            min={XS_MIN}
            max={XS_MAX}
            step={0.01}
            value={xs}
            onChange={moveFinger}
            accent="#f2c4a0"
            display={`${F2(xs)} ${T.m}`}
            hint={L.panel.supportHint}
          />
          <Btn icon={Crosshair} onClick={() => moveFinger(a.xc)} disabled={a.balanced} className="w-full min-h-11">
            {L.panel.snap}
          </Btn>
          <p className="flex gap-2 rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">
            <Hand size={15} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
            <span>{L.panel.note}</span>
          </p>
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

/** A rounded label with an italic symbol in it (for x_C, x₁…). */
function SymPill({ x, y, text, value, bg, color = '#fff', fs = 12, box }) {
  const w = symWidth(text, value, fs) + 16;
  const h = fs + 10;
  let left = x - w / 2;
  if (box) left = clamp(left, 4, box.w - w - 4);
  return (
    <g pointerEvents="none">
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h / 2} fill={bg} />
      <SvgSym x={left + w / 2} y={y + fs * 0.36} text={text} value={value} color={color} fs={fs} halo={false} />
    </g>
  );
}

function RodScene({ T, loads, xs, a, sim, fitH, onLoad, onFinger }) {
  const L = T.rod;
  const dec = T.decimal;
  const gid = useId().replace(/:/g, '');
  const drag = useRef(null);
  const balanced = a.balanced;
  const Mg = a.M * G;

  return (
    <LabScene
      legend={[
        { color: CC.weight, label: L.legend.w, kind: 'arrow' },
        { color: CC.result, label: L.legend.res, kind: 'arrow' },
        { color: CC.normal, label: L.legend.N, kind: 'arrow' },
        { color: CC.cg, label: L.legend.cg, kind: 'cg' },
        { color: CC.result, label: L.legend.line, kind: 'dash' },
      ]}
      chips={(W, narrow, H) => {
        const k = rodView(W, H, narrow).k;
        const held = !sim.started && !balanced;
        return (
          <>
            {(!narrow || !held) && (
              <Chip icon={Snail}>
                {L.chipSlow}
              </Chip>
            )}
            <ForceScale kF={forceK(k, Mg)} label={T.scale} unit={T.N} decimal={dec} />
            {held && (
              <Chip icon={Hand} color="#c2410c">
                {L.chipHeld}
              </Chip>
            )}
          </>
        );
      }}
      height={(W, narrow) => fitH ?? (narrow ? 300 : 452)}
      ariaLabel={L.sceneLabel(fmt(a.xc, 2, dec), fmt(xs, 2, dec), fmt(Math.abs(deg(sim.th)), 1, dec))}
    >
      {(W, H, narrow) => {
        const view = rodView(W, H, narrow);
        const k = view.k;
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const rodT = narrow ? 9 : 15;
        const th = sim.th;
        const cx = view.sx(xs);
        const cy = view.sy(HS);
        const cos = Math.cos(th);
        const sin = Math.sin(th);
        /* a point of the rod at coordinate u (m), v px above its lower face */
        const P = (u, v) => {
          const ax = (u - xs) * k;
          const ay = -v;
          return { x: cx + ax * cos - ay * sin, y: cy + ax * sin + ay * cos };
        };
        const kF = forceK(k, Mg);
        const bw = 0.08 * k;
        const hb = (m) => (0.04 + 0.012 * m) * k;
        const fallen = sim.done === 'right' || sim.done === 'left';
        const tableY = view.sy(0);
        const C = P(a.xc, rodT / 2);
        const hbMax = Math.max(...loads.map((l) => hb(l.m)));
        const pillY = Math.max(narrow ? 16 : 24, cy - rodT - hbMax - (narrow ? 40 : 50));

        /* drag a load or the finger along the rod */
        const start = (id) => (e) => {
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // the pointer is already gone: dragging still works without capture
          }
          drag.current = id;
        };
        const move = (id) => (e) => {
          if (drag.current !== id) return;
          const u = view.wx(svgPoint(e, e.currentTarget).x);
          if (id === 'f') onFinger(snap(u, 0.01));
          else onLoad(id, clamp(snap(u, 0.05), X_MIN, X_MAX));
        };
        const end = () => {
          drag.current = null;
        };
        const dragProps = (id) => ({
          onPointerDown: start(id),
          onPointerMove: move(id),
          onPointerUp: end,
          onPointerCancel: end,
          style: { cursor: 'ew-resize', touchAction: 'none' },
        });

        /* ruler ticks on the rod */
        const ticks = [];
        for (let i = 0; i <= 20; i += 1) {
          const u = i * 0.05;
          const major = i % 2 === 0;
          const x = view.sx(u);
          ticks.push(<line key={`t${i}`} x1={x} x2={x} y1={cy - rodT} y2={cy - rodT + (major ? rodT * 0.45 : rodT * 0.28)} stroke="#92400e" strokeWidth="1" />);
          if (!narrow && major && i > 0 && i < 20) {
            ticks.push(
              <text key={`n${i}`} x={x} y={cy - 2.5} textAnchor="middle" fontSize="8.5" fill="#92400e">
                {fmt(u, 1, dec)}
              </text>,
            );
          }
        }

        return (
          <g>
            <defs>
              <linearGradient id={`${gid}-steel`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#64748b" />
                <stop offset="0.45" stopColor="#cbd5e1" />
                <stop offset="1" stopColor="#475569" />
              </linearGradient>
              <clipPath id={`${gid}-above`}>
                <rect x={0} y={0} width={W} height={tableY} />
              </clipPath>
            </defs>

            {/* table */}
            <rect x={0} y={tableY} width={W} height={H - tableY} fill="#ead7b9" />
            <rect x={0} y={tableY} width={W} height={5} fill="#c9a77a" />
            <line x1={0} x2={W} y1={tableY} y2={tableY} stroke="#8b6b43" strokeWidth="1.5" />
            {Array.from({ length: 11 }, (_, i) => (
              <text key={i} x={view.sx(i / 10)} y={tableY + 18} textAnchor="middle" fontSize="10" fill="#8b6b43" aria-hidden="true">
                {narrow && i % 2 ? '' : fmt(i / 10, 1, dec)}
              </text>
            ))}
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`g${i}`} x1={view.sx(i / 10)} x2={view.sx(i / 10)} y1={tableY} y2={tableY + 5} stroke="#8b6b43" strokeWidth="1" />
            ))}
            <text x={view.sx(1) + 14} y={tableY + 18} textAnchor="start" fontSize="10" fontWeight="600" fill="#8b6b43" aria-hidden="true">
              {narrow ? '' : `x, ${T.m}`}
            </text>

            {/* the line of action of the resultant, through C */}
            <line x1={C.x} x2={C.x} y1={pillY} y2={tableY} stroke={CC.result} strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="5 5" />
            <SymPill x={C.x} y={pillY} text={L.sym.xc} value={`${fmt(a.xc, 2, dec)} ${T.m}`} bg={CC.cg} fs={fs} box={box} />

            {/* finger */}
            <g {...dragProps('f')}>
              <Finger cx={cx} tipY={cy} tableY={tableY} k={k} />
              <rect x={cx - 0.06 * k} y={cy} width={0.12 * k} height={tableY - cy} fill="transparent" />
            </g>

            {/* the rod with the loads, turned about the fingertip */}
            <g transform={`rotate(${deg(th).toFixed(3)} ${cx.toFixed(1)} ${cy.toFixed(1)})`}>
              <rect x={view.sx(0)} y={cy - rodT} width={ROD * k} height={rodT} rx={2} fill={CC.wood} stroke={CC.woodEdge} strokeWidth="1.2" />
              {ticks}
              {loads.map((l, i) => {
                const h = hb(l.m);
                const x = view.sx(l.x);
                return (
                  <g key={i} {...dragProps(i)}>
                    <path d={`M${x - 4},${cy - rodT - h} q4,-9 8,0`} fill="none" stroke="#475569" strokeWidth="2" />
                    <rect x={x - bw / 2} y={cy - rodT - h} width={bw} height={h} rx={3} fill={`url(#${gid}-steel)`} stroke="#334155" strokeWidth="1.2" />
                    <line x1={x - bw / 2 + 3} x2={x + bw / 2 - 3} y1={cy - rodT - h + 2.5} y2={cy - rodT - h + 2.5} stroke="#f8fafc" strokeWidth="1.5" opacity="0.7" />
                    <text x={x} y={cy - rodT - h + Math.min(h * 0.5 + 2, narrow ? 10.5 : 14)} textAnchor="middle" fontSize={narrow ? 9 : 11} fontWeight="700" fill="#0f172a">
                      {`${fmt(l.m, Number.isInteger(l.m) ? 0 : 1, dec)}${narrow ? '' : ` ${T.kg}`}`}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* labels above the loads */}
            {loads.map((l, i) => {
              const top = P(l.x, rodT + hb(l.m) + 16);
              return (
                <SvgSym
                  key={`lx${i}`}
                  x={top.x}
                  y={top.y}
                  text={`x_{${i + 1}}`}
                  value={narrow ? null : `${fmt(l.x, 2, dec)} ${T.m}`}
                  color="#334155"
                  fs={fs}
                />
              );
            })}

            {/* forces */}
            {!fallen && (
              <g clipPath={`url(#${gid}-above)`}>
                {loads.map((l, i) => {
                  const o = P(l.x, rodT + hb(l.m) / 2);
                  const len = l.m * G * kF;
                  return (
                    <g key={`w${i}`}>
                      <line x1={o.x} y1={o.y} x2={o.x} y2={o.y + len - 4} stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
                      <ForceArrow
                        x={o.x}
                        y={o.y}
                        dx={0}
                        dy={len}
                        color={CC.weight}
                        width={narrow ? 2.2 : 2.6}
                        head={narrow ? 8 : 10}
                        label={`m_{${i + 1}}g`}
                        value={narrow ? null : `${fmt(l.m * G, 1, dec)} ${T.N}`}
                        fs={fs}
                        box={box}
                      />
                    </g>
                  );
                })}
                <ForceArrow
                  x={C.x}
                  y={C.y}
                  dx={0}
                  dy={Mg * kF}
                  color={CC.result}
                  width={narrow ? 3 : 3.8}
                  head={narrow ? 10 : 13}
                  label="Mg"
                  value={narrow ? null : `${fmt(Mg, 1, dec)} ${T.N}`}
                  fs={fs}
                  box={box}
                  labelAt={{ x: C.x + (narrow ? 6 : 10), y: C.y + Mg * kF * 0.86, anchor: 'start' }}
                />
              </g>
            )}
            {balanced && !fallen && (
              <ForceArrow
                x={cx}
                y={cy - 1}
                dx={0}
                dy={-Mg * kF}
                color={CC.normal}
                width={narrow ? 3 : 3.6}
                head={narrow ? 10 : 12}
                label="N"
                value={`${fmt(Mg, 1, dec)} ${T.N}`}
                fs={fs}
                box={box}
                labelAt={{ x: cx - 10, y: cy - Mg * kF + fs, anchor: 'end' }}
              />
            )}
            <CgMark x={C.x} y={C.y} r={narrow ? 5.5 : 7} pulse={sim.done === 'balanced'} />
          </g>
        );
      }}
    </LabScene>
  );
}

/** World box → screen for the rod scene (shared by the drawing and the scale chip). */
function rodView(W, H, narrow) {
  return makeView({ x0: -0.06, x1: ROD + 0.06, y0: -0.02, y1: HS + 0.3 }, W, H, narrow ? { l: 12, r: 12, t: 62, b: 30 } : { l: 22, r: 22, t: 92, b: 40 });
}

/** px per newton: the resultant fills most of the room under the rod. */
function forceK(k, Mg) {
  return (0.78 * HS * k) / Math.max(Mg, 40);
}

/** A hand on the table with the index finger up; the fingertip is the support. */
function Finger({ cx, tipY, tableY, k }) {
  const fw = 0.028 * k;
  const fistW = 0.1 * k;
  const fistH = 0.075 * k;
  const fistTop = tableY - fistH;
  const skin = '#f2c4a0';
  const edge = '#c98d68';
  return (
    <g aria-hidden="true">
      <rect x={cx - fistW * 0.42} y={fistTop} width={fistW} height={fistH + 2} rx={fistH * 0.32} fill={skin} stroke={edge} strokeWidth="1.3" />
      <path
        d={`M${cx - fistW * 0.42 + 2},${fistTop + fistH * 0.45} q${-fistW * 0.16},${-fistH * 0.05} ${-fistW * 0.12},${-fistH * 0.38} q${fistW * 0.1},${-fistH * 0.2} ${fistW * 0.22},${fistH * 0.02}`}
        fill={skin}
        stroke={edge}
        strokeWidth="1.2"
      />
      {[0.25, 0.5, 0.75].map((f) => (
        <path key={f} d={`M${cx - fistW * 0.42 + fistW * f + fistW * 0.06},${fistTop + 3} q2,${fistH * 0.22} 0,${fistH * 0.42}`} fill="none" stroke={edge} strokeWidth="1" opacity="0.7" />
      ))}
      <rect x={cx - fw / 2} y={tipY} width={fw} height={fistTop - tipY + fistH * 0.3} rx={fw / 2} fill={skin} stroke={edge} strokeWidth="1.3" />
      <rect x={cx - fw * 0.28} y={tipY + fw * 0.18} width={fw * 0.56} height={fw * 0.7} rx={fw * 0.2} fill="#fbe3d3" stroke={edge} strokeWidth="0.8" />
      <path d={`M${cx - fw / 2 + 2},${tipY + (fistTop - tipY) * 0.55} h${fw - 4}`} stroke={edge} strokeWidth="0.9" opacity="0.6" />
    </g>
  );
}

/* =============================================================== formulas */

function RodFormula({ T, loads, a, xs }) {
  const L = T.rod;
  const f = L.formula;
  const dec = T.decimal;
  const F2 = (n) => fmt(n, 2, dec);
  const F1 = (n) => fmt(n, 1, dec);
  const M1 = (n) => fmt(n, Number.isInteger(n) ? 0 : 1, dec);
  const idx = loads.map((_, i) => i + 1);
  const symTop = idx.map((i) => `m_{${i}}x_{${i}}`).join(' + ');
  const symBot = idx.map((i) => `m_{${i}}`).join(' + ');
  const numTop = loads.map((l) => `${M1(l.m)}·${F2(l.x)}`).join(' + ');
  const numBot = loads.map((l) => M1(l.m)).join(' + ');
  const leftT = loads.filter((l) => l.x < a.xc - 1e-9);
  const rightT = loads.filter((l) => l.x > a.xc + 1e-9);
  const mom = (ls) => ls.reduce((acc, l) => acc + l.m * G * Math.abs(l.x - a.xc), 0);
  const terms = (ls) => ls.map((l) => `${F1(l.m * G)}·${F2(Math.abs(l.x - a.xc))}`).join(' + ') || '0';

  return (
    <FormulaPanel badge={f.badge} title={f.title}>
      <Step n={1} title={f.s1}>
        {loads.map((l, i) => (
          <Eq key={i} nums={`m_{${i + 1}}g = ${M1(l.m)}·${fmt(G, 1, dec)} =`} result={`${F1(l.m * G)} ${T.N}`} resultColor={CC.weightText} />
        ))}
      </Step>
      <Step n={2} title={f.s2}>
        <Eq sym={`x_{C} = (${symTop}) / (${symBot})`} />
        <Eq nums={`= (${numTop}) / (${numBot}) = ${fmt(a.sum, 2, dec)} / ${M1(a.M)} =`} result={`${F2(a.xc)} ${T.m}`} />
      </Step>
      <Step n={3} title={f.s3}>
        <Eq sym={`Mg = ${idx.map((i) => `m_{${i}}g`).join(' + ')}`} nums={`= ${loads.map((l) => F1(l.m * G)).join(' + ')} =`} result={`${F1(a.M * G)} ${T.N}`} resultColor={CC.resultText} />
        <p className="mt-1 text-xs text-gray-500">{f.s3note}</p>
      </Step>
      <Step n={4} title={f.s4}>
        <p className="tabular-nums text-gray-400">
          {f.left}: <Sym>{terms(leftT)}</Sym> = <b className="text-gray-100">{F2(mom(leftT))}</b> {T.Nm}
        </p>
        <p className="tabular-nums text-gray-400">
          {f.right}: <Sym>{terms(rightT)}</Sym> = <b className="text-gray-100">{F2(mom(rightT))}</b> {T.Nm}
        </p>
        <p className="mt-1 text-xs text-gray-500">{f.equal}</p>
      </Step>
      <Step n={5} title={f.s5} done={a.balanced}>
        <p className={a.balanced ? 'text-emerald-300' : 'text-gray-400'}>
          <Sym>{a.balanced ? f.yes(F2(xs)) : f.no(F2(xs), F2(a.xc))}</Sym>
        </p>
      </Step>
    </FormulaPanel>
  );
}
