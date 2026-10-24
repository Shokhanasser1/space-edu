import { useState } from 'react';
import { Bike, Car, Footprints, Lightbulb, Pause, Plane, Play, RotateCcw, Timer, TrainFront } from 'lucide-react';

import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, groupThousands, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { PANEL, PanelTitle, SceneChip, ScenePanel, ToggleChips, Vehicle, nf, nfa, tickStep } from './UniformMotion.parts';

/**
 * "Tezlik birliklari": five everyday movers set off together and move for
 * the same time, drawn to one scale, so s = v·t can be compared lane by lane;
 * underneath, a converter shows km/h ⇄ m/s (÷ 3.6, × 3.6) with the
 * arithmetic written out. Strings come from TEXT.speeds of UniformMotion.jsx.
 */

const RACERS = [
  { id: 'walker', v: 1.5, kind: 'walker', icon: Footprints, color: '#e11d48', len: [22, 26] },
  { id: 'bike', v: 5, kind: 'bike', icon: Bike, color: '#0d9488', len: [36, 44] },
  { id: 'car', v: 15, kind: 'car', icon: Car, color: '#f59e0b', len: [44, 56] },
  { id: 'train', v: 20, kind: 'train', icon: TrainFront, color: '#4f46e5', len: [58, 74] },
  { id: 'plane', v: 250, kind: 'plane', icon: Plane, color: '#0284c7', len: [54, 68] },
];
const BY_ID = Object.fromEntries(RACERS.map((r) => [r.id, r]));
const IDLE = { t: 0, running: false, done: false };
const C = PALETTE;

/* speed slider: square-root scale so 1.5 m/s and 250 m/s both fit */
const V_MAX = 300;
const toPos = (v) => 100 * Math.sqrt(v / V_MAX);
function fromPos(p) {
  const raw = V_MAX * (p / 100) ** 2;
  const step = raw < 10 ? 0.5 : raw < 50 ? 1 : 5;
  return Math.max(0.5, Math.round(raw / step) * step);
}

