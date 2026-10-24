import { useState } from 'react';
import { BookOpen, CircleCheck, Hand, Lightbulb, Pause, Play, RotateCcw, Snail, Timer, TrendingDown } from 'lucide-react';

import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { PANEL, SceneChip, ScenePanel, nf, nfa, paren } from './UniformMotion.parts';
import { T_END, Track, X_MAX, X_MIN, playLabel, trackScale, useRun } from './UniformMotionGraphs.track';

/**
 * "v–t grafigi": the same cart on the same track, now with its velocity
 * graph - a horizontal line - and the rectangle under it growing as the
 * cart moves. Its area S = v·t is printed beside the displacement arrow
 * Δx = x − x₀ drawn on the track, and the two always agree. Strings come
 * from TEXT.vt of UniformMotionGraphs.jsx.
 */

const PRESETS = [
  { id: 'book', x0: 10, v: 5, icon: BookOpen },
  { id: 'back', x0: 80, v: -6, icon: TrendingDown },
  { id: 'slow', x0: 0, v: 2, icon: Snail },
];
const V_LIM = 10;
const C = PALETTE;
const TIME_INK = '#0e7490';

function geomVt(W, H, narrow) {
  const railY = narrow ? 104 : 122;
  const dispY = railY + (narrow ? 46 : 50);
  return {
    railY,
    dispY,
    padL: narrow ? 24 : 44,
    padR: narrow ? 30 : 52,
    gL: narrow ? 40 : 60,
    gR: W - (narrow ? 16 : 28),
    gT: dispY + (narrow ? 34 : 40),
    gB: H - (narrow ? 32 : 36),
  };
}

