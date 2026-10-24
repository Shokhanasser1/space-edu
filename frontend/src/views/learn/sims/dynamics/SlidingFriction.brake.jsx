import { useState } from 'react';
import { Lightbulb } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Chip, FormulaTile, G, LabScene, PlayControls, Rich, Ruler, hash01, lineView, niceMax, round, rulerStep, tickDigits, trim } from './SlidingFriction.parts';

/**
 * Tab 3 — four identical cars brake at the same moment with locked wheels,
 * so the tyres slide: a = μg, s = v₀²/(2μg). Rubber on dry asphalt μ = 0.7,
 * wet asphalt 0.4, packed snow 0.2, ice 0.1. Preset 36 km/h = 10 m/s →
 * s = 7.29, 12.76, 25.51, 51.02 m: seven times smaller μ, seven times longer
 * road. Strings come from T.brake.
 */

const LANES = [
  { id: 'dry', mu: 0.7, car: '#d97706', text: '#fcd34d', road: '#6b7280', mark: '#111827', speck: '#9ca3af' },
  { id: 'wet', mu: 0.4, car: '#2563eb', text: '#93c5fd', road: '#4b5563', mark: '#0f172a', speck: '#64748b' },
  { id: 'snow', mu: 0.2, car: '#9333ea', text: '#d8b4fe', road: '#e8edf3', mark: '#64748b', speck: '#ffffff' },
  { id: 'ice', mu: 0.1, car: '#0e7490', text: '#67e8f9', road: '#c7ddf7', mark: '#1e3a8a', speck: '#ffffff' },
];
const IDLE = { t: 0, running: false, done: false };