export default function SpeedsSim({ T }) {
  const t = T.speeds;
  const dec = T.decimal;
  const [sel, setSel] = useState(['walker', 'bike', 'car', 'train']);
  const [dur, setDur] = useState(10);
  const [sim, setSim] = useState(IDLE);
  const [cv, setCv] = useState(20);
  const speedUp = dur > 10 ? dur / 10 : 1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt * speedUp;
      if (tt >= dur) return { t: dur, running: false, done: true };
      return { ...p, t: tt };
    });
  });

  const toggleRacer = (id) => {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : RACERS.filter((r) => s.includes(r.id) || r.id === id).map((r) => r.id)));
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickDur = (d) => {
    setDur(d);
    setSim(IDLE);
  };

  const lanes = RACERS.filter((r) => sel.includes(r.id));
  const time = sim.t;
  const tR = Math.round(time * 10) / 10; // printed numbers use the printed time
  const A = (n) => nfa(n, 1, dec);
  const fast = lanes[lanes.length - 1];
  const slow = lanes[0];
  const ratio = fast && slow ? fast.v / slow.v : NaN;
  const name = (r) => t.racers[r.id];
  const dist = (s) => (s >= 100 ? groupThousands(s) : fmt(s, 1, dec));

  let key = 'idle';
  if (lanes.length === 0) key = 'none';
  else if (sim.done) key = lanes.length === 1 ? 'single' : 'done';
  else if (time > 0 || sim.running) key = sel.includes('plane') && lanes.length > 1 ? 'plane' : 'running';
  const settled = useSettled(key, key === 'running' || key === 'plane' ? 300 : 0);
  const ex = t.explain;
  let text = ex.idle(A(dur));
  if (settled === 'none') text = ex.none;
  else if (settled === 'running') text = ex.running;
  else if (settled === 'plane') text = ex.plane;
  else if (settled === 'single' && fast) text = ex.single(name(fast), A(fast.v), A(dur), A(fast.v * dur));
  else if (settled === 'done' && fast) text = ex.done(A(dur), name(fast), A(fast.v * dur), name(slow), A(slow.v * dur), nfa(ratio, 1, dec));
  const tone = settled === 'done' || settled === 'single' ? '#34d399' : settled === 'plane' ? '#38bdf8' : settled === 'none' ? '#fb7185' : '#22d3ee';

  const convId = RACERS.find((r) => Math.abs(r.v - cv) < 1e-9)?.id ?? 'custom';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.racersLabel}</p>
          <ToggleChips
            label={t.racersLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            values={sel}
            onToggle={toggleRacer}
            options={RACERS.map((r) => ({
              value: r.id,
              label: name(r).name,
              sub: `${A(r.v)} ${T.ms} · ${A(r.v * 3.6)} ${T.kmh}`,
              icon: r.icon,
              color: r.color === '#4f46e5' ? '#818cf8' : r.color,
            }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} disabled={lanes.length === 0} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? T.common.pause : sim.done ? T.common.again : time > 0 ? T.common.resume : T.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={time === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <RaceScene t={t} T={T} lanes={lanes} dur={dur} time={time} speedUp={speedUp} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.time} symbol="t" value={fmt(time, 1, dec)} unit={T.s} accent={C.time} textColor="#a5f3fc" sub={t.timeSub(A(dur))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(time / dur) * 100}%` }} />
          </div>
        </Readout>
        <Readout
          label={t.readouts.most}
          symbol="s"
          value={fast ? dist(fast.v * tR) : '—'}
          unit={T.m}
          accent={C.path}
          textColor={C.pathText}
          sub={fast ? `${name(fast).name} · s = ${A(fast.v)} · ${fmt(time, 1, dec)}` : ''}
        />
        <Readout
          label={t.readouts.least}
          symbol="s"
          value={slow ? dist(slow.v * tR) : '—'}
          unit={T.m}
          accent={C.path}
          textColor={C.pathText}
          sub={slow ? `${name(slow).name} · s = ${A(slow.v)} · ${fmt(time, 1, dec)}` : ''}
        />
        <Readout
          label={t.readouts.ratio}
          symbol={fast && slow && fast !== slow ? 'v₁ : v₂' : undefined}
          value={fast && slow ? `×${nfa(ratio, 1, dec)}` : '—'}
          accent="#e2e8f0"
          sub={t.ratioSub}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <RangeField
            id="um-race"
            label={t.race}
            symbol="t"
            min={5}
            max={60}
            step={5}
            value={dur}
            onChange={pickDur}
            accent={C.time}
            display={`${A(dur)} ${T.s}`}
            hint={t.raceHint(A(speedUp))}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{t.conv.pick}</p>
            <Segmented
              label={t.conv.pick}
              className="grid-cols-3 sm:grid-cols-6 lg:grid-cols-3"
              value={convId}
              onChange={(id) => id !== 'custom' && setCv(BY_ID[id].v)}
              accent="#a3e635"
              options={[
                ...RACERS.map((r) => ({ value: r.id, label: name(r).name, icon: r.icon })),
                { value: 'custom', label: t.conv.custom },
              ]}
            />
          </div>
          <RangeField
            id="um-conv"
            label={t.conv.slider}
            symbol="v"
            min={0}
            max={100}
            step={0.5}
            value={toPos(cv)}
            onChange={(p) => setCv(fromPos(p))}
            accent="#a3e635"
            display={`${A(cv)} ${T.ms}`}
            valueText={`${A(cv)} ${T.ms} = ${A(cv * 3.6)} ${T.kmh}`}
            hint={`= ${A(cv * 3.6)} ${T.kmh}`}
          />
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <Converter t={t.conv} T={T} v={cv} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- converter */

function Converter({ t, T, v }) {
  const dec = T.decimal;
  const A = (n) => nfa(n, 1, dec);
  const kmh = v * 3.6;
  const d36 = fmt(3.6, 1, dec);
  const metres = groupThousands(kmh * 1000);
  return (
    <div>
      <PanelTitle>{t.title}</PanelTitle>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
        <div className="rounded-2xl border border-amber-300/40 bg-amber-400/[0.07] p-3 text-center">
          <p className="text-[28px] sm:text-[36px] font-bold leading-none tabular-nums text-amber-200">{A(kmh)}</p>
          <p className="mt-1 text-sm text-amber-100/80">{T.kmh}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-1.5 px-1" aria-hidden="true">
          <span className="text-xs font-semibold tabular-nums text-amber-200">{t.divide(d36)}</span>
          <svg width="64" height="12" viewBox="0 0 64 12">
            <line x1="2" y1="6" x2="54" y2="6" stroke="#fcd34d" strokeWidth="2" />
            <path d="M62,6 L53,1.5 L53,10.5 Z" fill="#fcd34d" />
          </svg>
          <svg width="64" height="12" viewBox="0 0 64 12">
            <line x1="10" y1="6" x2="62" y2="6" stroke="#6ee7b7" strokeWidth="2" />
            <path d="M2,6 L11,1.5 L11,10.5 Z" fill="#6ee7b7" />
          </svg>
          <span className="text-xs font-semibold tabular-nums text-emerald-200">{t.multiply(d36)}</span>
        </div>
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-400/[0.07] p-3 text-center">
          <p className="text-[28px] sm:text-[36px] font-bold leading-none tabular-nums text-emerald-200">{A(v)}</p>
          <p className="mt-1 text-sm text-emerald-100/80">{T.ms}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 rounded-xl bg-black/25 px-3 py-2.5 text-sm tabular-nums leading-relaxed">
        <p>
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-300/80">{t.toMs}</span>
          <span className="text-gray-100">{t.line1(A(kmh), metres, A(v))}</span>
        </p>
        <p>
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300/80">{t.toKmh}</span>
          <span className="text-gray-100">{t.line2(d36, A(v), A(kmh))}</span>
        </p>
        <p className="text-gray-400">{t.meaning(A(v), A(kmh))}</p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function RaceScene({ t, T, lanes, dur, time, speedUp, running }) {
  const dec = T.decimal;
  const A = (n) => nfa(n, 1, dec);
  const n = Math.max(lanes.length, 1);
  const maxS = Math.max(1, ...lanes.map((r) => r.v * dur));
  const legend = [
    { color: '#475569', label: t.legend.trail, kind: 'dot' },
    { color: C.ink, label: t.legend.start, kind: 'dash' },
  ];
  const chips = (
    <>
      <SceneChip icon={Timer} strong>
        {t.tChip(fmt(time, 1, dec))}
      </SceneChip>
      <SceneChip icon={Timer}>{speedUp > 1 ? t.timeChip(A(speedUp)) : t.realTime}</SceneChip>
    </>
  );
  const top = (narrow) => (narrow ? 50 : 60);
  const laneH = (narrow) => (narrow ? 54 : 62);

  return (
    <ScenePanel
      height={(W, narrow) => top(narrow) + n * laneH(narrow) + (narrow ? 42 : 46)}
      ariaLabel={t.sceneLabel(fmt(time, 1, dec))}
      legend={legend}
      chips={chips}
    >
      {(W, H, narrow) => {
        const y0 = top(narrow);
        const lh = laneH(narrow);
        const startX = narrow ? 56 : 92;
        const padR = narrow ? 20 : 34;
        const X = (m) => startX + (m / maxS) * (W - startX - padR);
        const ruleY = y0 + n * lh + 6;
        const step = tickStep(maxS, W - startX - padR, narrow ? 48 : 72);
        const ticks = [];
        for (let m = 0; m <= maxS + 1e-9; m += step) ticks.push(m);
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        return (
          <g>
            <rect width={W} height={H} fill="#fbfcfe" />
            {ticks.map((m) => (
              <line key={`g${m}`} x1={X(m)} x2={X(m)} y1={y0} y2={ruleY} stroke="#e2e8f0" />
            ))}
            {lanes.map((r, i) => (
              <rect key={`bg${r.id}`} x={0} y={y0 + i * lh} width={W} height={lh} fill={i % 2 ? '#f8fafc' : '#f1f5f9'} fillOpacity="0.7" />
            ))}
            {lanes.map((r, i) => {
              const by = y0 + (i + 1) * lh - 13;
              return <line key={`base${r.id}`} x1={0} x2={W} y1={by} y2={by} stroke="#cbd5e1" strokeWidth="1.5" />;
            })}
            <line x1={startX} x2={startX} y1={y0 - 4} y2={ruleY} stroke={C.ink} strokeWidth="1.6" strokeDasharray="5 4" />

            {lanes.map((r, i) => {
              const by = y0 + (i + 1) * lh - 13;
              const s = r.v * time;
              const sR = r.v * (Math.round(time * 10) / 10);
              const len = r.len[narrow ? 0 : 1];
              const front = X(s);
              const dots = [];
              for (let k = 1; k <= Math.floor(time + 1e-9); k += 1) dots.push(k);
              const isPlane = r.kind === 'plane';
              return (
                <g key={r.id}>
                  {dots.map((k) => (
                    <circle key={k} cx={X(r.v * k)} cy={by + 5} r={narrow ? 1.8 : 2.2} fill={r.color} fillOpacity="0.75" />
                  ))}
                  <Vehicle
                    kind={r.kind}
                    x={r.kind === 'walker' ? front - 4 : front - len / 2}
                    y={isPlane ? by - 6 : by}
                    len={len}
                    color={r.color}
                    phase={r.kind === 'walker' ? s / 0.75 : s / 2}
                    moving={running}
                  />
                  {(() => {
                    const label = t.distTag(sR >= 100 ? groupThousands(sR) : fmt(sR, 1, dec));
                    const room = W - front > (narrow ? 64 : 80);
                    return (
                      <Pill
                        x={room ? front + (narrow ? 28 : 36) : front - len - (narrow ? 26 : 34)}
                        y={by - lh * 0.42}
                        text={label}
                        bg="#fff"
                        color={C.ink}
                        border={r.color}
                        size={fs - 1}
                        box={box}
                      />
                    );
                  })()}
                  <text
                    x={startX + 8}
                    y={y0 + i * lh + (narrow ? 13 : 15)}
                    fontSize={fs - 1}
                    fontWeight="600"
                    fill="#334155"
                    stroke="#f8fafc"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {t.laneTag(t.racers[r.id].name, A(r.v), A(r.v * 3.6))}
                  </text>
                </g>
              );
            })}

            <line x1={startX} x2={W - padR + 10} y1={ruleY} y2={ruleY} stroke="#334155" strokeWidth="1.6" />
            <path d={`M${W - padR + 18},${ruleY} L${W - padR + 9},${ruleY - 4.5} L${W - padR + 9},${ruleY + 4.5} Z`} fill="#334155" />
            {ticks.map((m) => (
              <g key={`t${m}`}>
                <line x1={X(m)} x2={X(m)} y1={ruleY} y2={ruleY + 7} stroke="#334155" strokeWidth="1.2" />
                <text x={X(m)} y={ruleY + 21} textAnchor="middle" fontSize={fs - 1} fill={m === 0 ? C.ink : '#64748b'} fontWeight={m === 0 ? 700 : 400}>
                  {m >= 1000 ? groupThousands(m) : nf(m, 0, dec)}
                </text>
              </g>
            ))}
            <text x={W - 6} y={ruleY - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.axis}
            </text>
          </g>
        );
      }}
    </ScenePanel>
  );
}
