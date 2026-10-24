import { useState } from 'react';
import { Bus, Eraser, Lightbulb, MoveRight, Pause, Play, RotateCcw, TrafficCone, TrendingDown, TrendingUp, Undo2 } from 'lucide-react';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, useSettled } from '../kit/ui';
import { C, Label, LabScene, PlotGrid, ScrubArea, TimeChip, Track, arrowScale, axisRange, centroid, makePlot, num, trackRange, usePlayback } from './AcceleratedGraphs.parts';

/**
 * Tab 3 - "build your own v–t graph" from pieces: speed up, keep the speed,
 * slow down. Whatever the shape, the displacement is the sum of the areas
 * under the pieces (areas below the time axis count as negative). The cart
 * on the track drives the built motion.
 */

const MAX_SEGS = 8;
const MAX_T = 20; // s
const MAX_V = 20; // m/s

const BUILD_PRESETS = [
  // speeds up 0 → 6 m/s in 3 s, keeps 6 m/s for 4 s, stops in 3 s: 9 + 24 + 9 = 42 m
  { id: 'bus', icon: Bus, segs: [{ a: 2, d: 3 }, { a: 0, d: 4 }, { a: -2, d: 3 }] },
  // the lesson's example as one piece: 0 → 12 m/s in 6 s, area 36 m
  { id: 'example', icon: TrendingUp, segs: [{ a: 2, d: 6 }] },
  // stop-and-go: 0 → 6 → 3 → 6 → 0 m/s, 2 s each: 6 + 9 + 9 + 6 = 30 m
  { id: 'traffic', icon: TrafficCone, segs: [{ a: 3, d: 2 }, { a: -1.5, d: 2 }, { a: 1.5, d: 2 }, { a: -3, d: 2 }] },
  // forward then back: 0 → 4 m/s, 4 m/s, then 4 → −4 m/s: 4 + 8 + (4 − 4) = 12 m
  { id: 'reverse', icon: Undo2, segs: [{ a: 2, d: 2 }, { a: 0, d: 2 }, { a: -2, d: 4 }] },
];

const TYPE_OF = (a) => (a > 1e-9 ? 'up' : a < -1e-9 ? 'down' : 'flat');
const TONES = { empty: '#94a3b8', idle: '#22d3ee', up: '#34d399', flat: '#93c5fd', down: '#fb923c', back: '#f472b6', done: '#34d399' };

/** Start/end times, speeds and positions of every piece. */
function plan(segs) {
  let t0 = 0;
  let v0 = 0;
  let x0 = 0;
  const out = segs.map((sg) => {
    const v1 = v0 + sg.a * sg.d;
    const x1 = x0 + v0 * sg.d + 0.5 * sg.a * sg.d * sg.d;
    const p = { ...sg, t0, t1: t0 + sg.d, v0, v1, x0, x1, s: x1 - x0 };
    t0 += sg.d;
    v0 = v1;
    x0 = x1;
    return p;
  });
  return { segs: out, T: t0, vEnd: v0, xEnd: x0 };
}

/** State of the built motion at time t. */
function stateAt(p, t) {
  if (!p.segs.length) return { x: 0, v: 0, a: 0, i: -1 };
  let i = p.segs.findIndex((s) => t < s.t1 - 1e-9);
  if (i < 0) i = p.segs.length - 1;
  const s = p.segs[i];
  const u = Math.max(0, Math.min(t, s.t1) - s.t0);
  return { x: s.x0 + s.v0 * u + 0.5 * s.a * u * u, v: s.v0 + s.a * u, a: s.a, i };
}

