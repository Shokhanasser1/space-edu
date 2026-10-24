import { useState } from 'react';
import { Building, Building2, Home, Lightbulb } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import {
  Ball,
  BallDefs,
  Building as Tower,
  COL,
  Chip,
  FormulaTile,
  G,
  GroupLabel,
  LabScene,
  PlayControls,
  SLOW,
  VArrow,
  VerticalPaper,
  ceilTo,
  curvePoints,
  makeVView,
  num,
} from './VerticalMotion.parts';

/**
 * Tab 1 — free fall from a height h, starting from rest, no air resistance:
 * v = g·t, s = g·t²/2, landing after t = √(2h/g) with v = √(2gh).
 * A ball drops from a roof; a stroboscope ring every 0.5 s or 1 s; its
 * height is graphed against time on the same height scale; the panel shows
 * the distance covered in each successive second (1 : 3 : 5 : 7 …).
 * Presets 20 m → 2.02 s, 19.8 m/s; 45 m → 3.03 s, 29.7 m/s; 80 m → 4.04 s, 39.6 m/s.
 */

const PRESETS = [
  { id: 'h20', h: 20, icon: Home },
  { id: 'h45', h: 45, icon: Building },
  { id: 'h80', h: 80, icon: Building2 },
];
const IDLE = { t: 0, running: false, done: false };

