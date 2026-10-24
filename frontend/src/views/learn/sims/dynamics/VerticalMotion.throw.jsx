import { useState } from 'react';
import { Hand, Lightbulb, Rocket, Target } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import {
  Ball,
  BallDefs,
  COL,
  Chip,
  FormulaTile,
  G,
  GroupLabel,
  LabScene,
  LaunchPad,
  PlayControls,
  Rich,
  SLOW,
  ToggleChip,
  VArrow,
  VerticalPaper,
  ceilTo,
  curvePoints,
  makeVView,
  num,
} from './VerticalMotion.parts';

/**
 * Tab 2 — a body thrown straight up with v₀ (axis up, no air resistance):
 * v = v₀ − g·t, h = v₀·t − g·t²/2; it stops rising at t = v₀/g, at the
 * height H = v₀²/(2g); the fall back mirrors the rise (same speed at the
 * same height, total time 2v₀/g); a = −g all the time, also at the top.
 * Preset v₀ = 20 m/s → t = 2.04 s, H = 20.4 m, T = 4.08 s.
 */

const PRESETS = [
  { id: 'v10', v0: 10, icon: Hand },
  { id: 'v20', v0: 20, icon: Target },
  { id: 'v30', v0: 30, icon: Rocket },
];
const IDLE = { t: 0, running: false, done: false, topPaused: false };