/** Areas of piece `s` from its start to time `te`, split where v crosses 0. */
function pieceAreas(s, te) {
  const end = Math.min(te, s.t1);
  if (end <= s.t0 + 1e-9) return [];
  const cuts = [s.t0];
  if (Math.abs(s.a) > 1e-9) {
    const tc = s.t0 - s.v0 / s.a;
    if (tc > s.t0 + 1e-9 && tc < end - 1e-9) cuts.push(tc);
  }
  cuts.push(end);
  const out = [];
  for (let k = 0; k < cuts.length - 1; k += 1) {
    const ua = cuts[k] - s.t0;
    const ub = cuts[k + 1] - s.t0;
    const va = s.v0 + s.a * ua;
    const vb = s.v0 + s.a * ub;
    out.push({ t0: cuts[k], t1: cuts[k + 1], va, vb, s: ((va + vb) / 2) * (ub - ua) });
  }
  return out;
}

export default function BuildSim({ t, c }) {
  const dec = c.decimal;
  const [preset, setPreset] = useState('bus');
  const [segs, setSegs] = useState(BUILD_PRESETS[0].segs);
  const [segDur, setSegDur] = useState(2);
  const [aMag, setAMag] = useState(2);
  const p = plan(segs);
  const play = usePlayback(p.T);
  const tt = p.T > 0 ? play.t : 0;
  const started = tt > 0 || play.running;
  const fillTo = started ? tt : p.T;
  const now = stateAt(p, tt);
  const N = (n, br) => num(n, dec, br);
  const N1 = (n) => num(Math.round(n * 10) / 10, dec);

  const setPieces = (next, id = null) => {
    setSegs(next);
    setPreset(id);
    play.reset();
  };
  const pick = (id) => setPieces(BUILD_PRESETS.find((b) => b.id === id).segs, id);
  const canAdd = (a) => segs.length < MAX_SEGS && p.T + segDur <= MAX_T + 1e-9 && Math.abs(p.vEnd + a * segDur) <= MAX_V + 1e-9;
  const add = (a) => {
    if (canAdd(a)) setPieces([...segs, { a, d: segDur }]);
  };
  const vBlocked = [aMag, -aMag].some((a) => Math.abs(p.vEnd + a * segDur) > MAX_V + 1e-9);
  const limit = segs.length >= MAX_SEGS ? t.limits.n : p.T + segDur > MAX_T + 1e-9 ? t.limits.T : vBlocked ? t.limits.v : null;

  /* ---- sum of areas */
  const sumText = (list) =>
    list.length ? list.map((s, i) => (i === 0 ? N1(s.s) : s.s >= 0 ? ` + ${N1(s.s)}` : ` − ${N1(-s.s)}`)).join('') : '0';
  // areas shaded so far: finished pieces, then the part of the current one
  const shaded = p.segs
    .filter((s) => s.t0 < fillTo - 1e-9)
    .map((s) => (s.t1 <= fillTo + 1e-9 ? s : { s: stateAt(p, fillTo).x - s.x0 }));
  const sNow = stateAt(p, fillTo).x;

  /* ---- explanation */
  let key = 'empty';
  if (p.segs.length) {
    if (!started) key = 'idle';
    else if (play.done) key = 'done';
    else {
      const sg = p.segs[now.i];
      key = now.v < -0.05 ? `back${now.i}` : `${TYPE_OF(sg.a)}${now.i}`;
    }
  }
  const settled = useSettled(key, key === 'idle' || key === 'done' || key === 'empty' ? 0 : 250);
  const ex = t.explain;
  const kind = settled.replace(/\d+$/, '');
  const idx = Number(settled.match(/\d+$/)?.[0] ?? -1);
  const sg = p.segs[idx];
  let text = ex.empty;
  if (kind === 'idle') text = ex.idle(sumText(p.segs), N(p.xEnd));
  else if (kind === 'done') text = ex.done(sumText(p.segs), N(p.xEnd));
  else if (sg && kind === 'up') text = ex.up(idx + 1, N(sg.v0), N(sg.v1), N(sg.s));
  else if (sg && kind === 'down') text = ex.down(idx + 1, N(sg.v0), N(sg.v1), N(sg.s));
  else if (sg && kind === 'flat') text = ex.flat(idx + 1, N(sg.v0, true), N(sg.d), N(sg.s));
  else if (sg && kind === 'back') text = ex.back(idx + 1);

  const legend = [
    { kind: 'line', color: C.vel, label: t.legend.line },
    { kind: 'area', color: C.disp, label: t.legend.area },
    { kind: 'area', color: C.second, label: t.legend.areaNeg },
    { kind: 'dot', color: C.ink, label: t.legend.marks },
  ];

  const addBtns = [
    { id: 'up', a: aMag, icon: TrendingUp, color: C.velText },
    { id: 'flat', a: 0, icon: MoveRight, color: C.dispText },
    { id: 'down', a: -aMag, icon: TrendingDown, color: C.accText },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.presetsLabel}</p>
          <Segmented
            label={t.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={BUILD_PRESETS.map((b) => ({ value: b.id, label: t.presets[b.id].name, sub: t.presets[b.id].sub, icon: b.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn
            variant="primary"
            icon={play.running ? Pause : Play}
            onClick={play.toggle}
            disabled={p.T === 0}
            className="xl:min-w-[148px] min-h-[52px] text-[15px]"
          >
            {play.running ? c.common.pause : play.done && started ? c.common.again : tt > 0 ? c.common.resume : c.common.start}
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
        ariaLabel={t.sceneLabel(segs.length, fmt(p.xEnd, 1, dec))}
      >
        {(W, H, narrow) => <BuildDrawing W={W} H={H} narrow={narrow} t={t} c={c} p={p} tt={tt} fillTo={fillTo} onScrub={play.scrub} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[kind] ?? '#22d3ee'}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.time} symbol="t" value={fmt(tt, 1, dec)} unit={c.s} accent={C.time} textColor="#a5f3fc" sub={t.readouts.timeSub(fmt(p.T, 1, dec))} />
        <Readout label={t.readouts.vel} symbol="v" value={fmt(now.v, 1, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.velSub(fmt(now.a, 1, dec))} />
        <Readout label={t.readouts.disp} symbol="s" value={fmt(sNow, 1, dec)} unit={c.m} accent={C.disp} textColor={C.dispText} sub={t.readouts.dispSub} />
        <Readout
          label={t.readouts.total}
          value={fmt(p.xEnd, 1, dec)}
          unit={c.m}
          accent="#e2e8f0"
          sub={t.readouts.totalSub(segs.length, fmt(p.T, 1, dec))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.addLabel}</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.addLabel}>
            {addBtns.map((b) => {
              const Icon = b.icon;
              const ok = canAdd(b.a);
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => add(b.a)}
                  className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-center transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon size={20} strokeWidth={2.3} style={{ color: b.color }} aria-hidden="true" />
                  <span className="text-[13px] font-semibold leading-tight text-white">+ {t.add[b.id]}</span>
                  <span className="text-[11px] leading-tight text-gray-400 tabular-nums">
                    {t.addSub(`${b.a > 0 ? '+' : ''}${fmt(b.a, 1, dec)}`, fmt(segDur, 1, dec))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn icon={Undo2} onClick={() => setPieces(segs.slice(0, -1))} disabled={!segs.length}>
              {t.undo}
            </Btn>
            <Btn icon={Eraser} onClick={() => setPieces([])} disabled={!segs.length}>
              {t.clear}
            </Btn>
          </div>
          {limit && <p className="text-xs text-amber-300/90">{limit}</p>}
          <RangeField
            id="ag-b-d"
            label={t.sliders.d}
            symbol="Δt"
            min={1}
            max={4}
            step={0.5}
            value={segDur}
            onChange={setSegDur}
            accent={C.time}
            display={`${fmt(segDur, 1, dec)} ${c.s}`}
          />
          <RangeField
            id="ag-b-a"
            label={t.sliders.a}
            symbol="|a|"
            min={0.5}
            max={4}
            step={0.5}
            value={aMag}
            onChange={setAMag}
            accent={C.acc}
            display={`${fmt(aMag, 1, dec)} ${c.ms2}`}
            hint={t.sliders.aHint}
          />
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{t.sum.title}</p>
          {p.segs.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{t.sum.empty}</p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {p.segs.map((s, i) => {
                const filled = s.t1 <= fillTo + 1e-9;
                const active = started && !play.done && now.i === i;
                return (
                  <li
                    key={i}
                    className={`grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-white/[0.09]' : 'bg-black/25'}`}
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: s.s >= 0 ? C.disp : C.second }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-gray-300">
                      <span className="font-semibold text-white">{t.add[TYPE_OF(s.a)]}</span>
                      <span className="text-gray-400"> · {t.sum.row(`${s.a > 0 ? '+' : ''}${fmt(s.a, 1, dec)}`, fmt(s.d, 1, dec), N(s.v0), N(s.v1))}</span>
                    </span>
                    <span className={`font-mono font-semibold tabular-nums ${filled ? '' : 'opacity-40'}`} style={{ color: s.s >= 0 ? C.dispText : C.secondText }}>
                      {s.s >= 0 ? '+' : '−'}
                      {N(Math.abs(s.s))} {c.m}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">{t.sum.total}</p>
            <p className="mt-1 font-mono text-[15px] text-gray-200">
              s = {sumText(shaded)} = <span className="font-semibold text-sky-300">{N1(sNow)} {c.m}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- drawing */

function BuildDrawing({ W, H, narrow, t, c, p, tt, fillTo, onScrub }) {
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const N = (n) => num(n, dec);
  const box = { w: W, h: H };
  const now = stateAt(p, tt);

  /* track: the whole run must fit */
  const xs = [0];
  const vs = [0];
  p.segs.forEach((s) => {
    xs.push(s.x1);
    vs.push(s.v1);
    if (Math.abs(s.a) > 1e-9) {
      const u = -s.v0 / s.a;
      if (u > 0 && u < s.d) xs.push(s.x0 + s.v0 * u + 0.5 * s.a * u * u);
    }
  });
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const trackRect = narrow ? { x: 26, y: 46, w: W - 52, h: 100 } : { x: 70, y: 56, w: W - 126, h: 110 };
  const kv = arrowScale(Math.max(...vs.map(Math.abs), 1), narrow);
  const ka = narrow ? 13 : 17;
  const aMax = Math.max(0, ...p.segs.map((s) => s.a));
  const aMin = Math.min(0, ...p.segs.map((s) => s.a));
  const fwdPx = Math.max(Math.max(...vs) * kv, aMax * ka);
  const backPx = Math.max(-Math.min(...vs) * kv, -aMin * ka);
  const xr = trackRange(lo, hi, fwdPx, backPx, trackRect.w, narrow ? 46 : 70);
  const marks = [];
  for (let k = 1; k <= tt + 1e-9; k += 1) marks.push({ k, x: stateAt(p, k).x });

  /* graph */
  const plotTop = trackRect.y + trackRect.h + (narrow ? 44 : 48);
  const plotRect = narrow ? { x: 42, y: plotTop, w: W - 42 - 46, h: H - plotTop - 30 } : { x: 70, y: plotTop, w: W - 126, h: H - plotTop - 32 };
  const tr = axisRange(0, Math.max(p.T, 6), plotRect.w, narrow ? 30 : 80);
  const vr = axisRange(Math.min(...vs, 0) * 1.12, Math.max(...vs, 4) * 1.12, plotRect.h, narrow ? 28 : 32);
  const plot = makePlot(plotRect, tr, vr);
  const { gx, gy } = plot;

  const linePts = p.segs.length ? [`${gx(0)},${gy(0)}`, ...p.segs.map((s) => `${gx(s.t1)},${gy(s.v1)}`)].join(' ') : '';
  const livePts = [`${gx(0)},${gy(0)}`];
  p.segs.forEach((s) => {
    if (s.t0 >= fillTo) return;
    const te = Math.min(s.t1, fillTo);
    livePts.push(`${gx(te)},${gy(s.v0 + s.a * (te - s.t0))}`);
  });

  return (
    <g>
      <Track
        rect={trackRect}
        xr={xr}
        x={now.x}
        v={now.v}
        a={now.a}
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

      {/* piece areas */}
      {p.segs.map((s, i) =>
        pieceAreas(s, fillTo).map((q, k) => {
          const pts = [
            [gx(q.t0), gy(0)],
            [gx(q.t0), gy(q.va)],
            [gx(q.t1), gy(q.vb)],
            [gx(q.t1), gy(0)],
          ];
          const pos = q.s >= 0;
          return (
            <polygon
              key={`${i}-${k}`}
              points={pts.map((r) => r.join(',')).join(' ')}
              fill={pos ? C.disp : C.second}
              fillOpacity={i % 2 ? 0.13 : 0.24}
              stroke={pos ? C.disp : C.second}
              strokeOpacity="0.4"
            />
          );
        }),
      )}

      {/* piece borders and numbers */}
      {p.segs.map((s, i) => (
        <g key={`b${i}`}>
          {i < p.segs.length - 1 && <line x1={gx(s.t1)} x2={gx(s.t1)} y1={plot.y} y2={plot.y + plot.h} stroke="#94a3b8" strokeDasharray="3 4" />}
          {gx(s.t1) - gx(s.t0) > 22 && (
            <g>
              <circle cx={(gx(s.t0) + gx(s.t1)) / 2} cy={plot.y + 13} r="9" fill={s.s >= 0 ? C.disp : C.second} opacity={s.t0 < fillTo ? 1 : 0.35} />
              <text x={(gx(s.t0) + gx(s.t1)) / 2} y={plot.y + 17} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
                {i + 1}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* the whole graph faint, the part travelled bold */}
      {linePts && <polyline points={linePts} fill="none" stroke={C.vel} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round" />}
      {livePts.length > 1 && <polyline points={livePts.join(' ')} fill="none" stroke={C.vel} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />}

      {/* area values */}
      {p.segs.map((s, i) =>
        pieceAreas(s, fillTo).map((q, k) => {
          const full = q.t1 >= Math.min(s.t1, fillTo) - 1e-9 && s.t1 <= fillTo + 1e-9;
          const cen = centroid([
            [gx(q.t0), gy(0)],
            [gx(q.t0), gy(q.va)],
            [gx(q.t1), gy(q.vb)],
            [gx(q.t1), gy(0)],
          ]);
          if (!full || cen.area < (narrow ? 900 : 1400) || gx(q.t1) - gx(q.t0) < 40) return null;
          return (
            <Pill
              key={`p${i}-${k}`}
              x={cen.x}
              y={cen.y}
              text={`${q.s >= 0 ? '+' : '−'}${N(Math.abs(q.s))} ${c.m}`}
              bg={q.s >= 0 ? C.disp : C.second}
              size={fs - 1}
              box={box}
            />
          );
        }),
      )}

      {p.segs.length > 0 && (
        <>
          <circle cx={gx(tt)} cy={gy(now.v)} r={narrow ? 5.5 : 6.5} fill={C.vel} stroke="#fff" strokeWidth="2.5" />
          {tt > 0 && (
            <Label x={gx(tt)} y={gy(now.v) - 12} size={fs} color={C.vel}>
              {t.vTag(fmt(now.v, 1, dec))}
            </Label>
          )}
        </>
      )}
      {p.segs.length === 0 && (
        <text x={plot.x + plot.w / 2} y={plot.y + plot.h / 2} textAnchor="middle" fontSize={fs + 1} fill={C.muted}>
          {t.emptyGraph}
        </text>
      )}

      {p.T > 0 && <ScrubArea plot={{ ...plot, w: gx(p.T) - plot.x }} W={W} tMax={p.T} onScrub={onScrub} label={t.scrubHint} />}
    </g>
  );
}