export default function BrakeSim({ T }) {
  const L = T.brake;
  const dec = T.decimal;
  const [kmh, setKmh] = useState(36);
  const [sim, setSim] = useState(IDLE);
  const v0 = kmh / 3.6;
  const lanes = LANES.map((l) => {
    const a = l.mu * G;
    return { ...l, a, tStop: v0 / a, s: (v0 * v0) / (2 * a) };
  });
  const tMax = lanes[3].tStop;
  const speedUp = tMax > 8 ? Math.ceil(tMax / 6) : 1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tMax, p.t + dt * speedUp);
      const done = t >= tMax - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = sim.t;
  const S = (n) => round(n, n < 100 ? 2 : 1, dec);
  const D = (n) => trim(n, dec);
  const pos = (l) => (t >= l.tStop ? l.s : v0 * t - 0.5 * l.a * t * t);
  const vel = (l) => Math.max(0, v0 - l.a * t);

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t >= lanes[0].tStop) key = 'firstStop';
  else if (t > 0) key = 'braking';
  const settled = useSettled(key, key === 'braking' ? 200 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    braking: ex.braking(D(lanes[0].a), D(lanes[3].a)),
    firstStop: ex.firstStop(S(lanes[0].s)),
    done: ex.done(S(lanes[0].s), S(lanes[3].s)),
  }[settled];
  const tone = { idle: '#22d3ee', braking: '#fb923c', firstStop: '#fbbf24', done: '#34d399' }[settled];

  const vTop = niceMax(v0);
  const tTop = niceMax(tMax);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.035] px-3 pt-2 sm:px-4">
          <RangeField
            id="slfr-kmh"
            label={L.speed}
            symbol={<Rich>v₀</Rich>}
            min={18}
            max={90}
            step={9}
            value={kmh}
            onChange={(k) => {
              setKmh(k);
              setSim(IDLE);
            }}
            accent={PALETTE.vel}
            display={`${fmt(kmh, 0, dec)} ${T.kmh}`}
            hint={L.speedHint(D(v0))}
          />
          <div className="h-2" />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <BrakeScene T={T} lanes={lanes} t={t} pos={pos} vel={vel} speedUp={speedUp} kmh={kmh} S={S} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {lanes.map((l) => (
          <Readout
            key={l.id}
            label={L.lanes[l.id].name}
            symbol={<span className="whitespace-nowrap">μ = {D(l.mu)}</span>}
            value={S(pos(l))}
            unit={T.m}
            accent={l.car}
            textColor={l.text}
            active={t > 0 && t >= l.tStop}
            sub={L.readSub(D(l.a), round(l.tStop, 2, dec))}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile tag={L.formula.tag} color={PALETTE.dispText} general={L.formula.general} filled={L.formula.filled(D(v0), S(lanes[0].s))} result={L.formula.result} ok={sim.done} />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            {lanes.map((l) => (
              <div key={l.id} className="flex items-center gap-2 py-1 text-[13px] tabular-nums">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.car }} aria-hidden="true" />
                <span className="flex-1 text-gray-300">{L.lanes[l.id].name}</span>
                <span className="relative h-2 w-[38%] overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(l.s / lanes[3].s) * 100}%`, background: l.car }} />
                </span>
                <span className="w-16 text-right font-semibold" style={{ color: l.text }}>
                  {S(l.s)} {T.m}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={lanes.map((l) => {
              const te = Math.min(t, l.tStop);
              const pts = [
                { x: 0, y: v0 },
                { x: te, y: v0 - l.a * te },
              ];
              if (t > l.tStop) pts.push({ x: t, y: 0 });
              return { id: l.id, label: L.lanes[l.id].short, color: l.text, points: pts };
            })}
            xMax={tTop}
            yMax={vTop}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={t}
            note={L.graph.note}
            decimal={dec}
            xDigits={tickDigits(tTop)}
            yDigits={tickDigits(vTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

/** Top view of a car, centre at (x, y), facing right. */
function TopCar({ x, y, len, wid, color, braking }) {
  const Lc = len;
  const Wd = wid;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <rect x={-Lc / 2 + 1.5} y={-Wd / 2 + 2} width={Lc} height={Wd} rx={Wd * 0.3} fill="#0f172a" opacity="0.22" />
      <rect x={-Lc / 2} y={-Wd / 2} width={Lc} height={Wd} rx={Wd * 0.3} fill={color} stroke="#0f172a" strokeOpacity="0.55" strokeWidth={1.1} />
      <path d={`M${Lc * 0.1},${-Wd * 0.38} L${Lc * 0.24},${-Wd * 0.32} L${Lc * 0.24},${Wd * 0.32} L${Lc * 0.1},${Wd * 0.38} Z`} fill="#e0f2fe" opacity="0.95" />
      <path d={`M${-Lc * 0.3},${-Wd * 0.34} L${-Lc * 0.2},${-Wd * 0.3} L${-Lc * 0.2},${Wd * 0.3} L${-Lc * 0.3},${Wd * 0.34} Z`} fill="#e0f2fe" opacity="0.8" />
      <rect x={-Lc * 0.2} y={-Wd * 0.34} width={Lc * 0.3} height={Wd * 0.68} rx={2} fill="#fff" opacity="0.18" />
      <rect x={Lc / 2 - 3} y={-Wd / 2 + 2} width={2.5} height={Wd * 0.22} rx={1} fill="#fde68a" />
      <rect x={Lc / 2 - 3} y={Wd / 2 - 2 - Wd * 0.22} width={2.5} height={Wd * 0.22} rx={1} fill="#fde68a" />
      <rect x={-Lc / 2 + 0.5} y={-Wd / 2 + 2} width={2.5} height={Wd * 0.22} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      <rect x={-Lc / 2 + 0.5} y={Wd / 2 - 2 - Wd * 0.22} width={2.5} height={Wd * 0.22} rx={1} fill={braking ? '#ef4444' : '#991b1b'} />
      {braking && (
        <>
          <circle cx={-Lc / 2} cy={-Wd * 0.3} r={Wd * 0.28} fill="#ef4444" opacity="0.3" />
          <circle cx={-Lc / 2} cy={Wd * 0.3} r={Wd * 0.28} fill="#ef4444" opacity="0.3" />
        </>
      )}
    </g>
  );
}

function BrakeScene({ T, lanes, t, pos, vel, speedUp, kmh, S }) {
  const L = T.brake;
  const dec = T.decimal;
  const sIce = lanes[3].s;
  const lay = (narrow) => {
    const roadTop = narrow ? 58 : 62;
    const laneH = narrow ? 34 : 46;
    const roadBot = roadTop + 4 * laneH + 6;
    const rulerY = roadBot + 16;
    return { roadTop, laneH, roadBot, rulerY, H: rulerY + 30 };
  };

  return (
    <LabScene
      legend={[
        { color: '#1f2937', label: L.legend.skid, kind: 'line' },
        { color: '#dc2626', label: L.legend.line, kind: 'dash' },
      ]}
      chips={
        <Chip>
          {speedUp > 1 ? L.chipFast(speedUp) : L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => lay(narrow).H}
      ariaLabel={L.sceneLabel(fmt(kmh, 0, dec), lanes.map((l) => `${L.lanes[l.id].name} ${S(l.s)} ${T.m}`).join(', '))}
    >
      {(W, H, narrow) => {
        const { roadTop, laneH, roadBot, rulerY } = lay(narrow);
        const fs = narrow ? 10.5 : 12;
        const labelCol = narrow ? 58 : 148;
        const xEnd = sIce * 1.03;
        const padR = narrow ? 50 : 70;
        const kGuess = (W - labelCol - padR - 60) / xEnd;
        const carPx = Math.min(Math.max(4.4 * kGuess, narrow ? 26 : 38), narrow ? 42 : 70);
        const carW = laneH - (narrow ? 14 : 18);
        const view = lineView(0, xEnd, W, labelCol + carPx + (narrow ? 6 : 12), padR);
        const step = rulerStep(view, narrow ? 44 : 62);
        const ox = view.sx(0);
        const box = { w: W, h: H };
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* verges */}
            <rect x={labelCol} y={roadTop - 12} width={W - labelCol} height={12} fill="#dcfce7" />
            <rect x={labelCol} y={roadBot} width={W - labelCol} height={8} fill="#dcfce7" />
            {lanes.map((l, i) => {
              const y0 = roadTop + 2 + i * (laneH + 1);
              const yc = y0 + laneH / 2;
              const x = pos(l);
              const sp = vel(l);
              const front = view.sx(x);
              const rear = front - carPx * 0.85;
              const specks = [];
              const span = W - labelCol;
              const count = Math.floor(span / (l.id === 'snow' || l.id === 'ice' ? 22 : 9));
              for (let k = 0; k < count; k += 1) {
                const px = labelCol + hash01(k * 7 + i * 101) * span;
                const py = y0 + 3 + hash01(k * 13 + i * 17) * (laneH - 6);
                if (l.id === 'ice') specks.push(<line key={k} x1={px} x2={px + 12} y1={py + 2} y2={py - 2} stroke="#fff" strokeWidth={1.4} opacity={0.85} />);
                else if (l.id === 'snow') specks.push(<circle key={k} cx={px} cy={py} r={3 + hash01(k) * 3} fill="#fff" opacity={0.9} />);
                else specks.push(<circle key={k} cx={px} cy={py} r={0.8 + hash01(k + 3) * 0.7} fill={l.speck} />);
              }
              const tag = L.distTag(S(x));
              const tagW = textWidth(tag, fs, 700) + 16;
              const stopped = t > 0 && t >= l.tStop;
              return (
                <g key={l.id}>
                  <rect x={labelCol} y={y0} width={W - labelCol} height={laneH} fill={l.road} />
                  {specks}
                  {l.id === 'wet' &&
                    [0.22, 0.48, 0.71, 0.9].map((u) => <ellipse key={u} cx={labelCol + u * span} cy={y0 + laneH * (0.3 + hash01(u * 10) * 0.4)} rx={26} ry={5} fill="#93c5fd" opacity={0.45} />)}
                  {/* lane label */}
                  <rect x={0} y={y0} width={labelCol - 6} height={laneH} rx={8} fill="#f1f5f9" stroke="#e2e8f0" />
                  <rect x={0} y={y0} width={4} height={laneH} rx={2} fill={l.car} />
                  <text x={narrow ? 9 : 14} y={yc - (narrow ? 2 : 3)} fontSize={narrow ? 10.5 : 12.5} fontWeight="700" fill="#0f172a">
                    {narrow ? L.lanes[l.id].short : L.lanes[l.id].name}
                  </text>
                  <text x={narrow ? 9 : 14} y={yc + (narrow ? 11 : 14)} fontSize={narrow ? 10 : 11.5} fontWeight="600" fill="#475569" className="tabular-nums">
                    μ = {trim(l.mu, dec)}
                  </text>
                  {/* skid marks from the brake line */}
                  {rear > ox && (
                    <g opacity={l.id === 'ice' ? 0.35 : 0.55}>
                      <line x1={ox} x2={rear} y1={yc - carW * 0.3} y2={yc - carW * 0.3} stroke={l.mark} strokeWidth={2.2} />
                      <line x1={ox} x2={rear} y1={yc + carW * 0.3} y2={yc + carW * 0.3} stroke={l.mark} strokeWidth={2.2} />
                    </g>
                  )}
                  <TopCar x={front - carPx / 2} y={yc} len={carPx} wid={carW} color={l.car} braking={sp > 0.01 && t > 0} />
                  {x > 0.01 && <Pill x={front + 6 + tagW / 2} y={yc} text={stopped ? `✓ ${tag}` : tag} bg={stopped ? l.car : '#ffffff'} color={stopped ? '#fff' : '#0f172a'} border={stopped ? undefined : '#cbd5e1'} size={fs} box={box} />}
                </g>
              );
            })}
            {/* brake line */}
            <line x1={ox} x2={ox} y1={roadTop - 12} y2={roadBot + 6} stroke="#dc2626" strokeWidth={2} strokeDasharray="5 4" />
            <text x={ox + 6} y={roadTop - 3} fontSize={fs - 1} fontWeight="700" fill="#b91c1c">
              {L.brakeLine}
            </text>
            <rect x={0} y={rulerY - 2} width={W} height={H - rulerY + 2} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} fromX={labelCol} />
          </>
        );
      }}
    </LabScene>
  );
}
