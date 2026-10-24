import { useState } from 'react';
import { Check, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, useSettled } from '../kit/ui';
import {
  C,
  Label,
  LabScene,
  PRESETS,
  PlotGrid,
  ScrubArea,
  TimeChip,
  Track,
  areaParts,
  arrowScale,
  axisRange,
  centroid,
  trackRange,
  makePlot,
  motionAt,
  num,
  usePlayback,
  xExtent,
} from './AcceleratedGraphs.parts';

/**
 * Tab 1 - the v–t graph of uniformly accelerated motion: a sloping straight
 * line whose slope is the acceleration (a = Δv/Δt, drawn as an orange slope
 * triangle) and whose area is the displacement. The cart on the track above
 * moves with the same motion, so the line and the body can be compared.
 */

const TONES = { idle: '#22d3ee', up: '#34d399', down: '#fb923c', flat: '#93c5fd', stop: '#f472b6', back: '#f472b6', done: '#34d399', doneBack: '#34d399' };

export default function VtSim({ t, c }) {
  const dec = c.decimal;
  const [preset, setPreset] = useState('example');
  const [v0, setV0] = useState(0);
  const [a, setA] = useState(2);
  const [dur, setDur] = useState(6);
  const play = usePlayback(dur);
  const tt = play.t;
  const { v } = motionAt(v0, a, tt);
  const vEnd = v0 + a * dur;
  const parts = areaParts(v0, a, tt);
  const s = parts.pos + parts.neg;
  const started = tt > 0 || play.running;
  const N = (n, br) => num(n, dec, br);

  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setV0(p.v0);
    setA(p.a);
    setDur(p.T);
    play.reset();
  };
  const slide = (set) => (val) => {
    set(val);
    setPreset(null);
  };

  /* ---- explanation */
  const tc = Math.abs(a) > 1e-9 ? -v0 / a : null;
  let key = 'idle';
  if (play.done) key = parts.neg < -0.05 ? 'doneBack' : 'done';
  else if (started) {
    if (Math.abs(a) < 1e-9) key = 'flat';
    else if (tc !== null && tc > 0 && Math.abs(tt - tc) < 0.35) key = 'stop';
    else if (v < 0) key = 'back';
    else key = a > 0 ? 'up' : 'down';
  }
  const settled = useSettled(key, key === 'idle' || key.startsWith('done') ? 0 : 300);
  const ex = t.explain;
  const text = {
    idle: ex.idle,
    up: ex.up(N(a)),
    down: ex.down(N(-a)),
    flat: ex.flat,
    stop: ex.stop,
    back: ex.back,
    done: ex.done(N(vEnd - v0, true), N(dur), N(a), N(s)),
    doneBack: ex.doneBack(N(parts.pos), N(parts.neg), N(s), N(parts.pos - parts.neg)),
  }[settled];

  const legend = [
    { kind: 'line', color: C.vel, label: t.legend.line },
    { kind: 'area', color: C.disp, label: t.legend.area },
    ...(parts.neg < -0.01 ? [{ kind: 'area', color: C.second, label: t.legend.areaNeg }] : []),
    { kind: 'line', color: C.acc, label: t.legend.slope },
    { kind: 'dot', color: C.ink, label: t.legend.marks },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{c.common.presets}</p>
          <Segmented
            label={c.common.presets}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: c.presets[p.id].name, sub: c.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={play.running ? Pause : Play} onClick={play.toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {play.running ? c.common.pause : play.done ? c.common.again : tt > 0 ? c.common.resume : c.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={play.reset} disabled={tt === 0 && !play.running} className="min-h-[52px] text-[15px]">
            {c.common.reset}
          </Btn>
        </div>
      </div>

      <LabScene
        legend={legend}
        chip={<TimeChip text={t.chip(fmt(tt, 1, dec))} />}
        height={(W, narrow) => (narrow ? 500 : 540)}
        ariaLabel={t.sceneLabel(fmt(v, 1, dec), fmt(s, 1, dec))}
      >
        {(W, H, narrow) => <VtDrawing W={W} H={H} narrow={narrow} t={t} c={c} v0={v0} a={a} dur={dur} tt={tt} onScrub={play.scrub} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[settled]}>
        {text}
      </Explain>

      {/* readouts */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.time} symbol="t" value={fmt(tt, 1, dec)} unit={c.s} accent={C.time} textColor="#a5f3fc" sub={t.readouts.timeSub} />
        <Readout label={t.readouts.vel} symbol="v" value={fmt(v, 1, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.velSub} />
        <Readout label={t.readouts.acc} symbol="a" value={fmt(a, 1, dec)} unit={c.ms2} accent={C.acc} textColor={C.accText} sub={t.readouts.accSub} />
        <Readout
          label={t.readouts.disp}
          symbol="s"
          value={fmt(s, 1, dec)}
          unit={c.m}
          accent={C.disp}
          textColor={C.dispText}
          sub={parts.neg < -0.01 ? t.readouts.pathSub(fmt(parts.pos - parts.neg, 1, dec)) : t.readouts.dispSub}
        />
      </div>

      {/* controls + area check */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ag-vt-v0"
            label={t.sliders.v0}
            symbol="v₀"
            min={0}
            max={15}
            step={0.5}
            value={v0}
            onChange={slide(setV0)}
            accent={C.vel}
            display={`${fmt(v0, 1, dec)} ${c.ms}`}
            hint={t.sliders.v0Hint(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="ag-vt-a"
            label={t.sliders.a}
            symbol="a"
            min={-4}
            max={4}
            step={0.5}
            value={a}
            onChange={slide(setA)}
            accent={C.acc}
            display={`${a > 0 ? '+' : ''}${fmt(a, 1, dec)} ${c.ms2}`}
            hint={t.sliders.aHint}
          />
          <RangeField
            id="ag-vt-T"
            label={t.sliders.T}
            symbol="t"
            min={2}
            max={10}
            step={0.5}
            value={dur}
            onChange={slide(setDur)}
            accent={C.time}
            display={`${fmt(dur, 1, dec)} ${c.s}`}
            hint={t.sliders.THint}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{t.check.title(N(tt))}</p>
          <dl className="mt-3 space-y-2.5">
            <CheckRow
              label={t.check.area}
              color={C.dispText}
              expr={`(v₀ + v)/2 · t = (${N(v0)} + ${N(v, true)})/2 · ${N(tt)}`}
              result={`${N(s)} ${c.m}`}
            />
            <CheckRow
              label={t.check.shape}
              color="#cbd5e1"
              expr={`v₀·t + t·Δv/2 = ${N(v0 * tt)} + ${N(0.5 * tt * (v - v0), true)}`}
              result={`${N(s)} ${c.m}`}
            />
            <CheckRow
              label={t.check.formula}
              color={C.velText}
              expr={`v₀t + at²/2 = ${N(v0)}·${N(tt)} + ${N(a, true)}·${N(tt)}²/2`}
              result={`${N(s)} ${c.m}`}
            />
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              <Check size={14} aria-hidden="true" /> {t.check.same}
            </span>
            <span className="text-xs text-gray-500">{t.check.note}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, color, expr, result }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-black/25 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 sm:w-40">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 font-mono text-[13px] sm:text-sm">
        <span className="text-gray-300">{expr}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          = {result}
        </span>
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------- drawing */

function VtDrawing({ W, H, narrow, t, c, v0, a, dur, tt, onScrub }) {
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const N = (n, br) => num(n, dec, br);
  const box = { w: W, h: H };
  const { x, v } = motionAt(v0, a, tt);
  const vEnd = v0 + a * dur;

  /* track */
  const trackRect = narrow ? { x: 26, y: 46, w: W - 52, h: 100 } : { x: 70, y: 56, w: W - 126, h: 110 };
  const [lo, hi] = xExtent(v0, a, dur);
  const kv = arrowScale(Math.max(Math.abs(v0), Math.abs(vEnd)), narrow);
  const ka = narrow ? 13 : 17;
  const fwdPx = Math.max(Math.max(0, v0, vEnd) * kv, Math.max(0, a) * ka);
  const backPx = Math.max(Math.max(0, -v0, -vEnd) * kv, Math.max(0, -a) * ka);
  const xr = trackRange(lo, hi, fwdPx, backPx, trackRect.w, narrow ? 46 : 70);
  const marks = [];
  for (let k = 1; k <= tt + 1e-9; k += 1) marks.push({ k, x: motionAt(v0, a, k).x });

  /* graph */
  const plotTop = trackRect.y + trackRect.h + (narrow ? 44 : 48);
  const plotRect = narrow ? { x: 42, y: plotTop, w: W - 42 - 46, h: H - plotTop - 30 } : { x: 70, y: plotTop, w: W - 126, h: H - plotTop - 32 };
  const tr = axisRange(0, dur, plotRect.w, narrow ? 30 : 80);
  const vr = axisRange(Math.min(0, v0, vEnd), Math.max(0, v0, vEnd, 4), plotRect.h, narrow ? 28 : 32);
  const plot = makePlot(plotRect, tr, vr);
  const { gx, gy } = plot;

  const parts = areaParts(v0, a, tt);
  const polys = [];
  if (tt > 1e-6) {
    if (parts.tc !== null) {
      const tc = parts.tc;
      polys.push({ pts: [[gx(0), gy(0)], [gx(0), gy(v0)], [gx(tc), gy(0)]], s: motionAt(v0, a, tc).x });
      polys.push({ pts: [[gx(tc), gy(0)], [gx(tt), gy(v)], [gx(tt), gy(0)]], s: x - motionAt(v0, a, tc).x });
    } else {
      polys.push({ pts: [[gx(0), gy(0)], [gx(0), gy(v0)], [gx(tt), gy(v)], [gx(tt), gy(0)]], s: x });
    }
  }

  /* slope triangle: legs Δt along v = v₀ and Δv at the current time */
  const P0 = { x: gx(0), y: gy(v0) };
  const P1 = { x: gx(tt), y: gy(v) };
  const corner = { x: gx(tt), y: gy(v0) };
  const triW = Math.abs(P1.x - P0.x);
  const triH = Math.abs(P1.y - corner.y);
  const showSlope = Math.abs(a) > 1e-9 && tt > 0.05;
  const slopeLabels = showSlope && triW > (narrow ? 70 : 90) && triH > 34;
  let aPill = null;
  if (slopeLabels) {
    if (a > 0) {
      const dx = P1.x - P0.x;
      const dy = P1.y - P0.y;
      const L = Math.hypot(dx, dy) || 1;
      aPill = { x: (P0.x + P1.x) / 2 + (dy / L) * 34, y: (P0.y + P1.y) / 2 - (dx / L) * 34 };
    } else aPill = { x: (P0.x + corner.x + P1.x) / 3, y: (P0.y + corner.y + P1.y) / 3 };
  }

  const pointLabelRight = P1.x + (narrow ? 96 : 116) < plot.x + plot.w;
  const pointLabelY = pointLabelRight || a >= 0 ? P1.y - 10 : Math.min(P1.y + 18, plot.y + plot.h - 6);
  return (
    <g>
      <Track
        rect={trackRect}
        xr={xr}
        x={x}
        v={v}
        a={a}
        marks={marks}
        narrow={narrow}
        kv={kv}
        ka={ka}
        labels={{ axis: t.axisX, mark: (k) => t.markS(k) }}
        decimal={dec}
        W={W}
      />
      <line x1={12} x2={W - 12} y1={trackRect.y + trackRect.h + 12} y2={trackRect.y + trackRect.h + 12} stroke="#e2e8f0" strokeDasharray="2 4" />

      <PlotGrid plot={plot} xLabel={t.axisT} yLabel={t.axisV} narrow={narrow} decimal={dec} />

      {/* the whole line, faint, so the slope can be read before the run */}
      <line x1={gx(0)} y1={gy(v0)} x2={gx(dur)} y2={gy(vEnd)} stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="5 6" />

      {/* area under the line = displacement */}
      {polys.map((p, i) => (
        <polygon
          key={i}
          points={p.pts.map((q) => q.join(',')).join(' ')}
          fill={p.s >= 0 ? C.disp : C.second}
          fillOpacity="0.2"
          stroke={p.s >= 0 ? C.disp : C.second}
          strokeOpacity="0.45"
          strokeWidth="1"
        />
      ))}

      {/* slope triangle */}
      {showSlope && (
        <g>
          <polygon points={`${P0.x},${P0.y} ${corner.x},${corner.y} ${P1.x},${P1.y}`} fill={C.acc} fillOpacity="0.08" />
          <line x1={P0.x} y1={P0.y} x2={corner.x} y2={corner.y} stroke={C.acc} strokeWidth="2.2" strokeDasharray="6 4" />
          <line x1={corner.x} y1={corner.y} x2={P1.x} y2={P1.y} stroke={C.acc} strokeWidth="2.2" strokeDasharray="6 4" />
          {triW > 14 && triH > 14 && (
            <path
              d={`M${corner.x - 9},${corner.y} L${corner.x - 9},${corner.y + (P1.y < corner.y ? -9 : 9)} L${corner.x},${corner.y + (P1.y < corner.y ? -9 : 9)}`}
              fill="none"
              stroke={C.acc}
              strokeWidth="1.2"
            />
          )}
        </g>
      )}

      {/* the v–t line itself */}
      {tt > 1e-6 && <line x1={P0.x} y1={P0.y} x2={P1.x} y2={P1.y} stroke={C.vel} strokeWidth="3.5" strokeLinecap="round" />}

      {/* v = 0 crossing */}
      {parts.tc !== null && (
        <g>
          <circle cx={gx(parts.tc)} cy={gy(0)} r="4.5" fill="#fff" stroke={C.ink} strokeWidth="2" />
          <Label x={gx(parts.tc)} y={gy(0) - 10} size={fs} color={C.ink}>
            {t.zero}
          </Label>
        </g>
      )}

      {/* labels */}
      {polys.map((p, i) => {
        const cen = centroid(p.pts);
        if (cen.area < (narrow ? 1500 : 2200)) return null;
        // a trapezium under a rising line: label its rectangle part, clear of the slope triangle
        const rectH = Math.abs(gy(0) - gy(v0));
        const pos = parts.tc === null && a > 0 && v0 > 0 && rectH > 30 ? { x: (P0.x + P1.x) / 2, y: (gy(0) + gy(v0)) / 2 } : cen;
        return <Pill key={`ap${i}`} x={pos.x} y={pos.y} text={t.areaTag(N(p.s))} bg={p.s >= 0 ? C.disp : C.second} size={fs} box={box} />;
      })}
      {slopeLabels && (
        <>
          <Pill x={P0.x + (corner.x - P0.x) * 0.62} y={corner.y - 13} text={t.dt(N(tt))} bg="#fff" color="#c2410c" border="#fdba74" size={fs - 1} box={box} />
          <Pill x={corner.x} y={(corner.y + P1.y) / 2} text={t.dv(N(v - v0))} bg="#fff" color="#c2410c" border="#fdba74" size={fs - 1} box={box} />
          <Pill x={aPill.x} y={aPill.y} text={t.slopeTag(N(v - v0), N(tt), N(a))} bg={C.acc} size={fs} box={box} />
        </>
      )}

      {/* current point */}
      <circle cx={P1.x} cy={P1.y} r={narrow ? 5.5 : 6.5} fill={C.vel} stroke="#fff" strokeWidth="2.5" />
      {tt > 1e-6 && (
        <Label x={pointLabelRight ? P1.x + 12 : P1.x - 12} y={pointLabelY} anchor={pointLabelRight ? 'start' : 'end'} size={fs} color={C.vel}>
          {t.vTag(fmt(v, 1, dec))}
        </Label>
      )}

      <ScrubArea plot={plot} W={W} tMax={dur} onScrub={onScrub} label={t.scrubHint} />
      {tt === 0 && !narrow && (
        <text x={plot.x + plot.w} y={plot.y - 8} textAnchor="end" fontSize={fs - 1} fill={C.muted} pointerEvents="none">
          {t.scrubHint}
        </text>
      )}
    </g>
  );
}