export default function ThrowSim({ T }) {
  const L = T.up;
  const dec = T.decimal;
  const [v0, setV0] = useState(20);
  const [stopTop, setStopTop] = useState(true);
  const [sim, setSim] = useState(IDLE);
  const tUp = v0 / G;
  const Hm = (v0 * v0) / (2 * G);
  const Tt = 2 * tUp;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(Tt, p.t + dt * SLOW);
      if (stopTop && !p.topPaused && p.t < tUp && t >= tUp) return { ...p, t: tUp, running: false, topPaused: true };
      const done = t >= Tt - 1e-9;
      return { ...p, t, running: !done, done, topPaused: p.topPaused || t >= tUp };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickV0 = (value) => {
    setV0(value);
    setSim(IDLE);
  };
  const scrub = (x) => {
    const t = Math.min(Tt, Math.max(0, x));
    setSim({ t, running: false, done: t >= Tt - 1e-9, topPaused: t >= tUp });
  };

  const t = Math.min(sim.t, Tt);
  const v = v0 - G * t;
  const h = Math.max(0, v0 * t - 0.5 * G * t * t);
  const F = (n, d = 1) => num(n, d, dec);
  const atTop = Math.abs(t - tUp) < 1e-6 || (sim.running && Math.abs(t - tUp) < 0.06);

  /* ---- explanation */
  let key = 'idle';
  if (sim.done) key = 'landed';
  else if (atTop) key = 'top';
  else if (t > 0) key = t < tUp ? 'rise' : 'fall';
  const settled = useSettled(key, key === 'rise' || key === 'fall' ? 350 : 0);
  const ex = L.explain;
  let text = ex.idle;
  if (settled === 'top') text = ex.top(F(tUp, 2), F(Hm));
  else if (settled === 'rise') text = ex.rise;
  else if (settled === 'fall') text = ex.fall;
  else if (settled === 'landed') text = ex.landed(F(Tt, 2), F(tUp, 2), F(v0, 0));
  const tone = { idle: '#22d3ee', rise: '#34d399', top: '#fb923c', fall: '#a78bfa', landed: '#34d399' }[settled] ?? '#22d3ee';
  const preset = PRESETS.find((p) => p.v0 === v0)?.id ?? null;

  const vSub = Math.abs(v) < 0.05 && t > 0 ? L.vSub.zero : v > 0 ? L.vSub.up : L.vSub.down;
  const vDigits = Number.isInteger(v0 / 2) ? 0 : 1;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={preset}
            onChange={(id) => pickV0(PRESETS.find((p) => p.id === id).v0)}
            options={PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id].name, sub: L.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <ThrowScene T={T} v0={v0} t={t} running={sim.running} done={sim.done} atTop={atTop} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={T.chipSlow} />
        <Readout label={L.readouts.v} symbol="v" value={F(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={vSub} active={atTop} />
        <Readout label={L.readouts.h} symbol="h" value={F(h)} unit={T.m} accent={COL.curve} textColor={PALETTE.dispText} sub={L.hSub(F(Hm))} />
        <Readout label={L.readouts.a} symbol="a" value={F(-G)} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={L.aSub} active={atTop} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="vm-up-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={5}
            max={30}
            step={1}
            value={v0}
            onChange={pickV0}
            accent={PALETTE.vel}
            display={`${fmt(v0, 0, dec)} ${T.ms}`}
            valueText={`${fmt(v0, 0, dec)} ${T.ms}`}
            hint={L.v0Hint(fmt(v0 * 3.6, 0, dec))}
          />
          <ToggleChip label={L.stopTop.label} sub={L.stopTop.sub} on={stopTop} onChange={setStopTop} />
          <FormulaTile tag={L.f.tUp} color="#a5f3fc" general="t = v₀ / g" filled={`t = ${fmt(v0, 0, dec)} / ${F(G)} = ${F(tUp, 2)} ${T.s}`} ok={t >= tUp - 1e-6} />
          <FormulaTile tag={L.f.H} color={PALETTE.dispText} general="H = v₀² / (2g)" filled={`H = ${fmt(v0, 0, dec)}² / (2 · ${F(G)}) = ${F(Hm)} ${T.m}`} ok={t >= tUp - 1e-6} />
          <FormulaTile tag={L.f.T} color="#c4b5fd" general="T = 2v₀ / g" filled={`T = 2 · ${fmt(v0, 0, dec)} / ${F(G)} = ${F(Tt, 2)} ${T.s}`} ok={sim.done} />
        </div>
        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: 'rgba(110,231,183,0.4)', dash: '5 6', dot: false, points: [{ x: 0, y: v0 }, { x: Tt, y: -v0 }] },
              { id: 'v', label: 'v(t)', color: PALETTE.velText, points: [{ x: 0, y: v0 }, { x: t, y: v }] },
            ]}
            xMax={Tt}
            yMax={v0}
            yMin={-v0}
            xDigits={2}
            yDigits={vDigits}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={t}
            decimal={dec}
            height={190}
            ariaLabel={L.graph.label}
            onScrub={scrub}
            note={L.graph.note}
          />
          <SymmetryTable T={T} v0={v0} t={t} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function ThrowScene({ T, v0, t, running, done, atTop }) {
  const L = T.up;
  const S = T.scene;
  const dec = T.decimal;
  const tUp = v0 / G;
  const Hm = (v0 * v0) / (2 * G);
  const Tt = 2 * tUp;
  const fn = (tt) => v0 * tt - 0.5 * G * tt * tt;
  const h = Math.max(0, fn(t));
  const v = v0 - G * t;
  const tMax = ceilTo(Tt + 0.08, 0.5);
  const step = Tt <= 2.2 ? 0.25 : 0.5;
  const stepTxt = fmt(step, step < 0.5 ? 2 : 1, dec);

  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: S.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: S.legend.g, kind: 'arrow' },
        { color: COL.weight, label: S.legend.mg, kind: 'arrow' },
        { color: PALETTE.ink, label: L.legendMarks(stepTxt), kind: 'ring' },
        { color: COL.curve, label: S.legend.curve, kind: 'line' },
      ]}
      chips={
        <Chip>
          <span className="hidden sm:inline">{T.chipSlow}</span>
          <span className="sm:hidden">{T.chipSlowShort}</span> · t = {fmt(t, 2, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 440 : 500)}
      ariaLabel={L.sceneLabel(fmt(v0, 0, dec), fmt(t, 2, dec), num(v, 1, dec), num(h, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const r = narrow ? 8 : 10;
        const ruler = narrow ? 30 : 50;
        const bx = ruler + (narrow ? 74 : 112);
        const off = narrow ? 34 : 44;
        const ghostX = bx - off;
        const view = makeVView({ W, H, narrow, hTop: Hm * 1.16 + 0.4, tMax, ruler, plot0: bx + (narrow ? 98 : 176) });
        const { gy, gx, groundY, padT } = view;
        const by = gy(h);
        const bcy = by - r;
        const vk = Math.min((groundY - padT) * 0.3, 110) / v0;
        const gLen = narrow ? 26 : 32;
        const mr = narrow ? 4 : 5;
        const box = { w: W, h: H };
        const flying = t > 0 && !done;

        /* stroboscope: rising marks left of the line, falling marks right */
        const marks = [];
        const lastY = { up: 1e9, down: -1e9 };
        for (let i = 0; i * step <= t + 1e-9; i += 1) {
          const tm = i * step;
          const up = tm <= tUp + 1e-9;
          const my = gy(Math.max(0, fn(tm))) - r;
          let show;
          if (up) {
            show = lastY.up - my >= fs + 2;
            if (show) lastY.up = my;
          } else {
            show = my - lastY.down >= fs + 2;
            if (show) lastY.down = my;
          }
          marks.push({ i, tm, up, my, show, gyH: gy(Math.max(0, fn(tm))) });
        }
        const tagT = (tm) => S.secTag(fmt(tm, Number.isInteger(tm) ? 0 : Number.isInteger(tm * 2) ? 1 : 2, dec));

        const curvePlan = curvePoints(fn, 0, Tt, view);
        const curveNow = curvePoints(fn, 0, t, view);
        const mirror = 2 * tUp - t;
        const showGhost = flying && t > tUp + 0.04;
        const vTxt = <>v</>;
        const v0Txt = (
          <>
            v<tspan dy="4" fontSize={fs - 2}>0</tspan>
          </>
        );
        const landTag = L.landTag(num(v0, 1, dec));
        const landW = textWidth(landTag, fs, 600) + 16;

        return (
          <>
            <BallDefs />
            <VerticalPaper view={view} W={W} H={H} fs={fs} decimal={dec} labels={S} />
            {/* the top: H = v₀²/(2g) */}
            <line x1={ruler} x2={view.plotX1} y1={gy(Hm)} y2={gy(Hm)} stroke="#ea580c" strokeOpacity={t >= tUp - 1e-6 ? 0.7 : 0.35} strokeWidth={1.2} strokeDasharray="6 5" />
            <line x1={gx(tUp)} x2={gx(tUp)} y1={gy(Hm)} y2={groundY} stroke="#ea580c" strokeOpacity="0.35" strokeWidth={1} strokeDasharray="3 4" />
            <line x1={bx} x2={bx} y1={gy(Hm) - 6} y2={groundY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 5" />
            <LaunchPad x={bx} y={groundY} r={r} />

            {/* h(t) graph */}
            <polyline points={curvePlan} fill="none" stroke={COL.curve} strokeOpacity="0.3" strokeWidth={2} strokeDasharray="5 6" />
            {curveNow && <polyline points={curveNow} fill="none" stroke={COL.curve} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
            {marks.map((m) => (
              <circle key={`d${m.i}`} cx={gx(m.tm)} cy={m.gyH} r={3.5} fill="#fff" stroke={COL.curve} strokeWidth={2} />
            ))}
            <Pill x={gx(tUp)} y={gy(Hm) - 16} text={L.topPlot(num(Hm, 1, dec), num(tUp, 2, dec))} bg="#ea580c" size={fs} box={box} />
            <line x1={bx + r + 2} x2={gx(t)} y1={by} y2={by} stroke="#64748b" strokeOpacity="0.7" strokeWidth={1} strokeDasharray="3 4" />
            <circle cx={gx(t)} cy={by} r={5} fill={COL.curve} stroke="#fff" strokeWidth={2} />
            {done && <Pill x={gx(Tt)} y={groundY - 18} text={L.totalTag(num(Tt, 2, dec))} bg={COL.curve} size={fs} box={box} />}

            {/* stroboscope rings */}
            {marks.map((m) => {
              const x = m.up ? bx - off : bx + off;
              return (
                <g key={`m${m.i}`}>
                  <circle cx={x} cy={m.my} r={mr} fill="#fff" stroke={PALETTE.ink} strokeOpacity="0.6" strokeWidth={1.6} />
                  {m.show && (
                    <text
                      x={m.up ? x - mr - 5 : x + mr + 5}
                      y={m.my + 4}
                      textAnchor={m.up ? 'end' : 'start'}
                      fontSize={fs - 1}
                      fontWeight="700"
                      fill="#334155"
                      stroke="#fbfcfe"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {tagT(m.tm)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* the mirror moment: same height on the way up, same speed upwards */}
            {showGhost && (
              <g>
                <Ball cx={ghostX} y={by} r={r} tone="red" ghost />
                <VArrow x={ghostX} y1={bcy - r} y2={bcy - r - Math.abs(v) * vk} color={PALETTE.vel} fs={fs} opacity={0.5} />
                <circle cx={gx(mirror)} cy={by} r={6} fill="#fff" stroke={PALETTE.vel} strokeWidth={2.2} />
                <Pill x={gx(mirror)} y={by + 18} text={L.ghostTag(num(mirror, 2, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />
              </g>
            )}

            {/* the ball and its vectors */}
            <Ball cx={bx} y={by} r={r} tone="red" pulse={running} />
            {flying && (
              <>
                <VArrow x={bx} y1={bcy + r * 0.2} y2={bcy + r + (narrow ? 24 : 30)} color={COL.weight} label="mg" side={-1} fs={fs} width={2.6} head={9} />
                <VArrow x={bx - r - 9} y1={bcy - gLen / 2} y2={bcy + gLen / 2} color={PALETTE.acc} label="g" side={-1} fs={fs} width={2.6} head={9} />
                <VArrow x={bx + r + 9} y1={bcy} y2={bcy - v * vk} color={PALETTE.vel} label={vTxt} fs={fs} />
              </>
            )}
            {t === 0 && <VArrow x={bx + r + 9} y1={bcy} y2={bcy - v0 * vk} color={PALETTE.vel} label={v0Txt} fs={fs} />}
            {atTop && <Pill x={bx} y={bcy - r - 16} text={L.topTag} bg="#ea580c" size={fs} box={box} />}
            {done && <Pill x={bx + r + 8 + landW / 2} y={bcy} text={landTag} bg={PALETTE.vel} size={fs} box={box} />}
          </>
        );
      }}
    </LabScene>
  );
}

/* ------------------------------------------------------------ symmetry */

/** Pairs of moments t and T − t: the same height, the same speed, opposite directions. */
function SymmetryTable({ T, v0, t }) {
  const L = T.up;
  const dec = T.decimal;
  const tUp = v0 / G;
  const Tt = 2 * tUp;
  const times = (step) => {
    const out = [];
    for (let k = 1; k * step < tUp - 1e-6; k += 1) out.push(k * step);
    return out;
  };
  let rows = times(0.5);
  if (rows.length > 4) rows = times(1);
  if (rows.length < 2) rows = times(0.25);
  const tt = (x) => num(x, Number.isInteger(x) ? 0 : Number.isInteger(x * 2) ? 1 : 2, dec);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.sym.title}</p>
      <table className="mt-2 w-full text-sm tabular-nums">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.08em] text-gray-500">
            <th scope="col" className="py-1 text-left font-semibold">
              {L.sym.up}
            </th>
            <th scope="col" className="py-1 text-center font-semibold">
              {L.sym.h}
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              {L.sym.down}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t1) => {
            const t2 = Tt - t1;
            const h1 = v0 * t1 - 0.5 * G * t1 * t1;
            const sp = v0 - G * t1;
            const upOn = t >= t1 - 1e-6;
            const downOn = t >= t2 - 1e-6;
            return (
              <tr key={t1} className="border-t border-white/[0.06]">
                <td className={`py-1.5 text-left ${upOn ? 'text-emerald-300' : 'text-gray-600'}`}>
                  {tt(t1)} {T.s} · {upOn ? `+${num(sp, 1, dec)}` : '?'} {T.ms}
                </td>
                <td className={`py-1.5 text-center font-semibold ${upOn ? 'text-white' : 'text-gray-600'}`}>
                  {num(h1, 1, dec)} {T.m}
                </td>
                <td className={`py-1.5 text-right ${downOn ? 'text-violet-300' : 'text-gray-600'}`}>
                  {num(t2, 2, dec)} {T.s} · {downOn ? num(-sp, 1, dec) : '?'} {T.ms}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-500">{L.sym.note}</p>
    </div>
  );
}