export default function AreaSim({ T }) {
  const t = T.vt;
  const dec = T.decimal;
  const [x0, setX0] = useState(10);
  const [v, setV] = useState(5);
  const run = useRun(x0, v);
  const { tEnd } = run;

  const pick = (id) => {
    const p = PRESETS.find((q) => q.id === id);
    setX0(p.x0);
    setV(p.v);
    run.reset();
  };
  const change = (setter) => (val) => {
    setter(val);
    run.reset();
  };
  const active = PRESETS.find((p) => p.x0 === x0 && p.v === v)?.id ?? null;

  const time = run.t;
  // printed numbers use the time as printed (0.1 s), so the arithmetic on screen adds up
  const tR = Math.round(time * 10) / 10;
  const x = x0 + v * tR;
  const S = v * tR;
  const A = (n) => nfa(n, 1, dec);
  const F = (n) => fmt(n, 1, dec);

  let key = 'idle';
  if (run.atEnd && !run.running) key = tEnd < T_END - 1e-9 ? 'edge' : v > 0 ? 'done' : v < 0 ? 'doneNeg' : 'doneRest';
  else if (!run.running && run.done && time > 0) key = 'scrub';
  else if (run.running || time > 0) key = v > 0 ? 'pos' : v < 0 ? 'neg' : 'rest';
  const settled = useSettled(key, key === 'pos' || key === 'neg' || key === 'rest' || key === 'scrub' ? 300 : 0);
  const ex = t.explain;
  const xE = x0 + v * tEnd;
  const SE = v * tEnd;
  const text = {
    idle: ex.idle,
    pos: ex.pos,
    neg: ex.neg,
    rest: ex.rest,
    done: ex.done(A(v), A(tEnd), nf(SE, 1, dec), A(xE), paren(A(x0)), nf(xE - x0, 1, dec)),
    doneNeg: ex.doneNeg(paren(A(v)), A(tEnd), nf(SE, 1, dec), A(xE), paren(A(x0)), nf(xE - x0, 1, dec)),
    doneRest: ex.doneRest(A(tEnd)),
    scrub: ex.scrub,
    edge: ex.edge(A(xE), F(tEnd), paren(A(v)), nf(SE, 1, dec)),
  }[settled];
  const tone = settled.startsWith('done') || settled === 'edge' ? '#34d399' : settled === 'neg' ? '#60a5fa' : settled === 'rest' ? '#fbbf24' : '#22d3ee';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.presetsLabel}</p>
          <Segmented
            label={t.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={active}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={run.running ? Pause : Play} onClick={run.toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {playLabel(run, T.common)}
          </Btn>
          <Btn icon={RotateCcw} onClick={run.reset} disabled={time === 0 && !run.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <AreaScene t={t} dec={dec} x0={x0} v={v} run={run} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.time}
          symbol="t"
          value={F(time)}
          unit={T.s}
          accent={C.time}
          textColor="#a5f3fc"
          sub={tEnd < T_END - 1e-9 ? t.timeSubEdge(F(tEnd)) : t.timeSub}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(time / T_END) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={t.readouts.vel} symbol="v" value={A(v)} unit={T.ms} accent={C.vel} textColor={C.velText} sub={t.velSub} />
        <Readout label={t.readouts.area} symbol="S" value={nf(S, 1, dec)} unit={T.m} accent={C.disp} textColor={C.dispText} sub={t.areaSub(paren(A(v)), F(tR))} />
        <Readout label={t.readouts.disp} symbol="Δx" value={nf(x - x0, 1, dec)} unit={T.m} accent={C.disp} textColor={C.dispText} sub={t.dispSub(nf(x, 1, dec), paren(A(x0)))}>
          <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <CircleCheck size={12} aria-hidden="true" /> {t.equal}
          </span>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <RangeField id="umg-a-x0" label={t.x0} symbol="x₀" min={-20} max={100} step={5} value={x0} onChange={change(setX0)} accent={C.disp} display={`${A(x0)} ${T.m}`} hint={t.x0Hint} />
          <RangeField id="umg-a-v" label={t.v} symbol="v" min={-V_LIM} max={V_LIM} step={0.5} value={v} onChange={change(setV)} accent={C.vel} display={`${A(v)} ${T.ms}`} hint={t.vHint} />
          <p className="flex items-start gap-2 rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">
            <Hand size={15} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" /> {t.scrubHint}
          </p>
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <TimeGraph
            title={t.xt.title}
            series={[{ id: 'x', label: t.xt.series, color: '#60a5fa', points: time > 0 ? [{ x: 0, y: x0 }, { x: time, y: x }] : [{ x: 0, y: x0 }] }]}
            xMax={T_END}
            yMin={X_MIN}
            yMax={X_MAX}
            xLabel={t.xt.x}
            yLabel={t.xt.y}
            marker={time}
            note={t.xt.note}
            decimal={dec}
            height={190}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function AreaScene({ t, dec, x0, v, run }) {
  const time = run.t;
  const x = x0 + v * time;
  const tR = Math.round(time * 10) / 10;
  const xR = x0 + v * tR;
  const S = v * tR;
  const A = (n) => nfa(n, 1, dec);
  const F = (n) => fmt(n, 1, dec);
  const legend = [
    { color: C.vel, label: t.legend.v, kind: 'line' },
    { color: C.disp, label: t.legend.area, kind: 'area' },
    { color: C.disp, label: t.legend.disp, kind: 'arrow' },
  ];
  const chips = (
    <SceneChip icon={Timer} strong>
      {t.chip(F(time))}
    </SceneChip>
  );
  const onScrub = (px, py, W, H, first) => {
    const g = geomVt(W, H, W < 560);
    if (first && (py < g.gT - 14 || px < g.gL - 16 || px > g.gR + 16)) return false;
    run.scrub(((px - g.gL) / (g.gR - g.gL)) * T_END);
    return true;
  };

  return (
    <ScenePanel height={(W, narrow) => (narrow ? 486 : 560)} ariaLabel={t.sceneLabel(F(time), nf(S, 1, dec))} legend={legend} chips={chips} onScrub={onScrub}>
      {(W, H, narrow) => {
        const g = geomVt(W, H, narrow);
        const X = trackScale(W, g.padL, g.padR);
        const gx = (s) => g.gL + (s / T_END) * (g.gR - g.gL);
        const gy = (val) => g.gB - ((val + V_LIM) / (2 * V_LIM)) * (g.gB - g.gT);
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const gBox = { w: g.gR + 6, h: g.gB + 2 };
        const y0 = gy(0);
        const yv = gy(v);
        const rx = gx(0);
        const rw = gx(time) - rx;
        const rTop = Math.min(y0, yv);
        const rh = Math.abs(yv - y0);
        const areaText = t.areaTag(paren(A(v)), F(tR), nf(S, 1, dec));
        const areaW = textWidth(areaText, fs, 600) + 16;
        const inside = rw > areaW + 8 && rh > fs + 14;
        const vText = t.vTag(A(v));
        const vW = textWidth(vText, fs - 1, 600) + 16;
        const dispText = t.dispTag(nf(xR - x0, 1, dec));
        const cells = [];
        for (let s = 1; s < time; s += 1) cells.push(<line key={`cv${s}`} x1={gx(s)} x2={gx(s)} y1={rTop} y2={rTop + rh} stroke={C.disp} strokeOpacity="0.28" />);
        for (let m = 1; m < Math.abs(v); m += 1) {
          const yy = gy(Math.sign(v) * m);
          cells.push(<line key={`ch${m}`} x1={rx} x2={rx + rw} y1={yy} y2={yy} stroke={C.disp} strokeOpacity="0.28" />);
        }
        const vLabels = [];
        for (let m = -V_LIM; m <= V_LIM; m += narrow ? 5 : 2) vLabels.push(m);

        return (
          <g>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Track X={X} y={g.railY} narrow={narrow} x0={x0} x={x} xLabel={xR} v={v} moving={run.running || (time > 0 && !run.atEnd)} labels={t} dec={dec} W={W} H={H} />

            {/* displacement on the track */}
            <line x1={X(x0)} x2={X(x0)} y1={g.railY + 12} y2={g.dispY + 8} stroke={C.ink} strokeOpacity="0.35" strokeDasharray="3 3" />
            {Math.abs(X(x) - X(x0)) > 4 && (
              <g>
                <line x1={X(x)} x2={X(x)} y1={g.railY + 12} y2={g.dispY + 8} stroke={C.disp} strokeOpacity="0.5" strokeDasharray="3 3" />
                <line
                  x1={X(x0)}
                  x2={X(x) - Math.sign(x - x0) * 10}
                  y1={g.dispY}
                  y2={g.dispY}
                  stroke={C.disp}
                  strokeWidth={narrow ? 3 : 3.5}
                  strokeLinecap="round"
                />
                <path d={`M${X(x)},${g.dispY} l${-Math.sign(x - x0) * 12},-6 l0,12 Z`} fill={C.disp} />
                <Pill x={(X(x0) + X(x)) / 2} y={g.dispY} text={dispText} bg={C.disp} size={fs} box={box} />
              </g>
            )}

            {/* v–t graph */}
            <rect x={g.gL} y={g.gT} width={g.gR - g.gL} height={g.gB - g.gT} fill="#fff" stroke="#e2e8f0" />
            {Array.from({ length: 2 * V_LIM + 1 }, (_, i) => i - V_LIM).map((m) => (
              <line key={`h${m}`} x1={g.gL} x2={g.gR} y1={gy(m)} y2={gy(m)} stroke={m === 0 ? '#64748b' : m % 2 === 0 ? '#e2e8f0' : '#f1f5f9'} strokeWidth={m === 0 ? 1.5 : 1} />
            ))}
            {Array.from({ length: T_END + 1 }, (_, s) => (
              <g key={`v${s}`}>
                <line x1={gx(s)} x2={gx(s)} y1={g.gT} y2={g.gB} stroke="#e2e8f0" />
                <text x={gx(s)} y={g.gB + 16} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
                  {s}
                </text>
              </g>
            ))}
            {vLabels.map((m) => (
              <text key={`vl${m}`} x={g.gL - 6} y={gy(m) + 4} textAnchor="end" fontSize={fs - 1} fill={m === 0 ? C.ink : '#64748b'} fontWeight={m === 0 ? 700 : 400}>
                {nf(m, 0, dec)}
              </text>
            ))}
            <line x1={g.gL} x2={g.gL} y1={g.gB} y2={g.gT - 8} stroke="#334155" strokeWidth="1.5" />
            <path d={`M${g.gL},${g.gT - 14} L${g.gL - 4},${g.gT - 6} L${g.gL + 4},${g.gT - 6} Z`} fill="#334155" />
            <text x={g.gL + 8} y={g.gT - 6} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.gV}
            </text>
            <text x={g.gR} y={g.gB + 30} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.gT}
            </text>
            <text x={g.gR - 6} y={g.gT + 15} textAnchor="end" fontSize={fs - 1} fill="#64748b" stroke="#fff" strokeWidth="3" paintOrder="stroke">
              {t.cell}
            </text>

            {/* the rectangle under the line = displacement */}
            {rw > 0.5 && rh > 0.5 && (
              <g>
                <rect x={rx} y={rTop} width={rw} height={rh} fill={C.disp} fillOpacity="0.18" />
                {cells}
                <rect x={rx} y={rTop} width={rw} height={rh} fill="none" stroke={C.disp} strokeWidth="1.6" />
              </g>
            )}

            {/* velocity line */}
            <line x1={gx(0)} x2={gx(run.tEnd)} y1={yv} y2={yv} stroke={C.vel} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 5" />
            {run.tMax > 0 && <line x1={gx(0)} x2={gx(run.tMax)} y1={yv} y2={yv} stroke={C.vel} strokeWidth="3.2" strokeLinecap="round" />}
            <line x1={gx(time)} x2={gx(time)} y1={g.gT} y2={g.gB} stroke={TIME_INK} strokeOpacity="0.45" strokeDasharray="3 4" />
            <circle cx={gx(time)} cy={yv} r={5.5} fill={C.vel} stroke="#fff" strokeWidth="2" />
            <Pill x={g.gL + vW / 2 + 6} y={yv + (v >= 0 ? -14 : 14)} text={vText} bg={C.vel} size={fs - 1} box={gBox} />

            {time > 0 && Math.abs(v) > 1e-9 && (
              <Pill
                x={inside ? rx + rw / 2 : Math.max(rx + areaW / 2 + 4, rx + rw / 2)}
                y={inside ? rTop + rh / 2 : v >= 0 ? y0 + 16 : y0 - 16}
                text={areaText}
                bg={C.disp}
                size={fs}
                box={gBox}
              />
            )}
          </g>
        );
      }}
    </ScenePanel>
  );
}
