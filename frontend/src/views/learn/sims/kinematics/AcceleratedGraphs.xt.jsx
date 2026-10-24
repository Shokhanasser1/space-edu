import { useState } from 'react';
import { Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import {
  C,
  Label,
  LabScene,
  PRESETS,
  PlotGrid,
  ScrubArea,
  TimeChip,
  Track,
  arrowScale,
  axisRange,
  makePlot,
  trackRange,
  motionAt,
  num,
  usePlayback,
  xExtent,
} from './AcceleratedGraphs.parts';

/**
 * Tab 2 - the x–t graph is a parabola (x = v₀t + at²/2 has t² in it). The
 * green tangent at the chosen moment has slope Δx/Δt = the instantaneous
 * velocity; faint tangents left at every whole second show the slope
 * growing (or shrinking). The dark panel underneath plots those slopes: the
 * straight v–t line of the first tab.
 */

const DUR = 6;
const TONES = { idle: '#22d3ee', up: '#34d399', down: '#fb923c', vertex: '#f472b6', back: '#f472b6', line: '#93c5fd', done: '#34d399', doneLine: '#34d399' };

/** A graph range whose four quarter ticks are round numbers and include 0. */
function quarterRange(lo, hi) {
  const span = Math.max(hi - lo, 1);
  for (const m of [1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 100]) {
    const step = m;
    if (step * 4 < span) continue;
    const yMin = Math.floor(lo / step + 1e-9) * step;
    if (yMin + 4 * step >= hi - 1e-9) return { yMin, yMax: yMin + 4 * step };
  }
  return { yMin: lo, yMax: hi };
}

export default function XtSim({ t, c }) {
  const dec = c.decimal;
  const [preset, setPreset] = useState('example');
  const [v0, setV0] = useState(0);
  const [a, setA] = useState(2);
  const play = usePlayback(DUR);
  const tt = play.t;
  const { x, v } = motionAt(v0, a, tt);
  const vEnd = v0 + a * DUR;
  const started = tt > 0 || play.running;
  const N = (n, br) => num(n, dec, br);

  const pick = (id) => {
    const p = PRESETS.find((q) => q.id === id);
    setPreset(id);
    setV0(p.v0);
    setA(p.a);
    play.reset();
  };
  const slide = (set) => (val) => {
    set(val);
    setPreset(null);
  };

  let key = 'idle';
  if (play.done) key = Math.abs(a) < 1e-9 ? 'doneLine' : 'done';
  else if (started) {
    if (Math.abs(a) < 1e-9) key = 'line';
    else if (Math.abs(v) < 0.3) key = 'vertex';
    else if (v < 0) key = 'back';
    else key = a > 0 ? 'up' : 'down';
  }
  const settled = useSettled(key, key === 'idle' || key.startsWith('done') ? 0 : 300);
  const ex = t.explain;
  const text = {
    idle: ex.idle,
    up: ex.up,
    down: ex.down,
    vertex: ex.vertex,
    back: ex.back,
    line: ex.line,
    done: ex.done(N(DUR), N(x)),
    doneLine: ex.doneLine(N(DUR), N(x)),
  }[settled];

  const { yMin, yMax } = quarterRange(Math.min(0, v0, vEnd), Math.max(0, v0, vEnd, 4));
  const legend = [
    { kind: 'line', color: C.disp, label: t.legend.curve },
    { kind: 'line', color: C.vel, label: t.legend.tangent },
    { kind: 'dash', color: '#6ee7b7', label: t.legend.ticks },
    { kind: 'dot', color: C.ink, label: t.legend.marks },
  ];

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
        ariaLabel={t.sceneLabel(fmt(x, 1, dec), fmt(v, 1, dec))}
      >
        {(W, H, narrow) => <XtDrawing W={W} H={H} narrow={narrow} t={t} c={c} v0={v0} a={a} tt={tt} onScrub={play.scrub} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.time} symbol="t" value={fmt(tt, 1, dec)} unit={c.s} accent={C.time} textColor="#a5f3fc" sub={t.readouts.timeSub} />
        <Readout label={t.readouts.pos} symbol="x" value={fmt(x, 1, dec)} unit={c.m} accent={C.disp} textColor={C.dispText} sub={t.readouts.posSub} />
        <Readout label={t.readouts.vel} symbol="v" value={fmt(v, 1, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.velSub} />
        <Readout label={t.readouts.acc} symbol="a" value={fmt(a, 1, dec)} unit={c.ms2} accent={C.acc} textColor={C.accText} sub={t.readouts.accSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ag-xt-t"
            label={t.sliders.t}
            symbol="t"
            min={0}
            max={DUR}
            step={0.1}
            value={tt}
            onChange={play.scrub}
            accent={C.time}
            display={`${fmt(tt, 1, dec)} ${c.s}`}
            hint={t.sliders.tHint}
          />
          <RangeField
            id="ag-xt-v0"
            label={t.sliders.v0}
            symbol="v₀"
            min={0}
            max={15}
            step={0.5}
            value={v0}
            onChange={slide(setV0)}
            accent={C.vel}
            display={`${fmt(v0, 1, dec)} ${c.ms}`}
          />
          <RangeField
            id="ag-xt-a"
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
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={t.graph.title}
            series={[
              { id: 'full', label: t.graph.full, color: '#475569', dash: '4 5', dot: false, points: [{ x: 0, y: v0 }, { x: DUR, y: vEnd }] },
              { id: 'v', label: t.graph.v, color: '#34d399', points: [{ x: 0, y: v0 }, { x: tt, y: v }] },
            ]}
            xMax={DUR}
            yMin={yMin}
            yMax={yMax}
            xLabel={t.graph.axisT}
            yLabel={t.graph.axisV}
            marker={tt}
            onScrub={play.scrub}
            decimal={dec}
            yDigits={Number.isInteger((yMax - yMin) / 4) ? 0 : 1}
            xDigits={1}
            note={t.graph.note}
            height={210}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- drawing */

function XtDrawing({ W, H, narrow, t, c, v0, a, tt, onScrub }) {
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const N = (n, br) => num(n, dec, br);
  const box = { w: W, h: H };
  const { x, v } = motionAt(v0, a, tt);
  const vEnd = v0 + a * DUR;

  const trackRect = narrow ? { x: 26, y: 46, w: W - 52, h: 100 } : { x: 70, y: 56, w: W - 126, h: 110 };
  const [lo, hi0] = xExtent(v0, a, DUR);
  const kv = arrowScale(Math.max(Math.abs(v0), Math.abs(vEnd)), narrow);
  const ka = narrow ? 13 : 17;
  const fwdPx = Math.max(Math.max(0, v0, vEnd) * kv, Math.max(0, a) * ka);
  const backPx = Math.max(Math.max(0, -v0, -vEnd) * kv, Math.max(0, -a) * ka);
  const xrTrack = trackRange(lo, hi0, fwdPx, backPx, trackRect.w, narrow ? 46 : 70);
  const marks = [];
  for (let k = 1; k <= tt + 1e-9; k += 1) marks.push({ k, x: motionAt(v0, a, k).x });

  const plotTop = trackRect.y + trackRect.h + (narrow ? 44 : 48);
  const plotRect = narrow ? { x: 42, y: plotTop, w: W - 42 - 46, h: H - plotTop - 30 } : { x: 70, y: plotTop, w: W - 126, h: H - plotTop - 32 };
  const tr = axisRange(0, DUR, plotRect.w, narrow ? 30 : 80);
  const yr = axisRange(Math.min(0, lo), Math.max(hi0, 4), plotRect.h, narrow ? 28 : 32);
  const plot = makePlot(plotRect, tr, yr);
  const { gx, gy } = plot;

  const curve = (t1) => {
    const n = Math.max(2, Math.ceil((t1 / DUR) * 120));
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const ti = (t1 * i) / n;
      pts.push(`${gx(ti).toFixed(1)},${gy(motionAt(v0, a, ti).x).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  /* tangent direction in pixels for slope v (1 s across, v metres up) */
  const dirAt = (vv) => {
    const dx = gx(1) - gx(0);
    const dy = gy(vv) - gy(0);
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  };
  const P = { x: gx(tt), y: gy(x) };
  const d = dirAt(v);
  const Lt = narrow ? 110 : 190;

  const ticks = [];
  for (let k = 0; k <= tt + 1e-9; k += 1) {
    const m = motionAt(v0, a, k);
    const dk = dirAt(m.v);
    const q = { x: gx(k), y: gy(m.x) };
    const L = Lt * 0.8;
    ticks.push({ k, x1: q.x - dk.x * L, y1: q.y - dk.y * L, x2: q.x + dk.x * L, y2: q.y + dk.y * L });
  }

  /* slope triangle on the tangent with Δt = 1 s */
  const fwd = tt + 1 <= DUR + 1e-9;
  const A = fwd ? { t: tt, x } : { t: tt - 1, x: x - v };
  const B = { t: A.t + 1, x: A.x };
  const Cc = { t: A.t + 1, x: A.x + v };
  const triH = Math.abs(gy(Cc.x) - gy(B.x));
  const triW = Math.abs(gx(B.t) - gx(A.t));
  const showTri = tt > 0.02 || v0 > 0;

  const tv = Math.abs(a) > 1e-9 ? -v0 / a : null;
  const vertex = tv !== null && tv > 0 && tv < DUR && tt >= tv - 1e-6 ? { x: gx(tv), y: gy(motionAt(v0, a, tv).x) } : null;

  /* the slope pill sits by the left part of the tangent, on the side away from the curve */
  const side = a >= 0 ? 1 : -1; // +1: below the tangent (screen), the convex curve lies above it
  const near = { x: P.x - d.x * Lt * 0.62, y: P.y - d.y * Lt * 0.62 };
  const slopeText = t.slopeTag(N(v));
  // clear the line by the pill's half size measured along the normal
  const off = ((textWidth(slopeText, fs, 600) + 16) / 2) * Math.abs(d.y) + ((fs + 10) / 2) * Math.abs(d.x) + 6;
  const pillPos = {
    x: Math.min(Math.max(near.x - d.y * off * side, plot.x + 90), plot.x + plot.w - 90),
    y: Math.min(Math.max(near.y + d.x * off * side, plot.y - 24), plot.y + plot.h - 14),
  };

  return (
    <g>
      <Track
        rect={trackRect}
        xr={xrTrack}
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

      <PlotGrid plot={plot} xLabel={t.axisT} yLabel={t.axisXg} narrow={narrow} decimal={dec} />
      <defs>
        <clipPath id="ag-xt-clip">
          <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} />
        </clipPath>
      </defs>

      {/* the whole parabola, faint */}
      <polyline points={curve(DUR)} fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray="5 6" />

      <g clipPath="url(#ag-xt-clip)">
        {/* tangents left behind at every whole second */}
        {ticks.map((k) => (
          <line key={k.k} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} stroke={C.vel} strokeOpacity="0.38" strokeWidth="1.5" strokeDasharray="5 5" />
        ))}
        {/* tangent now */}
        <line x1={P.x - d.x * Lt} y1={P.y - d.y * Lt} x2={P.x + d.x * Lt} y2={P.y + d.y * Lt} stroke={C.vel} strokeWidth="2.5" />
        {/* slope triangle */}
        {showTri && (
          <g>
            <polygon points={`${gx(A.t)},${gy(A.x)} ${gx(B.t)},${gy(B.x)} ${gx(Cc.t)},${gy(Cc.x)}`} fill={C.vel} fillOpacity="0.08" />
            <line x1={gx(A.t)} y1={gy(A.x)} x2={gx(B.t)} y2={gy(B.x)} stroke={C.vel} strokeWidth="2" strokeDasharray="5 4" />
            <line x1={gx(B.t)} y1={gy(B.x)} x2={gx(Cc.t)} y2={gy(Cc.x)} stroke={C.vel} strokeWidth="2" strokeDasharray="5 4" />
          </g>
        )}
      </g>

      {/* the parabola so far */}
      {tt > 1e-6 && <polyline points={curve(tt)} fill="none" stroke={C.disp} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />}

      {vertex && (
        <g>
          <circle cx={vertex.x} cy={vertex.y} r="4.5" fill="#fff" stroke={C.ink} strokeWidth="2" />
          <Label x={vertex.x} y={vertex.y - 12} size={fs} color={C.ink}>
            {t.vertex}
          </Label>
        </g>
      )}

      {/* projections of the current point */}
      <line x1={P.x} y1={P.y} x2={P.x} y2={plot.y + plot.h} stroke={C.disp} strokeOpacity="0.35" strokeDasharray="3 4" />
      <line x1={plot.x} y1={P.y} x2={P.x} y2={P.y} stroke={C.disp} strokeOpacity="0.35" strokeDasharray="3 4" />

      {showTri && triW > 30 && (
        <Pill x={(gx(A.t) + gx(B.t)) / 2} y={gy(A.x) + (v >= 0 ? 14 : -14)} text={t.dtTag} bg="#fff" color="#047857" border="#6ee7b7" size={fs - 1} box={box} />
      )}
      {showTri && triH > 26 && (
        <Pill x={gx(B.t) + (narrow ? 34 : 42)} y={(gy(B.x) + gy(Cc.x)) / 2} text={t.dxTag(N(v))} bg="#fff" color="#047857" border="#6ee7b7" size={fs - 1} box={box} />
      )}
      <Pill x={pillPos.x} y={pillPos.y} text={slopeText} bg={C.vel} size={fs} box={box} />

      <circle cx={P.x} cy={P.y} r={narrow ? 5.5 : 6.5} fill={C.disp} stroke="#fff" strokeWidth="2.5" />
      <Pill x={plot.x - (narrow ? 20 : 30)} y={P.y} text={t.xTag(fmt(x, 1, dec))} bg={C.disp} size={fs - 1} box={box} />

      <ScrubArea plot={plot} W={W} tMax={DUR} onScrub={onScrub} label={t.scrubHint} />
      {tt === 0 && !narrow && (
        <text x={plot.x + plot.w} y={plot.y - 8} textAnchor="end" fontSize={fs - 1} fill={C.muted} pointerEvents="none">
          {t.scrubHint}
        </text>
      )}
    </g>
  );
}
