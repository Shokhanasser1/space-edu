import { useMemo, useState } from 'react';
import { ArrowUpToLine, Gauge, Lightbulb, MoveUpRight, Pause, Play, RotateCcw, Target, TrendingUp } from 'lucide-react';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import {
  Ball,
  C,
  DarkGraph,
  Field,
  FormulaRow,
  G,
  LabScene,
  Label,
  Launcher,
  TimeChip,
  Vec,
  VelScale,
  dragFlight,
  fieldView,
  fitHeight,
  flight,
  niceCeil,
  niceTop,
  parabolaPts,
  posAt,
  strobeStep,
  velAt,
} from './AngledThrow.parts';

/**
 * Tab 1 - one throw in detail. A launcher fires a ball at v₀ and α; the
 * trajectory is drawn with strobe dots at equal time steps, the velocity v
 * with its components vₓ (never changes) and vᵧ (falls by g each second),
 * and g pointing down. T, H and L appear when they are reached; the formula
 * list repeats every number with the reader's own v₀ and α. Optional: the
 * same throw in air (a football), which flies noticeably shorter.
 *
 * Preset "example": v₀ = 20 m/s, α = 45° → T = 2.89 s, H = 10.2 m, L = 40.8 m.
 */

const PRESETS = [
  { id: 'example', v0: 20, a: 45, icon: Target },
  { id: 'slow', v0: 10, a: 45, icon: Gauge },
  { id: 'a30', v0: 20, a: 30, icon: MoveUpRight },
  { id: 'a60', v0: 20, a: 60, icon: TrendingUp },
];
const RATES = [1, 0.5, 0.25];
const PAD_N = { l: 34, r: 12, t: 44, b: 34 };
const PAD_W = { l: 46, r: 24, t: 84, b: 38 };
/** The field shown for a throw: fits this throw, rounded so it does not jitter while a slider moves. */
const boxFor = (f) => ({ xMax: niceCeil(1.1 * Math.max(f.L, 0.5)), yMax: niceCeil(1.22 * Math.max(f.H, 0.2)) });
const TONES = { idle: '#22d3ee', rising: '#a3e635', top: '#67e8f9', falling: '#fb923c', done: '#34d399' };