export default function FallSim({ T }) {
  const L = T.fall;
  const dec = T.decimal;
  const [h, setH] = useState(20);
  const [step, setStep] = useState(0.5);
  const [sim, setSim] = useState(IDLE);
  const tLand = Math.sqrt((2 * h) / G);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tLand, p.t + dt * SLOW);
      const done = t >= tLand - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickH = (value) => {
    setH(value);
    setSim(IDLE);
  };
  const scrub = (x) => {
    const tt = Math.min(tLand, Math.max(0, x));
    setSim({ t: tt, running: false, done: tt >= tLand - 1e-9 });
  };

  const t = sim.t;
  const v = G * t;
  const s = Math.min(h, 0.5 * G * t * t);
  const y = h - s;
  const F = (n, d = 1) => num(n, d, dec);

  /* ---- explanation */
  const n = Math.floor(t + 1e-9);
  let key = 'idle';
  if (sim.done) key = 'landed';
  else if (t > 0) key = n < 1 ? 'first' : `f${n}`;
  const settled = useSettled(key, 0);
  const ex = L.explain;
  let text = ex.idle;
  if (settled === 'landed') text = ex.landed(F(tLand, 2), F(G * tLand), fmt(G * tLand * 3.6, 0, dec));
  else if (settled === 'first') text = ex.first;
  else if (settled.startsWith('f')) {
    const k = Number(settled.slice(1));
    text = ex.falling(k, F(G * k), F(0.5 * G * k * k));
  }
  const tone = settled === 'landed' ? '#34d399' : settled === 'idle' ? '#22d3ee' : '#fb923c';
  const preset = PRESETS.find((p) => p.h === h)?.id ?? null;

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
            onChange={(id) => pickH(PRESETS.find((p) => p.id === id).h)}
            options={PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id].name, sub: L.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <FallScene T={T} h={h} t={t} tLand={tLand} step={step} running={sim.running} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={T.chipSlow} />
        <Readout label={L.readouts.v} symbol="v" value={F(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(fmt(v * 3.6, 0, dec))} />
        <Readout label={L.readouts.s} symbol="s" value={F(s)} unit={T.m} accent={COL.curve} textColor={PALETTE.dispText} sub={L.sSub(F(y))} />
        <Readout label={L.readouts.g} symbol="g" value={F(G)} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={L.gSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="vm-fall-h"
            label={L.height}
            symbol="h"
            min={5}
            max={100}
            step={1}
            value={h}
            onChange={pickH}
            accent={COL.curve}
            display={`${fmt(h, 0, dec)} ${T.m}`}
            hint={L.heightHint(fmt(h / 3.2, 0, dec))}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.marksLabel}</p>
            <Segmented
              label={L.marksLabel}
              className="grid-cols-2"
              value={step}
              onChange={setStep}
              options={[0.5, 1].map((d) => ({ value: d, label: L.every(fmt(d, d < 1 ? 1 : 0, dec)) }))}
            />
          </div>
          <FormulaTile tag={L.f.v} color={PALETTE.velText} general="v = g·t" filled={`v = ${F(G)} · ${fmt(t, 2, dec)} = ${F(v)} ${T.ms}`} />
          <FormulaTile tag={L.f.s} color={PALETTE.dispText} general="s = g·t²/2" filled={`s = ${F(G)} · ${fmt(t, 2, dec)}² / 2 = ${F(s)} ${T.m}`} />
          <FormulaTile
            tag={L.f.t}
            color="#a5f3fc"
            general="t = √(2h/g),  v = √(2gh)"
            filled={`t = √(2 · ${fmt(h, 0, dec)} / ${F(G)}) = ${F(tLand, 2)} ${T.s} · v = ${F(G * tLand)} ${T.ms}`}
            ok={sim.done}
          />
        </div>
        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <SecondLadder T={T} t={t} tLand={tLand} />
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: 'rgba(110,231,183,0.4)', dash: '5 6', dot: false, points: [{ x: 0, y: 0 }, { x: tLand, y: G * tLand }] },
              { id: 'v', label: 'v(t)', color: PALETTE.velText, points: [{ x: 0, y: 0 }, { x: t, y: v }] },
            ]}
            xMax={tLand}
            yMax={ceilTo(G * tLand, 20)}
            xDigits={2}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={t}
            decimal={dec}
            height={170}
            ariaLabel={L.graph.label}
            onScrub={scrub}
            note={L.graph.note}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function FallScene({ T, h, t, tLand, step, running, done }) {
  const L = T.fall;
  const S = T.scene;
  const dec = T.decimal;
  const tMax = ceilTo(tLand + 0.08, 0.5);
  const fn = (tt) => h - 0.5 * G * tt * tt;
  const yNow = Math.max(0, fn(Math.min(t, tLand)));
  const v = G * t;

  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: S.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: S.legend.g, kind: 'arrow' },
        { color: COL.weight, label: S.legend.mg, kind: 'arrow' },
        { color: PALETTE.ink, label: L.legendMarks(fmt(step, step < 1 ? 1 : 0, dec)), kind: 'ring' },
        { color: COL.curve, label: S.legend.curve, kind: 'line' },
      ]}
      chips={
        <Chip>
          <span className="hidden sm:inline">{T.chipSlow}</span>
          <span className="sm:hidden">{T.chipSlowShort}</span> · t = {fmt(t, 2, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 440 : 500)}
      ariaLabel={L.sceneLabel(fmt(h, 0, dec), fmt(t, 2, dec), num(v, 1, dec), num(yNow, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const r = narrow ? 8 : 10;
        const ruler = narrow ? 30 : 50;
        const towerX0 = ruler + (narrow ? 10 : 18);
        const towerW = narrow ? 38 : 76;
        const towerX1 = towerX0 + towerW;
        const fx = towerX1 + (narrow ? 28 : 44);
        const view = makeVView({ W, H, narrow, hTop: h, tMax, ruler, plot0: fx + (narrow ? 64 : 124) });
        const { gy, gx, groundY, padT } = view;
        const by = gy(yNow);
        const bcy = by - r;
        const vk = Math.min((groundY - padT) * 0.32, 120) / (G * tLand);
        const gLen = narrow ? 26 : 32;
        const box = { w: W, h: H };

        /* stroboscope marks: a ring at every `step` seconds already passed */
        const marks = [];
        let lastY = -1e9;
        for (let i = 0; i * step <= Math.min(t, tLand) + 1e-9; i += 1) {
          const tm = i * step;
          const my = gy(fn(tm));
          const show = my - lastY >= fs + 3;
          if (show) lastY = my;
          marks.push({ i, tm, my, show });
        }
        const tagT = (tm) => S.secTag(fmt(tm, Number.isInteger(tm) ? 0 : 1, dec));

        const curveNow = curvePoints(fn, 0, Math.min(t, tLand), view);
        const curvePlan = curvePoints(fn, 0, tLand, view);
        const landTag = L.landTag(num(G * tLand, 1, dec));
        const landW = textWidth(landTag, fs, 600) + 16;
        const hTag = L.hTag(fmt(h, 0, dec));

        return (
          <>
            <BallDefs />
            <VerticalPaper view={view} W={W} H={H} fs={fs} decimal={dec} labels={S} />
            <Tower x0={towerX0} w={towerW} topY={gy(h)} groundY={groundY} floors={Math.max(2, Math.round(h / 3.2))} />
            {/* roof ledge the ball is released from */}
            <rect x={towerX1 - 2} y={gy(h)} width={fx - towerX1 + r + 4} height={5} rx={2} fill="#64748b" />
            {!narrow && <Pill x={towerX0 + towerW / 2} y={(gy(h) + groundY) / 2} text={hTag} bg={PALETTE.ink} size={fs} box={box} />}
            {/* fall line */}
            <line x1={fx} x2={fx} y1={gy(h)} y2={groundY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 5" />

            {/* h(t) graph on the same height scale */}
            <polyline points={curvePlan} fill="none" stroke={COL.curve} strokeOpacity="0.3" strokeWidth={2} strokeDasharray="5 6" />
            {curveNow && <polyline points={curveNow} fill="none" stroke={COL.curve} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
            {marks.map((m) => (
              <circle key={`d${m.i}`} cx={gx(m.tm)} cy={m.my} r={3.5} fill="#fff" stroke={COL.curve} strokeWidth={2} />
            ))}
            <line x1={fx + r + 2} x2={gx(Math.min(t, tLand))} y1={by} y2={by} stroke="#64748b" strokeOpacity="0.7" strokeWidth={1} strokeDasharray="3 4" />
            <circle cx={gx(Math.min(t, tLand))} cy={by} r={5} fill={COL.curve} stroke="#fff" strokeWidth={2} />
            {done && <Pill x={gx(tLand)} y={groundY - 18} text={S.tTag(num(tLand, 2, dec))} bg={COL.curve} size={fs} box={box} />}

            {/* stroboscope rings with their times */}
            {marks.map((m) => (
              <g key={`m${m.i}`}>
                <circle cx={fx} cy={m.my - r} r={r} fill="#fff" fillOpacity="0.7" stroke={PALETTE.ink} strokeOpacity="0.55" strokeWidth={1.5} />
                {m.show && !(done && groundY - m.my < 22) && (
                  <text x={fx + r + 6} y={m.my - r + 4} fontSize={fs - 1} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                    {tagT(m.tm)}
                  </text>
                )}
              </g>
            ))}

            {/* the ball and its vectors */}
            <Ball cx={fx} y={by} r={r} tone="red" pulse={running} />
            {t > 0 && !done && (
              <>
                <VArrow x={fx} y1={bcy + r * 0.2} y2={bcy + r + (narrow ? 24 : 30)} color={COL.weight} label="mg" side={-1} fs={fs} width={2.6} head={9} />
                <VArrow x={fx - r - 9} y1={bcy - gLen / 2} y2={bcy + gLen / 2} color={PALETTE.acc} label="g" side={-1} fs={fs} width={2.6} head={9} />
                <VArrow x={fx + r + 9} y1={bcy} y2={bcy + v * vk} color={PALETTE.vel} label="v" fs={fs} />
              </>
            )}
            {done && <Pill x={fx + r + 8 + landW / 2} y={bcy} text={landTag} bg={PALETTE.vel} size={fs} box={box} />}
          </>
        );
      }}
    </LabScene>
  );
}

/* --------------------------------------------------------------- ladder */

/** The distance covered in each successive second: 4.9 m · (1, 3, 5, 7 …). */
function SecondLadder({ T, t, tLand }) {
  const L = T.fall;
  const dec = T.decimal;
  const N = Math.ceil(tLand - 1e-9);
  const rows = [];
  for (let n = 1; n <= N; n += 1) {
    const a = n - 1;
    const b = Math.min(n, tLand);
    const full = n <= tLand + 1e-9;
    const dist = 0.5 * G * (b * b - a * a);
    const c = Math.min(Math.max(t, a), b);
    const live = 0.5 * G * (c * c - a * a);
    rows.push({ n, a, b, full, dist, live, started: t > a + 1e-9, complete: t >= b - 1e-9 });
  }
  const maxDist = Math.max(...rows.map((r) => r.dist), 1e-6);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.ladder.title}</p>
      <ol className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.n} className="flex items-center gap-2 sm:gap-3">
            <span className="w-[72px] sm:w-[104px] shrink-0 text-xs sm:text-sm leading-tight tabular-nums text-gray-300">
              {r.full ? L.ladder.row(r.n) : L.ladder.partial(fmt(r.a, 0, dec), fmt(r.b, 2, dec))}
            </span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.live / maxDist) * 100}%`, background: r.complete ? '#60a5fa' : '#3b82f6' }} />
              {r.full && (
                <span className="absolute inset-y-0 rounded-full border border-dashed border-white/20" style={{ left: 0, width: `${(r.dist / maxDist) * 100}%` }} />
              )}
            </span>
            <span className={`w-[64px] sm:w-[76px] shrink-0 text-right text-sm font-semibold tabular-nums ${r.complete ? 'text-white' : r.started ? 'text-gray-300' : 'text-gray-600'}`}>
              {r.started ? `${num(r.live, 1, dec)} ${T.m}` : '?'}
            </span>
            <span
              className={`w-9 shrink-0 rounded-md px-1 py-0.5 text-center text-[11px] font-bold tabular-nums ${
                r.full && r.complete ? 'bg-orange-400/15 text-orange-300' : 'text-transparent'
              }`}
              aria-hidden={!(r.full && r.complete)}
            >
              ×{2 * r.n - 1}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">{L.ladder.note(num(G / 2, 1, dec), num(G, 1, dec))}</p>
    </div>
  );
}
