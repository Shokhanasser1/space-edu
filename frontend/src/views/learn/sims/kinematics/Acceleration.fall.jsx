import { useState } from 'react';
import { Building, Castle, Home, Lightbulb } from 'lucide-react';

import { Arrow, Explain, Readout, Segmented, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, num } from './Acceleration.parts';

/**
 * Free fall from rest near the Earth (no air resistance): v = g·t with
 * g = 9.8 m/s², so the speed grows by 9.8 m/s every second; the ball is shown
 * with a stroboscope mark every whole second and a speed-per-second ladder.
 * Height above the ground y = h − g·t²/2. Strings come from T.fall.
 */

const G = 9.8;
const SLOW = 0.5; // the run is shown at half speed
const HEIGHTS = {
  h20: { h: 20, icon: Home },
  h45: { h: 45, icon: Building },
  h80: { h: 80, icon: Castle },
};
const IDLE = { t: 0, running: false, done: false };

export default function FallSim({ T }) {
  const L = T.fall;
  const dec = T.decimal;
  const [hId, setHId] = useState('h80');
  const [sim, setSim] = useState(IDLE);
  const h = HEIGHTS[hId].h;
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
  const pickH = (id) => {
    setHId(id);
    setSim(IDLE);
  };

  const t = sim.t;
  const v = G * t;
  const y = Math.max(0, h - 0.5 * G * t * t);
  const F = (n, k = 1) => num(n, k, dec);
  const n = Math.floor(t + 1e-9);

  let key = 'idle';
  if (sim.done) key = 'landed';
  else if (t > 0) key = n < 1 ? 'first' : `f${n}`;
  const settled = useSettled(key, 0);
  const ex = L.explain;
  let text = ex.idle;
  if (settled === 'landed') text = ex.landed(F(tLand, 2), F(G * tLand));
  else if (settled === 'first') text = ex.first;
  else if (settled.startsWith('f')) {
    const k = Number(settled.slice(1));
    text = ex.falling(k, F(G * k));
  }
  const tone = settled === 'landed' ? '#34d399' : settled === 'idle' ? '#22d3ee' : '#fb923c';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.heightLabel}</GroupLabel>
          <Segmented
            label={L.heightLabel}
            className="grid-cols-3"
            size="lg"
            value={hId}
            onChange={pickH}
            options={Object.keys(HEIGHTS).map((id) => ({ value: id, label: L.heights[id].name, sub: L.heights[id].sub, icon: HEIGHTS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <FallScene T={T} h={h} t={t} tLand={tLand} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.chipSlow} />
        <Readout label={L.readouts.v} symbol="v" value={F(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(fmt(v * 3.6, 0, dec))} />
        <Readout label={L.readouts.h} symbol="h" value={F(y)} unit={T.m} accent={PALETTE.disp} textColor={PALETTE.dispText} sub={L.hSub(F(h - y))} />
        <Readout label={L.readouts.g} symbol="g" value={F(G)} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={L.gSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile tag={L.readouts.v} color={PALETTE.velText} general="v = g·t" filled={`v = ${F(G)} · ${fmt(t, 2, dec)} = ${F(v)} ${T.ms}`} ok={sim.done} />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">{L.ladder.note}</div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <SpeedLadder T={T} t={t} tLand={tLand} done={sim.done} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function FallScene({ T, h, t, tLand, running }) {
  const L = T.fall;
  const dec = T.decimal;
  const y = Math.max(0, h - 0.5 * G * t * t);
  const v = G * t;
  const vLand = G * tLand;
  const marks = [];
  for (let n = 0; n <= Math.floor(Math.min(t, tLand) + 1e-9); n += 1) marks.push({ n, y: h - 0.5 * G * n * n, v: G * n });

  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: L.legend.g, kind: 'arrow' },
        { color: PALETTE.ink, label: L.legend.strobe, kind: 'ring' },
      ]}
      chips={
        <Chip>
          {L.chipSlow} · t = {fmt(t, 2, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 440 : 480)}
      ariaLabel={L.sceneLabel(fmt(t, 2, dec), num(v, 1, dec), num(y, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const padT = narrow ? 64 : 72;
        const padB = 40;
        const groundY = H - padB;
        const k = (groundY - padT) / h;
        const r = narrow ? 8 : 10;
        const rulerX = narrow ? 34 : 52;
        const towerX0 = rulerX + 14;
        const towerW = narrow ? 44 : 74;
        const towerX1 = towerX0 + towerW;
        const fx = towerX1 + (narrow ? 34 : 44);
        const topY = groundY - h * k;
        const ballY = groundY - y * k - r;
        const barX = fx + (narrow ? 40 : 56);
        const barK = Math.min(W - barX - (narrow ? 70 : 130), narrow ? 220 : 600) / vLand;
        const vk = Math.min((groundY - padT) * 0.3, 130) / vLand;
        const gLen = narrow ? 28 : 36;
        const step = niceStep(k, 34);
        const ticks = [];
        for (let m = 0; m <= h + 1e-9; m += step) ticks.push(m);
        const floors = Math.max(3, Math.round(h / 3.2));
        const floorH = (groundY - topY) / floors;
        const winRows = [];
        for (let i = 0; i < floors; i += 1) winRows.push(i);
        return (
          <>
            <defs>
              <radialGradient id="fall-ball" cx="35%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="100%" stopColor="#be123c" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* lab paper: horizontal lines at the ruler ticks */}
            {ticks.map((m) => (
              <line key={`g${m}`} x1={rulerX} x2={W} y1={groundY - m * k} y2={groundY - m * k} stroke={PALETTE.grid} strokeWidth={1} />
            ))}
            {/* height ruler */}
            <line x1={rulerX} x2={rulerX} y1={groundY} y2={padT - 16} stroke="#475569" strokeWidth={1.4} />
            {ticks.map((m) => (
              <g key={`t${m}`}>
                <line x1={rulerX - 6} x2={rulerX} y1={groundY - m * k} y2={groundY - m * k} stroke="#475569" strokeWidth={1.2} />
                <text x={rulerX - 9} y={groundY - m * k + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
                  {fmt(m, 0, dec)}
                </text>
              </g>
            ))}
            <text x={rulerX + 6} y={padT - 18} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {L.heightAxis}
            </text>
            {/* tower */}
            <rect x={towerX0} y={topY} width={towerW} height={groundY - topY} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.2} />
            {winRows.map((i) => {
              const wy = topY + i * floorH + floorH * 0.3;
              if (floorH < 5) return null;
              return (
                <g key={`w${i}`}>
                  <rect x={towerX0 + towerW * 0.14} y={wy} width={towerW * 0.28} height={Math.max(2, floorH * 0.42)} rx={1} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.8} />
                  <rect x={towerX0 + towerW * 0.58} y={wy} width={towerW * 0.28} height={Math.max(2, floorH * 0.42)} rx={1} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.8} />
                </g>
              );
            })}
            {/* ledge the ball starts from */}
            <rect x={towerX1 - 2} y={topY - 3} width={fx - towerX1 + r + 4} height={5} rx={2} fill="#64748b" />
            {/* fall line */}
            <line x1={fx} x2={fx} y1={topY} y2={groundY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 5" />
            {/* ground */}
            <rect x={0} y={groundY} width={W} height={H - groundY} fill="#ecfccb" />
            <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#65a30d" strokeWidth={2} />
            <text x={W - 10} y={groundY + 24} textAnchor="end" fontSize={fs} fontWeight="700" fill="#3f6212">
              {L.ground}
            </text>
            {/* stroboscope marks with a speed bar for each whole second */}
            {marks.map((m) => {
              const my = groundY - m.y * k - r;
              return (
                <g key={m.n}>
                  <line x1={fx + r + 2} x2={barX - 4} y1={my} y2={my} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 3" />
                  <circle cx={fx} cy={my} r={r} fill="#fff" stroke={PALETTE.ink} strokeWidth={1.6} strokeOpacity="0.6" />
                  <text x={fx - r - 7} y={my + 4} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                    {L.secTag(m.n)}
                  </text>
                  {m.v > 0 && <rect x={barX} y={my - 4} width={m.v * barK} height={8} rx={4} fill={PALETTE.vel} opacity="0.8" />}
                  <text x={barX + m.v * barK + 7} y={my + 4} fontSize={fs - 1} fontWeight="700" fill="#047857" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke" className="tabular-nums">
                    {L.vTag(num(m.v, 1, dec))}
                  </text>
                </g>
              );
            })}
            {/* the ball */}
            {running && <circle cx={fx} cy={ballY} r={r + 6} fill="#e11d48" className="cl-pulse" opacity="0.3" />}
            <circle cx={fx} cy={ballY} r={r} fill="url(#fall-ball)" stroke="#881337" strokeWidth={1} />
            {v * vk > 6 && y > 0.01 && <Arrow x1={fx + r + 10} y1={ballY} x2={fx + r + 10} y2={ballY + v * vk} color={PALETTE.vel} width={3} head={10} />}
            {y > 0.01 && <Arrow x1={fx - r - 10} y1={ballY - gLen / 2} x2={fx - r - 10} y2={ballY + gLen / 2} color={PALETTE.acc} width={3} head={9} />}
            {v * vk > 6 && y > 0.01 && (
              <text x={fx + r + 18} y={ballY + v * vk - 2} fontSize={fs + 1} fontStyle="italic" fontWeight="700" fill={PALETTE.vel} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                v
              </text>
            )}
            {y > 0.01 && (
              <text x={fx - r - 18} y={ballY + gLen / 2} textAnchor="end" fontSize={fs + 1} fontStyle="italic" fontWeight="700" fill={PALETTE.acc} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                g
              </text>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* --------------------------------------------------------------- ladder */

function SpeedLadder({ T, t, tLand, done }) {
  const L = T.fall;
  const dec = T.decimal;
  const vLand = G * tLand;
  const N = Math.floor(tLand + 1e-9);
  const rows = [];
  for (let n = 0; n <= N; n += 1) rows.push({ id: n, label: L.ladder.row(n), v: G * n, shown: t >= n - 1e-9 });
  rows.push({ id: 'land', label: L.ladder.land(num(tLand, 2, dec)), v: vLand, shown: done, land: true });
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.ladder.title}</p>
      <ol className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id}>
            {i > 0 && !r.land && (
              <p className={`ml-[104px] sm:ml-[144px] -mt-0.5 mb-0.5 text-[11px] font-semibold tabular-nums ${r.shown ? 'text-orange-300' : 'text-gray-600'}`} aria-hidden={!r.shown}>
                + {num(G, 1, dec)} {T.ms}
              </p>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={`w-[96px] sm:w-[136px] shrink-0 text-xs sm:text-sm leading-tight tabular-nums ${r.land ? 'text-emerald-300' : 'text-gray-300'}`}>{r.label}</span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                  style={{ width: r.shown ? `${(r.v / vLand) * 100}%` : '0%', background: r.land ? '#34d399' : '#10b981' }}
                />
              </span>
              <span className={`w-[78px] sm:w-[92px] shrink-0 text-right text-sm font-semibold tabular-nums ${r.shown ? 'text-white' : 'text-gray-600'}`}>
                {r.shown ? `${num(r.v, 1, dec)} ${T.ms}` : '?'}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