export default function LaunchSim({ t, c }) {
  const dec = c.decimal;
  const [preset, setPreset] = useState('example');
  const [v0, setV0] = useState(20);
  const [alpha, setAlpha] = useState(45);
  const [rate, setRate] = useState(0.5);
  const [dotMode, setDotMode] = useState('plain');
  const [air, setAir] = useState(false);
  const [sim, setSim] = useState({ t: 0, running: false });
  const f = useMemo(() => flight(v0, alpha), [v0, alpha]);
  const airF = useMemo(() => (air ? dragFlight(v0, alpha) : null), [air, v0, alpha]);
  const done = sim.t >= f.T - 1e-9;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt * rate;
      return tt >= f.T ? { t: f.T, running: false } : { t: tt, running: true };
    });
  });

  const toggle = () => {
    if (done) setSim({ t: 0, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim({ t: 0, running: false });
  const toTop = () => setSim({ t: f.tTop, running: false });
  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setV0(p.v0);
    setAlpha(p.a);
    reset();
  };
  const slide = (set) => (x) => {
    set(x);
    setPreset(null);
    reset();
  };

  /* ---- the moment shown */
  const pos = posAt(f, sim.t);
  const vel = velAt(f, sim.t);
  const speed = Math.hypot(vel.vx, vel.vy);
  const F1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);
  const Fv = (n) => fmt(n, Number.isInteger(n) ? 0 : 1, dec);
  const dtS = strobeStep(f.T);

  /* ---- explanation */
  let key = 'idle';
  if (sim.t > 0) {
    if (done) key = preset ? `done-${preset}` : 'done';
    else if (sim.t < f.tTop - 0.04 * f.T) key = 'rising';
    else if (sim.t < f.tTop + 0.3 * f.T) key = 'top';
    else key = 'falling';
  }
  const settled = useSettled(key, key.startsWith('done') || key === 'idle' ? 0 : 250);
  const ex = t.explain;
  const vxS = F1(f.vx);
  let text = ex.idle;
  if (settled === 'rising') text = ex.rising(vxS);
  else if (settled === 'top') text = ex.top(vxS, F1(f.H), F2(f.tTop));
  else if (settled === 'falling') text = ex.falling(vxS);
  else if (settled === 'done-example') text = ex.example;
  else if (settled === 'done-slow') text = ex.slow;
  else if (settled === 'done-a30') text = ex.pair(30, 60, F1(f.L));
  else if (settled === 'done-a60') text = ex.pair(60, 30, F1(f.L));
  else if (settled === 'done') text = ex.landed(F2(f.T), F1(f.L), F1(f.H), Fv(v0), Fv(alpha));
  if (settled.startsWith('done') && airF) text += ex.air(fmt(airF.L, 0, dec), fmt(100 - (100 * airF.L) / f.L, 0, dec));
  const tone = TONES[settled.startsWith('done') ? 'done' : settled];

  const legend = [
    { kind: 'line', color: C.path, label: t.legend.path },
    { kind: 'dash', color: C.preview, label: t.legend.preview },
    { kind: 'dot', color: C.ink, label: t.legend.dots(fmt(dtS, Number.isInteger(dtS * 10) ? 1 : 2, dec)) },
    { kind: 'arrow', color: C.vel, label: t.legend.v },
    { kind: 'arrow', color: C.vx, label: t.legend.vx },
    { kind: 'arrow', color: C.vy, label: t.legend.vy },
    { kind: 'arrow', color: C.g, label: t.legend.g },
    ...(air ? [{ kind: 'dash', color: C.air, label: t.legend.air }] : []),
  ];
  const chipText = rate === 1 ? c.common.realTime(F2(sim.t)) : c.common.slow(Math.round(1 / rate), F2(sim.t));

  /* ---- formulas with the reader's numbers */
  const g = fmt(G, 1, dec);
  const tS = F2(sim.t);
  const formulas = [
    ['v₀ₓ = v₀·cosα', `${Fv(v0)} · cos ${alpha}° = ${F1(f.vx)} ${c.ms}`, C.vxText],
    ['v₀ᵧ = v₀·sinα', `${Fv(v0)} · sin ${alpha}° = ${F1(f.vy)} ${c.ms}`, C.vyText],
    ['T = 2v₀·sinα / g', `2 · ${Fv(v0)} · sin ${alpha}° / ${g} = ${F2(f.T)} ${c.s}`, '#a5f3fc'],
    ['H = v₀²·sin²α / (2g)', `${Fv(v0)}² · sin²${alpha}° / (2 · ${g}) = ${F1(f.H)} ${c.m}`, C.pathText],
    ['L = v₀²·sin2α / g', `${Fv(v0)}² · sin ${2 * alpha}° / ${g} = ${F1(f.L)} ${c.m}`, C.dispText],
    ['x = v₀cosα · t', `${F2(f.vx)} · ${tS} = ${F1(pos.x)} ${c.m}`, '#e2e8f0'],
    ['y = v₀sinα · t − gt²/2', `${F2(f.vy)} · ${tS} − ${fmt(G / 2, 1, dec)} · ${tS}² = ${F1(Math.max(0, pos.y))} ${c.m}`, '#e2e8f0'],
  ];

  /* ---- graph of the components */
  const tMaxG = niceTop(f.T);
  const yTop = niceTop(v0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{c.common.presets}</p>
          <Segmented
            label={c.common.presets}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="col-span-2 xl:min-w-[150px] min-h-[52px] text-[15px]">
            {sim.running ? c.common.pause : done ? c.common.again : sim.t > 0 ? c.common.resume : c.common.fire}
          </Btn>
          <Btn icon={ArrowUpToLine} onClick={toTop} className="min-h-[52px] text-[15px]" aria-label={t.topAria}>
            {t.top}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={sim.t === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {c.common.reset}
          </Btn>
        </div>
      </div>

      <LabScene
        legend={legend}
        chip={<TimeChip text={chipText} />}
        height={(W, narrow) => {
          const b = boxFor(f);
          return narrow ? fitHeight(W, b.xMax, b.yMax, PAD_N, 230, W * 1.15) : fitHeight(W, b.xMax, b.yMax, PAD_W, 340, 520);
        }}
        ariaLabel={t.sceneLabel(Fv(v0), alpha, F1(pos.x), F1(Math.max(0, pos.y)))}
      >
        {(W, H, narrow) => <LaunchScene W={W} H={H} narrow={narrow} t={t} c={c} f={f} simT={sim.t} done={done} running={sim.running} dotMode={dotMode} dtS={dtS} airF={airF} />}
      </LabScene>

      <Explain icon={Lightbulb} id={`${settled}-${air}`} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.T} symbol="T" value={F2(f.T)} unit={c.s} accent={C.time} textColor="#a5f3fc" sub={t.readouts.tNow(F2(sim.t))} active={done} />
        <Readout
          label={t.readouts.H}
          symbol="H"
          value={F1(f.H)}
          unit={c.m}
          accent={C.path}
          textColor={C.pathText}
          sub={t.readouts.yNow(F1(Math.max(0, pos.y)))}
          active={sim.t >= f.tTop && sim.t > 0}
        />
        <Readout label={t.readouts.L} symbol="L" value={F1(f.L)} unit={c.m} accent={C.disp} textColor={C.dispText} sub={t.readouts.xNow(F1(pos.x))} active={done} />
        <Readout label={t.readouts.v} symbol="|v|" value={F1(speed)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.comps(F1(vel.vx), F1(vel.vy))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="at-launch-v0"
            label={c.common.v0}
            symbol="v₀"
            min={5}
            max={30}
            step={0.5}
            value={v0}
            onChange={slide(setV0)}
            accent={C.vel}
            display={`${F1(v0)} ${c.ms}`}
            hint={t.sliders.v0Hint(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="at-launch-alpha"
            label={c.common.alpha}
            symbol="α"
            min={5}
            max={85}
            step={1}
            value={alpha}
            onChange={slide(setAlpha)}
            accent="#e2e8f0"
            display={`${alpha}°`}
            hint={t.sliders.alphaHint}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{t.rateLabel}</p>
            <Segmented label={t.rateLabel} className="grid-cols-3" value={rate} onChange={setRate} accent="#22d3ee" options={RATES.map((r) => ({ value: r, label: t.rates[r] }))} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="mb-1.5 text-sm text-gray-300">{t.dotsLabel}</p>
              <Segmented
                label={t.dotsLabel}
                className="grid-cols-2"
                value={dotMode}
                onChange={setDotMode}
                accent="#67e8f9"
                options={[
                  { value: 'plain', label: t.dotsOpts.plain },
                  { value: 'vec', label: t.dotsOpts.vec },
                ]}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm text-gray-300">{t.airLabel}</p>
              <Segmented
                label={t.airLabel}
                className="grid-cols-2"
                value={air}
                onChange={setAir}
                accent="#fbbf24"
                options={[
                  { value: false, label: t.airOpts.off },
                  { value: true, label: t.airOpts.on },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{t.formulas.title}</p>
          <dl className="mt-2 space-y-1.5">
            {formulas.map(([name, val, col]) => (
              <FormulaRow key={name} name={name} value={val} color={col} />
            ))}
          </dl>
          <p className="mt-2 text-xs leading-snug text-gray-500">{t.formulas.note(fmt(G, 1, dec))}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <DarkGraph
            title={t.graph.title}
            legend={[
              { color: C.vxText, label: t.graph.vx },
              { color: C.vyText, label: t.graph.vy },
            ]}
            xMax={tMaxG}
            yMin={-yTop}
            yMax={yTop}
            xLabel={t.graph.axisT}
            yLabel={t.graph.axisV}
            dec={dec}
            xDigits={Number.isInteger(tMaxG / 4) ? 0 : tMaxG / 4 >= 0.1 && Number.isInteger((tMaxG / 4) * 10) ? 1 : 2}
            ariaLabel={t.graph.aria(F1(f.vx), F1(vel.vy))}
            onScrub={(x) => setSim({ t: Math.min(x, f.T), running: false })}
            note={t.graph.note}
            height={220}
          >
            {(gx, gy) => (
              <>
                <line x1={gx(0)} y1={gy(f.vx)} x2={gx(f.T)} y2={gy(f.vx)} stroke={C.vxText} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
                <line x1={gx(0)} y1={gy(f.vy)} x2={gx(f.T)} y2={gy(-f.vy)} stroke={C.vyText} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
                <line x1={gx(f.tTop)} x2={gx(f.tTop)} y1={gy(yTop)} y2={gy(-yTop)} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 4" />
                <circle cx={gx(f.tTop)} cy={gy(0)} r="3" fill="none" stroke={C.vyText} strokeWidth="1.5" />
                <text x={gx(f.tTop) + 6} y={gy(0) + 15} fontSize="11" fill="#cbd5e1">
                  {t.graph.top}
                </text>
                {sim.t > 0 && (
                  <>
                    <line x1={gx(sim.t)} x2={gx(sim.t)} y1={gy(yTop)} y2={gy(-yTop)} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
                    <line x1={gx(0)} y1={gy(f.vx)} x2={gx(sim.t)} y2={gy(f.vx)} stroke={C.vxText} strokeWidth="2.5" strokeLinecap="round" />
                    <line x1={gx(0)} y1={gy(f.vy)} x2={gx(sim.t)} y2={gy(vel.vy)} stroke={C.vyText} strokeWidth="2.5" strokeLinecap="round" />
                  </>
                )}
                <circle cx={gx(sim.t)} cy={gy(f.vx)} r="4" fill={C.vxText} stroke="#0b0b16" strokeWidth="1.5" />
                <circle cx={gx(sim.t)} cy={gy(vel.vy)} r="4" fill={C.vyText} stroke="#0b0b16" strokeWidth="1.5" />
              </>
            )}
          </DarkGraph>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scene */

function LaunchScene({ W, H, narrow, t, c, f, simT, done, running, dotMode, dtS, airF }) {
  const dec = c.decimal;
  const { xMax, yMax } = boxFor(f);
  const pad = narrow ? PAD_N : PAD_W;
  const view = useMemo(() => fieldView(W, H, xMax, yMax, pad), [W, H, xMax, yMax, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const gy = view.sy(0);
  const ox = view.sx(0);
  const velPx = narrow ? 2.2 : 3.2;
  const ballR = narrow ? 6 : 7;

  const pos = posAt(f, simT);
  const vel = velAt(f, simT);
  const bx = view.sx(pos.x);
  const by = view.sy(Math.max(0, pos.y));
  const preview = useMemo(() => parabolaPts(view, f, 0, f.T, 90), [view, f]);
  const trace = simT > 0 ? parabolaPts(view, f, 0, simT, Math.max(8, Math.round((90 * simT) / f.T))) : null;

  /* strobe dots at equal time steps */
  const dots = [];
  for (let k = 1; k * dtS <= simT + 1e-9 && k * dtS < f.T - 1e-6; k += 1) {
    const p = posAt(f, k * dtS);
    dots.push({ k, t: k * dtS, x: view.sx(p.x), y: view.sy(p.y), vy: f.vy - G * k * dtS });
  }
  const spacing = f.vx * dtS * view.k;
  const stride = Math.max(1, Math.ceil((f.vx * velPx * 1.15) / Math.max(spacing, 1)));

  /* labels */
  const showH = simT > 0 && simT >= f.tTop - 1e-9;
  const apx = view.sx(f.L / 2);
  const apy = view.sy(f.H);
  const hText = t.hTag(fmt(f.H, 1, dec));
  const hW = textWidth(hText, fs, 600) + 16;
  const lText = t.lTag(fmt(f.L, 1, dec));
  const lowArc = f.H * view.k < 40;
  const atStart = simT === 0;
  const sub = atStart ? '₀' : '';

  return (
    <g>
      <Field view={view} W={W} H={H} narrow={narrow} xUnit={c.common.axisX} yUnit={c.common.axisY} dec={dec} yUnitAt={narrow ? 26 : 80} />

      {/* calculated parabola */}
      <polyline points={preview} fill="none" stroke={C.preview} strokeWidth="1.5" strokeDasharray="5 6" />

      {/* the same throw in air */}
      {airF && (
        <g>
          <polyline
            points={airF.pts.map((p) => `${view.sx(p.x).toFixed(1)},${view.sy(p.y).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={C.air}
            strokeWidth="2.25"
            strokeDasharray="7 5"
          />
          <circle cx={view.sx(airF.L)} cy={gy} r="4" fill={C.air} stroke="#fff" strokeWidth="1.5" />
          <Pill x={view.sx(airF.L)} y={gy - 18} text={t.airTag(fmt(airF.L, 0, dec))} bg={C.air} size={fs - 1} box={box} />
        </g>
      )}

      {/* max height */}
      {showH && (
        <g>
          <line x1={apx} x2={apx} y1={apy} y2={gy} stroke={C.path} strokeWidth="1.3" strokeDasharray="4 4" opacity="0.8" />
          <line x1={apx - 6} x2={apx + 6} y1={apy} y2={apy} stroke={C.path} strokeWidth="1.5" />
          {!lowArc && <Pill x={narrow ? apx : apx + 10 + hW / 2} y={narrow ? apy - 18 : (apy + gy) / 2} text={hText} bg={C.path} size={fs} box={box} />}
        </g>
      )}

      {/* trajectory so far */}
      {trace && (
        <>
          <polyline points={trace} fill="none" stroke={C.path} strokeOpacity="0.16" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={trace} fill="none" stroke={C.path} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      {/* equal time steps: dots, and their shadows on both axes */}
      {dots.map((d) => (
        <g key={d.k}>
          <line x1={d.x} x2={d.x} y1={gy - 5} y2={gy + 5} stroke={C.vx} strokeWidth="2" />
          <line x1={ox - 5} x2={ox + 5} y1={d.y} y2={d.y} stroke={C.vy} strokeWidth="2" />
        </g>
      ))}
      {dotMode === 'vec' &&
        dots
          .filter((d) => d.k % stride === 0)
          .map((d) => (
            <g key={`v${d.k}`} opacity="0.85">
              <Vec x={d.x} y={d.y} dx={f.vx * velPx} dy={0} color={C.vx} width={1.8} head={7} />
              <Vec x={d.x} y={d.y} dx={0} dy={-d.vy * velPx} color={C.vy} width={1.8} head={7} />
            </g>
          ))}
      {dots.map((d) => (
        <circle key={`d${d.k}`} cx={d.x} cy={d.y} r={narrow ? 3 : 3.6} fill={C.ink} stroke="#fff" strokeWidth="1.3" />
      ))}

      {/* range */}
      {done && (
        <g>
          <line x1={ox} x2={view.sx(f.L)} y1={gy - 8} y2={gy - 8} stroke={C.disp} strokeWidth="1.5" />
          <line x1={ox} x2={ox} y1={gy - 13} y2={gy - 3} stroke={C.disp} strokeWidth="1.5" />
          <line x1={view.sx(f.L)} x2={view.sx(f.L)} y1={gy - 13} y2={gy - 3} stroke={C.disp} strokeWidth="1.5" />
          <Pill x={lowArc ? view.sx(f.L) + 14 + textWidth(lText, fs, 600) / 2 : view.sx(f.L * (narrow ? 0.66 : 0.5))} y={gy - 22} text={lText} bg={C.disp} size={fs} box={box} />
          {lowArc && <Pill x={apx} y={apy - 20} text={hText} bg={C.path} size={fs} box={box} />}
        </g>
      )}

      <Launcher view={view} alpha={f.alpha} narrow={narrow} arcLabel={`α = ${f.alpha}°`} />

      {/* projections of the ball on the axes */}
      {simT > 0 && !done && (
        <g opacity="0.55">
          <line x1={bx} x2={bx} y1={by} y2={gy} stroke={C.muted} strokeWidth="1" strokeDasharray="2 3" />
          <line x1={ox} x2={bx} y1={by} y2={by} stroke={C.muted} strokeWidth="1" strokeDasharray="2 3" />
        </g>
      )}

      <Ball x={bx} y={by} r={ballR} pulse={running} />

      {/* vectors at the ball */}
      <g>
        <line x1={bx + vel.vx * velPx} y1={by} x2={bx + vel.vx * velPx} y2={by - vel.vy * velPx} stroke={C.muted} strokeWidth="1" strokeDasharray="3 3" />
        <line x1={bx} y1={by - vel.vy * velPx} x2={bx + vel.vx * velPx} y2={by - vel.vy * velPx} stroke={C.muted} strokeWidth="1" strokeDasharray="3 3" />
        <Vec x={bx} y={by} dx={vel.vx * velPx} dy={0} color={C.vx} width={2.5} head={10} label={`v${sub}ₓ`} size={fs + 1} />
        <Vec x={bx} y={by} dx={0} dy={-vel.vy * velPx} color={C.vy} width={2.5} head={10} label={`v${sub}ᵧ`} size={fs + 1} />
        <Vec x={bx} y={by} dx={vel.vx * velPx} dy={-vel.vy * velPx} color={C.vel} width={3.25} head={12} label={`v${sub}`} size={fs + 2} />
        {simT > 0 && !done && <Vec x={bx} y={by + ballR} dx={0} dy={narrow ? 22 : 30} color={C.g} width={2.5} head={9} label="g" size={fs + 1} labelOffset={10} />}
      </g>

      {/* top of the flight: v = vₓ */}
      {showH && !done && Math.abs(simT - f.tTop) < 0.02 * f.T + 1e-9 && (
        <Label x={bx} y={by - 16} color={C.vel} size={fs}>
          {t.topTag}
        </Label>
      )}

      <VelScale x={W - (narrow ? 16 : 26)} y={gy - (narrow ? 14 : 18)} px={10 * velPx} text={c.common.velScale(10)} />
    </g>
  );
}
